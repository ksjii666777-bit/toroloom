/**
 * ============================================================================
 * Toroloom Broker Factory Flow — PostgreSQL Integration
 * ============================================================================
 *
 * Validates the full broker factory lifecycle against a real PostgreSQL
 * database:
 *
 *   1. configureBrokerPersistence()     — wire storage into the broker module
 *   2. loadBrokerStateFromStorage()     — restore state from DB on startup
 *   3. getBroker()                      — authenticate & implicitly persist
 *   4. persistBrokerState() (internal)  — called by getBroker() on auth
 *
 * Unlike brokerState.*.int.test.ts (which tests the StorageEngine layer
 * directly), this file tests the APPLICATION-LAYER integration — the broker
 * factory module's internal singleton functions that call storage behind the
 * scenes.
 *
 * Environment:
 *   DATABASE_URL — defaults to Docker Compose connection string
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/brokerFactoryFlow.postgres.int.test.ts
 *
 * Skip:
 *   Tests skip automatically if PostgreSQL is unreachable.
 * ============================================================================
 */

// Force the broker env to use MockBroker so getBroker() authenticates
// without real API credentials.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

vi.mock('../config/env', () => ({
  env: {
    broker: 'mock',
    isMock: true,
    zerodha: { apiKey: '', apiSecret: '', accessToken: '' },
    angel: { apiKey: '', clientId: '', accessToken: '' },
    groww: { apiKey: '', accessToken: '' },
  },
}));

import { PostgreSQLStorage } from '../services/storage/postgres';
import {
  configureBrokerPersistence,
  loadBrokerStateFromStorage,
  getBroker,
  resetBroker,
  getCurrentBrokerType,
  getBrokerDeduplicationState,
} from '../services/broker';
import { getCircuitBreaker, circuitRegistry, CircuitState } from '../services/circuitBreaker';
import { auditTrail } from '../services/auditTrail';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://toroloom:toroloom_dev@localhost:5432/toroloom';

describe('Broker Factory Flow — PostgreSQL', () => {
  let storage: PostgreSQLStorage;
  let available = true;

  beforeAll(async () => {
    storage = new PostgreSQLStorage(DATABASE_URL);
    try {
      await Promise.race([
        storage.connect(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('connect timeout (15s)')), 15_000),
        ),
      ]);
    } catch (err: any) {
      console.warn(
        `⚠ PostgreSQL not available (${err.message}) — skipping Broker Factory Flow + PG integration tests`,
      );
      available = false;
    }
  }, 30_000);

  afterAll(async () => {
    if (available && storage) {
      await storage.clearForTesting();
      await storage.disconnect();
    }
  });

  beforeEach(async () => {
    if (!available) return;
    await storage.clearForTesting();
    resetBroker();
    circuitRegistry.resetAll();
    await auditTrail._clearForTesting();
  });

  // ──────────────── 1. Configure + Load Empty State ────────────────

  it('should configure persistence and load empty state without error', async () => {
    if (!available) return;

    configureBrokerPersistence(storage);
    await loadBrokerStateFromStorage();

    // Nothing was persisted, so currentBrokerType should be null
    expect(getCurrentBrokerType()).toBeNull();

    // Dedup cache should also be empty
    const state = getBrokerDeduplicationState();
    expect(state.size).toBe(0);
  });

  // ──────────────── 2. getBroker() Persists State to DB ────────────────

  it('should persist broker state to DB after getBroker() succeeds', async () => {
    if (!available) return;

    configureBrokerPersistence(storage);
    await loadBrokerStateFromStorage();

    // Authenticate — MockBroker will succeed (env.broker = 'mock')
    const broker = await getBroker();
    expect(broker.isConnected()).toBe(true);
    expect(getCurrentBrokerType()).toBe('mock');

    // Verify the state was persisted to the database
    const persisted = await storage.loadBrokerState();
    expect(persisted.currentBrokerType).toBe('mock');
    expect(Object.keys(persisted.dedupCache)).toEqual(['mock']);
    expect(persisted.dedupCache.mock.lastEvent).toBe('BROKER_CONNECTED');
    expect(typeof persisted.dedupCache.mock.timestamp).toBe('number');
  });

  // ──────────────── 3. Load Persisted State After Simulated Restart ────────────────

  it('should restore state from DB via loadBrokerStateFromStorage() after simulated crash', async () => {
    if (!available) return;

    // ---------- Phase 1: Bootstrap state into the DB ----------
    configureBrokerPersistence(storage);
    await loadBrokerStateFromStorage();
    await getBroker(); // This persists 'mock' + BROKER_CONNECTED to DB

    // ---------- Phase 2: Simulate server restart ----------
    resetBroker(); // Wipes in-memory brokerInstance, currentBrokerType, brokerStateCache
    expect(getCurrentBrokerType()).toBeNull();
    expect(getBrokerDeduplicationState().size).toBe(0);

    // ---------- Phase 3: Restore from DB ----------
    await loadBrokerStateFromStorage();

    expect(getCurrentBrokerType()).toBe('mock');
    const restoredCache = getBrokerDeduplicationState();
    expect(restoredCache.get('mock')).toBeDefined();
    expect(restoredCache.get('mock')!.lastEvent).toBe('BROKER_CONNECTED');
  });

  // ──────────────── 4. Re-Authentication Updates Persisted State ────────────────

  it('should update persisted state when getBroker() is called again after reset', async () => {
    if (!available) return;

    // ---------- Phase 1: Bootstrap ----------
    configureBrokerPersistence(storage);
    await loadBrokerStateFromStorage();
    await getBroker();

    const persistedAfterFirst = await storage.loadBrokerState();
    expect(persistedAfterFirst.currentBrokerType).toBe('mock');

    // ---------- Phase 2: Reset and re-authenticate ----------
    resetBroker();
    await loadBrokerStateFromStorage(); // Restores currentBrokerType from DB

    // getBroker() will re-authenticate and call persistBrokerState()
    const broker = await getBroker();
    expect(broker.isConnected()).toBe(true);

    const persistedAfterSecond = await storage.loadBrokerState();
    expect(persistedAfterSecond.currentBrokerType).toBe('mock');
    expect(persistedAfterSecond.dedupCache.mock.lastEvent).toBe('BROKER_CONNECTED');
    // Timestamp should be newer (or equal) to the first persistence
    expect(persistedAfterSecond.dedupCache.mock.timestamp).toBeGreaterThanOrEqual(
      persistedAfterFirst.dedupCache.mock.timestamp,
    );
  });

  // ──────────────── 5. Circuit OPEN → Persisted DISCONNECTED ────────────────

  it('should persist BROKER_DISCONNECTED to DB when the broker circuit is OPEN', async () => {
    if (!available) return;

    configureBrokerPersistence(storage);
    await loadBrokerStateFromStorage();

    // Trip the mock broker's circuit breaker (failureThreshold=3)
    const mockCircuit = getCircuitBreaker('broker-mock');
    await mockCircuit.recordFailure();
    await mockCircuit.recordFailure();
    await mockCircuit.recordFailure();
    expect(mockCircuit.snapshot().state).toBe(CircuitState.OPEN);

    // All brokers unavailable — the only broker (mock) has an open circuit
    await expect(getBroker()).rejects.toThrow('All brokers unavailable');

    // currentBrokerType should remain null (no broker succeeded)
    expect(getCurrentBrokerType()).toBeNull();

    // Verify persisted state shows the disconnection
    const persisted = await storage.loadBrokerState();
    expect(persisted.currentBrokerType).toBeNull();
    expect(persisted.dedupCache.mock).toBeDefined();
    expect(persisted.dedupCache.mock.lastEvent).toBe('BROKER_DISCONNECTED');
    expect(typeof persisted.dedupCache.mock.timestamp).toBe('number');
  });

  // ──────────────── 6. Circuit Recovery → Reconnection Persists CONNECTED ────────────────

  it('should persist BROKER_CONNECTED to DB after circuit recovers from OPEN', async () => {
    if (!available) return;

    configureBrokerPersistence(storage);
    await loadBrokerStateFromStorage();

    // Phase 1: Trip the circuit
    const mockCircuit = getCircuitBreaker('broker-mock');
    await mockCircuit.recordFailure();
    await mockCircuit.recordFailure();
    await mockCircuit.recordFailure();
    expect(mockCircuit.snapshot().state).toBe(CircuitState.OPEN);

    await expect(getBroker()).rejects.toThrow('All brokers unavailable');

    // Phase 2: Reset the circuit (simulating timeout → HALF_OPEN → recovery)
    mockCircuit.reset();
    expect(mockCircuit.snapshot().state).toBe(CircuitState.CLOSED);

    // Phase 3: Reconnect — should succeed now
    const broker = await getBroker();
    expect(broker.isConnected()).toBe(true);
    expect(getCurrentBrokerType()).toBe('mock');

    // Verify persisted state updated
    const persisted = await storage.loadBrokerState();
    expect(persisted.currentBrokerType).toBe('mock');
    expect(persisted.dedupCache.mock.lastEvent).toBe('BROKER_CONNECTED');
  });

  // ──────────────── 7. Dedup Suppresses Duplicate DISCONNECTED Audit Events ────────────────

  it('should suppress duplicate BROKER_DISCONNECTED audit events when circuit stays OPEN', async () => {
    if (!available) return;

    configureBrokerPersistence(storage);
    await loadBrokerStateFromStorage();
    await auditTrail._clearForTesting();

    // Trip the circuit
    const mockCircuit = getCircuitBreaker('broker-mock');
    await mockCircuit.recordFailure();
    await mockCircuit.recordFailure();
    await mockCircuit.recordFailure();

    // First call → logs BROKER_DISCONNECTED
    await expect(getBroker()).rejects.toThrow('All brokers unavailable');

    const disconnectedAfterFirst = await auditTrail.getEvents({ eventType: 'BROKER_DISCONNECTED' });
    expect(disconnectedAfterFirst).toHaveLength(1);
    expect(disconnectedAfterFirst[0].data.brokerType).toBe('mock');

    // Second call → dedup should suppress another BROKER_DISCONNECTED
    await expect(getBroker()).rejects.toThrow('All brokers unavailable');

    const disconnectedAfterSecond = await auditTrail.getEvents({ eventType: 'BROKER_DISCONNECTED' });
    expect(disconnectedAfterSecond).toHaveLength(1); // Still 1 — duplicate suppressed
  });

  // ──────────────── 8. Full Cycle: CONNECTED → DISCONNECTED → CONNECTED ────────────────

  it('should persist the full CONNECTED → DISCONNECTED → CONNECTED cycle correctly', async () => {
    if (!available) return;

    configureBrokerPersistence(storage);
    await loadBrokerStateFromStorage();
    await auditTrail._clearForTesting();

    // Phase 1: Connect → CONNECTED persisted
    await getBroker();
    let persisted = await storage.loadBrokerState();
    expect(persisted.currentBrokerType).toBe('mock');
    expect(persisted.dedupCache.mock.lastEvent).toBe('BROKER_CONNECTED');

    // Phase 2: Trip circuit → DISCONNECTED persisted
    // NOTE: Must reset broker before tripping, otherwise getBroker() short-circuits
    // via the cached brokerInstance.isConnected() and never reaches the circuit breaker.
    resetBroker();
    await loadBrokerStateFromStorage(); // Restore currentBrokerType + brokerStateCache from DB
    const mockCircuit = getCircuitBreaker('broker-mock');
    await mockCircuit.recordFailure();
    await mockCircuit.recordFailure();
    await mockCircuit.recordFailure();
    await expect(getBroker()).rejects.toThrow('All brokers unavailable');

    persisted = await storage.loadBrokerState();
    expect(persisted.dedupCache.mock.lastEvent).toBe('BROKER_DISCONNECTED');
    // currentBrokerType should still be 'mock' (last successful broker)
    expect(persisted.currentBrokerType).toBe('mock');

    // Phase 3: Reset circuit → CONNECTED again
    mockCircuit.reset();
    await getBroker();

    persisted = await storage.loadBrokerState();
    expect(persisted.currentBrokerType).toBe('mock');
    expect(persisted.dedupCache.mock.lastEvent).toBe('BROKER_CONNECTED');

    // Verify audit trail has the right sequence
    const allEvents = await auditTrail.getEvents();
    const connectedEvents = allEvents.filter((e) => e.eventType === 'BROKER_CONNECTED');
    const disconnectedEvents = allEvents.filter((e) => e.eventType === 'BROKER_DISCONNECTED');
    expect(connectedEvents).toHaveLength(2); // First + second connection
    expect(disconnectedEvents).toHaveLength(1); // One disconnection in between
  });

  // ──────────────── 9. All Brokers Unavailable Error ────────────────

  it('should include circuit states in the error when all brokers are unavailable', async () => {
    if (!available) return;

    configureBrokerPersistence(storage);
    await loadBrokerStateFromStorage();

    // Trip the mock circuit
    const mockCircuit = getCircuitBreaker('broker-mock');
    await mockCircuit.recordFailure();
    await mockCircuit.recordFailure();
    await mockCircuit.recordFailure();
    expect(mockCircuit.snapshot().state).toBe(CircuitState.OPEN);

    try {
      await getBroker();
      expect.unreachable('Should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('All brokers unavailable');
      // The error should name the broker and its circuit state
      expect(error.message).toContain('mock=OPEN');
    }
  });
});
