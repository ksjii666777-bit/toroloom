#!/bin/bash
# ============================================
# Toroloom — Create Test Accounts
# ============================================
# Run this script to create test accounts for 10-15 testers
# Usage: bash create-test-accounts.sh

BACKEND_URL="https://toroloom-production.up.railway.app"

echo "🧪 Creating Test Accounts for Toroloom..."
echo "Backend: $BACKEND_URL"
echo ""

# Test accounts
declare -A TEST_ACCOUNTS=(
  ["test1@toroloom.com"]="Test@12345"
  ["test2@toroloom.com"]="Test@12345"
  ["test3@toroloom.com"]="Test@12345"
  ["test4@toroloom.com"]="Test@12345"
  ["test5@toroloom.com"]="Test@12345"
  ["test6@toroloom.com"]="Test@12345"
  ["test7@toroloom.com"]="Test@12345"
  ["test8@toroloom.com"]="Test@12345"
  ["test9@toroloom.com"]="Test@12345"
  ["test10@toroloom.com"]="Test@12345"
  ["test11@toroloom.com"]="Test@12345"
  ["test12@toroloom.com"]="Test@12345"
)

SUCCESS_COUNT=0
FAIL_COUNT=0
INDEX=1

for EMAIL in "${!TEST_ACCOUNTS[@]}"; do
  PASSWORD="${TEST_ACCOUNTS[$EMAIL]}"
  
  # Generate unique phone number (9000000001, 9000000002, etc.)
  PHONE_NUM=$((9000000000 + INDEX))
  
  echo -n "Creating account: $EMAIL (phone: $PHONE_NUM)... "
  
  RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$EMAIL\",
      \"password\": \"$PASSWORD\",
      \"name\": \"Tester ${EMAIL%%@*}\",
      \"phone\": \"$PHONE_NUM\"
    }")
  
  if echo "$RESPONSE" | grep -q "token\|Token\|jwt"; then
    echo "✅ SUCCESS"
    ((SUCCESS_COUNT++))
  else
    # Check if user already exists
    if echo "$RESPONSE" | grep -q "already exists\|already registered"; then
      echo "⚠️  ALREADY EXISTS (OK)"
      ((SUCCESS_COUNT++))
    else
      echo "❌ FAILED: $RESPONSE"
      ((FAIL_COUNT++))
    fi
  fi
  
  ((INDEX++))
done

echo ""
echo "==========================================="
echo "📊 Results:"
echo "   ✅ Success: $SUCCESS_COUNT"
echo "   ❌ Failed: $FAIL_COUNT"
echo "==========================================="

echo ""
echo "📋 Test Accounts:"
echo "========================"
for EMAIL in "${!TEST_ACCOUNTS[@]}"; do
  echo "   Email: $EMAIL"
  echo "   Pass:  ${TEST_ACCOUNTS[$EMAIL]}"
  echo ""
done

echo "🔗 Login URL: $BACKEND_URL/api/auth/login"
echo ""
echo "📱 Share these credentials with testers!"
