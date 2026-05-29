import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { mockMutualFunds, mockSIPs } from '../data/mockData';

const router = Router();
router.use(authMiddleware);

// GET /api/mutual-funds
router.get('/', (_req: Request, res: Response) => {
  res.json(mockMutualFunds);
});

// Specific routes MUST be defined before /:id to avoid Express matching them as :id
// GET /api/mutual-funds/sips
router.get('/sips/list', (_req: Request, res: Response) => {
  res.json(mockSIPs);
});

// POST /api/mutual-funds/sips
router.post('/sips', (req: Request, res: Response) => {
  const { fundId, amount, frequency } = req.body;
  if (!fundId || !amount || !frequency) {
    res.status(400).json({ error: 'fundId, amount, and frequency are required' });
    return;
  }

  const fund = mockMutualFunds.find(f => f.id === fundId);
  if (!fund) {
    res.status(404).json({ error: 'Mutual fund not found' });
    return;
  }

  const newSip = {
    id: `sip_${Date.now()}`,
    fundId,
    fundName: fund.name,
    amount,
    frequency,
    nextDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    totalInvested: 0,
    currentValue: 0,
    returns: 0,
  };

  res.status(201).json(newSip);
});

// GET /api/mutual-funds/:id (catch-all - defined AFTER specific routes)
router.get('/:id', (req: Request, res: Response) => {
  const fund = mockMutualFunds.find(f => f.id === req.params.id);
  if (!fund) {
    res.status(404).json({ error: 'Mutual fund not found' });
    return;
  }
  res.json(fund);
});

export default router;
