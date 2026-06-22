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

// ──── Order Modification & Cancellation Types ────────────────────────────

export interface ModifyOrderPayload {
  orderId: string;
  symbol?: string;
  exchange?: string;
  quantity?: number;
  price?: number;
  productType?: 'CNC' | 'MIS' | 'NRML';
  orderType?: 'LIMIT' | 'MARKET' | 'SL' | 'SLM';
  triggerPrice?: number;
}

export interface CancelOrderPayload {
  orderId: string;
  symbol?: string;
  exchange?: string;
}

export interface OpenOrder {
  id: string;
  symbol: string;
  exchange: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  filledQuantity: number;
  price: number;
  triggerPrice?: number;
  productType: string;
  orderType: string;
  status: 'open' | 'pending' | 'partially_filled' | 'trigger_pending';
  placedBy: string;
  timestamp: string;
  validity?: string;
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

// ──── Angel One: EDIS Types ────────────────────────────────────────────────

export interface EDISVerifyRequest {
  isin: string;
  quantity: string;
}

export interface EDISVerifyResponse {
  ReqId: string;
  ReturnURL: string;
  DPId: string;
  BOID: string;
  TransDtls: string;
}

export interface EDISGenerateTPINRequest {
  dpId: string;
  ReqId: string;
  boid: string;
  pan: string;
}

export interface EDISTranStatusRequest {
  ReqId: string;
}

export interface EDISTranStatusResponse {
  ReqId: string;
  status: 0 | 1; // 0 = not authorized, 1 = authorized
}

// ──── Angel One: Brokerage Calculator Types ──────────────────────────────

export interface BrokerageOrderEntry {
  product_type: 'DELIVERY' | 'INTRADAY' | 'MARGIN' | 'BO' | 'CO';
  transaction_type: 'BUY' | 'SELL';
  exchange: 'NSE' | 'BSE' | 'NFO' | 'MCX';
  symbol: string;
  token: string;
  qty: number;
  price: number;
}

export interface BrokerageEstimateRequest {
  orders: BrokerageOrderEntry[];
}

export interface BrokerageEstimateResponse {
  status: string;
  payload: {
    brokerage: number;
    transaction_charges: number;
    gst: number;
    stt_ctt: number;
    stamp_duty: number;
    sebi_turnover_fees: number;
    total_charges: number;
  };
}

export interface BrokerConfig {
  apiKey: string;
  apiSecret?: string;
  accessToken?: string;
  clientId?: string;
  // Angel One specific
  password?: string;
  totp?: string;
  // Angel One — optional REST headers (used by raw HTTP calls for EDIS/Brokerage)
  clientLocalIP?: string;
  clientPublicIP?: string;
  macAddress?: string;
  appId?: string;
  // Zerodha specific
  requestToken?: string;
  // Interactive Brokers specific
  gatewayUrl?: string;
  accountId?: string;
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
  modifyOrder(order: ModifyOrderPayload): Promise<OrderResult>;
  cancelOrder(order: CancelOrderPayload): Promise<OrderResult>;
  getOpenOrders(): Promise<OpenOrder[]>;
  getPositions(): Promise<Position[]>;
  getTradeHistory(): Promise<TradeHistory[]>;

  /** Portfolio */
  getHoldings(): Promise<Position[]>;

  /** Real-time (WebSocket) */
  subscribeTicks(symbols: string[], onTick: (quote: MarketQuote) => void): () => void;
}
