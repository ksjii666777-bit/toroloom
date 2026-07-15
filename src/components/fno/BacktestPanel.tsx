/**
 * ============================================================================
 * Toroloom — Strategy Backtest Results Panel
 * ============================================================================
 *
 * Displays backtest metrics and equity curve for a simulated options strategy:
 *   - Summary card: total P&L, return %, win rate
 *   - Metrics grid: Sharpe, Sortino, Calmar, Profit Factor, Max DD
 *   - Equity curve mini-chart (SVG line)
 *   - Risk score / rating
 *
 * Usage:
 *   import BacktestPanel from '../../components/fno/BacktestPanel';
 *   <BacktestPanel result={backtestResult} loading={false} />
 *
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient, Stop, G, Circle, Rect } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import RiskRewardCharts from './RiskRewardCharts';
import type { BacktestResult } from '../../services/backtestEngine';

// ──── Props ────────────────────────────────────────────────────────────────

interface BacktestPanelProps {
  /** Backtest result data */
  result: BacktestResult | null;
  /** Whether backtest is running */
  loading?: boolean;
  /** Called when user wants to re-run the backtest */
  onRerun?: () => void;
  /** Called when user wants to close/hide the panel */
  onClose?: () => void;
}

// ──── Metric Display Helpers ───────────────────────────────────────────────

interface MetricItem {
  label: string;
  value: string;
  color: string;
  icon: string;
}

function getMetricColor(value: number, isInverted: boolean = false): string {
  if (value === 0) return '#6E6E9A';
  if (isInverted) return value < 0 ? '#00C853' : '#FF1744';
  return value > 0 ? '#00C853' : '#FF1744';
}

function getShorthand(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_00_000) return `${(value / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (abs >= 1) return value.toFixed(0);
  return value.toFixed(2);
}

function getRiskLabel(sharpe: number, maxDD: number): { label: string; color: string } {
  if (sharpe >= 2 && maxDD < 15) return { label: 'Excellent', color: '#00C853' };
  if (sharpe >= 1 && maxDD < 25) return { label: 'Good', color: '#4CAF50' };
  if (sharpe >= 0.5 && maxDD < 35) return { label: 'Fair', color: '#FFC107' };
  if (sharpe > 0) return { label: 'Poor', color: '#FF9800' };
  return { label: 'High Risk', color: '#FF1744' };
}

// ──── Component ────────────────────────────────────────────────────────────

export default function BacktestPanel({
  result,
  loading = false,
  onRerun,
  onClose,
}: BacktestPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Equity Curve Mini Chart ──
  const renderEquityCurve = () => {
    if (!result || result.equityCurve.length < 2) return null;

    const curve = result.equityCurve;
    const chartW = 280;
    const chartH = 80;
    const pad = { top: 8, bottom: 16, left: 8, right: 8 };

    const values = curve.map(p => p.cumulativePnl);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0.01);
    const range = (max - min) || 0.01;

    const getX = (i: number) => pad.left + (i / (curve.length - 1)) * (chartW - pad.left - pad.right);
    const getY = (v: number) => pad.top + ((max - v) / range) * (chartH - pad.top - pad.bottom);

    const zeroY = getY(0);
    let path = `M ${getX(0)} ${getY(values[0])}`;
    for (let i = 1; i < curve.length; i++) {
      path += ` L ${getX(i)} ${getY(values[i])}`;
    }

    // Area fill
    const areaPath = `${path} L ${getX(curve.length - 1)} ${zeroY} L ${getX(0)} ${zeroY} Z`;

    // Determine if overall positive
    const isPositive = values[values.length - 1] >= 0;

    return (
      <View style={styles.equityChartContainer}>
        <Text style={styles.equityChartTitle}>Equity Curve</Text>
        <Svg width={chartW} height={chartH}>
          {/* Zero line */}
          {min < 0 && max > 0 && (
            <Line
              x1={pad.left} y1={zeroY} x2={chartW - pad.right} y2={zeroY}
              stroke={colors.textMuted} strokeWidth={0.5} strokeDasharray="2,2" opacity={0.3}
            />
          )}
          {/* Area fill */}
          <Defs>
            <LinearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={isPositive ? '#00C853' : '#FF1744'} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={isPositive ? '#00C853' : '#FF1744'} stopOpacity="0.05" />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill="url(#eqGrad)" />
          {/* Equity curve line */}
          <Path
            d={path}
            stroke={isPositive ? '#00C853' : '#FF1744'}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
          {/* Start dot */}
          <Circle cx={getX(0)} cy={getY(values[0])} r={2} fill={colors.textMuted} />
          {/* End dot */}
          <Circle cx={getX(curve.length - 1)} cy={getY(values[values.length - 1])} r={3}
            fill={isPositive ? '#00C853' : '#FF1744'} />
          {/* Labels */}
          <SvgText x={chartW / 2} y={chartH - 2}
            fill={colors.textMuted} fontSize={7} fontFamily="monospace" textAnchor="middle">
            {curve.length} trading days
          </SvgText>
        </Svg>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { borderColor: colors.border }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Running backtest...</Text>
        </View>
      </View>
    );
  }

  if (!result) {
    return (
      <Pressable style={({pressed}) => [[styles.runContainer, { borderColor: colors.primary + '40' }], {opacity: pressed ? 0.7 : 1}]} onPress={onRerun}>
        <Text style={styles.runIcon}>🔬</Text>
        <Text style={styles.runTitle}>Backtest Strategy</Text>
        <Text style={styles.runSubtitle}>Simulate against historical data to see win rate, Sharpe ratio & drawdown</Text>
        <View style={[styles.runButton, { backgroundColor: colors.primary }]}>
          <Text style={styles.runButtonText}>Run Backtest</Text>
        </View>
      </Pressable>
    );
  }

  const { metrics } = result;
  const isProfitable = metrics.totalPnl > 0;
  const riskLabel = getRiskLabel(metrics.sharpeRatio, metrics.maxDrawdownPercent);

  const summaryMetrics: MetricItem[] = [
    { label: 'Total P&L', value: formatCurrency(metrics.totalPnl, true), color: getMetricColor(metrics.totalPnl), icon: '💰' },
    { label: 'Return', value: `${metrics.totalReturnPercent.toFixed(1)}%`, color: getMetricColor(metrics.totalReturnPercent), icon: '📈' },
    { label: 'Win Rate', value: `${metrics.winRate.toFixed(0)}%`, color: getMetricColor(metrics.winRate), icon: '🎯' },
  ];

  const detailMetrics: MetricItem[] = [
    { label: 'Sharpe', value: metrics.sharpeRatio.toFixed(2), color: getMetricColor(metrics.sharpeRatio), icon: '📊' },
    { label: 'Sortino', value: metrics.sortinoRatio.toFixed(2), color: getMetricColor(metrics.sortinoRatio), icon: '📉' },
    { label: 'Profit Factor', value: metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2), color: getMetricColor(metrics.profitFactor), icon: '⚡' },
    { label: 'Max DD', value: `${metrics.maxDrawdownPercent.toFixed(1)}%`, color: getMetricColor(-metrics.maxDrawdownPercent, true), icon: '🔻' },
    { label: 'Calmar', value: metrics.calmarRatio.toFixed(2), color: getMetricColor(metrics.calmarRatio), icon: '🏔️' },
    { label: 'Avg Win', value: getShorthand(metrics.avgWin), color: getMetricColor(metrics.avgWin), icon: '✅' },
    { label: 'Avg Loss', value: getShorthand(metrics.avgLoss), color: getMetricColor(-metrics.avgLoss), icon: '❌' },
    { label: 'Best/Worst', value: `${getShorthand(metrics.bestPeriod)}/${getShorthand(metrics.worstPeriod)}`, color: colors.textMuted, icon: '📌' },
  ];

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🔬</Text>
          <Text style={styles.headerTitle}>Backtest Results</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={onRerun} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>↻</Text>
          </Pressable>
          {onClose && (
            <Pressable onPress={onClose} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Risk badge + POP badge */}
      <View style={styles.badgeRow}>
        <View style={[styles.riskBadge, { backgroundColor: riskLabel.color + '20' }]}>
          <Text style={[styles.riskBadgeText, { color: riskLabel.color }]}>
            Risk: {riskLabel.label}
          </Text>
        </View>
        <View style={[styles.popBadge, {
          backgroundColor: metrics.probabilityOfProfit >= 70 ? '#00C85320'
            : metrics.probabilityOfProfit >= 50 ? '#FFC10720'
            : '#FF174420',
        }]}>
          <Text style={[styles.popBadgeText, {
            color: metrics.probabilityOfProfit >= 70 ? '#00C853'
              : metrics.probabilityOfProfit >= 50 ? '#FFC107'
              : '#FF1744',
          }]}>
            🎯 POP {metrics.probabilityOfProfit.toFixed(0)}%
          </Text>
        </View>
      </View>

      {/* Summary row */}
      <View style={[styles.summaryRow, { backgroundColor: isProfitable ? '#00C85310' : '#FF174410' }]}>
        {summaryMetrics.map((m, _i) => (
          <View key={m.label} style={styles.summaryItem}>
            <Text style={styles.summaryIcon}>{m.icon}</Text>
            <Text style={[styles.summaryValue, { color: m.color }]}>{m.value}</Text>
            <Text style={styles.summaryLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      {/* Detail metrics grid */}
      <View style={styles.metricsGrid}>
        {detailMetrics.map((m, _i) => (
          <View key={m.label} style={[styles.metricCell, { backgroundColor: colors.bgCard + '60' }]}>
            <Text style={styles.metricIcon}>{m.icon}</Text>
            <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
            <Text style={styles.metricLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      {/* Equity curve */}
      {renderEquityCurve()}

      {/* Risk / Reward Charts */}
      <RiskRewardCharts metrics={metrics} />

      {/* Period stats */}
      <View style={styles.periodRow}>
        <Text style={styles.periodText}>
          Periods: {metrics.totalPeriods} | Win: {metrics.winningPeriods} / Loss: {metrics.losingPeriods}
        </Text>
        <Text style={styles.periodText}>
          Std Dev: ₹{getShorthand(metrics.returnStdDev)}
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
    // Loading
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      gap: 10,
    },
    loadingText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
    },
    // Run prompt (empty state)
    runContainer: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: SPACING.lg,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderRadius: BORDER_RADIUS.lg,
      gap: 6,
    },
    runIcon: {
      fontSize: 28,
    },
    runTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    runSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 16,
    },
    runButton: {
      paddingHorizontal: 24,
      paddingVertical: 8,
      borderRadius: BORDER_RADIUS.full,
      marginTop: 4,
    },
    runButtonText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.white,
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
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 4,
    },
    headerBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.bgSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerBtnText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    // Badge row
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginLeft: SPACING.md,
      marginBottom: SPACING.sm,
    },
    // Risk badge
    riskBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: BORDER_RADIUS.full,
    },
    riskBadgeText: {
      ...FONTS.semiBold,
      fontSize: 9,
      textTransform: 'uppercase',
    },
    // POP badge
    popBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: BORDER_RADIUS.full,
    },
    popBadgeText: {
      ...FONTS.extraBold,
      fontSize: 10,
      fontFamily: 'monospace',
    },
    // Summary row
    summaryRow: {
      flexDirection: 'row',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      marginHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: SPACING.sm,
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    summaryIcon: {
      fontSize: 16,
    },
    summaryValue: {
      ...FONTS.extraBold,
      fontSize: FONTS.size.lg,
      fontFamily: 'monospace',
    },
    summaryLabel: {
      ...FONTS.regular,
      fontSize: 9,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    // Detail metrics grid
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: SPACING.md,
      gap: 6,
      marginBottom: SPACING.sm,
    },
    metricCell: {
      width: '23%',
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: BORDER_RADIUS.sm,
      gap: 2,
    },
    metricIcon: {
      fontSize: 12,
    },
    metricValue: {
      ...FONTS.bold,
      fontSize: 10,
      fontFamily: 'monospace',
    },
    metricLabel: {
      ...FONTS.regular,
      fontSize: 7,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    // Equity curve
    equityChartContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
    },
    equityChartTitle: {
      ...FONTS.regular,
      fontSize: 9,
      color: colors.textMuted,
      width: 60,
    },
    // Period stats
    periodRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
    },
    periodText: {
      ...FONTS.regular,
      fontSize: 8,
      color: colors.textMuted,
      fontFamily: 'monospace',
    },
  });
