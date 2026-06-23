/**
 * ============================================================================
 * Toroloom — Mutual Funds API Tests
 * ============================================================================
 *
 * Tests the mutualFundApi module: getFunds, getFund, getSIPs, createSIP.
 * Each test mocks globalThis.fetch to verify correct URL construction,
 * HTTP methods, and request bodies.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.unmock('../services/api/mutualFunds');

import { configureApi } from '../services/api/client';
import { mutualFundApi } from '../services/api/mutualFunds';
import type { Mock } from 'vitest';

import { TEST_API_BASE as API_BASE } from './testConfig';
const originalFetch = globalThis.fetch;

// ============================================================================
// mutualFundApi — getFunds
// ============================================================================

describe('mutualFundApi — getFunds', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /mutual-funds', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockFunds = [
      { id: 'mf1', name: 'HDFC Top 100', category: 'Large Cap', nav: 850.50, dayChange: 5.2, dayChangePercent: 0.61, oneYearReturn: 18.5, threeYearReturn: 45.2, fiveYearReturn: 82.1, riskLevel: 'moderate', minInvestment: 500, fundSize: '₹25,000 Cr', rating: 4 },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockFunds) };
    });

    const result = await mutualFundApi.getFunds();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/mutual-funds`);
    expect(result).toEqual(mockFunds);
  });

  it('attaches auth token', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await mutualFundApi.getFunds();
    expect(capturedHeaders['Authorization']).toBe('Bearer token');
  });

  it('returns empty array when no funds', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve([]),
    });

    const result = await mutualFundApi.getFunds();
    expect(result).toEqual([]);
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Failed to fetch funds' }),
    });
    await expect(mutualFundApi.getFunds()).rejects.toThrow('Failed to fetch funds');
  });

  it('throws on network error', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(mutualFundApi.getFunds()).rejects.toThrow('Failed to fetch');
  });
});

// ============================================================================
// mutualFundApi — getFund
// ============================================================================

describe('mutualFundApi — getFund', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /mutual-funds/{fundId}', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockFund = { id: 'mf1', name: 'HDFC Top 100', category: 'Large Cap', nav: 850.50, dayChange: 5.2, dayChangePercent: 0.61, oneYearReturn: 18.5, threeYearReturn: 45.2, fiveYearReturn: 82.1, riskLevel: 'moderate', minInvestment: 500, fundSize: '₹25,000 Cr', rating: 4 };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockFund) };
    });

    const result = await mutualFundApi.getFund('mf1');

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/mutual-funds/mf1`);
    expect(result).toEqual(mockFund);
  });

  it('throws on 404 for unknown fund', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 404, json: () => Promise.resolve({ error: 'Fund not found' }),
    });
    await expect(mutualFundApi.getFund('invalid')).rejects.toThrow('Fund not found');
  });
});

// ============================================================================
// mutualFundApi — getSIPs
// ============================================================================

describe('mutualFundApi — getSIPs', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /mutual-funds/sips/list', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockSIPs = [
      { id: 'sip1', fundId: 'mf1', fundName: 'HDFC Top 100', amount: 5000, frequency: 'monthly', nextDate: '2025-07-01', totalInvested: 50000, currentValue: 58500, returns: 8500 },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockSIPs) };
    });

    const result = await mutualFundApi.getSIPs();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/mutual-funds/sips/list`);
    expect(result).toEqual(mockSIPs);
  });

  it('returns empty array when no SIPs', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve([]),
    });

    const result = await mutualFundApi.getSIPs();
    expect(result).toEqual([]);
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Failed to fetch SIPs' }),
    });
    await expect(mutualFundApi.getSIPs()).rejects.toThrow('Failed to fetch SIPs');
  });
});

// ============================================================================
// mutualFundApi — createSIP
// ============================================================================

describe('mutualFundApi — createSIP', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /mutual-funds/sips with SIP data', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody = '';
    const mockSIP = { id: 'sip_new', fundId: 'mf1', fundName: 'HDFC Top 100', amount: 10000, frequency: 'monthly', nextDate: '2025-07-01', totalInvested: 0, currentValue: 0, returns: 0 };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve(mockSIP) };
    });

    const result = await mutualFundApi.createSIP({ fundId: 'mf1', amount: 10000, frequency: 'monthly' });

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(`${API_BASE}/mutual-funds/sips`);
    expect(JSON.parse(capturedBody)).toEqual({ fundId: 'mf1', amount: 10000, frequency: 'monthly' });
    expect(result).toEqual(mockSIP);
  });

  it('handles different frequency values', async () => {
    let capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({ id: 'sip2', fundId: 'mf2', fundName: 'Fund', amount: 2000, frequency: 'weekly', nextDate: '2025-06-15', totalInvested: 0, currentValue: 0, returns: 0 }) };
    });

    await mutualFundApi.createSIP({ fundId: 'mf2', amount: 2000, frequency: 'weekly' });
    expect(JSON.parse(capturedBody)).toEqual({ fundId: 'mf2', amount: 2000, frequency: 'weekly' });
  });

  it('throws on validation error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 400, json: () => Promise.resolve({ error: 'Minimum SIP amount is ₹500' }),
    });
    await expect(mutualFundApi.createSIP({ fundId: 'mf1', amount: 100, frequency: 'monthly' })).rejects.toThrow('Minimum SIP amount is ₹500');
  });

  it('throws on network error', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(mutualFundApi.createSIP({ fundId: 'mf1', amount: 5000, frequency: 'monthly' })).rejects.toThrow('Failed to fetch');
  });
});
