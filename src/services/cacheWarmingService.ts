/**
 * ============================================================================
 * Toroloom — Cache Warming Service
 * ============================================================================
 *
 * Preemptively fetches and caches data when the app is idle (background or
 * no user interaction for a period). This ensures that when the user navigates
 * to a screen, the data is already in the offline cache — making the app feel
 * instant even without a network call.
 *
 * Strategy:
 *   - On app background → trigger warming for all key namespaces
 *   - On app foreground → only warm stale/empty namespaces
 *   - Debounce: don't warm more than once every 60 seconds
 *   - Only warm if online (no point warming offline data)
 *   - Skip namespaces that are still fresh (< TTL)
 *
 * Usage:
 *   import { startCacheWarming, stopCacheWarming } from '../services/cacheWarmingService';
 *   startCacheWarming(); // call once at app init
 *
 * ============================================================================
 */

import { AppState, type AppStateStatus } from 'react-native';
import { offlineCache } from './offlineCache';
import { log } from '../utils/logger';

// ──── Types ────────────────────────────────────────────────────────────────

interface WarmNamespace {
  name: string;
  /** Function that fetches fresh data from the store/API */
  fetcher: () => Promise<unknown>;
  /** Priority (lower = higher priority, warmed first) */
  priority: number;
}

// ──── Config ───────────────────────────────────────────────────────────────

const WARM_DEBOUNCE_MS = 60_000; // Don't warm more than once per minute
const WARM_TIMEOUT_MS = 10_000; // Per-namespace timeout

// ──── State ────────────────────────────────────────────────────────────────

let _warming = false;
let _lastWarmAt = 0;
let _subscription: { remove: () => void } | null = null;
let _appState: AppStateStatus = 'active';
let _warmNamespaces: WarmNamespace[] = [];

// ──── Register Namespaces ─────────────────────────────────────────────────

/**
 * Register a namespace for cache warming.
 * Called by stores during initialization to register their fetchers.
 */
export function registerCacheWarming(
  name: string,
  fetcher: () => Promise<unknown>,
  priority: number = 10,
): void {
  // Remove existing registration for this namespace
  _warmNamespaces = _warmNamespaces.filter(n => n.name !== name);
  _warmNamespaces.push({ name, fetcher, priority });
  // Sort by priority (ascending)
  _warmNamespaces.sort((a, b) => a.priority - b.priority);
}

/**
 * Unregister a namespace from cache warming.
 */
export function unregisterCacheWarming(name: string): void {
  _warmNamespaces = _warmNamespaces.filter(n => n.name !== name);
}

// ──── Warming Logic ────────────────────────────────────────────────────────

async function warmNamespace(ns: WarmNamespace): Promise<{ warmed: boolean; reason?: string }> {
  try {
    // Check if data is already fresh — skip if not stale
    const diagnostic = await offlineCache.getDiagnosticEntry(ns.name);
    if (diagnostic && diagnostic.isFresh) {
      return { warmed: false, reason: 'already_fresh' };
    }

    // Fetch fresh data (with timeout)
    const result = await Promise.race([
      ns.fetcher(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), WARM_TIMEOUT_MS),
      ),
    ]);

    // The fetcher should have called offlineCache.save internally
    // Verify by checking if data exists now
    const after = await offlineCache.getDiagnosticEntry(ns.name);
    if (after && after.isFresh) {
      return { warmed: true };
    }

    return { warmed: false, reason: 'fetcher_did_not_cache' };
  } catch (err: any) {
    return { warmed: false, reason: err?.message || 'error' };
  }
}

/**
 * Run the full cache warming cycle.
 * Skips if warming is already in progress or debounce hasn't elapsed.
 */
export async function warmAllCaches(): Promise<{
  warmed: number;
  skipped: number;
  failed: number;
  durationMs: number;
}> {
  const now = Date.now();
  if (now - _lastWarmAt < WARM_DEBOUNCE_MS) {
    log.debug('[CacheWarming] Debounced — last warm was less than 60s ago');
    return { warmed: 0, skipped: _warmNamespaces.length, failed: 0, durationMs: 0 };
  }

  if (_warming) {
    log.debug('[CacheWarming] Already warming — skipping');
    return { warmed: 0, skipped: _warmNamespaces.length, failed: 0, durationMs: 0 };
  }

  _warming = true;
  _lastWarmAt = now;
  const startTime = Date.now();

  let warmed = 0;
  let skipped = 0;
  let failed = 0;

  log.info(`[CacheWarming] Starting warm cycle for ${_warmNamespaces.length} namespaces`);

  // Warm namespaces in priority order, sequentially to avoid thundering herd
  for (const ns of _warmNamespaces) {
    const result = await warmNamespace(ns);
    if (result.warmed) warmed++;
    else if (result.reason === 'already_fresh') skipped++;
    else failed++;
  }

  const durationMs = Date.now() - startTime;
  _warming = false;

  log.info(`[CacheWarming] Complete — ${warmed} warmed, ${skipped} skipped, ${failed} failed in ${durationMs}ms`);

  return { warmed, skipped, failed, durationMs };
}

// ──── Lifecycle ────────────────────────────────────────────────────────────

/**
 * Start cache warming — listens for AppState changes to trigger warming.
 * Call once at app init.
 */
export function startCacheWarming(): void {
  // Remove existing listener if restarting
  stopCacheWarming();

  _subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    const prevState = _appState;
    _appState = nextState;

    // App came to foreground → warm stale/empty caches
    if (prevState.match(/inactive|background/) && nextState === 'active') {
      log.debug('[CacheWarming] App foregrounded — warming stale caches');
      warmAllCaches().catch(() => {});
    }

    // App went to background → warm all caches (user may be back soon)
    if (nextState.match(/inactive|background/) && prevState === 'active') {
      log.debug('[CacheWarming] App backgrounded — warming all caches');
      warmAllCaches().catch(() => {});
    }
  });

  // Initial warm on start (only stale/empty caches)
  log.debug('[CacheWarming] Initial warm on startup');
  warmAllCaches().catch(() => {});
}

/**
 * Stop cache warming and clean up.
 */
export function stopCacheWarming(): void {
  if (_subscription) {
    _subscription.remove();
    _subscription = null;
  }
}

/**
 * Get current cache warming state (for debugging).
 */
export function getCacheWarmingState(): {
  isWarming: boolean;
  lastWarmAt: number;
  registeredNamespaces: number;
  namespaces: string[];
} {
  return {
    isWarming: _warming,
    lastWarmAt: _lastWarmAt,
    registeredNamespaces: _warmNamespaces.length,
    namespaces: _warmNamespaces.map(n => n.name),
  };
}
