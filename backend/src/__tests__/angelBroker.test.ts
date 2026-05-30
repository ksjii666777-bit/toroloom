/**
 * ============================================================================
 * Toroloom Angel One Broker — Unit Tests
 * ============================================================================
 *
 * Tests the AngelBroker class by injecting mock SDK instances via constructor.
 * This avoids mocking npm packages (smartapi-javascript) which are not
 * installed as direct dependencies.
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/angelBroker.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AngelBroker } from '../services/broker/angelBroker';
import type { BrokerConfig, OrderPayload } from '../services/broker/interface';

// ──── Mock SDK helpers ──────────────────────────────────────────────────────

function createMockSmartApi() {
  return {
    setAccessToken: vi.fn(),
    generateSession: vi.fn().mockResolvedValue({
      data: { jwtToken: 'test-jwt', feedToken: 'test-feed-token' },
    }),
    setSessionExpiryHook: vi.fn(),
    ltpData: vi.fn().mockResolvedValue({ data: { ltp: 2890, exch_tm: '2025-05-30T10:00:00' } }),
    getCandleData: vi.fn().mockResolvedValue({
      data: [['2025-05-30T00:00', 2870, 2900, 2860, 2880, 5000000]],
    }),
    searchScrip: vi.fn().mockResolvedValue({
      data: [{ tradingsymbol: 'RELIANCE', symboltoken: '12345' }],
    }),
    placeOrder: vi.fn().mockResolvedValue({
      status: 'success',
      data: { orderid: 'ord_123' },
      message: 'Order placed successfully',
    }),
    getPosition: vi.fn().mockResolvedValue({
      data: [
        { tradingsymbol: 'RELIANCE', quantity: '50', buy_price: '2650', ltp: '2890', pnl: '12000', pnl_percentage: '9.05' },
      ],
    }),
    getTradeBook: vi.fn().mockResolvedValue({
      data: [
        { tradeid: 't1', tradingsymbol: 'RELIANCE', transactiontype: 'BUY', quantity: '50', price: '2650', total: '132500', exch_tm: '2025-05-20T09:30:00' },
      ],
    }),
    getHolding: vi.fn().mockResolvedValue({
      data: [
        { tradingsymbol: 'RELIANCE', quantity: '50', average_price: '2650', ltp: '2890', pnl: '12000', pnl_percentage: '9.05' },
      ],
    }),
  };
}

function createMockWebSocketV2() {
  return {
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    fetchData: vi.fn(),
    close: vi.fn(),
  };
}

// ──── Test Helpers ──────────────────────────────────────────────────────────

function createConfig(overrides: Partial<BrokerConfig> = {}): BrokerConfig {
  return {
    apiKey: 'test-api-key',
    clientId: 'test-client',
    accessToken: 'test-access-token',
    ...overrides,
  };
}

// ──── Tests ─────────────────────────────────────────────────────────────────

describe('AngelBroker', () => {
  // Plain constructor functions for DI — vi.fn() with arrow function
  // cannot be used as a constructor ("not a constructor" error),
  // so we use regular functions that return the mock instance.
  let mockSmartApi: ReturnType<typeof createMockSmartApi>;
  let mockWebSocket: ReturnType<typeof createMockWebSocketV2>;
  let broker: AngelBroker;

  function MockSmartAPI(this: any, ...args: any[]) { return mockSmartApi; }
  function MockWebSocketV2(this: any, ...args: any[]) { return mockWebSocket; }

  beforeEach(() => {
    mockSmartApi = createMockSmartApi();
    mockWebSocket = createMockWebSocketV2();
    broker = new AngelBroker({ SmartAPI: MockSmartAPI as any, WebSocketV2: MockWebSocketV2 as any });
  });

  // ──────────────── Authentication ────────────────

  describe('authenticate', () => {
    it('should authenticate with access token', async () => {
      const result = await broker.authenticate(createConfig());

      expect(result).toBe(true);
      expect(broker.isConnected()).toBe(true);
      expect(mockSmartApi.setAccessToken).toHaveBeenCalledWith('test-access-token');
      expect(mockSmartApi.setSessionExpiryHook).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should generate new session when no access token provided', async () => {
      mockSmartApi.generateSession.mockResolvedValue({
        data: { jwtToken: 'new-jwt', feedToken: 'new-feed-token' },
      });

      const result = await broker.authenticate(
        createConfig({ accessToken: undefined, password: 'pwd' } as any),
      );

      expect(result).toBe(true);
      expect(mockSmartApi.generateSession).toHaveBeenCalledWith('test-client', 'pwd', undefined);
      expect(mockSmartApi.setAccessToken).toHaveBeenCalledWith('new-jwt');
    });

    it('should generate session with password and totp', async () => {
      mockSmartApi.generateSession.mockResolvedValue({
        data: { jwtToken: 'new-jwt', feedToken: 'new-feed-token' },
      });

      await broker.authenticate(createConfig({
        accessToken: undefined,
        password: 'test-password',
        totp: 'test-totp',
      } as any));

      expect(mockSmartApi.generateSession).toHaveBeenCalledWith(
        'test-client', 'test-password', 'test-totp',
      );
    });

    it('should reject when API key is missing', async () => {
      await expect(broker.authenticate(createConfig({ apiKey: '' }))).rejects.toThrow(
        'Angel One API key is required',
      );
      expect(broker.isConnected()).toBe(false);
    });

    it('should reject when client ID is missing', async () => {
      await expect(broker.authenticate(createConfig({ clientId: '' }))).rejects.toThrow(
        'Angel One client ID is required',
      );
      expect(broker.isConnected()).toBe(false);
    });

    it('should return false when generateSession fails', async () => {
      mockSmartApi.generateSession.mockRejectedValue(new Error('Invalid credentials'));

      const result = await broker.authenticate(
        createConfig({ accessToken: undefined, password: 'pwd' } as any),
      );
      expect(result).toBe(false);
    });

    it('should return false on SDK failure', async () => {
      mockSmartApi.setAccessToken.mockImplementation(() => {
        throw new Error('SDK error');
      });

      const result = await broker.authenticate(createConfig());
      expect(result).toBe(false);
    });

    it('should call session expiry hook and set connected to false', async () => {
      await broker.authenticate(createConfig());
      const hook = mockSmartApi.setSessionExpiryHook.mock.calls[0][0];
      hook();
      expect(broker.isConnected()).toBe(false);
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
        'Angel One broker not authenticated',
      );
    });
  });

  // ──────────────── Market Data: getIndices ────────────────

  describe('getIndices', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return index data for all default indices', async () => {
      mockSmartApi.ltpData.mockResolvedValue({
        data: { ltp: 23500, exch_tm: '2025-05-30T10:00:00' },
      });
      mockSmartApi.getCandleData.mockResolvedValue({
        data: [['2025-05-30T00:00', 23400, 23600, 23300, 23500, 1000000]],
      });

      const indices = await broker.getIndices();
      expect(indices.length).toBeGreaterThan(0);
      expect(indices[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        currentValue: expect.any(Number),
      });
    });

    it('should handle partial index fetch failures gracefully', async () => {
      mockSmartApi.ltpData
        .mockResolvedValueOnce({ data: { ltp: 23500 } })
        .mockRejectedValueOnce(new Error('API error'));

      const indices = await broker.getIndices();
      expect(indices.length).toBeGreaterThanOrEqual(1);
    });

    it('should calculate change and changePercent correctly', async () => {
      mockSmartApi.ltpData.mockResolvedValue({ data: { ltp: 24000 } });
      mockSmartApi.getCandleData.mockResolvedValue({
        data: [['2025-05-30T00:00', 23000, 24100, 22900, 24000, 1000000]],
      });

      const indices = await broker.getIndices();
      const nifty = indices.find((i) => i.id === 'NIFTY');
      expect(nifty).toBeDefined();
      expect(nifty!.isPositive).toBe(true);
    });

    it('should handle when ltpData returns no data', async () => {
      mockSmartApi.ltpData.mockResolvedValue({ data: null });

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
      mockSmartApi.searchScrip.mockResolvedValue({
        data: [{ tradingsymbol: 'RELIANCE', symboltoken: '12345' }],
      });
      mockSmartApi.ltpData.mockResolvedValue({
        data: { ltp: 2890, exch_tm: '2025-05-30T10:00:00' },
      });
      mockSmartApi.getCandleData.mockResolvedValue({
        data: [['2025-05-30T00:00', 2870, 2900, 2860, 2880, 5000000]],
      });

      const quote = await broker.getQuote('RELIANCE');

      expect(quote.symbol).toBe('RELIANCE');
      expect(quote.lastPrice).toBe(2890);
      expect(quote.open).toBe(2870);
      expect(quote.high).toBe(2900);
      expect(quote.low).toBe(2860);
      expect(quote.close).toBe(2880);
      expect(quote.volume).toBe(5000000);
    });

    it('should use cached token on subsequent calls', async () => {
      mockSmartApi.searchScrip.mockResolvedValue({
        data: [{ tradingsymbol: 'RELIANCE', symboltoken: '12345' }],
      });
      mockSmartApi.ltpData.mockResolvedValue({ data: { ltp: 2890 } });
      mockSmartApi.getCandleData.mockResolvedValue({ data: [] });

      await broker.getQuote('RELIANCE');
      await broker.getQuote('RELIANCE');

      expect(mockSmartApi.searchScrip).toHaveBeenCalledTimes(1);
    });

    it('should throw for unknown symbol', async () => {
      mockSmartApi.searchScrip.mockResolvedValue({ data: [] });

      await expect(broker.getQuote('UNKNOWN')).rejects.toThrow(
        'Could not resolve symbol token for: UNKNOWN',
      );
    });

    it('should fall back to LTP values when candle data is unavailable', async () => {
      mockSmartApi.searchScrip.mockResolvedValue({
        data: [{ tradingsymbol: 'TCS', symboltoken: '67890' }],
      });
      mockSmartApi.ltpData.mockResolvedValue({
        data: { ltp: 3890, exch_tm: '2025-05-30T10:00:00' },
      });
      mockSmartApi.getCandleData.mockRejectedValue(new Error('Candle fetch failed'));

      const quote = await broker.getQuote('TCS');
      expect(quote.lastPrice).toBe(3890);
      expect(quote.open).toBe(3890);
    });
  });

  // ──────────────── Market Data: getBulkQuotes ────────────────

  describe('getBulkQuotes', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return quotes for multiple symbols', async () => {
      mockSmartApi.searchScrip
        .mockResolvedValueOnce({ data: [{ tradingsymbol: 'RELIANCE', symboltoken: '1' }] })
        .mockResolvedValueOnce({ data: [{ tradingsymbol: 'TCS', symboltoken: '2' }] });
      mockSmartApi.ltpData
        .mockResolvedValueOnce({ data: { ltp: 2890 } })
        .mockResolvedValueOnce({ data: { ltp: 3890 } });
      mockSmartApi.getCandleData.mockResolvedValue({ data: [] });

      const map = await broker.getBulkQuotes(['RELIANCE', 'TCS']);

      expect(map.size).toBe(2);
      expect(map.get('RELIANCE')!.lastPrice).toBe(2890);
      expect(map.get('TCS')!.lastPrice).toBe(3890);
    });

    it('should handle partial failures gracefully', async () => {
      mockSmartApi.searchScrip
        .mockResolvedValueOnce({ data: [{ tradingsymbol: 'RELIANCE', symboltoken: '1' }] })
        .mockRejectedValueOnce(new Error('Not found'));
      mockSmartApi.ltpData.mockResolvedValue({ data: { ltp: 2890 } });
      mockSmartApi.getCandleData.mockResolvedValue({ data: [] });

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
      mockSmartApi.searchScrip.mockResolvedValue({
        data: [{ tradingsymbol: 'RELIANCE', symboltoken: '12345' }],
      });
      mockSmartApi.getCandleData.mockResolvedValue({
        data: [
          ['2025-05-29T00:00', 2850, 2900, 2840, 2880, 1000000],
          ['2025-05-30T00:00', 2880, 2920, 2870, 2910, 1200000],
        ],
      });

      const ohlc = await broker.getOHLC('RELIANCE', '1d', 5);

      expect(ohlc.length).toBe(2);
      expect(ohlc[0]).toMatchObject({
        date: expect.any(String),
        open: 2850, high: 2900, low: 2840, close: 2880, volume: 1000000,
      });
    });

    it('should map interval strings correctly', async () => {
      mockSmartApi.searchScrip.mockResolvedValue({
        data: [{ tradingsymbol: 'RELIANCE', symboltoken: '12345' }],
      });
      mockSmartApi.getCandleData.mockResolvedValue({ data: [] });

      await broker.getOHLC('RELIANCE', '5m', 1);

      expect(mockSmartApi.getCandleData).toHaveBeenCalledWith(
        expect.objectContaining({ interval: 'FIVE_MINUTE' }),
      );
    });

    it('should return empty array when API returns no data', async () => {
      mockSmartApi.searchScrip.mockResolvedValue({
        data: [{ tradingsymbol: 'RELIANCE', symboltoken: '12345' }],
      });
      mockSmartApi.getCandleData.mockResolvedValue({ data: null });

      const ohlc = await broker.getOHLC('RELIANCE', '1d', 5);
      expect(ohlc).toEqual([]);
    });
  });

  // ──────────────── Market Data: getStocks ────────────────

  describe('getStocks', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return a list of stock info', async () => {
      mockSmartApi.searchScrip.mockResolvedValue({
        data: [{ tradingsymbol: 'RELIANCE', symboltoken: '12345' }],
      });
      mockSmartApi.ltpData.mockResolvedValue({
        data: { ltp: 2890, exch_tm: '2025-05-30T10:00:00' },
      });
      mockSmartApi.getCandleData.mockResolvedValue({ data: [] });

      const stocks = await broker.getStocks();
      expect(Array.isArray(stocks)).toBe(true);
      expect(stocks.length).toBeGreaterThan(0);
      expect(stocks[0]).toMatchObject({
        symbol: expect.any(String),
        price: expect.any(Number),
      });
    });
  });

  // ──────────────── Market Data: searchStocks ────────────────

  describe('searchStocks', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return search results', async () => {
      mockSmartApi.searchScrip.mockResolvedValue({
        data: [
          { tradingsymbol: 'RELIANCE', symboltoken: '12345', name: 'Reliance Industries' },
          { tradingsymbol: 'RELINFRA', symboltoken: '67890', name: 'Reliance Infra' },
        ],
      });
      mockSmartApi.ltpData.mockResolvedValue({ data: { ltp: 2890 } });

      const results = await broker.searchStocks('REL');

      expect(results.length).toBe(2);
      expect(results[0].symbol).toBe('RELIANCE');
    });

    it('should return empty array when no matches', async () => {
      mockSmartApi.searchScrip.mockResolvedValue({ data: [] });

      const results = await broker.searchStocks('ZZZZZ');
      expect(results).toEqual([]);
    });

    it('should handle price fetch failures gracefully', async () => {
      mockSmartApi.searchScrip.mockResolvedValue({
        data: [{ tradingsymbol: 'RELIANCE', symboltoken: '12345' }],
      });
      mockSmartApi.ltpData.mockRejectedValue(new Error('Price fetch failed'));

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

    it('should place a buy limit order successfully', async () => {
      mockSmartApi.searchScrip.mockResolvedValue({
        data: [{ tradingsymbol: 'RELIANCE', symboltoken: '12345' }],
      });
      mockSmartApi.placeOrder.mockResolvedValue({
        status: 'success',
        data: { orderid: 'ord_123' },
        message: 'Order placed successfully',
      });

      const result = await broker.placeOrder(sampleOrder);

      expect(result.status).toBe('confirmed');
      expect(result.id).toBe('ord_123');
      expect(mockSmartApi.placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({ tradingsymbol: 'RELIANCE', transactiontype: 'BUY' }),
      );
    });

    it('should map product types correctly', async () => {
      mockSmartApi.searchScrip.mockResolvedValue({
        data: [{ tradingsymbol: 'TCS', symboltoken: '67890' }],
      });
      mockSmartApi.placeOrder.mockResolvedValue({
        status: 'success', data: { orderid: 'ord_456' },
      });

      await broker.placeOrder({ ...sampleOrder, symbol: 'TCS', productType: 'MIS' });

      expect(mockSmartApi.placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({ producttype: 'INTRADAY' }),
      );
    });

    it('should return rejected status on rejection', async () => {
      mockSmartApi.searchScrip.mockResolvedValue({
        data: [{ tradingsymbol: 'RELIANCE', symboltoken: '12345' }],
      });
      mockSmartApi.placeOrder.mockResolvedValue({
        status: 'error', message: 'Order rejected: insufficient margin', data: {},
      });

      const result = await broker.placeOrder(sampleOrder);
      expect(result.status).toBe('rejected');
    });

    it('should throw when order returns no result', async () => {
      mockSmartApi.searchScrip.mockResolvedValue({
        data: [{ tradingsymbol: 'RELIANCE', symboltoken: '12345' }],
      });
      mockSmartApi.placeOrder.mockResolvedValue(null);

      await expect(broker.placeOrder(sampleOrder)).rejects.toThrow(
        'Angel One placeOrder returned no result',
      );
    });
  });

  // ──────────────── Trading: getPositions ────────────────

  describe('getPositions', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return filtered positions', async () => {
      const positions = await broker.getPositions();

      expect(positions.length).toBe(1);
      expect(positions[0].symbol).toBe('RELIANCE');
      expect(positions[0].quantity).toBe(50);
    });

    it('should return empty array when no positions', async () => {
      mockSmartApi.getPosition.mockResolvedValue({ data: [] });

      const positions = await broker.getPositions();
      expect(positions).toEqual([]);
    });
  });

  // ──────────────── Trading: getTradeHistory ────────────────

  describe('getTradeHistory', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return trade history', async () => {
      const trades = await broker.getTradeHistory();

      expect(trades.length).toBe(1);
      expect(trades[0].id).toBe('t1');
      expect(trades[0].symbol).toBe('RELIANCE');
      expect(trades[0].type).toBe('buy');
    });

    it('should return empty array', async () => {
      mockSmartApi.getTradeBook.mockResolvedValue({ data: [] });
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
      mockSmartApi.getHolding.mockResolvedValue({ data: [] });
      expect(await broker.getHoldings()).toEqual([]);
    });
  });

  // ──────────────── Real-time: subscribeTicks ────────────────

  describe('subscribeTicks', () => {
    beforeEach(async () => {
      mockSmartApi.generateSession.mockResolvedValue({
        data: { jwtToken: 'new-jwt', feedToken: 'my-feed-token' },
      });
      await broker.authenticate(createConfig({ accessToken: undefined, password: 'pwd' } as any));
      vi.clearAllMocks();
    });

    it('should subscribe and return unsubscribe function', async () => {
      const onTick = vi.fn();
      const unsubscribe = broker.subscribeTicks(['RELIANCE'], onTick);

      expect(typeof unsubscribe).toBe('function');

      // Simulate a tick
      const tickHandler = mockWebSocket.on.mock.calls.find(
        (c: any[]) => c[0] === 'tick',
      );
      expect(tickHandler).toBeDefined();
      tickHandler![1]({ token: '12345', ltp: 2900, change: 10, open: 2880, high: 2910, low: 2870, close: 2880, volume: 100000 });

      expect(onTick).toHaveBeenCalledWith(
        expect.objectContaining({ lastPrice: 2900, symbol: '12345' }),
      );

      unsubscribe();
    });

    it('should return noop when no feed token', async () => {
      // Create a broker with no feed token
      mockSmartApi.generateSession.mockResolvedValue({
        data: { jwtToken: '', feedToken: '' } as any,
      });
      const noTokenSmartApi = createMockSmartApi();
      noTokenSmartApi.generateSession = vi.fn().mockResolvedValue({
        data: { jwtToken: '', feedToken: '' },
      });
      function NoTokenSmartAPI(this: any) { return noTokenSmartApi; }
      function NoTokenWS(this: any) { return createMockWebSocketV2(); }
      const noTokenBroker = new AngelBroker({ SmartAPI: NoTokenSmartAPI as any, WebSocketV2: NoTokenWS as any });
      await noTokenBroker.authenticate(createConfig({ accessToken: undefined, password: 'pwd' } as any));

      const unsubscribe = noTokenBroker.subscribeTicks(['RELIANCE'], vi.fn());
      expect(typeof unsubscribe).toBe('function');
    });

    it('should handle WebSocket setup failure', async () => {
      // Create a broker whose WebSocketV2 constructor throws
      function ThrowingWS(this: any, ...args: any[]) { throw new Error('SDK not available'); }
      const brokenBroker = new AngelBroker({ SmartAPI: MockSmartAPI as any, WebSocketV2: ThrowingWS as any });
      await brokenBroker.authenticate(createConfig({ accessToken: undefined, password: 'pwd' } as any));
      vi.clearAllMocks();

      const unsubscribe = brokenBroker.subscribeTicks(['RELIANCE'], vi.fn());
      expect(typeof unsubscribe).toBe('function');
    });
  });
});
