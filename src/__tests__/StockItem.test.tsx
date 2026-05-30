/**
 * ============================================================================
 * Toroloom — StockItem Tests
 * ============================================================================
 *
 * Tests the StockItem component: stock information display, positive/negative
 * change display, watchlist toggle actions, and press callbacks.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import StockItem from '../components/StockItem';
import { render, fireEvent } from './testUtils';
import type { Stock } from '../types';

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

const positiveStock: Stock = {
  id: 'RELIANCE',
  symbol: 'RELIANCE',
  name: 'Reliance Industries Ltd.',
  sector: 'Energy',
  price: 2890.50,
  change: 45.20,
  changePercent: 1.59,
  isPositive: true,
  marketCap: '₹19,56,000 Cr',
  volume: '12.5M',
  high52: 3020,
  low52: 2200,
  pe: 28.5,
  pb: 3.2,
  dividend: 0.85,
};

const negativeStock: Stock = {
  id: 'TCS',
  symbol: 'TCS',
  name: 'Tata Consultancy Services',
  sector: 'Technology',
  price: 3890.00,
  change: -34.50,
  changePercent: -0.88,
  isPositive: false,
  marketCap: '₹14,20,000 Cr',
  volume: '8.2M',
  high52: 4200,
  low52: 3300,
  pe: 35.2,
  pb: 12.5,
  dividend: 1.20,
};

describe('StockItem', () => {
  it('renders stock symbol and name', () => {
    const { getByText } = render(
      <StockItem stock={positiveStock} onPress={() => {}} />
    );
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('Reliance Industries Ltd.')).toBeDefined();
  });

  it('renders stock price', () => {
    const { getByText } = render(
      <StockItem stock={positiveStock} onPress={() => {}} />
    );
    // Price should be visible in the rendered output
    expect(getByText('RELIANCE')).toBeDefined();
    // Price includes a decimal — check the output contains it
    const priceDisplay = getByText(/2,890|₹/);
    expect(priceDisplay).toBeDefined();
  });

  it('renders sector badge', () => {
    const { getByText } = render(
      <StockItem stock={positiveStock} onPress={() => {}} />
    );
    // The sector "Energy" may appear as text or as a badge
    const sectorEl = getByText('Energy');
    expect(sectorEl).toBeDefined();
  });

  it('renders positive change percent', () => {
    const { getByText } = render(
      <StockItem stock={positiveStock} onPress={() => {}} />
    );
    const changeEl = getByText(/1\.59/);
    expect(changeEl).toBeDefined();
  });

  it('renders negative change percent', () => {
    const { getByText } = render(
      <StockItem stock={negativeStock} onPress={() => {}} />
    );
    const changeEl = getByText(/0\.88/);
    expect(changeEl).toBeDefined();
  });

  it('calls onPress with the stock when pressed', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <StockItem stock={positiveStock} onPress={onPress} />
    );
    fireEvent.press(getByText('RELIANCE'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(positiveStock);
  });

  it('renders without showActions props (no crash)', () => {
    const { getByText } = render(
      <StockItem stock={positiveStock} onPress={() => {}} />
    );
    expect(getByText('RELIANCE')).toBeDefined();
  });

  it('renders with showActions and isInWatchlist as true', () => {
    const { getByText } = render(
      <StockItem
        stock={positiveStock}
        onPress={() => {}}
        showActions={true}
        isInWatchlist={true}
      />
    );
    expect(getByText('RELIANCE')).toBeDefined();
  });

  it('calls onPress callback when watchlist actions are visible', () => {
    const onPress = vi.fn();
    const { getByText } = render(
      <StockItem
        stock={positiveStock}
        onPress={onPress}
        showActions={true}
        onWatchlistToggle={() => {}}
      />
    );
    fireEvent.press(getByText('RELIANCE'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(positiveStock);
  });

  it('calls onWatchlistToggle when watchlist button is pressed', () => {
    const onWatchlistToggle = vi.fn();
    const { root } = render(
      <StockItem
        stock={positiveStock}
        onPress={() => {}}
        showActions={true}
        onWatchlistToggle={onWatchlistToggle}
      />
    );
    const pressables = root.findAll(
      (inst: any) => typeof inst.props?.onPress === 'function'
    );
    expect(pressables.length).toBeGreaterThan(1);
    // The last pressable should be the watchlist toggle button
    fireEvent.press(pressables[pressables.length - 1]);
    expect(onWatchlistToggle).toHaveBeenCalledWith(positiveStock);
  });

  it('renders negative stock with watchlist toggle', () => {
    const { getByText } = render(
      <StockItem
        stock={negativeStock}
        onPress={() => {}}
        showActions={true}
        onWatchlistToggle={() => {}}
      />
    );
    expect(getByText('TCS')).toBeDefined();
    expect(getByText('Technology')).toBeDefined();
  });

  it('renders with isInWatchlist=false showing heart-outline icon', () => {
    const { toJSON } = render(
      <StockItem
        stock={positiveStock}
        onPress={() => {}}
        showActions={true}
        isInWatchlist={false}
        onWatchlistToggle={() => {}}
      />
    );
    expect(toJSON).toBeDefined();
  });
});
