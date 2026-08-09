/**
 * ============================================================================
 * Toroloom — TradingView Helpers Unit Tests
 * ============================================================================
 * Verifies symbol → TradingView symbol mapping, timeframe → interval mapping,
 * and the Advanced Chart widget HTML builder.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import {
  toTradingViewSymbol,
  toTradingViewCryptoSymbol,
  toTradingViewInterval,
  buildTradingViewWidgetHtml,
} from '../utils/tradingView';

describe('toTradingViewSymbol', () => {
  it('defaults Indian equities to NSE', () => {
    expect(toTradingViewSymbol('RELIANCE', 'NSE')).toBe('NSE:RELIANCE');
    expect(toTradingViewSymbol('TCS')).toBe('NSE:TCS'); // no exchange → NSE
    expect(toTradingViewSymbol('INFY', 'BSE')).toBe('NSE:INFY');
  });

  it('maps US exchanges', () => {
    expect(toTradingViewSymbol('AAPL', 'NASDAQ')).toBe('NASDAQ:AAPL');
    expect(toTradingViewSymbol('JPM', 'NYSE')).toBe('NYSE:JPM');
    expect(toTradingViewSymbol('SPY', 'NYSE Arca')).toBe('AMEX:SPY');
  });

  it('normalizes dotted US tickers to hyphens (BRK.B → BRK-B)', () => {
    expect(toTradingViewSymbol('BRK.B', 'NYSE')).toBe('NYSE:BRK-B');
    expect(toTradingViewSymbol('BF.B', 'NYSE')).toBe('NYSE:BF-B');
  });

  it('maps global exchanges', () => {
    expect(toTradingViewSymbol('ULVR', 'LSE')).toBe('LSE:ULVR');
    expect(toTradingViewSymbol('SAP', 'Xetra')).toBe('XETR:SAP');
    expect(toTradingViewSymbol('NESN', 'SIX')).toBe('SWX:NESN');
    expect(toTradingViewSymbol('ENI', 'MTA')).toBe('BIT:ENI');
    expect(toTradingViewSymbol('0700', 'HKEX')).toBe('HKEX:0700');
    expect(toTradingViewSymbol('005930', 'KRX')).toBe('KRX:005930');
    expect(toTradingViewSymbol('D05', 'SGX')).toBe('SGX:D05');
    expect(toTradingViewSymbol('RELIANCE', 'NSE', 'India')).toBe('NSE:RELIANCE');
  });

  it('maps Euronext by country of listing', () => {
    expect(toTradingViewSymbol('AIR', 'Euronext', 'France')).toBe('EPA:AIR');
    expect(toTradingViewSymbol('MC', 'Euronext', 'France')).toBe('EPA:MC');
    expect(toTradingViewSymbol('ASML', 'Euronext', 'Netherlands')).toBe('AMS:ASML');
    expect(toTradingViewSymbol('ABN', 'Euronext', 'Netherlands')).toBe('AMS:ABN');
  });

  it('maps Tokyo listings to numeric codes', () => {
    expect(toTradingViewSymbol('TM', 'TSE', 'Japan')).toBe('TSE:7203');
    expect(toTradingViewSymbol('SONY', 'TSE', 'Japan')).toBe('TSE:6758');
  });

  it('falls back to NSE for unknown exchanges or missing symbols', () => {
    expect(toTradingViewSymbol('XYZ', 'FUTURE_EXCHANGE')).toBe('NSE:XYZ');
    expect(toTradingViewSymbol('', 'NYSE')).toBe('NSE:NIFTY');
    expect(toTradingViewSymbol(null, null)).toBe('NSE:NIFTY');
  });
});

describe('toTradingViewCryptoSymbol', () => {
  it('maps coins to Binance USDT pairs', () => {
    expect(toTradingViewCryptoSymbol('BTC')).toBe('BINANCE:BTCUSDT');
    expect(toTradingViewCryptoSymbol('eth')).toBe('BINANCE:ETHUSDT');
    expect(toTradingViewCryptoSymbol('SOL')).toBe('BINANCE:SOLUSDT');
  });

  it('handles USDT (no USDT/USDT pair) and empty input', () => {
    expect(toTradingViewCryptoSymbol('USDT')).toBe('BINANCE:USDCUSDT');
    expect(toTradingViewCryptoSymbol('')).toBe('BINANCE:BTCUSDT');
    expect(toTradingViewCryptoSymbol(null)).toBe('BINANCE:BTCUSDT');
  });
});

describe('toTradingViewInterval', () => {
  it('maps intraday timeframes to minute intervals', () => {
    expect(toTradingViewInterval('1m')).toBe('1');
    expect(toTradingViewInterval('5m')).toBe('5');
    expect(toTradingViewInterval('15m')).toBe('15');
    expect(toTradingViewInterval('1h')).toBe('60');
  });

  it('maps daily/weekly/monthly labels', () => {
    expect(toTradingViewInterval('1D')).toBe('D');
    expect(toTradingViewInterval('1W')).toBe('W');
    expect(toTradingViewInterval('1M')).toBe('M');
    expect(toTradingViewInterval('3M')).toBe('3M');
    expect(toTradingViewInterval('1Y')).toBe('1Y');
    expect(toTradingViewInterval('Max')).toBe('D');
  });

  it('falls back to daily for unknown labels', () => {
    expect(toTradingViewInterval('nonsense')).toBe('D');
    expect(toTradingViewInterval(null)).toBe('D');
  });
});

describe('buildTradingViewWidgetHtml', () => {
  it('embeds the symbol, theme and script', () => {
    const html = buildTradingViewWidgetHtml({
      symbol: 'NSE:RELIANCE',
      interval: 'D',
      theme: 'dark',
      style: '1',
    });

    expect(html).toContain('s3.tradingview.com/tv.js');
    expect(html).toContain('NSE:RELIANCE');
    expect(html).toContain('"theme":"dark"');
    expect(html).toContain('"interval":"D"');
    expect(html).toContain('"autosize":true');
    expect(html).toContain('"allow_symbol_change":true');
    expect(html).toContain('new TradingView.widget(');
    expect(html).toContain("type: 'tv-error'");
  });

  it('uses light theme and line style when requested', () => {
    const html = buildTradingViewWidgetHtml({
      symbol: 'NASDAQ:AAPL',
      interval: '60',
      theme: 'light',
      style: '2',
      allowSymbolChange: false,
      hideSideToolbar: true,
    });

    expect(html).toContain('NASDAQ:AAPL');
    expect(html).toContain('"theme":"light"');
    expect(html).toContain('"interval":"60"');
    expect(html).toContain('"style":"2"');
    expect(html).toContain('"allow_symbol_change":false');
    expect(html).toContain('"hide_side_toolbar":true');
  });

  it('generates a unique container id per call', () => {
    const a = buildTradingViewWidgetHtml({ symbol: 'NSE:TCS' });
    const b = buildTradingViewWidgetHtml({ symbol: 'NSE:TCS' });
    const idA = a.match(/id="(toroloom_tv_[^"]+)"/)?.[1];
    const idB = b.match(/id="(toroloom_tv_[^"]+)"/)?.[1];
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();
    expect(idA).not.toBe(idB);
  });
});
