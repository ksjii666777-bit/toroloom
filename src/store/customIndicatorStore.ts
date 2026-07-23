/**
 * ============================================================================
 * Toroloom — Custom Indicator Store
 * ============================================================================
 *
 * Zustand store for managing user-defined custom technical indicators.
 * Each indicator consists of a formula string, label, and display color.
 * Persisted to AsyncStorage.
 * ============================================================================
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateFormula } from '../utils/indicatorFormulaEngine';

// ============================================================================
// Types
// ============================================================================

export interface CustomIndicator {
  /** Unique ID */
  id: string;
  /** Display name */
  label: string;
  /** Formula string (e.g. "SMA(close, 14)") */
  formula: string;
  /** Line color hex string */
  color: string;
  /** Panel type: overlay (on main chart) or separate (in a panel below) */
  panel: 'overlay' | 'separate';
  /** Whether the indicator is currently active/visible */
  active: boolean;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
}

interface CustomIndicatorState {
  /** All custom indicators */
  indicators: CustomIndicator[];
  /** Whether the custom indicator list has been loaded from storage */
  initialized: boolean;

  // ── Actions ──

  /** Add a new custom indicator */
  addIndicator: (
    label: string,
    formula: string,
    color?: string,
    panel?: 'overlay' | 'separate',
  ) => string | null;
  /** Update an existing indicator */
  updateIndicator: (id: string, updates: Partial<Omit<CustomIndicator, 'id' | 'createdAt'>>) => void;
  /** Delete an indicator */
  deleteIndicator: (id: string) => void;
  /** Toggle active state */
  toggleActive: (id: string) => void;
  /** Get active indicators for a given symbol (filtered by panel type) */
  getActiveIndicators: (panel?: 'overlay' | 'separate') => CustomIndicator[];
  /** Set initialized flag */
  setInitialized: () => void;
  /** Import a predefined formula */
  importPreset: (label: string, formula: string, color?: string) => string | null;
}

// ============================================================================
// Default color palette
// ============================================================================

const DEFAULT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
];

function getNextColor(index: number): string {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

// ============================================================================
// Preset Formulas
// ============================================================================

export const PRESET_INDICATORS: { label: string; formula: string; color: string }[] = [
  { label: 'SMA 20', formula: 'SMA(close, 20)', color: '#FF6B6B' },
  { label: 'SMA 50', formula: 'SMA(close, 50)', color: '#4ECDC4' },
  { label: 'EMA 9', formula: 'EMA(close, 9)', color: '#45B7D1' },
  { label: 'EMA 21', formula: 'EMA(close, 21)', color: '#96CEB4' },
  { label: 'RSI 14', formula: 'RSI(close, 14)', color: '#FFEAA7' },
  { label: 'MACD Line', formula: 'MACD(close)', color: '#DDA0DD' },
  { label: 'MACD Signal', formula: 'MACD_SIGNAL(close)', color: '#98D8C8' },
  { label: 'Bollinger Upper', formula: 'BB_UPPER(close, 20, 2)', color: '#F7DC6F' },
  { label: 'Bollinger Lower', formula: 'BB_LOWER(close, 20, 2)', color: '#BB8FCE' },
  { label: 'VWAP', formula: 'VWAP(close)', color: '#85C1E9' },
  { label: 'Price x SMA50 Crossover', formula: 'CROSSOVER(close, SMA(close, 50))', color: '#F0B27A' },
  { label: 'Price/SMA20 Ratio', formula: 'close / SMA(close, 20) * 100', color: '#82E0AA' },
];

// ============================================================================
// Store
// ============================================================================

export const useCustomIndicatorStore = create<CustomIndicatorState>()(
  persist(
    (set, get) => ({
      indicators: [],
      initialized: false,

      addIndicator: (label, formula, color, panel = 'overlay') => {
        // Validate formula first
        const validation = validateFormula(formula);
        if (!validation.valid) {
          console.warn(`[CustomIndicator] Invalid formula: ${validation.error}`);
          return null;
        }

        const indicators = get().indicators;
        const id = `ci_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const now = new Date().toISOString();

        const indicator: CustomIndicator = {
          id,
          label: label || `Indicator ${indicators.length + 1}`,
          formula,
          color: color || getNextColor(indicators.length),
          panel,
          active: true,
          createdAt: now,
          updatedAt: now,
        };

        set({ indicators: [...indicators, indicator] });
        return id;
      },

      updateIndicator: (id, updates) => {
        const indicators = get().indicators.map((ind) =>
          ind.id === id
            ? { ...ind, ...updates, updatedAt: new Date().toISOString() }
            : ind,
        );
        set({ indicators });
      },

      deleteIndicator: (id) => {
        set({ indicators: get().indicators.filter((ind) => ind.id !== id) });
      },

      toggleActive: (id) => {
        set({
          indicators: get().indicators.map((ind) =>
            ind.id === id ? { ...ind, active: !ind.active } : ind,
          ),
        });
      },

      getActiveIndicators: (panel) => {
        const indicators = get().indicators;
        return panel
          ? indicators.filter((ind) => ind.active && ind.panel === panel)
          : indicators.filter((ind) => ind.active);
      },

      setInitialized: () => {
        set({ initialized: true });
      },

      importPreset: (label, formula, color) => {
        const state = get();
        const id = `ci_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const now = new Date().toISOString();

        const indicator: CustomIndicator = {
          id,
          label,
          formula,
          color: color || getNextColor(state.indicators.length),
          panel: formula.startsWith('RSI') || formula.startsWith('MACD')
            ? 'separate'
            : 'overlay',
          active: true,
          createdAt: now,
          updatedAt: now,
        };

        set({ indicators: [...state.indicators, indicator] });
        return id;
      },
    }),
    {
      name: 'toroloom-custom-indicators',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        indicators: state.indicators,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setInitialized();
        }
      },
    },
  ),
);
