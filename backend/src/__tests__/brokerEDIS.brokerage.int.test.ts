/**
 * ============================================================================
 * Toroloom Broker EDIS & Brokerage Calculator — Route Integration Tests
 * ============================================================================
 *
 * Tests the 4 broker-specific REST endpoints by:
 *   1. Mocking the broker module to return an authenticated AngelBroker
 *   2. Mocking globalThis.fetch to intercept AngelBroker's raw REST calls
 *   3. Issuing real HTTP requests against a minimal Express app
 *
 * This validates:
 *   - The route handler correctly delegates to AngelBroker methods
 *   - Input validation works (missing fields, invalid types)
 *   - HTTP error responses from the Angel One API are propagated
 *   - The full request/response cycle works end-to-end for happy paths
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/brokerEDIS.brokerage.int.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import http from 'http';
import { generateToken } from '../middleware/auth';
import { AngelBroker } from '../services/broker/angelBroker';
import type { IBroker, BrokerConfig } from '../services/broker/interface';

// ──── Mock broker factory ────────────────────────────────────────────────
// The route handler calls getBroker() which we mock to return an
// authenticated AngelBroker instance. We also mock getCurrentBrokerType()
// to return 'angel' for the error message in mismatch checks.

const mockAngelBroker = new AngelBroker();

// Mock the broker module BEFORE importing routes
vi.mock('../services/broker', () => ({
  getBroker: vi.fn(async (): Promise<IBroker> => {
    return mockAngelBroker;
  }),
  getCurrentBrokerType: vi.fn((): string => 'angel'),
  resetBroker: vi.fn(),
  configureBrokerPersistence: vi.fn(),
  loadBrokerStateFromStorage: vi.fn(),
  getBrokerDeduplicationState: vi.fn(() => new Map()),
}));

// ──── Route import (AFTER mocks are set up) ──────────────────────────────
import brokerRoutes from '../routes/broker';

// ──── Constants ──────────────────────────────────────────────────────────

const TEST_USER_ID = 'test_user_edis';
const TEST_TOKEN = generateToken({ userId: TEST_USER_ID, email: 'test@toroloom.com' });
const AUTH_HEADER = { Authorization: `Bearer ${TEST_TOKEN}` };

// ──── Helpers ────────────────────────────────────────────────────────────

function post(path: string, body?: any, headers?: Record<string, string>): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url.toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
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

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// ──── Server Setup ───────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/broker', brokerRoutes);

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
  server?.close();
});

// ──── Test Setup ─────────────────────────────────────────────────────────

/**
 * Helper to authenticate the mock AngelBroker with test credentials.
 * This must be called before each test that expects a 200 response.
 */
async function authenticateBroker(config?: Partial<BrokerConfig>): Promise<void> {
  await mockAngelBroker.authenticate({
    apiKey: 'test-api-key',
    clientId: 'test-client',
    accessToken: 'test-jwt',
    ...config,
  } as any);
}

/**
 * Reset the mock AngelBroker to unauthenticated state.
 * Used in beforeEach to ensure test isolation.
 */
function deauthenticateBroker(): void {
  // Access the private 'connected' field via bracket notation for testing
  (mockAngelBroker as any).connected = false;
  (mockAngelBroker as any).smartApi = null;
  (mockAngelBroker as any).accessToken = '';
}

beforeEach(() => {
  deauthenticateBroker();
});

// ═════════════════════════════════════════════════════════════════════════
// Test Suites
// ═════════════════════════════════════════════════════════════════════════

describe('POST /api/broker/edis/verify (AngelBroker)', () => {
  // Non-AngelBroker cases are already covered in routes.int.test.ts

  it('should initiate EDIS verification and return ReqId + ReturnURL', async () => {
    await authenticateBroker();

    const mockEDISResponse = {
      ReqId: 'REQ_1717000000',
      ReturnURL: 'https://cdslindia.com/verify',
      DPId: '12345',
      BOID: 'BO_INESP123',
      TransDtls: 'TRAN_1717000000',
    };

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockEDISResponse,
      text: async () => JSON.stringify(mockEDISResponse),
    } as any);

    const { status, body } = await post(
      '/api/broker/edis/verify',
      { isin: 'INE545U01014', quantity: '10' },
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body).toEqual(mockEDISResponse);
    expect(body.ReqId).toBe('REQ_1717000000');
    expect(body.ReturnURL).toBe('https://cdslindia.com/verify');

    // Verify the request was sent to the correct Angel One REST endpoint
    expect(fetchMock).toHaveBeenCalledWith(
      'https://apiconnect.angelone.in/rest/secure/angelbroking/edis/v1/verifyDis',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-jwt',
          'X-PrivateKey': 'test-api-key',
        }),
        body: JSON.stringify({ isin: 'INE545U01014', quantity: '10' }),
      }),
    );

    fetchMock.mockRestore();
  });

  it('should propagate HTTP errors from the Angel One API', async () => {
    await authenticateBroker();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request: invalid ISIN format',
    } as any);

    const { status, body } = await post(
      '/api/broker/edis/verify',
      { isin: 'INVALID', quantity: '10' },
      AUTH_HEADER,
    );

    expect(status).toBe(500);
    expect(body.error).toContain('Angel One REST API error (400)');

    fetchMock.mockRestore();
  });

  it('should pass string quantity through to Angel One API without format validation', async () => {
    await authenticateBroker();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ReqId: 'REQ_001', ReturnURL: '', DPId: '', BOID: '', TransDtls: '' }),
      text: async () => '',
    } as any);

    const { status } = await post(
      '/api/broker/edis/verify',
      { isin: 'INE545U01014', quantity: 'abc' },
      AUTH_HEADER,
    );

    // The route passes quantity through as-is (string); Angel One API validates
    expect(status).toBe(200);

    fetchMock.mockRestore();
  });
});

describe('POST /api/broker/edis/generate-tpin (AngelBroker)', () => {
  it('should generate TPIN and return status', async () => {
    await authenticateBroker();

    const mockResponse = { status: 'TPIN generated successfully' };

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => JSON.stringify(mockResponse),
    } as any);

    const { status, body } = await post(
      '/api/broker/edis/generate-tpin',
      { dpId: '12345', ReqId: 'REQ_001', boid: 'BO_INESP123', pan: 'ABCDE1234F' },
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body.status).toBe('TPIN generated successfully');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://apiconnect.angelone.in/rest/secure/angelbroking/edis/v1/generateTPIN',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ dpId: '12345', ReqId: 'REQ_001', boid: 'BO_INESP123', pan: 'ABCDE1234F' }),
      }),
    );

    fetchMock.mockRestore();
  });

  it('should propagate HTTP errors', async () => {
    await authenticateBroker();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized: invalid session',
    } as any);

    const { status, body } = await post(
      '/api/broker/edis/generate-tpin',
      { dpId: '12345', ReqId: 'REQ_001', boid: 'BO_INESP123', pan: 'ABCDE1234F' },
      AUTH_HEADER,
    );

    expect(status).toBe(500);
    expect(body.error).toContain('Angel One REST API error (401)');

    fetchMock.mockRestore();
  });

  it('should reject invalid PAN format (last char is digit)', async () => {
    await authenticateBroker();

    const { status, body } = await post(
      '/api/broker/edis/generate-tpin',
      { dpId: '12345', ReqId: 'REQ_001', boid: 'BO_INESP123', pan: 'ABCDE12345' },
      AUTH_HEADER,
    );

    // PAN validation happens before broker call, so no fetch mock needed
    expect(status).toBe(400);
    expect(body.error).toContain('Invalid PAN format');
  });

  it('should reject invalid PAN format (too short)', async () => {
    await authenticateBroker();

    const { status, body } = await post(
      '/api/broker/edis/generate-tpin',
      { dpId: '12345', ReqId: 'REQ_001', boid: 'BO_INESP123', pan: 'ABCDE1234' },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('Invalid PAN format');
  });

  it('should reject invalid PAN format (special character)', async () => {
    await authenticateBroker();

    const { status, body } = await post(
      '/api/broker/edis/generate-tpin',
      { dpId: '12345', ReqId: 'REQ_001', boid: 'BO_INESP123', pan: 'ABCDE1234@' },
      AUTH_HEADER,
    );

    expect(status).toBe(400);
    expect(body.error).toContain('Invalid PAN format');
  });

  it('should accept lowercase PAN (normalizes to uppercase) and forward to AngelBroker', async () => {
    await authenticateBroker();

    const mockResponse = { status: 'TPIN generated successfully' };

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => JSON.stringify(mockResponse),
    } as any);

    const { status, body } = await post(
      '/api/broker/edis/generate-tpin',
      { dpId: '12345', ReqId: 'REQ_001', boid: 'BO_INESP123', pan: 'abcde1234f' },
      AUTH_HEADER,
    );

    // PAN is normalized to uppercase and passes validation → calls AngelBroker
    expect(status).toBe(200);
    expect(body.status).toBe('TPIN generated successfully');

    // Verify the forwarded PAN was uppercased
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ dpId: '12345', ReqId: 'REQ_001', boid: 'BO_INESP123', pan: 'ABCDE1234F' }),
      }),
    );

    fetchMock.mockRestore();
  });

  it('should accept PAN with whitespace (trims) and forward to AngelBroker', async () => {
    await authenticateBroker();

    const mockResponse = { status: 'TPIN generated successfully' };

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => JSON.stringify(mockResponse),
    } as any);

    const { status, body } = await post(
      '/api/broker/edis/generate-tpin',
      { dpId: '12345', ReqId: 'REQ_001', boid: 'BO_INESP123', pan: '  ABCDE1234F  ' },
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body.status).toBe('TPIN generated successfully');

    // Verify the forwarded PAN was trimmed
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ dpId: '12345', ReqId: 'REQ_001', boid: 'BO_INESP123', pan: 'ABCDE1234F' }),
      }),
    );

    fetchMock.mockRestore();
  });
});

describe('POST /api/broker/edis/tran-status (AngelBroker)', () => {
  it('should return status 1 when EDIS is authorised', async () => {
    await authenticateBroker();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ReqId: 'REQ_001', status: 1 }),
      text: async () => JSON.stringify({ ReqId: 'REQ_001', status: 1 }),
    } as any);

    const { status, body } = await post(
      '/api/broker/edis/tran-status',
      { ReqId: 'REQ_001' },
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body.status).toBe(1);
    expect(body.ReqId).toBe('REQ_001');

    fetchMock.mockRestore();
  });

  it('should return status 0 when EDIS is not yet authorised', async () => {
    await authenticateBroker();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ReqId: 'REQ_002', status: 0 }),
      text: async () => JSON.stringify({ ReqId: 'REQ_002', status: 0 }),
    } as any);

    const { status, body } = await post(
      '/api/broker/edis/tran-status',
      { ReqId: 'REQ_002' },
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body.status).toBe(0);

    fetchMock.mockRestore();
  });

  it('should propagate HTTP errors', async () => {
    await authenticateBroker();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not Found: unknown ReqId',
    } as any);

    const { status, body } = await post(
      '/api/broker/edis/tran-status',
      { ReqId: 'UNKNOWN' },
      AUTH_HEADER,
    );

    expect(status).toBe(500);
    expect(body.error).toContain('Angel One REST API error (404)');

    fetchMock.mockRestore();
  });
});

describe('POST /api/broker/brokerage/estimate (AngelBroker)', () => {
  const validSingleOrder = {
    orders: [{
      product_type: 'DELIVERY',
      transaction_type: 'BUY',
      exchange: 'NSE',
      symbol: 'RELIANCE',
      token: '12345',
      qty: 10,
      price: 2500,
    }],
  };

  it('should return brokerage estimate for a single order', async () => {
    await authenticateBroker();

    const mockResponse = {
      status: 'SUCCESS',
      payload: {
        brokerage: 15.0,
        transaction_charges: 5.0,
        gst: 3.6,
        stt_ctt: 50.0,
        stamp_duty: 1.5,
        sebi_turnover_fees: 0.1,
        total_charges: 75.2,
      },
    };

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => JSON.stringify(mockResponse),
    } as any);

    const { status, body } = await post(
      '/api/broker/brokerage/estimate',
      validSingleOrder,
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body.status).toBe('SUCCESS');
    expect(body.payload.brokerage).toBe(15.0);
    expect(body.payload.total_charges).toBe(75.2);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://apiconnect.angelone.in/rest/secure/angelbroking/brokerage/v1/estimateCharges',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(validSingleOrder),
      }),
    );

    fetchMock.mockRestore();
  });

  it('should handle multiple orders', async () => {
    await authenticateBroker();

    const multiOrder = {
      orders: [
        {
          product_type: 'DELIVERY',
          transaction_type: 'BUY',
          exchange: 'NSE',
          symbol: 'RELIANCE',
          token: '12345',
          qty: 10,
          price: 2500,
        },
        {
          product_type: 'INTRADAY',
          transaction_type: 'SELL',
          exchange: 'NSE',
          symbol: 'TCS',
          token: '67890',
          qty: 5,
          price: 4000,
        },
      ],
    };

    const mockResponse = {
      status: 'SUCCESS',
      payload: {
        brokerage: 30.0,
        transaction_charges: 10.0,
        gst: 7.2,
        stt_ctt: 100.0,
        stamp_duty: 3.0,
        sebi_turnover_fees: 0.2,
        total_charges: 150.4,
      },
    };

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
      text: async () => JSON.stringify(mockResponse),
    } as any);

    const { status, body } = await post(
      '/api/broker/brokerage/estimate',
      multiOrder,
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body.payload.total_charges).toBe(150.4);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify(multiOrder),
      }),
    );

    fetchMock.mockRestore();
  });

  it('should propagate HTTP errors from Angel One broker API', async () => {
    await authenticateBroker();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway',
    } as any);

    const { status, body } = await post(
      '/api/broker/brokerage/estimate',
      validSingleOrder,
      AUTH_HEADER,
    );

    expect(status).toBe(500);
    expect(body.error).toContain('Angel One REST API error (502)');

    fetchMock.mockRestore();
  });

  it('should propagate network errors from Angel One broker API', async () => {
    await authenticateBroker();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Network error: connection refused'),
    );

    const { status, body } = await post(
      '/api/broker/brokerage/estimate',
      validSingleOrder,
      AUTH_HEADER,
    );

    expect(status).toBe(500);
    expect(body.error).toBeDefined();

    fetchMock.mockRestore();
  });
});
