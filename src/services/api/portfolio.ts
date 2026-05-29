import { api } from './client';
import type { Holding, Trade } from '../../types';

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

export const portfolioApi = {
  getHoldings: () => api.get<Holding[]>('/portfolio/holdings'),

  getPositions: () => api.get<any[]>('/portfolio/positions'),

  getTrades: () => api.get<Trade[]>('/portfolio/trades'),

  placeOrder: (order: PlaceOrderRequest) =>
    api.post<OrderResult>('/portfolio/orders', order),
};
