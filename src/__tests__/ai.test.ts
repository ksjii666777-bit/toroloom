/**
 * ============================================================================
 * Toroloom — AI Insights API Tests
 * ============================================================================
 *
 * Tests the aiApi module: getInsights, getInsight, analyze.
 * Each test mocks globalThis.fetch to verify correct URL construction,
 * HTTP methods, and request bodies.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.unmock('../services/api/ai');

import { configureApi } from '../services/api/client';
import { aiApi } from '../services/api/ai';
import type { Mock } from 'vitest';

const API_BASE = 'http://localhost:3000/api';
const originalFetch = globalThis.fetch;

// ============================================================================
// aiApi — getInsights
// ============================================================================

describe('aiApi — getInsights', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /ai/insights without stockId', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockInsights = [
      { id: 'ins1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', type: 'bullish', confidence: 85, summary: 'Strong buy', analysis: 'Detailed analysis', targets: [{ target: 3200, probability: 0.75 }], timestamp: '2025-06-01T00:00:00Z' },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockInsights) };
    });

    const result = await aiApi.getInsights();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/ai/insights`);
    expect(result).toEqual(mockInsights);
  });

  it('sends GET to /ai/insights with stockId query param', async () => {
    let capturedUrl = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, _opts: any) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await aiApi.getInsights('RELIANCE');

    expect(capturedUrl).toBe(`${API_BASE}/ai/insights?stockId=RELIANCE`);
  });

  it('attaches auth token', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await aiApi.getInsights();
    expect(capturedHeaders['Authorization']).toBe('Bearer token');
  });

  it('returns empty array when no insights', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve([]),
    });

    const result = await aiApi.getInsights();
    expect(result).toEqual([]);
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'AI service unavailable' }),
    });
    await expect(aiApi.getInsights()).rejects.toThrow('AI service unavailable');
  });
});

// ============================================================================
// aiApi — getInsight
// ============================================================================

describe('aiApi — getInsight', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /ai/insights/{insightId}', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockInsight = { id: 'ins1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance', type: 'bullish', confidence: 85, summary: 'Strong buy', analysis: 'Detailed', targets: [{ target: 3200, probability: 0.75 }], timestamp: '2025-06-01T00:00:00Z' };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockInsight) };
    });

    const result = await aiApi.getInsight('ins1');

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/ai/insights/ins1`);
    expect(result).toEqual(mockInsight);
  });

  it('throws on 404 for unknown insight', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 404, json: () => Promise.resolve({ error: 'Insight not found' }),
    });
    await expect(aiApi.getInsight('invalid')).rejects.toThrow('Insight not found');
  });
});

// ============================================================================
// aiApi — analyze
// ============================================================================

describe('aiApi — analyze', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /ai/analyze with symbol', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody = '';
    const mockInsight = { id: 'ins_new', stockId: 'TCS', symbol: 'TCS', name: 'TCS', type: 'neutral', confidence: 60, summary: 'Hold', analysis: 'Analysis', targets: [{ target: 4000, probability: 0.5 }], timestamp: '2025-06-01T00:00:00Z' };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve(mockInsight) };
    });

    const result = await aiApi.analyze('TCS');

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(`${API_BASE}/ai/analyze`);
    expect(JSON.parse(capturedBody)).toEqual({ symbol: 'TCS' });
    expect(result).toEqual(mockInsight);
  });

  it('throws on server error during analysis', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 429, json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
    });
    await expect(aiApi.analyze('RELIANCE')).rejects.toThrow('Rate limit exceeded');
  });

  it('throws on network error', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(aiApi.analyze('TCS')).rejects.toThrow('Failed to fetch');
  });
});
