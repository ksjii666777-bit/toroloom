import { Router, Request, Response } from 'express';
import { getBroker } from '../services/broker';
import { marketCache, CACHE_TTL } from '../services/cache';

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
router.get('/stocks', async (_req: Request, res: Response) => {
  try {
    const broker = await getBroker();
    const stocks = await marketCache.getOrSet(
      'stocks',
      () => broker.getStocks(),
      CACHE_TTL.STOCKS,
    );
    res.json(stocks);
  } catch (error: unknown) {
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
