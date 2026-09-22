#!/usr/bin/env bash
# =============================================================================
# Toroloom E2E — Android emulator boot + release APK + Maestro flow runner
# =============================================================================
# Extracted from .github/workflows/ci.yml so the Wandalen/wretry.action
# `with: |` string block stays a single-line invocation. Inline multi-line
# scripts with embedded single-quoted `bash -c '...'` blocks were mangled by
# wretry's YAML-string re-parsing, producing:
#   /usr/bin/sh: 1: Syntax error: end of file unexpected (expecting "done")
#
# Strategy: build the RELEASE variant (JS bundle embedded in the APK) and
# launch it directly via `am start`. The previous debug dev-client flow
# (expo run:android --no-bundler + expo start + deep-link relaunch) left the
# app wedged on expo-dev-client's launcher in the headless emulator: the JS
# bundle loaded and ran (CacheWarming logs) but the RN UI never appeared on
# screen — the login screen was never visible, so the boot check always
# timed out. Release builds skip the dev launcher entirely and render the
# login screen straight from the embedded bundle, with no Metro needed.
#
# Usage (called from ci.yml android-emulator-runner `script:` input):
#   bash .github/scripts/e2e-boot.sh <flow-target> [flow-target ...]
#
#   e2e (full suite):  bash .github/scripts/e2e-boot.sh .maestro  # config.yaml discovers subdir flows
#   e2e-pr (critical): bash .github/scripts/e2e-boot.sh \
#                        .maestro/flows/smoke/smokeTest.yaml \
#                        .maestro/flows/ai/aiInsights.yaml ...
#
# Required env (passed inline from workflow secrets):
#   TEST_EMAIL, TEST_PASSWORD — Maestro login credentials
#   EXPO_PUBLIC_API_URL       — repo variable, baked into the release bundle
#                               (App.tsx configureApi). Missing = every API
#                               call fails and login can never complete.
# ==============================================================================

set -euo pipefail

# ── 0. Argument / env validation ────────────────────────────────────────────
if [ $# -lt 1 ]; then
  echo "::error::Usage: bash e2e-boot.sh <flow-target> [flow-target ...]"
  exit 1
fi

if [ -z "${TEST_EMAIL:-}" ] || [ -z "${TEST_PASSWORD:-}" ]; then
  echo "::error::TEST_EMAIL and/or TEST_PASSWORD are not set."
  exit 1
fi

if [ -z "${EXPO_PUBLIC_API_URL:-}" ]; then
  echo "::error::EXPO_PUBLIC_API_URL is not set. The release APK bakes this in"
  echo "::error::at build time; without it every API call fails and login never"
  echo "::error::completes (31/31 flows die with element-not-found). Add the"
  echo "::error::repo variable in Settings → Secrets and variables → Actions."
  exit 1
fi
echo "API base URL for release bundle: set (${EXPO_PUBLIC_API_URL%%://*}://...)"

# ── 0b. Failure diagnosis: dump what was on screen when anything exits ──────
# Runs #331-#336 all died with an opaque "tab-home not found"; without the
# UI hierarchy at failure time every fix is a guess. Best-effort: if the
# dump fails (e.g. emulator already gone) the original exit code still wins.
command -v adb >/dev/null 2>&1 || PATH="${ANDROID_HOME:-}/platform-tools:$PATH"
diag_on_fail() {
  rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "::group::E2E failure diagnosis — visible texts & ids at failure time"
    adb shell uiautomator dump /sdcard/e2e_fail.xml >/dev/null 2>&1 || true
    adb exec-out cat /sdcard/e2e_fail.xml 2>/dev/null \
      | grep -oE '(text|resource-id)="[^"]+"' \
      | tee e2e-failure-hierarchy.txt | head -80 || true
    adb exec-out screencap -p > e2e-failure.png 2>/dev/null || true
    echo "::endgroup::"
  fi
  exit "$rc"
}
trap diag_on_fail EXIT

# ── 1. Wait for the device to appear (max 120s — do NOT hang forever) ───────
# The android-emulator-runner action boots the emulator asynchronously; if
# the adb daemon cannot connect ("Unable to connect to adb daemon on port
# 5037"), wait-for-device would otherwise block until the 900s action
# timeout. Failing fast with diagnostics makes the cause visible.
adb start-server || true
if ! timeout 120 adb wait-for-device; then
  echo "::warning::adb did not connect within 120s - restarting daemon and retrying."
  adb kill-server 2>/dev/null || true
  sleep 3
  adb start-server || true
  if ! timeout 120 adb wait-for-device; then
    echo "::error::adb never connected to a device after daemon restart."
    adb devices -l || true
    exit 1
  fi
fi

# ── 1b. Recover from a device stuck in 'offline' state ─────────────────────
# The emulator can register with adb as 'offline' (kernel booted, adbd not
# ready yet). adb wait-for-device returns as soon as the device is listed,
# so explicitly wait for a 'device' state and bounce the daemon if stuck.
for attempt in $(seq 1 6); do
  STATE=$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" {found=1} END {print found ? "ready" : "offline"}') || true
  if [ "$STATE" = "ready" ]; then
    break
  fi
  if [ "$attempt" -eq 1 ]; then
    # Grace period: right after wait-for-device the device may be listed as
    # 'offline' for a few seconds while adbd finishes starting. Do not kill
    # a healthy daemon on the very first observation.
    sleep 5
    STATE=$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" {found=1} END {print found ? "ready" : "offline"}') || true
    if [ "$STATE" = "ready" ]; then
      break
    fi
  fi
  echo "  device not ready (attempt ${attempt}/6) - bouncing adb daemon..."
  adb kill-server 2>/dev/null || true
  sleep 2
  adb start-server || true
  sleep 5
  if [ "$attempt" -eq 6 ]; then
    echo "::error::Device stayed offline after 6 adb bounce attempts."
    adb devices -l || true
    exit 1
  fi
done

# ── 2. Poll until sys.boot_completed=1 (max 120 × 5s = 10 min) ─────────────
echo "Waiting for sys.boot_completed..."
for i in $(seq 1 120); do
  BOOT_COMPLETED=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n' || true)
  if [ "$BOOT_COMPLETED" = "1" ]; then
    echo "Boot completed!"
    break
  fi
  if [ $i -eq 120 ]; then
    echo "::error::Timed out waiting for boot completion."
    adb devices -l || true
    adb shell getprop 2>/dev/null | head -20 || true
    exit 1
  fi
  sleep 5
done

# ── 3. Disable animations for stable E2E ────────────────────────────────────
adb shell settings put global window_animation_scale 0.0 || true
adb shell settings put global transition_animation_scale 0.0 || true
adb shell settings put global animator_duration_scale 0.0 || true
echo "Animations disabled."

# ── 4. Build & install the RELEASE APK (JS bundle embedded) ────────────────
# Release variant bakes the JS bundle + assets into the APK and (unlike the
# debug dev-client) does NOT show expo-dev-client's launcher — the app
# renders straight from the embedded bundle, so no Metro/dev server is
# needed. Release signing uses the debug keystore (template default) so the
# APK installs on the emulator fine. This was the fix for the CI boot
# failure where the dev launcher wedged blank: JS ran, UI never appeared.
echo "Building and installing release APK (expo run:android --variant release)..."
# SENTRY_DISABLE_AUTO_UPLOAD: the release build runs Sentry's
# createBundleReleaseJsAndAssets_SentryUpload task which needs an auth token
# (sentry.properties has none in CI) — without this the build fails with
# "Auth token is required for this request". E2E doesn't need source maps.
if ! SENTRY_DISABLE_AUTO_UPLOAD=true npx expo run:android --variant release --no-bundler 2>&1 | tee /tmp/expobuild.log; then
  echo "::error::expo run:android failed to build/install the release APK."
  tail -80 /tmp/expobuild.log || true
  exit 1
fi
echo "Release APK installed."

# ── 5/6. Launch + confirm the login screen (resilient retry cycle) ─────────
# Cold-start crashes on a fresh emulator are often TRANSIENT (native init
# races on the first launch after install). Instead of a single launch + one
# bounce, this loop:
#   1. launches the app and polls the UI for the login markers (90s/attempt)
#   2. detects PROCESS DEATH via pidof immediately (no wasted polling) and
#      prints the crash buffer (logcat -b crash) for the actual stack trace
#   3. wipes app state (pm clear) between attempts so a wedged first-run
#      state can never poison the retry
#   4. only fails after MAX_LAUNCH_ATTEMPTS, with full diagnostics dumped
APP_ID="com.toroloom.app"
MAX_LAUNCH_ATTEMPTS=4

launch_app() {
  adb shell am force-stop "$APP_ID" 2>/dev/null || true
  sleep 2
  adb shell am start -W -n "$APP_ID/.MainActivity" >/dev/null 2>&1 \
    || echo "::warning::App launch intent failed."
}

login_visible() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 \
    && adb shell cat /sdcard/ui.xml 2>/dev/null | grep -qiE "login-email-input|Welcome Back|Login"
}

dump_boot_diagnostics() {
  echo "::error::Login screen never appeared after ${MAX_LAUNCH_ATTEMPTS} launch attempts."
  echo "---- UI hierarchy (head) ----"
  adb shell uiautomator dump /sdcard/ui.xml 2>/dev/null || true
  adb shell cat /sdcard/ui.xml 2>/dev/null | head -c 2000 || true
  echo ""
  echo "---- CRASH buffer (logcat -b crash, last 80) — the actual stack ----"
  # The Abort message contains the JS error string (e.g. the TypeError above);
  # print it plus context before the raw tombstone tail.
  adb logcat -b crash -d 2>/dev/null | grep -m1 -A25 "Abort message" || true
  adb logcat -b crash -d 2>/dev/null | tail -80 || true
  echo "---- main buffer RN/AndroidRuntime (last 40) ----"
  adb logcat -d -t 300 2>/dev/null \
    | grep -iE "ReactNativeJS|FATAL|AndroidRuntime|has died" | tail -40 || true
}

echo "Launching the app ($APP_ID) — up to ${MAX_LAUNCH_ATTEMPTS} attempts..."
LOGIN_OK=0
ATTEMPT=0
while [ "$ATTEMPT" -lt "$MAX_LAUNCH_ATTEMPTS" ]; do
  ATTEMPT=$((ATTEMPT + 1))
  launch_app
  # Poll up to 18 × 5s = 90s for this attempt.
  for i in $(seq 1 18); do
    if login_visible; then
      echo "Login screen is visible (attempt ${ATTEMPT})."
      LOGIN_OK=1
      break
    fi
    # Process died? Bail out of this poll immediately — polling a dead
    # process is pure timeout. Print the JS error FIRST (the Abort message is
    # the actual reason — "TypeError: undefined is not a function" — while the
    # tombstone below is just native frames), then the crash stack.
    if [ -z "$(adb shell pidof "$APP_ID" 2>/dev/null | tr -d '\r\n ')" ]; then
      echo "  attempt ${ATTEMPT}: app process DIED - JS error + crash buffer:"
      adb logcat -b crash -d 2>/dev/null | grep -m1 -A25 "Abort message" || true
      adb logcat -b crash -d 2>/dev/null | tail -30 || true
      break
    fi
    sleep 5
  done
  if [ "$LOGIN_OK" = "1" ]; then break; fi
  # Fresh state for the next attempt (first-run wedges, corrupt cache).
  adb shell pm clear "$APP_ID" >/dev/null 2>&1 || true
  echo "  attempt ${ATTEMPT} failed - state cleared, relaunching..."
done

if [ "$LOGIN_OK" != "1" ]; then
  dump_boot_diagnostics
  exit 1
fi

# ── 7. Run the requested Maestro flows ──────────────────────────────────────
# appId is read from each flow file (com.toroloom.app); the --app-id CLI flag
# was removed in modern Maestro versions.
echo "Running Maestro E2E flows: $*"

# ── 7a. Smoke gate: can the app actually log in and reach Home? ─────────────
# Release builds talk to the production API. When the backend is degraded
# (e.g. Postgres down -> /ready 503 -> login fails), EVERY flow fails with
# element-not-found after ~40s each — 31 flows = 21 minutes of noise that
# buries the real signal (observed on run 35579155268). One smoke flow
# decides: backend healthy -> run the full suite; backend broken -> exit
# immediately with the diagnosis instead of failing 31 times.
echo "── Smoke gate: login -> Home (backend health check) ──"
if maestro test .maestro/flows/smoke/smokeTest.yaml \
    --env "TEST_EMAIL=${TEST_EMAIL}" \
    --env "TEST_PASSWORD=${TEST_PASSWORD}"; then
  echo "Smoke gate passed - running the full suite."
else
  echo "::error::Smoke gate FAILED: login -> Home did not complete."
  echo "::error::The flow already retried login 3x, so this is likely not a"
  echo "::error::one-off blip. Check, in order: /ready on the backend (Postgres"
  echo "::error::down makes login 5xx), the E2E failure diagnosis group above"
  echo "::error::(visible texts/ids at failure time), and the e2e-failure.png"
  echo "::error::artifact uploaded with this run."
  exit 1
fi

# ── 7b. Full suite ──────────────────────────────────────────────────────────
maestro test "$@" \
  --env "TEST_EMAIL=${TEST_EMAIL}" \
  --env "TEST_PASSWORD=${TEST_PASSWORD}"
