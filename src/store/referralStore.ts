import { create } from 'zustand';
import type { ReferralStats } from '../types';
import { mockReferralStats } from '../constants/mockData';
import { referralApi } from '../services/api/referral';

interface ReferralState {
  referralStats: ReferralStats | null;
  isLoading: boolean;
  error: string | null;
  loadReferralStats: () => Promise<void>;
  generateReferralCode: () => Promise<string | null>;
  getShareLink: () => string;
}

export const useReferralStore = create<ReferralState>((set, get) => ({
  referralStats: null,
  isLoading: false,
  error: null,

  loadReferralStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const stats = await referralApi.getStats();
      set({ referralStats: stats, isLoading: false });
    } catch {
      // Backend unavailable — use mock data
      set({ referralStats: mockReferralStats, isLoading: false });
    }
  },

  generateReferralCode: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await referralApi.generateCode();
      const currentStats = get().referralStats;
      if (currentStats) {
        set({
          referralStats: {
            ...currentStats,
            code: result.code,
            shareLink: result.shareLink,
          },
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
      return result.code;
    } catch {
      set({ isLoading: false });
      return null;
    }
  },

  getShareLink: () => {
    const stats = get().referralStats;
    return stats?.shareLink || 'App soon available on Play Store';
  },
}));
