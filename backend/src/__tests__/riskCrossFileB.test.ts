/**
 * ============================================================================
 * Toroloom — Cross-File Isolation Test: File B
 * ============================================================================
 *
 * Verifies that after File A runs and calls resetForTesting() in its afterAll,
 * this file starts with a completely clean riskEngine singleton.
 *
 * If File A's afterAll did NOT call resetForTesting(), this file would
 * inherit USER_A's profile (500k portfolio, lockdown ACTIVE, settings frozen)
 * and the assertions below would fail.
 *
 * Run with File A in the same vitest process:
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

const USER_B = 'cross_file_user_b';

describe('Cross-File Isolation — File B', () => {
  afterAll(async () => {
    // Clean up after ourselves so subsequent files start clean too
    await riskEngine.resetForTesting();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Isolation assertions — these fail if File A's state leaked
  // ═══════════════════════════════════════════════════════════════════════════

  it('should start with a clean portfolio value (no leakage from File A)', () => {
    // File A set USER_A's portfolio to 500_000. If resetForTesting() was
    // not called, or was ineffective, USER_B would inherit a non-zero value.
    const state = riskEngine.getState(USER_B);
    expect(state.portfolioValueAtOpen).toBe(0);
  });

  it('should start with zero daily tracking (no leakage from File A)', () => {
    const state = riskEngine.getState(USER_B);
    expect(state.today.tradeCount).toBe(0);
    expect(state.today.realizedPnL).toBe(0);
    expect(state.today.totalCharges).toBe(0);
  });

  it('should start without lockdown (no leakage from File A)', () => {
    // File A triggered lockdown. If resetForTesting() didn't clear it,
    // File B would inherit ACTIVE lockdown.
    const state = riskEngine.getState(USER_B);
    expect(state.lockdown.status).toBe(LockdownStatus.NONE);
    expect(state.settingsFrozen).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Independent operation — File B writes its own state
  // ═══════════════════════════════════════════════════════════════════════════

  it('should be able to set portfolio independently', () => {
    riskEngine.setPortfolioValue(USER_B, 750_000);
    const state = riskEngine.getState(USER_B);
    expect(state.portfolioValueAtOpen).toBe(750_000);
  });

  it('should be able to record trades independently', () => {
    riskEngine.recordTrade(USER_B, -5_000, 25, true);

    const state = riskEngine.getState(USER_B);
    expect(state.today.tradeCount).toBe(1);
    expect(state.today.realizedPnL).toBe(-5_000);
    expect(state.today.totalCharges).toBe(25);
    // Small loss should NOT trigger lockdown
    expect(state.lockdown.status).toBe(LockdownStatus.NONE);
  });

  it('should allow buy orders independently', () => {
    const result = riskEngine.evaluate(USER_B, {
      actionType: OrderActionType.BUY,
      symbol: 'TCS',
      quantity: 10,
      price: 3890,
      portfolioValue: 750_000,
    });
    expect(result.allowed).toBe(true);
    expect(result.decision).toBe(RiskDecision.ALLOWED);
  });

  it('should have correct final state for USER_B (isolated from USER_A)', () => {
    const state = riskEngine.getState(USER_B);
    expect(state.userId).toBe(USER_B);
    expect(state.portfolioValueAtOpen).toBe(750_000);
    expect(state.today.tradeCount).toBe(1);
    expect(state.today.realizedPnL).toBe(-5_000);
    expect(state.lockdown.status).toBe(LockdownStatus.NONE);
  });
});
