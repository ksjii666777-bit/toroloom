/**
 * ============================================================================
 * Toroloom — Open Graph Preview Routes
 * ============================================================================
 *
 * Serves HTML pages with Open Graph / Twitter Card meta tags for social media
 * preview cards (WhatsApp, Twitter, Slack, Discord, etc.).
 *
 * When a crawler (facebookexternalhit, Twitterbot, etc.) hits these URLs,
 * it gets a static HTML page with rich meta tags. When a real user taps the
 * link, they're redirected to the app via the deep link.
 *
 * URL Format:
 *   /og/stock/:symbol     → Stock detail preview
 *   /og/post/:postId      → Community post preview
 *   /og/course/:courseId  → Course preview
 *   /og/advisor/:advisorId → Advisor preview
 *   /og/share/:shareId    → Custom share link preview
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { getBroker } from '../services/broker';
import { getStorageIfInitialized } from '../services/storage';

const router = Router();

const APP_NAME = 'Toroloom';
const APP_URL = process.env.UNIVERSAL_LINK_BASE || 'https://toroloom.com';
const DEFAULT_OG_IMAGE = `${APP_URL}/og-default.png`;
const IOS_APP_STORE = 'https://apps.apple.com/app/toroloom';
const ANDROID_PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.toroloom';

// ── Crawler detection ──────────────────────────────────────────────────────
const CRAWLER_AGENTS = [
  'facebookexternalhit', 'twitterbot', 'linkedinbot', 'slackbot',
  'discordbot', 'whatsapp', 'telegrambot', 'googlebot', 'bingbot',
  'pinterestbot', 'skypeuripreview', 'outlook-oembed', 'naverbot',
  'yeti', 'yandex', 'embedly', 'quora', 'flipboard', 'tumblr',
  'bitrix link preview', 'garage48', 'hyperium', 'mastodon',
];

function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return CRAWLER_AGENTS.some(agent => ua.includes(agent));
}

// ── HTML Template ──────────────────────────────────────────────────────────

function renderOGPage(options: {
  title: string;
  description: string;
  image?: string;
  url: string;
  deepLink: string;
  type?: string;
  extraMeta?: Record<string, string>;
}): string {
  const { title, description, image, url, deepLink, type = 'website', extraMeta } = options;
  const ogImage = image || DEFAULT_OG_IMAGE;

  const extraMetaTags = extraMeta
    ? Object.entries(extraMeta).map(([key, value]) => {
        const name = key.startsWith('twitter:') ? 'name' : 'property';
        return `<meta ${name}="${key}" content="${escapeHtml(value)}" />`;
      }).join('\n    ')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Primary OG Tags -->
  <meta property="og:type" content="${escapeHtml(type)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:site_name" content="${APP_NAME}" />
  <meta property="og:locale" content="en_IN" />

  <!-- Twitter Card Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@toroloom" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />

  <!-- App Deep Link -->
  <meta name="al:ios:app_name" content="${APP_NAME}" />
  <meta name="al:ios:url" content="${escapeHtml(deepLink)}" />
  <meta name="al:android:app_name" content="${APP_NAME}" />
  <meta name="al:android:url" content="${escapeHtml(deepLink)}" />

  ${extraMetaTags}

  <title>${escapeHtml(title)} — ${APP_NAME}</title>

  <script>
    // Redirect real users to the app
    (function() {
      var ua = navigator.userAgent.toLowerCase();
      var crawlers = ['facebookexternalhit','twitterbot','linkedinbot','slackbot',
        'discordbot','whatsapp','telegrambot','googlebot','bingbot','naverbot',
        'pinterestbot','skypeuripreview','yeti','yandex','embedly'];
      var isCrawler = crawlers.some(function(c) { return ua.indexOf(c) !== -1; });
      if (!isCrawler) {
        // Try to open in app, fallback to web
        window.location.replace('${escapeHtml(deepLink)}');
      }
    })();
  </script>

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #1a1a2e;
      border: 1px solid #2a2a4a;
      border-radius: 16px;
      padding: 40px;
      max-width: 600px;
      width: 100%;
      text-align: center;
    }
    .logo {
      font-size: 32px;
      font-weight: 800;
      color: #6366f1;
      margin-bottom: 16px;
    }
    h1 { font-size: 24px; margin-bottom: 12px; color: #fff; }
    p { font-size: 16px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
    .cta {
      display: inline-block;
      background: #6366f1;
      color: #fff;
      padding: 14px 32px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      transition: background 0.2s;
    }
    .cta:hover { background: #4f46e5; }
    .stores { margin-top: 16px; font-size: 13px; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">${APP_NAME}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <a class="cta" href="${escapeHtml(deepLink)}">Open in ${APP_NAME}</a>
    <div class="stores">
      Also available on
      <a href="${IOS_APP_STORE}" style="color:#6366f1">iOS</a> &amp;
      <a href="${ANDROID_PLAY_STORE}" style="color:#6366f1">Android</a>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /og/stock/:symbol
 * Open Graph preview for stock detail page
 */
router.get('/stock/:symbol', async (req: Request, res: Response) => {
  const symbol = req.params.symbol as string;
  const symbolUpper = symbol.toUpperCase();
  const deepLink = `toroloom://stock/${encodeURIComponent(symbolUpper)}?symbol=${encodeURIComponent(symbolUpper)}`;
  const pageUrl = `${APP_URL}/og/stock/${encodeURIComponent(symbolUpper)}`;

  try {
    const broker = await getBroker();
    const stocks = await broker.getStocks();
    const stock = stocks.find((s: any) => s.symbol === symbolUpper);

    const title = stock
      ? `${stock.symbol} — ${stock.name} | Stock Price & Chart`
      : `${symbolUpper} — Stock Details`;
    const description = stock
      ? `${stock.name} (${stock.symbol}) trading at ₹${stock.price.toFixed(2)} | P/E: ${stock.pe.toFixed(1)}x | Market Cap: ${stock.marketCap} | Sector: ${stock.sector}`
      : `View live price, charts, and analysis for ${symbolUpper} on ${APP_NAME}`;
    const image = stock
      ? `${APP_URL}/og/stock/${encodeURIComponent(symbolUpper)}/image`
      : DEFAULT_OG_IMAGE;

    // For crawlers, serve HTML with OG tags; for users, redirect
    const userAgent = (req.headers['user-agent'] as string) || '';
    if (isCrawler(userAgent)) {
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderOGPage({
        title,
        description,
        image,
        url: pageUrl,
        deepLink,
        type: 'article',
        extraMeta: stock ? {
          'article:section': stock.sector,
          'article:tag': stock.symbol,
        } : {},
      }));
    } else {
      // Real user — redirect to deep link
      res.redirect(302, deepLink);
    }
  } catch (error) {
    // Fallback: serve generic OG tags even if broker is down
    const fallbackTitle = `${symbolUpper} — Stock Details`;
    const fallbackDesc = `View live price, charts, and analysis for ${symbolUpper} on ${APP_NAME}`;

    const userAgent = (req.headers['user-agent'] as string) || '';
    if (isCrawler(userAgent)) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderOGPage({ title: fallbackTitle, description: fallbackDesc, url: pageUrl, deepLink }));
    } else {
      res.redirect(302, deepLink);
    }
  }
});

/**
 * GET /og/post/:postId
 * Open Graph preview for community post
 */
router.get('/post/:postId', async (req: Request, res: Response) => {
  const postId = req.params.postId as string;
  const deepLink = `toroloom://post/${postId}`;
  const pageUrl = `${APP_URL}/og/post/${postId}`;

  try {
    const storage = getStorageIfInitialized();
    let post = null;
    if (storage && typeof storage.loadCommunityPost === 'function') {
      post = await storage.loadCommunityPost(postId);
    }

    const title = post
      ? `${post.userName}'s Post — ${APP_NAME} Community`
      : `Community Post — ${APP_NAME}`;
    const description = post
      ? post.content.substring(0, 200) + (post.content.length > 200 ? '...' : '')
      : `View this post on ${APP_NAME} Community`;
    const image = `${APP_URL}/og-default.png`;

    const userAgent = (req.headers['user-agent'] as string) || '';
    if (isCrawler(userAgent)) {
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderOGPage({
        title,
        description,
        image,
        url: pageUrl,
        deepLink,
        type: 'article',
        extraMeta: post ? {
          'article:author': post.userName,
          'article:published_time': post.timestamp,
        } : {},
      }));
    } else {
      res.redirect(302, deepLink);
    }
  } catch (error) {
    const fallbackTitle = `Community Post — ${APP_NAME}`;
    const fallbackDesc = `View this post on ${APP_NAME} Community`;

    const userAgent = (req.headers['user-agent'] as string) || '';
    if (isCrawler(userAgent)) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderOGPage({ title: fallbackTitle, description: fallbackDesc, url: pageUrl, deepLink }));
    } else {
      res.redirect(302, deepLink);
    }
  }
});

/**
 * GET /og/course/:courseId
 * Open Graph preview for education course
 */
router.get('/course/:courseId', async (req: Request, res: Response) => {
  const courseId = req.params.courseId as string;
  const deepLink = `toroloom://course/${courseId}`;
  const pageUrl = `${APP_URL}/og/course/${courseId}`;

  // Course data is not stored in the storage engine, so we serve generic OG tags
  const title = `Course — ${APP_NAME} Learn`;
  const description = `Learn stock market investing on ${APP_NAME}`;

  const userAgent = (req.headers['user-agent'] as string) || '';
  if (isCrawler(userAgent)) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderOGPage({ title, description, url: pageUrl, deepLink, type: 'article' }));
  } else {
    res.redirect(302, deepLink);
  }
});

/**
 * GET /og/advisor/:advisorId
 * Open Graph preview for advisor profile
 */
router.get('/advisor/:advisorId', async (req: Request, res: Response) => {
  const advisorId = req.params.advisorId as string;
  const deepLink = `toroloom://advisor/${advisorId}`;
  const pageUrl = `${APP_URL}/og/advisor/${advisorId}`;

  // Advisor data is not in storage engine, serve generic OG tags
  const title = `Advisor — ${APP_NAME} Advisory`;
  const description = `Connect with SEBI-registered investment advisors on ${APP_NAME}`;

  const userAgent = (req.headers['user-agent'] as string) || '';
  if (isCrawler(userAgent)) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderOGPage({ title, description, url: pageUrl, deepLink, type: 'profile' }));
  } else {
    res.redirect(302, deepLink);
  }
});

/**
 * GET /og/share/:shareId
 * Open Graph preview for a custom share link (generated via share API)
 */
router.get('/share/:shareId', async (req: Request, res: Response) => {
  const shareId = req.params.shareId as string;
  const deepLink = `toroloom://share/${shareId}`;
  const pageUrl = `${APP_URL}/og/share/${shareId}`;

  // For share links, we serve a generic preview since share data is ephemeral
  const userAgent = (req.headers['user-agent'] as string) || '';
  if (isCrawler(userAgent)) {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderOGPage({
      title: `Shared on ${APP_NAME}`,
      description: `Check out this content shared on ${APP_NAME} — Indian Stock Market Trading App`,
      url: pageUrl,
      deepLink,
    }));
  } else {
    res.redirect(302, deepLink);
  }
});

export default router;
