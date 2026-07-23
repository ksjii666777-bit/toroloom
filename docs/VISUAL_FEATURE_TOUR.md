# 🎨 Toroloom — Visual Feature Tour

> **Total Screens:** 58+ | **Dark Theme:** Yes | **Light Theme:** Yes  
> **Design Language:** Glassmorphic cards, Gradient accents, Neon glow effects, Dark mode optimized

---

## 📸 Screenshots Status

> ⚠️ PNG screenshots capture nahi hui hain abhi. Generate karne ke liye:
> ```bash
> # Emulator chalao + Expo dev server
> npx expo start --android
> # Doosre terminal mein:
> bash scripts/capture-screenshots.sh
> ```
> Output: `store/screenshots/` folder mein
>
> Neeche har screen ka **visual description** diya hai — aap dekh sakte hain ki kaisa dikhega.

---

## 📱 NAVIGATION STRUCTURE

```
┌─────────────────────────────────────────────────┐
│              Bottom Tab Navigator                │
├────────┬────────┬────────┬────────┬──────────────┤
│  🏠   │  📈   │  💼   │  ❤️   │    📱        │
│ Home   │Markets │Portfolio│Watchlist│   More      │
├────────┴────────┴────────┴────────┴──────────────┤
│              Stack Navigator (60+ screens)       │
│  Auth → Onboarding → Tabs → Detail Screens      │
└─────────────────────────────────────────────────┘
```

---

## 1. 🔐 SPLASH SCREEN

| Detail | Description |
|--------|-------------|
| **BG** | Dark gradient `#070B15 → #0D1520 → #0A0E1A` |
| **Logo** | Custom SVG Metallic Shield with Cyberpunk Cyan (#00F0FF) + Premium Gold (#FFD700) neon rings |
| **Animation** | Shield scales up with spring, scanning line moves across, ambient particle star field (20 particles) |
| **Effects** | Cyan glow pulse (1.2s loop), Gold glow pulse (1.5s loop), neon rings |
| **Text** | "Toroloom" (38px, bold white), tagline "AI-Powered Trading Shield" |
| **Progress** | Bottom progress bar with bootstrapping diagnostics (6 steps cycling) |
| **Version** | v1.0.0 at bottom |

---

## 2. 🔑 AUTH SCREENS

### Login Screen

| Element | Visual |
|---------|--------|
| **Layout** | Centered with scroll, keyboard-avoiding |
| **Header** | LinearGradient logo container with ToroloomLogo SVG, app name, tagline |
| **Form** | Email + Password Inputs with icons, animated border on focus |
| **Social Login** | Divider "or continue with" + Google/Apple/Facebook buttons |
| **Extras** | Forgot password link, error box with alert icon, Sign up link at bottom |

### Signup Screen

| Element | Visual |
|---------|--------|
| **Layout** | Back button top-left, scrollable form |
| **Form** | Full name, Email, Phone, Password, Confirm Password inputs |
| **Extras** | Referral banner (shown when deep link has `?ref=`), terms checkbox, Login link |
| **Validation** | Password match, min length 6, field required errors |

---

## 3. 👋 ONBOARDING SCREEN

| Feature | Description |
|---------|-------------|
| **Flow** | Horizontal pager with 5+ interactive demo steps |
| **Step 1** | 🎯 **Welcome** — Animated Lottie/SVG illustrations, app intro |
| **Step 2** | 📊 **Mini Pie Chart** — Tap sectors (Tech 45%, Finance 25%, Energy 18%, Health 12%) to see details |
| **Step 3** | 📈 **Mini Candlestick** — 7-day chart with OHLC data, tap candles for details |
| **Step 4** | 💹 **Mock Trade Panel** — Buy/Sell toggle, quantity selector (+/− 5), order total, confirm button with bounce animation |
| **Step 5** | 🔗 **Broker Connect** — 3 broker cards (Zerodha, Angel One, Groww) with gradient backgrounds, tap to simulate connection |
| **Step 6** | ⚖️ **R:R Ratio Selector** — Pill chips for 1:1.0 to 1:3.0, visual loss→ratio→profit arrow flow, profit cap toggle switch |
| **Step 7** | 🏆 **Badges** — 4 badge cards (First Trade, 3-Day Streak, Learner, Market Pro), tap to unlock with bounce animation |
| **Step 8** | 🚀 **Rocket Launch** — Animated rocket with flame effects, tap to launch |

---

## 4. 🏠 HOME SCREEN (Main Tab)

| Section | Visual Description |
|---------|-------------------|
| **Header** | Dynamic greeting (Morning/Afternoon/Evening) + user name + waving hand. Market status badge (green dot = open, red = closed) |
| **Notifications** | Bell icon with badge count, avatar circle top-right |
| **Portfolio Card** | Glassmorphic card with cyan glow effect. Portfolio value in Cr/L/K format. P&L chip with caret icon. Count-up animation on value |
| **Quick Actions** | 4 glass-pillar buttons: Buy (green), Sell (red), SIP (primary), Learn (warning) with icons |
| **Search Bar** | Stock search with filtered results showing symbol, name, price, change |
| **Market Breadth** | 4 mini cards: Advancing (green), Flat (grey), Declining (red), A/D Ratio |
| **Market Indices** | Horizontal scroll of MarketCards with index name, price, change % |
| **Sector Heatmap** | Top 6 sectors with intensity-based colored bars (green/red gradient), stock count |
| **Financial Calculators** | Horizontal cards: SIP, Lumpsum, EMI, Tax calculators with icons |
| **AI Insight** | Card with bulb icon, sentiment badge (bullish/bearish/neutral), confidence %, analysis summary |
| **Live Sentiment Feed** | Real-time updating feed (new events every 4-7s). Each event: direction icon (up/down), symbol, magnitude pts, source badge, score chip |
| **Sentiment Alerts** | Collapsible card. Active rules count, latest alert preview. Quick add button + view all. Modal for adding new rules |
| **Level & XP** | Progress bar with current XP towards next level |

---

## 5. 📈 MARKETS SCREEN

| Element | Visual |
|---------|--------|
| **Indices** | Horizontal scrollable cards with price, change %, sparkline mini-chart |
| **Stocks** | Scrollable list with symbol, name, price, change % (colored green/red), sector badge |
| **Charts** | Tap for detail view with candlestick/line/area charts |

---

## 6. 💼 PORTFOLIO SCREEN

| Section | Visual |
|---------|--------|
| **Summary** | Total invested, current value, day's P&L with large number display |
| **Holdings** | List with stock name, quantity, avg cost, current price, P&L %, P&L amount |
| **P&L Chart** | Interactive area/line chart showing portfolio value over time |
| **Analytics** | Win/Loss ratio, sector concentration pie chart, tax summary (STCG/LTCG) |
| **Actions** | Add funds, withdraw, transfer buttons |

---

## 7. ❤️ WATCHLIST SCREEN

| Element | Visual |
|---------|--------|
| **Stocks** | List of watched stocks with real-time price updates, change % |
| **Empty State** | Illustration + "Add stocks to your watchlist" message |
| **CRUD** | Add/remove stocks, create multiple watchlists |

---

## 8. 📱 MORE SCREEN (Hub)

| Section | Visual Description |
|---------|--------------------|
| **Profile Card** | Glassmorphic card with avatar circle, name, email, Level badge, KYC verified badge |
| **Quick Actions** | 5 pillar buttons: Add Funds, Withdraw, Transfer, UPI, Dark Mode |
| **Balance Card** | Available balance in L format + Add/Withdraw buttons |
| **Investments Section** | Grid of 20+ items: Fund Dashboard, Mutual Funds, SIPs, F&O, Strategy Builder, Trade History, Open Orders, Reports, Monte Carlo, Correlation Matrix, Portfolio Rebalancing, Factor Analysis, US Markets, Bonds, Currency, Tax Harvesting, Dividends, Commodities, Futures Curve |
| **Learn & Grow** | 14 items: Courses, Community, Revenue Dashboard, Polls, Chat, AI Insights, AI Assistant, News, IPO Dashboard, IPO Calendar, Economic Calendar, Glossary, Trading Journal, Achievements |
| **Account** | 20+ items: Profile/KYC, Refer & Earn, Premium, Payment History, Notifications, Portfolio Alerts, Risk Settings, Widget, Connect Broker, Telegram, Tour, Voice, AI Settings, Security, Help, Tenant Config, Feature Flags, A/B Tests, Accessibility, CDN, Landscape, API Keys, Webhooks |
| **Language** | Card with EN/HI toggle switch |
| **Achievements** | Badge preview grid (up to 8 badges, locked = grey with lock icon) |
| **Logout** | Red logout button at bottom |

---

## 9. 📊 STOCK DETAIL SCREEN

| Section | Visual Description |
|---------|--------------------|
| **Header** | Back button, Live/Offline connection badge (green/red dot), watchlist heart toggle |
| **Stock Info** | Symbol, company name, sector badge |
| **Price Section** | Large price with change % badge (colored green/red), caret icon |
| **Chart** | Full interactive candlestick chart (Skia GPU accelerated), 9 timeframes (1m to Max), chart type toggle (Candlestick/Line/Area/Heikin-Ashi) |
| **Technical Indicators** | Toggle RSI, MACD, Bollinger Bands, SMA/EMA on chart |
| **Drawing Tools** | Trendlines, Fibonacci, support/resistance, annotations |
| **Pattern Detection** | Auto-detect head & shoulders, double top/bottom, flags |
| **Key Stats** | Day High/Low, 52W High/Low, Volume, Market Cap, P/E, P/B, Dividend Yield |
| **AI Insight** | Bullish/Bearish/Neutral with confidence %, analysis text, target prices with probability bars |
| **Sector Context** | Sector rank, avg change, best/worst stock in sector, sector comparison |
| **Peer Comparison** | 5 peer stocks with price, change %, comparison bars |
| **Bottom Bar** | Sticky Buy/Sell buttons |

---

## 10. 📈 F&O OPTIONS CHAIN SCREEN

| Section | Visual Description |
|---------|--------------------|
| **Header** | Back button, "F&O Trading" title, Strategy Builder shortcut button |
| **Symbol Selector** | Horizontal scroll chips: NIFTY, BANKNIFTY, RELIANCE, HDFCBANK, INFY, TCS, SBIN, TATAMOTORS |
| **Spot Price Banner** | Compact bar showing spot price, PCR, Max Pain, CE OI total, PE OI total |
| **View Tabs** | 3 tabs: Option Chain, Futures, Positions |
| **Expiry Selector** | Horizontal scroll chips with date, days to expiry, monthly indicator |
| **Side Filter** | All/CE/PE toggle + Greeks toggle button |
| **Option Chain** | Strike price in center, CE LTP + OI/Volume on left, PE LTP + OI/Volume on right. ATM strikes highlighted with primary color and "ATM" badge. Greeks view shows Delta, Gamma, Theta, IV |
| **Futures View** | Contract list with LTP, OI, Basis (premium/discount) |
| **Positions View** | Open positions with LONG/SHORT badge, symbol, strike, type, P&L (green/red), Qty, Entry, LTP, P&L% |
| **Order Modal** | Bottom sheet with contract info, Greeks preview (Delta/Gamma/Theta/Vega), lot quantity selector (+/−), total premium calculation, Cancel/Buy/Sell buttons |

---

## 11. 🧠 AI INSIGHTS SCREEN

| Element | Visual |
|---------|--------|
| **Header** | Title "AI Market Insights" with subtitle |
| **Overview Card** | Gradient card with bulb icon, bullish/bearish/neutral counts |
| **Insights List** | Per-stock cards with symbol, name, sentiment badge (🟢 bullish/🔴 bearish/🟡 neutral), confidence %, summary, analysis text, date |
| **Target Prices** | Up to 3 targets with probability bars |

### Additional AI Screens
- **AI Chat** — Conversational interface for market queries
- **AI Trade Assistant** — Risk assessment, position sizing suggestions
- **Earnings Call Summaries** — AI-generated call transcripts
- **Sentiment Analysis** — News/social sentiment for watchlist stocks
- **Sentiment Alerts** — Custom alert rules with direction filter
- **Live Feed** — Real-time sentiment event stream

---

## 12. 📚 LEARNING HUB (Learn Tab)

| Section | Visual Description |
|---------|--------------------|
| **Header** | "Learning Hub" title, "Master the markets" subtitle |
| **Continue Learning** | Horizontal scroll of in-progress courses with gradient background, progress bar, % complete |
| **Learning Paths** | Purple gradient card with stats: Paths count, Courses, Lessons, Learners. Arrow icon |
| **My Courses** | Teal gradient card with Create/Lessons/Quizzes/Publish feature row |
| **Community Courses** | Blue gradient card with Featured/Filter/Search/Enroll row |
| **All Courses** | Grid with course cards: thumbnail with level-based gradient (green/yellow/red), title, level badge, duration, lessons count, enrolled count, rating stars, progress bar |

### Additional Education Screens
- **Course Detail** — Hero gradient, progress stats (Completed/Remaining/Duration), lessons list with status (checkmark/number), next lesson badge, quiz tag, Continue button
- **Lesson View** — Video player (expo-video), transcripts, bookmarks, speed controls
- **Quiz** — Auto-graded with pass/fail thresholds, result screen
- **Glossary** — Searchable financial terms with definitions
- **Certificate** — PDF generation via expo-print
- **Create Course** — User-generated course creation form
- **Admin Review** — Approve/reject/feature user-submitted courses

---

## 13. 🏆 CALCULATORS

| Calculator | Features |
|------------|----------|
| **SIP Calculator** | Monthly investment, expected return, tenure → Future value, total invested, wealth gain |
| **Step-Up SIP** | Annual increase %, SIP parameters → Enhanced future value |
| **Lumpsum Calculator** | One-time investment, return rate, tenure → Final amount |
| **EMI Calculator** | Loan amount, rate, tenure → EMI, total interest, total payment |
| **Tax Calculator** | STCG/LTCG gains, income slab → Tax liability estimate |

---

## 14. 💰 FUNDS & PAYMENTS

| Screen | Visual |
|--------|--------|
| **Funds Dashboard** | Balance display, recent transactions |
| **Add Funds** | Amount input, Razorpay integration (cards/UPI/netbanking) |
| **Withdraw** | Bank selection, amount input |
| **Transfer** | Between accounts, UPI transfer |
| **UPI** | UPI ID entry, QR code display |
| **Transaction History** | Filterable list with date, type, amount, status badges |
| **Payment History** | Subscription payment records |

---

## 15. 🔄 SOCIAL TRADING

| Screen | Features |
|--------|----------|
| **Social Feed** | Posts with likes, comments, share. Trending/recent sort |
| **Leaderboard** | Top traders by returns, consistency, risk score |
| **Trader Profiles** | Public profile with trade history, followers, badges |
| **Copy Trading** | Follow/unfollow, start/stop/pause, allocation %, my copy trades |
| **Revenue Dashboard** | Profit-sharing earnings, signal provider analytics |
| **Polls** | Community sentiment polls, Q&A threads |

---

## 16. 👥 COMMUNITY & CHAT

| Screen | Visual |
|--------|--------|
| **Community** | Posts feed, like/comment/bookmark, share |
| **Post Detail** | Full post view, comments thread |
| **Chat Rooms** | Room list with unread counts, last message preview |
| **Chat Room** | Real-time messaging with typing indicators |
| **Behavioral Journal** | Trading psychology notes, emotional state tracking |

---

## 17. 🔐 KYC SCREENS

| Screen | Visual |
|--------|--------|
| **PAN Verification** | PAN number input, format validation, verification status |
| **Aadhaar Verification** | Aadhaar number + OTP verification flow |
| **DigiLocker** | DigiLocker integration for document fetch |
| **Bank Linking** | Account number + IFSC code, IFSC validation, bank name auto-fetch |

---

## 18. ⚖️ RISK MANAGEMENT

| Screen | Features |
|--------|----------|
| **Risk Settings** | Daily loss limit (₹), daily loss % limit, position size % limit, max leverage, toggle intraday/FNO |
| **Iron Lock** | Auto-lockdown when limits breached. Symmetrical profit cap with R:R ratio |
| **Overlay** | Full-screen Iron Lock overlay during lockdown — "Only exit orders permitted" |

---

## 19. 📋 SETTINGS SCREENS (30+)

| Screen | Description |
|--------|-------------|
| **Subscription** | Free/Pro/Elite tiers, Razorpay billing, upgrade prompt |
| **Security** | Session management, logout from other devices |
| **Two-Factor** | TOTP setup/verify, backup codes, enable/disable |
| **Biometric** | Face ID / Fingerprint toggle for app unlock |
| **Voice** | Voice command settings |
| **Telegram** | Connect Telegram bot for trade alerts |
| **AI Settings** | AI provider config (OpenRouter/Gemini) |
| **Dark Mode** | Dark/Light/System theme selector |
| **Accessibility** | Font size, contrast, reduce motion |
| **Landscape** | Chart-optimized landscape layout |
| **Widget Settings** | Home screen widget configuration |
| **Feature Flags** | Gradual rollout toggle UI |
| **A/B Test Runner** | Experiment framework UI |
| **API Keys** | Manage API access keys |
| **Webhooks** | Webhook endpoint management |
| **CDN Optimization** | Image quality/size settings |
| **Coupon Manager** (Admin) | Create/manage discount coupons |
| **Course Review** (Admin) | Approve/reject user courses |
| **Tenant Config** | Multi-tenant settings |

---

## 20. 📊 ADVANCED ANALYTICS

| Screen | Description |
|--------|-------------|
| **Monte Carlo Simulation** | 10k portfolio scenarios, risk metrics |
| **Correlation Matrix** | Asset-to-asset correlation heatmap |
| **Factor Analysis** | Momentum, value, size, volatility exposures |
| **Portfolio Rebalancing** | Suggested rebalance trades |
| **Dividend Tracker** | Upcoming/historical dividend calendar |
| **Tax Harvesting Calendar** | Loss-harvesting opportunities |

---

## 21. 🌐 ADDITIONAL MARKETS

| Screen | Description |
|--------|-------------|
| **US Markets** | S&P 500, NASDAQ stocks with real-time data |
| **Bond Dashboard** | Government/corporate bond yields |
| **Currency Markets** | USD/INR, EUR/INR real-time rates |
| **Commodity Markets** | Gold, Silver, Crude prices |
| **Futures Curve** | Futures price curve across expiries |

---

## 22. 📰 NEWS & EVENTS

| Screen | Description |
|--------|-------------|
| **News Feed** | Curated financial news with categories |
| **IPO Calendar** | Upcoming IPOs with details, GMP, subscription |
| **Economic Calendar** | RBI meetings, inflation data, GDP releases |

---

## 23. 🏆 GAMIFICATION

| Screen | Description |
|--------|-------------|
| **Achievements** | Badge collection display, XP system, Level progress |
| **XP System** | Earn XP for trades, lessons, community participation |

---

## 24. 🛠️ OTHER SCREENS

| Screen | Description |
|--------|-------------|
| **Reports** | Dashboard, Contract Note Parser (PDF + paste-text), CSV export |
| **Trade History** | Filterable trade log with P&L, entry/exit, strategy |
| **Open Orders** | Active orders with modify/cancel actions |
| **Place Order** | Buy/Sell toggle, MARKET/LIMIT/SL/SL-M, CNC/MIS, Quantity presets, cost summary, confirmation |
| **Strategy Builder** | 10 pre-built options strategies, multi-leg P&L chart |
| **Strategy Performance** | Historical strategy backtest results |
| **Notifications** | In-app list with read/unread, dismiss |
| **Notification Preferences** | Push notification toggles per category |
| **Portfolio Alerts** | Custom price/volume alert rules |
| **Referral** | Referral code, share link, earnings |
| **Profile** | User details, KYC status, settings links |

---

## 🎨 DESIGN SYSTEM SUMMARY

| Element | Style |
|---------|-------|
| **Typography** | Inter font family, geometric sans-serif |
| **Colors** | Dark BG (#0A0E1A), Primary (#6C63FF), Success (#00E676), Danger (#FF5252), Warning (#FFC107), Accent (#00D2FF) |
| **Cards** | Glassmorphic (semi-transparent backgrounds, blur, border glow) |
| **Buttons** | Pill shapes, gradient backgrounds, haptic feedback |
| **Inputs** | Animated borders on focus, error states with shake |
| **Badges** | Rounded pills with color variants (primary/success/warning/danger/info) |
| **Navigation** | Bottom tabs with animated scale on focus, badge pulse |
| **Animations** | Reanimated 4 shared values, staggered entrance, spring physics, count-up |
| **Micro-interactions** | Haptic feedback (light/medium/warning), press scale animations |
| **Loading** | Skeleton blocks with shimmer effect |

---

## 🚀 HOW TO GENERATE ACTUAL SCREENSHOTS

```bash
# 1. Android emulator chalao
# 2. Expo dev server:
npx expo start --android

# 3. Screenshots capture karo:
bash scripts/capture-screenshots.sh

# Output: 14 screenshots in store/screenshots/ (iOS + Android sizes)
# iOS: 1290×2796, 1284×2778, 1242×2208
# Android: 1080×1920
```

Kaunsa screen pe aap specifically dekhna chahenge? Main uss screen ka source code/purana screenshot dhoondh sakta hoon.
