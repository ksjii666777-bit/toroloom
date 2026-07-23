/**
 * ============================================================================
 * Toroloom — Upstox API Connect (User-Facing)
 * ============================================================================
 *
 * Per-user Upstox API integration. Users connect their own Upstox account
 * using OAuth 2.0, and the backend fetches real holdings, positions, orders,
 * and trade data via the official Upstox REST API v2.
 *
 * Features:
 *   - OAuth 2.0 Authorization Code flow
 *   - Reliable — official REST API
 *   - Real-time — market quotes, holdings, positions
 *   - Trading — place, modify, cancel orders
 *
 * Endpoints:
 *   POST  /api/upstox/connect        — Connect user's Upstox account (direct token)
 *   POST  /api/upstox/oauth-connect  — Connect via OAuth auth code exchange
 *   POST  /api/upstox/disconnect     — Disconnect
 *   GET   /api/upstox/status         — Check connection status
 *   GET   /api/upstox/holdings       — Fetch holdings
 *   GET   /api/upstox/positions      — Fetch positions
 *   GET   /api/upstox/trades         — Fetch trade history
 *   GET   /api/upstox/quote/:symbol  — Get quote for a symbol
 *   GET   /api/upstox/orders         — Get open orders
 *   POST  /api/upstox/order/place    — Place an order
 *   POST  /api/upstox/order/modify   — Modify an order
 *   POST  /api/upstox/order/cancel   — Cancel an order
 *   GET   /api/upstox/oauth-url      — Get the OAuth authorization URL
 *
 * Auth: Required (authMiddleware)
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { upstoxUserManager } from '../services/broker/upstoxUserManager';
import { UpstoxBroker } from '../services/broker/upstoxBroker';
import { env } from '../config/env';

const router = Router();
router.use(authMiddleware);

// ─── Helper: Extract userId from request ──────────────────────────────────

function getUserId(req: Request): string {
  return (req as any).user?.id || (req as any).user?.userId || 'anonymous';
}

// ─── POST /api/upstox/connect ────────────────────────────────────────────
// Connect the user's Upstox account using an existing access token

router.post('/connect', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { accessToken, clientId } = req.body;

    if (!accessToken || typeof accessToken !== 'string') {
      res.status(400).json({ error: 'accessToken is required (your Upstox OAuth access token)' });
      return;
    }

    await upstoxUserManager.connect(userId, accessToken.trim(), clientId);

    res.json({
      success: true,
      message: 'Upstox connected successfully!',
      hasOrderAccess: true,
    });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Connection failed';
    console.error('[UpstoxConnect] Connect error:', errMsg);
    res.status(401).json({ error: errMsg });
  }
});

// ─── POST /api/upstox/oauth-connect ──────────────────────────────────────
// Connect via OAuth authorization code exchange

router.post('/oauth-connect', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { authCode, clientId, clientSecret, redirectUri } = req.body;

    if (!authCode || typeof authCode !== 'string') {
      res.status(400).json({ error: 'authCode is required (OAuth authorization code)' });
      return;
    }

    // Use provided credentials or fall back to server env vars
    const upstoxClientId = clientId || env.upstoxClientId;
    const upstoxClientSecret = clientSecret || env.upstoxClientSecret;
    const upstoxRedirectUri = redirectUri || env.upstoxRedirectUri;

    if (!upstoxClientId) {
      res.status(500).json({ error: 'Upstox Client ID not configured on server. Set UPSTOX_CLIENT_ID.' });
      return;
    }
    if (!upstoxClientSecret) {
      res.status(500).json({ error: 'Upstox Client Secret not configured on server. Set UPSTOX_CLIENT_SECRET.' });
      return;
    }
    if (!upstoxRedirectUri) {
      res.status(500).json({ error: 'Upstox redirect URI not configured on server. Set UPSTOX_REDIRECT_URI.' });
      return;
    }

    const result = await upstoxUserManager.connectViaOAuth(
      userId,
      authCode.trim(),
      upstoxClientId,
      upstoxClientSecret,
      upstoxRedirectUri,
    );

    res.json({
      success: true,
      message: 'Upstox connected via OAuth successfully!',
      hasOrderAccess: true,
    });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'OAuth connection failed';
    console.error('[UpstoxConnect] OAuth connect error:', errMsg);
    res.status(401).json({ error: errMsg });
  }
});

// ─── POST /api/upstox/disconnect ─────────────────────────────────────────
// Disconnect the user's Upstox account

router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const wasConnected = await upstoxUserManager.disconnect(userId);

    res.json({
      success: true,
      message: wasConnected ? 'Upstox disconnected.' : 'Not connected.',
    });
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ─── GET /api/upstox/status ──────────────────────────────────────────────
// Check Upstox connection status

router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const info = upstoxUserManager.getConnectionInfo(userId);

    res.json({
      connected: info.connected,
      clientId: info.clientId,
      connectedAt: info.connectedAt ? new Date(info.connectedAt).toISOString() : undefined,
      hasOrderAccess: info.connected,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// ─── GET /api/upstox/holdings ────────────────────────────────────────────
// Fetch holdings for the connected user

router.get('/holdings', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    if (!upstoxUserManager.isConnected(userId)) {
      res.status(401).json({ error: 'Upstox not connected. Connect first via POST /api/upstox/connect' });
      return;
    }

    const holdings = await upstoxUserManager.getHoldings(userId);
    res.json({ success: true, data: holdings, count: holdings.length });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Failed to fetch holdings';
    console.error('[UpstoxConnect] Holdings error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// ─── GET /api/upstox/positions ───────────────────────────────────────────
// Fetch positions for the connected user

router.get('/positions', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    if (!upstoxUserManager.isConnected(userId)) {
      res.status(401).json({ error: 'Upstox not connected. Connect first via POST /api/upstox/connect' });
      return;
    }

    const positions = await upstoxUserManager.getPositions(userId);
    res.json({ success: true, data: positions, count: positions.length });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Failed to fetch positions';
    console.error('[UpstoxConnect] Positions error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// ─── GET /api/upstox/trades ──────────────────────────────────────────────
// Fetch trade history for the connected user

router.get('/trades', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    if (!upstoxUserManager.isConnected(userId)) {
      res.status(401).json({ error: 'Upstox not connected. Connect first via POST /api/upstox/connect' });
      return;
    }

    const trades = await upstoxUserManager.getTradeHistory(userId);
    res.json({ success: true, data: trades, count: trades.length });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Failed to fetch trades';
    console.error('[UpstoxConnect] Trades error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// ─── GET /api/upstox/quote/:symbol ────────────────────────────────────────
// Get a live quote for a symbol

router.get('/quote/:symbol', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const symbol = (req.params.symbol as string)?.toUpperCase();

    if (!symbol) {
      res.status(400).json({ error: 'Symbol is required' });
      return;
    }

    if (!upstoxUserManager.isConnected(userId)) {
      res.status(401).json({ error: 'Upstox not connected. Connect first via POST /api/upstox/connect' });
      return;
    }

    const quote = await upstoxUserManager.getQuote(userId, symbol);
    res.json({ success: true, data: quote });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Failed to fetch quote';
    console.error('[UpstoxConnect] Quote error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// ─── GET /api/upstox/orders ──────────────────────────────────────────────
// Get open orders for the connected user

router.get('/orders', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    if (!upstoxUserManager.isConnected(userId)) {
      res.status(401).json({ error: 'Upstox not connected. Connect first via POST /api/upstox/connect' });
      return;
    }

    const orders = await upstoxUserManager.getOpenOrders(userId);
    res.json({ success: true, data: orders, count: orders.length });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Failed to fetch orders';
    console.error('[UpstoxConnect] Orders error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// ─── POST /api/upstox/order/place ───────────────────────────────────────
// Place an order

router.post('/order/place', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    if (!upstoxUserManager.isConnected(userId)) {
      res.status(401).json({ error: 'Upstox not connected. Connect first via POST /api/upstox/connect' });
      return;
    }

    const { symbol, exchange, transactionType, quantity, price, productType, orderType } = req.body;

    // Validate required fields
    if (!symbol) { res.status(400).json({ error: 'symbol is required' }); return; }
    if (!quantity) { res.status(400).json({ error: 'quantity is required' }); return; }
    if (!transactionType) { res.status(400).json({ error: 'transactionType is required (BUY/SELL)' }); return; }

    const result = await upstoxUserManager.placeOrder(userId, {
      symbol: symbol.toUpperCase(),
      exchange: exchange || 'NSE',
      transactionType: transactionType === 'BUY' ? 'BUY' : 'SELL',
      quantity: parseInt(quantity),
      price: parseFloat(price || '0'),
      productType: productType || 'CNC',
      orderType: orderType || 'MARKET',
    });

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Failed to place order';
    console.error('[UpstoxConnect] Place order error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// ─── POST /api/upstox/order/modify ──────────────────────────────────────
// Modify an existing order

router.post('/order/modify', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    if (!upstoxUserManager.isConnected(userId)) {
      res.status(401).json({ error: 'Upstox not connected.' });
      return;
    }

    const { orderId, symbol, exchange, quantity, price, productType, orderType, triggerPrice } = req.body;

    if (!orderId) { res.status(400).json({ error: 'orderId is required' }); return; }

    const result = await upstoxUserManager.modifyOrder(userId, {
      orderId,
      symbol: symbol?.toUpperCase(),
      exchange,
      quantity: quantity ? parseInt(quantity) : undefined,
      price: price ? parseFloat(price) : undefined,
      productType,
      orderType,
      triggerPrice: triggerPrice ? parseFloat(triggerPrice) : undefined,
    });

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Failed to modify order';
    console.error('[UpstoxConnect] Modify order error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// ─── POST /api/upstox/order/cancel ──────────────────────────────────────
// Cancel an existing order

router.post('/order/cancel', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    if (!upstoxUserManager.isConnected(userId)) {
      res.status(401).json({ error: 'Upstox not connected.' });
      return;
    }

    const { orderId } = req.body;

    if (!orderId) { res.status(400).json({ error: 'orderId is required' }); return; }

    const result = await upstoxUserManager.cancelOrder(userId, { orderId });

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Failed to cancel order';
    console.error('[UpstoxConnect] Cancel order error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// ─── GET /api/upstox/oauth-url ──────────────────────────────────────────
// Get the Upstox OAuth authorization URL to redirect the user

router.get('/oauth-url', (req: Request, res: Response) => {
  const { redirectUri } = req.query;

  const clientId = env.upstoxClientId;
  if (!clientId) {
    res.status(500).json({
      error: 'Upstox Client ID not configured. Set UPSTOX_CLIENT_ID environment variable.',
    });
    return;
  }

  const rUri = (redirectUri as string) || env.upstoxRedirectUri || 'toroloom://upstox/callback';
  const state = `user_${getUserId(req)}`;

  const oauthUrl = UpstoxBroker.getOAuthUrl(clientId, rUri, state);

  res.json({
    success: true,
    oauthUrl,
    brokerType: 'upstox',
    label: 'Upstox',
    redirectUri: rUri,
  });
});

export default router;
