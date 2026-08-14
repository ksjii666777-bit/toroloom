# Toroloom — Feature Overview

> **Buyer ke liye:** Yeh document Toroloom app ke sabhi features ka high-level overview hai. Har feature implement ho chuka hai aur tests cover karte hain.

**Stats (as of August 14, 2026):**
- **Frontend Screens:** 144 | **Stores:** 46 | **Services:** 74
- **Backend Routes:** 50 | **Backend Modules:** 16
- **Frontend Tests:** 228 files | **Backend Tests:** 106 files (74 unit + 32 integration)
- **E2E Flows (Maestro):** 33 files
- **Total Tests:** 8,202 passing (334 test files + 33 E2E flows)

---

## 1. 🔐 Authentication & Security
| Area | Features | Status |
|------|----------|--------|
| **User Auth** | Login/Signup, JWT tokens, Forgot password, Deep link referral | ✅ |
| **2FA** | TOTP setup/verify, Backup codes, Enable/disable | ✅ |
| **Biometric** | Face ID / Fingerprint unlock, Settings persistence | ✅ |
| **Security Settings** | Session management, Security settings screen | ✅ |

## 2. 📱 Navigation & Core UI
| Area | Features | Status |
|------|----------|--------|
| **Navigation** | Bottom tabs (5), Auth stack, Onboarding flow, 50+ screens | ✅ |
| **Theme** | Dark/Light mode, Theme store | ✅ |
| **UI Components** | Button, Input, Card, Badge, Skeleton, AnimatedPressable, Avatar, Logo | ✅ |
| **Modals** | Iron Lock overlay, Upgrade prompt, Offline banner | ✅ |

## 3. 📊 Market Data
| Area | Features | Status |
|------|----------|--------|
| **Screens** | Home dashboard, Markets, Stock detail, Stock screener, News feed | ✅ |
| **Charts** | Candlestick (SVG + Skia GPU), Line, Area, Heikin-Ashi, Crosshair, MA, Volume | ✅ |
| **Tech Indicators** | RSI, MACD, Bollinger Bands, Drawing tools, Pattern detection | ✅ |
| **Real-time** | WebSocket prices, Mock WS service, WS registry | ✅ |

## 4. 💼 Portfolio
| Area | Features | Status |
|------|----------|--------|
| **Screens** | Holdings view, P&L summary, P&L chart | ✅ |
| **Analytics** | Win/loss, P&L aggregation, Sector concentration, Tax summary (STCG/LTCG), Monthly returns | ✅ |
| **Caching** | Redis cache-aside for analytics, Cache metrics | ✅ |

## 5. 👁️ Watchlist
| Area | Features | Status |
|------|----------|--------|
| **Screens** | Watchlist tab, Empty state | ✅ |
| **API** | CRUD watchlists, Add/remove stocks | ✅ |

## 6. 💹 Trading (Equity)
| Area | Features | Status |
|------|----------|--------|
| **Order Placement** | Buy/Sell toggle, MARKET/LIMIT/SL/SL-M, CNC/MIS, Quantity presets, Cost summary, Confirmation | ✅ |
| **Order Management** | Open orders, Modify/Cancel, Trade history | ✅ |
| **Pipeline** | 5-stage execution, Validation, Risk check, Pre-order hooks | ✅ |
| **Idempotency & Order Safety** | Idempotency keys on equity/FnO/SnapTrade orders, claim-based dedup (PENDING→COMPLETED, 24h TTL, stale auto-release), risk-rejected → BLOCKED result (no 429/500), offline replay safety | ✅ |

## 7. 📈 F&O (Futures & Options)
| Area | Features | Status |
|------|----------|--------|
| **Options Chain** | NIFTY/BANKNIFTY, Greeks (Delta/Gamma/Theta/Vega/Rho), Strike selection, Expiry switching | ✅ |
| **Strategy Builder** | 10 pre-built strategies, Multi-leg P&L chart, Analyze | ✅ |
| **API** | Futures, Order placement, Positions, Market status, Spot prices | ✅ |

## 8. 🏦 Broker Integration
| Area | Features | Status |
|------|----------|--------|
| **Connect** | Zerodha, Angel One, Groww — WebView session sync, Keychain storage, Proxy client | ✅ |
| **Plugin System** | Dynamic registry, 5 plugins (Zerodha, Angel, Groww, IBKR, Mock), Factory with failover | ✅ |

## 9. 🧠 AI & Insights
| Area | Features | Status |
|------|----------|--------|
| **Analysis** | L1→L2→L3 cognitive analysis, OpenRouter + Gemini providers, Insight cache | ✅ |
| **Screens** | AI Insights screen, Batch analyze | ✅ |

## 10. 📚 Education
| Area | Features | Status |
|------|----------|--------|
| **Screens** | Course catalog, Course detail, Lesson view | ✅ |
| **Data** | 90+ lessons, Categories, Progress tracking | ✅ |

## 11. 💰 Funds & Payments
| Area | Features | Status |
|------|----------|--------|
| **Funds** | Dashboard, Add/Withdraw/Transfer, UPI, Transaction history | ✅ |
| **Payments** | Razorpay integration (cards, UPI, netbanking), Webhook handler | ✅ |

## 12. 🔄 Social Trading
| Area | Features | Status |
|------|----------|--------|
| **Screens** | Social feed, Trader profiles, Leaderboard | ✅ |
| **Copy Trading** | Follow/unfollow, Start/stop/pause/allocation, My copy trades | ✅ |

## 13. 👥 Community & Chat
| Area | Features | Status |
|------|----------|--------|
| **Community** | Posts, Likes, Comments | ✅ |
| **Chat** | Room list, Room screen, Behavioral journal | ✅ |

## 14. 🔐 KYC
| Area | Features | Status |
|------|----------|--------|
| **Screens** | PAN, Aadhaar (OTP), DigiLocker, Bank linking | ✅ |
| **Backend** | 14 KYC endpoints, IFSC verification, Status tracking | ✅ |

## 15. 🎫 Subscriptions
| Area | Features | Status |
|------|----------|--------|
| **Tiers** | Free/Pro/Elite, Razorpay billing, Upgrade prompt modal | ✅ |
| **Gating** | Subscription middleware, 402 Payment Required interceptor | ✅ |

## 16. 📋 Reports
| Area | Features | Status |
|------|----------|--------|
| **Screens** | Reports dashboard, Contract note parser (PDF + paste-text) | ✅ |
| **Export** | CSV export, Trade ledger parser | ✅ |

## 17. 🔔 Notifications
| Area | Features | Status |
|------|----------|--------|
| **Screens** | In-app list, Preferences, Portfolio alerts | ✅ |
| **Push** | Expo push notifications, Background fetch, Badge count | ✅ |

## 18. ⚙️ Risk Management
| Area | Features | Status |
|------|----------|--------|
| **Engine** | P&L tracking, Daily loss limit, Position size limits, Iron Lock auto-lockdown | ✅ |
| **Settings** | Risk settings screen, Custom limits | ✅ |

## 19. 🔐 Audit Trail
| Area | Features | Status |
|------|----------|--------|
| **System** | Immutable append-only log, Cryptographic hash chain, PG + Mongo persistence | ✅ |

## 20. 🏗️ Backend Infrastructure
| Area | Features | Status |
|------|----------|--------|
| **Storage** | In-memory, PostgreSQL, MongoDB — swappable via `STORAGE_BACKEND` env var | ✅ |
| **Middleware** | JWT auth, Rate limiting (4 tiers), Subscription gating, Error handler, Redis cache, Order idempotency (in-memory + Redis) | ✅ |
| **WebSocket** | Auth, Subscribe/ticks, Ping/pong, P&L bridge, Cluster IPC, Redis Pub/Sub | ✅ |
| **Monitoring** | Prometheus metrics, Health endpoint, Sentry, Circuit breaker, DB provider | ✅ |
| **Cluster** | Multi-worker, Graceful shutdown, Auto-restart | ✅ |

## 21. 🧮 Calculators
| Area | Features | Status |
|------|----------|--------|
| **Tools** | SIP, Lumpsum, EMI, Tax calculator | ✅ |

## 22. 🏆 Gamification
| Area | Features | Status |
|------|----------|--------|
| **Features** | Achievements screen, XP system, Badge display | ✅ |

## 23. 📱 Onboarding
| Area | Features | Status |
|------|----------|--------|
| **Flow** | Lottie animations, Illustrations, AsyncStorage persistence | ✅ |

## 24. 🛠️ Settings & Profile
| Area | Features | Status |
|------|----------|--------|
| **Screens** | Profile, More menu, Help, Voice settings, Tenant config, Mutual funds | ✅ |
| **Offline** | Connectivity detection, Offline cache, Mutation queue | ✅ |

## 25. 🌐 Web App (PWA)
| Area | Features | Status |
|------|----------|--------|
| **Support** | react-native-web, PWA icons, Web manifest, Expo web bundler | ✅ |

## 26. 🚀 Deployment & DevOps

| Category | Details | Status |
|----------|---------|--------|
| **Docker** | Backend Dockerfile, Dev Compose (PG, Mongo, Redis, PgBouncer), Prod Compose (+ Caddy, Prometheus, Grafana) | ✅ |
| **Kubernetes** | Deployment, Service, Ingress, HPA, ConfigMap, Secrets, Kustomization | ✅ |
| **Terraform** | RDS provisioning, VPC + subnets, Bootstrap module | ✅ |
| **CI/CD** | GitHub Actions (backend, frontend, integration, stress, E2E), Railway config, Render | ✅ |
| **Database** | PG init migration, PgBouncer config, Cache warming, RDS migration script | ✅ |
| **Load Testing** | HTTP (autocannon), Analytics, WebSocket traffic generator | ✅ |

## 27. 🏪 App Store Readiness

| Category | Details | Status |
|----------|---------|--------|
| **iOS** | Bundle ID (com.toroloom.app), Privacy descriptions, Icons, Deep linking | ✅ |
| **Android** | Package name, Adaptive icons, Google Services | ✅ |
| **EAS** | Build config (dev/preview/production), Deep link setup | ✅ |
| **Listings** | Apple App Store + Google Play Store listing text, Screenshots script | ✅ |
| **Legal** | Privacy policy, Terms of service | ✅ |

## 28. 🧪 Testing Overview

| Category | Count | Status |
|----------|-------|--------|
| Frontend unit tests | 228 files (5,597 tests) | ✅ |
| Backend unit + cross-file + stress | 74 files (1,850 tests) | ✅ |
| Backend integration (PG + Mongo) | 32 files (755 tests) | ✅ |
| E2E (Maestro) | 33 flows | ✅ |
| **Total** | **8,202 tests passing** | ✅ |

---

## 📊 Summary

```
Frontend Screens:     144 ✅     Backend Routes:     50 ✅
Zustand Stores:       46 ✅     Backend Modules:    16 ✅
UI Components:        35 ✅     Tests:          8,202 ✅
Services:             74 ✅     E2E Flows:         33 ✅
```

> **App 95%+ complete hai.** Buyer ko sirf deploy karna hai (Railway ya Docker) aur production DB (RDS) setup karna hai.
