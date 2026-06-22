/**
 * ============================================================================
 * Toroloom Broker Link Routes — Per-User Broker Credential Management
 * ============================================================================
 *
 * Enables frontend users to connect/disconnect their own broker accounts
 * without modifying the global .env configuration. Each user can link
 * one broker at a time.
 *
 * Endpoints:
 *   GET    /api/broker-link/status     — Current user's broker connection status
 *   POST   /api/broker-link/connect    — Store broker credentials for the user
 *   POST   /api/broker-link/disconnect — Remove broker link for the user
 *   GET    /api/broker-link/oauth-url   — Get OAuth URL for broker (Zerodha)
 *
 * Auth: Required (authMiddleware)
 *
 * Storage:
 *   Uses in-memory Map keyed by userId. In production, this should be
 *   persisted to the database via the storage service.
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import { registry } from '../services/broker/registry';

const router = Router();
router.use(authMiddleware);

// Lazy-loaded KiteConnect SDK (only loaded for Zerodha OAuth flow)
function getKiteConnect(): any {
  try {
    return require('kiteconnect').KiteConnect;
  } catch {
    return null;
  }
}

// ──── Types ────────────────────────────────────────────────────────────────

interface BrokerLink {
  brokerType: 'angel' | 'zerodha' | 'groww';
  connected: boolean;
  connectedAt: string | null;
  // Store encrypted credentials (in production, use proper encryption)
  credentials: {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    clientId?: string;
    password?: string;
    totp?: string;
  };
  label: string;
}

// In-memory store — replace with database in production
const brokerLinks = new Map<string, BrokerLink>();

/**
 * Build available brokers list dynamically from the registry.
 * Returns the same shape as the old BROKER_META for backward compatibility.
 */
function getAvailableBrokers(): Array<{ type: string; label: string; icon: string; color: string; hasOAuth: boolean; hasZeroApi: boolean; requiresConfig: boolean }> {
  return registry.getAllMeta().map(meta => ({
    type: meta.type,
    label: meta.label,
    icon: meta.icon || meta.type.charAt(0).toUpperCase(),
    color: meta.color || '#6B7280',
    hasOAuth: meta.hasOAuth,
    hasZeroApi: meta.hasZeroApi,
    requiresConfig: meta.type !== 'mock',
  }));
}

// ──── Routes ───────────────────────────────────────────────────────────────

/**
 * GET /api/broker-link/status
 *
 * Returns the current broker connection status for the authenticated user.
 * If the user has not linked a broker, returns null.
 */
router.get('/status', (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const link = brokerLinks.get(userId);

  if (!link) {
    res.json({
      connected: false,
      brokerType: null,
      label: null,
      connectedAt: null,
      availableBrokers: getAvailableBrokers(),
    });
    return;
  }

  res.json({
    connected: link.connected,
    brokerType: link.brokerType,
    label: link.label,
    connectedAt: link.connectedAt,
    availableBrokers: getAvailableBrokers(),
  });
});

/**
 * POST /api/broker-link/connect
 *
 * Store broker credentials for the user. Validates required fields
 * based on broker type.
 *
 * Body: {
 *   brokerType: 'angel' | 'zerodha' | 'groww',
 *   credentials: { ... }
 * }
 */
router.post('/connect', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { brokerType, credentials } = req.body;

  if (!brokerType || !['angel', 'zerodha', 'groww'].includes(brokerType)) {
    res.status(400).json({ error: 'brokerType must be one of: angel, zerodha, groww' });
    return;
  }

  if (!credentials || typeof credentials !== 'object') {
    res.status(400).json({ error: 'credentials object is required' });
    return;
  }

  // Validate required fields per broker
  // For OAuth flow (zerodha with request_token), apiKey can be empty
  const isOAuthFlow = brokerType === 'zerodha' && credentials.apiSecret && !credentials.apiKey;
  const missingFields: string[] = [];
  switch (brokerType) {
    case 'zerodha':
      if (!isOAuthFlow && !credentials.apiKey) missingFields.push('apiKey');
      if (!credentials.apiSecret) missingFields.push('apiSecret');
      break;
    case 'angel':
      if (!credentials.apiKey) missingFields.push('apiKey');
      if (!credentials.clientId) missingFields.push('clientId');
      break;
    case 'groww':
      if (!credentials.apiKey) missingFields.push('apiKey');
      if (!credentials.accessToken) missingFields.push('accessToken');
      break;
  }

  if (missingFields.length > 0) {
    res.status(400).json({
      error: `Missing required fields for ${brokerType}: ${missingFields.join(', ')}`,
    });
    return;
  }

  let resolvedAccessToken = credentials.accessToken;
  let resolvedApiSecret = credentials.apiSecret;
  let exchangeErrorMessage: string | undefined;

  // ── Zerodha OAuth: exchange request_token → access_token ─────────
  if (isOAuthFlow && brokerType === 'zerodha') {
    const apiKey = env.zerodha.apiKey;
    const apiSecret = env.zerodha.apiSecret;
    const requestToken = credentials.apiSecret;

    if (apiKey && apiSecret && requestToken) {
      const KiteConnectClass = getKiteConnect();
      if (KiteConnectClass) {
        try {
          const kite = new KiteConnectClass({ api_key: apiKey });
          const session = await kite.generateSession(requestToken, apiSecret);
          resolvedAccessToken = session.access_token;
          resolvedApiSecret = apiSecret; // Keep the real apiSecret, not the request_token
          console.log(`[BrokerLink] Zerodha OAuth: exchanged request_token → access_token for user ${userId}`);
        } catch (exchangeError: any) {
          console.warn(`[BrokerLink] Kite Connect token exchange failed: ${exchangeError.message}`);
          resolvedAccessToken = '';
          exchangeErrorMessage = exchangeError.message;
        }
      }
    } else {
      console.warn(`[BrokerLink] Zerodha OAuth exchange skipped: ZERODHA_API_KEY or ZERODHA_API_SECRET not configured`);
      exchangeErrorMessage = 'Zerodha API credentials not configured on server';
    }
  }

  // Store the link
  const link: BrokerLink = {
    brokerType: brokerType as BrokerLink['brokerType'],
    connected: true,
    connectedAt: new Date().toISOString(),
    credentials: {
      apiKey: credentials.apiKey,
      apiSecret: resolvedApiSecret,
      accessToken: resolvedAccessToken || credentials.accessToken,
      clientId: credentials.clientId,
      password: credentials.password,
      totp: credentials.totp,
    },
    label: registry.getPlugin(brokerType)?.label || brokerType,
  };

  brokerLinks.set(userId, link);

  console.log(`[BrokerLink] User ${userId} connected to ${link.label}`);

  res.json({
    success: true,
    message: `Successfully connected to ${link.label}`,
    brokerType: link.brokerType,
    label: link.label,
    connectedAt: link.connectedAt,
    hasAccessToken: !!resolvedAccessToken,
    ...(exchangeErrorMessage ? { exchangeError: exchangeErrorMessage } : {}),
  });
});

/**
 * POST /api/broker-link/disconnect
 *
 * Remove the broker link for the authenticated user.
 */
router.post('/disconnect', (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const link = brokerLinks.get(userId);

  if (!link) {
    res.status(400).json({ error: 'No broker link found to disconnect' });
    return;
  }

  brokerLinks.delete(userId);

  console.log(`[BrokerLink] User ${userId} disconnected from ${link.label}`);

  res.json({
    success: true,
    message: `Disconnected from ${link.label}`,
  });
});

/**
 * GET /api/broker-link/oauth-url
 *
 * Returns the OAuth URL for the specified broker.
 * Currently only Zerodha supports OAuth.
 *
 * Query: ?brokerType=zerodha
 */
router.get('/oauth-url', (req: Request, res: Response) => {
  const { brokerType } = req.query;

  if (!brokerType || brokerType !== 'zerodha') {
    res.status(400).json({ error: 'OAuth is only supported for zerodha' });
    return;
  }

  const apiKey = env.zerodha.apiKey || req.user?.userId;
  if (!apiKey) {
    res.status(400).json({
      error: 'Zerodha API key not configured. Please set ZERODHA_API_KEY in your .env file.',
    });
    return;
  }

  // Zerodha Kite Connect OAuth URL
  // In production, the redirect_uri should point to your backend callback endpoint
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/broker/zerodha/callback`;
  const oauthUrl = `https://kite.trade/connect/login?api_key=${apiKey}&v=3`;

  res.json({
    oauthUrl,
    redirectUri,
    brokerType: 'zerodha',
    label: 'Zerodha',
  });
});

export default router;
