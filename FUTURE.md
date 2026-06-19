# 🔮 Toroloom — Future Roadmap

> **Vision:** Transform Toroloom from a trading dashboard into a comprehensive, institutional-grade fintech ecosystem where education, community, analytics, and execution converge seamlessly.

---

## 📖 1. Education & Learning Platform

### 1.1 Course Ecosystem
| Feature | Priority | Description |
|---------|----------|-------------|
| **Interactive Video Lessons** | High | Embed video players with transcripts, bookmarks, and speed controls |
| **Progress Tracking** | High | Save lesson progress per user, show completion % per course |
| **Quizzes & Assessments** | High | Auto-graded quizzes at end of each lesson with pass/fail thresholds |
| **Certificates** | Medium | Generate shareable completion certificates (PDF via `expo-print`) |
| **Learning Paths** | Medium | Curated sequences like "Beginners → Intermediate → Pro Trader" |
| **User-Generated Courses** | Low | Let power users create and publish their own courses |

### 1.2 Market Knowledge Hub
| Feature | Priority | Description |
|---------|----------|-------------|
| **Financial Calculators** | High | SIP calculator, Lumpsum calculator, EMI calculator, Tax calculator |
| **Glossary** | High | Searchable financial terms with definitions and examples |
| **News Feed** | Medium | Curated financial news with sentiment analysis |
| **IPO Calendar** | Medium | Upcoming IPOs with details, GMP, and subscription status |
| **Economic Calendar** | Medium | RBI meetings, inflation data, GDP releases |
| **Company Fundamentals** | Medium | P/E, P/B, ROCE, debt ratios, quarterly results viewer |

---

## 👥 2. Community & Social Trading

### 2.1 Social Features
| Feature | Priority | Description |
|---------|----------|-------------|
| **Post Reactions** | High | Like, bookmark, share posts beyond basic likes |
| **User Profiles** | High | Public profiles with trade history, badges, follower count |
| **Follow System** | Medium | Follow/unfollow traders and see their public activity |
| **Feed Algorithm** | Medium | Smart feed sorting (trending, recent, popular) |
| **Mentions & Notifications** | Medium | @mentions, reply notifications, post engagement alerts |
| **Polls & Q&A** | Low | Community polls on market sentiment, Q&A threads |

### 2.2 Social Trading (Copy Trading)
| Feature | Priority | Description |
|---------|----------|-------------|
| **Top Traders Leaderboard** | High | Ranking by returns, consistency, risk score |
| **Copy Portfolio** | High | Automatically mirror top traders' portfolios proportionally |
| **Trade Visibility** | Medium | Public trade feed with P&L, entry/exit, strategy notes |
| **Performance Analytics** | Medium | Sharpe ratio, max drawdown, win rate for public profiles |
| **Revenue Share** | Low | Profit-sharing model for signal providers |

---

## 📊 3. Advanced Analytics & Tools

### 3.1 Portfolio Analytics (Expand from Current)
| Feature | Priority | Description |
|---------|----------|-------------|
| **Tax Reporting** | High | Capital gains summary (short-term/long-term) with estimated tax liability |
| **Sector Allocation** | High | Pie chart showing sector-wise distribution with rebalancing suggestions |
| **Dividend Tracker** | Medium | Upcoming and historical dividend income calendar |
| **Monte Carlo Simulation** | Medium | Portfolio risk simulation with 10k scenarios |
| **Correlation Matrix** | Medium | Asset-to-asset correlation heatmap |
| **Factor Analysis** | Medium | Exposures to momentum, value, size, volatility factors |

### 3.2 Charting & Technical Analysis
| Feature | Priority | Description |
|---------|----------|-------------|
| **Interactive Charts** | High | Zoom, pan, indicators (RSI, MACD, Bollinger, SMA/EMA) |
| **Multi-Timeframe** | High | 1m, 5m, 15m, 1h, 1d, 1w, 1M candles |
| **Drawing Tools** | Medium | Trendlines, Fibonacci, support/resistance, annotations |
| **Chart Patterns** | Medium | Auto-detect patterns (head & shoulders, double top, flags) |
| **Screeners** | Medium | Stock screener by volume, RSI, gap %, 52W high/low |
| **Backtesting** | Low | Simple strategy backtester with historical data |

### 3.3 AI & Insights (Expand from Current)
| Feature | Priority | Description |
|---------|----------|-------------|
| **Multi-Provider AI** | High | Already integrated (OpenRouter + Gemini) — add GPT-4o, Claude |
| **Natural Language Queries** | High | "How is my portfolio doing?", "Show me tech stocks with RSI < 30" |
| **AI Trade Assistant** | Medium | Risk assessment, position sizing suggestions |
| **Earning Call Summaries** | Medium | AI-generated summaries of quarterly earnings transcripts |
| **Sentiment Analysis** | Medium | News and social media sentiment for watchlist stocks |
| **Personalized Recommendations** | Medium | "Based on your portfolio, you might like..." |

---

## 💳 4. Monetization & Premium

### 4.1 Subscription Tiers
| Feature | Priority | Description |
|---------|----------|-------------|
| **Free Tier** | High | Basic portfolio tracking, limited education, 5 watchlists |
| **Pro Tier** (₹399/mo) | High | Advanced analytics, AI insights, unlimited watchlists, priority support |
| **Elite Tier** (₹999/mo) | High | Real-time data, social trading, API access, tax reports, no ads |
| **In-App Purchases** | Medium | Individual course purchases, premium indicator packs |
| **Referral Program** | Medium | Earn credits when referred users subscribe |

### 4.2 Payment Integration
| Feature | Priority | Description |
|---------|----------|-------------|
| **UPI Autopay** | High | Recurring payments via UPI (Razorpay/PhonePe) |
| **Card Payments** | High | Credit/debit card via Stripe or Razorpay |
| **Trial Periods** | Medium | 7-day free trial for Pro tier |
| **Coupon System** | Medium | Discount codes, festive offers, referral bonuses |

---

## 🔌 5. Broker & Market Integration

### 5.1 Live Trading
| Feature | Priority | Description |
|---------|----------|-------------|
| **Zerodha Kite** | High | (Broker interface exists) — polish for production: OAuth, order placement flow, margin checks |
| **Angel One SmartAPI** | High | (Broker interface exists) — polish for production |
| **Groww / Upstox** | Medium | Additional broker onboarding |
| **Order Types** | High | Market, Limit, SL, SL-M, GTT (Good Till Triggered) |
| **Multi-Leg Orders** | Medium | Cover orders, bracket orders, straddles |
| **Intraday / Delivery** | Medium | Position type toggle per order |

### 5.2 Market Data
| Feature | Priority | Description |
|---------|----------|-------------|
| **Real-Time Streaming** | High | (Already implemented via WebSocket) — add more indices, forex, commodities |
| **Historical Data API** | Medium | 10+ years of daily/minute data for backtesting |
| **Options Chain** | Medium | Real-time options data with Greeks (delta, gamma, theta, vega) |
| **Futures Curve** | Low | Futures price curve across expiries |
| **Global Markets** | Low | US (S&P 500, NASDAQ), crypto prices |

---

## 🛡️ 6. Trust, Security & Compliance

### 6.1 Regulatory & Legal
| Feature | Priority | Description |
|---------|----------|-------------|
| **KYC Integration** | High | PAN verification, Aadhaar eKYC, DigiLocker integration |
| **SEBI Compliance** | High | Risk disclosure, advisory warnings, registration display |
| **Data Privacy** | High | GDPR-style data export/deletion, privacy policy (already live) |
| **Audit Trail** | High | (Already implemented) — immutable cryptographic chain of order events |

### 6.2 Security
| Feature | Priority | Description |
|---------|----------|-------------|
| **Biometric Auth** | High | Fingerprint / Face ID for app unlock + trade confirmation |
| **2FA** | High | TOTP-based two-factor authentication |
| **Session Management** | Medium | View active sessions, force logout from other devices |
| **Device Trust** | Medium | Trusted device list, new device notification |
| **Transaction PIN** | High | Separate 4-digit PIN for placing orders |
| **Fraud Detection** | Medium | Anomaly detection on login patterns, trade velocity |

---

## 🔧 7. Infrastructure & Platform

### 7.1 Performance & Reliability
| Feature | Priority | Description |
|---------|----------|-------------|
| **Offline Mode** | High | Cache portfolio/watchlist data for offline viewing |
| **Push Notifications** | High | (Already implemented) — price alerts, trade confirmations, news |
| **Background Sync** | Medium | Periodic refresh of portfolio values in background |
| **CDN for Assets** | Medium | Courses thumbnails, user avatars, market icons |
| **Rate Limiting** | Medium | Per-user API rate limits to prevent abuse |

### 7.2 Developer Platform
| Feature | Priority | Description |
|---------|----------|-------------|
| **Public API** | Medium | REST API for external portfolio tracking apps |
| **Webhook System** | Medium | Trade confirmations, price alerts via webhook |
| **Widget SDK** | Low | Embeddable portfolio widgets for websites |
| **Dark Mode** | High | (Already implemented) — refine with AMOLED black option |

### 7.3 DevOps & Observability
| Feature | Priority | Description |
|---------|----------|-------------|
| **Grafana Dashboards** | High | (Already implemented for WS + broker) — add app-level business metrics |
| **Sentry Error Tracking** | High | (Already integrated) — refine release tracking + source maps |
| **CI/CD Pipeline** | High | (Already implemented with GitHub Actions) — add deploy automation |
| **Feature Flags** | Medium | Gradual rollout of new features to user segments |
| **A/B Testing** | Low | Experiment framework for UI/UX changes |

---

## 📱 8. App Experience & UX

### 8.1 Core UX Improvements (In Progress)
| Feature | Priority | Description |
|---------|----------|-------------|
| **Inter Font Family** | ✅ Done | Geometric typography across all components |
| **Keyboard Dismiss** | ✅ Done | TouchableWithoutFeedback wrappers on all form screens |
| **Haptic Feedback** | ✅ Done | Light/Medium haptics on preset chips, nav items, transactions |
| **Animated Inputs** | ✅ Done | Border color transitions on focus, validation, error states |
| **SVG Logo** | ✅ Done | Abstract hex-tech geometric logo replacing Ionicons |
| **Search Overlay** | ✅ Done | Animated suggestion dashboard with backdrop blur |

### 8.2 Future UX Enhancements
| Feature | Priority | Description |
|---------|----------|-------------|
| **Onboarding Flow** | High | Interactive walkthrough for new users |
| **Skeleton Loading** | High | (Already implemented) — extend to remaining screens |
| **Pull to Refresh** | High | (Already implemented on most screens) |
| **Dark Mode Toggle** | Medium | Manual light/dark switch (currently follows system) |
| **Haptic Profiles** | Medium | User-selectable haptic intensity (subtle/medium/strong) |
| **Widgets (iOS/Android)** | Medium | Home screen widgets for portfolio snapshot |
| **Deep Linking** | Medium | Share stock details, posts via URL |
| **Landscape Mode** | Low | Chart-optimized landscape layout |
| **Accessibility** | Medium | VoiceOver/TalkBack support, dynamic type, contrast ratios |

### 8.3 New Screens & Features
| Feature | Priority | Description |
|---------|----------|-------------|
| **IPO Dashboard** | Medium | Active IPOs, apply via UPI, allotment status |
| **NFO Dashboard** | Low | New Fund Offers from AMCs |
| **Bond Dashboard** | Low | Government and corporate bond yields |
| **Currency Markets** | Low | USD/INR, EUR/INR real-time rates |
| **Commodity Markets** | Low | Gold, Silver, Crude prices |
| **Tax Harvesting Tool** | Medium | Auto-detect loss-harvesting opportunities |
| **SIP Management** | High | Create, modify, pause SIPs in mutual funds |
| **Step-Up SIP** | Medium | Auto-increase SIP amount annually |

---

## 🎯 9. Strategic Goals

### 9.1 Near-Term (Next 1-3 Months)
- [ ] **Payment integration** — Razorpay for UPI/card subscriptions
- [ ] **Onboarding flow** — Interactive tutorial for first-time users
- [ ] **Offline mode** — Cache portfolio, watchlist, recent trades
- [ ] **Interactive charts** — Technical analysis with indicators
- [ ] **1,000+ course library** — Partner with financial educators

### 9.2 Mid-Term (3-6 Months)
- [ ] **Social trading** — Copy trading, leaderboards, public profiles
- [ ] **Premium subscription** — Pro/Elite tiers with payment gateways
- [ ] **Footprint expansion** — Web app (PWA) for desktop traders
- [ ] **Options trading** — Options chain, Greeks, strategy builder
- [ ] **Community growth** — Verified trader badges, AMA sessions

### 9.3 Long-Term (6-12 Months)
- [ ] **Wealth management** — Goal-based investing, retirement planning
- [ ] **Advisory marketplace** — SEBI-registered advisors on platform
- [ ] **API marketplace** — Third-party integrations via open API
- [ ] **International markets** — US stocks, ETFs (via finvasia/Vested)
- [ ] **Neobank integration** — Savings account, FD, insurance cross-sell

---

## 🏗️ 10. Architecture & Technical Debt

### 10.1 Frontend
| Task | Priority | Description |
|------|----------|-------------|
| **TypeScript strict** | Medium | Enable `strict: true` and fix all errors |
| **Component library** | Medium | Extract reusable design system to `@toroloom/ui` package |
| **Storybook** | Low | Component documentation with visual regression tests |
| **Internationalization** | Medium | i18n with react-native-i18n for Hindi + other Indian languages |
| **Reanimated 4 migration** | Medium | Already on Reanimated 4 — use shared value patterns consistently |

### 10.2 Backend
| Task | Priority | Description |
|------|----------|-------------|
| **Rate limiting** | High | Per-user + per-IP rate limiting for all routes |
| **Request validation** | High | Zod schemas for all request/response types |
| **Caching layer** | Medium | Redis for market data caching, session cache |
| **Message queue** | Medium | Bull/BullMQ for order processing, notification delivery |
| **WebSocket clustering** | Medium | Redis pub/sub for multi-instance WS broadcasting |
| **Database migrations** | Medium | Structured migration system for Postgres schema changes |

### 10.3 Testing
| Task | Priority | Description |
|------|----------|-------------|
| **API integration tests** | High | (Currently 131 integration tests) — add route-level E2E |
| **E2E test coverage** | Medium | Expand Maestro flows for all critical user journeys |
| **Performance benchmarks** | Medium | Latency P50/P95/P99 for order placement, quote delivery |
| **Load testing** | Medium | Simulate 10k concurrent users on WebSocket bridge |

---

> **⚡ Note:** This is a living document. Priorities will shift based on user feedback, market conditions, and business goals. Each quarter, review and update with actual progress and new opportunities.

---

*Last updated: June 15, 2026*
