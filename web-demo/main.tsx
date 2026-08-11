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
import ReportHeader from '../src/components/ReportHeader';
import SectorMetricsCard from '../src/components/SectorMetricsCard';
import StockItem from '../src/components/StockItem';
import TaxSummaryCard, { type TaxSummaryData } from '../src/components/TaxSummaryCard';
import SIPCalculator from '../src/screens/calculators/SIPCalculator';
import EMICalculator from '../src/screens/calculators/EMICalculator';
import LumpsumCalculator from '../src/screens/calculators/LumpsumCalculator';
import TaxCalculator from '../src/screens/calculators/TaxCalculator';
import StepUpSipScreen from '../src/screens/calculators/StepUpSipScreen';
import CurrencyConverterScreen from '../src/screens/calculators/CurrencyConverterScreen';
import LightweightChartDemo from './LightweightChartDemo';
import TradingViewWidgetDemo from './TradingViewWidgetDemo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureApi } from '../src/services/api/client';
import { useThemeStore } from '../src/store/themeStore';
import { useT } from '../src/hooks/useT';
import type { Holding, Stock } from '../src/types';
import type { SectorMetrics } from '../src/utils/analytics/periodAnalytics';
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

/** Demo watchlist/screener rows for StockItem. */
const demoStocks: Stock[] = [
  {
    id: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.',
    sector: 'Energy', price: 2890.5, change: 45.2, changePercent: 1.59,
    isPositive: true, marketCap: '₹19.6L Cr', volume: '2.1M',
    high52: 3200, low52: 2200, pe: 28.4, pb: 3.1, dividend: 0.35,
  },
  {
    id: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services',
    sector: 'IT', price: 3650, change: -15.1, changePercent: -0.41,
    isPositive: false, marketCap: '₹13.2L Cr', volume: '1.2M',
    high52: 4200, low52: 3000, pe: 31.2, pb: 15.8, dividend: 1.4,
  },
  {
    id: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.',
    sector: 'Banking', price: 1680.2, change: 22.4, changePercent: 1.35,
    isPositive: true, marketCap: '₹12.8L Cr', volume: '3.4M',
    high52: 1790, low52: 1360, pe: 19.6, pb: 2.8, dividend: 0.6,
  },
  {
    id: 'INFY', symbol: 'INFY', name: 'Infosys Ltd.',
    sector: 'IT', price: 1520.4, change: 11.8, changePercent: 0.78,
    isPositive: true, marketCap: '₹6.3L Cr', volume: '4.8M',
    high52: 1750, low52: 1210, pe: 24.1, pb: 6.4, dividend: 2.1,
  },
  {
    id: 'ITC', symbol: 'ITC', name: 'ITC Ltd.',
    sector: 'FMCG', price: 442.6, change: -2.3, changePercent: -0.52,
    isPositive: false, marketCap: '₹5.5L Cr', volume: '6.2M',
    high52: 499, low52: 399, pe: 25.7, pb: 7.2, dividend: 3.8,
  },
  {
    id: 'SBIN', symbol: 'SBIN', name: 'State Bank of India',
    sector: 'Banking', price: 812.4, change: 9.6, changePercent: 1.19,
    isPositive: true, marketCap: '₹7.2L Cr', volume: '9.1M',
    high52: 920, low52: 540, pe: 10.2, pb: 1.6, dividend: 2.4,
  },
];

/** Demo tax breakdown for TaxSummaryCard (STCG + LTCG). */
const demoTaxData: TaxSummaryData = {
  shortTerm: { gains: 82500, estimatedTax: 12375 },
  longTerm: { gains: 145000, estimatedTax: 4500 },
  totalEstimatedTax: 16875,
};

/** Demo period-report sector metrics (IT profitable, Energy losing). */
const demoSectorMetrics: SectorMetrics[] = [
  {
    sector: 'IT',
    totalTrades: 5,
    totalWins: 4,
    totalLosses: 1,
    avgWin: 12500,
    avgLoss: -3200,
    profitFactor: 3.1,
    trades: [
      { id: 't1', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services', type: 'buy', quantity: 20, price: 3800, total: 12500, timestamp: '2026-07-18T09:45:00.000Z' },
      { id: 't2', stockId: 'INFY', symbol: 'INFY', name: 'Infosys Ltd.', type: 'sell', quantity: 10, price: 1850, total: 8400, timestamp: '2026-07-21T10:10:00.000Z' },
    ],
  },
  {
    sector: 'Energy',
    totalTrades: 3,
    totalWins: 1,
    totalLosses: 2,
    avgWin: 4800,
    avgLoss: -6100,
    profitFactor: 0.7,
    trades: [
      { id: 't3', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', type: 'sell', quantity: 10, price: 2820, total: -5100, timestamp: '2026-07-22T14:05:00.000Z' },
      { id: 't4', stockId: 'ONGC', symbol: 'ONGC', name: 'Oil & Natural Gas Corp', type: 'sell', quantity: 15, price: 285, total: 3450, timestamp: '2026-07-24T11:30:00.000Z' },
    ],
  },
];

/** Buy prices for the B-vs-S comparison inside expanded sector rows. */
const buyPrices = new Map<string, number>([
  ['TCS', 3800],
  ['RELIANCE', 2650],
]);

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
  const storeSetTheme = useThemeStore((s) => s.setTheme);

  // Optional URL overrides for scripted verification (avoids relying on clicks):
  //   ?lang=hi|en   pre-selects the language on load
  //   ?theme=dark|light  pre-selects the theme on load
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const lang = params.get('lang');
    const theme = params.get('theme');
    if (lang === 'hi' && (i18n.language || 'en') !== 'hi') void i18n.changeLanguage('hi');
    if (lang === 'en' && (i18n.language || 'en') !== 'en') void i18n.changeLanguage('en');
    if (theme === 'light' || theme === 'dark') storeSetTheme(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <h2>More real components (ReportHeader, SectorMetricsCard, WatchlistItem rows)</h2>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <ReportHeader
            navigation={{ goBack: () => {} }}
            hasAnalytics
            isExporting={false}
            onExport={() => {}}
          />
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          <SectorMetricsCard sectorMetrics={demoSectorMetrics} holdingsBuyPriceMap={buyPrices} />
        </div>
        <div className="card">
          {demoStocks.map((s) => (
            <StockItem key={s.id} stock={s} onPress={() => {}} />
          ))}
        </div>
      </section>

      <section>
        <h2>Data-heavy components (SIPCalculator, TaxSummaryCard, StockScreener results)</h2>

        {/* Real SIP calculator screen — full interactivity (inputs, presets, chart). */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', height: 760 }}>
          <SIPCalculator />
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <TaxSummaryCard cg={demoTaxData} />
        </div>

        {/* Stock screener results: real stockScreener.* keys + real StockItem rows. */}
        <div className="card">
          <div className="screener-head">
            <strong data-testid="screener-results">
              {t('stockScreener.results', { count: demoStocks.length })}
            </strong>
          </div>
          <div className="screener-cols">
            {['sortSymbol', 'sortPrice', 'sortChange', 'sortPE', 'sortDividend', 'sortMktCap'].map((k) => (
              <span key={k} className="screener-chip">
                {t(`stockScreener.${k}`)}
              </span>
            ))}
          </div>
          {demoStocks.map((s) => (
            <StockItem key={s.id} stock={s} onPress={() => {}} />
          ))}
        </div>
      </section>

      <section>
        <h2>More interactive calculators (EMI, Lumpsum, Tax, Step-Up SIP, Currency)</h2>
        <div className="calc-grid">
          <div className="card calc-card">
            <EMICalculator />
          </div>
          <div className="card calc-card">
            <LumpsumCalculator />
          </div>
        </div>
        <div className="card calc-card" style={{ marginTop: 12 }}>
          <TaxCalculator />
        </div>
        <div className="card calc-card" style={{ marginTop: 12 }}>
          <StepUpSipScreen />
        </div>
        <div className="card calc-card" style={{ marginTop: 12 }}>
          <CurrencyConverterScreen />
        </div>
      </section>

      <section>
        <h2>TradingView Lightweight Charts™ — candlestick + volume (theme-aware, live ticks)</h2>
        <LightweightChartDemo />
      </section>

      <section>
        <h2>TradingView Advanced Chart widget™ — REAL live market data (WebView-equivalent embed)</h2>
        <TradingViewWidgetDemo />
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
