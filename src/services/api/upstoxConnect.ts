/**
 * ============================================================================
 * Toroloom — Upstox API Client (Frontend)
 * ============================================================================
 *
 * Frontend API client for the Upstox SmartAPI plugin.
 * Communicates with the backend /api/upstox/* endpoints to manage
 * Upstox connection, portfolio, and trading operations.
 *
 * Usage:
 *   import { upstoxApi } from '../../services/api/upstoxConnect';
 *   await upstoxApi.connect(accessToken);
 *   const holdings = await upstoxApi.holdings();
 * ============================================================================
 */

import { api } from './client';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  count?: number;
}

interface ConnectionResponse {
  success: boolean;
  message: string;
  hasOrderAccess?: boolean;
  connected?: boolean;
  clientId?: string;
  connectedAt?: string;
}

interface StatusResponse {
  connected: boolean;
  clientId?: string;
  connectedAt?: string;
  hasOrderAccess?: boolean;
}

interface Holding {
  symbol: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

interface Position {
  symbol: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

interface Trade {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  total: number;
  timestamp: string;
}

interface MarketQuote {
  symbol: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
}

interface OpenOrder {
  id: string;
  symbol: string;
  exchange: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  filledQuantity: number;
  price: number;
  triggerPrice?: number;
  productType: string;
  orderType: string;
  status: string;
  timestamp: string;
}

interface OrderResult {
  id: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  message: string;
  timestamp: string;
}

interface OAuthUrlResponse {
  success: boolean;
  oauthUrl: string;
  brokerType: string;
  label: string;
  redirectUri: string;
}

class UpstoxApiClient {
  private basePath = '/upstox';

  // ─── Auth ─────────────────────────────────────────────────────────────

  /**
   * Connect to Upstox using an existing OAuth access token.
   */
  async connect(accessToken: string, clientId?: string): Promise<ConnectionResponse> {
    const data = await api.post<ConnectionResponse>(`${this.basePath}/connect`, {
      accessToken,
      clientId,
    });
    return data;
  }

  /**
   * Connect to Upstox using an OAuth authorization code.
   */
  async connectViaOAuth(
    authCode: string,
    clientId?: string,
    clientSecret?: string,
    redirectUri?: string,
  ): Promise<ConnectionResponse> {
    const data = await api.post<ConnectionResponse>(`${this.basePath}/oauth-connect`, {
      authCode,
      clientId,
      clientSecret,
      redirectUri,
    });
    return data;
  }

  /**
   * Disconnect from Upstox.
   */
  async disconnect(): Promise<{ success: boolean; message: string }> {
    const data = await api.post<{ success: boolean; message: string }>(`${this.basePath}/disconnect`);
    return data;
  }

  /**
   * Check connection status.
   */
  async status(): Promise<StatusResponse> {
    const data = await api.get<StatusResponse>(`${this.basePath}/status`);
    return data;
  }

  /**
   * Get the Upstox OAuth authorization URL.
   */
  async getOAuthUrl(redirectUri?: string): Promise<OAuthUrlResponse> {
    const params = redirectUri ? `?redirectUri=${encodeURIComponent(redirectUri)}` : '';
    const data = await api.get<OAuthUrlResponse>(`${this.basePath}/oauth-url${params}`);
    return data;
  }

  // ─── Portfolio ────────────────────────────────────────────────────────

  /**
   * Get holdings for the connected Upstox account.
   */
  async holdings(): Promise<ApiResponse<Holding[]>> {
    const data = await api.get<ApiResponse<Holding[]>>(`${this.basePath}/holdings`);
    return data;
  }

  /**
   * Get positions for the connected Upstox account.
   */
  async positions(): Promise<ApiResponse<Position[]>> {
    const data = await api.get<ApiResponse<Position[]>>(`${this.basePath}/positions`);
    return data;
  }

  /**
   * Get trade history.
   */
  async trades(): Promise<ApiResponse<Trade[]>> {
    const data = await api.get<ApiResponse<Trade[]>>(`${this.basePath}/trades`);
    return data;
  }

  // ─── Market Data ──────────────────────────────────────────────────────

  /**
   * Get a live quote for a stock symbol.
   */
  async quote(symbol: string): Promise<ApiResponse<MarketQuote>> {
    const data = await api.get<ApiResponse<MarketQuote>>(`${this.basePath}/quote/${symbol.toUpperCase()}`);
    return data;
  }

  // ─── Trading ──────────────────────────────────────────────────────────

  /**
   * Get open orders.
   */
  async orders(): Promise<ApiResponse<OpenOrder[]>> {
    const data = await api.get<ApiResponse<OpenOrder[]>>(`${this.basePath}/orders`);
    return data;
  }

  /**
   * Place an order.
   */
  async placeOrder(order: {
    symbol: string;
    exchange?: string;
    transactionType: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    productType?: string;
    orderType?: string;
  }): Promise<ApiResponse<OrderResult>> {
    const data = await api.post<ApiResponse<OrderResult>>(`${this.basePath}/order/place`, order);
    return data;
  }

  /**
   * Modify an existing order.
   */
  async modifyOrder(params: {
    orderId: string;
    symbol?: string;
    exchange?: string;
    quantity?: number;
    price?: number;
    productType?: string;
    orderType?: string;
    triggerPrice?: number;
  }): Promise<ApiResponse<OrderResult>> {
    const data = await api.post<ApiResponse<OrderResult>>(`${this.basePath}/order/modify`, params);
    return data;
  }

  /**
   * Cancel an existing order.
   */
  async cancelOrder(orderId: string): Promise<ApiResponse<OrderResult>> {
    const data = await api.post<ApiResponse<OrderResult>>(`${this.basePath}/order/cancel`, { orderId });
    return data;
  }
}

/** Singleton instance */
export const upstoxApi = new UpstoxApiClient();
