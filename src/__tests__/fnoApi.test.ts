/**
 * ============================================================================
 * Toroloom — F&O API Service Tests
 * ============================================================================
 *
 * Tests the fnoApi module: getExpiries, getOptionChain, getFutures,
 * getSpotPrices, getMarketStatus, placeOrder, analyzeStrategy,
 * getPrebuiltStrategies, and getPositions.
 *
 * Each test mocks globalThis.fetch to verify correct URL construction,
 * HTTP methods, and request bodies.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/fnoApi.test.ts
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.unmock('../services/api/fno');

import { configureApi } from '../services/api/client';
import { fnoApi } from '../services/api/fno';
import type { Mock } from 'vitest';

import { TEST_API_BASE as API_BASE } from './testConfig';

const originalFetch = globalThis.fetch;

// ============================================================================
// fnoApi — getExpiries
// ============================================================================

describe('fnoApi — getExpiries', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /fno/expiries with symbol query', async () => {
    let capturedUrl = '';
    const mockResponse = {
      symbol: 'NIFTY',
      expiries: [
        { id: 'w1', date: '2026-07-02T00:00:00.000Z', type: 'weekly', daysToExpiry: 5, isMonthly: false },
      ],
    };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve(mockResponse) };
    });

    const result = await fnoApi.getExpiries('NIFTY');

    expect(capturedUrl).toBe(`${API_BASE}/fno/expiries?symbol=NIFTY`);
    expect(result.symbol).toBe('NIFTY');
    expect(result.expiries).toHaveLength(1);
  });

  it('encodes symbol parameter', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve({ symbol: 'RELIANCE', expiries: [] }) };
    });

    await fnoApi.getExpiries('RELIANCE');
    expect(capturedUrl).toContain('symbol=RELIANCE');
  });

  it('attaches auth token', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve({ symbol: 'NIFTY', expiries: [] }) };
    });

    await fnoApi.getExpiries('NIFTY');
    expect(capturedHeaders['Authorization']).toBe('Bearer token');
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Server error' }),
    });
    await expect(fnoApi.getExpiries('NIFTY')).rejects.toThrow('Server error');
  });
});

// ============================================================================
// fnoApi — getOptionChain
// ============================================================================

describe('fnoApi — getOptionChain', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /fno/option-chain with symbol', async () => {
    let capturedUrl = '';
    const mockChain = {
      underlying: 'NIFTY', underlyingPrice: 23456, spotPrice: 23456,
      expiry: '2026-07-02', rows: [], totalCEOi: 0, totalPEOi: 0,
      totalCEVolume: 0, totalPEVolume: 0, maxPain: 23450, pcr: 0.95,
    };
    (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve(mockChain) };
    });

    const result = await fnoApi.getOptionChain('NIFTY');

    expect(capturedUrl).toBe(`${API_BASE}/fno/option-chain?symbol=NIFTY`);
    expect(result.underlying).toBe('NIFTY');
  });

  it('appends expiry and spotPrice when provided', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve({ underlying: 'NIFTY', rows: [], totalCEOi: 0, totalPEOi: 0, totalCEVolume: 0, totalPEVolume: 0, expiry: '', expiryDate: '', underlyingPrice: 0, spotPrice: 24000, maxPain: 0, pcr: 1 }) };
    });

    await fnoApi.getOptionChain('NIFTY', '2026-07-02T00:00:00.000Z', 24000);
    expect(capturedUrl).toContain('expiry=');
    expect(capturedUrl).toContain('spotPrice=24000');
  });
});

// ============================================================================
// fnoApi — getFutures
// ============================================================================

describe('fnoApi — getFutures', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /fno/futures with symbol', async () => {
    let capturedUrl = '';
    const mockResponse = {
      symbol: 'NIFTY', spotPrice: 23456,
      futures: [{ symbol: 'NIFTYW1', underlying: 'NIFTY', expiry: '2026-07-02', price: 23500, lotSize: 50, openInterest: 500000, volume: 100000, basis: 44, basisPercent: 0.19, change: 0, changePercent: 0, oiChange: 0, oiChangePercent: 0, expiryDate: '2026-07-02' }],
    };
    (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve(mockResponse) };
    });

    const result = await fnoApi.getFutures('NIFTY');

    expect(capturedUrl).toBe(`${API_BASE}/fno/futures?symbol=NIFTY`);
    expect(result.futures).toHaveLength(1);
    expect(result.futures[0].lotSize).toBe(50);
  });
});

// ============================================================================
// fnoApi — getSpotPrices
// ============================================================================

describe('fnoApi — getSpotPrices', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /fno/spot-prices', async () => {
    let capturedUrl = '';
    const mockPrices = { NIFTY: 23456, BANKNIFTY: 49234, RELIANCE: 2890 };
    (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve(mockPrices) };
    });

    const result = await fnoApi.getSpotPrices();

    expect(capturedUrl).toBe(`${API_BASE}/fno/spot-prices`);
    expect(result.NIFTY).toBe(23456);
  });
});

// ============================================================================
// fnoApi — getMarketStatus
// ============================================================================

describe('fnoApi — getMarketStatus', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /fno/market-status', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve({ isOpen: false, status: 'closed', message: 'Closed', currentTime: new Date().toISOString() }) };
    });

    const result = await fnoApi.getMarketStatus();

    expect(capturedUrl).toBe(`${API_BASE}/fno/market-status`);
    expect(result.status).toBe('closed');
  });
});

// ============================================================================
// fnoApi — placeOrder
// ============================================================================

describe('fnoApi — placeOrder', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /fno/place-order with order data', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody = '';
    const mockResult = {
      success: true, orderId: 'FNO_123', message: 'Order placed', type: 'CE', action: 'buy',
      symbol: 'NIFTY', strike: 23500, quantity: 1, lotSize: 50, price: 185, timestamp: new Date().toISOString(), status: 'confirmed',
    };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve(mockResult) };
    });

    const result = await fnoApi.placeOrder({
      symbol: 'NIFTY', type: 'CE', action: 'buy', strike: 23500,
      expiry: '2026-07-02T00:00:00.000Z', quantity: 1, price: 185,
    });

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(`${API_BASE}/fno/place-order`);
    const parsed = JSON.parse(capturedBody);
    expect(parsed.symbol).toBe('NIFTY');
    expect(parsed.type).toBe('CE');
    expect(parsed.action).toBe('buy');
    expect(parsed.quantity).toBe(1);
    expect(result.success).toBe(true);
    expect(result.orderId).toBe('FNO_123');
  });

  it('handles server error gracefully', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 400, json: () => Promise.resolve({ error: 'Missing required fields' }),
    });
    await expect(fnoApi.placeOrder({
      symbol: 'NIFTY', type: 'CE', action: 'buy',
      expiry: '2026-07-02', quantity: 1, price: 185,
    })).rejects.toThrow('Missing required fields');
  });

  it('handles network error gracefully', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fnoApi.placeOrder({
      symbol: 'NIFTY', type: 'CE', action: 'buy',
      expiry: '2026-07-02', quantity: 1, price: 185,
    })).rejects.toThrow('Failed to fetch');
  });
});

// ============================================================================
// fnoApi — analyzeStrategy
// ============================================================================

describe('fnoApi — analyzeStrategy', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /fno/strategy/analyze with legs', async () => {
    let capturedUrl = '', capturedBody = '';
    const mockResult = {
      spotPrice: 23456, maxProfit: 5000, maxLoss: -2000, maxProfitPercent: 21.3, maxLossPercent: -8.5,
      breakevenPoints: [23685], isBullish: true, isBearish: false, isNeutral: false, totalLegs: 1,
      pnlChart: [{ underlyingPrice: 22000, pnl: -5000, legPnls: [-5000] }],
    };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve(mockResult) };
    });

    const result = await fnoApi.analyzeStrategy({
      legs: [{ type: 'CE', strike: 23500, action: 'buy', premium: 185, quantity: 1 }],
      spotPrice: 23456,
    });

    expect(capturedUrl).toBe(`${API_BASE}/fno/strategy/analyze`);
    const parsed = JSON.parse(capturedBody);
    expect(parsed.legs).toHaveLength(1);
    expect(parsed.legs[0].type).toBe('CE');
    expect(result.maxProfit).toBe(5000);
    expect(result.pnlChart).toHaveLength(1);
  });
});

// ============================================================================
// fnoApi — getPrebuiltStrategies
// ============================================================================

describe('fnoApi — getPrebuiltStrategies', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /fno/prebuilt-strategies', async () => {
    let capturedUrl = '';
    const mockStrategies = [
      { id: 'long_call', name: 'Long Call', description: 'Buy a call option', riskCategory: 'moderate', isBullish: true, isBearish: false, isNeutral: false, legs: [{ type: 'CE', action: 'buy', count: 1 }] },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve(mockStrategies) };
    });

    const result = await fnoApi.getPrebuiltStrategies();

    expect(capturedUrl).toBe(`${API_BASE}/fno/prebuilt-strategies`);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('long_call');
  });
});

// ============================================================================
// fnoApi — getPositions
// ============================================================================

describe('fnoApi — getPositions', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /fno/positions', async () => {
    let capturedUrl = '';
    const mockPositions = [
      { id: 'pos_1', symbol: 'NIFTY', type: 'CE', strike: 23500, expiry: '2026-07-02', action: 'buy', quantity: 1, lotSize: 50, entryPrice: 185, currentPrice: 210, pnl: 1250, pnlPercent: 13.51, timestamp: new Date().toISOString() },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve(mockPositions) };
    });

    const result = await fnoApi.getPositions();

    expect(capturedUrl).toBe(`${API_BASE}/fno/positions`);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('NIFTY');
  });

  it('returns empty array when no positions', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve([]),
    });
    const result = await fnoApi.getPositions();
    expect(result).toEqual([]);
  });
});
