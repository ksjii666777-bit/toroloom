/**
 * Toroloom In-Memory Cache
 *
 * Simple TTL-based cache for reducing external API calls.
 * Uses a Map with periodic stale entry cleanup.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private inflight = new Map<string, Promise<any>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private defaultTTLMs: number = 30_000) {
    // Auto-cleanup stale entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  /**
   * Get a cached value. Returns undefined if the key doesn't exist or is expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Set a cached value with an optional TTL override (in ms).
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTLMs),
    });
  }

  /**
   * Get a cached value, or compute and cache it if missing/expired.
   *
   * Deduplicates concurrent in-flight fetches for the same key to
   * avoid cache stampede when multiple requests arrive simultaneously.
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs?: number,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;

    // Dedup in-flight fetches — if another caller is already fetching
    // this key, share the same promise instead of making a new call.
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = fetcher()
      .then((value) => {
        this.set(key, value, ttlMs);
        this.inflight.delete(key);
        return value;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /**
   * Delete a specific key from the cache.
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Delete all keys matching a prefix pattern.
   */
  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get cache statistics (for observability).
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }

  /**
   * Remove expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Dispose the cache and stop the cleanup interval.
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
    this.inflight.clear();
  }
}

/**
 * Singleton instance used across the app.
 *
 * Default TTLs by data type (configurable per-call):
 *   - Indices:    30s  (slowly changing intraday)
 *   - Stocks:     5min (rarely changes)
 *   - Quote:      10s  (fast-changing)
 *   - Bulk Quotes: 10s  (fast-changing)
 *   - OHLC:      10min (historical, rarely changes)
 *   - Search:    5min  (relatively stable)
 */
export const marketCache = new MemoryCache();

// Named TTL constants for readability
export const CACHE_TTL = {
  INDICES: 30_000,       // 30 seconds
  STOCKS: 300_000,        // 5 minutes
  QUOTE: 10_000,          // 10 seconds
  BULK_QUOTES: 10_000,    // 10 seconds
  OHLC: 600_000,          // 10 minutes
  SEARCH: 300_000,        // 5 minutes
} as const;
