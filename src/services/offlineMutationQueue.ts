/**
 * ============================================================================
 * Toroloom — Offline Mutation Queue
 * ============================================================================
 *
 * AsyncStorage-backed FIFO queue for mutations performed while the app is
 * offline. When connectivity is restored, the queue replays mutations in
 * order so the backend gets synced.
 *
 * Syncing strategies:
 *   1. processAll() — Individual API calls per mutation (legacy, backward compat)
 *   2. processViaSyncApi() — Batched via POST /api/sync (delta sync + conflict detection)
 *
 * Usage:
 *   import { offlineMutationQueue } from '../services/offlineMutationQueue';
 *   await offlineMutationQueue.enqueue({ type: 'BUY_STOCK', payload: { ... } });
 *   const results = await offlineMutationQueue.processViaSyncApi();
 *
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api/client';
import { syncClient, type SyncMutation } from './syncClient';
import { log } from '../utils/logger';

// ──── Types ────────────────────────────────────────────────────────────────

export type MutationType =
  | 'BUY_STOCK'
  | 'SELL_STOCK'
  | 'ADD_TO_WATCHLIST'
  | 'REMOVE_FROM_WATCHLIST'
  | 'CREATE_WATCHLIST'
  | 'DELETE_WATCHLIST'
  | 'MODIFY_ORDER'
  | 'CANCEL_ORDER';

export interface QueuedMutation {
  /** UUID — generated at enqueue time for dedup */
  id: string;
  type: MutationType;
  payload: Record<string, unknown>;
  /** When the mutation was originally attempted */
  enqueuedAt: string;
  /** Number of retry attempts so far */
  retryCount: number;
  /** Last error message (if any) */
  lastError?: string;
  /** Client-side version stamp for conflict detection (null if new) */
  clientVersion?: number | null;
  /** Entity type for conflict detection */
  entityType?: string;
}

export interface SyncResult {
  success: boolean;
  mutationId: string;
  type: MutationType;
  error?: string;
}

// ──── Constants ────────────────────────────────────────────────────────────

const QUEUE_KEY = 'toroloom_mutation_queue';
const MAX_RETRIES = 5;

// ──── UUID generator (lightweight, no deps) ────────────────────────────────

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ──── Entity Type Mapping ──────────────────────────────────────────────────

function getEntityType(mutationType: string): string {
  switch (mutationType) {
    case 'BUY_STOCK':
    case 'SELL_STOCK':
      return 'position';
    case 'ADD_TO_WATCHLIST':
    case 'REMOVE_FROM_WATCHLIST':
      return 'watchlist_stock';
    case 'CREATE_WATCHLIST':
    case 'DELETE_WATCHLIST':
      return 'watchlist';
    case 'MODIFY_ORDER':
    case 'CANCEL_ORDER':
      return 'order';
    default:
      return 'unknown';
  }
}

function getEntityId(mutation: QueuedMutation): string | null {
  const payload = mutation.payload;
  if (payload.orderId) return payload.orderId as string;
  if (payload.watchlistId && mutation.type === 'DELETE_WATCHLIST') return payload.watchlistId as string;
  if (payload.watchlistId && mutation.type === 'ADD_TO_WATCHLIST') return `${payload.watchlistId}:${payload.symbol}`;
  if (payload.watchlistId && mutation.type === 'REMOVE_FROM_WATCHLIST') return `${payload.watchlistId}:${payload.symbol}`;
  return null;
}

// ──── Queue Operations ─────────────────────────────────────────────────────

async function readQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedMutation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    log.warn('[MutationQueue] Failed to persist queue');
  }
}

// ──── Replay handlers (maps mutation type → API call) ─────────────────────

async function replayMutation(mutation: QueuedMutation): Promise<boolean> {
  try {
    switch (mutation.type) {
      case 'BUY_STOCK': {
        const { symbol, quantity, price, productType } = mutation.payload as { symbol: string; quantity: number; price: number; productType?: string };
        await api.post('/orders/execute', {
          actionType: 'BUY',
          symbol,
          exchange: 'NSE',
          quantity,
          price,
          productType: productType || 'CNC',
          orderType: 'MARKET',
        });
        return true;
      }

      case 'SELL_STOCK': {
        const { symbol, quantity, price, avgBuyPrice, productType } = mutation.payload as { symbol: string; quantity: number; price: number; avgBuyPrice?: number; productType?: string };
        await api.post('/orders/execute', {
          actionType: 'SELL',
          symbol,
          exchange: 'NSE',
          quantity,
          price,
          productType: productType || 'CNC',
          orderType: 'MARKET',
          currentPosition: { quantity, avgPrice: avgBuyPrice },
        });
        return true;
      }

      case 'ADD_TO_WATCHLIST': {
        const { watchlistId, symbol } = mutation.payload as { watchlistId: string; symbol: string };
        await api.post(`/watchlist/${watchlistId}/stocks`, { symbol });
        return true;
      }

      case 'REMOVE_FROM_WATCHLIST': {
        const { watchlistId, symbol } = mutation.payload as { watchlistId: string; symbol: string };
        await api.delete(`/watchlist/${watchlistId}/stocks/${symbol}`);
        return true;
      }

      case 'CREATE_WATCHLIST': {
        const { name } = mutation.payload as { name: string };
        await api.post('/watchlist', { name });
        return true;
      }

      case 'DELETE_WATCHLIST': {
        const { watchlistId } = mutation.payload as { watchlistId: string };
        await api.delete(`/watchlist/${watchlistId}`);
        return true;
      }

      case 'MODIFY_ORDER': {
        const { orderId, ...updates } = mutation.payload as { orderId: string; [key: string]: unknown };
        await api.post('/orders/modify', { orderId, ...updates });
        return true;
      }

      case 'CANCEL_ORDER': {
        const { orderId } = mutation.payload as { orderId: string };
        await api.post('/orders/cancel', { orderId });
        return true;
      }

      default:
        return false;
    }
  } catch (err: any) {
    // Network errors → retry later
    if (api.isNetworkError(err)) throw err;
    // Server errors that are NOT transient (4xx) → skip, don't retry
    if (err?.status && err.status >= 400 && err.status < 500) {
      return false; // Skip permanently
    }
    // 5xx errors → retry
    throw err;
  }
}

// ──── Public API ──────────────────────────────────────────────────────────

export const offlineMutationQueue = {
  /**
   * Enqueue a mutation to be replayed when connectivity is restored.
   * Returns the generated mutation ID.
   */
  async enqueue(type: MutationType, payload: Record<string, unknown>): Promise<string> {
    const queue = await readQueue();
    const mutation: QueuedMutation = {
      id: generateId(),
      type,
      payload,
      enqueuedAt: new Date().toISOString(),
      retryCount: 0,
      entityType: getEntityType(type),
    };
    queue.push(mutation);
    await writeQueue(queue);
    return mutation.id;
  },

  /**
   * Get the number of pending mutations in the queue.
   */
  async getCount(): Promise<number> {
    const queue = await readQueue();
    return queue.length;
  },

  /**
   * Get all pending mutations.
   */
  async getAll(): Promise<QueuedMutation[]> {
    return readQueue();
  },

  /**
   * Process all pending mutations via the sync API (POST /api/sync).
   *
   * Uses the delta sync client which batches mutations, detects conflicts
   * server-side, and returns delta changes. This is the preferred sync
   * method as it supports conflict detection and minimal data transfer.
   *
   * Falls back to individual API calls (processAll) if the sync API is
   * unreachable (network error) to maintain backward compatibility.
   *
   * Returns an array of SyncResult (success/failure per mutation).
   */
  async processViaSyncApi(): Promise<SyncResult[]> {
    const queue = await readQueue();
    if (queue.length === 0) return [];

    // 1. Convert to SyncMutation format for the sync client
    const syncMutations: SyncMutation[] = queue.map((m) => ({
      mutationId: m.id,
      type: m.type,
      entityType: m.entityType || getEntityType(m.type),
      entityId: getEntityId(m),
      payload: m.payload,
      clientVersion: m.clientVersion ?? null,
      enqueuedAt: m.enqueuedAt,
    }));

    // 2. Send via sync API
    let result;
    try {
      result = await syncClient.syncMutations(syncMutations);
    } catch (_err: any) {
      // Sync API unreachable — fall back to individual API calls
      log.info('[MutationQueue] Sync API unreachable, falling back to processAll');
      return this.processAll();
    }

    // 3. Process results
    const results: SyncResult[] = [];
    const remaining: QueuedMutation[] = [];

    for (const mutation of queue) {
      const applied = result.applied.find((a) => a.mutationId === mutation.id);
      const conflict = result.conflicts.find((c) => c.mutationId === mutation.id);
      const failed = result.failed.find((f) => f.mutationId === mutation.id);

      if (applied) {
        // Success — remove from queue
        results.push({ success: true, mutationId: mutation.id, type: mutation.type });
      } else if (conflict) {
        // Conflict — keep for retry up to MAX_RETRIES
        mutation.retryCount += 1;
        mutation.lastError = conflict.error;

        if (mutation.retryCount >= MAX_RETRIES) {
          results.push({
            success: false,
            mutationId: mutation.id,
            type: mutation.type,
            error: `Max retries (${MAX_RETRIES}) exceeded for conflict: ${conflict.error}`,
          });
        } else {
          remaining.push(mutation);
          results.push({
            success: false,
            mutationId: mutation.id,
            type: mutation.type,
            error: conflict.error,
          });
        }
      } else if (failed) {
        // Failed — retry or skip based on retry count
        mutation.retryCount += 1;
        mutation.lastError = failed.error;

        if (mutation.retryCount >= MAX_RETRIES) {
          results.push({
            success: false,
            mutationId: mutation.id,
            type: mutation.type,
            error: `Max retries (${MAX_RETRIES}) exceeded: ${failed.error}`,
          });
        } else {
          remaining.push(mutation);
          results.push({
            success: false,
            mutationId: mutation.id,
            type: mutation.type,
            error: failed.error,
          });
        }
      } else {
        // Unknown — keep for retry
        remaining.push(mutation);
        results.push({
          success: false,
          mutationId: mutation.id,
          type: mutation.type,
          error: 'Unknown sync result',
        });
      }
    }

    await writeQueue(remaining);
    this._notifyListeners(results);
    return results;
  },

  /**
   * Process all pending mutations in FIFO order via individual API calls.
   * Original method kept for backward compatibility.
   *
   * Returns an array of results (success/failure per mutation).
   *
   * - Successful mutations are removed from the queue.
   * - Failed mutations (network error) stay in the queue for retry.
   * - Permanently failed mutations (4xx) are removed with an error status.
   */
  async processAll(): Promise<SyncResult[]> {
    const queue = await readQueue();
    if (queue.length === 0) return [];

    const results: SyncResult[] = [];
    const remaining: QueuedMutation[] = [];

    for (const mutation of queue) {
      try {
        const success = await replayMutation(mutation);
        if (success) {
          results.push({ success: true, mutationId: mutation.id, type: mutation.type });
        } else {
          // Permanent failure (4xx) — remove but report error
          results.push({
            success: false,
            mutationId: mutation.id,
            type: mutation.type,
            error: mutation.lastError || 'Request rejected by server',
          });
        }
      } catch (err: any) {
        // Transient failure — retry later
        mutation.retryCount += 1;
        mutation.lastError = err?.message || 'Network error';

        if (mutation.retryCount >= MAX_RETRIES) {
          // Max retries exceeded — skip permanently
          results.push({
            success: false,
            mutationId: mutation.id,
            type: mutation.type,
            error: `Max retries (${MAX_RETRIES}) exceeded: ${mutation.lastError}`,
          });
        } else {
          remaining.push(mutation);
          results.push({
            success: false,
            mutationId: mutation.id,
            type: mutation.type,
            error: mutation.lastError,
          });
        }
      }
    }

    await writeQueue(remaining);
    this._notifyListeners(results);
    return results;
  },

  /**
   * Remove a specific mutation from the queue by ID.
   */
  async remove(mutationId: string): Promise<void> {
    const queue = await readQueue();
    const filtered = queue.filter(m => m.id !== mutationId);
    await writeQueue(filtered);
  },

  /**
   * Clear all pending mutations (e.g., on logout).
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(QUEUE_KEY);
    } catch {
      // Best-effort
    }
  },

  /**
   * Subscribe to sync events. The callback is called after processAll()
   * completes with the results.
   */
  _listeners: new Set<(results: SyncResult[]) => void>(),
  subscribe(cb: (results: SyncResult[]) => void): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  },
  _notifyListeners(results: SyncResult[]): void {
    this._listeners.forEach(cb => {
      try { cb(results); } catch { /* ignore */ }
    });
  },
};
