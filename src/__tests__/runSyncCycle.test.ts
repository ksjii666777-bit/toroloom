/**
 * ============================================================================
 * Toroloom — runSyncCycle Unit Tests
 * ============================================================================
 *
 * Tests the runSyncCycle function from useBackgroundSync.ts which orchestrates
 * the full sync cycle: processing pending mutations via the sync API,
 * categorizing results, updating the offline store's pending groups,
 * recording sync history, and logging analytics.
 *
 * The function is tested purely through its Zustand API (not via React hook)
 * so these tests validate the sync state machine without needing a renderer.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/runSyncCycle.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { runSyncCycle } from '../hooks/useBackgroundSync';
import { useOfflineStore, resetOfflineStore } from '../store/offlineStore';
import type { SyncResult } from '../services/offlineMutationQueue';

// ──── Mocks (vi.hoisted to make variables available inside vi.mock factories) ──

const { mockProcessViaSyncApi, mockGetAll, mockAnalyticsLogEvent } = vi.hoisted(() => ({
  mockProcessViaSyncApi: vi.fn(),
  mockGetAll: vi.fn(),
  // Must return a promise so analytics.logEvent(...).catch(() => {}) works
  mockAnalyticsLogEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/offlineMutationQueue', () => ({
  offlineMutationQueue: {
    processViaSyncApi: mockProcessViaSyncApi,
    getAll: mockGetAll,
  },
}));

vi.mock('../services/analytics', () => ({
  analytics: {
    logEvent: mockAnalyticsLogEvent,
  },
}));

vi.mock('../utils/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ──── Helpers ──────────────────────────────────────────────────────────────

function resetStore() {
  resetOfflineStore();
  useOfflineStore.setState({
    isSyncing: false,
    pendingGroups: [],
    pendingTotal: 0,
    lastSyncResult: null,
    lastSyncAttemptAt: null,
    syncHistory: [],
    conflicts: [],
    syncStatus: 'online',
  });
}

/** Build a successful SyncResult */
function mkOk(mutationId: string, type = 'BUY_STOCK'): SyncResult {
  return { success: true, mutationId, type: type as any };
}

/** Build a failed SyncResult */
function mkFail(mutationId: string, type = 'BUY_STOCK', error?: string): SyncResult {
  return { success: false, mutationId, type: type as any, error: error || 'Server error' };
}

/** Build a queued mutation shape for getAll() */
function mkQueued(
  id: string,
  type = 'BUY_STOCK',
  payload: Record<string, unknown> = {},
) {
  return {
    id,
    type,
    payload,
    enqueuedAt: new Date(Date.now() - 60000).toISOString(),
    retryCount: 0,
    entityType: 'position',
  };
}

// ──── Tests ────────────────────────────────────────────────────────────────

describe('runSyncCycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  // ── Empty Queue ──────────────────────────────────────────────────────────
  //
  // When the queue is empty, the source code always:
  //   - calls recordSyncAttempt with resultType='failed' (ternary falls to else)
  //   - calls analytics.logEvent unconditionally
  //   - sets lastSyncResult via setSyncResult (which also uses the resultType)

  describe('empty queue', () => {
    it('returns all-zero results when no pending mutations', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([]);
      mockGetAll.mockResolvedValueOnce([]);

      const result = await runSyncCycle('manual');

      expect(result).toEqual({ syncedCount: 0, failedCount: 0, conflictCount: 0 });
    });

    it('logs analytics event even when queue is empty (unconditional)', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      // analytics.logEvent is called unconditionally with mutationsSynced: 0
      expect(mockAnalyticsLogEvent).toHaveBeenCalledWith(
        'connectivity_restored',
        expect.objectContaining({ mutationsSynced: 0 }),
      );
    });

    it('sets lastSyncResult to failed when nothing to sync (resultType falls to else)', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      const store = useOfflineStore.getState();
      // resultType ternary: synced.length(0) > 0 → false → falls to 'failed'
      expect(store.lastSyncResult).toBe('failed');
    });

    it('records sync history even when queue is empty', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      // recordSyncAttempt is called unconditionally
      const history = useOfflineStore.getState().syncHistory;
      expect(history).toHaveLength(1);
      expect(history[0].syncedCount).toBe(0);
      expect(history[0].failedCount).toBe(0);
      expect(history[0].result).toBe('failed');
    });
  });

  // ── All Success ──────────────────────────────────────────────────────────

  describe('all mutations succeed', () => {
    it('returns correct counts', async () => {
      const results = [mkOk('m1'), mkOk('m2'), mkOk('m3')];
      mockProcessViaSyncApi.mockResolvedValueOnce(results);
      mockGetAll.mockResolvedValueOnce(results.map(r => mkQueued(r.mutationId)));

      const result = await runSyncCycle('auto_reconnect');

      expect(result.syncedCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.conflictCount).toBe(0);
    });

    it('sets lastSyncResult to success', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([mkOk('m1')]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('app_foreground');

      expect(useOfflineStore.getState().lastSyncResult).toBe('success');
    });

    it('records sync history with result=success', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([mkOk('m1')]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('auto_reconnect');

      const history = useOfflineStore.getState().syncHistory;
      expect(history).toHaveLength(1);
      expect(history[0].result).toBe('success');
      expect(history[0].syncedCount).toBe(1);
      expect(history[0].failedCount).toBe(0);
    });

    it('sets pending groups to empty after full success', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([mkOk('m1')]);
      // getAll returns empty (all cleared) → pending groups = []
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      const store = useOfflineStore.getState();
      expect(store.pendingGroups).toEqual([]);
      expect(store.pendingTotal).toBe(0);
    });
  });

  // ── All Failed ───────────────────────────────────────────────────────────

  describe('all mutations fail', () => {
    it('returns correct counts', async () => {
      const results = [mkFail('m1', 'BUY_STOCK', 'Network timeout'), mkFail('m2', 'SELL_STOCK', 'Server error')];
      mockProcessViaSyncApi.mockResolvedValueOnce(results);
      mockGetAll.mockResolvedValueOnce(results.map(r => mkQueued(r.mutationId)));

      const result = await runSyncCycle('manual');

      expect(result.syncedCount).toBe(0);
      expect(result.failedCount).toBe(2);
    });

    it('sets lastSyncResult to failed', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([mkFail('m1')]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      expect(useOfflineStore.getState().lastSyncResult).toBe('failed');
    });

    it('records sync history with result=failed and error string', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([mkFail('m1', 'BUY_STOCK', 'Server error')]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      const history = useOfflineStore.getState().syncHistory;
      expect(history).toHaveLength(1);
      expect(history[0].result).toBe('failed');
      expect(history[0].syncedCount).toBe(0);
      expect(history[0].failedCount).toBe(1);
      expect(history[0].error).toContain('Server error');
    });

    it('clears syncing flag even when all fail', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([mkFail('m1')]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      expect(useOfflineStore.getState().isSyncing).toBe(false);
    });
  });

  // ── Mixed Results ────────────────────────────────────────────────────────

  describe('mixed success/failure', () => {
    it('returns partial counts', async () => {
      const results = [mkOk('m1'), mkFail('m2', 'BUY_STOCK', 'Conflict')];
      mockProcessViaSyncApi.mockResolvedValueOnce(results);
      mockGetAll.mockResolvedValueOnce(results.map(r => mkQueued(r.mutationId)));

      const result = await runSyncCycle('manual');

      expect(result.syncedCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });

    it('sets lastSyncResult to partial', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([mkOk('m1'), mkFail('m2')]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      expect(useOfflineStore.getState().lastSyncResult).toBe('partial');
    });

    it('records sync history with result=partial', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([mkOk('m1'), mkFail('m2')]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      const history = useOfflineStore.getState().syncHistory;
      expect(history).toHaveLength(1);
      expect(history[0].result).toBe('partial');
      expect(history[0].syncedCount).toBe(1);
      expect(history[0].failedCount).toBe(1);
    });
  });

  // ── Syncing State Lifecycle ──────────────────────────────────────────────

  describe('syncing state lifecycle', () => {
    it('sets syncing=true at start and false at end', async () => {
      // Capture the syncing state during execution by wrapping processViaSyncApi
      let syncingDuringExecution = false;
      mockProcessViaSyncApi.mockImplementationOnce(async () => {
        syncingDuringExecution = useOfflineStore.getState().isSyncing;
        return [];
      });
      mockGetAll.mockResolvedValueOnce([]);

      expect(useOfflineStore.getState().isSyncing).toBe(false);
      await runSyncCycle('manual');
      expect(useOfflineStore.getState().isSyncing).toBe(false);
      expect(syncingDuringExecution).toBe(true);
    });

    it('computes sync status at start and end', async () => {
      // computeSyncStatus updates syncStatus based on isSyncing + pendingGroups + conflicts
      // We can verify it was called by checking syncStatus was recalculated
      mockProcessViaSyncApi.mockResolvedValueOnce([]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      // After a successful empty sync, status should be 'online'
      expect(useOfflineStore.getState().syncStatus).toBe('online');
    });
  });

  // ── Pending Groups ───────────────────────────────────────────────────────

  describe('pending group computation', () => {
    it('groups remaining mutations by type with count and oldest timestamp', async () => {
      const remaining = [
        mkQueued('m1', 'BUY_STOCK', { symbol: 'RELIANCE' }),
        mkQueued('m2', 'BUY_STOCK', { symbol: 'TCS' }),
        mkQueued('m3', 'SELL_STOCK', { symbol: 'INFY' }),
      ];
      // Make m3 oldest
      remaining[2] = {
        ...remaining[2],
        enqueuedAt: new Date(Date.now() - 120000).toISOString(),
      };

      mockProcessViaSyncApi.mockResolvedValueOnce([mkFail('m1'), mkFail('m2'), mkFail('m3')]);
      mockGetAll.mockResolvedValueOnce(remaining);

      await runSyncCycle('manual');

      const store = useOfflineStore.getState();
      expect(store.pendingTotal).toBe(3);

      // Should have 2 groups: BUY_STOCK (2), SELL_STOCK (1)
      const buyGroup = store.pendingGroups.find(g => g.type === 'BUY_STOCK');
      const sellGroup = store.pendingGroups.find(g => g.type === 'SELL_STOCK');
      expect(buyGroup).toBeDefined();
      expect(buyGroup!.count).toBe(2);
      expect(sellGroup).toBeDefined();
      expect(sellGroup!.count).toBe(1);
    });

    it('sets empty groups when no mutations remain', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([mkOk('m1')]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      const store = useOfflineStore.getState();
      expect(store.pendingGroups).toEqual([]);
      expect(store.pendingTotal).toBe(0);
    });
  });

  // ── Sync History ─────────────────────────────────────────────────────────

  describe('sync history recording', () => {
    it('records timestamp and duration in sync history', async () => {
      mockProcessViaSyncApi.mockImplementationOnce(async () => {
        // Simulate some delay
        await new Promise(r => setTimeout(r, 5));
        return [mkOk('m1')];
      });
      mockGetAll.mockResolvedValueOnce([]);

      const before = Date.now();
      await runSyncCycle('manual');
      const after = Date.now();

      const history = useOfflineStore.getState().syncHistory;
      expect(history).toHaveLength(1);
      expect(history[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(new Date(history[0].timestamp).getTime()).toBeGreaterThanOrEqual(before);
      expect(new Date(history[0].timestamp).getTime()).toBeLessThanOrEqual(after);
    });

    it('records history even when queue is empty (unconditional)', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      // recordSyncAttempt is called unconditionally
      expect(useOfflineStore.getState().syncHistory).toHaveLength(1);
    });

    it('accumulates multiple history entries', async () => {
      mockProcessViaSyncApi.mockResolvedValue([mkOk('m1')]);
      mockGetAll.mockResolvedValue([]);

      await runSyncCycle('manual');
      await runSyncCycle('app_foreground');
      await runSyncCycle('manual');

      const history = useOfflineStore.getState().syncHistory;
      expect(history).toHaveLength(3);
      // Most recent first
      expect(history[0].result).toBe('success');
      expect(history[1].result).toBe('success');
      expect(history[2].result).toBe('success');
    });
  });

  // ── Analytics ────────────────────────────────────────────────────────────

  describe('analytics logging', () => {
    it('logs connectivity_restored event when mutations are synced', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([mkOk('m1'), mkOk('m2')]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('auto_reconnect');

      expect(mockAnalyticsLogEvent).toHaveBeenCalledWith(
        'connectivity_restored',
        expect.objectContaining({
          mutationsSynced: 2,
          storesRefreshed: true,
        }),
      );
    });

    it('logs analytics event with correct shape', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([mkOk('m1')]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('auto_reconnect');

      expect(mockAnalyticsLogEvent).toHaveBeenCalledWith(
        'connectivity_restored',
        expect.objectContaining({
          reconnectedAt: expect.any(String),
          offlineDurationMs: expect.any(Number),
          mutationsSynced: 1,
          storesRefreshed: true,
        }),
      );
    });

    it('logs analytics even when no mutations (unconditional)', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      // analytics.logEvent is called unconditionally
      expect(mockAnalyticsLogEvent).toHaveBeenCalledWith(
        'connectivity_restored',
        expect.objectContaining({ mutationsSynced: 0 }),
      );
    });
  });

  // ── syncStatus Computation ──────────────────────────────────────────────

  describe('syncStatus computation', () => {
    it('sets syncStatus to pending when mutations remain', async () => {
      const remaining = [mkQueued('m1', 'BUY_STOCK')];
      mockProcessViaSyncApi.mockResolvedValueOnce([mkFail('m1', 'BUY_STOCK', 'Conflict')]);
      mockGetAll.mockResolvedValueOnce(remaining);

      await runSyncCycle('manual');

      const store = useOfflineStore.getState();
      // After cycle: isSyncing=false, pendingTotal=1, no conflicts → pending
      expect(store.isSyncing).toBe(false);
      expect(store.pendingTotal).toBe(1);
      expect(store.syncStatus).toBe('pending');
    });

    it('sets syncStatus to online when nothing is pending', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([mkOk('m1')]);
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      expect(useOfflineStore.getState().syncStatus).toBe('online');
    });

    it('sets syncStatus to syncing during the cycle', async () => {
      mockProcessViaSyncApi.mockImplementationOnce(async () => {
        // During execution, computeSyncStatus should set status to 'syncing'
        expect(useOfflineStore.getState().syncStatus).toBe('syncing');
        return [mkOk('m1')];
      });
      mockGetAll.mockResolvedValueOnce([]);

      await runSyncCycle('manual');

      expect(useOfflineStore.getState().syncStatus).toBe('online');
    });
  });

  // ── Return Value ─────────────────────────────────────────────────────────

  describe('return value', () => {
    it('always returns an object with syncedCount, failedCount, conflictCount', async () => {
      const scenarios = [
        { results: [], remaining: [], expected: { syncedCount: 0, failedCount: 0 } },
        { results: [mkOk('m1')], remaining: [], expected: { syncedCount: 1, failedCount: 0 } },
        { results: [mkFail('m1')], remaining: [], expected: { syncedCount: 0, failedCount: 1 } },
      ];

      for (const s of scenarios) {
        vi.clearAllMocks();
        resetStore();
        mockProcessViaSyncApi.mockResolvedValueOnce(s.results);
        mockGetAll.mockResolvedValueOnce(s.remaining);

        const result = await runSyncCycle('manual');
        expect(result.syncedCount).toBe(s.expected.syncedCount);
        expect(result.failedCount).toBe(s.expected.failedCount);
        expect(typeof result.conflictCount).toBe('number');
      }
    });

    it('conflictCount is always 0 (not tracked separately at this level)', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([mkFail('m1'), mkFail('m2')]);
      mockGetAll.mockResolvedValueOnce([]);

      const result = await runSyncCycle('manual');

      expect(result.conflictCount).toBe(0);
    });
  });

  // ── Source Parameter ─────────────────────────────────────────────────────

  describe('source parameter', () => {
    it('accepts manual source', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([]);
      mockGetAll.mockResolvedValueOnce([]);

      const result = await runSyncCycle('manual');
      expect(result).toBeDefined();
    });

    it('accepts auto_reconnect source', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([]);
      mockGetAll.mockResolvedValueOnce([]);

      const result = await runSyncCycle('auto_reconnect');
      expect(result).toBeDefined();
    });

    it('accepts app_foreground source', async () => {
      mockProcessViaSyncApi.mockResolvedValueOnce([]);
      mockGetAll.mockResolvedValueOnce([]);

      const result = await runSyncCycle('app_foreground');
      expect(result).toBeDefined();
    });
  });
});
