/**
 * ============================================================================
 * Toroloom — Cross-File Isolation Test: Broker State File B
 * ============================================================================
 *
 * Verifies that after File A runs and calls resetBroker() +
 * circuitRegistry.resetAll() + auditTrail._clearForTesting() in its afterAll,
 * this file starts with a completely clean broker module singleton state.
 *
 * If File A's afterAll did not properly clean up, this file would inherit:
 *   - A connected brokerInstance (getBroker() would short-circuit)
 *   - A stale currentBrokerType === 'mock'
 *   - Stale brokerStateCache entries
 *   - Pre-existing circuit breaker states
 *   - Stale audit trail events
 *
 * Run with File A in the same vitest process:
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

describe('Cross-File Isolation — Broker State File B', () => {
  afterAll(async () => {
    // Clean up after ourselves
    resetBroker();
    circuitRegistry.resetAll();
    await auditTrail._clearForTesting();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Isolation assertions — these fail if File A's broker state leaked
  // ═══════════════════════════════════════════════════════════════════════════

  it('should start with no broker type (no leakage from File A)', () => {
    // File A set currentBrokerType to 'mock'. If resetBroker() was not
    // called in afterAll, this would still be 'mock'.
    expect(getCurrentBrokerType()).toBeNull();
  });

  it('should start with empty dedup cache (no leakage from File A)', () => {
    const state = getBrokerDeduplicationState();
    expect(state.size).toBe(0);
  });

  it('should start with no audit trail events (no leakage from File A)', async () => {
    const events = await auditTrail.getEvents();
    expect(events).toHaveLength(0);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Independent operation — File B authenticates its own broker
  // ═══════════════════════════════════════════════════════════════════════════

  it('should authenticate its own broker independently', async () => {
    const storage = new InMemoryStorage();
    configureBrokerPersistence(storage);
    await loadBrokerStateFromStorage();

    const broker = await getBroker();
    expect(broker.isConnected()).toBe(true);
    expect(getCurrentBrokerType()).toBe('mock');

    const state = getBrokerDeduplicationState();
    expect(state.get('mock')).toBeDefined();
    expect(state.get('mock')!.lastEvent).toBe('BROKER_CONNECTED');
  });

  it('should have its own audit trail events (not from File A)', async () => {
    const events = await auditTrail.getEvents({ eventType: 'BROKER_CONNECTED' });
    // File B only has events from its own authentication
    expect(events).toHaveLength(1);
    expect(events[0].data.brokerType).toBe('mock');
  });
});
