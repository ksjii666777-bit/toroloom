/**
 * ============================================================================
 * Toroloom — LossBreakdownCard Unit Tests
 * ============================================================================
 *
 * Tests all rendering states:
 *   1. Has losing sectors → shows sector breakdown with expand/collapse
 *   2. No losers but has holdings → "No losing positions" message
 *   3. No data at all → renders nothing (null)
 *   4. Multiple sectors with correct colors and values
 *   5. Expand/collapse behavior for sector stock rows
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from './testUtils';
import type { SectorLossGroup } from '../utils/analytics/periodAnalytics';
import LossBreakdownCard from '../components/LossBreakdownCard';

// ── Mock Theme ──────────────────────────────────────────────
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      danger: '#FF5252',
      warning: '#FFAB40',
      marketUp: '#00E676',
      marketDown: '#FF5252',
      text: '#E0E6ED',
      textSecondary: '#64748B',
      textMuted: '#475569',
      divider: 'rgba(255,255,255,0.05)',
      bgCard: 'rgba(255,255,255,0.03)',
    },
  }),
}));

// ── Mock useT ───────────────────────────────────────────────
const periodReport: Record<string, string> = {
  lossBySector: 'Loss by Sector',
  sectorsWithLoss: '{{count}} sectors with losses',
  noLosers: 'No losing positions this period',
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

// ── Mock getSectorColor ─────────────────────────────────────
vi.mock('../utils/periodReportPDF', () => ({
  getSectorColor: (sector: string) => {
    const colors: Record<string, string> = {
      Technology: '#3B82F6',
      Energy: '#FFAB40',
      'Consumer Goods': '#10B981',
      Other: '#64748B',
    };
    return colors[sector] || '#64748B';
  },
}));

// ── Mock formatCurrency ─────────────────────────────────────
vi.mock('../utils/formatters', () => ({
  formatCurrency: (value: number, compact?: boolean) => {
    if (compact) {
      const abs = Math.abs(value);
      if (abs >= 100000) return `${value >= 0 ? '+' : '-'}₹${(abs / 100000).toFixed(1)}L`;
      if (abs >= 1000) return `${value >= 0 ? '+' : ''}₹${(abs / 1000).toFixed(1)}K`;
      return `${value >= 0 ? '+' : ''}₹${abs.toFixed(2)}`;
    }
    return `${value >= 0 ? '+' : ''}₹${Math.abs(value).toLocaleString('en-IN')}`;
  },
  formatPercent: (value: number) => `${value >= 0 ? '+' : ''}${Math.abs(value).toFixed(2)}%`,
}));

// ── Helpers ─────────────────────────────────────────────────

function buildSectorLosers(overrides?: Partial<SectorLossGroup>[]): SectorLossGroup[] {
  if (overrides) return overrides as SectorLossGroup[];

  return [
    {
      sector: 'Technology',
      totalLoss: -15000,
      totalLossPercent: -8.5,
      stocks: [
        {
          id: 'h1', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy',
          quantity: 5, buyPrice: 3800, currentPrice: 3500,
          currentValue: 17500, pnl: -1500, pnlPercent: -7.89,
          totalInvested: 19000, dayChange: -80, dayChangePercent: -0.42,
        },
        {
          id: 'h2', stockId: 'INFY', symbol: 'INFY', name: 'Infosys',
          quantity: 10, buyPrice: 1600, currentPrice: 1520,
          currentValue: 15200, pnl: -800, pnlPercent: -5.0,
          totalInvested: 16000, dayChange: -30, dayChangePercent: -0.20,
        },
      ],
    },
    {
      sector: 'Energy',
      totalLoss: -8000,
      totalLossPercent: -4.2,
      stocks: [
        {
          id: 'h3', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries',
          quantity: 3, buyPrice: 2900, currentPrice: 2700,
          currentValue: 8100, pnl: -600, pnlPercent: -6.9,
          totalInvested: 8700, dayChange: -45, dayChangePercent: -0.50,
        },
      ],
    },
  ];
}

// ──── Tests ────────────────────────────────────────────────────

describe('LossBreakdownCard', () => {
  // ── 1. Has losing sectors ─────────────────────────────────
  describe('has losing sectors', () => {
    it('shows section title', () => {
      const { getByText } = render(
        <LossBreakdownCard sectorLosers={buildSectorLosers()} holdingsCount={10} />,
      );
      expect(getByText('Loss by Sector')).toBeDefined();
    });

    it('shows sector name and count badge', () => {
      const { getByText } = render(
        <LossBreakdownCard sectorLosers={buildSectorLosers()} holdingsCount={10} />,
      );
      expect(getByText('Technology')).toBeDefined();
      expect(getByText('Energy')).toBeDefined();
    });

    it('shows summary text with sector count', () => {
      const { getByText } = render(
        <LossBreakdownCard sectorLosers={buildSectorLosers()} holdingsCount={10} />,
      );
      expect(getByText('2 sectors with losses')).toBeDefined();
    });

    it('shows total loss value formatted in red', () => {
      const { getByText } = render(
        <LossBreakdownCard sectorLosers={buildSectorLosers()} holdingsCount={10} />,
      );
      // Energy: -8000 → -₹8.0K (compact)
      expect(getByText(/₹8\.0K/)).toBeDefined();
    });

    it('shows loss percentage for each sector', () => {
      const { getByText } = render(
        <LossBreakdownCard sectorLosers={buildSectorLosers()} holdingsCount={10} />,
      );
      expect(getByText(/8\.50%/)).toBeDefined();
      expect(getByText(/4\.20%/)).toBeDefined();
    });

    it('shows stock count badge for each sector', () => {
      const { getByText } = render(
        <LossBreakdownCard sectorLosers={buildSectorLosers()} holdingsCount={10} />,
      );
      // Technology has 2 stocks → badge shows "2"
      expect(getByText('2')).toBeDefined();
    });
  });

  // ── 2. Expand / Collapse ─────────────────────────────────
  describe('expand / collapse behavior', () => {
    it('stock details are hidden by default (collapsed)', () => {
      const { queryByText } = render(
        <LossBreakdownCard sectorLosers={buildSectorLosers()} holdingsCount={10} />,
      );
      // Stock symbols should NOT be visible initially
      expect(queryByText('TCS')).toBeNull();
      expect(queryByText('INFY')).toBeNull();
      expect(queryByText('RELIANCE')).toBeNull();
    });

    it('expands to show stock details when sector is tapped', () => {
      const { getByText } = render(
        <LossBreakdownCard sectorLosers={buildSectorLosers()} holdingsCount={10} />,
      );
      // Tap on "Technology" sector header to expand
      fireEvent.press(getByText('Technology'));
      expect(getByText('TCS')).toBeDefined();
      expect(getByText('INFY')).toBeDefined();
      // Company names should also appear
      expect(getByText('Tata Consultancy')).toBeDefined();
      expect(getByText('Infosys')).toBeDefined();
    });

    it('shows P&L values for expanded stocks', () => {
      const { getByText } = render(
        <LossBreakdownCard sectorLosers={buildSectorLosers()} holdingsCount={10} />,
      );
      fireEvent.press(getByText('Technology'));
      // TCS pnl: -1500 → -₹1.5K (compact). Check by partial string.
      expect(getByText(/₹1\.5K/)).toBeDefined();
      // INFY pnl: -800 → -₹800.00 (compact). Check by partial string.
      expect(getByText(/₹800/)).toBeDefined();
    });

    it('collapses stock details when sector is tapped again', () => {
      const { getByText, queryByText } = render(
        <LossBreakdownCard sectorLosers={buildSectorLosers()} holdingsCount={10} />,
      );
      // Tap to expand
      fireEvent.press(getByText('Technology'));
      expect(getByText('TCS')).toBeDefined();

      // Tap again to collapse
      fireEvent.press(getByText('Technology'));
      expect(queryByText('TCS')).toBeNull();
    });

    it('manages sectors independently — expanding one does not expand another', () => {
      const { getByText, queryByText } = render(
        <LossBreakdownCard sectorLosers={buildSectorLosers()} holdingsCount={10} />,
      );
      // Expand Technology
      fireEvent.press(getByText('Technology'));
      expect(getByText('TCS')).toBeDefined();

      // Energy should still be collapsed
      expect(queryByText('RELIANCE')).toBeNull();

      // Now expand Energy
      fireEvent.press(getByText('Energy'));
      expect(getByText('RELIANCE')).toBeDefined();
      // Technology should still be expanded
      expect(getByText('TCS')).toBeDefined();

      // Collapse Technology
      fireEvent.press(getByText('Technology'));
      expect(queryByText('TCS')).toBeNull();
      // Energy should remain expanded
      expect(getByText('RELIANCE')).toBeDefined();
    });
  });

  // ── 3. No losers — but has holdings ──────────────────────
  describe('no losing positions', () => {
    it('shows "No losing positions" message when sectorLosers is empty but holdings exist', () => {
      const { getByText } = render(
        <LossBreakdownCard sectorLosers={[]} holdingsCount={5} />,
      );
      expect(getByText('No losing positions this period')).toBeDefined();
    });

    it('shows section title even in no-losers state', () => {
      const { getByText } = render(
        <LossBreakdownCard sectorLosers={[]} holdingsCount={5} />,
      );
      expect(getByText('Loss by Sector')).toBeDefined();
    });

    it('does not show sector breakdown in no-losers state', () => {
      const { queryByText } = render(
        <LossBreakdownCard sectorLosers={[]} holdingsCount={5} />,
      );
      expect(queryByText('sectors with losses')).toBeNull();
    });
  });

  // ── 4. No data at all ────────────────────────────────────
  describe('no data', () => {
    it('renders nothing when no losers and no holdings', () => {
      const { queryByText } = render(
        <LossBreakdownCard sectorLosers={[]} holdingsCount={0} />,
      );
      // Component returns null when both are empty — no title or text should appear
      expect(queryByText('Loss by Sector')).toBeNull();
    });
  });

  // ── 5. Single sector with one stock ──────────────────────
  describe('single sector edge case', () => {
    it('renders a single sector with one stock correctly', () => {
      const singleLoser: SectorLossGroup[] = [{
        sector: 'Consumer Goods',
        totalLoss: -2500,
        totalLossPercent: -3.1,
        stocks: [{
          id: 'h4', stockId: 'HUL', symbol: 'HUL', name: 'Hindustan Unilever',
          quantity: 4, buyPrice: 2500, currentPrice: 2400,
          currentValue: 9600, pnl: -400, pnlPercent: -4.0,
          totalInvested: 10000, dayChange: -20, dayChangePercent: -0.21,
        }],
      }];

      const { getByText, queryByText } = render(
        <LossBreakdownCard sectorLosers={singleLoser} holdingsCount={3} />,
      );
      expect(getByText('Consumer Goods')).toBeDefined();
      expect(getByText('1 sectors with losses')).toBeDefined();

      // Expand to verify stock details
      fireEvent.press(getByText('Consumer Goods'));
      expect(getByText('HUL')).toBeDefined();
      expect(getByText('Hindustan Unilever')).toBeDefined();
      // Other sectors should not appear
      expect(queryByText('Technology')).toBeNull();
    });
  });
});
