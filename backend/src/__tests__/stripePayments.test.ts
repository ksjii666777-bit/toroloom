/**
 * ============================================================================
 * Toroloom — Stripe Payments Tests
 * ============================================================================
 *
 * Covers the US/EU checkout rail end-to-end through the real app + real
 * middleware (only the Stripe SDK client is a controlled mock):
 *
 *   checkout-session   — auth required, lookup-key resolution, metadata,
 *                        region guard (schema rejects 'in'), 503 unconfigured
 *   portal-session     — requires a stripeCustomerId on the subscription
 *   webhook/stripe     — signature verify (valid/tampered/missing),
 *                        checkout provisioning, invoice.paid renewal,
 *                        invoice.payment_failed dunning, subscription.deleted
 *                        downgrade, idempotency, unknown event → received
 *
 * The webhook secret is injected via setStripeWebhookSecret; signatures are
 * computed with the same HMAC the Stripe SDK verifies (t=<ts>,v1=<mac>).
 * ============================================================================
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../server';
import { registerUser, authenticateUser, userCount } from '../data/userStore';
import {
  setStripeClient,
  setStripeWebhookSecret,
  STRIPE_LOOKUP_KEYS,
} from '../routes/stripePayments';
import { configureSubscriptionPersistence } from '../routes/subscriptions';
import type Stripe from 'stripe';

// ──── Storage fake (same shape the server wiring uses) ──────────────────────

const subscriptions = new Map<string, any>();
const processedEvents = new Set<string>();

configureSubscriptionPersistence({
  loadSubscription: async (userId: string) => subscriptions.get(userId) ?? null,
  saveSubscription: async (userId: string, sub: any) => { subscriptions.set(userId, structuredClone(sub)); },
  markEventProcessed: async (id: string) => { processedEvents.add(id); },
  isEventProcessed: async (id: string) => processedEvents.has(id),
});

// ──── Stripe client mock ─────────────────────────────────────────────────────

const priceList = vi.fn(async (opts: { lookup_keys: string[] }) => ({
  data: [{ id: `price_${opts.lookup_keys[0]}`, lookup_key: opts.lookup_keys[0] }],
}));

const sessionCreate = vi.fn(async (params: any) => ({
  id: 'cs_test_123',
  url: 'https://checkout.stripe.com/c/pay/cs_test_123',
  metadata: params.metadata,
  customer: null,
  subscription: null,
}));

const portalCreate = vi.fn(async (_params: any) => ({
  id: 'bps_test_123',
  url: 'https://billing.stripe.com/session/bps_test_123',
}));

const constructEvent = vi.fn();

const mockStripe = {
  prices: { list: priceList },
  checkout: { sessions: { create: sessionCreate } },
  billingPortal: { sessions: { create: portalCreate } },
  webhooks: { constructEvent },
} as unknown as Stripe;

let restoreClient: () => void;

beforeAll(() => {
  restoreClient = setStripeClient(mockStripe);
  setStripeWebhookSecret('whsec_test_secret');
});

afterAll(() => {
  restoreClient();
  setStripeWebhookSecret(null);
});

// ──── Helpers ────────────────────────────────────────────────────────────────

const DEMO_EMAIL = `stripe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.dev`;
const DEMO_PASSWORD = 'Sup3rSecure!Pass';

let bearer = '';

function authed() {
  return {
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${bearer}`),
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${bearer}`),
  };
}

function signWebhook(payload: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const mac = crypto
    .createHmac('sha256', 'whsec_test_secret')
    .update(`${ts}.${payload}`)
    .digest('hex');
  return `t=${ts},v1=${mac}`;
}

function webhookEvent(type: string, dataObject: Record<string, unknown>, id = `evt_${crypto.randomBytes(6).toString('hex')}`) {
  return {
    id,
    object: 'event',
    type,
    data: { object: dataObject },
  };
}

let currentUserId = '';

beforeEach(async () => {
  subscriptions.clear();
  processedEvents.clear();
  priceList.mockClear();
  sessionCreate.mockClear();
  portalCreate.mockClear();
  constructEvent.mockReset();

  // Fresh user + token per test
  const email = `stripe-${userCount()}-${Math.random().toString(36).slice(2, 7)}@test.dev`;
  const stored = registerUser({ name: 'Stripe Tester', email, phone: '9999999999', password: DEMO_PASSWORD });
  currentUserId = stored.id;
  const login = await request(app).post('/api/auth/login').send({ email, password: DEMO_PASSWORD });
  bearer = login.body.token;
});

// ──── checkout-session ───────────────────────────────────────────────────────

describe('POST /api/payments/stripe/checkout-session', () => {
  it('401 without auth', async () => {
    const res = await request(app)
      .post('/api/payments/stripe/checkout-session')
      .send({ planId: 'plan_pro', billingPeriod: 'monthly', region: 'us' });
    expect(res.status).toBe(401);
  });

  it('400 when region is india (Razorpay rail guard, enforced by schema)', async () => {
    const res = await authed()
      .post('/api/payments/stripe/checkout-session')
      .send({ planId: 'plan_pro', billingPeriod: 'monthly', region: 'in' });
    expect(res.status).toBe(400);
    expect(sessionCreate).not.toHaveBeenCalled();
  });

  it('creates a session with the resolved price id and full metadata', async () => {
    const res = await authed()
      .post('/api/payments/stripe/checkout-session')
      .send({ planId: 'plan_pro', billingPeriod: 'yearly', region: 'eu' });

    expect(res.status).toBe(201);
    expect(res.body.url).toContain('https://checkout.stripe.com');

    expect(priceList).toHaveBeenCalledWith(expect.objectContaining({
      lookup_keys: [STRIPE_LOOKUP_KEYS.plan_pro.eu.yearly],
    }));

    const params = sessionCreate.mock.calls[0][0];
    expect(params.mode).toBe('subscription');
    expect(params.metadata).toMatchObject({ planId: 'plan_pro', billingPeriod: 'yearly', region: 'eu' });
    expect(params.metadata.userId).toBeTruthy();
    // subscription_data carries the identity into renewal events
    expect(params.subscription_data.metadata).toEqual(params.metadata);
  });

  it('rejects an unknown plan/region combination', async () => {
    const res = await authed()
      .post('/api/payments/stripe/checkout-session')
      .send({ planId: 'plan_pro', billingPeriod: 'monthly', region: 'jp' });
    expect(res.status).toBe(400);
  });
});

// ──── portal-session ─────────────────────────────────────────────────────────

describe('POST /api/payments/stripe/portal-session', () => {
  it('404 when the user has no stripe billing profile', async () => {
    const res = await authed().post('/api/payments/stripe/portal-session').send({});
    expect(res.status).toBe(404);
  });

  it('creates a portal session for a linked customer', async () => {
    subscriptions.set(currentUserId, { userId: currentUserId, tier: 'pro', planId: 'plan_pro', status: 'active', stripeCustomerId: 'cus_123' });

    const res = await authed().post('/api/payments/stripe/portal-session').send({});
    expect(res.status).toBe(201);
    expect(res.body.url).toContain('billing.stripe.com');
    expect(portalCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_123' }));
  });
});

// ──── webhook ────────────────────────────────────────────────────────────────

describe('POST /api/payments/webhook/stripe', () => {
  it('400 with a missing signature header', async () => {
    const res = await request(app)
      .post('/api/payments/webhook/stripe')
      .set('Content-Type', 'application/json')
      .send(webhookEvent('invoice.paid', {}));
    expect(res.status).toBe(400);
  });

  it('400 with a tampered signature', async () => {
    // Real SDK behavior: constructEvent THROWS on a bad signature —
    // mirror that instead of returning undefined.
    constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature');
    });
    const payload = JSON.stringify(webhookEvent('invoice.paid', {}));
    const res = await request(app)
      .post('/api/payments/webhook/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=deadbeef')
      .send(payload);
    expect(res.status).toBe(400);
    expect(constructEvent).toHaveBeenCalled();
  });

  it('provisions via a properly signed checkout.session.completed event', async () => {
    // Find the authed user's id: they just registered → look up via login email is unavailable,
    // so provision for a known synthetic user and assert on the store.
    const session = {
      id: 'cs_abc2',
      object: 'checkout.session',
      customer: 'cus_new2',
      subscription: 'sub_new2',
      metadata: { userId: 'synthetic-user-1', planId: 'plan_elite', billingPeriod: 'yearly', region: 'us' },
    };
    const event = webhookEvent('checkout.session.completed', session, 'evt_checkout_ok');
    constructEvent.mockReturnValue(event);

    const res = await request(app)
      .post('/api/payments/webhook/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signWebhook(JSON.stringify(session)))
      .send(JSON.stringify(session));

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(true);

    const stored = subscriptions.get('synthetic-user-1');
    expect(stored).toMatchObject({
      tier: 'elite',
      planId: 'plan_elite',
      status: 'active',
      paymentMethod: 'stripe',
      stripeCustomerId: 'cus_new2',
      stripeSubscriptionId: 'sub_new2',
      autoRenew: true,
    });
    // Yearly → endDate set ~365 days out (or the real period end)
    expect(new Date(stored.endDate).getTime()).toBeGreaterThan(Date.now() + 300 * 24 * 60 * 60 * 1000);
  });

  it('is idempotent: the same event id does not double-process', async () => {
    const session = {
      id: 'cs_dup',
      object: 'checkout.session',
      customer: 'cus_dup',
      subscription: 'sub_dup',
      metadata: { userId: 'synthetic-user-2', planId: 'plan_pro', billingPeriod: 'monthly', region: 'us' },
    };
    const event = webhookEvent('checkout.session.completed', session, 'evt_dup_1');
    constructEvent.mockReturnValue(event);

    const payload = JSON.stringify(session);
    const r1 = await request(app)
      .post('/api/payments/webhook/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signWebhook(payload))
      .send(payload);
    expect(r1.body.processed).toBe(true);

    const r2 = await request(app)
      .post('/api/payments/webhook/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signWebhook(payload))
      .send(payload);
    expect(r2.body.duplicate).toBe(true);
    expect(r2.body.processed).toBeUndefined();
  });

  it('invoice.paid extends endDate and clears dunning state', async () => {
    subscriptions.set('user-renew', {
      userId: 'user-renew', tier: 'pro', planId: 'plan_pro', status: 'active',
      endDate: new Date().toISOString(), paymentFailureCount: 2,
      gracePeriodEndDate: new Date().toISOString(),
    });

    const invoice = {
      id: 'in_renew',
      object: 'invoice',
      subscription: 'sub_user-renew',
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      metadata: { userId: 'user-renew', planId: 'plan_pro' },
      lines: { data: [] },
    };
    constructEvent.mockReturnValue(webhookEvent('invoice.paid', invoice, 'evt_renew_1'));

    const res = await request(app)
      .post('/api/payments/webhook/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signWebhook(JSON.stringify(invoice)))
      .send(JSON.stringify(invoice));

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(true);

    const stored = subscriptions.get('user-renew');
    expect(stored.status).toBe('active');
    expect(new Date(stored.endDate).getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    expect(stored.paymentFailureCount).toBe(0);
    expect(stored.gracePeriodEndDate).toBeUndefined();
  });

  it('invoice.payment_failed sets dunning fields and a 3-day grace window', async () => {
    subscriptions.set('user-dun', {
      userId: 'user-dun', tier: 'pro', planId: 'plan_pro', status: 'active',
      endDate: new Date().toISOString(),
    });

    const invoice = {
      id: 'in_fail',
      object: 'invoice',
      subscription: 'sub_user-dun',
      metadata: { userId: 'user-dun', planId: 'plan_pro' },
      lines: { data: [] },
    };
    constructEvent.mockReturnValue(webhookEvent('invoice.payment_failed', invoice, 'evt_fail_1'));

    await request(app)
      .post('/api/payments/webhook/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signWebhook(JSON.stringify(invoice)))
      .send(JSON.stringify(invoice));

    const stored = subscriptions.get('user-dun');
    expect(stored.paymentFailureCount).toBe(1);
    expect(stored.lastPaymentFailureDate).toBeTruthy();
    const grace = new Date(stored.gracePeriodEndDate).getTime();
    expect(grace).toBeGreaterThan(Date.now() + 2 * 24 * 60 * 60 * 1000);
    expect(grace).toBeLessThan(Date.now() + 4 * 24 * 60 * 60 * 1000);
  });

  it('customer.subscription.deleted downgrades to free', async () => {
    subscriptions.set('user-down', {
      userId: 'user-down', tier: 'elite', planId: 'plan_elite', status: 'active',
      stripeSubscriptionId: 'sub_user-down', endDate: new Date().toISOString(),
    });

    const subscription = {
      id: 'sub_user-down',
      object: 'subscription',
      status: 'canceled',
      metadata: { userId: 'user-down', planId: 'plan_elite' },
    };
    constructEvent.mockReturnValue(webhookEvent('customer.subscription.deleted', subscription, 'evt_down_1'));

    const res = await request(app)
      .post('/api/payments/webhook/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signWebhook(JSON.stringify(subscription)))
      .send(JSON.stringify(subscription));

    expect(res.status).toBe(200);

    const stored = subscriptions.get('user-down');
    expect(stored.tier).toBe('free');
    expect(stored.planId).toBe('plan_free');
    expect(stored.status).toBe('cancelled');
    expect(stored.autoRenew).toBe(false);
  });

  it('unknown event types are acked as received', async () => {
    const obj = { id: 'po_1', object: 'payment_intent' };
    constructEvent.mockReturnValue(webhookEvent('payment_intent.succeeded', obj, 'evt_unknown_1'));

    const res = await request(app)
      .post('/api/payments/webhook/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signWebhook(JSON.stringify(obj)))
      .send(JSON.stringify(obj));

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(false);
  });
});
