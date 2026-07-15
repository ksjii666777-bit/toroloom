/**
 * ============================================================================
 * Toroloom — Sector Inference Utility
 * ============================================================================
 *
 * Shared utility for inferring company sector from name and symbol.
 * Used by correlationMatrix.ts, factorAnalysis.ts, and other services.
 *
 * ============================================================================
 */

/**
 * Infer the economic sector for a stock based on its name and symbol.
 * Returns a sector string that maps to the SECTOR_BASE_CORRELATION
 * and SECTOR_MOMENTUM / SECTOR_QUALITY / SECTOR_VOLATILITY tables.
 */
export function inferSector(name: string, symbol: string): string {
  const n = name.toLowerCase();
  const s = symbol.toLowerCase();
  if (s === 'reliance') return 'Energy';
  if (n.includes('bank') || n.includes('finance') || s.includes('hdfc') || s.includes('icici') || s.includes('sbin') || s.includes('bajaj')) return 'Finance';
  if (n.includes('tech') || n.includes('consultancy') || s.includes('tcs') || s.includes('infy') || s.includes('wipro')) return 'Technology';
  if (s.includes('bharti') || s.includes('airtel') || n.includes('telecom')) return 'Telecom';
  if (n.includes('consumer') || s.includes('hindunilvr') || s.includes('itc')) return 'Consumer';
  if (s.includes('tatamotor') || n.includes('auto')) return 'Automobile';
  if (n.includes('pharma') || n.includes('health') || s.includes('sunpharma') || s.includes('cipla') || s.includes('drmreddy')) return 'Pharma';
  return 'Others';
}

/**
 * Known market-cap bucket for well-known Indian stocks.
 * Uses a deterministic lookup based on symbol to avoid fragile string parsing.
 */
const KNOWN_MARKET_CAPS: Record<string, 'large' | 'mid' | 'small'> = {
  reliance:   'large',
  tcs:        'large',
  hdfcbank:   'large',
  icicibank:  'large',
  sbin:       'large',
  bhartiartl: 'large',
  itc:        'large',
  hindunilvr: 'large',
  infy:       'large',
  wipro:      'mid',
  tatamotors: 'mid',
  bajajfin:   'large',
  maruti:     'mid',
  sunpharma:  'mid',
  cipla:      'mid',
  drreddy:    'mid',
};

/**
 * Infer the market-cap bucket (large/mid/small) for a stock.
 * Uses known stocks where possible, falls back to mid-cap for unknown.
 */
export function inferMarketCapBucket(symbol: string): 'large' | 'mid' | 'small' {
  return KNOWN_MARKET_CAPS[symbol.toLowerCase()] || 'mid';
}
