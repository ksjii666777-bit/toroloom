/**
 * ============================================================================
 * Commodity Service — API Ninjas + Mock Fallback
 * ============================================================================
 *
 * Fetches live commodity prices from API Ninjas.
 * See: https://api-ninjas.com/api/commodityprice
 *
 * Free tier: 15-minute delayed data, limited monthly quota.
 *
 * Usage:
 *   import { commodityService, isCommodityApiConfigured } from '../services/commodityService';
 *   const data = await commodityService.getAll();
 *
 * Fallback: Returns simulated mock data if the API is unreachable or key is missing.
 * ============================================================================
 */

import https from 'https';
import http from 'http';
import { marketCache, CACHE_TTL } from './cache';

const BASE_URL = 'https://api.api-ninjas.com/v1';
const TIMEOUT_MS = 8_000;

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface CommodityData {
  id: string;
  name: string;
  symbol: string;
  category: 'metals' | 'energy' | 'agriculture';
  price: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  week52High: number;
  week52Low: number;
  unit: string;
  inrPrice: number;
  icon: string;
  color: string;
  trend: string;
  volatility: number;
  stat: string;
}

interface ApiNinjasConfig {
  apiKey: string;
}

const config: ApiNinjasConfig = {
  apiKey: process.env.COMMODITY_API_KEY || '',
};

/**
 * Update the API Ninjas configuration (called on startup from env).
 */
export function configureCommodityApi(envConfig: { commodityApiKey?: string }): void {
  if (envConfig.commodityApiKey) {
    config.apiKey = envConfig.commodityApiKey;
  }
}

/**
 * Check if the commodity API is configured with an API key.
 */
export function isCommodityApiConfigured(): boolean {
  return config.apiKey.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Data (fallback when API is unreachable)
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_COMMODITIES: CommodityData[] = [
  // Precious Metals
  { id: 'gold', name: 'Gold', symbol: 'XAUUSD', category: 'metals', price: 2335.40, change: 18.20, changePercent: 0.79, dayHigh: 2342.80, dayLow: 2318.50, week52High: 2450.00, week52Low: 1980.00, unit: 'oz', inrPrice: 73210, icon: '🥇', color: '#FFC107', trend: 'Gold supported by geopolitical tensions and central bank buying.', volatility: 12.5, stat: 'Central banks bought 1,037T in Q1 2026' },
  { id: 'silver', name: 'Silver', symbol: 'XAGUSD', category: 'metals', price: 29.45, change: 0.52, changePercent: 1.80, dayHigh: 29.68, dayLow: 28.95, week52High: 32.50, week52Low: 22.10, unit: 'oz', inrPrice: 923, icon: '🥈', color: '#9E9E9E', trend: 'Silver benefiting from industrial demand (solar) and monetary demand.', volatility: 18.5, stat: 'Industrial demand up 8% YoY' },
  { id: 'platinum', name: 'Platinum', symbol: 'XPTUSD', category: 'metals', price: 985.00, change: -4.50, changePercent: -0.45, dayHigh: 992.00, dayLow: 982.00, week52High: 1120.00, week52Low: 880.00, unit: 'oz', inrPrice: 30880, icon: '💎', color: '#00BCD4', trend: 'Platinum supply deficit narrowing. Auto catalyst demand steady.', volatility: 15.2, stat: 'Supply deficit of 340K oz projected' },
  { id: 'palladium', name: 'Palladium', symbol: 'XPDUSD', category: 'metals', price: 965.00, change: 8.50, changePercent: 0.89, dayHigh: 972.00, dayLow: 956.00, week52High: 1150.00, week52Low: 850.00, unit: 'oz', inrPrice: 30250, icon: '🔘', color: '#6C63FF', trend: 'Palladium recovering from EV transition fears.', volatility: 22.3, stat: 'Auto sector consumes 80% of supply' },
  // Energy
  { id: 'crude', name: 'Crude Oil (WTI)', symbol: 'CL', category: 'energy', price: 78.50, change: -1.20, changePercent: -1.51, dayHigh: 80.10, dayLow: 78.20, week52High: 95.00, week52Low: 68.00, unit: 'barrel', inrPrice: 6560, icon: '🛢️', color: '#FF5252', trend: 'OPEC+ supply increase concerns outweighing summer demand.', volatility: 28.5, stat: 'OPEC+ quota: 40.5M bpd' },
  { id: 'naturalgas', name: 'Natural Gas', symbol: 'NG', category: 'energy', price: 2.85, change: 0.08, changePercent: 2.89, dayHigh: 2.92, dayLow: 2.76, week52High: 3.60, week52Low: 1.80, unit: 'MMBtu', inrPrice: 238, icon: '🔥', color: '#FF9800', trend: 'Gas prices rising on LNG export demand and summer cooling.', volatility: 35.8, stat: 'LNG exports up 12% YoY' },
  { id: 'gasoline', name: 'Gasoline (RBOB)', symbol: 'XB', category: 'energy', price: 2.45, change: -0.04, changePercent: -1.61, dayHigh: 2.50, dayLow: 2.42, week52High: 3.10, week52Low: 2.10, unit: 'gallon', inrPrice: 205, icon: '⛽', color: '#FF6B00', trend: 'Summer driving season demand offset by increased refinery output.', volatility: 32.1, stat: 'US gasoline demand: 9.2M bpd' },
  // Base Metals
  { id: 'copper', name: 'Copper', symbol: 'HG', category: 'metals', price: 4.52, change: 0.06, changePercent: 1.35, dayHigh: 4.56, dayLow: 4.45, week52High: 5.20, week52Low: 3.65, unit: 'lb', inrPrice: 378, icon: '🪙', color: '#FF6B35', trend: 'Copper benefiting from electrification demand.', volatility: 20.4, stat: 'Global demand growth: 3.5% CAGR' },
  { id: 'aluminum', name: 'Aluminum', symbol: 'ALI', category: 'metals', price: 2560.00, change: 18.00, changePercent: 0.71, dayHigh: 2580.00, dayLow: 2540.00, week52High: 2850.00, week52Low: 2200.00, unit: 'tonne', inrPrice: 80220, icon: '🪶', color: '#00E5FF', trend: 'Aluminum supported by green energy transition.', volatility: 16.7, stat: 'China output capped at 45M tonnes' },
  { id: 'zinc', name: 'Zinc', symbol: 'ZNC', category: 'metals', price: 2850.00, change: -22.00, changePercent: -0.77, dayHigh: 2880.00, dayLow: 2840.00, week52High: 3200.00, week52Low: 2400.00, unit: 'tonne', inrPrice: 89320, icon: '⚡', color: '#8BC34A', trend: 'Zinc supply tightness from mine closures.', volatility: 19.3, stat: 'Global refined output: 13.8M tonnes' },
  // Agriculture
  { id: 'corn', name: 'Corn', symbol: 'ZC', category: 'agriculture', price: 445.00, change: 5.50, changePercent: 1.25, dayHigh: 448.00, dayLow: 439.50, week52High: 520.00, week52Low: 400.00, unit: 'bushel', inrPrice: 0, icon: '🌽', color: '#FFC107', trend: 'Corn supported by strong ethanol demand.', volatility: 25.6, stat: 'US corn stocks: 1.8B bushels' },
  { id: 'wheat', name: 'Wheat', symbol: 'ZW', category: 'agriculture', price: 585.00, change: -8.00, changePercent: -1.35, dayHigh: 595.00, dayLow: 582.00, week52High: 720.00, week52Low: 530.00, unit: 'bushel', inrPrice: 0, icon: '🌾', color: '#FFA726', trend: 'Wheat under pressure from ample global supply.', volatility: 30.2, stat: 'Global wheat stocks: 260M tonnes' },
  { id: 'soybeans', name: 'Soybeans', symbol: 'ZS', category: 'agriculture', price: 1185.00, change: 12.50, changePercent: 1.07, dayHigh: 1192.00, dayLow: 1172.00, week52High: 1350.00, week52Low: 1050.00, unit: 'bushel', inrPrice: 0, icon: '🫘', color: '#8BC34A', trend: 'Soybeans supported by strong crush margins.', volatility: 22.8, stat: 'Brazil soy production: 155M tonnes' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════════

function simulateCommodity(c: CommodityData): CommodityData {
  const volFactor = c.volatility / 100;
  const simChange = (Math.random() - 0.5) * c.price * volFactor * 0.3;
  const simPrice = +(c.price + simChange).toFixed(c.price < 10 ? 2 : 1);
  return {
    ...c,
    price: simPrice,
    change: +simChange.toFixed(2),
    changePercent: +((simChange / c.price) * 100).toFixed(2),
    dayHigh: +(c.dayHigh * (1 + (Math.random() - 0.45) * 0.008)).toFixed(c.dayHigh < 10 ? 2 : 1),
    dayLow: +(c.dayLow * (1 + (Math.random() - 0.55) * 0.008)).toFixed(c.dayLow < 10 ? 2 : 1),
  };
}

function fetchFromApiNinjas<T>(path: string): Promise<T> {
  if (!config.apiKey) {
    return Promise.reject(new Error('API Ninjas API key not configured. Set COMMODITY_API_KEY env var.'));
  }

  const url = `${BASE_URL}${path}`;

  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: TIMEOUT_MS, headers: { 'X-Api-Key': config.apiKey } }, (res) => {
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed as T);
        } catch (e) {
          reject(new Error(`Failed to parse API Ninjas response: ${(e as Error).message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('API Ninjas request timed out')); });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

export const commodityService = {
  /**
   * Get all commodities with live prices from API Ninjas.
   * Cached for 5 minutes. Falls back to simulated mock data if the API is unreachable.
   */
  async getAll(): Promise<{ commodities: CommodityData[]; source: 'live' | 'mock' }> {
    return marketCache.getOrSet(
      'commodity:all',
      async () => {
        if (!isCommodityApiConfigured()) {
          return { commodities: MOCK_COMMODITIES.map(simulateCommodity), source: 'mock' };
        }

        try {
          const commodityNames = ['GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM', 'CRUDE_OIL', 'NATURAL_GAS', 'COPPER', 'ALUMINUM', 'CORN', 'WHEAT', 'SOYBEANS'];
          const idMap: Record<string, string> = {
            GOLD: 'gold', SILVER: 'silver', PLATINUM: 'platinum', PALLADIUM: 'palladium',
            CRUDE_OIL: 'crude', NATURAL_GAS: 'naturalgas', GASOLINE: 'gasoline',
            COPPER: 'copper', ALUMINUM: 'aluminum', ZINC: 'zinc',
            CORN: 'corn', WHEAT: 'wheat', SOYBEANS: 'soybeans',
          };

          const results = await Promise.allSettled(
            commodityNames.map(name => fetchFromApiNinjas<{ price: number; change: number; change_percent: number }>(`/commodityprice?name=${name}`)),
          );

          let hasLiveData = false;
          const priceOverrides: Record<string, { price: number; change: number; chgPct: number }> = {};

          for (let i = 0; i < commodityNames.length; i++) {
            const result = results[i];
            if (result.status === 'fulfilled' && result.value && result.value.price) {
              const id = idMap[commodityNames[i]];
              if (id) {
                priceOverrides[id] = {
                  price: result.value.price,
                  change: result.value.change || 0,
                  chgPct: result.value.change_percent || 0,
                };
                hasLiveData = true;
              }
            }
          }

          if (!hasLiveData) {
            return { commodities: MOCK_COMMODITIES.map(simulateCommodity), source: 'mock' };
          }

          const commodities = MOCK_COMMODITIES.map(c => {
            const live = priceOverrides[c.id];
            if (live) {
              return {
                ...c,
                price: live.price,
                change: live.change,
                changePercent: live.chgPct,
                dayHigh: +(live.price * 1.002).toFixed(live.price < 10 ? 2 : 1),
                dayLow: +(live.price * 0.998).toFixed(live.price < 10 ? 2 : 1),
              };
            }
            return simulateCommodity(c);
          });

          return { commodities, source: 'live' };
        } catch {
          return { commodities: MOCK_COMMODITIES.map(simulateCommodity), source: 'mock' };
        }
      },
      CACHE_TTL.COMMODITIES_ALL,
    );
  },

  /**
   * Get a single commodity by ID.
   * Cached for 5 minutes.
   */
  async getById(id: string): Promise<{ commodity: CommodityData | null; source: 'live' | 'mock' }> {
    const mock = MOCK_COMMODITIES.find(c => c.id === id.toLowerCase());
    if (!mock) return { commodity: null, source: 'mock' };

    return marketCache.getOrSet(
      `commodity:${mock.id}`,
      async () => {
        if (!isCommodityApiConfigured()) {
          return { commodity: simulateCommodity(mock), source: 'mock' };
        }

        try {
          const name = mock.name.split(' (')[0].toUpperCase().replace(/ /g, '_');
          const live = await fetchFromApiNinjas<{ price: number; change: number; change_percent: number }>(`/commodityprice?name=${name}`);
          if (live && live.price) {
            return {
              commodity: { ...mock, price: live.price, change: live.change || 0, changePercent: live.change_percent || 0 },
              source: 'live',
            };
          }
        } catch {
          // Fall through
        }

        return { commodity: simulateCommodity(mock), source: 'mock' };
      },
      CACHE_TTL.COMMODITY_SINGLE,
    );
  },

  /**
   * Get commodities filtered by category.
   */
  async getByCategory(category: string): Promise<{ commodities: CommodityData[]; source: 'live' | 'mock' }> {
    const { commodities, source } = await this.getAll();
    return {
      commodities: commodities.filter(c => c.category === category),
      source,
    };
  },

  /**
   * Get fallback mock data (no API call).
   */
  getFallbackData(): CommodityData[] {
    return MOCK_COMMODITIES.map(simulateCommodity);
  },
};
