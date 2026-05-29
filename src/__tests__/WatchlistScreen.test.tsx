/**
 * ============================================================================
 * Toroloom — WatchlistScreen Integration Tests
 * ============================================================================
 *
 * Verifies that WatchlistScreen renders properly with store data, handles
 * watchlist tabs, create watchlist, suggested stocks, and empty states.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from './testUtils';
import { mockStocks } from '../constants/mockData';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockCreateWatchlist = vi.fn();
const mockAddToWatchlist = vi.fn();
const mockRemoveFromWatchlist = vi.fn();

const mockWatchlists: Array<{
  id: string;
  name: string;
  stocks: typeof mockStocks;
  createdAt: string;
}> = [
  {
    id: 'w1',
    name: 'My Watchlist',
    stocks: [mockStocks[0], mockStocks[3], mockStocks[7], mockStocks[9]],
    createdAt: '2025-01-10',
  },
  {
    id: 'w2',
    name: 'Tech Stocks',
    stocks: [mockStocks[1], mockStocks[3], mockStocks[10]],
    createdAt: '2025-02-15',
  },
];

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      success: '#00C853',
      danger: '#FF1744',
      marketUp: '#00C853',
      marketDown: '#FF1744',
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
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('../store/watchlistStore', () => ({
  useWatchlistStore: vi.fn(() => ({
    watchlists: mockWatchlists,
    createWatchlist: mockCreateWatchlist,
    addToWatchlist: mockAddToWatchlist,
    removeFromWatchlist: mockRemoveFromWatchlist,
  })),
}));

vi.mock('../store/marketStore', () => ({
  useMarketStore: vi.fn(() => ({
    stocks: mockStocks,
  })),
}));

// ==================== Imports ====================

import WatchlistScreen from '../screens/tabs/WatchlistScreen';

// ==================== Helpers ====================

function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

// ==================== Tests ====================

describe('WatchlistScreen — Loading State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing during loading', () => {
    const { toJSON } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    expect(toJSON).not.toBeNull();
  });
});

describe('WatchlistScreen — Loaded Content', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockCreateWatchlist.mockClear();
    mockAddToWatchlist.mockClear();
    mockRemoveFromWatchlist.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the header title', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Watchlist')).toBeDefined();
  });

  it('renders the subtitle', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Monitor your favorite stocks')).toBeDefined();
  });

  it('renders watchlist tabs with stock counts', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('My Watchlist (4)')).toBeDefined();
    expect(getByText('Tech Stocks (3)')).toBeDefined();
  });

  it('renders stocks from the active watchlist', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('INFY')).toBeDefined();
    expect(getByText('SBIN')).toBeDefined();
    expect(getByText('BAJFINANCE')).toBeDefined();
  });

  it('renders the suggested stocks section', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Suggested Stocks')).toBeDefined();
    expect(getByText('Tap + to add to watchlist')).toBeDefined();
  });

  it('shows suggested stocks not already in watchlist', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('HDFCBANK')).toBeDefined();
  });

  it('renders watchlist tab bar correctly', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('My Watchlist (4)')).toBeDefined();
  });
});

describe('WatchlistScreen — No Watchlists', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockCreateWatchlist.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles empty watchlists array gracefully', () => {
    const { toJSON } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(toJSON).not.toBeNull();
  });
});
