/**
 * ============================================================================
 * MarketStack API Service
 * ============================================================================
 *
 * Fetches real-time and historical stock market data from MarketStack.
 * Provides: real-time ticker prices, EOD data, exchange listings, indices.
 *
 * API Docs: https://marketstack.com/documentation
 * Free tier: 1,000 requests/month
 *
 * Usage:
 *   import { marketstack } from '../services/marketstack';
 *   const quotes = await marketstack.getRealTimePrices(['RELIANCE.XNSE', 'TCS.XNSE']);
 *
 * ============================================================================
 */

import https from 'https';
import http from 'http';

const BASE_URL = 'https://api.marketstack.com/v1';
const TIMEOUT_MS = 10_000;

interface MarketStackConfig {
  accessKey: string;
}

let config: MarketStackConfig = {
  accessKey: process.env.MARKETSTACK_KEY || '',
};

/**
 * Update the MarketStack configuration (called on startup from env).
 */
export function configureMarketStack(envConfig: { marketstackKey?: string }): void {
  if (envConfig.marketstackKey) {
    config.accessKey = envConfig.marketstackKey;
  }
}

/**
 * Check if MarketStack is configured with an API key.
 */
export function isMarketStackConfigured(): boolean {
  return config.accessKey.length > 0;
}

// ─── Internal fetch helper ─────────────────────────────────────────────

function fetchFromMarketStack<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!config.accessKey) {
    return Promise.reject(new Error('MarketStack API key not configured. Set MARKETSTACK_KEY env var.'));
  }

  const queryParams = new URLSearchParams({ access_key: config.accessKey, ...params });
  const url = `${BASE_URL}${path}?${queryParams.toString()}`;

  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) {
            reject(new Error(`MarketStack API error: ${parsed.error.message || parsed.error.code || JSON.stringify(parsed.error)}`));
          } else {
            resolve(parsed as T);
          }
        } catch (e) {
          reject(new Error(`Failed to parse MarketStack response: ${(e as Error).message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('MarketStack request timed out')); });
  });
}

// ─── Response Types ────────────────────────────────────────────────────

interface TickerQuote {
  symbol: string;
  name?: string;
  exchange?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  last_price?: number;
  volume: number;
  date: string;
  change?: number;
  change_percent?: number;
}

interface EODData {
  symbol: string;
  exchange: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: string;
  adj_open?: number;
  adj_high?: number;
  adj_low?: number;
  adj_close?: number;
  adj_volume?: number;
}

interface Exchange {
  name: string;
  acronym: string;
  mic: string;
  country: string;
  city: string;
  website: string;
}

interface TickerInfo {
  symbol: string;
  name: string;
  stock_exchange: {
    name: string;
    acronym: string;
    country: string;
  };
}

interface PaginatedResponse<T> {
  pagination: {
    total: number;
    count: number;
    offset: number;
    limit: number;
  };
  data: T[];
}

// ─── Public API ────────────────────────────────────────────────────────

export const marketstack = {
  /**
   * Get real-time ticker quotes for one or more symbols.
   * Symbols should include exchange suffix (e.g., "RELIANCE.XNSE").
   */
  async getRealTimePrices(symbols: string[]): Promise<TickerQuote[]> {
    if (symbols.length === 0) return [];
    const response = await fetchFromMarketStack<PaginatedResponse<TickerQuote>>('/tickers', {
      symbols: symbols.join(','),
      limit: Math.min(symbols.length, 200).toString(),
    });
    return response.data || [];
  },

  /**
   * Get a single ticker quote.
   */
  async getQuote(symbol: string): Promise<TickerQuote | null> {
    try {
      const response = await fetchFromMarketStack<TickerQuote>(`/tickers/${encodeURIComponent(symbol)}/intraday`, {
        limit: '1',
      });
      return response as any;
    } catch {
      // Fall back to EOD
      const eod = await this.getEOD(symbol);
      if (eod) {
        return {
          symbol: eod.symbol,
          open: eod.open,
          high: eod.high,
          low: eod.low,
          close: eod.close,
          volume: eod.volume,
          date: eod.date,
          last_price: eod.close,
        };
      }
      return null;
    }
  },

  /**
   * Get end-of-day data for a symbol.
   */
  async getEOD(symbol: string, dateFrom?: string, dateTo?: string): Promise<EODData | null> {
    const params: Record<string, string> = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    params.limit = '1';

    try {
      const response = await fetchFromMarketStack<PaginatedResponse<EODData>>(
        `/eod/${encodeURIComponent(symbol)}`,
        params,
      );
      return response.data?.[0] || null;
    } catch {
      return null;
    }
  },

  /**
   * Get historical EOD data for a symbol over a date range.
   */
  async getEODHistory(symbol: string, dateFrom: string, dateTo: string, limit = 100): Promise<EODData[]> {
    const response = await fetchFromMarketStack<PaginatedResponse<EODData>>(
      `/eod/${encodeURIComponent(symbol)}`,
      { date_from: dateFrom, date_to: dateTo, limit: limit.toString() },
    );
    return response.data || [];
  },

  /**
   * Search for tickers by symbol or company name.
   */
  async searchTickers(query: string, limit = 50): Promise<TickerInfo[]> {
    if (!query.trim()) return [];
    const response = await fetchFromMarketStack<PaginatedResponse<TickerInfo>>('/tickers', {
      search: query,
      limit: limit.toString(),
    });
    return response.data || [];
  },

  /**
   * Get all exchanges supported by MarketStack.
   */
  async getExchanges(): Promise<Exchange[]> {
    const response = await fetchFromMarketStack<PaginatedResponse<Exchange>>('/exchanges');
    return response.data || [];
  },

  /**
   * Get list of Nifty/BSE indices data.
   * Note: MarketStack doesn't directly serve Indian indices.
   * This maps well-known ETF / index symbols to our format.
   */
  async getIndicesData(): Promise<{ symbol: string; name: string; price: number; change: number; changePercent: number }[]> {
    // MarketStack doesn't have native index data for Nifty/Sensex.
    // Return empty array — the broker mock will serve as fallback.
    return [];
  },

  /**
   * Map a stock symbol to MarketStack-compatible format.
   * Indian stocks on NSE use the .XNSE suffix, BSE uses .XBSE.
   */
  toMarketStackSymbol(symbol: string, exchange: 'NSE' | 'BSE' = 'NSE'): string {
    const suffix = exchange === 'NSE' ? '.XNSE' : '.XBSE';
    // Remove common prefixes that MarketStack might not expect
    const clean = symbol.replace(/[^A-Z0-9]/g, '');
    return clean + suffix;
  },

  /**
   * Convert MarketStack ticker quote to our internal Stock format.
   */
  toStockFormat(quote: TickerQuote, basePrice?: number): {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    isPositive: boolean;
    volume: number;
    open: number;
    high: number;
    low: number;
  } {
    const lastPrice = quote.last_price || quote.close || basePrice || 0;
    const prevClose = basePrice || lastPrice;
    const change = quote.change ?? (lastPrice - prevClose);
    const changePercent = quote.change_percent ?? (prevClose > 0 ? (change / prevClose) * 100 : 0);

    return {
      symbol: quote.symbol.replace(/\.XNSE$|\.XBSE$/i, ''),
      price: lastPrice,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      isPositive: change >= 0,
      volume: quote.volume || 0,
      open: quote.open,
      high: quote.high,
      low: quote.low,
    };
  },
};

export type { TickerQuote, EODData, TickerInfo, Exchange };
