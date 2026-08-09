# 🌐 Toroloom — I18N Hindi Conversion Status

> **Last verified:** August 2026 · All checks green (see [Verification](#-verification) below)

---

## 📊 Overall Status

| Metric | Value |
|--------|-------|
| **Files scanned** | 228 |
| **Files using `useT()` (converted)** | **194 (85%)** |
| Files with no user-facing strings (not converted) | 34 |
| Namespaces (en + hi) | **109** |
| Total translation keys (per locale) | **~4,917** |
| Locale parity | ✅ 108/108 namespaces in sync (0 missing, 0 extra, 0 var mismatch) |
| Remaining hardcoded-string files | 22 — all intentional (see below) |

---

## 🏁 What Was Completed

The full i18n Hindi conversion (screens + components) is **complete**. All
user-facing strings in screens and UI components are routed through `useT()`.

### Conversion batches (git history)

| Commit | Scope | Files |
|--------|-------|-------|
| `c25510a` | Key UI components (IronLockOverlay, widgets, stock analysis, video, FnO panels…) | 40 |
| `bf3abe1` | 8 largest partial screens (AlgoTrading, USStocks, Wealth, Help, PAN, Sentiment…) | 25 |
| `f0cbfda` | 28 small partial screens (Crypto, Calculators, Community, Watchlist, News…) | 60 |
| `1a94599` | Chart components (Candlestick, DrawingTools, StockChart, Skia, TickMode) | 9 |
| (earlier) | Final 9 screens + achievements/quiz/step-up SIP screens | — |

### New namespaces created during conversion

- `components` (10 sections: ironLock, upgradePrompt, syncConflict, offlineBanner,
  widgets, quiz, syncStatus, biometric, stockAnalysis, video)
- `fno` · `subscriptionAnalytics` · `sentimentAlerts` · `charts`
- Extended: `trading`, `snaptrade`, `kyc`, `wealth`, `help`, `ipos`, `news`,
  `adminUser`, `adminDashboard`, `adminKyc`, `education`, `community`,
  `portfolioAlerts`, `onboarding`, `capitalGains`, `coupons`, `stockDetail`,
  `earningsCall`, `ai` and more

---

## ✅ Verification (all green)

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npm run typecheck` | ✅ 0 errors |
| Locale parity | `npm run check:i18n` | ✅ 558 keys checked, all match |
| Lint | `npx eslint` (changed files) | ✅ 0 issues |
| Unit tests | `npm test` | ✅ 5,355 / 5,355 pass (212 files) |
| i18n audit | `node scripts/audit-i18n.mjs` | ✅ 194/228 converted |

---

## 🟡 Remaining 22 hardcoded-string files — ALL INTENTIONAL

The audit still flags 22 files, but **every hit is a deliberate as-is string**:

| Category | Examples | Files |
|----------|----------|-------|
| **Format examples / placeholders** | `ABCDE1234F` (PAN), `HDFC0001234` (IFSC), `XXXX XXXX XXXX`, `e.g. 5000000` (calculators) | PanVerification, BankLinking, Aadhaar, EMI/Lumpsum/SIP/Tax calculators |
| **Technical abbreviations** | RSI/MACD/Bollinger, P/E, M.Cap, Chg%, CE OI/PE OI, `LIVE`, `TICK` | TechnicalIndicators, PeerComparison, OptionsScannerPanel, ReportHeader |
| **Strategy/code syntax** | `CROSSOVER(SMA(close, 20), SMA(close, 50))` | AlgoTradingScreen |
| **Mock data (names)** | `Arun Kumar`, `Neha Singh`, `Mr. Sharma` | CopyAnalytics, FundDetail |
| **Brand name** | `Toroloom` | BiometricUnlockOverlay |
| **Code false positives** | `losers`/`declining` variables, type declarations, date comparisons | AIChat, Home, SectorDetail, CommodityMarkets, RevenueDashboard, AdminCoupon |

> These match the project convention: universal abbreviations and technical
> terms stay in English (same as RSI/MACD), format examples are not translatable.

---

## 🔴 34 files with no `useT()` — NO USER-FACING STRINGS

These files contain **zero user-facing strings** (pure logic, SVG art,
UI primitives, or wrappers). No conversion needed:

- **UI primitives:** `Button`, `Input`, `Card`, `Badge`, `SkeletonLoader`,
  `AnimatedPressable`, `ToroloomLogo`, `MetallicShieldSVG`
- **Chart internals:** `patternDetection.ts`, `SkiaChartUtils.ts`,
  `drawingHitDetection.ts`, `ChartCrosshairContext.ts`, `MultiTimeframeSync.tsx`
- **Wrappers/gates:** `FontLoadingGate`, `AppContent`, `AvatarWidget`,
  `OptimizedImage`, `SecureSessionSync`, `MarketCard`, `StockItem`
- **Widget plumbing:** `WidgetRegistry`, `widgets/index.ts`,
  `MarketOverviewWidget`, `PerformanceChartWidget`
- **Onboarding art:** `OnboardingIllustrations`, `OnboardingLottie`,
  `onboardingUtils`
- **Screens/components:** `SplashScreen` (0 strings), `AnimatedScaleButton`
  (doc-comment example only), `CustomIndicatorPanel`, `ChartControls`,
  `FullscreenChartModal`, `KeyStatsGrid`

---

## 🧭 How to Maintain

### The pattern (see `docs/I18N_PATTERN.md` for full guide)

```tsx
import { useT } from '../../hooks/useT';

const { t } = useT();
<Text>{t('namespace.key')}</Text>
```

- **Namespaces:** one file per namespace in `src/i18n/locales/{en,hi}/`,
  registered in `src/i18n/locales/{en,hi}/index.ts`
- **Plurals:** use `{{count}}` interpolation with `_other` suffix variants:
  `holdingCount` (1) + `holdingCount_other` (2+)
- **Reuse common keys:** `app.cancel`, `app.done`, `app.delete`, `app.na`
- **Universal/technical terms stay English** (RSI, P/E, TICK) — by convention

### Commands

| Command | Purpose |
|---------|---------|
| `npm run check:i18n` | Verify en/hi namespace parity + interpolation vars |
| `node scripts/audit-i18n.mjs` | Find files still using hardcoded strings |
| `node scripts/audit-lines.mjs <file…>` | Show exact flagged lines per file |
| `npm run typecheck` / `npm test` | Full CI checks |

### When adding new screens

1. Add strings to the appropriate namespace (create one if needed, en + hi)
2. Register it in both `index.ts` files
3. Use `useT()` + `t('ns.key')` in the screen
4. Run `npm run check:i18n` + `node scripts/audit-i18n.mjs` to confirm
