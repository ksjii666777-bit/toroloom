import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { mockAIInsights } from '../data/mockData';

const router = Router();
router.use(authMiddleware);

// GET /api/ai/insights
router.get('/insights', (req: Request, res: Response) => {
  const { stockId } = req.query;
  let insights = mockAIInsights;

  if (stockId) {
    insights = insights.filter(i => i.stockId === stockId);
  }

  res.json(insights);
});

// GET /api/ai/insights/:id
router.get('/insights/:id', (req: Request, res: Response) => {
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

  // Simulate AI analysis generation
  await new Promise(r => setTimeout(r, 2000));

  const newInsight = {
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

  res.json(newInsight);
});

export default router;
