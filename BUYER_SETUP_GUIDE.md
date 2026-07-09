# 🚀 Toroloom — Buyer Production Setup Guide

> **Yeh guide buyer ko dena hai jo app khareedega.** Saare env vars, steps, aur screenshots ka reference ek sath.

---

## 📋 Railway Setup Checklist

### Prerequisites
- [ ] **Railway Account** — [railway.app](https://railway.app) par signup karo (Google/GitHub se)
- [ ] **GitHub Account** — Railway ko GitHub se link karo
- [ ] **Razorpay Account** — [razorpay.com](https://razorpay.com) par merchant account banao
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

### 💳 Razorpay (Payments)

| Variable | Value | Kahan Se Milega |
|----------|-------|-----------------|
| `RAZORPAY_KEY_ID` | `rzp_live_xxxxxxxx` | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | `xxxxxxxx` | Razorpay Dashboard → Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | *(random string)* | Terminal: `openssl rand -hex 32` |

### 🤖 AI (OpenRouter)

| Variable | Value | Kahan Se Milega |
|----------|-------|-----------------|
| `OPENROUTER_API_KEY` | `sk-or-v1-xxxxx` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `OPENROUTER_MODEL` | `google/gemini-2.0-flash-001` | Default rakh sakte ho |

### 🐛 Error Tracking (Optional)

| Variable | Value | Kahan Se Milega |
|----------|-------|-----------------|
| `SENTRY_DSN` | `https://xxx@xxx.ingest.sentry.io/xxx` | [sentry.io](https://sentry.io) |

### 🔴 Redis (Optional — Cache + Pub/Sub)

Railway Redis plugin add karo: `+ New → Database → Redis`

| Variable | Value | Kahan Se Milega |
|----------|-------|-----------------|
| `REDIS_URL` | *(auto-injected)* | Railway Redis plugin se automatic |

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

## 📱 Step 7: Frontend Config

App mein backend URL set karna hoga. Yeh buyer karega jab app build kare:

File: **`App.tsx`** — Line 28

```typescript
// BEFORE (development URL):
baseUrl: 'https://toroloom-production.up.railway.app/api',

// CHANGE KARO to Railway domain:
baseUrl: 'https://your-service.up.railway.app/api',
```

> Railway domain health check karne ke baad mil jayega (Step 6)

Phir EAS Build karo:
```bash
eas build --platform android   # Android APK/AAB
eas build --platform ios       # iOS IPA (Mac chahiye)
```

---

## 🧪 Step 8: Production Features Test

### Payment Flow Test
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

### Subscription Gating Test
```bash
# Free user → AI insights (expect 402)
curl -s -H "Authorization: Bearer $TOKEN" \
  https://your-service.up.railway.app/api/ai/insights
# → {"error":"This feature requires a pro subscription...","code":"SUBSCRIPTION_REQUIRED"}
```

### PostgreSQL Persistence Test
```bash
# Restart bhi karo, data save rehna chahiye
curl https://your-service.up.railway.app/health
# → storageHealthy: true
```

---

## 📊 All Env Vars at a Glance

| # | Variable | Required | Value Source |
|---|----------|----------|-------------|
| 1 | `JWT_SECRET` | ✅ **Critical** | Generate: `openssl rand -hex 32` |
| 2 | `NODE_ENV` | ✅ | `production` |
| 3 | `STORAGE_BACKEND` | ✅ | `postgres` |
| 4 | `CLUSTER_MODE` | ✅ | `0` (Railway) |
| 5 | `SUBSCRIPTION_GATING_ENABLED` | ✅ | `true` |
| 6 | `RAZORPAY_KEY_ID` | ✅ (for payments) | Razorpay Dashboard |
| 7 | `RAZORPAY_KEY_SECRET` | ✅ (for payments) | Razorpay Dashboard |
| 8 | `RAZORPAY_WEBHOOK_SECRET` | ✅ (for payments) | Generate: `openssl rand -hex 32` |
| 9 | `OPENROUTER_API_KEY` | Optional | OpenRouter Dashboard |
| 10 | `OPENROUTER_MODEL` | Optional | Default: `google/gemini-2.0-flash-001` |
| 11 | `SENTRY_DSN` | Optional | Sentry Dashboard |
| 12 | `REDIS_URL` | Optional | Railway Redis plugin (auto) |
| 13 | `DATABASE_URL` | ✅ | **Auto-injected by Railway PostgreSQL plugin** |

---

## 🚨 Common Mistakes to Avoid

| ❌ Mistake | ✅ Correct |
|-----------|-----------|
| `CLUSTER_MODE=1` rakhna | `CLUSTER_MODE=0` rakho — Railway single-container hai |
| `STORAGE_BACKEND=memory` rakhna | `STORAGE_BACKEND=postgres` karo — nahi to data restart pe gayab |
| PostgreSQL plugin add karna bhoolna | `+ New → Database → PostgreSQL` karna mat bhoolo |
| Razorpay test keys (`rzp_test_xxx`) use karna | Production mein `rzp_live_xxx` keys daalo |
| Webhook URL galat set karna | URL exactly yeh hona chahiye: `/api/payments/webhook` |
| `.env` file commit karna | Railway Dashboard Variables mein daalo, `.env` nahi |

---

## 💰 Monthly Cost Estimate

| Tier | Cost | Users | What You Get |
|------|------|-------|-------------|
| **Free (Railway)** | $0 | 10-15 | 1 container, 512MB RAM, in-memory DB |
| **Starter** | ~$5-10/mo | 100-500 | Railway Pro + PostgreSQL plugin |
| **Growth** | ~$25-50/mo | 1K-5K | Railway Scale + PostgreSQL + Redis |
| **Scale** | ~$100-200/mo | 10K+ | Multiple containers + RDS + ElastiCache |

Railway PostgreSQL plugin ka cost ~$5/mo (500MB storage, shared CPU).

---

## 🆘 Support

- **Railway Docs:** [docs.railway.com](https://docs.railway.com)
- **Razorpay Docs:** [razorpay.com/docs](https://razorpay.com/docs)
- **OpenRouter:** [openrouter.ai/docs](https://openrouter.ai/docs)
- **Toroloom Backend Code:** Isi repository mein — `backend/` directory

---

> **⚡ Total Setup Time: 15-20 minutes**
> Deploy: 5 min | Env Vars: 5 min | Razorpay Webhook: 5 min | Verification: 5 min
