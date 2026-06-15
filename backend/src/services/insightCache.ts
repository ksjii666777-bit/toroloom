/**
 * Toroloom Insight Cache
 *
 * TTL-based in-memory cache with stale-while-revalidate pattern.
 *
 * ── How it works ─────────────────────────────────────────────
 *  1. Data is cached for 1 hour (STALE_AFTER_MS).
 *  2. After 1 hour, data is "stale":
 *       - The stale value is STILL returned to the user (no wait!)
 *       - A background refresh is triggered automatically
 *  3. After 2 hours (HARD_EXPIRY_MS), data is truly expired:
 *       - The user must wait for a fresh fetch
 *  4. Duplicate in-flight refreshes are prevented:
 *       - If 10 requests come in for the same stale symbol,
 *         only ONE background refresh fires
 *
 * ── Usage ────────────────────────────────────────────────────
 *  import { insightCache } from '../services/insightCache';
 *
 *  // Check cache first
 *  const cached = insightCache.get('RELIANCE');
 *  if (cached) return cached;        // fresh or stale, either way
 *
 *  // Or use the auto-refresh helper:
 *  const result = await insightCache.getOrRefresh('RELIANCE', () =>
 *    generateInsight('RELIANCE')
 *  );
 */

export interface CacheEntry<T> {
  data: T;
  staleAt: number;    // after this → return stale + bg refresh
  expiresAt: number;  // after this → force fetch (no stale serve)
}

export class InsightCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private inflight = new Map<string, Promise<T>>();

  // ── Config ──────────────────────────────────────────────────
  private staleAfterMs: number;
  private hardExpiryMs: number;
  private maxEntries: number;

  constructor(opts?: {
    staleAfterMs?: number;   // default: 1 hour
    hardExpiryMs?: number;   // default: 2 hours
    maxEntries?: number;     // default: 500
  }) {
    this.staleAfterMs = opts?.staleAfterMs ?? 60 * 60 * 1000;       // 1 hour
    this.hardExpiryMs = opts?.hardExpiryMs ?? 2 * 60 * 60 * 1000;   // 2 hours
    this.maxEntries = opts?.maxEntries ?? 500;
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Get a cached entry.
   * Returns `{ data, stale: boolean }` or `undefined` if not cached / hard-expired.
   *
   * `stale === true` means the caller should trigger a background refresh.
   */
  get(key: string): { data: T; stale: boolean } | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const now = Date.now();

    // Hard-expired → remove and return nothing
    if (now >= entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Stale but still within hard expiry → return data, mark as stale
    if (now >= entry.staleAt) {
      return { data: entry.data, stale: true };
    }

    // Fresh
    return { data: entry.data, stale: false };
  }

  /**
   * Set a cache entry with the default TTL.
   */
  set(key: string, data: T): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      staleAt: now + this.staleAfterMs,
      expiresAt: now + this.hardExpiryMs,
    });

    // Evict oldest entries if we exceed the max
    this.evictIfNeeded();
  }

  /**
   * Delete a cached entry.
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.inflight.delete(key);
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
    this.inflight.clear();
  }

  /**
   * Get the current cache size.
   */
  get size(): number {
    return this.cache.size;
  }

  // ── Auto-Refresh ────────────────────────────────────────────

  /**
   * Get a cached value, automatically refreshing in the background if stale.
   *
   * - **Fresh**  → returns immediately
   * - **Stale**  → returns stale data immediately, fires bg refresh
   * - **Miss**   → awaits fresh fetch (first-time or hard-expired)
   * - **In-flight** → joins the existing refresh promise
   *
   * @param key     Cache key (stock symbol)
   * @param refresher  Async function that fetches fresh data
   * @returns The (possibly stale) data
   */
  async getOrRefresh(key: string, refresher: () => Promise<T>): Promise<T> {
    // 1. Check cache
    const cached = this.get(key);

    // 2. Cache hit (fresh or stale)
    if (cached) {
      if (cached.stale) {
        // Trigger background refresh (fire-and-forget)
        this.refreshInBackground(key, refresher);
      }
      return cached.data;
    }

    // 3. Cache miss — fetch fresh (deduplicate in-flight)
    return this.fetchAndCache(key, refresher);
  }

  /**
   * Force-refresh a cached entry (used by background jobs or manual triggers).
   */
  async forceRefresh(key: string, refresher: () => Promise<T>): Promise<T> {
    return this.fetchAndCache(key, refresher);
  }

  /**
   * Clean up expired entries (called automatically on set, but can be called externally).
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // ── Private helpers ─────────────────────────────────────────

  /**
   * Background refresh — won't throw (errors are logged silently).
   */
  private refreshInBackground(key: string, refresher: () => Promise<T>): void {
    // Don't fire duplicate refresh requests
    if (this.inflight.has(key)) return;

    const promise = refresher()
      .then((data) => {
        this.set(key, data);
        this.inflight.delete(key);
      })
      .catch((err) => {
        console.error(`[InsightCache] Background refresh failed for "${key}":`, err.message);
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise as Promise<T>);
  }

  /**
   * Fetch data, cache it, and return. Deduplicates concurrent fetches.
   */
  private async fetchAndCache(key: string, refresher: () => Promise<T>): Promise<T> {
    // Deduplicate: if another request is already fetching, join it
    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = refresher()
      .then((data) => {
        this.set(key, data);
        this.inflight.delete(key);
        return data;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /**
   * Evict the oldest entries when we exceed maxEntries.
   * Uses insertion-order iteration (Map preserves insertion order).
   */
  private evictIfNeeded(): void {
    while (this.cache.size > this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.inflight.delete(firstKey);
      } else {
        break;
      }
    }
  }
}

// ──── Singleton instance ──────────────────────────────────────
// Default: 1-hour stale, 2-hour hard expiry, 500 max entries
export const insightCache = new InsightCache<import('./ai').AIInsight>();

// Periodic prune every 15 minutes to clean hard-expired entries & stale in-flight
if (typeof setInterval !== 'undefined') {
  setInterval(() => insightCache.prune(), 15 * 60 * 1000);
}
