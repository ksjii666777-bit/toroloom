import { api } from './client';
import type {
  OptionChain,
  FnOExpiry,
  FutureContract,
  FnOPosition,
  StrategyPnLPoint,
} from '../../types';

export interface StrategyAnalyzeRequest {
  legs: {
    type: 'CE' | 'PE' | 'FUTURE';
    strike: number;
    action: 'buy' | 'sell';
    premium: number;
    quantity: number;
  }[];
  spotPrice: number;
}

export interface StrategyAnalyzeResult {
  spotPrice: number;
  maxProfit: number;
  maxLoss: number;
  maxProfitPercent: number;
  maxLossPercent: number;
  breakevenPoints: number[];
  isBullish: boolean;
  isBearish: boolean;
  isNeutral: boolean;
  totalLegs: number;
  pnlChart: StrategyPnLPoint[];
}

export interface PrebuiltStrategy {
  id: string;
  name: string;
  description: string;
  riskCategory: 'low' | 'moderate' | 'high';
  isBullish: boolean;
  isBearish: boolean;
  isNeutral: boolean;
  legs: { type: string; action: string; count: number }[];
}

export interface FnOPlaceOrderRequest {
  symbol: string;
  type: 'FUTURE' | 'CE' | 'PE';
  action: 'buy' | 'sell';
  strike?: number;
  expiry: string;
  quantity: number;
  price: number;
  productType?: string;
}

export interface FnOOrderResult {
  success: boolean;
  orderId: string;
  message: string;
  type: string;
  action: string;
  symbol: string;
  strike: number | null;
  quantity: number;
  lotSize: number;
  price: number;
  timestamp: string;
  status: string;
}

// ──── Strategy Persistence Types ─────────────────────────────────────────

export interface SavedStrategy {
  id: string;
  name: string;
  description: string;
  symbol?: string;
  createdAt: string;
  updatedAt: string;
  spotPrice: number;
  legs: {
    type: string;
    action: string;
    strike: number;
    premium: number;
    quantity: number;
    lotSize: number;
    expiry: string;
  }[];
  /** Optional backtest result snapshot */
  backtestSnapshot?: {
    winRate: number;
    sharpeRatio: number;
    maxDrawdownPercent: number;
    profitFactor: number;
    totalPnl: number;
  };
  /** Whether this strategy is shared publicly */
  isShared?: boolean;
  /** Unique share link ID (if shared) */
  shareId?: string;
  /** Tags for filtering */
  tags?: string[];
}

export const fnoApi = {
  /** Get available expiry dates for a symbol */
  getExpiries: (symbol: string) =>
    api.get<{ symbol: string; expiries: FnOExpiry[] }>(`/fno/expiries?symbol=${encodeURIComponent(symbol)}`),

  /** Get option chain for a symbol and expiry */
  getOptionChain: (symbol: string, expiry?: string, spotPrice?: number) => {
    let path = `/fno/option-chain?symbol=${encodeURIComponent(symbol)}`;
    if (expiry) path += `&expiry=${encodeURIComponent(expiry)}`;
    if (spotPrice) path += `&spotPrice=${spotPrice}`;
    return api.get<OptionChain>(path);
  },

  /** Get futures contracts for a symbol */
  getFutures: (symbol: string) =>
    api.get<{ symbol: string; spotPrice: number; futures: FutureContract[] }>(
      `/fno/futures?symbol=${encodeURIComponent(symbol)}`,
    ),

  /** Get spot prices for common symbols */
  getSpotPrices: () => api.get<Record<string, number>>('/fno/spot-prices'),

  /** Get F&O market status */
  getMarketStatus: () =>
    api.get<{ isOpen: boolean; status: string; message: string; currentTime: string }>('/fno/market-status'),

  /** Place an F&O order */
  placeOrder: (order: FnOPlaceOrderRequest) =>
    api.post<FnOOrderResult>('/fno/place-order', order),

  /** Analyze a multi-leg strategy */
  analyzeStrategy: (request: StrategyAnalyzeRequest) =>
    api.post<StrategyAnalyzeResult>('/fno/strategy/analyze', request),

  /** Get pre-built strategies list */
  getPrebuiltStrategies: () =>
    api.get<PrebuiltStrategy[]>('/fno/prebuilt-strategies'),

  /** Get open F&O positions */
  getPositions: () => api.get<FnOPosition[]>('/fno/positions'),

  // ──── Strategy Persistence ─────────────────────────────────────

  /** Save a strategy to the backend */
  saveStrategy: (strategy: Omit<SavedStrategy, 'id' | 'createdAt' | 'updatedAt' | 'shareId'>) =>
    api.post<SavedStrategy>('/fno/strategies', strategy),

  /** Update an existing strategy */
  updateStrategy: (id: string, updates: Partial<SavedStrategy>) =>
    api.put<SavedStrategy>(`/fno/strategies/${id}`, updates),

  /** Get all saved strategies for the current user */
  getSavedStrategies: () =>
    api.get<SavedStrategy[]>('/fno/strategies'),

  /** Get a single saved strategy by ID */
  getStrategyById: (id: string) =>
    api.get<SavedStrategy>(`/fno/strategies/${id}`),

  /** Delete a saved strategy */
  deleteStrategy: (id: string) =>
    api.delete<{ success: boolean }>(`/fno/strategies/${id}`),

  /** Share a strategy (makes it public and returns share link) */
  shareStrategy: (id: string) =>
    api.post<{ shareId: string; shareUrl: string }>(`/fno/strategies/${id}/share`),

  /** Unshare a strategy */
  unshareStrategy: (id: string) =>
    api.post<{ success: boolean }>(`/fno/strategies/${id}/unshare`),

  /** Load a shared strategy by its share ID */
  getSharedStrategy: (shareId: string) =>
    api.get<SavedStrategy>(`/fno/strategies/shared/${shareId}`),

  /** Execute a multi-leg strategy (sends all legs to broker) */
  executeStrategy: (request: {
    legs: {
      type: string;
      action: string;
      strike: number;
      premium: number;
      quantity: number;
      lotSize: number;
      expiry: string;
    }[];
    symbol: string;
    spotPrice: number;
    name?: string;
    productType?: string;
    orderType?: string;
  }) =>
    api.post<{
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
    }>('/fno/strategy/execute', request),

  /** Fetch historical OHLC data for backtesting */
  getHistoricalData: (symbol: string, days?: number) =>
    api.get<{
      symbol: string;
      days: number;
      data: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
      source: 'broker' | 'mock' | 'cache';
    }>(`/fno/historical-data?symbol=${encodeURIComponent(symbol)}&days=${days || 365}`),
};
