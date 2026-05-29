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

import { Counter, Gauge, register } from 'prom-client';
import type { AuthenticatedClient } from '../websocket/state';

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

// ──── Registry Access ──────────────────────────────────────────────────────

/**
 * Returns the singleton Prometheus registry instance.
 * Used by the /metrics route to render the text format.
 */
export function getMetricsRegistry() {
  return register;
}
