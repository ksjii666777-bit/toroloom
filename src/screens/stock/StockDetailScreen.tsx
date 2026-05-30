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
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useRealtimePrice } from '../../hooks/useRealtimePrice';

const { width } = Dimensions.get('window');

const TIMEFRAMES = ['1D', '1W', '1M', '3M', '1Y', 'Max'];

export default function StockDetailScreen({ route, navigation }: any) {
  const { stockId, symbol } = route.params;
  const { colors } = useTheme();
  const { stocks } = useMarketStore();
  const { insights } = useAIStore();
  const { isInWatchlist, addToWatchlist, removeFromWatchlist, watchlists } = useWatchlistStore();

  const stock = stocks.find(s => s.id === stockId) || stocks[0];
  const [activeTimeframe, setActiveTimeframe] = useState('1M');
  const [showMA, setShowMA] = useState(false);

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
  const changeColor = isPositive ? colors.marketUp : colors.marketDown;

  const aiInsight = insights.find(i => i.stockId === stockId);
  const inWatchlist = isInWatchlist(stockId);

  // Handle timeframe change
  const handleTimeframeChange = useCallback((tf: string) => {
    setActiveTimeframe(tf);
    loadHistory(tf);
  }, [loadHistory]);

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

  // Compute day range from candle data
  const dayHigh = candleHistory.length > 0
    ? Math.max(...candleHistory.slice(-390).map(c => c.high))
    : stock.high52;
  const dayLow = candleHistory.length > 0
    ? Math.min(...candleHistory.slice(-390).map(c => c.low))
    : stock.low52;
  const volume = candleHistory.length > 0
    ? candleHistory[candleHistory.length - 1]?.volume
    : 0;

  const styles = useMemo(() => {
    const changeColor = isPositive ? colors.marketUp : colors.marketDown;
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
        fontFamily: 'System',
        fontSize: FONTS.size.xs,
        fontWeight: '500',
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
        fontFamily: 'System',
        fontWeight: '800',
        fontSize: FONTS.size.hero,
        color: colors.text,
      },
      name: {
        fontFamily: 'System',
        fontWeight: '400',
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
        fontFamily: 'System',
        fontWeight: '900',
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
        fontFamily: 'System',
        fontWeight: '600',
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
        fontFamily: 'System',
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
        fontFamily: 'System',
        fontSize: FONTS.size.xs,
        color: colors.textSecondary,
        fontWeight: '500',
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
        fontFamily: 'System',
        fontWeight: '400',
        fontSize: FONTS.size.xs,
        color: colors.textMuted,
        marginBottom: 4,
      },
      statValue: {
        fontFamily: 'System',
        fontWeight: '600',
        fontSize: FONTS.size.sm,
        color: colors.text,
      },
      statValueHigh: {
        fontFamily: 'System',
        fontWeight: '600',
        fontSize: FONTS.size.sm,
        color: colors.marketUp,
      },
      statValueLow: {
        fontFamily: 'System',
        fontWeight: '600',
        fontSize: FONTS.size.sm,
        color: colors.marketDown,
      },
      aboutCard: {
        marginBottom: SPACING.lg,
      },
      aboutText: {
        fontFamily: 'System',
        fontWeight: '400',
        fontSize: FONTS.size.sm,
        color: colors.textSecondary,
        lineHeight: 20,
        paddingTop: SPACING.md,
      },
      aiCard: {
        padding: SPACING.xl,
        borderRadius: BORDER_RADIUS.xl,
        marginBottom: SPACING.lg,
      },
      aiHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
      },
      aiTitle: {
        fontFamily: 'System',
        fontWeight: '600',
        fontSize: FONTS.size.md,
        color: colors.white,
        flex: 1,
      },
      aiType: {
        fontFamily: 'System',
        fontWeight: '700',
        fontSize: FONTS.size.lg,
        color: colors.white,
        marginBottom: SPACING.sm,
      },
      aiSummary: {
        fontFamily: 'System',
        fontWeight: '500',
        fontSize: FONTS.size.md,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: SPACING.sm,
      },
      aiAnalysis: {
        fontFamily: 'System',
        fontWeight: '400',
        fontSize: FONTS.size.sm,
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 18,
        marginBottom: SPACING.md,
      },
      targetsRow: {
        flexDirection: 'row',
        gap: SPACING.md,
      },
      targetItem: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        alignItems: 'center',
      },
      targetValue: {
        fontFamily: 'System',
        fontWeight: '600',
        fontSize: FONTS.size.sm,
        color: colors.white,
      },
      targetProb: {
        fontFamily: 'System',
        fontWeight: '400',
        fontSize: FONTS.size.xs,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
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
        fontFamily: 'System',
        fontWeight: '400',
        fontSize: FONTS.size.xs,
        color: colors.textMuted,
      },
      ltpValue: {
        fontFamily: 'System',
        fontWeight: '700',
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
        fontFamily: 'System',
        fontWeight: '700',
        fontSize: FONTS.size.md,
        color: colors.white,
      },
    });
  }, [colors, isPositive, SPACING, FONTS, BORDER_RADIUS]);

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
            <View style={[styles.changeBadge, { backgroundColor: changeColor + '20' }]}>
              <Ionicons name={isPositive ? 'caret-up' : 'caret-down'} size={18} color={changeColor} />
              <Text style={[styles.changeText, { color: changeColor }]}>
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

        {/* Candlestick Chart */}
        <View style={styles.chartOptions}>
          <TouchableOpacity
            style={[styles.chartOptionBtn, showMA && styles.chartOptionActive]}
            onPress={() => setShowMA(prev => !prev)}
          >
            <Text style={[styles.chartOptionText, showMA && styles.chartOptionTextActive]}>MA</Text>
          </TouchableOpacity>
        </View>
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

        {/* AI Insight */}
        {aiInsight && (
          <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiCard}>
            <View style={styles.aiHeader}>
              <Ionicons name="bulb" size={20} color={colors.white} />
              <Text style={styles.aiTitle}>AI Insight</Text>
              <Badge
                label={`${aiInsight.confidence}% confidence`}
                variant={aiInsight.confidence > 75 ? 'success' : 'warning'}
              />
            </View>
            <Text style={styles.aiType}>
              {aiInsight.type === 'bullish' ? '🟢 Bullish' : aiInsight.type === 'bearish' ? '🔴 Bearish' : '🟡 Neutral'}
            </Text>
            <Text style={styles.aiSummary}>{aiInsight.summary}</Text>
            <Text style={styles.aiAnalysis}>{aiInsight.analysis}</Text>
            {aiInsight.targets.length > 0 && (
              <View style={styles.targetsRow}>
                {aiInsight.targets.map((t, i) => (
                  <View key={i} style={styles.targetItem}>
                    <Text style={styles.targetValue}>{formatCurrency(t.target)}</Text>
                    <Text style={styles.targetProb}>{t.probability}%</Text>
                  </View>
                ))}
              </View>
            )}
          </LinearGradient>
        )}

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
