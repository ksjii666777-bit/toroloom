/**
 * ============================================================================
 * Toroloom — Headless API Proxy Client Unit Tests
 * ============================================================================
 *
 * Tests for proxyClient.ts covering:
 *   - proxyRequest successful response (JSON + text)
 *   - No session (401)
 *   - Unknown broker (400)
 *   - Timeout (408)
 *   - HTTP error responses
 *   - Convenience methods (getBrokerHoldings, etc.)
 *   - POST with body and Content-Type
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrokerSession } from '../types';

// ── Mock sessionStorage (vi.hoisted to avoid hoisting TDZ) ──
const mockGetBrokerSession = vi.hoisted(() => vi.fn());

vi.mock('../services/gateway/sessionStorage', () => ({
  getBrokerSession: (...args: any[]) => mockGetBrokerSession(...args),
}));

import {
  proxyRequest,
  getBrokerHoldings,
  getBrokerPositions,
  getBrokerOrderBook,
  getBrokerTradeBook,
  getBrokerMargin,
} from '../services/gateway/proxyClient';

// ─── Test Fixtures ─────────────────────────────────────────

const mockZerodhaSession: BrokerSession = {
  brokerType: 'zerodha',
  enctoken: 'zerodha_enc_main',
  jwt: undefined,
  accessToken: undefined,
  publicToken: 'pub_abc',
  refreshToken: undefined,
  userId: 'ZD1234',
  cookies: 'enctoken=zerodha_enc_main; public_token=pub_abc;',
  capturedAt: '2026-06-20T10:00:00.000Z',
};

const mockAngelSession: BrokerSession = {
  brokerType: 'angel',
  enctoken: undefined,
  jwt: 'eyJhbGciOiJIUzI1NiJ9.test',
  accessToken: 'private_key_123',
  publicToken: undefined,
  refreshToken: undefined,
  userId: 'A12345',
  cookies: 'jwt=eyJhbGciOiJIUzI1NiJ9.test;',
  capturedAt: '2026-06-20T10:00:00.000Z',
};

/**
 * Helper: create a minimal mock fetch response.
 */
function mockResponse(overrides: Partial<{
  ok: boolean;
  status: number;
  contentType: string;
  jsonData: any;
  textData: string;
}> = {}) {
  const {
    ok = true,
    status = 200,
    contentType = 'application/json',
    jsonData = {},
    textData = '',
  } = overrides;
  return {
    ok,
    status,
    headers: new Map([['content-type', contentType]]),
    json: () => Promise.resolve(jsonData),
    text: () => Promise.resolve(textData),
  };
}

// ====================================================================
// proxyRequest
// ====================================================================

describe('proxyRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no stored session exists', async () => {
    mockGetBrokerSession.mockResolvedValue(null);

    const result = await proxyRequest('zerodha', '/oms/portfolio/holdings');

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.error).toContain('No stored session for broker');
  });

  it('returns 400 for unknown broker type', async () => {
    mockGetBrokerSession.mockResolvedValue(mockZerodhaSession);

    const result = await proxyRequest('unknown_broker', '/endpoint');

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.error).toContain('Unknown broker type');
  });

  it('makes authenticated GET request and returns parsed JSON', async () => {
    mockGetBrokerSession.mockResolvedValue(mockZerodhaSession);
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse({
        jsonData: { data: [{ tradingsymbol: 'RELIANCE', quantity: 10 }] },
      }),
    );

    const result = await proxyRequest('zerodha', '/oms/portfolio/holdings');

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.data).toEqual({ data: [{ tradingsymbol: 'RELIANCE', quantity: 10 }] });

    // Verify request was made with correct auth headers
    const fetchCall = (global.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toBe('https://kite.zerodha.com/oms/portfolio/holdings');
    expect(fetchCall[1].method).toBe('GET');
    expect(fetchCall[1].headers['Authorization']).toBe('enctoken zerodha_enc_main');
    expect(fetchCall[1].headers['X-Kite-Version']).toBe('3');
    expect(fetchCall[1].headers['Cookie']).toBe(
      'enctoken=zerodha_enc_main; public_token=pub_abc;',
    );
  });

  it('builds correct Angel One auth headers', async () => {
    mockGetBrokerSession.mockResolvedValue(mockAngelSession);
    global.fetch = vi.fn().mockResolvedValue(mockResponse());

    await proxyRequest('angel', '/rest/secure/angelbroking/portfolio/v1/holdings');

    const fetchCall = (global.fetch as any).mock.calls[0];
    expect(fetchCall[1].headers['Authorization']).toBe('Bearer eyJhbGciOiJIUzI1NiJ9.test');
    expect(fetchCall[1].headers['X-PrivateKey']).toBe('private_key_123');
    expect(fetchCall[1].headers['X-ClientCode']).toBe('A12345');
  });

  it('returns text data when content-type is not JSON', async () => {
    mockGetBrokerSession.mockResolvedValue(mockZerodhaSession);
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse({ contentType: 'text/plain', textData: 'raw response text' }),
    );

    const result = await proxyRequest('zerodha', '/some/endpoint');

    expect(result.success).toBe(true);
    expect(result.data).toBe('raw response text');
  });

  it('returns error on HTTP error response', async () => {
    mockGetBrokerSession.mockResolvedValue(mockZerodhaSession);
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse({ ok: false, status: 429, jsonData: { message: 'Rate limited' } }),
    );

    const result = await proxyRequest('zerodha', '/oms/orders');

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(429);
    expect(result.error).toContain('Broker API error');
  });

  it('returns timeout error (408) when request exceeds timeout', async () => {
    mockGetBrokerSession.mockResolvedValue(mockZerodhaSession);

    // Simulate an AbortError
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    global.fetch = vi.fn().mockRejectedValue(abortError);

    const result = await proxyRequest('zerodha', '/slow/endpoint', { timeout: 1 });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(408);
    expect(result.error).toContain('timed out');
  });

  it('handles network errors gracefully', async () => {
    mockGetBrokerSession.mockResolvedValue(mockZerodhaSession);
    global.fetch = vi.fn().mockRejectedValue(new Error('Network request failed'));

    const result = await proxyRequest('zerodha', '/endpoint');

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(0);
    expect(result.error).toContain('Network request failed');
  });

  it('sends POST body as JSON and sets Content-Type', async () => {
    mockGetBrokerSession.mockResolvedValue(mockZerodhaSession);
    global.fetch = vi.fn().mockResolvedValue(mockResponse());

    const body = { symbol: 'RELIANCE', quantity: 10 };
    await proxyRequest('zerodha', '/oms/orders', {
      method: 'POST',
      body,
    });

    const fetchCall = (global.fetch as any).mock.calls[0];
    expect(fetchCall[1].method).toBe('POST');
    expect(fetchCall[1].headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(fetchCall[1].body)).toEqual(body);
  });

  it('allows overriding baseUrl via options', async () => {
    mockGetBrokerSession.mockResolvedValue(mockZerodhaSession);
    global.fetch = vi.fn().mockResolvedValue(mockResponse());

    await proxyRequest('zerodha', '/custom', {
      baseUrl: 'https://custom-url.com',
    });

    const fetchCall = (global.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toBe('https://custom-url.com/custom');
  });
});

// ====================================================================
// Convenience Methods
// ====================================================================

describe('broker convenience methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBrokerSession.mockResolvedValue(mockZerodhaSession);
    global.fetch = vi.fn().mockResolvedValue(mockResponse());
  });

  it('getBrokerHoldings hits correct Zerodha endpoint', async () => {
    await getBrokerHoldings('zerodha');
    const url = (global.fetch as any).mock.calls[0][0];
    expect(url).toContain('/oms/portfolio/holdings');
  });

  it('getBrokerPositions hits correct Zerodha endpoint', async () => {
    await getBrokerPositions('zerodha');
    const url = (global.fetch as any).mock.calls[0][0];
    expect(url).toContain('/oms/portfolio/positions');
  });

  it('getBrokerOrderBook hits correct Zerodha endpoint', async () => {
    await getBrokerOrderBook('zerodha');
    const url = (global.fetch as any).mock.calls[0][0];
    expect(url).toContain('/oms/orders');
  });

  it('getBrokerTradeBook hits correct Zerodha endpoint', async () => {
    await getBrokerTradeBook('zerodha');
    const url = (global.fetch as any).mock.calls[0][0];
    expect(url).toContain('/oms/trades');
  });

  it('getBrokerMargin hits correct Zerodha endpoint', async () => {
    await getBrokerMargin('zerodha');
    const url = (global.fetch as any).mock.calls[0][0];
    expect(url).toContain('/oms/user/margins');
  });

  it('getBrokerHoldings hits correct Angel endpoint', async () => {
    mockGetBrokerSession.mockResolvedValue(mockAngelSession);
    await getBrokerHoldings('angel');
    const url = (global.fetch as any).mock.calls[0][0];
    expect(url).toContain('/rest/secure/angelbroking/portfolio/v1/holdings');
  });

  it('getBrokerHoldings hits correct Groww endpoint', async () => {
    const growwSession = { ...mockZerodhaSession, brokerType: 'groww', accessToken: 'groww_token' };
    mockGetBrokerSession.mockResolvedValue(growwSession);
    await getBrokerHoldings('groww');
    const url = (global.fetch as any).mock.calls[0][0];
    expect(url).toContain('/pg/invest/v1/holdings');
  });

  it('convenience methods return ProxyResponse with success', async () => {
    const result = await getBrokerHoldings('zerodha');
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('statusCode', 200);
  });
});
