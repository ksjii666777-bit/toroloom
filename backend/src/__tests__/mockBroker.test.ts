/**
 * ============================================================================
 * Toroloom Mock Broker — EDIS & Brokerage Calculator Unit Tests
 * ============================================================================
 *
 * Tests the MockBroker EDIS and Brokerage Calculator stub methods.
 * The MockBroker is used as the fallback in development/testing, so
 * its stubs should return sensible mock data matching the interface types.
 *
 * Run:
 *   npx vitest run --reporter=verbose src/__tests__/mockBroker.test.ts
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockBroker } from '../services/broker/mockBroker';
import type { BrokerConfig } from '../services/broker/interface';

// ──── Test Helpers ──────────────────────────────────────────────────────────

function createConfig(): BrokerConfig {
  return { apiKey: 'mock' };
}

// ──── Tests ─────────────────────────────────────────────────────────────────

describe('MockBroker', () => {
  let broker: MockBroker;

  beforeEach(async () => {
    broker = new MockBroker();
    await broker.authenticate(createConfig());
  });

  // ──────────────── EDIS: verifyEDIS ────────────────

  describe('verifyEDIS', () => {
    it('should return a valid EDISVerifyResponse', async () => {
      const result = await broker['verifyEDIS']({
        isin: 'INESP123',
        quantity: '10',
      });

      expect(result).toHaveProperty('ReqId');
      expect(result).toHaveProperty('ReturnURL');
      expect(result).toHaveProperty('DPId');
      expect(result).toHaveProperty('BOID');
      expect(result).toHaveProperty('TransDtls');
      expect(typeof result.ReqId).toBe('string');
      expect(result.ReturnURL).toContain('cdsl');
      expect(result.BOID).toContain('INESP123');
    });

    it('should generate a unique ReqId each call', async () => {
      const result1 = await broker['verifyEDIS']({ isin: 'INE001', quantity: '5' });
      const result2 = await broker['verifyEDIS']({ isin: 'INE002', quantity: '10' });

      expect(result1.ReqId).not.toBe(result2.ReqId);
    });

    it('should accept different ISINs and quantities', async () => {
      const result = await broker['verifyEDIS']({ isin: 'INEABC123', quantity: '100' });

      expect(result.BOID).toContain('INEABC123');
    });
  });

  // ──────────────── EDIS: generateTPIN ────────────────

  describe('generateTPIN', () => {
    it('should return a success status', async () => {
      const result = await broker['generateTPIN']({
        dpId: '12345',
        ReqId: 'REQ_001',
        boid: 'BO_INE123',
        pan: 'ABCDE1234F',
      });

      expect(result).toHaveProperty('status');
      expect(result.status).toContain('TPIN');
    });

    it('should succeed regardless of input values', async () => {
      const result = await broker['generateTPIN']({
        dpId: '',
        ReqId: '',
        boid: '',
        pan: '',
      });

      expect(result.status).toBeTruthy();
    });
  });

  // ──────────────── EDIS: getEDISTranStatus ────────────────

  describe('getEDISTranStatus', () => {
    it('should return status 1 (authorised) for any valid ReqId', async () => {
      const result = await broker['getEDISTranStatus']({ ReqId: 'REQ_001' });

      expect(result.status).toBe(1);
    });

    it('should echo back the provided ReqId', async () => {
      const result = await broker['getEDISTranStatus']({ ReqId: 'MY_REQ_ID' });

      expect(result.ReqId).toBe('MY_REQ_ID');
    });
  });

  // ──────────────── Brokerage Calculator: estimateBrokerage ────────────────

  describe('estimateBrokerage', () => {
    it('should return a complete charge breakdown for a single order', async () => {
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
      expect(result.payload).toHaveProperty('brokerage');
      expect(result.payload).toHaveProperty('transaction_charges');
      expect(result.payload).toHaveProperty('gst');
      expect(result.payload).toHaveProperty('stt_ctt');
      expect(result.payload).toHaveProperty('stamp_duty');
      expect(result.payload).toHaveProperty('sebi_turnover_fees');
      expect(result.payload).toHaveProperty('total_charges');

      // All charge values should be non-negative
      expect(result.payload.brokerage).toBeGreaterThanOrEqual(0);
      expect(result.payload.transaction_charges).toBeGreaterThanOrEqual(0);
      expect(result.payload.gst).toBeGreaterThanOrEqual(0);
      expect(result.payload.stt_ctt).toBeGreaterThanOrEqual(0);
      expect(result.payload.stamp_duty).toBeGreaterThanOrEqual(0);
      expect(result.payload.sebi_turnover_fees).toBeGreaterThanOrEqual(0);
      expect(result.payload.total_charges).toBeGreaterThanOrEqual(0);
    });

    it('should produce larger charges for higher order values', async () => {
      const smallOrder = await broker['estimateBrokerage']({
        orders: [{
          product_type: 'DELIVERY',
          transaction_type: 'BUY',
          exchange: 'NSE',
          symbol: 'SML',
          token: '1',
          qty: 1,
          price: 100,
        }],
      });

      const largeOrder = await broker['estimateBrokerage']({
        orders: [{
          product_type: 'DELIVERY',
          transaction_type: 'BUY',
          exchange: 'NSE',
          symbol: 'LRG',
          token: '2',
          qty: 100,
          price: 10000,
        }],
      });

      expect(largeOrder.payload.brokerage).toBeGreaterThan(smallOrder.payload.brokerage);
      expect(largeOrder.payload.total_charges).toBeGreaterThan(smallOrder.payload.total_charges);
    });

    it('should sum charges correctly across multiple orders', async () => {
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

      const sum = result.payload.brokerage
        + result.payload.transaction_charges
        + result.payload.gst
        + result.payload.stt_ctt
        + result.payload.stamp_duty
        + result.payload.sebi_turnover_fees;

      expect(result.payload.total_charges).toBeCloseTo(sum, 1);
    });

    it('should return 0 charges for zero-value order', async () => {
      const result = await broker['estimateBrokerage']({
        orders: [{
          product_type: 'DELIVERY',
          transaction_type: 'BUY',
          exchange: 'NSE',
          symbol: 'NONE',
          token: '0',
          qty: 0,
          price: 0,
        }],
      });

      expect(result.payload.brokerage).toBe(0);
      expect(result.payload.transaction_charges).toBe(0);
      expect(result.payload.total_charges).toBe(0);
    });

    it('should handle multiple orders of different types', async () => {
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
            product_type: 'MARGIN',
            transaction_type: 'SELL',
            exchange: 'NFO',
            symbol: 'NIFTY',
            token: '99926000',
            qty: 50,
            price: 23400,
          },
        ],
      });

      expect(result.payload.total_charges).toBeGreaterThan(0);
    });
  });

  // ──────────────── Market Data: getIndices ────────────────

  describe('getIndices', () => {
    it('should return index data array', async () => {
      const indices = await broker.getIndices();
      expect(Array.isArray(indices)).toBe(true);
      expect(indices.length).toBeGreaterThan(0);
      expect(indices[0]).toHaveProperty('id');
      expect(indices[0]).toHaveProperty('name');
      expect(indices[0]).toHaveProperty('currentValue');
    });

    it('should include NIFTY and SENSEX', async () => {
      const indices = await broker.getIndices();
      const names = indices.map(i => i.shortName);
      expect(names).toContain('NIFTY');
      expect(names).toContain('SENSEX');
    });

    it('should have positive currentValue for all indices', async () => {
      const indices = await broker.getIndices();
      for (const idx of indices) {
        expect(idx.currentValue).toBeGreaterThan(0);
      }
    });
  });

  // ──────────────── Market Data: getStocks ────────────────

  describe('getStocks', () => {
    it('should return a list of stock info', async () => {
      const stocks = await broker.getStocks();
      expect(Array.isArray(stocks)).toBe(true);
      expect(stocks.length).toBeGreaterThan(0);
      expect(stocks[0]).toHaveProperty('symbol');
      expect(stocks[0]).toHaveProperty('price');
      expect(stocks[0]).toHaveProperty('change');
    });

    it('should include known stocks', async () => {
      const stocks = await broker.getStocks();
      const symbols = stocks.map(s => s.symbol);
      expect(symbols).toContain('RELIANCE');
      expect(symbols).toContain('TCS');
    });
  });

  // ──────────────── Market Data: getQuote ────────────────

  describe('getQuote', () => {
    it('should return a quote for a valid symbol', async () => {
      const quote = await broker.getQuote('RELIANCE');
      expect(quote.symbol).toBe('RELIANCE');
      expect(quote.lastPrice).toBeGreaterThan(0);
      expect(quote).toHaveProperty('open');
      expect(quote).toHaveProperty('high');
      expect(quote).toHaveProperty('low');
      expect(quote).toHaveProperty('volume');
      expect(quote).toHaveProperty('change');
      expect(quote).toHaveProperty('changePercent');
    });

    it('should throw for an unknown symbol', async () => {
      await expect(broker.getQuote('NONEXISTENT')).rejects.toThrow(
        'Stock not found: NONEXISTENT',
      );
    });

    it('should return different quotes for different symbols', async () => {
      const reliance = await broker.getQuote('RELIANCE');
      const tcs = await broker.getQuote('TCS');
      expect(reliance.lastPrice).not.toBe(tcs.lastPrice);
    });
  });

  // ──────────────── Market Data: getBulkQuotes ────────────────

  describe('getBulkQuotes', () => {
    it('should return quotes for multiple symbols', async () => {
      const map = await broker.getBulkQuotes(['RELIANCE', 'TCS', 'INFY']);
      expect(map.size).toBe(3);
      expect(map.has('RELIANCE')).toBe(true);
      expect(map.has('TCS')).toBe(true);
      expect(map.has('INFY')).toBe(true);
    });

    it('should skip unknown symbols without throwing', async () => {
      const map = await broker.getBulkQuotes(['RELIANCE', 'UNKNOWN']);
      expect(map.size).toBe(1);
      expect(map.has('RELIANCE')).toBe(true);
      expect(map.has('UNKNOWN')).toBe(false);
    });
  });

  // ──────────────── Market Data: getOHLC ────────────────

  describe('getOHLC', () => {
    it('should return OHLC data for a valid symbol', async () => {
      const data = await broker.getOHLC('RELIANCE', '1d', 5);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('date');
      expect(data[0]).toHaveProperty('open');
      expect(data[0]).toHaveProperty('high');
      expect(data[0]).toHaveProperty('low');
      expect(data[0]).toHaveProperty('close');
      expect(data[0]).toHaveProperty('volume');
    });

    it('should throw for an unknown symbol', async () => {
      await expect(broker.getOHLC('UNKNOWN', '1d', 5)).rejects.toThrow(
        'Stock not found: UNKNOWN',
      );
    });

    it('should clamp days between 1 and 730', async () => {
      const data = await broker.getOHLC('RELIANCE', '1d', 9999);
      // Should have at most 730 data points
      expect(data.length).toBeLessThanOrEqual(731);
    });
  });

  // ──────────────── Market Data: searchStocks ────────────────

  describe('searchStocks', () => {
    it('should find stocks matching query', async () => {
      const results = await broker.searchStocks('REL');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.symbol === 'RELIANCE')).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const results = await broker.searchStocks('ZZZZZ');
      expect(results).toEqual([]);
    });

    it('should be case-insensitive', async () => {
      const upper = await broker.searchStocks('RELIANCE');
      const lower = await broker.searchStocks('reliance');
      expect(upper.length).toBe(lower.length);
    });
  });

  // ──────────────── Open Orders ────────────────

  describe('getOpenOrders', () => {
    it('should return open orders list', async () => {
      const orders = await broker.getOpenOrders();
      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeGreaterThan(0);
      expect(orders[0]).toHaveProperty('id');
      expect(orders[0]).toHaveProperty('symbol');
      expect(orders[0]).toHaveProperty('status');
    });

    it('should include orders with various statuses', async () => {
      const orders = await broker.getOpenOrders();
      const statuses = orders.map(o => o.status);
      expect(statuses).toContain('open');
      expect(statuses).toContain('partially_filled');
    });
  });

  // ──────────────── Positions ────────────────

  describe('getPositions', () => {
    it('should return positions array', async () => {
      const positions = await broker.getPositions();
      expect(Array.isArray(positions)).toBe(true);
      expect(positions.length).toBeGreaterThan(0);
      expect(positions[0]).toHaveProperty('symbol');
      expect(positions[0]).toHaveProperty('quantity');
      expect(positions[0]).toHaveProperty('pnl');
    });

    it('should include known positions', async () => {
      const positions = await broker.getPositions();
      const symbols = positions.map(p => p.symbol);
      expect(symbols).toContain('RELIANCE');
      expect(symbols).toContain('HDFCBANK');
    });
  });

  // ──────────────── Trade History ────────────────

  describe('getTradeHistory', () => {
    it('should return trade history array', async () => {
      const trades = await broker.getTradeHistory();
      expect(Array.isArray(trades)).toBe(true);
      expect(trades.length).toBeGreaterThan(0);
      expect(trades[0]).toHaveProperty('id');
      expect(trades[0]).toHaveProperty('symbol');
      expect(trades[0]).toHaveProperty('type');
    });
  });

  // ──────────────── Holdings ────────────────

  describe('getHoldings', () => {
    it('should delegate to getPositions', async () => {
      const holdings = await broker.getHoldings();
      const positions = await broker.getPositions();
      expect(holdings.length).toBe(positions.length);
      expect(holdings[0].symbol).toBe(positions[0].symbol);
    });
  });

  // ──────────────── placeOrder ────────────────

  describe('placeOrder', () => {
    it('should place a BUY order for a known symbol', async () => {
      const result = await broker.placeOrder({
        symbol: 'WIPRO',
        exchange: 'NSE',
        transactionType: 'BUY',
        quantity: 10,
        price: 450,
        productType: 'CNC',
        orderType: 'LIMIT',
      });

      expect(result.status).toBe('confirmed');
      expect(result.message).toContain('BUY');
      expect(result.message).toContain('WIPRO');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('timestamp');
    });

    it('should reject for an unknown symbol', async () => {
      const result = await broker.placeOrder({
        symbol: 'UNKNOWNSYM',
        exchange: 'NSE',
        transactionType: 'BUY',
        quantity: 10,
        price: 100,
        productType: 'CNC',
        orderType: 'LIMIT',
      });

      expect(result.status).toBe('rejected');
      expect(result.message).toContain('UNKNOWNSYM');
    });

    it('should place a SELL order', async () => {
      const result = await broker.placeOrder({
        symbol: 'RELIANCE',
        exchange: 'NSE',
        transactionType: 'SELL',
        quantity: 10,
        price: 2900,
        productType: 'CNC',
        orderType: 'LIMIT',
      });

      expect(result.status).toBe('confirmed');
      expect(result.message).toContain('SELL');
    });
  });

  // ──────────────── modifyOrder ────────────────

  describe('modifyOrder', () => {
    it('should modify an existing open order', async () => {
      const result = await broker.modifyOrder({
        orderId: 'open_ord_1',
        price: 2900,
        quantity: 30,
      });

      expect(result.status).toBe('confirmed');
      expect(result.message).toContain('open_ord_1');

      // Verify the change took effect
      const orders = await broker.getOpenOrders();
      const modified = orders.find(o => o.id === 'open_ord_1');
      expect(modified?.price).toBe(2900);
      expect(modified?.quantity).toBe(30);
    });

    it('should reject for a non-existent order', async () => {
      const result = await broker.modifyOrder({
        orderId: 'non_existent_id',
        price: 100,
      });

      expect(result.status).toBe('rejected');
      expect(result.message).toContain('non_existent_id');
    });
  });

  // ──────────────── cancelOrder ────────────────

  describe('cancelOrder', () => {
    it('should cancel an existing open order', async () => {
      const result = await broker.cancelOrder({ orderId: 'open_ord_2' });

      expect(result.status).toBe('cancelled');
      expect(result.message).toContain('open_ord_2');

      // Verify it's removed from open orders
      const orders = await broker.getOpenOrders();
      expect(orders.some(o => o.id === 'open_ord_2')).toBe(false);
    });

    it('should reject for a non-existent order', async () => {
      const result = await broker.cancelOrder({ orderId: 'ghost_id' });

      expect(result.status).toBe('rejected');
      expect(result.message).toContain('ghost_id');
    });
  });

  // ──────────────── subscribeTicks ────────────────

  describe('subscribeTicks', () => {
    it('should return an unsubscribe function', () => {
      const onTick = vi.fn();
      const unsubscribe = broker.subscribeTicks(['RELIANCE'], onTick);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe(); // Should not throw
    });

    it('should allow multiple unsubscribes', () => {
      const unsubscribe = broker.subscribeTicks(['TCS'], vi.fn());
      unsubscribe(); // First call
      unsubscribe(); // Second call should not throw
    });
  });
});
