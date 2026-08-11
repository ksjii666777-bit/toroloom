# 🎉 Toroloom v1.0.0 — Release Notes

> **Toroloom** — AI-powered trading & investment platform. React Native (Expo) mobile app + Node.js/Express backend, live broker connectivity, real-time market data, and full English/Hindi support.

## ⭐ Highlights

- 📈 **Live TradingView charts** — real market data charts on Stock Detail (with toggleable options), Bond Dashboard yield charts (US/DE 10Y, 2Y, 30Y) and Commodity Markets (Gold, Silver, Crude, Nat Gas, Copper)
- 🏦 **SnapTrade broker integration** — SDK v11, personal API-key mode, real orders/positions/holdings with ₹0 max-position-size risk guard
- 🌐 **Full Hindi (हिन्दी) i18n** — 109 namespaces, en+hi parity, plural variants & dynamic-string coverage
- 🖥️ **Live web demo on GitHub Pages** — real app components in the browser: SIP/EMI/Lumpsum/Tax/StepUp-SIP calculators, forex converter, live theme + language toggle
- 🔌 **Real-time data pipeline** — WebSocket-first market data with automatic mock fallback, forex tick streaming across all brokers
- 🛡️ **Order safety & idempotency** — equity/FnO/SnapTrade orders protected against double-submission

## 🚀 What's New

### Trading & Markets
- Live TradingView charts (stock detail, bonds, commodities) with symbol/timeframe selectors
- Real WebSocket price streaming with graceful offline fallback
- Forex tick streaming — 8 INR pairs + 3 crosses, adaptive precision
- Live forex rates wired into CurrencyMarkets + shared converter

### Broker Connectivity (SnapTrade)
- Personal API key mode (SDK v11) + full session hardening
- Live orders, positions, holdings, balances — adapted to v11 response shapes
- Universal symbol mapping for order placement

### Platform
- Public API v1 + hosted API docs
- Order idempotency + portfolio-value-at-open risk seeding
- AI Insights, Sentiment Analysis, Earnings Call screens with loading/empty/error states
- Premium UI/UX — glass tab bar, reorganized MoreScreen, Home priority grid
- Sync status pills on Markets/Portfolio/Watchlist headers

### Web Demo (browser)
- Interactive calculators: SIP, EMI, Lumpsum, Tax, Step-Up SIP, Currency Converter
- TradingView Lightweight Charts (live tick simulation) + Advanced Chart widget (real data)
- Real `useTheme()` toggle + en↔hi live language toggle
- Live at: **https://ksjii666777-bit.github.io/toroloom/web-demo/**

## 🛠️ Fixes & Improvements

- 200+ frontend/backend TypeScript & ESLint fixes (unused imports, real bugs, null-WS guards)
- Production Postgres readiness: `/ready` healthcheck, startup migrations, Docker + Railway guides
- Secure production configs — fail-fast secrets, safe k8s templates
- Date.now() ID collision audit across stores, screens & backend routes
- Razorpay stale Android build artifacts auto-cleaned via postinstall
- EAS Android build fixes (incremental compilation, lockfile registry)

## 📚 Localization

- Full Hindi conversion of screens, components & dynamic strings
- Plural variant cleanup (`_plural` → `_other`), relative-time helpers
- Automatic en↔hi parity checks in CI

## 🔐 Security & Compliance

- **DPDP Act 2023** privacy policy — data retention, user rights, breach notification, grievance officer
- KYC flow, 2FA, secure bank linking
- Sentry error tracking with EAS sourcemap upload

## 🧪 Testing & CI

- **5,581 unit tests / 227 test files** — all green ✅
- Maestro E2E flows on Android emulator (KVM CI pipeline)
- Coverage thresholds enforced + live coverage badges
- Integration suites for Postgres/Mongo broker states

## 📦 Deployment

- Railway-ready: Postgres + Redis, Dockerfile, healthchecks
- Kubernetes manifests (configmap, secrets, HPA, ingress)
- GitHub Pages hosting for web-demo + legal pages
- One-command redeploy: `npm run deploy:pages`
