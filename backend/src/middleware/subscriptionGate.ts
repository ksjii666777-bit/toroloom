/**
 * ============================================================================
 * Toroloom — Subscription Feature Gate Middleware
 * ============================================================================
 *
 * Express middleware that enforces subscription tier requirements on a
 * per-route or per-router basis.
 *
 * Usage:
 *   import { requireTier } from '../middleware/subscriptionGate';
 *
 *   // Only Elite users can access Iron Lock endpoints
 *   router.use('/api/iron-lock', requireTier('elite'), ironLockRoutes);
 *
 *   // Pro+ users can access AI insights
 *   router.get('/api/ai/insights', requireTier('pro'), aiHandler);
 *
 * Behavior:
 *   - Reads the user's tier from the in-memory store (populated at login)
 *   - Falls back to querying the subscription backend on first access
 *   - Returns 402 Payment Required with upgrade prompt if tier is insufficient
 *   - Attaches `req.subscription` for downstream handlers
 *
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { getStorageIfInitialized } from '../services/storage';
import type { UserSubscriptionData } from '../services/storage/types';

// ──── Tier ranking ─────────────────────────────────────────────────────────

const TIER_RANK: Record<string, number> = {
  free: 0,
  pro: 1,
  elite: 2,
};

// ──── In-memory tier cache (per-request, populated by this middleware) ─────

declare global {
  namespace Express {
    interface Request {
      /** The user's resolved subscription, populated by requireTier middleware. */
      subscription?: UserSubscriptionData;
    }
  }
}

// ──── Default free subscription ─────────────────────────────────────────────

function defaultFreeSubscription(userId: string): UserSubscriptionData {
  return {
    userId,
    tier: 'free',
    planId: 'plan_free',
    status: 'active',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    autoRenew: false,
    updatedAt: new Date().toISOString(),
  };
}

// ──── Resolve user subscription ────────────────────────────────────────────

async function resolveSubscription(userId: string): Promise<UserSubscriptionData> {
  const storage = getStorageIfInitialized();
  if (!storage) return defaultFreeSubscription(userId);

  try {
    const sub = await storage.loadSubscription(userId);
    return sub ?? defaultFreeSubscription(userId);
  } catch {
    return defaultFreeSubscription(userId);
  }
}

// ──── Middleware Factory ────────────────────────────────────────────────────

/**
 * Creates an Express middleware that requires the user to have at least the
 * specified subscription tier to access the route.
 *
 * @param minTier - The minimum required tier ('pro' or 'elite')
 * @returns Express middleware function
 */
export function requireTier(minTier: 'pro' | 'elite') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const subscription = await resolveSubscription(req.user.userId);
    req.subscription = subscription;

    const userRank = TIER_RANK[subscription.tier] ?? 0;
    const requiredRank = TIER_RANK[minTier];

    if (userRank >= requiredRank) {
      next();
      return;
    }

    // Determine which plan to suggest for upgrade
    const upgradePlanId = minTier === 'elite' ? 'plan_elite' : 'plan_pro';
    const upgradePlanName = minTier === 'elite' ? 'Elite' : 'Pro';

    res.status(402).json({
      error: `This feature requires the ${upgradePlanName} plan or higher`,
      code: 'INSUFFICIENT_TIER',
      currentTier: subscription.tier,
      requiredTier: minTier,
      upgradePlanId,
      upgradeUrl: `/api/payments/create-order`,
      message: `Upgrade to ${upgradePlanName} (₹${minTier === 'elite' ? '999' : '399'}/mo) to access this feature.`,
    });
  };
}

/**
 * Middleware that attaches the user's subscription info to the request
 * without blocking access. Useful for routes that adapt behavior based
 * on tier (e.g., limited preview for free users).
 */
export function attachSubscription(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next();
    return;
  }

  resolveSubscription(req.user.userId)
    .then((sub) => {
      req.subscription = sub;
      next();
    })
    .catch(() => {
      next();
    });
}
