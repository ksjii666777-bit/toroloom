$content = @'
# ═══════════════════════════════════════════════════════════════════════════
# Toroloom — Backend Environment Configuration
# ═══════════════════════════════════════════════════════════════════════════
#
# How to use:
#   1. Copy this file to .env:  copy .env.example .env
#   2. Fill in your actual credentials
#   3. Restart the server
#
# ═══════════════════════════════════════════════════════════════════════════

# ──── Server ──────────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ──── JWT (for user auth in the app) ──────────────────────────────────────
JWT_SECRET=change-this-to-a-long-random-secret-in-production
JWT_EXPIRES_IN=7d

# ──── Broker Configuration ────────────────────────────────────────────────
# Options: mock | angel | zerodha | groww
BROKER=angel

# ──── Data Source ─────────────────────────────────────────────────────────
# Options: mock | live
# 'mock' — Returns simulated data (no real API calls)
# 'live' — All data comes from the real broker API
DATA_SOURCE=live

# ──── Storage Backend ─────────────────────────────────────────────────────
# Options: memory | postgres | mongodb
STORAGE_BACKEND=memory
# DATABASE_URL=postgresql://user:password@localhost:5432/toroloom
# MONGODB_URI=mongodb://localhost:27017
# MONGODB_DB_NAME=toroloom

# ═══════════════════════════════════════════════════════════════════════════
# ANGEL ONE SMARTAPI — LIVE INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════
#
# Register at: https://smartapi.angelbroking.com/
# API Docs:    https://github.com/angel-one/smartapi-javascript

# ──── Required (for authentication) ──────────────────────────────────────

# Your Angel One trading account Client ID (e.g., A123456)
ANGEL_CLIENT_ID=

# API Key generated from the SmartAPI developer portal
ANGEL_API_KEY=

# Your Angel One trading account password
ANGEL_PASSWORD=

# ──── TOTP Secret (REQUIRED for 2FA) ──────────────────────────────────────
#
# This is a Base32-encoded secret key (e.g., JBSWY3DPEHPK3PXP).
# It is NOT a 6-digit code from Google Authenticator.
# It is the SECRET KEY that generates those 6-digit codes.
#
# How to get:
#   1. Go to https://smartapi.angelbroking.com/enable-totp
#   2. Log in with your Client ID and password
#   3. Copy the Base32 Secret Key shown on screen (NOT the QR code)
#
# The server will auto-generate the current 6-digit TOTP code from this
# secret using the speakeasy library on every login.
ANGEL_TOTP=

# ──── OPTIONAL: Pre-existing Access Token ──────────────────────────────────
# ANGEL_ACCESS_TOKEN=

# ──── OPTIONAL: REST Headers (for EDIS & Brokerage API) ────────────────────
# ANGEL_APP_ID=
# ANGEL_LOCAL_IP=127.0.0.1
# ANGEL_PUBLIC_IP=127.0.0.1
# ANGEL_MAC_ADDRESS=00:00:00:00:00:00

# ═══════════════════════════════════════════════════════════════════════════
# OTHER BROKERS (optional)
# ═══════════════════════════════════════════════════════════════════════════

# ──── Zerodha Kite Connect ──────────────────────────────────────────────
# ZERODHA_API_KEY=
# ZERODHA_API_SECRET=
# ZERODHA_ACCESS_TOKEN=
# ZERODHA_REQUEST_TOKEN=

# ──── Groww Trade API ───────────────────────────────────────────────────
# GROWW_API_KEY=
# GROWW_ACCESS_TOKEN=

# ──── Redis (for multi-worker / cluster mode sync) ─────────────────────────
# REDIS_URL=redis://localhost:6379
'@

Remove-Item -Force .env.example -ErrorAction SilentlyContinue
$content | Out-File -FilePath .env.example -Encoding utf8
Write-Host ".env.example created successfully!"
