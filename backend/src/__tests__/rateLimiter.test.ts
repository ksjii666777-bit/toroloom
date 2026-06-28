/**
 * ============================================================================
 * Rate Limiter — Unit Tests
 * ============================================================================
 *
 * Covers all branches in:
 *   - parseMax()       – env-var parsing with fallback
 *   - extractUserId()  – JWT extraction from Authorization header
 *   - userOrIpKeyGenerator() – per-user vs per-IP key generation
 *   - skipInTest       – NODE_ENV-dependent skip logic
 *   - Limiter configs  – baseline validation of auth/write/read/admin limiters
 *
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';

// Helper: create a base64url-encoded JWT with a given payload
function createJWT(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${body}.dummy_sig`;
}

// Helper: create a minimal Express Request stub
function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '::1' },
    ...overrides,
  } as unknown as Request;
}

// ──── parseMax ──────────────────────────────────────────────────────────────

describe('parseMax', () => {
  let parseMax: typeof import('../middleware/rateLimiter')['parseMax'];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../middleware/rateLimiter');
    parseMax = mod.parseMax;
  });

  it('returns defaultVal when envVar is undefined', () => {
    expect(parseMax(10, undefined)).toBe(10);
  });

  it('returns defaultVal when envVar is empty string', () => {
    expect(parseMax(10, '')).toBe(10);
  });

  it('returns parsed value when envVar is a valid positive number', () => {
    expect(parseMax(10, '50')).toBe(50);
  });

  it('returns defaultVal when envVar is not a valid number', () => {
    expect(parseMax(10, 'not-a-number')).toBe(10);
  });

  it('returns defaultVal when envVar is zero', () => {
    expect(parseMax(10, '0')).toBe(10);
  });

  it('returns defaultVal when envVar is negative', () => {
    expect(parseMax(10, '-5')).toBe(10);
  });
});

// ──── extractUserId ─────────────────────────────────────────────────────────

describe('extractUserId', () => {
  let extractUserId: typeof import('../middleware/rateLimiter')['extractUserId'];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../middleware/rateLimiter');
    extractUserId = mod.extractUserId;
  });

  it('returns null when no Authorization header is present', () => {
    const req = mockReq({ headers: {} });
    expect(extractUserId(req)).toBeNull();
  });

  it('returns null when header does not start with "Bearer "', () => {
    const req = mockReq({ headers: { authorization: 'Basic abc123' } });
    expect(extractUserId(req)).toBeNull();
  });

  it('returns null when token part is empty', () => {
    const req = mockReq({ headers: { authorization: 'Bearer ' } });
    expect(extractUserId(req)).toBeNull();
  });

  it('returns null when jwt.decode returns null (malformed token)', () => {
    const req = mockReq({ headers: { authorization: 'Bearer not-a-valid-jwt' } });
    expect(extractUserId(req)).toBeNull();
  });

  it('returns null when decoded payload has no userId field', () => {
    const token = createJWT({ sub: '12345', role: 'user' });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    expect(extractUserId(req)).toBeNull();
  });

  it('extracts and returns userId from a valid JWT', () => {
    const token = createJWT({ userId: 'user_test_123', role: 'trader' });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    expect(extractUserId(req)).toBe('user_test_123');
  });

  it('returns null when jwt.decode throws (catch branch)', () => {
    // Force jwt.decode to throw by spying
    const spy = vi.spyOn(jwt, 'decode').mockImplementationOnce(() => {
      throw new Error('mock decode error');
    });
    const req = mockReq({ headers: { authorization: 'Bearer some.token.here' } });
    expect(extractUserId(req)).toBeNull();
    spy.mockRestore();
  });

  it('returns null when payload is null (null payload branch)', () => {
    const spy = vi.spyOn(jwt, 'decode').mockReturnValueOnce(null);
    const req = mockReq({ headers: { authorization: 'Bearer some.token.here' } });
    expect(extractUserId(req)).toBeNull();
    spy.mockRestore();
  });

  it('returns null when payload has no userId (nullish coalesce branch)', () => {
    const spy = vi.spyOn(jwt, 'decode').mockReturnValueOnce({});
    const req = mockReq({ headers: { authorization: 'Bearer some.token.here' } });
    expect(extractUserId(req)).toBeNull();
    spy.mockRestore();
  });
});

// ──── userOrIpKeyGenerator ─────────────────────────────────────────────────

describe('userOrIpKeyGenerator', () => {
  let userOrIpKeyGenerator: typeof import('../middleware/rateLimiter')['userOrIpKeyGenerator'];
  let extractUserId: typeof import('../middleware/rateLimiter')['extractUserId'];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../middleware/rateLimiter');
    userOrIpKeyGenerator = mod.userOrIpKeyGenerator;
    extractUserId = mod.extractUserId;
  });

  it('returns user-based key when request has a valid JWT userId', () => {
    const token = createJWT({ userId: 'user_key_test' });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    expect(userOrIpKeyGenerator(req)).toBe('user:user_key_test');
  });

  it('returns ip-based key when request has no auth', () => {
    const req = mockReq({ headers: {}, ip: '10.20.30.40' });
    expect(userOrIpKeyGenerator(req)).toBe('ip:10.20.30.40');
  });

  it('falls back to socket.remoteAddress when req.ip is undefined', () => {
    const req = mockReq({
      headers: {},
      ip: undefined,
      socket: { remoteAddress: '192.168.1.1' },
    } as unknown as Request);
    expect(userOrIpKeyGenerator(req)).toBe('ip:192.168.1.1');
  });

  it('falls back to "unknown" when neither ip nor remoteAddress is set', () => {
    const req = mockReq({
      headers: {},
      ip: undefined,
      socket: {},
    } as unknown as Request);
    expect(userOrIpKeyGenerator(req)).toBe('ip:unknown');
  });
});

// ──── Limiter Configurations (in test mode — skip enabled) ──────────────────

describe('limiter configurations (NODE_ENV=test — skip enabled)', () => {
  let authLimiter: typeof import('../middleware/rateLimiter')['authLimiter'];
  let writeLimiter: typeof import('../middleware/rateLimiter')['writeLimiter'];
  let readLimiter: typeof import('../middleware/rateLimiter')['readLimiter'];
  let adminLimiter: typeof import('../middleware/rateLimiter')['adminLimiter'];

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../middleware/rateLimiter');
    authLimiter = mod.authLimiter;
    writeLimiter = mod.writeLimiter;
    readLimiter = mod.readLimiter;
    adminLimiter = mod.adminLimiter;
  });

  it('authLimiter is a function (middleware)', () => {
    expect(typeof authLimiter).toBe('function');
  });

  it('writeLimiter is a function (middleware)', () => {
    expect(typeof writeLimiter).toBe('function');
  });

  it('readLimiter is a function (middleware)', () => {
    expect(typeof readLimiter).toBe('function');
  });

  it('adminLimiter is a function (middleware)', () => {
    expect(typeof adminLimiter).toBe('function');
  });

  it('all limiters pass through requests in test mode (skip: true)', async () => {
    const req = mockReq();
    const res = {} as any;
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    // All 4 limiters should call next() immediately in test mode
    await authLimiter(req, res, next);
    expect(nextCalled).toBe(true);

    nextCalled = false;
    await writeLimiter(req, res, next);
    expect(nextCalled).toBe(true);

    nextCalled = false;
    await readLimiter(req, res, next);
    expect(nextCalled).toBe(true);

    nextCalled = false;
    await adminLimiter(req, res, next);
    expect(nextCalled).toBe(true);
  });
});

// ──── Limiter Configurations (non-test mode) ────────────────────────────────

describe('limiter configurations (NODE_ENV=development — skip disabled)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('loads limiters without skip when NODE_ENV is not "test"', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const mod = await import('../middleware/rateLimiter');

    expect(typeof mod.authLimiter).toBe('function');
    expect(typeof mod.writeLimiter).toBe('function');
    expect(typeof mod.readLimiter).toBe('function');
    expect(typeof mod.adminLimiter).toBe('function');

    // Verify they don't skip — create mock req/res/next
    const req = mockReq({ headers: { authorization: `Bearer ${createJWT({ userId: 'rate-test' })}` } });
    const jsonSpy = vi.fn();
    const statusSpy = vi.fn(() => ({ json: jsonSpy }));
    const res = { status: statusSpy, setHeader: vi.fn() } as any;
    let nextCalls = 0;
    const next = () => { nextCalls++; };

    // With only 1 request per limiter, each should call next() (not rate-limited)
    // Invoke all 4 limiters to exercise their keyGenerator arrow-functions
    await mod.authLimiter(req, res, next);
    await mod.writeLimiter(req, res, next);
    await mod.readLimiter(req, res, next);
    await mod.adminLimiter(req, res, next);

    expect(nextCalls).toBe(4);
    expect(statusSpy).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('loads limiters with custom env overrides', async () => {
    process.env.NODE_ENV = 'development';
    process.env.RATE_LIMIT_AUTH_MAX = '5';
    process.env.RATE_LIMIT_WRITE_MAX = '25';
    process.env.RATE_LIMIT_READ_MAX = '100';
    process.env.RATE_LIMIT_ADMIN_MAX = '10';

    vi.resetModules();
    const mod = await import('../middleware/rateLimiter');

    // Verify they load without error — middleware functions exist
    expect(typeof mod.authLimiter).toBe('function');
    expect(typeof mod.writeLimiter).toBe('function');
    expect(typeof mod.readLimiter).toBe('function');
    expect(typeof mod.adminLimiter).toBe('function');

    delete process.env.RATE_LIMIT_AUTH_MAX;
    delete process.env.RATE_LIMIT_WRITE_MAX;
    delete process.env.RATE_LIMIT_READ_MAX;
    delete process.env.RATE_LIMIT_ADMIN_MAX;
    process.env.NODE_ENV = originalNodeEnv;
  });
});

// ──── apiLimiter alias ─────────────────────────────────────────────────────

describe('apiLimiter alias', () => {
  it('apiLimiter refers to the same function as readLimiter', async () => {
    vi.resetModules();
    const mod = await import('../middleware/rateLimiter');
    expect(mod.apiLimiter).toBe(mod.readLimiter);
  });
});
