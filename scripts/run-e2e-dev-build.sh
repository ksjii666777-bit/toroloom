#!/bin/bash
# =============================================================================
# Run E2E test via Dev Build (expo run:android)
# =============================================================================
# This script:
#   1. Kills leftover processes on port 8081
#   2. Runs `npx expo run:android` to build & launch the dev build app
#   3. Waits for the app to load (polling for login/home screen)
#   4. Runs the Maestro test
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== 1. Clearing port 8081 ==="
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force }" 2>/dev/null
echo "port 8081 cleared"

echo "=== 2. Setting up adb reverse proxy (for Metro connection) ==="
adb -s emulator-5554 reverse tcp:8081 tcp:8081 2>&1 || echo "adb reverse may have failed"

echo "=== 3. Starting expo run:android (build + launch dev build) ==="
rm -f /tmp/expo-output.txt
# expo run:android starts the Metro server and launches the app on the emulator
npx expo run:android > /tmp/expo-output.txt 2>&1 &
EXPO_PID=$!
echo "Expo PID: $EXPO_PID"

echo "=== 4. Waiting for Metro server ==="
for i in $(seq 1 30); do
  if curl -s http://localhost:8081/status 2>/dev/null | grep -q "packager-status:running"; then
    echo "Metro ready after ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "FAILED: Metro didn't start after 60s"
    tail -30 /tmp/expo-output.txt
    kill $EXPO_PID 2>/dev/null
    exit 1
  fi
  sleep 2
done

echo "=== 5. Waiting for app to launch and render (polling for login/home screen) ==="
START_TIME=$(date +%s)
APP_LOADED=false
for i in $(seq 1 180); do
  ELAPSED=$(( $(date +%s) - START_TIME ))
  # Dump UI and check for app text
  powershell -NoProfile -Command "adb -s emulator-5554 shell uiautomator dump /data/local/tmp/ui.xml 2>&1 > \$null; adb -s emulator-5554 shell cat /data/local/tmp/ui.xml 2>&1" 2>/dev/null > /tmp/ui-dump.txt

  if grep -q "Welcome" /tmp/ui-dump.txt 2>/dev/null; then
    echo "Login screen visible after ${ELAPSED}s"
    APP_LOADED=true
    break
  fi
  if grep -q "Good Morning" /tmp/ui-dump.txt 2>/dev/null; then
    echo "Home screen visible after ${ELAPSED}s (may already be logged in)"
    APP_LOADED=true
    break
  fi
  # Show progress every 30s
  if [ $((i % 15)) -eq 0 ]; then
    SPLASH_TEXT=$(grep -oP 'text="[^"]*"' /tmp/ui-dump.txt 2>/dev/null | head -5 | tr '\n' ' ')
    echo "  Still waiting at ${ELAPSED}s... visible text: ${SPLASH_TEXT:-none}"
    tail -5 /tmp/expo-output.txt 2>/dev/null | head -1
  fi
  sleep 2
done

if [ "$APP_LOADED" = false ]; then
  echo "FAILED: App did not load after 360s"
  echo "=== Metro output tail ==="
  tail -30 /tmp/expo-output.txt
  echo "=== UI dump ==="
  cat /tmp/ui-dump.txt | grep -oP 'text="[^"]*"' | head -20
  kill $EXPO_PID 2>/dev/null
  exit 1
fi

echo "=== 6. Extra 10s settle time ==="
sleep 10

echo "=== 7. What's on screen now ==="
cat /tmp/ui-dump.txt 2>/dev/null | grep -oP 'text="[^"]*"' | head -30 || echo "No text found"
echo "---"

echo "=== 8. Running Maestro test ==="
cmd //c "C:/Users/Karan/AppData/Local/Maestro/bin/maestro.bat test .maestro/flows/auth/login.yaml" 2>&1
MAESTRO_EXIT=$?

echo "=== 9. Done (Maestro exit code: $MAESTRO_EXIT) ==="
kill $EXPO_PID 2>/dev/null
exit $MAESTRO_EXIT
