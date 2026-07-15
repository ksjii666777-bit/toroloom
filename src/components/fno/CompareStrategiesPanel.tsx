/**
 * ============================================================================
 * Toroloom — Strategy Comparison Panel
 * ============================================================================
 *
 * Side-by-side comparison of up to 3 strategies with:
 *   - Metrics comparison table (Win Rate, Sharpe, PF, Max DD, P&L)
 *   - Equity curve overlay (SVG multi-line chart)
 *   - Best strategy highlighting
 *   - Bar chart visual comparison for key metrics
 *
 * Usage:
 *   import CompareStrategiesPanel from '../../components/fno/CompareStrategiesPanel';
 *   <CompareStrategiesPanel slots={comparisonSlots} onRemove={handleRemove} />
 *
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient, Stop, Circle, Rect } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import type { StrategyComparisonSlot } from '../../store/fnoStore';

// ──── Props ────────────────────────────────────────────────────────────────

interface CompareStrategiesPanelProps {
  slots: StrategyComparisonSlot[];
  onRemove?: (index: number) => void;
  onClear?: () => void;
}

// ──── Metric Definition ────────────────────────────────────────────────────

interface CompareMetric {
  key: string;
  label: string;
  icon: string;
  getValue: (slot: StrategyComparisonSlot) => number;
  format: (v: number) => string;
  higherIsBetter: boolean;
  color: (v: number) => string;
}

const METRICS: CompareMetric[] = [
  { key: 'totalPnl', label: 'Total P&L', icon: '💰', getValue: s => s.backtestResult.totalPnl, format: v => formatCurrency(v, true), higherIsBetter: true, color: v => v >= 0 ? '#00C853' : '#FF1744' },
  { key: 'return', label: 'Return', icon: '📈', getValue: s => s.backtestResult.totalReturnPercent, format: v => `${v.toFixed(1)}%`, higherIsBetter: true, color: v => v >= 0 ? '#00C853' : '#FF1744' },
  { key: 'winRate', label: 'Win Rate', icon: '🎯', getValue: s => s.backtestResult.winRate, format: v => `${v.toFixed(0)}%`, higherIsBetter: true, color: v => v >= 50 ? '#00C853' : '#FFC107' },
  { key: 'sharpe', label: 'Sharpe', icon: '📊', getValue: s => s.backtestResult.sharpeRatio, format: v => v.toFixed(2), higherIsBetter: true, color: v => v >= 1 ? '#00C853' : v >= 0 ? '#FFC107' : '#FF1744' },
  { key: 'profitFactor', label: 'PF', icon: '⚡', getValue: s => s.backtestResult.profitFactor, format: v => v === Infinity ? '∞' : v.toFixed(2), higherIsBetter: true, color: v => v >= 1.5 ? '#00C853' : v >= 1 ? '#FFC107' : '#FF1744' },
  { key: 'maxDD', label: 'Max DD', icon: '🔻', getValue: s => s.backtestResult.maxDrawdownPercent, format: v => `${v.toFixed(1)}%`, higherIsBetter: false, color: v => v <= 15 ? '#00C853' : v <= 30 ? '#FFC107' : '#FF1744' },
  { key: 'calmar', label: 'Calmar', icon: '🏔️', getValue: s => s.backtestResult.calmarRatio, format: v => v.toFixed(2), higherIsBetter: true, color: v => v >= 1 ? '#00C853' : v >= 0 ? '#FFC107' : '#FF1744' },
  { key: 'sortino', label: 'Sortino', icon: '📉', getValue: s => s.backtestResult.sortinoRatio, format: v => v.toFixed(2), higherIsBetter: true, color: v => v >= 1 ? '#00C853' : v >= 0 ? '#FFC107' : '#FF1744' },
];

// ──── Component ────────────────────────────────────────────────────────────

export default function CompareStrategiesPanel({
  slots,
  onRemove,
  onClear,
}: CompareStrategiesPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const hasData = slots.length >= 2;

  // Find best strategy per metric
  const bestIndices = useMemo(() => {
    if (!hasData) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const metric of METRICS) {
      const values = slots.map(s => metric.getValue(s));
      const bestIdx = metric.higherIsBetter
        ? values.indexOf(Math.max(...values))
        : values.indexOf(Math.min(...values));
      map.set(metric.key, bestIdx);
    }
    return map;
  }, [slots, hasData]);

  // ── Equity Curve Overlay ──
  const renderEquityOverlay = () => {
    if (slots.length === 0) return null;

    const chartW = 300;
    const chartH = 120;
    const pad = { top: 12, bottom: 20, left: 8, right: 8 };

    // Gather all data points across all strategies
    const allCurves = slots.map(s => s.backtestResult.equityCurve.map(p => p.cumulativePnl));
    const allValues = allCurves.flat();
    if (allValues.length < 2) return null;

    const min = Math.min(...allValues, 0);
    const max = Math.max(...allValues, 0.01);
    const range = (max - min) || 0.01;

    const getY = (v: number) => pad.top + ((max - v) / range) * (chartH - pad.top - pad.bottom);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Equity Curve Comparison</Text>
        <Svg width={chartW} height={chartH}>
          {/* Zero line */}
          {min < 0 && max > 0 && (
            <Line
              x1={pad.left} y1={getY(0)} x2={chartW - pad.right} y2={getY(0)}
              stroke={colors.textMuted} strokeWidth={0.5} strokeDasharray="2,2" opacity={0.3}
            />
          )}
          {slots.map((slot, _slotIdx) => {
            const curve = slot.backtestResult.equityCurve;
            if (curve.length < 2) return null;
            const values = curve.map(p => p.cumulativePnl);
            const getX = (i: number) => pad.left + (i / (curve.length - 1)) * (chartW - pad.left - pad.right);

            let path = '';
            for (let i = 0; i < values.length; i++) {
              path += i === 0 ? `M ${getX(i)} ${getY(values[i])}` : ` L ${getX(i)} ${getY(values[i])}`;
            }

            return (
              <Path
                key={slot.id}
                d={path}
                stroke={slot.color}
                strokeWidth={1.5}
                fill="none"
                strokeLinecap="round"
                opacity={0.85}
              />
            );
          })}

          {/* Legend */}
          {slots.map((slot, i) => (
            <React.Fragment key={slot.id}>
              <Rect x={pad.left + 4} y={pad.top + 4 + i * 14} width={8} height={8} rx={2} fill={slot.color} />
              <SvgText x={pad.left + 16} y={pad.top + 12 + i * 14}
                fill={colors.textMuted} fontSize={8} fontFamily="monospace">
                {slot.name.length > 12 ? slot.name.slice(0, 12) + '…' : slot.name}
              </SvgText>
            </React.Fragment>
          ))}
        </Svg>
      </View>
    );
  };

  // ── Simple Bar Chart for a Metric ──
  const renderBarChart = (metric: CompareMetric) => {
    const values = slots.map(s => metric.getValue(s));
    const absMax = Math.max(...values.map(Math.abs), 0.01);
    const barMax = 60;

    return (
      <View key={metric.key} style={styles.barRow}>
        <Text style={styles.barIcon}>{metric.icon}</Text>
        <View style={styles.barContainer}>
          {slots.map((slot, i) => {
            const val = values[i];
            const barWidth = Math.abs(val) / absMax * barMax;
            const isPositive = val >= 0;
            const isBarHigherBetter = (isPositive && metric.higherIsBetter) || (!isPositive && !metric.higherIsBetter);

            return (
              <View key={slot.id} style={styles.barItem}>
                <View style={styles.barLabelRow}>
                  <View style={[styles.barColorDot, { backgroundColor: slot.color }]} />
                  <Text style={[styles.barName, { color: colors.textMuted }]} numberOfLines={1}>
                    {slot.name}
                  </Text>
                  <Text style={[styles.barValue, { color: metric.color(val) }]}>
                    {metric.format(val)}
                  </Text>
                  {bestIndices.get(metric.key) === i && (
                    <Text style={styles.bestBadge}>👑</Text>
                  )}
                </View>
                <View style={[styles.barTrack, { backgroundColor: colors.divider }]}>
                  <View style={[
                    styles.barFill,
                    {
                      width: Math.max(4, barWidth),
                      backgroundColor: isBarHigherBetter ? '#00C853' : '#FF1744',
                      opacity: 0.8,
                    },
                  ]} />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>⚖️</Text>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Compare Strategies</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {slots.length} of {3} slots filled
            </Text>
          </View>
        </View>
        {slots.length > 0 && (
          <Pressable onPress={onClear} style={styles.clearBtn}>
            <Text style={[styles.clearBtnText, { color: colors.danger }]}>Clear All</Text>
          </Pressable>
        )}
      </View>

      {slots.length < 2 ? (
        /* Not enough strategies */
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Add {2 - slots.length} More Strategy{2 - slots.length !== 1 ? 'ies' : 'y'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Run a backtest on a strategy, then tap "Add to Comparison" to save it for side-by-side analysis.
          </Text>
          {slots.length === 1 && (
            <View style={[styles.slotPreview, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={[styles.slotColorDot, { backgroundColor: slots[0].color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.slotName, { color: colors.text }]}>{slots[0].name}</Text>
                <Text style={[styles.slotMeta, { color: colors.textMuted }]}>
                  {slots[0].legSummary} · Win Rate {slots[0].backtestResult.winRate.toFixed(0)}%
                </Text>
              </View>
              {onRemove && (
                <Pressable onPress={() => onRemove(0)}>
                  <Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      ) : (
        /* Full comparison view */
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Equity Curve */}
          {renderEquityOverlay()}

          {/* Strategy Summary Cards */}
          <View style={styles.slotsRow}>
            {slots.map((slot, i) => (
              <View key={slot.id} style={[styles.slotCard, { borderColor: slot.color + '40', backgroundColor: colors.bgCard }]}>
                <View style={[styles.slotCardHeader, { backgroundColor: slot.color + '15' }]}>
                  <Text style={[styles.slotCardName, { color: colors.text }]} numberOfLines={1}>
                    {slot.name}
                  </Text>
                  {onRemove && (
                    <Pressable onPress={() => onRemove(i)}>
                      <Text style={{ color: colors.danger, fontSize: 14 }}>✕</Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.slotCardBody}>
                  <View style={styles.slotCardMetric}>
                    <Text style={[styles.slotCardValue, { color: slot.backtestResult.totalPnl >= 0 ? '#00C853' : '#FF1744' }]}>
                      {formatCurrency(slot.backtestResult.totalPnl, true)}
                    </Text>
                    <Text style={[styles.slotCardLabel, { color: colors.textMuted }]}>P&L</Text>
                  </View>
                  <View style={styles.slotCardMetric}>
                    <Text style={[styles.slotCardValue, { color: colors.text }]}>
                      {slot.backtestResult.winRate.toFixed(0)}%
                    </Text>
                    <Text style={[styles.slotCardLabel, { color: colors.textMuted }]}>Win Rate</Text>
                  </View>
                  <View style={styles.slotCardMetric}>
                    <Text style={[styles.slotCardValue, { color: slot.backtestResult.sharpeRatio >= 1 ? '#00C853' : '#FFC107' }]}>
                      {slot.backtestResult.sharpeRatio.toFixed(2)}
                    </Text>
                    <Text style={[styles.slotCardLabel, { color: colors.textMuted }]}>Sharpe</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Bar Charts for All Metrics */}
          <View style={styles.barChartSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Metric Comparison</Text>
            <View style={[styles.barChartCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {METRICS.map(metric => renderBarChart(metric))}
            </View>
          </View>

          {/* Wins/Losses Summary */}
          <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Period Analysis</Text>
            {slots.map((slot, _i) => (
              <View key={slot.id} style={styles.summaryRow}>
                <View style={[styles.summaryDot, { backgroundColor: slot.color }]} />
                <Text style={[styles.summaryName, { color: colors.text }]}>{slot.name}</Text>
                <Text style={[styles.summaryDetail, { color: colors.textMuted }]}>
                  {slot.backtestResult.winningPeriods}W / {slot.backtestResult.losingPeriods}L
                  {' · '}{slot.backtestResult.totalPeriods} periods
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerIcon: {
      fontSize: 24,
    },
    headerTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
    },
    headerSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      marginTop: 1,
    },
    clearBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BORDER_RADIUS.sm,
    },
    clearBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.xs,
    },
    // Empty state
    emptyState: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: SPACING.lg,
      gap: 6,
    },
    emptyIcon: {
      fontSize: 32,
    },
    emptyTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
    },
    emptySubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      textAlign: 'center',
      lineHeight: 16,
      maxWidth: 280,
    },
    slotPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      marginTop: SPACING.md,
      width: '100%',
      gap: 8,
    },
    slotColorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    slotName: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
    },
    slotMeta: {
      ...FONTS.regular,
      fontSize: 10,
      marginTop: 1,
    },
    // Equity Chart
    chartContainer: {
      padding: SPACING.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    chartTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    // Strategy Cards Row
    slotsRow: {
      flexDirection: 'row',
      padding: SPACING.md,
      gap: SPACING.sm,
    },
    slotCard: {
      flex: 1,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      overflow: 'hidden',
    },
    slotCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 6,
    },
    slotCardName: {
      ...FONTS.bold,
      fontSize: 10,
      flex: 1,
    },
    slotCardBody: {
      padding: SPACING.sm,
      gap: 6,
    },
    slotCardMetric: {
      alignItems: 'center',
      gap: 1,
    },
    slotCardValue: {
      ...FONTS.extraBold,
      fontSize: FONTS.size.sm,
      fontFamily: 'monospace',
    },
    slotCardLabel: {
      ...FONTS.regular,
      fontSize: 8,
      textTransform: 'uppercase',
    },
    // Bar Chart
    barChartSection: {
      padding: SPACING.md,
      paddingTop: 0,
    },
    sectionTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.sm,
      marginBottom: SPACING.sm,
    },
    barChartCard: {
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      gap: SPACING.sm,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    barIcon: {
      fontSize: 14,
      width: 20,
    },
    barContainer: {
      flex: 1,
      gap: 4,
    },
    barItem: {
      gap: 2,
    },
    barLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    barColorDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    barName: {
      ...FONTS.regular,
      fontSize: 9,
      flex: 1,
    },
    barValue: {
      ...FONTS.semiBold,
      fontSize: 9,
      fontFamily: 'monospace',
    },
    bestBadge: {
      fontSize: 10,
    },
    barTrack: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 4,
    },
    // Summary
    summaryCard: {
      margin: SPACING.md,
      marginTop: 0,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      gap: SPACING.sm,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    summaryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    summaryName: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      width: 80,
    },
    summaryDetail: {
      ...FONTS.regular,
      fontSize: 10,
      fontFamily: 'monospace',
      flex: 1,
    },
  });
