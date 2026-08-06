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
2. **Strings across 16 namespaces** — live `t()` output with the English
   original shown below each key.
3. **Interpolated strings** — `time.daysLeft` (`{{count}} दिन शेष`) and
   `components.stockAnalysis.shares` with `{{count}}`.

## Run

```bash
npx vite build --config web-demo/vite.config.ts
npx vite preview --config web-demo/vite.config.ts --port 4175
# open http://localhost:4175
```

Click **हिन्दी में देखें** to switch to Hindi, click again to switch back.

## How it works

`vite.config.ts` aliases:

| Module | Handled by |
|--------|-----------|
| `react-native` | `react-native-web` (installed dependency) |
| `react-native-reanimated` | `web-demo/stubs/reanimated.ts` (static style stubs) |
| `expo-haptics` | `web-demo/stubs/expo-haptics.ts` (no-op) |
| `@expo/vector-icons` | `web-demo/stubs/vector-icons.tsx` (icon name as text) |

Everything else — i18next, react-i18next, zustand, date-fns, the 109 locale
namespaces — runs unmodified.

> Note: `web-demo/dist/` is build output and is gitignored.
