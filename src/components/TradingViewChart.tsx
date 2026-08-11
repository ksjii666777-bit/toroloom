/**
 * ============================================================================
 * Toroloom — TradingViewChart
 * ============================================================================
 *
 * Embeds the TradingView Advanced Chart widget inside a react-native-webview
 * so the app can display real, live market data (prices, indicators, drawing
 * tools) without maintaining its own feed.
 *
 * Features:
 *   - Auto-theming (dark/light) from the app's ThemeContext
 *   - Loading skeleton while the widget boots
 *   - Failure detection: if the widget cannot attach (offline device, blocked
 *     CDN), the watchdog posts a `tv-error` message and `onError` is called so
 *     callers can fall back to their offline chart.
 * ============================================================================
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { FONTS, BORDER_RADIUS } from '../constants/theme';
import { buildTradingViewWidgetHtml } from '../utils/tradingView';

export interface TradingViewChartProps {
  /** Full TradingView symbol, e.g. "NSE:RELIANCE" or "BINANCE:BTCUSDT". */
  symbol: string;
  /** TradingView interval string, e.g. "D", "60", "W", "3M". */
  interval?: string;
  /** Fixed chart height in px. Omit to fill the parent (flex: 1). */
  height?: number;
  chartStyle?: 'candles' | 'line' | 'area';
  allowSymbolChange?: boolean;
  hideSideToolbar?: boolean;
  withDateRanges?: boolean;
  saveImage?: boolean;
  showPopupButton?: boolean;
  locale?: string;
  /** IANA timezone (e.g. "Asia/Kolkata") or "exchange". */
  timezone?: string;
  /** Called when the widget fails to load (offline / blocked CDN). */
  onError?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function TradingViewChart({
  symbol,
  interval = 'D',
  height,
  chartStyle = 'candles',
  allowSymbolChange = true,
  hideSideToolbar = false,
  withDateRanges = true,
  saveImage = true,
  showPopupButton = false,
  locale = 'en',
  timezone,
  onError,
  style,
}: TradingViewChartProps) {
  const { colors, isDark } = useTheme();
  const { t } = useT();

  const styleCode = chartStyle === 'line' ? '2' : chartStyle === 'area' ? '3' : '1';

  const html = useMemo(
    () =>
      buildTradingViewWidgetHtml({
        symbol,
        interval,
        theme: isDark ? 'dark' : 'light',
        style: styleCode,
        locale,
        timezone,
        allowSymbolChange,
        hideSideToolbar,
        withDateRanges,
        saveImage,
        showPopupButton,
      }),
    [
      symbol,
      interval,
      isDark,
      styleCode,
      locale,
      timezone,
      allowSymbolChange,
      hideSideToolbar,
      withDateRanges,
      saveImage,
      showPopupButton,
    ],
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg && msg.type === 'tv-error') onError?.();
      } catch {
        // Ignore malformed messages from the webview.
      }
    },
    [onError],
  );

  const handleLoadError = useCallback(() => onError?.(), [onError]);

  return (
    <View style={[styles.container, height ? { height } : styles.flex, style]}>
      <WebView
        key={`tv-${symbol}-${interval}-${isDark ? 'dark' : 'light'}-${styleCode}`}
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('charts.loadingChart')}</Text>
          </View>
        )}
        onMessage={handleMessage}
        onError={handleLoadError}
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  flex: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
});
