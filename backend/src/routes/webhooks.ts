/**
 * ============================================================================
 * Toroloom — Webhook Management Routes
 * ============================================================================
 *
 * User-facing CRUD endpoints for managing webhook configurations.
 *
 * Endpoints:
 *   POST   /api/user/webhooks                   — Create a webhook
 *   GET    /api/user/webhooks                    — List user's webhooks
 *   GET    /api/user/webhooks/:id                — Get single webhook
 *   PUT    /api/user/webhooks/:id                — Update webhook
 *   DELETE /api/user/webhooks/:id                — Delete webhook
 *   POST   /api/user/webhooks/:id/test           — Send test ping
 *   GET    /api/user/webhooks/:id/logs           — Get delivery logs
 *
 * All endpoints require JWT auth via authMiddleware.
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  createWebhook,
  updateWebhook,
  getWebhook,
  listUserWebhooks,
  deleteWebhook,
  getWebhookDeliveryLogs,
  sendTestPing,
} from '../services/webhookService';
// ──── Known webhook events for validation ─────────────────────────────────
export const KNOWN_WEBHOOK_EVENTS = [
  'trade:executed', 'order:placed', 'order:filled', 'order:cancelled',
  'price:alert_triggered', 'portfolio:change', 'portfolio:threshold',
  'watchlist:change', 'market:open', 'market:close',
  'sentiment:shift', 'ai:insight_ready',
  'subscription:renewal', 'system:error',
] as const;

const KNOWN_EVENTS = new Set<string>(KNOWN_WEBHOOK_EVENTS);

const router = Router();

// All routes require auth
router.use(authMiddleware);

/**
 * POST /api/user/webhooks
 * Create a new webhook endpoint.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, url, events, description } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    // Validate required fields
    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'Webhook name is required' });
      return;
    }
    if (!url || !url.trim()) {
      res.status(400).json({ success: false, error: 'Target URL is required' });
      return;
    }
    if (!events || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({ success: false, error: 'At least one event must be selected' });
      return;
    }

    // Validate events
    const invalidEvents = events.filter((e: string) => !KNOWN_EVENTS.has(e));
    if (invalidEvents.length > 0) {
      res.status(400).json({ success: false, error: `Invalid event(s): ${invalidEvents.join(', ')}` });
      return;
    }

    // Validate URL format
    try {
      new URL(url.trim());
    } catch {
      res.status(400).json({ success: false, error: 'Invalid target URL' });
      return;
    }

    const webhook = await createWebhook(userId, {
      name: name.trim(),
      url: url.trim(),
      events: [...new Set(events)] as string[], // deduplicate
      description: description?.trim(),
    });

    // Return full secret only on creation
    res.status(201).json({
      success: true,
      data: {
        ...webhook,
        secret: webhook.secret, // full secret
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/user/webhooks
 * List all webhooks for the authenticated user.
 * Secrets are masked in list responses for security.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const webhooks = await listUserWebhooks(userId);
    // Mask secrets in list response
    const masked = webhooks.map(wh => ({
      ...wh,
      secret: wh.secret.length > 12
        ? `${wh.secret.slice(0, 7)}...${wh.secret.slice(-4)}`
        : wh.secret,
    }));
    res.json({ success: true, data: masked });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/user/webhooks/:id
 * Get a single webhook by ID. Secret is masked.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const webhook = await getWebhook(req.params.id as string, userId);
    if (!webhook) {
      res.status(404).json({ success: false, error: 'Webhook not found' });
      return;
    }
    // Mask secret in single-get response
    const maskedSecret = webhook.secret.length > 12
      ? `${webhook.secret.slice(0, 7)}...${webhook.secret.slice(-4)}`
      : webhook.secret;
    res.json({ success: true, data: { ...webhook, secret: maskedSecret } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * PUT /api/user/webhooks/:id
 * Update a webhook's name, URL, events, active status, or description.
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const { name, url, events, isActive, description } = req.body;

    const updates: Record<string, any> = {};

    if (name !== undefined) {
      if (!name.trim()) {
        res.status(400).json({ success: false, error: 'Webhook name cannot be empty' });
        return;
      }
      updates.name = name.trim();
    }

    if (url !== undefined) {
      try {
        new URL(url.trim());
        updates.url = url.trim();
      } catch {
        res.status(400).json({ success: false, error: 'Invalid target URL' });
        return;
      }
    }

    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        res.status(400).json({ success: false, error: 'At least one event must be selected' });
        return;
      }
      const invalidEvents = events.filter((e: string) => !KNOWN_EVENTS.has(e));
      if (invalidEvents.length > 0) {
        res.status(400).json({ success: false, error: `Invalid event(s): ${invalidEvents.join(', ')}` });
        return;
      }
      updates.events = [...new Set(events)];
    }

    if (isActive !== undefined) {
      updates.isActive = !!isActive;
    }

    if (description !== undefined) {
      updates.description = description.trim();
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'No changes provided' });
      return;
    }

    const webhook = await updateWebhook(req.params.id as string, userId, updates);
    if (!webhook) {
      res.status(404).json({ success: false, error: 'Webhook not found' });
      return;
    }

    res.json({ success: true, data: webhook });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/user/webhooks/:id
 * Delete a webhook and its delivery logs.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const deleted = await deleteWebhook(req.params.id as string, userId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Webhook not found' });
      return;
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/user/webhooks/:id/test
 * Send a test ping to the webhook endpoint.
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const result = await sendTestPing(req.params.id as string, userId);
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/user/webhooks/:id/logs
 * Get delivery logs for a webhook (last 50 by default).
 */
router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10) || 50, 100);
    const logs = await getWebhookDeliveryLogs(req.params.id as string, userId, limit);
    res.json({ success: true, data: logs });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
