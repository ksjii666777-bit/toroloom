/**
 * Angel One SmartAPI Broker Implementation
 *
 * This implementation uses the official `smartapi-javascript` SDK.
 *
 * To use:
 * 1. Install: npm install smartapi-javascript
 * 2. Set env vars: BROKER=angel, plus your Angel One API credentials
 *
 * Required env vars (if no accessToken):
 *   ANGEL_CLIENT_ID=your_client_id
 *   ANGEL_API_KEY=your_api_key
 *   ANGEL_PASSWORD=your_password
 *   ANGEL_TOTP=your_base32_totp_secret  (required for 2FA — Base32 secret key, not the 6-digit code)
 *
 * If you already have an access token:
 *   ANGEL_CLIENT_ID=your_client_id
 *   ANGEL_API_KEY=your_api_key
 *   ANGEL_ACCESS_TOKEN=your_jwt_token
 *
 * API Docs: https://github.com/angel-one/smartapi-javascript
 */

import speakeasy from 'speakeasy';

import {
  IBroker, BrokerConfig, MarketQuote, OHLCData, IndexData,
  StockInfo, OrderPayload, OrderResult, ModifyOrderPayload,
  CancelOrderPayload, OpenOrder, Position, TradeHistory,
  EDISVerifyRequest, EDISVerifyResponse,
  EDISGenerateTPINRequest,
  EDISTranStatusRequest, EDISTranStatusResponse,
  BrokerageEstimateRequest, BrokerageEstimateResponse,
} from './interface';

// Known index tokens for Angel One SmartAPI
// These are standard across all Angel One accounts
const INDEX_TOKENS: Record<string, { token: string; name: string; shortName: string }> = {
  'NIFTY 50':     { token: '99926000', name: 'Nifty 50', shortName: 'NIFTY' },
  'NIFTY BANK':   { token: '99926009', name: 'Bank Nifty', shortName: 'BANKNIFTY' },
  'SENSEX':       { token: '99926001', name: 'BSE Sensex', shortName: 'SENSEX' },
  'NIFTY MIDCAP': { token: '99926007', name: 'Nifty Midcap 100', shortName: 'MIDCAP' },
};

// Default indices to fetch on startup
const DEFAULT_INDICES = ['NIFTY 50', 'NIFTY BANK', 'SENSEX', 'NIFTY MIDCAP'];

/**
 * Simple LRU cache for symbol → token lookups to avoid repeated searchScrip calls.
 */
class TokenCache {
  private cache = new Map<string, string>();
  private maxSize = 500;

  get(symbol: string): string | undefined {
    return this.cache.get(symbol.toUpperCase());
  }

  set(symbol: string, token: string): void {
    const key = symbol.toUpperCase();
    if (this.cache.size >= this.maxSize) {
      // Delete oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, token);
  }

  has(symbol: string): boolean {
    return this.cache.has(symbol.toUpperCase());
  }
}

export class AngelBroker implements IBroker {
  readonly name = 'Angel One SmartAPI';
  private connected = false;
  private clientCode = '';
  private apiKey = '';
  private accessToken = '';
  private password = '';
  private totp = '';
  private feedToken = '';

  // Cache mapping symbol → symboltoken
  private tokenCache = new TokenCache();

  // SmartAPI instance — typed loosely because smartapi-javascript doesn't ship TS types
  private smartApi: any = null;
  // WebSocketV2 instance
  private wsClient: any = null;

  // Additional headers for raw REST calls (EDIS, Brokerage, etc.)
  private clientLocalIP = '127.0.0.1';
  private clientPublicIP = '127.0.0.1';
  private macAddress = '00:00:00:00:00:00';
  private appId = '';

  /**
   * Optional SDK dependency override for testing.
   * When provided, the broker uses these instead of calling require().
   */
  constructor(private sdk?: { SmartAPI?: any; WebSocketV2?: any }) {}

  /**
   * Load the SmartAPI SDK module. Uses the injected dependency if available,
   * otherwise falls back to dynamic require().
   */
  private loadSmartAPI(): any {
    if (this.sdk?.SmartAPI) return this.sdk.SmartAPI;
    return require('smartapi-javascript').SmartAPI;
  }

  /**
   * Load the WebSocketV2 SDK module. Uses the injected dependency if available,
   * otherwise falls back to dynamic require().
   */
  private loadWebSocketV2(): any {
    if (this.sdk?.WebSocketV2) return this.sdk.WebSocketV2;
    return require('smartapi-javascript').WebSocketV2;
  }

  // ======================== Auth ========================

  async authenticate(config: BrokerConfig): Promise<boolean> {
    this.clientCode = config.clientId || '';
    this.apiKey = config.apiKey;
    this.accessToken = config.accessToken || '';
    this.password = (config as any).password || '';
    this.totp = (config as any).totp || '';

    if (!this.apiKey) throw new Error('Angel One API key is required');
    if (!this.clientCode) throw new Error('Angel One client ID is required');

    try {
      const SmartAPIClass = this.loadSmartAPI();
      this.smartApi = new SmartAPIClass({ api_key: this.apiKey });

      if (this.accessToken) {
        // Use existing access token
        this.smartApi.setAccessToken(this.accessToken);
      } else {
        // Generate new session
        if (!this.password) throw new Error('Angel One password is required to generate session');

        // Generate the 6-digit TOTP code from the Base32 secret key.
        // The smartapi-javascript SDK expects a current 6-digit code,
        // NOT the Base32 secret itself. We use speakeasy to compute it:
        let totpCode: string | undefined;
        if (this.totp) {
          try {
            totpCode = speakeasy.totp({
              secret: this.totp,
              encoding: 'base32',
            });
          } catch (err) {
            console.warn('[AngelBroker] Could not generate TOTP code from secret:', (err as Error).message);
          }
        }

        const session = await this.smartApi.generateSession(
          this.clientCode,
          this.password,
          totpCode,
        );
        this.accessToken = session.data.jwtToken;
        this.feedToken = session.data.feedToken || '';
        this.smartApi.setAccessToken(this.accessToken);
      }

      // Store optional REST headers
      this.clientLocalIP = (config as any).clientLocalIP || '127.0.0.1';
      this.clientPublicIP = (config as any).clientPublicIP || '127.0.0.1';
      this.macAddress = (config as any).macAddress || '00:00:00:00:00:00';
      this.appId = (config as any).appId || '';

      // Set up session expiry hook for auto-reconnect
      // When the JWT token expires, this hook fires. We set connected=false
      // and requireAuth() will trigger re-authentication on the next API call.
      this.smartApi.setSessionExpiryHook(() => {
        console.warn('[AngelBroker] Session token expired — will re-authenticate on next API call');
        this.connected = false;
      });

      this.connected = true;
      console.log(`[AngelBroker] Authenticated successfully (client: ${this.clientCode})`);
      return true;
    } catch (error: any) {
      console.error('[AngelBroker] Authentication failed:', error.message);
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ======================== Token Resolution ========================

  /**
   * Resolve a trading symbol to its Angel One symboltoken.
   * Uses an in-memory cache and falls back to searchScrip.
   */
  private async resolveToken(symbol: string, exchange: string = 'NSE'): Promise<string> {
    const cached = this.tokenCache.get(symbol);
    if (cached) return cached;

    try {
      const rawResult = await this.smartApi.searchScrip({
        exchange,
        searchscrip: symbol,
      });

      // SDK's searchScrip returns the data array directly on success,
      // so check both `rawResult` (array) and `rawResult?.data` (fallback).
      const list: any[] = Array.isArray(rawResult) ? rawResult : (rawResult?.data || []);

      if (list.length > 0) {
        const match = list.find(
          (s: any) => s.tradingsymbol?.toUpperCase() === symbol.toUpperCase() || s.symbol?.toUpperCase() === symbol.toUpperCase(),
        ) || list[0];

        const token = match.symboltoken || match.token;
        if (token) {
          this.tokenCache.set(symbol, String(token));
          return String(token);
        }
      }
    } catch (err) {
      // Fall through
    }

    throw new Error(`Could not resolve symbol token for: ${symbol}`);
  }

  // ======================== Market Data ========================

  async getIndices(): Promise<IndexData[]> {
    await this.requireAuth();
    const results: IndexData[] = [];

    for (const indexName of DEFAULT_INDICES) {
      const info = INDEX_TOKENS[indexName];
      if (!info) continue;

      try {
        // Use marketData (the correct SDK method name) instead of the non-existent ltpData
        const quoteResult = await this.smartApi.marketData({
          mode: 'FULL',
          exchangeTokens: { 'NSE': [info.token] },
        });

        const fetched = quoteResult?.data?.fetched || [];
        const q = fetched[0];

        if (q) {
          const ltp = q.ltp || q.last_price || 0;

          // marketData returns OHLC values — no need for separate candle fetch
          const open = q.open || ltp;
          const close = q.close || ltp;
          const change = q.net_change || q.change || (ltp - close);
          const changePercent = q.percentage_change || (close > 0 ? (change / close) * 100 : 0);

          results.push({
            id: info.shortName,
            name: info.name,
            shortName: info.shortName,
            currentValue: ltp,
            change: Math.round(change * 100) / 100,
            changePercent: Math.round(changePercent * 100) / 100,
            isPositive: change >= 0,
          });
        }
      } catch (err) {
        console.warn(`[AngelBroker] Failed to fetch index ${indexName}:`, (err as Error).message);
      }
    }

    return results;
  }

  async getStocks(): Promise<StockInfo[]> {
    await this.requireAuth();
    // Angel One doesn't have a direct "get all stocks" method.
    // In production, you'd download & parse the master contract CSV.
    // For now, return a subset via searchScrip with common stocks.
    const commonSymbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
      'HINDUNILVR', 'BHARTIARTL', 'SBIN', 'TATAMOTORS', 'BAJFINANCE'];

    // Fetch all quotes in parallel for better performance
    const results = await Promise.allSettled(commonSymbols.map(sym => this.getQuote(sym)));

    return results
      .filter((r): r is PromiseFulfilledResult<MarketQuote> => r.status === 'fulfilled')
      .map((r) => ({
        id: r.value.symbol,
        symbol: r.value.symbol,
        name: r.value.symbol,
        sector: '',
        price: r.value.lastPrice,
        change: r.value.change,
        changePercent: r.value.changePercent,
        isPositive: r.value.change >= 0,
        marketCap: '',
        volume: String(r.value.volume),
        high52: 0,
        low52: 0,
        pe: 0,
        pb: 0,
        dividend: 0,
      }));
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    await this.requireAuth();
    const token = await this.resolveToken(symbol);

    // Use marketData (the correct SDK method) instead of the non-existent ltpData
    const quoteResult = await this.smartApi.marketData({
      mode: 'FULL',
      exchangeTokens: { 'NSE': [token] },
    });

    const fetched = quoteResult?.data?.fetched || [];
    const q = fetched[0];
    if (!q) throw new Error(`No quote data for ${symbol}`);

    const ltp = q.ltp || q.last_price || 0;
    const open = q.open || ltp;
    const high = q.high || ltp;
    const low = q.low || ltp;
    const close = q.close || ltp;
    const volume = q.volume || q.volume_traded || 0;
    const change = q.net_change || q.change || (ltp - close);
    const changePercent = q.percentage_change || (close > 0 ? (change / close) * 100 : 0);

    return {
      symbol,
      lastPrice: ltp,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      open,
      high,
      low,
      close,
      volume,
      bid: q.bid_price || q.bid || ltp,
      ask: q.ask_price || q.ask || ltp,
      timestamp: q.exch_tm || q.exch_time || new Date().toISOString(),
    };
  }

  async getBulkQuotes(symbols: string[]): Promise<Map<string, MarketQuote>> {
    await this.requireAuth();
    const map = new Map<string, MarketQuote>();
    const results = await Promise.allSettled(symbols.map(s => this.getQuote(s)));
    for (let i = 0; i < symbols.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        map.set(symbols[i], result.value);
      }
    }
    return map;
  }

  async getOHLC(symbol: string, interval: string, days: number): Promise<OHLCData[]> {
    await this.requireAuth();
    const token = await this.resolveToken(symbol);

    // Map our interval strings to Angel One intervals
    const intervalMap: Record<string, string> = {
      '1m': 'ONE_MINUTE',
      '5m': 'FIVE_MINUTE',
      '15m': 'FIFTEEN_MINUTE',
      '30m': 'THIRTY_MINUTE',
      '60m': 'ONE_HOUR',
      '1d': 'ONE_DAY',
      '1w': 'ONE_WEEK',
    };

    const angelInterval = intervalMap[interval] || 'ONE_DAY';
    const toDate = new Date();
    const fromDate = new Date(Date.now() - days * 86400000);

    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day} ${h}:${min}`;
    };

    const data = await this.smartApi.getCandleData({
      exchange: 'NSE',
      symboltoken: token,
      interval: angelInterval,
      fromdate: formatDate(fromDate),
      todate: formatDate(toDate),
    });

    if (!data?.data || !Array.isArray(data.data)) return [];

    // Angel One returns candles as arrays: [timestamp, open, high, low, close, volume]
    return data.data.map((candle: any[]) => ({
      date: new Date(candle[0]).toISOString(),
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5] || 0,
    }));
  }

  async searchStocks(query: string): Promise<StockInfo[]> {
    await this.requireAuth();

    const rawResult = await this.smartApi.searchScrip({
      exchange: 'NSE',
      searchscrip: query,
    });

    // SDK's searchScrip returns the data array directly on success
    const list: any[] = Array.isArray(rawResult) ? rawResult : (rawResult?.data || []);
    if (list.length === 0) return [];

    // Fetch price data for each result using marketData
    const stocks: StockInfo[] = [];
    const priceResults = await Promise.allSettled(
      list.map(async (s: any) => {
        const symbol = s.tradingsymbol || s.symbol || '';
        const token = s.symboltoken || s.token || '';
        if (!symbol || !token) return null;

        let price = 0, change = 0, changePercent = 0;
        try {
          const quoteResult = await this.smartApi.marketData({
            mode: 'LTP',
            exchangeTokens: { 'NSE': [token] },
          });
          const fetched = quoteResult?.data?.fetched || [];
          const q = fetched[0];
          if (q) {
            price = q.ltp || q.last_price || 0;
            change = q.net_change || q.change || 0;
            changePercent = q.percentage_change || 0;
          }
        } catch {
          // Price fetch best-effort
        }

        return {
          id: token,
          symbol,
          name: s.name || s.symbol || symbol,
          sector: s.exchange || 'NSE',
          price,
          change,
          changePercent,
          isPositive: change >= 0,
          marketCap: '',
          volume: String(s.volume || s.vol_traded || 0),
          high52: 0,
          low52: 0,
          pe: 0,
          pb: 0,
          dividend: 0,
        };
      })
    );

    for (const r of priceResults) {
      if (r.status === 'fulfilled' && r.value) {
        stocks.push(r.value);
      }
    }
    return stocks;
  }

  // ======================== Trading ========================

  async getOpenOrders(): Promise<OpenOrder[]> {
    await this.requireAuth();
    const result = await this.smartApi.getOrderBook();

    if (!result?.data || !Array.isArray(result.data)) return [];

    return result.data
      .filter((o: any) => {
        const status = (o.order_status || o.status || '').toUpperCase();
        return status === 'OPEN' || status === 'PENDING' || status === 'TRIGGER_PENDING' || status === 'PARTIALLY_FILLED';
      })
      .map((o: any) => ({
        id: String(o.orderid || o.order_id || `ang_${Date.now()}`),
        symbol: o.tradingsymbol || o.symbol || '',
        exchange: o.exchange || 'NSE',
        transactionType: (o.transactiontype || o.transaction_type || 'BUY').toUpperCase() as 'BUY' | 'SELL',
        quantity: parseInt(o.quantity || o.qty || 0),
        filledQuantity: parseInt(o.filledqty || o.filled_quantity || 0),
        price: parseFloat(o.price || 0),
        triggerPrice: o.trigger_price ? parseFloat(o.trigger_price) : undefined,
        productType: o.producttype || o.product_type || 'CNC',
        orderType: o.ordertype || o.order_type || 'MARKET',
        status: this.mapAngelOrderStatus(o),
        placedBy: o.placedby || 'WEB',
        timestamp: o.exch_tm || o.exchange_time || o.order_timestamp || new Date().toISOString(),
        validity: o.validity || 'DAY',
      }));
  }

  private mapAngelOrderStatus(o: any): 'open' | 'pending' | 'partially_filled' | 'trigger_pending' {
    const status = (o.order_status || o.status || '').toUpperCase();
    if (status === 'OPEN') return 'open';
    if (status === 'TRIGGER_PENDING') return 'trigger_pending';
    if (status === 'PARTIALLY_FILLED' || status === 'PARTFILLED') return 'partially_filled';
    return 'pending';
  }

  async modifyOrder(order: ModifyOrderPayload): Promise<OrderResult> {
    await this.requireAuth();
    const token = order.symbol ? await this.resolveToken(order.symbol, order.exchange || 'NSE') : '';

    const result = await this.smartApi.modifyOrder({
      orderid: order.orderId,
      variety: 'NORMAL',
      tradingsymbol: order.symbol || '',
      symboltoken: token,
      exchange: order.exchange || 'NSE',
      ordertype: order.orderType === 'MARKET' ? 'MARKET' : order.orderType === 'LIMIT' ? 'LIMIT' : 'MARKET',
      producttype: order.productType ? ({
        'CNC': 'DELIVERY',
        'MIS': 'INTRADAY',
        'NRML': 'NORMAL',
      }[order.productType] || 'DELIVERY') : undefined,
      price: order.price !== undefined ? String(order.price) : undefined,
      quantity: order.quantity !== undefined ? String(order.quantity) : undefined,
      triggerprice: order.triggerPrice !== undefined ? String(order.triggerPrice) : undefined,
      duration: 'DAY',
    });

    if (!result) throw new Error('Angel One modifyOrder returned no result');

    return {
      id: order.orderId,
      status: result.status === 'success' ? 'confirmed' : 'rejected',
      message: result.message || result.data?.message || `Order ${order.orderId} modified`,
      timestamp: new Date().toISOString(),
    };
  }

  async cancelOrder(order: CancelOrderPayload): Promise<OrderResult> {
    await this.requireAuth();

    const result = await this.smartApi.cancelOrder({
      variety: 'NORMAL',
      orderid: order.orderId,
    });

    if (!result) throw new Error('Angel One cancelOrder returned no result');

    return {
      id: order.orderId,
      status: 'cancelled',
      message: result.message || `Order ${order.orderId} cancelled`,
      timestamp: new Date().toISOString(),
    };
  }

  async placeOrder(order: OrderPayload): Promise<OrderResult> {
    await this.requireAuth();
    const token = await this.resolveToken(order.symbol, order.exchange);

    const exchangeMap: Record<string, string> = {
      'NSE': 'NSE',
      'BSE': 'BSE',
      'NFO': 'NFO',
      'MCX': 'MCX',
    };

    const productMap: Record<string, string> = {
      'CNC': 'DELIVERY',
      'MIS': 'INTRADAY',
      'NRML': 'NORMAL',
    };

    const result = await this.smartApi.placeOrder({
      variety: 'NORMAL',
      tradingsymbol: order.symbol,
      symboltoken: token,
      exchange: exchangeMap[order.exchange] || 'NSE',
      transactiontype: order.transactionType,
      ordertype: order.orderType === 'MARKET' ? 'MARKET' : order.orderType === 'LIMIT' ? 'LIMIT' : 'MARKET',
      producttype: productMap[order.productType] || 'DELIVERY',
      duration: 'DAY',
      price: String(order.price),
      quantity: String(order.quantity),
      squareoff: '0',
      stoploss: '0',
    });

    if (!result) throw new Error('Angel One placeOrder returned no result');

    const orderId = result.data?.orderid || result.data?.order_id || `ang_${Date.now()}`;
    const status = result.status === 'success' ? 'confirmed' : result.message?.includes('reject') ? 'rejected' : 'pending';

    return {
      id: orderId,
      status,
      message: result.message || result.data?.message || `Order ${result.status}`,
      timestamp: new Date().toISOString(),
    };
  }

  async getPositions(): Promise<Position[]> {
    await this.requireAuth();
    const result = await this.smartApi.getPosition();

    if (!result?.data || !Array.isArray(result.data)) return [];

    return result.data
      .filter((p: any) => p.quantity && parseInt(p.quantity) !== 0)
      .map((p: any) => ({
        symbol: p.tradingsymbol || p.symbol || '',
        quantity: parseInt(p.quantity) || 0,
        buyPrice: parseFloat(p.buy_price || p.average_price || p.buyprice || 0),
        currentPrice: parseFloat(p.ltp || p.last_price || p.current_price || 0),
        pnl: parseFloat(p.pnl || p.profit_and_loss || 0),
        pnlPercent: parseFloat(p.pnl_percentage || p.pnlpercent || 0),
      }));
  }

  async getTradeHistory(): Promise<TradeHistory[]> {
    await this.requireAuth();
    const result = await this.smartApi.getTradeBook();

    if (!result?.data || !Array.isArray(result.data)) return [];

    return result.data.map((t: any) => ({
      id: String(t.tradeid || t.id || t.order_id || `t_${Date.now()}`),
      symbol: t.tradingsymbol || t.symbol || '',
      type: (t.transactiontype || t.transaction_type || 'BUY').toLowerCase() as 'buy' | 'sell',
      quantity: parseInt(t.quantity || t.filled_quantity || t.qty || 0),
      price: parseFloat(t.price || t.average_price || t.avg_price || 0),
      total: parseFloat(t.total || t.total_value || t.net_amount || 0),
      timestamp: t.exch_tm || t.exchange_time || t.fill_timestamp || new Date().toISOString(),
    }));
  }

  async getHoldings(): Promise<Position[]> {
    await this.requireAuth();
    const result = await this.smartApi.getHolding();

    if (!result?.data || !Array.isArray(result.data)) return [];

    return result.data
      .filter((h: any) => {
        const qty = parseInt(h.quantity || h.hold_qty || 0);
        return qty > 0;
      })
      .map((h: any) => ({
        symbol: h.tradingsymbol || h.symbol || '',
        quantity: parseInt(h.quantity || h.hold_qty || h.buy_qty || 0),
        buyPrice: parseFloat(h.average_price || h.buy_price || h.avg_price || 0),
        currentPrice: parseFloat(h.ltp || h.last_price || 0),
        pnl: parseFloat(h.pnl || h.profit_and_loss || 0),
        pnlPercent: parseFloat(h.pnl_percentage || h.pnlpercent || 0),
      }));
  }

  // ======================== Real-time (WebSocket V2) ========================

  subscribeTicks(symbols: string[], onTick: (quote: MarketQuote) => void): () => void {
    if (!this.connected || !this.smartApi) {
      console.warn('[AngelBroker] Cannot subscribe to ticks — broker not authenticated');
      return () => {};
    }

    if (!this.feedToken && !this.accessToken) {
      console.warn('[AngelBroker] No feed token available — cannot subscribe to WebSocket ticks');
      return () => {};
    }

    try {
      const WebSocketV2Class = this.loadWebSocketV2();

      this.wsClient = new WebSocketV2Class({
        jwttoken: this.accessToken,
        apikey: this.apiKey,
        clientcode: this.clientCode,
        feedtype: 'market_feed',
      });

      let isConnected = false;
      let unsubscribeCalled = false;

      this.wsClient.on('tick', (tickData: any) => {
        if (unsubscribeCalled) return;

        const token = tickData.token || '';
        onTick({
          symbol: token,
          lastPrice: tickData.ltp || 0,
          change: tickData.change || 0,
          changePercent: tickData.change_percent || tickData.per_chg || 0,
          open: tickData.open || 0,
          high: tickData.high || 0,
          low: tickData.low || 0,
          close: tickData.close || tickData.prev_close || 0,
          volume: tickData.volume || tickData.vol_traded || 0,
          bid: tickData.bid_price || tickData.bid || 0,
          ask: tickData.ask_price || tickData.ask || 0,
          timestamp: new Date(tickData.ltt || tickData.exch_tm || Date.now()).toISOString(),
        });
      });

      // Resolve trading symbols to Angel One numeric tokens before subscribing
      const resolvedTokens = new Set<string>();

      // Use IIFE to properly sequence token resolution → connection → subscription
      (async () => {
        // Step 1: Resolve all tokens first
        await Promise.all(symbols.map(async (sym) => {
          try {
            const token = await this.resolveToken(sym);
            resolvedTokens.add(token);
          } catch {
            console.warn(`[AngelBroker] Could not resolve token for ${sym} — skipping WebSocket`);
          }
        }));

        if (resolvedTokens.size === 0 || unsubscribeCalled) return;

        // Step 2: Connect to WebSocket
        try {
          await this.wsClient.connect();
          isConnected = true;

          // Step 3: Subscribe to resolved tokens
          const jsonReq = {
            correlationID: 'toroloom-sub',
            action: 1, // 1 = subscribe
            mode: 3,   // 3 = full mode (LTP + depth)
            exchangeType: 1, // 1 = NSE
            tokens: Array.from(resolvedTokens),
          };
          this.wsClient.fetchData(jsonReq);
        } catch (err: any) {
          console.error('[AngelBroker] WebSocket connection failed:', err.message);
        }
      })();

      return () => {
        unsubscribeCalled = true;
        if (isConnected && this.wsClient) {
          try {
            const jsonReq = {
              correlationID: 'toroloom-unsub',
              action: 0, // 0 = unsubscribe
              mode: 3,
              exchangeType: 1,
              tokens: Array.from(resolvedTokens),
            };
            this.wsClient.fetchData(jsonReq);
            this.wsClient.close();
          } catch {
            // Ignore cleanup errors
          }
        }
        this.wsClient = null;
      };
    } catch (error: any) {
      console.warn('[AngelBroker] WebSocket setup failed:', error.message);
      return () => {};
    }
  }

  // ======================== EDIS (Electronic Delivery Instruction Slip) ========================

  /**
   * Initiate CDSL/NSDL authorisation for a specific holding (ISIN).
   * After calling this, you must redirect the user to the ReturnURL
   * (CDSL verification page) to complete the TPIN authorisation.
   */
  async verifyEDIS(request: EDISVerifyRequest): Promise<EDISVerifyResponse> {
    await this.requireAuth();
    const response = await this.restPost<EDISVerifyResponse>(
      'https://apiconnect.angelone.in/rest/secure/angelbroking/edis/v1/verifyDis',
      request,
    );
    console.log(`[AngelBroker] EDIS verify initiated for ISIN ${request.isin}`, response);
    return response;
  }

  /**
   * Generate TPIN for EDIS authorisation.
   * Call this after the user has provided their TPIN via the CDSL portal flow.
   */
  async generateTPIN(request: EDISGenerateTPINRequest): Promise<{ status: string }> {
    await this.requireAuth();
    const response = await this.restPost<{ status: string }>(
      'https://apiconnect.angelone.in/rest/secure/angelbroking/edis/v1/generateTPIN',
      request,
    );
    console.log(`[AngelBroker] TPIN generated for ReqId ${request.ReqId}`);
    return response;
  }

  /**
   * Check the status of an EDIS transaction.
   * Status 0 = not yet authorised (cannot sell).
   * Status 1 = authorised (can sell).
   */
  async getEDISTranStatus(request: EDISTranStatusRequest): Promise<EDISTranStatusResponse> {
    await this.requireAuth();
    const response = await this.restPost<EDISTranStatusResponse>(
      'https://apiconnect.angelone.in/rest/secure/angelbroking/edis/v1/getTranStatus',
      request,
    );
    return response;
  }

  // ======================== Brokerage Calculator ========================

  /**
   * Estimate brokerage charges for one or more orders.
   * Returns a breakdown of brokerage, transaction charges, GST, STT/CTT,
   * stamp duty, SEBI fees, and the total.
   */
  async estimateBrokerage(request: BrokerageEstimateRequest): Promise<BrokerageEstimateResponse> {
    await this.requireAuth();
    const response = await this.restPost<BrokerageEstimateResponse>(
      'https://apiconnect.angelone.in/rest/secure/angelbroking/brokerage/v1/estimateCharges',
      request,
    );
    return response;
  }

  // ======================== Raw REST Helper ========================

  /**
   * Make a raw POST request to an Angel One REST API endpoint.
   * Builds the required headers from the current session state.
   */
  private async restPost<T>(url: string, body: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
      'X-PrivateKey': this.apiKey,
      'X-ClientLocalIP': this.clientLocalIP,
      'X-ClientPublicIP': this.clientPublicIP,
      'X-MACAddress': this.macAddress,
      'Accept': 'application/json',
    };

    if (this.appId) {
      headers['X-AppId'] = this.appId;
    }
    if (this.clientCode) {
      headers['X-ClientCode'] = this.clientCode;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Angel One REST API error (${response.status}): ${errorBody}`,
      );
    }

    return response.json() as Promise<T>;
  }

  // ======================== Helpers ========================

  /**
   * Re-authenticate using stored credentials (password + TOTP).
   * Called automatically when the session token expires.
   */
  private async reAuthenticate(): Promise<boolean> {
    if (!this.clientCode || !this.apiKey || !this.password) {
      console.warn('[AngelBroker] Cannot re-authenticate — missing credentials (clientCode/apiKey/password)');
      return false;
    }

    try {
      // Ensure SmartAPI instance exists
      if (!this.smartApi) {
        const SmartAPIClass = this.loadSmartAPI();
        this.smartApi = new SmartAPIClass({ api_key: this.apiKey });
      }

      // Generate fresh 6-digit TOTP code from the stored Base32 secret
      const totpCode = this.totp
        ? speakeasy.totp({ secret: this.totp, encoding: 'base32' })
        : undefined;

      const session = await this.smartApi.generateSession(
        this.clientCode,
        this.password,
        totpCode,
      );

      this.accessToken = session.data.jwtToken;
      this.feedToken = session.data.feedToken || '';
      this.smartApi.setAccessToken(this.accessToken);

      // Re-attach session expiry hook for the new token
      this.smartApi.setSessionExpiryHook(() => {
        console.warn('[AngelBroker] Session token expired — will re-authenticate on next API call');
        this.connected = false;
      });

      this.connected = true;
      console.log(`[AngelBroker] Re-authenticated successfully (client: ${this.clientCode})`);
      return true;
    } catch (err: any) {
      console.error('[AngelBroker] Re-authentication failed:', err.message);
      this.connected = false;
      return false;
    }
  }

  /**
   * Ensure the broker is authenticated before making API calls.
   * If the session has expired, attempts to re-authenticate automatically
   * using the stored password and TOTP secret.
   */
  private async requireAuth(): Promise<void> {
    if (this.connected && this.smartApi) return;

    // Session expired — try to refresh automatically
    if (this.clientCode && this.apiKey && this.password) {
      const success = await this.reAuthenticate();
      if (success) return;
    }

    throw new Error('Angel One broker not authenticated. Call authenticate() first.');
  }
}
