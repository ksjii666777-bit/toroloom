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
});
