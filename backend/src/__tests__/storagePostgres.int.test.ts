/**
 * ============================================================================
 * Toroloom — PostgreSQL Storage Integration Tests
 * ============================================================================
 *
 * These tests require a running PostgreSQL instance.
 * Start one via Docker:
 *   docker compose up -d postgres
 *
 * Environment:
 *   DATABASE_URL — defaults to the Docker Compose connection string
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/storagePostgres.int.test.ts
 *
 * Skip:
 *   Tests are skipped automatically if PostgreSQL is unreachable.
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSQLStorage } from '../services/storage/postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://toroloom:toroloom_dev@localhost:5432/toroloom';

describe('PostgreSQLStorage Integration', () => {
  let storage: PostgreSQLStorage;
  let available = true;

  beforeAll(async () => {
    storage = new PostgreSQLStorage(DATABASE_URL);
    try {
      // Race the connect against a timeout so tests don't hang if DB is unreachable
      await Promise.race([
        storage.connect(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('connect timeout (15s)')), 15_000),
        ),
      ]);
    } catch (err: any) {
      console.warn(`⚠ PostgreSQL not available (${err.message}) — skipping integration tests`);
      available = false;
    }
  }, 20_000);

  afterAll(async () => {
    if (available && storage) {
      await storage.clearForTesting();
      await storage.disconnect();
    }
  });

  // ──── Audit Trail ────

  it('should append and retrieve an audit event', async () => {
    if (!available) return;

    const event = await storage.appendEvent({
      id: 'test-001',
      timestamp: new Date().toISOString(),
      userId: 'int_test_user',
      eventType: 'ORDER_EXECUTION' as any,
      data: { symbol: 'RELIANCE', qty: 10 },
      previousHash: 'GENESIS_BLOCK',
      hash: 'abc123hash',
    });

    expect(event.id).toBe('test-001');
    expect(event.data.symbol).toBe('RELIANCE');
  });

  it('should get the latest event', async () => {
    if (!available) return;

    await storage.appendEvent({
      id: 'test-002',
      timestamp: new Date().toISOString(),
      userId: 'int_test_user',
      eventType: 'LOCKDOWN_TRIGGERED' as any,
      data: { reason: 'limit_breach' },
      previousHash: 'genesis',
      hash: 'def456hash',
    });

    const latest = await storage.getLatestEvent();
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe('test-002');
  });

  it('should query events by userId', async () => {
    if (!available) return;

    const events = await storage.queryEvents({ userId: 'int_test_user' });
    expect(events.length).toBeGreaterThanOrEqual(2);
    events.forEach((e) => expect(e.userId).toBe('int_test_user'));
  });

  it('should return event count', async () => {
    if (!available) return;
    const count = await storage.getEventCount();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('should get event by id', async () => {
    if (!available) return;
    const event = await storage.getEvent('test-001');
    expect(event).not.toBeNull();
    expect(event!.id).toBe('test-001');
  });

  it('should return null for non-existent event', async () => {
    if (!available) return;
    const event = await storage.getEvent('non-existent');
    expect(event).toBeNull();
  });

  // ──── Risk Profiles ────

  it('should save and load a risk profile', async () => {
    if (!available) return;

    const profile = {
      userId: 'risk_test_user',
      limits: { dailyLossLimit: 5000, dailyLossPercentLimit: 10, maxPositionSizePercent: 20 },
      lockdown: { status: 'NONE', triggeredAt: null, liftsAt: null, triggerLoss: null, breachedLimit: null },
      today: { date: '2026-05-26', realizedPnL: 0, unrealizedPnL: 0, peakValue: 100000, totalCharges: 0, tradeCount: 0 },
      portfolioValueAtOpen: 100000,
      settingsFrozen: false,
      settingsFrozenUntil: null,
      updatedAt: new Date().toISOString(),
    };

    await storage.saveRiskProfile(profile as any);
    const loaded = await storage.loadRiskProfile('risk_test_user');
    expect(loaded).not.toBeNull();
    expect(loaded!.userId).toBe('risk_test_user');
    expect((loaded as any).limits.dailyLossLimit).toBe(5000);

    // Cleanup
    await storage.deleteRiskProfile('risk_test_user');
    const afterDelete = await storage.loadRiskProfile('risk_test_user');
    expect(afterDelete).toBeNull();
  });

  // ──── Broker State ────

  it('should save and load broker state', async () => {
    if (!available) return;

    const state = {
      currentBrokerType: 'zerodha',
      dedupCache: {
        zerodha: { lastEvent: 'BROKER_CONNECTED' as const, timestamp: Date.now() },
      },
    };

    await storage.saveBrokerState(state);
    const loaded = await storage.loadBrokerState();
    expect(loaded.currentBrokerType).toBe('zerodha');
    expect(loaded.dedupCache.zerodha.lastEvent).toBe('BROKER_CONNECTED');
  });

  // ──── Health ────

  it('should report healthy', async () => {
    if (!available) return;
    const healthy = await storage.isHealthy();
    expect(healthy).toBe(true);
  });
});
