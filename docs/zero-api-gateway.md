# Zero-API WebView Gateway — Connect Any Broker Without Official APIs

> **TL;DR:** Toroloom's gateway lets you connect **any stock broker's web dashboard** to the app — even if the broker has no official API. A hidden WebView extracts the session after you log in, and the app proxies requests through that session. No API keys, no SDKs, no integration delays.

---

## Table of Contents

1. [The Problem: APIs Are a Bottleneck](#1-the-problem-apis-are-a-bottleneck)
2. [The Solution: Zero-API Hybrid Gateway](#2-the-solution-zero-api-hybrid-gateway)
3. [Architecture Overview](#3-architecture-overview)
4. [Component Deep Dives](#4-component-deep-dives)
   - [SecureSessionSync — WebView Session Extraction](#41-securesessionsync--webview-session-extraction)
   - [sessionStorage — Keychain Pipeline](#42-sessionstorage--keychain-pipeline)
   - [proxyClient — Headless Proxy](#43-proxyclient--headless-proxy)
   - [ConnectBrokerView — User Interface](#44-connectbrokerview--user-interface)
5. [How to Add a New Broker (No API Required)](#5-how-to-add-a-new-broker-no-api-required)
6. [Security Model](#6-security-model)
7. [E2E Testing with Mock Sessions](#7-e2e-testing-with-mock-sessions)
8. [Limitations & Considerations](#8-limitations--considerations)

---

## 1. The Problem: APIs Are a Bottleneck

Worldwide, there are **hundreds of stock broker platforms** — Zerodha, Angel One, Groww, Robinhood, Degiro, Trading 212, Hargreaves Lansdown, CommSec, and countless more. Of these:

- **~10%** have official, well-documented REST APIs (like Interactive Brokers, Alpaca, Zerodha Kite)
- **~20%** have unofficial/private internal APIs (discoverable via web dashboard traffic inspection)
- **~70%** have **no public API at all** — you can only use their web or mobile app

Building an official broker integration for each one is impossible at scale. Each requires:
- An SDK or API wrapper in your language
- OAuth/API key management
- Rate limiting, error handling, data mapping
- Ongoing maintenance as APIs change

The Zero-API approach solves this **at the session level** rather than the API level.

---

## 2. The Solution: Zero-API Hybrid Gateway

The core insight: **Every broker with a web dashboard already has a complete API** — it's the one their own frontend uses. We just need to:

1. Let the user log in normally through their broker's web dashboard
2. **Extract the session tokens** (cookies, localStorage, JWT) after login completes
3. **Proxy our API calls** through that session, mimicking a browser

This works for **any broker** that has a web-based login flow — no SDKs, no API keys, no approval process.

### When to use which path:

| Condition | Path |
|---|---|
| Broker has an official API (IBKR, Alpaca) | **API Plugin** — `IBroker` interface, registered via BrokerRegistry |
| Broker has a web dashboard (Robinhood, Degiro) | **Zero-API Gateway** — WebView session extraction + proxy |
| Broker supports OAuth (Zerodha) | **Hybrid** — Extract session after OAuth redirect |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Toroloom App                                 │
│                                                                      │
│  ┌─────────────────────────────┐    ┌────────────────────────────┐  │
│  │   ConnectBrokerView.tsx      │    │    ProxyClient.ts          │  │
│  │   (User selects broker)      │    │    (Authenticated proxy)   │  │
│  └──────────┬──────────────────┘    └────────▲───────────────────┘  │
│             │                               │                        │
│  ┌──────────▼──────────────────┐    ┌────────┴───────────────────┐  │
│  │   SecureSessionSync.tsx      │    │    SessionStorage.ts       │  │
│  │   (WebView → extract tokens) │    │    (iOS Keychain /         │  │
│  └──────────┬──────────────────┘    │     Android Keystore)      │  │
│             │                       └────────────────────────────┘  │
│    ┌────────▼────────┐                                                  │
│    │  WebView         │    Extracts: cookies, localStorage,              │
│    │  (Embedded       │    sessionStorage, JWT, enctoken,                │
│    │   browser)       │    access_token, user_id                         │
│    └────────┬────────┘                                                  │
│             │                                                           │
└─────────────┼───────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Broker Web Dashboard       │
│  (e.g., kite.zerodha.com,   │
│   groww.in, etrade.com)     │  ← User logs in normally
└─────────────────────────────┘       (email + password + MFA)
              │
              ▼
┌─────────────────────────────┐
│  Broker Internal REST API   │
│  (Private endpoints)        │  ← Proxied requests with session cookies
└─────────────────────────────┘
```

### Data Flow

```
Step 1: User taps "Connect Broker" on a broker card
         │
Step 2: Embedded WebView opens the broker's login URL
         │
Step 3: User logs in normally (email, password, MFA/TOTP)
         │
Step 4: WebView detects dashboard URL (login success)
         │
Step 5: Injected JavaScript extracts:
           ├── document.cookie
           ├── window.localStorage (all keys)
           └── window.sessionStorage (all keys)
         │
Step 6: Payload sent via postMessage to React Native
         │
Step 7: parseSessionPayload() scans for known tokens:
           ├── enctoken, jwt, access_token
           ├── public_token, refresh_token
           └── user_id, client_id
         │
Step 8: BrokerSession encrypted in iOS Keychain /
        Android Keystore via react-native-keychain
         │
Step 9: When app needs holdings/orders/positions:
           ├── proxyClient reads session from keychain
           ├── Builds browser-mimicking headers
           ├── Sends authenticated request to broker's
           │   private API endpoint
           └── Returns structured data to the app
```

---

## 4. Component Deep Dives

### 4.1 SecureSessionSync — WebView Session Extraction

**File:** `src/components/gateway/SecureSessionSync.tsx`

A wrapper around `react-native-webview` that opens the broker's login page and silently extracts session data after successful authentication.

#### Key Features

- **Navigation-based detection:** Monitors URL changes to detect when the user reaches their broker dashboard (login success) or encounters an MFA/OTP challenge
- **Dashboard URL patterns:** Default patterns for known brokers (`kite.zerodha.com/`, `groww.in/dashboard`, etc.) — extensible via props
- **Auth token detection:** Scans URL for `request_token=`, `access_token=`, `enctoken=`, `jwt=`, etc.
- **Session extraction script:** Injected JavaScript that reads `document.cookie`, `localStorage`, and `sessionStorage` — runs after a 1.5s delay to ensure cookies are settled

#### Props

| Prop | Type | Description |
|---|---|---|
| `sourceUrl` | `string` | Broker login URL to load in WebView |
| `brokerType` | `string` | Identifier for the session (e.g., `'zerodha'`) |
| `onSessionCaptured` | `(payload: SessionPayload) => void` | Called with extracted session data |
| `onError` | `(error: string) => void` | Called on extraction failure |
| `mfaDetectionPatterns?` | `string[]` | Custom MFA URL patterns |
| `dashboardUrlPatterns?` | `string[]` | Custom dashboard URL patterns |

#### Session Extraction Script

The injected JavaScript executes inside the WebView context:

```javascript
(function() {
  var payload = {
    cookies: document.cookie || '',
    localStorage: {},
    sessionStorage: {},
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  // Safely extracts all localStorage keys
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    payload.localStorage[key] = localStorage.getItem(key) || '';
  }

  // Safely extracts all sessionStorage keys
  for (var j = 0; j < sessionStorage.length; j++) {
    var sk = sessionStorage.key(j);
    payload.sessionStorage[sk] = sessionStorage.getItem(sk) || '';
  }

  // Posts back to React Native via WebView bridge
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'SESSION_PAYLOAD',
    data: payload,
  }));
})();
```

---

### 4.2 sessionStorage — Keychain Pipeline

**File:** `src/services/gateway/sessionStorage.ts`

Hardware-backed encrypted storage for broker session credentials using `react-native-keychain`. Stores data inside **iOS Keychain** / **Android Keystore** under the service identifier `toroloom_secure_auth_vault`.

#### Key Functions

| Function | Description |
|---|---|
| `storeBrokerSession(brokerType, session)` | Encrypt and store a session in device keychain |
| `getBrokerSession(brokerType)` | Retrieve a stored session (returns `BrokerSession \| null`) |
| `hasValidSession(brokerType)` | Check if a session exists and hasn't expired |
| `clearBrokerSession(brokerType)` | Delete a session from keychain |
| `parseSessionPayload(payload)` | Extract structured `BrokerSession` from raw `SessionPayload` |
| `listStoredSessions()` | List broker types with active sessions |

#### Token Extraction Strategy

`parseSessionPayload()` scans cookies and web storage for known token patterns:

| Token | Cookie | localStorage/sessionStorage |
|---|---|---|
| `enctoken` | `enctoken` | `enctoken` |
| `jwt` | `jwt`, `JWT` | `jwt`, `access_jwt` |
| `accessToken` | `access_token`, `public_token` | `access_token`, `public_token` |
| `userId` | `user_id`, `client_id`, `userId` | `user_id`, `clientId`, `client_id` |
| `refreshToken` | `refresh_token` | `refresh_token` |

Each new broker type can add its own token extraction rules here.

#### Security Configuration

```typescript
await Keychain.setGenericPassword(key, json, {
  service: KEYCHAIN_SERVICE,                              // 'toroloom_secure_auth_vault'
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});
```

- **Access control:** Biometry (Face ID / fingerprint) OR device passcode required
- **Accessibility:** Only accessible when device is unlocked, never backed up to iCloud/Google Drive
- **Service isolation:** All broker sessions share one service entry for atomic management

---

### 4.3 proxyClient — Headless Proxy

**File:** `src/services/gateway/proxyClient.ts`

When the app needs order books, live positions, holdings, or margin data, `proxyClient` intercepts the request, appends the stored session credentials to headers, and mirrors a standard web-browser request to the broker's private production endpoints.

#### Broker Endpoint Registry

```typescript
const BROKER_ENDPOINTS = {
  zerodha: 'https://kite.zerodha.com',
  angel:   'https://smartapi.angelbroking.com',
  groww:   'https://api.groww.in',
};

const BROKER_USER_AGENTS = {
  zerodha: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) ...',
  angel:   'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) ...',
  groww:   'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) ...',
};
```

#### Auth Header Builders

Each broker has a different auth mechanism. The `buildAuthHeaders()` function handles them:

```typescript
// Zerodha: Uses enctoken
headers['Authorization'] = `enctoken ${session.enctoken}`;
headers['X-Kite-Version'] = '3';

// Angel One: Uses JWT + private key + client code
headers['Authorization'] = `Bearer ${session.jwt}`;
headers['X-PrivateKey'] = session.accessToken;
headers['X-ClientCode'] = session.userId;

// Groww: Uses access token
headers['Authorization'] = `Bearer ${session.accessToken}`;

// All brokers: Attach raw cookies as fallback
headers['Cookie'] = session.cookies;
```

#### API Functions

| Function | Description |
|---|---|
| `proxyRequest(brokerType, endpoint, opts)` | Core proxy — authenticated request with timeout |
| `getBrokerHoldings(brokerType)` | Fetch portfolio holdings |
| `getBrokerPositions(brokerType)` | Fetch open positions |
| `getBrokerOrderBook(brokerType)` | Fetch orders |
| `getBrokerTradeBook(brokerType)` | Fetch executed trades |
| `getBrokerMargin(brokerType)` | Fetch margin/funds summary |

#### Timeout & Error Handling

- Default timeout: **15 seconds** (configurable via `opts.timeout`)
- Uses `AbortController` for clean timeout abort
- Returns structured `ProxyResponse<T>` with `success`, `data`, `error`, and `statusCode`
- Returns `statusCode: 408` with a descriptive message on timeout

---

### 4.4 ConnectBrokerView — User Interface

**File:** `src/screens/broker/ConnectBrokerView.tsx`

The premium broker connection screen that guides users through:
1. Selecting a broker from a card grid
2. Opening the WebView gateway (preferred) or entering credentials manually
3. Testing the proxy connection after successful authentication

Features:
- **Status pills:** "Zero-API Sync", "100% FREE", "ENCRYPTED"
- **Connected banner:** Shows active session info with "Test API" and "Disconnect" buttons
- **Success overlay:** Animated checkmark confirmation
- **Haptic feedback:** Impact feedback on connect/disconnect
- **Edge case handling:** Loading states, error alerts, session expiry checking on mount

---

## 5. How to Add a New Broker (No API Required)

This is the core promise — adding a broker that has **no official API**. You only need:

### Step 1: Find the Broker's Login URL

```typescript
const LOGIN_URLS = {
  zerodha:   'https://kite.zerodha.com/',
  angel:     'https://smartapi.angelbroking.com/',
  groww:     'https://groww.in/login',
  // NEW: Add your broker's login URL here
  robinhood: 'https://robinhood.com/login',
};
```

### Step 2: Add Dashboard URL Patterns

In `SecureSessionSync.tsx`, add URL fragments that indicate a successful login:

```typescript
const dashPatterns = [
  'kite.zerodha.com/',
  'smartapi.angelbroking.com/',
  'groww.in/dashboard',
  // NEW: URL patterns that appear after login
  'robinhood.com/account',
  'robinhood.com/portfolio',
];
```

### Step 3: Add MFA/OTP Detection Patterns (if needed)

```typescript
const mfaPatterns = [
  'totp', 'mfa', 'otp', 'two-factor', '2fa',
  'verify', 'authenticate', 'security',
  // NEW: Your broker's MFA URL patterns
  'robinhood.com/verify',
];
```

### Step 4: Add Token Extraction Rules

In `sessionStorage.ts`'s `parseSessionPayload()`, map the broker's token names:

```typescript
// After existing extractions, add your broker's tokens:
if (payload.cookies) {
  // Robinhood uses 'token' cookie with 'robertic' prefix
  const token = extractCookie(cookies, 'token') || undefined;
  const authToken = extractCookie(cookies, 'auth_token') || undefined;
  // Add to the returned BrokerSession
}
```

### Step 5: Add Endpoint Registry & Auth Headers

In `proxyClient.ts`:

```typescript
// Add to BROKER_ENDPOINTS
const BROKER_ENDPOINTS = {
  // ...existing...
  robinhood: 'https://api.robinhood.com',
};

// Add to BROKER_USER_AGENTS
const BROKER_USER_AGENTS = {
  // ...existing...
  robinhood: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) ...',
};

// Add auth header builder in buildAuthHeaders()
if (session.brokerType === 'robinhood' && session.accessToken) {
  headers['Authorization'] = `Bearer ${session.accessToken}`;
}
```

### Step 6: Add Convenience Endpoints (required for full support)

You must update **all** convenience functions in `proxyClient.ts` — each has its own endpoint map:

- `getBrokerHoldings()` — portfolio holdings
- `getBrokerPositions()` — open positions
- `getBrokerOrderBook()` — orders
- `getBrokerTradeBook()` — executed trades
- `getBrokerMargin()` — margin/funds

```typescript
// Add to EVERY convenience function:
const endpoints = {
  // ...existing...
  robinhood: '/holdings/',
};
```

### Step 7: Add Manual Credentials Support (fallback)

In `ConnectBrokerView.tsx`, the `handleConnect()` function has a hardcoded if/else chain that maps credentials to session tokens per broker type. Add your broker here so the manual credentials fallback works:

```typescript
if (selectedBroker.type === 'zerodha') {
  brokerSession.enctoken = credentials.apiKey;
  brokerSession.accessToken = credentials.apiSecret;
} else if (selectedBroker.type === 'angel') {
  brokerSession.jwt = credentials.apiKey;
  brokerSession.accessToken = credentials.apiKey;
  brokerSession.userId = credentials.clientId;
} else if (selectedBroker.type === 'groww') {
  brokerSession.accessToken = credentials.accessToken || credentials.apiKey;
} else if (selectedBroker.type === 'robinhood') {
  brokerSession.accessToken = credentials.apiKey;
  brokerSession.userId = credentials.clientId;
}
```

### Step 8: Add Broker Card to UI

In `ConnectBrokerView.tsx`:

```typescript
const BROKERS: BrokerMeta[] = [
  // ...existing...
  {
    type: 'robinhood',
    label: 'Robinhood',
    tagline: 'Commission-free US stock trading',
    icon: 'R',
    color: '#00C805',
    gradient: ['#00C805', '#009E04'] as const,
    hasOAuth: false,
    features: ['Commission-Free', 'US Stocks & ETFs', 'Crypto'],
  },
];
```

### Step 8: Update `listStoredSessions()`

**Important:** `listStoredSessions()` in `sessionStorage.ts` has a hardcoded broker list that must be extended:

```typescript
const knownBrokers = ['angel', 'zerodha', 'groww', 'robinhood']; // Add yours
```

Without this, the session discovery feature won't detect your broker's stored sessions.

### Step 9: Discover Internal API Endpoints

The hardest part — finding the broker's internal API endpoints. Techniques:

1. **Browser DevTools (Network tab):**
   - Log into broker's web dashboard
   - Open DevTools → Network tab
   - Filter by `XHR` / `Fetch`
   - Note the API endpoints called for holdings, orders, etc.

2. **Reverse engineer the web app:**
   - Look at the JavaScript bundles for API base URLs
   - Search for patterns like `/api/`, `/v1/`, `/rest/`

3. **Common endpoint patterns:**
   - Holdings: `/portfolio/holdings`, `/accounts/holdings`
   - Orders: `/orders`, `/orderbook`
   - Positions: `/positions`, `/portfolio/positions`
   - Trades: `/trades`, `/tradebook`, `/executions`
   - Margin: `/margin`, `/funds`, `/account`

---

## 6. Security Model

### Data at Rest

| Layer | Mechanism |
|---|---|
| Device storage | iOS Keychain / Android Keystore (hardware-backed encryption) |
| Keychain service | `toroloom_secure_auth_vault` — isolated from other app data |
| Access control | Biometry (Face ID / Touch ID / fingerprint) OR device passcode |
| Accessibility | `WHEN_UNLOCKED_THIS_DEVICE_ONLY` — never backed up to cloud |

### Data in Transit

| Layer | Mechanism |
|---|---|
| Broker session extraction | WebView runs in-app — no network call, purely local JavaScript injection |
| Payload transmission | `ReactNativeWebView.postMessage()` — local bridge, never leaves device |
| Proxy requests | HTTPS to broker endpoints (standard TLS) |
| Session token | Never sent to Toroloom servers — stays on device |
| Raw cookies | Passed as `Cookie` header in proxy requests — sent over HTTPS only, never stored in plaintext |

### What We DON'T Do

- ❌ Store plaintext credentials (passwords, PINs)
- ❌ Send session tokens to Toroloom backend
- ❌ Cache session data in unencrypted storage
- ❌ Share sessions across devices

### Session Expiry

- Tokens with `max-age` or `expires` cookie attributes → use natural expiry
- Tokens without expiry → **assume valid for 24 hours** from capture time
- `hasValidSession()` checks both mechanisms
- User can manually disconnect to clear the session at any time

---

## 7. E2E Testing with Mock Sessions

Testing the gateway flow end-to-end requires actual broker credentials, which isn't practical in CI. Instead, we use **mock session seeding**.

### Seed Utility

**File:** `src/services/gateway/seedE2ESession.ts`

Provides factory functions that create realistic mock `BrokerSession` objects:

```typescript
import { seedE2EBrokerSession, seedAllBrokerSessions } from '../services/gateway/seedE2ESession';

// Seed a single broker (default: zerodha)
await seedE2EBrokerSession('zerodha');

// Seed all three at once
await seedAllBrokerSessions();
```

### Deep Link Trigger (Dev Only)

**File:** `App.tsx` (dev mode only)

```
toroloom://e2e/seed-broker
toroloom://e2e/seed-broker?broker=angel
toroloom://e2e/seed-broker?broker=all
```

In development builds, deep linking into the app with these URLs seeds mock sessions into the keychain, allowing Maestro E2E flows to verify the connected-state UI.

### Maestro Flow Example

```yaml
# .maestro/flows/broker/connectBroker.yaml
appId: com.anonymous.Toroloom
---
- openLink: toroloom://e2e/seed-broker
- tapOn: "Connect Broker"
- assertVisible: "Connected"
- assertVisible: "Zerodha"
- tapOn: "Test API"
- assertVisible: "Proxy Success"
```

### Mock Sessions

| Broker | Tokens Provided | Expiry |
|---|---|---|
| Zerodha | `enctoken`, `accessToken`, `publicToken`, `userId` | 24h from seed |
| Angel One | `jwt`, `accessToken`, `userId` | 24h from seed |
| Groww | `accessToken`, `userId` | 24h from seed |

---

## 8. Limitations & Considerations

### Rate Limiting

Broker web dashboards are not designed for programmatic access. Their internal APIs typically have **stricter rate limits** than official APIs. The proxy does not implement client-side rate limiting — be judicious with request frequency.

**Recommendation:** Cache responses aggressively. Poll holdings at most once per minute.

### Session Expiry

Broker sessions expire after:
- **24 hours** for most Indian brokers (Kite/Angel)
- **~2 hours** for US brokers like Robinhood
- **Varies** based on broker's cookie configuration

When `hasValidSession()` returns `false`, the user must re-authenticate via the WebView flow. There is **no background token refresh** — this is a conscious security decision.

### IP Geolocation

Some brokers restrict access based on IP address. If the user is connecting from a different country than their broker account, the login might trigger additional security checks or be blocked entirely.

### WebView Restrictions

- **Android 10+:** `localStorage` and `sessionStorage` may be partitioned per WebView, making cross-WebView persistence undetectable
- **iOS 14+:** `App Tracking Transparency` can affect cookie behavior
- **In-app browsers:** Some brokers detect WebView usage and block access — in these cases, the manual credentials fallback is used instead

### Terms of Service

Automating access through a broker's web dashboard may violate their Terms of Service. Users should:
1. Check their broker's ToS regarding automated access
2. Use this feature for **personal portfolio tracking and analysis** (read-heavy use)
3. NOT use it for high-frequency trading or placing large numbers of orders

---

## Appendix: File Reference

| File | Purpose |
|---|---|
| `src/components/gateway/SecureSessionSync.tsx` | WebView session extraction component |
| `src/services/gateway/sessionStorage.ts` | Encrypted keychain storage + token parsing |
| `src/services/gateway/proxyClient.ts` | Authenticated proxy to broker APIs |
| `src/services/gateway/seedE2ESession.ts` | Mock session seeding for E2E tests |
| `src/screens/broker/ConnectBrokerView.tsx` | User-facing broker connection screen |
| `src/types/index.ts` | `SessionPayload` & `BrokerSession` type definitions |
| `App.tsx` | Deep link handler for E2E session seeding |

---

## Appendix: Supported Broker Endpoints

| Broker | Holdings | Positions | Orders | Trades | Margin |
|---|---|---|---|---|---|
| Zerodha | `/oms/portfolio/holdings` | `/oms/portfolio/positions` | `/oms/orders` | `/oms/trades` | `/oms/user/margins` |
| Angel One | `/rest/secure/angelbroking/portfolio/v1/holdings` | `/rest/secure/angelbroking/portfolio/v1/positions` | `/rest/secure/angelbroking/order/v1/getorderbook` | `/rest/secure/angelbroking/order/v1/tradebook` | `/rest/secure/angelbroking/user/v1/getRMS` |
| Groww | `/pg/invest/v1/holdings` | `/pg/invest/v1/positions` | `/pg/invest/v1/orders` | `/pg/invest/v1/trades` | `/pg/invest/v1/margin` |
