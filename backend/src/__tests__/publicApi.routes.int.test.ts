/**
 * ============================================================================
 * Toroloom — Public REST API Integration Tests
 * ============================================================================
 *
 * Tests the full lifecycle of the Public REST API:
 *   1. API key management (create, list, revoke, delete, validate)
 *   2. Public API v1 endpoints (market, portfolio, watchlist, account)
 *   3. API key auth middleware (valid key, missing key, wrong scopes, expiry)
 *   4. Edge cases (duplicate names, invalid scopes, expired keys)
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/publicApi.routes.int.test.ts
 * ============================================================================
 */

vi.hoisted(() => {
  process.env.BROKER = 'mock';
  process.env.DATA_SOURCE = 'mock';
  process.env.OPENROUTER_API_KEY = '';
  process.env.GOOGLE_GEMINI_API_KEY = '';
  process.env.STORAGE_BACKEND = 'memory';
  process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';
import { generateToken } from '../middleware/auth';
import { InMemoryStorage } from '../services/storage/inMemory';
import { configureApiKeyPersistence } from '../services/apiKeyService';

// ──── Route imports ─────────────────────────────────────────────────────────

import apiKeyRoutes from '../routes/apiKeys';
import publicApiRoutes from '../routes/publicApi';
import apiDocsRoutes from '../routes/apiDocs';

// ──── Constants ─────────────────────────────────────────────────────────────

const TEST_USER_ID = 'test_user_pubapi';
const TEST_ADMIN_ID = 'test_admin_pubapi';
const TEST_TOKEN = generateToken({ userId: TEST_USER_ID, email: 'test@toroloom.com' });
const TEST_ADMIN_TOKEN = generateToken({ userId: TEST_ADMIN_ID, email: 'admin@toroloom.com', role: 'admin' });
const AUTH_HEADER = { Authorization: `Bearer ${TEST_TOKEN}` };
const ADMIN_HEADER = { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` };

// ──── Test storage ──────────────────────────────────────────────────────────

let storage: InMemoryStorage;

// ──── Helpers ───────────────────────────────────────────────────────────────

type ReqOptions = {
  method?: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
};

function request(opts: ReqOptions): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, baseUrl);
    const req = http.request(
      url.toString(),
      {
        method: opts.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...opts.headers,
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
          resolve({ status: res.statusCode!, body, headers: res.headers });
        });
      },
    );
    req.on('error', reject);

    if (opts.body) {
      req.write(JSON.stringify(opts.body));
    }
    req.end();
  });
}

function get(path: string, headers?: Record<string, string>) {
  return request({ method: 'GET', path, headers });
}

function post(path: string, body?: any, headers?: Record<string, string>) {
  return request({ method: 'POST', path, body, headers });
}

function put(path: string, body?: any, headers?: Record<string, string>) {
  return request({ method: 'PUT', path, body, headers });
}

function del(path: string, headers?: Record<string, string>) {
  return request({ method: 'DELETE', path, headers });
}

// ──── Server ────────────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  // Initialize in-memory storage and wire it into the API key service
  storage = new InMemoryStorage();
  await storage.connect();
  configureApiKeyPersistence(storage);

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Mount routes matching production layout
  app.use('/api/user/api-keys', apiKeyRoutes);
  app.use('/api/v1', publicApiRoutes);
  app.use('/api/docs', apiDocsRoutes);

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

// Clear API keys between test groups
beforeEach(async () => {
  // Clear the in-memory API key store by creating a fresh one
  storage = new InMemoryStorage();
  await storage.connect();
  configureApiKeyPersistence(storage);
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1: API KEY MANAGEMENT — CREATE & LIST
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/user/api-keys — Create API Key', () => {
  it('should create an API key with valid params', async () => {
    const { status, body } = await post('/api/user/api-keys', {
      name: 'Test Bot',
      scopes: ['market:read', 'portfolio:read'],
      expiresInDays: 90,
    }, AUTH_HEADER);

    expect(status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Test Bot');
    expect(body.key).toBeDefined();
    expect(body.key).toMatch(/^tol_/);
    expect(body.maskedKey).toBeDefined();
    expect(body.scopes).toEqual(['market:read', 'portfolio:read']);
    expect(body.expiresAt).toBeDefined();
    expect(body.message).toContain('Copy this key now');
  });

  it('should create an API key without expiry (never expires)', async () => {
    const { status, body } = await post('/api/user/api-keys', {
      name: 'Forever Key',
      scopes: ['market:read'],
    }, AUTH_HEADER);

    expect(status).toBe(201);
    expect(body.expiresAt).toBeNull();
  });

  it('should reject key creation without name', async () => {
    const { status, body } = await post('/api/user/api-keys', {
      scopes: ['market:read'],
    }, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('name');
  });

  it('should reject key creation with empty name', async () => {
    const { status, body } = await post('/api/user/api-keys', {
      name: '',
      scopes: ['market:read'],
    }, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('name');
  });

  it('should reject key creation without scopes', async () => {
    const { status, body } = await post('/api/user/api-keys', {
      name: 'No Scopes Key',
    }, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('scope');
  });

  it('should reject key creation with empty scopes array', async () => {
    const { status, body } = await post('/api/user/api-keys', {
      name: 'Empty Scopes',
      scopes: [],
    }, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('scope');
  });

  it('should reject key creation with invalid scopes', async () => {
    const { status, body } = await post('/api/user/api-keys', {
      name: 'Bad Scopes',
      scopes: ['invalid:scope', 'market:read'],
    }, AUTH_HEADER);

    expect(status).toBe(400);
    expect(body.error).toContain('Invalid scopes');
    expect(body.validScopes).toBeDefined();
  });

  it('should create API keys with all valid scope combinations', async () => {
    const scopeSets = [
      ['market:read'],
      ['market:read', 'portfolio:read'],
      ['market:read', 'portfolio:read', 'trades:read', 'watchlist:read', 'account:read', 'notifications:read'],
      ['orders:read', 'orders:write'],
      ['ai:read'],
    ];

    for (const scopes of scopeSets) {
      const { status, body } = await post('/api/user/api-keys', {
        name: `Key for ${scopes.join(',')}`,
        scopes,
      }, AUTH_HEADER);
      expect(status).toBe(201);
      expect(body.scopes).toEqual(scopes);
    }
  });

  it('should reject without JWT auth', async () => {
    const { status } = await post('/api/user/api-keys', {
      name: 'Unauthed Key',
      scopes: ['market:read'],
    });

    expect(status).toBe(401);
  });

  it('should reject with invalid JWT', async () => {
    const { status } = await post('/api/user/api-keys', {
      name: 'Bad Token Key',
      scopes: ['market:read'],
    }, { Authorization: 'Bearer invalid-token' });

    expect(status).toBe(401);
  });
});

describe('GET /api/user/api-keys — List API Keys', () => {
  beforeEach(async () => {
    // Create 3 keys for the test user
    await post('/api/user/api-keys', { name: 'Key A', scopes: ['market:read'] }, AUTH_HEADER);
    await post('/api/user/api-keys', { name: 'Key B', scopes: ['portfolio:read'] }, AUTH_HEADER);
    await post('/api/user/api-keys', { name: 'Key C', scopes: ['trades:read'] }, AUTH_HEADER);
  });

  it('should list all keys for the authenticated user', async () => {
    const { status, body } = await get('/api/user/api-keys', AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.keys).toBeDefined();
    expect(Array.isArray(body.keys)).toBe(true);
    expect(body.keys.length).toBe(3);
  });

  it('should not expose keyHash in response', async () => {
    const { status, body } = await get('/api/user/api-keys', AUTH_HEADER);

    expect(status).toBe(200);
    for (const key of body.keys) {
      expect(key.keyHash).toBeUndefined();
      expect(key.key).toBeUndefined();
    }
  });

  it('should expose maskedKey (prefix + suffix)', async () => {
    const { status, body } = await get('/api/user/api-keys', AUTH_HEADER);

    expect(status).toBe(200);
    for (const key of body.keys) {
      expect(key.maskedKey).toBeDefined();
      expect(key.maskedKey).toMatch(/^tol_/);
      expect(key.maskedKey).toContain('...');
    }
  });

  it('should return empty list for user with no keys', async () => {
    const { status, body } = await get('/api/user/api-keys', ADMIN_HEADER);

    expect(status).toBe(200);
    expect(body.keys).toEqual([]);
  });

  it('should reject listing without auth', async () => {
    const { status } = await get('/api/user/api-keys');
    expect(status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2: API KEY MANAGEMENT — REVOKE & DELETE
// ═════════════════════════════════════════════════════════════════════════════

describe('PUT /api/user/api-keys/:id — Revoke API Key', () => {
  let keyId: string;

  beforeEach(async () => {
    const { body } = await post('/api/user/api-keys', {
      name: 'Key To Revoke',
      scopes: ['market:read'],
    }, AUTH_HEADER);
    keyId = body.id;
  });

  it('should revoke an active API key', async () => {
    const { status, body } = await put(`/api/user/api-keys/${keyId}`, {
      isActive: false,
    }, AUTH_HEADER);

    expect(status).toBe(200);
    expect(body.isActive).toBe(false);
    expect(body.message).toContain('revoked');
  });

  it('should reflect revocation in listing', async () => {
    await put(`/api/user/api-keys/${keyId}`, { isActive: false }, AUTH_HEADER);
    const { body } = await get('/api/user/api-keys', AUTH_HEADER);

    const key = body.keys.find((k: any) => k.id === keyId);
    expect(key.isActive).toBe(false);
  });

  it('should reject revoking non-existent key', async () => {
    const { status, body } = await put('/api/user/api-keys/nonexistent-id', {
      isActive: false,
    }, AUTH_HEADER);

    expect(status).toBe(404);
    expect(body.error).toContain('not found');
  });

  it('should reject revoking another user\'s key', async () => {
    const { status, body } = await put(`/api/user/api-keys/${keyId}`, {
      isActive: false,
    }, ADMIN_HEADER);

    expect(status).toBe(404);
    expect(body.error).toContain('not found');
  });

  it('should reject without auth', async () => {
    const { status } = await put(`/api/user/api-keys/${keyId}`, { isActive: false });
    expect(status).toBe(401);
  });
});

describe('DELETE /api/user/api-keys/:id — Delete API Key', () => {
  let activeKeyId: string;
  let revokedKeyId: string;

  beforeEach(async () => {
    const { body: k1 } = await post('/api/user/api-keys', {
      name: 'Active Key', scopes: ['market:read'],
    }, AUTH_HEADER);
    activeKeyId = k1.id;

    const { body: k2 } = await post('/api/user/api-keys', {
      name: 'Revoked Key', scopes: ['portfolio:read'],
    }, AUTH_HEADER);
    revokedKeyId = k2.id;
    await put(`/api/user/api-keys/${revokedKeyId}`, { isActive: false }, AUTH_HEADER);
  });

  it('should permanently delete an active key', async () => {
    const { status } = await del(`/api/user/api-keys/${activeKeyId}`, AUTH_HEADER);
    expect(status).toBe(204);

    const { body } = await get('/api/user/api-keys', AUTH_HEADER);
    expect(body.keys.find((k: any) => k.id === activeKeyId)).toBeUndefined();
  });

  it('should permanently delete a revoked key', async () => {
    const { status } = await del(`/api/user/api-keys/${revokedKeyId}`, AUTH_HEADER);
    expect(status).toBe(204);

    const { body } = await get('/api/user/api-keys', AUTH_HEADER);
    expect(body.keys.find((k: any) => k.id === revokedKeyId)).toBeUndefined();
  });

  it('should reject deleting non-existent key', async () => {
    const { status, body } = await del('/api/user/api-keys/nonexistent', AUTH_HEADER);
    expect(status).toBe(404);
    expect(body.error).toContain('not found');
  });

  it('should reject deleting another user\'s key', async () => {
    const { status } = await del(`/api/user/api-keys/${activeKeyId}`, ADMIN_HEADER);
    expect(status).toBe(404);
  });

  it('should reject without auth', async () => {
    const { status } = await del(`/api/user/api-keys/${activeKeyId}`);
    expect(status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3: PUBLIC API — MARKET ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/v1/market/* — Market Endpoints (API Key Auth)', () => {
  let apiKey: string;

  beforeEach(async () => {
    const { body } = await post('/api/user/api-keys', {
      name: 'Market Test Key',
      scopes: ['market:read'],
    }, AUTH_HEADER);
    apiKey = body.key;
  });

  it('GET /api/v1/market/indices — should return indices', async () => {
    const { status, body } = await get('/api/v1/market/indices', {
      'X-API-Key': apiKey,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/market/stocks — should return stocks', async () => {
    const { status, body } = await get('/api/v1/market/stocks', {
      'X-API-Key': apiKey,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/market/quote/:symbol — should return quote', async () => {
    const { status, body } = await get('/api/v1/market/quote/RELIANCE', {
      'X-API-Key': apiKey,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.symbol).toBe('RELIANCE');
  });

  it('GET /api/v1/market/quotes — should return bulk quotes', async () => {
    const { status, body } = await get('/api/v1/market/quotes?symbols=RELIANCE,TCS,INFY', {
      'X-API-Key': apiKey,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/market/quotes — should reject without symbols param', async () => {
    const { status, body } = await get('/api/v1/market/quotes', {
      'X-API-Key': apiKey,
    });

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain('symbols');
  });

  it('GET /api/v1/market/ohlc/:symbol — should return OHLC data', async () => {
    const { status, body } = await get('/api/v1/market/ohlc/RELIANCE?interval=day&days=5', {
      'X-API-Key': apiKey,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET /api/v1/market/search — should return search results', async () => {
    const { status, body } = await get('/api/v1/market/search?q=RELIANCE', {
      'X-API-Key': apiKey,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/market/search — should return empty for empty query', async () => {
    const { status, body } = await get('/api/v1/market/search?q=', {
      'X-API-Key': apiKey,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4: PUBLIC API — PORTFOLIO, WATCHLIST & ACCOUNT
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/v1/portfolio/* — Portfolio Endpoints', () => {
  let portfolioKey: string;

  beforeEach(async () => {
    const { body } = await post('/api/user/api-keys', {
      name: 'Portfolio Key',
      scopes: ['portfolio:read'],
    }, AUTH_HEADER);
    portfolioKey = body.key;
  });

  it('GET /api/v1/portfolio/holdings — should return holdings', async () => {
    const { status, body } = await get('/api/v1/portfolio/holdings', {
      'X-API-Key': portfolioKey,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/portfolio/positions — should return positions', async () => {
    const { status, body } = await get('/api/v1/portfolio/positions', {
      'X-API-Key': portfolioKey,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('GET /api/v1/portfolio/trades — Trades Endpoint', () => {
  let tradesKey: string;

  beforeEach(async () => {
    const { body } = await post('/api/user/api-keys', {
      name: 'Trades Key',
      scopes: ['trades:read'],
    }, AUTH_HEADER);
    tradesKey = body.key;
  });

  it('should return trade history', async () => {
    const { status, body } = await get('/api/v1/portfolio/trades', {
      'X-API-Key': tradesKey,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('GET /api/v1/account/profile — Account Endpoint', () => {
  let accountKey: string;

  beforeEach(async () => {
    const { body } = await post('/api/user/api-keys', {
      name: 'Account Key',
      scopes: ['account:read'],
    }, AUTH_HEADER);
    accountKey = body.key;
  });

  it('should return user profile with scopes and keyId', async () => {
    const { status, body } = await get('/api/v1/account/profile', {
      'X-API-Key': accountKey,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.userId).toBeDefined();
    expect(body.data.scopes).toContain('account:read');
    expect(body.data.keyId).toBeDefined();
  });
});

describe('GET /api/v1/watchlist — Watchlist Endpoint', () => {
  let watchlistKey: string;

  beforeEach(async () => {
    const { body } = await post('/api/user/api-keys', {
      name: 'Watchlist Key',
      scopes: ['watchlist:read'],
    }, AUTH_HEADER);
    watchlistKey = body.key;
  });

  it('should return watchlist data', async () => {
    const { status, body } = await get('/api/v1/watchlist', {
      'X-API-Key': watchlistKey,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5: API KEY AUTH MIDDLEWARE — SECURITY TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('API Key Auth Middleware — Security', () => {
  let validKey: string;
  let keyId: string;

  beforeEach(async () => {
    const { body } = await post('/api/user/api-keys', {
      name: 'Security Test Key',
      scopes: ['market:read'],
      expiresInDays: 365,
    }, AUTH_HEADER);
    validKey = body.key;
    keyId = body.id;
  });

  it('should reject request without API key', async () => {
    const { status, body } = await get('/api/v1/market/indices');

    expect(status).toBe(401);
    expect(body.error).toContain('Missing API key');
    expect(body.docs).toBeDefined();
  });

  it('should reject request with invalid API key format', async () => {
    const { status, body } = await get('/api/v1/market/indices', {
      'X-API-Key': 'not-a-valid-key',
    });

    expect(status).toBe(401);
    expect(body.error).toBeDefined();
  });

  it('should reject request with revoked API key', async () => {
    // Revoke the key first
    await put(`/api/user/api-keys/${keyId}`, { isActive: false }, AUTH_HEADER);

    const { status, body } = await get('/api/v1/market/indices', {
      'X-API-Key': validKey,
    });

    expect(status).toBe(401);
    expect(body.error).toContain('revoked');
  });

  it('should reject request with expired API key', async () => {
    // Create a key that expires immediately (using expiresInDays: 0)
    // But since our API doesn't allow 0, we'll manually expire it
    // via storage manipulation
    const { body: keyData } = await post('/api/user/api-keys', {
      name: 'Quick Expire Key',
      scopes: ['market:read'],
      expiresInDays: 1, // Minimal
    }, AUTH_HEADER);

    const expiredKey = keyData.key;

    // Manually set expiresAt to the past in storage
    const storedKey = await storage.loadApiKey(keyData.id);
    if (storedKey) {
      storedKey.expiresAt = new Date(Date.now() - 86400000).toISOString();
      await storage.saveApiKey(storedKey);
    }

    const { status, body } = await get('/api/v1/market/indices', {
      'X-API-Key': expiredKey,
    });

    expect(status).toBe(401);
    expect(body.error).toContain('expired');
  });

  it('should reject request with insufficient scopes', async () => {
    // This key only has 'market:read', not 'portfolio:read'
    const { status, body } = await get('/api/v1/portfolio/holdings', {
      'X-API-Key': validKey,
    });

    expect(status).toBe(403);
    expect(body.error).toContain('Insufficient');
    expect(body.required).toContain('portfolio:read');
    expect(body.granted).toContain('market:read');
  });

  it('should accept request with sufficient scopes', async () => {
    const { status, body } = await get('/api/v1/market/indices', {
      'X-API-Key': validKey,
    });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should update lastUsedAt on successful auth', async () => {
    // First use the key
    await get('/api/v1/market/indices', { 'X-API-Key': validKey });

    // Check that lastUsedAt was updated
    const { body } = await get('/api/user/api-keys', AUTH_HEADER);
    const key = body.keys.find((k: any) => k.id === keyId);
    expect(key.lastUsedAt).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6: FULL WORKFLOW TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('Full API Key Lifecycle', () => {
  it('should complete a full lifecycle: create → list → use → revoke → fail', async () => {
    // Step 1: Create a key
    const createRes = await post('/api/user/api-keys', {
      name: 'Lifecycle Key',
      scopes: ['market:read', 'portfolio:read'],
      expiresInDays: 30,
    }, AUTH_HEADER);
    expect(createRes.status).toBe(201);
    const key = createRes.body.key;
    const keyId = createRes.body.id;

    // Step 2: List keys and verify it appears
    const listRes = await get('/api/user/api-keys', AUTH_HEADER);
    expect(listRes.body.keys.find((k: any) => k.id === keyId)).toBeDefined();

    // Step 3: Use the key for market data
    const useRes = await get('/api/v1/market/indices', { 'X-API-Key': key });
    expect(useRes.status).toBe(200);
    expect(useRes.body.success).toBe(true);

    // Step 4: Use it for portfolio data
    const portRes = await get('/api/v1/portfolio/holdings', { 'X-API-Key': key });
    expect(portRes.status).toBe(200);
    expect(portRes.body.success).toBe(true);

    // Step 5: Revoke the key
    const revokeRes = await put(`/api/user/api-keys/${keyId}`, { isActive: false }, AUTH_HEADER);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.isActive).toBe(false);

    // Step 6: Verify the key no longer works
    const failRes = await get('/api/v1/market/indices', { 'X-API-Key': key });
    expect(failRes.status).toBe(401);
    expect(failRes.body.error).toContain('revoked');

    // Step 7: Delete the key permanently
    const delRes = await del(`/api/user/api-keys/${keyId}`, AUTH_HEADER);
    expect(delRes.status).toBe(204);

    // Step 8: Verify it's gone from listing
    const finalList = await get('/api/user/api-keys', AUTH_HEADER);
    expect(finalList.body.keys.find((k: any) => k.id === keyId)).toBeUndefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 7: API DOCS ENDPOINT
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/docs — API Documentation', () => {
  it('should return HTML documentation page', async () => {
    const url = new URL('/api/docs', baseUrl);
    const res = await fetch(url.toString());

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Toroloom API');
    expect(text).toContain('swagger-ui');
    expect(text).toContain('openapi.json');
  });

  it('GET /api/docs/openapi.json — should return valid OpenAPI spec', async () => {
    const { status, body } = await get('/api/docs/openapi.json');

    expect(status).toBe(200);
    expect(body.openapi).toBeDefined();
    expect(body.info.title).toBe('Toroloom Public API');
    expect(body.paths).toBeDefined();
    expect(body.paths['/market/indices']).toBeDefined();
    expect(body.paths['/portfolio/holdings']).toBeDefined();
    expect(body.paths['/account/profile']).toBeDefined();
    expect(body.components.securitySchemes.ApiKeyAuth).toBeDefined();
  });
});
