import { create } from 'zustand';
import { AIInsight } from '../types';
import { mockAIInsights } from '../constants/mockData';
import { aiApi } from '../services/api';
import { offlineCache } from '../services/offlineCache';
import { log } from '../utils/logger';

interface AIState {
  insights: AIInsight[];
  isLoading: boolean;
  fetchInsights: (stockId?: string) => Promise<void>;
  generateInsight: (symbol: string) => Promise<void>;
  /** Load cached AI insights at app startup */
  loadCachedInsights: () => Promise<void>;
}

export const useAIStore = create<AIState>((set, get) => ({
  insights: mockAIInsights,
  isLoading: false,

  fetchInsights: async (stockId?: string) => {
    set({ isLoading: true });
    try {
      const insights = await aiApi.getInsights(stockId);
      set({ insights, isLoading: false });
      // Cache on successful fetch
      await offlineCache.save('aiInsights', { insights });
    } catch {
      // Backend unavailable — try stale cache
      const cached = await offlineCache.load<{ insights: AIInsight[] }>('aiInsights');
      if (cached) {
        set({ insights: cached.data.insights, isLoading: false });
        log.info('[AI] Serving stale cached insights');
        return;
      }
      // Fall back to mock data filter
      if (stockId) {
        const filtered = mockAIInsights.filter(i => i.stockId === stockId);
        set({ insights: filtered, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    }
  },

  generateInsight: async (symbol) => {
    set({ isLoading: true });
    try {
      const insight = await aiApi.analyze(symbol);
      set(state => ({
        insights: [insight, ...state.insights],
        isLoading: false,
      }));
      // Cache after mutation
      await offlineCache.save('aiInsights', { insights: get().insights });
    } catch {
      // Backend unavailable — simulate
      await new Promise(r => setTimeout(r, 2000));
      set({ isLoading: false });
    }
  },

  loadCachedInsights: async () => {
    const cached = await offlineCache.load<{ insights: AIInsight[] }>('aiInsights');
    if (cached) {
      set({ insights: cached.data.insights });
    }
  },
}));
