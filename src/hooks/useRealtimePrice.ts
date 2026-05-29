import { useEffect, useState, useCallback, useRef } from 'react';
import { getActiveWS } from '../services/wsRegistry';
import { generateStockHistory } from '../constants/mockData';
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

  // Generate initial historical data based on timeframe
  const loadHistory = useCallback((timeframe: string) => {
    let days: number;
    switch (timeframe) {
      case '1D': days = 1; break;
      case '1W': days = 7; break;
      case '1M': days = 30; break;
      case '3M': days = 90; break;
      case '1Y': days = 365; break;
      default: days = 365;
    }

    // Use generateStockHistory but only take the period we need
    const fullHistory = generateStockHistory();
    const candleData = fullHistory.slice(-days);
    
    setState(prev => ({
      ...prev,
      candleHistory: candleData,
    }));
  }, []);

  // Steady price fluctuation via simulated market noise
  // This is the sole source of price updates for consistency
  useEffect(() => {
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
  }, [basePrice]);

  // Subscribe to mock WebSocket for candle data and connection status
  useEffect(() => {
    if (!stockId || subscriptionRef.current) return;
    subscriptionRef.current = true;

    const ws = getActiveWS();
    ws.connect();
    ws.onConnectionChangeCallback((connected) => {
      setState(prev => ({ ...prev, isConnected: connected }));
    });

    ws.subscribe(
      stockId,
      // Only use WebSocket for timestamp, not price (avoid race with interval)
      (priceData) => {
        setState(prev => ({ ...prev, lastUpdated: priceData.timestamp }));
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
