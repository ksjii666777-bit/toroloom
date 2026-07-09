/**
 * ============================================================================
 * Toroloom Sync → WebSocket Invalidation — Integration Tests
 * ============================================================================
 *
 * Tests the full push-based cache invalidation pipeline end-to-end:
 *
 *   WebSocket connects → authenticates
 *   POST /api/sync (with mutation) → processes mutation
 *   syncInvalidationBridge broadcasts cache_invalidate → WebSocket client receives it
 *
 * This validates that when data changes on the server via the sync API,
 * all active WebSocket connections for that user are immediately notified
 * with the correct entity types and namespace hints.
 *
 * Test server lifecycle:
 *   beforeAll  → HTTP server + Express app + sync router + WebSocket handler
 *   afterAll   → Close WebSocket server + HTTP server
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/syncInvalidation.int.test.ts
 * ============================================================================
 */

vi.hoisted(() => {
  process.env.BROKER = 'mock';
  process.env.DATA_SOURCE = 'mock';
});

// Mock authMiddleware for Express routes so we don't need real JWTs for HTTP.
// Preserve the real generateToken for WebSocket authentication.
vi.mock('../middleware/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../middleware/auth')>();
  return {
    ...actual,
    authMiddleware: (req: any, _res: any, next: any) => {
      req.user = { userId: 'sync_int_test_user', email: 'sync-int@toroloom.dev' };
      next();
    },
  };
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { setupWebSocket } from '../websocket/handler';
import { createBufferedClient, waitForEvent } from './testUtils';
import { generateToken } from '../middleware/auth';
import syncRoutes from '../services/syncService';
import { setWSS, getWSS } from '../services/syncInvalidationBridge';
import { clients } from '../websocket/state';

// ──── Test Constants ────────────────────────────────────────────────────────

const TEST_USER = { userId: 'sync_int_test_user', email: 'sync-int@toroloom.dev' };
const VALID_TOKEN = generateToken(TEST_USER);

// ──── Server State ──────────────────────────────────────────────────────────

let server: http.Server;
let wss: WebSocketServer;
let app: express.Application;
let port: number;
let baseUrl: string;

// ──── Test Suite ────────────────────────────────────────────────────────────

describe('Sync → WebSocket Invalidation Pipeline', () => {

  beforeAll(async () => {
    // ── 1. Express app with the sync router ──
    app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use('/api/sync', syncRoutes);

    // ── 2. HTTP + WebSocket server ──
    server = http.createServer(app);
    wss = setupWebSocket(server);

    // ── 3. Wire the bridge — this is what connects sync mutations
    //    to WebSocket broadcasts. Without this, no invalidations flow. ──
    setWSS(wss);

    // ── 4. Start listening on a random port ──
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    wss?.close();
    server?.close();
  });

  // ──────────────── 1. Cache invalidation after sync mutation ──────────────

  it('should broadcast cache_invalidate to WebSocket client after sync mutation', async () => {
    // ── Step 1: Connect WebSocket client ──
    const client = await createBufferedClient(port);

    // Consume welcome message
    const connected = await client.nextMessage();
    expect(connected.type).toBe('connected');

    // ── Step 2: Authenticate over WebSocket ──
    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));

    // Consume pnl_update (emitted on auth)
    const pnlUpdate = await client.nextMessage();
    expect(pnlUpdate.type).toBe('pnl_update');

    // Consume authenticated response
    const authResponse = await client.nextMessage();
    expect(authResponse.type).toBe('authenticated');
    expect(authResponse.userId).toBe(TEST_USER.userId);

    // Verify the client is tracked in the WebSocket state
    expect(clients.size).toBeGreaterThan(0);

    // ── Step 3: Send a sync mutation via HTTP ──
    const entityId = `pos_int_test_${Date.now()}`;

    const syncResponse = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastSyncTimestamp: null,
        mutations: [{
          mutationId: `int_test_mut_${Date.now()}`,
          type: 'BUY_STOCK',
          entityType: 'position',
          entityId,
          payload: { symbol: 'RELIANCE', quantity: 10, price: 2500 },
          clientVersion: null,
          enqueuedAt: new Date().toISOString(),
        }],
      }),
    });

    expect(syncResponse.status).toBe(200);
    const syncBody = await syncResponse.json();
    expect(syncBody.applied).toHaveLength(1);

    // ── Step 4: Wait for the cache_invalidate message on WebSocket ──
    const invalidation = await waitForEvent(
      client,
      (msg) => msg.type === 'cache_invalidate',
      5000,
    );

    // ── Step 5: Validate the invalidation payload ──
    expect(invalidation.type).toBe('cache_invalidate');
    expect(invalidation.data).toBeDefined();

    // Should include the entity that was just mutated
    expect(invalidation.data.entities).toHaveLength(1);
    expect(invalidation.data.entities[0].entityType).toBe('position');
    expect(invalidation.data.entities[0].entityId).toBe(entityId);

    // Should include the correct namespace hint
    expect(invalidation.data.namespaces).toContain('portfolio');

    // Timestamp should be a valid ISO string
    expect(invalidation.data.timestamp).toBeDefined();
    expect(() => new Date(invalidation.data.timestamp)).not.toThrow();

    client.close();
  }, 15000);

  // ──────────────── 2. Multiple mutations broadcast ────────────────────────

  it('should broadcast combined invalidation for multiple mutations in one sync', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    // Authenticate
    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated

    const posId = `pos_multi_${Date.now()}`;
    const wlId = `wl_multi_${Date.now()}`;

    // Send sync with two mutations of different entity types
    await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastSyncTimestamp: null,
        mutations: [
          {
            mutationId: `multi_pos_${Date.now()}`,
            type: 'BUY_STOCK',
            entityType: 'position',
            entityId: posId,
            payload: { symbol: 'TCS', quantity: 5, price: 3500 },
            clientVersion: null,
            enqueuedAt: new Date().toISOString(),
          },
          {
            mutationId: `multi_wl_${Date.now()}`,
            type: 'CREATE_WATCHLIST',
            entityType: 'watchlist',
            entityId: wlId,
            payload: { name: 'Integration Watchlist' },
            clientVersion: null,
            enqueuedAt: new Date().toISOString(),
          },
        ],
      }),
    });

    // Wait for invalidation
    const invalidation = await waitForEvent(
      client,
      (msg) => msg.type === 'cache_invalidate',
      5000,
    );

    // Both entities should be in the invalidation
    expect(invalidation.data.entities).toHaveLength(2);

    const entityTypes = invalidation.data.entities.map((e: any) => e.entityType);
    expect(entityTypes).toContain('position');
    expect(entityTypes).toContain('watchlist');

    // Both namespaces should be present
    expect(invalidation.data.namespaces).toContain('portfolio');
    expect(invalidation.data.namespaces).toContain('watchlist');

    client.close();
  }, 15000);

  // ──────────────── 3. Only applies to the same user's connections ─────────

  it('should not broadcast to WebSocket connections of a different user', async () => {
    const OTHER_USER_ID = 'sync_int_other_user';

    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    // Auth as the OTHER user via a real JWT
    const otherToken = generateToken({ userId: OTHER_USER_ID, email: 'other@toroloom.dev' });
    client.ws.send(JSON.stringify({ type: 'auth', token: otherToken }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated

    // Now sync as TEST_USER (the HTTP authMiddleware injects TEST_USER's userId)
    const entityId = `pos_other_${Date.now()}`;
    await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastSyncTimestamp: null,
        mutations: [{
          mutationId: `other_mut_${Date.now()}`,
          type: 'BUY_STOCK',
          entityType: 'position',
          entityId,
          payload: { symbol: 'RELIANCE', quantity: 10, price: 2500 },
          clientVersion: null,
          enqueuedAt: new Date().toISOString(),
        }],
      }),
    });

    // The other user should NOT receive the invalidation
    // Wait briefly and check that no cache_invalidate arrives
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 2000);
    });

    // Try to consume any message — if we get a non-invalidation message,
    // consume it and keep listening (the WS sends pongs, etc.)
    const checkForInvalidation = async (): Promise<boolean> => {
      const msg = await Promise.race([
        client.nextMessage(),
        timeoutPromise,
      ]);
      if (msg === null) return false; // Timeout — no message arrived
      if (msg.type === 'cache_invalidate') return true;
      // Non-invalidation message — try again (could be pong or something)
      return checkForInvalidation();
    };

    const receivedInvalidation = await checkForInvalidation();
    expect(receivedInvalidation).toBe(false);

    client.close();
  }, 10000);

  // ──────────────── 4. No invalidation for mutations that fail ────────────

  it('should not broadcast invalidation for failed mutations', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated

    // Send a sync request with a mutation that will fail (unknown type)
    await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastSyncTimestamp: null,
        mutations: [{
          mutationId: `fail_mut_${Date.now()}`,
          type: 'UNKNOWN_TYPE', // No handler registered
          entityType: 'unknown',
          entityId: 'test-entity',
          payload: {},
          clientVersion: null,
          enqueuedAt: new Date().toISOString(),
        }],
      }),
    });

    // Wait briefly — no cache_invalidate should arrive
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 2000);
    });

    const checkForInvalidation = async (): Promise<boolean> => {
      const msg = await Promise.race([
        client.nextMessage(),
        timeoutPromise,
      ]);
      if (msg === null) return false;
      if (msg.type === 'cache_invalidate') return true;
      return checkForInvalidation();
    };

    const receivedInvalidation = await checkForInvalidation();
    expect(receivedInvalidation).toBe(false);

    client.close();
  }, 10000);

  // ──────────────── 5. Empty mutations (no-op) ────────────────────────────

  it('should not broadcast invalidation for empty mutation array', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome

    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated

    // Send sync with no mutations
    await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastSyncTimestamp: null,
        mutations: [],
      }),
    });

    // Wait briefly — no cache_invalidate should arrive
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 2000);
    });

    const checkForInvalidation = async (): Promise<boolean> => {
      const msg = await Promise.race([
        client.nextMessage(),
        timeoutPromise,
      ]);
      if (msg === null) return false;
      if (msg.type === 'cache_invalidate') return true;
      return checkForInvalidation();
    };

    const receivedInvalidation = await checkForInvalidation();
    expect(receivedInvalidation).toBe(false);

    client.close();
  }, 10000);

  // ──────────────── 6. Multiple connected clients receive invalidation ────

  it('should broadcast to all connected clients for the same user', async () => {
    // Connect TWO WebSocket clients for the same user
    const clientA = await createBufferedClient(port);
    await clientA.nextMessage(); // welcome
    clientA.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await clientA.nextMessage(); // pnl_update
    await clientA.nextMessage(); // authenticated

    const clientB = await createBufferedClient(port);
    await clientB.nextMessage(); // welcome
    clientB.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await clientB.nextMessage(); // pnl_update
    await clientB.nextMessage(); // authenticated

    // Perform a sync mutation
    const entityId = `pos_broadcast_${Date.now()}`;
    await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastSyncTimestamp: null,
        mutations: [{
          mutationId: `broadcast_mut_${Date.now()}`,
          type: 'BUY_STOCK',
          entityType: 'position',
          entityId,
          payload: { symbol: 'SBIN', quantity: 100, price: 800 },
          clientVersion: null,
          enqueuedAt: new Date().toISOString(),
        }],
      }),
    });

    // Client A should receive invalidation
    const invalidationA = await waitForEvent(
      clientA,
      (msg) => msg.type === 'cache_invalidate',
      5000,
    );
    expect(invalidationA.data.entities[0].entityId).toBe(entityId);

    // Client B should also receive invalidation
    const invalidationB = await waitForEvent(
      clientB,
      (msg) => msg.type === 'cache_invalidate',
      5000,
    );
    expect(invalidationB.data.entities[0].entityId).toBe(entityId);

    clientA.close();
    clientB.close();
  }, 20000);

  // ──────────────── 7. Namespace mapping is correct ───────────────────────

  it('should map different entity types to correct cache namespaces', async () => {
    const client = await createBufferedClient(port);
    await client.nextMessage(); // welcome
    client.ws.send(JSON.stringify({ type: 'auth', token: VALID_TOKEN }));
    await client.nextMessage(); // pnl_update
    await client.nextMessage(); // authenticated

    const orderId = `ord_int_${Date.now()}`;

    // Create an order
    await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastSyncTimestamp: null,
        mutations: [{
          mutationId: `order_int_mut_${Date.now()}`,
          type: 'BUY_STOCK',
          entityType: 'order',
          entityId: orderId,
          payload: { symbol: 'INFY', quantity: 50, price: 1600 },
          clientVersion: null,
          enqueuedAt: new Date().toISOString(),
        }],
      }),
    });

    const invalidation = await waitForEvent(
      client,
      (msg) => msg.type === 'cache_invalidate',
      5000,
    );

    // Order entity → openOrders namespace
    expect(invalidation.data.entities[0].entityType).toBe('order');
    expect(invalidation.data.namespaces).toContain('openOrders');

    client.close();
  }, 15000);
});
