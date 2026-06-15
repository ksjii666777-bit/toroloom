import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { mockAIInsights } from '../data/mockData';
import {
  generateInsight,
  generateBatchInsight,
  generateInsights,
  isAIConfigured,
} from '../services/ai';
import type { AIInsight } from '../services/ai';
import { insightCache } from '../services/insightCache';

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
    // getOrRefresh handles: cache hit → return, stale → return + bg refresh, miss → fetch
    const insight = await insightCache.getOrRefresh(symbol, () => generateInsight(symbol));
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
    // Phase 1: Collect cached results and identify uncached symbols
    const cached: AIInsight[] = [];
    const uncached: string[] = [];

    for (const sym of symbols) {
      const hit = insightCache.get(sym);
      if (hit) {
        cached.push(hit.data);
        // Stale → trigger background refresh (deduplicated via cache's inflight map)
        if (hit.stale) {
          insightCache.getOrRefresh(sym, () => generateInsight(sym));
        }
      } else {
        uncached.push(sym);
      }
    }

    // Phase 2: Fetch uncached symbols — batch if 3+, parallel if fewer
    let fresh: AIInsight[] = [];
    if (uncached.length >= 3) {
      fresh = await generateBatchInsight(uncached);
    } else if (uncached.length > 0) {
      fresh = await generateInsights(uncached);
    }

    // Phase 3: Cache fresh results
    for (const insight of fresh) {
      if (insight.symbol) {
        insightCache.set(insight.symbol, insight);
      }
    }

    res.json([...cached, ...fresh]);
  } catch (error: any) {
    console.error('[AI Route] Batch analysis failed:', error.message);
    res.status(503).json({
      error: 'Batch AI analysis temporarily unavailable. Please try again later.',
      details: error.message,
    });
  }
});

export default router;
