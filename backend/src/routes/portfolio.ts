import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getBroker } from '../services/broker';

const router = Router();

// All portfolio routes require authentication
router.use(authMiddleware);

// GET /api/portfolio/holdings
router.get('/holdings', async (_req: Request, res: Response) => {
  try {
    const broker = await getBroker();
    const holdings = await broker.getHoldings();
    res.json(holdings);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch holdings' });
  }
});

// GET /api/portfolio/positions
router.get('/positions', async (_req: Request, res: Response) => {
  try {
    const broker = await getBroker();
    const positions = await broker.getPositions();
    res.json(positions);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch positions' });
  }
});

// GET /api/portfolio/trades
router.get('/trades', async (_req: Request, res: Response) => {
  try {
    const broker = await getBroker();
    const trades = await broker.getTradeHistory();
    res.json(trades);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch trade history' });
  }
});



export default router;
