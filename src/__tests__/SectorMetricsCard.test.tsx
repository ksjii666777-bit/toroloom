/**
 * ============================================================================
 * Toroloom — SectorMetricsCard Unit Tests
 * ============================================================================
 *
 * Tests all rendering states:
 *   1. Renders section title with sector data
 *   2. Shows W/L badges, avg values, profit factor for each sector
 *   3. Expand/collapse behavior (hidden by default, expand shows trade details)
 *   4. Buy vs sell comparison in expanded trade details
 *   5. Empty data → renders nothing
 *   6. Multiple sectors with independent expand/collapse
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from './testUtils';
import type { SectorMetrics } from '../utils/analytics/periodAnalytics';
import SectorMetricsCard from '../components/SectorMetricsCard';

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
  sectorMetrics: 'Sector-wise Metrics',
  sectorWins: 'W',
  sectorLosses: 'L',
  sectorAvgWin: 'Avg Win',
  sectorAvgLoss: 'Avg Loss',
  sectorProfitFactor: 'PF',
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

// ── Mock getSectorColor ─────────────────────────────────────
vi.mock('../utils/periodReportPDF', () => ({
  getSectorColor: (sector: string) => {
    const colors: Record<string, string> = {
      Energy: '#FFAB40',
      Technology: '#3B82F6',
      Banking: '#8B5CF6',
      Other: '#64748B',
    };
    return colors[sector] || '#64748B';
  },
}));

// ── Mock formatCurrency / formatPercent ─────────────────────
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

function buildSectorMetrics(): SectorMetrics[] {
  return [
    {
      sector: 'Energy',
      totalTrades: 1,
      totalWins: 1,
      totalLosses: 0,
      avgWin: 5000,
      avgLoss: 0,
      profitFactor: 99, // ≥99 → displays as ∞
      trades: [
        { id: 't1', symbol: 'RELIANCE', type: 'sell' as const, price: 2950, quantity: 10, total: 5000, stockId: 'RELIANCE', name: 'Reliance Industries', timestamp: '2026-06-15T10:30:00Z' },
      ],
    },
    {
      sector: 'Technology',
      totalTrades: 1,
      totalWins: 0,
      totalLosses: 1,
      avgWin: 0,
      avgLoss: 250,
      profitFactor: 0,
      trades: [
        { id: 't2', symbol: 'TCS', type: 'sell' as const, price: 3750, quantity: 5, total: -250, stockId: 'TCS', name: 'Tata Consultancy', timestamp: '2026-06-20T14:00:00Z' },
      ],
    },
  ];
}

function buildBuyPriceMap(): Map<string, number> {
  const map = new Map<string, number>();
  map.set('RELIANCE', 2450);
  map.set('TCS', 3800);
  return map;
}

// ──── Tests ────────────────────────────────────────────────────

describe('SectorMetricsCard', () => {
  // ── 1. Renders section with data ──────────────────────────
  describe('renders sector data', () => {
    it('shows section title', () => {
      const { getByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      expect(getByText('Sector-wise Metrics')).toBeDefined();
    });

    it('shows sector names', () => {
      const { getByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      expect(getByText('Energy')).toBeDefined();
      expect(getByText('Technology')).toBeDefined();
    });

    it('shows trade count per sector', () => {
      const { getByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      // "1 trades"
      expect(getByText('1')).toBeDefined();
    });

    it('shows W/L badge', () => {
      const { getByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      expect(getByText('1W')).toBeDefined();
      expect(getByText('0L')).toBeDefined();
    });

    it('shows avg win and avg loss values', () => {
      const { getByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      // Energy avg win: 5000 compact → +₹5.0K — check for the numeric portion
      expect(getByText(/5\.0K/)).toBeDefined();
    });

    it('shows profit factor', () => {
      const { getByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      // Energy profitFactor ≥99 → ∞
      expect(getByText('∞')).toBeDefined();
    });
  });

  // ── 2. Expand / Collapse ─────────────────────────────────
  describe('expand / collapse behavior', () => {
    it('trade details are hidden by default', () => {
      const { queryByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      expect(queryByText('RELIANCE')).toBeNull();
      expect(queryByText('TCS')).toBeNull();
    });

    it('expands to show trade details when sector is tapped', () => {
      const { getByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      fireEvent.press(getByText('Energy'));
      expect(getByText('RELIANCE')).toBeDefined();
    });

    it('shows quantity × price and trade date in expanded trade', () => {
      const { getByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      fireEvent.press(getByText('Energy'));
      // RELIANCE: quantity=10, price=2950 → "10 × ₹2950"
      expect(getByText(/10.*2950/)).toBeDefined();
      // RELIANCE timestamp: 2026-06-15 → formatted as "15 Jun"
      expect(getByText('15 Jun')).toBeDefined();
    });

    it('shows P&L for each trade', () => {
      const { getByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      fireEvent.press(getByText('Energy'));
      // RELIANCE total: 5000 → +₹5.0K (compact) — check for numeric portion
      expect(getByText(/5\.0K/)).toBeDefined();
    });

    it('collapses when tapped again', () => {
      const { getByText, queryByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      fireEvent.press(getByText('Energy'));
      expect(getByText('RELIANCE')).toBeDefined();

      fireEvent.press(getByText('Energy'));
      expect(queryByText('RELIANCE')).toBeNull();
    });

    it('manages sectors independently', () => {
      const { getByText, queryByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      // Expand Energy
      fireEvent.press(getByText('Energy'));
      expect(getByText('RELIANCE')).toBeDefined();
      // Technology should still be collapsed
      expect(queryByText('TCS')).toBeNull();

      // Expand Technology
      fireEvent.press(getByText('Technology'));
      expect(getByText('TCS')).toBeDefined();
      // Energy should remain expanded
      expect(getByText('RELIANCE')).toBeDefined();

      // Collapse Energy
      fireEvent.press(getByText('Energy'));
      expect(queryByText('RELIANCE')).toBeNull();
      // Technology remains expanded
      expect(getByText('TCS')).toBeDefined();
    });
  });

  // ── 3. Buy vs Sell comparison ────────────────────────────
  describe('buy vs sell comparison', () => {
    it('shows buy price from holdingsBuyPriceMap', () => {
      const { getByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      fireEvent.press(getByText('Energy'));
      // RELIANCE buy price: 2450 → "₹2,450"
      expect(getByText('₹2,450')).toBeDefined();
    });

    it('shows sell price from trade data', () => {
      const { getByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={buildBuyPriceMap()} />,
      );
      fireEvent.press(getByText('Energy'));
      // RELIANCE sell price: 2950 → "₹2,950"
      expect(getByText('₹2,950')).toBeDefined();
    });

    it('shows em-dash when buy price is not found', () => {
      const emptyMap = new Map<string, number>();
      const { getByText } = render(
        <SectorMetricsCard sectorMetrics={buildSectorMetrics()} holdingsBuyPriceMap={emptyMap} />,
      );
      fireEvent.press(getByText('Energy'));
      // Should show em-dash for buy price when not in map
      expect(getByText('—')).toBeDefined();
    });
  });

  // ── 4. Empty data ────────────────────────────────────────
  describe('empty data', () => {
    it('renders nothing when sectorMetrics is empty', () => {
      const { queryByText } = render(
        <SectorMetricsCard sectorMetrics={[]} holdingsBuyPriceMap={new Map()} />,
      );
      expect(queryByText('Sector-wise Metrics')).toBeNull();
    });
  });

  // ── 5. Loss sector edge case ─────────────────────────────
  describe('all-loss sector', () => {
    it('shows loss values correctly for losing sectors', () => {
      const lossOnlyMetrics: SectorMetrics[] = [{
        sector: 'Banking',
        totalTrades: 2,
        totalWins: 0,
        totalLosses: 2,
        avgWin: 0,
        avgLoss: 1200,
        profitFactor: 0,
        trades: [
          { id: 't3', symbol: 'HDFCBANK', type: 'sell' as const, price: 1600, quantity: 5, total: -500, stockId: 'HDFCBANK', name: 'HDFC Bank', timestamp: '2026-07-05T11:00:00Z' },
          { id: 't4', symbol: 'ICICIBANK', type: 'sell' as const, price: 1100, quantity: 10, total: -700, stockId: 'ICICIBANK', name: 'ICICI Bank', timestamp: '2026-07-06T09:00:00Z' },
        ],
      }];

      const { getByText } = render(
        <SectorMetricsCard sectorMetrics={lossOnlyMetrics} holdingsBuyPriceMap={new Map()} />,
      );
      expect(getByText('Banking')).toBeDefined();
      // 0 wins → 0W, 2 losses → 2L
      expect(getByText('0W')).toBeDefined();
      expect(getByText('2L')).toBeDefined();
    });
  });
});
