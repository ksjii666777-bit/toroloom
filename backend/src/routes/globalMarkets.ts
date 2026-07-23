/**
 * ============================================================================
 * Toroloom — Global Markets Route
 * ============================================================================
 *
 * Provides US stock quotes (via MarketStack) and cryptocurrency prices
 * (via CoinGecko free API).  Falls back to mock data when the external
 * API is not configured or returns an error.
 *
 * Endpoints:
 *   GET /api/global-markets/indices    — US indices (S&P 500, NASDAQ, DJIA, VIX)
 *   GET /api/global-markets/stocks     — Top US stocks by sector
 *   GET /api/global-markets/quote/:symbol — Single US stock quote
 *   GET /api/global-markets/quotes?symbols=AAPL,MSFT — Bulk quotes
 *   GET /api/global-markets/crypto     — Top cryptocurrencies
 *   GET /api/global-markets/crypto/:id — Single crypto detail + chart
 *   GET /api/global-markets/search?q=Apple — Search US stocks
 *   GET /api/global-markets/status     — Check which APIs are configured
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { marketstack, isMarketStackConfigured } from '../services/marketstack';

const router = Router();

// ─── Mock Data (fallback when APIs are not configured) ─────────────────

const MOCK_INDICES = [
  { symbol: 'SPX',  name: 'S&P 500',                  price: 5678.30, change: 42.15,  changePercent: 0.75 },
  { symbol: 'IXIC', name: 'NASDAQ Composite',          price: 18725.60, change: 156.80, changePercent: 0.84 },
  { symbol: 'DJI',  name: 'Dow Jones Industrial Avg.', price: 41234.90, change: -78.45, changePercent: -0.19 },
  { symbol: 'RUT',  name: 'Russell 2000',              price: 2189.45,  change: 12.30,  changePercent: 0.57 },
  { symbol: 'VIX',  name: 'CBOE Volatility Index',     price: 14.28,    change: -1.15,  changePercent: -7.46 },
  { symbol: 'DXY',  name: 'US Dollar Index',           price: 104.56,   change: 0.32,   changePercent: 0.31 },
];

const MOCK_STOCKS = [
  { symbol: 'AAPL',  name: 'Apple Inc.',                  sector: 'Technology',     price: 234.50,  change: 3.45,  changePercent: 1.49,  marketCap: '$3.68T', volume: '48.2M', pe: 32.4,  dividend: 0.52, exchange: 'NASDAQ' },
  { symbol: 'MSFT',  name: 'Microsoft Corporation',       sector: 'Technology',     price: 468.90,  change: 5.60,  changePercent: 1.21,  marketCap: '$3.48T', volume: '22.1M', pe: 36.8,  dividend: 0.75, exchange: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.',               sector: 'Technology',     price: 185.20,  change: -1.80, changePercent: -0.96, marketCap: '$2.28T', volume: '28.5M', pe: 26.5,  dividend: 0.20, exchange: 'NASDAQ' },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.',             sector: 'Technology',     price: 198.30,  change: 4.20,  changePercent: 2.16,  marketCap: '$2.06T', volume: '35.8M', pe: 44.2,  dividend: 0,    exchange: 'NASDAQ' },
  { symbol: 'NVDA',  name: 'NVIDIA Corporation',          sector: 'Semiconductors', price: 128.45,  change: 5.30,  changePercent: 4.31,  marketCap: '$3.16T', volume: '345.6M', pe: 75.8, dividend: 0.04, exchange: 'NASDAQ' },
  { symbol: 'META',  name: 'Meta Platforms Inc.',         sector: 'Technology',     price: 512.60,  change: 8.40,  changePercent: 1.67,  marketCap: '$1.30T', volume: '18.2M', pe: 28.6,  dividend: 0.50, exchange: 'NASDAQ' },
  { symbol: 'TSLA',  name: 'Tesla Inc.',                  sector: 'Automotive',     price: 245.80,  change: -12.30, changePercent: -4.77, marketCap: '$782B',  volume: '125.4M', pe: 62.4, dividend: 0,    exchange: 'NASDAQ' },
  { symbol: 'JPM',   name: 'JPMorgan Chase & Co.',        sector: 'Finance',        price: 208.30,  change: 2.10,  changePercent: 1.02,  marketCap: '$598B',  volume: '12.5M', pe: 12.8,  dividend: 2.25, exchange: 'NYSE' },
  { symbol: 'V',     name: 'Visa Inc.',                   sector: 'Finance',        price: 298.40,  change: 1.50,  changePercent: 0.51,  marketCap: '$611B',  volume: '8.2M',  pe: 31.5,  dividend: 0.65, exchange: 'NYSE' },
  { symbol: 'JNJ',   name: 'Johnson & Johnson',           sector: 'Healthcare',     price: 162.80,  change: -0.90, changePercent: -0.55, marketCap: '$392B',  volume: '6.8M',  pe: 16.2,  dividend: 3.00, exchange: 'NYSE' },
  { symbol: 'WMT',   name: 'Walmart Inc.',                sector: 'Consumer',       price: 178.90,  change: 2.30,  changePercent: 1.30,  marketCap: '$576B',  volume: '15.2M', pe: 28.4,  dividend: 1.60, exchange: 'NYSE' },
  { symbol: 'UNH',   name: 'UnitedHealth Group Inc.',     sector: 'Healthcare',     price: 562.30,  change: 5.80,  changePercent: 1.04,  marketCap: '$520B',  volume: '4.2M',  pe: 22.5,  dividend: 1.50, exchange: 'NYSE' },
  { symbol: 'XOM',   name: 'Exxon Mobil Corporation',     sector: 'Energy',         price: 128.60,  change: 0.85,  changePercent: 0.67,  marketCap: '$571B',  volume: '18.5M', pe: 15.2,  dividend: 3.60, exchange: 'NYSE' },
  { symbol: 'NFLX',  name: 'Netflix Inc.',                sector: 'Technology',     price: 695.40,  change: 12.80, changePercent: 1.87,  marketCap: '$298B',  volume: '6.8M',  pe: 45.2,  dividend: 0,    exchange: 'NASDAQ' },
  { symbol: 'AMD',   name: 'Advanced Micro Devices',      sector: 'Semiconductors', price: 167.90,  change: -2.40, changePercent: -1.41, marketCap: '$271B',  volume: '52.8M', pe: 52.6,  dividend: 0,    exchange: 'NASDAQ' },
  { symbol: 'COST',  name: 'Costco Wholesale Corp.',      sector: 'Consumer',       price: 892.50,  change: 6.70,  changePercent: 0.76,  marketCap: '$396B',  volume: '3.2M',  pe: 52.4,  dividend: 1.00, exchange: 'NASDAQ' },
  { symbol: 'ADBE',  name: 'Adobe Inc.',                  sector: 'Technology',     price: 568.20,  change: 8.90,  changePercent: 1.59,  marketCap: '$252B',  volume: '4.5M',  pe: 42.8,  dividend: 0,    exchange: 'NASDAQ' },
  { symbol: 'BAC',   name: 'Bank of America Corp.',       sector: 'Finance',        price: 42.80,   change: 0.65,  changePercent: 1.54,  marketCap: '$338B',  volume: '45.2M', pe: 14.5,  dividend: 1.80, exchange: 'NYSE' },
  { symbol: 'DIS',   name: 'The Walt Disney Company',     sector: 'Entertainment',  price: 118.20,  change: -1.50, changePercent: -1.25, marketCap: '$215B',  volume: '12.5M', pe: 38.5,  dividend: 0.80, exchange: 'NYSE' },
  { symbol: 'PG',    name: 'Procter & Gamble Co.',        sector: 'Consumer',       price: 168.50,  change: -0.60, changePercent: -0.36, marketCap: '$397B',  volume: '5.8M',  pe: 26.8,  dividend: 2.40, exchange: 'NYSE' },
];

const MOCK_CRYPTO = [
  { id: 'bitcoin',    symbol: 'BTC',  name: 'Bitcoin',         price: 67845.20, change: 1234.50,  changePercent: 1.85,  marketCap: '$1.34T', volume24h: '$28.5B',  icon: '₿', color: '#F7931A',  supply: 19750000, ath: 73750.00 },
  { id: 'ethereum',   symbol: 'ETH',  name: 'Ethereum',        price: 3489.70,  change: -56.30,   changePercent: -1.59, marketCap: '$419B',   volume24h: '$15.2B',  icon: 'Ξ', color: '#627EEA',  supply: 120200000, ath: 4878.00 },
  { id: 'solana',     symbol: 'SOL',  name: 'Solana',          price: 178.45,   change: 5.60,     changePercent: 3.24,  marketCap: '$82.4B',  volume24h: '$4.8B',   icon: 'S', color: '#9945FF',  supply: 461800000, ath: 260.00 },
  { id: 'xrp',        symbol: 'XRP',  name: 'XRP',             price: 0.6234,   change: -0.0123,   changePercent: -1.94, marketCap: '$34.2B',  volume24h: '$2.1B',   icon: 'X', color: '#23292F',  supply: 55000000000, ath: 3.84 },
  { id: 'cardano',    symbol: 'ADA',  name: 'Cardano',         price: 0.4567,   change: 0.0089,    changePercent: 1.99,  marketCap: '$16.1B',  volume24h: '$890M',   icon: 'A', color: '#0033AD',  supply: 35000000000, ath: 3.10 },
  { id: 'dogecoin',   symbol: 'DOGE', name: 'Dogecoin',        price: 0.1289,   change: 0.0034,    changePercent: 2.71,  marketCap: '$18.5B',  volume24h: '$1.5B',   icon: 'Ð', color: '#C2A633',  supply: 142000000000, ath: 0.73 },
  { id: 'avalanche',  symbol: 'AVAX', name: 'Avalanche',       price: 38.45,    change: 1.20,      changePercent: 3.22,  marketCap: '$14.5B',  volume24h: '$780M',   icon: 'A', color: '#E84142',  supply: 377000000, ath: 146.00 },
  { id: 'chainlink',  symbol: 'LINK', name: 'Chainlink',       price: 16.78,    change: 0.45,      changePercent: 2.76,  marketCap: '$9.8B',   volume24h: '$620M',   icon: 'L', color: '#375BD2',  supply: 587000000, ath: 52.00 },
  { id: 'polkadot',   symbol: 'DOT',  name: 'Polkadot',        price: 7.89,     change: -0.15,     changePercent: -1.87, marketCap: '$10.8B',  volume24h: '$520M',   icon: 'D', color: '#E6007A',  supply: 1350000000, ath: 55.00 },
  { id: 'polygon',    symbol: 'MATIC',name: 'Polygon',         price: 0.8921,   change: -0.0234,   changePercent: -2.56, marketCap: '$8.3B',   volume24h: '$450M',   icon: 'P', color: '#8247E5',  supply: 9200000000, ath: 2.92 },
];

// ─── Exchange suffix mapping for MarketStack (derived from MOCK_STOCKS data) ──

/** Build a symbol-to-exchange map from MOCK_STOCKS data */
const stockExchangeMap = new Map<string, string>();
for (const s of MOCK_STOCKS) {
  stockExchangeMap.set(s.symbol, s.exchange);
}

function toMarketStackSymbol(symbol: string): string {
  const exchange = stockExchangeMap.get(symbol.toUpperCase());
  if (exchange === 'NYSE') return `${symbol}.XNYSE`;
  return `${symbol}.XNAS`; // Default to NASDAQ (covers most tech stocks)
}

// ─── CoinGecko API helper ──────────────────────────────────────────────

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const COINGECKO_TIMEOUT = 5000;

interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number | null;
  total_volume: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_30d_in_currency?: number | null;
  circulating_supply: number;
  total_supply: number | null;
  ath: number;
  ath_change_percentage: number | null;
  ath_date: string;
  sparkline_in_7d?: { price: number[] };
}

interface CoinGeckoCoinDetail {
  id: string;
  symbol: string;
  name: string;
  image: { large: string; small: string; thumb: string };
  market_data: {
    current_price: Record<string, number>;
    market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    price_change_percentage_1h_in_currency: Record<string, number>;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    price_change_percentage_1y: number;
    high_24h: Record<string, number>;
    low_24h: Record<string, number>;
    circulating_supply: number;
    total_supply: number | null;
    max_supply: number | null;
    ath: Record<string, number>;
    ath_date: Record<string, string>;
  };
  description: { en: string };
  links: { homepage: string[] };
}

async function fetchCoinGecko<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const query = new URLSearchParams(params);
  const url = `${COINGECKO_BASE}${path}?${query.toString()}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), COINGECKO_TIMEOUT);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

// ─── Routes ────────────────────────────────────────────────────────────

/**
 * GET /api/global-markets/status
 * Returns which external data sources are configured.
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    marketstackConfigured: isMarketStackConfigured(),
    coinGeckoConfigured: true, // CoinGecko free tier always works
  });
});

/**
 * GET /api/global-markets/indices
 * Returns US indices (S&P 500, NASDAQ, DJIA, etc.)
 * Note: MarketStack doesn't support index symbols natively, so we use
 * simulated mock data with realistic random fluctuations.
 */
router.get('/indices', async (_req: Request, res: Response) => {
  try {
    const indices = MOCK_INDICES.map(i => ({
      symbol: i.symbol,
      name: i.name,
      price: +(i.price * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2),
      change: +(i.change * (1 + (Math.random() - 0.5) * 0.1)).toFixed(2),
      changePercent: +(i.changePercent * (1 + (Math.random() - 0.1) * 0.1)).toFixed(2),
      high: +(i.price * 1.01).toFixed(2),
      low: +(i.price * 0.99).toFixed(2),
      volume: Math.floor(Math.random() * 1000000000) + 500000000,
    }));
    res.json(indices);
  } catch {
    res.json(MOCK_INDICES.map(i => ({ ...i, high: i.price * 1.01, low: i.price * 0.99, volume: 0 })));
  }
});

/**
 * GET /api/global-markets/stocks
 * Returns top US stocks by sector. Uses MarketStack when configured.
 */
router.get('/stocks', async (_req: Request, res: Response) => {
  try {
    if (isMarketStackConfigured()) {
      const symbols = MOCK_STOCKS.map(s => s.symbol);
      const msSymbols = symbols.map(toMarketStackSymbol);
      const quotes = await marketstack.getRealTimePrices(msSymbols);
      if (quotes && quotes.length > 0) {
        const quoteMap = new Map(quotes.map(q => [q.symbol.replace(/\.(XNAS|XNYSE)$/i, ''), q]));
        const stocks = MOCK_STOCKS.map(mock => {
          const live = quoteMap.get(mock.symbol);
          const price = live?.last_price ?? live?.close ?? mock.price;
          const prevClose = mock.price;
          const change = live?.change ?? (price - prevClose);
          const changePercent = live?.change_percent ?? prevClose > 0 ? (change / prevClose) * 100 : 0;
          return {
            ...mock,
            price: Math.round(price * 100) / 100,
            change: Math.round(change * 100) / 100,
            changePercent: Math.round(changePercent * 100) / 100,
            volume: live?.volume ? live.volume.toLocaleString() : mock.volume,
            high52: +(price * 1.15).toFixed(2),
            low52: +(price * 0.85).toFixed(2),
            isPositive: change >= 0,
          };
        });
        res.json(stocks);
        return;
      }
    }
    // Fallback with simulated changes
    const stocks = MOCK_STOCKS.map(mock => {
      const volatility = mock.price * 0.02;
      const change = (Math.random() - 0.5) * volatility;
      return {
        ...mock,
        price: +(mock.price + change).toFixed(2),
        change: +(change).toFixed(2),
        changePercent: +((change / mock.price) * 100).toFixed(2),
        isPositive: change >= 0,
        high52: +(mock.price * 1.2).toFixed(2),
        low52: +(mock.price * 0.8).toFixed(2),
      };
    });
    res.json(stocks);
  } catch {
    res.json(MOCK_STOCKS.map(s => ({ ...s, isPositive: s.changePercent >= 0, high52: 0, low52: 0 })));
  }
});

/**
 * GET /api/global-markets/quote/:symbol
 * Returns a single US stock quote.
 */
router.get('/quote/:symbol', async (req: Request, res: Response) => {
  const symbol = (req.params.symbol as string).toUpperCase();
  try {
    if (isMarketStackConfigured()) {
      const msSymbol = toMarketStackSymbol(symbol);
      const quote = await marketstack.getQuote(msSymbol);
      if (quote) {
        const mock = MOCK_STOCKS.find(s => s.symbol === symbol);
        const price = quote.last_price ?? quote.close;
        const prevClose = mock?.price ?? price;
        const change = quote.change ?? (price - prevClose);
        res.json({
          symbol,
          name: mock?.name ?? symbol,
          sector: mock?.sector ?? '',
          price: Math.round(price * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePercent: Math.round((prevClose > 0 ? (change / prevClose) * 100 : 0) * 100) / 100,
          volume: quote.volume ?? 0,
          open: quote.open ?? 0,
          high: quote.high ?? 0,
          low: quote.low ?? 0,
          isPositive: change >= 0,
          marketCap: mock?.marketCap ?? '',
          pe: mock?.pe ?? 0,
          dividend: mock?.dividend ?? 0,
          exchange: mock?.exchange ?? 'NASDAQ',
        });
        return;
      }
    }
    // Fallback to mock
    const mock = MOCK_STOCKS.find(s => s.symbol === symbol);
    if (!mock) {
      res.status(404).json({ error: `Symbol '${symbol}' not found` });
      return;
    }
    res.json({ ...mock, isPositive: mock.changePercent >= 0 });
  } catch {
    const mock = MOCK_STOCKS.find(s => s.symbol === symbol);
    if (!mock) {
      res.status(404).json({ error: `Symbol '${symbol}' not found` });
      return;
    }
    res.json({ ...mock, isPositive: mock.changePercent >= 0 });
  }
});

/**
 * GET /api/global-markets/quotes?symbols=AAPL,MSFT,NVDA
 * Returns bulk US stock quotes.
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
    const mock = MOCK_STOCKS.find(s => s.symbol === symbol);
    results.push(mock ? { ...mock, isPositive: mock.changePercent >= 0 } : { symbol, error: 'Not found' });
  }
  res.json(results);
});

/**
 * GET /api/global-markets/crypto
 * Returns top cryptocurrencies via CoinGecko (fallback to mock).
 */
router.get('/crypto', async (_req: Request, res: Response) => {
  try {
    const coinGeckoData = await fetchCoinGecko<CoinGeckoMarketData[]>('/coins/markets', {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: '20',
      page: '1',
      sparkline: 'false',
      price_change_percentage: '1h,24h,7d,30d',
    });

    if (coinGeckoData && coinGeckoData.length > 0) {
      const crypto = coinGeckoData.map(c => ({
        id: c.id,
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        price: c.current_price,
        change: ((c.price_change_percentage_24h ?? 0) / 100) * (c.current_price || 1),
        changePercent: +(c.price_change_percentage_24h ?? 0).toFixed(2),
        change1h: c.price_change_percentage_1h_in_currency ?? null,
        change7d: c.price_change_percentage_7d_in_currency ?? null,
        change30d: c.price_change_percentage_30d_in_currency ?? null,
        marketCap: '$' + formatLargeNumber(c.market_cap),
        volume24h: '$' + formatLargeNumber(c.total_volume),
        circulatingSupply: c.circulating_supply,
        totalSupply: c.total_supply,
        ath: c.ath,
        athDate: c.ath_date,
        icon: c.symbol.charAt(0).toUpperCase(),
        color: getCryptoColor(c.id),
      }));
      res.json(crypto);
      return;
    }
  } catch {
    // CoinGecko failed — fall through to mock
  }

  // Fallback to mock
  const crypto = MOCK_CRYPTO.map(c => ({
    ...c,
    change1h: +(c.changePercent * 0.3).toFixed(2),
    change7d: +(c.changePercent * 2.5).toFixed(2),
    change30d: +(c.changePercent * 5).toFixed(2),
    circulatingSupply: c.supply,
    totalSupply: c.supply * 1.5,
    athDate: '2024-03-14T00:00:00.000Z',
  }));
  res.json(crypto);
});

/**
 * GET /api/global-markets/crypto/:id
 * Returns detailed single crypto data + price history.
 */
router.get('/crypto/:id', async (req: Request, res: Response) => {
  const coinId = (req.params.id as string).toLowerCase();

  try {
    // Try CoinGecko detail + market chart in parallel
    const [detail, chart] = await Promise.all([
      fetchCoinGecko<CoinGeckoCoinDetail>(`/coins/${coinId}`, {
        localization: 'false',
        tickers: 'false',
        market_data: 'true',
        community_data: 'false',
        developer_data: 'false',
        sparkline: 'false',
      }),
      fetchCoinGecko<{ prices: [number, number][] }>(`/coins/${coinId}/market_chart`, {
        vs_currency: 'usd',
        days: '30',
      }),
    ]);

    if (detail) {
      const usd = detail.market_data.current_price.usd;
      const change24h = detail.market_data.price_change_percentage_24h ?? 0;
      const changeAmount = (change24h / 100) * usd;
      res.json({
        id: detail.id,
        symbol: detail.symbol.toUpperCase(),
        name: detail.name,
        image: detail.image.large,
        price: usd,
        change: Math.round(changeAmount * 100) / 100,
        changePercent: Math.round(change24h * 100) / 100,
        change1h: detail.market_data.price_change_percentage_1h_in_currency?.usd ?? null,
        change7d: detail.market_data.price_change_percentage_7d ?? null,
        change30d: detail.market_data.price_change_percentage_30d ?? null,
        change1y: detail.market_data.price_change_percentage_1y ?? null,
        marketCap: detail.market_data.market_cap.usd,
        volume24h: detail.market_data.total_volume.usd,
        high24h: detail.market_data.high_24h.usd,
        low24h: detail.market_data.low_24h.usd,
        circulatingSupply: detail.market_data.circulating_supply,
        totalSupply: detail.market_data.total_supply,
        maxSupply: detail.market_data.max_supply,
        ath: detail.market_data.ath.usd,
        athDate: detail.market_data.ath_date.usd,
        description: detail.description.en?.substring(0, 1000) ?? '',
        homepage: detail.links.homepage?.[0] ?? '',
        priceHistory: chart?.prices?.map(([timestamp, price]) => ({ timestamp, price })) ?? [],
        color: getCryptoColor(coinId),
      });
      return;
    }
  } catch {
    // Fall through to mock
  }

  // Fallback to mock
  const mock = MOCK_CRYPTO.find(c => c.id === coinId);
  if (!mock) {
    res.status(404).json({ error: `Crypto '${coinId}' not found` });
    return;
  }

  const history = generateMockPriceHistory(mock.price, 30);
  res.json({
    id: mock.id,
    symbol: mock.symbol,
    name: mock.name,
    image: '',
    price: mock.price,
    change: mock.change,
    changePercent: mock.changePercent,
    change1h: +(mock.changePercent * 0.3).toFixed(2),
    change7d: +(mock.changePercent * 2.5).toFixed(2),
    change30d: +(mock.changePercent * 5).toFixed(2),
    change1y: +(mock.changePercent * 10).toFixed(2),
    marketCap: parseMarketCap(mock.marketCap),
    volume24h: parseMarketCap(mock.volume24h),
    high24h: +(mock.price * 1.03).toFixed(2),
    low24h: +(mock.price * 0.97).toFixed(2),
    circulatingSupply: mock.supply,
    totalSupply: mock.supply * 1.5,
    maxSupply: null,
    ath: mock.ath,
    athDate: '2024-03-14T00:00:00.000Z',
    description: `${mock.name} (${mock.symbol}) is a cryptocurrency. Cryptocurrencies are digital assets designed to work as a medium of exchange using cryptography.`,
    homepage: '',
    priceHistory: history,
    color: mock.color,
  });
});

/**
 * GET /api/global-markets/search?q=Apple
 * Search US stocks by symbol or name.
 */
router.get('/search', async (req: Request, res: Response) => {
  const query = ((req.query.q as string) || '').toLowerCase().trim();
  if (!query) {
    res.json([]);
    return;
  }

  const results = MOCK_STOCKS.filter(
    s => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query),
  ).map(s => ({
    symbol: s.symbol,
    name: s.name,
    exchange: s.exchange,
    sector: s.sector,
    price: s.price,
    type: 'stock' as const,
  }));

  res.json(results);
});

// ─── Helpers ───────────────────────────────────────────────────────────

function formatLargeNumber(num: number): string {
  if (!num) return '0';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toFixed(2);
}

function parseMarketCap(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[$,]/g, '');
  if (cleaned.endsWith('T')) return parseFloat(cleaned) * 1e12;
  if (cleaned.endsWith('B')) return parseFloat(cleaned) * 1e9;
  if (cleaned.endsWith('M')) return parseFloat(cleaned) * 1e6;
  if (cleaned.endsWith('K') || cleaned.endsWith('k')) return parseFloat(cleaned) * 1e3;
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function getCryptoColor(id: string): string {
  const colors: Record<string, string> = {
    bitcoin: '#F7931A', ethereum: '#627EEA', solana: '#9945FF',
    xrp: '#23292F', cardano: '#0033AD', dogecoin: '#C2A633',
    avalanche: '#E84142', chainlink: '#375BD2', polkadot: '#E6007A',
    'polygon': '#8247E5', tether: '#26A17B', 'usd-coin': '#3D7BCA',
    dai: '#F5AC37', tron: '#EF0027', litecoin: '#345D9D',
    bitcoin_cash: '#0AC18E', stellar: '#14B4E5', monero: '#FF6600',
    cosmos: '#2E3148', filecoin: '#0090FF',
  };
  return colors[id] || '#8B8B8B';
}

function generateMockPriceHistory(basePrice: number, days: number): { timestamp: number; price: number }[] {
  const history: { timestamp: number; price: number }[] = [];
  const now = Date.now();
  let price = basePrice;

  for (let i = days * 24; i >= 0; i--) {
    const volatility = price * 0.01;
    price = Math.max(price * 0.1, price + (Math.random() - 0.48) * volatility);
    history.push({
      timestamp: now - i * 3600000,
      price: Math.round(price * 100) / 100,
    });
  }
  return history;
}

export default router;
