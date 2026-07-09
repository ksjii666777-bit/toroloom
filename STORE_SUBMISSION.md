# Toroloom — App Store & Play Store Submission Guide

> **Last updated:** July 2026

---

## Prerequisites

| Item | Status | Notes |
|------|--------|-------|
| ✅ Apple Developer Account ($99/yr) | Required | [developer.apple.com](https://developer.apple.com) |
| ✅ Google Play Developer Account ($25 one-time) | Required | [play.google.com/console](https://play.google.com/console) |
| ✅ EAS Build account (credits) | Required | [expo.dev](https://expo.dev) — free tier included |
| ✅ App icon + splash assets | Done | In `assets/` directory |
| ✅ Privacy policy | Done | At `docs/privacy-policy.html` |
| ✅ Terms of service | Done | At `docs/terms-of-service.html` |

---

## 1. Configure `eas.json` — Apple IDs

Before building, you need to fill in 3 values in `eas.json` under `submit.production.ios`:

| Field | What it is | Where to find it |
|-------|-----------|------------------|
| **`appleId`** | Your Apple ID email | The email you use to log into [appstoreconnect.apple.com](https://appstoreconnect.apple.com) |
| **`ascAppId`** | App Store Connect App ID (numeric) | Go to App Store Connect → Your App → **App Information** → **Apple ID** (e.g., `1234567890`) |
| **`appleTeamId`** | Apple Developer Team ID (10 chars) | Go to [developer.apple.com](https://developer.apple.com) → **Membership** → **Team ID** (e.g., `A1B2C3D4E5`) |

### 🔍 Step-by-step: How to find each value

#### `appleId` — your Apple ID email
- Simply your personal or business Apple ID that you use for Apple Developer Program
- Example: `you@example.com`

#### `ascAppId` — App Store Connect App ID
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click on your app (you need to create the app first if you haven't — see Step 5)
3. In the left sidebar, click **App Information**
4. Look for **Apple ID** — it's a numeric ID (e.g., `6478234567`)
5. Copy that number and paste it into `eas.json`

> ⚠️ If you haven't created your app in App Store Connect yet, do that first:
> 1. Log into [App Store Connect](https://appstoreconnect.apple.com)
> 2. Click **+** → **New App**
> 3. Platform: **iOS**
> 4. Name: **Toroloom**
> 5. Primary Language: **English (India)**
> 6. Bundle ID: **com.toroloom.app**
> 7. SKU: **TOROLOOM_001**
> 8. After creation, go to App Information → copy the **Apple ID** number

#### `appleTeamId` — Developer Team ID
1. Go to [developer.apple.com](https://developer.apple.com)
2. Click **Account** (top right)
3. Look at the **Membership** section
4. **Team ID** is a 10-character alphanumeric string (e.g., `A1B2C3D4E5`)
5. Copy it and paste into `eas.json`

### ✅ After filling, your `eas.json` should look like:
```json
"submit": {
  "production": {
    "ios": {
      "appleId": "you@example.com",
      "ascAppId": "1234567890",
      "appleTeamId": "A1B2C3D4E5"
    },
    "android": {
      "track": "production",
      "releaseStatus": "completed"
    }
  }
}
```

---

## 2. Build Credentials Setup

### iOS (Apple Push Notification service + App ID)

```bash
# Generate credentials via EAS
eas credentials --platform ios

# This will:
# 1. Create an App ID (com.toroloom.app)
# 2. Generate a distribution certificate
# 3. Generate a push notification certificate
# 4. Generate a provisioning profile
```

### Android (App Signing + Upload Key)

```bash
# Generate credentials via EAS
eas credentials --platform android

# This will:
# 1. Create a Google Play App Signing key
# 2. Generate an upload keystore
```

---

## 2. Firebase Setup

> Required for: Push notifications, Analytics, Crashlytics

### iOS
1. Go to [Firebase Console](https://console.firebase.google.com) → Project → iOS app
2. Bundle ID: `com.toroloom.app` 
3. Download `GoogleService-Info.plist`
4. Place in project root (already in `.gitignore`)

### Android
1. Firebase Console → Android app
2. Package: `com.toroloom.app`
3. Download `google-services.json` (already exists at root)
4. SHA-1 fingerprint: Get from EAS or keystore

---

## 3. Versioning

Update these before each build:

**`app.json`** — manual version bump:
```json
{
  "expo": {
    "version": "1.0.0",           // Semantic version
    "ios": { "buildNumber": "1" }, // Increment per iOS build
    "android": { "versionCode": 1 } // Increment per Android build
  }
}
```

**Or via EAS CLI:**
```bash
eas build:version:set
```

---

## 4. Production Build

### iOS (App Store)

```bash
# Build for the App Store
eas build --platform ios --profile production --wait

# This creates an .ipa file signed for App Store distribution
```

### Android (Google Play)

```bash
# Build Android App Bundle (AAB) for Play Store
eas build --platform android --profile production --wait

# This creates an .aab file signed for Play Store distribution
```

---

## 5. App Store Connect Configuration

### Before submitting, configure in App Store Connect:

1. **App Information**
   - Name: Toroloom: AI Trading
   - Primary Language: English (India)
   - Bundle ID: com.toroloom.app
   - SKU: TOROLOOM_001

2. **Pricing**
   - Free with in-app purchases (Razorpay)
   - Price tiers: Free, Pro (₹999/mo), Elite (₹2499/mo)

3. **In-App Purchases**
   - Create as non-consumable subscriptions
   - Product IDs:
     - `com.toroloom.pro.monthly`
     - `com.toroloom.elite.monthly`
     - `com.toroloom.pro.yearly`
     - `com.toroloom.elite.yearly`

4. **App Privacy**
   - [ ] Data Used to Track You: Identifiers
   - [ ] Data Linked to You: Contact Info, Financial Info, Identifiers, Usage Data
   - [ ] Privacy Policy URL: https://toroloom.com/privacy-policy

---

## 6. Google Play Console Configuration

1. **Store Listing**
   - Copy from `store/android/listing.txt`

2. **App Content**
   - [ ] Ads: No
   - [ ] Rating questionnaire: Complete (Finance app)
   - [ ] Target audience: Everyone
   - [ ] News: No

3. **Pricing & Distribution**
   - Free
   - Countries: India (primary), Global
   - In-app products: Configure subscriptions

---

## 7. Submit to Stores

### iOS (via EAS Submit)

```bash
# Submit to App Store Connect
eas submit --platform ios --profile production

# This uploads the .ipa and submits for review
```

Then in App Store Connect:
1. Go to the build → fill in "Review Information"
2. Add demo account credentials
3. Submit for review (typically 1-3 days)

### Android (via EAS Submit)

```bash
# Submit to Google Play Console
eas submit --platform android --profile production
```

Then in Google Play Console:
1. Go to "Release" → "Production"
2. Review the release
3. Roll out (typically 1-24 hours review)

---

## 7.1 Automated Screenshot Capture

Use the Maestro E2E pipeline to automatically capture all App Store and
Google Play screenshots:

```bash
# 1. Start your Android emulator or iOS simulator
# 2. Start the Expo dev server
npx expo start --android

# 3. Run the automated screenshot pipeline
./scripts/capture-screenshots.sh

# 4. Find your screenshots in:
#    - store/screenshots/raw/        (original uncropped)
#    - store/screenshots/ios/        (resized for App Store)
#    - store/screenshots/android/    (resized for Play Store)
```

### What gets captured

The Maestro flow navigates through all key screens and captures 14 screenshots:

| # | Screen | Shows |
|---|--------|-------|
| 1 | Login | Authentication UI |
| 2 | Home | Portfolio summary + quick actions |
| 3 | Markets | Indices + stock list |
| 4 | Stock Detail | Chart, stats, AI analysis |
| 5 | Portfolio | Holdings, P&L, returns |
| 6 | Watchlist | Favorites tracking |
| 7 | More Menu | Full feature hub |
| 8 | Options Chain | F&O with Greeks |
| 9 | Strategy Builder | Multi-leg P&L chart |
| 10 | AI Insights | Market analysis + stock scores |
| 11 | KYC | Verification flow |
| 12 | Subscription | Pricing tiers |
| 13 | Learning Hub | Course catalog |
| 14 | SIP Calculator | Investment planning |

### Multi-Language Screenshots

For localized store listings, change the emulator locale before capturing:

```bash
# Hindi
adb shell setprop persist.sys.locale hi-IN
./scripts/capture-screenshots.sh

# Back to English
adb shell setprop persist.sys.locale en-US
./scripts/capture-screenshots.sh
```

### Manual Screenshot Studio

For one-off screenshots or fine-tuned captures:

```bash
maestro studio
# Use the `takeScreenshot` command interactively
```

### Screenshot Requirements (2026)

| Store | Device | Resolution | Format |
|-------|--------|-----------|-------|
| App Store | iPhone 6.7" (Pro Max) | 1290 × 2796 px | PNG/JPG |
| App Store | iPhone 6.5" (Plus) | 1284 × 2778 px | PNG/JPG |
| App Store | iPhone 5.5" | 1242 × 2208 px | PNG/JPG |
| App Store | iPad 13" | 2064 × 2752 px | PNG/JPG |
| Play Store | Phone (portrait) | 1080 × 1920 px (9:16) | PNG/JPG |
| Play Store | Phone (landscape) | 1920 × 1080 px (16:9) | PNG/JPG |

After capturing, use **Figma** or **AppScreens** to wrap raw screenshots in
device frames before uploading to App Store Connect.

---

## 8. Post-Submission Checklist

- [ ] Monitor App Store Review status
- [ ] Monitor Google Play Review status
- [ ] Test production API endpoint
- [ ] Verify deep links work (toroloom://)
- [ ] Verify push notifications work
- [ ] Verify Razorpay payments work
- [ ] Check Sentry for production errors
- [ ] Announce on social media

---

## 9. Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| ITMS-90078: Missing push notification entitlement | APNs cert not uploaded | `eas credentials --platform ios` |
| Google Play: App not compliant with target API level | Need API 34+ | Expo SDK 56 already targets API 34 ✅ |
| App rejected: Incomplete review info | Missing demo account | Add test@toroloom.com / password123 as reviewer account |
| App rejected: Required 2.1 (Crash) | Test on real devices | Run `npx expo run:ios --device` before submitting |
| Google Play: "Your app has an issue with ads ID" | Exoplayer/Admob SDK | Already excluded in package.json `expo.doctor.exclude` ✅ |

---

## 10. Environment URLs

| Environment | URL |
|-------------|-----|
| Production API | `https://toroloom-backend.onrender.com/api` |
| Railway Dashboard | [railway.app](https://railway.app/dashboard) |
| EAS Build Dashboard | [expo.dev](https://expo.dev) |
| Sentry Dashboard | [sentry.io](https://sentry.io) |
| Firebase Console | [firebase.google.com](https://console.firebase.google.com) |
| App Store Connect | [appstoreconnect.apple.com](https://appstoreconnect.apple.com) |
| Google Play Console | [play.google.com/console](https://play.google.com/console) |
