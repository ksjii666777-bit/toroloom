/**
 * ============================================================================
 * Toroloom WebSocket → RiskEngine P&L Bridge — PostgreSQL Integration
 * ============================================================================
 *
 * Validates the full end-to-end persistence pipeline:
 *
 *   WebSocket connect → auth → subscribe → tick →
 *   riskEngine.updateUnrealizedPnL() → PostgreSQLStorage.saveRiskProfile()
 *
 * These tests go beyond the unit-level websocketPnLBridge.test.ts by verifying
 * that risk profiles are actually PERSISTED to PostgreSQL after every mutation
 * through the WebSocket pipeline — not just held in memory.
 *
 * Scenarios:
 *   1. Auth  →  profile persisted with seeded P&L from broker positions
 *   2. Tick  →  profile updated in DB with new unrealized P&L
 *   3. Lockdown  →  lockdown state persisted to DB when triggered via WS flow
 *   4. Load  →  loadRiskProfile() returns correctly persisted data
 *
 * Environment:
 *   DATABASE_URL — defaults to Docker Compose connection string
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/websocketPnLBridge.postgres.int.test.ts
 *
 * Skip:
 *   Tests skip automatically if PostgreSQL is unreachable.
 * ============================================================================
 */

// Force mock broker to prevent the Angel One smartapi-javascript WebSocket
// client from attempting real connections (backend/.env has BROKER=angel).
vi.hoisted(() => {
  process.env.BROKER = 'mock';
  process.env.DATA_SOURCE = 'mock';
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { WebSocketServer } from 'ws';
import { setupWebSocket } from '../websocket/handler';
import { riskEngine, LockdownStatus, DEFAULT_RISK_LIMITS } from '../services/riskEngine';
import { PostgreSQLStorage } from '../services/storage/postgres';
import { generateToken } from '../middleware/auth';
import { createBufferedClient } from './testUtils';

// ──── Configuration ─────────────────────────────────────────────────────────

// IMPORTANT: This test file must NOT run in parallel with other *.int.test.ts
// files that configure riskEngine (e.g. websocketPnLBridge.mongodb.int.test.ts)
// because they all share the same riskEngine singleton. Each file's
// configureStorage() overwrites the previous one. Run files individually or
// use vitest's --sequence.concurrent=false flag.

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://toroloom:toroloom_dev@localhost:5432/toroloom';

const TEST_USER = { userId: 'ws_pg_int_user', email: 'ws-pg-int@toroloom.dev' };
const VALID_TOKEN = generateToken(TEST_USER);

// Separate user ID for the "load from storage" test to avoid cache contamination
const LOAD_TEST_USER = { userId: 'ws_pg_load_test', email: 'ws-pg-load@toroloom.dev' };

// ──── Server & Client State ─────────────────────────────────────────────────

let server: http.Server;
let wss: WebSocketServer;
let port: number;
let storage: PostgreSQLStorage;
let available = true;

// ──── Test Suite ────────────────────────────────────────────────────────────

describe('WebSocket → RiskEngine P&L Bridge — PostgreSQL Integration', () => {

  beforeAll(async () => {
    // ── HTTPS server + WebSocket ──────────────────────────────
    server = http.createServer();
    wss = setupWebSocket(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });

    // ── PostgreSQL ─────────────────────────────────────────────
    storage = new PostgreSQLStorage(DATABASE_URL);
    try {
      await Promise.race([
        storage.connect(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('connect timeout (15s)')), 15_000),
        ),
      ]);
      riskEngine.configureStorage(storage);
    } catch (err: any) {
      console.warn(
        `⚠ PostgreSQL not available (${err.message}) — skipping WebSocket + PG integration tests`,
      );
      available = false;
    }
  }, 30_000);

  afterAll(async () => {
    if (available && storage) {
      await storage.clearForTesting();
    }
    // Drain pending persists and reset singleton BEFORE disconnecting
    // storage, so any in-flight writes complete against connected DB
    await riskEngine.resetForTesting();
    if (available && storage) {
      await storage.disconnect();
    }
    wss?.close();
    server?.close();
  });

  beforeEach(async () => {
    if (!available) return;
    // Clear the database to prevent cross-test contamination
    await storage.clearForTesting();
    riskEngine.setPortfolioValue(TEST_USER.userId, 1_000_000);
  });

  afterEach(() => {
    if (!available) return;
    riskEngine.resetDaily(TEST_USER.userId);
    const profile = riskEngine.getProfile(TEST_USER.userId);
    if (profile) {
      profile.lockdown = {
        status: LockdownStatus.NONE,
        triggeredAt: null,
        liftsAt: null,
        triggerLoss: null,
        breachedLimit: null,
      };
      profile.limits.dailyLossLimit = DEFAULT_RISK_LIMITS.dailyLossLimit;
    }
  });

  // ──────────────── 1. Auth Persists Profile ────────────────

  it('should persist risk profile to PostgreSQL after WebSocket auth seeds P&L', async () => {
    if (!available) return;

    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    // Auth — this seeds the risk engine with unrealized P&L from broker positions
    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated

    // Load from PostgreSQL to verify the profile was persisted
    const persisted = await storage.loadRiskProfile(TEST_USER.userId);
    expect(persisted).not.toBeNull();
    expect(persisted!.userId).toBe(TEST_USER.userId);
    // Mock broker has 5 positions all in profit → positive unrealized P&L
    expect(persisted!.today.unrealizedPnL).toBeGreaterThan(0);
    expect(persisted!.portfolioValueAtOpen).toBe(1_000_000);

    client.close();
  });

  // ──────────────── 2. Tick Persists P&L ────────────────

  it('should persist updated unrealized P&L to PostgreSQL after a market tick', async () => {
    if (!available) return;

    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated

    // Capture the initially seeded P&L
    const persistedBefore = await storage.loadRiskProfile(TEST_USER.userId);
    const initialPnL = persistedBefore!.today.unrealizedPnL;

    // Subscribe to a symbol the mock user holds → ticks start flowing
    client.ws.send(JSON.stringify({ type: 'subscribe', symbols: ['RELIANCE'] }));
    await client.nextMessage(); // subscribed

    // Wait for 1 tick to propagate through the risk engine
    await client.waitForTicks(1);

    // Drain pending persists to guarantee the tick's P&L update has
    // been written to PostgreSQL before we load from it.
    await riskEngine.drain(TEST_USER.userId);

    // Load the profile from PostgreSQL — the tick should have updated
    // the unrealized P&L to a different value
    const persistedAfter = await storage.loadRiskProfile(TEST_USER.userId);
    expect(persistedAfter).not.toBeNull();
    expect(persistedAfter!.today.unrealizedPnL).not.toBe(initialPnL);
    expect(typeof persistedAfter!.today.unrealizedPnL).toBe('number');

    client.close();
  }, 15_000);

  // ──────────────── 3. Lockdown Persists ────────────────

  it('should persist lockdown state to PostgreSQL when triggered via WebSocket flow', async () => {
    if (!available) return;

    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated

    // Subscribe so ticks flow through the P&L bridge
    client.ws.send(JSON.stringify({ type: 'subscribe', symbols: ['RELIANCE'] }));
    await client.nextMessage(); // subscribed
    await client.waitForTicks(1);

    // Close the WebSocket client BEFORE triggering lockdown. The
    // updateUnrealizedPnL() method has an else-branch that releases
    // lockdown when the total P&L recovers. If a tick arrives after
    // we set the lockdown but before the persist completes, it would
    // release the lockdown and the DB would show status=NONE.
    client.close();

    // Configure a razor-thin loss limit so the next P&L update triggers lockdown
    const profile = riskEngine.getProfile(TEST_USER.userId);
    profile.limits.dailyLossLimit = 1; // ₹1 — absurdly tight for test
    profile.today.realizedPnL = -(profile.today.unrealizedPnL - 1); // total P&L = ₹1

    // Trigger lockdown deterministically via risk engine
    riskEngine.updateUnrealizedPnL(TEST_USER.userId, -99_999);
    await riskEngine.drain(TEST_USER.userId);

    // Verify in-memory state
    const memState = riskEngine.getState(TEST_USER.userId);
    expect(memState.lockdown.status).toBe(LockdownStatus.ACTIVE);
    expect(memState.settingsFrozen).toBe(true);

    // Verify the lockdown state is persisted in PostgreSQL
    const persisted = await storage.loadRiskProfile(TEST_USER.userId);
    expect(persisted).not.toBeNull();
    expect(persisted!.lockdown.status).toBe(LockdownStatus.ACTIVE);
    expect(persisted!.lockdown.triggeredAt).toBeDefined();
    expect(persisted!.lockdown.liftsAt).toBeDefined();
    expect(persisted!.lockdown.triggerLoss).toBeGreaterThanOrEqual(99_999);
    expect(persisted!.lockdown.breachedLimit).toBe('daily_loss');
    expect(persisted!.settingsFrozen).toBe(true);
  });

  // ──────────────── 4. Load from Storage ────────────────

  it('should load a risk profile from PostgreSQL and reconcile it in memory', async () => {
    if (!available) return;

    // Step 1: Save a known profile directly to PostgreSQL (simulating data
    // from a previous server session)
    const savedProfile = riskEngine.getProfile(LOAD_TEST_USER.userId);
    savedProfile.today.unrealizedPnL = 42_000;
    savedProfile.today.realizedPnL = 8_000;
    savedProfile.portfolioValueAtOpen = 500_000;
    savedProfile.today.date = new Date().toISOString().split('T')[0];
    await storage.saveRiskProfile(savedProfile);

    // Step 2: Now simulate a "server restart" by calling loadProfileFromStorage.
    // This replaces the in-memory profile with the persisted data.
    const loaded = await riskEngine.loadProfileFromStorage(LOAD_TEST_USER.userId);

    // Step 3: Verify the loaded profile matches what was saved
    expect(loaded.userId).toBe(LOAD_TEST_USER.userId);
    expect(loaded.today.unrealizedPnL).toBe(42_000);
    expect(loaded.today.realizedPnL).toBe(8_000);
    expect(loaded.portfolioValueAtOpen).toBe(500_000);

    // Step 4: The risk engine's in-memory cache should now hold the loaded profile
    const fromCache = riskEngine.getProfile(LOAD_TEST_USER.userId);
    expect(fromCache.today.unrealizedPnL).toBe(42_000);

    // Cleanup
    await storage.deleteRiskProfile(LOAD_TEST_USER.userId);
  });

  // ──────────────── 5. Lift Lockdown Persists ────────────────

  it('should persist lockdown lift to PostgreSQL when P&L recovers', async () => {
    if (!available) return;

    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated

    // Close the client so no ticks arrive during lockdown manipulation
    client.close();

    // Trigger lockdown
    const profile = riskEngine.getProfile(TEST_USER.userId);
    profile.limits.dailyLossLimit = 1;
    profile.today.realizedPnL = -(profile.today.unrealizedPnL - 1);
    riskEngine.updateUnrealizedPnL(TEST_USER.userId, -99_999);
    await riskEngine.drain(TEST_USER.userId);

    // Verify lockdown persisted
    let persisted = await storage.loadRiskProfile(TEST_USER.userId);
    expect(persisted!.lockdown.status).toBe(LockdownStatus.ACTIVE);

    // Lift lockdown by recovering P&L
    riskEngine.updateUnrealizedPnL(TEST_USER.userId, 99_999);
    await riskEngine.drain(TEST_USER.userId);

    // Verify lockdown lifted in PostgreSQL
    persisted = await storage.loadRiskProfile(TEST_USER.userId);
    expect(persisted!.lockdown.status).toBe(LockdownStatus.NONE);
    expect(persisted!.lockdown.triggeredAt).toBeNull();
    expect(persisted!.lockdown.triggerLoss).toBeNull();
    expect(persisted!.settingsFrozen).toBe(false);
  });
});
