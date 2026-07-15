/**
 * ============================================================================
 * Toroloom Risk Routes — Financial Bodyguard API Endpoints
 * ============================================================================
 *
 * These endpoints expose the Risk Engine state to the frontend.
 * The frontend riskStore.ts polls these to maintain synchronized state.
 *
 * Endpoints:
 *   GET    /api/risk/state      — Full risk profile + lockdown state
 *   GET    /api/risk/evaluate   — Evaluate a proposed action against risk rules
 *   PUT    /api/risk/limits     — Update risk limits (blocked if frozen)
 *   POST   /api/risk/reset      — Reset daily MTM (admin/scheduled)
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { riskEngine } from '../services/riskEngine/RiskEngine';
import { OrderActionType, RiskLimits } from '../services/riskEngine/types';
const router = Router();

// All risk routes require authentication
router.use(authMiddleware);

/**
 * GET /api/risk/state
 *
 * Returns the FULL risk profile for the authenticated user.
 * The frontend calls this on app start and periodically to stay in sync.
 */
router.get('/state', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const profile = riskEngine.getState(userId);

    res.json({
      lockdown: profile.lockdown,
      today: profile.today,
      limits: profile.limits,
      settingsFrozen: profile.settingsFrozen,
      settingsFrozenUntil: profile.settingsFrozenUntil,
      portfolioValueAtOpen: profile.portfolioValueAtOpen,
      updatedAt: profile.updatedAt,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch risk state' });
  }
});

/**
 * GET /api/risk/evaluate
 *
 * Evaluate a proposed action against the Financial Bodyguard BEFORE
 * actually placing the order. The frontend can call this to pre-validate
 * a trade button click.
 *
 * Query params:
 *   actionType   — BUY | SELL | SQUARE_OFF | MODIFY | CANCEL
 *   symbol       — Stock symbol (optional)
 *   quantity     — Order quantity (optional)
 *   price        — Order price (optional)
 */
router.get('/evaluate', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { actionType, symbol, quantity, price } = req.query;

    if (!actionType) {
      res.status(400).json({ error: 'actionType query parameter is required' });
      return;
    }

    // Normalise the action type
    const orderActionType = (actionType as string).toUpperCase() as OrderActionType;
    if (!Object.values(OrderActionType).includes(orderActionType)) {
      res.status(400).json({
        error: `Invalid actionType. Must be one of: ${Object.values(OrderActionType).join(', ')}`,
      });
      return;
    }

    const portfolioValue = riskEngine.getState(userId).portfolioValueAtOpen || 1000000;

    const evaluation = riskEngine.evaluate(userId, {
      actionType: orderActionType,
      symbol: symbol as string,
      quantity: quantity ? parseInt(quantity as string) : undefined,
      price: price ? parseFloat(price as string) : undefined,
      portfolioValue,
    });

    res.json(evaluation);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Risk evaluation failed' });
  }
});

/**
 * PUT /api/risk/limits
 *
 * Update risk limits. Will be rejected with a 423 (Locked) status
 * if the settings are frozen by the 24-hour Financial Bodyguard lock.
 */
router.put('/limits', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const newLimits: Partial<RiskLimits> = {};

    // Only allow updating specific fields
    const allowedFields: (keyof RiskLimits)[] = [
      'dailyLossLimit',
      'dailyLossPercentLimit',
      'maxPositionSizePercent',
      'maxLeverage',
      'allowIntraday',
      'allowFNO',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        (newLimits as any)[field] = req.body[field];
      }
    }

    if (Object.keys(newLimits).length === 0) {
      res.status(400).json({
        error: 'No valid limit fields provided',
        validFields: allowedFields,
      });
      return;
    }

    const result = riskEngine.updateLimits(userId, newLimits);

    if (!result.success) {
      res.status(423).json(result); // 423 Locked
      return;
    }

    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to update risk limits' });
  }
});

/**
 * POST /api/risk/reset
 *
 * Reset today's MTM tracking. In production, this would be a scheduled
 * task or restricted to admin users. For now, the authenticated user
 * can reset their own daily tracking.
 */
router.post('/reset', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    riskEngine.resetDaily(userId);

    res.json({
      success: true,
      message: 'Daily risk tracking has been reset.',
    });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to reset risk state' });
  }
});

export default router;
