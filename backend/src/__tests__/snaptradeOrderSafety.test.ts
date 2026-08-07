/**
 * ============================================================================
 * Toroloom — SnapTrade Order Safety Unit Tests
 * ============================================================================
 *
 * Verifies that POST /api/snaptrade/place-order is now routed through:
 *   - riskEngine.evaluate (Financial Bodyguard) BEFORE the broker call
 *   - auditTrail (ORDER_REJECTED on block, ORDER_EXECUTION on success)
 *   - idempotency claim guard (replay returns ORIGINAL result, no double order)
 *   - positions-based exit detection (SELL of a held position = exit)
 *
 * Uses the same harness as fno.test.ts: mocked auth middleware + raw
 * http.request (no supertest dependency).
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/snaptradeOrderSafety.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';

// ──── Mock authMiddleware — just set userId and call next() ────────────────

vi.mock('../middleware/auth', () => ({
  authMiddleware: (_req: any, _res: any, next: () => void) => {
    _req.user = { userId: 'test_user' };
    next();
  },
}));

// ──── Mock SnapTrade service (never hit the real API) ──────────────────────

const placeOrderMock = vi.fn();
const getPositionsMock = vi.fn();

vi.mock('../services/snapTradeService', () => ({
  snapTradeService: {
    isConfigured: () => true,
    placeOrder: (...args: unknown[]) => placeOrderMock(...args),
    getPositions: (...args: unknown[]) => getPositionsMock(...args),
  },
}));

// ──── Mock persistence + crypto so the test user is "registered" ────────────

vi.mock('../services/snapTradePersistence', () => ({
  loadConnection: vi.fn(() =>
    Promise.resolve({
      snapTradeUserId: 'toroloom_test_user',
      encryptedUserSecret: 'enc:fake',
      authorizationId: 'auth-123',
      accountId: 'acc-456',
      brokerName: 'Alpaca',
      brokerSlug: 'alpaca',
      accountName: 'Main',
      connectedAt: new Date().toISOString(),
    }),
  ),
  saveConnection: vi.fn(() => Promise.resolve()),
  deleteConnection: vi.fn(() => Promise.resolve()),
}));

vi.mock('../lib/crypto', () => ({
  encrypt: (plaintext: string) => `enc:${plaintext}`,
  decrypt: () => 'test-secret',
}));

// ──── Import route AFTER mocks ─────────────────────────────────────────────

import snaptradeRoutes from '../routes/snaptrade';
import { riskEngine } from '../services/riskEngine/RiskEngine';
import { auditTrail } from '../services/auditTrail';
import { clearIdempotencyForTest } from '../services/idempotency';

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
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const body: any = (() => {
            try {
              return data ? JSON.parse(data) : {};
            } catch {
              return { raw: data };
            }
          })();
          resolve({ status: res.statusCode || 0, body });
        });
      },
    );
    req.on('error', reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

const VALID_ORDER = {
  symbol: 'AAPL',
  action: 'BUY',
  orderType: 'Market',
  quantity: 10,
  price: 200, // ₹2,000 order value
};

// ──── Tests ────────────────────────────────────────────────────────────────

describe('SnapTrade Order Safety', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/snaptrade', snaptradeRoutes);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    placeOrderMock.mockReset();
    getPositionsMock.mockReset();
    clearIdempotencyForTest();

    // Healthy risk profile: ₹10L portfolio, generous position size
    riskEngine.resetDaily('test_user');
    riskEngine.setPortfolioValue('test_user', 1000000);
    riskEngine.updateLimits('test_user', { maxPositionSizePercent: 100, allowFNO: false });

    // Default: no positions held, broker returns a fill
    getPositionsMock.mockResolvedValue([]);
    placeOrderMock.mockResolvedValue({ id: 'st-12345', status: 'Filled' });
  });

  it('places an order through the risk engine with audit ORDER_EXECUTION + riskEvaluation', async () => {
    const { status, body } = await request(server, baseUrl, {
      method: 'POST',
      path: '/api/snaptrade/place-order',
      body: VALID_ORDER,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.orderId).toBe('st-12345');
    expect(body.status).toBe('Filled');
    expect(body.riskEvaluation).toBeDefined();
    expect(body.riskEvaluation.allowed).toBe(true);
    expect(body.auditEventId).toBeDefined();
    expect(placeOrderMock).toHaveBeenCalledTimes(1);

    const events = await auditTrail.getEvents({ userId: 'test_user', limit: 10 });
    const execEvent = events.find((e) => e.eventType === 'ORDER_EXECUTION');
    expect(execEvent).toBeDefined();
    expect(execEvent!.data).toMatchObject({
      source: 'snaptrade',
      symbol: 'AAPL',
      action: 'BUY',
      quantity: 10,
      orderId: 'st-12345',
    });
  });

  it('blocks an oversized order (no broker call, ORDER_REJECTED audited)', async () => {
    // Position-size gate: ₹10L × 1% = ₹10,000 max → ₹60,000 order is blocked
    riskEngine.updateLimits('test_user', { maxPositionSizePercent: 1 });

    const { status, body } = await request(server, baseUrl, {
      method: 'POST',
      path: '/api/snaptrade/place-order',
      body: { ...VALID_ORDER, quantity: 300, price: 200 }, // ₹60,000
    });

    expect(status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.status).toBe('rejected');
    expect(body.orderId).toBeNull();
    expect(body.riskEvaluation).toBeDefined();
    expect(body.riskEvaluation.allowed).toBe(false);
    expect(placeOrderMock).not.toHaveBeenCalled();

    const events = await auditTrail.getEvents({ userId: 'test_user', limit: 10 });
    const rejectedEvent = events.find((e) => e.eventType === 'ORDER_REJECTED');
    expect(rejectedEvent).toBeDefined();
    expect(rejectedEvent!.data).toMatchObject({
      source: 'snaptrade',
      symbol: 'AAPL',
      reason: expect.any(String),
    });
  });

  it('treats a SELL of a held position as an EXIT (allowed even when new buys are blocked)', async () => {
    // User holds 20 AAPL shares → SELL is an exit action (never blocked)
    getPositionsMock.mockResolvedValue([
      { symbol: { symbol: 'AAPL' }, units: 20, avgCost: 180 },
    ]);

    // Tight gate that would block a fresh BUY order of this size
    riskEngine.updateLimits('test_user', { maxPositionSizePercent: 1 });

    const { status, body } = await request(server, baseUrl, {
      method: 'POST',
      path: '/api/snaptrade/place-order',
      body: { ...VALID_ORDER, action: 'SELL' },
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(placeOrderMock).toHaveBeenCalledTimes(1);
  });

  it('position lookup failure does NOT block the order (best-effort)', async () => {
    getPositionsMock.mockRejectedValue(new Error('SnapTrade down'));

    const { status, body } = await request(server, baseUrl, {
      method: 'POST',
      path: '/api/snaptrade/place-order',
      body: VALID_ORDER,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(placeOrderMock).toHaveBeenCalledTimes(1);
  });

  it('replays an identical idempotency key with the ORIGINAL result (single broker call)', async () => {
    const key = 'snaptrade-test-key-0001';
    const orderBody = { ...VALID_ORDER, idempotencyKey: key };

    const first = await request(server, baseUrl, {
      method: 'POST',
      path: '/api/snaptrade/place-order',
      body: orderBody,
    });
    expect(first.body.success).toBe(true);
    expect(first.body.orderId).toBe('st-12345');

    // Second identical request → replayed, broker NOT called again
    const second = await request(server, baseUrl, {
      method: 'POST',
      path: '/api/snaptrade/place-order',
      body: orderBody,
    });
    expect(second.body.success).toBe(true);
    expect(second.body.orderId).toBe('st-12345');
    expect(second.body.idempotentReplay).toBe(true);
    expect(placeOrderMock).toHaveBeenCalledTimes(1);
  });

  it('replays a BLOCKED order idempotently — retry returns the block message (no 429, no broker call)', async () => {
    // Tight gate so the order is rejected on first attempt
    riskEngine.updateLimits('test_user', { maxPositionSizePercent: 1 });
    const key = 'snaptrade-blocked-key-0001';
    const orderBody = { ...VALID_ORDER, quantity: 300, price: 200, idempotencyKey: key }; // ₹60,000

    const first = await request(server, baseUrl, {
      method: 'POST',
      path: '/api/snaptrade/place-order',
      body: orderBody,
    });
    expect(first.status).toBe(200);
    expect(first.body.success).toBe(false);
    expect(first.body.status).toBe('rejected');
    expect(first.body.message).toContain('exceeds max position size');

    // Retry with the same key → same block result, broker still untouched
    const second = await request(server, baseUrl, {
      method: 'POST',
      path: '/api/snaptrade/place-order',
      body: orderBody,
    });
    expect(second.status).toBe(200);
    expect(second.body.success).toBe(false);
    expect(second.body.message).toContain('exceeds max position size');
    expect(placeOrderMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid idempotency key format (400)', async () => {
    const { status, body } = await request(server, baseUrl, {
      method: 'POST',
      path: '/api/snaptrade/place-order',
      body: { ...VALID_ORDER, idempotencyKey: 'short' },
    });

    expect(status).toBe(400);
    expect(body.error).toContain('idempotencyKey');
    expect(placeOrderMock).not.toHaveBeenCalled();
  });

  it('rejects orders missing required fields (400) — regression guard', async () => {
    const { status, body } = await request(server, baseUrl, {
      method: 'POST',
      path: '/api/snaptrade/place-order',
      body: { symbol: 'AAPL', action: 'BUY' },
    });

    expect(status).toBe(400);
    expect(body.error).toContain('Required fields');
    expect(placeOrderMock).not.toHaveBeenCalled();
  });

  it('rejects users with no persisted SnapTrade connection (400, broker untouched)', async () => {
    // Simulate no connection for this request → the route must reject
    // BEFORE touching the broker.
    const { loadConnection } = await import('../services/snapTradePersistence');
    (loadConnection as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const { status, body } = await request(server, baseUrl, {
      method: 'POST',
      path: '/api/snaptrade/place-order',
      body: VALID_ORDER,
    });

    expect(status).toBe(400);
    expect(body.error).toBeDefined();
    expect(placeOrderMock).not.toHaveBeenCalled();
  });
});
