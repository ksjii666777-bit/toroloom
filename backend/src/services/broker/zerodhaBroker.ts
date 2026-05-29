/**
 * Zerodha Kite Connect Broker Implementation
 *
 * This implementation uses the official `kiteconnect` npm package.
 *
 * To use:
 * 1. Install: npm install kiteconnect
 * 2. Set env vars: BROKER=zerodha, plus your Zerodha Kite Connect credentials
 *
 * Required env vars (if no accessToken):
 *   ZERODHA_API_KEY=your_api_key
 *   ZERODHA_API_SECRET=your_api_secret
 *   ZERODHA_REQUEST_TOKEN=your_request_token  (from Kite login redirect URL)
 *
 * If you already have an access token:
 *   ZERODHA_API_KEY=your_api_key
 *   ZERODHA_API_SECRET=your_api_secret
 *   ZERODHA_ACCESS_TOKEN=your_access_token
 *
 * API Docs: https://kite.trade/docs/connect/v3/
 * GitHub:   https://github.com/zerodha/kiteconnectjs
 */

import {
  IBroker, BrokerConfig, MarketQuote, OHLCData, IndexData,
  StockInfo, OrderPayload, OrderResult, Position, TradeHistory
} from './interface';

// Standard index tokens used by Zerodha Kite
const INDEX_TOKENS: Record<string, string> = {
  'NIFTY 50': 'NSE:NIFTY 50',
  'NIFTY BANK': 'NSE:NIFTY BANK',
  'SENSEX': 'BSE:SENSEX',
  'NIFTY MIDCAP 100': 'NSE:NIFTY MIDCAP 100',
};

const DEFAULT_INDICES = ['NIFTY 50', 'NIFTY BANK', 'SENSEX', 'NIFTY MIDCAP 100'];

/**
 * Zerodha Kite Connect Broker Implementation
 */
export class ZerodhaBroker implements IBroker {
  readonly name = 'Zerodha Kite Connect';
  private connected = false;
  private apiKey = '';
  private apiSecret = '';
  private accessToken = '';
  private requestToken = '';

  // KiteConnect instance
  private kite: any = null;
  // KiteTicker instance
  private ticker: any = null;

  // Symbol → { tradingsymbol, exchange, instrument_token } mapping cache
  private instrumentCache: Map<string, { tradingsymbol: string; exchange: string; instrumentToken: number }> = new Map();

  // ======================== Auth ========================

  async authenticate(config: BrokerConfig): Promise<boolean> {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret || '';
    this.accessToken = config.accessToken || '';
    this.requestToken = (config as any).requestToken || '';

    if (!this.apiKey) throw new Error('Zerodha API key is required');
    if (!this.apiSecret) throw new Error('Zerodha API secret is required');

    try {
      const { KiteConnect } = require('kiteconnect');
      this.kite = new KiteConnect({ api_key: this.apiKey });

      if (this.accessToken) {
        // Use existing access token
        this.kite.setAccessToken(this.accessToken);
      } else if (this.requestToken) {
        // Generate session using request token from login redirect
        const session = await this.kite.generateSession(this.requestToken, this.apiSecret);
        this.accessToken = session.access_token;
        this.kite.setAccessToken(this.accessToken);
        console.log('[ZerodhaBroker] New session generated — save ZERODHA_ACCESS_TOKEN for next time');
      } else {
        throw new Error(
          'No access token or request token provided. ' +
          'Set ZERODHA_ACCESS_TOKEN or ZERODHA_REQUEST_TOKEN in your .env file.'
        );
      }

      // Pre-load instrument list for token resolution
      try {
        await this.loadInstruments();
      } catch (err) {
        console.warn('[ZerodhaBroker] Could not pre-load instruments (non-fatal):', (err as Error).message);
      }

      this.connected = true;
      console.log('[ZerodhaBroker] Authenticated successfully');
      return true;
    } catch (error: any) {
      console.error('[ZerodhaBroker] Authentication failed:', error.message);
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Load NSE instruments into cache for symbol → token resolution.
   * Kite Connect uses numeric instrument tokens, but our interface uses
   * trading symbols. We need the instrument list to translate.
   */
  private async loadInstruments(): Promise<void> {
    const instruments = await this.kite.getInstruments('NSE');
    if (Array.isArray(instruments)) {
      for (const inst of instruments) {
        if (inst.tradingsymbol && inst.instrument_token) {
          this.instrumentCache.set(inst.tradingsymbol.toUpperCase(), {
            tradingsymbol: inst.tradingsymbol,
            exchange: inst.exchange,
            instrumentToken: parseInt(inst.instrument_token, 10) || 0,
          });
        }
      }
    }
  }

  // ======================== Market Data ========================

  async getIndices(): Promise<IndexData[]> {
    this.requireAuth();

    const tokens = DEFAULT_INDICES.map(name => INDEX_TOKENS[name]).filter(Boolean);
    const results: IndexData[] = [];

    // Use getQuote which works with index tokens like "NSE:NIFTY 50"
    const quotes = await this.kite.getQuote(tokens);

    for (const [token, data] of Object.entries(quotes)) {
      const q = data as any;
      if (!q || !q.last_price) continue;

      const name = Object.entries(INDEX_TOKENS).find(([, v]) => v === token)?.[0] || token;
      const change = q.net_change || q.change || 0;
      const changePercent = q.change_percent || 0;

      results.push({
        id: token.replace(':', '_'),
        name,
        shortName: name.replace('Nifty ', '').replace('BSE ', ''),
        currentValue: q.last_price,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        isPositive: change >= 0,
      });
    }

    return results;
  }

  async getStocks(): Promise<StockInfo[]> {
    this.requireAuth();

    // Use instrument cache populated during auth instead of re-fetching
    if (this.instrumentCache.size === 0) {
      const instruments = await this.kite.getInstruments('NSE');
      if (!Array.isArray(instruments)) return [];
      for (const inst of instruments) {
        if (inst.tradingsymbol && inst.instrument_token) {
          this.instrumentCache.set(inst.tradingsymbol.toUpperCase(), {
            tradingsymbol: inst.tradingsymbol,
            exchange: inst.exchange,
            instrumentToken: parseInt(inst.instrument_token, 10) || 0,
          });
        }
      }
    }

    // Convert cache entries to array, filter equity and limit to first 100
    const equities = Array.from(this.instrumentCache.values())
      .filter(i => i.exchange === 'NSE' || i.exchange === 'NSE_EQ')
      .slice(0, 100);

    // Get quotes for all symbols
    const symbols = equities.map((i: any) => `NSE:${i.tradingsymbol}`);
    let quotesMap: Record<string, any> = {};

    try {
      quotesMap = await this.kite.getQuote(symbols);
    } catch {
      // Quotes may fail for some symbols
    }

    return equities.map((inst: any) => {
      const quoteKey = `NSE:${inst.tradingsymbol}`;
      const q = quotesMap[quoteKey] || {};
      const lastPrice = q.last_price || 0;
      const change = q.net_change || q.change || 0;
      const changePercent = q.change_percent || 0;

      return {
        id: inst.tradingsymbol,
        symbol: inst.tradingsymbol,
        name: inst.name || inst.tradingsymbol,
        sector: inst.segment || 'NSE',
        price: lastPrice,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        isPositive: change >= 0,
        marketCap: '',
        volume: String(q.volume || q.volume_traded || 0),
        high52: q['52week_high'] || 0,
        low52: q['52week_low'] || 0,
        pe: q.pe || 0,
        pb: q.pb || 0,
        dividend: q.dividend_yield || 0,
      };
    });
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    this.requireAuth();

    // Try to get quote for NSE:SYMBOL first, fall back to direct symbol
    const token = symbol.includes(':') ? symbol : `NSE:${symbol}`;
    const quoteData = await this.kite.getQuote([token]);
    const q = quoteData[token];

    if (!q) throw new Error(`No quote data for ${symbol}`);

    const ltp = q.last_price || 0;
    const open = q.ohlc?.open || ltp;
    const high = q.ohlc?.high || q.high || ltp;
    const low = q.ohlc?.low || q.low || ltp;
    const close = q.ohlc?.close || q.close || ltp;
    const change = q.net_change || (ltp - close) || 0;
    const changePercent = q.change_percent || (close > 0 ? (change / close) * 100 : 0);

    return {
      symbol,
      lastPrice: ltp,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      open,
      high,
      low,
      close,
      volume: q.volume || q.volume_traded || 0,
      bid: q.depth?.buy?.[0]?.price || q.bid || ltp,
      ask: q.depth?.sell?.[0]?.price || q.ask || ltp,
      timestamp: q.timestamp || q.exchange_timestamp || new Date().toISOString(),
    };
  }

  async getBulkQuotes(symbols: string[]): Promise<Map<string, MarketQuote>> {
    this.requireAuth();
    const tokens = symbols.map(s => (s.includes(':') ? s : `NSE:${s}`));
    const quoteData = await this.kite.getQuote(tokens);
    const map = new Map<string, MarketQuote>();

    for (let i = 0; i < symbols.length; i++) {
      const q = quoteData[tokens[i]];
      if (q) {
        const ltp = q.last_price || 0;
        const open = q.ohlc?.open || ltp;
        const high = q.ohlc?.high || ltp;
        const low = q.ohlc?.low || ltp;
        const close = q.ohlc?.close || ltp;
        const change = q.net_change || 0;
        const changePercent = q.change_percent || 0;

        map.set(symbols[i], {
          symbol: symbols[i],
          lastPrice: ltp,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round(changePercent * 100) / 100,
          open,
          high,
          low,
          close,
          volume: q.volume || q.volume_traded || 0,
          bid: q.depth?.buy?.[0]?.price || ltp,
          ask: q.depth?.sell?.[0]?.price || ltp,
          timestamp: q.timestamp || new Date().toISOString(),
        });
      }
    }

    return map;
  }

  async getOHLC(symbol: string, interval: string, days: number): Promise<OHLCData[]> {
    this.requireAuth();

    const token = symbol.includes(':') ? symbol : `NSE:${symbol}`;

    // Map intervals to Kite intervals
    const intervalMap: Record<string, string> = {
      '1m': 'minute',
      '5m': '5minute',
      '15m': '15minute',
      '30m': '30minute',
      '60m': '60minute',
      '1d': 'day',
      '1w': 'week',
    };

    const kiteInterval = intervalMap[interval] || 'day';
    const toDate = new Date();
    const fromDate = new Date(Date.now() - days * 86400000);

    const data = await this.kite.getHistoricalData(
      token,
      kiteInterval,
      fromDate.toISOString(),
      toDate.toISOString(),
    );

    if (!Array.isArray(data)) return [];

    // Kite returns: [date, open, high, low, close, volume]
    return data.map((candle: any[]) => ({
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

    // Kite doesn't have a direct search — use getInstruments and filter
    const instruments = await this.kite.getInstruments('NSE');
    if (!Array.isArray(instruments)) return [];

    const q = query.toUpperCase();
    const matches = instruments
      .filter((i: any) =>
        (i.tradingsymbol?.toUpperCase().includes(q) || i.name?.toUpperCase().includes(q)) &&
        (i.segment === 'NSE_EQ' || i.exchange === 'NSE')
      )
      .slice(0, 20);

    // Batch-get quotes for matched symbols
    const symbols = matches.map((m: any) => `NSE:${m.tradingsymbol}`);
    let quotesMap: Record<string, any> = {};

    try {
      quotesMap = await this.kite.getQuote(symbols);
    } catch {
      // Non-fatal
    }

    return matches.map((inst: any) => {
      const quoteKey = `NSE:${inst.tradingsymbol}`;
      const q = quotesMap[quoteKey] || {};
      const lastPrice = q.last_price || 0;
      const change = q.net_change || 0;
      const changePercent = q.change_percent || 0;

      return {
        id: inst.tradingsymbol,
        symbol: inst.tradingsymbol,
        name: inst.name || inst.tradingsymbol,
        sector: inst.segment || 'NSE',
        price: lastPrice,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        isPositive: change >= 0,
        marketCap: '',
        volume: String(q.volume || q.volume_traded || 0),
        high52: q['52week_high'] || 0,
        low52: q['52week_low'] || 0,
        pe: q.pe || 0,
        pb: q.pb || 0,
        dividend: q.dividend_yield || 0,
      };
    });
  }

  // ======================== Trading ========================

  async placeOrder(order: OrderPayload): Promise<OrderResult> {
    this.requireAuth();

    const exchangeMap: Record<string, string> = {
      'NSE': 'NSE',
      'BSE': 'BSE',
      'NFO': 'NFO',
      'MCX': 'MCX',
    };

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

    const result = await this.kite.placeOrder('regular', {
      exchange: exchangeMap[order.exchange] || 'NSE',
      tradingsymbol: order.symbol,
      transaction_type: order.transactionType === 'BUY' ? 'BUY' : 'SELL',
      quantity: order.quantity,
      price: order.price,
      product: productMap[order.productType] || 'CNC',
      order_type: orderTypeMap[order.orderType] || 'MARKET',
      validity: 'DAY',
    });

    if (!result) throw new Error('Zerodha placeOrder returned no result');

    // Kite placeOrder returns the order_id directly as a string
    const orderId = typeof result === 'string' ? result : result.order_id || result.data?.order_id || `zer_${Date.now()}`;
    const status: 'confirmed' | 'pending' | 'rejected' = 
      result.status === 'success' || result.status === 'confirmed' ? 'confirmed' :
      result.status === 'rejected' ? 'rejected' : 'pending';

    return {
      id: orderId,
      status,
      message: result.message || result.data?.message || `Order placed: ${orderId}`,
      timestamp: new Date().toISOString(),
    };
  }

  async getPositions(): Promise<Position[]> {
    this.requireAuth();
    const result = await this.kite.getPositions();

    const positions: Position[] = [];

    // Kite returns { day: [...], net: [...] }
    // We use 'net' for overall positions
    const netPositions = result?.net || [];
    if (Array.isArray(netPositions)) {
      for (const p of netPositions) {
        const qty = parseInt(p.quantity) || 0;
        if (qty === 0) continue;

        const buyPrice = parseFloat(p.average_price || p.buy_price || 0);
        const currentPrice = parseFloat(p.last_price || p.ltp || 0);
        const pnl = parseFloat(p.pnl || 0);

        positions.push({
          symbol: p.tradingsymbol || p.symbol || '',
          quantity: qty,
          buyPrice,
          currentPrice,
          pnl,
          pnlPercent: buyPrice > 0 ? Math.round((pnl / (buyPrice * qty)) * 10000) / 100 : 0,
        });
      }
    }

    return positions;
  }

  async getTradeHistory(): Promise<TradeHistory[]> {
    this.requireAuth();
    const trades = await this.kite.getTrades();

    if (!Array.isArray(trades)) return [];

    return trades.map((t: any) => ({
      id: String(t.trade_id || t.id || `t_${Date.now()}`),
      symbol: t.tradingsymbol || t.symbol || '',
      type: (t.transaction_type || t.transactiontype || 'buy').toLowerCase() as 'buy' | 'sell',
      quantity: parseInt(t.quantity || t.filled_quantity || 0),
      price: parseFloat(t.average_price || t.price || 0),
      total: (t.average_price || t.price || 0) * (t.quantity || t.filled_quantity || 0),
      timestamp: t.trade_date || t.exchange_timestamp || t.order_timestamp || new Date().toISOString(),
    }));
  }

  async getHoldings(): Promise<Position[]> {
    this.requireAuth();
    const holdings = await this.kite.getHoldings();

    if (!Array.isArray(holdings)) return [];

    return holdings
      .filter((h: any) => {
        const qty = parseInt(h.quantity || h.traded_quantity || 0);
        return qty > 0;
      })
      .map((h: any) => ({
        symbol: h.tradingsymbol || h.symbol || '',
        quantity: parseInt(h.quantity || h.traded_quantity || 0),
        buyPrice: parseFloat(h.average_price || h.buy_price || 0),
        currentPrice: parseFloat(h.last_price || h.ltp || 0),
        pnl: parseFloat(h.pnl || 0),
        pnlPercent: parseFloat(h.pnl_percentage || 0),
      }));
  }

  // ======================== Real-time (WebSocket) ========================

  /**
   * Resolve trading symbols to numeric Kite instrument tokens using the cache.
   * Falls back to parseInt for symbols that are already numeric tokens.
   */
  private resolveTokens(symbols: string[]): number[] {
    const tokens: number[] = [];
    for (const sym of symbols) {
      const cached = this.instrumentCache.get(sym.toUpperCase());
      if (cached && cached.instrumentToken > 0) {
        tokens.push(cached.instrumentToken);
      } else {
        // Try parsing as a raw numeric token
        const num = parseInt(sym, 10);
        if (!isNaN(num)) tokens.push(num);
      }
    }
    return tokens;
  }

  subscribeTicks(symbols: string[], onTick: (quote: MarketQuote) => void): () => void {
    this.requireAuth();

    try {
      const { KiteTicker } = require('kiteconnect');

      this.ticker = new KiteTicker({
        api_key: this.apiKey,
        access_token: this.accessToken,
      });

      let cleanupCalled = false;

      // Resolve trading symbols to numeric Kite instrument tokens
      const subscribeTokens = this.resolveTokens(symbols);

      this.ticker.on('ticks', (ticks: any[]) => {
        if (cleanupCalled) return;
        for (const tick of ticks) {
          onTick({
            symbol: tick.tradable || String(tick.instrument_token || ''),
            lastPrice: tick.last_price || tick.ltp || 0,
            change: tick.change || 0,
            changePercent: tick.change_percent || tick.per_chg || 0,
            open: tick.ohlc?.open || tick.open || 0,
            high: tick.ohlc?.high || tick.high || 0,
            low: tick.ohlc?.low || tick.low || 0,
            close: tick.ohlc?.close || tick.close || tick.prev_close || 0,
            volume: tick.volume_traded || tick.volume || tick.vol_traded || 0,
            bid: tick.depth?.buy?.[0]?.price || tick.bid || 0,
            ask: tick.depth?.sell?.[0]?.price || tick.ask || 0,
            timestamp: tick.timestamp || new Date().toISOString(),
          });
        }
      });

      this.ticker.on('connect', () => {
        if (subscribeTokens.length > 0) {
          this.ticker.subscribe(subscribeTokens);
          this.ticker.setMode(this.ticker.modeFull, subscribeTokens);
        }
      });

      this.ticker.on('error', (error: Error) => {
        console.error('[ZerodhaBroker] Ticker error:', error.message);
      });

      // Enable auto-reconnect
      this.ticker.autoReconnect(true, 20, 5);

      this.ticker.connect();

      return () => {
        cleanupCalled = true;
        if (this.ticker) {
          try {
            if (subscribeTokens.length > 0) {
              this.ticker.unsubscribe(subscribeTokens);
            }
            this.ticker.close();
          } catch {
            // Ignore cleanup errors
          }
        }
        this.ticker = null;
      };
    } catch (error: any) {
      console.warn('[ZerodhaBroker] WebSocket setup failed:', error.message);
      return () => {};
    }
  }

  // ======================== Helpers ========================

  private requireAuth(): void {
    if (!this.connected || !this.kite) {
      throw new Error('Zerodha broker not authenticated. Call authenticate() first.');
    }
  }
}
