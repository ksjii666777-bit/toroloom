# 🍎 Toroloom — Apple Developer Configuration

> **File created:** July 2026
> **Purpose:** Fill these values when Apple Developer account is ready. Then update `eas.json` with these values.

---

## 1. Apple Developer Account

| Item | Status | Value |
|------|--------|-------|
| Apple Developer Program ($99/yr) | ⬜ Not yet | [Enroll here](https://developer.apple.com/programs/enroll/) |
| Apple ID Email | ⬜ Fill later | `____________________@____.___` |

---

## 2. `eas.json` — Submit Configuration

Copy these values into `eas.json` under `submit.production.ios`:

### `appleId` (Your Apple ID email)
```
Value: _______________________________
From: Your Apple ID login email
```

### `ascAppId` (App Store Connect App ID — numeric)
```
Value: _______________________________
From: App Store Connect → Your App → App Information → Apple ID
```

### `appleTeamId` (Developer Team ID — 10 chars)
```
Value: _______________________________
From: developer.apple.com → Membership → Team ID
```

### ✅ After filling, `eas.json` should look like:
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

## 3. App Store Connect — App Registration

| Field | Value |
|-------|-------|
| App Name | Toroloom: AI Trading |
| Platform | iOS |
| Primary Language | English (India) |
| Bundle ID | `com.toroloom.app` |
| SKU | `TOROLOOM_001` |
| Price | Free (with in-app purchases) |

### In-App Purchase Product IDs
```
com.toroloom.pro.monthly
com.toroloom.elite.monthly
com.toroloom.pro.yearly
com.toroloom.elite.yearly
```

---

## 4. Firebase — iOS Setup

| Item | Status | Notes |
|------|--------|-------|
| GoogleService-Info.plist | ⬜ Download | From Firebase Console → iOS app → Download plist |
| Bundle ID | `com.toroloom.app` | Already configured |
| File location | Project root | Already in `.gitignore` |

---

## 5. EAS Credentials (Run Once)

```bash
# Generate Apple Push Notification certificate + provisioning profile
eas credentials --platform ios
```

---

## 6. iOS Build & Submit Commands

```bash
# Step 1: Production build
eas build --platform ios --profile production --wait

# Step 2: Submit to App Store Connect
eas submit --platform ios --profile production
```

---

## 7. Common Apple Rejection Fixes

| Issue | Fix |
|-------|-----|
| ITMS-90078: Missing push entitlement | Run `eas credentials --platform ios` |
| Missing demo account | Add `test@toroloom.com` / `password123` in Review Information |
| Incomplete privacy details | Fill in App Store Connect → App Privacy |
| Crash on launch | Test on real device: `npx expo run:ios --device` |

---

> 📖 Full submission guide: [`STORE_SUBMISSION.md`](./STORE_SUBMISSION.md)
