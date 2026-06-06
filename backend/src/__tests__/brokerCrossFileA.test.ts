/**
 * ============================================================================
 * Toroloom — Cross-File Isolation Test: Broker State File A
 * ============================================================================
 *
 * Populates the broker module's singleton state (brokerInstance,
 * currentBrokerType, brokerStateCache, circuit breakers), then calls
 * resetBroker() + circuitRegistry.resetAll() + auditTrail._clearForTesting()
 * in afterAll.
 *
 * If the cleanup is missing or broken, File B will inherit File A's broker
 * state — finding a connected broker instance, stale currentBrokerType, or
 * cached dedup entries — causing its assertions to fail.
 *
 * Run with File B in the same vitest process:
 *   npx vitest run --config vitest.cross-file.config.ts \
 *     src/__tests__/brokerCrossFileA.test.ts \
 *     src/__tests__/brokerCrossFileB.test.ts
 *
 * Environment:
 *   Uses MockBroker (env mocked below). No DB required.
 * ============================================================================
 */

import { describe, it, expect, afterAll, vi } from 'vitest';

vi.mock('../config/env', () => ({
  env: {
    broker: 'mock',
    isMock: true,
    zerodha: { apiKey: '', apiSecret: '', accessToken: '' },
    angel: { apiKey: '', clientId: '', accessToken: '' },
    groww: { apiKey: '', accessToken: '' },
  },
}));

import {
  getBroker,
  getCurrentBrokerType,
  getBrokerDeduplicationState,
  resetBroker,
  configureBrokerPersistence,
  loadBrokerStateFromStorage,
} from '../services/broker';
import { circuitRegistry } from '../services/circuitBreaker';
import { auditTrail } from '../services/auditTrail';
import { InMemoryStorage } from '../services/storage/inMemory';

describe('Cross-File Isolation — Broker State File A', () => {
  afterAll(async () => {
    // CRITICAL: Reset all broker singleton state so File B starts clean.
    resetBroker();
    circuitRegistry.resetAll();
    await auditTrail._clearForTesting();
  });

  it('should authenticate and populate broker state', async () => {
    // Configure persistence with an in-memory storage so getBroker() can
    // persist its state without needing a real database.
    const storage = new InMemoryStorage();
    configureBrokerPersistence(storage);
    await loadBrokerStateFromStorage();

    const broker = await getBroker();
    expect(broker.isConnected()).toBe(true);
    expect(getCurrentBrokerType()).toBe('mock');
  });

  it('should populate broker dedup cache after authentication', async () => {
    // getBroker() from the previous test already populated brokerStateCache
    // with a BROKER_CONNECTED entry for 'mock'.
    const state = getBrokerDeduplicationState();
    expect(state.size).toBeGreaterThanOrEqual(1);
    expect(state.get('mock')).toBeDefined();
    expect(state.get('mock')!.lastEvent).toBe('BROKER_CONNECTED');
  });

  it('should have audit trail events from broker auth', async () => {
    // getBroker() appends a BROKER_CONNECTED event to the audit trail
    const events = await auditTrail.getEvents({ eventType: 'BROKER_CONNECTED' });
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].data.brokerType).toBe('mock');
  });
});
