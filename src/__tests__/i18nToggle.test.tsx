/**
 * ============================================================================
 * Toroloom — i18n Language Toggle E2E Test
 * ============================================================================
 *
 * Verifies that toggling the app language en → hi → en actually changes the
 * rendered strings (and restores them), using the REAL i18n instance + real
 * locale files (no useT mock). Covers the namespaces added during the Hindi
 * conversion project plus a component-level render check.
 *
 * - Key-level: i18n.t() resolves English in 'en', Devanagari in 'hi',
 *   and English again after switching back.
 * - Component-level: PortfolioHolding renders English labels, then Hindi
 *   labels after changeLanguage('hi'), then English after changeLanguage('en').
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import i18n, { toggleLanguage } from '../i18n';
import { render } from './testUtils';
import React from 'react';
import PortfolioHolding from '../components/PortfolioHolding';
import type { Holding } from '../types';

// ==================== Theme mock (real useT, mocked colors) ====================

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    colors: {
      primary: '#6C63FF',
      secondary: '#FF6B6B',
      accent: '#00D2FF',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      warning: '#F59E0B',
      success: '#00C853',
      danger: '#FF1744',
      text: '#1A1A2E',
      textSecondary: '#4A4A68',
      textMuted: '#8888AA',
      bg: '#FFFFFF',
      bgCard: '#FFFFFF',
      bgCardLight: '#F5F5FA',
      bgInput: '#F5F5FA',
      bgSecondary: '#F8F8FD',
      border: '#E5E5F0',
      divider: '#E5E5F0',
    },
  }),
}));

// ==================== Sample data ====================

const holding: Holding = {
  id: 'h1',
  stockId: 's1',
  symbol: 'RELIANCE',
  name: 'Reliance Industries',
  quantity: 10,
  buyPrice: 2450,
  currentPrice: 2600,
  totalInvested: 24500,
  currentValue: 26000,
  pnl: 1500,
  pnlPercent: 6.12,
  dayChange: 45,
  dayChangePercent: 1.76,
};

// ==================== Namespace coverage ====================
// One representative key from each namespace added/used during the
// Hindi conversion project (with interpolation params where needed).

const NS_SAMPLES: Record<string, { en: string; hi: string; params?: Record<string, any> }> = {
  'trading.buy': { en: 'Buy', hi: 'खरीदें' },
  'trading.placeOrder': { en: 'Place Order', hi: 'ऑर्डर दें' },
  'education.title': { en: 'Courses', hi: 'कोर्स' },
  'education.quiz': { en: 'Quiz', hi: 'प्रश्नोत्तरी' },
  'kyc.panVerification': { en: 'PAN Verification', hi: 'PAN सत्यापन' },
  'ipos.applyTitle': { en: 'Apply via UPI', hi: 'UPI से आवेदन करें' },
  'charts.noChartData': { en: 'No chart data available', hi: 'चार्ट डेटा उपलब्ध नहीं है' },
  'news.marketNews': { en: 'Market News', hi: 'मार्केट न्यूज़' },
  'community.title': { en: 'Community', hi: 'समुदाय' },
  'sentimentAlerts.title': { en: 'Sentiment Alerts', hi: 'सेंटिमेंट अलर्ट' },
  'subscriptionAnalytics.title': { en: 'Subscription Analytics', hi: 'सब्सक्रिप्शन एनालिटिक्स' },
  'snaptrade.usPortfolio': { en: 'US Portfolio', hi: 'US पोर्टफोलियो' },
  'help.title': { en: 'Help & Support', hi: 'सहायता और समर्थन' },
  'adminCourseReview.title': { en: 'Course Reviews', hi: 'कोर्स समीक्षाएँ' },
  'capitalGains.title': { en: 'Capital Gains', hi: 'पूंजीगत लाभ' },
  'calculators.sip': { en: 'SIP Calculator', hi: 'SIP कैलकुलेटर' },
  'watchlist.title': { en: 'Watchlist', hi: 'वॉचलिस्ट' },
  'wealth.dashboardTitle': { en: 'Wealth Dashboard', hi: 'वेल्थ डैशबोर्ड' },
  'components.stockAnalysis.avgCost': { en: 'Avg Cost', hi: 'औसत लागत' },
  'trading.recentOrders': { en: 'Recent Orders', hi: 'हाल के ऑर्डर' },
  'app.cancel': { en: 'Cancel', hi: 'रद्द करें' },
  'time.minutesAgo': { en: '5m ago', hi: '5 मिनट पहले', params: { count: 5 } },
  'time.daysLeft': { en: '3d left', hi: '3 दिन शेष', params: { count: 3 } },
};

describe('i18n language toggle — key level', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('starts in English', () => {
    expect(i18n.language).toBe('en');
    expect(i18n.t('trading.buy')).toBe('Buy');
  });

  it.each(Object.entries(NS_SAMPLES))(
    '%s: en → hi → en round-trip',
    async (key, { en, hi, params }) => {
      // English
      await i18n.changeLanguage('en');
      const enVal = i18n.t(key, params);
      expect(enVal).toBe(en);

      // Hindi (Devanagari)
      await i18n.changeLanguage('hi');
      expect(i18n.language).toBe('hi');
      const hiVal = i18n.t(key, params);
      expect(hiVal).toBe(hi);
      expect(hiVal).toMatch(/[\u0900-\u097F]/);
      expect(hiVal).not.toBe(en);

      // Back to English — strings restored
      await i18n.changeLanguage('en');
      expect(i18n.language).toBe('en');
      expect(i18n.t(key, params)).toBe(en);
    },
  );

  it('changeLanguage is async-awaited so language is immediately effective', async () => {
    await i18n.changeLanguage('hi');
    expect(i18n.language).toBe('hi');
    await i18n.changeLanguage('en');
    expect(i18n.language).toBe('en');
  });

  it('toggleLanguage switches hi → en (helper parity)', async () => {
    await i18n.changeLanguage('hi');
    toggleLanguage();
    // changeLanguage is async; allow the event loop to settle
    await new Promise(r => setTimeout(r, 0));
    expect(i18n.language).toBe('en');
  });
});

describe('i18n language toggle — component render', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('PortfolioHolding renders English labels, then Hindi after toggle, then English back', async () => {
    // ── English ──
    const rEn = render(<PortfolioHolding holding={holding} />);
    expect(rEn.queryByText('Avg Cost')).not.toBeNull();
    expect(rEn.queryByText('औसत लागत')).toBeNull();
    rEn.unmount();

    // ── Switch to Hindi ──
    await i18n.changeLanguage('hi');
    const rHi = render(<PortfolioHolding holding={holding} />);
    expect(rHi.queryByText('औसत लागत')).not.toBeNull();
    expect(rHi.queryByText('Avg Cost')).toBeNull();
    rHi.unmount();

    // ── Switch back to English ──
    await i18n.changeLanguage('en');
    const rEn2 = render(<PortfolioHolding holding={holding} />);
    expect(rEn2.queryByText('Avg Cost')).not.toBeNull();
    expect(rEn2.queryByText('औसत लागत')).toBeNull();
    rEn2.unmount();
  });
});
