# Stripe Integration Plan — US/EU Checkout

> **Goal:** Turn the GlobalPricingScreen's US/EU "Stripe waitlist" CTA into real
> checkout, alongside the existing Razorpay INR flow — without touching the
> paywall matrix, the gate middleware, or the `/current` contract.

---

## 0. What already exists (reuse, don't rebuild)

| Infra | Where | Reuse for Stripe |
|---|---|---|
| Raw-body webhook mount | `server.ts` mounts `/api/payments/webhook` with `express.raw()` **before** `express.json()` | Add `/api/payments/webhook/stripe` on the same pattern |
| Signature verification | HMAC + `timingSafeEqual` in `subscriptions.ts` | Stripe SDK's `constructEvent()` replaces the manual HMAC |
| Idempotency | `markEventProcessed` / `isEventProcessed` (storage + in-memory 24h TTL) | Same helpers, keyed by Stripe `event.id` |
| Webhook health monitor | `logWebhookEvent` → `webhookHealth` | Same logger — zero new monitoring |
| Grace/dunning fields | `UserSubscriptionData.paymentFailureCount`, `gracePeriodEndDate`, `lastPaymentFailureDate` | Stripe dunning writes straight into them |
| Tier gate | `subscriptionGate` middleware reads only `tier`/`endDate` | Untouched — tier provisioning shape stays identical |
| Frontend sync | `subscriptionStore.syncFromServer` → `GET /api/subscriptions/current` | Untouched — Stripe upgrades surface automatically |

**Design principle:** Stripe's Price is the **source of truth** for USD/EUR
amounts. The backend stores `planId` + `tier` only — no amount mirroring for
international, so the Razorpay `PLANS` sync-bug class cannot happen here.

---

## 1. Product / Price catalog (Stripe Dashboard or seed script)

Two products, two currencies, two billing periods → 8 prices, each with a
`lookup_key` (env-free resolution, no price IDs in code):

| lookup_key | Product | Amount |
|---|---|---|
| `pro_us_monthly` / `pro_us_yearly` | Toroloom Pro (US) | $29/mo · $290/yr |
| `pro_eu_monthly` / `pro_eu_yearly` | Toroloom Pro (EU) | €29/mo · €290/yr |
| `elite_us_monthly` / `elite_us_yearly` | Toroloom Elite (US) | $79/mo · $790/yr |
| `elite_eu_monthly` / `elite_eu_yearly` | Toroloom Elite (EU) | €79/mo · €790/yr |

Amounts must mirror `src/services/pricing/geoPricing.ts` `GLOBAL_PRICE_BOOK`
(us/eu: 29/290, 79/790) — that file remains the display source, Stripe the
charging source.

**Tax:** enable **Stripe Tax** (EU VAT MOSS + US sales tax auto-compute) — this
is what makes the geoPricing footnote "local taxes added at checkout where
applicable" literally true.

**Env vars (Railway):**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 2. New backend endpoints — `backend/src/routes/stripePayments.ts`

All authed via existing `authMiddleware`.

### `POST /api/payments/stripe/checkout-session`
```
body: { planId: 'plan_pro'|'plan_elite', billingPeriod: 'monthly'|'yearly', region: 'us'|'eu' }
→ 201 { url: "<Stripe Checkout URL>" }
```
- Resolve price via `stripe.prices.list({ lookup_key, currency })` (exactly one match)
- Create Checkout Session:
  - `mode: 'subscription'`
  - `client_reference_id: userId`
  - `metadata: { userId, planId, billingPeriod, region }` + same on
    `subscription_data.metadata` (so renewals carry it forward)
  - `success_url: DEEP_LINK_BASE + 'subscription/success?session_id={CHECKOUT_SESSION_ID}'`
  - `cancel_url: DEEP_LINK_BASE + 'subscription/cancelled'`
- Guard: reject `region === 'in'` (that flow belongs to Razorpay)

### `POST /api/payments/stripe/portal-session`
```
→ 201 { url: "<Stripe Billing Portal URL>" }
```
Portal handles cancel / card update / invoice history — Stripe-hosted, replaces
`POST /api/subscriptions/cancel` for Stripe users (keep Razorpay cancel path as-is).

### `POST /api/payments/webhook/stripe` (unauthenticated, raw body)

Verify with `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`,
then the same idempotency + logging skeleton as the Razorpay handler:

| Stripe event | Action |
|---|---|
| `checkout.session.completed` | Provision: `saveSubscription` with `tier`/`planId` from metadata, `status: 'active'`, `endDate` from subscription `current_period_end`, `paymentMethod: 'stripe'`, store `stripeCustomerId`/`stripeSubscriptionId` |
| `invoice.paid` | Renewal: extend `endDate`, reset `paymentFailureCount`, clear grace fields |
| `invoice.payment_failed` | Dunning: increment `paymentFailureCount`, set `gracePeriodEndDate` (+3 days), `lastPaymentFailureDate` — fields already in the schema |
| `customer.subscription.deleted` | Downgrade to `plan_free` at period end |
| `customer.subscription.updated` | Plan change / `cancel_at_period_end` sync |
| `charge.refunded` | Log + optional downgrade (policy decision) |

### `UserSubscriptionData` additions (optional fields only)
```ts
stripeCustomerId?: string;
stripeSubscriptionId?: string;
stripePriceId?: string;
```
No migration risk — storage engines tolerate optional fields; `/current`
contract unchanged.

---

## 3. Frontend wiring

1. **`services/api/payments.ts`** — add `createStripeCheckoutSession(planId, billingPeriod, region)` and `createStripePortalSession()`.
2. **`GlobalPricingScreen`** — flip `isStripeLive` (currently waitlist CTA → checkout CTA). CTA opens `session.url` via `Linking.openURL` (system browser; Checkout is mobile-safe).
3. **Deep link** — register `toroloom://` scheme; on `subscription/success` → `syncFromServer()` + success Alert (same pattern as SnapTrade OAuth callback).
4. **Subscription screen** — for `paymentMethod === 'stripe'` users, "Manage plan" → portal session (Razorpay users keep cancel flow).
5. **Feature flag** — expose `stripeEnabled` from app config (or simple: checkout 404 → fall back to waitlist CTA) so rollout is code-free revertible.

---

## 4. Flow

```
User (US/EU) taps Checkout on GlobalPricingScreen
  → POST /stripe/checkout-session → { url }
  → Linking.openURL → Stripe Checkout (card, 3DS, Stripe Tax)
  → success deep link toroloom://subscription/success
  → app calls /current (tier now pro/elite via webhook provisioning)
Stripe (async): checkout.session.completed → /api/payments/webhook/stripe
  → signature verify → idempotency → saveSubscription(tier, endDate)
Renewals: invoice.paid (extend) / invoice.payment_failed (dunning fields)
Cancel/update: Billing Portal → customer.subscription.updated/deleted
```

---

## 5. Test plan

**Backend (vitest, mirrors `routes.int.test.ts` patterns):**
- Signature: valid / tampered / missing header → 400
- `checkout.session.completed` → tier provisioned from metadata, endDate = period end
- Duplicate event id → `{ duplicate: true }`, no double write
- `invoice.payment_failed` → `paymentFailureCount` +1, grace set
- `customer.subscription.deleted` → tier free
- Region guard: `region: 'in'` → 400

**Frontend:**
- GlobalPricingScreen: US + `isStripeLive` → checkout CTA (not waitlist), calls API with region
- Deep-link handler triggers `syncFromServer`

**Local E2E:** `stripe listen --forward-to localhost:PORT/api/payments/webhook/stripe`
+ `stripe trigger checkout.session.completed` replay before going live.

---

## 6. Rollout order & effort

| Step | Effort |
|---|---|
| 1. Stripe account + products/prices + Tax + portal config (dashboard) | ~half day (account verification may take days — start first) |
| 2. Backend: `stripePayments.ts` (checkout, portal, webhook) + `stripe` dep + schema fields + tests | ~1 day |
| 3. Frontend: API client, CTA flip, deep link, portal entry + tests | ~0.5 day |
| 4. Test-mode E2E on device (real Checkout + webhook) | ~half day |
| 5. Live keys + enable flag + webhookHealth check | minutes |

**⚠️ Honest caveats:**
- **iOS App Store rule 3.1.1:** digital-goods subscriptions via external Stripe
  in an iOS app can be rejected. Android is fine. Options for iOS later: route
  users to a web purchase page ( Stripe Checkout in browser is generally
  accepted as an external flow today post-2025 ruling — verify with a legal
  read before the App Store submission), or add Apple IAP as a third rail.
  Razorpay-on-iOS already carries the same risk today — this is not a Stripe
  regression, but flag it before launch.
- **Refunds/coupons:** decide refund policy (auto-downgrade vs manual) before
  enabling `charge.refunded` handling.
- **Razorpay stays untouched** — India flow keeps its mandate/autopay machinery.
