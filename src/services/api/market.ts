import { api } from './client';
import type { MarketIndex, Stock, StockHistoryPoint } from '../../types';

// The broker interface types – these mirror what the backend returns
export interface BrokerStock extends Stock {
  // The backend returns the same fields — we reuse the frontend type
}

export const marketApi = {
  getIndices: () => api.get<MarketIndex[]>('/market/indices'),

  getStocks: () => api.get<Stock[]>('/market/stocks'),

  getQuote: (symbol: string) => api.get<Stock>(`/market/quote/${symbol}`),

  getBulkQuotes: (symbols: string[]) =>
    api.get<Stock[]>(`/market/quotes?symbols=${symbols.join(',')}`),

  getOHLC: (symbol: string, interval = 'day', days = 30) =>
    api.get<StockHistoryPoint[]>(`/market/ohlc/${symbol}?interval=${interval}&days=${days}`),

  search: (query: string) => api.get<Stock[]>(`/market/search?q=${encodeURIComponent(query)}`),
};
