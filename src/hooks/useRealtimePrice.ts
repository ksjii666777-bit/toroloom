import { useEffect, useState, useCallback, useRef } from 'react';
import { getActiveWS } from '../services/wsRegistry';
import { generateStockHistory, generateIntradayData } from '../constants/mockData';
import type { StockHistoryPoint } from '../types';

interface RealtimePriceState {
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  lastUpdated: string | null;
  candleHistory: StockHistoryPoint[];
  isConnected: boolean;
}

export function useRealtimePrice(stockId: string, basePrice: number) {
  const [state, setState] = useState<RealtimePriceState>({
    currentPrice: basePrice,
    priceChange: 0,
    priceChangePercent: 0,
    lastUpdated: null,
    candleHistory: [],
    isConnected: false,
  });

  const subscriptionRef = useRef<boolean>(false);

  // Keep the latest basePrice available to the WS price callback without
  // re-running the subscription effect (avoids disconnect/reconnect churn
  // when stock.price updates in the market store while the screen is mounted).
  const basePriceRef = useRef(basePrice);
  basePriceRef.current = basePrice;

  // Generate initial historical data based on timeframe
  const loadHistory = useCallback((timeframe: string) => {
    // ── Intraday timeframes (end with 'm') ──
    if (timeframe.endsWith('m')) {
      const minutes = parseInt(timeframe, 10);
      if (!isNaN(minutes) && minutes > 0) {
        const candleData = generateIntradayData(minutes);
        setState(prev => ({
          ...prev,
          candleHistory: candleData,
        }));
        return;
      }
    }

    // ── Daily / multi-day timeframes ──
    let days: number;
    switch (timeframe) {
      case '1D': days = 1; break;
      case '1W': days = 7; break;
      case '1M': days = 30; break;
      case '3M': days = 90; break;
      case '1Y': days = 365; break;
      default: days = 365;
    }

    const fullHistory = generateStockHistory();
    const candleData = fullHistory.slice(-days);
    
    setState(prev => ({
      ...prev,
      candleHistory: candleData,
    }));
  }, []);

  // ── Offline fallback: simulated price noise when WS is NOT connected ──
  // When connected (mock or real), live WS ticks drive the price instead,
  // so this interval only runs while disconnected (backend down / offline).
  useEffect(() => {
    if (state.isConnected) return;

    const interval = setInterval(() => {
      setState(prev => {
        const volatility = prev.currentPrice * 0.001;
        const change = (Math.random() - 0.5) * volatility;
        const newPrice = Math.round((prev.currentPrice + change) * 100) / 100;
        const priceChange = Math.round((newPrice - basePrice) * 100) / 100;
        const percentChange = Math.round(((newPrice - basePrice) / basePrice) * 10000) / 100;

        return {
          ...prev,
          currentPrice: newPrice,
          priceChange,
          priceChangePercent: percentChange,
        };
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [basePrice, state.isConnected]);

  // ── Subscribe to WebSocket: live ticks are the PRIMARY price source ──
  // Mock and real services both emit { price, change, changePercent, timestamp }
  // via onPrice, so the same handler works for both.  Candle data + connection
  // status also come from the WS stream.
  useEffect(() => {
    if (!stockId || subscriptionRef.current) return;

    const ws = getActiveWS();
    // WS may be unavailable (backend offline / test mocks) — the 3s
    // simulated-price fallback keeps prices moving in that case.
    if (!ws) return;

    subscriptionRef.current = true;
    const conn = ws.connect();
    if (conn && typeof conn.catch === 'function') {
      conn.catch(() => {
        // Connection failed (e.g. backend down) — the interval fallback
        // keeps simulated prices moving until the WS reconnects.
      });
    }
    ws.onConnectionChangeCallback((connected) => {
      setState(prev => ({ ...prev, isConnected: connected }));
    });

    ws.subscribe(
      stockId,
      // Live tick from the WS stream — drives currentPrice / change
      (priceData) => {
        const refBasePrice = basePriceRef.current;
        setState(prev => {
          const next = { ...prev, lastUpdated: priceData.timestamp };
          if (typeof priceData.price === 'number' && priceData.price > 0 && refBasePrice > 0) {
            next.currentPrice = priceData.price;
            next.priceChange = Math.round((priceData.price - refBasePrice) * 100) / 100;
            next.priceChangePercent = Math.round(((priceData.price - refBasePrice) / refBasePrice) * 10000) / 100;
          }
          return next;
        });
      },
      (candleData) => {
        setState(prev => {
          const updated = [...prev.candleHistory, candleData.candle];
          if (updated.length > 500) updated.shift();
          return { ...prev, candleHistory: updated };
        });
      }
    );

    return () => {
      subscriptionRef.current = false;
      ws.unsubscribe(stockId);
      ws.disconnect();
    };
  }, [stockId]);

  return {
    ...state,
    loadHistory,
    isPositive: state.priceChange >= 0,
  };
}
