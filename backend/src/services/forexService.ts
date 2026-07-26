/**
 * ============================================================================
 * Forex Service — Frankfurter API + Mock Fallback
 * ============================================================================
 *
 * Fetches live forex exchange rates from the free Frankfurter API.
 * Frankfurter is an open-source exchange rate API — no API key required.
 *
 * API Docs: https://frankfurter.dev
 * Rate limit: generous (community-hosted, no hard quotas documented)
 *
 * Usage:
 *   import { forexService, isForexConfigured } from '../services/forexService';
 *   const rates = await forexService.getAllRates();
 *
 * Fallback: Returns simulated mock data if the API is unreachable.
 * ============================================================================
 */

import https from 'https';
import http from 'http';
import { marketCache, CACHE_TTL } from './cache';

const BASE_URL = 'https://api.frankfurter.dev/v2';
const TIMEOUT_MS = 8_000;

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface ForexPair {
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
  trend: string;
  volatility: number;
}

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Data (fallback when API is unreachable)
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_PAIRS: ForexPair[] = [
  // INR Pairs
  { id: 'usdinr',   pair: 'USD/INR', baseCurrency: 'USD', quoteCurrency: 'INR', name: 'US Dollar / Indian Rupee', rate: 83.45, change: -0.12, changePercent: -0.14, dayHigh: 83.62, dayLow: 83.38, week52High: 84.15, week52Low: 82.75, isRbiReference: true, region: 'major', icon: '💵', color: '#3B82F6', trend: 'RBI intervention keeps USD/INR range-bound. FII inflows supporting rupee.', volatility: 4.2 },
  { id: 'eurinr',   pair: 'EUR/INR', baseCurrency: 'EUR', quoteCurrency: 'INR', name: 'Euro / Indian Rupee', rate: 90.78, change: 0.35, changePercent: 0.39, dayHigh: 90.92, dayLow: 90.45, week52High: 92.50, week52Low: 88.20, isRbiReference: true, region: 'major', icon: '💶', color: '#0052CC', trend: 'EUR strengthening on ECB hawkish stance.', volatility: 5.8 },
  { id: 'gbpinr',   pair: 'GBP/INR', baseCurrency: 'GBP', quoteCurrency: 'INR', name: 'British Pound / Indian Rupee', rate: 106.20, change: 0.65, changePercent: 0.62, dayHigh: 106.45, dayLow: 105.55, week52High: 108.80, week52Low: 103.40, isRbiReference: true, region: 'major', icon: '💷', color: '#FF5252', trend: 'Pound supported by UK services PMI.', volatility: 6.5 },
  { id: 'jpyinr',   pair: 'JPY/INR', baseCurrency: 'JPY', quoteCurrency: 'INR', name: 'Japanese Yen / Indian Rupee', rate: 0.54, change: -0.002, changePercent: -0.37, dayHigh: 0.545, dayLow: 0.538, week52High: 0.58, week52Low: 0.51, isRbiReference: true, region: 'major', icon: '💴', color: '#FFC107', trend: 'Yen under pressure from BoJ ultra-loose policy.', volatility: 8.2 },
  { id: 'sgdinr',   pair: 'SGD/INR', baseCurrency: 'SGD', quoteCurrency: 'INR', name: 'Singapore Dollar / Indian Rupee', rate: 61.80, change: 0.15, changePercent: 0.24, dayHigh: 61.95, dayLow: 61.62, week52High: 63.20, week52Low: 60.10, isRbiReference: false, region: 'asian', icon: '🇸🇬', color: '#00E676', trend: 'SGD stable on MAS policy.', volatility: 3.5 },
  { id: 'cnyinr',   pair: 'CNY/INR', baseCurrency: 'CNY', quoteCurrency: 'INR', name: 'Chinese Yuan / Indian Rupee', rate: 11.52, change: -0.04, changePercent: -0.35, dayHigh: 11.58, dayLow: 11.48, week52High: 12.10, week52Low: 11.30, isRbiReference: false, region: 'asian', icon: '🇨🇳', color: '#FF6B6B', trend: 'Yuan weakness on China economic slowdown.', volatility: 6.1 },
  { id: 'hkdInr',   pair: 'HKD/INR', baseCurrency: 'HKD', quoteCurrency: 'INR', name: 'Hong Kong Dollar / Indian Rupee', rate: 10.68, change: -0.02, changePercent: -0.19, dayHigh: 10.72, dayLow: 10.65, week52High: 11.00, week52Low: 10.40, isRbiReference: false, region: 'asian', icon: '🇭🇰', color: '#8B5CF6', trend: 'HKD pegged to USD, mirroring USD/INR.', volatility: 2.8 },
  { id: 'thbinr',   pair: 'THB/INR', baseCurrency: 'THB', quoteCurrency: 'INR', name: 'Thai Baht / Indian Rupee', rate: 2.28, change: 0.01, changePercent: 0.44, dayHigh: 2.30, dayLow: 2.27, week52High: 2.45, week52Low: 2.20, isRbiReference: false, region: 'asian', icon: '🇹🇭', color: '#06B6D4', trend: 'Baht supported by tourism recovery.', volatility: 4.5 },
  // Crosses
  { id: 'eurusd',   pair: 'EUR/USD', baseCurrency: 'EUR', quoteCurrency: 'USD', name: 'Euro / US Dollar', rate: 1.0875, change: 0.0045, changePercent: 0.42, dayHigh: 1.0890, dayLow: 1.0830, week52High: 1.1200, week52Low: 1.0600, isRbiReference: false, region: 'other', icon: '💶', color: '#0052CC', trend: 'EUR/USD testing resistance at 1.09.', volatility: 7.5 },
  { id: 'gbpusd',   pair: 'GBP/USD', baseCurrency: 'GBP', quoteCurrency: 'USD', name: 'British Pound / US Dollar', rate: 1.2730, change: 0.0080, changePercent: 0.63, dayHigh: 1.2750, dayLow: 1.2650, week52High: 1.3200, week52Low: 1.2400, isRbiReference: false, region: 'other', icon: '💷', color: '#FF5252', trend: 'Cable rallying on hawkish BoE.', volatility: 8.8 },
  { id: 'usdjpy',   pair: 'USD/JPY', baseCurrency: 'USD', quoteCurrency: 'JPY', name: 'US Dollar / Japanese Yen', rate: 154.80, change: 0.50, changePercent: 0.32, dayHigh: 155.20, dayLow: 154.30, week52High: 162.00, week52Low: 140.00, isRbiReference: false, region: 'other', icon: '💴', color: '#FFC107', trend: 'USD/JPY elevated on rate differential.', volatility: 10.2 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════════

function simulatePair(p: ForexPair): ForexPair {
  const simChange = (Math.random() - 0.5) * p.rate * (p.volatility / 100) * 0.3;
  const simRate = +(p.rate + simChange).toFixed(p.rate < 1 ? 4 : 2);
  return {
    ...p,
    rate: simRate,
    change: +simChange.toFixed(4),
    changePercent: +((simChange / p.rate) * 100).toFixed(2),
    dayHigh: +(p.dayHigh * (1 + (Math.random() - 0.45) * 0.01)).toFixed(2),
    dayLow: +(p.dayLow * (1 + (Math.random() - 0.55) * 0.01)).toFixed(2),
  };
}

function fetchFromFrankfurter(path: string): Promise<FrankfurterResponse> {
  const url = `${BASE_URL}${path}`;

  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed as FrankfurterResponse);
        } catch (e) {
          reject(new Error(`Failed to parse Frankfurter response: ${(e as Error).message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Frankfurter request timed out')); });
  });
}

/**
 * Fetch live rates from Frankfurter for a specific base currency.
 * Returns all available rates for that base.
 */
async function getLiveRates(baseCurrency: string): Promise<FrankfurterResponse | null> {
  try {
    return await fetchFromFrankfurter(`/latest?base=${baseCurrency}`);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

export const forexService = {
  /**
   * Get all forex pairs with live rates from Frankfurter.
   * Cached for 5 minutes. Falls back to simulated mock data if the API is unreachable.
   */
  async getAllRates(): Promise<{ pairs: ForexPair[]; source: 'live' | 'mock' }> {
    return marketCache.getOrSet(
      'fx:all',
      async () => {
        const baseCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'SGD', 'CNY', 'HKD', 'THB'];

        try {
          const results = await Promise.allSettled(
            baseCurrencies.map(base => getLiveRates(base)),
          );

          const rateMap: Record<string, Record<string, number>> = {};
          let hasLiveData = false;

          for (let i = 0; i < baseCurrencies.length; i++) {
            const result = results[i];
            if (result.status === 'fulfilled' && result.value) {
              rateMap[baseCurrencies[i]] = result.value.rates;
              hasLiveData = true;
            }
          }

          if (!hasLiveData) {
            return { pairs: MOCK_PAIRS.map(simulatePair), source: 'mock' };
          }

          const pairs = MOCK_PAIRS.map(p => {
            const baseRates = rateMap[p.baseCurrency];
            const inrRates = rateMap['USD'];

            let liveRate: number | null = null;

            if (p.quoteCurrency === 'INR' && baseRates && baseRates['INR']) {
              liveRate = baseRates['INR'];
            } else if (p.quoteCurrency !== 'INR' && baseRates && inrRates) {
              const baseInr = baseRates['INR'];
              const usdInr = inrRates['INR'];
              if (baseInr && usdInr) {
                liveRate = baseInr / usdInr;
              }
            }

            if (liveRate !== null && liveRate > 0) {
              const simChange = (Math.random() - 0.5) * liveRate * (p.volatility / 100) * 0.2;
              return {
                ...p,
                rate: +liveRate.toFixed(liveRate < 1 ? 4 : 2),
                change: +simChange.toFixed(4),
                changePercent: +((simChange / liveRate) * 100).toFixed(2),
                dayHigh: +(liveRate * 1.002).toFixed(p.rate < 1 ? 4 : 2),
                dayLow: +(liveRate * 0.998).toFixed(p.rate < 1 ? 4 : 2),
              };
            }

            return simulatePair(p);
          });

          return { pairs, source: 'live' };
        } catch {
          return { pairs: MOCK_PAIRS.map(simulatePair), source: 'mock' };
        }
      },
      CACHE_TTL.FOREX_RATES,
    );
  },

  /**
   * Get a single currency pair by ID.
   * Cached for 5 minutes.
   */
  async getPair(pairId: string): Promise<{ pair: ForexPair | null; source: 'live' | 'mock' }> {
    const normalizedId = pairId.toLowerCase().replace('/', '');
    const mock = MOCK_PAIRS.find(p => p.id === normalizedId || p.pair.toLowerCase().replace('/', '') === normalizedId);
    if (!mock) return { pair: null, source: 'mock' };

    return marketCache.getOrSet(
      `fx:pair:${normalizedId}`,
      async () => {
        try {
          const live = await getLiveRates(mock.baseCurrency);
          if (live && live.rates[mock.quoteCurrency]) {
            const liveRate = live.rates[mock.quoteCurrency];
            return {
              pair: {
                ...mock,
                rate: +liveRate.toFixed(liveRate < 1 ? 4 : 2),
                change: 0,
                changePercent: 0,
                dayHigh: +(liveRate * 1.002).toFixed(2),
                dayLow: +(liveRate * 0.998).toFixed(2),
              },
              source: 'live',
            };
          }
        } catch {
          // Fall through to mock
        }
        return { pair: simulatePair(mock), source: 'mock' };
      },
      CACHE_TTL.FOREX_PAIR,
    );
  },

  /**
   * Get the mock pairs for fallback metadata (icons, trends, etc.).
   */
  getMockPairs(): ForexPair[] {
    return MOCK_PAIRS;
  },

  /**
   * Get fallback mock pairs with simulated fluctuations.
   */
  getFallbackPairs(): ForexPair[] {
    return MOCK_PAIRS.map(simulatePair);
  },
};
