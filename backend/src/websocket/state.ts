/**
 * ============================================================================
 * Toroloom WebSocket — Shared State & Helpers
 * ============================================================================
 *
 * Module-level state maps, type definitions, and pure utility functions
 * extracted from the monolithic handler.ts.
 *
 * All state lives here as module-level singletons so every WebSocket
 * connection shares the same maps.
 * ============================================================================
 */

import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import cluster from 'cluster';
import { getBroker } from '../services/broker';
import { env } from '../config/env';
import { AuthPayload } from '../middleware/auth';
import { IBroker, Position } from '../services/broker/interface';
import { updateMetrics, incrementRateLimited, setActiveRateLimiters } from '../services/metrics';
import {
  ipcEvents,
  sendConnectionIncrement,
  sendConnectionDecrement,
} from '../services/clusterIPC';

// ──────────────────── Types ─────────────────────────────────────────────────

export interface AuthenticatedClient {
  ws: WebSocket;
  userId: string;
  symbols: string[];
  positions: Map<string, Position>;
  /**
   * Set to `true` before calling `unsubscribe()` to guard stale tick
   * callbacks that were already enqueued in the event loop before
   * `clearInterval` took effect.  The tick callback checks this flag
   * alongside `ws.readyState` to avoid corrupting risk engine state
   * with stale PnL data during rapid subscribe/unsubscribe cycles.
   */
  closed: boolean;
  unsubscribe: () => void;
}

export interface RateLimitState {
  /** Timestamp when the current fixed window started (epoch ms) */
  windowStart: number;
  /** Message count in the current window */
  count: number;
}

/** Fixed window width in ms */
export const RATE_LIMIT_WINDOW_MS = 1_000;
/** Max messages per connection per window */
export const RATE_LIMIT_MAX_MESSAGES = 10;

/** Max concurrent WebSocket connections allowed per user before an alert fires */
export const MAX_CONNECTIONS_PER_USER = 5;

/** Set of userIds that have already triggered a connection-limit alert */
export const connectionAlertedUsers = new Set<string>();

// ──────────────────── Module-Level State ────────────────────────────────────

/** WebSocket → client metadata (used for sending ticks) */
export const clients = new Map<WebSocket, AuthenticatedClient>();

/**
 * userId → symbol → Position (cached, used for O(1) P&L recalculation).
 * Stored as a nested Map (symbol → Position) so the tick callback can
 * look up a held position by symbol in O(1) instead of scanning an
 * array with findIndex on every tick.
 */
export const userPositions = new Map<string, Map<string, Position>>();

/** userId → number of active WebSocket connections (reference count) */
export const userConnectionCount = new Map<string, number>();

/** Per-connection rate limit state (cleaned up on disconnect) */
export const rateLimitMap = new Map<WebSocket, RateLimitState>();

// ──────────────────── Auth Helpers ──────────────────────────────────────────

export function decodeToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as AuthPayload;
  } catch {
    return null;
  }
}

// ──────────────────── Position Helpers ──────────────────────────────────────

export async function loadUserPositions(userId: string, broker?: IBroker): Promise<Map<string, Position>> {
  try {
    if (!broker) broker = await getBroker();
    const positions = await broker.getPositions();
    const positionsMap = new Map(positions.map(p => [p.symbol, p]));
    userPositions.set(userId, positionsMap);
    return positionsMap;
  } catch {
    console.warn(`[WS] Could not load positions for user ${userId}`);
    return new Map();
  }
}

/**
 * Tracks the global connection count per userId (populated via IPC from primary).
 * This is a worker-local mirror of the primary's aggregated state.
 */
const globalConnectionCounts = new Map<string, number>();

/**
 * Listen for IPC connection_sync events to update the global count mirror.
 * This runs once when the module is first loaded in a worker.
 */
if (cluster.isWorker) {
  ipcEvents.on('connection_sync', (counts: Record<string, number>) => {
    globalConnectionCounts.clear();
    for (const [userId, count] of Object.entries(counts)) {
      globalConnectionCounts.set(userId, count);
    }
  });
}

/**
 * Increment the reference count for a userId.
 * Called when a new WebSocket connection authenticates.
 * Logs a warning if the user exceeds MAX_CONNECTIONS_PER_USER.
 * The alert fires only once per user (reset when count drops below
 * the threshold again via decrementConnectionCount).
 *
 * In cluster mode, sends an IPC message to the primary so the global
 * count is updated across all workers.
 */
export function incrementConnectionCount(userId: string): void {
  const localCount = (userConnectionCount.get(userId) ?? 0) + 1;
  userConnectionCount.set(userId, localCount);

  // Notify primary for global aggregation
  sendConnectionIncrement(userId);

  // Use the reported global count for threshold checks
  const globalCount = globalConnectionCounts.get(userId) ?? localCount;

  if (globalCount > MAX_CONNECTIONS_PER_USER && !connectionAlertedUsers.has(userId)) {
    connectionAlertedUsers.add(userId);
    console.warn(
      `[WS] ⚠ User ${userId} has ${globalCount} concurrent WebSocket connections across all workers ` +
      `(limit: ${MAX_CONNECTIONS_PER_USER}). This may indicate multiple tabs ` +
      `or a potential issue.`,
    );
  }

  updateMetrics(userConnectionCount, clients, connectionAlertedUsers);
}

/**
 * Remove the user from the connection alert set (called when count
 * drops below the threshold so re-alerting is possible if they exceed
 * it again).
 */
export function resetConnectionAlert(userId: string): void {
  connectionAlertedUsers.delete(userId);
}

/**
 * Decrement the reference count for a userId.
 * Only deletes the cached positions when the LAST connection closes,
 * preventing multi-tab position cache corruption.
 * Resets the connection alert when the count drops below the threshold.
 *
 * In cluster mode, sends an IPC message to the primary so the global
 * count is decremented across all workers.
 */
export function decrementConnectionCount(userId: string): void {
  const count = userConnectionCount.get(userId) ?? 1;
  if (count <= 1) {
    userConnectionCount.delete(userId);
    userPositions.delete(userId);
    connectionAlertedUsers.delete(userId);
  } else {
    const newCount = count - 1;
    userConnectionCount.set(userId, newCount);
    if (newCount <= MAX_CONNECTIONS_PER_USER) {
      connectionAlertedUsers.delete(userId);
    }
  }

  // Notify primary for global aggregation
  sendConnectionDecrement(userId);

  updateMetrics(userConnectionCount, clients, connectionAlertedUsers);
}

export function totalUnrealizedPnL(positions: Map<string, Position>): number {
  let sum = 0;
  for (const p of positions.values()) sum += p.pnl;
  return sum;
}

// ──────────────────── Rate Limiting ─────────────────────────────────────────

/**
 * Check if a message from this connection is within rate limits.
 * Uses a fixed-window counter that resets every `RATE_LIMIT_WINDOW_MS`.
 * Returns `true` if the message is allowed, `false` if throttled.
 */
export function checkRateLimit(ws: WebSocket): boolean {
  const now = Date.now();
  let state = rateLimitMap.get(ws);

  if (!state || now >= state.windowStart + RATE_LIMIT_WINDOW_MS) {
    // First message or window expired — start a fresh window
    rateLimitMap.set(ws, { windowStart: now, count: 1 });
    setActiveRateLimiters(rateLimitMap.size);
    return true;
  }

  state.count++;
  const allowed = state.count <= RATE_LIMIT_MAX_MESSAGES;

  if (!allowed) {
    incrementRateLimited();
  }

  return allowed;
}
