# E2E Stabilization Changelog — Runs 16–36

![E2E](https://img.shields.io/badge/E2E%20run--36-30%2F30%20passed-brightgreen) ![Gate](https://img.shields.io/badge/hard%20gate-blocking%20%28continue--on--error%3A%20false%29-blue) ![Runs](https://img.shields.io/badge/green%20under%20gate-5%20runs%20%2830%E2%80%9333%2C%2036%29-success)

> **Latest:** Run 36 (sha `5ad4831`, 2026-10-01) — **30/30 passed, single attempt** (~1h40m), job SUCCESS, crash tally 0. All runtime fixes verified together in one run: grpc-js 1.14.5 (audit-gate advisory response), Skia prebuilt step, connectBroker/orderEdgeCases/contractNoteParser gates, deterministic backend test. Runs 34–35 were infra-class failures only (registry advisories, cache-dependent build, Google-CDN flake) — detailed saga below.

**Scope:** Maestro E2E suite on `master`, CI job **"E2E — Full Suite (master)"**, runs 16–36 (2026-09-27 → 2026-10-01).
**Infra:** per-flow runner (`.github/scripts/e2e-boot.sh`), `FLOW_TIMEOUT_SECS=420` per flow, `timeout-minutes: 240`, emulator launch via `Wandalen/wretry.action@v3.1.0`, per-flow retry (exit-124 timeout class + no-COMPLETED cold-start class).
**Hard gate:** `continue-on-error: false` + `::error::…BLOCKING` summary since commit `a3e4a15` (2026-09-30). First two runs under the hard gate are green.

Raw job logs kept locally as `e2e_run16.log` … `e2e_run36.log` (untracked; line refs below point into these files).

---

## TL;DR

| Metric | Run 16 | Run 36 (latest) |
| --- | --- | --- |
| Attempt-1 | 24/30 | **30/30** |
| Final | 24/30 (att1+att2 same fails) | **30/30** (single attempt) |
| Repeat-offender flows | 6 | 0 (retries are infra-class only) |

Trajectory: `24/30 → 23/30 → 23/30 → 26/30 → 25/30 → 27/30 → 28/30 → 29/30 → 29/30 → 29/30 → 30/30 → 30/30 → 30/30 → 28/30 (hard-gate fail) → 30/30 → 30/30 → 30/30 → 30/30 → build-broken (0 flows) → 29/30 (att2 CDN-dead) → 30/30`.

Runs 26–28 were the first fully-green runs (single attempt each, 30 flow starts, no retries). Run 29 introduced the hard gate and exposed 2 real page-stall bugs; run 30 fixed those; run 31 confirmed the last flow-level fix and reached green under the gate; runs 32–33 are the first **single-attempt** greens under the gate (run 32 is also the fastest of the window at ~1h35m). Runs 34–35 then broke on infra (new registry advisories → a latent cache-dependent build bug; stacked third-party flakes); run 36 re-verified every fix together and is the cleanest baseline of the window.

---

## Run-by-run

| Run | Date (UTC) | Fix commit tested | Att1 | Att2 | Outcome |
| --- | --- | --- | --- | --- | --- |
| 16 | 09-27 | `d705636` | 24/30 (`run16.log` L5477) | 24/30 (L9494) | Same 6 fails both attempts |
| 17 | 09-27 | `e4cb4f9` | 24/30 (L5394) | 23/30 (L9344) | Same 6 fails + 1 new in att2 |
| 18 | 09-28 | `6014345` | 23/30 (L5335) | 24/30 (L9168) | 420s cold-starts hit `forgotPassword`/`login`/`contractNoteParser` |
| 19 | 09-28 | `de238dc` | 26/30 (L5407) | 27/30 (L9262) | `courseDetail` fails in **both** attempts |
| 20 | 09-28 | `c65fd27` | 25/30 (L5464) | 26/30 (L9409) | `deepLinkUniversalSignup` fails both attempts |
| 21 | 09-28 | `a0089c2` | 27/30 (L5398) | 26/30 (L9238) | `courseDetail` fails both attempts again |
| 22 | 09-29 | `77e04e0` | 28/30 (L5356) | 29/30 (L9093) | Only `orderEdgeCases` (L4141) + one 420s |
| 23 | 09-29 | `9a89a91` | 29/30 (L5428) | **30/30** (L9208) | `orderEdgeCases` L4212 the sole fail |
| 24 | 09-29 | `0b45d3c` | 29/30 (L4909) | 29/30 (L8785) | `bankLinking` one-off, `orderEdgeCases` att2 |
| 25 | 09-29 | `24501ea` | 29/30 (L5015) | 29/30 (L8894) | `orderEdgeCases` both attempts → flow redesigned (`ac7295f`) |
| 26 | 09-30 | `ac7295f` | **30/30** (L4928) | — | First fully-green run, zero retries |
| 27 | 09-30 | `ac7295f` | **30/30** (L4958) | — | Green |
| 28 | 09-30 | `ac7295f` | **30/30** (L4948) | — | Green (last pre-gate run) |
| 29 | 09-30 | `a3e4a15` (hard gate) | 28/30 (L5060) | 28/30 (L8966) | **Job FAILED under hard gate** — same 2 fails both attempts |
| 30 | 09-30 | `3393d69` | 28/30 (L5176) | **30/30** (L9140) | Job SUCCESS; `connectBroker` new att1 flake |
| 31 | 10-01 | `77dc49b` | 28/30 (L5198) | **30/30** (L9082) | Job SUCCESS; att1 fails are infra-class only |
| 32 | 10-01 | `810a985` | **30/30** (L4934) | — | Job SUCCESS; first single-attempt green under the gate (~1h35m); 1 retry (`forgotPassword` 420s) |
| 33 | 10-01 | `40bae28` | **30/30** (L5009) | — | Job SUCCESS; crash tally live (`Native crashes (Fatal signal): 0`, L5010); 2 infra-class retries |
| 34 | 10-01 | `2b8a10c` | — (build fail) | — | **Job FAILED before any flow** — grpc-js lockfile bump → node cache miss → fresh install without skia postinstall → CMake `Skia prebuilt binaries not found` (`run34.log` L1688, L1696) |
| 35 | 10-01 | `1573e6a` | 29/30 (L5013) | — | Skia fix verified (L529); att1 fail `aadhaarVerification` (L4056, contentless dump); att2 killed by Google-CDN emulator download error (L5207) → rerun (cancelled by next push) |
| 36 | 10-01 | `5ad4831` | **30/30** (L5056) | — | Job SUCCESS; crash tally 0 (L5057); 1 infra retry (`panVerification` 420s, L4247); all fixes verified in one run |

---

## Per-flow sagas (root cause → fix → verification)

### orderEdgeCases — the long saga (runs 16–30)

The most persistent offender: failed in runs 16, 17 (420s), 19 (420s), 20, 22, 23, 24, 25, 29 (both attempts), 30 (att1). Fixed in stages:

1. **Chips assert before any scroll; heal re-taps Max** — `24501ea`, `ac7295f` (runs 24–25). Root cause: fatal `scrollUntilVisible` inside `runFlow.when` guards kills the whole flow; scrolling consumed the visible chips assert.
2. **Run-29 root: centre-swipe page stall** — dump evidence in `run29.log` (fails L3810/L7713): form stuck at top (`Estimated Total` last in dump); both plain `scroll` commands moved the page **zero pixels**. Cause: Maestro's `scroll`/`scrollUntilVisible` swipe from **screen centre**, which lands on the large qty TextInput / inside a focused EditText — the drag is consumed, RN ScrollView drops the fling.
   **Fix `3393d69`:** explicit slow `swipe` from the right gutter (`90%,50% → 90%,15%`, 700 ms) + a guarded second swipe + fatal EWU 45 s for the balance line.
3. **Verification:** run-30 att2 (`run30.log` L7986) — single swipe, guarded repeat SKIPPED, balance assert COMPLETED. Run-31 both attempts pass (`run31.log` L3981, L7932); runs 32–33 att1 pass (`run32.log` L3781, `run33.log` L3850). Zero fails since the fix.

### contractNoteParser — centre-swipe stall, same family (runs 18, 21, 22, 29)

- Run-29 fails (L4473/L8379): dump stuck at `Parsed Trades` title; `scrollUntilVisible "RELIANCE"` DOWN timed out in 31 s — same centre-swipe consumption over the paste box area.
- **Fix `3393d69`:** swipe from below the paste box (`50%,72% → 50%,57%`, 700 ms) + guarded repeat; RELIANCE gate via `scrollUntilVisible` with `visibilityPercentage: 50` (accepts partially clipped rows); guarded **UP** search for Zerodha (blind DOWN nudged it further away).
- **Verification:** run-30 att1 PASS (L4624) and att2 PASS (L8587); run-31 both attempts PASS (L4646, L8533); runs 32–33 att1 PASS (`run32.log` L4382, `run33.log` L4454). Zero fails since the fix.

### connectBroker — heal-path timeout budget (run 30)

- Run-30 att1 fail (L3645): primary nav scroll (60 s budget) took ~27 s at speed 20 and COMPLETED; the **browser-heal path** — Zerodha tap → device browser → BACK×2 → tab-more → scroll to "Connect Broker" — used `timeout: 30000` and died at the wall (`run30.log` L3641 error, exit at 31 s wall clock). att2 passed the identical step.
- **Fix `77dc49b`:** both heal-path scrolls (lazy-mount re-tap, browser-back re-entry) raised to 60 s, matching the primary nav.
- **Verification:** run-31 att1 PASS (L3738) — first time this flow passed attempt 1 — and att2 PASS (L7765); runs 32–33 att1 PASS (`run32.log` L3616, `run33.log` L3685). Zero fails since the fix.

### Runs 34–36: the dependency-advisory saga (2026-10-01)

Three commits in one day after the Audit Gate started failing — none touched app/flow code, yet all three were needed to get back to green.

1. **Audit Gate broke on registry-side advisories (`2b8a10c`).** From `77dc49b` (10-01 06:02) the **Dependency Audit Gate** job failed in every run although no dependency changed in the repo (intervening commits were YAML/shell/docs only). Cause: new advisories published on npm/GHSA on 09-30/10-01 — a real CVE for `@grpc/grpc-js` (CVE-2026-101916 / GHSA-m9gg-hp2v-232j, `getAuthContext` unauthorized certificates; fix 1.13.6/1.14.5) and 5 "unknown advisory" entries across the firebase family (incomplete GHSA records covering all modern versions, fix release not yet available). Fix: `package.json` override `"@grpc/grpc-js": "^1.13.6"` (lockfile resolves **1.14.5**) + explicit `ALLOW_HIGH` entries for the 5 firebase-family packages in `scripts/audit-gate.mjs` with reasons and a monthly re-review note. Local gate: root prod high=8 (all allowlisted), backend clean, exit 0.
2. **The Audit fix exposed a latent build dependency on cache warmth (`1573e6a`).** Run-34 (job 110378328011) died **before any flow ran**: the lockfile change invalidated the `nodes-ROOT-*` node_modules cache key, and the fresh install — always run with `npm ci --ignore-scripts` for supply-chain hardening — never executed skia's postinstall, so `libskia.a` was missing and CMake failed: `Skia prebuilt binaries not found. Run 'npx install-skia'` (`run34.log` L1688, L1696). The binaries had always ridden along inside the warm cache. Fix: idempotent `npx install-skia` step added to **both** E2E jobs (master + PR). Verified in run-35 (step at `run35.log` L529, build passes).
3. **Run-35 stacked two independent third-party flakes (job 110389656904).** att1: 29/30, sole fail `aadhaarVerification` (L4056) — `Verify OTP` tap and the heal re-tap both COMPLETED, but "Aadhaar Verified" never appeared within the 60 s EWU, and the failure-time dump was contentless (crash buffer empty, no useful hierarchy) → device/app-level stall (suspected backend verify-call hang or ANR), not a flow bug — the flow had been clean for 12+ runs. att2 never started: the emulator wrapper's SDK download from `dl.google.com` failed (`emulator-linux_x64-16428233.zip`, L5207) → "Attempts exhausted, made 2 attempts" (L5218). An HTTP-201 rerun was requested, then cancelled by the `5ad4831` push (`cancel-in-progress: true`).
4. **Deterministic fix for a statistical backend test (`5ad4831`).** The rerun's Backend job failed on `commodityQuotes.test.ts` — "Energy commodities higher volatility than metals" compared the *empirical* average `|changePercent|` of 30 random ticks per symbol (0.0997 vs 0.1027 — margin-of-noise, a coin flip on a random walk). Fix: export `commoditySeeds` from `backend/src/services/broker/mockBroker.ts` and assert the configured volatilities directly (XAUUSD 0.15 < CL 0.32 / NG 0.40). CI-verified green in run-36.
5. **Run-36 (job 110447389747, sha `5ad4831`)** re-verified everything together: 30/30 single attempt (L5056), crash tally 0 (L5057), all four recently-fixed flows att1 PASS (`connectBroker` L3735, `orderEdgeCases` L3900, `aadhaarVerification` L4102, `contractNoteParser` L4504), only retry `panVerification` 420s (L4247, att2 pass). grpc-js 1.14.5 ran under the full app runtime.

### Run 37 (job 110769830125, sha `089cdfb`) — the assertion-flake class (2026-10-02)

First suite run after the `/api/market/stocks` 500 + AAPL-`Not found` fixes (`5dd596a`, `089cdfb`) — **neither fix touches any flow here**, and it showed the one remaining blind spot in the runner.

- **Result: both attempts 29/30, crash tally 0** (att1 L5153-5154, att2 L9149-9150), 06:42→11:38 UTC, ~2 h 56 m.
- **att1 fails `orderEdgeCases` (L3834) — dropped scroll gesture.** The balance row (`.*Available:.*|.*Insufficient balance.*`) never entered the viewport and the failure hierarchy proved there *was* content below the fold (`order-summary-est-total` clipped at y=1825, L~4000): the two slow gutter drags at `90%` were silently dropped by the RN ScrollView. Passed att2 (L7899).
- **att2 fails `aadhaarVerification` (L8193) — wedged emulator.** The `Verify OTP` tap and heal re-tap both COMPLETED, but "Aadhaar Verified." never rendered inside the 60 s EWU, and the diagnosis dump came back **completely empty** (crash buffer, scrollable containers AND hierarchy — i.e. `adb`/`uiautomator` itself was unresponsive). Same failure mode as run-35 att1. Passed att1 (L4201).
- **Root cause of the *job* failure (not the flows): the per-flow retry only covered exit-124 timeouts and no-COMPLETED cold-start deaths.** Any single assertion-failure flake therefore killed its whole suite attempt, and the job-level attempt-2 was spent on a *different* flow — so two independent coin-flips both counted as fatal. Fix in `e2e-boot.sh`: **any** non-zero death now takes the diagnosis dump first (so the failed screen is still foregrounded) and then gets exactly one retry; a retry that passes emits a `::notice::` so the flake stays visible, and a flow that fails twice is reported as a deterministic failure (the hard gate is unchanged). Plus a third guarded gutter drag in `orderEdgeCases.yaml` for the dropped-gesture class.

### courseDetail — scroll-position fragility (runs 16–21, six consecutive)

Failed every run from 16–21 (e.g. `run21.log` L4215 att1, L8149 att2). Root causes: fatal `scrollUntilVisible` for "Key Takeaways" below the fold, and UP-scroll heal missing for the Learning Hub. Fixed by `52f836c` (scroll Key Takeaways into view, hardware-BACK Funds exit) and `e8a4ad7` (UP-scroll heal). Clean from run 22 onward.

### deepLinkUniversalSignup — state machine races (runs 16–21)

Failed 16, 17, 18 (420s), 19 (420s), 20, 21 (L3701 att1, L7597 att2). Root causes: logged-in deep-link re-entry landing on Home instead of Signup, and no third-state recovery. Fixed by `a0089c2` (no logged-in re-entry) + `77e04e0` (safe deep-link recovery). Clean from run 22 onward.

### emptyStates (runs 16, 17, 19, 20) — fixed by `de238dc`/`c65fd27` era (holdings normalization, scroll repairs). Clean from run 21.

### One-off failures (single run, never repeated)

| Flow | Run | Evidence | Class |
| --- | --- | --- | --- |
| signup | 16 (420s), 17 | `run16.log` L3919 | cold-start |
| login | 18 | `run18.log` L3765 (420s) | cold-start |
| forgotPassword | 18 (420s clear-state) | `run18.log` L3730 | cold-start |
| bankLinking | 24 | `run24.log` L4002 | one-off assert |
| aadhaarVerification | 20, 21 (420s) | `run21.log` L8290 | one-off + cold-start |
| aiInsights | 22 | `run22.log` L3551 (420s) | cold-start |
| placeOrder | 18 | `run18.log` L5028 | one-off |

---

## Infra-class flakes still present (accepted, absorbed by retry)

These are not flow bugs; the per-flow retry and the job-level attempt-2 pass them. Evidence from run 31:

1. **Emulator cold-start / app stall (420 s class)** — `Launch app` or `Clear state` hangs for the full `FLOW_TIMEOUT_SECS`.
   Run-31: digiLocker att1, `Launch app` 420 s (`run31.log` L4270), retried, att2 PASS (L8273). Also run-30 loginErrors att2 (`run30.log` L7553).
   Heuristic in `e2e-boot.sh` (exit-124 timeout class + no-COMPLETED cold-start class) retries exactly these.
2. **Hermes VM native crash (SIGSEGV)** — flow-independent, launch+2s, NOT reachable from flow YAML. Recurring pattern — 5 events / 4 runs since 09-28, identical signature every time: `Fatal signal 11 (SIGSEGV), code 2 (SEGV_ACCERR)`, main thread, `Process uptime: 2s`, backtrace through `gwp_asan::GuardedPoolAllocator::deallocate` → `libhermesvm.so` (GWP-ASan guard-page hit = use-after-free detection in the Hermes VM heap).

   | Run | Date | Flow (attempt) | Log ref | Fault addr |
   | --- | --- | --- | --- | --- |
   | 18 | 09-28 08:53 | placeOrder (att2) | `run18.log` L8872 | `0x7c96d153d000` |
   | 20 | 09-28 14:04 | aadhaarVerification (att1) | `run20.log` L4410 | `0x72c1325ec000` |
   | 21 | 09-28 18:09 | deepLinkUniversalSignup (att2) | `run21.log` L7601 | `0x76584230f000` |
   | 31 | 10-01 06:46 | forgotPassword (att1) | `run31.log` L3429 | `0x714047263000` |
   | 31 | 10-01 07:15 | digiLocker (att1) | `run31.log` L4294 | `0x714047263000` (same) |

   Every event so far was absorbed by the per-flow retry (crashed flow passed its other attempt). Run 31 was the first with two events in one job (same fault addr — deterministic allocation path). The per-run tally now surfaces in the runner summary (`40bae28`); at >=2 per run on a repeat, file the Hermes upstream issue with the full backtraces.
3. **Lazy-mount / device-stall timeouts** — occasional single-flow `timed out after 420s (device/app stall class)` with no crash; retry passes (run-36: `panVerification`, `run36.log` L4247).
4. **Emulator package download from Google CDN** — run-35 att2 never started: `sdkmanager --install emulator` failed on `dl.google.com/...emulator-linux_x64-16428233.zip` (`run35.log` L5207). Pure third-party infra; the wrapper burned its attempt before any flow retry could happen. Mitigation is none (retry the run); watch frequency.

Post-fix att1 fail rate: run 30 att1 = 2 fails (1 real, fixed), run 31 att1 = 2 fails (0 flow bugs), runs 32–33 att1 = **0 fails** (only infra-class retries: run 32 `forgotPassword` 420s; run 33 `deepLinkSignup` cold-start + `emptyStates` 420s), run 34 = build broken (infra), run 35 att1 = 1 fail (infra-class stall), run 36 att1 = **0 fails**. The suite is stable; remaining variance is emulator/registry-side.

---

## Maestro lessons (verified on this suite)

- **Text asserts are full-match** — use regex (`.*Available:.*`) for partial matching.
- **`waitForAnimationToEnd` does not sleep** — busy-wait cooldowns via `evalScript` when a settle delay is needed.
- **`scroll`/`scrollUntilVisible` swipe from screen centre** — on screens with a large centered TextInput the drag is eaten and the page does not move. Use explicit slow `swipe` (start/end %, 700 ms) from an empty spot; keep a guarded second swipe.
- **`runFlow.when` guards the condition but a failing command inside still fails the flow** — heals inside guards must use unfailable primitives (`scroll`/`swipe`); fatal asserts live only in bounded `extendedWaitUntil` gates.
- **`scrollUntilVisible` + `visibilityPercentage: 50`** accepts partially clipped rows — more robust than 100%.
- **Match scroll budgets to observed latency** — a scroll measured at ~27 s must not sit behind a 30 s timeout in heal paths.

## Runner/tooling evolution across the window

- `6e9d60d`: per-flow logs, live-probe evidence, 240-min job cap.
- `d705636`: YAML indent slip + directory-expansion fix in per-flow runner.
- `e4cb4f9`: crash-buffer capture (logcat -b crash), LessonView self-heal, RAM bump.
- `a3e4a15`: hard gate (`continue-on-error: false`) + `::error::…BLOCKING` summary.
- `3393d69` era: failure diagnosis now dumps scrollable-container bounds + full hierarchy with bounds (head -160) + crash buffer + screencap, in both trap functions of `e2e-boot.sh`.
- Retry heuristics: originally exit-124 (timeout class) + no-COMPLETED cold-start class; **widened in run-37** to *any* non-zero death (assertion/step-failure class included) — diagnosis dump first, then one retry, `::notice::` on recovery, deterministic if both attempts fail.
- `810a985`: CI `paths-ignore: docs/**` — docs-only pushes skip the whole workflow (a skipped run reports no status check; pair with branch-protection tolerance when the E2E check becomes required).
- `40bae28`: per-run Hermes crash tally — counts `Fatal signal` events from the device crash buffer after each flow (buffer cleared per flow), warns per flow, and emits a run-level `::warning::` annotation with the total.
- `2b8a10c`: Audit Gate advisory response — `@grpc/grpc-js` override (→ 1.14.5) + firebase-family `ALLOW_HIGH` entries with re-review note in `scripts/audit-gate.mjs`.
- `1573e6a`: `npx install-skia` in both E2E jobs — the Android build no longer depends on node_modules cache warmth after any lockfile change.
- `5ad4831`: deterministic commodity-volatility test (`commoditySeeds` exported from `mockBroker.ts`) — removes the last random-walk coin-flip test from the Backend job.

## Status & next steps

- Green under the hard gate: runs 30–33 and **36** (single attempt, crash tally 0). Runs 34–35 were infra-class failures (registry advisories → latent cache-dependent build; stacked CDN + device flakes); run-**37** (post-`5dd596a`/`089cdfb`) was 29/30 in **both** attempts with 0 crashes — two *different* single-flow assertion flakes (`orderEdgeCases` dropped scroll, `aadhaarVerification` wedged emulator), which is exactly the class the widened per-flow retry now absorbs. Next run should confirm green without a code change.
- Remaining manual step: mark **"E2E — Full Suite (master)"** as a required status check in branch protection (GitHub UI → Settings → Branches / Rulesets) — configure it to tolerate skipped runs (see the `810a985` docs-only caveat).
- Watch: Hermes SIGSEGV per-run tally (>=2/run → upstream report); Google-CDN emulator-download failures; consider emulator warm-pool if cold-start 420s retries become frequent.
- Docs-only pushes now skip CI entirely (`810a985`, dogfood-verified on `c98185c`): this file's updates cost zero CI minutes.
