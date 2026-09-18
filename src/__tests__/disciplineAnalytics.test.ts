/**
 * ============================================================================
 * Toroloom — R:R Discipline Analytics Unit Tests
 * ============================================================================
 *
 * Covers computeTradeRR, computeDisciplineSummary, hasDisciplineData:
 *   - Per-trade R:R math for longs, shorts, and missing/degenerate stops
 *   - Breach detection vs committed ratio (with epsilon)
 *   - Summary aggregation: measured/breaches/avg/loss/flagged ordering
 *   - null-commitment short-circuit (UI should prompt instead)
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  computeTradeRR,
  computeDisciplineSummary,
  hasDisciplineData,
} from '../utils/analytics/disciplineAnalytics';
import type { JournalEntry } from '../types';

// ── Entry factory ───────────────────────────────────────────

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'je_test',
    date: '2026-09-10T10:00:00.000Z',
    symbol: 'RELIANCE',
    direction: 'long',
    entryPrice: 100,
    exitPrice: 110,
    quantity: 10,
    pnl: 100,
    pnlPercent: 10,
    holdingPeriod: '2h',
    emotionalState: 'calm',
    mistakes: [],
    planCompliance: 100,
    notes: '',
    setupType: 'breakout',
    exitReason: 'target',
    tags: [],
    ...overrides,
  };
}

describe('computeTradeRR', () => {
  it('computes realized R:R for a long trade that hit its target', () => {
    // entry 100, stop 95 → risk 5/share; pnl 100 over 10 shares = 10/share reward
    const rr = computeTradeRR(makeEntry({ plannedStop: 95 }), 2);
    expect(rr).not.toBeNull();
    expect(rr!.riskPerUnit).toBe(5);
    expect(rr!.realizedRR).toBe(2);
    expect(rr!.breached).toBe(false);
  });

  it('computes realized R:R for a short trade (direction-agnostic)', () => {
    // short: entry 100, stop 105 → risk 5/share; loss of −50 over 10 = −5/share → RR 1
    const rr = computeTradeRR(
      makeEntry({ direction: 'short', exitPrice: 95, pnl: -50, plannedStop: 105 }),
      2,
    );
    expect(rr).not.toBeNull();
    expect(rr!.riskPerUnit).toBe(5);
    expect(rr!.realizedRR).toBe(1);
    expect(rr!.breached).toBe(true);
  });

  it('returns null when no planned stop exists (risk unit unknown)', () => {
    expect(computeTradeRR(makeEntry({ plannedStop: undefined }), 2)).toBeNull();
    expect(computeTradeRR(makeEntry({ plannedStop: NaN }), 2)).toBeNull();
  });

  it('returns null when stop equals entry (zero risk is meaningless)', () => {
    expect(computeTradeRR(makeEntry({ plannedStop: 100 }), 2)).toBeNull();
  });

  it('returns null for non-positive committed ratio', () => {
    expect(computeTradeRR(makeEntry({ plannedStop: 95 }), 0)).toBeNull();
  });

  it('marks a trade breached when realized RR is below commitment (within epsilon)', () => {
    // risk 5, reward 9.95/share → RR 1.99 — 1:2 commitment honoured via epsilon
    const ok = computeTradeRR(makeEntry({ pnl: 99.5, plannedStop: 95 }), 2);
    expect(ok!.breached).toBe(false);

    // reward 9.4/share → RR 1.88 — genuine breach
    const breach = computeTradeRR(makeEntry({ pnl: 94, plannedStop: 95 }), 2);
    expect(breach!.breached).toBe(true);
  });

  it('flags a winning trade that still under-achieved the commitment', () => {
    // Win of ₹200 on 10 shares (20/share) vs risk 10/share = RR 2 < 3
    const rr = computeTradeRR(
      makeEntry({ pnl: 200, exitPrice: 120, plannedStop: 90 }),
      3,
    );
    expect(rr!.breached).toBe(true);
    expect(rr!.pnl).toBe(200); // wins can breach too — exitReason would be 'manual'
  });
});

describe('computeDisciplineSummary', () => {
  it('short-circuits to an empty summary when no commitment exists', () => {
    const entries = [makeEntry({ plannedStop: 95 })];
    const s = computeDisciplineSummary(entries, null);
    expect(s.measured).toBe(0);
    expect(s.breaches).toBe(0);
    expect(s.flagged).toEqual([]);
    expect(hasDisciplineData(s)).toBe(false);
  });

  it('aggregates measured, breaches, avg RR and flagged ordering (worst first)', () => {
    const entries = [
      // RR 1.0 — worst breach
      makeEntry({ id: 'a', symbol: 'AAA', pnl: -50, plannedStop: 105, direction: 'short' }),
      // RR 1.5 — breach
      makeEntry({ id: 'b', symbol: 'BBB', pnl: 75, plannedStop: 95 }),
      // RR 2.0 — clean
      makeEntry({ id: 'c', symbol: 'CCC', pnl: 100, plannedStop: 95 }),
      // no stop → not measurable
      makeEntry({ id: 'd', symbol: 'DDD', pnl: 40 }),
    ];

    const s = computeDisciplineSummary(entries, 2);

    expect(s.measured).toBe(3);
    expect(s.breaches).toBe(2);
    expect(s.breachRate).toBeCloseTo(2 / 3);
    expect(s.avgRealizedRR).toBeCloseTo((1.0 + 1.5 + 2.0) / 3);
    // Loss only counts NEGATIVE-pnl breaches
    expect(s.lossFromBreaches).toBe(-50);
    expect(s.flagged.map(f => f.symbol)).toEqual(['AAA', 'BBB']);
  });

  it('sorts equal-RR breaches by date descending (most recent first)', () => {
    const entries = [
      makeEntry({ id: 'old', symbol: 'OLD', date: '2026-09-01T10:00:00.000Z', pnl: -50, plannedStop: 105, direction: 'short' }),
      makeEntry({ id: 'new', symbol: 'NEW', date: '2026-09-09T10:00:00.000Z', pnl: -50, plannedStop: 105, direction: 'short' }),
    ];
    const s = computeDisciplineSummary(entries, 2);
    expect(s.flagged.map(f => f.entryId)).toEqual(['new', 'old']);
  });

  it('reports all-clean when every measurable trade met the commitment', () => {
    const entries = [
      makeEntry({ id: 'a', pnl: 300, plannedStop: 95 }), // RR 6
      makeEntry({ id: 'b', pnl: 100, plannedStop: 95 }), // RR 2
    ];
    const s = computeDisciplineSummary(entries, 2);
    expect(s.breaches).toBe(0);
    expect(s.flagged).toEqual([]);
    expect(s.lossFromBreaches).toBe(0);
    expect(hasDisciplineData(s)).toBe(true);
  });

  it('handles an empty journal', () => {
    const s = computeDisciplineSummary([], 3);
    expect(s.measured).toBe(0);
    expect(hasDisciplineData(s)).toBe(false);
  });
});
