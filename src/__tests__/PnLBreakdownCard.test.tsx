/**
 * ============================================================================
 * Toroloom — PnLBreakdownCard Unit Tests
 * ============================================================================
 *
 * Tests cover:
 *   1. Renders realized P&L card (label, icon, value)
 *   2. Renders unrealized P&L card (label, icon, value)
 *   3. Color coding: positive values use marketUp, negative use marketDown
 *   4. Edge cases: zero, negative, large values
 *
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from './testUtils';
import PnLBreakdownCard from '../components/PnLBreakdownCard';

// ──── Mock Theme ──────────────────────────────────────────────

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      marketUp: '#00C853',
      marketDown: '#FF3D00',
      warning: '#FFAB40',
      text: '#E0E6ED',
      textSecondary: '#64748B',
      textMuted: '#475569',
      divider: 'rgba(255,255,255,0.05)',
      bgCard: 'rgba(255,255,255,0.03)',
      border: 'rgba(255,255,255,0.08)',
    },
  }),
}));

// ──── Mock useT ───────────────────────────────────────────────

const periodReport: Record<string, string> = {
  realizedPnl: 'Realized P&L',
  unrealizedPnl: 'Unrealized P&L',
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

// @expo/vector-icons is globally mocked in setup.ts (Ionicons → IonIonicons)
// react-native-reanimated is globally mocked in setup.ts (FadeInDown handled by Proxy)

// ──── Tests ───────────────────────────────────────────────────

describe('PnLBreakdownCard', () => {
  describe('renders realized P&L', () => {
    it('shows label', () => {
      const { getByText } = render(<PnLBreakdownCard realizedPnl={10000} unrealizedPnl={5000} />);
      expect(getByText('Realized P&L')).toBeDefined();
    });

    it('shows positive value with + prefix', () => {
      const { getByText } = render(<PnLBreakdownCard realizedPnl={25000} unrealizedPnl={0} />);
      expect(getByText('+₹25.0K')).toBeDefined();
    });

    it('shows negative value with - prefix', () => {
      const { getByText } = render(<PnLBreakdownCard realizedPnl={-12000} unrealizedPnl={0} />);
      expect(getByText('₹12.0K')).toBeDefined();
    });
  });

  describe('renders unrealized P&L', () => {
    it('shows label', () => {
      const { getByText } = render(<PnLBreakdownCard realizedPnl={0} unrealizedPnl={8000} />);
      expect(getByText('Unrealized P&L')).toBeDefined();
    });

    it('shows positive value with + prefix', () => {
      const { getByText } = render(<PnLBreakdownCard realizedPnl={0} unrealizedPnl={15000} />);
      expect(getByText('+₹15.0K')).toBeDefined();
    });

    it('shows negative value', () => {
      const { getByText } = render(<PnLBreakdownCard realizedPnl={0} unrealizedPnl={-9000} />);
      expect(getByText('₹9.0K')).toBeDefined();
    });
  });

  describe('color coding', () => {
    it('shows positive realized P&L in marketUp color (green)', () => {
      const { getByText } = render(<PnLBreakdownCard realizedPnl={5000} unrealizedPnl={0} />);
      expect(getByText('+₹5.0K')).toBeDefined();
    });

    it('shows negative realized P&L in marketDown color (red)', () => {
      const { getByText } = render(<PnLBreakdownCard realizedPnl={-3000} unrealizedPnl={0} />);
      expect(getByText('₹3.0K')).toBeDefined();
    });

    it('shows positive unrealized P&L in marketUp color (green)', () => {
      const { getByText } = render(<PnLBreakdownCard realizedPnl={0} unrealizedPnl={7500} />);
      expect(getByText('+₹7.5K')).toBeDefined();
    });

    it('shows negative unrealized P&L in marketDown color (red)', () => {
      const { getByText } = render(<PnLBreakdownCard realizedPnl={0} unrealizedPnl={-4500} />);
      expect(getByText('₹4.5K')).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles zero for both values', () => {
      const { getByText } = render(<PnLBreakdownCard realizedPnl={0} unrealizedPnl={0} />);
      expect(getByText('+₹0')).toBeDefined();
    });

    it('handles large values (lakhs)', () => {
      const { getByText } = render(<PnLBreakdownCard realizedPnl={250000} unrealizedPnl={-180000} />);
      expect(getByText('+₹250.0K')).toBeDefined();
      expect(getByText('₹180.0K')).toBeDefined();
    });

    it('handles one positive and one negative simultaneously', () => {
      const { getByText } = render(<PnLBreakdownCard realizedPnl={10000} unrealizedPnl={-5000} />);
      expect(getByText('+₹10.0K')).toBeDefined();
      expect(getByText('₹5.0K')).toBeDefined();
    });
  });
});
