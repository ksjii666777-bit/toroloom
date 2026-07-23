/**
 * ============================================================================
 * Toroloom — Currency Converter Engine
 * ============================================================================
 *
 * Pure utility functions for currency conversion, cross-rate calculation,
 * and compact formatting — extracted from CurrencyMarketsScreen.tsx for
 * testability and reuse.
 *
 * All 9 currencies derive their INR rates from the CURRENCY_PAIRS mock data
 * in CurrencyMarketsScreen.tsx. The converter uses INR as a bridge currency:
 *
 *   amount_in_target = (amount * from.inrRate) / to.inrRate
 *
 * ============================================================================
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  icon: string;
  color: string;
  inrRate: number;
  isPopular: boolean;
}

export interface RecentConversion {
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  timestamp: number;
}

// ── Currency Registry ────────────────────────────────────────────────────────

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'INR',  name: 'Indian Rupee',        symbol: '₹',  icon: '🇮🇳', color: '#FF9933',  inrRate: 1,      isPopular: true },
  { code: 'USD',  name: 'US Dollar',           symbol: '$',  icon: '💵', color: '#3B82F6',  inrRate: 83.45,  isPopular: true },
  { code: 'EUR',  name: 'Euro',                symbol: '€',  icon: '💶', color: '#0052CC',  inrRate: 90.78,  isPopular: true },
  { code: 'GBP',  name: 'British Pound',       symbol: '£',  icon: '💷', color: '#FF5252',  inrRate: 106.20, isPopular: true },
  { code: 'JPY',  name: 'Japanese Yen',        symbol: '¥',  icon: '💴', color: '#FFC107',  inrRate: 0.54,   isPopular: true },
  { code: 'SGD',  name: 'Singapore Dollar',    symbol: 'S$', icon: '🇸🇬', color: '#00E676',  inrRate: 61.80,  isPopular: true },
  { code: 'CNY',  name: 'Chinese Yuan',        symbol: '¥',  icon: '🇨🇳', color: '#FF6B6B',  inrRate: 11.52,  isPopular: true },
  { code: 'HKD',  name: 'Hong Kong Dollar',    symbol: 'HK$',icon: '🇭🇰', color: '#8B5CF6',  inrRate: 10.68,  isPopular: false },
  { code: 'THB',  name: 'Thai Baht',           symbol: '฿',  icon: '🇹🇭', color: '#06B6D4',  inrRate: 2.28,   isPopular: false },
];

// ── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Look up a currency by its 3-letter code.
 * Falls back to INR if the code is not found.
 */
export function getCurrency(code: string): CurrencyInfo {
  return CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0];
}

// ── Conversion ───────────────────────────────────────────────────────────────

/**
 * Convert an amount from one currency to another using INR as the bridge.
 *
 *   result = (amount * from.inrRate) / to.inrRate
 *
 * Returns 0 if either rate is 0 (should never happen with the static data).
 * Returns the original amount if fromCode === toCode.
 */
export function convertCurrency(amount: number, fromCode: string, toCode: string): number {
  if (fromCode === toCode) return amount;
  const from = getCurrency(fromCode);
  const to = getCurrency(toCode);
  if (from.inrRate === 0 || to.inrRate === 0) return 0;
  return (amount * from.inrRate) / to.inrRate;
}

// ── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format a currency amount in compact notation.
 *
 * Examples (INR = ₹):
 *   >= 1,000,000  → ₹1.50M
 *   >= 1,000      → ₹83.45K
 *   < 1 OR JPY    → ₹0.5400
 *   otherwise     → ₹83.45
 */
export function formatCurrencyAmount(value: number, code: string): string {
  const sym = getCurrency(code).symbol;
  if (value >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${sym}${(value / 1_000).toFixed(2)}K`;
  if (value === 0) return `${sym}0.00`;
  if (code === 'JPY' || value < 1) return `${sym}${value.toFixed(4)}`;
  return `${sym}${value.toFixed(2)}`;
}
