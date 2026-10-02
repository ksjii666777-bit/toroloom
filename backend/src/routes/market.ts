import { Router, Request, Response } from 'express';
import { getBroker, resetBroker } from '../services/broker';
import { marketCache, CACHE_TTL } from '../services/cache';
import type { StockInfo } from '../services/broker/interface';

const router = Router();

// GET /api/market/indices
router.get('/indices', async (_req: Request, res: Response) => {
  try {
    const broker = await getBroker();
    const indices = await marketCache.getOrSet(
      'indices',
      () => broker.getIndices(),
      CACHE_TTL.INDICES,
    );
    res.json(indices);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch indices' });
  }
});

// GET /api/market/stocks
// Last-known-good resilience: if the broker's getStocks() fails (e.g. an
// upstream feed/session error — observed in production as an intermittent
// 500 while quotes/indices kept working), serve the previous successful
// snapshot instead of a hard 500 so the stock-list screen stays usable.
// The full error is always logged for root-cause analysis (Railway/Sentry).
let lastGoodStocks: StockInfo[] | null = null;

router.get('/stocks', async (_req: Request, res: Response) => {
  const fetchStocks = async (): Promise<StockInfo[]> => {
    const broker = await getBroker();
    return marketCache.getOrSet(
      'stocks',
      () => broker.getStocks(),
      CACHE_TTL.STOCKS,
    );
  };

  try {
    const stocks = await fetchStocks();
    lastGoodStocks = stocks;
    res.json(stocks);
  } catch (error: unknown) {
    console.error('[market/stocks] getStocks failed:', error);
    // The cached broker instance may be half-dead — its session expired
    // server-side (e.g. a daily-limited broker token) while isConnected()
    // still reports true, so getBroker() keeps handing it back. Reset it
    // once so the failover chain re-runs (ends on mock if all live brokers
    // are unavailable) before giving up.
    try {
      resetBroker();
      const stocks = await fetchStocks();
      lastGoodStocks = stocks;
      res.json(stocks);
      return;
    } catch (retryError: unknown) {
      console.error('[market/stocks] retry after broker reset failed:', retryError);
    }
    if (lastGoodStocks && lastGoodStocks.length > 0) {
      res.json(lastGoodStocks);
      return;
    }
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch stocks' });
  }
});

// GET /api/market/quote/:symbol
router.get('/quote/:symbol', async (req: Request, res: Response) => {
  try {
    const broker = await getBroker();
    const symbol = req.params.symbol as string;
    const quote = await marketCache.getOrSet(
      `quote:${symbol}`,
      () => broker.getQuote(symbol),
      CACHE_TTL.QUOTE,
    );
    res.json(quote);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch quote' });
  }
});

// GET /api/market/quotes?symbols=RELIANCE,TCS,INFY
router.get('/quotes', async (req: Request, res: Response) => {
  try {
    const symbolsParam = req.query.symbols as string | undefined;
    const symbols = (symbolsParam || '').split(',').filter(Boolean);
    if (symbols.length === 0) {
      res.status(400).json({ error: 'symbols query parameter is required (comma-separated)' });
      return;
    }

    // Check cache for each symbol; collect misses
    const cached: unknown[] = [];
    const misses: string[] = [];
    for (const symbol of symbols) {
      const cachedQuote = marketCache.get<any>(`quote:${symbol}`);
      if (cachedQuote !== undefined) {
        cached.push(cachedQuote);
      } else {
        misses.push(symbol);
      }
    }

    // Fetch only the symbols not in cache
    if (misses.length > 0) {
      const broker = await getBroker();
      const freshQuotes = await broker.getBulkQuotes(misses);
      for (const [symbol, quote] of freshQuotes) {
        marketCache.set(`quote:${symbol}`, quote, CACHE_TTL.BULK_QUOTES);
        cached.push(quote);
      }
    }

    res.json(cached);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch quotes' });
  }
});

// GET /api/market/ohlc/:symbol?interval=day&days=30
router.get('/ohlc/:symbol', async (req: Request, res: Response) => {
  try {
    const interval = (req.query.interval as string) || 'day';
    const daysParam = req.query.days as string;
    const days = parseInt(daysParam || '30') || 30;
    const symbol = req.params.symbol as string;
    const broker = await getBroker();
    const ohlc = await marketCache.getOrSet(
      `ohlc:${symbol}:${interval}:${days}`,
      () => broker.getOHLC(symbol, interval, days),
      CACHE_TTL.OHLC,
    );
    res.json(ohlc);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to fetch OHLC data' });
  }
});

// GET /api/market/search?q=RELIANCE
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    if (!query.trim()) {
      res.json([]);
      return;
    }
    const broker = await getBroker();
    const results = await marketCache.getOrSet(
      `search:${query.toLowerCase().trim()}`,
      () => broker.searchStocks(query),
      CACHE_TTL.SEARCH,
    );
    res.json(results);
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Search failed' });
  }
});

export default router;
