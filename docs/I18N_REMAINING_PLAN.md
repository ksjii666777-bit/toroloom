# Toroloom I18N Hindi Conversion — Remaining Screens Plan

> Generated from auto-i18n-convert audit on {{date}}

---

## ✅ Already Converted (22 screens)

| Screen | Status |
|--------|--------|
| HomeScreen | ✅ Complete |
| MarketsScreen | ✅ Complete |
| PortfolioScreen | ✅ Complete |
| TradingScreen (PlaceOrder) | ✅ Complete |
| Settings/Profile screens | ✅ Complete (SecuritySettings, MoreScreen) |
| NotificationsScreen | ✅ Complete |
| Education screens (8 files) | ✅ Complete |
| AI Screens (AIInsights + AITradeAssistant) | ✅ Complete |
| Calculator screens (SIP, Lumpsum, EMI, Tax) | ✅ Complete |
| FnO Options Chain + Strategy Builder | ✅ Complete |
| ReportsScreen | ✅ Complete |
| MoreScreen (50 menu items) | ✅ Complete |

---

## 📋 Remaining: Priority-Wise Plan

### TIER 1 — 🔴 High Priority (20+ strings, complex screens)

These screens have the most hardcoded strings and would benefit most from conversion:

| # | Screen | Strings | Est. Time |
|---|--------|---------|-----------|
| 1 | **SocialTradingScreen** | ~35 strings | 15 min |
| 2 | **IPODashboardScreen** | ~31 + props | 12 min |
| 3 | **ContractNoteUploadScreen** | ~29 + 14 Alerts | 15 min |
| 4 | **BankLinkingScreen** | ~25 + 4 Alerts | 12 min |
| 5 | **MutualFundsScreen** | ~23 + 5 Alerts | 12 min |
| 6 | **CreateCourseScreen** | ~23 + 9 props | 15 min |
| 7 | **SnapTradeOrderScreen** | ~24 strings | 10 min |
| 8 | **FactorAnalysisScreen** | ~22 + 8 props | 12 min |
| 9 | **TaxHarvestingCalendar** | ~22 strings | 10 min |
| 10 | **IPOCalendarScreen** | ~20 strings | 10 min |
| 11 | **ConnectBrokerView** | ~20 + 8 Alerts | 12 min |
| **→ Tier 1 Total** | **11 screens** | **~280 strings** | **~2.5 hrs** |

### TIER 2 — 🟡 Medium Priority (10-19 strings)

| # | Screen | Strings | Est. Time |
|---|--------|---------|-----------|
| 12 | **EarningsCallScreen** | ~26 + 6 props | 12 min |
| 13 | **MonteCarloSimulation** | ~16 + 7 props | 10 min |
| 14 | **CapitalGainsScreen** | ~15 + 9 props | 10 min |
| 15 | **AdminCouponManagement** | ~23 + 5 Alerts | 12 min |
| 16 | **AdminCourseReview** | ~18 + 8 Alerts | 12 min |
| 17 | **RiskSettingsScreen** | ~19 + 8 props | 10 min |
| 18 | **SubscriptionScreen** | ~17 strings | 8 min |
| 19 | **TenantConfigScreen** | ~16 + 11 props | 12 min |
| 20 | **PaymentHistoryScreen** | ~17 + 2 Alerts | 8 min |
| 21 | **PortfolioAlertsScreen** | ~19 + 5 Alerts | 10 min |
| 22 | **RevenueDashboardScreen** | ~16 strings | 8 min |
| 23 | **TwoFactorSetupScreen** | ~16 + 5 props | 10 min |
| 24 | **IPODetailScreen** | ~15 + 23 props | 15 min |
| 25 | **NFODetailScreen** | ~13 + 19 props | 12 min |
| 26 | **BondDashboardScreen** | ~18 strings | 8 min |
| 27 | **UPIScreen** | ~18 + 3 props + 9 Alerts | 12 min |
| 28 | **FundsDashboardScreen** | ~17 strings | 8 min |
| 29 | **CertificateScreen** | ~17 + 4 Alerts | 10 min |
| 30 | **CopyAnalyticsScreen** | ~22 + 5 props | 12 min |
| **→ Tier 2 Total** | **19 screens** | **~360 strings** | **~3 hrs** |

### TIER 3 — 🟢 Low Priority (<10 strings or simple screens)

| # | Screen | Strings | Est. Time |
|---|--------|---------|-----------|
| 31-50 | **Remaining screens** | ~5-15 each | ~4 hrs |
| | *Components (widgets, fno, stock, ui)* | ~2-12 each | ~2 hrs |

**→ Tier 3 Total** | **~35 screens** | **~350 strings** | **~6 hrs**

---

## 📊 Grand Total

| Tier | Screens | Total Strings | Est. Time |
|------|---------|---------------|-----------|
| 🔴 High Priority | 11 | ~280 | ~2.5 hrs |
| 🟡 Medium Priority | 19 | ~360 | ~3 hrs |
| 🟢 Low Priority | ~35 | ~350 | ~6 hrs |
| **Total Remaining** | **~65** | **~990** | **~11.5 hrs** |

---

## 🏁 Recommended Order

1. **🔴 Tier 1 first** (biggest impact)
   - Start with `SocialTradingScreen` (35 strings — biggest)
   - Then `IPODashboardScreen` + `IPODetailScreen` (most user-facing)
   - Then `ContractNoteUploadScreen` (complex but important)
   - Then `BankLinkingScreen` + KYC screens

2. **🟡 Tier 2 second** (medium complexity)
   - Funds screens (AddFunds, Withdraw, Transfer, UPI)
   - Settings screens (RiskSettings, Subscription, etc.)
   - Analytics screens (MonteCarlo, FactorAnalysis, etc.)

3. **🟢 Tier 3 last** (simplest screens)
   - Small screens & components
   - Storybook files (can skip)
