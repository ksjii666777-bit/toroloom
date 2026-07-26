/**
 * Global Markets API client
 * Connects to the backend /api/global-markets endpoints.
 */

import { api } from './client';

// ─── Types ─────────────────────────────────────────────────────────────

export interface USIndexData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
}

export interface USStockData {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
  marketCap: string;
  volume: string;
  pe: number;
  dividend: number;
  exchange: string;
  high52?: number;
  low52?: number;
}

export interface CryptoAssetData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  change1h: number | null;
  change7d: number | null;
  change30d: number | null;
  marketCap: string;
  volume24h: string;
  circulatingSupply?: number;
  totalSupply?: number | null;
  ath?: number;
  athDate?: string;
  icon: string;
  color: string;
}

export interface CryptoDetailData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  price: number;
  change: number;
  changePercent: number;
  change1h: number | null;
  change7d: number | null;
  change30d: number | null;
  change1y: number | null;
  marketCap: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  circulatingSupply: number;
  totalSupply: number | null;
  maxSupply: number | null;
  ath: number;
  athDate: string;
  description: string;
  homepage: string;
  priceHistory: { timestamp: number; price: number }[];
  color: string;
}

export interface USStockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  price: number;
  type: 'stock';
}

// ─── Global Stocks (Europe & Asia-Pacific) Types ────────────────────

export interface GlobalStockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  price: number;
  country: string;
  currency: string;
  region: 'europe' | 'asia';
  type: 'stock';
}

export interface GlobalStockData {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
  marketCap: string;
  volume: string;
  pe: number;
  dividend: number;
  exchange: string;
  country: string;
  currency: string;
  region: 'europe' | 'asia';
  high52?: number;
  low52?: number;
  open?: number;
  high?: number;
  low?: number;
}

export interface GlobalExchangeData {
  exchange: string;
  region: 'europe' | 'asia';
  countries: string[];
  mic: string;
}

export interface GlobalMarketsStatus {
  marketstackConfigured: boolean;
  coinGeckoConfigured: boolean;
}

/**
 * Global index data with region info from backend.
 * Used for both US and International indices.
 */
export interface GlobalIndexData {
  symbol: string;
  name: string;
  region: 'us' | 'europe' | 'asia';
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
}

// ─── API Client ────────────────────────────────────────────────────────

export const globalMarketsApi = {
  /** Check which external APIs are configured */
  getStatus: () => api.get<GlobalMarketsStatus>('/global-markets/status'),

  /** Get all global indices (US + Europe + Asia-Pacific) */
  getIndices: () => api.get<GlobalIndexData[]>('/global-markets/indices'),

  /** Get indices filtered by region ('us', 'europe', 'asia') */
  getIndicesByRegion: (region: 'us' | 'europe' | 'asia') =>
    api.get<GlobalIndexData[]>(`/global-markets/indices/${region}`),

  /** Get top US stocks by sector */
  getStocks: () => api.get<USStockData[]>('/global-markets/stocks'),

  /** Get single US stock quote */
  getQuote: (symbol: string) => api.get<USStockData>(`/global-markets/quote/${symbol}`),

  /** Get bulk US stock quotes */
  getBulkQuotes: (symbols: string[]) =>
    api.get<USStockData[]>(`/global-markets/quotes?symbols=${symbols.join(',')}`),

  /** Get top cryptocurrencies */
  getCrypto: () => api.get<CryptoAssetData[]>('/global-markets/crypto'),

  /** Get single crypto detail + price history */
  getCryptoDetail: (id: string) => api.get<CryptoDetailData>(`/global-markets/crypto/${id}`),

  /** Search US stocks */
  search: (query: string) =>
    api.get<USStockSearchResult[]>(`/global-markets/search?q=${encodeURIComponent(query)}`),

  // ── Global Stocks (EU & Asia-Pacific) ──────────────────────────────

  /** Get top European stocks */
  getEuropeanStocks: () => api.get<GlobalStockData[]>('/global-stocks/europe'),

  /** Get top Asia-Pacific stocks */
  getAsianStocks: () => api.get<GlobalStockData[]>('/global-stocks/asia'),

  /** Get single global stock quote by symbol */
  getGlobalQuote: (symbol: string) =>
    api.get<GlobalStockData>(`/global-stocks/quote/${symbol}`),

  /** Get bulk global stock quotes */
  getGlobalBulkQuotes: (symbols: string[]) =>
    api.get<GlobalStockData[]>(`/global-stocks/quotes?symbols=${symbols.join(',')}`),

  /** Search global stocks by symbol or name */
  searchGlobal: (query: string) =>
    api.get<GlobalStockSearchResult[]>(`/global-stocks/search?q=${encodeURIComponent(query)}`),

  /** List supported global exchanges */
  getGlobalExchanges: () =>
    api.get<{ success: boolean; data: GlobalExchangeData[]; count: number }>('/global-stocks/exchanges'),
};
