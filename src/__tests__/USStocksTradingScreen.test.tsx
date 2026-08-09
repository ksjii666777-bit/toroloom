/**
 * ============================================================================
 * Toroloom — USStocksTradingScreen Hybrid Ticker Provider Tests
 * ============================================================================
 *
 * Verifies that the US Stocks trading hub pre-selects the tapped instrument
 * in the Ticker Provider so the SnapTrade order panel opens pre-filled:
 *   - BUY / SELL buttons on a stock card → tickerProvider.selectSymbol(...)
 *   - Tapping a stock card (detail) → tickerProvider.selectSymbol(...)
 *
 * Run: npx vitest run src/__tests__/USStocksTradingScreen.test.tsx
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();

// Ticker Provider — spy on selectSymbol to verify the hybrid pre-select wiring.
const { mockSelectSymbol } = vi.hoisted(() => ({
  mockSelectSymbol: vi.fn(),
}));

vi.mock('../services/tickerProvider', () => ({
  tickerProvider: {
    selectSymbol: (...args: unknown[]) => mockSelectSymbol(...args),
  },
  useTicker: () => null,
  useExecutionPrice: () => null,
}));

const mockGetStocks = vi.fn();
vi.mock('../services/api/globalMarkets', () => ({
  globalMarketsApi: {
    getStocks: (...args: unknown[]) => mockGetStocks(...args),
  },
}));

const mockApiGet = vi.fn();
vi.mock('../services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
  snapTradeApi: {
    status: vi.fn().mockResolvedValue({ connected: false }),
    placeOrder: vi.fn().mockResolvedValue({ success: true }),
    getHoldings: vi.fn().mockResolvedValue({ data: [], count: 0 }),
    getAccounts: vi.fn().mockResolvedValue({ data: [], count: 0 }),
  },
}));

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

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => {
      const seg = key.split('.').pop() || key;
      return seg.charAt(0).toUpperCase() + seg.slice(1);
    },
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

// ==================== Imports ====================

import USStocksTradingScreen from '../screens/trade/USStocksTradingScreen';

// ==================== Fixtures ====================

const mockUSStocks = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Technology',
    price: 180.5,
    change: 2.1,
    changePercent: 1.18,
    marketCap: '3.0T',
    volume: '55M',
    pe: 29.4,
    dividend: 0.5,
    exchange: 'NASDAQ',
  },
];

// ==================== Helpers ====================

async function advanceAndFlush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderScreen() {
  mockGetStocks.mockResolvedValue(mockUSStocks);
  mockApiGet.mockResolvedValue({ data: [] });
  const result = render(<USStocksTradingScreen navigation={{ navigate: mockNavigate, goBack: vi.fn() } as any} route={{ params: {} } as any} />);
  await advanceAndFlush();
  return result;
}

// ==================== Tests ====================

describe('USStocksTradingScreen — Ticker Provider Pre-fill', () => {
  beforeEach(() => {
    mockSelectSymbol.mockClear();
    mockNavigate.mockClear();
    mockGetStocks.mockResolvedValue(mockUSStocks);
    mockApiGet.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('pre-selects the stock when the BUY button is pressed', async () => {
    const { getByText } = await renderScreen();

    // Single card → single BUY button; getByText returns the deepest leaf
    // (the button label), so pressing it fires the inner onTrade handler.
    act(() => {
      fireEvent.press(getByText('Buy'));
    });

    expect(mockSelectSymbol).toHaveBeenCalledWith({
      symbol: 'AAPL',
      exchange: 'NASDAQ',
      name: 'Apple Inc.',
      price: 180.5,
    });
  });

  it('pre-selects the stock when the SELL button is pressed', async () => {
    const { getByText } = await renderScreen();

    act(() => {
      fireEvent.press(getByText('Sell'));
    });

    expect(mockSelectSymbol).toHaveBeenCalledWith({
      symbol: 'AAPL',
      exchange: 'NASDAQ',
      name: 'Apple Inc.',
      price: 180.5,
    });
  });

  it('pre-selects the stock before navigating to the detail screen', async () => {
    const { getByText } = await renderScreen();

    act(() => {
      fireEvent.press(getByText('AAPL'));
    });

    expect(mockSelectSymbol).toHaveBeenCalledWith({
      symbol: 'AAPL',
      exchange: 'NASDAQ',
      name: 'Apple Inc.',
      price: 180.5,
    });
    expect(mockNavigate).toHaveBeenCalledWith('USStockDetail', {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 180.5,
    });
  });

  it('does not touch the ticker provider while just loading', async () => {
    await renderScreen();
    expect(mockSelectSymbol).not.toHaveBeenCalled();
  });
});
