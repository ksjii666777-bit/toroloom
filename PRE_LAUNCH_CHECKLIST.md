# 🚀 Toroloom — Pre-Launch Checklist

> **Kya hai:** Launch se pehle kya DONE hai aur kya BAAKI hai — current reality ke hisaab se.
> **Last updated:** October 2, 2026 (E2E run-36 ke baad, evidence-based audit)
>
> Companion docs: [`docs/PRODUCTION_READINESS.md`](./docs/PRODUCTION_READINESS.md) (env vars) ·
> [`BUYER_SETUP_GUIDE.md`](./BUYER_SETUP_GUIDE.md) (accounts/keys) · [`STORE_SUBMISSION.md`](./STORE_SUBMISSION.md) (stores) ·
> [`docs/branch-protection.md`](./docs/branch-protection.md) (CI gate) · [`docs/e2e-stabilization.md`](./docs/e2e-stabilization.md) (quality evidence)

---

## 📋 Executive Summary

**Goal:** Launch Toroloom to real users with zero critical bugs.

**Reality (Oct 2026):** Code aur infra **launch-ready** hain — jo baaki hai wo
**external accounts, keys aur process** hai (code ka kaam nahi). Sab parallel
start karne par **public launch ~4–5 hafte** me; internal testing **turant**
shuru ho sakti hai.

| Area | Status |
|---|---|
| ✅ Backend production (Railway + native Postgres) | Live, uptime monitor active (5-min probe, auto-issue) |
| ✅ Frontend (React Native + Expo) | CI green — typecheck, lint, i18n parity, shards, bundle guards |
| ✅ E2E suite — 30 Maestro flows | **30/30 green**, hard gate ke neeche 5 green runs (30–33, 36), latest single-attempt |
| ✅ Test suite | 5,646 unit/integration tests green (incl. deterministic backend tests) |
| ✅ Security (code-level) | bcrypt, helmet, rate limiting, replay protection, input sanitizer, JWT — sab verified in-code |
| ✅ Monitoring | Prometheus + Sentry (DSN wired, dono sides) + Telegram alerts |
| ✅ Broker code | SnapTrade + Zerodha Kite + Angel One + Upstox — plugins, failover, metrics |
| ✅ Payments code | Razorpay (India) + Stripe (US/EU) — orders/verify/webhooks/retry/dunning |
| ✅ Legal | Privacy policy + Terms (DPDP-aware) + Play Data Safety doc |
| ❌ Payments LIVE | Checkout real me kabhi hua hi nahi — keys/accounts buyer (aapke) side pending |
| ❌ Store accounts | Apple/Play developer accounts + `eas.json` ke 3 placeholders |
| ❌ Broker production tier | SnapTrade dev tier tha; Zerodha/Angel real keys pending |
| ❌ Real-user validation | 10–15 testers ne app use nahi kiya |
| ❌ Load test | 50+ concurrent users ka real test nahi hua |

---

## 🎯 Remaining Work — Owner + Timeline

> Har item ka **owner** clearly marked hai. "You" = repo/product owner (aap).
> Timeline maan lete hain ki aap **aaj** start karte ho.

### 🔴 Week 1 — Accounts + Internal Build (sab parallel, mostly YOU)

| # | Item | Owner | Est. | Kaise |
|---|------|-------|------|-------|
| 1 | Razorpay merchant account + KYC | **You** | 2–7 din | razorpay.com → business KYC → live keys (`RAZORPAY_KEY_ID`/`SECRET`) Railway vars me |
| 2 | Apple Developer account ($99/yr) | **You** | 1–2 din | developer.apple.com → enroll → `eas.json` ke `appleId`/`ascAppId`/`appleTeamId` bharo ([STORE_SUBMISSION.md](./STORE_SUBMISSION.md) §1) |
| 3 | Google Play Console ($25) | **You** | 1 din | play.google.com/console → Data Safety form ([PLAY_DATA_SAFETY.md](./docs/PLAY_DATA_SAFETY.md) se answers ready hain) |
| 4 | SnapTrade production tier apply | **You** | 3–14 din ⚠️ | snaptrade.com → prod request (longest pole — aaj hi apply karo) |
| 5 | Zerodha Kite Connect / Angel One API keys (agar launch me chahiye) | **You** | 3–10 din | Zerodha: Kite Connect subscription + app create; Angel: SmartAPI app |
| 6 | `CORS_ORIGIN` fix (abhi `*` — dangerous) | **You** | 10 min | Railway vars → apna domain(s), comma-separated |
| 7 | Internal build distribute | Agent + You | 1 din | EAS build → APK/TestFlight internal (Apple account ka wait nahi — Android pehle) |
| 8 | Branch protection enable | **You** | 10 min | [docs/branch-protection.md](./docs/branch-protection.md) §3 (exact steps ready) |

### 🟡 Week 2 — Internal Testing + Payment Smoke (Agent-assisted, YOU-approved)

| # | Item | Owner | Est. | Kaise |
|---|------|-------|------|-------|
| 9 | 10–15 tester onboarding (WhatsApp group + bug form) | **You** | 2 din | Expo QR / APK share; PRE_LAUNCH bug-report template neeche hai |
| 10 | Razorpay live smoke test — ₹1 real transaction | Agent (code) + **You** (keys) | 1 din | Checkout → capture → webhook → verify → receipt email; failure path bhi |
| 11 | Real-broker UAT (minimum amounts) | **You** | 2–3 din | Prod-tier broker keys aane ke baad; mock broker se real me order place/cancel |
| 12 | P0/P1 bug fixes from testers | Agent | continuous | CI already 30/30 green — regression risk kam |

### 🟡 Week 3 — Beta + Load

| # | Item | Owner | Est. | Kaise |
|---|------|-------|------|-------|
| 13 | Closed beta (testers daily use) | **You** | 5 din | Feedback loop; Sentry me real-world errors dekhna shuru |
| 14 | Load test 50+ concurrent | Agent | 1–2 din | Backend WebSocket stress harness extend karo; API p95 < 1s target |
| 15 | Performance baselines bharna (neeche table TBD columns) | Agent | 1 din | Real device profiling + Railway metrics |

### 🟢 Week 4–5 — Store Submissions + Launch

| # | Item | Owner | Est. | Kaise |
|---|------|-------|------|-------|
| 16 | Play Store submission | **You** | 1 din + review 1–7 din | STORE_SUBMISSION.md follow karo |
| 17 | App Store submission | **You** | 1 din + review 1–3 din | Pehli submission me rejection possible — buffer rakha hai |
| 18 | Launch-day runbook dry run | Agent | 30 min | Neeche Launch Day Checklist ready hai — ek baar walkthrough |

---

## 📊 Performance Targets

> ⏳ = Week-3 me real measurements bharni hai (owner: Agent, item #15).

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Login API | < 500ms | TBD | ⏳ |
| Stock List | < 1000ms | TBD | ⏳ |
| Stock Detail | < 500ms | TBD | ⏳ |
| Place Order | < 2000ms | TBD (mock broker pe E2E-passing) | ⏳ |
| WebSocket | < 1000ms | TBD (stress test CI me green) | ⏳ |
| Chart Render | < 2000ms | TBD | ⏳ |

---

## 🔒 Security Checklist (code-level — VERIFIED ✅ Oct 2026)

- [x] JWT tokens properly validated
- [x] Passwords hashed (bcrypt — `backend/src/data/userStore.ts`)
- [x] SQL injection prevented (parameterized queries/ORM)
- [x] XSS attacks blocked (helmet + sanitization)
- [x] Rate limiting enabled (auth/write limiters, `backend/src/middleware/rateLimiter.ts`)
- [ ] CORS configured — **⬜ BAAKI: prod me `*` hai, apna domain daalo (Week-1 item #6, owner: You)**
- [x] HTTPS enforced (Railway terminates TLS; app APIs HTTPS-only)
- [x] API keys encrypted (SnapTrade encryption key + secure token storage)
- [x] Replay protection on payment routes (`backend/src/middleware/replayProtection.ts`)

> Yaad rahe: security ab bhi ** Week-1 me ek manual pentest pass** (OWASP mobile top-10 spot check) recommend hai — lightweight, 1 din.

---

## 📱 Testing Devices

> Week-2 me testers se cover hoga (unke apne devices). Minimum matrix:

| Device | OS | Network | Status |
|--------|-----|---------|--------|
| Android Phone 1 | Android 12+ | WiFi | ⏳ (tester distribution se) |
| Android Phone 2 | Android 12+ | 4G | ⏳ |
| iPhone 1 | iOS 15+ | WiFi | ⏳ (Apple account ke baad) |
| iPhone 2 | iOS 15+ | 4G | ⏳ |
| Slow Device | Android 10 | 3G | ⏳ |

---

## 🚨 Emergency Plan

### If App Crashes:
1. Sentry me crash group dekho (release + device breakdown)
2. Railway logs + `/ready` endpoint verify
3. Rollback: Railway → previous deployment → Redeploy (one click)
4. Users ko push/in-app notice (critical ho to)

### If Data Loss:
1. Railway native Postgres backups check (volume-backed)
2. Restore from last backup
3. Root cause → fix → redeploy
4. Affected users ko transparency message

### If Security Breach:
1. Saari API keys rotate (Razorpay, SnapTrade, AI providers, Resend)
2. JWT_SECRET rotate → saare tokens invalidate
3. Force password reset
4. Affected users ko notify (DPDP guideline ke hisaab se)

---

## 📞 Support Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Lead Developer | Karan | 24/7 during launch |
| Backend/Infra | Railway dashboard + uptime-monitor auto-issues | 24/7 (automated) |
| Railway Support | support@railway.app | Email |
| Razorpay Support | razorpay.com/support | Business hours |
| Apple/Play | App Store Connect / Play Console | Review queues |

---

## 🎯 Launch Day Checklist

### Pre-Launch (T-1 hour):
- [ ] CI workflow fully green on master (E2E + Audit Gate + Backend)
- [ ] Sentry me koi naya error spike nahi
- [ ] Uptime monitor green (auto-issue closed state)
- [ ] Razorpay live keys active + webhook health endpoint 200
- [ ] Rollback target (previous release) identified

### Launch (T-0):
- [ ] Store release live (phased rollout recommended: Play 10% → 50% → 100%)
- [ ] Verify all critical endpoints (`/ready`, auth, quotes, orders)
- [ ] ₹1 real transaction + ek real broker order (UAT account)
- [ ] Monitor error rates (Sentry + Prometheus)

### Post-Launch (T+1 hour):
- [ ] User signups check (DB count)
- [ ] Payment success rate check (subscription analytics route)
- [ ] Address any issues
- [ ] Celebrate! 🎉

---

## 📈 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Uptime | 99.9% | Railway + uptime-monitor |
| Response Time | < 1s | API logs / Prometheus |
| Error Rate | < 0.1% | Sentry |
| User Signups | 100+ day 1 | Database count |
| Crash Rate | < 1% | Sentry release health |
| Payment Success | > 95% | Razorpay dashboard + webhook health |

---

## 🎉 You're Ready When:

- [x] E2E suite green (30/30, hard gate) — **DONE**
- [x] Security code-level checklist — **DONE** (CORS prod value chhod kar)
- [ ] Razorpay live payment verified (₹1 + webhook) — *Week 2*
- [ ] Real-broker UAT pass — *Week 2–3*
- [ ] 10–15 testers validated, P0/P1 zero — *Week 2–3*
- [ ] Load test 50+ concurrent pass — *Week 3*
- [ ] Store approvals — *Week 4–5*
- [ ] Branch protection enabled — *aaj hi, 10 min*

---

**Remember: Trading app hai — har second matter karta hai! 🚀**
