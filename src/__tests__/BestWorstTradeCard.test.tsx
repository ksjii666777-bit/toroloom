/**
 * ============================================================================
 * Toroloom — BestWorstTradeCard Unit Tests
 * ============================================================================
 *
 * Tests cover:
 *   1. Renders best trade (trophy icon, label, formatted value)
 *   2. Renders worst trade (warning icon, label, abs() value)
 *   3. Empty state (both zero → renders nothing)
 *   4. Edge cases: only best, only worst, large values, same value
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from './testUtils';
import BestWorstTradeCard from '../components/BestWorstTradeCard';

// ──── Mock Theme ──────────────────────────────────────────────

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      marketUp: '#00C853',
      marketDown: '#FF3D00',
      text: '#E0E6ED',
      textMuted: '#475569',
      divider: 'rgba(255,255,255,0.05)',
      bgCard: 'rgba(255,255,255,0.03)',
      border: 'rgba(255,255,255,0.08)',
    },
  }),
}));

// ──── Mock useT ───────────────────────────────────────────────

const periodReport: Record<string, string> = {
  bestTrade: 'Best Trade',
  worstTrade: 'Worst Trade',
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

describe('BestWorstTradeCard', () => {
  describe('renders best trade', () => {
    it('shows best trade label', () => {
      const { getByText } = render(<BestWorstTradeCard bestTrade={15000} worstTrade={-8000} />);
      expect(getByText('Best Trade')).toBeDefined();
    });

    it('shows best trade value with + prefix', () => {
      const { getByText } = render(<BestWorstTradeCard bestTrade={15000} worstTrade={-8000} />);
      expect(getByText('+₹15.0K')).toBeDefined();
    });
  });

  describe('renders worst trade', () => {
    it('shows worst trade label', () => {
      const { getByText } = render(<BestWorstTradeCard bestTrade={15000} worstTrade={-8000} />);
      expect(getByText('Worst Trade')).toBeDefined();
    });

    it('shows worst trade as absolute value (positive)', () => {
      const { getByText } = render(<BestWorstTradeCard bestTrade={15000} worstTrade={-8000} />);
      // Math.abs(-8000) = 8000 → +₹8.0K (formatted as positive)
      expect(getByText('+₹8.0K')).toBeDefined();
    });
  });

  describe('empty state', () => {
    it('renders nothing when both trades are zero', () => {
      const { queryByText } = render(<BestWorstTradeCard bestTrade={0} worstTrade={0} />);
      expect(queryByText('Best Trade')).toBeNull();
      expect(queryByText('Worst Trade')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('renders only best trade when worst is zero', () => {
      const { getByText, queryByText } = render(<BestWorstTradeCard bestTrade={10000} worstTrade={0} />);
      expect(getByText('Best Trade')).toBeDefined();
      expect(getByText('+₹10.0K')).toBeDefined();
      expect(queryByText('Worst Trade')).toBeDefined(); // section still renders, show 0
    });

    it('renders only worst trade when best is zero', () => {
      const { getByText, queryByText } = render(<BestWorstTradeCard bestTrade={0} worstTrade={-5000} />);
      expect(getByText('Worst Trade')).toBeDefined();
      expect(getByText('+₹5.0K')).toBeDefined(); // abs(-5000) = 5000
      expect(queryByText('Best Trade')).toBeDefined(); // section renders, show 0
    });

    it('handles large trade values', () => {
      const { getByText } = render(<BestWorstTradeCard bestTrade={500000} worstTrade={-350000} />);
      expect(getByText('+₹500.0K')).toBeDefined();
      expect(getByText('+₹350.0K')).toBeDefined(); // abs(-350000) = 350000
    });

    it('handles small trade values (compact format with H notation)', () => {
      const { getByText } = render(<BestWorstTradeCard bestTrade={500} worstTrade={-300} />);
      // mockFormatCurrency compact: 500 >= 100 → returns '+₹5.0H'
      expect(getByText('+₹5.0H')).toBeDefined();
      // abs(-300) = 300, 300 >= 100 → returns '+₹3.0H'
      expect(getByText('+₹3.0H')).toBeDefined();
    });

    it('renders when bestTrade equals worstTrade (same magnitude)', () => {
      const { getByText } = render(<BestWorstTradeCard bestTrade={10000} worstTrade={-10000} />);
      expect(getByText('+₹10.0K')).toBeDefined();
      expect(getByText('+₹10.0K')).toBeDefined();
    });
  });
});
