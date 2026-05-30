/**
 * ============================================================================
 * Toroloom — Watchlist API Tests
 * ============================================================================
 *
 * Tests the watchlistApi module: getAll, create, addStock, removeStock,
 * and delete. Each test mocks globalThis.fetch to verify correct
 * URL construction, HTTP methods, and request bodies.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Unmock watchlistApi so we test the real implementation (setup.ts mocks it globally)
vi.unmock('../services/api/watchlist');

import { configureApi } from '../services/api/client';
import { watchlistApi } from '../services/api/watchlist';
import type { Mock } from 'vitest';

const API_BASE = 'http://localhost:3000/api';
const originalFetch = globalThis.fetch;

// ============================================================================
// watchlistApi — getAll
// ============================================================================

describe('watchlistApi — getAll', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /watchlist', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockWatchlists = [
      { id: 'wl1', name: 'My Watchlist', stocks: [], createdAt: '2025-01-01' },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockWatchlists) };
    });

    const result = await watchlistApi.getAll();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/watchlist`);
    expect(result).toEqual(mockWatchlists);
  });

  it('attaches auth token', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await watchlistApi.getAll();
    expect(capturedHeaders['Authorization']).toBe('Bearer token');
  });

  it('returns empty array when no watchlists', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve([]),
    });

    const result = await watchlistApi.getAll();
    expect(result).toEqual([]);
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Failed to fetch watchlists' }),
    });
    await expect(watchlistApi.getAll()).rejects.toThrow('Failed to fetch watchlists');
  });
});

// ============================================================================
// watchlistApi — create
// ============================================================================

describe('watchlistApi — create', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /watchlist with name', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody = '';
    const mockWatchlist = { id: 'wl_new', name: 'My New WL', stocks: [], createdAt: '2025-06-01' };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve(mockWatchlist) };
    });

    const result = await watchlistApi.create('My New WL');

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(`${API_BASE}/watchlist`);
    expect(JSON.parse(capturedBody)).toEqual({ name: 'My New WL' });
    expect(result).toEqual(mockWatchlist);
  });

  it('handles empty name', async () => {
    let capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({ id: 'wl_e', name: '', stocks: [], createdAt: '2025-06-01' }) };
    });

    await watchlistApi.create('');
    expect(JSON.parse(capturedBody)).toEqual({ name: '' });
  });

  it('throws on validation error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 400, json: () => Promise.resolve({ error: 'Name is required' }),
    });
    await expect(watchlistApi.create('')).rejects.toThrow('Name is required');
  });
});

// ============================================================================
// watchlistApi — addStock
// ============================================================================

describe('watchlistApi — addStock', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /watchlist/{id}/stocks with symbol', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody = '';
    const mockWatchlist = { id: 'wl1', name: 'My WL', stocks: [{ id: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', sector: 'Energy', price: 2890, change: 45, changePercent: 1.59, isPositive: true, marketCap: '₹19,56,000 Cr', volume: '12.5M', high52: 3020, low52: 2200, pe: 28.5, pb: 3.2, dividend: 0.85 }], createdAt: '2025-01-01' };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve(mockWatchlist) };
    });

    const result = await watchlistApi.addStock('wl1', 'RELIANCE');

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(`${API_BASE}/watchlist/wl1/stocks`);
    expect(JSON.parse(capturedBody)).toEqual({ symbol: 'RELIANCE' });
    expect(result).toEqual(mockWatchlist);
  });

  it('throws on duplicate stock', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 409, json: () => Promise.resolve({ error: 'Stock already in watchlist' }),
    });
    await expect(watchlistApi.addStock('wl1', 'RELIANCE')).rejects.toThrow('Stock already in watchlist');
  });

  it('throws on network error', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(watchlistApi.addStock('wl1', 'RELIANCE')).rejects.toThrow('Failed to fetch');
  });
});

// ============================================================================
// watchlistApi — removeStock
// ============================================================================

describe('watchlistApi — removeStock', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends DELETE to /watchlist/{id}/stocks/{symbol}', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody: any = 'not_undefined';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 204, json: () => Promise.reject(new Error('No content')) };
    });

    await watchlistApi.removeStock('wl1', 'RELIANCE');

    expect(capturedMethod).toBe('DELETE');
    expect(capturedUrl).toBe(`${API_BASE}/watchlist/wl1/stocks/RELIANCE`);
    expect(capturedBody).toBeUndefined();
  });

  it('returns undefined on 204 success', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 204, json: () => Promise.reject(new Error('No content')),
    });

    const result = await watchlistApi.removeStock('wl1', 'TCS');
    expect(result).toBeUndefined();
  });

  it('throws on 404 (watchlist not found)', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 404, json: () => Promise.resolve({ error: 'Watchlist not found' }),
    });
    await expect(watchlistApi.removeStock('invalid', 'RELIANCE')).rejects.toThrow('Watchlist not found');
  });

  it('throws on 404 (stock not found in watchlist)', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 404, json: () => Promise.resolve({ error: 'Stock not found in watchlist' }),
    });
    await expect(watchlistApi.removeStock('wl1', 'UNKNOWN')).rejects.toThrow('Stock not found in watchlist');
  });
});

// ============================================================================
// watchlistApi — delete
// ============================================================================

describe('watchlistApi — delete', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends DELETE to /watchlist/{id}', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody: any = 'not_undefined';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 204, json: () => Promise.reject(new Error('No content')) };
    });

    await watchlistApi.delete('wl1');

    expect(capturedMethod).toBe('DELETE');
    expect(capturedUrl).toBe(`${API_BASE}/watchlist/wl1`);
    expect(capturedBody).toBeUndefined();
  });

  it('returns undefined on success', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 204, json: () => Promise.reject(new Error('No content')),
    });

    const result = await watchlistApi.delete('wl_temp');
    expect(result).toBeUndefined();
  });

  it('throws on 404 (watchlist not found)', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 404, json: () => Promise.resolve({ error: 'Watchlist not found' }),
    });
    await expect(watchlistApi.delete('non_existent')).rejects.toThrow('Watchlist not found');
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ message: 'Internal error' }),
    });
    await expect(watchlistApi.delete('wl1')).rejects.toThrow('Internal error');
  });
});
