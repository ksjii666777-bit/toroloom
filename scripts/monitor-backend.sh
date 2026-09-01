#!/bin/bash
# ============================================
# Toroloom — Backend Monitoring Script
# ============================================
# Monitors backend health, errors, and performance
# Usage: bash monitor-backend.sh [interval_seconds]

INTERVAL=${1:-60}
BACKEND_URL="https://toroloom-production.up.railway.app"
LOG_FILE="monitoring-$(date +%Y%m%d).log"

echo "🔍 Toroloom Backend Monitoring"
echo "Backend: $BACKEND_URL"
echo "Interval: ${INTERVAL}s"
echo "Log: $LOG_FILE"
echo ""

# Function to check health
check_health() {
  local start=$(date +%s%N)
  local response=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health")
  local end=$(date +%s%N)
  local duration=$(( (end - start) / 1000000 ))
  
  local http_code=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | head -n-1)
  
  local storage_backend=$(echo "$body" | grep -o '"storageBackend":"[^"]*"' | cut -d'"' -f4)
  local storage_healthy=$(echo "$body" | grep -o '"storageHealthy":[a-z]*' | cut -d: -f2)
  local uptime=$(echo "$body" | grep -o '"uptime":[0-9.]*' | cut -d: -f2)
  
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  
  if [ "$http_code" = "200" ]; then
    echo "[$timestamp] ✅ HEALTHY | ${duration}ms | Storage: $storage_backend | Healthy: $storage_healthy | Uptime: ${uptime}s" | tee -a "$LOG_FILE"
  else
    echo "[$timestamp] ❌ UNHEALTHY | HTTP $http_code | ${duration}ms" | tee -a "$LOG_FILE"
  fi
}

# Function to test API endpoints
test_apis() {
  local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  local failures=0
  
  # Get token
  local token_response=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email": "rahul.sharma@email.com", "password": "Demo@12345"}')
  local token=$(echo "$token_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  
  if [ -z "$token" ]; then
    echo "[$timestamp] ❌ AUTH FAILED" | tee -a "$LOG_FILE"
    return 1
  fi
  
  # Test critical endpoints
  local endpoints=(
    "/api/market/stocks"
    "/api/portfolio/holdings"
    "/api/news"
    "/api/watchlist"
  )
  
  for endpoint in "${endpoints[@]}"; do
    local start=$(date +%s%N)
    local http_code=$(curl -s -w "%{http_code}" -o /dev/null \
      -H "Authorization: Bearer $token" \
      "$BACKEND_URL$endpoint")
    local end=$(date +%s%N)
    local duration=$(( (end - start) / 1000000 ))
    
    if [ "$http_code" != "200" ]; then
      echo "[$timestamp] ⚠️  $endpoint failed (HTTP $http_code, ${duration}ms)" | tee -a "$LOG_FILE"
      ((failures++))
    elif [ $duration -gt 2000 ]; then
      echo "[$timestamp] ⚠️  $endpoint slow (${duration}ms)" | tee -a "$LOG_FILE"
    fi
  done
  
  if [ $failures -eq 0 ]; then
    echo "[$timestamp] ✅ All API endpoints responding" | tee -a "$LOG_FILE"
  fi
}

# Main monitoring loop
echo "Starting monitoring... Press Ctrl+C to stop"
echo ""

while true; do
  check_health
  test_apis
  echo ""
  sleep $INTERVAL
done
