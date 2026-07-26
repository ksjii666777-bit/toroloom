/**
 * ============================================================================
 * Toroloom — Global Stocks Route (Europe & Asia-Pacific)
 * ============================================================================
 *
 * Provides European and Asian stock quotes via MarketStack API.
 * Falls back to mock data when the API is not configured.
 *
 * Endpoints:
 *   GET /api/global-stocks/europe        — Top European stocks
 *   GET /api/global-stocks/asia           — Top Asia-Pacific stocks
 *   GET /api/global-stocks/quote/:symbol  — Single stock quote
 *   GET /api/global-stocks/quotes         — Bulk quotes (comma-separated)
 *   GET /api/global-stocks/search?q=      — Search stocks by symbol/name
 *   GET /api/global-stocks/exchanges      — List supported exchanges
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { marketstack, isMarketStackConfigured } from '../services/marketstack';

const router = Router();

// ─── MarketStack exchange suffix map ──────────────────────────
// MarketStack uses MIC suffixes: .XLON for LSE, .XETR for Xetra, .XPAR for Euronext Paris
// .XSWX for SIX Swiss, .XTKS for TSE Tokyo, .XHKG for HKEX, .XNSE for NSE India
// Full list: https://marketstack.com/documentation#exchange_list

const EXCHANGE_SUFFIX: Record<string, string> = {
  // Europe
  LSE: '.XLON', Xetra: '.XETR', Euronext: '.XPAR',
  SIX: '.XSWX', BMEX: '.XWAR', MTA: '.XMIL',
  // Asia-Pacific
  TSE: '.XTKS', HKEX: '.XHKG', NSE: '.XNSE',
  KRX: '.XKRX', SGX: '.XSES', TWSE: '.XTAI',
  SET: '.XBKK', ASX: '.XASX',
};

const DEFAULT_EXCHANGE_SUFFIX = '.XLON'; // LSE default

function toMsSymbol(symbol: string, exchange?: string): string {
  const suffix = exchange ? (EXCHANGE_SUFFIX[exchange] || DEFAULT_EXCHANGE_SUFFIX) : DEFAULT_EXCHANGE_SUFFIX;
  const clean = symbol.replace(/[^A-Z0-9]/g, '');
  return clean + suffix;
}

// ─── Mock European Stocks (fallback when MarketStack is not configured) ──

const MOCK_EUROPEAN_STOCKS = [
  { symbol: 'ULVR', name: 'Unilever PLC', sector: 'Consumer', price: 48.25, change: 0.65, changePercent: 1.37, marketCap: '€125B', volume: '3.2M', pe: 20.5, dividend: 2.85, exchange: 'LSE', country: 'UK', currency: 'GBP', region: 'europe' },
  { symbol: 'SHEL', name: 'Shell PLC', sector: 'Energy', price: 32.80, change: -0.45, changePercent: -1.35, marketCap: '£205B', volume: '8.5M', pe: 11.2, dividend: 3.60, exchange: 'LSE', country: 'UK', currency: 'GBP', region: 'europe' },
  { symbol: 'AZN', name: 'AstraZeneca PLC', sector: 'Healthcare', price: 128.90, change: 1.80, changePercent: 1.42, marketCap: '£195B', volume: '2.8M', pe: 38.5, dividend: 1.90, exchange: 'LSE', country: 'UK', currency: 'GBP', region: 'europe' },
  { symbol: 'HSBA', name: 'HSBC Holdings PLC', sector: 'Finance', price: 7.45, change: 0.12, changePercent: 1.64, marketCap: '£138B', volume: '15.2M', pe: 14.8, dividend: 4.50, exchange: 'LSE', country: 'UK', currency: 'GBP', region: 'europe' },
  { symbol: 'SAP', name: 'SAP SE', sector: 'Technology', price: 195.40, change: 4.20, changePercent: 2.20, marketCap: '€235B', volume: '4.1M', pe: 42.5, dividend: 1.50, exchange: 'Xetra', country: 'Germany', currency: 'EUR', region: 'europe' },
  { symbol: 'SIE', name: 'Siemens AG', sector: 'Industrials', price: 178.60, change: -2.30, changePercent: -1.27, marketCap: '€142B', volume: '3.5M', pe: 28.2, dividend: 2.20, exchange: 'Xetra', country: 'Germany', currency: 'EUR', region: 'europe' },
  { symbol: 'AIR', name: 'Airbus SE', sector: 'Industrials', price: 158.30, change: 3.50, changePercent: 2.26, marketCap: '€125B', volume: '2.6M', pe: 32.8, dividend: 1.20, exchange: 'Euronext', country: 'France', currency: 'EUR', region: 'europe' },
  { symbol: 'MC', name: 'LVMH Moët Hennessy', sector: 'Consumer', price: 785.50, change: 12.40, changePercent: 1.60, marketCap: '€398B', volume: '1.2M', pe: 25.8, dividend: 1.80, exchange: 'Euronext', country: 'France', currency: 'EUR', region: 'europe' },
  { symbol: 'NESN', name: 'Nestlé SA', sector: 'Consumer', price: 98.60, change: -0.80, changePercent: -0.80, marketCap: 'CHF268B', volume: '5.8M', pe: 22.5, dividend: 2.60, exchange: 'SIX', country: 'Switzerland', currency: 'CHF', region: 'europe' },
  { symbol: 'ROG', name: 'Roche Holding AG', sector: 'Healthcare', price: 268.20, change: 3.80, changePercent: 1.44, marketCap: 'CHF218B', volume: '2.1M', pe: 18.5, dividend: 3.20, exchange: 'SIX', country: 'Switzerland', currency: 'CHF', region: 'europe' },
  { symbol: 'SAN', name: 'Banco Santander', sector: 'Finance', price: 4.82, change: 0.08, changePercent: 1.69, marketCap: '€72B', volume: '22.5M', pe: 8.5, dividend: 5.20, exchange: 'BMEX', country: 'Spain', currency: 'EUR', region: 'europe' },
  { symbol: 'ENI', name: 'Eni S.p.A.', sector: 'Energy', price: 15.80, change: -0.25, changePercent: -1.56, marketCap: '€52B', volume: '8.9M', pe: 9.8, dividend: 4.80, exchange: 'MTA', country: 'Italy', currency: 'EUR', region: 'europe' },
  { symbol: 'ASML', name: 'ASML Holding N.V.', sector: 'Semiconductors', price: 945.60, change: 28.50, changePercent: 3.11, marketCap: '€378B', volume: '1.8M', pe: 48.5, dividend: 0.85, exchange: 'Euronext', country: 'Netherlands', currency: 'EUR', region: 'europe' },
];

const MOCK_ASIAN_STOCKS = [
  { symbol: 'TM', name: 'Toyota Motor Corp.', sector: 'Automotive', price: 3450.00, change: 85.00, changePercent: 2.53, marketCap: '¥48.5T', volume: '15.2M', pe: 10.5, dividend: 2.80, exchange: 'TSE', country: 'Japan', currency: 'JPY', region: 'asia' },
  { symbol: 'SONY', name: 'Sony Group Corp.', sector: 'Technology', price: 14850.00, change: 320.00, changePercent: 2.20, marketCap: '¥18.2T', volume: '8.5M', pe: 28.5, dividend: 0.65, exchange: 'TSE', country: 'Japan', currency: 'JPY', region: 'asia' },
  { symbol: '9988', name: 'Alibaba Group', sector: 'Technology', price: 98.50, change: -2.30, changePercent: -2.28, marketCap: 'HK$1.95T', volume: '35.8M', pe: 15.2, dividend: 1.20, exchange: 'HKEX', country: 'Hong Kong', currency: 'HKD', region: 'asia' },
  { symbol: '0700', name: 'Tencent Holdings', sector: 'Technology', price: 445.60, change: 8.50, changePercent: 1.94, marketCap: 'HK$4.25T', volume: '22.1M', pe: 22.8, dividend: 0.55, exchange: 'HKEX', country: 'Hong Kong', currency: 'HKD', region: 'asia' },
  { symbol: 'BABA', name: 'Alibaba (NYSE)', sector: 'Technology', price: 112.30, change: -1.50, changePercent: -1.32, marketCap: '$285B', volume: '28.6M', pe: 14.8, dividend: 1.00, exchange: 'NYSE', country: 'China', currency: 'USD', region: 'asia' },
  { symbol: 'BIDU', name: 'Baidu Inc.', sector: 'Technology', price: 125.80, change: 3.20, changePercent: 2.61, marketCap: '$44B', volume: '5.2M', pe: 18.5, dividend: 0, exchange: 'NASDAQ', country: 'China', currency: 'USD', region: 'asia' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', price: 2890.50, change: 45.20, changePercent: 1.59, marketCap: '₹19.56L Cr', volume: '12.5M', pe: 28.5, dividend: 0.85, exchange: 'NSE', country: 'India', currency: 'INR', region: 'asia' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'Technology', price: 3890.00, change: -34.50, changePercent: -0.88, marketCap: '₹14.20L Cr', volume: '8.2M', pe: 35.2, dividend: 1.20, exchange: 'NSE', country: 'India', currency: 'INR', region: 'asia' },
  { symbol: '005930', name: 'Samsung Electronics', sector: 'Technology', price: 82500.00, change: 1200.00, changePercent: 1.48, marketCap: '₩490T', volume: '8.5M', pe: 16.5, dividend: 2.50, exchange: 'KRX', country: 'South Korea', currency: 'KRW', region: 'asia' },
  { symbol: 'D05', name: 'DBS Group Holdings', sector: 'Finance', price: 36.80, change: 0.45, changePercent: 1.24, marketCap: 'S$92B', volume: '3.5M', pe: 12.2, dividend: 3.80, exchange: 'SGX', country: 'Singapore', currency: 'SGD', region: 'asia' },
  { symbol: '2330', name: 'TSMC (Taiwan Semi.)', sector: 'Semiconductors', price: 895.00, change: 18.00, changePercent: 2.05, marketCap: 'NT$23.2T', volume: '22.1M', pe: 28.8, dividend: 1.80, exchange: 'TWSE', country: 'Taiwan', currency: 'TWD', region: 'asia' },
  { symbol: 'BHP', name: 'BHP Group Ltd.', sector: 'Mining', price: 45.60, change: -0.55, changePercent: -1.19, marketCap: 'A$228B', volume: '6.5M', pe: 14.2, dividend: 4.50, exchange: 'ASX', country: 'Australia', currency: 'AUD', region: 'asia' },
  { symbol: 'CBA', name: 'Commonwealth Bank', sector: 'Finance', price: 128.50, change: 1.80, changePercent: 1.42, marketCap: 'A$215B', volume: '4.2M', pe: 18.5, dividend: 3.20, exchange: 'ASX', country: 'Australia', currency: 'AUD', region: 'asia' },
];

// All global stocks combined for search
const ALL_MOCK = [...MOCK_EUROPEAN_STOCKS, ...MOCK_ASIAN_STOCKS];

// ─── Helper: build symbol-to-exchange map ────────────────────
const mockExchangeMap = new Map<string, string>();
for (const s of ALL_MOCK) {
  mockExchangeMap.set(s.symbol, s.exchange);
}

// ─── Helper: apply live MarketStack data to mock base ────────
function mergeLiveQuotes(mockBase: typeof ALL_MOCK, symbolToQuote: Map<string, any>): any[] {
  return mockBase.map(mock => {
    const live = symbolToQuote.get(mock.symbol);
    if (live) {
      const price = live.last_price ?? live.close ?? mock.price;
      const prevClose = mock.price;
      const change = live.change ?? (price - prevClose);
      const changePercent = live.change_percent ?? (prevClose > 0 ? (change / prevClose) * 100 : 0);
      return {
        ...mock,
        price: Math.round(price * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        isPositive: change >= 0,
        volume: live.volume ? live.volume.toLocaleString() : mock.volume,
        high52: +(price * 1.15).toFixed(2),
        low52: +(price * 0.85).toFixed(2),
      };
    }
    // Fallback to mock with simulated noise
    const volatility = mock.price * 0.02;
    const simChange = (Math.random() - 0.5) * volatility;
    return {
      ...mock,
      price: +(mock.price + simChange).toFixed(2),
      change: +(simChange).toFixed(2),
      changePercent: +((simChange / mock.price) * 100).toFixed(2),
      isPositive: simChange >= 0,
      high52: +(mock.price * 1.2).toFixed(2),
      low52: +(mock.price * 0.8).toFixed(2),
    };
  });
}

// ─── Helper: try MarketStack, fallback to mock ────────────────
async function tryMarketStack<T>(symbols: string[], baseMock: typeof ALL_MOCK): Promise<T[]> {
  if (!isMarketStackConfigured()) {
    // No API key — return simulated mock
    return mergeLiveQuotes(baseMock, new Map()) as any;
  }
  try {
    const msSymbols = symbols.map(s => toMsSymbol(s, mockExchangeMap.get(s)));
    const quotes = await marketstack.getRealTimePrices(msSymbols);
    if (quotes && quotes.length > 0) {
      const quoteMap = new Map(quotes.map(q => [q.symbol.replace(/\\.X[A-Z]{3,4}$/i, ''), q]));
      return mergeLiveQuotes(baseMock, quoteMap) as any;
    }
  } catch {
    // MarketStack failed — fall through to mock
  }
  return mergeLiveQuotes(baseMock, new Map()) as any;
}

// ─── Routes ──────────────────────────────────────────────────

/**
 * GET /api/global-stocks/europe
 * Returns top European stocks (LSE, Xetra, Euronext, SIX, etc.)
 */
router.get('/europe', async (_req: Request, res: Response) => {
  const symbols = MOCK_EUROPEAN_STOCKS.map(s => s.symbol);
  const stocks = await tryMarketStack(symbols, MOCK_EUROPEAN_STOCKS);
  res.json(stocks);
});

/**
 * GET /api/global-stocks/asia
 * Returns top Asia-Pacific stocks (TSE, HKEX, NSE, ASX, etc.)
 */
router.get('/asia', async (_req: Request, res: Response) => {
  const symbols = MOCK_ASIAN_STOCKS.map(s => s.symbol);
  const stocks = await tryMarketStack(symbols, MOCK_ASIAN_STOCKS);
  res.json(stocks);
});

/**
 * GET /api/global-stocks/quote/:symbol
 * Returns a single global stock quote by symbol.
 */
router.get('/quote/:symbol', async (req: Request, res: Response) => {
  const symbol = (req.params.symbol as string).toUpperCase();
  const mock = ALL_MOCK.find(s => s.symbol === symbol);

  if (!mock) {
    res.status(404).json({ error: `Symbol '${symbol}' not found. Supported: ${ALL_MOCK.map(s => s.symbol).slice(0, 5).join(', ')}...` });
    return;
  }

  try {
    if (isMarketStackConfigured()) {
      const msSymbol = toMsSymbol(symbol, mock.exchange);
      const quote = await marketstack.getQuote(msSymbol);
      if (quote) {
        const price = quote.last_price ?? quote.close ?? mock.price;
        const prevClose = mock.price;
        const change = quote.change ?? (price - prevClose);
        const high52 = +(price * 1.15).toFixed(2);
        const low52 = +(price * 0.85).toFixed(2);
        res.json({
          ...mock,
          price: Math.round(price * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round((prevClose > 0 ? (change / prevClose) * 100 : 0) * 100) / 100,
          volume: quote.volume ? quote.volume.toLocaleString() : mock.volume,
          isPositive: change >= 0,
          open: quote.open || 0,
          high: quote.high || 0,
          low: quote.low || 0,
          high52,
          low52,
        });
        return;
      }
    }
  } catch {
    // fall through
  }

  // Mock fallback with simulated change
  const volatility = mock.price * 0.02;
  const simChange = (Math.random() - 0.5) * volatility;
  res.json({
    ...mock,
    price: +(mock.price + simChange).toFixed(2),
    change: +(simChange).toFixed(2),
    changePercent: +((simChange / mock.price) * 100).toFixed(2),
    isPositive: simChange >= 0,
    high52: +(mock.price * 1.2).toFixed(2),
    low52: +(mock.price * 0.8).toFixed(2),
  });
});

/**
 * GET /api/global-stocks/quotes?symbols=AAPL,MSFT
 * Returns bulk quotes for given symbols.
 */
router.get('/quotes', async (req: Request, res: Response) => {
  const symbolsParam = (req.query.symbols as string) || '';
  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  if (symbols.length === 0) {
    res.status(400).json({ error: 'symbols query parameter is required' });
    return;
  }

  const results: any[] = [];
  for (const symbol of symbols) {
    const mock = ALL_MOCK.find(s => s.symbol === symbol);
    if (mock) {
      const volatility = mock.price * 0.02;
      const simChange = (Math.random() - 0.5) * volatility;
      results.push({
        ...mock,
        price: +(mock.price + simChange).toFixed(2),
        change: +(simChange).toFixed(2),
        changePercent: +((simChange / mock.price) * 100).toFixed(2),
        isPositive: simChange >= 0,
      });
    } else {
      results.push({ symbol, error: 'Not found' });
    }
  }
  res.json(results);
});

/**
 * GET /api/global-stocks/search?q=Apple
 * Search global stocks by symbol or name.
 */
router.get('/search', (req: Request, res: Response) => {
  const query = ((req.query.q as string) || '').toLowerCase().trim();
  if (!query) {
    res.json([]);
    return;
  }

  const results = ALL_MOCK.filter(
    s => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query),
  ).map(s => ({
    symbol: s.symbol,
    name: s.name,
    exchange: s.exchange,
    sector: s.sector,
    price: s.price,
    country: s.country,
    currency: s.currency,
    region: s.region,
    type: 'stock' as const,
  }));

  res.json(results);
});

/**
 * GET /api/global-stocks/exchanges
 * List all supported exchanges with region info.
 */
router.get('/exchanges', (_req: Request, res: Response) => {
  const exchangeSet = new Set<string>();
  const exchanges: Array<{ exchange: string; region: string; countries: string[]; mic: string }> = [];

  for (const s of ALL_MOCK) {
    if (!exchangeSet.has(s.exchange)) {
      exchangeSet.add(s.exchange);
      exchanges.push({
        exchange: s.exchange,
        region: s.region,
        countries: [s.country],
        mic: EXCHANGE_SUFFIX[s.exchange]?.replace('.', '') || s.exchange,
      });
    }
  }

  res.json({ success: true, data: exchanges, count: exchanges.length });
});

export default router;
