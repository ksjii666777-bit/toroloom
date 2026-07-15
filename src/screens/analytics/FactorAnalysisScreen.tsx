/**
 * ============================================================================
 * Toroloom — Factor Analysis Screen
 * ============================================================================
 *
 * Displays portfolio factor exposures across Momentum, Value, Size, Quality,
 * and Low Volatility factors. Features:
 *   - Exposure score bars with benchmark comparison
 *   - Per-stock factor contribution breakdown
 *   - Dominant style badge
 *   - Key insights and actionable recommendations
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
import { computeFactorAnalysis, FACTOR_META } from '../../services/factorAnalysis';
import { usePortfolioStore } from '../../store/portfolioStore';
import type { FactorAnalysisResult, FactorName } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════

export default function FactorAnalysisScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const holdings = usePortfolioStore(s => s.holdings);
  const [result, setResult] = useState<FactorAnalysisResult | null>(null);
  const [selectedFactor, setSelectedFactor] = useState<FactorName | null>(null);
  const [showAllStocks, setShowAllStocks] = useState(false);

  // Compute on mount / holdings change
  useEffect(() => {
    if (holdings && holdings.length > 0) {
      const analysis = computeFactorAnalysis(holdings);
      setResult(analysis);
    }
  }, [holdings]);

  // ── Analyze / Re-analyze ──────────────────────────────────
  const handleAnalyze = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedFactor(null);
    setShowAllStocks(false);
    if (holdings && holdings.length > 0) {
      const analysis = computeFactorAnalysis(holdings);
      setResult(analysis);
    }
  }, [holdings]);

  // ── Use mock holdings ─────────────────────────────────────
  const handleUseMock = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const mockHoldings = [
      { id: '1', stockId: 'RELIANCE', symbol: 'RELIANCE', name: 'Reliance Industries Ltd', quantity: 10, buyPrice: 2800, currentPrice: 2915, totalInvested: 28000, currentValue: 29150, pnl: 1150, pnlPercent: 4.1, dayChange: 15, dayChangePercent: 0.52 },
      { id: '2', stockId: 'TCS', symbol: 'TCS', name: 'Tata Consultancy Services', quantity: 5, buyPrice: 3900, currentPrice: 4120, totalInvested: 19500, currentValue: 20600, pnl: 1100, pnlPercent: 5.64, dayChange: 25, dayChangePercent: 0.61 },
      { id: '3', stockId: 'HDFCBANK', symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', quantity: 15, buyPrice: 1650, currentPrice: 1780, totalInvested: 24750, currentValue: 26700, pnl: 1950, pnlPercent: 7.88, dayChange: 12, dayChangePercent: 0.68 },
      { id: '4', stockId: 'ITC', symbol: 'ITC', name: 'ITC Ltd', quantity: 20, buyPrice: 430, currentPrice: 468, totalInvested: 8600, currentValue: 9360, pnl: 760, pnlPercent: 8.84, dayChange: 3.5, dayChangePercent: 0.75 },
      { id: '5', stockId: 'BHARTIARTL', symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', quantity: 8, buyPrice: 1250, currentPrice: 1385, totalInvested: 10000, currentValue: 11080, pnl: 1080, pnlPercent: 10.8, dayChange: 8.5, dayChangePercent: 0.62 },
    ] as any;
    const analysis = computeFactorAnalysis(mockHoldings);
    setResult(analysis);
  }, []);

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
            <Text style={styles.title}>Factor Analysis</Text>
            <Text style={styles.subtitle}>Momentum, Value, Size, Quality & Volatility</Text>
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
              Factor analysis breaks down your portfolio into five key investment factors. Scores range from 0–100. The dashed line shows the benchmark (Nifty 50 average).
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
              <Ionicons name="analytics" size={22} color="#fff" />
              <Text style={styles.runBtnText}>
                {result ? 'Re-analyze Factors' : 'Analyze Factors'}
              </Text>
            </LinearGradient>
          </AnimatedPressable>
        )}

        {/* ── No Holdings State ────────────────────────────── */}
        {!hasHoldings && (
          <Animated.View entering={FadeInUp.delay(100).springify()}>
            <Card title="No Portfolio Data" style={styles.sectionCard}>
              <View style={styles.emptyContent}>
                <Ionicons name="analytics-outline" size={64} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Holdings Found</Text>
                <Text style={styles.emptyDesc}>
                  Add stocks to your portfolio to see factor analysis. You can also use a sample portfolio to try this feature.
                </Text>
                <AnimatedPressable
                  onPress={handleUseMock}
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
            {/* ── Dominant Style Badge ─────────────────────── */}
            <View style={styles.styleBadgeRow}>
              <LinearGradient
                colors={['rgba(108,99,255,0.2)', 'rgba(59,130,246,0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.styleBadge}
              >
                <Ionicons name="flag" size={16} color="#6C63FF" />
                <Text style={styles.styleBadgeLabel}>Dominant Style</Text>
                <Text style={styles.styleBadgeValue}>{result.dominantStyle}</Text>
              </LinearGradient>
            </View>

            {/* ── Factor Exposure Bars ─────────────────────── */}
            <Card title="Factor Exposures" subtitle="Your portfolio vs Nifty 50 benchmark" style={styles.sectionCard}>
              <View style={styles.factorsList}>
                {result.factors.map((factor, i) => (
                  <AnimatedPressable
                    key={factor.factor}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedFactor(selectedFactor === factor.factor ? null : factor.factor);
                    }}
                    haptic="selection"
                    scaleTo={0.98}
                    highlight
                    highlightColor={factor.color}
                  >
                    <View style={styles.factorRow}>
                      <View style={styles.factorHeader}>
                        <Text style={styles.factorIcon}>{factor.icon}</Text>
                        <Text style={styles.factorLabel}>{factor.label}</Text>
                        <View style={[
                          styles.tiltBadge,
                          {
                            backgroundColor: factor.tilt === 'overweight'
                              ? `${factor.color}20`
                              : factor.tilt === 'underweight'
                                ? 'rgba(255,82,82,0.15)'
                                : 'rgba(255,255,255,0.05)',
                          },
                        ]}>
                          <Text style={[
                            styles.tiltText,
                            {
                              color: factor.tilt === 'overweight'
                                ? factor.color
                                : factor.tilt === 'underweight'
                                  ? '#FF5252'
                                  : colors.textMuted,
                            },
                          ]}>
                            {factor.tilt === 'overweight' ? '▲ +' : factor.tilt === 'underweight' ? '▼ −' : '● '}
                            {factor.tilt === 'overweight' ? 'Over' : factor.tilt === 'underweight' ? 'Under' : 'Neutral'}
                          </Text>
                        </View>
                      </View>

                      {/* Score bar */}
                      <View style={styles.scoreBarContainer}>
                        <View style={styles.scoreBarTrack}>
                          {/* Benchmark line */}
                          <View
                            style={[
                              styles.benchmarkLine,
                              { left: `${factor.benchmark}%` },
                            ]}
                          />
                          {/* Score fill */}
                          <View
                            style={[
                              styles.scoreBarFill,
                              {
                                width: `${factor.score}%`,
                                backgroundColor: factor.color,
                              },
                            ]}
                          />
                        </View>
                        <View style={styles.scoreLabels}>
                          <Text style={styles.scoreText}>{factor.score}</Text>
                          <Text style={styles.benchmarkText}>B: {factor.benchmark}</Text>
                        </View>
                      </View>

                      {/* Expanded interpretation */}
                      {selectedFactor === factor.factor && (
                        <Animated.View entering={FadeInUp.duration(200)} style={styles.factorDetail}>
                          <Text style={styles.factorInterpretation}>{factor.interpretation}</Text>
                        </Animated.View>
                      )}
                    </View>
                  </AnimatedPressable>
                ))}
              </View>
            </Card>

            {/* ── Stock Contributions ───────────────────────── */}
            <Card
              title="Stock Factor Contributions"
              subtitle="How each stock contributes to factor scores"
              style={styles.sectionCard}
              rightAction={
                result.stockContributions.length > 3 ? (
                  <AnimatedPressable
                    onPress={() => setShowAllStocks(!showAllStocks)}
                    haptic="light"
                    scaleTo={0.95}
                    style={styles.showAllBtn}
                  >
                    <Text style={styles.showAllBtnText}>
                      {showAllStocks ? 'Show Less' : `All (${result.stockContributions.length})`}
                    </Text>
                  </AnimatedPressable>
                ) : undefined
              }
            >
              <View style={styles.contributionsList}>
                {/* Table header */}
                <View style={styles.contribHeader}>
                  <Text style={styles.contribHeaderCell}>Stock</Text>
                  <Text style={styles.contribHeaderCell}>Wt%</Text>
                  <Text style={styles.contribHeaderCell}>Mom</Text>
                  <Text style={styles.contribHeaderCell}>Val</Text>
                  <Text style={styles.contribHeaderCell}>Size</Text>
                  <Text style={styles.contribHeaderCell}>Qual</Text>
                  <Text style={styles.contribHeaderCell}>Vol</Text>
                </View>

                {(showAllStocks ? result.stockContributions : result.stockContributions.slice(0, 3)).map((sc, i) => (
                  <View
                    key={sc.symbol}
                    style={[
                      styles.contribRow,
                      i < (showAllStocks ? result.stockContributions.length - 1 : Math.min(3, result.stockContributions.length) - 1) && styles.contribRowBorder,
                    ]}
                  >
                    <View style={styles.contribStockCell}>
                      <Text style={styles.contribSymbol}>{sc.symbol}</Text>
                      <Text style={styles.contribName} numberOfLines={1}>{sc.name}</Text>
                    </View>
                    <Text style={styles.contribValue}>{sc.weight}%</Text>
                    {(['momentum', 'value', 'size', 'quality', 'low_volatility'] as FactorName[]).map(f => {
                      const val = sc.contributions[f];
                      return (
                        <View key={f} style={[
                          styles.contribDot,
                          {
                            backgroundColor: val !== undefined
                              ? val > 0.5
                                ? FACTOR_COLORS[f]
                                : `${FACTOR_COLORS[f]}40`
                              : 'rgba(255,255,255,0.05)',
                          },
                        ]} />
                      );
                    })}
                  </View>
                ))}
              </View>
            </Card>

            {/* ── Insights ──────────────────────────────────── */}
            <Card title="Key Insights" style={styles.sectionCard}>
              <View style={styles.insightsList}>
                {result.insights.map((insight, i) => (
                  <Animated.View
                    key={`insight-${i}`}
                    entering={FadeInDown.delay(100 + i * 60).springify()}
                    style={styles.insightRow}
                  >
                    <View style={[styles.insightBullet, { backgroundColor: `${result.factors[i % result.factors.length]?.color || '#6C63FF'}20` }]}>
                      <Text style={styles.insightBulletIcon}>
                        {result.factors[i % result.factors.length]?.icon || '💡'}
                      </Text>
                    </View>
                    <Text style={styles.insightText}>{insight}</Text>
                  </Animated.View>
                ))}
              </View>
            </Card>

            {/* ── Recommendations ───────────────────────────── */}
            <Card title="Recommendations" style={styles.sectionCard}>
              <View style={styles.recommendationsList}>
                {result.recommendations.map((rec, i) => (
                  <Animated.View
                    key={`rec-${i}`}
                    entering={FadeInDown.delay(100 + i * 80).springify()}
                    style={styles.recRow}
                  >
                    <View style={styles.recNum}>
                      <Text style={styles.recNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.recText}>{rec}</Text>
                  </Animated.View>
                ))}
              </View>
            </Card>

            {/* ── Methodology ───────────────────────────────── */}
            <Card title="Methodology" style={styles.sectionCard}>
              <View style={styles.methodContent}>
                <View style={styles.methodRow}>
                  <Text style={styles.methodIcon}>📈</Text>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodTitle}>Momentum Factor</Text>
                    <Text style={styles.methodDesc}>Price trend strength, sector momentum, and holding period analysis</Text>
                  </View>
                </View>
                <View style={styles.methodDivider} />
                <View style={styles.methodRow}>
                  <Text style={styles.methodIcon}>💎</Text>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodTitle}>Value Factor</Text>
                    <Text style={styles.methodDesc}>P/E ratio, P/B ratio, and dividend yield relative to sector averages</Text>
                  </View>
                </View>
                <View style={styles.methodDivider} />
                <View style={styles.methodRow}>
                  <Text style={styles.methodIcon}>📏</Text>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodTitle}>Size Factor</Text>
                    <Text style={styles.methodDesc}>Market capitalization: large-cap, mid-cap, and small-cap exposure</Text>
                  </View>
                </View>
                <View style={styles.methodDivider} />
                <View style={styles.methodRow}>
                  <Text style={styles.methodIcon}>✨</Text>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodTitle}>Quality Factor</Text>
                    <Text style={styles.methodDesc}>Sector profitability, earnings stability, and P&L performance</Text>
                  </View>
                </View>
                <View style={styles.methodDivider} />
                <View style={styles.methodRow}>
                  <Text style={styles.methodIcon}>🛡️</Text>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodTitle}>Low Volatility Factor</Text>
                    <Text style={styles.methodDesc}>Sector volatility profile, price stability, and drawdown resilience</Text>
                  </View>
                </View>
              </View>
            </Card>
          </Animated.View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ─── Factor colors (from service FACTOR_META) ─────────────────
const FACTOR_COLORS: Record<FactorName, string> = {
  momentum:       FACTOR_META.momentum.color,
  value:          FACTOR_META.value.color,
  size:           FACTOR_META.size.color,
  quality:        FACTOR_META.quality.color,
  low_volatility: FACTOR_META.low_volatility.color,
};

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

  // ── Dominant Style Badge ─────────────────────────────────────
  styleBadgeRow: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    justifyContent: 'center',
  },
  styleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.25)',
  },
  styleBadgeLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  styleBadgeValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: '#6C63FF',
  },

  // ── Factor Exposures ─────────────────────────────────────────
  factorsList: {
    gap: 0,
    paddingTop: SPACING.md,
  },
  factorRow: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  factorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  factorIcon: {
    fontSize: 18,
  },
  factorLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
    flex: 1,
  },
  tiltBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  tiltText: {
    ...FONTS.medium,
    fontSize: 10,
  },
  scoreBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  scoreBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: colors.bgInput,
    borderRadius: 5,
    position: 'relative',
    overflow: 'visible',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  benchmarkLine: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 16,
    backgroundColor: colors.textMuted,
    borderRadius: 1,
  },
  scoreLabels: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
    minWidth: 80,
    justifyContent: 'flex-end',
  },
  scoreText: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  benchmarkText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  factorDetail: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
  },
  factorInterpretation: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },

  // ── Stock Contributions ──────────────────────────────────────
  contributionsList: {
    paddingTop: SPACING.md,
  },
  showAllBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
  },
  showAllBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.primary,
  },
  contribHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  contribHeaderCell: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
    flex: 1,
  },
  contribRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  contribRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  contribStockCell: {
    flex: 2,
    gap: 2,
  },
  contribSymbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  contribName: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  contribValue: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  contribDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    flex: 1,
    maxWidth: 14,
    alignSelf: 'center',
  },

  // ── Insights ─────────────────────────────────────────────────
  insightsList: {
    gap: 0,
    paddingTop: SPACING.md,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  insightBullet: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightBulletIcon: {
    fontSize: 14,
  },
  insightText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  // ── Recommendations ──────────────────────────────────────────
  recommendationsList: {
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
  recNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recNumText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xs,
    color: colors.primary,
  },
  recText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  // ── Methodology ──────────────────────────────────────────────
  methodContent: {
    gap: 0,
    paddingTop: SPACING.md,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  methodIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  methodDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },
  methodDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
});
