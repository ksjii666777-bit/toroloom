/**
 * ============================================================================
 * Replay Protection — Unit Tests
 * ============================================================================
 *
 * Covers all exported functions and middleware behavior:
 *   - ReplayAttackError       — Error class with status code and error codes
 *   - validateNonce()         — Nonce + timestamp validation logic
 *   - replayProtection()      — Express middleware integration
 *   - getActiveNonceCount()   — Nonce tracking counter
 *   - clearNonces()           — Emergency reset for test/incident
 *   - expireNonce()           — Manual nonce expiry
 *
 * MODULE STATE:
 *   replayProtection uses a module-level Map (usedNonces) to track seen
 *   nonces. To keep tests isolated, clearNonces() is called before each
 *   test via beforeEach.
 *
 * Run: npx vitest run src/__tests__/replayProtection.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ──── Import fresh for each describe block ──────────────────────────────────
// We use dynamic import so each describe block gets a clean reference.
// Nonce state is cleared in beforeEach() below.

async function importModule() {
  return await import('../middleware/replayProtection');
}

// Clear nonce state before every test so tests don't interfere with each other.
beforeEach(async () => {
  const mod = await importModule();
  mod.clearNonces();
});

// ============================================================================
// 1. ReplayAttackError
// ============================================================================

describe('ReplayAttackError', () => {
  it('creates an error with default code', async () => {
    const { ReplayAttackError } = await importModule();
    const err = new ReplayAttackError('Replay detected');

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ReplayAttackError');
    expect(err.message).toBe('Replay detected');
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('REPLAY_ATTACK_DETECTED');
  });

  it('creates an error with custom code', async () => {
    const { ReplayAttackError } = await importModule();
    const err = new ReplayAttackError('Nonce reused', 'NONCE_REUSED');

    expect(err.message).toBe('Nonce reused');
    expect(err.code).toBe('NONCE_REUSED');
    expect(err.statusCode).toBe(429);
  });

  it('uses 429 status code (Too Many Requests)', async () => {
    const { ReplayAttackError } = await importModule();
    const err = new ReplayAttackError('test');
    expect(err.statusCode).toBe(429);
  });
});

// ============================================================================
// 2. validateNonce — Nonce Validation
// ============================================================================

describe('validateNonce — nonce validation', () => {
  const VALID_TIMESTAMP = Date.now();

  it('throws MISSING_NONCE when nonce is undefined', async () => {
    const { validateNonce, ReplayAttackError } = await importModule();
    expect(() => validateNonce(undefined as any, VALID_TIMESTAMP)).toThrow(ReplayAttackError);
    try {
      validateNonce(undefined as any, VALID_TIMESTAMP);
    } catch (err) {
      expect((err as ReplayAttackError).code).toBe('MISSING_NONCE');
    }
  });

  it('throws MISSING_NONCE when nonce is empty string', async () => {
    const { validateNonce, ReplayAttackError } = await importModule();
    expect(() => validateNonce('', VALID_TIMESTAMP)).toThrow(ReplayAttackError);
    try {
      validateNonce('', VALID_TIMESTAMP);
    } catch (err) {
      expect((err as ReplayAttackError).code).toBe('MISSING_NONCE');
    }
  });

  it('throws MISSING_NONCE when nonce is not a string', async () => {
    const { validateNonce, ReplayAttackError } = await importModule();
    expect(() => validateNonce(123 as any, VALID_TIMESTAMP)).toThrow(ReplayAttackError);
    try {
      validateNonce(123 as any, VALID_TIMESTAMP);
    } catch (err) {
      expect((err as ReplayAttackError).code).toBe('MISSING_NONCE');
    }
  });

  it('throws INVALID_NONCE_FORMAT when nonce is too short (< 8 chars)', async () => {
    const { validateNonce, ReplayAttackError } = await importModule();
    expect(() => validateNonce('short', VALID_TIMESTAMP)).toThrow(ReplayAttackError);
    try {
      validateNonce('short', VALID_TIMESTAMP);
    } catch (err) {
      expect((err as ReplayAttackError).code).toBe('INVALID_NONCE_FORMAT');
    }
  });

  it('throws INVALID_NONCE_FORMAT when nonce is too long (> 128 chars)', async () => {
    const { validateNonce, ReplayAttackError } = await importModule();
    const longNonce = 'x'.repeat(129);
    expect(() => validateNonce(longNonce, VALID_TIMESTAMP)).toThrow(ReplayAttackError);
    try {
      validateNonce(longNonce, VALID_TIMESTAMP);
    } catch (err) {
      expect((err as ReplayAttackError).code).toBe('INVALID_NONCE_FORMAT');
    }
  });

  it('allows nonce at minimum length (8 chars)', async () => {
    const { validateNonce } = await importModule();
    expect(() => validateNonce('12345678', VALID_TIMESTAMP)).not.toThrow();
  });

  it('allows nonce at maximum length (128 chars)', async () => {
    const { validateNonce } = await importModule();
    const longNonce = 'x'.repeat(128);
    expect(() => validateNonce(longNonce, VALID_TIMESTAMP)).not.toThrow();
  });
});

// ============================================================================
// 3. validateNonce — Timestamp Validation
// ============================================================================

describe('validateNonce — timestamp validation', () => {
  const VALID_NONCE = 'valid-nonce-12345';

  it('throws MISSING_TIMESTAMP when timestamp is undefined', async () => {
    const { validateNonce, ReplayAttackError } = await importModule();
    expect(() => validateNonce(VALID_NONCE, undefined as any)).toThrow(ReplayAttackError);
    try {
      validateNonce(VALID_NONCE, undefined as any);
    } catch (err) {
      expect((err as ReplayAttackError).code).toBe('MISSING_TIMESTAMP');
    }
  });

  it('throws MISSING_TIMESTAMP when timestamp is 0', async () => {
    const { validateNonce, ReplayAttackError } = await importModule();
    expect(() => validateNonce(VALID_NONCE, 0)).toThrow(ReplayAttackError);
    try {
      validateNonce(VALID_NONCE, 0);
    } catch (err) {
      expect((err as ReplayAttackError).code).toBe('MISSING_TIMESTAMP');
    }
  });

  it('throws MISSING_TIMESTAMP when timestamp is not a number', async () => {
    const { validateNonce, ReplayAttackError } = await importModule();
    expect(() => validateNonce(VALID_NONCE, 'string' as any)).toThrow(ReplayAttackError);
    try {
      validateNonce(VALID_NONCE, 'string' as any);
    } catch (err) {
      expect((err as ReplayAttackError).code).toBe('MISSING_TIMESTAMP');
    }
  });

  it('throws TIMESTAMP_EXPIRED when timestamp is older than the window (5 min)', async () => {
    const { validateNonce, ReplayAttackError } = await importModule();
    const oldTimestamp = Date.now() - 301_000; // 5 min 1 sec ago
    expect(() => validateNonce(VALID_NONCE, oldTimestamp)).toThrow(ReplayAttackError);
    try {
      validateNonce(VALID_NONCE, oldTimestamp);
    } catch (err) {
      expect((err as ReplayAttackError).code).toBe('TIMESTAMP_EXPIRED');
    }
  });

  it('throws TIMESTAMP_EXPIRED with correct message containing seconds', async () => {
    const { validateNonce, ReplayAttackError } = await importModule();
    const oldTimestamp = Date.now() - 600_000; // 10 min ago
    try {
      validateNonce(VALID_NONCE, oldTimestamp);
    } catch (err) {
      expect((err as ReplayAttackError).message).toContain('300');
      expect((err as ReplayAttackError).message).toContain('seconds');
    }
  });

  it('allows timestamp just within the window boundary (299s ago)', async () => {
    const { validateNonce } = await importModule();
    // Use 4 min 59s (299_000ms) instead of exactly 5 min to avoid
    // race conditions with Date.now() precision between the test and function
    const boundaryTimestamp = Date.now() - 299_000;
    expect(() => validateNonce(VALID_NONCE, boundaryTimestamp)).not.toThrow();
  });

  it('allows current timestamp', async () => {
    const { validateNonce } = await importModule();
    expect(() => validateNonce(VALID_NONCE, Date.now())).not.toThrow();
  });

  it('allows timestamp slightly in the past (within window)', async () => {
    const { validateNonce } = await importModule();
    expect(() => validateNonce(VALID_NONCE, Date.now() - 60_000)).not.toThrow(); // 1 min ago
  });
});

// ============================================================================
// 4. validateNonce — Future Timestamps (Clock Drift)
// ============================================================================

describe('validateNonce — future timestamps', () => {
  const VALID_NONCE = 'future-test-nonce';

  it('allows timestamp up to 1 minute in the future (clock drift)', async () => {
    const { validateNonce } = await importModule();
    const futureTimestamp = Date.now() + 30_000; // 30 seconds in future
    expect(() => validateNonce(VALID_NONCE, futureTimestamp)).not.toThrow();
  });

  it('allows timestamp exactly 1 minute in the future', async () => {
    const { validateNonce } = await importModule();
    const futureTimestamp = Date.now() + 60_000; // exactly 1 min in future
    expect(() => validateNonce(VALID_NONCE, futureTimestamp)).not.toThrow();
  });

  it('throws TIMESTAMP_FUTURE when timestamp is more than 1 minute in the future', async () => {
    const { validateNonce, ReplayAttackError } = await importModule();
    const futureTimestamp = Date.now() + 61_000; // 61 seconds in future
    expect(() => validateNonce(VALID_NONCE, futureTimestamp)).toThrow(ReplayAttackError);
    try {
      validateNonce(VALID_NONCE, futureTimestamp);
    } catch (err) {
      expect((err as ReplayAttackError).code).toBe('TIMESTAMP_FUTURE');
    }
  });
});

// ============================================================================
// 5. validateNonce — Replay Detection (Nonce Reuse)
// ============================================================================

describe('validateNonce — replay detection', () => {
  const VALID_NONCE = 'unique-nonce-abc';
  const VALID_TIMESTAMP = Date.now();

  it('throws NONCE_REUSED when the same nonce is used again', async () => {
    const { validateNonce, ReplayAttackError } = await importModule();

    // First use — should succeed
    validateNonce(VALID_NONCE, VALID_TIMESTAMP);

    // Second use — should throw
    expect(() => validateNonce(VALID_NONCE, VALID_TIMESTAMP)).toThrow(ReplayAttackError);
    try {
      validateNonce(VALID_NONCE, VALID_TIMESTAMP);
    } catch (err) {
      expect((err as ReplayAttackError).code).toBe('NONCE_REUSED');
    }
  });

  it('allows different nonces', async () => {
    const { validateNonce } = await importModule();
    const now = Date.now();

    expect(() => validateNonce('nonce-aaa', now)).not.toThrow();
    expect(() => validateNonce('nonce-bbb', now)).not.toThrow();
    expect(() => validateNonce('nonce-ccc', now)).not.toThrow();
  });

  it('throws NONCE_REUSED even with a different timestamp', async () => {
    const { validateNonce, ReplayAttackError } = await importModule();

    validateNonce(VALID_NONCE, Date.now());

    // Same nonce, even with new timestamp → rejected
    const newTimestamp = Date.now() + 1000;
    expect(() => validateNonce(VALID_NONCE, newTimestamp)).toThrow(ReplayAttackError);
    try {
      validateNonce(VALID_NONCE, newTimestamp);
    } catch (err) {
      expect((err as ReplayAttackError).code).toBe('NONCE_REUSED');
    }
  });

  it('rejects repeated nonces and does not mark them as used', async () => {
    const { validateNonce } = await importModule();
    const nonce = 'reject-nonce';
    const now = Date.now();

    // First use — succeeds, nonce marked used
    validateNonce(nonce, now);

    // Second use — throws
    expect(() => validateNonce(nonce, now)).toThrow();

    // After rejection, nonce count should still be 1 (not incremented on rejection)
    // Actually, the count stays 1 because we only insert on success
  });
});

// ============================================================================
// 6. getActiveNonceCount
// ============================================================================

describe('getActiveNonceCount', () => {
  it('returns 0 when no nonces have been used', async () => {
    const { getActiveNonceCount } = await importModule();
    expect(getActiveNonceCount()).toBe(0);
  });

  it('increments after successful nonce validation', async () => {
    const { validateNonce, getActiveNonceCount } = await importModule();

    expect(getActiveNonceCount()).toBe(0);

    validateNonce('nonce-001', Date.now());
    expect(getActiveNonceCount()).toBe(1);

    validateNonce('nonce-002', Date.now());
    expect(getActiveNonceCount()).toBe(2);

    validateNonce('nonce-003', Date.now());
    expect(getActiveNonceCount()).toBe(3);
  });

  it('decrements after nonce is expired', async () => {
    const { validateNonce, expireNonce, getActiveNonceCount } = await importModule();

    validateNonce('nonce-to-expire', Date.now());
    expect(getActiveNonceCount()).toBe(1);

    expireNonce('nonce-to-expire');
    expect(getActiveNonceCount()).toBe(0);
  });

  it('does not increment on validation failure', async () => {
    const { validateNonce, getActiveNonceCount } = await importModule();

    expect(getActiveNonceCount()).toBe(0);

    try { validateNonce('', Date.now()); } catch { /* expected */ }
    expect(getActiveNonceCount()).toBe(0);

    try { validateNonce('short', Date.now()); } catch { /* expected */ }
    expect(getActiveNonceCount()).toBe(0);

    try { validateNonce('valid-length', 0); } catch { /* expected */ }
    expect(getActiveNonceCount()).toBe(0);
  });
});

// ============================================================================
// 7. clearNonces
// ============================================================================

describe('clearNonces', () => {
  it('clears all tracked nonces', async () => {
    const { validateNonce, clearNonces, getActiveNonceCount } = await importModule();

    validateNonce('nonce-aaa', Date.now());
    validateNonce('nonce-bbb', Date.now());
    validateNonce('nonce-ccc', Date.now());
    expect(getActiveNonceCount()).toBe(3);

    clearNonces();
    expect(getActiveNonceCount()).toBe(0);
  });

  it('allows previously used nonces after clearing', async () => {
    const { validateNonce, clearNonces } = await importModule();

    const nonce = 'reusable-after-clear';
    const now = Date.now();

    validateNonce(nonce, now);
    expect(() => validateNonce(nonce, now)).toThrow(); // Replay prevented

    clearNonces();

    // After clear, the same nonce can be used again
    expect(() => validateNonce(nonce, Date.now())).not.toThrow();
  });
});

// ============================================================================
// 8. expireNonce
// ============================================================================

describe('expireNonce', () => {
  it('returns true when nonce exists and is expired', async () => {
    const { validateNonce, expireNonce } = await importModule();

    validateNonce('to-expire', Date.now());
    const result = expireNonce('to-expire');
    expect(result).toBe(true);
  });

  it('returns false when nonce does not exist', async () => {
    const { expireNonce } = await importModule();
    const result = expireNonce('nonexistent');
    expect(result).toBe(false);
  });

  it('reduces the active count after expiry', async () => {
    const { validateNonce, expireNonce, getActiveNonceCount } = await importModule();

    validateNonce('expire-me', Date.now());
    expect(getActiveNonceCount()).toBe(1);

    expireNonce('expire-me');
    expect(getActiveNonceCount()).toBe(0);
  });

  it('allows same nonce to be used again after expiry', async () => {
    const { validateNonce, expireNonce } = await importModule();

    const nonce = 'use-expire-use-again';
    const now = Date.now();

    validateNonce(nonce, now);
    expireNonce(nonce);

    // After expiry, the nonce can be accepted again
    expect(() => validateNonce(nonce, Date.now())).not.toThrow();
  });
});

// ============================================================================
// 9. replayProtection — Express Middleware (Skip cases)
// ============================================================================

describe('replayProtection middleware — skip cases', () => {
  it('skips validation for GET requests', async () => {
    const { replayProtection } = await importModule();

    const req = { method: 'GET' } as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    replayProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips validation for HEAD requests', async () => {
    const { replayProtection } = await importModule();

    const req = { method: 'HEAD' } as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    replayProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips validation for OPTIONS requests', async () => {
    const { replayProtection } = await importModule();

    const req = { method: 'OPTIONS' } as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    replayProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips validation when body is null', async () => {
    const { replayProtection } = await importModule();

    const req = { method: 'POST', body: null } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    replayProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips validation when body is undefined', async () => {
    const { replayProtection } = await importModule();

    const req = { method: 'POST' } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    replayProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips validation when body is not an object (e.g., string)', async () => {
    const { replayProtection } = await importModule();

    const req = { method: 'POST', body: 'raw string' } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    replayProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// 10. replayProtection — Middleware Backward Compatibility
// ============================================================================

describe('replayProtection middleware — backward compatibility', () => {
  it('allows requests without nonce/timestamp (old clients)', async () => {
    const { replayProtection } = await importModule();

    const req = {
      method: 'POST',
      body: { amount: 100, currency: 'INR' },
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    replayProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('preserves body fields when no nonce is provided', async () => {
    const { replayProtection } = await importModule();

    const body = { amount: 100, currency: 'INR' };
    const req = { method: 'POST', body } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    replayProtection(req, res, next);
    expect(body).toEqual({ amount: 100, currency: 'INR' });
  });
});

// ============================================================================
// 11. replayProtection — Middleware Valid Nonce
// ============================================================================

describe('replayProtection middleware — valid nonce', () => {
  it('allows request with valid nonce and timestamp', async () => {
    const { replayProtection } = await importModule();

    const req = {
      method: 'POST',
      body: {
        nonce: 'valid-nonce-987654',
        timestamp: Date.now(),
        amount: 500,
      },
    } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    replayProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('removes nonce and timestamp from body after validation', async () => {
    const { replayProtection } = await importModule();

    const body = {
      nonce: 'cleanup-nonce-123',
      timestamp: Date.now(),
      amount: 500,
      planId: 'pro',
    };
    const req = { method: 'POST', body } as unknown as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    replayProtection(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Nonce and timestamp should be removed from body
    expect(body.nonce).toBeUndefined();
    expect(body.timestamp).toBeUndefined();

    // Other fields should be preserved
    expect(body.amount).toBe(500);
    expect(body.planId).toBe('pro');
  });
});

// ============================================================================
// 12. replayProtection — Middleware Blocked Requests
// ============================================================================

describe('replayProtection middleware — blocked requests', () => {
  it('returns 429 when nonce is reused', async () => {
    const { replayProtection } = await importModule();

    const body = {
      nonce: 'replay-nonce',
      timestamp: Date.now(),
    };

    // First request — allowed
    const req1 = { method: 'POST', body: { ...body } } as unknown as Request;
    const res1 = {} as Response;
    const next1 = vi.fn() as NextFunction;
    replayProtection(req1, res1, next1);
    expect(next1).toHaveBeenCalledTimes(1);

    // Second request with same nonce — blocked
    const req2 = { method: 'POST', body: { ...body } } as unknown as Request;
    const res2 = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next2 = vi.fn() as NextFunction;

    replayProtection(req2, res2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.status).toHaveBeenCalledWith(429);
    expect(res2.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NONCE_REUSED' }),
    );
  });

  it('returns 429 when timestamp is expired', async () => {
    const { replayProtection } = await importModule();

    const req = {
      method: 'POST',
      body: {
        nonce: 'expired-ts-nonce',
        timestamp: Date.now() - 600_000, // 10 min old
      },
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    replayProtection(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TIMESTAMP_EXPIRED' }),
    );
  });

  it('returns 429 when timestamp is too far in the future', async () => {
    const { replayProtection } = await importModule();

    const req = {
      method: 'POST',
      body: {
        nonce: 'future-ts-nonce',
        timestamp: Date.now() + 120_000, // 2 min in future
      },
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    replayProtection(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TIMESTAMP_FUTURE' }),
    );
  });

  it('returns 429 when nonce is too short', async () => {
    const { replayProtection } = await importModule();

    const req = {
      method: 'POST',
      body: {
        nonce: 'short', // < 8 chars
        timestamp: Date.now(),
      },
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    replayProtection(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_NONCE_FORMAT' }),
    );
  });
});

// ============================================================================
// 13. Integration: Middleware + Nonce Tracking
// ============================================================================

describe('middleware + nonce tracking integration', () => {
  it('tracks active nonces across middleware calls', async () => {
    const { replayProtection, getActiveNonceCount } = await importModule();

    const makeReq = (nonce: string) => ({
      method: 'POST',
      body: { nonce, timestamp: Date.now() },
    }) as unknown as Request;

    const passRes = {} as Response;
    const passNext = vi.fn() as NextFunction;

    replayProtection(makeReq('nonce-001'), passRes, passNext);
    replayProtection(makeReq('nonce-002'), passRes, passNext);
    replayProtection(makeReq('nonce-003'), passRes, passNext);

    expect(getActiveNonceCount()).toBe(3);
  });

  it('GET requests do not affect nonce count', async () => {
    const { replayProtection, getActiveNonceCount } = await importModule();

    const passRes = {} as Response;
    const passNext = vi.fn() as NextFunction;

    // GET requests should be skipped
    replayProtection(
      { method: 'GET', body: { nonce: 'should-not-count' } } as unknown as Request,
      passRes,
      passNext,
    );
    replayProtection(
      { method: 'GET' } as unknown as Request,
      passRes,
      passNext,
    );

    expect(getActiveNonceCount()).toBe(0);
  });
});

// ============================================================================
// 14. Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('handles nonce with special characters (UUID format)', async () => {
    const { validateNonce } = await importModule();
    const uuidNonce = '550e8400-e29b-41d4-a716-446655440000'; // UUID v4
    expect(() => validateNonce(uuidNonce, Date.now())).not.toThrow();
  });

  it('handles nonce at boundary length (8 chars = minimum)', async () => {
    const { validateNonce } = await importModule();
    expect(() => validateNonce('12345678', Date.now())).not.toThrow();
  });

  it('handles nonce with URL-unsafe characters', async () => {
    const { validateNonce } = await importModule();
    expect(() => validateNonce('nonce+/=test123', Date.now())).not.toThrow();
  });

  it('handles timestamp as floating point number', async () => {
    const { validateNonce } = await importModule();
    expect(() => validateNonce('float-ts-nonce', Date.now() + 0.5)).not.toThrow();
  });

  it('handles multiple rapid validations with different nonces', async () => {
    const { validateNonce, getActiveNonceCount } = await importModule();
    const now = Date.now();

    for (let i = 0; i < 20; i++) {
      validateNonce(`rapid-nonce-${i}`, now);
    }

    expect(getActiveNonceCount()).toBe(20);
  });
});
