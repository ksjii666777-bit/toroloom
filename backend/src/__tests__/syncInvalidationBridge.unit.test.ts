/**
 * ============================================================================
 * Toroloom Sync Invalidation Bridge — Unit Tests
 * ============================================================================
 *
 * Tests broadcastMutationsInvalidation() with a mocked WebSocketServer and
 * clients Map, so no real network or WebSocket connections are needed.
 *
 * These tests cover the bridge logic in isolation:
 *   1. No-op when WSS is not set
 *   2. No broadcast when no mutations are applied
 *   3. Anonymous creates (null entityId) are skipped
 *   4. Correct payload sent to matching user's connections
 *   5. User isolation — does NOT send to other users
 *   6. Non-OPEN clients are skipped
 *   7. Multiple clients for the same user both receive the message
 *   8. Multiple mutations produce combined entities/namespaces
 *   9. Mixed applied/failed — only applied mutations broadcast
 *  10. Logger output when clients are notified
 *  11. Fallback namespace when no mapping exists
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/syncInvalidationBridge.unit.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ──── Mocks (vi.hoisted for variables shared with vi.mock factories) ────────

// Track sent payloads per WebSocket mock.  Must be hoisted so the spyOnSend
// helper (called inside tests) can write into it.
const sentPayloads = vi.hoisted(() => {
  return new Map<{ readyState: number }, string[]>();
});

// The clients Map shared between test assertions and the bridge's import of
// `clients` from websocket/state.  Must be hoisted so the vi.mock factory
// (also hoisted) can close over the reference before module init runs.
const mockClients = vi.hoisted(() => {
  return new Map<{ readyState: number }, { userId: string }>();
});

// Mock the ws module — returns plain WebSocket.OPEN constant so the bridge's
// readiness check (`readyState !== WebSocket.OPEN`) compiles.  The actual WSS
// objects are created inline in each test as plain `{ clients: Set }` objects,
// avoiding the real ws constructor validation altogether.
vi.mock('ws', () => ({
  WebSocket: { OPEN: 1 },
}));

// Mock the websocket state — provide a controlled clients Map reference.
// The mockClients Map is created via vi.hoisted() above, so it is
// initialised *before* this factory runs.
vi.mock('../websocket/state', () => ({
  clients: mockClients,
}));

// Mock the cacheNamespaces constant — use the same mapping logic as the real
// implementation so the bridge's namespace resolution is exercised.
vi.mock('../constants/cacheNamespaces', () => ({
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

// Import AFTER mocks
import { setWSS, getWSS, broadcastMutationsInvalidation, getFailureCount, resetFailureCounter } from '../services/syncInvalidationBridge';

// ──── Helpers ───────────────────────────────────────────────────────────────

type Mutation = { entityType: string; entityId: string | null; mutationId: string };
type Applied = { mutationId: string };

/** Create a fake WebSocketServer-like object with a clients Set. */
function makeFakeWSS() {
  return { clients: new Set<{ readyState: number }>() };
}

function makeMutation(overrides: Partial<Mutation> = {}): Mutation {
  return {
    entityType: 'position',
    entityId: `pos_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    mutationId: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ...overrides,
  };
}

function makeApplied(mutationId: string): Applied {
  return { mutationId };
}

/** Create a mock WebSocket-like object and register it in the sentPayloads tracker. */
function makeWSMock(): { readyState: number } {
  const ws = { readyState: 1 }; // WebSocket.OPEN
  sentPayloads.set(ws, []);
  return ws;
}

/**
 * Replace ws.send with a spy that tracks payloads in sentPayloads.
 * Returns the spy so you can check call counts and arguments.
 */
function spyOnSend(ws: { readyState: number }): ReturnType<typeof vi.fn> {
  const sendSpy = vi.fn((payload: string) => {
    const arr = sentPayloads.get(ws);
    if (arr) arr.push(payload);
  });
  (ws as any).send = sendSpy;
  return sendSpy;
}

/** Get the captured sent payloads for a ws mock */
function getSentPayloads(ws: { readyState: number }): string[] {
  return sentPayloads.get(ws) ?? [];
}

// ──── Per-test reset ────────────────────────────────────────────────────────

beforeEach(() => {
  sentPayloads.clear();
  mockClients.clear();
  resetFailureCounter();
});

// ============================================================================
// Tests
// ============================================================================

describe('syncInvalidationBridge — broadcastMutationsInvalidation (unit)', () => {

  // ──────────────── 1. No WSS set ───────────────────────────────────────────

  it('should no-op when WSS is not set (no crash)', () => {
    expect(getWSS()).toBeNull();

    expect(() => {
      broadcastMutationsInvalidation('user-1', [makeMutation()], [makeApplied('mut_1')]);
    }).not.toThrow();
  });

  // ──────────────── 2. No applied mutations ─────────────────────────────────

  it('should not broadcast when no mutations were applied', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);

    const client = makeWSMock();
    mockClients.set(client, { userId: 'user-1' });
    wss.clients.add(client);
    spyOnSend(client);

    broadcastMutationsInvalidation('user-1', [makeMutation()], []);

    expect(getSentPayloads(client)).toHaveLength(0);
  });

  // ──────────────── 3. Anonymous creates (null entityId) ────────────────────

  it('should skip mutations with null entityId (anonymous creates)', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);

    const client = makeWSMock();
    mockClients.set(client, { userId: 'user-1' });
    wss.clients.add(client);
    spyOnSend(client);

    const mutation = makeMutation({ entityId: null });
    broadcastMutationsInvalidation('user-1', [mutation], [makeApplied(mutation.mutationId)]);

    expect(getSentPayloads(client)).toHaveLength(0);
  });

  // ──────────────── 4. Happy path ───────────────────────────────────────────

  it('should send cache_invalidate payload to matching client', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);

    const client = makeWSMock();
    mockClients.set(client, { userId: 'user-1' });
    wss.clients.add(client);
    const sendSpy = spyOnSend(client);

    const mutation = makeMutation({ entityType: 'position', entityId: 'pos_abc' });
    broadcastMutationsInvalidation('user-1', [mutation], [makeApplied(mutation.mutationId)]);

    expect(sendSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(sendSpy.mock.calls[0][0]);
    expect(payload.type).toBe('cache_invalidate');
    expect(payload.data.entities).toHaveLength(1);
    expect(payload.data.entities[0]).toEqual({
      entityType: 'position',
      entityId: 'pos_abc',
    });
    expect(payload.data.namespaces).toEqual(['portfolio']);
    expect(payload.data.timestamp).toBeDefined();
    expect(() => new Date(payload.data.timestamp)).not.toThrow();
  });

  // ──────────────── 5. User isolation ───────────────────────────────────────

  it('should not send to clients of a different user', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);

    const otherClient = makeWSMock();
    mockClients.set(otherClient, { userId: 'user-2' });
    wss.clients.add(otherClient);
    const sendSpy = spyOnSend(otherClient);

    const mutation = makeMutation({ entityType: 'position', entityId: 'pos_xyz' });
    broadcastMutationsInvalidation('user-1', [mutation], [makeApplied(mutation.mutationId)]);

    expect(sendSpy).not.toHaveBeenCalled();
  });

  // ──────────────── 6. Non-OPEN client skipped ──────────────────────────────

  it('should skip clients that are not in OPEN state', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);

    const closedClient = { readyState: 3 }; // CLOSED
    mockClients.set(closedClient, { userId: 'user-1' });
    wss.clients.add(closedClient);
    const sendSpy = spyOnSend(closedClient);

    const mutation = makeMutation({ entityType: 'order', entityId: 'ord_001' });
    broadcastMutationsInvalidation('user-1', [mutation], [makeApplied(mutation.mutationId)]);

    expect(sendSpy).not.toHaveBeenCalled();
  });

  // ──────────────── 7. Multiple clients for same user ─────────────────────

  it('should send to all connected clients for the same user', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);

    const clientA = makeWSMock();
    const clientB = makeWSMock();
    mockClients.set(clientA, { userId: 'user-1' });
    mockClients.set(clientB, { userId: 'user-1' });
    wss.clients.add(clientA);
    wss.clients.add(clientB);
    const sendSpyA = spyOnSend(clientA);
    const sendSpyB = spyOnSend(clientB);

    const mutation = makeMutation({ entityType: 'watchlist', entityId: 'wl_001' });
    broadcastMutationsInvalidation('user-1', [mutation], [makeApplied(mutation.mutationId)]);

    expect(sendSpyA).toHaveBeenCalledTimes(1);
    expect(sendSpyB).toHaveBeenCalledTimes(1);
  });

  // ──────────────── 8. Multiple mutations — combined ───────────────────────

  it('should combine entities and namespaces from multiple applied mutations', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);

    const client = makeWSMock();
    mockClients.set(client, { userId: 'user-1' });
    wss.clients.add(client);
    const sendSpy = spyOnSend(client);

    const mutA = makeMutation({ entityType: 'position', entityId: 'pos_001' });
    const mutB = makeMutation({ entityType: 'watchlist', entityId: 'wl_002' });
    const mutC = makeMutation({ entityType: 'order', entityId: 'ord_003' });

    broadcastMutationsInvalidation('user-1', [mutA, mutB, mutC], [
      makeApplied(mutA.mutationId),
      makeApplied(mutB.mutationId),
      makeApplied(mutC.mutationId),
    ]);

    expect(sendSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(sendSpy.mock.calls[0][0]);

    expect(payload.data.entities).toHaveLength(3);
    const entityTypes = payload.data.entities.map((e: any) => e.entityType);
    expect(entityTypes).toContain('position');
    expect(entityTypes).toContain('watchlist');
    expect(entityTypes).toContain('order');

    expect(payload.data.namespaces).toContain('portfolio');
    expect(payload.data.namespaces).toContain('watchlist');
    expect(payload.data.namespaces).toContain('openOrders');
    expect(payload.data.namespaces).toHaveLength(3);
  });

  // ──────────────── 9. Mixed applied/failed — only applied broadcast ───────

  it('should only broadcast for mutations that were actually applied', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);

    const client = makeWSMock();
    mockClients.set(client, { userId: 'user-1' });
    wss.clients.add(client);
    const sendSpy = spyOnSend(client);

    const mutA = makeMutation({ entityType: 'position', entityId: 'pos_applied' });
    const mutB = makeMutation({ entityType: 'order', entityId: 'ord_skipped' });

    // Only mutA was applied; mutB was not
    broadcastMutationsInvalidation('user-1', [mutA, mutB], [makeApplied(mutA.mutationId)]);

    const payload = JSON.parse(sendSpy.mock.calls[0][0]);
    expect(payload.data.entities).toHaveLength(1);
    expect(payload.data.entities[0].entityType).toBe('position');
    expect(payload.data.namespaces).toEqual(['portfolio']);
  });

  // ──────────────── 10. Logging ─────────────────────────────────────────────

  it('should log when invalidation is sent to clients', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const wss = makeFakeWSS();
    setWSS(wss as any);

    const client = makeWSMock();
    mockClients.set(client, { userId: 'user-1' });
    wss.clients.add(client);
    spyOnSend(client);

    const mutation = makeMutation({ entityType: 'position', entityId: 'pos_log_test' });
    broadcastMutationsInvalidation('user-1', [mutation], [makeApplied(mutation.mutationId)]);

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls[0][0]).toContain('[SyncBridge]');
    expect(logSpy.mock.calls[0][0]).toContain('1 client(s) notified');

    logSpy.mockRestore();
  });

  // ──────────────── 11. Fallback namespace ──────────────────────────────────

  it('should fall back to entityType when no namespace mapping exists', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);

    const client = makeWSMock();
    mockClients.set(client, { userId: 'user-1' });
    wss.clients.add(client);
    const sendSpy = spyOnSend(client);

    const mutation = makeMutation({ entityType: 'custom_type', entityId: 'custom_001' });
    broadcastMutationsInvalidation('user-1', [mutation], [makeApplied(mutation.mutationId)]);

    const payload = JSON.parse(sendSpy.mock.calls[0][0]);
    expect(payload.data.namespaces).toContain('custom_type');
  });

  // ──────────────── 12. ws.send() throws on one client — others still receive ──

  it('should still send to other clients when ws.send() throws on one', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);

    // Client A: send will throw
    const clientA = makeWSMock();
    mockClients.set(clientA, { userId: 'user-1' });
    wss.clients.add(clientA);
    (clientA as any).send = vi.fn(() => {
      throw new Error('Connection reset by peer');
    });

    // Client B: send works normally
    const clientB = makeWSMock();
    mockClients.set(clientB, { userId: 'user-1' });
    wss.clients.add(clientB);
    const sendSpyB = spyOnSend(clientB);

    // Spy on console.warn to suppress noise
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mutation = makeMutation({ entityType: 'position', entityId: 'pos_err_001' });
    broadcastMutationsInvalidation('user-1', [mutation], [makeApplied(mutation.mutationId)]);

    // Client B should still receive the payload
    expect(sendSpyB).toHaveBeenCalledTimes(1);

    // console.warn should have been called for client A's failure
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('[SyncBridge]');
    expect(warnSpy.mock.calls[0][0]).toContain('Connection reset by peer');

    warnSpy.mockRestore();
  });

  // ──────────────── 13. All clients throw — no crash ──────────────────────────

  it('should not crash when ws.send() throws on all clients', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);

    // Two clients, both throw on send
    const clientA = makeWSMock();
    mockClients.set(clientA, { userId: 'user-1' });
    wss.clients.add(clientA);
    (clientA as any).send = vi.fn(() => {
      throw new Error('Socket closed');
    });

    const clientB = makeWSMock();
    mockClients.set(clientB, { userId: 'user-1' });
    wss.clients.add(clientB);
    (clientB as any).send = vi.fn(() => {
      throw new Error('Socket closed');
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mutation = makeMutation({ entityType: 'order', entityId: 'ord_err_002' });

    // Should not throw despite both clients failing
    expect(() => {
      broadcastMutationsInvalidation('user-1', [mutation], [makeApplied(mutation.mutationId)]);
    }).not.toThrow();

    // Should have logged two warnings
    expect(warnSpy).toHaveBeenCalledTimes(2);

    warnSpy.mockRestore();
  });

  // ──────────────── 14. Logging when some sent count still logged ─────────────

  it('should log correct sent count even when some sends fail', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const wss = makeFakeWSS();
    setWSS(wss as any);

    // Client A: throws
    const clientA = makeWSMock();
    mockClients.set(clientA, { userId: 'user-1' });
    wss.clients.add(clientA);
    (clientA as any).send = vi.fn(() => {
      throw new Error('Socket closed');
    });

    // Client B: succeeds
    const clientB = makeWSMock();
    mockClients.set(clientB, { userId: 'user-1' });
    wss.clients.add(clientB);
    (clientB as any).send = vi.fn();

    const mutation = makeMutation({ entityType: 'position', entityId: 'pos_err_003' });
    broadcastMutationsInvalidation('user-1', [mutation], [makeApplied(mutation.mutationId)]);

    // Should log with sentCount = 1 (only client B succeeded)
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('1 client(s) notified');

    // Should have warned about client A's failure
    expect(warnSpy).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  // ──────────────── 15. Circuit breaker — basic counter increment ────────────

  it('should increment failure counter when ws.send() throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const wss = makeFakeWSS();
    setWSS(wss as any);

    const client = makeWSMock();
    mockClients.set(client, { userId: 'user-1' });
    wss.clients.add(client);
    (client as any).send = vi.fn(() => {
      throw new Error('Socket closed');
    });

    expect(getFailureCount()).toBe(0);

    // MutationId must match between mutation and applied entry
    const mutation = makeMutation({ entityType: 'position', entityId: 'pos_0' });
    broadcastMutationsInvalidation('user-1', [mutation], [makeApplied(mutation.mutationId)]);

    // After one failure, counter should be 1
    expect(getFailureCount()).toBe(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  // ──────────────── 16. Circuit breaker — 10 failures + 1 to trip ────────────

  it('should trip circuit breaker after 10 consecutive send failures', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const wss = makeFakeWSS();
    setWSS(wss as any);

    // Single client that always throws
    const client = makeWSMock();
    mockClients.set(client, { userId: 'user-1' });
    wss.clients.add(client);
    (client as any).send = vi.fn(() => {
      throw new Error('Socket closed');
    });

    // 9 failures — each logged individually, circuit not yet open
    for (let i = 0; i < 9; i++) {
      const m = makeMutation({ entityType: 'position', entityId: `pos_cb_${i}` });
      broadcastMutationsInvalidation('user-1', [m], [makeApplied(m.mutationId)]);
    }

    // Failures 1-9 show per-client warning with count
    expect(warnSpy).toHaveBeenCalledTimes(9);

    // 10th call: counter=9 → 9 < 10 so still per-client, counter becomes 10
    const m10 = makeMutation({ entityType: 'position', entityId: 'pos_cb_10' });
    broadcastMutationsInvalidation('user-1', [m10], [makeApplied(m10.mutationId)]);
    expect(warnSpy).toHaveBeenCalledTimes(10);
    expect(getFailureCount()).toBe(10);

    // 11th call: counter=10 ≥ 10 → circuit breaker trips
    const m11 = makeMutation({ entityType: 'position', entityId: 'pos_cb_11' });
    broadcastMutationsInvalidation('user-1', [m11], [makeApplied(m11.mutationId)]);
    expect(warnSpy).toHaveBeenCalledTimes(11);
    // 11th warn is circuit-breaker message
    expect(warnSpy.mock.calls[10][0]).toContain('[SyncBridge] Circuit breaker open');

    // 12th call — still open
    const m12 = makeMutation({ entityType: 'position', entityId: 'pos_cb_12' });
    broadcastMutationsInvalidation('user-1', [m12], [makeApplied(m12.mutationId)]);
    expect(warnSpy).toHaveBeenCalledTimes(12);
    expect(warnSpy.mock.calls[11][0]).toContain('[SyncBridge] Circuit breaker open');

    warnSpy.mockRestore();
  });

  // ──────────────── 17. Successful send resets failure counter ────────────────

  it('should reset failure counter on successful send (circuit closes)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const wss = makeFakeWSS();
    setWSS(wss as any);

    // Client that fails first, then succeeds
    const client = makeWSMock();
    mockClients.set(client, { userId: 'user-1' });
    wss.clients.add(client);

    let failCount = 0;
    (client as any).send = vi.fn(() => {
      failCount++;
      if (failCount <= 5) {
        throw new Error('Temporary failure');
      }
      // 6th call succeeds
    });

    // 5 failures
    for (let i = 0; i < 5; i++) {
      const m = makeMutation({ entityType: 'position', entityId: `pos_r_${i}` });
      broadcastMutationsInvalidation('user-1', [m], [makeApplied(m.mutationId)]);
    }
    expect(getFailureCount()).toBe(5);

    // 6th call — succeeds, resets counter
    const m6 = makeMutation({ entityType: 'position', entityId: 'pos_r_6' });
    broadcastMutationsInvalidation('user-1', [m6], [makeApplied(m6.mutationId)]);
    expect(getFailureCount()).toBe(0);

    // Counter is reset — next failure should start from 1 again
    (client as any).send = vi.fn(() => {
      throw new Error('Failed again');
    });
    const m7 = makeMutation({ entityType: 'position', entityId: 'pos_r_7' });
    broadcastMutationsInvalidation('user-1', [m7], [makeApplied(m7.mutationId)]);
    expect(getFailureCount()).toBe(1);

    warnSpy.mockRestore();
  });

  // ──────────────── 18. Counter resets across invalidation calls ──────────────

  it('should reset failure counter via resetFailureCounter()', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const wss = makeFakeWSS();
    setWSS(wss as any);

    const client = makeWSMock();
    mockClients.set(client, { userId: 'user-1' });
    wss.clients.add(client);
    (client as any).send = vi.fn(() => {
      throw new Error('Failed');
    });

    // 6 failures
    for (let i = 0; i < 6; i++) {
      const m = makeMutation({ entityType: 'position', entityId: `pos_rs_${i}` });
      broadcastMutationsInvalidation('user-1', [m], [makeApplied(m.mutationId)]);
    }
    expect(getFailureCount()).toBe(6);

    // Manual reset
    resetFailureCounter();
    expect(getFailureCount()).toBe(0);

    // Next failure starts fresh
    const m7 = makeMutation({ entityType: 'position', entityId: 'pos_rs_7' });
    broadcastMutationsInvalidation('user-1', [m7], [makeApplied(m7.mutationId)]);
    expect(getFailureCount()).toBe(1);

    warnSpy.mockRestore();
  });

  // ──────────────── 19. Circuit breaker is per-module (shared across calls) ───

  it('should accumulate failures across different invalidation calls and users', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const wss = makeFakeWSS();
    setWSS(wss as any);

    // Client A for user-1
    const clientA = makeWSMock();
    mockClients.set(clientA, { userId: 'user-1' });
    wss.clients.add(clientA);
    (clientA as any).send = vi.fn(() => {
      throw new Error('Client A failed');
    });

    // Client B for user-2
    const clientB = makeWSMock();
    mockClients.set(clientB, { userId: 'user-2' });
    wss.clients.add(clientB);
    (clientB as any).send = vi.fn(() => {
      throw new Error('Client B failed');
    });

    // 4 failures for user-1, 5 failures for user-2 = 9 total, circuit not yet open
    for (let i = 0; i < 4; i++) {
      const m = makeMutation({ entityType: 'position', entityId: `pos_a_${i}` });
      broadcastMutationsInvalidation('user-1', [m], [makeApplied(m.mutationId)]);
    }
    for (let i = 0; i < 5; i++) {
      const m = makeMutation({ entityType: 'position', entityId: `pos_b_${i}` });
      broadcastMutationsInvalidation('user-2', [m], [makeApplied(m.mutationId)]);
    }
    expect(getFailureCount()).toBe(9);

    // 10th failure: 9 < 10 so per-client, counter becomes 10
    const m10 = makeMutation({ entityType: 'position', entityId: 'pos_cb_10' });
    broadcastMutationsInvalidation('user-1', [m10], [makeApplied(m10.mutationId)]);
    expect(getFailureCount()).toBe(10);
    // 10th call still logs a per-client failure (not circuit-breaker)
    expect(warnSpy).toHaveBeenCalledTimes(10);

    // 11th failure: 10 ≥ 10 → circuit breaker trips
    const m11 = makeMutation({ entityType: 'position', entityId: 'pos_cb_11' });
    broadcastMutationsInvalidation('user-1', [m11], [makeApplied(m11.mutationId)]);
    expect(warnSpy).toHaveBeenCalledTimes(11);
    expect(warnSpy.mock.calls[10][0]).toContain('[SyncBridge] Circuit breaker open');

    warnSpy.mockRestore();
  });

  // ──────────────── 20. Normal operation with mixed success/failure ───────────

  it('should not trip circuit breaker with occasional success interspersed', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const wss = makeFakeWSS();
    setWSS(wss as any);

    // Client A: always fails
    const clientA = makeWSMock();
    mockClients.set(clientA, { userId: 'user-1' });
    wss.clients.add(clientA);
    (clientA as any).send = vi.fn(() => {
      throw new Error('Client A failed');
    });

    // Client B: always succeeds, resets counter
    const clientB = makeWSMock();
    mockClients.set(clientB, { userId: 'user-2' });
    wss.clients.add(clientB);
    spyOnSend(clientB);

    // Pattern: fail on A, succeed on B, fail on A, succeed on B — never reaches 10
    for (let i = 0; i < 15; i++) {
      const m1 = makeMutation({ entityType: 'position', entityId: `pos_ok_${i}` });
      broadcastMutationsInvalidation('user-1', [m1], [makeApplied(m1.mutationId)]);
      const m2 = makeMutation({ entityType: 'position', entityId: `pos_ok2_${i}` });
      broadcastMutationsInvalidation('user-2', [m2], [makeApplied(m2.mutationId)]);
    }

    // Counter should be 0 (always reset by user-2 successes)
    expect(getFailureCount()).toBe(0);

    // No circuit-breaker warnings
    const circuitBreakerCalls = warnSpy.mock.calls.filter(
      (c: any[]) => c[0] && c[0].includes && c[0].includes('Circuit breaker open'),
    );
    expect(circuitBreakerCalls).toHaveLength(0);

    warnSpy.mockRestore();
  });

  // ──────────────── 21. Multi-client — circuit breaker fires only once ────────

  it('should fire circuit breaker only once for a user with 3 connections', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const wss = makeFakeWSS();
    setWSS(wss as any);

    // ── Phase 1: push counter to exactly 10 with a single failing client ──
    // We use one client first so each invalidation call increments by 1.
    const client1 = makeWSMock();
    mockClients.set(client1, { userId: 'user-1' });
    wss.clients.add(client1);
    (client1 as any).send = vi.fn(() => { throw new Error('Fail'); });

    for (let i = 0; i < 10; i++) {
      const m = makeMutation({ entityType: 'position', entityId: `pos_p1_${i}` });
      broadcastMutationsInvalidation('user-1', [m], [makeApplied(m.mutationId)]);
    }

    expect(getFailureCount()).toBe(10);
    expect(warnSpy).toHaveBeenCalledTimes(10);
    // All 10 warns are per-client failure messages
    expect(warnSpy.mock.calls[0][0]).toContain('Failed to send');

    // ── Phase 2: add 2 more clients for the same user ──
    const client2 = makeWSMock();
    mockClients.set(client2, { userId: 'user-1' });
    wss.clients.add(client2);
    (client2 as any).send = vi.fn(() => { throw new Error('Fail'); });

    const client3 = makeWSMock();
    mockClients.set(client3, { userId: 'user-1' });
    wss.clients.add(client3);
    (client3 as any).send = vi.fn(() => { throw new Error('Fail'); });

    const allClients = [client1, client2, client3];

    // ── Phase 3: circuit is open — one more call ──
    // With the check before forEach, the bridge should return early with
    // a single circuit-breaker warning, NOT 3 (one per client).
    const m11 = makeMutation({ entityType: 'position', entityId: 'pos_mc_11' });
    broadcastMutationsInvalidation('user-1', [m11], [makeApplied(m11.mutationId)]);

    // Exactly 1 circuit-breaker warning (not 3)
    expect(warnSpy).toHaveBeenCalledTimes(11);
    expect(warnSpy.mock.calls[10][0]).toContain('[SyncBridge] Circuit breaker open');

    // None of the 3 clients received the payload (early return before forEach)
    for (const ws of allClients) {
      expect(getSentPayloads(ws)).toHaveLength(0);
    }

    // Counter unchanged (no send attempted)
    expect(getFailureCount()).toBe(10);

    warnSpy.mockRestore();
  });
});
