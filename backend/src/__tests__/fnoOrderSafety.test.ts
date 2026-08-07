/**
 * ============================================================================
 * Toroloom — F&O Order Safety Tests
 * ============================================================================
 *
 * Verifies that /api/fno/place-order and /api/fno/strategy/execute now route
 * through the Risk-Guarded OrderExecutionPipeline:
 *   - F&O orders are BLOCKED when "Allow F&O" is disabled (default)
 *   - F&O orders are blocked when they exceed max position size
 *   - Strategies are all-or-nothing: any blocked leg rejects the WHOLE
 *     strategy with ZERO broker calls
 *   - Broker is only called when every leg passes risk checks
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/fnoOrderSafety.test.ts
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

// ──── Mock broker — spy on placeOrder to prove no bypass ───────────────────

const { mockBroker } = vi.hoisted(() => ({
  mockBroker: {
    placeOrder: vi.fn().mockResolvedValue({
      id: 'ord-fno-001',
      status: 'confirmed',
      message: 'F&O order filled',
      timestamp: new Date().toISOString(),
    }),
  },
}));

vi.mock('../services/broker', () => ({
  getBroker: vi.fn().mockResolvedValue(mockBroker),
}));

// ──── Import route + real pipeline/riskEngine AFTER mocks ──────────────────

import fnoRoutes from '../routes/fno';
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

const EXPIRY = new Date(Date.now() + 7 * 86400000).toISOString();

function placeOrderBody(overrides: Record<string, any> = {}) {
  return {
    symbol: 'NIFTY',
    type: 'CE',
    action: 'buy',
    strike: 23500,
    expiry: EXPIRY,
    quantity: 1,
    price: 185.5,
    ...overrides,
  };
}

function strategyBody(overrides: Record<string, any> = {}) {
  return {
    name: 'Test Iron Condor',
    symbol: 'NIFTY',
    spotPrice: 23456,
    legs: [
      { type: 'PE', action: 'sell', strike: 23000, premium: 120, quantity: 1, lotSize: 50, expiry: EXPIRY },
      { type: 'CE', action: 'sell', strike: 24000, premium: 80, quantity: 1, lotSize: 50, expiry: EXPIRY },
    ],
    ...overrides,
  };
}

function enableFno(limits: Record<string, any> = {}) {
  riskEngine.updateLimits('test_user', { allowFNO: true, ...limits });
}

// ============================================================================
// Tests
// ============================================================================

describe('F&O Order Safety (pipeline routing)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/fno', fnoRoutes);

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
    // Default: F&O DISABLED — tests must explicitly enable it (block-until-enabled)
    riskEngine.updateLimits('test_user', { allowFNO: false, maxPositionSizePercent: 100 });
  });

  // ── /place-order ──────────────────────────────────────────────────────

  it('blocks an F&O order when allowFNO is disabled — broker never called', async () => {
    const { status, body } = await request(server, baseUrl, {
      method: 'POST', path: '/api/fno/place-order',
      body: placeOrderBody(),
    });

    expect(status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.status).toBe('rejected');
    expect(body.message).toContain('F&O');
    expect(mockBroker.placeOrder).not.toHaveBeenCalled();
  });

  it('executes an F&O order via the pipeline when allowFNO is enabled', async () => {
    enableFno();

    const { status, body } = await request(server, baseUrl, {
      method: 'POST', path: '/api/fno/place-order',
      body: placeOrderBody(),
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.status).toBe('confirmed');
    expect(body.orderId).toBeDefined();
    expect(body.riskEvaluation?.allowed).toBe(true);
    expect(mockBroker.placeOrder).toHaveBeenCalledTimes(1);

    // The broker receives a constructed NFO instrument symbol
    const payload = mockBroker.placeOrder.mock.calls[0][0];
    expect(payload.exchange).toBe('NFO');
    expect(payload.symbol).toContain('NIFTY');
  });

  it('blocks an F&O order that exceeds max position size', async () => {
    enableFno();

    const { status, body } = await request(server, baseUrl, {
      method: 'POST', path: '/api/fno/place-order',
      body: placeOrderBody({ quantity: 100000, price: 100 }), // 100000 * 50 * 100 = ₹50 Cr
    });

    expect(status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.status).toBe('rejected');
    expect(body.message).toContain('max position size');
    expect(mockBroker.placeOrder).not.toHaveBeenCalled();
  });

  // ── /strategy/execute ─────────────────────────────────────────────────

  it('rejects the WHOLE strategy (all-or-nothing) when a leg is blocked', async () => {
    const { status, body } = await request(server, baseUrl, {
      method: 'POST', path: '/api/fno/strategy/execute',
      body: strategyBody(),
    });

    expect(status).toBe(200);
    expect(body.blocked).toBe(true);
    expect(body.successful).toBe(0);
    expect(body.failed).toBe(2);
    expect(body.blockedReasons).toHaveLength(2);
    expect(body.blockedReasons[0]).toContain('F&O');
    // Zero orders placed — no partial execution
    expect(mockBroker.placeOrder).not.toHaveBeenCalled();
  });

  it('executes every leg through the pipeline when all legs pass', async () => {
    enableFno();

    const { status, body } = await request(server, baseUrl, {
      method: 'POST', path: '/api/fno/strategy/execute',
      body: strategyBody(),
    });

    expect(status).toBe(200);
    expect(body.successful).toBe(2);
    expect(body.failed).toBe(0);
    expect(mockBroker.placeOrder).toHaveBeenCalledTimes(2);
  });

  it('dedupes a replayed strategy via the strategy-level idempotency key', async () => {
    enableFno();

    const body = strategyBody({ idempotencyKey: 'strategy-key-0001' });
    await request(server, baseUrl, { method: 'POST', path: '/api/fno/strategy/execute', body });
    expect(mockBroker.placeOrder).toHaveBeenCalledTimes(2);

    // Replay the identical strategy — no legs re-execute
    const replay = await request(server, baseUrl, { method: 'POST', path: '/api/fno/strategy/execute', body });
    expect(replay.body.successful).toBe(2);
    expect(mockBroker.placeOrder).toHaveBeenCalledTimes(2);
  });
});
