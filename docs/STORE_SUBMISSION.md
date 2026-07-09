# 🏪 Toroloom — App Store & Play Store Submission Guide

> **Buyer ke liye:** Yeh guide batati hai ki kaise Toroloom app ko Apple App Store aur Google Play Store par submit karna hai.

---

## 📋 Prerequisites

| Cheez | Kaise milegi |
|-------|-------------|
| **Apple Developer Program** ($99/yr) | [developer.apple.com](https://developer.apple.com) — join karo |
| **Google Play Developer** ($25 one-time) | [play.google.com/console](https://play.google.com/console) — register karo |
| **EAS CLI** | Terminal mein: `npm install -g eas-cli` |
| **Toroloom backend deployed** | Pehle backend deploy karo (dekho [`DEPLOY.md`](./DEPLOY.md)) |

---

# 🍎 iOS — App Store Submission

## Step 1: Apple Developer Account Setup

1. [developer.apple.com](https://developer.apple.com) → **Enroll** → $99/year
2. Enrollment ke baad **Team ID** copy karo:
   - developer.apple.com → **Membership** → **Team ID** (10 characters, e.g. `AB12CD3EF4`)

## Step 2: App Store Connect mein App Register karo

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps** → **+** → **New App**
2. Platform: **iOS**, Name: **Toroloom**, Language: **English**
3. Bundle ID: `com.toroloom.app` (yeh already `app.json` mein set hai)
4. SKU: `toroloom-1.0.0` (kuch bhi daal sakte ho)

## Step 3: App Store Connect se ascAppId lo

App Store Connect → App → **App Information** → **Apple ID** ke aage jo number hai — woh **ascAppId** hai.

## Step 4: eas.json mein Values Fill Karo

Apni teen values `eas.json` mein daalo:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your@email.com",
      "ascAppId": "1234567890",
      "appleTeamId": "AB12CD3EF4"
    }
  }
}
```

## Step 5: EAS Build + Submit

```bash
# Production build banao
eas build --platform ios --profile production

# Build ready hone par submit karo
eas submit --platform ios --profile production
```

> **Pehli baar:** EAS build ke liye Apple credentials dene honge (App Store Connect API key ya Apple ID + password).

---

# 🤖 Android — Google Play Submission

## Step 1: Google Play Console Setup

1. [play.google.com/console](https://play.google.com/console) → **Create account** → $25
2. **Create app** → Name: **Toroloom**, Default language: Hindi/English

## Step 2: App Signing

Pehli baar jab `eas build` karo, EAS apne aap Google Play App Signing set up karega.

```bash
# Production build (AAB format)
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android --profile production
```

## Step 3: Store Listing Fill Karo

Play Console → **Store presence** → **Main store listing**

Content already ready hai `store/ios/listing.txt` mein. Waha se copy karo (Android ke liye bhi wahi content use karo — bas screenshots alag hain).

## Step 4: Screenshots

Play Console ko 2-8 screenshots chahiye:

```bash
# Emulator se screenshots capture karo
./scripts/capture-screenshots.sh

# Output: store/screenshots/android/ folder mein
```

Upload karo: Play Console → **Store presence** → **Main store listing** → **Screenshots**

---

# 📸 Screenshots (Both Stores)

Automated script use karo:

```bash
# 1. Android emulator chalao
# 2. Expo dev server chalao
npx expo start --android

# 3. Screenshots capture karo
./scripts/capture-screenshots.sh
```

Screenshots stored in: `store/screenshots/`

| Device | Purpose | Resolution |
|--------|---------|------------|
| iPhone 6.7" | App Store primary | 1290 × 2796 px |
| Android Phone | Play Store | 1080 × 1920 px |

---

# 📋 App Store Metadata (Already Ready)

| Item | File | Status |
|------|------|--------|
| iOS Description | `store/ios/listing.txt` | ✅ |
| Privacy Policy | `docs/privacy-policy.html` | ✅ |
| Terms of Service | `docs/terms-of-service.html` | ✅ |
| App Icons | `assets/icon.png` + Android adaptive | ✅ |
| Deep Links | `toroloom://` + `https://toroloom.com` | ✅ |

---

# ⚠️ Common Issues

| Problem | Solution |
|---------|----------|
| EAS build fail — credentials missing | `eas credentials` command chalao ya Apple ID/password do |
| App rejected — `usesNonExemptEncryption` | Already `false` set hai `app.json` mein ✅ |
| App rejected — missing privacy policy | Already hosted at `docs/privacy-policy.html` ✅ |
| iOS build signing fail | Xcode install karo, ya EAS Build — yeh auto-manage karta hai |
| Play Store — App Bundle required | Production build already `.aab` format banata hai ✅ |

---

> 💡 **Tip:** Pehle internal testing karo (TestFlight ya Play Console Internal Track) — public launch se pehle bugs catch ho jayenge.
>
> **EAS Submit ka ek hi command:**
> ```bash
> eas submit --platform all --profile production
> ```
