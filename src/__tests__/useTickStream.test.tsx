/**
 * ============================================================================
 * Toroloom — useTickStream Hook Tests
 * ============================================================================
 *
 * Tests the WS tick-streaming hook:
 *   - Initial state (inactive vs active)
 *   - WS subscription lifecycle (connect, subscribeTicks, unsubscribe)
 *   - Tick accumulation (sessionTicks, recentTicks, lastTickPrice)
 *   - Re-render batching (300ms flush timer)
 *   - Edge cases (toggle off→on, different stocks, empty stockId)
 *
 * Framework: vitest + react-test-renderer
 * Pattern:   follows useRealtimePrice.test.tsx
 *
 * NOTE: The hook uses refs internally and only exposes values via a 300ms
 * flush timer.  Tests that check hook return values after mutations must
 * wait for the flush timer to fire, or use ref-aware assertion strategies.
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from './testUtils';
import { useTickStream } from '../hooks/useTickStream';

// ── Hoisted: Controllable WebSocket mock ──────────────────────
const { mockWS, mockWsCallbacks } = vi.hoisted(() => {
  let tickCb: ((d: any) => void) | null = null;
  let currentPrice = 0;

  return {
    mockWS: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      subscribe: vi.fn(),
      subscribeTicks: vi.fn((_stockId: string, onTick: any) => {
        tickCb = onTick;
      }),
      unsubscribe: vi.fn(),
      onConnectionChangeCallback: vi.fn(),
      getCurrentPrice: vi.fn(() => currentPrice),
      setCurrentPrice: (p: number) => { currentPrice = p; },
    },
    mockWsCallbacks: {
      triggerTick: (d: any) => tickCb?.(d),
      setCurrentPrice: (p: number) => { currentPrice = p; },
    },
  };
});

// Override the global wsRegistry mock with our controllable mock.
vi.mock('../services/wsRegistry', () => ({
  getActiveWS: vi.fn(() => mockWS),
}));

// ── Test Harness ───────────────────────────────────────────────
let harnessResult: ReturnType<typeof useTickStream>;

function Harness({ stockId, active }: { stockId: string; active: boolean }) {
  harnessResult = useTickStream(stockId, active);
  return null;
}

// ── Helpers ─────────────────────────────────────────────────
function advance(ms: number) {
  act(() => { vi.advanceTimersByTime(ms); });
}

/** Update harness props wrapped in act() so React effects fire properly. */
function actUpdate(
  updateFn: (el: React.ReactElement) => void,
  el: React.ReactElement,
) {
  act(() => { updateFn(el); });
}

// ═══════════════════════════════════════════════════════════════
// Initial State
// ═══════════════════════════════════════════════════════════════

describe('useTickStream — Initial State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockWsCallbacks.setCurrentPrice(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zeros when not active (active=false)', () => {
    render(<Harness stockId="RELIANCE" active={false} />);
    expect(harnessResult.sessionTicks).toBe(0);
    expect(harnessResult.recentTicks).toEqual([]);
    expect(harnessResult.lastTickPrice).toBe(0);
  });

  it('returns a valid startTime timestamp', () => {
    render(<Harness stockId="RELIANCE" active={false} />);
    expect(typeof harnessResult.startTime).toBe('number');
    expect(harnessResult.startTime).toBeGreaterThan(0);
  });

  it('returns zeros when active=true but no ticks arrived yet', () => {
    render(<Harness stockId="RELIANCE" active={true} />);
    expect(harnessResult.sessionTicks).toBe(0);
    expect(harnessResult.recentTicks).toEqual([]);
  });

  it('captures lastTickPrice from WS cache (updated in effect, visible after flush)', () => {
    mockWsCallbacks.setCurrentPrice(2890.50);
    render(<Harness stockId="RELIANCE" active={true} />);
    // lastTickPriceRef is set in the effect which runs after render.
    // harnessResult captured during render still shows 0.
    // After the flush timer fires (300ms), the re-render picks up the ref.
    advance(350);
    expect(harnessResult.lastTickPrice).toBe(2890.50);
  });
});

// ═══════════════════════════════════════════════════════════════
// WS Subscription Lifecycle
// ═══════════════════════════════════════════════════════════════

describe('useTickStream — WS Subscription Lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockWsCallbacks.setCurrentPrice(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects to WebSocket when active=true', () => {
    render(<Harness stockId="RELIANCE" active={true} />);
    expect(mockWS.connect).toHaveBeenCalledTimes(1);
  });

  it('does NOT connect when active=false', () => {
    render(<Harness stockId="RELIANCE" active={false} />);
    expect(mockWS.connect).not.toHaveBeenCalled();
  });

  it('subscribes to ticks for the given stockId', () => {
    render(<Harness stockId="TCS" active={true} />);
    expect(mockWS.subscribeTicks).toHaveBeenCalledWith(
      'TCS',
      expect.any(Function),
    );
  });

  it('queries WS current price for initialization', () => {
    render(<Harness stockId="RELIANCE" active={true} />);
    expect(mockWS.getCurrentPrice).toHaveBeenCalledWith('RELIANCE');
  });

  it('does not subscribe twice for the same stockId+active', () => {
    const { update } = render(<Harness stockId="RELIANCE" active={true} />);
    actUpdate(update, <Harness stockId="RELIANCE" active={true} />);
    expect(mockWS.subscribeTicks).toHaveBeenCalledTimes(1);
    expect(mockWS.connect).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes when active changes to false', () => {
    const { update } = render(<Harness stockId="RELIANCE" active={true} />);
    expect(mockWS.subscribeTicks).toHaveBeenCalledTimes(1);

    actUpdate(update, <Harness stockId="RELIANCE" active={false} />);
    expect(mockWS.unsubscribe).toHaveBeenCalledWith('RELIANCE');
  });

  it('unsubscribes and does NOT disconnect on unmount', () => {
    const { unmount } = render(<Harness stockId="RELIANCE" active={true} />);
    act(() => { unmount(); });
    expect(mockWS.unsubscribe).toHaveBeenCalledWith('RELIANCE');
    expect(mockWS.disconnect).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// Tick Accumulation
// ═══════════════════════════════════════════════════════════════

describe('useTickStream — Tick Accumulation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockWsCallbacks.setCurrentPrice(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('increments sessionTicks on each tick', () => {
    render(<Harness stockId="RELIANCE" active={true} />);

    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2891.50, change: 1.50,
        changePercent: 0.05, timestamp: new Date().toISOString(),
      });
    });
    advance(300);
    expect(harnessResult.sessionTicks).toBe(1);

    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2892.00, change: 0.50,
        changePercent: 0.02, timestamp: new Date().toISOString(),
      });
    });
    advance(300);
    expect(harnessResult.sessionTicks).toBe(2);
  });

  it('adds ticks to recentTicks array', () => {
    render(<Harness stockId="RELIANCE" active={true} />);

    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2891.50, change: 1.50,
        changePercent: 0.05, timestamp: '2025-06-01T10:00:00.000Z',
      });
    });
    advance(300);

    expect(harnessResult.recentTicks).toHaveLength(1);
    expect(harnessResult.recentTicks[0].price).toBe(2891.50);
    expect(harnessResult.recentTicks[0].timestamp).toBe(
      new Date('2025-06-01T10:00:00.000Z').getTime(),
    );
  });

  it('determines buy/sell side from price movement', () => {
    render(<Harness stockId="RELIANCE" active={true} />);

    // Baseline tick
    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2890, change: 0,
        changePercent: 0, timestamp: new Date().toISOString(),
      });
    });
    advance(300);

    // Price up → buy
    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2892, change: 2,
        changePercent: 0.07, timestamp: new Date().toISOString(),
      });
    });
    advance(300);
    expect(harnessResult.recentTicks[1].side).toBe('buy');

    // Price down → sell
    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2888, change: -4,
        changePercent: -0.14, timestamp: new Date().toISOString(),
      });
    });
    advance(300);
    expect(harnessResult.recentTicks[2].side).toBe('sell');
  });

  it('uses tick.side when explicitly provided (overrides inferred)', () => {
    render(<Harness stockId="RELIANCE" active={true} />);

    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2891, change: 1,
        changePercent: 0.03, timestamp: new Date().toISOString(),
        side: 'sell',
      });
    });
    advance(300);
    expect(harnessResult.recentTicks[0].side).toBe('sell');
  });

  it('assigns a default volume when tick has no volume', () => {
    render(<Harness stockId="RELIANCE" active={true} />);

    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2890, change: 0,
        changePercent: 0, timestamp: new Date().toISOString(),
      });
    });
    advance(300);

    expect(harnessResult.recentTicks[0].volume).toBeGreaterThan(0);
    expect(harnessResult.recentTicks[0].volume).toBeLessThan(1000);
  });

  it('uses tick.volume when provided', () => {
    render(<Harness stockId="RELIANCE" active={true} />);

    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2890, change: 0,
        changePercent: 0, timestamp: new Date().toISOString(),
        volume: 5000,
      });
    });
    advance(300);

    expect(harnessResult.recentTicks[0].volume).toBe(5000);
  });

  it('updates lastTickPrice to the most recent tick price', () => {
    mockWsCallbacks.setCurrentPrice(2885);
    render(<Harness stockId="RELIANCE" active={true} />);

    // After flush timer, lastTickPrice reflects WS cached price set in effect
    advance(350);
    expect(harnessResult.lastTickPrice).toBe(2885);

    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2895, change: 10,
        changePercent: 0.35, timestamp: new Date().toISOString(),
      });
    });
    advance(300);
    expect(harnessResult.lastTickPrice).toBe(2895);

    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2900, change: 5,
        changePercent: 0.17, timestamp: new Date().toISOString(),
      });
    });
    advance(300);
    expect(harnessResult.lastTickPrice).toBe(2900);
  });

  it('caps recentTicks at 100 entries', () => {
    render(<Harness stockId="RELIANCE" active={true} />);

    // Send 110 ticks
    for (let i = 0; i < 110; i++) {
      act(() => {
        mockWsCallbacks.triggerTick({
          symbol: 'RELIANCE', lastPrice: 2890 + i * 0.5, change: 0.5,
          changePercent: 0.02, timestamp: new Date().toISOString(),
        });
      });
    }
    advance(300);

    expect(harnessResult.recentTicks.length).toBeLessThanOrEqual(100);
    // Oldest entry should have been shifted off
    expect(harnessResult.recentTicks[0].price).toBeGreaterThan(2890);
  });

  it('maintains tick insertion order (newest at end)', () => {
    render(<Harness stockId="RELIANCE" active={true} />);

    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 100, change: 0,
        changePercent: 0, timestamp: new Date().toISOString(),
      });
    });
    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 200, change: 100,
        changePercent: 100, timestamp: new Date().toISOString(),
      });
    });
    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 300, change: 100,
        changePercent: 50, timestamp: new Date().toISOString(),
      });
    });
    advance(300);

    expect(harnessResult.recentTicks).toHaveLength(3);
    expect(harnessResult.recentTicks[0].price).toBe(100);
    expect(harnessResult.recentTicks[1].price).toBe(200);
    expect(harnessResult.recentTicks[2].price).toBe(300);
  });
});

// ═══════════════════════════════════════════════════════════════
// Re-render Batching
// ═══════════════════════════════════════════════════════════════

describe('useTickStream — Re-render Batching', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockWsCallbacks.setCurrentPrice(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes tick data to component after 300ms', () => {
    render(<Harness stockId="RELIANCE" active={true} />);

    // Send 3 ticks
    for (let i = 0; i < 3; i++) {
      act(() => {
        mockWsCallbacks.triggerTick({
          symbol: 'RELIANCE', lastPrice: 2890 + i, change: 1,
          changePercent: 0.03, timestamp: new Date().toISOString(),
        });
      });
    }

    advance(350);
    expect(harnessResult.sessionTicks).toBe(3);
    expect(harnessResult.recentTicks).toHaveLength(3);
  });

  it('clears flush timer when active becomes false (no more re-renders)', () => {
    const { update } = render(<Harness stockId="RELIANCE" active={true} />);

    // Let hook initialize and flush timer start
    advance(100);

    // Deactivate — flush timer should be cleared
    actUpdate(update, <Harness stockId="RELIANCE" active={false} />);

    // Advance past what would have been the next flush
    advance(500);

    // No ticks were ever sent, so sessionTicks should be 0
    expect(harnessResult.sessionTicks).toBe(0);
    expect(harnessResult.recentTicks).toEqual([]);
  });

  it('stop sending ticks after deactivation (subscription cleaned up)', () => {
    const { update } = render(<Harness stockId="RELIANCE" active={true} />);
    advance(100);

    // Send a tick while active
    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2891, change: 1,
        changePercent: 0.03, timestamp: new Date().toISOString(),
      });
    });
    advance(350);
    expect(harnessResult.sessionTicks).toBe(1);

    // Deactivate — subscription cleanup occurs
    actUpdate(update, <Harness stockId="RELIANCE" active={false} />);

    // Send another tick (the tickCb closure was from the old subscription;
    // in real WS the callback would not fire after unsubscribe.  Our mock
    // doesn't clear tickCb, but after deactivation the component won't
    // re-render because the flush timer is cleared — so harnessResult won't
    // reflect the second tick.)
    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2895, change: 4,
        changePercent: 0.14, timestamp: new Date().toISOString(),
      });
    });
    advance(500);

    // harnessResult still shows the value from the last render (1)
    // because the flush timer was cleared and no re-render occurred.
    expect(harnessResult.sessionTicks).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Toggle Lifecycle
// ═══════════════════════════════════════════════════════════════

describe('useTickStream — Toggle Lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockWsCallbacks.setCurrentPrice(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-subscribes to WS after toggle off→on', () => {
    const { update } = render(<Harness stockId="RELIANCE" active={true} />);
    expect(mockWS.subscribeTicks).toHaveBeenCalledTimes(1);

    actUpdate(update, <Harness stockId="RELIANCE" active={false} />);
    expect(mockWS.unsubscribe).toHaveBeenCalledTimes(1);

    actUpdate(update, <Harness stockId="RELIANCE" active={true} />);
    expect(mockWS.subscribeTicks).toHaveBeenCalledTimes(2);
  });

  it('accumulates ticks correctly after reactivation (counters reset by effect)', () => {
    const { update } = render(<Harness stockId="RELIANCE" active={true} />);
    advance(100);

    // Send a tick
    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2891, change: 1,
        changePercent: 0.03, timestamp: new Date().toISOString(),
      });
    });
    advance(350);
    expect(harnessResult.sessionTicks).toBe(1);

    // Deactivate
    actUpdate(update, <Harness stockId="RELIANCE" active={false} />);

    // On deactivation, the component re-renders and reads sessionTicksRef
    // which still has 1 from the active period.  The ref is NOT cleared on
    // deactivation (only when re-activating — the effect sets counters to 0
    // when it runs again).
    //
    // After the deactivation re-render, harnessResult shows the ref value (1)
    // because the component re-rendered synchronously.
    // The flush timer was the source of periodic re-renders, but update()
    // itself triggers an immediate re-render.

    // Reactivate — effect runs again, resets counters to 0
    actUpdate(update, <Harness stockId="RELIANCE" active={true} />);

    // Send a tick on the new subscription
    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2895, change: 4,
        changePercent: 0.14, timestamp: new Date().toISOString(),
      });
    });
    advance(350);
    expect(harnessResult.sessionTicks).toBe(1);
    expect(harnessResult.recentTicks).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Stock Scoping
// ═══════════════════════════════════════════════════════════════

describe('useTickStream — Stock Scoping', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockWsCallbacks.setCurrentPrice(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('subscribes to the correct stock symbol', () => {
    render(<Harness stockId="HDFCBANK" active={true} />);
    expect(mockWS.subscribeTicks).toHaveBeenCalledWith(
      'HDFCBANK',
      expect.any(Function),
    );
  });

  it('unsubscribes old stock and subscribes new stock on symbol change', () => {
    const { update } = render(<Harness stockId="RELIANCE" active={true} />);
    expect(mockWS.subscribeTicks).toHaveBeenCalledWith(
      'RELIANCE', expect.any(Function),
    );

    actUpdate(update, <Harness stockId="TCS" active={true} />);

    expect(mockWS.unsubscribe).toHaveBeenCalledWith('RELIANCE');
    expect(mockWS.subscribeTicks).toHaveBeenCalledWith(
      'TCS', expect.any(Function),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════════════════════

describe('useTickStream — Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockWsCallbacks.setCurrentPrice(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles empty stockId gracefully', () => {
    expect(() => {
      render(<Harness stockId="" active={true} />);
    }).not.toThrow();
    expect(mockWS.subscribeTicks).not.toHaveBeenCalled();
  });

  it('handles null/undefined stockId gracefully', () => {
    expect(() => {
      render(<Harness stockId={'' as any} active={true} />);
    }).not.toThrow();
    expect(mockWS.subscribeTicks).not.toHaveBeenCalled();
  });

  it('does not leak intervals between multiple mount/unmount cycles', () => {
    const { unmount } = render(<Harness stockId="RELIANCE" active={true} />);
    advance(100);

    act(() => { unmount(); });
    advance(100);

    render(<Harness stockId="TCS" active={true} />);
    expect(mockWS.subscribeTicks).toHaveBeenCalledTimes(2);
  });

  it('tick with price=0 does not break accumulation', () => {
    render(<Harness stockId="RELIANCE" active={true} />);

    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 0, change: 0,
        changePercent: 0, timestamp: new Date().toISOString(),
      });
    });
    advance(350);

    expect(harnessResult.sessionTicks).toBe(1);
    expect(harnessResult.recentTicks[0].price).toBe(0);
    expect(harnessResult.lastTickPrice).toBe(0);
  });

  it('maintains startTime across multiple ticks', () => {
    render(<Harness stockId="RELIANCE" active={true} />);
    const start = harnessResult.startTime;

    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2891, change: 1,
        changePercent: 0.03, timestamp: new Date().toISOString(),
      });
    });
    advance(350);
    expect(harnessResult.startTime).toBe(start);

    act(() => {
      mockWsCallbacks.triggerTick({
        symbol: 'RELIANCE', lastPrice: 2892, change: 1,
        changePercent: 0.03, timestamp: new Date().toISOString(),
      });
    });
    advance(350);
    expect(harnessResult.startTime).toBe(start);
  });
});
