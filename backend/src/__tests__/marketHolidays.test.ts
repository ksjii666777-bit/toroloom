/**
 * ============================================================================
 * Toroloom — Market Holidays Backend Tests
 * ============================================================================
 *
 * Covers:
 *   - getHolidaysForYear: fixed + rule-based + lunar merge, dedupe, sorting
 *     (Good Friday 2026 = 2026-04-03 via computus; nth-weekday rules)
 *   - GET /api/global-markets/holidays: single-country filter, year param,
 *     all-countries default, invalid country falls back to all
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import http from 'http';

import { getHolidaysForYear, MARKET_HOLIDAYS } from '../data/marketHolidays';

// ──── Unit tests for the data layer ────────────────────────────────────────

describe('getHolidaysForYear — data layer', () => {
  it('returns sorted concrete dates for India 2026', () => {
    const holidays = getHolidaysForYear('india', 2026);
    expect(holidays.length).toBeGreaterThan(8);

    const dates = holidays.map((h) => h.date);
    expect([...dates].sort()).toEqual(dates); // sorted ascending

    const goodFriday = holidays.find((h) => h.name === 'Good Friday');
    expect(goodFriday?.date).toBe('2026-04-03'); // computus check
  });

  it('includes Republic Day and Independence Day (fixed) for India', () => {
    const holidays = getHolidaysForYear('india', 2027);
    expect(holidays.some((h) => h.date === '2027-01-26' && h.name === 'Republic Day')).toBe(true);
    expect(holidays.some((h) => h.date === '2027-08-15')).toBe(true);
  });

  it('dedupes when a lunar entry collides with a fixed/rule entry', () => {
    const holidays = getHolidaysForYear('india', 2026);
    const on0403 = holidays.filter((h) => h.date === '2026-04-03');
    expect(on0403).toHaveLength(1); // Good Friday from rule, not duplicated
  });

  it('computes US Thanksgiving as 4th Thursday of November', () => {
    const th = getHolidaysForYear('us', 2026).find((h) => h.name === 'Thanksgiving');
    expect(th?.date).toBe('2026-11-26'); // 4th Thursday Nov 2026
  });

  it('computes UK Spring Bank Holiday as last Monday of May', () => {
    const spring = getHolidaysForYear('uk', 2026).find((h) => h.name === 'Spring Bank Holiday');
    expect(spring?.date).toBe('2026-05-25'); // last Monday May 2026
  });

  it('includes Spring Festival week for China 2026 (lunar table)', () => {
    const cn = getHolidaysForYear('china', 2026);
    expect(cn.some((h) => h.date === '2026-02-17' && h.name.includes('Spring Festival'))).toBe(true);
  });

  it('returns empty array for unknown countries', () => {
    expect(getHolidaysForYear('atlantis', 2026)).toEqual([]);
  });

  it('covers all eleven supported countries', () => {
    expect(Object.keys(MARKET_HOLIDAYS).sort()).toEqual([
      'australia', 'china', 'germany', 'hongkong', 'india', 'japan',
      'singapore', 'southkorea', 'switzerland', 'uk', 'us',
    ]);
  });
});

// ──── HTTP tests for the route ─────────────────────────────────────────────

vi.mock('../services/marketstack', () => ({
  marketstack: {
    getRealTimePrices: vi.fn().mockRejectedValue(new Error('Not configured')),
    getQuote: vi.fn().mockRejectedValue(new Error('Not configured')),
  },
  isMarketStackConfigured: vi.fn().mockReturnValue(false),
}));

import globalMarketsRoutes from '../routes/globalMarkets';

type ResResult = { status: number; body: any };

function request(server: http.Server, baseUrl: string, path: string): Promise<ResResult> {
  return new Promise((resolve, reject) => {
    http
      .get(new URL(path, baseUrl).toString(), (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

describe('GET /api/global-markets/holidays', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use('/api/global-markets', globalMarketsRoutes);
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  it('returns holidays for a single country + year', async () => {
    const res = await request(server, baseUrl, '/api/global-markets/holidays?country=japan&year=2026');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.japan.year).toBe(2026);
    const dates = res.body.data.japan.holidays.map((h: any) => h.date);
    expect(dates).toContain('2026-03-20'); // Vernal Equinox (lunar table)
    expect(dates).toContain('2026-07-20'); // Marine Day (3rd Mon Jul, rule)
  });

  it('defaults to all countries when no country param', async () => {
    const res = await request(server, baseUrl, '/api/global-markets/holidays?year=2026');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual([
      'australia', 'china', 'germany', 'hongkong', 'india', 'japan',
      'singapore', 'southkorea', 'switzerland', 'uk', 'us',
    ]);
  });

  it('falls back to all countries for an invalid country param', async () => {
    const res = await request(server, baseUrl, '/api/global-markets/holidays?country=narnia&year=2026');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data)).toHaveLength(11);
  });

  it('defaults year to the current year', async () => {
    const res = await request(server, baseUrl, '/api/global-markets/holidays?country=us');
    expect(res.status).toBe(200);
    expect(res.body.data.us.year).toBe(new Date().getUTCFullYear());
  });

  // ── Index history (sparklines) endpoint ──────────────────────────────

  it('indices/history returns 30 points per symbol ending near the current price', async () => {
    const res = await request(server, baseUrl, '/api/global-markets/indices/history?symbols=SPX');
    expect(res.status).toBe(200);
    const spx = res.body.data.SPX;
    expect(Array.isArray(spx)).toBe(true);
    expect(spx).toHaveLength(30);
    expect(spx[0]).toHaveProperty('timestamp');
    expect(spx[0]).toHaveProperty('price');
    expect(spx[29].price).toBeGreaterThan(0);
  });

  it('indices/history is deterministic within a day and filters by requested symbols', async () => {
    const res = await request(server, baseUrl, '/api/global-markets/indices/history?symbols=SPX,N225');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['N225', 'SPX']);

    const again = await request(server, baseUrl, '/api/global-markets/indices/history?symbols=SPX');
    expect(again.body.data.SPX).toEqual(res.body.data.SPX); // deterministic
  });
});
