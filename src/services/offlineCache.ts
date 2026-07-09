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
 * Compression:
 *   Large cache entries (>5KB raw) are compressed with lz-string to reduce
 *   AsyncStorage usage. Compression is transparent — load() auto-decompresses.
 *
 * Smart TTL:
 *   Each namespace has a custom TTL based on data volatility (see NAMESPACE_TTL).
 *
 * Cache Analytics:
 *   Hit/miss counters and storage statistics are tracked in-memory for
 *   diagnostics and can be logged to Firebase analytics.
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
import LZString from 'lz-string';
import { log } from '../utils/logger';

// ──── Constants ────────────────────────────────────────────────────────────

const CACHE_PREFIX = 'toroloom_cache';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes (fallback)
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — absolute max

/** Compression threshold: entries larger than this (raw JSON length) get compressed */
const COMPRESS_THRESHOLD = 5 * 1024; // 5KB

/** Marker stored in compressed entries so load() knows to decompress */
const COMPRESSED_MARKER = '__lz__';

// ──── Smart TTL per namespace (based on data volatility) ───────────────────
//
// Market data / F&O chains change every second → very short TTL
// Portfolio/watchlist → minutes
// Community/education → hours (mostly static)
//
export const NAMESPACE_TTL: Record<string, number> = {
  // Volatile — real-time market data
  market: 30 * 1000,        // 30 seconds
  fno: 30 * 1000,           // 30 seconds
  openOrders: 30 * 1000,    // 30 seconds (critical to be fresh)

  // Semi-volatile — user data changes with actions
  portfolio: 2 * 60 * 1000, // 2 minutes
  watchlist: 2 * 60 * 1000, // 2 minutes

  // Stable — content changes slowly
  community: 5 * 60 * 1000,  // 5 minutes
  aiInsights: 10 * 60 * 1000, // 10 minutes

  // Static — basically immutable
  education: 60 * 60 * 1000, // 1 hour
};

function getTTL(namespace: string): number {
  return NAMESPACE_TTL[namespace] ?? DEFAULT_TTL_MS;
}

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
  /** Whether the data is lz-string compressed */
  compressed?: boolean;
}

const CURRENT_CACHE_VERSION = 2; // Bumped for compression support

// ──── Cache Analytics ──────────────────────────────────────────────────────

export interface CacheAnalytics {
  hits: number;
  misses: number;
  staleHits: number;
  saves: number;
  compressionRatio: number; // average compression ratio (0-1, higher = better)
  totalBytesSaved: number;
  totalRawBytes: number;
  totalCompressedBytes: number;
}

const _analytics: CacheAnalytics = {
  hits: 0,
  misses: 0,
  staleHits: 0,
  saves: 0,
  compressionRatio: 0,
  totalBytesSaved: 0,
  totalRawBytes: 0,
  totalCompressedBytes: 0,
};

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

/** Compress a JSON string using lz-string if it's large enough */
function maybeCompress(json: string): { value: string; compressed: boolean } {
  if (json.length >= COMPRESS_THRESHOLD) {
    const compressed = COMPRESSED_MARKER + LZString.compressToUTF16(json);
    return { value: compressed, compressed: true };
  }
  return { value: json, compressed: false };
}

/** Decompress a string if it was compressed */
function maybeDecompress(value: string): string {
  if (value.startsWith(COMPRESSED_MARKER)) {
    return LZString.decompressFromUTF16(value.slice(COMPRESSED_MARKER.length)) || value;
  }
  return value;
}

/**
 * Get total storage stats for all cache entries.
 * Uses raw string length as a proxy for byte size.
 */
async function computeStorageStats(): Promise<{
  totalBytes: number;
  perNamespace: Record<string, number>;
}> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    let totalBytes = 0;
    const perNamespace: Record<string, number> = {};

    for (const key of cacheKeys) {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        // Use character count × 2 as a UTF-16 byte proxy (consistent for comparison)
        const bytes = raw.length * 2;
        const ns = key.replace(CACHE_PREFIX + ':', '');
        perNamespace[ns] = bytes;
        totalBytes += bytes;
      }
    }

    return { totalBytes, perNamespace };
  } catch {
    return { totalBytes: 0, perNamespace: {} };
  }
}

// ──── Public API ──────────────────────────────────────────────────────────

export const offlineCache = {
  /**
   * Get current cache analytics (hit/miss/save counters).
   */
  getAnalytics(): Readonly<CacheAnalytics> {
    return { ..._analytics };
  },

  /**
   * Reset analytics counters.
   */
  resetAnalytics(): void {
    _analytics.hits = 0;
    _analytics.misses = 0;
    _analytics.staleHits = 0;
    _analytics.saves = 0;
    _analytics.compressionRatio = 0;
    _analytics.totalBytesSaved = 0;
    _analytics.totalRawBytes = 0;
    _analytics.totalCompressedBytes = 0;
  },

  /**
   * Get storage usage statistics.
   */
  getStorageStats: computeStorageStats,

  /**
   * Get the effective TTL for a namespace (used by stores for display).
   */
  getTTL(namespace: string): number {
    return getTTL(namespace);
  },

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

      let json = JSON.stringify(entry);
      const rawLength = json.length;

      // Compress if large enough
      const { value, compressed } = maybeCompress(json);
      json = value;

      await AsyncStorage.setItem(cacheKey(namespace), json);

      // Track analytics
      _analytics.saves++;
      if (compressed) {
        const compressedLength = json.length;
        _analytics.totalRawBytes += rawLength;
        _analytics.totalCompressedBytes += compressedLength;
        _analytics.totalBytesSaved += rawLength - compressedLength;
        _analytics.compressionRatio =
          _analytics.totalRawBytes > 0
            ? _analytics.totalBytesSaved / _analytics.totalRawBytes
            : 0;
      }
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
   * @param ttlMs      Optional custom TTL in ms (defaults to namespace-specific TTL)
   */
  async load<T>(
    namespace: string,
    ttlMs?: number,
  ): Promise<{ data: T; source: 'fresh' | 'stale' } | null> {
    const effectiveTTL = ttlMs ?? getTTL(namespace);

    try {
      const raw = await AsyncStorage.getItem(cacheKey(namespace));
      if (!raw) {
        _analytics.misses++;
        return null;
      }

      // Decompress if compressed
      const decompressed = maybeDecompress(raw);
      const entry: CacheEntry<T> = JSON.parse(decompressed);

      // Version mismatch → discard
      if (entry.version !== CURRENT_CACHE_VERSION) {
        await AsyncStorage.removeItem(cacheKey(namespace));
        _analytics.misses++;
        return null;
      }

      if (isFresh(entry, effectiveTTL)) {
        _analytics.hits++;
        return { data: entry.data, source: 'fresh' };
      }

      if (isStaleButUsable(entry)) {
        _analytics.staleHits++;
        return { data: entry.data, source: 'stale' };
      }

      // Too old → discard
      await AsyncStorage.removeItem(cacheKey(namespace));
      _analytics.misses++;
      return null;
    } catch {
      _analytics.misses++;
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
      offlineCache.resetAnalytics();
    } catch {
      // Best-effort
    }
  },

  /**
   * Get diagnostics info — useful for debugging.
   */
  async getDiagnostics(): Promise<{ namespace: string; age: string; source: string; sizeBytes: number }[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      const result: { namespace: string; age: string; source: string; sizeBytes: number }[] = [];

      for (const key of cacheKeys) {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        try {
          const decompressed = maybeDecompress(raw);
          const entry: CacheEntry = JSON.parse(decompressed);
          const ageMs = Date.now() - entry.fetchedAtMs;
          const age = ageMs < 60_000
            ? `${Math.round(ageMs / 1000)}s`
            : ageMs < 3_600_000
              ? `${Math.round(ageMs / 60_000)}m`
              : `${Math.round(ageMs / 3_600_000)}h`;

          const nsTTL = getTTL(key.replace(CACHE_PREFIX + ':', ''));
          const source = isFresh(entry, nsTTL)
            ? 'fresh'
            : isStaleButUsable(entry)
              ? 'stale'
              : 'expired';

          result.push({
            namespace: key.replace(CACHE_PREFIX + ':', ''),
            age,
            source,
            sizeBytes: raw.length * 2,
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

  /**
   * Get a single cache diagnostic entry for a namespace.
   * Returns null if no cache entry exists.
   */
  async getDiagnosticEntry(namespace: string): Promise<{ fetchedAt: string; isFresh: boolean } | null> {
    try {
      const raw = await AsyncStorage.getItem(cacheKey(namespace));
      if (!raw) return null;
      const decompressed = maybeDecompress(raw);
      const entry: CacheEntry = JSON.parse(decompressed);
      const nsTTL = getTTL(namespace);
      return {
        fetchedAt: entry.fetchedAt,
        isFresh: isFresh(entry, nsTTL),
      };
    } catch {
      return null;
    }
  },
};
