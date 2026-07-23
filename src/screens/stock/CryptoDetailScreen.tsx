/**
 * ============================================================================
 * Toroloom — Crypto Detail Screen
 * ============================================================================
 *
 * Displays detailed information about a cryptocurrency including:
 *   - Price & 24h change with animated number display
 *   - Multi-timeframe price chart (1H, 24H, 7D, 30D, 1Y)
 *   - Key stats (Market Cap, Volume, Supply, ATH)
 *   - Price change matrix (1h, 24h, 7d, 30d, 1y)
 *   - About / Description section
 *   - Related cryptocurrencies
 *   - Buy / Sell action buttons
 *
 * Navigation: USMarketsScreen → CryptoDetail
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Dimensions,
  Platform, Linking, RefreshControl, ActivityIndicator,
} from 'react-native';
import Animated, { FadeInRight, FadeInUp, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { globalMarketsApi } from '../../services/api/globalMarkets';
import type { CryptoDetailData } from '../../services/api/globalMarkets';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - SPACING.xl * 2 - SPACING.lg * 2;
const CHART_HEIGHT = 200;

// ─── Timeframe selector ─────────────────────────────────────────────────

type TimeFrame = '1h' | '24h' | '7d' | '30d' | '1y';
const TIMEFRAMES: TimeFrame[] = ['1h', '24h', '7d', '30d', '1y'];

// ─── Price Chart ────────────────────────────────────────────────────────

function CryptoPriceChart({
  history,
  color,
  isPositive,
}: {
  history: { timestamp: number; price: number }[];
  color: string;
  isPositive: boolean;
}) {
  const chartColor = isPositive ? '#00E676' : '#FF5252';

  const points = useMemo(() => {
    if (!history || history.length < 2) return [];
    const prices = history.map(h => h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    return history.map((h, i) => ({
      x: (i / (history.length - 1)) * CHART_WIDTH,
      y: CHART_HEIGHT - ((h.price - min) / range) * (CHART_HEIGHT - 20) - 10,
    }));
  }, [history]);

  if (points.length < 2) {
    return (
      <View style={{ width: CHART_WIDTH, height: CHART_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" color={color} />
      </View>
    );
  }

  return (
    <View style={{ width: CHART_WIDTH, height: CHART_HEIGHT, position: 'relative' }}>
      {/* Gradient fill area */}
      <View style={[styles.chartFill, {
        backgroundColor: chartColor + '08',
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
        height: CHART_HEIGHT / 2,
      }]} />

      {/* Line dots */}
      {points.map((p, i) => (
        <View
          key={i}
          style={[styles.chartDot, {
            left: p.x - 2,
            top: p.y - 2,
            backgroundColor: chartColor,
            opacity: i === points.length - 1 ? 1 : 0.3,
          }]}
        />
      ))}

      {/* Latest price marker */}
      {points.length > 0 && (
        <View style={[styles.chartLatestMarker, {
          left: points[points.length - 1].x - 8,
          top: points[points.length - 1].y - 8,
          borderColor: chartColor,
        }]} />
      )}
    </View>
  );
}

// ─── Stat Row ───────────────────────────────────────────────────────────

function CryptoStatRow({
  label,
  value,
  highlightColor,
  isMono,
}: {
  label: string;
  value: string;
  highlightColor?: string;
  isMono?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statRow, { borderBottomColor: colors.divider }]}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[
        styles.statValue,
        { color: highlightColor || colors.text },
        isMono && styles.monoText,
      ]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Change Pill ────────────────────────────────────────────────────────

function ChangePill({ value, label }: { value: number | null; label: string }) {
  const { colors } = useTheme();
  if (value === null || value === undefined) return null;
  const isPos = value >= 0;
  return (
    <View style={[styles.changePill, { backgroundColor: (isPos ? colors.marketUp : colors.marketDown) + '15' }]}>
      <Ionicons
        name={isPos ? 'caret-up' : 'caret-down'}
        size={12}
        color={isPos ? colors.marketUp : colors.marketDown}
      />
      <Text style={[styles.changePillLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.changePillValue, { color: isPos ? colors.marketUp : colors.marketDown }]}>
        {isPos ? '+' : ''}{value.toFixed(2)}%
      </Text>
    </View>
  );
}

// ─── Formatting helpers ─────────────────────────────────────────────────

function formatPrice(price: number): string {
  if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

function formatLargeNumber(num: number): string {
  if (!num) return 'N/A';
  if (num >= 1e12) return '$' + (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return '$' + (num / 1e3).toFixed(1) + 'K';
  return '$' + num.toFixed(2);
}

function formatSupply(num: number | null | undefined): string {
  if (!num) return 'N/A';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toLocaleString();
}

// ─── Main Screen ────────────────────────────────────────────────────────

export default function CryptoDetailScreen({ route, navigation }: any) {
  const { coinId, coinSymbol, coinName } = route.params || {};
  const { colors } = useTheme();
  const nav = navigation || useNavigation<any>();

  const [data, setData] = useState<CryptoDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeFrame>('7d');
  const [chartHistory, setChartHistory] = useState<{ timestamp: number; price: number }[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    setError(null);

    try {
      const detail = await globalMarketsApi.getCryptoDetail(coinId || coinSymbol?.toLowerCase() || 'bitcoin');
      setData(detail);
      setChartHistory(detail.priceHistory || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load crypto data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [coinId, coinSymbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData(false);
  }, [fetchData]);

  const isPositive = data ? data.changePercent >= 0 : true;

  // Filter chart history by timeframe
  useEffect(() => {
    if (!data?.priceHistory) return;
    const now = Date.now();
    const timeframes: Record<TimeFrame, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
    };
    const cutoff = now - timeframes[selectedTimeframe];
    const filtered = data.priceHistory.filter(h => h.timestamp >= cutoff);
    setChartHistory(filtered.length > 0 ? filtered : data.priceHistory);
  }, [selectedTimeframe, data?.priceHistory]);

  // Loading state
  if (isLoading && !data) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <Pressable onPress={() => nav.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading {coinName || coinSymbol || 'crypto'} data...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <Pressable onPress={() => nav.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl }}>
          <Ionicons name="warning" size={48} color="#FFAB40" />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <Pressable
            onPress={() => fetchData()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!data) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.bgSecondary}
          />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInRight.duration(300)} style={styles.header}>
          <Pressable onPress={() => nav.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          {data.homepage ? (
            <Pressable
              onPress={() => Linking.openURL(data.homepage)}
              style={[styles.websiteBtn, { backgroundColor: data.color + '20' }]}
            >
              <Ionicons name="globe" size={14} color={data.color} />
              <Text style={[styles.websiteText, { color: data.color }]}>Website</Text>
            </Pressable>
          ) : null}
        </Animated.View>

        {/* Price Section */}
        <Animated.View entering={FadeInUp.duration(400)} style={styles.priceSection}>
          <View style={styles.coinNameRow}>
            <View style={[styles.cryptoAvatar, { backgroundColor: data.color + '20' }]}>
              <Text style={[styles.cryptoAvatarText, { color: data.color }]}>
                {data.symbol.charAt(0)}
              </Text>
            </View>
            <View>
              <Text style={[styles.coinName, { color: colors.text }]}>{data.name}</Text>
              <Text style={[styles.coinSymbol, { color: colors.textMuted }]}>{data.symbol}</Text>
            </View>
            <View style={[styles.coinRankBadge, { backgroundColor: data.color + '15' }]}>
              <Text style={[styles.coinRankText, { color: data.color }]}>#{data.marketCap > 0 ? 'Top' : '—'}</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.text }]}>
              ${formatPrice(data.price)}
            </Text>
            <View style={[styles.changeBadge, { backgroundColor: (isPositive ? colors.marketUp : colors.marketDown) + '20' }]}>
              <Ionicons name={isPositive ? 'caret-up' : 'caret-down'} size={16} color={isPositive ? colors.marketUp : colors.marketDown} />
              <Text style={[styles.changeText, { color: isPositive ? colors.marketUp : colors.marketDown }]}>
                {isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%
              </Text>
            </View>
          </View>

          <Text style={[styles.priceSub, { color: colors.textMuted }]}>
            {isPositive ? '+' : ''}${Math.abs(data.change).toFixed(2)} Today
          </Text>
        </Animated.View>

        {/* Price Chart */}
        <Animated.View entering={FadeInUp.duration(500)} style={[styles.chartContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <CryptoPriceChart
            history={chartHistory}
            color={data.color}
            isPositive={isPositive}
          />
          <View style={styles.chartTimeframes}>
            {TIMEFRAMES.map(tf => (
              <Pressable
                key={tf}
                onPress={() => setSelectedTimeframe(tf)}
                style={[
                  styles.chartTfBtn,
                  {
                    backgroundColor: selectedTimeframe === tf ? data.color + '20' : 'transparent',
                    borderColor: selectedTimeframe === tf ? data.color + '40' : 'transparent',
                  },
                ]}
              >
                <Text style={[
                  styles.chartTfText,
                  { color: selectedTimeframe === tf ? data.color : colors.textMuted },
                ]}>
                  {tf}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Change Matrix */}
        <Animated.View entering={FadeInUp.duration(550)} style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Price Change</Text>
          <View style={styles.changeGrid}>
            <ChangePill value={data.change1h} label="1H" />
            <ChangePill value={data.changePercent} label="24H" />
            <ChangePill value={data.change7d} label="7D" />
            <ChangePill value={data.change30d} label="30D" />
            <ChangePill value={data.change1y} label="1Y" />
          </View>
        </Animated.View>

        {/* Key Stats */}
        <Animated.View entering={FadeInUp.duration(600)} style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Key Statistics</Text>

          <CryptoStatRow label="Market Cap" value={formatLargeNumber(data.marketCap)} />
          <CryptoStatRow label="24h Volume" value={formatLargeNumber(data.volume24h)} />
          <CryptoStatRow label="24h High" value={`$${formatPrice(data.high24h)}`} highlightColor={colors.marketUp} />
          <CryptoStatRow label="24h Low" value={`$${formatPrice(data.low24h)}`} highlightColor={colors.marketDown} />
          <CryptoStatRow
            label="Circulating Supply"
            value={formatSupply(data.circulatingSupply) + (data.symbol ? ' ' + data.symbol : '')}
            isMono
          />
          {data.totalSupply && (
            <CryptoStatRow
              label="Total Supply"
              value={formatSupply(data.totalSupply) + (data.symbol ? ' ' + data.symbol : '')}
              isMono
            />
          )}
          {data.maxSupply && (
            <CryptoStatRow
              label="Max Supply"
              value={formatSupply(data.maxSupply) + (data.symbol ? ' ' + data.symbol : '')}
              isMono
            />
          )}
          <CryptoStatRow
            label="All-Time High"
            value={`$${formatPrice(data.ath)} (${data.athDate ? new Date(data.athDate).toLocaleDateString() : '—'})`}
            highlightColor={colors.marketUp}
          />
        </Animated.View>

        {/* About */}
        {data.description && (
          <Animated.View entering={FadeInUp.duration(650)} style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>About {data.name}</Text>
            <Text style={[styles.aboutText, { color: colors.textSecondary }]} numberOfLines={8}>
              {data.description.replace(/<[^>]*>/g, '')}
            </Text>
            {data.description.length > 500 && (
              <Pressable onPress={() => data.homepage && Linking.openURL(data.homepage)}>
                <Text style={[styles.readMore, { color: data.color }]}>Read more on website →</Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* Action Buttons */}
        <Animated.View entering={FadeInUp.duration(700)} style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.marketUp }]}>
            <Ionicons name="cart" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Buy {data.symbol}</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: colors.marketDown }]}>
            <Ionicons name="arrow-down" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Sell {data.symbol}</Text>
          </Pressable>
        </Animated.View>

        {/* Disclaimer */}
        <View style={[styles.disclaimerCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="warning" size={16} color="#FFAB40" />
          <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
            Cryptocurrency prices are volatile. Data is provided for informational purposes only.
            Past performance does not guarantee future results. DYOR.
          </Text>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

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
  websiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  websiteText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // ── Price Section ──
  priceSection: { marginBottom: SPACING.lg },
  coinNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  cryptoAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cryptoAvatarText: { ...FONTS.bold, fontSize: 20 },
  coinName: { ...FONTS.bold, fontSize: FONTS.size.lg },
  coinSymbol: { ...FONTS.medium, fontSize: FONTS.size.xs, textTransform: 'uppercase', marginTop: 1 },
  coinRankBadge: {
    marginLeft: 'auto',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  coinRankText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  price: { ...FONTS.black, fontSize: FONTS.size.hero },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  changeText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  priceSub: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4 },

  // ── Chart ──
  chartContainer: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  chartFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  chartDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  chartLatestMarker: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  chartTimeframes: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  chartTfBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  chartTfText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // ── Change Grid ──
  section: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  sectionTitle: { ...FONTS.bold, fontSize: FONTS.size.md, marginBottom: SPACING.md },
  changeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  changePillLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  changePillValue: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // ── Stats ──
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statLabel: { ...FONTS.regular, fontSize: FONTS.size.sm },
  statValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm, flexShrink: 1, textAlign: 'right', maxWidth: '55%' },
  monoText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: FONTS.size.xs },

  // ── About ──
  aboutText: { ...FONTS.regular, fontSize: FONTS.size.sm, lineHeight: 20 },
  readMore: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginTop: SPACING.sm },

  // ── Actions ──
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  actionBtnText: { color: '#fff', ...FONTS.bold, fontSize: FONTS.size.md },

  // ── Disclaimer ──
  disclaimerCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  disclaimerText: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 16, flex: 1 },

  // ── Loading / Error ──
  loadingText: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: SPACING.md },
  errorText: { ...FONTS.regular, fontSize: FONTS.size.sm, textAlign: 'center', marginTop: SPACING.md },
  retryBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.lg,
  },
  retryBtnText: { color: '#fff', ...FONTS.semiBold, fontSize: FONTS.size.sm },
});
