/**
 * ============================================================================
 * Toroloom — US Stock Detail Screen Integration Tests
 * ============================================================================
 *
 * Tests that StockDetailScreen correctly handles US stocks:
 *   - US stock detection (isUSStock) from mockUSStocks
 *   - IBKR connection states — "IBKR Live" vs "Mock" badge
 *   - USD formatting ($) for prices, stats, and bottom action bar
 *   - Exchange badge (NASDAQ / NYSE)
 *   - Mock data fallback when IBKR not connected
 *   - Sector context with US peer stocks
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockStocks} from '../constants/mockData';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockAddToWatchlist = vi.fn();
const mockRemoveFromWatchlist = vi.fn();
const mockIsInWatchlist = vi.fn((_id: string) => false);
const mockLoadHistory = vi.fn();
const mockHasValidSession = vi.fn();
const mockBuyStock = vi.fn();

// Shared mutable reference — reset in beforeEach to prevent cross-test leakage
let mockUSRealtimePrice: ReturnType<typeof createMockPrice>;

function createMockPrice(
  currentPrice = 234.50,
  priceChange = 3.45,
  priceChangePercent = 1.49,
  isConnected = true,
  isPositive = true,
) {
  return {
    currentPrice,
    priceChange,
    priceChangePercent,
    candleHistory: [
      { date: '2025-05-20', open: 231, high: 236, low: 230, close: currentPrice, volume: 48000000 },
      { date: '2025-05-21', open: currentPrice, high: currentPrice + 3, low: currentPrice - 2, close: currentPrice + 1, volume: 52000000 },
    ],
    isConnected,
    isPositive,
    loadHistory: mockLoadHistory,
    lastUpdated: new Date().toISOString(),
  };
}

mockUSRealtimePrice = createMockPrice();

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
  usePortfolioStore: vi.fn(() => ({ buyStock: mockBuyStock })),
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
  useRealtimePrice: vi.fn(() => mockUSRealtimePrice),
}));

vi.mock('../services/gateway/sessionStorage', () => ({
  hasValidSession: (...args: any[]) => mockHasValidSession(...args),
  storeBrokerSession: vi.fn(() => Promise.resolve(true)),
  clearBrokerSession: vi.fn(() => Promise.resolve(undefined)),
  parseSessionPayload: vi.fn((payload: any) => ({ ...payload, parsed: true })),
}));

// ==================== Imports ====================

import StockDetailScreen from '../screens/stock/StockDetailScreen';
import { useRealtimePrice } from '../hooks/useRealtimePrice';

// ==================== Helpers ====================

/** Advance fake timers by ms, wrapped in act() for React state flushing */
function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

/**
 * Flush pending microtasks (promise resolutions) wrapped in act().
 * This resolves async effects like the IBKR connection check.
 */
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

// ==================== Global beforeEach ====================

beforeEach(() => {
  // Reset the shared mutable mock to AAPL defaults
  mockUSRealtimePrice = createMockPrice();
  vi.mocked(useRealtimePrice).mockImplementation(() => mockUSRealtimePrice);
});

// ==================== Tests ====================

describe('US Stock — Detection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockHasValidSession.mockResolvedValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders NASDAQ exchange badge for AAPL (US stock)', () => {
    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('AAPL')).toBeDefined();
    expect(getByText('Apple Inc.')).toBeDefined();
    expect(getByText('NASDAQ')).toBeDefined();
    expect(getByText('Technology')).toBeDefined();
  });

  it('renders NYSE exchange badge for JPM (US stock)', () => {
    const route = { params: { stockId: 'JPM', symbol: 'JPM' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('NYSE')).toBeDefined();
    expect(getByText('Finance')).toBeDefined();
  });

  it('does NOT render exchange badge for Indian stock (RELIANCE)', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { queryByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(queryByText('NASDAQ')).toBeNull();
    expect(queryByText('NYSE')).toBeNull();
  });
});

describe('US Stock — IBKR Connection States', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockLoadHistory.mockClear();
  });

  afterEach(() => { vi.useRealTimers(); });

  it('shows "IBKR Live" badge when hasValidSession returns true', async () => {
    mockHasValidSession.mockResolvedValue(true);

    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );

    // Flush microtasks so the async useEffect (hasValidSession) resolves
    await flushMicrotasks();

    expect(getByText('IBKR Live')).toBeDefined();
    expect(getByText('Receiving live data from Interactive Brokers')).toBeDefined();
  });

  it('shows "Mock" badge when hasValidSession returns false', async () => {
    mockHasValidSession.mockResolvedValue(false);

    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );

    await flushMicrotasks();

    expect(getByText('Mock')).toBeDefined();
    expect(getByText('Showing simulated US market data')).toBeDefined();
  });

  it('shows "Mock" badge when hasValidSession throws', async () => {
    mockHasValidSession.mockRejectedValue(new Error('Storage error'));

    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );

    await flushMicrotasks();

    expect(getByText('Mock')).toBeDefined();
  });

  it('hides original Live/Offline badge for US stocks (only IBKR badge shown)', async () => {
    mockHasValidSession.mockResolvedValue(true);

    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText, queryByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );

    await flushMicrotasks();

    // IBKR badge should be shown for connected state
    expect(getByText('IBKR Live')).toBeDefined();
    // The original indicator text ("Streaming live prices") should NOT appear
    expect(queryByText('Streaming live prices')).toBeNull();
    expect(queryByText('Using simulated prices')).toBeNull();
    // The IBKR-specific indicator text should appear
    expect(getByText('Receiving live data from Interactive Brokers')).toBeDefined();
  });

  it('keeps Live/Offline badge for Indian stock when IBKR is irrelevant', () => {
    mockHasValidSession.mockResolvedValue(false);

    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText, queryByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);

    // Indian stock should still show the original Live/Offline badge
    expect(getByText('Live')).toBeDefined();
    // IBKR badge should NOT appear for Indian stocks
    expect(queryByText('IBKR Live')).toBeNull();
    expect(queryByText('Mock')).toBeNull();
  });
});

describe('US Stock — USD Formatting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockHasValidSession.mockResolvedValue(false);
    // Re-mock useRealtimePrice to point at the reset mockUSRealtimePrice
    vi.mocked(useRealtimePrice).mockImplementation(() => mockUSRealtimePrice);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders AAPL price in USD format ($234.50)', () => {
    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('$234.50')).toBeDefined();
  });

  it('renders LTP in USD in bottom action bar', () => {
    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);

    expect(getByText('LTP')).toBeDefined();
    expect(getByText('$234.50')).toBeDefined();
  });

  it('renders NVDA price in USD with proper formatting', () => {
    // Override mock for NVDA — reset in beforeEach prevents leakage
    mockUSRealtimePrice = createMockPrice(128.45, 5.30, 4.31, true, true);
    vi.mocked(useRealtimePrice).mockImplementation(() => mockUSRealtimePrice);

    const route = { params: { stockId: 'NVDA', symbol: 'NVDA' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('$128.45')).toBeDefined();
  });

  it('maintains INR format for Indian stocks', () => {
    // Restore mock to default AAPL values for RELIANCE (formatCurrency handles it)
    mockUSRealtimePrice = createMockPrice(2890.50, 45.20, 1.59, true, true);
    vi.mocked(useRealtimePrice).mockImplementation(() => mockUSRealtimePrice);

    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('₹2,890.50')).toBeDefined();
  });

  it('renders change badge values without currency symbol', () => {
    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText(/\+?3\.45/)).toBeDefined();
    expect(getByText(/\+?1\.49%/)).toBeDefined();
  });
});

describe('US Stock — Market Cap Display', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockHasValidSession.mockResolvedValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('displays pre-formatted US market cap ($3.68T for AAPL)', () => {
    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('Market Cap')).toBeDefined();
    expect(getByText('$3.68T')).toBeDefined();
  });

  it('displays T-format market cap for MSFT ($3.48T)', () => {
    const route = { params: { stockId: 'MSFT', symbol: 'MSFT' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('$3.48T')).toBeDefined();
  });

  it('maintains Indian market cap format for Indian stocks (₹19,56,000 Cr)', () => {
    const route = { params: { stockId: 'RELIANCE', symbol: 'RELIANCE' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('₹19,56,000 Cr')).toBeDefined();
  });
});

describe('US Stock — Peer Comparison & Sector Context', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockHasValidSession.mockResolvedValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders peer comparison table for AAPL with US tech peers', () => {
    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('Peer Comparison')).toBeDefined();
    // Tech sector peers from mockUSStocks: MSFT, GOOGL, AMZN, META, NFLX, ADBE
    expect(getByText('MSFT')).toBeDefined();
    expect(getByText('GOOGL')).toBeDefined();
    expect(getByText('YOU')).toBeDefined();
  });

  it('renders sector context for US technology sector', () => {
    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('Sector Context')).toBeDefined();
  });

  it('renders peer comparison for Finance sector stocks (JPM)', () => {
    const route = { params: { stockId: 'JPM', symbol: 'JPM' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('Peer Comparison')).toBeDefined();
    // Finance sector peers: V, BAC
    expect(getByText('V')).toBeDefined();
    expect(getByText('BAC')).toBeDefined();
  });

  it('renders US peers as clickable (navigates to StockDetail)', () => {
    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);

    act(() => {
      fireEvent.press(getByText('MSFT'));
    });
    advanceAndRender(100);

    expect(mockNavigate).toHaveBeenCalledWith('StockDetail', {
      stockId: 'MSFT',
      symbol: 'MSFT',
    });
  });
});

describe('US Stock — About Company', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockHasValidSession.mockResolvedValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders About Company section with US-specific details', () => {
    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('About Company')).toBeDefined();
    // US About card mentions exchange (NASDAQ)
    expect(getByText(/NASDAQ/)).toBeDefined();
  });
});

describe('US Stock — Navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockHasValidSession.mockResolvedValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('navigates to PlaceOrder with buy for AAPL', () => {
    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);

    act(() => {
      fireEvent.press(getByText('Buy'));
    });
    advanceAndRender(100);

    expect(mockNavigate).toHaveBeenCalledWith('PlaceOrder', {
      stockId: 'AAPL',
      symbol: 'AAPL',
      tradeType: 'buy',
    });
  });

  it('navigates to PlaceOrder with sell for AAPL', () => {
    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);

    act(() => {
      fireEvent.press(getByText('Sell'));
    });
    advanceAndRender(100);

    expect(mockNavigate).toHaveBeenCalledWith('PlaceOrder', {
      stockId: 'AAPL',
      symbol: 'AAPL',
      tradeType: 'sell',
    });
  });
});

describe('US Stock — Buy/Sell Buttons', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockHasValidSession.mockResolvedValue(false);
  });

  afterEach(() => { vi.useRealTimers(); });

  it('renders Buy and Sell buttons for US stocks', () => {
    const route = { params: { stockId: 'AAPL', symbol: 'AAPL' } };
    const { getByText } = render(
      <StockDetailScreen route={route} navigation={{ navigate: mockNavigate }} />
    );
    advanceAndRender(500);
    expect(getByText('Buy')).toBeDefined();
    expect(getByText('Sell')).toBeDefined();
  });
});
