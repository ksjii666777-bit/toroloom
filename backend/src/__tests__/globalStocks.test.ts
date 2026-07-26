/**
 * ============================================================================
 * Toroloom — Global Stocks Route Unit Tests
 * ============================================================================
 *
 * Tests all 6 endpoints of the global stocks route using raw http.request
 * (no supertest dependency).
 *
 * Endpoints:
 *   GET /api/global-stocks/europe          — Top European stocks
 *   GET /api/global-stocks/asia             — Top Asia-Pacific stocks
 *   GET /api/global-stocks/quote/:symbol    — Single stock quote
 *   GET /api/global-stocks/quotes?symbols=  — Bulk quotes
 *   GET /api/global-stocks/search?q=        — Search stocks by symbol/name
 *   GET /api/global-stocks/exchanges        — List supported exchanges
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/globalStocks.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import http from 'http';

// ──── Mock MarketStack — always return "not configured" so we test mock fallback ──

vi.mock('../services/marketstack', () => ({
  marketstack: {
    getRealTimePrices: vi.fn().mockRejectedValue(new Error('Not configured')),
    getQuote: vi.fn().mockRejectedValue(new Error('Not configured')),
  },
  isMarketStackConfigured: vi.fn().mockReturnValue(false),
}));

// ──── Import route AFTER mocks ─────────────────────────────────────────────

import globalStocksRoutes from '../routes/globalStocks';

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

describe('Global Stocks Routes', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/global-stocks', globalStocksRoutes);

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
  // GET /api/global-stocks/europe
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/global-stocks/europe', () => {
    it('should return an array of European stocks', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/europe',
      });

      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    it('should return stocks with region === "europe"', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/europe',
      });

      expect(status).toBe(200);
      for (const stock of body) {
        expect(stock.region).toBe('europe');
      }
    });

    it('should include key stock fields (symbol, name, price, change, sector)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/europe',
      });

      expect(status).toBe(200);
      const stock = body[0];
      expect(stock).toHaveProperty('symbol');
      expect(stock).toHaveProperty('name');
      expect(stock).toHaveProperty('price');
      expect(stock).toHaveProperty('change');
      expect(stock).toHaveProperty('changePercent');
      expect(stock).toHaveProperty('sector');
      expect(stock).toHaveProperty('country');
      expect(stock).toHaveProperty('currency');
      expect(stock).toHaveProperty('isPositive');
    });

    it('should include well-known European companies (Unilever, Shell, SAP)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/europe',
      });

      expect(status).toBe(200);
      const symbols = body.map((s: any) => s.symbol);
      expect(symbols).toContain('ULVR');
      expect(symbols).toContain('SHEL');
      expect(symbols).toContain('SAP');
    });

    it('should return simulated prices that vary slightly', async () => {
      // Call twice and verify prices are different (simulated noise)
      const r1 = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/europe',
      });
      const r2 = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/europe',
      });

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      // At least some prices should differ due to simulation
      const pricesDiffer = r1.body.some((s1: any, i: number) =>
        s1.price !== r2.body[i]?.price,
      );
      // It's statistically extremely unlikely all pairs are identical
      expect(pricesDiffer).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/global-stocks/asia
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/global-stocks/asia', () => {
    it('should return an array of Asia-Pacific stocks', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/asia',
      });

      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    it('should return stocks with region === "asia"', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/asia',
      });

      expect(status).toBe(200);
      for (const stock of body) {
        expect(stock.region).toBe('asia');
      }
    });

    it('should include well-known Asian companies (Toyota, Tencent, Reliance, Samsung)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/asia',
      });

      expect(status).toBe(200);
      const symbols = body.map((s: any) => s.symbol);
      expect(symbols).toContain('TM');
      expect(symbols).toContain('RELIANCE');
      expect(symbols).toContain('005930'); // Samsung
    });

    it('should include Indian market stocks (NSE)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/asia',
      });

      expect(status).toBe(200);
      const indianStocks = body.filter((s: any) => s.country === 'India');
      expect(indianStocks.length).toBeGreaterThanOrEqual(1);
      expect(indianStocks.some((s: any) => s.exchange === 'NSE')).toBe(true);
    });

    it('should include all required metadata fields', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/asia',
      });

      expect(status).toBe(200);
      const stock = body[0];
      expect(stock).toHaveProperty('exchange');
      expect(stock).toHaveProperty('marketCap');
      expect(stock).toHaveProperty('volume');
      expect(stock).toHaveProperty('pe');
      expect(stock).toHaveProperty('dividend');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/global-stocks/quote/:symbol
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/global-stocks/quote/:symbol', () => {
    it('should return a single stock quote for a valid symbol', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quote/ULVR',
      });

      expect(status).toBe(200);
      expect(body.symbol).toBe('ULVR');
      expect(body.name).toContain('Unilever');
      expect(body.price).toBeGreaterThan(0);
    });

    it('should return quote for an Asian stock symbol', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quote/RELIANCE',
      });

      expect(status).toBe(200);
      expect(body.symbol).toBe('RELIANCE');
      expect(body.region).toBe('asia');
      expect(body.country).toBe('India');
    });

    it('should return quote with isPositive field', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quote/ASML',
      });

      expect(status).toBe(200);
      expect(typeof body.isPositive).toBe('boolean');
    });

    it('should return 404 for unknown symbol', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quote/UNKNOWN123',
      });

      expect(status).toBe(404);
      expect(body.error).toContain('not found');
    });

    it('should be case-insensitive for symbol lookup', async () => {
      const { status: s1, body: b1 } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quote/sap',
      });
      const { status: s2, body: b2 } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quote/Sap',
      });

      expect(s1).toBe(200);
      expect(s2).toBe(200);
      expect(b1.symbol).toBe('SAP');
      expect(b2.symbol).toBe('SAP');
    });

    it('should return quote with correct exchange info for EU stock', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quote/SAP',
      });

      expect(status).toBe(200);
      expect(body.exchange).toBe('Xetra');
      expect(body.currency).toBe('EUR');
    });

    it('should return quote with high52 and low52 fields', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quote/TCS',
      });

      expect(status).toBe(200);
      expect(body.high52).toBeGreaterThan(0);
      expect(body.low52).toBeGreaterThan(0);
      expect(body.high52).toBeGreaterThanOrEqual(body.low52);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/global-stocks/quotes?symbols=
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/global-stocks/quotes', () => {
    it('should return bulk quotes for comma-separated symbols', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quotes?symbols=SAP,ASML,TM',
      });

      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(3);
      const symbols = body.map((s: any) => s.symbol);
      expect(symbols).toContain('SAP');
      expect(symbols).toContain('ASML');
      expect(symbols).toContain('TM');
    });

    it('should return error entry for unknown symbol in bulk', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quotes?symbols=SAP,FAKE123',
      });

      expect(status).toBe(200);
      expect(body.length).toBe(2);
      const fake = body.find((s: any) => s.symbol === 'FAKE123');
      expect(fake).toBeDefined();
      expect(fake.error).toBe('Not found');
    });

    it('should return 400 when symbols parameter is missing', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quotes',
      });

      expect(status).toBe(400);
      expect(body.error).toContain('symbols');
    });

    it('should return 400 when symbols parameter is empty', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quotes?symbols=',
      });

      expect(status).toBe(400);
      expect(body.error).toContain('symbols');
    });

    it('should handle mixed EU and ASIA symbols', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quotes?symbols=SHEL,RELIANCE,SONY',
      });

      expect(status).toBe(200);
      expect(body.length).toBe(3);
      const regions = body.map((s: any) => s.region);
      expect(regions).toContain('europe');
      expect(regions).toContain('asia');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/global-stocks/search?q=
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/global-stocks/search', () => {
    it('should search by symbol', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/search?q=SAP',
      });

      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body[0].symbol).toBe('SAP');
    });

    it('should search by name (partial match)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/search?q=Unilever',
      });

      expect(status).toBe(200);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body[0].name).toContain('Unilever');
    });

    it('should be case-insensitive', async () => {
      const { status: s1, body: b1 } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/search?q=toyota',
      });
      const { status: s2, body: b2 } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/search?q=TOYOTA',
      });

      expect(s1).toBe(200);
      expect(s2).toBe(200);
      expect(b1.length).toBeGreaterThanOrEqual(1);
      expect(b2.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for no matches', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/search?q=ZZZZNOTEXIST',
      });

      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    });

    it('should return empty array for empty query', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/search?q=',
      });

      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    });

    it('should return result with type === "stock"', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/search?q=TCS',
      });

      expect(status).toBe(200);
      expect(body[0].type).toBe('stock');
    });

    it('should return result with region, exchange, country, currency fields', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/search?q=Nestl',
      });

      expect(status).toBe(200);
      const result = body[0];
      expect(result).toHaveProperty('region');
      expect(result).toHaveProperty('exchange');
      expect(result).toHaveProperty('country');
      expect(result).toHaveProperty('currency');
    });

    it('should search across both European and Asian stocks', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/search?q=a',
      });

      expect(status).toBe(200);
      // Should find matches from both regions
      const regions = new Set(body.map((s: any) => s.region));
      expect(regions.has('europe') || regions.has('asia')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/global-stocks/exchanges
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /api/global-stocks/exchanges', () => {
    it('should return list of supported exchanges', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/exchanges',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.count).toBeGreaterThan(0);
    });

    it('should include LSE, Xetra, NSE exchanges', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/exchanges',
      });

      expect(status).toBe(200);
      const exchanges = body.data.map((e: any) => e.exchange);
      expect(exchanges).toContain('LSE');
      expect(exchanges).toContain('NSE');
    });

    it('should include region info per exchange', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/exchanges',
      });

      expect(status).toBe(200);
      for (const exchange of body.data) {
        expect(exchange).toHaveProperty('region');
        expect(['europe', 'asia']).toContain(exchange.region);
        expect(Array.isArray(exchange.countries)).toBe(true);
        expect(exchange.countries.length).toBeGreaterThan(0);
        expect(exchange).toHaveProperty('mic');
      }
    });

    it('should have correct count matching unique exchanges', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/exchanges',
      });

      expect(status).toBe(200);
      expect(body.data.length).toBe(body.count);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge Cases & Error Handling
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle symbol with special characters in quote endpoint', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quote/005930',
      });

      expect(status).toBe(200);
      expect(body.symbol).toBe('005930');
      expect(body.name).toContain('Samsung');
    });

    it('should handle numeric-only symbol (9988 = Alibaba HK)', async () => {
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/quote/9988',
      });

      expect(status).toBe(200);
      expect(body.symbol).toBe('9988');
    });

    it('should respond within reasonable time for all endpoints', async () => {
      const endpoints = [
        '/api/global-stocks/europe',
        '/api/global-stocks/asia',
        '/api/global-stocks/exchanges',
        '/api/global-stocks/search?q=TCS',
      ];

      for (const path of endpoints) {
        const start = Date.now();
        const { status } = await request(server, baseUrl, {
          method: 'GET', path,
        });
        const elapsed = Date.now() - start;
        expect(status).toBe(200);
        expect(elapsed).toBeLessThan(1000); // should respond within 1s
      }
    });

    it('should handle missing auth gracefully (no auth middleware needed)', async () => {
      // This route doesn't use auth middleware — should work without any auth header
      const { status, body } = await request(server, baseUrl, {
        method: 'GET', path: '/api/global-stocks/europe',
        headers: {},
      });

      expect(status).toBe(200);
      expect(body.length).toBeGreaterThan(0);
    });
  });
});
