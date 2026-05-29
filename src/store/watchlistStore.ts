import { create } from 'zustand';
import { Stock, Watchlist } from '../types';
import { mockWatchlists } from '../constants/mockData';
import { watchlistApi } from '../services/api';

// Monotonically increasing counter for locally-created watchlist IDs.
// Avoids duplicate IDs when createWatchlist is called multiple times
// within the same millisecond (Date.now() collision).
let _localIdCounter = 0;

interface WatchlistState {
  watchlists: Watchlist[];
  isLoading: boolean;
  fetchWatchlists: () => Promise<void>;
  addToWatchlist: (watchlistId: string, stock: Stock) => Promise<void>;
  removeFromWatchlist: (watchlistId: string, stockId: string, symbol: string) => Promise<void>;
  createWatchlist: (name: string) => Promise<void>;
  deleteWatchlist: (watchlistId: string) => Promise<void>;
  isInWatchlist: (stockId: string) => boolean;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  watchlists: mockWatchlists,
  isLoading: false,

  fetchWatchlists: async () => {
    set({ isLoading: true });
    try {
      const data = await watchlistApi.getAll();
      set({
        watchlists: data.map(w => ({
          id: w.id,
          name: w.name,
          stocks: w.stocks as Stock[],
          createdAt: w.createdAt,
        })),
        isLoading: false,
      });
    } catch {
      // Backend unavailable — keep mock data
      set({ isLoading: false });
    }
  },

  addToWatchlist: async (watchlistId, stock) => {
    try {
      await watchlistApi.addStock(watchlistId, stock.symbol);
    } catch {
      // Backend unavailable — execute locally
    }

    set(state => ({
      watchlists: state.watchlists.map(w =>
        w.id === watchlistId
          ? { ...w, stocks: [...w.stocks, stock] }
          : w
      ),
    }));
  },

  removeFromWatchlist: async (watchlistId, stockId, symbol) => {
    try {
      await watchlistApi.removeStock(watchlistId, symbol);
    } catch {
      // Backend unavailable — execute locally
    }

    set(state => ({
      watchlists: state.watchlists.map(w =>
        w.id === watchlistId
          ? { ...w, stocks: w.stocks.filter(s => s.id !== stockId) }
          : w
      ),
    }));
  },

  createWatchlist: async (name) => {
    try {
      const created = await watchlistApi.create(name);
      set(state => ({
        watchlists: [...state.watchlists, {
          id: created.id,
          name: created.name,
          stocks: created.stocks as Stock[],
          createdAt: created.createdAt,
        }],
      }));
      return;
    } catch {
      // Backend unavailable — create locally
    }

    set(state => ({
      watchlists: [...state.watchlists, {
        id: `w_local_${Date.now()}_${++_localIdCounter}`,
        name,
        stocks: [],
        createdAt: new Date().toISOString(),
      }],
    }));
  },

  deleteWatchlist: async (watchlistId) => {
    try {
      await watchlistApi.delete(watchlistId);
    } catch {
      // Backend unavailable — execute locally
    }

    set(state => ({
      watchlists: state.watchlists.filter(w => w.id !== watchlistId),
    }));
  },

  isInWatchlist: (stockId) => {
    return get().watchlists.some(w => w.stocks.some(s => s.id === stockId));
  },
}));
