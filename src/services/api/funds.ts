/**
 * ============================================================================
 * Toroloom — Funds API Client
 * ============================================================================
 *
 * Connects to the backend /api/funds endpoints for withdrawal, transfer,
 * and UPI payments. Uses api.withFallback() pattern for resilience.
 * ============================================================================
 */

import { api } from './client';

// ─── Response Types ───────────────────────────────────────────────────────

export interface FundTransactionResponse {
  id: string;
  type: 'add' | 'withdraw' | 'transfer' | 'upi';
  amount: number;
  method: string;
  account?: string;
  status: 'completed' | 'pending' | 'failed';
  transactionId: string;
  timestamp: string;
}

export interface FundActionResponse {
  message: string;
  transaction: FundTransactionResponse;
  newBalance: number;
}

export interface BalanceResponse {
  balance: number;
  userId: string;
}

// ─── API Client ───────────────────────────────────────────────────────────

export const fundsApi = {
  /** Get current balance */
  getBalance: (): Promise<BalanceResponse> =>
    api.get<BalanceResponse>('/funds/balance'),

  /** Get transaction history */
  getTransactions: (params?: { type?: string; limit?: number }): Promise<{ transactions: FundTransactionResponse[]; total: number }> => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return api.get(`/funds/transactions${qs ? '?' + qs : ''}`);
  },

  /** Withdraw funds to linked bank account */
  withdraw: (params: {
    amount: number;
    method: string;
    account?: string;
  }): Promise<FundActionResponse> =>
    api.post<FundActionResponse>('/funds/withdraw', params),

  /** Transfer funds between accounts or to external bank */
  transfer: (params: {
    amount: number;
    type: 'internal' | 'external';
    fromAccount?: string;
    toAccount?: string;
    bankName?: string;
    accountNumber?: string;
  }): Promise<FundActionResponse> =>
    api.post<FundActionResponse>('/funds/transfer', params),

  /** Make UPI payment */
  upiPay: (params: {
    amount: number;
    payeeUPI: string;
    fromUPI: string;
  }): Promise<FundActionResponse> =>
    api.post<FundActionResponse>('/funds/upi/pay', params),
};
