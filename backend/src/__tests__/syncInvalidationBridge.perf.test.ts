/**
 * ============================================================================
 * Toroloom Sync Invalidation Bridge — Performance Tests
 * ============================================================================
 *
 * Benchmarks broadcastMutationsInvalidation() at scale with mocked
 * WebSocket clients — 100, 500, 1 000 concurrent connections — and
 * measures how long the bridge takes to iterate its client set, check
 * user IDs, build the payload, and call ws.send().
 *
 * These tests use the same mock infrastructure as the unit tests
 * (vi.hoisted Maps, plain WSS objects, no real network) so the
 * measurement focuses on _the bridge's own logic_, not I/O.
 *
 * Scaling axes tested:
 *   - Client count:      100 / 500 / 1 000 / 2 000 concurrent connections
 *   - Mutation payload:  1 / 10 / 50 mutations per sync call
 *   - User isolation:    50 % target, 50 % other users (filters affected)
 *
 * Acceptable thresholds (all well within Node.js event-loop budget):
 *   - 100  clients +  1 mutation  → < 20 ms
 *   - 500  clients + 10 mutations → < 50 ms
 *   - 1 000 clients + 10 mutations → < 100 ms
 *   - 2 000 clients + 50 mutations → < 250 ms
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/syncInvalidationBridge.perf.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ──── Mock Infrastructure (identical to unit tests) ─────────────────────────

const sentPayloads = vi.hoisted(() => new Map<{ readyState: number }, string[]>());
const mockClients = vi.hoisted(() => new Map<{ readyState: number }, { userId: string }>());

vi.mock('ws', () => ({ WebSocket: { OPEN: 1 } }));
vi.mock('../websocket/state', () => ({ clients: mockClients }));
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

import { setWSS, broadcastMutationsInvalidation } from '../services/syncInvalidationBridge';

// ──── Helpers ───────────────────────────────────────────────────────────────

type Mutation = { entityType: string; entityId: string | null; mutationId: string };
type Applied = { mutationId: string };

let nextId = 1;

function makeFakeWSS() {
  return { clients: new Set<{ readyState: number }>() };
}

function makeWSMockReadyState(state: number): { readyState: number } {
  return { readyState: state };
}

/**
 * Seed a fake WSS with `count` clients.  An optional `userId` prefix lets
 * us split clients across multiple users for the isolation benchmark.
 * Returns an array of the created clients for optional assertion.
 *
 * Each mock client gets a `send` spy so the bridge can call ws.send(payload)
 * without throwing.  The spy pushes the raw payload string into the
 * sentPayloads Map for later inspection.
 */
function seedClients(
  wss: { clients: Set<{ readyState: number }> },
  count: number,
  userIdPrefix = 'perf-user',
  openRatio = 1.0,    // fraction of clients that are OPEN
): { readyState: number }[] {
  const clients: { readyState: number }[] = [];
  for (let i = 0; i < count; i++) {
    const state = Math.random() < openRatio ? 1 : 3; // OPEN or CLOSED
    const ws = makeWSMockReadyState(state);
    const userId = `${userIdPrefix}-${Math.floor(i / 10)}`; // 10 clients per sub-user
    mockClients.set(ws, { userId });
    wss.clients.add(ws);
    sentPayloads.set(ws, []);
    // Add a send spy so bridge's ws.send(payload) call doesn't throw
    (ws as any).send = vi.fn((payload: string) => {
      const arr = sentPayloads.get(ws);
      if (arr) arr.push(payload);
    });
    clients.push(ws);
  }
  return clients;
}

/**
 * Build a mutations array of `count` entries, all for `entityType`.
 * Half are "applied" to exercise the appliedIds Set lookup.
 */
function buildMutations(count: number, entityType = 'position'): {
  mutations: Mutation[];
  applied: Applied[];
} {
  const mutations: Mutation[] = [];
  const applied: Applied[] = [];
  for (let i = 0; i < count; i++) {
    const mid = `perf-mut-${nextId++}`;
    mutations.push({
      entityType,
      entityId: `perf-${entityType}-${nextId++}`,
      mutationId: mid,
    });
    // Every other mutation is "applied" to simulate a realistic mix
    if (i % 2 === 0) {
      applied.push({ mutationId: mid });
    }
  }
  return { mutations, applied };
}

/** Measure the wall-clock time (in ms) for `fn` to complete. */
function measure(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

// ──── Per-test reset ────────────────────────────────────────────────────────

beforeEach(() => {
  sentPayloads.clear();
  mockClients.clear();
});

// ============================================================================
// Benchmarks
// ============================================================================

describe('broadcastMutationsInvalidation — performance', () => {
  // Suppress console.log noise during benchmarks
  const noopLog = vi.spyOn(console, 'log').mockImplementation(() => {});

  afterAll(() => {
    noopLog.mockRestore();
  });

  // ──────────────── 100 clients ─────────────────────────────────────────────

  it('should complete in < 20 ms for 100 clients + 1 mutation', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);
    seedClients(wss, 100, 'perf-user');

    const { mutations, applied } = buildMutations(1);

    const elapsed = measure(() => {
      broadcastMutationsInvalidation('perf-user-0', mutations, applied);
    });

    expect(elapsed).toBeLessThan(20);
  });

  it('should complete in < 20 ms for 100 clients + 10 mutations', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);
    seedClients(wss, 100, 'perf-user');

    const { mutations, applied } = buildMutations(10);

    const elapsed = measure(() => {
      broadcastMutationsInvalidation('perf-user-0', mutations, applied);
    });

    expect(elapsed).toBeLessThan(20);
  });

  // ──────────────── 500 clients ─────────────────────────────────────────────

  it('should complete in < 50 ms for 500 clients + 1 mutation', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);
    seedClients(wss, 500, 'perf-user');

    const { mutations, applied } = buildMutations(1);

    const elapsed = measure(() => {
      broadcastMutationsInvalidation('perf-user-0', mutations, applied);
    });

    expect(elapsed).toBeLessThan(50);
  });

  it('should complete in < 50 ms for 500 clients + 10 mutations', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);
    seedClients(wss, 500, 'perf-user');

    const { mutations, applied } = buildMutations(10);

    const elapsed = measure(() => {
      broadcastMutationsInvalidation('perf-user-0', mutations, applied);
    });

    expect(elapsed).toBeLessThan(50);
  });

  it('should complete in < 50 ms for 500 clients + 50 mutations', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);
    seedClients(wss, 500, 'perf-user');

    const { mutations, applied } = buildMutations(50);

    const elapsed = measure(() => {
      broadcastMutationsInvalidation('perf-user-0', mutations, applied);
    });

    expect(elapsed).toBeLessThan(50);
  });

  // ──────────────── 1 000 clients ───────────────────────────────────────────

  it('should complete in < 100 ms for 1 000 clients + 1 mutation', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);
    seedClients(wss, 1_000, 'perf-user');

    const { mutations, applied } = buildMutations(1);

    const elapsed = measure(() => {
      broadcastMutationsInvalidation('perf-user-0', mutations, applied);
    });

    expect(elapsed).toBeLessThan(100);
  });

  it('should complete in < 100 ms for 1 000 clients + 10 mutations', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);
    seedClients(wss, 1_000, 'perf-user');

    const { mutations, applied } = buildMutations(10);

    const elapsed = measure(() => {
      broadcastMutationsInvalidation('perf-user-0', mutations, applied);
    });

    expect(elapsed).toBeLessThan(100);
  });

  it('should complete in < 100 ms for 1 000 clients + 50 mutations', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);
    seedClients(wss, 1_000, 'perf-user');

    const { mutations, applied } = buildMutations(50);

    const elapsed = measure(() => {
      broadcastMutationsInvalidation('perf-user-0', mutations, applied);
    });

    expect(elapsed).toBeLessThan(100);
  });

  // ──────────────── 2 000 clients ───────────────────────────────────────────

  it('should complete in < 250 ms for 2 000 clients + 10 mutations', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);
    seedClients(wss, 2_000, 'perf-user');

    const { mutations, applied } = buildMutations(10);

    const elapsed = measure(() => {
      broadcastMutationsInvalidation('perf-user-0', mutations, applied);
    });

    expect(elapsed).toBeLessThan(250);
  });

  it('should complete in < 250 ms for 2 000 clients + 50 mutations', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);
    seedClients(wss, 2_000, 'perf-user');

    const { mutations, applied } = buildMutations(50);

    const elapsed = measure(() => {
      broadcastMutationsInvalidation('perf-user-0', mutations, applied);
    });

    expect(elapsed).toBeLessThan(250);
  });

  // ──────────────── User isolation at scale ─────────────────────────────────

  it('should only notify the target user among 1 000 mixed clients', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);

    // 500 clients for user-0-*, 500 for user-1-*
    seedClients(wss, 500, 'user-0');
    seedClients(wss, 500, 'user-1');

    const { mutations, applied } = buildMutations(5);

    const elapsed = measure(() => {
      broadcastMutationsInvalidation('user-0-0', mutations, applied);
    });

    // Should still be fast even with 1 000 clients to iterate
    expect(elapsed).toBeLessThan(100);

    // Verify that only user-0-0's 10 clients received the message
    let totalSentCalls = 0;
    for (const [ws, payloads] of sentPayloads) {
      const client = mockClients.get(ws);
      totalSentCalls += payloads.length;
      if (client?.userId === 'user-0-0') {
        expect(payloads).toHaveLength(1); // received the invalidation
      } else {
        expect(payloads).toHaveLength(0); // did NOT receive
      }
    }

    // Exactly 10 clients belong to user-0-0 (10 per sub-user in seedClients)
    expect(totalSentCalls).toBe(10);
  });

  // ──────────────── Mixed OPEN / non-OPEN at scale ──────────────────────────

  it('should only send to OPEN clients among 1 000 connections', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);

    // 1 000 clients, all under the same user 'perf-target'
    // (10 clients × 100 sub-users → only 'perf-target' receives)
    seedClients(wss, 1_000, 'perf', 0.8); // 80 % OPEN

    const { mutations, applied } = buildMutations(3);

    // 'perf-0' is the first sub-user — it has exactly 10 clients
    broadcastMutationsInvalidation('perf-0', mutations, applied);

    // Count how many actual ws.send() calls were made
    let openSentCount = 0;
    let closedSentCount = 0;
    for (const [ws, payloads] of sentPayloads) {
      if (payloads.length > 0) {
        if (ws.readyState === 1) openSentCount++;
        else closedSentCount++;
      }
    }

    // All sent invocations should be to OPEN clients only
    expect(closedSentCount).toBe(0);
    // 'perf-0' has exactly 10 clients; ~80 % should be OPEN
    expect(openSentCount).toBeGreaterThanOrEqual(5);
    expect(openSentCount).toBeLessThanOrEqual(10);
  });

  // ──────────────── Consecutive calls (no memory leak) ──────────────────────

  it('should handle 100 consecutive invalidation calls without slowdown', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);
    seedClients(wss, 500, 'perf-user');

    // Warm-up: one call to let the JIT compiler optimise before we start
    // measuring.  The first call is often 2-3x slower than subsequent ones.
    {
      const wu = buildMutations(3);
      broadcastMutationsInvalidation('perf-user-0', wu.mutations, wu.applied);
    }

    const timings: number[] = [];
    for (let i = 0; i < 100; i++) {
      const { mutations, applied } = buildMutations(3);
      const elapsed = measure(() => {
        broadcastMutationsInvalidation('perf-user-0', mutations, applied);
      });
      timings.push(elapsed);
    }

    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
    const max = Math.max(...timings);

    // Average should be well under 50 ms, and max under 200 ms
    expect(avg).toBeLessThan(50);
    expect(max).toBeLessThan(200);

    // No individual call should be an extreme outlier (more than 3x the median).
    // Floor the threshold at 10 ms to absorb minor GC/context-switch jitter
    // on shared CI runners.
    // Allow up to 2 outliers out of 100 — accounts for rare OS scheduling
    // interruptions without undermining the test's value.
    const sorted = [...timings].sort((a, b) => a - b);
    const median = sorted[50];
    const threshold = Math.max(median * 3, 10);
    const outliers = timings.filter((t) => t > threshold);
    expect(outliers.length).toBeLessThanOrEqual(2);
  });

  // ──────────────── Payload size impact ─────────────────────────────────────

  it('should handle 50 mutations with 1 000 clients efficiently', () => {
    const wss = makeFakeWSS();
    setWSS(wss as any);
    seedClients(wss, 1_000, 'perf-user');

    // All 50 mutations are applied and have entityIds — worst case for payload
    // size and iteration
    const mutations: Mutation[] = [];
    const applied: Applied[] = [];
    for (let i = 0; i < 50; i++) {
      const mid = `perf-heavy-${nextId++}`;
      mutations.push({
        entityType: i % 3 === 0 ? 'position' : i % 3 === 1 ? 'order' : 'watchlist',
        entityId: `perf-heavy-id-${nextId++}`,
        mutationId: mid,
      });
      applied.push({ mutationId: mid });
    }

    const elapsed = measure(() => {
      broadcastMutationsInvalidation('perf-user-0', mutations, applied);
    });

    // JSON.stringify on a 50-entry array + iteration of 1 000 clients
    expect(elapsed).toBeLessThan(150);

    // Verify the first client received a payload with all 3 namespaces
    const firstClient = [...wss.clients][0];
    const payloads = sentPayloads.get(firstClient) ?? [];
    expect(payloads).toHaveLength(1);
    const parsed = JSON.parse(payloads[0]);
    expect(parsed.data.entities).toHaveLength(50);
    expect(parsed.data.namespaces).toContain('portfolio');
    expect(parsed.data.namespaces).toContain('openOrders');
    expect(parsed.data.namespaces).toContain('watchlist');
  });
});
