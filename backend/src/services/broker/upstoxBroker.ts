/**
 * ============================================================================
 * Toroloom — Upstox API Broker Implementation
 * ============================================================================
 *
 * Implements the IBroker interface for Upstox's REST API v2.
 * Uses OAuth 2.0 Authorization Code flow for authentication.
 *
 * API Docs: https://upstox.com/developer/api-documentation
 *
 * Endpoints:
 *   Auth:      POST /v2/login/authorization/token
 *   Holdings:  GET  /v2/portfolio/long-term-holdings
 *   Positions: GET  /v2/portfolio/short-term-positions
 *   Place Ord: POST /v2/order/place                  (api-hft.upstox.com)
 *   Modify:    PUT  /v2/order/modify                  (api-hft.upstox.com)
 *   Cancel:    DELETE /v2/order/cancel                (api-hft.upstox.com)
 *   Orders:    GET  /v2/order/retrieve-all
 *   Trades:    GET  /v2/order/trades
 *   Quote:     GET  /v2/market-quote/ltp
 *   OHLC:      GET  /v2/historical-candle/{symbol}/{interval}/{to_date}/{from_date}
 *
 * ============================================================================
 */

import {
  IBroker, BrokerConfig,
  MarketQuote, OHLCData, IndexData,
  StockInfo, OrderPayload, OrderResult,
  ModifyOrderPayload, CancelOrderPayload,
  OpenOrder, Position, TradeHistory,
} from './interface';

// ─── Constants ────────────────────────────────────────────────────────────

const UPSTOX_API_BASE = 'https://api.upstox.com/v2';
const UPSTOX_HFT_BASE = 'https://api-hft.upstox.com/v2';

/** OAuth authorize URL — redirect user here to log in */
const OAUTH_AUTHORIZE_URL = 'https://api.upstox.com/v2/login/authorization/dialog';

/** Mapping from our product types to Upstox product codes */
const PRODUCT_MAP: Record<string, string> = {
  CNC: 'I',   // Delivery (Invest)
  MIS: 'I',   // Intraday uses 'I' with day validity
  NRML: 'I',  // Normal
};

/** Mapping from our order types to Upstox order types */
const ORDER_TYPE_MAP: Record<string, string> = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
  SL: 'SL',
  SLM: 'SL-M',
};

// ─── Token Cache ──────────────────────────────────────────────────────────

/**
 * Simple LRU cache for instrument_key lookups.
 * Upstox uses instrument_key (exchange:symbol) for orders.
 */
class InstrumentCache {
  private cache = new Map<string, string>();
  private maxSize = 500;

  get(symbol: string): string | undefined {
    return this.cache.get(symbol.toUpperCase());
  }

  set(symbol: string, key: string): void {
    const k = symbol.toUpperCase();
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(k, key);
  }

  has(symbol: string): boolean {
    return this.cache.has(symbol.toUpperCase());
  }
}

// ─── UpstoxBroker ─────────────────────────────────────────────────────────

export class UpstoxBroker implements IBroker {
  readonly name = 'Upstox';

  private accessToken = '';
  private connected = false;

  /** Server-level credentials for OAuth token exchange */
  private clientId = '';
  private clientSecret = '';
  private redirectUri = '';

  /** Cache for instrument keys */
  private instrumentCache = new InstrumentCache();

  constructor() {}

  // ======================== Auth ========================

  /**
   * Authenticate with Upstox API.
   *
   * Config options:
   *   - accessToken (optional) — Existing access token (skip OAuth)
   *   - clientId     — Upstox API Client ID (required for OAuth token exchange)
   *   - clientSecret — Upstox API Client Secret (required for OAuth token exchange)
   *   - authCode     — OAuth authorization code (exchange for access token)
   *   - redirectUri  — OAuth redirect URI
   */
  async authenticate(config: BrokerConfig): Promise<boolean> {
    this.clientId = config.clientId || '';
    this.clientSecret = config.apiSecret || '';
    this.redirectUri = (config as any).redirectUri || '';

    // If we already have an access token, use it directly
    if (config.accessToken) {
      this.accessToken = config.accessToken;
      this.connected = true;
      console.log('[UpstoxBroker] Authenticated with existing access token');
      return true;
    }

    // If we have an auth code, exchange it for an access token
    if ((config as any).authCode && this.clientId && this.clientSecret && this.redirectUri) {
      try {
        const token = await this.exchangeAuthCode(
          (config as any).authCode,
          this.clientId,
          this.clientSecret,
          this.redirectUri,
        );
        this.accessToken = token;
        this.connected = true;
        console.log('[UpstoxBroker] Authenticated via OAuth token exchange');
        return true;
      } catch (err: any) {
        console.error('[UpstoxBroker] OAuth token exchange failed:', err.message);
        this.connected = false;
        return false;
      }
    }

    // Need at least an access token OR auth code + client credentials
    if (!this.accessToken) {
      console.error('[UpstoxBroker] No access token or auth code provided');
      this.connected = false;
      return false;
    }

    return true;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Build the OAuth authorize URL for redirecting the user.
   */
  static getOAuthUrl(clientId: string, redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
    });
    if (state) params.set('state', state);
    return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for an access token.
   */
  private async exchangeAuthCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<string> {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(`${UPSTOX_API_BASE}/login/authorization/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upstox OAuth token exchange failed: HTTP ${response.status} — ${errText}`);
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  // ======================== Helpers ========================

  /**
   * Ensure we are authenticated before making API calls.
   */
  private requireAuth(): void {
    if (!this.connected || !this.accessToken) {
      throw new Error('Upstox not authenticated. Call authenticate() first.');
    }
  }

  /**
   * Build authorization headers for Upstox API calls.
   */
  private authHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
      ...(extra || {}),
    };
  }

  /**
   * Build the instrument_key for a given symbol and exchange.
   * Upstox uses "NSE_EQ|RELIANCE" format.
   */
  private buildInstrumentKey(symbol: string, exchange: string = 'NSE'): string {
    const upperSym = symbol.toUpperCase();
    const cached = this.instrumentCache.get(upperSym);
    if (cached) return cached;

    // Build the key based on exchange
    let key: string;
    switch (exchange.toUpperCase()) {
      case 'NSE':
        key = `NSE_EQ|${upperSym}`;
        break;
      case 'BSE':
        key = `BSE_EQ|${upperSym}`;
        break;
      case 'NFO':
        key = `NFO|${upperSym}`;
        break;
      case 'MCX':
        key = `MCX|${upperSym}`;
        break;
      default:
        key = `NSE_EQ|${upperSym}`;
    }

    this.instrumentCache.set(upperSym, key);
    return key;
  }

  /**
   * Generic GET request to Upstox API.
   */
  private async apiGet<T>(path: string, base?: string): Promise<T> {
    this.requireAuth();
    const baseUrl = base || UPSTOX_API_BASE;
    const url = `${baseUrl}${path}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.authHeaders(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upstox API error (GET ${path}): HTTP ${response.status} — ${errText}`);
    }

    const json = await response.json();
    return json as T;
  }

  /**
   * Generic POST request to Upstox API.
   */
  private async apiPost<T>(path: string, body: any, base?: string): Promise<T> {
    this.requireAuth();
    const baseUrl = base || UPSTOX_API_BASE;
    const url = `${baseUrl}${path}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upstox API error (POST ${path}): HTTP ${response.status} — ${errText}`);
    }

    const json = await response.json();
    return json as T;
  }

  /**
   * Generic PUT request to Upstox API.
   */
  private async apiPut<T>(path: string, body: any, base?: string): Promise<T> {
    this.requireAuth();
    const baseUrl = base || UPSTOX_API_BASE;
    const url = `${baseUrl}${path}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upstox API error (PUT ${path}): HTTP ${response.status} — ${errText}`);
    }

    const json = await response.json();
    return json as T;
  }

  /**
   * Generic DELETE request to Upstox API.
   */
  private async apiDelete<T>(path: string, base?: string): Promise<T> {
    this.requireAuth();
    const baseUrl = base || UPSTOX_API_BASE;
    const url = `${baseUrl}${path}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upstox API error (DELETE ${path}): HTTP ${response.status} — ${errText}`);
    }

    const json = await response.json();
    return json as T;
  }

  // ======================== Market Data ========================

  /**
   * Get a quote for an index symbol using NSE_INDEX| prefix.
   * Upstox uses "NSE_INDEX|Nifty 50" format for indices.
   */
  private async getIndexQuote(symbol: string): Promise<MarketQuote> {
    const upperSym = symbol.toUpperCase();
    const indexKey = `NSE_INDEX|${symbol}`;

    // Temporarily set the index key in cache so getQuote's buildInstrumentKey finds it
    // This is cleaner than modifying buildInstrumentKey to know about indices
    const prevCached = this.instrumentCache.get(upperSym);
    this.instrumentCache.set(upperSym, indexKey);

    try {
      return await this.getQuote(symbol);
    } catch {
      // Restore previous cache entry on failure
      if (prevCached) {
        this.instrumentCache.set(upperSym, prevCached);
      }
      throw new Error(`Failed to fetch index quote for ${symbol}`);
    }
  }

  async getIndices(): Promise<IndexData[]> {
    // Upstox uses NSE_INDEX| format for indices, not NSE_EQ|
    const symbols = ['NIFTY 50', 'BANKNIFTY', 'SENSEX'];
    const results: IndexData[] = [];

    for (const sym of symbols) {
      try {
        const quote = await this.getIndexQuote(sym);
        results.push({
          id: sym,
          name: sym,
          shortName: sym,
          currentValue: quote.lastPrice,
          change: quote.change,
          changePercent: quote.changePercent,
          isPositive: quote.change >= 0,
        });
      } catch {
        // Skip if quote fails
      }
    }

    return results;
  }

  async getStocks(): Promise<StockInfo[]> {
    // Upstox doesn't have a "get all stocks" endpoint.
    // Return a subset of popular stocks by fetching quotes.
    const commonSymbols = [
      'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
      'HINDUNILVR', 'BHARTIARTL', 'SBIN', 'TATAMOTORS', 'BAJFINANCE',
    ];

    const results = await Promise.allSettled(commonSymbols.map(s => this.getQuoteInfo(s)));
    return results
      .filter((r): r is PromiseFulfilledResult<StockInfo> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  /**
   * Fetch quote info as a StockInfo object.
   */
  private async getQuoteInfo(symbol: string): Promise<StockInfo> {
    const quote = await this.getQuote(symbol);
    return {
      id: symbol,
      symbol,
      name: symbol,
      sector: '',
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

  async getQuote(symbol: string): Promise<MarketQuote> {
    const upperSym = symbol.toUpperCase();
    const exchange = upperSym.startsWith('NIFTY') || upperSym.startsWith('SENSEX') ? 'NSE' : 'NSE';
    const instrumentKey = this.buildInstrumentKey(upperSym, exchange);

    // Use LTP endpoint
    interface LtpResponse {
      status: string;
      data: Record<string, {
        instrument_token: string;
        symbol: string;
        last_price: number;
        change: number;
        ohlc: { open: number; high: number; low: number; close: number };
        volume: number;
        timestamp: string;
      }>;
    }

    const ltpData = await this.apiGet<LtpResponse>(
      `/market-quote/ltp?instrument_key=${encodeURIComponent(instrumentKey)}`,
    );

    const entry = ltpData.data?.[instrumentKey];
    if (!entry) {
      throw new Error(`No quote data for ${symbol}`);
    }

    return {
      symbol: upperSym,
      lastPrice: entry.last_price,
      change: entry.change,
      changePercent: entry.last_price > 0
        ? (entry.change / (entry.last_price - entry.change)) * 100
        : 0,
      open: entry.ohlc?.open || entry.last_price,
      high: entry.ohlc?.high || entry.last_price,
      low: entry.ohlc?.low || entry.last_price,
      close: entry.ohlc?.close || entry.last_price,
      volume: entry.volume || 0,
      bid: entry.last_price,
      ask: entry.last_price,
      timestamp: entry.timestamp || new Date().toISOString(),
    };
  }

  async getBulkQuotes(symbols: string[]): Promise<Map<string, MarketQuote>> {
    const map = new Map<string, MarketQuote>();
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
    const upperSym = symbol.toUpperCase();
    const instrumentKey = this.buildInstrumentKey(upperSym);

    const toDate = new Date();
    const fromDate = new Date(Date.now() - days * 86400000);

    const formatDate = (d: Date): string => {
      return d.toISOString().split('T')[0]; // YYYY-MM-DD
    };

    // Upstox historical candle endpoint
    interface CandleResponse {
      status: string;
      data: {
        candles: [string, number, number, number, number, number, number][];
      };
    }

    const intervalMap: Record<string, string> = {
      '1m': '1minute',
      '5m': '5minute',
      '15m': '15minute',
      '30m': '30minute',
      '60m': '60minute',
      '1d': '1day',
      '1w': '1week',
      '1M': '1month',
    };

    const upstoxInterval = intervalMap[interval] || '1day';
    const toStr = formatDate(toDate);
    const fromStr = formatDate(fromDate);

    const encodedKey = encodeURIComponent(instrumentKey);
    const path = `/historical-candle/${encodedKey}/${upstoxInterval}/${toStr}/${fromStr}`;

    const response = await this.apiGet<CandleResponse>(path);

    if (!response.data?.candles || !Array.isArray(response.data.candles)) {
      return [];
    }

    // Each candle: [timestamp, open, high, low, close, volume, open_interest]
    return response.data.candles.map((candle) => ({
      date: new Date(candle[0]).toISOString(),
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5] || 0,
    }));
  }

  async searchStocks(query: string): Promise<StockInfo[]> {
    // Upstox doesn't have a search endpoint in v2.
    // Fall back to fetching known stocks that match the query.
    try {
      const quote = await this.getQuote(query);
      const info = await this.getQuoteInfo(query);
      return [info];
    } catch {
      // Also try searching across popular stocks
      const common = [
        'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
        'HINDUNILVR', 'BHARTIARTL', 'SBIN', 'TATAMOTORS', 'BAJFINANCE',
      ];
      const q = query.toUpperCase();
      const matching = common.filter(s => s.includes(q));
      const results = await Promise.allSettled(matching.map(s => this.getQuoteInfo(s)));
      return results
        .filter((r): r is PromiseFulfilledResult<StockInfo> => r.status === 'fulfilled')
        .map(r => r.value);
    }
  }

  // ======================== Portfolio ========================

  async getHoldings(): Promise<Position[]> {
    interface HoldingsResponse {
      status: string;
      data: {
        holdings: Array<{
          symbol: string;
          quantity: number;
          buy_price: number;
          ltp: number;
          pnl: number;
          product: string;
          exchange: string;
        }>;
      };
    }

    const response = await this.apiGet<HoldingsResponse>('/portfolio/long-term-holdings');

    if (!response.data?.holdings) return [];

    return response.data.holdings.map((h) => ({
      symbol: h.symbol,
      quantity: h.quantity,
      buyPrice: h.buy_price,
      currentPrice: h.ltp,
      pnl: h.pnl,
      pnlPercent: h.buy_price > 0 ? ((h.ltp - h.buy_price) / h.buy_price) * 100 : 0,
    }));
  }

  async getPositions(): Promise<Position[]> {
    interface PositionsResponse {
      status: string;
      data: {
        positions: Array<{
          symbol: string;
          quantity: number;
          buy_price: number;
          ltp: number;
          pnl: number;
          product: string;
          exchange: string;
          day_buy_price: number;
          day_sell_price: number;
        }>;
      };
    }

    const response = await this.apiGet<PositionsResponse>('/portfolio/short-term-positions');

    if (!response.data?.positions) return [];

    return response.data.positions
      .filter((p) => p.quantity !== 0)
      .map((p) => ({
        symbol: p.symbol,
        quantity: p.quantity,
        buyPrice: p.buy_price,
        currentPrice: p.ltp,
        pnl: p.pnl,
        pnlPercent: p.buy_price > 0 ? ((p.ltp - p.buy_price) / p.buy_price) * 100 : 0,
      }));
  }

  async getTradeHistory(): Promise<TradeHistory[]> {
    interface TradesResponse {
      status: string;
      data: Array<{
        trade_id: string;
        symbol: string;
        transaction_type: 'BUY' | 'SELL';
        quantity: number;
        price: number;
        trade_value: number;
        trade_time: string;
      }>;
    }

    const response = await this.apiGet<TradesResponse>('/order/trades');

    if (!response.data) return [];

    return response.data.map((t) => ({
      id: t.trade_id,
      symbol: t.symbol,
      type: t.transaction_type === 'BUY' ? 'buy' : 'sell',
      quantity: t.quantity,
      price: t.price,
      total: t.trade_value,
      timestamp: t.trade_time,
    }));
  }

  // ======================== Trading ========================

  async placeOrder(order: OrderPayload): Promise<OrderResult> {
    const instrumentKey = this.buildInstrumentKey(order.symbol, order.exchange);

    interface PlaceOrderResponse {
      status: string;
      data: {
        order_id: string;
      };
    }

    const payload: Record<string, any> = {
      instrument_key: instrumentKey,
      quantity: order.quantity,
      product: PRODUCT_MAP[order.productType] || 'I',
      validity: 'DAY',
      price: order.orderType === 'MARKET' ? 0 : order.price,
      order_type: ORDER_TYPE_MAP[order.orderType] || 'MARKET',
      transaction_type: order.transactionType,
    };

    const response = await this.apiPost<PlaceOrderResponse>(
      '/order/place',
      payload,
      UPSTOX_HFT_BASE,
    );

    if (!response.data?.order_id) {
      throw new Error('Upstox placeOrder returned no order_id');
    }

    return {
      id: response.data.order_id,
      status: 'pending',
      message: `Order placed: ${response.data.order_id}`,
      timestamp: new Date().toISOString(),
    };
  }

  async modifyOrder(order: ModifyOrderPayload): Promise<OrderResult> {
    const instrumentKey = order.symbol
      ? this.buildInstrumentKey(order.symbol, order.exchange || 'NSE')
      : '';

    interface ModifyOrderResponse {
      status: string;
      data: {
        order_id: string;
      };
    }

    const payload: Record<string, any> = {
      order_id: order.orderId,
    };

    if (instrumentKey) payload.instrument_key = instrumentKey;
    if (order.quantity !== undefined) payload.quantity = order.quantity;
    if (order.price !== undefined) payload.price = order.price;
    if (order.orderType) payload.order_type = ORDER_TYPE_MAP[order.orderType] || 'LIMIT';
    if (order.productType) payload.product = PRODUCT_MAP[order.productType] || 'I';
    if (order.triggerPrice !== undefined) payload.trigger_price = order.triggerPrice;

    const response = await this.apiPut<ModifyOrderResponse>(
      '/order/modify',
      payload,
      UPSTOX_HFT_BASE,
    );

    return {
      id: order.orderId,
      status: response.status === 'success' ? 'confirmed' : 'rejected',
      message: `Order ${order.orderId} modified`,
      timestamp: new Date().toISOString(),
    };
  }

  async cancelOrder(order: CancelOrderPayload): Promise<OrderResult> {
    interface CancelOrderResponse {
      status: string;
      data: {
        order_id: string;
      };
    }

    const response = await this.apiDelete<CancelOrderResponse>(
      `/order/cancel?order_id=${order.orderId}`,
      UPSTOX_HFT_BASE,
    );

    return {
      id: order.orderId,
      status: 'cancelled',
      message: `Order ${order.orderId} cancelled`,
      timestamp: new Date().toISOString(),
    };
  }

  async getOpenOrders(): Promise<OpenOrder[]> {
    interface OrdersResponse {
      status: string;
      data: Array<{
        order_id: string;
        symbol: string;
        exchange: string;
        transaction_type: 'BUY' | 'SELL';
        quantity: number;
        filled_quantity: number;
        price: number;
        trigger_price?: number;
        product: string;
        order_type: string;
        status: string;
        order_timestamp: string;
        validity: string;
      }>;
    }

    const response = await this.apiGet<OrdersResponse>('/order/retrieve-all');

    if (!response.data) return [];

    // Filter for open/pending orders
    const openStatuses = ['open', 'pending', 'trigger_pending', 'partially_filled'];
    return response.data
      .filter((o) => openStatuses.includes(o.status?.toLowerCase() || ''))
      .map((o) => ({
        id: o.order_id,
        symbol: o.symbol,
        exchange: o.exchange || 'NSE',
        transactionType: o.transaction_type === 'BUY' ? 'BUY' as const : 'SELL' as const,
        quantity: o.quantity,
        filledQuantity: o.filled_quantity || 0,
        price: o.price || 0,
        triggerPrice: o.trigger_price,
        productType: o.product || 'I',
        orderType: o.order_type || 'MARKET',
        status: this.mapOrderStatus(o.status),
        placedBy: 'upstox',
        timestamp: o.order_timestamp || new Date().toISOString(),
        validity: o.validity || 'DAY',
      }));
  }

  private mapOrderStatus(status: string): 'open' | 'pending' | 'partially_filled' | 'trigger_pending' {
    const s = (status || '').toLowerCase();
    if (s === 'open') return 'open';
    if (s === 'trigger_pending' || s === 'triggered') return 'trigger_pending';
    if (s === 'partially_filled' || s === 'partial_fill') return 'partially_filled';
    return 'pending';
  }

  // ======================== WebSocket (stub) ========================

  subscribeTicks(
    _symbols: string[],
    _onTick: (quote: MarketQuote) => void,
  ): () => void {
    // Upstox WebSocket requires a separate connection using WebSocket URL:
    // wss://api.upstox.com/v2/feed/market-data-feed/websocket
    // with Authorization header.
    // For now, return a no-op unsubscribe function.
    console.warn('[UpstoxBroker] WebSocket ticks not yet implemented');
    return () => {};
  }
}
