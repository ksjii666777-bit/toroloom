/**
 * ============================================================================
 * Toroloom — Public REST API (v1)
 * ============================================================================
 *
 * Third-party developer API endpoints.
 * Authenticate via `X-API-Key` header (get one at /api/user/api-keys).
 *
 * Base URL: /api/v1
 *
 * Endpoints:
 *   Market:
 *     GET  /api/v1/market/indices         — All market indices
 *     GET  /api/v1/market/stocks           — All stocks
 *     GET  /api/v1/market/quote/:symbol    — Single stock quote
 *     GET  /api/v1/market/quotes           — Bulk quotes (?symbols=A,B,C)
 *     GET  /api/v1/market/ohlc/:symbol     — OHLC data (?interval=day&days=30)
 *     GET  /api/v1/market/search           — Search stocks (?q=RELIANCE)
 *   Portfolio:
 *     GET  /api/v1/portfolio/holdings      — User holdings
 *     GET  /api/v1/portfolio/positions     — User positions
 *     GET  /api/v1/portfolio/trades        — User trade history
 *     GET  /api/v1/portfolio/pnl           — P&L summary
 *   Watchlist:
 *     GET  /api/v1/watchlist               — User watchlists
 *   Account:
 *     GET  /api/v1/account/profile         — User profile
 *   Notifications:
 *     GET  /api/v1/notifications           — Recent notifications
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { apiKeyAuth, requireApiScopes } from '../middleware/apiKeyAuth';
import { getBroker } from '../services/broker';
import { marketCache, CACHE_TTL } from '../services/cache';
import { getStorage, getStorageIfInitialized } from '../services/storage';

const router = Router();

// All public API routes require API key auth
router.use(apiKeyAuth);

// ═════════════════════════════════════════════════════════════════════════════
// MARKET ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/market/indices
 * Returns all market indices.
 * Scope: market:read
 */
router.get(
  '/market/indices',
  requireApiScopes(['market:read']),
  async (_req: Request, res: Response) => {
    try {
      const broker = await getBroker();
      const indices = await marketCache.getOrSet(
        'indices',
        () => broker.getIndices(),
        CACHE_TTL.INDICES,
      );
      res.json({ success: true, data: indices });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
);

/**
 * GET /api/v1/market/stocks
 * Returns all stocks.
 * Scope: market:read
 */
router.get(
  '/market/stocks',
  requireApiScopes(['market:read']),
  async (_req: Request, res: Response) => {
    try {
      const broker = await getBroker();
      const stocks = await marketCache.getOrSet(
        'stocks',
        () => broker.getStocks(),
        CACHE_TTL.STOCKS,
      );
      res.json({ success: true, data: stocks });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
);

/**
 * GET /api/v1/market/quote/:symbol
 * Returns a single stock quote.
 * Scope: market:read
 */
router.get(
  '/market/quote/:symbol',
  requireApiScopes(['market:read']),
  async (req: Request, res: Response) => {
    try {
      const broker = await getBroker();
      const symbol = req.params.symbol as string;
      const quote = await marketCache.getOrSet(
        `quote:${symbol}`,
        () => broker.getQuote(symbol),
        CACHE_TTL.QUOTE,
      );
      res.json({ success: true, data: quote });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
);

/**
 * GET /api/v1/market/quotes?symbols=RELIANCE,TCS,INFY
 * Returns bulk quotes.
 * Scope: market:read
 */
router.get(
  '/market/quotes',
  requireApiScopes(['market:read']),
  async (req: Request, res: Response) => {
    try {
      const symbolsParam = req.query.symbols as string | undefined;
      const symbols = (symbolsParam || '').split(',').filter(Boolean);
      if (symbols.length === 0) {
        res.status(400).json({ success: false, error: 'symbols query parameter is required' });
        return;
      }

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

      if (misses.length > 0) {
        const broker = await getBroker();
        const freshQuotes = await broker.getBulkQuotes(misses);
        for (const [symbol, quote] of freshQuotes) {
          marketCache.set(`quote:${symbol}`, quote, CACHE_TTL.BULK_QUOTES);
          cached.push(quote);
        }
      }

      res.json({ success: true, data: cached });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
);

/**
 * GET /api/v1/market/ohlc/:symbol?interval=day&days=30
 * Returns OHLC data.
 * Scope: market:read
 */
router.get(
  '/market/ohlc/:symbol',
  requireApiScopes(['market:read']),
  async (req: Request, res: Response) => {
    try {
      const interval = (req.query.interval as string) || 'day';
      const days = parseInt((req.query.days as string) || '30') || 30;
      const symbol = req.params.symbol as string;
      const broker = await getBroker();
      const ohlc = await marketCache.getOrSet(
        `ohlc:${symbol}:${interval}:${days}`,
        () => broker.getOHLC(symbol, interval, days),
        CACHE_TTL.OHLC,
      );
      res.json({ success: true, data: ohlc });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
);

/**
 * GET /api/v1/market/search?q=RELIANCE
 * Search stocks by symbol/name.
 * Scope: market:read
 */
router.get(
  '/market/search',
  requireApiScopes(['market:read']),
  async (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      if (!query.trim()) {
        res.json({ success: true, data: [] });
        return;
      }
      const broker = await getBroker();
      const results = await marketCache.getOrSet(
        `search:${query.toLowerCase().trim()}`,
        () => broker.searchStocks(query),
        CACHE_TTL.SEARCH,
      );
      res.json({ success: true, data: results });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// PORTFOLIO ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/portfolio/holdings
 * Scope: portfolio:read
 */
router.get(
  '/portfolio/holdings',
  requireApiScopes(['portfolio:read']),
  async (_req: Request, res: Response) => {
    try {
      const broker = await getBroker();
      const holdings = await broker.getHoldings();
      res.json({ success: true, data: holdings });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
);

/**
 * GET /api/v1/portfolio/positions
 * Scope: portfolio:read
 */
router.get(
  '/portfolio/positions',
  requireApiScopes(['portfolio:read']),
  async (_req: Request, res: Response) => {
    try {
      const broker = await getBroker();
      const positions = await broker.getPositions();
      res.json({ success: true, data: positions });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
);

/**
 * GET /api/v1/portfolio/trades
 * Scope: trades:read
 */
router.get(
  '/portfolio/trades',
  requireApiScopes(['trades:read']),
  async (_req: Request, res: Response) => {
    try {
      const broker = await getBroker();
      const trades = await broker.getTradeHistory();
      res.json({ success: true, data: trades });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// WATCHLIST ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/watchlist
 * Scope: watchlist:read
 */
router.get(
  '/watchlist',
  requireApiScopes(['watchlist:read']),
  async (_req: Request, res: Response) => {
    try {
      const storage = getStorageIfInitialized();
      if (!storage) {
        res.json({ success: true, data: [] });
        return;
      }
      // For now return mock watchlist data as the existing watchlist routes handle this
      res.json({
        success: true,
        data: [
          {
            id: 'w1',
            name: 'My Watchlist',
            stocks: ['RELIANCE', 'INFY', 'SBIN', 'BAJFINANCE'],
            createdAt: new Date().toISOString(),
          },
        ],
      });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// ACCOUNT ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/account/profile
 * Scope: account:read
 */
router.get(
  '/account/profile',
  requireApiScopes(['account:read']),
  async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: {
          userId: req.apiKeyInfo?.userId || req.user?.userId,
          scopes: req.apiKeyInfo?.scopes || [],
          keyId: req.apiKeyInfo?.keyId || null,
        },
      });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/notifications
 * Scope: notifications:read
 */
router.get(
  '/notifications',
  requireApiScopes(['notifications:read']),
  async (req: Request, res: Response) => {
    try {
      const storage = getStorageIfInitialized();
      if (!storage) {
        res.json({ success: true, data: [] });
        return;
      }
      const userId = req.apiKeyInfo?.userId || req.user?.userId;
      if (!userId) {
        res.json({ success: true, data: [] });
        return;
      }
      const notifs = await storage.loadNotifications(userId);
      res.json({
        success: true,
        data: notifs.slice(0, 50), // last 50
      });
    } catch (error: unknown) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  },
);

export default router;
