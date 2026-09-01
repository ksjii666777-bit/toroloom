#!/bin/bash
# ============================================
# Toroloom — Performance Testing Script
# ============================================
# Tests API response times and identifies bottlenecks
# Usage: bash performance-test.sh

BACKEND_URL="https://toroloom-production.up.railway.app"

echo "⚡ Toroloom Performance Testing"
echo "Backend: $BACKEND_URL"
echo ""

# First, get a token
echo "1. Getting auth token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "rahul.sharma@email.com", "password": "Demo@12345"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  exit 1
fi
echo "✅ Token obtained"
echo ""

# Performance tests
echo "2. Testing API Response Times..."
echo "================================="

test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  
  echo -n "   $name: "
  
  START=$(date +%s%N)
  
  if [ "$method" = "GET" ]; then
    RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
      -H "Authorization: Bearer $TOKEN" \
      "$BACKEND_URL$endpoint")
  else
    RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null \
      -X POST \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BACKEND_URL$endpoint")
  fi
  
  END=$(date +%s%N)
  DURATION=$(( (END - START) / 1000000 ))
  
  if [ "$RESPONSE" = "200" ]; then
    if [ $DURATION -lt 500 ]; then
      echo "✅ ${DURATION}ms (EXCELLENT)"
    elif [ $DURATION -lt 1000 ]; then
      echo "✅ ${DURATION}ms (GOOD)"
    elif [ $DURATION -lt 2000 ]; then
      echo "⚠️  ${DURATION}ms (ACCEPTABLE)"
    else
      echo "❌ ${DURATION}ms (TOO SLOW)"
    fi
  else
    echo "❌ HTTP $RESPONSE (${DURATION}ms)"
  fi
}

# Test endpoints
test_endpoint "Health Check" "GET" "/health"
test_endpoint "Login" "POST" "/api/auth/login" '{"email":"rahul.sharma@email.com","password":"Demo@12345"}'
test_endpoint "Market Stocks" "GET" "/api/market/stocks"
test_endpoint "Stock Detail" "GET" "/api/market/stocks/RELIANCE"
test_endpoint "Portfolio" "GET" "/api/portfolio/holdings"
test_endpoint "Watchlist" "GET" "/api/watchlist"
test_endpoint "News" "GET" "/api/news"
test_endpoint "Stock News" "GET" "/api/news/symbol/RELIANCE"
test_endpoint "Notifications" "GET" "/api/notifications"
test_endpoint "Education" "GET" "/api/education/courses"
test_endpoint "Community" "GET" "/api/community/posts"
test_endpoint "Commodities" "GET" "/api/commodities"
test_endpoint "Forex" "GET" "/api/forex/rates"
test_endpoint "Bonds" "GET" "/api/bonds"

echo ""
echo "================================="
echo "📊 Performance Summary"
echo "================================="

# Load test
echo ""
echo "3. Load Testing (10 concurrent requests)..."
echo "================================="

for i in {1..10}; do
  curl -s -H "Authorization: Bearer $TOKEN" "$BACKEND_URL/api/market/stocks" > /dev/null &
done
wait

echo "✅ 10 concurrent requests completed"

echo ""
echo "4. WebSocket Test..."
echo "================================="
echo "   WebSocket URL: wss://toroloom-production.up.railway.app/ws"
echo "   (Manual test: Use wscat or browser console)"

echo ""
echo "================================="
echo "🎯 Performance Targets:"
echo "   - Health Check: < 100ms"
echo "   - Login: < 500ms"
echo "   - Stock List: < 1000ms"
echo "   - Stock Detail: < 500ms"
echo "   - Portfolio: < 1000ms"
echo "   - Place Order: < 2000ms"
echo "================================="
