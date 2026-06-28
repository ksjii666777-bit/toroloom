import { api } from './client';
import type { Holding, Trade, OpenOrder } from '../../types';

export interface PlaceOrderRequest {
  symbol: string;
  exchange?: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  productType?: string;
  orderType?: string;
  metadata?: Record<string, any>;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  riskEvaluation: { allowed: boolean; reason?: string };
  hookBlocked?: boolean;
  error?: string;
}

export interface ModifyOrderRequest {
  orderId: string;
  price?: number;
  quantity?: number;
  orderType?: string;
  productType?: string;
  triggerPrice?: number;
  symbol?: string;
  exchange?: string;
}

export interface CancelOrderRequest {
  orderId: string;
  symbol?: string;
  exchange?: string;
}

export const portfolioApi = {
  getHoldings: () => api.get<Holding[]>('/portfolio/holdings'),

  getPositions: () => api.get<any[]>('/portfolio/positions'),

  getTrades: () => api.get<Trade[]>('/portfolio/trades'),

  placeOrder: (order: PlaceOrderRequest) =>
    api.post<OrderResult>('/orders/execute', {
      ...order,
      // Map transactionType (old field name) to actionType
      actionType: order.transactionType,
    }),

  /** Fetch all open/pending orders */
  getOpenOrders: () => api.get<OpenOrder[]>('/orders/open'),

  /** Modify an existing open order */
  modifyOrder: (order: ModifyOrderRequest) =>
    api.post<{ id: string; status: string; message: string; timestamp: string }>('/orders/modify', order),

  /** Cancel an existing open order */
  cancelOrder: (order: CancelOrderRequest) =>
    api.post<{ id: string; status: string; message: string; timestamp: string }>('/orders/cancel', order),
};
