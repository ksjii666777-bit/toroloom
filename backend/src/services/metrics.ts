/**
 * ============================================================================
 * Toroloom Prometheus Metrics — WebSocket Connection Gauges
 * ============================================================================
 *
 * Exposes Prometheus gauges for operational monitoring of WebSocket
 * connection state.
 *
 * IMPORTANT: This module does NOT import from state.ts to avoid a circular
 * dependency (state.ts calls updateMetrics() from here).  Instead, all
 * relevant state is passed as parameters to updateMetrics() by the caller.
 *
 * Usage:
 *   import { updateMetrics } from './services/metrics';
 *   updateMetrics(userConnectionCount, clients, connectionAlertedUsers);
 *
 * The GET /metrics endpoint is registered in index.ts and returns the
 * Prometheus text format for scraping.
 * ============================================================================
 */

import { collectDefaultMetrics, Counter, Gauge, Histogram, register } from 'prom-client';
import type { AuthenticatedClient } from '../websocket/state';

// ═══════════════════════════════════════════════════════════════════════════
// Default Node.js Runtime Metrics
// ═══════════════════════════════════════════════════════════════════════════
//
// Registers standard Node.js process metrics via prom-client's built-in
// collector.  These are exposed alongside the custom Toroloom metrics on
// the same /metrics endpoint.
//
// Registered metrics include:
//   process_cpu_user_seconds_total   — user CPU time
//   process_cpu_system_seconds_total — system CPU time
//   process_resident_memory_bytes    — RSS
//   nodejs_eventloop_lag_seconds     — event loop lag (gauge, updated per tick)
//   nodejs_heap_size_used_bytes      — V8 heap used
//   nodejs_heap_size_total_bytes     — V8 heap total
//   nodejs_external_memory_bytes     — V8 external memory
//   nodejs_active_handles_total      — active handles
//   nodejs_active_requests_total     — active requests
//   nodejs_gc_runs_total             — GC runs (counter)
//   nodejs_gc_pause_seconds_total    — GC pause time (counter)
// ═══════════════════════════════════════════════════════════════════════════

collectDefaultMetrics({
  // Register on the shared registry so /metrics picks them up automatically.
  register,
  // Attach a label so these can be filtered separately from app metrics if needed.
  labels: { component: 'nodejs' },
  // 10-second event loop monitoring interval — a good balance between
  // granularity and overhead.
  eventLoopMonitoringPrecision: 10,
});

// ──── Gauge Definitions ─────────────────────────────────────────────────────

/** Total active WebSocket connections (authenticated clients in the map). */
const totalConnectionsGauge = new Gauge({
  name: 'toroloom_ws_total_connections',
  help: 'Total number of active authenticated WebSocket connections.',
});

/** Number of distinct authenticated users currently connected. */
const authenticatedUsersGauge = new Gauge({
  name: 'toroloom_ws_authenticated_users',
  help: 'Number of distinct authenticated users with active WebSocket connections.',
});

/**
 * Per-user connection count labelled by userId.
 * Enables dashboards to spot individual users with excessive tabs.
 */
const userConnectionsGauge = new Gauge({
  name: 'toroloom_ws_user_connections',
  help: 'WebSocket connections per authenticated user.',
  labelNames: ['user_id'] as const,
});

/** Number of users who have exceeded MAX_CONNECTIONS_PER_USER. */
const alertedUsersGauge = new Gauge({
  name: 'toroloom_ws_alerted_users',
  help: 'Number of users who have exceeded the concurrent connection threshold.',
});

/**
 * Counter for ticks sent to users, labelled by userId.
 * Use PromQL rate(toroloom_ws_ticks_total[1m]) to derive ticks per second.
 */
const ticksTotalCounter = new Counter({
  name: 'toroloom_ws_ticks_total',
  help: 'Total number of price ticks sent to clients, labelled by user.',
  labelNames: ['user_id'] as const,
});

// ──── Broker Health Metrics ─────────────────────────────────────────────

/**
 * Broker connection status by broker type.
 * 1 = connected, 0 = disconnected.
 */
const brokerConnectedGauge = new Gauge({
  name: 'toroloom_broker_connected',
  help: 'Broker connection status (1 = connected, 0 = disconnected).',
  labelNames: ['broker'] as const,
});

/** Cumulative count of broker authentication failures by broker type. */
const brokerAuthErrorsCounter = new Counter({
  name: 'toroloom_broker_auth_errors_total',
  help: 'Total number of broker authentication failures by broker type.',
  labelNames: ['broker'] as const,
});

/** Cumulative count of broker reconnection events by broker type. */
const brokerReconnectsCounter = new Counter({
  name: 'toroloom_broker_reconnects_total',
  help: 'Total number of broker reconnection or failover events.',
  labelNames: ['broker'] as const,
});

// ──── Rate Limit Metrics ─────────────────────────────────────────────────

/** Cumulative count of WebSocket messages rejected by rate limiter. */
const rateLimitedCounter = new Counter({
  name: 'toroloom_ws_rate_limited_total',
  help: 'Total number of WebSocket messages rate-limited (rejected).',
});

/** Number of connections currently in an active rate-limited state. */
const activeRateLimitersGauge = new Gauge({
  name: 'toroloom_ws_active_rate_limiters',
  help: 'Number of WebSocket connections currently in rate-limited state.',
});

// ──── Per-User Metrics ──────────────────────────────────────────────────

/**
 * Per-user active subscription count labelled by userId.
 * Represents the number of symbols each user is currently subscribed to
 * (aggregated across all their WebSocket connections).
 */
const activeSubscriptionsGauge = new Gauge({
  name: 'toroloom_ws_active_subscriptions',
  help: 'Number of symbols each user is actively subscribed to, aggregated across all their connections.',
  labelNames: ['user_id'] as const,
});

/**
 * Per-symbol subscription count labelled by symbol name.
 * Enables dashboards to identify which symbols are most popular.
 */
const symbolSubscriptionsGauge = new Gauge({
  name: 'toroloom_ws_symbol_subscriptions',
  help: 'Number of active WebSocket subscriptions per symbol.',
  labelNames: ['symbol'] as const,
});

/**
 * Histogram of tick dispatch latency per user.
 * Measures the time between entering the broker tick callback and
 * completing ws.send() for each dispatched tick.
 *
 * Use PromQL:
 *   histogram_quantile(0.99, sum(rate(toroloom_broker_tick_dispatch_seconds_bucket[5m])) by (le))
 * to derive p99 latency.
 */
const tickLatencyHistogram = new Histogram({
  name: 'toroloom_broker_tick_dispatch_seconds',
  help: 'Time taken to marshal and dispatch a single tick from the broker callback.',
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
  labelNames: ['user_id'] as const,
});

// ──── Update Function ──────────────────────────────────────────────────────

/**
 * Read the current WebSocket state and push all gauge values to Prometheus.
 *
 * Accepts state as parameters rather than importing from state.ts directly
 * to avoid circular dependency (state.ts → metrics.ts → state.ts).
 *
 * Safe to call:
 *  - After every connection auth (incrementConnectionCount)
 *  - After every disconnect (decrementConnectionCount)
 *  - On a timer if desired (e.g. setInterval(updateMetrics, 15_000))
 *
 * Calling more often than once per scrape is harmless — setting a gauge
 * to the same value is a no-op in the registry.
 */
export function updateMetrics(
  userConnCount: Map<string, number>,
  clientMap: Map<any, AuthenticatedClient>,
  alertedSet: Set<string>,
): void {
  // ── Reset per-user labels first to purge stale entries ─────────
  // Without this, users who disconnect retain their label in the
  // Prometheus gauge forever, accumulating garbage over time.
  userConnectionsGauge.reset();

  for (const [userId, count] of userConnCount) {
    userConnectionsGauge.set({ user_id: userId }, count);
  }

  // ── Per-user subscription counts ───────────────────────────────
  activeSubscriptionsGauge.reset();
  const subCountPerUser = new Map<string, number>();
  for (const [, client] of clientMap) {
    const count = subCountPerUser.get(client.userId) ?? 0;
    subCountPerUser.set(client.userId, count + client.symbols.length);
  }
  for (const [userId, count] of subCountPerUser) {
    activeSubscriptionsGauge.set({ user_id: userId }, count);
  }

  // ── Per-symbol subscription counts ─────────────────────────────
  recalculateSymbolSubscriptions(clientMap);

  // ── Aggregate gauges ───────────────────────────────────────────
  authenticatedUsersGauge.set(userConnCount.size);
  totalConnectionsGauge.set(clientMap.size);
  alertedUsersGauge.set(alertedSet.size);
}

/**
 * Increment the per-user tick counter by one.
 * Called from the WebSocket tick callback in handlers.ts — intentionally
 * kept lightweight (no gauge iteration) so it's safe to call on every tick.
 */
export function incrementTickCounter(userId: string): void {
  ticksTotalCounter.inc({ user_id: userId });
}

/**
 * Recalculate per-symbol subscription counts from the current client map.
 * Resets the gauge and sets all active subscriptions per symbol.
 *
 * Called from:
 *  - updateMetrics() on auth/disconnect (ensures consistency)
 *  - subscribe/unsubscribe handlers (real-time update)
 */
export function recalculateSymbolSubscriptions(
  clientMap: Map<any, AuthenticatedClient>,
): void {
  const counts = new Map<string, number>();
  for (const [, client] of clientMap) {
    for (const symbol of client.symbols) {
      counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
    }
  }
  symbolSubscriptionsGauge.reset();
  for (const [symbol, count] of counts) {
    symbolSubscriptionsGauge.set({ symbol }, count);
  }
}

/**
 * Observe a single tick dispatch latency.
 * Called from the tick callback in handlers.ts after ws.send() completes.
 *
 * @param userId - The user receiving the tick (for labelling)
 * @param durationMs - Time in milliseconds spent dispatching the tick
 */
export function observeTickLatency(userId: string, durationMs: number): void {
  tickLatencyHistogram.observe({ user_id: userId }, durationMs / 1000);
}

// ──── Broker Metrics Functions ───────────────────────────────────────────

/** Set broker connected status (1 = connected, 0 = disconnected). */
export function setBrokerConnected(broker: string, connected: boolean): void {
  brokerConnectedGauge.set({ broker }, connected ? 1 : 0);
}

/** Increment broker auth error counter. */
export function incrementBrokerAuthError(broker: string): void {
  brokerAuthErrorsCounter.inc({ broker });
}

/** Increment broker reconnect/failover counter. */
export function incrementBrokerReconnects(broker: string): void {
  brokerReconnectsCounter.inc({ broker });
}

// ──── Rate Limit Metrics Functions ───────────────────────────────────────

/** Increment the rate-limited counter. */
export function incrementRateLimited(): void {
  rateLimitedCounter.inc();
}

/** Update active rate limiter gauge to the current count. */
export function setActiveRateLimiters(count: number): void {
  activeRateLimitersGauge.set(count);
}

// ──── Registry Access ──────────────────────────────────────────────────────

/**
 * Returns the singleton Prometheus registry instance.
 * Used by the /metrics route to render the text format.
 */
export function getMetricsRegistry() {
  return register;
}
