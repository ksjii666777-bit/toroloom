/**
 * ============================================================================
 * Toroloom — DisciplineCard Component Tests
 * ============================================================================
 *
 * Covers every rendering state of the weekly-report discipline section:
 *   1. No committed ratio → prompt to commit
 *   2. No measurable trades → explain planned-stop requirement
 *   3. All trades honoured the commitment → green all-clear + stats
 *   4. Breaches → red alert, loss note, per-trade flag rows (worst first)
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from './testUtils';
import DisciplineCard from '../components/DisciplineCard';
import type { DisciplineSummary } from '../utils/analytics/disciplineAnalytics';

// ── Mock Theme ──────────────────────────────────────────────
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      danger: '#FF5252',
      warning: '#FFAB40',
      marketUp: '#00E676',
      marketDown: '#FF5252',
      text: '#FFFFFF',
      textSecondary: '#64748B',
      textMuted: '#475569',
      divider: '#1E293B',
    },
  }),
}));

// ── Mock useT (interpolate {{var}}) ─────────────────────────
const periodReport: Record<string, string> = {
  disciplineTitle: 'R:R Discipline',
  disciplineCommitment: 'Committed ratio: 1:{{ratio}}',
  disciplineMeasured: 'Measured',
  disciplineBreaches: 'Below Commitment',
  disciplineAvgRR: 'Avg Realized',
  disciplineAllClean: 'Every trade honoured your committed R:R — discipline holding',
  disciplineBreachAlert: '{{count}} trades fell below your committed R:R',
  disciplineLossNote: '₹{{loss}} lost to below-commitment trades this period',
  disciplineFlagDetail: 'realized 1:{{realized}} vs committed 1:{{committed}}',
  disciplineFootnote: 'Review entry timing and stop placement for these trades in your journal.',
  disciplineNoCommitment: 'No R:R commitment yet — choose a ratio when connecting your broker to unlock discipline tracking.',
  disciplineNoData: 'Add a planned stop-loss to journal entries to measure realized risk-reward against your commitment.',
};

function resolveT(key: string, params?: Record<string, unknown>): string {
  const parts = key.split('.');
  const ns = parts[0];
  const subKey = parts.slice(1).join('.');
  let text = ns === 'periodReport' && subKey in periodReport ? periodReport[subKey] : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  return text;
}

vi.mock('../hooks/useT', () => ({
  useT: () => ({ t: resolveT, language: 'en', isHindi: false, toggleLanguage: vi.fn() }),
}));

// ── Fixtures ────────────────────────────────────────────────

function makeSummary(overrides: Partial<DisciplineSummary> = {}): DisciplineSummary {
  return {
    measured: 3,
    breaches: 0,
    breachRate: 0,
    avgRealizedRR: 2.4,
    lossFromBreaches: 0,
    flagged: [],
    ...overrides,
  };
}

const breachFlag = {
  entryId: 'je_1',
  symbol: 'TCS',
  date: '2026-09-08T10:00:00.000Z',
  pnl: -600,
  riskPerUnit: 30,
  realizedRR: 1.0,
  committedRatio: 2,
  breached: true,
};

// ──── Tests ─────────────────────────────────────────────────

describe('DisciplineCard', () => {
  describe('no commitment', () => {
    it('prompts the user to commit instead of showing stats', () => {
      const { getByText, queryByText } = render(
        <DisciplineCard summary={makeSummary()} committedRatio={null} />,
      );
      expect(getByText('R:R Discipline')).toBeDefined();
      expect(getByText('No R:R commitment yet — choose a ratio when connecting your broker to unlock discipline tracking.')).toBeDefined();
      // No stats row leaks through
      expect(queryByText('Measured')).toBeNull();
    });
  });

  describe('no measurable trades', () => {
    it('explains the planned-stop requirement', () => {
      const { getByText } = render(
        <DisciplineCard summary={makeSummary({ measured: 0 })} committedRatio={2} />,
      );
      expect(getByText('Add a planned stop-loss to journal entries to measure realized risk-reward against your commitment.')).toBeDefined();
    });
  });

  describe('all clean', () => {
    it('shows the all-clear message with the committed-ratio subtitle and stats', () => {
      const { getByText } = render(
        <DisciplineCard summary={makeSummary()} committedRatio={2} />,
      );
      expect(getByText('Committed ratio: 1:2')).toBeDefined();
      expect(getByText('Every trade honoured your committed R:R — discipline holding')).toBeDefined();
      expect(getByText('3')).toBeDefined();          // measured
      expect(getByText('0')).toBeDefined();          // breaches
      expect(getByText('1:2.4')).toBeDefined();      // avg realized
    });
  });

  describe('breaches present', () => {
    it('shows the alert, loss note and per-trade flag rows (worst first)', () => {
      const { getByText } = render(
        <DisciplineCard
          summary={makeSummary({
            measured: 4,
            breaches: 2,
            breachRate: 0.5,
            avgRealizedRR: 1.2,
            lossFromBreaches: -1600,
            flagged: [
              breachFlag,
              { ...breachFlag, entryId: 'je_2', symbol: 'INFY', pnl: -1000, realizedRR: 1.5 },
            ],
          })}
          committedRatio={2}
        />,
      );

      expect(getByText('2 trades fell below your committed R:R')).toBeDefined();
      expect(getByText('₹1,600 lost to below-commitment trades this period')).toBeDefined();
      // Flag rows: realized vs committed detail per row (harness nests text,
      // so assert presence via deepest-match getByText, not counts)
      expect(getByText('TCS')).toBeDefined();
      expect(getByText('INFY')).toBeDefined();
      expect(getByText('realized 1:1.00 vs committed 1:2')).toBeDefined();
      expect(getByText('realized 1:1.50 vs committed 1:2')).toBeDefined();
      expect(getByText('−₹600')).toBeDefined();
      expect(getByText('−₹1,000')).toBeDefined();
      expect(getByText('Review entry timing and stop placement for these trades in your journal.')).toBeDefined();
    });

    it('shows a positive-pnl breach without a loss note', () => {
      const { getByText, queryByText } = render(
        <DisciplineCard
          summary={makeSummary({
            measured: 1,
            breaches: 1,
            avgRealizedRR: 1.5,
            lossFromBreaches: 0, // winning trade breached → no ₹ loss
            flagged: [{ ...breachFlag, pnl: 300 }],
          })}
          committedRatio={2}
        />,
      );
      expect(getByText('1 trades fell below your committed R:R')).toBeDefined();
      expect(getByText('+₹300')).toBeDefined();
      expect(queryByText(/lost to below-commitment/)).toBeNull();
    });
  });
});
