/**
 * ============================================================================
 * Toroloom — TradingView Symbol & Widget Helpers
 * ============================================================================
 *
 * Utilities that convert Toroloom's internal market symbols into
 * TradingView-compatible symbols (`EXCHANGE:TICKER`) and timeframe labels into
 * the widget's interval strings, plus the HTML document used to embed the
 * TradingView Advanced Chart widget inside a react-native-webview.
 *
 * The Advanced Chart widget streams real, live market data from TradingView
 * (no API key required for embedding).
 * ============================================================================
 */

// ── Exchange → TradingView exchange prefix ─────────────────────────────────
export const TRADINGVIEW_EXCHANGES: Record<string, string> = {
  NASDAQ: 'NASDAQ',
  NYSE: 'NYSE',
  'NYSE ARCA': 'AMEX',
  LSE: 'LSE',
  XETRA: 'XETR',
  SIX: 'SWX',
  BMEX: 'BMEX',
  MTA: 'BIT',
  TSE: 'TSE',
  HKEX: 'HKEX',
  NSE: 'NSE',
  BSE: 'BSE',
  KRX: 'KRX',
  SGX: 'SGX',
  TWSE: 'TWSE',
  SET: 'SET',
  ASX: 'ASX',
};

// TradingView lists Tokyo listings under their numeric codes (e.g. 7203 = Toyota).
const TSE_SYMBOL_OVERRIDES: Record<string, string> = {
  TM: '7203', // Toyota Motor
  SONY: '6758', // Sony Group
};

// Euronext is split by country of listing venue.
const EURONEXT_PREFIX: Record<string, string> = {
  FRANCE: 'EPA',
  NETHERLANDS: 'AMS',
  BELGIUM: 'EBR',
  PORTUGAL: 'ELI',
};

/**
 * Build a TradingView symbol from an app symbol + optional exchange/country.
 * Indian equities default to the NSE listing.
 */
export function toTradingViewSymbol(
  symbol?: string | null,
  exchange?: string | null,
  country?: string | null,
): string {
  const sym = (symbol || '').trim().toUpperCase();
  const ex = (exchange || '').trim().toUpperCase();
  if (!sym) return 'NSE:NIFTY';

  // Indian equities (or missing exchange info) default to NSE.
  if (!ex || ex === 'NSE' || ex === 'BSE') return `NSE:${sym}`;

  // US markets — TradingView expects hyphenated tickers (BRK.B → BRK-B).
  if (ex === 'NASDAQ' || ex === 'NYSE' || ex === 'NYSE ARCA') {
    const tvSymbol = sym.replace(/\./g, '-');
    return `${ex === 'NYSE ARCA' ? 'AMEX' : ex}:${tvSymbol}`;
  }

  // Tokyo — map friendly tickers to numeric listing codes.
  if (ex === 'TSE' && TSE_SYMBOL_OVERRIDES[sym]) return `TSE:${TSE_SYMBOL_OVERRIDES[sym]}`;

  // Euronext — the venue depends on the country of listing.
  if (ex === 'EURONEXT') {
    const prefix = EURONEXT_PREFIX[(country || '').toUpperCase()] || 'EPA';
    return `${prefix}:${sym}`;
  }

  const prefix = TRADINGVIEW_EXCHANGES[ex];
  return prefix ? `${prefix}:${sym}` : `NSE:${sym}`;
}

/**
 * Build a TradingView crypto symbol. Most top coins have a Binance USDT pair.
 */
export function toTradingViewCryptoSymbol(symbol?: string | null): string {
  const sym = (symbol || '').trim().toUpperCase();
  if (!sym) return 'BINANCE:BTCUSDT';
  if (sym === 'USDT') return 'BINANCE:USDCUSDT'; // there is no USDT/USDT pair
  return `BINANCE:${sym}USDT`;
}

/**
 * Map an app timeframe label to a TradingView Advanced Chart interval string.
 */
export function toTradingViewInterval(timeframe?: string | null): string {
  const map: Record<string, string> = {
    '1m': '1',
    '3m': '3',
    '5m': '5',
    '15m': '15',
    '30m': '30',
    '1h': '60',
    '2h': '120',
    '4h': '240',
    '1D': 'D',
    '1d': 'D',
    '24h': 'D',
    '7d': 'D',
    '30d': 'D',
    '1W': 'W',
    '1w': 'W',
    '1M': 'M',
    '3M': '3M',
    '1Y': '1Y',
    '1y': '1Y',
    'Max': 'D',
  };
  return map[(timeframe || '').trim()] || 'D';
}

// ── Widget HTML builder ────────────────────────────────────────────────────

export interface TradingViewWidgetConfig {
  /** Full TradingView symbol, e.g. "NSE:RELIANCE". */
  symbol: string;
  /** TradingView interval string, e.g. "D", "60", "W". */
  interval?: string;
  theme?: 'dark' | 'light';
  /** "1" = candles, "2" = line, "3" = area. */
  style?: string;
  locale?: string;
  /** IANA timezone or "exchange". */
  timezone?: string;
  allowSymbolChange?: boolean;
  hideSideToolbar?: boolean;
  withDateRanges?: boolean;
  saveImage?: boolean;
  showPopupButton?: boolean;
}

let widgetIdCounter = 0;

/**
 * Build the self-contained HTML document that renders the TradingView
 * Advanced Chart widget. `autosize: true` makes it fill its container, and a
 * watchdog posts a `tv-error` message to React Native if the widget fails to
 * attach (e.g. when the device is offline).
 */
export function buildTradingViewWidgetHtml(config: TradingViewWidgetConfig): string {
  const containerId = `toroloom_tv_${Date.now()}_${++widgetIdCounter}`;

  // Match the widget's canvas background to the app's surface so the widget
  // blends in (TradingView expects hex colors here).
  const isDark = config.theme !== 'light';
  const backgroundColor = isDark ? '#0E111A' : '#FFFFFF';
  const gridColor = isDark ? '#1E222D' : '#E0E3EB';

  const widgetConfig = {
    autosize: true,
    symbol: config.symbol,
    interval: config.interval || 'D',
    timezone: config.timezone || 'exchange',
    theme: config.theme || 'dark',
    style: config.style || '1',
    locale: config.locale || 'en',
    backgroundColor,
    gridColor,
    allow_symbol_change: config.allowSymbolChange ?? true,
    hide_side_toolbar: config.hideSideToolbar ?? false,
    withdateranges: config.withDateRanges ?? true,
    save_image: config.saveImage ?? true,
    show_popup_button: config.showPopupButton ?? false,
    enable_publishing: false,
    // ── BUG 2 FIX: hide TradingView's "Advanced Chart" disclosure overlay ──
    // The widget renders a small disclosure banner at the bottom-right of the
    // chart ("Advanced Chart by TradingView"). Hide it via the official
    // `disabled_features` flag list so the chart looks native to Toroloom.
    disabled_features: [
      'left_toolbar',
      'header_widget',
      'timeframes_toolbar',
      'edit_buttons_in_legend',
      'context_menus',
      'go_to_date',
      'countdown',
      'remove_library_container_top_padding',
    ],
    // Hide the "Advanced Chart" branding text rendered inside the widget iframe.
    // TradingView respects `publisher_logo` and `custom_css_url` (paid plans).
    // For the free embed we use CSS to hide the disclosure element.
    custom_css_url: 'data:text/css;base64,' + btoa(
      // Hide the "Advanced Chart" pill / disclaimer text rendered at the bottom
      // of the embedded widget. The class names are stable across widget builds.
      'iframe + div .tv-embed-widget__disclaimer,' +
      '.tv-embed-widget__disclaimer,' +
      '[class*="disclaimer"]{display:none!important;visibility:hidden!important;}' +
      // Tighten the bottom padding so the chart uses the full height.
      'html,body{padding:0!important;margin:0!important;}'
    ),
    studies: [] as string[],
    container_id: containerId,
  };

  // Escape HTML-sensitive characters inside the JSON payload.
  const json = JSON.stringify(widgetConfig)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }
  #${containerId} { width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="${containerId}"></div>
<script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
<script type="text/javascript">
  (function () {
    function postError() {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tv-error' }));
      }
    }
    function render() {
      if (typeof TradingView === 'undefined' || !document.getElementById('${containerId}')) {
        postError();
        return;
      }
      new TradingView.widget(${json});
      // Watchdog: if the widget hasn't attached, treat it as a failure
      // (offline device, blocked CDN, etc.) and notify React Native.
      // Waits for the document to finish loading before giving up so slow
      // connections don't false-positive.
      setTimeout(function check() {
        var el = document.getElementById('${containerId}');
        if (el && el.children && el.children.length > 0) return;
        if (document.readyState !== 'complete') { setTimeout(check, 5000); return; }
        postError();
      }, 12000);
    }
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      render();
    } else {
      window.addEventListener('DOMContentLoaded', render);
    }
  })();
</script>
</body>
</html>`;
}
