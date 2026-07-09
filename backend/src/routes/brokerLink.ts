/**
 * ============================================================================
 * Toroloom Broker Link Routes — Zero-API Session-Based Broker Connection
 * ============================================================================
 *
 * Enables frontend users to connect/disconnect their own broker accounts
 * using session-based Zero-API Gateway credentials (tokens, cookies)
 * extracted via WebView — no developer API keys required.
 *
 * Endpoints:
 *   GET    /api/broker-link/status     — Current user's broker connection status
 *   POST   /api/broker-link/connect    — Store session credentials for the user
 *   POST   /api/broker-link/disconnect — Remove broker link for the user
 *   GET    /api/broker-link/oauth-url   — Get OAuth URL for broker (Zerodha)
 *
 * Auth: Required (authMiddleware)
 *
 * Architecture:
 *   - No apiKey/apiSecret/tradingPassword/totp fields stored
 *   - Only session tokens, access tokens, and encrypted cookies from WebView
 *   - Zero-API Hybrid Gateway: credentials extracted via SecureSessionSync WebView
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { registry } from '../services/broker/registry';

const router = Router();
router.use(authMiddleware);

// ──── Types ────────────────────────────────────────────────────────────────

interface BrokerLinkSession {
  brokerType: 'angel' | 'zerodha' | 'groww' | 'dhan' | 'upstox' | 'fivepaisa';
  connected: boolean;
  connectedAt: string | null;
  // Zero-API session credentials — extracted via WebView, no developer keys
  credentials: {
    accessToken?: string;
    sessionToken?: string;
    clientId?: string;
    encryptedCookies?: string;  // Serialized cookies from WebView extraction
  };
  label: string;
}

// In-memory store — replace with database in production
const brokerLinks = new Map<string, BrokerLinkSession>();

/**
 * Build available brokers list dynamically from the registry.
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
 * Store Zero-API session credentials for the user.
 * Accepts only session-based credentials (no developer API keys).
 *
 * Body: {
 *   brokerType: 'angel' | 'zerodha' | 'groww',
 *   credentials: {
 *     accessToken?: string,
 *     sessionToken?: string,
 *     clientId?: string,
 *     encryptedCookies?: string
 *   }
 * }
 */
router.post('/connect', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { brokerType, credentials } = req.body;

  const validBrokers = registry.getAllMeta().map(m => m.type);
  if (!brokerType || !validBrokers.includes(brokerType)) {
    res.status(400).json({
      error: `brokerType must be one of: ${validBrokers.join(', ')}`,
    });
    return;
  }

  if (!credentials || typeof credentials !== 'object') {
    res.status(400).json({ error: 'credentials object is required' });
    return;
  }

  // Zero-API: Only session tokens allowed — reject if apiKey or apiSecret sent
  if (credentials.apiKey || credentials.apiSecret || credentials.tradingPassword || credentials.totp) {
    res.status(400).json({
      error: 'Developer API keys are not supported. Use Zero-API session credentials (accessToken, sessionToken, encryptedCookies) extracted via WebView.',
    });
    return;
  }

  // Require at least one session credential
  if (!credentials.accessToken && !credentials.sessionToken && !credentials.encryptedCookies) {
    res.status(400).json({
      error: 'At least one session credential required: accessToken, sessionToken, or encryptedCookies',
    });
    return;
  }

  // Store the link
  const link: BrokerLinkSession = {
    brokerType,
    connected: true,
    connectedAt: new Date().toISOString(),
    credentials: {
      accessToken: credentials.accessToken,
      sessionToken: credentials.sessionToken,
      clientId: credentials.clientId,
      encryptedCookies: credentials.encryptedCookies,
    },
    label: registry.getPlugin(brokerType)?.label || brokerType,
  };

  brokerLinks.set(userId, link);

  console.log(`[BrokerLink] User ${userId} connected to ${link.label} (Zero-API)`);

  res.json({
    success: true,
    message: `Successfully connected to ${link.label}`,
    brokerType: link.brokerType,
    label: link.label,
    connectedAt: link.connectedAt,
    hasSessionCredentials: true,
  });
});

/**
 * POST /api/broker-link/disconnect
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
 * Returns the OAuth URL for Zerodha.
 * In Zero-API mode, returns a config URL guiding the user through
 * the WebView-based session extraction process instead.
 */
router.get('/oauth-url', (req: Request, res: Response) => {
  const { brokerType } = req.query;

  if (!brokerType || brokerType !== 'zerodha') {
    res.status(400).json({ error: 'OAuth is only supported for zerodha' });
    return;
  }

  // Zero-API: Instead of server-side API key, return a redirect URL
  // that launches the WebView session extraction flow.
  // The frontend should open SecureSessionSync WebView for Zerodha login.
  res.json({
    oauthUrl: null, // No server-side OAuth URL — use WebView session extraction
    redirectUri: null,
    brokerType: 'zerodha',
    label: 'Zerodha',
    zeroApiMode: true,
    message: 'Zerodha uses Zero-API Gateway. Launch SecureSessionSync WebView to extract session credentials.',
  });
});

export default router;
