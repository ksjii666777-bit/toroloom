/**
 * ============================================================================
 * Toroloom — Subscription Store Unit Tests
 * ============================================================================
 *
 * Covers all exported functions and store actions:
 *   - SUBSCRIPTION_PLANS (3 plans with correct structure)
 *   - Feature availability checks (isFeatureAvailable per tier)
 *   - getFeaturesForTier (all features for a given tier)
 *   - getPlanPrice (default + tenant overrides)
 *   - Tenant config: configureTenant, getTenantConfig, feature overrides
 *   - loadSubscription (AsyncStorage hydration)
 *   - cancelSubscription / downgradeToFree
 *   - getEffectiveFeatureMatrix
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/subscriptionStore.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSubscriptionStore, SUBSCRIPTION_PLANS } from '../store/subscriptionStore';
import type { SubscriptionFeature, TenantConfig } from '../types';

// ─── Mock AsyncStorage ──────────────────────────────────────────────────────
const mockAsyncStorage: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockAsyncStorage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      mockAsyncStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockAsyncStorage[key];
      return Promise.resolve();
    }),
  },
}));

// ─── Mock Haptics ──────────────────────────────────────────────────────────
vi.mock('expo-haptics', () => ({
  default: {
    notificationAsync: vi.fn().mockResolvedValue(undefined),
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  },
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// ─── Mock Alert ────────────────────────────────────────────────────────────
vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios', select: (o: any) => o.ios },
}));

// ─── Mock paymentsApi ──────────────────────────────────────────────────────
vi.mock('../services/api/payments', () => ({
  paymentsApi: {
    createOrder: vi.fn().mockResolvedValue({
      orderId: 'order_xyz',
      amount: 39900,
      currency: 'INR',
      keyId: 'rzp_test_key',
    }),
    verifyPayment: vi.fn().mockResolvedValue({ success: true, message: 'Payment verified' }),
  },
}));

describe('Subscription Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockAsyncStorage).forEach(k => delete mockAsyncStorage[k]);

    // Reset store to default state
    const now = new Date().toISOString();
    useSubscriptionStore.setState({
      subscription: {
        tier: 'free',
        planId: 'plan_free',
        status: 'active',
        startDate: now,
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        autoRenew: false,
      },
      tenantConfig: null,
      isLoading: false,
      initialized: false,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUBSCRIPTION_PLANS
  // ─────────────────────────────────────────────────────────────────────────

  describe('SUBSCRIPTION_PLANS', () => {
    it('should have 3 plans', () => {
      expect(SUBSCRIPTION_PLANS).toHaveLength(3);
    });

    it('should have Free, Pro, and Elite plans', () => {
      const tiers = SUBSCRIPTION_PLANS.map(p => p.tier);
      expect(tiers).toContain('free');
      expect(tiers).toContain('pro');
      expect(tiers).toContain('elite');
    });

    it('Free plan should have price 0', () => {
      const free = SUBSCRIPTION_PLANS.find(p => p.tier === 'free')!;
      expect(free.price).toBe(0);
      expect(free.priceYearly).toBe(0);
    });

    it('Pro plan should have correct pricing', () => {
      const pro = SUBSCRIPTION_PLANS.find(p => p.tier === 'pro')!;
      expect(pro.price).toBe(399);
      expect(pro.priceYearly).toBe(3999);
    });

    it('Elite plan should have correct pricing', () => {
      const elite = SUBSCRIPTION_PLANS.find(p => p.tier === 'elite')!;
      expect(elite.price).toBe(999);
      expect(elite.priceYearly).toBe(9999);
    });

    it('each plan should have includedFeatures array', () => {
      for (const plan of SUBSCRIPTION_PLANS) {
        expect(plan.includedFeatures).toBeDefined();
        expect(plan.includedFeatures!.length).toBeGreaterThan(0);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // isFeatureAvailable
  // ─────────────────────────────────────────────────────────────────────────

  describe('isFeatureAvailable', () => {
    it('free users should have basic_portfolio', () => {
      expect(useSubscriptionStore.getState().isFeatureAvailable('basic_portfolio')).toBe(true);
    });

    it('free users should NOT have ai_insights', () => {
      expect(useSubscriptionStore.getState().isFeatureAvailable('ai_insights')).toBe(false);
    });

    it('free users should NOT have iron_lock', () => {
      expect(useSubscriptionStore.getState().isFeatureAvailable('iron_lock')).toBe(false);
    });

    it('pro users should have ai_insights', () => {
      expect(useSubscriptionStore.getState().isFeatureAvailable('ai_insights', 'pro')).toBe(true);
    });

    it('pro users should NOT have iron_lock', () => {
      expect(useSubscriptionStore.getState().isFeatureAvailable('iron_lock', 'pro')).toBe(false);
    });

    it('elite users should have all features', () => {
      const allFeatures: SubscriptionFeature[] = [
        'basic_portfolio', 'unlimited_watchlist', 'advanced_analytics',
        'ai_insights', 'ai_companion', 'iron_lock', 'real_time_data',
        'social_trading', 'full_education', 'tax_reports', 'api_access',
        'ad_free', 'priority_support', 'dedicated_manager', 'behavioural_journal',
      ];
      for (const feature of allFeatures) {
        expect(useSubscriptionStore.getState().isFeatureAvailable(feature, 'elite')).toBe(true);
      }
    });

    it('should use current subscription tier when no override given', () => {
      useSubscriptionStore.setState({ subscription: { tier: 'pro', planId: 'plan_pro', status: 'active', startDate: '', endDate: '', autoRenew: false } });
      expect(useSubscriptionStore.getState().isFeatureAvailable('ai_insights')).toBe(true);
      expect(useSubscriptionStore.getState().isFeatureAvailable('iron_lock')).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getFeaturesForTier
  // ─────────────────────────────────────────────────────────────────────────

  describe('getFeaturesForTier', () => {
    it('free tier should have only basic_portfolio', () => {
      const features = useSubscriptionStore.getState().getFeaturesForTier('free');
      expect(features).toContain('basic_portfolio');
      expect(features).not.toContain('ai_insights');
      expect(features).not.toContain('iron_lock');
    });

    it('pro tier should include free + pro features', () => {
      const features = useSubscriptionStore.getState().getFeaturesForTier('pro');
      expect(features).toContain('basic_portfolio');
      expect(features).toContain('ai_insights');
      expect(features).toContain('ad_free');
      expect(features).not.toContain('iron_lock');
    });

    it('elite tier should include all 15 features', () => {
      const features = useSubscriptionStore.getState().getFeaturesForTier('elite');
      expect(features).toHaveLength(15);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getPlanPrice
  // ─────────────────────────────────────────────────────────────────────────

  describe('getPlanPrice', () => {
    it('should return default pricing for pro plan', () => {
      const price = useSubscriptionStore.getState().getPlanPrice('plan_pro');
      expect(price.monthly).toBe(399);
      expect(price.yearly).toBe(3999);
    });

    it('should return default pricing for elite plan', () => {
      const price = useSubscriptionStore.getState().getPlanPrice('plan_elite');
      expect(price.monthly).toBe(999);
      expect(price.yearly).toBe(9999);
    });

    it('should return 0 for unknown plan', () => {
      const price = useSubscriptionStore.getState().getPlanPrice('non_existent');
      expect(price.monthly).toBe(0);
      expect(price.yearly).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Tenant Config
  // ─────────────────────────────────────────────────────────────────────────

  describe('Tenant Config', () => {
    const sampleTenant: TenantConfig = {
      id: 'tenant-org-42',
      name: 'Org 42',
      domain: 'org42.com',
      featureOverrides: { ai_insights: 'free' },
      razorpay: {
        keyId: 'rzp_live_key',
        keySecret: 'secret',
        pricing: { plan_pro: { monthly: 199, yearly: 1999 } },
      },
    };

    it('should configure a tenant', async () => {
      await useSubscriptionStore.getState().configureTenant(sampleTenant);
      expect(useSubscriptionStore.getState().tenantConfig?.id).toBe('tenant-org-42');
    });

    it('should persist tenant config to AsyncStorage', async () => {
      await useSubscriptionStore.getState().configureTenant(sampleTenant);
      expect(mockAsyncStorage['toroloom_active_tenant']).toBeDefined();
      const parsed = JSON.parse(mockAsyncStorage['toroloom_active_tenant']);
      expect(parsed.id).toBe('tenant-org-42');
    });

    it('getTenantConfig should return current config', () => {
      useSubscriptionStore.setState({ tenantConfig: sampleTenant });
      expect(useSubscriptionStore.getState().getTenantConfig()?.id).toBe('tenant-org-42');
    });

    it('getTenantConfig should return null when not configured', () => {
      expect(useSubscriptionStore.getState().getTenantConfig()).toBeNull();
    });

    it('should make ai_insights free for users with tenant override', () => {
      useSubscriptionStore.setState({ tenantConfig: sampleTenant });
      // ai_insights minTier is overridden to 'free' by tenant
      expect(useSubscriptionStore.getState().isFeatureAvailable('ai_insights', 'free')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Tenant Pricing Override
  // ─────────────────────────────────────────────────────────────────────────

  describe('Tenant Pricing Override', () => {
    it('should apply tenant pricing override to getPlanPrice', () => {
      const tenant: TenantConfig = {
        id: 'tenant-price-test',
        name: 'Price Test',
        domain: 'pricetest.com',
        razorpay: {
          keyId: 'key',
          keySecret: 'secret',
          pricing: { plan_pro: { monthly: 199, yearly: 1999 } },
        },
      };
      useSubscriptionStore.setState({ tenantConfig: tenant });

      const price = useSubscriptionStore.getState().getPlanPrice('plan_pro');
      expect(price.monthly).toBe(199);
      expect(price.yearly).toBe(1999);
    });

    it('should fall back to default pricing when tenant has no override for a plan', () => {
      const tenant: TenantConfig = {
        id: 'tenant-no-override',
        name: 'No Override',
        domain: 'nooverride.com',
        razorpay: { keyId: 'key', keySecret: 'secret' },
      };
      useSubscriptionStore.setState({ tenantConfig: tenant });

      const price = useSubscriptionStore.getState().getPlanPrice('plan_elite');
      expect(price.monthly).toBe(999);
      expect(price.yearly).toBe(9999);
    });

    it('should handle NaN pricing overrides gracefully', () => {
      const tenant: TenantConfig = {
        id: 'tenant-nan',
        name: 'NaN Test',
        domain: 'nan.com',
        razorpay: {
          keyId: 'key',
          keySecret: 'secret',
          pricing: { plan_pro: { monthly: NaN, yearly: NaN } },
        },
      };
      useSubscriptionStore.setState({ tenantConfig: tenant });

      const price = useSubscriptionStore.getState().getPlanPrice('plan_pro');
      expect(price.monthly).toBe(399); // Falls back to default
      expect(price.yearly).toBe(3999);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // loadSubscription
  // ─────────────────────────────────────────────────────────────────────────

  describe('loadSubscription', () => {
    it('should set initialized to true even when no stored data', async () => {
      await useSubscriptionStore.getState().loadSubscription();
      expect(useSubscriptionStore.getState().initialized).toBe(true);
    });

    it('should restore subscription from storage', async () => {
      const storedSub = JSON.stringify({ tier: 'pro', planId: 'plan_pro', status: 'active', startDate: '2025-01-01', endDate: '2025-02-01', autoRenew: true });
      mockAsyncStorage['toroloom_subscription'] = storedSub;

      await useSubscriptionStore.getState().loadSubscription();
      expect(useSubscriptionStore.getState().subscription.tier).toBe('pro');
      expect(useSubscriptionStore.getState().subscription.autoRenew).toBe(true);
    });

    it('should restore tenant config from storage', async () => {
      const storedTenant = JSON.stringify({ id: 'stored-tenant', name: 'Stored', domain: 'stored.com' });
      mockAsyncStorage['toroloom_active_tenant'] = storedTenant;

      await useSubscriptionStore.getState().loadSubscription();
      expect(useSubscriptionStore.getState().tenantConfig?.id).toBe('stored-tenant');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // cancelSubscription / downgradeToFree
  // ─────────────────────────────────────────────────────────────────────────

  describe('cancelSubscription / downgradeToFree', () => {
    it('should cancel subscription with status cancelled', async () => {
      useSubscriptionStore.setState({
        subscription: { tier: 'pro', planId: 'plan_pro', status: 'active', startDate: '2025-01-01', endDate: '2025-02-01', autoRenew: true },
      });

      await useSubscriptionStore.getState().cancelSubscription();

      const sub = useSubscriptionStore.getState().subscription;
      expect(sub.status).toBe('cancelled');
      expect(sub.autoRenew).toBe(false);
      expect(useSubscriptionStore.getState().isLoading).toBe(false);
    });

    it('should downgrade to free', async () => {
      useSubscriptionStore.setState({
        subscription: { tier: 'elite', planId: 'plan_elite', status: 'active', startDate: '2025-01-01', endDate: '2025-02-01', autoRenew: true },
      });

      await useSubscriptionStore.getState().downgradeToFree();

      const sub = useSubscriptionStore.getState().subscription;
      expect(sub.tier).toBe('free');
      expect(sub.planId).toBe('plan_free');
      expect(useSubscriptionStore.getState().isLoading).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getEffectiveFeatureMatrix
  // ─────────────────────────────────────────────────────────────────────────

  describe('getEffectiveFeatureMatrix', () => {
    it('should return default matrix when no tenant', () => {
      const matrix = useSubscriptionStore.getState().getEffectiveFeatureMatrix();
      expect(matrix.basic_portfolio.minTier).toBe('free');
      expect(matrix.ai_insights.minTier).toBe('pro');
      expect(matrix.iron_lock.minTier).toBe('elite');
    });

    it('should apply tenant overrides to matrix', () => {
      const tenant: TenantConfig = {
        id: 'override-test',
        name: 'Override Test',
        domain: 'override.com',
        featureOverrides: { ai_insights: 'free', iron_lock: 'pro' },
      };
      useSubscriptionStore.setState({ tenantConfig: tenant });

      const matrix = useSubscriptionStore.getState().getEffectiveFeatureMatrix();
      expect(matrix.ai_insights.minTier).toBe('free'); // overridden
      expect(matrix.iron_lock.minTier).toBe('pro'); // overridden from elite
      expect(matrix.basic_portfolio.minTier).toBe('free'); // unchanged
    });
  });
});
