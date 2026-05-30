/**
 * ============================================================================
 * Toroloom Zerodha Kite Connect Broker — Unit Tests
 * ============================================================================
 *
 * Tests the ZerodhaBroker class by injecting mock SDK instances via constructor.
 * This avoids mocking npm packages (kiteconnect) which are not installed as
 * direct dependencies.
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/zerodhaBroker.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZerodhaBroker } from '../services/broker/zerodhaBroker';
import type { BrokerConfig, OrderPayload } from '../services/broker/interface';

// ──── Mock SDK helpers ──────────────────────────────────────────────────────

function createMockKiteConnect() {
  return {
    setAccessToken: vi.fn(),
    generateSession: vi.fn().mockResolvedValue({
      access_token: 'new-access-token',
    }),
    getInstruments: vi.fn().mockResolvedValue([
      { tradingsymbol: 'RELIANCE', instrument_token: '12345', exchange: 'NSE', segment: 'NSE_EQ', name: 'Reliance Industries' },
      { tradingsymbol: 'TCS', instrument_token: '67890', exchange: 'NSE', segment: 'NSE_EQ', name: 'TCS Ltd' },
    ]),
    getQuote: vi.fn().mockResolvedValue({
      'NSE:NIFTY 50': { last_price: 23456, net_change: 345, change_percent: 1.49, ohlc: { open: 23100 } },
      'NSE:NIFTY BANK': { last_price: 49234, net_change: 567, change_percent: 1.17 },
      'NSE:RELIANCE': { last_price: 2890, net_change: 45, change_percent: 1.59, ohlc: { open: 2850, high: 2900, low: 2840, close: 2870 }, volume: 12500000, depth: { buy: [{ price: 2889 }], sell: [{ price: 2891 }] }, timestamp: '2025-05-30T10:00:00' },
      'NSE:TCS': { last_price: 3890, net_change: -34, change_percent: -0.88, volume: 8200000, timestamp: '2025-05-30T10:00:00' },
    }),
    getHistoricalData: vi.fn().mockResolvedValue([
      ['2025-05-29T00:00', 2850, 2900, 2840, 2880, 1000000],
      ['2025-05-30T00:00', 2880, 2920, 2870, 2910, 1200000],
    ]),
    placeOrder: vi.fn().mockResolvedValue('ord_123'),
    getPositions: vi.fn().mockResolvedValue({
      net: [{ tradingsymbol: 'RELIANCE', quantity: '50', average_price: '2650', last_price: '2890', pnl: '12000' }],
      day: [],
    }),
    getTrades: vi.fn().mockResolvedValue([
      { trade_id: 't1', tradingsymbol: 'RELIANCE', transaction_type: 'buy', quantity: '50', average_price: '2650', trade_date: '2025-05-20T09:30:00' },
    ]),
    getHoldings: vi.fn().mockResolvedValue([
      { tradingsymbol: 'RELIANCE', quantity: '50', average_price: '2650', last_price: '2890', pnl: '12000' },
    ]),
  };
}

function createMockKiteTicker() {
  const ticker: Record<string, any> = {
    on: vi.fn(),
    subscribe: vi.fn(),
    setMode: vi.fn(),
    autoReconnect: vi.fn(),
    connect: vi.fn(),
    unsubscribe: vi.fn(),
    close: vi.fn(),
    modeFull: 'full',
  };
  return ticker;
}

// ──── Test Helpers ──────────────────────────────────────────────────────────

function createConfig(overrides: Partial<BrokerConfig> = {}): BrokerConfig {
  return {
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    accessToken: 'test-access-token',
    ...overrides,
  };
}

// ──── Tests ─────────────────────────────────────────────────────────────────

describe('ZerodhaBroker', () => {
  // Plain constructor functions for DI — vi.fn() with arrow function
  // cannot be used as a constructor ("not a constructor" error),
  // so we use regular functions that return the mock instance.
  let mockKite: ReturnType<typeof createMockKiteConnect>;
  let mockTicker: ReturnType<typeof createMockKiteTicker>;
  let broker: ZerodhaBroker;

  function MockKiteConnect(this: any, ...args: any[]) { return mockKite; }
  function MockKiteTicker(this: any, ...args: any[]) { return mockTicker; }

  beforeEach(() => {
    mockKite = createMockKiteConnect();
    mockTicker = createMockKiteTicker();
    broker = new ZerodhaBroker({ KiteConnect: MockKiteConnect as any, KiteTicker: MockKiteTicker as any });
  });

  // ──────────────── Authentication ────────────────

  describe('authenticate', () => {
    it('should authenticate with access token', async () => {
      const result = await broker.authenticate(createConfig());

      expect(result).toBe(true);
      expect(broker.isConnected()).toBe(true);
      expect(mockKite.setAccessToken).toHaveBeenCalledWith('test-access-token');
    });

    it('should generate session with request token', async () => {
      mockKite.getInstruments.mockResolvedValue([]);

      const result = await broker.authenticate(
        createConfig({ accessToken: undefined, requestToken: 'req-token' } as any),
      );

      expect(result).toBe(true);
      expect(mockKite.generateSession).toHaveBeenCalledWith('req-token', 'test-api-secret');
      expect(mockKite.setAccessToken).toHaveBeenCalledWith('new-access-token');
    });

    it('should reject when API key is missing', async () => {
      await expect(broker.authenticate(createConfig({ apiKey: '' }))).rejects.toThrow(
        'Zerodha API key is required',
      );
    });

    it('should reject when API secret is missing', async () => {
      await expect(broker.authenticate(createConfig({ apiSecret: '' }))).rejects.toThrow(
        'Zerodha API secret is required',
      );
    });

    it('should return false when no access/request token provided', async () => {
      const result = await broker.authenticate(createConfig({ accessToken: undefined } as any));
      expect(result).toBe(false);
    });

    it('should handle instrument loading failure gracefully', async () => {
      mockKite.getInstruments.mockRejectedValue(new Error('Instrument fetch failed'));

      const result = await broker.authenticate(createConfig());
      expect(result).toBe(true);
    });

    it('should return false on SDK failure', async () => {
      mockKite.setAccessToken.mockImplementation(() => {
        throw new Error('SDK error');
      });

      const result = await broker.authenticate(createConfig());
      expect(result).toBe(false);
    });
  });

  // ──────────────── isConnected ────────────────

  describe('isConnected', () => {
    it('should return false before authentication', () => {
      expect(broker.isConnected()).toBe(false);
    });

    it('should return true after successful authentication', async () => {
      await broker.authenticate(createConfig());
      expect(broker.isConnected()).toBe(true);
    });
  });

  // ──────────────── requireAuth ────────────────

  describe('requireAuth guard', () => {
    it('should throw when not authenticated', async () => {
      await expect(broker.getIndices()).rejects.toThrow(
        'Zerodha broker not authenticated',
      );
    });
  });

  // ──────────────── Market Data: getIndices ────────────────

  describe('getIndices', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return index data', async () => {
      const indices = await broker.getIndices();

      expect(indices.length).toBeGreaterThan(0);
      const nifty = indices.find((i) => i.name === 'NIFTY 50');
      expect(nifty).toBeDefined();
      expect(nifty!.currentValue).toBe(23456);
    });

    it('should skip indices with no quote data', async () => {
      mockKite.getQuote.mockResolvedValue({
        'NSE:NIFTY 50': null,
      });

      const indices = await broker.getIndices();
      expect(Array.isArray(indices)).toBe(true);
    });
  });

  // ──────────────── Market Data: getQuote ────────────────

  describe('getQuote', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return market quote for a valid symbol', async () => {
      const quote = await broker.getQuote('RELIANCE');

      expect(quote.symbol).toBe('RELIANCE');
      expect(quote.lastPrice).toBe(2890);
      expect(quote.open).toBe(2850);
      expect(quote.high).toBe(2900);
      expect(quote.low).toBe(2840);
      expect(quote.close).toBe(2870);
      expect(quote.bid).toBe(2889);
      expect(quote.ask).toBe(2891);
    });

    it('should throw for unknown symbol', async () => {
      mockKite.getQuote.mockResolvedValue({ 'NSE:UNKNOWN': null });

      await expect(broker.getQuote('UNKNOWN')).rejects.toThrow('No quote data for UNKNOWN');
    });

    it('should use default values when OHLC is missing', async () => {
      mockKite.getQuote.mockResolvedValue({
        'NSE:TCS': {
          last_price: 3890, net_change: -34, change_percent: -0.88,
          volume: 8200000, timestamp: '2025-05-30T10:00:00',
        },
      });

      const quote = await broker.getQuote('TCS');
      expect(quote.open).toBe(3890);
      expect(quote.high).toBe(3890);
      expect(quote.low).toBe(3890);
      expect(quote.close).toBe(3890);
    });
  });

  // ──────────────── Market Data: getBulkQuotes ────────────────

  describe('getBulkQuotes', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return quotes for multiple symbols', async () => {
      const map = await broker.getBulkQuotes(['RELIANCE', 'TCS']);

      expect(map.size).toBe(2);
      expect(map.get('RELIANCE')!.lastPrice).toBe(2890);
      expect(map.get('TCS')!.lastPrice).toBe(3890);
    });

    it('should skip symbols with no quote data', async () => {
      mockKite.getQuote.mockResolvedValue({
        'NSE:RELIANCE': { last_price: 2890 },
      });

      const map = await broker.getBulkQuotes(['RELIANCE', 'UNKNOWN']);
      expect(map.size).toBe(1);
      expect(map.has('RELIANCE')).toBe(true);
    });
  });

  // ──────────────── Market Data: getOHLC ────────────────

  describe('getOHLC', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return OHLC data array', async () => {
      const ohlc = await broker.getOHLC('RELIANCE', '1d', 5);

      expect(ohlc.length).toBe(2);
      expect(ohlc[0]).toMatchObject({
        date: expect.any(String), open: 2850, high: 2900,
        low: 2840, close: 2880, volume: 1000000,
      });
    });

    it('should map intervals correctly', async () => {
      mockKite.getHistoricalData.mockResolvedValue([]);

      await broker.getOHLC('RELIANCE', '5m', 1);

      expect(mockKite.getHistoricalData).toHaveBeenCalledWith(
        'NSE:RELIANCE', '5minute', expect.any(String), expect.any(String),
      );
    });

    it('should return empty on null data', async () => {
      mockKite.getHistoricalData.mockResolvedValue(null);

      expect(await broker.getOHLC('RELIANCE', '1d', 5)).toEqual([]);
    });
  });

  // ──────────────── Market Data: getStocks ────────────────

  describe('getStocks', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return stock info list', async () => {
      const stocks = await broker.getStocks();

      expect(stocks.length).toBe(2);
      const reliance = stocks.find(s => s.symbol === 'RELIANCE');
      expect(reliance).toBeDefined();
      expect(reliance!.price).toBe(2890);
    });

    it('should handle empty instruments', async () => {
      // Make getInstruments return empty so cache stays empty
      const innerMock = createMockKiteConnect();
      innerMock.getInstruments.mockResolvedValue([]);
      function InnerKCCtor(this: any) { return innerMock; }
      function InnerKTCtor(this: any) { return createMockKiteTicker(); }
      const emptyBroker = new ZerodhaBroker({ KiteConnect: InnerKCCtor as any, KiteTicker: InnerKTCtor as any });

      await emptyBroker.authenticate(createConfig());
      expect(await emptyBroker.getStocks()).toEqual([]);
    });

    it('should handle quote fetch failure', async () => {
      mockKite.getQuote.mockRejectedValue(new Error('Failed'));

      const stocks = await broker.getStocks();
      expect(stocks.length).toBe(2);
      expect(stocks[0].price).toBe(0);
    });
  });

  // ──────────────── Market Data: searchStocks ────────────────

  describe('searchStocks', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return matching results', async () => {
      mockKite.getInstruments.mockResolvedValue([
        { tradingsymbol: 'RELIANCE', instrument_token: '12345', segment: 'NSE_EQ', name: 'Reliance Industries' },
        { tradingsymbol: 'RELINFRA', instrument_token: '67890', segment: 'NSE_EQ', name: 'Reliance Infra' },
      ]);

      const results = await broker.searchStocks('REL');

      expect(results.length).toBe(2);
      expect(results[0].symbol).toContain('REL');
    });

    it('should return empty on no matches', async () => {
      mockKite.getInstruments.mockResolvedValue([]);
      expect(await broker.searchStocks('ZZZZZ')).toEqual([]);
    });

    it('should handle quote fetch failure', async () => {
      mockKite.getInstruments.mockResolvedValue([
        { tradingsymbol: 'RELIANCE', instrument_token: '12345', segment: 'NSE_EQ', name: 'Reliance' },
      ]);
      mockKite.getQuote.mockRejectedValue(new Error('Failed'));

      const results = await broker.searchStocks('REL');
      expect(results.length).toBe(1);
      expect(results[0].price).toBe(0);
    });
  });

  // ──────────────── Trading: placeOrder ────────────────

  describe('placeOrder', () => {
    const sampleOrder: OrderPayload = {
      symbol: 'RELIANCE', exchange: 'NSE', transactionType: 'BUY',
      quantity: 10, price: 2900, productType: 'CNC', orderType: 'LIMIT',
    };

    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should place a buy limit order', async () => {
      const result = await broker.placeOrder(sampleOrder);

      // Kite SDK returns just an order_id string; broker maps to 'pending' status
      expect(result.status).toBe('pending');
      expect(result.id).toBe('ord_123');
      expect(mockKite.placeOrder).toHaveBeenCalledWith(
        'regular',
        expect.objectContaining({ tradingsymbol: 'RELIANCE', transaction_type: 'BUY' }),
      );
    });

    it('should handle object result with order_id', async () => {
      mockKite.placeOrder.mockResolvedValue({
        order_id: 'ord_456', status: 'success', message: 'Placed',
      });

      const result = await broker.placeOrder(sampleOrder);
      expect(result.id).toBe('ord_456');
      expect(result.status).toBe('confirmed');
    });

    it('should return pending for unknown status', async () => {
      mockKite.placeOrder.mockResolvedValue({
        order_id: 'ord_789', status: 'submitted',
      });

      const result = await broker.placeOrder(sampleOrder);
      expect(result.status).toBe('pending');
    });

    it('should throw on null result', async () => {
      mockKite.placeOrder.mockResolvedValue(null);

      await expect(broker.placeOrder(sampleOrder)).rejects.toThrow(
        'Zerodha placeOrder returned no result',
      );
    });
  });

  // ──────────────── Trading: getPositions ────────────────

  describe('getPositions', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return net positions', async () => {
      const positions = await broker.getPositions();
      expect(positions.length).toBe(1);
      expect(positions[0].symbol).toBe('RELIANCE');
    });

    it('should filter zero-quantity positions', async () => {
      mockKite.getPositions.mockResolvedValue({
        net: [{ tradingsymbol: 'RELIANCE', quantity: '0' }],
        day: [],
      });

      expect(await broker.getPositions()).toEqual([]);
    });

    it('should return empty array', async () => {
      mockKite.getPositions.mockResolvedValue({ net: [], day: [] });
      expect(await broker.getPositions()).toEqual([]);
    });
  });

  // ──────────────── Trading: getTradeHistory ────────────────

  describe('getTradeHistory', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return trades', async () => {
      const trades = await broker.getTradeHistory();
      expect(trades.length).toBe(1);
      expect(trades[0].id).toBe('t1');
    });

    it('should return empty array', async () => {
      mockKite.getTrades.mockResolvedValue([]);
      expect(await broker.getTradeHistory()).toEqual([]);
    });
  });

  // ──────────────── Portfolio: getHoldings ────────────────

  describe('getHoldings', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return filtered holdings', async () => {
      const holdings = await broker.getHoldings();
      expect(holdings.length).toBe(1);
      expect(holdings[0].symbol).toBe('RELIANCE');
    });

    it('should return empty array', async () => {
      mockKite.getHoldings.mockResolvedValue([]);
      expect(await broker.getHoldings()).toEqual([]);
    });
  });

  // ──────────────── Real-time: subscribeTicks ────────────────

  describe('subscribeTicks', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should subscribe and return unsubscribe function', async () => {
      const onTick = vi.fn();
      const unsubscribe = broker.subscribeTicks(['RELIANCE'], onTick);

      expect(mockTicker.connect).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');

      // Simulate a tick
      const ticksHandler = mockTicker.on.mock.calls.find(
        (c: any[]) => c[0] === 'ticks',
      );
      expect(ticksHandler).toBeDefined();
      ticksHandler[1]([{ instrument_token: 12345, last_price: 2900, change: 10 }]);

      expect(onTick).toHaveBeenCalledWith(expect.objectContaining({ lastPrice: 2900 }));

      // Simulate connect handler
      const connectHandler = mockTicker.on.mock.calls.find(
        (c: any[]) => c[0] === 'connect',
      );
      expect(connectHandler).toBeDefined();
      connectHandler[1]();
      expect(mockTicker.subscribe).toHaveBeenCalled();

      // Unsubscribe
      unsubscribe();
      expect(mockTicker.unsubscribe).toHaveBeenCalled();
      expect(mockTicker.close).toHaveBeenCalled();
    });

    it('should handle subscribe with no cached instruments', async () => {
      const freshMockTicker = createMockKiteTicker();
      const freshMockKite = createMockKiteConnect();
      freshMockKite.getInstruments.mockResolvedValue([]);
      function FreshKCCtor(this: any) { return freshMockKite; }
      function FreshKTCtor(this: any) { return freshMockTicker; }
      const freshBroker = new ZerodhaBroker({ KiteConnect: FreshKCCtor as any, KiteTicker: FreshKTCtor as any });
      await freshBroker.authenticate(createConfig());
      vi.clearAllMocks();

      const unsubscribe = freshBroker.subscribeTicks(['UNKNOWN'], vi.fn());
      expect(typeof unsubscribe).toBe('function');
      expect(freshMockTicker.connect).toHaveBeenCalled();
    });

    it('should handle error event without throwing', async () => {
      broker.subscribeTicks(['RELIANCE'], vi.fn());

      const errorHandler = mockTicker.on.mock.calls.find(
        (c: any[]) => c[0] === 'error',
      );
      expect(errorHandler).toBeDefined();
      expect(() => errorHandler[1](new Error('Ticker error'))).not.toThrow();
    });

    it('should handle SDK setup failure', async () => {
      function ThrowingKT(this: any, ...args: any[]) { throw new Error('SDK not available'); }
      const brokenBroker = new ZerodhaBroker({ KiteConnect: MockKiteConnect as any, KiteTicker: ThrowingKT as any });
      await brokenBroker.authenticate(createConfig());
      vi.clearAllMocks();

      const unsubscribe = brokenBroker.subscribeTicks(['RELIANCE'], vi.fn());
      expect(typeof unsubscribe).toBe('function');
    });
  });
});
