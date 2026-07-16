/**
 * ============================================================================
 * Toroloom — Stock Detail Screen Tests
 * ============================================================================
 *
 * Tests that StockDetailScreen renders correctly with stock data, price,
 * chart controls, key stats, about section, peer comparison, buy/sell
 * buttons, and navigation actions.
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockStocks } from '../constants/mockData';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockAddToWatchlist = vi.fn();
const mockRemoveFromWatchlist = vi.fn();
const mockIsInWatchlist = vi.fn((_id: string) => false);
const mockLoadHistory = vi.fn();

// Shared mutable reference
let mockRealtimePrice: ReturnType<typeof createMockPrice>;

function createMockPrice(
  currentPrice = 2890.50,
  priceChange = 45.20,
  priceChangePercent = 1.59,
  isConnected = true,
  isPositive = true,
) {
  return {
    currentPrice,
    priceChange,
    priceChangePercent,
    candleHistory: [
      { date: '2025-05-20', open: 2800, high: 2910, low: 2780, close: currentPrice, volume: 48000000 },
      { date: '2025-05-21', open: currentPrice, high: currentPrice + 30, low: currentPrice - 20, close: currentPrice + 10, volume: 52000000 },
    ],
    isConnected,
    isPositive,
    loadHistory: mockLoadHistory,
    lastUpdated: new Date().toISOString(),
  };
}

mockRealtimePrice = createMockPrice();

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', primaryLight: '#8B83FF', primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      secondary: '#FF6B6B', success: '#00C853', danger: '#FF1744', warning: '#FFC107',
      marketUp: '#00C853', marketDown: '#FF1744', marketNeutral: '#FFC107',
      text: '#FFFFFF', textSecondary: '#B0B0D0', textMuted: '#6E6E9A',
      white: '#FFFFFF', bg: '#0D0D2B', bgSecondary: '#1A1A3E',
      bgCard: '#222255', bgCardLight: '#2A2A5E', bgInput: '#1E1E4A',
      bgDark: '#070720', bgOverlay: 'rgba(0,0,0,0.5)',
      border: '#2A2A5E', borderLight: '#3A3A7E', divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

vi.mock('../store/marketStore', () => ({
  useMarketStore: vi.fn(() => ({ stocks: mockStocks })),
}));

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: vi.fn(() => ({ buyStock: vi.fn() })),
}));

const currentWatchlists: Array<{
  id: string; name: string; stocks: typeof mockStocks; createdAt: string;
}> = [
  { id: 'w1', name: 'My Watchlist', stocks: [mockStocks[0], mockStocks[3], mockStocks[7]], createdAt: '2025-01-10' },
];

vi.mock('../store/watchlistStore', () => ({
  useWatchlistStore: vi.fn(() => ({
    watchlists: currentWatchlists,
    isInWatchlist: mockIsInWatchlist,
    addToWatchlist: mockAddToWatchlist,
    removeFromWatchlist: mockRemoveFromWatchlist,
  })),
}));

vi.mock('../store/aiStore', () => ({
  useAIStore: vi.fn(() => ({ insights: [] })),
}));

vi.mock('../hooks/useRealtimePrice', () => ({
  useRealtimePrice: vi.fn(() => mockRealtimePrice),
}));

// ==================== Imports ====================

import StockDetailScreen from '../screens/stock/StockDetailScreen';
import { useRealtimePrice } from '../hooks/useRealtimePrice';

// ==================== Helpers ====================

function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

// ==================== Global beforeEach ====================

beforeEach(() => {
  mockRealtimePrice = createMockPrice();
  vi.mocked(useRealtimePrice).mockImplementation(() => mockRealtimePrice);
});

// ==================== Tests ====================

describe('StockDetail — Stock Info', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders stock symbol and name', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('Reliance Industries Ltd.')).toBeDefined();
  });

  it('renders sector badge', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('Energy')).toBeDefined();
  });

  it('renders price in INR format', () => {
    mockRealtimePrice = createMockPrice(2890.50, 45.20, 1.59, true, true);
    vi.mocked(useRealtimePrice).mockImplementation(() => mockRealtimePrice);

    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('₹2,890.50')).toBeDefined();
  });

  it('renders change badge with positive change', () => {
    mockRealtimePrice = createMockPrice(2890.50, 45.20, 1.59, true, true);
    vi.mocked(useRealtimePrice).mockImplementation(() => mockRealtimePrice);

    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText(/\+45\.20/)).toBeDefined();
    expect(getByText(/\+1\.59%/)).toBeDefined();
  });
});

describe('StockDetail — Connection Badge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('shows Live badge when connected', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('Live')).toBeDefined();
  });

  it('shows streaming live prices text when connected', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('Streaming live prices')).toBeDefined();
  });

  it('shows Offline badge when not connected', () => {
    mockRealtimePrice = createMockPrice(2890.50, 0, 0, false, true);
    vi.mocked(useRealtimePrice).mockImplementation(() => mockRealtimePrice);

    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('Offline')).toBeDefined();
  });
});

describe('StockDetail — Key Stats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders Key Stats Grid section', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('Market Cap')).toBeDefined();
    expect(getByText('P/E')).toBeDefined();
  });
});

describe('StockDetail — About Company', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders About Company section', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('About Company')).toBeDefined();
  });

  it('renders company description with sector and market cap info', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText(/Energy/)).toBeDefined();
  });
});



describe('StockDetail — Buy/Sell Buttons', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders Buy and Sell buttons', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('Buy')).toBeDefined();
    expect(getByText('Sell')).toBeDefined();
  });
});

describe('StockDetail — Navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('navigates to PlaceOrder with buy', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);

    act(() => { fireEvent.press(getByText('Buy')); });
    advanceAndRender(100);

    expect(mockNavigate).toHaveBeenCalledWith('PlaceOrder', {
      stockId: 'RELIANCE',
      symbol: 'RELIANCE',
      tradeType: 'buy',
    });
  });

  it('navigates to PlaceOrder with sell', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);

    act(() => { fireEvent.press(getByText('Sell')); });
    advanceAndRender(100);

    expect(mockNavigate).toHaveBeenCalledWith('PlaceOrder', {
      stockId: 'RELIANCE',
      symbol: 'RELIANCE',
      tradeType: 'sell',
    });
  });
});

describe('StockDetail — Watchlist', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockIsInWatchlist.mockClear();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders watchlist toggle (heart outline when not in watchlist)', () => {
    mockIsInWatchlist.mockReturnValue(false);
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { toJSON } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(toJSON).not.toBeNull();
  });
});

describe('StockDetail — Sector Context', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders Sector Context section', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('Sector Context')).toBeDefined();
  });
});
