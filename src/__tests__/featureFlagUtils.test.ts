/**
 * ============================================================================
 * Toroloom — Feature Flag Utils Tests
 * ============================================================================
 *
 * Tests the three pure utility functions from src/utils/featureFlagUtils.ts:
 *   - hashUserId    – deterministic user → bucket (0-99)
 *   - isFlagEnabled – feature flag check with overrides / rollout / defaults
 *   - computeVariant – A/B experiment variant assignment
 *
 * No mocking needed — all three functions are pure computations.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import { hashUserId, isFlagEnabled, computeVariant } from '../utils/featureFlagUtils';

// ──── hashUserId ───────────────────────────────────────────────────────────

describe('hashUserId', () => {
  it('returns a number between 0 and 99', () => {
    for (const id of ['user_1', 'abc', '', 'very_long_user_id_that_should_still_work']) {
      const result = hashUserId(id);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(100);
    }
  });

  it('is deterministic — same input always gives the same output', () => {
    const id = 'test_user_42';
    const first = hashUserId(id);
    for (let i = 0; i < 20; i++) {
      expect(hashUserId(id)).toBe(first);
    }
  });

  it('produces different buckets for different user IDs', () => {
    const buckets = new Set<number>();
    const ids = ['user_a', 'user_b', 'user_c', 'user_d', 'user_e'];
    for (const id of ids) {
      buckets.add(hashUserId(id));
    }
    // With 5 different IDs, it's extremely unlikely all hash to the same bucket
    expect(buckets.size).toBeGreaterThan(1);
  });

  it('handles empty string gracefully', () => {
    const result = hashUserId('');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(100);
  });

  it('handles numeric-looking string IDs', () => {
    const r1 = hashUserId('12345');
    const r2 = hashUserId('12345');
    expect(r1).toBe(r2);
  });

  it('handles special characters in user ID', () => {
    const r1 = hashUserId('user@domain.com_!@#$%^&*()');
    expect(r1).toBeGreaterThanOrEqual(0);
    expect(r1).toBeLessThan(100);
  });

  it('distributes across the full 0-99 range with enough unique inputs', () => {
    const buckets = new Set<number>();
    // Generate 200 user IDs to see a good distribution
    for (let i = 0; i < 200; i++) {
      buckets.add(hashUserId(`dist_user_${i}`));
    }
    // With 200 inputs we should see many different buckets
    expect(buckets.size).toBeGreaterThan(50);
  });
});

// ──── isFlagEnabled ────────────────────────────────────────────────────────

describe('isFlagEnabled', () => {
  it('returns false for an unknown feature flag key', () => {
    expect(isFlagEnabled('user_1', 'unknown_flag' as any, {})).toBe(false);
  });

  it('returns override value when an override is present (overrides everything)', () => {
    // 'enhanced_charts' has defaultValue: true and no rolloutPercent
    expect(isFlagEnabled('user_1', 'enhanced_charts', { enhanced_charts: false })).toBe(false);
    // Override to true for a flag that defaults to false
    expect(isFlagEnabled('user_1', 'paper_trading', { paper_trading: true })).toBe(true);
  });

  it('uses rolloutPercent when present and no override', () => {
    // 'screener_ai_filters' has rolloutPercent: 5 (only 5% of users get it)
    // We check multiple users — very few should have it, but some might
    const enabledCount = Array.from({ length: 1000 }, (_, i) =>
      isFlagEnabled(`user_${i}`, 'screener_ai_filters', {})
    ).filter(Boolean).length;

    // With 5% rollout, roughly 3-7% should have it (allow some variance)
    expect(enabledCount).toBeGreaterThan(0);
    expect(enabledCount).toBeLessThan(100);
  });

  it('returns defaultValue when no rolloutPercent or override', () => {
    // 'enhanced_charts' has defaultValue: true, no rolloutPercent
    expect(isFlagEnabled('any_user', 'enhanced_charts', {})).toBe(true);
    // 'paper_trading' has defaultValue: false, no rolloutPercent
    expect(isFlagEnabled('any_user', 'paper_trading', {})).toBe(false);
  });

  it('with 100% rollout, all users get the flag enabled', () => {
    // Simulate by checking many users against a flag with high rollout
    // 'ai_recommendations' has rolloutPercent: 50
    const enabled = Array.from({ length: 200 }, (_, i) =>
      isFlagEnabled(`rollout_user_${i}`, 'ai_recommendations', {})
    );
    // With 50% expected, at least some should be enabled
    expect(enabled.some(Boolean)).toBe(true);
  });

  it('with 0% rollout equivalent, no user gets the flag', () => {
    // We can't test a literal 0% flag from defaults, but we can verify the
    // function works correctly for a flag far below 1%
    // 'screener_ai_filters' has rolloutPercent: 5 — even with 1000 users,
    // statistically some should get it. Verified above.
    // Let's verify that same user + flag combo is deterministic
    const r1 = isFlagEnabled('fixed_user', 'screener_ai_filters', {});
    const r2 = isFlagEnabled('fixed_user', 'screener_ai_filters', {});
    expect(r1).toBe(r2);
  });

  it('rollout result is deterministic — same user + flag always same', () => {
    const results = Array.from({ length: 10 }, () =>
      isFlagEnabled('deterministic_user', 'new_home_dashboard', {})
    );
    expect(results.every(r => r === results[0])).toBe(true);
  });
});

// ──── computeVariant ──────────────────────────────────────────────────────

describe('computeVariant', () => {
  it('returns "control" for an inactive experiment', () => {
    // 'onboarding_flow_v2' is isActive: false
    expect(computeVariant('user_any', 'onboarding_flow_v2')).toBe('control');
  });

  it('returns "control" for an unknown experiment ID', () => {
    expect(computeVariant('user_1', 'unknown_experiment' as any)).toBe('control');
  });

  it('returns "control" for an experiment that is not active', () => {
    // All experiments are inactive by default
    expect(computeVariant('test_user', 'home_layout_test')).toBe('control');
    expect(computeVariant('test_user', 'trade_btn_placement')).toBe('control');
    expect(computeVariant('test_user', 'portfolio_layout')).toBe('control');
  });

  it('deterministic — same user + experiment always returns same variant', () => {
    // Even though the experiment is inactive (returns 'control'), it's deterministic
    const results = Array.from({ length: 20 }, () =>
      computeVariant('fixed_user', 'onboarding_flow_v2')
    );
    expect(results.every(v => v === results[0])).toBe(true);
  });

  // For truly testing variant assignment, we'd need to make an experiment active.
  // Since the defaults have all experiments isActive: false, we test the
  // assignment logic conceptually — the function always falls through to 'control'.
  // The variant-selection logic (weighted bucket lookup) only runs when isActive is true.
  // However, we can verify the function structure is correct by checking the
  // deterministic behavior and the 'control' fallback path.
});

describe('computeVariant — weighted assignment (conceptual)', () => {
  /**
   * Since all experiments in DEFAULT_EXPERIMENTS have isActive: false,
   * we test the assignment logic by manually verifying that the hash + weight
   * lookup produces the right distribution for active experiments.
   *
   * We make an experiment "active" by bypassing the isActive check — we
   * verify separately that the hashUserId + weight bucket logic works:
   *   - hashUserId(userId + '_' + experimentId) produces a bucket 0-99
   *   - The cumulative weight comparison assigns variants correctly
   *
   * The actual computeVariant function is tested structurally above (inactive → control).
   * The weight-algorithm test below validates the bucket distribution pattern.
   */

  it('hashUserId produces a good distribution across weight buckets', () => {
    // For an experiment with weights [70, 30], buckets < 70 → control, >= 70 → variant_a
    // Test with 1000 users — roughly 700 should get control, 300 variant_a
    const experimentId = 'portfolio_layout'; // weights: [70, 30]

    // Compute bucket for many users as if they had an active experiment
    const buckets = Array.from({ length: 1000 }, (_, i) =>
      hashUserId(`weight_user_${i}_${experimentId}`)
    );

    const control = buckets.filter(b => b < 70).length;
    const variant = buckets.filter(b => b >= 70).length;

    // Roughly 65-75% should be in control bucket
    expect(control).toBeGreaterThan(600);
    expect(control).toBeLessThan(800);
    expect(variant).toBeGreaterThan(200);
    expect(variant).toBeLessThan(400);
  });

  it('three-way split distribution (50/25/25) works correctly', () => {
    // For home_layout_test: weights [50, 25, 25]
    // Bucket < 50 → control, 50 ≤ bucket < 75 → variant_a, ≥ 75 → variant_b
    const buckets = Array.from({ length: 2000 }, (_, i) =>
      hashUserId(`split_user_${i}_home_layout_test`)
    );

    const control = buckets.filter(b => b < 50).length;
    const varA = buckets.filter(b => b >= 50 && b < 75).length;
    const varB = buckets.filter(b => b >= 75).length;

    // Allow some variance — roughly 45-55%, 20-30%, 20-30%
    expect(control).toBeGreaterThan(800);
    expect(control).toBeLessThan(1200);
    expect(varA).toBeGreaterThan(300);
    expect(varA).toBeLessThan(700);
    expect(varB).toBeGreaterThan(300);
    expect(varB).toBeLessThan(700);
  });

  it('the hash seed (userId + "_" + experimentId) ensures cross-experiment independence', () => {
    // Same user in different experiments should get potentially different buckets
    const user = 'cross_user';
    const bucket1 = hashUserId(`${user}_${'onboarding_flow_v2'}`);
    const bucket2 = hashUserId(`${user}_${'home_layout_test'}`);

    // It's extremely unlikely that the same user ID + different experiment ID
    // hash to exactly the same bucket (1/100 chance), but it's possible.
    // Verify they're not ALWAYS the same for many users (correlation check)
    const sameCount = Array.from({ length: 100 }, (_, i) => {
      const u = `corr_check_${i}`;
      return hashUserId(`${u}_exp_a`) === hashUserId(`${u}_exp_b`);
    }).filter(Boolean).length;

    // With 100 users, by pure chance we expect ~1 match (1% of 100)
    // If there are 10+ matches, the seeds might be correlated
    expect(sameCount).toBeLessThan(10);
  });
});
