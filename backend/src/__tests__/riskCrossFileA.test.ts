/**
 * ============================================================================
 * Toroloom — Cross-File Isolation Test: File A
 * ============================================================================
 *
 * Writes state to the riskEngine singleton, then calls resetForTesting() in
 * afterAll. If the cleanup is missing or broken, File B will inherit this
 * state and its assertions will fail.
 *
 * Run with File B in the same vitest process:
 *   npx vitest run --poolOptions.forks.singleFork=true \
 *     src/__tests__/riskCrossFileA.test.ts \
 *     src/__tests__/riskCrossFileB.test.ts
 *
 * Environment:
 *   Uses in-memory storage (no DB required).
 * ============================================================================
 */

import { describe, it, expect, afterAll } from 'vitest';
import { riskEngine, LockdownStatus, RiskDecision, OrderActionType } from '../services/riskEngine';

const USER_A = 'cross_file_user_a';

describe('Cross-File Isolation — File A', () => {
  afterAll(async () => {
    // CRITICAL: Reset the singleton so File B starts clean.
    // Without this, File B inherits USER_A's profile, pending persists,
    // and storage reference — causing false failures or data corruption.
    await riskEngine.resetForTesting();
  });

  it('should write portfolio state for USER_A', () => {
    riskEngine.setPortfolioValue(USER_A, 500_000);
    const state = riskEngine.getState(USER_A);
    expect(state.portfolioValueAtOpen).toBe(500_000);
  });

  it('should record a trade and trigger lockdown', () => {
    riskEngine.recordTrade(USER_A, -60_000, 100, true);

    const state = riskEngine.getState(USER_A);
    expect(state.today.tradeCount).toBe(1);
    expect(state.today.realizedPnL).toBe(-60_000);
    expect(state.lockdown.status).toBe(LockdownStatus.ACTIVE);
    expect(state.settingsFrozen).toBe(true);
  });

  it('should block buy orders during lockdown', () => {
    const result = riskEngine.evaluate(USER_A, {
      actionType: OrderActionType.BUY,
      symbol: 'RELIANCE',
      quantity: 10,
      price: 2890,
      portfolioValue: 500_000,
    });
    expect(result.allowed).toBe(false);
    expect(result.decision).toBe(RiskDecision.BLOCKED_LOCKDOWN);
  });
});
