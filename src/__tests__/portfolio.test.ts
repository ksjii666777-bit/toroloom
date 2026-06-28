/**
 * ============================================================================
 * Toroloom — Portfolio API Tests
 * ============================================================================
 *
 * Tests the portfolioApi module: getHoldings, getPositions, getTrades,
 * and placeOrder. Each test mocks globalThis.fetch to verify correct
 * URL construction, HTTP methods, and request bodies.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Unmock portfolioApi so we test the real implementation (setup.ts mocks it globally)
vi.unmock('../services/api/portfolio');

import { configureApi } from '../services/api/client';
import { portfolioApi } from '../services/api/portfolio';
import type { Mock } from 'vitest';

import { TEST_API_BASE as API_BASE } from './testConfig';
const originalFetch = globalThis.fetch;

// ============================================================================
// portfolioApi — getHoldings
// ============================================================================

describe('portfolioApi — getHoldings', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /portfolio/holdings', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockHoldings = [
      { id: 'h1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries', quantity: 10, buyPrice: 2600, currentPrice: 2890, totalInvested: 26000, currentValue: 28900, pnl: 2900, pnlPercent: 11.15, dayChange: 100, dayChangePercent: 0.5 },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockHoldings) };
    });

    const result = await portfolioApi.getHoldings();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/portfolio/holdings`);
    expect(result).toEqual(mockHoldings);
  });

  it('attaches auth token', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await portfolioApi.getHoldings();
    expect(capturedHeaders['Authorization']).toBe('Bearer token');
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Failed to fetch holdings' }),
    });
    await expect(portfolioApi.getHoldings()).rejects.toThrow('Failed to fetch holdings');
  });
});

// ============================================================================
// portfolioApi — getPositions
// ============================================================================

describe('portfolioApi — getPositions', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /portfolio/positions', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockPositions = [
      { symbol: 'RELIANCE', quantity: 10, buyPrice: 2600, currentPrice: 2890, pnl: 2900 },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockPositions) };
    });

    const result = await portfolioApi.getPositions();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/portfolio/positions`);
    expect(result).toEqual(mockPositions);
  });

  it('returns empty array when no positions', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve([]),
    });

    const result = await portfolioApi.getPositions();
    expect(result).toEqual([]);
  });

  it('throws on network error', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(portfolioApi.getPositions()).rejects.toThrow('Failed to fetch');
  });
});

// ============================================================================
// portfolioApi — getTrades
// ============================================================================

describe('portfolioApi — getTrades', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /portfolio/trades', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockTrades = [
      { id: 't1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', type: 'buy', quantity: 10, price: 2600, total: 26000, timestamp: '2025-06-01' },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockTrades) };
    });

    const result = await portfolioApi.getTrades();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/portfolio/trades`);
    expect(result).toEqual(mockTrades);
  });

  it('throws on 401 unauthorized', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 401, json: () => Promise.resolve({ error: 'Unauthorized' }),
    });
    await expect(portfolioApi.getTrades()).rejects.toThrow('Unauthorized');
  });
});

// ============================================================================
// portfolioApi — placeOrder
// ============================================================================

describe('portfolioApi — placeOrder', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /orders/execute with order data', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody = '';
    const mockResult = { success: true, orderId: 'ord_123', riskEvaluation: { allowed: true } };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve(mockResult) };
    });

    const result = await portfolioApi.placeOrder({
      symbol: 'RELIANCE', transactionType: 'BUY', quantity: 50, price: 2650,
    });

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(`${API_BASE}/orders/execute`);
    expect(JSON.parse(capturedBody)).toEqual({
      symbol: 'RELIANCE', transactionType: 'BUY', quantity: 50, price: 2650,
      actionType: 'BUY',
    });
    expect(result).toEqual(mockResult);
  });

  it('sends full order with all optional fields', async () => {
    let capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({ success: true, riskEvaluation: { allowed: true } }) };
    });

    await portfolioApi.placeOrder({
      symbol: 'TCS', exchange: 'NSE', transactionType: 'SELL', quantity: 20, price: 3900,
      productType: 'DELIVERY', orderType: 'LIMIT', metadata: { strategy: 'swing' },
    });

    expect(JSON.parse(capturedBody)).toEqual({
      symbol: 'TCS', exchange: 'NSE', transactionType: 'SELL', quantity: 20, price: 3900,
      productType: 'DELIVERY', orderType: 'LIMIT', metadata: { strategy: 'swing' },
      actionType: 'SELL',
    });
  });

  it('sends minimal BUY order without optional fields', async () => {
    let capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({ success: true, riskEvaluation: { allowed: true } }) };
    });

    await portfolioApi.placeOrder({ symbol: 'HDFCBANK', transactionType: 'BUY', quantity: 10 });

    const body = JSON.parse(capturedBody);
    expect(body.symbol).toBe('HDFCBANK');
    expect(body.transactionType).toBe('BUY');
    expect(body.quantity).toBe(10);
    expect(body.price).toBeUndefined();
    expect(body.exchange).toBeUndefined();
  });

  it('handles risk-engine block response', async () => {
    const mockResponse = {
      success: false,
      riskEvaluation: { allowed: false, reason: 'Daily loss limit exceeded' },
      error: 'Order blocked by risk engine',
    };
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(mockResponse),
    });

    const result = await portfolioApi.placeOrder({ symbol: 'RELIANCE', transactionType: 'BUY', quantity: 100 });

    expect(result.success).toBe(false);
    expect(result.riskEvaluation.allowed).toBe(false);
    expect(result.riskEvaluation.reason).toBe('Daily loss limit exceeded');
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Internal server error' }),
    });
    await expect(portfolioApi.placeOrder({ symbol: 'RELIANCE', transactionType: 'BUY', quantity: 1 })).rejects.toThrow('Internal server error');
  });

  it('handles network error gracefully', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(portfolioApi.placeOrder({ symbol: 'RELIANCE', transactionType: 'BUY', quantity: 1 })).rejects.toThrow('Failed to fetch');
  });
});
