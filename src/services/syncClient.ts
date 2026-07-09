/**
 * ============================================================================
 * Toroloom — Sync Client
 * ============================================================================
 *
 * Frontend client for the backend sync API (POST /api/sync).
 * Handles delta-based mutation batching, conflict detection,
 * and local state reconciliation.
 *
 * Usage:
 *   import { syncClient } from '../services/syncClient';
 *   const result = await syncClient.syncMutations(mutations);
 *
 * Delta sync:
 *   The client tracks `lastSyncTimestamp` (persisted to AsyncStorage)
 *   and sends it with each sync request. The server returns only
 *   entities changed since that timestamp.
 *
 * Conflict resolution:
 *   When a conflict is detected (server version > client version),
 *   the client applies the server state locally and reports the
 *   conflict to the offlineStore for user resolution.
 *
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api/client';
import { log } from '../utils/logger';
import { useOfflineStore } from '../store/offlineStore';

// ──── Constants ────────────────────────────────────────────────────────────

const SYNC_TIMESTAMP_KEY = 'toroloom_last_sync_timestamp';
const MAX_MUTATIONS_PER_BATCH = 50;

// ──── Types ────────────────────────────────────────────────────────────────

export interface SyncMutation {
  mutationId: string;
  type: string;
  entityType: string;
  entityId: string | null;
  payload: Record<string, unknown>;
  clientVersion: number | null;
  enqueuedAt: string;
}

export interface SyncResult {
  applied: { mutationId: string; entityId: string; newVersion: number }[];
  conflicts: {
    mutationId: string;
    entityType: string;
    entityId: string | null;
    clientVersion: number | null;
    serverVersion: number;
    serverState: Record<string, unknown> | null;
    error: string;
  }[];
  failed: { mutationId: string; error: string }[];
  delta: { entityType: string; entityId: string; data: Record<string, unknown> }[];
  newSyncTimestamp: string;
}

// ──── Entity Type Mapping ──────────────────────────────────────────────────

/**
 * Maps mutation types to their entity types for conflict tracking.
 */
export function getEntityType(mutationType: string): string {
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

// ──── Sync Client ──────────────────────────────────────────────────────────

export const syncClient = {
  /**
   * Get the last successful sync timestamp from AsyncStorage.
   */
  async getLastSyncTimestamp(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(SYNC_TIMESTAMP_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Save the last successful sync timestamp.
   */
  async saveSyncTimestamp(timestamp: string): Promise<void> {
    try {
      await AsyncStorage.setItem(SYNC_TIMESTAMP_KEY, timestamp);
    } catch {
      // Best-effort
    }
  },

  /**
   * Clear the sync timestamp (e.g., on logout).
   */
  async clearSyncTimestamp(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SYNC_TIMESTAMP_KEY);
    } catch {
      // Best-effort
    }
  },

  /**
   * Sync a batch of mutations to the backend.
   *
   * Sends mutations in batches of MAX_MUTATIONS_PER_BATCH to avoid
   * oversized payloads. Each batch includes the last sync timestamp
   * for delta computation.
   *
   * Returns the aggregated result across all batches.
   */
  async syncMutations(
    mutations: SyncMutation[],
  ): Promise<SyncResult> {
    const lastSyncTimestamp = await this.getLastSyncTimestamp();
    const aggregated: SyncResult = {
      applied: [],
      conflicts: [],
      failed: [],
      delta: [],
      newSyncTimestamp: new Date().toISOString(),
    };

    // Process in batches
    for (let i = 0; i < mutations.length; i += MAX_MUTATIONS_PER_BATCH) {
      const batch = mutations.slice(i, i + MAX_MUTATIONS_PER_BATCH);

      try {
        const result = await api.post<SyncResult>('/sync', {
          lastSyncTimestamp,
          mutations: batch,
        });

        // Merge results
        aggregated.applied.push(...result.applied);
        aggregated.conflicts.push(...result.conflicts);
        aggregated.failed.push(...result.failed);
        aggregated.delta.push(...result.delta);
        aggregated.newSyncTimestamp = result.newSyncTimestamp;
      } catch (err: any) {
        // Network error — mark all mutations as failed
        for (const m of batch) {
          aggregated.failed.push({
            mutationId: m.mutationId,
            error: err?.message || 'Network error during sync',
          });
        }

        // Stop processing further batches on network error
        log.warn('[SyncClient] Network error during sync batch:', err?.message);
        break;
      }
    }

    // Save new sync timestamp if any mutations were applied
    if (aggregated.applied.length > 0 || aggregated.delta.length > 0) {
      await this.saveSyncTimestamp(aggregated.newSyncTimestamp);
    }

    // Report conflicts to the offline store for user resolution
    if (aggregated.conflicts.length > 0) {
      this._reportConflicts(aggregated.conflicts);
    }

    return aggregated;
  },

  /**
   * Check sync status from the server.
   * Returns the server's latest entity version timestamp.
   */
  async getSyncStatus(): Promise<{
    totalEntities: number;
    latestUpdatedAt: string;
    serverTime: string;
  } | null> {
    try {
      return await api.get('/sync/status');
    } catch {
      return null;
    }
  },

  /**
   * Report conflicts to the offline store for user resolution.
   * Each conflict is added as a SyncConflict entry.
   */
  _reportConflicts(
    conflicts: SyncResult['conflicts'],
  ): void {
    const store = useOfflineStore.getState();

    for (const conflict of conflicts) {
      store.addConflict({
        mutationId: conflict.mutationId,
        mutationType: conflict.entityType,
        error: conflict.error,
        enqueuedAt: new Date().toISOString(),
        localPayload: conflict.serverState as Record<string, unknown> | undefined,
      });
    }

    store.computeSyncStatus();
    log.info(`[SyncClient] Reported ${conflicts.length} conflict(s) for user resolution`);
  },
};
