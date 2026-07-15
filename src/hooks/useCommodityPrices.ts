/**
 * useCommodityPrices — Real-time commodity price hook
 *
 * Auto-detects backend availability:
 *   1. Pings GET /health with a 3-second timeout
 *   2. If backend responds → switches to real WebSocket for live prices
 *   3. If backend is down → keeps mock WebSocket (seeded with commodity prices)
 *
 * Subscribes to all 13 commodity symbols (metals, energy, agriculture)
 * via the active WebSocket service and returns a map of symbol → live price data.
 *
 * Usage:
 *   const { prices, connected, mode, isDetecting, lastUpdate } = useCommodityPrices();
 *   <Text>{prices['XAUUSD']?.price}</Text>
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { getActiveWS, setWSMode, getWSMode } from '../services/wsRegistry';
import { getBaseUrl } from '../services/api/client';
import { log } from '../utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CommodityTick {
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface CommodityPriceMap {
  [symbol: string]: CommodityTick;
}

export type WsSource = 'mock' | 'real_backend' | 'offline';

// ── Commodity symbol → id mapping ────────────────────────────────────────────

export const COMMODITY_SYMBOLS = [
  'XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD',  // Precious metals
  'CL', 'NG', 'XB',                         // Energy
  'HG', 'ALI', 'ZNC',                      // Base metals
  'ZC', 'ZW', 'ZS',                        // Agriculture
];

// ── Backend Detection ────────────────────────────────────────────────────────

/**
 * Ping the backend health endpoint to check if it's running.
 * Returns true if the backend responds with HTTP 200 within 3 seconds.
 */
async function detectBackend(): Promise<boolean> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    log.warn('[CommodityWS] No API base URL configured — skipping backend detection');
    return false;
  }

  // /health is at the server root, not under /api
  // e.g. http://localhost:3000/api → http://localhost:3000/health
  const healthUrl = baseUrl.replace(/\/api\/?$/, '/health');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCommodityPrices() {
  const [prices, setPrices] = useState<CommodityPriceMap>({});
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [source, setSource] = useState<WsSource>('offline');
  const subscribedRef = useRef(false);
  const detectionDoneRef = useRef(false);

  const doSubscribe = useCallback(() => {
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    const ws = getActiveWS();

    // Listen for connection changes
    ws.onConnectionChangeCallback((isConnected) => {
      setConnected(isConnected);
    });

    // Connect if not already connected
    ws.connect().catch(() => {
      log.warn('[CommodityWS] Connection failed');
    });

    // Subscribe to each commodity symbol
    for (const symbol of COMMODITY_SYMBOLS) {
      ws.subscribe(
        symbol,
        (tickData) => {
          setPrices(prev => ({
            ...prev,
            [symbol]: {
              price: tickData.price,
              change: tickData.change,
              changePercent: tickData.changePercent,
              timestamp: tickData.timestamp,
            },
          }));
          setLastUpdate(tickData.timestamp);
        },
        () => {
          // We don't use candle data for commodities (price-only display)
        },
      );
    }

    setConnected(ws.getIsAuthenticated());
  }, []);

  const doUnsubscribe = useCallback(() => {
    if (!subscribedRef.current) return;
    subscribedRef.current = false;

    const ws = getActiveWS();
    for (const symbol of COMMODITY_SYMBOLS) {
      ws.unsubscribe(symbol);
    }
  }, []);

  // ── On mount: detect backend, then subscribe ──────────────────────────
  useEffect(() => {
    if (detectionDoneRef.current) return;
    detectionDoneRef.current = true;

    const init = async () => {
      setIsDetecting(true);

      const backendAvailable = await detectBackend();

      if (backendAvailable) {
        log.info('[CommodityWS] Backend detected — switching to real WebSocket');
        const prevMode = getWSMode();
        if (prevMode !== 'real') {
          setWSMode('real');
        }
        setSource('real_backend');
      } else {
        log.info('[CommodityWS] Backend not available — using mock WebSocket (commodity seeds active)');
        // Keep mock mode (the default) — commodity prices are seeded in mockWebSocketService
        setSource('mock');
      }

      setIsDetecting(false);
      doSubscribe();
    };

    init();

    return () => {
      detectionDoneRef.current = false; // Allow re-detection on re-mount
      doUnsubscribe();
    };
  }, [doSubscribe, doUnsubscribe]);

  // ── Reconnection poll (keeps subscriptions alive across reconnect cycles) ──
  useEffect(() => {
    const interval = setInterval(() => {
      const ws = getActiveWS();
      if (ws.getIsAuthenticated()) {
        setConnected(true);
        if (!subscribedRef.current) {
          subscribedRef.current = true;
          for (const symbol of COMMODITY_SYMBOLS) {
            ws.subscribe(symbol, (td) => {
              setPrices(prev => ({ ...prev, [symbol]: { price: td.price, change: td.change, changePercent: td.changePercent, timestamp: td.timestamp } }));
            }, () => {});
          }
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return { prices, connected, source, isDetecting, lastUpdate };
}
