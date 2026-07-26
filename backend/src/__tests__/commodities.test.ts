/**
 * ============================================================================
 * Toroloom — Commodity Markets Route Unit Tests
 * ============================================================================
 *
 * Tests all endpoints of the commodities route using raw http.request
 * (no supertest dependency).
 *
 * Endpoints:
 *   GET /api/commodities              — All commodities
 *   GET /api/commodities/:id          — Single commodity by ID
 *   GET /api/commodities/category/:cat — Filter by category
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/commodities.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';

// ──── Import route ───────────────────────────────────────────────────────

import commoditiesRoutes from '../routes/commodities';

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

describe('Commodity Routes — /api/commodities', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/commodities', commoditiesRoutes);

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
  // GET /api/commodities (all)
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/commodities', () => {
    it('should return an array of all commodities', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.commodities)).toBe(true);
      expect(body.count).toBeGreaterThan(0);
    });

    it('should return all 13 commodities', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities',
      });

      expect(status).toBe(200);
      expect(body.count).toBe(13);
      expect(body.commodities.length).toBe(13);
    });

    it('should include key fields for each commodity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities',
      });

      expect(status).toBe(200);
      const commodity = body.commodities[0];
      expect(commodity).toHaveProperty('id');
      expect(commodity).toHaveProperty('name');
      expect(commodity).toHaveProperty('symbol');
      expect(commodity).toHaveProperty('category');
      expect(commodity).toHaveProperty('price');
      expect(commodity).toHaveProperty('change');
      expect(commodity).toHaveProperty('changePercent');
      expect(commodity).toHaveProperty('unit');
      expect(commodity).toHaveProperty('icon');
      expect(commodity).toHaveProperty('color');
    });

    it('should include Gold and Crude Oil', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities',
      });

      expect(status).toBe(200);
      const ids = body.commodities.map((c: any) => c.id);
      expect(ids).toContain('gold');
      expect(ids).toContain('crude');
      expect(ids).toContain('silver');
      expect(ids).toContain('copper');
    });

    it('should cover all 3 categories (metals, energy, agriculture)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities',
      });

      expect(status).toBe(200);
      const categories = new Set(body.commodities.map((c: any) => c.category));
      expect(categories.has('metals')).toBe(true);
      expect(categories.has('energy')).toBe(true);
      expect(categories.has('agriculture')).toBe(true);
    });

    it('should have trend description for each commodity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities',
      });

      expect(status).toBe(200);
      for (const c of body.commodities) {
        expect(c.trend).toBeTruthy();
        expect(typeof c.trend).toBe('string');
      }
    });

    it('should return valid prices across calls (cached after first)', async () => {
      const r1 = await request(server, baseUrl, { method: 'GET', path: '/api/commodities' });
      const r2 = await request(server, baseUrl, { method: 'GET', path: '/api/commodities' });

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      const prices1 = r1.body.commodities.map((c: any) => c.price);
      const prices2 = r2.body.commodities.map((c: any) => c.price);
      prices1.forEach((p: number) => expect(typeof p).toBe('number'));
      prices2.forEach((p: number) => expect(typeof p).toBe('number'));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/commodities/:id
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/commodities/:id', () => {
    it('should return a single commodity by ID', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities/gold',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.commodity.id).toBe('gold');
      expect(body.commodity.name).toBe('Gold');
      expect(body.commodity.symbol).toBe('XAUUSD');
    });

    it('should return energy commodity (crude)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities/crude',
      });

      expect(status).toBe(200);
      expect(body.commodity.category).toBe('energy');
      expect(body.commodity.unit).toBe('barrel');
    });

    it('should return agriculture commodity (wheat)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities/wheat',
      });

      expect(status).toBe(200);
      expect(body.commodity.category).toBe('agriculture');
      expect(body.commodity.icon).toBe('🌾');
    });

    it('should return 404 for unknown commodity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities/unknown123',
      });

      expect(status).toBe(404);
      expect(body.error).toContain('not found');
    });

    it('should be case-insensitive', async () => {
      const r1 = await request(server, baseUrl, { method: 'GET', path: '/api/commodities/GOLD' });
      const r2 = await request(server, baseUrl, { method: 'GET', path: '/api/commodities/gold' });

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r1.body.commodity.id).toBe('gold');
      expect(r2.body.commodity.id).toBe('gold');
    });

    it('should include global inventory stat', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities/copper',
      });

      expect(status).toBe(200);
      expect(body.commodity.stat).toBeTruthy();
      expect(typeof body.commodity.stat).toBe('string');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/commodities/category/:cat
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/commodities/category/:cat', () => {
    it('should return only metals when filtering by metals', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities/category/metals',
      });

      expect(status).toBe(200);
      expect(body.category).toBe('metals');
      expect(body.count).toBeGreaterThan(0);
      for (const c of body.commodities) {
        expect(c.category).toBe('metals');
      }
    });

    it('should return only energy commodities', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities/category/energy',
      });

      expect(status).toBe(200);
      expect(body.category).toBe('energy');
      expect(body.count).toBeGreaterThan(0);
      for (const c of body.commodities) {
        expect(c.category).toBe('energy');
      }
    });

    it('should return only agriculture commodities', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities/category/agriculture',
      });

      expect(status).toBe(200);
      expect(body.category).toBe('agriculture');
      expect(body.count).toBeGreaterThan(0);
      for (const c of body.commodities) {
        expect(c.category).toBe('agriculture');
      }
    });

    it('should return 7 metals (precious + base)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities/category/metals',
      });

      expect(status).toBe(200);
      expect(body.count).toBe(7);
    });

    it('should return 3 energy commodities', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities/category/energy',
      });

      expect(status).toBe(200);
      expect(body.count).toBe(3);
    });

    it('should return 3 agriculture commodities', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities/category/agriculture',
      });

      expect(status).toBe(200);
      expect(body.count).toBe(3);
    });

    it('should return 400 for invalid category', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities/category/invalid',
      });

      expect(status).toBe(400);
      expect(body.error).toContain('Invalid category');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should have numeric prices for all commodities', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities',
      });

      expect(status).toBe(200);
      for (const c of body.commodities) {
        expect(typeof c.price).toBe('number');
        expect(c.price).toBeGreaterThan(0);
      }
    });

    it('should have unit for every commodity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities',
      });

      expect(status).toBe(200);
      const units = body.commodities.map((c: any) => c.unit);
      expect(units).toContain('oz');
      expect(units).toContain('barrel');
      expect(units).toContain('bushel');
    });

    it('should respond within reasonable time', async () => {
      const start = Date.now();
      const { status } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities',
      });
      const elapsed = Date.now() - start;

      expect(status).toBe(200);
      expect(elapsed).toBeLessThan(1000);
    });

    it('should work without auth headers', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/commodities',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });
  });
});
