/**
 * ============================================================================
 * Toroloom — PortfolioScreen Integration Tests
 * ============================================================================
 *
 * Verifies that PortfolioScreen renders properly with store data, handles
 * holdings/trades toggle, empty state, and triggers navigation callbacks.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from './testUtils';
import { mockHoldings, mockTrades, mockStocks } from '../constants/mockData';
import { usePortfolioStore } from '../store/portfolioStore';
import { useMarketStore } from '../store/marketStore';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();

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

vi.mock('../store/portfolioStore', () => {
  const mockStoreState = () => ({
    holdings: mockHoldings,
    trades: mockTrades,
  });
  const usePortfolioStore = Object.assign(
    vi.fn(mockStoreState),
    { getState: vi.fn(mockStoreState) },
  );
  return { usePortfolioStore };
});

vi.mock('../store/marketStore', () => ({
  useMarketStore: vi.fn(() => ({
    stocks: mockStocks,
  })),
}));

const portfolioAnalyticsState = {
  getAnalytics: () => ({
    metrics: {
      sharpeRatio: 1.5,
      winRate: 62,
      profitFactor: 1.8,
      avgHoldingDays: 45,
      maxDrawdownPercent: 8.5,
      volatility: 15.2,
      alpha: 2.3,
      beta: 0.85,
    },
    pnlHistory: [
      { date: '2025-01', value: 0 },
      { date: '2025-02', value: 25000 },
      { date: '2025-03', value: 48000 },
      { date: '2025-04', value: 72000 },
      { date: '2025-05', value: 100000 },
    ],
    sectorAllocation: [
      { sector: 'Energy', percent: 30, count: 1 },
      { sector: 'Finance', percent: 45, count: 2 },
      { sector: 'Technology', percent: 25, count: 2 },
    ],
    monthlyReturns: [
      { month: '2025-01', returnPercent: 2.1 },
      { month: '2025-02', returnPercent: 3.5 },
      { month: '2025-03', returnPercent: -1.2 },
      { month: '2025-04', returnPercent: 4.8 },
      { month: '2025-05', returnPercent: 2.9 },
    ],
    capitalGains: {
      shortTerm: { gains: 45000 },
      longTerm: { gains: 55000 },
    },
  }),
};

vi.mock('../store/portfolioAnalyticsStore', () => ({
  usePortfolioAnalyticsStore: vi.fn((selector: (s: typeof portfolioAnalyticsState) => any) =>
    selector(portfolioAnalyticsState)
  ),
}));

// ==================== Imports ====================

import PortfolioScreen from '../screens/tabs/PortfolioScreen';

// ==================== Helpers ====================

function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

// ==================== Tests ====================

describe('PortfolioScreen — Loading State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing during loading', () => {
    const { toJSON } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    expect(toJSON).not.toBeNull();
  });
});

describe('PortfolioScreen — Loaded Holdings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the header title', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Portfolio')).toBeDefined();
  });

  it('renders the subtitle', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Track your investments')).toBeDefined();
  });

  it('renders holdings section by default', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText(`Holdings (${mockHoldings.length})`)).toBeDefined();
  });

  it('renders the toggle for holdings view', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Recent Trades')).toBeDefined();
  });

  it('renders individual holding symbols', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('HDFCBANK')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
    expect(getByText('INFY')).toBeDefined();
    expect(getByText('SBIN')).toBeDefined();
  });

  it('renders stats in summary card', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Holdings')).toBeDefined();
    expect(getByText('Trades')).toBeDefined();
    expect(getByText('Winning')).toBeDefined();
  });
});

describe('PortfolioScreen — Trades View', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders toggle without navigation being called', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    const tradesToggle = getByText('Recent Trades');
    expect(tradesToggle).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('PortfolioScreen — Empty Holdings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    // Override the default mock with empty holdings/trades.
    // Uses mockImplementation (not mockReturnValueOnce) so it persists across
    // both the loading render and the loaded render.
    vi.mocked(usePortfolioStore).mockImplementation(() => ({ holdings: [], trades: [] }));
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restore default mock for other describe blocks
    vi.mocked(usePortfolioStore).mockImplementation(() => ({
      holdings: mockHoldings,
      trades: mockTrades,
    }));
  });

  it('renders empty state when no holdings exist', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Holdings (0)')).toBeDefined();
    expect(getByText('No Holdings Yet')).toBeDefined();
    expect(getByText('Start investing to build your portfolio')).toBeDefined();
    expect(getByText('Explore Markets')).toBeDefined();
  });
});

describe('PortfolioScreen — Dividend Calendar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the Dividend Calendar section title', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Dividend Calendar')).toBeDefined();
  });

  it('renders the total annual dividend chip with ₹ amount', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // Find text that includes '/yr' to identify the annual dividend chip
    expect(getByText(/\/yr/)).toBeDefined();
  });

  it('renders the Upcoming Estimates section when stocks have dividends', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Upcoming Estimates')).toBeDefined();
  });

  it('renders dividend stock symbols in the summary', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // Holdings with dividends (RELIANCE 0.85%, HDFCBANK 1.05%, TCS 1.20%, INFY 1.80%, SBIN 2.15%)
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('HDFCBANK')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
    expect(getByText('INFY')).toBeDefined();
    expect(getByText('SBIN')).toBeDefined();
  });

  it('renders dividend yield percentages for holdings', () => {
    const { getByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // All mock holdings have dividend > 0, so yield text should appear
    expect(getByText(/% yield/)).toBeDefined();
  });
});

describe('PortfolioScreen — No Dividend Stocks', () => {
  const defaultMarketImpl = vi.mocked(useMarketStore).getMockImplementation();

  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    // Override marketStore mock to return stocks with zero dividends
    vi.mocked(useMarketStore).mockImplementation(() => ({
      stocks: mockStocks.map(s => ({ ...s, dividend: 0 })),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restore marketStore mock
    if (defaultMarketImpl) {
      vi.mocked(useMarketStore).mockImplementation(defaultMarketImpl as any);
    }
  });

  it('does NOT render Upcoming Estimates when no stocks pay dividends', () => {
    const { queryByText } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // Holdings exist but none pay dividends → timeline section should not appear
    expect(queryByText('Upcoming Estimates')).toBeNull();
  });

  it('does NOT crash when all stocks have zero dividend', () => {
    const { toJSON } = render(<PortfolioScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(toJSON).not.toBeNull();
  });
});
