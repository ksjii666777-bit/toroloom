/**
 * ============================================================================
 * Toroloom — Prop-Firm Drawdown Engine Tests
 * ============================================================================
 *
 * Pure-function coverage:
 *   - day bucketing and start-date filtering
 *   - static drawdown floor (FTMO): overall breach, danger/warning thresholds
 *   - trailing drawdown (Topstep): floor follows peak equity
 *   - daily loss limit: breach on the worst day
 *   - phase pass requires target + min trading days + no breach
 *   - consistency rule (one day > X% of total profit)
 *   - pre-trade checker: ok / warn (half budget, low R:R) / block (would breach)
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import type { JournalEntry } from '../types';
import { makeCustomConfig, deriveLimits } from '../services/propFirm/challengePresets';
import {
  bucketByDay, computeChallengeState, checkPlannedTrade, dayKey,
} from '../services/propFirm/drawdownEngine';

// ── Fixtures ────────────────────────────────────────────────────────────────

const START = '2026-09-01T00:00:00.000Z';

let seq = 0;
function entry(pnl: number, date: string, symbol = 'NIFTY'): JournalEntry {
  seq += 1;
  return {
    id: `e${seq}`, date, symbol, direction: 'long',
    entryPrice: 100, exitPrice: 100 + pnl / 10, quantity: 10,
    pnl, pnlPercent: 0, holdingPeriod: '1h',
    emotionalState: 'calm', mistakes: [], planCompliance: 100,
    notes: '', setupType: 'breakout', exitReason: 'target', tags: [],
  };
}

// FTMO-style: ₹10,00,000, 5% daily (₹50,000), 10% overall (₹1,00,000), target 10% (₹1,00,000), 4 min days
function ftmoConfig() {
  return makeCustomConfig({
    accountSize: 1000000, currency: 'INR',
    maxDailyLossPercent: 5, maxOverallLossPercent: 10,
    trailingDrawdown: false,
    phases: [
      { number: 1, profitTargetPercent: 10 },
      { number: 2, profitTargetPercent: 5 },
      { number: 3, profitTargetPercent: null },
    ],
    minTradingDays: 4, consistencyRulePercent: null,
  });
}

function opts(phase = 1, todayKey = '2026-09-05') {
  return { startDate: START, phase, todayKey };
}

// ── Bucketing ───────────────────────────────────────────────────────────────

describe('bucketByDay', () => {
  it('groups trades into calendar days oldest-first', () => {
    const buckets = bucketByDay([
      entry(100, '2026-09-02T10:00:00.000Z'),
      entry(-50, '2026-09-02T14:00:00.000Z'),
      entry(200, '2026-09-01T09:00:00.000Z'),
    ]);
    expect(buckets.map(b => b.day)).toEqual(['2026-09-01', '2026-09-02']);
    expect(buckets[1]).toMatchObject({ pnl: 50, trades: 2 });
  });

  it('dayKey extracts the date part of an ISO string', () => {
    expect(dayKey('2026-09-05T18:30:00.000Z')).toBe('2026-09-05');
  });
});

// ── Static drawdown (FTMO) ──────────────────────────────────────────────────

describe('computeChallengeState — static overall loss', () => {
  it('deriveLimits maps percentages to absolute amounts', () => {
    const { maxDailyLossAmount, maxOverallLossAmount, profitTargetAmount } = deriveLimits(ftmoConfig());
    expect(maxDailyLossAmount).toBe(50000);
    expect(maxOverallLossAmount).toBe(100000);
    expect(profitTargetAmount).toBe(100000);
  });

  it('a 9% total loss is danger, not breached', () => {
    // Spread over two days — a single ₹90k day would ALSO breach the 5%
    // daily limit and fail the challenge for the wrong reason.
    const state = computeChallengeState([
      entry(-45000, '2026-09-02T10:00:00.000Z'),
      entry(-45000, '2026-09-03T10:00:00.000Z'),
    ], ftmoConfig(), opts());
    expect(state.overallVerdict).toBe('danger');
    expect(state.overallLossUsedFraction).toBeCloseTo(0.9, 5);
    expect(state.phaseStatus).toBe('in_progress');
  });

  it('breaching 10% overall fails the challenge', () => {
    const state = computeChallengeState([entry(-105000, '2026-09-02T10:00:00.000Z')], ftmoConfig(), opts());
    expect(state.overallVerdict).toBe('breached');
    expect(state.phaseStatus).toBe('failed');
    expect(state.overallLossRemaining).toBe(0);
  });

  it('trades before the challenge start are ignored', () => {
    const state = computeChallengeState([
      entry(-500000, '2026-08-15T10:00:00.000Z'),
      entry(5000, '2026-09-02T10:00:00.000Z'),
    ], ftmoConfig(), opts());
    expect(state.included).toHaveLength(1);
    expect(state.totalPnl).toBe(5000);
  });
});

// ── Daily loss ──────────────────────────────────────────────────────────────

describe('computeChallengeState — daily loss', () => {
  it('one bad day beyond 5% fails even if the total is fine', () => {
    const state = computeChallengeState([
      entry(30000, '2026-09-01T10:00:00.000Z'),
      entry(-55000, '2026-09-03T10:00:00.000Z'),
    ], ftmoConfig(), opts());
    expect(state.dailyVerdict).toBe('breached');
    expect(state.phaseStatus).toBe('failed');
    expect(state.worstDay).toBe('2026-09-03');
  });

  it('a 4% loss day sits at warning with budget remaining', () => {
    const state = computeChallengeState([entry(-40000, '2026-09-02T10:00:00.000Z')], ftmoConfig(), opts());
    expect(state.dailyVerdict).toBe('warning');
    expect(state.dailyLossRemaining).toBe(10000);
  });
});

// ── Trailing drawdown (Topstep) ─────────────────────────────────────────────

describe('computeChallengeState — trailing drawdown', () => {
  function topstepConfig() {
    return makeCustomConfig({
      accountSize: 50000, currency: 'USD',
      maxDailyLossPercent: 4, maxOverallLossPercent: 6, // ₹/$3000
      trailingDrawdown: true,
      phases: [{ number: 1, profitTargetPercent: 6 }, { number: 2, profitTargetPercent: null }],
      minTradingDays: 1, consistencyRulePercent: 45,
    });
  }

  it('the floor trails the peak: +$2k then -$2.5k leaves only $500 to the floor', () => {
    const state = computeChallengeState([
      entry(2000, '2026-09-01T10:00:00.000Z'),
      entry(-2500, '2026-09-02T10:00:00.000Z'),
    ], topstepConfig(), opts());
    expect(state.peakEquity).toBe(52000);
    expect(state.drawdownFloor).toBe(52000 - 3000);
    expect(state.equity).toBe(49500);
    // Drawdown measured from peak, not from the start balance
    expect(state.overallLossUsedFraction).toBeCloseTo(2500 / 3000, 5);
    // 83% of the allowance consumed — the ladder escalates to danger at ≥90%
    expect(state.overallVerdict).toBe('warning');
  });

  it('violates the consistency rule when one day dominates the profit', () => {
    const state = computeChallengeState([
      entry(4000, '2026-09-01T10:00:00.000Z'),
      entry(1000, '2026-09-02T10:00:00.000Z'),
      entry(1000, '2026-09-03T10:00:00.000Z'),
    ], topstepConfig(), opts());
    // Largest day 4000 of 6000 total = 66.7% > 45%
    expect(state.consistencyViolation).toBe(true);
    expect(state.largestDayProfitShare).toBeCloseTo(4000 / 6000, 5);
  });
});

// ── Phase pass ──────────────────────────────────────────────────────────────

describe('computeChallengeState — phase outcomes', () => {
  it('reaching the target before min trading days does NOT pass', () => {
    const state = computeChallengeState([
      entry(105000, '2026-09-01T10:00:00.000Z'),
      entry(3000, '2026-09-02T10:00:00.000Z'),
    ], ftmoConfig(), opts());
    expect(state.profitProgress).toBeGreaterThanOrEqual(1);
    expect(state.tradingDays).toBeLessThan(4);
    expect(state.phaseStatus).toBe('in_progress');
  });

  it('target + enough days passes phase 1', () => {
    const entries = [
      entry(30000, '2026-09-01T10:00:00.000Z'),
      entry(30000, '2026-09-02T10:00:00.000Z'),
      entry(25000, '2026-09-03T10:00:00.000Z'),
      entry(20000, '2026-09-04T10:00:00.000Z'),
    ];
    const state = computeChallengeState(entries, ftmoConfig(), opts());
    expect(state.tradingDays).toBe(4);
    expect(state.phaseStatus).toBe('passed');
  });

  it('phase 2 uses the smaller 5% target', () => {
    const state = computeChallengeState(
      [entry(55000, '2026-09-02T10:00:00.000Z')],
      ftmoConfig(),
      opts(2),
    );
    expect(state.phaseTargetAmount).toBe(50000);
    expect(state.profitProgress).toBeCloseTo(1.1, 5);
  });
});

// ── Pre-trade checker ───────────────────────────────────────────────────────

describe('checkPlannedTrade', () => {
  function healthyState() {
    return computeChallengeState([entry(5000, '2026-09-02T10:00:00.000Z')], ftmoConfig(), opts());
  }

  it('a modest risk with proper R:R passes', () => {
    const state = healthyState();
    const check = checkPlannedTrade(state, ftmoConfig(), 10000, 30000, 3);
    expect(check.verdict).toBe('ok');
    expect(check.reasons).toHaveLength(0);
  });

  it('risking over half the daily budget warns', () => {
    const state = healthyState(); // remaining daily = 55000
    const check = checkPlannedTrade(state, ftmoConfig(), 30000, 90000, 3);
    expect(check.verdict).toBe('warn');
    expect(check.reasons).toContain('propFirm.check.halfDaily');
  });

  it('risking more than the daily budget blocks', () => {
    const state = healthyState();
    const check = checkPlannedTrade(state, ftmoConfig(), 60000, 180000, 3);
    expect(check.verdict).toBe('block');
    expect(check.reasons).toContain('propFirm.check.exceedsDaily');
  });

  it('risking more than the overall budget blocks', () => {
    const state = healthyState(); // overall remaining ≈ 105000
    const check = checkPlannedTrade(state, ftmoConfig(), 110000, 330000, 3);
    expect(check.verdict).toBe('block');
    expect(check.reasons).toContain('propFirm.check.exceedsOverall');
  });

  it('R:R below the committed ratio warns', () => {
    const state = healthyState();
    const check = checkPlannedTrade(state, ftmoConfig(), 5000, 7500, 3); // 1:1.5 < 1:3
    expect(check.verdict).toBe('warn');
    expect(check.reasons).toContain('propFirm.check.rrBelowCommitment');
  });

  it('blocks everything once the challenge is failed', () => {
    const state = computeChallengeState([entry(-105000, '2026-09-02T10:00:00.000Z')], ftmoConfig(), opts());
    const check = checkPlannedTrade(state, ftmoConfig(), 100, 300, 3);
    expect(check.verdict).toBe('block');
    expect(check.reasons).toContain('propFirm.check.challengeFailed');
  });

  it('zero/nonsense risk is returned unchanged without crashing', () => {
    const state = healthyState();
    const check = checkPlannedTrade(state, ftmoConfig(), 0, null, null);
    expect(check.verdict).toBe('ok');
    expect(check.reasons).toHaveLength(0);
  });
});
