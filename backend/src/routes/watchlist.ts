import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { StockInfo } from '../services/broker/interface';

// Inline mock stocks for watchlist enrichment to avoid cross-dependency
const mockStockData: StockInfo[] = [
  { id: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', sector: 'Energy', price: 2890.50, change: 45.20, changePercent: 1.59, isPositive: true, marketCap: '₹19,56,000 Cr', volume: '12.5M', high52: 3020.00, low52: 2200.00, pe: 28.5, pb: 3.2, dividend: 0.85 },
  { id: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'Technology', price: 3890.00, change: -34.50, changePercent: -0.88, isPositive: false, marketCap: '₹14,20,000 Cr', volume: '8.2M', high52: 4200.00, low52: 3300.00, pe: 35.2, pb: 12.5, dividend: 1.20 },
  { id: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', sector: 'Finance', price: 1678.90, change: 23.45, changePercent: 1.42, isPositive: true, marketCap: '₹9,35,000 Cr', volume: '15.1M', high52: 1800.00, low52: 1360.00, pe: 18.9, pb: 2.8, dividend: 1.05 },
  { id: 'INFY', symbol: 'INFY', name: 'Infosys Ltd.', sector: 'Technology', price: 1567.80, change: 28.90, changePercent: 1.88, isPositive: true, marketCap: '₹6,52,000 Cr', volume: '10.8M', high52: 1700.00, low52: 1350.00, pe: 28.1, pb: 7.9, dividend: 1.80 },
  { id: 'ICICIBANK', symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', sector: 'Finance', price: 1123.45, change: -12.30, changePercent: -1.08, isPositive: false, marketCap: '₹7,85,000 Cr', volume: '18.5M', high52: 1250.00, low52: 980.00, pe: 16.5, pb: 2.3, dividend: 0.95 },
  { id: 'SBIN', symbol: 'SBIN', name: 'State Bank of India', sector: 'Finance', price: 789.50, change: 15.80, changePercent: 2.04, isPositive: true, marketCap: '₹7,04,000 Cr', volume: '22.3M', high52: 850.00, low52: 640.00, pe: 10.2, pb: 1.5, dividend: 2.15 },
  { id: 'BAJFINANCE', symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd.', sector: 'Finance', price: 6789.00, change: 123.40, changePercent: 1.85, isPositive: true, marketCap: '₹4,12,000 Cr', volume: '6.8M', high52: 7500.00, low52: 5800.00, pe: 32.4, pb: 5.2, dividend: 0.60 },
  { id: 'WIPRO', symbol: 'WIPRO', name: 'Wipro Ltd.', sector: 'Technology', price: 456.30, change: 8.70, changePercent: 1.94, isPositive: true, marketCap: '₹2,40,000 Cr', volume: '11.2M', high52: 520.00, low52: 380.00, pe: 24.3, pb: 4.1, dividend: 0.75 },
];

interface WatchlistItem {
  id: string;
  name: string;
  stocks: string[]; // stock symbols
  createdAt: string;
}

interface UserWatchlists {
  [userId: string]: WatchlistItem[];
}

// In-memory watchlist storage (per user)
const watchlists: UserWatchlists = {
  user_1: [
    { id: 'w1', name: 'My Watchlist', stocks: ['RELIANCE', 'INFY', 'SBIN', 'BAJFINANCE'], createdAt: '2025-01-10' },
    { id: 'w2', name: 'Tech Stocks', stocks: ['TCS', 'INFY', 'WIPRO'], createdAt: '2025-02-15' },
  ],
};

const router = Router();
router.use(authMiddleware);

function getUserWatchlists(userId: string): WatchlistItem[] {
  if (!watchlists[userId]) {
    watchlists[userId] = [];
  }
  return watchlists[userId];
}

// GET /api/watchlist
router.get('/', (req: Request, res: Response) => {
  const userWatchlists = getUserWatchlists(req.user!.userId);
  // Enrich with full stock data
  const enriched = userWatchlists.map(w => ({
    ...w,
    stocks: w.stocks.map(symbol => {
      const stock = mockStockData.find((s: StockInfo) => s.symbol === symbol);
      return stock || { id: symbol, symbol, name: symbol, sector: '', price: 0, change: 0, changePercent: 0, isPositive: true, marketCap: '', volume: '', high52: 0, low52: 0, pe: 0, pb: 0, dividend: 0 };
    }),
  }));
  res.json(enriched);
});

// POST /api/watchlist
router.post('/', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Watchlist name is required' });
    return;
  }

  const userWatchlists = getUserWatchlists(req.user!.userId);
  const newWatchlist: WatchlistItem = {
    id: `w_${Date.now()}`,
    name,
    stocks: [],
    createdAt: new Date().toISOString(),
  };
  userWatchlists.push(newWatchlist);
  res.status(201).json(newWatchlist);
});

// POST /api/watchlist/:watchlistId/stocks
router.post('/:watchlistId/stocks', (req: Request, res: Response) => {
  const { symbol } = req.body;
  const userWatchlists = getUserWatchlists(req.user!.userId);
  const watchlist = userWatchlists.find(w => w.id === req.params.watchlistId);

  if (!watchlist) {
    res.status(404).json({ error: 'Watchlist not found' });
    return;
  }
  if (!symbol) {
    res.status(400).json({ error: 'Symbol is required' });
    return;
  }
  if (!watchlist.stocks.includes(symbol)) {
    watchlist.stocks.push(symbol);
  }
  res.json(watchlist);
});

// DELETE /api/watchlist/:watchlistId/stocks/:symbol
router.delete('/:watchlistId/stocks/:symbol', (req: Request, res: Response) => {
  const userWatchlists = getUserWatchlists(req.user!.userId);
  const watchlist = userWatchlists.find(w => w.id === req.params.watchlistId);

  if (!watchlist) {
    res.status(404).json({ error: 'Watchlist not found' });
    return;
  }

  watchlist.stocks = watchlist.stocks.filter(s => s !== req.params.symbol);
  res.json(watchlist);
});

// DELETE /api/watchlist/:watchlistId
router.delete('/:watchlistId', (req: Request, res: Response) => {
  const userWatchlists = getUserWatchlists(req.user!.userId);
  const idx = userWatchlists.findIndex(w => w.id === req.params.watchlistId);
  if (idx === -1) {
    res.status(404).json({ error: 'Watchlist not found' });
    return;
  }
  userWatchlists.splice(idx, 1);
  res.status(204).send();
});

export default router;
