/**
 * ============================================================================
 * Toroloom — Bond Dashboard Route Unit Tests
 * ============================================================================
 *
 * Tests all endpoints of the bonds route using raw http.request
 * (no supertest dependency).
 *
 * Endpoints:
 *   GET /api/bonds               — All bonds
 *   GET /api/bonds/:id           — Single bond by ID
 *   GET /api/bonds/category/:cat — Filter by category
 *   GET /api/bonds/summary       — Market summary + yield curve
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/bonds.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';

// ──── Import route ───────────────────────────────────────────────────────

import bondsRoutes from '../routes/bonds';

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

describe('Bond Routes — /api/bonds', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/bonds', bondsRoutes);

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
  // GET /api/bonds (all)
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/bonds', () => {
    it('should return an array of all bonds', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.bonds)).toBe(true);
      expect(body.count).toBeGreaterThan(0);
    });

    it('should return all 14 bonds', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds',
      });

      expect(status).toBe(200);
      expect(body.count).toBe(14);
      expect(body.bonds.length).toBe(14);
    });

    it('should include key fields for each bond', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds',
      });

      expect(status).toBe(200);
      const bond = body.bonds[0];
      expect(bond).toHaveProperty('id');
      expect(bond).toHaveProperty('name');
      expect(bond).toHaveProperty('issuer');
      expect(bond).toHaveProperty('category');
      expect(bond).toHaveProperty('couponRate');
      expect(bond).toHaveProperty('yieldToMaturity');
      expect(bond).toHaveProperty('maturityDate');
      expect(bond).toHaveProperty('yearsToMaturity');
      expect(bond).toHaveProperty('faceValue');
      expect(bond).toHaveProperty('currentPrice');
      expect(bond).toHaveProperty('rating');
      expect(bond).toHaveProperty('description');
    });

    it('should include all 3 bond categories', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds',
      });

      expect(status).toBe(200);
      const categories = new Set(body.bonds.map((b: any) => b.category));
      expect(categories.has('government')).toBe(true);
      expect(categories.has('state')).toBe(true);
      expect(categories.has('corporate')).toBe(true);
    });

    it('should include government bonds (G-Secs)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds',
      });

      expect(status).toBe(200);
      const ids = body.bonds.map((b: any) => b.id);
      expect(ids).toContain('bond_govt_1');
      expect(ids).toContain('bond_govt_3');
    });

    it('should include corporate bonds', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds',
      });

      expect(status).toBe(200);
      const ids = body.bonds.map((b: any) => b.id);
      expect(ids).toContain('bond_corp_1');
      expect(ids).toContain('bond_corp_7');
    });

    it('should return valid yield data across calls (cached after first)', async () => {
      const r1 = await request(server, baseUrl, { method: 'GET', path: '/api/bonds' });
      const r2 = await request(server, baseUrl, { method: 'GET', path: '/api/bonds' });

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      const yields1 = r1.body.bonds.map((b: any) => b.yieldToMaturity);
      const yields2 = r2.body.bonds.map((b: any) => b.yieldToMaturity);
      yields1.forEach((y: number) => expect(typeof y).toBe('number'));
      yields2.forEach((y: number) => expect(typeof y).toBe('number'));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/bonds/:id
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/bonds/:id', () => {
    it('should return a single bond by ID', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/bond_govt_1',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.bond.id).toBe('bond_govt_1');
      expect(body.bond.name).toContain('7.18% GS 2033');
      expect(body.bond.issuer).toContain('Government of India');
    });

    it('should return corporate bond by ID', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/bond_corp_2',
      });

      expect(status).toBe(200);
      expect(body.bond.category).toBe('corporate');
      expect(body.bond.issuer).toContain('HDFC Bank');
      expect(body.bond.rating).toBe('AAA');
    });

    it('should return state bond by ID', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/bond_state_1',
      });

      expect(status).toBe(200);
      expect(body.bond.category).toBe('state');
      expect(body.bond.issuer).toContain('Maharashtra');
    });

    it('should return 404 for unknown bond ID', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/bond_unknown_999',
      });

      expect(status).toBe(404);
      expect(body.error).toContain('not found');
    });

    it('should have numeric couponRate and yieldToMaturity', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/bond_corp_5',
      });

      expect(status).toBe(200);
      expect(typeof body.bond.couponRate).toBe('number');
      expect(body.bond.couponRate).toBeGreaterThan(0);
      expect(typeof body.bond.yieldToMaturity).toBe('number');
      expect(body.bond.yieldToMaturity).toBeGreaterThan(0);
    });

    it('should have valid yearsToMaturity above 0', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/bond_govt_1',
      });

      expect(status).toBe(200);
      expect(body.bond.yearsToMaturity).toBeGreaterThan(0);
    });

    it('should have currentPrice close to faceValue', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/bond_govt_1',
      });

      expect(status).toBe(200);
      // Government bonds trade near face value
      expect(body.bond.currentPrice).toBeGreaterThan(90);
      expect(body.bond.currentPrice).toBeLessThan(110);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/bonds/category/:cat
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/bonds/category/:cat', () => {
    it('should return only government bonds', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/category/government',
      });

      expect(status).toBe(200);
      expect(body.category).toBe('government');
      expect(body.count).toBe(5);
      for (const b of body.bonds) {
        expect(b.category).toBe('government');
      }
    });

    it('should return only state government bonds', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/category/state',
      });

      expect(status).toBe(200);
      expect(body.category).toBe('state');
      expect(body.count).toBe(2);
      for (const b of body.bonds) {
        expect(b.category).toBe('state');
      }
    });

    it('should return only corporate bonds', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/category/corporate',
      });

      expect(status).toBe(200);
      expect(body.category).toBe('corporate');
      expect(body.count).toBe(7);
      for (const b of body.bonds) {
        expect(b.category).toBe('corporate');
      }
    });

    it('should return 400 for invalid category', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/category/invalid',
      });

      expect(status).toBe(400);
      expect(body.error).toContain('Invalid category');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/bonds/summary
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/bonds/summary', () => {
    it('should return bond market summary', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/summary',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('total');
      expect(body.data).toHaveProperty('government');
      expect(body.data).toHaveProperty('state');
      expect(body.data).toHaveProperty('corporate');
      expect(body.data).toHaveProperty('yieldCurve');
      expect(body.data).toHaveProperty('updatedAt');
    });

    it('should return correct bond counts', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/summary',
      });

      expect(status).toBe(200);
      expect(body.data.total).toBe(14);
      expect(body.data.government.count).toBe(5);
      expect(body.data.state.count).toBe(2);
      expect(body.data.corporate.count).toBe(7);
    });

    it('should have positive avgYTM for government bonds', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/summary',
      });

      expect(status).toBe(200);
      expect(body.data.government.avgYTM).toBeGreaterThan(0);
      expect(body.data.government.avgCoupon).toBeGreaterThan(0);
    });

    it('should have yieldCurve as an array with 5 buckets', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/summary',
      });

      expect(status).toBe(200);
      expect(Array.isArray(body.data.yieldCurve)).toBe(true);
      expect(body.data.yieldCurve.length).toBe(5);
    });

    it('should have yield curve buckets in order (short to long)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/summary',
      });

      expect(status).toBe(200);
      const labels = body.data.yieldCurve.map((y: any) => y.label);
      expect(labels).toEqual(['<1Y', '1-3Y', '3-5Y', '5-10Y', '10Y+']);
    });

    it('should have each yield curve bucket with avgYield and count', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/summary',
      });

      expect(status).toBe(200);
      for (const bucket of body.data.yieldCurve) {
        expect(bucket).toHaveProperty('label');
        expect(bucket).toHaveProperty('avgYield');
        expect(bucket).toHaveProperty('count');
        expect(bucket.count).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have updatedAt as ISO timestamp', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds/summary',
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
    it('should have valid ratings for all bonds', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds',
      });

      expect(status).toBe(200);
      const validRatings = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC'];
      for (const b of body.bonds) {
        expect(validRatings).toContain(b.rating);
      }
    });

    it('should have couponRate greater than yieldToMaturity for premium bonds (price > 100)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds',
      });

      expect(status).toBe(200);
      for (const b of body.bonds) {
        if (b.currentPrice > b.faceValue) {
          expect(b.couponRate).toBeGreaterThanOrEqual(b.yieldToMaturity);
        }
      }
    });

    it('should have nominal faceValue of 100', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds',
      });

      expect(status).toBe(200);
      for (const b of body.bonds) {
        expect(b.faceValue).toBe(100);
      }
    });

    it('should work without auth headers', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should respond within reasonable time', async () => {
      const start = Date.now();
      const { status } = await request(server, baseUrl, {
        method: 'GET', path: '/api/bonds',
      });
      const elapsed = Date.now() - start;

      expect(status).toBe(200);
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
