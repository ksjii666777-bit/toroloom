/**
 * ============================================================================
 * Toroloom Broker Failover Metrics — Integration Tests
 * ============================================================================
 *
 * Tests the broker failover chain (Zerodha → Angel → Mock) and verifies that
 * the Prometheus broker health metrics from services/metrics.ts are correctly
 * wired through services/broker/index.ts at each step:
 *
 *   - toroloom_broker_connected{broker="mock"} = 1   (final fallback succeeds)
 *   - toroloom_broker_auth_errors_total{broker=*}     (failed authentications)
 *   - toroloom_broker_reconnects_total{broker=*}      (failover events)
 *
 * Strategy:
 *   env.broker is mocked to 'zerodha' so createBrokerWithFallback() starts
 *   at index 0 (Zerodha). ZerodhaBroker.authenticate() throws because the
 *   mocked env provides empty credentials. The same happens for AngelBroker.
 *   MockBroker (index 2) always succeeds with empty credentials, serving as
 *   the final fallback.
 *
 * Circuit breaker behaviour:
 *   The mocked circuit breaker opens after 3 consecutive failures per broker.
 *   When OPEN, isAvailable() returns false and the broker is skipped without
 *   incrementing auth errors (but logs a disconnection to the audit trail).
 *   The mock exposes a _resetCircuitBreakers() function that is called in
 *   beforeEach to ensure clean state between tests.
 *
 * IMPORTANT: Do NOT call vi.resetModules() in this test file. That causes
 * metrics.ts (with collectDefaultMetrics) to re-import and re-register
 * Node.js runtime metrics, producing "already registered" errors.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/brokerFailoverMetrics.int.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ──── Mock env to start at 'zerodha' ──────────────────────────────────────
// With empty credentials, ZerodhaBroker and AngelBroker will throw on
// authenticate(). MockBroker (the final fallback) always succeeds.
vi.mock('../config/env', () => ({
  env: {
    nodeEnv: 'test',
    port: 0,
    broker: 'zerodha',
    isMock: false,
    dataSource: 'live',
    storageBackend: 'memory',
    jwtSecret: 'test-secret',
    jwtExpiresIn: '1h',
    databaseUrl: '',
    mongodbUri: '',
    mongodbDbName: '',
    zerodha: { apiKey: '', apiSecret: '', accessToken: '', requestToken: '' },
    angel: { apiKey: '', clientId: '', accessToken: '', password: '', totp: '' },
    groww: { apiKey: '', accessToken: '' },
    redisUrl: '',
    get isDev() { return false; },
  },
}));

// ──── Mock circuit breaker ────────────────────────────────────────────────
// Opens after 3 consecutive failures per broker name.
// Exposes _resetCircuitBreakers() so beforeEach can reset circuit state
// independently of the Prometheus registry and broker factory.
vi.mock('../services/circuitBreaker', () => {
  const circuits = new Map<string, ReturnType<typeof createMockCircuit>>();

  function createMockCircuit() {
    let state = 'CLOSED';
    let failures = 0;
    return {
      isAvailable: vi.fn(() => state !== 'OPEN'),
      call: vi.fn(async (fn: () => Promise<any>) => {
        try {
          const result = await fn();
          state = 'CLOSED';
          failures = 0;
          return result;
        } catch (err) {
          failures++;
          if (failures >= 3) state = 'OPEN';
          throw err;
        }
      }),
      snapshot: vi.fn(() => ({ state, failures, successes: 0 })),
    };
  }

  return {
    getCircuitBreaker: vi.fn((name: string) => {
      if (!circuits.has(name)) {
        circuits.set(name, createMockCircuit());
      }
      return circuits.get(name)!;
    }),
    CircuitOpenError: class CircuitOpenError extends Error {
      constructor(msg: string) { super(msg); this.name = 'CircuitOpenError'; }
    },
    // Reset mechanism: clears all circuit state between tests
    _resetCircuitBreakers: () => { circuits.clear(); },
  };
});

// ──── Mock audit trail ────────────────────────────────────────────────────
vi.mock('../services/auditTrail', () => ({
  auditTrail: {
    append: vi.fn(async () => ({ id: 'mock-event' })),
    configureStorage: vi.fn(),
    getEvents: vi.fn(async () => []),
    _clearForTesting: vi.fn(async () => {}),
  },
}));

// Satisfy import resolution
vi.mock('../services/storage/types', () => ({}));

// ═════════════════════════════════════════════════════════════════════════
// Test Suites
// ═════════════════════════════════════════════════════════════════════════

describe('Broker Failover Metrics — Full Chain (Zerodha → Angel → Mock)', () => {
  let getMetricsRegistry: () => import('prom-client').Registry;
  let metricsModule: typeof import('../services/metrics');
  let brokerModule: typeof import('../services/broker');

  beforeEach(async () => {
    brokerModule = await import('../services/broker');
    metricsModule = await import('../services/metrics');
    getMetricsRegistry = metricsModule.getMetricsRegistry;

    // Reset ALL state between tests:
    // 1. Prometheus registry (resets all metric values to zero)
    getMetricsRegistry().resetMetrics();
    // 2. Broker factory (clears brokerInstance, currentBrokerType, dedup cache)
    brokerModule.resetBroker();
    // 3. Circuit breaker mock (clears circuit state to prevent test bleed)
    const cbModule = await import('../services/circuitBreaker');
    if ('_resetCircuitBreakers' in cbModule) {
      (cbModule as any)._resetCircuitBreakers();
    }
  });

  // ──────────── Fallback Resolution ───────────────────────────────────

  it('should fall back to mock broker when zerodha and angel both fail', async () => {
    const broker = await brokerModule.getBroker();

    expect(broker).toBeDefined();
    expect(broker.name).toBe('Mock Broker');
    expect(brokerModule.getCurrentBrokerType()).toBe('mock');
  });

  it('should set broker_connected=1 for mock only (failed brokers have no entry)', async () => {
    // Note: setBrokerConnected() is only called with `true` on success.
    // Failed brokers (zerodha, angel) never appear in the metric because
    // setBrokerConnected(type, false) is NOT called — the gauge only
    // contains entries for brokers that successfully authenticated.
    await brokerModule.getBroker();

    const metrics = await getMetricsRegistry().getMetricsAsJSON();
    const brokerConnected = metrics.find(m => m.name === 'toroloom_broker_connected');
    expect(brokerConnected).toBeDefined();

    const values = (brokerConnected!.values as any[]);

    // Only mock should have an entry (value=1)
    const mockEntry = values.find((v: any) => v.labels?.broker === 'mock');
    expect(mockEntry).toBeDefined();
    expect(mockEntry!.value).toBe(1);

    // Zerodha and angel should NOT have entries (they were never set)
    expect(values.find((v: any) => v.labels?.broker === 'zerodha')).toBeUndefined();
    expect(values.find((v: any) => v.labels?.broker === 'angel')).toBeUndefined();
  });

  // ──────────── Auth Error Accumulation ──────────────────────────────

  it('should record one auth error each for zerodha and angel on single failover', async () => {
    await brokerModule.getBroker();

    const metrics = await getMetricsRegistry().getMetricsAsJSON();
    const authErrors = metrics.find(m => m.name === 'toroloom_broker_auth_errors_total')!;
    const values = (authErrors.values as any[]);

    const zerodhaErr = values.find((v: any) => v.labels?.broker === 'zerodha');
    const angelErr = values.find((v: any) => v.labels?.broker === 'angel');

    expect(zerodhaErr).toBeDefined();
    expect(zerodhaErr!.value).toBe(1);
    expect(angelErr).toBeDefined();
    expect(angelErr!.value).toBe(1);
  });

  it('should not record auth errors for mock (it succeeds on first try)', async () => {
    await brokerModule.getBroker();

    const metrics = await getMetricsRegistry().getMetricsAsJSON();
    const authErrors = metrics.find(m => m.name === 'toroloom_broker_auth_errors_total')!;
    const mockAuthErr = (authErrors.values as any[]).find(
      (v: any) => v.labels?.broker === 'mock',
    );

    expect(mockAuthErr).toBeUndefined();
  });

  it('should accumulate auth errors across repeated failover cycles', async () => {
    // 3 cycles of reset + reconnect = 3 auth errors per failed broker
    await brokerModule.getBroker();
    brokerModule.resetBroker();
    await brokerModule.getBroker();
    brokerModule.resetBroker();
    await brokerModule.getBroker();

    const metrics = await getMetricsRegistry().getMetricsAsJSON();
    const authErrors = metrics.find(m => m.name === 'toroloom_broker_auth_errors_total')!;
    const values = (authErrors.values as any[]);

    expect(values.find((v: any) => v.labels?.broker === 'zerodha')!.value).toBe(3);
    expect(values.find((v: any) => v.labels?.broker === 'angel')!.value).toBe(3);
  });

  // ──────────── Reconnect / Failover Metrics ─────────────────────────

  it('should record a reconnect only for angel (i=1, not i=0 for zerodha)', async () => {
    // createBrokerWithFallback() calls incrementBrokerReconnects(type) when
    // i > 0 — i.e., when the failing broker is NOT the first in the chain.
    // So zerodha (i=0) gets no reconnect increment; angel (i=1) gets 1.
    await brokerModule.getBroker();

    const metrics = await getMetricsRegistry().getMetricsAsJSON();
    const reconnects = metrics.find(m => m.name === 'toroloom_broker_reconnects_total')!;
    const values = (reconnects.values as any[]);

    // Zerodha was never incremented (i=0) — no entry in counter
    expect(values.find((v: any) => v.labels?.broker === 'zerodha')).toBeUndefined();

    // Angel was incremented once (i=1) — entry exists with value 1
    const angelRec = values.find((v: any) => v.labels?.broker === 'angel');
    expect(angelRec).toBeDefined();
    expect(angelRec!.value).toBe(1);
  });

  it('should not record reconnects for mock', async () => {
    await brokerModule.getBroker();

    const metrics = await getMetricsRegistry().getMetricsAsJSON();
    const reconnects = metrics.find(m => m.name === 'toroloom_broker_reconnects_total')!;
    const mockRec = (reconnects.values as any[]).find(
      (v: any) => v.labels?.broker === 'mock',
    );

    expect(mockRec).toBeUndefined();
  });

  it('should accumulate reconnects across multiple failover cycles', async () => {
    // 3 cycles = 3 reconnects for angel (one per cycle at i=1)
    await brokerModule.getBroker();
    brokerModule.resetBroker();
    await brokerModule.getBroker();
    brokerModule.resetBroker();
    await brokerModule.getBroker();

    const metrics = await getMetricsRegistry().getMetricsAsJSON();
    const reconnects = metrics.find(m => m.name === 'toroloom_broker_reconnects_total')!;
    const values = (reconnects.values as any[]);

    expect(values.find((v: any) => v.labels?.broker === 'angel')!.value).toBe(3);
  });

  // ──────────── Connected State After Multiple Cycles ────────────────

  it('should expose only mock in connected gauge after repeated cycles', async () => {
    // Even after multiple failover cycles, only mock should appear in the
    // connected gauge (zerodha and angel never succeed, so they never appear)
    await brokerModule.getBroker();
    brokerModule.resetBroker();
    await brokerModule.getBroker();

    const metrics = await getMetricsRegistry().getMetricsAsJSON();
    const brokerConnected = metrics.find(m => m.name === 'toroloom_broker_connected')!;
    const values = (brokerConnected.values as any[]);

    // Only one entry (mock) should exist
    expect(values.length).toBe(1);
    expect(values[0].labels?.broker).toBe('mock');
    expect(values[0].value).toBe(1);
  });

  // ──────────── All Metric Families Present ───────────────────────────

  it('should expose all 3 broker metric families simultaneously', async () => {
    await brokerModule.getBroker();

    const metrics = await getMetricsRegistry().getMetricsAsJSON();
    const names = metrics.filter(m =>
      m.name.startsWith('toroloom_broker_'),
    ).map(m => m.name);

    expect(names).toContain('toroloom_broker_connected');
    expect(names).toContain('toroloom_broker_auth_errors_total');
    expect(names).toContain('toroloom_broker_reconnects_total');
  });
});
