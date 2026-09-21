# 🚀 Toroloom — Buyer Production Setup Guide

> **Yeh guide buyer ko dena hai jo app khareedega.** Saare env vars, steps, aur screenshots ka reference ek sath.

---

## 📸 Handover Snapshot (seller deployment ka aakhri audit)

**Seller ke deployment par jo SET tha (buyer ko apne accounts se REPLACE karna hai):**

| Category | Status |
|---|---|
| Storage | ✅ Railway **native Postgres** (postgres-ssl:18) — `DATABASE_URL` reference-pattern se wired, migrations applied |
| Broker | ✅ SnapTrade — Client ID + Consumer Key + Encryption Key teenon set (dev tier) |
| AI | ✅ OpenRouter key set |
| News/Macro | ✅ FRED, GNews, NewsData, MarketStack, Commodity API keys set |
| Email | ✅ Resend API key + sender email set |
| Payments | ⚠️ Razorpay — KEY_SECRET + webhook secret the, **KEY_ID missing** (checkout live kabhi hua hi nahi) |
| US/EU payments | ❌ Stripe keys set hi nahi thi (backend code fully ready) |
| Alerts | ✅ Telegram bot token set (uptime monitor) |
| Monitoring | ✅ Sentry DSN set |

**Buyer ko upar se 100% fresh start karna chahiye** — apne merchant/broker/AI accounts,
apni keys, apna Railway project. Seller apni saari keys transfer ke baad rotate/revoke karega
(`ENTERPRISE_TRANSFER.md` §6), isliye in par depend mat karo.

---

## 📋 Railway Setup Checklist

### Prerequisites
- [ ] **Railway Account** — [railway.app](https://railway.app) par signup karo (Google/GitHub se)
- [ ] **GitHub Account** — Railway ko GitHub se link karo
- [ ] **Razorpay Account** — [razorpay.com](https://razorpay.com) par merchant account banao
- [ ] **SnapTrade Account** — [snaptrade.com](https://snaptrade.com) par signup karo
- [ ] **AI Provider Account** — Kam se kam ek: OpenRouter / Google AI Studio
- [ ] **Domain (optional)** — Custom domain chahiye to DNS set karo

---

## Step 1: Railway Project Create Karo

```
Railway Dashboard → + New Project → Deploy from GitHub repo
→ Apna repo select karo
→ Pehli build fail hogi (expected) — agle step mein fix karenge
```

## Step 2: Root Directory Set Karo

```
Service → Settings → Root Directory → Change from "/" to "/backend"
→ Railway auto-deploy trigger karega
```

## Step 3: PostgreSQL Database Add Karo (NATIVE — important!)

```
+ New → Database → PostgreSQL
→ Railway ka native postgres-ssl:18 template deploy hoga (volume ke saath — data persistent)
```

### ⚠️ DATABASE_URL reference pattern (zaroori — auto-inject NAHI hota)

Railway ke Postgres template mein backend ke liye `DATABASE_URL` **auto-inject nahi hota** —
backend service par **khud reference set karna padta hai**. Backend service → Variables:

```
DATABASE_URL = postgresql://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
```

Ye **live reference** hai — Postgres service ke vars se compose hota hai, hardcoded URL nahi.
Service rename/redeploy par bhi sahi rehta hai.

### 🚨 Lesson (12-day production outage — is galti se bacho)

Kabhi bhi **Postgres service ke apne `DATABASE_URL` / `DATABASE_PUBLIC_URL` ko kisi third-party
URL (Neon, Supabase, RDS...) se manual override mat karo** — backend chupchaap us dead endpoint
ko hit karta rahega, `/ready` 503 dega, aur Railway ke saare future deploys block ho jayenge
(healthcheck catch-22). Toroloom mein yeh exactly hua tha — Sep 9 se Sep 21 tak.

Guards jo already lage hain:
- `/ready` sirf tab 200 deta hai jab storage genuinely healthy ho (fail-fast)
- Uptime monitor har 5 min probe karta hai; 2 consecutive failures par GitHub issue auto-open,
  recovery par auto-close (`uptime-monitor.yml`)

> Tip: Railway native Postgres idle par **sleep** ho sakta hai; backend boot ke waqt DB uth raha
> ho toh pehla deploy `storageHealthy: false` dikh sakta hai — 1-2 min baad `/ready` dobara probe
> karo, self-recover ho jaata hai.

---

## 🔐 Step 4: Environment Variables Set Karo

> 📋 **Complete checklist:** [`docs/PRODUCTION_ENV_CHECKLIST.md`](./docs/PRODUCTION_ENV_CHECKLIST.md) — saare env vars (SnapTrade, Razorpay, AI, Sentry, tuning) with sources + post-deploy verification.

Backend service → **Variables** tab mein yeh sab add karo:

### ⚡ Required (App chalne ke liye zaroori)

| Variable | Value | Kahan Se Milega |
|----------|-------|-----------------|
| `JWT_SECRET` | *(random 64-char hex)* | Terminal: `openssl rand -hex 32` |
| `NODE_ENV` | `production` | Hardcode karo |
| `STORAGE_BACKEND` | `postgres` | Hardcode karo |
| `CLUSTER_MODE` | `0` | **Zaroori!** Single-container Railway ke liye |
| `SUBSCRIPTION_GATING_ENABLED` | `true` | Hardcode karo |
| `DATABASE_URL` | `${{Postgres.PGUSER}}:...` reference (upar Step 3 dekho) | Railway native Postgres |
| `CORS_ORIGIN` | Apna frontend/app domain | Apna domain (comma-separated multiple allowed) |

### 💳 Stripe (US/EU Payments — code live hai, keys buyer ko daalni hain)

Global pricing screen US/EU users ko Stripe checkout par bhejta hai. Backend endpoints ready:
`/api/payments/stripe/checkout-session` + `/api/payments/stripe/portal` + webhook.

| Variable | Value | Kahan Se Milega |
|----------|-------|-----------------|
| `STRIPE_SECRET_KEY` | `sk_live_xxxxxxxx` | [Stripe Dashboard](https://dashboard.stripe.com) → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxxxxxxx` | Stripe → Developers → Webhooks → endpoint sign secret |

Stripe Dashboard → Webhooks → Add endpoint:

| Field | Value |
|-------|-------|
| **URL** | `https://your-service.up.railway.app/api/payments/stripe/webhook` |
| **Events** | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |

> Deep links already wired: `toroloom://subscription/success` app ko wapas laata hai aur
> subscription sync trigger karta hai.

### 🔌 SnapTrade (Broker OAuth — Unified Broker Connection)

> Users connect their Zerodha/Angel/Dhan/Upstox/Groww/Robinhood/IBKR accounts
> via 1-tap OAuth — no API keys needed from users!

| Variable | Value | Kahan Se Milega |
|----------|-------|-----------------|
| `SNAPTRADE_CLIENT_ID` | `PERS_xxxxxxxxxxxx` | [SnapTrade Dashboard](https://app.snaptrade.com) → Settings → API Keys |
| `SNAPTRADE_CONSUMER_KEY` | `xxxxxxxxxxxx` | SnapTrade Dashboard → Settings → API Keys (same page) |
| `SNAPTRADE_ENCRYPTION_KEY` | *(random hex)* | Terminal: `openssl rand -hex 32` |

> ⚠️ **Sab 3 required hain!** SnapTrade users ka `userSecret` AES-256-GCM encrypt hota hai.

### 💳 Razorpay (Payments)

| Variable | Value | Kahan Se Milega |
|----------|-------|-----------------|
| `RAZORPAY_KEY_ID` | `rzp_live_xxxxxxxx` | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | `xxxxxxxx` | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | *(random string)* | Terminal: `openssl rand -hex 32` |

> ⚠️ **Seller ke current deployment ka status:** `RAZORPAY_KEY_SECRET` + webhook secret set the
> par `RAZORPAY_KEY_ID` **missing** tha — checkout order-create isliye kabhi live nahi hua.
> Apne account se **teeno** values set karo, aur webhook URL bhi Razorpay dashboard mein
> register karo (Step 5).

### 🤖 AI (Kam se kam ek provider set karo)

| Variable | Value | Kahan Se Milega |
|----------|-------|-----------------|
| `OPENROUTER_API_KEY` | `sk-or-v1-xxxxx` | [openrouter.ai/keys](https://openrouter.ai/keys) — Free credits milte hain |
| `OPENROUTER_MODEL` | `google/gemini-2.0-flash-001` | Default rakh sakte ho |
| `GOOGLE_GEMINI_API_KEY` | `AIzaSyxxxxxxxx` | [Google AI Studio](https://aistudio.google.com) — Free tier available |
| `GOOGLE_GEMINI_MODEL` | `gemini-2.0-flash-lite-001` | Default rakh sakte ho |
| `CHOREO_CLAUDE_API_KEY` | `xxxxxxxx` | Choreo API Gateway (Claude — paid) |

### 🐛 Error Tracking (Optional)

| Variable | Value | Kahan Se Milega |
|----------|-------|-----------------|
| `SENTRY_DSN` | `https://xxx@xxx.ingest.sentry.io/xxx` | [sentry.io](https://sentry.io) |

### 🔴 Redis (Optional — Cache + Pub/Sub)

Railway Redis plugin add karo: `+ New → Database → Redis`

| Variable | Value | Kahan Se Milega |
|----------|-------|-----------------|
| `REDIS_URL` | *(auto-injected)* | Railway Redis plugin se automatic |

### 📰 Market Data & News (abhi production mein jo chal rahe hain)

| Variable | Kya Hota Hai | Kahan Se Milega |
|----------|-------------|-----------------|
| `MARKETSTACK_KEY` | Real-time stock market data | [marketstack.com](https://marketstack.com) — Free tier available |
| `FRED_API_KEY` | US macro data (Fed economic series) | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) — Free |
| `GNEWS_API_KEY` | Financial news articles | [gnews.io](https://gnews.io) — Free tier |
| `NEWSDATA_API_KEY` | News aggregation (second source) | [newsdata.io](https://newsdata.io) — Free tier |
| `COMMODITY_API_KEY` | Gold/silver/commodity prices | [commodity-api.com](https://www.commodity-api.com) |
| `RESEND_API_KEY` | Transactional email (OTP, receipts) | [resend.com](https://resend.com) — Free 3k/mo |
| `RESEND_SENDER_EMAIL` | Verified sender address | Resend → Domains (apna domain verify karo) |

### 🛠️ Other Optional Keys

| Variable | Kya Hota Hai | Kahan Se Milega |
|----------|-------------|-----------------|
| `TELEGRAM_BOT_TOKEN` | Trading alerts + uptime-monitor Telegram notifications | [@BotFather](https://t.me/BotFather) on Telegram |
| `SENTRY_DSN` | Backend error tracking | [sentry.io](https://sentry.io) |
| `REDIS_URL` | Cache + pub/sub (Railway Redis plugin auto-inject karta hai) | `+ New → Database → Redis` |

---

## 🌐 Step 5: Razorpay Webhook Setup

Razorpay Dashboard → **Settings → Webhooks**:

| Field | Value |
|-------|-------|
| **Webhook URL** | `https://your-service.up.railway.app/api/payments/webhook` |
| **Secret** | Wohi value jo `RAZORPAY_WEBHOOK_SECRET` mein set kiya |
| **Events** | `payment.captured`, `order.paid`, `subscription.charged`, `subscription.activated` |

---

## ✅ Step 6: Verify Health (dono endpoints)

```bash
# Liveness — process up hai
curl https://your-service.up.railway.app/health

# Readiness — storage GENUINELY healthy hai (Railway healthcheck yahi hit karta hai)
curl https://your-service.up.railway.app/ready
```

### Expected Output (All Good):
```json
{
  "status": "ok",
  "broker": "mock",
  "dataSource": "mock",
  "storageBackend": "postgres",
  "storageHealthy": true,
  "uptime": 12.34
}
```

### Troubleshooting:

| Symptom | Cause | Fix |
|---------|-------|-----|
| `/ready` 503, `storageHealthy: false` | DB down/unreachable | PG service logs dekho; `DATABASE_URL` reference pattern verify karo (Step 3) |
| `status: degraded` on `/health` | Storage unhealthy (liveness still OK) | `/ready` body padho — `storageBackend` + `storageHealthy` batayega kahan atka |
| Connection fails: "exceeded the quota" | `DATABASE_URL` kisi third-party (Neon/Supabase) par point kar raha hai | Override hatao, native reference pattern lagao (Step 3) |
| Backend boot par PG timeout | Native PG sleep se uth raha hai | 1-2 min wait, `/ready` dobara probe — self-recover |
| Backend crash (exit 137) | Memory full | Railway plan upgrade karo |
| `401 Unauthorized` | JWT mismatch | Frontend mein bhi same backend URL daalo |
| Deploy stuck "Waiting for healthcheck" | `/ready` 503 (catch-22) | Pehle DB fix karo — deploy tabhi aage badhega |

---

## 🧪 Step 7: SnapTrade OAuth Test

SnapTrade setup verify karo. Sabse important feature hai — isi se users apne brokers connect karenge.

### Test SnapTrade Connection

```bash
# 1. Register a test user
curl -s -X POST https://your-service.up.railway.app/api/snaptrade/register \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_buyer_user"}'
# → Expected: {"success":true,"snapTradeUserId":"test_buyer_user"}

# 2. Get OAuth portal URL (open in browser to connect a broker)
curl -s -X POST https://your-service.up.railway.app/api/snaptrade/connect-link \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_buyer_user"}'
# → Expected: {"success":true,"oauthUrl":"https://snaptrade.com/connect/..."}
```

> **Note:** Real OAuth flow requires the mobile app (deep link redirect).
> Above API test confirms SnapTrade is configured correctly.

### Troubleshooting SnapTrade

| Symptom | Cause | Fix |
|---------|-------|-----|
| `500 SnapTrade is not configured` | `SNAPTRADE_CLIENT_ID` ya `CONSUMER_KEY` missing | Railway Dashboard mein set karo |
| `401 Unauthorized` from SnapTrade | Keys invalid ya expired | SnapTrade Dashboard se new keys generate karo |
| `userSecret not found` | Register API call nahi kiya | Pehle `/api/snaptrade/register` call karo |

---

## 📱 Step 8: Frontend Config & Build

### 1️⃣ Deep Link Setup (app.json)

File: **`app.json`** mein yeh ensure karo:

```json
{
  "expo": {
    "scheme": "toroloom",
    "ios": {
      "associatedDomains": ["applinks:your-service.up.railway.app"]
    },
    "android": {
      "intentFilters": [{
        "action": "VIEW",
        "data": [{"scheme": "toroloom", "host": "snaptrade", "pathPrefix": "/callback"}]
      }]
    }
  }
}
```

### 2️⃣ Backend URL Set Karo

File: **`src/services/api/client.ts`** mein base URL change karo:

```typescript
// BEFORE (seller's URL):
baseUrl: 'https://toroloom-production.up.railway.app/api',

// CHANGE KARO to apna Railway domain:
baseUrl: 'https://your-service.up.railway.app/api',
```

### 3️⃣ EAS Build

```bash
# Android
eas build --platform android --profile production

# iOS (Mac chahiye)
eas build --platform ios --profile production

# Or build locally:
npx expo run:android --variant release
```

---

## 🧪 Step 9: Production Features Test

### 🔌 Broker OAuth Test
```
App → Connect Broker → Select Zerodha/Dhan/Any
→ Browser opens → Log into broker → Return to app
→ "✅ Connected" show hona chahiye
→ Holdings, positions, orders automatically available
```

### 💳 Payment Flow Test
```bash
# 1. Login
TOKEN=$(curl -s -X POST https://your-service.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test@123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 2. Create Razorpay order
curl -s -X POST https://your-service.up.railway.app/api/payments/create-order \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planId":"plan_pro","billingPeriod":"monthly"}'
# → Mock order return karega (jab tak real keys na daalein)
```

### 🤖 AI Insights Test
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  https://your-service.up.railway.app/api/ai/insights?symbol=RELIANCE
# → AI analysis response aana chahiye (agar AI provider configured hai)
```

### 💾 PostgreSQL Persistence Test
```bash
# Backend restart karo
curl https://your-service.up.railway.app/health
# → storageHealthy: true (data safe)
```

---

## 📊 All Env Vars at a Glance

| # | Variable | Required | Value Source |
|---|----------|:--------:|-------------|
| 1 | `JWT_SECRET` | ✅ **Critical** | Generate: `openssl rand -hex 32` |
| 2 | `NODE_ENV` | ✅ | `production` |
| 3 | `STORAGE_BACKEND` | ✅ | `postgres` |
| 4 | `CLUSTER_MODE` | ✅ | `0` (Railway) |
| 5 | `SUBSCRIPTION_GATING_ENABLED` | ✅ | `true` |
| 6 | `SNAPTRADE_CLIENT_ID` | ✅ **(Brokers)** | SnapTrade Dashboard |
| 7 | `SNAPTRADE_CONSUMER_KEY` | ✅ **(Brokers)** | SnapTrade Dashboard |
| 8 | `SNAPTRADE_ENCRYPTION_KEY` | ✅ **(Brokers)** | Generate: `openssl rand -hex 32` |
| 9 | `RAZORPAY_KEY_ID` | ✅ (payments) | Razorpay Dashboard |
| 10 | `RAZORPAY_KEY_SECRET` | ✅ (payments) | Razorpay Dashboard |
| 11 | `RAZORPAY_WEBHOOK_SECRET` | ✅ (payments) | Generate: `openssl rand -hex 32` |
| 12 | `STRIPE_SECRET_KEY` | ⬜ (US/EU payments) | Stripe Dashboard |
| 13 | `STRIPE_WEBHOOK_SECRET` | ⬜ (US/EU payments) | Stripe → Webhooks |
| 14 | `OPENROUTER_API_KEY` | ⬜ (AI) | OpenRouter Dashboard |
| 15 | `GOOGLE_GEMINI_API_KEY` | ⬜ (AI) | Google AI Studio |
| 16 | `MARKETSTACK_KEY` | ⬜ (market data) | MarketStack |
| 17 | `FRED_API_KEY` | ⬜ (macro data) | FRED |
| 18 | `GNEWS_API_KEY` | ⬜ (news) | GNews |
| 19 | `NEWSDATA_API_KEY` | ⬜ (news #2) | NewsData |
| 20 | `COMMODITY_API_KEY` | ⬜ (commodities) | Commodity API |
| 21 | `RESEND_API_KEY` + `RESEND_SENDER_EMAIL` | ⬜ (email/OTP) | Resend |
| 22 | `SENTRY_DSN` | ⬜ Optional | Sentry Dashboard |
| 23 | `REDIS_URL` | ⬜ Optional | Railway Redis plugin (auto) |
| 24 | `TELEGRAM_BOT_TOKEN` | ⬜ Optional (alerts) | Telegram @BotFather |
| 25 | `CORS_ORIGIN` | ✅ | Apna app/frontend domain |
| 26 | `DATABASE_URL` | ✅ | **Reference pattern** — `postgresql://${{Postgres.PGUSER}}:...` (Step 3) — auto-inject NAHI hota |

---

## 🚨 Common Mistakes to Avoid

| ❌ Mistake | ✅ Correct |
|-----------|-----------|
| Postgres service ke `DATABASE_URL` ko Neon/Supabase URL se override karna | **Kabhi mat karna** — 12-day outage ka root cause yehi tha; native reference pattern use karo |
| Sochna ki `DATABASE_URL` auto-inject hota hai | Backend service par khud `${{Postgres.PGUSER}}:...` reference set karo |
| `CLUSTER_MODE=1` rakhna | `CLUSTER_MODE=0` rakho — Railway single-container hai |
| `STORAGE_BACKEND=memory` rakhna | `STORAGE_BACKEND=postgres` karo — nahi to data restart pe gayab |
| PostgreSQL plugin add karna bhoolna | `+ New → Database → PostgreSQL` karna mat bhoolo |
| SnapTrade consumer key nahi daalna | Dono `SNAPTRADE_CLIENT_ID` + `SNAPTRADE_CONSUMER_KEY` zaroori hai |
| Encryption key nahi daalna | `SNAPTRADE_ENCRYPTION_KEY` nahi daala to `userSecret` encrypt nahi hoga |
| Razorpay test keys (`rzp_test_xxx`) use karna | Production mein `rzp_live_xxx` keys daalo |
| Webhook URL galat set karna | URL exactly yeh hona chahiye: `/api/payments/webhook` |
| `.env` file commit karna | Railway Dashboard Variables mein daalo, `.env` nahi |
| Deep link scheme nahi daalna | `app.json` mein `"scheme": "toroloom"` add karna bhool mat |

---

## 💰 Monthly Cost Estimate

| Tier | Cost | Users | What You Get |
|------|:----:|:-----:|-------------|
| **Trial/Hobby** | ~$5/mo | 10-50 | 1 container + native Postgres (8GB volume) + Redis |
| **Starter** | ~$10-20/mo | 100-500 | Railway Hobby/Pro + Postgres + Redis, thoda headroom |
| **Growth** | ~$25-50/mo | 1K-5K | Railway Scale + bada Postgres + Redis |
| **Scale** | ~$100-200/mo | 10K+ | Multiple containers + managed RDS + ElastiCache |

**Additional costs:**
- **SnapTrade**: Free tier (500 users) → Paid plans as you scale
- **Razorpay**: 2% per transaction (standard payment gateway fees)
- **AI API**: ~$0.15-1.00 per 1M tokens (varies by provider)

---

## 🆘 Support

- **Toroloom Env Checklist:** [`docs/PRODUCTION_ENV_CHECKLIST.md`](./docs/PRODUCTION_ENV_CHECKLIST.md)
- **Railway Docs:** [docs.railway.com](https://docs.railway.com)
- **Razorpay Docs:** [razorpay.com/docs](https://razorpay.com/docs)
- **SnapTrade Docs:** [docs.snaptrade.com](https://docs.snaptrade.com)
- **OpenRouter:** [openrouter.ai/docs](https://openrouter.ai/docs)
- **Toroloom Backend Code:** Isi repository mein — `backend/` directory

---

> **⚡ Total Setup Time: 20-30 minutes**
> Deploy: 5 min | Env Vars (incl. SnapTrade): 8 min | Razorpay Webhook: 5 min | SnapTrade Test: 2 min | Verification: 5 min

> **🎯 Pro Tip:** Sabse pehle SnapTrade + Razorpay setup karo — yeh 2 cheezein app ki main functionality hain. AI provider baad mein bhi add kar sakte ho.
