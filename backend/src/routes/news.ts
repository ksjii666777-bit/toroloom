/**
 * ============================================================================
 * Toroloom — News Routes
 * ============================================================================
 *
 * Serves financial news via the multi-provider aggregator
 * (`newsAggregatorService`). Providers are tried in order:
 *
 *     GNews → NewsData.io → Google News RSS (no key) → NewsAPI.org
 *
 * The response's `source` field reports the provider that ACTUALLY served
 * the articles ('none' when every provider failed — the app then shows its
 * own offline content instead of us fabricating data).
 *
 * Endpoints:
 *   GET /api/news                — Fetch financial news articles
 *   GET /api/news/top            — Fetch top financial headlines
 *   GET /api/news/symbol/:symbol — Fetch news for a specific stock symbol
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import {
  aggregateFinancialNews,
  aggregateSymbolNews,
  getPreferredProvider,
  type NewsCategory,
} from '../services/newsAggregatorService';

const router = Router();

const VALID_CATEGORIES = ['markets', 'economy', 'corporate', 'ipo', 'global', 'policy'];

function parseCategory(raw: unknown): NewsCategory | undefined {
  if (typeof raw === 'string' && VALID_CATEGORIES.includes(raw)) {
    return raw as NewsCategory;
  }
  return undefined;
}

// ─── GET /api/news — Fetch financial news ──────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const category = parseCategory(req.query.category);
    const pageSize = Math.min(parseInt(String(req.query.pageSize || '20'), 10) || 20, 100);
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);

    const result = await aggregateFinancialNews({ q, category, pageSize, page });

    const articles = result.articles.map((a) => ({
      id: `news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: a.title,
      summary: a.summary,
      content: a.content,
      source: a.source,
      category: category || 'markets',
      sentiment: scoreSentiment(`${a.title} ${a.summary}`),
      imageUrl: a.imageUrl,
      url: a.url,
      publishedAt: a.publishedAt,
      read: false,
      bookmarked: false,
    }));

    res.json({
      articles,
      totalResults: result.totalResults,
      source: result.provider,
      preferredProvider: getPreferredProvider(),
    });
  } catch (error: unknown) {
    // Aggregator never throws in practice; keep a hard guard anyway.
    console.error('[News] /news handler error:', (error as Error).message);
    res.json({ articles: [], totalResults: 0, source: 'none' });
  }
});

// ─── GET /api/news/top — Top headlines ────────────────────────────────

router.get('/top', async (_req: Request, res: Response) => {
  try {
    const result = await aggregateFinancialNews({ pageSize: 10 });

    const articles = result.articles.slice(0, 5).map((a) => ({
      id: `news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: a.title,
      summary: a.summary,
      content: a.content,
      source: a.source,
      category: 'markets',
      sentiment: scoreSentiment(`${a.title} ${a.summary}`),
      imageUrl: a.imageUrl,
      url: a.url,
      publishedAt: a.publishedAt,
      read: false,
      bookmarked: false,
    }));

    res.json({
      articles,
      totalResults: articles.length,
      source: result.provider,
      preferredProvider: getPreferredProvider(),
    });
  } catch (error: unknown) {
    console.error('[News] /news/top handler error:', (error as Error).message);
    res.json({ articles: [], totalResults: 0, source: 'none' });
  }
});

// ─── GET /api/news/symbol/:symbol — News for a stock symbol ──────────

router.get('/symbol/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = String(req.params.symbol || '').trim().toUpperCase();
    if (!symbol) {
      res.status(400).json({ error: 'symbol path parameter is required' });
      return;
    }

    const result = await aggregateSymbolNews(symbol, 10);

    const articles = result.articles.map((a) => ({
      id: `news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: a.title,
      summary: a.summary,
      content: a.content,
      source: a.source,
      category: 'markets',
      symbol,
      sentiment: scoreSentiment(`${a.title} ${a.summary}`),
      imageUrl: a.imageUrl,
      url: a.url,
      publishedAt: a.publishedAt,
      read: false,
      bookmarked: false,
    }));

    res.json({
      articles,
      totalResults: result.totalResults,
      source: result.provider,
      preferredProvider: getPreferredProvider(),
    });
  } catch (error: unknown) {
    console.error('[News] /news/symbol handler error:', (error as Error).message);
    res.json({ articles: [], totalResults: 0, source: 'none' });
  }
});

export default router;

// ─── Shared sentiment heuristic ───────────────────────────────────────

function scoreSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();
  const positiveWords = ['surge', 'rally', 'gain', 'profit', 'growth', 'bullish', 'record', 'beat', 'strong'];
  const negativeWords = ['fall', 'drop', 'loss', 'decline', 'bearish', 'crash', 'slowdown', 'fear', 'risk'];

  let score = 0;
  for (const w of positiveWords) if (lower.includes(w)) score++;
  for (const w of negativeWords) if (lower.includes(w)) score--;

  return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
}
