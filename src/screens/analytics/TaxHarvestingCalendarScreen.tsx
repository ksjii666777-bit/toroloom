/**
 * ============================================================================
 * Toroloom — Tax Harvesting Calendar Screen
 * ============================================================================
 *
 * Capital gains tax optimization tool:
 *   - Tax year summary with savings potential
 *   - Realized losses from closed trades
 *   - Harvesting opportunities from current holdings
 *   - Wash sale warnings
 *   - Interactive "what-if" simulator for harvesting scenarios
 *   - Financial calendar with key tax dates
 *
 * Navigation: More → Investments → Tax Harvesting
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Dimensions, Platform,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { usePortfolioStore } from '../../store/portfolioStore';
import { usePortfolioAnalyticsStore } from '../../store/portfolioAnalyticsStore';
import {
  computeTaxYearSummary,
  computeRealizedLosses,
  findHarvestOpportunities,
  generateMockHoldings,
  generateMockTrades,
} from '../../services/taxHarvestingService';
import type { TaxHarvestOpportunity, RealizedLoss } from '../../types';

const { width } = Dimensions.get('window');

// ==================== Color Helpers ====================

function scoreColor(score: number): string {
  if (score >= 70) return '#00E676';
  if (score >= 40) return '#FFC107';
  return '#FF5252';
}

function recColor(rec: TaxHarvestOpportunity['recommendation']): string {
  switch (rec) {
    case 'harvest_now': return '#00E676';
    case 'wait_long_term': return '#FFC107';
    case 'avoid': return '#FF5252';
  }
}

// ==================== MAIN SCREEN ====================

type TabKey = 'opportunities' | 'losses' | 'simulator';

export default function TaxHarvestingCalendarScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('opportunities');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [useSample, setUseSample] = useState(false);
  const [selectedLossType, setSelectedLossType] = useState<'all' | 'short_term' | 'long_term'>('all');

  // Get real portfolio data
  const { holdings: realHoldings, trades: realTrades } = usePortfolioStore();
  const { getAnalytics } = usePortfolioAnalyticsStore();

  // Use sample data if user chooses or if no holdings exist
  const holdings = useMemo(() => {
    if (useSample || realHoldings.length === 0) return generateMockHoldings();
    return realHoldings;
  }, [realHoldings, useSample]);

  const trades = useMemo(() => {
    if (useSample || realTrades.length === 0) return generateMockTrades();
    return realTrades;
  }, [realTrades, useSample]);

  const summary = useMemo(() => computeTaxYearSummary(holdings, trades), [holdings, trades]);
  const realizedLossesAll = useMemo(() => computeRealizedLosses(trades), [trades]);
  const opportunities = useMemo(() => findHarvestOpportunities(holdings, trades), [holdings, trades]);

  const harvestNow = useMemo(() => opportunities.filter(o => o.recommendation === 'harvest_now'), [opportunities]);
  const waitLongTerm = useMemo(() => opportunities.filter(o => o.recommendation === 'wait_long_term'), [opportunities]);
  const avoidHarvest = useMemo(() => opportunities.filter(o => o.recommendation === 'avoid'), [opportunities]);

  // Filter realized losses by type
  const filteredLosses = useMemo(() => {
    if (selectedLossType === 'all') return realizedLossesAll;
    return realizedLossesAll.filter(r => r.holdingType === selectedLossType);
  }, [realizedLossesAll, selectedLossType]);

  // ── Simulator State ──
  const [harvestQty, setHarvestQty] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleUseSample = useCallback(() => {
    setUseSample(true);
  }, []);

  // Compute simulator results
  const simulatorResult = useMemo(() => {
    if (!showResults) return null;
    let totalLoss = 0;
    let totalSavings = 0;
    for (const opp of harvestNow) {
      const qty = harvestQty[opp.id] || opp.quantity;
      const ratio = qty / opp.quantity;
      totalLoss += opp.unrealizedLoss * ratio;
      totalSavings += opp.potentialTaxSaved * ratio;
    }
    const analytics = getAnalytics();
    const cg = analytics.capitalGains;
    const originalTax = cg.totalEstimatedTax;
    const newTax = Math.max(0, originalTax - totalSavings);
    return {
      totalLossHarvested: Math.round(totalLoss * 100) / 100,
      totalTaxSaved: Math.round(totalSavings * 100) / 100,
      originalTax: Math.round(originalTax * 100) / 100,
      newTax: Math.round(newTax * 100) / 100,
    };
  }, [showResults, harvestQty, harvestNow, getAnalytics]);

  // ── Financial Calendar Dates ──
  const taxCalendar = useMemo(() => [
    { month: 'Apr', date: '1 Apr', label: 'FY 2026-27 Begins', icon: 'calendar', color: '#3B82F6' },
    { month: 'Jun', date: '15 Jun', label: 'Advance Tax Due (Q1)', icon: 'warning', color: '#FFC107' },
    { month: 'Jul', date: '31 Jul', label: 'ITR Filing Begins', icon: 'document-text', color: '#00E676' },
    { month: 'Sep', date: '15 Sep', label: 'Advance Tax Due (Q2)', icon: 'warning', color: '#FFC107' },
    { month: 'Sep', date: '30 Sep', label: 'Tax Harvesting Cutoff', icon: 'cut', color: '#FF5252' },
    { month: 'Dec', date: '15 Dec', label: 'Advance Tax Due (Q3)', icon: 'warning', color: '#FFC107' },
    { month: 'Jan', date: '31 Jan', label: 'LTCG ₹1L Exemption Reset', icon: 'refresh', color: '#FF5252' },
    { month: 'Mar', date: '15 Mar', label: 'Advance Tax Due (Q4)', icon: 'warning', color: '#FFC107' },
    { month: 'Mar', date: '31 Mar', label: 'FY 2025-26 Ends', icon: 'flag', color: '#FF5252' },
    { month: 'Jul', date: '31 Jul', label: 'ITR Filing Due', icon: 'alert', color: '#FF5252' },
    { month: 'Dec', date: '31 Dec', label: 'ITR Revision Due', icon: 'document', color: '#3B82F6' },
  ], []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Tax Harvesting</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Capital Gains Optimization</Text>
          </View>
          <View style={[styles.fyBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.fyText, { color: colors.primary }]}>{summary.fiscalYear}</Text>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { borderColor: '#00E67630' }]}>
            <Text style={styles.summaryIcon}>💰</Text>
            <Text style={[styles.summaryValue, { color: '#00E676' }]}>
              ₹{(summary.estimatedTaxSavings / 1000).toFixed(1)}K
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Tax Saved</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: summary.estimatedTaxLiability > 0 ? '#FF525230' : '#00E67630' }]}>
            <Text style={styles.summaryIcon}>📋</Text>
            <Text style={[styles.summaryValue, { color: summary.estimatedTaxLiability > 0 ? '#FF5252' : '#00E676' }]}>
              ₹{(summary.estimatedTaxLiability / 1000).toFixed(1)}K
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Est. Tax Due</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: '#8B5CF630' }]}>
            <Text style={styles.summaryIcon}>📊</Text>
            <Text style={[styles.summaryValue, { color: '#8B5CF6' }]}>
              ₹{(summary.totalRealizedLosses / 1000).toFixed(1)}K
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Realized Losses</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: '#3B82F630' }]}>
            <Text style={styles.summaryIcon}>🎯</Text>
            <Text style={[styles.summaryValue, { color: '#3B82F6' }]}>
              {opportunities.length}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Opportunities</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {[
            { key: 'opportunities' as TabKey, label: 'Opportunities', icon: 'leaf' },
            { key: 'losses' as TabKey, label: 'Realized Losses', icon: 'trending-down' },
            { key: 'simulator' as TabKey, label: 'Simulator', icon: 'flask' },
          ].map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => { setActiveTab(tab.key); setExpandedId(null); }}
                style={[styles.tabBtn, { backgroundColor: isActive ? colors.primary + '20' : 'transparent', borderColor: isActive ? colors.primary + '40' : 'transparent' }]}
              >
                <Ionicons name={tab.icon as any} size={14} color={isActive ? colors.primary : colors.textMuted} />
                <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.textMuted }]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Use Sample Button ── */}
        {!useSample && realHoldings.length === 0 && (
          <Pressable onPress={handleUseSample} style={[styles.sampleBtn, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="flask" size={16} color={colors.primary} />
            <Text style={[styles.sampleBtnText, { color: colors.primary }]}>Use Sample Portfolio</Text>
          </Pressable>
        )}

        {/* ════════════════════════════════════
            TAB: Opportunities
            ════════════════════════════════════ */}
        {activeTab === 'opportunities' && (
          <View>
            {/* Insights */}
            {summary.insights.length > 0 && (
              <View style={[styles.insightsCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '25' }]}>
                <View style={styles.insightsHeader}>
                  <Ionicons name="bulb" size={18} color={colors.primary} />
                  <Text style={[styles.insightsTitle, { color: colors.text }]}>Key Insights</Text>
                </View>
                {summary.insights.map((insight, i) => (
                  <View key={i} style={[styles.insightRow, i < summary.insights.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                    <View style={[styles.insightDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.insightText, { color: colors.textSecondary }]}>{insight}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Harvest Now */}
            {harvestNow.length > 0 && (
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  <Text style={{ color: '#00E676' }}>●</Text> Harvest Now ({harvestNow.length})
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                  These holdings with unrealized losses should be harvested before year-end
                </Text>
                {harvestNow.map((opp, i) => (
                  <OpportunityCard key={opp.id} opp={opp} index={i} isExpanded={expandedId === opp.id} onPress={() => handleToggleExpand(opp.id)} colors={colors} />
                ))}
              </View>
            )}

            {/* Wait for Long-Term */}
            {waitLongTerm.length > 0 && (
              <View style={{ marginTop: SPACING.lg }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  <Text style={{ color: '#FFC107' }}>●</Text> Wait for Long-Term ({waitLongTerm.length})
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                  Consider holding until they cross the 1-year boundary for LTCG treatment
                </Text>
                {waitLongTerm.slice(0, 5).map((opp, i) => (
                  <OpportunityCard key={opp.id} opp={opp} index={i} isExpanded={expandedId === opp.id} onPress={() => handleToggleExpand(opp.id)} colors={colors} />
                ))}
              </View>
            )}

            {/* Tax Calendar */}
            <View style={{ marginTop: SPACING.lg }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Tax Calendar</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Key dates for FY 2025-26</Text>
              <View style={[styles.calendarCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                {taxCalendar.map((event, i) => (
                  <View key={i} style={[styles.calRow, i < taxCalendar.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                    <View style={[styles.calDateBox, { backgroundColor: event.color + '15' }]}>
                      <Text style={[styles.calDate, { color: event.color }]}>{event.date}</Text>
                    </View>
                    <Text style={[styles.calLabel, { color: colors.text }]}>{event.label}</Text>
                    <Ionicons name={event.icon as any} size={16} color={event.color} />
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ════════════════════════════════════
            TAB: Realized Losses
            ════════════════════════════════════ */}
        {activeTab === 'losses' && (
          <View>
            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {[
                { key: 'all' as const, label: 'All Losses' },
                { key: 'short_term' as const, label: 'Short-Term' },
                { key: 'long_term' as const, label: 'Long-Term' },
              ].map(f => {
                const isActive = selectedLossType === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setSelectedLossType(f.key)}
                    style={[styles.filterChip, { backgroundColor: isActive ? colors.primary + '20' : colors.bgInput, borderColor: isActive ? colors.primary + '40' : colors.border }]}
                  >
                    <Text style={[styles.filterChipText, { color: isActive ? colors.primary : colors.textMuted }]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.resultCount, { color: colors.textMuted }]}>
              {filteredLosses.length} realized loss{filteredLosses.length !== 1 ? 'es' : ''} · ₹{(filteredLosses.reduce((s, r) => s + r.loss, 0) / 1000).toFixed(1)}K total
            </Text>

            {filteredLosses.length > 0 ? (
              filteredLosses.map((loss, i) => (
                <LossCard key={loss.tradeId} loss={loss} index={i} isExpanded={expandedId === loss.tradeId} onPress={() => handleToggleExpand(loss.tradeId)} colors={colors} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={48} color="#00E676" />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No realized losses</Text>
                <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>All your closed trades were profitable!</Text>
              </View>
            )}

            {/* Loss carry forward info */}
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>Loss Carry Forward</Text>
                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  Unused capital losses can be carried forward for up to 8 assessment years. Short-term losses can offset any capital gains. Long-term losses can only offset long-term capital gains.
                </Text>
              </View>
            </View>

            {/* STCG vs LTCL rules */}
            <View style={[styles.rulesCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.rulesTitle, { color: colors.text }]}>📋 Tax Rules (India FY 2025-26)</Text>
              {[
                { label: 'STCL → STCG + LTCG', desc: 'Short-term losses offset both', color: '#00E676' },
                { label: 'LTCL → LTCG only', desc: 'Long-term losses limited to LTCG', color: '#FFC107' },
                { label: 'Carry forward', desc: '8 assessment years', color: '#3B82F6' },
                { label: 'Wash sale', desc: 'No buying 30 days before/after', color: '#FF5252' },
              ].map((rule, i) => (
                <View key={i} style={styles.ruleRow}>
                  <View style={[styles.ruleDot, { backgroundColor: rule.color }]} />
                  <Text style={[styles.ruleLabel, { color: colors.text }]}>{rule.label}</Text>
                  <Text style={[styles.ruleDesc, { color: colors.textMuted }]}>{rule.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ════════════════════════════════════
            TAB: Simulator
            ════════════════════════════════════ */}
        {activeTab === 'simulator' && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>📊 What-If Harvesting Simulator</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
              Adjust quantities to harvest and see how your tax bill changes
            </Text>

            {harvestNow.length > 0 ? (
              <View>
                {harvestNow.map((opp, i) => (
                  <View key={opp.id} style={[styles.simCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <View style={styles.simHeader}>
                      <Text style={[styles.simSymbol, { color: colors.text }]}>{opp.symbol}</Text>
                      <Text style={[styles.simLoss, { color: '#FF5252' }]}>-₹{(opp.unrealizedLoss / 1000).toFixed(1)}K</Text>
                    </View>
                    <View style={styles.simRow}>
                      <Text style={[styles.simLabel, { color: colors.textMuted }]}>Qty to harvest (max {opp.quantity}):</Text>
                      <TextInput
                        style={[styles.simInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bgInput }]}
                        keyboardType="number-pad"
                        placeholder={`0-${opp.quantity}`}
                        placeholderTextColor={colors.textMuted}
                        value={harvestQty[opp.id]?.toString() || ''}
                        onChangeText={(val) => {
                          const num = parseInt(val, 10);
                          if (val === '') {
                            const newQty = { ...harvestQty };
                            delete newQty[opp.id];
                            setHarvestQty(newQty);
                          } else if (!isNaN(num) && num >= 0 && num <= opp.quantity) {
                            setHarvestQty({ ...harvestQty, [opp.id]: num });
                          }
                        }}
                      />
                    </View>
                    {harvestQty[opp.id] > 0 && (
                      <Text style={[styles.simSubtext, { color: colors.textSecondary }]}>
                        Savings: ₹{((harvestQty[opp.id] / opp.quantity) * opp.potentialTaxSaved / 1000).toFixed(2)}K
                      </Text>
                    )}
                  </View>
                ))}

                <Pressable
                  onPress={() => setShowResults(true)}
                  style={[styles.simulateBtn, { backgroundColor: colors.primary }]}
                >
                  <Ionicons name="flask" size={18} color={colors.white} />
                  <Text style={styles.simulateBtnText}>Run Simulation</Text>
                </Pressable>

                {showResults && simulatorResult && (
                  <View style={[styles.simResultsCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '25' }]}>
                    <Text style={[styles.simResultsTitle, { color: colors.text }]}>Simulation Results</Text>
                    <View style={styles.simResultsRow}>
                      <Text style={[styles.simResultsLabel, { color: colors.textMuted }]}>Loss Harvested</Text>
                      <Text style={[styles.simResultsValue, { color: '#FF5252' }]}>-₹{(simulatorResult.totalLossHarvested / 1000).toFixed(1)}K</Text>
                    </View>
                    <View style={styles.simResultsRow}>
                      <Text style={[styles.simResultsLabel, { color: colors.textMuted }]}>Tax Saved</Text>
                      <Text style={[styles.simResultsValue, { color: '#00E676' }]}>₹{(simulatorResult.totalTaxSaved / 1000).toFixed(1)}K</Text>
                    </View>
                    <View style={styles.simDivider} />
                    <View style={styles.simResultsRow}>
                      <Text style={[styles.simResultsLabel, { color: colors.textMuted }]}>Original Tax</Text>
                      <Text style={[styles.simResultsValue, { color: '#FF5252' }]}>₹{(simulatorResult.originalTax / 1000).toFixed(1)}K</Text>
                    </View>
                    <View style={styles.simResultsRow}>
                      <Text style={[styles.simResultsLabel, { color: colors.textMuted }]}>New Tax</Text>
                      <Text style={[styles.simResultsValue, { color: simulatorResult.newTax <= 0 ? '#00E676' : '#FFC107' }]}>
                        {simulatorResult.newTax <= 0 ? '₹0 (Fully Offset!)' : `₹${(simulatorResult.newTax / 1000).toFixed(1)}K`}
                      </Text>
                    </View>
                    <View style={styles.simResultsRow}>
                      <Text style={[styles.simResultsLabel, { color: colors.textMuted }]}>Savings %</Text>
                      <Text style={[styles.simResultsValue, { color: '#00E676' }]}>
                        {simulatorResult.originalTax > 0
                          ? `${((simulatorResult.totalTaxSaved / simulatorResult.originalTax) * 100).toFixed(0)}%`
                          : 'N/A'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={48} color="#00E676" />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No harvesting needed</Text>
                <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>All your holdings are in profit!</Text>
              </View>
            )}

            {/* Methodology */}
            <View style={[styles.methodCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.methodTitle, { color: colors.text }]}>How It Works</Text>
              {[
                { icon: '🔍', step: 'Scan', desc: 'We analyze your holdings for unrealized losses and closed trades for realized losses.' },
                { icon: '📊', step: 'Calculate', desc: 'ST losses offset both STCG & LTCG. LT losses offset LTCG only. ₹1L LTCG exemption applied.' },
                { icon: '💰', step: 'Optimize', desc: 'Harvest losses before year-end (31 Mar) to reduce taxable gains. Watch for wash sale rules (30 day window).' },
                { icon: '📅', step: 'Carry Forward', desc: 'Unused losses carry forward 8 years. No need to harvest if you have no gains to offset.' },
              ].map((item, i) => (
                <View key={i} style={[styles.methodRow, i < 3 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                  <Text style={{ fontSize: 24 }}>{item.icon}</Text>
                  <View style={{ flex: 1, marginLeft: SPACING.md }}>
                    <Text style={[styles.methodStep, { color: colors.text }]}>{item.step}</Text>
                    <Text style={[styles.methodDesc, { color: colors.textMuted }]}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// OPPORTUNITY CARD
// ══════════════════════════════════════════════════════════════

function OpportunityCard({ opp, index, isExpanded, onPress, colors }: {
  opp: TaxHarvestOpportunity; index: number; isExpanded: boolean; onPress: () => void; colors: any;
}) {
  const isUp = opp.recommendation === 'harvest_now';
  const color = recColor(opp.recommendation);

  return (
    <Animated.View entering={FadeInUp.delay(index * 80).springify()}>
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <View style={[styles.oppCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderLeftColor: color, borderLeftWidth: 3 }]}>
          <View style={styles.oppHeader}>
            <View style={styles.oppLeft}>
              <View style={[styles.oppIconBg, { backgroundColor: colors.bgInput }]}>
                <Text style={{ fontSize: 18 }}>{opp.symbol[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.oppSymbol, { color: colors.text }]}>{opp.symbol}</Text>
                <Text style={[styles.oppName, { color: colors.textMuted }]} numberOfLines={1}>{opp.name}</Text>
              </View>
            </View>
            <View style={styles.oppRight}>
              <Text style={[styles.oppLoss, { color: '#FF5252' }]}>-₹{(opp.unrealizedLoss / 1000).toFixed(1)}K</Text>
              <View style={[styles.oppPriorityBadge, { backgroundColor: scoreColor(opp.priorityScore) + '20' }]}>
                <Text style={[styles.oppPriorityText, { color: scoreColor(opp.priorityScore) }]}>
                  {opp.priorityScore}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.oppMetaRow}>
            <Text style={[styles.oppMeta, { color: colors.textMuted }]}>Loss: {opp.lossPercent.toFixed(1)}%</Text>
            <Text style={[styles.oppMeta, { color: colors.textMuted }]}>Qty: {opp.quantity}</Text>
            <View style={[styles.oppRecBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.oppRecText, { color }]}>
                {opp.recommendation === 'harvest_now' ? 'Harvest Now' : opp.recommendation === 'wait_long_term' ? 'Wait' : 'Avoid'}
              </Text>
            </View>
          </View>

          {/* Progress bar: loss depth */}
          <View style={styles.oppProgressBg}>
            <View style={[styles.oppProgressFill, {
              width: `${Math.min(Math.abs(opp.lossPercent), 30)}%`,
              backgroundColor: '#FF5252',
            }]} />
          </View>

          {isExpanded && (
            <View style={[styles.oppExpanded, { backgroundColor: colors.bgInput }]}>
              <View style={styles.oppExpandedGrid}>
                {[
                  { label: 'Buy Price', value: `₹${opp.buyPrice.toFixed(2)}` },
                  { label: 'Current', value: `₹${opp.currentPrice.toFixed(2)}` },
                  { label: 'Tax Saved', value: `₹${(opp.potentialTaxSaved / 1000).toFixed(1)}K`, color: '#00E676' },
                  { label: 'Holding', value: `${opp.holdingDays}d` },
                  { label: 'To LTCG', value: opp.daysToLongTerm > 0 ? `${opp.daysToLongTerm}d` : '✓ LTCG', color: opp.daysToLongTerm <= 0 ? '#00E676' : undefined },
                  { label: 'Offsets', value: opp.offsetsType === 'both' ? 'STCG + LTCG' : 'LTCG Only', color: opp.offsetsType === 'both' ? '#00E676' : '#FFC107' },
                ].map((item, i) => (
                  <View key={i} style={styles.oppExpandedItem}>
                    <Text style={[styles.oppExpandedLabel, { color: colors.textMuted }]}>{item.label}</Text>
                    <Text style={[styles.oppExpandedValue, { color: (item as any).color || colors.text }]}>{item.value}</Text>
                  </View>
                ))}
              </View>
              {opp.washSaleRisk && (
                <View style={[styles.washAlert, { backgroundColor: '#FF525215', borderColor: '#FF525230' }]}>
                  <Ionicons name="warning" size={14} color="#FF5252" />
                  <Text style={[styles.washAlertText, { color: '#FF5252' }]}>Wash sale risk — recent buy within 30 days</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════
// LOSS CARD
// ══════════════════════════════════════════════════════════════

function LossCard({ loss, index, isExpanded, onPress, colors }: {
  loss: RealizedLoss; index: number; isExpanded: boolean; onPress: () => void; colors: any;
}) {
  const isST = loss.holdingType === 'short_term';

  return (
    <Animated.View entering={FadeInUp.delay(index * 60).springify()}>
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        <View style={[styles.lossCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.lossRow}>
            <View style={styles.lossLeft}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <View style={[styles.lossTypeBadge, { backgroundColor: isST ? '#FFC10720' : '#FF525220' }]}>
                  <Text style={[styles.lossTypeText, { color: isST ? '#FFC107' : '#FF5252' }]}>
                    {isST ? 'ST' : 'LT'}
                  </Text>
                </View>
                <Text style={[styles.lossSymbol, { color: colors.text }]}>{loss.symbol}</Text>
              </View>
              <Text style={[styles.lossAmount, { color: '#FF5252' }]}>-₹{(loss.loss / 1000).toFixed(1)}K</Text>
            </View>
            <View style={styles.lossRight}>
              <Text style={[styles.lossDate, { color: colors.textMuted }]}>
                {new Date(loss.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
              <Text style={[styles.lossDays, { color: colors.textMuted }]}>{loss.holdingDays}d held</Text>
            </View>
          </View>

          {isExpanded && (
            <View style={[styles.lossExpanded, { backgroundColor: colors.bgInput }]}>
              <View style={styles.oppExpandedGrid}>
                {[
                  { label: 'Loss', value: `₹${loss.loss.toFixed(2)}`, color: '#FF5252' },
                  { label: 'Type', value: isST ? 'Short-Term' : 'Long-Term' },
                  { label: 'Offsets', value: isST ? 'STCG + LTCG' : 'LTCG Only', color: isST ? '#00E676' : '#FFC107' },
                  { label: 'Quantity', value: loss.quantity.toString() },
                ].map((item, i) => (
                  <View key={i} style={styles.oppExpandedItem}>
                    <Text style={[styles.oppExpandedLabel, { color: colors.textMuted }]}>{item.label}</Text>
                    <Text style={[styles.oppExpandedValue, { color: (item as any).color || colors.text }]}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl, paddingTop: 60, borderBottomLeftRadius: BORDER_RADIUS.xl, borderBottomRightRadius: BORDER_RADIUS.xl },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backBtn: { padding: 4 },
  title: { ...FONTS.bold, fontSize: FONTS.size.title },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 2 },
  fyBadge: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: BORDER_RADIUS.full },
  fyText: { ...FONTS.semiBold, fontSize: FONTS.size.xs, letterSpacing: 0.5 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  summaryCard: {
    width: (width - 48 - SPACING.sm) / 2,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryIcon: { fontSize: 20 },
  summaryValue: { ...FONTS.bold, fontSize: FONTS.size.lg },
  summaryLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, textAlign: 'center' },
  tabRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  tabLabel: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },

  sampleBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, justifyContent: 'center', marginBottom: SPACING.md },
  sampleBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

  // Insights
  insightsCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.lg },
  insightsHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  insightsTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, paddingVertical: SPACING.sm },
  insightDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  insightText: { ...FONTS.regular, fontSize: FONTS.size.xs, flex: 1, lineHeight: 16 },

  // Section
  sectionTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md, marginBottom: 4 },
  sectionSubtitle: { ...FONTS.regular, fontSize: FONTS.size.xs, marginBottom: SPACING.md, fontStyle: 'italic' },

  // Opp Card
  oppCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.sm },
  oppHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  oppLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  oppIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  oppSymbol: { ...FONTS.bold, fontSize: FONTS.size.md },
  oppName: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  oppRight: { alignItems: 'flex-end', gap: 4 },
  oppLoss: { ...FONTS.bold, fontSize: FONTS.size.lg },
  oppPriorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  oppPriorityText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  oppMetaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.sm },
  oppMeta: { ...FONTS.regular, fontSize: FONTS.size.xs },
  oppRecBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  oppRecText: { ...FONTS.semiBold, fontSize: 9, letterSpacing: 0.3 },
  oppProgressBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginTop: SPACING.sm },
  oppProgressFill: { height: '100%', borderRadius: 2 },
  oppExpanded: { marginTop: SPACING.md, padding: SPACING.md, borderRadius: BORDER_RADIUS.md },
  oppExpandedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  oppExpandedItem: { width: '45%' },
  oppExpandedLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  oppExpandedValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Wash Sale
  washAlert: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginTop: SPACING.md },
  washAlertText: { ...FONTS.medium, fontSize: FONTS.size.xs, flex: 1 },

  // Losses
  filterScroll: { marginBottom: SPACING.md },
  filterChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: BORDER_RADIUS.full, borderWidth: 1, marginRight: SPACING.sm },
  filterChipText: { ...FONTS.medium, fontSize: FONTS.size.xs },
  resultCount: { ...FONTS.regular, fontSize: FONTS.size.xs, fontStyle: 'italic', marginBottom: SPACING.sm },
  lossCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.sm },
  lossRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lossLeft: { gap: SPACING.sm, flex: 1 },
  lossTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  lossTypeText: { ...FONTS.semiBold, fontSize: 9, letterSpacing: 0.5 },
  lossSymbol: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  lossAmount: { ...FONTS.bold, fontSize: FONTS.size.lg },
  lossRight: { alignItems: 'flex-end', gap: 2 },
  lossDate: { ...FONTS.regular, fontSize: FONTS.size.xs },
  lossDays: { ...FONTS.regular, fontSize: FONTS.size.xs },
  lossExpanded: { marginTop: SPACING.md, padding: SPACING.md, borderRadius: BORDER_RADIUS.md },

  // Info
  infoCard: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.md, marginTop: SPACING.md },
  infoTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: 4 },
  infoText: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 16 },
  rulesCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
  rulesTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: SPACING.md },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  ruleDot: { width: 8, height: 8, borderRadius: 4 },
  ruleLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, width: 130 },
  ruleDesc: { ...FONTS.regular, fontSize: FONTS.size.xs, flex: 1 },

  // Calendar
  calendarCard: { padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
  calRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  calDateBox: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.md },
  calDate: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  calLabel: { ...FONTS.regular, fontSize: FONTS.size.sm, flex: 1 },

  // Simulator
  simCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.sm },
  simHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  simSymbol: { ...FONTS.bold, fontSize: FONTS.size.md },
  simLoss: { ...FONTS.bold, fontSize: FONTS.size.md },
  simRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  simLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, flex: 1 },
  simInput: { width: 80, borderWidth: 1, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, ...FONTS.semiBold, fontSize: FONTS.size.sm, textAlign: 'center' },
  simSubtext: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: SPACING.sm, fontStyle: 'italic' },
  simulateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, marginTop: SPACING.md },
  simulateBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: '#FFFFFF' },
  simResultsCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginTop: SPACING.md },
  simResultsTitle: { ...FONTS.bold, fontSize: FONTS.size.md, marginBottom: SPACING.md },
  simResultsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.xs },
  simResultsLabel: { ...FONTS.regular, fontSize: FONTS.size.sm },
  simResultsValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  simDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: SPACING.sm },

  // Methodology
  methodCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.lg },
  methodTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md, marginBottom: SPACING.md },
  methodRow: { flexDirection: 'row', paddingVertical: SPACING.md },
  methodStep: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  methodDesc: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2, lineHeight: 16 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.sm },
  emptyTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  emptyDesc: { ...FONTS.regular, fontSize: FONTS.size.xs },
});
