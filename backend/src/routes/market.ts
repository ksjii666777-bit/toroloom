import { Router, Request, Response } from 'express';
import { getBroker } from '../services/broker';

const router = Router();

// GET /api/market/indices
router.get('/indices', async (_req: Request, res: Response) => {
  try {
    const broker = await getBroker();
    const indices = await broker.getIndices();
    res.json(indices);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch indices' });
  }
});

// GET /api/market/stocks
router.get('/stocks', async (_req: Request, res: Response) => {
  try {
    const broker = await getBroker();
    const stocks = await broker.getStocks();
    res.json(stocks);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch stocks' });
  }
});

// GET /api/market/quote/:symbol
router.get('/quote/:symbol', async (req: Request, res: Response) => {
  try {
    const broker = await getBroker();
    const symbol = req.params.symbol as string;
    const quote = await broker.getQuote(symbol);
    res.json(quote);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch quote' });
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
    const broker = await getBroker();
    const quotes = await broker.getBulkQuotes(symbols);
    const result = Array.from(quotes.entries()).map(([, quote]) => quote);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch quotes' });
  }
});

// GET /api/market/ohlc/:symbol?interval=day&days=30
router.get('/ohlc/:symbol', async (req: Request, res: Response) => {
  try {
    const interval = (req.query.interval as string) || 'day';
    const daysParam = req.query.days as string;
    const days = parseInt(daysParam || '30') || 30;
    const broker = await getBroker();
    const symbol = req.params.symbol as string;
    const ohlc = await broker.getOHLC(symbol, interval, days);
    res.json(ohlc);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch OHLC data' });
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
    const results = await broker.searchStocks(query);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Search failed' });
  }
});

export default router;
