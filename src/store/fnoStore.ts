import { create } from 'zustand';
import type {
  OptionChain,
  OptionContract,
  FnOExpiry,
  FutureContract,
  FnOPosition,
  StrategyLeg,
} from '../types';
import { fnoApi, StrategyAnalyzeResult, PrebuiltStrategy, SavedStrategy } from '../services/api/fno';
import { offlineCache } from '../services/offlineCache';

import { log } from '../utils/logger';
import type { BacktestResult } from '../services/backtestEngine';

const COMPARISON_CACHE_KEY = 'fno-comparison-slots';

// ──── Strategy Comparison ──────────────────────────────────────────────────

export const MAX_COMPARISON_SLOTS = 3;
export const COMPARISON_COLORS = ['#00C853', '#3B82F6', '#FF6B35'];

export interface StrategyComparisonSlot {
  id: string;
  name: string;
  legs: StrategyLeg[];
  backtestResult: {
    totalPnl: number;
    totalReturnPercent: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdownPercent: number;
    calmarRatio: number;
    sortinoRatio: number;
    totalPeriods: number;
    winningPeriods: number;
    losingPeriods: number;
    equityCurve: { date: string; cumulativePnl: number }[];
  };
  legSummary: string;
  color: string;
}

export type HistoricalDays = 30 | 90 | 180 | 365 | 730;

export type FnOView = 'option-chain' | 'futures' | 'positions' | 'scanner';
export type ChainSide = 'CE' | 'PE' | 'both';

interface FnoState {
  // Selected symbol & expiry
  selectedSymbol: string;
  selectedExpiry: FnOExpiry | null;
  view: FnOView;
  chainSide: ChainSide;

  // Data
  expiries: FnOExpiry[];
  optionChain: OptionChain | null;
  futures: FutureContract[];
  positions: FnOPosition[];
  spotPrices: Record<string, number>;

  // Historical data for backtesting
  historicalData: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
  historicalDays: 30 | 90 | 180 | 365 | 730;
  historicalDataLoading: boolean;
  historicalDataSource: 'broker' | 'mock' | 'cache' | null;

  // Strategy builder
  strategyLegs: StrategyLeg[];
  strategyResult: StrategyAnalyzeResult | null;
  prebuiltStrategies: PrebuiltStrategy[];
  selectedStrategyName: string;

  // Strategy execution
  strategyExecutionResult: {
    strategyName: string;
    totalLegs: number;
    successful: number;
    failed: number;
    totalValue: number;
    legs: {
      legIndex: number;
      legLabel: string;
      success: boolean;
      orderId?: string;
      message: string;
      status?: string;
      totalQuantity?: number;
      totalValue?: number;
    }[];
    executedAt: string;
  } | null;
  strategyExecutionLoading: boolean;
  showExecutionModal: boolean;

  // Strategy comparison — up to 3 strategies for side-by-side comparison
  comparisonSlots: StrategyComparisonSlot[];
  showComparisonModal: boolean;

  // Strategy alert — shown when backtest results are exceptional
  strategyAlert: {
    /** Human-readable summary e.g. "72% win rate · 1.8 Sharpe" */
    summary: string;
    /** Full message for the alert banner */
    message: string;
    /** Which metrics triggered this alert */
    triggers: string[];
  } | null;

  // Strategy persistence
  savedStrategies: SavedStrategy[];
  savedStrategiesLoading: boolean;
  saveStrategyModal: boolean;
  loadStrategyModal: boolean;

  // Loading states
  chainLoading: boolean;
  futuresLoading: boolean;
  positionsLoading: boolean;
  strategyLoading: boolean;
  spotPricesLoading: boolean;

  // Order modal
  showOrderModal: boolean;
  selectedContract: OptionContract | null;
  orderType: 'buy' | 'sell';
  orderQuantity: number;

  // Actions
  setSelectedSymbol: (symbol: string) => void;
  setSelectedExpiry: (expiry: FnOExpiry) => void;
  setView: (view: FnOView) => void;
  setChainSide: (side: ChainSide) => void;

  fetchExpiries: (symbol: string) => Promise<void>;
  fetchOptionChain: (symbol: string, expiry?: string) => Promise<void>;
  fetchFutures: (symbol: string) => Promise<void>;
  fetchPositions: () => Promise<void>;
  fetchSpotPrices: () => Promise<void>;

  /** Load cached FnO data at app startup for instant display */
  loadCachedFno: () => Promise<void>;

  // Strategy builder
  addStrategyLeg: (leg: StrategyLeg) => void;
  removeStrategyLeg: (id: string) => void;
  updateStrategyLeg: (id: string, updates: Partial<StrategyLeg>) => void;
  clearStrategyLegs: () => void;
  setSelectedStrategyName: (name: string) => void;
  analyzeStrategy: (spotPrice: number) => Promise<void>;

  // Historical data
  setHistoricalDays: (days: 30 | 90 | 180 | 365 | 730) => void;
  fetchHistoricalData: (symbol?: string, days?: number) => Promise<void>;

  // Strategy persistence
  setSaveStrategyModal: (show: boolean) => void;
  setLoadStrategyModal: (show: boolean) => void;
  fetchSavedStrategies: () => Promise<void>;
  saveCurrentStrategy: (name: string, description: string, spotPrice: number, tags?: string[], backtestSnapshot?: SavedStrategy['backtestSnapshot']) => Promise<SavedStrategy | null>;
  loadSavedStrategy: (strategy: SavedStrategy) => void;
  deleteSavedStrategy: (id: string) => Promise<boolean>;
  shareSavedStrategy: (id: string) => Promise<{ shareId: string; shareUrl: string } | null>;
  unshareSavedStrategy: (id: string) => Promise<boolean>;

  // Strategy execution
  executeStrategy: () => Promise<void>;
  setShowExecutionModal: (show: boolean) => void;
  clearExecutionResult: () => void;

  // Strategy comparison
  addToComparison: (name: string, legs: StrategyLeg[], backtestResult: BacktestResult) => void;
  removeFromComparison: (index: number) => void;
  clearComparison: () => void;
  setShowComparisonModal: (show: boolean) => void;
  /** Persist comparison slots to AsyncStorage */
  persistComparisonSlots: () => Promise<void>;
  /** Load cached comparison slots from AsyncStorage */
  loadCachedComparisonSlots: () => Promise<void>;

  // Strategy alerts
  evaluateStrategyAlert: (backtestMetrics: {
    winRate: number;
    sharpeRatio: number;
    profitFactor: number;
    maxDrawdownPercent: number;
    totalPnl: number;
    totalReturnPercent: number;
  }) => void;
  dismissStrategyAlert: () => void;

  // Order modal
  openOrderModal: (contract: OptionContract, type: 'buy' | 'sell') => void;
  closeOrderModal: () => void;
  setOrderQuantity: (qty: number) => void;
  placeOrder: () => Promise<void>;
}

export const useFnoStore = create<FnoState>((set, get) => ({
  selectedSymbol: 'NIFTY',
  selectedExpiry: null,
  view: 'option-chain',
  chainSide: 'both',

  expiries: [],
  optionChain: null,
  futures: [],
  positions: [],
  spotPrices: {},

  // Historical data
  historicalData: [],
  historicalDays: 365,
  historicalDataLoading: false,
  historicalDataSource: null,

  strategyLegs: [],
  strategyResult: null,
  prebuiltStrategies: [],
  selectedStrategyName: 'Custom Strategy',

  // Strategy comparison slots (max 3)
  comparisonSlots: [],
  showComparisonModal: false,

  // Strategy execution
  strategyExecutionResult: null,
  strategyExecutionLoading: false,
  showExecutionModal: false,
  strategyAlert: null,

  savedStrategies: [],
  savedStrategiesLoading: false,
  saveStrategyModal: false,
  loadStrategyModal: false,

  chainLoading: false,
  futuresLoading: false,
  positionsLoading: false,
  strategyLoading: false,
  spotPricesLoading: false,

  showOrderModal: false,
  selectedContract: null,
  orderType: 'buy',
  orderQuantity: 1,

  setSelectedSymbol: (symbol: string) => {
    set({ selectedSymbol: symbol, optionChain: null, futures: [] });
    get().fetchExpiries(symbol);
  },

  setSelectedExpiry: (expiry: FnOExpiry) => {
    set({ selectedExpiry: expiry });
    get().fetchOptionChain(get().selectedSymbol, expiry.date);
  },

  setView: (view: FnOView) => set({ view }),

  setChainSide: (side: ChainSide) => set({ chainSide: side }),

  fetchExpiries: async (symbol: string) => {
    try {
      const data = await fnoApi.getExpiries(symbol);
      set({ expiries: data.expiries });
      // Auto-select first expiry if none selected
      if (!get().selectedExpiry && data.expiries.length > 0) {
        set({ selectedExpiry: data.expiries[0] });
        get().fetchOptionChain(symbol, data.expiries[0].date);
      }
      // Cache expiries after successful fetch
      const state = get();
      await offlineCache.save('fno', {
        expiries: state.expiries,
        optionChain: state.optionChain,
        futures: state.futures,
        positions: state.positions,
        spotPrices: state.spotPrices,
      });
    } catch {
      // Backend unavailable — try stale cache
      const cached = await offlineCache.load<{
        expiries: FnOExpiry[];
        optionChain: OptionChain | null;
        futures: FutureContract[];
        positions: FnOPosition[];
        spotPrices: Record<string, number>;
      }>('fno');
      if (cached) {
        set({ expiries: cached.data.expiries });
        log.info('[FnO] Serving stale cached expiries');
      }
    }
  },

  fetchOptionChain: async (symbol: string, expiry?: string) => {
    set({ chainLoading: true });
    try {
      const chain = await fnoApi.getOptionChain(symbol, expiry);
      set({ optionChain: chain, chainLoading: false });
      // Cache after successful fetch
      const state = get();
      await offlineCache.save('fno', {
        expiries: state.expiries,
        optionChain: state.optionChain,
        futures: state.futures,
        positions: state.positions,
        spotPrices: state.spotPrices,
      });
    } catch {
      // Backend unavailable — try stale cache
      const cached = await offlineCache.load<{
        expiries: FnOExpiry[];
        optionChain: OptionChain | null;
        futures: FutureContract[];
        positions: FnOPosition[];
        spotPrices: Record<string, number>;
      }>('fno');
      if (cached && cached.data.optionChain) {
        set({ optionChain: cached.data.optionChain, chainLoading: false });
        log.info('[FnO] Serving stale cached option chain');
        return;
      }
      set({ chainLoading: false });
    }
  },

  fetchFutures: async (symbol: string) => {
    set({ futuresLoading: true });
    try {
      const data = await fnoApi.getFutures(symbol);
      set({ futures: data.futures, futuresLoading: false });
      // Cache after successful fetch
      const state = get();
      await offlineCache.save('fno', {
        expiries: state.expiries,
        optionChain: state.optionChain,
        futures: state.futures,
        positions: state.positions,
        spotPrices: state.spotPrices,
      });
    } catch {
      // Backend unavailable — try stale cache
      const cached = await offlineCache.load<{
        expiries: FnOExpiry[];
        optionChain: OptionChain | null;
        futures: FutureContract[];
        positions: FnOPosition[];
        spotPrices: Record<string, number>;
      }>('fno');
      if (cached && cached.data.futures.length > 0) {
        set({ futures: cached.data.futures, futuresLoading: false });
        log.info('[FnO] Serving stale cached futures');
        return;
      }
      set({ futuresLoading: false });
    }
  },

  fetchPositions: async () => {
    set({ positionsLoading: true });
    try {
      const positions = await fnoApi.getPositions();
      set({ positions, positionsLoading: false });
      // Cache after successful fetch
      const state = get();
      await offlineCache.save('fno', {
        expiries: state.expiries,
        optionChain: state.optionChain,
        futures: state.futures,
        positions: state.positions,
        spotPrices: state.spotPrices,
      });
    } catch {
      // Backend unavailable — try stale cache
      const cached = await offlineCache.load<{
        expiries: FnOExpiry[];
        optionChain: OptionChain | null;
        futures: FutureContract[];
        positions: FnOPosition[];
        spotPrices: Record<string, number>;
      }>('fno');
      if (cached && cached.data.positions.length > 0) {
        set({ positions: cached.data.positions, positionsLoading: false });
        log.info('[FnO] Serving stale cached positions');
        return;
      }
      set({ positionsLoading: false });
    }
  },

  fetchSpotPrices: async () => {
    set({ spotPricesLoading: true });
    try {
      const prices = await fnoApi.getSpotPrices();
      set({ spotPrices: prices, spotPricesLoading: false });
      // Cache after successful fetch
      const state = get();
      await offlineCache.save('fno', {
        expiries: state.expiries,
        optionChain: state.optionChain,
        futures: state.futures,
        positions: state.positions,
        spotPrices: state.spotPrices,
      });
    } catch {
      // Backend unavailable — try stale cache
      const cached = await offlineCache.load<{
        expiries: FnOExpiry[];
        optionChain: OptionChain | null;
        futures: FutureContract[];
        positions: FnOPosition[];
        spotPrices: Record<string, number>;
      }>('fno');
      if (cached && Object.keys(cached.data.spotPrices).length > 0) {
        set({ spotPrices: cached.data.spotPrices, spotPricesLoading: false });
        log.info('[FnO] Serving stale cached spot prices');
        return;
      }
      set({ spotPricesLoading: false });
    }
  },

  // Strategy Builder
  addStrategyLeg: (leg: StrategyLeg) => {
    set(state => ({ strategyLegs: [...state.strategyLegs, leg] }));
  },

  removeStrategyLeg: (id: string) => {
    set(state => ({
      strategyLegs: state.strategyLegs.filter(l => l.id !== id),
    }));
    if (get().strategyLegs.length === 0) {
      set({ strategyResult: null });
    }
  },

  updateStrategyLeg: (id: string, updates: Partial<StrategyLeg>) => {
    set(state => ({
      strategyLegs: state.strategyLegs.map(l =>
        l.id === id ? { ...l, ...updates } : l,
      ),
    }));
  },

  clearStrategyLegs: () => {
    set({ strategyLegs: [], strategyResult: null });
  },

  setSelectedStrategyName: (name: string) => {
    set({ selectedStrategyName: name });
  },

  analyzeStrategy: async (spotPrice: number) => {
    const { strategyLegs } = get();
    if (strategyLegs.length === 0) return;

    set({ strategyLoading: true });
    try {
      const result = await fnoApi.analyzeStrategy({
        legs: strategyLegs.map(l => ({
          type: l.type,
          strike: l.strike,
          action: l.action,
          premium: l.premium,
          quantity: l.quantity,
        })),
        spotPrice,
      });
      set({ strategyResult: result, strategyLoading: false });
    } catch {
      set({ strategyLoading: false });
    }
  },

  // ──── Historical Data ─────────────────────────────────────────────

  setHistoricalDays: (days: 30 | 90 | 180 | 365 | 730) => {
    set({ historicalDays: days });
    // Auto-fetch when days change
    get().fetchHistoricalData(undefined, days);
  },

  fetchHistoricalData: async (symbol?: string, days?: number) => {
    const sym = symbol || get().selectedSymbol;
    const d = days || get().historicalDays;

    set({ historicalDataLoading: true });
    try {
      const result = await fnoApi.getHistoricalData(sym, d);
      set({
        historicalData: result.data,
        historicalDataLoading: false,
        historicalDataSource: result.source as 'broker' | 'mock' | 'cache',
      });
      log.info(`[FnO] Historical data loaded from ${result.source}: ${result.data.length} points`);
    } catch {
      set({ historicalDataLoading: false });
      log.warn('[FnO] Failed to fetch historical data');
    }
  },

  // ──── Strategy Execution ────────────────────────────────────────────

  setShowExecutionModal: (show: boolean) => {
    set({ showExecutionModal: show });
  },

  clearExecutionResult: () => {
    set({ strategyExecutionResult: null, showExecutionModal: false });
  },

  // ──── Strategy Alerts ────────────────────────────────────────────

  /**
   * Evaluate backtest results against quality thresholds.
   * If the strategy meets all criteria, sets `strategyAlert` so the
   * StrategyBuilderScreen can show an attractive call-to-action banner.
   */
  evaluateStrategyAlert: (backtestMetrics) => {
    const triggers: string[] = [];

    // ── Thresholds (configurable) ──
    const THRESHOLDS = {
      winRateMin: 60,
      sharpeRatioMin: 1.0,
      profitFactorMin: 1.5,
      maxDrawdownMax: 25,
      totalPnlPositive: true,
    };

    const { winRate, sharpeRatio, profitFactor, maxDrawdownPercent, totalPnl, totalReturnPercent: _totalReturnPercent } = backtestMetrics;

    if (winRate >= THRESHOLDS.winRateMin) {
      triggers.push(`Win rate ${winRate.toFixed(0)}%`);
    }
    if (sharpeRatio >= THRESHOLDS.sharpeRatioMin) {
      triggers.push(`Sharpe ${sharpeRatio.toFixed(2)}`);
    }
    if (profitFactor >= THRESHOLDS.profitFactorMin) {
      triggers.push(`Profit factor ${profitFactor.toFixed(2)}`);
    }
    if (maxDrawdownPercent <= THRESHOLDS.maxDrawdownMax) {
      triggers.push(`Max DD ${maxDrawdownPercent.toFixed(1)}%`);
    }
    if (totalPnl > 0) {
      triggers.push(`P&L ${totalPnl >= 0 ? '+' : ''}₹${Math.abs(totalPnl).toLocaleString('en-IN')}`);
    }

    // Only show alert if ALL thresholds are met
    const allMet =
      winRate >= THRESHOLDS.winRateMin &&
      sharpeRatio >= THRESHOLDS.sharpeRatioMin &&
      profitFactor >= THRESHOLDS.profitFactorMin &&
      maxDrawdownPercent <= THRESHOLDS.maxDrawdownMax &&
      totalPnl > 0;

    if (!allMet) {
      set({ strategyAlert: null });
      return;
    }

    const summary = triggers.slice(0, 3).join(' · ');
    const fullMessage = `Your ${get().selectedStrategyName} setup has ${triggers.join(', ')}. Want to execute this strategy?`;

    set({
      strategyAlert: {
        summary,
        message: fullMessage,
        triggers,
      },
    });

    log.info(`[FnO] Strategy alert triggered: ${summary}`);
  },

  dismissStrategyAlert: () => {
    set({ strategyAlert: null });
  },

  // ──── Strategy Comparison ──────────────────────────────────────────

  setShowComparisonModal: (show: boolean) => {
    set({ showComparisonModal: show });
  },

  addToComparison: (name, legs, backtestResult) => {
    const state = get();
    if (state.comparisonSlots.length >= MAX_COMPARISON_SLOTS) {
      log.warn('[FnO] Max comparison slots reached');
      return;
    }

    const slot: StrategyComparisonSlot = {
      id: `comp_${Date.now()}`,
      name,
      legs,
      backtestResult: {
        totalPnl: backtestResult.metrics.totalPnl,
        totalReturnPercent: backtestResult.metrics.totalReturnPercent,
        winRate: backtestResult.metrics.winRate,
        profitFactor: backtestResult.metrics.profitFactor,
        sharpeRatio: backtestResult.metrics.sharpeRatio,
        maxDrawdownPercent: backtestResult.metrics.maxDrawdownPercent,
        calmarRatio: backtestResult.metrics.calmarRatio,
        sortinoRatio: backtestResult.metrics.sortinoRatio,
        totalPeriods: backtestResult.metrics.totalPeriods,
        winningPeriods: backtestResult.metrics.winningPeriods,
        losingPeriods: backtestResult.metrics.losingPeriods,
        equityCurve: backtestResult.equityCurve.map(p => ({
          date: p.date,
          cumulativePnl: p.cumulativePnl,
        })),
      },
      legSummary: `${legs.length} leg${legs.length > 1 ? 's' : ''}`,
      color: COMPARISON_COLORS[state.comparisonSlots.length] || '#888',
    };

    set(state => ({
      comparisonSlots: [...state.comparisonSlots, slot],
    }));

    log.info(`[FnO] Added "${name}" to comparison (slot ${state.comparisonSlots.length + 1})`);

    // Persist to AsyncStorage
    get().persistComparisonSlots();
  },

  removeFromComparison: (index: number) => {
    set(state => ({
      comparisonSlots: state.comparisonSlots.filter((_, i) => i !== index),
    }));
    get().persistComparisonSlots();
  },

  clearComparison: () => {
    set({ comparisonSlots: [] });
    get().persistComparisonSlots();
  },

  // ── Persist comparison slots to AsyncStorage ──
  persistComparisonSlots: async () => {
    try {
      const slots = get().comparisonSlots;
      await offlineCache.save(COMPARISON_CACHE_KEY, slots);
      log.info(`[FnO] Persisted ${slots.length} comparison slots to cache`);
    } catch {
      log.warn('[FnO] Failed to persist comparison slots');
    }
  },

  // ── Load cached comparison slots ──
  loadCachedComparisonSlots: async () => {
    try {
      const cached = await offlineCache.load<StrategyComparisonSlot[]>(COMPARISON_CACHE_KEY);
      if (cached && cached.data.length > 0) {
        set({ comparisonSlots: cached.data });
        log.info(`[FnO] Loaded ${cached.data.length} comparison slots from cache`);
      }
    } catch {
      log.warn('[FnO] Failed to load cached comparison slots');
    }
  },

  executeStrategy: async () => {
    const { strategyLegs, selectedSymbol, spotPrices } = get();
    if (strategyLegs.length === 0) return;

    set({ strategyExecutionLoading: true, showExecutionModal: true });
    try {
      const result = await fnoApi.executeStrategy({
        legs: strategyLegs.map(l => ({
          type: l.type,
          action: l.action,
          strike: l.strike,
          premium: l.premium,
          quantity: l.quantity,
          lotSize: l.lotSize,
          expiry: l.expiry,
        })),
        symbol: selectedSymbol,
        spotPrice: spotPrices[selectedSymbol] || 0,
        name: get().selectedStrategyName,
      });
      set({ strategyExecutionResult: result, strategyExecutionLoading: false });
    } catch {
      set({
        strategyExecutionResult: {
          strategyName: get().selectedStrategyName,
          totalLegs: strategyLegs.length,
          successful: 0,
          failed: strategyLegs.length,
          totalValue: 0,
          legs: strategyLegs.map((_, i) => ({
            legIndex: i,
            legLabel: `Leg ${i + 1}`,
            success: false,
            message: 'Network error — could not reach server',
            status: 'error',
          })),
          executedAt: new Date().toISOString(),
        },
        strategyExecutionLoading: false,
      });
    }
  },

  // ──── Strategy Persistence ──────────────────────────────────────

  setSaveStrategyModal: (show: boolean) => {
    set({ saveStrategyModal: show });
  },

  setLoadStrategyModal: (show: boolean) => {
    set({ loadStrategyModal: show });
  },

  fetchSavedStrategies: async () => {
    set({ savedStrategiesLoading: true });
    try {
      const strategies = await fnoApi.getSavedStrategies();
      set({ savedStrategies: strategies, savedStrategiesLoading: false });
      await offlineCache.save('saved-strategies', strategies);
    } catch {
      // Try loading from cache
      const cached = await offlineCache.load<SavedStrategy[]>('saved-strategies');
      if (cached) {
        set({ savedStrategies: cached.data, savedStrategiesLoading: false });
      } else {
        set({ savedStrategiesLoading: false });
      }
    }
  },

  saveCurrentStrategy: async (name: string, description: string, spotPrice: number, tags?: string[], backtestSnapshotArg?: SavedStrategy['backtestSnapshot']) => {
    const { strategyLegs } = get();
    if (strategyLegs.length === 0) return null;

    try {
      const saved = await fnoApi.saveStrategy({
        name,
        description,
        symbol: get().selectedSymbol,
        spotPrice,
        legs: strategyLegs.map((l: StrategyLeg) => ({
          type: l.type,
          action: l.action,
          strike: l.strike,
          premium: l.premium,
          quantity: l.quantity,
          lotSize: l.lotSize,
          expiry: l.expiry,
        })),
        backtestSnapshot: backtestSnapshotArg,
        tags: tags || [],
      });

      // Let the component close the modal
      get().fetchSavedStrategies();
      return saved;
    } catch {
      return null;
    }
  },

  loadSavedStrategy: (strategy: SavedStrategy) => {
    // Build all legs in one pass, then set state once
    const now = Date.now();
    const defaultExpiry = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    const newLegs: StrategyLeg[] = strategy.legs.map((leg, i) => ({
      id: `leg_${now}_${i}`,
      action: leg.action as 'buy' | 'sell',
      type: leg.type as 'CE' | 'PE' | 'FUTURE',
      strike: leg.strike,
      expiry: leg.expiry || defaultExpiry,
      quantity: leg.quantity,
      premium: leg.premium,
      lotSize: leg.lotSize || 50,
    }));

    // Single state update to avoid N re-renders
    set({
      strategyLegs: newLegs,
      selectedStrategyName: strategy.name,
      strategyResult: null,
      loadStrategyModal: false,
    });
  },

  deleteSavedStrategy: async (id: string) => {
    try {
      await fnoApi.deleteStrategy(id);
      set(state => ({
        savedStrategies: state.savedStrategies.filter(s => s.id !== id),
      }));
      return true;
    } catch {
      return false;
    }
  },

  shareSavedStrategy: async (id: string) => {
    try {
      const result = await fnoApi.shareStrategy(id);
      // Update the local state to reflect shared status
      set(state => ({
        savedStrategies: state.savedStrategies.map(s =>
          s.id === id ? { ...s, isShared: true, shareId: result.shareId } : s,
        ),
      }));
      return result;
    } catch {
      return null;
    }
  },

  unshareSavedStrategy: async (id: string) => {
    try {
      await fnoApi.unshareStrategy(id);
      set(state => ({
        savedStrategies: state.savedStrategies.map(s =>
          s.id === id ? { ...s, isShared: false, shareId: undefined } : s,
        ),
      }));
      return true;
    } catch {
      return false;
    }
  },

  // Order Modal
  openOrderModal: (contract: OptionContract, type: 'buy' | 'sell') => {
    set({ showOrderModal: true, selectedContract: contract, orderType: type, orderQuantity: 1 });
  },

  closeOrderModal: () => {
    set({ showOrderModal: false, selectedContract: null, orderQuantity: 1 });
  },

  setOrderQuantity: (qty: number) => {
    set({ orderQuantity: Math.max(1, qty) });
  },

  loadCachedFno: async () => {
    const cached = await offlineCache.load<{
      expiries: FnOExpiry[];
      optionChain: OptionChain | null;
      futures: FutureContract[];
      positions: FnOPosition[];
      spotPrices: Record<string, number>;
    }>('fno');
    if (cached) {
      set({
        expiries: cached.data.expiries,
        optionChain: cached.data.optionChain,
        futures: cached.data.futures,
        positions: cached.data.positions,
        spotPrices: cached.data.spotPrices,
      });
    }

    // Also hydrate cached comparison slots
    get().loadCachedComparisonSlots();
  },

  placeOrder: async () => {
    const { selectedContract, orderType, selectedSymbol, selectedExpiry, orderQuantity } = get();
    if (!selectedContract || !selectedExpiry) return;

    try {
      await fnoApi.placeOrder({
        symbol: selectedSymbol,
        type: selectedContract.type,
        action: orderType,
        strike: selectedContract.strike,
        expiry: selectedExpiry.date,
        quantity: orderQuantity,
        price: selectedContract.ltp,
      });
      set({ showOrderModal: false, selectedContract: null, orderQuantity: 1 });
    } catch {
      // Handle error
    }
  },
}));
