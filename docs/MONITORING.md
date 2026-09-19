# Uptime Monitoring — /health & /ready Watchdog

> **Why this exists:** A broken Postgres once silently blocked every deploy for 12+ days — `/ready` (the old deploy healthcheck) kept returning 503, so Railway kept the stale container alive. The monitors below make such states loud within minutes instead of weeks.

---

## What runs, and how often

| Monitor | Schedule | Probes | Alerts |
|---|---|---|---|
| **Uptime Monitor** (`.github/workflows/uptime-monitor.yml`) | every 5 min | `/health` (liveness) + `/ready` (readiness) | Telegram + GitHub issue |
| **Railway healthcheck** (`railway.json`) | per deploy | `/health` | blocks deploys on liveness failure only |

### Probe → meaning → response

| Probe | Non-200 meaning | Severity | First response |
|---|---|---|---|
| `/health` fails | **Total outage** — process dead | 🚨 critical | Railway → backend → Deployments/Logs; look at crash loops |
| `/ready` fails, `/health` 200 | **Degraded** — dependency down (today: Postgres) | ⚠️ warning | See Postgres runbook below |

A single bad probe does **not** alert (deploys and restarts cause blips): the probe step retries 3× in-run, and alerts resolve automatically once both endpoints are green again.

---

## One-time setup (alerts ke liye, ~5 min)

### 1. GitHub issue channel — works out of the box
No secrets needed: the default token has `issues: write` via the workflow's `permissions` block. First failure opens `🚨 Production …` issue; recovery closes it.

### 2. Telegram push (recommended — instant on phone)
1. Create a bot with **@BotFather** → copy the token (looks like `123456:AA…`).
2. Send any message to your bot, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` → note `chat.id`.
3. Railway/GitHub: add repo secrets **`TELEGRAM_BOT_TOKEN`** and **`TELEGRAM_CHAT_ID`**.
4. Test: Actions → **Uptime Monitor** → **Run workflow** → watch the run + your phone.

Without Telegram secrets the workflow still runs — you just get issues only.

---

## Postgres degraded — runbook (the `/ready` 503 case)

Symptom: `/health` 200, `/ready` 503, `/health` body shows `"storageHealthy": false`.

1. **Railway → Project → Postgres service** — status running? If not: restart it.
2. **Railway → backend service → Variables** — confirm `DATABASE_URL` is a
   reference to the Postgres service (`${{Postgres.DATABASE_URL}}` style), not a
   stale hardcoded value.
3. Verify from your machine:
   ```bash
   curl -s https://toroloom-production.up.railway.app/ready
   # expect {"status":"ready",...,"storageHealthy":true} once fixed
   ```
4. The uptime monitor will auto-close the GitHub issue and (if configured) ping
   Telegram when `/ready` returns to 200.

While degraded, the API keeps serving in-memory/degraded mode — reads work,
DB-backed persistence (audit trail, risk profiles, subscriptions) does not.

---

## Files involved

| File | Role |
|---|---|
| `.github/workflows/uptime-monitor.yml` | 5-min probe + alert dispatch |
| `.github/actions/uptime-alert/action.yml` | issue open/close + Telegram composite |
| `railway.json`, `backend/railway.json` | deploy healthcheck = `/health` (liveness) |
| `docs/BRANCH_PROTECTION.md` | how the CI side is gated |

*Maintain: if the production URL moves off Railway, update `PROD_URL` in the workflow and the runbook URLs above in the same PR.*
