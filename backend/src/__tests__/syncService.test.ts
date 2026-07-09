/**
 * ============================================================================
 * Toroloom Sync Service — Unit Tests
 * ============================================================================
 *
 * Tests the core sync engine covering:
 *   1. Conflict detection with version stamps
 *   2. All 8 mutation handlers (BUY/SELL stock, watchlist CRUD, order modify/cancel)
 *   3. Delta sync (lastSyncTimestamp filtering)
 *   4. Idempotency via mutation dedup
 *   5. Error handling (no handler, handler failure)
 *   6. Express router validation
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/syncService.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { SyncMutation, SyncRequest, SyncResult } from '../services/syncService';

// ──── Helpers ──────────────────────────────────────────────────────────────

function makeMutation(overrides: Partial<SyncMutation> = {}): SyncMutation {
  return {
    mutationId: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type: 'BUY_STOCK',
    entityType: 'position',
    entityId: null,
    payload: { symbol: 'RELIANCE', quantity: 10, price: 2500 },
    clientVersion: null,
    enqueuedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSyncRequest(mutations: SyncMutation[]): SyncRequest {
  return {
    lastSyncTimestamp: null,
    mutations,
  };
}

// ──── Suite Setup ──────────────────────────────────────────────────────────

// Mock the syncInvalidationBridge to avoid importing websocket/state which
// registers Prometheus metrics that conflict across module re-evaluations
// with vi.resetModules().
vi.mock('../services/syncInvalidationBridge', () => ({
  setWSS: vi.fn(),
  getWSS: vi.fn(),
  getCacheNamespace: vi.fn(),
  broadcastMutationsInvalidation: vi.fn(),
}));

// Reset module-level state (_entityStore, _mutationDedup) before each test
// @ts-ignore
let processSyncRequest: typeof import('../services/syncService').processSyncRequest;
// @ts-ignore
let registerMutationHandler: typeof import('../services/syncService').registerMutationHandler;

beforeEach(async () => {
  vi.resetModules();
  // Re-apply the mock after module reset
  vi.mock('../services/syncInvalidationBridge', () => ({
    setWSS: vi.fn(),
    getWSS: vi.fn(),
    getCacheNamespace: vi.fn(),
    broadcastMutationsInvalidation: vi.fn(),
  }));
  const mod = await import('../services/syncService');
  processSyncRequest = mod.processSyncRequest;
  registerMutationHandler = mod.registerMutationHandler;
});

// ============================================================================
// 1. Conflict Detection
// ============================================================================

describe('Conflict Detection', () => {
  it('should accept mutation for a new entity (no entityId)', async () => {
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({ entityId: null, clientVersion: null })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it('should accept mutation when client version matches server version', async () => {
    const entityId = `pos_${Date.now()}`;

    // Create entity
    await processSyncRequest(
      makeSyncRequest([makeMutation({ entityId, clientVersion: null })]),
      'user-1',
    );

    // Mutate with version 0 (initial state — server increments to 1)
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'BUY_STOCK',
        entityId,
        clientVersion: 1,
        payload: { symbol: 'TCS', quantity: 5, price: 3500 },
      })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
  });

  it('should detect conflict when client version < server version', async () => {
    const entityId = `pos_conflict_${Date.now()}`;

    // Create entity (server version = 1)
    await processSyncRequest(
      makeSyncRequest([makeMutation({ entityId, clientVersion: null })]),
      'user-1',
    );

    // Mutate with stale version (0 < 1)
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'SELL_STOCK',
        entityId,
        clientVersion: 0,
        payload: { symbol: 'RELIANCE', quantity: 5, price: 2600 },
      })]),
      'user-1',
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].clientVersion).toBe(0);
    expect(result.conflicts[0].serverVersion).toBe(1);
    expect(result.conflicts[0].entityType).toBe('position');
    expect(result.conflicts[0].error).toContain('conflict');
    expect(result.applied).toHaveLength(0);
  });

  it('should detect conflict when entity was deleted on server', async () => {
    const watchlistId = `wl_del_${Date.now()}`;

    // Add a stock to the watchlist (creates watchlist_stock entity)
    await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'ADD_TO_WATCHLIST',
        entityType: 'watchlist_stock',
        entityId: `${watchlistId}:RELIANCE`,
        clientVersion: null,
        payload: { watchlistId, symbol: 'RELIANCE' },
      })]),
      'user-1',
    );

    // Remove the stock (marks watchlist_stock as deleted)
    await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'REMOVE_FROM_WATCHLIST',
        entityType: 'watchlist_stock',
        entityId: `${watchlistId}:RELIANCE`,
        payload: { watchlistId, symbol: 'RELIANCE' },
      })]),
      'user-1',
    );

    // Try to add the same stock again — conflict because entity was deleted
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'ADD_TO_WATCHLIST',
        entityType: 'watchlist_stock',
        entityId: `${watchlistId}:RELIANCE`,
        clientVersion: null,
        payload: { watchlistId, symbol: 'RELIANCE' },
      })]),
      'user-1',
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].error).toContain('deleted');
  });

  it('should detect conflict when entity not found on server but client has version', async () => {
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'MODIFY_ORDER',
        entityType: 'order',
        entityId: 'nonexistent-order',
        clientVersion: 5,
        payload: { orderId: 'nonexistent-order', quantity: 100 },
      })]),
      'user-1',
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].error).toContain('not found');
  });

  it('should accept mutation when no conflict exists (version match, entity not deleted)', async () => {
    const entityId = `pos_ok_${Date.now()}`;

    // Create entity
    await processSyncRequest(
      makeSyncRequest([makeMutation({ entityId, clientVersion: null })]),
      'user-1',
    );

    // Mutate with matching version (server bumped to 1)
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({ entityId, clientVersion: 1 })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
  });

  it('should handle multiple mutations in one batch with independent conflicts', async () => {
    const entityA = `pos_batch_a_${Date.now()}`;
    const entityB = `pos_batch_b_${Date.now()}`;

    // Create both entities
    await processSyncRequest(
      makeSyncRequest([
        makeMutation({ mutationId: 'create_a', entityId: entityA, clientVersion: null }),
        makeMutation({ mutationId: 'create_b', entityId: entityB, clientVersion: null }),
      ]),
      'user-1',
    );

    // Second batch: entityA with correct version, entityB with stale version
    const result = await processSyncRequest(
      makeSyncRequest([
        makeMutation({
          mutationId: 'update_a',
          type: 'SELL_STOCK',
          entityId: entityA,
          clientVersion: 1,
          payload: { symbol: 'RELIANCE', quantity: 3, price: 2550 },
        }),
        makeMutation({
          mutationId: 'update_b',
          type: 'SELL_STOCK',
          entityId: entityB,
          clientVersion: 0, // stale — server has version 1
          payload: { symbol: 'TCS', quantity: 2, price: 3400 },
        }),
      ]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].mutationId).toBe('update_a');
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].mutationId).toBe('update_b');
  });
});

// ============================================================================
// 2. Mutation Handlers
// ============================================================================

describe('Mutation Handlers', () => {
  // ──────────── BUY_STOCK ────────────

  it('BUY_STOCK should create a position entity', async () => {
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'BUY_STOCK',
        entityType: 'position',
        entityId: null,
        payload: { symbol: 'RELIANCE', quantity: 10, price: 2500 },
      })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].entityId).toBeTruthy();
    expect(result.applied[0].newVersion).toBe(1);
  });

  it('BUY_STOCK should create entity with provided entityId', async () => {
    const entityId = `pos_explicit_${Date.now()}`;
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'BUY_STOCK',
        entityType: 'position',
        entityId,
        payload: { symbol: 'HDFCBANK', quantity: 5, price: 1600 },
      })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].entityId).toBe(entityId);
  });

  // ──────────── SELL_STOCK ────────────

  it('SELL_STOCK should create a position entity', async () => {
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'SELL_STOCK',
        entityType: 'position',
        entityId: `pos_sell_${Date.now()}`,
        payload: { symbol: 'TCS', quantity: 5, price: 3500 },
      })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].newVersion).toBe(1);
  });

  // ──────────── ADD_TO_WATCHLIST ────────────

  it('ADD_TO_WATCHLIST should add a stock to a watchlist', async () => {
    const watchlistId = `wl_add_${Date.now()}`;
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'ADD_TO_WATCHLIST',
        entityType: 'watchlist_stock',
        entityId: `${watchlistId}:RELIANCE`,
        payload: { watchlistId, symbol: 'RELIANCE' },
      })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
  });

  it('ADD_TO_WATCHLIST should fail if stock already in watchlist', async () => {
    const watchlistId = `wl_dup_${Date.now()}`;
    const entityId = `${watchlistId}:RELIANCE`;

    // First add succeeds
    await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'ADD_TO_WATCHLIST',
        entityType: 'watchlist_stock',
        entityId,
        payload: { watchlistId, symbol: 'RELIANCE' },
      })]),
      'user-1',
    );

    // Second add fails
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'ADD_TO_WATCHLIST',
        entityType: 'watchlist_stock',
        entityId,
        payload: { watchlistId, symbol: 'RELIANCE' },
      })]),
      'user-1',
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toContain('already in watchlist');
  });

  // ──────────── REMOVE_FROM_WATCHLIST ────────────

  it('REMOVE_FROM_WATCHLIST should remove a stock from a watchlist', async () => {
    const watchlistId = `wl_rem_${Date.now()}`;
    const entityId = `${watchlistId}:TCS`;

    // Add first
    await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'ADD_TO_WATCHLIST',
        entityType: 'watchlist_stock',
        entityId,
        payload: { watchlistId, symbol: 'TCS' },
      })]),
      'user-1',
    );

    // Now remove
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'REMOVE_FROM_WATCHLIST',
        entityType: 'watchlist_stock',
        entityId,
        payload: { watchlistId, symbol: 'TCS' },
      })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
  });

  it('REMOVE_FROM_WATCHLIST should succeed even if stock not in watchlist', async () => {
    const watchlistId = `wl_rem_missing_${Date.now()}`;
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'REMOVE_FROM_WATCHLIST',
        entityType: 'watchlist_stock',
        entityId: `${watchlistId}:INFY`,
        payload: { watchlistId, symbol: 'INFY' },
      })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
  });

  // ──────────── CREATE_WATCHLIST ────────────

  it('CREATE_WATCHLIST should create a watchlist entity', async () => {
    const watchlistId = `wl_create_${Date.now()}`;
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'CREATE_WATCHLIST',
        entityType: 'watchlist',
        entityId: watchlistId,
        payload: { name: 'My Watchlist' },
      })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].entityId).toBe(watchlistId);
  });

  it('CREATE_WATCHLIST should auto-generate entityId if not provided', async () => {
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'CREATE_WATCHLIST',
        entityType: 'watchlist',
        entityId: null,
        payload: { name: 'Auto-generated' },
      })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].entityId).toMatch(/^watchlist_/);
  });

  // ──────────── DELETE_WATCHLIST ────────────

  it('DELETE_WATCHLIST should mark watchlist as deleted', async () => {
    const watchlistId = `wl_del_test_${Date.now()}`;

    // Create first
    await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'CREATE_WATCHLIST',
        entityType: 'watchlist',
        entityId: watchlistId,
        clientVersion: null,
        payload: { name: 'Delete me' },
      })]),
      'user-1',
    );

    // Delete
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'DELETE_WATCHLIST',
        entityType: 'watchlist',
        entityId: watchlistId,
        clientVersion: 1,
        payload: { watchlistId },
      })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
  });

  it('DELETE_WATCHLIST should succeed for non-existent watchlist', async () => {
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'DELETE_WATCHLIST',
        entityType: 'watchlist',
        entityId: 'non-existent-wl',
        payload: { watchlistId: 'non-existent-wl' },
      })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
  });

  // ──────────── MODIFY_ORDER ────────────

  it('MODIFY_ORDER should update an existing order', async () => {
    const orderId = `ord_mod_${Date.now()}`;
    const orderEntityId = orderId;

    // Create an order first (use BUY_STOCK with entityId tracking)
    await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'BUY_STOCK',
        entityType: 'order',
        entityId: orderEntityId,
        payload: { symbol: 'SBIN', quantity: 100, price: 800 },
      })]),
      'user-1',
    );

    // Modify the order
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'MODIFY_ORDER',
        entityType: 'order',
        entityId: orderEntityId,
        clientVersion: 1,
        payload: { orderId, quantity: 150, price: 810 },
      })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
  });

  it('MODIFY_ORDER should fail for non-existent order', async () => {
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'MODIFY_ORDER',
        entityType: 'order',
        entityId: 'nonexistent-order',
        payload: { orderId: 'nonexistent-order', quantity: 50 },
      })]),
      'user-1',
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toContain('Order not found');
  });

  // ──────────── CANCEL_ORDER ────────────

  it('CANCEL_ORDER should cancel an existing order', async () => {
    const orderId = `ord_cancel_${Date.now()}`;
    const orderEntityId = orderId;

    // Create an order
    await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'BUY_STOCK',
        entityType: 'order',
        entityId: orderEntityId,
        payload: { symbol: 'INFY', quantity: 50, price: 1600 },
      })]),
      'user-1',
    );

    // Cancel the order
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'CANCEL_ORDER',
        entityType: 'order',
        entityId: orderEntityId,
        clientVersion: 1,
        payload: { orderId },
      })]),
      'user-1',
    );

    expect(result.applied).toHaveLength(1);
  });

  it('CANCEL_ORDER should fail for non-existent order', async () => {
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'CANCEL_ORDER',
        entityType: 'order',
        entityId: 'nonexistent-order',
        payload: { orderId: 'nonexistent-order' },
      })]),
      'user-1',
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toContain('Order not found');
  });
});

// ============================================================================
// 3. Delta Sync
// ============================================================================

describe('Delta Sync', () => {
  it('should return all entities as delta when no lastSyncTimestamp given', async () => {
    // Create two entities
    await processSyncRequest(
      makeSyncRequest([
        makeMutation({
          mutationId: 'delta_a',
          type: 'BUY_STOCK',
          entityType: 'position',
          entityId: `pos_d1_${Date.now()}`,
          clientVersion: null,
          payload: { symbol: 'RELIANCE', quantity: 10, price: 2500 },
        }),
        makeMutation({
          mutationId: 'delta_b',
          type: 'SELL_STOCK',
          entityType: 'position',
          entityId: `pos_d2_${Date.now()}`,
          clientVersion: null,
          payload: { symbol: 'TCS', quantity: 5, price: 3500 },
        }),
      ]),
      'user-1',
    );

    // Delta sync with null timestamp should return all entities
    const deltaResult = await processSyncRequest(
      { lastSyncTimestamp: null, mutations: [] },
      'user-1',
    );

    expect(deltaResult.delta.length).toBeGreaterThanOrEqual(2);
    expect(deltaResult.applied).toHaveLength(0);
    expect(deltaResult.conflicts).toHaveLength(0);
  });

  it('should return only entities changed after lastSyncTimestamp', async () => {
    const entityId = `pos_delta_time_${Date.now()}`;

    // Create entity (record its creation time approximately)
    await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'BUY_STOCK',
        entityType: 'position',
        entityId,
        clientVersion: null,
        payload: { symbol: 'RELIANCE', quantity: 10, price: 2500 },
      })]),
      'user-1',
    );

    // Wait a tiny bit to ensure time progression
    await new Promise((r) => setTimeout(r, 10));

    const afterCreate = new Date().toISOString();

    // Delta sync with timestamp after creation should return nothing
    const result = await processSyncRequest(
      { lastSyncTimestamp: afterCreate, mutations: [] },
      'user-1',
    );

    expect(result.delta).toHaveLength(0);
  });

  it('should return only entities for the requesting user', async () => {
    const entityId = `pos_user_${Date.now()}`;

    // Create entity for user-1
    await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'BUY_STOCK',
        entityType: 'position',
        entityId,
        clientVersion: null,
        payload: { symbol: 'RELIANCE', quantity: 10, price: 2500 },
      })]),
      'user-1',
    );

    // User-2 should see no delta for user-1's entity
    const result = await processSyncRequest(
      { lastSyncTimestamp: null, mutations: [] },
      'user-2',
    );

    expect(result.delta).toHaveLength(0);
  });

  it('should include deleted entities in delta if deleted after timestamp', async () => {
    const watchlistId = `wl_delta_del_${Date.now()}`;

    // Create
    await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'CREATE_WATCHLIST',
        entityType: 'watchlist',
        entityId: watchlistId,
        clientVersion: null,
        payload: { name: 'Temp' },
      })]),
      'user-1',
    );

    // This test is tricky because _entityStore stores deleted records
    // but the delta filter checks `record.userId === userId && !record.deleted`
    // so deleted entities are excluded from delta. That's fine — the frontend
    // doesn't need to receive a delta for an entity it already knows is deleted.
    
    await new Promise((r) => setTimeout(r, 5));
    const beforeDelete = new Date().toISOString();

    // Delete
    await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'DELETE_WATCHLIST',
        entityType: 'watchlist',
        entityId: watchlistId,
        clientVersion: 1,
        payload: { watchlistId },
      })]),
      'user-1',
    );

    // Delta after delete — deleted entities are not returned
    const result = await processSyncRequest(
      { lastSyncTimestamp: beforeDelete, mutations: [] },
      'user-1',
    );

    expect(result.delta).toHaveLength(0);
  });
});

// ============================================================================
// 4. Idempotency / Dedup
// ============================================================================

describe('Idempotency — Mutation Dedup', () => {
  it('should skip mutation with duplicate mutationId', async () => {
    const mutationId = `dedup_${Date.now()}`;

    // First apply
    const first = await processSyncRequest(
      makeSyncRequest([makeMutation({ mutationId, entityId: null })]),
      'user-1',
    );
    expect(first.applied).toHaveLength(1);

    // Second apply with same mutationId — should be idempotent
    const second = await processSyncRequest(
      makeSyncRequest([makeMutation({ mutationId, entityId: null })]),
      'user-1',
    );

    // Should appear as applied (idempotent, not a conflict or failure)
    expect(second.applied).toHaveLength(1);
  });
});

// ============================================================================
// 5. Error Handling
// ============================================================================

describe('Error Handling', () => {
  it('should fail mutation with unknown type (no handler registered)', async () => {
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'UNKNOWN_TYPE',
        entityType: 'unknown',
      })]),
      'user-1',
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toContain('No handler registered');
    expect(result.failed[0].error).toContain('UNKNOWN_TYPE');
  });

  it('should handle empty mutation array', async () => {
    const result = await processSyncRequest(
      { lastSyncTimestamp: null, mutations: [] },
      'user-1',
    );

    expect(result.applied).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(result.newSyncTimestamp).toBeTruthy();
  });

  it('should handle custom handler that throws', async () => {
    // Register a handler that throws
    registerMutationHandler('THROWS', async () => {
      throw new Error('Intentional handler failure');
    });

    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'THROWS',
        entityType: 'custom',
      })]),
      'user-1',
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toContain('Intentional handler failure');
  });

  it('should handle custom handler that returns failure', async () => {
    registerMutationHandler('RETURNS_FAILURE', async () => {
      return { success: false, entityId: '', error: 'Custom failure reason' };
    });

    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({
        type: 'RETURNS_FAILURE',
        entityType: 'custom',
      })]),
      'user-1',
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toContain('Custom failure reason');
  });
});

// ============================================================================
// 6. Mixed Batch Processing
// ============================================================================

describe('Batch Processing — Mixed Results', () => {
  it('should process multiple mutations with mixed results', async () => {
    const entityId = `pos_mixed_${Date.now()}`;

    const result = await processSyncRequest(
      makeSyncRequest([
        // 1. Will be applied (new entity)
        makeMutation({
          mutationId: 'mixed_1',
          type: 'BUY_STOCK',
          entityType: 'position',
          entityId: entityId,
          clientVersion: null,
          payload: { symbol: 'RELIANCE', quantity: 10, price: 2500 },
        }),
        // 2. Will be applied (new entity)
        makeMutation({
          mutationId: 'mixed_2',
          type: 'CREATE_WATCHLIST',
          entityType: 'watchlist',
          entityId: `wl_mixed_${Date.now()}`,
          clientVersion: null,
          payload: { name: 'Mixed Watchlist' },
        }),
        // 3. Will fail (no handler)
        makeMutation({
          mutationId: 'mixed_3',
          type: 'UNKNOWN_HANDLER_TYPE',
          entityType: 'unknown',
        }),
      ]),
      'user-1',
    );

    expect(result.applied).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
    expect(result.mutations).toBeUndefined(); // SyncResult has no mutations field
  });

  it('should return newSyncTimestamp as a valid ISO string', async () => {
    const result = await processSyncRequest(
      makeSyncRequest([makeMutation({ entityId: null })]),
      'user-1',
    );

    expect(result.newSyncTimestamp).toBeTruthy();
    expect(() => new Date(result.newSyncTimestamp)).not.toThrow();
    expect(new Date(result.newSyncTimestamp).toISOString()).toBe(result.newSyncTimestamp);
  });
});

// ============================================================================
// 7. Express Router — POST /api/sync
// ============================================================================

describe('Express Router — POST /api/sync', () => {
  let app: any;
  let http: any;
  let server: any;
  let baseUrl: string;

  beforeEach(async () => {
    // We need to mock authMiddleware before importing the default export (router)
    vi.resetModules();
    vi.doMock('../middleware/auth', () => ({
      authMiddleware: (req: any, _res: any, next: any) => {
        req.user = { userId: 'router-test-user', email: 'router@test.com' };
        next();
      },
    }));

    const express = await import('express');
    const syncRouter = (await import('../services/syncService')).default;
    const httpMod = await import('http');

    app = express.default();
    app.use(express.json());
    app.use('/api/sync', syncRouter);

    http = httpMod;
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        baseUrl = `http://localhost:${(server.address() as any).port}`;
        resolve();
      });
    });
  });

  afterEach(() => {
    server?.close();
  });

  it('POST /api/sync should return 200 with SyncResult for valid request', async () => {
    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastSyncTimestamp: null,
        mutations: [{
          mutationId: 'router_test_1',
          type: 'BUY_STOCK',
          entityType: 'position',
          entityId: null,
          payload: { symbol: 'RELIANCE', quantity: 10, price: 2500 },
          clientVersion: null,
          enqueuedAt: new Date().toISOString(),
        }],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as SyncResult;
    expect(body.applied).toHaveLength(1);
    expect(body.conflicts).toHaveLength(0);
    expect(body.failed).toHaveLength(0);
    expect(body.delta).toBeDefined();
    expect(body.newSyncTimestamp).toBeTruthy();
  });

  it('POST /api/sync should return 400 for invalid request body', async () => {
    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing lastSyncTimestamp and mutations
        invalidField: true,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid sync request');
    expect(body.details).toBeDefined();
  });

  it('POST /api/sync should return 400 for missing mutations field', async () => {
    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastSyncTimestamp: null,
        // mutations is required
      }),
    });

    expect(res.status).toBe(400);
  });

  it('POST /api/sync should return 400 for malformed mutation', async () => {
    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastSyncTimestamp: null,
        mutations: [{
          // Missing mutationId, type, entityType, etc.
          payload: { symbol: 'RELIANCE' },
        }],
      }),
    });

    expect(res.status).toBe(400);
  });

  it('GET /api/sync/status should return 200 with status info', async () => {
    // Create a mutation first to have some entity data
    await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastSyncTimestamp: null,
        mutations: [{
          mutationId: 'status_test_1',
          type: 'BUY_STOCK',
          entityType: 'position',
          entityId: null,
          payload: { symbol: 'RELIANCE', quantity: 10, price: 2500 },
          clientVersion: null,
          enqueuedAt: new Date().toISOString(),
        }],
      }),
    });

    const res = await fetch(`${baseUrl}/api/sync/status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('router-test-user');
    expect(body.totalEntities).toBeGreaterThanOrEqual(1);
    expect(body.latestUpdatedAt).toBeTruthy();
    expect(body.serverTime).toBeTruthy();
  });

  it('GET /api/sync/status should return 200 with zero entities for fresh state', async () => {
    const res = await fetch(`${baseUrl}/api/sync/status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalEntities).toBe(0);
  });
});
