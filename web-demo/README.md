# Toroloom — i18n Live Toggle Demo (browser)

A self-contained browser harness that renders **real** Toroloom components
against the **real** i18n instance (`src/i18n`) so the en↔hi language toggle
can be verified live — without booting the full native app.

## Why

- The app ships no in-UI language toggle (language is auto-detected from the
  device), so a live browser check of `toggleLanguage()` needs a minimal host.
- `PortfolioHolding` renders through the real `useT()` hook, so this proves
  component-level re-rendering on language change, not just key lookup.

## What it shows

1. **Real component render** — two `PortfolioHolding` cards (labels like
   `Avg Cost` → `औसत लागत` flip on toggle).
2. **OfflineBanner** — rendered live by pointing the API client at a dead
   endpoint (`configureApi({ baseUrl: 'http://127.0.0.1:59999/api' })`) so the
   real connectivity health-check fails and `combinedOffline` is true.
   `You're offline` → `आप ऑफ़लाइन हैं`, `Data Freshness` → `डेटा ताज़गी`.
3. **PatternSummary** — real `getPatternDescription` + `detectedPatterns` key
   (`Detected Patterns` → `पहचाने गए पैटर्न`).
4. **SkeletonLoader** — `PortfolioSkeleton` + `SkeletonList` shimmer blocks
   (no text — pure theme/visual check).
5. **ReportHeader** — real gradient period-report header with `periodReport.*`
   keys (`Period Report` → `अवधि रिपोर्ट`), LIVE badge and export button.
   Renders the real `expo-linear-gradient` web implementation (CSS gradient).
6. **SectorMetricsCard** — real sector win/loss card with expandable trade
   details (`Sector-wise Metrics` → `सेक्टर-वार मेट्रिक्स`; W/L badges flip
   via `sectorWins`/`sectorLosses` first-char extraction, `ज`/`ह` in Hindi).
7. **WatchlistItem rows** — `StockItem` (the real component used for watchlist
   rows) for RELIANCE/TCS/HDFCBANK with sector badges and up/down styling.
8. **SIPCalculator** — the real full calculator screen (not a copy): maturity
   value computed live from the SIP formula, yearly-growth bar chart, preset
   chips, quick summary and info note. Fully interactive (`₹25K` preset →
   maturity ₹58,08,476.91, verified in Chrome). `@react-navigation/native` is
   stubbed so `useNavigation()` works without a container.
9. **TaxSummaryCard** — real STCG/LTCG breakdown (`Tax Summary` →
   `कर सारांश`, `STCG (15%)` → `अल्पकालिक (15%)`) with estimated-tax tip.
10. **StockScreener results** — the real screener result block: real
   `stockScreener.*` keys (`Results (6)` → `परिणाम (6)`, sort chips
   `Symbol/Price/Change%/P/E/Dividend/Mkt Cap` → `प्रतीक/मूल्य/बदलाव%/…`)
   over real `StockItem` rows for 6 stocks.
11. **EMICalculator** — real loan screen: EMI formula, principal/interest
   breakdown bars, yearly amortization schedule, loan presets. Interactive
   (`₹10L` preset → EMI ₹20,758.36, verified in Chrome).
12. **LumpsumCalculator** — real one-time investment screen: compound
   growth chart, wealth-growth factor, investment presets (default ₹5L @
   12% 5Y → ₹8,81,170.84, verified).
13. **TaxCalculator** — real Indian equity tax screen (FY 2025-26):
   STCG/LTCG toggle with dynamic rate labels, LTCG ₹1L exemption, surcharge
   + cess breakdown. Interactive (LTCG ₹35,000 profit → ₹0 tax; switching to
   STCG → ₹7,280, verified in Chrome).
14. **StepUpSipScreen** — real mutual-fund SIP step-up screen driven by the
   real `useMutualFundStore` (seeded with the app's `mockSIPs`: Parag Parikh
   ₹5K + SBI Bluechip ₹3K). Bottom-sheet config modal with percent presets,
   frequency toggle and live projection (`Now ₹5,000 → After 10 yrs
   ₹12,969` for 10% yearly — verified in Chrome). Enabling flips the card
   to `Step-Up Active` with summary + mini chart via the real store action.
15. **CurrencyConverterScreen** — real screen wired to the app's live-forex
   pipeline (`useLiveConversion` → `useForexRates` → Frankfurter API +
   WebSocket feed). With the demo's dead endpoint it degrades gracefully to
   static rates + `Mock` badge (`1 USD = 83.45 INR`); currency chips, swap,
   save-to-recent and favourite-pair quick reference all interactive.
   Bonus: surfaced & fixed a real app bug — `RealWebSocketService` reconnect
   fired a fire-and-forget `connect()` whose rejection produced an unhandled
   `Uncaught (in promise)`; now `.catch`-guarded (verified: 12s of reconnect
   cycles, zero unhandled rejections).
16. **Real theme toggle** — the outlined button calls the app's real
    `useTheme().toggleTheme()` (zustand store + persistence), flipping
    components between dark (`COLORS`) and light (`LIGHT_COLORS`).
    Badges use the real `darkMode.*` namespace keys.
17. **Strings across 16 namespaces** — live `t()` output with the English
    original shown below each key.
18. **Interpolated strings** — `time.daysLeft` (`{{count}} दिन शेष`) and
    `components.stockAnalysis.shares` with `{{count}}`.
19. **TradingView Lightweight Charts™** — official open-source charting
    (`lightweight-charts@5.2`, display-only): 6-symbol × 5-timeframe
    candlestick chart with volume histogram, TradingView-style crosshair OHLC
    legend, LIVE tick simulation (`series.update()`), TOROLOOM watermark and
    full dark/light theme awareness via the real `useTheme()`.
    (`web-demo/LightweightChartDemo.tsx`)
20. **TradingView Advanced Chart widget (REAL data)** — the same official
    widget the native app renders via react-native-webview, embedded here
    through the app's real `buildTradingViewWidgetHtml()` helper inside a
    sandboxed `<iframe srcDoc>`: 8 symbols (NSE large-caps, NASDAQ:AAPL,
    BINANCE:BTCUSDT) × 7 intervals, dark/light theme aware, LIVE badge.
    Display-only — real prices come from TradingView (no key needed for
    embedding). (`web-demo/TradingViewWidgetDemo.tsx`)

## Screens harness (`web-demo/screens/`)

A second standalone harness that renders **16 migrated screens** (the ones that
switched from raw `<View style={styles.container}>` + `RefreshControl`
ScrollViews to the shared `<AppScreen>` scaffold) so the migration can be
verified visually in a browser — headers pinned, pull-to-refresh, loading /
empty states — without booting the native app.

Rendered screens: AdminDashboard, AdminKYC, AdminUserManagement,
AdminCouponManagement, AvailableCoupons, CouponHistory, BackgroundSyncSettings,
FeatureFlags, SubscriptionAnalytics, USMarkets, NFODashboard,
SnapTradePortfolio, CryptoDetail, CryptoTrading, USStocksTrading, LiveFeed,
PostDetail.

```bash
npx vite build --config web-demo/screens/vite.config.ts
npx vite preview --config web-demo/screens/vite.config.ts --port 4176
# open http://localhost:4176
```

> This harness surfaced two real i18n bugs (unwired `coupons` namespace, wrong
> `accessDenied` key namespace) — both fixed in the app. `web-demo/screens/dist/`
> is build output and is gitignored.

### Scripted verification (no clicks needed)

Append query params to pre-select state on load — handy for URL-driven checks:

- `?lang=hi|en` — pre-select language
- `?theme=dark|light` — pre-select theme

Example: `http://localhost:4175/?lang=hi&theme=light`

## Run

```bash
npx vite build --config web-demo/vite.config.ts
npx vite preview --config web-demo/vite.config.ts --port 4175
# open http://localhost:4175
```

## Deploy to GitHub Pages

The live demo is served from the **`docs/` folder of `master`** (Repo Settings →
Pages → Source: *Deploy from a branch → master → /docs*), so the built site
lives at `docs/web-demo/` and is reachable at
`https://<owner>.github.io/toroloom/web-demo/`.

One-command redeploy (builds with the correct `base` + copies to `docs/web-demo/`):

```bash
npm run deploy:pages
```

Then commit and push (the script intentionally does not auto-commit):

```bash
git add docs/web-demo
git commit -m "docs: redeploy web-demo"
git push origin master
```

The site usually goes live within ~30 seconds. To just re-copy the last build
without rebuilding, use `npm run deploy:pages -- --skip-build`.

Click **हिन्दी में देखें** to switch to Hindi, **🌙/☀️ Dark/Light Mode** to
switch the theme. All four combinations (en/hi × dark/light) are verified to
render correctly.

> The `net::ERR_CONNECTION_REFUSED` message in the console is intentional — it
> is the real connectivity health-check hitting the deliberately-dead API URL
> that makes OfflineBanner display.

## How it works

`vite.config.ts` aliases:

| Module | Handled by |
|--------|-----------|
| `react-native` | `react-native-web` (installed dependency) |
| `react-native-reanimated` | `web-demo/stubs/reanimated.ts` (static style stubs) |
| `expo-haptics` | `web-demo/stubs/expo-haptics.ts` (no-op) |
| `@expo/vector-icons` | `web-demo/stubs/vector-icons.tsx` (icon name as text) |
| `react-native-safe-area-context` | `web-demo/stubs/safe-area-context.ts` (zero insets) |
| `@react-native-firebase/*` | `web-demo/stubs/firebase.ts` (no-op analytics) |
| `expo-modules-core` | `web-demo/stubs/expo-modules-core.ts` (no-op module surface) |
| `react-native-razorpay` | `web-demo/stubs/razorpay.ts` (no-op checkout) |
| `@react-navigation/native` | `web-demo/stubs/react-navigation.ts` (no-op `useNavigation`) |
| `react-dom/client` types | `web-demo/react-dom-client.d.ts` (createRoot shim — `@types/react-dom` not installed) |

`resolve.extensions` lists `.web.*` variants FIRST so platform implementations
are picked (e.g. `expo-linear-gradient` renders its real CSS-gradient web
implementation instead of the console-warning shim).

Everything else — i18next, react-i18next, zustand, date-fns, the 109 locale
namespaces — runs unmodified.

> Note: `web-demo/dist/` is build output and is gitignored.
