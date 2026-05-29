/**
 * ============================================================================
 * Toroloom Order Execution Pipeline — Integration Tests
 * ============================================================================
 *
 * Tests the FULL 5-stage pipeline from end to end:
 *   1. RiskEngine.evaluate()      — Financial Bodyguard
 *   2. HookRegistry.runPreOrder() — Custom feature hooks
 *   3. Broker.placeOrder()        — Actual execution
 *   4. RiskEngine.recordTrade()   — MTM update
 *   5. HookRegistry.runPostOrder() — Post-execution hooks
 *
 * IMPORTANT: All tests MUST use the singleton `riskEngine` because
 * `OrderExecutionPipeline` imports and uses that singleton internally.
 * Creating a local `new RiskEngine()` would be a separate instance that
 * the pipeline never sees — causing silent false passes or fails.
 *
 * Also tests:
 *   - Risk Engine blocking (loss limit breach, position size limit)
 *   - Lockdown enforcement (exit-only mode)
 *   - Exit exception (SQUARE_OFF always allowed during lockdown)
 *   - Pre-order hooks blocking orders
 *   - Trade recording (MTM update, trade count)
 *
 * Run: npx vitest run --reporter=verbose
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  OrderExecutionPipeline,
} from '../services/orderExecution';
import {
  riskEngine,
  OrderActionType,
  LockdownStatus,
  RiskDecision,
} from '../services/riskEngine';
import {
  hookRegistry,
  PreOrderExecutionHook,
} from '../middleware/customHooks/OrderHookTypes';

// ==================== Helpers ====================

const testUserId = 'order_test_user_1';

function buyParams(overrides = {}) {
  return {
    userId: testUserId,
    actionType: OrderActionType.BUY,
    symbol: 'RELIANCE',
    quantity: 10,
    price: 2890,
    exchange: 'NSE',
    productType: 'CNC' as const,
    orderType: 'MARKET' as const,
    ...overrides,
  };
}

function sellParams(overrides = {}) {
  return {
    userId: testUserId,
    actionType: OrderActionType.SELL,
    symbol: 'RELIANCE',
    quantity: 10,
    price: 2900,
    exchange: 'NSE',
    productType: 'CNC' as const,
    orderType: 'MARKET' as const,
    ...overrides,
  };
}

function squareOffParams(overrides = {}) {
  return {
    userId: testUserId,
    actionType: OrderActionType.SQUARE_OFF,
    symbol: 'RELIANCE',
    quantity: 10,
    price: 2900,
    exchange: 'NSE',
    productType: 'CNC' as const,
    orderType: 'MARKET' as const,
    ...overrides,
  };
}

// ==================== Test Suite ====================

describe('OrderExecutionPipeline — Full 5-Stage Pipeline', () => {
  let pipeline: OrderExecutionPipeline;

  beforeEach(() => {
    pipeline = new OrderExecutionPipeline();
    // Use the singleton riskEngine — same instance the pipeline imports.
    riskEngine.setPortfolioValue(testUserId, 1000000); // ₹10L portfolio
    // Reset limits to defaults to prevent bleeding between tests
    riskEngine.updateLimits(testUserId, {
      dailyLossLimit: 50000,
      dailyLossPercentLimit: 5,
      maxPositionSizePercent: 10,
      maxLeverage: 1,
    });
  });

  afterEach(() => {
    riskEngine.resetDaily(testUserId);
    // Hard-reset all lock state so subsequent tests start clean
    const profile = riskEngine.getProfile(testUserId);
    profile.settingsFrozen = false;
    profile.settingsFrozenUntil = null;
    profile.lockdown = {
      status: LockdownStatus.NONE,
      triggeredAt: null,
      liftsAt: null,
      triggerLoss: null,
      breachedLimit: null,
    };
    // Clean up any hooks registered during tests
    (hookRegistry as any).hooks = {
      preOrderExecution: [],
      postOrderExecution: [],
      orderError: [],
    };
  });

  // ==================== Stage 1: Risk Engine ====================

  it('should ALLOW a buy order when all risk checks pass', async () => {
    const result = await pipeline.execute(buyParams());
    expect(result.success).toBe(true);
    expect(result.orderId).toBeDefined();
    expect(result.riskEvaluation.allowed).toBe(true);
  });

  it('should BLOCK a buy order when daily loss limit is breached', async () => {
    // Record a loss on the singleton — the same instance the pipeline uses
    riskEngine.recordTrade(testUserId, -60000, 100, true);

    const result = await pipeline.execute(buyParams());
    expect(result.success).toBe(false);
    expect(result.riskEvaluation.allowed).toBe(false);
    expect(result.riskEvaluation.decision).toBe(RiskDecision.BLOCKED_LOCKDOWN);
    expect(result.message).toContain('Lockdown');
  });

  it('should BLOCK a buy order exceeding position size limit', async () => {
    // Set a tight limit on the singleton
    riskEngine.updateLimits(testUserId, { maxPositionSizePercent: 2 });

    // 100 shares @ ₹2890 = ₹2,89,000 >> 2% of ₹10L (₹20k)
    const result = await pipeline.execute(buyParams({ quantity: 100 }));
    expect(result.success).toBe(false);
    expect(result.riskEvaluation.decision).toBe(RiskDecision.BLOCKED_POSITION_SIZE);
    expect(result.message).toContain('exceeds max position size');
  });

  // ==================== Stage 2: Exit Exception ====================

  it('should ALLOW SQUARE_OFF orders during lockdown (exit exception)', async () => {
    riskEngine.recordTrade(testUserId, -60000, 100, true);

    const result = await pipeline.execute(squareOffParams());
    expect(result.success).toBe(true);
    expect(result.riskEvaluation.allowed).toBe(true);
    expect(result.riskEvaluation.decision).toBe(RiskDecision.EXIT_ALLOWED);
  });

  it('should ALLOW SELL orders that reduce existing positions during lockdown', async () => {
    riskEngine.recordTrade(testUserId, -60000, 100, true);

    // Pass currentPosition to signal this SELL closes an existing long position
    const result = await pipeline.execute(sellParams({
      quantity: 5,
      currentPosition: { quantity: 10, avgPrice: 2850 },
    }));
    expect(result.success).toBe(true);
    expect(result.riskEvaluation.allowed).toBe(true);
    expect(result.riskEvaluation.decision).toBe(RiskDecision.EXIT_ALLOWED);
  });

  // ==================== Stage 3: Custom Hooks ====================

  it('should BLOCK an order when a pre-order custom hook blocks it', async () => {
    const blockLargeOrders: PreOrderExecutionHook = {
      name: 'Large Order Blocker',
      async execute(context) {
        const { quantity, price } = context.order;
        if (quantity && price && quantity * price > 500000) {
          return {
            hookName: 'Large Order Blocker',
            blocked: true,
            reason: 'Order value exceeds ₹5L threshold',
          };
        }
        return { hookName: 'Large Order Blocker', blocked: false };
      },
    };

    hookRegistry.register('preOrderExecution', blockLargeOrders);

    // Set position limit high so risk engine passes, letting the hook decide
    // Portfolio ₹10L, 70% = ₹7L max position. 200 @ ₹3,000 = ₹6L < ₹7L → passes risk
    riskEngine.updateLimits(testUserId, { maxPositionSizePercent: 70 });

    // 200 shares @ ₹3,000 = ₹6,00,000 > ₹5L → blocked by hook (not risk engine)
    const result = await pipeline.execute(buyParams({ quantity: 200, price: 3000 }));
    expect(result.success).toBe(false);
    expect(result.hookBlocked).toBeDefined();
    expect(result.hookBlocked!.hookName).toBe('Large Order Blocker');
    expect(result.hookBlocked!.reason).toContain('₹5L');
  });

  it('should ALLOW an order when pre-order hooks pass', async () => {
    const loggingHook: PreOrderExecutionHook = {
      name: 'Trade Logger',
      async execute(_context) {
        return { hookName: 'Trade Logger', blocked: false };
      },
    };

    hookRegistry.register('preOrderExecution', loggingHook);

    const result = await pipeline.execute(buyParams());
    expect(result.success).toBe(true);
    expect(result.hookBlocked).toBeUndefined();
  });

  // ==================== Stage 4 & 5: Trade Recording ====================

  it('should record the trade in RiskEngine after successful execution', async () => {
    const preState = riskEngine.getState(testUserId);
    expect(preState.today.tradeCount).toBe(0);

    // Execute a SELL to produce realized P&L (BUY records unrealized)
    const result = await pipeline.execute(sellParams());
    expect(result.success).toBe(true);

    const postState = riskEngine.getState(testUserId);
    expect(postState.today.tradeCount).toBe(1);
    // Selling adds cash → positive realized P&L
    expect(postState.today.realizedPnL).toBeGreaterThan(0);
  });

  it('should increase trade count with each order', async () => {
    await pipeline.execute(buyParams({ quantity: 5 }));
    await pipeline.execute(buyParams({ quantity: 3, symbol: 'TCS', price: 3890 }));

    const state = riskEngine.getState(testUserId);
    expect(state.today.tradeCount).toBe(2);
  });

  // ==================== Lockdown State Persistence ====================

  it('should freeze risk settings after a lockdown-triggering trade', async () => {
    riskEngine.recordTrade(testUserId, -55000, 100, true);

    const result = await pipeline.execute(buyParams());
    expect(result.success).toBe(false);

    const state = riskEngine.getState(testUserId);
    expect(state.settingsFrozen).toBe(true);
    expect(state.lockdown.status).toBe(LockdownStatus.ACTIVE);
    expect(state.lockdown.liftsAt).toBeTruthy();
  });

  // ==================== Multiple Hook Execution ====================

  it('should run all registered pre-order hooks sequentially', async () => {
    const executionOrder: string[] = [];

    // Relax position limit so the risk engine doesn't block before hooks run
    riskEngine.updateLimits(testUserId, { maxPositionSizePercent: 50 });

    hookRegistry.register('preOrderExecution', {
      name: 'Hook One',
      async execute() {
        executionOrder.push('hook1');
        return { hookName: 'Hook One', blocked: false };
      },
    });

    hookRegistry.register('preOrderExecution', {
      name: 'Hook Two',
      async execute() {
        executionOrder.push('hook2');
        return { hookName: 'Hook Two', blocked: false };
      },
    });

    await pipeline.execute(buyParams());
    expect(executionOrder).toEqual(['hook1', 'hook2']);
  });

  it('should stop executing hooks when one blocks the order', async () => {
    let hook2Executed = false;

    hookRegistry.register('preOrderExecution', {
      name: 'Blocking Hook',
      async execute() {
        return { hookName: 'Blocking Hook', blocked: true, reason: 'Blocked for test' };
      },
    });

    hookRegistry.register('preOrderExecution', {
      name: 'After Block Hook',
      async execute() {
        hook2Executed = true;
        return { hookName: 'After Block Hook', blocked: false };
      },
    });

    await pipeline.execute(buyParams());
    expect(hook2Executed).toBe(false);
  });

  // ==================== User-Level Isolation ====================

  it('should maintain isolated risk state per user', async () => {
    const userA = 'isolated_user_a';
    const userB = 'isolated_user_b';

    riskEngine.setPortfolioValue(userA, 500000);
    riskEngine.setPortfolioValue(userB, 1000000);

    expect(riskEngine.getState(userA).portfolioValueAtOpen).toBe(500000);
    expect(riskEngine.getState(userB).portfolioValueAtOpen).toBe(1000000);
  });
});

// ==================== Full Lifecycle Integration ====================

describe('RiskEngine — Full Lifecycle Simulation', () => {
  const lifecycleUser = 'lifecycle_test_user';

  beforeEach(() => {
    riskEngine.setPortfolioValue(lifecycleUser, 1000000);
  });

  afterEach(() => {
    riskEngine.resetDaily(lifecycleUser);
    const profile = riskEngine.getProfile(lifecycleUser);
    profile.settingsFrozen = false;
    profile.settingsFrozenUntil = null;
    profile.lockdown = {
      status: LockdownStatus.NONE,
      triggeredAt: null,
      liftsAt: null,
      triggerLoss: null,
      breachedLimit: null,
    };
  });

  it('should progress through a full trading day lifecycle', () => {
    // 1. Morning: start fresh
    let state = riskEngine.getState(lifecycleUser);
    expect(state.lockdown.status).toBe(LockdownStatus.NONE);
    expect(state.today.tradeCount).toBe(0);

    // 2. Execute a few trades (cumulative)
    riskEngine.recordTrade(lifecycleUser, -15000, 100, true);  // Loss ₹15k
    riskEngine.recordTrade(lifecycleUser, 8000, 50, true);     // Profit ₹8k
    riskEngine.recordTrade(lifecycleUser, -10000, 75, true);   // Loss ₹10k

    state = riskEngine.getState(lifecycleUser);
    expect(state.today.tradeCount).toBe(3);
    expect(state.today.realizedPnL).toBe(-17000);
    expect(state.lockdown.status).toBe(LockdownStatus.NONE);   // Still within ₹50k limit

    // 3. Evaluate BUY — should be allowed
    expect(
      riskEngine.evaluate(lifecycleUser, {
        actionType: OrderActionType.BUY,
        symbol: 'INFY',
        quantity: 10,
        price: 1500,
        portfolioValue: 1000000,
      }).allowed,
    ).toBe(true);

    // 4. Push past the daily loss limit → lockdown
    riskEngine.recordTrade(lifecycleUser, -40000, 100, true);

    state = riskEngine.getState(lifecycleUser);
    expect(state.lockdown.status).toBe(LockdownStatus.ACTIVE);
    expect(state.settingsFrozen).toBe(true);

    // 5. BUY blocked during lockdown
    const buyCheck = riskEngine.evaluate(lifecycleUser, {
      actionType: OrderActionType.BUY,
      symbol: 'INFY',
      quantity: 10,
      price: 1500,
      portfolioValue: 1000000,
    });
    expect(buyCheck.allowed).toBe(false);
    expect(buyCheck.decision).toBe(RiskDecision.BLOCKED_LOCKDOWN);

    // 6. SQUARE_OFF still allowed during lockdown
    const exitCheck = riskEngine.evaluate(lifecycleUser, {
      actionType: OrderActionType.SQUARE_OFF,
      symbol: 'INFY',
      quantity: 10,
      price: 1500,
      portfolioValue: 1000000,
    });
    expect(exitCheck.allowed).toBe(true);
    expect(exitCheck.decision).toBe(RiskDecision.EXIT_ALLOWED);
  });
});
