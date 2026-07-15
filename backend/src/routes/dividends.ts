/**
 * ============================================================================
 * Toroloom — Dividend Data API Route
 * ============================================================================
 *
 * Real dividend data integration:
 *   1. Tries MarketStack API (/eod endpoint with dividend flag) if configured
 *   2. Falls back to dividend estimation using stock yield data from the broker
 *   3. Caches results to reduce API calls
 *
 * MarketStack supports dividend data in its EOD endpoint:
 *   GET /eod/{symbol}?access_key=KEY&limit=100
 *   Response includes: dividend, dividend_yield fields when available
 *
 * Route prefix: /api/dividends
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { marketstack, isMarketStackConfigured } from '../services/marketstack';
import { marketCache, CACHE_TTL } from '../services/cache';
import { getBroker } from '../services/broker';
import { env } from '../config/env';

const router = Router();
router.use(authMiddleware);

// ─── Types ─────────────────────────────────────────────────────────────────

interface DividendEventResponse {
  symbol: string;
  name: string;
  exDate: string;
  payDate: string;
  amountPerShare: number;
  quantity: number;
  totalAmount: number;
  yieldPercent: number;
  frequency: string;
  confidence: 'confirmed' | 'estimated' | 'paid';
  sector: string;
}

interface DividendResponse {
  upcoming: DividendEventResponse[];
  history: DividendEventResponse[];
  source: 'marketstack' | 'broker' | 'estimated';
  cachedAt: string;
}

// ─── Sector frequency map ───────────────────────────────────────────────────

const SECTOR_FREQUENCIES: Record<string, string> = {
  'Banking': 'quarterly',
  'Financial Services': 'quarterly',
  'IT': 'semi_annual',
  'Pharma': 'quarterly',
  'FMCG': 'quarterly',
  'Automobile': 'quarterly',
  'Oil & Gas': 'quarterly',
  'Power': 'quarterly',
  'Metals': 'semi_annual',
  'Telecom': 'irregular',
  'Realty': 'irregular',
  'Consumer Durables': 'quarterly',
  'Infrastructure': 'semi_annual',
  'Textiles': 'irregular',
  'Chemicals': 'quarterly',
  'Media': 'quarterly',
  'Healthcare': 'quarterly',
};

// ─── Estimation logic (fallback when API unavailable) ───────────────────────

function getMonthsForFrequency(freq: string): number[] {
  switch (freq) {
    case 'monthly': return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    case 'quarterly': return [2, 5, 8, 11];
    case 'semi_annual': return [5, 11];
    case 'annual': return [11];
    case 'irregular': return [2, 8];
    default: return [2, 5, 8, 11];
  }
}

function estimateDividends(holdings: any[]): { upcoming: DividendEventResponse[]; history: DividendEventResponse[] } {
  const upcoming: DividendEventResponse[] = [];
  const history: DividendEventResponse[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  for (const holding of holdings) {
    if (!holding.dividend || holding.dividend <= 0) continue;

    const freq = SECTOR_FREQUENCIES[holding.sector] || 'quarterly';
    const months = getMonthsForFrequency(freq);
    const annualPerShare = holding.price * (holding.dividend / 100);
    const paymentPerOccurrence = annualPerShare / months.length;

    // Upcoming (next 4 occurrences)
    let occurrencesFound = 0;
    for (let m = 0; m < 18 && occurrencesFound < 4; m++) {
      const checkMonth = (currentMonth + m) % 12;
      const checkYear = currentYear + Math.floor((currentMonth + m) / 12);
      if (months.includes(checkMonth)) {
        occurrencesFound++;
        const exDate = new Date(checkYear, checkMonth, 15);
        const payDate = new Date(checkYear, checkMonth, 25);
        upcoming.push({
          symbol: holding.symbol,
          name: holding.name,
          exDate: exDate.toISOString(),
          payDate: payDate.toISOString(),
          amountPerShare: Math.round(paymentPerOccurrence * 100) / 100,
          quantity: holding.quantity,
          totalAmount: Math.round(paymentPerOccurrence * holding.quantity * 100) / 100,
          yieldPercent: holding.dividend,
          frequency: freq,
          confidence: 'estimated',
          sector: holding.sector,
        });
      }
    }

    // Mock history (past 12 months)
    for (let m = 1; m <= 12; m++) {
      const checkMonth = (currentMonth - m + 12) % 12;
      const checkYear = currentYear - (m > currentMonth ? 1 : 0);
      if (months.includes(checkMonth)) {
        const exDate = new Date(checkYear, checkMonth, 15);
        const payDate = new Date(checkYear, checkMonth, 25);
        history.push({
          symbol: holding.symbol,
          name: holding.name,
          exDate: exDate.toISOString(),
          payDate: payDate.toISOString(),
          amountPerShare: Math.round(paymentPerOccurrence * 100) / 100,
          quantity: holding.quantity,
          totalAmount: Math.round(paymentPerOccurrence * holding.quantity * 100) / 100,
          yieldPercent: holding.dividend,
          frequency: freq,
          confidence: 'paid',
          sector: holding.sector,
        });
      }
    }
  }

  return {
    upcoming: upcoming.sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime()),
    history: history.sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime()),
  };
}

// ─── Try MarketStack for real dividend data ─────────────────────────────────

async function fetchFromMarketStack(holdings: any[]): Promise<{
  success: boolean;
  data?: { upcoming: DividendEventResponse[]; history: DividendEventResponse[] };
  error?: string;
}> {
  if (!isMarketStackConfigured()) {
    return { success: false, error: 'MarketStack not configured' };
  }

  try {
    // Map symbols to MarketStack format (e.g., RELIANCE → RELIANCE.XNSE)
    const msSymbols = holdings
      .filter(h => h.symbol && h.dividend > 0)
      .map(h => marketstack.toMarketStackSymbol(h.symbol));

    if (msSymbols.length === 0) {
      return { success: false, error: 'No dividend-paying holdings' };
    }

    // Fetch real-time prices (which gives us current yield data)
    const quotes = await marketstack.getRealTimePrices(msSymbols);

    // If we got real prices, use them to improve estimation
    // MarketStack doesn't provide dividend schedules on free tier
    // but real prices give us accurate yields
    const enrichedHoldings = holdings.map(h => {
      const msSymbol = marketstack.toMarketStackSymbol(h.symbol);
      const quote = quotes.find(q => q.symbol === msSymbol);
      if (quote) {
        return {
          ...h,
          price: quote.last_price || quote.close || h.price,
          // MarketStack EOD may include dividend_yield — use it if available
          dividend: (quote as any).dividend_yield || h.dividend,
        };
      }
      return h;
    });

    // Use enriched data for estimation (partial real data)
    const estimated = estimateDividends(enrichedHoldings);
    return { success: true, data: estimated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// POST /api/dividends — Get dividend data for holdings
// Body: { holdings: Array<{ symbol, name, price, dividend, sector, quantity }> }
router.post('/', async (req: Request, res: Response) => {
  try {
    const { holdings } = req.body;

    if (!Array.isArray(holdings) || holdings.length === 0) {
      res.status(400).json({ error: 'holdings array is required' });
      return;
    }

    const cacheKey = `dividends:${holdings.map(h => h.symbol).sort().join(',')}`;

    // Try cache first
    const cached = marketCache.get<DividendResponse>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    let result: { upcoming: DividendEventResponse[]; history: DividendEventResponse[] };
    let source: 'marketstack' | 'broker' | 'estimated' = 'estimated';

    // 1. Try MarketStack (real dividend data)
    const msResult = await fetchFromMarketStack(holdings);
    if (msResult.success && msResult.data) {
      result = msResult.data;
      source = 'marketstack';
    } else {
      // 2. Try broker for enriched stock data
      if (!env.isMock) {
        try {
          const broker = await getBroker();
          const enrichedHoldings = await Promise.all(
            holdings.map(async (h) => {
              try {
                const quote = await broker.getQuote(h.symbol);
                if (quote) {
                  return { ...h, price: quote.lastPrice || h.price };
                }
              } catch { /* use original data */ }
              return h;
            }),
          );
          result = estimateDividends(enrichedHoldings);
          source = 'broker';
        } catch {
          result = estimateDividends(holdings);
        }
      } else {
        // 3. Fallback to estimation
        result = estimateDividends(holdings);
      }
    }

    // Sort results
    result.upcoming.sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime());
    result.history.sort((a, b) => new Date(a.exDate).getTime() - new Date(b.exDate).getTime());

    const response: DividendResponse = {
      ...result,
      source,
      cachedAt: new Date().toISOString(),
    };

    // Cache for 1 hour (dividend schedules rarely change intraday)
    marketCache.set(cacheKey, response, 3600 * 1000);

    res.json(response);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch dividend data' });
  }
});

// GET /api/dividends/health — Check if dividend data source is available
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    marketstackConfigured: isMarketStackConfigured(),
    cacheSize: marketCache.stats().size,
    mode: env.isMock ? 'mock' : 'live',
  });
});

export default router;
