/**
 * ============================================================================
 * Toroloom — riskEngine.resetForTesting() Cross-File Isolation (PostgreSQL)
 * ============================================================================
 *
 * Validates that resetForTesting() properly isolates the riskEngine singleton
 * across test file boundaries when using a PostgreSQL storage backend.
 *
 * These tests simulate the scenario that caused cross-file contamination:
 *   File A configures PG storage → writes data → afterAll resets
 *   File B configures PG storage → should see clean state
 *
 * Without resetForTesting(), File B would inherit File A's in-memory profiles,
 * pending persists, and storage reference — causing stale data writes to
 * the wrong backend or overwriting File B's fresh state with File A's data.
 *
 * Environment:
 *   DATABASE_URL — defaults to Docker Compose connection string
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/riskResetForTesting.postgres.int.test.ts
 *
 * Skip:
 *   Tests skip automatically if PostgreSQL is unreachable.
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { riskEngine } from '../services/riskEngine';
import { PostgreSQLStorage } from '../services/storage/postgres';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://toroloom:toroloom_dev@localhost:5432/toroloom';

const USER_A = 'reset_pg_user_a';
const USER_B = 'reset_pg_user_b';

// ──── Test Suite ─────────────────────────────────────────────────────────────

describe('riskEngine.resetForTesting() — PostgreSQL Cross-File Isolation', () => {
  let storage: PostgreSQLStorage;
  let available = true;

  beforeAll(async () => {
    storage = new PostgreSQLStorage(DATABASE_URL);
    try {
      await Promise.race([
        storage.connect(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('connect timeout (3s)')), 3_000),
        ),
      ]);
    } catch (err: any) {
      console.warn(
        `⚠ PostgreSQL not available (${err.message}) — skipping resetForTesting + PG integration tests`,
      );
      available = false;
    }
  }, 10_000);

  afterAll(async () => {
    if (available && storage) {
      await storage.clearForTesting();
    }
    // Drain pending persists and reset singleton BEFORE disconnecting storage
    await riskEngine.resetForTesting();
    if (available && storage) {
      await storage.disconnect();
    }
  });

  beforeEach(async () => {
    if (!available) return;
    // Start each test with a clean DB state
    await storage.clearForTesting();
    // Also reset the singleton so each test starts fresh
    await riskEngine.resetForTesting();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 1: Simulate File A → reset → File B (cross-file isolation)
  // ═══════════════════════════════════════════════════════════════════════════

  it('should isolate profiles across simulated file boundaries after reset', async () => {
    if (!available) return;

    // ── Phase 1: "File A" ────────────────────────────────────────────────
    riskEngine.configureStorage(storage);
    riskEngine.setPortfolioValue(USER_A, 500_000);
    riskEngine.recordTrade(USER_A, -10_000, 50, true);

    // Verify File A's data is in the DB
    await riskEngine.drain(USER_A);
    const persistedA = await storage.loadRiskProfile(USER_A);
    expect(persistedA).not.toBeNull();
    expect(persistedA!.portfolioValueAtOpen).toBe(500_000);
    expect(persistedA!.today.tradeCount).toBe(1);

    // ── Phase 2: "afterAll of File A" — reset the singleton ────────────
    await riskEngine.resetForTesting();

    // ── Phase 3: "File B" — configure storage fresh and use it ─────────
    riskEngine.configureStorage(storage);
    riskEngine.setPortfolioValue(USER_B, 1_000_000);
    riskEngine.recordTrade(USER_B, -5_000, 25, true);

    await riskEngine.drain(USER_B);

    // Load USER_B from DB — should reflect File B's data, not File A's
    const persistedB = await storage.loadRiskProfile(USER_B);
    expect(persistedB).not.toBeNull();
    expect(persistedB!.userId).toBe(USER_B);
    expect(persistedB!.portfolioValueAtOpen).toBe(1_000_000);
    expect(persistedB!.today.tradeCount).toBe(1);

    // Load USER_A from DB — should NOT be findable from scratch.
    // The profile was only in the singleton's cache (which was cleared).
    // It was saved to DB in Phase 1, but after the singleton reset, the
    // risk engine has no knowledge of USER_A. The DB still has it, but
    // that's correct — resetForTesting clears the cache, not the DB.
    // A subsequent loadProfileFromStorage(USER_A) would load it.
    const loadedA = await storage.loadRiskProfile(USER_A);
    expect(loadedA).not.toBeNull();
    expect(loadedA!.portfolioValueAtOpen).toBe(500_000);

    // Cleanup: remove USER_A's profile from DB so it doesn't leak to
    // other tests in this file
    await storage.deleteRiskProfile(USER_A);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 2: Pending persists are drained before reset
  // ═══════════════════════════════════════════════════════════════════════════

  it('should drain pending persists before clearing state', async () => {
    if (!available) return;

    riskEngine.configureStorage(storage);

    // Rapidly mutate state to create multiple pending persists
    riskEngine.setPortfolioValue(USER_A, 100_000);
    riskEngine.setPortfolioValue(USER_A, 200_000);
    riskEngine.setPortfolioValue(USER_A, 300_000);

    // Before reset, verify the latest persist is in-flight
    expect(riskEngine.getProfile(USER_A).portfolioValueAtOpen).toBe(300_000);

    // Reset — internally drains all pending persists
    await riskEngine.resetForTesting();

    // drain() should resolve immediately since pendingPersists is empty
    await expect(riskEngine.drain()).resolves.toBeUndefined();
    await expect(riskEngine.drain(USER_A)).resolves.toBeUndefined();

    // The storage reference is also cleared — configure it fresh
    riskEngine.configureStorage(storage);

    // The DB should have the latest value (300_000) because the eager
    // chaining in persistProfile ensures the last call wins, and drain
    // waited for it to complete.
    const persisted = await storage.loadRiskProfile(USER_A);
    expect(persisted).not.toBeNull();
    expect(persisted!.portfolioValueAtOpen).toBe(300_000);

    // Cleanup
    await storage.deleteRiskProfile(USER_A);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 3: Re-initialization after reset works independently
  // ═══════════════════════════════════════════════════════════════════════════

  it('should allow full re-initialization with fresh state after reset', async () => {
    if (!available) return;

    // ── Cycle 1 ──────────────────────────────────────────────────────────
    riskEngine.configureStorage(storage);
    riskEngine.setPortfolioValue(USER_A, 500_000);
    riskEngine.recordTrade(USER_A, -10_000, 50, true);
    expect(riskEngine.getProfile(USER_A).today.tradeCount).toBe(1);

    await riskEngine.resetForTesting();

    // ── Cycle 2 — completely fresh ───────────────────────────────────────
    riskEngine.configureStorage(storage);
    riskEngine.setPortfolioValue(USER_A, 750_000);
    riskEngine.recordTrade(USER_A, -8_000, 40, true);

    await riskEngine.drain(USER_A);

    // Verify the fresh state
    const profile = riskEngine.getProfile(USER_A);
    expect(profile.portfolioValueAtOpen).toBe(750_000);
    expect(profile.today.tradeCount).toBe(1);
    expect(profile.today.realizedPnL).toBe(-8_000);

    // Verify in DB too
    const persisted = await storage.loadRiskProfile(USER_A);
    expect(persisted!.portfolioValueAtOpen).toBe(750_000);
    expect(persisted!.today.tradeCount).toBe(1);

    // Cleanup
    await storage.deleteRiskProfile(USER_A);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test 4: Concurrent users don't leak across reset boundary
  // ═══════════════════════════════════════════════════════════════════════════

  it('should not leak user state across reset boundary', async () => {
    if (!available) return;

    riskEngine.configureStorage(storage);

    // User A writes data
    riskEngine.setPortfolioValue(USER_A, 100_000);
    await riskEngine.drain(USER_A);

    // Reset
    await riskEngine.resetForTesting();

    // User B starts fresh — should have zero portfolio by default
    riskEngine.configureStorage(storage);
    expect(riskEngine.getProfile(USER_B).portfolioValueAtOpen).toBe(0);

    // User B writes their own data
    riskEngine.setPortfolioValue(USER_B, 200_000);
    await riskEngine.drain(USER_B);

    // Verify in DB: User B has the correct value
    const persistedB = await storage.loadRiskProfile(USER_B);
    expect(persistedB!.portfolioValueAtOpen).toBe(200_000);

    // Verify User A's DB record still has the original value
    const persistedA = await storage.loadRiskProfile(USER_A);
    expect(persistedA!.portfolioValueAtOpen).toBe(100_000);

    // Cleanup
    await storage.deleteRiskProfile(USER_A);
    await storage.deleteRiskProfile(USER_B);
  });
});
