import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import i18n from '../i18n';

// Regression test — locks Hindi rendering of units/relative-time strings used by
// CurrencyMarketsScreen + MonteCarloSimulationScreen after language toggle.

const CURRENCY_KEYS = [
  'currencyMarkets.title',
  'currencyMarkets.subtitle',
  'currencyMarkets.tabInrPairs',
  'currencyMarkets.tabCrosses',
  'currencyMarkets.filterAll',
  'currencyMarkets.pairCount',
  'currencyMarkets.avgInrChg',
  'currencyMarkets.avgVolatility',
  'currencyMarkets.week52Range',
  'currencyMarkets.converterTitle',
  'currencyMarkets.saveConversion',
  'currencyMarkets.volLabel',
  'currencyMarkets.live',
  'currencyMarkets.mock',
];

const MONTE_CARLO_KEYS = [
  'monteCarlo.title',
  'monteCarlo.portfolioParams',
  'monteCarlo.initialInvestment',
  'monteCarlo.monthlySip',
  'monteCarlo.expectedReturn',
  'monteCarlo.volatility',
  'monteCarlo.timeHorizon',
  'monteCarlo.conservative',
  'monteCarlo.moderate',
  'monteCarlo.aggressive',
  'monteCarlo.runSimulation',
  'monteCarlo.years',
  'monteCarlo.medianValue',
  'monteCarlo.bestCase',
  'monteCarlo.worstCase',
];

const RELATIVE_TIME_KEYS = [
  'time.justNow',
  'time.minutesAgo',
  'time.hoursAgo',
  'time.daysAgo',
  'time.weeksAgo',
  'time.monthsAgo',
  'time.daysLeft',
  'time.monthsLeft',
  'time.never',
  'time.noExpiry',
  'time.expired',
];

const UNIT_KEYS = ['app.shares', 'app.stocks', 'app.trades', 'app.years', 'app.months', 'app.perShare'];

describe('Hi locale render — CurrencyMarkets + MonteCarlo', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('hi');
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('language is hi', () => {
    expect(i18n.language).toBe('hi');
  });

  it.each(CURRENCY_KEYS)('%s renders Devanagari', (key) => {
    const val = i18n.t(key, { count: 5, vol: 1.2 });
    expect(val).toMatch(/[\u0900-\u097F]/);
    expect(val).not.toBe(key);
  });

  it.each(MONTE_CARLO_KEYS)('%s renders Devanagari', (key) => {
    const val = i18n.t(key, { count: 5 });
    expect(val).toMatch(/[\u0900-\u097F]/);
    expect(val).not.toBe(key);
  });

  it.each(RELATIVE_TIME_KEYS)('%s renders Devanagari', (key) => {
    const val = i18n.t(key, { count: 6 });
    expect(val).toMatch(/[\u0900-\u097F]/);
    expect(val).not.toBe(key);
  });

  it.each(UNIT_KEYS)('%s renders Devanagari', (key) => {
    const val = i18n.t(key, { count: 5 });
    expect(val).toMatch(/[\u0900-\u097F]/);
    expect(val).not.toBe(key);
  });

  // Interpolation checks for the exact strings the screens render
  it('MonteCarlo years unit renders Hindi', () => {
    expect(i18n.t('monteCarlo.years')).toBe('वर्ष');
  });
  it('pairCount plural renders Hindi जोड़े', () => {
    expect(i18n.t('currencyMarkets.pairCount', { count: 5 })).toBe('5 जोड़े');
  });
  it('app.shares 5 renders Hindi', () => {
    expect(i18n.t('app.shares', { count: 5 })).toBe('5 शेयर');
  });
});
