/**
 * ============================================================================
 * Bond Service — Mock Data (future API integration ready)
 * ============================================================================
 *
 * Provides bond market data for the Bond Dashboard screen.
 *
 * Currently uses realistic mock data. Designed with the same service pattern
 * as forexService and commodityService so a live API can be dropped in.
 *
 * Future API options (when available):
 *   - FRED API (fred.stlouisfed.org) — US Treasury yields
 *   - RBI CCIL (ccilindia.com) — Indian G-Sec benchmark yields
 *   - World Bank API — Global bond indices
 *   - Yahoo Finance YQL — Corporate bond prices
 *
 * Usage:
 *   import { bondService, isBondApiConfigured } from '../services/bondService';
 *   const data = await bondService.getAll();
 *
 * ============================================================================
 */

import https from 'https';
import http from 'http';
import { marketCache, CACHE_TTL } from './cache';

const TIMEOUT_MS = 8_000;

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type BondCategory = 'government' | 'corporate' | 'state' | 'municipal';
export type BondRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC';

export interface BondData {
  id: string;
  name: string;
  issuer: string;
  category: BondCategory;
  couponRate: number;
  yieldToMaturity: number;
  maturityDate: string;
  yearsToMaturity: number;
  faceValue: number;
  currentPrice: number;
  rating: BondRating;
  isTaxable: boolean;
  isListed: boolean;
  issueSize: number;
  yieldChangeBps: number;
  sector?: string;
  description: string;
}

export interface TreasuryYield {
  maturity: string;
  maturityYears: number;
  yield: number;
  change_bps: number;
}

export interface BondSummary {
  total: number;
  government: { count: number; avgYTM: number; avgCoupon: number };
  corporate: { count: number; avgYTM: number; avgCoupon: number };
  state: { count: number; avgYTM: number; avgCoupon: number };
  yieldCurve: Array<{ label: string; count: number; avgYield: number; avgCoupon: number }>;
  treasury?: {
    yields: TreasuryYield[];
    corpSpread: number;
    source: 'fred' | 'mock';
  };
  updatedAt: string;
}

// FRED series IDs for US Treasury yields
const FRED_SERIES: Array<{ seriesId: string; maturity: string; maturityYears: number }> = [
  { seriesId: 'DGS3MO', maturity: '3 Month', maturityYears: 0.25 },
  { seriesId: 'DGS6MO', maturity: '6 Month', maturityYears: 0.5 },
  { seriesId: 'DGS1', maturity: '1 Year', maturityYears: 1 },
  { seriesId: 'DGS2', maturity: '2 Year', maturityYears: 2 },
  { seriesId: 'DGS3', maturity: '3 Year', maturityYears: 3 },
  { seriesId: 'DGS5', maturity: '5 Year', maturityYears: 5 },
  { seriesId: 'DGS7', maturity: '7 Year', maturityYears: 7 },
  { seriesId: 'DGS10', maturity: '10 Year', maturityYears: 10 },
  { seriesId: 'DGS20', maturity: '20 Year', maturityYears: 20 },
  { seriesId: 'DGS30', maturity: '30 Year', maturityYears: 30 },
];

// FRED series for corporate bond indices
const FRED_CORP_SERIES = {
  baa: 'BAA10Y',
  aaa: 'AAA10Y',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Data (fallback / default)
// ═══════════════════════════════════════════════════════════════════════════════

const MOCK_BONDS: BondData[] = [
  // Government Bonds (G-Secs)
  { id: 'bond_govt_1', name: '7.18% GS 2033', issuer: 'Government of India', category: 'government', couponRate: 7.18, yieldToMaturity: 7.05, maturityDate: '2033-09-15', yearsToMaturity: 7.2, faceValue: 100, currentPrice: 101.25, rating: 'AAA', isTaxable: true, isListed: true, issueSize: 32000, yieldChangeBps: -3, description: 'Benchmark 7-year government security. Most liquid G-Sec in the 5-10 year segment.' },
  { id: 'bond_govt_2', name: '7.37% GS 2038', issuer: 'Government of India', category: 'government', couponRate: 7.37, yieldToMaturity: 7.12, maturityDate: '2038-04-22', yearsToMaturity: 11.8, faceValue: 100, currentPrice: 103.50, rating: 'AAA', isTaxable: true, isListed: true, issueSize: 28000, yieldChangeBps: -5, description: 'Long-term benchmark G-Sec. Attractive for pension and insurance funds seeking duration.' },
  { id: 'bond_govt_3', name: '6.99% GS 2026', issuer: 'Government of India', category: 'government', couponRate: 6.99, yieldToMaturity: 6.82, maturityDate: '2026-12-18', yearsToMaturity: 0.4, faceValue: 100, currentPrice: 100.85, rating: 'AAA', isTaxable: true, isListed: true, issueSize: 25000, yieldChangeBps: 2, description: 'Short-term G-Sec maturing in 6 months. Suitable for near-term cash deployment.' },
  { id: 'bond_govt_4', name: '7.26% GS 2032', issuer: 'Government of India', category: 'government', couponRate: 7.26, yieldToMaturity: 7.02, maturityDate: '2032-02-07', yearsToMaturity: 5.6, faceValue: 100, currentPrice: 102.10, rating: 'AAA', isTaxable: true, isListed: true, issueSize: 35000, yieldChangeBps: -4, description: 'Popular 5-year G-Sec. High demand from mutual funds and banks.' },
  { id: 'bond_govt_5', name: '7.10% GS 2029', issuer: 'Government of India', category: 'government', couponRate: 7.10, yieldToMaturity: 6.92, maturityDate: '2029-06-11', yearsToMaturity: 2.9, faceValue: 100, currentPrice: 100.60, rating: 'AAA', isTaxable: true, isListed: true, issueSize: 22000, yieldChangeBps: 1, description: 'Medium-term G-Sec with 3-year maturity.' },
  // State Government Bonds (SDLs)
  { id: 'bond_state_1', name: '7.28% MH SDL 2034', issuer: 'Government of Maharashtra', category: 'state', couponRate: 7.28, yieldToMaturity: 7.18, maturityDate: '2034-03-21', yearsToMaturity: 7.7, faceValue: 100, currentPrice: 101.80, rating: 'AAA', isTaxable: true, isListed: true, issueSize: 12000, yieldChangeBps: -2, description: 'Maharashtra state development loan. Premium to G-Sec due to state-specific risk.' },
  { id: 'bond_state_2', name: '7.35% KA SDL 2031', issuer: 'Government of Karnataka', category: 'state', couponRate: 7.35, yieldToMaturity: 7.22, maturityDate: '2031-11-14', yearsToMaturity: 5.3, faceValue: 100, currentPrice: 102.20, rating: 'AAA', isTaxable: true, isListed: true, issueSize: 9500, yieldChangeBps: -1, description: 'Karnataka SDL with competitive yield. Well-rated state government security.' },
  // Corporate Bonds
  { id: 'bond_corp_1', name: '8.15% REL 2030', issuer: 'Reliance Industries Ltd', category: 'corporate', couponRate: 8.15, yieldToMaturity: 7.85, maturityDate: '2030-07-28', yearsToMaturity: 4.0, faceValue: 100, currentPrice: 103.40, rating: 'AAA', isTaxable: true, isListed: true, issueSize: 8000, yieldChangeBps: -4, sector: 'Energy', description: "Senior secured bond from India's largest conglomerate. AAA-rated with robust financials." },
  { id: 'bond_corp_2', name: '8.50% HDFC 2028', issuer: 'HDFC Bank Ltd', category: 'corporate', couponRate: 8.50, yieldToMaturity: 8.10, maturityDate: '2028-04-15', yearsToMaturity: 1.7, faceValue: 100, currentPrice: 102.80, rating: 'AAA', isTaxable: true, isListed: true, issueSize: 5000, yieldChangeBps: 3, sector: 'Finance', description: "Tier-II bond from India's largest private sector bank." },
  { id: 'bond_corp_3', name: '9.00% TATA 2035', issuer: 'Tata Sons Pvt Ltd', category: 'corporate', couponRate: 9.00, yieldToMaturity: 8.45, maturityDate: '2035-10-05', yearsToMaturity: 9.2, faceValue: 100, currentPrice: 108.60, rating: 'AAA', isTaxable: true, isListed: false, issueSize: 3500, yieldChangeBps: -6, sector: 'Conglomerate', description: 'Long-dated Tata Sons bond. Premier AAA-rated corporate bond.' },
  { id: 'bond_corp_4', name: '9.45% NTPC 2027', issuer: 'NTPC Ltd', category: 'corporate', couponRate: 9.45, yieldToMaturity: 8.75, maturityDate: '2027-08-20', yearsToMaturity: 1.1, faceValue: 100, currentPrice: 101.90, rating: 'AAA', isTaxable: true, isListed: true, issueSize: 4000, yieldChangeBps: 1, sector: 'Energy', description: 'NTPC Green Bond. Proceeds used for renewable energy projects.' },
  { id: 'bond_corp_5', name: '9.80% TATAMOT 2029', issuer: 'Tata Motors Ltd', category: 'corporate', couponRate: 9.80, yieldToMaturity: 9.15, maturityDate: '2029-05-30', yearsToMaturity: 2.9, faceValue: 100, currentPrice: 105.20, rating: 'AA', isTaxable: true, isListed: true, issueSize: 2500, yieldChangeBps: 5, sector: 'Automotive', description: 'Tata Motors bond with attractive yield. AA-rated with stable outlook.' },
  { id: 'bond_corp_6', name: '10.25% TCPL 2031', issuer: 'Tata Consumer Products', category: 'corporate', couponRate: 10.25, yieldToMaturity: 9.45, maturityDate: '2031-12-15', yearsToMaturity: 5.4, faceValue: 100, currentPrice: 107.80, rating: 'AA', isTaxable: true, isListed: false, issueSize: 1800, yieldChangeBps: -3, sector: 'Consumer', description: 'Tata Consumer Products bond. Strong brand portfolio.' },
  { id: 'bond_corp_7', name: '10.50% BHARTI 2032', issuer: 'Bharti Airtel Ltd', category: 'corporate', couponRate: 10.50, yieldToMaturity: 9.65, maturityDate: '2032-03-10', yearsToMaturity: 5.7, faceValue: 100, currentPrice: 109.40, rating: 'A', isTaxable: true, isListed: true, issueSize: 3000, yieldChangeBps: 8, sector: 'Telecom', description: 'Bharti Airtel bond with premium yield reflecting telecom sector dynamics.' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════════

function simulateBondYield(b: BondData): BondData {
  const bpsJitter = Math.round((Math.random() - 0.5) * 6);
  const priceAdj = bpsJitter * 0.05;
  return {
    ...b,
    yieldToMaturity: +(b.yieldToMaturity + bpsJitter * 0.01).toFixed(2),
    currentPrice: +(b.currentPrice + priceAdj).toFixed(2),
    yieldChangeBps: bpsJitter,
  };
}

function computeSummary(bonds: BondData[], treasuryData?: { yields: TreasuryYield[]; corpSpread: number; source: 'fred' | 'mock' }): BondSummary {
  const govtBonds = bonds.filter(b => b.category === 'government');
  const corpBonds = bonds.filter(b => b.category === 'corporate');
  const stateBonds = bonds.filter(b => b.category === 'state');

  const avg = (arr: BondData[], key: keyof BondData) =>
    arr.length > 0 ? arr.reduce((s, b) => s + (b[key] as number), 0) / arr.length : 0;

  const yieldCurve = [
    { label: '<1Y', bonds: bonds.filter(b => b.yearsToMaturity < 1) },
    { label: '1-3Y', bonds: bonds.filter(b => b.yearsToMaturity >= 1 && b.yearsToMaturity < 3) },
    { label: '3-5Y', bonds: bonds.filter(b => b.yearsToMaturity >= 3 && b.yearsToMaturity < 5) },
    { label: '5-10Y', bonds: bonds.filter(b => b.yearsToMaturity >= 5 && b.yearsToMaturity < 10) },
    { label: '10Y+', bonds: bonds.filter(b => b.yearsToMaturity >= 10) },
  ].map(bucket => ({
    label: bucket.label,
    count: bucket.bonds.length,
    avgYield: bucket.bonds.length > 0 ? +(bucket.bonds.reduce((s, b) => s + b.yieldToMaturity, 0) / bucket.bonds.length).toFixed(2) : 0,
    avgCoupon: bucket.bonds.length > 0 ? +(bucket.bonds.reduce((s, b) => s + b.couponRate, 0) / bucket.bonds.length).toFixed(2) : 0,
  }));

  return {
    total: bonds.length,
    government: { count: govtBonds.length, avgYTM: +avg(govtBonds, 'yieldToMaturity').toFixed(2), avgCoupon: +avg(govtBonds, 'couponRate').toFixed(2) },
    corporate: { count: corpBonds.length, avgYTM: +avg(corpBonds, 'yieldToMaturity').toFixed(2), avgCoupon: +avg(corpBonds, 'couponRate').toFixed(2) },
    state: { count: stateBonds.length, avgYTM: +avg(stateBonds, 'yieldToMaturity').toFixed(2), avgCoupon: +avg(stateBonds, 'couponRate').toFixed(2) },
    yieldCurve,
    treasury: treasuryData,
    updatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FRED API Integration (Federal Reserve Economic Data)
// ═══════════════════════════════════════════════════════════════════════════════
//
// FRED provides US Treasury yields, corporate bond indices, and global bond data.
// Free API key: https://fred.stlouisfed.org/docs/api/fred/
//
// We use FRED for:
//   1. Real US Treasury yield curve (3mo through 30yr)
//   2. Corporate bond spreads (Moody's Aaa, Baa)
//   3. Adjust Indian G-Sec mock yields based on real US curve movements
//
// When FRED_API_KEY is not set or FRED is unreachable, falls back to mock data.

const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

interface FredConfig {
  apiKey: string;
}

const fredConfig: FredConfig = {
  apiKey: process.env.FRED_API_KEY || '',
};

/**
 * Update the FRED API configuration (called on startup from env).
 */
export function configureBondApi(envConfig: { fredApiKey?: string }): void {
  if (envConfig.fredApiKey) {
    fredConfig.apiKey = envConfig.fredApiKey;
  }
}

/**
 * Check if the FRED API is configured with an API key.
 */
export function isBondApiConfigured(): boolean {
  return fredConfig.apiKey.length > 0;
}

// ─── FRED fetch helper ───────────────────────────────────────────────────────

interface FredObservation {
  date: string;
  value: string;
}

interface FredResponse {
  observations: FredObservation[];
}

function fetchFromFred(seriesId: string): Promise<FredResponse> {
  if (!fredConfig.apiKey) {
    return Promise.reject(new Error('FRED API key not configured. Set FRED_API_KEY env var.'));
  }

  const url = `${FRED_BASE_URL}/series/observations?series_id=${seriesId}&api_key=${fredConfig.apiKey}&file_type=json&sort_order=desc&limit=2`;

  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.error_code) {
            reject(new Error(`FRED API error: ${parsed.error_message || JSON.stringify(parsed)}`));
          } else {
            resolve(parsed as FredResponse);
          }
        } catch (e) {
          reject(new Error(`Failed to parse FRED response: ${(e as Error).message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('FRED request timed out')); });
  });
}

/**
 * Fetch real US Treasury yields from FRED.
 * Returns an array of yields by maturity, or null if failed.
 */
async function fetchTreasuryYields(): Promise<TreasuryYield[] | null> {
  try {
    const results = await Promise.allSettled(
      FRED_SERIES.map(s => fetchFromFred(s.seriesId).then(r => ({
        series: s,
        observations: r.observations || [],
      })))
    );

    const yields: TreasuryYield[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.observations.length >= 1) {
        const latest = result.value.observations[0];
        const prev = result.value.observations[1];
        const currentYield = parseFloat(latest.value);
        const prevYield = prev ? parseFloat(prev.value) : currentYield;
        if (!isNaN(currentYield)) {
          yields.push({
            maturity: result.value.series.maturity,
            maturityYears: result.value.series.maturityYears,
            yield: currentYield,
            change_bps: Math.round((currentYield - prevYield) * 100),
          });
        }
      }
    }

    return yields.length > 0 ? yields.sort((a, b) => a.maturityYears - b.maturityYears) : null;
  } catch {
    return null;
  }
}

/**
 * Fetch corporate bond spread from FRED (Baa - 10yr Treasury).
 */
async function fetchCorpSpread(): Promise<number | null> {
  try {
    const [baaRes, t10Res] = await Promise.all([
      fetchFromFred(FRED_CORP_SERIES.baa),
      fetchFromFred('DGS10'),
    ]);

    const baaObs = baaRes.observations?.[0];
    const t10Obs = t10Res.observations?.[0];

    if (baaObs && t10Obs) {
      const baaYield = parseFloat(baaObs.value);
      const t10Yield = parseFloat(t10Obs.value);
      if (!isNaN(baaYield) && !isNaN(t10Yield)) {
        return +(baaYield - t10Yield).toFixed(2);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Given real US Treasury yields, adjust the Indian mock bond yields
 * (Indian G-Secs typically trade at a ~250bps spread over US Treasuries).
 */
function adjustBondsWithFredYields(bonds: BondData[], treasuryYields: TreasuryYield[]): BondData[] {
  // Build a yield lookup: for each bond's maturity bucket, find the corresponding Treasury yield
  return bonds.map(b => {
    const closestTreasury = treasuryYields.reduce((best, t) => {
      const diff = Math.abs(t.maturityYears - b.yearsToMaturity);
      return diff < Math.abs(best.maturityYears - b.yearsToMaturity) ? t : best;
    });

    // Indian G-Sec = US Treasury + ~250bps spread
    // Corporate bonds have additional spread based on rating
    // State bonds are between G-Sec and corporate
    const baseSpread = b.category === 'government' ? 2.50 :
      b.category === 'state' ? 2.80 :
      b.category === 'corporate' ? 3.50 : 3.00;

    // Rating adjustment
    const ratingSpread: Record<string, number> = { AAA: 0, AA: 0.35, A: 0.75, BBB: 1.25 };
    const ratingAdj = ratingSpread[b.rating] || 0;

    const adjustedYield = closestTreasury.yield + baseSpread + ratingAdj;
    const originalYield = b.yieldToMaturity;
    const yieldDiff = adjustedYield - originalYield;

    return {
      ...b,
      yieldToMaturity: +adjustedYield.toFixed(2),
      // Adjust price inversely to yield change (simplified duration effect)
      currentPrice: +(b.currentPrice - yieldDiff * 0.8).toFixed(2),
      yieldChangeBps: Math.round((adjustedYield - (originalYield + (Math.random() - 0.5) * 0.1)) * 100),
      description: b.description + (closestTreasury.yield > 0
        ? ` (US ${closestTreasury.maturity}: ${closestTreasury.yield.toFixed(2)}%)`
        : ''),
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════

export const bondService = {
  /**
   * Get all bonds with yield data.
   * When FRED API key is configured, fetches real US Treasury yields
   * to adjust Indian bond yields with real market data.
   * Falls back to pure mock data with simulated fluctuations.
   * Cached for 10 minutes.
   */
  async getAll(): Promise<{ bonds: BondData[]; source: 'fred' | 'mock' }> {
    return marketCache.getOrSet(
      'bond:all',
      async () => {
        if (isBondApiConfigured()) {
          try {
            const treasuryYields = await fetchTreasuryYields();
            if (treasuryYields && treasuryYields.length >= 3) {
              const bonds = adjustBondsWithFredYields(MOCK_BONDS, treasuryYields);
              return { bonds, source: 'fred' };
            }
          } catch {
            // Fall through to mock
          }
        }
        return { bonds: MOCK_BONDS.map(simulateBondYield), source: 'mock' };
      },
      CACHE_TTL.BONDS_ALL,
    );
  },

  /**
   * Get a single bond by ID.
   */
  async getById(id: string): Promise<BondData | null> {
    const bond = MOCK_BONDS.find(b => b.id === id);
    return bond ? simulateBondYield(bond) : null;
  },

  /**
   * Get bonds filtered by category.
   */
  async getByCategory(category: BondCategory): Promise<BondData[]> {
    const { bonds } = await this.getAll();
    return bonds.filter(b => b.category === category);
  },

  /**
   * Get bond market summary with yield curve.
   * When FRED is configured, includes real US Treasury yield curve
   * and corporate bond spread data.
   * Cached for 10 minutes.
   */
  async getSummary(): Promise<BondSummary> {
    return marketCache.getOrSet(
      'bond:summary',
      async () => {
        const { bonds, source } = await this.getAll();

        // Try to get FRED treasury + corp spread data for the summary
        let treasuryData: { yields: TreasuryYield[]; corpSpread: number; source: 'fred' | 'mock' } | undefined;
        if (isBondApiConfigured() && source === 'fred') {
          try {
            const [yields, corpSpread] = await Promise.all([
              fetchTreasuryYields(),
              fetchCorpSpread(),
            ]);
            if (yields && yields.length > 0) {
              treasuryData = {
                yields,
                corpSpread: corpSpread ?? 1.50,
                source: 'fred',
              };
            }
          } catch {
            // Treasury not available from FRED
          }
        }

        if (!treasuryData) {
          // Fallback mock treasury data for display
          treasuryData = {
            yields: [
              { maturity: '3 Month', maturityYears: 0.25, yield: 4.35, change_bps: -2 },
              { maturity: '6 Month', maturityYears: 0.5, yield: 4.42, change_bps: 1 },
              { maturity: '1 Year', maturityYears: 1, yield: 4.28, change_bps: -3 },
              { maturity: '2 Year', maturityYears: 2, yield: 4.05, change_bps: -5 },
              { maturity: '3 Year', maturityYears: 3, yield: 3.92, change_bps: -2 },
              { maturity: '5 Year', maturityYears: 5, yield: 3.88, change_bps: 0 },
              { maturity: '7 Year', maturityYears: 7, yield: 3.95, change_bps: 2 },
              { maturity: '10 Year', maturityYears: 10, yield: 4.02, change_bps: 3 },
              { maturity: '20 Year', maturityYears: 20, yield: 4.28, change_bps: 4 },
              { maturity: '30 Year', maturityYears: 30, yield: 4.35, change_bps: 3 },
            ],
            corpSpread: 1.50,
            source: 'mock',
          };
        }

        return computeSummary(bonds, treasuryData);
      },
      CACHE_TTL.BONDS_SUMMARY,
    );
  },

  /**
   * Get fallback mock bonds (no simulation, no cache).
   */
  getFallbackBonds(): BondData[] {
    return MOCK_BONDS;
  },
};
