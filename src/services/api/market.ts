import { api } from './client';
import type { MarketIndex, Stock, StockHistoryPoint, CompanyFundamentals } from '../../types';

// The broker interface types – these mirror what the backend returns
export type BrokerStock = Stock;

export const marketApi = {
  getIndices: () => api.get<MarketIndex[]>('/market/indices'),

  getStocks: () => api.get<Stock[]>('/market/stocks'),

  getQuote: (symbol: string) => api.get<Stock>(`/market/quote/${symbol}`),

  getBulkQuotes: (symbols: string[]) =>
    api.get<Stock[]>(`/market/quotes?symbols=${symbols.join(',')}`),

  getOHLC: (symbol: string, interval = 'day', days = 30) =>
    api.get<StockHistoryPoint[]>(`/market/ohlc/${symbol}?interval=${interval}&days=${days}`),

  search: (query: string) => api.get<Stock[]>(`/market/search?q=${encodeURIComponent(query)}`),

  getFundamentals: (symbol: string) =>
    api.get<CompanyFundamentals>(`/market/fundamentals/${symbol}`),
};
