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
 *   ANGEL_TOTP=your_totp  (optional, for 2FA)
 *
 * If you already have an access token:
 *   ANGEL_CLIENT_ID=your_client_id
 *   ANGEL_API_KEY=your_api_key
 *   ANGEL_ACCESS_TOKEN=your_jwt_token
 *
 * API Docs: https://github.com/angel-one/smartapi-javascript
 */

import {
  IBroker, BrokerConfig, MarketQuote, OHLCData, IndexData,
  StockInfo, OrderPayload, OrderResult, Position, TradeHistory
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
      const { SmartAPI } = require('smartapi-javascript');
      this.smartApi = new SmartAPI({ api_key: this.apiKey });

      if (this.accessToken) {
        // Use existing access token
        this.smartApi.setAccessToken(this.accessToken);
      } else {
        // Generate new session
        if (!this.password) throw new Error('Angel One password is required to generate session');
        const session = await this.smartApi.generateSession(
          this.clientCode,
          this.password,
          this.totp || undefined,
        );
        this.accessToken = session.data.jwtToken;
        this.feedToken = session.data.feedToken || '';
        this.smartApi.setAccessToken(this.accessToken);
      }

      // Set up session expiry hook for auto-reconnect
      this.smartApi.setSessionExpiryHook(() => {
        console.warn('[AngelBroker] Session expired — will re-authenticate on next call');
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
      const results = await this.smartApi.searchScrip({
        exchange,
        searchscrip: symbol,
      });

      if (results?.data && Array.isArray(results.data) && results.data.length > 0) {
        const match = results.data.find(
          (s: any) => s.tradingsymbol?.toUpperCase() === symbol.toUpperCase() || s.symbol?.toUpperCase() === symbol.toUpperCase(),
        ) || results.data[0];

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
    this.requireAuth();
    const results: IndexData[] = [];

    for (const indexName of DEFAULT_INDICES) {
      const info = INDEX_TOKENS[indexName];
      if (!info) continue;

      try {
        const ltpResult = await this.smartApi.ltpData({
          exchange: 'NSE',
          tradingsymbol: info.shortName,
          symboltoken: info.token,
        });

        if (ltpResult?.data) {
          const ltp = ltpResult.data.ltp || 0;

          // ltpData doesn't return OHLC — fetch latest candle for open/change
          let open = ltp;
          try {
            const now = new Date();
            const todayStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} 00:00`;
            const candleData = await this.smartApi.getCandleData({
              exchange: 'NSE',
              symboltoken: info.token,
              interval: 'ONE_DAY',
              fromdate: todayStart,
              todate: now.toISOString().slice(0, 16).replace('T', ' '),
            });
            if (candleData?.data && Array.isArray(candleData.data) && candleData.data.length > 0) {
              const latest = candleData.data[candleData.data.length - 1];
              open = latest[1] || ltp;
            }
          } catch {
            // Candle fetch is best-effort
          }

          const change = ltp - open;
          const changePercent = open > 0 ? (change / open) * 100 : 0;

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
    this.requireAuth();
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
    this.requireAuth();
    const token = await this.resolveToken(symbol);

    // Step 1: Get LTP via ltpData
    const ltpResult = await this.smartApi.ltpData({
      exchange: 'NSE',
      tradingsymbol: symbol,
      symboltoken: token,
    });

    if (!ltpResult?.data) throw new Error(`No quote data for ${symbol}`);

    const d = ltpResult.data;
    const ltp = d.ltp || 0;

    // Step 2: Get OHLC data from latest candle (Angel ltpData doesn't return OHLC)
    let open = ltp, high = ltp, low = ltp, close = ltp, volume = 0;
    try {
      const now = new Date();
      const todayStr =
        `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} 00:00`;
      const endStr =
        `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

      const candleData = await this.smartApi.getCandleData({
        exchange: 'NSE',
        symboltoken: token,
        interval: 'ONE_DAY',
        fromdate: todayStr,
        todate: endStr,
      });

      if (candleData?.data && Array.isArray(candleData.data) && candleData.data.length > 0) {
        const latest = candleData.data[candleData.data.length - 1];
        // Angel returns: [timestamp, open, high, low, close, volume]
        open = latest[1] || ltp;
        high = latest[2] || ltp;
        low = latest[3] || ltp;
        close = latest[4] || ltp;
        volume = latest[5] || 0;
      }
    } catch {
      // Candle data is a best-effort enhancement; fall back to LTP-only values
    }

    const change = ltp - close;
    const changePercent = close > 0 ? (change / close) * 100 : 0;

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
      bid: ltp,  // ltpData doesn't provide bid/ask depth
      ask: ltp,
      timestamp: d.exch_tm || d.exch_time || new Date().toISOString(),
    };
  }

  async getBulkQuotes(symbols: string[]): Promise<Map<string, MarketQuote>> {
    this.requireAuth();
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
    this.requireAuth();
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
    this.requireAuth();

    const results = await this.smartApi.searchScrip({
      exchange: 'NSE',
      searchscrip: query,
    });

    if (!results?.data || !Array.isArray(results.data)) return [];

    // searchScrip returns basic instrument info without price data.
    // Fetch LTP for each result in parallel to populate prices.
    const stocks: StockInfo[] = [];
    const priceResults = await Promise.allSettled(
      results.data.map(async (s: any) => {
        const symbol = s.tradingsymbol || s.symbol || '';
        const token = s.symboltoken || s.token || '';
        if (!symbol || !token) return null;

        let price = 0, change = 0, changePercent = 0;
        try {
          const ltpData = await this.smartApi.ltpData({
            exchange: 'NSE',
            tradingsymbol: symbol,
            symboltoken: token,
          });
          if (ltpData?.data) {
            price = ltpData.data.ltp || 0;
            change = 0; // ltpData doesn't give change; computed as 0 for search results
            changePercent = 0;
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
          isPositive: price >= 0,
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

  async placeOrder(order: OrderPayload): Promise<OrderResult> {
    this.requireAuth();
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
    this.requireAuth();
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
    this.requireAuth();
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
    this.requireAuth();
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
    this.requireAuth();

    if (!this.feedToken && !this.accessToken) {
      console.warn('[AngelBroker] No feed token available — cannot subscribe to WebSocket ticks');
      return () => {};
    }

    try {
      const { WebSocketV2 } = require('smartapi-javascript');

      this.wsClient = new WebSocketV2({
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

  // ======================== Helpers ========================

  private requireAuth(): void {
    if (!this.connected || !this.smartApi) {
      throw new Error('Angel One broker not authenticated. Call authenticate() first.');
    }
  }
}
