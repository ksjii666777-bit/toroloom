/**
 * ============================================================================
 * Interactive Brokers Broker — Unit Tests
 * ============================================================================
 *
 * Tests the IbkrBroker class by mocking the HTTP fetch calls to the
 * IBKR Client Portal Gateway. This avoids needing an actual Gateway running.
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/ibkrBroker.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IbkrBroker } from '../services/broker/ibkrBroker';

// ──── Mock global fetch ──────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  // @ts-expect-error - mock global fetch
  global.fetch = mockFetch;
});

// ──── Helpers ─────────────────────────────────────────────────────────────

function mockResponse(data: any, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
  });
}

function mockGatewayHealth() {
  mockFetch.mockResolvedValueOnce(mockResponse({}));
}

function mockAuthStatus(authenticated = true) {
  mockFetch.mockResolvedValueOnce(mockResponse({ authenticated, connected: true }));
}

function mockAccounts() {
  mockFetch.mockResolvedValueOnce(mockResponse({
    accounts: [
      { id: 'U1234567', accountId: 'U1234567', accountTitle: 'Test Account', accountType: 'INDIVIDUAL', currency: 'USD', status: 'Active' },
    ],
  }));
}

function mockTickle() {
  mockFetch.mockResolvedValueOnce(mockResponse({}));
}

// ──── Tests ───────────────────────────────────────────────────────────────

describe('IbkrBroker', () => {
  let broker: IbkrBroker;

  beforeEach(() => {
    broker = new IbkrBroker();
  });

  describe('authenticate', () => {
    it('should return false when gateway is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await broker.authenticate({ apiKey: 'test', gatewayUrl: 'http://localhost:5001' });
      expect(result).toBe(false);
      expect(broker.isConnected()).toBe(false);
    });

    it('should return false when not authenticated with gateway', async () => {
      mockGatewayHealth();
      mockAuthStatus(false);

      const result = await broker.authenticate({ apiKey: 'test' });
      expect(result).toBe(false);
    });

    it('should succeed when gateway is up and authenticated', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();

      const result = await broker.authenticate({ apiKey: 'test' });
      expect(result).toBe(true);
      expect(broker.isConnected()).toBe(true);

      // Cleanup tickle interval
      broker.disconnect();
    });

    it('should use provided accountId', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);

      const result = await broker.authenticate({ apiKey: 'test', accountId: 'U9999999' });
      expect(result).toBe(true);

      broker.disconnect();
    });
  });

  describe('getQuote', () => {
    it('should throw when not authenticated', async () => {
      await expect(broker.getQuote('AAPL')).rejects.toThrow('not authenticated');
    });

    it('should return a market quote', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      // Mock secdef search
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL', description: 'Apple Inc', currency: 'USD', exchange: 'NASDAQ', type: 'STK' },
      ]));

      // Mock market data snapshot
      mockFetch.mockResolvedValueOnce(mockResponse([
        {
          conid: 265598,
          '31': 189.50,  // last
          '70': 188.00,  // open
          '71': 190.20,  // high
          '72': 187.80,  // low
          '73': 188.50,  // close
          '82': 1.00,    // change
          '83': 0.53,    // change%
          '84': 189.45,  // bid
          '86': 189.55,  // ask
          '87': 5000000, // volume
        },
      ]));

      const quote = await broker.getQuote('AAPL');
      expect(quote.symbol).toBe('265598');
      expect(quote.lastPrice).toBe(189.50);
      expect(quote.change).toBe(1.00);
      expect(quote.changePercent).toBe(0.53);
      expect(quote.high).toBe(190.20);
      expect(quote.low).toBe(187.80);
      expect(quote.volume).toBe(5000000);

      broker.disconnect();
    });
  });

  describe('getPositions', () => {
    it('should return positions array', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      // Mock portfolio positions
      mockFetch.mockResolvedValueOnce(mockResponse([
        {
          acctId: 'U1234567',
          conid: 265598,
          contractDesc: 'AAPL',
          position: 100,
          mktPrice: 189.50,
          avgCost: 175.00,
          unrealizedPnl: 1450.00,
        },
        {
          acctId: 'U1234567',
          conid: 207639,
          contractDesc: 'MSFT',
          position: -50, // Short position
          mktPrice: 420.00,
          avgCost: 410.00,
          unrealizedPnl: -500.00,
        },
      ]));

      const positions = await broker.getPositions();
      expect(positions.length).toBe(2);

      expect(positions[0].symbol).toBe('AAPL');
      expect(positions[0].quantity).toBe(100);
      expect(positions[0].currentPrice).toBe(189.50);

      expect(positions[1].symbol).toBe('MSFT');
      expect(positions[1].quantity).toBe(50); // Absolute value

      broker.disconnect();
    });

    it('should return empty array on API error', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      mockFetch.mockRejectedValueOnce(new Error('API error'));

      const positions = await broker.getPositions();
      expect(positions).toEqual([]);

      broker.disconnect();
    });
  });

  describe('placeOrder', () => {
    it('should place a BUY order', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      // Mock secdef search
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL', description: 'Apple Inc', currency: 'USD', exchange: 'NASDAQ', type: 'STK' },
      ]));

      // Mock order placement
      mockFetch.mockResolvedValueOnce(mockResponse({ id: '12345' }));

      const result = await broker.placeOrder({
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        transactionType: 'BUY',
        quantity: 10,
        price: 190.00,
        productType: 'CNC',
        orderType: 'LIMIT',
      });

      expect(result.status).toBe('confirmed');
      expect(result.id).toBe('12345');

      broker.disconnect();
    });

    it('should handle order failure gracefully', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      mockFetch.mockResolvedValueOnce(mockResponse([])); // Empty search
      mockFetch.mockRejectedValueOnce(new Error('Insufficient funds'));

      const result = await broker.placeOrder({
        symbol: 'UNKNOWN',
        exchange: 'SMART',
        transactionType: 'BUY',
        quantity: 1,
        price: 100,
        productType: 'CNC',
        orderType: 'MARKET',
      });

      expect(result.status).toBe('rejected');

      broker.disconnect();
    });
  });

  describe('getOpenOrders', () => {
    it('should return open orders', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      mockFetch.mockResolvedValueOnce(mockResponse({
        orders: [
          {
            orderId: 12345,
            acct: 'U1234567',
            conid: 265598,
            symbol: 'AAPL',
            ticker: 'AAPL',
            orderType: 'LMT',
            side: 'BUY',
            quantity: 100,
            filledQuantity: 0,
            limitPrice: 190.00,
            status: 'OPEN',
            listingExchange: 'NASDAQ',
            lastExecutionTime: new Date().toISOString(),
          },
        ] as any[],
      }));

      const orders = await broker.getOpenOrders();
      expect(orders.length).toBe(1);
      expect(orders[0].symbol).toBe('AAPL');
      expect(orders[0].transactionType).toBe('BUY');
      expect(orders[0].quantity).toBe(100);
      expect(orders[0].status).toBe('open');

      broker.disconnect();
    });
  });

  describe('cancelOrder', () => {
    it('should cancel an order', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      mockFetch.mockResolvedValueOnce(mockResponse({}));

      const result = await broker.cancelOrder({ orderId: '12345' });
      expect(result.status).toBe('cancelled');
      expect(result.id).toBe('12345');

      broker.disconnect();
    });
  });

  describe('getOHLC', () => {
    it('should return historical data', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      // Mock secdef search
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL' },
      ]));

      // Mock historical data
      const now = Date.now();
      mockFetch.mockResolvedValueOnce(mockResponse({
        data: [
          { t: now - 86400000, o: 188.0, h: 190.0, l: 187.5, c: 189.5, v: 5000000 },
          { t: now - 2 * 86400000, o: 187.0, h: 189.0, l: 186.5, c: 188.0, v: 4500000 },
        ],
      }));

      const bars = await broker.getOHLC('AAPL', '1d', 2);
      expect(bars.length).toBe(2);
      expect(bars[0].open).toBe(188.0);
      expect(bars[0].high).toBe(190.0);
      expect(bars[0].volume).toBe(5000000);

      broker.disconnect();
    });
  });

  describe('searchStocks', () => {
    it('should search for stocks', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL', description: 'Apple Inc', currency: 'USD', exchange: 'NASDAQ', type: 'STK', group: 'Technology' },
        { conid: 207639, symbol: 'MSFT', description: 'Microsoft Corp', currency: 'USD', exchange: 'NASDAQ', type: 'STK', group: 'Technology' },
      ]));

      const results = await broker.searchStocks('apple');
      expect(results.length).toBe(2);
      expect(results[0].symbol).toBe('AAPL');
      expect(results[1].symbol).toBe('MSFT');

      broker.disconnect();
    });
  });

  describe('subscribeTicks', () => {
    it('should return a cleanup function', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      const cleanup = broker.subscribeTicks(['AAPL'], () => {});
      expect(typeof cleanup).toBe('function');
      cleanup(); // Should not throw

      broker.disconnect();
    });
  });

  // ──────────────── getIndices ────────────────

  describe('getIndices', () => {
    it('should return empty array (IBKR has no dedicated indices endpoint)', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      const indices = await broker.getIndices();
      expect(indices).toEqual([]);

      broker.disconnect();
    });
  });

  // ──────────────── getStocks ────────────────

  describe('getStocks', () => {
    it('should return positions mapped as stock info', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      // Mock portfolio positions
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, contractDesc: 'AAPL', name: 'Apple Inc', mktPrice: 189.50 },
        { conid: 207639, contractDesc: 'MSFT', name: 'Microsoft Corp', mktPrice: 420.00 },
      ]));

      const stocks = await broker.getStocks();
      expect(stocks.length).toBe(2);
      expect(stocks[0].symbol).toBe('AAPL');
      expect(stocks[0].price).toBe(189.50);
      expect(stocks[1].symbol).toBe('MSFT');

      broker.disconnect();
    });

    it('should return empty array when no positions', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      mockFetch.mockResolvedValueOnce(mockResponse('not an array'));

      const stocks = await broker.getStocks();
      expect(stocks).toEqual([]);

      broker.disconnect();
    });
  });

  // ──────────────── getBulkQuotes ────────────────

  describe('getBulkQuotes', () => {
    beforeEach(async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });
    });

    afterEach(() => {
      broker.disconnect();
    });

    it('should return quotes for multiple symbols', async () => {
      // Mock secdef search for symbol 1
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL', description: 'Apple Inc' },
      ]));
      // Mock secdef search for symbol 2
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 207639, symbol: 'MSFT', description: 'Microsoft Corp' },
      ]));
      // Mock market data snapshot for both conids
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, '31': 189.50, '70': 188.0, '71': 190.2, '72': 187.8, '73': 188.5, '82': 1.0, '83': 0.53, '84': 189.45, '86': 189.55, '87': 5000000 },
        { conid: 207639, '31': 420.00, '70': 418.0, '71': 422.0, '72': 417.5, '73': 419.0, '82': 1.0, '83': 0.24, '84': 419.95, '86': 420.05, '87': 3000000 },
      ]));

      const quotes = await broker.getBulkQuotes(['AAPL', 'MSFT']);
      expect(quotes.size).toBe(2);
      expect(quotes.get('AAPL')!.lastPrice).toBe(189.50);
      expect(quotes.get('MSFT')!.lastPrice).toBe(420.00);
    });

    it('should handle partial resolution failures', async () => {
      // Mock secdef search for AAPL (succeeds)
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL' },
      ]));
      // Mock secdef search for UNKNOWN (fails)
      mockFetch.mockResolvedValueOnce(mockResponse([]));
      // Mock market data snapshot (only AAPL)
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, '31': 189.50, '70': 188.0, '71': 190.2, '72': 187.8, '73': 188.5, '82': 1.0, '83': 0.53, '84': 189.45, '86': 189.55, '87': 5000000 },
      ]));

      const quotes = await broker.getBulkQuotes(['AAPL', 'UNKNOWN']);
      expect(quotes.size).toBe(1);
      expect(quotes.has('AAPL')).toBe(true);
    });

    it('should handle when API returns no data', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL' },
      ]));
      // Market data returns null/empty
      mockFetch.mockResolvedValueOnce(mockResponse(null));

      const quotes = await broker.getBulkQuotes(['AAPL']);
      expect(quotes.size).toBe(0);
    });
  });

  // ──────────────── getTradeHistory ────────────────

  describe('getTradeHistory', () => {
    beforeEach(async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });
    });

    afterEach(() => {
      broker.disconnect();
    });

    it('should return trade history', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { executionId: 'exe_1', symbol: 'AAPL', side: 'BUY', orderId: 12345, price: 185.0, amount: 100, time: new Date().toISOString(), contractDescription: 'Apple Inc', listingExchange: 'NASDAQ' },
        { executionId: 'exe_2', symbol: 'MSFT', side: 'SELL', orderId: 12346, price: 415.0, amount: 50, time: new Date().toISOString(), contractDescription: 'Microsoft Corp', listingExchange: 'NASDAQ' },
      ]));

      const trades = await broker.getTradeHistory();
      expect(trades.length).toBe(2);
      expect(trades[0].id).toBe('exe_1');
      expect(trades[0].symbol).toBe('AAPL');
      expect(trades[0].type).toBe('buy');
      expect(trades[0].quantity).toBe(100);
      expect(trades[1].type).toBe('sell');
    });

    it('should return empty array when no trades', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));
      expect(await broker.getTradeHistory()).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'));
      expect(await broker.getTradeHistory()).toEqual([]);
    });
  });

  // ──────────────── modifyOrder ────────────────

  describe('modifyOrder', () => {
    beforeEach(async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });
    });

    afterEach(() => {
      broker.disconnect();
    });

    it('should successfully modify an order', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: '12345' }));

      const result = await broker.modifyOrder({ orderId: '12345', quantity: 200, price: 195.0 });
      expect(result.status).toBe('confirmed');
      expect(result.id).toBe('12345');
    });

    it('should return rejected status on API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Order modification failed'));

      const result = await broker.modifyOrder({ orderId: '99999', quantity: 1 });
      expect(result.status).toBe('rejected');
      expect(result.id).toBe('99999');
    });
  });

  // ──────────────── getHoldings ────────────────

  describe('getHoldings', () => {
    beforeEach(async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });
    });

    afterEach(() => {
      broker.disconnect();
    });

    it('should delegate to getPositions', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, contractDesc: 'AAPL', position: 100, mktPrice: 189.50, avgCost: 175.00, unrealizedPnl: 1450.00 },
      ]));

      const holdings = await broker.getHoldings();
      expect(holdings.length).toBe(1);
      expect(holdings[0].symbol).toBe('AAPL');
      expect(holdings[0].quantity).toBe(100);
    });
  });

  // ──────────────── mapOrderStatus (via getOpenOrders) ────────────────

  describe('getOpenOrders — order status mappings', () => {
    beforeEach(async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });
    });

    afterEach(() => {
      broker.disconnect();
    });

    it('should map PRE_SUBMITTED to pending', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        orders: [
          { orderId: 1, orderType: 'LMT', side: 'BUY', quantity: 10, status: 'PRE_SUBMITTED', ticker: 'AAPL', listingExchange: 'NASDAQ', lastExecutionTime: new Date().toISOString() },
        ] as any[],
      }));

      const orders = await broker.getOpenOrders();
      expect(orders[0].status).toBe('pending');
    });

    it('should map INACTIVE to trigger_pending', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        orders: [
          { orderId: 3, orderType: 'LMT', side: 'SELL', quantity: 5, status: 'INACTIVE', ticker: 'MSFT', listingExchange: 'NASDAQ', lastExecutionTime: new Date().toISOString() },
        ] as any[],
      }));

      const orders = await broker.getOpenOrders();
      expect(orders[0].status).toBe('trigger_pending');
    });

    it('should map SUBMITTED to open', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        orders: [
          { orderId: 6, orderType: 'LMT', side: 'BUY', quantity: 5, status: 'SUBMITTED', ticker: 'GOOGL', listingExchange: 'NASDAQ', lastExecutionTime: new Date().toISOString() },
        ] as any[],
      }));

      const orders = await broker.getOpenOrders();
      expect(orders.length).toBe(1);
      expect(orders[0].status).toBe('open');
    });

    it('should map PARTIALLY_FILLED to partially_filled', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        orders: [
          { orderId: 7, orderType: 'LMT', side: 'BUY', quantity: 10, filledQuantity: 3, status: 'PARTIALLY_FILLED', ticker: 'AAPL', listingExchange: 'NASDAQ', lastExecutionTime: new Date().toISOString() },
        ] as any[],
      }));

      const orders = await broker.getOpenOrders();
      expect(orders.length).toBe(1);
      expect(orders[0].status).toBe('partially_filled');
    });

    it('should map PARTIAL alias to partially_filled', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        orders: [
          { orderId: 8, orderType: 'MKT', side: 'SELL', quantity: 5, filledQuantity: 2, status: 'PARTIAL', ticker: 'MSFT', listingExchange: 'NASDAQ', lastExecutionTime: new Date().toISOString() },
        ] as any[],
      }));

      const orders = await broker.getOpenOrders();
      expect(orders.length).toBe(1);
      expect(orders[0].status).toBe('partially_filled');
    });

    it('should return empty array on API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'));
      expect(await broker.getOpenOrders()).toEqual([]);
    });

    it('should return empty array when no orders data', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}));
      expect(await broker.getOpenOrders()).toEqual([]);
    });

    it('should filter out completed statuses', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        orders: [
          { orderId: 1, orderType: 'LMT', side: 'BUY', quantity: 10, status: 'OPEN', ticker: 'AAPL', listingExchange: 'NASDAQ', lastExecutionTime: new Date().toISOString() },
          { orderId: 2, orderType: 'LMT', side: 'SELL', quantity: 5, status: 'FILLED', ticker: 'MSFT', listingExchange: 'NASDAQ', lastExecutionTime: new Date().toISOString() },
        ] as any[],
      }));

      const orders = await broker.getOpenOrders();
      expect(orders.length).toBe(1);
      expect(orders[0].id).toBe('1');
    });
  });

  // ──────────────── mapOrderType (via placeOrder) ────────────────

  describe('placeOrder — order type mappings', () => {
    beforeEach(async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });
    });

    afterEach(() => {
      broker.disconnect();
    });

    it('should map LIMIT order type to LMT', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL' },
      ]));
      mockFetch.mockResolvedValueOnce(mockResponse({ id: '1' }));

      await broker.placeOrder({
        symbol: 'AAPL', exchange: 'NASDAQ', transactionType: 'BUY',
        quantity: 10, price: 190, productType: 'CNC', orderType: 'LIMIT',
      });

      // Authenticate: [0]=health, [1]=auth, [2]=accounts, then [3]=secdef, [4]=order
      const callBody = JSON.parse(mockFetch.mock.calls[4][1].body);
      expect(callBody.orderType).toBe('LMT');
    });

    it('should map MARKET order type to MKT', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL' },
      ]));
      mockFetch.mockResolvedValueOnce(mockResponse({ id: '2' }));

      await broker.placeOrder({
        symbol: 'AAPL', exchange: 'SMART', transactionType: 'SELL',
        quantity: 5, price: 0, productType: 'CNC', orderType: 'MARKET',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[4][1].body);
      expect(callBody.orderType).toBe('MKT');
    });

    it('should map SL order type to STP', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 207639, symbol: 'MSFT' },
      ]));
      mockFetch.mockResolvedValueOnce(mockResponse({ id: '3' }));

      await broker.placeOrder({
        symbol: 'MSFT', exchange: 'SMART', transactionType: 'SELL',
        quantity: 10, price: 400, productType: 'CNC', orderType: 'SL',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[4][1].body);
      expect(callBody.orderType).toBe('STP');
    });

    it('should map SLM order type to STP_LMT', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL' },
      ]));
      mockFetch.mockResolvedValueOnce(mockResponse({ id: '4' }));

      await broker.placeOrder({
        symbol: 'AAPL', exchange: 'SMART', transactionType: 'BUY',
        quantity: 1, price: 200, productType: 'CNC', orderType: 'SLM',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[4][1].body);
      expect(callBody.orderType).toBe('STP_LMT');
    });

    it('should return pending status when no order ID returned', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL' },
      ]));
      mockFetch.mockResolvedValueOnce(mockResponse({ message: 'Order submitted to queue' }));

      const result = await broker.placeOrder({
        symbol: 'AAPL', exchange: 'SMART', transactionType: 'BUY',
        quantity: 10, price: 190, productType: 'CNC', orderType: 'LIMIT',
      });

      expect(result.status).toBe('pending');
    });
  });

  // ──────────────── resolveConid edge cases (via getQuote) ────────────────

  describe('resolveConid edge cases', () => {
    beforeEach(async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });
    });

    afterEach(() => {
      broker.disconnect();
    });

    it('should throw when symbol cannot be resolved', async () => {
      // Empty search results
      mockFetch.mockResolvedValueOnce(mockResponse([]));

      // The placeholder conid + snapshot call won't happen since we expect throw
      // Actually, resolveConid returns a placeholder on empty search, not throws
      // So getQuote will proceed with the placeholder and call getMarketSnapshot
      // Let's mock the snapshot too
      mockFetch.mockResolvedValueOnce(mockResponse(null));

      await expect(broker.getQuote('ZZZZZ')).rejects.toThrow('No quote data for ZZZZZ');
    });

    it('should use cache for previously resolved symbols', async () => {
      // First call: resolve + snapshot
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL' },
      ]));
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, '31': 189.50, '70': 188.0, '71': 190.2, '72': 187.8, '73': 188.5, '82': 1.0, '83': 0.53, '84': 189.45, '86': 189.55, '87': 5000000 },
      ]));
      await broker.getQuote('AAPL');

      // Second call: should cache hit (no secdef search), just snapshot
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, '31': 190.0, '70': 189.0, '71': 191.0, '72': 188.5, '73': 189.5, '82': 0.5, '83': 0.26, '84': 189.95, '86': 190.05, '87': 4000000 },
      ]));
      const quote = await broker.getQuote('AAPL');
      expect(quote.lastPrice).toBe(190.0);
      // Only 1 secdef search call (first call), not 2
      const secdefCalls = mockFetch.mock.calls.filter((c: any[]) => c[0].includes('secdef'));
      expect(secdefCalls.length).toBe(1);
    });

    it('should handle search API failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Search API error'));
      mockFetch.mockResolvedValueOnce(mockResponse(null));

      await expect(broker.getQuote('ERROR')).rejects.toThrow('No quote data for ERROR');
    });
  });

  // ──────────────── searchStocks edge cases ────────────────

  describe('searchStocks edge cases', () => {
    beforeEach(async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });
    });

    afterEach(() => {
      broker.disconnect();
    });

    it('should return empty array when API fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'));

      const results = await broker.searchStocks('ERROR');
      expect(results).toEqual([]);
    });

    it('should return empty array when data is not an array', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(null));

      const results = await broker.searchStocks('NOTHING');
      expect(results).toEqual([]);
    });
  });

  // ──────────────── getOHLC edge cases ────────────────

  describe('getOHLC edge cases', () => {
    beforeEach(async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });
    });

    afterEach(() => {
      broker.disconnect();
    });

    it('should return empty array when data is null', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL' },
      ]));
      mockFetch.mockResolvedValueOnce(mockResponse({ data: null }));

      const bars = await broker.getOHLC('AAPL', '1d', 1);
      expect(bars).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL' },
      ]));
      mockFetch.mockRejectedValueOnce(new Error('History API error'));

      const bars = await broker.getOHLC('AAPL', '1d', 1);
      expect(bars).toEqual([]);
    });

    it('should map interval strings correctly', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL' },
      ]));
      mockFetch.mockResolvedValueOnce(mockResponse({ data: [] }));

      await broker.getOHLC('AAPL', '5m', 1);
      const historyCall = mockFetch.mock.calls.find((c: any[]) => c[0].includes('marketdata/history'));
      expect(historyCall[0]).toContain('barType=5min');
    });
  });

  // ──────────────── getPositions edge cases ────────────────

  describe('getPositions edge cases', () => {
    beforeEach(async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });
    });

    afterEach(() => {
      broker.disconnect();
    });

    it('should filter out zero-quantity positions', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, contractDesc: 'AAPL', position: 100, mktPrice: 189.50, avgCost: 175.00, unrealizedPnl: 1450.00 },
        { conid: 99999, contractDesc: 'ZEROPOS', position: 0, mktPrice: 0, avgCost: 0, unrealizedPnl: 0 },
      ]));

      const positions = await broker.getPositions();
      expect(positions.length).toBe(1);
      expect(positions[0].symbol).toBe('AAPL');
    });

    it('should calculate pnlPercent correctly', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, contractDesc: 'AAPL', position: 100, mktPrice: 200.00, avgCost: 150.00, unrealizedPnl: 5000.00 },
      ]));

      const positions = await broker.getPositions();
      expect(positions[0].pnlPercent).toBeCloseTo(33.33, 1);
    });
  });

  // ──────────────── getAccounts fallback ────────────────

  describe('authenticate — accounts fallback', () => {
    it('should fall back to portfolio accounts endpoint when accounts missing', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({})); // health
      mockFetch.mockResolvedValueOnce(mockResponse({ authenticated: true, connected: true })); // auth
      // accounts returns no data.accounts — fallback
      mockFetch.mockResolvedValueOnce(mockResponse({ something: 'not accounts' }));
      // Fallback to /portfolio/accounts
      mockFetch.mockResolvedValueOnce(mockResponse([
        { id: 'U5555555', accountId: 'U5555555', accountTitle: 'Fallback Account', accountType: 'INDIVIDUAL', currency: 'USD', status: 'Active' },
      ]));

      const result = await broker.authenticate({ apiKey: 'test' });
      expect(result).toBe(true);
      expect(broker.isConnected()).toBe(true);
      broker.disconnect();
    });

    it('should return false when no accounts found', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({})); // health
      mockFetch.mockResolvedValueOnce(mockResponse({ authenticated: true, connected: true })); // auth
      mockFetch.mockResolvedValueOnce(mockResponse({ something: 'not accounts' })); // no accounts
      mockFetch.mockResolvedValueOnce(mockResponse([])); // fallback also empty

      const result = await broker.authenticate({ apiKey: 'test' });
      expect(result).toBe(false);
      broker.disconnect();
    });
  });

  // ──────────────── getBulkQuotes with API failure ────────────────

  describe('getBulkQuotes — API failures', () => {
    beforeEach(async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });
    });

    afterEach(() => {
      broker.disconnect();
    });

    it('should return empty map when snapshot API fails', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([
        { conid: 265598, symbol: 'AAPL' },
      ]));
      mockFetch.mockRejectedValueOnce(new Error('Snapshot error'));

      const quotes = await broker.getBulkQuotes(['AAPL']);
      expect(quotes.size).toBe(0);
    });
  });

  // ──────────────── disconnect ────────────────

  describe('disconnect', () => {
    it('should clean up tickle interval and set connected to false', async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });

      expect(broker.isConnected()).toBe(true);
      broker.disconnect();
      expect(broker.isConnected()).toBe(false);
    });

    it('should be safe to call disconnect multiple times', () => {
      broker.disconnect();
      broker.disconnect();
      expect(broker.isConnected()).toBe(false);
    });
  });

  // ──────────────── cancelOrder error ────────────────

  describe('cancelOrder error handling', () => {
    beforeEach(async () => {
      mockGatewayHealth();
      mockAuthStatus(true);
      mockAccounts();
      await broker.authenticate({ apiKey: 'test' });
    });

    afterEach(() => {
      broker.disconnect();
    });

    it('should return rejected status on API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Cancel failed'));

      const result = await broker.cancelOrder({ orderId: '99999' });
      expect(result.status).toBe('rejected');
      expect(result.id).toBe('99999');
    });

    it('should throw when not authenticated', async () => {
      const unauthenticatedBroker = new IbkrBroker();
      await expect(
        unauthenticatedBroker.cancelOrder({ orderId: '1' }),
      ).rejects.toThrow('not authenticated');
    });
  });

  // ──────────────── plugin registration ────────────────

  describe('plugin registration', () => {
    it('should have correct metadata', async () => {
      const { ibkrPlugin } = await import('../services/broker/plugins/ibkrPlugin');

      expect(ibkrPlugin.type).toBe('interactive-brokers');
      expect(ibkrPlugin.label).toBe('Interactive Brokers');
      expect(ibkrPlugin.region).toBe('global');
      expect(ibkrPlugin.priority).toBe(10);
      expect(ibkrPlugin.hasAPI).toBe(true);
      expect(ibkrPlugin.authModes).toContain('credentials');
      expect(ibkrPlugin.regions).toContain('us');
      expect(ibkrPlugin.regions).toContain('europe');
      expect(ibkrPlugin.regions).toContain('asia');
      expect(ibkrPlugin.capabilities).toContain('stocks');
      expect(ibkrPlugin.capabilities).toContain('options');
      expect(ibkrPlugin.capabilities).toContain('futures');
    });
  });
});
