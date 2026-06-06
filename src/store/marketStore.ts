import { create } from 'zustand';
import { Stock, MarketIndex } from '../types';
import { mockIndices, mockStocks } from '../constants/mockData';
import { marketApi } from '../services/api';
import { analytics } from '../services/analytics';
import { sendPriceAlert } from '../services/notificationService';

interface MarketState {
  indices: MarketIndex[];
  stocks: Stock[];
  selectedStock: Stock | null;
  isLoading: boolean;
  searchQuery: string;
  searchResults: Stock[];
  setSearchQuery: (query: string) => void;
  selectStock: (stock: Stock) => void;
  refreshMarket: () => Promise<void>;
  simulatePriceAlert: (symbol?: string) => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  indices: mockIndices,
  stocks: mockStocks,
  selectedStock: null,
  isLoading: false,
  searchQuery: '',
  searchResults: [],

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

  refreshMarket: async () => {
    set({ isLoading: true });

    try {
      const [indices, stocks] = await Promise.all([
        marketApi.getIndices(),
        marketApi.getStocks(),
      ]);
      set({ indices, stocks, isLoading: false });
    } catch {
      // Backend unavailable — fall back to mock data with simulated changes
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
}));
