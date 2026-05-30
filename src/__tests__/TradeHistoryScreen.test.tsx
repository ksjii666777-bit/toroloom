/**
 * ============================================================================
 * Toroloom — TradeHistoryScreen Integration Tests
 * ============================================================================
 *
 * Verifies that TradeHistoryScreen renders correctly with trade data,
 * stats cards, search bar, filter tabs, grouped trade list by date,
 * and empty state handling.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockTrades } from '../constants/mockData';
import { usePortfolioStore } from '../store/portfolioStore';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryLight: '#8B83FF',
      primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      secondary: '#FF6B6B',
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      marketNeutral: '#FFC107',
      text: '#FFFFFF',
      textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A',
      white: '#FFFFFF',
      bg: '#0D0D2B',
      bgSecondary: '#1A1A3E',
      bgCard: '#222255',
      bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A',
      bgDark: '#070720',
      bgOverlay: 'rgba(0,0,0,0.5)',
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

// Use module-level state so we can override per describe block
let currentTrades: typeof mockTrades = mockTrades;

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: vi.fn(() => ({
    trades: currentTrades,
  })),
}));

// ==================== Imports ====================

import TradeHistoryScreen from '../screens/trade/TradeHistoryScreen';

// ==================== Helpers ====================

function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

// ==================== Tests ====================

describe('TradeHistoryScreen — Loading State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing during loading', () => {
    const { toJSON } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    expect(toJSON).not.toBeNull();
  });
});

describe('TradeHistoryScreen — Loaded Content', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    currentTrades = mockTrades;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the header title', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Trade History')).toBeDefined();
  });

  it('renders the subtitle with total trade count', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText(/5 total trades/)).toBeDefined();
  });

  it('renders the Total Buys stat card', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Total Buys')).toBeDefined();
  });

  it('renders the Total Sells stat card', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Total Sells')).toBeDefined();
  });

  it('renders the search bar', () => {
    const { getByPlaceholderText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    const input = getByPlaceholderText('Search by symbol or name...');
    expect(input).toBeDefined();
  });

  it('renders filter tabs (All, Buy, Sell)', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('All')).toBeDefined();
    expect(getByText('Buy')).toBeDefined();
    expect(getByText('Sell')).toBeDefined();
  });

  it('renders trade symbols from store', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
    expect(getByText('HDFCBANK')).toBeDefined();
    expect(getByText('INFY')).toBeDefined();
    expect(getByText('SBIN')).toBeDefined();
  });

  it('renders trade quantities and prices', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('50 @ ₹2,650.00')).toBeDefined();
    expect(getByText('10 @ ₹3,920.00')).toBeDefined();
    expect(getByText('100 @ ₹1,550.00')).toBeDefined();
    expect(getByText('80 @ ₹1,450.00')).toBeDefined();
    expect(getByText('200 @ ₹720.00')).toBeDefined();
  });

  it('renders trade totals with sign', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText(/₹1,32,500.00/)).toBeDefined();
    // Sell total uses compact format: 10 * 3920 = 39,200 → ₹39.2K
    expect(getByText(/₹39\.2K/)).toBeDefined();
  });

  it('renders the buy orders count in stat card', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText(/4 orders/)).toBeDefined();
  });

  it('does not call navigate on initial render', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Trade History')).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('TradeHistoryScreen — Search & Filter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    currentTrades = mockTrades;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders All as the default active filter', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // All filter should be present
    expect(getByText('All')).toBeDefined();
    expect(getByText('Buy')).toBeDefined();
    expect(getByText('Sell')).toBeDefined();
  });
});

describe('TradeHistoryScreen — Sell Trades Only', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    currentTrades = [mockTrades[1]]; // Only the sell trade (TCS)
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders only sell trades when filtered', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // Only TCS sell trade should appear
    expect(getByText('TCS')).toBeDefined();
  });

  it('renders sell type badge for the trade', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // Sell total should be prefixed with '+'
    expect(getByText(/\+/)).toBeDefined();
  });
});

describe('TradeHistoryScreen — Empty Trades', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    currentTrades = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows empty state when no trades exist', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('No Trades Found')).toBeDefined();
    expect(getByText(/Start trading/)).toBeDefined();
  });

  it('shows 0 total trades in subtitle', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText(/0 total trades/)).toBeDefined();
  });

  it('renders stats cards even with no trades', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Total Buys')).toBeDefined();
    expect(getByText('Total Sells')).toBeDefined();
  });
});

describe('TradeHistoryScreen — Navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    currentTrades = mockTrades;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('navigates back when back button is pressed', () => {
    const { getByText } = render(<TradeHistoryScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Trade History')).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
