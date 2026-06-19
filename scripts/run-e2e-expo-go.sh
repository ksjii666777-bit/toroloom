#!/bin/bash
# =============================================================================
# Run E2E test via Expo Go
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== 1. Clearing port 8081 ==="
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force }" 2>/dev/null
echo "port 8081 cleared"

echo "=== 2. Force-stop and clear Expo Go ==="
adb -s emulator-5554 shell am force-stop host.exp.exponent 2>/dev/null
adb -s emulator-5554 shell pm clear host.exp.exponent 2>/dev/null
echo "Expo Go cleared"

echo "=== 3. Setting up adb reverse proxy ==="
adb -s emulator-5554 reverse tcp:8081 tcp:8081 2>&1

echo "=== 4. Starting Metro server with --android flag ==="
rm -f /tmp/expo-output.txt
npx expo start --clear --android > /tmp/expo-output.txt 2>&1 &
EXPO_PID=$!
echo "Expo PID: $EXPO_PID"

echo "=== 5. Waiting for Metro server ==="
for i in $(seq 1 30); do
  if curl -s http://localhost:8081/status 2>/dev/null | grep -q "packager-status:running"; then
    echo "Metro ready after ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "FAILED: Metro didn't start after 60s"
    tail -20 /tmp/expo-output.txt
    kill $EXPO_PID 2>/dev/null
    exit 1
  fi
  sleep 2
done

echo "=== 6. Waiting for Android Bundle ==="
START_TIME=$(date +%s)
for i in $(seq 1 300); do
  if grep -q "Android Bundled" /tmp/expo-output.txt 2>/dev/null; then
    ELAPSED=$(( $(date +%s) - START_TIME ))
    echo "Android Bundled after ${ELAPSED}s"
    break
  fi
  if [ "$i" -eq 300 ]; then
    echo "FAILED: Bundle not completed after 600s"
    tail -40 /tmp/expo-output.txt
    kill $EXPO_PID 2>/dev/null
    exit 1
  fi
  sleep 2
done

echo "=== 7. Waiting for app to load past splash screen ==="
# Poll the UI until we see either "Welcome" (login screen) or "Good Morning" (home screen), up to 120s
for i in $(seq 1 60); do
  powershell -NoProfile -Command "adb -s emulator-5554 shell uiautomator dump /data/local/tmp/ui.xml 2>&1 > \$null; adb -s emulator-5554 shell cat /data/local/tmp/ui.xml 2>&1" 2>/dev/null > /tmp/ui-dump.txt
  if grep -q "Welcome" /tmp/ui-dump.txt 2>/dev/null; then
    echo "Login screen visible after ${i}s"
    break
  fi
  if grep -q "Good Morning" /tmp/ui-dump.txt 2>/dev/null; then
    echo "Home screen visible after ${i}s (already logged in?)"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Timed out waiting for app screen after 120s"
    tail -20 /tmp/ui-dump.txt
  fi
  sleep 2
done

echo "=== 8. Extra 10s settle time ==="
sleep 10

echo "=== 9. What's on screen now ==="
powershell -NoProfile -Command "adb -s emulator-5554 shell uiautomator dump /data/local/tmp/ui.xml 2>&1 > \$null; adb -s emulator-5554 shell cat /data/local/tmp/ui.xml 2>&1" 2>/dev/null | grep -oP 'text="[^"]*"' | head -30 || echo "No text found"
echo "---"

echo "=== 10. Running Maestro test ==="
cmd //c "C:/Users/Karan/AppData/Local/Maestro/bin/maestro.bat test .maestro/flows/auth/login.yaml" 2>&1
MAESTRO_EXIT=$?

echo "=== 11. Done (Maestro exit code: $MAESTRO_EXIT) ==="
kill $EXPO_PID 2>/dev/null
exit $MAESTRO_EXIT
