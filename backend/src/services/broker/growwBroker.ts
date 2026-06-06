/**
 * Groww Trade API Broker Implementation
 *
 * This implementation uses raw HTTP calls to the Groww Trade API.
 * No official npm SDK exists — all requests go through fetch().
 *
 * Groww API Docs: https://groww.in/trade-api/docs
 *
 * To use:
 *   1. Register at groww.in/trade-api to get API credentials
 *   2. Set env vars: BROKER=groww, plus your Groww API credentials
 *
 * Required env vars:
 *   GROWW_API_KEY=your_api_key        (X-API-VERSION: 1.0)
 *   GROWW_ACCESS_TOKEN=your_token     (Bearer token)
 *
 * API Base URL: https://api.groww.in/v1
 *
 * Note: Groww does not expose a public WebSocket for ticks.
 *       The subscribeTicks() method uses polling as a fallback.
 */

import {
  IBroker, BrokerConfig, MarketQuote, OHLCData, IndexData,
  StockInfo, OrderPayload, OrderResult, ModifyOrderPayload,
  CancelOrderPayload, OpenOrder, Position, TradeHistory,
} from './interface';

// ──── Constants ──────────────────────────────────────────────────────────────

/** Groww API base URL */
const API_BASE = 'https://api.groww.in/v1';

/** Default segment for equity */
const DEFAULT_SEGMENT = 'CASH';

/** Default exchange */
const DEFAULT_EXCHANGE = 'NSE';

/** Common index trading symbols on Groww */
const INDEX_SYMBOLS: Array<{ name: string; shortName: string; symbol: string }> = [
  { name: 'Nifty 50', shortName: 'NIFTY', symbol: 'NIFTY' },
  { name: 'Bank Nifty', shortName: 'BANKNIFTY', symbol: 'BANKNIFTY' },
  { name: 'BSE Sensex', shortName: 'SENSEX', symbol: 'SENSEX' },
  { name: 'Nifty Midcap 100', shortName: 'MIDCAP', symbol: 'NIFTYMIDCAP100' },
];

/** Common stocks for getStocks() / searchStocks() fallback */
const COMMON_STOCKS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
  'HINDUNILVR', 'BHARTIARTL', 'SBIN', 'TATAMOTORS', 'BAJFINANCE',
  'WIPRO', 'ITC', 'LT', 'AXISBANK', 'KOTAKBANK',
  'MARUTI', 'SUNPHARMA', 'TITAN', 'ULTRACEMCO', 'NTPC',
];

/** Polling interval for subscribeTicks (ms) */
const TICK_POLL_INTERVAL = 3000;

/**
 * Parse the Groww OHLC string format "{open: 149.50, high: 150.50, ...}"
 * into an object.
 */
function parseOHLCString(ohlcStr: string): { open: number; high: number; low: number; close: number } | null {
  try {
    // Remove braces and split by commas
    const cleaned = ohlcStr.replace(/[{}]/g, '');
    const parts = cleaned.split(',').map(s => s.trim());
    const result: Record<string, number> = {};

    for (const part of parts) {
      const [key, val] = part.split(':').map(s => s.trim());
      if (key && val !== undefined) {
        result[key] = parseFloat(val) || 0;
      }
    }

    return {
      open: result['open'] || 0,
      high: result['high'] || 0,
      low: result['low'] || 0,
      close: result['close'] || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Generate a unique order reference ID for Groww orders.
 * Format: 8-20 alphanumeric with at most two hyphens.
 */
function generateOrderRefId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `TOR-${ts}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// ──── GrowwBroker Class ────────────────────────────────────────────────────

export class GrowwBroker implements IBroker {
  readonly name = 'Groww Trade API';

  private connected = false;
  private apiKey = '';
  private accessToken = '';

  /** Polling timers for subscribeTicks */
  private tickIntervals = new Map<string, ReturnType<typeof setInterval>>();

  // ──── Auth ─────────────────────────────────────────────────────────────

  async authenticate(config: BrokerConfig): Promise<boolean> {
    this.apiKey = config.apiKey;
    this.accessToken = config.accessToken || '';

    if (!this.apiKey) throw new Error('Groww API key is required');
    if (!this.accessToken) throw new Error('Groww access token is required');

    // Verify the token by calling a lightweight endpoint (margin/user)
    try {
      const response = await this.rawGet(`${API_BASE}/margins/detail/user`);
      if (response.status !== 'SUCCESS') {
        console.error('[GrowwBroker] Auth verification failed:', response);
        this.connected = false;
        return false;
      }
      this.connected = true;
      console.log('[GrowwBroker] Authenticated successfully');
      return true;
    } catch (error: any) {
      console.error('[GrowwBroker] Authentication failed:', error.message);
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ──── Market Data ──────────────────────────────────────────────────────

  async getIndices(): Promise<IndexData[]> {
    this.requireAuth();
    const results: IndexData[] = [];

    for (const idx of INDEX_SYMBOLS) {
      try {
        const quote = await this.fetchQuote(idx.symbol);
        if (!quote) continue;

        results.push({
          id: idx.shortName,
          name: idx.name,
          shortName: idx.shortName,
          currentValue: quote.lastPrice,
          change: quote.change,
          changePercent: quote.changePercent,
          isPositive: quote.change >= 0,
        });
      } catch (err) {
        console.warn(`[GrowwBroker] Failed to fetch index ${idx.name}:`, (err as Error).message);
      }
    }

    return results;
  }

  async getStocks(): Promise<StockInfo[]> {
    this.requireAuth();
    const results = await Promise.allSettled(
      COMMON_STOCKS.map(sym => this.getQuote(sym).then(q => this.quoteToStockInfo(q)).catch(() => null)),
    );

    return results
      .filter((r): r is PromiseFulfilledResult<StockInfo | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((s): s is StockInfo => s !== null);
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    this.requireAuth();
    const quote = await this.fetchQuote(symbol);
    if (!quote) throw new Error(`No quote data for ${symbol}`);
    return quote;
  }

  async getBulkQuotes(symbols: string[]): Promise<Map<string, MarketQuote>> {
    this.requireAuth();
    const map = new Map<string, MarketQuote>();

    // Groww supports bulk LTP but not full quotes. Fetch individual quotes in parallel.
    const results = await Promise.allSettled(symbols.map(s => this.getQuote(s)));
    for (let i = 0; i < symbols.length; i++) {
      if (results[i].status === 'fulfilled') {
        map.set(symbols[i], (results[i] as PromiseFulfilledResult<MarketQuote>).value);
      }
    }

    return map;
  }

  async getOHLC(symbol: string, interval: string, days: number): Promise<OHLCData[]> {
    this.requireAuth();

    // Use the historical candle API for interval-based OHLC
    const endTime = new Date();
    const startTime = new Date(Date.now() - days * 86400000);

    const formatGrowwTime = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const sec = String(d.getSeconds()).padStart(2, '0');
      return `${y}-${m}-${day} ${h}:${min}:${sec}`;
    };

    // Map interval to minutes for Groww
    const intervalToMinutes: Record<string, string> = {
      '1m': '1',
      '5m': '5',
      '10m': '10',
      '15m': '15',
      '30m': '30',
      '60m': '60',
      '1h': '60',
      '4h': '240',
      '1d': '1440',
      '1w': '10080',
    };

    const intervalMinutes = intervalToMinutes[interval] || '1440';

    const response = await this.rawGet(
      `${API_BASE}/historical/candle/range` +
      `?exchange=${DEFAULT_EXCHANGE}` +
      `&segment=${DEFAULT_SEGMENT}` +
      `&trading_symbol=${encodeURIComponent(symbol)}` +
      `&start_time=${encodeURIComponent(formatGrowwTime(startTime))}` +
      `&end_time=${encodeURIComponent(formatGrowwTime(endTime))}` +
      `&interval_in_minutes=${intervalMinutes}`,
    );

    if (response?.payload?.candles && Array.isArray(response.payload.candles)) {
      return response.payload.candles.map((candle: any[]) => ({
        date: new Date((candle[0] as number) * 1000).toISOString(),
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5] || 0,
      }));
    }

    return [];
  }

  async searchStocks(query: string): Promise<StockInfo[]> {
    this.requireAuth();
    // Groww has no search endpoint — filter the common stocks client-side
    const q = query.toLowerCase();
    const matches = COMMON_STOCKS.filter(s => s.toLowerCase().includes(q));

    if (matches.length === 0) return [];

    const results = await Promise.allSettled(
      matches.map(sym => this.getQuote(sym).then(q => this.quoteToStockInfo(q)).catch(() => null)),
    );

    return results
      .filter((r): r is PromiseFulfilledResult<StockInfo | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((s): s is StockInfo => s !== null);
  }

  // ──── Trading ──────────────────────────────────────────────────────────

  async getOpenOrders(): Promise<OpenOrder[]> {
    this.requireAuth();
    const response = await this.rawGet(
      `${API_BASE}/order/list?segment=${DEFAULT_SEGMENT}&page=0&page_size=50`,
    );

    if (!response?.payload?.order_list && !response?.payload?.orders) return [];

    const orders = response.payload.order_list || response.payload.orders || [];

    return (Array.isArray(orders) ? orders : [])
      .filter((o: any) => {
        const status = (o.order_status || o.status || '').toUpperCase();
        return status === 'OPEN' || status === 'PENDING' || status === 'TRIGGER_PENDING' || status === 'PARTIALLY_FILLED';
      })
      .map((o: any) => ({
        id: o.groww_order_id || `groww_${Date.now()}`,
        symbol: o.trading_symbol || '',
        exchange: o.exchange || 'NSE',
        transactionType: (o.transaction_type || 'BUY').toUpperCase() as 'BUY' | 'SELL',
        quantity: parseInt(o.quantity || 0),
        filledQuantity: parseInt(o.filled_quantity || 0),
        price: parseFloat(o.price || 0),
        triggerPrice: o.trigger_price ? parseFloat(o.trigger_price) : undefined,
        productType: o.product || 'CNC',
        orderType: o.order_type || 'MARKET',
        status: this.mapGrowwOrderStatus(o),
        placedBy: o.placed_by || 'WEB',
        timestamp: o.created_at || o.order_timestamp || new Date().toISOString(),
        validity: o.validity || 'DAY',
      }));
  }

  private mapGrowwOrderStatus(o: any): 'open' | 'pending' | 'partially_filled' | 'trigger_pending' {
    const status = (o.order_status || o.status || '').toUpperCase();
    if (status === 'OPEN') return 'open';
    if (status === 'TRIGGER_PENDING' || status === 'TRIGGER PENDING') return 'trigger_pending';
    if (status === 'PARTIALLY_FILLED' || status === 'PARTFILLED') return 'partially_filled';
    return 'pending';
  }

  async modifyOrder(order: ModifyOrderPayload): Promise<OrderResult> {
    this.requireAuth();

    const body = {
      groww_order_id: order.orderId,
      ...(order.price !== undefined && { price: order.price }),
      ...(order.quantity !== undefined && { quantity: order.quantity }),
      ...(order.orderType !== undefined && { order_type: order.orderType }),
      ...(order.productType !== undefined && { product: order.productType }),
      ...(order.triggerPrice !== undefined && { trigger_price: order.triggerPrice }),
    };

    const response = await this.rawPost(`${API_BASE}/order/modify`, body);

    if (!response || response.status !== 'SUCCESS') {
      return {
        id: order.orderId,
        status: 'rejected',
        message: response?.payload?.remark || 'Order modification failed',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      id: order.orderId,
      status: 'confirmed',
      message: response.payload?.remark || 'Order modified successfully',
      timestamp: new Date().toISOString(),
    };
  }

  async cancelOrder(order: CancelOrderPayload): Promise<OrderResult> {
    this.requireAuth();

    const body = { groww_order_id: order.orderId };
    const response = await this.rawPost(`${API_BASE}/order/cancel`, body);

    if (!response || response.status !== 'SUCCESS') {
      return {
        id: order.orderId,
        status: 'rejected',
        message: response?.payload?.remark || 'Order cancellation failed',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      id: order.orderId,
      status: 'cancelled',
      message: response.payload?.remark || 'Order cancelled successfully',
      timestamp: new Date().toISOString(),
    };
  }

  async placeOrder(order: OrderPayload): Promise<OrderResult> {
    this.requireAuth();

    const productMap: Record<string, string> = {
      'CNC': 'CNC',
      'MIS': 'MIS',
      'NRML': 'NRML',
    };

    const orderTypeMap: Record<string, string> = {
      'LIMIT': 'LIMIT',
      'MARKET': 'MARKET',
      'SL': 'SL',
      'SLM': 'SLM',
    };

    const body = {
      trading_symbol: order.symbol,
      quantity: order.quantity,
      price: order.price,
      exchange: order.exchange || DEFAULT_EXCHANGE,
      segment: DEFAULT_SEGMENT,
      product: productMap[order.productType] || 'CNC',
      order_type: orderTypeMap[order.orderType] || 'MARKET',
      transaction_type: order.transactionType,
      validity: 'DAY',
      order_reference_id: generateOrderRefId(),
    };

    const response = await this.rawPost(`${API_BASE}/order/create`, body);

    if (!response || response.status !== 'SUCCESS') {
      const msg = response?.payload?.remark || response?.message || 'Order placement failed';
      return {
        id: '',
        status: 'rejected',
        message: msg,
        timestamp: new Date().toISOString(),
      };
    }

    const payload = response.payload || {};
    return {
      id: payload.groww_order_id || `groww_${Date.now()}`,
      status: this.mapOrderStatus(payload.order_status),
      message: payload.remark || 'Order placed successfully',
      timestamp: new Date().toISOString(),
    };
  }

  async getPositions(): Promise<Position[]> {
    this.requireAuth();
    const response = await this.rawGet(`${API_BASE}/positions/user?segment=${DEFAULT_SEGMENT}`);

    if (!response?.payload?.positions || !Array.isArray(response.payload.positions)) {
      return [];
    }

    return response.payload.positions.map((p: any) => ({
      symbol: p.trading_symbol || '',
      quantity: parseInt(p.quantity || p.net_carry_forward_quantity || 0),
      buyPrice: parseFloat(p.net_price || p.net_carry_forward_price || 0),
      currentPrice: 0, // Positions API doesn't return current price
      pnl: parseFloat(p.realised_pnl || 0),
      pnlPercent: 0,
    }));
  }

  async getTradeHistory(): Promise<TradeHistory[]> {
    this.requireAuth();
    // Use the order list API to get recent trades
    const response = await this.rawGet(
      `${API_BASE}/order/list?segment=${DEFAULT_SEGMENT}&page=0&page_size=50`,
    );

    if (!response?.payload?.order_list && !response?.payload?.orders) {
      return [];
    }

    const orders = response.payload.order_list || response.payload.orders || [];

    return (Array.isArray(orders) ? orders : []).map((o: any) => ({
      id: o.groww_order_id || o.groww_trade_id || `t_${Date.now()}`,
      symbol: o.trading_symbol || '',
      type: (o.transaction_type || 'BUY').toLowerCase() as 'buy' | 'sell',
      quantity: parseInt(o.filled_quantity || o.quantity || 0),
      price: parseFloat(o.price || o.average_price || 0),
      total: parseFloat(o.price || 0) * parseInt(o.filled_quantity || o.quantity || 0),
      timestamp: o.trade_date_time || o.created_at || new Date().toISOString(),
    }));
  }

  // ──── Portfolio ────────────────────────────────────────────────────────

  async getHoldings(): Promise<Position[]> {
    this.requireAuth();
    const response = await this.rawGet(`${API_BASE}/holdings/user`);

    if (!response?.payload?.holdings || !Array.isArray(response.payload.holdings)) {
      return [];
    }

    return response.payload.holdings
      .filter((h: any) => {
        const qty = parseInt(h.quantity || 0);
        return qty > 0;
      })
      .map((h: any) => {
        const qty = parseInt(h.quantity || 0);
        const avgPrice = parseFloat(h.average_price || 0);
        return {
          symbol: h.trading_symbol || '',
          quantity: qty,
          buyPrice: avgPrice,
          currentPrice: 0, // Holdings API doesn't return current price
          pnl: 0,
          pnlPercent: 0,
        };
      });
  }

  // ──── Real-time (Polling-based) ────────────────────────────────────────

  /**
   * Subscribe to price ticks via polling.
   * Groww does not expose a documented WebSocket API for real-time ticks.
   * This implementation polls the Quote API at ~3s intervals as a fallback.
   */
  subscribeTicks(symbols: string[], onTick: (quote: MarketQuote) => void): () => void {
    this.requireAuth();

    let stopped = false;

    const interval = setInterval(async () => {
      if (stopped) return;

      for (const symbol of symbols) {
        try {
          const quote = await this.fetchQuote(symbol);
          if (quote) {
            onTick(quote);
          }
        } catch {
          // Silently skip failed polls for individual symbols
        }
      }
    }, TICK_POLL_INTERVAL);

    // Store the interval so it can be cleaned up
    for (const sym of symbols) {
      this.tickIntervals.set(sym, interval);
    }

    return () => {
      stopped = true;
      clearInterval(interval);
      for (const sym of symbols) {
        this.tickIntervals.delete(sym);
      }
    };
  }

  // ──── Private Helpers ──────────────────────────────────────────────────

  /**
   * Fetch a full MarketQuote for a trading symbol from Groww.
   */
  private async fetchQuote(symbol: string): Promise<MarketQuote | null> {
    const response = await this.rawGet(
      `${API_BASE}/live-data/quote?exchange=${DEFAULT_EXCHANGE}&segment=${DEFAULT_SEGMENT}&trading_symbol=${encodeURIComponent(symbol)}`,
    );

    if (!response?.payload) return null;

    const p = response.payload;
    const ltp = parseFloat(p.last_price || 0);
    const dayChange = parseFloat(p.day_change || 0);
    const dayChangePerc = parseFloat(p.day_change_perc || 0);

    // Parse OHLC string like "{open: 149.50, high: 150.50, low: 148.50, close: 149.50}"
    let ohlc = { open: ltp, high: ltp, low: ltp, close: ltp };
    if (p.ohlc) {
      const parsed = parseOHLCString(p.ohlc);
      if (parsed) ohlc = parsed;
    }

    // Use day_change as the difference from previous close
    const close = ohlc.close;
    const change = dayChange || (ltp - close);
    const changePercent = dayChangePerc || (close > 0 ? (change / close) * 100 : 0);

    // Timestamp from last_trade_time (epoch ms) or current time
    let timestamp = new Date().toISOString();
    if (p.last_trade_time) {
      timestamp = new Date(parseInt(p.last_trade_time, 10)).toISOString();
    }

    return {
      symbol,
      lastPrice: ltp,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      open: ohlc.open,
      high: ohlc.high,
      low: ohlc.low,
      close: ohlc.close,
      volume: parseInt(p.volume || 0),
      bid: parseFloat(p.bid_price || p.depth?.buy?.[0]?.price || ltp),
      ask: parseFloat(p.offer_price || p.depth?.sell?.[0]?.price || ltp),
      timestamp,
    };
  }

  /**
   * Convert a MarketQuote to a StockInfo.
   */
  private quoteToStockInfo(quote: MarketQuote): StockInfo {
    return {
      id: quote.symbol,
      symbol: quote.symbol,
      name: quote.symbol,
      sector: 'NSE',
      price: quote.lastPrice,
      change: quote.change,
      changePercent: quote.changePercent,
      isPositive: quote.change >= 0,
      marketCap: '',
      volume: String(quote.volume),
      high52: 0,
      low52: 0,
      pe: 0,
      pb: 0,
      dividend: 0,
    };
  }

  /**
   * Map Groww order status to our standard status.
   */
  private mapOrderStatus(growwStatus: string): 'pending' | 'confirmed' | 'rejected' | 'cancelled' {
    const s = (growwStatus || '').toUpperCase();
    if (s === 'OPEN' || s === 'PENDING' || s === 'TRIGGER_PENDING') return 'pending';
    if (s === 'COMPLETE' || s === 'COMPLETED' || s === 'FILLED') return 'confirmed';
    if (s === 'CANCELLED' || s === 'CANCELED') return 'cancelled';
    if (s === 'REJECTED' || s === 'FAILURE') return 'rejected';
    return 'pending';
  }

  // ──── Raw HTTP Helpers ─────────────────────────────────────────────────

  /**
   * Make an authenticated GET request to the Groww API.
   */
  private async rawGet(url: string): Promise<any> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
      'X-API-VERSION': '1.0',
    };

    const response = await fetch(url, { method: 'GET', headers });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`Groww API error (${response.status}): ${errorBody}`);
    }

    return response.json();
  }

  /**
   * Make an authenticated POST request to the Groww API.
   */
  private async rawPost(url: string, body: unknown): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
      'X-API-VERSION': '1.0',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`Groww API error (${response.status}): ${errorBody}`);
    }

    return response.json();
  }

  private requireAuth(): void {
    if (!this.connected) {
      throw new Error('Groww broker not authenticated. Call authenticate() first.');
    }
  }
}
