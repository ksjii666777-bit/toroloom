/**
 * ============================================================================
 * Toroloom — Forex / Currency Markets API Client
 * ============================================================================
 *
 * Connects to the backend /api/forex endpoints with fallback data.
 *
 * Uses api.withFallback() pattern: tries backend first, falls back to
 * static mock data on network failure.
 * ============================================================================
 */

import { api } from './client';
import type { CurrencyPair } from '../../types';

// ─── API Response Types ──────────────────────────────────────────────────

interface ForexApiResponse {
  success: boolean;
  count: number;
  pairs: ForexApiPair[];
}

interface ForexApiPair {
  id: string;
  pair: string;
  baseCurrency: string;
  quoteCurrency: string;
  name: string;
  rate: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  week52High: number;
  week52Low: number;
  isRbiReference: boolean;
  region: 'major' | 'asian' | 'other';
  icon: string;
  color: string;
  trend?: string;
  volatility?: number;
}

// ─── Fallback Mock Data ─────────────────────────────────────────────────

const FALLBACK_PAIRS: CurrencyPair[] = [
  { id: 'usdinr',   pair: 'USD/INR', baseCurrency: 'USD', quoteCurrency: 'INR', name: 'US Dollar / Indian Rupee', rate: 83.45, change: -0.12, changePercent: -0.14, dayHigh: 83.62, dayLow: 83.38, week52High: 84.15, week52Low: 82.75, isRbiReference: true, region: 'major', icon: '💵', color: '#3B82F6', trend: 'RBI intervention keeps USD/INR range-bound.', volatility: 4.2 },
  { id: 'eurinr',   pair: 'EUR/INR', baseCurrency: 'EUR', quoteCurrency: 'INR', name: 'Euro / Indian Rupee', rate: 90.78, change: 0.35, changePercent: 0.39, dayHigh: 90.92, dayLow: 90.45, week52High: 92.50, week52Low: 88.20, isRbiReference: true, region: 'major', icon: '💶', color: '#0052CC', trend: 'EUR strengthening on ECB hawkish stance.', volatility: 5.8 },
  { id: 'gbpinr',   pair: 'GBP/INR', baseCurrency: 'GBP', quoteCurrency: 'INR', name: 'British Pound / Indian Rupee', rate: 106.20, change: 0.65, changePercent: 0.62, dayHigh: 106.45, dayLow: 105.55, week52High: 108.80, week52Low: 103.40, isRbiReference: true, region: 'major', icon: '💷', color: '#FF5252', trend: 'Pound supported by UK services PMI.', volatility: 6.5 },
  { id: 'jpyinr',   pair: 'JPY/INR', baseCurrency: 'JPY', quoteCurrency: 'INR', name: 'Japanese Yen / Indian Rupee', rate: 0.54, change: -0.002, changePercent: -0.37, dayHigh: 0.545, dayLow: 0.538, week52High: 0.58, week52Low: 0.51, isRbiReference: false, region: 'major', icon: '💴', color: '#FFC107', trend: 'Yen under pressure from BoJ ultra-loose policy.', volatility: 8.2 },
  { id: 'sgdinr',   pair: 'SGD/INR', baseCurrency: 'SGD', quoteCurrency: 'INR', name: 'Singapore Dollar / Indian Rupee', rate: 61.80, change: 0.15, changePercent: 0.24, dayHigh: 61.95, dayLow: 61.62, week52High: 63.20, week52Low: 60.10, isRbiReference: false, region: 'asian', icon: '🇸🇬', color: '#00E676', trend: 'SGD stable on MAS policy.', volatility: 3.5 },
  { id: 'cnyinr',   pair: 'CNY/INR', baseCurrency: 'CNY', quoteCurrency: 'INR', name: 'Chinese Yuan / Indian Rupee', rate: 11.52, change: -0.04, changePercent: -0.35, dayHigh: 11.58, dayLow: 11.48, week52High: 12.10, week52Low: 11.30, isRbiReference: false, region: 'asian', icon: '🇨🇳', color: '#FF6B6B', trend: 'Yuan weakness on China economic slowdown.', volatility: 6.1 },
  { id: 'hkdInr',   pair: 'HKD/INR', baseCurrency: 'HKD', quoteCurrency: 'INR', name: 'Hong Kong Dollar / Indian Rupee', rate: 10.68, change: -0.02, changePercent: -0.19, dayHigh: 10.72, dayLow: 10.65, week52High: 11.00, week52Low: 10.40, isRbiReference: false, region: 'asian', icon: '🇭🇰', color: '#8B5CF6', trend: 'HKD pegged to USD, mirroring USD/INR.', volatility: 2.8 },
  { id: 'thbinr',   pair: 'THB/INR', baseCurrency: 'THB', quoteCurrency: 'INR', name: 'Thai Baht / Indian Rupee', rate: 2.28, change: 0.01, changePercent: 0.44, dayHigh: 2.30, dayLow: 2.27, week52High: 2.45, week52Low: 2.20, isRbiReference: false, region: 'asian', icon: '🇹🇭', color: '#06B6D4', trend: 'Baht supported by tourism recovery.', volatility: 4.5 },
  { id: 'eurusd',   pair: 'EUR/USD', baseCurrency: 'EUR', quoteCurrency: 'USD', name: 'Euro / US Dollar', rate: 1.0875, change: 0.0045, changePercent: 0.42, dayHigh: 1.0890, dayLow: 1.0830, week52High: 1.1200, week52Low: 1.0600, isRbiReference: false, region: 'other', icon: '💶', color: '#0052CC', trend: 'EUR/USD testing resistance.', volatility: 7.5 },
  { id: 'gbpusd',   pair: 'GBP/USD', baseCurrency: 'GBP', quoteCurrency: 'USD', name: 'British Pound / US Dollar', rate: 1.2730, change: 0.0080, changePercent: 0.63, dayHigh: 1.2750, dayLow: 1.2650, week52High: 1.3200, week52Low: 1.2400, isRbiReference: false, region: 'other', icon: '💷', color: '#FF5252', trend: 'Cable rallying on hawkish BoE.', volatility: 8.8 },
  { id: 'usdjpy',   pair: 'USD/JPY', baseCurrency: 'USD', quoteCurrency: 'JPY', name: 'US Dollar / Japanese Yen', rate: 154.80, change: 0.50, changePercent: 0.32, dayHigh: 155.20, dayLow: 154.30, week52High: 162.00, week52Low: 140.00, isRbiReference: false, region: 'other', icon: '💴', color: '#FFC107', trend: 'USD/JPY elevated on rate differential.', volatility: 10.2 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Map backend API pair to frontend CurrencyPair type */
function mapApiToCurrencyPair(apiPair: ForexApiPair): CurrencyPair {
  return {
    id: apiPair.id,
    pair: apiPair.pair,
    baseCurrency: apiPair.baseCurrency,
    quoteCurrency: apiPair.quoteCurrency,
    name: apiPair.name,
    rate: apiPair.rate,
    change: apiPair.change,
    changePercent: apiPair.changePercent,
    dayHigh: apiPair.dayHigh,
    dayLow: apiPair.dayLow,
    week52High: apiPair.week52High,
    week52Low: apiPair.week52Low,
    isRbiReference: apiPair.isRbiReference,
    region: apiPair.region,
    icon: apiPair.icon,
    color: apiPair.color,
    trend: apiPair.trend,
    volatility: apiPair.volatility,
  };
}

// ─── API Client ──────────────────────────────────────────────────────────

export const forexApi = {
  /**
   * Get all forex pairs with fallback to static mock data.
   */
  getRates: (): Promise<CurrencyPair[]> =>
    api.withFallback(
      () => api.get<ForexApiResponse>('/forex/rates').then(res => res.pairs.map(mapApiToCurrencyPair)),
      FALLBACK_PAIRS,
    ),

  /**
   * Get a single currency pair by ID.
   */
  getPair: (id: string): Promise<CurrencyPair | null> =>
    api.withFallback(
      () => api.get<{ success: boolean; pair: ForexApiPair }>(`/forex/rates/${id}`)
        .then(res => res.pair ? mapApiToCurrencyPair(res.pair) : null),
      FALLBACK_PAIRS.find(p => p.id === id) ?? null,
    ),

  /** Get the static fallback data (useful for unit tests) */
  getFallbackPairs: () => [...FALLBACK_PAIRS],
};
