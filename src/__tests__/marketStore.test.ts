/**
 * ============================================================================
 * Toroloom — Market Store Unit Tests
 * ============================================================================
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/marketStore.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMarketStore, DEFAULT_SCREENER_FILTERS, getMarketCapCategory, parseMarketCap } from '../store/marketStore';
import type { Stock } from '../types';

// ─── Mocks (vi.hoisted to make variables available inside vi.mock factories) ─

const { mockSearch, mockGetIndices, mockGetStocks, mockCacheLoad, mockCacheSave, mockAnalyticsLog, mockSendPriceAlert } = vi.hoisted(() => ({
  mockSearch: vi.fn().mockResolvedValue([]),
  mockGetIndices: vi.fn().mockResolvedValue([]),
  mockGetStocks: vi.fn().mockResolvedValue([]),
  mockCacheLoad: vi.fn().mockResolvedValue(null),
  mockCacheSave: vi.fn().mockResolvedValue(undefined),
  mockAnalyticsLog: vi.fn(),
  mockSendPriceAlert: vi.fn(),
}));

vi.mock('../constants/mockData', () => ({
  mockIndices: [
    { id: 'idx1', name: 'NIFTY 50', shortName: 'NIFTY', currentValue: 24500, change: 125, changePercent: 0.51, isPositive: true, icon: 'trending-up' },
    { id: 'idx2', name: 'SENSEX', shortName: 'SENSEX', currentValue: 81000, change: -200, changePercent: -0.25, isPositive: false, icon: 'trending-down' },
  ],
  mockStocks: [],
}));

vi.mock('../services/api', () => ({
  marketApi: { search: mockSearch, getIndices: mockGetIndices, getStocks: mockGetStocks },
}));

vi.mock('../services/offlineCache', () => ({
  offlineCache: { load: mockCacheLoad, save: mockCacheSave },
}));

vi.mock('../services/analytics', () => ({
  analytics: { logEvent: mockAnalyticsLog },
}));

vi.mock('../utils/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../services/notificationService', () => ({
  sendPriceAlert: mockSendPriceAlert,
}));

describe('Market Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMarketStore.setState({
      indices: [], stocks: [], selectedStock: null, isLoading: false,
      searchQuery: '', searchResults: [],
      screenerFilters: { ...DEFAULT_SCREENER_FILTERS }, screenerResults: [], isScreenerVisible: false,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Utility Functions
  // ─────────────────────────────────────────────────────────────────────────

  describe('Utility Functions', () => {
    it('large cap (>= 100000 Cr)', () => expect(getMarketCapCategory('₹17,50,000Cr')).toBe('large'));
    it('mid cap (10000-99999 Cr)', () => expect(getMarketCapCategory('₹50,000Cr')).toBe('mid'));
    it('small cap (< 10000 Cr)', () => expect(getMarketCapCategory('₹5,000Cr')).toBe('small'));
    it('L suffix large', () => expect(getMarketCapCategory('₹50,000L')).toBe('large'));
    it('L suffix mid', () => expect(getMarketCapCategory('₹500L')).toBe('mid'));
    it('parse Cr', () => expect(parseMarketCap('₹10Cr')).toBe(100000000));
    it('parse L', () => expect(parseMarketCap('₹50L')).toBe(5000000));
    it('parse K', () => expect(parseMarketCap('₹100K')).toBe(100000));
    it('parse invalid', () => expect(parseMarketCap('')).toBe(0));
    it('DEFAULT_SCREENER_FILTERS has required fields', () => {
      (['priceMin','priceMax','peMin','peMax','marketCapCategory','sector','dayChangeMin','dayChangeMax'] as const)
        .forEach(k => expect(DEFAULT_SCREENER_FILTERS).toHaveProperty(k));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Search
  // ─────────────────────────────────────────────────────────────────────────

  describe('Search', () => {
    it('filters by symbol', () => {
      useMarketStore.setState({ stocks: mkStock([
        ['RELIANCE','Reliance'], ['TCS','TCS'],
      ])});
      useMarketStore.getState().setSearchQuery('RELIANCE');
      expect(useMarketStore.getState().searchResults).toHaveLength(1);
    });

    it('filters by name case-insensitive', () => {
      useMarketStore.setState({ stocks: mkStock([['R','Reliance Industries']]) });
      useMarketStore.getState().setSearchQuery('reliance');
      expect(useMarketStore.getState().searchResults).toHaveLength(1);
    });

    it('clears results on empty query', () => {
      useMarketStore.getState().setSearchQuery('X');
      useMarketStore.getState().setSearchQuery('');
      expect(useMarketStore.getState().searchResults).toEqual([]);
    });

    it('calls backend for >=2 char query', () => {
      useMarketStore.getState().setSearchQuery('TC');
      expect(mockSearch).toHaveBeenCalledWith('TC');
    });

    it('updates results from backend', async () => {
      const backendStock = mkOne('BACKEND','Backend Co');
      mockSearch.mockResolvedValueOnce([backendStock]);
      useMarketStore.getState().setSearchQuery('TC');
      await new Promise(r => setTimeout(r, 5));
      expect(useMarketStore.getState().searchResults).toEqual([backendStock]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Select Stock
  // ─────────────────────────────────────────────────────────────────────────

  it('selects stock and logs analytics', () => {
    const s = mkOne('TEST','Test Co');
    useMarketStore.getState().selectStock(s);
    expect(useMarketStore.getState().selectedStock?.symbol).toBe('TEST');
    expect(mockAnalyticsLog).toHaveBeenCalledWith('stock_view', { symbol: 'TEST', name: 'Test Co', sector: 'E' });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cache
  // ─────────────────────────────────────────────────────────────────────────

  it('loads cached data', async () => {
    mockCacheLoad.mockResolvedValueOnce({ data: { indices: [], stocks: [mkOne('C','Cached')] } });
    await useMarketStore.getState().loadCachedMarket();
    expect(useMarketStore.getState().stocks).toHaveLength(1);
  });

  it('keeps empty state when no cache', async () => {
    mockCacheLoad.mockResolvedValueOnce(null);
    await useMarketStore.getState().loadCachedMarket();
    expect(useMarketStore.getState().stocks).toEqual([]);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Refresh Market
  // ─────────────────────────────────────────────────────────────────────────

  it('shows loading during refresh, clears after', async () => {
    mockGetIndices.mockRejectedValueOnce(new Error('done'));
    mockGetStocks.mockRejectedValueOnce(new Error('done'));
    mockCacheLoad.mockResolvedValueOnce(null);
    const p = useMarketStore.getState().refreshMarket();
    expect(useMarketStore.getState().isLoading).toBe(true);
    await p.catch(() => {});
    expect(useMarketStore.getState().isLoading).toBe(false);
  });

  it('updates on success', async () => {
    mockGetIndices.mockResolvedValueOnce([{ id:'i', name:'N', shortName:'N', currentValue:100, change:1, changePercent:0.5, isPositive:true, icon:'x' }]);
    mockGetStocks.mockResolvedValueOnce([mkOne('S','S')]);
    await useMarketStore.getState().refreshMarket();
    expect(useMarketStore.getState().indices[0].currentValue).toBe(100);
    expect(useMarketStore.getState().isLoading).toBe(false);
  });

  it('caches on success', async () => {
    mockGetIndices.mockResolvedValueOnce([]);
    mockGetStocks.mockResolvedValueOnce([]);
    await useMarketStore.getState().refreshMarket();
    expect(mockCacheSave).toHaveBeenCalled();
  });

  it('falls back to stale cache on API fail', async () => {
    mockGetIndices.mockRejectedValueOnce(new Error('fail'));
    mockGetStocks.mockRejectedValueOnce(new Error('fail'));
    mockCacheLoad.mockResolvedValueOnce({ data: { indices: [], stocks: [mkOne('C','Cached')] } });
    await useMarketStore.getState().refreshMarket();
    expect(useMarketStore.getState().stocks).toHaveLength(1);
  });

  it('falls back to mock on API+cache fail', async () => {
    mockGetIndices.mockRejectedValueOnce(new Error('fail'));
    mockGetStocks.mockRejectedValueOnce(new Error('fail'));
    mockCacheLoad.mockResolvedValueOnce(null);
    await useMarketStore.getState().refreshMarket();
    expect(useMarketStore.getState().isLoading).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Screener
  // ─────────────────────────────────────────────────────────────────────────

  it('sets filter', () => {
    useMarketStore.getState().setScreenerFilters({ sector: 'IT' });
    expect(useMarketStore.getState().screenerFilters.sector).toBe('IT');
  });

  it('applies screener by sector', () => {
    useMarketStore.setState({ stocks: [mkOne('A','A','IT'), mkOne('B','B','Energy')] });
    useMarketStore.getState().setScreenerFilters({ sector: 'IT' });
    useMarketStore.getState().applyScreener();
    expect(useMarketStore.getState().screenerResults).toHaveLength(1);
  });

  it('closes screener after apply', () => {
    useMarketStore.setState({ isScreenerVisible: true });
    useMarketStore.getState().applyScreener();
    expect(useMarketStore.getState().isScreenerVisible).toBe(false);
  });

  it('resets filters', () => {
    useMarketStore.getState().setScreenerFilters({ sector: 'IT' });
    useMarketStore.getState().resetScreenerFilters();
    expect(useMarketStore.getState().screenerFilters).toEqual(DEFAULT_SCREENER_FILTERS);
  });

  it('toggles visibility', () => {
    useMarketStore.getState().toggleScreener();
    expect(useMarketStore.getState().isScreenerVisible).toBe(true);
    useMarketStore.getState().toggleScreener();
    expect(useMarketStore.getState().isScreenerVisible).toBe(false);
  });

  it('filters by price range', () => {
    useMarketStore.setState({ stocks: [
      mkOne('A','A','E',50), mkOne('B','B','E',150), mkOne('C','C','E',250),
    ]});
    useMarketStore.getState().setScreenerFilters({ priceMin: 100, priceMax: 200 });
    useMarketStore.getState().applyScreener();
    expect(useMarketStore.getState().screenerResults).toHaveLength(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Price Alerts
  // ─────────────────────────────────────────────────────────────────────────

  it('sends alert for specific symbol', () => {
    useMarketStore.setState({ stocks: [mkOne('TEST','Test Inc','E',200)] });
    useMarketStore.getState().simulatePriceAlert('TEST');
    expect(mockSendPriceAlert).toHaveBeenCalledWith('Test Inc', 'TEST', 200, expect.any(String));
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function mkOne(symbol: string, name: string, sector = 'E', price = 100): Stock {
  return { id: symbol, symbol, name, sector, price, change: 0, changePercent: 0, isPositive: true, marketCap: '₹1Cr', volume: '1K', high52: 200, low52: 50, pe: 10, pb: 1, dividend: 0 };
}
function mkStock(arr: [string, string][]): Stock[] {
  return arr.map(([s, n]) => mkOne(s, n));
}
