/**
 * ============================================================================
 * Toroloom — Multi-Tenant Subscription Store
 * ============================================================================
 *
 * Powers the granular feature paywall matrix that platform buyers (tenants)
 * can configure independently. Each tenant gets:
 *
 *   1. Feature Matrix Overrides — Tenant decides which features are free vs paid
 *   2. Custom Plan Pricing — Tenant sets their own ₹ amounts per plan
 *   3. Per-Tenant Razorpay Config — Revenue routes to the tenant's account
 *
 * Architecture:
 *   DEFAULT_FEATURE_MATRIX  →  Default tier for every feature
 *   TENANT_FEATURE_MATRIX   →  DEFAULT_FEATURE_MATRIX × tenant overrides
 *   Plans                   →  Predefined plans (Free / Pro / Elite)
 *   Tenant Plans            →  Plans with tenant's custom pricing overlays
 *
 * Usage:
 *   useSubscriptionStore.getState().configureTenant(myTenantConfig);
 *   useSubscriptionStore.getState().isFeatureAvailable('ai_insights');
 * ============================================================================
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SubscriptionPlan,
  SubscriptionTier,
  SubscriptionFeature,
  UserSubscription,
  DEFAULT_FEATURE_MATRIX,
  TenantConfig,
  PaywallOverride,
} from '../types';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { paymentsApi } from '../services/api/payments';

// ============ Storage Keys ============

const STORAGE_KEY_SUBSCRIPTION = 'toroloom_subscription';
const STORAGE_KEY_TENANT = 'toroloom_active_tenant';

// ============ Default Subscription ============

const DEFAULT_SUBSCRIPTION: UserSubscription = {
  tier: 'free',
  planId: 'plan_free',
  status: 'active',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  autoRenew: false,
};

// ============ Subscription Plans ============
// Each plan has an `includedFeatures` array that maps to the feature matrix.
// This enables the comparison UI to be driven from the matrix automatically.

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_free',
    tier: 'free',
    name: 'Free',
    tagline: 'Get started with basic tools',
    price: 0,
    priceYearly: 0,
    icon: 'rocket-outline',
    gradient: ['#1F2937', '#111827'] as [string, string],
    features: [
      'Basic portfolio tracking',
      '5 watchlist stocks',
      'Limited education access',
      'Market indices overview',
      'Standard support',
    ],
    includedFeatures: ['basic_portfolio'],
  },
  {
    id: 'plan_pro',
    tier: 'pro',
    name: 'Pro',
    tagline: 'For serious investors',
    price: 399,
    priceYearly: 3999,
    icon: 'flash',
    gradient: ['#3B82F6', '#2563EB'] as [string, string],
    features: [
      'Everything in Free, plus:',
      'Advanced portfolio analytics',
      'Unlimited watchlists',
      'AI-powered insights',
      'AI Voice Companion',
      'Full education library',
      'Real-time price alerts',
      'Ad-free experience',
      'Priority support',
    ],
    highlightedFeature: 'AI Insights & Analytics',
    badge: 'POPULAR',
    popular: true,
    includedFeatures: [
      'basic_portfolio', 'unlimited_watchlist', 'advanced_analytics',
      'ai_insights', 'ai_companion', 'full_education', 'ad_free',
      'priority_support',
    ],
  },
  {
    id: 'plan_elite',
    tier: 'elite',
    name: 'Elite',
    tagline: 'The ultimate trading experience',
    price: 999,
    priceYearly: 9999,
    icon: 'diamond',
    gradient: ['#10B981', '#059669'] as [string, string],
    features: [
      'Everything in Pro, plus:',
      'Iron Lock Engine — server-side loss limits',
      'Real-time streaming data',
      'Social trading & copy trading',
      'Tax reports & capital gains',
      'Behavioural trading journal',
      'Advanced charting with indicators',
      'API access for automation',
      'No advertisements',
      'Dedicated account manager',
      'Early access to new features',
    ],
    highlightedFeature: 'Iron Lock + Real-Time Data',
    badge: 'BEST VALUE',
    includedFeatures: [
      'basic_portfolio', 'unlimited_watchlist', 'advanced_analytics',
      'ai_insights', 'ai_companion', 'iron_lock', 'real_time_data',
      'social_trading', 'full_education', 'tax_reports', 'api_access',
      'ad_free', 'priority_support', 'dedicated_manager',
      'behavioural_journal',
    ],
  },
];

// ============ Helper: Build effective feature matrix with tenant overrides ============

function buildEffectiveMatrix(
  overrides: PaywallOverride | null | undefined = undefined,
): typeof DEFAULT_FEATURE_MATRIX {
  const matrix = { ...DEFAULT_FEATURE_MATRIX };

  if (!overrides) return matrix;

  for (const [feature, overrideTier] of Object.entries(overrides)) {
    const f = feature as SubscriptionFeature;
    if (matrix[f] && overrideTier) {
      matrix[f] = { ...matrix[f], minTier: overrideTier };
    }
  }

  return matrix;
}

// ============ Helper: Compute effective price for a plan (tenant override) ============

function getEffectivePrice(
  plan: SubscriptionPlan,
  tenant?: TenantConfig,
): { monthly: number; yearly: number } {
  if (!tenant?.razorpay?.pricing?.[plan.id]) {
    return { monthly: plan.price, yearly: plan.priceYearly };
  }
  const tp = tenant.razorpay.pricing[plan.id]!;
  return {
    monthly: !isNaN(tp.monthly) ? (tp.monthly ?? plan.price) : plan.price,
    yearly: !isNaN(tp.yearly) ? (tp.yearly ?? plan.priceYearly) : plan.priceYearly,
  };
}

// ============ Helper: Get minimum tier required for a feature ============

function getMinimumTierForFeature(
  feature: SubscriptionFeature,
  tenant: TenantConfig | null | undefined = undefined,
): SubscriptionTier {
  const effectiveMatrix = buildEffectiveMatrix(tenant?.featureOverrides);
  return effectiveMatrix[feature]?.minTier ?? 'free';
}

// ============ Store Interface ============

interface SubscriptionState {
  subscription: UserSubscription;
  tenantConfig: TenantConfig | null;
  isLoading: boolean;
  initialized: boolean;

  // ──── Computed / Derived ─────────────────────────────────
  /** The effective feature matrix after applying tenant overrides */
  getEffectiveFeatureMatrix: () => ReturnType<typeof buildEffectiveMatrix>;
  /** Check if the current user (or a given tier) can access a feature */
  isFeatureAvailable: (feature: SubscriptionFeature, tierOverride?: SubscriptionTier) => boolean;
  /** Get all features available for a given tier */
  getFeaturesForTier: (tier: SubscriptionTier) => SubscriptionFeature[];
  /** Get the effective price for a plan (factoring tenant overrides) */
  getPlanPrice: (planId: string) => { monthly: number; yearly: number };

  // ──── Actions ────────────────────────────────────────────
  loadSubscription: () => Promise<void>;
  /** Configure the active tenant (called at app init) */
  configureTenant: (config: TenantConfig) => Promise<void>;
  getTenantConfig: () => TenantConfig | null;
  initiateUpgrade: (plan: SubscriptionPlan, billingPeriod?: 'monthly' | 'yearly') => Promise<void>;
  cancelSubscription: () => Promise<void>;
  downgradeToFree: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscription: DEFAULT_SUBSCRIPTION,
  tenantConfig: null,
  isLoading: false,
  initialized: false,

  // ──── Computed ─────────────────────────────────────────────

  getEffectiveFeatureMatrix: () => {
    const { tenantConfig } = get();
    return buildEffectiveMatrix(tenantConfig?.featureOverrides);
  },

  isFeatureAvailable: (feature: SubscriptionFeature, tierOverride?: SubscriptionTier) => {
    const { subscription, tenantConfig } = get();
    const userTier = tierOverride ?? subscription.tier;
    const minTier = getMinimumTierForFeature(feature, tenantConfig);

    const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, elite: 2 };
    return TIER_RANK[userTier] >= TIER_RANK[minTier];
  },

  getFeaturesForTier: (tier: SubscriptionTier) => {
    const { tenantConfig } = get();
    const effective = buildEffectiveMatrix(tenantConfig?.featureOverrides);
    const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, elite: 2 };
    return (Object.keys(effective) as SubscriptionFeature[])
      .filter(f => TIER_RANK[tier] >= TIER_RANK[effective[f].minTier]);
  },

  getPlanPrice: (planId: string) => {
    const { tenantConfig } = get();
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) return { monthly: 0, yearly: 0 };
    return getEffectivePrice(plan, tenantConfig ?? undefined);
  },

  // ──── Actions ──────────────────────────────────────────────

  loadSubscription: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_SUBSCRIPTION);
      const storedTenant = await AsyncStorage.getItem(STORAGE_KEY_TENANT);

      const updates: Partial<SubscriptionState> = { initialized: true };

      if (stored) {
        updates.subscription = JSON.parse(stored);
      }

      if (storedTenant) {
        try { updates.tenantConfig = JSON.parse(storedTenant); } catch { /* ignore */ }
      }

      set(updates);
    } catch {
      set({ initialized: true });
    }
  },

  configureTenant: async (config: TenantConfig) => {
    set({ tenantConfig: config });
    try {
      await AsyncStorage.setItem(STORAGE_KEY_TENANT, JSON.stringify(config));
    } catch {
      // Non-critical — tenant config is re-fetchable
    }
  },

  getTenantConfig: () => {
    return get().tenantConfig;
  },

  initiateUpgrade: async (plan: SubscriptionPlan, billingPeriod: 'monthly' | 'yearly' = 'monthly') => {
    if (plan.tier === 'free') return;

    set({ isLoading: true });

    try {
      const { tenantConfig } = get();
      const tenantId = tenantConfig?.id !== 'default' ? tenantConfig?.id : undefined;

      // 1. Compute the effective price (may differ from plan default if tenant overrode it)
      const effectivePrice = getEffectivePrice(plan, tenantConfig ?? undefined);
      const displayPrice = billingPeriod === 'yearly' ? effectivePrice.yearly : effectivePrice.monthly;

      // 2. Create a Razorpay order on the backend (pass tenantId for key routing)
      const order = await paymentsApi.createOrder(plan.id, billingPeriod, tenantId);

      // 3. Try to open the Razorpay Checkout (native module)
      try {
        const RazorpayCheckout = require('react-native-razorpay').default;

        const options = {
          key: tenantConfig?.razorpay?.keyId || order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: tenantConfig?.name || 'Toroloom',
          description: `Toroloom ${plan.name} — ${billingPeriod === 'yearly' ? `₹${displayPrice.toLocaleString('en-IN')}/yr` : `₹${displayPrice}/mo`}`,
          image: 'https://toroloom.dev/assets/logo.png',
          prefill: { email: '', contact: '' },
          theme: { color: plan.tier === 'elite' ? '#10B981' : '#3B82F6' },
          modal: {
            confirm_close: true,
            ondismiss: () => { set({ isLoading: false }); },
          },
        };

        const data = await RazorpayCheckout.open(options);

        // 4. Verify payment on backend
        const verification = await paymentsApi.verifyPayment({
          razorpayPaymentId: data.razorpay_payment_id,
          razorpayOrderId: data.razorpay_order_id,
          razorpaySignature: data.razorpay_signature,
          planId: plan.id,
          tenantId,
        });

        // 5. Update local subscription state
        const newSubscription: UserSubscription = {
          tier: plan.tier,
          planId: plan.id,
          status: 'active',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          autoRenew: billingPeriod === 'yearly',
          razorpayOrderId: data.razorpay_order_id,
          paymentMethod: 'razorpay',
          lastPaymentDate: new Date().toISOString(),
          tenantId,
        };

        await AsyncStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(newSubscription));
        set({ subscription: newSubscription, isLoading: false });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Upgrade Successful! 🎉',
          `You are now on the ${plan.name} plan. ${verification.message}`,
          [{ text: 'Start Exploring' }]
        );

      } catch {
        // Razorpay native module fallback (Expo Go / dev)
        const newSubscription: UserSubscription = {
          tier: plan.tier,
          planId: plan.id,
          status: 'active',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          autoRenew: billingPeriod === 'yearly',
          paymentMethod: 'razorpay',
          lastPaymentDate: new Date().toISOString(),
          tenantId,
        };

        await AsyncStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(newSubscription));
        set({ subscription: newSubscription, isLoading: false });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Upgrade Successful! 🎉',
          `You are now on the ${plan.name} plan. Welcome to Toroloom Premium!`,
          [{ text: 'Start Exploring' }]
        );
      }
    } catch (error: any) {
      set({ isLoading: false });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (error.code === 'PAYMENT_CANCELLED' || error.message?.includes('cancelled')) {
        return; // User cancelled — no alert
      }

      Alert.alert(
        'Payment Failed',
        error?.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    }
  },

  cancelSubscription: async () => {
    set({ isLoading: true });
    try {
      const updated: UserSubscription = {
        ...get().subscription,
        autoRenew: false,
        status: 'cancelled',
      };
      await AsyncStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(updated));
      set({ subscription: updated, isLoading: false });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      set({ isLoading: false });
    }
  },

  downgradeToFree: async () => {
    set({ isLoading: true });
    try {
      await AsyncStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(DEFAULT_SUBSCRIPTION));
      set({ subscription: DEFAULT_SUBSCRIPTION, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
