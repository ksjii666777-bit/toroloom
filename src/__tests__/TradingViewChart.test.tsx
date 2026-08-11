/**
 * ============================================================================
 * Toroloom — TradingViewChart Component Tests
 * ============================================================================
 * Verifies the widget HTML handed to the WebView (symbol, theme, interval),
 * and that both the tv-error bridge message and WebView load errors call the
 * onError fallback.
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from './testUtils';

// Capture the WebView props so tests can inspect source + trigger callbacks.
const capturedWebViewProps: Record<string, any> = {};
vi.mock('react-native-webview', () => ({
  WebView: (props: any) => {
    Object.keys(props).forEach((k) => {
      capturedWebViewProps[k] = props[k];
    });
    return null;
  },
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      primary: '#3B82F6',
      textMuted: '#64748B',
    },
  }),
}));

vi.mock('../hooks/useT', () => ({
  useT: () => ({ t: (key: string) => key, language: 'en', isHindi: false, toggleLanguage: vi.fn() }),
  default: () => ({ t: (key: string) => key, language: 'en', isHindi: false, toggleLanguage: vi.fn() }),
}));

import TradingViewChart from '../components/TradingViewChart';

describe('TradingViewChart', () => {
  beforeEach(() => {
    Object.keys(capturedWebViewProps).forEach((k) => delete capturedWebViewProps[k]);
  });

  it('renders the widget HTML containing the TradingView symbol', () => {
    render(<TradingViewChart symbol="NSE:RELIANCE" interval="D" />);
    const html = capturedWebViewProps.source?.html as string;
    expect(html).toBeTruthy();
    expect(html).toContain('NSE:RELIANCE');
    expect(html).toContain('s3.tradingview.com/tv.js');
  });

  it('passes the requested interval to the widget config', () => {
    render(<TradingViewChart symbol="NSE:RELIANCE" interval="W" />);
    const html = capturedWebViewProps.source?.html as string;
    expect(html).toContain('"interval":"W"');
  });

  it('uses a theme-matching hex background for the widget canvas', () => {
    render(<TradingViewChart symbol="NSE:RELIANCE" />);
    const html = capturedWebViewProps.source?.html as string;
    expect(html).toContain('"backgroundColor":"#0E111A"');
  });

  it('uses the dark theme from ThemeContext', () => {
    render(<TradingViewChart symbol="NSE:RELIANCE" />);
    const html = capturedWebViewProps.source?.html as string;
    expect(html).toContain('"theme":"dark"');
  });

  it('maps chartStyle to the widget style code (area → 3)', () => {
    render(<TradingViewChart symbol="NSE:RELIANCE" chartStyle="area" />);
    const html = capturedWebViewProps.source?.html as string;
    expect(html).toContain('"style":"3"');
  });

  it('defaults save_image on and show_popup_button off', () => {
    render(<TradingViewChart symbol="NSE:RELIANCE" />);
    const html = capturedWebViewProps.source?.html as string;
    expect(html).toContain('"save_image":true');
    expect(html).toContain('"show_popup_button":false');
  });

  it('passes saveImage and showPopupButton through to the widget config', () => {
    render(<TradingViewChart symbol="NSE:RELIANCE" saveImage={false} showPopupButton />);
    const html = capturedWebViewProps.source?.html as string;
    expect(html).toContain('"save_image":false');
    expect(html).toContain('"show_popup_button":true');
  });

  it('enables JavaScript and DOM storage on the WebView', () => {
    render(<TradingViewChart symbol="NSE:RELIANCE" />);
    expect(capturedWebViewProps.javaScriptEnabled).toBe(true);
    expect(capturedWebViewProps.domStorageEnabled).toBe(true);
  });

  it('calls onError when the webview reports a tv-error message', () => {
    const onError = vi.fn();
    render(<TradingViewChart symbol="NSE:RELIANCE" onError={onError} />);

    capturedWebViewProps.onMessage({
      nativeEvent: { data: JSON.stringify({ type: 'tv-error' }) },
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('ignores non-error messages from the webview', () => {
    const onError = vi.fn();
    render(<TradingViewChart symbol="NSE:RELIANCE" onError={onError} />);

    capturedWebViewProps.onMessage({
      nativeEvent: { data: JSON.stringify({ type: 'quote', price: 123 }) },
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onError when the WebView fails to load', () => {
    const onError = vi.fn();
    render(<TradingViewChart symbol="NSE:RELIANCE" onError={onError} />);

    capturedWebViewProps.onError?.();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
