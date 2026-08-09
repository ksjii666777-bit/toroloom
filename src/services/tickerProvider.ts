/**
 * ============================================================================
 * Toroloom — Ticker Provider
 * ============================================================================
 *
 * THE bridge between the two data sources of the hybrid architecture:
 *
 *   ┌──────────────────────────────┐        ┌──────────────────────────────┐
 *   │  TradingView (market data)   │        │  SnapTrade (execution)       │
 *   │  • Live chart / visualization│        │  • Orders, holdings, balance │
 *   └──────────────┬───────────────┘        └──────────────┬───────────────┘
 *                  │                                       │
 *                  └───────────────► TICKER PROVIDER ◄──────┘
 *                     (single source of truth for the
 *                      ACTIVE instrument + EXECUTION PRICE)
 *
 * Responsibilities
 * ────────────────
 * 1. SYNCED TICKER — one active instrument. Both the TradingView chart and the
 *    SnapTrade order panel subscribe; when the instrument changes, both update.
 *    Symbol changes are APP-DRIVEN (the embedded TradingView widget cannot
 *    report in-chart symbol changes because it runs in a cross-origin iframe,
 *    so in-chart symbol search is disabled in hybrid mode — this also
 *    guarantees the chart can never silently desync from the order panel).
 *
 * 2. SYMBOL MAPPING — converts between TradingView symbols (NASDAQ:AAPL) and
 *    SnapTrade symbols (AAPL) via `toSnapTradeSymbol` / `toTradingViewSymbol`.
 *
 * 3. SINGLE EXECUTION PRICE — `publishPrice` / `getExecutionPrice` is the ONLY
 *    price used for order estimation and Iron Lock pre-flight checks. The
 *    TradingView chart price is display-only and is NEVER used for execution,
 *    so there can be no conflict between the price on the chart and the price
 *    an order is evaluated at.
 *
 * 4. REAL-TIME FEED — `startExecutionPriceFeed` wires the app WebSocket
 *    (primary) with a simulated fallback so the order panel always has a live
 *    LTP, even when the backend WS is down.
 *
 * Security
 * ────────
 * No SnapTrade tokens ever reach the TradingView widget. The provider only
 * forwards the *symbol* and display prices; order execution stays in the
 * backend (POST /api/snaptrade/place-order) where the encrypted userSecret
 * lives.
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { getActiveWS } from './wsRegistry';
import { toTradingViewSymbol as mapToTvSymbol } from '../utils/tradingView';

// ──── Types ────────────────────────────────────────────────────────────────

export interface TickerSelection {
  /** Canonical SnapTrade symbol, e.g. "AAPL", "BRK-B". */
  symbol: string;
  /** TradingView symbol, e.g. "NASDAQ:AAPL". */
  tvSymbol: string;
  exchange?: string;
  name?: string;
  /** Last known price (used as the order-panel prefill base). */
  price?: number;
}

export interface ExecutionQuote {
  symbol: string;
  price: number;
  timestamp: string;
  source: 'ws' | 'simulated' | 'manual';
}

type TickerListener = (ticker: TickerSelection | null) => void;
type QuoteListener = (quote: ExecutionQuote | null) => void;

// ──── Provider ─────────────────────────────────────────────────────────────

class TickerProvider {
  private ticker: TickerSelection | null = null;
  private tickerListeners = new Set<TickerListener>();
  private quoteListeners = new Set<QuoteListener>();
  private executionQuote: ExecutionQuote | null = null;

  // ── 1. Synced ticker ───────────────────────────────────────────────────

  /**
   * Select the active instrument (app-driven). Emits to all subscribers so
   * the chart and the order panel update together.
   */
  selectSymbol(opts: {
    symbol: string;
    exchange?: string;
    name?: string;
    price?: number;
  }): TickerSelection | null {
    const raw = String(opts.symbol || '').trim();
    if (!raw) return this.ticker;

    const selection: TickerSelection = {
      symbol: this.toSnapTradeSymbol(raw),
      tvSymbol: this.toTradingViewSymbol(raw, opts.exchange),
      exchange: opts.exchange,
      name: opts.name,
      price: opts.price,
    };

    // Emit only on an actual change so subscribers don't re-render on no-ops.
    if (
      this.ticker &&
      this.ticker.symbol === selection.symbol &&
      this.ticker.tvSymbol === selection.tvSymbol
    ) {
      return this.ticker;
    }

    this.ticker = selection;
    this.tickerListeners.forEach((fn) => fn(selection));
    return selection;
  }

  /** Replace the ticker wholesale (used by tests / deep-links). */
  setTicker(ticker: TickerSelection | null): void {
    this.ticker = ticker;
    this.tickerListeners.forEach((fn) => fn(ticker));
  }

  getTicker(): TickerSelection | null {
    return this.ticker;
  }

  /** Subscribe to ticker changes. Returns an unsubscribe function. */
  subscribeTicker(fn: TickerListener): () => void {
    this.tickerListeners.add(fn);
    return () => {
      this.tickerListeners.delete(fn);
    };
  }

  // ── 2. Symbol mapping ──────────────────────────────────────────────────

  /**
   * TradingView symbol → SnapTrade symbol.
   * "NASDAQ:AAPL" → "AAPL" · "NSE:RELIANCE" → "RELIANCE".
   */
  toSnapTradeSymbol(symbolOrTv: string): string {
    const s = String(symbolOrTv || '').trim();
    const idx = s.indexOf(':');
    return (idx >= 0 ? s.slice(idx + 1) : s).toUpperCase();
  }

  /**
   * SnapTrade symbol (+ exchange) → TradingView symbol.
   * Already-qualified symbols pass through: "AAPL" + "NASDAQ" → "NASDAQ:AAPL",
   * "NASDAQ:AAPL" → "NASDAQ:AAPL".
   */
  toTradingViewSymbol(symbolOrTv: string, exchange?: string): string {
    const s = String(symbolOrTv || '').trim();
    if (!s) return '';
    if (s.includes(':')) return s.toUpperCase();
    return mapToTvSymbol(s, exchange).toUpperCase();
  }

  // ── 3. Single execution price ──────────────────────────────────────────

  /**
   * Publish the price that ORDER EXECUTION will be evaluated at. This is the
   * single source of truth — never take an execution price from the chart.
   */
  publishPrice(
    price: number,
    symbol: string,
    source: ExecutionQuote['source'] = 'manual',
  ): void {
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return;
    const quote: ExecutionQuote = {
      symbol: this.toSnapTradeSymbol(symbol),
      price,
      timestamp: new Date().toISOString(),
      source,
    };
    this.executionQuote = quote;
    this.quoteListeners.forEach((fn) => fn(quote));
  }

  getExecutionPrice(): number | null {
    const q = this.executionQuote;
    return q && Number.isFinite(q.price) && q.price > 0 ? q.price : null;
  }

  getExecutionQuote(): ExecutionQuote | null {
    return this.executionQuote;
  }

  /** Subscribe to execution-price updates (replays the latest quote). */
  subscribeExecutionPrice(fn: QuoteListener): () => void {
    this.quoteListeners.add(fn);
    if (this.executionQuote) fn(this.executionQuote);
    return () => {
      this.quoteListeners.delete(fn);
    };
  }

  // ── 4. Real-time feed ──────────────────────────────────────────────────

  /**
   * Start the live LTP feed for a symbol: app WebSocket (primary) with a
   * simulated fallback. The emitted quotes are published through the single
   * execution-price channel above. Returns an unsubscribe function.
   */
  startExecutionPriceFeed(
    symbol: string,
    onQuote?: (quote: ExecutionQuote) => void,
  ): () => void {
    const sym = this.toSnapTradeSymbol(symbol);
    const emit = (quote: ExecutionQuote) => {
      this.publishPrice(quote.price, sym, quote.source);
      onQuote?.(quote);
    };

    // ── Primary stream: app WebSocket ───────────────────────────────────
    // If a WS service is available and subscribable, it is the ONLY source
    // of execution prices. The simulated fallback below is started only when
    // the WS path is unavailable — never both, so there can be no conflict
    // between a real tick and a simulated one on the execution channel.
    let wsAvailable = false;
    try {
      const ws = getActiveWS();
      if (ws && typeof ws.subscribe === 'function') {
        const conn = ws.connect();
        if (conn && typeof (conn as Promise<void>).catch === 'function') {
          (conn as Promise<void>).catch(() => {
            /* connection state is surfaced elsewhere */
          });
        }
        ws.subscribe(
          sym,
          (priceData: any) => {
            if (
              priceData &&
              typeof priceData.price === 'number' &&
              priceData.price > 0
            ) {
              emit({
                symbol: sym,
                price: priceData.price,
                timestamp: priceData.timestamp || new Date().toISOString(),
                source: 'ws',
              });
            }
          },
          () => {
            /* candle data is not needed for the order panel */
          },
        );
        wsAvailable = true;
      }
    } catch {
      /* Fall through to the simulated fallback below. */
    }

    // ── Fallback stream: simulated drift ────────────────────────────────
    // Runs ONLY when no WebSocket is available (offline / backend WS down),
    // so the order panel still has a live LTP to evaluate orders against.
    const interval = wsAvailable
      ? undefined
      : setInterval(() => {
          const base = this.executionQuote?.symbol === sym ? this.executionQuote.price : 0;
          if (!base) return;
          const volatility = base * 0.001;
          const next = Math.round((base + (Math.random() - 0.5) * volatility) * 100) / 100;
          emit({ price: next, symbol: sym, timestamp: new Date().toISOString(), source: 'simulated' });
        }, 3000);

    return () => {
      if (interval) clearInterval(interval);
      try {
        const ws = getActiveWS();
        // Unsubscribe only — the WS is a shared app-wide connection, so we
        // never disconnect() it from a per-symbol feed teardown.
        if (ws && typeof ws.unsubscribe === 'function') {
          ws.unsubscribe(sym);
        }
      } catch {
        /* ignore */
      }
    };
  }

  /** Test helper — clears state between test cases. */
  reset(): void {
    this.ticker = null;
    this.executionQuote = null;
    this.tickerListeners.clear();
    this.quoteListeners.clear();
  }
}

// Singleton — imported everywhere.
export const tickerProvider = new TickerProvider();

// ──── React hooks ──────────────────────────────────────────────────────────

/** Subscribe a component to the active ticker. */
export function useTicker(): TickerSelection | null {
  const [ticker, setTicker] = useState<TickerSelection | null>(() =>
    tickerProvider.getTicker(),
  );
  useEffect(() => tickerProvider.subscribeTicker(setTicker), []);
  return ticker;
}

/** Subscribe a component to the single execution price. */
export function useExecutionPrice(): ExecutionQuote | null {
  const [quote, setQuote] = useState<ExecutionQuote | null>(() =>
    tickerProvider.getExecutionQuote(),
  );
  useEffect(() => tickerProvider.subscribeExecutionPrice(setQuote), []);
  return quote;
}
