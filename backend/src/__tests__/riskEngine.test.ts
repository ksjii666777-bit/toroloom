/**
 * ============================================================================
 * Toroloom Risk Engine — Unit Tests
 * ============================================================================
 *
 * Tests the core algorithmic paths of the Financial Bodyguard:
 *   1. Normal trading — actions allowed when no limit breached
 *   2. Daily loss limit breach — triggers lockdown
 *   3. Exit actions during lockdown — ALWAYS allowed
 *   4. Buy actions during lockdown — BLOCKED
 *   5. Settings freeze during lockdown — updates rejected
 *   6. 24-hour auto-release — lockdown lifts after timer expires
 *   7. Position size limit — large orders blocked
 *   8. Daily MTM rotation — new day resets tracking
 *
 * Run: npx vitest run --reporter=verbose
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import {
  RiskEngine,
  riskEngine,
  OrderActionType,
  LockdownStatus,
  RiskDecision,
} from '../services/riskEngine';

// Helper to create a stock context
function buyContext(overrides = {}) {
  return {
    actionType: OrderActionType.BUY,
    symbol: 'RELIANCE',
    quantity: 10,
    price: 2890,
    productType: 'CNC' as const,
    portfolioValue: 1000000,
    ...overrides,
  };
}

function sellContext(overrides = {}) {
  return {
    actionType: OrderActionType.SELL,
    symbol: 'RELIANCE',
    quantity: 10,
    price: 2900,
    productType: 'CNC' as const,
    portfolioValue: 1000000,
    currentPosition: { quantity: 50, avgPrice: 2700 },
    ...overrides,
  };
}

function squareOffContext(overrides = {}) {
  return {
    actionType: OrderActionType.SQUARE_OFF,
    symbol: 'RELIANCE',
    quantity: 10,
    price: 2900,
    productType: 'CNC' as const,
    portfolioValue: 1000000,
    ...overrides,
  };
}

describe('RiskEngine — Financial Bodyguard', () => {
  let engine: RiskEngine;
  const testUserId = 'test_user_1';

  beforeEach(() => {
    engine = new RiskEngine();
    engine.setPortfolioValue(testUserId, 1000000); // ₹10L portfolio
  });

  afterEach(() => {
    // Reset daily tracking
    engine.resetDaily(testUserId);
  });

  // ==================== Normal Trading ====================

  it('should allow buy orders when no limits are breached', () => {
    const result = engine.evaluate(testUserId, buyContext());
    expect(result.allowed).toBe(true);
    expect(result.decision).toBe(RiskDecision.ALLOWED);
  });

  it('should allow sell orders when no limits are breached', () => {
    // Sell with an existing position is treated as an exit (EXIT_ALLOWED)
    const result = engine.evaluate(testUserId, sellContext());
    expect(result.allowed).toBe(true);
    expect(result.decision).toBe(RiskDecision.EXIT_ALLOWED);
  });

  it('should allow square-off orders when no limits are breached', () => {
    const result = engine.evaluate(testUserId, squareOffContext());
    expect(result.allowed).toBe(true);
    expect(result.decision).toBe(RiskDecision.EXIT_ALLOWED);
  });

  // ==================== Daily Loss Limit Breach ====================

  it('should trigger lockdown when daily loss limit is breached', () => {
    // Record a trade that pushes loss over ₹50k limit
    engine.recordTrade(testUserId, -60000, 100, true);

    // Now any non-exit action should be blocked
    const result = engine.evaluate(testUserId, buyContext());
    expect(result.allowed).toBe(false);
    expect(result.decision).toBe(RiskDecision.BLOCKED_LOCKDOWN);
    expect(result.currentState.lockdown).toBe(LockdownStatus.ACTIVE);
  });

  it('should trigger lockdown when daily loss percent limit is breached', () => {
    // Set a low loss limit
    engine.updateLimits(testUserId, { dailyLossPercentLimit: 2 });
    // Record a trade that pushes loss over 2% of ₹10L portfolio
    engine.recordTrade(testUserId, -25000, 100, true);

    const result = engine.evaluate(testUserId, buyContext());
    expect(result.allowed).toBe(false);
    // The decision is BLOCKED_LOSS_LIMIT because the loss limit was breached
    // (this triggers the lockdown, but the decision reflects the trigger reason)
    expect(result.decision).toBe(RiskDecision.BLOCKED_LOSS_LIMIT);
    // But the lockdown IS active now
    expect(result.currentState.lockdown).toBe(LockdownStatus.ACTIVE);
  });

  // ==================== Exit Actions During Lockdown ====================

  it('should ALLOW square-off orders during lockdown (exit exception)', () => {
    // Trigger lockdown
    engine.recordTrade(testUserId, -60000, 100, true);

    // Square-off must be allowed
    const result = engine.evaluate(testUserId, squareOffContext());
    expect(result.allowed).toBe(true);
    expect(result.decision).toBe(RiskDecision.EXIT_ALLOWED);
  });

  it('should ALLOW sell orders that reduce positions during lockdown', () => {
    // Trigger lockdown
    engine.recordTrade(testUserId, -60000, 100, true);

    // Selling an existing position is an exit
    const result = engine.evaluate(testUserId, sellContext());
    expect(result.allowed).toBe(true);
    expect(result.decision).toBe(RiskDecision.EXIT_ALLOWED);
  });

  it('should BLOCK buy orders during lockdown', () => {
    // Trigger lockdown
    engine.recordTrade(testUserId, -60000, 100, true);

    const result = engine.evaluate(testUserId, buyContext());
    expect(result.allowed).toBe(false);
    expect(result.decision).toBe(RiskDecision.BLOCKED_LOCKDOWN);
  });

  it('should BLOCK modify orders during lockdown', () => {
    // Trigger lockdown
    engine.recordTrade(testUserId, -60000, 100, true);

    const result = engine.evaluate(testUserId, {
      actionType: OrderActionType.MODIFY,
      symbol: 'RELIANCE',
      portfolioValue: 1000000,
    });
    expect(result.allowed).toBe(false);
    expect(result.decision).toBe(RiskDecision.BLOCKED_LOCKDOWN);
  });

  // ==================== Settings Freeze ====================

  it('should freeze risk settings during lockdown', () => {
    // Trigger lockdown
    engine.recordTrade(testUserId, -60000, 100, true);

    const updateResult = engine.updateLimits(testUserId, { dailyLossLimit: 100000 });
    expect(updateResult.success).toBe(false);
    expect(updateResult.message).toContain('frozen');
  });

  it('should allow settings updates when not in lockdown', () => {
    const updateResult = engine.updateLimits(testUserId, { dailyLossLimit: 100000 });
    expect(updateResult.success).toBe(true);
  });

  // ==================== Position Size Limits ====================

  it('should block orders that exceed max position size', () => {
    engine.updateLimits(testUserId, { maxPositionSizePercent: 5 });

    // 100 shares @ ₹2890 = ₹289,000 which is > 5% of ₹10L (₹50,000)
    const result = engine.evaluate(testUserId, buyContext({ quantity: 100 }));
    expect(result.allowed).toBe(false);
    expect(result.decision).toBe(RiskDecision.BLOCKED_POSITION_SIZE);
  });

  it('should allow orders within position size limits', () => {
    engine.updateLimits(testUserId, { maxPositionSizePercent: 30 });

    // 10 shares @ ₹2890 = ₹28,900 which is < 30% of ₹10L (₹3L)
    const result = engine.evaluate(testUserId, buyContext({ quantity: 10 }));
    expect(result.allowed).toBe(true);
  });

  // ==================== Daily MTM Rotation ====================

  it('should reset daily MTM tracking for a new day', () => {
    // This simulates that the stored date is yesterday
    engine.recordTrade(testUserId, -10000, 50, true);

    // Access profile and force date to yesterday
    const profile = engine.getProfile(testUserId);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    profile.today.date = yesterday.toISOString().split('T')[0];

    // Trigger rotation by evaluating an action
    engine.evaluate(testUserId, buyContext());

    // After rotation, daily P&L should be reset
    expect(profile.today.realizedPnL).toBe(0);
    expect(profile.today.unrealizedPnL).toBe(0);
    expect(profile.today.tradeCount).toBe(0);
  });

  // ==================== Real-time Unrealized P&L ====================

  it('should trigger lockdown when unrealized P&L breaches limit', () => {
    engine.updateUnrealizedPnL(testUserId, -60000);

    const result = engine.evaluate(testUserId, buyContext());
    expect(result.allowed).toBe(false);
    expect(result.decision).toBe(RiskDecision.BLOCKED_LOCKDOWN);
  });

  it('should not trigger lockdown from unrealized profit (positive P&L)', () => {
    engine.updateUnrealizedPnL(testUserId, 60000);

    const result = engine.evaluate(testUserId, buyContext());
    expect(result.allowed).toBe(true);
    expect(result.decision).toBe(RiskDecision.ALLOWED);
  });

  // ==================== Full App State Snapshot ====================

  it('should return a complete risk state snapshot', () => {
    const state = engine.getState(testUserId);
    expect(state).toHaveProperty('userId', testUserId);
    expect(state).toHaveProperty('lockdown');
    expect(state).toHaveProperty('today');
    expect(state).toHaveProperty('limits');
    expect(state).toHaveProperty('settingsFrozen', false);
    expect(state.lockdown.status).toBe(LockdownStatus.NONE);
  });
});

// ==================== Reset For Testing ====================

describe('RiskEngine — resetForTesting()', () => {
  let engine: RiskEngine;
  const userA = 'reset_test_user_a';
  const userB = 'reset_test_user_b';

  beforeEach(() => {
    engine = new RiskEngine();
  });

  afterAll(async () => {
    // Use the singleton to prevent cross-file state contamination
    await riskEngine.resetForTesting();
  });

  it('should clear all profiles so getProfile() returns fresh defaults', async () => {
    // Set state for 2 users
    engine.setPortfolioValue(userA, 500_000);
    engine.setPortfolioValue(userB, 1_000_000);
    engine.updateLimits(userA, { dailyLossLimit: 99_999 });
    engine.recordTrade(userA, -10_000, 50, true);

    // Verify state exists before reset
    expect(engine.getProfile(userA).portfolioValueAtOpen).toBe(500_000);
    expect(engine.getProfile(userB).portfolioValueAtOpen).toBe(1_000_000);
    expect(engine.getProfile(userA).limits.dailyLossLimit).toBe(99_999);
    expect(engine.getProfile(userA).today.tradeCount).toBe(1);

    await engine.resetForTesting();

    // After reset, getProfile() should return fresh defaults
    const freshA = engine.getProfile(userA);
    expect(freshA.portfolioValueAtOpen).toBe(0);
    expect(freshA.limits.dailyLossLimit).not.toBe(99_999);
    expect(freshA.today.tradeCount).toBe(0);
    expect(freshA.settingsFrozen).toBe(false);
    expect(freshA.lockdown.status).toBe(LockdownStatus.NONE);

    const freshB = engine.getProfile(userB);
    expect(freshB.portfolioValueAtOpen).toBe(0);
  });

  it('should be idempotent when called on a clean engine', async () => {
    // No state has been set up
    await engine.resetForTesting();

    // Should still work fine — profiles are empty, drain resolves immediately
    const profile = engine.getProfile('fresh_user');
    expect(profile.portfolioValueAtOpen).toBe(0);
    expect(profile.lockdown.status).toBe(LockdownStatus.NONE);

    // Can be called again with no side effects
    await engine.resetForTesting();
    const stillFresh = engine.getProfile('fresh_user');
    expect(stillFresh.portfolioValueAtOpen).toBe(0);
  });

  it('should clear user locks so concurrent operations work after reset', async () => {
    // The getLock() method is private, but we can verify behavior through
    // the async methods that acquire ReadWrite locks.

    // 1. Create a profile via setPortfolioValue (triggers persistProfile but
    //    doesn't acquire a lock — the lock is created lazily by getLock())
    engine.setPortfolioValue(userA, 100_000);

    // 2. Reset — this should clear the lock map entirely
    await engine.resetForTesting();

    // 3. After reset, the async lock-based path should work.
    //    evaluateAsync() acquires a read lock; if the lock was stale/corrupt,
    //    it would hang or throw.
    engine.setPortfolioValue(userA, 200_000);
    const result = await engine.evaluateAsync(userA, {
      actionType: OrderActionType.BUY,
      symbol: 'TCS',
      quantity: 10,
      price: 1000,
      portfolioValue: 200_000,
    });
    expect(result.allowed).toBe(true);

    // Verify the fresh state was used (not stale cached state from before reset)
    expect(engine.getProfile(userA).portfolioValueAtOpen).toBe(200_000);
  });

  it('should clear storage reference so configureStorage is required again', async () => {
    // Create a mock storage that records calls
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const mockLoad = vi.fn().mockResolvedValue(null);
    const mockStorage = {
      saveRiskProfile: mockSave,
      loadRiskProfile: mockLoad,
    } as any;

    engine.configureStorage(mockStorage);

    // Trigger a persist by mutating state
    engine.setPortfolioValue(userA, 300_000);

    // After reset, storage should be cleared
    await engine.resetForTesting();

    // Trigger another mutation — should NOT call saveRiskProfile since storage is null
    mockSave.mockClear();
    engine.setPortfolioValue(userA, 400_000);
    expect(mockSave).not.toHaveBeenCalled();

    // Re-configure storage and verify it works again
    engine.configureStorage(mockStorage);
    engine.setPortfolioValue(userA, 500_000);
    // After recordTrade+await persists, the drain ensures it completed
    // Wait for the pending persist to complete
    await engine.drain(userA);
    expect(mockSave).toHaveBeenCalled();
  });

  it('should clear pendingPersists so drain() resolves immediately', async () => {
    // Set up state to create pending persists
    engine.setPortfolioValue(userA, 100_000);
    engine.setPortfolioValue(userB, 200_000);

    // Reset clears pendingPersists
    await engine.resetForTesting();

    // drain() should resolve immediately since pendingPersists is empty
    await expect(engine.drain()).resolves.toBeUndefined();
    await expect(engine.drain(userA)).resolves.toBeUndefined();
    await expect(engine.drain(userB)).resolves.toBeUndefined();
  });

  it('should allow full re-initialization after reset', async () => {
    // Full lifecycle: initialize → use → reset → re-initialize
    engine.setPortfolioValue(userA, 1_000_000);
    engine.recordTrade(userA, -10_000, 50, true);
    expect(engine.getProfile(userA).today.tradeCount).toBe(1);

    await engine.resetForTesting();

    // Re-initialize from scratch
    engine.setPortfolioValue(userA, 500_000);
    engine.recordTrade(userA, -5_000, 25, true);

    // Should work with fresh state
    expect(engine.getProfile(userA).portfolioValueAtOpen).toBe(500_000);
    expect(engine.getProfile(userA).today.tradeCount).toBe(1);
    expect(engine.getProfile(userA).today.realizedPnL).toBe(-5_000);
  });
});

// ==================== Concurrent evaluateAsync Calls ====================

describe('RiskEngine — Concurrent evaluateAsync', () => {
  let engine: RiskEngine;
  const userId = 'concurrent_test_user';

  beforeEach(() => {
    engine = new RiskEngine();
    engine.setPortfolioValue(userId, 1_000_000);
  });

  afterEach(() => {
    engine.resetDaily(userId);
  });

  afterAll(async () => {
    await riskEngine.resetForTesting();
  });

  it('should allow multiple concurrent evaluateAsync calls to resolve', async () => {
    // Fires 10 concurrent evaluateAsync calls — the ReadWriteLock allows
    // multiple readers simultaneously, so all should resolve without blocking.
    const promises = Array.from({ length: 10 }, (_, i) =>
      engine.evaluateAsync(userId, {
        actionType: OrderActionType.BUY,
        symbol: `STOCK_${i}`,
        quantity: 10,
        price: 1000 + i,
        portfolioValue: 1_000_000,
      }),
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    results.forEach((r, i) => {
      expect(r.allowed).toBe(true);
      expect(r.decision).toBe(RiskDecision.ALLOWED);
    });
  });

  it('should allow concurrent evaluateAsync calls during position size limits', async () => {
    engine.updateLimits(userId, { maxPositionSizePercent: 5 });

    // 6 concurrent calls, half within limits and half exceeding
    const contexts = [
      { quantity: 10, price: 1000, expectedAllowed: true },   // ₹10k < 5% of ₹10L (₹50k)
      { quantity: 30, price: 1000, expectedAllowed: true },   // ₹30k < ₹50k
      { quantity: 49, price: 1000, expectedAllowed: true },   // ₹49k < ₹50k
      { quantity: 51, price: 1000, expectedAllowed: false },  // ₹51k > ₹50k
      { quantity: 100, price: 1000, expectedAllowed: false }, // ₹1L > ₹50k
      { quantity: 500, price: 1000, expectedAllowed: false }, // ₹5L > ₹50k
    ];

    const promises = contexts.map((ctx) =>
      engine.evaluateAsync(userId, {
        actionType: OrderActionType.BUY,
        symbol: 'RELIANCE',
        quantity: ctx.quantity,
        price: ctx.price,
        portfolioValue: 1_000_000,
      }).then((result) => ({ result, expected: ctx.expectedAllowed })),
    );

    const results = await Promise.all(promises);
    results.forEach(({ result, expected }) => {
      expect(result.allowed).toBe(expected);
      if (expected) {
        expect(result.decision).toBe(RiskDecision.ALLOWED);
      } else {
        expect(result.decision).toBe(RiskDecision.BLOCKED_POSITION_SIZE);
      }
    });
  });

  it('should allow recordTradeAsync to run concurrently with evaluateAsync', async () => {
    // Start a write (recordTradeAsync) and read (evaluateAsync) concurrently.
    // The write lock should not cause a deadlock with the read lock.
    const [tradeResult, evalResult] = await Promise.all([
      engine.recordTradeAsync(userId, -10_000, 50, true),
      engine.evaluateAsync(userId, buyContext({ symbol: 'TCS' })),
    ]);

    expect(tradeResult).toBeUndefined();
    expect(evalResult.allowed).toBe(true);
  });

  it('should maintain consistent state after concurrent recordTradeAsync calls', async () => {
    // Fire 5 concurrent recordTradeAsync calls — the write lock serializes them.
    const trades = Array.from({ length: 5 }, (_, i) =>
      engine.recordTradeAsync(userId, -5_000 * (i + 1), 25 * (i + 1), true),
    );

    await Promise.all(trades);

    // After all trades complete, verify the state is consistent
    const state = engine.getState(userId);
    // Trade count should be exactly 5
    expect(state.today.tradeCount).toBe(5);
    // Realized P&L should be sum of all impacts: -(5k + 10k + 15k + 20k + 25k) = -75k
    expect(state.today.realizedPnL).toBe(-75_000);
    // Charges should be sum: 25 + 50 + 75 + 100 + 125 = 375
    expect(state.today.totalCharges).toBe(375);
  });

  it('should allow evaluateAsync during an active write lock', async () => {
    // Start a long-running recordTradeAsync (simulated by chaining work)
    const writePromise = engine.recordTradeAsync(userId, -10_000, 50, true);

    // While the write is in progress, fire an evaluateAsync
    // The evaluate should either complete (read lock granted) or wait and
    // complete after the write. Either way, no deadlock.
    const readPromise = engine.evaluateAsync(userId, buyContext({ symbol: 'TCS' }));

    const [evalResult] = await Promise.all([readPromise, writePromise]);
    expect(evalResult.allowed).toBe(true);
  });
});

// ==================== Lockdown Auto-Expiry ====================

describe('RiskEngine — Lockdown Auto-Expiry', () => {
  let engine: RiskEngine;
  const userId = 'expiry_test_user';

  beforeEach(() => {
    engine = new RiskEngine();
    engine.setPortfolioValue(userId, 1_000_000);
  });

  afterEach(() => {
    engine.resetDaily(userId);
  });

  afterAll(async () => {
    await riskEngine.resetForTesting();
  });

  it('should keep lockdown active when liftsAt is in the future', () => {
    engine.recordTrade(userId, -60_000, 100, true);
    expect(engine.getState(userId).lockdown.status).toBe(LockdownStatus.ACTIVE);

    // The lockdown expires when Date.now() >= liftsAt.
    // Since liftsAt is 24h in the future, this should still be active.
    const evalResult = engine.evaluate(userId, buyContext());
    expect(evalResult.allowed).toBe(false);
    expect(evalResult.currentState.lockdown).toBe(LockdownStatus.ACTIVE);
    expect(evalResult.currentState.settingsFrozen).toBe(true);
  });

  it('should auto-release lockdown via getProfile when liftsAt is in the past', () => {
    // Trigger lockdown
    engine.recordTrade(userId, -60_000, 100, true);
    expect(engine.getState(userId).lockdown.status).toBe(LockdownStatus.ACTIVE);

    // Manually set liftsAt to the past to simulate 24h+ expiry
    const profile = engine.getProfile(userId);
    profile.lockdown.liftsAt = new Date(Date.now() - 1000).toISOString();

    // getState() calls reconcileLockdownState() which detects expiry
    // and releases the lockdown
    const state = engine.getState(userId);
    expect(state.lockdown.status).toBe(LockdownStatus.NONE);
    expect(state.settingsFrozen).toBe(false);
  });

  it('should auto-release lockdown via evaluate when liftsAt is in the past', () => {
    // Trigger lockdown
    engine.recordTrade(userId, -60_000, 100, true);
    expect(engine.getState(userId).lockdown.status).toBe(LockdownStatus.ACTIVE);

    // Manually set liftsAt to the past to simulate 24h+ expiry
    const profile = engine.getProfile(userId);
    profile.lockdown.liftsAt = new Date(Date.now() - 1000).toISOString();

    // Increase both dailyLossLimit AND dailyLossPercentLimit so the
    // loss from the original trade (₹60k = 6% of ₹10L) doesn't
    // re-trigger lockdown during evaluate(). The default percent
    // limit is 5%, which would re-lock immediately.
    profile.limits.dailyLossLimit = 100_000;
    profile.limits.dailyLossPercentLimit = 10;

    // evaluate() calls reconcileLockdownState() which releases the
    // expired lockdown, then checks loss limits (now 100k > 60k loss → OK)
    const result = engine.evaluate(userId, buyContext());
    expect(result.allowed).toBe(true);
    expect(result.currentState.lockdown).toBe(LockdownStatus.NONE);
    expect(result.currentState.settingsFrozen).toBe(false);
  });

  it('should remain in lockdown with frozen settings before liftsAt', () => {
    // Trigger lockdown
    engine.recordTrade(userId, -60_000, 100, true);

    // Don't change liftsAt — it's still 24h in the future
    const updateResult = engine.updateLimits(userId, { dailyLossLimit: 100_000 });
    expect(updateResult.success).toBe(false);
    expect(updateResult.message).toContain('frozen');

    const state = engine.getState(userId);
    expect(state.lockdown.status).toBe(LockdownStatus.ACTIVE);
  });
});

// ==================== Negative and Edge Limit Values ====================

describe('RiskEngine — Edge Limit Values', () => {
  let engine: RiskEngine;
  const userId = 'edge_limits_user';

  beforeEach(() => {
    engine = new RiskEngine();
    engine.setPortfolioValue(userId, 1_000_000);
  });

  afterEach(() => {
    engine.resetDaily(userId);
  });

  afterAll(async () => {
    await riskEngine.resetForTesting();
  });

  it('should allow setting dailyLossLimit to 0', () => {
    const result = engine.updateLimits(userId, { dailyLossLimit: 0 });
    expect(result.success).toBe(true);

    // With limit = 0, any loss should trigger lockdown
    engine.recordTrade(userId, -1, 0, true);
    const state = engine.getState(userId);
    expect(state.lockdown.status).toBe(LockdownStatus.ACTIVE);
  });

  it('should allow setting dailyLossLimit to a very large number', () => {
    const hugeLimit = 10_000_000_000; // ₹10B — effectively unlimited
    const result = engine.updateLimits(userId, { dailyLossLimit: hugeLimit });
    expect(result.success).toBe(true);

    // Large loss still within limit
    engine.recordTrade(userId, -500_000, 100, true);
    const state = engine.getState(userId);
    expect(state.lockdown.status).toBe(LockdownStatus.NONE);
  });

  it('should allow setting dailyLossPercentLimit to 0', () => {
    const result = engine.updateLimits(userId, { dailyLossPercentLimit: 0 });
    expect(result.success).toBe(true);

    // The dailyLossPercentLimit check is evaluated in evaluate(), not in
    // recordTrade(). Record a loss first, then call evaluate() to trigger
    // the percent-based check.
    engine.recordTrade(userId, -10_000, 0, true);

    // evaluate() checks both dailyLossLimit AND dailyLossPercentLimit.
    // With dailyLossPercentLimit=0, any loss percent >= 0 triggers lockdown.
    const evalResult = engine.evaluate(userId, buyContext({ symbol: 'TCS' }));
    expect(evalResult.allowed).toBe(false);
    expect(evalResult.decision).toBe(RiskDecision.BLOCKED_LOSS_LIMIT);

    const state = engine.getState(userId);
    expect(state.lockdown.status).toBe(LockdownStatus.ACTIVE);
  });

  it('should allow setting maxPositionSizePercent to 0 (blocks all orders)', () => {
    const result = engine.updateLimits(userId, { maxPositionSizePercent: 0 });
    expect(result.success).toBe(true);

    // Any order value > 0 should exceed 0% of portfolio
    const evalResult = engine.evaluate(userId, buyContext({ quantity: 1, price: 100 }));
    expect(evalResult.allowed).toBe(false);
    expect(evalResult.decision).toBe(RiskDecision.BLOCKED_POSITION_SIZE);
  });

  it('should allow setting maxPositionSizePercent to 100 (entire portfolio)', () => {
    const result = engine.updateLimits(userId, { maxPositionSizePercent: 100 });
    expect(result.success).toBe(true);

    // Order for the entire portfolio value should be within limit
    // 100 shares @ ₹10,000 = ₹1,000,000 = 100% of ₹10L
    const evalResult = engine.evaluate(userId, buyContext({ quantity: 100, price: 10_000 }));
    expect(evalResult.allowed).toBe(true);
  });

  it('should handle very small order values (₹1)', () => {
    engine.updateLimits(userId, { maxPositionSizePercent: 0.01 }); // 0.01% = ₹100

    // ₹1 order — well within 0.01% of ₹10L (₹100)
    const evalResult = engine.evaluate(userId, buyContext({ quantity: 1, price: 1 }));
    expect(evalResult.allowed).toBe(true);
  });

  it('should clamp negative trade impacts correctly', () => {
    // Record a large negative P&L several times — ensures no overflow
    for (let i = 0; i < 100; i++) {
      engine.recordTrade(userId, -1_000_000, 500, true);
    }

    const state = engine.getState(userId);
    // Total loss should be accurate: -100M per trade * 100 trades = -10B
    expect(state.today.realizedPnL).toBe(-100_000_000);
    // Trade count should be 100
    expect(state.today.tradeCount).toBe(100);
    // Lockdown should have triggered on the first trade
    expect(state.lockdown.status).toBe(LockdownStatus.ACTIVE);
  });

  it('should allow zero charges and zero P&L impact', () => {
    engine.recordTrade(userId, 0, 0, true);

    const state = engine.getState(userId);
    expect(state.today.realizedPnL).toBe(0);
    expect(state.today.totalCharges).toBe(0);
    expect(state.today.tradeCount).toBe(1);
    expect(state.lockdown.status).toBe(LockdownStatus.NONE);
  });

  it('should handle extremely large positive P&L', () => {
    engine.recordTrade(userId, 100_000_000, 1_000, true); // ₹10Cr profit

    const state = engine.getState(userId);
    expect(state.today.realizedPnL).toBe(100_000_000);
    expect(state.today.tradeCount).toBe(1);
    // Large profit should not trigger lockdown
    expect(state.lockdown.status).toBe(LockdownStatus.NONE);
  });
});
