/**
 * ============================================================================
 * Toroloom — Currency Converter Engine Tests
 * ============================================================================
 *
 * Pure-function tests for the currency conversion engine extracted to
 * src/utils/currencyConverter.ts.
 *
 * Test groups:
 *   1. getCurrency      — lookup + fallback
 *   2. convertCurrency   — direct, cross-rate, same-code, edge cases
 *   3. formatCurrencyAmount — compact formatting for all thresholds
 *   4. CURRENCIES        — data integrity (rates match CURRENCY_PAIRS)
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  CURRENCIES,
  getCurrency,
  convertCurrency,
  formatCurrencyAmount,
} from '../utils/currencyConverter';

// ═══════════════════════════════════════════════════════════════
// getCurrency
// ═══════════════════════════════════════════════════════════════

describe('getCurrency', () => {
  it('returns the correct currency for a known code', () => {
    const usd = getCurrency('USD');
    expect(usd).toBeDefined();
    expect(usd.code).toBe('USD');
    expect(usd.name).toBe('US Dollar');
    expect(usd.symbol).toBe('$');
    expect(usd.icon).toBe('💵');
    expect(usd.color).toBe('#3B82F6');
  });

  it('returns INR for INR code', () => {
    const inr = getCurrency('INR');
    expect(inr.code).toBe('INR');
    expect(inr.inrRate).toBe(1);
  });

  it('returns JPY with correct rate < 1', () => {
    const jpy = getCurrency('JPY');
    expect(jpy.code).toBe('JPY');
    expect(jpy.inrRate).toBe(0.54);
    expect(jpy.isPopular).toBe(true);
  });

  it('returns GBP with correct rate', () => {
    const gbp = getCurrency('GBP');
    expect(gbp.code).toBe('GBP');
    expect(gbp.inrRate).toBe(106.20);
  });

  it('returns INR as fallback for unknown code', () => {
    const unknown = getCurrency('XYZ');
    expect(unknown.code).toBe('INR');
    expect(unknown.inrRate).toBe(1);
  });

  it('is case-sensitive — returns fallback for lowercase code', () => {
    const lower = getCurrency('usd');
    expect(lower.code).toBe('INR');
  });
});

// ═══════════════════════════════════════════════════════════════
// convertCurrency
// ═══════════════════════════════════════════════════════════════

describe('convertCurrency', () => {
  // ── Base pair conversions (direct INR-linked) ──
  it('converts USD to INR correctly', () => {
    // 1 USD * 83.45 / 1.0 = 83.45 INR
    expect(convertCurrency(1, 'USD', 'INR')).toBeCloseTo(83.45, 2);
  });

  it('converts INR to USD correctly', () => {
    // 83.45 INR * 1.0 / 83.45 = 1 USD
    expect(convertCurrency(83.45, 'INR', 'USD')).toBeCloseTo(1, 2);
  });

  it('converts EUR to INR correctly', () => {
    // 1 EUR * 90.78 / 1.0 = 90.78 INR
    expect(convertCurrency(1, 'EUR', 'INR')).toBeCloseTo(90.78, 2);
  });

  it('converts GBP to INR correctly', () => {
    expect(convertCurrency(1, 'GBP', 'INR')).toBeCloseTo(106.20, 2);
  });

  it('converts JPY to INR correctly', () => {
    expect(convertCurrency(1, 'JPY', 'INR')).toBeCloseTo(0.54, 2);
  });

  it('converts SGD to INR correctly', () => {
    expect(convertCurrency(1, 'SGD', 'INR')).toBeCloseTo(61.80, 2);
  });

  it('converts CNY to INR correctly', () => {
    expect(convertCurrency(1, 'CNY', 'INR')).toBeCloseTo(11.52, 2);
  });

  it('converts HKD to INR correctly', () => {
    expect(convertCurrency(1, 'HKD', 'INR')).toBeCloseTo(10.68, 2);
  });

  it('converts THB to INR correctly', () => {
    expect(convertCurrency(1, 'THB', 'INR')).toBeCloseTo(2.28, 2);
  });

  // ── Cross-rate conversions ──
  it('converts EUR to USD using INR bridge', () => {
    // 1 EUR → INR: 90.78, then INR → USD: 90.78 / 83.45 = 1.0876
    const result = convertCurrency(1, 'EUR', 'USD');
    expect(result).toBeCloseTo(1.0876, 3);
  });

  it('converts USD to EUR using INR bridge', () => {
    // 1 USD → INR: 83.45, then INR → EUR: 83.45 / 90.78 = 0.9192
    const result = convertCurrency(1, 'USD', 'EUR');
    expect(result).toBeCloseTo(0.9192, 3);
  });

  it('converts GBP to USD using INR bridge', () => {
    // 1 GBP → INR: 106.20, then INR → USD: 106.20 / 83.45 = 1.2726
    const result = convertCurrency(1, 'GBP', 'USD');
    expect(result).toBeCloseTo(1.2726, 3);
  });

  it('converts SGD to JPY using INR bridge', () => {
    // 1 SGD → INR: 61.80, then INR → JPY: 61.80 / 0.54 = 114.444
    const result = convertCurrency(1, 'SGD', 'JPY');
    expect(result).toBeCloseTo(114.44, 1);
  });

  it('converts THB to GBP using INR bridge', () => {
    // 1 THB → INR: 2.28, then INR → GBP: 2.28 / 106.20 = 0.02147
    const result = convertCurrency(1, 'THB', 'GBP');
    expect(result).toBeCloseTo(0.02147, 4);
  });

  // ── Same-code ──
  it('returns the same amount when from === to', () => {
    expect(convertCurrency(500, 'USD', 'USD')).toBe(500);
    expect(convertCurrency(0, 'INR', 'INR')).toBe(0);
  });

  // ── Non-trivial amounts ──
  it('converts large amounts correctly', () => {
    // 10,000 USD → INR = 10,000 * 83.45 = 834,500
    expect(convertCurrency(10000, 'USD', 'INR')).toBeCloseTo(834500, 0);
  });

  it('converts small fractional amounts', () => {
    // 0.01 BTC hypothetical → just test precision
    expect(convertCurrency(0.01, 'USD', 'INR')).toBeCloseTo(0.8345, 4);
  });

  // ── Round-trip ──
  it('round-trips through INR correctly', () => {
    const original = 1000;
    const toInr = convertCurrency(original, 'EUR', 'INR');
    const back = convertCurrency(toInr, 'INR', 'EUR');
    expect(back).toBeCloseTo(original, 2);
  });

  it('round-trips through a cross rate', () => {
    const original = 500;
    const toGbp = convertCurrency(original, 'USD', 'GBP');
    const back = convertCurrency(toGbp, 'GBP', 'USD');
    expect(back).toBeCloseTo(original, 2);
  });

  // ── Zero / edge cases ──
  it('returns 0 for zero amount', () => {
    expect(convertCurrency(0, 'USD', 'INR')).toBe(0);
  });

  it('handles negative amounts correctly', () => {
    expect(convertCurrency(-100, 'USD', 'INR')).toBeCloseTo(-8345, 0);
    expect(convertCurrency(-50, 'EUR', 'GBP')).toBeLessThan(0);
  });

  it('returns 0 for zero amount regardless of currencies', () => {
    expect(convertCurrency(0, 'USD', 'EUR')).toBe(0);
    expect(convertCurrency(0, 'GBP', 'JPY')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// formatCurrencyAmount
// ═══════════════════════════════════════════════════════════════

describe('formatCurrencyAmount', () => {
  // ── M (millions) threshold ──
  it('formats values >= 1,000,000 as M', () => {
    expect(formatCurrencyAmount(1_500_000, 'USD')).toBe('$1.50M');
    expect(formatCurrencyAmount(10_000_000, 'EUR')).toBe('€10.00M');
    expect(formatCurrencyAmount(2_250_000, 'INR')).toBe('₹2.25M');
  });

  // ── K (thousands) threshold ──
  it('formats values >= 1,000 as K', () => {
    expect(formatCurrencyAmount(83_450, 'USD')).toBe('$83.45K');
    expect(formatCurrencyAmount(1_000, 'EUR')).toBe('€1.00K');
    expect(formatCurrencyAmount(5_500, 'INR')).toBe('₹5.50K');
  });

  it('formats exactly 1,000 as 1.00K', () => {
    expect(formatCurrencyAmount(1000, 'GBP')).toBe('£1.00K');
  });

  // ── JPY special handling ──
  it('formats JPY with 4 decimal places regardless of value', () => {
    expect(formatCurrencyAmount(100, 'JPY')).toBe('¥100.0000');
    expect(formatCurrencyAmount(1, 'JPY')).toBe('¥1.0000');
    expect(formatCurrencyAmount(0.54, 'JPY')).toBe('¥0.5400');
  });

  // ── Small values (< 1) ──
  it('formats values < 1 with 4 decimal places', () => {
    expect(formatCurrencyAmount(0.5, 'USD')).toBe('$0.5000');
    expect(formatCurrencyAmount(0.0123, 'EUR')).toBe('€0.0123');
  });

  // ── Standard values ──
  it('formats standard values with 2 decimal places', () => {
    expect(formatCurrencyAmount(83.45, 'USD')).toBe('$83.45');
    expect(formatCurrencyAmount(99.99, 'EUR')).toBe('€99.99');
    expect(formatCurrencyAmount(1, 'INR')).toBe('₹1.00');
  });

  it('formats zero correctly', () => {
    expect(formatCurrencyAmount(0, 'USD')).toBe('$0.00');
  });

  // ── HKD symbol ──
  it('uses HK$ symbol for HKD', () => {
    expect(formatCurrencyAmount(100, 'HKD')).toBe('HK$100.00');
  });
});

// ═══════════════════════════════════════════════════════════════
// CURRENCIES — Data Integrity
// ═══════════════════════════════════════════════════════════════

describe('CURRENCIES data integrity', () => {
  it('has exactly 9 currencies', () => {
    expect(CURRENCIES).toHaveLength(9);
  });

  it('contains all expected currency codes', () => {
    const codes = CURRENCIES.map(c => c.code).sort();
    expect(codes).toEqual(['CNY', 'EUR', 'GBP', 'HKD', 'INR', 'JPY', 'SGD', 'THB', 'USD']);
  });

  it('INR has rate of exactly 1', () => {
    const inr = CURRENCIES.find(c => c.code === 'INR');
    expect(inr?.inrRate).toBe(1);
  });

  it('all currencies have non-zero rates', () => {
    for (const c of CURRENCIES) {
      expect(c.inrRate).toBeGreaterThan(0);
    }
  });

  it('all currencies have required fields defined', () => {
    for (const c of CURRENCIES) {
      expect(c.code).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.symbol).toBeTruthy();
      expect(c.icon).toBeTruthy();
      expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(typeof c.isPopular).toBe('boolean');
    }
  });

  it('has at least one non-popular currency', () => {
    const nonPopular = CURRENCIES.filter(c => !c.isPopular);
    expect(nonPopular.length).toBeGreaterThan(0);
  });

  it('returns the same getCurrency result as direct array access for known codes', () => {
    for (const c of CURRENCIES) {
      expect(getCurrency(c.code)).toBe(c);
    }
  });
});
