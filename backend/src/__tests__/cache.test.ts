/**
 * ============================================================================
 * Toroloom — MemoryCache Unit Tests
 * ============================================================================
 *
 * Tests the in-memory TTL cache covering get/set, TTL expiration, inflight
 * deduplication, prefix deletion, cleanup, dispose, and edge cases.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/cache.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryCache, CACHE_TTL } from '../services/cache';

describe('MemoryCache', () => {
  let cache: MemoryCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new MemoryCache(10_000); // 10s default TTL
  });

  afterEach(() => {
    cache.dispose();
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // get / set
  // ─────────────────────────────────────────────────────────────────────────

  describe('get / set', () => {
    it('should store and retrieve a value', () => {
      cache.set('key1', 'hello');
      expect(cache.get('key1')).toBe('hello');
    });

    it('should return undefined for a missing key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should return undefined for an expired entry', () => {
      cache.set('ephemeral', 'value', 100); // 100ms TTL
      vi.advanceTimersByTime(101);
      expect(cache.get('ephemeral')).toBeUndefined();
    });

    it('should return the value if not yet expired', () => {
      cache.set('still-valid', 'value', 1000);
      vi.advanceTimersByTime(999);
      expect(cache.get('still-valid')).toBe('value');
    });

    it('should use default TTL when not specified', () => {
      cache.set('default-ttl', 'val');
      vi.advanceTimersByTime(9_999);
      expect(cache.get('default-ttl')).toBe('val');
      vi.advanceTimersByTime(2);
      expect(cache.get('default-ttl')).toBeUndefined();
    });

    it('should overwrite existing key', () => {
      cache.set('key', 'first');
      cache.set('key', 'second');
      expect(cache.get('key')).toBe('second');
    });

    it('should store objects and arrays', () => {
      const obj = { a: 1, b: [2, 3] };
      cache.set('obj', obj);
      expect(cache.get('obj')).toEqual(obj);

      const arr = [1, 2, 3];
      cache.set('arr', arr);
      expect(cache.get('arr')).toEqual(arr);
    });

    it('should store falsy values (0, false, empty string)', () => {
      cache.set('zero', 0);
      cache.set('false', false);
      cache.set('empty', '');
      expect(cache.get('zero')).toBe(0);
      expect(cache.get('false')).toBe(false);
      expect(cache.get('empty')).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getOrSet
  // ─────────────────────────────────────────────────────────────────────────

  describe('getOrSet', () => {
    it('should return cached value without calling fetcher', async () => {
      const fetcher = vi.fn().mockResolvedValue('expensive');
      cache.set('cached-key', 'cached-value');
      const result = await cache.getOrSet('cached-key', fetcher);
      expect(result).toBe('cached-value');
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should call fetcher and cache result when key is missing', async () => {
      const fetcher = vi.fn().mockResolvedValue('computed');
      const result = await cache.getOrSet('fresh', fetcher);
      expect(result).toBe('computed');
      expect(fetcher).toHaveBeenCalledTimes(1);
      // Subsequent get should return cached value
      expect(cache.get('fresh')).toBe('computed');
    });

    it('should call fetcher again after expiration', async () => {
      const fetcher = vi.fn().mockResolvedValue('stale');
      await cache.getOrSet('expire-me', fetcher, 100);
      vi.advanceTimersByTime(101);
      const result = await cache.getOrSet('expire-me', fetcher);
      expect(result).toBe('stale');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should deduplicate concurrent inflight fetches', async () => {
      let resolveFetcher!: (v: string) => void;
      const fetcher = vi.fn().mockReturnValue(new Promise<string>((resolve) => {
        resolveFetcher = resolve;
      }));

      // Start two concurrent getOrSet calls
      const promise1 = cache.getOrSet('inflight', fetcher);
      const promise2 = cache.getOrSet('inflight', fetcher);

      // Only one should actually invoke the fetcher
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Resolve the fetcher
      resolveFetcher('deduped');
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('deduped');
      expect(result2).toBe('deduped');
    });

    it('should not hang on rejected fetcher — allows retry', async () => {
      const fetcher = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('retry-success');

      await expect(cache.getOrSet('retry', fetcher)).rejects.toThrow('Network error');
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Should be able to retry (inflight entry was cleaned up)
      const result = await cache.getOrSet('retry', fetcher);
      expect(result).toBe('retry-success');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should use custom TTL when provided', async () => {
      const fetcher = vi.fn().mockResolvedValue('custom-ttl');
      await cache.getOrSet('ttl-test', fetcher, 500);
      vi.advanceTimersByTime(499);
      expect(cache.get('ttl-test')).toBe('custom-ttl');
      vi.advanceTimersByTime(2);
      expect(cache.get('ttl-test')).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // delete
  // ─────────────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete a single key', () => {
      cache.set('delete-me', 'value');
      cache.delete('delete-me');
      expect(cache.get('delete-me')).toBeUndefined();
    });

    it('should not throw when deleting a non-existent key', () => {
      expect(() => cache.delete('ghost')).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteByPrefix
  // ─────────────────────────────────────────────────────────────────────────

  describe('deleteByPrefix', () => {
    it('should delete all keys starting with prefix', () => {
      cache.set('user:1', 'a');
      cache.set('user:2', 'b');
      cache.set('admin:1', 'c');
      cache.deleteByPrefix('user:');
      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeUndefined();
      expect(cache.get('admin:1')).toBe('c');
    });

    it('should not delete other keys', () => {
      cache.set('alpha', 1);
      cache.set('beta', 2);
      cache.deleteByPrefix('gamma');
      expect(cache.get('alpha')).toBe(1);
      expect(cache.get('beta')).toBe(2);
    });

    it('should handle empty cache gracefully', () => {
      expect(() => cache.deleteByPrefix('nonexistent')).not.toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // clear
  // ─────────────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // stats
  // ─────────────────────────────────────────────────────────────────────────

  describe('stats', () => {
    it('should return size 0 and empty keys for empty cache', () => {
      const s = cache.stats();
      expect(s.size).toBe(0);
      expect(s.keys).toEqual([]);
    });

    it('should return correct size and keys', () => {
      cache.set('x', 1);
      cache.set('y', 2);
      const s = cache.stats();
      expect(s.size).toBe(2);
      expect(s.keys).toEqual(expect.arrayContaining(['x', 'y']));
    });

    it('should include expired keys in stats until cleanup runs', () => {
      cache.set('soon', 'ephemeral', 100);
      cache.set('stays', 'persistent', 10_000);
      vi.advanceTimersByTime(101);
      const s = cache.stats();
      // stats() counts store entries (including expired but not yet cleaned up)
      // expired entries remain until cleanup runs
      expect(s.size).toBe(2);
      // But get() correctly returns undefined for expired
      expect(cache.get('soon')).toBeUndefined();
      expect(cache.get('stays')).toBe('persistent');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // cleanup (private — tested indirectly)
  // ─────────────────────────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('should remove expired entries after cleanup interval', () => {
      cache.set('expires-soon', 'val', 100);
      cache.set('persists', 'val', 100_000);
      vi.advanceTimersByTime(101);
      // Manual cleanup by calling get (which triggers inline expiry)
      // The cleanup interval runs every 60s — let's advance past it
      vi.advanceTimersByTime(60_000);
      // After cleanup, expired entries are removed from store
      const s = cache.stats();
      expect(s.size).toBe(1);
      expect(s.keys).toEqual(['persists']);
    });

    it('should not affect valid entries', () => {
      cache.set('stays', 'safe', 100_000);
      vi.advanceTimersByTime(60_000); // trigger cleanup
      expect(cache.get('stays')).toBe('safe');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // dispose
  // ─────────────────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('should clear all entries and stop cleanup interval', () => {
      cache.set('a', 1);
      cache.dispose();
      expect(cache.get('a')).toBeUndefined();
      expect(cache.stats().size).toBe(0);

      // Should be safe to call dispose multiple times
      expect(() => cache.dispose()).not.toThrow();
    });

    it('should prevent cleanup from running after dispose', () => {
      cache.set('ephemeral', 'val', 100);
      cache.dispose();
      vi.advanceTimersByTime(60_000); // cleanup would run but shouldn't affect anything
      expect(cache.stats().size).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Custom TTL constructor
  // ─────────────────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should use provided default TTL', () => {
      const shortCache = new MemoryCache(100);
      shortCache.set('key', 'val');
      vi.advanceTimersByTime(101);
      expect(shortCache.get('key')).toBeUndefined();
      shortCache.dispose();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CACHE_TTL exports
  // ─────────────────────────────────────────────────────────────────────────

  describe('CACHE_TTL constants', () => {
    it('should have correct TTL values', () => {
      expect(CACHE_TTL.INDICES).toBe(30_000);
      expect(CACHE_TTL.STOCKS).toBe(300_000);
      expect(CACHE_TTL.QUOTE).toBe(10_000);
      expect(CACHE_TTL.BULK_QUOTES).toBe(10_000);
      expect(CACHE_TTL.OHLC).toBe(600_000);
      expect(CACHE_TTL.SEARCH).toBe(300_000);
    });
  });
});
