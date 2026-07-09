/**
 * ============================================================================
 * Toroloom Social Trading Routes — Follow, Copy Trading, Leaderboard
 * ============================================================================
 *
 * Endpoints:
 *   GET    /api/social/leaderboard          — Top traders ranking
 *   GET    /api/social/traders/search       — Search traders
 *   GET    /api/social/traders/:id          — Trader profile
 *   POST   /api/social/traders/:id/follow   — Follow a trader
 *   POST   /api/social/traders/:id/unfollow — Unfollow a trader
 *   POST   /api/social/copy/start           — Start copy trading
 *   POST   /api/social/copy/:id/stop        — Stop copy trading
 *   POST   /api/social/copy/:id/toggle-pause — Pause/resume copy
 *   PUT    /api/social/copy/:id/allocation  — Update allocation
 *   GET    /api/social/copy/my              — My copy relations
 *   GET    /api/social/following            — My followed traders
 *
 * Auth: Required (authMiddleware)
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import {
  getLeaderboard,
  searchTraders,
  getTraderProfile,
  followTrader,
  unfollowTrader,
  startCopyTrading,
  stopCopyTrading,
  toggleCopyPause,
  updateCopyAllocation,
  getMyCopyTrades,
  getMyFollowedTraders,
} from '../services/social';

const router = Router();
// authMiddleware is applied in server.ts via app.use('/api/social', ..., authMiddleware, ...)

/**
 * GET /api/social/leaderboard
 *
 * Query: ?sort=pnl&period=ALL&page=1&limit=20
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  const sort = (req.query.sort as string) || 'pnl';
  const period = (req.query.period as string) || 'ALL';
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const data = await getLeaderboard(sort, period, page, limit);
  res.json(data);
});

/**
 * GET /api/social/traders/search?q=...
 */
router.get('/traders/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  if (!query.trim()) {
    res.json([]);
    return;
  }
  const results = await searchTraders(query);
  res.json(results);
});

/**
 * GET /api/social/traders/:id
 */
router.get('/traders/:id', async (req: Request, res: Response) => {
  const traderId = req.params.id as string;
  const trader = await getTraderProfile(traderId);
  if (!trader) {
    res.status(404).json({ error: 'Trader not found' });
    return;
  }
  res.json(trader);
});

/**
 * POST /api/social/traders/:id/follow
 */
router.post('/traders/:id/follow', async (req: Request, res: Response) => {
  const followers = await followTrader(req.user!.userId, req.params.id as string);
  res.json({ followers });
});

/**
 * POST /api/social/traders/:id/unfollow
 */
router.post('/traders/:id/unfollow', async (req: Request, res: Response) => {
  const followers = await unfollowTrader(req.user!.userId, req.params.id as string);
  res.json({ followers });
});

/**
 * POST /api/social/copy/start
 * Body: { traderId, allocationPercent, investmentAmount }
 */
router.post('/copy/start', async (req: Request, res: Response) => {
  const { traderId, allocationPercent, investmentAmount } = req.body;
  if (!traderId || allocationPercent == null || investmentAmount == null) {
    res.status(400).json({ error: 'traderId, allocationPercent, and investmentAmount are required' });
    return;
  }

  try {
    const relation = await startCopyTrading(req.user!.userId, traderId, allocationPercent, investmentAmount);
    res.status(201).json(relation);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/social/copy/:id/stop
 */
router.post('/copy/:id/stop', async (req: Request, res: Response) => {
  await stopCopyTrading(req.user!.userId, req.params.id as string);
  res.json({ success: true });
});

/**
 * POST /api/social/copy/:id/toggle-pause
 */
router.post('/copy/:id/toggle-pause', async (req: Request, res: Response) => {
  try {
    const isPaused = await toggleCopyPause(req.user!.userId, req.params.id as string);
    res.json({ isPaused });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/social/copy/:id/allocation
 * Body: { allocationPercent }
 */
router.put('/copy/:id/allocation', async (req: Request, res: Response) => {
  const { allocationPercent } = req.body;
  if (allocationPercent == null) {
    res.status(400).json({ error: 'allocationPercent is required' });
    return;
  }

  try {
    const relation = await updateCopyAllocation(req.user!.userId, req.params.id as string, allocationPercent);
    res.json(relation);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/social/copy/my
 */
router.get('/copy/my', async (req: Request, res: Response) => {
  const relations = await getMyCopyTrades(req.user!.userId);
  res.json(relations);
});

/**
 * GET /api/social/following
 */
router.get('/following', async (req: Request, res: Response) => {
  const traders = await getMyFollowedTraders(req.user!.userId);
  res.json(traders);
});

export default router;
