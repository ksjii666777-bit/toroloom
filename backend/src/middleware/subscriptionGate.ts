/**
 * ============================================================================
 * Toroloom — Subscription Gating Middleware
 * ============================================================================
 *
 * Per-route subscription tier enforcement.  Use the factory function to
 * create middleware that checks the authenticated user's subscription tier
 * against the minimum required for a given route group.
 *
 * Usage (in server.ts):
 *
 *   import { requireSubscription } from './middleware/subscriptionGate';
 *
 *   // Gate AI endpoints — Pro tier required
 *   app.use('/api/ai', readLimiter, requireSubscription('pro'), aiInsightsRoutes);
 *
 *   // Gate Iron Lock — Elite tier required
 *   app.use('/api/iron-lock', writeLimiter, requireSubscription('elite'), ironLockRoutes);
 *
 * Behaviour:
 *   - If SUBSCRIPTION_GATING_ENABLED !== 'true' in env, ALL requests pass
 *     through (no gating).  This allows development and testing without
 *     a subscription service.
 *   - If the user is not authenticated (no req.user), the request is
 *     rejected with 401 — this middleware MUST be placed after authMiddleware.
 *   - If the user's tier meets or exceeds the requirement, the request
 *     proceeds and the `x-subscription-tier` response header is set for
 *     downstream middleware / route handlers.
 *   - If the user's tier is insufficient, returns 402 Payment Required.
 *
 * Tier ranking (low to high):
 *   free  (0)  →  pro  (1)  →  elite (2)
 *
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { TIER_RANK } from '../routes/subscriptions';
import type { UserSubscriptionData } from '../services/storage/types';

// ──── Tier Ranking (imported from subscriptions.ts) ─────────────────────────
// TIER_RANK is defined in subscriptions.ts and reused here to avoid drift.

export type SubscriptionTier = keyof typeof TIER_RANK;

// ──── Storage reference (set at startup via configureSubscriptionGating) ─────

let _subscriptionStore: {
  loadSubscription(userId: string): Promise<UserSubscriptionData | null>;
} | null = null;

/**
 * Configure the subscription gate with a storage engine.
 * Called during server initialization so the middleware can load
 * subscription data at runtime.
 */
export function configureSubscriptionGating(storage: {
  loadSubscription(userId: string): Promise<UserSubscriptionData | null>;
}): void {
  _subscriptionStore = storage;
}

/**
 * Reset the storage reference (for testing).
 */
export function resetSubscriptionGating(): void {
  _subscriptionStore = null;
}

// ──── Middleware Factory ───────────────────────────────────────────────────

/**
 * Create Express middleware that requires the authenticated user to have
 * at least the specified subscription tier.
 *
 * @param minTier — The minimum subscription tier required ('free' | 'pro' | 'elite')
 * @returns Express middleware function
 *
 * @example
 *   // Protect AI insight endpoints (Pro required)
 *   router.use(requireSubscription('pro'));
 */
export function requireSubscription(minTier: SubscriptionTier) {
  const minRank = TIER_RANK[minTier];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // ── Feature flag — skip gating when disabled ────────────────────
    if (!env.subscriptionGatingEnabled) {
      next();
      return;
    }

    // ── Auth check — must be after authMiddleware ───────────────────
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required for subscription gating',
        code: 'AUTH_REQUIRED',
      });
      return;
    }

    // ── Free tier is always allowed ────────────────────────────────
    // No need to load subscription if the route is free for everyone.
    if (minRank <= TIER_RANK.free) {
      next();
      return;
    }

    // ── Load subscription from storage ─────────────────────────────
    let userTier: SubscriptionTier = 'free';

    if (_subscriptionStore) {
      try {
        const subscription = await _subscriptionStore.loadSubscription(req.user.userId);
        if (subscription && subscription.status === 'active') {
          userTier = subscription.tier;
        }
      } catch {
        // Storage unavailable — fall back to free tier (conservative)
        console.warn('[SubscriptionGate] Storage unavailable, falling back to free tier');
      }
    }

    // ── Set response header for downstream use (e.g., ironLock.ts) ──
    res.setHeader('x-subscription-tier', userTier);

    // ── Check tier ─────────────────────────────────────────────────
    const userRank = TIER_RANK[userTier];
    if (userRank >= minRank) {
      next();
      return;
    }

    // ── Insufficient tier — return 402 Payment Required ────────────
    res.status(402).json({
      error: `This feature requires a ${minTier} subscription. Please upgrade to access it.`,
      code: 'SUBSCRIPTION_REQUIRED',
      requiredTier: minTier,
      currentTier: userTier,
      upgradeUrl: `/api/subscriptions/upgrade`,
    });
  };
}
