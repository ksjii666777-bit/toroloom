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
};
