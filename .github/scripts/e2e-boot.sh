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

# ── 4. Build & install the RELEASE APK (JS bundle embedded) ────────────────
# Release variant bakes the JS bundle + assets into the APK and (unlike the
# debug dev-client) does NOT show expo-dev-client's launcher — the app
# renders straight from the embedded bundle, so no Metro/dev server is
# needed. Release signing uses the debug keystore (template default) so the
# APK installs on the emulator fine. This was the fix for the CI boot
# failure where the dev launcher wedged blank: JS ran, UI never appeared.
echo "Building and installing release APK (expo run:android --variant release)..."
if ! npx expo run:android --variant release --no-bundler 2>&1 | tee /tmp/expobuild.log; then
  echo "::error::expo run:android failed to build/install the release APK."
  tail -80 /tmp/expobuild.log || true
  exit 1
fi
echo "Release APK installed."

# ── 5. Launch the app directly (no Metro, no dev server) ────────────────────
APP_ID="com.toroloom.app"
relaunch_app() {
  adb shell am force-stop "$APP_ID" 2>/dev/null || true
  sleep 2
  adb shell am start -W -n "$APP_ID/.MainActivity" >/dev/null 2>&1 \
    || echo "::warning::App launch intent failed."
  sleep 5
}
echo "Launching the app ($APP_ID)..."
relaunch_app

# ── 6. Confirm the login screen is actually on screen (max 3 min) ───────────
# Give the release app a few seconds to start (embedded bundle, no network
# fetch), then poll the UI hierarchy. If the login screen hasn't appeared
# after ~60s, cold-start the app once more before giving up.
sleep 10
echo "Confirming the login screen is visible..."
RELAUNCHED=0
for i in $(seq 1 36); do
  UI=$(adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && adb shell cat /sdcard/ui.xml 2>/dev/null || true)
  if echo "$UI" | grep -qiE "login-email-input|Welcome Back|Login"; then
    echo "Login screen is visible!"
    break
  fi
  # Not visible after ~60s of polling → bounce the app once more.
  if [ $i -eq 12 ] && [ "$RELAUNCHED" = "0" ]; then
    echo "Login screen not visible yet - force-restarting the app..."
    relaunch_app
    RELAUNCHED=1
  fi
  sleep 5
  if [ $i -eq 36 ]; then
    echo "::error::Login screen never appeared - dumping UI + logcat."
    adb shell uiautomator dump /sdcard/ui.xml 2>/dev/null || true
    adb shell cat /sdcard/ui.xml 2>/dev/null | head -c 2000 || true
    adb logcat -d -t 100 2>/dev/null | grep -iE "ReactNativeJS|FATAL|Exception|AndroidRuntime" | tail -20 || true
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
