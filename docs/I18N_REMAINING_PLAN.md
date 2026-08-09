# Toroloom I18N Hindi Conversion — Remaining Screens Plan (ARCHIVED ✅)

> **Status: COMPLETED** — this plan was fully executed. It is kept as a
> historical record of what was planned vs. delivered.
>
> **Canonical status doc: [`I18N_STATUS.md`](./I18N_STATUS.md)** — read that
> for the current, verified state of the i18n conversion.
>
> **Last verified:** August 2026 (fresh audit + parity run, see below)

---

## ✅ Current State (verified August 2026)

| Metric | Value |
|--------|-------|
| Files scanned | 228 |
| Files using `useT()` (converted) | **194** |
| Files with no user-facing strings (never converted) | 34 |
| Converted files with intentional hardcoded strings left | 22 |
| Locale parity (`npm run check:i18n`) | ✅ 558 keys checked, **all in sync** (0 missing, 0 extra, 0 var mismatch) |

**The conversion is done.** There is no remaining i18n work in the app.

---

## 📜 What This Document Was

This file originally contained the priority plan for converting the remaining
hardcoded-string screens to `useT()` — an estimated **~65 screens / ~990
strings / ~11.5 hrs** of work across three tiers.

All of that work was subsequently **completed**:

| Tier | Original Plan | Outcome |
|------|---------------|---------|
| 🔴 Tier 1 — High priority (11 screens, ~280 strings) | ✅ Done | All screens converted |
| 🟡 Tier 2 — Medium priority (19 screens, ~360 strings) | ✅ Done | All screens converted |
| 🟢 Tier 3 — Low priority (~35 screens/components, ~350 strings) | ✅ Done | All screens + components converted |

The tier tables from the original plan are intentionally **not** reproduced
here — every screen they listed now routes its user-facing strings through
`useT()`.

### Why a few files still show hardcoded strings

The audit (`node scripts/audit-i18n.mjs`) still flags 22 converted files, but
**every hit is an intentional as-is string**:

- **Format examples / placeholders** — `ABCDE1234F` (PAN), `HDFC0001234`
  (IFSC), `XXXX XXXX XXXX`, `e.g. 5000000` (calculators)
- **Technical abbreviations** — RSI/MACD/Bollinger, P/E, M.Cap, Chg%, CE OI/PE
  OI, `LIVE`, `TICK`
- **Strategy/code syntax** — `CROSSOVER(SMA(close, 20), SMA(close, 50))`
- **Mock data names** — `Arun Kumar`, `Neha Singh`, `Mr. Sharma`
- **Brand name** — `Toroloom`
- **Code false positives** — `losers`/`declining` variables, type
  declarations, date comparisons

> Convention: universal/technical terms stay in English (same as RSI/MACD),
> and format examples are not translatable.

---

## 🔍 How to Re-verify at Any Time

| Command | Purpose |
|---------|---------|
| `npm run check:i18n` | Verify en/hi namespace parity + interpolation vars |
| `node scripts/audit-i18n.mjs` | Find files still using hardcoded strings |
| `node scripts/audit-lines.mjs <file…>` | Show exact flagged lines per file |
| `npm run typecheck` / `npm test` | Full CI checks |

See [`I18N_STATUS.md`](./I18N_STATUS.md) for the full maintenance guide and
the conversion batch history.
