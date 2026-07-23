/**
 * ============================================================================
 * Toroloom — P&L Overview Widget
 * ============================================================================
 *
 * Displays real-time portfolio P&L with a mini sparkline chart, total
 * return, day change, and comparison of realized vs unrealized gains.
 *
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { usePortfolioAnalyticsStore } from '../../store/portfolioAnalyticsStore';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import { FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { WidgetSize } from '../../types/widgets';

interface PnLWidgetProps {
  size: WidgetSize;
}

export default function PnLWidget({ size }: PnLWidgetProps) {
  const { colors } = useTheme();
  const { metrics, pnlHistory } = usePortfolioAnalyticsStore(s => s.getAnalytics());
  const screenWidth = Dimensions.get('window').width;

  // ── Sparkline path ──────────────────────────────────────────────
  const sparklineData = useMemo(() => {
    if (!pnlHistory || pnlHistory.length < 2) return [];
    const points = pnlHistory.map(p => p.cumulativePnl);
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    return points.map((v, i) => ({
      x: i / (points.length - 1),
      y: 1 - (v - min) / range,
    }));
  }, [pnlHistory]);

  const chartWidth = size === 'large' ? screenWidth - 96 : size === 'medium' ? screenWidth - 96 : 80;
  const chartHeight = size === 'large' ? 100 : 50;

  const sparklinePath = useMemo(() => {
    if (sparklineData.length < 2) return '';
    return sparklineData.map((p, i) => {
      const x = p.x * chartWidth;
      const y = p.y * chartHeight;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [sparklineData, chartWidth, chartHeight]);

  const isPositive = metrics.totalReturn >= 0;
  const pnlColor = isPositive ? '#00E676' : '#FF5252';

  // ── Small: compact metric only ──────────────────────────────────
  if (size === 'small') {
    return (
      <View style={styles.smallContainer}>
        <Text style={[styles.smallValue, { color: pnlColor }]}>
          {formatCurrency(metrics.totalReturn, true)}
        </Text>
        <Text style={[styles.smallPercent, { color: pnlColor }]}>
          {formatPercent(metrics.totalReturnPercent)}
        </Text>
        <View style={styles.smallDayRow}>
          <Text style={[styles.smallDayLabel, { color: colors.textMuted }]}>Day</Text>
          <Text style={[styles.smallDayValue, { color: metrics.dayChange >= 0 ? '#00E676' : '#FF5252' }]}>
            {formatCurrency(metrics.dayChange, true)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top row: Total Return + Day Change */}
      <View style={styles.topRow}>
        <View style={styles.metricBlock}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Total Return</Text>
          <Text style={[styles.metricValue, { color: pnlColor }]}>
            {formatCurrency(metrics.totalReturn, true)}
          </Text>
          <Text style={[styles.metricSub, { color: pnlColor }]}>
            {formatPercent(metrics.totalReturnPercent)}
          </Text>
        </View>
        <View style={styles.metricBlockRight}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Day Change</Text>
          <Text style={[styles.metricValue, { color: metrics.dayChange >= 0 ? '#00E676' : '#FF5252' }]}>
            {formatCurrency(metrics.dayChange, true)}
          </Text>
          <Text style={[styles.metricSub, { color: metrics.dayChange >= 0 ? '#00E676' : '#FF5252' }]}>
            {formatPercent(metrics.dayChangePercent)}
          </Text>
        </View>
      </View>

      {/* Sparkline Chart */}
      {sparklineData.length >= 2 && (
        <View style={styles.chartWrap}>
          <Svg width={chartWidth} height={chartHeight}>
            <Defs>
              <LinearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={pnlColor} stopOpacity="0.3" />
                <Stop offset="1" stopColor={pnlColor} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {/* Area fill */}
            {sparklineData.length >= 2 && (
              <Path
                d={`${sparklinePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`}
                fill="url(#pnlFill)"
              />
            )}
            {/* Line */}
            <Path
              d={sparklinePath}
              stroke={pnlColor}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      )}

      {/* Bottom: Realized vs Unrealized (medium+) */}
      {size === 'large' && (
        <View style={styles.breakdown}>
          <View style={styles.breakItem}>
            <View style={[styles.breakDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={[styles.breakLabel, { color: colors.textMuted }]}>Realized</Text>
            <Text style={[styles.breakValue, { color: colors.text }]}>
              {formatCurrency(metrics.realizedPnl, true)}
            </Text>
          </View>
          <View style={styles.breakItem}>
            <View style={[styles.breakDot, { backgroundColor: '#8B5CF6' }]} />
            <Text style={[styles.breakLabel, { color: colors.textMuted }]}>Unrealized</Text>
            <Text style={[styles.breakValue, { color: colors.text }]}>
              {formatCurrency(metrics.unrealizedPnl, true)}
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
  // Small
  smallContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  smallValue: {
    ...FONTS.bold,
    fontSize: 20,
  },
  smallPercent: {
    ...FONTS.semiBold,
    fontSize: 13,
  },
  smallDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  smallDayLabel: {
    ...FONTS.regular,
    fontSize: 10,
  },
  smallDayValue: {
    ...FONTS.semiBold,
    fontSize: 11,
  },
  // Medium / Large
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricBlock: {
    alignItems: 'flex-start',
  },
  metricBlockRight: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    ...FONTS.regular,
    fontSize: 10,
    marginBottom: 1,
  },
  metricValue: {
    ...FONTS.bold,
    fontSize: 18,
  },
  metricSub: {
    ...FONTS.semiBold,
    fontSize: 11,
    marginTop: 1,
  },
  chartWrap: {
    alignItems: 'center',
    marginVertical: 4,
  },
  breakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  breakItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breakDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  breakLabel: {
    ...FONTS.regular,
    fontSize: 10,
  },
  breakValue: {
    ...FONTS.semiBold,
    fontSize: 11,
  },
});
