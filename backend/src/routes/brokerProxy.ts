/**
 * ============================================================================
 * Toroloom — Broker Proxy Route (Server-Side)
 * ============================================================================
 *
 * Acts as a relay between the app and broker internal APIs.
 * The app sends session tokens, the backend makes the actual HTTP request
 * to the broker's API with proper headers & User-Agent rotation.
 *
 * Benefits over direct app→broker calls:
 *   - Endpoint URLs can be updated server-side (no app update needed)
 *   - Better User-Agent rotation
 *   - Centralized error handling
 *   - Server logs for debugging
 *
 * Endpoints:
 *   POST /api/broker-proxy/:brokerType/:endpoint
 *     Body: { session: { cookies, enctoken, jwt, accessToken }, data?: any }
 *     Headers: Authorization (user's JWT)
 *
 * Broker endpoints (can be updated anytime):
 *   Zerodha:  https://kite.zerodha.com/oms/{endpoint}
 *   Angel:    https://smartapi.angelbroking.com/{endpoint}
 *   Groww:    https://api.groww.in/{endpoint}
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// ─── Broker API URLs (update here if broker changes endpoints) ──────────
// No app update needed — just redeploy backend

const BROKER_BASE_URLS: Record<string, string> = {
  zerodha: 'https://kite.zerodha.com',
  angel: 'https://smartapi.angelbroking.com',
  groww: 'https://api.groww.in',
};

type BrokerType = keyof typeof BROKER_BASE_URLS;

function isBrokerType(b: string): b is BrokerType {
  return b in BROKER_BASE_URLS;
}

const BROKER_USER_AGENTS = [
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.6167.180 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
];

// ─── POST /api/broker-proxy/:brokerType/* ───────────────────────────────
// Proxy any broker API call through the backend

router.post('/:brokerType/*', async (req: Request, res: Response) => {
  try {
    const brokerType: string = req.params.brokerType;
    if (!isBrokerType(brokerType)) {
      res.status(400).json({ success: false, error: `Unknown broker: ${brokerType}` });
      return;
    }
    // The wildcard path: everything after /:brokerType/
    const endpoint = '/' + (req.params[0] || '');
    const { session, data } = req.body;
    const baseUrl = BROKER_BASE_URLS[brokerType];

    if (!session) {
      res.status(400).json({ success: false, error: 'Session data required' });
      return;
    }

    // Build auth headers based on broker type
    const headers: Record<string, string> = {
      'User-Agent': BROKER_USER_AGENTS[Math.floor(Math.random() * BROKER_USER_AGENTS.length)],
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
      'Cache-Control': 'no-cache',
      'Referer': `${baseUrl}/`,
      'Origin': baseUrl,
    };

    // Broker-specific auth
    if (brokerType === 'zerodha' && session.enctoken) {
      headers['Authorization'] = `enctoken ${session.enctoken}`;
      headers['X-Kite-Version'] = '3';
    } else if (brokerType === 'angel' && session.jwt) {
      headers['Authorization'] = `Bearer ${session.jwt}`;
      headers['X-PrivateKey'] = session.accessToken || '';
      headers['X-ClientCode'] = session.userId || '';
    } else if (brokerType === 'groww' && session.accessToken) {
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    }

    // Attach cookies if available (fallback auth)
    if (session.cookies) {
      headers['Cookie'] = session.cookies;
    }

    headers['Content-Type'] = 'application/json';

    const url = `${baseUrl}${endpoint}`;

    const requestInit: RequestInit = {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers,
    };

    // Add body for POST requests (e.g., placing orders)
    if (req.method === 'POST' && data) {
      requestInit.body = typeof data === 'string' ? data : JSON.stringify(data);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    requestInit.signal = controller.signal;

    try {
      const response = await fetch(url, requestInit);
      clearTimeout(timeoutId);

      let responseData: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      res.json({
        success: response.ok,
        data: responseData,
        statusCode: response.status,
        error: response.ok ? undefined : `Broker API error: HTTP ${response.status}`,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        res.json({
          success: false,
          error: 'Broker API timed out. The endpoint may have changed. Please try again later.',
          statusCode: 408,
        });
      } else {
        res.json({
          success: false,
          error: `Broker API request failed: ${fetchError.message || 'Unknown error'}. This usually means the broker changed their internal API.`,
          statusCode: 502,
        });
      }
    }
  } catch (error: any) {
    console.error('[BrokerProxy] Unexpected error:', error.message);
    res.status(500).json({ success: false, error: 'Internal proxy error' });
  }
});

export default router;
