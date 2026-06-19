/**
 * ============================================================================
 * Toroloom — Payments API Tests
 * ============================================================================
 *
 * Tests the paymentsApi module: createOrder and verifyPayment.
 * Each test mocks globalThis.fetch to verify correct URL construction,
 * HTTP methods, and request bodies.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.unmock('../services/api/payments');

import { configureApi } from '../services/api/client';
import { paymentsApi } from '../services/api/payments';
import type { Mock } from 'vitest';

const API_BASE = 'http://localhost:3000/api';
const originalFetch = globalThis.fetch;

// ============================================================================
// PaymentsApi — createOrder
// ============================================================================

describe('PaymentsApi — createOrder', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /payments/create-order with planId and default billingPeriod', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody = '';
    const mockResponse = {
      orderId: 'order_OqT1vXyZabc123',
      keyId: 'rzp_live_xxxxxxxx',
      amount: 99900,
      currency: 'INR',
    };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve(mockResponse) };
    });

    const result = await paymentsApi.createOrder('plan_pro_monthly');

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(`${API_BASE}/payments/create-order`);
    expect(JSON.parse(capturedBody)).toEqual({
      planId: 'plan_pro_monthly',
      billingPeriod: 'monthly',
    });
    expect(result).toEqual(mockResponse);
  });

  it('sends POST with yearly billing period', async () => {
    let capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({
        orderId: 'order_abc', keyId: 'rzp_key', amount: 999900, currency: 'INR',
      }) };
    });

    await paymentsApi.createOrder('plan_elite_yearly', 'yearly');
    expect(JSON.parse(capturedBody)).toEqual({
      planId: 'plan_elite_yearly',
      billingPeriod: 'yearly',
    });
  });

  it('sends POST with tenantId for multi-tenant routing', async () => {
    let capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({
        orderId: 'order_tenant', keyId: 'rzp_tenant', amount: 49900, currency: 'INR',
      }) };
    });

    await paymentsApi.createOrder('plan_free_monthly', 'monthly', 'tenant_xyz');
    expect(JSON.parse(capturedBody)).toEqual({
      planId: 'plan_free_monthly',
      billingPeriod: 'monthly',
      tenantId: 'tenant_xyz',
    });
  });

  it('returns CreateOrderResponse with all fields', async () => {
    const mockResponse = {
      orderId: 'order_full',
      keyId: 'rzp_live_key',
      amount: 199900,
      currency: 'INR',
    };
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(mockResponse),
    });

    const result = await paymentsApi.createOrder('plan_pro_monthly');
    expect(result.orderId).toBe('order_full');
    expect(result.keyId).toBe('rzp_live_key');
    expect(result.amount).toBe(199900);
    expect(result.currency).toBe('INR');
  });

  it('attaches auth token', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve({
        orderId: 'o1', keyId: 'k1', amount: 100, currency: 'INR',
      }) };
    });

    await paymentsApi.createOrder('plan_test');
    expect(capturedHeaders['Authorization']).toBe('Bearer token');
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500,
      json: () => Promise.resolve({ error: 'Failed to create payment order' }),
    });
    await expect(paymentsApi.createOrder('plan_bad')).rejects.toThrow('Failed to create payment order');
  });

  it('throws on network error', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(paymentsApi.createOrder('plan_net')).rejects.toThrow('Failed to fetch');
  });

  it('throws with specific error message from server', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 400,
      json: () => Promise.resolve({ message: 'Invalid plan ID' }),
    });
    await expect(paymentsApi.createOrder('invalid_plan')).rejects.toThrow('Invalid plan ID');
  });
});

// ============================================================================
// PaymentsApi — verifyPayment
// ============================================================================

describe('PaymentsApi — verifyPayment', () => {
  const validParams = {
    razorpayPaymentId: 'pay_N8sH7dGkLpQr1m',
    razorpayOrderId: 'order_OqT1vXyZabc123',
    razorpaySignature: 'signature_abcdef1234567890',
    planId: 'plan_pro_monthly',
  };

  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends POST to /payments/verify with payment verification params', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody = '';
    const mockResponse = { success: true, message: 'Payment verified successfully' };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve(mockResponse) };
    });

    const result = await paymentsApi.verifyPayment(validParams);

    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe(`${API_BASE}/payments/verify`);
    expect(JSON.parse(capturedBody)).toEqual(validParams);
    expect(result).toEqual(mockResponse);
  });

  it('sends POST with optional tenantId', async () => {
    let capturedBody = '';
    const paramsWithTenant = { ...validParams, tenantId: 'tenant_abc' };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({
        success: true, message: 'Payment verified',
      }) };
    });

    await paymentsApi.verifyPayment(paramsWithTenant);
    expect(JSON.parse(capturedBody)).toEqual(paramsWithTenant);
  });

  it('returns VerifyPaymentResponse on success', async () => {
    const mockResponse = { success: true, message: 'Payment verified successfully' };
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(mockResponse),
    });

    const result = await paymentsApi.verifyPayment(validParams);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Payment verified successfully');
  });

  it('returns success=false when verification fails', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ success: false, message: 'Signature mismatch' }),
    });

    const result = await paymentsApi.verifyPayment(validParams);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Signature mismatch');
  });

  it('throws on server error during verification', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500,
      json: () => Promise.resolve({ error: 'Payment verification failed' }),
    });
    await expect(paymentsApi.verifyPayment(validParams)).rejects.toThrow('Payment verification failed');
  });

  it('throws on network error during verification', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(paymentsApi.verifyPayment(validParams)).rejects.toThrow('Failed to fetch');
  });

  it('attaches auth token', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve({
        success: true, message: 'Verified',
      }) };
    });

    await paymentsApi.verifyPayment(validParams);
    expect(capturedHeaders['Authorization']).toBe('Bearer token');
  });
});

// ============================================================================
// PaymentsApi — edge cases
// ============================================================================

describe('PaymentsApi — edge cases', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('createOrder with only planId (no billingPeriod) defaults to monthly', async () => {
    let capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({
        orderId: 'o1', keyId: 'k1', amount: 100, currency: 'INR',
      }) };
    });

    await paymentsApi.createOrder('plan_test');
    const body = JSON.parse(capturedBody);
    expect(body.billingPeriod).toBe('monthly');
  });

  it('createOrder with tenantId as undefined is not sent in body', async () => {
    let capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({
        orderId: 'o1', keyId: 'k1', amount: 100, currency: 'INR',
      }) };
    });

    await paymentsApi.createOrder('plan_test', 'monthly', undefined);
    const body = JSON.parse(capturedBody);
    expect(body).toEqual({ planId: 'plan_test', billingPeriod: 'monthly' });
    expect(body.tenantId).toBeUndefined();
  });

  it('verifyPayment with empty fields still sends the request', async () => {
    let capturedBody = '';
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({
        success: false, message: 'Invalid payment details',
      }) };
    });

    const result = await paymentsApi.verifyPayment({
      razorpayPaymentId: '',
      razorpayOrderId: '',
      razorpaySignature: '',
      planId: 'plan_test',
    });
    const body = JSON.parse(capturedBody);
    expect(body.razorpayPaymentId).toBe('');
    expect(body.razorpayOrderId).toBe('');
    expect(result.success).toBe(false);
  });
});
