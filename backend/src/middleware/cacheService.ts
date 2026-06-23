/**
 * ============================================================================
 * Toroloom — Redis Cache-aside Service
 * ============================================================================
 *
 * Provides a cache-aside (lazy-loading) layer for computationally expensive
 * analytic endpoints — win/loss metrics, P&L aggregations, sector concentration,
 * tax summaries — so the database is queried only when the cache misses.
 *
 * Cache-aside flow:
 *   1. Client requests data (e.g. win/loss metrics for user_abc)
 *   2. cacheService.get('winLoss:user_abc') → returns cached hit, OR null
 *   3. On miss: caller fetches from DB, then cacheService.set(...) before
 *      returning to the client
 *   4. TTL expires naturally; caller repeats step 2-3
 *
 * Invalidation:
 *   - TTL-based expiry (configurable per key pattern)
 *   - Explicit invalidation via cacheService.del() when new trade data arrives
 *   - Server-sent events (SSE) / WebSocket push can also invalidate
 *     (see: notifyInvalidation())
 *
 * Graceful degradation:
 *   - If Redis is unavailable (connection refused, timeout), every method
 *     returns null / false without throwing.
 *   - Use getDiagnostics() to check connectivity at runtime.
 *   - Toggle caching off entirely via DISABLE_CACHE = '1' env var.
 *
 * Usage:
 *   import { cacheService } from '../middleware/cacheService';
 *
 *   // Cache-aside pattern
 *   const cached = await cacheService.get(`winLoss:${userId}`);
 *   if (cached) return JSON.parse(cached);
 *
 *   const metrics = await computeFromDb(userId);
 *   await cacheService.set(`winLoss:${userId}`, JSON.stringify(metrics), 300);
 *   return metrics;
 *
 * ============================================================================
 */

import Redis from 'ioredis';

// ──── Constants ────────────────────────────────────────────────────────────

const LOG_PREFIX = '[CacheService]';

/**
 * Default TTL per key pattern (seconds).
 */
const DEFAULT_TTL_SEC = 60; // 1 minute

/**
 * Longer TTL for stable aggregate data.
 */
const AGGREGATE_TTL_SEC = 300; // 5 minutes

/**
 * Cache key prefix — all keys are namespaced to avoid collisions.
 */
const KEY_PREFIX = 'toroloom:cache:';

/**
 * Key patterns used across the application.
 * Add new patterns here for discoverability.
 */
export const CacheKeys = {
  /** Win/loss frequency ratio + broker drag factor */
  winLoss: (userId: string) => `winLoss:${userId}`,

  /** Portfolio P&L aggregation */
  portfolioPnL: (userId: string) => `portfolioPnL:${userId}`,

  /** Sector concentration index */
  sectorConcentration: (userId: string) => `sectorConc:${userId}`,

  /** Capital gains tax summary (STCG + LTCG) */
  taxSummary: (userId: string, fiscalYear: string) => `taxSummary:${userId}:${fiscalYear}`,

  /** Monthly returns array */
  monthlyReturns: (userId: string) => `monthlyReturns:${userId}`,

  /** Broker session status (avoid DB lookup on every proxy request) */
  brokerSession: (userId: string, brokerType: string) => `brokerSession:${userId}:${brokerType}`,

  /** AI cognitive summary */
  aiCognitiveSummary: (userId: string) => `aiCognitive:${userId}`,

  /** Raw parsed ledger count (for badge / notification) */
  ledgerCount: (userId: string) => `ledgerCount:${userId}`,
} as const;

// ──── Key TTL map ──────────────────────────────────────────────────────────

const KEY_TTL: Record<string, number> = {
  winLoss: AGGREGATE_TTL_SEC,
  portfolioPnL: AGGREGATE_TTL_SEC,
  sectorConc: AGGREGATE_TTL_SEC,
  taxSummary: AGGREGATE_TTL_SEC,
  monthlyReturns: AGGREGATE_TTL_SEC,
  brokerSession: 30, // 30 seconds — tokens expire frequently
  aiCognitive: 600,  // 10 minutes — heavy computation
  ledgerCount: 30,
};

// ──── Internal State ───────────────────────────────────────────────────────

let client: Redis | null = null;
let connected = false;
let connectAttempted = false;

// ──── Public API ───────────────────────────────────────────────────────────

export interface CacheServiceDiagnostics {
  configured: boolean;
  connected: boolean;
  redisUrlSet: boolean;
  disabled: boolean;
}

/**
 * Get a value from the cache.
 *
 * @param key — cache key (without prefix; prefix is added automatically)
 * @returns The cached string value, or null on miss / error
 */
export async function get(key: string): Promise<string | null> {
  if (!await isAvailable()) return null;

  try {
    const prefixed = `${KEY_PREFIX}${key}`;
    const value = await client!.get(prefixed);
    if (value !== null) {
      console.debug(`${LOG_PREFIX} HIT  ${key}`);
    }
    return value;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} GET error (${key}): ${err.message}`);
    return null;
  }
}

/**
 * Set a value in the cache with an optional TTL.
 *
 * @param key    — cache key (without prefix)
 * @param value  — string value to cache (caller handles JSON.stringify)
 * @param ttlSec — seconds until expiry; defaults to pattern-specific or 60
 */
export async function set(key: string, value: string, ttlSec?: number): Promise<boolean> {
  if (!await isAvailable()) return false;

  try {
    const prefixed = `${KEY_PREFIX}${key}`;
    const ttl = ttlSec ?? resolveTtl(key);

    if (ttl > 0) {
      await client!.setex(prefixed, ttl, value);
    } else {
      await client!.set(prefixed, value);
    }

    console.debug(`${LOG_PREFIX} SET  ${key} (TTL: ${ttl}s)`);
    return true;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} SET error (${key}): ${err.message}`);
    return false;
  }
}

/**
 * Delete a key from the cache.
 *
 * @param key — cache key (without prefix)
 */
export async function del(key: string): Promise<boolean> {
  if (!await isAvailable()) return false;

  try {
    const prefixed = `${KEY_PREFIX}${key}`;
    await client!.del(prefixed);
    console.debug(`${LOG_PREFIX} DEL  ${key}`);
    return true;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} DEL error (${key}): ${err.message}`);
    return false;
  }
}

/**
 * Delete all keys matching a pattern.
 * Uses Redis SCAN for safe iteration (non-blocking).
 *
 * @param pattern — glob pattern (e.g. 'winLoss:*')
 */
export async function delPattern(pattern: string): Promise<number> {
  if (!await isAvailable()) return 0;

  try {
    const prefixedPattern = `${KEY_PREFIX}${pattern}`;
    let cursor = '0';
    let deleted = 0;

    do {
      const result = await client!.scan(cursor, 'MATCH', prefixedPattern, 'COUNT', 100);
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        await client!.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');

    if (deleted > 0) {
      console.debug(`${LOG_PREFIX} DEL_PATTERN ${pattern} — removed ${deleted} keys`);
    }
    return deleted;
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} DEL_PATTERN error (${pattern}): ${err.message}`);
    return 0;
  }
}

/**
 * Invalidate all cache entries for a specific user.
 * Call this when new trade data is imported or the portfolio changes.
 *
 * @param userId — the user whose cache to flush
 */
export async function invalidateUser(userId: string): Promise<void> {
  await delPattern(`*:${userId}`);
}

/**
 * Get cache service diagnostics.
 * Useful for health-check endpoints and operational dashboards.
 */
export function getDiagnostics(): CacheServiceDiagnostics {
  return {
    configured: !!(process.env.REDIS_URL || process.env.RAILWAY_REDIS_URL),
    connected,
    redisUrlSet: !!(process.env.REDIS_URL || process.env.RAILWAY_REDIS_URL),
    disabled: process.env.DISABLE_CACHE === '1',
  };
}

/**
 * Gracefully shut down the Redis connection.
 */
export async function shutdownCache(): Promise<void> {
  if (client) {
    try {
      await client.quit();
      console.log(`${LOG_PREFIX} Connection closed gracefully`);
    } catch (err: any) {
      console.warn(`${LOG_PREFIX} Error during shutdown: ${err.message}`);
    }
    client = null;
    connected = false;
    connectAttempted = false;
  }
}

// ──── Internal Helpers ─────────────────────────────────────────────────────

/**
 * Check if the cache service is available.
 *
 * Lazily connects on first call. After a failed connection attempt,
 * returns false for the rest of the process lifetime unless
 * reconnect() is called.
 */
async function isAvailable(): Promise<boolean> {
  // Caching disabled via env var — skip all cache operations
  if (process.env.DISABLE_CACHE === '1') return false;

  if (connected && client) return true;

  if (!connectAttempted) {
    connectAttempted = true;
    await connect();
  }

  return connected && client !== null;
}

/**
 * Connect to Redis using REDIS_URL or RAILWAY_REDIS_URL.
 *
 * The Railway Pro plan provides REDIS_URL automatically when a Redis
 * plugin is added to the project.
 */
async function connect(): Promise<void> {
  const redisUrl = process.env.RAILWAY_REDIS_URL || process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn(`
${LOG_PREFIX} ╔═══════════════════════════════════════════════════════════════╗
${LOG_PREFIX} ║  REDIS_URL is not set                                       ║
${LOG_PREFIX} ║                                                             ║
${LOG_PREFIX} ║  The cache service will gracefully skip all operations.      ║
${LOG_PREFIX} ║  All analytic queries will hit the database directly.        ║
${LOG_PREFIX} ║                                                             ║
${LOG_PREFIX} ║  To enable caching:                                          ║
${LOG_PREFIX} ║  1. Railway:  add a Redis plugin in Variables tab            ║
${LOG_PREFIX} ║  2. Local:    set REDIS_URL in backend/.env                   ║
${LOG_PREFIX} ║  3. Docker:   ensure redis service is running in compose      ║
${LOG_PREFIX} ╚═══════════════════════════════════════════════════════════════╝
    `);
    return;
  }

  try {
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null; // Give up after 5 retries
        return Math.min(times * 200, 2_000);
      },
      lazyConnect: true, // Don't connect until first command
      enableOfflineQueue: false, // Fail fast when disconnected
      connectTimeout: 5_000,
    });

    client.on('connect', () => {
      console.log(`${LOG_PREFIX} Connected to Redis`);
    });

    client.on('error', (err: Error) => {
      console.warn(`${LOG_PREFIX} Redis error: ${err.message}`);
    });

    client.on('close', () => {
      connected = false;
    });

    // Verify connectivity
    await client.connect();
    await client.ping();
    connected = true;

    console.log(
      `${LOG_PREFIX} Ready` +
      ` | TTL default: ${DEFAULT_TTL_SEC}s` +
      ` | agg TTL: ${AGGREGATE_TTL_SEC}s`,
    );
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Connection failed: ${err.message}. Caching disabled for this session.`);
    client = null;
    connected = false;
  }
}

/**
 * Resolve the TTL for a cache key based on its prefix.
 */
function resolveTtl(key: string): number {
  for (const [pattern, ttl] of Object.entries(KEY_TTL)) {
    if (key.startsWith(pattern)) return ttl;
  }
  return DEFAULT_TTL_SEC;
}
