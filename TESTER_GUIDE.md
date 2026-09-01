# 📱 Toroloom — Tester Onboarding Guide

## 🎯 Welcome, Tester!

You're testing **Toroloom** — a real-time trading app for Indian stocks, crypto, and global markets.

**⚠️ Important:** This is a trading app. Any delay or bug can cause financial loss. Test everything carefully!

---

## 🚀 Getting Started

### Step 1: Install Expo Go
1. Open **Play Store** (Android) or **App Store** (iOS)
2. Search for **"Expo Go"**
3. Install the app

### Step 2: Connect to Test Server
1. Open **Expo Go**
2. Tap **"Scan QR Code"**
3. Scan the QR code provided by the developer
4. Wait for the app to load

**OR** Open this link in your phone browser:
```
exp://YOUR_IP_ADDRESS:8081
```

### Step 3: Login
1. Open the app
2. Enter your credentials:
   - **Email:** [Your assigned email]
   - **Password:** [Your assigned password]
3. Tap **Login**

---

## 📋 Testing Checklist

### 🔴 CRITICAL (Must Test - Trading Features)

#### 1. Login/Signup Flow
- [ ] Login with correct credentials
- [ ] Login with wrong password (should fail)
- [ ] Logout and login again
- [ ] Stay logged in after closing app

#### 2. Stock Data & Charts
- [ ] Stock list loads with prices
- [ ] Click on a stock → Detail screen opens
- [ ] Candlestick chart loads (not TradingView error)
- [ ] Change chart timeframe (1D, 1W, 1M)
- [ ] Zoom and scroll on chart
- [ ] Search for a stock

#### 3. Broker Connection
- [ ] Go to "Connect Broker" screen
- [ ] Select Angel One (or available broker)
- [ ] Complete OAuth flow
- [ ] See "Connected" status
- [ ] Portfolio syncs from broker
- [ ] Place a test order (if available)
- [ ] Cancel the order
- [ ] Disconnect broker

#### 4. Portfolio
- [ ] Holdings list loads
- [ ] P&L values are correct
- [ ] Add stock to portfolio
- [ ] Remove stock from portfolio

#### 5. Watchlist
- [ ] Create a watchlist
- [ ] Add stocks to watchlist
- [ ] Remove stocks from watchlist
- [ ] Prices update in real-time

### 🟡 IMPORTANT (Should Test)

#### 6. News
- [ ] News feed loads
- [ ] Click on article → Opens
- [ ] Stock-specific news (click stock → see news)
- [ ] Refresh news

#### 7. Markets Tab
- [ ] Market indices (NIFTY, SENSEX)
- [ ] Sector heatmap
- [ ] Top gainers/losers

#### 8. Crypto
- [ ] Crypto list loads
- [ ] BTC, ETH prices visible
- [ ] Click crypto → Detail screen

#### 9. Settings
- [ ] Profile screen loads
- [ ] Change theme (Light/Dark)
- [ ] Notification settings

### 🟢 NICE TO HAVE (Optional)

#### 10. Education
- [ ] Courses list
- [ ] Course detail

#### 11. Community
- [ ] Posts visible
- [ ] Create a post

---

## 🐛 How to Report Bugs

### Bug Report Template:
```
**Title:** [Brief description]

**Severity:** [Critical/High/Medium/Low]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:** [What should happen]

**Actual Result:** [What actually happened]

**Screenshots:** [Attach if possible]

**Device:** [Phone model + OS version]

**Network:** [WiFi/4G/5G]
```

### Where to Report:
- **WhatsApp Group:** [Group Link]
- **Google Form:** [Form Link]
- **Email:** [developer@toroloom.com]

---

## ⚡ Performance Testing

### Test on Different Networks:
- [ ] **WiFi** - Normal speed
- [ ] **4G** - Mobile data
- [ ] **Slow 3G** - Low bandwidth
- [ ] **No Internet** - Offline mode

### Test Response Times:
- Login: Should be < 1 second
- Stock list: Should load in < 2 seconds
- Chart: Should render in < 3 seconds
- Place order: Should complete in < 3 seconds

---

## 🔒 Security Testing

### Try to Break It:
- [ ] Enter SQL code in login: `admin' OR '1'='1`
- [ ] Enter HTML in search: `<script>alert('xss')</script>`
- [ ] Use expired JWT token
- [ ] Try to access without login
- [ ] Try to access other user's data

---

## 📊 Daily Testing Log

### Day 1: [Date]
- Features tested:
- Bugs found:
- Notes:

### Day 2: [Date]
- Features tested:
- Bugs found:
- Notes:

### Day 3: [Date]
- Features tested:
- Bugs found:
- Notes:

---

## 🎯 Testing Priorities

### P0 (Critical - Must Fix Before Launch):
- App crashes
- Login doesn't work
- Data loss
- Security vulnerabilities

### P1 (High - Should Fix Before Launch):
- Feature not working
- Incorrect data
- Slow performance (> 3 seconds)

### P2 (Medium - Can Fix After Launch):
- UI issues
- Minor bugs
- Cosmetic problems

### P3 (Low - Nice to Have):
- Feature requests
- UI improvements
- Documentation

---

## 📞 Support

- **Technical Issues:** Contact developer
- **Login Problems:** Check credentials or contact support
- **App Crash:** Take screenshot and report immediately

---

## 🎉 Thank You!

Your testing helps make Toroloom better for millions of users. 

**Remember:** Every bug you find prevents a financial loss for a real user!

---

**Happy Testing! 🚀**
