# 📑 Toroloom — Investor Pitch (One-Page)

> **For: angel/seed investor or first call.** Ek page me pura pitch.

---

## 🎯 The Product

**Toroloom** — AI-powered trading & investment platform (Android mobile, India-first, bilingual EN/हिंदी).
Combines options/F&O terminal, social copy-trading, portfolio analytics, mutual funds, advisory booking, and AI assistance — the feature surface of apps that took established teams **12–24 months** to build.

---

## 📊 Numbers (Verified Aug 24, 2026)

| | |
|---|---|
| Source code | **~385,000 LOC** (TypeScript strict, 0 errors) |
| Test suite | **5,646 automated tests** (100% pass) |
| Release APK | **66.8 MB** (arm64-v8a, Hermes minified) |
| Production deps | 82 (mobile + backend) |
| Quality gates | ✅ typecheck · ✅ tests · ✅ release build |

---

## 🏗 What's Inside (38 Modules)

- **Trading Core** — Options chain w/ live Greeks · Monte Carlo · Backtest engine · Factor analysis · Smart alerts · Tax-loss harvesting (FY25-26)
- **Investing** — Mutual funds · IPO/NFO · Wealth reports · Forex · Portfolio analytics · Calculators
- **Social & Advisory** — Copy-trading · SEBI-verified advisor marketplace · Achievements · Referrals · Academy
- **Platform** — Full KYC (Aadhaar eKYC, camera) · Payments · Biometric · Push · **Offline-first sync** · WebSocket w/ mock fallback · Bilingual EN/हिंदी · Dark-luxury theme
- **AI Layer** — In-app assistant · Sentiment insights · SnapTrade broker integration

---

## 💡 Engineering Highlights

- **Offline-first architecture** — mutation queue + optimistic sync + cache warming
- **Quant-grade math** — Greeks, Monte Carlo, factor analysis, backtests (in-house implementation, not library-wrapped)
- **100% test pass** at this stage — rare; most startups ship at <50% coverage
- **Strict TypeScript** — zero `any`-slop
- **ToS-safe social** — human-gated flows, no auto-trading bot violations

---

## 💵 Replacement Cost

| Component | USD |
|---|---|
| Trading terminal + charts + Greeks | $60k – $90k |
| Social/copy-trading + advisory marketplace | $40k – $70k |
| KYC + payments + broker integrations | $30k – $55k |
| Mutual funds / IPO / wealth | $30k – $45k |
| AI layer + offline-first infra | $25k – $40k |
| **Conservative total** | **$185k – $300k** |

Plus 12-24 months of dev time at market rates.

---

## 🎯 Market

- India retail trading accounts: **~70M+** (groww, zerodha user base combined)
- Daily active traders on NSE/BSE: **~5M+**
- Underserved: regional-language users (Hindi tier-2/3 cities) — Toroloom is **bilingual out-of-box**
- Regulatory tailwind: SEBI advisory registration framework creating demand for verified-advisor marketplaces

---

## 🧠 Why Now

1. **Zerodha/Groww incumbents** don't offer social/advisory in EN+Hindi
2. **AI layer** is just now capable enough to do real-time sentiment + broker integration
3. **SEBI RA registration** (~₹5-10L cost) opens advisor marketplace — Toroloom's already wired for it
4. **Bilingual UX** = structural moat in tier-2/3 markets

---

## 🚀 Ask

Acquisition / strategic investment — see `MARKET_VALUE_REPORT.md` (full breakdown) and `ENTERPRISE_TRANSFER.md` (transfer blueprint).

---

## 📚 Deep Dives

| For | Read |
|-----|------|
| Full feature list | `docs/FEATURE_CHECKLIST.md` |
| Verified metrics + replacement cost | `MARKET_VALUE_REPORT.md` |
| Architecture + tech stack | `README.md` |
| Buyer onboarding | `LICENSE-READY.md`, `BUYER_SETUP_GUIDE.md` |
| Acquisition blueprint | `ENTERPRISE_TRANSFER.md` |
| Future roadmap | `FUTURE.md` |

---

> 📧 **Contact:** github.com/ksjii666777-bit/toroloom