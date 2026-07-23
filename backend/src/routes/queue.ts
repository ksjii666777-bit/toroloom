/**
 * ============================================================================
 * Toroloom — Queue Status Route
 * ============================================================================
 *
 * Exposes BullMQ queue metrics via a read-only endpoint.
 * Useful for monitoring, diagnostics, and dashboard integration.
 *
 * GET /api/queue/status
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { getOrderQueue, getMarketScheduleHealth } from '../services/queue';

const router = Router();

/**
 * GET /api/queue/status
 *
 * Returns queue metrics:
 *   - waiting    — jobs waiting to be processed
 *   - active     — jobs currently being processed
 *   - completed  — jobs completed (within retention window)
 *   - failed     — jobs that permanently failed
 *   - delayed    — jobs scheduled for future processing
 *
 * Also includes market schedule worker health:
 *   - marketSchedule — polling status, uptime, total polls and errors
 *
 * When Redis is not available, returns { available: false }.
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const queue = getOrderQueue();
    const marketSchedule = getMarketScheduleHealth();

    let queueStatus: Record<string, unknown>;

    if (!queue) {
      queueStatus = {
        available: false,
        message: 'Queue requires Redis. Orders execute synchronously.',
      };
    } else {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      queueStatus = {
        available: true,
        name: 'order-processing',
        counts: { waiting, active, completed, failed, delayed },
        total: waiting + active + completed + failed + delayed,
      };
    }

    res.json({
      ...queueStatus,
      marketSchedule,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      available: false,
      error: message,
    });
  }
});

export default router;
