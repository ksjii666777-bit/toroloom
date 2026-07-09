/**
 * ============================================================================
 * Toroloom — Analytics Routes (Redis-Cached)
 * ============================================================================
 *
 * Provides computationally expensive analytics endpoints with a cache-aside
 * layer via cacheService (Redis).
 *
 * Endpoints:
 *   GET /api/analytics/win-loss             — Win/loss ratio + broker drag factor
 *   GET /api/analytics/pnl                  — Portfolio P&L aggregation
 *   GET /api/analytics/sector-concentration — Sector concentration index
 *
 * All endpoints:
 *   - Require auth (authMiddleware)
 *   - Check L1 (in-memory insightCache) first
 *   - Fall back to L2 (Redis cacheService) on L1 miss
 *   - Compute from broker/portfolio data on L2 miss, then seed L2
 *   - Gracefully degrade when Redis is unavailable
 *
 * Cache keys defined in CacheKeys (cacheService.ts):
 *   winLoss:{userId}           — TTL: 300s (5 min)
 *   portfolioPnL:{userId}      — TTL: 300s (5 min)
 *   sectorConc:{userId}        — TTL: 300s (5 min)
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { get as cacheGet, set as cacheSet, CacheKeys } from '../middleware/cacheService';
import {
  computeWinLoss,
  computePnL,
  computeSectorConcentration,
  computeTaxSummary,
  computeMonthlyReturns,
} from '../services/analytics';
import {
  incrementCacheHit,
  incrementCacheMiss,
  observeCacheLookup,
  observeCacheCompute,
} from '../services/metrics';

const router = Router();
router.use(authMiddleware);

// ──── Cache-Aside Helper ────────────────────────────────────────────────────

/**
 * Generic cache-aside helper with Prometheus instrumentation.
 *
 * Checks L2 (Redis) cache first (JSON.parse on hit); on miss, calls the
 * computation function, seeds the cache (JSON.stringify), and returns the
 * result. Falls back to computation on Redis failure (graceful degradation).
 *
 * Records Prometheus metrics:
 *   - toroloom_cache_hits_total{endpoint}     — incremented on cache hit
 *   - toroloom_cache_misses_total{endpoint}   — incremented on cache miss
 *   - toroloom_cache_lookup_seconds{endpoint} — histogram of Redis GET latency
 *   - toroloom_cache_compute_seconds{endpoint}— histogram of compute latency
 *   - toroloom_cache_hit_ratio{endpoint}      — instantaneous hit ratio gauge
 *
 * TTL is resolved automatically by cacheService based on key prefix.
 *
 * @param endpoint — label for Prometheus metrics (e.g. 'win-loss', 'pnl')
 * @param cacheKey — Redis cache key (without prefix)
 * @param compute  — async function to compute data on cache miss
 */
async function cacheAside<T>(endpoint: string, cacheKey: string, compute: () => Promise<T>): Promise<T> {
  // ── Cache Lookup (L2) ────────────────────────────────────────
  const lookupStart = Date.now();
  try {
    const cached = await cacheGet(cacheKey);
    const lookupDuration = Date.now() - lookupStart;
    observeCacheLookup(endpoint, lookupDuration);

    if (cached !== null) {
      incrementCacheHit(endpoint);
      return JSON.parse(cached) as T;
    }
  } catch {
    // Redis unavailable or JSON parse failure — fall through to computation
  }

  // ── Cache Miss — Compute ─────────────────────────────────────
  incrementCacheMiss(endpoint);
  const computeStart = Date.now();
  const value = await compute();
  const computeDuration = Date.now() - computeStart;
  observeCacheCompute(endpoint, computeDuration);

  // Seed cache (best-effort; TTL resolved by cacheService from key prefix)
  try {
    await cacheSet(cacheKey, JSON.stringify(value));
  } catch {
    // Non-blocking cache seed failure
  }

  return value;
}

// ──── Routes ────────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/win-loss
 *
 * Returns win/loss metrics for the authenticated user.
 * Cached at L2 (Redis) with key winLoss:{userId}, TTL: 300s.
 */
router.get('/win-loss', async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const cacheKey = CacheKeys.winLoss(userId);
    const metrics = await cacheAside('win-loss', cacheKey, () => computeWinLoss(userId));
    res.json(metrics);
  } catch (error: unknown) {
    console.error('[Analytics] Win/Loss computation failed:', (error as Error).message);
    res.status(503).json({
      error: 'Win/Loss analytics temporarily unavailable. Please try again later.',
    });
  }
});

/**
 * GET /api/analytics/pnl
 *
 * Returns portfolio P&L aggregation for the authenticated user.
 * Cached at L2 (Redis) with key portfolioPnL:{userId}, TTL: 300s.
 */
router.get('/pnl', async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const cacheKey = CacheKeys.portfolioPnL(userId);
    const pnl = await cacheAside('pnl', cacheKey, () => computePnL(userId));
    res.json(pnl);
  } catch (error: unknown) {
    console.error('[Analytics] P&L computation failed:', (error as Error).message);
    res.status(503).json({
      error: 'P&L analytics temporarily unavailable. Please try again later.',
    });
  }
});

/**
 * GET /api/analytics/sector-concentration
 *
 * Returns sector concentration metrics for the authenticated user.
 * Cached at L2 (Redis) with key sectorConc:{userId}, TTL: 300s.
 */
router.get('/sector-concentration', async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const cacheKey = CacheKeys.sectorConcentration(userId);
    const concentration = await cacheAside('sector-concentration', cacheKey, () => computeSectorConcentration(userId));
    res.json(concentration);
  } catch (error: unknown) {
    console.error('[Analytics] Sector concentration computation failed:', (error as Error).message);
    res.status(503).json({
      error: 'Sector concentration analytics temporarily unavailable. Please try again later.',
    });
  }
});

/**
 * GET /api/analytics/tax-summary
 *
 * Returns capital gains tax summary (STCG + LTCG) for the authenticated user.
 * Cached at L2 (Redis) with key taxSummary:{userId}:{fiscalYear}, TTL: 300s.
 *
 * Query params:
 *   fiscalYear — e.g. '2025-26' (defaults to current financial year)
 */
router.get('/tax-summary', async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    // Determine fiscal year (default: current FY)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    // Indian fiscal year: Apr 1 to Mar 31
    const fyStart = month >= 3 ? year : year - 1;
    const fyEnd = fyStart + 1;
    const fiscalYear = (req.query.fiscalYear as string) || `${fyStart}-${String(fyEnd).slice(2)}`;

    const cacheKey = CacheKeys.taxSummary(userId, fiscalYear);
    const summary = await cacheAside('tax-summary', cacheKey, () => computeTaxSummary(userId, fiscalYear));
    res.json(summary);
  } catch (error: unknown) {
    console.error('[Analytics] Tax summary computation failed:', (error as Error).message);
    res.status(503).json({
      error: 'Tax summary analytics temporarily unavailable. Please try again later.',
    });
  }
});

/**
 * GET /api/analytics/monthly-returns
 *
 * Returns monthly P&L breakdown for the authenticated user.
 * Cached at L2 (Redis) with key monthlyReturns:{userId}, TTL: 300s.
 */
router.get('/monthly-returns', async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const cacheKey = CacheKeys.monthlyReturns(userId);
    const returns = await cacheAside('monthly-returns', cacheKey, () => computeMonthlyReturns(userId));
    res.json(returns);
  } catch (error: unknown) {
    console.error('[Analytics] Monthly returns computation failed:', (error as Error).message);
    res.status(503).json({
      error: 'Monthly returns analytics temporarily unavailable. Please try again later.',
    });
  }
});

export default router;
