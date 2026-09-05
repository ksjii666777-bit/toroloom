# 🏗 — Toroloom APK Build Log (Sep 5, 2026)

> **Build run:** Sep 5 14:19-14:23 IST
> **Reason:** LICENSE-READY doc changes (commits 06d8bbe, 2877d44, 461f36d) — rebundle to ensure shipped code matches docs

---

## ✅ Build Result

```
BUILD SUCCESSFUL in 1m 55s
1289 actionable tasks: 70 executed, 1219 up-to-date
```

## 📦 Output APKs

| Variant | File | Size | Use |
|---------|------|------|-----|
| arm64-v8a | `toroloom-arm64-LIVE-backend-v7.apk` | **63.8 MB** | Modern devices (~95% market) |
| armeabi-v7a | `toroloom-arm32-LIVE-backend-v7.apk` | **53.7 MB** | Legacy 32-bit devices |
| universal | `toroloom-universal-LIVE-backend-v7.apk` | **148.9 MB** | Sideload / direct distribution |

All at: `E:/Toroloom-APK/`

## 🔍 APK Metadata (verified via aapt)

```
package: com.toroloom.app
versionCode: 1
versionName: 1.0.0
minSdkVersion: 24 (Android 7.0+)
targetSdkVersion: 36 (Android 16)
compileSdkVersion: 36
```

## ⚙️ Build Command Used (memory recipe)

```bash
cd /e/toroloom-eas
rm -rf dist
npx expo export --platform android --output-dir dist
cp dist/_expo/static/js/android/index-*.hbc android/app/src/main/assets/index.android.bundle
cd android
env -u ANDROID_HOME -u ANDROID_SDK_ROOT -u OS-BIN \
  SENTRY_DISABLE_AUTO_UPLOAD=true \
  SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD=true \
  ./gradlew assembleRelease
```

**Sentry upload skipped** (no `-x ...SentryUpload*` flag needed — env vars suffice, per memory).

## 📊 Build Stats

- Bundle export: 12.5 MB HBC (Hermes byte-compiled)
- Gradle cache: 1,219/1,289 tasks UP-TO-DATE (incremental build)
- Cold build would take ~3-4 min; this run used cache

## 🔗 Build History

| Version | Date | Size | Notes |
|---------|------|------|-------|
| v2 | 2026-08-26 | 153 MB | Universal only |
| v3 | 2026-09-01 | 153 MB | Pre-license-ready |
| v4 | 2026-09-02 | 158 MB | Added backend live config |
| v5 | 2026-09-03 | 64 MB | Per-ABI split (size optimization) |
| v6 | 2026-09-04 | 64 MB | Pre-stockAlert-bugfix |
| **v7** | **2026-09-05** | **64 MB** | **Latest — LICENSE-READY + bugfix included** |

## ✅ Verification Status

- Backend `tsc --noEmit`: 0 errors
- Backend test suite: 2610/2674 PASS (verified Sep 4)
- APK build: SUCCESSFUL
- Bundle: 12.5 MB (no size regression)

## ⚠️ Not Yet Done

- APK not signed with production keystore (debug-signed — for testing only)
- Not uploaded to Play Store (need $25 Google Play account)
- Real broker OAuth (Angel One) not configured (needs user creds)
- Performance testing on real devices not done

---

> 📦 **Latest APK at:** `E:/Toroloom-APK/toroloom-arm64-LIVE-backend-v7.apk`
> 💾 **Internal storage:** `E:/toroloom-eas/android/app/build/outputs/apk/release/`