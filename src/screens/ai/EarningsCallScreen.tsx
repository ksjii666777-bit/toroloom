/**
 * ============================================================================
 * Toroloom — Earnings Call Summaries Screen
 * ============================================================================
 *
 * AI-powered summaries of company quarterly earnings calls:
 *   - Company selector (6 major companies)
 *   - AI executive summary with sentiment badge
 *   - Key metrics grid (revenue, profit, EPS, margins)
 *   - YoY growth indicators with trend arrows
 *   - Beat/miss vs analyst estimates
 *   - Peer comparison table
 *   - Management highlights
 *   - Growth drivers & risk factors
 *   - Historical quarterly trends
 *   - Key takeaways section
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants/theme';
import { mockEarningsData } from '../../constants/mockData';
import type { EarningsSummary } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Color/Aesthetic Helpers ────────────────────────────────

function getSentimentColors(label: string) {
  switch (label) {
    case 'bullish': return { color: '#10B981', bg: '#10B98115', icon: 'trending-up' as const };
    case 'bearish': return { color: '#EF4444', bg: '#EF444415', icon: 'trending-down' as const };
    default: return { color: '#F59E0B', bg: '#F59E0B15', icon: 'remove' as const };
  }
}

function formatCr(value: number): string {
  if (Math.abs(value) >= 100000) return `${(value / 100000).toFixed(1)}L Cr`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K Cr`;
  return `${value.toFixed(1)} Cr`;
}

function formatPct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Sentiment Badge ────────────────────────────────────────

function SentimentBadge({ label, score }: { label: string; score: number }) {
  const sc = getSentimentColors(label);
  return (
    <View style={[sentimentStyles.badge, { backgroundColor: sc.bg }]}>
      <Ionicons name={sc.icon} size={14} color={sc.color} />
      <Text style={[sentimentStyles.label, { color: sc.color }]}>
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </Text>
      <View style={[sentimentStyles.scoreBadge, { backgroundColor: sc.color + '30' }]}>
        <Text style={[sentimentStyles.scoreText, { color: sc.color }]}>{score}</Text>
      </View>
    </View>
  );
}

const sentimentStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  scoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 24,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 10,
    fontWeight: '800',
  },
});

// ─── Metric Card ────────────────────────────────────────────

function MetricCard({
  label, value, change, sublabel,
}: {
  label: string;
  value: string;
  change?: number;
  sublabel?: string;
}) {
  const { colors } = useTheme();
  const isPositive = change !== undefined && change >= 0;

  return (
    <View style={[metricStyles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[metricStyles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[metricStyles.value, { color: colors.text }]}>{value}</Text>
      {change !== undefined && (
        <View style={metricStyles.changeRow}>
          <Ionicons
            name={isPositive ? 'caret-up' : 'caret-down'}
            size={12}
            color={isPositive ? colors.marketUp : colors.marketDown}
          />
          <Text style={[metricStyles.change, {
            color: isPositive ? colors.marketUp : colors.marketDown,
          }]}>
            {formatPct(change)} YoY
          </Text>
        </View>
      )}
      {sublabel && (
        <Text style={[metricStyles.sublabel, { color: colors.textMuted }]}>{sublabel}</Text>
      )}
    </View>
  );
}

const metricStyles = StyleSheet.create({
  card: {
    width: (SCREEN_WIDTH - 64 - 12) / 2,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 17,
    fontWeight: '800',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  change: {
    fontSize: 11,
    fontWeight: '700',
  },
  sublabel: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
  },
});

// ─── Analyst Consensus Badge ────────────────────────────────

function ConsensusBadge({ consensus }: { consensus: EarningsSummary['analystConsensus'] }) {
  const { colors } = useTheme();
  const config: Record<string, { label: string; color: string; bg: string }> = {
    strong_buy: { label: 'Strong Buy', color: '#10B981', bg: '#10B98120' },
    buy: { label: 'Buy', color: '#34D399', bg: '#34D39920' },
    hold: { label: 'Hold', color: '#F59E0B', bg: '#F59E0B20' },
    sell: { label: 'Sell', color: '#F97316', bg: '#F9731620' },
    strong_sell: { label: 'Strong Sell', color: '#EF4444', bg: '#EF444420' },
  };
  const cfg = config[consensus] || config.hold;
  return (
    <View style={[consensusStyles.badge, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}>
      <View style={[consensusStyles.dot, { backgroundColor: cfg.color }]} />
      <Text style={[consensusStyles.label, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const consensusStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});

// ─── Main Screen ────────────────────────────────────────────

export default function EarningsCallScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedSymbol, setSelectedSymbol] = useState<string>('RELIANCE');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    takeaways: true,
    highlights: true,
    drivers: true,
    risks: true,
    peerComparison: true,
    history: true,
  });

  const earningsData = useMemo(() => mockEarningsData, []);
  const selectedEarnings = earningsData.find(e => e.symbol === selectedSymbol);
  const companies = useMemo(() =>
    earningsData.map(e => ({ symbol: e.symbol, name: e.companyName })),
    [earningsData],
  );

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleShare = useCallback(async () => {
    if (!selectedEarnings) return;
    try {
      await Share.share({
        title: `${selectedEarnings.companyName} ${selectedEarnings.quarter} Earnings Summary`,
        message: `${selectedEarnings.companyName} ${selectedEarnings.quarter} Earnings Summary\n\n${selectedEarnings.executiveSummary}\n\nKey Metrics:\nRevenue: Rs ${formatCr(selectedEarnings.metrics.revenue)} (${formatPct(selectedEarnings.metrics.revenueGrowth)} YoY)\nNet Profit: Rs ${formatCr(selectedEarnings.metrics.netProfit)} (${formatPct(selectedEarnings.metrics.profitGrowth)} YoY)\nEPS: Rs ${selectedEarnings.metrics.eps.toFixed(2)}\n\nvia Toroloom`,
      });
    } catch {
      // User cancelled share
    }
  }, [selectedEarnings]);

  if (!selectedEarnings) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No earnings data available</Text>
      </View>
    );
  }

  const sc = getSentimentColors(selectedEarnings.sentimentLabel);
  const m = selectedEarnings.metrics;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Earnings Call</Text>
            <Text style={styles.headerSubtitle}>AI-powered quarterly summaries</Text>
          </View>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Company Picker */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pickerRow}
        >
          {companies.map(c => {
            const isActive = c.symbol === selectedSymbol;
            return (
              <TouchableOpacity
                key={c.symbol}
                onPress={() => setSelectedSymbol(c.symbol)}
                activeOpacity={0.7}
                style={[
                  styles.pickerChip,
                  {
                    backgroundColor: isActive ? colors.primary : colors.bgCardLight,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[
                  styles.pickerChipText,
                  { color: isActive ? '#FFFFFF' : colors.textSecondary },
                ]}>{c.symbol}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Company Hero */}
        <LinearGradient
          colors={[sc.color + '20', colors.bgCard]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { borderColor: sc.color + '30' }]}
        >
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroCompany}>{selectedEarnings.companyName}</Text>
              <Text style={styles.heroQuarter}>
                {selectedEarnings.quarter} Results · {formatDate(selectedEarnings.date)}
              </Text>
            </View>
            <SentimentBadge label={selectedEarnings.sentimentLabel} score={selectedEarnings.sentimentScore} />
          </View>

          {/* Executive Summary */}
          <View style={[styles.summaryBox, { backgroundColor: colors.bgCardLight, borderLeftColor: sc.color }]}>
            <Text style={styles.summaryText}>{selectedEarnings.executiveSummary}</Text>
          </View>

          {/* Confidence bar */}
          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>AI Confidence</Text>
            <View style={[styles.confidenceBar, { backgroundColor: colors.bgInput }]}>
              <View style={[styles.confidenceFill, {
                width: `${selectedEarnings.confidence}%`,
                backgroundColor: sc.color,
              }]} />
            </View>
            <Text style={[styles.confidenceValue, { color: sc.color }]}>
              {selectedEarnings.confidence}%
            </Text>
          </View>

          {/* Market Reaction */}
          <View style={[styles.reactionRow, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
            <View style={styles.reactionItem}>
              <Text style={styles.reactionLabel}>Pre-Market</Text>
              <Text style={[styles.reactionValue, {
                color: selectedEarnings.marketReaction.preMarketChange >= 0 ? colors.marketUp : colors.marketDown,
              }]}>
                {formatPct(selectedEarnings.marketReaction.preMarketChange)}
              </Text>
            </View>
            <View style={styles.reactionDivider} />
            <View style={styles.reactionItem}>
              <Text style={styles.reactionLabel}>Day Change</Text>
              <Text style={[styles.reactionValue, {
                color: selectedEarnings.marketReaction.dayChange >= 0 ? colors.marketUp : colors.marketDown,
              }]}>
                {formatPct(selectedEarnings.marketReaction.dayChange)}
              </Text>
            </View>
            <View style={styles.reactionDivider} />
            <View style={styles.reactionItem}>
              <Text style={styles.reactionLabel}>Volume Surge</Text>
              <Text style={[styles.reactionValue, { color: colors.marketUp }]}>
                +{selectedEarnings.marketReaction.volumeSurge}%
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Key Metrics Grid */}
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.metricsGrid}>
          <MetricCard
            label="Revenue"
            value={`₹${formatCr(m.revenue)}`}
            change={m.revenueGrowth}
            sublabel={`Beat: ${m.revenueBeat !== null ? formatPct(m.revenueBeat) : 'N/A'}`}
          />
          <MetricCard
            label="Net Profit"
            value={`₹${formatCr(m.netProfit)}`}
            change={m.profitGrowth}
            sublabel={`Beat: ${m.profitBeat !== null ? formatPct(m.profitBeat) : 'N/A'}`}
          />
          <MetricCard
            label="EPS"
            value={`₹${m.eps.toFixed(2)}`}
            change={m.epsGrowth}
          />
          <MetricCard
            label="EBITDA"
            value={`₹${formatCr(m.ebitda)}`}
            change={m.ebitdaMargin}
            sublabel={`Margin: ${m.ebitdaMargin.toFixed(1)}%`}
          />
          <MetricCard
            label="Operating Margin"
            value={`${m.operatingMargin.toFixed(1)}%`}
          />
          <MetricCard
            label="Net Margin"
            value={`${m.netMargin.toFixed(1)}%`}
          />
        </View>

        {/* Key Takeaways */}
        <View style={[styles.sectionCard, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('takeaways')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="bulb" size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionCardTitle}>Key Takeaways</Text>
            </View>
            <Ionicons
              name={expandedSections.takeaways ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          {expandedSections.takeaways && (
            <View style={styles.sectionBody}>
              {selectedEarnings.keyTakeaways.map((takeaway, i) => (
                <View key={i} style={[styles.takeawayRow, { borderBottomColor: colors.divider }]}>
                  <View style={[styles.takeawayDot, { backgroundColor: sc.color }]} />
                  <Text style={styles.takeawayText}>{takeaway}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Management Highlights */}
        <View style={[styles.sectionCard, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('highlights')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIcon, { backgroundColor: '#8B5CF620' }]}>
                <Ionicons name="megaphone" size={16} color="#8B5CF6" />
              </View>
              <Text style={styles.sectionCardTitle}>Management Highlights</Text>
            </View>
            <Ionicons
              name={expandedSections.highlights ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          {expandedSections.highlights && (
            <View style={styles.sectionBody}>
              {selectedEarnings.managementHighlights.map((h, i) => (
                <View key={i} style={[styles.highlightRow, { borderBottomColor: colors.divider }]}>
                  <View style={[styles.highlightBadge, { backgroundColor: '#8B5CF615' }]}>
                    <Text style={[styles.highlightIndex, { color: '#8B5CF6' }]}>{i + 1}</Text>
                  </View>
                  <Text style={styles.highlightText}>{h}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Analyst Consensus */}
        <View style={[styles.analystCard, { borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Analyst Outlook</Text>
          <View style={styles.analystRow}>
            <View style={styles.analystLeft}>
              <ConsensusBadge consensus={selectedEarnings.analystConsensus} />
              <Text style={styles.analystFirms}>Based on 28 analyst ratings</Text>
            </View>
            <View style={styles.analystRight}>
              <Text style={styles.analystPriceLabel}>Target Price</Text>
              <Text style={[styles.analystPrice, { color: colors.text }]}>
                ₹{selectedEarnings.analystTargetPrice.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.analystRange}>
                Range: ₹{selectedEarnings.analystTargetLow.toLocaleString('en-IN')} – ₹{selectedEarnings.analystTargetHigh.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        {/* Growth Drivers */}
        <View style={[styles.sectionCard, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('drivers')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.marketUp + '20' }]}>
                <Ionicons name="rocket" size={16} color={colors.marketUp} />
              </View>
              <Text style={styles.sectionCardTitle}>Growth Drivers</Text>
            </View>
            <Ionicons
              name={expandedSections.drivers ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          {expandedSections.drivers && (
            <View style={styles.sectionBody}>
              {selectedEarnings.growthDrivers.map((d, i) => (
                <View key={i} style={[styles.bulletRow, { borderBottomColor: colors.divider }]}>
                  <Text style={[styles.bulletIcon, { color: colors.marketUp }]}>✓</Text>
                  <Text style={styles.bulletText}>{d}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Risk Factors */}
        <View style={[styles.sectionCard, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('risks')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.marketDown + '20' }]}>
                <Ionicons name="warning" size={16} color={colors.marketDown} />
              </View>
              <Text style={styles.sectionCardTitle}>Risk Factors</Text>
            </View>
            <Ionicons
              name={expandedSections.risks ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          {expandedSections.risks && (
            <View style={styles.sectionBody}>
              {selectedEarnings.riskFactors.map((r, i) => (
                <View key={i} style={[styles.bulletRow, { borderBottomColor: colors.divider }]}>
                  <Text style={[styles.bulletIcon, { color: colors.marketDown }]}>⚠</Text>
                  <Text style={styles.bulletText}>{r}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Peer Comparison */}
        <View style={[styles.sectionCard, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('peerComparison')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIcon, { backgroundColor: '#06B6D420' }]}>
                <Ionicons name="people" size={16} color="#06B6D4" />
              </View>
              <Text style={styles.sectionCardTitle}>Peer Comparison</Text>
            </View>
            <Ionicons
              name={expandedSections.peerComparison ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          {expandedSections.peerComparison && selectedEarnings.peerComparison.length > 0 && (
            <View style={styles.sectionBody}>
              {/* Table Header */}
              <View style={[styles.peerHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.peerCell, styles.peerSymbolCol, { color: colors.textMuted }]}>Company</Text>
                <Text style={[styles.peerCell, { color: colors.textMuted }]}>Revenue</Text>
                <Text style={[styles.peerCell, { color: colors.textMuted }]}>Profit</Text>
                <Text style={[styles.peerCell, { color: colors.textMuted }]}>Rev Gr</Text>
              </View>

              {selectedEarnings.peerComparison.map((p, i) => {
                const isCurrent = p.symbol === selectedEarnings.symbol;
                return (
                  <View
                    key={p.symbol}
                    style={[
                      styles.peerRow,
                      { borderBottomColor: colors.divider },
                      isCurrent && { backgroundColor: colors.primary + '10' },
                    ]}
                  >
                    <View style={styles.peerSymbolCol}>
                      <Text style={[styles.peerSymbol, { color: isCurrent ? colors.primary : colors.text }]}>
                        {p.symbol}
                      </Text>
                      {isCurrent && (
                        <View style={[styles.youBadge, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.youBadgeText, { color: colors.primary }]}>YOU</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.peerValue, { color: colors.text }]}>₹{formatCr(p.revenue)}</Text>
                    <Text style={[styles.peerValue, { color: colors.text }]}>₹{formatCr(p.profit)}</Text>
                    <Text style={[styles.peerValue, {
                      color: p.revenueGrowth >= 0 ? colors.marketUp : colors.marketDown,
                    }]}>
                      {formatPct(p.revenueGrowth)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Historical Quarterly Trends */}
        <View style={[styles.sectionCard, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('history')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="bar-chart" size={16} color={colors.warning} />
              </View>
              <Text style={styles.sectionCardTitle}>Historical Trend (4 Quarters)</Text>
            </View>
            <Ionicons
              name={expandedSections.history ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          {expandedSections.history && selectedEarnings.historicalQuarters.length > 0 && (
            <View style={styles.sectionBody}>
              {/* Header */}
              <View style={[styles.histHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.histCell, styles.histQuarterCol, { color: colors.textMuted }]}>Quarter</Text>
                <Text style={[styles.histCell, { color: colors.textMuted }]}>Revenue</Text>
                <Text style={[styles.histCell, { color: colors.textMuted }]}>Profit</Text>
                <Text style={[styles.histCell, { color: colors.textMuted }]}>EPS</Text>
              </View>

              {selectedEarnings.historicalQuarters.map((q, i) => (
                <View key={q.quarter} style={[styles.histRow, { borderBottomColor: colors.divider }]}>
                  <Text style={[styles.histQuarterCol, { color: colors.text }]}>{q.quarter}</Text>
                  <Text style={[styles.histValue, { color: colors.text }]}>₹{formatCr(q.revenue)}</Text>
                  <Text style={[styles.histValue, { color: i > 0 && q.netProfit < selectedEarnings.historicalQuarters[i - 1].netProfit ? colors.marketDown : colors.marketUp }]}>
                    ₹{formatCr(q.netProfit)}
                  </Text>
                  <Text style={[styles.histValue, { color: colors.text }]}>₹{q.eps.toFixed(1)}</Text>
                </View>
              ))}

              {/* Trend indicator */}
              <View style={styles.trendFooter}>
                <Ionicons name="trending-up" size={14} color={colors.primary} />
                <Text style={[styles.trendText, { color: colors.textMuted }]}>
                  Revenue CAGR: {m.revenueGrowth > 0 ? '+' : ''}{m.revenueGrowth.toFixed(1)}% · 
                  Profit CAGR: {m.profitGrowth > 0 ? '+' : ''}{m.profitGrowth.toFixed(1)}%
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Source */}
        <Text style={[styles.sourceText, { color: colors.textMuted }]}>
          Source: {selectedEarnings.source} · Generated {formatDate(selectedEarnings.date)}
        </Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Header ──
  header: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
  },
  headerSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerRow: {
    gap: 8,
    paddingBottom: SPACING.sm,
  },
  pickerChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  pickerChipText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Scroll ──
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.huge,
  },

  // ── Hero ──
  heroCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  heroCompany: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    marginBottom: 2,
  },
  heroQuarter: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
  },
  summaryBox: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    marginBottom: SPACING.md,
  },
  summaryText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  confidenceLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    width: 80,
  },
  confidenceBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xs,
    width: 35,
    textAlign: 'right',
  },

  // ── Market Reaction ──
  reactionRow: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
  },
  reactionItem: {
    flex: 1,
    alignItems: 'center',
  },
  reactionLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginBottom: 4,
  },
  reactionValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  reactionDivider: {
    width: 1,
    backgroundColor: colors.divider,
    marginVertical: 4,
  },

  // ── Sections ──
  sectionTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  sectionCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    backgroundColor: colors.bgCard,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionCardTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  sectionBody: {
    marginTop: SPACING.lg,
  },

  // ── Metrics Grid ──
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  // ── Takeaways ──
  takeawayRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  takeawayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  takeawayText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  // ── Highlights ──
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  highlightBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightIndex: {
    ...FONTS.bold,
    fontSize: FONTS.size.xs,
  },
  highlightText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
  },

  // ── Analyst ──
  analystCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    backgroundColor: colors.bgCard,
  },
  analystRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  analystLeft: {
    gap: SPACING.sm,
  },
  analystFirms: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  analystRight: {
    alignItems: 'flex-end',
  },
  analystPriceLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  analystPrice: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.xl,
  },
  analystRange: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // ── Bullets ──
  bulletRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  bulletIcon: {
    fontSize: 14,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  bulletText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  // ── Peer Comparison Table ──
  peerHeader: {
    flexDirection: 'row',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    marginBottom: SPACING.xs,
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderRadius: 4,
  },
  peerCell: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    flex: 1,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  peerSymbolCol: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    textAlign: 'left',
  },
  peerSymbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  peerValue: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    flex: 1,
    textAlign: 'right',
  },
  youBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  youBadgeText: {
    ...FONTS.bold,
    fontSize: 7,
  },

  // ── Historical Table ──
  histHeader: {
    flexDirection: 'row',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    marginBottom: SPACING.xs,
  },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  histCell: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    flex: 1,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  histQuarterCol: {
    flex: 1.2,
    textAlign: 'left',
  },
  histValue: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    flex: 1,
    textAlign: 'right',
  },
  trendFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: SPACING.md,
  },
  trendText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },

  // ── Source ──
  sourceText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
