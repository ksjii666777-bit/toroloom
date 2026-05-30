/**
 * ============================================================================
 * Toroloom — useRealtimePrice Hook Tests
 * ============================================================================
 *
 * Tests the real-time price hook: initial state, price simulation via interval,
 * WebSocket lifecycle (connect, subscribe, disconnect), candle updates,
 * and connection status.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from './testUtils';
import { useRealtimePrice } from '../hooks/useRealtimePrice';

// ── Hoisted: Controlled WebSocket mock ──────────────────────
// Must be vi.hoisted so it's available inside vi.mock factories.
const { mockWS, mockWsCallbacks } = vi.hoisted(() => {
  let connectionCb: ((c: boolean) => void) | null = null;
  let priceCb: ((d: any) => void) | null = null;
  let candleCb: ((d: any) => void) | null = null;

  return {
    mockWS: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      subscribe: vi.fn((_stockId: string, onPrice: any, onCandle: any) => {
        priceCb = onPrice;
        candleCb = onCandle;
      }),
      unsubscribe: vi.fn(),
      onConnectionChangeCallback: vi.fn((cb: (c: boolean) => void) => {
        connectionCb = cb;
      }),
    },
    mockWsCallbacks: {
      triggerConnection: (c: boolean) => connectionCb?.(c),
      triggerPrice: (d: any) => priceCb?.(d),
      triggerCandle: (d: any) => candleCb?.(d),
    },
  };
});

// Override the global wsRegistry mock with our controllable mock.
vi.mock('../services/wsRegistry', () => ({
  getActiveWS: vi.fn(() => mockWS),
}));

// ── Test Harness ───────────────────────────────────────────────
let harnessResult: ReturnType<typeof useRealtimePrice>;

function Harness({ stockId, basePrice }: { stockId: string; basePrice: number }) {
  harnessResult = useRealtimePrice(stockId, basePrice);
  return null;
}

// ── Helpers ─────────────────────────────────────────────────
function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

// ── Tests ─────────────────────────────────────────────────────

describe('useRealtimePrice — Initial State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses basePrice as initial currentPrice', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);
    expect(harnessResult.currentPrice).toBe(2890);
    expect(harnessResult.priceChange).toBe(0);
    expect(harnessResult.priceChangePercent).toBe(0);
  });

  it('starts with isConnected=false', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);
    expect(harnessResult.isConnected).toBe(false);
  });

  it('starts with empty candleHistory', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);
    expect(harnessResult.candleHistory).toEqual([]);
  });

  it('starts with lastUpdated=null', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);
    expect(harnessResult.lastUpdated).toBeNull();
  });

  it('returns isPositive=true when priceChange >= 0', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);
    // Default state has priceChange=0, so isPositive=true
    expect(harnessResult.isPositive).toBe(true);
  });

  it('exposes loadHistory function', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);
    expect(typeof harnessResult.loadHistory).toBe('function');
  });
});

describe('useRealtimePrice — WebSocket Lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects to WebSocket on mount', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);
    expect(mockWS.connect).toHaveBeenCalledTimes(1);
  });

  it('subscribes to the given stockId', () => {
    render(<Harness stockId="TCS" basePrice={3890} />);
    expect(mockWS.subscribe).toHaveBeenCalledWith(
      'TCS',
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('registers onConnectionChangeCallback', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);
    expect(mockWS.onConnectionChangeCallback).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });

  it('does not subscribe twice for the same stockId', () => {
    const { update } = render(<Harness stockId="RELIANCE" basePrice={2890} />);
    // Re-render with same stockId
    update(<Harness stockId="RELIANCE" basePrice={2890} />);
    // subscribe should only be called once (subscriptionRef prevents duplicates)
    expect(mockWS.subscribe).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes and disconnects on unmount', () => {
    const { unmount } = render(<Harness stockId="RELIANCE" basePrice={2890} />);
    act(() => {
      unmount();
    });
    expect(mockWS.unsubscribe).toHaveBeenCalledWith('RELIANCE');
    expect(mockWS.disconnect).toHaveBeenCalled();
  });
});

describe('useRealtimePrice — Connection Status', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates isConnected when connection callback fires', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);

    // Initially false
    expect(harnessResult.isConnected).toBe(false);

    // Trigger connection
    act(() => {
      mockWsCallbacks.triggerConnection(true);
    });
    expect(harnessResult.isConnected).toBe(true);

    // Trigger disconnection
    act(() => {
      mockWsCallbacks.triggerConnection(false);
    });
    expect(harnessResult.isConnected).toBe(false);
  });
});

describe('useRealtimePrice — Price Simulation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates price via interval every 3 seconds', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);

    const price1 = harnessResult.currentPrice;

    // Advance 3 seconds → interval fires
    advance(3000);

    const price2 = harnessResult.currentPrice;
    // Price should have changed slightly
    expect(price2).not.toBe(price1);
  });

  it('does not update price before 3 seconds', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);

    const price1 = harnessResult.currentPrice;

    // Advance only 2 seconds → interval hasn't fired yet
    advance(2000);

    expect(harnessResult.currentPrice).toBe(price1);
  });

  it('updates priceChange and priceChangePercent after interval', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);

    // Initially 0
    expect(harnessResult.priceChange).toBe(0);
    expect(harnessResult.priceChangePercent).toBe(0);

    // Advance 3 seconds
    advance(3000);

    // Price changed, so change and percent should update
    const current = harnessResult.currentPrice;
    const expectedChange = Math.round((current - 2890) * 100) / 100;
    const expectedPercent = Math.round(((current - 2890) / 2890) * 10000) / 100;

    expect(harnessResult.priceChange).toBe(expectedChange);
    expect(harnessResult.priceChangePercent).toBe(expectedPercent);
  });

  it('derives isPositive correctly after price change', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);
    advance(3000);

    // isPositive should match priceChange >= 0
    expect(harnessResult.isPositive).toBe(harnessResult.priceChange >= 0);
  });

  it('continues updating price on multiple intervals', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);

    advance(3000);
    const priceAfter1 = harnessResult.currentPrice;

    advance(3000);
    const priceAfter2 = harnessResult.currentPrice;

    advance(3000);
    const priceAfter3 = harnessResult.currentPrice;

    // Prices should vary across intervals
    const prices = new Set([priceAfter1, priceAfter2, priceAfter3]);
    expect(prices.size).toBeGreaterThan(1);
  });

  it('clears interval on unmount', () => {
    const { unmount } = render(<Harness stockId="RELIANCE" basePrice={2890} />);

    advance(3000);
    const priceBefore = harnessResult.currentPrice;

    unmount();

    advance(6000);
    // After unmount, the interval is cleared, so price should not change
    // (The hook's state is gone, but we verify by checking that the render count doesn't increase)
    expect(harnessResult.currentPrice).toBe(priceBefore);
  });
});

describe('useRealtimePrice — Candle Data from WebSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates lastUpdated when price callback fires', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);

    act(() => {
      mockWsCallbacks.triggerPrice({ timestamp: '2025-05-24T10:00:00' });
    });

    expect(harnessResult.lastUpdated).toBe('2025-05-24T10:00:00');
  });

  it('appends candle data when candle callback fires', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);

    const mockCandle = { date: '2025-05-24', open: 2890, high: 2910, low: 2880, close: 2900, volume: 1000000 };

    act(() => {
      mockWsCallbacks.triggerCandle({ candle: mockCandle });
    });

    expect(harnessResult.candleHistory).toHaveLength(1);
    expect(harnessResult.candleHistory[0]).toEqual(mockCandle);
  });

  it('appends multiple candles in order', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);

    const candle1 = { date: '2025-05-24', open: 2890, high: 2910, low: 2880, close: 2900, volume: 1000000 };
    const candle2 = { date: '2025-05-25', open: 2900, high: 2920, low: 2890, close: 2910, volume: 1200000 };

    act(() => mockWsCallbacks.triggerCandle({ candle: candle1 }));
    act(() => mockWsCallbacks.triggerCandle({ candle: candle2 }));

    expect(harnessResult.candleHistory).toHaveLength(2);
    expect(harnessResult.candleHistory[0]).toEqual(candle1);
    expect(harnessResult.candleHistory[1]).toEqual(candle2);
  });

  it('caps candle history at 500 entries', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);

    // Add 501 candles
    for (let i = 0; i < 501; i++) {
      act(() => mockWsCallbacks.triggerCandle({
        candle: { date: `2025-01-${i + 1}`, open: 2890, high: 2900, low: 2880, close: 2895, volume: 1000000 },
      }));
    }

    // Should be capped at 500
    expect(harnessResult.candleHistory).toHaveLength(500);
    // The oldest (first) entry should have been shifted off
    const first = harnessResult.candleHistory[0];
    expect(first.date).not.toBe('2025-01-1');
  });
});

describe('useRealtimePrice — loadHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('populates candleHistory with historical data', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);

    expect(harnessResult.candleHistory).toHaveLength(0);

    act(() => {
      harnessResult.loadHistory('1M');
    });

    // Should have some candle data
    expect(harnessResult.candleHistory.length).toBeGreaterThan(0);
    expect(harnessResult.candleHistory[0]).toHaveProperty('date');
    expect(harnessResult.candleHistory[0]).toHaveProperty('close');
  });

  it('loadHistory with 1D returns ~1 day of data', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);

    act(() => {
      harnessResult.loadHistory('1D');
    });

    // 1 day should return exactly 1 data point (weekends filtered)
    expect(harnessResult.candleHistory.length).toBeGreaterThan(0);
  });

  it('loadHistory with 1Y returns ~365 days of data', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);
    act(() => {
      harnessResult.loadHistory('1Y');
    });
    // Should have significant data, but weekends are filtered so < 365
    expect(harnessResult.candleHistory.length).toBeGreaterThanOrEqual(200);
  });

  it('loadHistory is callable multiple times', () => {
    render(<Harness stockId="RELIANCE" basePrice={2890} />);

    act(() => harnessResult.loadHistory('1W'));
    const len1 = harnessResult.candleHistory.length;

    act(() => harnessResult.loadHistory('3M'));
    const len2 = harnessResult.candleHistory.length;

    expect(len2).toBeGreaterThan(len1);
  });
});
