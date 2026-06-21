/**
 * ============================================================================
 * Toroloom — Headless API Proxy Client (Zero-API Hybrid Gateway)
 * ============================================================================
 *
 * When the app needs order books, live positions, holdings, or margin data,
 * this proxy layer intercepts the request, appends the encrypted broker
 * session cookies to the headers, and mirrors a standard web-browser request
 * to the broker's private production endpoints.
 *
 * This eliminates the need for official developer API keys by leveraging the
 * session extracted via SecureSessionSync and stored in the keychain.
 *
 * Endpoint mapping:
 *   Zerodha Kite  → https://kite.zerodha.com/oms/{endpoint}
 *   Angel One     → https://smartapi.angelbroking.com/{endpoint}
 *   Groww         → https://api.groww.in/{endpoint}
 *
 * ============================================================================
 */

import { getBrokerSession } from './sessionStorage';
import type { BrokerSession } from '../../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ProxyRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  /** Override the base URL for the broker's API */
  baseUrl?: string;
  /** Timeout in milliseconds (default: 15000) */
  timeout?: number;
}

export interface ProxyResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

// ─── Broker Endpoint Registry ──────────────────────────────────────────────

const BROKER_ENDPOINTS: Record<string, string> = {
  zerodha: 'https://kite.zerodha.com',
  angel: 'https://smartapi.angelbroking.com',
  groww: 'https://api.groww.in',
};

const BROKER_USER_AGENTS: Record<string, string> = {
  zerodha:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36',
  angel:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36',
  groww:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36',
};

// ─── Auth Header Builders ──────────────────────────────────────────────────

/**
 * Build the HTTP headers required to authenticate against a specific broker's
 * private API using tokens extracted from the web session.
 */
function buildAuthHeaders(session: BrokerSession): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': BROKER_USER_AGENTS[session.brokerType] || BROKER_USER_AGENTS.zerodha,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: getReferer(session.brokerType),
    Origin: getOrigin(session.brokerType),
  };

  // ZERODHA: Uses enctoken as the primary auth header
  if (session.brokerType === 'zerodha' && session.enctoken) {
    headers['Authorization'] = `enctoken ${session.enctoken}`;
    headers['X-Kite-Version'] = '3';
  }

  // ANGEL ONE: Uses JWT token
  if (session.brokerType === 'angel' && session.jwt) {
    headers['Authorization'] = `Bearer ${session.jwt}`;
    headers['X-PrivateKey'] = session.accessToken || '';
    headers['X-ClientCode'] = session.userId || '';
  }

  // GROWW: Uses access token
  if (session.brokerType === 'groww' && session.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`;
  }

  // Attach raw cookies for fallback authentication
  if (session.cookies) {
    headers['Cookie'] = session.cookies;
  }

  return headers;
}

function getReferer(brokerType: string): string {
  switch (brokerType) {
    case 'zerodha':
      return 'https://kite.zerodha.com/';
    case 'angel':
      return 'https://smartapi.angelbroking.com/';
    case 'groww':
      return 'https://groww.in/';
    default:
      return 'https://kite.zerodha.com/';
  }
}

function getOrigin(brokerType: string): string {
  switch (brokerType) {
    case 'zerodha':
      return 'https://kite.zerodha.com';
    case 'angel':
      return 'https://smartapi.angelbroking.com';
    case 'groww':
      return 'https://groww.in';
    default:
      return 'https://kite.zerodha.com';
  }
}

// ─── Core Proxy Request ────────────────────────────────────────────────────

/**
 * Execute an authenticated proxy request to a broker's private API endpoint
 * using the stored session credentials.
 *
 * @param brokerType - 'zerodha' | 'angel' | 'groww'
 * @param endpoint   - API path (e.g. '/oms/portfolio/holdings')
 * @param opts       - Request options override
 *
 * @example
 *   const result = await proxyRequest('zerodha', '/oms/portfolio/holdings');
 *   if (result.success) { /* use result.data *\/ }
 */
export async function proxyRequest<T = any>(
  brokerType: string,
  endpoint: string,
  opts: ProxyRequestOptions = {},
): Promise<ProxyResponse<T>> {
  try {
    // 1. Retrieve the stored session from keychain
    const session = await getBrokerSession(brokerType);
    if (!session) {
      return {
        success: false,
        error: `No stored session for broker: ${brokerType}. Connect your broker first.`,
        statusCode: 401,
      };
    }

    // 2. Build the authenticated request
    const baseUrl = opts.baseUrl || BROKER_ENDPOINTS[brokerType];
    if (!baseUrl) {
      return {
        success: false,
        error: `Unknown broker type: ${brokerType}`,
        statusCode: 400,
      };
    }

    const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const method = opts.method || 'GET';
    const authHeaders = buildAuthHeaders(session);
    const finalHeaders: Record<string, string> = {
      ...authHeaders,
      ...opts.headers,
    };

    // 3. Execute the fetch with a timeout controller
    const controller = new AbortController();
    const timeoutMs = opts.timeout || 15000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Set Content-Type before constructing fetchOptions
    if (opts.body && method !== 'GET') {
      if (!opts.headers?.['Content-Type']) {
        finalHeaders['Content-Type'] = 'application/json';
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers: finalHeaders,
      signal: controller.signal,
    };

    if (opts.body && method !== 'GET') {
      fetchOptions.body =
        typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    // 4. Parse and return
    let data: T | undefined;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = (await response.json()) as T;
    } else {
      data = (await response.text()) as unknown as T;
    }

    if (!response.ok) {
      return {
        success: false,
        data,
        error: `Broker API error: HTTP ${response.status}`,
        statusCode: response.status,
      };
    }

    return {
      success: true,
      data,
      statusCode: response.status,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timed out. The broker endpoint may be unreachable.',
        statusCode: 408,
      };
    }

    return {
      success: false,
      error: error.message || 'Unknown proxy request error',
      statusCode: 0,
    };
  }
}

// ─── Convenience Methods ───────────────────────────────────────────────────

/**
 * Fetch portfolio holdings from the connected broker.
 */
export async function getBrokerHoldings(brokerType: string) {
  const endpoints: Record<string, string> = {
    zerodha: '/oms/portfolio/holdings',
    angel: '/rest/secure/angelbroking/portfolio/v1/holdings',
    groww: '/pg/invest/v1/holdings',
  };
  return proxyRequest(brokerType, endpoints[brokerType] || '/portfolio/holdings');
}

/**
 * Fetch open positions from the connected broker.
 */
export async function getBrokerPositions(brokerType: string) {
  const endpoints: Record<string, string> = {
    zerodha: '/oms/portfolio/positions',
    angel: '/rest/secure/angelbroking/portfolio/v1/positions',
    groww: '/pg/invest/v1/positions',
  };
  return proxyRequest(brokerType, endpoints[brokerType] || '/portfolio/positions');
}

/**
 * Fetch order book from the connected broker.
 */
export async function getBrokerOrderBook(brokerType: string) {
  const endpoints: Record<string, string> = {
    zerodha: '/oms/orders',
    angel: '/rest/secure/angelbroking/order/v1/getorderbook',
    groww: '/pg/invest/v1/orders',
  };
  return proxyRequest(brokerType, endpoints[brokerType] || '/orders');
}

/**
 * Fetch trade book (executed trades history) from the connected broker.
 */
export async function getBrokerTradeBook(brokerType: string) {
  const endpoints: Record<string, string> = {
    zerodha: '/oms/trades',
    angel: '/rest/secure/angelbroking/order/v1/tradebook',
    groww: '/pg/invest/v1/trades',
  };
  return proxyRequest(brokerType, endpoints[brokerType] || '/trades');
}

/**
 * Fetch available margin / funds summary from the connected broker.
 */
export async function getBrokerMargin(brokerType: string) {
  const endpoints: Record<string, string> = {
    zerodha: '/oms/user/margins',
    angel: '/rest/secure/angelbroking/user/v1/getRMS',
    groww: '/pg/invest/v1/margin',
  };
  return proxyRequest(brokerType, endpoints[brokerType] || '/user/margins');
}
