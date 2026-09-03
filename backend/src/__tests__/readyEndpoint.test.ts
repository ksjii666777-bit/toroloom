/**
 * ============================================================================
 * Toroloom — /ready Readiness Endpoint Tests
 * ============================================================================
 *
 * /ready is the Railway healthcheckPath. It must return 503 when a real
 * storage backend (postgres/mongodb) is configured but the DB is unreachable,
 * and 200 otherwise (healthy storage, or memory backend which is always
 * 'healthy'). /health remains the liveness check (always 200).
 * ============================================================================
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';

// ──── Env must be set BEFORE the server module is imported (env.ts reads
// process.env at import time). vi.hoisted runs before all imports.
vi.hoisted(() => {
  process.env.STORAGE_BACKEND = 'postgres';
  process.env.DATABASE_URL = 'postgres://x';
  process.env.JWT_SECRET = 'test-secret';
});

// ──── Storage mock state (controlled per test) ─────────────────────────────
const mocks = vi.hoisted(() => ({
  storageHealthy: true as boolean,
}));

vi.mock('../services/storage', () => ({
  getStorageIfInitialized: () => ({
    isHealthy: async () => mocks.storageHealthy,
  }),
  getStorage: async () => ({
    isHealthy: async () => mocks.storageHealthy,
  }),
  getStorageBackend: () => 'postgres',
  resetStorage: () => {},
}));

// ──── Server imported ONCE at module scope ───────────────────────────────
// Re-importing per test would re-run module-level side effects (e.g.
// prom-client collectDefaultMetrics in services/metrics.ts) and throw
// "already been registered". The /ready handler reads env.storageBackend
// at request time, so we can mutate it per test instead.
import { app } from '../server';
import { env } from '../config/env';

type StorageBackend = 'memory' | 'postgres' | 'mongodb';

function setBackend(b: StorageBackend): void {
  (env as { storageBackend: StorageBackend }).storageBackend = b;
}

describe('GET /ready', () => {
  afterEach(() => {
    mocks.storageHealthy = true;
    setBackend('postgres');
  });

  it('returns 200 when postgres storage is healthy', async () => {
    mocks.storageHealthy = true;
    setBackend('postgres');
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.storageBackend).toBe('postgres');
    expect(res.body.storageHealthy).toBe(true);
  });

  it('returns 503 when postgres storage is unhealthy', async () => {
    mocks.storageHealthy = false;
    setBackend('postgres');
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
    expect(res.body.storageBackend).toBe('postgres');
    expect(res.body.storageHealthy).toBe(false);
  });

  it('returns 200 for mongodb backend when healthy', async () => {
    mocks.storageHealthy = true;
    setBackend('mongodb');
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('returns 503 for mongodb backend when unhealthy', async () => {
    mocks.storageHealthy = false;
    setBackend('mongodb');
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not_ready');
  });

  it('returns 200 for memory backend regardless of storage health', async () => {
    // Memory backend is always 'healthy' by design — never 503.
    mocks.storageHealthy = false;
    setBackend('memory');
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.storageBackend).toBe('memory');
  });

  it('/health still returns 200 (liveness) when postgres is unhealthy', async () => {
    mocks.storageHealthy = false;
    setBackend('postgres');
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.storageHealthy).toBe(false);
  });

  it('/api/health returns 200 (liveness alias) when postgres is unhealthy', async () => {
    // /api/health is the /health alias that monitoring tools (Prometheus
    // blackbox, k8s probes, Grafana) probe by default. It must NOT 503 when
    // storage is degraded — same liveness semantics as /health.
    mocks.storageHealthy = false;
    setBackend('postgres');
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.storageHealthy).toBe(false);
    expect(res.body.storageBackend).toBe('postgres');
    expect(typeof res.body.uptime).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('/api/health returns ok when storage is healthy', async () => {
    mocks.storageHealthy = true;
    setBackend('postgres');
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.storageHealthy).toBe(true);
  });
});

describe('Legal pages (privacy / terms)', () => {
  // These HTML files are shipped in backend/public/ by the Dockerfile and
  // served at /privacy, /terms, /legal so Play Console / App Store listings
  // can point to live HTTPS URLs instead of a local file.

  it('GET /privacy returns the privacy policy HTML', async () => {
    const res = await request(app).get('/privacy');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Privacy Policy');
    expect(res.text).toContain('Toroloom');
  });

  it('GET /terms returns the terms of service HTML', async () => {
    const res = await request(app).get('/terms');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Terms');
  });

  it('GET /legal returns the legal hub index HTML', async () => {
    const res = await request(app).get('/legal');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});
