/**
 * ============================================================================
 * Toroloom — Strategy Greeks Panel
 * ============================================================================
 *
 * Displays per-leg and net option Greeks for the current strategy.
 * Features:
 *   - Compact grid: Delta, Gamma, Theta, Vega, Rho per leg
 *   - Net Greeks summary row with color coding
 *   - Moneyness indicator for each leg
 *   - Time decay visualization (theta over remaining days)
 *   - Estimated margin display
 *
 * Usage:
 *   import GreeksPanel from '../../components/fno/GreeksPanel';
 *   <GreeksPanel
 *     legGreeks={legGreeks}
 *     netGreeks={netGreeks}
 *     daysToExpiry={7}
 *   />
 *
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import type { LegGreeks, NetStrategyGreeks } from '../../services/greeksCalculator';
import { generateThetaDecay } from '../../services/greeksCalculator';

// ──── Props ────────────────────────────────────────────────────────────────

interface GreeksPanelProps {
  /** Greeks for each strategy leg */
  legGreeks: LegGreeks[];
  /** Net (aggregated) strategy Greeks */
  netGreeks: NetStrategyGreeks;
  /** Days to nearest expiry */
  daysToExpiry: number;
  /** Labels for each leg */
  legLabels?: string[];
  /** Compact mode (hides theta chart) */
  compact?: boolean;
}

// ──── Types ────────────────────────────────────────────────────────────────

/** Only numeric Greek fields (excludes moneyness/iv) */
type NumericGreekKey = 'delta' | 'gamma' | 'theta' | 'vega' | 'rho';

// ──── Constants ────────────────────────────────────────────────────────────

const GREEK_CONFIGS: { key: NumericGreekKey; label: string; format: (v: number) => string; colorCode: boolean }[] = [
  { key: 'delta', label: 'Δ Delta', format: (v) => v.toFixed(3), colorCode: true },
  { key: 'gamma', label: 'Γ Gamma', format: (v) => v.toFixed(5), colorCode: true },
  { key: 'theta', label: 'Θ Theta', format: (v) => `${v.toFixed(2)}/d`, colorCode: true },
  { key: 'vega', label: 'ν Vega', format: (v) => `${v.toFixed(2)}/1%`, colorCode: true },
  { key: 'rho', label: 'ρ Rho', format: (v) => `${v.toFixed(3)}/1%`, colorCode: false },
];

function getGreekColor(value: number, colors: any): string {
  if (value > 0.001) return colors.marketUp;
  if (value < -0.001) return colors.marketDown;
  return colors.textMuted;
}

// ──── Component ────────────────────────────────────────────────────────────

export default function GreeksPanel({
  legGreeks,
  netGreeks,
  daysToExpiry,
  legLabels = [],
  compact = false,
}: GreeksPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const hasGreeks = legGreeks.length > 0;
  const thetaDecayData = useMemo(
    () => (hasGreeks ? generateThetaDecay(netGreeks.theta, Math.max(daysToExpiry, 1)) : []),
    [hasGreeks, netGreeks.theta, daysToExpiry],
  );

  // ── Theta Decay Mini Chart ──
  const renderThetaChart = () => {
    if (thetaDecayData.length < 2 || compact) return null;
    const chartH = 60;
    const chartW = 160;
    const padding = 4;

    const values = thetaDecayData.map(p => p.theta);
    const min = Math.min(...values, -0.01);
    const max = Math.max(...values, 0.01);
    const range = (max - min) || 0.01;

    const getX = (i: number) => padding + (i / (thetaDecayData.length - 1)) * (chartW - 2 * padding);
    const getY = (v: number) => padding + ((max - v) / range) * (chartH - 2 * padding);

    let path = `M ${getX(0)} ${getY(thetaDecayData[0].theta)}`;
    for (let i = 1; i < thetaDecayData.length; i++) {
      path += ` L ${getX(i)} ${getY(thetaDecayData[i].theta)}`;
    }

    const zeroY = getY(0);

    return (
      <View style={styles.thetaChartContainer}>
        <Text style={styles.thetaChartTitle}>Θ Time Decay</Text>
        <Svg width={chartW} height={chartH}>
          {/* Zero line */}
          {min < 0 && max > 0 && (
            <Line
              x1={padding} y1={zeroY} x2={chartW - padding} y2={zeroY}
              stroke={colors.textMuted} strokeWidth={0.5} strokeDasharray="2,2" opacity={0.4}
            />
          )}
          {/* Decay curve */}
          <Defs>
            <LinearGradient id="thetaGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={netGreeks.theta >= 0 ? colors.marketUp : colors.marketDown} stopOpacity="0.6" />
              <Stop offset="100%" stopColor={netGreeks.theta >= 0 ? colors.marketUp : colors.marketDown} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Path
            d={path}
            stroke="url(#thetaGrad)"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
          {/* End dot */}
          <G>
            <Line
              x1={getX(thetaDecayData.length - 1)} y1={padding}
              x2={getX(thetaDecayData.length - 1)} y2={chartH - padding}
              stroke={colors.borderLight} strokeWidth={0.5} strokeDasharray="2,2" opacity={0.3}
            />
            <SvgText
              x={getX(thetaDecayData.length - 1)} y={chartH - 2}
              fill={colors.textMuted} fontSize={7} fontFamily="System" textAnchor="middle"
            >
              Expiry
            </SvgText>
          </G>
          {/* Starting theta value */}
          <SvgText
            x={getX(0)} y={getY(thetaDecayData[0].theta) - 4}
            fill={getGreekColor(thetaDecayData[0].theta, colors)}
            fontSize={8} fontFamily="monospace" fontWeight="600"
          >
            {thetaDecayData[0].theta.toFixed(1)}
          </SvgText>
        </Svg>
      </View>
    );
  };

  if (!hasGreeks) {
    return (
      <View style={[styles.container, { borderColor: colors.border }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📐</Text>
          <Text style={styles.emptyTitle}>Greeks</Text>
          <Text style={styles.emptySubtitle}>Analyze strategy to see Greeks</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Greeks</Text>
        <View style={styles.headerMeta}>
          <Text style={styles.headerDays}>
            {daysToExpiry}d to expiry
          </Text>
          <View style={[styles.marginBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.marginText, { color: colors.primary }]}>
              Margin: ₹{(netGreeks.estimatedMargin / 1000).toFixed(1)}K
            </Text>
          </View>
        </View>
      </View>

      {/* ── Net Greeks Summary ── */}
      <View style={[styles.netRow, { backgroundColor: colors.bgCard + '80', borderColor: colors.divider }]}>
        {GREEK_CONFIGS.map(cfg => {
          const value = netGreeks[cfg.key as keyof NetStrategyGreeks] as number;
          const color = cfg.colorCode ? getGreekColor(value, colors) : colors.text;
          return (
            <View key={cfg.key} style={styles.netItem}>
              <Text style={styles.netLabel}>{cfg.label.split(' ')[1]}</Text>
              <Text style={[styles.netValue, { color }]}>{cfg.format(value)}</Text>
            </View>
          );
        })}
      </View>

      {/* ── Per-Leg Greeks ── */}
      {legGreeks.map((g, legIdx) => (
        <View key={legIdx} style={[styles.legRow, { borderTopColor: colors.divider }]}>
          <View style={styles.legHeader}>
            <View style={[styles.legBadge, {
              backgroundColor: g.delta > 0 ? `${colors.marketUp}20` : `${colors.marketDown}20`,
            }]}>
              <Text style={[styles.legLabel, {
                color: g.delta > 0 ? colors.marketUp : colors.marketDown,
              }]}>
                {legLabels[legIdx] || `Leg ${legIdx + 1}`}
              </Text>
            </View>
            <View style={[styles.moneynessBadge, {
              backgroundColor: g.moneyness === 'ITM' ? '#00C85320' : g.moneyness === 'OTM' ? '#FF525220' : '#FFC10720',
            }]}>
              <Text style={[styles.moneynessText, {
                color: g.moneyness === 'ITM' ? '#00C853' : g.moneyness === 'OTM' ? '#FF5252' : '#FFC107',
              }]}>
                {g.moneyness}
              </Text>
            </View>
          </View>

          <View style={styles.greekGrid}>
            {GREEK_CONFIGS.map(cfg => {
              const value = g[cfg.key];
              const color = cfg.colorCode ? getGreekColor(value, colors) : colors.text;
              return (
                <View key={cfg.key} style={styles.greekCell}>
                  <Text style={styles.greekCellLabel}>{cfg.label.split(' ')[0]}</Text>
                  <Text style={[styles.greekCellValue, { color }]}>{cfg.format(value)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}

      {/* ── Directional Bias ── */}
      <View style={[styles.biasContainer, { borderTopColor: colors.divider }]}>
        <View style={styles.biasRow}>
          <Text style={styles.biasLabel}>Directional Bias</Text>
          <Text style={[styles.biasValue, {
            color: Math.abs(netGreeks.delta) < 0.1 ? colors.textMuted :
              netGreeks.delta > 0 ? colors.marketUp : colors.marketDown,
          }]}>
            {Math.abs(netGreeks.delta) < 0.1 ? 'Neutral' :
             netGreeks.delta > 0 ? `Bullish (Δ ${netGreeks.delta.toFixed(2)})` :
             `Bearish (Δ ${netGreeks.delta.toFixed(2)})`}
          </Text>
        </View>
        {netGreeks.theta < -20 && (
          <View style={styles.warningRow}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              High theta decay ({netGreeks.theta.toFixed(1)}/d) — consider shorter duration
            </Text>
          </View>
        )}
      </View>

      {/* ── Theta Decay Chart ── */}
      {renderThetaChart()}
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
    emptyState: {
      alignItems: 'center',
      paddingVertical: 20,
      gap: 4,
    },
    emptyIcon: {
      fontSize: 24,
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
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    headerTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    headerMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerDays: {
      ...FONTS.regular,
      fontSize: 10,
      color: colors.textMuted,
      fontFamily: 'monospace',
    },
    marginBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.sm,
    },
    marginText: {
      ...FONTS.semiBold,
      fontSize: 9,
    },
    // Net row
    netRow: {
      flexDirection: 'row',
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      gap: 2,
    },
    netItem: {
      flex: 1,
      alignItems: 'center',
    },
    netLabel: {
      ...FONTS.regular,
      fontSize: 8,
      color: colors.textMuted,
      marginBottom: 1,
    },
    netValue: {
      ...FONTS.extraBold,
      fontSize: 10,
      fontFamily: 'monospace',
    },
    // Leg rows
    legRow: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    legHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    legBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.sm,
    },
    legLabel: {
      ...FONTS.bold,
      fontSize: 9,
    },
    moneynessBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: BORDER_RADIUS.sm,
    },
    moneynessText: {
      ...FONTS.semiBold,
      fontSize: 8,
    },
    greekGrid: {
      flexDirection: 'row',
      gap: 2,
    },
    greekCell: {
      flex: 1,
      alignItems: 'center',
    },
    greekCellLabel: {
      ...FONTS.regular,
      fontSize: 7,
      color: colors.textMuted,
      marginBottom: 1,
    },
    greekCellValue: {
      ...FONTS.semiBold,
      fontSize: 9,
      fontFamily: 'monospace',
    },
    // Bias
    biasContainer: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    biasRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    biasLabel: {
      ...FONTS.regular,
      fontSize: 10,
      color: colors.textMuted,
    },
    biasValue: {
      ...FONTS.bold,
      fontSize: 10,
      fontFamily: 'monospace',
    },
    warningRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    warningIcon: {
      fontSize: 10,
    },
    warningText: {
      ...FONTS.regular,
      fontSize: 8,
      color: colors.warning,
      flex: 1,
    },
    // Theta chart
    thetaChartContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
      gap: SPACING.sm,
    },
    thetaChartTitle: {
      ...FONTS.regular,
      fontSize: 9,
      color: colors.textMuted,
      width: 60,
    },
  });
