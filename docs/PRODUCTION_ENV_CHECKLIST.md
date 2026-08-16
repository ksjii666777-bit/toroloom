# 🚀 Toroloom — Production Env Var Checklist (Railway)

> **Ground truth:** `backend/src/config/env.ts` (incl. `validateRequiredEnv()`),
> `docker-compose.prod.yml`, frontend `app.config.js` + `eas.json`.
> **Last verified:** August 2026.
>
> 💡 Set variables in **Railway → Service → Variables** (never commit a `.env`
> file). Deploy steps are in [`../DEPLOY.md`](../DEPLOY.md) /
> [`BUYER_SETUP_GUIDE.md`](../BUYER_SETUP_GUIDE.md).

---

## 0. Pre-flight

- [ ] Railway project created, service **Root Directory = `/backend`**
- [ ] **PostgreSQL plugin** added (`+ New → Database → PostgreSQL`) — auto-injects `DATABASE_URL`
- [ ] *(Optional)* **Redis plugin** added — auto-injects `RAILWAY_REDIS_URL`
- [ ] Secrets generated (see [§ 8](#-8-generating-secrets))

---

## 1. 🔴 Required — app will not start / will not be secure without these

| Variable | Value | Notes |
|----------|-------|-------|
| `JWT_SECRET` | `openssl rand -hex 32` | **Hard-required.** Startup fails in prod if empty. Same value must be used by any other service issuing JWTs. |
| `NODE_ENV` | `production` | Production mode (enables prod warnings + `sslmode=require` on PG). |
| `STORAGE_BACKEND` | `postgres` | `postgres` (persistent) — `memory` only for demos. |
| `CLUSTER_MODE` | `0` | **Critical for Railway** (single container). `1` crashes the container. |
| `SUBSCRIPTION_GATING_ENABLED` | `true` | Enables subscription feature-gating middleware. |
| `DATABASE_URL` | *(auto-injected)* | ⚠️ Do **not** set manually — Railway PostgreSQL injects it. |

---

## 2. 🟠 Core product credentials

### SnapTrade — unified broker OAuth (all 3 required for trading)

| Variable | Where from | Format |
|----------|-----------|--------|
| `SNAPTRADE_CLIENT_ID` | [app.snaptrade.com](https://app.snaptrade.com) → Settings → API Keys | `PERS_xxxxxxxxxxxx` (personal) or `PARTNER_xxxx` (commercial) |
| `SNAPTRADE_CONSUMER_KEY` | same page | `xxxxxxxxxxxx` |
| `SNAPTRADE_MODE` *(optional)* | — | `personal` or `commercial`. **Auto-detected** from the `PERS-` client-ID prefix — only set to override. `personal` = personal API keys (no `registerUser`, user auto-provisioned). `commercial` = partner keys (default flow). |
| `SNAPTRADE_ENCRYPTION_KEY` | `openssl rand -hex 32` | 64 hex chars — required in **commercial** mode (user `userSecret` AES-256-GCM). Not used in personal mode. Prod warns if missing. |

> Missing keys → `/api/snaptrade/*` returns `500 SnapTrade is not configured`.

### Razorpay — payments (all 3 required)

| Variable | Where from | Format |
|----------|-----------|--------|
| `RAZORPAY_KEY_ID` | Razorpay Dashboard → Settings → API Keys | `rzp_live_xxxxxxxx` (**live**, not `rzp_test_`) |
| `RAZORPAY_KEY_SECRET` | same page | secret |
| `RAZORPAY_WEBHOOK_SECRET` | `openssl rand -hex 32` | must match the webhook secret set in the Razorpay dashboard |

> Webhook: Razorpay → Settings → Webhooks → URL `https://<your-service>.up.railway.app/api/payments/webhook`, events `payment.captured`, `order.paid`, `subscription.charged`, `subscription.activated`.

### AI — set **at least one** provider (prod warns if none)

| Variable | Where from | Format |
|----------|-----------|--------|
| `OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) | `sk-or-v1-xxxxx` |
| `OPENROUTER_MODEL` | *(default ok)* | `google/gemini-2.0-flash-lite-001` |
| `GOOGLE_GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) | `AIzaSyxxxxxxxx` |
| `GOOGLE_GEMINI_MODEL` | *(default ok)* | `gemini-2.0-flash-lite-001` |
| `CHOREO_CLAUDE_API_KEY` | Choreo API Gateway | (optional; `CHOREO_CLAUDE_ENDPOINT` / `_MODEL` have defaults) |
| `AI_PROVIDER` | — | `openrouter` *(default)* \| `google` \| `choreo` |

### Security

| Variable | Value | Notes |
|----------|-------|-------|
| `CORS_ORIGIN` | your app domain(s), comma-separated | e.g. `https://app.toroloom.com,https://admin.toroloom.com`. Prod **warns** loudly while `*`. |

---

## 3. 🟡 Optional — enables specific features

| Variable | Feature | Where from |
|----------|---------|-----------|
| `SENTRY_DSN` | Backend error tracking | [sentry.io](https://sentry.io) project keys |
| `REDIS_URL` | Cache + pub/sub *(or `RAILWAY_REDIS_URL` auto)* | Railway Redis plugin |
| `TELEGRAM_BOT_TOKEN` | Trading alerts via Telegram | [@BotFather](https://t.me/BotFather) |
| `MARKETSTACK_KEY` | Real-time stock data | [marketstack.com](https://marketstack.com) |
| `NEWSAPI_KEY` | Financial news | [newsapi.org](https://newsapi.org) |
| `FMP_API_KEY` | Live economic calendar (250 req/day free) | [financialmodelingprep.com](https://financialmodelingprep.com) |
| `FRED_API_KEY` | US Treasury yields / bonds | [fred.stlouisfed.org](https://fred.stlouisfed.org) |
| `COMMODITY_API_KEY` | Commodity prices | [api-ninjas.com](https://api-ninjas.com) |
| `UPSTOX_CLIENT_ID` / `_SECRET` / `REDIRECT_URI` | Upstox OAuth | Upstox developer console |
| `ANGEL_SMARTAPI_KEY` | Angel One SmartAPI (server-level) | [smartapi.angelbroking.com](https://smartapi.angelbroking.com) |
| `IBKR_GATEWAY_URL` / `IBKR_ACCOUNT_ID` (+ `IBKR_ENABLED=true`) | Interactive Brokers gateway | your IBKR gateway |
| `RESEND_API_KEY` / `RESEND_SENDER_EMAIL` | Transactional email | [resend.com](https://resend.com) |
| `DATABASE_URL_READER` | Analytics read-replica offload | *(falls back to `DATABASE_URL`)* |

---

## 4. ⚪ Tuning (defaults are fine — only override if needed)

| Group | Variables |
|-------|-----------|
| PG pools | `POOL_MAX` (20), `READER_POOL_MAX` (10), `STATEMENT_TIMEOUT_MS` |
| Cache | `BACKTEST_CACHE_TTL` (3600), `MARKET_DATA_CACHE_TTL` (600), `CACHE_MAX_ENTRIES` (200), `DISABLE_CACHE=1` |
| Rate limits | `RATE_LIMIT_AUTH_MAX` (10), `RATE_LIMIT_WRITE_MAX` (50), `RATE_LIMIT_READ_MAX` (200), `RATE_LIMIT_ADMIN_MAX` (20) |
| Input sanitizer | `INPUT_MAX_LENGTH` (5000), `PASSWORD_MAX_LENGTH` (128), `INPUT_MAX_DEPTH` (10), `STRIP_TEMPLATE_SYNTAX` |
| Security | `REPLAY_WINDOW_MS`, `NONCE_CLEANUP_INTERVAL`, `ORDER_IDEMPOTENCY_TTL_MS`, `ORDER_IDEMPOTENCY_STALE_MS`, `SAFE_REGEX_TIMEOUT_MS` |

---

## 5. 🤖 Railway auto-injected — **never** set manually

`PORT` · `DATABASE_URL` · `RAILWAY_REDIS_URL` (Redis plugin) · `RAILWAY_STATIC_URL` · `RAILWAY_SERVICE_NAME`

---

## 6. 📱 Frontend (EAS build / app store)

> ⚠️ **Deploy gotcha:** the repo currently has the **seller's** values baked in.
> Replace before building your production app.

| Variable | Where | What to set |
|----------|-------|-------------|
| `EXPO_PUBLIC_API_URL` | `app.config.js` + `eas.json` (all 3 profiles) | **Your** backend URL: `https://<your-service>.up.railway.app/api` |
| `EXPO_PUBLIC_SENTRY_DSN` | `app.config.js` + `eas.json` (all 3 profiles) | **Your** Sentry project DSN (or empty to disable) |

- App reads `EXPO_PUBLIC_API_URL` at build time — set it in EAS build env / `eas.json`, not just a local `.env`.
- `src/services/sentry.ts` also honors `EXPO_PUBLIC_SENTRY_DSN` (falls back to `SENTRY_DSN`).
- **`401 Unauthorized`** on login usually means the app hits a different backend than the one issuing JWTs — check `EXPO_PUBLIC_API_URL` + `JWT_SECRET` match.

---

## 7. ✅ Post-deploy verification

```bash
# 1. Health
curl https://<your-service>.up.railway.app/health
# → {"status":"ok","storageBackend":"postgres","storageHealthy":true,...}

# 2. SnapTrade configured
curl -s -X POST https://<your-service>.up.railway.app/api/snaptrade/register \
  -H "Content-Type: application/json" -d '{"userId":"test_user"}'

# 3. Razorpay order (auth token required)
curl -s -X POST https://<your-service>.up.railway.app/api/payments/create-order \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"planId":"plan_pro","billingPeriod":"monthly"}'

# 4. AI insights
curl -s -H "Authorization: Bearer $TOKEN" \
  https://<your-service>.up.railway.app/api/ai/insights?symbol=RELIANCE
```

### Startup-warning signals (check Railway logs)

| Log warning | Fix |
|-------------|-----|
| `JWT_SECRET is required` | Set `JWT_SECRET` |
| `CORS_ORIGIN is set to "*"` | Set `CORS_ORIGIN` to your domains |
| `SNAPTRADE_ENCRYPTION_KEY not set` | Set it (64 hex chars) |
| `No AI provider configured` | Set at least one AI key |
| `SnapTrade is not configured` (API 500) | Set `SNAPTRADE_CLIENT_ID` + `SNAPTRADE_CONSUMER_KEY` |

---

## 8. 🔑 Generating secrets

```bash
openssl rand -hex 32   # → JWT_SECRET, SNAPTRADE_ENCRYPTION_KEY, RAZORPAY_WEBHOOK_SECRET
```

---

## 📋 One-glance checklist (tick as you go)

**Required:** ☐ `JWT_SECRET` ☐ `NODE_ENV=production` ☐ `STORAGE_BACKEND=postgres` ☐ `CLUSTER_MODE=0` ☐ `SUBSCRIPTION_GATING_ENABLED=true`
**SnapTrade:** ☐ `SNAPTRADE_CLIENT_ID` ☐ `SNAPTRADE_CONSUMER_KEY` ☐ `SNAPTRADE_ENCRYPTION_KEY`
**Razorpay:** ☐ `RAZORPAY_KEY_ID` ☐ `RAZORPAY_KEY_SECRET` ☐ `RAZORPAY_WEBHOOK_SECRET` ☐ webhook URL configured
**AI (≥1):** ☐ `OPENROUTER_API_KEY` ☐ or `GOOGLE_GEMINI_API_KEY` ☐ or `CHOREO_CLAUDE_API_KEY`
**Security:** ☐ `CORS_ORIGIN` set to your domains
**Optional:** ☐ `SENTRY_DSN` ☐ Redis ☐ `TELEGRAM_BOT_TOKEN` ☐ `MARKETSTACK_KEY` ☐ `NEWSAPI_KEY` ☐ `FMP_API_KEY` ☐ `FRED_API_KEY` ☐ `RESEND_API_KEY`
**Frontend:** ☐ `EXPO_PUBLIC_API_URL` = your Railway URL ☐ `EXPO_PUBLIC_SENTRY_DSN` replaced/cleared
**Verify:** ☐ `/health` ☐ SnapTrade register ☐ Razorpay order ☐ AI insights

---

> **Note:** `backend/.env.example` is stale vs. this checklist (missing the
> SnapTrade / Razorpay / AI / market-data keys above). It is safe to use for
> local dev, but treat this checklist as the authoritative production list.
