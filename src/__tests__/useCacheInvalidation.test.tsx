/**
 * ============================================================================
 * Toroloom — useCacheInvalidation Hook Tests
 * ============================================================================
 *
 * Tests the push-based cache invalidation hook:
 *   1. Registers the onCacheInvalidationCallback on mount
 *   2. Prevents duplicate registration on re-render via registeredRef
 *   3. Clears cache for provided namespaces when invalidation is received
 *   4. Falls back to entity-derived namespaces when namespaces array is absent
 *   5. Handles empty entities gracefully (no cache clear)
 *   6. Removes each cache namespace via offlineCache.remove
 *   7. Resets registeredRef on unmount so re-mount can register again
 *   8. Captures entities array is non-empty even with empty namespaces
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TestRenderer from 'react-test-renderer';

// ──── Hoisted Mocks ─────────────────────────────────────────────────────────
// Must be vi.hoisted so they're available inside vi.mock factories.

let registeredCacheCallback: ((data: any) => Promise<void>) | null = null;

const {
  mockWS,
} = vi.hoisted(() => {
  return {
    mockWS: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      onConnectionChangeCallback: vi.fn(),
      onPnLUpdateCallback: vi.fn(),
      onLockdownCallback: vi.fn(),
      onCacheInvalidationCallback: vi.fn((cb: (data: any) => Promise<void>) => {
        registeredCacheCallback = cb;
      }),
      setLossLimit: vi.fn(),
      getCurrentPrice: vi.fn(() => 1000),
      getCachedCandles: vi.fn(() => []),
      getIsAuthenticated: vi.fn(() => false),
    },
  };
});

// Mock wsRegistry so getActiveWS() returns our controllable mock
vi.mock('../services/wsRegistry', () => ({
  getActiveWS: vi.fn(() => mockWS),
}));

// Mock offlineCache so we can verify remove was called.
// Must be hoisted so the vi.mock factory (also hoisted) can reference it.
const mockRemove = vi.hoisted(() => vi.fn(async (_ns: string) => {}));
vi.mock('../services/offlineCache', () => ({
  offlineCache: {
    remove: mockRemove,
    save: vi.fn(),
    load: vi.fn(),
    clearAll: vi.fn(),
    getAnalytics: vi.fn(() => ({ hits: 0, misses: 0 })),
    resetAnalytics: vi.fn(),
    getTTL: vi.fn(() => 300000),
    getStorageStats: vi.fn(),
    getDiagnostics: vi.fn(),
    getDiagnosticEntry: vi.fn(),
  },
}));

// Mock logger to suppress noise during tests
vi.mock('../utils/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the shared cache namespace mapping
vi.mock('../../backend/src/constants/cacheNamespaces', () => ({
  ENTITY_TO_CACHE_NAMESPACE: {
    position: 'portfolio',
    order: 'openOrders',
    watchlist: 'watchlist',
    watchlist_stock: 'watchlist',
  } as const,
  getCacheNamespace: (entityType: string) => {
    const map: Record<string, string> = {
      position: 'portfolio',
      order: 'openOrders',
      watchlist: 'watchlist',
      watchlist_stock: 'watchlist',
    };
    return map[entityType] ?? entityType;
  },
}));

// ──── Imports (after mocks) ─────────────────────────────────────────────────

import { useCacheInvalidation } from '../hooks/useCacheInvalidation';
import { offlineCache } from '../services/offlineCache';

// ──── Test Component ────────────────────────────────────────────────────────

function TestComponent() {
  useCacheInvalidation();
  return null;
}

// Reset between tests
beforeEach(() => {
  vi.clearAllMocks();
  registeredCacheCallback = null;
});

// ──── Tests ─────────────────────────────────────────────────────────────────

describe('useCacheInvalidation', () => {

  // ──────────────── 1. Registers callback on mount ──────────────────────────

  it('should register onCacheInvalidationCallback on mount', () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    expect(mockWS.onCacheInvalidationCallback).toHaveBeenCalledTimes(1);
    expect(typeof mockWS.onCacheInvalidationCallback.mock.calls[0][0]).toBe('function');
  });

  // ──────────────── 2. Does not register again on re-render ─────────────────

  it('should not register again on re-render', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<TestComponent />);
    });

    // First call on mount
    expect(mockWS.onCacheInvalidationCallback).toHaveBeenCalledTimes(1);

    // Re-render (simulated by updating props)
    act(() => {
      renderer!.update(<TestComponent />);
    });

    // Should still be only 1 call (registeredRef prevents duplicate)
    expect(mockWS.onCacheInvalidationCallback).toHaveBeenCalledTimes(1);
  });

  // ──────────────── 3. Clears cache for provided namespaces ─────────────────

  it('should clear cache for provided namespaces on invalidation', async () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    expect(registeredCacheCallback).not.toBeNull();

    // Simulate an invalidation event from the server
    await act(async () => {
      await registeredCacheCallback!({
        entities: [{ entityType: 'position', entityId: 'pos_001' }],
        namespaces: ['portfolio', 'watchlist'],
        timestamp: new Date().toISOString(),
      });
    });

    // Should clear both namespaces
    expect(mockRemove).toHaveBeenCalledTimes(2);
    expect(mockRemove).toHaveBeenCalledWith('portfolio');
    expect(mockRemove).toHaveBeenCalledWith('watchlist');
  });

  // ──────────────── 4. Falls back to entity-derived namespaces ──────────────

  it('should derive namespaces from entity types when namespaces not provided', async () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    await act(async () => {
      await registeredCacheCallback!({
        entities: [
          { entityType: 'position', entityId: 'pos_001' },
          { entityType: 'order', entityId: 'ord_002' },
        ],
        // No namespaces array provided — should derive from entities
        timestamp: new Date().toISOString(),
      });
    });

    // position → portfolio, order → openOrders
    expect(mockRemove).toHaveBeenCalledTimes(2);
    expect(mockRemove).toHaveBeenCalledWith('portfolio');
    expect(mockRemove).toHaveBeenCalledWith('openOrders');
  });

  // ──────────────── 5. Handles empty entities gracefully ────────────────────

  it('should not clear anything when entities array is empty', async () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    await act(async () => {
      await registeredCacheCallback!({
        entities: [],
        namespaces: [],
        timestamp: new Date().toISOString(),
      });
    });

    expect(mockRemove).not.toHaveBeenCalled();
  });

  // ──────────────── 6. Removes each unique namespace once ───────────────────

  it('should deduplicate namespaces when multiple entities map to same namespace', async () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    await act(async () => {
      await registeredCacheCallback!({
        entities: [
          { entityType: 'position', entityId: 'pos_001' },
          { entityType: 'position', entityId: 'pos_002' },
          { entityType: 'watchlist_stock', entityId: 'wl:RELIANCE' },
        ],
        // Fallback to entity-derived namespaces
        timestamp: new Date().toISOString(),
      });
    });

    // position → portfolio, watchlist_stock → watchlist
    // Two positions only produce one unique namespace
    expect(mockRemove).toHaveBeenCalledTimes(2);
    expect(mockRemove).toHaveBeenCalledWith('portfolio');
    expect(mockRemove).toHaveBeenCalledWith('watchlist');
  });

  // ──────────────── 7. Unmount resets ref so re-mount can register ──────────

  it('should re-register callback after unmount + remount', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<TestComponent />);
    });

    expect(mockWS.onCacheInvalidationCallback).toHaveBeenCalledTimes(1);

    // Unmount
    act(() => {
      renderer!.unmount();
    });

    // Reset registry so we can track a new call
    registeredCacheCallback = null;

    // Remount
    act(() => {
      renderer = TestRenderer.create(<TestComponent />);
    });

    // The effect runs again after unmount + remount
    expect(mockWS.onCacheInvalidationCallback).toHaveBeenCalledTimes(2);
  });

  // ──────────────── 8. Partial update — namespaces override entities ────────

  it('should prefer provided namespaces over entity-derived ones', async () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    await act(async () => {
      await registeredCacheCallback!({
        entities: [{ entityType: 'position', entityId: 'pos_001' }],
        namespaces: ['custom_ns'],
        timestamp: new Date().toISOString(),
      });
    });

    // Should clear custom_ns, NOT portfolio (position → portfolio)
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledWith('custom_ns');
    expect(mockRemove).not.toHaveBeenCalledWith('portfolio');
  });
});
