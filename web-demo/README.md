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
8. **Real theme toggle** — the outlined button calls the app's real
   `useTheme().toggleTheme()` (zustand store + persistence), flipping
   components between dark (`COLORS`) and light (`LIGHT_COLORS`).
   Badges use the real `darkMode.*` namespace keys.
9. **Strings across 16 namespaces** — live `t()` output with the English
   original shown below each key.
10. **Interpolated strings** — `time.daysLeft` (`{{count}} दिन शेष`) and
   `components.stockAnalysis.shares` with `{{count}}`.

## Run

```bash
npx vite build --config web-demo/vite.config.ts
npx vite preview --config web-demo/vite.config.ts --port 4175
# open http://localhost:4175
```

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

`resolve.extensions` also includes `.web.js`/`.web.tsx` so platform variants
are picked (e.g. `expo-linear-gradient` renders its real CSS-gradient web
implementation instead of the console-warning shim).

Everything else — i18next, react-i18next, zustand, date-fns, the 109 locale
namespaces — runs unmodified.

> Note: `web-demo/dist/` is build output and is gitignored.
