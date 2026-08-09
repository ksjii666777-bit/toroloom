# 📋 SnapTrade Partner Access — Step-by-Step Guide

> **Kyun zaroori hai:** Toroloom ka **multi-user broker flow** (`registerUser` per user → `userSecret` → holdings/orders) **Partner (Commercial) API** par bana hai. Personal keys single-user hain aur `registerUser` support nahi karti (SnapTrade error **code 1012**). Partner access milte hi app me **har user apna broker** connect kar sakta hai — production-ready.

---

## 📌 Pehle samjho: Personal vs Partner

| | **Personal** (abhi aapke paas) | **Partner / Commercial** (yeh guide) |
|---|---|---|
| Kiske liye | Aapke apne account | Aapke **users** (multi-user app) |
| `registerUser` | ❌ Nahi (auto-provisioned) | ✅ Required — har user ke liye |
| `userId` / `userSecret` | Omit hote hain | Har call me required |
| Client ID prefix | `PERS-` / `PERS_` | `PARTNER-` ya alag format |
| Kaam | Sirf aapka account | Poora Toroloom broker model |
| Cost | Free | Usage-based (baad me) |

> 💡 **Toroloom abhi dono mode support karta hai** (`SNAPTRADE_MODE` auto-detect). Partner keys aate hi `SNAPTRADE_MODE` hatao ya `commercial` set karo — code ready hai.

---

## 🪜 Step-by-Step Application Process

### Step 1 — Account banao (2 min)
1. **Kholo:** [app.snaptrade.com](https://app.snaptrade.com/) (ya [snaptrade.com](https://snaptrade.com/) → **Sign Up**)
2. **Register** karo: email + password
3. **Email verify** karo (link aayega inbox me)
4. **2FA enable karo** — SnapTrade dashboard par **mandatory** hai (TOTP app: Google Authenticator / Authy)

### Step 2 — Personal key se start karo (5 min) — *ho chuka hai ✅*
- Dashboard → **API Keys** → personal `Client ID` + `Consumer Key` mili
- Yahi keys abhi Railway par hain (`SNAPTRADE_MODE=personal`) — sandbox testing ke liye kaam kar rahi hain

### Step 3 — Partner / Commercial access ke liye apply karo (10-15 min)
SnapTrade dashboard me commercial/partner onboarding form bharna hai. Required info:

| Field | Kya daalo |
|---|---|
| **Company name** | Aapka business name (jaise `Toroloom` ya apna brand) |
| **Website** | Aapki app/landing page URL |
| **Use case** | Portfolio tracking + automated trading (Toroloom ka Iron Lock, order execution, holdings sync) |
| **Target users** | Retail investors (India/US markets) |
| **Integration type** | Embedded fintech app (React Native + backend) |

> 📝 **Tip:** Use case me likho ki app **SnapTrade Connection Portal** (OAuth) + **registerUser** flow use karegi — yahi standard partner integration hai. Platform compliance review ke liye clear + specific use case = fast approval.

### Step 4 — Sandbox / Test keys lo (5 min) — **yahi asli testing path hai**
- Approval ka wait karte waqt bhi, dashboard par **test API keys** milti hain
- Test keys **free** hain aur **Sandbox environment** deti hain (deterministic fake data, mock accounts, holdings, orders)
- ⚠️ **Important:** Sandbox **trading support nahi karta** (SnapTrade error 1063) — read-only testing. **Asli paper trade ke liye Alpaca/IBKR connect karo** (see below)

### Step 5 — Production keys lo (approval ke baad, 5 min)
1. Compliance/KYC review complete hone par dashboard me **Production keys** unlock hongi
2. **API Keys** section se teeno lo:
   - **Client ID** (`clientId`) — public identifier, `clientId` query param
   - **Consumer Key** (`consumerKey`) — **SECRET!** Sirf backend me. Kabhi frontend/mobile me mat daalo
   - **Encryption Key** — `openssl rand -hex 32` se generate karo (user `userSecret` AES-256-GCM encrypt karne ke liye)
3. Toroloom me yeh 3 vars: `SNAPTRADE_CLIENT_ID` + `SNAPTRADE_CONSUMER_KEY` + `SNAPTRADE_ENCRYPTION_KEY`

---

## ⏱️ Timeline — kya expect karein

| Stage | Time |
|---|---|
| Account + personal key | Turant |
| Test keys + Sandbox | Turant (self-serve) |
| **Partner production approval** | Typically **days** — compliance review (company, website, use case verify hote hain) |
| Production keys unlock | Approval ke baad turant |

> Snapshot: kuch devs same-day approve ho jaate hain; complex use cases me 1-2 weeks lag sakte hain. Koi **application fee** nahi (usage-based billing).

---

## 🔧 Partner keys milne ke baad — Railway update (5 min)

```bash
cd toroloom_repo/backend

# 1. Teeno keys set karo (values apne dashboard se)
railway variable set SNAPTRADE_CLIENT_ID "PARTNER-XXXXXXXX" --skip-deploys
railway variable set SNAPTRADE_CONSUMER_KEY "xxxxxxxxxxxx" --skip-deploys
railway variable set SNAPTRADE_ENCRYPTION_KEY "$(openssl rand -hex 32)" --skip-deploys

# 2. SNAPTRADE_MODE hatao (ab auto-detect commercial hoga) YA explicitly set karo
railway variable delete SNAPTRADE_MODE --json
# ya: railway variable set SNAPTRADE_MODE "commercial" --skip-deploys

# 3. Redeploy
railway redeploy -y
```

### Verify karo (smoke test)
```bash
BASE=https://toroloom-production.up.railway.app
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test@123"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")

# registerUser → har USER ka apna SnapTrade user banta hai
curl -s -X POST $BASE/api/snaptrade/register -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"userId":"user_1"}'
# → {"success":true, "snapTradeUserId":"toroloom_user_1", ...}   (personal-mode message NAHI)

# connect-link → Connection Portal URL
curl -s -X POST $BASE/api/snaptrade/connect-link -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}'
# → oauthUrl: https://app.snaptrade.com/snapTrade/redeemToken?token=...
```

---

## 🧪 Sandbox ke saath testing strategy (Partner approval ka wait karte waqt)

| Kaam | Personal keys (abhi) | Partner test keys (milte hi) |
|---|---|---|
| Holdings/positions/orders dekho | ✅ Real sandbox data | ✅ Same |
| OAuth portal + callback | ✅ | ✅ |
| **Order place (paper)** | ❌ Sandbox = read-only | ❌ Sandbox = read-only |
| **Real paper trading** | — | **Alpaca/IBKR paper account connect karo** |

**Asli paper trade chahiye?** Alpaca (free paper trading) ko OAuth portal se connect karo:
1. [alpaca.markets](https://alpaca.markets) → free account banao → **Paper Trading** enable
2. App me **Connect Broker** → SnapTrade portal → **Alpaca** choose → login
3. Callback ke baad place-order **paper trade** chalega (risk engine + idempotency verified ✅)

---

## 🔗 Related Links
- [SnapTrade Docs](https://docs.snaptrade.com/) — getting started, authentication, request signatures
- [Personal vs Commercial](https://docs.snaptrade.com/docs/personal-vs-commercial)
- [Sandbox Guide](https://docs.snaptrade.com/docs/sandbox)
- [Request Signatures (HMAC)](https://docs.snaptrade.com/docs/request-signatures)
- Toroloom env vars: [`PRODUCTION_ENV_CHECKLIST.md`](./PRODUCTION_ENV_CHECKLIST.md) §2
- Deploy: [`RAILWAY_DEPLOY_RUNBOOK.md`](./RAILWAY_DEPLOY_RUNBOOK.md)

---

*Last updated: 2026-08-09. Toroloom abhi `SNAPTRADE_MODE=personal` par live hai — yeh guide partner keys ke liye ready hone par follow karo.*
