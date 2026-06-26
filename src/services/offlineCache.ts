/**
 * ============================================================================
 * Offline Cache — AsyncStorage-backed with TTL + stale-while-revalidate
 * ============================================================================
 *
 * Caches data fetched from the API so it can be served when the network
 * is unavailable. Uses a "stale-while-revalidate" pattern:
 *   - Fresh data (< TTL) → returned immediately
 *   - Stale data (> TTL) → returned, but triggers background refresh
 *   - No data → returns null (caller handles fallback to mock data)
 *
 * Usage:
 *   import { offlineCache } from '../services/offlineCache';
 *
 *   // After successful API call:
 *   await offlineCache.save('portfolio', { holdings, trades });
 *
 *   // Before API call / on network error:
 *   const cached = await offlineCache.load('portfolio');
 *
 * Cache entries are namespaced so they never collide:
 *   AsyncStorage key = `toroloom_cache:${namespace}`
 *
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '../utils/logger';

// ──── Constants ────────────────────────────────────────────────────────────

const CACHE_PREFIX = 'toroloom_cache';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — after this, stale data is discarded

// ──── Types ────────────────────────────────────────────────────────────────

interface CacheEntry<T = unknown> {
  /** The cached payload */
  data: T;
  /** When the data was originally fetched */
  fetchedAt: string;
  /** Wall-clock timestamp for TTL comparison (ms since epoch) */
  fetchedAtMs: number;
  /** Arbitrary version number — bump to invalidate all caches on app upgrade */
  version: number;
}

const CURRENT_CACHE_VERSION = 1;

// ──── Helpers ──────────────────────────────────────────────────────────────

function cacheKey(namespace: string): string {
  return `${CACHE_PREFIX}:${namespace}`;
}

function isFresh(entry: CacheEntry, ttlMs: number): boolean {
  return Date.now() - entry.fetchedAtMs < ttlMs;
}

function isStaleButUsable(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAtMs < STALE_TTL_MS;
}

// ──── Public API ──────────────────────────────────────────────────────────

export const offlineCache = {
  /**
   * Save data to the offline cache.
   *
   * @param namespace  Unique key for this data type (e.g. 'portfolio', 'watchlist')
   * @param data       The payload to cache (must be JSON-serializable)
   */
  async save<T>(namespace: string, data: T): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        fetchedAt: new Date().toISOString(),
        fetchedAtMs: Date.now(),
        version: CURRENT_CACHE_VERSION,
      };
      await AsyncStorage.setItem(cacheKey(namespace), JSON.stringify(entry));
    } catch (error) {
      // Non-critical — cache writes are best-effort
      log.warn(`[OfflineCache] Failed to save "${namespace}":`, error);
    }
  },

  /**
   * Load data from the offline cache.
   *
   * Returns an object describing the state of the cached data:
   *   - { data, source: 'fresh' }       — Data is within TTL
   *   - { data, source: 'stale' }       — Data is past TTL but still usable
   *   - null                            — No cached data, or cache expired
   *
   * @param namespace  Unique key for this data type
   * @param ttlMs      Optional custom TTL in ms (defaults to 5 minutes)
   */
  async load<T>(
    namespace: string,
    ttlMs: number = DEFAULT_TTL_MS,
  ): Promise<{ data: T; source: 'fresh' | 'stale' } | null> {
    try {
      const raw = await AsyncStorage.getItem(cacheKey(namespace));
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);

      // Version mismatch → discard
      if (entry.version !== CURRENT_CACHE_VERSION) {
        await AsyncStorage.removeItem(cacheKey(namespace));
        return null;
      }

      if (isFresh(entry, ttlMs)) {
        return { data: entry.data, source: 'fresh' };
      }

      if (isStaleButUsable(entry)) {
        return { data: entry.data, source: 'stale' };
      }

      // Too old → discard
      await AsyncStorage.removeItem(cacheKey(namespace));
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Remove a specific cache entry.
   */
  async remove(namespace: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(cacheKey(namespace));
    } catch {
      // Best-effort
    }
  },

  /**
   * Clear ALL offline cache entries (useful for logout or manual refresh).
   */
  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch {
      // Best-effort
    }
  },

  /**
   * Get diagnostics info — useful for debugging.
   */
  async getDiagnostics(): Promise<{ namespace: string; age: string; source: string }[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      const result: { namespace: string; age: string; source: string }[] = [];

      for (const key of cacheKeys) {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        try {
          const entry: CacheEntry = JSON.parse(raw);
          const ageMs = Date.now() - entry.fetchedAtMs;
          const age = ageMs < 60_000
            ? `${Math.round(ageMs / 1000)}s`
            : ageMs < 3_600_000
              ? `${Math.round(ageMs / 60_000)}m`
              : `${Math.round(ageMs / 3_600_000)}h`;
          const source = isFresh(entry, DEFAULT_TTL_MS)
            ? 'fresh'
            : isStaleButUsable(entry)
              ? 'stale'
              : 'expired';
          result.push({
            namespace: key.replace(CACHE_PREFIX + ':', ''),
            age,
            source,
          });
        } catch {
          // skip corrupt entries
        }
      }

      return result;
    } catch {
      return [];
    }
  },
};
