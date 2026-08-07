/**
 * ============================================================================
 * Toroloom — Order Idempotency Tests
 * ============================================================================
 *
 * Verifies that POST /api/orders/execute dedupes retries via idempotencyKey.
 * Uses the REAL OrderExecutionPipeline (idempotency guard lives inside it)
 * with a spy on the broker's placeOrder — proving the broker is only ever
 * called ONCE for a repeated key:
 *   - Same key twice  → broker called once; replay returns original result
 *                       with idempotentReplay: true
 *   - Different keys  → broker called per request
 *   - Invalid key     → 400, broker never called
 *   - No key          → backward-compatible execution
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/idempotency.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import http from 'http';

// ──── Mock authMiddleware ───────────────────────────────────────────────────

vi.mock('../middleware/auth', () => ({
  authMiddleware: (_req: any, _res: any, next: () => void) => {
    _req.user = { userId: 'test_user' };
    next();
  },
}));

// ──── Mock broker — spy on placeOrder to prove dedup ────────────────────────

const { mockBroker } = vi.hoisted(() => ({
  mockBroker: {
    getPositions: vi.fn().mockResolvedValue([]),
    placeOrder: vi.fn().mockResolvedValue({
      id: 'exec-001',
      status: 'confirmed',
      message: 'Order placed',
      timestamp: new Date().toISOString(),
    }),
  },
}));

vi.mock('../services/broker', () => ({
  getBroker: vi.fn().mockResolvedValue(mockBroker),
}));

// ──── Mock auditTrail (keep pipeline quiet) ─────────────────────────────────

vi.mock('../services/auditTrail', () => ({
  auditTrail: { append: vi.fn().mockResolvedValue({ id: 'evt-audit-001' }) },
}));

// ──── Import route + real pipeline deps AFTER mocks ─────────────────────────

import ordersRoutes from '../routes/orders';
import { riskEngine } from '../services/riskEngine/RiskEngine';
import { clearIdempotencyForTest } from '../services/idempotency';

// ──── Helpers ──────────────────────────────────────────────────────────────

type ResResult = { status: number; body: any };

function request(
  server: http.Server,
  baseUrl: string,
  opts: { method: string; path: string; body?: any },
): Promise<ResResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, baseUrl);
    const req = http.request(
      url.toString(),
      {
        method: opts.method,
        headers: { 'Content-Type': 'application/json' },
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
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

const ORDER_BODY = {
  actionType: 'BUY',
  symbol: 'RELIANCE',
  exchange: 'NSE',
  quantity: 1,
  price: 100,
  productType: 'CNC',
  orderType: 'MARKET',
};

// ============================================================================
// Tests
// ============================================================================

describe('POST /api/orders/execute — idempotency', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/orders', ordersRoutes);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        baseUrl = `http://localhost:${(server.address() as any).port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    server?.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearIdempotencyForTest();
    riskEngine.resetDaily('test_user');
    riskEngine.setPortfolioValue('test_user', 1000000);
    riskEngine.updateLimits('test_user', { maxPositionSizePercent: 100 });
  });

  it('calls the broker ONCE and replays the stored result for the same key', async () => {
    const body = { ...ORDER_BODY, idempotencyKey: 'key-12345678' };

    const first = await request(server, baseUrl, {
      method: 'POST', path: '/api/orders/execute', body,
    });
    const second = await request(server, baseUrl, {
      method: 'POST', path: '/api/orders/execute', body,
    });

    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);
    expect(first.body.orderId).toBe('exec-001');
    expect(first.body.idempotentReplay).toBeUndefined();

    // The broker must only be contacted once — no double execution
    expect(mockBroker.placeOrder).toHaveBeenCalledTimes(1);

    expect(second.status).toBe(200);
    expect(second.body.orderId).toBe('exec-001');
    expect(second.body.idempotentReplay).toBe(true);
  });

  it('executes per request for different keys', async () => {
    await request(server, baseUrl, {
      method: 'POST', path: '/api/orders/execute',
      body: { ...ORDER_BODY, idempotencyKey: 'key-aaaaaaaa' },
    });
    await request(server, baseUrl, {
      method: 'POST', path: '/api/orders/execute',
      body: { ...ORDER_BODY, idempotencyKey: 'key-bbbbbbbb' },
    });

    expect(mockBroker.placeOrder).toHaveBeenCalledTimes(2);
  });

  it('re-executes after the idempotency store is cleared (TTL expiry analog)', async () => {
    const body = { ...ORDER_BODY, idempotencyKey: 'key-cccccccc' };

    await request(server, baseUrl, { method: 'POST', path: '/api/orders/execute', body });
    expect(mockBroker.placeOrder).toHaveBeenCalledTimes(1);

    clearIdempotencyForTest();

    const retry = await request(server, baseUrl, { method: 'POST', path: '/api/orders/execute', body });
    expect(mockBroker.placeOrder).toHaveBeenCalledTimes(2);
    expect(retry.body.idempotentReplay).toBeUndefined();
  });

  it('rejects an invalid (too-short) idempotency key with 400', async () => {
    const { status, body } = await request(server, baseUrl, {
      method: 'POST', path: '/api/orders/execute',
      body: { ...ORDER_BODY, idempotencyKey: 'short' },
    });

    expect(status).toBe(400);
    expect(body.error).toContain('idempotencyKey');
    expect(mockBroker.placeOrder).not.toHaveBeenCalled();
  });

  it('still executes without an idempotency key (backward compat)', async () => {
    await request(server, baseUrl, { method: 'POST', path: '/api/orders/execute', body: ORDER_BODY });
    await request(server, baseUrl, { method: 'POST', path: '/api/orders/execute', body: ORDER_BODY });

    expect(mockBroker.placeOrder).toHaveBeenCalledTimes(2);
  });
});
