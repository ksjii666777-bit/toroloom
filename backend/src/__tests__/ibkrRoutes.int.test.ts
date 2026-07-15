/**
 * ============================================================================
 * Interactive Brokers (IBKR) Gateway — Route Integration Tests
 * ============================================================================
 *
 * Tests the 3 IBKR-specific REST endpoints by:
 *   1. Mocking IbkrBroker to return controlled results
 *   2. Mocking the registry module to track setUserConnection calls
 *   3. Issuing real HTTP requests against a minimal Express app
 *
 * This validates:
 *   - POST /api/broker/ibkr/connect — success path, auth failure, missing URL
 *   - GET  /api/broker/ibkr/status  — connected, not connected, error state
 *   - POST /api/broker/ibkr/disconnect — success, already disconnected
 *   - Auth middleware rejects unauthenticated requests
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/ibkrRoutes.int.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import http from 'http';
import { generateToken } from '../middleware/auth';

// ──── Mock IbkrBroker ─────────────────────────────────────────────────────
// Use a simple factory function instead of vi.fn().mockImplementation()
// to avoid constructor/mock interaction issues.

const mockAuthenticate = vi.fn();
const mockIsConnected = vi.fn();
const mockDisconnect = vi.fn();
let mockName = 'Interactive Brokers';

// Factory that returns a plain object matching IbkrBroker's shape
function createMockIbkrBroker() {
  return {
    authenticate: mockAuthenticate,
    isConnected: mockIsConnected,
    disconnect: mockDisconnect,
    name: mockName,
  };
}

vi.mock('../services/broker/ibkrBroker', () => ({
  IbkrBroker: vi.fn(createMockIbkrBroker),
}));

// ──── Mock Registry ───────────────────────────────────────────────────────
// Uses Maps inside the factory closure. Maps are exposed as __test* properties
// so beforeEach can clear them for full test isolation.

vi.mock('../services/broker/registry', () => {
  const instances = new Map<string, any>();
  const connectionTypes = new Map<string, string>();

  return {
    registry: {
      // Exposed for test cleanup
      __testInstances: instances,
      __testConnectionTypes: connectionTypes,
      // Registry methods used by the IBKR route handlers
      setUserConnection: vi.fn((userId: string, type: string, instance: any | null) => {
        if (instance) {
          instances.set(userId, instance);
          connectionTypes.set(userId, type);
        } else {
          instances.delete(userId);
          connectionTypes.delete(userId);
        }
      }),
      getUserBroker: vi.fn((userId: string) => instances.get(userId)),
      getUserBrokerType: vi.fn((userId: string) => connectionTypes.get(userId)),
      resetConnections: vi.fn(),
      // Registry methods used by registerDefaults.ts during module init
      register: vi.fn(),
      unregister: vi.fn(),
      has: vi.fn(() => false),
      getPlugin: vi.fn(),
      getAllPlugins: vi.fn(() => []),
      getAllMeta: vi.fn(() => []),
      getByRegion: vi.fn(() => []),
      getByCapability: vi.fn(() => []),
      search: vi.fn(() => []),
      createBroker: vi.fn(),
      createWithFallback: vi.fn(),
      get count() { return 0; },
      on: vi.fn(),
    },
  };
});

// ──── Route import (AFTER mocks are set up) ──────────────────────────────
import brokerRoutes from '../routes/broker';

// ──── Constants & Helpers ────────────────────────────────────────────────

const TEST_USER_ID = 'test_user_ibkr';
const TEST_TOKEN = generateToken({ userId: TEST_USER_ID, email: 'ibkr@toroloom.com' });
const AUTH_HEADER = { Authorization: `Bearer ${TEST_TOKEN}` };

function request(
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url.toString(),
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          let parsed: any;
          try { parsed = data ? JSON.parse(data) : undefined; } catch { parsed = data; }
          resolve({ status: res.statusCode!, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function post(path: string, body?: any, headers?: Record<string, string>) {
  return request('POST', path, body, headers);
}

function get(path: string, headers?: Record<string, string>) {
  return request('GET', path, undefined, headers);
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

// Import mocked registry for beforeEach cleanup
import { registry } from '../services/broker/registry';

beforeEach(() => {
  vi.clearAllMocks();
  // Clear the Maps inside the mock factory's closure for full test isolation
  (registry as any).__testInstances.clear();
  (registry as any).__testConnectionTypes.clear();
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/broker/ibkr/connect
// ═════════════════════════════════════════════════════════════════════════

describe('POST /api/broker/ibkr/connect', () => {
  it('should connect successfully with default gateway URL', async () => {
    mockAuthenticate.mockResolvedValueOnce(true);

    const { status, body } = await post('/api/broker/ibkr/connect', {}, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Connected');
    expect(body.gatewayUrl).toBe('http://localhost:5000');

    expect(mockAuthenticate).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'ibkr', gatewayUrl: 'http://localhost:5000', accountId: '' }),
    );
  });

  it('should connect with custom gateway URL and account ID', async () => {
    mockAuthenticate.mockResolvedValueOnce(true);

    const { status, body } = await post(
      '/api/broker/ibkr/connect',
      { gatewayUrl: 'http://gateway:8080', accountId: 'U1234567' },
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.gatewayUrl).toBe('http://gateway:8080');

    expect(mockAuthenticate).toHaveBeenCalledWith(
      expect.objectContaining({ gatewayUrl: 'http://gateway:8080', accountId: 'U1234567' }),
    );
  });

  it('should return 400 when authentication fails', async () => {
    mockAuthenticate.mockResolvedValueOnce(false);

    const { status, body } = await post('/api/broker/ibkr/connect', {}, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Could not authenticate');
  });

  it('should return 500 when authentication throws an error', async () => {
    mockAuthenticate.mockRejectedValueOnce(new Error('Gateway refused connection'));

    const { status, body } = await post('/api/broker/ibkr/connect', {}, AUTH_HEADER);

    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain('Gateway refused connection');
  });

  it('should reject unauthenticated requests (no auth header)', async () => {
    const { status } = await post('/api/broker/ibkr/connect', {});

    expect(status).toBe(401);
  });

  it('should use default URL when empty gateway URL is provided', async () => {
    mockAuthenticate.mockResolvedValueOnce(true);

    const { status, body } = await post(
      '/api/broker/ibkr/connect',
      { gatewayUrl: '' },
      AUTH_HEADER,
    );

    expect(status).toBe(200);
    expect(body.gatewayUrl).toBe('http://localhost:5000');
  });
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/broker/ibkr/status
// ═════════════════════════════════════════════════════════════════════════

describe('GET /api/broker/ibkr/status', () => {
  it('should return connected=true when broker is connected', async () => {
    // First connect the broker (mocked authenticate returns true)
    mockAuthenticate.mockResolvedValueOnce(true);
    await post('/api/broker/ibkr/connect', {}, AUTH_HEADER);

    // Now the mock registry has the broker instance. Set isConnected to true.
    mockIsConnected.mockReturnValueOnce(true);

    const { status, body } = await get('/api/broker/ibkr/status', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.connected).toBe(true);
    expect(body.broker).toBe('Interactive Brokers');
  });

  it('should return connected=false when broker is registered but disconnected', async () => {
    // First connect the broker
    mockAuthenticate.mockResolvedValueOnce(true);
    await post('/api/broker/ibkr/connect', {}, AUTH_HEADER);

    // Broker is in registry but not connected
    mockIsConnected.mockReturnValueOnce(false);

    const { status, body } = await get('/api/broker/ibkr/status', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.connected).toBe(false);
  });

  it('should return connected=false when no broker is registered', async () => {
    // Don't connect — registry is empty (cleared by beforeEach)
    const { status, body } = await get('/api/broker/ibkr/status', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.connected).toBe(false);
    expect(body.error).toContain('No IBKR connection found');
  });

  it('should reject unauthenticated requests', async () => {
    const { status } = await get('/api/broker/ibkr/status');

    expect(status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/broker/ibkr/disconnect
// ═════════════════════════════════════════════════════════════════════════

describe('POST /api/broker/ibkr/disconnect', () => {
  it('should disconnect successfully when broker is connected', async () => {
    // First connect
    mockAuthenticate.mockResolvedValueOnce(true);
    await post('/api/broker/ibkr/connect', {}, AUTH_HEADER);

    // Now disconnect
    const { status, body } = await post('/api/broker/ibkr/disconnect', {}, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Disconnected');
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should succeed as no-op when no broker is connected', async () => {
    // Don't connect — registry is empty
    const { status, body } = await post('/api/broker/ibkr/disconnect', {}, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('should reject unauthenticated requests', async () => {
    const { status } = await post('/api/broker/ibkr/disconnect', {});

    expect(status).toBe(401);
  });

  it('should be safe to call disconnect twice (idempotent)', async () => {
    // First connect
    mockAuthenticate.mockResolvedValueOnce(true);
    await post('/api/broker/ibkr/connect', {}, AUTH_HEADER);

    // First disconnect
    await post('/api/broker/ibkr/disconnect', {}, AUTH_HEADER);

    // Second disconnect — should be no-op
    const { status, body } = await post('/api/broker/ibkr/disconnect', {}, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // disconnect should have been called exactly once (first call only)
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
