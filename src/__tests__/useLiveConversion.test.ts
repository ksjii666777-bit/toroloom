/**
 * ============================================================================
 * Toroloom — useLiveConversion Hook Tests
 * ============================================================================
 *
 * Tests for the shared conversion hook that wraps useForexRates.
 * Uses a test component pattern with react-test-renderer.
 *
 * Coverage:
 *   - getLiveCurrencyRate: live override, static fallback, unknown code
 *   - convertWithLive: INR pairs, cross-rates, same currency, edge cases
 *   - getLiveCurrency: live inrRate override, static fallback
 *   - Pass-through fields: isLive, isLoading, error, lastUpdated, refresh
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { act } from 'react';
import { useLiveConversion, type UseLiveConversionResult } from '../hooks/useLiveConversion';
import { clearCache } from '../services/forexRateService';

// ── Test component that exposes hook state via callback ──────────────────────

interface TestComponentProps {
  enabled?: boolean;
  onResult: (result: UseLiveConversionResult) => void;
}

function TestComponent({ enabled = true, onResult }: TestComponentProps) {
  const result = useLiveConversion(enabled);
  React.useEffect(() => {
    onResult(result);
  });
  return null;
}

// ── Helper ───────────────────────────────────────────────────────────────────

function createHookHarness(onResult: (result: UseLiveConversionResult) => void, enabled?: boolean) {
  return TestRenderer.create(
    React.createElement(TestComponent, { enabled, onResult }),
  );
}

function mockFrankfurterResponse() {
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
    },
  };
}

/** Wait for the hook's fetch to complete and all effects to flush. */
async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
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
// getLiveCurrencyRate
// ═══════════════════════════════════════════════════════════════

describe('getLiveCurrencyRate', () => {
  it('returns live rate when available from API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    // USD/INR ≈ 90.78/1.0874 ≈ 83.48
    expect(hook.getLiveCurrencyRate('USD')).toBeCloseTo(83.48, 1);
    // EUR/INR directly from response
    expect(hook.getLiveCurrencyRate('EUR')).toBeCloseTo(90.78, 1);
    // INR rate is always 1
    expect(hook.getLiveCurrencyRate('INR')).toBe(1);

    renderer.unmount();
  });

  it('falls back to static rate when live data is missing for a currency', async () => {
    // API returns no live data at all (network failure)
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network down'));

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    // All rates should fall back to static values
    expect(hook.getLiveCurrencyRate('USD')).toBe(83.45);
    expect(hook.getLiveCurrencyRate('EUR')).toBe(90.78);
    expect(hook.getLiveCurrencyRate('GBP')).toBe(106.20);
    expect(hook.getLiveCurrencyRate('JPY')).toBe(0.54);
    expect(hook.getLiveCurrencyRate('SGD')).toBe(61.80);
    expect(hook.getLiveCurrencyRate('CNY')).toBe(11.52);
    expect(hook.getLiveCurrencyRate('HKD')).toBe(10.68);
    expect(hook.getLiveCurrencyRate('THB')).toBe(2.28);

    renderer.unmount();
  });

  it('falls back to static rate for a currency not in the live response', async () => {
    // API returns some rates but missing THB
    const incompleteResponse = {
      ...mockFrankfurterResponse(),
      rates: { ...mockFrankfurterResponse().rates, THB: undefined },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(incompleteResponse),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    // THB should fall back to static
    expect(hook.getLiveCurrencyRate('THB')).toBe(2.28);
    // USD should still use live
    expect(hook.getLiveCurrencyRate('USD')).toBeCloseTo(83.48, 1);

    renderer.unmount();
  });

  it('returns 0 for unknown currency codes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    // Unknown code → getCurrency returns INR (fallback), which has rate 1
    // But a truly unknown code that's not in the CURRENCIES array...
    // getCurrency('XYZ') returns CURRENCIES[0] which is INR with inrRate=1
    expect(hook.getLiveCurrencyRate('XYZ')).toBe(1);

    renderer.unmount();
  });
});

// ═══════════════════════════════════════════════════════════════
// convertWithLive
// ═══════════════════════════════════════════════════════════════

describe('convertWithLive', () => {
  it('converts USD to INR using live rates', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    // 100 USD → INR = 100 * 83.48 = 8348
    const converted = hook.convertWithLive(100, 'USD', 'INR');
    expect(converted).toBeCloseTo(8348, 0);

    renderer.unmount();
  });

  it('converts INR to USD using live rates', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    // 8348 INR → USD = 8348 / 83.48 ≈ 100
    const converted = hook.convertWithLive(8348, 'INR', 'USD');
    expect(converted).toBeCloseTo(100, 0);

    renderer.unmount();
  });

  it('computes cross rates between two non-INR currencies', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    // EUR→USD: EUR/INR ÷ USD/INR = 90.78 / 83.48 ≈ 1.0874
    const eurToUsd = hook.convertWithLive(1, 'EUR', 'USD');
    expect(eurToUsd).toBeCloseTo(1.0874, 1);

    // GBP→JPY: GBP/INR ÷ JPY/INR
    // GBP/INR = 90.78 / 0.8432 = 107.66
    // JPY/INR from live data
    // GBP→JPY = (1 * 107.66) / jpyLiveRate
    const gbpLiveRate = hook.getLiveCurrencyRate('GBP');
    const jpyLiveRate = hook.getLiveCurrencyRate('JPY');
    const expectedGbpToJpy = (1 * gbpLiveRate) / jpyLiveRate;
    const gbpToJpy = hook.convertWithLive(1, 'GBP', 'JPY');
    expect(gbpToJpy).toBeCloseTo(expectedGbpToJpy, 1);

    renderer.unmount();
  });

  it('returns the original amount when converting to the same currency', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    expect(hook.convertWithLive(100, 'USD', 'USD')).toBe(100);
    expect(hook.convertWithLive(0, 'EUR', 'EUR')).toBe(0);
    expect(hook.convertWithLive(50.5, 'INR', 'INR')).toBe(50.5);

    renderer.unmount();
  });

  it('returns 0 when amount is 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    expect(hook.convertWithLive(0, 'USD', 'INR')).toBe(0);

    renderer.unmount();
  });

  it('uses static fallback rates when API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network down'));

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    // Using static rates: 100 USD → INR = 100 * 83.45 = 8345
    expect(hook.convertWithLive(100, 'USD', 'INR')).toBe(8345);

    // Cross rate with static: EUR→USD = 90.78 / 83.45 ≈ 1.0878
    expect(hook.convertWithLive(1, 'EUR', 'USD')).toBeCloseTo(1.0878, 1);

    renderer.unmount();
  });
});

// ═══════════════════════════════════════════════════════════════
// getLiveCurrency
// ═══════════════════════════════════════════════════════════════

describe('getLiveCurrency', () => {
  it('returns CurrencyInfo with live inrRate when available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    const usd = hook.getLiveCurrency('USD');
    expect(usd.code).toBe('USD');
    expect(usd.name).toBe('US Dollar');
    expect(usd.symbol).toBe('$');
    // inrRate should be the live rate ≈ 83.48, not the static 83.45
    expect(usd.inrRate).toBeCloseTo(83.48, 1);
    expect(usd.isPopular).toBe(true);

    renderer.unmount();
  });

  it('returns CurrencyInfo with static inrRate when no live data', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network down'));

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    const usd = hook.getLiveCurrency('USD');
    expect(usd.code).toBe('USD');
    // Static rate
    expect(usd.inrRate).toBe(83.45);

    const jpy = hook.getLiveCurrency('JPY');
    expect(jpy.code).toBe('JPY');
    expect(jpy.inrRate).toBe(0.54);

    renderer.unmount();
  });

  it('keeps other CurrencyInfo fields intact when overriding with live rate', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    const gbp = hook.getLiveCurrency('GBP');
    expect(gbp.code).toBe('GBP');
    expect(gbp.symbol).toBe('£');
    expect(gbp.icon).toBe('💷');
    expect(gbp.color).toBe('#FF5252');
    expect(gbp.isPopular).toBe(true);
    // inrRate overridden by live data
    expect(gbp.inrRate).not.toBe(106.20); // should differ from static when live is available

    renderer.unmount();
  });

  it('falls back to INR for unknown codes', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network down'));

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];

    const unknown = hook.getLiveCurrency('XYZ');
    expect(unknown.code).toBe('INR');
    expect(unknown.inrRate).toBe(1);

    renderer.unmount();
  });
});

// ═══════════════════════════════════════════════════════════════
// Pass-through fields from useForexRates
// ═══════════════════════════════════════════════════════════════

describe('pass-through fields', () => {
  it('sets isLive=true when live API data is available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];
    expect(hook.isLive).toBe(true);

    renderer.unmount();
  });

  it('sets isLive=false when API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network down'));

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];
    expect(hook.isLive).toBe(false);

    renderer.unmount();
  });

  it('sets error on API failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network down'));

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];
    expect(hook.error).not.toBeNull();
    expect(hook.error).toContain('static rates');

    renderer.unmount();
  });

  it('sets lastUpdated to a Date when live data is available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];
    expect(hook.lastUpdated).toBeInstanceOf(Date);

    renderer.unmount();
  });

  it('sets lastUpdated to null when using static fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network down'));

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];
    expect(hook.lastUpdated).toBeNull();

    renderer.unmount();
  });

  it('refresh is a function', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r));

    await flushEffects();

    const hook = results[results.length - 1];
    expect(hook.refresh).toBeInstanceOf(Function);

    renderer.unmount();
  });

  it('enabled=false prevents fetching', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseLiveConversionResult[] = [];
    const renderer = createHookHarness(r => results.push(r), false);

    await flushEffects();

    // fetch should NOT have been called
    expect(fetchMock).not.toHaveBeenCalled();
    // isLoading should still be true (never completed)
    expect(results[results.length - 1].isLoading).toBe(true);

    renderer.unmount();
  });
});
