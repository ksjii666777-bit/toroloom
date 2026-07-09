/**
 * ============================================================================
 * Toroloom — Offline Store
 * ============================================================================
 *
 * Tracks cache freshness for offline data so users can see when each data type
 * (portfolio, market, watchlist, education) was last synced, and manages
 * pending mutation metadata.
 *
 * Usage:
 *   import { useOfflineStore } from '../store/offlineStore';
 *   const freshness = useOfflineStore(s => s.freshness);
 *   const { markSynced, getStaleCount } = useOfflineStore();
 *
 * ============================================================================
 */

import { create } from 'zustand';
import { offlineCache } from '../services/offlineCache';

// ──── Types ────────────────────────────────────────────────────────────────

export type CacheNamespace =
  | 'portfolio'
  | 'market'
  | 'watchlist'
  | 'education'
  | 'openOrders'
  | 'fno'
  | 'community'
  | 'aiInsights';

export interface FreshnessInfo {
  /** ISO timestamp of last successful cache write */
  lastSyncedAt: string | null;
  /** Whether the cached data is stale (> 5 min since last sync) */
  isStale: boolean;
  /** Relative age string for display (e.g. '2m ago', '1h ago') */
  ageLabel: string;
}

export interface PendingMutationGroup {
  type: string;
  count: number;
  oldestAt: string | null;
}

/** A single sync attempt record */
export interface SyncHistoryEntry {
  id: string;
  timestamp: string;
  durationMs: number;
  result: 'success' | 'partial' | 'failed';
  syncedCount: number;
  failedCount: number;
  error?: string;
}

/** A conflict that the user needs to resolve */
export interface SyncConflict {
  id: string;
  mutationId: string;
  mutationType: string;
  error: string;
  enqueuedAt: string;
  /** Conflict resolution status */
  status: 'pending' | 'resolved_keep_local' | 'resolved_use_server' | 'dismissed';
  /** The local payload that failed to sync */
  localPayload?: Record<string, unknown>;
}

interface OfflineState {
  /** Freshness info per cache namespace */
  freshness: Record<CacheNamespace, FreshnessInfo>;

  /** Pending mutation counts grouped by type */
  pendingGroups: PendingMutationGroup[];

  /** Total pending mutation count */
  pendingTotal: number;

  /** Whether a sync is currently in progress */
  isSyncing: boolean;

  /** Last sync attempt result */
  lastSyncResult: 'success' | 'partial' | 'failed' | null;

  /** Timestamp of last sync attempt */
  lastSyncAttemptAt: string | null;

  /** Sync history (last 20 entries) */
  syncHistory: SyncHistoryEntry[];

  /** Pending conflicts that need user resolution */
  conflicts: SyncConflict[];

  /** Overall sync status for the persistent indicator */
  syncStatus: 'online' | 'offline' | 'pending' | 'syncing' | 'conflict';

  // ── Actions ──

  /** Update freshness for a specific namespace */
  markSynced: (namespace: CacheNamespace) => void;

  /** Refresh freshness info from AsyncStorage cache entries */
  refreshFreshness: () => Promise<void>;

  /** Update pending mutation info */
  setPendingGroups: (groups: PendingMutationGroup[], total: number) => void;

  /** Set syncing state */
  setSyncing: (syncing: boolean) => void;

  /** Set last sync result */
  setSyncResult: (result: OfflineState['lastSyncResult']) => void;

  /** Record a sync attempt in history */
  recordSyncAttempt: (entry: Omit<SyncHistoryEntry, 'id'>) => void;

  /** Add a conflict entry */
  addConflict: (conflict: Omit<SyncConflict, 'id' | 'status'>) => void;

  /** Mark a conflict as resolved */
  resolveConflict: (conflictId: string, resolution: SyncConflict['status']) => void;

  /** Clear all resolved conflicts */
  clearResolvedConflicts: () => void;

  /** Update overall sync status from current state */
  computeSyncStatus: () => void;
}

// ──── Constants ────────────────────────────────────────────────────────────

const FRESH_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ──── Helpers ──────────────────────────────────────────────────────────────

function formatAge(timestamp: string | null): string {
  if (!timestamp) return 'never';
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

function isStale(timestamp: string | null): boolean {
  if (!timestamp) return true;
  return Date.now() - new Date(timestamp).getTime() > FRESH_TTL_MS;
}

const EMPTY_FRESHNESS: FreshnessInfo = {
  lastSyncedAt: null,
  isStale: true,
  ageLabel: 'never',
};

// ──── Store ────────────────────────────────────────────────────────────────

export const useOfflineStore = create<OfflineState>((set, get) => ({
  freshness: {
    portfolio: { ...EMPTY_FRESHNESS },
    market: { ...EMPTY_FRESHNESS },
    watchlist: { ...EMPTY_FRESHNESS },
    education: { ...EMPTY_FRESHNESS },
    openOrders: { ...EMPTY_FRESHNESS },
    fno: { ...EMPTY_FRESHNESS },
    community: { ...EMPTY_FRESHNESS },
    aiInsights: { ...EMPTY_FRESHNESS },
  },
  pendingGroups: [],
  pendingTotal: 0,
  isSyncing: false,
  lastSyncResult: null,
  lastSyncAttemptAt: null,
  syncHistory: [],
  conflicts: [],
  syncStatus: 'online',

  markSynced: (namespace) => {
    const now = new Date().toISOString();
    set((state) => ({
      lastSyncAttemptAt: now,
      lastSyncResult: 'success',
      freshness: {
        ...state.freshness,
        [namespace]: {
          lastSyncedAt: now,
          isStale: false,
          ageLabel: 'just now',
        },
      },
    }));
  },

  refreshFreshness: async () => {
    const namespaces: CacheNamespace[] = [
      'portfolio', 'market', 'watchlist', 'education', 'openOrders',
      'fno', 'community', 'aiInsights',
    ];

    const freshEntries: Record<string, FreshnessInfo> = {};

    for (const ns of namespaces) {
      const entry = await offlineCache.getDiagnosticEntry(ns);
      if (entry) {
        freshEntries[ns] = {
          lastSyncedAt: entry.fetchedAt,
          isStale: isStale(entry.fetchedAt),
          ageLabel: formatAge(entry.fetchedAt),
        };
      } else {
        freshEntries[ns] = { ...EMPTY_FRESHNESS };
      }
    }

    set((state) => ({
      freshness: {
        ...state.freshness,
        ...freshEntries,
      },
    }));
  },

  setPendingGroups: (groups, total) => {
    set({ pendingGroups: groups, pendingTotal: total });
  },

  setSyncing: (syncing) => {
    set({ isSyncing: syncing });
  },

  setSyncResult: (result) => {
    set({
      lastSyncResult: result,
      lastSyncAttemptAt: new Date().toISOString(),
    });
  },

  recordSyncAttempt: (entry) => {
    const newEntry: SyncHistoryEntry = {
      ...entry,
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    set((state) => ({
      syncHistory: [newEntry, ...state.syncHistory].slice(0, 20),
    }));
  },

  addConflict: (conflict) => {
    const newConflict: SyncConflict = {
      ...conflict,
      id: `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      status: 'pending',
    };
    set((state) => ({
      conflicts: [...state.conflicts, newConflict],
    }));
  },

  resolveConflict: (conflictId, resolution) => {
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === conflictId ? { ...c, status: resolution } : c,
      ),
    }));
  },

  clearResolvedConflicts: () => {
    set((state) => ({
      conflicts: state.conflicts.filter((c) => c.status === 'pending'),
    }));
  },

  computeSyncStatus: () => {
    const state = get();
    const hasPending = state.pendingTotal > 0;
    const syncing = state.isSyncing;
    const hasConflicts = state.conflicts.some((c) => c.status === 'pending');

    let syncStatus: OfflineState['syncStatus'] = 'online';
    if (syncing) syncStatus = 'syncing';
    else if (hasConflicts) syncStatus = 'conflict';
    else if (hasPending) syncStatus = 'pending';

    set({ syncStatus });
  },
}));

// Add initial state for new fields
export function resetOfflineStore() {
  useOfflineStore.setState({
    syncHistory: [],
    conflicts: [],
    syncStatus: 'online',
  });
}
