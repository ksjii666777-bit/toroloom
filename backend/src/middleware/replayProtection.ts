/**
 * ============================================================================
 * Toroloom — Replay Attack Protection Middleware
 * ============================================================================
 *
 * Protects against replay attacks by requiring:
 *   1. A unique nonce (single-use token) per request
 *   2. A timestamp within an acceptable window (default: 5 minutes)
 *
 * How it works:
 *   - Client generates a nonce (UUID) and includes it with the request
 *   - Server checks that the nonce hasn't been used (in-memory Set)
 *   - Server checks that the timestamp is within the allowed window
 *   - Used nonces are expired after the timestamp window passes
 *
 * USAGE:
 *   import { replayProtection } from '../middleware/replayProtection';
 *
 *   // Apply to sensitive endpoints only (payments, orders, auth)
 *   app.post('/api/payments/create-order', replayProtection, handler);
 *
 * CLIENT-SIDE:
 *   {
 *     nonce: 'uuid-v4',           // Unique per request
 *     timestamp: Date.now(),      // Unix timestamp in ms
 *     ...payload
 *   }
 *
 * CONFIGURATION (via env vars):
 *   REPLAY_WINDOW_MS     — Time window for valid timestamps (default: 300000 = 5 min)
 *   NONCE_CLEANUP_INTERVAL — How often to clean expired nonces (default: 60000 = 1 min)
 *
 * ============================================================================
 */

import type { Request, Response, NextFunction } from 'express';

// ──── Configuration ─────────────────────────────────────────────────────────

const REPLAY_WINDOW_MS = parseInt(process.env.REPLAY_WINDOW_MS || '300000', 10);
const NONCE_CLEANUP_INTERVAL = parseInt(process.env.NONCE_CLEANUP_INTERVAL || '300000', 10);

// ──── In-Memory Nonce Store ─────────────────────────────────────────────────
// Used nonces are tracked in memory. They expire after the replay window
// passes, so memory usage is bounded.
//
// In a clustered deployment, use Redis for shared nonce state:
//   import { redis } from '../services/redis';
//   const used = await redis.sismember('used_nonces', nonce);
//   await redis.sadd('used_nonces', nonce, 'EX', REPLAY_WINDOW_MS / 1000);

interface NonceEntry {
  nonce: string;
  expiresAt: number;
}

const usedNonces: Map<string, number> = new Map();

// ──── Periodic Cleanup ──────────────────────────────────────────────────────

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [nonce, expiresAt] of usedNonces.entries()) {
      if (now >= expiresAt) {
        usedNonces.delete(nonce);
      }
    }
    // If the map is empty after cleanup, stop the timer
    if (usedNonces.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, NONCE_CLEANUP_INTERVAL);

  // Allow the process to exit even if the timer is active
  if (cleanupTimer && typeof cleanupTimer === 'object') {
    cleanupTimer.unref();
  }
}

// ──── Error Class ───────────────────────────────────────────────────────────

export class ReplayAttackError extends Error {
  public statusCode = 429;
  public code: string;

  constructor(message: string, code: string = 'REPLAY_ATTACK_DETECTED') {
    super(message);
    this.name = 'ReplayAttackError';
    this.code = code;
  }
}

// ──── Nonce Validation ──────────────────────────────────────────────────────

/**
 * Validate a nonce + timestamp pair.
 * Throws ReplayAttackError on validation failure.
 */
export function validateNonce(
  nonce: string,
  timestamp: number,
): void {
  // --- Validate nonce ---
  if (!nonce || typeof nonce !== 'string') {
    throw new ReplayAttackError('Missing or invalid nonce', 'MISSING_NONCE');
  }

  if (nonce.length < 8 || nonce.length > 128) {
    throw new ReplayAttackError('Invalid nonce format', 'INVALID_NONCE_FORMAT');
  }

  // --- Check for nonce reuse ---
  if (usedNonces.has(nonce)) {
    throw new ReplayAttackError('Nonce already used — possible replay attack', 'NONCE_REUSED');
  }

  // --- Validate timestamp ---
  if (!timestamp || typeof timestamp !== 'number') {
    throw new ReplayAttackError('Missing or invalid timestamp', 'MISSING_TIMESTAMP');
  }

  const now = Date.now();
  const age = now - timestamp;

  if (age < 0) {
    // Timestamp is in the future — could be clock drift, but also an attack signal
    if (Math.abs(age) > 60000) {
      // More than 1 minute in the future: reject
      throw new ReplayAttackError('Timestamp is in the future — clock sync issue', 'TIMESTAMP_FUTURE');
    }
    // Allow up to 1 minute of clock drift
  }

  if (age > REPLAY_WINDOW_MS) {
    throw new ReplayAttackError(
      `Timestamp expired — request is more than ${REPLAY_WINDOW_MS / 1000} seconds old`,
      'TIMESTAMP_EXPIRED',
    );
  }

  // --- Mark nonce as used ---
  usedNonces.set(nonce, now + REPLAY_WINDOW_MS);

  // Start cleanup if this is the first nonce
  if (usedNonces.size === 1) {
    startCleanup();
  }
}

// ──── Express Middleware ─────────────────────────────────────────────────────

/**
 * Express middleware that validates nonce and timestamp on sensitive requests.
 *
 * On validation success, removes nonce and timestamp from body so downstream
 * handlers don't need to deal with them.
 */
export function replayProtection(req: Request, _res: Response, next: NextFunction): void {
  try {
    // Skip for GET/HEAD/OPTIONS (idempotent methods don't need replay protection)
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }

    // Skip if body is missing or not an object (e.g., file uploads)
    if (!req.body || typeof req.body !== 'object') {
      next();
      return;
    }

    const { nonce, timestamp } = req.body as { nonce?: string; timestamp?: number };

    // Validate nonce + timestamp
    if (nonce && timestamp) {
      validateNonce(nonce, timestamp);

      // Remove nonce and timestamp from body so downstream code doesn't see them
      const body = req.body as Record<string, unknown>;
      delete body.nonce;
      delete body.timestamp;
    }
    // If no nonce/timestamp, allow the request through.
    // This supports backward compatibility with existing clients that don't
    // send nonce/timestamp yet. In a future release, this can be made required
    // on all write endpoints after all clients are updated.

    next();
  } catch (err) {
    if (err instanceof ReplayAttackError) {
      _res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
}

// ──── Utility Functions ─────────────────────────────────────────────────────

/**
 * Get count of currently tracked nonces (for monitoring).
 */
export function getActiveNonceCount(): number {
  return usedNonces.size;
}

/**
 * Clear all tracked nonces (for testing or emergency reset).
 */
export function clearNonces(): void {
  usedNonces.clear();
}

/**
 * Manually expire a nonce.
 */
export function expireNonce(nonce: string): boolean {
  return usedNonces.delete(nonce);
}

export default {
  replayProtection,
  validateNonce,
  getActiveNonceCount,
  clearNonces,
  expireNonce,
  ReplayAttackError,
};
