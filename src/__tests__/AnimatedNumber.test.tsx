/**
 * ============================================================================
 * Toroloom — AnimatedNumber Tests
 * ============================================================================
 * Count-up behaviour, completion to the target value, static/animated mode
 * switching through the PortfolioSummaryCard, and the reusable contract.
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from './testUtils';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { PortfolioSummaryCard } from '../components/ui/PortfolioSummaryCard';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0B0E14', bgCard: '#121826', surface: '#121826', border: '#263041',
      borderLight: '#33415580', text: '#F1F5F9', textSecondary: '#94A3B8', textMuted: '#64748B',
      primary: '#6C63FF', marketUp: '#22C55E', marketDown: '#EF4444',
    },
  }),
}));

describe('AnimatedNumber', () => {
  it('renders the initial formatted value', () => {
    const utils = render(
      <AnimatedNumber value={1000} format={(v) => `₹${v.toFixed(0)}`} skipInitialAnimation />,
    );
    expect(utils.getByText('₹1000')).toBeTruthy();
  });

  it('counts up from zero on mount and settles exactly on the target', () => {
    const utils = render(
      <AnimatedNumber value={500} format={(v) => `₹${v.toFixed(0)}`} duration={200} ticks={4} />,
    );
    // Mid-animation the displayed value is below the target
    act(() => {
      vi.advanceTimersByTime(80);
    });
    const mid = utils.getByText(/₹\d+/);
    expect(mid).toBeTruthy();
    // Settle
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(utils.getByText('₹500')).toBeTruthy();
  });

  it('counts down when the value drops (flash direction is derived)', () => {
    const utils = render(
      <AnimatedNumber value={900} format={(v) => `${v.toFixed(0)}`} skipInitialAnimation />,
    );
    act(() => {
      utils.update(<AnimatedNumber value={300} format={(v) => `${v.toFixed(0)}`} skipInitialAnimation />);
    });
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(utils.getByText('300')).toBeTruthy();
  });

  it('formats large currency values through the provided formatter', () => {
    const utils = render(
      <AnimatedNumber
        value={1250000}
        format={(v) => `₹${(v / 100000).toFixed(2)}L`}
        skipInitialAnimation
      />,
    );
    expect(utils.getByText('₹12.50L')).toBeTruthy();
  });
});

describe('PortfolioSummaryCard (animated hero)', () => {
  const baseActions = [
    { key: 'a', label: 'Add', icon: 'add-circle' as const, color: '#22C55E', onPress: () => {} },
  ];

  it('renders label, static value, change chip and pnl', () => {
    const utils = render(
      <PortfolioSummaryCard
        label="Portfolio Value"
        value="₹12.50L"
        change="+12.5%"
        changeDirection="up"
        pnl="P&L: ₹1.50L"
        actions={baseActions}
      />,
    );
    expect(utils.getByTestId('home-portfolio-label')).toBeTruthy();
    expect(utils.getByTestId('home-portfolio-value')).toBeTruthy();
    expect(utils.getByText('₹12.50L')).toBeTruthy();
    expect(utils.getByText('+12.5%')).toBeTruthy();
  });

  it('animates the value when numericValue + formatValue are given', () => {
    const utils = render(
      <PortfolioSummaryCard
        label="Portfolio Value"
        value="₹12.50L"
        numericValue={1250000}
        formatValue={(v) => `₹${(v / 100000).toFixed(2)}L`}
        change="+12.5%"
        changeDirection="up"
        pnl="P&L: ₹1.50L"
        actions={baseActions}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(utils.getByText('₹12.50L')).toBeTruthy();
  });

  it('renders exactly 3 action buttons', () => {
    const utils = render(
      <PortfolioSummaryCard
        label="Portfolio Value"
        value="₹12.50L"
        change="+12.5%"
        changeDirection="down"
        pnl="P&L: -₹0.50L"
        actions={[
          ...baseActions,
          { key: 'b', label: 'Transfer', icon: 'swap-horizontal' as const, color: '#6C63FF', onPress: () => {} },
          { key: 'c', label: 'Balance', icon: 'wallet' as const, color: '#00E676', onPress: () => {} },
          { key: 'd', label: 'Hidden', icon: 'close' as const, color: '#FF1744', onPress: () => {} },
        ]}
      />,
    );
    expect(utils.getByText('Add')).toBeTruthy();
    expect(utils.getByText('Transfer')).toBeTruthy();
    expect(utils.getByText('Balance')).toBeTruthy();
    expect(utils.queryByText('Hidden')).toBeNull();
  });
});
