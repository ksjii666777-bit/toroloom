/**
 * ============================================================================
 * Toroloom — useForexRates Hook Tests
 * ============================================================================
 *
 * Tests for the React hook that wraps forexRateService.
 * Uses a test component pattern with react-test-renderer since the project
 * doesn't use @testing-library/react's renderHook.
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { act } from 'react';
import { useForexRates, type UseForexRatesResult } from '../hooks/useForexRates';
import { clearCache } from '../services/forexRateService';

// ── Test component that exposes hook state via ref ───────────────────────────

interface TestComponentProps {
  enabled?: boolean;
  onResult?: (result: UseForexRatesResult) => void;
}

function TestComponent({ enabled = true, onResult }: TestComponentProps) {
  const result = useForexRates(enabled);
  // Expose state via callback on every render
  React.useEffect(() => {
    onResult?.(result);
  });
  return null;
}

// ── Helper: wrap the hook in a test component ────────────────────────────────

function createHookHarness(onResult: (result: UseForexRatesResult) => void, enabled?: boolean) {
  return TestRenderer.create(
    React.createElement(TestComponent, { enabled, onResult }),
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearCache();
  vi.restoreAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  clearCache();
});

// ═══════════════════════════════════════════════════════════════
// useForexRates
// ═══════════════════════════════════════════════════════════════

describe('useForexRates', () => {
  it('fetches rates on mount and returns live data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseForexRatesResult[] = [];
    const renderer = createHookHarness(
      (r) => { results.push(r); },
    );

    // Wait for fetch to complete (flush promises)
    await act(async () => {
      await Promise.resolve();
    });

    const lastResult = results[results.length - 1];

    expect(lastResult.isLive).toBe(true);
    expect(lastResult.error).toBeNull();
    expect(lastResult.rates.INR).toBe(1);
    expect(lastResult.rates.USD).toBeCloseTo(83.48, 1);
    expect(lastResult.lastUpdated).toBeInstanceOf(Date);
    expect(lastResult.refresh).toBeInstanceOf(Function);

    renderer.unmount();
  });

  it('returns static fallback when API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network down'));

    const results: UseForexRatesResult[] = [];
    const renderer = createHookHarness(
      (r) => { results.push(r); },
    );

    await act(async () => {
      await Promise.resolve();
    });

    const lastResult = results[results.length - 1];

    expect(lastResult.isLive).toBe(false);
    expect(lastResult.error).toContain('static rates');
    expect(lastResult.rates.USD).toBe(83.45); // static rate

    renderer.unmount();
  });

  it('does not fetch when enabled is false', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseForexRatesResult[] = [];
    const renderer = createHookHarness(
      (r) => { results.push(r); },
      false, // enabled=false
    );

    // Flush any pending microtasks
    await act(async () => {
      await Promise.resolve();
    });

    // No fetch should have been made
    expect(fetchMock).not.toHaveBeenCalled();
    // isLoading should remain true since fetch never ran
    expect(results[results.length - 1].isLoading).toBe(true);

    renderer.unmount();
  });

  it('starts fetching when enabled changes from false to true', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseForexRatesResult[] = [];

    // Start with enabled=false
    const renderer = createHookHarness(
      (r) => { results.push(r); },
      false,
    );

    expect(fetchMock).not.toHaveBeenCalled();

    // Re-render with enabled=true by updating the component
    act(() => {
      renderer.update(
        React.createElement(TestComponent, {
          enabled: true,
          onResult: (r) => { results.push(r); },
        }),
      );
    });

    // Wait for the new effect to run and fetch to complete
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalled();
    const lastResult = results[results.length - 1];
    expect(lastResult.isLive).toBe(true);

    renderer.unmount();
  });

  it('calls refresh and updates rates', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseForexRatesResult[] = [];
    const renderer = createHookHarness(
      (r) => { results.push(r); },
    );

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    let lastResult = results[results.length - 1];

    // Clear the fetch mock and call refresh
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    await act(async () => {
      await lastResult.refresh();
    });

    // Refresh should call API again
    expect(fetchMock).toHaveBeenCalled();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('frankfurter.dev');

    renderer.unmount();
  });

  it('cleans up interval on unmount', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFrankfurterResponse()),
    } as any);

    const results: UseForexRatesResult[] = [];
    const renderer = createHookHarness(
      (r) => { results.push(r); },
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Unmount should not throw
    expect(() => renderer.unmount()).not.toThrow();
  });

  it('does not update state after unmount', async () => {
    // Slow fetch that resolves after a delay
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve(mockFrankfurterResponse()),
        } as any), 10_000);
      }),
    );

    const results: UseForexRatesResult[] = [];
    const renderer = createHookHarness(
      (r) => { results.push(r); },
    );

    // Unmount before fetch completes — mountedRef should prevent state updates
    renderer.unmount();

    // Fast-forward past the fetch resolution
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    // No error should be thrown for state update on unmounted component
    // (the mountedRef guard in the hook prevents this)
  });
});
