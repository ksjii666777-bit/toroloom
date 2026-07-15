/**
 * ============================================================================
 * Toroloom — F&O (Futures & Options) Trading Routes
 * ============================================================================
 *
 * Endpoints for options chains, futures contracts, expiry management,
 * option Greeks, and strategy builder support.
 *
 * Route prefix: /api/fno
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';
import { getBroker } from '../services/broker';

const router = Router();
router.use(authMiddleware);

// ──── Historical Data Cache (Configurable, MemoryCache + Redis) ───────────

import { MemoryCache } from '../services/cache';
import * as cacheService from '../middleware/cacheService';

interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** In-memory cache for historical data (always available) */
const historicalMemoryCache = new MemoryCache(env.backtestCacheTtl * 1000);

/** Cache namespace prefix for Redis keys */
const HISTORICAL_CACHE_PREFIX = 'backtest:historical:';

/** Max entries in memory cache before eviction */
const CACHE_MAX_ENTRIES = env.cacheMaxEntries;

async function getCachedHistoricalData(symbol: string, days: number): Promise<HistoricalDataPoint[] | null> {
  const key = `${symbol}:${days}`;

  // 1. Try Redis first (production-grade, across restarts/pods)
  if (env.hasRedis) {
    try {
      const redisVal = await cacheService.get(`${HISTORICAL_CACHE_PREFIX}${key}`);
      if (redisVal) {
        const parsed = JSON.parse(redisVal) as HistoricalDataPoint[];
        // Also seed memory cache for faster subsequent access
        // Delete first to bump key to newest position (LRU-friendly eviction)
        historicalMemoryCache.delete(key);
        historicalMemoryCache.set(key, parsed);
        return parsed;
      }
    } catch {
      // Redis unavailable — fall through to memory cache
    }
  }

  // 2. Fall back to memory cache (fast, process-local)
  const memCached = historicalMemoryCache.get<HistoricalDataPoint[]>(key);
  if (memCached) return memCached;

  return null;
}

async function setCachedHistoricalData(symbol: string, days: number, data: HistoricalDataPoint[]): Promise<void> {
  const key = `${symbol}:${days}`;
  const ttlSec = env.backtestCacheTtl;

  // 1. Set in memory cache
  historicalMemoryCache.set(key, data, ttlSec * 1000);

  // 2. Set in Redis (if available) — fire-and-forget
  if (env.hasRedis) {
    try {
      await cacheService.set(`${HISTORICAL_CACHE_PREFIX}${key}`, JSON.stringify(data), ttlSec);
    } catch {
      // Redis write failure is non-critical
    }
  }

  // 3. Evict oldest if cache exceeds max entries
  const stats = historicalMemoryCache.stats();
  if (stats.size > CACHE_MAX_ENTRIES) {
    // Remove oldest 25% of entries
    const keysToRemove = stats.keys.slice(0, Math.floor(CACHE_MAX_ENTRIES * 0.25));
    for (const oldKey of keysToRemove) {
      historicalMemoryCache.delete(oldKey);
    }
  }
}

// ──── Mock Historical Data Generator (Fallback) ──────────────────────────

function generateMockHistoricalData(basePrice: number, days: number): HistoricalDataPoint[] {
  const data: HistoricalDataPoint[] = [];
  let price = basePrice;
  const today = new Date();
  const dailyVol = basePrice * 0.012; // ~1.2% daily vol ≈ 19% annualized

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    // Random walk with slight mean reversion
    const momentum = (Math.random() - 0.48) * 0.3;
    const noise = (Math.random() - 0.5) * dailyVol;
    const change = price * momentum + noise;
    price = Math.max(price + change, basePrice * 0.5);

    const open = price - change * 0.3;
    const close = price;
    const spread = Math.abs(close - open);
    const high = Math.max(open, close) + spread * (0.2 + Math.random() * 0.5);
    const low = Math.min(open, close) - spread * (0.2 + Math.random() * 0.5);

    data.push({
      date: date.toISOString().split('T')[0],
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.floor(Math.random() * 20000000) + 5000000,
    });
  }

  return data;
}

// ──── Mock F&O Data Generator ─────────────────────────────────────────────

interface OptionContract {
  strike: number;
  expiry: string;
  type: 'CE' | 'PE';
  ltp: number;
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  iv: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  volume: number;
  openInterest: number;
  oiChange: number;
  moneyness: 'ITM' | 'ATM' | 'OTM';
  intrinsicValue: number;
  timeValue: number;
}

interface OptionChainRow {
  strike: number;
  ce: OptionContract | null;
  pe: OptionContract | null;
}

interface OptionChainResponse {
  underlying: string;
  underlyingPrice: number;
  spotPrice: number;
  expiry: string;
  expiryDate: string;
  rows: OptionChainRow[];
  totalCEOi: number;
  totalPEOi: number;
  totalCEVolume: number;
  totalPEVolume: number;
  maxPain: number;
  pcr: number;
}

interface FutureContract {
  symbol: string;
  underlying: string;
  expiry: string;
  expiryDate: string;
  lotSize: number;
  price: number;
  change: number;
  changePercent: number;
  openInterest: number;
  oiChange: number;
  oiChangePercent: number;
  volume: number;
  basis: number;
  basisPercent: number;
}

interface FnOExpiry {
  id: string;
  date: string;
  type: 'weekly' | 'monthly';
  daysToExpiry: number;
  isMonthly: boolean;
}

// ──── Mock Data Generation Helpers ─────────────────────────────────────────

function getWeeklyExpiry(baseDate: Date = new Date()): Date {
  const d = new Date(baseDate);
  // NSE weekly options expire on Thursdays
  const day = d.getDay();
  const diff = day <= 4 ? 4 - day : 4 + 7 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getMonthlyExpiry(baseDate: Date = new Date()): Date {
  const d = new Date(baseDate);
  // Last Thursday of the month
  d.setMonth(d.getMonth() + 1, 0); // last day of current month
  const lastDay = d.getDay();
  const diff = lastDay >= 4 ? lastDay - 4 : lastDay + 7 - 4;
  d.setDate(d.getDate() - diff);
  if (d <= baseDate) {
    // If already past, go to next month
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    const newLastDay = d.getDay();
    const newDiff = newLastDay >= 4 ? newLastDay - 4 : newLastDay + 7 - 4;
    d.setDate(d.getDate() - newDiff);
  }
  return d;
}

function generateExpiries(): FnOExpiry[] {
  const now = new Date();
  const expiries: FnOExpiry[] = [];

  // Generate next 4 weekly expiries
  for (let i = 0; i < 4; i++) {
    const weekly = getWeeklyExpiry(new Date(now.getTime() + i * 7 * 24 * 60 * 60 * 1000));
    expiries.push({
      id: `weekly_${i + 1}`,
      date: weekly.toISOString(),
      type: 'weekly',
      daysToExpiry: Math.ceil((weekly.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      isMonthly: false,
    });
  }

  // Generate next 3 monthly expiries
  for (let i = 0; i < 3; i++) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    const monthly = getMonthlyExpiry(nextMonth);
    expiries.push({
      id: `monthly_${i + 1}`,
      date: monthly.toISOString(),
      type: 'monthly',
      daysToExpiry: Math.ceil((monthly.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      isMonthly: true,
    });
  }

  return expiries.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
}

// Normal distribution random for realistic option pricing
function normalRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function blackScholesPrice(
  spot: number,
  strike: number,
  timeToExpiry: number, // in years
  rate: number,
  iv: number,
  type: 'CE' | 'PE',
): number {
  if (timeToExpiry <= 0) {
    const intrinsic = type === 'CE' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
    return intrinsic;
  }

  const sqrtT = Math.sqrt(timeToExpiry);
  const d1 = (Math.log(spot / strike) + (rate + iv * iv / 2) * timeToExpiry) / (iv * sqrtT);
  const d2 = d1 - iv * sqrtT;

  // Standard normal CDF approximation
  const cdf = (x: number): number => {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
  };

  if (type === 'CE') {
    return spot * cdf(d1) - strike * Math.exp(-rate * timeToExpiry) * cdf(d2);
  } else {
    return strike * Math.exp(-rate * timeToExpiry) * cdf(-d2) - spot * cdf(-d1);
  }
}

function generateOptionContract(
  spot: number,
  strike: number,
  expiry: string,
  type: 'CE' | 'PE',
  timeToExpiryYears: number,
): OptionContract {
  const isITM = type === 'CE' ? spot > strike : strike > spot;
  const isATM = Math.abs(spot - strike) / spot < 0.01;
  const moneyness: 'ITM' | 'ATM' | 'OTM' = isITM ? 'ITM' : isATM ? 'ATM' : 'OTM';

  // Base IV - OTM options have higher IV (volatility smile)
  const distanceFromSpot = Math.abs(strike - spot) / spot;
  const baseIv = 0.18 + distanceFromSpot * 0.35 + normalRandom() * 0.02;
  const iv = Math.max(0.08, Math.min(0.60, baseIv));

  const rate = 0.065; // ~6.5% Indian risk-free rate
  const fairPrice = blackScholesPrice(spot, strike, timeToExpiryYears, rate, iv, type);

  // Add slight bid-ask spread
  const spread = fairPrice * 0.02 + 0.5;
  const bid = Math.max(0, fairPrice - spread / 2);
  const ask = fairPrice + spread / 2;
  const ltp = (bid + ask) / 2 + normalRandom() * spread * 0.1;

  // Greeks using finite difference approximations
  const h = 0.01;
  const spotH = spot * h;
  const ivH = iv * h;
  const timeH = timeToExpiryYears * h;

  const priceUp = blackScholesPrice(spot + spotH, strike, timeToExpiryYears, rate, iv, type);
  const priceDown = blackScholesPrice(spot - spotH, strike, timeToExpiryYears, rate, iv, type);
  const delta = (priceUp - priceDown) / (2 * spotH);

  const gamma = (priceUp - 2 * ltp + priceDown) / (spotH * spotH);

  const priceIvUp = blackScholesPrice(spot, strike, timeToExpiryYears, rate, iv + ivH, type);
  const vega = (priceIvUp - ltp) / (ivH * 100); // vega per 1% IV change

  const priceTimeDown = timeToExpiryYears > timeH
    ? blackScholesPrice(spot, strike, timeToExpiryYears - timeH, rate, iv, type)
    : 0;
  const theta = timeToExpiryYears > timeH ? (priceTimeDown - ltp) / (timeH * 365) : 0; // theta per day

  const priceRateUp = blackScholesPrice(spot, strike, timeToExpiryYears, rate + 0.01, iv, type);
  const rho = (priceRateUp - ltp) / 1000;

  const intrinsicValue = isITM
    ? (type === 'CE' ? spot - strike : strike - spot)
    : 0;
  const timeValue = Math.max(0, ltp - intrinsicValue);

  // Volume & OI - higher near ATM
  const atmFactor = 1 - Math.abs(strike - spot) / spot;
  const baseVolume = 50000 + Math.random() * 150000;
  const volume = Math.round(baseVolume * (0.3 + atmFactor * 0.7));

  const baseOi = 200000 + Math.random() * 500000;
  const openInterest = Math.round(baseOi * (0.3 + atmFactor * 0.7));
  const oiChange = Math.round((Math.random() - 0.45) * openInterest * 0.1);

  const change = ltp - fairPrice + normalRandom() * 2;
  const changePercent = fairPrice > 0 ? (change / fairPrice) * 100 : 0;

  return {
    strike,
    expiry,
    type,
    ltp: Math.round(ltp * 100) / 100,
    bid: Math.round(bid * 100) / 100,
    ask: Math.round(ask * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    iv: Math.round(iv * 10000) / 100,
    delta: Math.round(delta * 10000) / 10000,
    gamma: Math.round(gamma * 100000) / 100000,
    theta: Math.round(theta * 10000) / 10000,
    vega: Math.round(vega * 10000) / 10000,
    rho: Math.round(rho * 10000) / 10000,
    volume,
    openInterest,
    oiChange,
    moneyness,
    intrinsicValue: Math.round(intrinsicValue * 100) / 100,
    timeValue: Math.round(timeValue * 100) / 100,
  };
}

function generateOptionChain(
  symbol: string,
  expiry: string,
  spotPrice: number,
): OptionChainResponse {
  const now = new Date();
  const expiryDate = new Date(expiry);
  const timeToExpiryYears = Math.max(0.01, (expiryDate.getTime() - now.getTime()) / (365 * 24 * 60 * 60 * 1000));

  // Generate strikes around the spot price
  const strikeInterval = symbol === 'BANKNIFTY' ? 100 : symbol === 'NIFTY' ? 50 : 5;
  const numStrikes = 20;
  const baseStrike = Math.round(spotPrice / strikeInterval) * strikeInterval;

  const strikes: number[] = [];
  for (let i = -numStrikes / 2; i <= numStrikes / 2; i++) {
    strikes.push(baseStrike + i * strikeInterval);
  }

  const rows: OptionChainRow[] = [];
  let totalCEOi = 0, totalPEOi = 0, totalCEVolume = 0, totalPEVolume = 0;

  for (const strike of strikes) {
    const ce = generateOptionContract(spotPrice, strike, expiry, 'CE', timeToExpiryYears);
    const pe = generateOptionContract(spotPrice, strike, expiry, 'PE', timeToExpiryYears);
    rows.push({ strike, ce, pe });
    totalCEOi += ce.openInterest;
    totalPEOi += pe.openInterest;
    totalCEVolume += ce.volume;
    totalPEVolume += pe.volume;
  }

  // Max Pain: strike with highest combined OI
  let maxPain = baseStrike;
  let maxOi = 0;
  for (const row of rows) {
    const oiSum = (row.ce?.openInterest || 0) + (row.pe?.openInterest || 0);
    if (oiSum > maxOi) {
      maxOi = oiSum;
      maxPain = row.strike;
    }
  }

  const pcr = totalPEOi > 0 ? Math.round((totalCEOi / totalPEOi) * 1000) / 1000 : 1;

  return {
    underlying: symbol,
    underlyingPrice: spotPrice,
    spotPrice,
    expiry,
    expiryDate: expiry,
    rows,
    totalCEOi,
    totalPEOi,
    totalCEVolume,
    totalPEVolume,
    maxPain,
    pcr,
  };
}

function generateFuturesChain(symbol: string, spotPrice: number, expiries: FnOExpiry[]): FutureContract[] {
  return expiries.map((expiry, i) => {
    const daysToExpiry = expiry.daysToExpiry;
    // Futures price = spot * e^(rT) approximately
    const annualRate = 0.065;
    const basis = spotPrice * annualRate * (daysToExpiry / 365);
    const price = spotPrice + basis;

    const change = (Math.random() - 0.45) * price * 0.015;
    const oiBase = 500000 + Math.random() * 1000000;
    const volume = Math.round(100000 + Math.random() * 500000);

    return {
      symbol: `${symbol}${expiry.type === 'monthly' ? 'M' : 'W'}${i + 1}`,
      underlying: symbol,
      expiry: expiry.date,
      expiryDate: expiry.date,
      lotSize: symbol === 'BANKNIFTY' ? 25 : symbol === 'NIFTY' ? 50 : 1000,
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round((change / price) * 10000) / 100,
      openInterest: Math.round(oiBase + normalRandom() * oiBase * 0.2),
      oiChange: Math.round((Math.random() - 0.45) * oiBase * 0.1),
      oiChangePercent: Math.round((Math.random() - 0.45) * 15 * 10) / 10,
      volume,
      basis: Math.round(basis * 100) / 100,
      basisPercent: Math.round((basis / spotPrice) * 10000) / 100,
    };
  });
}

import { scanMarket } from '../services/optionsScanner';

// ──── Validation Helpers ───────────────────────────────────────────────────

const VALID_FNO_TYPES = ['CE', 'PE', 'FUTURE'] as const;
const VALID_ACTIONS = ['buy', 'sell'] as const;

/** Check if a string is one of the valid F&O contract types */
function isValidFnoType(type: unknown): type is 'CE' | 'PE' | 'FUTURE' {
  return typeof type === 'string' && VALID_FNO_TYPES.includes(type as any);
}

/** Check if a string is a valid buy/sell action */
function isValidAction(action: unknown): action is 'buy' | 'sell' {
  return typeof action === 'string' && VALID_ACTIONS.includes(action as any);
}

/** Check if a value is a finite number (rejects NaN, Infinity, null, undefined) */
function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Check if a string is a valid ISO date string that can be parsed */
function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  const d = new Date(value);
  return d instanceof Date && !isNaN(d.getTime());
}

// ──── Routes ───────────────────────────────────────────────────────────────

// GET /api/fno/expiries?symbol=NIFTY
router.get('/expiries', (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || 'NIFTY';
    const expiries = generateExpiries();
    res.json({ symbol, expiries });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch expiries' });
  }
});

// GET /api/fno/option-chain?symbol=NIFTY&expiry=<ISO_DATE>
router.get('/option-chain', (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || 'NIFTY';
    const expiry = (req.query.expiry as string);
    const spotPrice = parseFloat((req.query.spotPrice as string) || '0');

    if (!symbol) {
      res.status(400).json({ error: 'symbol is required' });
      return;
    }

    // Validate expiry format if provided
    if (expiry && !isValidDateString(expiry)) {
      res.status(400).json({
        error: 'Invalid expiry date format. Use ISO 8601 date string (e.g. 2026-07-02T00:00:00.000Z)',
      });
      return;
    }

    // Generate a realistic spot price if not provided
    const spotPriceMap: Record<string, number> = {
      NIFTY: 23456.80,
      BANKNIFTY: 49234.10,
      RELIANCE: 2890.50,
      HDFCBANK: 1678.90,
      INFY: 1567.80,
      TCS: 3890.00,
      SBIN: 789.50,
    };
    const price = spotPrice > 0 ? spotPrice : (spotPriceMap[symbol] || 1000);

    // If no expiry provided, use the first weekly one
    let targetExpiry = expiry;
    if (!targetExpiry) {
      const expiries = generateExpiries();
      targetExpiry = expiries[0]?.date || getWeeklyExpiry().toISOString();
    }

    const chain = generateOptionChain(symbol, targetExpiry, price);
    res.json(chain);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch option chain' });
  }
});

// GET /api/fno/futures?symbol=NIFTY
router.get('/futures', (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || 'NIFTY';
    const spotPriceMap: Record<string, number> = {
      NIFTY: 23456.80,
      BANKNIFTY: 49234.10,
      RELIANCE: 2890.50,
      HDFCBANK: 1678.90,
      INFY: 1567.80,
      TCS: 3890.00,
      SBIN: 789.50,
    };
    const spotPrice = spotPriceMap[symbol] || 1000;
    const expiries = generateExpiries();
    const futures = generateFuturesChain(symbol, spotPrice, expiries);

    res.json({ symbol, spotPrice, futures });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch futures' });
  }
});

// GET /api/fno/spot-prices?symbols=NIFTY,BANKNIFTY,RELIANCE
router.get('/spot-prices', (_req: Request, res: Response) => {
  try {
    const spotPriceMap: Record<string, number> = {
      NIFTY: 23456.80,
      BANKNIFTY: 49234.10,
      RELIANCE: 2890.50,
      HDFCBANK: 1678.90,
      INFY: 1567.80,
      TCS: 3890.00,
      SBIN: 789.50,
      TATAMOTORS: 945.20,
      BAJFINANCE: 6789.00,
      ITC: 478.90,
    };
    res.json(spotPriceMap);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch spot prices' });
  }
});

// GET /api/fno/market-status
router.get('/market-status', (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const isOpen = day >= 1 && day <= 5 &&
      ((hour > 9 || (hour === 9 && now.getMinutes() >= 15)) &&
       (hour < 15 || (hour === 15 && now.getMinutes() <= 30)));

    res.json({
      isOpen,
      status: isOpen ? 'open' : 'closed',
      message: isOpen
        ? 'F&O market is open for trading'
        : 'F&O market is closed. Next session opens at 9:15 AM',
      currentTime: now.toISOString(),
    });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch market status' });
  }
});

// GET /api/fno/historical-data — Fetch historical price data for backtesting
router.get('/historical-data', async (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || 'NIFTY';
    const days = parseInt((req.query.days as string) || '365', 10);

    if (days < 5 || days > 3650 || !isFinite(days)) {
      res.status(400).json({ error: 'days must be between 5 and 3650' });
      return;
    }

    // 1. Check cache first
    const cached = await getCachedHistoricalData(symbol, days);
    if (cached) {
      res.json({ symbol, days, data: cached, source: 'cache' });
      return;
    }

    // Spot price lookup for mock data generation
    const spotPriceMap: Record<string, number> = {
      NIFTY: 23456.80,
      BANKNIFTY: 49234.10,
      RELIANCE: 2890.50,
      HDFCBANK: 1678.90,
      INFY: 1567.80,
      TCS: 3890.00,
      SBIN: 789.50,
      TATAMOTORS: 945.20,
      BAJFINANCE: 6789.00,
      ITC: 478.90,
      SENSEX: 81234.50,
      MIDCPNIFTY: 15670.30,
    };
    const spotPrice = spotPriceMap[symbol] || 1000;

    // 2. Try real broker if available (non-mock mode)
    if (!env.isMock) {
      try {
        const broker = await getBroker();
        if (broker?.isConnected?.() && typeof broker.getOHLC === 'function') {
          const ohlcData = await broker.getOHLC(symbol, '1d', days);
          if (Array.isArray(ohlcData) && ohlcData.length > 0) {
            const mapped: HistoricalDataPoint[] = ohlcData.map(candle => ({
              date: new Date(candle.date).toISOString().split('T')[0],
              open: Math.round(candle.open * 100) / 100,
              high: Math.round(candle.high * 100) / 100,
              low: Math.round(candle.low * 100) / 100,
              close: Math.round(candle.close * 100) / 100,
              volume: Math.round(candle.volume || 0),
            }));

            setCachedHistoricalData(symbol, days, mapped);
            res.json({ symbol, days, data: mapped, source: 'broker' });
            return;
          }
        }
      } catch {
        // Broker unavailable — fall through to mock data
      }
    }

    // 3. Fallback: generate mock historical data
    const data = generateMockHistoricalData(spotPrice, days);
    setCachedHistoricalData(symbol, days, data);
    res.json({ symbol, days, data, source: 'mock' });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch historical data' });
  }
});

// POST /api/fno/place-order — Place F&O order
router.post('/place-order', (req: Request, res: Response) => {
  try {
    const {
      symbol,
      type, // 'FUTURE' | 'CE' | 'PE'
      action, // 'buy' | 'sell'
      strike,
      expiry,
      quantity,
      price,
      productType = 'NRML',
    } = req.body;

    if (!symbol || !type || !action || !expiry || quantity === undefined || quantity === null || price === undefined || price === null) {
      res.status(400).json({
        error: 'Missing required fields: symbol, type, action, expiry, quantity, price',
      });
      return;
    }

    // ── Validate field types and values ────────────────────────────────

    if (!isValidFnoType(type)) {
      res.status(400).json({
        error: `Invalid type "${type}". Must be one of: ${VALID_FNO_TYPES.join(', ')}`,
      });
      return;
    }

    if (!isValidAction(action)) {
      res.status(400).json({
        error: `Invalid action "${action}". Must be one of: ${VALID_ACTIONS.join(', ')}`,
      });
      return;
    }

    if (!isValidDateString(expiry)) {
      res.status(400).json({
        error: 'Invalid expiry date. Must be a valid ISO 8601 date string',
      });
      return;
    }

    if (!isValidNumber(quantity) || !Number.isInteger(quantity) || quantity < 1) {
      res.status(400).json({
        error: 'quantity must be a positive integer',
      });
      return;
    }

    if (!isValidNumber(price) || price <= 0) {
      res.status(400).json({
        error: 'price must be a positive number',
      });
      return;
    }

    const orderId = `FNO_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    // Simulate order processing
    const lotSizes: Record<string, number> = {
      NIFTY: 50, BANKNIFTY: 25, RELIANCE: 1000, HDFCBANK: 1000,
      INFY: 1000, TCS: 500, SBIN: 1000, TATAMOTORS: 1000,
      BAJFINANCE: 500, ITC: 1000,
    };
    const lotSize = lotSizes[symbol] || 1000;
    const totalQuantity = quantity * lotSize;
    const totalValue = totalQuantity * price;

    res.status(200).json({
      success: true,
      orderId,
      message: `${action.toUpperCase()} ${type} order placed: ${quantity} lot(s) of ${symbol}${strike ? ` ${strike}` : ''} @ ₹${price}`,
      type,
      action,
      symbol,
      strike: strike || null,
      expiry,
      quantity,
      lotSize,
      totalQuantity,
      price,
      totalValue,
      productType,
      timestamp,
      status: 'confirmed',
    });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to place F&O order' });
  }
});

// POST /api/fno/strategy/execute — Execute a multi-leg strategy (all legs to broker)
router.post('/strategy/execute', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default_user';
    const { legs, spotPrice, symbol: strategySymbol, productType = 'NRML', orderType = 'MARKET' } = req.body;

    if (!legs || !Array.isArray(legs) || legs.length < 1) {
      res.status(400).json({ error: 'At least one leg is required' });
      return;
    }

    // ── Validate each leg ────────────────────────────────────────────
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      if (!leg || typeof leg !== 'object') {
        res.status(400).json({ error: `Leg at index ${i} must be an object` });
        return;
      }
      const { type, action, strike, premium, quantity } = leg;
      if (!type || !isValidFnoType(type)) {
        res.status(400).json({ error: `Leg ${i}: invalid type "${type}"` });
        return;
      }
      if (!action || !isValidAction(action)) {
        res.status(400).json({ error: `Leg ${i}: invalid action "${action}"` });
        return;
      }
      if (strike === undefined || strike === null || !isValidNumber(strike) || strike < 0) {
        res.status(400).json({ error: `Leg ${i}: strike must be a non-negative number` });
        return;
      }
      if (premium === undefined || premium === null || !isValidNumber(premium)) {
        res.status(400).json({ error: `Leg ${i}: premium must be a number` });
        return;
      }
      if (quantity === undefined || quantity === null || !isValidNumber(quantity) || !Number.isInteger(quantity) || quantity < 1) {
        res.status(400).json({ error: `Leg ${i}: quantity must be a positive integer` });
        return;
      }
    }

    const symbol = strategySymbol || 'NIFTY';

    // ── Execute each leg via broker ───────────────────────────────────
    const executionResults: {
      legIndex: number;
      legLabel: string;
      success: boolean;
      orderId?: string;
      message: string;
      status?: string;
      totalQuantity?: number;
      totalValue?: number;
    }[] = [];

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const { type, action, strike, premium, quantity } = leg;

      const transactionType = action === 'buy' ? 'BUY' : 'SELL';
      const legLabel = `${action === 'buy' ? '▲' : '▼'}${type} ${strike}`;

      try {
        if (!env.isMock) {
          // Try real broker
          const broker = await getBroker();
          const orderPayload = {
            symbol: type === 'FUTURE' ? symbol : `${symbol}${new Date().getTime()}`,
            exchange: 'NFO' as const,
            transactionType: transactionType as 'BUY' | 'SELL',
            quantity: quantity * (leg.lotSize || 50),
            price: premium,
            productType: (productType || 'NRML') as 'CNC' | 'MIS' | 'NRML',
            orderType: (orderType || 'MARKET') as 'LIMIT' | 'MARKET' | 'SL' | 'SLM',
          };
          const brokerResult = await broker.placeOrder(orderPayload);
          executionResults.push({
            legIndex: i,
            legLabel,
            success: brokerResult.status !== 'rejected',
            orderId: brokerResult.id,
            message: brokerResult.message,
            status: brokerResult.status,
            totalQuantity: quantity * (leg.lotSize || 50),
            totalValue: premium * quantity * (leg.lotSize || 50),
          });
        } else {
          // Mock execution
          const lotSize = leg.lotSize || 50;
          const totalQuantity = quantity * lotSize;
          const totalValue = premium * totalQuantity;
          const orderId = `FNO_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}_L${i}`;
          executionResults.push({
            legIndex: i,
            legLabel,
            success: true,
            orderId,
            message: `${action.toUpperCase()} ${type} ${strike}: ${quantity} lot(s) @ ₹${premium}`,
            status: 'confirmed',
            totalQuantity,
            totalValue,
          });
        }
      } catch (error: any) {
        executionResults.push({
          legIndex: i,
          legLabel,
          success: false,
          message: `Execution failed: ${error.message}`,
          status: 'rejected',
        });
      }
    }

    // ── Summary ────────────────────────────────────────────────────────
    const successful = executionResults.filter(r => r.success).length;
    const failed = executionResults.filter(r => !r.success).length;
    const totalValue = executionResults.reduce((s, r) => s + (r.totalValue || 0), 0);

    res.json({
      strategyName: req.body.name || 'Custom Strategy',
      totalLegs: legs.length,
      successful,
      failed,
      totalValue,
      legs: executionResults,
      executedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to execute strategy' });
  }
});

// POST /api/fno/strategy/analyze — Analyze a multi-leg strategy
router.post('/strategy/analyze', (req: Request, res: Response) => {
  try {
    const { legs, spotPrice } = req.body;

    if (!legs || !Array.isArray(legs) || legs.length < 1) {
      res.status(400).json({ error: 'At least one leg is required' });
      return;
    }

    // Validate each leg
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];

      if (!leg || typeof leg !== 'object') {
        res.status(400).json({ error: `Leg at index ${i} must be an object` });
        return;
      }

      const { type, strike, action, premium, quantity } = leg;

      if (!type || !isValidFnoType(type)) {
        res.status(400).json({
          error: `Leg ${i}: invalid type "${type}". Must be one of: ${VALID_FNO_TYPES.join(', ')}`,
        });
        return;
      }

      if (!action || !isValidAction(action)) {
        res.status(400).json({
          error: `Leg ${i}: invalid action "${action}". Must be one of: ${VALID_ACTIONS.join(', ')}`,
        });
        return;
      }

      if (strike === undefined || strike === null || !isValidNumber(strike) || strike < 0) {
        res.status(400).json({
          error: `Leg ${i}: strike must be a non-negative number`,
        });
        return;
      }

      if (premium === undefined || premium === null || !isValidNumber(premium)) {
        res.status(400).json({
          error: `Leg ${i}: premium must be a number`,
        });
        return;
      }

      if (quantity === undefined || quantity === null || !isValidNumber(quantity) || !Number.isInteger(quantity) || quantity < 1) {
        res.status(400).json({
          error: `Leg ${i}: quantity must be a positive integer`,
        });
        return;
      }
    }

    const price = spotPrice && isValidNumber(spotPrice) && spotPrice > 0
      ? spotPrice
      : 23456.80;
    const range = price * 0.15; // ±7.5% range
    const step = range / 40;
    const startPrice = price - range / 2;

    // Calculate P&L at each underlying price point
    const pnlPoints: { underlyingPrice: number; pnl: number; legPnls: number[] }[] = [];

    for (let i = 0; i <= 40; i++) {
      const underlyingPrice = Math.round((startPrice + i * step) * 100) / 100;
      const legPnls: number[] = [];

      for (const leg of legs) {
        const { type, strike, action, premium, quantity } = leg;
        const multiplier = action === 'sell' ? -1 : 1; // buyer pays premium, seller receives
        let pnl = 0;

        if (type === 'FUTURE') {
          // Futures P&L
          pnl = (underlyingPrice - strike) * (action === 'buy' ? 1 : -1) * quantity;
        } else if (type === 'CE') {
          const intrinsic = Math.max(0, underlyingPrice - strike);
          pnl = ((intrinsic - premium) * multiplier) * quantity;
        } else if (type === 'PE') {
          const intrinsic = Math.max(0, strike - underlyingPrice);
          pnl = ((intrinsic - premium) * multiplier) * quantity;
        }

        legPnls.push(Math.round(pnl * 100) / 100);
      }

      const totalPnl = Math.round(legPnls.reduce((s, p) => s + p, 0) * 100) / 100;
      pnlPoints.push({ underlyingPrice, pnl: totalPnl, legPnls });
    }

    // Calculate max profit, max loss, breakevens
    const pnls = pnlPoints.map(p => p.pnl);
    const maxProfit = Math.max(...pnls);
    const maxLoss = Math.min(...pnls);

    // Find breakeven points (where P&L crosses zero)
    const breakevenPoints: number[] = [];
    for (let i = 1; i < pnlPoints.length; i++) {
      const prev = pnlPoints[i - 1];
      const curr = pnlPoints[i];
      if ((prev.pnl <= 0 && curr.pnl >= 0) || (prev.pnl >= 0 && curr.pnl <= 0)) {
        // Linear interpolation
        const fraction = Math.abs(prev.pnl) / (Math.abs(prev.pnl) + Math.abs(curr.pnl));
        const bePrice = prev.underlyingPrice + (curr.underlyingPrice - prev.underlyingPrice) * fraction;
        breakevenPoints.push(Math.round(bePrice * 100) / 100);
      }
    }

    // Determine bias
    const pnlAtStart = pnlPoints[0].pnl;
    const pnlAtEnd = pnlPoints[pnlPoints.length - 1].pnl;
    const isBullish = pnlAtEnd > pnlAtStart;
    const isBearish = pnlAtEnd < pnlAtStart;
    const isNeutral = !isBullish && !isBearish;

    res.json({
      spotPrice: price,
      maxProfit: Math.round(maxProfit * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      maxProfitPercent: price > 0 ? Math.round((maxProfit / price) * 10000) / 100 : 0,
      maxLossPercent: price > 0 ? Math.round((maxLoss / price) * 10000) / 100 : 0,
      breakevenPoints,
      isBullish,
      isBearish,
      isNeutral,
      totalLegs: legs.length,
      pnlChart: pnlPoints,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to analyze strategy' });
  }
});

// GET /api/fno/scanner?symbol=NIFTY&expiry=<ISO_DATE>
router.get('/scanner', (req: Request, res: Response) => {
  try {
    const symbol = (req.query.symbol as string) || 'NIFTY';
    const expiry = (req.query.expiry as string);

    // Spot price lookup
    const spotPriceMap: Record<string, number> = {
      NIFTY: 23456.80,
      BANKNIFTY: 49234.10,
      RELIANCE: 2890.50,
      HDFCBANK: 1678.90,
      INFY: 1567.80,
      TCS: 3890.00,
      SBIN: 789.50,
      TATAMOTORS: 945.20,
      BAJFINANCE: 6789.00,
      ITC: 478.90,
    };
    const spotPrice = spotPriceMap[symbol] || 1000;

    // Validate expiry if provided — must happen before fallback generation
    if (expiry && !isValidDateString(expiry)) {
      res.status(400).json({
        error: 'Invalid expiry date format. Use ISO 8601 date string (e.g. 2026-07-02T00:00:00.000Z)',
      });
      return;
    }

    // Resolve expiry
    let targetExpiry = expiry;
    if (!targetExpiry) {
      const expiries = generateExpiries();
      targetExpiry = expiries[0]?.date || getWeeklyExpiry().toISOString();
    }

    // Generate the option chain
    const chain = generateOptionChain(symbol, targetExpiry, spotPrice);

    // Run the scanner
    const result = scanMarket(chain, symbol);

    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to scan options market' });
  }
});

// GET /api/fno/prebuilt-strategies
router.get('/prebuilt-strategies', (_req: Request, res: Response) => {
  try {
    const strategies = [
      {
        id: 'long_call',
        name: 'Long Call',
        description: 'Buy a call option. Profit if underlying rises above breakeven.',
        riskCategory: 'moderate',
        isBullish: true,
        isBearish: false,
        isNeutral: false,
        legs: [{ type: 'CE', action: 'buy', count: 1 }],
      },
      {
        id: 'long_put',
        name: 'Long Put',
        description: 'Buy a put option. Profit if underlying falls below breakeven.',
        riskCategory: 'moderate',
        isBullish: false,
        isBearish: true,
        isNeutral: false,
        legs: [{ type: 'PE', action: 'buy', count: 1 }],
      },
      {
        id: 'short_call',
        name: 'Short Call',
        description: 'Sell a call option. Profit if underlying stays below strike. Unlimited risk.',
        riskCategory: 'high',
        isBullish: false,
        isBearish: false,
        isNeutral: true,
        legs: [{ type: 'CE', action: 'sell', count: 1 }],
      },
      {
        id: 'short_put',
        name: 'Short Put',
        description: 'Sell a put option. Profit if underlying stays above strike. Significant risk.',
        riskCategory: 'high',
        isBullish: false,
        isBearish: false,
        isNeutral: true,
        legs: [{ type: 'PE', action: 'sell', count: 1 }],
      },
      {
        id: 'bull_call_spread',
        name: 'Bull Call Spread',
        description: 'Buy ATM call + Sell OTM call. Defined risk, defined reward. Bullish.',
        riskCategory: 'low',
        isBullish: true,
        isBearish: false,
        isNeutral: false,
        legs: [{ type: 'CE', action: 'buy', count: 1 }, { type: 'CE', action: 'sell', count: 1 }],
      },
      {
        id: 'bear_put_spread',
        name: 'Bear Put Spread',
        description: 'Buy ATM put + Sell OTM put. Defined risk, defined reward. Bearish.',
        riskCategory: 'low',
        isBullish: false,
        isBearish: true,
        isNeutral: false,
        legs: [{ type: 'PE', action: 'buy', count: 1 }, { type: 'PE', action: 'sell', count: 1 }],
      },
      {
        id: 'long_straddle',
        name: 'Long Straddle',
        description: 'Buy ATM call + Buy ATM put. Profits from large moves in either direction.',
        riskCategory: 'moderate',
        isBullish: false,
        isBearish: false,
        isNeutral: true,
        legs: [{ type: 'CE', action: 'buy', count: 1 }, { type: 'PE', action: 'buy', count: 1 }],
      },
      {
        id: 'long_strangle',
        name: 'Long Strangle',
        description: 'Buy OTM call + Buy OTM put. Cheaper than straddle, needs larger move.',
        riskCategory: 'moderate',
        isBullish: false,
        isBearish: false,
        isNeutral: true,
        legs: [{ type: 'CE', action: 'buy', count: 1 }, { type: 'PE', action: 'buy', count: 1 }],
      },
      {
        id: 'iron_condor',
        name: 'Iron Condor',
        description: 'Sell OTM put spread + Sell OTM call spread. Profits in range-bound markets.',
        riskCategory: 'low',
        isBullish: false,
        isBearish: false,
        isNeutral: true,
        legs: [
          { type: 'PE', action: 'sell', count: 1 },
          { type: 'PE', action: 'buy', count: 1 },
          { type: 'CE', action: 'sell', count: 1 },
          { type: 'CE', action: 'buy', count: 1 },
        ],
      },
      {
        id: 'covered_call',
        name: 'Covered Call',
        description: 'Own stock + Sell call option. Generates income with capped upside.',
        riskCategory: 'low',
        isBullish: false,
        isBearish: false,
        isNeutral: true,
        legs: [{ type: 'FUTURE', action: 'buy', count: 1 }, { type: 'CE', action: 'sell', count: 1 }],
      },
    ];

    res.json(strategies);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch prebuilt strategies' });
  }
});

// ──── Strategy Persistence (In-Memory Storage) ─────────────────────────────

interface PersistedStrategy {
  id: string;
  name: string;
  description: string;
  symbol?: string;
  createdAt: string;
  updatedAt: string;
  spotPrice: number;
  legs: {
    type: string;
    action: string;
    strike: number;
    premium: number;
    quantity: number;
    lotSize: number;
    expiry: string;
  }[];
  backtestSnapshot?: {
    winRate: number;
    sharpeRatio: number;
    maxDrawdownPercent: number;
    profitFactor: number;
    totalPnl: number;
  };
  isShared: boolean;
  shareId?: string;
  tags?: string[];
  userId: string;
}

const strategyStore: PersistedStrategy[] = [];

function generateStrategyId(): string {
  return `strat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// GET /api/fno/strategies — List all saved strategies for current user
router.get('/strategies', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default_user';
    const strategies = strategyStore
      .filter(s => s.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(strategies);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch saved strategies' });
  }
});

// POST /api/fno/strategies — Save a new strategy
router.post('/strategies', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default_user';
    const { name, description, symbol, spotPrice, legs, backtestSnapshot, tags } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (!legs || !Array.isArray(legs) || legs.length === 0) {
      res.status(400).json({ error: 'At least one leg is required' });
      return;
    }
    if (!isValidNumber(spotPrice) || spotPrice <= 0) {
      res.status(400).json({ error: 'spotPrice must be a positive number' });
      return;
    }

    const now = new Date().toISOString();
    const strategy: PersistedStrategy = {
      id: generateStrategyId(),
      name,
      description: description || '',
      symbol: symbol || 'NIFTY',
      createdAt: now,
      updatedAt: now,
      spotPrice,
      legs,
      backtestSnapshot,
      isShared: false,
      tags: Array.isArray(tags) ? tags : [],
      userId,
    };

    strategyStore.push(strategy);
    res.status(201).json(strategy);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to save strategy' });
  }
});

// PUT /api/fno/strategies/:id — Update an existing strategy
router.put('/strategies/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default_user';
    const { id } = req.params;
    const index = strategyStore.findIndex(s => s.id === id && s.userId === userId);

    if (index === -1) {
      res.status(404).json({ error: 'Strategy not found' });
      return;
    }

    const updates = req.body;

    // Validate legs if provided
    if (updates.legs !== undefined) {
      if (!Array.isArray(updates.legs) || updates.legs.length === 0) {
        res.status(400).json({ error: 'At least one leg is required' });
        return;
      }

      for (let i = 0; i < updates.legs.length; i++) {
        const leg = updates.legs[i];

        if (!leg || typeof leg !== 'object') {
          res.status(400).json({ error: `Leg at index ${i} must be an object` });
          return;
        }

        const { type, strike, action, premium, quantity } = leg;

        if (!type || !isValidFnoType(type)) {
          res.status(400).json({
            error: `Leg ${i}: invalid type "${type}". Must be one of: ${VALID_FNO_TYPES.join(', ')}`,
          });
          return;
        }

        if (!action || !isValidAction(action)) {
          res.status(400).json({
            error: `Leg ${i}: invalid action "${action}". Must be one of: ${VALID_ACTIONS.join(', ')}`,
          });
          return;
        }

        if (strike === undefined || strike === null || !isValidNumber(strike) || strike < 0) {
          res.status(400).json({
            error: `Leg ${i}: strike must be a non-negative number`,
          });
          return;
        }

        if (premium === undefined || premium === null || !isValidNumber(premium)) {
          res.status(400).json({
            error: `Leg ${i}: premium must be a number`,
          });
          return;
        }

        if (quantity === undefined || quantity === null || !isValidNumber(quantity) || !Number.isInteger(quantity) || quantity < 1) {
          res.status(400).json({
            error: `Leg ${i}: quantity must be a positive integer`,
          });
          return;
        }
      }
    }

    strategyStore[index] = {
      ...strategyStore[index],
      ...updates,
      id,
      userId,
      updatedAt: new Date().toISOString(),
    };

    res.json(strategyStore[index]);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to update strategy' });
  }
});

// GET /api/fno/strategies/shared/:shareId — Load a shared strategy by share ID (must be BEFORE :id)
router.get('/strategies/shared/:shareId', (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;
    const strategy = strategyStore.find(s => s.shareId === shareId && s.isShared);

    if (!strategy) {
      res.status(404).json({ error: 'Shared strategy not found or has been unshared' });
      return;
    }

    const { userId, ...publicStrategy } = strategy;
    res.json(publicStrategy);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to load shared strategy' });
  }
});

// GET /api/fno/strategies/:id — Get a single strategy by ID
router.get('/strategies/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default_user';
    const { id } = req.params;
    const strategy = strategyStore.find(s => s.id === id && s.userId === userId);

    if (!strategy) {
      res.status(404).json({ error: 'Strategy not found' });
      return;
    }

    res.json(strategy);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch strategy' });
  }
});

// DELETE /api/fno/strategies/:id — Delete a saved strategy
router.delete('/strategies/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default_user';
    const { id } = req.params;
    const index = strategyStore.findIndex(s => s.id === id && s.userId === userId);

    if (index === -1) {
      res.status(404).json({ error: 'Strategy not found' });
      return;
    }

    strategyStore.splice(index, 1);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to delete strategy' });
  }
});

// POST /api/fno/strategies/:id/share — Share a strategy publicly
router.post('/strategies/:id/share', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default_user';
    const { id } = req.params;
    const strategy = strategyStore.find(s => s.id === id && s.userId === userId);

    if (!strategy) {
      res.status(404).json({ error: 'Strategy not found' });
      return;
    }

    if (!strategy.shareId) {
      strategy.shareId = `share_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    strategy.isShared = true;
    strategy.updatedAt = new Date().toISOString();

    const shareUrl = `https://toroloom.app/strategies/shared/${strategy.shareId}`;
    res.json({ shareId: strategy.shareId, shareUrl });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to share strategy' });
  }
});

// POST /api/fno/strategies/:id/unshare — Unshare a strategy
router.post('/strategies/:id/unshare', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'default_user';
    const { id } = req.params;
    const strategy = strategyStore.find(s => s.id === id && s.userId === userId);

    if (!strategy) {
      res.status(404).json({ error: 'Strategy not found' });
      return;
    }

    strategy.isShared = false;
    strategy.updatedAt = new Date().toISOString();
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to unshare strategy' });
  }
});

// GET /api/fno/positions — Get open F&O positions
router.get('/positions', (_req: Request, res: Response) => {
  try {
    // Return mock F&O positions
    const positions = [
      {
        id: 'fno_pos_1',
        symbol: 'NIFTY',
        type: 'CE',
        strike: 23500,
        expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        action: 'buy',
        quantity: 1,
        lotSize: 50,
        entryPrice: 185.50,
        currentPrice: 210.30,
        premium: 185.50,
        pnl: 1240,
        pnlPercent: 13.37,
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'fno_pos_2',
        symbol: 'BANKNIFTY',
        type: 'PE',
        strike: 49000,
        expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        action: 'sell',
        quantity: 1,
        lotSize: 25,
        entryPrice: 320.00,
        currentPrice: 245.50,
        premium: 320.00,
        pnl: 1862.50,
        pnlPercent: 23.28,
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'fno_pos_3',
        symbol: 'RELIANCE',
        type: 'FUTURE',
        strike: null,
        expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        action: 'buy',
        quantity: 2,
        lotSize: 1000,
        entryPrice: 2900.00,
        currentPrice: 2885.00,
        premium: null,
        pnl: -30000,
        pnlPercent: -5.17,
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    res.json(positions);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch positions' });
  }
});

export default router;
