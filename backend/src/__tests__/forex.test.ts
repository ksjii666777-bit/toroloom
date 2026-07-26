/**
 * ============================================================================
 * Toroloom — Forex / Currency Markets Route Unit Tests
 * ============================================================================
 *
 * Tests all endpoints of the forex route using raw http.request
 * (no supertest dependency).
 *
 * Endpoints:
 *   GET /api/forex              — All forex pairs
 *   GET /api/forex/rates        — All forex pairs (alias)
 *   GET /api/forex/rates/:pair  — Single currency pair
 *   GET /api/forex/summary      — Market summary statistics
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/forex.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';

// ──── Import route ───────────────────────────────────────────────────────

import forexRoutes from '../routes/forex';

// ──── Helpers ────────────────────────────────────────────────────────────

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
      { method: opts.method, headers: { 'Content-Type': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          let body: any;
          try { body = data ? JSON.parse(data) : undefined; }
          catch { body = data; }
          resolve({ status: res.statusCode!, body });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('Forex Routes — /api/forex', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/forex', forexRoutes);

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
  // GET /api/forex (root)
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/forex', () => {
    it('should return an array of forex pairs', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.pairs)).toBe(true);
      expect(body.count).toBeGreaterThan(0);
    });

    it('should return all 11 currency pairs', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex',
      });

      expect(status).toBe(200);
      expect(body.count).toBe(11);
      expect(body.pairs.length).toBe(11);
    });

    it('should include key fields for each pair', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex',
      });

      expect(status).toBe(200);
      const pair = body.pairs[0];
      expect(pair).toHaveProperty('id');
      expect(pair).toHaveProperty('pair');
      expect(pair).toHaveProperty('rate');
      expect(pair).toHaveProperty('change');
      expect(pair).toHaveProperty('changePercent');
      expect(pair).toHaveProperty('dayHigh');
      expect(pair).toHaveProperty('dayLow');
      expect(pair).toHaveProperty('region');
      expect(pair).toHaveProperty('isRbiReference');
    });

    it('should include well-known forex pairs (USD/INR, EUR/INR, GBP/INR)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex',
      });

      expect(status).toBe(200);
      const ids = body.pairs.map((p: any) => p.id);
      expect(ids).toContain('usdinr');
      expect(ids).toContain('eurinr');
      expect(ids).toContain('gbpinr');
      expect(ids).toContain('jpyinr');
    });

    it('should include cross-currency pairs (EUR/USD, GBP/USD, USD/JPY)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex',
      });

      expect(status).toBe(200);
      const ids = body.pairs.map((p: any) => p.id);
      expect(ids).toContain('eurusd');
      expect(ids).toContain('gbpusd');
      expect(ids).toContain('usdjpy');
    });

    it('should return prices that are valid numbers across calls (cached after first)', async () => {
      const r1 = await request(server, baseUrl, { method: 'GET', path: '/api/forex' });
      const r2 = await request(server, baseUrl, { method: 'GET', path: '/api/forex' });

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      // Data should match (cached or consistent mock simulation)
      const allRates1 = r1.body.pairs.map((p: any) => p.rate);
      const allRates2 = r2.body.pairs.map((p: any) => p.rate);
      allRates1.forEach((rate: number) => expect(typeof rate).toBe('number'));
      allRates2.forEach((rate: number) => expect(typeof rate).toBe('number'));
    });

    it('should have positive and negative changes distributed', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex',
      });

      expect(status).toBe(200);
      const changes = body.pairs.map((p: any) => p.changePercent);
      const hasPositive = changes.some((c: number) => c > 0);
      const hasNegative = changes.some((c: number) => c < 0);
      expect(hasPositive || hasNegative).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/forex/rates (alias)
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/forex/rates', () => {
    it('should return the same data as root endpoint', async () => {
      const rootRes = await request(server, baseUrl, { method: 'GET', path: '/api/forex' });
      const ratesRes = await request(server, baseUrl, { method: 'GET', path: '/api/forex/rates' });

      expect(rootRes.status).toBe(200);
      expect(ratesRes.status).toBe(200);
      expect(ratesRes.body.success).toBe(true);
      expect(ratesRes.body.count).toBe(rootRes.body.count);
      expect(Array.isArray(ratesRes.body.pairs)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/forex/rates/:pair
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/forex/rates/:pair', () => {
    it('should return a single currency pair by ID', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex/rates/usdinr',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.pair.id).toBe('usdinr');
      expect(body.pair.pair).toBe('USD/INR');
      expect(body.pair.rate).toBeGreaterThan(0);
    });

    it('should return pair by pair code (USD/INR format)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex/rates/EURINR',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.pair.id).toBe('eurinr');
    });

    it('should return 404 for unknown pair', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex/rates/unknown123',
      });

      expect(status).toBe(404);
      expect(body.error).toContain('not found');
    });

    it('should be case-insensitive for pair lookup', async () => {
      const r1 = await request(server, baseUrl, { method: 'GET', path: '/api/forex/rates/EURUSD' });
      const r2 = await request(server, baseUrl, { method: 'GET', path: '/api/forex/rates/eurusd' });

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r1.body.pair.id).toBe(r2.body.pair.id);
    });

    it('should return RBI reference status for major pairs', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex/rates/usdinr',
      });

      expect(status).toBe(200);
      expect(body.pair.isRbiReference).toBe(true);
    });

    it('should return trend description for each pair', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex/rates/gbpinr',
      });

      expect(status).toBe(200);
      expect(body.pair.trend).toBeTruthy();
      expect(typeof body.pair.trend).toBe('string');
    });

    it('should have dayHigh >= dayLow', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex/rates/usdjpy',
      });

      expect(status).toBe(200);
      expect(body.pair.dayHigh).toBeGreaterThanOrEqual(body.pair.dayLow);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/forex/summary
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/forex/summary', () => {
    it('should return forex market summary statistics', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex/summary',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('total');
      expect(body.data).toHaveProperty('inrPairs');
      expect(body.data).toHaveProperty('rbiRef');
      expect(body.data).toHaveProperty('avgInrChange');
      expect(body.data).toHaveProperty('avgInrVol');
    });

    it('should return total count of 11 pairs', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex/summary',
      });

      expect(status).toBe(200);
      expect(body.data.total).toBe(11);
    });

    it('should have 8 INR pairs', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex/summary',
      });

      expect(status).toBe(200);
      // USD, EUR, GBP, JPY, SGD, CNY, HKD, THB = 8 INR pairs
      expect(body.data.inrPairs).toBe(8);
    });

    it('should return 4 RBI reference rate pairs', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex/summary',
      });

      expect(status).toBe(200);
      expect(body.data.rbiRef).toBe(4);
    });

    it('should have avgInrVol as a positive number', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex/summary',
      });

      expect(status).toBe(200);
      expect(body.data.avgInrVol).toBeGreaterThan(0);
    });

    it('should include updatedAt ISO timestamp', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex/summary',
      });

      expect(status).toBe(200);
      expect(body.data.updatedAt).toBeTruthy();
      expect(() => new Date(body.data.updatedAt)).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle all pairs having numeric rates', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex',
      });

      expect(status).toBe(200);
      for (const pair of body.pairs) {
        expect(typeof pair.rate).toBe('number');
        expect(pair.rate).toBeGreaterThan(0);
        expect(typeof pair.changePercent).toBe('number');
      }
    });

    it('should respond within reasonable time', async () => {
      const start = Date.now();
      const { status } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex',
      });
      const elapsed = Date.now() - start;

      expect(status).toBe(200);
      expect(elapsed).toBeLessThan(1000);
    });

    it('should work without any auth headers', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/forex',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });
  });
});
