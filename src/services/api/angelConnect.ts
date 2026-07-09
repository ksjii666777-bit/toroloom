/**
 * ============================================================================
 * Toroloom — Angel One SmartAPI Connection API Client
 * ============================================================================
 *
 * Frontend client for per-user Angel One SmartAPI integration.
 * Users connect their Angel One account via official SmartAPI.
 * ============================================================================
 */

import { api } from './client';

export interface AngelStatus {
  connected: boolean;
  clientId?: string;
  connectedAt?: string;
}

export interface AngelHolding {
  symbol: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface AngelPosition {
  symbol: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface AngelTrade {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  timestamp: string;
}

export const angelConnectApi = {
  /**
   * Connect the user's Angel One account.
   * @param clientId - Angel One trading account code
   * @param password - Angel One trading password
   * @param totp - Base32 TOTP secret from SmartAPI portal
   */
  async connect(clientId: string, password: string, totp: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string; clientId: string }>(
      '/api/angel/connect',
      { clientId, password, totp },
    );
    return response;
  },

  /** Disconnect the user's Angel One account */
  async disconnect(): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>('/api/angel/disconnect', {});
    return response;
  },

  /** Check Angel One connection status */
  async status(): Promise<AngelStatus> {
    const response = await api.get<AngelStatus>('/api/angel/status');
    return response;
  },

  /** Fetch holdings for the connected user */
  async holdings(): Promise<{ success: boolean; data: AngelHolding[]; count: number }> {
    const response = await api.get<{ success: boolean; data: AngelHolding[]; count: number }>('/api/angel/holdings');
    return response;
  },

  /** Fetch positions for the connected user */
  async positions(): Promise<{ success: boolean; data: AngelPosition[]; count: number }> {
    const response = await api.get<{ success: boolean; data: AngelPosition[]; count: number }>('/api/angel/positions');
    return response;
  },

  /** Fetch trade history for the connected user */
  async trades(): Promise<{ success: boolean; data: AngelTrade[]; count: number }> {
    const response = await api.get<{ success: boolean; data: AngelTrade[]; count: number }>('/api/angel/trades');
    return response;
  },

  /** Get a live quote for a symbol */
  async quote(symbol: string): Promise<{ success: boolean; data: any }> {
    const response = await api.get<{ success: boolean; data: any }>(`/api/angel/quote/${symbol}`);
    return response;
  },
};
