/**
 * ============================================================================
 * Toroloom — Subscription Store Tests
 * ============================================================================
 *
 * Tests the multi-tenant feature paywall matrix logic:
 *   - buildEffectiveMatrix (via getEffectiveFeatureMatrix)
 *   - isFeatureAvailable (with default tiers and tenant overrides)
 *   - getPlanPrice (with and without tenant pricing overrides)
 *   - getFeaturesForTier (feature availability per tier)
 *   - configureTenant (setting/resetting tenant config)
 *
 * These tests do NOT require React rendering — the Zustand store's
 * .getState() / .setState() methods are synchronous and work in plain
 * Node.js.
 *
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSubscriptionStore} from '../store/subscriptionStore';
import type { TenantConfig, PaywallOverride } from '../types';

// ==================== Reset Store Before Each Test ====================

beforeEach(() => {
  // Reset the store to its initial state
  useSubscriptionStore.setState({
    subscription: { tier: 'free', planId: 'plan_free', status: 'active', startDate: '', endDate: '', autoRenew: false },
    tenantConfig: null,
    isLoading: false,
    initialized: false,
  });
});

// ==================== Default Feature Matrix ====================

describe('getEffectiveFeatureMatrix', () => {
  it('returns the default feature matrix when no tenant is configured', () => {
    const matrix = useSubscriptionStore.getState().getEffectiveFeatureMatrix();

    // Basic checks on structure
    expect(matrix.basic_portfolio.minTier).toBe('free');
    expect(matrix.advanced_analytics.minTier).toBe('pro');
    expect(matrix.iron_lock.minTier).toBe('elite');
    expect(matrix.ai_companion.minTier).toBe('pro');
  });

  it('contains all 15 features with correct metadata', () => {
    const matrix = useSubscriptionStore.getState().getEffectiveFeatureMatrix();
    const features = Object.keys(matrix);

    expect(features).toHaveLength(15);
    expect(features).toContain('basic_portfolio');
    expect(features).toContain('unlimited_watchlist');
    expect(features).toContain('advanced_analytics');
    expect(features).toContain('ai_insights');
    expect(features).toContain('ai_companion');
    expect(features).toContain('iron_lock');
    expect(features).toContain('real_time_data');
    expect(features).toContain('social_trading');
    expect(features).toContain('full_education');
    expect(features).toContain('tax_reports');
    expect(features).toContain('api_access');
    expect(features).toContain('ad_free');
    expect(features).toContain('priority_support');
    expect(features).toContain('dedicated_manager');
    expect(features).toContain('behavioural_journal');
  });

  it('applies tenant overrides to the feature matrix', () => {
    const overrideTenant: TenantConfig = {
      id: 'test_tenant',
      name: 'Test Broker',
      domain: 'test.toroloom.app',
      featureOverrides: { ai_insights: 'free', iron_lock: 'pro' } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(overrideTenant);

    const matrix = useSubscriptionStore.getState().getEffectiveFeatureMatrix();

    // Check the overridden features
    expect(matrix.ai_insights.minTier).toBe('free');
    expect(matrix.iron_lock.minTier).toBe('pro');

    // Check unaffected features still have their defaults
    expect(matrix.basic_portfolio.minTier).toBe('free');
    expect(matrix.advanced_analytics.minTier).toBe('pro');
    expect(matrix.real_time_data.minTier).toBe('elite');
  });

  it('ignores unknown feature overrides', () => {
    const overrideTenant: TenantConfig = {
      id: 'test_tenant',
      name: 'Test Broker',
      domain: 'test.toroloom.app',
      featureOverrides: { 'nonexistent_feature': 'free' } as any,
    };

    useSubscriptionStore.getState().configureTenant(overrideTenant);
    const matrix = useSubscriptionStore.getState().getEffectiveFeatureMatrix();

    // All features should still have their defaults
    expect(Object.keys(matrix)).toHaveLength(15);
    expect(matrix.iron_lock.minTier).toBe('elite');
  });

  it('returns default matrix when tenant override is an empty object', () => {
    const tenant: TenantConfig = {
      id: 'test_tenant',
      name: 'Test',
      domain: 'test.com',
      featureOverrides: {},
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const matrix = useSubscriptionStore.getState().getEffectiveFeatureMatrix();

    expect(matrix.basic_portfolio.minTier).toBe('free');
    expect(matrix.iron_lock.minTier).toBe('elite');
  });
});

// ==================== isFeatureAvailable ====================

describe('isFeatureAvailable', () => {
  it('returns true for free-tier features when subscription is free', () => {
    const store = useSubscriptionStore.getState();
    expect(store.isFeatureAvailable('basic_portfolio')).toBe(true);
  });

  it('returns false for pro-tier features when subscription is free', () => {
    const store = useSubscriptionStore.getState();
    expect(store.isFeatureAvailable('advanced_analytics')).toBe(false);
    expect(store.isFeatureAvailable('ai_insights')).toBe(false);
    expect(store.isFeatureAvailable('full_education')).toBe(false);
  });

  it('returns false for elite-tier features when subscription is free', () => {
    const store = useSubscriptionStore.getState();
    expect(store.isFeatureAvailable('iron_lock')).toBe(false);
    expect(store.isFeatureAvailable('real_time_data')).toBe(false);
    expect(store.isFeatureAvailable('social_trading')).toBe(false);
    expect(store.isFeatureAvailable('behavioural_journal')).toBe(false);
  });

  it('returns true for pro-tier features when subscription is pro', () => {
    useSubscriptionStore.setState({ subscription: { tier: 'pro', planId: 'plan_pro', status: 'active', startDate: '', endDate: '', autoRenew: true } });
    const store = useSubscriptionStore.getState();

    expect(store.isFeatureAvailable('advanced_analytics')).toBe(true);
    expect(store.isFeatureAvailable('ai_insights')).toBe(true);
    expect(store.isFeatureAvailable('full_education')).toBe(true);
    expect(store.isFeatureAvailable('ad_free')).toBe(true);
    expect(store.isFeatureAvailable('priority_support')).toBe(true);
  });

  it('returns false for elite-tier features when subscription is pro', () => {
    useSubscriptionStore.setState({ subscription: { tier: 'pro', planId: 'plan_pro', status: 'active', startDate: '', endDate: '', autoRenew: true } });
    const store = useSubscriptionStore.getState();

    expect(store.isFeatureAvailable('iron_lock')).toBe(false);
    expect(store.isFeatureAvailable('real_time_data')).toBe(false);
    expect(store.isFeatureAvailable('social_trading')).toBe(false);
    expect(store.isFeatureAvailable('dedicated_manager')).toBe(false);
    expect(store.isFeatureAvailable('behavioural_journal')).toBe(false);
  });

  it('returns true for ALL features when subscription is elite', () => {
    useSubscriptionStore.setState({ subscription: { tier: 'elite', planId: 'plan_elite', status: 'active', startDate: '', endDate: '', autoRenew: true } });
    const store = useSubscriptionStore.getState();

    const allFeatures: any[] = [
      'basic_portfolio', 'unlimited_watchlist', 'advanced_analytics',
      'ai_insights', 'ai_companion', 'iron_lock', 'real_time_data',
      'social_trading', 'full_education', 'tax_reports', 'api_access',
      'ad_free', 'priority_support', 'dedicated_manager', 'behavioural_journal',
    ];

    allFeatures.forEach(f => {
      expect(store.isFeatureAvailable(f)).toBe(true);
    });
  });

  // ── Tier Override ────────────────────────────────────────────

  it('accepts an optional tier override parameter', () => {
    const store = useSubscriptionStore.getState();

    // Even though subscription is 'free', override with 'elite'
    expect(store.isFeatureAvailable('iron_lock', 'elite')).toBe(true);
    expect(store.isFeatureAvailable('real_time_data', 'pro')).toBe(false);
    expect(store.isFeatureAvailable('ai_insights', 'pro')).toBe(true);
    expect(store.isFeatureAvailable('basic_portfolio', 'free')).toBe(true);
  });

  it('uses subscription tier when no override is provided', () => {
    useSubscriptionStore.setState({ subscription: { tier: 'pro', planId: 'plan_pro', status: 'active', startDate: '', endDate: '', autoRenew: true } });
    const store = useSubscriptionStore.getState();

    expect(store.isFeatureAvailable('advanced_analytics')).toBe(true);
    expect(store.isFeatureAvailable('ai_companion')).toBe(true);
  });

  // ── Tenant Overrides ─────────────────────────────────────────

  it('allows tenant to make premium features free', () => {
    const tenant: TenantConfig = {
      id: 'benign_tenant',
      name: 'Benign Broker',
      domain: 'benign.com',
      featureOverrides: { ai_insights: 'free', advanced_analytics: 'free', ai_companion: 'free' } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const store = useSubscriptionStore.getState();

    // Tenant made these free — user with free subscription should have access
    expect(store.isFeatureAvailable('ai_insights')).toBe(true);
    expect(store.isFeatureAvailable('advanced_analytics')).toBe(true);
    expect(store.isFeatureAvailable('ai_companion')).toBe(true);

    // These are still pro/elite
    expect(store.isFeatureAvailable('iron_lock')).toBe(false);
    expect(store.isFeatureAvailable('real_time_data')).toBe(false);
  });

  it('allows tenant to make elite features available at pro level', () => {
    const tenant: TenantConfig = {
      id: 'generous_tenant',
      name: 'Generous Broker',
      domain: 'generous.com',
      featureOverrides: { iron_lock: 'pro', real_time_data: 'pro' } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    useSubscriptionStore.setState({ subscription: { tier: 'pro', planId: 'plan_pro', status: 'active', startDate: '', endDate: '', autoRenew: true } });
    const store = useSubscriptionStore.getState();

    // Tenant made these available at pro level
    expect(store.isFeatureAvailable('iron_lock')).toBe(true);
    expect(store.isFeatureAvailable('real_time_data')).toBe(true);

    // These are still elite-only (not overridden)
    expect(store.isFeatureAvailable('social_trading')).toBe(false);
    expect(store.isFeatureAvailable('tax_reports')).toBe(false);
  });

  it('resets to default after clearing tenant config', () => {
    const tenant: TenantConfig = {
      id: 'temp_tenant',
      name: 'Temp',
      domain: 'temp.com',
      featureOverrides: { iron_lock: 'free' } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    expect(useSubscriptionStore.getState().isFeatureAvailable('iron_lock')).toBe(true);

    // Clear tenant
    useSubscriptionStore.setState({ tenantConfig: null });
    expect(useSubscriptionStore.getState().isFeatureAvailable('iron_lock')).toBe(false);
  });

  // ── Tier Shifting ─────────────────────────────────────────────

  it('grants free users access to premium features when tenant shifts them down to free', () => {
    const tenant: TenantConfig = {
      id: 'shifter',
      name: 'Shifter Broker',
      domain: 'shifter.com',
      featureOverrides: {
        ai_insights: 'free',          // pro → free
        advanced_analytics: 'free',   // pro → free
        iron_lock: 'free',            // elite → free
        real_time_data: 'free',       // elite → free
      } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const store = useSubscriptionStore.getState();

    // Free user should now have access to shifted features
    expect(store.isFeatureAvailable('ai_insights')).toBe(true);        // pro → free
    expect(store.isFeatureAvailable('advanced_analytics')).toBe(true); // pro → free
    expect(store.isFeatureAvailable('iron_lock')).toBe(true);          // elite → free
    expect(store.isFeatureAvailable('real_time_data')).toBe(true);     // elite → free

    // Elite features NOT shifted still locked
    expect(store.isFeatureAvailable('social_trading')).toBe(false);
    expect(store.isFeatureAvailable('tax_reports')).toBe(false);
    expect(store.isFeatureAvailable('dedicated_manager')).toBe(false);
    expect(store.isFeatureAvailable('behavioural_journal')).toBe(false);
  });

  it('revokes free user access when tenant shifts free features up to pro', () => {
    const tenant: TenantConfig = {
      id: 'lockdown',
      name: 'Lockdown Broker',
      domain: 'lockdown.com',
      featureOverrides: {
        basic_portfolio: 'pro',  // free → pro (locked)
      } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const store = useSubscriptionStore.getState();

    // Free user loses access to basic_portfolio
    expect(store.isFeatureAvailable('basic_portfolio')).toBe(false);

    // Pro user still has access
    useSubscriptionStore.setState({ subscription: { tier: 'pro', planId: 'plan_pro', status: 'active', startDate: '', endDate: '', autoRenew: true } });
    const proStore = useSubscriptionStore.getState();
    expect(proStore.isFeatureAvailable('basic_portfolio')).toBe(true);
  });

  it('grants pro users access to elite features when tenant shifts them down to pro', () => {
    const tenant: TenantConfig = {
      id: 'upgrade_broker',
      name: 'Upgrade Broker',
      domain: 'upgrade.com',
      featureOverrides: {
        iron_lock: 'pro',          // elite → pro
        real_time_data: 'pro',     // elite → pro
        social_trading: 'pro',     // elite → pro
      } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    useSubscriptionStore.setState({ subscription: { tier: 'pro', planId: 'plan_pro', status: 'active', startDate: '', endDate: '', autoRenew: true } });
    const store = useSubscriptionStore.getState();

    // Pro user gets access to shifted elite features
    expect(store.isFeatureAvailable('iron_lock')).toBe(true);
    expect(store.isFeatureAvailable('real_time_data')).toBe(true);
    expect(store.isFeatureAvailable('social_trading')).toBe(true);

    // Elite features NOT shifted still locked for pro
    expect(store.isFeatureAvailable('tax_reports')).toBe(false);
    expect(store.isFeatureAvailable('api_access')).toBe(false);
    expect(store.isFeatureAvailable('dedicated_manager')).toBe(false);
    expect(store.isFeatureAvailable('behavioural_journal')).toBe(false);
  });

  it('preserves elite access to all features regardless of tenant shifts', () => {
    // Even if tenant locks basic_portfolio to elite, elite users still have it
    const tenant: TenantConfig = {
      id: 'elite_always',
      name: 'Elite Always Broker',
      domain: 'elite-always.com',
      featureOverrides: {
        basic_portfolio: 'elite',  // free → elite (locked for free/pro)
        ai_insights: 'elite',      // pro → elite
        unlimited_watchlist: 'elite', // pro → elite
      } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    useSubscriptionStore.setState({ subscription: { tier: 'elite', planId: 'plan_elite', status: 'active', startDate: '', endDate: '', autoRenew: true } });
    const store = useSubscriptionStore.getState();

    // Elite user still has access to everything
    expect(store.isFeatureAvailable('basic_portfolio')).toBe(true);
    expect(store.isFeatureAvailable('ai_insights')).toBe(true);
    expect(store.isFeatureAvailable('unlimited_watchlist')).toBe(true);
    expect(store.isFeatureAvailable('iron_lock')).toBe(true);
    expect(store.isFeatureAvailable('real_time_data')).toBe(true);
  });

  it('respects tier override parameter on top of tenant overrides', () => {
    // Tenant locks everything to elite
    const tenant: TenantConfig = {
      id: 'strict',
      name: 'Strict Broker',
      domain: 'strict.com',
      featureOverrides: {
        basic_portfolio: 'elite',
        ai_insights: 'elite',
      } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const store = useSubscriptionStore.getState();

    // Free subscription → both locked
    expect(store.isFeatureAvailable('basic_portfolio')).toBe(false);
    expect(store.isFeatureAvailable('ai_insights')).toBe(false);

    // Tier override 'elite' → both accessible even with free subscription
    expect(store.isFeatureAvailable('basic_portfolio', 'elite')).toBe(true);
    expect(store.isFeatureAvailable('ai_insights', 'elite')).toBe(true);

    // Tier override 'pro' → still locked (tenant moved them to elite)
    expect(store.isFeatureAvailable('basic_portfolio', 'pro')).toBe(false);
  });

  it('shifts multiple features in both directions and verifies each tier', () => {
    const tenant: TenantConfig = {
      id: 'multi_shift',
      name: 'Multi Shift Broker',
      domain: 'multi.com',
      featureOverrides: {
        // Shifted DOWN (more accessible)
        iron_lock: 'free',          // elite → free
        unlimited_watchlist: 'free', // pro → free
        // Shifted UP (less accessible)
        basic_portfolio: 'pro',     // free → pro
        ad_free: 'elite',           // pro → elite
      } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);

    // ── Free user ──
    useSubscriptionStore.setState({ subscription: { tier: 'free', planId: 'plan_free', status: 'active', startDate: '', endDate: '', autoRenew: false } });
    let store = useSubscriptionStore.getState();

    // Can access: iron_lock (elite→free), unlimited_watchlist (pro→free)
    expect(store.isFeatureAvailable('iron_lock')).toBe(true);
    expect(store.isFeatureAvailable('unlimited_watchlist')).toBe(true);
    // Cannot access: basic_portfolio (free→pro), ad_free (pro→elite)
    expect(store.isFeatureAvailable('basic_portfolio')).toBe(false);
    expect(store.isFeatureAvailable('ad_free')).toBe(false);

    // ── Pro user ──
    useSubscriptionStore.setState({ subscription: { tier: 'pro', planId: 'plan_pro', status: 'active', startDate: '', endDate: '', autoRenew: true } });
    store = useSubscriptionStore.getState();

    // Can access: iron_lock (free-level), unlimited_watchlist (free-level), basic_portfolio (pro-level)
    expect(store.isFeatureAvailable('iron_lock')).toBe(true);
    expect(store.isFeatureAvailable('unlimited_watchlist')).toBe(true);
    expect(store.isFeatureAvailable('basic_portfolio')).toBe(true);
    // Cannot access: ad_free (pro→elite)
    expect(store.isFeatureAvailable('ad_free')).toBe(false);

    // ── Elite user ──
    useSubscriptionStore.setState({ subscription: { tier: 'elite', planId: 'plan_elite', status: 'active', startDate: '', endDate: '', autoRenew: true } });
    store = useSubscriptionStore.getState();

    // Elite has everything
    expect(store.isFeatureAvailable('basic_portfolio')).toBe(true);
    expect(store.isFeatureAvailable('iron_lock')).toBe(true);
    expect(store.isFeatureAvailable('ad_free')).toBe(true);
    expect(store.isFeatureAvailable('unlimited_watchlist')).toBe(true);
  });

  it('restores default isFeatureAvailable behavior after clearing tenant config', () => {
    const tenant: TenantConfig = {
      id: 'temp_shift',
      name: 'Temp Shift Broker',
      domain: 'temp-shift.com',
      featureOverrides: {
        iron_lock: 'free',          // elite → free
        ai_insights: 'free',        // pro → free
        basic_portfolio: 'elite',    // free → elite
      } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);

    // Verify shifted state
    let store = useSubscriptionStore.getState();
    expect(store.isFeatureAvailable('iron_lock')).toBe(true);   // was elite, now free
    expect(store.isFeatureAvailable('ai_insights')).toBe(true);  // was pro, now free
    expect(store.isFeatureAvailable('basic_portfolio')).toBe(false); // was free, now elite

    // Clear tenant
    useSubscriptionStore.setState({ tenantConfig: null });

    // Verify restored defaults
    store = useSubscriptionStore.getState();
    expect(store.isFeatureAvailable('iron_lock')).toBe(false);   // back to elite
    expect(store.isFeatureAvailable('ai_insights')).toBe(false);  // back to pro
    expect(store.isFeatureAvailable('basic_portfolio')).toBe(true); // back to free
  });

  it('does not affect isFeatureAvailable for features that were not overridden', () => {
    const tenant: TenantConfig = {
      id: 'minimal',
      name: 'Minimal Broker',
      domain: 'minimal.com',
      featureOverrides: {
        iron_lock: 'pro',  // Only override one feature
      } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const store = useSubscriptionStore.getState();

    // Overridden feature changes
    expect(store.isFeatureAvailable('iron_lock')).toBe(false); // elite→pro, still locked for free

    // Non-overridden features remain at defaults
    expect(store.isFeatureAvailable('basic_portfolio')).toBe(true);   // still free
    expect(store.isFeatureAvailable('advanced_analytics')).toBe(false); // still pro
    expect(store.isFeatureAvailable('real_time_data')).toBe(false);    // still elite

    // Pro user check
    useSubscriptionStore.setState({ subscription: { tier: 'pro', planId: 'plan_pro', status: 'active', startDate: '', endDate: '', autoRenew: true } });
    const proStore = useSubscriptionStore.getState();
    expect(proStore.isFeatureAvailable('iron_lock')).toBe(true); // elite→pro, now accessible at pro
  });

  it('handles tenant shifting ALL features to a single tier correctly', () => {
    // Tenant shifts everything to free (fully unlocked platform)
    const tenant: TenantConfig = {
      id: 'fully_unlocked',
      name: 'Fully Unlocked',
      domain: 'unlocked.com',
      featureOverrides: (Object.fromEntries(
        ([
          'basic_portfolio', 'unlimited_watchlist', 'advanced_analytics',
          'ai_insights', 'ai_companion', 'iron_lock', 'real_time_data',
          'social_trading', 'full_education', 'tax_reports', 'api_access',
          'ad_free', 'priority_support', 'dedicated_manager', 'behavioural_journal',
        ] as const).map(f => [f, 'free']),
      ) as any) as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const store = useSubscriptionStore.getState();

    // Free user has access to ALL features
    expect(store.isFeatureAvailable('basic_portfolio')).toBe(true);
    expect(store.isFeatureAvailable('iron_lock')).toBe(true);
    expect(store.isFeatureAvailable('real_time_data')).toBe(true);
    expect(store.isFeatureAvailable('social_trading')).toBe(true);
    expect(store.isFeatureAvailable('tax_reports')).toBe(true);
    expect(store.isFeatureAvailable('api_access')).toBe(true);
    expect(store.isFeatureAvailable('dedicated_manager')).toBe(true);
    expect(store.isFeatureAvailable('behavioural_journal')).toBe(true);

    // All 15 features available to free user
    const allFeatures: any[] = [
      'basic_portfolio', 'unlimited_watchlist', 'advanced_analytics',
      'ai_insights', 'ai_companion', 'iron_lock', 'real_time_data',
      'social_trading', 'full_education', 'tax_reports', 'api_access',
      'ad_free', 'priority_support', 'dedicated_manager', 'behavioural_journal',
    ];
    allFeatures.forEach(f => {
      expect(store.isFeatureAvailable(f)).toBe(true);
    });
  });
});

// ==================== getFeaturesForTier ====================

describe('getFeaturesForTier', () => {
  it('returns only free features for free tier', () => {
    const features = useSubscriptionStore.getState().getFeaturesForTier('free');

    expect(features).toContain('basic_portfolio');
    expect(features).not.toContain('advanced_analytics');
    expect(features).not.toContain('ai_insights');
    expect(features).not.toContain('iron_lock');
    expect(features).toHaveLength(1);
  });

  it('returns free + pro features for pro tier', () => {
    const features = useSubscriptionStore.getState().getFeaturesForTier('pro');

    expect(features).toContain('basic_portfolio');
    expect(features).toContain('advanced_analytics');
    expect(features).toContain('ai_insights');
    expect(features).toContain('ai_companion');
    expect(features).toContain('full_education');
    expect(features).toContain('ad_free');
    expect(features).toContain('priority_support');
    expect(features).not.toContain('iron_lock');
    expect(features).not.toContain('real_time_data');

    // 1 free + 7 pro = 8
    expect(features).toHaveLength(8);
  });

  it('returns all features for elite tier', () => {
    const features = useSubscriptionStore.getState().getFeaturesForTier('elite');

    expect(features).toContain('basic_portfolio');
    expect(features).toContain('iron_lock');
    expect(features).toContain('real_time_data');
    expect(features).toContain('social_trading');
    expect(features).toContain('tax_reports');
    expect(features).toContain('api_access');
    expect(features).toContain('dedicated_manager');
    expect(features).toContain('behavioural_journal');

    // 1 free + 7 pro + 7 elite = 15
    expect(features).toHaveLength(15);
  });

  it('reflects tenant overrides in returned features', () => {
    const tenant: TenantConfig = {
      id: 'override_tenant',
      name: 'Override Broker',
      domain: 'override.com',
      featureOverrides: { ai_insights: 'free', iron_lock: 'pro' } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);

    // Free tier should now include ai_insights
    const freeFeatures = useSubscriptionStore.getState().getFeaturesForTier('free');
    expect(freeFeatures).toContain('ai_insights');
    expect(freeFeatures).toContain('basic_portfolio');
    expect(freeFeatures).toHaveLength(2);

    // Pro tier should now include iron_lock
    const proFeatures = useSubscriptionStore.getState().getFeaturesForTier('pro');
    expect(proFeatures).toContain('iron_lock');
    expect(proFeatures).not.toContain('real_time_data'); // Still elite
    expect(proFeatures).toHaveLength(9); // 1 free + 7 pro defaults + ai_insights shifted to free + iron_lock shifted to pro = 9
  });

  // ── Tier Shifting ──────────────────────────────────────────────

  it('shifts elite features to free tier for fully unlocked access', () => {
    // A generous tenant makes all elite features available at free tier
    const tenant: TenantConfig = {
      id: 'generous',
      name: 'Generous Broker',
      domain: 'generous.com',
      featureOverrides: {
        iron_lock: 'free',
        real_time_data: 'free',
        social_trading: 'free',
        tax_reports: 'free',
        api_access: 'free',
        dedicated_manager: 'free',
        behavioural_journal: 'free',
      } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const freeFeatures = useSubscriptionStore.getState().getFeaturesForTier('free');

    // All elite features should now appear in free
    expect(freeFeatures).toContain('iron_lock');
    expect(freeFeatures).toContain('real_time_data');
    expect(freeFeatures).toContain('social_trading');
    expect(freeFeatures).toContain('tax_reports');
    expect(freeFeatures).toContain('api_access');
    expect(freeFeatures).toContain('dedicated_manager');
    expect(freeFeatures).toContain('behavioural_journal');

    // Free tier = 1 default-free + 7 elite-overridden-to-free + 7 pro (pro features are NOT in free)
    // = 8 features total
    expect(freeFeatures).toHaveLength(8);

    // Pro tier gets everything free has + pro features (which weren't overridden)
    const proFeatures = useSubscriptionStore.getState().getFeaturesForTier('pro');
    expect(proFeatures).toContain('iron_lock');
    // Pro tier: 8 free-level features + 7 pro-level features = 15
    expect(proFeatures).toHaveLength(15);
  });

  it('shifts free and pro features to elite tier for fully locked access', () => {
    // A restrictive tenant moves everything to elite
    const tenant: TenantConfig = {
      id: 'restrictive',
      name: 'Restrictive Broker',
      domain: 'restrictive.com',
      // Only iron_lock stays elite — everything else shifts up too
      featureOverrides: {
        basic_portfolio: 'elite',
        unlimited_watchlist: 'elite',
        advanced_analytics: 'elite',
        ai_insights: 'elite',
        ai_companion: 'elite',
        full_education: 'elite',
        ad_free: 'elite',
        priority_support: 'elite',
      } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);

    // Free tier should have zero features
    const freeFeatures = useSubscriptionStore.getState().getFeaturesForTier('free');
    expect(freeFeatures).toHaveLength(0);

    // Pro tier should also have zero features (everything locked to elite)
    const proFeatures = useSubscriptionStore.getState().getFeaturesForTier('pro');
    expect(proFeatures).toHaveLength(0);

    // Elite tier still has all 15
    const eliteFeatures = useSubscriptionStore.getState().getFeaturesForTier('elite');
    expect(eliteFeatures).toHaveLength(15);
  });

  it('shifts features in both directions simultaneously', () => {
    // Complex scenario: some features move up, some move down
    const tenant: TenantConfig = {
      id: 'complex',
      name: 'Complex Broker',
      domain: 'complex.com',
      featureOverrides: {
        // Shifted DOWN (more accessible)
        iron_lock: 'free',      // elite → free (big shift)
        real_time_data: 'pro',   // elite → pro
        // Shifted UP (less accessible)
        basic_portfolio: 'pro',  // free → pro (locked down)
        ad_free: 'elite',        // pro → elite
        ai_companion: 'elite',   // pro → elite
      } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);

    // Free tier: features with minTier 'free'
    const freeFeatures = useSubscriptionStore.getState().getFeaturesForTier('free');
    expect(freeFeatures).toContain('iron_lock');       // elite → free
    expect(freeFeatures).not.toContain('basic_portfolio'); // free → pro (moved up)
    expect(freeFeatures).toHaveLength(1); // Only iron_lock (basic_portfolio was the only free feature)

    // Pro tier: features with minTier 'free' or 'pro'
    const proFeatures = useSubscriptionStore.getState().getFeaturesForTier('pro');
    expect(proFeatures).toContain('iron_lock');         // elite → free, included at pro
    expect(proFeatures).toContain('basic_portfolio');   // free → pro, now included at pro
    expect(proFeatures).toContain('real_time_data');    // elite → pro, now included at pro
    expect(proFeatures).not.toContain('ad_free');       // pro → elite, excluded
    expect(proFeatures).not.toContain('ai_companion');   // pro → elite, excluded

    // The shift changes feature availability
    // Default pro had 8 features (1 free + 7 pro)
    // After overrides:
    //   - iron_lock added to free (now 2 free-tier features: iron_lock, basic_portfolio... wait, basic_portfolio moved to pro)
    //   So free has: iron_lock only = 1 feature
    //   Pro has: iron_lock (minTier:free) + basic_portfolio (pro) + unlimited_watchlist (pro) 
    //            + advanced_analytics (pro) + ai_insights (pro) + full_education (pro)
    //            + priority_support (pro) + real_time_data (pro) = 8
    //   Minus ad_free and ai_companion (moved to elite)
    expect(proFeatures).toHaveLength(8);

    // Elite: all features
    const eliteFeatures = useSubscriptionStore.getState().getFeaturesForTier('elite');
    expect(eliteFeatures).toHaveLength(15);
  });

  it('shifts features for one tier without affecting others', () => {
    // Tenant makes ai_insights free — only free tier list changes
    const tenant: TenantConfig = {
      id: 'only_free',
      name: 'Only Free Shift',
      domain: 'shift.com',
      featureOverrides: { ai_insights: 'free' } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);

    // Free tier grows (ai_insights added)
    const freeFeatures = useSubscriptionStore.getState().getFeaturesForTier('free');
    expect(freeFeatures).toHaveLength(2); // basic_portfolio + ai_insights
    expect(freeFeatures).toContain('ai_insights');
    expect(freeFeatures).toContain('basic_portfolio');

    // Pro tier unchanged (already had ai_insights at its default 'pro' level)
    const proFeatures = useSubscriptionStore.getState().getFeaturesForTier('pro');
    expect(proFeatures).toHaveLength(8); // Still 8 features
    expect(proFeatures).toContain('ai_insights');

    // Elite tier unchanged
    const eliteFeatures = useSubscriptionStore.getState().getFeaturesForTier('elite');
    expect(eliteFeatures).toHaveLength(15);
  });

  it('restores default features after clearing tenant config', () => {
    // Setup tenant with overrides
    const tenant: TenantConfig = {
      id: 'temp',
      name: 'Temp Broker',
      domain: 'temp.com',
      featureOverrides: { iron_lock: 'free', ai_insights: 'free', advanced_analytics: 'free' } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);

    // Verify overrides are active
    let freeFeatures = useSubscriptionStore.getState().getFeaturesForTier('free');
    expect(freeFeatures).toHaveLength(4); // basic_portfolio + iron_lock + ai_insights + advanced_analytics

    // Clear tenant
    useSubscriptionStore.setState({ tenantConfig: null });

    // Verify defaults restored
    freeFeatures = useSubscriptionStore.getState().getFeaturesForTier('free');
    expect(freeFeatures).toHaveLength(1); // Only basic_portfolio
    expect(freeFeatures).toContain('basic_portfolio');
    expect(freeFeatures).not.toContain('iron_lock');
    expect(freeFeatures).not.toContain('ai_insights');

    // Pro tier back to 8
    const proFeatures = useSubscriptionStore.getState().getFeaturesForTier('pro');
    expect(proFeatures).toHaveLength(8);
  });

  it('returns correct features at each tier after shifting elite features down to pro', () => {
    // Tenant makes most elite features available at pro level
    const tenant: TenantConfig = {
      id: 'elite_to_pro',
      name: 'Elite-to-Pro Broker',
      domain: 'e2p.com',
      featureOverrides: {
        iron_lock: 'pro',
        real_time_data: 'pro',
        social_trading: 'pro',
        tax_reports: 'pro',
      } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);

    // Free: still just basic_portfolio
    const freeFeatures = useSubscriptionStore.getState().getFeaturesForTier('free');
    expect(freeFeatures).toHaveLength(1);
    expect(freeFeatures).toEqual(['basic_portfolio']);

    // Pro: free features (1) + default pro features (7) + elite shifted to pro (4) = 12
    // Wait, the 4 elite features shifted to pro overlap with the "all other features"
    // Default pro has: basic_portfolio, unlimited_watchlist, advanced_analytics, ai_insights, ai_companion, full_education, ad_free, priority_support = 8
    // Plus: iron_lock, real_time_data, social_trading, tax_reports = 4
    // Total pro features = 12
    const proFeatures = useSubscriptionStore.getState().getFeaturesForTier('pro');
    expect(proFeatures).toHaveLength(12);
    expect(proFeatures).toContain('iron_lock');
    expect(proFeatures).toContain('real_time_data');
    expect(proFeatures).toContain('social_trading');
    expect(proFeatures).toContain('tax_reports');

    // Remaining elite: api_access, dedicated_manager, behavioural_journal
    expect(proFeatures).not.toContain('api_access');
    expect(proFeatures).not.toContain('dedicated_manager');
    expect(proFeatures).not.toContain('behavioural_journal');

    // Elite still has everything
    const eliteFeatures = useSubscriptionStore.getState().getFeaturesForTier('elite');
    expect(eliteFeatures).toHaveLength(15);
  });

  it('preserves feature order stability across repeated calls', () => {
    // Feature order should be deterministic (Object.keys order)
    const tenant: TenantConfig = {
      id: 'stable',
      name: 'Stable Broker',
      domain: 'stable.com',
      featureOverrides: { iron_lock: 'free' } as PaywallOverride,
    };

    useSubscriptionStore.getState().configureTenant(tenant);

    const first = useSubscriptionStore.getState().getFeaturesForTier('free');
    const second = useSubscriptionStore.getState().getFeaturesForTier('free');
    const third = useSubscriptionStore.getState().getFeaturesForTier('free');

    expect(first).toEqual(second);
    expect(second).toEqual(third);

    // After clearing tenant, order should still be deterministic
    useSubscriptionStore.setState({ tenantConfig: null });
    const reset = useSubscriptionStore.getState().getFeaturesForTier('free');
    expect(reset).toEqual(['basic_portfolio']);
  });
});

// ==================== getPlanPrice ====================

describe('getPlanPrice', () => {
  it('returns default prices when no tenant is configured', () => {
    const store = useSubscriptionStore.getState();

    const freePrice = store.getPlanPrice('plan_free');
    expect(freePrice.monthly).toBe(0);
    expect(freePrice.yearly).toBe(0);

    const proPrice = store.getPlanPrice('plan_pro');
    expect(proPrice.monthly).toBe(399);
    expect(proPrice.yearly).toBe(3999);

    const elitePrice = store.getPlanPrice('plan_elite');
    expect(elitePrice.monthly).toBe(999);
    expect(elitePrice.yearly).toBe(9999);
  });

  it('returns 0/0 for an unknown plan ID', () => {
    const price = useSubscriptionStore.getState().getPlanPrice('plan_nonexistent');
    expect(price.monthly).toBe(0);
    expect(price.yearly).toBe(0);
  });

  it('applies tenant pricing overrides to pro plan', () => {
    const tenant: TenantConfig = {
      id: 'pricing_tenant',
      name: 'Discount Broker',
      domain: 'discount.com',
      razorpay: {
        keyId: 'rzp_test_xxx',
        keySecret: 'test_secret',
        pricing: {
          plan_pro: { monthly: 199, yearly: 1999 },
        },
      },
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const price = useSubscriptionStore.getState().getPlanPrice('plan_pro');

    expect(price.monthly).toBe(199); // Overridden from 399
    expect(price.yearly).toBe(1999); // Overridden from 3999
  });

  it('applies tenant pricing overrides to elite plan', () => {
    const tenant: TenantConfig = {
      id: 'premium_tenant',
      name: 'Premium Broker',
      domain: 'premium.com',
      razorpay: {
        keyId: 'rzp_test_yyy',
        keySecret: 'test_secret',
        pricing: {
          plan_elite: { monthly: 1499, yearly: 14999 },
        },
      },
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const price = useSubscriptionStore.getState().getPlanPrice('plan_elite');

    expect(price.monthly).toBe(1499); // Overridden from 999
    expect(price.yearly).toBe(14999); // Overridden from 9999
  });

  it('falls back to default price when tenant override is partial (only monthly set)', () => {
    const tenant: TenantConfig = {
      id: 'partial_tenant',
      name: 'Partial Broker',
      domain: 'partial.com',
      razorpay: {
        keyId: 'rzp_test_zzz',
        keySecret: 'test_secret',
        pricing: {
          plan_pro: { monthly: 299, yearly: 0 },
        },
      },
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const price = useSubscriptionStore.getState().getPlanPrice('plan_pro');

    // The code uses `??` so 0 is treated as a valid value
    expect(price.monthly).toBe(299);
    // yearly is set to 0 in override, but 0 is falsy... wait, ?? checks for null/undefined, not falsy
    // So yearly: 0 should be treated as 0 since it's explicitly set
    expect(price.yearly).toBe(0);
  });

  it('uses default prices when tenant has no pricing config', () => {
    const tenant: TenantConfig = {
      id: 'no_pricing_tenant',
      name: 'No Pricing',
      domain: 'nopricing.com',
      razorpay: { keyId: 'test', keySecret: 'test' }, // No pricing override
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const price = useSubscriptionStore.getState().getPlanPrice('plan_pro');

    expect(price.monthly).toBe(399);
    expect(price.yearly).toBe(3999);
  });

  it('uses default prices when tenant has no razorpay config at all', () => {
    const tenant: TenantConfig = {
      id: 'no_razorpay_tenant',
      name: 'No Razorpay',
      domain: 'nora.com',
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const price = useSubscriptionStore.getState().getPlanPrice('plan_elite');

    expect(price.monthly).toBe(999);
    expect(price.yearly).toBe(9999);
  });

  // ── Edge Cases ───────────────────────────────────────────────

  it('falls back to default monthly price when tenant override has only yearly', () => {
    // Tenant only overrides the yearly price — monthly should use the plan default
    const tenant: TenantConfig = {
      id: 'yearly_only',
      name: 'Yearly Only Broker',
      domain: 'yearly-only.com',
      razorpay: {
        keyId: 'rzp_test_yo',
        keySecret: 'test_secret_yo',
        pricing: {
          plan_pro: { yearly: 2999 } as any, // monthly is intentionally omitted/undefined
        },
      },
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const price = useSubscriptionStore.getState().getPlanPrice('plan_pro');

    // monthly falls back to plan default (399) via ??
    expect(price.monthly).toBe(399);
    // yearly uses the override
    expect(price.yearly).toBe(2999);
  });

  it('falls back to default yearly price when tenant override has only monthly', () => {
    // Tenant only overrides the monthly price — yearly should use the plan default
    const tenant: TenantConfig = {
      id: 'monthly_only',
      name: 'Monthly Only Broker',
      domain: 'monthly-only.com',
      razorpay: {
        keyId: 'rzp_test_mo',
        keySecret: 'test_secret_mo',
        pricing: {
          plan_elite: { monthly: 799 } as any, // yearly is intentionally omitted/undefined
        },
      },
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const price = useSubscriptionStore.getState().getPlanPrice('plan_elite');

    // monthly uses the override
    expect(price.monthly).toBe(799);
    // yearly falls back to plan default (9999) via ??
    expect(price.yearly).toBe(9999);
  });

  it('uses default prices for plans not included in tenant pricing overrides', () => {
    // Tenant overrides Pro pricing but not Elite
    const tenant: TenantConfig = {
      id: 'partial_pricing',
      name: 'Partial Pricing Broker',
      domain: 'partial-pricing.com',
      razorpay: {
        keyId: 'rzp_test_pp',
        keySecret: 'test_secret_pp',
        pricing: {
          plan_pro: { monthly: 149, yearly: 1499 },
          // plan_elite is NOT overridden
        },
      },
    };

    useSubscriptionStore.getState().configureTenant(tenant);

    // Pro is overridden
    const proPrice = useSubscriptionStore.getState().getPlanPrice('plan_pro');
    expect(proPrice.monthly).toBe(149);
    expect(proPrice.yearly).toBe(1499);

    // Elite falls back to defaults (no matching entry in pricing)
    const elitePrice = useSubscriptionStore.getState().getPlanPrice('plan_elite');
    expect(elitePrice.monthly).toBe(999);
    expect(elitePrice.yearly).toBe(9999);

    // Free plan is also not overridden
    const freePrice = useSubscriptionStore.getState().getPlanPrice('plan_free');
    expect(freePrice.monthly).toBe(0);
    expect(freePrice.yearly).toBe(0);
  });

  it('guards against NaN values from tenant pricing by falling back to defaults', () => {
    // If a NaN value is set in the pricing object (e.g. from parseInt of empty string),
    // the store should detect it via Number.isNaN() and fall back to the plan default.
    const tenant: TenantConfig = {
      id: 'nan_tenant',
      name: 'NaN Broker',
      domain: 'nan.com',
      razorpay: {
        keyId: 'rzp_test_nan',
        keySecret: 'test_secret_nan',
        pricing: {
          plan_pro: { monthly: NaN, yearly: 1999 },
        },
      },
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const price = useSubscriptionStore.getState().getPlanPrice('plan_pro');

    // NaN is caught by isNaN() guard and falls back to plan default (399)
    expect(price.monthly).toBe(399);
    // yearly is valid
    expect(price.yearly).toBe(1999);
  });

  it('handles missing pricing section gracefully', () => {
    // Tenant has razorpay config but no pricing section at all
    const tenant: TenantConfig = {
      id: 'no_pricing_section',
      name: 'No Pricing Section',
      domain: 'no-pricing.com',
      razorpay: {
        keyId: 'rzp_test_np',
        keySecret: 'test_secret_np',
        // No pricing key — should fall back to defaults
      },
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const proPrice = useSubscriptionStore.getState().getPlanPrice('plan_pro');
    expect(proPrice.monthly).toBe(399);
    expect(proPrice.yearly).toBe(3999);

    const elitePrice = useSubscriptionStore.getState().getPlanPrice('plan_elite');
    expect(elitePrice.monthly).toBe(999);
    expect(elitePrice.yearly).toBe(9999);
  });

  it('treats 0 as a valid override value (not a fallback trigger)', () => {
    // The store uses ?? which only catches null/undefined.
    // A 0 value is explicitly set and should be preserved.
    const tenant: TenantConfig = {
      id: 'zero_pricing',
      name: 'Zero Pricing Broker',
      domain: 'zero.com',
      razorpay: {
        keyId: 'rzp_test_zero',
        keySecret: 'test_secret_zero',
        pricing: {
          plan_pro: { monthly: 0, yearly: 0 },
        },
      },
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const price = useSubscriptionStore.getState().getPlanPrice('plan_pro');

    // Both 0 values should be preserved (not fall back to 399/3999)
    expect(price.monthly).toBe(0);
    expect(price.yearly).toBe(0);
  });
});

// ==================== configureTenant ====================

describe('configureTenant', () => {
  it('stores the tenant config and makes it retrievable via getTenantConfig', () => {
    const tenant: TenantConfig = {
      id: 'acme_corp',
      name: 'Acme Corp',
      domain: 'acme.toroloom.app',
      primaryColor: '#FF6600',
    };

    useSubscriptionStore.getState().configureTenant(tenant);
    const retrieved = useSubscriptionStore.getState().getTenantConfig();

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('acme_corp');
    expect(retrieved?.name).toBe('Acme Corp');
    expect(retrieved?.domain).toBe('acme.toroloom.app');
    expect(retrieved?.primaryColor).toBe('#FF6600');
  });

  it('replaces previous tenant config when called again', () => {
    const tenant1: TenantConfig = { id: 'first', name: 'First', domain: 'first.com' };
    const tenant2: TenantConfig = { id: 'second', name: 'Second', domain: 'second.com' };

    useSubscriptionStore.getState().configureTenant(tenant1);
    useSubscriptionStore.getState().configureTenant(tenant2);

    const retrieved = useSubscriptionStore.getState().getTenantConfig();
    expect(retrieved?.id).toBe('second');
  });

  it('returns null for getTenantConfig when no tenant is configured', () => {
    const retrieved = useSubscriptionStore.getState().getTenantConfig();
    expect(retrieved).toBeNull();
  });
});

// ==================== End-to-End: Tenant Combined Config ====================

describe('end-to-end: full tenant configuration', () => {
  it('combines feature overrides, pricing overrides, and subscription checks correctly', () => {
    // A tenant that wants to offer a premium package:
    // - Makes AI insights free for all users (attract users)
    // - Makes Iron Lock available at Pro level (mid-tier upsell)
    // - Sets custom pricing for Elite plan
    const tenant: TenantConfig = {
      id: 'smart_broker',
      name: 'Smart Broker',
      domain: 'smart.toroloom.app',
      featureOverrides: {
        ai_insights: 'free',
        ai_companion: 'free',
        iron_lock: 'pro',
      } as PaywallOverride,
      razorpay: {
        keyId: 'rzp_live_smart',
        keySecret: 'super_secret',
        pricing: {
          plan_elite: { monthly: 1299, yearly: 12999 },
        },
      },
    };

    useSubscriptionStore.getState().configureTenant(tenant);

    // ── Free user checks ──
    useSubscriptionStore.setState({ subscription: { tier: 'free', planId: 'plan_free', status: 'active', startDate: '', endDate: '', autoRenew: false } });
    let store = useSubscriptionStore.getState();

    // Free features
    expect(store.isFeatureAvailable('basic_portfolio')).toBe(true);
    expect(store.isFeatureAvailable('ai_insights')).toBe(true); // Overridden to free
    expect(store.isFeatureAvailable('ai_companion')).toBe(true); // Overridden to free

    // Still locked
    expect(store.isFeatureAvailable('advanced_analytics')).toBe(false);
    expect(store.isFeatureAvailable('iron_lock')).toBe(false); // Only pro+

    // ── Pro user checks ──
    useSubscriptionStore.setState({ subscription: { tier: 'pro', planId: 'plan_pro', status: 'active', startDate: '', endDate: '', autoRenew: true } });
    store = useSubscriptionStore.getState();

    expect(store.isFeatureAvailable('iron_lock')).toBe(true); // Overridden to pro
    expect(store.isFeatureAvailable('real_time_data')).toBe(false); // Still elite

    // Pricing unaffected for pro (no override)
    expect(store.getPlanPrice('plan_pro')).toEqual({ monthly: 399, yearly: 3999 });

    // ── Elite user checks ──
    useSubscriptionStore.setState({ subscription: { tier: 'elite', planId: 'plan_elite', status: 'active', startDate: '', endDate: '', autoRenew: true } });
    store = useSubscriptionStore.getState();

    expect(store.isFeatureAvailable('real_time_data')).toBe(true);
    expect(store.isFeatureAvailable('social_trading')).toBe(true);
    expect(store.isFeatureAvailable('behavioural_journal')).toBe(true);

    // Elite pricing overridden
    expect(store.getPlanPrice('plan_elite')).toEqual({ monthly: 1299, yearly: 12999 });

    // Features list reflects overrides
    const freeFeatures = store.getFeaturesForTier('free');
    expect(freeFeatures).toContain('ai_insights');
    expect(freeFeatures).toContain('ai_companion');
    expect(freeFeatures).toHaveLength(3); // basic_portfolio + ai_insights + ai_companion

    const proFeatures = store.getFeaturesForTier('pro');
    expect(proFeatures).toContain('iron_lock');
    expect(proFeatures).toHaveLength(9); // 3 free-level (basic_portfolio + ai_insights + ai_companion) + 6 pro-level (5 defaults + iron_lock) = 9
  });
});
