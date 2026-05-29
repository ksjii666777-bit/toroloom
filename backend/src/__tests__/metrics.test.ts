/**
 * ============================================================================
 * Toroloom Prometheus Metrics Endpoint — Tests
 * ============================================================================
 *
 * Tests the GET /metrics endpoint by mounting the metrics router on a minimal
 * Express app, seeding WebSocket connection state, and verifying that the
 * Prometheus text-format output contains the expected gauge names and values.
 *
 * Relies on the module-level state maps (clients, userConnectionCount,
 * connectionAlertedUsers) from state.ts.  State is reset before each test,
 * then passed to updateMetrics() to push values into the Prometheus registry.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/metrics.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';
import { WebSocket } from 'ws';
import metricsRoutes from '../routes/metrics';
import * as state from '../websocket/state';
import { AuthenticatedClient } from '../websocket/state';
import { updateMetrics, incrementTickCounter, getMetricsRegistry } from '../services/metrics';

// ──── Helpers ───────────────────────────────────────────────────────────────

function makeMockWs(id: string): WebSocket {
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
  } satisfies AuthenticatedClient;
}

/**
 * Fetch /metrics and return the raw text body.
 * Does NOT parse as JSON — the response is Prometheus text format.
 */
function fetchMetrics(baseUrl: string): Promise<{ status: number; body: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}/metrics`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode!,
          body: data,
          contentType: res.headers['content-type'] as string,
        });
      });
    }).on('error', reject);
  });
}

/**
 * Parse Prometheus text format into a map of metric name → value(s).
 * Handles both unlabelled and labelled gauges.
 */
function parseMetrics(text: string): Map<string, string | Map<string, string>> {
  const result = new Map<string, string | Map<string, string>>();

  for (const line of text.split('\n')) {
    // Skip comments and blank lines
    if (line.startsWith('#') || line.trim() === '') continue;

    // Parse labelled: metric_name{label="val"} value
    // Parse unlabelled: metric_name value
    const labelMatch = line.match(/^(\w+)\{(.+?)\}\s+(\S+)/);
    if (labelMatch) {
      const [, name, labels, value] = labelMatch;
      if (!result.has(name)) {
        result.set(name, new Map());
      }
      (result.get(name) as Map<string, string>).set(labels, value);
      continue;
    }

    const simpleMatch = line.match(/^(\w+)\s+(\S+)/);
    if (simpleMatch) {
      const [, name, value] = simpleMatch;
      // Only set if not already a Map (labelled variant takes precedence)
      if (!result.has(name) || typeof result.get(name) === 'string') {
        result.set(name, value);
      }
    }
  }

  return result;
}

// ──── Server State ──────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

// ──── Suite ─────────────────────────────────────────────────────────────────

describe('GET /metrics', () => {
  beforeAll(async () => {
    const app = express();
    // Mount at /metrics to match the production setup in index.ts
    app.use('/metrics', metricsRoutes);

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const port = (server.address() as any).port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    server?.close();
  });

  // Reset module-level state and Prometheus registry
  beforeEach(() => {
    state.clients.clear();
    state.userConnectionCount.clear();
    state.connectionAlertedUsers.clear();
    getMetricsRegistry().resetMetrics();
  });

  // ──────────────── Response shape ────────────────────────────

  it('should return 200 with the correct Content-Type', async () => {
    updateMetrics(state.userConnectionCount, state.clients, state.connectionAlertedUsers);

    const { status, contentType } = await fetchMetrics(baseUrl);
    expect(status).toBe(200);
    expect(contentType).toContain('text/plain');
    expect(contentType).toContain('charset=utf-8');
  });

  // ──────────────── 1. Empty State ────────────────────────────

  it('should report zero values when no clients are connected', async () => {
    updateMetrics(state.userConnectionCount, state.clients, state.connectionAlertedUsers);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    expect(parsed.get('toroloom_ws_total_connections')).toBe('0');
    expect(parsed.get('toroloom_ws_authenticated_users')).toBe('0');
    expect(parsed.get('toroloom_ws_alerted_users')).toBe('0');
  });

  // ──────────────── 2. Single User, Single Connection ─────────

  it('should report a single user with one connection', async () => {
    const ws = makeMockWs('c1');
    state.clients.set(ws, makeAuthenticatedClient('user-one', ['RELIANCE']));
    state.userConnectionCount.set('user-one', 1);
    updateMetrics(state.userConnectionCount, state.clients, state.connectionAlertedUsers);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    expect(parsed.get('toroloom_ws_total_connections')).toBe('1');
    expect(parsed.get('toroloom_ws_authenticated_users')).toBe('1');
    expect(parsed.get('toroloom_ws_alerted_users')).toBe('0');

    const userLabels = parsed.get('toroloom_ws_user_connections') as Map<string, string>;
    expect(userLabels.get('user_id="user-one"')).toBe('1');

    // subscription gauge matches the symbol count
    const subLabels = parsed.get('toroloom_ws_active_subscriptions') as Map<string, string>;
    expect(subLabels.get('user_id="user-one"')).toBe('1');
  });

  // ──────────────── 3. Multiple Users ─────────────────────────

  it('should report per-user connection counts for multiple users', async () => {
    const ws1 = makeMockWs('a1');
    const ws2 = makeMockWs('a2');
    const ws3 = makeMockWs('b1');

    state.clients.set(ws1, makeAuthenticatedClient('user-a', ['TCS']));
    state.clients.set(ws2, makeAuthenticatedClient('user-a', ['RELIANCE']));
    state.clients.set(ws3, makeAuthenticatedClient('user-b', ['HDFCBANK']));

    state.userConnectionCount.set('user-a', 2);
    state.userConnectionCount.set('user-b', 1);
    updateMetrics(state.userConnectionCount, state.clients, state.connectionAlertedUsers);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    expect(parsed.get('toroloom_ws_total_connections')).toBe('3');
    expect(parsed.get('toroloom_ws_authenticated_users')).toBe('2');

    const userLabels = parsed.get('toroloom_ws_user_connections') as Map<string, string>;
    expect(userLabels.get('user_id="user-a"')).toBe('2');
    expect(userLabels.get('user_id="user-b"')).toBe('1');

    // subscription gauge: user-a has ['TCS'] + ['RELIANCE'] = 2, user-b has ['HDFCBANK'] = 1
    const subLabels = parsed.get('toroloom_ws_active_subscriptions') as Map<string, string>;
    expect(subLabels.get('user_id="user-a"')).toBe('2');
    expect(subLabels.get('user_id="user-b"')).toBe('1');
  });

  // ──────────────── 4. Alerted Users ─────────────────────────

  it('should report the number of alerted users', async () => {
    state.connectionAlertedUsers.add('user-x');
    updateMetrics(state.userConnectionCount, state.clients, state.connectionAlertedUsers);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    expect(parsed.get('toroloom_ws_alerted_users')).toBe('1');
  });

  // ──────────────── 5. Stale Labels are Purged ────────────────

  it('should not include disconnected users in per-user metrics', async () => {
    // First, add user-alpha with 2 connections
    const ws1 = makeMockWs('a1');
    const ws2 = makeMockWs('a2');
    state.clients.set(ws1, makeAuthenticatedClient('user-alpha', ['RELIANCE']));
    state.clients.set(ws2, makeAuthenticatedClient('user-alpha', ['TCS']));
    state.userConnectionCount.set('user-alpha', 2);
    updateMetrics(state.userConnectionCount, state.clients, state.connectionAlertedUsers);

    // Now simulate disconnect: clear all state
    state.clients.clear();
    state.userConnectionCount.clear();
    // Important: also update metrics AFTER clearing — this triggers the
    // reset() call that purges the stale user-alpha label
    updateMetrics(state.userConnectionCount, state.clients, state.connectionAlertedUsers);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    // Total should be 0
    expect(parsed.get('toroloom_ws_total_connections')).toBe('0');
    expect(parsed.get('toroloom_ws_authenticated_users')).toBe('0');

    // user-alpha should NOT appear in the per-user metrics
    const userLabels = parsed.get('toroloom_ws_user_connections');
    if (userLabels instanceof Map) {
      expect(userLabels.size).toBe(0);
    } else {
      expect(userLabels).toBeUndefined();
    }

    // subscription gauge should also be purged
    const subLabels = parsed.get('toroloom_ws_active_subscriptions');
    if (subLabels instanceof Map) {
      expect(subLabels.size).toBe(0);
    } else {
      expect(subLabels).toBeUndefined();
    }
  });

  // ──────────────── 6. HELP and TYPE lines present ────────────

  it('should include HELP and TYPE lines for every gauge', async () => {
    updateMetrics(state.userConnectionCount, state.clients, state.connectionAlertedUsers);

    const { body } = await fetchMetrics(baseUrl);

    const expectedMetrics: { name: string; type: string }[] = [
      { name: 'toroloom_ws_total_connections', type: 'gauge' },
      { name: 'toroloom_ws_authenticated_users', type: 'gauge' },
      { name: 'toroloom_ws_user_connections', type: 'gauge' },
      { name: 'toroloom_ws_alerted_users', type: 'gauge' },
      { name: 'toroloom_ws_ticks_total', type: 'counter' },
      { name: 'toroloom_ws_active_subscriptions', type: 'gauge' },
    ];

    for (const { name, type } of expectedMetrics) {
      expect(body).toContain(`# HELP ${name}`);
      expect(body).toContain(`# TYPE ${name} ${type}`);
    }
  });

  // ──────────────── 7. Mixed State ────────────────────────────

  it('should correctly reflect a mixed state with alerted users', async () => {
    // User X — 3 connections, alerted
    const x1 = makeMockWs('x1');
    const x2 = makeMockWs('x2');
    const x3 = makeMockWs('x3');
    state.clients.set(x1, makeAuthenticatedClient('user-x', ['RELIANCE']));
    state.clients.set(x2, makeAuthenticatedClient('user-x', ['TCS']));
    state.clients.set(x3, makeAuthenticatedClient('user-x', ['RELIANCE']));
    state.userConnectionCount.set('user-x', 3);

    // User Y — 1 connection, not alerted
    const y1 = makeMockWs('y1');
    state.clients.set(y1, makeAuthenticatedClient('user-y', ['SBIN']));
    state.userConnectionCount.set('user-y', 1);

    state.connectionAlertedUsers.add('user-x');
    updateMetrics(state.userConnectionCount, state.clients, state.connectionAlertedUsers);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    expect(parsed.get('toroloom_ws_total_connections')).toBe('4');
    expect(parsed.get('toroloom_ws_authenticated_users')).toBe('2');
    expect(parsed.get('toroloom_ws_alerted_users')).toBe('1');

    const userLabels = parsed.get('toroloom_ws_user_connections') as Map<string, string>;
    expect(userLabels.get('user_id="user-x"')).toBe('3');
    expect(userLabels.get('user_id="user-y"')).toBe('1');

    const subLabels = parsed.get('toroloom_ws_active_subscriptions') as Map<string, string>;
    expect(subLabels.get('user_id="user-x"')).toBe('3');
    expect(subLabels.get('user_id="user-y"')).toBe('1');
  });

  // ──────────────── 8. Tick Counter Increments ─────────────────

  it('should increment the tick counter and reflect it in the metrics output', async () => {
    // Register metrics by calling updateMetrics with empty state first
    updateMetrics(state.userConnectionCount, state.clients, state.connectionAlertedUsers);

    // Increment ticks for two users
    incrementTickCounter('user-tick-a');
    incrementTickCounter('user-tick-a');
    incrementTickCounter('user-tick-a');
    incrementTickCounter('user-tick-b');

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const tickLabels = parsed.get('toroloom_ws_ticks_total') as Map<string, string>;
    expect(tickLabels.get('user_id="user-tick-a"')).toBe('3');
    expect(tickLabels.get('user_id="user-tick-b"')).toBe('1');
  });

  // ──────────────── 9. Tick Counter Starts at Zero ───────────

  it('should show zero ticks when no increments are made', async () => {
    updateMetrics(state.userConnectionCount, state.clients, state.connectionAlertedUsers);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    // Counter with labels — if no labels are registered, it won't appear
    const tickLabels = parsed.get('toroloom_ws_ticks_total');
    // Either absent entirely, or an empty map
    if (tickLabels instanceof Map) {
      expect(tickLabels.size).toBe(0);
    }
  });
});
