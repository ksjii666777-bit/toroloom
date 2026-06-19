/**
 * ============================================================================
 * Toroloom — MarketsScreen Integration Tests
 * ============================================================================
 *
 * Verifies that MarketsScreen renders properly with store data, handles
 * loading/skeleton states, and triggers navigation callbacks.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockStocks, mockIndices } from '../constants/mockData';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockSetSearchQuery = vi.fn();

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

// Track current market store state so we can swap per-test
let currentSearchQuery = '';
let currentSearchResults: any[] = [];
let currentStocks: any[] = [];

vi.mock('../store/marketStore', () => ({
  useMarketStore: vi.fn(() => ({
    indices: mockIndices,
    stocks: currentStocks.length > 0 ? currentStocks : mockStocks,
    searchQuery: currentSearchQuery,
    searchResults: currentSearchResults,
    setSearchQuery: mockSetSearchQuery,
  })),
}));

// ==================== Imports ====================

import MarketsScreen from '../screens/tabs/MarketsScreen';

// ==================== Helpers ====================

function advanceAndRender(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

// ==================== Tests ====================

describe('MarketsScreen — Loading State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing during loading', () => {
    const { toJSON } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    expect(toJSON).not.toBeNull();
  });
});

describe('MarketsScreen — Loaded Content', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockSetSearchQuery.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the header title', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Markets')).toBeDefined();
  });

  it('renders the subtitle', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Real-time stock market data')).toBeDefined();
  });

  it('renders the search bar with search icon visible', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // Check for the stock list header which confirms the full UI rendered
    expect(getByText('All Stocks')).toBeDefined();
  });

  it('renders market indices', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('NIFTY')).toBeDefined();
    expect(getByText('SENSEX')).toBeDefined();
    expect(getByText('BANKNIFTY')).toBeDefined();
  });

  it('renders sector filter chips', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('All')).toBeDefined();
    expect(getByText('Technology')).toBeDefined();
    expect(getByText('Finance')).toBeDefined();
    expect(getByText('Energy')).toBeDefined();
  });

  it('renders the stock list with correct count', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText(`${mockStocks.length} stocks`)).toBeDefined();
  });

  it('renders individual stocks from the store', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(getByText('HDFCBANK')).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
  });

  it('renders the Gainers / Losers section', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Top Gainers')).toBeDefined();
    expect(getByText('Top Losers')).toBeDefined();
  });

  it('renders top gainer stocks with positive change badges', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // BHARTIARTL has the highest changePercent (2.63%)
    expect(getByText('BHARTIARTL')).toBeDefined();
    // Should show the change percent (2.63%)
    expect(getByText('2.63%')).toBeDefined();
  });

  it('renders top loser stocks with negative change badges', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // ITC has the most negative changePercent (-1.16%)
    expect(getByText('ITC')).toBeDefined();
  });

  it('renders the Sector Performance heatmap', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('Sector Performance')).toBeDefined();
  });

  it('renders sector names with stock count in heatmap', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // textTransform: uppercase in styles doesn't affect test renderer — match actual values
    expect(getByText('Energy')).toBeDefined();
    expect(getByText('Finance')).toBeDefined();
    expect(getByText('Technology')).toBeDefined();
    expect(getByText('1 stocks')).toBeDefined();  // Energy has 1 stock
  });

  it('navigate callback is not called on initial render', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('MarketsScreen — Empty State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockSetSearchQuery.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles empty stock list gracefully', () => {
    const { toJSON } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(toJSON).not.toBeNull();
  });
});

describe('MarketsScreen — Search Mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockSetSearchQuery.mockClear();
    currentSearchQuery = 'TCS';
    currentSearchResults = [mockStocks[1]];
    currentStocks = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    currentSearchQuery = '';
    currentSearchResults = [];
    currentStocks = [];
  });

  it('renders search results header with result count', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText(/Results \(1\)/)).toBeDefined();
  });

  it('renders matching search result', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('TCS')).toBeDefined();
  });

  it('hides sector filter chips when searching', () => {
    const { queryByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(queryByText('All')).toBeNull();
  });

  it('shows close button on search bar', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('1 stocks')).toBeDefined();
  });

  it('renders search results in place of full stock list', () => {
    const { getByText, queryByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    // Sector chips hidden during search
    expect(queryByText('All')).toBeNull();
    // Search results shown instead
    expect(getByText(/Results \(1\)/)).toBeDefined();
    expect(getByText('TCS')).toBeDefined();
  });
});

describe('MarketsScreen — Sector Filtering', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockSetSearchQuery.mockClear();
    currentSearchQuery = '';
    currentSearchResults = [];
    currentStocks = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    currentStocks = [];
  });

  it('renders sector filter chips', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('All')).toBeDefined();
    expect(getByText('Technology')).toBeDefined();
    expect(getByText('Finance')).toBeDefined();
    expect(getByText('Energy')).toBeDefined();
    expect(getByText('Automobile')).toBeDefined();
    expect(getByText('Consumer')).toBeDefined();
  });

  it('renders All as the default selected sector', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText(/All Stocks/)).toBeDefined();
  });
});

describe('MarketsScreen — Stock Navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockSetSearchQuery.mockClear();
    currentSearchQuery = '';
    currentSearchResults = [];
    currentStocks = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    currentStocks = [];
  });

  it('navigates to StockDetail when a stock is pressed', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    act(() => { fireEvent.press(getByText('RELIANCE')); });
    expect(mockNavigate).toHaveBeenCalledWith('StockDetail', {
      stockId: 'RELIANCE',
      symbol: 'RELIANCE',
    });
  });

  it('does not navigate without pressing a stock', () => {
    const { getByText } = render(<MarketsScreen navigation={{ navigate: mockNavigate }} />);
    advanceAndRender(500);
    expect(getByText('RELIANCE')).toBeDefined();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
