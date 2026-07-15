/**
 * ============================================================================
 * Toroloom — Options Greeks Calculator
 * ============================================================================
 *
 * Client-side Black-Scholes approximation for options Greeks.
 * Used by the StrategyBuilder to display per-leg and net strategy Greeks.
 *
 * Limitations:
 *   - Uses simplified BS model (European options, no dividends)
 *   - IV is back-calculated from premium if not provided
 *   - For F&O in India (weekly/monthly expiries, European-style), this is
 *     a reasonable approximation
 *
 * Usage:
 *   import { calculateLegGreeks, calculateNetGreeks } from '../../services/greeksCalculator';
 *
 * ============================================================================
 */

// ──── Types ────────────────────────────────────────────────────────────────

export interface LegGreeksInput {
  /** 'CE' | 'PE' */
  type: 'CE' | 'PE';
  /** 'buy' | 'sell' */
  action: 'buy' | 'sell';
  /** Strike price */
  strike: number;
  /** Premium (per unit) */
  premium: number;
  /** Days to expiry */
  daysToExpiry: number;
  /** Quantity (lots) */
  quantity: number;
  /** Lot size (default 50 for indices) */
  lotSize: number;
  /** Spot/underlying price */
  spotPrice: number;
  /** Implied Volatility (optional — estimated from premium if not provided) */
  iv?: number;
}

export interface LegGreeks {
  /** Option moneyness: ITM/ATM/OTM */
  moneyness: 'ITM' | 'ATM' | 'OTM';
  /** Delta: rate of change of option price wrt underlying */
  delta: number;
  /** Gamma: rate of change of delta wrt underlying */
  gamma: number;
  /** Theta: time decay per day (negative for long options) */
  theta: number;
  /** Vega: sensitivity to 1% change in IV */
  vega: number;
  /** Rho: sensitivity to 1% interest rate change */
  rho: number;
  /** IV used/estimated */
  iv: number;
}

export interface NetStrategyGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  /** Total margin required (estimate) */
  estimatedMargin: number;
}

// ──── Constants ────────────────────────────────────────────────────────────

const RISK_FREE_RATE = 0.065; // 6.5% — Indian benchmark
const DAYS_PER_YEAR = 365;

// ──── Normal CDF Approximation ─────────────────────────────────────────────

/**
 * Standard normal cumulative distribution function.
 * Uses the Abramowitz and Stegun approximation (error < 0.00025).
 */
function normCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1 + sign * y);
}

/**
 * Standard normal probability density function.
 */
function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ──── Black-Scholes Helpers ────────────────────────────────────────────────

function getD1D2(
  spotPrice: number,
  strike: number,
  timeToExpiry: number, // in years
  iv: number,
  riskFreeRate: number,
): { d1: number; d2: number } {
  if (timeToExpiry <= 0 || iv <= 0) {
    return { d1: 0, d2: 0 };
  }
  const d1 =
    (Math.log(spotPrice / strike) + (riskFreeRate + (iv * iv) / 2) * timeToExpiry) /
    (iv * Math.sqrt(timeToExpiry));
  const d2 = d1 - iv * Math.sqrt(timeToExpiry);
  return { d1, d2 };
}

/**
 * Estimate IV from option premium (Stael von Holstein approximation).
 * Falls back to 15% if calculation fails.
 */
function estimateIV(
  spotPrice: number,
  strike: number,
  premium: number,
  daysToExpiry: number,
  isCall: boolean,
): number {
  if (daysToExpiry <= 0 || spotPrice <= 0 || premium <= 0) return 0.15;

  const T = daysToExpiry / DAYS_PER_YEAR;
  const moneyness = spotPrice / strike;

  // Rough IV estimate based on premium/spot ratio
  const premiumRatio = premium / spotPrice;
  const timeFactor = Math.sqrt(T);

  // At-the-money options have approx: premium ≈ 0.4 * spot * IV * sqrt(T)
  // Rearranged: IV ≈ premium / (0.4 * spot * sqrt(T))
  let iv = premiumRatio / (0.4 * timeFactor);

  // Adjust for moneyness
  if (isCall) {
    if (moneyness > 1.1) iv *= 1.2; // ITM call
    else if (moneyness < 0.9) iv *= 0.8; // OTM call
  } else {
    if (moneyness < 0.9) iv *= 1.2; // ITM put
    else if (moneyness > 1.1) iv *= 0.8; // OTM put
  }

  // Clamp to reasonable range
  return Math.max(0.05, Math.min(1.0, iv));
}

// ──── Public API ───────────────────────────────────────────────────────────

/**
 * Calculate option Greeks for a single leg.
 */
export function calculateLegGreeks(input: LegGreeksInput): LegGreeks {
  const { type, action, strike, premium, daysToExpiry, quantity: _quantity, spotPrice, iv } = input;

  const T = Math.max(daysToExpiry, 1) / DAYS_PER_YEAR;
  const isCall = type === 'CE';

  // Use provided IV or estimate from premium
  const sigma = iv ?? estimateIV(spotPrice, strike, premium, daysToExpiry, isCall);

  const { d1, d2 } = getD1D2(spotPrice, strike, T, sigma, RISK_FREE_RATE);
  const nd1 = normCDF(d1);
  const nd2 = normCDF(d2);
  const pdfD1 = normPDF(d1);

  // Moneyness
  const ratio = spotPrice / strike;
  let moneyness: 'ITM' | 'ATM' | 'OTM';
  if (isCall) {
    moneyness = ratio > 1.02 ? 'ITM' : ratio < 0.98 ? 'OTM' : 'ATM';
  } else {
    moneyness = ratio < 0.98 ? 'ITM' : ratio > 1.02 ? 'OTM' : 'ATM';
  }

  // Delta
  let delta: number;
  if (isCall) {
    delta = nd1;
  } else {
    delta = nd1 - 1;
  }

  // Gamma (same for calls and puts)
  const gamma = pdfD1 / (spotPrice * sigma * Math.sqrt(T));

  // Theta (per day)
  const thetaTerm = -(spotPrice * pdfD1 * sigma) / (2 * Math.sqrt(T));
  const rTerm = isCall
    ? RISK_FREE_RATE * strike * Math.exp(-RISK_FREE_RATE * T) * nd2
    : -RISK_FREE_RATE * strike * Math.exp(-RISK_FREE_RATE * T) * (1 - nd2);
  const theta = (thetaTerm + rTerm) / DAYS_PER_YEAR; // per day

  // Vega (per 1% change in IV)
  const vega = (spotPrice * pdfD1 * Math.sqrt(T)) / 100; // per 1% IV change

  // Rho (per 1% change in interest rate)
  let rho: number;
  if (isCall) {
    rho = (strike * T * Math.exp(-RISK_FREE_RATE * T) * nd2) / 100;
  } else {
    rho = (-strike * T * Math.exp(-RISK_FREE_RATE * T) * (1 - nd2)) / 100;
  }

  // Apply sign for sell (opposite of buy)
  const sign = action === 'buy' ? 1 : -1;

  return {
    moneyness,
    delta: Math.round(delta * sign * 10000) / 10000,
    gamma: Math.round(gamma * sign * 1000000) / 1000000,
    theta: Math.round(theta * sign * 100) / 100,
    vega: Math.round(vega * sign * 100) / 100,
    rho: Math.round(rho * sign * 100) / 100,
    iv: Math.round(sigma * 10000) / 100,
  };
}

/**
 * Calculate net Greeks for a multi-leg strategy.
 */
export function calculateNetGreeks(
  legs: LegGreeksInput[],
): { net: NetStrategyGreeks; legGreeks: LegGreeks[] } {
  if (legs.length === 0) {
    return {
      net: { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, estimatedMargin: 0 },
      legGreeks: [],
    };
  }

  const legGreeks = legs.map(calculateLegGreeks);

  // Sum Greeks (they're already signed for buy/sell)
  const net = legGreeks.reduce(
    (acc, g) => ({
      delta: acc.delta + g.delta,
      gamma: acc.gamma + g.gamma,
      theta: acc.theta + g.theta,
      vega: acc.vega + g.vega,
      rho: acc.rho + g.rho,
    }),
    { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 },
  );

  // Estimate margin (simplified: sum of absolute premium values * lot size * quantity * 20%)
  const estimatedMargin = legs.reduce((acc, leg) => {
    const premiumValue = leg.premium * leg.lotSize * leg.quantity;
    // Margin is roughly 15-25% of notional for options
    const notional = leg.spotPrice * leg.lotSize * leg.quantity;
    return acc + Math.max(premiumValue, notional * 0.15);
  }, 0);

  return {
    net: {
      ...net,
      estimatedMargin: Math.round(estimatedMargin),
    },
    legGreeks,
  };
}

/**
 * Generate theta decay data points for a time-decay visualization.
 * Returns predicted theta values for each remaining day to expiry.
 */
export function generateThetaDecay(
  theta: number,
  daysToExpiry: number,
): { day: number; theta: number }[] {
  if (daysToExpiry <= 0) return [];
  const points: { day: number; theta: number }[] = [];
  // Theta accelerates near expiry — model with sqrt decay
  for (let d = daysToExpiry; d >= 0; d--) {
    const decayFactor = daysToExpiry > 0 ? Math.sqrt(d / daysToExpiry) : 1;
    points.push({
      day: daysToExpiry - d,
      theta: Math.round(theta * decayFactor * 100) / 100,
    });
  }
  return points;
}
