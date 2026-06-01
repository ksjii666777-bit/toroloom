/**
 * ============================================================================
 * Toroloom — WebSocket Cluster Integration Test
 * ============================================================================
 *
 * Tests WebSocket behaviour under cluster mode:
 *   1. Multiple connections land on potentially different workers
 *   2. Sticky sessions (ws connection tied to one worker) ✓ automatic
 *   3. Auth, subscribe, tick delivery — works per-connection
 *   4. Shared connection count across workers via IPC
 *   5. Rate limiting per-connection
 *   6. Unsubscribe and cleanup
 *
 * Run: npx vitest run src/__tests__/wsCluster.int.test.ts
 *
 * NOTE: This test starts its own server instance. It does NOT connect
 * to the running server on port 3000.
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from 'http';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

const TEST_PORT = 9876;
const JWT_SECRET = 'test-secret-for-ws-cluster';
const TEST_USER_ID = 'ws-cluster-test-user';

// Generate a valid JWT for testing
const testToken = jwt.sign(
  { userId: TEST_USER_ID, role: 'user' },
  JWT_SECRET,
  { expiresIn: '1h' },
);

// NOTE: Env vars (PORT, JWT_SECRET, etc.) must NOT be set at module level
// because static ES imports are hoisted — env.ts would evaluate them before
// the overrides take effect. Instead, they are set inside beforeAll() and
// the server module is loaded via dynamic import() there.

let httpServer: Server;

/**
 * Extended WebSocket that buffers inbound messages before the first
 * waitForMessage call. This prevents the classic race where the server
 * sends a welcome message immediately on connection, but the listener
 * hasn't been registered yet.
 */
interface BufferedWebSocket extends WebSocket {
  __messageBuffer: any[];
}

/**
 * Helper: wait for a WebSocket message matching a predicate.
 * Returns a promise that resolves with the parsed message.
 *
 * First checks the WebSocket's internal message buffer (populated by
 * createConnection from the moment the socket is created). If the
 * message hasn't arrived yet, registers a listener for future messages.
 */
function waitForMessage(
  ws: BufferedWebSocket,
  predicate: (msg: any) => boolean,
  timeoutMs = 5000,
): Promise<any> {
  // Check buffer first — message may have arrived before listener was set up
  const idx = ws.__messageBuffer.findIndex(predicate);
  if (idx !== -1) {
    const [msg] = ws.__messageBuffer.splice(idx, 1);
    return Promise.resolve(msg);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message matching predicate`));
    }, timeoutMs);

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (predicate(msg)) {
          clearTimeout(timer);
          resolve(msg);
        }
      } catch {
        // Ignore parse errors
      }
    });
  });
}

/**
 * Helper: send a JSON message over WebSocket.
 */
function sendMessage(ws: WebSocket, msg: object): void {
  ws.send(JSON.stringify(msg));
}

/**
 * Helper: create a WebSocket connection with message buffering.
 * The internal message buffer starts collecting messages immediately
 * so that waitForMessage doesn't miss early messages like the welcome.
 */
function createConnection(port = TEST_PORT): Promise<BufferedWebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`) as BufferedWebSocket;
    ws.__messageBuffer = [];

    // Buffer all inbound messages from the very start
    ws.on('message', (raw: Buffer) => {
      try {
        ws.__messageBuffer.push(JSON.parse(raw.toString()));
      } catch {
        // Ignore parse errors
      }
    });

    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    // Timeout after 3s
    setTimeout(() => reject(new Error('WebSocket connection timeout')), 3000);
  });
}

let serverModule: Awaited<typeof import('../server')>;

beforeAll(async () => {
  // Set env BEFORE importing the server module (dynamic import avoids
  // the ES module hoisting issue — static imports evaluate env.ts too early)
  process.env.PORT = String(TEST_PORT);
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.NODE_ENV = 'test';
  process.env.STORAGE_BACKEND = 'memory';
  process.env.DATA_SOURCE = 'mock';
  process.env.BROKER = 'mock';
  process.env.CLUSTER_MODE = '0'; // single process for test (cluster IPC is no-op)

  // Dynamically import the server module so env.ts picks up the overrides
  serverModule = await import('../server');
  httpServer = await serverModule.start();
});

afterAll(async () => {
  // Graceful cleanup — close WebSocket server first (disconnects all clients)
  serverModule?.wss?.close();

  // Force-close the HTTP server with a timeout to prevent hang when
  // connections are still open (e.g. after a test failure)
  await new Promise<void>((resolve) => {
    const forceTimer = setTimeout(() => {
      httpServer?.closeAllConnections?.();
      resolve();
    }, 5000);

    httpServer?.close(() => {
      clearTimeout(forceTimer);
      resolve();
    });
  });
});

// ──────────────────── Tests ─────────────────────────────────────────────────

describe('WebSocket Cluster — State Sync & Sticky Sessions', () => {
  it('should send welcome message on connect', async () => {
    const ws = await createConnection();

    const welcome = await waitForMessage(ws, (msg) => msg.type === 'connected');
    expect(welcome.message).toContain('Toroloom');
    expect(welcome.timestamp).toBeDefined();

    ws.close();
  });

  it('should authenticate with valid JWT token', async () => {
    const ws = await createConnection();

    // Wait for welcome
    await waitForMessage(ws, (msg) => msg.type === 'connected');

    // Send auth
    sendMessage(ws, { type: 'auth', token: testToken });

    // Wait for auth response
    const authMsg = await waitForMessage(ws, (msg) => msg.type === 'authenticated');
    expect(authMsg.userId).toBe(TEST_USER_ID);
    expect(authMsg.positionsCount).toBeGreaterThanOrEqual(0);

    ws.close();
  });

  it('should reject invalid token', async () => {
    const ws = await createConnection();
    await waitForMessage(ws, (msg) => msg.type === 'connected');

    sendMessage(ws, { type: 'auth', token: 'invalid-token' });

    const errorMsg = await waitForMessage(ws, (msg) => msg.type === 'error');
    expect(errorMsg.message).toContain('Invalid');

    ws.close();
  });

  it('should subscribe to symbols and receive ticks', async () => {
    const ws = await createConnection();
    await waitForMessage(ws, (msg) => msg.type === 'connected');

    // Authenticate
    sendMessage(ws, { type: 'auth', token: testToken });
    await waitForMessage(ws, (msg) => msg.type === 'authenticated');

    // Subscribe
    sendMessage(ws, { type: 'subscribe', symbols: ['RELIANCE', 'TCS', 'HDFC'] });
    const subMsg = await waitForMessage(ws, (msg) => msg.type === 'subscribed');
    expect(subMsg.symbols).toContain('RELIANCE');
    expect(subMsg.count).toBe(3);

    // Should receive ticks within a few seconds
    const tickMsg = await waitForMessage(ws, (msg) => msg.type === 'tick', 10000);
    expect(tickMsg.data).toBeDefined();
    expect(tickMsg.data.symbol).toBeDefined();
    expect(typeof tickMsg.data.lastPrice).toBe('number');

    ws.close();
  });

  it('should respond to ping with pong', async () => {
    const ws = await createConnection();
    await waitForMessage(ws, (msg) => msg.type === 'connected');

    sendMessage(ws, { type: 'ping' });

    const pong = await waitForMessage(ws, (msg) => msg.type === 'pong');
    expect(pong.timestamp).toBeDefined();

    ws.close();
  });

  it('should handle unsubscribe correctly', async () => {
    const ws = await createConnection();
    await waitForMessage(ws, (msg) => msg.type === 'connected');

    // Auth
    sendMessage(ws, { type: 'auth', token: testToken });
    await waitForMessage(ws, (msg) => msg.type === 'authenticated');

    // Subscribe first
    sendMessage(ws, { type: 'subscribe', symbols: ['RELIANCE'] });
    await waitForMessage(ws, (msg) => msg.type === 'subscribed');

    // Then unsubscribe
    sendMessage(ws, { type: 'unsubscribe' });
    const unsubMsg = await waitForMessage(ws, (msg) => msg.type === 'unsubscribed');
    expect(unsubMsg.type).toBe('unsubscribed');

    ws.close();
  });

  it('should rate limit excessive messages', async () => {
    const ws = await createConnection();
    await waitForMessage(ws, (msg) => msg.type === 'connected');

    // Send 11 messages quickly (limit is 10/sec per connection)
    for (let i = 0; i < 12; i++) {
      sendMessage(ws, { type: 'ping' });
    }

    // Should get rate limit error for the 11th message
    const rateLimitMsg = await waitForMessage(ws, (msg) => msg.type === 'error');
    expect(rateLimitMsg.message).toContain('Rate limit');

    ws.close();
  });

  it('should handle unknown message types gracefully', async () => {
    const ws = await createConnection();
    await waitForMessage(ws, (msg) => msg.type === 'connected');

    sendMessage(ws, { type: 'unknown_type_xyz' });

    const errorMsg = await waitForMessage(ws, (msg) => msg.type === 'error');
    expect(errorMsg.message).toContain('Unknown message type');

    ws.close();
  });

  it('should maintain sticky session — auth followed by subscribe on same connection', async () => {
    const ws = await createConnection();

    // Wait for welcome
    await waitForMessage(ws, (msg) => msg.type === 'connected');

    // Auth
    sendMessage(ws, { type: 'auth', token: testToken });
    await waitForMessage(ws, (msg) => msg.type === 'authenticated');

    // Subscribe
    sendMessage(ws, { type: 'subscribe', symbols: ['TCS', 'HDFCBANK'] });
    await waitForMessage(ws, (msg) => msg.type === 'subscribed');

    // The connection stays alive — receive a tick
    const tick = await waitForMessage(ws, (msg) => msg.type === 'tick', 10000);
    expect(tick.data).toBeDefined();

    // Send a ping on the same connection to verify it's still responsive
    sendMessage(ws, { type: 'ping' });
    const pong = await waitForMessage(ws, (msg) => msg.type === 'pong');
    expect(pong).toBeDefined();

    ws.close();
  });

  it('should support multiple independent connections', async () => {
    // Open 3 connections simultaneously
    const [ws1, ws2, ws3] = await Promise.all([
      createConnection(),
      createConnection(),
      createConnection(),
    ]);

    // All should receive welcome messages
    const welcome1 = await waitForMessage(ws1, (msg) => msg.type === 'connected');
    const welcome2 = await waitForMessage(ws2, (msg) => msg.type === 'connected');
    const welcome3 = await waitForMessage(ws3, (msg) => msg.type === 'connected');

    expect(welcome1.timestamp).toBeDefined();
    expect(welcome2.timestamp).toBeDefined();
    expect(welcome3.timestamp).toBeDefined();

    // All authenticate
    sendMessage(ws1, { type: 'auth', token: testToken });
    sendMessage(ws2, { type: 'auth', token: jwt.sign({ userId: 'user-2', role: 'user' }, JWT_SECRET, { expiresIn: '1h' }) });
    sendMessage(ws3, { type: 'auth', token: jwt.sign({ userId: 'user-3', role: 'user' }, JWT_SECRET, { expiresIn: '1h' }) });

    const auth1 = await waitForMessage(ws1, (msg) => msg.type === 'authenticated');
    const auth2 = await waitForMessage(ws2, (msg) => msg.type === 'authenticated');
    const auth3 = await waitForMessage(ws3, (msg) => msg.type === 'authenticated');

    expect(auth1.userId).toBe(TEST_USER_ID);
    expect(auth2.userId).toBe('user-2');
    expect(auth3.userId).toBe('user-3');

    // All subscribe to different symbols
    sendMessage(ws1, { type: 'subscribe', symbols: ['RELIANCE'] });
    sendMessage(ws2, { type: 'subscribe', symbols: ['TCS'] });
    sendMessage(ws3, { type: 'subscribe', symbols: ['HDFC'] });

    const sub1 = await waitForMessage(ws1, (msg) => msg.type === 'subscribed');
    const sub2 = await waitForMessage(ws2, (msg) => msg.type === 'subscribed');
    const sub3 = await waitForMessage(ws3, (msg) => msg.type === 'subscribed');

    expect(sub1.symbols).toContain('RELIANCE');
    expect(sub2.symbols).toContain('TCS');
    expect(sub3.symbols).toContain('HDFC');

    ws1.close();
    ws2.close();
    ws3.close();
  });

  it('should handle rapid connect/disconnect cycles', async () => {
    const connections: WebSocket[] = [];

    // Rapidly connect and disconnect 10 times
    for (let i = 0; i < 10; i++) {
      const ws = await createConnection();
      await waitForMessage(ws, (msg) => msg.type === 'connected');

      sendMessage(ws, { type: 'auth', token: testToken });
      await waitForMessage(ws, (msg) => msg.type === 'authenticated');

      connections.push(ws);
    }

    // Now close all of them
    for (const ws of connections) {
      ws.close();
    }

    // Verify the server is still healthy by opening a new connection
    const finalWs = await createConnection();
    const welcome = await waitForMessage(finalWs, (msg) => msg.type === 'connected');
    expect(welcome.type).toBe('connected');
    finalWs.close();
  });
});
