/**
 * ============================================================================
 * Toroloom — SnapTrade Ticker Endpoint Tests
 * ============================================================================
 *
 * Verifies GET /api/snaptrade/ticker/:symbol — the hybrid-data endpoint that
 * feeds the TradingView chart's position-levels overlay:
 *
 *   - No broker connected        → 200 { connected: false, position: null }
 *   - Broker connected + position → position (qty, avgCost, P&L) + risk levels
 *   - Symbol match is case-insensitive (uppercased server-side)
 *   - Position lookup failure     → best-effort: still 200 with levels only
 *   - Iron Lock active            → ironLockActive: true + lockdownStatus
 *   - Empty symbol                → 400
 *   - Security                    → response NEVER contains a userSecret/token
 *
 * Uses the same harness as snaptradeOrderSafety.test.ts: mocked auth
 * middleware + raw http.request (no supertest dependency).
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/snaptradeTickerEndpoint.test.ts
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

const getPositionsMock = vi.fn();

vi.mock('../services/snapTradeService', () => ({
  snapTradeService: {
    isConfigured: () => true,
    isPersonalMode: () => false,
    getPositions: (...args: unknown[]) => getPositionsMock(...args),
  },
}));

// ──── Mock persistence + crypto so the test user is "registered" ───────────

const loadConnectionMock = vi.fn(() =>
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
);

vi.mock('../services/snapTradePersistence', () => ({
  loadConnection: (...args: unknown[]) => loadConnectionMock(...args),
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

// ──── Helpers ──────────────────────────────────────────────────────────────

type ResResult = { status: number; body: any };

function request(
  server: http.Server,
  baseUrl: string,
  opts: { method: string; path: string },
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
    req.end();
  });
}

const POSITION_FIXTURE = {
  symbol: { symbol: 'AAPL' },
  units: 10,
  avgCost: 185.5,
  price: 190,
  pnl: 45,
  pnlPercent: 2.43,
};

// ──── Tests ────────────────────────────────────────────────────────────────

describe('GET /api/snaptrade/ticker/:symbol', () => {
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
    getPositionsMock.mockReset();
    loadConnectionMock.mockReset();
    loadConnectionMock.mockResolvedValue({
      snapTradeUserId: 'toroloom_test_user',
      encryptedUserSecret: 'enc:fake',
      authorizationId: 'auth-123',
      accountId: 'acc-456',
      brokerName: 'Alpaca',
      brokerSlug: 'alpaca',
      accountName: 'Main',
      connectedAt: new Date().toISOString(),
    });

    riskEngine.resetDaily('test_user');
    riskEngine.setPortfolioValue('test_user', 1000000);
  });

  it('returns connected:false + position:null when no broker is linked (read-only mode)', async () => {
    loadConnectionMock.mockResolvedValue(null);

    const { status, body } = await request(server, baseUrl, {
      method: 'GET',
      path: '/api/snaptrade/ticker/AAPL',
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.connected).toBe(false);
    expect(body.position).toBeNull();
    expect(body.levels).toBeNull();
    expect(body.ironLockActive).toBe(false);
    expect(body.lockdownStatus).toBe('none');
    // Broker never consulted when disconnected.
    expect(getPositionsMock).not.toHaveBeenCalled();
  });

  it('treats a registered-but-never-connected user as read-only (empty authorizationId)', async () => {
    // User registered with SnapTrade (connection record exists) but hasn't
    // completed OAuth — the route's read-only branch covers this via
    // `!connection || !connection.authorizationId`.
    loadConnectionMock.mockResolvedValue({
      snapTradeUserId: 'toroloom_test_user',
      encryptedUserSecret: 'enc:fake',
      authorizationId: '',
      accountId: '',
      brokerName: '',
      brokerSlug: '',
      accountName: '',
      connectedAt: '',
    });

    const { status, body } = await request(server, baseUrl, {
      method: 'GET',
      path: '/api/snaptrade/ticker/AAPL',
    });

    expect(status).toBe(200);
    expect(body.connected).toBe(false);
    expect(body.position).toBeNull();
    expect(getPositionsMock).not.toHaveBeenCalled();
  });

  it('returns the open position + risk levels for a held symbol', async () => {
    getPositionsMock.mockResolvedValue([POSITION_FIXTURE]);

    const { status, body } = await request(server, baseUrl, {
      method: 'GET',
      path: '/api/snaptrade/ticker/AAPL',
    });

    expect(status).toBe(200);
    expect(body.connected).toBe(true);
    expect(body.position).toEqual({
      symbol: 'AAPL',
      quantity: 10,
      avgCost: 185.5,
      price: 190,
      pnl: 45,
      pnlPercent: 2.43,
    });
    expect(body.levels).toEqual({
      dailyLossLimit: expect.any(Number),
      dailyLossPercentLimit: expect.any(Number),
      maxPositionSizePercent: expect.any(Number),
    });
    expect(body.ironLockActive).toBe(false);
  });

  it('matches symbols case-insensitively (request uppercased server-side)', async () => {
    getPositionsMock.mockResolvedValue([POSITION_FIXTURE]);

    const { status, body } = await request(server, baseUrl, {
      method: 'GET',
      path: '/api/snaptrade/ticker/aapl',
    });

    expect(status).toBe(200);
    expect(body.position?.symbol).toBe('AAPL');
    expect(body.symbol).toBe('AAPL');
  });

  it('returns position:null when connected but the symbol is not held', async () => {
    getPositionsMock.mockResolvedValue([POSITION_FIXTURE]);

    const { status, body } = await request(server, baseUrl, {
      method: 'GET',
      path: '/api/snaptrade/ticker/TSLA',
    });

    expect(status).toBe(200);
    expect(body.connected).toBe(true);
    expect(body.position).toBeNull();
    // Levels are still returned (the overlay can suggest exits from risk limits).
    expect(body.levels).not.toBeNull();
  });

  it('ignores zero-unit positions (no open position)', async () => {
    getPositionsMock.mockResolvedValue([
      { ...POSITION_FIXTURE, units: 0 },
    ]);

    const { status, body } = await request(server, baseUrl, {
      method: 'GET',
      path: '/api/snaptrade/ticker/AAPL',
    });

    expect(status).toBe(200);
    expect(body.position).toBeNull();
  });

  it('position lookup failure is best-effort — still 200 with levels', async () => {
    getPositionsMock.mockRejectedValue(new Error('SnapTrade down'));

    const { status, body } = await request(server, baseUrl, {
      method: 'GET',
      path: '/api/snaptrade/ticker/AAPL',
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.position).toBeNull();
    expect(body.levels).not.toBeNull();
  });

  it('flags ironLockActive when the risk engine lockdown is active', async () => {
    getPositionsMock.mockResolvedValue([POSITION_FIXTURE]);

    // Push MTM past the default daily-loss limit (₹50,000) → lockdown triggers.
    riskEngine.recordTrade('test_user', -60000, 0, true);

    const { status, body } = await request(server, baseUrl, {
      method: 'GET',
      path: '/api/snaptrade/ticker/AAPL',
    });

    expect(status).toBe(200);
    expect(body.ironLockActive).toBe(true);
    expect(body.lockdownStatus).not.toBe('none');
    expect(body.position).not.toBeNull();
  });

  it('rejects a whitespace-only symbol with 400', async () => {
    // An encoded space reaches the route as a non-empty param, then trims to
    // an empty string server-side → the validation branch fires. (A trailing
    // slash like /ticker/ would be a route-level 404 instead.)
    const { status, body } = await request(server, baseUrl, {
      method: 'GET',
      path: '/api/snaptrade/ticker/%20',
    });

    expect(status).toBe(400);
    expect(body.error).toContain('symbol');
  });

  it('never leaks broker credentials in the response', async () => {
    getPositionsMock.mockResolvedValue([POSITION_FIXTURE]);

    const { status, body } = await request(server, baseUrl, {
      method: 'GET',
      path: '/api/snaptrade/ticker/AAPL',
    });

    const serialized = JSON.stringify(body);
    expect(status).toBe(200);
    expect(serialized).not.toContain('userSecret');
    expect(serialized).not.toContain('enc:fake');
    expect(serialized).not.toContain('test-secret');
    expect(serialized).not.toContain('authorizationId');
  });
});
