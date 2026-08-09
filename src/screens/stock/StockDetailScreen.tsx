import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useMarketStore } from '../../store/marketStore';
import { useT } from '../../hooks/useT';
import { useWatchlistStore } from '../../store/watchlistStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useAIStore } from '../../store/aiStore';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import CandlestickChart, { ChartType } from '../../components/CandlestickChart';
import TechnicalIndicators from '../../components/TechnicalIndicators';
import type { IndicatorType } from '../../components/TechnicalIndicators';
import { DrawingToolbar, type DrawingAnnotation, type DrawingToolType } from '../../components/chart/DrawingTools';
import { detectPatterns , type DetectedPattern } from '../../components/chart/patternDetection';
import { usePatternSettingsStore } from '../../store/patternSettingsStore';
import PatternSettingsModal from '../../components/stock/PatternSettingsModal';
import { ChartCrosshairContext } from '../../components/ChartCrosshairContext';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { useRealtimePrice } from '../../hooks/useRealtimePrice';
import { tickerProvider } from '../../services/tickerProvider';

// ── Extracted components ──
import ChartControls from '../../components/stock/ChartControls';
import KeyStatsGrid from '../../components/stock/KeyStatsGrid';
import AIInsightCard from '../../components/stock/AIInsightCard';
import SectorContext from '../../components/stock/SectorContext';
import type { SectorContextData } from '../../components/stock/SectorContext';
import PeerComparison from '../../components/stock/PeerComparison';
import PatternSummary from '../../components/stock/PatternSummary';
import BottomActionBar from '../../components/stock/BottomActionBar';
import FullscreenChartModal from '../../components/stock/FullscreenChartModal';
import TradingViewChart from '../../components/TradingViewChart';
import PositionLevelsOverlay from '../../components/PositionLevelsOverlay';
import { toTradingViewSymbol, toTradingViewInterval } from '../../utils/tradingView';
import { openExitOrder } from '../../utils/orderExit';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';


const { width } = Dimensions.get('window');

const TIMEFRAMES = ['1m', '5m', '15m', '1D', '1W', '1M', '3M', '1Y', 'Max'];

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

export default function StockDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'StockDetail'>) {
  const { stockId } = route.params;
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { stocks } = useMarketStore();
  const { insights } = useAIStore();
  const { isInWatchlist, addToWatchlist, removeFromWatchlist, watchlists } = useWatchlistStore();
  const { holdings: portfolioHoldings } = usePortfolioStore();

  const stock = stocks.find(s => s.id === stockId) || stocks[0];
  const [activeTimeframe, setActiveTimeframe] = useState('1M');
  const [showMA, setShowMA] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<IndicatorType[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [chartType, setChartType] = useState<ChartType>('candlestick');

  // ── Live chart mode ──
  // TradingView widget (real, live data) by default; custom candlestick chart
  // as a fallback when the widget cannot load (offline / blocked CDN).
  const [chartMode, setChartMode] = useState<'live' | 'custom'>('live');
  const [tvFailed, setTvFailed] = useState(false);
  const isLiveChart = chartMode === 'live' && !tvFailed;
  const tvSymbol = useMemo(() => toTradingViewSymbol(stock.symbol, 'NSE'), [stock.symbol]);

  const handleTvError = useCallback(() => setTvFailed(true), []);

  const handleToggleLive = useCallback(() => {
    if (isLiveChart) {
      setChartMode('custom');
    } else {
      setTvFailed(false);
      setChartMode('live');
    }
  }, [isLiveChart]);

  // ── Drawing state ──
  const [enableDrawing, setEnableDrawing] = useState(false);
  const [drawings, setDrawings] = useState<DrawingAnnotation[]>([]);
  const [activeDrawTool, setActiveDrawTool] = useState<DrawingToolType>('none');
  const [showPatterns, setShowPatterns] = useState(false);
  const [showPatternSettings, setShowPatternSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Sector Performance Data ──
  const sectorData: SectorContextData | null = useMemo(() => {
    const sectorStocks = stocks.filter(s => s.sector === stock.sector);
    if (sectorStocks.length === 0) return null;

    const avgChange = sectorStocks.reduce((sum, s) => sum + s.changePercent, 0) / sectorStocks.length;
    const best = [...sectorStocks].sort((a, b) => b.changePercent - a.changePercent)[0];
    const worst = [...sectorStocks].sort((a, b) => a.changePercent - b.changePercent)[0];

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
      sectorName: stock.sector,
      avgChange: Math.round(avgChange * 100) / 100,
      stockCount: sectorStocks.length,
      bestStockSymbol: best.symbol,
      worstStockSymbol: worst.symbol,
      rank,
      totalSectors: sectorAvg.length,
      bestSectorName: bestSector.name,
      bestSectorChange: bestSector.avgChange,
      worstSectorName: worstSector.name,
      worstSectorChange: worstSector.avgChange,
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

  const displayPrice = currentPrice;
  const displayChange = priceChange;
  const displayChangePercent = priceChangePercent;

  const aiInsight = insights.find(i => i.stockId === stockId);
  const inWatchlist = isInWatchlist(stockId);

  // ── Live position tag (Indian PlaceOrder flow) ──
  // Pulls the holding directly from the local portfolio store — the overlay
  // renders it without calling the SnapTrade backend, and chips pre-fill the
  // Indian PlaceOrder screen (SL trigger / LIMIT price).
  const heldPosition = useMemo(() => {
    const h = portfolioHoldings.find(x => x.stockId === stock.id);
    if (!h) return null;
    return {
      symbol: h.symbol,
      quantity: h.quantity,
      avgCost: h.buyPrice,
      price: h.currentPrice,
      pnl: h.pnl,
      pnlPercent: h.pnlPercent,
    };
  }, [portfolioHoldings, stock.id]);

  // Shared exit-order wiring (Ticker Provider pre-select + PlaceOrder prefill)
  // for the live-position overlay's STOP / TARGET chips.
  const openExit = useCallback(
    (kind: 'SL' | 'LIMIT', price: number) =>
      openExitOrder(
        navigation,
        {
          symbol: stock.symbol,
          exchange: 'NSE',
          name: stock.name,
          price: displayPrice,
          stockId: stock.id,
        },
        kind,
        price,
      ),
    [navigation, stock, displayPrice],
  );

  const handleTimeframeChange = useCallback((tf: string) => {
    setActiveTimeframe(tf);
    loadHistory(tf);
  }, [loadHistory]);

  const handleIndicatorToggle = useCallback((type: IndicatorType) => {
    setActiveIndicators(prev =>
      prev.includes(type) ? prev.filter(i => i !== type) : [...prev, type]
    );
  }, []);

  const handleChartTypeCycle = useCallback(() => {
    setChartType(prev =>
      prev === 'candlestick' ? 'line'
      : prev === 'line' ? 'area'
      : prev === 'area' ? 'heikin_ashi'
      : 'candlestick'
    );
  }, []);

  // ── Pattern detection settings from store ──
  const patternSettings = usePatternSettingsStore(s => ({
    minConfidence: s.minConfidence,
    enabledPatterns: s.enabledPatterns,
    lookback: s.lookback,
  }));

  // ── Detect patterns on candle history ──
  const detectedPatterns: DetectedPattern[] = useMemo(() => {
    if (!showPatterns || candleHistory.length < 20) return [];
    const result = detectPatterns(candleHistory, {
      minConfidence: patternSettings.minConfidence,
      enabledPatterns: patternSettings.enabledPatterns,
      lookback: patternSettings.lookback,
    });
    return result.patterns;
  }, [candleHistory, showPatterns, patternSettings]);

  const handleWatchlistToggle = useCallback(() => {
    const firstWatchlist = watchlists[0];
    if (!firstWatchlist) return;
    if (isInWatchlist(stockId)) {
      removeFromWatchlist(firstWatchlist.id, stockId, stock.symbol);
    } else {
      addToWatchlist(firstWatchlist.id, stock);
    }
  }, [watchlists, stockId, stock, isInWatchlist, addToWatchlist, removeFromWatchlist]);

  // Hybrid Ticker Provider — pre-select this instrument so the SnapTrade
  // order panel opens pre-filled with the same symbol, chart and execution
  // price when the user taps Buy/Sell. Exchange is NSE for Indian equities.
  const preselectStock = useCallback(() => {
    tickerProvider.selectSymbol({
      symbol: stock.symbol,
      exchange: 'NSE',
      name: stock.name,
      price: displayPrice,
    });
  }, [stock, displayPrice]);

  const handleOpenBuy = useCallback(() => {
    preselectStock();
    navigation.navigate('PlaceOrder', { stockId: stock.id, symbol: stock.symbol, tradeType: 'buy' });
  }, [navigation, stock, preselectStock]);

  const handleOpenSell = useCallback(() => {
    preselectStock();
    navigation.navigate('PlaceOrder', { stockId: stock.id, symbol: stock.symbol, tradeType: 'sell' });
  }, [navigation, stock, preselectStock]);

  const INTRADAY_CANDLE_COUNT = 390;
  const dayHigh = candleHistory.length > 0
    ? Math.max(...candleHistory.slice(-INTRADAY_CANDLE_COUNT).map(c => c.high))
    : stock.high52;
  const dayLow = candleHistory.length > 0
    ? Math.min(...candleHistory.slice(-INTRADAY_CANDLE_COUNT).map(c => c.low))
    : stock.low52;
  const volume = candleHistory.length > 0
    ? candleHistory[candleHistory.length - 1]?.volume
    : 0;

  // Peers for comparison
  const peers = useMemo(() =>
    stocks.filter(s => s.sector === stock.sector && s.id !== stockId).slice(0, 5),
    [stocks, stock.sector, stockId],
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel={t('app.close')}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' }}>
            <View style={[styles.connectionBadge, { backgroundColor: isConnected ? colors.marketUp + '20' : colors.marketDown + '20' }]}>
              <View style={[styles.connectionDot, { backgroundColor: isConnected ? colors.marketUp : colors.marketDown }]} />
              <Text style={[styles.connectionText, { color: isConnected ? colors.marketUp : colors.marketDown }]}>
{isConnected ? t('status.live') : t('status.offline')}
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

          <View style={styles.liveIndicator}>
            <View style={styles.liveDot}>
              <View style={[styles.liveDotInner, { backgroundColor: isConnected ? '#00C853' : '#888' }]} />
              {isConnected && <View style={styles.livePulse} />}
            </View>
            <Text style={styles.liveText}>
              {isConnected ? 'Streaming live prices' : 'Using simulated prices'}
            </Text>
          </View>
        </View>          {/* ── Extracted: Chart Controls ── */}
        <ChartControls
          showMA={showMA}
          activeIndicators={activeIndicators}
          enableDrawing={enableDrawing}
          showPatterns={showPatterns}
          chartType={chartType}
          isFullscreen={isFullscreen}
          isLive={isLiveChart}
          onToggleLive={handleToggleLive}
          onToggleMA={() => setShowMA(prev => !prev)}
          onToggleIndicator={handleIndicatorToggle}
          onToggleDrawing={() => { setEnableDrawing(!enableDrawing); if (!enableDrawing) setActiveDrawTool('none'); }}
          onTogglePatterns={() => setShowPatterns(!showPatterns)}
          onChangeChartType={handleChartTypeCycle}
          onToggleFullscreen={() => setIsFullscreen(prev => !prev)}
        />

        {/* Pattern Settings gear icon (visible when patterns are toggled on) */}
        {showPatterns && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: SPACING.sm }}>
            <TouchableOpacity
              onPress={() => setShowPatternSettings(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: SPACING.sm,
                paddingVertical: 4,
                borderRadius: BORDER_RADIUS.sm,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.bgCard,
              }}
            >
              <Ionicons name="settings-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.advancedLabel, { color: colors.textSecondary }]}>{t('stockDetail.advanced')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <ChartCrosshairContext.Provider value={{ focusedIndex, setFocusedIndex }}>
          {isLiveChart ? (
            <>
              {/* Live TradingView chart — real, live market data */}
              <View style={styles.timeframes}>
                {TIMEFRAMES.map((tf) => (
                  <TouchableOpacity
                    key={tf}
                    style={[styles.timeframeBtn, activeTimeframe === tf && styles.timeframeActive]}
                    onPress={() => handleTimeframeChange(tf)}
                  >
                    <Text style={[styles.timeframeText, activeTimeframe === tf && styles.timeframeTextActive]}>
                      {tf}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.chartWrap}>
                <TradingViewChart
                  symbol={tvSymbol}
                  interval={toTradingViewInterval(activeTimeframe)}
                  height={280}
                  onError={handleTvError}
                  style={styles.liveChart}
                />
                <PositionLevelsOverlay
                  symbol={stock.symbol}
                  position={heldPosition}
                  currency="INR"
                  onApplyStop={(p) => openExit('SL', p)}
                  onApplyTarget={(p) => openExit('LIMIT', p)}
                />
              </View>
            </>
          ) : (
            <>
              {/* Drawing Toolbar */}
              {enableDrawing && (
                <View style={{ marginBottom: SPACING.sm }}>
                  <DrawingToolbar
                    activeTool={activeDrawTool}
                    onToolChange={setActiveDrawTool}
                    colors={colors}
                    drawingCount={drawings.length}
                    onClearAll={() => setDrawings([])}
                  />
                </View>
              )}

              <View style={styles.chartWrap}>
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
                  chartType={chartType}
                  onChartTypeChange={setChartType}
                  enableDrawing={enableDrawing}
                  drawings={drawings}
                  onDrawingsChange={setDrawings}
                  activeDrawTool={activeDrawTool}
                  onDrawToolChange={setActiveDrawTool}
                  showPatterns={showPatterns}
                  patterns={detectedPatterns}
                />
                {/* Position tag + STOP/TARGET exit chips stay available even
                    when the live widget fails — the user can still exit. */}
                <PositionLevelsOverlay
                  symbol={stock.symbol}
                  position={heldPosition}
                  currency="INR"
                  onApplyStop={(p) => openExit('SL', p)}
                  onApplyTarget={(p) => openExit('LIMIT', p)}
                />
              </View>

              {/* ── Extracted: Pattern Summary ── */}
              {showPatterns && detectedPatterns.length > 0 && (
                <PatternSummary patterns={detectedPatterns} />
              )}
              {showPatterns && detectedPatterns.length === 0 && (
                <View style={{
                  padding: SPACING.md,
                  borderRadius: BORDER_RADIUS.md,
                  backgroundColor: colors.bg,
                  marginBottom: SPACING.sm,
                  alignItems: 'center',
                }}>
                  <Text style={[{
                    ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted,
                  }]}>
                    No patterns detected with current settings. Try lowering the confidence threshold or enabling more pattern types in{' '}
                    <Text
                      style={{ color: colors.primary, textDecorationLine: 'underline' }}
                      onPress={() => setShowPatternSettings(true)}
                    >
                      Advanced settings
                    </Text>.
                  </Text>
                </View>
              )}

              {/* ── Extracted: Technical Indicators ── */}
              {activeIndicators.length > 0 && (
                <TechnicalIndicators
                  data={candleHistory}
                  width={width - 64}
                  indicators={activeIndicators}
                  onIndicatorToggle={handleIndicatorToggle}
                />
              )}
            </>
          )}
        </ChartCrosshairContext.Provider>

        {/* ── Extracted: Key Stats Grid ── */}
        <View style={{ marginTop: SPACING.lg }}>
          <KeyStatsGrid stats={{ open: candleHistory[0]?.open || stock.price, dayHigh, dayLow, volume, marketCap: stock.marketCap, pe: stock.pe, high52: stock.high52, low52: stock.low52 }} />
        </View>

        {/* Fundamentals Button — Company Analysis */}
        <AnimatedPressable onPress={() => navigation.navigate('CompanyFundamentals', { symbol: stock.symbol, stockId: stock.id })} haptic="medium" scaleTo={0.97}>
          <View style={[styles.fundamentalsCard, { borderColor: colors.border, backgroundColor: `${colors.primary}08` }]}>
            <View style={styles.fundamentalsRow}>
              <View style={[styles.fundamentalsIcon, { backgroundColor: `${colors.primary}20` }]}>
                <Ionicons name="analytics" size={22} color={colors.primary} />
              </View>
              <View style={styles.fundamentalsInfo}>
                <Text style={[styles.fundamentalsTitle, { color: colors.text }]}>{t('stockDetail.companyFundamentals')}</Text>
                <Text style={[styles.fundamentalsSub, { color: colors.textSecondary }]}>
                  P/E {stock.pe.toFixed(1)}x · P/B {stock.pb.toFixed(1)}x · ROCE · Debt Ratios · Quarterly Results
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </View>
        </AnimatedPressable>

        {/* About Company */}
        <View testID="stock-about-company">
        <Card title={t('stockDetail.aboutCompany')} style={styles.aboutCard}>
          <Text style={styles.aboutText}>
            {stock.name} is a leading company in the {stock.sector} sector with a market
            capitalization of {stock.marketCap}. The company has a P/E ratio of {stock.pe.toFixed(1)}
            {' '}and a dividend yield of {stock.dividend}%. With a 52-week range of {formatCurrency(stock.low52)}
            {' '}to {formatCurrency(stock.high52)}, the stock shows strong market presence and
            consistent performance in its sector.
          </Text>
        </Card>
        </View>

        {/* ── Extracted: Sector Context ── */}
        {sectorData && <SectorContext data={sectorData} />}

        {/* ── Extracted: Peer Comparison ── */}
        <PeerComparison
          currentStock={stock}
          peers={peers}
          onPeerPress={(stockId, symbol) => navigation.navigate('StockDetail', { stockId, symbol })}
          formatMarketCap={formatCompactMarketCap}
        />

        {/* ── Extracted: AI Insight Card ── */}
        {aiInsight && (
          <AIInsightCard
            insight={{
              type: aiInsight.type,
              confidence: aiInsight.confidence,
              summary: aiInsight.summary,
              analysis: aiInsight.analysis,
              targets: aiInsight.targets,
            }}
            onViewFullAnalysis={() => navigation.navigate('AIInsights')}
          />
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Extracted: Bottom Action Bar ── */}
      <BottomActionBar
        displayPrice={displayPrice}
        onBuy={handleOpenBuy}
        onSell={handleOpenSell}
      />

      {/* ── Fullscreen Chart Modal ── */}
      <PatternSettingsModal
        visible={showPatternSettings}
        onClose={() => setShowPatternSettings(false)}
      />

      <FullscreenChartModal
        visible={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        candleHistory={candleHistory}
        activeTimeframe={activeTimeframe}
        onTimeframeChange={handleTimeframeChange}
        showMA={showMA}
        chartType={chartType}
        onChartTypeChange={setChartType}
        enableDrawing={enableDrawing}
        drawings={drawings}
        onDrawingsChange={setDrawings}
        activeDrawTool={activeDrawTool}
        onDrawToolChange={setActiveDrawTool}
        showPatterns={showPatterns}
        patterns={detectedPatterns}
        symbol={stock.symbol}
        name={stock.name}
        currentPrice={displayPrice}
        priceChange={displayChange}
        priceChangePercent={displayChangePercent}
        isPositive={isPositive}
        isConnected={isConnected}
        useLiveChart={isLiveChart}
        tvSymbol={tvSymbol}
        onTvError={handleTvError}
      />
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
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
      position: 'relative',
    },
    liveDotInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    livePulse: {
      position: 'absolute',
      top: -2,
      left: -2,
      right: -2,
      bottom: -2,
      backgroundColor: '#00C853',
      opacity: 0.4,
      borderRadius: 6,
    },
    liveText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    fundamentalsCard: {
      marginBottom: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      borderWidth: 1,
    },
    fundamentalsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    fundamentalsIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fundamentalsInfo: {
      flex: 1,
    },
    fundamentalsTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
    },
    fundamentalsSub: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      marginTop: 2,
    },
    advancedLabel: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
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
    // ── Live chart timeframe selector ──
    timeframes: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgCard,
    },
    timeframeBtn: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
    },
    timeframeActive: {
      backgroundColor: colors.primary + '25',
    },
    timeframeText: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    timeframeTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    liveChart: {
      marginBottom: SPACING.sm,
    },
    chartWrap: {
      position: 'relative',
    },
  });
