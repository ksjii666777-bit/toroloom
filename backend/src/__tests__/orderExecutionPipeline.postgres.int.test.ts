/**
 * ============================================================================
 * Toroloom Order Execution Pipeline — PostgreSQL Integration
 * ============================================================================
 *
 * Validates that the full OrderExecutionPipeline persists risk profiles
 * to PostgreSQL after trade recording:
 *
 *   pipeline.execute() → riskEngine.recordTradeAsync() → persistProfile()
 *                                                              ↓
 *                                                    PostgreSQLStorage.saveRiskProfile()
 *
 * These tests go beyond the unit-level orderExecutionPipeline.test.ts by
 * verifying that risk profiles are actually PERSISTED to PostgreSQL after
 * trade recording — not just held in the in-memory cache.
 *
 * Scenarios:
 *   1. Buy order → profile persisted with negative unrealized P&L
 *   2. Sell order → profile persisted with positive realized P&L
 *   3. Multiple orders → trade count accumulates in DB
 *   4. Lockdown triggered → lockdown state persisted to DB
 *   5. Load from storage → profile loaded correctly on init
 *
 * Environment:
 *   DATABASE_URL — defaults to Docker Compose connection string
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/orderExecutionPipeline.postgres.int.test.ts
 *
 * Skip:
 *   Tests skip automatically if PostgreSQL is unreachable.
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  OrderExecutionPipeline,
} from '../services/orderExecution';
import {
  riskEngine,
  OrderActionType,
  LockdownStatus,
  RiskDecision,
  DEFAULT_RISK_LIMITS,
} from '../services/riskEngine';
import { PostgreSQLStorage } from '../services/storage/postgres';

// IMPORTANT: This test file must NOT run in parallel with other *.int.test.ts
// files that configure riskEngine (e.g. websocketPnLBridge.mongodb.int.test.ts)
// because they all share the same riskEngine singleton. Each file's
// configureStorage() overwrites the previous one. Run files individually or
// use vitest's --sequence.concurrent=false flag.

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://toroloom:toroloom_dev@localhost:5432/toroloom';

const TEST_USER = 'order_pg_int_user';
const LOAD_TEST_USER = 'order_pg_load_user';

// ──── Helpers ────────────────────────────────────────────────────────────────

function buyParams(overrides: Record<string, any> = {}) {
  return {
    userId: TEST_USER,
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

function sellParams(overrides: Record<string, any> = {}) {
  return {
    userId: TEST_USER,
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

let storage: PostgreSQLStorage;
let pipeline: OrderExecutionPipeline;
let available = true;

// ──── Test Suite ─────────────────────────────────────────────────────────────

describe('OrderExecutionPipeline — PostgreSQL Integration', () => {

  beforeAll(async () => {
    storage = new PostgreSQLStorage(DATABASE_URL);
    try {
      await Promise.race([
        storage.connect(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('connect timeout (15s)')), 15_000),
        ),
      ]);
    } catch (err: any) {
      console.warn(
        `⚠ PostgreSQL not available (${err.message}) — skipping OrderExecutionPipeline + PG integration tests`,
      );
      available = false;
    }
  }, 30_000);

  afterAll(async () => {
    if (available && storage) {
      await storage.clearForTesting();
      await storage.disconnect();
    }
  });

  beforeEach(async () => {
    if (!available) return;
    // Clear the database to prevent cross-test contamination
    await storage.clearForTesting();
    pipeline = new OrderExecutionPipeline();
    riskEngine.configureStorage(storage);
    riskEngine.setPortfolioValue(TEST_USER, 1_000_000);
    riskEngine.updateLimits(TEST_USER, {
      dailyLossLimit: 50_000,
      dailyLossPercentLimit: 5,
      maxPositionSizePercent: 20,
      maxLeverage: 2,
      allowIntraday: true,
      allowFNO: false,
    });
  });

  afterEach(() => {
    if (!available) return;
    riskEngine.resetDaily(TEST_USER);
    const profile = riskEngine.getProfile(TEST_USER);
    if (profile) {
      profile.lockdown = {
        status: LockdownStatus.NONE,
        triggeredAt: null,
        liftsAt: null,
        triggerLoss: null,
        breachedLimit: null,
      };
      profile.settingsFrozen = false;
      profile.settingsFrozenUntil = null;
      profile.limits.dailyLossLimit = DEFAULT_RISK_LIMITS.dailyLossLimit;
    }
  });

  // ──────────────── 1. Buy Order Persists Profile ────────────────

  it('should persist risk profile to PostgreSQL after a BUY order executes', async () => {
    if (!available) return;

    const result = await pipeline.execute(buyParams());
    expect(result.success).toBe(true);

    // Load from PostgreSQL to verify the profile was persisted
    const persisted = await storage.loadRiskProfile(TEST_USER);
    expect(persisted).not.toBeNull();
    expect(persisted!.userId).toBe(TEST_USER);
    // BUY reduces cash → negative unrealized P&L
    // estimatedPnl = -price * quantity = -2890 * 10 = -28900
    expect(persisted!.today.unrealizedPnL).toBeLessThan(0);
    expect(persisted!.today.tradeCount).toBe(1);
    expect(persisted!.today.totalCharges).toBeGreaterThan(0);
    expect(persisted!.portfolioValueAtOpen).toBe(1_000_000);
  });

  // ──────────────── 2. Sell Order Persists Realized P&L ────────────────

  it('should persist realized P&L to PostgreSQL after a SELL order executes', async () => {
    if (!available) return;

    // Reset daily so we start with zero P&L
    riskEngine.resetDaily(TEST_USER);
    riskEngine.setPortfolioValue(TEST_USER, 1_000_000);

    const result = await pipeline.execute(sellParams());
    expect(result.success).toBe(true);

    // Load from PostgreSQL — SELL records positive realized P&L
    // estimatedPnl = +price * quantity = +2900 * 10 = +29000 (isRealized=true for SELL)
    const persisted = await storage.loadRiskProfile(TEST_USER);
    expect(persisted).not.toBeNull();
    expect(persisted!.today.realizedPnL).toBeGreaterThan(0);
    expect(persisted!.today.tradeCount).toBe(1);
  });

  // ──────────────── 3. Multiple Orders Accumulate ────────────────

  it('should accumulate trade count in PostgreSQL across multiple orders', async () => {
    if (!available) return;

    riskEngine.resetDaily(TEST_USER);
    riskEngine.setPortfolioValue(TEST_USER, 1_000_000);

    await pipeline.execute(buyParams({ quantity: 5 }));
    await pipeline.execute(buyParams({ quantity: 3, symbol: 'TCS', price: 3890 }));

    const persisted = await storage.loadRiskProfile(TEST_USER);
    expect(persisted).not.toBeNull();
    expect(persisted!.today.tradeCount).toBe(2);
  });

  // ──────────────── 4. Lockdown Persists ────────────────

  it('should persist lockdown state to PostgreSQL when a trade triggers lockdown', async () => {
    if (!available) return;

    riskEngine.resetDaily(TEST_USER);
    riskEngine.setPortfolioValue(TEST_USER, 1_000_000);

    // Set a razor-thin loss limit — the BUY order's P&L impact will exceed it
    riskEngine.updateLimits(TEST_USER, { dailyLossLimit: 1 }); // ₹1 absurdly tight

    const profile = riskEngine.getProfile(TEST_USER);
    // Seed a realized loss so total P&L plus BUY impact triggers lockdown
    profile.today.realizedPnL = -1;

    // Drain any pending fire-and-forget persists from setup (resetDaily,
    // setPortfolioValue, updateLimits) so the evaluate() call below is
    // guaranteed to be the last write to the database, preventing race
    // conditions where a stale profile (lockdown=NONE) overwrites the
    // lockdown=ACTIVE state.
    await riskEngine.drain(TEST_USER);

    // Execute a large BUY — estimatedPnl = -2890 * 10 = -28900 → total loss = -28901 >> ₹1
    const result = await pipeline.execute(buyParams({ quantity: 10 }));
    expect(result.success).toBe(false);
    // Evaluate returns BLOCKED_LOSS_LIMIT (which triggers the lockdown as a side effect)
    expect(result.riskEvaluation.decision).toBe(RiskDecision.BLOCKED_LOSS_LIMIT);

    // Ensure pending persists complete before checking the DB
    await riskEngine.drain(TEST_USER);

    // Verify lockdown state in PostgreSQL
    const persisted = await storage.loadRiskProfile(TEST_USER);
    expect(persisted).not.toBeNull();
    expect(persisted!.lockdown.status).toBe(LockdownStatus.ACTIVE);
    expect(persisted!.lockdown.triggeredAt).toBeDefined();
    expect(persisted!.lockdown.liftsAt).toBeDefined();
    expect(persisted!.lockdown.triggerLoss).toBeGreaterThanOrEqual(1);
    expect(persisted!.lockdown.breachedLimit).toBe('daily_loss');
    expect(persisted!.settingsFrozen).toBe(true);
  });

  // ──────────────── 5. Load from Storage ────────────────

  it('should load a risk profile from PostgreSQL and reconcile it in memory', async () => {
    if (!available) return;

    // Create a known profile directly in storage (simulating data from a
    // previous server session before the pipeline was ever used for this user)
    const freshProfile = riskEngine.getProfile(LOAD_TEST_USER);
    freshProfile.today.unrealizedPnL = -15_000;
    freshProfile.today.realizedPnL = 22_000;
    freshProfile.today.tradeCount = 5;
    freshProfile.portfolioValueAtOpen = 750_000;
    freshProfile.today.date = new Date().toISOString().split('T')[0];
    await storage.saveRiskProfile(freshProfile);

    // Clear in-memory cache so loadProfileFromStorage must go to DB
    (riskEngine as any).profiles.delete(LOAD_TEST_USER);

    // Load — should fetch from PostgreSQL
    const loaded = await riskEngine.loadProfileFromStorage(LOAD_TEST_USER);
    expect(loaded.userId).toBe(LOAD_TEST_USER);
    expect(loaded.today.unrealizedPnL).toBe(-15_000);
    expect(loaded.today.realizedPnL).toBe(22_000);
    expect(loaded.today.tradeCount).toBe(5);
    expect(loaded.portfolioValueAtOpen).toBe(750_000);

    // Cache should now hold the loaded profile
    const fromCache = riskEngine.getProfile(LOAD_TEST_USER);
    expect(fromCache.today.unrealizedPnL).toBe(-15_000);

    await storage.deleteRiskProfile(LOAD_TEST_USER);
  });
});
