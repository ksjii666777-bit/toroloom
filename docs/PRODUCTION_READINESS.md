# 🚀 Toroloom — Production Readiness Checklist

> **Kya hai:** Production deploy + App Store submit se pehle bharna/check karna
> wale saare placeholders aur env vars ka master checklist. Har item tick karne
> ke baad app production-ready hai.
>
> **Last audited:** August 2026 · **Companion docs:**
> [`DEPLOY.md`](../DEPLOY.md) (Railway/Docker) · [`EAS_SETUP_GUIDE.md`](./EAS_SETUP_GUIDE.md)
> (Apple) · [`APPLE_CONFIG.md`](./APPLE_CONFIG.md)

---

## 📊 Audit Summary (August 2026)

| Severity | Count | Status |
|----------|:-----:|--------|
| 🔴 Critical (deploy se pehle mandatory) | 3 areas | ⬜ Baki |
| 🟡 Medium (deploy config defaults) | 5 items | ⬜ Baki |
| 🟢 Low (intentional / no action) | 6 categories | ✅ No action |

---

## 🔴 CRITICAL — Deploy se pehle ye sab zaroori hai

### 1. `eas.json` — Apple App Store (3 placeholders)

`eas.json` → `submit.production.ios` abhi:

```json
"ios": {
  "appleId": "placeholder@example.com",   // ← Apple ID email
  "ascAppId": "0000000000",               // ← App Store Connect numeric App ID
  "appleTeamId": "XXXXXXXXXX"             // ← Developer Team ID (10 chars)
}
```

- [ ] `appleId` — Apple Developer account login email
- [ ] `ascAppId` — App Store Connect → My Apps → Toroloom → App Information → Apple ID
- [ ] `appleTeamId` — developer.apple.com → Membership → Team ID

> 📖 Step-by-step: [`EAS_SETUP_GUIDE.md`](./EAS_SETUP_GUIDE.md)

### 2. `backend/.env` — File exist nahi karta! ❌

Sirf `.env.example` templates hain — **koi real `.env` nahi hai**. Deploy se pehle
`cp backend/.env.example backend/.env` karke ye sab fill karo:

| Variable | Status | Required for |
|----------|--------|--------------|
| `JWT_SECRET` | ❌ placeholder `change-this-to-...` | Auth — **must** (`openssl rand -hex 32`) |
| `DATABASE_URL` | ❌ localhost dev URL | Postgres storage |
| `MONGODB_URI` | ❌ localhost dev URL | Mongo storage |
| `CORS_ORIGIN` | ❌ `*` (dangerous in prod) | App domain(s), comma-separated |
| `SNAPTRADE_ENCRYPTION_KEY` | ❌ empty | Broker session security (`openssl rand -hex 32`) |
| `SENTRY_DSN` | ❌ empty | Error tracking |
| `REDIS_URL` | ❌ empty | Cache + cluster sync |
| `RAZORPAY_KEY_ID` | ❌ empty | Payments |
| `RAZORPAY_KEY_SECRET` | ❌ empty | Payments |
| `RAZORPAY_WEBHOOK_SECRET` | ❌ empty | Payment webhook verification |
| `OPENROUTER_API_KEY` | ❌ empty | AI analysis |
| `GOOGLE_GEMINI_API_KEY` | ❌ empty | AI analysis (alt provider) |
| `SNAPTRADE_CLIENT_ID` | ❌ empty | Broker OAuth connect |
| `SNAPTRADE_CONSUMER_KEY` | ❌ empty | Broker OAuth connect |

> Railway deploy par: **Variables tab** mein ye sab set karo (Railway `.env` file
> read nahi karta — dashboard variables use karo).

### 3. Razorpay test fallback — `backend/src/routes/payments.ts`

```typescript
keyId: keyId || 'rzp_test_placeholder',   // 5 jagah par fallback
```

- [ ] `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` set karo (live `rzp_live_*` keys)
- [ ] Agar placeholder hit hua, to payment orders test key se bante hain — real payment nahi hoga

---

## 🟡 MEDIUM — Deploy config defaults

| # | File | Placeholder | Fix |
|---|------|-------------|-----|
| 1 | `docker-compose.prod.yml` | `JWT_SECRET: ${JWT_SECRET:-change-me-in-production}` | Real secret pass karo |
| 2 | `docker-compose.prod.yml` | `SLACK_WEBHOOK_URL: ...placeholder` | Real Slack webhook URL |
| 3 | `docker-compose.prod.yml` | `PAGERDUTY_INTEGRATION_KEY: placeholder` | Real PagerDuty key (ya remove) |
| 4 | `k8s/secrets.yaml` | `JWT_SECRET: "change-me-to-a-random-hex-string"` | Real secret (K8s `kubectl create secret`) |
| 5 | `eas.json` profiles | `EXPO_PUBLIC_SENTRY_DSN` value missing | Frontend Sentry DSN add karo |

> 💡 Grafana `YOUR_DOMAIN` comment docs-level reminder hai — actual code issue nahi.

---

## 🟢 LOW — Intentional, koi action nahi

| Category | Kya hai | Kyon fine |
|----------|---------|-----------|
| `src/i18n/**` placeholders (40+ files) | UI input placeholders (e.g. "अपना ईमेल दर्ज करें") | UI text hai, secret nahi |
| `.env.example` files | Template values (`your_password`, `your_key`) | Docs templates — copy karke fill karne hain |
| Tests mein `rzp_test_abc123` | Test fixtures | Test-only data |
| `idempotency.ts` uuid template | `xxxxxxxx-xxxx-4xxx-...` | UUID v4 format string, normal code |
| KYC masked values (`XXXX1234`) | Privacy masking | Intentional by design |
| Broker env comments (`your_api_key`) | Code comments | Docs only |

---

## ✅ Already Done (verified)

- [x] `eas.json` — `EXPO_PUBLIC_API_URL` → Railway production URL
- [x] `eas.json` — Android `track: production` + `releaseStatus: completed`
- [x] `app.json` — Bundle IDs (`com.toroloom.app`), privacy descriptions, deep links
- [x] `google-services.json` — Android Firebase config present
- [x] `usesNonExemptEncryption: false` — Apple encryption exempt
- [x] Privacy policy + Terms of Service (HTML) ready
- [x] Idempotency + order safety (PG/Mongo verified)

---

## 🎯 Action Plan (priority order)

1. **`backend/.env` / Railway variables** — `.env.example` se copy karke saare values fill karo (15 vars)
2. **`eas.json` Apple values** — jab Apple Developer Program ready ho ($99/yr)
3. **`docker-compose.prod.yml`** — real `JWT_SECRET` + alert URLs
4. **`CORS_ORIGIN`** — apne app domain(s) set karo (abhi `*` hai)
5. **`EXPO_PUBLIC_SENTRY_DSN`** — eas.json production profile mein add karo
6. **Deploy** — Railway (5 min): [`DEPLOY.md`](../DEPLOY.md)
7. **App Store submit** — build + submit: [`STORE_SUBMISSION.md`](./STORE_SUBMISSION.md)

---

## 🏁 Deploy karte waqt quick smoke test

```bash
# Health check
curl https://your-service.up.railway.app/health

# Auth (JWT_SECRET verify)
curl -X POST https://your-service.up.railway.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@toroloom.com","password":"password123"}'

# Payment order (RAZORPAY_KEY_ID verify — placeholder aana nahi chahiye)
curl -X POST https://your-service.up.railway.app/api/payments/create-order \
  -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' \
  -d '{"amount":100,"currency":"INR"}'
# Response mein keyId 'rzp_live_...' hona chahiye, 'rzp_test_placeholder' nahi
```

---

*Last audited: August 2026*
