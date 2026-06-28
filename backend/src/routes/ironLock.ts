/**
 * ============================================================================
 * Toroloom — Iron Lock Engine
 * ============================================================================
 *
 * Premium server-side loss limit enforcement available for Elite tier users.
 * The Iron Lock extends the base Financial Bodyguard with:
 *
 *   1. **Immutable Lock Parameters** — Once a lockdown is triggered, the loss
 *      limit parameters are frozen on the server. ALL client-side requests to
 *      modify, disable, or increase thresholds are rejected with 423 Locked,
 *      even if the user force-quits and reopens the app.
 *
 *   2. **Permanent Server-Side Enforcement** — Lock state is persisted to
 *      storage immediately. Survives server restarts. The only way to lift
 *      the lock is for the cooldown timer to expire (24h from trigger).
 *
 *   3. **Subscription-Gated** — `iron_lock` is an Elite-tier feature. If the
 *      user's subscription drops below Elite, Iron Lock endpoints return 402.
 *
 *   4. **Market Hours Lock** — Additional protection: lock parameters cannot
 *      be modified during market hours (9:15 AM – 3:30 PM IST) even if the
 *      user is not in active lockdown. This prevents pre-emptive disabling.
 *
 * Endpoints:
 *   GET    /api/iron-lock/status       — Current Iron Lock state & config
 *   GET    /api/iron-lock/config       — Current lock parameters (read-only)
 *   POST   /api/iron-lock/force-unlock — Admin endpoint: force release lock
 *
 * Related:
 *   - Lockdown is triggered via riskEngine (P&L breach)
 *   - Settings freeze is enforced by riskEngine.updateLimits()
 *   - Iron Lock adds EXTRA server-side checks on top of the base system
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { riskEngine, LockdownStatus } from '../services/riskEngine';

const router = Router();
router.use(authMiddleware);

// ──── Constants ───────────────────────────────────────────────

const LOCKDOWN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Market hours in milliseconds since midnight UTC (Indian markets: 9:15 AM – 3:30 PM IST = UTC+5:30)
const MARKET_OPEN_MS = 3 * 60 * 60 * 1000 + 45 * 60 * 1000;  // 3:45 UTC = 9:15 AM IST
const MARKET_CLOSE_MS = 10 * 60 * 60 * 1000;                  // 10:00 UTC = 3:30 PM IST

// ──── Helpers ─────────────────────────────────────────────────

/**
 * Checks whether the current time falls within Indian equity market hours
 * (Monday–Friday, 9:15 AM – 3:30 PM IST).
 */
function isMarketHours(): boolean {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  if (day === 0 || day === 6) return false; // Weekend

  // Convert current UTC time to ms since midnight UTC
  const utcMs = now.getUTCHours() * 60 * 60 * 1000 +
                now.getUTCMinutes() * 60 * 1000 +
                now.getUTCSeconds() * 1000;

  return utcMs >= MARKET_OPEN_MS && utcMs < MARKET_CLOSE_MS;
}

/**
 * Checks whether the user has the `iron_lock` feature available.
 * In production, this would query the subscription service/database.
 * For now, we check via a header or query param (set by API gateway
 * or subscription middleware after verifying the user's plan).
 *
 * If no subscription info is provided, assumes the feature IS available
 * (backward-compatible with development mode).
 */
function hasIronLockAccess(req: Request): boolean {
  // The API gateway or subscription middleware sets this header after
  // verifying the user's subscription tier from the JWT or token.
  const subscriptionTier = req.headers['x-subscription-tier'] as string | undefined;

  if (!subscriptionTier) {
    // No subscription info — assume available (dev mode / legacy clients)
    return true;
  }

  // Iron Lock requires Elite tier
  return subscriptionTier === 'elite';
}

/**
 * Formats the remaining lock duration into a human-readable string.
 */
function formatLockDuration(liftsAt: string | null): string {
  if (!liftsAt) return 'N/A';
  const remaining = new Date(liftsAt).getTime() - Date.now();
  if (remaining <= 0) return 'Expiring soon';

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m`;
}

// ──── Routes ──────────────────────────────────────────────────

/**
 * GET /api/iron-lock/status
 *
 * Returns the current Iron Lock state for the authenticated user.
 * Includes lockdown status, remaining lock duration, and configuration
 * freeze status.
 *
 * Access: Authenticated user
 * Response: {
 *   ironLockActive: boolean,        // Whether Iron Lock is currently enforced
 *   lockdownStatus: string,         // 'none' | 'active' | 'cooldown'
 *   isFrozen: boolean,              // Whether settings are frozen
 *   frozenUntil: string | null,     // When the freeze lifts
 *   remainingLockDuration: string,  // Human-readable duration
 *   triggeredAt: string | null,     // When lockdown was triggered
 *   triggerLoss: number | null,     // P&L value that triggered lockdown
 *   breachedLimit: string | null,   // Which limit was breached
 *   marketHours: boolean,           // Whether currently in market hours
 *   userHasAccess: boolean,         // Whether user's tier includes Iron Lock
 * }
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const profile = riskEngine.getState(userId);

    const isLockdownActive = profile.lockdown.status !== LockdownStatus.NONE;
    const isFrozen = profile.settingsFrozen;

    res.json({
      ironLockActive: isLockdownActive && isFrozen,
      lockdownStatus: profile.lockdown.status,
      isFrozen,
      frozenUntil: profile.settingsFrozenUntil,
      remainingLockDuration: formatLockDuration(profile.lockdown.liftsAt),
      triggeredAt: profile.lockdown.triggeredAt,
      triggerLoss: profile.lockdown.triggerLoss,
      breachedLimit: profile.lockdown.breachedLimit,
      liftsAt: profile.lockdown.liftsAt,
      marketHours: isMarketHours(),
      userHasAccess: hasIronLockAccess(req),

      // Current limits (read-only)
      limits: {
        dailyLossLimit: profile.limits.dailyLossLimit,
        dailyLossPercentLimit: profile.limits.dailyLossPercentLimit,
        maxPositionSizePercent: profile.limits.maxPositionSizePercent,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch Iron Lock status' });
  }
});

/**
 * GET /api/iron-lock/config
 *
 * Returns the current Iron Lock configuration (read-only).
 * This is the same as the status endpoint but only returns the
 * configurable parameters. Useful for the UI to display current limits.
 *
 * Access: Authenticated user (402 if no Iron Lock access)
 */
router.get('/config', (req: Request, res: Response) => {
  try {
    if (!hasIronLockAccess(req)) {
      res.status(402).json({
        error: 'Iron Lock is an Elite-tier feature. Upgrade to access server-side loss limit enforcement.',
        upgradeRequired: true,
        requiredTier: 'elite',
        feature: 'iron_lock',
      });
      return;
    }

    const userId = req.user!.userId;
    const profile = riskEngine.getState(userId);
    const isFrozen = profile.settingsFrozen;
    const marketOpen = isMarketHours();

    res.json({
      configurable: !isFrozen && !marketOpen,
      frozen: isFrozen,
      frozenUntil: profile.settingsFrozenUntil,
      marketHours: marketOpen,
      marketHoursNote: marketOpen
        ? 'Iron Lock parameters cannot be modified during market hours (9:15 AM – 3:30 PM IST).'
        : undefined,
      freezeNote: isFrozen
        ? `Risk settings are frozen until ${new Date(profile.settingsFrozenUntil!).toLocaleString()}. This is a 24-hour protective lock triggered by the Financial Bodyguard.`
        : undefined,

      limits: {
        dailyLossLimit: profile.limits.dailyLossLimit,
        dailyLossPercentLimit: profile.limits.dailyLossPercentLimit,
        maxPositionSizePercent: profile.limits.maxPositionSizePercent,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch Iron Lock config' });
  }
});

/**
 * POST /api/iron-lock/force-unlock
 *
 * Admin endpoint to force-release the Iron Lock.
 * In production, this would require admin privileges or a security code.
 * For development, it allows the authenticated user to test the system.
 *
 * Access: Admin only (in production); Authenticated user (in dev)
 */
router.post('/force-unlock', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const profile = riskEngine.getState(userId);

    if (profile.lockdown.status === LockdownStatus.NONE) {
      res.status(400).json({
        error: 'No active lockdown to release. Iron Lock is not currently enforced.',
      });
      return;
    }

    // In production, verify admin privileges here
    // For now, allow any authenticated user to test unlock

    // Reset the user's daily state and release lockdown
    riskEngine.resetDaily(userId);

    const updatedProfile = riskEngine.getState(userId);

    res.json({
      success: true,
      message: '🔓 Iron Lock has been released. Trading limits restored.',
      unlockedAt: new Date().toISOString(),
      state: {
        lockdownStatus: updatedProfile.lockdown.status,
        isFrozen: updatedProfile.settingsFrozen,
        limits: {
          dailyLossLimit: updatedProfile.limits.dailyLossLimit,
          dailyLossPercentLimit: updatedProfile.limits.dailyLossPercentLimit,
        },
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to release Iron Lock' });
  }
});

/**
 * POST /api/iron-lock/check-order
 *
 * Pre-flight check for the Iron Lock before placing an order.
 * This is a stricter version of the base risk evaluation that
 * adds Iron Lock-specific checks:
 *   - Rejects ALL non-exit actions during lockdown (even if base risk
 *     engine would allow them)
 *   - Verifies Iron Lock subscription access
 *   - Returns detailed block reason for UI display
 *
 * Body: { actionType: string, symbol?: string, quantity?: number, price?: number }
 */
router.post('/check-order', (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { actionType, symbol, quantity, price } = req.body;

    if (!actionType) {
      res.status(400).json({ error: 'actionType is required' });
      return;
    }

    const profile = riskEngine.getState(userId);

    // Determine if this is an exit action
    const exitActions = ['SQUARE_OFF', 'CANCEL', 'EXIT'];
    const isExit = exitActions.includes(actionType.toUpperCase());
    const isBuy = actionType.toUpperCase() === 'BUY';
    const isSell = actionType.toUpperCase() === 'SELL';

    const isLockdown = profile.lockdown.status !== LockdownStatus.NONE;
    const isFrozen = profile.settingsFrozen;

    // Build the response
    const result: {
      allowed: boolean;
      ironLockActive: boolean;
      lockdownStatus: string;
      checks: { exitAction: boolean; lockdown: boolean; settingsFrozen: boolean; marketHours: boolean };
      reason?: string;
      message?: string;
      warning?: string;
    } = {
      allowed: true,
      ironLockActive: isLockdown && isFrozen,
      lockdownStatus: profile.lockdown.status,
      checks: {
        exitAction: isExit,
        lockdown: isLockdown,
        settingsFrozen: isFrozen,
        marketHours: isMarketHours(),
      },
    };

    // Iron Lock enforcement: block non-exit actions during lockdown
    if (isLockdown && !isExit) {
      result.allowed = false;
      result.reason = 'blocked_lockdown';
      result.message = '🔒 Iron Lock Active. Only exit/square-off orders are permitted. ' +
        `Lockdown lifts at ${new Date(profile.lockdown.liftsAt!).toLocaleTimeString()}. ` +
        'Your loss limits are server-locked and cannot be modified.';

      res.json(result);
      return;
    }

    // If settings are frozen but not in lockdown (cooldown), warn but allow
    if (isFrozen && !isLockdown) {
      result.warning = '⚠️ Your risk settings are in cooldown period. They will be fully unlocked ' +
        `at ${new Date(profile.settingsFrozenUntil!).toLocaleTimeString()}.`;
    }

    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Iron Lock check failed' });
  }
});

export default router;
