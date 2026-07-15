/**
 * ============================================================================
 * Toroloom — Dividend Tracker Screen
 * ============================================================================
 *
 * Track dividend income from portfolio holdings:
 *   - Upcoming dividends (next 12 months, calendar timeline)
 *   - Historical dividend payments
 *   - Annual summaries (yield, top payers, yield on cost)
 *   - Real data via backend API (MarketStack) or local estimation
 *
 * Navigation: More → Investments → Dividend Tracker
 * ============================================================================
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Dimensions, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useMarketStore } from '../../store/marketStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import { computeDividendState } from '../../services/dividendService';
import { fetchDividendDataSafe } from '../../services/api/dividends';
import type { DividendEvent, MonthlyDividend, DividendTrackerState } from '../../types';

const { width } = Dimensions.get('window');

// ══════════════════════════════════════════════════════════════
// SOURCE BADGE
// ══════════════════════════════════════════════════════════════

function SourceBadge({ source, isLoading }: { source: 'api' | 'local'; isLoading: boolean }) {
  if (isLoading) {
    return (
      <View style={[styles.sourceBadge, { backgroundColor: '#FFC10720', borderColor: '#FFC10740' }]}>
        <ActivityIndicator size={8} color="#FFC107" />
        <Text style={[styles.sourceText, { color: '#FFC107' }]}>Loading…</Text>
      </View>
    );
  }
  if (source === 'api') {
    return (
      <View style={[styles.sourceBadge, { backgroundColor: '#00E67620', borderColor: '#00E67640' }]}>
        <View style={[styles.sourceDot, { backgroundColor: '#00E676' }]} />
        <Text style={[styles.sourceText, { color: '#00E676' }]}>Live</Text>
      </View>
    );
  }
  return (
    <View style={[styles.sourceBadge, { backgroundColor: '#6C63FF20', borderColor: '#6C63FF40' }]}>
      <View style={[styles.sourceDot, { backgroundColor: '#6C63FF' }]} />
      <Text style={[styles.sourceText, { color: '#6C63FF' }]}>Estimated</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// UPCOMING EVENT CARD
// ══════════════════════════════════════════════════════════════

function EventCard({ event, colors }: { event: DividendEvent; colors: any }) {
  const payDate = new Date(event.payDate);
  const monthStr = payDate.toLocaleDateString('en-IN', { month: 'short' });
  const dayStr = payDate.getDate().toString();

  return (
    <View style={[styles.eventCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {/* Date column */}
      <View style={[styles.eventDateCol, {
        backgroundColor: event.confidence === 'paid' ? '#00E67620' : event.confidence === 'confirmed' ? '#3B82F620' : '#FFC10720',
        borderColor: colors.border,
      }]}>
        <Text style={[styles.eventMonth, { color: colors.textSecondary }]}>{monthStr}</Text>
        <Text style={[styles.eventDay, { color: colors.text }]}>{dayStr}</Text>
      </View>

      {/* Details */}
      <View style={styles.eventDetails}>
        <View style={styles.eventTopRow}>
          <Text style={[styles.eventSymbol, { color: colors.text }]}>{event.symbol}</Text>
          <View style={[styles.confidenceBadge, {
            backgroundColor: event.confidence === 'paid' ? '#00E67620' : event.confidence === 'confirmed' ? '#3B82F620' : '#FFC10720',
            borderColor: event.confidence === 'paid' ? '#00E67640' : event.confidence === 'confirmed' ? '#3B82F640' : '#FFC10740',
          }]}>
            <Text style={[styles.confidenceText, {
              color: event.confidence === 'paid' ? '#00E676' : event.confidence === 'confirmed' ? '#3B82F6' : '#FFC107',
            }]}>
              {event.confidence === 'paid' ? 'Paid' : event.confidence === 'confirmed' ? 'Confirmed' : 'Est.'}
            </Text>
          </View>
        </View>
        <Text style={[styles.eventName, { color: colors.textMuted }]}>{event.name}</Text>
        <View style={styles.eventMeta}>
          <Text style={[styles.eventMetaText, { color: colors.textSecondary }]}>
            ₹{event.amountPerShare.toFixed(2)}/share × {event.quantity} shares
          </Text>
          <View style={[styles.freqBadge, { backgroundColor: '#00E67620' }]}>
            <Text style={[styles.freqText, { color: '#00E676' }]}>{event.frequency.replace('_', ' ')}</Text>
          </View>
        </View>
        <Text style={[styles.eventAmount, { color: '#00E676' }]}>+₹{event.totalAmount.toFixed(2)}</Text>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// MONTHLY INCOME CHIP
// ══════════════════════════════════════════════════════════════

function MonthChip({ month, maxAmount, colors }: { month: MonthlyDividend; maxAmount: number; colors: any }) {
  const barWidth = maxAmount > 0 ? (month.totalAmount / maxAmount) * 100 : 0;

  return (
    <View style={styles.monthChip}>
      <View style={styles.monthChipHeader}>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{month.label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.monthCount, { color: colors.textMuted }]}>{month.count} events</Text>
          <Text style={[styles.monthAmount, { color: '#00E676' }]}>+₹{month.totalAmount.toFixed(0)}</Text>
        </View>
      </View>
      <View style={[styles.monthBarTrack, { backgroundColor: colors.divider }]}>
        <View style={[styles.monthBarFill, { width: `${barWidth}%`, backgroundColor: '#00E676' }]} />
      </View>
      {month.events.length > 0 && (
        <View style={styles.monthEvents}>
          {month.events.map(e => (
            <View key={e.id} style={styles.monthEventRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.monthEventSymbol, { color: colors.textSecondary }]}>{e.symbol}</Text>
                <Text style={[styles.monthEventQty, { color: colors.textMuted }]}>×{e.quantity}</Text>
              </View>
              <Text style={[styles.monthEventAmount, { color: '#00E676' }]}>+₹{e.totalAmount.toFixed(0)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// SUMMARY STAT CARD
// ══════════════════════════════════════════════════════════════

function SummaryStatCard({ icon, label, value, color, subtitle, textMuted }: {
  icon: string; label: string; value: string; color: string; subtitle?: string; textMuted: string;
}) {
  return (
    <View style={[styles.summaryStatCard, { borderColor: color + '30' }]}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={[styles.summaryStatValue, { color }]}>{value}</Text>
      <Text style={[styles.summaryStatLabel, { color: textMuted }]}>{label}</Text>
      {subtitle && <Text style={[styles.summaryStatSub, { color: textMuted }]}>{subtitle}</Text>}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// TOP PAYER ROW
// ══════════════════════════════════════════════════════════════

function TopPayerRow({ symbol, name, totalAmount, yieldPercent, isLast, colors }: {
  symbol: string; name: string; totalAmount: number; yieldPercent: number;
  isLast: boolean; colors: any;
}) {
  return (
    <View style={[styles.payerRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
      <View style={styles.payerLeft}>
        <View style={[styles.payerAvatar, { backgroundColor: '#00E67620' }]}>
          <Ionicons name="cash" size={16} color="#00E676" />
        </View>
        <View>
          <Text style={[styles.payerSymbol, { color: colors.text }]}>{symbol}</Text>
          <Text style={[styles.payerName, { color: colors.textMuted }]}>{name}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.payerAmount, { color: '#00E676' }]}>+₹{totalAmount.toFixed(0)}</Text>
        <Text style={[styles.payerYield, { color: colors.textMuted }]}>{yieldPercent.toFixed(2)}% yield</Text>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════════════════════

type TabKey = 'upcoming' | 'history' | 'summary';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'upcoming', label: 'Upcoming', icon: 'calendar' },
  { key: 'history', label: 'History', icon: 'time' },
  { key: 'summary', label: 'Summary', icon: 'stats-chart' },
];

// ══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════

export default function DividendTrackerScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
  const [dataSource, setDataSource] = useState<'api' | 'local'>('local');
  const [isLoading, setIsLoading] = useState(true);

  const { holdings } = usePortfolioStore();
  const { stocks } = useMarketStore();

  // Fetch dividend data — try API first, fall back to local estimation
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    fetchDividendDataSafe(holdings, stocks).then((result) => {
      if (mounted) {
        setDividendState(result.state);
        setDataSource(result.source);
        setIsLoading(false);
      }
    });

    return () => { mounted = false; };
    // Only re-fetch when holdings/stocks length changes (not on every tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings.length, stocks.length]);

  const [dividendState, setDividendState] = useState<DividendTrackerState>(() =>
    computeDividendState(holdings, stocks)
  );

  const maxMonthlyAmount = useMemo(
    () => Math.max(...dividendState.monthlyHistory.map(m => m.totalAmount), 1),
    [dividendState.monthlyHistory],
  );

  const handlePress = useCallback((symbol: string) => {
    const stock = stocks.find(s => s.symbol === symbol);
    if (stock) {
      navigation.navigate('StockDetail', { stockId: stock.id, symbol });
    }
  }, [stocks, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Dividend Tracker</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Annual income: ₹{dividendState.currentYearProjection.totalEstimated.toFixed(0)}
            </Text>
          </View>
          <SourceBadge source={dataSource} isLoading={isLoading} />
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabBtn, {
                  backgroundColor: isActive ? '#00E67620' : 'transparent',
                  borderColor: isActive ? '#00E67640' : 'transparent',
                }]}
              >
                <Ionicons name={tab.icon as any} size={13} color={isActive ? '#00E676' : colors.textMuted} />
                <Text style={[styles.tabLabel, { color: isActive ? '#00E676' : colors.textMuted }]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#00E676" />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Fetching dividend data…</Text>
          </View>
        )}

        {/* ── Upcoming Tab ── */}
        {!isLoading && activeTab === 'upcoming' && (
          dividendState.upcoming.length > 0 ? (
            <View>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                {dividendState.upcoming.length} upcoming event{dividendState.upcoming.length !== 1 ? 's' : ''}
                {dataSource === 'api' ? ' · Live data' : ' · Estimated'}
              </Text>
              {dividendState.upcoming.map(event => (
                <Pressable key={event.id} onPress={() => handlePress(event.symbol)}>
                  <EventCard event={event} colors={colors} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={56} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>No Upcoming Dividends</Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                Holdings with dividend-paying stocks will appear here
              </Text>
            </View>
          )
        )}

        {/* ── History Tab ── */}
        {!isLoading && activeTab === 'history' && (
          dividendState.monthlyHistory.length > 0 ? (
            <View>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
                {dividendState.totalPayments} payment{dividendState.totalPayments !== 1 ? 's' : ''} recorded
                {dataSource === 'api' ? ' · Live data' : ' · Estimated'}
              </Text>
              {dividendState.monthlyHistory.map(month => (
                <MonthChip key={month.month} month={month} maxAmount={maxMonthlyAmount} colors={colors} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={56} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>No Dividend History</Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                Historical dividend payments will appear here
              </Text>
            </View>
          )
        )}

        {/* ── Summary Tab ── */}
        {!isLoading && activeTab === 'summary' && (
          <View>
            {/* Data source info */}
            <View style={[styles.sourceNote, {
              backgroundColor: dataSource === 'api' ? '#00E67610' : '#6C63FF10',
              borderColor: dataSource === 'api' ? '#00E67630' : '#6C63FF30',
            }]}>
              <Ionicons
                name={dataSource === 'api' ? 'cloud-done' : 'code-slash'}
                size={16}
                color={dataSource === 'api' ? '#00E676' : '#6C63FF'}
              />
              <Text style={[styles.sourceNoteText, {
                color: dataSource === 'api' ? '#00E676' : '#6C63FF',
              }]}>
                {dataSource === 'api'
                  ? 'Dividend data from MarketStack API'
                  : 'Backend unavailable — showing estimated data'}
              </Text>
            </View>

            {/* Overview Stats */}
            <View style={styles.summaryGrid}>
              <SummaryStatCard
                icon="💰"
                label="Annual Income"
                value={formatCurrency(dividendState.currentYearProjection.totalEstimated, true).replace('₹', '')}
                color="#00E676"
                subtitle="Estimated this year"
                textMuted={colors.textMuted}
              />
              <SummaryStatCard
                icon="📊"
                label="Portfolio Yield"
                value={`${dividendState.currentYearProjection.portfolioYield.toFixed(2)}%`}
                color="#3B82F6"
                subtitle="Div / Portfolio Value"
                textMuted={colors.textMuted}
              />
              <SummaryStatCard
                icon="🌱"
                label="Yield on Cost"
                value={`${dividendState.currentYearProjection.yieldOnCost.toFixed(2)}%`}
                color="#6C63FF"
                subtitle="Div / Total Cost"
                textMuted={colors.textMuted}
              />
              <SummaryStatCard
                icon="📅"
                label="Monthly Avg"
                value={formatCurrency(dividendState.currentYearProjection.monthlyAverage, true).replace('₹', '')}
                color="#FFC107"
                subtitle="Per month"
                textMuted={colors.textMuted}
              />
            </View>

            {/* Top Payers */}
            {dividendState.currentYearProjection.topPayers.length > 0 && (
              <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Dividend Payers</Text>
                {dividendState.currentYearProjection.topPayers.map((payer, i) => (
                  <TopPayerRow
                    key={payer.symbol}
                    symbol={payer.symbol}
                    name={payer.name}
                    totalAmount={payer.totalAmount}
                    yieldPercent={payer.yieldPercent}
                    isLast={i === dividendState.currentYearProjection.topPayers.length - 1}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {/* Annual Breakdown */}
            {dividendState.annualSummaries.length > 0 && (
              <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Annual Breakdown</Text>
                {dividendState.annualSummaries.map((year, i) => (
                  <View key={year.year} style={[styles.yearRow, i < dividendState.annualSummaries.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                      <Text style={[styles.yearValue, { color: colors.text }]}>{year.year}</Text>
                      <Text style={[styles.yearTotal, { color: '#00E676' }]}>₹{year.totalIncome.toFixed(0)}</Text>
                    </View>
                    <Text style={[styles.yearAvg, { color: colors.textMuted }]}>
                      ₹{year.monthlyAverage.toFixed(0)}/mo · {year.months.reduce((s, m) => s + m.count, 0)} payments
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Info */}
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="information-circle" size={18} color="#00E676" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>Dividend Income Notes</Text>
                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  {dataSource === 'api'
                    ? 'Dividend data provided by MarketStack API. Actual payment dates and amounts may vary. TDS at 10% applies on dividends exceeding ₹5,000 per year.'
                    : 'Dividends are estimated based on stock dividend yields and your holding quantity. Connect the backend with MARKETSTACK_KEY configured for real data. Actual payments may vary.'}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl, paddingTop: 60, borderBottomLeftRadius: BORDER_RADIUS.xl, borderBottomRightRadius: BORDER_RADIUS.xl },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  title: { ...FONTS.bold, fontSize: FONTS.size.title },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 4, marginTop: SPACING.md },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs + 2, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  tabLabel: { ...FONTS.semiBold, fontSize: 10 },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
  sectionHint: { ...FONTS.regular, fontSize: FONTS.size.xs, fontStyle: 'italic', marginBottom: SPACING.sm },

  // Source badge
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  sourceDot: { width: 6, height: 6, borderRadius: 3 },
  sourceText: { ...FONTS.semiBold, fontSize: 9, letterSpacing: 0.3 },

  // Loading
  loadingState: { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.md },
  loadingText: { ...FONTS.regular, fontSize: FONTS.size.sm },

  // Source note
  sourceNote: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.md },
  sourceNoteText: { ...FONTS.medium, fontSize: FONTS.size.xs, flex: 1 },

  // Event Card
  eventCard: { flexDirection: 'row', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.sm, gap: SPACING.md },
  eventDateCol: { width: 50, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.sm, borderWidth: 1 },
  eventMonth: { ...FONTS.regular, fontSize: 10, textTransform: 'uppercase' },
  eventDay: { ...FONTS.bold, fontSize: FONTS.size.xl, marginTop: 2 },
  eventDetails: { flex: 1, gap: 4 },
  eventTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventSymbol: { ...FONTS.bold, fontSize: FONTS.size.md },
  confidenceBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  confidenceText: { ...FONTS.medium, fontSize: 8, letterSpacing: 0.3 },
  eventName: { ...FONTS.regular, fontSize: FONTS.size.xs },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  eventMetaText: { ...FONTS.regular, fontSize: 9 },
  freqBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: BORDER_RADIUS.full },
  freqText: { ...FONTS.medium, fontSize: 8 },
  eventAmount: { ...FONTS.bold, fontSize: FONTS.size.lg, marginTop: 2 },

  // Month Chip
  monthChip: { marginBottom: SPACING.md },
  monthChipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  monthLabel: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  monthCount: { ...FONTS.regular, fontSize: 9 },
  monthAmount: { ...FONTS.bold, fontSize: FONTS.size.md },
  monthBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  monthBarFill: { height: '100%', borderRadius: 3 },
  monthEvents: { marginTop: SPACING.sm, gap: 3 },
  monthEventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: SPACING.sm },
  monthEventSymbol: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  monthEventQty: { ...FONTS.regular, fontSize: 9 },
  monthEventAmount: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

  // Summary
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  summaryStatCard: {
    width: (width - 48 - SPACING.sm) / 2,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryStatValue: { ...FONTS.bold, fontSize: FONTS.size.lg },
  summaryStatLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, textAlign: 'center' },
  summaryStatSub: { ...FONTS.regular, fontSize: 8, textAlign: 'center' },

  // Section
  sectionCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
  sectionTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md, marginBottom: SPACING.md },

  // Top Payers
  payerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md },
  payerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  payerAvatar: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  payerSymbol: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  payerName: { ...FONTS.regular, fontSize: FONTS.size.xs },
  payerAmount: { ...FONTS.bold, fontSize: FONTS.size.sm },
  payerYield: { ...FONTS.regular, fontSize: 9 },

  // Year row
  yearRow: { paddingVertical: SPACING.md, gap: 4 },
  yearValue: { ...FONTS.bold, fontSize: FONTS.size.md },
  yearTotal: { ...FONTS.bold, fontSize: FONTS.size.md },
  yearAvg: { ...FONTS.regular, fontSize: FONTS.size.xs },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.sm },
  emptyTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  emptyDesc: { ...FONTS.regular, fontSize: FONTS.size.xs, textAlign: 'center', paddingHorizontal: SPACING.xl },

  // Info
  infoCard: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.lg },
  infoTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: 4 },
  infoText: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 16 },
});
