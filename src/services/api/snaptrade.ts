/**
 * ============================================================================
 * Toroloom — SnapTrade Frontend API Client
 * ============================================================================
 *
 * Usage:
 *   import { snapTradeApi } from '../services/api';
 *
 *   // 1. Register user with SnapTrade
 *   await snapTradeApi.register();
 *
 *   // 2. Get OAuth URL → open in browser/WebView
 *   const { oauthUrl } = await snapTradeApi.getConnectLink();
 *   Linking.openURL(oauthUrl);
 *
 *   // 3. On return to app with authorizationId
 *   await snapTradeApi.handleCallback(authorizationId);
 *
 *   // 4. Fetch data (same API as existing portfolio/orders)
 *   const holdings = await snapTradeApi.getHoldings();
 *   const positions = await snapTradeApi.getPositions();
 *
 * ============================================================================
 */

import { api } from './client';

// ──── Types ────────────────────────────────────────────────────────────────

export interface SnapTradeStatus {
  connected: boolean;
  brokerName: string | null;
  brokerSlug: string | null;
  accountName: string | null;
  connectedAt: string | null;
}

export interface SnapTradeConnection {
  brokerName: string;
  brokerSlug: string;
  accountName: string;
  accountId: string;
  balance: number;
  connectedAt: string;
}

export interface SnapTradeHolding {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  avgCost: number;
  pnl: number;
  pnlPercent: number;
  currency: string;
}

export interface SnapTradePosition {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  avgCost: number;
  pnl: number;
  pnlPercent: number;
}

export interface SnapTradeCallbackResult {
  success: boolean;
  connection: SnapTradeConnection;
  message: string;
}

// ──── API Client ──────────────────────────────────────────────────────────

export const snapTradeApi = {
  /**
   * Register the current user with SnapTrade.
   * Must be called once before connecting a broker.
   */
  register: async (): Promise<{ success: boolean; snapTradeUserId: string }> => {
    return api.post<{ success: boolean; snapTradeUserId: string }>('/snaptrade/register', {});
  },

  /**
   * Get an OAuth URL to connect a broker.
   * Open this URL in a browser/WebView for the user to log into their broker.
   */
  getConnectLink: async (): Promise<{
    success: boolean;
    oauthUrl: string;
    redirectUri: string;
  }> => {
    return api.post<{ success: boolean; oauthUrl: string; redirectUri: string }>(
      '/snaptrade/connect-link',
      {},
    );
  },

  /**
   * Handle the OAuth callback after the user connects their broker.
   * Call this with the authorizationId received from the redirect.
   */
  handleCallback: async (
    authorizationId: string,
  ): Promise<SnapTradeCallbackResult> => {
    return api.post<SnapTradeCallbackResult>('/snaptrade/callback', {
      authorizationId,
    });
  },

  /**
   * Get the current broker connection status.
   */
  status: async (): Promise<SnapTradeStatus> => {
    return api.get<SnapTradeStatus>('/snaptrade/status');
  },

  /**
   * Disconnect the currently connected broker.
   */
  disconnect: async (): Promise<{ success: boolean; message: string }> => {
    return api.post<{ success: boolean; message: string }>('/snaptrade/disconnect', {});
  },

  /**
   * List all accounts connected via SnapTrade.
   */
  getAccounts: async (): Promise<{
    success: boolean;
    data: Array<{ id: string; name: string; number: string; type: string; balance: number }>;
    count: number;
  }> => {
    return api.get<{
      success: boolean;
      data: Array<{ id: string; name: string; number: string; type: string; balance: number }>;
      count: number;
    }>('/snaptrade/accounts');
  },

  /**
   * Fetch portfolio holdings via SnapTrade.
   */
  getHoldings: async (): Promise<{
    success: boolean;
    data: SnapTradeHolding[];
    count: number;
  }> => {
    return api.get<{ success: boolean; data: SnapTradeHolding[]; count: number }>(
      '/snaptrade/holdings',
    );
  },

  /**
   * Fetch open positions via SnapTrade.
   */
  getPositions: async (): Promise<{
    success: boolean;
    data: SnapTradePosition[];
    count: number;
  }> => {
    return api.get<{ success: boolean; data: SnapTradePosition[]; count: number }>(
      '/snaptrade/positions',
    );
  },

  /**
   * Place an order via SnapTrade.
   */
  placeOrder: async (order: {
    symbol: string;
    action: 'BUY' | 'SELL';
    orderType: 'Market' | 'Limit' | 'StopLimit' | 'StopLoss';
    quantity: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: 'Day' | 'Gtc';
  }): Promise<{ success: boolean; orderId: string; status: string }> => {
    return api.post<{ success: boolean; orderId: string; status: string }>(
      '/snaptrade/place-order',
      order,
    );
  },
};
