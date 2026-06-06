/**
 * ============================================================================
 * Toroloom — Cluster IPC Bridge (Dual-Mode: Redis + IPC Fallback)
 * ============================================================================
 *
 * Provides cross-worker state synchronization using one of two transports:
 *
 *   1. Redis Pub/Sub (production) — when REDIS_URL is configured
 *      Worker ──publish──→ Redis ──deliver──→ Primary (aggregator)
 *      Primary ──publish──→ Redis ──deliver──→ All Workers
 *
 *   2. Node.js Cluster IPC (fallback) — when REDIS_URL is not set
 *      Worker ──send()──→ Primary ──send()──→ All Workers
 *
 * Protocol (worker → aggregator messages):
 *   { type: 'ws:conn_inc',  userId: string }
 *   { type: 'ws:conn_dec',  userId: string }
 *   { type: 'ws:broadcast', payload: any }
 *
 * Protocol (aggregator → worker messages):
 *   { type: 'ws:connection_sync', counts: Record<string, number> }
 *   { type: 'ws:broadcast',       payload: any }
 *
 * Behaviour is transparent to callers — they use the same API regardless
 * of the transport (sendConnectionIncrement, sendConnectionDecrement, etc.).
 *
 * IMPORTANT:
 * - This module is a no-op when CLUSTER_MODE is disabled (single-process).
 * - Redis connections are only established when REDIS_URL is provided.
 * - Without REDIS_URL, the existing Node.js cluster IPC mechanism is used.
 * ============================================================================
 */

import cluster from 'cluster';
import { EventEmitter } from 'events';
import { env } from '../config/env';
import { redisPubSub } from './redisPubSub';

// ──────────────────── Types ─────────────────────────────────────────────────

export interface IPCConnectionState {
  userId: string;
  /** Total connections for this user across ALL workers */
  globalCount: number;
}

/**
 * Events emitted locally (within the same worker) when sync updates arrive.
 * Handlers are registered by state.ts to update local maps.
 */
export const ipcEvents = new EventEmitter();
ipcEvents.setMaxListeners(50);

/** Global connection count aggregated by the primary / Redis subscriber */
const globalConnectionCounts = new Map<string, number>();

// ──── Redis channel names ────────────────────────────────────────────────────
const CHANNEL_CONN       = 'ws:conn';
const CHANNEL_CONN_SYNC  = 'ws:conn_sync';
const CHANNEL_BROADCAST  = 'ws:broadcast';

// ──── Transport detection ───────────────────────────────────────────────────
function hasRedis(): boolean {
  return !!env.redisUrl;
}

// ──────────────────── Primary Process / Aggregator ──────────────────────────

/**
 * Called once in the primary process to start aggregating connection counts.
 *
 * With Redis:   subscribes to `ws:conn`, aggregates, publishes to `ws:conn_sync`
 * Without Redis: listens for IPC messages from workers (existing behaviour)
 */
export async function startPrimaryIPC(): Promise<void> {
  if (!cluster.isPrimary) return;

  if (hasRedis()) {
    // ── Redis mode ─────────────────────────────────────────────
    try {
      await redisPubSub.connect(env.redisUrl);
      console.log('   [IPC] Redis pub/sub bridge started (primary aggregator)');

      // Subscribe to worker connection events
      await redisPubSub.subscribe(CHANNEL_CONN, (_channel: string, raw: string) => {
        try {
          const msg = JSON.parse(raw);
          if (msg.type === 'inc') {
            const current = globalConnectionCounts.get(msg.userId) ?? 0;
            globalConnectionCounts.set(msg.userId, current + 1);
          } else if (msg.type === 'dec') {
            const current = globalConnectionCounts.get(msg.userId) ?? 1;
            if (current <= 1) {
              globalConnectionCounts.delete(msg.userId);
            } else {
              globalConnectionCounts.set(msg.userId, current - 1);
            }
          } else {
            return; // Unknown event — don't broadcast
          }

          // Publish updated counts to all workers
          redisPubSub.publish(
            CHANNEL_CONN_SYNC,
            JSON.stringify({ counts: Object.fromEntries(globalConnectionCounts) }),
          ).catch(() => {});
        } catch {
          // Malformed JSON — ignore
        }
      });

      // Relay broadcast messages from workers to all workers
      await redisPubSub.subscribe(CHANNEL_BROADCAST, (_channel: string, raw: string) => {
        try {
          const msg = JSON.parse(raw);
          if (msg._relayed) return;
          redisPubSub.publish(
            CHANNEL_BROADCAST,
            JSON.stringify({ ...msg, _relayed: true }),
          ).catch(() => {});
        } catch { /* ignore */ }
      });

      // Redis mode successful — don't fall through to IPC
      return;
    } catch (err) {
      console.warn('   [IPC] Redis unavailable, falling back to cluster IPC:', (err as Error).message);
    }
  }

  // ── IPC mode (fallback, or no-Redis path) ──────────────────
  console.log('   [IPC] Cluster IPC bridge started (primary mode)');

  cluster.on('message', (worker, message: any) => {
    if (!message || typeof message.type !== 'string') return;
    if (!message.type.startsWith('ws:')) return;

    switch (message.type) {
      case 'ws:conn_inc': {
        const userId = message.userId as string;
        const current = globalConnectionCounts.get(userId) ?? 0;
        globalConnectionCounts.set(userId, current + 1);
        broadcastToWorkers({
          type: 'ws:connection_sync',
          counts: Object.fromEntries(globalConnectionCounts),
        });
        break;
      }
      case 'ws:conn_dec': {
        const userId = message.userId as string;
        const current = globalConnectionCounts.get(userId) ?? 1;
        if (current <= 1) {
          globalConnectionCounts.delete(userId);
        } else {
          globalConnectionCounts.set(userId, current - 1);
        }
        broadcastToWorkers({
          type: 'ws:connection_sync',
          counts: Object.fromEntries(globalConnectionCounts),
        });
        break;
      }
      case 'ws:broadcast': {
        broadcastToWorkers({
          type: 'ws:broadcast',
          payload: message.payload,
        });
        break;
      }
    }
  });
}

/**
 * Broadcast a message to every worker process via IPC.
 * Only used in fallback mode (no Redis).
 */
function broadcastToWorkers(message: any): void {
  const workers = cluster.workers;
  if (!workers) return;
  for (const id of Object.keys(workers)) {
    const w = workers[id];
    if (w && w.isConnected()) {
      try {
        w.send(message);
      } catch {
        // Worker may have disconnected during shutdown
      }
    }
  }
}

// ──────────────────── Worker Process ────────────────────────────────────────

/**
 * Called once in each worker process to start listening for sync messages
 * from the aggregator (primary process).
 */
export async function startWorkerIPC(): Promise<void> {
  if (cluster.isPrimary) return;

  if (hasRedis()) {
    // ── Redis mode ─────────────────────────────────────────────
    try {
      await redisPubSub.connect(env.redisUrl);
      console.log('   [IPC] Redis pub/sub bridge started (worker)');

      // Subscribe to connection count sync from primary
      await redisPubSub.subscribe(CHANNEL_CONN_SYNC, (_channel: string, raw: string) => {
        try {
          const msg = JSON.parse(raw);
          if (msg.counts) {
            ipcEvents.emit('connection_sync', msg.counts as Record<string, number>);
          }
        } catch { /* ignore */ }
      });

      // Subscribe to broadcast messages
      await redisPubSub.subscribe(CHANNEL_BROADCAST, (_channel: string, raw: string) => {
        try {
          const msg = JSON.parse(raw);
          if (msg.payload) {
            ipcEvents.emit('broadcast', msg.payload);
          }
        } catch { /* ignore */ }
      });

      // Redis mode successful — don't fall through to IPC
      return;
    } catch (err) {
      console.warn('   [IPC] Redis unavailable, falling back to cluster IPC:', (err as Error).message);
    }
  }

  // ── IPC mode (fallback, or no-Redis path) ──────────────────
  process.on('message', (message: any) => {
    if (!message || typeof message.type !== 'string') return;
    if (!message.type.startsWith('ws:')) return;

    switch (message.type) {
      case 'ws:connection_sync': {
        ipcEvents.emit('connection_sync', message.counts as Record<string, number>);
        break;
      }
      case 'ws:broadcast': {
        ipcEvents.emit('broadcast', message.payload);
        break;
      }
    }
  });
}

// ──────────────────── Worker Senders ────────────────────────────────────────

/**
 * Send a connection increment notification to the aggregator.
 */
export function sendConnectionIncrement(userId: string): void {
  if (!cluster.isWorker) return;

  if (redisPubSub.connected) {
    // Redis mode — publish to ws:conn channel
    redisPubSub.publish(CHANNEL_CONN, JSON.stringify({ type: 'inc', userId }))
      .catch(() => {});
  } else {
    // IPC mode — send to primary
    try {
      process.send!({ type: 'ws:conn_inc', userId });
    } catch { /* IPC channel closed */ }
  }
}

/**
 * Send a connection decrement notification to the aggregator.
 */
export function sendConnectionDecrement(userId: string): void {
  if (!cluster.isWorker) return;

  if (redisPubSub.connected) {
    // Redis mode — publish to ws:conn channel
    redisPubSub.publish(CHANNEL_CONN, JSON.stringify({ type: 'dec', userId }))
      .catch(() => {});
  } else {
    // IPC mode — send to primary
    try {
      process.send!({ type: 'ws:conn_dec', userId });
    } catch { /* IPC channel closed */ }
  }
}

/**
 * Request the aggregator to broadcast a message to all workers.
 * In single-process mode, emits locally only.
 */
export function requestBroadcast(payload: any): void {
  if (!cluster.isWorker) {
    // Single-process mode — emit locally only
    ipcEvents.emit('broadcast', payload);
    return;
  }

  if (redisPubSub.connected) {
    // Redis mode — publish to ws:broadcast channel
    // The primary will relay it to ensure all workers receive it
    redisPubSub.publish(CHANNEL_BROADCAST, JSON.stringify({ payload }))
      .catch(() => {});
  } else {
    // IPC mode — send to primary for relaying
    try {
      process.send!({ type: 'ws:broadcast', payload });
    } catch { /* IPC channel closed */ }
  }
}

// ──────────────────── Cleanup ───────────────────────────────────────────────

/**
 * Disconnect Redis (if used) during graceful shutdown.
 * Safe to call even when Redis was never connected.
 */
export async function disconnectIPC(): Promise<void> {
  if (hasRedis()) {
    await redisPubSub.disconnect();
  }
}

// ──────────────────── Utility ───────────────────────────────────────────────

/**
 * Returns the current global connection counts map (worker-local mirror).
 * Updated via `connection_sync` events from the aggregator.
 */
export function getGlobalConnectionCounts(): Map<string, number> {
  return globalConnectionCounts;
}
