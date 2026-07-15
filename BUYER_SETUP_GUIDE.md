# 🚀 Toroloom — Buyer Production Setup Guide

> **Yeh guide buyer ko dena hai jo app khareedega.** Saare env vars, steps, aur screenshots ka reference ek sath.

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

## Step 3: PostgreSQL Database Add Karo

```
+ New → Database → PostgreSQL
→ Railway automatically DATABASE_URL inject karega backend service mein
```

---

## 🔐 Step 4: Environment Variables Set Karo

Backend service → **Variables** tab mein yeh sab add karo:

### ⚡ Required (App chalne ke liye zaroori)

| Variable | Value | Kahan Se Milega |
|----------|-------|-----------------|
| `JWT_SECRET` | *(random 64-char hex)* | Terminal: `openssl rand -hex 32` |
| `NODE_ENV` | `production` | Hardcode karo |
| `STORAGE_BACKEND` | `postgres` | Hardcode karo |
| `CLUSTER_MODE` | `0` | **Zaroori!** Single-container Railway ke liye |
| `SUBSCRIPTION_GATING_ENABLED` | `true` | Hardcode karo |

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

### 🛠️ Other Optional Keys

| Variable | Kya Hota Hai | Kahan Se Milega |
|----------|-------------|-----------------|
| `TELEGRAM_BOT_TOKEN` | Trading alerts via Telegram bot | [@BotFather](https://t.me/BotFather) on Telegram |
| `MARKETSTACK_KEY` | Real-time stock market data | [marketstack.com](https://marketstack.com) — Free tier available |
| `NEWSAPI_KEY` | Financial news articles | [newsapi.org](https://newsapi.org) — Free tier |

---

## 🌐 Step 5: Razorpay Webhook Setup

Razorpay Dashboard → **Settings → Webhooks**:

| Field | Value |
|-------|-------|
| **Webhook URL** | `https://your-service.up.railway.app/api/payments/webhook` |
| **Secret** | Wohi value jo `RAZORPAY_WEBHOOK_SECRET` mein set kiya |
| **Events** | `payment.captured`, `order.paid`, `subscription.charged`, `subscription.activated` |

---

## ✅ Step 6: Verify Health

```bash
curl https://your-service.up.railway.app/health
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
| `storageHealthy: false` | PostgreSQL connected nahi | Railway PG plugin add karo |
| `status: degraded` | Storage unhealthy | `STORAGE_BACKEND=postgres` check karo |
| Backend crash (exit 137) | Memory full | Railway paid plan upgrade karo |
| `401 Unauthorized` | JWT mismatch | Frontend mein bhi same backend URL daalo |

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
| 12 | `OPENROUTER_API_KEY` | ⬜ Optional | OpenRouter Dashboard |
| 13 | `GOOGLE_GEMINI_API_KEY` | ⬜ Optional | Google AI Studio |
| 14 | `SENTRY_DSN` | ⬜ Optional | Sentry Dashboard |
| 15 | `REDIS_URL` | ⬜ Optional | Railway Redis plugin |
| 16 | `TELEGRAM_BOT_TOKEN` | ⬜ Optional | Telegram @BotFather |
| 17 | `MARKETSTACK_KEY` | ⬜ Optional | MarketStack |
| 18 | `NEWSAPI_KEY` | ⬜ Optional | NewsAPI |
| 19 | `CHOREO_CLAUDE_API_KEY` | ⬜ Optional | Choreo API Gateway |
| 20 | `DATABASE_URL` | ✅ | **Auto-injected by Railway PostgreSQL** |

---

## 🚨 Common Mistakes to Avoid

| ❌ Mistake | ✅ Correct |
|-----------|-----------|
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
| **Free (Railway)** | $0 | 10-15 | 1 container, 512MB RAM, in-memory DB |
| **Starter** | ~$5-10/mo | 100-500 | Railway Pro + PostgreSQL plugin |
| **Growth** | ~$25-50/mo | 1K-5K | Railway Scale + PostgreSQL + Redis |
| **Scale** | ~$100-200/mo | 10K+ | Multiple containers + RDS + ElastiCache |

**Additional costs:**
- **SnapTrade**: Free tier (500 users) → Paid plans as you scale
- **Razorpay**: 2% per transaction (standard payment gateway fees)
- **AI API**: ~$0.15-1.00 per 1M tokens (varies by provider)

---

## 🆘 Support

- **Railway Docs:** [docs.railway.com](https://docs.railway.com)
- **Razorpay Docs:** [razorpay.com/docs](https://razorpay.com/docs)
- **SnapTrade Docs:** [docs.snaptrade.com](https://docs.snaptrade.com)
- **OpenRouter:** [openrouter.ai/docs](https://openrouter.ai/docs)
- **Toroloom Backend Code:** Isi repository mein — `backend/` directory

---

> **⚡ Total Setup Time: 20-30 minutes**
> Deploy: 5 min | Env Vars (incl. SnapTrade): 8 min | Razorpay Webhook: 5 min | SnapTrade Test: 2 min | Verification: 5 min

> **🎯 Pro Tip:** Sabse pehle SnapTrade + Razorpay setup karo — yeh 2 cheezein app ki main functionality hain. AI provider baad mein bhi add kar sakte ho.
