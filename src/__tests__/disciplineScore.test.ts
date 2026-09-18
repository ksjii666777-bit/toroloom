/**
 * ============================================================================
 * Toroloom — Discipline Score Unit Tests
 * ============================================================================
 *
 * Covers computeDisciplineScore:
 *   - 100 for an all-clean record, 0 for all-breach and no-data
 *   - Grade bands (≥90 excellent · ≥75 good · ≥50 fair · <50 poor)
 *   - Thin-sample (< 3 measured) degradation by one band
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import { computeDisciplineScore } from '../utils/analytics/disciplineAnalytics';
import type { DisciplineSummary } from '../utils/analytics/disciplineAnalytics';

function makeSummary(overrides: Partial<DisciplineSummary> = {}): DisciplineSummary {
  return {
    measured: 10,
    breaches: 0,
    breachRate: 0,
    avgRealizedRR: 2.4,
    lossFromBreaches: 0,
    flagged: [],
    ...overrides,
  };
}

describe('computeDisciplineScore', () => {
  it('scores 100 / excellent when every measured trade honoured the commitment', () => {
    const s = computeDisciplineScore(makeSummary({ measured: 10, breaches: 0 }));
    expect(s).toEqual({ score: 100, grade: 'excellent', measured: 10 });
  });

  it('scores 0 / poor when every measured trade breached', () => {
    const s = computeDisciplineScore(makeSummary({ measured: 10, breaches: 10 }));
    expect(s.score).toBe(0);
    expect(s.grade).toBe('poor');
  });

  it('scores 0 / poor for null summary and empty journal', () => {
    expect(computeDisciplineScore(null)).toEqual({ score: 0, grade: 'poor', measured: 0 });
    expect(computeDisciplineScore(makeSummary({ measured: 0 }))).toEqual({ score: 0, grade: 'poor', measured: 0 });
  });

  it('maps breach counts onto the correct grade bands', () => {
    // 9/10 clean = 90 → excellent
    expect(computeDisciplineScore(makeSummary({ measured: 10, breaches: 1 })).grade).toBe('excellent');
    // 8/10 = 80 → good
    expect(computeDisciplineScore(makeSummary({ measured: 10, breaches: 2 })).grade).toBe('good');
    // 7/10 = 70 → fair
    expect(computeDisciplineScore(makeSummary({ measured: 10, breaches: 3 })).grade).toBe('fair');
    // 4/10 = 40 → poor
    expect(computeDisciplineScore(makeSummary({ measured: 10, breaches: 6 })).grade).toBe('poor');
    // 5/10 = 50 → fair (boundary)
    expect(computeDisciplineScore(makeSummary({ measured: 10, breaches: 5 })).grade).toBe('fair');
  });

  it('rounds fractional scores correctly', () => {
    // 7/8 clean = 87.5 → rounds to 88 → good
    const s = computeDisciplineScore(makeSummary({ measured: 8, breaches: 1 }));
    expect(s.score).toBe(88);
    expect(s.grade).toBe('good');
  });

  it('degrades the grade one band for thin samples (< 3 measured)', () => {
    // 2/2 clean = 100 → would be excellent, degraded to good
    expect(computeDisciplineScore(makeSummary({ measured: 2, breaches: 0 }))).toEqual({
      score: 100, grade: 'good', measured: 2,
    });
    // 1/1 clean = 100 → excellent → degraded one band to good
    expect(computeDisciplineScore(makeSummary({ measured: 1, breaches: 0 })).grade).toBe('good');
    // 1/1 breach = 0 → poor stays poor
    expect(computeDisciplineScore(makeSummary({ measured: 1, breaches: 1 })).grade).toBe('poor');
  });

  it('does not degrade samples of 3 or more', () => {
    expect(computeDisciplineScore(makeSummary({ measured: 3, breaches: 0 })).grade).toBe('excellent');
  });
});
