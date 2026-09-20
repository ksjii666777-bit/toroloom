/**
 * ============================================================================
 * Toroloom — Geo-Pricing Service Tests
 * ============================================================================
 *
 * Pure unit tests for the global pricing price book:
 *   - Timezone → region detection (IN / EU / US / fallback)
 *   - Price book integrity: India figures match SUBSCRIPTION_PLANS exactly,
 *     US/EU books have their own deliberate price points
 *   - Deterministic formatting (₹/$/€ with grouping)
 *   - Yearly savings math + effective-region resolution
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  detectRegion,
  getRegionalPrice,
  getPrice,
  formatRegionalPrice,
  yearlySavingsPct,
  effectiveRegion,
  REGION_META,
  DEFAULT_REGION,
} from '../services/pricing/geoPricing';
import { SUBSCRIPTION_PLANS } from '../store/subscriptionStore';

describe('detectRegion — timezone → region', () => {
  it('maps Indian timezones to the India region', () => {
    expect(detectRegion('Asia/Kolkata')).toBe('in');
    expect(detectRegion('Asia/Calcutta')).toBe('in');
  });

  it('maps European timezones to the EU region', () => {
    expect(detectRegion('Europe/London')).toBe('eu');
    expect(detectRegion('Europe/Berlin')).toBe('eu');
  });

  it('maps American timezones to the US region', () => {
    expect(detectRegion('America/New_York')).toBe('us');
    expect(detectRegion('America/Los_Angeles')).toBe('us');
    expect(detectRegion('US/Pacific')).toBe('us');
  });

  it('falls back to India for unknown or missing timezones', () => {
    expect(detectRegion('Asia/Tokyo')).toBe(DEFAULT_REGION);
    expect(detectRegion(null)).toBe(DEFAULT_REGION);
    expect(detectRegion('')).toBe(DEFAULT_REGION);
    expect(detectRegion('   ')).toBe(DEFAULT_REGION);
  });
});

describe('price book', () => {
  it('keeps India prices in sync with SUBSCRIPTION_PLANS (the charging source of truth)', () => {
    for (const plan of SUBSCRIPTION_PLANS) {
      const p = getRegionalPrice(plan.id, 'in');
      expect(p.monthly).toBe(plan.price);
      expect(p.yearly).toBe(plan.priceYearly);
    }
  });

  it('prices Pro at a globally competitive point ($29/mo, like TraderSync — not TradeZella\'s $39)', () => {
    expect(getPrice('plan_pro', 'us', 'monthly')).toBe(29);
    expect(getPrice('plan_pro', 'eu', 'monthly')).toBe(29);
    expect(getPrice('plan_pro', 'us', 'yearly')).toBe(290);
  });

  it('prices Elite at $79/mo (top of the journal-tool range, still below TradingView Pro+ stack)', () => {
    expect(getPrice('plan_elite', 'us', 'monthly')).toBe(79);
    expect(getPrice('plan_elite', 'eu', 'monthly')).toBe(79);
  });

  it('gives every region a zero-price Free tier', () => {
    for (const region of ['in', 'us', 'eu'] as const) {
      expect(getPrice('plan_free', region, 'monthly')).toBe(0);
      expect(getPrice('plan_free', region, 'yearly')).toBe(0);
    }
  });
});

describe('formatRegionalPrice', () => {
  it('formats INR with the rupee symbol and thousands grouping', () => {
    expect(formatRegionalPrice(399, 'in')).toBe('₹399');
    expect(formatRegionalPrice(3999, 'in')).toBe('₹3,999');
    expect(formatRegionalPrice(9999, 'in')).toBe('₹9,999');
  });

  it('formats USD and EUR with their own symbols', () => {
    expect(formatRegionalPrice(29, 'us')).toBe('$29');
    expect(formatRegionalPrice(290, 'us')).toBe('$290');
    expect(formatRegionalPrice(79, 'eu')).toBe('€79');
  });

  it('formats zero without decimals', () => {
    expect(formatRegionalPrice(0, 'eu')).toBe('€0');
  });
});

describe('yearlySavingsPct', () => {
  it('computes the ~2-months-free saving for paid plans', () => {
    // Pro IN: 12 × 399 = 4788 vs 3999 → (789 / 4788) ≈ 16.5% → 16
    expect(yearlySavingsPct('plan_pro', 'in')).toBe(16);
    // Pro US: 12 × 29 = 348 vs 290 → (58 / 348) ≈ 16.7% → 17
    expect(yearlySavingsPct('plan_pro', 'us')).toBe(17);
  });

  it('returns 0 for the free tier', () => {
    expect(yearlySavingsPct('plan_free', 'in')).toBe(0);
    expect(yearlySavingsPct('plan_free', 'us')).toBe(0);
  });
});

describe('effectiveRegion', () => {
  it('override wins over detection', () => {
    expect(effectiveRegion('eu', 'in')).toBe('eu');
  });

  it('falls back to detection, then to the India default', () => {
    expect(effectiveRegion(null, 'us')).toBe('us');
    expect(effectiveRegion(null, null)).toBe('in');
  });
});

describe('REGION_META', () => {
  it('routes India through Razorpay and keeps US/EU on the waitlist rail', () => {
    expect(REGION_META.in.payment).toBe('razorpay');
    expect(REGION_META.us.payment).toBe('stripe-coming-soon');
    expect(REGION_META.eu.payment).toBe('stripe-coming-soon');
  });
});
