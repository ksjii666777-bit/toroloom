/**
 * ============================================================================
 * Toroloom — AuditTrail PostgreSQL Integration Tests
 * ============================================================================
 *
 * Validates the AuditTrail service against a real PostgreSQL database:
 *   1. Append and retrieve events
 *   2. Hash chaining across DB reads (tamper-evident chain)
 *   3. Integrity verification — detect tampered stored data
 *   4. Query filtering — userId, eventType (single + multiple), time range,
 *      limit, offset
 *   5. Snapshot — totalEvents, firstEventTime, lastEventTime, latestHash
 *
 * Environment:
 *   DATABASE_URL — defaults to the Docker Compose connection string
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/auditTrail.postgres.int.test.ts
 *
 * Skip:
 *   Tests skip automatically if PostgreSQL is unreachable.
 * ============================================================================
 */

import { createHash } from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuditTrail } from '../services/auditTrail';
import { PostgreSQLStorage } from '../services/storage/postgres';
import { CONNECT_TIMEOUT } from './testUtils';
import { TEST_DATABASE_URL } from './testConfig';

const DATABASE_URL = TEST_DATABASE_URL;

describe('AuditTrail — PostgreSQL Integration', () => {
  let storage: PostgreSQLStorage;
  let audit: AuditTrail;
  let available = true;

  beforeAll(async () => {
    storage = new PostgreSQLStorage(DATABASE_URL);
    try {
      await Promise.race([
        storage.connect(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`connect timeout (${CONNECT_TIMEOUT}ms)`)), CONNECT_TIMEOUT),
        ),
      ]);
      audit = new AuditTrail(storage, 1000);
      await audit._clearForTesting();
    } catch (err: any) {
      console.warn(
        `⚠ PostgreSQL not available (${err.message}) — skipping AuditTrail integration tests`,
      );
      available = false;
    }
  }, 30_000);

  afterAll(async () => {
    if (available && storage) {
      await audit._clearForTesting();
      await storage.disconnect();
    }
  });

  // ──────────────── 1. Append & Retrieve ────────────────

  it('should append an event and retrieve it from PostgreSQL', async () => {
    if (!available) return;

    const event = await audit.append({
      userId: 'audit_pg_user',
      eventType: 'ORDER_EXECUTION',
      data: { orderId: 'ord_pg_1', symbol: 'RELIANCE', quantity: 75 },
      metadata: { source: 'mobile' },
    });

    expect(event.id).toBeDefined();
    expect(event.id.length).toBeGreaterThan(0);
    expect(event.timestamp).toBeDefined();
    expect(event.eventType).toBe('ORDER_EXECUTION');
    expect(event.data.symbol).toBe('RELIANCE');
    expect(event.data.quantity).toBe(75);
    expect(event.metadata?.source).toBe('mobile');
    expect(event.previousHash).toBe('GENESIS_BLOCK');
    expect(event.hash).toBeDefined();
    expect(event.hash.length).toBe(64);

    // Retrieve by ID from the service (hits DB)
    const retrieved = await audit.getEvent(event.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(event.id);
    expect(retrieved!.data.orderId).toBe('ord_pg_1');
  });

  it('should return events in reverse chronological order from PostgreSQL', async () => {
    if (!available) return;

    await audit._clearForTesting();

    await audit.append({ userId: 'audit_pg_user', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await audit.append({ userId: 'audit_pg_user', eventType: 'ORDER_EXECUTION', data: { seq: 2 } });
    await audit.append({ userId: 'audit_pg_user', eventType: 'ORDER_EXECUTION', data: { seq: 3 } });

    // Force a DB query by passing an empty filter
    const events = await audit.getEvents({ userId: 'audit_pg_user' });
    expect(events.length).toBeGreaterThanOrEqual(3);
    // Most recent first
    expect(events[0].data.seq).toBe(3);
    expect(events[2].data.seq).toBe(1);
  });

  it('should return undefined for a non-existent event ID', async () => {
    if (!available) return;

    const found = await audit.getEvent('non-existent-id-' + Date.now());
    expect(found).toBeUndefined();
  });

  // ──────────────── 2. Hash Chaining Persistence ────────────────

  it('should preserve the SHA-256 hash chain across PostgreSQL reads', async () => {
    if (!available) return;

    await audit._clearForTesting();

    const e1 = await audit.append({
      userId: 'audit_pg_user',
      eventType: 'ORDER_EXECUTION',
      data: { seq: 1 },
    });
    const e2 = await audit.append({
      userId: 'audit_pg_user',
      eventType: 'LOCKDOWN_TRIGGERED',
      data: { loss: 25000 },
    });
    const e3 = await audit.append({
      userId: 'audit_pg_user',
      eventType: 'ORDER_EXECUTION',
      data: { seq: 3 },
    });

    // First event links to genesis
    expect(e1.previousHash).toBe('GENESIS_BLOCK');

    // Second links to first
    expect(e2.previousHash).toBe(e1.hash);

    // Third links to second
    expect(e3.previousHash).toBe(e2.hash);

    // Now re-read from PostgreSQL to confirm the chain survives persistence
    const fromDb = await audit.getEvents({ userId: 'audit_pg_user' });
    // fromDb is reverse chronological: [e3, e2, e1]
    expect(fromDb[2].previousHash).toBe('GENESIS_BLOCK');
    expect(fromDb[1].previousHash).toBe(fromDb[2].hash);
    expect(fromDb[0].previousHash).toBe(fromDb[1].hash);

    // Verify the hashes are 64-character hex strings (SHA-256)
    expect(fromDb[0].hash).toMatch(/^[a-f0-9]{64}$/);
    expect(fromDb[1].hash).toMatch(/^[a-f0-9]{64}$/);
    expect(fromDb[2].hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce unique hashes for different events stored in PostgreSQL', async () => {
    if (!available) return;

    await audit._clearForTesting();

    const e1 = await audit.append({
      userId: 'audit_pg_user',
      eventType: 'ORDER_EXECUTION',
      data: { symbol: 'TCS' },
    });
    const e2 = await audit.append({
      userId: 'audit_pg_user',
      eventType: 'ORDER_EXECUTION',
      data: { symbol: 'INFY' },
    });

    expect(e1.hash).not.toBe(e2.hash);
  });

  // ──────────────── 3. Integrity Verification ────────────────

  it('should verify integrity of an untampered chain stored in PostgreSQL', async () => {
    if (!available) return;

    await audit._clearForTesting();

    await audit.append({ userId: 'audit_pg_integrity', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await audit.append({ userId: 'audit_pg_integrity', eventType: 'ORDER_EXECUTION', data: { seq: 2 } });
    await audit.append({ userId: 'audit_pg_integrity', eventType: 'LOCKDOWN_TRIGGERED', data: { loss: 50000 } });

    const valid = await audit.verifyIntegrity();
    expect(valid).toBe(true);
  });

  it('should detect tampered event data in PostgreSQL storage', async () => {
    if (!available) return;

    await audit._clearForTesting();

    await audit.append({ userId: 'audit_pg_integrity', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await audit.append({ userId: 'audit_pg_integrity', eventType: 'ORDER_EXECUTION', data: { seq: 2 } });
    await audit.append({ userId: 'audit_pg_integrity', eventType: 'ORDER_EXECUTION', data: { seq: 3 } });

    // Tamper with the second event's data directly in PostgreSQL
    // We need to use the raw storage layer to bypass the AuditTrail abstraction
    const allFromDb = await storage.getAllEvents();
    // allFromDb is chronological: [seq1, seq2, seq3]
    const tamperedEvent = allFromDb[1];

    // Recompute hash with tampered data to maintain valid hash for that event
    // (The integrity check catches the chain break because seq3 still points
    //  to the OLD hash, not this recomputed one)
    const hashInput = `${tamperedEvent.id}|${tamperedEvent.timestamp}|${tamperedEvent.previousHash}|${JSON.stringify({ seq: 999 })}|${JSON.stringify({})}`;
    const tamperedHash = createHash('sha256').update(hashInput).digest('hex');

    // Tamper directly via the database
    await (storage as any).pool.query(
      'UPDATE audit_events SET data = $1, hash = $2 WHERE id = $3',
      [JSON.stringify({ seq: 999 }), tamperedHash, tamperedEvent.id],
    );

    // verifyIntegrity should now detect the tampered chain because
    // the third event's previousHash still points to the OLD hash,
    // not the tampered hash
    const valid = await audit.verifyIntegrity();
    expect(valid).toBe(false);
  });

  it('should verify an empty chain as valid', async () => {
    if (!available) return;

    const emptyAudit = new AuditTrail(storage, 1000);
    await emptyAudit._clearForTesting();

    expect(await emptyAudit.verifyIntegrity()).toBe(true);
  });

  // ──────────────── 4. Query Filtering ────────────────

  it('should filter events by userId from PostgreSQL', async () => {
    if (!available) return;

    await audit._clearForTesting();

    await audit.append({ userId: 'filter_user_a', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await audit.append({ userId: 'filter_user_b', eventType: 'ORDER_EXECUTION', data: { seq: 2 } });
    await audit.append({ userId: 'filter_user_a', eventType: 'ORDER_EXECUTION', data: { seq: 3 } });

    const events = await audit.getEvents({ userId: 'filter_user_a' });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.userId === 'filter_user_a')).toBe(true);
  });

  it('should filter events by single eventType from PostgreSQL', async () => {
    if (!available) return;

    await audit._clearForTesting();

    await audit.append({ userId: 'filter_user', eventType: 'ORDER_EXECUTION', data: {} });
    await audit.append({ userId: 'filter_user', eventType: 'LOCKDOWN_TRIGGERED', data: {} });
    await audit.append({ userId: 'filter_user', eventType: 'ORDER_EXECUTION', data: {} });

    const orderEvents = await audit.getEvents({ eventType: 'ORDER_EXECUTION', userId: 'filter_user' });
    expect(orderEvents).toHaveLength(2);
    expect(orderEvents.every((e) => e.eventType === 'ORDER_EXECUTION')).toBe(true);
  });

  it('should filter events by multiple eventTypes from PostgreSQL', async () => {
    if (!available) return;

    await audit._clearForTesting();

    await audit.append({ userId: 'filter_user', eventType: 'ORDER_EXECUTION', data: {} });
    await audit.append({ userId: 'filter_user', eventType: 'LOCKDOWN_TRIGGERED', data: {} });
    await audit.append({ userId: 'filter_user', eventType: 'CIRCUIT_OPEN', data: {} });
    await audit.append({ userId: 'filter_user', eventType: 'SYSTEM_ERROR', data: {} });

    const filtered = await audit.getEvents({
      eventType: ['ORDER_EXECUTION', 'CIRCUIT_OPEN'],
      userId: 'filter_user',
    });
    expect(filtered).toHaveLength(2);
  });

  it('should limit and offset events from PostgreSQL', async () => {
    if (!available) return;

    await audit._clearForTesting();

    for (let i = 0; i < 10; i++) {
      await audit.append({
        userId: 'filter_user',
        eventType: 'ORDER_EXECUTION',
        data: { seq: i },
      });
      // Small delay ensures strictly increasing timestamps for deterministic ordering
      await new Promise((r) => setTimeout(r, 1));
    }

    // Limit
    const limited = await audit.getEvents({ userId: 'filter_user', limit: 3 });
    expect(limited).toHaveLength(3);

    // Offset + limit
    const offset5 = await audit.getEvents({
      userId: 'filter_user',
      offset: 5,
      limit: 3,
    });
    expect(offset5).toHaveLength(3);
    // With 10 events (seq 0-9), offset 5 skips the 5 most recent (seq 9-5)
    // The 3 results should be seq 4, 3, 2
    expect(offset5[0].data.seq).toBe(4);
    expect(offset5[2].data.seq).toBe(2);
  });

  // ──────────────── 5. Snapshot ────────────────

  it('should return a snapshot with correct counts from PostgreSQL', async () => {
    if (!available) return;

    await audit._clearForTesting();

    let snap = await audit.snapshot();
    expect(snap.totalEvents).toBe(0);
    expect(snap.firstEventTime).toBeNull();
    expect(snap.lastEventTime).toBeNull();
    expect(snap.latestHash).toBeNull();

    await audit.append({ userId: 'snap_user', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await audit.append({ userId: 'snap_user', eventType: 'ORDER_REJECTED', data: { seq: 2 } });

    snap = await audit.snapshot();
    expect(snap.totalEvents).toBe(2);
    expect(snap.firstEventTime).toBeDefined();
    expect(snap.lastEventTime).toBeDefined();
    expect(snap.latestHash).toBeDefined();

    // firstEventTime should be before lastEventTime
    expect(new Date(snap.firstEventTime!).getTime()).toBeLessThanOrEqual(
      new Date(snap.lastEventTime!).getTime(),
    );
  });

  it('should auto-assign system userId when empty string is provided', async () => {
    if (!available) return;

    const event = await audit.append({
      userId: '',
      eventType: 'SYSTEM_ERROR',
      data: { error: 'db_connection_failed' },
    });
    expect(event.userId).toBe('system');
  });

  // ──────────────── 6. Event Lifetime (EventType Coverage) ────────────────

  it('should support LOCKDOWN_RELEASED event type storage in PostgreSQL', async () => {
    if (!available) return;

    await audit._clearForTesting();

    const event = await audit.append({
      userId: 'lt_user',
      eventType: 'LOCKDOWN_RELEASED',
      data: { reason: 'manual_override' },
    });
    expect(event.eventType).toBe('LOCKDOWN_RELEASED');

    const fromDb = await audit.getEvent(event.id);
    expect(fromDb).toBeDefined();
    expect(fromDb!.eventType).toBe('LOCKDOWN_RELEASED');
  });
});
