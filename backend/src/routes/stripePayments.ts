/**
 * ============================================================================
 * Toroloom Stripe Payments Routes — US/EU Checkout
 * ============================================================================
 *
 * International counterpart of payments.ts (Razorpay/India). Same subscription
 * records (UserSubscriptionData via the shared persistence accessor), same
 * tier semantics, different rail:
 *
 *   POST /api/payments/stripe/checkout-session  — create a Stripe Checkout
 *                                                 Session, return { url }
 *   POST /api/payments/stripe/portal-session    — create a Billing Portal
 *                                                 Session, return { url }
 *   POST /api/payments/webhook/stripe           — raw-body webhook
 *                                                 (mounted in server.ts with
 *                                                 express.raw(), BEFORE
 *                                                 express.json())
 *
 * Webhook events handled:
 *   checkout.session.completed        → provision tier (metadata carries
 *                                       userId/planId/billingPeriod/region)
 *   invoice.paid                      → renewal: extend endDate, clear dunning
 *   invoice.payment_failed            → dunning: failure count + grace period
 *   customer.subscription.deleted     → downgrade to free
 *   customer.subscription.updated     → cancel_at_period_end / plan sync
 *
 * Grace/dunning writes reuse the payment-failure fields that already exist on
 * UserSubscriptionData (paymentFailureCount, gracePeriodEndDate, ...), so the
 * paywall middleware (subscriptionGate) needs zero changes.
 *
 * Idempotency: Stripe delivers at-least-once. Events are deduped by id via
 * the SAME markEventProcessed/isDuplicateEvent helpers the Razorpay webhook
 * uses, and logged through the same webhookHealth monitor.
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../config/env';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { stripeCheckoutSessionSchema, stripePortalSessionSchema } from '../schemas/payments';
import {
  PLANS,
  getSubscriptionPersistence,
  isDuplicateEvent,
  markEventProcessed,
} from './subscriptions';
import { logWebhookEvent } from './webhookHealth';
import type { UserSubscriptionData } from '../services/storage/types';

// ──── Client ─────────────────────────────────────────────────────────────────

let _stripe: Stripe | null = null;

/** Lazily-constructed Stripe client; null when keys are not configured.
 *  An injected client (test seam) takes precedence over the env check. */
export function getStripe(): Stripe | null {
  if (_stripe) return _stripe;
  if (!env.stripeSecretKey) return null;
  _stripe = new Stripe(env.stripeSecretKey);
  return _stripe;
}

/** Test seam — inject a mock client. Returns a restore function. */
export function setStripeClient(client: Stripe | null): () => void {
  const prev = _stripe;
  _stripe = client;
  return () => { _stripe = prev; };
}

/** Test seam — webhook secret override (production reads env). */
let _webhookSecretOverride: string | null = null;
export function setStripeWebhookSecret(secret: string | null): void {
  _webhookSecretOverride = secret;
}
function getWebhookSecret(): string {
  return _webhookSecretOverride ?? env.stripeWebhookSecret;
}

// ──── Price resolution ───────────────────────────────────────────────────────

export const STRIPE_LOOKUP_KEYS: Record<string, Record<string, Record<string, string>>> = {
  plan_pro: {
    us: { monthly: 'pro_us_monthly', yearly: 'pro_us_yearly' },
    eu: { monthly: 'pro_eu_monthly', yearly: 'pro_eu_yearly' },
  },
  plan_elite: {
    us: { monthly: 'elite_us_monthly', yearly: 'elite_us_yearly' },
    eu: { monthly: 'elite_eu_monthly', yearly: 'elite_eu_yearly' },
  },
};

// Currency lives on the Stripe Price itself (looked up by lookup_key), so no
// client-side currency map is needed — keeping one here would drift from the
// dashboard configuration.
const REGION_CURRENCY_UNUSED: Record<string, string> = { us: 'usd', eu: 'eur' };
void REGION_CURRENCY_UNUSED;

// ──── Authed routes ──────────────────────────────────────────────────────────

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/payments/stripe/checkout-session
 * body: { planId, billingPeriod, region }  (region: 'us' | 'eu')
 * → 201 { url }
 */
router.post('/checkout-session', validate(stripeCheckoutSessionSchema), async (req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: 'Stripe is not configured' });
      return;
    }

    const userId = req.user!.userId;
    const { planId, billingPeriod, region } = req.body as {
      planId: string; billingPeriod: 'monthly' | 'yearly'; region: 'us' | 'eu';
    };

    // NOTE: 'in' is rejected by the zod schema (stripeRegionEnum) — India
    // belongs to the Razorpay rail and never reaches this handler.

    const lookupKey = STRIPE_LOOKUP_KEYS[planId]?.[region]?.[billingPeriod];
    if (!lookupKey) {
      res.status(400).json({ error: `Invalid plan/region combination: ${planId}/${region}` });
      return;
    }

    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    const price = prices.data[0];
    if (!price) {
      res.status(500).json({ error: `No Stripe price configured for ${lookupKey}` });
      return;
    }

    const metadata = { userId, planId, billingPeriod, region };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: userId,
      metadata,
      subscription_data: { metadata }, // renewals carry the same identity
      success_url: `${env.appDeepLinkBase}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appDeepLinkBase}/subscription/cancelled`,
    });

    res.status(201).json({ url: session.url });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Checkout session failed';
    console.error('[Stripe] checkout-session error:', msg);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/payments/stripe/portal-session
 * → 201 { url } — Billing Portal (cancel / card update / invoices)
 */
router.post('/portal-session', validate(stripePortalSessionSchema), async (req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: 'Stripe is not configured' });
      return;
    }

    const userId = req.user!.userId;
    const store = getSubscriptionPersistence();
    const sub = store ? await store.loadSubscription(userId) : null;

    if (!sub?.stripeCustomerId) {
      res.status(404).json({ error: 'No Stripe billing profile found for this account' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${env.appDeepLinkBase}/subscription`,
    });

    res.status(201).json({ url: session.url });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Portal session failed';
    console.error('[Stripe] portal-session error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ──── Webhook ────────────────────────────────────────────────────────────────

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    // req.body is a Buffer from express.raw() mounted in server.ts
    const rawBody = req.body as Buffer;
    if (!rawBody || rawBody.length === 0) {
      res.status(400).json({ error: 'Empty request body' });
      return;
    }

    const signature = req.headers['stripe-signature'] as string;
    const secret = getWebhookSecret();
    if (!signature || !secret) {
      console.warn('[Stripe Webhook] Missing signature or webhook secret not configured');
      res.status(400).json({ error: 'Missing or invalid webhook signature' });
      return;
    }

    const stripe = getStripe();
    if (!stripe) {
      res.status(503).json({ error: 'Stripe is not configured' });
      return;
    }

    // Signature verification (timing-safe inside the SDK)
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err: unknown) {
      console.warn('[Stripe Webhook] Invalid signature — possible spoof attempt:',
        err instanceof Error ? err.message : err);
      res.status(400).json({ error: 'Invalid webhook signature' });
      return;
    }

    // ── Idempotency (shared with the Razorpay rail) ──────────────────────
    if (event.id && await isDuplicateEvent(event.id)) {
      console.log(`[Stripe Webhook] Duplicate event ${event.id} (${event.type}) — skipped`);
      res.json({ success: true, duplicate: true });
      return;
    }

    console.log(`[Stripe Webhook] Received: ${event.type} (id: ${event.id})`);

    // ── Process ──────────────────────────────────────────────────────────
    let processed = false;
    let processingError: string | undefined;

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          processed = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'invoice.paid':
          processed = await handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          processed = await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        case 'customer.subscription.deleted':
          processed = await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.updated':
          processed = await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        default:
          processed = false; // logged as 'received', ignored
      }
    } catch (err: unknown) {
      processingError = err instanceof Error ? err.message : 'Unknown processing error';
      console.error('[Stripe Webhook] Processing error:', processingError);
    }

    // ── Health log + idempotency mark (same shape as Razorpay rail) ──────
    const durationMs = Date.now() - startTime;
    logWebhookEvent({
      id: `st_${event.id || crypto.randomUUID()}`,
      event: event.type,
      eventId: event.id || 'unknown',
      userId: (event.data.object as { metadata?: { userId?: string } })?.metadata?.userId,
      planId: (event.data.object as { metadata?: { planId?: string } })?.metadata?.planId,
      status: processingError ? 'failed' : processed ? 'processed' : 'received',
      error: processingError,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    if (event.id && !processingError) {
      await markEventProcessed(event.id);
    }

    // Acknowledge quickly — Stripe retries non-2xx like Razorpay does
    res.json({ success: true, processed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Stripe webhook processing failed';
    console.error('[Stripe Webhook] Error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ──── Event handlers ─────────────────────────────────────────────────────────

type StripeMetadata = { userId?: string; planId?: string; billingPeriod?: string; region?: string };

function readMetadata(obj: { metadata?: StripeMetadata | null }): StripeMetadata {
  return obj.metadata ?? {};
}

function planIdToTier(planId: string): 'free' | 'pro' | 'elite' {
  return PLANS[planId]?.tier ?? 'free';
}

function periodEndDate(subscription: { current_period_end?: number | null }, fallbackDays: number): string {
  if (subscription.current_period_end) {
    return new Date(subscription.current_period_end * 1000).toISOString();
  }
  return new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000).toISOString();
}

/** checkout.session.completed — provision the tier from session metadata. */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<boolean> {
  const { userId, planId } = readMetadata(session);
  if (!userId || !planId || !PLANS[planId]) {
    console.warn('[Stripe Webhook] checkout.session.completed without usable metadata — skipped');
    return false;
  }

  const store = getSubscriptionPersistence();
  if (!store) return false;

  const now = new Date().toISOString();
  const subscription: UserSubscriptionData = {
    userId,
    tier: planIdToTier(planId),
    planId,
    status: 'active',
    startDate: now,
    // Checkout subscription mode → real period end when the API returns it
    endDate: periodEndDate(
      { current_period_end: (session as unknown as { current_period_end?: number | null }).current_period_end },
      (session.metadata?.billingPeriod === 'yearly' ? 365 : 30),
    ),
    autoRenew: true, // Stripe subscriptions renew by default
    paymentMethod: 'stripe',
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
    lastPaymentDate: now,
    updatedAt: now,
  };

  await store.saveSubscription(userId, subscription);
  console.log(`[Stripe Webhook] ✅ User ${userId} → ${subscription.tier} (${planId}) via checkout`);
  return true;
}

// ──── Invoice accessors (SDK v22 moved fields under `parent`) ───────────────

/** Invoice → subscription id. Handles legacy `invoice.subscription` AND the
 *  newer `invoice.parent.subscription_details.subscription` shapes. */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const legacy = (invoice as unknown as { subscription?: string | { id?: string } }).subscription;
  if (typeof legacy === 'string') return legacy;
  if (legacy && typeof legacy === 'object' && typeof legacy.id === 'string') return legacy.id;
  const nested = (invoice as unknown as {
    parent?: { subscription_details?: { subscription?: string | { id?: string } } };
  }).parent?.subscription_details?.subscription;
  if (typeof nested === 'string') return nested;
  if (nested && typeof nested === 'object' && typeof nested.id === 'string') return nested.id;
  return undefined;
}

/** Metadata echoed from the subscription at invoice time (newer API). */
function invoiceSubscriptionMetadata(invoice: Stripe.Invoice): StripeMetadata | undefined {
  return (invoice as unknown as { subscription_details?: { metadata?: StripeMetadata } })
    .subscription_details?.metadata;
}

/** End of the period this invoice covers — direct field or last line item. */
function invoicePeriodEnd(invoice: Stripe.Invoice): number | null {
  const direct = (invoice as unknown as { current_period_end?: number | null }).current_period_end;
  if (direct) return direct;
  const lines = invoice.lines?.data ?? [];
  return lines[lines.length - 1]?.period?.end ?? null;
}

/** invoice.paid — renewal: extend the period, clear dunning state. */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<boolean> {
  const store = getSubscriptionPersistence();
  if (!store) return false;

  if (!invoiceSubscriptionId(invoice)) return false;

  // Metadata is set on the subscription at checkout (subscription_data.metadata)
  // and echoed back on renewal events — that is the reliable user mapping.
  const userId = metadataUserId(invoice as unknown as HasMetadata)
    ?? metadataUserId({ metadata: invoiceSubscriptionMetadata(invoice) });
  if (!userId) return false;

  const sub = await store.loadSubscription(userId);
  if (!sub) return false;

  sub.status = 'active';
  sub.endDate = periodEndDate({ current_period_end: invoicePeriodEnd(invoice) }, 30);
  sub.lastPaymentDate = new Date().toISOString();
  sub.paymentFailureCount = 0;
  sub.gracePeriodEndDate = undefined;
  sub.lastPaymentFailureDate = undefined;
  sub.updatedAt = sub.lastPaymentDate;

  await store.saveSubscription(userId, sub);
  console.log(`[Stripe Webhook] ✅ Renewal: user ${userId} extended to ${sub.endDate}`);
  return true;
}

/** invoice.payment_failed — dunning: increment failures, grant grace period. */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<boolean> {
  const store = getSubscriptionPersistence();
  if (!store) return false;

  if (!invoiceSubscriptionId(invoice)) return false;

  const userId = metadataUserId(invoice as unknown as HasMetadata)
    ?? metadataUserId({ metadata: invoiceSubscriptionMetadata(invoice) });
  if (!userId) return false;

  const sub = await store.loadSubscription(userId);
  if (!sub) return false;

  const now = new Date();
  sub.paymentFailureCount = (sub.paymentFailureCount ?? 0) + 1;
  sub.lastPaymentFailureDate = now.toISOString();
  // 3-day grace — the paywall middleware keeps premium active through it
  sub.gracePeriodEndDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  sub.updatedAt = now.toISOString();

  await store.saveSubscription(userId, sub);
  console.log(`[Stripe Webhook] ⚠️ Payment failed: user ${userId} (failures: ${sub.paymentFailureCount}, grace until ${sub.gracePeriodEndDate})`);
  return true;
}

/** customer.subscription.deleted — downgrade to free at period end. */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<boolean> {
  const store = getSubscriptionPersistence();
  if (!store) return false;

  const userId = readMetadata(subscription).userId;
  if (!userId) return false;

  const now = new Date().toISOString();
  const sub = await store.loadSubscription(userId);
  const updated: UserSubscriptionData = {
    ...(sub ?? { userId, startDate: now, autoRenew: false } as UserSubscriptionData),
    userId,
    tier: 'free',
    planId: 'plan_free',
    status: 'cancelled',
    autoRenew: false,
    updatedAt: now,
  };

  await store.saveSubscription(userId, updated);
  console.log(`[Stripe Webhook] ⬇️ User ${userId} downgraded to free (subscription ${subscription.id} deleted)`);
  return true;
}

/** customer.subscription.updated — cancel_at_period_end / plan sync. */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<boolean> {
  const store = getSubscriptionPersistence();
  if (!store) return false;

  const userId = readMetadata(subscription).userId;
  if (!userId) return false;

  const sub = await store.loadSubscription(userId);
  if (!sub) return false;

  sub.autoRenew = !subscription.cancel_at_period_end;
  if (subscription.status === 'canceled') {
    sub.status = 'cancelled';
  }
  sub.updatedAt = new Date().toISOString();

  await store.saveSubscription(userId, sub);
  console.log(`[Stripe Webhook] ↻ Subscription updated: user ${userId} (autoRenew: ${sub.autoRenew})`);
  return true;
}

// ──── Metadata helpers ───────────────────────────────────────────────────────

type HasMetadata = { metadata?: StripeMetadata | null };

/** The userId written into subscription metadata at checkout. */
function metadataUserId(obj: HasMetadata): string | undefined {
  const id = obj.metadata?.userId;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

export default router;
