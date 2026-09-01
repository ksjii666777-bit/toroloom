# 🧪 Toroloom — Pre-Launch Testing Plan

## 🎯 Goal
10-15 testers **har feature real mein test karein** before public launch.
**Trading app hai — 1 second delay = user ka nuksan.**

---

## 📋 Test Accounts

| # | Email | Password | Role | Notes |
|---|-------|----------|------|-------|
| 1 | rahul.sharma@email.com | Demo@12345 | Admin | Full access |
| 2 | test1@toroloom.com | Test@12345 | Tester 1 | |
| 3 | test2@toroloom.com | Test@12345 | Tester 2 | |
| 4 | test3@toroloom.com | Test@12345 | Tester 3 | |
| 5 | test4@toroloom.com | Test@12345 | Tester 4 | |
| 6 | test5@toroloom.com | Test@12345 | Tester 5 | |
| 7 | test6@toroloom.com | Test@12345 | Tester 6 | |
| 8 | test7@toroloom.com | Test@12345 | Tester 7 | |
| 9 | test8@toroloom.com | Test@12345 | Tester 8 | |
| 10 | test9@toroloom.com | Test@12345 | Tester 9 | |
| 11 | test10@toroloom.com | Test@12345 | Tester 10 | |
| 12 | test11@toroloom.com | Test@12345 | Tester 11 | |
| 13 | test12@toroloom.com | Test@12345 | Tester 12 | |

---

## 🔥 CRITICAL: Trading Features (Must Work 100%)

### 1. Login / Signup Flow
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Sign up with new email | Account created, JWT token received | |
| Login with correct credentials | Token + user data | |
| Login with wrong password | Error message, no token | |
| Token expiry after 7 days | Auto logout | |
| Multiple devices login | Both sessions work | |

### 2. Stock Data & Charts
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Stock list loads | Prices + names visible | |
| Click stock → Detail screen | Chart + info loads | |
| Native candlestick chart | No TradingView error | |
| Chart timeframes (1D, 1W, 1M) | Data changes correctly | |
| Chart zoom/scroll | Smooth, no lag | |
| Stock search | Finds correct stock | |
| Real-time price updates | WebSocket updates | |

### 3. Broker Connection (CRITICAL)
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Connect Broker screen loads | Broker list visible | |
| Angel One → Connect | OAuth flow works | |
| Broker auth success | "Connected" status | |
| Portfolio sync from broker | Real holdings appear | |
| Place order → Broker | Order placed successfully | |
| Cancel order | Order cancelled | |
| Order status check | Real-time status | |
| Disconnect broker | Clean disconnect | |

### 4. Portfolio Management
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Holdings list loads | All holdings with P&L | |
| P&L calculation | Correct numbers | |
| Real-time P&L update | Updates every second | |
| Add stock to portfolio | Stock appears | |
| Remove stock from portfolio | Stock removed | |
| Portfolio summary card | Total value correct | |

### 5. Watchlist
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Create watchlist | List created | |
| Add stock to watchlist | Stock appears | |
| Remove stock from watchlist | Stock removed | |
| Watchlist sync across devices | Same data everywhere | |
| Real-time price updates in watchlist | Prices update | |

### 6. Orders & Trading
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Place BUY order | Order placed | |
| Place SELL order | Order placed | |
| Limit order | Price constraint works | |
| Market order | Executes at market price | |
| Order history | All orders listed | |
| Order status tracking | Real-time updates | |

---

## 📊 Market Data Features

### 7. News Section
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| News feed loads | Articles visible | |
| Click article → Detail | Opens correctly | |
| Stock-specific news | News for clicked stock | |
| News sentiment badges | Positive/Negative/Neutral | |
| Refresh news | New articles load | |

### 8. Markets Tab
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Market indices (NIFTY, SENSEX) | Values correct | |
| Sector heatmap | Colors correct | |
| Top gainers/losers | Lists populated | |
| Market status (Open/Closed) | Correct status | |

### 9. Crypto Markets
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Crypto list loads | BTC, ETH, etc. visible | |
| Crypto prices | Current prices | |
| Crypto detail screen | Chart + info | |
| Price changes (%) | Correct calculations | |

### 10. US Markets
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| US stock list | AAPL, TSLA, etc. | |
| US stock prices | Current prices | |
| US market status | Open/Closed correct | |

### 11. Forex
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Forex pairs list | USD/INR, EUR/INR, etc. | |
| Exchange rates | Current rates | |
| Rate changes | Correct % changes | |

### 12. Commodities
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Commodities list | Gold, Silver, Crude | |
| Commodity prices | Current prices | |
| Price charts | Working | |

### 13. Bonds
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Bonds list | Government bonds | |
| Yield data | Current yields | |
| Bond detail | More info | |

---

## 📱 UI/UX Features

### 14. Navigation
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Bottom tabs work | All 5 tabs | |
| Back navigation | Goes to previous screen | |
| Deep linking | Opens correct screen | |
| Tab state persistence | Remembers scroll position | |

### 15. Settings & Profile
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Profile screen loads | User info visible | |
| Change theme (Light/Dark) | Theme switches | |
| Notification settings | Toggle works | |
| Logout | Clean logout | |

### 16. Notifications
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Notifications list | Items visible | |
| Mark as read | Status updates | |
| Push notifications | Receives on device | |

### 17. Community
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Community posts | Posts visible | |
| Create post | Post published | |
| Like/comment | Interaction works | |

### 18. Education
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Courses list | Courses visible | |
| Course detail | Content loads | |
| Quiz functionality | Questions + answers | |

---

## ⚡ Performance Tests (CRITICAL for Trading)

### 19. Response Time
| Test | Target | Actual | Pass/Fail |
|------|--------|--------|-----------|
| Login API | < 500ms | | |
| Stock list API | < 1000ms | | |
| Stock detail API | < 500ms | | |
| Place order API | < 2000ms | | |
| WebSocket connect | < 1000ms | | |
| Chart render | < 2000ms | | |
| News load | < 1500ms | | |

### 20. Load Testing
| Test | Target | Actual | Pass/Fail |
|------|--------|--------|-----------|
| 10 concurrent users | No crashes | | |
| 50 API calls/min | Rate limit works | | |
| WebSocket 10 connections | All receive updates | | |
| Memory usage (1 hour) | No leak | | |

### 21. Network Conditions
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Slow 3G | App usable, graceful degradation | |
| No internet | Offline mode works | |
| Network switch (WiFi → 4G) | Reconnects | |
| High latency (500ms+) | No crash | |

---

## 🔒 Security Tests

### 22. Authentication Security
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| JWT token validation | Invalid tokens rejected | |
| Token expiry | Expired tokens rejected | |
| SQL injection in login | Blocked | |
| XSS in inputs | Sanitized | |
| Rate limiting (10 req/15min) | Blocks after limit | |

### 23. Data Security
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Passwords hashed | Never plain text | |
| API keys encrypted | In database | |
| HTTPS enforced | All endpoints | |
| CORS configured | Only allowed origins | |

---

## 🐛 Bug Report Template

```markdown
## Bug Report

**Title:** [Brief description]

**Severity:** [Critical/High/Medium/Low]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:** [What should happen]

**Actual Result:** [What actually happened]

**Screenshots:** [If applicable]

**Device:** [Phone model + OS version]

**Network:** [WiFi/4G/5G]

**Time:** [When it happened]
```

---

## 📊 Testing Schedule

### Week 1: Internal Testing (You + 2-3 people)
- Day 1-2: Setup + basic flow testing
- Day 3-4: Trading features testing
- Day 5-7: Performance + security testing

### Week 2: Closed Beta (10-15 people)
- Day 1: Onboard testers
- Day 2-5: Real-world testing
- Day 6-7: Bug fixes + retesting

### Week 3: Pre-Launch
- Day 1-2: Final bug fixes
- Day 3-4: Load testing
- Day 5-7: Launch preparation

---

## ✅ Launch Checklist

- [ ] All Critical tests pass
- [ ] All High tests pass
- [ ] Performance targets met
- [ ] Security tests pass
- [ ] No P0/P1 bugs open
- [ ] Backend deployed to production
- [ ] Database migrations applied
- [ ] Monitoring + alerting set up
- [ ] Rollback plan documented
- [ ] Support team briefed

---

## 🚨 Emergency Contacts

| Role | Contact | Phone |
|------|---------|-------|
| Lead Developer | Karan | [Your Number] |
| Backend Support | Dev Team | [Team Number] |
| Broker Support | Angel One | 1800-123-4567 |

---

**Remember: Trading app hai — har second matter karta hai! 🚀**
