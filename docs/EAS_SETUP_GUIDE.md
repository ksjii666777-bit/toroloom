# 🍎 Toroloom — EAS Setup Guide (Apple App Store Submission)

> **Kya hai:** `eas.json` mein Apple ke 3 placeholder values ko real values se
> replace karne ki step-by-step guide. Iske baad hi `eas submit` se app ko
> App Store par bheja ja sakta hai.
>
> **Companion docs:** [`APPLE_CONFIG.md`](./APPLE_CONFIG.md) (Apple Developer
> config) · [`STORE_SUBMISSION.md`](./STORE_SUBMISSION.md) (full submission guide)

---

## 📌 Current State — 3 Placeholders Baki Hain

`eas.json` → `submit.production.ios` abhi aisa hai:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "placeholder@example.com",   // ❌ bharna hai
      "ascAppId": "0000000000",               // ❌ bharna hai
      "appleTeamId": "XXXXXXXXXX"             // ❌ bharna hai
    },
    "android": {
      "track": "production",
      "releaseStatus": "completed"
    }
  }
}
```

> ✅ Android side ready hai. Sirf iOS ke 3 values bharni hain.

---

## 1️⃣ `appleId` — Apple ID Email

| | |
|---|---|
| **Abhi** | `placeholder@example.com` |
| **Kya bharna hai** | Aapka Apple Developer account ka login email |
| **Kahan se milega** | developer.apple.com par login karte waqt wahi email |

**Prerequisite:** Apple Developer Program membership ($99/yr).
Enroll: https://developer.apple.com/programs/enroll/

---

## 2️⃣ `ascAppId` — App Store Connect App ID (numeric, 10 digits)

| | |
|---|---|
| **Abhi** | `0000000000` |
| **Kya bharna hai** | App Store Connect mein app banane ke baad milne wala **numeric Apple ID** |
| **Kahan se milega** | App Store Connect → **My Apps → Toroloom → App Information → Apple ID** |

**Note:** Ye tabhi milega jab aapne pehle **App Store Connect mein app register**
kiya hoga (bundle ID `com.toroloom.app`, SKU `TOROLOOM_001`).

---

## 3️⃣ `appleTeamId` — Developer Team ID (10 characters)

| | |
|---|---|
| **Abhi** | `XXXXXXXXXX` |
| **Kya bharna hai** | Apple Developer account ka **Team ID** (10-char alphanumeric) |
| **Kahan se milega** | developer.apple.com → **Membership** page → **Team ID** field |
| **Example** | `A1B2C3D4E5` |

---

## ✅ Fill Karne Ke Baad (target state)

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

## 🧩 Inke Saath Bhi Chahiye (eas.json ke bahar)

| # | Item | Kahan se | Status |
|---|------|----------|--------|
| 1 | **EAS credentials** (`eas credentials --platform ios`) | EAS CLI se generate — push certificate + provisioning profile | ⬜ |
| 2 | **`GoogleService-Info.plist`** | Firebase Console → iOS app (bundle ID `com.toroloom.app`) → download, project root mein rakho | ⬜ |
| 3 | **App Store Connect mein app register** | App Store Connect → New App (naam: *Toroloom: AI Trading*, SKU: `TOROLOOM_001`, bundle: `com.toroloom.app`) | ⬜ |
| 4 | **Demo account** | Review Information mein `test@toroloom.com` / `password123` | ⬜ |
| 5 | **In-App Purchase products** | App Store Connect → In-App Purchases: `com.toroloom.pro.monthly`, `com.toroloom.elite.monthly`, `com.toroloom.pro.yearly`, `com.toroloom.elite.yearly` | ⬜ |

---

## 🚀 Build + Submit Commands

```bash
# 1. Production build (bundle + signing, ~15-20 min)
eas build --platform ios --profile production --wait

# 2. App Store Connect par submit
eas submit --platform ios --profile production
```

> **Pehli baar:** `eas submit` ke waqt Apple ID + app-specific password
> (App Store Connect → Sign-In & Security → App-Specific Password) mangta hai.

---

## 🛑 Common Apple Rejection Fixes

| Issue | Fix |
|-------|-----|
| `ITMS-90078: Missing push entitlement` | `eas credentials --platform ios` dobara run karo |
| `Missing demo account` | Review Information mein demo login add karo |
| `Incomplete privacy details` | App Store Connect → App Privacy fill karo (aapka `docs/privacy-policy.html` ready hai) |
| `Crash on launch` | Real device par test: `npx expo run:ios --device` |
| `Encryption compliance` | `usesNonExemptEncryption: false` already set hai — review ke liye exempt claim |

---

## 🗺️ Quick Checklist (Buyer ke liye)

```
[ ] Apple Developer Program enroll ($99/yr)
[ ] Apple Developer Account mein Team ID note karo → eas.json appleTeamId
[ ] App Store Connect mein "Toroloom" app register karo → ascAppId note karo
[ ] eas.json mein 3 values daalo
[ ] eas credentials --platform ios
[ ] GoogleService-Info.plist Firebase se download karke root mein rakho
[ ] eas build --platform ios --profile production --wait
[ ] eas submit --platform ios --profile production
[ ] Review Information mein demo account bharo
[ ] App Privacy fill karo
```

> ⏱️ **Total time:** Setup ~30-60 min · Build ~20 min · Apple Review 1-2 din

---

*Last updated: August 2026*
