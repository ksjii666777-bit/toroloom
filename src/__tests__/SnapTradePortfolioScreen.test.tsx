/**
 * ============================================================================
 * Toroloom — SnapTradePortfolioScreen Hybrid Ticker Provider Tests
 * ============================================================================
 *
 * Verifies that tapping a holding in the SnapTrade portfolio pre-selects the
 * instrument in the Ticker Provider (US exchange → NASDAQ) so the order panel
 * opens pre-filled with the same symbol, chart and execution price.
 *
 * Run: npx vitest run src/__tests__/SnapTradePortfolioScreen.test.tsx
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

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

const mockGetHoldings = vi.fn();
const mockGetPositions = vi.fn();
const mockGetAccounts = vi.fn();
const mockGetStatus = vi.fn();

vi.mock('../services/api', () => ({
  api: { get: vi.fn().mockResolvedValue({ data: [] }) },
  snapTradeApi: {
    status: (...args: unknown[]) => mockGetStatus(...args),
    getHoldings: (...args: unknown[]) => mockGetHoldings(...args),
    getPositions: (...args: unknown[]) => mockGetPositions(...args),
    getAccounts: (...args: unknown[]) => mockGetAccounts(...args),
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

import SnapTradePortfolioScreen from '../screens/snaptrade/SnapTradePortfolioScreen';

// ==================== Fixtures ====================

const mockHoldings = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    quantity: 10,
    price: 180.5,
    avgCost: 150.25,
    pnl: 302.5,
    pnlPercent: 20.13,
    currency: 'USD',
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    quantity: 5,
    price: 420.75,
    avgCost: 380.0,
    pnl: 203.75,
    pnlPercent: 10.72,
    currency: 'USD',
  },
];

// ==================== Helpers ====================

async function advanceAndFlush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderConnectedScreen() {
  mockGetStatus.mockResolvedValue({ connected: true });
  mockGetHoldings.mockResolvedValue({ data: mockHoldings, count: mockHoldings.length });
  mockGetPositions.mockResolvedValue({ data: [], count: 0 });
  mockGetAccounts.mockResolvedValue({ data: [], count: 0 });
  const result = render(
    <SnapTradePortfolioScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any} route={{ params: {} } as any} />,
  );
  await advanceAndFlush();
  await advanceAndFlush();
  return result;
}

// ==================== Tests ====================

describe('SnapTradePortfolioScreen — Ticker Provider Pre-fill', () => {
  beforeEach(() => {
    mockSelectSymbol.mockClear();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('pre-selects the holding (NASDAQ) before opening the order panel', async () => {
    const { getByText } = await renderConnectedScreen();

    act(() => {
      fireEvent.press(getByText('AAPL'));
    });

    expect(mockSelectSymbol).toHaveBeenCalledWith({
      symbol: 'AAPL',
      exchange: 'NASDAQ',
      name: 'Apple Inc.',
      price: 180.5,
    });
    expect(mockNavigate).toHaveBeenCalledWith('SnapTradeOrder', {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 180.5,
    });
  });

  it('pre-selects a second holding with its own data', async () => {
    const { getByText } = await renderConnectedScreen();

    act(() => {
      fireEvent.press(getByText('MSFT'));
    });

    expect(mockSelectSymbol).toHaveBeenCalledWith({
      symbol: 'MSFT',
      exchange: 'NASDAQ',
      name: 'Microsoft Corp.',
      price: 420.75,
    });
  });

  it('does not touch the ticker provider while just loading', async () => {
    await renderConnectedScreen();
    expect(mockSelectSymbol).not.toHaveBeenCalled();
  });
});
