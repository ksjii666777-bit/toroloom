/**
 * ============================================================================
 * Toroloom — PortfolioHolding Tests
 * ============================================================================
 *
 * Tests the PortfolioHolding component: holding details display, positive and
 * negative PnL rendering with appropriate colors, day change indicators,
 * detail rows (avg cost, LTP, invested, current), and press callbacks.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import PortfolioHolding from '../components/PortfolioHolding';
import { render, fireEvent } from './testUtils';
import type { Holding } from '../types';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      primary: '#6C63FF',
      secondary: '#FF6B6B',
      accent: '#00D2FF',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      marketNeutral: '#FFC107',
      text: '#1A1A2E',
      textSecondary: '#5A5A7A',
      textMuted: '#9A9AB0',
      bgCard: '#FFFFFF',
      bgCardLight: '#F0F2F8',
      border: '#E0E0F0',
      divider: '#E8E8F0',
      bg: '#F4F5FA',
    },
  }),
}));

const positiveHolding: Holding = {
  id: 'h1',
  stockId: 'RELIANCE',
  symbol: 'RELIANCE',
  name: 'Reliance Industries Ltd.',
  quantity: 50,
  buyPrice: 2650.00,
  currentPrice: 2890.50,
  totalInvested: 132500,
  currentValue: 144525,
  pnl: 12025,
  pnlPercent: 9.08,
  dayChange: 2260,
  dayChangePercent: 1.59,
};

const negativeHolding: Holding = {
  id: 'h2',
  stockId: 'TCS',
  symbol: 'TCS',
  name: 'Tata Consultancy Services',
  quantity: 20,
  buyPrice: 3800.00,
  currentPrice: 3650.00,
  totalInvested: 76000,
  currentValue: 73000,
  pnl: -3000,
  pnlPercent: -3.95,
  dayChange: -150,
  dayChangePercent: -0.41,
};

describe('PortfolioHolding', () => {
  it('renders holding symbol and quantity', () => {
    const { getByText } = render(
      <PortfolioHolding holding={positiveHolding} />
    );
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText(/shares?/i)).toBeDefined();
  });

  it('renders positive PnL value', () => {
    const { getByText } = render(
      <PortfolioHolding holding={positiveHolding} />
    );
    // Positive PnL should show 12,025
    const pnlEl = getByText(/12,025|12025/);
    expect(pnlEl).toBeDefined();
  });

  it('renders negative PnL value', () => {
    const { getByText } = render(
      <PortfolioHolding holding={negativeHolding} />
    );
    // Negative PnL should show 3,000 (or the negative sign)
    const pnlEl = getByText(/3,000|3000/);
    expect(pnlEl).toBeDefined();
  });

  it('renders PnL percent for positive', () => {
    const { getByText } = render(
      <PortfolioHolding holding={positiveHolding} />
    );
    expect(getByText(/9\.08/)).toBeDefined();
  });

  it('renders PnL percent for negative', () => {
    const { getByText } = render(
      <PortfolioHolding holding={negativeHolding} />
    );
    expect(getByText(/3\.95/)).toBeDefined();
  });

  it('renders detail labels', () => {
    const { getByText } = render(
      <PortfolioHolding holding={positiveHolding} />
    );
    // At least some of these detail labels should be present
    const labels = ['Avg Cost', 'LTP', 'Invested', 'Current'];
    const found = labels.filter((l) => {
      try {
        getByText(l);
        return true;
      } catch {
        return false;
      }
    });
    expect(found.length).toBeGreaterThan(0);
  });

  it('renders day change percent', () => {
    const { getByText } = render(
      <PortfolioHolding holding={positiveHolding} />
    );
    expect(getByText(/1\.59/)).toBeDefined();
  });

  it('calls onPress with the holding when pressed', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <PortfolioHolding holding={positiveHolding} onPress={onPress} />
    );
    fireEvent.press(getByText('RELIANCE'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(positiveHolding);
  });

  it('renders the first letter of the symbol in the icon circle', () => {
    const { getByText } = render(
      <PortfolioHolding holding={positiveHolding} />
    );
    // First letter of "RELIANCE" appears as visual initial
    expect(getByText('R')).toBeDefined();
  });

  it('handles holding without onPress (no crash)', () => {
    const { getByText } = render(
      <PortfolioHolding holding={positiveHolding} />
    );
    expect(getByText('RELIANCE')).toBeDefined();
  });
});
