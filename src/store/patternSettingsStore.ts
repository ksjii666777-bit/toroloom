// ============================================================================
// Toroloom — Pattern Settings Store (Zustand)
// Controls confidence threshold, enabled pattern types, and lookback period.
// ============================================================================

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PatternType } from '../components/chart/patternDetection';

// ── Storage key ──
const STORAGE_KEY = '@toroloom/patternSettings';

// ── Config ──
const ALL_PATTERNS: PatternType[] = [
  'head_and_shoulders',
  'inverse_head_and_shoulders',
  'double_top',
  'double_bottom',
  'bull_flag',
  'bear_flag',
  'ascending_triangle',
  'descending_triangle',
  'symmetrical_triangle',
];

const LOOKBACK_OPTIONS = [0, 50, 100, 200, 500] as const;
type LookbackValue = (typeof LOOKBACK_OPTIONS)[number];

// ── Types ──

export interface PatternSettingsState {
  /** Minimum confidence 0-100 (default 50) */
  minConfidence: number;
  /** Which pattern types are enabled */
  enabledPatterns: PatternType[];
  /** Lookback period in candles (0 = all data) */
  lookback: LookbackValue;
  /** Has been loaded from storage */
  hydrated: boolean;

  // Actions
  setMinConfidence: (val: number) => void;
  togglePattern: (pattern: PatternType) => void;
  enableAllPatterns: () => void;
  disableAllPatterns: () => void;
  setLookback: (val: LookbackValue) => void;
  resetDefaults: () => void;
  hydrate: () => Promise<void>;
}

export { ALL_PATTERNS, LOOKBACK_OPTIONS };
export type { LookbackValue };

// ── Defaults ──

const DEFAULTS = {
  minConfidence: 50,
  enabledPatterns: [...ALL_PATTERNS],
  lookback: 0 as LookbackValue,
};

function getDefaultState() {
  return {
    minConfidence: DEFAULTS.minConfidence,
    enabledPatterns: [...DEFAULTS.enabledPatterns],
    lookback: DEFAULTS.lookback,
    hydrated: false,
  };
}

// ── Store ──

export const usePatternSettingsStore = create<PatternSettingsState>((set, get) => ({
  ...getDefaultState(),

  setMinConfidence: (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    set({ minConfidence: clamped });
    persistState({ ...get(), minConfidence: clamped });
  },

  togglePattern: (pattern: PatternType) => {
    const { enabledPatterns } = get();
    const next = enabledPatterns.includes(pattern)
      ? enabledPatterns.filter(p => p !== pattern)
      : [...enabledPatterns, pattern];
    set({ enabledPatterns: next });
    persistState({ ...get(), enabledPatterns: next });
  },

  enableAllPatterns: () => {
    set({ enabledPatterns: [...ALL_PATTERNS] });
    persistState({ ...get(), enabledPatterns: [...ALL_PATTERNS] });
  },

  disableAllPatterns: () => {
    set({ enabledPatterns: [] });
    persistState({ ...get(), enabledPatterns: [] });
  },

  setLookback: (val: LookbackValue) => {
    set({ lookback: val });
    persistState({ ...get(), lookback: val });
  },

  resetDefaults: () => {
    set({ ...getDefaultState(), hydrated: true });
    persistState({ ...getDefaultState(), hydrated: true });
  },

  hydrate: async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) {
        const saved = JSON.parse(json);
        set({
          minConfidence: typeof saved.minConfidence === 'number' ? saved.minConfidence : DEFAULTS.minConfidence,
          enabledPatterns: Array.isArray(saved.enabledPatterns) ? saved.enabledPatterns : [...DEFAULTS.enabledPatterns],
          lookback: LOOKBACK_OPTIONS.includes(saved.lookback) ? saved.lookback : DEFAULTS.lookback,
          hydrated: true,
        });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));

// ── Persist helper ──

function persistState(state: Pick<PatternSettingsState, 'minConfidence' | 'enabledPatterns' | 'lookback' | 'hydrated'>) {
  const data = {
    minConfidence: state.minConfidence,
    enabledPatterns: state.enabledPatterns,
    lookback: state.lookback,
  };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(e =>
    console.warn('[PatternSettings] Failed to persist:', e),
  );
}

// Auto-hydrate saved settings on store creation (fire-and-forget)
usePatternSettingsStore.getState().hydrate();
