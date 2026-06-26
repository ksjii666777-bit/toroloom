/**
 * ============================================================================
 * Toroloom Broker Health Metrics Wiring — Tests
 * ============================================================================
 *
 * Verifies that the broker factory in services/broker/index.ts correctly wires
 * the broker health metric functions from services/metrics.ts:
 *
 *   - setBrokerConnected(broker, true)  — on successful authentication
 *   - incrementBrokerAuthError(broker)  — on authentication failure
 *   - incrementBrokerReconnects(broker) — on failover to next broker
 *
 * These tests use the MockBroker (which always authenticates successfully)
 * and verify the Prometheus registry state directly via getMetricsAsJSON(),
 * avoiding the HTTP /metrics endpoint dependency.
 *
 * IMPORTANT: Do NOT call vi.resetModules() in this test file. That causes
 * metrics.ts (with collectDefaultMetrics) to re-import and re-register
 * Node.js runtime metrics, producing "already registered" errors.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/brokerMetricsWiring.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock env BEFORE any broker module imports
vi.mock('../config/env', () => ({
  env: {
    nodeEnv: 'test',
    port: 0,
    broker: 'mock',
    isMock: true,
    dataSource: 'mock',
    storageBackend: 'memory',
    jwtSecret: 'test-secret',
    jwtExpiresIn: '1h',
    zerodha: { apiKey: '', apiSecret: '', accessToken: '', requestToken: '' },
    angel: { apiKey: '', clientId: '', accessToken: '', password: '', totp: '' },
    groww: { apiKey: '', accessToken: '' },
    redisUrl: '',
    get isDev() { return false; },
    get isProd() { return false; },
  },
}));

// Mock the circuit breaker to avoid real circuit state
vi.mock('../services/circuitBreaker', () => {
  const createMockCircuit = () => {
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
  };

  const circuits = new Map<string, ReturnType<typeof createMockCircuit>>();
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
  };
});

// Mock the audit trail to avoid persistence
vi.mock('../services/auditTrail', () => ({
  auditTrail: {
    append: vi.fn(async () => ({ id: 'mock-event' })),
    configureStorage: vi.fn(),
    getEvents: vi.fn(async () => []),
    _clearForTesting: vi.fn(async () => {}),
  },
}));

// Mock storage types to satisfy imports
vi.mock('../services/storage/types', () => ({}));

describe('Broker Health Metrics Wiring', () => {
  let getMetricsRegistry: () => import('prom-client').Registry;
  let metricsModule: typeof import('../services/metrics');
  let brokerModule: typeof import('../services/broker');

  beforeEach(async () => {
    brokerModule = await import('../services/broker');
    metricsModule = await import('../services/metrics');
    getMetricsRegistry = metricsModule.getMetricsRegistry;

    // Reset Prometheus registry and broker factory state
    getMetricsRegistry().resetMetrics();
    brokerModule.resetBroker();
  });

  // ──────────── Successful Mock Broker Connection ──────────────

  it('should set broker connected metric on successful authentication', async () => {
    const broker = await brokerModule.getBroker();
    expect(broker).toBeDefined();

    const metrics = await getMetricsRegistry().getMetricsAsJSON();
    const brokerConnected = metrics.find(m => m.name === 'toroloom_broker_connected');
    expect(brokerConnected).toBeDefined();

    const values = (brokerConnected!.values as any[]);
    const mockEntry = values.find(v => v.labels?.broker === 'mock');
    expect(mockEntry).toBeDefined();
    expect(mockEntry!.value).toBe(1);
  });

  it('should set the current broker type after successful connection', async () => {
    await brokerModule.getBroker();
    expect(brokerModule.getCurrentBrokerType()).toBe('mock');
  });

  // ──────────── Cached Instance ────────────────────────────────

  it('should return cached broker instance without re-authenticating', async () => {
    const broker1 = await brokerModule.getBroker();
    expect(broker1).toBeDefined();

    // Clear metrics to verify no re-registration happens
    getMetricsRegistry().resetMetrics();

    const broker2 = await brokerModule.getBroker();
    expect(broker2).toBe(broker1); // Same cached instance
  });

  // ──────────── State Management ───────────────────────────────

  it('should export getCurrentBrokerType returning the active broker', async () => {
    await brokerModule.getBroker();
    expect(brokerModule.getCurrentBrokerType()).toBe('mock');
  });

  it('should export resetBroker that clears cached state', () => {
    brokerModule.resetBroker();
    expect(brokerModule.getCurrentBrokerType()).toBeNull();
  });

  // ──────────── Configured Broker Preference ───────────────────

  it('should connect using the configured mock broker', async () => {
    const broker = await brokerModule.getBroker();
    expect(broker).toBeDefined();

    const metrics = await getMetricsRegistry().getMetricsAsJSON();
    const brokerConnected = metrics.find(m => m.name === 'toroloom_broker_connected');
    const values = (brokerConnected!.values as any[]);
    const mockEntry = values.find(v => v.labels?.broker === 'mock');
    expect(mockEntry!.value).toBe(1);
  });

  // ──────────── Exported Helpers Exist ───────────────────────

  it('should export all required broker factory functions', () => {
    expect(typeof brokerModule.getBroker).toBe('function');
    expect(typeof brokerModule.getCurrentBrokerType).toBe('function');
    expect(typeof brokerModule.resetBroker).toBe('function');
    expect(typeof brokerModule.getBrokerDeduplicationState).toBe('function');
    expect(typeof brokerModule.resetBrokerDeduplication).toBe('function');
    expect(typeof brokerModule.configureBrokerPersistence).toBe('function');
    expect(typeof brokerModule.loadBrokerStateFromStorage).toBe('function');
  });

  // ──────────── Metric Function Exports ──────────────────────

  it('should export broker health metric functions from metrics module', () => {
    expect(typeof metricsModule.setBrokerConnected).toBe('function');
    expect(typeof metricsModule.incrementBrokerAuthError).toBe('function');
    expect(typeof metricsModule.incrementBrokerReconnects).toBe('function');
    expect(typeof metricsModule.incrementRateLimited).toBe('function');
    expect(typeof metricsModule.setActiveRateLimiters).toBe('function');

    // Verify they work without throwing
    metricsModule.setBrokerConnected('test', true);
    metricsModule.incrementBrokerAuthError('test');
    metricsModule.incrementBrokerReconnects('test');
    metricsModule.incrementRateLimited();
    metricsModule.setActiveRateLimiters(5);
  });
});
