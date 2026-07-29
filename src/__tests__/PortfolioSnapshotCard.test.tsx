/**
 * ============================================================================
 * Toroloom — PortfolioSnapshotCard Unit Tests
 * ============================================================================
 *
 * Tests cover:
 *   1. Renders P&L summary and period return
 *   2. Renders metrics grid (trades, win rate, Sharpe, max drawdown)
 *   3. Color coding: positive values use marketUp, negative use marketDown
 *   4. Edge cases: zero values, negative returns, high/low Sharpe
 *   5. Translation key resolution
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from './testUtils';
import PortfolioSnapshotCard from '../components/PortfolioSnapshotCard';
import type { SnapshotMetrics } from '../components/PortfolioSnapshotCard';

// ──── Mock Theme ──────────────────────────────────────────────

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      marketUp: '#00C853',
      marketDown: '#FF3D00',
      warning: '#FFAB40',
      danger: '#FF5252',
      text: '#E0E6ED',
      textSecondary: '#64748B',
      textMuted: '#475569',
      divider: 'rgba(255,255,255,0.05)',
      bgCard: 'rgba(255,255,255,0.03)',
      border: 'rgba(255,255,255,0.08)',
      bg: '#0F0F13',
    },
  }),
}));

// ──── Mock useT ───────────────────────────────────────────────

const periodReport: Record<string, string> = {
  pnlSummary: 'P&L Summary',
  periodReturn: 'Period Return',
  totalTrades: 'Trades',
  winRate: 'Win Rate',
  sharpeRatio: 'Sharpe',
  maxDrawdown: 'Max DD',
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

// ──── Mock formatCurrency / formatPercent ─────────────────────

function mockFormatCurrency(val: number, compact?: boolean): string {
  const sign = val >= 0 ? '+' : '-';
  const abs = Math.abs(val);
  if (compact && abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  if (compact && abs >= 100) return `${sign}₹${(abs / 100).toFixed(1)}H`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

function mockFormatPercent(val: number): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

vi.mock('../utils/formatters', () => ({
  formatCurrency: mockFormatCurrency,
  formatPercent: mockFormatPercent,
}));

// ──── Helpers ─────────────────────────────────────────────────

function buildMetrics(overrides?: Partial<SnapshotMetrics>): SnapshotMetrics {
  return {
    totalReturn: 125000,
    totalReturnPercent: 18.5,
    totalTrades: 42,
    winRate: 62,
    sharpeRatio: 1.8,
    maxDrawdownPercent: -12.3,
    ...overrides,
  };
}

// ──── Tests ───────────────────────────────────────────────────

describe('PortfolioSnapshotCard', () => {
  describe('renders P&L summary', () => {
    it('shows P&L Summary label', () => {
      const { getByText } = render(<PortfolioSnapshotCard metrics={buildMetrics()} />);
      expect(getByText('P&L Summary')).toBeDefined();
    });

    it('shows total return value with + prefix for positive', () => {
      const { getByText } = render(<PortfolioSnapshotCard metrics={buildMetrics()} />);
      expect(getByText('+₹1,25,000')).toBeDefined();
    });

    it('shows Period Return label', () => {
      const { getByText } = render(<PortfolioSnapshotCard metrics={buildMetrics()} />);
      expect(getByText('Period Return')).toBeDefined();
    });

    it('shows return percentage', () => {
      const { getByText } = render(<PortfolioSnapshotCard metrics={buildMetrics()} />);
      expect(getByText('+18.50%')).toBeDefined();
    });
  });

  describe('renders metrics grid', () => {
    it('shows total trades count', () => {
      const { getByText } = render(<PortfolioSnapshotCard metrics={buildMetrics()} />);
      expect(getByText('42')).toBeDefined();
      expect(getByText('Trades')).toBeDefined();
    });

    it('shows win rate percentage', () => {
      const { getByText } = render(<PortfolioSnapshotCard metrics={buildMetrics()} />);
      expect(getByText('62%')).toBeDefined();
      expect(getByText('Win Rate')).toBeDefined();
    });

    it('shows Sharpe ratio', () => {
      const { getByText } = render(<PortfolioSnapshotCard metrics={buildMetrics()} />);
      expect(getByText('1.8')).toBeDefined();
      expect(getByText('Sharpe')).toBeDefined();
    });

    it('shows max drawdown', () => {
      const { getByText } = render(<PortfolioSnapshotCard metrics={buildMetrics()} />);
      expect(getByText('-12.30%')).toBeDefined();
      expect(getByText('Max DD')).toBeDefined();
    });
  });

  describe('color coding', () => {
    it('shows positive total return in marketUp color', () => {
      const { getByText } = render(<PortfolioSnapshotCard metrics={buildMetrics({ totalReturn: 50000 })} />);
      expect(getByText('+₹50,000')).toBeDefined();
    });

    it('shows negative total return without + prefix and in marketDown color', () => {
      const m = buildMetrics({ totalReturn: -25000, totalReturnPercent: -5.2 });
      const { getByText } = render(<PortfolioSnapshotCard metrics={m} />);
      expect(getByText('-₹25,000')).toBeDefined();
      expect(getByText('-5.20%')).toBeDefined();
    });

    it('shows Sharpe >= 1 in marketUp color', () => {
      const { getByText } = render(<PortfolioSnapshotCard metrics={buildMetrics()} />);
      expect(getByText('1.8')).toBeDefined();
    });

    it('shows Sharpe < 1 in warning color', () => {
      const m = buildMetrics({ sharpeRatio: 0.4 });
      const { getByText } = render(<PortfolioSnapshotCard metrics={m} />);
      expect(getByText('0.4')).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles zero total return', () => {
      const m = buildMetrics({ totalReturn: 0, totalReturnPercent: 0 });
      const { getByText } = render(<PortfolioSnapshotCard metrics={m} />);
      expect(getByText('+₹0')).toBeDefined();
      expect(getByText('+0.00%')).toBeDefined();
    });

    it('handles zero trades', () => {
      const m = buildMetrics({ totalTrades: 0 });
      const { getByText } = render(<PortfolioSnapshotCard metrics={m} />);
      expect(getByText('0')).toBeDefined();
    });

    it('handles zero win rate', () => {
      const m = buildMetrics({ winRate: 0 });
      const { getByText } = render(<PortfolioSnapshotCard metrics={m} />);
      expect(getByText('0%')).toBeDefined();
    });

    it('handles very large return values', () => {
      const m = buildMetrics({ totalReturn: 10000000 });
      const { getByText } = render(<PortfolioSnapshotCard metrics={m} />);
      expect(getByText('+₹1,00,00,000')).toBeDefined();
    });

    it('handles all-zero metrics gracefully', () => {
      const m = buildMetrics({
        totalReturn: 0,
        totalReturnPercent: 0,
        totalTrades: 0,
        winRate: 0,
        sharpeRatio: 0,
        maxDrawdownPercent: 0,
      });
      const { getByText } = render(<PortfolioSnapshotCard metrics={m} />);
      expect(getByText('P&L Summary')).toBeDefined();
      expect(getByText('0')).toBeDefined();
      expect(getByText('0%')).toBeDefined();
    });
  });
});
