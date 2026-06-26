/**
 * ============================================================================
 * Toroloom Subscription Routes — Tier Management
 * ============================================================================
 *
 * Manages the Free / Pro / Elite subscription lifecycle:
 *
 *   GET  /api/subscriptions/current   — Get the current user's subscription
 *   POST /api/subscriptions/upgrade   — Record a plan upgrade (called after payment)
 *   POST /api/subscriptions/cancel    — Cancel auto-renewal
 *   POST /api/subscriptions/webhook   — Razorpay webhook (payment.captured, subscription.*)
 *
 * Storage:
 *   Subscriptions are persisted via the StorageEngine (InMemory / Postgres / MongoDB).
 *   The storage is wired into this module at server startup.
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { getStorage } from '../services/storage';
import type { UserSubscriptionData } from '../services/storage/types';

// ──── Unauthenticated router for webhooks (no authMiddleware) ──────────────

const webhookRouter = Router();

const router = Router();
router.use(authMiddleware);

// ──── Shared tier ranking ──────────────────────────────────────────────────

export const TIER_RANK: Record<string, number> = {
  free: 0,
  pro: 1,
  elite: 2,
};

export const FEATURE_TIER_MAP: Record<string, 'free' | 'pro' | 'elite'> = {
  basic_portfolio: 'free',
  unlimited_watchlist: 'pro',
  advanced_analytics: 'pro',
  ai_insights: 'pro',
  ai_companion: 'pro',
  iron_lock: 'elite',
  real_time_data: 'elite',
  social_trading: 'elite',
  full_education: 'pro',
  tax_reports: 'elite',
  api_access: 'elite',
  ad_free: 'pro',
  priority_support: 'pro',
  dedicated_manager: 'elite',
  behavioural_journal: 'elite',
};

// ──── In-memory webhook helper (set at startup) ─────────────────────────────

let _webhookSecret = '';
let _subscriptionStore: {
  loadSubscription(userId: string): Promise<UserSubscriptionData | null>;
  saveSubscription(userId: string, sub: UserSubscriptionData): Promise<void>;
} | null = null;

/**
 * Configure the subscription module with the storage engine.
 * Called during server initialization.
 */
export function configureSubscriptionPersistence(storage: {
  loadSubscription(userId: string): Promise<UserSubscriptionData | null>;
  saveSubscription(userId: string, sub: UserSubscriptionData): Promise<void>;
}): void {
  _subscriptionStore = storage;
}

/**
 * Set the Razorpay webhook secret.
 */
export function setWebhookSecret(secret: string): void {
  _webhookSecret = secret;
}

// ──── Plan definitions (mirrors frontend SUBSCRIPTION_PLANS) ────────────────

const PLANS: Record<string, { tier: 'free' | 'pro' | 'elite'; monthly: number; yearly: number }> = {
  plan_free:  { tier: 'free',  monthly: 0,     yearly: 0 },
  plan_pro:   { tier: 'pro',   monthly: 399,   yearly: 3999 },
  plan_elite: { tier: 'elite', monthly: 999,   yearly: 9999 },
};

// ──── GET /api/subscriptions/current ──────────────────────────────────────

router.get('/current', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Try storage first, fall back to default free subscription
    let subscription: UserSubscriptionData | null = null;
    if (_subscriptionStore) {
      subscription = await _subscriptionStore.loadSubscription(userId);
    }

    if (!subscription) {
      // Return default free subscription
      res.json({
        tier: 'free',
        planId: 'plan_free',
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        autoRenew: false,
        tenantId: undefined,
      });
      return;
    }

    res.json(subscription);
  } catch (error: any) {
    console.error('[Subscriptions] /current error:', error);
    res.status(500).json({ error: 'Failed to load subscription' });
  }
});

// ──── POST /api/subscriptions/upgrade ─────────────────────────────────────

router.post('/upgrade', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { planId, billingPeriod = 'monthly', razorpayPaymentId, razorpayOrderId, tenantId } = req.body;

    const plan = PLANS[planId];
    if (!plan) {
      res.status(400).json({ error: `Invalid plan ID: ${planId}` });
      return;
    }

    if (plan.tier === 'free') {
      res.status(400).json({ error: 'Cannot upgrade to Free plan' });
      return;
    }

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + (billingPeriod === 'yearly' ? 365 : 30));

    const subscription: UserSubscriptionData = {
      userId,
      tier: plan.tier,
      planId,
      status: 'active',
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      autoRenew: billingPeriod === 'yearly',
      paymentMethod: 'razorpay',
      razorpayOrderId: razorpayOrderId || undefined,
      lastPaymentDate: now.toISOString(),
      tenantId: tenantId || undefined,
      updatedAt: now.toISOString(),
    };

    if (_subscriptionStore) {
      await _subscriptionStore.saveSubscription(userId, subscription);
    }

    console.log(`[Subscriptions] User ${userId} upgraded to ${plan.tier} (${planId})`);

    res.json({
      success: true,
      subscription,
      message: `Successfully upgraded to ${plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1)} plan!`,
    });
  } catch (error: any) {
    console.error('[Subscriptions] /upgrade error:', error);
    res.status(500).json({ error: 'Failed to process upgrade' });
  }
});

// ──── POST /api/subscriptions/cancel ─────────────────────────────────────

router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    let subscription: UserSubscriptionData | null = null;
    if (_subscriptionStore) {
      subscription = await _subscriptionStore.loadSubscription(userId);
    }

    if (!subscription) {
      res.status(404).json({ error: 'No active subscription found' });
      return;
    }

    subscription.autoRenew = false;
    subscription.status = 'cancelled';
    subscription.updatedAt = new Date().toISOString();

    if (_subscriptionStore) {
      await _subscriptionStore.saveSubscription(userId, subscription);
    }

    console.log(`[Subscriptions] User ${userId} cancelled auto-renewal`);

    res.json({
      success: true,
      subscription,
      message: 'Auto-renewal cancelled. Your premium features remain active until the end of the billing period.',
    });
  } catch (error: any) {
    console.error('[Subscriptions] /cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// ──── POST /api/subscriptions/webhook ──────────────────────────────────
// Razorpay webhook — on webhookRouter (no authMiddleware, verified via webhook secret)

webhookRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature || !_webhookSecret) {
      res.status(400).json({ error: 'Missing or invalid webhook signature' });
      return;
    }

    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', _webhookSecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      res.status(400).json({ error: 'Invalid webhook signature' });
      return;
    }

    const event = req.body.event;
    const payment = req.body.payload?.payment?.entity;
    const order = req.body.payload?.order?.entity;

    console.log(`[Subscriptions] Webhook received: ${event}`);

    // Handle payment captured events
    if (event === 'payment.captured' && payment) {
      const notes = payment.notes || {};
      const userId = notes.userId;
      const planId = notes.planId;
      const billingPeriod = notes.billingPeriod || 'monthly';

      if (userId && planId && PLANS[planId]) {
        const plan = PLANS[planId];
        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + (billingPeriod === 'yearly' ? 365 : 30));

        const subscription: UserSubscriptionData = {
          userId,
          tier: plan.tier,
          planId,
          status: 'active',
          startDate: now.toISOString(),
          endDate: endDate.toISOString(),
          autoRenew: billingPeriod === 'yearly',
          paymentMethod: 'razorpay',
          razorpayOrderId: order?.id || payment.order_id,
          lastPaymentDate: now.toISOString(),
          tenantId: notes.tenantId || undefined,
          updatedAt: now.toISOString(),
        };

        if (_subscriptionStore) {
          await _subscriptionStore.saveSubscription(userId, subscription);
        }

        console.log(`[Subscriptions] Webhook: User ${userId} subscribed to ${plan.tier}`);
      }
    }

    // Acknowledge receipt (Razorpay expects 200 within 5s)
    res.json({ status: 'ok' });
  } catch (error: any) {
    console.error('[Subscriptions] webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ──── POST /api/subscriptions/check-feature ─────────────────────────────

router.post('/check-feature', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { feature } = req.body;

    if (!feature) {
      res.status(400).json({ error: 'Feature name is required' });
      return;
    }

    const minTier = FEATURE_TIER_MAP[feature] || 'free';

    let subscription: UserSubscriptionData | null = null;
    if (_subscriptionStore) {
      subscription = await _subscriptionStore.loadSubscription(userId);
    }

    const userTier = subscription?.tier || 'free';
    const hasAccess = TIER_RANK[userTier] >= TIER_RANK[minTier];

    res.json({
      feature,
      userTier,
      minTier,
      hasAccess,
      subscription: subscription || {
        tier: 'free',
        planId: 'plan_free',
        status: 'active',
      },
    });
  } catch (error: any) {
    console.error('[Subscriptions] /check-feature error:', error);
    res.status(500).json({ error: 'Failed to check feature access' });
  }
});

export default router;
export { webhookRouter };
