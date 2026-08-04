#!/usr/bin/env bash
# =============================================================================
# Toroloom E2E — Android emulator boot + Expo/Metro + Maestro flow runner
# =============================================================================
# Extracted from .github/workflows/ci.yml so the Wandalen/wretry.action
# `with: |` string block stays a single-line invocation. Inline multi-line
# scripts with embedded single-quoted `bash -c '...'` blocks were mangled by
# wretry's YAML-string re-parsing, producing:
#   /usr/bin/sh: 1: Syntax error: end of file unexpected (expecting "done")
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
# =============================================================================

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

# ── 4. Build & install the dev client (Gradle) ──────────────────────────────
# The project uses expo-dev-client (bundle id com.toroloom.app); Maestro can
# only drive the app once a dev build is installed on the emulator.
echo "Building and installing dev client (expo run:android)..."
if ! npx expo run:android --no-bundler 2>&1 | tee /tmp/expobuild.log; then
  echo "::error::expo run:android failed to build/install the dev client."
  tail -80 /tmp/expobuild.log || true
  exit 1
fi
echo "Dev client installed."

# ── 5. Start Expo dev server (Metro) in the background ──────────────────────
echo "Starting Expo dev server..."
npx expo start 2>&1 | tee /tmp/expo.log &
EXPO_PID=$!

# Kill the background Expo/Metro process when this script exits (success or
# failure). If we leak it, a wretry retry attempt re-runs the whole action on
# the same runner and the orphaned Metro on :8081 poisons the second boot
# (attempt 2 hung for 43 min until the 60-min job timeout).
cleanup() {
  if [ -n "${EXPO_PID:-}" ]; then
    kill "$EXPO_PID" 2>/dev/null || true
    # also kill the npm/node children of the expo pipeline
    pkill -f 'expo start' 2>/dev/null || true
    pkill -f 'metro' 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ── 6. Wait for Metro to be ready (max 180s) ────────────────────────────────
echo "Waiting for Metro bundler..."
if ! timeout 180 bash -c '
  until grep -qi "Metro\|bundler\|ready\|exp://" /tmp/expo.log 2>/dev/null; do
    sleep 5
    printf "."
  done
  echo ""
  echo "Expo/Metro server is ready!"
'; then
  echo "::error::Metro bundler did not become ready within 180s."
  tail -50 /tmp/expo.log || true
  kill "$EXPO_PID" 2>/dev/null || true
  exit 1
fi

# ── 6b. Wait for the first JS bundle + login screen (max ~7 min) ─────────────
# "Metro ready" only means the dev server is listening; the first native
# bundle build takes ~60s+ (seen: 65.9s in CI) and the app only shows the
# login UI once it has received the bundle. Starting Maestro before that
# makes every flow fail with "Welcome Back!/login-email-input is visible".
echo "Waiting for the first Android bundle to complete..."
BUNDLED=0
for i in $(seq 1 60); do
  if grep -qi "Android Bundled" /tmp/expo.log 2>/dev/null; then
    echo "Android bundle built!"
    BUNDLED=1
    break
  fi
  sleep 5
done
if [ "$BUNDLED" != "1" ]; then
  echo "::warning::No 'Android Bundled' line seen in expo.log after 300s - continuing anyway."
  tail -20 /tmp/expo.log || true
fi

# Let the JS render, then confirm the login screen is actually on screen.
sleep 10
echo "Confirming the login screen is visible..."
for i in $(seq 1 24); do
  UI=$(adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && adb shell cat /sdcard/ui.xml 2>/dev/null || true)
  if echo "$UI" | grep -qiE "login-email-input|Welcome Back|Login"; then
    echo "Login screen is visible!"
    break
  fi
  sleep 5
  if [ $i -eq 24 ]; then
    echo "::error::Login screen never appeared after bundle - dumping UI + logcat."
    adb shell uiautomator dump /sdcard/ui.xml 2>/dev/null || true
    adb shell cat /sdcard/ui.xml 2>/dev/null | head -c 2000 || true
    adb logcat -d -t 100 2>/dev/null | grep -iE "ReactNativeJS|FATAL|Exception" | tail -20 || true
    kill "$EXPO_PID" 2>/dev/null || true
    exit 1
  fi
done

# ── 7. Run the requested Maestro flows ──────────────────────────────────────
# appId is read from each flow file (com.toroloom.app); the --app-id CLI flag
# was removed in modern Maestro versions.
echo "Running Maestro E2E flows: $*"
maestro test "$@" \
  --env "TEST_EMAIL=${TEST_EMAIL}" \
  --env "TEST_PASSWORD=${TEST_PASSWORD}"
