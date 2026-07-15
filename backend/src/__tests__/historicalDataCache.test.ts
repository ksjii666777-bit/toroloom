/**
 * ============================================================================
 * Toroloom — Historical Data Cache Unit Tests
 * ============================================================================
 *
 * Tests the hybrid cache (MemoryCache + Redis) used by
 * GET /api/fno/historical-data via the configured env + cacheService mocks.
 *
 * Scenarios covered:
 *   - Cache miss → mock fetch → sets both caches
 *   - Redis cache hit → returns cached, seeds memory
 *   - Memory cache hit (Redis unavailable) → falls back gracefully
 *   - Memory cache hit (Redis returns null) → memory works
 *   - Cache eviction when max entries exceeded
 *   - Redis write failure → memory cache still updated
 *   - Validation: days < 5, > 3650, NaN, negative
 *   - Boundary values (5 and 3650)
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/historicalDataCache.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import http from 'http';

// ──── Mock env — Redis on by default, mock data source, small cache for eviction ─

const mockHasRedis = vi.hoisted(() => vi.fn().mockReturnValue(true));
const mockIsMock = vi.hoisted(() => vi.fn().mockReturnValue(true));

vi.mock('../config/env', () => ({
  env: {
    get hasRedis() { return mockHasRedis(); },
    get isMock() { return mockIsMock(); },
    backtestCacheTtl: 3600,
    cacheMaxEntries: 50,
    port: 0,
    nodeEnv: 'test',
    jwtExpiresIn: '7d',
    dataSource: 'mock' as const,
    broker: 'mock' as const,
    storageBackend: 'memory' as const,
    jwtSecret: 'test-secret',
    databaseUrl: '',
    mongodbUri: '',
    mongodbDbName: '',
    aiProvider: 'openrouter' as const,
    openRouterApiKey: '',
    googleGeminiApiKey: '',
    choreoClaudeApiKey: '',
    razorpayKeyId: '',
    razorpayKeySecret: '',
    razorpayWebhookSecret: '',
    telegramBotToken: '',
    angelSmartApiKey: '',
    marketstackKey: '',
    newsApiKey: '',
    sentryDsn: '',
    redisUrl: '',
    marketDataCacheTtl: 600,
    cacheMaxEntries: 50,
    subscriptionGatingEnabled: false,
    get isDev() { return true; },
  },
}));

// ──── Mock cacheService (Redis) ────────────────────────────────────────────

const mockRedisGet = vi.hoisted(() => vi.fn());
const mockRedisSet = vi.hoisted(() => vi.fn());

vi.mock('../middleware/cacheService', () => ({
  get: mockRedisGet,
  set: mockRedisSet,
}));

// ──── Mock auth middleware ─────────────────────────────────────────────────

vi.mock('../middleware/auth', () => ({
  authMiddleware: (_req: any, _res: any, next: () => void) => {
    next();
  },
}));

// ──── Import route AFTER mocks ─────────────────────────────────────────────

import fnoRoutes from '../routes/fno';

// ──── Helpers ──────────────────────────────────────────────────────────────

type ResResult = { status: number; body: any };

function request(
  server: http.Server,
  baseUrl: string,
  opts: { method: string; path: string; body?: any; headers?: Record<string, string> },
): Promise<ResResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, baseUrl);
    const req = http.request(
      url.toString(),
      {
        method: opts.method,
        headers: {
          'Content-Type': 'application/json',
          ...opts.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          let body: any;
          try {
            body = data ? JSON.parse(data) : undefined;
          } catch {
            body = data;
          }
          resolve({ status: res.statusCode!, body });
        });
      },
    );
    req.on('error', reject);

    if (opts.body) {
      req.write(JSON.stringify(opts.body));
    }
    req.end();
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('Historical Data Cache', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/fno', fnoRoutes);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    server?.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockHasRedis.mockReturnValue(true);
    mockIsMock.mockReturnValue(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cache Miss → Fetch → Cache
  // ─────────────────────────────────────────────────────────────────────────

  describe('Cache Miss → Fetch → Cache', () => {
    it('should fetch mock data on cache miss and set both caches', async () => {
      mockRedisGet.mockResolvedValue(null); // Redis miss

      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=MISS_TEST&days=30',
      });

      expect(status).toBe(200);
      expect(body.source).toBe('mock');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      // Should have ~22 trading days (30 total minus ~8 weekend days)
      expect(body.data.length).toBeLessThanOrEqual(30);

      // Redis set should have been called with the correct key structure
      expect(mockRedisSet).toHaveBeenCalledTimes(1);
      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('backtest:historical:MISS_TEST:30'),
        expect.any(String),
        3600,
      );

      // Data format check
      const point = body.data[0];
      expect(point).toHaveProperty('date');
      expect(typeof point.date).toBe('string');
      expect(point).toHaveProperty('open');
      expect(typeof point.open).toBe('number');
      expect(point).toHaveProperty('high');
      expect(typeof point.high).toBe('number');
      expect(point).toHaveProperty('low');
      expect(typeof point.low).toBe('number');
      expect(point).toHaveProperty('close');
      expect(typeof point.close).toBe('number');
      expect(point).toHaveProperty('volume');
      expect(typeof point.volume).toBe('number');
    });

    it('should skip weekends in generated mock data', async () => {
      mockRedisGet.mockResolvedValue(null);

      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=WKEND_TEST&days=365',
      });

      expect(status).toBe(200);
      // ~261 trading days in a year (365 - 104 weekend days)
      expect(body.data.length).toBeGreaterThan(240);
      expect(body.data.length).toBeLessThanOrEqual(261);

      // Verify no Saturdays (day 6) or Sundays (day 0)
      for (const point of body.data) {
        const day = new Date(point.date).getDay();
        expect(day).not.toBe(0); // not Sunday
        expect(day).not.toBe(6); // not Saturday
      }
    });

    it('should return the same symbol and days in the response', async () => {
      mockRedisGet.mockResolvedValue(null);

      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=BANKNIFTY&days=90',
      });

      expect(status).toBe(200);
      expect(body.symbol).toBe('BANKNIFTY');
      expect(body.days).toBe(90);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Redis Cache Hit
  // ─────────────────────────────────────────────────────────────────────────

  describe('Redis Cache Hit', () => {
    it('should return cached data from Redis with source: cache', async () => {
      const cachedData = [
        { date: '2026-01-01', open: 23400, high: 23500, low: 23300, close: 23450, volume: 1000000 },
        { date: '2026-01-02', open: 23450, high: 23600, low: 23400, close: 23500, volume: 1200000 },
      ];
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedData));

      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=REDIS_HIT&days=5',
      });

      expect(status).toBe(200);
      expect(body.source).toBe('cache');
      expect(body.data).toEqual(cachedData);
      expect(body.symbol).toBe('REDIS_HIT');
      expect(body.days).toBe(5);

      // Should NOT have called cacheService.set again
      expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it('should seed the memory cache from Redis hit and use it for subsequent requests', async () => {
      // First request: Redis hit
      const cachedData = [{ date: '2026-03-01', open: 24000, high: 24100, low: 23900, close: 24050, volume: 800000 }];
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedData));

      const { body: b1 } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=SEED_MEM&days=5',
      });
      expect(b1.source).toBe('cache');
      expect(b1.data).toEqual(cachedData);

      // Second request: Redis returns null NOW, but memory was seeded
      mockRedisGet.mockResolvedValue(null);

      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=SEED_MEM&days=5',
      });

      expect(status).toBe(200);
      expect(body.source).toBe('cache');
      expect(body.data).toEqual(cachedData); // Same data from memory cache
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Memory Cache (Redis Unavailable / Returns Null)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Memory Cache Fallback', () => {
    it('should fall back to memory cache when Redis is unavailable (hasRedis=false)', async () => {
      mockHasRedis.mockReturnValue(false);

      // First call: Redis completely skipped, memory miss → fetch from mock
      const { status: s1, body: b1 } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=NO_REDIS&days=10',
      });

      expect(s1).toBe(200);
      expect(b1.source).toBe('mock');
      // Redis should not have been called at all
      expect(mockRedisGet).not.toHaveBeenCalled();
      expect(mockRedisSet).not.toHaveBeenCalled();

      // Second call: same key, should hit memory cache
      const { status: s2, body: b2 } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=NO_REDIS&days=10',
      });

      expect(s2).toBe(200);
      expect(b2.source).toBe('cache');
      expect(b2.data).toEqual(b1.data);
    });

    it('should use memory cache when Redis returns null on subsequent call', async () => {
      mockRedisGet.mockResolvedValue(null);

      // First call: Redis miss → fetch mock
      await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=REDIS_NULL&days=5',
      });

      // Second call: Redis still null, but memory has it
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=REDIS_NULL&days=5',
      });

      expect(status).toBe(200);
      expect(body.source).toBe('cache');
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('should NOT use memory cache for a DIFFERENT symbol', async () => {
      mockRedisGet.mockResolvedValue(null);

      // Fetch for symbol A
      await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=SYM_A&days=10',
      });

      // Fetch for symbol B (different) — should miss memory cache
      mockRedisGet.mockResolvedValue(null);

      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=SYM_B&days=10',
      });

      expect(status).toBe(200);
      expect(body.source).toBe('mock'); // miss, different key
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cache Eviction
  // ─────────────────────────────────────────────────────────────────────────

  describe('Cache Eviction', () => {
    it('should evict oldest entries when cache exceeds max entries (50)', async () => {
      mockHasRedis.mockReturnValue(false); // Don't use Redis for this test

      // Create 60 entries (exceeds max of 50 in mock env)
      for (let i = 0; i < 60; i++) {
        await request(server, baseUrl, {
          method: 'GET', path: `/api/fno/historical-data?symbol=EVICT_${i}&days=5`,
        });
      }

      // The oldest-entered keys should have been evicted (Map preserves insertion order)
      // Eviction removes oldest 25% of 50 = ~12 entries when the 51st is added
      // EVICT_0 through ~EVICT_11 should be evicted

      // Check that EVICT_0 is now a cache miss (was evicted)
      const { status: s0, body: b0 } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=EVICT_0&days=5',
      });
      expect(s0).toBe(200);
      expect(b0.source).toBe('mock'); // was evicted

      // Check that the most recent entry is still cached
      const { status: s59, body: b59 } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=EVICT_59&days=5',
      });
      expect(s59).toBe(200);
      expect(b59.source).toBe('cache'); // still in cache
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Graceful Degradation (Redis Write Failure)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Graceful Degradation', () => {
    it('should still work when Redis write fails (memory cache still updated)', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSet.mockRejectedValue(new Error('Redis connection lost'));

      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=REDIS_FAIL&days=5',
      });

      expect(status).toBe(200);
      expect(body.source).toBe('mock');

      // Second call: Redis still fails, but memory cache has the data
      const { status: s2, body: b2 } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=REDIS_FAIL&days=5',
      });

      expect(s2).toBe(200);
      expect(b2.source).toBe('cache');
      expect(b2.data).toEqual(body.data);
    });

    it('should still work when Redis read throws (MemoryCache takes over)', async () => {
      mockRedisGet.mockRejectedValue(new Error('Redis timeout'));
      mockRedisSet.mockResolvedValue(undefined);

      // First call: Redis read fails → fall through to memory cache miss → fetch mock
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=REDIS_TIMEOUT&days=5',
      });

      expect(status).toBe(200);
      expect(body.source).toBe('mock');

      // Redis write may or may not succeed depending on timing
      // Second call: Redis again throws, but memory cache has the data
      mockRedisGet.mockRejectedValue(new Error('Redis timeout'));

      const { status: s2, body: b2 } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=REDIS_TIMEOUT&days=5',
      });

      expect(s2).toBe(200);
      expect(b2.source).toBe('cache');
      expect(b2.data).toEqual(body.data);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Validation & Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('Input Validation', () => {
    it('should reject days less than 5', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=NIFTY&days=1',
      });

      expect(status).toBe(400);
      expect(body.error).toContain('days');
    });

    it('should reject days greater than 3650', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=NIFTY&days=5000',
      });

      expect(status).toBe(400);
      expect(body.error).toContain('days');
    });

    it('should reject non-numeric days parameter', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=NIFTY&days=abc',
      });

      expect(status).toBe(400);
      expect(body.error).toContain('days');
    });

    it('should reject negative days', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=NIFTY&days=-5',
      });

      expect(status).toBe(400);
      expect(body.error).toContain('days');
    });

    it('should reject days=0', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=NIFTY&days=0',
      });

      expect(status).toBe(400);
      expect(body.error).toContain('days');
    });

    it('should accept boundary values (days=5 and days=3650)', async () => {
      mockRedisGet.mockResolvedValue(null);

      const { status: s1, body: b1 } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=BOUNDARY_LOW&days=5',
      });
      expect(s1).toBe(200);
      expect(b1.data.length).toBeGreaterThan(0);

      mockRedisGet.mockResolvedValue(null);

      const { status: s2, body: b2 } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=BOUNDARY_HIGH&days=3650',
      });
      expect(s2).toBe(200);
      expect(b2.data.length).toBeGreaterThan(0);
    });

    it('should use default symbol (NIFTY) when symbol is omitted', async () => {
      mockRedisGet.mockResolvedValue(null);

      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?days=5',
      });

      expect(status).toBe(200);
      expect(body.symbol).toBe('NIFTY');
    });

    it('should use default days (365) when days is omitted', async () => {
      mockRedisGet.mockResolvedValue(null);

      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/historical-data?symbol=DEF_DAYS',
      });

      expect(status).toBe(200);
      expect(body.days).toBe(365);
    });
  });
});
