/**
 * ============================================================================
 * Toroloom — Correlation Matrix Screen
 * ============================================================================
 *
 * Displays an asset-to-asset correlation heatmap using portfolio holdings.
 * Features:
 *   - SVG heatmap with color-coded correlation cells
 *   - Diversification score and average correlation metrics
 *   - High correlation pair warnings
 *   - Diversification recommendations
 *
 * ============================================================================
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { computeCorrelationMatrix } from '../../services/correlationMatrix';
import { usePortfolioStore } from '../../store/portfolioStore';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import type { CorrelationMatrix } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Color scale for heatmap cells ───────────────────────────
// -1 (perfect negative) → blue, 0 (no correlation) → neutral,
// +1 (perfect positive) → red
const HEATMAP_COLORS = [
  { threshold: -1.0, color: '#004DE6' },   // Strong negative
  { threshold: -0.7, color: '#3B82F6' },   // Moderate negative
  { threshold: -0.4, color: '#93C5FD' },   // Weak negative
  { threshold: -0.1, color: '#E2E8F0' },   // Slight negative
  { threshold: 0.1,  color: '#FEE2E2' },   // Slight positive
  { threshold: 0.4,  color: '#FCA5A5' },   // Weak positive
  { threshold: 0.7,  color: '#EF4444' },   // Moderate positive
  { threshold: 1.0,  color: '#DC2626' },   // Strong positive
];

function getHeatColor(correlation: number): string {
  for (const c of HEATMAP_COLORS) {
    if (correlation <= c.threshold) return c.color;
  }
  return '#DC2626';
}

function getCorrelationLabel(correlation: number): string {
  const abs = Math.abs(correlation);
  if (abs >= 0.9) return 'Very Strong';
  if (abs >= 0.7) return 'Strong';
  if (abs >= 0.5) return 'Moderate';
  if (abs >= 0.3) return 'Weak';
  return 'Negligible';
}

// ─── Helper to format small correlation values ───────────────
function formatCorr(v: number): string {
  if (v === 1) return '1';
  if (v === -1) return '-1';
  if (v === 0) return '0';
  return v.toFixed(2);
}

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export default function CorrelationMatrixScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const holdings = usePortfolioStore(s => s.holdings);
  const [result, setResult] = useState<CorrelationMatrix | null>(null);
  const [selectedPair, setSelectedPair] = useState<{
    asset1: string;
    asset2: string;
    correlation: number;
  } | null>(null);

  // Compute matrix on mount / holdings change
  useEffect(() => {
    if (holdings && holdings.length > 0) {
      const matrix = computeCorrelationMatrix(holdings);
      setResult(matrix);
    }
  }, [holdings]);

  // ── Run / Re-run ──────────────────────────────────────────
  const handleAnalyze = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPair(null);
    if (holdings && holdings.length > 0) {
      const matrix = computeCorrelationMatrix(holdings);
      setResult(matrix);
    }
  }, [holdings]);

  // ── Display helpers ───────────────────────────────────────
  const formatPercent = (v: number) => `${(v * 100).toFixed(0)}%`;
  const formatScore = (v: number) => `${v}/100`;

  // ── Cell tap handler ──────────────────────────────────────
  const handleCellTap = useCallback((asset1: string, asset2: string, correlation: number) => {
    if (asset1 === asset2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPair({ asset1, asset2, correlation });
  }, []);

  // ── Has holdings? ─────────────────────────────────────────
  const hasHoldings = holdings && holdings.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ───────────────────────────────────────── */}
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
            <View style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </View>
          </AnimatedPressable>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Correlation Matrix</Text>
            <Text style={styles.subtitle}>Asset-to-asset correlation heatmap</Text>
          </View>
        </View>

        {/* ── Info Banner ──────────────────────────────────── */}
        <Animated.View entering={FadeInUp.springify()}>
          <LinearGradient
            colors={['rgba(108,99,255,0.15)', 'rgba(59,130,246,0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.infoBanner}
          >
            <Ionicons name="information-circle" size={18} color="#6C63FF" />
            <Text style={styles.infoText}>
              Correlation measures how assets move relative to each other. Values range from -1 (move opposite) to +1 (move together). Lower correlation = better diversification.
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* ── Analyze Button ───────────────────────────────── */}
        {hasHoldings && (
          <AnimatedPressable
            onPress={handleAnalyze}
            haptic="medium"
            scaleTo={0.97}
          >
            <LinearGradient
              colors={GRADIENTS.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.runBtn}
            >
              <Ionicons name="grid" size={22} color="#fff" />
              <Text style={styles.runBtnText}>
                {result ? 'Re-analyze Correlation' : 'Analyze Correlation'}
              </Text>
            </LinearGradient>
          </AnimatedPressable>
        )}

        {/* ── No Holdings State ────────────────────────────── */}
        {!hasHoldings && (
          <Animated.View entering={FadeInUp.delay(100).springify()}>
            <Card title="No Holdings Found" style={styles.sectionCard}>
              <View style={styles.emptyContent}>
                <Ionicons name="pie-chart-outline" size={64} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Portfolio Data</Text>
                <Text style={styles.emptyDesc}>
                  Add stocks to your portfolio to see the correlation matrix. You can also add mock holdings to try this feature.
                </Text>
                <AnimatedPressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    // Use mock holdings for demo
                    const mockHoldings = [
                      { id: '1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd', quantity: 10, buyPrice: 2800, currentPrice: 2915, totalInvested: 28000, currentValue: 29150, pnl: 1150, pnlPercent: 4.1, dayChange: 15, dayChangePercent: 0.52 },
                      { id: '2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services', quantity: 5, buyPrice: 3900, currentPrice: 4120, totalInvested: 19500, currentValue: 20600, pnl: 1100, pnlPercent: 5.64, dayChange: 25, dayChangePercent: 0.61 },
                      { id: '3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', quantity: 15, buyPrice: 1650, currentPrice: 1780, totalInvested: 24750, currentValue: 26700, pnl: 1950, pnlPercent: 7.88, dayChange: 12, dayChangePercent: 0.68 },
                      { id: '4', stockId: 'ITC', symbol: 'ITC', name: 'ITC Ltd', quantity: 20, buyPrice: 430, currentPrice: 468, totalInvested: 8600, currentValue: 9360, pnl: 760, pnlPercent: 8.84, dayChange: 3.5, dayChangePercent: 0.75 },
                      { id: '5', stockId: 'BHARTIARTL', symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', quantity: 8, buyPrice: 1250, currentPrice: 1385, totalInvested: 10000, currentValue: 11080, pnl: 1080, pnlPercent: 10.8, dayChange: 8.5, dayChangePercent: 0.62 },
                    ] as any;
                    const matrix = computeCorrelationMatrix(mockHoldings);
                    setResult(matrix);
                  }}
                  haptic="light"
                  scaleTo={0.95}
                  style={styles.mockBtn}
                >
                  <Text style={styles.mockBtnText}>Use Sample Portfolio</Text>
                </AnimatedPressable>
              </View>
            </Card>
          </Animated.View>
        )}

        {/* ── Results ──────────────────────────────────────── */}
        {result && (
          <Animated.View entering={FadeInUp.delay(100).springify()}>
            {/* ── Key Metrics ──────────────────────────────── */}
            <View style={styles.metricsGrid}>
              {[
                { label: 'Diversification Score', value: formatScore(result.diversificationScore), icon: '🎯', color: result.diversificationScore >= 60 ? '#00C853' : result.diversificationScore >= 40 ? '#FFC107' : '#FF1744' },
                { label: 'Avg Correlation', value: result.averageCorrelation.toFixed(2), icon: '📊', color: '#6C63FF' },
                { label: 'High Corr. Pairs', value: result.highCorrelationPairs.length.toString(), icon: '⚠️', color: result.highCorrelationPairs.length > 0 ? '#FFC107' : '#00C853' },
                { label: 'Assets Analyzed', value: result.symbols.length.toString(), icon: '📈', color: '#3B82F6' },
              ].map((metric, i) => (
                <Animated.View
                  key={metric.label}
                  entering={FadeInDown.delay(200 + i * 80).springify()}
                  style={[styles.metricCard, { borderColor: metric.color + '30' }]}
                >
                  <Text style={styles.metricIcon}>{metric.icon}</Text>
                  <Text style={[styles.metricValue, { color: metric.color }]}>{metric.value}</Text>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                </Animated.View>
              ))}
            </View>

            {/* ── Correlation Heatmap ──────────────────────── */}
            <Card title="Correlation Heatmap" subtitle="Tap a cell for details" style={styles.sectionCard}>
              <View style={styles.heatmapContainer}>
                <CorrelationHeatmap
                  symbols={result.symbols}
                  matrix={result.matrix}
                  onCellTap={handleCellTap}
                />
              </View>

              {/* ── Color Legend ───────────────────────────── */}
              <View style={styles.legendContainer}>
                <View style={styles.legendRow}>
                  <LinearGradient
                    colors={['#004DE6', '#3B82F6', '#93C5FD', '#E2E8F0', '#FEE2E2', '#FCA5A5', '#EF4444', '#DC2626']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.legendGradient}
                  />
                </View>
                <View style={styles.legendLabels}>
                  <Text style={styles.legendLabel}>-1</Text>
                  <Text style={styles.legendLabel}>0</Text>
                  <Text style={styles.legendLabel}>+1</Text>
                </View>
              </View>

              {/* ── Selected Pair Detail ───────────────────── */}
              {selectedPair && (
                <Animated.View entering={FadeInDown.springify()} style={styles.selectedPairCard}>
                  <View style={styles.selectedPairHeader}>
                    <Text style={styles.selectedPairTitle}>
                      {selectedPair.asset1} ↔ {selectedPair.asset2}
                    </Text>
                    <Text style={[
                      styles.selectedPairValue,
                      { color: getHeatColor(selectedPair.correlation) },
                    ]}>
                      {formatCorr(selectedPair.correlation)}
                    </Text>
                  </View>
                  <Text style={styles.selectedPairLabel}>
                    {getCorrelationLabel(selectedPair.correlation)}{' '}
                    {selectedPair.correlation > 0 ? 'positive' : 'negative'} correlation
                  </Text>
                  <Text style={styles.selectedPairDesc}>
                    {selectedPair.correlation > 0.7
                      ? 'These assets move strongly together. Adding both provides limited diversification benefit. Consider reducing one position.'
                      : selectedPair.correlation > 0.4
                      ? 'These assets have moderate positive correlation. They provide some diversification but may move together in market swings.'
                      : selectedPair.correlation > 0
                      ? 'These assets have weak positive correlation. They provide good diversification benefits.'
                      : selectedPair.correlation > -0.4
                      ? 'These assets have weak negative correlation. They move in opposite directions, providing excellent diversification.'
                      : 'These assets have strong negative correlation. They act as hedges for each other, providing maximum diversification benefit.'}
                  </Text>
                </Animated.View>
              )}
            </Card>

            {/* ── Diversification Assessment ───────────────── */}
            <Card title="Diversification Assessment" style={styles.sectionCard}>
              <View style={styles.assessmentContent}>
                <View style={styles.assessmentRow}>
                  <Text style={styles.assessmentLabel}>Diversification Score</Text>
                  <View style={styles.scoreBarContainer}>
                    <View style={styles.scoreBarBg}>
                      <View
                        style={[
                          styles.scoreBarFill,
                          {
                            width: `${result.diversificationScore}%`,
                            backgroundColor: result.diversificationScore >= 60 ? '#00C853' : result.diversificationScore >= 40 ? '#FFC107' : '#FF1744',
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.scoreBarText, {
                      color: result.diversificationScore >= 60 ? '#00C853' : result.diversificationScore >= 40 ? '#FFC107' : '#FF1744',
                    }]}>
                      {result.diversificationScore}/100
                    </Text>
                  </View>
                </View>
                <View style={styles.assessmentDivider} />
                <View style={styles.assessmentRow}>
                  <Text style={styles.assessmentLabel}>Average Cross-Correlation</Text>
                  <Text style={styles.assessmentValue}>{result.averageCorrelation.toFixed(3)}</Text>
                </View>
                <View style={styles.assessmentDivider} />
                <View style={styles.assessmentRow}>
                  <Text style={styles.assessmentLabel}>Highly Correlated Pairs (&gt;0.7)</Text>
                  <Text style={[styles.assessmentValue, {
                    color: result.highCorrelationPairs.length > 0 ? '#FFC107' : '#00C853',
                  }]}>
                    {result.highCorrelationPairs.length}
                  </Text>
                </View>
              </View>
            </Card>

            {/* ── High Correlation Pairs ────────────────────── */}
            {result.highCorrelationPairs.length > 0 && (
              <Card title="High Correlation Pairs" subtitle="Assets that move closely together" style={styles.sectionCard}>
                <View style={styles.pairsContent}>
                  {result.highCorrelationPairs.map((pair, i) => (
                    <Animated.View
                      key={`pair-${i}`}
                      entering={FadeInDown.delay(100 + i * 60).springify()}
                      style={styles.pairRow}
                    >
                      <View style={styles.pairIcon}>
                        <Ionicons name="warning" size={18} color="#FFC107" />
                      </View>
                      <View style={styles.pairInfo}>
                        <Text style={styles.pairName}>{pair.asset1} ↔ {pair.asset2}</Text>
                        <Text style={styles.pairLabel}>Correlation: {(pair.correlation * 100).toFixed(0)}%</Text>
                      </View>
                      <Text style={[styles.pairValue, { color: getHeatColor(pair.correlation) }]}>
                        {formatCorr(pair.correlation)}
                      </Text>
                    </Animated.View>
                  ))}
                </View>
              </Card>
            )}

            {/* ── Recommendations ──────────────────────────── */}
            <Card title="Recommendations" style={styles.sectionCard}>
              <View style={styles.recommendationsContent}>
                {result.recommendations.map((rec, i) => (
                  <Animated.View
                    key={`rec-${i}`}
                    entering={FadeInDown.delay(100 + i * 80).springify()}
                    style={styles.recRow}
                  >
                    <View style={styles.recBullet}>
                      <View style={styles.recDot} />
                    </View>
                    <Text style={styles.recText}>{rec}</Text>
                  </Animated.View>
                ))}
              </View>
            </Card>

            {/* ── All Pairs Table ──────────────────────────── */}
            {result.pairs.length > 0 && (
              <Card title="All Asset Pairs" style={styles.sectionCard}>
                <View style={styles.pairsContent}>
                  {result.pairs.map((pair, i) => (
                    <Animated.View
                      key={`allpair-${i}`}
                      entering={FadeInDown.delay(100 + i * 40).springify()}
                      style={styles.pairRow}
                    >
                      <View style={styles.pairInfo}>
                        <Text style={styles.pairName}>{pair.asset1} ↔ {pair.asset2}</Text>
                        <Text style={styles.pairLabel}>{getCorrelationLabel(pair.correlation)} ({pair.dataPoints} data pts)</Text>
                      </View>
                      <View style={[styles.pairBadge, { backgroundColor: getHeatColor(pair.correlation) + '20' }]}>
                        <Text style={[styles.pairValue, { color: getHeatColor(pair.correlation) }]}>
                          {formatCorr(pair.correlation)}
                        </Text>
                      </View>
                    </Animated.View>
                  ))}
                </View>
              </Card>
            )}
          </Animated.View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// SVG CORRELATION HEATMAP
// ══════════════════════════════════════════════════════════════


function CorrelationHeatmap({
  symbols,
  matrix,
  onCellTap,
}: {
  symbols: string[];
  matrix: number[][];
  onCellTap: (asset1: string, asset2: string, correlation: number) => void;
}) {
  const n = symbols.length;
  const padding = { top: 40, left: 80, right: 20, bottom: 20 };
  const cellSize = Math.min(
    (SCREEN_WIDTH - SPACING.xl * 2 - SPACING.xl * 2 - padding.left - padding.right) / n,
    64,
  );
  const svgWidth = padding.left + cellSize * n + padding.right;
  const svgHeight = padding.top + cellSize * n + padding.bottom;

  // Truncate symbol to 5 chars max
  const truncate = (s: string) => s.length > 5 ? s.substring(0, 4) + '…' : s;

  return (
    <Svg
      width={svgWidth}
      height={svgHeight}
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
    >
      {/* Row labels (Y-axis) */}
      {symbols.map((sym, i) => (
        <SvgText
          key={`ylabel-${i}`}
          x={padding.left - 8}
          y={padding.top + cellSize * i + cellSize / 2 + 4}
          fill="rgba(255,255,255,0.6)"
          fontSize={11}
          fontFamily="System"
          fontWeight="600"
          textAnchor="end"
        >
          {truncate(sym)}
        </SvgText>
      ))}

      {/* Column labels (X-axis) */}
      {symbols.map((sym, i) => (
        <SvgText
          key={`xlabel-${i}`}
          x={padding.left + cellSize * i + cellSize / 2}
          y={padding.top - 8}
          fill="rgba(255,255,255,0.6)"
          fontSize={11}
          fontFamily="System"
          fontWeight="600"
          textAnchor="end"
          rotation={-45}
          originX={padding.left + cellSize * i + cellSize / 2}
          originY={padding.top - 8}
        >
          {truncate(sym)}
        </SvgText>
      ))}

      {/* Heatmap cells */}
      {matrix.map((row, i) =>
        row.map((corr, j) => {
          const isSelf = i === j;
          const x = padding.left + cellSize * j;
          const y = padding.top + cellSize * i;
          const color = isSelf ? '#6C63FF40' : getHeatColor(corr);            return (
            <React.Fragment key={`cell-${i}-${j}`}>
              <Rect
                x={x}
                y={y}
                width={cellSize - 2}
                height={cellSize - 2}
                rx={4}
                ry={4}
                fill={color}
                stroke={isSelf ? 'rgba(108,99,255,0.3)' : 'rgba(255,255,255,0.05)'}
                strokeWidth={1}
                onPress={() => onCellTap(symbols[i], symbols[j], corr)}
              />
              <SvgText
                x={x + (cellSize - 2) / 2}
                y={y + (cellSize - 2) / 2 + 4}
                fill={Math.abs(corr) > 0.5 ? '#fff' : 'rgba(255,255,255,0.7)'}
                fontSize={cellSize > 40 ? 12 : 10}
                fontFamily="System"
                fontWeight={isSelf ? '700' : '500'}
                textAnchor="middle"
                onPress={() => onCellTap(symbols[i], symbols[j], corr)}
              >
                {isSelf ? '—' : formatCorr(corr)}
              </SvgText>
            </React.Fragment>
          );
        }),
      )}
    </Svg>
  );
}

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 100,
    paddingHorizontal: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // ── Info Banner ──────────────────────────────────────────────
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
  },
  infoText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },

  // ── Section Card ─────────────────────────────────────────────
  sectionCard: {
    marginBottom: SPACING.md,
  },

  // ── Run Button ───────────────────────────────────────────────
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.lg,
  },
  runBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },

  // ── Empty State ──────────────────────────────────────────────
  emptyContent: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.xl,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  emptyDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.xl,
  },
  mockBtn: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mockBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },

  // ── Metrics Grid ─────────────────────────────────────────────
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  metricCard: {
    width: (SCREEN_WIDTH - SPACING.xl * 2 - SPACING.sm) / 2,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  metricIcon: {
    fontSize: 24,
  },
  metricValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  metricLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // ── Heatmap ──────────────────────────────────────────────────
  heatmapContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },

  // ── Color Legend ─────────────────────────────────────────────
  legendContainer: {
    gap: 4,
    paddingTop: SPACING.md,
  },
  legendRow: {
    alignItems: 'center',
  },
  legendGradient: {
    width: '100%',
    height: 8,
    borderRadius: 4,
  },
  legendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  legendLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },

  // ── Selected Pair ────────────────────────────────────────────
  selectedPairCard: {
    marginTop: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedPairHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedPairTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  selectedPairValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
  },
  selectedPairLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    marginTop: 4,
  },
  selectedPairDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: SPACING.sm,
    lineHeight: 16,
  },

  // ── Assessment ───────────────────────────────────────────────
  assessmentContent: {
    gap: 0,
    paddingTop: SPACING.md,
  },
  assessmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  assessmentLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  assessmentValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  assessmentDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  scoreBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
    justifyContent: 'flex-end',
  },
  scoreBarBg: {
    width: 100,
    height: 8,
    backgroundColor: colors.bgInput,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreBarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
    minWidth: 48,
    textAlign: 'right',
  },

  // ── Pairs ────────────────────────────────────────────────────
  pairsContent: {
    gap: 0,
    paddingTop: SPACING.md,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  pairIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,193,7,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairInfo: {
    flex: 1,
  },
  pairName: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  pairLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  pairValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    minWidth: 36,
    textAlign: 'right',
  },
  pairBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },

  // ── Recommendations ──────────────────────────────────────────
  recommendationsContent: {
    gap: 0,
    paddingTop: SPACING.md,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  recBullet: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  recText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
