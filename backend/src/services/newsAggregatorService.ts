/**
 * ============================================================================
 * Toroloom — Multi-Provider Financial News Aggregator
 * ============================================================================
 *
 * WHY THIS EXISTS:
 *   NewsAPI.org's free tier rejects requests from cloud/datacenter IPs
 *   ("requests from the cloud are not allowed" — only localhost is allowed on
 *   the developer plan). Deployed backends (Railway, Render, Fly, Heroku…)
 *   therefore ALWAYS get zero articles even with a valid key.
 *
 * FIX:
 *   Try multiple providers in order and return whichever answers first:
 *
 *     1. GNews.io        (optional, GNEWS_API_KEY)      — paid/dev friendly
 *     2. NewsData.io     (optional, NEWSDATA_API_KEY)   — cloud-friendly free tier
 *     3. Google News RSS (NO KEY NEEDED — always works) ← default workhorse
 *     4. NewsAPI.org     (legacy, kept as last resort)
 *
 *   The winning provider id is returned so routes can report an HONEST
 *   `source` field instead of pretending "newsapi" worked.
 *
 * All providers are normalised into `AggregatedArticle`; routes map those to
 * the app's MarketNewsItem format.
 * ============================================================================
 */

import https from 'https';

// ─── Types ────────────────────────────────────────────────────────────────

export interface AggregatedArticle {
  title: string;
  summary: string;
  content: string;
  url: string;
  imageUrl: string | null;
  source: string;
  publishedAt: string;
}

export type NewsProviderId = 'gnews' | 'newsdata' | 'googlenews' | 'newsapi' | 'none';

export interface NewsFetchResult {
  articles: AggregatedArticle[];
  totalResults: number;
  /** Which provider actually served these articles ('none' when all failed). */
  provider: NewsProviderId;
}

export type NewsCategory =
  | 'markets'
  | 'economy'
  | 'corporate'
  | 'ipo'
  | 'global'
  | 'policy';

interface FetchOptions {
  q?: string;
  category?: NewsCategory;
  pageSize?: number;
  page?: number;
  language?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────

const config = {
  gnewsApiKey: process.env.GNEWS_API_KEY || '',
  newsdataApiKey: process.env.NEWSDATA_API_KEY || '',
  newsApiKey: process.env.NEWSAPI_KEY || process.env.NEWS_API_KEY || '',
};

/** Re-read env at request time too (tests / runtime config updates). */
function keys() {
  return {
    gnews: process.env.GNEWS_API_KEY || config.gnewsApiKey,
    newsdata: process.env.NEWSDATA_API_KEY || config.newsdataApiKey,
    newsapi: process.env.NEWSAPI_KEY || process.env.NEWS_API_KEY || config.newsApiKey,
  };
}

const HTTP_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 10 * 60 * 1_000; // 10 min — news doesn't need to be hot

// ─── Tiny cache ───────────────────────────────────────────────────────────

interface CacheEntry {
  expiresAt: number;
  result: NewsFetchResult;
}
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): NewsFetchResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.result;
}

function cacheSet(key: string, result: NewsFetchResult): void {
  // Keep the cache bounded.
  if (cache.size > 64) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result });
}

/** Test hook — wipe memoized responses. */
export function clearNewsCacheForTesting(): void {
  cache.clear();
}

// ─── HTTPS helper (follows redirects, parses JSON or raw text) ───────────

function httpGet(
  url: string,
  accept: 'json' | 'xml',
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        timeout: HTTP_TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ToroloomApp/1.0)',
          Accept: accept === 'json' ? 'application/json' : 'application/rss+xml, application/xml, text/xml, */*',
        },
      },
      (res) => {
        // Follow up to 3 redirects (Google News sometimes 302s).
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          if ((res.headers.location.match(/^http/) ? res.headers.location : new URL(res.headers.location, url).toString()).length > 0) {
            httpGet(
              res.headers.location.startsWith('http')
                ? res.headers.location
                : new URL(res.headers.location, url).toString(),
              accept,
            ).then(resolve, reject);
            return;
          }
        }

        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          body += chunk;
          // Safety valve — don't buffer more than ~2MB.
          if (body.length > 2_000_000) req.destroy();
        });
        res.on('end', () => resolve({ status: res.statusCode || 0, body }));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('news request timed out'));
    });
  });
}

// ─── Shared helpers ──────────────────────────────────────────────────────

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).trim();
}

function categoryToQuery(category?: NewsCategory, fallbackQ?: string): string {
  if (fallbackQ) return fallbackQ;
  switch (category) {
    case 'markets': return 'Indian stock market OR NSE OR BSE OR Sensex OR Nifty';
    case 'economy': return 'Indian economy OR GDP OR inflation OR RBI';
    case 'corporate': return 'corporate earnings OR quarterly results India';
    case 'ipo': return 'IPO India OR initial public offering';
    case 'global': return 'global markets OR Federal Reserve OR oil prices';
    case 'policy': return 'SEBI OR government policy India OR budget India';
    default: return 'stock market finance investing';
  }
}

// ─── Provider 1: GNews.io (optional key) ─────────────────────────────────

async function fetchFromGNews(opts: FetchOptions): Promise<AggregatedArticle[]> {
  const k = keys().gnews;
  if (!k) throw new Error('GNEWS_API_KEY not set');

  const params = new URLSearchParams({
    q: categoryToQuery(opts.category, opts.q),
    lang: opts.language || 'en',
    max: String(Math.min(opts.pageSize || 20, 50)),
    apikey: k,
    sortby: 'publishedAt',
  });

  const { status, body } = await httpGet(`https://gnews.io/api/v4/search?${params}`, 'json');
  if (status !== 200) throw new Error(`GNews HTTP ${status}`);
  const parsed = JSON.parse(body);
  if (!Array.isArray(parsed.articles)) throw new Error('GNews: unexpected payload');

  return parsed.articles.map((a: any) => ({
    title: stripTags(a.title || ''),
    summary: stripTags(a.description || ''),
    content: stripTags(a.content || a.description || ''),
    url: a.url || '',
    imageUrl: a.image || null,
    source: a.source?.name || 'GNews',
    publishedAt: a.publishedAt || new Date().toISOString(),
  })).filter((a: AggregatedArticle) => a.title.length > 0);
}

// ─── Provider 2: NewsData.io (optional key) ──────────────────────────────

async function fetchFromNewsData(opts: FetchOptions): Promise<AggregatedArticle[]> {
  const k = keys().newsdata;
  if (!k) throw new Error('NEWSDATA_API_KEY not set');

  const params = new URLSearchParams({
    q: categoryToQuery(opts.category, opts.q),
    language: opts.language || 'en',
    size: String(Math.min(opts.pageSize || 20, 50)),
    apikey: k,
  });

  const { status, body } = await httpGet(`https://newsdata.io/api/1/news?${params}`, 'json');
  if (status !== 200) throw new Error(`NewsData HTTP ${status}`);
  const parsed = JSON.parse(body);
  if (!Array.isArray(parsed.results)) throw new Error('NewsData: unexpected payload');

  return parsed.results.map((a: any) => ({
    title: stripTags(a.title || ''),
    summary: stripTags(a.description || ''),
    content: stripTags(a.content || a.description || ''),
    url: a.link || '',
    imageUrl: a.image_url || null,
    source: Array.isArray(a.source_id) ? a.source_id[0] : (a.source_id || 'NewsData'),
    publishedAt: a.pubDate || new Date().toISOString(),
  })).filter((a: AggregatedArticle) => a.title.length > 0);
}

// ─── Provider 3: Google News RSS (no key — primary workhorse) ────────────

function parseRssItems(xml: string, max: number): AggregatedArticle[] {
  const items: AggregatedArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;

  while ((m = itemRegex.exec(xml)) !== null && items.length < max) {
    const block = m[1];
    const pick = (tag: string): string => {
      const t = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      return t ? stripTags(t[1]) : '';
    };

    const title = pick('title');
    if (!title) continue;

    const linkRaw = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const link = linkRaw ? stripTags(linkRaw[1]) : '';

    const pubDateRaw = pick('pubDate');
    let publishedAt = new Date().toISOString();
    if (pubDateRaw) {
      const d = new Date(pubDateRaw);
      if (!isNaN(d.getTime())) publishedAt = d.toISOString();
    }

    // Google News embeds the real publisher inside <source name="...">.
    const srcTag = block.match(/<source[^>]*name="([^"]*)"[^>]*>/i);
    const publisher = srcTag && srcTag[1] ? decodeEntities(srcTag[1]) : (pick('source') || 'Google News');

    items.push({
      title,
      summary: pick('description').slice(0, 400),
      content: pick('description'),
      url: link,
      imageUrl: null, // RSS rarely includes images; app shows a placeholder.
      source: publisher,
      publishedAt,
    });
  }
  return items;
}

async function fetchFromGoogleNews(opts: FetchOptions): Promise<AggregatedArticle[]> {
  const query = encodeURIComponent(categoryToQuery(opts.category, opts.q));
  const lang = opts.language || 'en';
  const region = lang === 'en' ? 'IN' : lang.toUpperCase();
  const url = `https://news.google.com/rss/search?q=${query}&hl=${lang}&gl=${region}&ceid=${region}:${lang}`;

  const { status, body } = await httpGet(url, 'xml');
  if (status !== 200) throw new Error(`GoogleNews HTTP ${status}`);
  const items = parseRssItems(body, Math.min(opts.pageSize || 20, 50));
  if (items.length === 0) throw new Error('GoogleNews: no items parsed');
  return items;
}

// ─── Provider 4: NewsAPI.org (legacy fallback) ───────────────────────────

async function fetchFromNewsApiLegacy(opts: FetchOptions): Promise<AggregatedArticle[]> {
  const k = keys().newsapi;
  if (!k) throw new Error('NEWSAPI_KEY not set');

  const params = new URLSearchParams({
    apiKey: k,
    language: opts.language || 'en',
    sortBy: 'publishedAt',
    pageSize: String(Math.min(opts.pageSize || 20, 100)),
    page: String(opts.page || 1),
    q: categoryToQuery(opts.category, opts.q),
  });

  const { status, body } = await httpGet(`https://newsapi.org/v2/everything?${params}`, 'json');
  if (status !== 200) throw new Error(`NewsAPI HTTP ${status}`);
  const parsed = JSON.parse(body);
  if (parsed.status === 'error') throw new Error(parsed.message || 'NewsAPI error');
  if (!Array.isArray(parsed.articles)) throw new Error('NewsAPI: unexpected payload');

  return parsed.articles.map((a: any) => ({
    title: a.title || '',
    summary: a.description || '',
    content: a.content || a.description || '',
    url: a.url || '',
    imageUrl: a.urlToImage || null,
    source: a.source?.name || 'NewsAPI',
    publishedAt: a.publishedAt || new Date().toISOString(),
  })).filter((a: AggregatedArticle) => a.title.length > 0);
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Fetch financial news trying every provider in order until one succeeds.
 * NEVER throws — returns `{provider:'none', articles:[]}` when everything
 * fails so callers can decide their own fallback.
 */
export async function aggregateFinancialNews(opts: FetchOptions = {}): Promise<NewsFetchResult> {
  const page = opts.page || 1;
  const pageSize = opts.pageSize || 20;
  const cacheKey = JSON.stringify({ ...opts, page, pageSize, __v: 2 });

  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const providers: Array<{ id: NewsProviderId; fn: () => Promise<AggregatedArticle[]> }> = [
    { id: 'gnews', fn: () => fetchFromGNews(opts) },
    { id: 'newsdata', fn: () => fetchFromNewsData(opts) },
    { id: 'googlenews', fn: () => fetchFromGoogleNews(opts) },
    { id: 'newsapi', fn: () => fetchFromNewsApiLegacy(opts) },
  ];

  const errors: string[] = [];
  for (const p of providers) {
    try {
      const articles = await p.fn();
      if (articles.length > 0) {
        const result: NewsFetchResult = {
          articles,
          totalResults: articles.length,
          provider: p.id,
        };
        cacheSet(cacheKey, result);
        console.log(`[News] Served ${articles.length} articles from ${p.id}`);
        return result;
      }
      errors.push(`${p.id}: empty`);
    } catch (err) {
      errors.push(`${p.id}: ${(err as Error).message}`);
    }
  }

  console.warn(`[News] All providers failed → ${errors.join(' | ')}`);
  return { articles: [], totalResults: 0, provider: 'none' };
}

/** Symbol-specific convenience wrapper. */
export async function aggregateSymbolNews(symbol: string, pageSize = 10): Promise<NewsFetchResult> {
  return aggregateFinancialNews({ q: `${symbol} stock`, pageSize });
}

/** Which provider will be tried first (for diagnostics endpoints). */
export function getPreferredProvider(): NewsProviderId {
  const k = keys();
  if (k.gnews) return 'gnews';
  if (k.newsdata) return 'newsdata';
  if (k.newsapi) return 'newsapi'; // legacy config present
  return 'googlenews'; // always available
}
