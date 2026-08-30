/**
 * ============================================================================
 * Toroloom — Share Analytics Routes
 * ============================================================================
 *
 * Backend endpoints for share analytics:
 *   - POST /api/analytics/share          — Record a share event
 *   - GET  /api/analytics/share/stats    — Get share statistics
 *   - GET  /api/analytics/share/top      — Get top shared content
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';

const router = Router();

// ── In-memory store (replace with database in production) ───────────────────

interface ShareEvent {
  id: string;
  userId: string;
  platform: string;
  contentType: string;
  contentId?: string;
  contentSymbol?: string;
  timestamp: number;
}

const shareEvents: ShareEvent[] = [];
const MAX_EVENTS = 10000;

// ── Helper ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/analytics/share
 * Record a share event
 */
router.post('/', authMiddleware, writeLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { platform, contentType, contentId, contentSymbol } = req.body;

    if (!platform || !contentType) {
      res.status(400).json({ error: 'platform and contentType are required' });
      return;
    }

    const validPlatforms = ['native', 'copy', 'whatsapp', 'twitter', 'telegram'];
    if (!validPlatforms.includes(platform)) {
      res.status(400).json({ error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` });
      return;
    }

    const validContentTypes = ['stock', 'post', 'course', 'advisor', 'general'];
    if (!validContentTypes.includes(contentType)) {
      res.status(400).json({ error: `Invalid contentType. Must be one of: ${validContentTypes.join(', ')}` });
      return;
    }

    const event: ShareEvent = {
      id: generateId(),
      userId,
      platform,
      contentType,
      contentId,
      contentSymbol,
      timestamp: Date.now(),
    };

    shareEvents.unshift(event);

    // Trim old events
    if (shareEvents.length > MAX_EVENTS) {
      shareEvents.splice(MAX_EVENTS);
    }

    res.json({ success: true, id: event.id });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/analytics/share/stats
 * Get share statistics for the authenticated user
 */
router.get('/stats', authMiddleware, readLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userEvents = shareEvents.filter(e => e.userId === userId);

    // Aggregate stats
    const sharesByPlatform: Record<string, number> = {};
    const sharesByContentType: Record<string, number> = {};

    for (const event of userEvents) {
      sharesByPlatform[event.platform] = (sharesByPlatform[event.platform] || 0) + 1;
      sharesByContentType[event.contentType] = (sharesByContentType[event.contentType] || 0) + 1;
    }

    // Top shared stocks
    const stockCounts = new Map<string, number>();
    for (const event of userEvents) {
      if (event.contentType === 'stock' && event.contentSymbol) {
        stockCounts.set(event.contentSymbol, (stockCounts.get(event.contentSymbol) || 0) + 1);
      }
    }
    const topSharedStocks = Array.from(stockCounts.entries())
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top shared posts
    const postCounts = new Map<string, number>();
    for (const event of userEvents) {
      if (event.contentType === 'post' && event.contentId) {
        postCounts.set(event.contentId, (postCounts.get(event.contentId) || 0) + 1);
      }
    }
    const topSharedPosts = Array.from(postCounts.entries())
      .map(([postId, count]) => ({ postId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      totalShares: userEvents.length,
      sharesByPlatform,
      sharesByContentType,
      topSharedStocks,
      topSharedPosts,
      lastShareTime: userEvents[0]?.timestamp,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/analytics/share/top
 * Get top shared content across all users (admin only)
 */
router.get('/top', authMiddleware, readLimiter, async (req: Request, res: Response) => {
  try {
    // Aggregate across all users
    const sharesByPlatform: Record<string, number> = {};
    const sharesByContentType: Record<string, number> = {};

    for (const event of shareEvents) {
      sharesByPlatform[event.platform] = (sharesByPlatform[event.platform] || 0) + 1;
      sharesByContentType[event.contentType] = (sharesByContentType[event.contentType] || 0) + 1;
    }

    // Top shared stocks globally
    const stockCounts = new Map<string, number>();
    for (const event of shareEvents) {
      if (event.contentType === 'stock' && event.contentSymbol) {
        stockCounts.set(event.contentSymbol, (stockCounts.get(event.contentSymbol) || 0) + 1);
      }
    }
    const topSharedStocks = Array.from(stockCounts.entries())
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Top shared posts globally
    const postCounts = new Map<string, number>();
    for (const event of shareEvents) {
      if (event.contentType === 'post' && event.contentId) {
        postCounts.set(event.contentId, (postCounts.get(event.contentId) || 0) + 1);
      }
    }
    const topSharedPosts = Array.from(postCounts.entries())
      .map(([postId, count]) => ({ postId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Shares over time (last 7 days, grouped by day)
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentEvents = shareEvents.filter(e => e.timestamp > sevenDaysAgo);
    const sharesByDay: Record<string, number> = {};
    for (const event of recentEvents) {
      const day = new Date(event.timestamp).toISOString().split('T')[0];
      sharesByDay[day] = (sharesByDay[day] || 0) + 1;
    }

    res.json({
      totalShares: shareEvents.length,
      sharesByPlatform,
      sharesByContentType,
      topSharedStocks,
      topSharedPosts,
      sharesByDay,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
