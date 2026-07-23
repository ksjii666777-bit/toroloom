/**
 * ============================================================================
 * Toroloom — Performance Chart Widget
 * ============================================================================
 *
 * Displays portfolio value over time as an interactive area chart.
 * Features:
 *  - SVG area chart with gradient fill
 *  - Time range selector: 1W / 1M / 3M / 1Y / ALL
 *  - Key metrics: current value, total return, max drawdown, best trade
 *  - Responsive across small/medium/large sizes
 *
 * Data source: portfolioAnalyticsStore → pnlHistory (daily portfolio value)
 *              + pnlHistoryStream (real-time streaming points)
 *
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { usePortfolioAnalyticsStore } from '../../store/portfolioAnalyticsStore';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { FONTS, BORDER_RADIUS, SPACING } from '../../constants/theme';
import type { WidgetSize } from '../../types/widgets';

// ──── Time Range Options ─────────────────────────────────────────────────

type TimeRange = '1W' | '1M' | '3M' | '1Y' | 'ALL';

const RANGE_OPTIONS: { key: TimeRange; label: string; days: number }[] = [
  { key: '1W', label: '1W', days: 7 },
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: 'ALL', label: 'ALL', days: Infinity },
];

// ──── Props ──────────────────────────────────────────────────────────────

interface PerformanceChartWidgetProps {
  size: WidgetSize;
}

// ──── Component ──────────────────────────────────────────────────────────

export default function PerformanceChartWidget({ size }: PerformanceChartWidgetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { metrics, pnlHistory } = usePortfolioAnalyticsStore(s => s.getAnalytics());
  const pnlHistoryStream = usePortfolioAnalyticsStore(s => s.pnlHistoryStream);
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1Y');

  const screenWidth = Dimensions.get('window').width;

  // ── Merge pnlHistory + stream, then filter by range ──────────────
  const chartData = useMemo(() => {
    // Combine historical + streaming data, deduplicate by date
    const merged = [...pnlHistory];
    const dateSet = new Set(pnlHistory.map(p => p.date));
    for (const point of pnlHistoryStream) {
      const streamDate = point.date.slice(0, 10);
      if (!dateSet.has(streamDate)) {
        merged.push({
          date: streamDate,
          value: point.value,
          cumulativePnl: point.cumulativePnl,
        });
      }
    }

    // Sort by date ascending
    merged.sort((a, b) => a.date.localeCompare(b.date));

    // Filter by time range
    const range = RANGE_OPTIONS.find(r => r.key === selectedRange)!;
    if (range.days < Infinity) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - range.days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      return merged.filter(p => p.date >= cutoffStr);
    }
    return merged;
  }, [pnlHistory, pnlHistoryStream, selectedRange]);

  // ── Chart dimensions ──────────────────────────────────────────────
  const chartWidth = size === 'large'
    ? screenWidth - 96
    : size === 'medium'
      ? screenWidth - 96
      : 80;
  const chartHeight = size === 'large' ? 120 : size === 'medium' ? 72 : 40;

  // ── Compute SVG path ──────────────────────────────────────────────
  const { path, areaPath, minValue, maxValue, latestValue, firstValue } = useMemo(() => {
    if (chartData.length < 2) {
      return { path: '', areaPath: '', minValue: 0, maxValue: 0, latestValue: 0, firstValue: 0 };
    }

    const values = chartData.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => ({
      x: (i / (values.length - 1)) * chartWidth,
      y: chartHeight - ((v - min) / range) * chartHeight,
    }));

    const linePath = points.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ');

    const area = `${linePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

    return {
      path: linePath,
      areaPath: area,
      minValue: min,
      maxValue: max,
      latestValue: values[values.length - 1],
      firstValue: values[0],
    };
  }, [chartData, chartWidth, chartHeight]);

  const isPositive = latestValue >= firstValue;
  const chartColor = isPositive ? '#00E676' : '#FF5252';

  // ── Additional performance metrics ───────────────────────────────
  const perfMetrics = useMemo(() => ({
    maxDrawdownPercent: metrics.maxDrawdownPercent,
    bestTrade: metrics.bestTrade,
    totalReturn: metrics.totalReturn,
  }), [metrics]);

  // ── Small: compact chart + value ─────────────────────────────────
  if (size === 'small') {
    return (
      <View style={styles.smallContainer}>
        <Text style={[styles.smallValue, { color: isPositive ? '#00E676' : '#FF5252' }]}>
          {formatCurrency(latestValue, true)}
        </Text>
        <View style={styles.smallChart}>
          {chartData.length >= 2 && (
            <Svg width={chartWidth} height={chartHeight}>
              <Path
                d={path}
                stroke={chartColor}
                strokeWidth={1.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </View>
        <Text style={[styles.smallRange, { color: colors.textMuted }]}>
          {selectedRange}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Time range selector */}
      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map(opt => {
          const isActive = opt.key === selectedRange;
          return (
            <Pressable
              key={opt.key}
              style={[
                styles.rangePill,
                {
                  backgroundColor: isActive ? chartColor + '20' : 'transparent',
                  borderColor: isActive ? chartColor : colors.border,
                },
              ]}
              onPress={() => setSelectedRange(opt.key)}
            >
              <Text style={[
                styles.rangeText,
                { color: isActive ? chartColor : colors.textMuted },
              ]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Area Chart */}
      {chartData.length >= 2 && (
        <View style={styles.chartWrap}>
          <Svg width={chartWidth} height={chartHeight}>
            <Defs>
              <LinearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={chartColor} stopOpacity="0.3" />
                <Stop offset="1" stopColor={chartColor} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {/* Area fill */}
            <Path d={areaPath} fill="url(#perfFill)" />
            {/* Line */}
            <Path
              d={path}
              stroke={chartColor}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Latest dot */}
            {chartData.length >= 2 && (
              <Circle
                cx={chartWidth}
                cy={chartHeight - ((latestValue - minValue) / (maxValue - minValue || 1)) * chartHeight}
                r={3}
                fill={chartColor}
              />
            )}
          </Svg>
        </View>
      )}

      {/* Empty state */}
      {chartData.length < 2 && (
        <View style={styles.emptyChart}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {pnlHistory.length === 0 ? t('performanceChart.emptyHoldings') : t('performanceChart.insufficientData')}
          </Text>
        </View>
      )}

      {/* Metrics row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricBlock}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{t('performanceChart.portfolioValue')}</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>
            {formatCurrency(latestValue, true)}
          </Text>
        </View>
        <View style={styles.metricBlockRight}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{t('performanceChart.totalReturn')}</Text>
          <Text style={[styles.metricValue, { color: isPositive ? '#00E676' : '#FF5252' }]}>
            {formatCurrency(perfMetrics.totalReturn, true)}
          </Text>
        </View>
      </View>

      {/* Extended metrics (large only) */}
      {size === 'large' && (
        <View style={styles.extendedMetrics}>
          <View style={styles.extItem}>
            <Text style={[styles.extLabel, { color: colors.textMuted }]}>{t('performanceChart.maxDrawdown')}</Text>
            <Text style={[styles.extValue, { color: colors.text }]}>
              {formatPercent(perfMetrics.maxDrawdownPercent)}
            </Text>
          </View>
          <View style={styles.extItem}>
            <Text style={[styles.extLabel, { color: colors.textMuted }]}>{t('performanceChart.bestTrade')}</Text>
            <Text style={[styles.extValue, { color: '#00E676' }]}>
              {formatCurrency(perfMetrics.bestTrade, true)}
            </Text>
          </View>
          <View style={styles.extItem}>
            <Text style={[styles.extLabel, { color: colors.textMuted }]}>{t('performanceChart.range')}</Text>
            <Text style={[styles.extValue, { color: colors.text }]}>
              {formatCurrency(minValue, true)} – {formatCurrency(maxValue, true)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  // ── Small ──
  smallContainer: {
    alignItems: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  smallValue: {
    ...FONTS.bold,
    fontSize: 20,
  },
  smallChart: {
    alignItems: 'center',
  },
  smallRange: {
    ...FONTS.regular,
    fontSize: 9,
  },

  // ── Range Selector ──
  rangeRow: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  rangePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  rangeText: {
    ...FONTS.semiBold,
    fontSize: 10,
  },

  // ── Chart ──
  chartWrap: {
    alignItems: 'center',
    marginVertical: 4,
  },
  emptyChart: {
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyText: {
    ...FONTS.regular,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },

  // ── Metrics Row ──
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  metricBlock: {
    alignItems: 'flex-start',
  },
  metricBlockRight: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    ...FONTS.regular,
    fontSize: 9,
    marginBottom: 1,
  },
  metricValue: {
    ...FONTS.bold,
    fontSize: 16,
  },

  // ── Extended Metrics (large) ──
  extendedMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  extItem: {
    alignItems: 'center',
    flex: 1,
  },
  extLabel: {
    ...FONTS.regular,
    fontSize: 9,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  extValue: {
    ...FONTS.semiBold,
    fontSize: 11,
  },
});
