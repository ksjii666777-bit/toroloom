# 🚄 Toroloom — Railway Deploy Runbook (Step-by-Step)

> **Yeh runbook Railway par backend deploy karke smoke-test tak le jata hai.**
> Har step ka order important hai — vars bhi checklist ke order mein set hote hain.
> Reference: [`PRODUCTION_ENV_CHECKLIST.md`](./PRODUCTION_ENV_CHECKLIST.md) ·
> [`DEPLOY.md`](../DEPLOY.md) · [`BUYER_SETUP_GUIDE.md`](../BUYER_SETUP_GUIDE.md)
>
> **Time:** ~20-30 min · **Kya chahiye:** Railway + GitHub account, SnapTrade /
> Razorpay / AI accounts (Step 0).

---

## Step 0 — Pre-flight (5 min)

- [ ] **Railway account** — [railway.app](https://railway.app) (Google/GitHub signup)
- [ ] **SnapTrade account** — [app.snaptrade.com](https://app.snaptrade.com) → Settings → API Keys (Client ID + Consumer Key)
- [ ] **Razorpay account** — [dashboard.razorpay.com](https://dashboard.razorpay.com) (merchant account)
- [ ] **AI account (≥1)** — [openrouter.ai/keys](https://openrouter.ai/keys) ya [aistudio.google.com](https://aistudio.google.com)

Secrets generate karo (terminal mein):

```bash
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 32   # → SNAPTRADE_ENCRYPTION_KEY
openssl rand -hex 32   # → RAZORPAY_WEBHOOK_SECRET
```

> 🔑 Teeno alag-alag generate karo — ek hi value repeat mat karo.

---

## Step 1 — Project banao + backend deploy (3 min)

1. [Railway Dashboard](https://railway.app/dashboard) → **+ New Project** → **Deploy from GitHub repo**
2. Apna repo select karo → pehli build **fail hogi** (expected — agla step fix karta hai)
3. Service → **Settings** tab → **Root Directory**: `/` → `/backend`
4. Railway auto-redeploy karega — build ab pass hona chahiye

---

## Step 2 — PostgreSQL add karo (2 min)

1. Project mein **+ New** → **Database** → **PostgreSQL**
2. Railway **`DATABASE_URL`** backend service mein auto-inject karega (kuch mat karo)
3. 1-2 min wait karo — status **Healthy** hona chahiye

> 💡 Postgres service aur backend ek hi **project/environment** mein hone chahiye.

---

## Step 3 — Environment variables set karo (IN ORDER) (8 min)

Service → **Variables** tab. Railway var change par auto-redeploy karta hai — sab ek sath daalo to ek hi redeploy hoga.

### 3.1 🔴 Required — app boot hone ke liye

| # | Variable | Value |
|---|----------|-------|
| 1 | `JWT_SECRET` | *(Step 0 ka hex — required, startup fail hota hai bina)* |
| 2 | `NODE_ENV` | `production` |
| 3 | `STORAGE_BACKEND` | `postgres` (trailing space mat daalo!) |
| 4 | `CLUSTER_MODE` | `0` (**zaroori** — `1` ya unset → Railway container crash) |
| 5 | `SUBSCRIPTION_GATING_ENABLED` | `true` |

> ⚠️ `DATABASE_URL` + `PORT` khud **mat** set karo — Railway inject karta hai.

### 3.2 🔌 SnapTrade — broker OAuth (teeno required)

| # | Variable | Value |
|---|----------|-------|
| 6 | `SNAPTRADE_CLIENT_ID` | `PERS_xxxxxxxxxxxx` (SnapTrade Dashboard) |
| 7 | `SNAPTRADE_CONSUMER_KEY` | SnapTrade Dashboard (same page) |
| 8 | `SNAPTRADE_ENCRYPTION_KEY` | *(Step 0 ka hex)* |

### 3.3 💳 Razorpay — payments (teeno required)

| # | Variable | Value |
|---|----------|-------|
| 9 | `RAZORPAY_KEY_ID` | `rzp_live_xxxxxxxx` (**live** keys — `rzp_test_` nahi) |
| 10 | `RAZORPAY_KEY_SECRET` | Razorpay Dashboard |
| 11 | `RAZORPAY_WEBHOOK_SECRET` | *(Step 0 ka hex)* |

**Razorpay webhook** (dashboard mein): URL `https://<your-service>.up.railway.app/api/payments/webhook`, secret = var #11, events: `payment.captured`, `order.paid`, `subscription.charged`, `subscription.activated`.

### 3.4 🤖 AI — kam se kam ek provider

| # | Variable | Value |
|---|----------|-------|
| 12 | `OPENROUTER_API_KEY` | `sk-or-v1-xxxxx` *(ya #13)* |
| 13 | `GOOGLE_GEMINI_API_KEY` | `AIzaSyxxxxxxxx` *(ya #12)* |
| 14 | `CHOREO_CLAUDE_API_KEY` | *(optional, paid)* |
| — | `AI_PROVIDER` | `openrouter` *(default)* — ya `google` / `choreo` |

### 3.5 🔐 Security

| # | Variable | Value |
|---|----------|-------|
| 15 | `CORS_ORIGIN` | Apne domain(s), comma-separated — e.g. `https://app.toroloom.com` |

### 3.6 🟡 Optional (feature enable)

| # | Variable | Value |
|---|----------|-------|
| 16 | `SENTRY_DSN` | Sentry project keys |
| 17 | `REDIS_URL` | *(Railway Redis plugin add karo → auto-inject)* |
| 18 | `RESEND_API_KEY` + `RESEND_SENDER_EMAIL` | Resend API keys |
| 19 | `MARKETSTACK_KEY` | MarketStack free tier |
| 20 | `NEWSAPI_KEY` | NewsAPI |
| 21 | `FRED_API_KEY` | FRED |
| 22 | `TELEGRAM_BOT_TOKEN` | @BotFather |
| — | `UPSTOX_*`, `ANGEL_SMARTAPI_KEY`, `IBKR_*` | Broker extras (rarely needed) |

> Tuning knobs (`POOL_MAX`, cache TTLs, rate limits…) defaults theek hain — checklist §4 dekho agar override karna ho.

---

## Step 4 — Deploy verify karo (1 min)

Railway **Deployments** tab → backend logs:

```
Storage:    POSTGRES
Migrations: 2 applied, 0 skipped
```

Agar `Storage: MEMORY` dikhe → var #3 check karo (trailing space common mistake).

---

## Step 5 — Smoke tests (exact curls) (3 min)

> `<YOUR_DOMAIN>` ko apne Railway domain se replace karo (Service → Settings → Domain).

### 5.1 Readiness + Liveness

```bash
curl -i https://<YOUR_DOMAIN>.up.railway.app/ready
# Expected: HTTP 200
# {"status":"ready","storageBackend":"postgres","storageHealthy":true,...}

curl -s https://<YOUR_DOMAIN>.up.railway.app/health
# Expected: {"status":"ok","broker":"mock","dataSource":"mock","storageBackend":"postgres","storageHealthy":true,"uptime":...}
```

> `/ready` → 503 = DB unreachable (fail-fast by design — Railway auto-restart karta hai).

### 5.2 Auth login (token lo — agle tests ke liye)

```bash
curl -s -X POST https://<YOUR_DOMAIN>.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test@123"}' | tee /tmp/token.json

# Token extract karo (jq ho to):
TOKEN=$(jq -r '.token' /tmp/token.json)
```

### 5.3 SnapTrade (broker OAuth)

```bash
curl -s -X POST https://<YOUR_DOMAIN>.up.railway.app/api/snaptrade/register \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_buyer_user"}'
# Expected: {"success":true,"snapTradeUserId":"test_buyer_user"}

curl -s -X POST https://<YOUR_DOMAIN>.up.railway.app/api/snaptrade/connect-link \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_buyer_user"}'
# Expected: {"success":true,"oauthUrl":"https://snaptrade.com/connect/..."}
```

### 5.4 Razorpay (payments)

```bash
curl -s -X POST https://<YOUR_DOMAIN>.up.railway.app/api/payments/create-order \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planId":"plan_pro","billingPeriod":"monthly"}'
# Expected: Razorpay order object (id, amount, currency...) — real keys ke saath
```

### 5.5 AI insights

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://<YOUR_DOMAIN>.up.railway.app/api/ai/insights?symbol=RELIANCE"
# Expected: AI analysis response (agar AI key configured hai; warna mock/fallback)
```

---

## 🚨 Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Log: `JWT_SECRET is required` | Var #1 missing | Set karo + redeploy |
| Log: `CORS_ORIGIN is set to "*"` | Var #15 missing | Apne domain set karo |
| Log: `SNAPTRADE_ENCRYPTION_KEY not set` | Var #8 missing | Set karo |
| Log: `No AI provider configured` | Vars #12-14 sab empty | ≥1 set karo |
| `Storage: MEMORY` | Var #3 galat (ya trailing space) | `STORAGE_BACKEND=postgres` re-set |
| `/ready` 503 + restart loop | DB down / `DATABASE_URL` nahi link hua | Postgres plugin Healthy hai? |
| `500 SnapTrade is not configured` | Vars #6-7 missing | Set karo |
| `401 Unauthorized` (login) | Frontend alag backend pe point kar raha | `EXPO_PUBLIC_API_URL` match karo |
| Exit code 137 | Memory khatam | Railway plan upgrade |

---

## ✅ Done Checklist

- [ ] Step 1: Root Directory `/backend`, build pass
- [ ] Step 2: Postgres plugin → `DATABASE_URL` auto-linked
- [ ] Step 3: Vars #1-15 set (required + core + CORS), optional #16+ chaaho to
- [ ] Step 4: Logs → `Storage: POSTGRES` + `Migrations:` line
- [ ] Step 5.1: `/ready` HTTP 200 + `storageHealthy: true`
- [ ] Step 5.3: SnapTrade register + connect-link success
- [ ] Step 5.4: Razorpay order banta hai
- [ ] Step 5.5: AI insights response aata hai

> **Agla step:** Frontend build — `EXPO_PUBLIC_API_URL=https://<YOUR_DOMAIN>.up.railway.app/api`
> EAS env me set karke `eas build` (dekho [`STORE_SUBMISSION.md`](./STORE_SUBMISSION.md)).
