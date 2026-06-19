/**
 * ============================================================================
 * Toroloom — WatchlistScreen Integration Tests
 * ============================================================================
 *
 * Verifies that WatchlistScreen renders properly with store data, handles
 * watchlist tabs, create watchlist, suggested stocks, empty states,
 * smart sorting, price alert functionality, and combined All view.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockStocks } from '../constants/mockData';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockCreateWatchlist = vi.fn();
const mockAddToWatchlist = vi.fn();
const mockRemoveFromWatchlist = vi.fn();
const mockAddPriceAlertRule = vi.fn();

// Dynamic store mock — describe blocks set this to change return data
const mockStoreData = vi.hoisted(() => ({ value: 'default' }));

const defaultWatchlists: Array<{
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

const singleWatchlist = [defaultWatchlists[0]];
const emptyWatchlists: typeof defaultWatchlists = [];

function getStoreWatchlists() {
  if (mockStoreData.value === 'single') return singleWatchlist;
  if (mockStoreData.value === 'empty') return emptyWatchlists;
  return defaultWatchlists; // 'multi' or default
}

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', secondary: '#FF6B6B', success: '#00C853', danger: '#FF1744',
      marketUp: '#00C853', marketDown: '#FF1744',
      text: '#FFFFFF', textSecondary: '#B0B0D0', textMuted: '#6E6E9A',
      white: '#FFFFFF', bg: '#0D0D2B', bgSecondary: '#1A1A3E',
      bgCard: '#222255', bgCardLight: '#2A2A5E', bgInput: '#1E1E4A',
      bgDark: '#070720', border: '#2A2A5E', borderLight: '#3A3A7E',
      divider: '#1E1E4A', transparent: 'transparent',
    }, isDark: true,
  }),
}));

vi.mock('../store/watchlistStore', () => ({
  useWatchlistStore: vi.fn(() => ({
    watchlists: getStoreWatchlists(),
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

vi.mock('../store/notificationStore', () => ({
  useNotificationStore: vi.fn(() => ({
    priceAlertRules: [],
    addPriceAlertRule: mockAddPriceAlertRule,
  })),
}));

// ==================== Imports ====================

import WatchlistScreen from '../screens/tabs/WatchlistScreen';

// ==================== Helpers ====================

function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

// ==================== Tests ====================

describe('WatchlistScreen — Loading State', () => {
  beforeEach(() => { vi.useFakeTimers(); mockStoreData.value = 'multi'; });
  afterEach(() => { vi.useRealTimers(); });

  it('renders without crashing during loading', () => {
    const { toJSON } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    expect(toJSON).not.toBeNull();
  });
});

describe('WatchlistScreen — Single Watchlist (default view with suggested stocks)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockStoreData.value = 'single';
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders the header title', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    expect(getByText('Watchlist')).toBeDefined();
  });

  it('renders the subtitle', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    expect(getByText('Monitor your favorite stocks')).toBeDefined();
  });

  it('renders suggested stocks section', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    expect(getByText('Suggested Stocks')).toBeDefined();
  });

  it('shows suggested stocks not already in watchlist', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    expect(getByText('HDFCBANK')).toBeDefined();
  });

  it('renders sort indicator showing default sort', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    expect(getByText(/Sorted by:/)).toBeDefined();
  });

  it('renders Alert button for watchlist stocks', () => {
    const { getAllByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    const alertBtns = getAllByText('Alert');
    expect(alertBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "No alerts set" for stocks without alerts', () => {
    const { getAllByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    const noAlertTexts = getAllByText('No alerts set');
    expect(noAlertTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('opens price alert modal on long-press of a stock item', () => {
    const { getByText, queryByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    expect(queryByText('Current Price')).toBeNull();
    fireEvent.trigger(getByText('RELIANCE'), 'onLongPress');
    expect(getByText('Current Price')).toBeDefined();
  });
});

describe('WatchlistScreen — Multi-Watchlist All View', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockStoreData.value = 'multi';
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders watchlist tabs with stock counts', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    expect(getByText('My Watchlist (4)')).toBeDefined();
    expect(getByText('Tech Stocks (3)')).toBeDefined();
  });

  it('renders stocks from all watchlists combined', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
  });

  it('shows All tab with combined unique stock count', () => {
    const { getByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    // 6 unique: RELIANCE, INFY, SBIN, BAJFINANCE, TCS, HINDUNILVR (INFY deduped)
    expect(getByText('All (6)')).toBeDefined();
  });

  it('does NOT show suggested stocks in All view', () => {
    const { queryByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    expect(queryByText('Suggested Stocks')).toBeNull();
  });

  it('shows watchlist source badges for stocks in combined view', () => {
    const { root } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    // INFY is in both watchlists — should have source badges with watchlist names
    const badgeTexts = root.findAll(
      (inst: any) => typeof inst.props?.children === 'string' &&
        (inst.props.children === 'My Watchlist' || inst.props.children === 'Tech Stocks')
    );
    expect(badgeTexts.length).toBeGreaterThanOrEqual(2);
  });

  it('opens price alert modal on long-press in All view', () => {
    const { getByText, queryByText } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    expect(queryByText('Current Price')).toBeNull();
    fireEvent.trigger(getByText('RELIANCE'), 'onLongPress');
    expect(getByText('Current Price')).toBeDefined();
  });
});

describe('WatchlistScreen — No Watchlists', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockStoreData.value = 'empty';
  });

  afterEach(() => { vi.useRealTimers(); });

  it('handles empty watchlists array gracefully', () => {
    const { toJSON } = render(<WatchlistScreen navigation={{ navigate: mockNavigate }} />);
    advance(500);
    expect(toJSON).not.toBeNull();
  });
});
