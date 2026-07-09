/**
 * ============================================================================
 * Toroloom — Sync Invalidation Bridge
 * ============================================================================
 *
 * Bridges the sync service with the WebSocket server so that when mutations
 * are applied via POST /api/sync, the server broadcasts a `cache_invalidate`
 * message to all authenticated WebSocket connections of the affected user.
 *
 * This enables push-based cache invalidation — the client knows immediately
 * when data changes on the server, without polling or waiting for the next
 * sync cycle.
 *
 * Wire-up (in server.ts):
 *   import { setWSS } from './services/syncInvalidationBridge';
 *   setWSS(wss);
 *
 * Usage (in syncService route handler):
 *   import { broadcastMutationsInvalidation } from '../services/syncInvalidationBridge';
 *   const result = await processSyncRequest(parsed.data, userId);
 *   res.json(result);
 *   broadcastMutationsInvalidation(userId, parsed.data.mutations, result.applied);
 *
 * Message format (server -> client):
 *   {
 *     type: "cache_invalidate",
 *     data: {
 *       entities: [
 *         { entityType: "position", entityId: "pos_abc" }
 *       ],
 *       namespaces: ["portfolio", "watchlist"],
 *       timestamp: "2026-07-05T14:00:00.000Z"
 *     }
 *   }
 *
 * Entity-to-namespace mapping: SEE backend/src/constants/cacheNamespaces.ts
 *   (single source of truth — shared with frontend via useCacheInvalidation.ts)
 *
 * ============================================================================
 */

import { WebSocketServer, WebSocket } from 'ws';
import { clients } from '../websocket/state';
import { getCacheNamespace } from '../constants/cacheNamespaces';
import {
  incrementSyncBridgeSendFailure,
  incrementSyncBridgeCircuitBreakerTrip,
} from './metrics';

// ──── Circuit Breaker ───────────────────────────────────────────────────────
//
// Tracks consecutive ws.send() failures across invalidation calls.  When the
// threshold is reached, the bridge stops trying to send and logs a stronger
// warning instead of flooding the logs with per-client failure messages.
// A single successful send resets the counter (circuit closes).
//
// The state is stored in an exported object (rather than a bare `let` variable)
// to ensure consistent reference semantics across vitest's import/mock system.

export const SEND_FAILURE_THRESHOLD = 10;

/**
 * Circuit-breaker state — exported as an object so tests can inspect and
 * reset it reliably across vitest's mock system.
 */
export const circuitBreakerState = {
  consecutiveFailures: 0,
};

/**
 * Reset the circuit-breaker failure counter (exposed for testing).
 */
export function resetFailureCounter(): void {
  circuitBreakerState.consecutiveFailures = 0;
}

/**
 * Get the current failure counter value (exposed for testing).
 */
export function getFailureCount(): number {
  return circuitBreakerState.consecutiveFailures;
}

// ──── WebSocket Server Reference ───────────────────────────────────────────

let _wss: WebSocketServer | null = null;

/**
 * Set the WebSocketServer reference. Called once during server startup
 * after the WSS is created (see server.ts).
 */
export function setWSS(wss: WebSocketServer): void {
  _wss = wss;
}

/**
 * Get the current WebSocketServer reference (for testing).
 */
export function getWSS(): WebSocketServer | null {
  return _wss;
}

// ──── Broadcast ────────────────────────────────────────────────────────────

/**
 * Broadcast `cache_invalidate` to all WebSocket connections for a user
 * whose data was just modified by a sync operation.
 *
 * @param userId    The user whose data changed
 * @param mutations Original SyncMutation objects (with entityType/entityId)
 * @param applied   Result entries for successfully applied mutations
 */
export function broadcastMutationsInvalidation(
  userId: string,
  mutations: { entityType: string; entityId: string | null; mutationId: string }[],
  applied: { mutationId: string }[],
): void {
  if (!_wss) return; // Bridge not wired yet — skip gracefully

  // Build a set of applied mutation IDs for fast lookup
  const appliedIds = new Set(applied.map((a) => a.mutationId));

  // Match each applied mutation back to its original entity info using the
  // shared entity-to-namespace mapping (backend/src/constants/cacheNamespaces.ts)
  const entities: { entityType: string; entityId: string }[] = [];
  const affectedNamespaces = new Set<string>();

  for (const mutation of mutations) {
    if (!appliedIds.has(mutation.mutationId)) continue;
    if (!mutation.entityId) continue; // Anonymous creates — nothing to invalidate

    const ns = getCacheNamespace(mutation.entityType);
    affectedNamespaces.add(ns);
    entities.push({
      entityType: mutation.entityType,
      entityId: mutation.entityId,
    });
  }

  if (entities.length === 0) return;

  const payload = JSON.stringify({
    type: 'cache_invalidate',
    data: {
      entities,
      namespaces: Array.from(affectedNamespaces),
      timestamp: new Date().toISOString(),
    },
  });

  // ── Circuit-breaker check (before iterating clients) ──────
  // When the circuit is open, skip ALL sends with a single warning
  // instead of logging duplicate warnings per client.
  if (circuitBreakerState.consecutiveFailures >= SEND_FAILURE_THRESHOLD) {
    incrementSyncBridgeCircuitBreakerTrip();
    console.warn(
      `[SyncBridge] Circuit breaker open — ${circuitBreakerState.consecutiveFailures} consecutive send failures. Skipping broadcast for user ${userId}.`,
    );
    return;
  }

  // Send only to connections belonging to this user
  let sentCount = 0;
  _wss.clients.forEach((ws: WebSocket) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    const client = clients.get(ws);
    if (!client || client.userId !== userId) return;

    try {
      ws.send(payload);
      sentCount++;
      circuitBreakerState.consecutiveFailures = 0; // Success resets the counter
    } catch (err) {
      circuitBreakerState.consecutiveFailures++;
      incrementSyncBridgeSendFailure();
      console.warn(
        `[SyncBridge] Failed to send invalidation to client: ${(err as Error).message}` +
        ` (${circuitBreakerState.consecutiveFailures}/${SEND_FAILURE_THRESHOLD} consecutive failures)`,
      );
    }
  });

  if (sentCount > 0) {
    console.log(
      `[SyncBridge] Invalidated ${entities.length} entities across ${affectedNamespaces.size} namespace(s) ` +
      `for user ${userId} → ${sentCount} client(s) notified`,
    );
  }
}
