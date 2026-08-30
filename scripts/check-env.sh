#!/bin/bash
# =============================================================================
# Toroloom — Environment Variable Diagnostic
# =============================================================================
#
# Checks all required environment variables and reports missing ones.
#
# Usage:
#   ./scripts/check-env.sh              # Check frontend env
#   ./scripts/check-env.sh --backend    # Check backend env
#
# =============================================================================

echo ""
echo "🔍 Toroloom Environment Diagnostic"
echo "════════════════════════════════════════════════════════════════"
echo ""

MISSING=0
WARNINGS=0

check_var() {
  local var=$1
  local desc=$2
  local required=$3
  
  if [ -n "${!var}" ]; then
    echo "  ✅ $var — SET"
  elif [ "$required" = "required" ]; then
    echo "  ❌ $var — MISSING (required: $desc)"
    MISSING=$((MISSING + 1))
  else
    echo "  ⚠️  $var — MISSING (optional: $desc)"
    WARNINGS=$((WARNINGS + 1))
  fi
}

# ── Backend Env Vars ──────────────────────────────────────────────────────

if [ "$1" = "--backend" ]; then
  echo "📋 Backend Environment Variables"
  echo "──────────────────────────────────────────────────────────────"
  
  echo ""
  echo "🔗 SnapTrade (Broker Connect)"
  check_var "SNAPTRADE_CLIENT_ID" "SnapTrade client ID from snaptrade.com/dashboard" "required"
  check_var "SNAPTRADE_CONSUMER_KEY" "SnapTrade consumer key from snaptrade.com/dashboard" "required"
  check_var "SNAPTRADE_MODE" "Auth mode: 'commercial' or 'personal'" "optional"
  check_var "SNAPTRADE_ENCRYPTION_KEY" "AES-256 key for encrypting user secrets" "required"
  
  echo ""
  echo "📰 News Providers"
  check_var "NEWS_API_KEY" "NewsAPI.org API key" "optional"
  check_var "GNEWS_API_KEY" "GNews API key" "optional"
  check_var "NEWSDATA_API_KEY" "NewsData.io API key" "optional"
  
  echo ""
  echo "🏦 Broker APIs"
  check_var "BROKER" "Default broker: 'mock', 'zerodha', 'angel', 'groww'" "optional"
  check_var "KITE_API_KEY" "Zerodha Kite Connect API key" "optional"
  check_var "KITE_API_SECRET" "Zerodha Kite Connect API secret" "optional"
  check_var "ANGEL_API_KEY" "Angel One SmartAPI key" "optional"
  check_var "ANGEL_CLIENT_ID" "Angel One client ID" "optional"
  check_var "GROWW_API_KEY" "Groww Trade API key" "optional"
  check_var "GROWW_ACCESS_TOKEN" "Groww access token" "optional"
  check_var "UPSTOX_CLIENT_ID" "Upstox OAuth client ID" "optional"
  check_var "UPSTOX_CLIENT_SECRET" "Upstox OAuth client secret" "optional"
  
  echo ""
  echo "🗄️ Database"
  check_var "STORAGE_BACKEND" "Storage backend: 'memory', 'postgres', 'mongodb'" "required"
  check_var "DATABASE_URL" "PostgreSQL connection URL" "optional"
  check_var "MONGODB_URI" "MongoDB connection URI" "optional"
  check_var "REDIS_URL" "Redis connection URL" "optional"
  
  echo ""
  echo "🔐 Security"
  check_var "JWT_SECRET" "JWT signing secret" "required"
  check_var "CORS_ORIGIN" "Allowed CORS origins" "optional"
  
  echo ""
  echo "📊 Analytics & Monitoring"
  check_var "SENTRY_DSN" "Sentry error tracking DSN" "optional"
  check_var "MARKETSTACK_API_KEY" "MarketStack API key" "optional"
  
else
  echo "📋 Frontend Environment Variables"
  echo "──────────────────────────────────────────────────────────────"
  
  echo ""
  echo "📱 App Config"
  check_var "API_BASE_URL" "Backend API base URL" "required"
  check_var "EXPO_PUBLIC_API_URL" "Expo public API URL" "optional"
  
  echo ""
  echo "🔗 Deep Linking"
  check_var "APP_SCHEME" "Custom URL scheme (default: toroloom)" "optional"
  check_var "UNIVERSAL_LINK_DOMAIN" "Universal link domain" "optional"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📊 Summary: $MISSING missing required, $WARNINGS missing optional"
echo "════════════════════════════════════════════════════════════════"

if [ $MISSING -gt 0 ]; then
  echo ""
  echo "❌ $MISSING required environment variables are missing!"
  echo "   Set them in your .env file or environment."
  exit 1
else
  echo ""
  echo "✅ All required environment variables are set!"
  exit 0
fi
