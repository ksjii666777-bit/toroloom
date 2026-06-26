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
import speakeasy from 'speakeasy';
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
    marketData: vi.fn().mockResolvedValue({
      data: {
        fetched: [{
          ltp: 2890,
          last_price: 2890,
          exch_tm: '2025-05-30T10:00:00',
          open: 2870,
          high: 2900,
          low: 2860,
          close: 2880,
          volume: 5000000,
          net_change: 10,
          percentage_change: 0.35,
          bid_price: 2889,
          ask_price: 2891,
        }],
      },
    }),
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

  function MockSmartAPI(this: any, ..._args: any[]) { return mockSmartApi; }
  function MockWebSocketV2(this: any, ..._args: any[]) { return mockWebSocket; }

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
      const expectedTotpCode = '559335';
      const speakeasySpy = vi.spyOn(speakeasy, 'totp').mockReturnValue(expectedTotpCode);

      mockSmartApi.generateSession.mockResolvedValue({
        data: { jwtToken: 'new-jwt', feedToken: 'new-feed-token' },
      });

      await broker.authenticate(createConfig({
        accessToken: undefined,
        password: 'test-password',
        totp: 'JBSWY3DPEHPK3PXP',
      } as any));

      expect(speakeasySpy).toHaveBeenCalledWith({
        secret: 'JBSWY3DPEHPK3PXP',
        encoding: 'base32',
      });
      expect(mockSmartApi.generateSession).toHaveBeenCalledWith(
        'test-client', 'test-password', expectedTotpCode,
      );

      speakeasySpy.mockRestore();
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
      mockSmartApi.marketData.mockResolvedValue({
        data: {
          fetched: [{
            ltp: 23500,
            last_price: 23500,
            exch_tm: '2025-05-30T10:00:00',
            open: 23400,
            high: 23600,
            low: 23300,
            close: 23500,
            volume: 1000000,
            net_change: 100,
            percentage_change: 0.43,
          }],
        },
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
      mockSmartApi.marketData
        .mockResolvedValueOnce({
          data: {
            fetched: [{ ltp: 23500, last_price: 23500, net_change: 50, open: 23400, high: 23600, low: 23300, close: 23400 }],
          },
        })
        .mockRejectedValueOnce(new Error('API error'));

      const indices = await broker.getIndices();
      expect(indices.length).toBeGreaterThanOrEqual(1);
    });

    it('should calculate change and changePercent correctly', async () => {
      mockSmartApi.marketData.mockResolvedValue({
        data: {
          fetched: [{
            ltp: 24000,
            last_price: 24000,
            net_change: 200,
            percentage_change: 0.84,
            open: 23800,
            high: 24100,
            low: 23700,
            close: 23800,
            volume: 1000000,
          }],
        },
      });

      const indices = await broker.getIndices();
      const nifty = indices.find((i) => i.id === 'NIFTY');
      expect(nifty).toBeDefined();
      expect(nifty!.isPositive).toBe(true);
    });

    it('should handle when marketData returns no data', async () => {
      mockSmartApi.marketData.mockResolvedValue({ data: null });

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
      mockSmartApi.marketData.mockResolvedValue({
        data: {
          fetched: [{
            ltp: 2890,
            last_price: 2890,
            exch_tm: '2025-05-30T10:00:00',
            open: 2870,
            high: 2900,
            low: 2860,
            close: 2880,
            volume: 5000000,
            net_change: 10,
            percentage_change: 0.35,
            bid_price: 2889,
            ask_price: 2891,
          }],
        },
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
      mockSmartApi.marketData.mockResolvedValue({
        data: {
          fetched: [{ ltp: 2890, last_price: 2890, net_change: 10, open: 2880, high: 2900, low: 2870, close: 2880, volume: 5000000 }],
        },
      });
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
      mockSmartApi.marketData.mockResolvedValue({
        data: {
          fetched: [{ ltp: 3890, last_price: 3890, net_change: 10, open: 3890, high: 3900, low: 3880, close: 3880, volume: 5000000 }],
        },
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
      mockSmartApi.marketData
        .mockResolvedValueOnce({
          data: {
            fetched: [{ ltp: 2890, last_price: 2890, net_change: 10, open: 2880, high: 2900, low: 2870, close: 2880, volume: 5000000 }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            fetched: [{ ltp: 3890, last_price: 3890, net_change: -10, open: 3880, high: 3900, low: 3870, close: 3890, volume: 3000000 }],
          },
        });
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
      mockSmartApi.marketData.mockResolvedValue({
        data: {
          fetched: [{ ltp: 2890, last_price: 2890, net_change: 10, open: 2880, high: 2900, low: 2870, close: 2880, volume: 5000000 }],
        },
      });
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
      mockSmartApi.marketData.mockResolvedValue({
        data: {
          fetched: [{ ltp: 2890, last_price: 2890, net_change: 10, open: 2880, high: 2900, low: 2870, close: 2880, volume: 5000000 }],
        },
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
      mockSmartApi.marketData.mockResolvedValue({
        data: {
          fetched: [{ ltp: 2890, last_price: 2890, net_change: 10, open: 2880, high: 2900, low: 2870, close: 2880, volume: 5000000 }],
        },
      });

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
      mockSmartApi.marketData.mockRejectedValue(new Error('Price fetch failed'));

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
      function ThrowingWS(this: any, ..._args: any[]) { throw new Error('SDK not available'); }
      const brokenBroker = new AngelBroker({ SmartAPI: MockSmartAPI as any, WebSocketV2: ThrowingWS as any });
      await brokenBroker.authenticate(createConfig({ accessToken: undefined, password: 'pwd' } as any));
      vi.clearAllMocks();

      const unsubscribe = brokenBroker.subscribeTicks(['RELIANCE'], vi.fn());
      expect(typeof unsubscribe).toBe('function');
    });
  });

  // ──────────────── EDIS: verifyEDIS ────────────────

  describe('verifyEDIS', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should make POST request to EDIS verify endpoint and return response', async () => {
      const mockResponse = {
        ReqId: 'REQ_1717000000',
        ReturnURL: 'https://cdslindia.com/verify',
        DPId: '12345',
        BOID: 'BO_INESP123',
        TransDtls: 'TRAN_1717000000',
      };

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      } as any);

      const result = await broker['verifyEDIS']({
        isin: 'INESP123',
        quantity: '10',
      });

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://apiconnect.angelone.in/rest/secure/angelbroking/edis/v1/verifyDis',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
            'X-PrivateKey': 'test-api-key',
          }),
          body: JSON.stringify({ isin: 'INESP123', quantity: '10' }),
        }),
      );

      fetchMock.mockRestore();
    });

    it('should throw when not authenticated', async () => {
      const unauthenticatedBroker = new AngelBroker();
      await expect(
        unauthenticatedBroker['verifyEDIS']({ isin: 'INESP123', quantity: '10' }),
      ).rejects.toThrow('Angel One broker not authenticated');
    });

    it('should include optional REST headers when configured', async () => {
      const customConfig = createConfig({
        clientLocalIP: '192.168.1.10',
        clientPublicIP: '203.0.113.50',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        appId: 'my-app',
      } as any);
      await broker.authenticate(customConfig);
      vi.clearAllMocks();

      const mockResponse = {
        ReqId: 'REQ_001', ReturnURL: '', DPId: '', BOID: '', TransDtls: '',
      };

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      } as any);

      await broker['verifyEDIS']({ isin: 'INE123', quantity: '5' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-ClientLocalIP': '192.168.1.10',
            'X-ClientPublicIP': '203.0.113.50',
            'X-MACAddress': 'AA:BB:CC:DD:EE:FF',
            'X-AppId': 'my-app',
            'X-ClientCode': 'test-client',
          }),
        }),
      );

      fetchMock.mockRestore();
    });

    it('should throw on HTTP error response', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request: invalid ISIN',
      } as any);

      await expect(
        broker['verifyEDIS']({ isin: 'INVALID', quantity: '10' }),
      ).rejects.toThrow('Angel One REST API error (400): Bad Request: invalid ISIN');

      fetchMock.mockRestore();
    });
  });

  // ──────────────── EDIS: generateTPIN ────────────────

  describe('generateTPIN', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should make POST request to generate TPIN', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'TPIN generated successfully' }),
        text: async () => JSON.stringify({ status: 'TPIN generated successfully' }),
      } as any);

      const result = await broker['generateTPIN']({
        dpId: '12345',
        ReqId: 'REQ_001',
        boid: 'BO_INE123',
        pan: 'ABCDE1234F',
      });

      expect(result.status).toBe('TPIN generated successfully');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://apiconnect.angelone.in/rest/secure/angelbroking/edis/v1/generateTPIN',
        expect.any(Object),
      );

      fetchMock.mockRestore();
    });

    it('should throw when not authenticated', async () => {
      const unauthenticatedBroker = new AngelBroker();
      await expect(
        unauthenticatedBroker['generateTPIN']({
          dpId: '', ReqId: '', boid: '', pan: '',
        }),
      ).rejects.toThrow('Angel One broker not authenticated');
    });
  });

  // ──────────────── EDIS: getEDISTranStatus ────────────────

  describe('getEDISTranStatus', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return status 1 when EDIS is authorised', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ReqId: 'REQ_001', status: 1 }),
        text: async () => JSON.stringify({ ReqId: 'REQ_001', status: 1 }),
      } as any);

      const result = await broker['getEDISTranStatus']({ ReqId: 'REQ_001' });

      expect(result.status).toBe(1);
      expect(result.ReqId).toBe('REQ_001');
      fetchMock.mockRestore();
    });

    it('should return status 0 when EDIS is not yet authorised', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ReqId: 'REQ_002', status: 0 }),
        text: async () => JSON.stringify({ ReqId: 'REQ_002', status: 0 }),
      } as any);

      const result = await broker['getEDISTranStatus']({ ReqId: 'REQ_002' });

      expect(result.status).toBe(0);
      fetchMock.mockRestore();
    });
  });

  // ──────────────── Brokerage Calculator: estimateBrokerage ────────────────

  describe('estimateBrokerage', () => {
    beforeEach(async () => {
      await broker.authenticate(createConfig());
      vi.clearAllMocks();
    });

    it('should return brokerage estimate for a single order', async () => {
      const mockResponse = {
        status: 'SUCCESS',
        payload: {
          brokerage: 15.0,
          transaction_charges: 5.0,
          gst: 3.6,
          stt_ctt: 50.0,
          stamp_duty: 1.5,
          sebi_turnover_fees: 0.1,
          total_charges: 75.2,
        },
      };

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      } as any);

      const result = await broker['estimateBrokerage']({
        orders: [{
          product_type: 'DELIVERY',
          transaction_type: 'BUY',
          exchange: 'NSE',
          symbol: 'RELIANCE',
          token: '12345',
          qty: 10,
          price: 2500,
        }],
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.payload.brokerage).toBe(15.0);
      expect(result.payload.total_charges).toBe(75.2);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://apiconnect.angelone.in/rest/secure/angelbroking/brokerage/v1/estimateCharges',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            orders: [{
              product_type: 'DELIVERY',
              transaction_type: 'BUY',
              exchange: 'NSE',
              symbol: 'RELIANCE',
              token: '12345',
              qty: 10,
              price: 2500,
            }],
          }),
        }),
      );

      fetchMock.mockRestore();
    });

    it('should handle multiple orders in a single request', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'SUCCESS',
          payload: {
            brokerage: 30.0,
            transaction_charges: 10.0,
            gst: 7.2,
            stt_ctt: 100.0,
            stamp_duty: 3.0,
            sebi_turnover_fees: 0.2,
            total_charges: 150.4,
          },
        }),
        text: async () => '',
      } as any);

      const result = await broker['estimateBrokerage']({
        orders: [
          {
            product_type: 'DELIVERY',
            transaction_type: 'BUY',
            exchange: 'NSE',
            symbol: 'RELIANCE',
            token: '12345',
            qty: 10,
            price: 2500,
          },
          {
            product_type: 'INTRADAY',
            transaction_type: 'SELL',
            exchange: 'NSE',
            symbol: 'TCS',
            token: '67890',
            qty: 5,
            price: 4000,
          },
        ],
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.payload.total_charges).toBe(150.4);
      fetchMock.mockRestore();
    });

    it('should throw on API error', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      } as any);

      await expect(
        broker['estimateBrokerage']({
          orders: [{
            product_type: 'DELIVERY',
            transaction_type: 'BUY',
            exchange: 'NSE',
            symbol: 'RELIANCE',
            token: '12345',
            qty: 10,
            price: 2500,
          }],
        }),
      ).rejects.toThrow('Angel One REST API error (500): Internal server error');

      fetchMock.mockRestore();
    });
  });
});
