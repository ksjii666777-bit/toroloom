// ============================================================================
// Toroloom — Chart Store (Zustand)
// Persistent settings: drawings, indicators, tick mode per symbol + timeframe
// ============================================================================

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DrawingAnnotation } from '../components/chart/DrawingTools';
import type { IndicatorType } from '../components/TechnicalIndicators';

// ── Storage key prefix ──
const STORAGE_PREFIX = '@toroloom/chart/';

// ── Helpers ──

function buildKey(symbol: string, timeframe: string): string {
  return `${STORAGE_PREFIX}${symbol}::${timeframe}`;
}

// ── Types ──

interface ChartSettings {
  activeTimeframe: string;
  showMA: boolean;
  showVolume: boolean;
  activeIndicators: IndicatorType[];
  tickMode: boolean;
}

interface ChartStoreState {
  /** Load a drawing set for a given symbol+timeframe */
  loadDrawings: (symbol: string, timeframe: string) => Promise<DrawingAnnotation[]>;
  /** Save drawings for a symbol+timeframe */
  saveDrawings: (symbol: string, timeframe: string, drawings: DrawingAnnotation[]) => Promise<void>;
  /** Clear drawings for a symbol+timeframe */
  clearDrawings: (symbol: string, timeframe: string) => Promise<void>;

  /** Load settings for a given symbol */
  loadSettings: (symbol: string) => Promise<ChartSettings | null>;
  /** Save settings for a given symbol */
  saveSettings: (symbol: string, settings: Partial<ChartSettings>) => Promise<void>;
}

// ── Defaults ──

const DEFAULT_SETTINGS: ChartSettings = {
  activeTimeframe: '1M',
  showMA: false,
  showVolume: true,
  activeIndicators: [],
  tickMode: false,
};

// ── Store ──

export const useChartStore = create<ChartStoreState>(() => ({
  // ── Drawings ──

  loadDrawings: async (symbol: string, timeframe: string): Promise<DrawingAnnotation[]> => {
    try {
      const json = await AsyncStorage.getItem(buildKey(symbol, timeframe));
      if (json) {
        const parsed = JSON.parse(json) as DrawingAnnotation[];
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  },

  saveDrawings: async (symbol: string, timeframe: string, drawings: DrawingAnnotation[]): Promise<void> => {
    try {
      const key = buildKey(symbol, timeframe);
      await AsyncStorage.setItem(key, JSON.stringify(drawings));
    } catch (e) {
      console.warn('[ChartStore] Failed to save drawings:', e);
    }
  },

  clearDrawings: async (symbol: string, timeframe: string): Promise<void> => {
    try {
      const key = buildKey(symbol, timeframe);
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('[ChartStore] Failed to clear drawings:', e);
    }
  },

  // ── Settings ──

  loadSettings: async (symbol: string): Promise<ChartSettings | null> => {
    try {
      const json = await AsyncStorage.getItem(`${STORAGE_PREFIX}settings/${symbol}`);
      if (json) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(json) };
      }
      return null;
    } catch {
      return null;
    }
  },

  saveSettings: async (symbol: string, settings: Partial<ChartSettings>): Promise<void> => {
    try {
      const existing = await useChartStore.getState().loadSettings(symbol);
      const merged = { ...(existing ?? DEFAULT_SETTINGS), ...settings };
      await AsyncStorage.setItem(`${STORAGE_PREFIX}settings/${symbol}`, JSON.stringify(merged));
    } catch (e) {
      console.warn('[ChartStore] Failed to save settings:', e);
    }
  },
}));
