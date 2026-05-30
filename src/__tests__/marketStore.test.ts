/**
 * ============================================================================
 * Toroloom — Market Store Tests
 * ============================================================================
 *
 * Tests the market store: search functionality, stock/index data,
 * and price alert simulation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMarketStore } from '../store/marketStore';
import { marketApi } from '../services/api/market';

describe('MarketStore — Initial State', () => {
  beforeEach(() => {
    // Reset to initial (with mock data from the store definition)
    useMarketStore.setState({
      indices: [],
      stocks: [],
      selectedStock: null,
      isLoading: false,
      searchQuery: '',
      searchResults: [],
    });
  });

  it('starts with empty data when reset', () => {
    const state = useMarketStore.getState();
    expect(state.indices).toEqual([]);
    expect(state.stocks).toEqual([]);
    expect(state.selectedStock).toBeNull();
    expect(state.searchQuery).toBe('');
    expect(state.searchResults).toEqual([]);
    expect(state.isLoading).toBe(false);
  });
});

describe('MarketStore — Search', () => {
  beforeEach(() => {
    useMarketStore.setState({
      stocks: [
        { id: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', sector: 'Energy', price: 2890, change: 45, changePercent: 1.59, isPositive: true, marketCap: '₹19,56,000 Cr', volume: '12.5M', high52: 3020, low52: 2200, pe: 28.5, pb: 3.2, dividend: 0.85 },
        { id: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'Technology', price: 3890, change: -34, changePercent: -0.88, isPositive: false, marketCap: '₹14,20,000 Cr', volume: '8.2M', high52: 4200, low52: 3300, pe: 35.2, pb: 12.5, dividend: 1.20 },
        { id: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', sector: 'Finance', price: 1678, change: 23, changePercent: 1.42, isPositive: true, marketCap: '₹9,35,000 Cr', volume: '15.1M', high52: 1800, low52: 1360, pe: 18.9, pb: 2.8, dividend: 1.05 },
      ],
      searchQuery: '',
      searchResults: [],
      indices: [],
      selectedStock: null,
      isLoading: false,
    });
  });

  it('finds stocks by symbol', () => {
    useMarketStore.getState().setSearchQuery('RELIANCE');
    const state = useMarketStore.getState();
    expect(state.searchResults).toHaveLength(1);
    expect(state.searchResults[0].symbol).toBe('RELIANCE');
  });

  it('finds stocks by name (partial match)', () => {
    useMarketStore.getState().setSearchQuery('Tata');
    const state = useMarketStore.getState();
    expect(state.searchResults).toHaveLength(1);
    expect(state.searchResults[0].name).toContain('Tata');
  });

  it('returns empty results for non-matching query', () => {
    useMarketStore.getState().setSearchQuery('XYZNONEXISTENT');
    const state = useMarketStore.getState();
    expect(state.searchResults).toEqual([]);
  });

  it('clears results on empty query', () => {
    // First populate results
    useMarketStore.getState().setSearchQuery('RELIANCE');
    expect(useMarketStore.getState().searchResults.length).toBeGreaterThan(0);

    // Then clear
    useMarketStore.getState().setSearchQuery('');
    expect(useMarketStore.getState().searchResults).toEqual([]);
  });

  it('is case insensitive', () => {
    useMarketStore.getState().setSearchQuery('reliance');
    const state = useMarketStore.getState();
    expect(state.searchResults).toHaveLength(1);
    expect(state.searchResults[0].symbol).toBe('RELIANCE');
  });

  it('searches across multiple fields', () => {
    useMarketStore.getState().setSearchQuery('bank');
    const state = useMarketStore.getState();
    expect(state.searchResults).toHaveLength(1);
    expect(state.searchResults[0].symbol).toBe('HDFCBANK');
  });

  it('updates searchQuery in state', () => {
    useMarketStore.getState().setSearchQuery('TCS');
    expect(useMarketStore.getState().searchQuery).toBe('TCS');
  });
});

describe('MarketStore — Stock Selection', () => {
  const mockStock = { id: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', sector: 'Energy', price: 2890, change: 45, changePercent: 1.59, isPositive: true, marketCap: '₹19,56,000 Cr', volume: '12.5M', high52: 3020, low52: 2200, pe: 28.5, pb: 3.2, dividend: 0.85 };

  beforeEach(() => {
    useMarketStore.setState({
      indices: [],
      stocks: [],
      selectedStock: null,
      isLoading: false,
      searchQuery: '',
      searchResults: [],
    });
  });

  it('selects a stock', () => {
    useMarketStore.getState().selectStock(mockStock);
    expect(useMarketStore.getState().selectedStock?.symbol).toBe('RELIANCE');
  });

  it('replaces previously selected stock', () => {
    useMarketStore.getState().selectStock(mockStock);
    useMarketStore.getState().selectStock({ ...mockStock, id: 'TCS', symbol: 'TCS' });
    expect(useMarketStore.getState().selectedStock?.symbol).toBe('TCS');
  });
});

describe('MarketStore — Simulate Price Alert', () => {
  beforeEach(() => {
    useMarketStore.setState({
      stocks: [
        { id: 'STOCK1', symbol: 'STOCK1', name: 'Stock One', sector: 'Tech', price: 100, change: 3, changePercent: 3.0, isPositive: true, marketCap: '₹1,000 Cr', volume: '1M', high52: 150, low52: 80, pe: 20, pb: 3, dividend: 0.5 },
        { id: 'STOCK2', symbol: 'STOCK2', name: 'Stock Two', sector: 'Finance', price: 200, change: -4, changePercent: -2.0, isPositive: false, marketCap: '₹2,000 Cr', volume: '2M', high52: 300, low52: 150, pe: 15, pb: 2, dividend: 1.0 },
      ],
      indices: [],
      selectedStock: null,
      isLoading: false,
      searchQuery: '',
      searchResults: [],
    });
  });

  it('triggers alert for specific symbol', () => {
    // Just verify it doesn't throw
    expect(() => {
      useMarketStore.getState().simulatePriceAlert('STOCK1');
    }).not.toThrow();
  });

  it('triggers alerts for all high-change stocks', () => {
    expect(() => {
      useMarketStore.getState().simulatePriceAlert();
    }).not.toThrow();
  });
});

describe('MarketStore — Refresh Market', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMarketStore.setState({
      indices: [],
      stocks: [],
      selectedStock: null,
      isLoading: false,
      searchQuery: '',
      searchResults: [],
    });
  });

  it('fetches market data from backend successfully', async () => {
    const mockIndices = [
      {
        id: 'NIFTY', name: 'NIFTY 50', shortName: 'NIFTY', currentValue: 24500,
        change: 120, changePercent: 0.49, isPositive: true, icon: '📈',
      },
    ];
    const mockStocks = [
      {
        id: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries',
        sector: 'Energy', price: 2890, change: 45, changePercent: 1.59,
        isPositive: true, marketCap: '₹19,56,000 Cr', volume: '12.5M',
        high52: 3020, low52: 2200, pe: 28.5, pb: 3.2, dividend: 0.85,
      },
    ];

    vi.mocked(marketApi.getIndices).mockResolvedValueOnce(mockIndices);
    vi.mocked(marketApi.getStocks).mockResolvedValueOnce(mockStocks);

    await useMarketStore.getState().refreshMarket();

    const state = useMarketStore.getState();
    expect(state.indices).toEqual(mockIndices);
    expect(state.stocks).toEqual(mockStocks);
    expect(state.isLoading).toBe(false);
  });

  it('falls back to mock data when backend is unavailable', async () => {
    vi.mocked(marketApi.getIndices).mockRejectedValueOnce(new Error('Network error'));
    vi.mocked(marketApi.getStocks).mockRejectedValueOnce(new Error('Network error'));

    await useMarketStore.getState().refreshMarket();

    const state = useMarketStore.getState();
    expect(state.stocks.length).toBeGreaterThan(0);
    expect(state.indices.length).toBeGreaterThan(0);
    expect(state.isLoading).toBe(false);
  });

  it('sets loading state during refresh', () => {
    vi.mocked(marketApi.getIndices).mockReturnValueOnce(new Promise(() => {}));
    vi.mocked(marketApi.getStocks).mockReturnValueOnce(new Promise(() => {}));

    useMarketStore.getState().refreshMarket();

    expect(useMarketStore.getState().isLoading).toBe(true);
  });
});

describe('MarketStore — Backend Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMarketStore.setState({
      stocks: [
        {
          id: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.',
          sector: 'Energy', price: 2890, change: 45, changePercent: 1.59,
          isPositive: true, marketCap: '₹19,56,000 Cr', volume: '12.5M',
          high52: 3020, low52: 2200, pe: 28.5, pb: 3.2, dividend: 0.85,
        },
      ],
      searchQuery: '',
      searchResults: [],
      indices: [],
      selectedStock: null,
      isLoading: false,
    });
  });

  it('uses backend search results when available', async () => {
    const backendResults = [
      {
        id: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services',
        sector: 'Technology', price: 3890, change: -34, changePercent: -0.88,
        isPositive: false, marketCap: '₹14,20,000 Cr', volume: '8.2M',
        high52: 4200, low52: 3300, pe: 35.2, pb: 12.5, dividend: 1.20,
      },
    ];
    vi.mocked(marketApi.search).mockResolvedValueOnce(backendResults);

    useMarketStore.getState().setSearchQuery('TCS');

    // Let the async backend .then() callback fire
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(useMarketStore.getState().searchResults).toEqual(backendResults);
  });

  it('keeps local search results when backend returns empty', async () => {
    vi.mocked(marketApi.search).mockResolvedValueOnce([]);

    useMarketStore.getState().setSearchQuery('RELIANCE');

    await new Promise(resolve => setTimeout(resolve, 0));

    const state = useMarketStore.getState();
    expect(state.searchResults).toHaveLength(1);
    expect(state.searchResults[0].symbol).toBe('RELIANCE');
  });

  it('keeps local results on backend search failure', async () => {
    vi.mocked(marketApi.search).mockRejectedValueOnce(new Error('Network error'));

    useMarketStore.getState().setSearchQuery('RELIANCE');

    await new Promise(resolve => setTimeout(resolve, 0));

    const state = useMarketStore.getState();
    expect(state.searchResults).toHaveLength(1);
    expect(state.searchResults[0].symbol).toBe('RELIANCE');
  });
});
