/**
 * ============================================================================
 * Toroloom — US Stock Detail Screen
 * ============================================================================
 *
 * Displays detailed information about a US stock including:
 *   - Price & change with exchange badge (NASDAQ / NYSE)
 *   - Key fundamentals (Market Cap, P/E, Dividend, 52W Range)
 *   - About company section
 *   - Price trend chart (simplified)
 *   - Related stocks from same sector
 *
 * Navigation: USMarketsScreen → USStockDetail
 * ============================================================================
 */

import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import Animated, { FadeInRight, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { useT } from '../../hooks/useT';
import { globalMarketsApi } from '../../services/api/globalMarkets';
import { mockUSStocks, mockUSETFs } from '../../constants/mockData';
import TradingViewChart from '../../components/TradingViewChart';
import PositionLevelsOverlay from '../../components/PositionLevelsOverlay';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { toTradingViewSymbol } from '../../utils/tradingView';
import { openExitOrder } from '../../utils/orderExit';
import { tickerProvider } from '../../services/tickerProvider';
import type {USStock, RootStackParamList} from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// ──── Helper: merge API quote into USStock mock ─────────────────
function mergeApiToStock(stock: USStock, api: { price: number; change: number; changePercent: number; isPositive: boolean; volume?: string; high52?: number; low52?: number }): USStock {
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

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - SPACING.xl * 2 - SPACING.lg * 2;
const CHART_HEIGHT = 160;

// ──── Mini Chart ───────────────────────────────────────────────────────────

function MiniPriceChart({ isPositive }: { isPositive: boolean }) {
  // Generate a simple vector-based mini chart using SVG-like views
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
      {/* Gradient fill */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: CHART_HEIGHT / 2,
        backgroundColor: color + '08',
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
      }} />
      {/* Line dots */}
      {points.map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: p.x - 2,
            top: p.y - 2,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: color,
            opacity: i === points.length - 1 ? 1 : 0.4,
          }}
        />
      ))}
    </View>
  );
}

// ──── Stat Row ─────────────────────────────────────────────────────────────

function StatRow({ label, value, highlightColor }: { label: string; value: string; highlightColor?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statRow, { borderBottomColor: colors.divider }]}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: highlightColor || colors.text }]}>{value}</Text>
    </View>
  );
}

// ──── Main Screen ──────────────────────────────────────────────────────────

export default function USStockDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'USStockDetail'>) {
  const { stockId, symbol } = route.params || {};
  const { colors } = useTheme();
  const { t } = useT();

  // Find mock stock first (fallback and structural data)
  const mockStock = mockUSStocks.find(s => s.id === stockId || s.symbol === symbol) || mockUSStocks[0];

  const [stock, setStock] = useState<USStock>(mockStock);
  const [detailLoading, setDetailLoading] = useState(true);
  const [usingLiveData, setUsingLiveData] = useState(false);
  const [chartFailed, setChartFailed] = useState(false);

  // TradingView symbol for the live chart (e.g. NASDAQ:AAPL)
  const tvSymbol = useMemo(
    () => toTradingViewSymbol(stock.symbol, stock.exchange),
    [stock.symbol, stock.exchange],
  );

  // ── Hybrid: keep the Ticker Provider in sync with the viewed stock ──
  // So opening the SnapTrade order panel pre-selects THIS symbol (chart,
  // symbol field, and execution-price feed all follow the provider).
  useEffect(() => {
    if (!stock?.symbol) return;
    tickerProvider.selectSymbol({
      symbol: stock.symbol,
      exchange: stock.exchange,
      name: stock.name,
      price: stock.price,
    });
  }, [stock.symbol, stock.exchange, stock.name, stock.price]);

  // Fetch live quote from backend on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiStock = await globalMarketsApi.getQuote(mockStock.symbol);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockStock.symbol]);

  const relatedETFs = mockUSETFs.filter(
    e => e.category.toLowerCase().includes(stock.sector.toLowerCase()) ||
         e.name.toLowerCase().includes(stock.sector.toLowerCase()),
  ).slice(0, 3);

  // ── Shared exit wiring: pre-select the provider, then open the SnapTrade
  // order panel pre-filled with the risk-derived stop / target level. ──
  const openExit = (kind: 'SL' | 'LIMIT', exitPrice: number) =>
    openExitOrder(
      navigation,
      {
        symbol: stock.symbol,
        exchange: stock.exchange,
        name: stock.name,
        price: stock.price,
        stockId: stock.id,
      },
      kind,
      exitPrice,
      { route: 'SnapTradeOrder' },
    );

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
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('stockDetail.loading')}</Text>
        </View>
      </View>
    );
  }

  const isPositive = stock.isPositive;
  const exchangeColor = stock.exchange === 'NASDAQ' ? '#00E676' : stock.exchange === 'NYSE Arca' ? '#8B5CF6' : '#3B82F6';
  const formattedMarketCap = stock.marketCap;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <Animated.View entering={FadeInRight.duration(300)} style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerTags}>
            {usingLiveData && (
              <View style={[styles.liveBadge, { backgroundColor: '#00E67620', borderColor: '#00E67640' }]}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>{t('stockDetail.live')}</Text>
              </View>
            )}
            <View style={[styles.exchangeBadge, { backgroundColor: exchangeColor + '20' }]}>
              <Ionicons name={stock.exchange === 'NASDAQ' ? 'pulse' : 'business'} size={12} color={exchangeColor} />
              <Text style={[styles.exchangeText, { color: exchangeColor }]}>{stock.exchange}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Stock Info */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.stockInfoSection}>
          <Text style={[styles.symbol, { color: colors.text }]}>{stock.symbol}</Text>
          <Text style={[styles.name, { color: colors.textSecondary }]}>{stock.name}</Text>

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.text }]}>
              ${stock.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <View style={[styles.changeBadge, { backgroundColor: (isPositive ? colors.marketUp : colors.marketDown) + '20' }]}>
              <Ionicons name={isPositive ? 'caret-up' : 'caret-down'} size={16} color={isPositive ? colors.marketUp : colors.marketDown} />
              <Text style={[styles.changeText, { color: isPositive ? colors.marketUp : colors.marketDown }]}>
                {isPositive ? '+' : ''}{stock.change.toFixed(2)} ({isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%)
              </Text>
            </View>
          </View>

          {/* Live Chart — TradingView widget with real market data, overlaid
              with the live-position tag (avg buy / stop / target) that follows
              the Ticker Provider's active symbol. */}
          <View style={[styles.chartContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {chartFailed ? (
              <MiniPriceChart isPositive={isPositive} />
            ) : (
              <View style={styles.chartWrap}>
                <TradingViewChart
                  symbol={tvSymbol}
                  height={CHART_HEIGHT}
                  onError={() => setChartFailed(true)}
                />
                <PositionLevelsOverlay
                  // No symbol prop — follows the Ticker Provider's active ticker.
                  onApplyStop={(p) => openExit('SL', p)}
                  onApplyTarget={(p) => openExit('LIMIT', p)}
                />
              </View>
            )}
          </View>

          {/* Trade CTA — opens the SnapTrade order panel pre-selected to this symbol */}
          <AnimatedPressable
            onPress={() => navigation.navigate('SnapTradeOrder', {
              symbol: stock.symbol,
              name: stock.name,
              price: stock.price,
            })}
            haptic="medium"
            scaleTo={0.97}
            style={[styles.tradeBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="swap-horizontal" size={16} color="#fff" />
            <Text style={styles.tradeBtnText}>{t('snaptrade.trade')}</Text>
          </AnimatedPressable>
        </Animated.View>

        {/* Key Stats */}
        <Animated.View entering={FadeInUp.duration(500)} style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('stockDetail.statistics')}</Text>

          <StatRow label={t('stockDetail.marketCap')} value={formattedMarketCap} />
          <StatRow label={t('stockDetail.peRatio')} value={stock.pe.toFixed(1)} />
          <StatRow label={t('stockDetail.pbRatio')} value={stock.pb.toFixed(1)} />
          <StatRow label={t('stockDetail.dividendYield')} value={stock.dividend > 0 ? `${stock.dividend.toFixed(2)}%` : 'N/A'} />
          <StatRow label={t('stockDetail.volume')} value={stock.volume} />
          <StatRow label={t('stockDetail.week52High')} value={`$${stock.high52.toLocaleString('en-US')}`} highlightColor={colors.marketUp} />
          <StatRow label={t('stockDetail.week52Low')} value={`$${stock.low52.toLocaleString('en-US')}`} highlightColor={colors.marketDown} />
        </Animated.View>

        {/* About Company */}
        <Animated.View entering={FadeInUp.duration(600)} style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('stockDetail.about')} {stock.symbol}</Text>
          <Text style={[styles.aboutText, { color: colors.textSecondary }]}>
            {stock.name} is a {stock.sector.toLowerCase()} company listed on the {stock.exchange} exchange{stock.exchange === 'NYSE Arca' ? '' : ' Stock Exchange'}. 
            With a market capitalization of {formattedMarketCap}, the company is one of the most actively traded 
            stocks in its sector. The stock has a P/E ratio of {stock.pe.toFixed(1)} and 
            {' '}{stock.dividend > 0 ? `offers a dividend yield of ${stock.dividend.toFixed(2)}%.` : 'does not currently pay a dividend.'}
            {'\n\n'}The 52-week trading range is between ${stock.low52.toLocaleString('en-US')} (low) and 
            ${stock.high52.toLocaleString('en-US')} (high), with an average daily volume of {t('app.shares', { count: stock.volume })}.
          </Text>
        </Animated.View>

        {/* Related ETFs */}
        {relatedETFs.length > 0 && (
          <Animated.View entering={FadeInUp.duration(700)} style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('stockDetail.relatedEtfs')}</Text>
            {relatedETFs.map(etf => (
              <View key={etf.id} style={[styles.relatedRow, { borderBottomColor: colors.divider }]}>
                <View>
                  <Text style={[styles.relatedSymbol, { color: colors.text }]}>{etf.symbol}</Text>
                  <Text style={[styles.relatedName, { color: colors.textMuted }]}>{etf.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.relatedPrice, { color: colors.text }]}>
                    ${etf.price.toFixed(2)}
                  </Text>
                  <Text style={[styles.relatedChange, { color: etf.isPositive ? colors.marketUp : colors.marketDown }]}>
                    {etf.isPositive ? '+' : ''}{etf.changePercent.toFixed(2)}%
                  </Text>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: SPACING.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTags: {
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'center',
  },
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

  exchangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  exchangeText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // ── Stock Info ──
  stockInfoSection: {
    marginBottom: SPACING.lg,
  },
  symbol: { ...FONTS.extraBold, fontSize: FONTS.size.hero },
  name: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  price: { ...FONTS.black, fontSize: FONTS.size.xxxl },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  changeText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

  // ── Chart ──
  chartContainer: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  chartWrap: {
    position: 'relative',
    alignSelf: 'stretch',
  },

  // ── Trade CTA ──
  tradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  tradeBtnText: { ...FONTS.bold, fontSize: FONTS.size.md, color: '#fff' },

  // ── Stats ──
  section: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  sectionTitle: { ...FONTS.bold, fontSize: FONTS.size.md, marginBottom: SPACING.md },

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statLabel: { ...FONTS.regular, fontSize: FONTS.size.sm },
  statValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

  loadingText: { ...FONTS.medium, fontSize: FONTS.size.sm, marginTop: SPACING.md },

  // ── About ──
  aboutText: { ...FONTS.regular, fontSize: FONTS.size.sm, lineHeight: 20 },

  // ── Related ETFs ──
  relatedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  relatedSymbol: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  relatedName: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  relatedPrice: { ...FONTS.mono, fontSize: FONTS.size.sm, fontWeight: '600' },
  relatedChange: { ...FONTS.semiBold, fontSize: FONTS.size.xs, marginTop: 1 },
});
