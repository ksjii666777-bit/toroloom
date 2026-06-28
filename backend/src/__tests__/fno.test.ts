/**
 * ============================================================================
 * Toroloom — F&O Routes Unit Tests
 * ============================================================================
 *
 * Tests all 8 endpoints of the F&O route with mocked auth middleware,
 * using raw http.request (no supertest dependency).
 *
 * Endpoints:
 *   GET  /api/fno/expiries            — Available expiries for symbol
 *   GET  /api/fno/option-chain         — Option chain with strikes/Greeks
 *   GET  /api/fno/futures              — Futures contract chain
 *   GET  /api/fno/spot-prices          — Spot prices map
 *   GET  /api/fno/market-status        — Market open/closed status
 *   POST /api/fno/place-order          — Place F&O order
 *   POST /api/fno/strategy/analyze     — Multi-leg strategy analysis
 *   GET  /api/fno/prebuilt-strategies  — Pre-built strategy templates
 *   GET  /api/fno/positions            — Open F&O positions
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/fno.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import http from 'http';

// ──── Mock authMiddleware — just set userId and call next() ────────────────

vi.mock('../middleware/auth', () => ({
  authMiddleware: (_req: any, _res: any, next: () => void) => {
    _req.user = { userId: 'test_user' };
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

describe('F&O Routes', () => {
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

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/fno/expiries
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/fno/expiries', () => {
    it('should return expiries for a symbol (default NIFTY)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/expiries',
      });

      expect(status).toBe(200);
      expect(body.symbol).toBe('NIFTY');
      expect(body.expiries).toBeDefined();
      expect(Array.isArray(body.expiries)).toBe(true);
      expect(body.expiries.length).toBeGreaterThanOrEqual(6); // 4 weekly + 3 monthly
    });

    it('should return expiries for BANKNIFTY', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/expiries?symbol=BANKNIFTY',
      });

      expect(status).toBe(200);
      expect(body.symbol).toBe('BANKNIFTY');
    });

    it('should include expiry metadata (id, date, type, daysToExpiry, isMonthly)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/expiries',
      });

      expect(status).toBe(200);
      const expiry = body.expiries[0];
      expect(expiry).toHaveProperty('id');
      expect(expiry).toHaveProperty('date');
      expect(expiry).toHaveProperty('type');
      expect(expiry).toHaveProperty('daysToExpiry');
      expect(expiry).toHaveProperty('isMonthly');
      expect(['weekly', 'monthly']).toContain(expiry.type);
    });

    it('should sort expiries by daysToExpiry ascending', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/expiries',
      });

      expect(status).toBe(200);
      for (let i = 1; i < body.expiries.length; i++) {
        expect(body.expiries[i].daysToExpiry).toBeGreaterThanOrEqual(body.expiries[i - 1].daysToExpiry);
      }
    });

    // ── Edge Cases ───────────────────────────────────────────────────────

    it('should handle empty symbol parameter gracefully (default to NIFTY)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/expiries?symbol=',
      });
      expect(status).toBe(200);
      expect(body.symbol).toBe('NIFTY');
    });

    it('should handle unknown symbol', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/expiries?symbol=UNKNOWN123',
      });
      expect(status).toBe(200);
      expect(body.symbol).toBe('UNKNOWN123');
      expect(body.expiries.length).toBeGreaterThanOrEqual(6);
    });

    it('should handle symbol with special characters', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/expiries?symbol=TEST%26CO',
      });
      expect(status).toBe(200);
      expect(body.symbol).toBe('TEST&CO');
      expect(body.expiries.length).toBeGreaterThanOrEqual(6);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/fno/option-chain
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/fno/option-chain', () => {
    it('should return option chain with rows', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/option-chain?symbol=NIFTY',
      });

      expect(status).toBe(200);
      expect(body.underlying).toBe('NIFTY');
      expect(body.rows).toBeDefined();
      expect(Array.isArray(body.rows)).toBe(true);
      expect(body.rows.length).toBeGreaterThan(0);
    });

    it('should return option chain with default NIFTY when symbol is missing', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/option-chain',
      });

      expect(status).toBe(200);
      expect(body.underlying).toBe('NIFTY');
    });

    it('should include spotPrice, maxPain, pcr, totalCEOi, totalPEOi', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/option-chain?symbol=NIFTY',
      });

      expect(status).toBe(200);
      expect(body.spotPrice).toBeGreaterThan(0);
      expect(body.maxPain).toBeGreaterThan(0);
      expect(body.pcr).toBeGreaterThan(0);
      expect(body.totalCEOi).toBeGreaterThan(0);
      expect(body.totalPEOi).toBeGreaterThan(0);
    });

    it('should return CE and PE contracts for each strike', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/option-chain?symbol=NIFTY',
      });

      expect(status).toBe(200);
      const row = body.rows[0];
      expect(row).toHaveProperty('strike');
      expect(row).toHaveProperty('ce');
      expect(row).toHaveProperty('pe');
      expect(row.ce).toHaveProperty('ltp');
      expect(row.ce).toHaveProperty('delta');
      expect(row.ce).toHaveProperty('gamma');
      expect(row.ce).toHaveProperty('theta');
      expect(row.ce).toHaveProperty('vega');
      expect(row.ce).toHaveProperty('iv');
      expect(row.ce).toHaveProperty('openInterest');
      expect(row.ce).toHaveProperty('moneyness');
      expect(row.ce).toHaveProperty('intrinsicValue');
    });

    it('should accept expiry parameter', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/expiries?symbol=NIFTY',
      });
      const expiry = body.expiries[0].date;

      const { status: s2, body: b2 } = await request(server, baseUrl, {
        method: 'GET', path: `/api/fno/option-chain?symbol=NIFTY&expiry=${encodeURIComponent(expiry)}`,
      });

      expect(s2).toBe(200);
      expect(b2.expiry).toBeDefined();
    });

    // ── Edge Cases ───────────────────────────────────────────────────────

    it('should handle negative spotPrice gracefully (uses default map)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/option-chain?symbol=NIFTY&spotPrice=-100',
      });
      // -100 > 0 is false, so it falls back to spotPriceMap which is fine
      expect(status).toBe(200);
      expect(body.rows.length).toBeGreaterThan(0);
    });

    it('should handle zero spotPrice gracefully (uses default map)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/option-chain?symbol=NIFTY&spotPrice=0',
      });
      expect(status).toBe(200);
      expect(body.rows.length).toBeGreaterThan(0);
    });

    it('should handle NaN spotPrice gracefully (falls back to default)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/option-chain?symbol=NIFTY&spotPrice=abc',
      });
      expect(status).toBe(200);
      expect(body.rows.length).toBeGreaterThan(0);
    });

    it('should reject invalid expiry date with 400', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/option-chain?symbol=NIFTY&expiry=not-a-date',
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid expiry date');
    });

    it('should handle unknown symbol (uses default price 1000)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/option-chain?symbol=UNKNOWN',
      });
      expect(status).toBe(200);
      expect(body.underlying).toBe('UNKNOWN');
      expect(body.spotPrice).toBe(1000); // falls back to default
    });

    it('should handle empty symbol string (defaults to NIFTY)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/option-chain?symbol=',
      });
      expect(status).toBe(200);
      expect(body.underlying).toBe('NIFTY');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/fno/futures
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/fno/futures', () => {
    it('should return futures contracts for a symbol', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/futures?symbol=NIFTY',
      });

      expect(status).toBe(200);
      expect(body.symbol).toBe('NIFTY');
      expect(body.spotPrice).toBeGreaterThan(0);
      expect(body.futures).toBeDefined();
      expect(Array.isArray(body.futures)).toBe(true);
      expect(body.futures.length).toBeGreaterThan(0);
    });

    it('should return future contract with all required fields', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/futures?symbol=NIFTY',
      });

      expect(status).toBe(200);
      const future = body.futures[0];
      expect(future).toHaveProperty('symbol');
      expect(future).toHaveProperty('price');
      expect(future).toHaveProperty('lotSize');
      expect(future).toHaveProperty('openInterest');
      expect(future).toHaveProperty('basis');
      expect(future).toHaveProperty('basisPercent');
    });

    // ── Edge Cases ───────────────────────────────────────────────────────

    it('should handle empty symbol (defaults to NIFTY)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/futures?symbol=',
      });
      expect(status).toBe(200);
      expect(body.symbol).toBe('NIFTY');
    });

    it('should handle unknown symbol with fallback spot price 1000', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/futures?symbol=XYZ123' } );
      expect(status).toBe(200);
      expect(body.symbol).toBe('XYZ123');
      expect(body.spotPrice).toBe(1000);
    });

    it('should handle missing symbol entirely', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/futures',
      });
      expect(status).toBe(200);
      expect(body.symbol).toBe('NIFTY');
      expect(body.futures.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/fno/spot-prices
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/fno/spot-prices', () => {
    it('should return a map of symbol to spot price', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/spot-prices',
      });

      expect(status).toBe(200);
      expect(body).toHaveProperty('NIFTY');
      expect(body).toHaveProperty('BANKNIFTY');
      expect(body).toHaveProperty('RELIANCE');
      expect(typeof body.NIFTY).toBe('number');
      expect(body.NIFTY).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/fno/market-status
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/fno/market-status', () => {
    it('should return market status information', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/market-status',
      });

      expect(status).toBe(200);
      expect(body).toHaveProperty('isOpen');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('currentTime');
      expect(['open', 'closed']).toContain(body.status);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/fno/place-order
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/fno/place-order', () => {
    it('should place a CE option order successfully', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY',
          type: 'CE',
          action: 'buy',
          strike: 23500,
          expiry: new Date(Date.now() + 7 * 86400000).toISOString(),
          quantity: 1,
          price: 185.50,
        },
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.orderId).toBeDefined();
      expect(body.orderId).toContain('FNO_');
      expect(body.message).toContain('BUY CE');
      expect(body.type).toBe('CE');
      expect(body.symbol).toBe('NIFTY');
      expect(body.lotSize).toBe(50);
      expect(body.status).toBe('confirmed');
    });

    it('should place a FUTURE order successfully', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'RELIANCE',
          type: 'FUTURE',
          action: 'sell',
          expiry: new Date(Date.now() + 30 * 86400000).toISOString(),
          quantity: 2,
          price: 2900,
        },
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.type).toBe('FUTURE');
      expect(body.action).toBe('sell');
      expect(body.lotSize).toBe(1000);
      expect(body.totalQuantity).toBe(2000);
    });

    it('should reject when required fields are missing', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: { symbol: 'NIFTY' },
      });

      expect(status).toBe(400);
      expect(body.error).toContain('Missing required fields');
    });

    it('should calculate totalValue correctly', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY',
          type: 'CE',
          action: 'buy',
          expiry: new Date().toISOString(),
          quantity: 3,
          price: 200,
        },
      });

      expect(status).toBe(200);
      expect(body.totalQuantity).toBe(150); // 3 lots × 50 lotSize
      expect(body.totalValue).toBe(30000); // 150 × 200
    });

    // ── Edge Cases ───────────────────────────────────────────────────────

    it('should reject with empty string fields', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY',
          type: '', // empty type → falsy
          action: 'buy',
          expiry: new Date().toISOString(),
          quantity: 1,
          price: 100,
        },
      });
      expect(status).toBe(400);
    });

    it('should reject with quantity = 0 (falsy)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY',
          type: 'CE',
          action: 'buy',
          expiry: new Date().toISOString(),
          quantity: 0,
          price: 100,
        },
      });
      expect(status).toBe(400);
    });

    it('should reject with price = 0 (falsy)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY',
          type: 'CE',
          action: 'buy',
          expiry: new Date().toISOString(),
          quantity: 1,
          price: 0,
        },
      });
      expect(status).toBe(400);
    });

    it('should reject with null quantity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY',
          type: 'CE',
          action: 'buy',
          expiry: new Date().toISOString(),
          quantity: null,
          price: 100,
        },
      });
      expect(status).toBe(400);
    });

    it('should reject with missing body entirely', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {},
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Missing required fields');
    });

    it('should handle missing strike gracefully (strike becomes null)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY',
          type: 'FUTURE',
          action: 'buy',
          expiry: new Date().toISOString(),
          quantity: 1,
          price: 23500,
        },
      });
      expect(status).toBe(200);
      expect(body.strike).toBeNull();
    });

    it('should accept a valid PE order', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'BANKNIFTY',
          type: 'PE',
          action: 'sell',
          strike: 49000,
          expiry: new Date().toISOString(),
          quantity: 2,
          price: 320,
        },
      });
      expect(status).toBe(200);
      expect(body.type).toBe('PE');
      expect(body.action).toBe('sell');
      expect(body.lotSize).toBe(25); // BANKNIFTY lot size
    });

    it('should handle very large quantity without crashing', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY',
          type: 'CE',
          action: 'buy',
          expiry: new Date().toISOString(),
          quantity: 99999999,
          price: 185.50,
        },
      });
      expect(status).toBe(200);
      expect(body.totalQuantity).toBe(99999999 * 50);
    });

    it('should handle very large price without crashing', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY',
          type: 'CE',
          action: 'buy',
          expiry: new Date().toISOString(),
          quantity: 1,
          price: 999999.99,
        },
      });
      expect(status).toBe(200);
      expect(body.totalValue).toBe(50 * 999999.99);
    });

    it('should accept custom productType', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY',
          type: 'CE',
          action: 'buy',
          expiry: new Date().toISOString(),
          quantity: 1,
          price: 185,
          productType: 'MIS',
        },
      });
      expect(status).toBe(200);
      expect(body.productType).toBe('MIS');
    });

    // ── Input Validation Error Paths ────────────────────────────────────

    it('should reject invalid type (not CE/PE/FUTURE)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY', type: 'OPTION', action: 'buy',
          expiry: new Date().toISOString(), quantity: 1, price: 100,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid type');
      expect(body.error).toContain('OPTION');
    });

    it('should reject invalid action (not buy/sell)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY', type: 'CE', action: 'hold',
          expiry: new Date().toISOString(), quantity: 1, price: 100,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid action');
      expect(body.error).toContain('hold');
    });

    it('should reject invalid expiry date string', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY', type: 'CE', action: 'buy',
          expiry: 'not-a-date', quantity: 1, price: 100,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Invalid expiry date');
    });

    it('should reject non-integer quantity (e.g. 1.5)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY', type: 'CE', action: 'buy',
          expiry: new Date().toISOString(), quantity: 1.5, price: 100,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('positive integer');
    });

    it('should reject negative quantity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY', type: 'CE', action: 'buy',
          expiry: new Date().toISOString(), quantity: -1, price: 100,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('positive integer');
    });

    it('should reject negative price', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/place-order',
        body: {
          symbol: 'NIFTY', type: 'CE', action: 'buy',
          expiry: new Date().toISOString(), quantity: 1, price: -10,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('positive number');
    });

  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/fno/strategy/analyze
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /api/fno/strategy/analyze', () => {
    it('should analyze a single-leg strategy', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [
            { type: 'CE', strike: 23500, action: 'buy', premium: 185, quantity: 1 },
          ],
          spotPrice: 23456,
        },
      });

      expect(status).toBe(200);
      expect(body.maxProfit).toBeDefined();
      expect(body.maxLoss).toBeDefined();
      expect(body.breakevenPoints).toBeDefined();
      expect(body.pnlChart).toBeDefined();
      expect(body.pnlChart.length).toBeGreaterThan(0);
    });

    it('should analyze a multi-leg strategy (Iron Condor)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [
            { type: 'PE', strike: 23000, action: 'sell', premium: 120, quantity: 1 },
            { type: 'CE', strike: 24000, action: 'sell', premium: 80, quantity: 1 },
          ],
          spotPrice: 23456,
        },
      });

      expect(status).toBe(200);
      expect(body.breakevenPoints.length).toBeGreaterThanOrEqual(1);
      expect(body.totalLegs).toBe(2);
    });

    it('should reject when no legs provided', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: { legs: [], spotPrice: 23456 },
      });

      expect(status).toBe(400);
      expect(body.error).toContain('leg');
    });

    it('should return bullish bias for a long call', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [
            { type: 'CE', strike: 23500, action: 'buy', premium: 185, quantity: 1 },
          ],
          spotPrice: 23456,
        },
      });

      expect(status).toBe(200);
      expect(body.isBullish).toBe(true);
      expect(body.isBearish).toBe(false);
    });

    it('should return correct pnlChart shape', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [
            { type: 'CE', strike: 23500, action: 'buy', premium: 185, quantity: 1 },
          ],
          spotPrice: 23456,
        },
      });

      expect(status).toBe(200);
      const point = body.pnlChart[0];
      expect(point).toHaveProperty('underlyingPrice');
      expect(point).toHaveProperty('pnl');
      expect(point).toHaveProperty('legPnls');
      expect(Array.isArray(point.legPnls)).toBe(true);
    });

    // ── Edge Cases ───────────────────────────────────────────────────────

    it('should reject when legs is not an array', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: { legs: 'not-an-array', spotPrice: 23456 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('leg');
    });

    it('should reject when legs is null', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: { legs: null, spotPrice: 23456 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('leg');
    });

    it('should reject when legs field is missing entirely', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: { spotPrice: 23456 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('leg');
    });

    it('should handle missing spotPrice (uses default 23456.80)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [
            { type: 'CE', strike: 23500, action: 'buy', premium: 185, quantity: 1 },
          ],
        },
      });
      expect(status).toBe(200);
      expect(body.spotPrice).toBe(23456.80);
    });

    it('should handle leg with negative premium', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [
            { type: 'CE', strike: 23500, action: 'buy', premium: -185, quantity: 1 },
          ],
          spotPrice: 23456,
        },
      });
      // Negative premium is technically valid (just loses money faster)
      expect(status).toBe(200);
      expect(body.pnlChart.length).toBeGreaterThan(0);
    });

    it('should handle leg with zero strike', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [
            { type: 'CE', strike: 0, action: 'buy', premium: 185, quantity: 1 },
          ],
          spotPrice: 23456,
        },
      });
      // Zero strike means option is deep ITM, should still work
      expect(status).toBe(200);
      expect(body.isBullish).toBe(true);
    });

    it('should handle leg with very large strike', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [
            { type: 'CE', strike: 999999999, action: 'buy', premium: 1, quantity: 1 },
          ],
          spotPrice: 23456,
        },
      });
      // Deep OTM: PnL is constant (-premium) at all prices in range → neutral
      expect(status).toBe(200);
      expect(body.isNeutral).toBe(true);
      expect(body.pnlChart.every((p: any) => p.pnl === -1)).toBe(true);
    });

    it('should reject legs with missing fields (strike/premium)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [
            { type: 'CE', action: 'buy', quantity: 1 }, // missing strike and premium
          ],
          spotPrice: 23456,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('strike');
    });

    it('should reject invalid leg type (not CE/PE/FUTURE)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [
            { type: 'OPTION', strike: 23500, action: 'buy', premium: 185, quantity: 1 },
          ],
          spotPrice: 23456,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('type');
    });

    it('should handle many legs (10+) without performance issues', async () => {
      const legs = Array.from({ length: 10 }, (_, i) => ({
        type: 'CE' as const,
        strike: 23000 + i * 100,
        action: (i % 2 === 0 ? 'buy' : 'sell') as 'buy' | 'sell',
        premium: 100 + i * 10,
        quantity: 1,
      }));

      const startTime = Date.now();
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: { legs, spotPrice: 23456 },
      });
      const elapsed = Date.now() - startTime;

      expect(status).toBe(200);
      expect(body.totalLegs).toBe(10);
      expect(elapsed).toBeLessThan(500); // should complete in < 500ms
    });

    it('should handle FUTURE leg type in strategy analysis', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [
            { type: 'FUTURE', strike: 23500, action: 'buy', premium: 0, quantity: 1 },
          ],
          spotPrice: 23456,
        },
      });
      expect(status).toBe(200);
      expect(body.pnlChart.length).toBeGreaterThan(0);
      // Long future: P&L = underlyingPrice - strike = positive when price goes up
      expect(body.isBullish).toBe(true);
    });

    it('should handle negative spotPrice in strategy analysis', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [
            { type: 'CE', strike: 100, action: 'buy', premium: 10, quantity: 1 },
          ],
          spotPrice: -50,
        },
      });
      // Negative spot price means range becomes negative, step is negative
      expect(status).toBe(200);
      expect(body.pnlChart.length).toBeGreaterThan(0);
    });

    // ── Input Validation Error Paths ────────────────────────────────────

    it('should reject leg that is not an object (string)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: { legs: ['invalid-string'], spotPrice: 23456 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Leg at index 0');
    });

    it('should reject leg that is null', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: { legs: [null], spotPrice: 23456 },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('Leg at index 0');
    });

    it('should reject invalid action in leg', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [{ type: 'CE', strike: 23500, action: 'destroy', premium: 185, quantity: 1 }],
          spotPrice: 23456,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('invalid action');
      expect(body.error).toContain('destroy');
    });

    it('should reject leg with null strike', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [{ type: 'CE', strike: null, action: 'buy', premium: 185, quantity: 1 }],
          spotPrice: 23456,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('strike must be a non-negative number');
    });

    it('should reject leg with null premium', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [{ type: 'CE', strike: 23500, action: 'buy', premium: null, quantity: 1 }],
          spotPrice: 23456,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('premium must be a number');
    });

    it('should reject leg with missing quantity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [{ type: 'CE', strike: 23500, action: 'buy', premium: 185 }], // no quantity
          spotPrice: 23456,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('quantity must be a positive integer');
    });

    it('should reject leg with zero quantity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [{ type: 'CE', strike: 23500, action: 'buy', premium: 185, quantity: 0 }],
          spotPrice: 23456,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('quantity must be a positive integer');
    });

    it('should reject leg with non-integer quantity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [{ type: 'CE', strike: 23500, action: 'buy', premium: 185, quantity: 2.5 }],
          spotPrice: 23456,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('quantity must be a positive integer');
    });

    it('should reject leg with empty action string', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [{ type: 'CE', strike: 23500, action: '', premium: 185, quantity: 1 }],
          spotPrice: 23456,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('invalid action');
    });

    it('should reject leg with empty type string', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'POST', path: '/api/fno/strategy/analyze',
        body: {
          legs: [{ type: '', strike: 23500, action: 'buy', premium: 185, quantity: 1 }],
          spotPrice: 23456,
        },
      });
      expect(status).toBe(400);
      expect(body.error).toContain('invalid type');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/fno/prebuilt-strategies
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/fno/prebuilt-strategies', () => {
    it('should return pre-built strategy templates', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/prebuilt-strategies',
      });

      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(5);
    });

    it('should include common strategies like Long Call, Iron Condor', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/prebuilt-strategies',
      });

      expect(status).toBe(200);
      const ids = body.map((s: any) => s.id);
      expect(ids).toContain('long_call');
      expect(ids).toContain('iron_condor');
      expect(ids).toContain('long_straddle');
    });

    it('should include riskCategory and bias flags', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/prebuilt-strategies',
      });

      expect(status).toBe(200);
      const strategy = body[0];
      expect(['low', 'moderate', 'high']).toContain(strategy.riskCategory);
      expect(typeof strategy.isBullish).toBe('boolean');
      expect(typeof strategy.isNeutral).toBe('boolean');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/fno/positions
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/fno/positions', () => {
    it('should return open F&O positions', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/positions',
      });

      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it('should return position with all required fields', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/fno/positions',
      });

      expect(status).toBe(200);
      const position = body[0];
      expect(position).toHaveProperty('id');
      expect(position).toHaveProperty('symbol');
      expect(position).toHaveProperty('type');
      expect(position).toHaveProperty('action');
      expect(position).toHaveProperty('quantity');
      expect(position).toHaveProperty('entryPrice');
      expect(position).toHaveProperty('currentPrice');
      expect(position).toHaveProperty('pnl');
      expect(position).toHaveProperty('pnlPercent');
    });
  });
});
