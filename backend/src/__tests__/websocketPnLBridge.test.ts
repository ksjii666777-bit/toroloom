/**
 * ============================================================================
 * Toroloom WebSocket → RiskEngine P&L Bridge — Integration Tests
 * ============================================================================
 *
 * Verifies the full real-time flow:
 *
 *   WebSocket connect → auth → subscribe → tick → riskEngine.updateUnrealizedPnL()
 *
 * This validates that the Financial Bodyguard receives live mark-to-market
 * P&L updates from WebSocket price ticks, enabling lockdown enforcement from
 * pure market movement without requiring an explicit trade.
 *
 * Test server lifecycle:
 *   beforeAll  →   HTTP server on random port + WebSocket handler
 *   afterAll   →   Close WebSocket server + HTTP server
 *   beforeEach →   Reset riskEngine state for the test user
 *   afterEach  →   Clean up riskEngine state (lockdown, daily MTM)
 *
 * Run: npx vitest run --reporter=verbose
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { WebSocketServer } from 'ws';
import { setupWebSocket } from '../websocket/handler';
import { riskEngine, LockdownStatus, DEFAULT_RISK_LIMITS } from '../services/riskEngine';
import { generateToken } from '../middleware/auth';
import { createBufferedClient, waitForEvent } from './testUtils';

// ──── Test User ─────────────────────────────────────────────────────────────
const TEST_USER = { userId: 'ws_pnl_test_user', email: 'ws-pnl@toroloom.dev' };
const VALID_TOKEN = generateToken(TEST_USER);

// ──── Server State ──────────────────────────────────────────────────────────
let server: http.Server;
let wss: WebSocketServer;
let port: number;

// ──── Test Suite ────────────────────────────────────────────────────────────

describe('WebSocket → RiskEngine P&L Bridge', () => {

  beforeAll(async () => {
    server = http.createServer();
    wss = setupWebSocket(server);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    wss?.close();
    server?.close();
  });

  beforeEach(() => {
    riskEngine.setPortfolioValue(TEST_USER.userId, 1000000);
  });

  afterEach(() => {
    riskEngine.resetDaily(TEST_USER.userId);
    const profile = riskEngine.getProfile(TEST_USER.userId);
    if (profile) {
      // Reset lockdown so state doesn't bleed between tests
      profile.lockdown = {
        status: LockdownStatus.NONE,
        triggeredAt: null,
        liftsAt: null,
        triggerLoss: null,
        breachedLimit: null,
      };
      // Restore default loss limit (tests may modify it)
      profile.limits.dailyLossLimit = DEFAULT_RISK_LIMITS.dailyLossLimit;
    }
  });

  // ──────────────── 1. Auth Seeds Initial P&L ────────────────

  it('should seed unrealized P&L from broker positions on auth', async () => {
    const client = await createBufferedClient(port);

    // Receive welcome message
    const connected = await client.nextMessage();
    expect(connected.type).toBe('connected');

    // Authenticate with a valid JWT
    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    // Auth now emits pnl_update BEFORE authenticated — consume it first
    const pnlUpdate = await client.nextMessage();
    expect(pnlUpdate.type).toBe('pnl_update');
    const authResponse = await client.nextMessage();
    expect(authResponse.type).toBe('authenticated');
    expect(authResponse.userId).toBe(TEST_USER.userId);
    expect(authResponse.positionsCount).toBeGreaterThan(0);

    // The risk engine should now hold the initial aggregate unrealized P&L
    // from the mock broker's positions (all positions are profitable)
    const state = riskEngine.getState(TEST_USER.userId);
    expect(state.today.unrealizedPnL).toBeGreaterThan(0);

    client.close();
  });

  // ──────────────── 2. Tick Updates Unrealized P&L ────────────────

  it('should update unrealized P&L on every market tick for a held symbol', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    // Auth
    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated

    // Capture the initial P&L seeded from broker positions
    const initialPnL = riskEngine.getState(TEST_USER.userId).today.unrealizedPnL;
    expect(initialPnL).toBeGreaterThan(0);

    // Subscribe to RELIANCE — the mock user holds 50 shares @ ₹2,650
    client.ws.send(JSON.stringify({ type: 'subscribe', symbols: ['RELIANCE'] }));
    const subResponse = await client.nextMessage();
    expect(subResponse.type).toBe('subscribed');
    expect(subResponse.count).toBe(1);

    // Wait for 1 market tick (mock broker fires every 1–3 seconds)
    await client.waitForTicks(1);

    // After the tick, the unrealized P&L should reflect the new
    // mark-to-market price and differ from the initial value
    const updatedState = riskEngine.getState(TEST_USER.userId);
    expect(typeof updatedState.today.unrealizedPnL).toBe('number');
    expect(updatedState.today.unrealizedPnL).not.toBe(initialPnL);

    client.close();
  }, 15000);

  // ──────────────── 3. Multi-Symbol Aggregation ────────────────

  it('should aggregate P&L across multiple held positions', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated

    // Subscribe to all symbols the mock user holds positions in
    client.ws.send(JSON.stringify({
      type: 'subscribe',
      symbols: ['RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'SBIN'],
    }));
    const subResponse = await client.nextMessage();
    expect(subResponse.type).toBe('subscribed');
    expect(subResponse.count).toBe(5);

    // Wait for 1 tick to propagate through all positions
    await client.waitForTicks(1);

    // The aggregate P&L should reflect all positions combined
    const state = riskEngine.getState(TEST_USER.userId);
    expect(state.today.unrealizedPnL).not.toBe(0);

    client.close();
  }, 15000);

  // ──────────────── 4. Auth Required Before Subscribe ────────────────

  it('should reject subscribe without prior authentication', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    // Attempt subscribe without an auth first
    client.ws.send(JSON.stringify({ type: 'subscribe', symbols: ['RELIANCE'] }));
    const response = await client.nextMessage();
    expect(response.type).toBe('error');
    expect(response.message).toContain('Authenticate');

    client.close();
  });

  // ──────────────── 5. Disconnect Does Not Corrupt Engine ────────────────

  it('should not corrupt risk engine state when client disconnects', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated

    // Verify P&L is tracked before disconnect
    expect(riskEngine.getState(TEST_USER.userId).today.unrealizedPnL).not.toBe(0);

    // Disconnect
    client.close();

    // Allow cleanup handlers to fire
    await new Promise((r) => setTimeout(r, 300));

    // The risk engine should still hold the user's P&L state after disconnect
    // (only the WebSocket cache is cleaned — risk profile persists in memory)
    expect(riskEngine.getState(TEST_USER.userId).today.unrealizedPnL).not.toBe(0);
  });

  // ──────────────── 6. Invalid Token Rejected ────────────────

  it('should reject authentication with an invalid JWT token', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    client.ws.send(JSON.stringify({ type: 'auth', token: 'definitely-not-a-valid-jwt' }));
    const response = await client.nextMessage();
    expect(response.type).toBe('error');
    expect(response.message).toContain('Invalid');

    client.close();
  });

  // ──────────────── 7. Unknown Message Type ────────────────

  it('should respond with an error for unknown message types', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    client.ws.send(JSON.stringify({ type: 'do_a_barrel_roll', payload: {} }));
    const response = await client.nextMessage();
    expect(response.type).toBe('error');
    expect(response.message).toContain('Unknown message type');

    client.close();
  });

  // ──────────────── 8. Pong Response ────────────────

  it('should respond to ping with a pong', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    client.ws.send(JSON.stringify({ type: 'ping' }));
    const response = await client.nextMessage();
    expect(response.type).toBe('pong');
    expect(response.timestamp).toBeDefined();

    client.close();
  });

  // ──────────────── 9. Tick Contains Quote Data ────────────────

  it('should forward price tick data to the client with correct fields', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated

    client.ws.send(JSON.stringify({ type: 'subscribe', symbols: ['RELIANCE'] }));
    await client.nextMessage(); // subscribed

    // Wait for the first tick and inspect its structure
    const ticks = await client.waitForTicks(1);
    expect(ticks.length).toBe(1);

    const tick = ticks[0];
    expect(tick.data).toBeDefined();
    expect(tick.data.symbol).toBe('RELIANCE');
    expect(typeof tick.data.lastPrice).toBe('number');
    expect(tick.data.lastPrice).toBeGreaterThan(0);
    expect(typeof tick.data.change).toBe('number');
    expect(typeof tick.data.changePercent).toBe('number');
    expect(tick.data.timestamp).toBeDefined();

    client.close();
  }, 15000);

  // ──────────────── 10. Missing Token Rejected ────────────────

  it('should reject auth when no token is provided', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    client.ws.send(JSON.stringify({ type: 'auth' }));
    const response = await client.nextMessage();
    expect(response.type).toBe('error');
    expect(response.message).toContain('Token is required');

    client.close();
  });

  // ──────────────── 11. Lockdown Trigger + Lift (Risk Engine State) ────
  //
  // The WS → risk engine pipeline is exercised in tests 1-3 (tick P&L
  // seeding) and the stress test (20 iterations of the full stochastic
  // pipeline with WS event emission).  This test focuses on the risk
  // engine's lockdown state machine: trigger and lift from a direct
  // updateUnrealizedPnL() call, WITHOUT stochastic tick interference.
  //
  // The WS handler detects lockdown transitions by comparing previous
  // vs current lockdown status (see emitRiskEvents in handlers.ts).
  // That comparison is exercised by the stress test on real ticks.

  it('should trigger lockdown on loss and lift on P&L recovery', async () => {
    const livePnL = riskEngine.getState(TEST_USER.userId).today.unrealizedPnL;
    const profile = riskEngine.getProfile(TEST_USER.userId);
    const buffer = 1;

    // ── Step 1: Configure risk engine near zero ────────────────
    profile.limits.dailyLossLimit = buffer;
    profile.today.realizedPnL = -(livePnL - buffer);

    expect(profile.today.realizedPnL + profile.today.unrealizedPnL).toBe(buffer);
    expect(profile.lockdown.status).toBe(LockdownStatus.NONE);

    // ── Step 2: Trigger lockdown via direct risk engine call ────
    riskEngine.updateUnrealizedPnL(TEST_USER.userId, -99999);

    const midState = riskEngine.getState(TEST_USER.userId);
    expect(midState.lockdown.status).toBe(LockdownStatus.ACTIVE);
    expect(midState.settingsFrozen).toBe(true);
    expect(midState.lockdown.triggerLoss).toBeGreaterThan(0);
    expect(midState.lockdown.breachedLimit).toBe('daily_loss');
    expect(midState.lockdown.triggeredAt).toBeDefined();

    // ── Step 3: Lift lockdown via direct risk engine call ───────
    riskEngine.updateUnrealizedPnL(TEST_USER.userId, 99999);

    const finalState = riskEngine.getState(TEST_USER.userId);
    expect(finalState.lockdown.status).toBe(LockdownStatus.NONE);
    expect(finalState.settingsFrozen).toBe(false);
    expect(finalState.lockdown.triggerLoss).toBeNull();
    expect(finalState.lockdown.triggeredAt).toBeNull();
  });
});
