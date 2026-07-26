/**
 * ============================================================================
 * Toroloom — Global Stock Detail Screen
 * ============================================================================
 *
 * Displays detailed information about a European or Asian stock including:
 *   - Price & change with exchange badge (LSE, Xetra, TSE, HKEX, etc.)
 *   - Country & region flags
 *   - Key fundamentals (Market Cap, P/E, Dividend, 52W Range)
 *   - About company section
 *   - Price trend chart (simplified)
 *   - Related stocks from same sector
 *
 * Navigation: USMarketsScreen → GlobalStockDetail
 * ============================================================================
 */

import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Platform, ActivityIndicator } from 'react-native';
import Animated, { FadeInRight, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { globalMarketsApi } from '../../services/api/globalMarkets';
import { mockEuropeanStocks, mockAsianStocks } from '../../constants/mockData';
import type { InternationalStock } from '../../types';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - SPACING.xl * 2 - SPACING.lg * 2;
const CHART_HEIGHT = 160;

// ──── Country flag emoji map ─────────────────────────────────
const COUNTRY_FLAGS: Record<string, string> = {
  UK: '🇬🇧', Germany: '🇩🇪', France: '🇫🇷', Switzerland: '🇨🇭',
  Spain: '🇪🇸', Italy: '🇮🇹', Netherlands: '🇳🇱',
  Japan: '🇯🇵', 'Hong Kong': '🇭🇰', China: '🇨🇳', India: '🇮🇳',
  'South Korea': '🇰🇷', Singapore: '🇸🇬', Taiwan: '🇹🇼',
  Thailand: '🇹🇭', Australia: '🇦🇺',
};

// ──── Exchange color map ─────────────────────────────────────
const EXCHANGE_COLORS: Record<string, string> = {
  LSE: '#00A86B', Xetra: '#0052CC', Euronext: '#8B5CF6',
  SIX: '#FF6B00', BMEX: '#FFC107', MTA: '#E74C3C',
  TSE: '#E6007A', HKEX: '#FF5252', NYSE: '#3B82F6',
  NASDAQ: '#00E676', NSE: '#FF9933', KRX: '#6C63FF',
  SGX: '#06B6D4', TWSE: '#00BCD4', SET: '#8BC34A', ASX: '#FF6B35',
};

// ──── Mini Chart ─────────────────────────────────────────────
function MiniPriceChart({ isPositive }: { isPositive: boolean }) {
  const points = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 20; i++) {
      pts.push({
        x: (i / 19) * CHART_WIDTH,
        y: CHART_HEIGHT / 2 + (Math.random() - 0.5 + (isPositive ? 0.08 : -0.08)) * CHART_HEIGHT / 2,
      });
    }
    return pts;
  }, [isPositive]);

  const color = isPositive ? '#00E676' : '#FF5252';

  return (
    <View style={{ width: CHART_WIDTH, height: CHART_HEIGHT, position: 'relative' }}>
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: CHART_HEIGHT / 2,
        backgroundColor: color + '08', borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
      }} />
      {points.map((p, i) => (
        <View key={i} style={{
          position: 'absolute', left: p.x - 2, top: p.y - 2,
          width: 4, height: 4, borderRadius: 2, backgroundColor: color,
          opacity: i === points.length - 1 ? 1 : 0.4,
        }} />
      ))}
    </View>
  );
}

// ──── Stat Row ───────────────────────────────────────────────
function StatRow({ label, value, highlightColor }: { label: string; value: string; highlightColor?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statRow, { borderBottomColor: colors.divider }]}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: highlightColor || colors.text }]}>{value}</Text>
    </View>
  );
}

// ──── Currency format helper ──────────────────────────────────
function formatPrice(stock: InternationalStock): string {
  const prefix = stock.currency === 'JPY' ? '¥' :
    stock.currency === 'GBP' ? '£' :
    stock.currency === 'EUR' ? '€' :
    stock.currency === 'CHF' ? 'CHF ' :
    stock.currency === 'HKD' ? 'HK$' :
    stock.currency === 'CNY' ? '¥' :
    stock.currency === 'AUD' ? 'A$' :
    stock.currency === 'KRW' ? '₩' :
    stock.currency === 'SGD' ? 'S$' :
    stock.currency === 'TWD' ? 'NT$' :
    stock.currency === 'THB' ? '฿' : '$';
  return `${prefix}${stock.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCurrencyPrefix(currency: string): string {
  const map: Record<string, string> = { JPY: '¥', GBP: '£', EUR: '€', CHF: 'CHF ',
    HKD: 'HK$', CNY: '¥', AUD: 'A$', KRW: '₩', SGD: 'S$', TWD: 'NT$', THB: '฿' };
  return map[currency] || '$';
}

// ──── Helper: merge API GlobalStockData into InternationalStock mock ───
function mergeApiToStock(stock: InternationalStock, api: { price: number; change: number; changePercent: number; isPositive: boolean; volume?: string; high52?: number; low52?: number }): InternationalStock {
  return {
    ...stock,
    price: api.price,
    change: api.change,
    changePercent: api.changePercent,
    isPositive: api.isPositive,
    volume: api.volume ?? stock.volume,
    high52: api.high52 ?? stock.high52,
    low52: api.low52 ?? stock.low52,
  };
}

// ──── Main Screen ────────────────────────────────────────────
export default function GlobalStockDetailScreen({ route, navigation }: any) {
  const { stockId, symbol, region } = route.params || {};
  const { colors } = useTheme();

  // ── Live vs mock state ─────────────────────────────────────
  const allGlobalStocks = useMemo(() => [...mockEuropeanStocks, ...mockAsianStocks], []);
  const mockStock = allGlobalStocks.find(
    s => s.id === stockId || s.symbol === symbol,
  ) || allGlobalStocks[0];

  const [stock, setStock] = useState<InternationalStock>(mockStock);
  const [detailLoading, setDetailLoading] = useState(true);
  const [usingLiveData, setUsingLiveData] = useState(false);

  // Fetch live quote from backend on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiStock = await globalMarketsApi.getGlobalQuote(mockStock.symbol);
        if (!cancelled && apiStock) {
          setStock(mergeApiToStock(mockStock, apiStock));
          setUsingLiveData(true);
        }
      } catch {
        // API failed — keep mock data (already set)
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mockStock.symbol]);

  const relatedStocks = allGlobalStocks.filter(
    s => s.sector === stock.sector && s.id !== stock.id,
  ).slice(0, 4);

  if (detailLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading {mockStock.symbol}...</Text>
        </View>
      </View>
    );
  }

  const isPositive = stock.isPositive;
  const exchangeColor = EXCHANGE_COLORS[stock.exchange] || '#3B82F6';
  const countryFlag = COUNTRY_FLAGS[stock.country] || '🌍';
  const regionLabel = stock.region === 'europe' ? 'European' : 'Asia-Pacific';

  // Format numbers
  const formattedMarketCap = stock.marketCap;
  const fmtPrice = formatPrice(stock);
  const currencySymbol = formatCurrencyPrefix(stock.currency);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <Animated.View entering={FadeInRight.duration(300)} style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerTags}>
            <View style={[styles.exchangeBadge, { backgroundColor: exchangeColor + '20' }]}>
              <Text style={[styles.exchangeText, { color: exchangeColor }]}>{stock.exchange}</Text>
            </View>
            {usingLiveData && (
              <View style={[styles.liveBadge, { backgroundColor: '#00E67620', borderColor: '#00E67640' }]}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>Live</Text>
              </View>
            )}
            <View style={[styles.regionBadge, {
              backgroundColor: stock.region === 'europe' ? '#0052CC20' : '#FFC10720',
            }]}>
              <Text style={styles.regionFlag}>{countryFlag}</Text>
              <Text style={[styles.regionText, {
                color: stock.region === 'europe' ? '#0052CC' : '#FFC107',
              }]}>{regionLabel}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Stock Info */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.stockInfoSection}>
          <Text style={[styles.symbol, { color: colors.text }]}>{stock.symbol}</Text>
          <Text style={[styles.name, { color: colors.textSecondary }]}>{stock.name}</Text>
          <View style={[styles.countryChip, { backgroundColor: exchangeColor + '15' }]}>
            <Text style={styles.countryFlagEmoji}>{countryFlag}</Text>
            <Text style={[styles.countryText, { color: exchangeColor }]}>{stock.country}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.text }]}>{fmtPrice}</Text>
            <View style={[styles.changeBadge, { backgroundColor: (isPositive ? colors.marketUp : colors.marketDown) + '20' }]}>
              <Ionicons name={isPositive ? 'caret-up' : 'caret-down'} size={16} color={isPositive ? colors.marketUp : colors.marketDown} />
              <Text style={[styles.changeText, { color: isPositive ? colors.marketUp : colors.marketDown }]}>
                {isPositive ? '+' : ''}{stock.change.toFixed(2)} ({isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%)
              </Text>
            </View>
          </View>

          {/* Mini Chart */}
          <View style={[styles.chartContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <MiniPriceChart isPositive={isPositive} />
            <View style={styles.chartTimeframes}>
              {['1D', '1W', '1M', '3M', '1Y', 'Max'].map(tf => (
                <Text key={tf} style={[styles.chartTf, { color: tf === '1Y' ? colors.primary : colors.textMuted }]}>{tf}</Text>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Key Stats */}
        <Animated.View entering={FadeInUp.duration(500)} style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Key Statistics</Text>
          <StatRow label="Market Cap" value={formattedMarketCap} />
          <StatRow label="P/E Ratio" value={stock.pe.toFixed(1)} />
          <StatRow label="P/B Ratio" value={stock.pb.toFixed(1)} />
          <StatRow label="Dividend Yield" value={stock.dividend > 0 ? `${stock.dividend.toFixed(2)}%` : 'N/A'} />
          <StatRow label="Volume" value={stock.volume} />
          <StatRow label="Exchange" value={stock.exchange} highlightColor={exchangeColor} />
          <StatRow label={`52-Week High (${currencySymbol})`} value={stock.high52.toLocaleString('en-US')} highlightColor={colors.marketUp} />
          <StatRow label={`52-Week Low (${currencySymbol})`} value={stock.low52.toLocaleString('en-US')} highlightColor={colors.marketDown} />
        </Animated.View>

        {/* About Company */}
        <Animated.View entering={FadeInUp.duration(600)} style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About {stock.symbol}</Text>
          <Text style={[styles.aboutText, { color: colors.textSecondary }]}>
            {stock.name} is a {stock.sector.toLowerCase()} company headquartered in {stock.country} and listed on the {stock.exchange} exchange. 
            With a market capitalization of {formattedMarketCap}, the company is one of the most actively traded stocks on the {stock.exchange}. 
            {'\n\n'}The stock trades in {stock.currency} (Min lot size varies by exchange). P/E ratio stands at {stock.pe.toFixed(1)} with a dividend yield of {stock.dividend > 0 ? `${stock.dividend.toFixed(2)}%.` : 'N/A.'}
            {'\n\n'}The 52-week trading range is between {currencySymbol}{stock.low52.toLocaleString('en-US')} (low) and {currencySymbol}{stock.high52.toLocaleString('en-US')} (high), with an average daily volume of {stock.volume} shares across the {stock.exchange} order book.
          </Text>
        </Animated.View>

        {/* Related Stocks */}
        {relatedStocks.length > 0 && (
          <Animated.View entering={FadeInUp.duration(700)} style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Related {stock.sector} Stocks</Text>
            {relatedStocks.map(s => (
              <Pressable
                key={s.id}
                onPress={() => navigation.replace('GlobalStockDetail', {
                  stockId: s.id, symbol: s.symbol, region: s.region,
                })}
              >
                <View style={[styles.relatedRow, { borderBottomColor: colors.divider }]}>
                  <View style={styles.relatedLeft}>
                    <Text style={[styles.relatedFlag, { fontSize: 14 }]}>{COUNTRY_FLAGS[s.country] || '🌍'}</Text>
                    <View>
                      <Text style={[styles.relatedSymbol, { color: colors.text }]}>{s.symbol}</Text>
                      <Text style={[styles.relatedName, { color: colors.textMuted }]}>{s.name}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.relatedPrice, { color: colors.text }]}>
                      {formatPrice(s)}
                    </Text>
                    <Text style={[styles.relatedChange, { color: s.isPositive ? colors.marketUp : colors.marketDown }]}>
                      {s.isPositive ? '+' : ''}{s.changePercent.toFixed(2)}%
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </Animated.View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ──── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 20 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, marginBottom: SPACING.lg,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  headerTags: { flexDirection: 'row', gap: SPACING.sm },
  exchangeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full,
  },
  exchangeText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  regionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full,
  },
  regionFlag: { fontSize: 12 },
  regionText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  stockInfoSection: { marginBottom: SPACING.lg },
  symbol: { ...FONTS.extraBold, fontSize: FONTS.size.hero },
  name: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4 },
  countryChip: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  countryFlagEmoji: { fontSize: 12 },
  countryText: { ...FONTS.medium, fontSize: FONTS.size.xs },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.md },
  price: { ...FONTS.black, fontSize: FONTS.size.xxxl },
  changeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.full,
  },
  changeText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

  chartContainer: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
    marginTop: SPACING.lg, alignItems: 'center',
  },
  chartTimeframes: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  chartTf: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  section: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.lg,
  },
  sectionTitle: { ...FONTS.bold, fontSize: FONTS.size.md, marginBottom: SPACING.md },

  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statLabel: { ...FONTS.regular, fontSize: FONTS.size.sm },
  statValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

  aboutText: { ...FONTS.regular, fontSize: FONTS.size.sm, lineHeight: 20 },
  loadingText: { ...FONTS.medium, fontSize: FONTS.size.sm, marginTop: SPACING.md },

  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#00E676',
  },
  liveBadgeText: {
    ...FONTS.semiBold, fontSize: 9, color: '#00E676',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  relatedRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  relatedLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  relatedFlag: {},
  relatedSymbol: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  relatedName: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  relatedPrice: { ...FONTS.mono, fontSize: FONTS.size.sm, fontWeight: '600' },
  relatedChange: { ...FONTS.semiBold, fontSize: FONTS.size.xs, marginTop: 1 },
});
