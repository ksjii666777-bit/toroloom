/**
 * ============================================================================
 * Toroloom — Order Idempotency Service
 * ============================================================================
 *
 * Prevents duplicate order execution when a client retries a request after a
 * lost response (network timeout, app kill, offline replay, worker retry).
 *
 * Key format:  `order:{userId}:{idempotencyKey}`
 *
 * Claim-based flow (closes the check-then-act race):
 *   1. claimOrderExecution()  — atomically marks the key as PENDING
 *        · 'completed'     → a previous identical order finished; return its result
 *        · 'in_progress'   → an identical order is executing right now
 *        · 'claimed'       → this caller may proceed (only one wins)
 *   2. completeOrderExecution() — mark COMPLETED with the result (TTL 24h)
 *   3. releaseOrderExecution()  — called on execution error so a genuine
 *                                 retry can proceed
 *
 * Stale PENDING claims auto-release after ORDER_IDEMPOTENCY_STALE_MS (2 min)
 * so a crashed process never blocks retries forever.
 *
 * - In-memory store (always available, per-process, synchronous claim =
 *   atomic within a single process)
 * - Redis-backed via cacheService when REDIS_URL/RAILWAY_REDIS_URL is set
 *   (cluster-safe for completed results; a true multi-process SET NX claim
 *   is a documented follow-up)
 *
 * ============================================================================
 */

import * as cacheService from '../middleware/cacheService';

// ──── Configuration ─────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TTL_MS =
  parseInt(process.env.ORDER_IDEMPOTENCY_TTL_MS || String(DEFAULT_TTL_MS), 10) || DEFAULT_TTL_MS;
const TTL_SEC = Math.max(1, Math.floor(TTL_MS / 1000));

const STALE_CLAIM_MS =
  parseInt(process.env.ORDER_IDEMPOTENCY_STALE_MS || '120000', 10) || 120000; // 2 min

/** Bounded memory: if exceeded, expired entries are swept before writing. */
const MAX_MEM_ENTRIES = 50000;

function redisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL || process.env.RAILWAY_REDIS_URL);
}

// ──── In-Memory Store ───────────────────────────────────────────────────────

export type OrderClaimState = 'claimed' | 'in_progress' | 'completed';

interface StoredEntry {
  status: 'pending' | 'completed';
  result?: unknown;
  claimedAt?: number;
  expiresAt: number;
}

const memStore = new Map<string, StoredEntry>();

function storeKey(userId: string, idempotencyKey: string): string {
  return `order:${userId}:${idempotencyKey}`;
}

function sweepExpired(): void {
  if (memStore.size < MAX_MEM_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of memStore.entries()) {
    if (entry.expiresAt <= now) memStore.delete(key);
  }
}

// ──── Claim API ─────────────────────────────────────────────────────────────

/**
 * Try to claim an idempotency key for execution.
 *
 * Returns:
 *   { state: 'completed', result }  — a previous identical order finished
 *   { state: 'in_progress' }        — an identical order is executing now
 *   { state: 'claimed' }            — this caller may execute (claim held)
 */
export async function claimOrderExecution(
  userId: string,
  idempotencyKey: string,
): Promise<{ state: OrderClaimState; result?: unknown }> {
  const key = storeKey(userId, idempotencyKey);
  const now = Date.now();

  // 1. In-memory claim (synchronous → atomic within a process)
  const mem = memStore.get(key);
  if (mem) {
    if (mem.expiresAt <= now) {
      memStore.delete(key);
    } else if (mem.status === 'completed') {
      return { state: 'completed', result: mem.result };
    } else if (mem.status === 'pending') {
      const stale = now - (mem.claimedAt ?? now) >= STALE_CLAIM_MS;
      if (!stale) return { state: 'in_progress' };
      memStore.delete(key); // stale claim → allow retry
    }
  }

  // 2. Redis fallback: a completed result from another process/pod
  if (redisConfigured()) {
    try {
      const raw = await cacheService.get(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        memStore.set(key, { status: 'completed', result: parsed, expiresAt: now + TTL_MS });
        return { state: 'completed', result: parsed };
      }
    } catch {
      // Redis miss/error — proceed with a fresh claim
    }
  }

  // 3. Take the claim
  sweepExpired();
  memStore.set(key, { status: 'pending', claimedAt: now, expiresAt: now + TTL_MS });
  return { state: 'claimed' };
}

/**
 * Mark a key as completed with its result (TTL 24h). Replays return this.
 */
export async function completeOrderExecution(
  userId: string,
  idempotencyKey: string,
  result: unknown,
): Promise<void> {
  const key = storeKey(userId, idempotencyKey);
  memStore.set(key, { status: 'completed', result, expiresAt: Date.now() + TTL_MS });

  if (redisConfigured()) {
    try {
      await cacheService.set(key, JSON.stringify(result), TTL_SEC);
    } catch {
      // Best-effort — memory copy remains authoritative in-process
    }
  }
}

/**
 * Release a claim (called when execution THROWS) so a genuine retry can run.
 */
export async function releaseOrderExecution(
  userId: string,
  idempotencyKey: string,
): Promise<void> {
  const key = storeKey(userId, idempotencyKey);
  memStore.delete(key);

  if (redisConfigured()) {
    try {
      await cacheService.del(key);
    } catch {
      // Best-effort
    }
  }
}

// ──── Testing / Observability ───────────────────────────────────────────────

/** Clear all stored results/claims (used between tests). */
export function clearIdempotencyForTest(): void {
  memStore.clear();
}

/** Number of currently tracked keys (observability). */
export function getActiveIdempotencyCount(): number {
  return memStore.size;
}
