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
  // @ts-ignore - mock global fetch
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
