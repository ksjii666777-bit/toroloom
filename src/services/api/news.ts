import { api } from './client';
import type { MarketNewsItem } from '../../types';

export interface NewsApiResponse {
  articles: MarketNewsItem[];
  totalResults: number;
  source: 'newsapi' | 'mock' | 'mock_fallback';
}

export const newsApi = {
  /**
   * Fetch financial news articles.
   */
  getNews: (params?: {
    category?: string;
    q?: string;
    pageSize?: number;
    page?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.set('category', params.category);
    if (params?.q) queryParams.set('q', params.q);
    if (params?.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params?.page) queryParams.set('page', params.page.toString());
    const query = queryParams.toString();
    return api.get<NewsApiResponse>('/news' + (query ? '?' + query : ''));
  },

  /**
   * Fetch top financial headlines.
   */
  getTopHeadlines: () =>
    api.get<NewsApiResponse>('/news/top'),

  /**
   * Fetch news for a specific stock symbol.
   */
  getNewsForSymbol: (symbol: string) =>
    api.get<NewsApiResponse>('/news/symbol/' + encodeURIComponent(symbol)),
};
