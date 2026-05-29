/**
 * Broker Abstraction Interface
 *
 * Defines a unified interface for all supported brokers.
 * Implementations: MockBroker, ZerodhaBroker, AngelBroker
 *
 * This allows the app to work with mock data during development
 * and seamlessly switch to real broker APIs in production.
 */

export interface MarketQuote {
  symbol: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  bid: number;
  ask: number;
  timestamp: string;
}

export interface OHLCData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndexData {
  id: string;
  name: string;
  shortName: string;
  currentValue: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
}

export interface StockInfo {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
  marketCap: string;
  volume: string;
  high52: number;
  low52: number;
  pe: number;
  pb: number;
  dividend: number;
}

export interface OrderPayload {
  symbol: string;
  exchange: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  productType: 'CNC' | 'MIS' | 'NRML';
  orderType: 'LIMIT' | 'MARKET' | 'SL' | 'SLM';
}

export interface OrderResult {
  id: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  message: string;
  timestamp: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface TradeHistory {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  timestamp: string;
}

export interface BrokerConfig {
  apiKey: string;
  apiSecret?: string;
  accessToken?: string;
  clientId?: string;
  // Angel One specific
  password?: string;
  totp?: string;
  // Zerodha specific
  requestToken?: string;
}

export interface IBroker {
  readonly name: string;

  /** Auth & Connection */
  authenticate(config: BrokerConfig): Promise<boolean>;
  isConnected(): boolean;

  /** Market Data */
  getIndices(): Promise<IndexData[]>;
  getStocks(): Promise<StockInfo[]>;
  getQuote(symbol: string): Promise<MarketQuote>;
  getBulkQuotes(symbols: string[]): Promise<Map<string, MarketQuote>>;
  getOHLC(symbol: string, interval: string, days: number): Promise<OHLCData[]>;
  searchStocks(query: string): Promise<StockInfo[]>;

  /** Trading */
  placeOrder(order: OrderPayload): Promise<OrderResult>;
  getPositions(): Promise<Position[]>;
  getTradeHistory(): Promise<TradeHistory[]>;

  /** Portfolio */
  getHoldings(): Promise<Position[]>;

  /** Real-time (WebSocket) */
  subscribeTicks(symbols: string[], onTick: (quote: MarketQuote) => void): () => void;
}
