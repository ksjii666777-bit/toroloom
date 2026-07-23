/**
 * ============================================================================
 * Toroloom — Capital Gains Summary Screen
 * ============================================================================
 *
 * Comprehensive capital gains tax optimization dashboard:
 *   - Tax year selector (2024-25, 2025-26, 2026-27)
 *   - Summary cards: STCG, LTCG, total tax, unrealized gains
 *   - STCG vs LTCG breakdown with visual bars
 *   - Tax-saving recommendations based on current position
 *   - Tax rules reference
 *
 * Uses both:
 *   - Backend: GET /api/analytics/tax-summary?fiscalYear=YYYY-YY
 *   - Frontend: portfolioAnalyticsStore for real-time capital gains
 *
 * ============================================================================
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { usePortfolioAnalyticsStore } from '../../store/portfolioAnalyticsStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';
import { api } from '../../services/api';

const { width } = Dimensions.get('window');

// ──── Types ────────────────────────────────────────────────────────────────

interface TaxSummaryResponse {
  fiscalYear: string;
  totalRealizedGains: number;
  totalUnrealizedGains: number;
  shortTermGains: number;
  longTermGains: number;
  estimatedTaxSTCG: number;
  estimatedTaxLTCG: number;
  taxableGains: number;
  tradeCount: number;
}

// ──── Fiscal Year Generator ────────────────────────────────────────────────

function getFiscalYearOptions(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // Indian FY: Apr 1 to Mar 31
  const currentFYStart = month >= 3 ? year : year - 1;
  return [
    `${currentFYStart - 1}-${String(currentFYStart).slice(2)}`,
    `${currentFYStart}-${String(currentFYStart + 1).slice(2)}`,
    `${currentFYStart + 1}-${String(currentFYStart + 2).slice(2)}`,
  ];
}

function formatFiscalYear(fy: string): string {
  return `FY ${fy}`;
}

// ──── Tax Breakdown Bar ────────────────────────────────────────────────────

function TaxBar({ label, amount, maxAmount, color, prefix }: {
  label: string;
  amount: number;
  maxAmount: number;
  color: string;
  prefix?: string;
}) {
  const { colors } = useTheme();
  const pct = maxAmount > 0 ? Math.abs(amount) / maxAmount : 0;
  const absAmt = Math.abs(amount);

  return (
    <View style={taxBarStyles.row}>
      <View style={taxBarStyles.labelRow}>
        <View style={[taxBarStyles.dot, { backgroundColor: color }]} />
        <Text style={[taxBarStyles.label, { color: colors.text }]}>{label}</Text>
      </View>
      <View style={taxBarStyles.barTrack}>
        <View
          style={[
            taxBarStyles.barFill,
            {
              width: `${Math.min(pct * 100, 100)}%`,
              backgroundColor: amount >= 0 ? color : colors.danger,
            },
          ]}
        />
      </View>
      <Text style={[taxBarStyles.amount, { color: amount >= 0 ? colors.text : colors.danger }]}>
        {prefix || ''}₹{absAmt.toLocaleString()}
      </Text>
    </View>
  );
}

const taxBarStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 90,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  amount: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    width: 85,
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

// ──── Recommendation Card ──────────────────────────────────────────────────

function RecommendationCard({ icon, title, description, color, type }: {
  icon: string;
  title: string;
  description: string;
  color: string;
  type: 'tip' | 'warning' | 'info';
}) {
  const { colors } = useTheme();
  const bgColor = type === 'warning' ? '#FF525215' : type === 'tip' ? '#00E67615' : '#3B82F615';
  const borderColor = type === 'warning' ? '#FF525230' : type === 'tip' ? '#00E67630' : '#3B82F630';

  return (
    <View style={[recCardStyles.card, { backgroundColor: bgColor, borderColor }]}>
      <Text style={recCardStyles.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[recCardStyles.title, { color }]}>{title}</Text>
        <Text style={[recCardStyles.desc, { color: colors.textMuted }]}>{description}</Text>
      </View>
    </View>
  );
}

const recCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  icon: {
    fontSize: 24,
    marginTop: 2,
  },
  title: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    marginBottom: 4,
  },
  desc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    lineHeight: 16,
  },
});

// ──── Main Screen ──────────────────────────────────────────────────────────

export default function CapitalGainsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const fyOptions = useMemo(() => getFiscalYearOptions(), []);
  const [selectedFY, setSelectedFY] = useState(fyOptions[1]); // current FY
  const [taxData, setTaxData] = useState<TaxSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Portfolio analytics for real-time capital gains
  const analytics = usePortfolioAnalyticsStore(s => s.getAnalytics());
  const capitalGains = analytics.capitalGains;

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const response: { data: TaxSummaryResponse } = await api.get(`/analytics/tax-summary?fiscalYear=${selectedFY}`) as any;
      setTaxData(response.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load tax summary');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFY]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Derived recommendations ──────────────────────────────────────────

  const recommendations = useMemo(() => {
    const recs: Array<{ icon: string; title: string; description: string; color: string; type: 'tip' | 'warning' | 'info' }> = [];

    if (!taxData) return recs;

    if (taxData.shortTermGains > 0 && taxData.estimatedTaxSTCG > 0) {
      recs.push({
        icon: '⚠️',
        title: 'High STCG Tax Exposure',
        description: `You have ₹${taxData.shortTermGains.toLocaleString()} in short-term gains. Consider holding positions &gt;12 months to qualify for LTCG treatment at 10% (over ₹1L exemption) instead of 15% STCG rate.`,
        color: '#FFC107',
        type: 'warning',
      });
    }

    if (taxData.longTermGains > 100000) {
      const taxableLTCG = taxData.longTermGains - 100000;
      recs.push({
        icon: '📊',
        title: 'LTCG Above ₹1L Exemption',
        description: `Your LTCG of ₹${taxData.longTermGains.toLocaleString()} exceeds the ₹1L exemption by ₹${taxableLTCG.toLocaleString()}. Estimated LTCG tax: ₹${taxData.estimatedTaxLTCG.toLocaleString()}. Consider tax harvesting to offset gains.`,
        color: '#FF5252',
        type: 'warning',
      });
    }

    if (taxData.totalUnrealizedGains < 0) {
      const lossAmt = Math.abs(taxData.totalUnrealizedGains);
      recs.push({
        icon: '🌾',
        title: 'Tax Harvesting Opportunity',
        description: `You have ₹${lossAmt.toLocaleString()} in unrealized losses. Harvest these losses before year-end to offset capital gains and reduce your tax liability.`,
        color: '#00E676',
        type: 'tip',
      });
    }

    if (taxData.tradeCount === 0) {
      recs.push({
        icon: 'ℹ️',
        title: 'No Trades Yet',
        description: 'Start trading to build your capital gains profile. Tax summary will update automatically as you trade.',
        color: '#3B82F6',
        type: 'info',
      });
    }

    // Portfolio-level recommendation
    if (capitalGains) {
      const portfolioSTCG = capitalGains.shortTerm?.gains || 0;
      if (portfolioSTCG < 0) {
        recs.push({
          icon: '✅',
          title: 'STCL Can Offset Both STCG & LTCG',
          description: `Your short-term capital loss of ₹${Math.abs(portfolioSTCG).toLocaleString()} can offset both short-term and long-term capital gains, effectively reducing your total tax.`,
          color: '#00E676',
          type: 'tip',
        });
      }
    }

    if (taxData.totalRealizedGains < 0) {
      recs.push({
        icon: '📅',
        title: 'Loss Carry Forward Available',
        description: `Net realized loss of ₹${Math.abs(taxData.totalRealizedGains).toLocaleString()} can be carried forward for up to 8 assessment years. Short-term losses offset both STCG and LTCG.`,
        color: '#3B82F6',
        type: 'info',
      });
    }

    return recs;
  }, [taxData, capitalGains]);

  // ── Max amount for tax bars ──────────────────────────────────────────

  const maxTaxAmount = useMemo(() => {
    if (!taxData) return 1;
    return Math.max(
      Math.abs(taxData.shortTermGains),
      Math.abs(taxData.longTermGains),
      Math.abs(taxData.totalRealizedGains),
      Math.abs(taxData.totalUnrealizedGains),
      1,
    );
  }, [taxData]);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.bgSecondary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </AnimatedPressable>
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={[styles.title, { color: colors.text }]}>Capital Gains</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Tax summary & optimization
              </Text>
            </View>
          </View>
        </View>

        {/* Fiscal Year Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fyScroll}>
          {fyOptions.map(fy => {
            const isActive = fy === selectedFY;
            return (
              <Pressable
                key={fy}
                onPress={() => setSelectedFY(fy)}
                style={[
                  styles.fyChip,
                  {
                    backgroundColor: isActive ? colors.primary + '20' : colors.bgInput,
                    borderColor: isActive ? colors.primary + '40' : colors.border,
                  },
                ]}
              >
                <Text style={[styles.fyChipText, { color: isActive ? colors.primary : colors.textMuted }]}>
                  {formatFiscalYear(fy)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Loading / Error / Data */}
        {loading && !taxData && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading tax data...</Text>
          </View>
        )}

        {error && !loading && (
          <View style={[styles.errorCard, { backgroundColor: colors.danger + '10', borderColor: colors.danger + '25' }]}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
            <AnimatedPressable onPress={() => loadData()} haptic="light" scaleTo={0.95}>
              <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
            </AnimatedPressable>
          </View>
        )}

        {taxData && (
          <>
            {/* ── Summary Cards ── */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: '#FFC10718' }]}>
                  <Ionicons name="trending-up" size={20} color="#FFC107" />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  ₹{taxData.shortTermGains.toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>STCG (15%)</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: '#3B82F618' }]}>
                  <Ionicons name="trending-down" size={20} color="#3B82F6" />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  ₹{taxData.longTermGains.toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>LTCG (10%)</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: '#EF444418' }]}>
                  <Ionicons name="cash" size={20} color="#EF4444" />
                </View>
                <Text style={[styles.statValue, { color: colors.danger }]}>
                  ₹{(taxData.estimatedTaxSTCG + taxData.estimatedTaxLTCG).toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Tax</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: '#8B5CF618' }]}>
                  <Ionicons name="pie-chart" size={20} color="#8B5CF6" />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  ₹{taxData.taxableGains.toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Taxable Gains</Text>
              </View>
            </View>

            {/* ── Tax Breakdown Bars ── */}
            <Card title="Tax Breakdown" style={styles.card}>
              <TaxBar
                label="STCG"
                amount={taxData.shortTermGains}
                maxAmount={maxTaxAmount}
                color="#FFC107"
              />
              <TaxBar
                label="LTCG"
                amount={taxData.longTermGains}
                maxAmount={maxTaxAmount}
                color="#3B82F6"
              />
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              <TaxBar
                label="Realized"
                amount={taxData.totalRealizedGains}
                maxAmount={maxTaxAmount}
                color="#8B5CF6"
              />
              <TaxBar
                label="Unrealized"
                amount={taxData.totalUnrealizedGains}
                maxAmount={maxTaxAmount}
                color="#10B981"
              />
            </Card>

            {/* ── Tax Liability Breakdown ── */}
            <Card title="Estimated Tax Liability" style={styles.card}>
              <View style={styles.taxRow}>
                <Text style={[styles.taxLabel, { color: colors.textSecondary }]}>STCG Tax (15%)</Text>
                <Text style={[styles.taxValue, { color: '#FFC107' }]}>
                  ₹{taxData.estimatedTaxSTCG.toLocaleString()}
                </Text>
              </View>
              <View style={styles.taxRow}>
                <Text style={[styles.taxLabel, { color: colors.textSecondary }]}>
                  LTCG Tax (10% over ₹1L)
                </Text>
                <Text style={[styles.taxValue, { color: '#3B82F6' }]}>
                  ₹{taxData.estimatedTaxLTCG.toLocaleString()}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              <View style={styles.taxRow}>
                <Text style={[styles.taxLabelBold, { color: colors.text }]}>Total Estimated Tax</Text>
                <Text style={[styles.taxValueBold, { color: colors.danger }]}>
                  ₹{(taxData.estimatedTaxSTCG + taxData.estimatedTaxLTCG).toLocaleString()}
                </Text>
              </View>
              <View style={styles.taxRow}>
                <Text style={[styles.taxLabel, { color: colors.textSecondary }]}>Trades Analyzed</Text>
                <Text style={[styles.taxValue, { color: colors.text }]}>{taxData.tradeCount}</Text>
              </View>
            </Card>

            {/* ── Portfolio Capital Gains (frontend data) ── */}
            {capitalGains && (
              <Card title="Portfolio Capital Gains" style={styles.card}>
                <View style={styles.taxRow}>
                  <Text style={[styles.taxLabel, { color: colors.textSecondary }]}>
                    Short-Term Gains
                  </Text>
                  <Text
                    style={[
                      styles.taxValue,
                      { color: (capitalGains.shortTerm?.gains || 0) >= 0 ? colors.marketUp : colors.marketDown },
                    ]}
                  >
                    ₹{((capitalGains.shortTerm?.gains || 0)).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.taxRow}>
                  <Text style={[styles.taxLabel, { color: colors.textSecondary }]}>
                    Long-Term Gains
                  </Text>
                  <Text
                    style={[
                      styles.taxValue,
                      { color: (capitalGains.longTerm?.gains || 0) >= 0 ? colors.marketUp : colors.marketDown },
                    ]}
                  >
                    ₹{((capitalGains.longTerm?.gains || 0)).toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                <View style={styles.taxRow}>
                  <Text style={[styles.taxLabelBold, { color: colors.text }]}>Total CG</Text>
                  <Text
                    style={[
                      styles.taxValueBold,
                      {
                        color: ((capitalGains.shortTerm?.gains || 0) + (capitalGains.longTerm?.gains || 0)) >= 0
                          ? colors.marketUp
                          : colors.marketDown,
                      },
                    ]}
                  >
                    ₹{((capitalGains.shortTerm?.gains || 0) + (capitalGains.longTerm?.gains || 0)).toLocaleString()}
                  </Text>
                </View>
              </Card>
            )}

            {/* ── Recommendations ── */}
            {recommendations.length > 0 && (
              <Card title="Tax Optimization Tips" style={styles.card}>
                {recommendations.map((rec, i) => (
                  <RecommendationCard key={i} {...rec} />
                ))}
              </Card>
            )}

            {/* ── Tax Rules Reference ── */}
            <Card title="Tax Rules (India FY 2025-26)" style={styles.card}>
              <View style={styles.ruleRow}>
                <View style={[styles.ruleDot, { backgroundColor: '#FFC107' }]} />
                <Text style={[styles.ruleLabel, { color: colors.text }]}>STCG (Equity)</Text>
                <Text style={[styles.ruleDesc, { color: colors.textMuted }]}>
                  Held ≤12 months · 15% tax
                </Text>
              </View>
              <View style={styles.ruleRow}>
                <View style={[styles.ruleDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={[styles.ruleLabel, { color: colors.text }]}>LTCG (Equity)</Text>
                <Text style={[styles.ruleDesc, { color: colors.textMuted }]}>
                  Held &gt;12 months · 10% over ₹1L exemption
                </Text>
              </View>
              <View style={styles.ruleRow}>
                <View style={[styles.ruleDot, { backgroundColor: '#00E676' }]} />
                <Text style={[styles.ruleLabel, { color: colors.text }]}>STCL Offset</Text>
                <Text style={[styles.ruleDesc, { color: colors.textMuted }]}>
                  Can offset both STCG & LTCG
                </Text>
              </View>
              <View style={styles.ruleRow}>
                <View style={[styles.ruleDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={[styles.ruleLabel, { color: colors.text }]}>LTCL Offset</Text>
                <Text style={[styles.ruleDesc, { color: colors.textMuted }]}>
                  Can offset LTCG only · Carry forward 8 years
                </Text>
              </View>
            </Card>
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ──── Styles ──────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.xxl,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  header: {
    paddingTop: 60,
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 2,
  },
  fyScroll: {
    marginBottom: SPACING.lg,
  },
  fyChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  fyChipText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  statCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  card: {
    marginBottom: SPACING.lg,
  },
  divider: {
    height: 1,
    marginVertical: SPACING.sm,
  },
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  taxLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
  taxLabelBold: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  taxValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  taxValueBold: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  ruleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ruleLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    width: 80,
  },
  ruleDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    flex: 1,
  },
  loadingText: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    marginTop: SPACING.md,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  errorText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    flex: 1,
  },
  retryText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
});
