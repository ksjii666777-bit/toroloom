/**
 * ============================================================================
 * Toroloom Groww Trade API Broker — Unit Tests
 * ============================================================================
 *
 * Tests the GrowwBroker class by mocking globalThis.fetch to intercept
 * all HTTP requests to the Groww Trade API.
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/growwBroker.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GrowwBroker } from '../services/broker/growwBroker';
import type { BrokerConfig, OrderPayload } from '../services/broker/interface';

// ──── Constants ─────────────────────────────────────────────────────────────

const API_BASE = 'https://api.groww.in/v1';

// ──── Mock Response Helpers ────────────────────────────────────────────────

function mockFetchResponse(data: any, status = 200): Partial<Response> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as any;
}

function mockFetchError(status: number, body: string): Partial<Response> {
  return {
    ok: false,
    status,
    json: async () => { throw new Error('not json'); },
    text: async () => body,
  } as any;
}

// ──── Config Helper ────────────────────────────────────────────────────────

function createConfig(overrides: Partial<BrokerConfig> = {}): BrokerConfig {
  return {
    apiKey: 'test-groww-api-key',
    accessToken: 'test-groww-access-token',
    ...overrides,
  };
}

// ──── Tests ────────────────────────────────────────────────────────────────

describe('GrowwBroker', () => {
  let broker: GrowwBroker;
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
    broker = new GrowwBroker();
  });

  afterEach(() => {
    fetchMock.mockRestore();
    vi.useRealTimers();
  });

  // ──────────────── Authentication ─────────────────────────────────────

  describe('authenticate', () => {
    it('should authenticate with valid API key and access token', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'SUCCESS' }));

      const result = await broker.authenticate(createConfig());

      expect(result).toBe(true);
      expect(broker.isConnected()).toBe(true);

      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/margins/detail/user`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-groww-access-token',
            'X-API-VERSION': '1.0',
          }),
        }),
      );
    });

    it('should reject when API key is missing', async () => {
      await expect(broker.authenticate(createConfig({ apiKey: '' }))).rejects.toThrow(
        'Groww API key is required',
      );
      expect(broker.isConnected()).toBe(false);
    });

    it('should reject when access token is missing', async () => {
      await expect(broker.authenticate(createConfig({ accessToken: '' }))).rejects.toThrow(
        'Groww access token is required',
      );
      expect(broker.isConnected()).toBe(false);
    });

    it('should return false when verification API returns non-SUCCESS status', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'FAILURE', message: 'Invalid token' }));

      const result = await broker.authenticate(createConfig());

      expect(result).toBe(false);
      expect(broker.isConnected()).toBe(false);
    });

    it('should return false on network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await broker.authenticate(createConfig());

      expect(result).toBe(false);
      expect(broker.isConnected()).toBe(false);
    });
  });

  // ──────────────── isConnected ────────────────────────────────────────

  describe('isConnected', () => {
    it('should return false before authentication', () => {
      expect(broker.isConnected()).toBe(false);
    });

    it('should return true after successful authentication', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'SUCCESS' }));
      await broker.authenticate(createConfig());
      expect(broker.isConnected()).toBe(true);
    });
  });

  // ──────────────── requireAuth guard ──────────────────────────────────

  describe('requireAuth guard', () => {
    it('should throw when not authenticated', async () => {
      await expect(broker.getIndices()).rejects.toThrow(
        'Groww broker not authenticated',
      );
      await expect(broker.getQuote('RELIANCE')).rejects.toThrow(
        'Groww broker not authenticated',
      );
      await expect(broker.placeOrder({
        symbol: 'RELIANCE', exchange: 'NSE', transactionType: 'BUY',
        quantity: 10, price: 2500, productType: 'CNC', orderType: 'LIMIT',
      })).rejects.toThrow('Groww broker not authenticated');
    });
  });

  // ──────────────── Market Data: getQuote ──────────────────────────────

  describe('getQuote', () => {
    const mockQuotePayload = {
      last_price: 2890.50,
      day_change: 35.20,
      day_change_perc: 1.23,
      ohlc: '{open: 2855.00, high: 2895.00, low: 2848.00, close: 2855.30}',
      volume: 5000000,
      bid_price: 2889.00,
      offer_price: 2891.00,
      last_trade_time: '1717000000000',
    };

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'SUCCESS' }));
      await broker.authenticate(createConfig());
      fetchMock.mockClear();
    });

    it('should return a MarketQuote for a valid symbol', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: mockQuotePayload }));

      const quote = await broker.getQuote('RELIANCE');

      expect(quote.symbol).toBe('RELIANCE');
      expect(quote.lastPrice).toBe(2890.50);
      expect(quote.change).toBe(35.20);
      expect(quote.changePercent).toBe(1.23);
      expect(quote.open).toBe(2855.00);
      expect(quote.high).toBe(2895.00);
      expect(quote.low).toBe(2848.00);
      expect(quote.close).toBe(2855.30);
      expect(quote.volume).toBe(5000000);
      expect(quote.bid).toBe(2889.00);
      expect(quote.ask).toBe(2891.00);

      // Verify the correct API URL was called
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/live-data/quote'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-groww-access-token',
          }),
        }),
      );
    });

    it('should throw for an unknown symbol with no payload', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({}));

      await expect(broker.getQuote('UNKNOWN')).rejects.toThrow(
        'No quote data for UNKNOWN',
      );
    });

    it('should fall back to LTP for OHLC when ohlc string is missing', async () => {
      const payloadWithoutOhlc = { ...mockQuotePayload };
      delete (payloadWithoutOhlc as { ohlc?: string }).ohlc;
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: { ...payloadWithoutOhlc, last_price: 2900 } }));

      const quote = await broker.getQuote('RELIANCE');

      expect(quote.lastPrice).toBe(2900);
      expect(quote.open).toBe(2900);
      expect(quote.high).toBe(2900);
      expect(quote.low).toBe(2900);
      expect(quote.close).toBe(2900);
    });

    it('should parse depth when provided', async () => {
      const payloadWithDepth = {
        ...mockQuotePayload,
        bid_price: undefined,
        offer_price: undefined,
        depth: {
          buy: [{ price: 2888, quantity: 100 }],
          sell: [{ price: 2892, quantity: 50 }],
        },
      };
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: payloadWithDepth }));

      const quote = await broker.getQuote('RELIANCE');

      expect(quote.bid).toBe(2888);
      expect(quote.ask).toBe(2892);
    });

    it('should fall back to LTP for bid/ask when depth is also missing', async () => {
      const payloadNoBidAsk = {
        ...mockQuotePayload,
        bid_price: undefined,
        offer_price: undefined,
        depth: undefined,
      };
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: payloadNoBidAsk }));

      const quote = await broker.getQuote('RELIANCE');

      expect(quote.bid).toBe(2890.50);
      expect(quote.ask).toBe(2890.50);
    });

    it('should compute change from OHLC close when day_change is missing', async () => {
      const payloadNoDayChange = { ...mockQuotePayload };
      delete (payloadNoDayChange as { day_change?: number }).day_change;
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: payloadNoDayChange }));

      const quote = await broker.getQuote('RELIANCE');

      expect(quote.change).toBeCloseTo(2890.50 - 2855.30, 2);
    });

    it('should handle HTTP errors from the API', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchError(429, 'Rate limited'));

      await expect(broker.getQuote('RELIANCE')).rejects.toThrow(
        'Groww API error (429): Rate limited',
      );
    });
  });

  // ──────────────── Market Data: getIndices ────────────────────────────

  describe('getIndices', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'SUCCESS' }));
      await broker.authenticate(createConfig());
      fetchMock.mockClear();
    });

    it('should return all default indices with correct structure', async () => {
      // Mock quote responses for each index (NIFTY, BANKNIFTY, SENSEX, NIFTYMIDCAP100)
      const mockQuote = (ltp: number) => ({
        payload: {
          last_price: ltp,
          day_change: ltp * 0.01,
          day_change_perc: 1.0,
          ohlc: `{open: ${ltp - 100}, high: ${ltp + 50}, low: ${ltp - 150}, close: ${ltp - 50}}`,
          volume: 1000000,
        },
      });

      fetchMock
        .mockResolvedValueOnce(mockFetchResponse(mockQuote(23500)))  // NIFTY
        .mockResolvedValueOnce(mockFetchResponse(mockQuote(48500)))  // BANKNIFTY
        .mockResolvedValueOnce(mockFetchResponse(mockQuote(73200)))  // SENSEX
        .mockResolvedValueOnce(mockFetchResponse(mockQuote(18500))); // MIDCAP

      const indices = await broker.getIndices();

      expect(indices.length).toBe(4);
      expect(indices[0]).toMatchObject({ id: 'NIFTY', currentValue: 23500, isPositive: true });
      expect(indices[1]).toMatchObject({ id: 'BANKNIFTY', currentValue: 48500 });
      expect(indices[2]).toMatchObject({ id: 'SENSEX', currentValue: 73200 });
      expect(indices[3]).toMatchObject({ id: 'MIDCAP', currentValue: 18500 });
    });

    it('should handle partial index fetch failures gracefully', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse({ payload: { last_price: 23500, day_change: 100, day_change_perc: 0.43 } }))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockFetchResponse({ payload: { last_price: 73200, day_change: 200, day_change_perc: 0.27 } }))
        .mockRejectedValueOnce(new Error('Timeout'));

      const indices = await broker.getIndices();

      expect(indices.length).toBe(2);
    });

    it('should set isPositive correctly for negative change', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse({ payload: { last_price: 23000, day_change: -150, day_change_perc: -0.65 } }))
        .mockResolvedValueOnce(mockFetchResponse({ payload: { last_price: 48000, day_change: -200, day_change_perc: -0.42 } }))
        .mockResolvedValueOnce(mockFetchResponse({ payload: { last_price: 73000, day_change: 300, day_change_perc: 0.41 } }))
        .mockResolvedValueOnce(mockFetchResponse({ payload: { last_price: 18000, day_change: -50, day_change_perc: -0.28 } }));

      const indices = await broker.getIndices();

      expect(indices.find(i => i.id === 'NIFTY')!.isPositive).toBe(false);
      expect(indices.find(i => i.id === 'SENSEX')!.isPositive).toBe(true);
    });
  });

  // ──────────────── Market Data: getStocks ────────────────────────────

  describe('getStocks', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'SUCCESS' }));
      await broker.authenticate(createConfig());
      fetchMock.mockClear();
    });

    it('should return stock info for common symbols', async () => {
      // Mock a quote response for each common stock
      const mockQuote = (ltp: number) => ({
        payload: {
          last_price: ltp,
          day_change: ltp * 0.005,
          day_change_perc: 0.5,
          volume: 100000,
        },
      });

      // The broker has 20 COMMON_STOCKS, so 20 fetch calls for quotes
      for (let i = 0; i < 20; i++) {
        fetchMock.mockResolvedValueOnce(mockFetchResponse(mockQuote(100 + i * 10)));
      }

      const stocks = await broker.getStocks();

      expect(Array.isArray(stocks)).toBe(true);
      expect(stocks.length).toBeGreaterThanOrEqual(20);
      expect(stocks[0]).toMatchObject({
        symbol: expect.any(String),
        price: expect.any(Number),
        change: expect.any(Number),
      });
    });

    it('should handle partial stock fetch failures', async () => {
      // First 10 succeed, next 10 fail
      for (let i = 0; i < 10; i++) {
        fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: { last_price: 500 } }));
      }
      for (let i = 0; i < 10; i++) {
        fetchMock.mockRejectedValueOnce(new Error('API error'));
      }

      const stocks = await broker.getStocks();

      expect(stocks.length).toBe(10);
    });
  });

  // ──────────────── Market Data: getBulkQuotes ────────────────────────

  describe('getBulkQuotes', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'SUCCESS' }));
      await broker.authenticate(createConfig());
      fetchMock.mockClear();
    });

    it('should return quotes for multiple symbols', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse({ payload: { last_price: 2890, day_change: 35 } }))
        .mockResolvedValueOnce(mockFetchResponse({ payload: { last_price: 3890, day_change: 20 } }));

      const map = await broker.getBulkQuotes(['RELIANCE', 'TCS']);

      expect(map.size).toBe(2);
      expect(map.get('RELIANCE')!.lastPrice).toBe(2890);
      expect(map.get('TCS')!.lastPrice).toBe(3890);
    });

    it('should handle partial failures gracefully', async () => {
      fetchMock
        .mockResolvedValueOnce(mockFetchResponse({ payload: { last_price: 2890 } }))
        .mockRejectedValueOnce(new Error('Not found'));

      const map = await broker.getBulkQuotes(['RELIANCE', 'UNKNOWN']);

      expect(map.size).toBe(1);
      expect(map.has('RELIANCE')).toBe(true);
    });
  });

  // ──────────────── Market Data: getOHLC ──────────────────────────────

  describe('getOHLC', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'SUCCESS' }));
      await broker.authenticate(createConfig());
      fetchMock.mockClear();
    });

    it('should return parsed OHLC candles', async () => {
      const mockCandles = {
        payload: {
          candles: [
            [1717000000, 2850, 2900, 2840, 2880, 1000000],
            [1717086400, 2880, 2920, 2870, 2910, 1200000],
          ],
        },
      };
      fetchMock.mockResolvedValueOnce(mockFetchResponse(mockCandles));

      const ohlc = await broker.getOHLC('RELIANCE', '1d', 5);

      expect(ohlc.length).toBe(2);
      expect(ohlc[0]).toMatchObject({
        date: expect.any(String),
        open: 2850, high: 2900, low: 2840, close: 2880, volume: 1000000,
      });
      expect(ohlc[1].open).toBe(2880);
      expect(ohlc[1].close).toBe(2910);
    });

    it('should return empty array when API returns no candles', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: {} }));

      const ohlc = await broker.getOHLC('RELIANCE', '1d', 5);

      expect(ohlc).toEqual([]);
    });

    it('should map interval strings to minutes correctly', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: { candles: [] } }));

      await broker.getOHLC('RELIANCE', '5m', 1);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('interval_in_minutes=5'),
        expect.any(Object),
      );
    });

    it('should default to daily interval for unknown interval', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: { candles: [] } }));

      await broker.getOHLC('RELIANCE', 'unknown', 1);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('interval_in_minutes=1440'),
        expect.any(Object),
      );
    });
  });

  // ──────────────── Market Data: searchStocks ─────────────────────────

  describe('searchStocks', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'SUCCESS' }));
      await broker.authenticate(createConfig());
      fetchMock.mockClear();
    });

    it('should return matching stocks from common symbols list', async () => {
      // Search for 'REL' should match 'RELIANCE', 'RELINFRA' doesn't exist
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: { last_price: 2890 } }));

      const results = await broker.searchStocks('REL');

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].symbol).toContain('REL');
    });

    it('should return empty array when no matches found', async () => {
      const results = await broker.searchStocks('ZZZZZ');

      expect(results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled(); // No HTTP calls needed
    });

    it('should be case-insensitive in matching', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: { last_price: 1500 } }));

      const results = await broker.searchStocks('tcs');

      expect(results.length).toBe(1);
      expect(results[0].symbol).toBe('TCS');
    });
  });

  // ──────────────── Trading: placeOrder ───────────────────────────────

  describe('placeOrder', () => {
    const sampleOrder: OrderPayload = {
      symbol: 'RELIANCE', exchange: 'NSE', transactionType: 'BUY',
      quantity: 10, price: 2900, productType: 'CNC', orderType: 'LIMIT',
    };

    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'SUCCESS' }));
      await broker.authenticate(createConfig());
      fetchMock.mockClear();
    });

    it('should place a buy limit order successfully', async () => {
      const successResponse = {
        status: 'SUCCESS',
        payload: {
          groww_order_id: 'GW_ORD_001',
          order_status: 'COMPLETE',
          remark: 'Order placed successfully',
        },
      };
      fetchMock.mockResolvedValueOnce(mockFetchResponse(successResponse));

      const result = await broker.placeOrder(sampleOrder);

      expect(result.status).toBe('confirmed');
      expect(result.id).toBe('GW_ORD_001');
      expect(result.message).toBe('Order placed successfully');

      // Verify the POST request body
      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE}/order/create`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"trading_symbol":"RELIANCE"'),
        }),
      );
    });

    it('should return rejected status on API rejection', async () => {
      const rejectResponse = {
        status: 'FAILURE',
        payload: { remark: 'Insufficient margin' },
      };
      fetchMock.mockResolvedValueOnce(mockFetchResponse(rejectResponse));

      const result = await broker.placeOrder(sampleOrder);

      expect(result.status).toBe('rejected');
      expect(result.id).toBe('');
      expect(result.message).toBe('Insufficient margin');
    });

    it('should return rejected status on empty response', async () => {
      const emptyResponse = {};
      fetchMock.mockResolvedValueOnce(mockFetchResponse(emptyResponse));

      const result = await broker.placeOrder(sampleOrder);

      expect(result.status).toBe('rejected');
      expect(result.message).toBe('Order placement failed');
    });

    it('should map order statuses correctly', async () => {
      const statusTests: Array<{ status: string; expected: string }> = [
        { status: 'COMPLETE', expected: 'confirmed' },
        { status: 'FILLED', expected: 'confirmed' },
        { status: 'OPEN', expected: 'pending' },
        { status: 'PENDING', expected: 'pending' },
        { status: 'CANCELLED', expected: 'cancelled' },
        { status: 'REJECTED', expected: 'rejected' },
        { status: 'FAILURE', expected: 'rejected' },
      ];

      for (const { status, expected } of statusTests) {
        fetchMock.mockResolvedValueOnce(mockFetchResponse({
          status: 'SUCCESS',
          payload: { groww_order_id: `ORD_${status}`, order_status: status },
        }));

        const result = await broker.placeOrder(sampleOrder);
        expect(result.status).toBe(expected);
      }
    });
  });

  // ──────────────── Trading: getPositions ─────────────────────────────

  describe('getPositions', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'SUCCESS' }));
      await broker.authenticate(createConfig());
      fetchMock.mockClear();
    });

    it('should return mapped positions', async () => {
      const mockPositions = {
        payload: {
          positions: [
            { trading_symbol: 'RELIANCE', quantity: '50', net_price: '2650', realised_pnl: '12000' },
            { trading_symbol: 'TCS', quantity: '10', net_price: '3800', realised_pnl: '500' },
          ],
        },
      };
      fetchMock.mockResolvedValueOnce(mockFetchResponse(mockPositions));

      const positions = await broker.getPositions();

      expect(positions.length).toBe(2);
      expect(positions[0]).toMatchObject({
        symbol: 'RELIANCE', quantity: 50, buyPrice: 2650, pnl: 12000,
      });
    });

    it('should return empty array when no positions', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: { positions: [] } }));

      const positions = await broker.getPositions();
      expect(positions).toEqual([]);
    });

    it('should return empty array when payload has no positions', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({}));

      const positions = await broker.getPositions();
      expect(positions).toEqual([]);
    });
  });

  // ──────────────── Trading: getTradeHistory ──────────────────────────

  describe('getTradeHistory', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'SUCCESS' }));
      await broker.authenticate(createConfig());
      fetchMock.mockClear();
    });

    it('should return mapped trade history from order_list', async () => {
      const mockOrders = {
        payload: {
          order_list: [
            { groww_order_id: 'ORD_1', trading_symbol: 'RELIANCE', transaction_type: 'BUY', filled_quantity: '10', price: '2500', trade_date_time: '2025-05-20T09:30:00' },
            { groww_order_id: 'ORD_2', trading_symbol: 'TCS', transaction_type: 'SELL', filled_quantity: '5', price: '4000', trade_date_time: '2025-05-20T10:00:00' },
          ],
        },
      };
      fetchMock.mockResolvedValueOnce(mockFetchResponse(mockOrders));

      const trades = await broker.getTradeHistory();

      expect(trades.length).toBe(2);
      expect(trades[0]).toMatchObject({
        id: 'ORD_1', symbol: 'RELIANCE', type: 'buy', quantity: 10, price: 2500,
      });
      expect(trades[1].type).toBe('sell');
    });

    it('should fall back to orders field when order_list is missing', async () => {
      const mockOrders = {
        payload: {
          orders: [
            { groww_order_id: 'ORD_1', trading_symbol: 'INFY', transaction_type: 'BUY', filled_quantity: '20', price: '1800' },
          ],
        },
      };
      fetchMock.mockResolvedValueOnce(mockFetchResponse(mockOrders));

      const trades = await broker.getTradeHistory();

      expect(trades.length).toBe(1);
      expect(trades[0].symbol).toBe('INFY');
    });

    it('should return empty array when no orders', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: {} }));

      const trades = await broker.getTradeHistory();
      expect(trades).toEqual([]);
    });
  });

  // ──────────────── Portfolio: getHoldings ────────────────────────────

  describe('getHoldings', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'SUCCESS' }));
      await broker.authenticate(createConfig());
      fetchMock.mockClear();
    });

    it('should return filtered holdings with positive quantity', async () => {
      const mockHoldings = {
        payload: {
          holdings: [
            { trading_symbol: 'RELIANCE', quantity: '50', average_price: '2650' },
            { trading_symbol: 'TCS', quantity: '10', average_price: '3800' },
            { trading_symbol: 'ZERO', quantity: '0', average_price: '0' },
          ],
        },
      };
      fetchMock.mockResolvedValueOnce(mockFetchResponse(mockHoldings));

      const holdings = await broker.getHoldings();

      expect(holdings.length).toBe(2);
      expect(holdings[0]).toMatchObject({ symbol: 'RELIANCE', quantity: 50, buyPrice: 2650 });
      expect(holdings[1].symbol).toBe('TCS');
    });

    it('should return empty array when no holdings', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ payload: { holdings: [] } }));

      const holdings = await broker.getHoldings();
      expect(holdings).toEqual([]);
    });

    it('should return empty array when payload has no holdings', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({}));

      const holdings = await broker.getHoldings();
      expect(holdings).toEqual([]);
    });
  });

  // ──────────────── Real-time: subscribeTicks ─────────────────────────

  describe('subscribeTicks', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 'SUCCESS' }));
      await broker.authenticate(createConfig());
      fetchMock.mockClear();
    });

    it('should return an unsubscribe function', () => {
      const onTick = vi.fn();
      const unsubscribe = broker.subscribeTicks(['RELIANCE'], onTick);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should call onTick with quote data on interval', async () => {
      vi.useFakeTimers();

      const onTick = vi.fn();
      fetchMock.mockResolvedValue(mockFetchResponse({ payload: { last_price: 2900, day_change: 10 } }));

      broker.subscribeTicks(['RELIANCE'], onTick);

      // Advance timers to trigger the polling interval
      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(3000);

      expect(onTick).toHaveBeenCalledTimes(2);
      expect(onTick).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'RELIANCE', lastPrice: 2900 }),
      );

      vi.useRealTimers();
    });

    it('should stop calling onTick after unsubscribe', async () => {
      vi.useFakeTimers();

      const onTick = vi.fn();
      fetchMock.mockResolvedValue(mockFetchResponse({ payload: { last_price: 2900 } }));

      const unsubscribe = broker.subscribeTicks(['RELIANCE'], onTick);

      // First tick should fire
      await vi.advanceTimersByTimeAsync(3000);
      expect(onTick).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Advance again — should not fire
      await vi.advanceTimersByTimeAsync(3000);
      expect(onTick).toHaveBeenCalledTimes(1); // Still 1

      vi.useRealTimers();
    });

    it('should handle fetch failures silently without crashing', async () => {
      vi.useFakeTimers();

      const onTick = vi.fn();
      fetchMock.mockRejectedValue(new Error('Network error'));

      broker.subscribeTicks(['RELIANCE'], onTick);

      await vi.advanceTimersByTimeAsync(3000);

      // Should not throw, just silently skip
      expect(onTick).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
