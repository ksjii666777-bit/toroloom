/**
 * Real WebSocket Client — connects to the backend's /ws endpoint
 *
 * Implements the same `WebSocketService` interface as `MockWebSocketService`,
 * but instead of simulating data locally it talks to the live backend:
 *
 *   1. Opens a WebSocket to ws://HOST:PORT/ws
 *   2. On { type: "connected" } → sends { type: "auth", token }
 *   3. On { type: "authenticated" } → auto-subscribes to portfolio holdings
 *   4. On { type: "tick" } → forwards to component subscribers
 *   5. On { type: "pnl_update" } → forwards to riskStore callback
 *   6. On { type: "lockdown" } → forwards to riskStore callback
 *   7. On { type: "subscribed" } → confirms subscription
 *
 * The candle callback is never fired — candle data is fetched via REST API
 * (the backend doesn't push candles through the WS feed).
 */

import { getBaseUrl } from './api/client';
import { useAuthStore } from '../store/authStore';
import { usePortfolioStore } from '../store/portfolioStore';
import { log } from '../utils/logger';
import type {
  WebSocketService,
  PriceUpdateCallback,
  CandleUpdateCallback,
  ConnectionCallback,
  PnLUpdateCallback,
  LockdownCallback,
} from './wsService';
import type { StockHistoryPoint } from '../types';

// Derive the WebSocket URL from the REST base URL.
//    http://localhost:3000/api  →  ws://localhost:3000/ws
function getWSBaseUrl(): string {
  const rest = getBaseUrl(); // e.g. "http://localhost:3000/api"
  return rest
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:')
    .replace(/\/api\/?$/, '/ws');
}

export class RealWebSocketService implements WebSocketService {
  private ws: WebSocket | null = null;

  /** Map of stockId → price subscription callbacks. */
  private subscribers = new Map<
    string,
    { onPrice: PriceUpdateCallback; onCandle: CandleUpdateCallback }
  >();

  /** Latest prices received from ticks, keyed by stockId. */
  private stockPrices = new Map<string, number>();

  /** Latest candles (kept for interface compatibility). */
  private stockCandles = new Map<string, StockHistoryPoint[]>();

  private isConnected = false;
  private isAuthenticated = false;

  /** Callbacks registered by stores/hooks. */
  private onConnectionChange: ConnectionCallback | null = null;
  private onPnLUpdate: PnLUpdateCallback | null = null;
  private onLockdown: LockdownCallback | null = null;

  /** Daily loss limit (not used by real WS — the backend enforces it). */
  private lossLimitOverride: number | null = null;

  /** Symbols auto-subscribed from portfolio holdings on connect. */
  private autoSubscribed = new Set<string>();

  /**
   * Subscriptions requested before the auth handshake completed.
   * Flushed once the {@code authenticated} message arrives.
   */
  private pendingSubscribes = new Set<string>();

  /** Reconnection timer handle. */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  // ── Connection Lifecycle ──────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.shouldReconnect = true;

    const url = getWSBaseUrl();
    log.info(`[RealWS] Connecting to ${url}…`);

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      const connectTimeout = setTimeout(() => {
        ws.close();
        reject(new Error(`[RealWS] Connection timed out`));
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectTimeout);
        this.ws = ws;
        this.isConnected = true;
        this.onConnectionChange?.(true);
        log.info('[RealWS] Connected');

        // After the WebSocket opens, the server sends { type: "connected" }
        // immediately.  We wait for it, then send auth.
        // (The message handler already listens for incoming messages.)
        resolve();
      };

      ws.onmessage = (event) => this.handleMessage(event.data);

      ws.onclose = () => {
        this.isConnected = false;
        this.isAuthenticated = false;
        this.onConnectionChange?.(false);

        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror, so we don't handle here.
        // But we do reject the connect promise if still pending.
        clearTimeout(connectTimeout);
        reject(new Error('[RealWS] Connection error'));
      };
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isConnected = false;
    this.isAuthenticated = false;
    this.onConnectionChange?.(false);
    this.ws?.close();
    this.ws = null;
    this.subscribers.clear();
    this.autoSubscribed.clear();
    this.pendingSubscribes.clear();
    log.info('[RealWS] Disconnected');
  }

  // ── Message Routing ───────────────────────────────────────────────────────

  private handleMessage(raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      log.warn('[RealWS] Ignoring non-JSON message:', raw);
      return;
    }

    switch (msg.type) {
      // ── Welcome ────────────────────────────────────────────
      case 'connected': {
        log.info('[RealWS] Server connected — sending auth');
        this.sendAuth();
        break;
      }

      // ── P&L Update (from riskEngine bridge) ────────────────
      case 'pnl_update': {
        this.onPnLUpdate?.(msg.data);
        break;
      }

      // ── Auth Response ──────────────────────────────────────
      case 'authenticated': {
        this.isAuthenticated = true;
        log.info('[RealWS] Authenticated —', msg.userId);

        // ── 1. Flush any subscribes that were requested before auth ──
        this.flushPendingSubscribes();

        // ── 2. Auto-subscribe to portfolio holdings (mirrors mock) ──
        this.autoSubscribePortfolio();
        break;
      }

      // ── Subscribe Confirmation ─────────────────────────────
      case 'subscribed': {
        log.info(`[RealWS] Subscribed to ${msg.count} symbol(s): ${msg.symbols?.join(', ')}`);
        break;
      }

      // ── Price Tick ─────────────────────────────────────────
      case 'tick': {
        this.handleTick(msg.data);
        break;
      }

      // ── Lockdown Event ─────────────────────────────────────
      case 'lockdown': {
        this.onLockdown?.(msg.data);
        break;
      }

      // ── Error ──────────────────────────────────────────────
      case 'error': {
        log.warn('[RealWS] Server error:', msg.message);
        break;
      }

      // ── Heartbeat ──────────────────────────────────────────
      case 'pong': {
        // Ignored — the backend may use this for keep-alive
        break;
      }

      default: {
        log.warn('[RealWS] Unknown message type:', msg.type);
      }
    }
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  private sendAuth(): void {
    const { token } = useAuthStore.getState();
    if (!token) {
      log.warn('[RealWS] No auth token available — cannot authenticate');
      return;
    }
    this.send({ type: 'auth', token });
  }

  // ── Tick Handling ─────────────────────────────────────────────────────────

  private handleTick(data: any): void {
    const { symbol, lastPrice, change, changePercent, timestamp } = data;

    // Update the price cache
    this.stockPrices.set(symbol, lastPrice);

    // Forward to component subscribers
    const sub = this.subscribers.get(symbol);
    if (sub) {
      sub.onPrice({
        stockId: symbol,
        price: lastPrice,
        change: change ?? 0,
        changePercent: changePercent ?? 0,
        timestamp: timestamp ?? new Date().toISOString(),
      });
    }
  }

  // ── Subscribe / Unsubscribe ────────────────────────────────────────────────

  subscribe(
    stockId: string,
    onPrice: PriceUpdateCallback,
    onCandle: CandleUpdateCallback,
  ): void {
    // Store callbacks
    if (this.subscribers.has(stockId)) {
      this.subscribers.set(stockId, { onPrice, onCandle });
      return;
    }

    this.subscribers.set(stockId, { onPrice, onCandle });

    // If we're already subscribed on the server side (via auto-subscribe),
    // don't send a duplicate subscribe message.
    if (this.autoSubscribed.has(stockId)) return;

    // Queue the subscribe if we're not yet authenticated — it will be
    // flushed once the auth handshake completes.
    if (!this.isAuthenticated) {
      this.pendingSubscribes.add(stockId);
      return;
    }

    // Tell the backend to start streaming ticks for this symbol
    if (this.isConnected) {
      this.send({ type: 'subscribe', symbols: [stockId] });
    }
  }

  unsubscribe(stockId: string): void {
    this.subscribers.delete(stockId);
    // Remove from pending queue if the subscribe hadn't been flushed yet
    this.pendingSubscribes.delete(stockId);

    // Only unsubscribe from the backend if it's not an auto-subscribed
    // holding (which persists across component unmounts).
    if (!this.autoSubscribed.has(stockId) && this.isConnected && this.isAuthenticated) {
      this.send({ type: 'unsubscribe', symbols: [stockId] });
    }
  }

  // ── Pending Subscribe Flush ──────────────────────────────────────────────

  /** Flush symbols that were subscribed before auth completed. */
  private flushPendingSubscribes(): void {
    if (this.pendingSubscribes.size === 0) return;

    const symbols = Array.from(this.pendingSubscribes);
    this.pendingSubscribes.clear();

    // Mark flushed symbols as auto-subscribed so that
    // autoSubscribePortfolio() doesn't re-send them.
    for (const sym of symbols) {
      this.autoSubscribed.add(sym);
    }

    this.send({ type: 'subscribe', symbols });
    log.info(
      `[RealWS] Flushed ${symbols.length} queued subscribe(s): ${symbols.join(', ')}`,
    );
  }

  // ── Auto-Subscribe Portfolio ───────────────────────────────────────────────

  private autoSubscribePortfolio(): void {
    const { holdings } = usePortfolioStore.getState();
    const symbols = holdings.map((h) => h.stockId);

    if (symbols.length === 0) return;

    // Tell the backend to subscribe to all held symbols
    this.send({ type: 'subscribe', symbols });

    // Mark them as auto-subscribed
    for (const sym of symbols) {
      this.autoSubscribed.add(sym);
    }

    log.info(
      `[RealWS] Auto-subscribed to ${symbols.length} portfolio position(s): ${symbols.join(', ')}`,
    );
  }

  // ── Callback Registration ─────────────────────────────────────────────────

  onConnectionChangeCallback(cb: ConnectionCallback): void {
    this.onConnectionChange = cb;
  }

  onPnLUpdateCallback(cb: PnLUpdateCallback): void {
    this.onPnLUpdate = cb;
  }

  onLockdownCallback(cb: LockdownCallback): void {
    this.onLockdown = cb;
  }

  setLossLimit(limit: number): void {
    this.lossLimitOverride = limit;
    // Real WS delegates lockdown enforcement to the backend, so this
    // is a no-op.  Stored in case the mock is swapped in at runtime.
  }

  // ── Data Access ───────────────────────────────────────────────────────────

  getCurrentPrice(stockId: string): number {
    return this.stockPrices.get(stockId) ?? 1000;
  }

  getCachedCandles(_stockId: string): StockHistoryPoint[] {
    // Candle data is fetched via REST API, not cached from WS.
    return [];
  }

  getIsAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      log.warn('[RealWS] Cannot send — WebSocket not open');
    }
  }
}
