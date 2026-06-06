/**
 * ============================================================================
 * Toroloom — Push Notification & Portfolio Alert Routes
 * ============================================================================
 *
 * Endpoints:
 *   POST /api/notifications/push-token          — Register Expo push token
 *   POST /api/notifications/portfolio-rules/sync — Sync portfolio alert rules
 *   GET  /api/notifications/portfolio-rules      — Get portfolio alert rules
 *   POST /api/notifications/portfolio-alert/evaluate — Evaluate rules & push
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getBroker } from '../services/broker';
import {
  savePortfolioAlertRule,
  getPortfolioAlertRules,
  deletePortfolioAlertRule,
  updatePortfolioAlertRule,
  evaluatePortfolioAlerts,
  incrementUserBadgeCount,
  resetUserBadgeCount,
  getUserBadgeCount,
} from '../services/portfolioAlerts';
import { sendExpoPushNotification } from '../services/pushNotifications';
import { saveNotification } from '../services/notifications';
import type { NotificationData } from '../services/storage/types';

const router = Router();
router.use(authMiddleware);

// ==================== Push Token Management ====================

// In-memory store of push tokens per user
const pushTokenStore = new Map<string, string>();

/**
 * POST /api/notifications/push-token
 *
 * Registers or updates the user's Expo push token.
 * Body: { pushToken: string }
 */
router.post('/push-token', async (req: Request, res: Response) => {
  const { pushToken } = req.body;
  const userId = req.user!.userId;

  if (!pushToken || typeof pushToken !== 'string') {
    res.status(400).json({ error: 'pushToken is required' });
    return;
  }

  pushTokenStore.set(userId, pushToken);
  console.log(`[PushToken] Registered for user ${userId}`);

  res.json({ success: true, userId });
});

/**
 * GET /api/notifications/push-token
 *
 * Returns whether the current user has a push token registered.
 */
router.get('/push-token', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const token = pushTokenStore.get(userId);

  res.json({
    registered: !!token,
    userId,
  });
});

/**
 * DELETE /api/notifications/push-token
 *
 * Unregisters the current user's push token.
 */
router.delete('/push-token', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  pushTokenStore.delete(userId);
  res.json({ success: true });
});

// ==================== Portfolio Alert Rules CRUD ====================

/**
 * POST /api/notifications/portfolio-rules/sync
 *
 * Syncs all portfolio alert rules from the frontend to the backend.
 * Body: { rules: PortfolioAlertRule[] }
 * The backend replaces all rules for this user with the provided array.
 */
router.post('/portfolio-rules/sync', async (req: Request, res: Response) => {
  const { rules } = req.body;
  const userId = req.user!.userId;

  if (!Array.isArray(rules)) {
    res.status(400).json({ error: 'rules array is required' });
    return;
  }

  try {
    // Delete existing rules for this user
    const existingRules = await getPortfolioAlertRules(userId);
    for (const rule of existingRules) {
      await deletePortfolioAlertRule(rule.id);
    }

    // Save new rules
    for (const rule of rules) {
      await savePortfolioAlertRule({
        ...rule,
        userId,
      });
    }

    console.log(`[PortfolioAlerts] Synced ${rules.length} rules for user ${userId}`);
    res.json({ success: true, count: rules.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to sync rules' });
  }
});

/**
 * GET /api/notifications/portfolio-rules
 *
 * Returns all portfolio alert rules for the current user.
 */
router.get('/portfolio-rules', async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const rules = await getPortfolioAlertRules(userId);
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch rules' });
  }
});

/**
 * PUT /api/notifications/portfolio-rules/:ruleId
 *
 * Updates a specific portfolio alert rule.
 * Body: Partial<PortfolioAlertRule>
 */
router.put('/portfolio-rules/:ruleId', async (req: Request, res: Response) => {
  const { ruleId } = req.params;
  const updates = req.body;

  try {
    await updatePortfolioAlertRule(ruleId as string, updates);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update rule' });
  }
});

/**
 * DELETE /api/notifications/portfolio-rules/:ruleId
 *
 * Deletes a specific portfolio alert rule.
 */
router.delete('/portfolio-rules/:ruleId', async (req: Request, res: Response) => {
  const { ruleId } = req.params;

  try {
    await deletePortfolioAlertRule(ruleId as string);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete rule' });
  }
});

// ==================== Portfolio Alert Evaluation ====================

/**
 * GET /api/notifications/badge-count
 *
 * Returns the current app icon badge count for the user.
 * Used by the frontend on app open to sync the badge after being killed.
 */
router.get('/badge-count', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const badgeCount = await getUserBadgeCount(userId);
  res.json({ badgeCount });
});

/**
 * POST /api/notifications/portfolio-alert/evaluate
 *
 * Evaluates all portfolio alert rules for the current user against the
 * latest portfolio data from the broker and sends Expo push notifications
 * for any breached thresholds.
 *
 * Body (optional): {
 *   portfolioData?: Partial<PortfolioData>,
 *   badgeCount?: number  — current badge count from the client
 * }
 * If badgeCount is provided, the server uses it as the baseline; otherwise
 * it tracks badge count internally.
 */
router.post('/portfolio-alert/evaluate', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { portfolioData: clientData, badgeCount } = req.body;

  // If the client provides a badge count, sync it (the client-side badge
  // count is authoritative since it tracks per-rule opt-outs)
  if (typeof badgeCount === 'number') {
    // Only sync if the client count is higher (avoids resetting on stale data)
    const currentServerCount = await getUserBadgeCount(userId);
    if (badgeCount > currentServerCount) {
      // Sync up: add the difference
      for (let i = currentServerCount; i < badgeCount; i++) {
        await incrementUserBadgeCount(userId);
      }
    }
  }

  try {
    let data: {
      totalReturnPercent: number;
      totalReturn: number;
      totalInvested: number;
      currentValue: number;
      peakValue: number;
      consecutiveLossDays: number;
    };

    if (clientData) {
      // Use data provided by the client
      data = {
        totalReturnPercent: clientData.totalReturnPercent ?? 0,
        totalReturn: clientData.totalReturn ?? 0,
        totalInvested: clientData.totalInvested ?? 0,
        currentValue: clientData.currentValue ?? 0,
        peakValue: clientData.peakValue ?? 0,
        consecutiveLossDays: clientData.consecutiveLossDays ?? 0,
      };
    } else {
      // Fetch from broker
      const broker = await getBroker();
      const holdings = await broker.getHoldings();
      const positions = await broker.getPositions();

      const currentValue = holdings.reduce((sum: number, h: any) => sum + (h.currentValue || 0), 0);
      const totalInvested = holdings.reduce((sum: number, h: any) => sum + (h.totalInvested || 0), 0);
      const totalReturn = currentValue - totalInvested;
      const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
      const peakValue = Math.max(currentValue, totalReturn > 0 ? currentValue - totalReturn : currentValue);

      data = {
        totalReturnPercent,
        totalReturn,
        totalInvested,
        currentValue,
        peakValue,
        consecutiveLossDays: calcConsecutiveLossDays(positions),
      };
    }

    // Get push token for the user
    const pushToken = pushTokenStore.get(userId) || null;

    // Evaluate rules
    const fired = await evaluatePortfolioAlerts(userId, data, pushToken);

    // Return the current badge count so the client can sync
    const currentBadgeCount = await getUserBadgeCount(userId);

    res.json({
      evaluated: true,
      rulesFired: fired.length,
      badgeCount: currentBadgeCount,
      fired,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to evaluate portfolio alerts' });
  }
});

/**
 * POST /api/notifications/portfolio-alert/reset-triggers
 *
 * Resets the triggered state on all rules for the current user
 * (e.g., at start of a new trading day).
 */
router.post('/portfolio-alert/reset-triggers', async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const rules = await getPortfolioAlertRules(userId);
    for (const rule of rules) {
      await updatePortfolioAlertRule(rule.id, { triggered: false });
    }
    // Also reset the badge count — new trading day = clean slate
    await resetUserBadgeCount(userId);
    res.json({ success: true, count: rules.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to reset triggers' });
  }
});

/**
 * Simple helper to estimate consecutive loss days from position data.
 * This is a best-effort heuristic — the frontend computes the actual value.
 */
function calcConsecutiveLossDays(positions: any[]): number {
  // If positions have dayPnL data, count consecutive negative days
  let count = 0;
  for (const pos of positions) {
    if (pos.dayPnL < 0) count++;
    else break;
  }
  return count;
}

export default router;
