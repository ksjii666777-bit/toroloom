/**
 * ============================================================================
 * Toroloom — Market API Tests
 * ============================================================================
 *
 * Tests the marketApi module: getIndices, getStocks, getQuote, getBulkQuotes,
 * getOHLC, and search. Each test mocks globalThis.fetch to verify correct
 * URL construction, HTTP methods, and query parameters.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Unmock marketApi so we test the real implementation (setup.ts mocks it globally)
vi.unmock('../services/api/market');

import { configureApi } from '../services/api/client';
import { marketApi } from '../services/api/market';
import type { Mock } from 'vitest';

import { TEST_API_BASE as API_BASE } from './testConfig';
const originalFetch = globalThis.fetch;

// ============================================================================
// marketApi — getIndices
// ============================================================================

describe('marketApi — getIndices', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /market/indices', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockIndices = [
      { id: 'NIFTY', name: 'NIFTY 50', shortName: 'NIFTY', currentValue: 24500, change: 120, changePercent: 0.49, isPositive: true, icon: '📈' },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockIndices) };
    });

    const result = await marketApi.getIndices();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/market/indices`);
    expect(result).toEqual(mockIndices);
  });

  it('attaches auth token', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await marketApi.getIndices();
    expect(capturedHeaders['Authorization']).toBe('Bearer token');
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Server error' }),
    });
    await expect(marketApi.getIndices()).rejects.toThrow('Server error');
  });
});

// ============================================================================
// marketApi — getStocks
// ============================================================================

describe('marketApi — getStocks', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /market/stocks', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockStocks = [
      { id: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', price: 2890, change: 45, changePercent: 1.59, isPositive: true, marketCap: '₹19,56,000 Cr', volume: '12.5M', high52: 3020, low52: 2200, pe: 28.5, pb: 3.2, dividend: 0.85 },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockStocks) };
    });

    const result = await marketApi.getStocks();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/market/stocks`);
    expect(result).toEqual(mockStocks);
  });

  it('throws on network failure', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(marketApi.getStocks()).rejects.toThrow('Failed to fetch');
  });
});

// ============================================================================
// marketApi — getQuote
// ============================================================================

describe('marketApi — getQuote', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /market/quote/{symbol}', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockQuote = { id: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'Technology', price: 3890, change: -34, changePercent: -0.88, isPositive: false, marketCap: '₹14,20,000 Cr', volume: '8.2M', high52: 4200, low52: 3300, pe: 35.2, pb: 12.5, dividend: 1.20 };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockQuote) };
    });

    const result = await marketApi.getQuote('TCS');

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/market/quote/TCS`);
    expect(result).toEqual(mockQuote);
  });

  it('handles 404 for unknown symbol', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 404, json: () => Promise.resolve({ error: 'Stock not found' }),
    });
    await expect(marketApi.getQuote('UNKNOWN')).rejects.toThrow('Stock not found');
  });
});

// ============================================================================
// marketApi — getBulkQuotes
// ============================================================================

describe('marketApi — getBulkQuotes', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET with comma-separated symbols', async () => {
    let capturedUrl = '', capturedMethod = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await marketApi.getBulkQuotes(['RELIANCE', 'TCS', 'HDFCBANK']);

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/market/quotes?symbols=RELIANCE,TCS,HDFCBANK`);
  });

  it('handles single symbol', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, _opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await marketApi.getBulkQuotes(['RELIANCE']);
    expect(capturedUrl).toContain('symbols=RELIANCE');
  });

  it('handles empty symbol array', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, _opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await marketApi.getBulkQuotes([]);
    expect(capturedUrl).toBe(`${API_BASE}/market/quotes?symbols=`);
  });
});

// ============================================================================
// marketApi — getOHLC
// ============================================================================

describe('marketApi — getOHLC', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET with default interval and days', async () => {
    let capturedUrl = '', capturedMethod = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await marketApi.getOHLC('RELIANCE');

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/market/ohlc/RELIANCE?interval=day&days=30`);
  });

  it('sends GET with custom interval and days', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, _opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await marketApi.getOHLC('RELIANCE', 'week', 90);
    expect(capturedUrl).toBe(`${API_BASE}/market/ohlc/RELIANCE?interval=week&days=90`);
  });

  it('sends GET with custom interval only', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, _opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await marketApi.getOHLC('TCS', 'month');
    expect(capturedUrl).toContain('interval=month');
    expect(capturedUrl).toContain('days=30');
  });

  it('returns OHLC data on success', async () => {
    const mockOHLC = [
      { date: '2025-05-01', open: 100, high: 105, low: 99, close: 104, volume: 1000000 },
      { date: '2025-05-02', open: 104, high: 108, low: 103, close: 107, volume: 1200000 },
    ];
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(mockOHLC),
    });

    const result = await marketApi.getOHLC('RELIANCE');
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2025-05-01');
    expect(result[0].close).toBe(104);
  });
});

// ============================================================================
// marketApi — search
// ============================================================================

describe('marketApi — search', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET with encoded search query', async () => {
    let capturedUrl = '', capturedMethod = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await marketApi.search('Reliance Industries');

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/market/search?q=Reliance%20Industries`);
  });

  it('handles special characters in query', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, _opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await marketApi.search('A&B Corp.');
    expect(capturedUrl).toBe(`${API_BASE}/market/search?q=A%26B%20Corp.`);
  });

  it('returns search results on success', async () => {
    const mockResults = [
      { id: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', sector: 'Energy', price: 2890, change: 45, changePercent: 1.59, isPositive: true, marketCap: '₹19,56,000 Cr', volume: '12.5M', high52: 3020, low52: 2200, pe: 28.5, pb: 3.2, dividend: 0.85 },
    ];
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(mockResults),
    });

    const result = await marketApi.search('RELIANCE');
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('RELIANCE');
  });

  it('returns empty array for no results', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve([]),
    });

    const result = await marketApi.search('ZZZZ');
    expect(result).toEqual([]);
  });
});
