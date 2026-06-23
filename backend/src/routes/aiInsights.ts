import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { mockAIInsights } from '../data/mockData';
import {
  generateInsight,
  generateBatchInsight,
  generateInsights,
  isAIConfigured,
  getActiveProviderName,
} from '../services/ai';
import type { AIInsight } from '../services/ai';
import { insightCache } from '../services/insightCache';
import { get as cacheGet, set as cacheSet, del as cacheDel, CacheKeys } from '../middleware/cacheService';

const router = Router();
router.use(authMiddleware);

// GET /api/ai/insights
router.get('/insights', (req: Request, res: Response) => {
  const { stockId } = req.query;

  if (stockId && isAIConfigured()) {
    const cached = insightCache.get(stockId as string);
    if (cached) {
      // If stale, trigger background refresh (deduplicated via cache's inflight map)
      if (cached.stale) {
        insightCache.getOrRefresh(stockId as string, () => generateInsight(stockId as string));
      }
      res.json([cached.data]);
      return;
    }
  }

  // Fall back to mock data
  let insights = mockAIInsights;
  if (stockId) {
    insights = insights.filter(i => i.stockId === stockId);
  }
  res.json(insights);
});

// GET /api/ai/insights/:id
router.get('/insights/:id', (req: Request, res: Response) => {
  // Fall back to mock data (cache is keyed by symbol, not by insight ID)
  // Real AI insights are retrieved via POST /analyze and POST /analyze/batch
  // which return the data directly without needing ID-based lookup.
  const insight = mockAIInsights.find(i => i.id === req.params.id);
  if (!insight) {
    res.status(404).json({ error: 'Insight not found' });
    return;
  }
  res.json(insight);
});

/**
 * Multi-layered cache for AI insights:
 *   L1 — In-memory insightCache (fastest, stale-while-revalidate)
 *   L2 — Redis cacheService (persistent across restarts & pods)
 *   L3 — AI API (slowest, only if both caches miss)
 *
 * Redis keys use CacheKeys.aiCognitiveSummary(symbol) from cacheService.
 * TTL: 600s (10 minutes) — defined in cacheService KEY_TTL.
 */

/**
 * Fetch an insight with L1 → L2 → L3 fallback.
 * Sets both caches on miss so subsequent requests hit L1.
 */
async function fetchWithRedisCache(symbol: string): Promise<AIInsight> {
  // L1: In-memory cache (microsecond, always first)
  const l1Hit = insightCache.get(symbol);
  if (l1Hit) {
    if (l1Hit.stale) {
      // Stale — return immediately but refresh L2 asynchronously
      insightCache.getOrRefresh(symbol, () => generateInsight(symbol));
    }
    return l1Hit.data;
  }

  // L2: Redis cache (millisecond, across restarts/pods)
  const l2Key = CacheKeys.aiCognitiveSummary(symbol);
  const l2Raw = await cacheGet(l2Key);
  if (l2Raw) {
    try {
      const parsed = JSON.parse(l2Raw) as AIInsight;
      // Seed L1 so subsequent requests don't hit Redis
      insightCache.set(symbol, parsed);
      return parsed;
    } catch {
      // Corrupted Redis entry — fall through to L3
      await cacheDel(l2Key);
    }
  }

  // L3: AI API (seconds, expensive)
  const insight = await insightCache.getOrRefresh(symbol, () => generateInsight(symbol));

  // Seed L2 asynchronously (don't block response on Redis write)
  cacheSet(l2Key, JSON.stringify(insight)).catch(() => {});

  return insight;
}

// POST /api/ai/analyze
router.post('/analyze', async (req: Request, res: Response) => {
  const { symbol } = req.body;

  if (!symbol) {
    res.status(400).json({ error: 'Symbol is required' });
    return;
  }

  if (!isAIConfigured()) {
    // AI not configured — return simulated insight
    await new Promise(r => setTimeout(r, 2000));
    const fallback = {
      id: `ai_${Date.now()}`,
      stockId: symbol,
      symbol,
      name: symbol,
      type: ['bullish', 'bearish', 'neutral'][Math.floor(Math.random() * 3)] as 'bullish' | 'bearish' | 'neutral',
      confidence: Math.floor(Math.random() * 30) + 60,
      summary: 'AI-generated analysis based on technical indicators',
      analysis: `Analysis for ${symbol}: The stock is showing ${['strong momentum', 'weak signals', 'mixed patterns'][Math.floor(Math.random() * 3)]} based on our multi-factor model. Key levels to watch are support and resistance.`,
      targets: [
        { target: 0, probability: 60 },
        { target: 0, probability: 35 },
        { target: 0, probability: 15 },
      ],
      timestamp: new Date().toISOString(),
    };
    res.json(fallback);
    return;
  }

  try {
    const insight = await fetchWithRedisCache(symbol);
    insight._provider = getActiveProviderName();
    res.json(insight);
  } catch (error: any) {
    console.error('[AI Route] Analysis failed:', error.message);
    res.status(503).json({
      error: 'AI analysis temporarily unavailable. Please try again later.',
      details: error.message,
    });
  }
});

// POST /api/ai/analyze/batch
router.post('/analyze/batch', async (req: Request, res: Response) => {
  const { symbols } = req.body;

  if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
    res.status(400).json({
      error: 'symbols is required and must be a non-empty array (e.g., ["RELIANCE", "TCS", "INFY"])',
    });
    return;
  }

  if (symbols.length > 20) {
    res.status(400).json({ error: 'Maximum 20 symbols allowed per batch request' });
    return;
  }

  if (!isAIConfigured()) {
    // AI not configured — return simulated insights for each symbol
    const fallbacks = symbols.map((symbol: string) => ({
      id: `ai_${Date.now()}_${symbol}`,
      stockId: symbol,
      symbol,
      name: symbol,
      type: ['bullish', 'bearish', 'neutral'][Math.floor(Math.random() * 3)] as 'bullish' | 'bearish' | 'neutral',
      confidence: Math.floor(Math.random() * 30) + 60,
      summary: 'AI-generated analysis based on technical indicators',
      analysis: `Analysis for ${symbol}: The stock is showing ${['strong momentum', 'weak signals', 'mixed patterns'][Math.floor(Math.random() * 3)]} based on our multi-factor model.`,
      targets: [
        { target: 0, probability: 60 },
        { target: 0, probability: 35 },
        { target: 0, probability: 15 },
      ],
      timestamp: new Date().toISOString(),
    }));
    res.json(fallbacks);
    return;
  }

  try {
    // Phase 1: Check L1 (in-memory) + L2 (Redis) in parallel
    const l1Hits = new Map<string, AIInsight>();
    const l2Misses: string[] = [];

    for (const sym of symbols) {
      const l1 = insightCache.get(sym);
      if (l1) {
        l1Hits.set(sym, l1.data);
        if (l1.stale) {
          insightCache.getOrRefresh(sym, () => generateInsight(sym));
        }
      } else {
        l2Misses.push(sym);
      }
    }

    // Phase 2: Check Redis for L1 misses
    const l2Promises = l2Misses.map(async (sym) => {
      const l2Key = CacheKeys.aiCognitiveSummary(sym);
      const raw = await cacheGet(l2Key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as AIInsight;
          insightCache.set(sym, parsed); // Seed L1
          l1Hits.set(sym, parsed);
          return; // Redis hit
        } catch {
          await cacheDel(l2Key);
        }
      }
      l1Hits.set(sym, null as any); // marker for L3 fetch needed
    });
    await Promise.all(l2Promises);

    // Phase 3: Identify symbols that need L3 (AI API)
    const uncached = symbols.filter(sym => {
      const hit = l1Hits.get(sym);
      return hit === null; // null marker from L2 miss
    });

    // Phase 4: Fetch uncached — batch if 3+, parallel if fewer
    let fresh: AIInsight[] = [];
    if (uncached.length >= 3) {
      fresh = await generateBatchInsight(uncached);
    } else if (uncached.length > 0) {
      fresh = await generateInsights(uncached);
    }

    // Phase 5: Seed both L1 and L2
    for (const insight of fresh) {
      if (insight.symbol) {
        insightCache.set(insight.symbol, insight);
        const l2Key = CacheKeys.aiCognitiveSummary(insight.symbol);
        cacheSet(l2Key, JSON.stringify(insight)).catch(() => {});
      }
    }

    // Build final result preserving original order
    const result = symbols
      .map(sym => {
        const cached = l1Hits.get(sym);
        if (cached && cached !== null) return cached;
        return fresh.find(i => i.symbol === sym);
      })
      .filter(Boolean) as AIInsight[];

    res.json(result);
  } catch (error: any) {
    console.error('[AI Route] Batch analysis failed:', error.message);
    res.status(503).json({
      error: 'Batch AI analysis temporarily unavailable. Please try again later.',
      details: error.message,
    });
  }
});

export default router;
