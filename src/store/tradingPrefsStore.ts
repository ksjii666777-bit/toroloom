/**
 * ============================================================================
 * Toroloom — Trading Preferences Store
 * ============================================================================
 *
 * Persists the user's personal trading preferences, most importantly the
 * risk-reward ratio (R:R) they commit to when connecting their broker
 * (e.g. 1:2, 1:3, 1:5 — ₹1 risked for ₹2/₹3/₹5 potential reward).
 *
 * The AI Trade Assistant reads `rewardRiskRatio` from here to tailor
 * stop-loss and target suggestions to the user's declared discipline.
 *
 * Persisted in AsyncStorage under 'toroloom_trading_prefs'.
 * ============================================================================
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Standard R:R options offered at broker connect */
export const REWARD_RISK_OPTIONS = [2, 3, 5] as const;

export interface TradingPrefsState {
  /** Chosen risk:reward ratio (reward units per 1 unit of risk). null = not chosen yet */
  rewardRiskRatio: number | null;
  /** True once loadPrefs() has attempted to read persisted values */
  initialized: boolean;

  loadPrefs: () => Promise<void>;
  setRewardRiskRatio: (ratio: number) => Promise<void>;
  /** GDPR erasure: clear the persisted R:R commitment (in-memory + AsyncStorage) */
  clearPrefs: () => Promise<void>;
}

const STORAGE_KEY = 'toroloom_trading_prefs';

export const useTradingPrefsStore = create<TradingPrefsState>((set) => ({
  rewardRiskRatio: null,
  initialized: false,

  loadPrefs: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { rewardRiskRatio?: number | null };
        set({ rewardRiskRatio: parsed.rewardRiskRatio ?? null, initialized: true });
      } else {
        set({ initialized: true });
      }
    } catch {
      set({ initialized: true });
    }
  },

  setRewardRiskRatio: async (ratio: number) => {
    set({ rewardRiskRatio: ratio });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ rewardRiskRatio: ratio }));
    } catch {
      // Persistence failure is non-fatal — in-memory value is already set
    }
  },

  clearPrefs: async () => {
    set({ rewardRiskRatio: null });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // In-memory value is already cleared — persistence failure is non-fatal
    }
  },
}));
