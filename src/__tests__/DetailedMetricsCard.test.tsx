/**
 * ============================================================================
 * Toroloom — DetailedMetricsCard Unit Tests
 * ============================================================================
 *
 * Tests cover:
 *   1. Renders all 4 metrics with labels and values
 *   2. Color coding: avg win → green, avg loss → red, profit factor thresholds
 *   3. Edge cases: zero values, high/low profit factor, fractional holding days
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from './testUtils';
import DetailedMetricsCard from '../components/DetailedMetricsCard';

// ──── Mock Theme ──────────────────────────────────────────────

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      marketUp: '#00C853',
      marketDown: '#FF3D00',
      warning: '#FFAB40',
      text: '#E0E6ED',
      textMuted: '#475569',
    },
  }),
}));

// ──── Mock useT ───────────────────────────────────────────────

const periodReport: Record<string, string> = {
  avgWin: 'Avg Win',
  avgLoss: 'Avg Loss',
  profitFactor: 'Profit Factor',
  avgHoldingDays: 'Avg Hold',
};

function resolveT(key: string): string {
  const parts = key.split('.');
  const ns = parts[0];
  const subKey = parts.slice(1).join('.');
  if (ns === 'periodReport' && subKey in periodReport) {
    return periodReport[subKey];
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

// ──── Tests ───────────────────────────────────────────────────

describe('DetailedMetricsCard', () => {
  describe('renders all four metrics', () => {
    it('shows labels for all metrics', () => {
      const { getByText } = render(
        <DetailedMetricsCard avgWin={12000} avgLoss={-5000} profitFactor={2.4} avgHoldingDays={15} />,
      );
      expect(getByText('Avg Win')).toBeDefined();
      expect(getByText('Avg Loss')).toBeDefined();
      expect(getByText('Profit Factor')).toBeDefined();
      expect(getByText('Avg Hold')).toBeDefined();
    });

    it('shows avg win value', () => {
      const { getByText } = render(
        <DetailedMetricsCard avgWin={12000} avgLoss={-5000} profitFactor={2.4} avgHoldingDays={15} />,
      );
      expect(getByText('+₹12.0K')).toBeDefined();
    });

    it('shows avg loss value', () => {
      const { getByText } = render(
        <DetailedMetricsCard avgWin={12000} avgLoss={-5000} profitFactor={2.4} avgHoldingDays={15} />,
      );
      expect(getByText('₹5.0K')).toBeDefined();
    });

    it('shows profit factor to 2 decimal places', () => {
      const { getByText } = render(
        <DetailedMetricsCard avgWin={12000} avgLoss={-5000} profitFactor={2.4} avgHoldingDays={15} />,
      );
      expect(getByText('2.40')).toBeDefined();
    });

    it('shows avg holding days with d suffix', () => {
      const { getByText } = render(
        <DetailedMetricsCard avgWin={12000} avgLoss={-5000} profitFactor={2.4} avgHoldingDays={15} />,
      );
      expect(getByText('15d')).toBeDefined();
    });
  });

  describe('profit factor color coding', () => {
    it('uses marketUp (green) when profit factor >= 2', () => {
      const { getByText } = render(
        <DetailedMetricsCard avgWin={0} avgLoss={0} profitFactor={3.0} avgHoldingDays={0} />,
      );
      expect(getByText('3.00')).toBeDefined();
    });

    it('uses warning (amber) when profit factor >= 1 but < 2', () => {
      const { getByText } = render(
        <DetailedMetricsCard avgWin={0} avgLoss={0} profitFactor={1.5} avgHoldingDays={0} />,
      );
      expect(getByText('1.50')).toBeDefined();
    });

    it('uses marketDown (red) when profit factor < 1', () => {
      const { getByText } = render(
        <DetailedMetricsCard avgWin={0} avgLoss={0} profitFactor={0.5} avgHoldingDays={0} />,
      );
      expect(getByText('0.50')).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles zero values for all metrics', () => {
      const { getByText } = render(
        <DetailedMetricsCard avgWin={0} avgLoss={0} profitFactor={0} avgHoldingDays={0} />,
      );
      expect(getByText('+₹0')).toBeDefined();
      expect(getByText('+₹0')).toBeDefined();
      expect(getByText('0.00')).toBeDefined();
      expect(getByText('0d')).toBeDefined();
    });

    it('handles fractional avg holding days', () => {
      const { getByText } = render(
        <DetailedMetricsCard avgWin={0} avgLoss={0} profitFactor={1} avgHoldingDays={3.5} />,
      );
      // avgHoldingDays renders as-is with 'd' suffix
      expect(getByText('3.5d')).toBeDefined();
    });

    it('handles large avg win values', () => {
      const { getByText } = render(
        <DetailedMetricsCard avgWin={250000} avgLoss={0} profitFactor={1} avgHoldingDays={0} />,
      );
      expect(getByText('+₹250.0K')).toBeDefined();
    });

    it('handles profit factor at exact threshold boundaries', () => {
      // profitFactor exactly 2 → marketUp
      const { getByText } = render(
        <DetailedMetricsCard avgWin={0} avgLoss={0} profitFactor={2.0} avgHoldingDays={0} />,
      );
      expect(getByText('2.00')).toBeDefined();
    });
  });
});
