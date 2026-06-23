/**
 * ============================================================================
 * Toroloom — MongoDB Storage Integration Tests
 * ============================================================================
 *
 * These tests require a running MongoDB instance.
 * Start one via Docker:
 *   docker compose up -d mongodb
 *
 * Environment:
 *   MONGODB_URI      — defaults to the Docker Compose connection string
 *   MONGODB_DB_NAME  — defaults to 'toroloom_test'
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/storageMongoDB.int.test.ts
 *
 * Skip:
 *   Tests are skipped automatically if MongoDB is unreachable.
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoDBStorage } from '../services/storage/mongodb';
import { CONNECT_TIMEOUT } from './testUtils';
import { TEST_MONGODB_URI, TEST_MONGODB_DB } from './testConfig';

const MONGODB_URI = TEST_MONGODB_URI;
const MONGODB_DB = TEST_MONGODB_DB;

describe('MongoDBStorage Integration', () => {
  let storage: MongoDBStorage;
  let available = true;

  beforeAll(async () => {
    storage = new MongoDBStorage(MONGODB_URI, MONGODB_DB);
    try {
      // Race the connect against a timeout so tests don't hang if DB is unreachable
      await Promise.race([
        storage.connect(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`connect timeout (${CONNECT_TIMEOUT}ms)`)), CONNECT_TIMEOUT),
        ),
      ]);
    } catch (err: any) {
      console.warn(`⚠ MongoDB not available (${err.message}) — skipping integration tests`);
      available = false;
    }
  }, 30_000);

  afterAll(async () => {
    if (available && storage) {
      await storage.clearForTesting();
      await storage.disconnect();
    }
  });

  // Start each test with a clean slate — prevents cross-test data contamination
  beforeEach(async () => {
    if (!available) return;
    await storage.clearForTesting();
  });

  // ──── Audit Trail ────

  it('should append and retrieve an audit event', async () => {
    if (!available) return;

    const event = await storage.appendEvent({
      id: 'mongo-test-001',
      timestamp: new Date().toISOString(),
      userId: 'mongo_int_user',
      eventType: 'ORDER_EXECUTION' as any,
      data: { symbol: 'TCS', qty: 5 },
      previousHash: 'GENESIS_BLOCK',
      hash: 'mongo_abc_hash',
    });

    expect(event.id).toBe('mongo-test-001');
    expect(event.data.symbol).toBe('TCS');
  });

  it('should get the latest event', async () => {
    if (!available) return;

    // Create two events, then verify the latest is the second one
    await storage.appendEvent({
      id: 'mongo-test-001',
      timestamp: new Date(Date.now() - 1000).toISOString(),
      userId: 'mongo_int_user',
      eventType: 'ORDER_EXECUTION' as any,
      data: { symbol: 'TCS', qty: 5 },
      previousHash: 'GENESIS_BLOCK',
      hash: 'mongo_abc_hash',
    });

    await storage.appendEvent({
      id: 'mongo-test-002',
      timestamp: new Date().toISOString(),
      userId: 'mongo_int_user',
      eventType: 'BROKER_FAILOVER' as any,
      data: { from: 'zerodha', to: 'angel' },
      previousHash: 'genesis',
      hash: 'mongo_def_hash',
    });

    const latest = await storage.getLatestEvent();
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe('mongo-test-002');
  });

  it('should query events by userId', async () => {
    if (!available) return;

    // Create events of our own
    await storage.appendEvent({
      id: 'mongo-q-001',
      timestamp: new Date().toISOString(),
      userId: 'mongo_query_user',
      eventType: 'ORDER_EXECUTION' as any,
      data: { seq: 1 },
      previousHash: 'GENESIS_BLOCK',
      hash: 'hash001',
    });
    await storage.appendEvent({
      id: 'mongo-q-002',
      timestamp: new Date(Date.now() + 1).toISOString(),
      userId: 'mongo_query_user',
      eventType: 'LOCKDOWN_TRIGGERED' as any,
      data: { seq: 2 },
      previousHash: 'hash001',
      hash: 'hash002',
    });

    const events = await storage.queryEvents({ userId: 'mongo_query_user' });
    expect(events.length).toBeGreaterThanOrEqual(2);
    events.forEach((e) => expect(e.userId).toBe('mongo_query_user'));
  });

  it('should return event count', async () => {
    if (!available) return;

    // Create some events to count
    await storage.appendEvent({
      id: 'mongo-count-001',
      timestamp: new Date().toISOString(),
      userId: 'mongo_count_user',
      eventType: 'ORDER_EXECUTION' as any,
      data: {},
      previousHash: 'GENESIS_BLOCK',
      hash: 'hash001',
    });
    await storage.appendEvent({
      id: 'mongo-count-002',
      timestamp: new Date(Date.now() + 1).toISOString(),
      userId: 'mongo_count_user',
      eventType: 'ORDER_EXECUTION' as any,
      data: {},
      previousHash: 'hash001',
      hash: 'hash002',
    });

    const count = await storage.getEventCount();
    expect(count).toBe(2);
  });

  it('should get event by id', async () => {
    if (!available) return;

    // Create an event to retrieve
    await storage.appendEvent({
      id: 'mongo-get-by-id-001',
      timestamp: new Date().toISOString(),
      userId: 'mongo_get_by_id_user',
      eventType: 'ORDER_EXECUTION' as any,
      data: { symbol: 'INFY' },
      previousHash: 'GENESIS_BLOCK',
      hash: 'hash001',
    });

    const event = await storage.getEvent('mongo-get-by-id-001');
    expect(event).not.toBeNull();
    expect(event!.id).toBe('mongo-get-by-id-001');
    expect(event!.data.symbol).toBe('INFY');
  });

  it('should return null for non-existent event', async () => {
    if (!available) return;
    const event = await storage.getEvent('non-existent-' + Date.now());
    expect(event).toBeNull();
  });

  // ──── Risk Profiles ────

  it('should save and load a risk profile', async () => {
    if (!available) return;

    const userId = 'mongo_risk_user_' + Date.now();
    const profile = {
      userId,
      limits: { dailyLossLimit: 10000, dailyLossPercentLimit: 15, maxPositionSizePercent: 25 },
      lockdown: { status: 'NONE', triggeredAt: null, liftsAt: null, triggerLoss: null, breachedLimit: null },
      today: { date: '2026-05-26', realizedPnL: 0, unrealizedPnL: 0, peakValue: 200000, totalCharges: 0, tradeCount: 0 },
      portfolioValueAtOpen: 200000,
      settingsFrozen: false,
      settingsFrozenUntil: null,
      updatedAt: new Date().toISOString(),
    };

    await storage.saveRiskProfile(profile as any);
    const loaded = await storage.loadRiskProfile(userId);
    expect(loaded).not.toBeNull();
    expect(loaded!.userId).toBe(userId);
    expect((loaded as any).limits.dailyLossLimit).toBe(10000);

    // Cleanup
    await storage.deleteRiskProfile(userId);
    const afterDelete = await storage.loadRiskProfile(userId);
    expect(afterDelete).toBeNull();
  });

  // ──── Broker State ────

  it('should save and load broker state', async () => {
    if (!available) return;

    const state = {
      currentBrokerType: 'angel',
      dedupCache: {
        angel: { lastEvent: 'BROKER_CONNECTED' as const, timestamp: Date.now() },
        zerodha: { lastEvent: 'BROKER_DISCONNECTED' as const, timestamp: Date.now() - 60000 },
      },
    };

    await storage.saveBrokerState(state);
    const loaded = await storage.loadBrokerState();
    expect(loaded.currentBrokerType).toBe('angel');
    expect(loaded.dedupCache.angel.lastEvent).toBe('BROKER_CONNECTED');
    expect(loaded.dedupCache.zerodha.lastEvent).toBe('BROKER_DISCONNECTED');
  });

  // ──── Health ────

  it('should report healthy', async () => {
    if (!available) return;
    const healthy = await storage.isHealthy();
    expect(healthy).toBe(true);
  });
});
