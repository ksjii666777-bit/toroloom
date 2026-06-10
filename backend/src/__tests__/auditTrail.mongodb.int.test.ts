/**
 * ============================================================================
 * Toroloom — AuditTrail MongoDB Integration Tests
 * ============================================================================
 *
 * Validates the AuditTrail service against a real MongoDB database:
 *   1. Append and retrieve events
 *   2. Hash chaining across DB reads (tamper-evident chain)
 *   3. Integrity verification — detect tampered stored data
 *   4. Query filtering — userId, eventType (single + multiple), time range,
 *      limit, offset
 *   5. Snapshot — totalEvents, firstEventTime, lastEventTime, latestHash
 *
 * Environment:
 *   MONGODB_URI      — defaults to Docker Compose connection string
 *   MONGODB_DB_NAME  — defaults to 'toroloom_test'
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/auditTrail.mongodb.int.test.ts
 *
 * Skip:
 *   Tests skip automatically if MongoDB is unreachable.
 * ============================================================================
 */

import { createHash } from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuditTrail } from '../services/auditTrail';
import { MongoDBStorage } from '../services/storage/mongodb';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://toroloom:toroloom_dev@localhost:27017/toroloom?authSource=admin';
const MONGODB_DB = process.env.MONGODB_DB_NAME || 'toroloom_test';

describe('AuditTrail — MongoDB Integration', () => {
  let storage: MongoDBStorage;
  let audit: AuditTrail;
  let available = true;

  beforeAll(async () => {
    storage = new MongoDBStorage(MONGODB_URI, MONGODB_DB);
    try {
      await Promise.race([
        storage.connect(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('connect timeout (3s)')), 3_000),
        ),
      ]);
      audit = new AuditTrail(storage, 1000);
      await audit._clearForTesting();
    } catch (err: any) {
      console.warn(
        `⚠ MongoDB not available (${err.message}) — skipping AuditTrail integration tests`,
      );
      available = false;
    }
  }, 10_000);

  afterAll(async () => {
    if (available && storage) {
      await audit._clearForTesting();
      await storage.disconnect();
    }
  });

  // ──────────────── 1. Append & Retrieve ────────────────

  it('should append an event and retrieve it from MongoDB', async () => {
    if (!available) return;

    const event = await audit.append({
      userId: 'audit_mongo_user',
      eventType: 'ORDER_EXECUTION',
      data: { orderId: 'ord_mongo_1', symbol: 'TCS', quantity: 50 },
      metadata: { source: 'web' },
    });

    expect(event.id).toBeDefined();
    expect(event.id.length).toBeGreaterThan(0);
    expect(event.timestamp).toBeDefined();
    expect(event.eventType).toBe('ORDER_EXECUTION');
    expect(event.data.symbol).toBe('TCS');
    expect(event.data.quantity).toBe(50);
    expect(event.metadata?.source).toBe('web');
    expect(event.previousHash).toBe('GENESIS_BLOCK');
    expect(event.hash).toBeDefined();
    expect(event.hash.length).toBe(64);

    // Retrieve by ID from the service (hits DB)
    const retrieved = await audit.getEvent(event.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(event.id);
    expect(retrieved!.data.orderId).toBe('ord_mongo_1');
  });

  it('should return events in reverse chronological order from MongoDB', async () => {
    if (!available) return;

    await audit._clearForTesting();

    await audit.append({ userId: 'audit_mongo_user', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await audit.append({ userId: 'audit_mongo_user', eventType: 'ORDER_EXECUTION', data: { seq: 2 } });
    await audit.append({ userId: 'audit_mongo_user', eventType: 'ORDER_EXECUTION', data: { seq: 3 } });

    // Force a DB query by passing a filter
    const events = await audit.getEvents({ userId: 'audit_mongo_user' });
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

  it('should preserve the SHA-256 hash chain across MongoDB reads', async () => {
    if (!available) return;

    await audit._clearForTesting();

    const e1 = await audit.append({
      userId: 'audit_mongo_user',
      eventType: 'ORDER_EXECUTION',
      data: { seq: 1 },
    });
    const e2 = await audit.append({
      userId: 'audit_mongo_user',
      eventType: 'LOCKDOWN_TRIGGERED',
      data: { loss: 25000 },
    });
    const e3 = await audit.append({
      userId: 'audit_mongo_user',
      eventType: 'ORDER_EXECUTION',
      data: { seq: 3 },
    });

    // First event links to genesis
    expect(e1.previousHash).toBe('GENESIS_BLOCK');

    // Second links to first
    expect(e2.previousHash).toBe(e1.hash);

    // Third links to second
    expect(e3.previousHash).toBe(e2.hash);

    // Now re-read from MongoDB to confirm the chain survives persistence
    const fromDb = await audit.getEvents({ userId: 'audit_mongo_user' });
    // fromDb is reverse chronological: [e3, e2, e1]
    expect(fromDb).toHaveLength(3);
    expect(fromDb[2].previousHash).toBe('GENESIS_BLOCK');
    expect(fromDb[1].previousHash).toBe(fromDb[2].hash);
    expect(fromDb[0].previousHash).toBe(fromDb[1].hash);

    // Verify the hashes are 64-character hex strings (SHA-256)
    expect(fromDb[0].hash).toMatch(/^[a-f0-9]{64}$/);
    expect(fromDb[1].hash).toMatch(/^[a-f0-9]{64}$/);
    expect(fromDb[2].hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce unique hashes for different events stored in MongoDB', async () => {
    if (!available) return;

    await audit._clearForTesting();

    const e1 = await audit.append({
      userId: 'audit_mongo_user',
      eventType: 'ORDER_EXECUTION',
      data: { symbol: 'TCS' },
    });
    const e2 = await audit.append({
      userId: 'audit_mongo_user',
      eventType: 'ORDER_EXECUTION',
      data: { symbol: 'INFY' },
    });

    expect(e1.hash).not.toBe(e2.hash);
  });

  // ──────────────── 3. Integrity Verification ────────────────

  it('should verify integrity of an untampered chain stored in MongoDB', async () => {
    if (!available) return;

    await audit._clearForTesting();

    await audit.append({ userId: 'audit_mongo_integrity', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await audit.append({ userId: 'audit_mongo_integrity', eventType: 'ORDER_EXECUTION', data: { seq: 2 } });
    await audit.append({ userId: 'audit_mongo_integrity', eventType: 'LOCKDOWN_TRIGGERED', data: { loss: 50000 } });

    const valid = await audit.verifyIntegrity();
    expect(valid).toBe(true);
  });

  it('should detect tampered event data in MongoDB storage', async () => {
    if (!available) return;

    await audit._clearForTesting();

    await audit.append({ userId: 'audit_mongo_integrity', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await audit.append({ userId: 'audit_mongo_integrity', eventType: 'ORDER_EXECUTION', data: { seq: 2 } });
    await audit.append({ userId: 'audit_mongo_integrity', eventType: 'ORDER_EXECUTION', data: { seq: 3 } });

    // Tamper with the second event's data directly in MongoDB
    // We need to use the raw storage layer and MongoDB driver to bypass AuditTrail
    const allFromDb = await storage.getAllEvents();
    // allFromDb is chronological: [seq1, seq2, seq3]
    const tamperedEvent = allFromDb[1];

    // Recompute hash with tampered data
    const hashInput = `${tamperedEvent.id}|${tamperedEvent.timestamp}|${tamperedEvent.previousHash}|${JSON.stringify({ seq: 999 })}|${JSON.stringify({})}`;
    const tamperedHash = createHash('sha256').update(hashInput).digest('hex');

    // Update directly in MongoDB via the storage's collection access
    const collection = (storage as any).db.collection('audit_events');
    await collection.updateOne(
      { id: tamperedEvent.id },
      { $set: { data: { seq: 999 }, hash: tamperedHash } },
    );

    // verifyIntegrity should detect the broken chain because the third
    // event's previousHash still points to the OLD hash
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

  it('should filter events by userId from MongoDB', async () => {
    if (!available) return;

    await audit._clearForTesting();

    await audit.append({ userId: 'mongo_filter_a', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await audit.append({ userId: 'mongo_filter_b', eventType: 'ORDER_EXECUTION', data: { seq: 2 } });
    await audit.append({ userId: 'mongo_filter_a', eventType: 'ORDER_EXECUTION', data: { seq: 3 } });

    const events = await audit.getEvents({ userId: 'mongo_filter_a' });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.userId === 'mongo_filter_a')).toBe(true);
  });

  it('should filter events by single eventType from MongoDB', async () => {
    if (!available) return;

    await audit._clearForTesting();

    await audit.append({ userId: 'mongo_filter', eventType: 'ORDER_EXECUTION', data: {} });
    await audit.append({ userId: 'mongo_filter', eventType: 'LOCKDOWN_TRIGGERED', data: {} });
    await audit.append({ userId: 'mongo_filter', eventType: 'ORDER_EXECUTION', data: {} });

    const orderEvents = await audit.getEvents({ eventType: 'ORDER_EXECUTION', userId: 'mongo_filter' });
    expect(orderEvents).toHaveLength(2);
    expect(orderEvents.every((e) => e.eventType === 'ORDER_EXECUTION')).toBe(true);
  });

  it('should filter events by multiple eventTypes from MongoDB', async () => {
    if (!available) return;

    await audit._clearForTesting();

    await audit.append({ userId: 'mongo_filter', eventType: 'ORDER_EXECUTION', data: {} });
    await audit.append({ userId: 'mongo_filter', eventType: 'LOCKDOWN_TRIGGERED', data: {} });
    await audit.append({ userId: 'mongo_filter', eventType: 'CIRCUIT_OPEN', data: {} });
    await audit.append({ userId: 'mongo_filter', eventType: 'SYSTEM_ERROR', data: {} });

    const filtered = await audit.getEvents({
      eventType: ['ORDER_EXECUTION', 'CIRCUIT_OPEN'],
      userId: 'mongo_filter',
    });
    expect(filtered).toHaveLength(2);
  });

  it('should limit and offset events from MongoDB', async () => {
    if (!available) return;

    await audit._clearForTesting();

    for (let i = 0; i < 10; i++) {
      await audit.append({
        userId: 'mongo_filter',
        eventType: 'ORDER_EXECUTION',
        data: { seq: i },
      });
      // Small delay ensures strictly increasing timestamps for deterministic ordering
      await new Promise((r) => setTimeout(r, 1));
    }

    // Limit
    const limited = await audit.getEvents({ userId: 'mongo_filter', limit: 3 });
    expect(limited).toHaveLength(3);

    // Offset + limit
    const offset5 = await audit.getEvents({
      userId: 'mongo_filter',
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

  it('should return a snapshot with correct counts from MongoDB', async () => {
    if (!available) return;

    await audit._clearForTesting();

    let snap = await audit.snapshot();
    expect(snap.totalEvents).toBe(0);
    expect(snap.firstEventTime).toBeNull();
    expect(snap.lastEventTime).toBeNull();
    expect(snap.latestHash).toBeNull();

    await audit.append({ userId: 'mongo_snap', eventType: 'ORDER_EXECUTION', data: { seq: 1 } });
    await audit.append({ userId: 'mongo_snap', eventType: 'ORDER_REJECTED', data: { seq: 2 } });

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

  it('should support CIRCUIT_CLOSED event type storage in MongoDB', async () => {
    if (!available) return;

    await audit._clearForTesting();

    const event = await audit.append({
      userId: 'mongo_lt_user',
      eventType: 'CIRCUIT_CLOSED',
      data: { reason: 'timeout_elapsed' },
    });
    expect(event.eventType).toBe('CIRCUIT_CLOSED');

    const fromDb = await audit.getEvent(event.id);
    expect(fromDb).toBeDefined();
    expect(fromDb!.eventType).toBe('CIRCUIT_CLOSED');
  });
});
