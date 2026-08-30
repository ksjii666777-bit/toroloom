#!/bin/bash
# =============================================================================
# Toroloom — Deep Link Quick Test Script
# =============================================================================
#
# Quick shell script to test deep link endpoints without ts-node.
#
# Usage:
#   ./scripts/test-deep-links.sh                          # Test against production
#   ./scripts/test-deep-links.sh http://localhost:3000     # Test against local
#   BASE_URL=http://localhost:3000 ./scripts/test-deep-links.sh
#
# =============================================================================

set -e

# ── Configuration ──────────────────────────────────────────────────────────

BASE_URL="${1:-$BASE_URL:-https://toroloom.com}"
PASS=0
FAIL=0
TOTAL=0

# ── Colors ─────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Helper Functions ────────────────────────────────────────────────────────

pass() {
  echo -e "  ${GREEN}✅ $1${NC}"
  PASS=$((PASS + 1))
  TOTAL=$((TOTAL + 1))
}

fail() {
  echo -e "  ${RED}❌ $1${NC}"
  [ -n "$2" ] && echo -e "     ${YELLOW}$2${NC}"
  FAIL=$((FAIL + 1))
  TOTAL=$((TOTAL + 1))
}

section() {
  echo ""
  echo -e "${CYAN}$1${NC}"
}

# ── Crawler User Agents ────────────────────────────────────────────────────

FB_AGENT="facebookexternalhit/1.1"
TWITTER_AGENT="Twitterbot/1.0"
WHATSAPP_AGENT="WhatsApp/2.23.24.82"
DISCORD_AGENT="Discordbot/2.0"

# ═════════════════════════════════════════════════════════════════════════════
# TESTS
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "🔗 Toroloom Deep Link Quick Test"
echo "   Base URL: $BASE_URL"
echo ""

# ── .well-known Endpoints ──────────────────────────────────────────────────

section "📋 .well-known Endpoints"

# Test apple-app-site-association
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/.well-known/apple-app-site-association")
if [ "$STATUS" = "200" ]; then
  pass "apple-app-site-association accessible (HTTP $STATUS)"
else
  fail "apple-app-site-association" "Expected HTTP 200, got $STATUS"
fi

# Test assetlinks.json
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/.well-known/assetlinks.json")
if [ "$STATUS" = "200" ]; then
  pass "assetlinks.json accessible (HTTP $STATUS)"
else
  fail "assetlinks.json" "Expected HTTP 200, got $STATUS"
fi

# Validate AASA has required paths
AASA=$(curl -s "$BASE_URL/.well-known/apple-app-site-association")
if echo "$AASA" | grep -q "og/stock"; then
  pass "AASA has /og/stock/* path"
else
  fail "AASA missing /og/stock/* path"
fi

if echo "$AASA" | grep -q "signup"; then
  pass "AASA has /signup* path"
else
  fail "AASA missing /signup* path"
fi

# Validate assetlinks has correct package
ASSETLINKS=$(curl -s "$BASE_URL/.well-known/assetlinks.json")
if echo "$ASSETLINKS" | grep -q "com.toroloom.app"; then
  pass "assetlinks.json has correct package name"
else
  fail "assetlinks.json missing com.toroloom.app"
fi

# ── OG Preview Routes (Facebook Crawler) ───────────────────────────────────

section "🌐 OG Preview Routes (Facebook Crawler)"

# Test stock OG preview
OG_STOCK=$(curl -s -A "$FB_AGENT" "$BASE_URL/og/stock/RELIANCE")
if echo "$OG_STOCK" | grep -q "og:title"; then
  pass "Stock OG preview has og:title"
else
  fail "Stock OG preview missing og:title"
fi

if echo "$OG_STOCK" | grep -q "og:image"; then
  pass "Stock OG preview has og:image"
else
  fail "Stock OG preview missing og:image"
fi

if echo "$OG_STOCK" | grep -q "RELIANCE"; then
  pass "Stock OG preview contains RELIANCE"
else
  fail "Stock OG preview missing RELIANCE"
fi

# Test post OG preview
OG_POST=$(curl -s -A "$FB_AGENT" "$BASE_URL/og/post/test123")
if echo "$OG_POST" | grep -q "og:title"; then
  pass "Post OG preview has og:title"
else
  fail "Post OG preview missing og:title"
fi

# Test course OG preview
OG_COURSE=$(curl -s -A "$FB_AGENT" "$BASE_URL/og/course/course1")
if echo "$OG_COURSE" | grep -q "og:title"; then
  pass "Course OG preview has og:title"
else
  fail "Course OG preview missing og:title"
fi

# Test advisor OG preview
OG_ADVISOR=$(curl -s -A "$FB_AGENT" "$BASE_URL/og/advisor/adv1")
if echo "$OG_ADVISOR" | grep -q "og:title"; then
  pass "Advisor OG preview has og:title"
else
  fail "Advisor OG preview missing og:title"
fi

# ── Twitter Card Tags ──────────────────────────────────────────────────────

section "🐦 Twitter Card Tags"

OG_TWITTER=$(curl -s -A "$TWITTER_AGENT" "$BASE_URL/og/stock/TCS")
if echo "$OG_TWITTER" | grep -q "twitter:card"; then
  pass "Twitter Card tag present"
else
  fail "Missing twitter:card tag"
fi

if echo "$OG_TWITTER" | grep -q "summary_large_image"; then
  pass "Using summary_large_image card type"
else
  fail "Not using summary_large_image card"
fi

# ── Deep Link Meta Tags ────────────────────────────────────────────────────

section "🔗 Deep Link Meta Tags"

if echo "$OG_STOCK" | grep -q "al:ios:url"; then
  pass "iOS deep link meta tag present"
else
  fail "Missing al:ios:url meta tag"
fi

if echo "$OG_STOCK" | grep -q "al:android:url"; then
  pass "Android deep link meta tag present"
else
  fail "Missing al:android:url meta tag"
fi

if echo "$OG_STOCK" | grep -q "toroloom://"; then
  pass "Custom scheme URL present"
else
  fail "Missing toroloom:// custom scheme"
fi

# ── Cache Headers ──────────────────────────────────────────────────────────

section "📦 Cache Headers"

CACHE_HEADER=$(curl -s -I -A "$FB_AGENT" "$BASE_URL/og/stock/RELIANCE" | grep -i "cache-control")
if echo "$CACHE_HEADER" | grep -q "max-age"; then
  pass "Cache-Control header present"
else
  fail "Missing Cache-Control header"
fi

# ── Verification Endpoints ─────────────────────────────────────────────────

section "🔍 Verification Endpoints"

VERIFY_ALL=$(curl -s "$BASE_URL/api/app-links/verify/all")
if echo "$VERIFY_ALL" | grep -q '"ios"'; then
  pass "/api/app-links/verify/all returns iOS config"
else
  fail "/api/app-links/verify/all missing iOS config"
fi

if echo "$VERIFY_ALL" | grep -q '"android"'; then
  pass "/api/app-links/verify/all returns Android config"
else
  fail "/api/app-links/verify/all missing Android config"
fi

VERIFY_IOS=$(curl -s "$BASE_URL/api/app-links/verify/ios")
if echo "$VERIFY_IOS" | grep -q '"platform": "ios"'; then
  pass "/api/app-links/verify/ios works"
else
  fail "/api/app-links/verify/ios failed"
fi

VERIFY_ANDROID=$(curl -s "$BASE_URL/api/app-links/verify/android")
if echo "$VERIFY_ANDROID" | grep -q '"platform": "android"'; then
  pass "/api/app-links/verify/android works"
else
  fail "/api/app-links/verify/android failed"
fi

DEEP_LINKS=$(curl -s "$BASE_URL/api/app-links/deep-links")
if echo "$DEEP_LINKS" | grep -q '"customScheme"'; then
  pass "/api/app-links/deep-links works"
else
  fail "/api/app-links/deep-links failed"
fi

# ═════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "📊 Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, $TOTAL total"
echo "════════════════════════════════════════════════════════════════"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}❌ Some tests failed. See above for details.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
fi
