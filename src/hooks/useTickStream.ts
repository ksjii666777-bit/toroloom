/**
 * ============================================================================
 * Toroloom — Tick Stream Hook
 * ============================================================================
 *
 * Subscribes to the WebSocket tick feed (real or mock) and accumulates
 * trade-by-trade tick data into TickEntry[] for the TickModeIndicator.
 *
 * Replaces the earlier simulated-tick setInterval approach with an actual
 * WS subscription so ticks reflect real market prices (mock or live).
 *
 * Usage:
 *   const { sessionTicks, recentTicks, lastTickPrice, startTime } =
 *     useTickStream(stockId, isTickMode);
 * ============================================================================
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getActiveWS } from '../services/wsRegistry';
import type { TickEntry } from '../components/chart/TickModeIndicator';

interface TickStreamState {
  sessionTicks: number;
  recentTicks: TickEntry[];
  lastTickPrice: number;
  startTime: number;
}

/**
 * Subscribe to the WS tick feed for a stock and accumulate TickEntry objects.
 *
 * @param stockId  Symbol to subscribe to
 * @param active   Whether tick streaming is enabled (avoids unnecessary WS sub)
 * @returns        Session ticks, recent ticks, last-tick price, and start time
 */
export function useTickStream(stockId: string, active: boolean): TickStreamState {
  const sessionTicksRef = useRef(0);
  const recentTicksRef = useRef<TickEntry[]>([]);
  const lastTickPriceRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const subscribedRef = useRef(false);

  // We use a force-update counter so the component re-renders periodically
  // with fresh tick data.  Ticks arrive rapidly (100-1000ms apart) so we
  // batch updates every ~300ms to avoid excessive re-renders.
  const [, forceRender] = useState(0);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Subscribe to WS tick feed ──────────────────────────────────────────
  useEffect(() => {
    if (!active || !stockId || subscribedRef.current) return;

    subscribedRef.current = true;

    // Reset session counters on new subscription
    sessionTicksRef.current = 0;
    recentTicksRef.current = [];
    lastTickPriceRef.current = 0;
    startTimeRef.current = Date.now();

    const ws = getActiveWS();
    ws.connect();

    // Cache the latest price for direction inference
    let prevPrice = ws.getCurrentPrice(stockId) || 0;
    // Initialize lastTickPrice to current known price (avoids 0 display before first tick)
    if (prevPrice > 0) lastTickPriceRef.current = prevPrice;

    ws.subscribe(
      stockId,
      (tick) => {
        const lastPrice = tick.price;
        const side: 'buy' | 'sell' = lastPrice >= prevPrice ? 'buy' : 'sell';

        const entry: TickEntry = {
          price: lastPrice,
          volume: Math.floor(Math.random() * 500 + 100),
          side,
          timestamp: new Date(tick.timestamp).getTime(),
        };

        sessionTicksRef.current += 1;
        recentTicksRef.current = [...recentTicksRef.current.slice(-99), entry];
        lastTickPriceRef.current = lastPrice;
        prevPrice = lastPrice;
      },
      () => {},
    );

    return () => {
      subscribedRef.current = false;
      ws.unsubscribe(stockId);
    };
  }, [active, stockId]);

  // ── Periodic flush to trigger re-renders ───────────────────────────────
  // Instead of calling setState on every tick (which could be 3-5/sec),
  // we batch updates every 300ms.
  useEffect(() => {
    if (!active) return;

    flushTimerRef.current = setInterval(() => {
      forceRender((n) => n + 1);
    }, 300);

    return () => {
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [active]);

  return {
    sessionTicks: sessionTicksRef.current,
    recentTicks: recentTicksRef.current,
    lastTickPrice: lastTickPriceRef.current,
    startTime: startTimeRef.current,
  };
}
