import { api } from './client';

export interface CreateOrderResponse {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
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
};
