/**
 * ============================================================================
 * Toroloom — USStockDetailScreen Tests
 * ============================================================================
 *
 * Verifies the hybrid TradingView ⇄ SnapTrade wiring on the US stock detail
 * screen:
 *
 *   1. Provider sync — when the stock loads, tickerProvider.selectSymbol is
 *      called with symbol / exchange / name / price, so the SnapTrade order
 *      panel opens pre-selected to this instrument.
 *   2. Trade CTA — the Trade button navigates to SnapTradeOrder carrying the
 *      symbol / name / price params (belt-and-braces alongside the provider).
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/USStockDetailScreen.test.tsx
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockUSStocks } from '../constants/mockData';

// ──── Hoisted mocks ────────────────────────────────────────────────────────

const { mockSelectSymbol, mockGetQuote, mockGetTickerLevels, providerState } = vi.hoisted(() => ({
  mockSelectSymbol: vi.fn(),
  mockGetQuote: vi.fn(),
  mockGetTickerLevels: vi.fn(),
  // Simulates the real singleton: selectSymbol stores the active ticker,
  // useTicker reads it back (so the provider-driven overlay picks it up).
  providerState: { value: null as { symbol: string; exchange?: string } | null },
}));

const mockNavigate = vi.fn();

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', secondary: '#FF6B6B', success: '#00C853', danger: '#FF1744',
      marketUp: '#00C853', marketDown: '#FF1744', marketNeutral: '#FFC107',
      text: '#FFFFFF', textSecondary: '#B0B0D0', textMuted: '#6E6E9A',
      bg: '#0D0D2B', bgSecondary: '#1A1A3E', bgCard: '#222255', bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A', bgDark: '#070720', border: '#2A2A5E', borderLight: '#3A3A7E',
      divider: '#1E1E4A',
    },
    isDark: true,
  }),
}));

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => {
      // Keep the Trade CTA assertion meaningful; fall back to last segment.
      if (key === 'snaptrade.trade') return 'Trade';
      // Live-position overlay labels (used by PositionLevelsOverlay).
      const OVERLAY: Record<string, string> = {
        'trading.positionLive': 'LIVE',
        'trading.positionAvgBuy': 'AVG BUY',
        'trading.positionStop': 'STOP',
        'trading.positionTarget': 'TARGET',
        'trading.positionNoPosition': 'No open position',
        'trading.positionViewOnly': 'View-only',
      };
      if (OVERLAY[key]) return OVERLAY[key];
      return key.split('.').pop() || key;
    },
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

vi.mock('../services/api/globalMarkets', () => ({
  globalMarketsApi: {
    getQuote: (...args: unknown[]) => mockGetQuote(...args),
  },
}));

// TradingViewChart embeds a WebView — replace with a lightweight stub.
vi.mock('../components/TradingViewChart', () => ({
  default: () => null,
}));

// snapTradeApi.getTickerLevels is used by the live-position overlay rendered
// over the chart — reject by default so it degrades to the no-position strip.
vi.mock('../services/api', () => ({
  snapTradeApi: {
    getTickerLevels: (...args: unknown[]) => mockGetTickerLevels(...args),
  },
}));

// Ticker Provider — spy on selectSymbol to assert the hybrid wiring, and
// expose useTicker backed by the same shared state so the provider-driven
// live-position overlay follows the selected symbol.
vi.mock('../services/tickerProvider', () => ({
  tickerProvider: {
    selectSymbol: (opts: { symbol: string; exchange?: string }) => {
      mockSelectSymbol(opts);
      providerState.value = opts;
      return opts;
    },
  },
  useTicker: () => providerState.value,
  useExecutionPrice: () => null,
}));

import USStockDetailScreen from '../screens/stock/USStockDetailScreen';

const AAPL = mockUSStocks[0];

function makeRoute(symbol = 'AAPL') {
  return { params: { stockId: symbol, symbol, source: 'us' } };
}

async function renderScreen(symbol?: string) {
  const result = render(
    <USStockDetailScreen route={makeRoute(symbol) as any} navigation={{ navigate: mockNavigate  } as any} />,
  );
  // Flush the async quote fetch (rejected → mock data stays).
  await act(async () => {
    await Promise.resolve();
  });
  return result;
}

describe('USStockDetailScreen — Ticker Provider sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerState.value = null;
    mockGetQuote.mockRejectedValue(new Error('quote unavailable'));
  });

  it('pre-selects the viewed stock in the Ticker Provider on load', async () => {
    await renderScreen('AAPL');

    expect(mockSelectSymbol).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'AAPL',
        exchange: AAPL.exchange,
        name: AAPL.name,
        price: AAPL.price,
      }),
    );
  });

  it('re-selects when the live quote updates the price', async () => {
    mockGetQuote.mockResolvedValue({
      price: 250.75,
      change: 16.25,
      changePercent: 6.93,
      isPositive: true,
    });

    await renderScreen('AAPL');

    // The last selectSymbol call must carry the LIVE price, not the mock one.
    const lastCall = mockSelectSymbol.mock.calls[mockSelectSymbol.mock.calls.length - 1][0];
    expect(lastCall).toMatchObject({ symbol: 'AAPL', price: 250.75 });
  });

  it('falls back to mock data (and still syncs) when the quote API fails', async () => {
    mockGetQuote.mockRejectedValue(new Error('down'));

    await renderScreen('AAPL');

    expect(mockSelectSymbol).toHaveBeenCalled();
    const lastCall = mockSelectSymbol.mock.calls[mockSelectSymbol.mock.calls.length - 1][0];
    expect(lastCall).toMatchObject({ symbol: 'AAPL', price: AAPL.price });
  });
});

describe('USStockDetailScreen — Trade CTA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerState.value = null;
    mockGetQuote.mockRejectedValue(new Error('quote unavailable'));
  });

  it('navigates to SnapTradeOrder with symbol/name/price when Trade is pressed', async () => {
    const { getByText } = await renderScreen('AAPL');

    fireEvent.press(getByText('Trade'));

    expect(mockNavigate).toHaveBeenCalledWith('SnapTradeOrder', {
      symbol: 'AAPL',
      name: AAPL.name,
      price: AAPL.price,
    });
  });
});

describe('USStockDetailScreen — Live Position Overlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    providerState.value = null;
    mockGetQuote.mockRejectedValue(new Error('quote unavailable'));
  });

  it('renders the live-position tag over the chart when a position exists', async () => {
    mockGetTickerLevels.mockResolvedValue({
      success: true,
      connected: true,
      symbol: 'AAPL',
      position: { symbol: 'AAPL', quantity: 10, avgCost: 150, price: 160, pnl: 100, pnlPercent: 6.67 },
      levels: { dailyLossLimit: 50000, dailyLossPercentLimit: 5, maxPositionSizePercent: 20 },
      ironLockActive: false,
      lockdownStatus: 'none',
    });

    const { getByText } = await renderScreen('AAPL');

    expect(mockGetTickerLevels).toHaveBeenCalledWith('AAPL');
    expect(getByText('LIVE')).toBeDefined();
    // AVG BUY chip shows the position's average cost.
    expect(getByText('$150.00')).toBeDefined();
  });

  it('STOP chip opens SnapTradeOrder pre-filled with the position stop level', async () => {
    mockGetTickerLevels.mockResolvedValue({
      success: true,
      connected: true,
      symbol: 'AAPL',
      position: { symbol: 'AAPL', quantity: 10, avgCost: 150, price: 160, pnl: 100, pnlPercent: 6.67 },
      levels: { dailyLossLimit: 50000, dailyLossPercentLimit: 5, maxPositionSizePercent: 20 },
      ironLockActive: false,
      lockdownStatus: 'none',
    });

    const { getByText } = await renderScreen('AAPL');

    // The mount effect already pre-selects once — the chip tap must add one
    // more selectSymbol (the helper's own pre-select) before navigating.
    const callsBefore = mockSelectSymbol.mock.calls.length;
    fireEvent.press(getByText('STOP'));

    expect(mockSelectSymbol.mock.calls.length).toBe(callsBefore + 1);
    expect(mockNavigate).toHaveBeenCalledWith('SnapTradeOrder', {
      symbol: 'AAPL',
      name: AAPL.name,
      price: AAPL.price,
      prefillStop: 142.5,
    });
  });

  it('TARGET chip opens SnapTradeOrder pre-filled with the position target level', async () => {
    mockGetTickerLevels.mockResolvedValue({
      success: true,
      connected: true,
      symbol: 'AAPL',
      position: { symbol: 'AAPL', quantity: 10, avgCost: 150, price: 160, pnl: 100, pnlPercent: 6.67 },
      levels: { dailyLossLimit: 50000, dailyLossPercentLimit: 5, maxPositionSizePercent: 20 },
      ironLockActive: false,
      lockdownStatus: 'none',
    });

    const { getByText } = await renderScreen('AAPL');

    fireEvent.press(getByText('TARGET'));

    expect(mockNavigate).toHaveBeenCalledWith('SnapTradeOrder', {
      symbol: 'AAPL',
      name: AAPL.name,
      price: AAPL.price,
      prefillLimit: 165,
    });
  });

  it('degrades gracefully when the levels fetch fails', async () => {
    mockGetTickerLevels.mockRejectedValue(new Error('backend down'));

    const { queryByText } = await renderScreen('AAPL');

    // No LIVE tag — the overlay falls back to the no-position strip.
    expect(queryByText('LIVE')).toBeNull();
  });
});
