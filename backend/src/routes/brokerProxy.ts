/**
 * ============================================================================
 * Toroloom — Broker Proxy Route (Server-Side, Enhanced)
 * ============================================================================
 *
 * Acts as a relay between the app and broker internal APIs.
 * Key improvements over direct app→broker calls:
 *   - Multiple fallback base URLs per broker (tries alternatives if primary fails)
 *   - Config endpoint returns current endpoints (no hardcoding needed in frontend)
 *   - Endpoint URLs can be updated server-side (no app update needed)
 *   - User-Agent rotation to avoid detection
 *   - Centralized error handling with graceful messages
 *
 * Endpoints:
 *   GET   /api/broker-proxy/config                — Get current broker endpoint config
 *   POST  /api/broker-proxy/:brokerType/*          — Proxy any broker API call
 *
 * Broker endpoints (update here if broker changes endpoints):
 *   Multiple fallbacks per broker — tries in order until one works
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// ─── Broker API URLs (multiple fallbacks per broker) ─────────────────────
// Update here if broker changes endpoints — no app update needed

interface BrokerConfig {
  baseUrls: string[];  // Tried in order — first success wins
  authHeader: string;  // For token reference
}

const BROKER_CONFIGS: Record<string, BrokerConfig> = {
  zerodha: {
    baseUrls: [
      'https://kite.zerodha.com',
      'https://kite.zerodha.com',          // same, but could add CDN alt
    ],
    authHeader: 'enctoken',
  },
  angel: {
    baseUrls: [
      'https://smartapi.angelbroking.com',
      'https://apiconnect.angelone.in',
      'https://angelone.in/api',
    ],
    authHeader: 'jwt',
  },
  groww: {
    baseUrls: [
      'https://api.groww.in',
      'https://groww.in/api',
    ],
    authHeader: 'accessToken',
  },
};

type BrokerType = keyof typeof BROKER_CONFIGS;

function isBrokerType(b: string): b is BrokerType {
  return b in BROKER_CONFIGS;
}

const BROKER_USER_AGENTS = [
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.165 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.6167.180 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; OnePlus 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.113 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

// ─── GET /api/broker-proxy/config ────────────────────────────────────────
// Returns current broker endpoint config — frontend fetches this on startup

router.get('/config', async (_req: Request, res: Response) => {
  const config: Record<string, { baseUrls: string[] }> = {};
  for (const [type, brokerConfig] of Object.entries(BROKER_CONFIGS)) {
    config[type] = { baseUrls: brokerConfig.baseUrls };
  }
  res.json({
    success: true,
    brokers: config,
    updatedAt: new Date().toISOString(),
  });
});

// ─── POST /api/broker-proxy/:brokerType/* ───────────────────────────────
// Proxy any broker API call through the backend

router.post('/:brokerType/*', async (req: Request, res: Response) => {
  try {
    const brokerType = req.params.brokerType as string;
    if (!isBrokerType(brokerType)) {
      res.status(400).json({
        success: false,
        error: `Unknown broker: ${brokerType}. Supported: ${Object.keys(BROKER_CONFIGS).join(', ')}`,
        statusCode: 400,
        data: undefined,
      });
      return;
    }

    const endpoint = '/' + (req.params[0] || '');
    const { session, data } = req.body;
    const brokerConfig = BROKER_CONFIGS[brokerType];

    if (!session) {
      res.status(400).json({
        success: false,
        error: 'Session data required',
        statusCode: 400,
        data: undefined,
      });
      return;
    }

    // ── Try each base URL in sequence ─────────────────────────────
    let lastError: string | null = null;
    let lastStatusCode = 0;

    for (const baseUrl of brokerConfig.baseUrls) {
      // Build auth headers per request (random User-Agent per retry)
      const headers: Record<string, string> = {
        'User-Agent': BROKER_USER_AGENTS[Math.floor(Math.random() * BROKER_USER_AGENTS.length)],
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
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

      const requestInit: RequestInit = {
        method: req.method === 'POST' ? 'POST' : 'GET',
        headers,
      };

      // Add body for POST requests
      if (req.method === 'POST' && data) {
        requestInit.body = typeof data === 'string' ? data : JSON.stringify(data);
      }

      const url = `${baseUrl}${endpoint}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        requestInit.signal = controller.signal;

        const response = await fetch(url, requestInit);
        clearTimeout(timeoutId);

        let responseData: any;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        if (response.ok) {
          // Success!
          res.json({
            success: true,
            data: responseData,
            statusCode: response.status,
            baseUrlUsed: baseUrl,
          });
          return;
        }

        // Failed — try next URL
        lastError = `Broker API error: HTTP ${response.status}`;
        lastStatusCode = response.status;
        console.warn(`[BrokerProxy] ${brokerType} failed on ${baseUrl}: HTTP ${response.status}`);

      } catch (fetchError: any) {
        lastError = fetchError.name === 'AbortError'
          ? 'Request timed out'
          : fetchError.message || 'Unknown error';
        lastStatusCode = fetchError.name === 'AbortError' ? 408 : 502;
        console.warn(`[BrokerProxy] ${brokerType} failed on ${baseUrl}: ${lastError}`);
      }
    }

    // All fallbacks exhausted
    res.json({
      success: false,
      data: undefined,
      error: `Broker API unavailable after trying ${brokerConfig.baseUrls.length} endpoint(s). Last error: ${lastError}`,
      statusCode: lastStatusCode || 503,
    });
  } catch (error: any) {
    console.error('[BrokerProxy] Unexpected error:', error.message);
    res.status(500).json({
      success: false,
      data: undefined,
      error: 'Internal proxy error',
      statusCode: 500,
    });
  }
});

export default router;
