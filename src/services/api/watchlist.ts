import { api } from './client';
import type { Stock } from '../../types';

export interface WatchlistResponse {
  id: string;
  name: string;
  stocks: Stock[];
  createdAt: string;
}

export const watchlistApi = {
  getAll: () => api.get<WatchlistResponse[]>('/watchlist'),

  create: (name: string) => api.post<WatchlistResponse>('/watchlist', { name }),

  addStock: (watchlistId: string, symbol: string) =>
    api.post<WatchlistResponse>(`/watchlist/${watchlistId}/stocks`, { symbol }),

  removeStock: (watchlistId: string, symbol: string) =>
    api.delete<void>(`/watchlist/${watchlistId}/stocks/${symbol}`),

  delete: (watchlistId: string) =>
    api.delete<void>(`/watchlist/${watchlistId}`),
};
