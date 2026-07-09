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
import {
  updateMetrics,
  incrementTickCounter,
  getMetricsRegistry,
  setBrokerConnected,
  incrementBrokerAuthError,
  incrementBrokerReconnects,
  incrementRateLimited,
  setActiveRateLimiters,
  recalculateSymbolSubscriptions,
  observeTickLatency,
  incrementCacheHit,
  incrementCacheMiss,
  observeCacheLookup,
  observeCacheCompute,
  incrementSyncBridgeSendFailure,
  incrementSyncBridgeCircuitBreakerTrip,
} from '../services/metrics';

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

// Reset module-level state and Prometheus registry before each test
beforeEach(() => {
  state.clients.clear();
  state.userConnectionCount.clear();
  state.connectionAlertedUsers.clear();
  getMetricsRegistry().resetMetrics();
});

describe('GET /metrics', () => {
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

// ═══════════════════════════════════════════════════════════════════════════
// Broker Health Metrics
// ═══════════════════════════════════════════════════════════════════════════

describe('Broker Health Metrics', () => {
  beforeEach(() => {
    getMetricsRegistry().resetMetrics();
  });

  // ──────────── Broker Connected ────────────────────────────────

  it('should reflect broker connected status as 1', async () => {
    setBrokerConnected('zerodha', true);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const brokerLabels = parsed.get('toroloom_broker_connected') as Map<string, string>;
    expect(brokerLabels).toBeInstanceOf(Map);
    expect(brokerLabels.get('broker="zerodha"')).toBe('1');
  });

  it('should reflect broker disconnected status as 0', async () => {
    setBrokerConnected('angel', false);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const brokerLabels = parsed.get('toroloom_broker_connected') as Map<string, string>;
    expect(brokerLabels.get('broker="angel"')).toBe('0');
  });

  it('should report multiple broker statuses independently', async () => {
    setBrokerConnected('zerodha', true);
    setBrokerConnected('angel', true);
    setBrokerConnected('mock', false);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const brokerLabels = parsed.get('toroloom_broker_connected') as Map<string, string>;
    expect(brokerLabels.get('broker="zerodha"')).toBe('1');
    expect(brokerLabels.get('broker="angel"')).toBe('1');
    expect(brokerLabels.get('broker="mock"')).toBe('0');
  });

  it('should reset broker connected gauge to zero when registry is cleared', async () => {
    setBrokerConnected('zerodha', true);
    getMetricsRegistry().resetMetrics();
    setBrokerConnected('zerodha', false);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);
    const brokerLabels = parsed.get('toroloom_broker_connected') as Map<string, string>;
    expect(brokerLabels.get('broker="zerodha"')).toBe('0');
  });

  // ──────────── Auth Errors ─────────────────────────────────────

  it('should increment broker auth error counter', async () => {
    incrementBrokerAuthError('zerodha');

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const authLabels = parsed.get('toroloom_broker_auth_errors_total') as Map<string, string>;
    expect(authLabels.get('broker="zerodha"')).toBe('1');
  });

  it('should accumulate broker auth errors across multiple calls', async () => {
    incrementBrokerAuthError('zerodha');
    incrementBrokerAuthError('zerodha');
    incrementBrokerAuthError('angel');

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const authLabels = parsed.get('toroloom_broker_auth_errors_total') as Map<string, string>;
    expect(authLabels.get('broker="zerodha"')).toBe('2');
    expect(authLabels.get('broker="angel"')).toBe('1');
  });

  it('should start broker auth error counter at zero after reset', async () => {
    incrementBrokerAuthError('zerodha');
    getMetricsRegistry().resetMetrics();

    // After reset, the counter is registered but has value 0
    // Verify by incrementing and checking it starts at 1
    incrementBrokerAuthError('zerodha');
    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);
    const authLabels = parsed.get('toroloom_broker_auth_errors_total') as Map<string, string>;
    expect(authLabels.get('broker="zerodha"')).toBe('1');
  });

  it('should handle auth errors for unknown broker types', async () => {
    incrementBrokerAuthError('unknown-broker');

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const authLabels = parsed.get('toroloom_broker_auth_errors_total') as Map<string, string>;
    expect(authLabels.get('broker="unknown-broker"')).toBe('1');
  });

  // ──────────── Reconnects ──────────────────────────────────────

  it('should increment broker reconnect counter', async () => {
    incrementBrokerReconnects('angel');

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const reconnectLabels = parsed.get('toroloom_broker_reconnects_total') as Map<string, string>;
    expect(reconnectLabels.get('broker="angel"')).toBe('1');
  });

  it('should accumulate broker reconnects across multiple calls', async () => {
    incrementBrokerReconnects('zerodha');
    incrementBrokerReconnects('zerodha');
    incrementBrokerReconnects('zerodha');

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const reconnectLabels = parsed.get('toroloom_broker_reconnects_total') as Map<string, string>;
    expect(reconnectLabels.get('broker="zerodha"')).toBe('3');
  });

  it('should track reconnects independently per broker', async () => {
    incrementBrokerReconnects('zerodha');
    incrementBrokerReconnects('angel');
    incrementBrokerReconnects('zerodha');

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const reconnectLabels = parsed.get('toroloom_broker_reconnects_total') as Map<string, string>;
    expect(reconnectLabels.get('broker="zerodha"')).toBe('2');
    expect(reconnectLabels.get('broker="angel"')).toBe('1');
  });

  // ──────────── HELP / TYPE lines ───────────────────────────────

  it('should include HELP and TYPE lines for all broker metrics', async () => {
    const { body } = await fetchMetrics(baseUrl);

    const expected: { name: string; type: string }[] = [
      { name: 'toroloom_broker_connected', type: 'gauge' },
      { name: 'toroloom_broker_auth_errors_total', type: 'counter' },
      { name: 'toroloom_broker_reconnects_total', type: 'counter' },
    ];

    for (const { name, type } of expected) {
      expect(body).toContain(`# HELP ${name}`);
      expect(body).toContain(`# TYPE ${name} ${type}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Rate Limit Metrics
// ═══════════════════════════════════════════════════════════════════════════

describe('Rate Limit Metrics', () => {
  beforeEach(() => {
    getMetricsRegistry().resetMetrics();
  });

  it('should increment rate-limited counter', async () => {
    incrementRateLimited();

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    expect(parsed.get('toroloom_ws_rate_limited_total')).toBe('1');
  });

  it('should accumulate rate-limited counts', async () => {
    incrementRateLimited();
    incrementRateLimited();
    incrementRateLimited();

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    expect(parsed.get('toroloom_ws_rate_limited_total')).toBe('3');
  });

  it('should start at zero after reset', async () => {
    incrementRateLimited();
    getMetricsRegistry().resetMetrics();

    // After reset, counter is registered but has value 0.
    // Verify by incrementing and checking it starts at 1.
    incrementRateLimited();
    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);
    expect(parsed.get('toroloom_ws_rate_limited_total')).toBe('1');
  });

  it('should set active rate limiters count', async () => {
    setActiveRateLimiters(5);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    expect(parsed.get('toroloom_ws_active_rate_limiters')).toBe('5');
  });

  it('should update active rate limiters to zero', async () => {
    setActiveRateLimiters(5);
    setActiveRateLimiters(0);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    expect(parsed.get('toroloom_ws_active_rate_limiters')).toBe('0');
  });

  it('should include HELP and TYPE lines for rate limit metrics', async () => {
    const { body } = await fetchMetrics(baseUrl);

    expect(body).toContain('# HELP toroloom_ws_rate_limited_total');
    expect(body).toContain('# TYPE toroloom_ws_rate_limited_total counter');
    expect(body).toContain('# HELP toroloom_ws_active_rate_limiters');
    expect(body).toContain('# TYPE toroloom_ws_active_rate_limiters gauge');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Symbol Subscription Metrics
// ═══════════════════════════════════════════════════════════════════════════

describe('Symbol Subscription Metrics', () => {
  beforeEach(() => {
    getMetricsRegistry().resetMetrics();
  });

  it('should report per-symbol subscription counts', async () => {
    const clientMap = new Map<any, AuthenticatedClient>([
      ['ws1', makeAuthenticatedClient('user-a', ['RELIANCE', 'TCS'])],
      ['ws2', makeAuthenticatedClient('user-b', ['RELIANCE'])],
    ]);

    recalculateSymbolSubscriptions(clientMap);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const symbolLabels = parsed.get('toroloom_ws_symbol_subscriptions') as Map<string, string>;
    expect(symbolLabels.get('symbol="RELIANCE"')).toBe('2');
    expect(symbolLabels.get('symbol="TCS"')).toBe('1');
  });

  it('should update symbol counts when clients change', async () => {
    const clientMap = new Map<any, AuthenticatedClient>([
      ['ws1', makeAuthenticatedClient('user-a', ['RELIANCE', 'TCS', 'HDFCBANK'])],
    ]);

    recalculateSymbolSubscriptions(clientMap);

    const { body: firstBody } = await fetchMetrics(baseUrl);
    const firstParsed = parseMetrics(firstBody);

    const firstLabels = firstParsed.get('toroloom_ws_symbol_subscriptions') as Map<string, string>;
    expect(firstLabels.get('symbol="RELIANCE"')).toBe('1');
    expect(firstLabels.get('symbol="TCS"')).toBe('1');
    expect(firstLabels.get('symbol="HDFCBANK"')).toBe('1');

    // Remove TCS by replacing the client's symbols
    clientMap.set('ws1', makeAuthenticatedClient('user-a', ['RELIANCE', 'HDFCBANK']));
    recalculateSymbolSubscriptions(clientMap);

    const { body: secondBody } = await fetchMetrics(baseUrl);
    const secondParsed = parseMetrics(secondBody);

    const secondLabels = secondParsed.get('toroloom_ws_symbol_subscriptions') as Map<string, string>;
    expect(secondLabels.get('symbol="RELIANCE"') ?? '0').toBe('1');
    expect(secondLabels.get('symbol="HDFCBANK"') ?? '0').toBe('1');
    // TCS should be purged (no longer in the map)
    expect(secondLabels.has('symbol="TCS"')).toBe(false);
  });

  it('should clear all symbol subscriptions for empty client map', async () => {
    const clientMap = new Map<any, AuthenticatedClient>([
      ['ws1', makeAuthenticatedClient('user-a', ['RELIANCE'])],
    ]);

    recalculateSymbolSubscriptions(clientMap);
    recalculateSymbolSubscriptions(new Map()); // empty

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const symbolLabels = parsed.get('toroloom_ws_symbol_subscriptions');
    // Should be absent entirely (gauge was reset, no labels set)
    expect(symbolLabels).toBeUndefined();
  });

  it('should handle multiple clients sharing the same symbol', async () => {
    const clientMap = new Map<any, AuthenticatedClient>([
      ['ws1', makeAuthenticatedClient('user-a', ['RELIANCE'])],
      ['ws2', makeAuthenticatedClient('user-b', ['RELIANCE'])],
      ['ws3', makeAuthenticatedClient('user-c', ['RELIANCE'])],
      ['ws4', makeAuthenticatedClient('user-d', ['TCS'])],
    ]);

    recalculateSymbolSubscriptions(clientMap);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const symbolLabels = parsed.get('toroloom_ws_symbol_subscriptions') as Map<string, string>;
    expect(symbolLabels.get('symbol="RELIANCE"')).toBe('3');
    expect(symbolLabels.get('symbol="TCS"')).toBe('1');
  });

  it('should include HELP and TYPE for symbol subscriptions', async () => {
    recalculateSymbolSubscriptions(new Map([
      ['ws1', makeAuthenticatedClient('user-a', ['RELIANCE'])],
    ]));

    const { body } = await fetchMetrics(baseUrl);
    expect(body).toContain('# HELP toroloom_ws_symbol_subscriptions');
    expect(body).toContain('# TYPE toroloom_ws_symbol_subscriptions gauge');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Tick Latency Histogram Metrics
// ═══════════════════════════════════════════════════════════════════════════

describe('Tick Latency Metrics', () => {
  beforeEach(() => {
    getMetricsRegistry().resetMetrics();
  });

  it('should record tick dispatch latency observations', async () => {
    observeTickLatency('user-a', 5); // 5ms → 0.005s

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const histLabels = parsed.get('toroloom_broker_tick_dispatch_seconds_count') as Map<string, string>;
    expect(histLabels.get('user_id="user-a"')).toBe('1');
  });

  it('should accumulate multiple latency observations per user', async () => {
    observeTickLatency('user-a', 5);
    observeTickLatency('user-a', 10);
    observeTickLatency('user-b', 2);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const histCount = parsed.get('toroloom_broker_tick_dispatch_seconds_count') as Map<string, string>;
    expect(histCount.get('user_id="user-a"')).toBe('2');
    expect(histCount.get('user_id="user-b"')).toBe('1');
  });

  it('should distribute observations into histogram buckets', async () => {
    // 5ms → falls into the 0.01 bucket (0.01s = 10ms)
    observeTickLatency('user-a', 5);
    // 200ms → falls into the 0.1 bucket (0.1s = 100ms) or the +Inf bucket
    observeTickLatency('user-b', 200);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const histBucket = parsed.get('toroloom_broker_tick_dispatch_seconds_bucket') as Map<string, string>;
    // Check that the 0.01 bucket (10ms) has user-a's 5ms observation
    const userA005 = [...histBucket.entries()].find(
      ([k]) => k.includes('user_id="user-a"') && k.includes('0.01'),
    );
    expect(userA005).toBeDefined();
    expect(userA005![1]).toBe('1');

    // +Inf bucket should have both observations
    const userInf = [...histBucket.entries()].find(
      ([k]) => k.includes('user_id="user-b"') && k.includes('+Inf'),
    );
    expect(userInf).toBeDefined();
    expect(userInf![1]).toBe('1');
  });

  it('should include HELP and TYPE for tick latency metrics', async () => {
    observeTickLatency('user-a', 1);

    const { body } = await fetchMetrics(baseUrl);
    expect(body).toContain('# HELP toroloom_broker_tick_dispatch_seconds');
    expect(body).toContain('# TYPE toroloom_broker_tick_dispatch_seconds histogram');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cache Metrics
// ═══════════════════════════════════════════════════════════════════════════

describe('Cache Metrics', () => {
  beforeEach(() => {
    getMetricsRegistry().resetMetrics();
  });

  it('should increment cache hit counter per endpoint', async () => {
    incrementCacheHit('win-loss');
    incrementCacheHit('win-loss');
    incrementCacheHit('pnl');

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const hitLabels = parsed.get('toroloom_cache_hits_total') as Map<string, string>;
    expect(hitLabels.get('endpoint="win-loss"')).toBe('2');
    expect(hitLabels.get('endpoint="pnl"')).toBe('1');
  });

  it('should increment cache miss counter per endpoint', async () => {
    incrementCacheMiss('win-loss');
    incrementCacheMiss('sector-concentration');
    incrementCacheMiss('sector-concentration');

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const missLabels = parsed.get('toroloom_cache_misses_total') as Map<string, string>;
    expect(missLabels.get('endpoint="win-loss"')).toBe('1');
    expect(missLabels.get('endpoint="sector-concentration"')).toBe('2');
  });

  it('should observe cache lookup latency histogram', async () => {
    observeCacheLookup('win-loss', 5); // 5ms → 0.005s

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const histCount = parsed.get('toroloom_cache_lookup_seconds_count') as Map<string, string>;
    expect(histCount.get('endpoint="win-loss"')).toBe('1');
  });

  it('should accumulate lookup latency observations', async () => {
    observeCacheLookup('win-loss', 3);
    observeCacheLookup('win-loss', 7);
    observeCacheLookup('pnl', 2);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const histCount = parsed.get('toroloom_cache_lookup_seconds_count') as Map<string, string>;
    expect(histCount.get('endpoint="win-loss"')).toBe('2');
    expect(histCount.get('endpoint="pnl"')).toBe('1');
  });

  it('should observe cache compute latency histogram', async () => {
    observeCacheCompute('sector-concentration', 1500); // 1500ms → 1.5s

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const histCount = parsed.get('toroloom_cache_compute_seconds_count') as Map<string, string>;
    expect(histCount.get('endpoint="sector-concentration"')).toBe('1');
  });

  it('should accumulate compute latency observations', async () => {
    observeCacheCompute('win-loss', 200);
    observeCacheCompute('win-loss', 300);
    observeCacheCompute('pnl', 150);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    const histCount = parsed.get('toroloom_cache_compute_seconds_count') as Map<string, string>;
    expect(histCount.get('endpoint="win-loss"')).toBe('2');
    expect(histCount.get('endpoint="pnl"')).toBe('1');
  });

  it('should track distinct endpoints independently', async () => {
    incrementCacheHit('win-loss');
    incrementCacheMiss('pnl');
    observeCacheLookup('win-loss', 5);
    observeCacheCompute('pnl', 200);

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    // Verify hit counter for win-loss
    const hitLabels = parsed.get('toroloom_cache_hits_total') as Map<string, string>;
    expect(hitLabels.get('endpoint="win-loss"')).toBe('1');

    // Verify miss counter for pnl
    const missLabels = parsed.get('toroloom_cache_misses_total') as Map<string, string>;
    expect(missLabels.get('endpoint="pnl"')).toBe('1');

    // Verify lookup histogram count
    const lookupLabels = parsed.get('toroloom_cache_lookup_seconds_count') as Map<string, string>;
    expect(lookupLabels.get('endpoint="win-loss"')).toBe('1');

    // Verify compute histogram count
    const computeLabels = parsed.get('toroloom_cache_compute_seconds_count') as Map<string, string>;
    expect(computeLabels.get('endpoint="pnl"')).toBe('1');
  });

  it('should include HELP and TYPE lines for all cache metrics', async () => {
    incrementCacheHit('win-loss');
    observeCacheLookup('win-loss', 1);

    const { body } = await fetchMetrics(baseUrl);

    const expected: { name: string; type: string }[] = [
      { name: 'toroloom_cache_hits_total', type: 'counter' },
      { name: 'toroloom_cache_misses_total', type: 'counter' },
      { name: 'toroloom_cache_lookup_seconds', type: 'histogram' },
      { name: 'toroloom_cache_compute_seconds', type: 'histogram' },
    ];

    for (const { name, type } of expected) {
      expect(body).toContain(`# HELP ${name}`);
      expect(body).toContain(`# TYPE ${name} ${type}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Sync Bridge Metrics
// ═══════════════════════════════════════════════════════════════════════════

describe('Sync Bridge Metrics', () => {
  beforeEach(() => {
    getMetricsRegistry().resetMetrics();
  });

  it('should increment send-failure counter', async () => {
    incrementSyncBridgeSendFailure();
    incrementSyncBridgeSendFailure();
    incrementSyncBridgeSendFailure();

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    expect(parsed.get('toroloom_sync_bridge_send_failures_total')).toBe('3');
  });

  it('should increment circuit-breaker trip counter', async () => {
    incrementSyncBridgeCircuitBreakerTrip();

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    expect(parsed.get('toroloom_sync_bridge_circuit_breaker_trips_total')).toBe('1');
  });

  it('should accumulate circuit-breaker trips across multiple calls', async () => {
    incrementSyncBridgeCircuitBreakerTrip();
    incrementSyncBridgeCircuitBreakerTrip();
    incrementSyncBridgeCircuitBreakerTrip();

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    expect(parsed.get('toroloom_sync_bridge_circuit_breaker_trips_total')).toBe('3');
  });

  it('should start at zero after registry reset', async () => {
    incrementSyncBridgeSendFailure();
    incrementSyncBridgeCircuitBreakerTrip();
    getMetricsRegistry().resetMetrics();

    // After reset, increment and verify it starts from 1
    incrementSyncBridgeSendFailure();

    const { body } = await fetchMetrics(baseUrl);
    const parsed = parseMetrics(body);

    expect(parsed.get('toroloom_sync_bridge_send_failures_total')).toBe('1');
  });

  it('should include HELP and TYPE lines for sync bridge metrics', async () => {
    incrementSyncBridgeSendFailure();

    const { body } = await fetchMetrics(baseUrl);

    expect(body).toContain('# HELP toroloom_sync_bridge_send_failures_total');
    expect(body).toContain('# TYPE toroloom_sync_bridge_send_failures_total counter');
    expect(body).toContain('# HELP toroloom_sync_bridge_circuit_breaker_trips_total');
    expect(body).toContain('# TYPE toroloom_sync_bridge_circuit_breaker_trips_total counter');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integrated State — Broker + Rate Limit + Subscriptions + Cache
// ═══════════════════════════════════════════════════════════════════════════

describe('Integrated Metrics State', () => {
  beforeEach(() => {
    getMetricsRegistry().resetMetrics();
    state.clients.clear();
    state.userConnectionCount.clear();
    state.connectionAlertedUsers.clear();
  });

  it('should report all metric families simultaneously', async () => {
    // Set up WebSocket state
    const ws1 = makeMockWs('c1');
    state.clients.set(ws1, makeAuthenticatedClient('user-a', ['RELIANCE', 'TCS']));
    state.userConnectionCount.set('user-a', 1);

    // Set up broker state
    setBrokerConnected('zerodha', true);
    setBrokerConnected('angel', false);
    incrementBrokerAuthError('angel');
    incrementBrokerReconnects('angel');

    // Set up rate limit state
    incrementRateLimited();
    incrementRateLimited();
    setActiveRateLimiters(1);

    // Push WS state
    updateMetrics(state.userConnectionCount, state.clients, state.connectionAlertedUsers);

    const { body } = await fetchMetrics(baseUrl);

    // All metric names should appear
    expect(body).toContain('toroloom_ws_total_connections');
    expect(body).toContain('toroloom_broker_connected');
    expect(body).toContain('toroloom_broker_auth_errors_total');
    expect(body).toContain('toroloom_broker_reconnects_total');
    expect(body).toContain('toroloom_ws_rate_limited_total');
    expect(body).toContain('toroloom_ws_active_rate_limiters');
    expect(body).toContain('toroloom_ws_symbol_subscriptions');

    const parsed = parseMetrics(body);

    // WebSocket gauges
    expect(parsed.get('toroloom_ws_total_connections')).toBe('1');
    expect(parsed.get('toroloom_ws_authenticated_users')).toBe('1');

    // Broker gauges
    const brokerLabels = parsed.get('toroloom_broker_connected') as Map<string, string>;
    expect(brokerLabels.get('broker="zerodha"')).toBe('1');
    expect(brokerLabels.get('broker="angel"')).toBe('0');

    // Rate limit gauges
    expect(parsed.get('toroloom_ws_rate_limited_total')).toBe('2');
    expect(parsed.get('toroloom_ws_active_rate_limiters')).toBe('1');

    // Symbol subscriptions
    const symbolLabels = parsed.get('toroloom_ws_symbol_subscriptions') as Map<string, string>;
    expect(symbolLabels.get('symbol="RELIANCE"')).toBe('1');
    expect(symbolLabels.get('symbol="TCS"')).toBe('1');
  });
});
