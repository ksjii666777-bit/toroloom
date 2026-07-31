/**
 * ============================================================================
 * Toroloom — useForexRates WebSocket Tests
 * ============================================================================
 *
 * Verifies the WS-first forex pipeline:
 *   - Subscribes to all 8 INR forex pairs on mount
 *   - Live WS ticks update the code → INR-rate map in real time
 *   - isLive / lastUpdated / error are driven by ticks
 *   - Unsubscribes on unmount
 *   - REST baseline still fetched when enabled (fallback)
 *
 * Pattern: follows useRealtimePrice.test.tsx (controllable hoisted WS mock).
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { useForexRates, type UseForexRatesResult } from '../hooks/useForexRates';
import { clearCache } from '../services/forexRateService';

// ── Hoisted: Controllable WebSocket mock ──────────────────────
const { mockWS, mockWsCallbacks } = vi.hoisted(() => {
  const priceCbs = new Map<string, (d: any) => void>();
  let connectionCb: ((c: boolean) => void) | null = null;

  return {
    mockWS: {
      connect: vi.fn(() => Promise.resolve()),
      disconnect: vi.fn(),
      subscribe: vi.fn((symbol: string, onPrice: any) => {
        priceCbs.set(symbol, onPrice);
      }),
      unsubscribe: vi.fn((symbol: string) => {
        priceCbs.delete(symbol);
      }),
      onConnectionChangeCallback: vi.fn((cb: (c: boolean) => void) => {
        connectionCb = cb;
      }),
      getCurrentPrice: vi.fn(() => 83.45),
      getIsAuthenticated: vi.fn(() => true),
    },
    mockWsCallbacks: {
      triggerConnection: (c: boolean) => connectionCb?.(c),
      triggerTick: (symbol: string, d: any) => priceCbs.get(symbol)?.(d),
    },
  };
});

// Override the global wsRegistry mock with our controllable mock.
vi.mock('../services/wsRegistry', () => ({
  getActiveWS: vi.fn(() => mockWS),
}));

// ── Test Harness ───────────────────────────────────────────────
let harnessResult: UseForexRatesResult;

function Harness({ enabled = true }: { enabled?: boolean }) {
  harnessResult = useForexRates(enabled);
  return null;
}

// ── Helpers ────────────────────────────────────────────────────
function renderHarness(enabled = true) {
  return TestRenderer.create(React.createElement(Harness, { enabled }));
}

async function flushMicrotasks() {
  await act(async () => {});
}

// ── Tests ──────────────────────────────────────────────────────

describe('useForexRates — WebSocket Subscription', () => {
  beforeEach(() => {
    clearCache();
    vi.clearAllMocks(); // clear hoisted mockWS call history (restoreAllMocks does NOT do this)
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('REST offline — testing WS path'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCache();
  });

  it('subscribes to all 8 INR forex pairs on mount', async () => {
    renderHarness();
    await flushMicrotasks();

    const subscribedSymbols = vi.mocked(mockWS.subscribe).mock.calls.map(c => c[0]);
    expect(subscribedSymbols).toEqual(
      expect.arrayContaining(['USDINR', 'EURINR', 'GBPINR', 'JPYINR', 'SGDINR', 'CNYINR', 'HKDINR', 'THBINR']),
    );
  });

  it('connects to the WebSocket when enabled', async () => {
    renderHarness();
    await flushMicrotasks();
    expect(mockWS.connect).toHaveBeenCalled();
  });

  it('does NOT subscribe when enabled=false', async () => {
    renderHarness(false);
    await flushMicrotasks();
    expect(mockWS.subscribe).not.toHaveBeenCalled();
  });

  it('updates USD rate from a USDINR tick', async () => {
    renderHarness();
    await flushMicrotasks();

    act(() => {
      mockWsCallbacks.triggerTick('USDINR', {
        stockId: 'USDINR',
        price: 84.12,
        change: 0.67,
        changePercent: 0.80,
        timestamp: '2025-05-24T10:00:00Z',
      });
    });

    expect(harnessResult.rates.USD).toBe(84.12);
    expect(harnessResult.isLive).toBe(true);
    expect(harnessResult.lastUpdated?.toISOString()).toBe('2025-05-24T10:00:00.000Z');
  });

  it('updates multiple currency rates from separate ticks', async () => {
    renderHarness();
    await flushMicrotasks();

    act(() => {
      mockWsCallbacks.triggerTick('USDINR', { stockId: 'USDINR', price: 84.12, timestamp: '2025-05-24T10:00:00Z' });
      mockWsCallbacks.triggerTick('EURINR', { stockId: 'EURINR', price: 91.50, timestamp: '2025-05-24T10:00:01Z' });
      mockWsCallbacks.triggerTick('JPYINR', { stockId: 'JPYINR', price: 0.55, timestamp: '2025-05-24T10:00:02Z' });
    });

    expect(harnessResult.rates.USD).toBe(84.12);
    expect(harnessResult.rates.EUR).toBe(91.50);
    expect(harnessResult.rates.JPY).toBe(0.55);
  });

  it('marks isLive true when connection opens even before ticks', async () => {
    renderHarness();
    await flushMicrotasks();

    act(() => {
      mockWsCallbacks.triggerConnection(true);
    });

    expect(harnessResult.isLive).toBe(true);
  });

  it('unsubscribes from all symbols on unmount', async () => {
    const renderer = renderHarness();
    await flushMicrotasks();

    act(() => {
      renderer.unmount();
    });

    const unsubscribedSymbols = vi.mocked(mockWS.unsubscribe).mock.calls.map(c => c[0]);
    expect(unsubscribedSymbols).toEqual(
      expect.arrayContaining(['USDINR', 'EURINR', 'GBPINR', 'JPYINR', 'SGDINR', 'CNYINR', 'HKDINR', 'THBINR']),
    );
  });

  it('does not crash when a tick arrives for an unmapped symbol', async () => {
    renderHarness();
    await flushMicrotasks();

    expect(() => {
      act(() => {
        mockWsCallbacks.triggerTick('EURUSD', { stockId: 'EURUSD', price: 1.09, timestamp: '2025-05-24T10:00:00Z' });
      });
    }).not.toThrow();
  });
});
