/**
 * ============================================================================
 * Toroloom — Broker Proxy API Client
 * ============================================================================
 *
 * Routes broker API requests through the backend server instead of making
 * direct calls from the app. This allows the backend to update broker
 * endpoint URLs without requiring app updates.
 *
 * Usage:
 *   import { brokerProxyApi } from '../services/api';
 *   const holdings = await brokerProxyApi.getHoldings('zerodha', session);
 * ============================================================================
 */

import { api } from './client';
import { getBrokerSession } from '../gateway/sessionStorage';
import type { BrokerSession } from '../../types';

export interface ProxyResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

/**
 * Execute a broker API request through the backend proxy.
 * Automatically retrieves the stored broker session.
 */
async function proxyRequest<T = any>(
  brokerType: string,
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any,
): Promise<ProxyResult<T>> {
  try {
    // Get stored session from keychain
    const session: BrokerSession | null = await getBrokerSession(brokerType);
    if (!session) {
      return {
        success: false,
        error: `No session found for ${brokerType}. Connect your broker first.`,
        statusCode: 401,
      };
    }

    // Extract only the serializable session data (no functions, no circular refs)
    const sessionData = {
      cookies: session.cookies,
      enctoken: session.enctoken,
      jwt: session.jwt,
      accessToken: session.accessToken,
      publicToken: session.publicToken,
      refreshToken: session.refreshToken,
      userId: session.userId,
    };

    const payload: any = { session: sessionData };
    if (body) payload.data = body;

    // Route through backend
    const response = await api.post<ProxyResult<T>>(
      `/broker-proxy/${brokerType}/${endpoint}`,
      payload,
    );

    return response;
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Proxy request failed',
      statusCode: 0,
    };
  }
}

// ─── Convenience Methods ───────────────────────────────────────────────────

const BROKER_ENDPOINTS: Record<string, Record<string, string>> = {
  zerodha: {
    holdings: 'oms/portfolio/holdings',
    positions: 'oms/portfolio/positions',
    orders: 'oms/orders',
    trades: 'oms/trades',
    margins: 'oms/user/margins',
  },
  angel: {
    holdings: 'rest/secure/angelbroking/portfolio/v1/holdings',
    positions: 'rest/secure/angelbroking/portfolio/v1/positions',
    orders: 'rest/secure/angelbroking/order/v1/getorderbook',
    trades: 'rest/secure/angelbroking/order/v1/tradebook',
    margins: 'rest/secure/angelbroking/user/v1/getRMS',
  },
  groww: {
    holdings: 'pg/invest/v1/holdings',
    positions: 'pg/invest/v1/positions',
    orders: 'pg/invest/v1/orders',
    trades: 'pg/invest/v1/trades',
    margins: 'pg/invest/v1/margin',
  },
};

export const brokerProxyApi = {
  /** Fetch portfolio holdings */
  getHoldings: (brokerType: string) => {
    const ep = BROKER_ENDPOINTS[brokerType]?.holdings;
    return ep ? proxyRequest(brokerType, ep) : Promise.resolve({ success: false, error: `Unsupported broker: ${brokerType}`, statusCode: 400 });
  },

  /** Fetch open positions */
  getPositions: (brokerType: string) => {
    const ep = BROKER_ENDPOINTS[brokerType]?.positions;
    return ep ? proxyRequest(brokerType, ep) : Promise.resolve({ success: false, error: `Unsupported broker: ${brokerType}`, statusCode: 400 });
  },

  /** Fetch order book */
  getOrders: (brokerType: string) => {
    const ep = BROKER_ENDPOINTS[brokerType]?.orders;
    return ep ? proxyRequest(brokerType, ep) : Promise.resolve({ success: false, error: `Unsupported broker: ${brokerType}`, statusCode: 400 });
  },

  /** Fetch trade book */
  getTrades: (brokerType: string) => {
    const ep = BROKER_ENDPOINTS[brokerType]?.trades;
    return ep ? proxyRequest(brokerType, ep) : Promise.resolve({ success: false, error: `Unsupported broker: ${brokerType}`, statusCode: 400 });
  },

  /** Fetch available margin */
  getMargins: (brokerType: string) => {
    const ep = BROKER_ENDPOINTS[brokerType]?.margins;
    return ep ? proxyRequest(brokerType, ep) : Promise.resolve({ success: false, error: `Unsupported broker: ${brokerType}`, statusCode: 400 });
  },
};
