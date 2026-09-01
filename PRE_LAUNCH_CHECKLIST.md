# 🚀 Toroloom — Pre-Launch Checklist

## 📋 Executive Summary

**Goal:** Launch Toroloom to millions of users with zero critical bugs.

**Current Status:** 
- ✅ Backend running (Railway + Neon PostgreSQL)
- ✅ Frontend working (React Native + Expo)
- ✅ 16+ APIs functional
- ✅ Native candlestick charts
- ✅ Stock news section
- ✅ Broker plugins ready (Angel One, Zerodha, etc.)

**Remaining Work:**
- ❌ 10-15 tester validation
- ❌ Real broker API setup
- ❌ Performance optimization
- ❌ Security hardening
- ❌ Production deployment

---

## 🎯 Phase 1: Internal Testing (Week 1)

### Day 1-2: Setup & Basic Flow
- [ ] Create test accounts (10-15)
- [ ] Deploy backend to Railway
- [ ] Connect Neon PostgreSQL
- [ ] Test login/signup flow
- [ ] Test basic navigation
- [ ] Verify all screens load

### Day 3-4: Trading Features (CRITICAL)
- [ ] Test stock list + prices
- [ ] Test candlestick charts
- [ ] Test stock detail screen
- [ ] Test news section
- [ ] Test watchlist CRUD
- [ ] Test portfolio display

### Day 5-7: Performance & Security
- [ ] Run performance tests
- [ ] Test on slow networks
- [ ] Test offline mode
- [ ] Security testing (SQL injection, XSS)
- [ ] Load testing (10+ concurrent users)

---

## 🎯 Phase 2: Closed Beta (Week 2)

### Day 1: Onboard Testers
- [ ] Share Expo Go QR code
- [ ] Distribute test credentials
- [ ] Create WhatsApp group
- [ ] Set up bug report form
- [ ] Brief testers on priorities

### Day 2-5: Real-World Testing
- [ ] Testers use app daily
- [ ] Collect bug reports
- [ ] Fix critical issues
- [ ] Retest fixes
- [ ] Performance monitoring

### Day 6-7: Bug Fixes
- [ ] Fix P0 bugs (critical)
- [ ] Fix P1 bugs (high)
- [ ] Document P2/P3 for later
- [ ] Final regression testing

---

## 🎯 Phase 3: Pre-Launch (Week 3)

### Day 1-2: Final Bug Fixes
- [ ] All P0 bugs fixed
- [ ] All P1 bugs fixed
- [ ] No regressions

### Day 3-4: Load Testing
- [ ] 50+ concurrent users
- [ ] API response times < 1s
- [ ] WebSocket stability
- [ ] Memory leak testing

### Day 5-7: Launch Preparation
- [ ] Production deployment
- [ ] Database migrations
- [ ] Monitoring + alerting
- [ ] Rollback plan
- [ ] Support team briefed

---

## 🔑 API Keys Required

### Tier 1: CRITICAL (Must Have)
| API | Purpose | Status | Action |
|-----|---------|--------|--------|
| **Railway** | Backend hosting | ✅ Done | Monitor |
| **Neon PostgreSQL** | Database | ✅ Done | Monitor |

### Tier 2: HIGH PRIORITY (Should Have)
| API | Purpose | Status | Action |
|-----|---------|--------|--------|
| **Angel One SmartAPI** | Live Indian stocks | ❌ Needed | Setup |
| **SnapTrade** | US broker connection | ❌ Needed | Setup |

### Tier 3: MEDIUM PRIORITY (Nice to Have)
| API | Purpose | Status | Action |
|-----|---------|--------|--------|
| **MarketStack** | US stock prices | ❌ Optional | Setup later |
| **NewsAPI** | Better news | ❌ Optional | RSS working |
| **OpenRouter** | AI insights | ❌ Optional | Setup later |

---

## 📊 Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Login API | < 500ms | TBD | ⏳ |
| Stock List | < 1000ms | TBD | ⏳ |
| Stock Detail | < 500ms | TBD | ⏳ |
| Place Order | < 2000ms | TBD | ⏳ |
| WebSocket | < 1000ms | TBD | ⏳ |
| Chart Render | < 2000ms | TBD | ⏳ |

---

## 🔒 Security Checklist

- [ ] JWT tokens properly validated
- [ ] Passwords hashed (bcrypt)
- [ ] SQL injection prevented
- [ ] XSS attacks blocked
- [ ] Rate limiting enabled
- [ ] CORS configured
- [ ] HTTPS enforced
- [ ] API keys encrypted

---

## 📱 Testing Devices

| Device | OS | Network | Status |
|--------|-----|---------|--------|
| Android Phone 1 | Android 12+ | WiFi | ⏳ |
| Android Phone 2 | Android 12+ | 4G | ⏳ |
| iPhone 1 | iOS 15+ | WiFi | ⏳ |
| iPhone 2 | iOS 15+ | 4G | ⏳ |
| Slow Device | Android 10 | 3G | ⏳ |

---

## 🚨 Emergency Plan

### If App Crashes:
1. Check Railway logs
2. Verify database connection
3. Rollback to previous version
4. Notify users via push notification

### If Data Loss:
1. Check PostgreSQL backups
2. Restore from last backup
3. Investigate root cause
4. Fix and redeploy

### If Security Breach:
1. Rotate all API keys
2. Invalidate all JWT tokens
3. Force password reset
4. Notify affected users

---

## 📞 Support Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Lead Developer | Karan | 24/7 during launch |
| Backend Support | Dev Team | Business hours |
| Railway Support | support@railway.app | Email |
| Neon Support | support@neon.tech | Email |

---

## 🎯 Launch Day Checklist

### Pre-Launch (T-1 hour):
- [ ] All systems green
- [ ] Monitoring active
- [ ] Support team ready
- [ ] Communication plan ready

### Launch (T-0):
- [ ] Deploy to production
- [ ] Verify all endpoints
- [ ] Test critical flows
- [ ] Monitor error rates

### Post-Launch (T+1 hour):
- [ ] Check user signups
- [ ] Monitor performance
- [ ] Address any issues
- [ ] Celebrate! 🎉

---

## 📈 Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Uptime | 99.9% | Railway monitoring |
| Response Time | < 1s | API logs |
| Error Rate | < 0.1% | Sentry/Railway logs |
| User Signups | 100+ day 1 | Database count |
| Crash Rate | < 1% | Expo analytics |

---

## 🎉 You're Ready When:

- [ ] All P0/P1 bugs fixed
- [ ] Performance targets met
- [ ] Security tested
- [ ] 10-15 testers validated
- [ ] Production deployment tested
- [ ] Monitoring active
- [ ] Support team briefed

---

**Remember: Trading app hai — har second matter karta hai! 🚀**

**Best of luck for launch! 💪**
