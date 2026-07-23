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

export interface GlobalMarketsStatus {
  marketstackConfigured: boolean;
  coinGeckoConfigured: boolean;
}

// ─── API Client ────────────────────────────────────────────────────────

export const globalMarketsApi = {
  /** Check which external APIs are configured */
  getStatus: () => api.get<GlobalMarketsStatus>('/global-markets/status'),

  /** Get US indices (S&P 500, NASDAQ, DJIA, VIX, etc.) */
  getIndices: () => api.get<USIndexData[]>('/global-markets/indices'),

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
};
