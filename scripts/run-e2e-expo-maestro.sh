#!/bin/bash
# =============================================================================
# Toroloom E2E Test Runner — expo run:android + Maestro
# Uses expo run:android to properly build, install, and launch dev build app
# with correct Metro bundler connection parameters.
# =============================================================================

export NODE_ENV_CACHE="E:\ExpoCache"
export TMP="E:\ExpoTemp"
export TEMP="E:\ExpoTemp"

echo "=== 1. Env vars ==="
mkdir -p "E:/ExpoCache" "E:/ExpoTemp" 2>/dev/null

echo "=== 2. Clear app data on emulator ==="
adb -s emulator-5554 shell pm clear com.anonymous.Toroloom 2>&1

echo "=== 3. Start expo run:android (build + install + launch + Metro) ==="
npx expo run:android > /tmp/expo-output.txt 2>&1 &
EXPO_PID=$!
echo "Expo PID=$EXPO_PID"

echo "=== 4. Wait for Metro server (port 8081) ==="
for i in $(seq 1 90); do
  if curl -s http://localhost:8081/status 2>/dev/null | grep -q packager; then
    echo "Metro server ready after ${i}s"
    break
  fi
  if ! kill -0 $EXPO_PID 2>/dev/null; then
    echo "✗ expo run:android process died"
    cat /tmp/expo-output.txt | tail -20
    exit 1
  fi
  sleep 10
done

echo "=== 5. Wait for Android bundle ==="
for i in $(seq 1 36); do
  if grep -q "Android Bundled" /tmp/expo-output.txt 2>/dev/null; then
    echo "Bundled after $((i*5))s"
    grep "Android Bundled" /tmp/expo-output.txt
    break
  fi
  if ! kill -0 $EXPO_PID 2>/dev/null; then
    echo "✗ expo run:android process died during bundle wait"
    cat /tmp/expo-output.txt | tail -20
    exit 1
  fi
  sleep 5
done

echo "=== 6. Wait 30s for app to render ==="
sleep 30

echo "=== 7. Check current UI ==="
adb -s emulator-5554 shell uiautomator dump /data/local/tmp/ui.xml 2>/dev/null
adb -s emulator-5554 shell cat /data/local/tmp/ui.xml 2>/dev/null | grep -o 'text="[^"]*"' | head -20

echo "=== 8. Run Maestro test ==="
cmd //c "C:/Users/Karan/AppData/Local/Maestro/bin/maestro.bat test .maestro/flows/auth/login.yaml" 2>&1
MAESTRO_EXIT=$?

echo "=== 9. Cleanup ==="
kill $EXPO_PID 2>/dev/null
wait $EXPO_PID 2>/dev/null

if [ $MAESTRO_EXIT -eq 0 ]; then
  echo "✓ E2E PASSED"
else
  echo "✗ E2E FAILED ($MAESTRO_EXIT)"
fi
exit $MAESTRO_EXIT
