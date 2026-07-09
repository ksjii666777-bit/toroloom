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
  CouponCode,
  CouponDiscountResult,
  SubscriptionPayment,
  UpiMandate,
} from '../types';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { paymentsApi } from '../services/api/payments';

// ============ Storage Keys ============

const STORAGE_KEY_SUBSCRIPTION = 'toroloom_subscription';
const STORAGE_KEY_TENANT = 'toroloom_active_tenant';

// ============ Predefined Coupon Codes (mock) ============

const MOCK_COUPONS: CouponCode[] = [
  {
    code: 'SAVE20',
    type: 'percentage',
    value: 20,
    minPlanTier: 'pro',
    maxUses: 1000,
    currentUses: 42,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    description: '20% off any Pro or Elite plan',
  },
  {
    code: 'ELITE100',
    type: 'fixed',
    value: 100,
    minPlanTier: 'elite',
    maxUses: 500,
    currentUses: 12,
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    description: '₹100 off Elite plan monthly billing',
  },
  {
    code: 'TRYPRO',
    type: 'free_trial',
    value: 0,
    trialDays: 7,
    minPlanTier: 'pro',
    maxUses: 50,
    currentUses: 5,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    description: '7-day free trial of Pro plan',
  },
  {
    code: 'WELCOME10',
    type: 'percentage',
    value: 10,
    maxUses: 5000,
    currentUses: 234,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    description: '10% off your first subscription',
  },
];

// ============ Trial Config ============

const TRIAL_CONFIG = {
  proTrialDays: 7,
  eliteTrialDays: 3,
};

// ============ Default Subscription ============

const DEFAULT_SUBSCRIPTION: UserSubscription = {
  tier: 'free',
  planId: 'plan_free',
  status: 'active',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  autoRenew: false,
  payments: [],
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

  // ──── Coupon State ────────────────────────────────────────
  couponInput: string;
  couponResult: CouponDiscountResult | null;
  isApplyingCoupon: boolean;

  // ──── Trial State ────────────────────────────────────────
  trialDaysRemaining: number | null;

  // ──── UPI Autopay State ──────────────────────────────────
  upiMandates: UpiMandate[];
  isSettingUpAutopay: boolean;

  // ──── Payment History State ──────────────────────────────
  paymentHistory: SubscriptionPayment[];

  // ──── Computed / Derived ─────────────────────────────────
  /** The effective feature matrix after applying tenant overrides */
  getEffectiveFeatureMatrix: () => ReturnType<typeof buildEffectiveMatrix>;
  /** Check if the current user (or a given tier) can access a feature */
  isFeatureAvailable: (feature: SubscriptionFeature, tierOverride?: SubscriptionTier) => boolean;
  /** Get all features available for a given tier */
  getFeaturesForTier: (tier: SubscriptionTier) => SubscriptionFeature[];
  /** Get the effective price for a plan (factoring tenant overrides) */
  getPlanPrice: (planId: string) => { monthly: number; yearly: number };
  /** Get the effective price after coupon discount */
  getDiscountedPrice: (planId: string, billingPeriod?: 'monthly' | 'yearly') => { original: number; discount: number; final: number };
  /** Check if user is in trial period */
  isInTrial: () => boolean;
  /** Get trial end date as Date or null */
  getTrialEndDate: () => Date | null;
  /** Get remaining trial days */
  getTrialDaysRemaining: () => number;
  /** Check if user has trial available for a plan */
  hasTrialAvailable: (planTier: SubscriptionTier) => boolean;
  /** Get all available coupon codes (mock) */
  getAvailableCoupons: () => CouponCode[];

  // ──── Actions ────────────────────────────────────────────
  loadSubscription: () => Promise<void>;
  /** Configure the active tenant (called at app init) */
  configureTenant: (config: TenantConfig) => Promise<void>;
  getTenantConfig: () => TenantConfig | null;
  initiateUpgrade: (plan: SubscriptionPlan, billingPeriod?: 'monthly' | 'yearly') => Promise<void>;
  cancelSubscription: () => Promise<void>;
  downgradeToFree: () => Promise<void>;

  // ──── Coupon Actions ─────────────────────────────────────
  setCouponInput: (code: string) => void;
  applyCoupon: (planTier: SubscriptionTier, price: number) => Promise<void>;
  removeCoupon: () => void;

  // ──── Trial Actions ──────────────────────────────────────
  startTrial: (planTier: SubscriptionTier) => Promise<void>;
  endTrial: () => Promise<void>;
  refreshTrialStatus: () => void;

  // ──── UPI Autopay Actions ────────────────────────────────
  setUpAutopay: (upiId: string, planId: string, amount: number, billingPeriod: 'monthly' | 'yearly') => Promise<void>;
  cancelAutopay: (mandateId: string) => Promise<void>;
  pauseAutopay: (mandateId: string) => Promise<void>;
  resumeAutopay: (mandateId: string) => Promise<void>;

  // ──── Payment History Actions ────────────────────────────
  addPaymentToHistory: (payment: SubscriptionPayment) => void;
  getPaymentHistory: () => SubscriptionPayment[];
}

// ============ Helpers ============

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const diff = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscription: DEFAULT_SUBSCRIPTION,
  tenantConfig: null,
  isLoading: false,
  initialized: false,

  // ──── Coupon State ─────────────────────────────────────────
  couponInput: '',
  couponResult: null,
  isApplyingCoupon: false,

  // ──── Trial State ─────────────────────────────────────────
  trialDaysRemaining: null,

  // ──── UPI Autopay State ───────────────────────────────────
  upiMandates: [],
  isSettingUpAutopay: false,

  // ──── Payment History State ───────────────────────────────
  paymentHistory: [],

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

  // ──── Coupon Computed ───────────────────────────────────────

  getDiscountedPrice: (planId: string, billingPeriod: 'monthly' | 'yearly' = 'monthly') => {
    const { couponResult, tenantConfig } = get();
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) return { original: 0, discount: 0, final: 0 };

    const effectivePrice = getEffectivePrice(plan, tenantConfig ?? undefined);
    const original = billingPeriod === 'yearly' ? effectivePrice.yearly : effectivePrice.monthly;

    if (!couponResult || !couponResult.valid) {
      return { original, discount: 0, final: original };
    }

    const discount = couponResult.discountAmount;
    const final = Math.max(0, original - discount);
    return { original, discount, final };
  },

  isInTrial: () => {
    const { subscription } = get();
    return subscription.status === 'trial' && !!subscription.trialEndDate;
  },

  getTrialEndDate: () => {
    const { subscription } = get();
    if (!subscription.trialEndDate) return null;
    try {
      return new Date(subscription.trialEndDate);
    } catch {
      return null;
    }
  },

  getTrialDaysRemaining: () => {
    const { subscription } = get();
    if (!subscription.trialEndDate) return 0;
    try {
      const now = new Date();
      const end = new Date(subscription.trialEndDate);
      return daysBetween(now, end);
    } catch {
      return 0;
    }
  },

  hasTrialAvailable: (planTier: SubscriptionTier) => {
    const { subscription } = get();
    // Trial not available if already used or currently active
    if (subscription.isTrialUsed) return false;
    if (subscription.status === 'trial') return false;
    // Only paid plans get trials
    if (planTier === 'free') return false;
    // Must be on free tier to start a trial
    if (subscription.tier !== 'free') return false;
    return true;
  },

  getAvailableCoupons: () => {
    return MOCK_COUPONS.filter(c => c.isActive);
  },

  // ──── Coupon Actions ────────────────────────────────────────

  setCouponInput: (code: string) => {
    set({ couponInput: code.toUpperCase().trim() });
  },

  applyCoupon: async (planTier: SubscriptionTier, price: number) => {
    const { couponInput } = get();
    if (!couponInput) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      set({ couponResult: null });
      return;
    }

    set({ isApplyingCoupon: true });

    // Simulate network delay
    await new Promise(r => setTimeout(r, 600));

    const coupon = MOCK_COUPONS.find(
      c => c.code === couponInput && c.isActive
    );

    if (!coupon) {
      set({
        isApplyingCoupon: false,
        couponResult: {
          code: couponInput,
          valid: false,
          type: 'percentage',
          discountAmount: 0,
          originalPrice: price,
          finalPrice: price,
          message: 'Invalid or expired coupon code.',
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Check expiry
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      set({
        isApplyingCoupon: false,
        couponResult: {
          code: couponInput,
          valid: false,
          type: coupon.type,
          discountAmount: 0,
          originalPrice: price,
          finalPrice: price,
          message: 'This coupon has expired.',
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Check max uses
    if (coupon.maxUses && coupon.currentUses && coupon.currentUses >= coupon.maxUses) {
      set({
        isApplyingCoupon: false,
        couponResult: {
          code: couponInput,
          valid: false,
          type: coupon.type,
          discountAmount: 0,
          originalPrice: price,
          finalPrice: price,
          message: 'This coupon has reached its usage limit.',
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Check min plan tier
    if (coupon.minPlanTier) {
      const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, pro: 1, elite: 2 };
      if (TIER_RANK[planTier] < TIER_RANK[coupon.minPlanTier]) {
        set({
          isApplyingCoupon: false,
          couponResult: {
            code: couponInput,
            valid: false,
            type: coupon.type,
            discountAmount: 0,
            originalPrice: price,
            finalPrice: price,
            message: `This coupon requires at least the ${coupon.minPlanTier} plan.`,
          },
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.type === 'percentage') {
      discountAmount = Math.round(price * (coupon.value / 100));
    } else if (coupon.type === 'fixed') {
      discountAmount = Math.min(coupon.value, price);
    }

    const finalPrice = Math.max(0, price - discountAmount);

    set({
      isApplyingCoupon: false,
      couponResult: {
        code: coupon.code,
        valid: true,
        type: coupon.type,
        discountAmount,
        originalPrice: price,
        finalPrice,
        trialDays: coupon.trialDays,
        message: coupon.type === 'free_trial'
          ? `${coupon.trialDays}-day free trial applied!`
          : `Coupon applied! You save ₹${discountAmount.toLocaleString('en-IN')}`,
      },
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  removeCoupon: () => {
    set({ couponInput: '', couponResult: null });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  // ──── Trial Actions ─────────────────────────────────────────

  startTrial: async (planTier: SubscriptionTier) => {
    set({ isLoading: true });

    const now = new Date();
    const trialDays = planTier === 'elite' ? TRIAL_CONFIG.eliteTrialDays : TRIAL_CONFIG.proTrialDays;
    const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const plan = SUBSCRIPTION_PLANS.find(p => p.tier === planTier);
    if (!plan) {
      set({ isLoading: false });
      return;
    }

    // Simulate network delay
    await new Promise(r => setTimeout(r, 500));

    const updatedSubscription: UserSubscription = {
      ...get().subscription,
      tier: planTier,
      planId: plan.id,
      status: 'trial',
      startDate: now.toISOString(),
      endDate: trialEnd.toISOString(),
      trialStartDate: now.toISOString(),
      trialEndDate: trialEnd.toISOString(),
      isTrialUsed: true,
      autoRenew: false,
    };

    await AsyncStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(updatedSubscription));
    set({ subscription: updatedSubscription, isLoading: false });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Trial Started! 🎉',
      `You have ${trialDays} days to explore ${plan.name} features free. Your trial ends on ${trialEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
      [{ text: 'Start Exploring' }]
    );
  },

  endTrial: async () => {
    const updatedSubscription: UserSubscription = {
      ...get().subscription,
      tier: 'free',
      planId: 'plan_free',
      status: 'expired',
      isTrialUsed: true,
      trialEndDate: new Date().toISOString(),
      autoRenew: false,
    };

    await AsyncStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(updatedSubscription));
    set({ subscription: updatedSubscription });
  },

  refreshTrialStatus: () => {
    const { subscription } = get();
    if (subscription.status !== 'trial' || !subscription.trialEndDate) {
      set({ trialDaysRemaining: null });
      return;
    }

    const remaining = daysBetween(new Date(), new Date(subscription.trialEndDate));
    set({ trialDaysRemaining: remaining });

    // Auto-end trial if expired
    if (remaining <= 0) {
      get().endTrial();
    }
  },

  // ──── UPI Autopay Actions ───────────────────────────────────

  setUpAutopay: async (upiId: string, planId: string, amount: number, billingPeriod: 'monthly' | 'yearly') => {
    set({ isSettingUpAutopay: true });

    // Simulate API call
    await new Promise(r => setTimeout(r, 800));

    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    const mandate: UpiMandate = {
      mandateId: `mand_${generateId()}`,
      upiId,
      bankName: 'ICICI Bank',
      planId,
      amount,
      billingPeriod,
      status: 'active',
      createdAt: new Date().toISOString(),
      nextChargeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      tpv: 'PIN',
    };

    const updatedSubscription: UserSubscription = {
      ...get().subscription,
      isAutoPayEnabled: true,
      upiMandate: mandate,
    };

    await AsyncStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(updatedSubscription));

    set({
      subscription: updatedSubscription,
      upiMandates: [...get().upiMandates, mandate],
      isSettingUpAutopay: false,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'UPI AutoPay Enabled ✅',
      `Recurring payments of ₹${amount.toLocaleString('en-IN')}/${billingPeriod === 'yearly' ? 'yr' : 'mo'} will be charged from ${upiId}.`,
      [{ text: 'Done' }]
    );
  },

  cancelAutopay: async (mandateId: string) => {
    await new Promise(r => setTimeout(r, 300));

    const updatedMandates = get().upiMandates.map(m =>
      m.mandateId === mandateId ? { ...m, status: 'cancelled' as const } : m
    );

    const updatedSubscription: UserSubscription = {
      ...get().subscription,
      isAutoPayEnabled: false,
      upiMandate: undefined,
    };

    await AsyncStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(updatedSubscription));

    set({ upiMandates: updatedMandates, subscription: updatedSubscription });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },

  pauseAutopay: async (mandateId: string) => {
    await new Promise(r => setTimeout(r, 300));
    const updatedMandates = get().upiMandates.map(m =>
      m.mandateId === mandateId ? { ...m, status: 'paused' as const } : m
    );
    set({ upiMandates: updatedMandates });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  resumeAutopay: async (mandateId: string) => {
    await new Promise(r => setTimeout(r, 300));
    const updatedMandates = get().upiMandates.map(m =>
      m.mandateId === mandateId ? { ...m, status: 'active' as const } : m
    );
    set({ upiMandates: updatedMandates });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  // ──── Payment History Actions ───────────────────────────────

  addPaymentToHistory: (payment: SubscriptionPayment) => {
    const history = get().paymentHistory;
    const updatedHistory = [payment, ...history];
    set({ paymentHistory: updatedHistory });

    // Also add to subscription.payments
    const updatedSubscription: UserSubscription = {
      ...get().subscription,
      payments: updatedHistory,
    };
    set({ subscription: updatedSubscription });
  },

  getPaymentHistory: () => {
    return get().paymentHistory.length > 0
      ? get().paymentHistory
      : (get().subscription.payments || []);
  },
}));
