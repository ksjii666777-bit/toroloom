/**
 * ============================================================================
 * Toroloom — Rate Limiter Middleware
 * ============================================================================
 *
 * Three-tier rate limiting:
 *   1. Per-IP (fallback for unauthenticated requests)
 *   2. Per-User (uses JWT userId when available)
 *   3. Skip mode (NODE_ENV=test disables all limiting)
 *
 * Four limiter presets, each configurable via env vars:
 *   - authLimiter   : Login/signup (default 10 req / 15 min)
 *   - writeLimiter  : Mutations — orders, payments, broker link (default 50 req / min)
 *   - readLimiter   : Reads — market data, portfolio (default 200 req / min)
 *   - adminLimiter  : System / admin endpoints (default 20 req / min)
 *
 * Environment variable reference:
 *   RATE_LIMIT_AUTH_MAX    — Override auth limiter max (default 10)
 *   RATE_LIMIT_WRITE_MAX   — Override write limiter max (default 50)
 *   RATE_LIMIT_READ_MAX    — Override read limiter max (default 200)
 *   RATE_LIMIT_ADMIN_MAX   — Override admin limiter max (default 20)
 *   NODE_ENV=test          — Disables all rate limiting
 *
 * ============================================================================
 */

import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';

// ──── Helpers ──────────────────────────────────────────────────────────────

/** Safely extract userId from Authorization header without failing on invalid tokens. */
export function extractUserId(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.split(' ')[1];
  if (!token) return null;
  try {
    const payload = jwt.decode(token) as { userId?: string } | null;
    return payload?.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Custom key generator:
 *   - If the request carries a valid JWT → key = "user:{userId}" (per-user)
 *   - Otherwise → key = "ip:{req.ip}" (per-IP)
 *
 * This prevents authenticated users from bypassing limits by rotating IPs,
 * while still protecting unauthenticated endpoints (login, signup) from
 * brute-force via IP tracking.
 */
export function userOrIpKeyGenerator(req: Request): string {
  const userId = extractUserId(req);
  if (userId) return `user:${userId}`;
  return `ip:${req.ip ?? req.socket.remoteAddress ?? 'unknown'}`;
}

// ──── Configuration Helpers ───────────────────────────────────────────────

export function parseMax(defaultVal: number, envVar?: string): number {
  if (!envVar) return defaultVal;
  const parsed = parseInt(envVar, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultVal;
}

// ──── Skip in test ─────────────────────────────────────────────────────────

const skipInTest = process.env.NODE_ENV === 'test'
  ? { skip: () => true }
  : {};

/**
 * Auth rate limiter — strictest.
 * Window: 15 minutes
 * Default max: 10 requests
 * Use case: Login, signup, password reset
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseMax(10, process.env.RATE_LIMIT_AUTH_MAX),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => userOrIpKeyGenerator(req),
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  ...skipInTest,
});

/**
 * Write rate limiter — for mutations.
 * Window: 1 minute
 * Default max: 50 requests
 * Use case: Place order, add funds, create watchlist, broker link
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseMax(50, process.env.RATE_LIMIT_WRITE_MAX),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => userOrIpKeyGenerator(req),
  message: { error: 'Too many write requests. Please slow down.' },
  ...skipInTest,
});

/**
 * Read rate limiter — per-user read quota.
 * Window: 1 minute
 * Default max: 200 requests
 * Use case: Market data, portfolio view, education content
 */
export const readLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseMax(200, process.env.RATE_LIMIT_READ_MAX),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => userOrIpKeyGenerator(req),
  message: { error: 'Too many read requests. Please slow down.' },
  ...skipInTest,
});

/**
 * Admin / system rate limiter.
 * Window: 1 minute
 * Default max: 20 requests
 * Use case: Health checks, metrics, system status
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseMax(20, process.env.RATE_LIMIT_ADMIN_MAX),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => userOrIpKeyGenerator(req),
  message: { error: 'Too many requests.' },
  ...skipInTest,
});

/**
 * Legacy API limiter — for backward compatibility.
 * Same as readLimiter (100 req/min default).
 */
export const apiLimiter = readLimiter;
