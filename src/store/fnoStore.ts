import { create } from 'zustand';
import type {
  OptionChain,
  OptionContract,
  FnOExpiry,
  FutureContract,
  FnOPosition,
  StrategyLeg,
} from '../types';
import { fnoApi, StrategyAnalyzeResult, PrebuiltStrategy } from '../services/api/fno';
import { offlineCache } from '../services/offlineCache';
import { registerCacheWarming } from '../services/cacheWarmingService';
import { log } from '../utils/logger';

export type FnOView = 'option-chain' | 'futures' | 'positions';
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

  // Strategy builder
  strategyLegs: StrategyLeg[];
  strategyResult: StrategyAnalyzeResult | null;
  prebuiltStrategies: PrebuiltStrategy[];
  selectedStrategyName: string;

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

  strategyLegs: [],
  strategyResult: null,
  prebuiltStrategies: [],
  selectedStrategyName: 'Custom Strategy',

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
