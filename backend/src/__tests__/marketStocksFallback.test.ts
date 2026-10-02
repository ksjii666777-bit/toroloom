/**
 * ============================================================================
 * Toroloom — /api/market/stocks Last-Known-Good Fallback Tests
 * ============================================================================
 *
 * Production regression (Oct 2026): /api/market/stocks intermittently 500s
 * while /api/market/quotes, /indices and /search keep working — the broker's
 * getStocks() path fails independently of the rest. The route now keeps the
 * last successful snapshot and serves it when the broker fails, so the
 * stock-list screen never goes dark.
 *
 * Covered:
 *   1. Broker fails + no snapshot yet          → 500 (unchanged behavior)
 *   2. Broker succeeds                          → 200, snapshot recorded
 *   3. Broker fails again (fresh cache miss)   → 200 with the stale snapshot
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/marketStocksFallback.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import http from 'http';

// Mock the broker service — the route only uses getBroker() from it.
vi.mock('../services/broker', () => ({
  getBroker: vi.fn(),
  resetBroker: vi.fn(),
}));

// Import AFTER mocks
import { getBroker, resetBroker } from '../services/broker';
import { marketCache } from '../services/cache';
import marketRoutes from '../routes/market';

const mockGetBroker = vi.mocked(getBroker);
const mockResetBroker = vi.mocked(resetBroker);

// ──── Minimal http.request helper (same pattern as globalStocks.test.ts) ────

type ResResult = { status: number; body: any };

function request(
  server: http.Server,
  baseUrl: string,
  opts: { method: string; path: string; headers?: Record<string, string> },
): Promise<ResResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, baseUrl);
    const req = http.request(
      url.toString(),
      { method: opts.method, headers: { 'Content-Type': 'application/json', ...opts.headers } },
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
    req.end();
  });
}

// ──── Fixtures ──────────────────────────────────────────────────────────────

const SAMPLE_STOCKS = [
  {
    id: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.',
    sector: 'Energy', price: 2900, change: 10, changePercent: 0.35, isPositive: true,
    marketCap: '₹19,56,000 Cr', volume: '12.5M', high52: 3020, low52: 2200,
  },
  {
    id: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services Ltd.',
    sector: 'IT', price: 4100, change: -15, changePercent: -0.36, isPositive: false,
    marketCap: '₹14,80,000 Cr', volume: '4.2M', high52: 4300, low52: 3200,
  },
];

// ──── Tests ─────────────────────────────────────────────────────────────────

describe('GET /api/market/stocks — last-known-good fallback', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/market', marketRoutes);
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
    const port = (server.address() as any).port;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(() => {
    server?.close();
  });

  it('returns 500 when the broker fails and no last-good snapshot exists', async () => {
    mockGetBroker.mockResolvedValue({
      getStocks: vi.fn().mockRejectedValue(new Error('upstream feed down')),
    } as any);

    const { status, body } = await request(server, baseUrl, {
      method: 'GET', path: '/api/market/stocks',
    });

    expect(status).toBe(500);
    expect(body.error).toBeTruthy();
  });

  it('returns 200 and records the snapshot when the broker succeeds', async () => {
    mockGetBroker.mockResolvedValue({
      getStocks: vi.fn().mockResolvedValue(SAMPLE_STOCKS),
    } as any);

    const { status, body } = await request(server, baseUrl, {
      method: 'GET', path: '/api/market/stocks',
    });

    expect(status).toBe(200);
    expect(body[0].symbol).toBe('RELIANCE');
    expect(body.length).toBe(2);
  });

  it('serves the stale snapshot (200) on a later broker failure instead of 500', async () => {
    // Force a fresh broker call: without this the route would serve the
    // still-fresh cached list and never exercise the fallback.
    marketCache.delete('stocks');
    mockGetBroker.mockResolvedValue({
      getStocks: vi.fn().mockRejectedValue(new Error('kite token expired')),
    } as any);

    const { status, body } = await request(server, baseUrl, {
      method: 'GET', path: '/api/market/stocks',
    });

    expect(status).toBe(200);
    expect(body[0].symbol).toBe('RELIANCE');
    expect(body.length).toBe(2);
  });

  it('recovers with FRESH data via broker reset + failover when the cached instance is half-dead', async () => {
    marketCache.delete('stocks');
    mockGetBroker.mockReset();
    // 1st getBroker() call → half-dead instance (isConnected() true but
    // getStocks throws); 2nd call (after resetBroker) → healthy instance
    // serving a DIFFERENT list, so the test proves fresh data, not staleness.
    const freshStocks = [
      { id: 'INFY', symbol: 'INFY', name: 'Infosys Ltd.', sector: 'IT',
        price: 1850, change: 22, changePercent: 1.2, isPositive: true,
        marketCap: '₹7,70,000 Cr', volume: '6.8M', high52: 2000, low52: 1400 },
    ];
    mockGetBroker
      .mockResolvedValueOnce({ getStocks: vi.fn().mockRejectedValue(new Error('session dead')) } as any)
      .mockResolvedValueOnce({ getStocks: vi.fn().mockResolvedValue(freshStocks) } as any);

    const { status, body } = await request(server, baseUrl, {
      method: 'GET', path: '/api/market/stocks',
    });

    expect(status).toBe(200);
    expect(mockResetBroker).toHaveBeenCalled();
    expect(body[0].symbol).toBe('INFY');
  });
});
