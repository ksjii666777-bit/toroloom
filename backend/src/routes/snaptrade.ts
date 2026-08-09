/**
 * ============================================================================
 * Toroloom — SnapTrade Routes (Unified Broker OAuth Gateway)
 * ============================================================================
 *
 * Endpoints for broker connection via SnapTrade OAuth:
 *
 *   POST   /api/snaptrade/register         — Register user with SnapTrade
 *   POST   /api/snaptrade/connect-link      — Get OAuth URL to connect broker
 *   POST   /api/snaptrade/callback          — Handle OAuth callback (authorizationId)
 *   GET    /api/snaptrade/status            — Get connected broker info
 *   POST   /api/snaptrade/disconnect        — Disconnect broker
 *   GET    /api/snaptrade/accounts          — List user's connected accounts
 *   GET    /api/snaptrade/holdings          — Fetch portfolio holdings
 *   GET    /api/snaptrade/positions         — Fetch open positions
 *   POST   /api/snaptrade/place-order       — Place an order
 *   GET    /api/snaptrade/orders            — Get recent orders
 *   GET    /api/snaptrade/balances          — Get account balances
 *
 * Persistence: PostgreSQL (via StorageEngine) — survives server restarts.
 *              Falls back to in-memory if no database is configured.
 *
 * Auth: Required (authMiddleware)
 *
 * Security:
 *   - Never stores user's broker password or TOTP
 *   - SnapTrade handles all credential management
 *   - userSecret encrypted at rest (AES-256-GCM)
 *   - userSecret decrypted on-the-fly for each API call (never logged)
 *   - Auto-refresh tokens handled by SnapTrade
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { snapTradeService } from '../services/snapTradeService';
import {
  loadConnection,
  saveConnection,
  deleteConnection,
} from '../services/snapTradePersistence';
import { encrypt, decrypt } from '../lib/crypto';
import { riskEngine } from '../services/riskEngine/RiskEngine';
import { OrderActionType, LockdownStatus } from '../services/riskEngine/types';
import { auditTrail } from '../services/auditTrail';
import {
  claimOrderExecution,
  completeOrderExecution,
  releaseOrderExecution,
} from '../services/idempotency';

const router = Router();
router.use(authMiddleware);

// ──── Types ────────────────────────────────────────────────────────────────

interface _ConnectionRecord {
  snapTradeUserId: string;
  encryptedUserSecret: string;
  authorizationId: string;
  accountId: string;
  brokerName: string;
  brokerSlug: string;
  accountName: string;
  connectedAt: string;
}

const REDIRECT_URI = 'toroloom://snaptrade/callback';

// ──── Helpers ──────────────────────────────────────────────────────────────

function getSnapTradeUserId(userId: string): string {
  return `toroloom_${userId}`;
}

function ensureConfigured(res: Response): boolean {
  if (!snapTradeService.isConfigured()) {
    res.status(500).json({
      error:
        'SnapTrade is not configured. The admin needs to set SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY.',
    });
    return false;
  }
  return true;
}

async function getUserSecret(userId: string): Promise<string | null> {
  // Personal API keys auto-provision their user — no userSecret exists, but
  // the flow must pass the "registered" checks. Return a marker so routes
  // proceed (the service omits userId/userSecret in personal mode anyway).
  if (snapTradeService.isPersonalMode()) {
    return 'personal-auto-provisioned';
  }
  const connection = await loadConnection(userId);
  if (!connection || !connection.encryptedUserSecret) return null;
  try {
    return decrypt(connection.encryptedUserSecret);
  } catch {
    console.error(`[SnapTrade] Failed to decrypt userSecret for user ${userId}`);
    return null;
  }
}

// ──── Routes ───────────────────────────────────────────────────────────────

/**
 * POST /api/snaptrade/register
 */
router.post('/register', async (req: Request, res: Response) => {
  if (!ensureConfigured(res)) return;

  const userId = req.user!.userId;
  const snapTradeUserId = getSnapTradeUserId(userId);

  try {
    // Personal keys auto-provision the user at signup — registration is a
    // no-op that just records the user as ready for the connect flow.
    const { userSecret } = await snapTradeService.registerUser(snapTradeUserId);
    const encryptedSecret = snapTradeService.isPersonalMode()
      ? ''
      : encrypt(userSecret);

    // Load existing connection to preserve any previous broker link
    const existing = await loadConnection(userId);

    await saveConnection(userId, {
      snapTradeUserId,
      encryptedUserSecret: encryptedSecret,
      authorizationId: existing?.authorizationId || '',
      accountId: existing?.accountId || '',
      brokerName: existing?.brokerName || '',
      brokerSlug: existing?.brokerSlug || '',
      accountName: existing?.accountName || '',
      connectedAt: existing?.connectedAt || '',
    });

    console.log(`[SnapTrade] User ${snapTradeUserId} registered`);

    res.json({
      success: true,
      snapTradeUserId,
      message: snapTradeService.isPersonalMode()
        ? 'SnapTrade personal mode — user auto-provisioned'
        : 'SnapTrade user registered successfully',
    });
  } catch (err: any) {
    console.error('[SnapTrade] Register error:', err.message);
    res.status(500).json({ error: `SnapTrade registration failed: ${err.message}` });
  }
});

/**
 * POST /api/snaptrade/connect-link
 */
router.post('/connect-link', async (req: Request, res: Response) => {
  if (!ensureConfigured(res)) return;

  const userId = req.user!.userId;
  const snapTradeUserId = getSnapTradeUserId(userId);
  const userSecret = await getUserSecret(userId);

  if (!userSecret) {
    res.status(400).json({
      error: 'User not registered with SnapTrade. Call POST /api/snaptrade/register first.',
    });
    return;
  }

  try {
    const { url } = await snapTradeService.getConnectionLink(
      snapTradeUserId,
      userSecret,
      REDIRECT_URI,
    );

    res.json({
      success: true,
      oauthUrl: url,
      redirectUri: REDIRECT_URI,
      message: 'Open this URL in a browser to connect your broker',
    });
  } catch (err: any) {
    console.error('[SnapTrade] Connect-link error:', err.message);
    res.status(500).json({ error: `Failed to generate connect link: ${err.message}` });
  }
});

/**
 * POST /api/snaptrade/callback
 */
router.post('/callback', async (req: Request, res: Response) => {
  if (!ensureConfigured(res)) return;

  const userId = req.user!.userId;
  const snapTradeUserId = getSnapTradeUserId(userId);
  const userSecret = await getUserSecret(userId);

  if (!userSecret) {
    res.status(400).json({
      error: 'User not registered with SnapTrade. Call POST /api/snaptrade/register first.',
    });
    return;
  }

  const { authorizationId } = req.body;

  if (!authorizationId || typeof authorizationId !== 'string') {
    res.status(400).json({ error: 'authorizationId is required' });
    return;
  }

  try {
    const auth = await snapTradeService.getAuthorization(
      authorizationId,
      snapTradeUserId,
      userSecret,
    );

    if (!auth) {
      res.status(404).json({
        error: 'Authorization not found. Make sure you completed the OAuth flow.',
      });
      return;
    }

    const accounts = await snapTradeService.getAccounts(snapTradeUserId, userSecret);
    const account = accounts[0];

    if (!account) {
      res.status(404).json({
        error: 'No accounts found for this broker connection.',
      });
      return;
    }

    const brokerName = auth.brokerage?.name || 'Unknown Broker';
    const brokerSlug = auth.brokerage?.slug || 'unknown';

    // Load existing to preserve encryptedUserSecret
    const existing = await loadConnection(userId);

    await saveConnection(userId, {
      snapTradeUserId,
      encryptedUserSecret: existing?.encryptedUserSecret || '',
      authorizationId,
      accountId: account.id,
      brokerName,
      brokerSlug,
      accountName: account.name || 'Main Account',
      connectedAt: new Date().toISOString(),
    });

    const updated = await loadConnection(userId);
    const balance = account.balance?.total || 0;

    console.log(`[SnapTrade] User ${snapTradeUserId} connected to ${brokerName}`);

    res.json({
      success: true,
      connection: {
        brokerName,
        brokerSlug,
        accountName: account.name || 'Main Account',
        accountId: account.id,
        balance,
        connectedAt: updated?.connectedAt || new Date().toISOString(),
      },
      message: `Successfully connected to ${brokerName}`,
    });
  } catch (err: any) {
    console.error('[SnapTrade] Callback error:', err.message);
    res.status(500).json({ error: `Callback processing failed: ${err.message}` });
  }
});

/**
 * GET /api/snaptrade/status
 */
router.get('/status', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const connection = await loadConnection(userId);

  if (!connection || !connection.authorizationId) {
    res.json({
      connected: false,
      brokerName: null,
      brokerSlug: null,
      accountName: null,
      accountId: null,
      connectedAt: null,
    });
    return;
  }

  res.json({
    connected: true,
    brokerName: connection.brokerName,
    brokerSlug: connection.brokerSlug,
    accountName: connection.accountName,
    accountId: connection.accountId,
    connectedAt: connection.connectedAt,
  });
});

/**
 * POST /api/snaptrade/disconnect
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  if (!ensureConfigured(res)) return;

  const userId = req.user!.userId;
  const snapTradeUserId = getSnapTradeUserId(userId);
  const userSecret = await getUserSecret(userId);
  const connection = await loadConnection(userId);

  if (!connection || !connection.authorizationId) {
    res.status(400).json({ error: 'No broker is currently connected' });
    return;
  }

  try {
    if (userSecret) {
      await snapTradeService.disconnect(
        connection.authorizationId,
        snapTradeUserId,
        userSecret,
      );
      console.log(`[SnapTrade] User ${snapTradeUserId} disconnected from ${connection.brokerName}`);
    } else {
      console.warn(`[SnapTrade] User ${snapTradeUserId} — no userSecret found, clearing local state only`);
    }

    // Clear connection from persistent storage
    await deleteConnection(userId);

    res.json({
      success: true,
      message: connection.brokerName
        ? `Disconnected from ${connection.brokerName}`
        : 'Broker disconnected successfully',
    });
  } catch (err: any) {
    console.error('[SnapTrade] Disconnect error:', err.message);

    // Still clear local state even if remote fails
    await deleteConnection(userId);

    res.json({
      success: true,
      message: 'Connection cleared (remote disconnect encountered an issue)',
    });
  }
});

/**
 * GET /api/snaptrade/accounts
 */
router.get('/accounts', async (req: Request, res: Response) => {
  if (!ensureConfigured(res)) return;

  const userId = req.user!.userId;
  const snapTradeUserId = getSnapTradeUserId(userId);
  const userSecret = await getUserSecret(userId);

  if (!userSecret) {
    res.status(400).json({ error: 'User not registered with SnapTrade.' });
    return;
  }

  try {
    const accounts = await snapTradeService.getAccounts(snapTradeUserId, userSecret);

    res.json({
      success: true,
      data: accounts.map((a: any) => ({
        id: a.id,
        name: a.name,
        number: a.number || '',
        type: a.type?.name || '',
        balance: a.balance?.total || 0,
        syncStatus: a.syncStatus?.status || 'unknown',
      })),
      count: accounts.length,
    });
  } catch (err: any) {
    console.error('[SnapTrade] Accounts error:', err.message);
    res.status(500).json({ error: `Failed to fetch accounts: ${err.message}` });
  }
});

/**
 * GET /api/snaptrade/holdings
 */
router.get('/holdings', async (req: Request, res: Response) => {
  if (!ensureConfigured(res)) return;

  const userId = req.user!.userId;
  const snapTradeUserId = getSnapTradeUserId(userId);
  const userSecret = await getUserSecret(userId);

  if (!userSecret) {
    res.status(400).json({ error: 'User not registered with SnapTrade.' });
    return;
  }

  const connection = await loadConnection(userId);
  if (!connection || !connection.authorizationId) {
    res.status(400).json({ error: 'No broker connected. Connect a broker first.' });
    return;
  }

  try {
    const holdings = await snapTradeService.getHoldings(
      snapTradeUserId,
      userSecret,
      connection.accountId,
    );

    res.json({
      success: true,
      data: (holdings.holdings || []).map((h: any) => ({
        symbol: h.symbol?.symbol || '',
        name: h.symbol?.name || '',
        quantity: h.units || h.quantity || 0,
        price: h.price || 0,
        avgCost: h.avgCost || h.averageCost || 0,
        pnl: h.pnl || 0,
        pnlPercent: h.pnlPercent || 0,
        currency: h.currency?.code || 'USD',
      })),
      count: holdings.holdings?.length || 0,
    });
  } catch (err: any) {
    console.error('[SnapTrade] Holdings error:', err.message);
    res.status(500).json({ error: `Failed to fetch holdings: ${err.message}` });
  }
});

/**
 * GET /api/snaptrade/positions
 */
router.get('/positions', async (req: Request, res: Response) => {
  if (!ensureConfigured(res)) return;

  const userId = req.user!.userId;
  const snapTradeUserId = getSnapTradeUserId(userId);
  const userSecret = await getUserSecret(userId);

  if (!userSecret) {
    res.status(400).json({ error: 'User not registered with SnapTrade.' });
    return;
  }

  const connection = await loadConnection(userId);
  if (!connection || !connection.authorizationId) {
    res.status(400).json({ error: 'No broker connected. Connect a broker first.' });
    return;
  }

  try {
    const positions = await snapTradeService.getPositions(
      snapTradeUserId,
      userSecret,
      connection.accountId,
    );

    res.json({
      success: true,
      data: positions.map((p: any) => ({
        symbol: p.symbol?.symbol || '',
        name: p.symbol?.name || '',
        quantity: p.units || 0,
        price: p.price || 0,
        avgCost: p.avgCost || 0,
        pnl: p.pnl || 0,
        pnlPercent: p.pnlPercent || 0,
      })),
      count: positions.length,
    });
  } catch (err: any) {
    console.error('[SnapTrade] Positions error:', err.message);
    res.status(500).json({ error: `Failed to fetch positions: ${err.message}` });
  }
});

/**
 * GET /api/snaptrade/orders
 */
router.get('/orders', async (req: Request, res: Response) => {
  if (!ensureConfigured(res)) return;

  const userId = req.user!.userId;
  const snapTradeUserId = getSnapTradeUserId(userId);
  const userSecret = await getUserSecret(userId);

  if (!userSecret) {
    res.status(400).json({ error: 'User not registered with SnapTrade.' });
    return;
  }

  const connection = await loadConnection(userId);
  if (!connection || !connection.authorizationId) {
    res.status(400).json({ error: 'No broker connected. Connect a broker first.' });
    return;
  }

  try {
    const orders = await snapTradeService.getOrders(
      snapTradeUserId,
      userSecret,
      connection.accountId,
    );

    res.json({
      success: true,
      data: orders.map((o: any) => ({
        id: o.id,
        symbol: o.symbol?.symbol || '',
        action: o.action || o.side,
        quantity: o.units || o.quantity || 0,
        price: o.price || 0,
        status: o.orderStatus || o.status,
        filledQuantity: o.filledUnits || 0,
        createdAt: o.createdAt || o.createdDate,
      })),
      count: orders.length,
    });
  } catch (err: any) {
    console.error('[SnapTrade] Orders error:', err.message);
    res.status(500).json({ error: `Failed to fetch orders: ${err.message}` });
  }
});

/**
 * GET /api/snaptrade/balances
 */
router.get('/balances', async (req: Request, res: Response) => {
  if (!ensureConfigured(res)) return;

  const userId = req.user!.userId;
  const snapTradeUserId = getSnapTradeUserId(userId);
  const userSecret = await getUserSecret(userId);

  if (!userSecret) {
    res.status(400).json({ error: 'User not registered with SnapTrade.' });
    return;
  }

  const connection = await loadConnection(userId);
  if (!connection || !connection.authorizationId) {
    res.status(400).json({ error: 'No broker connected. Connect a broker first.' });
    return;
  }

  try {
    const balances = await snapTradeService.getAccountBalance(
      snapTradeUserId,
      userSecret,
      connection.accountId,
    );

    res.json({
      success: true,
      data: balances.map((b: any) => ({
        currency: b.currency?.code || 'USD',
        total: b.total || 0,
        cash: b.cash || 0,
        buyingPower: b.buyingPower || 0,
      })),
      count: balances.length,
    });
  } catch (err: any) {
    console.error('[SnapTrade] Balances error:', err.message);
    res.status(500).json({ error: `Failed to fetch balances: ${err.message}` });
  }
});

/**
 * GET /api/snaptrade/ticker/:symbol
 *
 * Hybrid ticker endpoint — feeds the TradingView + SnapTrade order panel.
 * Returns, for ONE symbol:
 *   - connected            — whether a broker is linked (read-only mode)
 *   - position             — open position (qty, avg buy, P&L) or null
 *   - levels               — Iron Lock / risk-engine limits (stop/target hints)
 *   - ironLockActive       — lockdown state
 *
 * Security: the SnapTrade userSecret is decrypted server-side ONLY and is
 * never included in the response. The TradingView widget never sees any
 * broker credential.
 */
router.get('/ticker/:symbol', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const symbol = String(req.params.symbol || '').toUpperCase().trim();

  if (!symbol) {
    res.status(400).json({ error: 'symbol is required' });
    return;
  }

  const connection = await loadConnection(userId);
  if (!connection || !connection.authorizationId) {
    res.json({
      success: true,
      connected: false,
      symbol,
      position: null,
      levels: null,
      ironLockActive: false,
      lockdownStatus: 'none',
    });
    return;
  }

  // Position lookup is best-effort — never blocks the response.
  let position: Record<string, unknown> | null = null;
  try {
    const userSecret = await getUserSecret(userId);
    if (userSecret) {
      const positions = await snapTradeService.getPositions(
        getSnapTradeUserId(userId),
        userSecret,
        connection.accountId,
      );
      const pos = (positions as any[]).find(
        (p: any) =>
          p.symbol?.symbol &&
          String(p.symbol.symbol).toUpperCase().trim() === symbol,
      );
      if (pos && Number(pos.units) > 0) {
        position = {
          symbol,
          quantity: Number(pos.units) || 0,
          avgCost: Number(pos.avgCost) || 0,
          price: Number(pos.price) || 0,
          pnl: Number(pos.pnl) || 0,
          pnlPercent: Number(pos.pnlPercent) || 0,
        };
      }
    }
  } catch {
    // Position lookup failed — respond with levels only.
  }

  const profile = riskEngine.getState(userId);
  const isLockdown = profile.lockdown.status !== LockdownStatus.NONE;

  res.json({
    success: true,
    connected: true,
    symbol,
    position,
    levels: {
      dailyLossLimit: profile.limits.dailyLossLimit,
      dailyLossPercentLimit: profile.limits.dailyLossPercentLimit,
      maxPositionSizePercent: profile.limits.maxPositionSizePercent,
    },
    ironLockActive: isLockdown && profile.settingsFrozen,
    lockdownStatus: profile.lockdown.status,
  });
});

/**
 * POST /api/snaptrade/place-order
 */
router.post('/place-order', async (req: Request, res: Response) => {
  if (!ensureConfigured(res)) return;

  const userId = req.user!.userId;
  const snapTradeUserId = getSnapTradeUserId(userId);
  const userSecret = await getUserSecret(userId);

  if (!userSecret) {
    res.status(400).json({ error: 'User not registered with SnapTrade.' });
    return;
  }

  const connection = await loadConnection(userId);
  if (!connection || !connection.authorizationId) {
    res.status(400).json({ error: 'No broker connected. Connect a broker first.' });
    return;
  }

  const { symbol, action, orderType, quantity, price, stopPrice, timeInForce } = req.body;
  const idempotencyKey = req.body.idempotencyKey as string | undefined;
  // Market orders may not carry a price — the client sends an estimate so the
  // risk engine's position-size gate still fires (the biggest live-money check).
  const estimatedPrice = req.body.estimatedPrice as number | undefined;

  if (!symbol || !action || !orderType || !quantity) {
    res.status(400).json({
      error:
        'Required fields: symbol, action (BUY/SELL), orderType (Market/Limit/StopLimit/StopLoss), quantity',
    });
    return;
  }

  if (idempotencyKey !== undefined && (idempotencyKey.length < 8 || idempotencyKey.length > 128)) {
    res.status(400).json({ error: 'idempotencyKey must be a string between 8 and 128 characters' });
    return;
  }

  try {
    // ── Idempotency guard: a replayed key returns the ORIGINAL outcome ──────
    if (idempotencyKey) {
      const claim = await claimOrderExecution(userId, idempotencyKey);
      if (claim.state === 'completed' && claim.result) {
        res.json({ ...(claim.result as Record<string, unknown>), idempotentReplay: true });
        return;
      }
      if (claim.state === 'in_progress') {
        res.status(429).json({ error: 'Duplicate order request in progress — please wait.' });
        return;
      }
    }

    // ── Fetch current positions so SELL exits are recognized (lockdown-safe) ──
    let currentPosition: { quantity: number; avgPrice: number } | undefined;
    try {
      const positions = await snapTradeService.getPositions(
        snapTradeUserId,
        userSecret,
        connection.accountId,
      );
      const sym = String(symbol).toUpperCase().trim();
      const pos = (positions as any[]).find(
        (p: any) =>
          p.symbol?.symbol && String(p.symbol.symbol).toUpperCase().trim() === sym,
      );
      if (pos && Number(pos.units) > 0) {
        currentPosition = { quantity: Number(pos.units), avgPrice: Number(pos.avgCost) || 0 };
      }
    } catch {
      // Best-effort — position lookup failure must NOT block ordering
    }

    // ── Financial Bodyguard: risk check BEFORE any live-money order ─────────
    const portfolioValue = riskEngine.getState(userId).portfolioValueAtOpen || 1000000;
    const evaluation = riskEngine.evaluate(userId, {
      actionType: action.toUpperCase() === 'BUY' ? OrderActionType.BUY : OrderActionType.SELL,
      symbol,
      quantity,
      price: price ?? estimatedPrice,
      productType: 'CNC',
      isFNO: false,
      portfolioValue,
      currentPosition,
    });

    if (!evaluation.allowed) {
      await auditTrail.append({
        userId,
        eventType: 'ORDER_REJECTED',
        data: {
          source: 'snaptrade',
          symbol,
          action: action.toUpperCase(),
          quantity,
          price: price ?? estimatedPrice,
          reason: evaluation.message,
          decision: evaluation.decision,
        },
      });
      const blockedResponse = {
        success: false,
        status: 'rejected',
        orderId: null,
        message: evaluation.message,
        riskEvaluation: evaluation,
      };
      // Store the blocked outcome so a retry of the same key returns the block
      // message (not a confusing 429 from the pending claim).
      if (idempotencyKey) {
        await completeOrderExecution(userId, idempotencyKey, blockedResponse);
      }
      res.json(blockedResponse);
      return;
    }

    const result = await snapTradeService.placeOrder(
      snapTradeUserId,
      userSecret,
      connection.accountId,
      {
        symbol,
        action: action.toUpperCase(),
        orderType,
        quantity,
        price,
        stopPrice,
        timeInForce: timeInForce || 'Day',
      },
    );

    const orderId = result.id || result.brokerageOrderId;
    const orderStatus = result.status || result.orderStatus;

    const auditEvent = await auditTrail.append({
      userId,
      eventType: 'ORDER_EXECUTION',
      data: {
        source: 'snaptrade',
        symbol,
        action: action.toUpperCase(),
        orderType,
        quantity,
        price,
        orderId,
        status: orderStatus,
      },
    });

    const responseBody = {
      success: true,
      orderId,
      status: orderStatus,
      message: `Order placed successfully. Status: ${orderStatus || 'unknown'}`,
      riskEvaluation: evaluation,
      auditEventId: auditEvent.id,
    };

    if (idempotencyKey) {
      await completeOrderExecution(userId, idempotencyKey, responseBody);
    }

    res.json(responseBody);
  } catch (err: any) {
    if (idempotencyKey) {
      await releaseOrderExecution(userId, idempotencyKey);
    }
    console.error('[SnapTrade] Place-order error:', err.message);
    res.status(500).json({ error: `Failed to place order: ${err.message}` });
  }
});

export default router;
