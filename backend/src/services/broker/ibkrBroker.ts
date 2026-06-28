/**
 * ============================================================================
 * Interactive Brokers — Client Portal Web API Implementation
 * ============================================================================
 *
 * Implements the IBroker interface by making REST calls to the IBKR Client
 * Portal Gateway (a Java app running on localhost:5000 by default).
 *
 * The Gateway handles all authentication — the user logs into IBKR via
 * the Gateway's web UI, which establishes a session. Our backend then
 * uses that session to make API calls.
 *
 * Architecture:
 *   Toroloom Backend ←→ IBKR Client Portal Gateway (localhost:5000) ←→ IBKR Servers
 *
 * Doc: https://interactivebrokers.github.io/cpwebapi/
 *
 * Environment variables:
 *   IBKR_GATEWAY_URL=http://localhost:5000   (default)
 *   IBKR_ACCOUNT_ID=U1234567                 (optional, auto-detected)
 *
 * ============================================================================
 */

import type {
  IBroker, BrokerConfig, MarketQuote, OHLCData, IndexData,
  StockInfo, OrderPayload, OrderResult, ModifyOrderPayload,
  CancelOrderPayload, OpenOrder, Position, TradeHistory,
} from './interface';

// ──── Types ───────────────────────────────────────────────────────────────

interface IbkrAccount {
  id: string;
  accountId: string;
  accountTitle: string;
  accountType: string;
  currency: string;
  status: string;
}

interface IbkrPosition {
  acctId: string;
  conid: number;
  contractDesc: string;
  position: number;
  mktPrice: number;
  mktValue: number;
  avgCost: number;
  realizedPnl: number;
  unrealizedPnl: number;
  exchs: string;
  expiry: string;
  currency: string;
  name: string;
}

interface IbkrOrder {
  orderId: number;
  acct: string;
  conid: number;
  conidEx: string;
  symbol: string;
  orderType: string;
  side: string; // BUY | SELL
  quantity: number;
  filledQuantity: number;
  limitPrice: number;
  auxPrice: number;
  status: string;
  ticker: string;
  description: string;
  listingExchange: string;
  orderTime: string;
  lastExecutionTime: string;
  orderRef: string;
}

interface IbkrTrade {
  executionId: string;
  symbol: string;
  side: string;
  orderId: number;
  conid: number;
  price: number;
  amount: number;
  time: string;
  acct: string;
  contractDescription: string;
  listingExchange: string;
}

interface IbkrContract {
  conid: number;
  symbol: string;
  description: string;
  currency: string;
  exchange: string;
  type: string;
  group: string;
}

interface IbkrQuote {
  conid: number;
  symbol: string;
  last: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bid: number;
  ask: number;
  timestamp: number;
  marketCap: number;
  pe: number;
  dividend: number;
  high52: number;
  low52: number;
}

interface IbkrHistoricalBar {
  t: number;     // Timestamp
  o: number;     // Open
  h: number;     // High
  l: number;     // Low
  c: number;     // Close
  v: number;     // Volume
}

// ──── Constants ───────────────────────────────────────────────────────────

const DEFAULT_GATEWAY_URL = 'http://localhost:5000';
const TICKLE_INTERVAL_MS = 30_000; // Keep session alive every 30 seconds
const MAX_RETRIES = 2;
const RATE_LIMIT_PER_SECOND = 8; // IBKR limit is 10/sec, we use 8 to be safe

// ──── Rate Limiter ────────────────────────────────────────────────────────

class RateLimiter {
  private lastCallTimes: number[] = [];

  async throttle(): Promise<void> {
    const now = Date.now();
    // Remove timestamps older than 1 second
    this.lastCallTimes = this.lastCallTimes.filter(t => now - t < 1000);

    if (this.lastCallTimes.length >= RATE_LIMIT_PER_SECOND) {
      const oldest = this.lastCallTimes[0];
      const waitMs = 1000 - (now - oldest) + 50;
      await new Promise(r => setTimeout(r, waitMs));
    }

    this.lastCallTimes.push(Date.now());
  }
}

// ──── IBKR Broker ─────────────────────────────────────────────────────────

export class IbkrBroker implements IBroker {
  readonly name = 'Interactive Brokers';

  private gatewayUrl: string = DEFAULT_GATEWAY_URL;
  private accountId: string = '';
  private connected = false;
  private authenticated = false;
  private tickleTimer: ReturnType<typeof setInterval> | null = null;
  private rateLimiter = new RateLimiter();
  private contractCache = new Map<string, IbkrContract>();

  // ── Auth ─────────────────────────────────────────────────────────────

  async authenticate(config: BrokerConfig): Promise<boolean> {
    this.gatewayUrl = (config as any).gatewayUrl || DEFAULT_GATEWAY_URL;
    const providedAccountId = (config as any).accountId || '';

    try {
      // Step 1: Check if gateway is running
      const healthOk = await this.checkGatewayHealth();
      if (!healthOk) {
        console.warn('[IbkrBroker] Gateway not reachable at', this.gatewayUrl);
        return false;
      }

      // Step 2: Check authentication status
      const authStatus = await this.getAuthStatus();
      if (!authStatus.authenticated) {
        console.warn('[IbkrBroker] Not authenticated. Please log in via the Client Portal Gateway at', this.gatewayUrl);
        return false;
      }

      this.authenticated = true;

      // Step 3: Get account ID if not provided
      if (providedAccountId) {
        this.accountId = providedAccountId;
      } else {
        const accounts = await this.getAccounts();
        if (accounts.length === 0) {
          console.warn('[IbkrBroker] No trading accounts found');
          return false;
        }
        this.accountId = accounts[0].accountId;
        console.log(`[IbkrBroker] Using account: ${this.accountId} (${accounts[0].accountTitle})`);
      }

      // Step 4: Start session keep-alive
      this.startTickle();

      this.connected = true;
      console.log('[IbkrBroker] Connected to Interactive Brokers via Client Portal Gateway');
      return true;
    } catch (error: any) {
      console.error('[IbkrBroker] Authentication failed:', error.message);
      this.cleanup();
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected && this.authenticated;
  }

  disconnect(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.tickleTimer) {
      clearInterval(this.tickleTimer);
      this.tickleTimer = null;
    }
    this.connected = false;
    this.authenticated = false;
  }

  // ── Session Management ───────────────────────────────────────────────

  private startTickle(): void {
    this.tickleTimer = setInterval(async () => {
      try {
        await this.tickle();
      } catch {
        // Tickle failed — session may have expired
        console.warn('[IbkrBroker] Session tickle failed — gateway may be disconnected');
      }
    }, TICKLE_INTERVAL_MS);
  }

  private async tickle(): Promise<void> {
    await this.apiPost('/tickle');
  }

  private async checkGatewayHealth(): Promise<boolean> {
    try {
      await this.apiGet('/');
      return true;
    } catch {
      return false;
    }
  }

  private async getAuthStatus(): Promise<{ authenticated: boolean; connected: boolean }> {
    const data = await this.apiPost('/iserver/auth/status');
    return {
      authenticated: data?.authenticated === true,
      connected: data?.connected === true,
    };
  }

  private async getAccounts(): Promise<IbkrAccount[]> {
    const data = await this.apiGet('/iserver/accounts');
    if (data?.accounts && Array.isArray(data.accounts)) {
      return data.accounts;
    }
    // Fallback: try the /portfolio/accounts endpoint
    const portfolioAccounts = await this.apiGet('/portfolio/accounts');
    if (Array.isArray(portfolioAccounts)) {
      return portfolioAccounts;
    }
    return [];
  }

  // ── Market Data ──────────────────────────────────────────────────────

  async getIndices(): Promise<IndexData[]> {
    this.requireAuth();

    // IBKR doesn't have a dedicated indices endpoint.
    // Return empty array — frontend will fall back to the last cached data.
    return [];
  }

  async getStocks(): Promise<StockInfo[]> {
    this.requireAuth();

    // Get portfolio positions as the "stocks" list
    const positions = await this.apiGet(`/portfolio/${this.accountId}/positions/0`);
    if (!Array.isArray(positions)) return [];

    return positions.map((p: IbkrPosition) => ({
      id: String(p.conid),
      symbol: p.contractDesc || p.name || String(p.conid),
      name: p.contractDesc || p.name || String(p.conid),
      sector: '',
      price: p.mktPrice || 0,
      change: 0,
      changePercent: 0,
      isPositive: true,
      marketCap: '',
      volume: '0',
      high52: 0,
      low52: 0,
      pe: 0,
      pb: 0,
      dividend: 0,
    }));
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    this.requireAuth();

    // First resolve symbol to conid
    const conid = await this.resolveConid(symbol);
    const snapshot = await this.getMarketSnapshot([conid]);
    const quote = snapshot.get(String(conid));

    if (!quote) {
      throw new Error(`No quote data for ${symbol}`);
    }

    return quote;
  }

  async getBulkQuotes(symbols: string[]): Promise<Map<string, MarketQuote>> {
    this.requireAuth();

    // Resolve all symbols to conids
    const resolved = await Promise.all(
      symbols.map(async (sym) => ({
        symbol: sym,
        conid: await this.resolveConid(sym),
      })),
    );

    const conids = resolved.map(r => r.conid);
    const quotes = await this.getMarketSnapshot(conids);

    // Map back from conid to original symbol
    const result = new Map<string, MarketQuote>();
    for (const r of resolved) {
      const quote = quotes.get(String(r.conid));
      if (quote) {
        result.set(r.symbol, quote);
      }
    }

    return result;
  }

  async getOHLC(symbol: string, interval: string, days: number): Promise<OHLCData[]> {
    this.requireAuth();

    const conid = await this.resolveConid(symbol);

    // Map interval to IBKR bar type
    const barTypeMap: Record<string, string> = {
      '1m': '1min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '60m': '1h',
      '1d': '1d',
      '1w': '1w',
    };

    const barType = barTypeMap[interval] || '1d';
    const toDate = new Date();
    const fromDate = new Date(Date.now() - days * 86400000);

    try {
      const data = await this.apiGet(
        `/iserver/marketdata/history?conid=${conid}&barType=${barType}&startTime=${fromDate.toISOString()}`,
      );

      if (!data?.data || !Array.isArray(data.data)) return [];

      return data.data.map((bar: IbkrHistoricalBar) => ({
        date: new Date(bar.t).toISOString(),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v || 0,
      }));
    } catch {
      // Historical data may not be available for all symbols
      return [];
    }
  }

  async searchStocks(query: string): Promise<StockInfo[]> {
    this.requireAuth();

    try {
      const data = await this.apiGet(
        `/iserver/secdef/search?symbol=${encodeURIComponent(query)}&name=${encodeURIComponent(query)}&secType=STK`,
      );

      if (!Array.isArray(data)) return [];

      return data.slice(0, 20).map((c: any) => ({
        id: String(c.conid || ''),
        symbol: c.symbol || query,
        name: c.description || c.symbol || query,
        sector: c.group || '',
        price: 0,
        change: 0,
        changePercent: 0,
        isPositive: true,
        marketCap: '',
        volume: '0',
        high52: 0,
        low52: 0,
        pe: 0,
        pb: 0,
        dividend: 0,
      }));
    } catch {
      return [];
    }
  }

  // ── Trading ──────────────────────────────────────────────────────────

  async getOpenOrders(): Promise<OpenOrder[]> {
    this.requireAuth();

    try {
      const data = await this.apiGet('/iserver/account/orders');

      if (!data?.orders || !Array.isArray(data.orders)) return [];

      return data.orders
        .filter((o: IbkrOrder) => {
          const status = (o.status || '').toUpperCase();
          return ['OPEN', 'PENDING', 'PRE_SUBMITTED', 'INACTIVE', 'SUBMITTED', 'PARTIALLY_FILLED', 'PARTIAL'].includes(status);
        })
        .map((o: IbkrOrder) => ({
          id: String(o.orderId),
          symbol: o.ticker || o.symbol || '',
          exchange: o.listingExchange || 'SMART',
          transactionType: (o.side || 'BUY').toUpperCase() as 'BUY' | 'SELL',
          quantity: o.quantity || 0,
          filledQuantity: o.filledQuantity || 0,
          price: o.limitPrice || 0,
          triggerPrice: o.auxPrice || undefined,
          productType: 'STK',
          orderType: o.orderType || 'LIMIT',
          status: this.mapOrderStatus(o.status),
          placedBy: o.orderRef || 'API',
          timestamp: o.lastExecutionTime || o.orderTime || new Date().toISOString(),
        }));
    } catch {
      return [];
    }
  }

  async placeOrder(order: OrderPayload): Promise<OrderResult> {
    this.requireAuth();

    const conid = await this.resolveConid(order.symbol);

    const orderBody = {
      acctId: this.accountId,
      conid,
      conidEx: `${order.exchange || 'SMART'}:${order.symbol}`,
      orderType: order.orderType === 'MARKET' ? 'MKT' : this.mapOrderType(order.orderType),
      side: order.transactionType === 'BUY' ? 'BUY' : 'SELL',
      quantity: order.quantity,
      price: order.orderType !== 'MARKET' ? order.price : undefined,
      tif: 'DAY',
    };

    try {
      const data = await this.apiPost(`/iserver/account/${this.accountId}/order`, orderBody);

      if (data?.id) {
        return {
          id: String(data.id),
          status: 'confirmed',
          message: `Order placed: ${order.transactionType} ${order.quantity} ${order.symbol} @ ${order.price}`,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        id: `ibkr_${Date.now()}`,
        status: 'pending',
        message: data?.message || 'Order submitted to IBKR',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        id: `ibkr_${Date.now()}`,
        status: 'rejected',
        message: error.message || 'Failed to place order',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async modifyOrder(modifyOrder: ModifyOrderPayload): Promise<OrderResult> {
    this.requireAuth();

    try {
      const data = await this.apiPost(
        `/iserver/account/${this.accountId}/order/${modifyOrder.orderId}`,
        {
          ...modifyOrder,
          acctId: this.accountId,
        },
      );

      return {
        id: modifyOrder.orderId,
        status: 'confirmed',
        message: `Order ${modifyOrder.orderId} modified`,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        id: modifyOrder.orderId,
        status: 'rejected',
        message: error.message || 'Failed to modify order',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async cancelOrder(cancelOrder: CancelOrderPayload): Promise<OrderResult> {
    this.requireAuth();

    try {
      await this.apiDelete(`/iserver/account/${this.accountId}/order/${cancelOrder.orderId}`);

      return {
        id: cancelOrder.orderId,
        status: 'cancelled',
        message: `Order ${cancelOrder.orderId} cancelled`,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        id: cancelOrder.orderId,
        status: 'rejected',
        message: error.message || 'Failed to cancel order',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getPositions(): Promise<Position[]> {
    this.requireAuth();

    try {
      const data = await this.apiGet(`/portfolio/${this.accountId}/positions/0`);
      if (!Array.isArray(data)) return [];

      return data
        .filter((p: IbkrPosition) => p.position !== 0)
        .map((p: IbkrPosition) => ({
          symbol: p.contractDesc || p.name || String(p.conid),
          quantity: Math.abs(p.position),
          buyPrice: p.avgCost || 0,
          currentPrice: p.mktPrice || 0,
          pnl: p.unrealizedPnl || 0,
          pnlPercent: p.avgCost > 0 ? (p.mktPrice - p.avgCost) / p.avgCost * 100 : 0,
        }));
    } catch {
      return [];
    }
  }

  async getTradeHistory(): Promise<TradeHistory[]> {
    this.requireAuth();

    try {
      const data = await this.apiGet(`/iserver/account/${this.accountId}/trades`);
      if (!Array.isArray(data)) return [];

      return data.map((t: IbkrTrade) => ({
        id: t.executionId || `t_${Date.now()}`,
        symbol: t.symbol || t.contractDescription || '',
        type: (t.side || 'BUY').toLowerCase() as 'buy' | 'sell',
        quantity: t.amount || 0,
        price: t.price || 0,
        total: (t.price || 0) * (t.amount || 0),
        timestamp: t.time || new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }

  async getHoldings(): Promise<Position[]> {
    return this.getPositions();
  }

  // ── Real-time (WebSocket) ────────────────────────────────────────────

  subscribeTicks(symbols: string[], onTick: (quote: MarketQuote) => void): () => void {
    this.requireAuth();

    let cleanupCalled = false;
    const interval = setInterval(async () => {
      if (cleanupCalled) return;

      try {
        const conids = await Promise.all(
          symbols.map(async (sym) => this.resolveConid(sym)),
        );
        const quotes = await this.getMarketSnapshot(conids);

        for (const [conidStr, quote] of quotes) {
          if (cleanupCalled) return;
          onTick(quote);
        }
      } catch {
        // Silent retry on next tick
      }
    }, 5000);

    return () => {
      cleanupCalled = true;
      clearInterval(interval);
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private requireAuth(): void {
    if (!this.connected || !this.authenticated) {
      throw new Error('Interactive Brokers not authenticated. Call authenticate() first.');
    }
  }

  /**
   * Resolve a trading symbol to IBKR conid (Contract ID).
   * Uses cache for previously resolved symbols.
   */
  private async resolveConid(symbol: string): Promise<number> {
    // Check cache first
    const cached = this.contractCache.get(symbol.toUpperCase());
    if (cached) return cached.conid;

    // If symbol looks like a numeric conid, use it directly
    const numSymbol = parseInt(symbol, 10);
    if (!isNaN(numSymbol) && String(numSymbol) === symbol) {
      return numSymbol;
    }

    // Try to search for the contract
    try {
      const data = await this.apiGet(
        `/iserver/secdef/search?symbol=${encodeURIComponent(symbol)}&secType=STK`,
      );

      if (Array.isArray(data) && data.length > 0) {
        const contract = data[0] as IbkrContract;
        if (contract.conid) {
          this.contractCache.set(symbol.toUpperCase(), contract);
          return contract.conid;
        }
      }

      // If search fails, create a placeholder conid
      // IBKR uses negative conids for placeholder/error states
      const placeholderConid = -Math.abs(symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
      return placeholderConid;
    } catch {
      // Return a placeholder on error
      return -1;
    }
  }

  /**
   * Get market snapshot for given conids.
   * Returns a Map<conid, MarketQuote>.
   */
  private async getMarketSnapshot(conids: number[]): Promise<Map<string, MarketQuote>> {
    if (conids.length === 0) return new Map();

    try {
      const conidList = conids.join(',');
      const data = await this.apiGet(`/iserver/marketdata/snapshot?conids=${conidList}&fields=31,70,71,72,73,74,75,76,77,78,82,83,84,85,86`);

      const result = new Map<string, MarketQuote>();

      if (!Array.isArray(data)) return result;

      for (const entry of data) {
        if (!entry) continue;

        const conid = String(entry.conid || entry.contractId || '');
        const lastPrice = entry[31] || 0; // Field 31 = last price
        const open = entry[70] || lastPrice; // Field 70 = open
        const high = entry[71] || lastPrice; // Field 71 = high
        const low = entry[72] || lastPrice; // Field 72 = low
        const close = entry[73] || lastPrice; // Field 73 = close
        const change = entry[82] || 0; // Field 82 = change
        const changePercent = entry[83] || 0; // Field 83 = change%

        result.set(conid, {
          symbol: conid,
          lastPrice: lastPrice as number,
          change: change as number,
          changePercent: changePercent as number,
          open: open as number,
          high: high as number,
          low: low as number,
          close: close as number,
          volume: (entry[87] as number) || 0, // Field 87 = volume
          bid: (entry[84] as number) || lastPrice, // Field 84 = bid
          ask: (entry[86] as number) || lastPrice, // Field 86 = ask
          timestamp: new Date().toISOString(),
        });
      }

      return result;
    } catch {
      return new Map();
    }
  }

  private mapOrderStatus(status: string): 'open' | 'pending' | 'partially_filled' | 'trigger_pending' {
    const s = (status || '').toUpperCase();
    if (s === 'OPEN' || s === 'SUBMITTED') return 'open';
    if (s === 'PRE_SUBMITTED' || s === 'PENDING') return 'pending';
    if (s === 'PARTIALLY_FILLED' || s === 'PARTIAL') return 'partially_filled';
    if (s === 'INACTIVE') return 'trigger_pending';
    return 'pending';
  }

  private mapOrderType(type: string): string {
    const map: Record<string, string> = {
      'LIMIT': 'LMT',
      'MARKET': 'MKT',
      'SL': 'STP',
      'SLM': 'STP_LMT',
    };
    return map[type] || 'LMT';
  }

  // ── HTTP Client ──────────────────────────────────────────────────────

  private async apiGet(path: string): Promise<any> {
    await this.rateLimiter.throttle();
    const url = `${this.gatewayUrl}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`IBKR API error (${response.status}): ${text.slice(0, 200)}`);
    }

    return response.json().catch(() => null);
  }

  private async apiPost(path: string, body?: any): Promise<any> {
    await this.rateLimiter.throttle();
    const url = `${this.gatewayUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`IBKR API error (${response.status}): ${text.slice(0, 200)}`);
    }

    return response.json().catch(() => null);
  }

  private async apiDelete(path: string): Promise<any> {
    await this.rateLimiter.throttle();
    const url = `${this.gatewayUrl}${path}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`IBKR API error (${response.status}): ${text.slice(0, 200)}`);
    }

    return response.json().catch(() => null);
  }
}
