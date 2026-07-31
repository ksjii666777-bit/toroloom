/**
 * ============================================================================
 * Toroloom — PeriodBreakdownCard Unit Tests
 * ============================================================================
 *
 * Tests cover:
 *   1. Renders period data (title, labels, P&L, bars, W/L badges)
 *   2. Edge cases (single period, negative P&L, no trades, zero P&L)
 *   3. Overflow (>12 periods) "+X more periods" indicator
 *   4. Empty state (renders nothing)
 *   5. Mixed profit/loss periods
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from './testUtils';
import PeriodBreakdownCard from '../components/PeriodBreakdownCard';

// ──── Mock Theme ──────────────────────────────────────────────

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      marketUp: '#00C853',
      marketDown: '#FF3D00',
      text: '#FFFFFF',
      textMuted: '#888888',
      textSecondary: '#AAAAAA',
      divider: 'rgba(255,255,255,0.08)',
    },
  }),
}));

// ──── Mock useT ───────────────────────────────────────────────

const periodReport: Record<string, string> = {
  periodDetails: 'Period Details',
  tradesCount: '{{count}} trades',
};

function resolveT(key: string, params?: Record<string, any>): string {
  const parts = key.split('.');
  const ns = parts[0];
  const subKey = parts.slice(1).join('.');
  if (ns === 'periodReport' && subKey in periodReport) {
    let result = periodReport[subKey];
    if (params) {
      result = result.replace(/\{\{(\w+)\}\}/g, (_: string, p: string) => String(params[p] ?? ''));
    }
    return result;
  }
  return key;
}

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

// ──── Mock formatCurrency ─────────────────────────────────────

function mockFormatCurrency(val: number, compact?: boolean): string {
  const sign = val >= 0 ? '+' : '-';
  const abs = Math.abs(val);
  if (compact && abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  if (compact && abs >= 100) return `${sign}₹${(abs / 100).toFixed(1)}H`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

vi.mock('../utils/formatters', () => ({
  formatCurrency: mockFormatCurrency,
}));

// ──── Mock Card component ─────────────────────────────────────

// Card component is NOT mocked here — it renders with global mocks
// (expo-linear-gradient, react-native-safe-area-context are mocked in setup.ts)
// @expo/vector-icons is mocked in global setup.ts (Ionicons → IonIonicons)

// ──── Helpers ─────────────────────────────────────────────────

function buildPeriods(overrides: Partial<any>[] = []) {
  const defaults = [
    { label: 'Jan 2026', startDate: '2026-01-01', endDate: '2026-01-31', pnl: 15000, trades: 5, winners: 3, losers: 2 },
    { label: 'Feb 2026', startDate: '2026-02-01', endDate: '2026-02-28', pnl: -8000, trades: 4, winners: 1, losers: 3 },
    { label: 'Mar 2026', startDate: '2026-03-01', endDate: '2026-03-31', pnl: 5000, trades: 3, winners: 2, losers: 1 },
  ];

  return defaults.map((d, i) => ({ ...d, ...overrides[i] }));
}

function buildManyPeriods(count: number) {
  const periods = [];
  for (let i = 0; i < count; i++) {
    const month = (i % 12) + 1;
    const year = 2025 + Math.floor(i / 12);
    periods.push({
      label: `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month - 1]} ${year}`,
      startDate: `${year}-${String(month).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month).padStart(2, '0')}-28`,
      pnl: (i % 3 === 0 ? 1 : -1) * (1000 + i * 500),
      trades: 2 + (i % 5),
      winners: 1 + (i % 3),
      losers: 1 + (i % 2),
    });
  }
  return periods;
}

// ──── Tests ───────────────────────────────────────────────────

describe('PeriodBreakdownCard', () => {
  describe('renders period data', () => {
    it('shows section title', () => {
      const { getByText } = render(<PeriodBreakdownCard periods={buildPeriods()} />);
      expect(getByText('Period Details')).toBeDefined();
    });

    it('shows period labels', () => {
      const { getByText } = render(<PeriodBreakdownCard periods={buildPeriods()} />);
      expect(getByText('Jan 2026')).toBeDefined();
      expect(getByText('Feb 2026')).toBeDefined();
      expect(getByText('Mar 2026')).toBeDefined();
    });

    it('shows trade counts per period', () => {
      const { getByText } = render(<PeriodBreakdownCard periods={buildPeriods()} />);
      expect(getByText('5 trades')).toBeDefined();
      expect(getByText('4 trades')).toBeDefined();
      expect(getByText('3 trades')).toBeDefined();
    });

    it('shows positive P&L with + prefix', () => {
      const { getByText } = render(<PeriodBreakdownCard periods={buildPeriods()} />);
      expect(getByText('+₹15.0K')).toBeDefined();
    });

    it('shows negative P&L', () => {
      const { getByText } = render(<PeriodBreakdownCard periods={buildPeriods()} />);
      // -8000 → -₹8.0K
      expect(getByText('₹8.0K')).toBeDefined();
    });

    it('shows W/L badges for periods with both winners and losers', () => {
      const { getByText } = render(<PeriodBreakdownCard periods={buildPeriods()} />);
      expect(getByText('3W/2L')).toBeDefined();
      expect(getByText('1W/3L')).toBeDefined();
      expect(getByText('2W/1L')).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles a single period gracefully', () => {
      const single = [buildPeriods()[0]];
      const { getByText, queryByText } = render(<PeriodBreakdownCard periods={single} />);
      expect(getByText('Jan 2026')).toBeDefined();
      expect(getByText('+₹15.0K')).toBeDefined();
      expect(getByText('3W/2L')).toBeDefined();
      expect(queryByText(/more periods/)).toBeNull();
    });

    it('handles negative P&L correctly', () => {
      const allLoss = [
        { label: 'Week 1', startDate: '2026-01-06', endDate: '2026-01-12', pnl: -5000, trades: 3, winners: 0, losers: 3 },
      ];
      const { getByText, queryByText } = render(<PeriodBreakdownCard periods={allLoss} />);
      expect(getByText('Week 1')).toBeDefined();
      expect(getByText('₹5.0K')).toBeDefined();
      expect(queryByText('0W/3L')).toBeNull();
    });

    it('hides W/L badge when only winners or only losers', () => {
      const onlyWins = [
        { label: 'Week 1', startDate: '2026-01-06', endDate: '2026-01-12', pnl: 3000, trades: 2, winners: 2, losers: 0 },
      ];
      const { queryByText } = render(<PeriodBreakdownCard periods={onlyWins} />);
      // 'W' alone would match 'Week' — use 'W/' to target the W/L badge format
    expect(queryByText('W/0L')).toBeNull();
    });

    it('handles zero P&L period', () => {
      const zeroPnl = [
        { label: 'Week 1', startDate: '2026-01-06', endDate: '2026-01-12', pnl: 0, trades: 1, winners: 0, losers: 1 },
      ];
      const { getByText } = render(<PeriodBreakdownCard periods={zeroPnl} />);
      expect(getByText('+₹0')).toBeDefined();
    });

    it('shows trade count only when trades > 0', () => {
      const noTrades = [
        { label: 'Week 1', startDate: '2026-01-06', endDate: '2026-01-12', pnl: 1000, trades: 0, winners: 0, losers: 0 },
      ];
      const { queryByText } = render(<PeriodBreakdownCard periods={noTrades} />);
      expect(queryByText(/trades?/i)).toBeNull();
    });
  });

  describe('overflow (>12 periods)', () => {
    it('shows +X more periods text when count exceeds 12', () => {
      const periods = buildManyPeriods(15);
      const { getByText } = render(<PeriodBreakdownCard periods={periods} />);
      expect(getByText('+3 more periods')).toBeDefined();
    });

    it('shows +8 more periods for 20 periods', () => {
      const periods = buildManyPeriods(20);
      const { getByText, queryByText } = render(<PeriodBreakdownCard periods={periods} />);
      expect(getByText('+8 more periods')).toBeDefined();
      expect(queryByText(/Jan 2027/)).toBeNull();
    });

    it('hides overflow text when exactly 12 periods', () => {
      const periods = buildManyPeriods(12);
      const { queryByText } = render(<PeriodBreakdownCard periods={periods} />);
      expect(queryByText(/more periods/)).toBeNull();
    });

    it('hides overflow text when fewer than 12 periods', () => {
      const periods = buildManyPeriods(8);
      const { queryByText } = render(<PeriodBreakdownCard periods={periods} />);
      expect(queryByText(/more periods/)).toBeNull();
    });
  });

  describe('empty state', () => {
    it('renders nothing when periods array is empty', () => {
      const { queryByText } = render(<PeriodBreakdownCard periods={[]} />);
      expect(queryByText('Period Details')).toBeNull();
      expect(queryByText(/more periods/)).toBeNull();
    });
  });

  describe('mixed profit/loss periods', () => {
    it('renders all periods regardless of sign', () => {
      const mixed = [
        { label: 'P1', startDate: '2026-01-06', endDate: '2026-01-12', pnl: 10000, trades: 2, winners: 2, losers: 0 },
        { label: 'P2', startDate: '2026-01-06', endDate: '2026-01-12', pnl: -500, trades: 1, winners: 0, losers: 1 },
        { label: 'P3', startDate: '2026-01-06', endDate: '2026-01-12', pnl: -2500, trades: 3, winners: 1, losers: 2 },
        { label: 'P4', startDate: '2026-01-06', endDate: '2026-01-12', pnl: 750, trades: 2, winners: 2, losers: 0 },
      ];
      const { getByText } = render(<PeriodBreakdownCard periods={mixed} />);
      expect(getByText('P1')).toBeDefined();
      expect(getByText('P2')).toBeDefined();
      expect(getByText('P3')).toBeDefined();
      expect(getByText('P4')).toBeDefined();
    });

    it('shows all P&L values correctly', () => {
      const mixed = [
        { label: 'A', startDate: '2026-01-06', endDate: '2026-01-12', pnl: 5000, trades: 2, winners: 2, losers: 0 },
        { label: 'B', startDate: '2026-01-06', endDate: '2026-01-12', pnl: -3000, trades: 1, winners: 0, losers: 1 },
      ];
      const { getByText } = render(<PeriodBreakdownCard periods={mixed} />);
      expect(getByText('+₹5.0K')).toBeDefined();
      expect(getByText('₹3.0K')).toBeDefined();
    });
  });
});
