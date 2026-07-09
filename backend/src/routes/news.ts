/**
 * ============================================================================
 * Toroloom — News Routes
 * ============================================================================
 *
 * Provides endpoints for fetching financial news from NewsAPI.org.
 * Falls back gracefully when NewsAPI is not configured.
 *
 * Endpoints:
 *   GET /api/news          — Fetch financial news articles
 *   GET /api/news/top      — Fetch top financial headlines
 *   GET /api/news/symbol/:symbol — Fetch news for a specific stock symbol
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { newsApi, isNewsApiConfigured, configureNewsApi } from '../services/newsApiService';
import { mockNews } from '../data/mockNews';

const router = Router();

// Re-configure from env when this module loads
configureNewsApi({ newsApiKey: process.env.NEWSAPI_KEY });

// ─── GET /api/news — Fetch financial news ──────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string | undefined;
    const category = req.query.category as string | undefined;
    const pageSize = parseInt(req.query.pageSize as string || '20', 10);
    const page = parseInt(req.query.page as string || '1', 10);
    const sortBy = (req.query.sortBy as string) || 'publishedAt';

    // Validate category
    const validCategories = ['markets', 'economy', 'corporate', 'ipo', 'global', 'policy'];
    const activeCategory = category && validCategories.includes(category)
      ? category as 'markets' | 'economy' | 'corporate' | 'ipo' | 'global' | 'policy'
      : undefined;

    if (!isNewsApiConfigured()) {
      // Return mock news when API key is not configured
      const filtered = activeCategory
        ? mockNews.filter(a => a.category === activeCategory)
        : mockNews;

      // Sort by publishedAt descending
      const sorted = [...filtered].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );

      // Paginate
      const start = (page - 1) * pageSize;
      const paginated = sorted.slice(start, start + pageSize);

      res.json({
        articles: paginated,
        totalResults: sorted.length,
        source: 'mock',
      });
      return;
    }

    // Fetch from NewsAPI
    const result = await newsApi.getFinancialNews({
      q,
      category: activeCategory,
      pageSize: Math.min(pageSize, 100),
      page,
      sortBy,
    });

    // Map to our format
    const articles = result.articles.map(a => {
      return newsApi.toMarketNewsItem(a, activeCategory || 'markets');
    });

    res.json({
      articles,
      totalResults: result.totalResults,
      source: 'newsapi',
    });
  } catch (error: unknown) {
    // Fallback to mock data on error
    const fallbackArticles = mockNews.slice(0, 10).map(a => ({
      ...a,
      read: false,
      bookmarked: false,
    }));
    res.json({
      articles: fallbackArticles,
      totalResults: fallbackArticles.length,
      source: 'mock_fallback',
    });
  }
});

// ─── GET /api/news/top — Top headlines ────────────────────────────────

router.get('/top', async (_req: Request, res: Response) => {
  try {
    if (!isNewsApiConfigured()) {
      const top = [...mockNews]
        .filter(a => !a.read)
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 5);
      res.json({ articles: top, source: 'mock' });
      return;
    }

    const topArticles = await newsApi.getTopHeadlines(10);
    const articles = topArticles.map(a => newsApi.toMarketNewsItem(a, 'markets'));

    res.json({ articles, source: 'newsapi' });
  } catch {
    const fallback = mockNews.slice(0, 5).map(a => ({ ...a, read: false, bookmarked: false }));
    res.json({ articles: fallback, source: 'mock_fallback' });
  }
});

// ─── GET /api/news/symbol/:symbol — News for a stock symbol ──────────

router.get('/symbol/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;

    if (!isNewsApiConfigured()) {
      const symbolNews = mockNews.filter(a =>
        a.symbol?.toLowerCase() === symbol.toLowerCase(),
      );
      res.json({
        articles: symbolNews,
        totalResults: symbolNews.length,
        source: 'mock',
      });
      return;
    }

    const articles = await newsApi.getNewsForSymbol(symbol);
    const mapped = articles.map(a => newsApi.toMarketNewsItem(a, 'markets'));

    res.json({ articles: mapped, totalResults: mapped.length, source: 'newsapi' });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch news for symbol' });
  }
});

export default router;
