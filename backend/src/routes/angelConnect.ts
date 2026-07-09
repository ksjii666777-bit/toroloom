/**
 * ============================================================================
 * Toroloom — Angel One SmartAPI Connect (User-Facing)
 * ============================================================================
 *
 * Per-user Angel One SmartAPI integration. Users connect their own Angel One
 * account using their credentials, and the backend fetches real holdings,
 * positions, and trade data via the official Angel One SmartAPI.
 *
 * Benefits over Zero-API:
 *   - Reliable — official API, never changes
 *   - Real-time — WebSocket ticks, live data
 *   - Feature-rich — EDIS, brokerage calculator, trading
 *
 * Endpoints:
 *   POST  /api/angel/connect      — Connect user's Angel One account
 *   POST  /api/angel/disconnect   — Disconnect
 *   GET   /api/angel/status       — Check connection status
 *   GET   /api/angel/holdings     — Fetch holdings
 *   GET   /api/angel/positions    — Fetch positions
 *   GET   /api/angel/trades       — Fetch trade history
 *   GET   /api/angel/quote/:symbol — Get quote for a symbol
 *
 * Auth: Required (authMiddleware)
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { angelUserManager } from '../services/broker/angelUserManager';
import { env } from '../config/env';

const router = Router();
router.use(authMiddleware);

// ── POST /api/angel/connect ──────────────────────────────────────────────
// Connect the user's Angel One account using their SmartAPI credentials

router.post('/connect', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || 'anonymous';
    const { clientId, password, totp } = req.body;

    // Validate required fields
    if (!clientId || typeof clientId !== 'string') {
      res.status(400).json({ error: 'clientId is required (your Angel One trading account code)' });
      return;
    }
    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'password is required (your Angel One trading password)' });
      return;
    }
    if (!totp || typeof totp !== 'string') {
      res.status(400).json({ error: 'totp is required (Base32 TOTP secret from SmartAPI portal)' });
      return;
    }

    // Server-level API key from env
    const apiKey = env.angelSmartApiKey;
    if (!apiKey) {
      res.status(500).json({
        error: 'Angel One SmartAPI is not configured on the server. The admin needs to set ANGEL_SMARTAPI_KEY.',
      });
      return;
    }

    await angelUserManager.connect(userId, clientId.trim(), password, totp.trim(), apiKey);

    res.json({
      success: true,
      message: 'Angel One connected successfully!',
      clientId: clientId.trim(),
    });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Connection failed';
    console.error('[AngelConnect] Connect error:', errMsg);
    res.status(401).json({ error: errMsg });
  }
});

// ── POST /api/angel/disconnect ──────────────────────────────────────────
// Disconnect the user's Angel One account

router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || 'anonymous';
    const wasConnected = await angelUserManager.disconnect(userId);

    res.json({
      success: true,
      message: wasConnected ? 'Angel One disconnected.' : 'Not connected.',
    });
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ── GET /api/angel/status ───────────────────────────────────────────────
// Check Angel One connection status

router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || 'anonymous';
    const info = angelUserManager.getConnectionInfo(userId);

    res.json({
      connected: info.connected,
      clientId: info.clientId,
      connectedAt: info.connectedAt ? new Date(info.connectedAt).toISOString() : undefined,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// ── GET /api/angel/holdings ─────────────────────────────────────────────
// Fetch holdings for the connected user

router.get('/holdings', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || 'anonymous';

    if (!angelUserManager.isConnected(userId)) {
      res.status(401).json({ error: 'Angel One not connected. Connect first via POST /api/angel/connect' });
      return;
    }

    const holdings = await angelUserManager.getHoldings(userId);
    res.json({ success: true, data: holdings, count: holdings.length });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Failed to fetch holdings';
    console.error('[AngelConnect] Holdings error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// ── GET /api/angel/positions ────────────────────────────────────────────
// Fetch positions for the connected user

router.get('/positions', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || 'anonymous';

    if (!angelUserManager.isConnected(userId)) {
      res.status(401).json({ error: 'Angel One not connected. Connect first via POST /api/angel/connect' });
      return;
    }

    const positions = await angelUserManager.getPositions(userId);
    res.json({ success: true, data: positions, count: positions.length });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Failed to fetch positions';
    console.error('[AngelConnect] Positions error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// ── GET /api/angel/trades ───────────────────────────────────────────────
// Fetch trade history for the connected user

router.get('/trades', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || 'anonymous';

    if (!angelUserManager.isConnected(userId)) {
      res.status(401).json({ error: 'Angel One not connected. Connect first via POST /api/angel/connect' });
      return;
    }

    const trades = await angelUserManager.getTradeHistory(userId);
    res.json({ success: true, data: trades, count: trades.length });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Failed to fetch trades';
    console.error('[AngelConnect] Trades error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

// ── GET /api/angel/quote/:symbol ─────────────────────────────────────────
// Get a live quote for a symbol

router.get('/quote/:symbol', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId || 'anonymous';
    const symbol = (req.params.symbol as string)?.toUpperCase();

    if (!symbol) {
      res.status(400).json({ error: 'Symbol is required' });
      return;
    }

    if (!angelUserManager.isConnected(userId)) {
      res.status(401).json({ error: 'Angel One not connected. Connect first via POST /api/angel/connect' });
      return;
    }

    const quote = await angelUserManager.getQuote(userId, symbol);
    res.json({ success: true, data: quote });
  } catch (error: unknown) {
    const errMsg = (error as Error).message || 'Failed to fetch quote';
    console.error('[AngelConnect] Quote error:', errMsg);
    res.status(500).json({ error: errMsg });
  }
});

export default router;
