/**
 * ============================================================================
 * Toroloom — Economic Calendar Route Unit Tests
 * ============================================================================
 *
 * Tests all endpoints of the economic calendar route using raw http.request
 * (no supertest dependency).
 *
 * Endpoints:
 *   GET /api/economic-calendar              — All events
 *   GET /api/economic-calendar/upcoming     — Events in the next N days
 *   GET /api/economic-calendar/summary      — Stats
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/economicCalendar.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import http from 'http';

// The route uses the service which falls back to mock data when FMP_API_KEY
// is not set. Ensure a clean slate: force the mock path.
vi.stubEnv('FMP_API_KEY', '');

import economicCalendarRoutes from '../routes/economicCalendar';

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

describe('Economic Calendar Routes — /api/economic-calendar', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/economic-calendar', economicCalendarRoutes);

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
    server.close();
  });

  it('GET / — returns all events sorted by date', async () => {
    const res = await request(server, baseUrl, { method: 'GET', path: '/api/economic-calendar' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events.length).toBeGreaterThan(0);
    // Mock fallback when no FMP_API_KEY is configured
    expect(res.body.source).toBe('mock');
    expect(res.body.fetchedAt).toBeDefined();
    // Verify the response is sorted by date ascending
    const dates = res.body.events.map((e: any) => e.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('GET / — every event matches the expected shape', async () => {
    const res = await request(server, baseUrl, { method: 'GET', path: '/api/economic-calendar' });
    for (const e of res.body.events) {
      expect(typeof e.id).toBe('string');
      expect(typeof e.title).toBe('string');
      expect(typeof e.date).toBe('string');
      expect(typeof e.time).toBe('string');
      expect(['high', 'medium', 'low']).toContain(e.importance);
      expect(['central_bank', 'gdp', 'inflation', 'employment', 'trade', 'fiscal', 'industry', 'consumer', 'housing', 'other']).toContain(e.category);
      expect(typeof e.forecast).toBe('string');
      expect(typeof e.previous).toBe('string');
      expect(typeof e.isCompleted).toBe('boolean');
      expect(Array.isArray(e.affectedAssets)).toBe(true);
      expect(typeof e.countryCode).toBe('string');
    }
  });

  it('GET /?category=inflation — filters by category', async () => {
    const res = await request(server, baseUrl, { method: 'GET', path: '/api/economic-calendar?category=inflation' });
    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThan(0);
    for (const e of res.body.events) {
      expect(e.category).toBe('inflation');
    }
  });

  it('GET /?importance=high — filters by importance', async () => {
    const res = await request(server, baseUrl, { method: 'GET', path: '/api/economic-calendar?importance=high' });
    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThan(0);
    for (const e of res.body.events) {
      expect(e.importance).toBe('high');
    }
  });

  it('GET /?country=US — filters by country', async () => {
    const res = await request(server, baseUrl, { method: 'GET', path: '/api/economic-calendar?country=US' });
    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThan(0);
    for (const e of res.body.events) {
      expect(e.countryCode).toBe('US');
    }
  });

  it('GET /upcoming — returns only future events within the window', async () => {
    const res = await request(server, baseUrl, { method: 'GET', path: '/api/economic-calendar/upcoming?days=30' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.days).toBe(30);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const e of res.body.events) {
      const d = new Date(e.date);
      expect(d.getTime()).toBeGreaterThanOrEqual(today.getTime());
      expect(e.isCompleted).toBe(false);
    }
  });

  it('GET /upcoming — clamps days parameter to the FMP 90-day max', async () => {
    const res = await request(server, baseUrl, { method: 'GET', path: '/api/economic-calendar/upcoming?days=99999' });
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(90);
  });

  it('GET /summary — returns aggregate stats', async () => {
    const res = await request(server, baseUrl, { method: 'GET', path: '/api/economic-calendar/summary' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.upcoming).toBeGreaterThan(0);
    expect(res.body.byCategory).toBeDefined();
    expect(res.body.byImportance).toBeDefined();
    expect(res.body.byCountry).toBeDefined();
    expect(res.body.source).toBe('mock');
    // Total should equal sum of category counts
    const sumCategories = Object.values(res.body.byCategory).reduce((a: number, b: any) => a + b, 0);
    expect(sumCategories).toBe(res.body.total);
  });

  it('GET / — still works when the service falls back to mock', async () => {
    const res = await request(server, baseUrl, { method: 'GET', path: '/api/economic-calendar' });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('mock');
    expect(res.body.events.length).toBeGreaterThan(0);
  });
});
