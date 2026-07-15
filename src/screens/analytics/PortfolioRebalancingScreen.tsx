import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Platform,
} from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRebalanceStore } from '../../store/rebalanceStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { AllocationProfile, RebalanceTrade } from '../../types';

/** Format currency in INR */
const formatINR = (val: number) =>
  '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function PortfolioRebalancingScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    portfolioValue, currentAllocation, profiles, selectedProfileId,
    analysis, isAnalyzing, selectProfile, runAnalysis, resetToDefaults,
  } = useRebalanceStore();
  const [showAllSectors, setShowAllSectors] = useState(false);

  // Run analysis on mount
  useEffect(() => {
    runAnalysis();
  }, []);

  const selectedProfile = useMemo(
    () => profiles.find(p => p.id === selectedProfileId) || profiles[1],
    [profiles, selectedProfileId],
  );

  const sortedTrades = useMemo(() => {
    if (!analysis) return [];
    return [...analysis.suggestedTrades].sort((a, b) => b.priority - a.priority);
  }, [analysis]);

  const displaySectors = showAllSectors
    ? currentAllocation
    : currentAllocation.slice(0, 5);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio Rebalancing</Text>
          <Text style={styles.subtitle}>
            Optimize your allocation — Portfolio: {formatINR(portfolioValue)}
          </Text>
        </View>

        {/* ── Allocation Profile Selector ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target Profile</Text>
          <View style={styles.profileRow}>
            {profiles.map(p => {
              const isActive = p.id === selectedProfileId;
              const riskColor = p.riskLevel === 'conservative' ? '#00C853' :
                p.riskLevel === 'moderate' ? '#FFC107' : '#FF5252';
              return (
                <AnimatedPressable
                  key={p.id}
                  onPress={() => selectProfile(p.id)}
                  haptic="selection"
                  scaleTo={0.94}
                >
                  <View style={[
                    styles.profileCard,
                    isActive && { borderColor: riskColor, backgroundColor: riskColor + '10' },
                  ]}>
                    <Text style={[styles.profileName, isActive && { color: riskColor }]}>{p.name}</Text>
                    <Text style={[styles.profileRisk, { color: riskColor }]}>
                      {p.riskLevel.charAt(0).toUpperCase() + p.riskLevel.slice(1)}
                    </Text>
                    <Text style={styles.profileDesc} numberOfLines={2}>{p.description}</Text>
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        {/* ── Analysis Summary Cards ── */}
        {isAnalyzing ? (
          <View style={styles.loadingState}>
            <Ionicons name="sync" size={32} color={colors.primary} />
            <Text style={styles.loadingText}>Analyzing portfolio...</Text>
          </View>
        ) : analysis && (
          <>
            <Animated.View entering={FadeInDown.springify()} style={styles.summaryRow}>
              <View style={[styles.summaryCard, { borderLeftColor: '#6C63FF' }]}>
                <Text style={styles.summaryLabel}>Deviations</Text>
                <Text style={[styles.summaryValue, { color: '#6C63FF' }]}>{analysis.deviationCount}</Text>
              </View>
              <View style={[styles.summaryCard, { borderLeftColor: '#FFC107' }]}>
                <Text style={styles.summaryLabel}>Avg Deviation</Text>
                <Text style={[styles.summaryValue, { color: '#FFC107' }]}>{analysis.avgDeviation}%</Text>
              </View>
              <View style={[styles.summaryCard, { borderLeftColor: '#FF5252' }]}>
                <Text style={styles.summaryLabel}>Trade Amount</Text>
                <Text style={[styles.summaryValue, { color: '#FF5252', fontSize: 14 }]}>
                  {formatINR(analysis.totalTradeAmount)}
                </Text>
              </View>
            </Animated.View>

            {/* ── Current vs Target Allocation ── */}
            <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Current vs Target Allocation</Text>
                <AnimatedPressable
                  onPress={() => setShowAllSectors(!showAllSectors)}
                  haptic="selection"
                  scaleTo={0.94}
                >
                  <Text style={styles.seeAllText}>
                    {showAllSectors ? 'Show Less' : `Show All (${currentAllocation.length})`}
                  </Text>
                </AnimatedPressable>
              </View>

              {displaySectors.map((sector, idx) => {
                const target = selectedProfile.targets.find(t => t.label === sector.label);
                if (!target) return null;
                const diff = target.percent - sector.currentPercent;
                const diffAbs = Math.abs(diff);
                const isOverweight = diff < 0;

                return (
                  <Animated.View
                    key={sector.label}
                    entering={FadeInDown.delay(idx * 40).springify()}
                    layout={LinearTransition.springify()}
                  >
                    <View style={styles.allocationRow}>
                      <View style={styles.allocationLeft}>
                        <Text style={styles.allocationIcon}>{sector.icon}</Text>
                        <Text style={styles.allocationLabel}>{sector.label}</Text>
                      </View>
                      <View style={styles.allocationBars}>
                        {/* Current bar */}
                        <View style={styles.allocationBarRow}>
                          <View style={[styles.allocationBar, { width: `${sector.currentPercent}%`, backgroundColor: sector.color }]} />
                        </View>
                        {/* Target bar */}
                        <View style={styles.allocationBarRow}>
                          <View style={[styles.allocationBar, { width: `${target.percent}%`, backgroundColor: sector.color + '50' }]} />
                        </View>
                      </View>
                      <View style={styles.allocationRight}>
                        <Text style={styles.allocationPct}>{sector.currentPercent}%</Text>
                        <Text style={styles.allocationTarget}>{target.percent}%</Text>
                        {diffAbs >= 1 && (
                          <View style={[
                            styles.diffBadge,
                            { backgroundColor: isOverweight ? '#FF525220' : '#00C85320' },
                          ]}>
                            <Ionicons
                              name={isOverweight ? 'arrow-down' : 'arrow-up'}
                              size={10}
                              color={isOverweight ? '#FF5252' : '#00C853'}
                            />
                            <Text style={[
                              styles.diffText,
                              { color: isOverweight ? '#FF5252' : '#00C853' },
                            ]}>{diffAbs.toFixed(1)}%</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
            </Animated.View>

            {/* ── Suggested Trades ── */}
            <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
              <Text style={styles.sectionTitle}>
                Suggested Trades ({sortedTrades.length})
              </Text>

              {sortedTrades.length === 0 ? (
                <View style={styles.perfectAllocation}>
                  <Ionicons name="checkmark-circle" size={48} color="#00C853" />
                  <Text style={styles.perfectText}>Perfect Allocation!</Text>
                  <Text style={styles.perfectSubtext}>No changes needed.</Text>
                </View>
              ) : (
                sortedTrades.map((trade, idx) => (
                  <Animated.View
                    key={trade.id}
                    entering={FadeInDown.delay(idx * 40 + 100).springify()}
                    layout={LinearTransition.springify()}
                  >
                    <TradeCard trade={trade} colors={colors} styles={styles} />
                  </Animated.View>
                ))
              )}
            </Animated.View>

            {/* ── Tax Impact Summary ── */}
            {analysis.estimatedTaxImpact > 0 && (
              <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.taxCard}>
                <View style={styles.taxLeft}>
                  <Ionicons name="calculator-outline" size={20} color="#FFC107" />
                  <View>
                    <Text style={styles.taxTitle}>Estimated Tax Impact</Text>
                    <Text style={styles.taxDesc}>
                      Selling overweight positions may incur short-term capital gains tax.
                    </Text>
                  </View>
                </View>
                <Text style={styles.taxAmount}>{formatINR(analysis.estimatedTaxImpact)}</Text>
              </Animated.View>
            )}

            {/* ── Action Buttons ── */}
            <View style={styles.actionRow}>
              <AnimatedPressable onPress={resetToDefaults} haptic="medium" scaleTo={0.97}>
                <View style={styles.resetBtn}>
                  <Ionicons name="refresh" size={18} color={colors.textMuted} />
                  <Text style={styles.resetBtnText}>Reset</Text>
                </View>
              </AnimatedPressable>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Trade Card Component ─────────────────────────────────────────────────

function TradeCard({ trade, colors, styles }: { trade: RebalanceTrade; colors: any; styles: any }) {
  const isSell = trade.action === 'sell';
  const actionColor = isSell ? '#FF5252' : '#00C853';

  return (
    <View style={[styles.tradeCard, { borderLeftColor: trade.color, borderLeftWidth: 3 }]}>
      {/* Header */}
      <View style={styles.tradeHeader}>
        <View style={styles.tradeHeaderLeft}>
          <View style={[styles.tradeActionBadge, { backgroundColor: actionColor + '20' }]}>
            <Ionicons
              name={isSell ? 'arrow-down' : 'arrow-up'}
              size={14}
              color={actionColor}
            />
            <Text style={[styles.tradeActionText, { color: actionColor }]}>
              {isSell ? 'SELL' : 'BUY'}
            </Text>
          </View>
          <Text style={styles.tradeLabel}>{trade.label}</Text>
        </View>
        <Text style={[styles.tradeAmount, { color: actionColor }]}>
          {isSell ? '-' : '+'}{formatINR(trade.amount)}
        </Text>
      </View>

      {/* Allocation Bars */}
      <View style={styles.tradeAllocRow}>
        <View style={styles.tradeAllocItem}>
          <Text style={styles.tradeAllocLabel}>Current</Text>
          <Text style={[styles.tradeAllocValue, { color: colors.text }]}>{trade.currentPercent}%</Text>
        </View>
        <View style={styles.tradeAllocArrow}>
          <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
        </View>
        <View style={styles.tradeAllocItem}>
          <Text style={styles.tradeAllocLabel}>Target</Text>
          <Text style={[styles.tradeAllocValue, { color: colors.primary }]}>{trade.targetPercent}%</Text>
        </View>
      </View>

      {/* Reason */}
      <Text style={styles.tradeReason}>{trade.reason}</Text>

      {/* Footer: Priority + Tax flag */}
      <View style={styles.tradeFooter}>
        <View style={[styles.priorityBadge, { backgroundColor: trade.priority > 50 ? '#FF525220' : trade.priority > 25 ? '#FFC10720' : '#00C85320' }]}>
          <Ionicons name="flag" size={10} color={trade.priority > 50 ? '#FF5252' : trade.priority > 25 ? '#FFC107' : '#00C853'} />
          <Text style={[styles.priorityText, { color: trade.priority > 50 ? '#FF5252' : trade.priority > 25 ? '#FFC107' : '#00C853' }]}>
            Priority {trade.priority}
          </Text>
        </View>
        {trade.hasTaxImplication && (
          <View style={[styles.taxBadge, { backgroundColor: '#FFC10715' }]}>
            <Ionicons name="warning" size={10} color="#FFC107" />
            <Text style={styles.taxBadgeText}>Tax: {formatINR(trade.estimatedTaxCost || 0)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  header: {
    paddingTop: 60,
    marginBottom: SPACING.lg,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  seeAllText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  profileRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  profileCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  profileName: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  profileRisk: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  profileDesc: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
    lineHeight: 13,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
  },
  summaryLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  summaryValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
    marginTop: 4,
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.md,
  },
  loadingText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  allocationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 100,
  },
  allocationIcon: {
    fontSize: 16,
  },
  allocationLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  allocationBars: {
    flex: 1,
    gap: 3,
  },
  allocationBarRow: {
    height: 6,
    backgroundColor: colors.bgCardLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  allocationBar: {
    height: '100%',
    borderRadius: 3,
  },
  allocationRight: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 60,
  },
  allocationPct: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  allocationTarget: {
    ...FONTS.regular,
    fontSize: 10,
    color: colors.textMuted,
  },
  diffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  diffText: {
    ...FONTS.medium,
    fontSize: 9,
  },
  tradeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  tradeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  tradeActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  tradeActionText: {
    ...FONTS.bold,
    fontSize: 10,
  },
  tradeLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  tradeAmount: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  tradeAllocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: colors.bgCardLight,
    borderRadius: BORDER_RADIUS.sm,
  },
  tradeAllocItem: {
    alignItems: 'center',
    gap: 2,
  },
  tradeAllocLabel: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
  },
  tradeAllocValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  tradeAllocArrow: {
    marginTop: 12,
  },
  tradeReason: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  tradeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  priorityText: {
    ...FONTS.medium,
    fontSize: 9,
  },
  taxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  taxBadgeText: {
    ...FONTS.medium,
    fontSize: 9,
    color: '#FFC107',
  },
  perfectAllocation: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: SPACING.md,
  },
  perfectText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: '#00C853',
  },
  perfectSubtext: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  taxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#FFC10730',
    marginBottom: SPACING.lg,
  },
  taxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  taxTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  taxDesc: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },
  taxAmount: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: '#FFC107',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
});
