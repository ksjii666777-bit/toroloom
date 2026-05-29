import { create } from 'zustand';
import { AIInsight } from '../types';
import { mockAIInsights } from '../constants/mockData';
import { aiApi } from '../services/api';

interface AIState {
  insights: AIInsight[];
  isLoading: boolean;
  fetchInsights: (stockId?: string) => Promise<void>;
  generateInsight: (symbol: string) => Promise<void>;
}

export const useAIStore = create<AIState>((set, get) => ({
  insights: mockAIInsights,
  isLoading: false,

  fetchInsights: async (stockId?: string) => {
    set({ isLoading: true });
    try {
      const insights = await aiApi.getInsights(stockId);
      set({ insights, isLoading: false });
    } catch {
      // Backend unavailable — filter locally from mock data
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
    } catch {
      // Backend unavailable — simulate
      await new Promise(r => setTimeout(r, 2000));
      set({ isLoading: false });
    }
  },
}));
