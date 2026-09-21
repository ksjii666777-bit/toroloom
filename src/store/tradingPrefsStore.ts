/**
 * ============================================================================
 * Toroloom — Trading Preferences Store
 * ============================================================================
 *
 * Persists the user's personal trading preferences, most importantly the
 * risk-reward ratio (R:R) they commit to when connecting their broker
 * (e.g. 1:2, 1:3, 1:5 — ₹1 risked for ₹2/₹3/₹5 potential reward).
 *
 * Also persists the user's tax mode for the education module's post-tax
 * discipline card: long-term gains (flat 12.5% LTCG) vs short-term gains
 * (income-slab rate). Education-grade, never used for real filing.
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

/** Education-grade flat LTCG rate on listed equity (post-Budget 2024 rules) */
export const LTCG_RATE = 0.125;

/** Which capital-gains regime the user's trades fall under */
export type TaxMode = 'ltcg' | 'slab';

/** Income-slab rate choices offered in the card's picker (decimals) */
export const SLAB_RATE_OPTIONS = [0.05, 0.2, 0.3] as const;

export interface TradingPrefsState {
  /** Chosen risk:reward ratio (reward units per 1 unit of risk). null = not chosen yet */
  rewardRiskRatio: number | null;
  /** Which tax regime the post-tax discipline card should model */
  taxMode: TaxMode;
  /** Slab rate as a decimal when taxMode === 'slab' (e.g. 0.3 for 30%) */
  slabRate: number;
  /** True once loadPrefs() has attempted to read persisted values */
  initialized: boolean;

  loadPrefs: () => Promise<void>;
  setRewardRiskRatio: (ratio: number) => Promise<void>;
  setTaxMode: (mode: TaxMode) => Promise<void>;
  /** Accepts decimals strictly between 0 and 1; invalid values are ignored */
  setSlabRate: (rate: number) => Promise<void>;
  /** The decimal tax rate the education card should use right now */
  resolvedTaxRate: () => number;
  /** GDPR erasure: clear all persisted prefs (in-memory + AsyncStorage) */
  clearPrefs: () => Promise<void>;
}

const STORAGE_KEY = 'toroloom_trading_prefs';

export const useTradingPrefsStore = create<TradingPrefsState>((set, get) => ({
  rewardRiskRatio: null,
  taxMode: 'ltcg',
  slabRate: 0.3,
  initialized: false,

  loadPrefs: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        // Merge with defaults so payloads persisted before taxMode/slabRate
        // existed (e.g. { rewardRiskRatio: 3 }) keep working.
        const parsed = JSON.parse(stored) as {
          rewardRiskRatio?: number | null;
          taxMode?: TaxMode;
          slabRate?: number;
        };
        set({
          rewardRiskRatio: parsed.rewardRiskRatio ?? null,
          taxMode: parsed.taxMode === 'slab' ? 'slab' : 'ltcg',
          slabRate:
            typeof parsed.slabRate === 'number' && parsed.slabRate > 0 && parsed.slabRate < 1
              ? parsed.slabRate
              : 0.3,
          initialized: true,
        });
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
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rewardRiskRatio: ratio,
          taxMode: get().taxMode,
          slabRate: get().slabRate,
        }),
      );
    } catch {
      // Persistence failure is non-fatal — in-memory value is already set
    }
  },

  setTaxMode: async (mode: TaxMode) => {
    set({ taxMode: mode });
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rewardRiskRatio: get().rewardRiskRatio,
          taxMode: mode,
          slabRate: get().slabRate,
        }),
      );
    } catch {
      // Non-fatal
    }
  },

  setSlabRate: async (rate: number) => {
    if (!(rate > 0 && rate < 1)) return; // ignore invalid rates silently
    set({ slabRate: rate });
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rewardRiskRatio: get().rewardRiskRatio,
          taxMode: get().taxMode,
          slabRate: rate,
        }),
      );
    } catch {
      // Non-fatal
    }
  },

  resolvedTaxRate: () => {
    const s = get();
    return s.taxMode === 'slab' ? s.slabRate : LTCG_RATE;
  },

  clearPrefs: async () => {
    set({ rewardRiskRatio: null, taxMode: 'ltcg', slabRate: 0.3 });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // In-memory value is already cleared — persistence failure is non-fatal
    }
  },
}));
