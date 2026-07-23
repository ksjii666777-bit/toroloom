/**
 * ============================================================================
 * Toroloom — Forex Rate Service Tests
 * ============================================================================
 *
 * Tests for the forex rate fetching, caching, and fallback logic.
 * API calls are mocked via global fetch mock.
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getForexRates,
  refreshRates,
  clearCache,
  getCache,
  getStaticRates,
  fetchLiveRates,
} from '../services/forexRateService';

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockFrankfurterResponse(overrides?: Record<string, number>) {
  return {
    amount: 1,
    base: 'EUR',
    date: '2025-07-23',
    rates: {
      USD: 1.0874,
      INR: 90.78,
      GBP: 0.8432,
      JPY: 168.15,
      SGD: 1.4580,
      CNY: 7.8920,
      HKD: 8.4880,
      THB: 39.8200,
      ...overrides,
    },
  };
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearCache();
  vi.restoreAllMocks();
});

afterEach(() => {
  clearCache();
});

// ═══════════════════════════════════════════════════════════════
// fetchLiveRates
// ═══════════════════════════════════════════════════════════════

describe('fetchLiveRates', () => {
  it('fetches rates from Frankfurter API and returns INR-based rates', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const rates = await fetchLiveRates();

    expect(rates).not.toBeNull();
    expect(rates!.INR).toBe(1);
    // EUR/INR directly from API
    expect(rates!.EUR).toBe(90.78);
    // USD/INR = EUR/INR / EUR/USD = 90.78 / 1.0874 ≈ 83.48
    expect(rates!.USD).toBeCloseTo(83.48, 1);
    // GBP/INR = 90.78 / 0.8432 ≈ 107.66
    expect(rates!.GBP).toBeCloseTo(107.66, 1);
  });

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network failure'));

    const rates = await fetchLiveRates();
    expect(rates).toBeNull();
  });

  it('returns null on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
    } as any);

    const rates = await fetchLiveRates();
    expect(rates).toBeNull();
  });

  it('returns null if INR is missing from API response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse({ INR: undefined } as any)),
    } as any);

    const rates = await fetchLiveRates();
    expect(rates).toBeNull();
  });

  it('falls back to static rate for missing currencies', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse({ HKD: undefined, THB: undefined } as any)),
    } as any);

    const rates = await fetchLiveRates();
    expect(rates).not.toBeNull();
    expect(rates!.HKD).toBe(10.68); // static fallback
    expect(rates!.THB).toBe(2.28);  // static fallback
    // USD should still be derived
    expect(rates!.USD).toBeCloseTo(83.48, 1);
  });

  it('calls the correct Frankfurter API URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    await fetchLiveRates();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('api.frankfurter.dev/v2/latest');
    expect(url).toContain('base=EUR');
    // Should include all tracked currencies except EUR
    expect(url).toContain('INR');
    expect(url).toContain('USD');
    expect(url).toContain('JPY');
  });

  it('returns null when response JSON is malformed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(null),
    } as any);

    const rates = await fetchLiveRates();
    expect(rates).toBeNull();
  });

  it('returns null when rates object is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ amount: 1, base: 'EUR', date: '2025-07-23' }),
    } as any);

    const rates = await fetchLiveRates();
    expect(rates).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// getStaticRates
// ═══════════════════════════════════════════════════════════════

describe('getStaticRates', () => {
  it('returns rates for all tracked currencies', () => {
    const rates = getStaticRates();
    expect(rates.INR).toBe(1);
    expect(rates.USD).toBe(83.45);
    expect(rates.EUR).toBe(90.78);
    expect(rates.GBP).toBe(106.20);
    expect(rates.JPY).toBe(0.54);
    expect(rates.SGD).toBe(61.80);
    expect(rates.CNY).toBe(11.52);
    expect(rates.HKD).toBe(10.68);
    expect(rates.THB).toBe(2.28);
    expect(Object.keys(rates).length).toBe(9);
  });
});

// ═══════════════════════════════════════════════════════════════
// getForexRates (cache-aware)
// ═══════════════════════════════════════════════════════════════

describe('getForexRates', () => {
  it('returns live rates on first call with no cache', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const result = await getForexRates();

    expect(result.isLive).toBe(true);
    expect(result.error).toBeNull();
    expect(result.lastUpdated).toBeInstanceOf(Date);
    expect(result.rates.INR).toBe(1);
    expect(result.rates.USD).toBeCloseTo(83.48, 1);
  });

  it('returns cached rates within TTL without calling API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    // First call populates cache
    await getForexRates();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call should use cache
    fetchMock.mockClear();
    const result = await getForexRates();
    expect(result.isLive).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled(); // No network call
  });

  it('falls back to static rates when API fails and no cache exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network down'));

    const result = await getForexRates();

    expect(result.isLive).toBe(false);
    expect(result.error).toContain('static rates');
    expect(result.lastUpdated).toBeNull();
    // Should return static rates
    expect(result.rates.USD).toBe(83.45);
  });

  it('uses stale cache immediately while refreshing in background', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    // First call populates cache
    await getForexRates();

    // Manipulate cache timestamp to make it stale
    const cache = getCache()!;
    const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 min ago
    (cache as any).timestamp = oldTimestamp;

    // Second call should return stale cache immediately
    fetchMock.mockClear(); // Clear first call history
    const result = await getForexRates();

    expect(result.isLive).toBe(true);
    expect(result.lastUpdated!.getTime()).toBe(oldTimestamp);

    // Allow background fetch to complete
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// refreshRates
// ═══════════════════════════════════════════════════════════════

describe('refreshRates', () => {
  it('force-fetches fresh rates bypassing cache', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    await getForexRates();
    fetchMock.mockClear();

    // Refresh should call API again
    await refreshRates();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to existing cache when API fails on refresh', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFrankfurterResponse()),
      } as any)
      .mockRejectedValueOnce(new Error('Network down'));

    // First call populates cache
    await getForexRates();

    // Refresh fails
    const result = await refreshRates();
    expect(result.isLive).toBe(true);
    expect(result.rates.USD).toBeCloseTo(83.48, 1);
  });

  it('falls back to static rates when no cache and API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network down'));

    const result = await refreshRates();
    expect(result.isLive).toBe(false);
    expect(result.rates.USD).toBe(83.45);
  });
});

// ═══════════════════════════════════════════════════════════════
// Cache lifecycle
// ═══════════════════════════════════════════════════════════════

describe('cache lifecycle', () => {
  it('clearCache empties the cache', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    await getForexRates();
    expect(getCache()).not.toBeNull();

    clearCache();
    expect(getCache()).toBeNull();
  });
});
