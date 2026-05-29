import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getBroker } from '../services/broker';
import { orderPipeline } from '../services/orderExecution';
import { OrderActionType } from '../services/riskEngine';

const router = Router();

// All portfolio routes require authentication
router.use(authMiddleware);

// GET /api/portfolio/holdings
router.get('/holdings', async (_req: Request, res: Response) => {
  try {
    const broker = await getBroker();
    const holdings = await broker.getHoldings();
    res.json(holdings);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch holdings' });
  }
});

// GET /api/portfolio/positions
router.get('/positions', async (_req: Request, res: Response) => {
  try {
    const broker = await getBroker();
    const positions = await broker.getPositions();
    res.json(positions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch positions' });
  }
});

// GET /api/portfolio/trades
router.get('/trades', async (_req: Request, res: Response) => {
  try {
    const broker = await getBroker();
    const trades = await broker.getTradeHistory();
    res.json(trades);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch trade history' });
  }
});

/**
 * POST /api/portfolio/orders
 *
 * NOW POWERED BY THE ORDER EXECUTION PIPELINE:
 *   RiskEngine  →  Custom Hooks  →  Broker  →  P&L Tracking
 *
 * The raw broker.placeOrder() is no longer called directly.
 * Every order flows through the Financial Bodyguard.
 */
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      exchange,
      transactionType,
      quantity,
      price,
      productType,
      orderType,
      metadata,
    } = req.body;

    if (!symbol || !transactionType || !quantity) {
      res.status(400).json({ error: 'symbol, transactionType, and quantity are required' });
      return;
    }

    // Map the frontend transaction type to our OrderActionType
    const actionType = transactionType === 'BUY'
      ? OrderActionType.BUY
      : transactionType === 'SELL'
        ? OrderActionType.SELL
        : OrderActionType.SQUARE_OFF;

    const userId = req.user!.userId;

    const result = await orderPipeline.execute({
      userId,
      actionType,
      symbol,
      exchange: exchange || 'NSE',
      quantity: parseInt(quantity) || 0,
      price: parseFloat(price) || 0,
      productType: productType || 'CNC',
      orderType: orderType || 'MARKET',
      metadata: metadata || {},
    });

    if (!result.success) {
      // If the Financial Bodyguard blocked it, return 423 Locked
      if (!result.riskEvaluation.allowed) {
        res.status(423).json(result);
        return;
      }
      // If a custom hook blocked it, return 403 Forbidden
      if (result.hookBlocked) {
        res.status(403).json(result);
        return;
      }
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to process order' });
  }
});

export default router;
