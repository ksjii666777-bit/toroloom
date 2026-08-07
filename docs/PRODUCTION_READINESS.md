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
| 🔴 Critical (deploy se pehle mandatory) | 3 areas | ⬜ Baki (user API keys) |
| 🟡 Medium (deploy config defaults) | 5 items | 5 ✅ / 0 ⬜ |
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

### 2. `backend/.env` — File ab EXIST karta hai ✅ (secure secrets generated)

`backend/.env` generate ho chuka hai — JWT_SECRET, SNAPTRADE_ENCRYPTION_KEY aur
RAZORPAY_WEBHOOK_SECRET random hex values ke saath filled hain. Ab sirf ye
**user-account keys** (jo sirf aapke dashboards se aati hain) bharni hain:

| Variable | Status | Required for |
|----------|--------|--------------|
| `JWT_SECRET` | ✅ generated random hex | Auth — done |
| `DATABASE_URL` | ✅ dev URL set (prod mein RDS URL daalo) | Postgres storage |
| `MONGODB_URI` | ✅ dev URL set | Mongo storage |
| `CORS_ORIGIN` | ❌ `*` (dangerous in prod) | App domain(s), comma-separated |
| `SNAPTRADE_ENCRYPTION_KEY` | ✅ generated random hex | Broker session security — done |
| `SENTRY_DSN` | ❌ empty | Error tracking — apna DSN daalo |
| `REDIS_URL` | ⬜ empty (optional locally) | Cache + cluster sync |
| `RAZORPAY_KEY_ID` | ❌ empty | Payments — dashboard se daalo |
| `RAZORPAY_KEY_SECRET` | ❌ empty | Payments — dashboard se daalo |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ generated random hex | Payment webhook — done |
| `OPENROUTER_API_KEY` | ❌ empty | AI analysis — openrouter.ai se daalo |
| `GOOGLE_GEMINI_API_KEY` | ❌ empty | AI analysis (alt provider) — daalo |
| `SNAPTRADE_CLIENT_ID` | ❌ empty | Broker OAuth connect — SnapTrade se daalo |
| `SNAPTRADE_CONSUMER_KEY` | ❌ empty | Broker OAuth connect — daalo |

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

| # | File | Placeholder | Status |
|---|------|-------------|--------|
| 1 | `docker-compose.prod.yml` | `JWT_SECRET: ${JWT_SECRET:-change-me-in-production}` | ✅ Fixed — ab required (`${JWT_SECRET:?...}` fail-fast), root `.env` mein generated value |
| 2 | `docker-compose.prod.yml` | `SLACK_WEBHOOK_URL: ...placeholder` | ✅ Fixed — fake webhook URL removed, empty default (alerts off) |
| 3 | `docker-compose.prod.yml` | `PAGERDUTY_INTEGRATION_KEY: placeholder` | ✅ Fixed — placeholder removed, empty default |
| 4 | `k8s/secrets.yaml` | `JWT_SECRET: "change-me-to-a-random-hex-string"` | ✅ Fixed — safe template + git-ignored `k8s/.env.secret` (secretGenerator enabled) |
| 5 | `eas.json` profiles | `EXPO_PUBLIC_SENTRY_DSN` value missing | ✅ Done — real DSN already present in all 4 profiles (dev/preview/prod) |

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

1. ✅ **`backend/.env` + root `.env` + `k8s/.env.secret`** — generated (JWT, encryption, webhook secrets). Bas user-account keys bharni hain (Razorpay, OpenRouter, Gemini, Sentry, SnapTrade)
2. **`eas.json` Apple values** — jab Apple Developer Program ready ho ($99/yr)
3. ✅ **`docker-compose.prod.yml`** — JWT_SECRET required + alert placeholders removed
4. **`CORS_ORIGIN`** — apne app domain(s) set karo (abhi `*` hai)
5. ✅ **`EXPO_PUBLIC_SENTRY_DSN`** — already set (verified in eas.json) — no action
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
