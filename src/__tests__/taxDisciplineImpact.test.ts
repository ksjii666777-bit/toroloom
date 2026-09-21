/**
 * ============================================================================
 * Toroloom — TaxDisciplineImpact Tests (pure helper)
 * ============================================================================
 * Verifies the "actual you vs disciplined you, post-tax" counterfactual:
 *   - hidden (null) without a commitment or measurable trades
 *   - short-cut winners re-rated up to the committed R:R
 *   - undisciplined losses (breach + red) counted and summed
 *   - post-tax math with loss offsets and the no-tax-when-net-negative rule
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  computeTaxDisciplineImpact,
  type RRJEntry,
} from '../utils/analytics/taxDisciplineImpact';

/** Minimal entry factory: entry 100, stop 90 → risk/unit 10. */
function entry(partial: Partial<RRJEntry> & { pnl: number }): RRJEntry {
  return {
    id: 't',
    quantity: 1,
    entryPrice: 100,
    plannedStop: 90,
    ...partial,
  };
}

describe('computeTaxDisciplineImpact — R:R × post-tax counterfactual', () => {
  it('returns null without a commitment, with a non-positive ratio, or a bad tax rate', () => {
    const trades = [entry({ id: 'a', pnl: 300 })];
    expect(computeTaxDisciplineImpact(trades, null, 0.3)).toBeNull();
    expect(computeTaxDisciplineImpact(trades, 0, 0.3)).toBeNull();
    expect(computeTaxDisciplineImpact(trades, 3, 1)).toBeNull();
    expect(computeTaxDisciplineImpact(trades, 3, -0.2)).toBeNull();
  });

  it('returns null when nothing is measurable (no planned stops / empty input)', () => {
    const trades = [
      entry({ id: 'a', pnl: 300, plannedStop: null }),
      entry({ id: 'b', pnl: -200, plannedStop: undefined }), // factory default overridden — truly no stop
    ];
    expect(computeTaxDisciplineImpact(trades, 3, 0.3)).toBeNull();
    expect(computeTaxDisciplineImpact([], 3, 0.3)).toBeNull();
  });

  it('ignores degenerate stops (stop === entry → zero risk unit)', () => {
    const trades = [entry({ id: 'a', pnl: 300, plannedStop: 100 })];
    expect(computeTaxDisciplineImpact(trades, 3, 0.3)).toBeNull();
  });

  it('re-rates a short-cut winner up to the committed R:R and computes the post-tax gap', () => {
    // Committed 1:3, risk/unit 10 → disciplined win = ₹30.
    // Actual: cut at 1:1.5 → ₹15 (breach).
    const trades = [entry({ id: 'a', pnl: 15 })];
    const impact = computeTaxDisciplineImpact(trades, 3, 0.3);

    expect(impact).not.toBeNull();
    expect(impact!.measured).toBe(1);
    expect(impact!.breaches).toBe(1);
    expect(impact!.undisciplinedLosses).toBe(0);
    expect(impact!.actualPnl).toBe(15);
    expect(impact!.disciplinedPnl).toBe(30);
    // Post-tax: 30 × 0.7 = 21 vs 15 × 0.7 = 10.5 → gap 10.5
    expect(impact!.postTaxActual).toBeCloseTo(10.5, 6);
    expect(impact!.postTaxDisciplined).toBeCloseTo(21, 6);
    expect(impact!.postTaxGap).toBeCloseTo(10.5, 6);
  });

  it('re-rates a stop-buster loss down to −1R and counts the undisciplined loss', () => {
    // Actual: -20 (2R loss — stop was ignored; planned risk is 1R = ₹10).
    const trades = [entry({ id: 'a', pnl: -20 })];
    const impact = computeTaxDisciplineImpact(trades, 3, 0.3);

    expect(impact!.breaches).toBe(1);
    expect(impact!.undisciplinedLosses).toBe(1);
    expect(impact!.lossFromUndisciplinedLosses).toBe(20);
    // Disciplined-you honours the stop: −1R = −10.
    expect(impact!.disciplinedPnl).toBe(-10);
  });

  it('treats a planned 1R stop-out as discipline, not a breach', () => {
    // −10 on 1R risk = exactly the planned stop-out. Honourable exit.
    const trades = [entry({ id: 'a', pnl: -10 })];
    const impact = computeTaxDisciplineImpact(trades, 3, 0.3);

    expect(impact!.breaches).toBe(0);
    expect(impact!.undisciplinedLosses).toBe(0);
    expect(impact!.disciplinedPnl).toBe(-10);
    expect(impact!.postTaxGap).toBeCloseTo(0, 6);
  });

  it('clean winners and planned 1R losers pass through unchanged (no breach)', () => {
    const trades = [
      entry({ id: 'win', pnl: 30 }),           // exactly 1:3 — clean
      entry({ id: 'win2', pnl: 29.6 }),        // 1:2.96 ≥ 3−0.05 — within ε
      entry({ id: 'loss', pnl: -5, plannedStop: 95 }), // exactly 1R stop-out (₹5 risk) — discipline
    ];
    const impact = computeTaxDisciplineImpact(trades, 3, 0.3);

    expect(impact!.measured).toBe(3);
    expect(impact!.breaches).toBe(0);
    expect(impact!.undisciplinedLosses).toBe(0);
    expect(impact!.actualPnl).toBeCloseTo(54.6, 6);
    expect(impact!.disciplinedPnl).toBeCloseTo(54.6, 6);
    expect(impact!.postTaxGap).toBeCloseTo(0, 6);
  });

  it('offsets gains against losses before tax and skips tax when net negative', () => {
    // Actual: +15 win cut at 1:1.5 (breach), −20 undisciplined 2R loss.
    const trades = [
      entry({ id: 'win', pnl: 15 }),
      entry({ id: 'loss', pnl: -20 }),
    ];
    const impact = computeTaxDisciplineImpact(trades, 3, 0.3);

    expect(impact!.undisciplinedLosses).toBe(1);
    expect(impact!.lossFromUndisciplinedLosses).toBe(20);
    // Actual net: 15 − 20 = −5 → no tax → post-tax −5.
    expect(impact!.postTaxActual).toBeCloseTo(-5, 6);
    // Disciplined: winner re-rated +30, stop honoured −10 → net +20 → ×0.7 = 14.
    expect(impact!.disciplinedPnl).toBeCloseTo(20, 6);
    expect(impact!.postTaxDisciplined).toBeCloseTo(14, 6);
    expect(impact!.postTaxGap).toBeCloseTo(19, 6); // 14 − (−5)
  });

  it('scales re-rated winners by quantity via riskPerUnit × qty', () => {
    // 10 shares: entry 100, stop 90 → ₹10 risk/unit; cut at 1:1 → ₹100 win
    // instead of the committed 1:3 → ₹300.
    const trades = [
      entry({ id: 'a', pnl: 100, quantity: 10 }),
    ];
    const impact = computeTaxDisciplineImpact(trades, 3, 0);

    expect(impact!.breaches).toBe(1);
    expect(impact!.actualPnl).toBe(100);
    expect(impact!.disciplinedPnl).toBe(300);
    expect(impact!.postTaxGap).toBeCloseTo(200, 6);
  });

  it('ignores entries without ids (structural safety) and tolerates taxRate 0', () => {
    const trades = [entry({ id: '', pnl: 15 })];
    const impact = computeTaxDisciplineImpact(trades, 3, 0);
    expect(impact).not.toBeNull();
    expect(impact!.measured).toBe(1);
  });
});
