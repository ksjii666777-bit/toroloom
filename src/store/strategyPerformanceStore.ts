/**
 * ============================================================================
 * Toroloom — Strategy Performance Tracker Store
 * ============================================================================
 *
 * Tracks executed strategies and their real P&L over time.
 * Persists to AsyncStorage for offline access.
 *
 * Usage:
 *   import { useStrategyPerformanceStore } from '../../store/strategyPerformanceStore';
 *
 *   // Record a new execution
 *   useStrategyPerformanceStore.getState().addExecutedStrategy({
 *     name: 'Iron Condor',
 *     symbol: 'NIFTY',
 *     legCount: 4,
 *     ...
 *   });
 *
 *   // Update P&L later
 *   useStrategyPerformanceStore.getState().updateStrategyPnl(id, 12400);
 *
 * ============================================================================
 */

import { create } from 'zustand';
import { offlineCache } from '../services/offlineCache';
import { log } from '../utils/logger';
import type {
  ExecutedStrategy,
  NewExecutedStrategy,
  StrategyPerformanceStats,
  PnLUpdate,
  StrategyPerformanceStatus,
} from '../types/performance';

// ──── State ────────────────────────────────────────────────────────────────

interface StrategyPerformanceState {
  /** All executed strategies, sorted by execution date desc */
  executedStrategies: ExecutedStrategy[];
  /** Whether the store has been hydrated from cache */
  hydrated: boolean;
  /** Loading state for initial load */
  loading: boolean;

  // ── Actions ──
  /** Hydrate from AsyncStorage cache */
  hydrate: () => Promise<void>;
  /** Add a newly executed strategy */
  addExecutedStrategy: (input: NewExecutedStrategy) => string;
  /** Update current P&L (appends a new PnLUpdate entry) */
  updateStrategyPnl: (id: string, newPnl: number) => void;
  /** Change strategy status (active/closed/partial) */
  setStrategyStatus: (id: string, status: StrategyPerformanceStatus) => void;
  /** Update user notes for a strategy */
  setStrategyNotes: (id: string, notes: string) => void;
  /** Remove a strategy from tracking */
  removeStrategy: (id: string) => void;
  /** Clear all tracked strategies */
  clearAll: () => void;
  /** Compute aggregated stats */
  getStats: () => StrategyPerformanceStats;
  /** Persist current state to AsyncStorage */
  _persistToCache: () => Promise<void>;
}

// ──── Helpers ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'strategy-performance';

function generateId(): string {
  return `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function computeStats(strategies: ExecutedStrategy[]): StrategyPerformanceStats {
  const active = strategies.filter(s => s.status === 'active');
  const closed = strategies.filter(s => s.status === 'closed');
  const partial = strategies.filter(s => s.status === 'partial');
  const winning = strategies.filter(s => s.currentPnl > 0);
  const losing = strategies.filter(s => s.currentPnl < 0);

  let best: ExecutedStrategy | null = null;
  let worst: ExecutedStrategy | null = null;

  for (const s of strategies) {
    if (!best || s.currentPnl > best.currentPnl) best = s;
    if (!worst || s.currentPnl < worst.currentPnl) worst = s;
  }

  return {
    totalExecuted: strategies.length,
    activeCount: active.length,
    closedCount: closed.length,
    partialCount: partial.length,
    totalPnl: strategies.reduce((sum, s) => sum + s.currentPnl, 0),
    winningCount: winning.length,
    losingCount: losing.length,
    winRate: strategies.length > 0
      ? Math.round((winning.length / strategies.length) * 100)
      : 0,
    bestStrategy: best?.name || '-',
    bestPnl: best?.currentPnl || 0,
    worstStrategy: worst?.name || '-',
    worstPnl: worst?.currentPnl || 0,
    totalDeployed: strategies.reduce((sum, s) => sum + s.totalValue, 0),
  };
}

// ──── Store ────────────────────────────────────────────────────────────────

export const useStrategyPerformanceStore = create<StrategyPerformanceState>(
  (set, get) => ({
    executedStrategies: [],
    hydrated: false,
    loading: true,

    // ── Hydrate from cache ──
    hydrate: async () => {
      try {
        const cached = await offlineCache.load<ExecutedStrategy[]>(STORAGE_KEY);
        if (cached && cached.data.length > 0) {
          set({ executedStrategies: cached.data, hydrated: true, loading: false });
          log.info(`[StrategyPerf] Hydrated ${cached.data.length} strategies from cache`);
        } else {
          set({ hydrated: true, loading: false });
        }
      } catch {
        set({ hydrated: true, loading: false });
      }
    },

    // ── Add executed strategy ──
    addExecutedStrategy: (input) => {
      const id = generateId();
      const now = new Date().toISOString();
      const initialPnl = -(input.totalValue * 0.001); // Small initial cost (brokerage)

      const strategy: ExecutedStrategy = {
        id,
        name: input.name,
        symbol: input.symbol,
        legCount: input.legCount,
        totalLegs: input.totalLegs,
        successfulLegs: input.successfulLegs,
        failedLegs: input.failedLegs,
        totalValue: input.totalValue,
        executedAt: now,
        pnlUpdates: [{
          date: now,
          pnl: initialPnl,
          cumulativePnl: initialPnl,
        }],
        currentPnl: initialPnl,
        currentPnlPercent: input.targetReturnPercent > 0
          ? (initialPnl / (input.totalValue || 1)) * 100
          : 0,
        targetPnl: input.targetPnl,
        targetReturnPercent: input.targetReturnPercent,
        backtestWinRate: input.backtestWinRate,
        backtestSharpe: input.backtestSharpe,
        backtestPop: input.backtestPop,
        status: input.failedLegs > 0 && input.successfulLegs === 0
          ? 'partial'
          : 'active',
        notes: '',
      };

      set(state => ({
        executedStrategies: [strategy, ...state.executedStrategies],
      }));

      get()._persistToCache();
      log.info(`[StrategyPerf] Tracked "${input.name}" (${id})`);
      return id;
    },

    // ── Update P&L ──
    updateStrategyPnl: (id, newPnl) => {
      set(state => {
        const strategies = state.executedStrategies.map(s => {
          if (s.id !== id) return s;

          const lastCumulative = s.pnlUpdates.length > 0
            ? s.pnlUpdates[s.pnlUpdates.length - 1].cumulativePnl
            : 0;
          const periodPnl = newPnl - lastCumulative;

          const update: PnLUpdate = {
            date: new Date().toISOString(),
            pnl: periodPnl,
            cumulativePnl: newPnl,
          };

          return {
            ...s,
            currentPnl: newPnl,
            currentPnlPercent: s.totalValue > 0
              ? Math.round((newPnl / s.totalValue) * 1000) / 10
              : 0,
            pnlUpdates: [...s.pnlUpdates, update],
          };
        });
        return { executedStrategies: strategies };
      });
      get()._persistToCache();
    },

    // ── Set status ──
    setStrategyStatus: (id, status) => {
      set(state => ({
        executedStrategies: state.executedStrategies.map(s =>
          s.id === id ? { ...s, status } : s,
        ),
      }));
      get()._persistToCache();
    },

    // ── Set notes ──
    setStrategyNotes: (id, notes) => {
      set(state => ({
        executedStrategies: state.executedStrategies.map(s =>
          s.id === id ? { ...s, notes } : s,
        ),
      }));
      get()._persistToCache();
    },

    // ── Remove strategy ──
    removeStrategy: (id) => {
      set(state => ({
        executedStrategies: state.executedStrategies.filter(s => s.id !== id),
      }));
      get()._persistToCache();
    },

    // ── Clear all ──
    clearAll: () => {
      set({ executedStrategies: [] });
      get()._persistToCache();
    },

    // ── Get stats ──
    getStats: () => {
      return computeStats(get().executedStrategies);
    },

    // ── Persist ──
    _persistToCache: async () => {
      try {
        await offlineCache.save(STORAGE_KEY, get().executedStrategies);
      } catch {
        log.warn('[StrategyPerf] Failed to persist to cache');
      }
    },
  }),
);
