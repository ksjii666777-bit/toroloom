import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMarketStore } from '../../store/marketStore';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useAIStore } from '../../store/aiStore';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency, formatCompactNumber, hexToRgba } from '../../utils/formatters';
import CandlestickChart from '../../components/CandlestickChart';
import TechnicalIndicators from '../../components/TechnicalIndicators';
import type { IndicatorType } from '../../components/TechnicalIndicators';
import { ChartCrosshairContext } from '../../components/ChartCrosshairContext';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useRealtimePrice } from '../../hooks/useRealtimePrice';

const { width } = Dimensions.get('window');

const TIMEFRAMES = ['1D', '1W', '1M', '3M', '1Y', 'Max'];

// Parse a market cap string like "₹19,56,000 Cr" into a compact value
function formatCompactMarketCap(marketCap: string): string {
  const cleaned = marketCap.replace(/[₹,\s]/g, '');
  if (cleaned.includes('Cr')) {
    const num = parseFloat(cleaned);
    if (num >= 100000) return `${(num / 100000).toFixed(1)}L Cr`;
    return `${num.toFixed(0)} Cr`;
  }
  if (cleaned.includes('L')) return cleaned;
  return marketCap;
}

export default function StockDetailScreen({ route, navigation }: any) {
  const { stockId } = route.params;
  const { colors } = useTheme();
  const { stocks } = useMarketStore();
  const { insights } = useAIStore();
  const { isInWatchlist, addToWatchlist, removeFromWatchlist, watchlists } = useWatchlistStore();

  const stock = stocks.find(s => s.id === stockId) || stocks[0];
  const [activeTimeframe, setActiveTimeframe] = useState('1M');
  const [showMA, setShowMA] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<IndicatorType[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // ── Sector Performance Data ───────────────────────────────
  const sectorData = useMemo(() => {
    const sectorStocks = stocks.filter(s => s.sector === stock.sector);
    if (sectorStocks.length === 0) return null;

    const avgChange = sectorStocks.reduce((sum, s) => sum + s.changePercent, 0) / sectorStocks.length;
    const best = [...sectorStocks].sort((a, b) => b.changePercent - a.changePercent)[0];
    const worst = [...sectorStocks].sort((a, b) => a.changePercent - b.changePercent)[0];

    // Compute sector ranking
    const allSectors = new Map<string, number>();
    for (const s of stocks) {
      allSectors.set(s.sector, (allSectors.get(s.sector) || 0) + s.changePercent);
    }
    const sectorAvg = Array.from(allSectors.entries()).map(([name, total]) => {
      const count = stocks.filter(s => s.sector === name).length;
      return { name, avgChange: total / count };
    }).sort((a, b) => b.avgChange - a.avgChange);

    const rank = sectorAvg.findIndex(s => s.name === stock.sector) + 1;
    const bestSector = sectorAvg[0];
    const worstSector = sectorAvg[sectorAvg.length - 1];

    return {
      stocks: sectorStocks,
      avgChange: Math.round(avgChange * 100) / 100,
      best,
      worst,
      rank,
      totalSectors: sectorAvg.length,
      bestSector,
      worstSector,
    };
  }, [stocks, stock.sector]);

  // Real-time price updates via mock WebSocket
  const {
    currentPrice,
    priceChange,
    priceChangePercent,
    candleHistory,
    isConnected,
    isPositive,
    loadHistory,
  } = useRealtimePrice(stockId, stock.price);

  // Use real-time price as seen price
  const displayPrice = currentPrice;
  const displayChange = priceChange;
  const displayChangePercent = priceChangePercent;

  const aiInsight = insights.find(i => i.stockId === stockId);
  const inWatchlist = isInWatchlist(stockId);

  // Handle timeframe change
  const handleTimeframeChange = useCallback((tf: string) => {
    setActiveTimeframe(tf);
    loadHistory(tf);
  }, [loadHistory]);

  const handleIndicatorToggle = useCallback((type: IndicatorType) => {
    setActiveIndicators(prev =>
      prev.includes(type) ? prev.filter(i => i !== type) : [...prev, type]
    );
  }, []);

  // Toggle watchlist (add/remove from first watchlist)
  const handleWatchlistToggle = useCallback(() => {
    const firstWatchlist = watchlists[0];
    if (!firstWatchlist) return;
    if (isInWatchlist(stockId)) {
      removeFromWatchlist(firstWatchlist.id, stockId, stock.symbol);
    } else {
      addToWatchlist(firstWatchlist.id, stock);
    }
  }, [watchlists, stockId, stock, isInWatchlist, addToWatchlist, removeFromWatchlist]);

  const handleOpenPlaceOrder = useCallback((type: 'buy' | 'sell') => {
    navigation.navigate('PlaceOrder', { stockId: stock.id, symbol: stock.symbol, tradeType: type });
  }, [navigation, stock]);

  const INTRADAY_CANDLE_COUNT = 390;

  // Compute day range from candle data
  const dayHigh = candleHistory.length > 0
    ? Math.max(...candleHistory.slice(-INTRADAY_CANDLE_COUNT).map(c => c.high))
    : stock.high52;
  const dayLow = candleHistory.length > 0
    ? Math.min(...candleHistory.slice(-INTRADAY_CANDLE_COUNT).map(c => c.low))
    : stock.low52;
  const volume = candleHistory.length > 0
    ? candleHistory[candleHistory.length - 1]?.volume
    : 0;

  const styles = useMemo(() => {
    return StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: colors.bg,
      },
      scrollContent: {
        paddingHorizontal: SPACING.xl,
        paddingBottom: 20,
      },
      header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 60,
        marginBottom: SPACING.md,
      },
      backBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.bgCard,
        justifyContent: 'center',
        alignItems: 'center',
      },
      watchlistBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: colors.bgCard,
        justifyContent: 'center',
        alignItems: 'center',
      },
      connectionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
      },
      connectionDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
      },
      connectionText: {
        ...FONTS.medium,
        fontSize: FONTS.size.xs,
      },
      stockInfo: {
        marginBottom: SPACING.lg,
      },
      stockHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      },
      symbol: {
        ...FONTS.extraBold,
        fontSize: FONTS.size.hero,
        color: colors.text,
      },
      name: {
        ...FONTS.regular,
        fontSize: FONTS.size.sm,
        color: colors.textSecondary,
        marginTop: 4,
      },
      priceSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        marginTop: SPACING.md,
      },
      price: {
        ...FONTS.black,
        fontSize: FONTS.size.display,
        color: colors.text,
      },
      changeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
        gap: 4,
      },
      changeText: {
        ...FONTS.semiBold,
        fontSize: FONTS.size.sm,
      },
      liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: SPACING.sm,
      },
      liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
      },
      liveText: {
        ...FONTS.regular,
        fontSize: FONTS.size.xs,
        color: colors.textMuted,
      },
      chartOptions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: SPACING.sm,
        marginBottom: SPACING.sm,
      },
      chartOptionBtn: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.bgCard,
      },
      chartOptionActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '15',
      },
      chartOptionText: {
        ...FONTS.medium,
        fontSize: FONTS.size.xs,
        color: colors.textSecondary,
      },
      chartOptionTextActive: {
        color: colors.primary,
      },
      statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginBottom: SPACING.lg,
      },
      statCard: {
        width: (width - 64 - 12) / 4,
        backgroundColor: colors.bgCard,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
      },
      statLabel: {
        ...FONTS.regular,
        fontSize: FONTS.size.xs,
        color: colors.textMuted,
        marginBottom: 4,
      },
      statValue: {
        ...FONTS.semiBold,
        fontSize: FONTS.size.sm,
        color: colors.text,
      },
      statValueHigh: {
        ...FONTS.semiBold,
        fontSize: FONTS.size.sm,
        color: colors.marketUp,
      },
      statValueLow: {
        ...FONTS.semiBold,
        fontSize: FONTS.size.sm,
        color: colors.marketDown,
      },
      aboutCard: {
        marginBottom: SPACING.lg,
      },
      aboutText: {
        ...FONTS.regular,
        fontSize: FONTS.size.sm,
        color: colors.textSecondary,
        lineHeight: 20,
        paddingTop: SPACING.md,
      },
      // ── AI Insight Card ──
      aiCard: {
        padding: SPACING.xl,
        borderRadius: BORDER_RADIUS.xl,
        borderWidth: 1,
        marginBottom: SPACING.lg,
      },
      aiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
      },
      aiHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
      },
      aiIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
      },
      aiTitle: {
        ...FONTS.bold,
        fontSize: FONTS.size.md,
        color: colors.text,
      },
      aiSubtitle: {
        ...FONTS.regular,
        fontSize: FONTS.size.xs,
        marginTop: 1,
      },
      sentimentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
      },
      sentimentText: {
        ...FONTS.semiBold,
        fontSize: FONTS.size.xs,
      },
      confidenceRow: {
        marginBottom: SPACING.md,
      },
      confidenceLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      },
      confidenceLabel: {
        ...FONTS.regular,
        fontSize: FONTS.size.xs,
      },
      confidenceValue: {
        ...FONTS.bold,
        fontSize: FONTS.size.sm,
      },
      confidenceBar: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
      },
      confidenceFill: {
        height: '100%',
        borderRadius: 3,
      },
      aiSummary: {
        ...FONTS.semiBold,
        fontSize: FONTS.size.sm,
        color: colors.text,
        marginBottom: SPACING.sm,
      },
      aiAnalysis: {
        ...FONTS.regular,
        fontSize: FONTS.size.sm,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: SPACING.md,
      },
      targetsSection: {
        marginBottom: SPACING.md,
      },
      targetsLabel: {
        ...FONTS.medium,
        fontSize: FONTS.size.xs,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
      },
      targetsRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
      },
      targetItem: {
        flex: 1,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        alignItems: 'center',
      },
      targetProb: {
        ...FONTS.semiBold,
        fontSize: FONTS.size.xs,
        marginBottom: 2,
      },
      targetValue: {
        ...FONTS.bold,
        fontSize: FONTS.size.sm,
        color: colors.text,
        marginBottom: 6,
      },
      probBar: {
        width: '100%',
        height: 3,
        borderRadius: 2,
        overflow: 'hidden',
      },
      probFill: {
        height: '100%',
        borderRadius: 2,
      },
      aiCta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xs,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
      },
      aiCtaText: {
        ...FONTS.semiBold,
        fontSize: FONTS.size.sm,
      },

      // ── Section Title ──
      sectionTitle: {
        ...FONTS.bold,
        fontSize: FONTS.size.lg,
      },
      sectionSubtitle: {
        ...FONTS.regular,
        fontSize: FONTS.size.xs,
      },

      // ── Peer Comparison ──
      peerHeader: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
      },
      peerHeaderCell: {
        ...FONTS.semiBold,
        fontSize: FONTS.size.xs,
        flex: 1,
        textAlign: 'right',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      },
      peerCellSymbol: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        textAlign: 'left',
      },
      peerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderRadius: BORDER_RADIUS.sm,
        marginTop: 2,
      },
      peerSymbolText: {
        ...FONTS.semiBold,
        fontSize: FONTS.size.sm,
      },
      peerCellText: {
        ...FONTS.medium,
        fontSize: FONTS.size.sm,
        flex: 1,
        textAlign: 'right',
      },
      youBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
      },
      youBadgeText: {
        ...FONTS.bold,
        fontSize: 8,
      },
      bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: SPACING.lg,
        paddingBottom: 40,
        paddingHorizontal: SPACING.xl,
      },
      bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
      priceInfo: {
        alignItems: 'center',
      },
      ltpLabel: {
        ...FONTS.regular,
        fontSize: FONTS.size.xs,
        color: colors.textMuted,
      },
      ltpValue: {
        ...FONTS.bold,
        fontSize: FONTS.size.xl,
        color: colors.text,
      },
      bottomActions: {
        flexDirection: 'row',
        gap: SPACING.md,
      },
      tradeBtn: {
        paddingHorizontal: SPACING.xxl,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.full,
      },
      buyBtn: {
        padding: 0,
        overflow: 'hidden',
      },
      sellBtn: {
        backgroundColor: colors.bgCard,
        borderWidth: 1,
        borderColor: colors.marketDown,
      },
      buyGradient: {
        paddingHorizontal: SPACING.xxl,
        paddingVertical: SPACING.md,
      },
      tradeBtnText: {
        ...FONTS.bold,
        fontSize: FONTS.size.md,
        color: colors.white,
      },

      // ── Sector Context ──
      sectorPerfCard: {
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        padding: SPACING.md,
        gap: 3,
      },
      sectorPerfHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
      },
      sectorPerfLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
      sectorPerfName: {
        ...FONTS.semiBold,
        fontSize: FONTS.size.sm,
      },
      sectorPerfBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
        borderRadius: BORDER_RADIUS.full,
      },
      sectorPerfChange: {
        ...FONTS.bold,
        fontSize: FONTS.size.sm,
      },
      sectorBarBg: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: SPACING.md,
      },
      sectorBarFill: {
        height: '100%',
        borderRadius: 3,
      },
      sectorStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
      },
      sectorStatItem: {
        flex: 1,
        alignItems: 'center',
      },
      sectorStatValue: {
        ...FONTS.bold,
        fontSize: FONTS.size.sm,
      },
      sectorStatLabel: {
        ...FONTS.regular,
        fontSize: 10,
        marginTop: 2,
      },
      sectorStatDivider: {
        width: 1,
        height: 24,
      },
      sectorRankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        marginTop: SPACING.sm,
      },
      sectorRankText: {
        ...FONTS.regular,
        fontSize: 10,
        flex: 1,
        lineHeight: 16,
      },

      // ── Peer Comparison Enhanced ──
      peerCellWithBar: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 3,
      },
      peerBarBg: {
        width: '100%',
        height: 3,
        borderRadius: 2,
        overflow: 'hidden',
      },
      peerBarFill: {
        height: '100%',
        borderRadius: 2,
      },
    });
  }, [colors, SPACING, FONTS, BORDER_RADIUS]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' }}>
            {/* Connection status */}
            <View style={[styles.connectionBadge, { backgroundColor: isConnected ? colors.marketUp + '20' : colors.marketDown + '20' }]}>
              <View style={[styles.connectionDot, { backgroundColor: isConnected ? colors.marketUp : colors.marketDown }]} />
              <Text style={[styles.connectionText, { color: isConnected ? colors.marketUp : colors.marketDown }]}>
                {isConnected ? 'Live' : 'Offline'}
              </Text>
            </View>
            <TouchableOpacity style={styles.watchlistBtn} onPress={handleWatchlistToggle}>
              <Ionicons
                name={inWatchlist ? 'heart' : 'heart-outline'}
                size={24}
                color={inWatchlist ? colors.secondary : colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stock Info */}
        <View style={styles.stockInfo}>
          <View style={styles.stockHeader}>
            <View>
              <Text style={styles.symbol}>{stock.symbol}</Text>
              <Text style={styles.name}>{stock.name}</Text>
            </View>
            <Badge label={stock.sector} variant="info" />
          </View>

          <View style={styles.priceSection}>
            <Text style={styles.price}>{formatCurrency(displayPrice)}</Text>
            <View style={[styles.changeBadge, { backgroundColor: (isPositive ? colors.marketUp : colors.marketDown) + '20' }]}>
              <Ionicons name={isPositive ? 'caret-up' : 'caret-down'} size={18} color={isPositive ? colors.marketUp : colors.marketDown} />
              <Text style={[styles.changeText, { color: isPositive ? colors.marketUp : colors.marketDown }]}>
                {isPositive ? '+' : ''}{displayChange.toFixed(2)} ({isPositive ? '+' : ''}{displayChangePercent.toFixed(2)}%)
              </Text>
            </View>
          </View>

          {/* Live indicator */}
          <View style={styles.liveIndicator}>
            <View style={[styles.liveDot, { backgroundColor: isConnected ? '#00C853' : '#888' }]}>
              {isConnected && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00C853', opacity: 0.4, borderRadius: 4 }} />
              )}
            </View>
            <Text style={styles.liveText}>
              {isConnected ? 'Streaming live prices' : 'Using simulated prices'}
            </Text>
          </View>
        </View>

        {/* Chart Options — MA + Indicator Toggles */}
        <View style={styles.chartOptions}>
          <TouchableOpacity
            style={[styles.chartOptionBtn, showMA && styles.chartOptionActive]}
            onPress={() => setShowMA(prev => !prev)}
          >
            <Text style={[styles.chartOptionText, showMA && styles.chartOptionTextActive]}>MA</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chartOptionBtn, activeIndicators.includes('rsi') && styles.chartOptionActive]}
            onPress={() => handleIndicatorToggle('rsi')}
          >
            <Text style={[styles.chartOptionText, activeIndicators.includes('rsi') && styles.chartOptionTextActive]}>RSI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chartOptionBtn, activeIndicators.includes('macd') && styles.chartOptionActive]}
            onPress={() => handleIndicatorToggle('macd')}
          >
            <Text style={[styles.chartOptionText, activeIndicators.includes('macd') && styles.chartOptionTextActive]}>MACD</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chartOptionBtn, activeIndicators.includes('bollinger') && styles.chartOptionActive]}
            onPress={() => handleIndicatorToggle('bollinger')}
          >
            <Text style={[styles.chartOptionText, activeIndicators.includes('bollinger') && styles.chartOptionTextActive]}>BB</Text>
          </TouchableOpacity>
        </View>
        <ChartCrosshairContext.Provider value={{ focusedIndex, setFocusedIndex }}>
          <CandlestickChart
            data={candleHistory}
            height={280}
            width={width - 64}
            timeframes={TIMEFRAMES}
            activeTimeframe={activeTimeframe}
            onTimeframeChange={handleTimeframeChange}
            showVolume={true}
            showMA={showMA}
            loading={candleHistory.length === 0}
          />

          {/* Technical Indicators Panel */}
          {activeIndicators.length > 0 && (
            <TechnicalIndicators
              data={candleHistory}
              width={width - 64}
              indicators={activeIndicators}
              onIndicatorToggle={handleIndicatorToggle}
            />
          )}
        </ChartCrosshairContext.Provider>

        {/* Key Stats */}
        <View style={{ ...styles.statsGrid, marginTop: SPACING.lg }}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Open</Text>
            <Text style={styles.statValue}>
              {candleHistory.length > 0
                ? formatCurrency(candleHistory[0].open, true)
                : formatCurrency(stock.price, true)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Day High</Text>
            <Text style={styles.statValueHigh}>{formatCurrency(dayHigh, true)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Day Low</Text>
            <Text style={styles.statValueLow}>{formatCurrency(dayLow, true)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Volume</Text>
            <Text style={styles.statValue}>
              {volume > 0 ? formatCompactNumber(volume) : stock.volume}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Market Cap</Text>
            <Text style={styles.statValue}>{stock.marketCap}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>P/E Ratio</Text>
            <Text style={styles.statValue}>{stock.pe.toFixed(1)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>52W High</Text>
            <Text style={styles.statValueHigh}>{formatCurrency(stock.high52)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>52W Low</Text>
            <Text style={styles.statValueLow}>{formatCurrency(stock.low52)}</Text>
          </View>
        </View>

        {/* About Company */}
        <Card title="About Company" style={styles.aboutCard}>
          <Text style={styles.aboutText}>
            {stock.name} is a leading company in the {stock.sector} sector with a market
            capitalization of {stock.marketCap}. The company has a P/E ratio of {stock.pe.toFixed(1)}
            {' '}and a dividend yield of {stock.dividend}%. With a 52-week range of {formatCurrency(stock.low52)}
            {' '}to {formatCurrency(stock.high52)}, the stock shows strong market presence and
            consistent performance in its sector.
          </Text>
        </Card>

        {/* Sector Context */}
        {sectorData && (() => {
          const isSectorGreen = sectorData.avgChange >= 0;
          const intensity = Math.min(Math.abs(sectorData.avgChange) / 5, 1);
          return (
            <View style={{ marginBottom: SPACING.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Sector Context</Text>
                <Badge label={`#${sectorData.rank} of ${sectorData.totalSectors}`} variant={sectorData.rank <= 3 ? 'success' : sectorData.rank >= sectorData.totalSectors - 2 ? 'danger' : 'info'} />
              </View>

              {/* Sector Performance Bar */}
              <View style={[styles.sectorPerfCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={styles.sectorPerfHeader}>
                  <View style={styles.sectorPerfLeft}>
                    <Ionicons name="business" size={18} color={isSectorGreen ? colors.marketUp : colors.marketDown} />
                    <Text style={[styles.sectorPerfName, { color: colors.text }]}>{stock.sector} Sector</Text>
                  </View>
                  <View style={[styles.sectorPerfBadge, {
                    backgroundColor: isSectorGreen
                      ? `rgba(0, 230, 118, ${Math.max(0.1, intensity)})`
                      : `rgba(255, 82, 82, ${Math.max(0.1, intensity)})`,
                  }]}>
                    <Ionicons name={isSectorGreen ? 'trending-up' : 'trending-down'} size={14} color={isSectorGreen ? colors.marketUp : colors.marketDown} />
                    <Text style={[styles.sectorPerfChange, {
                      color: isSectorGreen ? colors.marketUp : colors.marketDown,
                    }]}>
                      {isSectorGreen ? '+' : ''}{sectorData.avgChange.toFixed(2)}%
                    </Text>
                  </View>
                </View>

                {/* Sector performance bar */}
                <View style={[styles.sectorBarBg, { backgroundColor: colors.bgInput }]}>
                  <View style={[styles.sectorBarFill, {
                    width: `${Math.min(Math.abs(sectorData.avgChange) * 15, 100)}%`,
                    backgroundColor: isSectorGreen ? colors.marketUp : colors.marketDown,
                  }]} />
                </View>

                {/* Sector stats row */}
                <View style={[styles.sectorStatsRow, { borderTopColor: colors.divider }]}>
                  <View style={styles.sectorStatItem}>
                    <Text style={[styles.sectorStatValue, { color: colors.text }]}>{sectorData.stocks.length}</Text>
                    <Text style={[styles.sectorStatLabel, { color: colors.textMuted }]}>Stocks</Text>
                  </View>
                  <View style={[styles.sectorStatDivider, { backgroundColor: colors.divider }]} />
                  <View style={styles.sectorStatItem}>
                    <Text style={[styles.sectorStatValue, { color: colors.marketUp }]}>{sectorData.best.symbol}</Text>
                    <Text style={[styles.sectorStatLabel, { color: colors.textMuted }]}>Best</Text>
                  </View>
                  <View style={[styles.sectorStatDivider, { backgroundColor: colors.divider }]} />
                  <View style={styles.sectorStatItem}>
                    <Text style={[styles.sectorStatValue, { color: colors.marketDown }]}>{sectorData.worst.symbol}</Text>
                    <Text style={[styles.sectorStatLabel, { color: colors.textMuted }]}>Worst</Text>
                  </View>
                </View>

                {/* Sector ranking context */}
                <View style={[styles.sectorRankRow, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
                  <Ionicons name="podium" size={14} color={colors.textMuted} />
                  <Text style={[styles.sectorRankText, { color: colors.textMuted }]}>
                    {stock.sector} is #{sectorData.rank} of {sectorData.totalSectors} sectors
                    {' ('}+{sectorData.bestSector.avgChange.toFixed(1)}% best — {sectorData.worstSector.avgChange.toFixed(1)}% worst)
                  </Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Peer Comparison */}
        {(() => {
          const peers = stocks.filter(s => s.sector === stock.sector && s.id !== stockId).slice(0, 5);
          if (peers.length === 0) return null;
          return (
            <View style={{ marginBottom: SPACING.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Peer Comparison</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{stock.sector}</Text>
              </View>



              {/* Table header */}
              <View style={[styles.peerHeader, { borderColor: colors.border }]}>
                <Text style={[styles.peerHeaderCell, styles.peerCellSymbol, { color: colors.textMuted }]}>Symbol</Text>
                <Text style={[styles.peerHeaderCell, { color: colors.textMuted }]}>P/E</Text>
                <Text style={[styles.peerHeaderCell, { color: colors.textMuted }]}>M.Cap</Text>
                <Text style={[styles.peerHeaderCell, { color: colors.textMuted }]}>Chg%</Text>
              </View>

              {/* Current stock (highlighted) */}
              {(() => {
                const allPeers = [stock, ...peers];
                const maxPE = Math.max(...allPeers.map(p => p.pe), 1);
                const peBarWidth = (stock.pe / maxPE) * 100;
                return (
                  <View style={[styles.peerRow, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' }]}>
                    <View style={styles.peerCellSymbol}>
                      <Text style={[styles.peerSymbolText, { color: colors.primary }]}>{stock.symbol}</Text>
                      <View style={[styles.youBadge, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.youBadgeText, { color: colors.primary }]}>YOU</Text>
                      </View>
                    </View>
                    <View style={styles.peerCellWithBar}>
                      <Text style={[styles.peerCellText, { color: colors.text }]}>{stock.pe.toFixed(1)}</Text>
                      <View style={[styles.peerBarBg, { backgroundColor: colors.bgInput }]}>
                        <View style={[styles.peerBarFill, { width: `${peBarWidth}%`, backgroundColor: colors.primary, opacity: 0.7 }]} />
                      </View>
                    </View>
                    <Text style={[styles.peerCellText, { color: colors.text }]}>{formatCompactMarketCap(stock.marketCap)}</Text>
                    <Text style={[styles.peerCellText, { color: stock.changePercent >= 0 ? colors.marketUp : colors.marketDown }]}>
                      {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                    </Text>
                  </View>
                );
              })()}

              {/* Peer stocks */}
              {(() => {
                const allPeers = [stock, ...peers];
                const maxPE = Math.max(...allPeers.map(p => p.pe), 1);
                return peers.map(p => {
                  const peBarWidth = (p.pe / maxPE) * 100;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.peerRow, { borderColor: colors.border }]}
                      onPress={() => navigation.navigate('StockDetail', { stockId: p.id, symbol: p.symbol })}
                    >
                      <View style={styles.peerCellSymbol}>
                        <Text style={[styles.peerSymbolText, { color: colors.text }]}>{p.symbol}</Text>
                      </View>
                      <View style={styles.peerCellWithBar}>
                        <Text style={[styles.peerCellText, { color: colors.text }]}>{p.pe.toFixed(1)}</Text>
                        <View style={[styles.peerBarBg, { backgroundColor: colors.bgInput }]}>
                          <View style={[styles.peerBarFill, { width: `${peBarWidth}%`, backgroundColor: colors.textMuted, opacity: 0.3 }]} />
                        </View>
                      </View>
                      <Text style={[styles.peerCellText, { color: colors.text }]}>{formatCompactMarketCap(p.marketCap)}</Text>
                      <Text style={[styles.peerCellText, { color: p.changePercent >= 0 ? colors.marketUp : colors.marketDown }]}>
                        {p.changePercent >= 0 ? '+' : ''}{p.changePercent.toFixed(2)}%
                      </Text>
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>
          );
        })()}

        {/* AI Insight */}
        {aiInsight && (() => {
          const sentimentColor = aiInsight.type === 'bullish' ? '#00C853'
            : aiInsight.type === 'bearish' ? '#FF1744' : '#FFC107';
          const sentimentBg = aiInsight.type === 'bullish' ? '#00C85320'
            : aiInsight.type === 'bearish' ? '#FF174420' : '#FFC10720';
          const sentimentIcon = aiInsight.type === 'bullish' ? 'trending-up'
            : aiInsight.type === 'bearish' ? 'trending-down' : 'remove';
          const sentimentLabel = aiInsight.type === 'bullish' ? 'Bullish'
            : aiInsight.type === 'bearish' ? 'Bearish' : 'Neutral';

          return (
            <View style={[styles.aiCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: sentimentColor }]}>
              {/* Header */}
              <View style={styles.aiHeader}>
                <View style={styles.aiHeaderLeft}>
                  <View style={[styles.aiIconWrap, { backgroundColor: sentimentBg }]}>
                    <Ionicons name="bulb" size={18} color={sentimentColor} />
                  </View>
                  <View>
                    <Text style={[styles.aiTitle, { color: colors.text }]}>AI Analysis</Text>
                    <Text style={[styles.aiSubtitle, { color: colors.textSecondary }]}>Powered by Deep Learning</Text>
                  </View>
                </View>
                <View style={[styles.sentimentBadge, { backgroundColor: sentimentBg }]}>
                  <Ionicons name={sentimentIcon} size={14} color={sentimentColor} />
                  <Text style={[styles.sentimentText, { color: sentimentColor }]}>{sentimentLabel}</Text>
                </View>
              </View>

              {/* Confidence bar */}
              <View style={styles.confidenceRow}>
                <View style={styles.confidenceLabelRow}>
                  <Text style={[styles.confidenceLabel, { color: colors.textMuted }]}>Confidence</Text>
                  <Text style={[styles.confidenceValue, { color: sentimentColor }]}>{aiInsight.confidence}%</Text>
                </View>
                <View style={[styles.confidenceBar, { backgroundColor: colors.bgInput }]}>
                  <View style={[styles.confidenceFill, {
                    width: `${aiInsight.confidence}%`,
                    backgroundColor: sentimentColor,
                  }]} />
                </View>
              </View>

              {/* Summary */}
              <Text style={[styles.aiSummary, { color: colors.text }]}>{aiInsight.summary}</Text>
              <Text style={[styles.aiAnalysis, { color: colors.textSecondary }]} numberOfLines={3}>
                {aiInsight.analysis}
              </Text>

              {/* Target Levels */}
              {aiInsight.targets.length > 0 && (
                <View style={styles.targetsSection}>
                  <Text style={[styles.targetsLabel, { color: colors.textMuted }]}>Target Levels</Text>
                  <View style={styles.targetsRow}>
                    {aiInsight.targets.map((t, i) => (
                      <View key={i} style={[styles.targetItem, { backgroundColor: colors.bgCardLight }]}>
                        <Text style={[styles.targetProb, { color: colors.textMuted }]}>{t.probability}%</Text>
                        <Text style={[styles.targetValue, { color: colors.text }]}>{formatCurrency(t.target)}</Text>
                        <View style={[styles.probBar, { backgroundColor: colors.bgInput }]}>
                          <View style={[styles.probFill, {
                            width: `${t.probability}%`,
                            backgroundColor: sentimentColor,
                            opacity: 0.6 + (i / aiInsight.targets.length) * 0.4,
                          }]} />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* CTA */}
              <TouchableOpacity style={[styles.aiCta, { borderColor: colors.border }]} onPress={() => navigation.navigate('AIInsight')}>
                <Text style={[styles.aiCtaText, { color: colors.primary }]}>View Full Analysis</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          );
        })()}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <LinearGradient colors={[hexToRgba(colors.bg, 0), colors.bg]} style={styles.bottomBar}>
        <View style={styles.bottomRow}>
          <View style={styles.priceInfo}>
            <Text style={styles.ltpLabel}>LTP</Text>
            <Text style={styles.ltpValue}>{formatCurrency(displayPrice)}</Text>
          </View>
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[styles.tradeBtn, styles.sellBtn]}
              onPress={() => handleOpenPlaceOrder('sell')}
            >
              <Text style={styles.tradeBtnText}>Sell</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tradeBtn, styles.buyBtn]}
              onPress={() => handleOpenPlaceOrder('buy')}
            >
              <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buyGradient}>
                <Text style={styles.tradeBtnText}>Buy</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>


    </View>
  );
}
