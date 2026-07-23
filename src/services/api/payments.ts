import { api } from './client';

export interface CreateOrderResponse {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
}

export interface CreateMandateResponse {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  method: string;
  mandateId?: string;
}

export interface CreateSubscriptionResponse {
  subscriptionId: string;
  keyId: string;
  status: string;
  currentStart: number;
  currentEnd: number;
  endedAt: number | null;
  chargeAt: number;
  startAt: number;
  totalCount: number;
  paidCount: number;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
}

export const paymentsApi = {
  /**
   * Creates a Razorpay order for the given plan and billing period.
   * Optionally pass a tenantId to route payment through the tenant's Razorpay account.
   */
  createOrder: async (
    planId: string,
    billingPeriod: 'monthly' | 'yearly' = 'monthly',
    tenantId?: string,
  ): Promise<CreateOrderResponse> => {
    return api.post<CreateOrderResponse>('/payments/create-order', {
      planId,
      billingPeriod,
      tenantId,
    });
  },

  /**
   * Creates a Razorpay order for adding funds to the user's wallet.
   */
  createFundOrder: async (
    amount: number,
    currency: string = 'INR',
  ): Promise<CreateOrderResponse> => {
    return api.post<CreateOrderResponse>('/payments/create-fund-order', {
      amount,
      currency,
    });
  },

  /**
   * Verifies a completed Razorpay payment on the backend.
   */
  verifyPayment: async (params: {
    razorpayPaymentId: string;
    razorpayOrderId: string;
    razorpaySignature: string;
    planId?: string;
    type?: 'subscription' | 'fund_add';
    tenantId?: string;
  }): Promise<VerifyPaymentResponse & { type?: string }> => {
    return api.post<VerifyPaymentResponse & { type?: string }>('/payments/verify', params);
  },

  /**
   * Creates a Razorpay mandate setup order for UPI AutoPay.
   * Returns an order that the frontend should open in Razorpay Checkout
   * to capture the user's UPI mandate.
   */
  createMandate: async (params: {
    planId: string;
    billingPeriod: 'monthly' | 'yearly';
    customerName?: string;
    customerEmail?: string;
    customerContact?: string;
    tenantId?: string;
  }): Promise<CreateMandateResponse> => {
    return api.post<CreateMandateResponse>('/payments/create-mandate', params);
  },

  /**
   * Creates a Razorpay subscription (recurring payment plan).
   * Used when setting up recurring billing for UPI AutoPay mandates.
   */
  createSubscription: async (params: {
    planId: string;
    billingPeriod: 'monthly' | 'yearly';
    totalCount?: number;
    tenantId?: string;
  }): Promise<CreateSubscriptionResponse> => {
    return api.post<CreateSubscriptionResponse>('/payments/create-subscription', params);
  },

  /**
   * Creates a direct paid order for one-time payments.
   */
  createPaidOrder: async (params: {
    amount: number;
    currency?: string;
    receipt?: string;
  }): Promise<CreateOrderResponse & { status: string }> => {
    return api.post<CreateOrderResponse & { status: string }>('/payments/create-paid-order', params);
  },
};
