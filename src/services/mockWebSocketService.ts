import { mockStocks } from '../constants/mockData';
import { useAuthStore } from '../store/authStore';
import { usePortfolioStore } from '../store/portfolioStore';
import type { WebSocketService, PriceUpdateCallback, CandleUpdateCallback, ConnectionCallback, PnLUpdateCallback, LockdownCallback } from './wsService';
import type { StockHistoryPoint } from '../types';

interface Subscription {
  stockId: string;
  onPrice: PriceUpdateCallback;
  onCandle: CandleUpdateCallback;
}

class MockWebSocketService implements WebSocketService {
  private subscribers: Map<string, Subscription> = new Map();
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private stockPrices: Map<string, number> = new Map();
  private stockCandles: Map<string, StockHistoryPoint[]> = new Map();
  private isConnected = false;
  private isAuthenticated = false;
  private onConnectionChange: ConnectionCallback | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Symbols auto-subscribed from portfolio holdings on connect — tickers persist across component unmounts */
  private autoSubscribed = new Set<string>();

  // ── Risk Event Callbacks (registered by riskStore.listenToWS()) ──
  private onPnLUpdate: PnLUpdateCallback | null = null;
  private onLockdown: LockdownCallback | null = null;

  /** Daily loss limit in Rupees used to simulate lockdown detection */
  lossLimitOverride: number | null = null;
  /** Track whether lockdown has been emitted for the current breach cycle */
  private _lockdownActive = false;

  // Initialize stock prices from mock data
  constructor() {
    for (const stock of mockStocks) {
      this.stockPrices.set(stock.id, stock.price);
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    // Reset lockdown tracking on every new connection. This prevents stale
    // state from leaking across auth sessions (e.g. user logs out and back in).
    // If positions still breach the limit on reconnect, the first tick will
    // re-emit the trigger — the riskStore's dedup guard safely handles this.
    this._lockdownActive = false;
    this.isConnected = true;
    this.onConnectionChange?.(true);
    console.log('[MockWS] Connected to market data feed');

    // Step 1: Authenticate via the same protocol the real WS handler expects.
    // Send { type: "auth", token } and wait for { type: "authenticated" }.
    const { token } = useAuthStore.getState();
    const authToken = token || 'mock-token';

    console.log('[MockWS] Sending auth...');

    // Simulate the auth round-trip. In the real WebSocket this would be an
    // actual message exchange; here we decode the token-like value in-band.
    if (!authToken) {
      console.warn('[MockWS] No auth token available — proceeding without authentication');
      this.isAuthenticated = false;
    } else {
      this.isAuthenticated = true;
      console.log('[MockWS] Auth verified — received authenticated response');
    }

    // Step 2: After successful auth, auto-subscribe to the user's portfolio
    // positions. This mirrors the real WS handler which fetches positions
    // from the broker on auth and starts feeding real-time P&L to the risk engine.
    const { holdings } = usePortfolioStore.getState();
    for (const holding of holdings) {
      this.startTicker(holding.stockId);
      this.autoSubscribed.add(holding.stockId);
    }

    console.log(
      `[MockWS] Authenticated. Auto-subscribed to ${holdings.length} portfolio positions: ` +
      holdings.map(h => h.symbol).join(', '),
    );
  }

  disconnect(): void {
    this.isConnected = false;
    this.isAuthenticated = false;
    this.onConnectionChange?.(false);
    for (const [id] of this.intervals) {
      this.clearIntervalsForSymbol(id);
    }
    this.intervals.clear();
    this.subscribers.clear();
    this.autoSubscribed.clear();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    console.log('[MockWS] Disconnected from market data feed');
  }

  onConnectionChangeCallback(cb: ConnectionCallback): void {
    this.onConnectionChange = cb;
  }

  /**
   * Register a callback for real-time P&L updates (mirrors the backend's
   * `pnl_update` WebSocket message).  Called on every simulated tick.
   */
  onPnLUpdateCallback(cb: PnLUpdateCallback): void {
    this.onPnLUpdate = cb;
  }

  /**
   * Register a callback for lockdown events (mirrors the backend's `lockdown`
   * WebSocket message).  Called when aggregate unrealized P&L breaches the
   * configured daily loss limit.
   */
  onLockdownCallback(cb: LockdownCallback): void {
    this.onLockdown = cb;
  }

  /**
   * Set the loss limit that the mock WS uses to simulate lockdown detection.
   * Normally defaults to useRiskStore's dailyLossLimit, but we accept a plain
   * number here to avoid circular dependencies.
   */
  setLossLimit(limit: number): void {
    this.lossLimitOverride = limit;
  }

  subscribe(stockId: string, onPrice: PriceUpdateCallback, onCandle: CandleUpdateCallback): void {
    // If already subscribed to this symbol, replace the callbacks
    if (this.subscribers.has(stockId)) {
      this.subscribers.set(stockId, { stockId, onPrice, onCandle });
      return;
    }

    this.subscribers.set(stockId, { stockId, onPrice, onCandle });

    // Start the ticker if it isn't already running (e.g. from auto-subscribe)
    this.startTicker(stockId);
  }

  unsubscribe(stockId: string): void {
    this.subscribers.delete(stockId);

    // Only clear intervals if no other subscriber needs this symbol AND
    // it's not an auto-subscribed portfolio holding (which persists across
    // component unmounts so the home/portfolio screen always has live data).
    if (!this.subscribers.has(stockId) && !this.autoSubscribed.has(stockId)) {
      this.clearIntervalsForSymbol(stockId);
    }
  }

  // ── Ticker Lifecycle ──────────────────────────────────────────────────────

  /**
   * Start price-simulation intervals for a symbol.  Safe to call multiple
   * times — intervals are only created once and re-used for all subscribers.
   */
  private startTicker(stockId: string): void {
    if (this.intervals.has(stockId)) return; // Already ticking

    const tickInterval = setInterval(() => {
      if (!this.isConnected) return;
      this.simulateTick(stockId);
    }, 1000 + Math.random() * 2000);

    const candleInterval = setInterval(() => {
      if (!this.isConnected) return;
      this.simulateNewCandle(stockId);
    }, 5000);

    this.intervals.set(stockId, tickInterval);
    this.intervals.set(`${stockId}_candle`, candleInterval);
  }

  private clearIntervalsForSymbol(stockId: string): void {
    const tickId = this.intervals.get(stockId);
    if (tickId) {
      clearInterval(tickId);
      this.intervals.delete(stockId);
    }
    const candleId = this.intervals.get(`${stockId}_candle`);
    if (candleId) {
      clearInterval(candleId);
      this.intervals.delete(`${stockId}_candle`);
    }
  }

  // ── Price Simulation ──────────────────────────────────────────────────────

  private simulateTick(stockId: string): void {
    // Always update the internal price map — auto-subscribed portfolio symbols
    // need live prices even without a component subscriber.
    const currentPrice = this.stockPrices.get(stockId) || 1000;
    const volatility = currentPrice * 0.002; // 0.2% volatility per tick
    const change = (Math.random() - 0.5) * volatility;
    const newPrice = Math.max(currentPrice + change, currentPrice * 0.95);
    this.stockPrices.set(stockId, newPrice);

    const changePercent = ((newPrice - currentPrice) / currentPrice) * 100;

    // Forward to component subscriber (if any)
    const sub = this.subscribers.get(stockId);
    if (sub) {
      sub.onPrice({
        stockId,
        price: Math.round(newPrice * 100) / 100,
        change: Math.round((newPrice - currentPrice) * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        timestamp: new Date().toISOString(),
      });
    }

    // After every price tick, recompute aggregate portfolio P&L and emit
    // risk events so the frontend riskStore stays in sync with market moves.
    this.emitRiskEvents();
  }

  private simulateNewCandle(stockId: string): void {
    // Always read the latest price — auto-subscribed symbols keep their
    // internal price map updated even without a component subscriber.
    const currentPrice = this.stockPrices.get(stockId) || 1000;
    const volatility = currentPrice * 0.015;
    const open = currentPrice;
    const close = open + (Math.random() - 0.48) * volatility;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = Math.floor(Math.random() * 5000000) + 1000000;

    const candle: StockHistoryPoint = {
      date: new Date().toISOString(),
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    };

    // Update current price to candle close
    this.stockPrices.set(stockId, candle.close);

    // Store candle for history
    const existing = this.stockCandles.get(stockId) || [];
    existing.push(candle);
    // Keep last 500 candles
    if (existing.length > 500) existing.shift();
    this.stockCandles.set(stockId, existing);

    // Forward to component subscriber (if any)
    const sub = this.subscribers.get(stockId);
    if (sub) {
      sub.onCandle({ stockId, candle });
    }
  }

  // ── Risk Event Emission ────────────────────────────────────────────────

  /**
   * Compute aggregate unrealized P&L from the portfolio holdings using
   * the mock's current market prices, then emit P&L updates and lockdown
   * events (trigger / lift) based on P&L vs configured loss limit.
   *
   * Lockdown state tracking prevents duplicate emissions and detects lifts:
   *   - Loss ≥ limit AND not yet active  → emit trigger, set _lockdownActive
   *   - Loss < limit AND was active       → emit lift,  clear _lockdownActive
   *   - Otherwise                         → skip lockdown event (no state change)
   *
   * This mirrors the real WebSocket handler's `emitRiskEvents()` on the
   * backend, which pushes `pnl_update` and `lockdown` messages to clients
   * after calling `riskEngine.updateUnrealizedPnL()`.
   */
  private emitRiskEvents(): void {
    const holdings = usePortfolioStore.getState().holdings;
    if (holdings.length === 0) return;

    let totalUnrealizedPnL = 0;

    for (const holding of holdings) {
      const marketPrice = this.stockPrices.get(holding.stockId) ?? holding.currentPrice;
      const pnl = Math.round((marketPrice - holding.buyPrice) * holding.quantity * 100) / 100;
      totalUnrealizedPnL += pnl;
    }

    // ── 1. Emit P&L update (mirrors backend's pnl_update message) ──
    this.onPnLUpdate?.({
      realizedPnL: 0,
      unrealizedPnL: totalUnrealizedPnL,
      totalPnL: totalUnrealizedPnL,
    });

    // ── 2. Check if lockdown state should change ──
    // NOTE: We do NOT import useRiskStore here to avoid circular deps.
    if (this.lossLimitOverride === null) return;

    const isBreaching = totalUnrealizedPnL < 0 && Math.abs(totalUnrealizedPnL) >= this.lossLimitOverride;

    if (isBreaching && !this._lockdownActive) {
      // ── Lockdown triggered ─────────────────────────────────
      this._lockdownActive = true;
      const now = new Date();
      const liftsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      this.onLockdown?.({
        status: 'active',
        triggeredAt: now.toISOString(),
        liftsAt: liftsAt.toISOString(),
        triggerLoss: Math.abs(totalUnrealizedPnL),
        breachedLimit: 'daily_loss',
      });

      console.log(
        '[MockWS] Lockdown TRIGGERED — ' +
        `loss ₹${Math.abs(totalUnrealizedPnL).toLocaleString()} ≥ limit ₹${this.lossLimitOverride.toLocaleString()}`,
      );
    } else if (!isBreaching && this._lockdownActive) {
      // ── Lockdown lifted (P&L recovered above limit) ────────
      this._lockdownActive = false;

      this.onLockdown?.({
        status: 'none',
        triggeredAt: null,
        liftsAt: null,
        triggerLoss: null,
        breachedLimit: null,
      });

      console.log('[MockWS] Lockdown LIFTED — P&L recovered above limit');
    }
    // else: no state change → deduplicate (don't re-emit)
  }

  // ── Public Data Access ────────────────────────────────────────────────────

  getCurrentPrice(stockId: string): number {
    return this.stockPrices.get(stockId) || 1000;
  }

  getCachedCandles(stockId: string): StockHistoryPoint[] {
    return this.stockCandles.get(stockId) || [];
  }

  // ── Connection State ──────────────────────────────────────────────────────

  getIsAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  // ── Simulate Disconnect / Reconnect ──────────────────────────────────────

  simulateDisconnect(): void {
    this.isConnected = false;
    this.isAuthenticated = false;
    this.onConnectionChange?.(false);
    console.log('[MockWS] Connection lost');

    // Auto-reconnect after 3 seconds
    this.reconnectTimer = setTimeout(async () => {
      await this.connect();
    }, 3000);
  }
}

// Singleton instance
export const mockWebSocket = new MockWebSocketService();
export default mockWebSocket;
