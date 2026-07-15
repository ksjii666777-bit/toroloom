/**
 * ============================================================================
 * Toroloom — Historical Price Trend Chart
 * ============================================================================
 *
 * A compact SVG line chart that displays the underlying asset's historical
 * price trend. Placed above the backtest section so users can see the price
 * movement before running a backtest.
 *
 * Features:
 *   - SVG line chart with gradient fill
 *   - Moving average overlay (20-period SMA)
 *   - Start/end price labels
 *   - Change % badge (green/red)
 *   - Mini grid lines for reference
 *   - Animated fade on data change
 *
 * Usage:
 *   import PriceTrendChart from '../../components/fno/PriceTrendChart';
 *   <PriceTrendChart
 *     data={historicalData}
 *     symbol="NIFTY"
 *     loading={false}
 *   />
 *
 * ============================================================================
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient, Stop, G, Circle } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';

// ──── Props ────────────────────────────────────────────────────────────────

interface PriceTrendChartProps {
  /** Array of historical OHLC data points */
  data: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
  /** Underlying symbol (e.g. "NIFTY") */
  symbol?: string;
  /** Whether data is still loading */
  loading?: boolean;
  /** Height of the chart */
  height?: number;
}

// ──── Constants ────────────────────────────────────────────────────────────

const CHART_PADDING = { top: 24, right: 16, bottom: 36, left: 16 };
const SMA_PERIOD = 20;

// ──── Component ────────────────────────────────────────────────────────────

export default function PriceTrendChart({
  data,
  symbol = '',
  loading = false,
  height = 180,
}: PriceTrendChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Compute chart metrics ──
  const chartMetrics = useMemo(() => {
    if (!data || data.length < 2) return null;

    const closes = data.map(d => d.close);
    const minPrice = Math.min(...closes);
    const maxPrice = Math.max(...closes);
    const range = maxPrice - minPrice || 1;
    const pad = range * 0.08;

    const startPrice = data[0].close;
    const endPrice = data[data.length - 1].close;
    const change = endPrice - startPrice;
    const changePercent = startPrice > 0 ? (change / startPrice) * 100 : 0;
    const isPositive = change >= 0;

    // Simple 20-period SMA
    const sma: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < SMA_PERIOD - 1) {
        sma.push(null);
      } else {
        let sum = 0;
        for (let j = i - SMA_PERIOD + 1; j <= i; j++) {
          sum += data[j].close;
        }
        sma.push(sum / SMA_PERIOD);
      }
    }

    return {
      minPrice, maxPrice,
      chartMin: minPrice - pad,
      chartMax: maxPrice + pad,
      range: (maxPrice + pad) - (minPrice - pad),
      startPrice,
      endPrice,
      change,
      changePercent,
      isPositive,
      sma,
    };
  }, [data]);

  // ── Coordinate mapping ──
  const getX = (i: number, dataLen: number, chartW: number) =>
    CHART_PADDING.left + (i / (dataLen - 1 || 1)) * (chartW - CHART_PADDING.left - CHART_PADDING.right);

  const getY = useCallback((value: number, metrics: NonNullable<typeof chartMetrics>, chartH: number) =>
    CHART_PADDING.top + ((metrics.chartMax - value) / metrics.range) * (chartH - CHART_PADDING.top - CHART_PADDING.bottom), []);

  // ── Chart dimensions (computed regardless of data state) ──
  const chartAreaWidth = 280; // Approximate — will scale with container
  const chartW = chartAreaWidth;
  const chartH = height;

  // ── Price line path (computed unconditionally) ──
  const pricePath = useMemo(() => {
    if (!chartMetrics || data.length < 2) return '';
    let path = `M ${getX(0, data.length, chartW)} ${getY(data[0].close, chartMetrics, chartH)}`;
    for (let i = 1; i < data.length; i++) {
      path += ` L ${getX(i, data.length, chartW)} ${getY(data[i].close, chartMetrics, chartH)}`;
    }
    return path;
  }, [data, chartMetrics, chartW, chartH, getY]);

  // ── SMA path ──
  const smaPath = useMemo(() => {
    if (!chartMetrics || data.length < SMA_PERIOD) return '';
    const sma = chartMetrics.sma;
    const validPoints = sma.filter((v): v is number => v !== null);
    if (validPoints.length < 2) return '';

    let path = '';
    let started = false;
    for (let i = 0; i < data.length; i++) {
      if (sma[i] === null) continue;
      if (!started) {
        path = `M ${getX(i, data.length, chartW)} ${getY(sma[i]!, chartMetrics, chartH)}`;
        started = true;
      } else {
        path += ` L ${getX(i, data.length, chartW)} ${getY(sma[i]!, chartMetrics, chartH)}`;
      }
    }
    return path;
  }, [data, chartMetrics, chartW, chartH, getY]);

  // ── Area fill path ──
  const areaPath = useMemo(() => {
    if (!pricePath) return '';
    const bottomY = CHART_PADDING.top + (chartH - CHART_PADDING.top - CHART_PADDING.bottom);
    return `${pricePath} L ${getX(data.length - 1, data.length, chartW)} ${bottomY} L ${getX(0, data.length, chartW)} ${bottomY} Z`;
  }, [pricePath, data.length, chartW, chartH]);

  // ── Y-axis labels (computed unconditionally) ──
  const yLabels = useMemo(() => {
    if (!chartMetrics) return [];
    const count = 4;
    return Array.from({ length: count }, (_, i) =>
      chartMetrics.chartMax - (chartMetrics.range * i) / (count - 1),
    );
  }, [chartMetrics]);

  // ── X-axis date labels ──
  const xDateLabels = useMemo(() => {
    if (!chartMetrics || data.length < 2) return [];
    const count = Math.min(4, data.length);
    const step = Math.max(1, Math.floor(data.length / count));
    const labels: { index: number; label: string }[] = [];
    for (let i = 0; i < data.length; i += step) {
      const d = new Date(data[i].date);
      labels.push({
        index: i,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
      });
    }
    // Ensure last is included
    const last = data.length - 1;
    if (labels.length === 0 || labels[labels.length - 1]?.index !== last) {
      const d = new Date(data[last].date);
      labels.push({ index: last, label: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    return labels;
  }, [data, chartMetrics]);

  // ── Loading state ──
  if (loading) {
    return (
      <View style={[styles.container, { borderColor: colors.border, height }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading price data...</Text>
        </View>
      </View>
    );
  }

  // ── Empty state ──
  if (!chartMetrics || data.length < 2) {
    return (
      <View style={[styles.container, { borderColor: colors.border, height }]}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📈</Text>
          <Text style={styles.emptyTitle}>No Price Data</Text>
          <Text style={styles.emptySubtitle}>
            Select a data range above to see the price trend
          </Text>
        </View>
      </View>
    );
  }

  const {
    chartMin, chartMax, range: _range,
    startPrice, endPrice, change: _change, changePercent, isPositive,
  } = chartMetrics;

  // ── Summary stats ──
  const summaryItems = [
    { label: 'Start', value: formatCurrency(startPrice, true), color: colors.textMuted },
    { label: 'End', value: formatCurrency(endPrice, true), color: colors.textMuted },
    { label: 'Change', value: `${isPositive ? '+' : ''}${changePercent.toFixed(1)}%`, color: isPositive ? colors.marketUp : colors.marketDown },
    { label: 'High', value: formatCurrency(chartMax, true), color: colors.marketUp },
    { label: 'Low', value: formatCurrency(chartMin, true), color: colors.marketDown },
  ];

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>📈</Text>
          <Text style={styles.headerTitle}>{symbol || 'Underlying'} Price Trend</Text>
        </View>
        <View style={[styles.changeBadge, { backgroundColor: isPositive ? colors.marketUp + '20' : colors.marketDown + '20' }]}>
          <Text style={[styles.changeBadgeText, { color: isPositive ? colors.marketUp : colors.marketDown }]}>
            {isPositive ? '▲' : '▼'} {Math.abs(changePercent).toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Summary Stats Row */}
      <View style={[styles.summaryRow, { borderColor: colors.divider }]}>
        {summaryItems.map((item, i) => (
          <React.Fragment key={item.label}>
            {i > 0 && <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />}
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: item.color }]}>{item.value}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{item.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* SVG Chart */}
      <View style={styles.chartArea}>
        <Svg width="100%" height={chartH - 60} viewBox={`0 0 ${chartW} ${chartH - 60}`}>
          <Defs>
            <LinearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={isPositive ? '#00C853' : '#FF1744'} stopOpacity={0.25} />
              <Stop offset="100%" stopColor={isPositive ? '#00C853' : '#FF1744'} stopOpacity={0.03} />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          {yLabels.map((price, i) => (
            <Line
              key={`grid-${i}`}
              x1={CHART_PADDING.left}
              y1={getY(price, chartMetrics, chartH - 60)}
              x2={chartW - CHART_PADDING.right}
              y2={getY(price, chartMetrics, chartH - 60)}
              stroke={colors.borderLight}
              strokeWidth={0.5}
              strokeDasharray="3,3"
              opacity={0.4}
            />
          ))}

          {/* Area fill */}
          <Path
            d={areaPath}
            fill="url(#priceGrad)"
          />

          {/* SMA line (20-period) */}
          {smaPath && (
            <Path
              d={smaPath}
              stroke={colors.warning}
              strokeWidth={1}
              fill="none"
              strokeDasharray="4,3"
              opacity={0.6}
            />
          )}

          {/* Price line */}
          <Path
            d={pricePath}
            stroke={isPositive ? colors.marketUp : colors.marketDown}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Start dot */}
          <Circle
            cx={getX(0, data.length, chartW)}
            cy={getY(data[0].close, chartMetrics, chartH - 60)}
            r={3}
            fill={colors.bg}
            stroke={isPositive ? colors.marketUp : colors.marketDown}
            strokeWidth={1.5}
          />

          {/* End dot */}
          <Circle
            cx={getX(data.length - 1, data.length, chartW)}
            cy={getY(data[data.length - 1].close, chartMetrics, chartH - 60)}
            r={4}
            fill={isPositive ? colors.marketUp : colors.marketDown}
            stroke={colors.bg}
            strokeWidth={2}
          />

          {/* Y-axis labels */}
          {yLabels.map((price, i) => (
            <SvgText
              key={`y-${i}`}
              x={CHART_PADDING.left - 4}
              y={getY(price, chartMetrics, chartH - 60) + 3}
              fill={colors.textMuted}
              fontSize={8}
              fontFamily="monospace"
              textAnchor="end"
              opacity={0.7}
            >
              {price >= 1000 ? `${(price / 1000).toFixed(1)}K` : price.toFixed(0)}
            </SvgText>
          ))}

          {/* X-axis date labels */}
          {xDateLabels.map(({ label, index }) => (
            <SvgText
              key={`x-${index}`}
              x={getX(index, data.length, chartW)}
              y={(chartH - 60) - 4}
              fill={colors.textMuted}
              fontSize={7}
              fontFamily="monospace"
              textAnchor="middle"
              opacity={0.6}
            >
              {label}
            </SvgText>
          ))}

          {/* SMA label */}
          {smaPath && (
            <SvgText
              x={chartW - CHART_PADDING.right}
              y={CHART_PADDING.top + 10}
              fill={colors.warning}
              fontSize={7}
              fontFamily="monospace"
              textAnchor="end"
              opacity={0.5}
            >
              SMA({SMA_PERIOD})
            </SvgText>
          )}
        </Svg>
      </View>

      {/* Data points count */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {data.length} trading days · {symbol}
        </Text>
        <Text style={styles.footerText}>
          {isPositive ? '📈 Uptrend' : '📉 Downtrend'}
        </Text>
      </View>
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      overflow: 'hidden',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      gap: 8,
    },
    loadingText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 4,
    },
    emptyIcon: {
      fontSize: 28,
    },
    emptyTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.text,
    },
    emptySubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 220,
    },
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerIcon: {
      fontSize: 16,
    },
    headerTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.sm,
      color: colors.text,
    },
    changeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: BORDER_RADIUS.full,
    },
    changeBadgeText: {
      ...FONTS.extraBold,
      fontSize: 10,
      fontFamily: 'monospace',
    },
    // Summary stats
    summaryRow: {
      flexDirection: 'row',
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
      gap: 1,
    },
    summaryDivider: {
      width: 1,
      height: 20,
      alignSelf: 'center',
    },
    summaryValue: {
      ...FONTS.extraBold,
      fontSize: 10,
      fontFamily: 'monospace',
    },
    summaryLabel: {
      ...FONTS.regular,
      fontSize: 7,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    // Chart
    chartArea: {
      paddingVertical: SPACING.xs,
    },
    // Footer
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
    },
    footerText: {
      ...FONTS.regular,
      fontSize: 8,
      color: colors.textMuted,
      fontFamily: 'monospace',
      opacity: 0.6,
    },
  });
