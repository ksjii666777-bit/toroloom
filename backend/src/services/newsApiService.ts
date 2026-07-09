/**
 * ============================================================================
 * NewsAPI Service
 * ============================================================================
 *
 * Fetches financial news articles from NewsAPI.org.
 * Provides: financial news, market news, company-specific news.
 *
 * API Docs: https://newsapi.org/docs
 * Free tier: 500 requests/day, 100 results per request
 *
 * Usage:
 *   import { newsApi } from '../services/newsApiService';
 *   const articles = await newsApi.getFinancialNews({ q: 'NSE' });
 *
 * ============================================================================
 */

import https from 'https';

const BASE_URL = 'https://newsapi.org/v2';
const TIMEOUT_MS = 10_000;

interface NewsApiConfig {
  apiKey: string;
}

let config: NewsApiConfig = {
  apiKey: process.env.NEWSAPI_KEY || '',
};

/**
 * Update the NewsAPI configuration (called on startup from env).
 */
export function configureNewsApi(envConfig: { newsApiKey?: string }): void {
  if (envConfig.newsApiKey) {
    config.apiKey = envConfig.newsApiKey;
  }
}

/**
 * Check if NewsAPI is configured with an API key.
 */
export function isNewsApiConfigured(): boolean {
  return config.apiKey.length > 0;
}

// ─── Internal fetch helper ─────────────────────────────────────────────

function fetchFromNewsApi<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!config.apiKey) {
    return Promise.reject(new Error('NewsAPI key not configured. Set NEWSAPI_KEY env var.'));
  }

  const queryParams = new URLSearchParams({ apiKey: config.apiKey, ...params });
  const url = `${BASE_URL}${path}?${queryParams.toString()}`;

  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.status === 'error') {
            reject(new Error(`NewsAPI error: ${parsed.message || parsed.code || 'Unknown error'}`));
          } else {
            resolve(parsed as T);
          }
        } catch (e) {
          reject(new Error(`Failed to parse NewsAPI response: ${(e as Error).message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('NewsAPI request timed out')); });
  });
}

// ─── Response Types ────────────────────────────────────────────────────

interface NewsApiArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
}

/**
 * Market news categories mapped from NewsAPI keywords.
 */
export type NewsCategory = 'markets' | 'economy' | 'corporate' | 'ipo' | 'global' | 'policy';

interface NewsQueryParams {
  /** Search query (e.g., 'NSE', 'Reliance', 'Indian stock market') */
  q?: string;
  /** Category to filter by */
  category?: NewsCategory;
  /** Number of results (max 100) */
  pageSize?: number;
  /** Page number */
  page?: number;
  /** Sort by: 'relevancy', 'popularity', 'publishedAt' */
  sortBy?: string;
  /** Language (default: 'en') */
  language?: string;
  /** Date from (ISO format: YYYY-MM-DD) */
  from?: string;
  /** Date to (ISO format: YYYY-MM-DD) */
  to?: string;
}

/**
 * Map our internal category to NewsAPI search keywords.
 */
function categoryToKeywords(category: NewsCategory): string {
  switch (category) {
    case 'markets': return 'stock market OR NSE OR BSE OR Sensex OR Nifty';
    case 'economy': return 'Indian economy OR GDP OR inflation OR RBI';
    case 'corporate': return 'corporate OR company earnings OR quarterly results OR IPO';
    case 'ipo': return 'IPO OR initial public offering OR listing OR grey market';
    case 'global': return 'global markets OR Federal Reserve OR oil prices OR trade war';
    case 'policy': return 'SEBI OR government policy OR budget OR regulation OR tax';
    default: return 'finance OR investing OR stock market';
  }
}

/**
 * Get the difference in days between two dates.
 */
function daysBetween(d1: Date, d2: Date): number {
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// ─── Public API ────────────────────────────────────────────────────────

export const newsApi = {
  /**
   * Fetch financial news articles.
   * Uses NewsAPI's 'everything' endpoint for comprehensive financial news.
   */
  async getFinancialNews(params: NewsQueryParams = {}): Promise<{
    articles: NewsApiArticle[];
    totalResults: number;
  }> {
    const queryParams: Record<string, string> = {
      language: params.language || 'en',
      sortBy: params.sortBy || 'publishedAt',
      pageSize: Math.min(params.pageSize || 20, 100).toString(),
      page: (params.page || 1).toString(),
    };

    // Build search query
    let query = params.q || 'Indian stock market OR finance OR investing';
    if (params.category && !params.q) {
      query = categoryToKeywords(params.category);
    }
    queryParams.q = query;

    // Date range (default: last 7 days)
    const to = params.to || new Date().toISOString().split('T')[0];
    const from = params.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    queryParams.from = from;
    queryParams.to = to;

    try {
      const response = await fetchFromNewsApi<NewsApiResponse>('/everything', queryParams);
      return {
        articles: response.articles || [],
        totalResults: response.totalResults || 0,
      };
    } catch {
      // Fallback: try top-headlines with business category
      try {
        const fallbackResponse = await fetchFromNewsApi<NewsApiResponse>('/top-headlines', {
          category: 'business',
          language: params.language || 'en',
          country: 'in',
          pageSize: Math.min(params.pageSize || 20, 100).toString(),
        });
        return {
          articles: fallbackResponse.articles || [],
          totalResults: fallbackResponse.totalResults || 0,
        };
      } catch {
        return { articles: [], totalResults: 0 };
      }
    }
  },

  /**
   * Fetch news for a specific stock symbol.
   */
  async getNewsForSymbol(symbol: string, pageSize = 10): Promise<NewsApiArticle[]> {
    const result = await this.getFinancialNews({
      q: symbol,
      pageSize,
    });
    return result.articles;
  },

  /**
   * Fetch top financial headlines.
   */
  async getTopHeadlines(pageSize = 20): Promise<NewsApiArticle[]> {
    try {
      const response = await fetchFromNewsApi<NewsApiResponse>('/top-headlines', {
        category: 'business',
        language: 'en',
        country: 'in',
        pageSize: pageSize.toString(),
      });
      return response.articles || [];
    } catch {
      return [];
    }
  },

  /**
   * Map a NewsAPI article to our internal MarketNewsItem format.
   */
  toMarketNewsItem(article: NewsApiArticle, category: NewsCategory = 'markets'): {
    id: string;
    title: string;
    summary: string;
    content: string;
    source: string;
    category: NewsCategory;
    sentiment: 'positive' | 'negative' | 'neutral';
    imageUrl: string | null;
    publishedAt: string;
    read: boolean;
    bookmarked: boolean;
  } {
    // Simple sentiment heuristic based on keywords
    const text = `${article.title} ${article.description || ''}`.toLowerCase();
    const positiveWords = ['surge', 'rally', 'gain', 'profit', 'growth', 'bullish', 'up', 'positive', 'record', 'beat', 'strong'];
    const negativeWords = ['fall', 'drop', 'loss', 'decline', 'bearish', 'down', 'negative', 'crash', 'slowdown', 'fear', 'risk'];

    let sentimentScore = 0;
    for (const word of positiveWords) {
      if (text.includes(word)) sentimentScore++;
    }
    for (const word of negativeWords) {
      if (text.includes(word)) sentimentScore--;
    }

    const sentiment: 'positive' | 'negative' | 'neutral' =
      sentimentScore > 0 ? 'positive' :
      sentimentScore < 0 ? 'negative' : 'neutral';

    return {
      id: `news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: article.title || 'Untitled',
      summary: article.description || '',
      content: article.content || article.description || '',
      source: article.source?.name || 'News Source',
      category,
      sentiment,
      imageUrl: article.urlToImage || null,
      publishedAt: article.publishedAt || new Date().toISOString(),
      read: false,
      bookmarked: false,
    };
  },

  /**
   * Get sentiment score for a text (-1 to 1).
   */
  getSentimentScore(text: string): number {
    const positiveWords = ['surge', 'rally', 'gain', 'profit', 'growth', 'bullish', 'up', 'positive', 'record', 'beat', 'strong', 'boom', 'recovery', 'uptick'];
    const negativeWords = ['fall', 'drop', 'loss', 'decline', 'bearish', 'down', 'negative', 'crash', 'slowdown', 'fear', 'risk', 'slump', 'recession', 'debt'];

    const lower = text.toLowerCase();
    let score = 0;
    for (const word of positiveWords) {
      if (lower.includes(word)) score += 0.15;
    }
    for (const word of negativeWords) {
      if (lower.includes(word)) score -= 0.15;
    }
    return Math.max(-1, Math.min(1, score));
  },
};
