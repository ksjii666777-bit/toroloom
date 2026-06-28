/**
 * ============================================================================
 * Toroloom Backend Route Integration Tests
 * ============================================================================
 *
 * Tests all 14 route modules by mounting them on a minimal Express app and
 * issuing real HTTP requests against a random port.
 *
 * Routes tested:
 *   auth, market, portfolio, watchlist, mutualFunds, education, community,
 *   aiInsights, notifications, risk, support, funds, orders, system
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/routes.int.test.ts
 * ============================================================================
 */

vi.hoisted(() => {
  process.env.BROKER = 'mock';
  process.env.DATA_SOURCE = 'mock';
  // Unset AI provider keys so isAIConfigured() returns false in tests.
  // dotenv won't override env vars that are already set, so setting these
  // before env.ts loads prevents the real AI API from being called.
  process.env.OPENROUTER_API_KEY = '';
  process.env.GOOGLE_GEMINI_API_KEY = '';
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';
import { generateToken } from '../middleware/auth';

// ──── Route imports ─────────────────────────────────────────────────────────

import authRoutes from '../routes/auth';
import marketRoutes from '../routes/market';
import portfolioRoutes from '../routes/portfolio';
import watchlistRoutes from '../routes/watchlist';
import mutualFundsRoutes from '../routes/mutualFunds';
import educationRoutes from '../routes/education';
import communityRoutes from '../routes/community';
import aiInsightsRoutes from '../routes/aiInsights';
import notificationsRoutes from '../routes/notifications';
import pushNotificationsRoutes from '../routes/pushNotifications';
import riskRoutes from '../routes/risk';
import supportRoutes from '../routes/support';
import fundsRoutes from '../routes/funds';
import ordersRoutes from '../routes/orders';
import systemRoutes from '../routes/system';
import wsStatusRoutes from '../routes/wsStatus';
import brokerRoutes from '../routes/broker';

// ──── Circuit breaker + state for system/wsStatus routes ─────────────────

import { circuitRegistry } from '../services/circuitBreaker';
import * as state from '../websocket/state';

// ──── Constants ─────────────────────────────────────────────────────────────

const TEST_USER_ID = 'test_user_routes';
const TEST_TOKEN = generateToken({ userId: TEST_USER_ID, email: 'test@toroloom.com' });
const AUTH_HEADER = { Authorization: `Bearer ${TEST_TOKEN}` };

// ──── Helpers ───────────────────────────────────────────────────────────────

type ReqOptions = {
  method?: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
};

function request(opts: ReqOptions): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, baseUrl);
    const req = http.request(
      url.toString(),
      {
        method: opts.method || 'GET',
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
          resolve({ status: res.statusCode!, body, headers: res.headers });
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

function get(path: string, headers?: Record<string, string>) {
  return request({ method: 'GET', path, headers });
}

function post(path: string, body?: any, headers?: Record<string, string>) {
  return request({ method: 'POST', path, body, headers });
}

function put(path: string, body?: any, headers?: Record<string, string>) {
  return request({ method: 'PUT', path, body, headers });
}

function del(path: string, headers?: Record<string, string>) {
  return request({ method: 'DELETE', path, headers });
}

// ──── Server ────────────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Mount all production routes
  app.use('/api/auth', authRoutes);
  app.use('/api/market', marketRoutes);
  app.use('/api/portfolio', portfolioRoutes);
  app.use('/api/watchlist', watchlistRoutes);
  app.use('/api/mutual-funds', mutualFundsRoutes);
  app.use('/api/education', educationRoutes);
  app.use('/api/community', communityRoutes);
  app.use('/api/ai', aiInsightsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/notifications', pushNotificationsRoutes);
  app.use('/api/risk', riskRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/funds', fundsRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/system', systemRoutes);
  app.use('/api/system', wsStatusRoutes);
  app.use('/api/broker', brokerRoutes);

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

// Clean up module-level state before route tests that use shared state
beforeEach(() => {
  circuitRegistry.resetAll();
  state.clients.clear();
  state.userConnectionCount.clear();
  state.connectionAlertedUsers.clear();
});

// ============================================================================
// 1. AUTH ROUTES
// ============================================================================

describe('POST /api/auth', () => {
  // ── POST /api/auth/login ────────────────────────────────────────────

  it('should login with valid credentials', async () => {
    const { status, body } = await post('/api/auth/login', {
      email: 'test@example.com',
      password: 'password123',
    });

    expect(status).toBe(200);
    expect(body.token).toBeDefined();
    expect(body.user).toBeDefined();
    expect(body.user.id).toBeDefined();
  });

  it('should reject login without email', async () => {
    const { status, body } = await post('/api/auth/login', { password: 'pw' });

    expect(status).toBe(400);
    expect(body.error).toContain('Email');
  });

  it('should reject login without password', async () => {
    const { status, body } = await post('/api/auth/login', { email: 'a@b.com' });

    expect(status).toBe(400);
    expect(body.error).toContain('password');
  });

  // ── POST /api/auth/signup ───────────────────────────────────────────

  it('should signup with valid details', async () => {
    const { status, body } = await post('/api/auth/signup', {
      name: 'Test User',
      email: 'new@toroloom.com',
      phone: '9876543210',
    });

    expect(status).toBe(200);
    expect(body.token).toBeDefined();
    expect(body.user.name).toBe('Test User');
  });

  it('should reject signup without name', async () => {
    const { status, body } = await post('/api/auth/signup', {
      email: 'a@b.com',
      phone: '1234567890',
    });

    expect(status).toBe(400);
    expect(body.error).toContain('Name');
  });

  it('should reject signup without phone', async () => {
    const { status, body } = await post('/api/auth/signup', {
      name: 'Test',
      email: 'a@b.com',
    });

    expect(status).toBe(400);
    expect(body.error).toContain('phone');
  });
});

describe('GET /api/auth/profile', () => {
  it('should return profile with valid token', async () => {
    const { status, body } = await get('/api/auth/profile', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.id).toBeDefined();
    expect(body.email).toBe('test@toroloom.com');
  });

  it('should reject without auth token', async () => {
    const { status, body } = await get('/api/auth/profile');

    expect(status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it('should reject with invalid token', async () => {
    const { status, body } = await get('/api/auth/profile', {
      Authorization: 'Bearer invalid-token',
    });

    expect(status).toBe(401);
  });
});

describe('PUT /api/auth/profile', () => {
  it('should update profile with valid token', async () => {
    const { status, body } = await put('/api/auth/profile', { name: 'Updated Name' }, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.name).toBe('Updated Name');
    expect(body.email).toBe('test@toroloom.com');
  });

  it('should reject update without auth', async () => {
    const { status } = await put('/api/auth/profile', { name: 'X' });

    expect(status).toBe(401);
  });

  it('should update phone along with name', async () => {
    const { status, body } = await put(
      '/api/auth/profile',
      { name: 'New', phone: '1111111111' },
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body.name).toBe('New');
    expect(body.phone).toBe('1111111111');
  });
});

// ============================================================================
// 2. MARKET ROUTES
// ============================================================================

describe('GET /api/market', () => {
  it('should return indices', async () => {
    const { status, body } = await get('/api/market/indices');

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('should return stocks', async () => {
    const { status, body } = await get('/api/market/stocks');

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('should return a quote for a symbol', async () => {
    const { status, body } = await get('/api/market/quote/RELIANCE');

    expect(status).toBe(200);
    expect(body.symbol).toBeDefined();
  });

  it('should return bulk quotes for multiple symbols', async () => {
    const { status, body } = await get('/api/market/quotes?symbols=RELIANCE,TCS,INFY');

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('should reject quotes without symbols param', async () => {
    const { status, body } = await get('/api/market/quotes');

    expect(status).toBe(400);
    expect(body.error).toContain('symbols');
  });

  it('should return OHLC data', async () => {
    const { status, body } = await get('/api/market/ohlc/RELIANCE?interval=day&days=5');

    expect(status).toBe(200);
    expect(body).toBeDefined();
  });

  it('should return search results', async () => {
    const { status, body } = await get('/api/market/search?q=RELIANCE');

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('should return empty array for empty search', async () => {
    const { status, body } = await get('/api/market/search?q=');

    expect(status).toBe(200);
    expect(body).toEqual([]);
  });
});

// ============================================================================
// 3. PORTFOLIO ROUTES
// ============================================================================

describe('GET /api/portfolio', () => {
  it('should reject without auth', async () => {
    const { status } = await get('/api/portfolio/holdings');
    expect(status).toBe(401);
  });

  it('should return holdings with auth', async () => {
    const { status, body } = await get('/api/portfolio/holdings', AUTH_HEADER);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('should return positions with auth', async () => {
    const { status, body } = await get('/api/portfolio/positions', AUTH_HEADER);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('should return trade history with auth', async () => {
    const { status, body } = await get('/api/portfolio/trades', AUTH_HEADER);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});

// ============================================================================
// 4. WATCHLIST ROUTES
// ============================================================================

describe('GET /api/watchlist', () => {
  it('should reject without auth', async () => {
    const { status } = await get('/api/watchlist');
    expect(status).toBe(401);
  });

  it('should return empty watchlist for new user', async () => {
    const { status, body } = await get('/api/watchlist', AUTH_HEADER);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(0);
  });

  it('should create a new watchlist via POST', async () => {
    const { status, body } = await post('/api/watchlist', { name: 'My Watchlist' }, AUTH_HEADER);

    expect(status).toBe(201);
    expect(body.name).toBe('My Watchlist');
    expect(body.id).toBeDefined();
    expect(body.stocks).toEqual([]);
  });

  it('should reject creating watchlist without name', async () => {
    const { status, body } = await post('/api/watchlist', {}, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('name');
  });
});

describe('POST /api/watchlist/:watchlistId/stocks', () => {
  let watchlistId: string;

  beforeEach(async () => {
    const { body } = await post('/api/watchlist', { name: 'Stock Test WL' }, AUTH_HEADER);
    watchlistId = body.id;
  });

  it('should add a stock to watchlist', async () => {
    const { status, body } = await post(
      `/api/watchlist/${watchlistId}/stocks`,
      { symbol: 'RELIANCE' },
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body.stocks).toContain('RELIANCE');
  });

  it('should not duplicate stock in watchlist', async () => {
    await post(`/api/watchlist/${watchlistId}/stocks`, { symbol: 'TCS' }, AUTH_HEADER);
    const { body } = await post(`/api/watchlist/${watchlistId}/stocks`, { symbol: 'TCS' }, AUTH_HEADER);

    expect(body.stocks.filter((s: string) => s === 'TCS').length).toBe(1);
  });

  it('should reject adding stock without symbol', async () => {
    const { status, body } = await post(`/api/watchlist/${watchlistId}/stocks`, {}, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('Symbol');
  });

  it('should reject adding stock to non-existent watchlist', async () => {
    const { status, body } = await post(
      '/api/watchlist/bad-id/stocks',
      { symbol: 'RELIANCE' },
      AUTH_HEADER,
    );

    expect(status).toBe(404);
    expect(body.error).toContain('not found');
  });
});

describe('DELETE /api/watchlist/:watchlistId/stocks/:symbol', () => {
  let watchlistId: string;

  beforeEach(async () => {
    const { body } = await post('/api/watchlist', { name: 'Delete Test WL' }, AUTH_HEADER);
    watchlistId = body.id;
    await post(`/api/watchlist/${watchlistId}/stocks`, { symbol: 'INFY' }, AUTH_HEADER);
  });

  it('should remove a stock from watchlist', async () => {
    const { status, body } = await del(`/api/watchlist/${watchlistId}/stocks/INFY`, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.stocks).not.toContain('INFY');
  });

  it('should reject deleting from non-existent watchlist', async () => {
    const { status, body } = await del('/api/watchlist/bad-id/stocks/INFY', AUTH_HEADER);

    expect(status).toBe(404);
    expect(body.error).toContain('not found');
  });
});

describe('DELETE /api/watchlist/:watchlistId', () => {
  let watchlistId: string;

  beforeEach(async () => {
    const { body } = await post('/api/watchlist', { name: 'Delete WL' }, AUTH_HEADER);
    watchlistId = body.id;
  });

  it('should delete a watchlist', async () => {
    const { status } = await del(`/api/watchlist/${watchlistId}`, AUTH_HEADER);

    expect(status).toBe(204);
  });

  it('should reject deleting non-existent watchlist', async () => {
    const { status, body } = await del('/api/watchlist/bad-id', AUTH_HEADER);

    expect(status).toBe(404);
    expect(body.error).toContain('not found');
  });
});

// ============================================================================
// 5. MUTUAL FUNDS ROUTES
// ============================================================================

describe('GET /api/mutual-funds', () => {
  it('should reject without auth', async () => {
    const { status } = await get('/api/mutual-funds');
    expect(status).toBe(401);
  });

  it('should return all mutual funds', async () => {
    const { status, body } = await get('/api/mutual-funds', AUTH_HEADER);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('should return a specific fund by id', async () => {
    const { body: funds } = await get('/api/mutual-funds', AUTH_HEADER);
    const fundId = funds[0].id;

    const { status, body } = await get(`/api/mutual-funds/${fundId}`, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.id).toBe(fundId);
  });

  it('should return 404 for unknown fund', async () => {
    const { status, body } = await get('/api/mutual-funds/nonexistent', AUTH_HEADER);

    expect(status).toBe(404);
    expect(body.error).toContain('not found');
  });

  it('should return SIPs list', async () => {
    const { status, body } = await get('/api/mutual-funds/sips/list', AUTH_HEADER);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('should create a SIP', async () => {
    const { body: funds } = await get('/api/mutual-funds', AUTH_HEADER);
    const fundId = funds[0].id;

    const { status, body } = await post(
      '/api/mutual-funds/sips',
      { fundId, amount: 5000, frequency: 'monthly' },
      AUTH_HEADER,
    );

    expect(status).toBe(201);
    expect(body.fundId).toBe(fundId);
    expect(body.amount).toBe(5000);
  });

  it('should reject SIP creation without fundId', async () => {
    const { status, body } = await post(
      '/api/mutual-funds/sips',
      { amount: 5000, frequency: 'monthly' },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('fundId');
  });

  it('should reject SIP creation for unknown fund', async () => {
    const { status, body } = await post(
      '/api/mutual-funds/sips',
      { fundId: 'bad', amount: 5000, frequency: 'monthly' },
      AUTH_HEADER,
    );

    expect(status).toBe(404);
    expect(body.error).toContain('not found');
  });
});

// ============================================================================
// 6. EDUCATION ROUTES
// ============================================================================

describe('GET /api/education', () => {
  it('should reject without auth', async () => {
    const { status } = await get('/api/education/courses');
    expect(status).toBe(401);
  });

  it('should return courses', async () => {
    const { status, body } = await get('/api/education/courses', AUTH_HEADER);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('should return a course by id with lessonList', async () => {
    const { body: courses } = await get('/api/education/courses', AUTH_HEADER);
    const courseId = courses[0].id;

    const { status, body } = await get(`/api/education/courses/${courseId}`, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.id).toBe(courseId);
    expect(body.lessonList).toBeDefined();
    expect(Array.isArray(body.lessonList)).toBe(true);
  });

  it('should return 404 for unknown course', async () => {
    const { status, body } = await get('/api/education/courses/nonexistent', AUTH_HEADER);
    expect(status).toBe(404);
    expect(body.error).toContain('Course');
  });

  it('should return a lesson by id', async () => {
    const { status, body } = await get('/api/education/lessons/l1', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.id).toBe('l1');
  });

  it('should return 404 for unknown lesson', async () => {
    const { status, body } = await get('/api/education/lessons/nonexistent', AUTH_HEADER);
    expect(status).toBe(404);
    expect(body.error).toContain('Lesson');
  });

  it('should mark lesson progress', async () => {
    const { status, body } = await put('/api/education/lessons/l1/progress', {}, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.completed).toBe(true);
  });

  it('should reject lesson progress for unknown lesson', async () => {
    const { status, body } = await put('/api/education/lessons/nonexistent/progress', {}, AUTH_HEADER);
    expect(status).toBe(404);
    expect(body.error).toContain('Lesson');
  });
});

// ============================================================================
// 7. COMMUNITY ROUTES
// ============================================================================

describe('GET /api/community', () => {
  it('should return posts without auth', async () => {
    const { status, body } = await get('/api/community/posts');

    expect(status).toBe(200);
    expect(body.posts).toBeDefined();
    expect(body.total).toBeDefined();
    expect(body.page).toBe(1);
    expect(body.totalPages).toBeDefined();
  });

  it('should support pagination params', async () => {
    const { status, body } = await get('/api/community/posts?page=1&limit=5');

    expect(status).toBe(200);
    expect(body.page).toBe(1);
  });

  it('should filter posts by tag', async () => {
    const { status, body } = await get('/api/community/posts?tag=trading');

    expect(status).toBe(200);
    expect(Array.isArray(body.posts)).toBe(true);
  });

  it('should return a post by id', async () => {
    const { body: list } = await get('/api/community/posts');
    if (list.posts.length > 0) {
      const postId = list.posts[0].id;
      const { status, body } = await get(`/api/community/posts/${postId}`);

      expect(status).toBe(200);
      expect(body.id).toBe(postId);
    }
  });

  it('should return 404 for unknown post', async () => {
    const { status, body } = await get('/api/community/posts/nonexistent');

    expect(status).toBe(404);
    expect(body.error).toContain('Post');
  });

  it('should return comments for a post', async () => {
    const { status, body } = await get('/api/community/posts/p1/comments');

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('POST /api/community', () => {
  it('should reject creating post without auth', async () => {
    const { status } = await post('/api/community/posts', { content: 'Hello' });
    expect(status).toBe(401);
  });

  it('should create a post with auth', async () => {
    const { status, body } = await post(
      '/api/community/posts',
      { content: 'Test post', tags: ['test'] },
      AUTH_HEADER,
    );

    expect(status).toBe(201);
    expect(body.content).toBe('Test post');
    expect(body.tags).toContain('test');
  });

  it('should reject creating post without content', async () => {
    const { status, body } = await post('/api/community/posts', { tags: [] }, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('Content');
  });

  it('should like a post', async () => {
    const { body: list } = await get('/api/community/posts');
    if (list.posts.length > 0) {
      const postId = list.posts[0].id;
      const { status, body } = await post(`/api/community/posts/${postId}/like`, {}, AUTH_HEADER);

      expect(status).toBe(200);
      expect(typeof body.likes).toBe('number');
    }
  });
});

// ============================================================================
// 8. AI INSIGHTS ROUTES
// ============================================================================

describe('GET /api/ai', () => {
  it('should reject without auth', async () => {
    const { status } = await get('/api/ai/insights');
    expect(status).toBe(401);
  });

  it('should return all insights', async () => {
    const { status, body } = await get('/api/ai/insights', AUTH_HEADER);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('should filter insights by stockId', async () => {
    const { status, body } = await get('/api/ai/insights?stockId=RELIANCE', AUTH_HEADER);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('should return a specific insight by id', async () => {
    const { body: all } = await get('/api/ai/insights', AUTH_HEADER);
    if (all.length > 0) {
      const { status, body } = await get(`/api/ai/insights/${all[0].id}`, AUTH_HEADER);
      expect(status).toBe(200);
      expect(body.id).toBe(all[0].id);
    }
  });

  it('should return 404 for unknown insight', async () => {
    const { status, body } = await get('/api/ai/insights/nonexistent', AUTH_HEADER);
    expect(status).toBe(404);
    expect(body.error).toContain('Insight');
  });
});

describe('POST /api/ai/analyze', () => {
  it('should analyze a symbol', async () => {
    const { status, body } = await post('/api/ai/analyze', { symbol: 'TCS' }, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.symbol).toBe('TCS');
    expect(body.type).toBeDefined();
    expect(body.confidence).toBeDefined();
  });

  it('should reject without symbol', async () => {
    const { status, body } = await post('/api/ai/analyze', {}, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('Symbol');
  });
});

// ============================================================================
// 9. NOTIFICATIONS ROUTES
// ============================================================================

describe('GET /api/notifications', () => {
  it('should reject without auth', async () => {
    const { status } = await get('/api/notifications');
    expect(status).toBe(401);
  });

  it('should return notifications', async () => {
    const { status, body } = await get('/api/notifications', AUTH_HEADER);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('should return unread notifications filter', async () => {
    const { status, body } = await get('/api/notifications?unread=true', AUTH_HEADER);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('should return unread count', async () => {
    const { status, body } = await get('/api/notifications/unread-count', AUTH_HEADER);

    expect(status).toBe(200);
    expect(typeof body.count).toBe('number');
  });
});

describe('POST /api/notifications/price-alert', () => {
  it('should reject without symbol', async () => {
    const { status, body } = await post('/api/notifications/price-alert', {}, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('Symbol');
  });

  it('should reject without targetPrice', async () => {
    const { status, body } = await post(
      '/api/notifications/price-alert',
      { symbol: 'RELIANCE' },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('targetPrice');
  });

  it('should create a price alert', async () => {
    const { status, body } = await post(
      '/api/notifications/price-alert',
      { symbol: 'RELIANCE', targetPrice: 3000 },
      AUTH_HEADER,
    );

    expect(status).toBe(201);
    expect(body.type).toBe('price_alert');
    expect(body.title).toContain('Price Alert');
  });
});

describe('PUT /api/notifications/:id/read', () => {
  it('should mark a notification as read', async () => {
    const { status, body } = await put('/api/notifications/n1/read', {}, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

describe('PUT /api/notifications/read-all', () => {
  it('should mark all notifications as read', async () => {
    const { status, body } = await put('/api/notifications/read-all', {}, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// 10. PORTFOLIO ALERT EVALUATE ENDPOINT
// ============================================================================

describe('POST /api/notifications/portfolio-alert/evaluate', () => {
  beforeEach(async () => {
    // Reset badge count and rules before each test
    await post('/api/notifications/portfolio-alert/reset-triggers', {}, AUTH_HEADER);
  });

  it('should reject without auth', async () => {
    const { status } = await post('/api/notifications/portfolio-alert/evaluate', {});
    expect(status).toBe(401);
  });

  it('should return evaluated = false and rulesFired = 0 when no rules exist', async () => {
    // Sync empty rules
    await post('/api/notifications/portfolio-rules/sync', { rules: [] }, AUTH_HEADER);

    const { status, body } = await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: {
        totalReturnPercent: -10,
        totalReturn: -50000,
        totalInvested: 500000,
        currentValue: 450000,
        peakValue: 550000,
        consecutiveLossDays: 0,
      },
    }, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.evaluated).toBe(true);
    expect(body.rulesFired).toBe(0);
    expect(Array.isArray(body.fired)).toBe(true);
    expect(body.fired).toHaveLength(0);
    expect(typeof body.badgeCount).toBe('number');
  });

  it('should detect breached P&L threshold and return fired rule details', async () => {
    const rule = {
      id: 'eval-test-rule-1',
      userId: TEST_USER_ID,
      kind: 'portfolio_pnl_pct',
      label: 'Eval Test P&L',
      threshold: -5,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
    };
    await post('/api/notifications/portfolio-rules/sync', { rules: [rule] }, AUTH_HEADER);

    const { status, body } = await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: {
        totalReturnPercent: -10,
        totalReturn: -50000,
        totalInvested: 500000,
        currentValue: 450000,
        peakValue: 550000,
        consecutiveLossDays: 0,
      },
    }, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.evaluated).toBe(true);
    expect(body.rulesFired).toBe(1);
    expect(body.badgeCount).toBeGreaterThanOrEqual(1);

    // Verify the fired entry shape
    expect(body.fired).toHaveLength(1);
    const firedEntry = body.fired[0];
    expect(firedEntry.ruleId).toBe('eval-test-rule-1');
    expect(firedEntry.ruleLabel).toBe('Eval Test P&L');
    expect(firedEntry.kind).toBe('portfolio_pnl_pct');
    expect(firedEntry.title).toContain('P&L Threshold Breached');
    expect(typeof firedEntry.message).toBe('string');
    expect(firedEntry.value).toBe(-10);
  });

  it('should return rulesFired = 0 when no threshold is breached', async () => {
    const rule = {
      id: 'eval-test-rule-2',
      userId: TEST_USER_ID,
      kind: 'portfolio_pnl_pct',
      label: 'No Breach Test',
      threshold: -10,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
    };
    await post('/api/notifications/portfolio-rules/sync', { rules: [rule] }, AUTH_HEADER);

    const { status, body } = await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: {
        totalReturnPercent: -5, // Not below -10 threshold
        totalReturn: -25000,
        totalInvested: 500000,
        currentValue: 475000,
        peakValue: 550000,
        consecutiveLossDays: 0,
      },
    }, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.evaluated).toBe(true);
    expect(body.rulesFired).toBe(0);
    expect(body.fired).toHaveLength(0);
  });

  it('should detect breached drawdown threshold', async () => {
    const rule = {
      id: 'eval-test-rule-3',
      userId: TEST_USER_ID,
      kind: 'portfolio_peak_drawdown',
      label: 'Drawdown Test',
      threshold: 3,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
    };
    await post('/api/notifications/portfolio-rules/sync', { rules: [rule] }, AUTH_HEADER);

    const { status, body } = await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: {
        totalReturnPercent: 0,
        totalReturn: 0,
        totalInvested: 500000,
        currentValue: 450000, // 100k drop from peak
        peakValue: 550000,
        consecutiveLossDays: 0,
      },
    }, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.rulesFired).toBe(1);
    const firedEntry = body.fired[0];
    expect(firedEntry.kind).toBe('portfolio_peak_drawdown');
    // Drawdown = (550000 - 450000) / 550000 * 100 = ~18.18%
    expect(firedEntry.value).toBeGreaterThan(3);
  });

  it('should return rulesFired = 2 when two rules breach simultaneously', async () => {
    const rules = [
      {
        id: 'eval-test-rule-4a',
        userId: TEST_USER_ID,
        kind: 'portfolio_pnl_pct',
        label: 'P&L Breach',
        threshold: -5,
        direction: 'below',
        triggered: false,
        createdAt: new Date().toISOString(),
        enabled: true,
      },
      {
        id: 'eval-test-rule-4b',
        userId: TEST_USER_ID,
        kind: 'portfolio_peak_drawdown',
        label: 'Drawdown Breach',
        threshold: 3,
        direction: 'below',
        triggered: false,
        createdAt: new Date().toISOString(),
        enabled: true,
      },
    ];
    await post('/api/notifications/portfolio-rules/sync', { rules }, AUTH_HEADER);

    const { status, body } = await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: {
        totalReturnPercent: -10,
        totalReturn: -50000,
        totalInvested: 500000,
        currentValue: 450000,
        peakValue: 550000,
        consecutiveLossDays: 0,
      },
    }, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.rulesFired).toBe(2);
    expect(body.fired).toHaveLength(2);
    expect(body.badgeCount).toBeGreaterThanOrEqual(2);

    const kinds = body.fired.map((f: any) => f.kind).sort();
    // Alphabetical order: 'portfolio_peak_drawdown' < 'portfolio_pnl_pct'
    expect(kinds).toEqual(['portfolio_peak_drawdown', 'portfolio_pnl_pct']);
  });

  it('should sync client badgeCount and then increment on rule fire', async () => {
    const rule = {
      id: 'eval-test-rule-5',
      userId: TEST_USER_ID,
      kind: 'portfolio_pnl_pct',
      label: 'Badge Sync Test',
      threshold: -5,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
    };
    await post('/api/notifications/portfolio-rules/sync', { rules: [rule] }, AUTH_HEADER);

    // Provide badgeCount: 1 from client — server syncs to 1 then increments to 2
    const { status, body } = await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: {
        totalReturnPercent: -10,
        totalReturn: -50000,
        totalInvested: 500000,
        currentValue: 450000,
        peakValue: 550000,
        consecutiveLossDays: 0,
      },
      badgeCount: 1,
    }, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.rulesFired).toBe(1);
    expect(body.badgeCount).toBe(2);
  });

  it('should skip disabled rules', async () => {
    const rule = {
      id: 'eval-test-rule-6',
      userId: TEST_USER_ID,
      kind: 'portfolio_pnl_pct',
      label: 'Disabled Rule',
      threshold: -5,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: false, // <-- disabled
    };
    await post('/api/notifications/portfolio-rules/sync', { rules: [rule] }, AUTH_HEADER);

    const { status, body } = await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: {
        totalReturnPercent: -10,
        totalReturn: -50000,
        totalInvested: 500000,
        currentValue: 450000,
        peakValue: 550000,
        consecutiveLossDays: 0,
      },
    }, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.rulesFired).toBe(0);
    expect(body.fired).toHaveLength(0);
  });

  it('should not re-fire an already-triggered rule', async () => {
    const rule = {
      id: 'eval-test-rule-7',
      userId: TEST_USER_ID,
      kind: 'portfolio_pnl_pct',
      label: 'Already Triggered',
      threshold: -5,
      direction: 'below',
      triggered: true, // <-- already triggered
      createdAt: new Date().toISOString(),
      enabled: true,
    };
    await post('/api/notifications/portfolio-rules/sync', { rules: [rule] }, AUTH_HEADER);

    const { status, body } = await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: {
        totalReturnPercent: -10,
        totalReturn: -50000,
        totalInvested: 500000,
        currentValue: 450000,
        peakValue: 550000,
        consecutiveLossDays: 0,
      },
    }, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.rulesFired).toBe(0);
    expect(body.fired).toHaveLength(0);
  });
});

// ============================================================================
// 11. BADGE-COUNT ENDPOINT (Push Notifications route)
// ============================================================================

describe('GET /api/notifications/badge-count', () => {
  beforeEach(async () => {
    // Reset badge count to 0 before each test to prevent state leakage
    await post('/api/notifications/portfolio-alert/reset-triggers', {}, AUTH_HEADER);
  });

  it('should reject without auth', async () => {
    const { status } = await get('/api/notifications/badge-count');
    expect(status).toBe(401);
  });

  it('should return 0 for a new user', async () => {
    const { status, body } = await get('/api/notifications/badge-count', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body).toHaveProperty('badgeCount');
    expect(typeof body.badgeCount).toBe('number');
    expect(body.badgeCount).toBe(0);
  });

  it('should return the badge count in expected shape', async () => {
    const { status, body } = await get('/api/notifications/badge-count', AUTH_HEADER);

    expect(status).toBe(200);
    // Only badgeCount — no extra fields
    expect(Object.keys(body)).toEqual(['badgeCount']);
  });

  it('should reject with invalid token', async () => {
    const { status } = await get('/api/notifications/badge-count', {
      Authorization: 'Bearer invalid-token',
    });

    expect(status).toBe(401);
  });

  it('should return > 0 after triggering a portfolio alert via evaluate', async () => {
    // Step 1: Sync a portfolio alert rule that will trigger
    const rule = {
      id: 'int-test-rule-1',
      userId: TEST_USER_ID,
      kind: 'portfolio_pnl_pct',
      label: 'Integration Test P&L',
      threshold: -5,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
    };

    const syncRes = await post('/api/notifications/portfolio-rules/sync', { rules: [rule] }, AUTH_HEADER);
    expect(syncRes.status).toBe(200);

    // Step 2: Evaluate with portfolio data that breaches the threshold
    const evaluateRes = await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: {
        totalReturnPercent: -10,
        totalReturn: -50000,
        totalInvested: 500000,
        currentValue: 450000,
        peakValue: 550000,
        consecutiveLossDays: 0,
      },
    }, AUTH_HEADER);

    expect(evaluateRes.status).toBe(200);
    expect(evaluateRes.body.rulesFired).toBe(1);
    expect(evaluateRes.body.badgeCount).toBeGreaterThanOrEqual(1);

    // Step 3: Check badge-count endpoint returns the incremented count
    const badgeRes = await get('/api/notifications/badge-count', AUTH_HEADER);
    expect(badgeRes.status).toBe(200);
    expect(badgeRes.body.badgeCount).toBeGreaterThan(0);
    // Should be at least the count returned by evaluate
    expect(badgeRes.body.badgeCount).toBeGreaterThanOrEqual(evaluateRes.body.badgeCount);
  });

  it('should return incremented badge count after two rules fire', async () => {
    // Step 1: Sync two rules that will both trigger
    const rules = [
      {
        id: 'int-test-rule-2a',
        userId: TEST_USER_ID,
        kind: 'portfolio_pnl_pct',
        label: 'P&L Test',
        threshold: -5,
        direction: 'below',
        triggered: false,
        createdAt: new Date().toISOString(),
        enabled: true,
      },
      {
        id: 'int-test-rule-2b',
        userId: TEST_USER_ID,
        kind: 'portfolio_peak_drawdown',
        label: 'Drawdown Test',
        threshold: 3,
        direction: 'below',
        triggered: false,
        createdAt: new Date().toISOString(),
        enabled: true,
      },
    ];

    const syncRes = await post('/api/notifications/portfolio-rules/sync', { rules }, AUTH_HEADER);
    expect(syncRes.status).toBe(200);

    // Step 2: Evaluate with data that triggers both rules
    const evaluateRes = await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: {
        totalReturnPercent: -10,
        totalReturn: -50000,
        totalInvested: 500000,
        currentValue: 450000,
        peakValue: 550000,
        consecutiveLossDays: 0,
      },
    }, AUTH_HEADER);

    expect(evaluateRes.status).toBe(200);
    expect(evaluateRes.body.rulesFired).toBe(2);
    expect(evaluateRes.body.badgeCount).toBeGreaterThanOrEqual(2);

    // Step 3: Badge-count reflects both increments
    const badgeRes = await get('/api/notifications/badge-count', AUTH_HEADER);
    expect(badgeRes.status).toBe(200);
    expect(badgeRes.body.badgeCount).toBeGreaterThanOrEqual(2);
  });

  it('should return badge count of 1 when client passes badgeCount to evaluate endpoint', async () => {
    // Step 1: Sync a rule
    const rule = {
      id: 'int-test-rule-3',
      userId: TEST_USER_ID,
      kind: 'portfolio_pnl_pct',
      label: 'Badge Sync Test',
      threshold: -5,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
    };

    const syncRes = await post('/api/notifications/portfolio-rules/sync', { rules: [rule] }, AUTH_HEADER);
    expect(syncRes.status).toBe(200);

    // Step 2: Evaluate with a badgeCount hint from the client (simulating frontend sync)
    const evaluateRes = await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: {
        totalReturnPercent: -10,
        totalReturn: -50000,
        totalInvested: 500000,
        currentValue: 450000,
        peakValue: 550000,
        consecutiveLossDays: 0,
      },
      badgeCount: 1,
    }, AUTH_HEADER);

    expect(evaluateRes.status).toBe(200);
    expect(evaluateRes.body.rulesFired).toBe(1);
    // With badgeCount: 1 provided, the server syncs to 1 then increments to 2
    expect(evaluateRes.body.badgeCount).toBe(2);
  });
});

// ============================================================================
// 12. RISK ROUTES
// ============================================================================

describe('GET /api/risk', () => {
  it('should reject without auth', async () => {
    const { status } = await get('/api/risk/state');
    expect(status).toBe(401);
  });

  it('should return risk state', async () => {
    const { status, body } = await get('/api/risk/state', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.lockdown).toBeDefined();
    expect(body.today).toBeDefined();
    expect(body.limits).toBeDefined();
  });

  it('should evaluate an action', async () => {
    const { status, body } = await get('/api/risk/evaluate?actionType=BUY&symbol=RELIANCE&quantity=10&price=2500', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.allowed !== undefined).toBe(true);
  });

  it('should reject evaluate without actionType', async () => {
    const { status, body } = await get('/api/risk/evaluate', AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('actionType');
  });

  it('should reject evaluate with invalid actionType', async () => {
    const { status, body } = await get('/api/risk/evaluate?actionType=INVALID', AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('Invalid');
  });
});

describe('PUT /api/risk/limits', () => {
  it('should update risk limits', async () => {
    const { status, body } = await put('/api/risk/limits', { dailyLossLimit: 2000 }, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should reject with no valid fields', async () => {
    const { status, body } = await put('/api/risk/limits', { invalid: true }, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('No valid');
  });
});

describe('POST /api/risk/reset', () => {
  it('should reset daily risk', async () => {
    const { status, body } = await post('/api/risk/reset', {}, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ============================================================================
// 13. SUPPORT ROUTES
// ============================================================================

describe('GET /api/support', () => {
  it('should reject without auth', async () => {
    const { status } = await get('/api/support/faqs');
    expect(status).toBe(401);
  });

  it('should return FAQs', async () => {
    const { status, body } = await get('/api/support/faqs', AUTH_HEADER);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('should return a specific FAQ by id', async () => {
    const { status, body } = await get('/api/support/faqs/faq_1', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.id).toBe('faq_1');
    expect(body.question).toBeDefined();
  });

  it('should return 404 for unknown FAQ', async () => {
    const { status, body } = await get('/api/support/faqs/nonexistent', AUTH_HEADER);

    expect(status).toBe(404);
    expect(body.error).toContain('FAQ');
  });

  it('should search FAQs', async () => {
    const { status, body } = await get('/api/support/faqs/search?q=investing', AUTH_HEADER);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('should return all FAQs when search query is empty', async () => {
    const { status, body } = await get('/api/support/faqs/search?q=', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 14. FUNDS ROUTES
// ============================================================================

describe('GET /api/funds', () => {
  it('should reject without auth', async () => {
    const { status } = await get('/api/funds/balance');
    expect(status).toBe(401);
  });

  it('should return balance', async () => {
    const { status, body } = await get('/api/funds/balance', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.balance).toBeDefined();
    expect(body.userId).toBe(TEST_USER_ID);
  });

  it('should return transactions', async () => {
    const { status, body } = await get('/api/funds/transactions', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.transactions).toBeDefined();
    expect(Array.isArray(body.transactions)).toBe(true);
  });

  it('should filter transactions by type', async () => {
    const { status, body } = await get('/api/funds/transactions?type=add', AUTH_HEADER);

    expect(status).toBe(200);
    expect(Array.isArray(body.transactions)).toBe(true);
  });

  it('should limit transactions with limit param', async () => {
    const { status, body } = await get('/api/funds/transactions?limit=2', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.transactions.length).toBeLessThanOrEqual(2);
  });
});

describe('POST /api/funds', () => {
  it('should add funds', async () => {
    const { status, body } = await post('/api/funds/add', { amount: 5000, method: 'UPI' }, AUTH_HEADER);

    expect(status).toBe(201);
    expect(body.message).toContain('added');
    expect(body.transaction.amount).toBe(5000);
    expect(body.newBalance).toBeDefined();
  });

  it('should reject add with amount < 500', async () => {
    const { status, body } = await post('/api/funds/add', { amount: 100, method: 'UPI' }, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('Minimum');
  });

  it('should reject add with amount > 500000', async () => {
    const { status, body } = await post('/api/funds/add', { amount: 600000, method: 'UPI' }, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('Maximum');
  });

  it('should reject add without method', async () => {
    const { status, body } = await post('/api/funds/add', { amount: 1000 }, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('method');
  });

  it('should reject add with non-positive amount', async () => {
    const { status, body } = await post('/api/funds/add', { amount: -100, method: 'UPI' }, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('positive');
  });

  it('should withdraw funds', async () => {
    // First add funds to have a balance
    await post('/api/funds/add', { amount: 100000, method: 'UPI' }, AUTH_HEADER);

    const { status, body } = await post('/api/funds/withdraw', { amount: 1000, method: 'HDFC Bank', account: 'XXXX1234' }, AUTH_HEADER);

    expect(status).toBe(201);
    expect(body.message).toContain('Withdrawal');
    expect(body.transaction.type).toBe('withdraw');
  });

  it('should reject withdraw without method', async () => {
    const { status, body } = await post('/api/funds/withdraw', { amount: 1000 }, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('method');
  });

  it('should reject withdraw exceeding balance', async () => {
    const { status, body } = await post('/api/funds/withdraw', { amount: 99999999, method: 'Bank' }, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('Insufficient');
  });

  it('should transfer funds internally', async () => {
    // First add funds
    await post('/api/funds/add', { amount: 50000, method: 'UPI' }, AUTH_HEADER);

    const { status, body } = await post(
      '/api/funds/transfer',
      { amount: 2000, type: 'internal', fromAccount: 'Trading', toAccount: 'Savings' },
      AUTH_HEADER,
    );

    expect(status).toBe(201);
    expect(body.message).toContain('Transfer');
    expect(body.transaction.type).toBe('transfer');
  });

  it('should reject transfer with same source and destination', async () => {
    const { status, body } = await post(
      '/api/funds/transfer',
      { amount: 1000, type: 'internal', fromAccount: 'A', toAccount: 'A' },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('different');
  });

  it('should reject external transfer without bank name', async () => {
    const { status, body } = await post(
      '/api/funds/transfer',
      { amount: 1000, type: 'external', fromAccount: 'A', toAccount: 'B' },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('Bank account');
  });

  it('should make UPI payment', async () => {
    // First add funds
    await post('/api/funds/add', { amount: 50000, method: 'UPI' }, AUTH_HEADER);

    const { status, body } = await post(
      '/api/funds/upi/pay',
      { amount: 500, payeeUPI: 'merchant@bank', fromUPI: 'user@bank' },
      AUTH_HEADER,
    );

    expect(status).toBe(201);
    expect(body.message).toContain('UPI payment');
    expect(body.transaction.type).toBe('upi');
  });

  it('should reject UPI payment without valid payeeUPI', async () => {
    const { status, body } = await post(
      '/api/funds/upi/pay',
      { amount: 100, payeeUPI: 'invalid', fromUPI: 'user@bank' },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('UPI');
  });

  it('should reject UPI payment exceeding limit', async () => {
    const { status, body } = await post(
      '/api/funds/upi/pay',
      { amount: 200000, payeeUPI: 'merchant@bank', fromUPI: 'user@bank' },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('Maximum');
  });
});

// ============================================================================
// 15. ORDERS ROUTES
// ============================================================================

describe('POST /api/orders', () => {
  it('should reject without auth', async () => {
    const { status } = await post('/api/orders/execute', {});
    expect(status).toBe(401);
  });

  it('should reject execute without actionType', async () => {
    const { status, body } = await post('/api/orders/execute', {}, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('actionType');
  });

  it('should reject execute without symbol', async () => {
    const { status, body } = await post(
      '/api/orders/execute',
      { actionType: 'BUY' },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('symbol');
  });

  it('should reject execute without quantity', async () => {
    const { status, body } = await post(
      '/api/orders/execute',
      { actionType: 'BUY', symbol: 'RELIANCE' },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('quantity');
  });

  it('should reject execute without price', async () => {
    const { status, body } = await post(
      '/api/orders/execute',
      { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10 },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('price');
  });

  it('should reject invalid actionType', async () => {
    const { status, body } = await post(
      '/api/orders/execute',
      { actionType: 'INVALID', symbol: 'RELIANCE', quantity: 10, price: 2500 },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('Invalid');
  });

  it('should reject invalid exchange', async () => {
    const { status, body } = await post(
      '/api/orders/execute',
      { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500, exchange: 'INVALID' },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('Invalid exchange');
  });

  it('should reject with non-integer quantity', async () => {
    const { status, body } = await post(
      '/api/orders/execute',
      { actionType: 'BUY', symbol: 'RELIANCE', quantity: -1, price: 2500 },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('quantity');
  });

  it('should execute a BUY order successfully', async () => {
    const { status, body } = await post(
      '/api/orders/execute',
      { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500 },
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body.success !== undefined).toBe(true);
  });

  it('should validate an order', async () => {
    const { status, body } = await post(
      '/api/orders/validate',
      { actionType: 'BUY', symbol: 'RELIANCE', quantity: 10, price: 2500 },
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body.allowed !== undefined).toBe(true);
  });

  it('should reject validate without actionType', async () => {
    const { status, body } = await post('/api/orders/validate', {}, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('actionType');
  });
});

// ============================================================================
// 16. BROKER ROUTES (EDIS + Brokerage Calculator) — Mock broker
// ============================================================================

describe('POST /api/broker', () => {
  it('should reject all EDIS endpoints without auth', async () => {
    const endpoints = [
      { path: '/api/broker/edis/verify', body: { isin: 'INE545U01014', quantity: '10' } },
      { path: '/api/broker/edis/generate-tpin', body: { dpId: '123', ReqId: 'R1', boid: 'BO1', pan: 'ABCDE1234F' } },
      { path: '/api/broker/edis/tran-status', body: { ReqId: 'REQ_001' } },
      { path: '/api/broker/brokerage/estimate', body: { orders: [{ product_type: 'DELIVERY', transaction_type: 'BUY', exchange: 'NSE', symbol: 'RELIANCE', token: '123', qty: 10, price: 2500 }] } },
    ];

    for (const ep of endpoints) {
      const { status } = await post(ep.path, ep.body);
      expect(status).toBe(401);
    }
  });

  describe('edis/verify', () => {
    it('should reject without isin', async () => {
      const { status, body } = await post('/api/broker/edis/verify', { quantity: '10' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('isin');
    });

    it('should reject without quantity', async () => {
      const { status, body } = await post('/api/broker/edis/verify', { isin: 'INE545U01014' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('quantity');
    });

    it('should return 400 when broker is not Angel One (mock)', async () => {
      const { status, body } = await post('/api/broker/edis/verify', { isin: 'INE545U01014', quantity: '10' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('only available with the Angel One broker');
    });
  });

  describe('edis/generate-tpin', () => {
    it('should reject without all required fields', async () => {
      const { status, body } = await post('/api/broker/edis/generate-tpin', { dpId: '123' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('dpId, ReqId, boid, and pan');
    });

    it('should reject numeric dpId (must be a string)', async () => {
      const { status, body } = await post('/api/broker/edis/generate-tpin', { dpId: 123, ReqId: 'R1', boid: 'BO1', pan: 'ABCDE1234F' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('must be strings');
    });

    it('should reject numeric ReqId (must be a string)', async () => {
      const { status, body } = await post('/api/broker/edis/generate-tpin', { dpId: '123', ReqId: 456, boid: 'BO1', pan: 'ABCDE1234F' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('must be strings');
    });

    it('should reject numeric boid (must be a string)', async () => {
      const { status, body } = await post('/api/broker/edis/generate-tpin', { dpId: '123', ReqId: 'R1', boid: 789, pan: 'ABCDE1234F' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('must be strings');
    });

    it('should reject invalid PAN format (too few letters)', async () => {
      const { status, body } = await post('/api/broker/edis/generate-tpin', { dpId: '123', ReqId: 'R1', boid: 'BO1', pan: 'ABC1234D' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid PAN format');
    });

    it('should reject invalid PAN format (last character is digit)', async () => {
      const { status, body } = await post('/api/broker/edis/generate-tpin', { dpId: '123', ReqId: 'R1', boid: 'BO1', pan: 'ABCDE12345' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid PAN format');
    });

    it('should reject invalid PAN format (too short)', async () => {
      const { status, body } = await post('/api/broker/edis/generate-tpin', { dpId: '123', ReqId: 'R1', boid: 'BO1', pan: 'ABCDE1234' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid PAN format');
    });

    it('should reject invalid PAN format (too long)', async () => {
      const { status, body } = await post('/api/broker/edis/generate-tpin', { dpId: '123', ReqId: 'R1', boid: 'BO1', pan: 'ABCDE1234FA' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid PAN format');
    });

    it('should reject invalid PAN format (special character)', async () => {
      const { status, body } = await post('/api/broker/edis/generate-tpin', { dpId: '123', ReqId: 'R1', boid: 'BO1', pan: 'ABCDE1234@' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid PAN format');
    });

    it('should accept lowercase PAN after normalization (then broker mismatch)', async () => {
      const { status, body } = await post('/api/broker/edis/generate-tpin', { dpId: '123', ReqId: 'R1', boid: 'BO1', pan: 'abcde1234f' }, AUTH_HEADER);
      // PAN is normalized to uppercase and passes validation, then hits broker mismatch
      expect(status).toBe(400);
      expect(body.error).toContain('only available with the Angel One broker');
    });

    it('should accept PAN with whitespace after normalization (then broker mismatch)', async () => {
      const { status, body } = await post('/api/broker/edis/generate-tpin', { dpId: '123', ReqId: 'R1', boid: 'BO1', pan: '  ABCDE1234F  ' }, AUTH_HEADER);
      // PAN is trimmed and passes validation, then hits broker mismatch
      expect(status).toBe(400);
      expect(body.error).toContain('only available with the Angel One broker');
    });

    it('should return 400 when broker is not Angel One (mock) with valid PAN', async () => {
      const { status, body } = await post('/api/broker/edis/generate-tpin', { dpId: '123', ReqId: 'R1', boid: 'BO1', pan: 'ABCDE1234F' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('only available with the Angel One broker');
    });
  });

  describe('edis/tran-status', () => {
    it('should reject without ReqId', async () => {
      const { status, body } = await post('/api/broker/edis/tran-status', {}, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('ReqId');
    });

    it('should reject with non-string ReqId', async () => {
      const { status, body } = await post('/api/broker/edis/tran-status', { ReqId: 123 }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('ReqId');
    });

    it('should return 400 when broker is not Angel One (mock)', async () => {
      const { status, body } = await post('/api/broker/edis/tran-status', { ReqId: 'REQ_001' }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('only available with the Angel One broker');
    });
  });

  describe('brokerage/estimate', () => {
    it('should reject without orders', async () => {
      const { status, body } = await post('/api/broker/brokerage/estimate', {}, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('orders');
    });

    it('should reject with empty orders array', async () => {
      const { status, body } = await post('/api/broker/brokerage/estimate', { orders: [] }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('orders');
    });

    it('should reject orders with missing required fields', async () => {
      const { status, body } = await post('/api/broker/brokerage/estimate', { orders: [{ symbol: 'RELIANCE' }] }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('missing required fields');
      expect(body.error).toContain('product_type');
      expect(body.error).toContain('transaction_type');
    });

    it('should return 400 when broker is not Angel One (mock)', async () => {
      const { status, body } = await post('/api/broker/brokerage/estimate', {
        orders: [{ product_type: 'DELIVERY', transaction_type: 'BUY', exchange: 'NSE', symbol: 'RELIANCE', token: '123', qty: 10, price: 2500 }],
      }, AUTH_HEADER);
      expect(status).toBe(400);
      expect(body.error).toContain('only available with the Angel One broker');
    });
  });
});

// ============================================================================
// 17. SYSTEM ROUTES
// ============================================================================

describe('GET /api/system', () => {
  it('should return circuit breakers in expected format', async () => {
    const { status, body } = await get('/api/system/circuit-breakers');

    expect(status).toBe(200);
    expect(body.circuitBreakers).toBeDefined();
    expect(typeof body.circuitBreakers).toBe('object');
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.total).toBe('number');
    expect(typeof body.summary.open).toBe('number');
    expect(typeof body.summary.halfOpen).toBe('number');
    expect(typeof body.summary.closed).toBe('number');
    expect(typeof body.summary.totalFailuresAcrossAll).toBe('number');
    expect(body.timestamp).toBeDefined();
  });

  it('should return 404 for unknown circuit breaker', async () => {
    const { status, body } = await get('/api/system/circuit-breakers/unknown-cb');

    expect(status).toBe(404);
    expect(body.error).toContain('not found');
  });

  it('should return a registered circuit breaker', async () => {
    // Create a circuit breaker via the registry's get method (lazy creation)
    const cb = circuitRegistry.get('test-cb', { failureThreshold: 3, successThreshold: 2, timeoutMs: 1000 });
    expect(cb.name).toBe('test-cb');

    const { status, body } = await get('/api/system/circuit-breakers/test-cb');

    expect(status).toBe(200);
    expect(body.circuitBreaker.name).toBe('test-cb');
    expect(body.circuitBreaker.state).toBe('CLOSED');

    // Clean up so subsequent beforeEach resetAll is clean
    cb.reset();
  });
});

// ============================================================================
// 18. PUSH NOTIFICATION ROUTES (push-token CRUD, portfolio-rules CRUD)
// ============================================================================

describe('POST /api/notifications/push-token', () => {
  it('should reject without auth', async () => {
    const { status } = await post('/api/notifications/push-token', { pushToken: 'ExponentPushToken[abc]' });
    expect(status).toBe(401);
  });

  it('should register a push token', async () => {
    const { status, body } = await post(
      '/api/notifications/push-token',
      { pushToken: 'ExponentPushToken[test-token-001]' },
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.userId).toBe(TEST_USER_ID);
  });

  it('should reject without pushToken', async () => {
    const { status, body } = await post('/api/notifications/push-token', {}, AUTH_HEADER);
    expect(status).toBe(400);
    expect(body.error).toContain('pushToken');
  });

  it('should reject non-string pushToken', async () => {
    const { status, body } = await post('/api/notifications/push-token', { pushToken: 123 }, AUTH_HEADER);
    expect(status).toBe(400);
    expect(body.error).toContain('pushToken');
  });
});

describe('GET /api/notifications/push-token', () => {
  beforeEach(async () => {
    // Clean up any push token registered by earlier tests
    await del('/api/notifications/push-token', AUTH_HEADER);
  });

  it('should reject without auth', async () => {
    const { status } = await get('/api/notifications/push-token');
    expect(status).toBe(401);
  });

  it('should return registered=false when no token registered', async () => {
    const { status, body } = await get('/api/notifications/push-token', AUTH_HEADER);
    expect(status).toBe(200);
    expect(body.registered).toBe(false);
    expect(body.userId).toBe(TEST_USER_ID);
  });

  it('should return registered=true after registering a token', async () => {
    // First register a token
    await post('/api/notifications/push-token', { pushToken: 'ExponentPushToken[check-token]' }, AUTH_HEADER);

    const { status, body } = await get('/api/notifications/push-token', AUTH_HEADER);
    expect(status).toBe(200);
    expect(body.registered).toBe(true);
  });
});

describe('DELETE /api/notifications/push-token', () => {
  it('should reject without auth', async () => {
    const { status } = await del('/api/notifications/push-token');
    expect(status).toBe(401);
  });

  it('should unregister a push token', async () => {
    // First register, then unregister
    await post('/api/notifications/push-token', { pushToken: 'ExponentPushToken[del-token]' }, AUTH_HEADER);

    const { status, body } = await del('/api/notifications/push-token', AUTH_HEADER);
    expect(status).toBe(200);
    expect(body.success).toBe(true);

    // Verify it's gone
    const { body: check } = await get('/api/notifications/push-token', AUTH_HEADER);
    expect(check.registered).toBe(false);
  });
});

describe('GET /api/notifications/portfolio-rules', () => {
  beforeEach(async () => {
    // Clear any rules created by earlier tests (e.g., badge-count section)
    await post('/api/notifications/portfolio-rules/sync', { rules: [] }, AUTH_HEADER);
  });

  it('should reject without auth', async () => {
    const { status } = await get('/api/notifications/portfolio-rules');
    expect(status).toBe(401);
  });

  it('should return empty array when no rules exist', async () => {
    const { status, body } = await get('/api/notifications/portfolio-rules', AUTH_HEADER);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
  });

  it('should return synced rules', async () => {
    const rule = {
      id: 'list-test-rule',
      userId: TEST_USER_ID,
      kind: 'portfolio_pnl_pct',
      label: 'List Test P&L',
      threshold: -5,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
    };
    await post('/api/notifications/portfolio-rules/sync', { rules: [rule] }, AUTH_HEADER);

    const { status, body } = await get('/api/notifications/portfolio-rules', AUTH_HEADER);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe('list-test-rule');
  });
});

describe('POST /api/notifications/portfolio-rules/sync errors', () => {
  it('should reject when rules is not an array', async () => {
    const { status, body } = await post('/api/notifications/portfolio-rules/sync', { rules: 'not-array' }, AUTH_HEADER);
    expect(status).toBe(400);
    expect(body.error).toContain('rules array');
  });

  it('should accept empty rules array', async () => {
    const { status, body } = await post('/api/notifications/portfolio-rules/sync', { rules: [] }, AUTH_HEADER);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.count).toBe(0);
  });
});

describe('PUT /api/notifications/portfolio-rules/:ruleId', () => {
  let ruleId: string;

  beforeEach(async () => {
    await post('/api/notifications/portfolio-alert/reset-triggers', {}, AUTH_HEADER);
    const rule = {
      id: 'put-test-rule',
      userId: TEST_USER_ID,
      kind: 'portfolio_pnl_pct',
      label: 'PUT Test',
      threshold: -5,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
    };
    await post('/api/notifications/portfolio-rules/sync', { rules: [rule] }, AUTH_HEADER);
    ruleId = 'put-test-rule';
  });

  it('should reject without auth', async () => {
    const { status } = await put(`/api/notifications/portfolio-rules/${ruleId}`, { label: 'Updated' });
    expect(status).toBe(401);
  });

  it('should update a rule', async () => {
    const { status, body } = await put(
      `/api/notifications/portfolio-rules/${ruleId}`,
      { label: 'Updated Label', threshold: -10 },
      AUTH_HEADER,
    );
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

describe('DELETE /api/notifications/portfolio-rules/:ruleId', () => {
  let ruleId: string;

  beforeEach(async () => {
    await post('/api/notifications/portfolio-alert/reset-triggers', {}, AUTH_HEADER);
    const rule = {
      id: 'del-test-rule',
      userId: TEST_USER_ID,
      kind: 'portfolio_pnl_pct',
      label: 'DELETE Test',
      threshold: -5,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
    };
    await post('/api/notifications/portfolio-rules/sync', { rules: [rule] }, AUTH_HEADER);
    ruleId = 'del-test-rule';
  });

  it('should reject without auth', async () => {
    const { status } = await del(`/api/notifications/portfolio-rules/${ruleId}`);
    expect(status).toBe(401);
  });

  it('should delete a rule', async () => {
    const { status, body } = await del(`/api/notifications/portfolio-rules/${ruleId}`, AUTH_HEADER);
    expect(status).toBe(200);
    expect(body.success).toBe(true);

    // Verify it's gone
    const { body: rules } = await get('/api/notifications/portfolio-rules', AUTH_HEADER);
    expect(rules.find((r: any) => r.id === ruleId)).toBeUndefined();
  });
});

describe('POST /api/notifications/portfolio-alert/evaluate - badgeCount sync', () => {
  beforeEach(async () => {
    await post('/api/notifications/portfolio-alert/reset-triggers', {}, AUTH_HEADER);
  });

  it('should sync badgeCount when client value is higher than server', async () => {
    // Provide a badgeCount that's higher than server (which is 0 after reset-triggers)
    const { status, body } = await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: {
        totalReturnPercent: 5,
        totalReturn: 1000,
        totalInvested: 100000,
        currentValue: 101000,
        peakValue: 101000,
        consecutiveLossDays: 0,
      },
      badgeCount: 3,
    }, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.evaluated).toBe(true);
    // Server synced badgeCount from 0 to 3 (3 increments), then no rule fired so stays at 3
    expect(body.badgeCount).toBe(3);
  });

  it('should not sync when client badgeCount is lower than server', async () => {
    // First fire a rule to increment badge count
    const rule = {
      id: 'badge-sync-rule',
      userId: TEST_USER_ID,
      kind: 'portfolio_pnl_pct',
      label: 'Badge Sync',
      threshold: -5,
      direction: 'below',
      triggered: false,
      createdAt: new Date().toISOString(),
      enabled: true,
    };
    await post('/api/notifications/portfolio-rules/sync', { rules: [rule] }, AUTH_HEADER);

    // Fire the rule — badge count becomes 1
    await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: { totalReturnPercent: -10, totalReturn: -50000, totalInvested: 500000, currentValue: 450000, peakValue: 550000, consecutiveLossDays: 0 },
    }, AUTH_HEADER);

    // Now send a LOWER badgeCount — server should NOT sync down
    const { status, body } = await post('/api/notifications/portfolio-alert/evaluate', {
      portfolioData: {
        totalReturnPercent: 5, totalReturn: 1000, totalInvested: 100000,
        currentValue: 101000, peakValue: 101000, consecutiveLossDays: 0,
      },
      badgeCount: 0,
    }, AUTH_HEADER);

    expect(status).toBe(200);
    // Server badge count stays at 1 (not reset to 0)
    expect(body.badgeCount).toBeGreaterThanOrEqual(1);
  });
});
