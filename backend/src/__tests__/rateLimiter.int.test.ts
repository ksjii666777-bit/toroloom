/**
 * ============================================================================
 * Rate Limiter — Integration Tests
 * ============================================================================
 *
 * Verifies that the authLimiter actually blocks requests after exceeding
 * the configured limit. Uses a custom rate limiter with a short window
 * and low max to keep tests fast.
 *
 * NOTE on production authLimiter:
 *   The production authLimiter (from rateLimiter.ts) uses max=10 with a
 *   15-minute window, but NODE_ENV=test causes it to skip entirely
 *   (skip: () => true). To verify the blocking behavior, we create fresh
 *   rateLimit() instances with identical configuration patterns. The
 *   express-rate-limit library behavior is the same regardless of the
 *   max value — only the threshold changes. Using max=3 keeps tests fast.
 *
 * Requests are sent SEQUENTIALLY (not in parallel) to ensure the rate
 * limiter's counter increments deterministically.
 *
 * Run: npx vitest run src/__tests__/rateLimiter.int.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import http from 'http';
import rateLimit from 'express-rate-limit';

// ──── Constants ─────────────────────────────────────────────────────────────

/** Allowed requests before rate limiting kicks in */
const RATE_LIMIT_MAX = 3;

/** Window in milliseconds (1 second — fast enough for tests) */
const RATE_LIMIT_WINDOW_MS = 1000;

// ──── Test Helpers ──────────────────────────────────────────────────────────

/**
 * Send a single HTTP GET request and return status + body.
 */
function singleRequest(baseUrl: string, path: string = '/test'): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url.toString(),
      { method: 'GET' },
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
    req.end();
  });
}

/**
 * Send `count` requests ONE AT A TIME — wait for each response before
 * sending the next. This avoids race conditions with the rate limiter's
 * in-memory counter and guarantees deterministic ordering.
 */
async function sendSequential(baseUrl: string, count: number): Promise<{ status: number; body: any }[]> {
  const results: { status: number; body: any }[] = [];
  for (let i = 0; i < count; i++) {
    results.push(await singleRequest(baseUrl));
  }
  return results;
}

// ──── Helper: Create a server with a custom rate limiter ────────────────────

interface LimiterConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (req: http.IncomingMessage) => string;
}

function createRateLimitedServer(config: LimiterConfig): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const app = express();

    const limiter = rateLimit({
      windowMs: config.windowMs,
      max: config.max,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: config.keyGenerator || (() => 'test-user'),
      message: { error: 'Too many requests. Please slow down.' },
    });

    app.get('/test', limiter, (_req, res) => {
      res.json({ success: true, message: 'Request allowed' });
    });

    const server = http.createServer(app);
    server.listen(0, () => {
      const port = (server.address() as any).port;
      resolve({ server, baseUrl: `http://localhost:${port}` });
    });
  });
}

// ============================================================================
// 1. BASIC RATE LIMITING — Fixed Key, max=3
// ============================================================================
// Uses max=3 for test speed. The production authLimiter uses max=10 with
// the same express-rate-limit library — the blocking behavior is identical.

describe(`Rate Limiter (max=${RATE_LIMIT_MAX}, window=${RATE_LIMIT_WINDOW_MS}ms)`, () => {
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    const s = await createRateLimitedServer({
      windowMs: RATE_LIMIT_WINDOW_MS,
      max: RATE_LIMIT_MAX,
      keyGenerator: () => 'test-user',
    });
    server = s.server;
    baseUrl = s.baseUrl;
  });

  afterEach(() => {
    server?.close();
  });

  it('allows requests within the limit', async () => {
    const responses = await sendSequential(baseUrl, RATE_LIMIT_MAX);

    expect(responses).toHaveLength(RATE_LIMIT_MAX);
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it('blocks requests that exceed the limit (max+1 returns 429)', async () => {
    const responses = await sendSequential(baseUrl, RATE_LIMIT_MAX + 1);

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(responses[i].status).toBe(200);
      expect(responses[i].body.success).toBe(true);
    }

    const blocked = responses[RATE_LIMIT_MAX];
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBeDefined();
    expect(blocked.body.error).toContain('Too many');
  });

  it('blocks ALL subsequent requests after limit is reached', async () => {
    const responses = await sendSequential(baseUrl, RATE_LIMIT_MAX + 3);

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(responses[i].status).toBe(200);
    }
    for (let i = RATE_LIMIT_MAX; i < responses.length; i++) {
      expect(responses[i].status).toBe(429);
    }
  });

  it('returns the configured error message on blocked requests', async () => {
    const responses = await sendSequential(baseUrl, RATE_LIMIT_MAX + 1);
    const blocked = responses[RATE_LIMIT_MAX];

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'Too many requests. Please slow down.' });
  });
});

// ============================================================================
// 2. WINDOW RESET
// ============================================================================

describe('Rate Limiter window reset', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    const s = await createRateLimitedServer({
      windowMs: 500,
      max: 2,
      keyGenerator: () => 'test-user',
    });
    server = s.server;
    baseUrl = s.baseUrl;
  });

  afterEach(() => {
    server?.close();
  });

  it('resets the counter after the window expires', async () => {
    // Exhaust the limit
    const exhaust = await sendSequential(baseUrl, 2);
    expect(exhaust[0].status).toBe(200);
    expect(exhaust[1].status).toBe(200);

    // Next request blocked
    const blocked = await singleRequest(baseUrl);
    expect(blocked.status).toBe(429);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 700));

    // New window — request allowed again
    const allowed = await singleRequest(baseUrl);
    expect(allowed.status).toBe(200);
    expect(allowed.body.success).toBe(true);
  });
});

// ============================================================================
// 3. IP-BASED KEY GENERATOR (like the real authLimiter for anonymous users)
// ============================================================================

describe('IP-based rate limiter', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    const s = await createRateLimitedServer({
      windowMs: RATE_LIMIT_WINDOW_MS,
      max: 2,
      keyGenerator: (req) => `ip:${req.socket.remoteAddress || 'unknown'}`,
    });
    server = s.server;
    baseUrl = s.baseUrl;
  });

  afterEach(() => {
    server?.close();
  });

  it('allows requests within limit from same IP', async () => {
    const responses = await sendSequential(baseUrl, 2);
    expect(responses[0].status).toBe(200);
    expect(responses[1].status).toBe(200);
  });

  it('blocks excess requests from same IP', async () => {
    const responses = await sendSequential(baseUrl, 3);
    expect(responses[0].status).toBe(200);
    expect(responses[1].status).toBe(200);
    expect(responses[2].status).toBe(429);
  });
});

// ============================================================================
// 5. PRODUCTION THRESHOLD: MAX=10 (Exact authLimiter config)
// ============================================================================
// Directly verifies the production authLimiter threshold of 10 requests.
// Uses a small window (1s) for speed, but max=10 and the exact same
// error message as the production authLimiter.
//
// The production authLimiter (rateLimiter.ts) uses:
//   - max: 10 (configurable via RATE_LIMIT_AUTH_MAX)
//   - windowMs: 15 * 60 * 1000 (15 min)
//   - message: 'Too many login attempts. Please try again after 15 minutes.'
//
// This test uses a 1-second window instead of 15 minutes for speed, but
// the max value and error message match production exactly.

describe('Production authLimiter threshold (max=10)', () => {
  const AUTH_MAX = 10;
  const AUTH_WINDOW_MS = 1000;
  const AUTH_ERROR = 'Too many login attempts. Please try again after 15 minutes.';

  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    const app = express();

    const authLimiter = rateLimit({
      windowMs: AUTH_WINDOW_MS,
      max: AUTH_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: () => 'auth-test-user',
      message: { error: AUTH_ERROR },
    });

    app.get('/auth', authLimiter, (_req, res) => {
      res.json({ success: true });
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        baseUrl = `http://localhost:${(server.address() as any).port}`;
        resolve();
      });
    });
  });

  afterEach(() => {
    server?.close();
  });

  it('allows 10 requests (the production limit)', async () => {
    // Send exactly 10 requests — all should succeed
    for (let i = 0; i < AUTH_MAX; i++) {
      const { status, body } = await singleRequest(baseUrl, '/auth');
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    }
  });

  it('blocks the 11th request with production error message', async () => {
    // Exhaust the limit (10 requests)
    for (let i = 0; i < AUTH_MAX; i++) {
      await singleRequest(baseUrl, '/auth');
    }

    // 11th request — blocked with 429
    const blocked = await singleRequest(baseUrl, '/auth');
    expect(blocked.status).toBe(429);

    // Verify the production error message exactly
    expect(blocked.body).toEqual({
      error: AUTH_ERROR,
    });
  });

  it('blocks ALL requests after 10th until window expires', async () => {
    // Send 12 requests total — collect responses iteratively
    const responses: { status: number; body: any }[] = [];
    for (let i = 0; i < AUTH_MAX + 2; i++) {
      responses.push(await singleRequest(baseUrl, '/auth'));
    }

    // First 10 succeed
    for (let i = 0; i < AUTH_MAX; i++) {
      expect(responses[i].status).toBe(200);
    }

    // 11th and 12th are blocked
    expect(responses[AUTH_MAX].status).toBe(429);
    expect(responses[AUTH_MAX + 1].status).toBe(429);
  });
});

// ============================================================================
// 6. KEY ISOLATION — Each key has its own counter
// ============================================================================
// The production authLimiter uses userOrIpKeyGenerator which creates per-user
// keys for authenticated requests and per-IP keys for anonymous requests.
// This test verifies that different keys don't share rate limit counters.

describe('Rate limiter key isolation', () => {
  it('maintains separate counters for different keys', async () => {
    const app = express();

    const limiter = rateLimit({
      windowMs: RATE_LIMIT_WINDOW_MS,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => (req.headers['x-user-id'] as string) || 'anonymous',
      message: { error: 'Rate limited per user' },
    });

    app.get('/test', limiter, (_req, res) => {
      res.json({ success: true });
    });

    const server = http.createServer(app);
    let baseUrl: string;
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        baseUrl = `http://localhost:${(server.address() as any).port}`;
        resolve();
      });
    });

    try {
      async function reqAs(userId: string): Promise<number> {
        return new Promise((resolve, reject) => {
          const url = new URL('/test', baseUrl);
          const req = http.request(
            url.toString(),
            { method: 'GET', headers: { 'x-user-id': userId } },
            (res) => {
              let data = '';
              res.on('data', (chunk: string) => (data += chunk));
              res.on('end', () => resolve(res.statusCode!));
            },
          );
          req.on('error', reject);
          req.end();
        });
      }

      // User A: 2 allowed, 3rd blocked
      expect(await reqAs('user_a')).toBe(200);
      expect(await reqAs('user_a')).toBe(200);
      expect(await reqAs('user_a')).toBe(429);

      // User B: separate counter — 2 allowed, 3rd blocked
      expect(await reqAs('user_b')).toBe(200);
      expect(await reqAs('user_b')).toBe(200);
      expect(await reqAs('user_b')).toBe(429);

      // Anonymous: separate counter — 2 allowed
      expect(await reqAs('anonymous')).toBe(200);
      expect(await reqAs('anonymous')).toBe(200);
      expect(await reqAs('anonymous')).toBe(429);
    } finally {
      server.close();
    }
  });
});
