import { create } from 'zustand';
import { Stock, Watchlist } from '../types';
import { mockWatchlists } from '../constants/mockData';
import { watchlistApi } from '../services/api/watchlist';
import { offlineCache } from '../services/offlineCache';
import { registerCacheWarming } from '../services/cacheWarmingService';
import { log } from '../utils/logger';
import { offlineMutationQueue } from '../services/offlineMutationQueue';

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
  /** Load cached watchlists at app startup for instant display */
  loadCachedWatchlists: () => Promise<void>;
  /** Clear offline cache */
  clearCache: () => Promise<void>;
  /** Sync pending offline mutations with backend */
  syncOfflineMutations: () => Promise<void>;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  watchlists: mockWatchlists,
  isLoading: false,

  loadCachedWatchlists: async () => {
    const cached = await offlineCache.load<{ watchlists: Watchlist[] }>('watchlist');
    if (cached) {
      set({ watchlists: cached.data.watchlists });
    }
  },

  fetchWatchlists: async () => {
    set({ isLoading: true });
    try {
      const data = await watchlistApi.getAll();
      const transformed = data.map(w => ({
        id: w.id,
        name: w.name,
        stocks: w.stocks as Stock[],
        createdAt: w.createdAt,
      }));
      // Cache on successful fetch
      await offlineCache.save('watchlist', { watchlists: transformed });
      set({
        watchlists: transformed,
        isLoading: false,
      });
    } catch {
      // Backend unavailable — try stale cache only if current watchlists are empty
      const current = get();
      if (current.watchlists.length === 0) {
        const cached = await offlineCache.load<{ watchlists: Watchlist[] }>('watchlist');
        if (cached) {
          set({
            watchlists: cached.data.watchlists,
            isLoading: false,
          });
          log.info('[Watchlist] Serving stale cached watchlist data');
          return;
        }
      }
      // Keep current in-memory data (mock, cached-from-startup, or user-modified)
      log.info('[Watchlist] Backend unavailable — keeping existing data');
      set({ isLoading: false });
    }
  },

  addToWatchlist: async (watchlistId, stock) => {
    try {
      await watchlistApi.addStock(watchlistId, stock.symbol);
    } catch {
      // Backend unavailable — queue for later sync
      log.info('[Watchlist] Offline: queuing ADD for sync');
      offlineMutationQueue.enqueue('ADD_TO_WATCHLIST', {
        watchlistId,
        symbol: stock.symbol,
      }).catch(() => {});
    }

    set(state => ({
      watchlists: state.watchlists.map(w =>
        w.id === watchlistId
          ? { ...w, stocks: [...w.stocks, stock] }
          : w
      ),
    }));

    // Update cache after mutation
    await offlineCache.save('watchlist', { watchlists: get().watchlists });
  },

  removeFromWatchlist: async (watchlistId, stockId, symbol) => {
    try {
      await watchlistApi.removeStock(watchlistId, symbol);
    } catch {
      // Backend unavailable — queue for later sync
      log.info('[Watchlist] Offline: queuing REMOVE for sync');
      offlineMutationQueue.enqueue('REMOVE_FROM_WATCHLIST', {
        watchlistId,
        symbol,
      }).catch(() => {});
    }

    set(state => ({
      watchlists: state.watchlists.map(w =>
        w.id === watchlistId
          ? { ...w, stocks: w.stocks.filter(s => s.id !== stockId) }
          : w
      ),
    }));

    // Update cache after mutation
    await offlineCache.save('watchlist', { watchlists: get().watchlists });
  },

  createWatchlist: async (name) => {
    try {
      const created = await watchlistApi.create(name);
      const newWatchlists = [...get().watchlists, {
        id: created.id,
        name: created.name,
        stocks: created.stocks as Stock[],
        createdAt: created.createdAt,
      }];
      set({ watchlists: newWatchlists });
      await offlineCache.save('watchlist', { watchlists: newWatchlists });
      return;
    } catch {
      // Backend unavailable — queue for later sync
      log.info('[Watchlist] Offline: queuing CREATE for sync');
      offlineMutationQueue.enqueue('CREATE_WATCHLIST', { name }).catch(() => {});
    }

    const newWatchlists = [...get().watchlists, {
      id: `w_local_${Date.now()}_${++_localIdCounter}`,
      name,
      stocks: [],
      createdAt: new Date().toISOString(),
    }];
    set({ watchlists: newWatchlists });
    await offlineCache.save('watchlist', { watchlists: newWatchlists });
  },

  deleteWatchlist: async (watchlistId) => {
    try {
      await watchlistApi.delete(watchlistId);
    } catch {
      // Backend unavailable — queue for later sync
      log.info('[Watchlist] Offline: queuing DELETE for sync');
      offlineMutationQueue.enqueue('DELETE_WATCHLIST', { watchlistId }).catch(() => {});
    }

    set(state => ({
      watchlists: state.watchlists.filter(w => w.id !== watchlistId),
    }));

    // Update cache after mutation
    await offlineCache.save('watchlist', { watchlists: get().watchlists });
  },

  isInWatchlist: (stockId) => {
    return get().watchlists.some(w => w.stocks.some(s => s.id === stockId));
  },

  clearCache: async () => {
    await offlineCache.remove('watchlist');
    await offlineMutationQueue.clearAll();
  },

  syncOfflineMutations: async () => {
    const results = await offlineMutationQueue.processAll();
    for (const result of results) {
      if (result.success) {
        log.info('[Watchlist] Synced offline mutation:', result.type);
      } else {
        log.warn('[Watchlist] Failed to sync offline mutation:', result.type, result.error);
      }
    }
  },
}));

// Register for cache warming (priority 3 — semi-volatile)
registerCacheWarming('watchlist', () => useWatchlistStore.getState().fetchWatchlists(), 3);
