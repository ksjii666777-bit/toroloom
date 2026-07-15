/**
 * ============================================================================
 * Toroloom — Background Sync Service
 * ============================================================================
 *
 * Uses expo-task-manager + expo-background-fetch to periodically refresh
 * portfolio and watchlist data while the app is in the background.
 *
 * Users can configure the interval and enable/disable via the
 * BackgroundSyncSettingsScreen.
 *
 * Usage:
 *   import { registerBackgroundDataSync, unregisterBackgroundDataSync }
 *     from '../services/backgroundSyncService';
 *
 *   // At app init (AppNavigator):
 *   registerBackgroundDataSync();
 *
 * Features:
 *   - Configurable interval (15min, 30min, 1hr, 2hr, 4hr)
 *   - Persists user preferences to AsyncStorage
 *   - Fetches portfolio + watchlist + openOrders in background
 *   - Saves to offlineCache so data is fresh when app opens
 *   - Updates offlineStore freshness timestamps
 *   - Logs results for debugging
 *   - Respects minimumInterval (iOS minimum is 15 min)
 * ============================================================================
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '../utils/logger';

// ──── Constants ────────────────────────────────────────────────────────────

const SYNC_TASK_NAME = 'toroloom-background-data-sync';

/** AsyncStorage keys */
const PREF_ENABLED_KEY = 'toroloom_bg_sync_enabled';
const PREF_INTERVAL_KEY = 'toroloom_bg_sync_interval_minutes';
const LAST_SYNC_KEY = 'toroloom_bg_sync_last_sync';

/** Default interval: 30 minutes */
const DEFAULT_INTERVAL_MINUTES = 30;

/** Available interval options (in minutes) */
export const SYNC_INTERVAL_OPTIONS = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
] as const;

// ──── Lazy Module Loaders (same pattern as notificationService) ────────────

const _taskMgrCache: { value: any } = { value: null };
const _bgFetchCache: { value: any } = { value: null };

function getTaskManager(): any {
  if (_taskMgrCache.value) return _taskMgrCache.value;
  try {
    _taskMgrCache.value = require('expo-task-manager');
    return _taskMgrCache.value;
  } catch {
    return { defineTask: () => {} };
  }
}

function getBackgroundFetch(): any {
  if (_bgFetchCache.value) return _bgFetchCache.value;
  try {
    _bgFetchCache.value = require('expo-background-fetch');
    return _bgFetchCache.value;
  } catch {
    return {};
  }
}

// ──── Task Definition ──────────────────────────────────────────────────────

/**
 * Define the background data sync task.
 * This is done at module load time so the task is registered before
 * registerTaskAsync is called.
 */
(() => {
  try {
    const TM = getTaskManager();
    if (TM.defineTask) {
      TM.defineTask(SYNC_TASK_NAME, async () => {
        try {
          await executeBackgroundDataSync();
          const BF = getBackgroundFetch();
          return BF.BackgroundFetchResult?.NewData ?? 2;
        } catch (err) {
          log.warn('[BackgroundSync] Task failed', err);
          const BF = getBackgroundFetch();
          return BF.BackgroundFetchResult?.Failed ?? 3;
        }
      });
    }
  } catch {
    // Task manager not available
  }
})();

// ──── Task Execution ───────────────────────────────────────────────────────

/**
 * Execute the background data sync — fetches fresh portfolio, watchlist,
 * and open orders data and saves to offline cache.
 */
async function executeBackgroundDataSync(): Promise<void> {
  log.info('[BackgroundSync] Starting background data sync');

  const startTime = Date.now();
  const results: { namespace: string; success: boolean; error?: string }[] = [];

  // 1. Refresh portfolio
  try {
    const { usePortfolioStore } = await import('../store/portfolioStore');
    await usePortfolioStore.getState().refreshPortfolio();
    results.push({ namespace: 'portfolio', success: true });
    log.info('[BackgroundSync] Portfolio refreshed');
  } catch (err: any) {
    results.push({ namespace: 'portfolio', success: false, error: err?.message });
    log.warn('[BackgroundSync] Portfolio refresh failed', err?.message);
  }

  // 2. Refresh watchlist
  try {
    const { useWatchlistStore } = await import('../store/watchlistStore');
    await useWatchlistStore.getState().fetchWatchlists();
    results.push({ namespace: 'watchlist', success: true });
    log.info('[BackgroundSync] Watchlist refreshed');
  } catch (err: any) {
    results.push({ namespace: 'watchlist', success: false, error: err?.message });
    log.warn('[BackgroundSync] Watchlist refresh failed', err?.message);
  }

  // 3. Refresh open orders
  try {
    const { usePortfolioStore } = await import('../store/portfolioStore');
    await usePortfolioStore.getState().fetchOpenOrders();
    results.push({ namespace: 'openOrders', success: true });
    log.info('[BackgroundSync] Open orders refreshed');
  } catch (err: any) {
    results.push({ namespace: 'openOrders', success: false, error: err?.message });
    log.warn('[BackgroundSync] Open orders refresh failed', err?.message);
  }

  // 4. Update offline store freshness timestamps
  try {
    const { useOfflineStore } = await import('../store/offlineStore');
    for (const r of results) {
      if (r.success) {
        useOfflineStore.getState().markSynced(r.namespace as any);
      }
    }
    useOfflineStore.getState().computeSyncStatus();
  } catch {
    // Non-critical
  }

  // 5. Save last sync timestamp
  const now = new Date().toISOString();
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, now);
  } catch {
    // Best-effort
  }

  const durationMs = Date.now() - startTime;
  const synced = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  log.info(
    `[BackgroundSync] Cycle complete — ${synced} synced, ${failed} failed in ${durationMs}ms`,
  );

  // Track analytics
  try {
    const { analytics } = await import('./analytics');
    analytics
      .logEvent('background_sync_complete', {
        synced,
        failed,
        durationMs,
        namespaces: results.map((r) => r.namespace).join(','),
      })
      .catch(() => {});
  } catch {
    // Non-critical
  }
}

// ──── Public API ───────────────────────────────────────────────────────────

/**
 * Get whether background data sync is enabled (from AsyncStorage).
 */
export async function getBackgroundSyncEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(PREF_ENABLED_KEY);
    // Default: enabled
    if (val === null) return true;
    return val === 'true';
  } catch {
    return true;
  }
}

/**
 * Get the configured sync interval in minutes (from AsyncStorage).
 */
export async function getBackgroundSyncIntervalMinutes(): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(PREF_INTERVAL_KEY);
    if (val === null) return DEFAULT_INTERVAL_MINUTES;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? DEFAULT_INTERVAL_MINUTES : parsed;
  } catch {
    return DEFAULT_INTERVAL_MINUTES;
  }
}

/**
 * Get the last sync timestamp (ISO string or null).
 */
export async function getLastSyncTimestamp(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

/**
 * Set whether background data sync is enabled.
 * Re-registers or unregisters the background fetch task accordingly.
 */
export async function setBackgroundSyncEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_ENABLED_KEY, String(enabled));
  } catch {
    // Best-effort
  }

  if (enabled) {
    const interval = await getBackgroundSyncIntervalMinutes();
    await registerTask(interval);
  } else {
    await unregisterTask();
  }
}

/**
 * Set the sync interval (in minutes).
 * Re-registers the background fetch task with the new interval.
 */
export async function setBackgroundSyncInterval(minutes: number): Promise<void> {
  try {
    await AsyncStorage.setItem(PREF_INTERVAL_KEY, String(minutes));
  } catch {
    // Best-effort
  }

  const enabled = await getBackgroundSyncEnabled();
  if (enabled) {
    // Re-register with new interval
    await unregisterTask();
    await registerTask(minutes);
  }
}

/**
 * Perform a manual sync now (triggers the background data sync immediately).
 */
export async function syncNow(): Promise<void> {
  log.info('[BackgroundSync] Manual sync triggered');
  await executeBackgroundDataSync();
}

/**
 * Register the background data sync task with the current preferences.
 * Call this once at app init.
 */
export async function registerBackgroundDataSync(): Promise<void> {
  if (Platform.OS === 'web') return;

  const enabled = await getBackgroundSyncEnabled();
  if (!enabled) {
    log.info('[BackgroundSync] Background sync is disabled by user');
    return;
  }

  const interval = await getBackgroundSyncIntervalMinutes();
  await registerTask(interval);
}

/**
 * Unregister the background data sync task.
 */
export async function unregisterBackgroundDataSync(): Promise<void> {
  await unregisterTask();
}

// ──── Internal Task Registration ───────────────────────────────────────────

async function registerTask(intervalMinutes: number): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const BF = getBackgroundFetch();
    if (BF.registerTaskAsync) {
      // Convert minutes to seconds for minimumInterval
      const intervalSeconds = intervalMinutes * 60;
      await BF.registerTaskAsync(SYNC_TASK_NAME, {
        minimumInterval: intervalSeconds,
        stopOnTerminate: false,
        startOnBoot: true,
      });
      log.info(
        `[BackgroundSync] Task registered with interval ${intervalMinutes} min`,
      );
    } else {
      log.warn('[BackgroundSync] Background fetch API not available');
    }
  } catch (err: any) {
    log.warn('[BackgroundSync] Task registration failed', err?.message);
  }
}

async function unregisterTask(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const BF = getBackgroundFetch();
    if (BF.unregisterTaskAsync) {
      await BF.unregisterTaskAsync(SYNC_TASK_NAME);
      log.info('[BackgroundSync] Task unregistered');
    }
  } catch {
    // Ignore if not registered
  }
}

export { SYNC_TASK_NAME };
