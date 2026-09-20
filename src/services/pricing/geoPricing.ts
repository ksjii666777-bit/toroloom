/**
 * ============================================================================
 * Toroloom — Geo-Pricing Service (pure, testable)
 * ============================================================================
 *
 * One price book, three regions. The same product is priced for the Indian
 * market (INR, Razorpay/UPI) and for the US / EU markets (USD/EUR, Stripe —
 * coming soon). Prices are NOT converted with a live FX rate: each region has
 * a deliberately chosen local price point calibrated to what comparable tools
 * charge there (TradingView India ≈ ₹1,295; TradeZella $39; TraderSync $29–79).
 *
 * Everything here is pure — the screen and tests share one deterministic
 * source of truth. Timezone-based detection keeps this free of native
 * modules (expo-localization is deliberately avoided in this app).
 * ============================================================================
 */

/** Regions with their own price book. */
export type PricingRegion = 'in' | 'us' | 'eu';

/** Billing period shown on the pricing page. */
export type BillingPeriod = 'monthly' | 'yearly';

export interface RegionMeta {
  /** i18n key suffix for the region name */
  nameKey: 'regionIndia' | 'regionUs' | 'regionEu';
  flag: string;
  currency: 'INR' | 'USD' | 'EUR';
  symbol: string;
  /** Which payment rail this region can actually check out through today */
  payment: 'razorpay' | 'stripe-coming-soon';
}

export const REGION_META: Record<PricingRegion, RegionMeta> = {
  in: { nameKey: 'regionIndia', flag: '🇮🇳', currency: 'INR', symbol: '₹', payment: 'razorpay' },
  us: { nameKey: 'regionUs', flag: '🇺🇸', currency: 'USD', symbol: '$', payment: 'stripe-coming-soon' },
  eu: { nameKey: 'regionEu', flag: '🇪🇺', currency: 'EUR', symbol: '€', payment: 'stripe-coming-soon' },
};

interface RegionalPrice {
  monthly: number;
  yearly: number;
}

/**
 * The price book. India figures MUST stay in sync with SUBSCRIPTION_PLANS
 * (plan_pro 399/3999, plan_elite 999/9999) — the store remains the source of
 * truth for what users are actually charged; this book mirrors it for display.
 */
export const GLOBAL_PRICE_BOOK: Record<string, Record<PricingRegion, RegionalPrice>> = {
  plan_free: {
    in: { monthly: 0, yearly: 0 },
    us: { monthly: 0, yearly: 0 },
    eu: { monthly: 0, yearly: 0 },
  },
  plan_pro: {
    in: { monthly: 399, yearly: 3999 },
    us: { monthly: 29, yearly: 290 },
    eu: { monthly: 29, yearly: 290 },
  },
  plan_elite: {
    in: { monthly: 999, yearly: 9999 },
    us: { monthly: 79, yearly: 790 },
    eu: { monthly: 79, yearly: 790 },
  },
};

/** Default when nothing else is known — India is the launch beachhead. */
export const DEFAULT_REGION: PricingRegion = 'in';

/**
 * Detect the pricing region from an IANA timezone string.
 *
 *   Asia/Kolkata, Asia/Calcutta  → 'in'
 *   Europe/*                     → 'eu'
 *   America/*, US/*              → 'us'
 *   anything else / null         → DEFAULT_REGION
 */
export function detectRegion(timezone: string | null | undefined): PricingRegion {
  if (!timezone) return DEFAULT_REGION;
  const tz = timezone.trim();
  if (/Asia\/(Kolkata|Calcutta)/i.test(tz)) return 'in';
  if (/^Europe\//i.test(tz)) return 'eu';
  if (/^(America\/|US\/)/i.test(tz)) return 'us';
  return DEFAULT_REGION;
}

/** Device timezone via Intl — returns null when the engine provides none. */
export function getDeviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export function getRegionalPrice(planId: string, region: PricingRegion): RegionalPrice {
  return GLOBAL_PRICE_BOOK[planId][region];
}

/** Price for a plan/region/billing combination. */
export function getPrice(planId: string, region: PricingRegion, billing: BillingPeriod): number {
  const p = getRegionalPrice(planId, region);
  return billing === 'yearly' ? p.yearly : p.monthly;
}

/** `₹3,999` / `$290` / `€0` — deterministic grouping, no Intl data dependency. */
export function formatRegionalPrice(amount: number, region: PricingRegion): string {
  const grouped = amount.toLocaleString('en-US');
  return `${REGION_META[region].symbol}${grouped}`;
}

/** Percent saved paying yearly vs 12 × monthly (0 when free or no saving). */
export function yearlySavingsPct(planId: string, region: PricingRegion): number {
  const { monthly, yearly } = getRegionalPrice(planId, region);
  if (monthly <= 0 || yearly <= 0) return 0;
  const full = monthly * 12;
  if (yearly >= full) return 0;
  return Math.round(((full - yearly) / full) * 100);
}

/** Effective region for display: explicit override wins, else detected, else default. */
export function effectiveRegion(
  override: PricingRegion | null,
  detected: PricingRegion | null,
): PricingRegion {
  return override ?? detected ?? DEFAULT_REGION;
}
