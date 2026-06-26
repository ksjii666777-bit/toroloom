/**
 * ============================================================================
 * Toroloom — Offline Cache Tests
 * ============================================================================
 *
 * Tests for the AsyncStorage-backed offline cache with TTL and
 * stale-while-revalidate pattern.
 *
 * Covers:
 *   - save   (store data, error handling)
 *   - load   (fresh, stale, expired, missing, version mismatch, custom TTL)
 *   - remove (specific namespace)
 *   - clearAll (prefix-filtered, non-cache keys preserved)
 *   - getDiagnostics (age formatting, source labels)
 *   - Edge cases (corrupt JSON, concurrent ops, empty cache)
 *
 * All tests mock @react-native-async-storage/async-storage so they
 * run in plain Node.js without a React Native environment.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { offlineCache } from '../services/offlineCache';

// ──── Mock AsyncStorage ───────────────────────────────────────────────────

const STORE = new Map<string, string>();

const mockSetItem = vi.fn(async (key: string, value: string) => {
  STORE.set(key, value);
});

const mockGetItem = vi.fn(async (key: string) => {
  return STORE.get(key) ?? null;
});

const mockRemoveItem = vi.fn(async (key: string) => {
  STORE.delete(key);
});

const mockGetAllKeys = vi.fn(async () => {
  return Array.from(STORE.keys());
});

const mockMultiRemove = vi.fn(async (keys: string[]) => {
  for (const k of keys) STORE.delete(k);
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: (...args: any[]) => (mockSetItem as any)(...args),
    getItem: (...args: any[]) => (mockGetItem as any)(...args),
    removeItem: (...args: any[]) => (mockRemoveItem as any)(...args),
    getAllKeys: (...args: any[]) => (mockGetAllKeys as any)(...args),
    multiRemove: (...args: any[]) => (mockMultiRemove as any)(...args),
  },
  setItem: (...args: any[]) => (mockSetItem as any)(...args),
  getItem: (...args: any[]) => (mockGetItem as any)(...args),
  removeItem: (...args: any[]) => (mockRemoveItem as any)(...args),
  getAllKeys: (...args: any[]) => (mockGetAllKeys as any)(...args),
  multiRemove: (...args: any[]) => (mockMultiRemove as any)(...args),
}));

// ──── Helpers ─────────────────────────────────────────────────────────────

/** Build a cache entry that looks like it was saved `ageMs` milliseconds ago. */
function makeEntry(data: any, ageMs: number, version: number = 1) {
  const now = Date.now();
  return {
    data,
    fetchedAt: new Date(now - ageMs).toISOString(),
    fetchedAtMs: now - ageMs,
    version,
  };
}

/**
 * Write an entry directly into the mock store (bypassing save) so we can
 * test load/getDiagnostics with arbitrary TTL states.
 */
function seedEntry(namespace: string, entry: any) {
  STORE.set(`toroloom_cache:${namespace}`, JSON.stringify(entry));
}

function clearStore() {
  STORE.clear();
}

const FIVE_MIN_MS = 5 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  clearStore();
  vi.clearAllMocks();
});

// ====================================================================
// save
// ====================================================================

describe('offlineCache.save', () => {
  it('stores data with correct cache key prefix', async () => {
    await offlineCache.save('portfolio', { value: 100 });
    expect(mockSetItem).toHaveBeenCalledWith(
      'toroloom_cache:portfolio',
      expect.any(String),
    );
  });

  it('stores JSON-serialized CacheEntry', async () => {
    await offlineCache.save('watchlist', ['AAPL', 'GOOG']);
    const raw = STORE.get('toroloom_cache:watchlist');
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    expect(parsed.data).toEqual(['AAPL', 'GOOG']);
    expect(parsed.version).toBe(1);
    expect(parsed.fetchedAt).toBeDefined();
    expect(parsed.fetchedAtMs).toBeGreaterThan(0);
  });

  it('sets version to CURRENT_CACHE_VERSION (1)', async () => {
    await offlineCache.save('portfolio', { x: 1 });
    const parsed = JSON.parse(STORE.get('toroloom_cache:portfolio')!);
    expect(parsed.version).toBe(1);
  });

  it('sets fetchedAtMs close to now', async () => {
    const before = Date.now();
    await offlineCache.save('portfolio', { x: 1 });
    const parsed = JSON.parse(STORE.get('toroloom_cache:portfolio')!);
    expect(parsed.fetchedAtMs).toBeGreaterThanOrEqual(before);
    expect(parsed.fetchedAtMs).toBeLessThanOrEqual(Date.now());
  });

  it('handles complex nested data', async () => {
    const complex = {
      holdings: [{ symbol: 'RELIANCE', qty: 10, price: 2890 }],
      metadata: { lastUpdated: '2026-06-20', source: 'api' },
    };
    await offlineCache.save('portfolio', complex);
    const parsed = JSON.parse(STORE.get('toroloom_cache:portfolio')!);
    expect(parsed.data.holdings[0].symbol).toBe('RELIANCE');
    expect(parsed.data.metadata.source).toBe('api');
  });

  it('handles empty data', async () => {
    await offlineCache.save('empty', {});
    const parsed = JSON.parse(STORE.get('toroloom_cache:empty')!);
    expect(parsed.data).toEqual({});
  });

  it('handles null data', async () => {
    await offlineCache.save('null_data', null);
    const parsed = JSON.parse(STORE.get('toroloom_cache:null_data')!);
    expect(parsed.data).toBeNull();
  });

  it('handles string data', async () => {
    await offlineCache.save('string', 'hello');
    const parsed = JSON.parse(STORE.get('toroloom_cache:string')!);
    expect(parsed.data).toBe('hello');
  });

  it('handles numeric data', async () => {
    await offlineCache.save('number', 42);
    const parsed = JSON.parse(STORE.get('toroloom_cache:number')!);
    expect(parsed.data).toBe(42);
  });

  it('handles boolean data', async () => {
    await offlineCache.save('bool', true);
    const parsed = JSON.parse(STORE.get('toroloom_cache:bool')!);
    expect(parsed.data).toBe(true);
  });

  it('does not throw when AsyncStorage.setItem fails', async () => {
    mockSetItem.mockRejectedValueOnce(new Error('Storage full'));
    await expect(
      offlineCache.save('portfolio', { x: 1 }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when data contains circular references', async () => {
    const circular: any = { self: null };
    circular.self = circular;
    // JSON.stringify will throw — should be caught by the try/catch in save
    // The save method will log a warning and complete without error
    await expect(
      offlineCache.save('circular', circular),
    ).resolves.toBeUndefined();
    // No entry should have been written
    expect(STORE.has('toroloom_cache:circular')).toBe(false);
  });
});

// ====================================================================
// load — default TTL
// ====================================================================

describe('offlineCache.load — default TTL (5 min)', () => {
  it('returns null when no cache entry exists', async () => {
    const result = await offlineCache.load('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null when AsyncStorage returns null', async () => {
    mockGetItem.mockResolvedValueOnce(null);
    const result = await offlineCache.load('test');
    expect(result).toBeNull();
  });

  it('returns fresh data with source: "fresh" when entry is within TTL', async () => {
    seedEntry('portfolio', makeEntry({ value: 100 }, 1000)); // 1 second old
    const result = await offlineCache.load('portfolio');
    expect(result).not.toBeNull();
    expect(result!.source).toBe('fresh');
    expect(result!.data).toEqual({ value: 100 });
  });

  it('returns stale data with source: "stale" when entry is past TTL but within stale window', async () => {
    seedEntry('portfolio', makeEntry({ value: 200 }, FIVE_MIN_MS + 1000)); // ~5 min 1 sec old
    const result = await offlineCache.load('portfolio');
    expect(result).not.toBeNull();
    expect(result!.source).toBe('stale');
    expect(result!.data).toEqual({ value: 200 });
  });

  it('returns null and removes entry when past stale TTL (24h)', async () => {
    seedEntry('portfolio', makeEntry({ value: 300 }, ONE_DAY_MS + 1000)); // ~24h+ old
    const result = await offlineCache.load('portfolio');
    expect(result).toBeNull();
    // Should have been removed from storage
    expect(STORE.has('toroloom_cache:portfolio')).toBe(false);
    expect(mockRemoveItem).toHaveBeenCalledWith('toroloom_cache:portfolio');
  });

  it('returns null for version mismatch and removes entry', async () => {
    seedEntry('portfolio', makeEntry({ value: 400 }, 1000, 0)); // version 0, current is 1
    const result = await offlineCache.load('portfolio');
    expect(result).toBeNull();
    // Should have been removed from storage
    expect(STORE.has('toroloom_cache:portfolio')).toBe(false);
  });

  it('returns null for corrupt JSON and does not throw', async () => {
    STORE.set('toroloom_cache:corrupt', 'not-valid-json{{{');
    const result = await offlineCache.load('corrupt');
    expect(result).toBeNull();
  });

  it('returns null when entry has no version field (old format)', async () => {
    STORE.set('toroloom_cache:old', JSON.stringify({ data: 'old', fetchedAtMs: Date.now() - 1000 }));
    const result = await offlineCache.load('old');
    // version is undefined, which !== 1, so it's discarded
    expect(result).toBeNull();
  });

  it('returns fresh data just inside the TTL boundary', async () => {
    // Use a 50ms margin to avoid flakiness from Date.now() drift
    seedEntry('portfolio', makeEntry({ value: 500 }, FIVE_MIN_MS - 50));
    const result = await offlineCache.load('portfolio');
    expect(result!.source).toBe('fresh');
  });

  it('returns stale data just inside the stale boundary', async () => {
    seedEntry('portfolio', makeEntry({ value: 600 }, ONE_DAY_MS - 50));
    const result = await offlineCache.load('portfolio');
    expect(result!.source).toBe('stale');
  });

  it('returns null just past the stale boundary', async () => {
    seedEntry('portfolio', makeEntry({ value: 700 }, ONE_DAY_MS + 50));
    const result = await offlineCache.load('portfolio');
    expect(result).toBeNull();
  });

  it('discards stale entry when stale TTL is exceeded, even with large data', async () => {
    const largeData = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item_${i}` }));
    seedEntry('large', makeEntry(largeData, ONE_DAY_MS + 5000));
    const result = await offlineCache.load('large');
    expect(result).toBeNull();
    expect(STORE.has('toroloom_cache:large')).toBe(false);
  });
});

// ====================================================================
// load — custom TTL
// ====================================================================

describe('offlineCache.load — custom TTL', () => {
  it('uses custom TTL for freshness check (stale with short TTL)', async () => {
    seedEntry('market', makeEntry({ index: 23000 }, 2000)); // 2 seconds old
    // With default 5-min TTL, this would be fresh. With 1-second TTL, it's stale.
    const result = await offlineCache.load('market', 1000);
    expect(result!.source).toBe('stale');
  });

  it('uses custom TTL for freshness check (fresh with long TTL)', async () => {
    seedEntry('market', makeEntry({ index: 23000 }, 2000)); // 2 seconds old
    // With default 5-min TTL, this is fresh. With 10-min TTL, still fresh.
    const result = await offlineCache.load('market', 10 * 60 * 1000);
    expect(result!.source).toBe('fresh');
  });

  it('data is stale with custom 0ms TTL', async () => {
    seedEntry('market', makeEntry({ index: 23000 }, 1)); // 1ms old
    const result = await offlineCache.load('market', 0);
    expect(result!.source).toBe('stale');
  });

  it('data is fresh with very large custom TTL', async () => {
    seedEntry('market', makeEntry({ index: 23000 }, 60 * 1000)); // 1 min old
    const result = await offlineCache.load('market', 10 * 60 * 1000); // 10 min TTL
    expect(result!.source).toBe('fresh');
  });

  it('stale boundary check still uses the 24h absolute limit regardless of custom TTL', async () => {
    // Even with a 10-minute custom TTL, data older than 24h should be discarded
    seedEntry('market', makeEntry({ index: 23000 }, ONE_DAY_MS + 1000)); // 24h+ old
    const result = await offlineCache.load('market', 10 * 60 * 1000);
    expect(result).toBeNull();
  });
});

// ====================================================================
// remove
// ====================================================================

describe('offlineCache.remove', () => {
  it('removes a specific cache entry', async () => {
    await offlineCache.save('portfolio', { value: 1 });
    expect(STORE.has('toroloom_cache:portfolio')).toBe(true);

    await offlineCache.remove('portfolio');
    expect(STORE.has('toroloom_cache:portfolio')).toBe(false);
    expect(mockRemoveItem).toHaveBeenCalledWith('toroloom_cache:portfolio');
  });

  it('does not throw when removing non-existent entry', async () => {
    await expect(offlineCache.remove('nonexistent')).resolves.toBeUndefined();
  });

  it('does not throw when AsyncStorage.removeItem fails', async () => {
    mockRemoveItem.mockRejectedValueOnce(new Error('Storage error'));
    await expect(offlineCache.remove('test')).resolves.toBeUndefined();
  });

  it('only removes the specified namespace', async () => {
    await offlineCache.save('a', 1);
    await offlineCache.save('b', 2);
    await offlineCache.remove('a');
    expect(STORE.has('toroloom_cache:a')).toBe(false);
    expect(STORE.has('toroloom_cache:b')).toBe(true);
  });
});

// ====================================================================
// clearAll
// ====================================================================

describe('offlineCache.clearAll', () => {
  it('clears all cache-prefixed entries', async () => {
    await offlineCache.save('a', 1);
    await offlineCache.save('b', 2);
    await offlineCache.save('c', 3);
    expect(STORE.size).toBe(3);

    await offlineCache.clearAll();
    expect(STORE.size).toBe(0);
  });

  it('does not throw when cache is already empty', async () => {
    await expect(offlineCache.clearAll()).resolves.toBeUndefined();
  });

  it('preserves non-cache AsyncStorage keys', async () => {
    await offlineCache.save('portfolio', { x: 1 });
    // Non-cache key
    STORE.set('user_token', 'abc123');
    STORE.set('toroloom_subscription', '{"tier":"pro"}');

    await offlineCache.clearAll();

    // Cache entries removed
    expect(STORE.has('toroloom_cache:portfolio')).toBe(false);
    // Non-cache entries preserved
    expect(STORE.get('user_token')).toBe('abc123');
    expect(STORE.get('toroloom_subscription')).toBe('{"tier":"pro"}');
  });

  it('handles many cache entries efficiently', async () => {
    for (let i = 0; i < 100; i++) {
      await offlineCache.save(`namespace_${i}`, i);
    }
    expect(STORE.size).toBe(100);

    await offlineCache.clearAll();
    expect(STORE.size).toBe(0);
  });

  it('does not throw when AsyncStorage.getAllKeys fails', async () => {
    mockGetAllKeys.mockRejectedValueOnce(new Error('Storage error'));
    await expect(offlineCache.clearAll()).resolves.toBeUndefined();
  });

  it('calls multiRemove with correct cache keys', async () => {
    await offlineCache.save('x', 1);
    await offlineCache.save('y', 2);

    await offlineCache.clearAll();

    expect(mockMultiRemove).toHaveBeenCalledWith(
      expect.arrayContaining(['toroloom_cache:x', 'toroloom_cache:y']),
    );
  });
});

// ====================================================================
// getDiagnostics
// ====================================================================

describe('offlineCache.getDiagnostics', () => {
  it('returns empty array when no cache entries exist', async () => {
    const diag = await offlineCache.getDiagnostics();
    expect(diag).toEqual([]);
  });

  it('labels recently saved entries as "fresh"', async () => {
    await offlineCache.save('portfolio', { value: 1 });
    const diag = await offlineCache.getDiagnostics();
    expect(diag).toHaveLength(1);
    expect(diag[0].namespace).toBe('portfolio');
    expect(diag[0].source).toBe('fresh');
    expect(diag[0].age).toMatch(/^\d+s$/); // e.g., "0s" or "1s"
  });

  it('labels entries past TTL as "stale"', async () => {
    // Seed an entry that's 10 minutes old (past 5-min TTL)
    seedEntry('old_data', makeEntry({ value: 2 }, 10 * 60 * 1000));
    const diag = await offlineCache.getDiagnostics();
    expect(diag).toHaveLength(1);
    expect(diag[0].namespace).toBe('old_data');
    expect(diag[0].source).toBe('stale');
    expect(diag[0].age).toMatch(/^\d+m$/);
  });

  it('labels entries past 24h as "expired"', async () => {
    // Seed an entry that's 25 hours old
    seedEntry('expired_data', makeEntry({ value: 3 }, 25 * 60 * 60 * 1000));
    const diag = await offlineCache.getDiagnostics();
    expect(diag).toHaveLength(1);
    expect(diag[0].namespace).toBe('expired_data');
    expect(diag[0].source).toBe('expired');
    expect(diag[0].age).toMatch(/^\d+h$/);
  });

  it('reports age in seconds for entries < 1 minute old', async () => {
    seedEntry('recent', makeEntry({ value: 4 }, 30 * 1000)); // 30 seconds old
    const diag = await offlineCache.getDiagnostics();
    expect(diag[0].age).toBe('30s');
  });

  it('reports age in minutes for entries between 1 min and 1 hour', async () => {
    seedEntry('mid', makeEntry({ value: 5 }, 5 * 60 * 1000)); // 5 minutes old
    const diag = await offlineCache.getDiagnostics();
    expect(diag[0].age).toBe('5m');
  });

  it('reports age in hours for entries past 1 hour', async () => {
    seedEntry('old', makeEntry({ value: 6 }, 3 * 60 * 60 * 1000)); // 3 hours old
    const diag = await offlineCache.getDiagnostics();
    expect(diag[0].age).toBe('3h');
  });

  it('skips corrupt entries and continues with valid ones', async () => {
    seedEntry('valid', makeEntry({ value: 7 }, 1000));
    STORE.set('toroloom_cache:corrupt', 'bad json{{{');
    const diag = await offlineCache.getDiagnostics();
    // Should only contain the valid entry
    expect(diag).toHaveLength(1);
    expect(diag[0].namespace).toBe('valid');
  });

  it('returns diagnostics for multiple entries', async () => {
    seedEntry('fresh_entry', makeEntry({ value: 8 }, 1000));       // ~1s old → fresh
    seedEntry('stale_entry', makeEntry({ value: 9 }, 10 * 60 * 1000)); // 10min old → stale
    seedEntry('expired_entry', makeEntry({ value: 10 }, 25 * 60 * 60 * 1000)); // 25h old → expired

    const diag = await offlineCache.getDiagnostics();
    expect(diag).toHaveLength(3);

    const fresh = diag.find(d => d.namespace === 'fresh_entry');
    const stale = diag.find(d => d.namespace === 'stale_entry');
    const expired = diag.find(d => d.namespace === 'expired_entry');

    expect(fresh?.source).toBe('fresh');
    expect(stale?.source).toBe('stale');
    expect(expired?.source).toBe('expired');
  });

  it('returns cached data objects that can still be read after diagnostics', async () => {
    await offlineCache.save('portfolio', { symbol: 'RELIANCE', price: 2890 });
    await offlineCache.getDiagnostics();
    // After diagnostics, the entry should still be loadable
    const result = await offlineCache.load('portfolio');
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ symbol: 'RELIANCE', price: 2890 });
  });
});

// ====================================================================
// Edge Cases
// ====================================================================

describe('offlineCache — Edge Cases', () => {
  it('namespace collision does not affect other namespaces', async () => {
    await offlineCache.save('abc', { value: 1 });
    await offlineCache.save('abcdef', { value: 2 });
    const result1 = await offlineCache.load('abc');
    const result2 = await offlineCache.load('abcdef');
    expect(result1!.data).toEqual({ value: 1 });
    expect(result2!.data).toEqual({ value: 2 });
  });

  it('special characters in namespace are handled', async () => {
    await offlineCache.save('my-portfolio_123', { value: 42 });
    const result = await offlineCache.load('my-portfolio_123');
    expect(result!.data).toEqual({ value: 42 });
  });

  it('save then immediate load returns fresh data', async () => {
    await offlineCache.save('immediate', { value: 'test' });
    const result = await offlineCache.load('immediate');
    expect(result!.source).toBe('fresh');
    expect(result!.data).toEqual({ value: 'test' });
  });

  it('save, remove, load returns null', async () => {
    await offlineCache.save('temp', { x: 1 });
    await offlineCache.remove('temp');
    const result = await offlineCache.load('temp');
    expect(result).toBeNull();
  });

  it('clearAll after multiple saves allows reloading', async () => {
    await offlineCache.save('a', 1);
    await offlineCache.save('b', 2);
    await offlineCache.clearAll();
    expect(await offlineCache.load('a')).toBeNull();
    expect(await offlineCache.load('b')).toBeNull();

    // Can save again after clear
    await offlineCache.save('a', 3);
    const result = await offlineCache.load('a');
    expect(result!.data).toBe(3);
  });

  it('handles concurrent saves without data loss', async () => {
    await Promise.all([
      offlineCache.save('concurrent_1', { id: 1 }),
      offlineCache.save('concurrent_2', { id: 2 }),
    ]);
    expect(STORE.has('toroloom_cache:concurrent_1')).toBe(true);
    expect(STORE.has('toroloom_cache:concurrent_2')).toBe(true);
  });

  it('load handles getItem returning empty string (not null, not JSON)', async () => {
    STORE.set('toroloom_cache:empty_str', ''); // empty string, not valid JSON
    const result = await offlineCache.load('empty_str');
    // Gets parsed as empty string, JSON.parse('') throws → caught → null
    expect(result).toBeNull();
  });

  it('version 2 entries are discarded (current is 1)', async () => {
    seedEntry('v2', makeEntry({ value: 100 }, 1000, 2));
    const result = await offlineCache.load('v2');
    expect(result).toBeNull();
  });

  it('version -1 entries are discarded', async () => {
    seedEntry('v_neg', makeEntry({ value: 100 }, 1000, -1));
    const result = await offlineCache.load('v_neg');
    expect(result).toBeNull();
  });

  it('save updates existing entry', async () => {
    await offlineCache.save('update_test', { version: 1 });
    await offlineCache.save('update_test', { version: 2 });
    const result = await offlineCache.load('update_test');
    expect(result!.data).toEqual({ version: 2 });
  });

  it('load with different namespace preserves other namespaces', async () => {
    await offlineCache.save('keep', 'preserved');
    await offlineCache.save('discard', 'gone');
    // Load and discard the stale one by making it expired
    seedEntry('discard', makeEntry('gone', ONE_DAY_MS + 1000));
    await offlineCache.load('discard');
    // 'keep' should still be available
    const keepResult = await offlineCache.load('keep');
    expect(keepResult!.data).toBe('preserved');
  });

  it('load returns null from edge of 24h boundary (24h + 1ms = expired)', async () => {
    seedEntry('boundary', makeEntry({ v: 1 }, ONE_DAY_MS));
    // At exactly 24h, the stale window condition is: Date.now() - fetchedAtMs < STALE_TTL_MS
    // If age === 24h exactly, then it's NOT < 24h, so it's expired.
    const result = await offlineCache.load('boundary');
    expect(result).toBeNull();
  });
});
