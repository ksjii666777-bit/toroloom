import { create } from 'zustand';
import { Stock, MarketIndex } from '../types';
import { mockIndices, mockStocks } from '../constants/mockData';
import { marketApi } from '../services/api';
import { offlineCache } from '../services/offlineCache';
import { registerCacheWarming } from '../services/cacheWarmingService';
import { analytics } from '../services/analytics';
import { log } from '../utils/logger';
import { sendPriceAlert } from '../services/notificationService';

// ── Stock Screener Filter Types ───────────────────────────────
export interface ScreenerFilters {
  priceMin: number;
  priceMax: number;
  peMin: number;
  peMax: number;
  marketCapCategory: 'all' | 'large' | 'mid' | 'small';
  dividendMin: number;
  sector: string;
  dayChangeMin: number;
  dayChangeMax: number;
  // ── New filters ──
  volumeMin: number;
  near52WHigh: boolean;  // Within 5% of 52-week high
  near52WLow: boolean;   // Within 5% of 52-week low
}

export const DEFAULT_SCREENER_FILTERS: ScreenerFilters = {
  priceMin: 0,
  priceMax: 100000,
  peMin: 0,
  peMax: 1000,
  marketCapCategory: 'all',
  dividendMin: 0,
  sector: 'All',
  dayChangeMin: -100,
  dayChangeMax: 100,
  volumeMin: 0,
  near52WHigh: false,
  near52WLow: false,
};

// Helper to determine market cap category from marketCap string
export function getMarketCapCategory(marketCap: string): 'large' | 'mid' | 'small' {
  const numStr = marketCap.replace(/[₹,LBCr\s]/g, '');
  const num = parseFloat(numStr);
  if (marketCap.includes('Cr')) {
    if (num >= 100000) return 'large';
    if (num >= 10000) return 'mid';
    return 'small';
  }
  if (marketCap.includes('L')) {
    if (num >= 10000) return 'large';
    return 'mid';
  }
  return 'small';
}

// Parse volume string like "12.5M" or "8.2M" to numeric value
export function parseVolume(volume: string): number {
  const cleaned = volume.replace(/[,\s]/g, '');
  if (cleaned.endsWith('M') || cleaned.endsWith('m')) {
    return parseFloat(cleaned) * 1000000;
  }
  if (cleaned.endsWith('K') || cleaned.endsWith('k')) {
    return parseFloat(cleaned) * 1000;
  }
  if (cleaned.endsWith('B') || cleaned.endsWith('b')) {
    return parseFloat(cleaned) * 1000000000;
  }
  return parseFloat(cleaned) || 0;
}

// Parse market cap string to numeric value for filtering
export function parseMarketCap(marketCap: string): number {
  const numStr = marketCap.replace(/[₹,\s]/g, '');
  if (numStr.includes('Cr')) return parseFloat(numStr) * 10000000;
  if (numStr.includes('L')) return parseFloat(numStr) * 100000;
  if (numStr.includes('K')) return parseFloat(numStr) * 1000;
  return parseFloat(numStr) || 0;
}

// ── State Interface ───────────────────────────────────────────
interface MarketState {
  indices: MarketIndex[];
  stocks: Stock[];
  selectedStock: Stock | null;
  isLoading: boolean;
  searchQuery: string;
  searchResults: Stock[];

  // Screener state
  screenerFilters: ScreenerFilters;
  screenerResults: Stock[];
  isScreenerVisible: boolean;

  setSearchQuery: (query: string) => void;
  selectStock: (stock: Stock) => void;
  refreshMarket: () => Promise<void>;
  loadCachedMarket: () => Promise<void>;
  simulatePriceAlert: (symbol?: string) => void;

  // Screener actions
  setScreenerFilters: (filters: Partial<ScreenerFilters>) => void;
  applyScreener: () => void;
  resetScreenerFilters: () => void;
  toggleScreener: () => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  indices: mockIndices,
  stocks: mockStocks,
  selectedStock: null,
  isLoading: false,
  searchQuery: '',
  searchResults: [],
  screenerFilters: { ...DEFAULT_SCREENER_FILTERS },
  screenerResults: [],
  isScreenerVisible: false,

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    const { stocks } = get();
    if (query.trim()) {
      const results = stocks.filter(
        s => s.symbol.toLowerCase().includes(query.toLowerCase()) ||
             s.name.toLowerCase().includes(query.toLowerCase())
      );
      set({ searchResults: results });
    } else {
      set({ searchResults: [] });
    }

    // Also try backend search for more results
    if (query.trim().length >= 2) {
      marketApi.search(query).then(backendResults => {
        if (backendResults.length > 0) {
          set({ searchResults: backendResults });
        }
      }).catch(() => {
        // keep local results
      });
    }
  },

  selectStock: (stock) => {
    set({ selectedStock: stock });
    analytics.logEvent('stock_view', {
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
    });
  },

  simulatePriceAlert: (symbol) => {
    const { stocks } = get();
    const targetStocks = symbol
      ? stocks.filter(s => s.symbol === symbol)
      : stocks.filter(s => Math.abs(s.changePercent) >= 1.5);

    targetStocks.forEach(stock => {
      const alertType = stock.changePercent >= 0 ? 'target_hit' : 'drop_alert';
      sendPriceAlert(stock.name, stock.symbol, stock.price, alertType);
    });
  },

  /** Load cached market data at app startup for instant display */
  loadCachedMarket: async () => {
    const cached = await offlineCache.load<{ indices: MarketIndex[]; stocks: Stock[] }>('market');
    if (cached) {
      set({ indices: cached.data.indices, stocks: cached.data.stocks });
    }
  },

  refreshMarket: async () => {
    set({ isLoading: true });

    try {
      const [indices, stocks] = await Promise.all([
        marketApi.getIndices(),
        marketApi.getStocks(),
      ]);
      // Cache on successful fetch
      await offlineCache.save('market', { indices, stocks });
      set({ indices, stocks, isLoading: false });
    } catch {
      // Backend unavailable — try stale cache
      const cached = await offlineCache.load<{ indices: MarketIndex[]; stocks: Stock[] }>('market');
      if (cached) {
        set({ indices: cached.data.indices, stocks: cached.data.stocks, isLoading: false });
        log.info('[Market] Serving stale cached market data');
        return;
      }
      // Fall back to mock data with simulated changes
      const updatedStocks = mockStocks.map(s => ({
        ...s,
        price: +(s.price * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2),
        change: +(s.price * (Math.random() - 0.5) * 0.02).toFixed(2),
      }));
      const updatedIndices = mockIndices.map(i => ({
        ...i,
        currentValue: +(i.currentValue * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2),
      }));
      set({ indices: updatedIndices, stocks: updatedStocks, isLoading: false });
    }
  },

  // ── Screener Actions ──
  setScreenerFilters: (filters) => {
    set(state => ({
      screenerFilters: { ...state.screenerFilters, ...filters },
    }));
  },

  applyScreener: () => {
    const { stocks, screenerFilters: f } = get();
    const results = stocks.filter(s => {
      // Price range
      if (s.price < f.priceMin || s.price > f.priceMax) return false;
      // P/E ratio range
      if (s.pe < f.peMin || s.pe > f.peMax) return false;
      // Dividend yield
      if (s.dividend < f.dividendMin) return false;
      // Day change range
      if (s.changePercent < f.dayChangeMin || s.changePercent > f.dayChangeMax) return false;
      // Sector filter
      if (f.sector !== 'All' && s.sector !== f.sector) return false;
      // Market cap category
      if (f.marketCapCategory !== 'all') {
        const cat = getMarketCapCategory(s.marketCap);
        if (cat !== f.marketCapCategory) return false;
      }
      // Volume filter
      if (f.volumeMin > 0) {
        const vol = parseVolume(s.volume);
        if (vol < f.volumeMin) return false;
      }
      // Near 52-week high
      if (f.near52WHigh) {
        const distFromHigh = ((s.high52 - s.price) / s.high52) * 100;
        if (distFromHigh > 5) return false; // More than 5% away from 52W high
      }
      // Near 52-week low
      if (f.near52WLow) {
        const distFromLow = ((s.price - s.low52) / s.low52) * 100;
        if (distFromLow > 5) return false; // More than 5% away from 52W low
      }
      return true;
    });
    set({ screenerResults: results, isScreenerVisible: false });
  },

  resetScreenerFilters: () => {
    set({ screenerFilters: { ...DEFAULT_SCREENER_FILTERS }, screenerResults: [] });
  },

  toggleScreener: () => {
    set(state => ({ isScreenerVisible: !state.isScreenerVisible }));
  },
}));

// Register for cache warming (priority 1 — high volatility, user always sees)
registerCacheWarming('market', () => useMarketStore.getState().refreshMarket(), 1);
