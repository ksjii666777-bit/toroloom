/**
 * ============================================================================
 * Toroloom — i18n Live Toggle Demo (browser)
 * ============================================================================
 *
 * Renders REAL Toroloom components (PortfolioHolding) against the REAL i18n
 * instance from src/i18n, plus a live grid of translated strings across
 * namespaces. A toggle button calls the real `toggleLanguage()` helper.
 *
 * How to verify:
 *   1. Page loads in English.
 *   2. Click "हिन्दी में देखें" → all strings flip to Hindi instantly.
 *   3. Click again → back to English.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import i18n, { toggleLanguage } from '../src/i18n';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import PortfolioHolding from '../src/components/PortfolioHolding';
import OfflineBanner from '../src/components/ui/OfflineBanner';
import PatternSummary from '../src/components/stock/PatternSummary';
import { PortfolioSkeleton, SkeletonList } from '../src/components/ui/SkeletonLoader';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useConnectivityStore } from '../src/store/connectivityStore';
import { configureApi } from '../src/services/api/client';
import { useT } from '../src/hooks/useT';
import type { Holding } from '../src/types';
import type { DetectedPattern } from '../src/components/chart/patternDetection';

// Point the API client at a dead endpoint so the real connectivity health-check
// fails → `combinedOffline` becomes true → OfflineBanner actually renders.
configureApi({ baseUrl: 'http://127.0.0.1:59999/api' });

const positiveHolding: Holding = {
  id: 'h1',
  stockId: 'RELIANCE',
  symbol: 'RELIANCE',
  name: 'Reliance Industries Ltd.',
  quantity: 50,
  buyPrice: 2650.0,
  currentPrice: 2890.5,
  totalInvested: 132500,
  currentValue: 144525,
  pnl: 12025,
  pnlPercent: 9.08,
  dayChange: 2260,
  dayChangePercent: 1.59,
};

const negativeHolding: Holding = {
  id: 'h2',
  stockId: 'TCS',
  symbol: 'TCS',
  name: 'Tata Consultancy Services',
  quantity: 20,
  buyPrice: 3800.0,
  currentPrice: 3650.0,
  totalInvested: 76000,
  currentValue: 73000,
  pnl: -3000,
  pnlPercent: -3.95,
  dayChange: -150,
  dayChangePercent: -0.41,
};

/** Confirmed en/hi keys across 16 namespaces (all verified against locales). */
const SAMPLES: string[] = [
  'trading.buy',
  'trading.placeOrder',
  'education.title',
  'education.quiz',
  'kyc.title',
  'funds.title',
  'ipos.applyTitle',
  'charts.noChartData',
  'community.title',
  'sentimentAlerts.title',
  'subscriptionAnalytics.title',
  'help.title',
  'adminCourseReview.title',
  'capitalGains.title',
  'calculators.sip',
  'watchlist.title',
];

const INTERPOLATED: Array<[string, Record<string, number>]> = [
  ['time.daysLeft', { count: 3 }],
  ['components.stockAnalysis.shares', { count: 50 }],
];

const demoPatterns: DetectedPattern[] = [
  {
    type: 'head_and_shoulders',
    label: 'Head & Shoulders',
    startIndex: 0,
    endIndex: 20,
    confidence: 82,
    direction: 'bearish',
    levels: [{ x: 0, price: 100 }],
  },
  {
    type: 'double_bottom',
    label: 'Double Bottom',
    startIndex: 25,
    endIndex: 45,
    confidence: 74,
    direction: 'bullish',
    levels: [{ x: 25, price: 110 }],
  },
];

const isDevanagari = (s: string): boolean => /[\u0900-\u097F]/.test(s);

function LanguageBadge() {
  const { language } = useT();
  const lang = language || 'en';
  return (
    <span className={`badge ${lang === 'hi' ? 'hi' : 'en'}`} data-testid="lang-badge">
      {lang === 'hi' ? 'हिन्दी' : 'English'}
    </span>
  );
}

function DemoApp() {
  const { t } = useT();
  // REAL theme from the app's ThemeContext — toggleTheme() drives the zustand store.
  const { isDark, toggleTheme } = useTheme();

  // Flip the page shell CSS variables to match the app theme.
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  // Force re-render on languageChanged (react-i18next already triggers one via
  // useTranslation, this is a belt-and-suspenders listener for the badge).
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((x) => x + 1);
    i18n.on('languageChanged', bump);
    return () => {
      i18n.off('languageChanged', bump);
    };
  }, []);

  const current = i18n.language || 'en';

  return (
    <div>
      <header>
        <div className="logo">
          Toro<span>loom</span> · i18n Live Demo
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className={`badge ${isDark ? 'hi' : 'en'}`} data-testid="theme-badge">
            {t(isDark ? 'darkMode.dark' : 'darkMode.light')}
          </span>
          <button
            type="button"
            className="toggle-btn secondary"
            data-testid="theme-toggle"
            onClick={() => toggleTheme()}
          >
            {isDark ? '☀️ ' : '🌙 '}
            {t(isDark ? 'darkMode.light' : 'darkMode.dark')}
          </button>
          <LanguageBadge />
          <button
            type="button"
            className="toggle-btn"
            data-testid="lang-toggle"
            onClick={() => toggleLanguage()}
          >
            {current === 'hi' ? 'Switch to English' : 'हिन्दी में देखें'}
          </button>
        </div>
      </header>

      <div className="hint">
        <span>{current === 'hi' ? '🟢' : '🔵'}</span>
        <span data-testid="hint-text">
          {current === 'hi'
            ? 'अभी Hindi चालू है — नीचे सभी स्ट्रिंग्स Devanagari में हैं'
            : 'Currently English — click the button above to switch live'}
          <span style={{ color: 'var(--text-muted)' }}>
            {' '}· {t('darkMode.subtitle')}
          </span>
        </span>
      </div>

      <section>
        <h2>Real component render (PortfolioHolding, real useT)</h2>
        <div className="card" style={{ maxWidth: 420 }}>
          <PortfolioHolding holding={positiveHolding} />
          <PortfolioHolding holding={negativeHolding} />
        </div>
      </section>

      <section>
        <h2>More real components (OfflineBanner, PatternSummary, SkeletonLoader)</h2>
        <div className="card" style={{ position: 'relative', minHeight: 84, marginBottom: 12 }}>
          <OfflineBanner />
        </div>
        <div className="card">
          <PatternSummary patterns={demoPatterns} />
          <PortfolioSkeleton />
          <SkeletonList count={2} />
        </div>
      </section>

      <section>
        <h2>Strings across 16 namespaces — live</h2>
        <div className="grid">
          {SAMPLES.map((key) => {
            const val = t(key);
            const enVal = i18n.t(key, { lng: 'en' }) as string;
            return (
              <div className="cell" key={key}>
                <div className="key">{key}</div>
                <div className="val" data-key={key}>
                  <span className={isDevanagari(val) ? 'hi' : ''}>{val}</span>
                </div>
                <div className="key" style={{ marginTop: 6 }}>EN: {enVal}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2>{'Interpolated strings ({{count}})'}</h2>
        <div className="grid">
          {INTERPOLATED.map(([key, params]) => {
            const val = t(key, params);
            return (
              <div className="cell" key={key}>
                <div className="key">{key} count={params.count}</div>
                <div className="val" data-key={key}>
                  <span className={isDevanagari(val) ? 'hi' : ''}>{val}</span>
                </div>
                <div className="key" style={{ marginTop: 6 }}>EN: {i18n.t(key, { ...params, lng: 'en' })}</div>
              </div>
            );
          })}
        </div>
      </section>

      <p className="foot">
        Uses the real <code>src/i18n</code> instance ({' '}
        <code>i18next</code> + <code>react-i18next</code> ) and real components —
        no translation mocks.
      </p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <SafeAreaProvider>
    <ThemeProvider>
      <DemoApp />
    </ThemeProvider>
  </SafeAreaProvider>
);
