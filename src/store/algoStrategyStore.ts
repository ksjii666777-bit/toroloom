/**
 * ============================================================================
 * Toroloom — Algo Trading Strategy Store
 * ============================================================================
 *
 * Zustand store for managing user-defined algo trading strategies.
 * Each strategy defines entry/exit formulas, risk parameters, and
 * position sizing. Persisted to AsyncStorage.
 * ============================================================================
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AlgoStrategy } from '../services/algoBacktestEngine';

// ============================================================================
// Types
// ============================================================================

export interface SavedAlgoStrategy extends AlgoStrategy {
  /** Unique ID */
  id: string;
  /** Symbol/asset to backtest */
  symbol: string;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
  /** Number of times backtested */
  backtestCount: number;
  /** Last backtest result summary */
  lastBacktestSummary?: {
    totalTrades: number;
    winRate: number;
    totalNetPnl: number;
    sharpeRatio: number;
    maxDrawdownPercent: number;
  };
}

interface AlgoStrategyState {
  /** All saved strategies */
  strategies: SavedAlgoStrategy[];
  /** Whether store has been hydrated */
  initialized: boolean;

  // ── Actions ──
  /** Save a new strategy */
  saveStrategy: (strategy: Omit<SavedAlgoStrategy, 'id' | 'createdAt' | 'updatedAt' | 'backtestCount'>) => string;
  /** Update an existing strategy */
  updateStrategy: (id: string, updates: Partial<Omit<SavedAlgoStrategy, 'id' | 'createdAt'>>) => void;
  /** Delete a strategy */
  deleteStrategy: (id: string) => void;
  /** Record a backtest run */
  recordBacktest: (id: string, summary: SavedAlgoStrategy['lastBacktestSummary']) => void;
  /** Get all strategies sorted by recent first */
  getAllStrategies: () => SavedAlgoStrategy[];
  /** Get strategy by id */
  getStrategy: (id: string) => SavedAlgoStrategy | undefined;
  /** Import a predefined strategy template */
  importTemplate: (name: string, entryFormula: string, exitFormula: string, symbol?: string) => string;
}

// ============================================================================
// Preset Strategy Templates
// ============================================================================

export const STRATEGY_TEMPLATES: { name: string; entryFormula: string; exitFormula: string; description: string }[] = [
  {
    name: 'SMA Crossover',
    entryFormula: 'CROSSOVER(SMA(close, 20), SMA(close, 50))',
    exitFormula: 'CROSSUNDER(SMA(close, 20), SMA(close, 50))',
    description: 'Buy when 20-day SMA crosses above 50-day SMA. Sell on opposite crossover.',
  },
  {
    name: 'RSI Mean Reversion',
    entryFormula: 'RSI(close, 14) < 30',
    exitFormula: 'RSI(close, 14) > 70 || CROSSUNDER(close, SMA(close, 20))',
    description: 'Buy when RSI is oversold (<30). Exit when overbought (>70) or price drops below 20-MA.',
  },
  {
    name: 'Breakout Pullback',
    entryFormula: 'close > HIGHEST(high, 20) && RSI(close, 14) > 50',
    exitFormula: 'close < SMA(close, 20)',
    description: 'Buy on 20-day high breakout with bullish RSI. Exit when price closes below 20-MA.',
  },
  {
    name: 'MACD Momentum',
    entryFormula: 'CROSSOVER(MACD(close), MACD_SIGNAL(close))',
    exitFormula: 'CROSSUNDER(MACD(close), MACD_SIGNAL(close))',
    description: 'Buy when MACD line crosses above signal line. Sell on opposite crossover.',
  },
  {
    name: 'Bollinger Squeeze',
    entryFormula: 'close < BB_LOWER(close, 20, 2) && RSI(close, 14) < 30',
    exitFormula: 'close > BB_UPPER(close, 20, 2) || CROSSUNDER(close, SMA(close, 20))',
    description: 'Buy when price touches lower Bollinger Band with oversold RSI.',
  },
  {
    name: 'Golden Cross',
    entryFormula: 'CROSSOVER(SMA(close, 50), SMA(close, 200))',
    exitFormula: 'CROSSUNDER(SMA(close, 50), SMA(close, 200))',
    description: 'Long-term trend following. Buy on golden cross (50 above 200), sell on death cross.',
  },
];

// ============================================================================
// Store
// ============================================================================

function generateId(): string {
  return `alg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export const useAlgoStrategyStore = create<AlgoStrategyState>()(
  persist(
    (set, get) => ({
      strategies: [],
      initialized: false,

      saveStrategy: (strategyInput) => {
        const now = new Date().toISOString();
        const id = generateId();
        const strategy: SavedAlgoStrategy = {
          ...strategyInput,
          id,
          createdAt: now,
          updatedAt: now,
          backtestCount: 0,
        };
        set(state => ({
          strategies: [...state.strategies, strategy],
        }));
        return id;
      },

      updateStrategy: (id, updates) => {
        set(state => ({
          strategies: state.strategies.map(s =>
            s.id === id
              ? { ...s, ...updates, updatedAt: new Date().toISOString() }
              : s,
          ),
        }));
      },

      deleteStrategy: (id) => {
        set(state => ({
          strategies: state.strategies.filter(s => s.id !== id),
        }));
      },

      recordBacktest: (id, summary) => {
        set(state => ({
          strategies: state.strategies.map(s =>
            s.id === id
              ? {
                  ...s,
                  backtestCount: s.backtestCount + 1,
                  lastBacktestSummary: summary,
                  updatedAt: new Date().toISOString(),
                }
              : s,
          ),
        }));
      },

      getAllStrategies: () => {
        return [...get().strategies].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      },

      getStrategy: (id) => {
        return get().strategies.find(s => s.id === id);
      },

      importTemplate: (name, entryFormula, exitFormula, symbol = 'RELIANCE') => {
        const now = new Date().toISOString();
        const id = generateId();
        const strategy: SavedAlgoStrategy = {
          id,
          name,
          symbol,
          entryFormula,
          exitFormula,
          stopLossPercent: 5,
          takeProfitPercent: 10,
          sizingMethod: 'fixed_qty',
          sizingValue: 10,
          allowShort: false,
          maxPositions: 1,
          commission: 0.001,
          slippage: 0.001,
          createdAt: now,
          updatedAt: now,
          backtestCount: 0,
        };
        set(state => ({
          strategies: [...state.strategies, strategy],
        }));
        return id;
      },
    }),
    {
      name: 'toroloom-algo-strategies',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        strategies: state.strategies,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.initialized = true;
        }
      },
    },
  ),
);
