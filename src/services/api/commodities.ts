/**
 * ============================================================================
 * Toroloom — Commodity Markets API Client
 * ============================================================================
 *
 * Connects to the backend /api/commodities endpoints with fallback data.
 * Uses api.withFallback() pattern.
 * ============================================================================
 */

import { api } from './client';
import type { CommodityAsset } from '../../types';

// ─── API Response Types ──────────────────────────────────────────────────

interface CommodityApiResponse {
  success: boolean;
  count: number;
  commodities: CommodityApiItem[];
}

interface CommodityApiItem {
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
  inrPrice?: number;
  icon: string;
  color: string;
  trend?: string;
  volatility?: number;
  stat?: string;
}

// ─── Fallback Mock Data ─────────────────────────────────────────────────

const FALLBACK_COMMODITIES: CommodityAsset[] = [
  { id: 'gold', name: 'Gold', symbol: 'XAUUSD', category: 'metals', price: 2335.40, change: 18.20, changePercent: 0.79, dayHigh: 2342.80, dayLow: 2318.50, week52High: 2450.00, week52Low: 1980.00, unit: 'oz', inrPrice: 73210, icon: '🥇', color: '#FFC107', trend: 'Gold supported by geopolitical tensions.', volatility: 12.5, stat: 'Central banks bought 1,037T in Q1 2026' },
  { id: 'silver', name: 'Silver', symbol: 'XAGUSD', category: 'metals', price: 29.45, change: 0.52, changePercent: 1.80, dayHigh: 29.68, dayLow: 28.95, week52High: 32.50, week52Low: 22.10, unit: 'oz', inrPrice: 923, icon: '🥈', color: '#9E9E9E', trend: 'Silver benefiting from industrial demand.', volatility: 18.5, stat: 'Industrial demand up 8% YoY' },
  { id: 'platinum', name: 'Platinum', symbol: 'XPTUSD', category: 'metals', price: 985.00, change: -4.50, changePercent: -0.45, dayHigh: 992.00, dayLow: 982.00, week52High: 1120.00, week52Low: 880.00, unit: 'oz', inrPrice: 30880, icon: '💎', color: '#00BCD4', trend: 'Platinum supply deficit narrowing.', volatility: 15.2, stat: 'Supply deficit of 340K oz projected' },
  { id: 'palladium', name: 'Palladium', symbol: 'XPDUSD', category: 'metals', price: 965.00, change: 8.50, changePercent: 0.89, dayHigh: 972.00, dayLow: 956.00, week52High: 1150.00, week52Low: 850.00, unit: 'oz', inrPrice: 30250, icon: '🔘', color: '#6C63FF', trend: 'Palladium recovering from EV transition fears.', volatility: 22.3, stat: 'Auto sector consumes 80% of supply' },
  { id: 'crude', name: 'Crude Oil (WTI)', symbol: 'CL', category: 'energy', price: 78.50, change: -1.20, changePercent: -1.51, dayHigh: 80.10, dayLow: 78.20, week52High: 95.00, week52Low: 68.00, unit: 'barrel', inrPrice: 6560, icon: '🛢️', color: '#FF5252', trend: 'OPEC+ supply increase concerns.', volatility: 28.5, stat: 'OPEC+ quota: 40.5M bpd' },
  { id: 'naturalgas', name: 'Natural Gas', symbol: 'NG', category: 'energy', price: 2.85, change: 0.08, changePercent: 2.89, dayHigh: 2.92, dayLow: 2.76, week52High: 3.60, week52Low: 1.80, unit: 'MMBtu', inrPrice: 238, icon: '🔥', color: '#FF9800', trend: 'Gas prices rising on LNG export demand.', volatility: 35.8, stat: 'LNG exports up 12% YoY' },
  { id: 'gasoline', name: 'Gasoline (RBOB)', symbol: 'XB', category: 'energy', price: 2.45, change: -0.04, changePercent: -1.61, dayHigh: 2.50, dayLow: 2.42, week52High: 3.10, week52Low: 2.10, unit: 'gallon', inrPrice: 205, icon: '⛽', color: '#FF6B00', trend: 'Summer driving season demand offset.', volatility: 32.1, stat: 'US gasoline demand: 9.2M bpd' },
  { id: 'copper', name: 'Copper', symbol: 'HG', category: 'metals', price: 4.52, change: 0.06, changePercent: 1.35, dayHigh: 4.56, dayLow: 4.45, week52High: 5.20, week52Low: 3.65, unit: 'lb', inrPrice: 378, icon: '🪙', color: '#FF6B35', trend: 'Copper benefiting from electrification demand.', volatility: 20.4, stat: 'Global demand growth: 3.5% CAGR' },
  { id: 'aluminum', name: 'Aluminum', symbol: 'ALI', category: 'metals', price: 2560.00, change: 18.00, changePercent: 0.71, dayHigh: 2580.00, dayLow: 2540.00, week52High: 2850.00, week52Low: 2200.00, unit: 'tonne', inrPrice: 80220, icon: '🪶', color: '#00E5FF', trend: 'Aluminum supported by green energy transition.', volatility: 16.7, stat: 'China output capped at 45M tonnes' },
  { id: 'zinc', name: 'Zinc', symbol: 'ZNC', category: 'metals', price: 2850.00, change: -22.00, changePercent: -0.77, dayHigh: 2880.00, dayLow: 2840.00, week52High: 3200.00, week52Low: 2400.00, unit: 'tonne', inrPrice: 89320, icon: '⚡', color: '#8BC34A', trend: 'Zinc supply tightness from mine closures.', volatility: 19.3, stat: 'Global refined output: 13.8M tonnes' },
  { id: 'corn', name: 'Corn', symbol: 'ZC', category: 'agriculture', price: 445.00, change: 5.50, changePercent: 1.25, dayHigh: 448.00, dayLow: 439.50, week52High: 520.00, week52Low: 400.00, unit: 'bushel', inrPrice: 0, icon: '🌽', color: '#FFC107', trend: 'Corn supported by strong ethanol demand.', volatility: 25.6, stat: 'US corn stocks: 1.8B bushels' },
  { id: 'wheat', name: 'Wheat', symbol: 'ZW', category: 'agriculture', price: 585.00, change: -8.00, changePercent: -1.35, dayHigh: 595.00, dayLow: 582.00, week52High: 720.00, week52Low: 530.00, unit: 'bushel', inrPrice: 0, icon: '🌾', color: '#FFA726', trend: 'Wheat under pressure from ample global supply.', volatility: 30.2, stat: 'Global wheat stocks: 260M tonnes' },
  { id: 'soybeans', name: 'Soybeans', symbol: 'ZS', category: 'agriculture', price: 1185.00, change: 12.50, changePercent: 1.07, dayHigh: 1192.00, dayLow: 1172.00, week52High: 1350.00, week52Low: 1050.00, unit: 'bushel', inrPrice: 0, icon: '🫘', color: '#8BC34A', trend: 'Soybeans supported by strong crush margins.', volatility: 22.8, stat: 'Brazil soy production: 155M tonnes' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────

function mapApiToCommodity(apiItem: CommodityApiItem): CommodityAsset {
  return {
    id: apiItem.id,
    name: apiItem.name,
    symbol: apiItem.symbol,
    category: apiItem.category,
    price: apiItem.price,
    change: apiItem.change,
    changePercent: apiItem.changePercent,
    dayHigh: apiItem.dayHigh,
    dayLow: apiItem.dayLow,
    week52High: apiItem.week52High,
    week52Low: apiItem.week52Low,
    unit: apiItem.unit,
    inrPrice: apiItem.inrPrice,
    icon: apiItem.icon,
    color: apiItem.color,
    trend: apiItem.trend,
    volatility: apiItem.volatility,
    stat: apiItem.stat,
  };
}

// ─── API Client ──────────────────────────────────────────────────────────

export const commoditiesApi = {
  /** Get all commodities with fallback to static mock data */
  getAll: (): Promise<CommodityAsset[]> =>
    api.withFallback(
      () => api.get<CommodityApiResponse>('/commodities')
        .then(res => res.commodities.map(mapApiToCommodity)),
      FALLBACK_COMMODITIES,
    ),

  /** Get commodities by category */
  getByCategory: (cat: string): Promise<CommodityAsset[]> =>
    api.withFallback(
      () => api.get<{ success: boolean; commodities: CommodityApiItem[] }>(`/commodities/category/${cat}`)
        .then(res => res.commodities.map(mapApiToCommodity)),
      FALLBACK_COMMODITIES.filter(c => c.category === cat),
    ),

  /** Get a single commodity by ID */
  getById: (id: string): Promise<CommodityAsset | null> =>
    api.withFallback(
      () => api.get<{ success: boolean; commodity: CommodityApiItem }>(`/commodities/${id}`)
        .then(res => res.commodity ? mapApiToCommodity(res.commodity) : null),
      FALLBACK_COMMODITIES.find(c => c.id === id) ?? null,
    ),

  /** Get the static fallback data */
  getFallbackData: () => [...FALLBACK_COMMODITIES],
};
