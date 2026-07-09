import {
  IBroker, BrokerConfig, MarketQuote, OHLCData, IndexData,
  StockInfo, OrderPayload, OrderResult, ModifyOrderPayload,
  CancelOrderPayload, OpenOrder, Position, TradeHistory,
  EDISVerifyRequest, EDISVerifyResponse,
  EDISGenerateTPINRequest,
  EDISTranStatusRequest, EDISTranStatusResponse,
  BrokerageEstimateRequest, BrokerageEstimateResponse,
} from './interface';
import { generateMultiTimeframeOHLC } from '../../data/mockOHLC';

// ============ In-Memory Mock Data ============

const mockIndices: IndexData[] = [
  { id: 'nifty50', name: 'Nifty 50', shortName: 'NIFTY', currentValue: 23456.80, change: 345.20, changePercent: 1.49, isPositive: true },
  { id: 'sensex', name: 'BSE Sensex', shortName: 'SENSEX', currentValue: 77123.45, change: -123.45, changePercent: -0.16, isPositive: false },
  { id: 'banknifty', name: 'Bank Nifty', shortName: 'BANKNIFTY', currentValue: 49234.10, change: 567.89, changePercent: 1.17, isPositive: true },
  { id: 'midcap', name: 'Nifty Midcap 100', shortName: 'MIDCAP', currentValue: 15678.90, change: 234.56, changePercent: 1.52, isPositive: true },
];

const mockStocks: StockInfo[] = [
  { id: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', sector: 'Energy', price: 2890.50, change: 45.20, changePercent: 1.59, isPositive: true, marketCap: '₹19,56,000 Cr', volume: '12.5M', high52: 3020.00, low52: 2200.00, pe: 28.5, pb: 3.2, dividend: 0.85 },
  { id: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'Technology', price: 3890.00, change: -34.50, changePercent: -0.88, isPositive: false, marketCap: '₹14,20,000 Cr', volume: '8.2M', high52: 4200.00, low52: 3300.00, pe: 35.2, pb: 12.5, dividend: 1.20 },
  { id: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', sector: 'Finance', price: 1678.90, change: 23.45, changePercent: 1.42, isPositive: true, marketCap: '₹9,35,000 Cr', volume: '15.1M', high52: 1800.00, low52: 1360.00, pe: 18.9, pb: 2.8, dividend: 1.05 },
  { id: 'INFY', symbol: 'INFY', name: 'Infosys Ltd.', sector: 'Technology', price: 1567.80, change: 28.90, changePercent: 1.88, isPositive: true, marketCap: '₹6,52,000 Cr', volume: '10.8M', high52: 1700.00, low52: 1350.00, pe: 28.1, pb: 7.9, dividend: 1.80 },
  { id: 'ICICIBANK', symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', sector: 'Finance', price: 1123.45, change: -12.30, changePercent: -1.08, isPositive: false, marketCap: '₹7,85,000 Cr', volume: '18.5M', high52: 1250.00, low52: 980.00, pe: 16.5, pb: 2.3, dividend: 0.95 },
  { id: 'HINDUNILVR', symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd.', sector: 'Consumer', price: 2567.30, change: -15.60, changePercent: -0.60, isPositive: false, marketCap: '₹6,03,000 Cr', volume: '5.2M', high52: 2800.00, low52: 2300.00, pe: 55.3, pb: 10.8, dividend: 1.50 },
  { id: 'BHARTIARTL', symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', sector: 'Telecom', price: 1345.60, change: 34.50, changePercent: 2.63, isPositive: true, marketCap: '₹7,50,000 Cr', volume: '9.8M', high52: 1450.00, low52: 1050.00, pe: 42.1, pb: 5.6, dividend: 0.45 },
  { id: 'SBIN', symbol: 'SBIN', name: 'State Bank of India', sector: 'Finance', price: 789.50, change: 15.80, changePercent: 2.04, isPositive: true, marketCap: '₹7,04,000 Cr', volume: '22.3M', high52: 850.00, low52: 640.00, pe: 10.2, pb: 1.5, dividend: 2.15 },
  { id: 'TATAMOTORS', symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', sector: 'Automobile', price: 945.20, change: -8.90, changePercent: -0.93, isPositive: false, marketCap: '₹3,12,000 Cr', volume: '14.6M', high52: 1100.00, low52: 780.00, pe: 8.5, pb: 2.1, dividend: 0.35 },
  { id: 'BAJFINANCE', symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd.', sector: 'Finance', price: 6789.00, change: 123.40, changePercent: 1.85, isPositive: true, marketCap: '₹4,12,000 Cr', volume: '6.8M', high52: 7500.00, low52: 5800.00, pe: 32.4, pb: 5.2, dividend: 0.60 },
  { id: 'WIPRO', symbol: 'WIPRO', name: 'Wipro Ltd.', sector: 'Technology', price: 456.30, change: 8.70, changePercent: 1.94, isPositive: true, marketCap: '₹2,40,000 Cr', volume: '11.2M', high52: 520.00, low52: 380.00, pe: 24.3, pb: 4.1, dividend: 0.75 },
  { id: 'ITC', symbol: 'ITC', name: 'ITC Ltd.', sector: 'Consumer', price: 478.90, change: -5.60, changePercent: -1.16, isPositive: false, marketCap: '₹5,98,000 Cr', volume: '20.5M', high52: 510.00, low52: 400.00, pe: 26.8, pb: 6.3, dividend: 2.50 },
];

// ============ Helpers ============

function generateQuote(stock: StockInfo): MarketQuote {
  const variation = stock.price * (Math.random() - 0.5) * 0.004;
  const currentPrice = Math.round((stock.price + variation) * 100) / 100;
  const change = Math.round((currentPrice - stock.price) * 100) / 100;
  const changePercent = Math.round((change / stock.price) * 10000) / 100;

  return {
    symbol: stock.symbol,
    lastPrice: currentPrice,
    change,
    changePercent,
    open: Math.round(currentPrice * (1 - Math.random() * 0.01) * 100) / 100,
    high: Math.round(Math.max(currentPrice, stock.price) * (1 + Math.random() * 0.005) * 100) / 100,
    low: Math.round(Math.min(currentPrice, stock.price) * (1 - Math.random() * 0.005) * 100) / 100,
    close: stock.price,
    volume: Math.floor(Math.random() * 10000000) + 1000000,
    bid: Math.round((currentPrice - Math.random() * 0.5) * 100) / 100,
    ask: Math.round((currentPrice + Math.random() * 0.5) * 100) / 100,
    timestamp: new Date().toISOString(),
  };
}

// ============ Mock Positions / Orders State ============

// ============ Mock Open Orders ============
let mockOpenOrders: OpenOrder[] = [
  {
    id: 'open_ord_1',
    symbol: 'RELIANCE',
    exchange: 'NSE',
    transactionType: 'BUY',
    quantity: 25,
    filledQuantity: 0,
    price: 2850.00,
    productType: 'CNC',
    orderType: 'LIMIT',
    status: 'open',
    placedBy: 'WEB',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    validity: 'DAY',
  },
  {
    id: 'open_ord_2',
    symbol: 'TCS',
    exchange: 'NSE',
    transactionType: 'SELL',
    quantity: 10,
    filledQuantity: 5,
    price: 3950.00,
    productType: 'CNC',
    orderType: 'LIMIT',
    status: 'partially_filled',
    placedBy: 'WEB',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    validity: 'DAY',
  },
  {
    id: 'open_ord_3',
    symbol: 'INFY',
    exchange: 'NSE',
    transactionType: 'BUY',
    quantity: 50,
    filledQuantity: 0,
    price: 1550.00,
    triggerPrice: 1540.00,
    productType: 'MIS',
    orderType: 'SL',
    status: 'trigger_pending',
    placedBy: 'WEB',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    validity: 'DAY',
  },
];

let mockOrders: OrderResult[] = [];
let mockPositions: Position[] = [
  { symbol: 'RELIANCE', quantity: 50, buyPrice: 2650, currentPrice: 2890.50, pnl: 12025, pnlPercent: 9.08 },
  { symbol: 'HDFCBANK', quantity: 100, buyPrice: 1550, currentPrice: 1678.90, pnl: 12890, pnlPercent: 8.32 },
  { symbol: 'TCS', quantity: 20, buyPrice: 3800, currentPrice: 3890.00, pnl: 1800, pnlPercent: 2.37 },
  { symbol: 'INFY', quantity: 80, buyPrice: 1450, currentPrice: 1567.80, pnl: 9424, pnlPercent: 8.12 },
  { symbol: 'SBIN', quantity: 200, buyPrice: 720, currentPrice: 789.50, pnl: 13900, pnlPercent: 9.65 },
];

let mockTradeHistory: TradeHistory[] = [
  { id: 't1', symbol: 'RELIANCE', type: 'buy', quantity: 50, price: 2650, total: 132500, timestamp: '2025-05-20T09:30:00' },
  { id: 't2', symbol: 'TCS', type: 'sell', quantity: 10, price: 3920, total: 39200, timestamp: '2025-05-19T14:45:00' },
  { id: 't3', symbol: 'HDFCBANK', type: 'buy', quantity: 100, price: 1550, total: 155000, timestamp: '2025-05-18T11:20:00' },
  { id: 't4', symbol: 'INFY', type: 'buy', quantity: 80, price: 1450, total: 116000, timestamp: '2025-05-17T10:15:00' },
  { id: 't5', symbol: 'SBIN', type: 'buy', quantity: 200, price: 720, total: 144000, timestamp: '2025-05-16T09:45:00' },
];

// ============ Mock Broker Class ============

export class MockBroker implements IBroker {
  readonly name = 'Mock Broker';
  private connected = false;
  private tickSubscriptions = new Map<string, ReturnType<typeof setInterval>>();

  async authenticate(_config: BrokerConfig): Promise<boolean> {
    await new Promise(r => setTimeout(r, 500));
    this.connected = true;
    return true;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getIndices(): Promise<IndexData[]> {
    await this.delay();
    return mockIndices.map(idx => ({
      ...idx,
      currentValue: idx.currentValue + (Math.random() - 0.5) * 100,
      change: idx.change + (Math.random() - 0.5) * 20,
      changePercent: idx.changePercent + (Math.random() - 0.5) * 0.3,
    }));
  }

  async getStocks(): Promise<StockInfo[]> {
    await this.delay();
    return mockStocks.map(s => ({
      ...s,
      price: s.price + (Math.random() - 0.5) * s.price * 0.02,
      change: s.change + (Math.random() - 0.5) * 5,
      changePercent: s.changePercent + (Math.random() - 0.5) * 0.5,
    }));
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    await this.delay(200);
    const stock = mockStocks.find(s => s.symbol === symbol);
    if (!stock) throw new Error(`Stock not found: ${symbol}`);
    return generateQuote(stock);
  }

  async getBulkQuotes(symbols: string[]): Promise<Map<string, MarketQuote>> {
    await this.delay(300);
    const map = new Map<string, MarketQuote>();
    for (const symbol of symbols) {
      const stock = mockStocks.find(s => s.symbol === symbol);
      if (stock) map.set(symbol, generateQuote(stock));
    }
    return map;
  }

  async getOHLC(symbol: string, interval: string, days: number): Promise<OHLCData[]> {
    await this.delay(400);
    const stock = mockStocks.find(s => s.symbol === symbol);
    if (!stock) throw new Error(`Stock not found: ${symbol}`);

    // Map common interval aliases
    const normalizedInterval = interval
      .replace(/^1d$/i, '1d')
      .replace(/^day$/i, '1d')
      .replace(/^daily$/i, '1d')
      .replace(/^1w$/i, '1w')
      .replace(/^week$/i, '1w')
      .replace(/^weekly$/i, '1w')
      .replace(/^1m$/i, '1m')
      .replace(/^month$/i, '1m')
      .replace(/^monthly$/i, '1m')
      .replace(/^1h$/i, '1h')
      .replace(/^hour$/i, '1h')
      .replace(/^hourly$/i, '1h')
      .replace(/^1min$/i, '1min')
      .replace(/^5min$/i, '5min')
      .replace(/^15min$/i, '15min')
      .replace(/^30min$/i, '30min');

    return generateMultiTimeframeOHLC(stock.price, normalizedInterval, days);
  }

  async searchStocks(query: string): Promise<StockInfo[]> {
    await this.delay(200);
    const q = query.toLowerCase();
    return mockStocks.filter(
      s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }

  // ======================== Order Modification & Cancellation ========================

  async getOpenOrders(): Promise<OpenOrder[]> {
    await this.delay(200);
    return [...mockOpenOrders];
  }

  async modifyOrder(order: ModifyOrderPayload): Promise<OrderResult> {
    await this.delay(400);
    const existing = mockOpenOrders.find(o => o.id === order.orderId);
    if (!existing) {
      return {
        id: order.orderId,
        status: 'rejected',
        message: `Order ${order.orderId} not found or already completed`,
        timestamp: new Date().toISOString(),
      };
    }

    // Update fields
    if (order.price !== undefined) existing.price = order.price;
    if (order.quantity !== undefined) existing.quantity = order.quantity;
    if (order.orderType !== undefined) existing.orderType = order.orderType;
    if (order.productType !== undefined) existing.productType = order.productType;
    if (order.triggerPrice !== undefined) existing.triggerPrice = order.triggerPrice;

    mockOpenOrders = mockOpenOrders.map(o =>
      o.id === order.orderId ? existing : o
    );

    return {
      id: order.orderId,
      status: 'confirmed',
      message: `Order ${order.orderId} modified successfully`,
      timestamp: new Date().toISOString(),
    };
  }

  async cancelOrder(order: CancelOrderPayload): Promise<OrderResult> {
    await this.delay(300);
    const existing = mockOpenOrders.find(o => o.id === order.orderId);
    if (!existing) {
      return {
        id: order.orderId,
        status: 'rejected',
        message: `Order ${order.orderId} not found or already completed`,
        timestamp: new Date().toISOString(),
      };
    }

    // Remove from open orders & add to trade history
    mockOpenOrders = mockOpenOrders.filter(o => o.id !== order.orderId);
    mockTradeHistory.unshift({
      id: `t_cancel_${Date.now()}`,
      symbol: existing.symbol,
      type: existing.transactionType === 'BUY' ? 'buy' : 'sell',
      quantity: existing.quantity - existing.filledQuantity,
      price: existing.price,
      total: existing.price * (existing.quantity - existing.filledQuantity),
      timestamp: new Date().toISOString(),
    });

    return {
      id: order.orderId,
      status: 'cancelled',
      message: `Order ${order.orderId} cancelled successfully`,
      timestamp: new Date().toISOString(),
    };
  }

  async placeOrder(order: OrderPayload): Promise<OrderResult> {
    await this.delay(800);

    const stock = mockStocks.find(s => s.symbol === order.symbol);
    if (!stock) {
      const result: OrderResult = {
        id: `ord_${Date.now()}`,
        status: 'rejected',
        message: `Symbol ${order.symbol} not found`,
        timestamp: new Date().toISOString(),
      };
      mockOrders.push(result);
      return result;
    }

    // Update mock positions
    const existingPos = mockPositions.find(p => p.symbol === order.symbol);
    const executedPrice = order.orderType === 'MARKET' ? stock.price : order.price;

    if (order.transactionType === 'BUY') {
      if (existingPos) {
        const newQty = existingPos.quantity + order.quantity;
        const newInvested = (existingPos.buyPrice * existingPos.quantity) + (executedPrice * order.quantity);
        existingPos.quantity = newQty;
        existingPos.buyPrice = newInvested / newQty;
        existingPos.currentPrice = stock.price;
        existingPos.pnl = (newQty * stock.price) - newInvested;
        existingPos.pnlPercent = existingPos.pnl / newInvested * 100;
      } else {
        mockPositions.push({
          symbol: order.symbol,
          quantity: order.quantity,
          buyPrice: executedPrice,
          currentPrice: stock.price,
          pnl: 0,
          pnlPercent: 0,
        });
      }
    } else {
      if (existingPos) {
        existingPos.quantity -= order.quantity;
        if (existingPos.quantity <= 0) {
          mockPositions = mockPositions.filter(p => p.symbol !== order.symbol);
        }
      }
    }

    // Record trade
    mockTradeHistory.unshift({
      id: `t_${Date.now()}`,
      symbol: order.symbol,
      type: order.transactionType === 'BUY' ? 'buy' : 'sell',
      quantity: order.quantity,
      price: executedPrice,
      total: executedPrice * order.quantity,
      timestamp: new Date().toISOString(),
    });

    const result: OrderResult = {
      id: `ord_${Date.now()}`,
      status: 'confirmed',
      message: `${order.transactionType} order for ${order.quantity} ${order.symbol} @ ₹${executedPrice} executed successfully`,
      timestamp: new Date().toISOString(),
    };
    mockOrders.push(result);
    return result;
  }

  async getPositions(): Promise<Position[]> {
    await this.delay(300);
    return mockPositions.map(p => ({
      ...p,
      currentPrice: p.currentPrice + (Math.random() - 0.5) * p.currentPrice * 0.01,
      pnl: 0, // recalc
      pnlPercent: 0,
    })).map(p => {
      const pnl = (p.currentPrice * p.quantity) - (p.buyPrice * p.quantity);
      return {
        ...p,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnl / (p.buyPrice * p.quantity) * 10000) / 100,
      };
    });
  }

  async getTradeHistory(): Promise<TradeHistory[]> {
    await this.delay(200);
    return mockTradeHistory;
  }

  async getHoldings(): Promise<Position[]> {
    return this.getPositions();
  }

  subscribeTicks(symbols: string[], onTick: (quote: MarketQuote) => void): () => void {
    const interval = setInterval(() => {
      symbols.forEach(symbol => {
        const stock = mockStocks.find(s => s.symbol === symbol);
        if (stock) {
          onTick(generateQuote(stock));
        }
      });
    }, 1000 + Math.random() * 2000);

    symbols.forEach(s => this.tickSubscriptions.set(s, interval));

    return () => {
      clearInterval(interval);
      symbols.forEach(s => this.tickSubscriptions.delete(s));
    };
  }

  // ======================== EDIS (Mock) ========================

  async verifyEDIS(request: EDISVerifyRequest): Promise<EDISVerifyResponse> {
    await this.delay(400);
    return {
      ReqId: `REQ_${Date.now()}`,
      ReturnURL: 'https://cdslindia.com/verify',
      DPId: '12345',
      BOID: `BO_${request.isin}`,
      TransDtls: `TRAN_${Date.now()}`,
    };
  }

  async generateTPIN(_request: EDISGenerateTPINRequest): Promise<{ status: string }> {
    await this.delay(300);
    return { status: 'TPIN generated successfully' };
  }

  async getEDISTranStatus(request: EDISTranStatusRequest): Promise<EDISTranStatusResponse> {
    await this.delay(200);
    return { ReqId: request.ReqId, status: 1 };
  }

  // ======================== Brokerage Calculator (Mock) ========================

  async estimateBrokerage(request: BrokerageEstimateRequest): Promise<BrokerageEstimateResponse> {
    await this.delay(300);
    const totalOrderValue = request.orders.reduce(
      (sum, o) => sum + o.price * o.qty,
      0,
    );
    const brokerage = Math.round(totalOrderValue * 0.0003 * 100) / 100; // ~0.03%
    const sttCtt = Math.round(totalOrderValue * 0.001 * 100) / 100;    // ~0.1%
    const transactionCharges = Math.round(totalOrderValue * 0.0001 * 100) / 100;
    const gst = Math.round((brokerage + transactionCharges) * 0.18 * 100) / 100;
    const stampDuty = Math.round(totalOrderValue * 0.00003 * 100) / 100;
    const sebiFees = Math.round(totalOrderValue * 0.000002 * 100) / 100;
    const total = Math.round(
      (brokerage + transactionCharges + gst + sttCtt + stampDuty + sebiFees) * 100,
    ) / 100;

    return {
      status: 'SUCCESS',
      payload: {
        brokerage,
        transaction_charges: transactionCharges,
        gst,
        stt_ctt: sttCtt,
        stamp_duty: stampDuty,
        sebi_turnover_fees: sebiFees,
        total_charges: total,
      },
    };
  }

  // Simulate market hours — only during "market hours"
  private async delay(ms: number = 500): Promise<void> {
    return new Promise(r => setTimeout(r, ms * (0.5 + Math.random())));
  }
}
