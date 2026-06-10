/**
 * ============================================================================
 * Toroloom Broker State Persistence — PostgreSQL Integration
 * ============================================================================
 *
 * Validates broker failover state and dedup cache persistence against
 * PostgreSQL. These tests go beyond the basic round-trip test in
 * storagePostgres.int.test.ts by verifying:
 *
 *   1. Broker type transitions (failover: zerodha -> angel -> mock)
 *   2. Dedup cache with multiple broker types simultaneously
 *   3. State overwrite / update semantics
 *   4. Persistence across independent storage instances (crash recovery)
 *   5. Empty state returns defaults
 *
 * The broker state stored as a single JSONB document in the broker_state
 * table, keyed by 'broker_state'. This design means an upsert always
 * replaces the entire document — there's no partial update.
 *
 * Environment:
 *   DATABASE_URL — defaults to Docker Compose connection string
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/brokerState.postgres.int.test.ts
 *
 * Skip:
 *   Tests skip automatically if PostgreSQL is unreachable.
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSQLStorage } from '../services/storage/postgres';
import type { BrokerStateData } from '../services/storage/types';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://toroloom:toroloom_dev@localhost:5432/toroloom';

describe('Broker State Persistence — PostgreSQL', () => {
  let storage: PostgreSQLStorage;
  let available = true;

  beforeAll(async () => {
    storage = new PostgreSQLStorage(DATABASE_URL);
    try {
      await Promise.race([
        storage.connect(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('connect timeout (5s)')), 5_000),
        ),
      ]);
    } catch (err: any) {
      console.warn(
        `⚠ PostgreSQL not available (${err.message}) — skipping Broker State + PG integration tests`,
      );
      available = false;
    }
  }, 10_000);

  afterAll(async () => {
    if (available && storage) {
      await storage.clearForTesting();
      await storage.disconnect();
    }
  });

  beforeEach(async () => {
    if (!available) return;
    // Start each test with a clean slate
    await storage.clearForTesting();
  });

  // ──────────────── 1. Empty State ────────────────

  it('should return default empty state when nothing has been persisted', async () => {
    if (!available) return;

    const state = await storage.loadBrokerState();
    expect(state.currentBrokerType).toBeNull();
    expect(state.dedupCache).toEqual({});
  });

  // ──────────────── 2. Basic Round-Trip ────────────────

  it('should persist and load a broker state with a single dedup entry', async () => {
    if (!available) return;

    const state: BrokerStateData = {
      currentBrokerType: 'zerodha',
      dedupCache: {
        zerodha: { lastEvent: 'BROKER_CONNECTED', timestamp: 100_000 },
      },
    };

    await storage.saveBrokerState(state);
    const loaded = await storage.loadBrokerState();
    expect(loaded.currentBrokerType).toBe('zerodha');
    expect(loaded.dedupCache.zerodha.lastEvent).toBe('BROKER_CONNECTED');
    expect(loaded.dedupCache.zerodha.timestamp).toBe(100_000);
  });

  // ──────────────── 3. Multiple Broker Types in Dedup Cache ────────────────

  it('should persist dedup cache with multiple broker types', async () => {
    if (!available) return;

    const state: BrokerStateData = {
      currentBrokerType: 'angel',
      dedupCache: {
        zerodha: { lastEvent: 'BROKER_DISCONNECTED', timestamp: 1_000 },
        angel: { lastEvent: 'BROKER_CONNECTED', timestamp: 2_000 },
        mock: { lastEvent: 'BROKER_DISCONNECTED', timestamp: 3_000 },
      },
    };

    await storage.saveBrokerState(state);
    const loaded = await storage.loadBrokerState();
    expect(loaded.currentBrokerType).toBe('angel');
    expect(loaded.dedupCache.zerodha.lastEvent).toBe('BROKER_DISCONNECTED');
    expect(loaded.dedupCache.angel.lastEvent).toBe('BROKER_CONNECTED');
    expect(loaded.dedupCache.mock.lastEvent).toBe('BROKER_DISCONNECTED');
    expect(Object.keys(loaded.dedupCache).length).toBe(3);
  });

  // ──────────────── 4. Failover State Transition ────────────────

  it('should persist broker failover transition from zerodha to angel to mock', async () => {
    if (!available) return;

    // Phase 1: Start with zerodha
    await storage.saveBrokerState({
      currentBrokerType: 'zerodha',
      dedupCache: {
        zerodha: { lastEvent: 'BROKER_CONNECTED', timestamp: 10 },
      },
    });
    let loaded = await storage.loadBrokerState();
    expect(loaded.currentBrokerType).toBe('zerodha');

    // Phase 2: Failover to angel (zerodha disconnected, angel connected)
    await storage.saveBrokerState({
      currentBrokerType: 'angel',
      dedupCache: {
        zerodha: { lastEvent: 'BROKER_DISCONNECTED', timestamp: 20 },
        angel: { lastEvent: 'BROKER_CONNECTED', timestamp: 30 },
      },
    });
    loaded = await storage.loadBrokerState();
    expect(loaded.currentBrokerType).toBe('angel');
    expect(loaded.dedupCache.zerodha.lastEvent).toBe('BROKER_DISCONNECTED');
    expect(loaded.dedupCache.angel.lastEvent).toBe('BROKER_CONNECTED');

    // Phase 3: Failover to mock (angel disconnects too)
    await storage.saveBrokerState({
      currentBrokerType: 'mock',
      dedupCache: {
        zerodha: { lastEvent: 'BROKER_DISCONNECTED', timestamp: 20 },
        angel: { lastEvent: 'BROKER_DISCONNECTED', timestamp: 40 },
        mock: { lastEvent: 'BROKER_CONNECTED', timestamp: 50 },
      },
    });
    loaded = await storage.loadBrokerState();
    expect(loaded.currentBrokerType).toBe('mock');
    expect(loaded.dedupCache.angel.lastEvent).toBe('BROKER_DISCONNECTED');
    expect(loaded.dedupCache.mock.lastEvent).toBe('BROKER_CONNECTED');
    // Zerodha entry should still be intact from phase 2
    expect(loaded.dedupCache.zerodha.lastEvent).toBe('BROKER_DISCONNECTED');
    expect(Object.keys(loaded.dedupCache).length).toBe(3);
  });

  // ──────────────── 5. State Overwrite / Update ────────────────

  it('should completely replace broker state on save (upsert overwrites entire document)', async () => {
    if (!available) return;

    // Save initial state with all three brokers
    await storage.saveBrokerState({
      currentBrokerType: 'zerodha',
      dedupCache: {
        zerodha: { lastEvent: 'BROKER_CONNECTED', timestamp: 10 },
        angel: { lastEvent: 'BROKER_CONNECTED', timestamp: 20 },
        mock: { lastEvent: 'BROKER_DISCONNECTED', timestamp: 30 },
      },
    });

    // Overwrite with a minimal state — only zerodha
    await storage.saveBrokerState({
      currentBrokerType: 'zerodha',
      dedupCache: {
        zerodha: { lastEvent: 'BROKER_DISCONNECTED', timestamp: 40 },
      },
    });

    const loaded = await storage.loadBrokerState();
    expect(loaded.currentBrokerType).toBe('zerodha');
    // Only zerodha should remain — angel and mock were wiped by the full document replacement
    expect(Object.keys(loaded.dedupCache)).toEqual(['zerodha']);
    expect(loaded.dedupCache.zerodha.lastEvent).toBe('BROKER_DISCONNECTED');
    expect(loaded.dedupCache.zerodha.timestamp).toBe(40);
  });

  // ──────────────── 6. Persistence Across Independent Instances ────────────────

  it('should survive a simulated crash/restart via independent storage instance', async () => {
    if (!available) return;

    // Instance 1: Save broker state
    const storage1 = new PostgreSQLStorage(DATABASE_URL);
    await storage1.connect();
    await storage1.saveBrokerState({
      currentBrokerType: 'angel',
      dedupCache: {
        angel: { lastEvent: 'BROKER_CONNECTED', timestamp: 555 },
        zerodha: { lastEvent: 'BROKER_DISCONNECTED', timestamp: 444 },
      },
    });
    await storage1.disconnect();

    // Instance 2: Load the state (simulates server restart)
    const storage2 = new PostgreSQLStorage(DATABASE_URL);
    await storage2.connect();
    const loaded = await storage2.loadBrokerState();
    expect(loaded.currentBrokerType).toBe('angel');
    expect(loaded.dedupCache.angel.lastEvent).toBe('BROKER_CONNECTED');
    expect(loaded.dedupCache.angel.timestamp).toBe(555);
    expect(loaded.dedupCache.zerodha.lastEvent).toBe('BROKER_DISCONNECTED');
    await storage2.disconnect();
  });

  // ──────────────── 7. Timestamp Precision ────────────────

  it('should preserve dedup cache timestamps with millisecond precision', async () => {
    if (!available) return;

    const timestamps = {
      zerodha: Date.now(),
      angel: Date.now() + 1,
      mock: Date.now() + 2,
    };

    await storage.saveBrokerState({
      currentBrokerType: 'zerodha',
      dedupCache: {
        zerodha: { lastEvent: 'BROKER_CONNECTED', timestamp: timestamps.zerodha },
        angel: { lastEvent: 'BROKER_DISCONNECTED', timestamp: timestamps.angel },
        mock: { lastEvent: 'BROKER_CONNECTED', timestamp: timestamps.mock },
      },
    });

    const loaded = await storage.loadBrokerState();
    expect(loaded.dedupCache.zerodha.timestamp).toBe(timestamps.zerodha);
    expect(loaded.dedupCache.angel.timestamp).toBe(timestamps.angel);
    expect(loaded.dedupCache.mock.timestamp).toBe(timestamps.mock);
  });
});
