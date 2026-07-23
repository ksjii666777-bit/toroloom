/**
 * ============================================================================
 * Toroloom — Stock Price Alert Routes
 * ============================================================================
 *
 * User-facing CRUD endpoints for managing stock price alerts.
 * All routes require JWT authentication.
 *
 * Endpoints:
 *   POST   /api/user/alerts               — Create a new price alert
 *   GET    /api/user/alerts                — List user's alerts
 *   GET    /api/user/alerts/:id            — Get a single alert
 *   PUT    /api/user/alerts/:id            — Update an alert
 *   DELETE /api/user/alerts/:id            — Delete an alert
 *   POST   /api/user/alerts/:id/trigger    — Manually trigger an alert
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  createAlert,
  getAlert,
  listUserAlerts,
  updateAlert,
  deleteAlert,
  triggerAlert,
} from '../services/stockAlertService';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// ──── POST /api/user/alerts ────────────────────────────────────────────────
// Create a new stock price alert.
// Body: { symbol: string, targetPrice: number, direction: 'above'|'below', note?: string }
router.post('/', async (req: Request, res: Response) => {
  try {
    const { symbol, targetPrice, direction, note } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    // ── Validate symbol ─────────────────────────────────────────
    if (!symbol || !symbol.trim()) {
      res.status(400).json({ success: false, error: 'Stock symbol is required' });
      return;
    }

    // ── Validate targetPrice ────────────────────────────────────
    const price = typeof targetPrice === 'number' ? targetPrice : parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      res.status(400).json({ success: false, error: 'Target price must be a positive number' });
      return;
    }

    // ── Validate direction ──────────────────────────────────────
    if (!direction || !['above', 'below'].includes(direction)) {
      res.status(400).json({ success: false, error: 'Direction must be "above" or "below"' });
      return;
    }

    // ── Create ──────────────────────────────────────────────────
    const alert = await createAlert(userId, {
      symbol: symbol.trim(),
      targetPrice: price,
      direction,
      note: note?.trim(),
    });

    res.status(201).json({ success: true, data: alert });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ──── GET /api/user/alerts ─────────────────────────────────────────────────
// List all alerts for the authenticated user.
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const status = req.query.status as string | undefined;

    let alerts = await listUserAlerts(userId);

    // Optional filter by status
    if (status && ['active', 'triggered', 'cancelled'].includes(status)) {
      alerts = alerts.filter((a) => a.status === status);
    }

    res.json({ success: true, data: alerts, count: alerts.length });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ──── GET /api/user/alerts/:id ─────────────────────────────────────────────
// Get a single alert by ID.
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const alert = await getAlert(req.params.id as string, userId);

    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    res.json({ success: true, data: alert });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ──── PUT /api/user/alerts/:id ─────────────────────────────────────────────
// Update an alert's targetPrice, direction, status, or note.
// Body: { targetPrice?: number, direction?: 'above'|'below', status?: 'active'|'cancelled', note?: string }
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { targetPrice, direction, status, note } = req.body;

    const updates: Record<string, any> = {};

    // Validate targetPrice
    if (targetPrice !== undefined) {
      const price = typeof targetPrice === 'number' ? targetPrice : parseFloat(targetPrice);
      if (isNaN(price) || price <= 0) {
        res.status(400).json({ success: false, error: 'Target price must be a positive number' });
        return;
      }
      updates.targetPrice = price;
    }

    // Validate direction
    if (direction !== undefined) {
      if (!['above', 'below'].includes(direction)) {
        res.status(400).json({ success: false, error: 'Direction must be "above" or "below"' });
        return;
      }
      updates.direction = direction;
    }

    // Validate status transitions
    if (status !== undefined) {
      if (!['active', 'cancelled'].includes(status)) {
        res.status(400).json({ success: false, error: 'Status can only be "active" or "cancelled"' });
        return;
      }
      updates.status = status;
    }

    // Validate note
    if (note !== undefined) {
      if (typeof note !== 'string') {
        res.status(400).json({ success: false, error: 'Note must be a string' });
        return;
      }
      updates.note = note.trim();
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'No valid fields to update' });
      return;
    }

    const alert = await updateAlert(req.params.id as string, userId, updates);
    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    res.json({ success: true, data: alert });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ──── DELETE /api/user/alerts/:id ──────────────────────────────────────────
// Delete an alert by ID.
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const deleted = await deleteAlert(req.params.id as string, userId);

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ──── POST /api/user/alerts/:id/trigger ─────────────────────────────────────
// Manually trigger an alert with a given price (for testing).
// Body: { triggeredPrice: number }
router.post('/:id/trigger', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { triggeredPrice } = req.body;

    const price = typeof triggeredPrice === 'number' ? triggeredPrice : parseFloat(triggeredPrice);
    if (isNaN(price) || price <= 0) {
      res.status(400).json({ success: false, error: 'Triggered price must be a positive number' });
      return;
    }

    const alert = await triggerAlert(req.params.id as string, userId, price);
    if (!alert) {
      res.status(404).json({ success: false, error: 'Active alert not found' });
      return;
    }

    res.json({ success: true, data: alert });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
