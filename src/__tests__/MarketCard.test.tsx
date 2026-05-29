/**
 * ============================================================================
 * Toroloom — MarketCard Tests
 * ============================================================================
 *
 * Tests the MarketCard component that displays market index data with
 * gradient backgrounds, formatted currency values, and press handling.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import MarketCard from '../components/MarketCard';
import { render, fireEvent } from './testUtils';
import type { MarketIndex } from '../types';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      primary: '#6C63FF',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      text: '#1A1A2E',
      textSecondary: '#5A5A7A',
      textMuted: '#9A9AB0',
      bgCard: '#FFFFFF',
      border: '#E0E0F0',
    },
  }),
}));

const positiveIndex: MarketIndex = {
  id: 'nifty50',
  name: 'Nifty 50',
  shortName: 'NIFTY',
  currentValue: 23456.80,
  change: 345.20,
  changePercent: 1.49,
  isPositive: true,
  icon: 'trending-up',
};

const negativeIndex: MarketIndex = {
  id: 'sensex',
  name: 'BSE Sensex',
  shortName: 'SENSEX',
  currentValue: 77123.45,
  change: -123.45,
  changePercent: -0.16,
  isPositive: false,
  icon: 'trending-down',
};

describe('MarketCard', () => {
  it('renders index short name', () => {
    const { getByText } = render(<MarketCard index={positiveIndex} />);
    expect(getByText('NIFTY')).toBeDefined();
  });

  it('renders positive change value', () => {
    const { toJSON } = render(<MarketCard index={positiveIndex} />);
    const json = JSON.stringify(toJSON);
    expect(json).toContain('345');
  });

  it('renders negative change value', () => {
    const { toJSON, getByText } = render(<MarketCard index={negativeIndex} />);
    expect(getByText('SENSEX')).toBeDefined();
    const json = JSON.stringify(toJSON);
    expect(json).toContain('123');
  });

  it('calls onPress with the index data when pressed', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <MarketCard index={positiveIndex} onPress={onPress} />
    );
    fireEvent.press(getByText('NIFTY'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(positiveIndex);
  });

  it('calls onPress with negative index data', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <MarketCard index={negativeIndex} onPress={onPress} />
    );
    fireEvent.press(getByText('SENSEX'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(negativeIndex);
  });
});


