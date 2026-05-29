/**
 * ============================================================================
 * Toroloom Audit Trail — Unit Tests
 * ============================================================================
 *
 * Tests the immutable append-only audit trail with pluggable persistence:
 *   1. Basic append and retrieval (async)
 *   2. Immutability (no modification after creation)
 *   3. Cryptographic hash chaining (SHA-256)
 *   4. Integrity verification (tamper detection)
 *   5. Query filtering (by userId, eventType, time range)
 *   6. Memory limit enforcement (in-memory cache)
 *   7. Snapshot reporting
 *   8. Storage engine delegation
 *
 * Run: npx vitest run --reporter=verbose
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditTrail } from '../services/auditTrail';
import type { AuditEvent } from '../services/auditTrail';

describe('AuditTrail — Immutable Event Log', () => {
  let trail: AuditTrail;

  beforeEach(async () => {
    trail = new AuditTrail(undefined, 1000); // InMemoryStorage by default, 1000 cache limit
    await trail._clearForTesting();
  });

  // ==================== Basic Append & Retrieve ====================

  it('should append an event and return it with id and timestamp', async () => {
    const event = await trail.append({
      userId: 'user_1',
      eventType: 'ORDER_EXECUTION',
      data: { orderId: 'ord_123', symbol: 'RELIANCE', quantity: 10 },
    });

    expect(event.id).toBeDefined();
    expect(event.id.length).toBeGreaterThan(0);
    expect(event.timestamp).toBeDefined();
    expect(event.userId).toBe('user_1');
    expect(event.eventType).toBe('ORDER_EXECUTION');
    expect(event.data.symbol).toBe('RELIANCE');
    expect(event.previousHash).toBe('GENESIS_BLOCK');
    expect(event.hash).toBeDefined();
    expect(event.hash.length).toBe(64); // SHA-256 hex
  });

  it('should retrieve events in reverse chronological order', async () => {
    await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: { seq: 2 } });
    await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: { seq: 3 } });

    const events = await trail.getEvents();
    expect(events).toHaveLength(3);
    expect(events[0].data.seq).toBe(3); // Most recent first
    expect(events[2].data.seq).toBe(1); // Oldest last
  });

  it('should retrieve a specific event by ID', async () => {
    const event = await trail.append({
      userId: 'user_1',
      eventType: 'ORDER_EXECUTION',
      data: { symbol: 'TCS' },
    });

    const found = await trail.getEvent(event.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(event.id);
    expect(found!.data.symbol).toBe('TCS');
  });

  it('should return undefined for non-existent event ID', async () => {
    const found = await trail.getEvent('non-existent-id');
    expect(found).toBeUndefined();
  });

  // ==================== Hash Chaining ====================

  it('should link events through previousHash', async () => {
    const event1 = await trail.append({
      userId: 'user_1',
      eventType: 'ORDER_EXECUTION',
      data: { seq: 1 },
    });
    const event2 = await trail.append({
      userId: 'user_1',
      eventType: 'ORDER_EXECUTION',
      data: { seq: 2 },
    });
    const event3 = await trail.append({
      userId: 'user_1',
      eventType: 'ORDER_EXECUTION',
      data: { seq: 3 },
    });

    expect(event1.previousHash).toBe('GENESIS_BLOCK');
    expect(event2.previousHash).toBe(event1.hash);
    expect(event3.previousHash).toBe(event2.hash);
  });

  it('should produce unique hashes for different events', async () => {
    const event1 = await trail.append({
      userId: 'user_1',
      eventType: 'ORDER_EXECUTION',
      data: { symbol: 'RELIANCE' },
    });
    const event2 = await trail.append({
      userId: 'user_1',
      eventType: 'ORDER_EXECUTION',
      data: { symbol: 'TCS' },
    });

    expect(event1.hash).not.toBe(event2.hash);
  });

  // ==================== Integrity Verification ====================

  it('should verify integrity of untampered chain', async () => {
    await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: { seq: 2 } });
    await trail.append({ userId: 'user_1', eventType: 'LOCKDOWN_TRIGGERED', data: { loss: 50000 } });

    expect(await trail.verifyIntegrity()).toBe(true);
  });

  it('should detect tampered data in an event', async () => {
    await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: { seq: 2 } });

    // Tamper with event data. Since storage and cache share object references
    // for nested data (shallow copy), modifying via cache also affects storage.
    const cached = trail.getCachedEvents() as AuditEvent[];
    // cached is chronological: [event1, event2]
    (cached[1].data as any).seq = 999;

    expect(await trail.verifyIntegrity()).toBe(false);
  });

  it('should detect broken hash chain', async () => {
    await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: { seq: 2 } });

    // Tamper with previousHash via storage events directly.
    // Since previousHash is a string primitive, modifying via cache
    // does NOT affect storage (strings are copied by value in shallow copy).
    // We must tamper with events retrieved from storage.
    const eventsFromStorage = await trail.getEvents({});
    // getEvents({}) forces a storage query since filter is non-null
    // Returned reverse chronological: [event2 (newest), event1 (oldest)]
    // Break the chain on the second event by changing its previousHash
    const secondEvent = eventsFromStorage[1]; // event1 (oldest)
    (secondEvent as any).previousHash = 'tampered-hash';

    expect(await trail.verifyIntegrity()).toBe(false);
  });

  it('should verify empty chain as valid', async () => {
    expect(await trail.verifyIntegrity()).toBe(true);
  });

  // ==================== Query Filtering ====================

  it('should filter events by userId', async () => {
    await trail.append({ userId: 'user_a', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await trail.append({ userId: 'user_b', eventType: 'ORDER_EXECUTION', data: { seq: 2 } });
    await trail.append({ userId: 'user_a', eventType: 'ORDER_EXECUTION', data: { seq: 3 } });

    const userAEvents = await trail.getEvents({ userId: 'user_a' });
    expect(userAEvents).toHaveLength(2);
    expect(userAEvents.every((e) => e.userId === 'user_a')).toBe(true);
  });

  it('should filter events by eventType', async () => {
    await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: {} });
    await trail.append({ userId: 'user_1', eventType: 'LOCKDOWN_TRIGGERED', data: {} });
    await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: {} });

    const orderEvents = await trail.getEvents({ eventType: 'ORDER_EXECUTION' });
    expect(orderEvents).toHaveLength(2);
    expect(orderEvents.every((e) => e.eventType === 'ORDER_EXECUTION')).toBe(true);
  });

  it('should filter events by multiple eventTypes', async () => {
    await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: {} });
    await trail.append({ userId: 'user_1', eventType: 'LOCKDOWN_TRIGGERED', data: {} });
    await trail.append({ userId: 'user_1', eventType: 'CIRCUIT_OPEN', data: {} });

    const filtered = await trail.getEvents({
      eventType: ['ORDER_EXECUTION', 'CIRCUIT_OPEN'],
    });
    expect(filtered).toHaveLength(2);
  });

  it('should limit the number of returned events', async () => {
    for (let i = 0; i < 10; i++) {
      await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: { i } });
    }

    const limited = await trail.getEvents({ limit: 3 });
    expect(limited).toHaveLength(3);
  });

  it('should support offset pagination', async () => {
    for (let i = 0; i < 10; i++) {
      await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: { seq: i } });
    }

    const offset5 = await trail.getEvents({ offset: 5, limit: 3 });
    expect(offset5).toHaveLength(3);
    expect(offset5[2].data.seq).toBe(2);
  });

  it('should auto-assign "system" userId when empty string provided', async () => {
    const event = await trail.append({
      userId: '',
      eventType: 'SYSTEM_ERROR',
      data: { error: 'test' },
    });
    expect(event.userId).toBe('system');
  });

  // ==================== Metadata ====================

  it('should store metadata separately from data', async () => {
    const event = await trail.append({
      userId: 'user_1',
      eventType: 'ORDER_EXECUTION',
      data: { orderId: 'ord_1' },
      metadata: { source: 'web', ip: '192.168.1.1' },
    });

    expect(event.data).toEqual({ orderId: 'ord_1' });
    expect(event.metadata).toEqual({ source: 'web', ip: '192.168.1.1' });
  });

  it('should handle events without metadata', async () => {
    const event = await trail.append({
      userId: 'user_1',
      eventType: 'ORDER_EXECUTION',
      data: { orderId: 'ord_1' },
    });

    expect(event.metadata).toBeUndefined();
  });

  // ==================== Snapshot ====================

  it('should return a snapshot with event counts', async () => {
    expect((await trail.snapshot()).totalEvents).toBe(0);

    await trail.append({ userId: 'user_1', eventType: 'ORDER_EXECUTION', data: {} });
    await trail.append({ userId: 'user_1', eventType: 'ORDER_REJECTED', data: {} });

    const snap = await trail.snapshot();
    expect(snap.totalEvents).toBe(2);
    expect(snap.firstEventTime).toBeDefined();
    expect(snap.lastEventTime).toBeDefined();
    expect(snap.latestHash).toBeDefined();
  });

  it('should return null snapshot for empty trail', async () => {
    const snap = await trail.snapshot();
    expect(snap.totalEvents).toBe(0);
    expect(snap.firstEventTime).toBeNull();
    expect(snap.lastEventTime).toBeNull();
    expect(snap.latestHash).toBeNull();
  });

  // ==================== In-Memory Cache Pruning ====================

  it('should enforce the in-memory cache limit and prune old events', async () => {
    const smallTrail = new AuditTrail(undefined, 5); // Max 5 events in cache

    // Verify cache grows to 5, then prunes on the 6th
    for (let i = 0; i < 6; i++) {
      await smallTrail.append({
        userId: 'user_1',
        eventType: 'ORDER_EXECUTION',
        data: { seq: i },
      });
      if (i < 5) {
        expect(smallTrail.getCachedEvents().length).toBe(i + 1);
      }
    }

    // After 6th append, cache should be pruned to 5
    expect(smallTrail.getCachedEvents().length).toBe(5);

    // Storage should have all 6
    expect((await smallTrail.snapshot()).totalEvents).toBe(6);

    // Verify the oldest in cache is seq 1 (seq 0 was pruned)
    const cached = smallTrail.getCachedEvents();
    expect(cached[0].data.seq).toBe(1);

    // Fill to 10 events
    for (let i = 6; i < 10; i++) {
      await smallTrail.append({
        userId: 'user_1',
        eventType: 'ORDER_EXECUTION',
        data: { seq: i },
      });
    }

    // Cache should still be pruned to 5
    expect(smallTrail.getCachedEvents().length).toBe(5);
    // Oldest in cache should be seq 5 (seq 0-4 were pruned)
    const finalCached = smallTrail.getCachedEvents();
    expect(finalCached[0].data.seq).toBe(5);

    // Storage has all 10
    expect((await smallTrail.snapshot()).totalEvents).toBe(10);
  });

  // ==================== All Event Types ====================

  it('should support all defined event types', async () => {
    const eventTypes = [
      'ORDER_EXECUTION',
      'ORDER_REJECTED',
      'ORDER_VALIDATED',
      'LOCKDOWN_TRIGGERED',
      'LOCKDOWN_RELEASED',
      'LOCKDOWN_EXIT_ALLOWED',
      'RISK_SETTINGS_CHANGED',
      'RISK_SETTINGS_BLOCKED',
      'BROKER_FAILOVER',
      'BROKER_CONNECTED',
      'BROKER_DISCONNECTED',
      'CIRCUIT_OPEN',
      'CIRCUIT_CLOSED',
      'CIRCUIT_HALF_OPEN',
      'CIRCUIT_FAILURE_RECORDED',
      'AUTH_LOGIN',
      'AUTH_LOGOUT',
      'AUTH_FAILED',
      'FUNDS_ADDED',
      'FUNDS_WITHDRAWN',
      'PORTFOLIO_UPDATED',
      'SYSTEM_ERROR',
    ] as const;

    for (const eventType of eventTypes) {
      const event = await trail.append({
        userId: 'user_1',
        eventType,
        data: { test: true },
      });
      expect(event.eventType).toBe(eventType);
    }

    const totalEvents = (await trail.snapshot()).totalEvents;
    expect(totalEvents).toBe(eventTypes.length);
  });
});
