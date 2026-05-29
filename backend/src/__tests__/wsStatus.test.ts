/**
 * ============================================================================
 * Toroloom WebSocket Status Route — Tests
 * ============================================================================
 *
 * Tests the GET /api/system/ws-status endpoint by mounting the wsStatus
 * router on a minimal Express app and seeding module-level state maps
 * (clients, userConnectionCount) with controlled test data.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/wsStatus.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';
import wsStatusRoutes from '../routes/wsStatus';
import * as state from '../websocket/state';
import { WebSocket } from 'ws';

// ──── Helpers ───────────────────────────────────────────────────────────────

function makeMockWs(id: string): WebSocket {
  // WebSocket is used only as a Map key — identity is sufficient
  return { _mockId: id } as unknown as WebSocket;
}

function makeAuthenticatedClient(userId: string, symbols: string[]) {
  return {
    ws: makeMockWs(`${userId}-${Date.now()}`),
    userId,
    symbols,
    positions: new Map(),
    closed: false,
    unsubscribe: () => {},
  } satisfies state.AuthenticatedClient;
}

// ──── Server State ──────────────────────────────────────────────────────────

let server: http.Server;
let port: number;
let baseUrl: string;

function get(path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode!, body: JSON.parse(data) });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// ──── Suite ─────────────────────────────────────────────────────────────────

describe('GET /api/system/ws-status', () => {
  beforeAll(async () => {
    const app = express();
    app.use('/api/system', wsStatusRoutes);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        port = (server.address() as any).port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    server?.close();
  });

  // Clean module-level state before each test
  beforeEach(() => {
    state.clients.clear();
    state.userConnectionCount.clear();
    state.connectionAlertedUsers.clear();
  });

  // ──────────────── 1. Empty State ──────────────────────────────

  it('should return zero connections when no clients are connected', async () => {
    const { status, body } = await get('/api/system/ws-status');

    expect(status).toBe(200);
    expect(body.totalConnections).toBe(0);
    expect(body.authenticatedUsers).toBe(0);
    expect(body.users).toEqual([]);
    expect(body.timestamp).toBeDefined();
  });

  // ──────────────── 2. Single User, Single Connection ───────────

  it('should report a single authenticated user with one connection', async () => {
    const ws = makeMockWs('conn-1');
    state.clients.set(ws, makeAuthenticatedClient('user-alpha', []));
    state.userConnectionCount.set('user-alpha', 1);

    const { status, body } = await get('/api/system/ws-status');

    expect(status).toBe(200);
    expect(body.totalConnections).toBe(1);
    expect(body.authenticatedUsers).toBe(1);
    expect(body.users).toHaveLength(1);
    expect(body.users[0]).toEqual({
      userId: 'user-alpha',
      connections: 1,
      subscribedSymbols: [],
      alerted: false,
    });
  });

  // ──────────────── 3. Single User, Multiple Connections ────────

  it('should aggregate multiple connections from the same user', async () => {
    const ws1 = makeMockWs('conn-a');
    const ws2 = makeMockWs('conn-b');
    state.clients.set(ws1, makeAuthenticatedClient('user-beta', ['RELIANCE']));
    state.clients.set(ws2, makeAuthenticatedClient('user-beta', ['TCS']));
    state.userConnectionCount.set('user-beta', 2);

    const { status, body } = await get('/api/system/ws-status');

    expect(status).toBe(200);
    expect(body.totalConnections).toBe(2);
    expect(body.authenticatedUsers).toBe(1);
    expect(body.users).toHaveLength(1);
    expect(body.users[0]).toEqual({
      userId: 'user-beta',
      connections: 2,
      subscribedSymbols: expect.arrayContaining(['RELIANCE', 'TCS']),
      alerted: false,
    });
    expect(body.users[0].subscribedSymbols).toHaveLength(2);
  });

  // ──────────────── 4. Multiple Users ───────────────────────────

  it('should report separate entries for different users', async () => {
    const ws1 = makeMockWs('c1');
    const ws2 = makeMockWs('c2');
    state.clients.set(ws1, makeAuthenticatedClient('user-1', ['RELIANCE']));
    state.clients.set(ws2, makeAuthenticatedClient('user-2', ['HDFCBANK', 'INFY']));
    state.userConnectionCount.set('user-1', 1);
    state.userConnectionCount.set('user-2', 1);

    const { status, body } = await get('/api/system/ws-status');

    expect(status).toBe(200);
    expect(body.totalConnections).toBe(2);
    expect(body.authenticatedUsers).toBe(2);
    expect(body.users).toHaveLength(2);

    const u1 = body.users.find((u: any) => u.userId === 'user-1');
    expect(u1).toEqual({
      userId: 'user-1',
      connections: 1,
      subscribedSymbols: ['RELIANCE'],
      alerted: false,
    });

    const u2 = body.users.find((u: any) => u.userId === 'user-2');
    expect(u2).toEqual({
      userId: 'user-2',
      connections: 1,
      subscribedSymbols: ['HDFCBANK', 'INFY'],
      alerted: false,
    });
  });

  // ──────────────── 5. Subscribed Symbols Dedup + Sort ─────────

  it('should deduplicate and sort subscribed symbols across tabs', async () => {
    const ws1 = makeMockWs('t1');
    const ws2 = makeMockWs('t2');
    const ws3 = makeMockWs('t3');
    state.clients.set(ws1, makeAuthenticatedClient('user-gamma', ['TCS']));
    state.clients.set(ws2, makeAuthenticatedClient('user-gamma', ['RELIANCE']));
    state.clients.set(ws3, makeAuthenticatedClient('user-gamma', ['TCS']));
    state.userConnectionCount.set('user-gamma', 3);

    const { body } = await get('/api/system/ws-status');

    expect(body.users).toHaveLength(1);
    expect(body.users[0].subscribedSymbols).toEqual(['RELIANCE', 'TCS']);
  });

  // ──────────────── 6. userConnectionCount empty fallback ───────

  it('should fall back to clients.size when userConnectionCount is empty', async () => {
    const ws = makeMockWs('orphan');
    state.clients.set(ws, makeAuthenticatedClient('user-delta', []));
    // Intentionally NOT setting userConnectionCount

    const { body } = await get('/api/system/ws-status');

    // userConnectionCount is empty -> fallback to clients.size
    expect(body.totalConnections).toBe(1);
    expect(body.authenticatedUsers).toBe(1);
  });

  // ──────────────── 7. Alerted State ──────────────────────────

  it('should report alerted=true for users who exceeded the connection limit', async () => {
    const ws1 = makeMockWs('a1');
    const ws2 = makeMockWs('a2');
    const ws3 = makeMockWs('a3');
    state.clients.set(ws1, makeAuthenticatedClient('over-user', ['RELIANCE']));
    state.clients.set(ws2, makeAuthenticatedClient('over-user', ['TCS']));
    state.clients.set(ws3, makeAuthenticatedClient('over-user', ['RELIANCE']));
    state.userConnectionCount.set('over-user', 3);
    state.connectionAlertedUsers.add('over-user');

    const { body } = await get('/api/system/ws-status');

    const target = body.users.find((u: any) => u.userId === 'over-user');
    expect(target.alerted).toBe(true);
    expect(body.alertedUsers).toBe(1);
    expect(body.maxConnectionsPerUser).toBeGreaterThan(0);
  });

  it('should report alerted=false when no user has exceeded the limit', async () => {
    const ws = makeMockWs('c1');
    state.clients.set(ws, makeAuthenticatedClient('normal-user', ['RELIANCE']));
    state.userConnectionCount.set('normal-user', 1);

    const { body } = await get('/api/system/ws-status');

    expect(body.users[0].alerted).toBe(false);
    expect(body.alertedUsers).toBe(0);
    expect(body.maxConnectionsPerUser).toBeGreaterThan(0);
  });

  // ──────────────── 8. Complex Mixed State ─────────────────────

  it('should correctly report a mixed state with multiple users and tabs', async () => {
    // User A — 3 connections, subscribed to RELIANCE and HDFCBANK
    const a1 = makeMockWs('a1');
    const a2 = makeMockWs('a2');
    const a3 = makeMockWs('a3');
    state.clients.set(a1, makeAuthenticatedClient('user-a', ['RELIANCE']));
    state.clients.set(a2, makeAuthenticatedClient('user-a', ['HDFCBANK']));
    state.clients.set(a3, makeAuthenticatedClient('user-a', ['RELIANCE']));
    state.userConnectionCount.set('user-a', 3);

    // User B — 1 connection, subscribed to 3 symbols
    const b1 = makeMockWs('b1');
    state.clients.set(b1, makeAuthenticatedClient('user-b', ['SBIN', 'TCS', 'INFY']));
    state.userConnectionCount.set('user-b', 1);

    const { body } = await get('/api/system/ws-status');

    expect(body.totalConnections).toBe(4);
    expect(body.authenticatedUsers).toBe(2);

    const userA = body.users.find((u: any) => u.userId === 'user-a');
    expect(userA.connections).toBe(3);
    expect(userA.subscribedSymbols).toEqual(['HDFCBANK', 'RELIANCE']);

    const userB = body.users.find((u: any) => u.userId === 'user-b');
    expect(userB.connections).toBe(1);
    expect(userB.subscribedSymbols).toEqual(['INFY', 'SBIN', 'TCS']);

    // Verify total from body matches expectation
    const sumFromUsers = body.users.reduce((a: number, u: any) => a + u.connections, 0);
    expect(sumFromUsers).toBe(body.totalConnections);
  });
});
