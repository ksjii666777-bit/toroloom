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
 * WEBHOOK ENDPOINT:
 *   Mounted at POST /api/payments/webhook with express.raw() body parser
 *   (see server.ts — mounted BEFORE express.json() for raw body access).
 *
 * IDEMPOTENCY:
 *   Processed event IDs are tracked in storage to handle Razorpay's
 *   at-least-once delivery guarantee safely.
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { getStorage } from '../services/storage';
import type { UserSubscriptionData } from '../services/storage/types';

// ──── Unauthenticated router for webhooks (no authMiddleware) ──────────────
// Note: This router is mounted at /api/payments/webhook with express.raw()
// in server.ts, so req.body is a Buffer (not parsed JSON).

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
  // Idempotency: track processed webhook event IDs
  markEventProcessed?(eventId: string): Promise<void>;
  isEventProcessed?(eventId: string): Promise<boolean>;
} | null = null;

/**
 * Configure the subscription module with the storage engine.
 * Called during server initialization.
 */
export function configureSubscriptionPersistence(storage: {
  loadSubscription(userId: string): Promise<UserSubscriptionData | null>;
  saveSubscription(userId: string, sub: UserSubscriptionData): Promise<void>;
  markEventProcessed?(eventId: string): Promise<void>;
  isEventProcessed?(eventId: string): Promise<boolean>;
}): void {
  _subscriptionStore = storage;
}

/**
 * Set the Razorpay webhook secret.
 */
export function setWebhookSecret(secret: string): void {
  _webhookSecret = secret;
}

// ──── In-memory idempotency fallback (used when storage doesn't support it) ─

const processedEvents = new Set<string>();
const PROCESSED_EVENT_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if an event has already been processed.
 * Uses storage if available, falls back to in-memory Set.
 */
async function isDuplicateEvent(eventId: string): Promise<boolean> {
  if (_subscriptionStore?.isEventProcessed) {
    return _subscriptionStore.isEventProcessed(eventId);
  }
  return processedEvents.has(eventId);
}

/**
 * Mark an event as processed.
 * Uses storage if available, falls back to in-memory Set.
 */
async function markEventProcessed(eventId: string): Promise<void> {
  if (_subscriptionStore?.markEventProcessed) {
    await _subscriptionStore.markEventProcessed(eventId);
  }
  processedEvents.add(eventId);
  // Auto-evict after TTL to prevent memory leak
  setTimeout(() => processedEvents.delete(eventId), PROCESSED_EVENT_TTL);
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    console.error('[Subscriptions] /cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// ──── POST /api/payments/webhook ──────────────────────────────────────
// Razorpay webhook — on webhookRouter (no authMiddleware, verified via webhook secret)
// Mounted at /api/payments/webhook in server.ts with express.raw() body parser.
// req.body is a Buffer — we parse it to JSON manually for signature verification.

// Supported Razorpay events:
//   payment.captured          — One-time payment completed
//   order.paid                — Order marked as paid
//   subscription.charged      — Recurring billing charged successfully
//   subscription.activated    — Subscription activated (after first payment)

webhookRouter.post('/', async (req: Request, res: Response) => {
  try {
    // ── Extract raw body and parse ──────────────────────────────────────
    // req.body is a Buffer from express.raw() middleware
    const rawBody: Buffer = req.body as Buffer;
    if (!rawBody || rawBody.length === 0) {
      res.status(400).json({ error: 'Empty request body' });
      return;
    }

    const rawBodyString = rawBody.toString('utf8');

    // ── Verify webhook signature ────────────────────────────────────────
    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature || !_webhookSecret) {
      console.warn('[Webhook] Missing signature or webhook secret not configured');
      res.status(400).json({ error: 'Missing or invalid webhook signature' });
      return;
    }

    const expectedSignature = crypto
      .createHmac('sha256', _webhookSecret)
      .update(rawBodyString)
      .digest('hex');

    if (signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature),
      )) {
      console.warn('[Webhook] Invalid signature — possible spoof attempt');
      res.status(400).json({ error: 'Invalid webhook signature' });
      return;
    }

    // ── Parse the JSON body ─────────────────────────────────────────────
    let body: any;
    try {
      body = JSON.parse(rawBodyString);
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    const event: string = body.event;
    const eventId: string = body.event_id || body.id || req.headers['x-razorpay-event-id'] as string || '';

    // ── Idempotency check ───────────────────────────────────────────────
    if (eventId && await isDuplicateEvent(eventId)) {
      console.log(`[Webhook] Duplicate event ${eventId} (${event}) — skipped`);
      res.json({ success: true, duplicate: true });
      return;
    }

    const payment = body.payload?.payment?.entity;
    const order = body.payload?.order?.entity;
    const subscriptionEntity = body.payload?.subscription?.entity;

    console.log(`[Webhook] Received: ${event} (id: ${eventId?.substring(0, 20)}...)`);

    // ── Extract notes from payment or order (order notes may be used) ───
    const notes = payment?.notes || order?.notes || {};
    const userId: string | undefined = notes.userId;
    const planId: string | undefined = notes.planId;
    const billingPeriod: string = notes.billingPeriod || 'monthly';

    // ── Process the event ───────────────────────────────────────────────
    let processed = false;

    if (event === 'payment.captured' && userId && planId && PLANS[planId]) {
      processed = await handlePaymentCaptured(userId, planId, billingPeriod, payment, order, notes);
    } else if (event === 'order.paid' && order) {
      // order.paid may arrive before payment.captured — check notes
      if (notes.type === 'subscription' && userId && planId && PLANS[planId]) {
        processed = await handlePaymentCaptured(userId, planId, billingPeriod, payment, order, notes);
      } else if (notes.type === 'fund_add' && userId) {
        console.log(`[Webhook] Fund add order paid: user=${userId}, order=${order.id}`);
        processed = true;
      }
    } else if (event === 'subscription.charged' && subscriptionEntity && userId) {
      console.log(`[Webhook] Subscription charged: ${subscriptionEntity.id}, user=${userId}`);
      processed = true;
    } else if (event === 'subscription.activated' && subscriptionEntity && userId) {
      console.log(`[Webhook] Subscription activated: ${subscriptionEntity.id}, user=${userId}`);
      processed = true;
    } else if (event === 'subscription.cancelled' && subscriptionEntity && userId) {
      console.log(`[Webhook] Subscription cancelled: ${subscriptionEntity.id}, user=${userId}`);
      processed = true;
    }

    // ── Mark event as processed ─────────────────────────────────────────
    if (eventId) {
      await markEventProcessed(eventId);
    }

    // Acknowledge receipt (Razorpay expects 200 within 5 seconds)
    res.json({ success: true, processed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('[Webhook] Error:', msg);
    // Return 200 for signature verification failures since we handled them above
    // This catches unexpected errors and Razorpay will retry
    res.status(500).json({ error: msg });
  }
});

// ──── Helper: handle payment captured event ─────────────────────────────────

async function handlePaymentCaptured(
  userId: string,
  planId: string,
  billingPeriod: string,
  payment: any,
  order: any,
  notes: any,
): Promise<boolean> {
  const plan = PLANS[planId];
  if (!plan) return false;

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
    razorpayOrderId: order?.id || payment?.order_id || undefined,
    razorpayPaymentId: payment?.id || undefined,
    lastPaymentDate: now.toISOString(),
    tenantId: notes.tenantId || undefined,
    updatedAt: now.toISOString(),
  };

  if (_subscriptionStore) {
    await _subscriptionStore.saveSubscription(userId, subscription);
  }

  console.log(`[Webhook] ✅ User ${userId} → ${plan.tier} (${planId}), ` +
    `payment: ${payment?.id}, order: ${order?.id}`);

  return true;
}

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
  } catch (error: unknown) {
    console.error('[Subscriptions] /check-feature error:', error);
    res.status(500).json({ error: 'Failed to check feature access' });
  }
});

export default router;
export { webhookRouter };
