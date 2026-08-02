# Toroloom — Google Play Data Safety Form (Fill-in-Ready Answers)

This document is the **copy-paste source** for the Google Play Console
**Data safety** form (App content → Data safety). Every answer below is based
on what Toroloom actually collects, per the codebase:

- `app.json` plugins: `@react-native-firebase/analytics`, `@sentry/react-native`,
  `expo-notifications`, `expo-local-authentication`, `expo-sharing`, custom widgets
- Backend services: auth (email/phone), KYC (PAN/Aadhaar upload), broker link,
  payments (Razorpay/UPI), portfolio/orders, Telegram alerts, notifications

---

## SECTION 1 — Data types collected

### ✅ Answer YES to all of these (Toroloom collects them)

| Category | Data type | Purpose | Processed? | Required? |
|---|---|---|---|---|
| Personal info | **Name** | Account creation, profile | Yes | Yes |
| Personal info | **Email address** | Login, receipts, alerts | Yes | Yes |
| Personal info | **Phone number** | Login OTP, 2FA, Telegram link | Yes | Yes |
| Personal info | **Physical address** (optional, KYC/bank) | KYC verification | Yes | No |
| Financial info | **Purchase history** | Subscription billing (Razorpay) | Yes | Yes |
| Financial info | **Bank account / card number** (KYC + funds) | Withdrawals, broker linking | Yes | Yes |
| Financial info | **Credit/debit card info** | Razorpay payments (PCI-DSS via Razorpay) | Yes | Yes |
| Financial info | **Other financial info** (portfolio value, trades, P&L) | Core product | Yes | Yes |
| Documents | **Government IDs (PAN, Aadhaar)** | KYC compliance | Yes | Yes |
| Photos | **Photos** (KYC doc scans via upload) | KYC verification | Yes | Yes |
| App activity | **In-app search history** | Feature search | Yes | No |
| App activity | **Installed apps** (only via widget picker, on-device) | Home-screen widget | No (device only) | No |
| App activity | **Other user-generated content** (community posts, polls, journal) | Social features | Yes | No |
| App activity | **Other actions** (watchlist, alerts, strategy config) | Core product | Yes | Yes |
| Diagnostics | **Crash logs** | Sentry crash reporting | Yes | Yes |
| Diagnostics | **Performance data** | Sentry performance | Yes | Yes |
| Device IDs | **Device or other IDs** | Firebase Analytics, push token | Yes | Yes |

### ❌ Answer NO to these (Toroloom does NOT collect)
- Exact location (GPS) — not used
- Emails or text messages — not read
- Voice recordings — not used
- Contacts — not accessed
- Calendar — not accessed
- Health & fitness — not used
- Web browsing history — not used

---

## SECTION 2 — Is data encrypted in transit?

✅ **YES** — All traffic is HTTPS/WSS (Railway TLS + app enforced). Passwords hashed (bcrypt),
tokens signed (JWT), payments handled by Razorpay PCI-DSS.

## SECTION 3 — Can users request data deletion?

✅ **YES** — Users can delete their account (Profile → Delete account); the deletion
request removes stored personal data. Data is retained only as long as legally
required (financial records).

## SECTION 4 — Is data shared with third parties?

| Partner | Data shared | Purpose |
|---|---|---|
| **Razorpay** | Name, email, payment details | Payment processing |
| **Broker partners** (Zerodha/Angel/Groww via user link) | Orders, holdings | Broker integration |
| **Firebase (Google)** | Analytics events, device IDs | Analytics |
| **Sentry** | Crash logs, device info | Crash reporting |
| **Telegram** (opt-in) | User ID + alert messages | Telegram alerts |

*Toroloom does NOT sell personal data.*

---

## SECTION 5 — Play Console quick copy (fill these boxes)

- **Data safety declaration:** ✅ Yes, this app collects and shares data
- **Data collection:** All items from Section 1 marked YES
- **Security practices:** ✅ Encrypted in transit, ✅ Users can request deletion
- **Data deletion policy URL:** Use `https://toroloom-production.up.railway.app/privacy`
  (includes deletion section)
- **Privacy policy URL:** `https://toroloom-production.up.railway.app/privacy`
- **Terms of service URL:** `https://toroloom-production.up.railway.app/terms`

---

## SECTION 6 — Live URLs (after deploy)

| Resource | URL |
|---|---|
| Privacy policy | `https://toroloom-production.up.railway.app/privacy` |
| Terms of service | `https://toroloom-production.up.railway.app/terms` |
| Legal hub | `https://toroloom-production.up.railway.app/legal` |
| Data deletion | Via Privacy policy section + in-app account deletion |

> These are served by the backend (`backend/public/privacy-policy.html` etc.),
> shipped by the Dockerfile, so they are live HTTPS URLs the Play Console accepts.
