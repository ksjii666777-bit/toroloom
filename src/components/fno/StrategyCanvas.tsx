/**
 * ============================================================================
 * Toroloom — Interactive Strategy P&L Canvas
 * ============================================================================
 *
 * An interactive SVG-based payoff diagram for multi-leg F&O strategies.
 * Features:
 *   - Smooth P&L curve with profit/loss region coloring
 *   - Touch/drag crosshair with exact P&L readout
 *   - Breakeven point markers
 *   - Individual leg contribution lines (colored per leg)
 *   - Max profit / max loss labels
 *   - Animated transitions when data changes
 *   - Tap-to-add-leg callback at any price point
 *
 * Usage:
 *   import StrategyCanvas from '../../components/fno/StrategyCanvas';
 *   <StrategyCanvas
 *     data={pnlChart}
 *     breakevenPoints={[23500, 24200]}
 *     maxProfit={24000}
 *     maxLoss={-16000}
 *     spotPrice={23456}
 *     onPriceTap={(price) => addLegAtPrice(price)}
 *   />
 *
 * ============================================================================
 */

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Path,
  Line,
  Rect,
  Circle,
  Text as SvgText,
  G,
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
} from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
// ──── Local type (matches StrategyPnLPoint from types)
interface PnLPoint {
  underlyingPrice: number;
  pnl: number;
  legPnls?: number[];
}

// ──── Constants ────────────────────────────────────────────────────────────

const PADDING = { top: 24, right: 16, bottom: 40, left: 70 };
const BREAKEVEN_DOT_RADIUS = 5;
const CROSSHAIR_LINE_WIDTH = 1;
const LEGEND_DOT_SIZE = 8;

// ──── Props ────────────────────────────────────────────────────────────────

interface StrategyCanvasProps {
  /** Array of P&L points from strategy analysis */
  data: PnLPoint[];
  /** Breakeven underlying prices */
  breakevenPoints: number[];
  /** Maximum profit value */
  maxProfit: number;
  /** Maximum loss value */
  maxLoss: number;
  /** Current spot/underlying price */
  spotPrice: number;
  /** Container height */
  height?: number;
  /** Callback when user taps a price point on the chart */
  onPriceTap?: (price: number) => void;
  /** Whether to show leg contribution lines */
  showLegContributions?: boolean;
  /** Labels for each leg (for legend) */
  legLabels?: string[];
  /** Colors for each leg line */
  legColors?: string[];
}

// ──── Component ────────────────────────────────────────────────────────────

export default function StrategyCanvas({
  data,
  breakevenPoints = [],
  maxProfit,
  maxLoss,
  spotPrice,
  height = 260,
  onPriceTap,
  showLegContributions = true,
  legLabels = [],
  legColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
}: StrategyCanvasProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Dimensions ──
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width - 48);
  const chartWidth = containerWidth - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  // ── Crosshair state ──
  const [crosshairPrice, setCrosshairPrice] = useState<number | null>(null);
  const crosshairOpacity = useSharedValue(0);

  // ── Animation on data change ──
  const fadeAnim = useSharedValue(1);
  const prevDataLen = useRef(data.length);

  useEffect(() => {
    if (data.length !== prevDataLen.current && prevDataLen.current > 0) {
      // Data changed — animate fade-out/in
      fadeAnim.value = withTiming(0.3, { duration: 150 }, () => {
        fadeAnim.value = withTiming(1, { duration: 300 });
      });
    }
    prevDataLen.current = data.length;
  }, [data.length, fadeAnim]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));

  // ── Compute chart bounds ──
  const { chartMin, chartMax, pnlRange, isProfitable: _isProfitable } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartMin: -1000, chartMax: 1000, pnlRange: 2000, isProfitable: true };
    }
    const pnls = data.map(p => p.pnl);
    const min = Math.min(...pnls, -1);
    const max = Math.max(...pnls, 1);
    const range = max - min || 1;
    const pad = range * 0.12;
    return {
      chartMin: min - pad,
      chartMax: max + pad,
      pnlRange: (max + pad) - (min - pad),
      isProfitable: data[data.length - 1]?.pnl >= 0,
    };
  }, [data]);

  // ── Coordinate mapping ──
  const getX = useCallback(
    (price: number) => {
      if (!data || data.length < 2) return PADDING.left;
      const minPrice = data[0].underlyingPrice;
      const maxPrice = data[data.length - 1].underlyingPrice;
      const priceRange = maxPrice - minPrice || 1;
      return PADDING.left + ((price - minPrice) / priceRange) * chartWidth;
    },
    [data, chartWidth],
  );

  const getY = useCallback(
    (pnl: number) => {
      return PADDING.top + ((chartMax - pnl) / pnlRange) * chartHeight;
    },
    [chartMax, pnlRange, chartHeight],
  );

  // ── Generate smooth P&L curve ──
  const { linePath, fillPath, isPositive } = useMemo(() => {
    if (!data || data.length < 2) return { linePath: '', fillPath: '', isPositive: true };

    const pts = data.map((p, i) => ({
      x: PADDING.left + (i / (data.length - 1)) * chartWidth,
      y: getY(p.pnl),
    }));

    // Cubic bezier smooth curve
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cp1x = prev.x + (curr.x - prev.x) / 3;
      const cp2x = prev.x + (2 * (curr.x - prev.x)) / 3;
      path += ` C ${cp1x} ${prev.y}, ${cp2x} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const bottomY = PADDING.top + chartHeight;
    const fill = `${path} L ${pts[pts.length - 1].x} ${bottomY} L ${pts[0].x} ${bottomY} Z`;

    const lastPnl = data[data.length - 1].pnl;
    return { linePath: path, fillPath: fill, isPositive: lastPnl >= 0 };
  }, [data, chartWidth, chartHeight, getY]);

  // ── Leg contribution paths ──
  const legPaths = useMemo(() => {
    if (!showLegContributions || !data || data.length < 2 || !data[0].legPnls) return [];
    const legCount = data[0].legPnls.length;

    return Array.from({ length: legCount }, (_, legIdx) => {
      const pts = data.map((p, i) => ({
        x: PADDING.left + (i / (data.length - 1)) * chartWidth,
        y: getY(p.legPnls?.[legIdx] ?? 0),
      }));

      let path = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) / 3;
        const cp2x = pts[i - 1].x + (2 * (pts[i].x - pts[i - 1].x)) / 3;
        path += ` C ${cp1x} ${pts[i - 1].y}, ${cp2x} ${pts[i].y}, ${pts[i].x} ${pts[i].y}`;
      }
      return path;
    });
  }, [data, chartWidth, getY, showLegContributions]);

  // ── Y-axis labels (5 evenly-spaced values) ──
  const yLabels = useMemo(() => {
    const count = 5;
    return Array.from({ length: count }, (_, i) =>
      chartMax - (pnlRange * i) / (count - 1),
    );    }, [chartMax, pnlRange]);

  // ── X-axis labels (6 evenly-spaced) ──
  const xLabels = useMemo(() => {
    if (!data || data.length < 2) return [];
    const count = Math.min(6, data.length);
    const step = Math.max(1, Math.floor(data.length / count));
    const labels: { index: number; price: number; label: string }[] = [];
    for (let i = 0; i < data.length; i += step) {
      const price = data[i].underlyingPrice;
      labels.push({
        index: i,
        price,
        label: price >= 1000 ? `${(price / 1000).toFixed(1)}K` : String(price),
      });
    }
    // Ensure last point is included
    const last = data.length - 1;
    if (labels.length === 0 || labels[labels.length - 1]?.index !== last) {
      const price = data[last].underlyingPrice;
      labels.push({
        index: last,
        price,
        label: price >= 1000 ? `${(price / 1000).toFixed(1)}K` : String(price),
      });
    }
    return labels;
  }, [data]);

  // ── Zero line Y position ──
  const zeroLineY = useMemo(() => getY(0), [getY]);

  // ── Crosshair data lookup ──
  const getDataAtPrice = useCallback(
    (touchX: number): PnLPoint | null => {
      if (!data || data.length < 2) return null;
      const relativeX = touchX - PADDING.left;
      const step = chartWidth / (data.length - 1);
      const index = Math.max(0, Math.min(data.length - 1, Math.round(relativeX / step)));
      return data[index];
    },
    [data, chartWidth],
  );

  // ── Price from X coordinate ──
  const getPriceFromX = useCallback(
    (touchX: number): number => {
      if (!data || data.length < 2) return 0;
      const relativeX = touchX - PADDING.left;
      const ratio = Math.max(0, Math.min(1, relativeX / chartWidth));
      const idx = ratio * (data.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.min(lo + 1, data.length - 1);
      const frac = idx - lo;
      return data[lo].underlyingPrice + (data[hi].underlyingPrice - data[lo].underlyingPrice) * frac;
    },
    [data, chartWidth],
  );

  // ── Pan responder for crosshair ──
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const x = evt.nativeEvent.locationX;
          const dataPoint = getDataAtPrice(x);
          if (dataPoint) {
            setCrosshairPrice(dataPoint.underlyingPrice);
            crosshairOpacity.value = withTiming(1, { duration: 150 });
          }
        },
        onPanResponderMove: (evt) => {
          const x = evt.nativeEvent.locationX;
          const price = getPriceFromX(x);
          setCrosshairPrice(price);
        },
        onPanResponderRelease: (evt) => {
          const x = evt.nativeEvent.locationX;
          const price = getPriceFromX(x);
          crosshairOpacity.value = withTiming(0, { duration: 200 });
          setCrosshairPrice(null);
          onPriceTap?.(Math.round(price / 25) * 25); // Snap to nearest 25
        },
        onPanResponderTerminate: () => {
          crosshairOpacity.value = withTiming(0, { duration: 200 });
          setCrosshairPrice(null);
        },
      }),
    [getDataAtPrice, getPriceFromX, crosshairOpacity, onPriceTap],
  );

  // ── Crosshair data ──
  const crosshairData = useMemo(() => {
    if (crosshairPrice === null || !data || data.length < 2) return null;
    // Find nearest data point
    let idx = 0;
    let minDist = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dist = Math.abs(data[i].underlyingPrice - crosshairPrice);
      if (dist < minDist) {
        minDist = dist;
        idx = i;
      }
    }
    return data[idx];
  }, [crosshairPrice, data]);

  // ── Crosshair animated style ──
  const crosshairStyle = useAnimatedStyle(() => ({
    opacity: crosshairOpacity.value,
  }));

  // ── Layout handler ──
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  // ── Empty state ──
  if (!data || data.length < 2) {
    return (
      <View style={[styles.container, { height }]} onLayout={onLayout}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No Strategy Data</Text>
          <Text style={styles.emptySubtitle}>
            Add legs and tap Analyze to see the P&L diagram
          </Text>
        </View>
      </View>
    );
  }

  // ── Render ──
  return (
    <Animated.View style={[styles.container, { height }, fadeStyle]} onLayout={onLayout}>
      {/* ── Metrics Summary Bar ── */}
      <View style={styles.metricsBar}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Max Profit</Text>
          <Text style={[styles.metricValue, { color: colors.marketUp }]}>
            +{formatCurrency(maxProfit, true)}
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Max Loss</Text>
          <Text style={[styles.metricValue, { color: colors.marketDown }]}>
            {formatCurrency(maxLoss, true)}
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Risk/Reward</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {maxLoss < 0
              ? `${(Math.abs(maxProfit / maxLoss)).toFixed(2)}:1`
              : '∞'}
          </Text>
        </View>
      </View>

      {/* ── SVG Chart ── */}
      <View style={styles.chartArea} {...panResponder.panHandlers}>
        <Svg width={containerWidth} height={height - 44}>
          <Defs>
            <LinearGradient id="pnlGradUp" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.marketUp} stopOpacity={0.25} />
              <Stop offset="100%" stopColor={colors.marketUp} stopOpacity={0.02} />
            </LinearGradient>
            <LinearGradient id="pnlGradDown" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.marketDown} stopOpacity={0.25} />
              <Stop offset="100%" stopColor={colors.marketDown} stopOpacity={0.02} />
            </LinearGradient>
            <ClipPath id="chartClip">
              <Rect
                x={PADDING.left}
                y={PADDING.top}
                width={chartWidth}
                height={chartHeight}
              />
            </ClipPath>
          </Defs>

          <G clipPath="url(#chartClip)">
            {/* Grid lines */}
            {yLabels.map((price, i) => (
              <Line
                key={`grid_${i}`}
                x1={PADDING.left}
                y1={getY(price)}
                x2={PADDING.left + chartWidth}
                y2={getY(price)}
                stroke={colors.borderLight}
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
            ))}

            {/* Zero line */}
            {chartMin < 0 && chartMax > 0 && (
              <Line
                x1={PADDING.left}
                y1={zeroLineY}
                x2={PADDING.left + chartWidth}
                y2={zeroLineY}
                stroke={colors.textMuted}
                strokeWidth={0.5}
                strokeDasharray="2,2"
                opacity={0.6}
              />
            )}

            {/* Area fill */}
            <Path
              d={fillPath}
              fill={isPositive ? 'url(#pnlGradUp)' : 'url(#pnlGradDown)'}
            />

            {/* Leg contribution lines (behind main line) */}
            {legPaths.map((path, i) => (
              <Path
                key={`leg_path_${i}`}
                d={path}
                stroke={legColors[i % legColors.length]}
                strokeWidth={1}
                fill="none"
                strokeDasharray="4,3"
                opacity={0.5}
              />
            ))}

            {/* Main P&L curve */}
            <Path
              d={linePath}
              stroke={isPositive ? colors.marketUp : colors.marketDown}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Breakeven markers */}
            {breakevenPoints.map((bp, i) => (
              <G key={`be_${i}`}>
                <Line
                  x1={getX(bp)}
                  y1={PADDING.top}
                  x2={getX(bp)}
                  y2={PADDING.top + chartHeight}
                  stroke={colors.primary}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                  opacity={0.6}
                />
                <Circle
                  cx={getX(bp)}
                  cy={zeroLineY}
                  r={BREAKEVEN_DOT_RADIUS}
                  fill={colors.bg}
                  stroke={colors.primary}
                  strokeWidth={2}
                />
                <SvgText
                  x={getX(bp)}
                  y={PADDING.top + chartHeight + 14}
                  fill={colors.primary}
                  fontSize={9}
                  fontFamily="System"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  BE
                </SvgText>
              </G>
            ))}

            {/* Spot price marker */}
            <G>
              <Line
                x1={getX(spotPrice)}
                y1={PADDING.top}
                x2={getX(spotPrice)}
                y2={PADDING.top + chartHeight}
                stroke={colors.warning}
                strokeWidth={1.5}
                strokeDasharray="5,3"
                opacity={0.8}
              />
              <Circle
                cx={getX(spotPrice)}
                cy={getY(maxProfit)}
                r={3}
                fill={colors.warning}
              />
              {/* Spot label only if not overlapping breakeven */}
              {breakevenPoints.every(bp => Math.abs(bp - spotPrice) > 50) && (
                <SvgText
                  x={getX(spotPrice)}
                  y={PADDING.top - 6}
                  fill={colors.warning}
                  fontSize={8}
                  fontFamily="System"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  Spot
                </SvgText>
              )}
            </G>

            {/* Crosshair */}
            {crosshairData && (
              <G>
                <Line
                  x1={getX(crosshairData.underlyingPrice)}
                  y1={PADDING.top}
                  x2={getX(crosshairData.underlyingPrice)}
                  y2={PADDING.top + chartHeight}
                  stroke={colors.textSecondary}
                  strokeWidth={CROSSHAIR_LINE_WIDTH}
                  strokeDasharray="3,3"
                />
                <Line
                  x1={PADDING.left}
                  y1={getY(crosshairData.pnl)}
                  x2={PADDING.left + chartWidth}
                  y2={getY(crosshairData.pnl)}
                  stroke={colors.textSecondary}
                  strokeWidth={CROSSHAIR_LINE_WIDTH}
                  strokeDasharray="3,3"
                />
                <Circle
                  cx={getX(crosshairData.underlyingPrice)}
                  cy={getY(crosshairData.pnl)}
                  r={5}
                  fill={crosshairData.pnl >= 0 ? colors.marketUp : colors.marketDown}
                  stroke={colors.bg}
                  strokeWidth={2}
                />
              </G>
            )}

            {/* Max profit / max loss labels */}
            <SvgText
              x={PADDING.left + 4}
              y={getY(maxProfit) - 4}
              fill={colors.marketUp}
              fontSize={8}
              fontFamily="System"
              fontWeight="600"
              opacity={0.7}
            >
              Max +{formatCurrency(maxProfit, true)}
            </SvgText>
            <SvgText
              x={PADDING.left + 4}
              y={getY(maxLoss) + 10}
              fill={colors.marketDown}
              fontSize={8}
              fontFamily="System"
              fontWeight="600"
              opacity={0.7}
            >
              Max {formatCurrency(maxLoss, true)}
            </SvgText>
          </G>

          {/* Y-axis labels (outside clip) */}            {yLabels.map((price, i) => (
            <SvgText
              key={`yl_${i}`}
              x={PADDING.left - 8}
              y={getY(price) + 3}
              fill={colors.textMuted}
              fontSize={9}
              fontFamily="System"
              textAnchor="end"
            >
              {formatCurrency(Math.round(price), true)}
            </SvgText>
          ))}

          {/* X-axis labels (outside clip) */}
          {xLabels.map(({ label, index }) => (
            <SvgText
              key={`xl_${index}`}
              x={PADDING.left + (index / (data.length - 1)) * chartWidth}
              y={height - 8}
              fill={colors.textMuted}
              fontSize={9}
              fontFamily="System"
              textAnchor="middle"
            >
              {label}
            </SvgText>
          ))}

          {/* Max Profit label on right side */}
          <SvgText
            x={PADDING.left + chartWidth - 4}
            y={getY(maxProfit) - 4}
            fill={colors.marketUp}
            fontSize={8}
            fontFamily="System"
            fontWeight="600"
            textAnchor="end"
            opacity={0.7}
          >
            +{formatCurrency(maxProfit, true)}
          </SvgText>

          {/* Max Loss label on right side */}
          <SvgText
            x={PADDING.left + chartWidth - 4}
            y={getY(maxLoss) + 10}
            fill={colors.marketDown}
            fontSize={8}
            fontFamily="System"
            fontWeight="600"
            textAnchor="end"
            opacity={0.7}
          >
            {formatCurrency(maxLoss, true)}
          </SvgText>
        </Svg>

        {/* ── Crosshair Tooltip Overlay ── */}
        {crosshairData && (
          <Animated.View
            style={[
              styles.tooltip,
              {
                left: Math.min(
                  Math.max(getX(crosshairData.underlyingPrice) - 65, 4),
                  containerWidth - 138,
                ),
                top: Math.max(getY(crosshairData.pnl) - 52, 4),
              },
              crosshairStyle,
            ]}
          >
            <Text
              style={[
                styles.tooltipPnl,
                {
                  color:
                    crosshairData.pnl >= 0 ? colors.marketUp : colors.marketDown,
                },
              ]}
            >
              {crosshairData.pnl >= 0 ? '+' : ''}
              {formatCurrency(crosshairData.pnl, true)}
            </Text>
            <Text style={styles.tooltipPrice}>
              @ ₹{Math.round(crosshairData.underlyingPrice).toLocaleString('en-IN')}
            </Text>
            {crosshairData.legPnls && crosshairData.legPnls.length > 0 && (
              <View style={styles.tooltipLegs}>
                {crosshairData.legPnls.map((legPnl, i) => (
                  <View key={`tp_${i}`} style={styles.tooltipLegRow}>
                    <View
                      style={[
                        styles.tooltipLegDot,
                        { backgroundColor: legColors[i % legColors.length] },
                      ]}
                    />
                    <Text style={styles.tooltipLegPnl}>
                      {legPnl >= 0 ? '+' : ''}
                      {formatCurrency(legPnl, true)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        )}
      </View>

      {/* ── Legend ── */}
      {legPaths.length > 0 && legLabels.length > 0 && (
        <View style={styles.legend}>
          {legLabels.map((label, i) => (
            <View key={`legend_${i}`} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: legColors[i % legColors.length] },
                ]}
              />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Instruction Text ── */}
      {legPaths.length > 0 && (
        <Text style={styles.hint}>Drag across chart for exact P&L • Tap to set strike</Text>
      )}
    </Animated.View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 48,
      gap: 8,
    },
    emptyIcon: {
      fontSize: 40,
    },
    emptyTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    emptySubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 240,
      lineHeight: 16,
    },
    // Metrics
    metricsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    metric: {
      flex: 1,
      alignItems: 'center',
    },
    metricLabel: {
      ...FONTS.regular,
      fontSize: 9,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    metricValue: {
      ...FONTS.extraBold,
      fontSize: FONTS.size.sm,
      marginTop: 2,
      fontFamily: 'monospace',
    },
    metricDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.divider,
    },
    // Chart
    chartArea: {
      flex: 1,
    },
    // Tooltip
    tooltip: {
      position: 'absolute',
      zIndex: 20,
      backgroundColor: colors.bgCardLight,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 120,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 6,
    },
    tooltipPnl: {
      ...FONTS.extraBold,
      fontSize: FONTS.size.md,
      fontFamily: 'monospace',
    },
    tooltipPrice: {
      ...FONTS.regular,
      fontSize: 9,
      color: colors.textMuted,
      marginTop: 1,
    },
    tooltipLegs: {
      marginTop: 4,
      paddingTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
      gap: 2,
    },
    tooltipLegRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    tooltipLegDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    tooltipLegPnl: {
      ...FONTS.regular,
      fontSize: 9,
      color: colors.textSecondary,
      fontFamily: 'monospace',
    },
    // Legend
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendDot: {
      width: LEGEND_DOT_SIZE,
      height: LEGEND_DOT_SIZE,
      borderRadius: LEGEND_DOT_SIZE / 2,
    },
    legendLabel: {
      ...FONTS.regular,
      fontSize: 9,
      color: colors.textMuted,
      maxWidth: 80,
    },
    // Hint
    hint: {
      ...FONTS.regular,
      fontSize: 8,
      color: colors.textMuted,
      textAlign: 'center',
      paddingBottom: SPACING.xs,
      opacity: 0.6,
    },
  });
