# Market Schedule Worker — Alert Runbook

> **Service:** `toroloom-market-schedule`  
> **Source files:**  
> - Worker: `backend/src/services/queue/marketScheduleWorker.ts`
> - Market hours logic: `backend/src/routes/ironLock.ts` (`isMarketHours()`)
> - Prometheus metrics: `backend/src/services/metrics.ts`
> - Server startup: `backend/src/server.ts` (calls `startMarketScheduleWorker()`)
> - Grafana dashboard: `backend/grafana/toroloom-market-schedule-dashboard.json`
> - Alert rules: `backend/grafana/provisioning/alerting/alert_rules.yml`
>
> **See also:** [WebSocket Alerts Runbook](https://github.com/ksjii666777-bit/toroloom/wiki/WebSocket-Alerts)

---

## Overview

The market schedule worker is a lightweight in-process `setInterval` that polls `isMarketHours()` every **30 seconds**. Its sole purpose is to detect market open/close transitions and fire the corresponding webhook events (`market:open`, `market:close`). Without this worker, transition events only fire when an API request hits the Iron Lock endpoints — during quiet periods (weekends, holidays, low traffic) transitions would be missed entirely.

The worker tracks 7 Prometheus gauges:
- `toroloom_market_schedule_running` — 1 if poller is active
- `toroloom_market_schedule_total_polls` — total polls since process start
- `toroloom_market_schedule_total_errors` — total poll errors
- `toroloom_market_schedule_market_open_total` — closed→open transitions
- `toroloom_market_schedule_market_close_total` — open→closed transitions
- `toroloom_market_schedule_uptime_seconds` — worker uptime
- `toroloom_market_schedule_last_poll_timestamp` — unix timestamp of last successful poll

---

## Alert #9 — Poller Stopped 🔴 Critical

**Expression:** `toroloom_market_schedule_running == 0` for ≥ 1 minute  
**Severity:** Critical  
**Notification:** Slack + PagerDuty

### What it means

The `setInterval` callback has stopped executing. Market open/close webhook events will **not** be dispatched until the poller restarts. If this fires during trading hours (9:15 AM – 3:30 PM IST), any downstream services that depend on market status transitions will miss events.

### Investigation Steps

**Step 1 — Check the health endpoint**

```bash
curl http://localhost:3000/health | jq .marketSchedule
```

Look for:
- `isRunning: false` — poller is definitely stopped
- `lastPollTimestamp` — how long since the last successful poll
- `totalErrors` — sudden error spike may have preceded the stop

**Step 2 — Check server logs**

```bash
# Search for market schedule messages
docker logs toroloom-backend --tail 100 | grep -i "MarketSchedule"
```

Expected healthy output:
```
[MarketSchedule] Worker started — polls isMarketHours() every 30s
```

If you see `[MarketSchedule] Initial poll error: ...` followed by nothing, the worker may have crashed during initialization.

**Step 3 — Check if the process is still alive**

```bash
# Verify the Node.js process is running
docker ps | grep toroloom-backend

# Check process uptime
curl -s http://localhost:3000/health | jq .uptime
```

If the process restarted recently, the worker may not have auto-started (see Resolution below).

**Step 4 — Check for uncaught exceptions**

Unlike the interval callback (which has try/catch), `startMarketScheduleWorker()` is called synchronously during server startup in `server.ts`. If an exception is thrown **before** the worker is initialized, the server may be running without the poller. Search for uncaught exceptions in Sentry or server logs.

### Resolution

**If the process is running but the worker stopped:**

```bash
# Option A: Restart the server (worker auto-starts in server.ts)
docker restart toroloom-backend

# Option B: This is rare — the worker uses a simple setInterval with try/catch,
# so it should not stop on its own. Check for Node.js handle leaks
# (event loop blocked, too many active handles).
```

**If the process restarted but the worker didn't start:**

Check `server.ts` to ensure `startMarketScheduleWorker()` is called during startup. It should be called after storage initialization:

```typescript
// server.ts — around line 380
startMarketScheduleWorker();
```

**If the worker keeps stopping repeatedly:**

Check for a bug in `marketScheduleWorker.ts` `startMarketScheduleWorker()`. The function guards against multiple calls (`if (marketScheduleTimer) return;`), so restarting it is idempotent.

### Prevention

- [ ] Ensure `startMarketScheduleWorker()` is in the server startup sequence
- [ ] Add a health check that validates `toroloom_market_schedule_running == 1`

---

## Alert #10 — Poll Errors Detected 🟡 Warning

**Expression:** `rate(toroloom_market_schedule_total_errors[5m]) > 0` for ≥ 5 minutes  
**Severity:** Warning  
**Notification:** Slack

### What it means

The `isMarketHours()` function is consistently throwing exceptions. Each error is caught by the worker's try/catch (so the poller keeps running), but webhook events for that poll cycle are lost. After 5 minutes of sustained errors (~10 missed polls), this alert fires.

### Investigation Steps

**Step 1 — Check the health endpoint**

```bash
curl http://localhost:3000/health | jq .marketSchedule
```

Look for:
- `totalErrors` — should match the alert value
- `totalPolls` — should still be incrementing (poller is running)
- `isRunning: true` — confirms the poller is alive despite errors

**Step 2 — Examine error logs**

```bash
docker logs toroloom-backend --tail 200 | grep "MarketSchedule.*error"
```

The error message will indicate where `isMarketHours()` failed. Common causes:

| Error Pattern | Likely Cause | Fix |
|---|---|---|
| `dispatchWebhookEvent is not a function` | Webhook service not configured | Check `configureWebhookPersistence()` in `server.ts` |
| `Webhook persistence not configured` | Storage not wired to webhook service | Call `configureWebhookPersistence(storage)` before starting the worker |
| `Cannot read properties of undefined` | Storage engine not initialized | Ensure `initializeStorage()` completes before `startMarketScheduleWorker()` |
| `fetch failed` / `connect ECONNREFUSED` | Webhook delivery URL is unreachable | Check network connectivity to external webhook targets |

**Step 3 — Check webhook service initialization**

In `server.ts`, the startup order matters:
1. `initializeStorage()` — sets up storage engine
2. `configureWebhookPersistence(storage)` — wires webhook storage
3. `startMarketScheduleWorker()` — starts polling

If the worker starts before the webhook service is configured, all calls to `dispatchWebhookEvent()` inside `isMarketHours()` will throw.

**Step 4 — Check the Prometheus error rate**

```promql
# View error rate over time
rate(toroloom_market_schedule_total_errors[5m])
```

If the rate is exactly `0.0033` (1 error / 300s), a single persistent error is firing every poll. If the rate is higher, multiple errors are occurring per poll.

### Resolution

**If webhook persistence is not configured:**

```typescript
// In server.ts, before startMarketScheduleWorker():
configureWebhookPersistence(storage);
```

**If storage is not initialized:**

Restart the server. The startup sequence in `server.ts` should handle this automatically.

**If a specific webhook URL is unreachable:**

The `isMarketHours()` function calls `dispatchWebhookEvent()` which attempts to deliver to all active webhooks subscribed to `market:open` / `market:close`. If one webhook URL is down, it won't block others (uses `Promise.allSettled`), but errors during the `fetch` call are logged. Check the webhook health dashboard at `/api/webhooks/razorpay/health`.

### Prevention

- [ ] Verify startup order in `server.ts`: storage → webhook service → worker
- [ ] Add a webhook health check that validates delivery endpoints are reachable
- [ ] Monitor the `toroloom_market_schedule_total_errors` dashboard panel

---

## Alert #11 — Last Poll Stale 🟡 Warning

**Expression:** `time() - toroloom_market_schedule_last_poll_timestamp > 60` for ≥ 1 minute  
**Severity:** Warning  
**Notification:** Slack

### What it means

The last successful poll of `isMarketHours()` was more than 60 seconds ago. The poll interval is 30 seconds, so this means at least **2 consecutive polls were missed or failed**. Unlike Alert #10 (which fires on error rate), this alert fires when the `lastPollTimestamp` stops being updated — which can happen even without errors if the poller's timer callback stops executing.

This alert is a **canary** — it often fires **before** Alert #9 (Poller Stopped) because the `running` gauge may briefly show `1` while the timer handle exists but the callback isn't executing (due to event loop starvation or a stuck synchronous operation).

### Investigation Steps

**Step 1 — Compare with Alert #9**

Check if the "Poller Stopped" alert also fired. If both fired, start with Alert #9 (Critical) first. If only this alert fired, the poller is technically "running" (timer handle exists) but the callback is not completing.

**Step 2 — Check event loop health**

```bash
# Check event loop lag from Prometheus
# Look for values > 100ms in Grafana dashboard
nodejs_eventloop_lag_seconds{component="nodejs"}
```

High event loop lag (> 500ms) can delay or prevent `setInterval` callbacks from firing on schedule. Node.js will skip interval ticks if the event loop is blocked.

**Step 3 — Check for synchronous blocking operations**

The worker's `doPoll()` function is synchronous (no `await`). However, `isMarketHours()` calls `dispatchWebhookEvent()` which performs HTTP `fetch` calls. These are **fire-and-forget** (`.catch(() => {})`), so they shouldn't block. But if the entire event loop is blocked by another operation (e.g., a synchronous CPU-intensive task), the interval callback won't execute.

Check Sentry for long-running transactions or CPU profiles.

**Step 4 — Check the Prometheus gauge directly**

```promql
# Current last poll timestamp (unix seconds)
toroloom_market_schedule_last_poll_timestamp

# Compare with server time
time()
```

If `toroloom_market_schedule_last_poll_timestamp` is not increasing, the `doPoll()` function's `lastPollTimestamp = new Date().toISOString()` line is not being reached.

### Resolution

**If event loop is healthy but polls are stale:**

1. Restart the server to reset the interval timer
```bash
docker restart toroloom-backend
```

2. After restart, verify the worker started:
```bash
curl -s http://localhost:3000/health | jq .marketSchedule
# Expected: isRunning: true, lastPollTimestamp: <recent>
```

**If event loop lag is high:**

1. Identify the blocking operation from Sentry profiles or CPU profiles
2. Common causes:
   - Large JSON serialization (e.g., broadcasting to 1000+ WebSocket clients)
   - Synchronous I/O in a hot code path
   - CPU-intensive analytics computation
   - V8 garbage collection pauses (check `nodejs_gc_runs_total`)

3. Fix the blocking operation or move it to a worker thread / BullMQ job

**If the problem persists after restart:**

The `setInterval` handle may be getting garbage collected or overridden. Check for code that accidentally calls `clearInterval()` on the wrong timer or reassigns `marketScheduleTimer`. This is unlikely — the module encapsulates the timer as a private `let` variable.

### Prevention

- [ ] Monitor event loop lag alongside market schedule metrics
- [ ] Set a Grafana alert on `nodejs_eventloop_lag_seconds > 0.1` (100ms) as a pre-canary
- [ ] Ensure no synchronous blocking operations run for > 100ms in the main thread

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  server.ts                                                         │
│                                                                     │
│  initializeStorage()                                                │
│  configureWebhookPersistence(storage)  ← must happen before         │
│  startMarketScheduleWorker()           ← auto-starts the poller     │
│                                                                     │
│  On shutdown:                                                       │
│  stopMarketScheduleWorker()             ← clears the interval       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  marketScheduleWorker.ts                                            │
│                                                                     │
│  setInterval(doPoll, 30_000)                                        │
│    │                                                                │
│    ├─ doPoll() ──────────────────────────────────────────────┐      │
│    │  totalPolls++                                            │      │
│    │  try { isMarketHours() } catch { totalErrors++ }         │      │
│    │  pushMetrics() → Prometheus gauges                       │      │
│    └──────────────────────────────────────────────────────────┘      │
│                                                                     │
│  getMarketScheduleHealth() → /health & /api/queue/status           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ironLock.ts                                                       │
│                                                                     │
│  isMarketHours()                                                    │
│    ├─ Checks weekday & UTC time against MARKET_OPEN_MS / CLOSE_MS  │
│    ├─ Detects transitions via lastMarketWasOpen module variable    │
│    └─ Dispatches dispatchWebhookEvent('market:open'|'market:close')│
│                      │                                             │
│                      ▼                                             │
│          webhookService.ts                                         │
│            └─ Delivers signed POST to all active webhook URLs      │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary

1. **30s timer fires** → `doPoll()` in `marketScheduleWorker.ts`
2. **Poll executes** → `isMarketHours()` in `ironLock.ts`
3. **Transition detected?** → `dispatchWebhookEvent()` in `webhookService.ts`
4. **Metrics pushed** → `updateMarketScheduleMetrics()` in `metrics.ts`
5. **Health available** → `getMarketScheduleHealth()` → `/health`, `/api/queue/status`, Grafana

### Key Files Reference

| File | Purpose |
|------|---------|
| `backend/src/services/queue/marketScheduleWorker.ts` | Worker implementation with `start/stop/getHealth` |
| `backend/src/routes/ironLock.ts` | `isMarketHours()` — the function being polled |
| `backend/src/services/metrics.ts` | Prometheus gauge definitions and `updateMarketScheduleMetrics()` |
| `backend/src/server.ts` | Startup sequence — worker starts after storage and webhook config |
| `backend/src/services/webhookService.ts` | `dispatchWebhookEvent()` — delivers webhook payloads |
| `backend/src/services/queue/index.ts` | Re-exports worker functions from barrel module |
| `backend/grafana/provisioning/alerting/alert_rules.yml` | Grafana alert rule definitions |
| `backend/grafana/toroloom-market-schedule-dashboard.json` | Grafana dashboard panels |
| `backend/src/__tests__/marketScheduleWorker.test.ts` | Worker unit/integration tests (26 tests) |
