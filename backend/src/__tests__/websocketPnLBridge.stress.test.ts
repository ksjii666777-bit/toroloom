/**
 * ============================================================================
 * Toroloom WebSocket → RiskEngine P&L Bridge — Stress Test
 * ============================================================================
 *
 * Runs the lockdown trigger + lift cycle 20 times to validate long-term
 * stability.  Uses a **single persistent WebSocket connection** across all
 * iterations to avoid TCP TIME_WAIT port exhaustion on Windows (each
 * short-lived TCP socket occupies an ephemeral port for ~4 minutes).
 *
 * Between iterations the risk engine state is reset and the subscription
 * is cycled (unsubscribe → subscribe) to exercise listener churn without
 * incurring new TCP connections.  This models real-world usage where a
 * user keeps a WebSocket session open for the trading day.
 *
 * Each iteration:
 *   Reset risk engine → re-subscribe → wait for 1st tick →
 *   configure tight limit →
 *   TRIGGER lockdown via riskEngine.updateUnrealizedPnL(-X) (deterministic) →
 *   verify lockdown state/counters are correct →
 *   LIFT lockdown via riskEngine.updateUnrealizedPnL(+X) (deterministic) →
 *   verify lockdown released
 *
 * The trigger/lift steps use direct riskEngine API calls — 100% deterministic
 * and instant.  The WebSocket → RiskEngine event emission is already tested
 * in websocketPnLBridge.test.ts (test 11).  This test focuses purely on
 * survival under repeated reset→subscribe→trigger→lift churn.
 *
 * Server lifecycle:
 *   beforeAll  →   HTTP server on random port + WebSocket handler
 *                  WebSocket connection + auth
 *   afterAll   →   Close WebSocket + WebSocket server + HTTP server
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/websocketPnLBridge.stress.test.ts
 *
 * Expected duration: ~1 minute (deterministic)
 * ============================================================================
 */

vi.hoisted(() => {
  process.env.BROKER = 'mock';
  process.env.DATA_SOURCE = 'mock';
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { WebSocketServer } from 'ws';
import { setupWebSocket } from '../websocket/handler';
import { riskEngine, LockdownStatus, DEFAULT_RISK_LIMITS } from '../services/riskEngine';
import { generateToken } from '../middleware/auth';
import { createBufferedClient } from './testUtils';

// ──── Configuration ─────────────────────────────────────────────────────────

/** Number of stress iterations to run. */
const ITERATIONS = 20;

/**
 * Timeout for the first tick wait per iteration.
 * Mock broker fires every 1–3 seconds, so 15s gives ~5–15 ticks.
 */
const FIRST_TICK_TIMEOUT_MS = 15_000;

/**
 * Overall test timeout.
 * Formula: ITERATIONS × (subscribe + 1 tick + trigger + lift) × 2x buffer
 * Each iteration takes ~3-5s, 20 iterations → ~60-100s.  Set to 5 min.
 */
const SUITE_TIMEOUT_MS = 300_000;

// ──── Test User (single user, reused across all iterations) ─────────────────

const TEST_USER = { userId: 'ws_stress_user', email: 'stress@toroloom.dev' };
const VALID_TOKEN = generateToken(TEST_USER);

// ──── Utilities ─────────────────────────────────────────────────────────────

/** Completely reset the risk engine for the test user. */
function resetRiskEngine(): void {
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
    profile.settingsFrozen = false;
    profile.settingsFrozenUntil = null;
    profile.limits.dailyLossLimit = DEFAULT_RISK_LIMITS.dailyLossLimit;
  }
}

/**
 * Read the current total P&L for the test user from the risk engine.
 */
function currentTotalPnL(): number {
  const state = riskEngine.getState(TEST_USER.userId);
  return state.today.realizedPnL + state.today.unrealizedPnL;
}

/**
 * Drain ALL pending messages from the buffered client's queue.
 *
 * Without this, stale pnl_update / tick messages from a previous
 * iteration's subscription remain in the buffer and are dequeued
 * by the next iteration's nextMessage() BEFORE the 'subscribed'
 * response, causing assertion failures.
 *
 * Each drain attempt uses a 10ms timeout so we don't hang if the
 * buffer is already empty.  We loop until the buffer is confirmed
 * empty (timeout fires).
 */
async function drainBuffer(c: Awaited<ReturnType<typeof createBufferedClient>>): Promise<void> {
  const DRAIN_TIMEOUT_MS = 10;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await Promise.race([
        c.nextMessage(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('drain timeout')), DRAIN_TIMEOUT_MS)),
      ]);
      // consumed a message — continue draining
    } catch {
      // Timed out — buffer is empty
      break;
    }
  }
}

// ──── Server & Client State ────────────────────────────────────────────────

let server: http.Server;
let wss: WebSocketServer;
let port: number;
let client: Awaited<ReturnType<typeof createBufferedClient>>;

/**
 * Run one full lockdown trigger + lift cycle.
 *
 * This is 100% deterministic — no stochastic tick waits.
 * The trigger and lift both use riskEngine.updateUnrealizedPnL() directly.
 *
 * Before calling, the risk engine must be reset and the subscription active.
 * The function waits for the first tick to establish a baseline P&L, then
 * uses direct API calls for the trigger/lift.
 */
async function runLockdownCycle(
  c: Awaited<ReturnType<typeof createBufferedClient>>,
): Promise<void> {
  // ── Step 0: Drain any stale messages from previous iteration ──
  // Must be done BEFORE sending subscribe so that nextMessage()
  // in Step 1 returns the 'subscribed' response, not a stale tick.
  await drainBuffer(c);

  // ── Step 1: Subscribe (fresh interval for this iteration) ─────
  c.ws.send(JSON.stringify({ type: 'subscribe', symbols: ['RELIANCE'] }));
  const subMsg = await c.nextMessage();
  expect(subMsg.type).toBe('subscribed');
  expect(subMsg.count).toBe(1);

  // ── Step 2: Wait for first tick (refreshes positions in risk engine) ─
  const ticks = await c.waitForTicks(1, FIRST_TICK_TIMEOUT_MS);
  expect(ticks.length).toBe(1);
  expect(ticks[0].data.symbol).toBe('RELIANCE');
  expect(ticks[0].data.lastPrice).toBeGreaterThan(0);

  // At this point the risk engine holds the baseline P&L from the tick.
  // We configure a tight limit (buffer = ₹1), then directly set P&L
  // negative to trigger lockdown deterministically.

  // ── Step 3: Configure tight limit (buffer = ₹1) ───────────────
  const livePnL = currentTotalPnL();
  const profile = riskEngine.getProfile(TEST_USER.userId);

  const buffer = 1;
  profile.limits.dailyLossLimit = buffer;
  // Set realizedPnL so that total P&L is exactly +1 (just inside limit)
  profile.today.realizedPnL = -(profile.today.unrealizedPnL - buffer);

  expect(currentTotalPnL()).toBe(buffer);
  expect(profile.lockdown.status).toBe(LockdownStatus.NONE);

  // ── Step 4: TRIGGER lockdown deterministically ────────────────
  // Set a large negative unrealized P&L to push total past the limit.
  // The risk engine's updateUnrealizedPnL() checks total P&L and
  // triggers lockdown if currentLoss < 0 AND absLoss >= limit.
  riskEngine.updateUnrealizedPnL(
    TEST_USER.userId,
    -99999, // deep loss → instant trigger
  );

  const triggerState = riskEngine.getState(TEST_USER.userId);
  expect(triggerState.lockdown.status).toBe(LockdownStatus.ACTIVE);
  expect(triggerState.settingsFrozen).toBe(true);
  expect(triggerState.lockdown.triggeredAt).toBeDefined();
  expect(triggerState.lockdown.triggerLoss).toBeGreaterThanOrEqual(99999);
  expect(triggerState.lockdown.breachedLimit).toBe('daily_loss');
  expect(triggerState.today.unrealizedPnL).toBe(-99999);

  // ── Step 5: LIFT lockdown deterministically ───────────────────
  // Set a large positive unrealized P&L to bring total above limit.
  riskEngine.updateUnrealizedPnL(TEST_USER.userId, 99999);

  const liftState = riskEngine.getState(TEST_USER.userId);
  expect(liftState.lockdown.status).toBe(LockdownStatus.NONE);
  expect(liftState.settingsFrozen).toBe(false);
  expect(liftState.lockdown.triggeredAt).toBeNull();
  expect(liftState.lockdown.triggerLoss).toBeNull();
  expect(liftState.today.unrealizedPnL).toBe(99999);
}

// ──── Stress Test Suite ─────────────────────────────────────────────────────

describe('WebSocket → RiskEngine P&L Bridge — Stress Test', () => {

  beforeAll(async () => {
    server = http.createServer();
    wss = setupWebSocket(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });

    // Create a single WebSocket connection reused across all iterations
    client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    // Authenticate once
    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated
  });

  afterAll(async () => {
    await riskEngine.resetForTesting();
    client?.close();
    wss?.close();
    server?.close();
  });

  it(
    `should survive ${ITERATIONS} consecutive lockdown trigger + lift cycles`,
    async () => {
      for (let i = 1; i <= ITERATIONS; i++) {
        const iterationStart = Date.now();

        try {
          // Reset risk engine before each cycle
          resetRiskEngine();
          riskEngine.setPortfolioValue(TEST_USER.userId, 1000000);

          await runLockdownCycle(client);

          const elapsed = Date.now() - iterationStart;
          console.log(
            `[Stress] Iteration ${i}/${ITERATIONS} — PASS (${(elapsed / 1000).toFixed(1)}s)`,
          );
        } catch (error) {
          throw new Error(
            `Iteration ${i}/${ITERATIONS} FAILED: ${(error as Error).message}`,
          );
        }
      }
    },
    SUITE_TIMEOUT_MS,
  );
});
