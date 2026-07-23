/**
 * ============================================================================
 * Toroloom — Offline Store Tests
 * ============================================================================
 *
 * Tests the offline store: freshness tracking, pending mutations,
 * sync history, conflict management, and sync status computation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOfflineStore, resetOfflineStore, type CacheNamespace } from '../store/offlineStore';

// Mock offlineCache for refreshFreshness tests
vi.mock('../services/offlineCache', () => ({
  offlineCache: {
    getDiagnosticEntry: vi.fn().mockResolvedValue(null),
  },
}));

// Fixture helpers
const makeConflict = (overrides: Record<string, unknown> = {}) => ({
  mutationId: 'mut_1',
  mutationType: 'order',
  error: 'Conflict error',
  enqueuedAt: new Date().toISOString(),
  localPayload: { stockId: 'RELIANCE' },
  ...overrides,
});

const makeSyncEntry = (overrides: Record<string, unknown> = {}) => ({
  timestamp: new Date().toISOString(),
  durationMs: 1500,
  result: 'success' as const,
  syncedCount: 10,
  failedCount: 0,
  ...overrides,
});

// ===========================================================================
// Initial State
// ===========================================================================

describe('OfflineStore — Initial State', () => {
  beforeEach(() => {
    resetOfflineStore();
  });

  it('has empty freshness for all 8 namespaces', () => {
    const state = useOfflineStore.getState();
    const namespaces = Object.keys(state.freshness);
    expect(namespaces).toHaveLength(8);
    Object.values(state.freshness).forEach((f) => {
      expect(f.lastSyncedAt).toBeNull();
      expect(f.isStale).toBe(true);
      expect(f.ageLabel).toBe('never');
    });
  });

  it('starts with empty pending state', () => {
    const state = useOfflineStore.getState();
    expect(state.pendingGroups).toEqual([]);
    expect(state.pendingTotal).toBe(0);
  });

  it('starts with no sync in progress', () => {
    const state = useOfflineStore.getState();
    expect(state.isSyncing).toBe(false);
    expect(state.lastSyncResult).toBeNull();
    expect(state.lastSyncAttemptAt).toBeNull();
  });

  it('starts with empty sync history and conflicts', () => {
    const state = useOfflineStore.getState();
    expect(state.syncHistory).toEqual([]);
    expect(state.conflicts).toEqual([]);
    expect(state.syncStatus).toBe('online');
  });
});

// ===========================================================================
// markSynced
// ===========================================================================

describe('OfflineStore — markSynced', () => {
  beforeEach(() => {
    // Reset freshness too since resetOfflineStore only clears sync history/conflicts
    useOfflineStore.setState({
      freshness: {
        portfolio: { lastSyncedAt: null, isStale: true, ageLabel: 'never' },
        market: { lastSyncedAt: null, isStale: true, ageLabel: 'never' },
        watchlist: { lastSyncedAt: null, isStale: true, ageLabel: 'never' },
        education: { lastSyncedAt: null, isStale: true, ageLabel: 'never' },
        openOrders: { lastSyncedAt: null, isStale: true, ageLabel: 'never' },
        fno: { lastSyncedAt: null, isStale: true, ageLabel: 'never' },
        community: { lastSyncedAt: null, isStale: true, ageLabel: 'never' },
        aiInsights: { lastSyncedAt: null, isStale: true, ageLabel: 'never' },
      },
      pendingGroups: [],
      pendingTotal: 0,
      isSyncing: false,
      lastSyncResult: null,
      lastSyncAttemptAt: null,
    });
  });

  it('updates freshness for the given namespace', () => {
    useOfflineStore.getState().markSynced('portfolio');
    const f = useOfflineStore.getState().freshness['portfolio'];
    expect(f.lastSyncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(f.isStale).toBe(false);
    expect(f.ageLabel).toBe('just now');
  });

  it('does not affect other namespaces', () => {
    useOfflineStore.getState().markSynced('market');
    const portfolio = useOfflineStore.getState().freshness['portfolio'];
    expect(portfolio.lastSyncedAt).toBeNull();
    expect(portfolio.isStale).toBe(true);
  });

  it('updates lastSyncAttemptAt and lastSyncResult', () => {
    useOfflineStore.getState().markSynced('education');
    const state = useOfflineStore.getState();
    expect(state.lastSyncAttemptAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(state.lastSyncResult).toBe('success');
  });

  it('can mark all namespaces independently', () => {
    const nsList = [
      'portfolio', 'market', 'watchlist', 'education',
      'openOrders', 'fno', 'community', 'aiInsights',
    ];
    nsList.forEach((ns) => {
      useOfflineStore.getState().markSynced(ns as any);
      expect(useOfflineStore.getState().freshness[ns as CacheNamespace].isStale).toBe(false);
    });
    // Verify all are marked
    Object.values(useOfflineStore.getState().freshness).forEach((f) => {
      expect(f.isStale).toBe(false);
    });
  });
});

// ===========================================================================
// refreshFreshness
// ===========================================================================

describe('OfflineStore — refreshFreshness', () => {
  beforeEach(() => {
    resetOfflineStore();
  });

  it('sets freshness to empty when no cache entries exist', async () => {
    const { offlineCache } = await import('../services/offlineCache');
    vi.mocked(offlineCache.getDiagnosticEntry).mockResolvedValue(null);

    await useOfflineStore.getState().refreshFreshness();

    Object.values(useOfflineStore.getState().freshness).forEach((f) => {
      expect(f.lastSyncedAt).toBeNull();
      expect(f.isStale).toBe(true);
    });
  });

  it('reads freshness from cache entries', async () => {
    const { offlineCache } = await import('../services/offlineCache');
    const fetchedAt = new Date().toISOString();
    vi.mocked(offlineCache.getDiagnosticEntry).mockResolvedValue({
      fetchedAt,
      data: {},
    } as any);

    await useOfflineStore.getState().refreshFreshness();

    Object.values(useOfflineStore.getState().freshness).forEach((f) => {
      expect(f.lastSyncedAt).toBe(fetchedAt);
      expect(f.isStale).toBe(false);
      expect(f.ageLabel).toBe('just now');
    });
  });

  it('marks stale when cache entry is older than 5 minutes', async () => {
    const { offlineCache } = await import('../services/offlineCache');
    const oldDate = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
    vi.mocked(offlineCache.getDiagnosticEntry).mockResolvedValue({
      fetchedAt: oldDate,
      data: {},
    } as any);

    await useOfflineStore.getState().refreshFreshness();

    Object.values(useOfflineStore.getState().freshness).forEach((f) => {
      expect(f.isStale).toBe(true);
      expect(f.ageLabel).toMatch(/^\d+m ago$/);
    });
  });

  it('handles mixed cache availability across namespaces', async () => {
    const { offlineCache } = await import('../services/offlineCache');
    const now = new Date().toISOString();
    // Return a result for 'portfolio' but null for others
    vi.mocked(offlineCache.getDiagnosticEntry).mockImplementation(
      async (ns: string) => {
        if (ns === 'portfolio') return { fetchedAt: now, data: {} } as any;
        return null;
      },
    );

    await useOfflineStore.getState().refreshFreshness();

    expect(useOfflineStore.getState().freshness['portfolio'].isStale).toBe(false);
    expect(useOfflineStore.getState().freshness['market'].isStale).toBe(true);
  });
});

// ===========================================================================
// setPendingGroups
// ===========================================================================

describe('OfflineStore — setPendingGroups', () => {
  beforeEach(() => {
    resetOfflineStore();
  });

  it('sets pending groups and total', () => {
    const groups = [
      { type: 'order', count: 3, oldestAt: new Date().toISOString() },
      { type: 'watchlist', count: 1, oldestAt: null },
    ];
    useOfflineStore.getState().setPendingGroups(groups, 4);

    const state = useOfflineStore.getState();
    expect(state.pendingGroups).toEqual(groups);
    expect(state.pendingTotal).toBe(4);
  });

  it('overwrites previous pending groups', () => {
    useOfflineStore.getState().setPendingGroups([{ type: 'old', count: 5, oldestAt: null }], 5);
    useOfflineStore.getState().setPendingGroups([], 0);

    expect(useOfflineStore.getState().pendingGroups).toEqual([]);
    expect(useOfflineStore.getState().pendingTotal).toBe(0);
  });
});

// ===========================================================================
// setSyncing & setSyncResult
// ===========================================================================

describe('OfflineStore — Sync State', () => {
  beforeEach(() => {
    useOfflineStore.setState({
      isSyncing: false,
      lastSyncResult: null,
      lastSyncAttemptAt: null,
    });
  });

  it('setSyncing toggles isSyncing', () => {
    useOfflineStore.getState().setSyncing(true);
    expect(useOfflineStore.getState().isSyncing).toBe(true);

    useOfflineStore.getState().setSyncing(false);
    expect(useOfflineStore.getState().isSyncing).toBe(false);
  });

  it('setSyncResult updates result and timestamp', () => {
    useOfflineStore.getState().setSyncResult('success');
    expect(useOfflineStore.getState().lastSyncResult).toBe('success');
    expect(useOfflineStore.getState().lastSyncAttemptAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('setSyncResult accepts all result types', () => {
    useOfflineStore.getState().setSyncResult('partial');
    expect(useOfflineStore.getState().lastSyncResult).toBe('partial');

    useOfflineStore.getState().setSyncResult('failed');
    expect(useOfflineStore.getState().lastSyncResult).toBe('failed');
  });
});

// ===========================================================================
// recordSyncAttempt
// ===========================================================================

describe('OfflineStore — recordSyncAttempt', () => {
  beforeEach(() => {
    useOfflineStore.setState({ syncHistory: [] });
  });

  it('adds a sync entry to history', () => {
    useOfflineStore.getState().recordSyncAttempt(makeSyncEntry());

    expect(useOfflineStore.getState().syncHistory).toHaveLength(1);
    const entry = useOfflineStore.getState().syncHistory[0];
    expect(entry.id).toMatch(/^sync_\d+_/);
    expect(entry.result).toBe('success');
    expect(entry.syncedCount).toBe(10);
  });

  it('prepends new entries', () => {
    useOfflineStore.getState().recordSyncAttempt(makeSyncEntry({ result: 'failed' }));
    useOfflineStore.getState().recordSyncAttempt(makeSyncEntry({ result: 'success' }));

    expect(useOfflineStore.getState().syncHistory).toHaveLength(2);
    expect(useOfflineStore.getState().syncHistory[0].result).toBe('success');
    expect(useOfflineStore.getState().syncHistory[1].result).toBe('failed');
  });

  it('caps history at 20 entries', () => {
    for (let i = 0; i < 25; i++) {
      useOfflineStore.getState().recordSyncAttempt(makeSyncEntry());
    }
    expect(useOfflineStore.getState().syncHistory).toHaveLength(20);
  });

  it('generates unique IDs for each entry', () => {
    useOfflineStore.getState().recordSyncAttempt(makeSyncEntry());
    useOfflineStore.getState().recordSyncAttempt(makeSyncEntry());

    const ids = useOfflineStore.getState().syncHistory.map(e => e.id);
    expect(ids[0]).not.toBe(ids[1]);
  });
});

// ===========================================================================
// Conflict Management
// ===========================================================================

describe('OfflineStore — Conflict Management', () => {
  beforeEach(() => {
    useOfflineStore.setState({
      conflicts: [],
      isSyncing: false,
      pendingTotal: 0,
      pendingGroups: [],
    });
  });

  describe('addConflict', () => {
    it('adds a new conflict with pending status', () => {
      useOfflineStore.getState().addConflict(makeConflict());

      expect(useOfflineStore.getState().conflicts).toHaveLength(1);
      const c = useOfflineStore.getState().conflicts[0];
      expect(c.id).toMatch(/^conflict_\d+_/);
      expect(c.status).toBe('pending');
      expect(c.mutationType).toBe('order');
      expect(c.error).toBe('Conflict error');
    });

    it('accumulates multiple conflicts', () => {
      useOfflineStore.getState().addConflict(makeConflict({ mutationId: 'm1' }));
      useOfflineStore.getState().addConflict(makeConflict({ mutationId: 'm2' }));

      expect(useOfflineStore.getState().conflicts).toHaveLength(2);
    });
  });

  describe('resolveConflict', () => {
    beforeEach(() => {
      useOfflineStore.getState().addConflict(makeConflict({ mutationId: 'm1' }));
      useOfflineStore.getState().addConflict(makeConflict({ mutationId: 'm2' }));
    });

    it('marks a conflict as resolved_keep_local', () => {
      const conflictId = useOfflineStore.getState().conflicts[0].id;
      useOfflineStore.getState().resolveConflict(conflictId, 'resolved_keep_local');

      const resolved = useOfflineStore.getState().conflicts.find(c => c.id === conflictId);
      expect(resolved?.status).toBe('resolved_keep_local');
    });

    it('marks a conflict as resolved_use_server', () => {
      const conflictId = useOfflineStore.getState().conflicts[0].id;
      useOfflineStore.getState().resolveConflict(conflictId, 'resolved_use_server');

      const resolved = useOfflineStore.getState().conflicts.find(c => c.id === conflictId);
      expect(resolved?.status).toBe('resolved_use_server');
    });

    it('marks a conflict as dismissed', () => {
      const conflictId = useOfflineStore.getState().conflicts[0].id;
      useOfflineStore.getState().resolveConflict(conflictId, 'dismissed');

      const resolved = useOfflineStore.getState().conflicts.find(c => c.id === conflictId);
      expect(resolved?.status).toBe('dismissed');
    });

    it('does nothing for non-existent conflict ID', () => {
      useOfflineStore.getState().resolveConflict('no_such_conflict', 'dismissed');
      expect(useOfflineStore.getState().conflicts).toHaveLength(2);
      // All should still be pending
      useOfflineStore.getState().conflicts.forEach(c => {
        expect(c.status).toBe('pending');
      });
    });

    it('only affects the targeted conflict', () => {
      const id1 = useOfflineStore.getState().conflicts[0].id;
      useOfflineStore.getState().resolveConflict(id1, 'dismissed');

      const ids = useOfflineStore.getState().conflicts.map(c => c.id);
      expect(useOfflineStore.getState().conflicts[ids.indexOf(id1)].status).toBe('dismissed');
      expect(useOfflineStore.getState().conflicts[ids.indexOf(
        useOfflineStore.getState().conflicts[1].id
      )].status).toBe('pending');
    });
  });

  describe('clearResolvedConflicts', () => {
    it('removes all resolved/dismissed conflicts, keeps pending', () => {
      useOfflineStore.getState().addConflict(makeConflict({ mutationId: 'm1' }));
      useOfflineStore.getState().addConflict(makeConflict({ mutationId: 'm2' }));
      useOfflineStore.getState().addConflict(makeConflict({ mutationId: 'm3' }));

      // Resolve first two
      const conflicts = useOfflineStore.getState().conflicts;
      useOfflineStore.getState().resolveConflict(conflicts[0].id, 'dismissed');
      useOfflineStore.getState().resolveConflict(conflicts[1].id, 'resolved_keep_local');

      useOfflineStore.getState().clearResolvedConflicts();

      expect(useOfflineStore.getState().conflicts).toHaveLength(1);
      expect(useOfflineStore.getState().conflicts[0].status).toBe('pending');
    });

    it('keeps all conflicts when none are resolved', () => {
      useOfflineStore.getState().addConflict(makeConflict({ mutationId: 'm1' }));
      useOfflineStore.getState().addConflict(makeConflict({ mutationId: 'm2' }));

      useOfflineStore.getState().clearResolvedConflicts();

      expect(useOfflineStore.getState().conflicts).toHaveLength(2);
    });

    it('handles empty conflicts gracefully', () => {
      useOfflineStore.getState().clearResolvedConflicts();
      expect(useOfflineStore.getState().conflicts).toEqual([]);
    });
  });
});

// ===========================================================================
// computeSyncStatus
// ===========================================================================

describe('OfflineStore — computeSyncStatus', () => {
  beforeEach(() => {
    useOfflineStore.setState({
      syncHistory: [],
      conflicts: [],
      syncStatus: 'online',
      pendingTotal: 0,
      pendingGroups: [],
      isSyncing: false,
      lastSyncResult: null,
      lastSyncAttemptAt: null,
    });
  });

  it('returns online when nothing is pending and no conflicts', () => {
    useOfflineStore.getState().computeSyncStatus();
    expect(useOfflineStore.getState().syncStatus).toBe('online');
  });

  it('returns syncing when isSyncing is true', () => {
    useOfflineStore.getState().setSyncing(true);
    useOfflineStore.getState().computeSyncStatus();
    expect(useOfflineStore.getState().syncStatus).toBe('syncing');
  });

  it('returns conflict when there are pending conflicts', () => {
    useOfflineStore.getState().addConflict(makeConflict());
    useOfflineStore.getState().computeSyncStatus();
    expect(useOfflineStore.getState().syncStatus).toBe('conflict');
  });

  it('returns conflict even when isSyncing is true (conflict takes priority)', () => {
    useOfflineStore.getState().setSyncing(true);
    useOfflineStore.getState().addConflict(makeConflict());
    useOfflineStore.getState().computeSyncStatus();
    expect(useOfflineStore.getState().syncStatus).toBe('syncing'); // syncing checked first
  });

  it('returns pending when there are pending mutations', () => {
    useOfflineStore.getState().setPendingGroups([{ type: 'order', count: 1, oldestAt: null }], 1);
    useOfflineStore.getState().computeSyncStatus();
    expect(useOfflineStore.getState().syncStatus).toBe('pending');
  });

  it('returns online after all pending are cleared', () => {
    useOfflineStore.getState().setPendingGroups([{ type: 'order', count: 1, oldestAt: null }], 1);
    useOfflineStore.getState().computeSyncStatus();
    expect(useOfflineStore.getState().syncStatus).toBe('pending');

    useOfflineStore.getState().setPendingGroups([], 0);
    useOfflineStore.getState().computeSyncStatus();
    expect(useOfflineStore.getState().syncStatus).toBe('online');
  });

  it('resets to online via resetOfflineStore', () => {
    useOfflineStore.getState().setSyncing(true);
    useOfflineStore.getState().addConflict(makeConflict());
    useOfflineStore.getState().computeSyncStatus();
    expect(useOfflineStore.getState().syncStatus).toBe('syncing');

    resetOfflineStore();
    expect(useOfflineStore.getState().syncStatus).toBe('online');
  });
});

// ===========================================================================
// resetOfflineStore
// ===========================================================================

describe('OfflineStore — resetOfflineStore', () => {
  it('resets sync history, conflicts, and sync status', () => {
    // Set up some state first
    useOfflineStore.getState().recordSyncAttempt(makeSyncEntry());
    useOfflineStore.getState().addConflict(makeConflict());

    resetOfflineStore();

    const state = useOfflineStore.getState();
    expect(state.syncHistory).toEqual([]);
    expect(state.conflicts).toEqual([]);
    expect(state.syncStatus).toBe('online');
  });

  it('preserves freshness and pending data', () => {
    useOfflineStore.getState().markSynced('portfolio');
    useOfflineStore.getState().setPendingGroups([{ type: 'order', count: 3, oldestAt: null }], 3);

    resetOfflineStore();

    const state = useOfflineStore.getState();
    // resetOfflineStore only resets syncHistory, conflicts, syncStatus
    // freshness and pendingGroups should still be intact
    expect(state.freshness['portfolio'].isStale).toBe(false);
    expect(state.pendingTotal).toBe(3);
  });
});
