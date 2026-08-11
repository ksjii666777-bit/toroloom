/**
 * ============================================================================
 * Toroloom — Real TradingView Advanced Chart Widget Demo (browser)
 * ============================================================================
 *
 * Embeds the official TradingView Advanced Chart widget — the same one the
 * native app renders via react-native-webview (`src/components/TradingViewChart`)
 * — using the app's real `buildTradingViewWidgetHtml()` helper. This widget
 * streams REAL, live market data from TradingView (no API key required for
 * embedding) into the web/PWA build.
 *
 * Display-only by design (widget is iframe-locked); prices shown here cannot
 * be used by the rest of the app — pair it with a licensed data provider when
 * you need the data itself (see docs/PRODUCTION_ENV_CHECKLIST.md).
 * ============================================================================
 */

import { useMemo, useState } from 'react';
import { buildTradingViewWidgetHtml } from '../src/utils/tradingView';
import { useTheme } from '../src/context/ThemeContext';

const SYMBOLS = [
  { label: 'RELIANCE', symbol: 'NSE:RELIANCE' },
  { label: 'TCS', symbol: 'NSE:TCS' },
  { label: 'HDFCBANK', symbol: 'NSE:HDFCBANK' },
  { label: 'INFY', symbol: 'NSE:INFY' },
  { label: 'ITC', symbol: 'NSE:ITC' },
  { label: 'SBIN', symbol: 'NSE:SBIN' },
  { label: 'AAPL', symbol: 'NASDAQ:AAPL' },
  { label: 'BTC', symbol: 'BINANCE:BTCUSDT' },
] as const;

const INTERVALS = [
  { label: '1m', value: '1' },
  { label: '5m', value: '5' },
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' },
  { label: '1M', value: 'M' },
] as const;

export default function TradingViewWidgetDemo() {
  const { isDark } = useTheme();
  const [symbolKey, setSymbolKey] = useState('NSE:RELIANCE');
  const [intervalKey, setIntervalKey] = useState('D');
  const [height, setHeight] = useState(460);

  const html = useMemo(
    () =>
      buildTradingViewWidgetHtml({
        symbol: symbolKey,
        interval: intervalKey,
        theme: isDark ? 'dark' : 'light',
        locale: 'en',
        timezone: 'Asia/Kolkata',
        allowSymbolChange: false,
        withDateRanges: true,
        saveImage: true,
        showPopupButton: true,
      }),
    [symbolKey, intervalKey, isDark],
  );

  return (
    <div className="card chart-demo">
      <div className="chart-toolbar">
        <div className="chart-symbols">
          {SYMBOLS.map((s) => (
            <button
              key={s.symbol}
              type="button"
              className={`chart-chip ${s.symbol === symbolKey ? 'active' : ''}`}
              aria-pressed={s.symbol === symbolKey}
              onClick={() => setSymbolKey(s.symbol)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="chart-live">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              type="button"
              className={`chart-chip ${iv.value === intervalKey ? 'active' : ''}`}
              aria-pressed={iv.value === intervalKey}
              onClick={() => setIntervalKey(iv.value)}
            >
              {iv.label}
            </button>
          ))}
          <button
            type="button"
            className={`chart-chip ${height === 620 ? 'active' : ''}`}
            aria-pressed={height === 620}
            onClick={() => setHeight((h) => (h === 460 ? 620 : 460))}
          >
            {height === 620 ? '⤢ Compact' : '⤡ Large'}
          </button>
        </div>
      </div>

      <div className="tv-widget-wrap">
        <span className="tv-live-badge">
          <span className="tv-live-dot" /> LIVE · real TradingView data
        </span>
        <iframe
          title={`TradingView Advanced Chart — ${symbolKey}`}
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin allow-popups"
          style={{ width: '100%', height, border: 'none', display: 'block' }}
          data-testid="tv-widget-iframe"
        />
      </div>

      <div className="chart-foot">
        <span className="chart-license">
          Powered by the official{' '}
          <a
            href="https://www.tradingview.com/widget/advanced-chart/"
            target="_blank"
            rel="noreferrer"
          >
            TradingView Advanced Chart widget
          </a>{' '}
          — real market data, no API key needed for embedding
        </span>
        <span className="tv-meta">{symbolKey} · {intervalKey} · {isDark ? 'dark' : 'light'}</span>
      </div>
    </div>
  );
}
