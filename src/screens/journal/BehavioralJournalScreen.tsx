/**
 * Toroloom — Behavioral Journal Screen
 *
 * Tracks trading psychology with journal entries, metrics, emotion breakdown,
 * mistake frequency, and weekly reports. Integrates with useBehaviorJournalStore.
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useBehaviorJournalStore, MISTAKE_LABELS, ALL_EMOTIONS } from '../../store/behavioralJournalStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

type TabKey = 'Dashboard' | 'Entries' | 'Reports';

export default function BehavioralJournalScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('Dashboard');

  const entries = useBehaviorJournalStore(s => s.entries);
  const allMetrics = useBehaviorJournalStore(s => s.allMetrics);
  const reports = useBehaviorJournalStore(s => s.reports);
  const setShowEntryModal = useBehaviorJournalStore(s => s.setShowEntryModal);

  const latestReport = reports[0];
  const topMistakeFreq = useMemo(() => {
    const sorted = Object.entries(allMetrics.mistakeFrequency)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a);
    return sorted.slice(0, 3);
  }, [allMetrics.mistakeFrequency]);

  const topEmotionFreq = useMemo(() => {
    const sorted = Object.entries(allMetrics.emotionalBreakdown)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a);
    return sorted.slice(0, 3);
  }, [allMetrics.emotionalBreakdown]);

  // Week of date formatting
  const weekOfStr = latestReport
    ? `Week of ${new Date(latestReport.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : '';

  const tabs: TabKey[] = ['Dashboard', 'Entries', 'Reports'];

  const renderDashboard = () => (
    <>
      {/* Performance Overview */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Performance Overview</Text>
      <View style={styles.metricsGrid}>
        <MetricCard label="Win Rate" value={`${Math.round(allMetrics.winRate)}%`} color={colors.success} />
        <MetricCard label="Avg P&L" value={`₹${Math.round(allMetrics.avgPnl).toLocaleString()}`} color={allMetrics.avgPnl >= 0 ? colors.success : colors.danger} />
        <MetricCard label="Profit Factor" value={allMetrics.profitFactor === Infinity ? '∞' : allMetrics.profitFactor.toFixed(2)} color={colors.primary} />
        <MetricCard label="Plan Compliance" value={`${Math.round(allMetrics.planComplianceRate)}%`} color={colors.accent} />
      </View>

      {/* Streak Metrics */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>Streak Metrics</Text>
      <View style={styles.metricsGrid}>
        <MetricCard label="Max Win Streak" value={`${allMetrics.maxConsecutiveWins}`} color={colors.success} />
        <MetricCard label="Max Loss Streak" value={`${allMetrics.maxConsecutiveLosses}`} color={colors.danger} />
        <MetricCard label="Max Drawdown" value={`₹${allMetrics.maxDrawdown.toLocaleString()}`} color={colors.warning} />
        <MetricCard label="Total Trades" value={`${allMetrics.totalTrades}`} color={colors.primary} />
      </View>

      {/* Emotional State Breakdown */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>Emotional State Breakdown</Text>
      <View style={styles.emotionList}>
        {topEmotionFreq.map(([emotion, count]) => (
          <View key={emotion} style={[styles.emotionRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.emotionLabel, { color: colors.text }]}>{emotion.charAt(0).toUpperCase() + emotion.slice(1)}</Text>
            <View style={styles.emotionCountRow}>
              <View style={[styles.emotionBar, { backgroundColor: colors.primary, width: `${Math.min((count / (allMetrics.totalTrades || 1)) * 100, 100)}%` }]} />
              <Text style={[styles.emotionCount, { color: colors.textSecondary }]}>{count}x</Text>
            </View>
          </View>
        ))}
        {topEmotionFreq.length === 0 && (
          <Text style={[styles.emptySection, { color: colors.textMuted }]}>No entries yet</Text>
        )}
      </View>

      {/* Most Common Mistakes */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>Most Common Mistakes</Text>
      <View style={styles.mistakeList}>
        {topMistakeFreq.map(([mistake, count]) => (
          <View key={mistake} style={[styles.mistakeRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={[styles.mistakeLabel, { color: colors.text }]}>
              {MISTAKE_LABELS[mistake as keyof typeof MISTAKE_LABELS] || mistake}
            </Text>
            <Text style={[styles.mistakeCount, { color: colors.textMuted }]}>{count}x</Text>
          </View>
        ))}
        {topMistakeFreq.length === 0 && (
          <Text style={[styles.emptySection, { color: colors.textMuted }]}>No mistakes! Great trading.</Text>
        )}
      </View>

      {/* Improvement Tip */}
      {latestReport && (
        <View style={[styles.improvementCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.improvementHeader}>
            <Ionicons name="bulb" size={18} color={colors.warning} />
            <Text style={[styles.improvementLabel, { color: colors.text }]}>Improvement Tip</Text>
          </View>
          <Text style={[styles.improvementText, { color: colors.textSecondary }]}>
            {latestReport.improvementTip}
          </Text>
        </View>
      )}
    </>
  );

  const renderEntries = () => (
    <FlatList
      data={entries}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.entriesList}
      renderItem={({ item }) => (
        <View style={[styles.entryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.entryHeader}>
            <Text style={[styles.entrySymbol, { color: colors.primary }]}>{item.symbol}</Text>
            <Text style={[styles.entryPnl, { color: item.pnl >= 0 ? colors.success : colors.danger }]}>
              {item.pnl >= 0 ? '+' : ''}{item.pnlPercent.toFixed(2)}%
            </Text>
          </View>
          <Text style={[styles.entryNotes, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.notes}
          </Text>
          <Text style={[styles.entryDate, { color: colors.textMuted }]}>
            {new Date(item.date).toLocaleDateString()}
          </Text>
        </View>
      )}
      ListEmptyComponent={
        <Text style={[styles.emptySection, { color: colors.textMuted, textAlign: 'center', paddingVertical: 60 }]}>
          No journal entries yet
        </Text>
      }
    />
  );

  const renderReports = () => (
    <View style={styles.reportsList}>
      {reports.length === 0 ? (
        <Text style={[styles.emptySection, { color: colors.textMuted, textAlign: 'center', paddingVertical: 60 }]}>
          No reports yet
        </Text>
      ) : (
        reports.map((report) => (
          <View key={report.weekStart} style={[styles.reportCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.weekOfText, { color: colors.primary }]}>
              {`Week of ${new Date(report.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </Text>
            <View style={styles.reportMetrics}>
              <Text style={[styles.reportMetric, { color: colors.text }]}>
                Win Rate: <Text style={{ color: colors.success }}>{Math.round(report.metrics.winRate)}%</Text>
              </Text>
              <Text style={[styles.reportMetric, { color: colors.text }]}>
                Trades: <Text style={{ color: colors.primary }}>{report.metrics.totalTrades}</Text>
              </Text>
            </View>
            {report.improvementTip && (
              <View style={styles.improvementBadge}>
                <Ionicons name="bulb" size={14} color={colors.warning} />
                <Text style={[styles.reportTipText, { color: colors.textSecondary }]}>
                  {report.improvementTip}
                </Text>
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary, paddingTop: insets.top + 12 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Behavioural Journal</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Track your trading psychology</Text>
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
        {tabs.map(tab => (
          <Pressable
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && [styles.activeTab, { backgroundColor: colors.primary + '20', borderColor: colors.primary }],
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                { color: colors.textMuted },
                activeTab === tab && { color: colors.primary, fontWeight: '700' },
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'Dashboard' && renderDashboard()}
        {activeTab === 'Reports' && renderReports()}
      </ScrollView>

      {/* Entries tab is FlatList-based, so we render it separately */}
      {activeTab === 'Entries' && (
        <View style={styles.entriesContainer}>
          {renderEntries()}
        </View>
      )}

      {/* FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setShowEntryModal(true)}
      >
        <Ionicons name="add" size={24} color="#FFF" />
      </Pressable>
    </View>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4 },
  tabBar: {
    flexDirection: 'row', padding: SPACING.sm, gap: SPACING.sm,
    borderBottomWidth: 1, marginBottom: SPACING.sm,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full },
  activeTab: { borderWidth: 1 },
  tabText: { fontSize: FONTS.size.sm, fontWeight: '600' },
  scrollArea: { flex: 1 },
  scrollContent: { padding: SPACING.xl, paddingBottom: 100 },
  sectionTitle: { fontSize: FONTS.size.lg, fontWeight: '700', marginBottom: SPACING.md },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  metricCard: {
    width: '47%', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  metricValue: { fontSize: 20, fontWeight: '800' },
  metricLabel: { fontSize: FONTS.size.xs, marginTop: 2 },
  emotionList: { gap: SPACING.sm },
  emotionRow: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1, gap: SPACING.sm,
  },
  emotionLabel: { fontSize: FONTS.size.sm, fontWeight: '600', width: 110 },
  emotionCountRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  emotionBar: { height: 8, borderRadius: 4 },
  emotionCount: { fontSize: FONTS.size.xs },
  mistakeList: { gap: SPACING.sm },
  mistakeRow: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1, gap: SPACING.sm,
  },
  mistakeLabel: { flex: 1, fontSize: FONTS.size.sm, fontWeight: '500' },
  mistakeCount: { fontSize: FONTS.size.xs },
  emptySection: { fontSize: FONTS.size.sm, paddingVertical: SPACING.md },
  improvementCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginTop: SPACING.xl,
  },
  improvementHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  improvementLabel: { fontSize: FONTS.size.sm, fontWeight: '700' },
  improvementText: { fontSize: FONTS.size.sm, lineHeight: 20 },
  entriesContainer: { flex: 1 },
  entriesList: { padding: SPACING.xl, gap: SPACING.sm, paddingBottom: 100 },
  entryCard: {
    padding: SPACING.md, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, gap: SPACING.xs,
  },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entrySymbol: { fontSize: FONTS.size.md, fontWeight: '700' },
  entryPnl: { fontSize: FONTS.size.sm, fontWeight: '700' },
  entryNotes: { fontSize: FONTS.size.sm, lineHeight: 18 },
  entryDate: { fontSize: FONTS.size.xs },
  reportsList: { padding: SPACING.xl, gap: SPACING.sm, paddingBottom: 100 },
  reportCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, gap: SPACING.sm,
  },
  weekOfText: { fontSize: FONTS.size.md, fontWeight: '700' },
  reportMetrics: { gap: 2 },
  reportMetric: { fontSize: FONTS.size.sm },
  improvementBadge: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginTop: SPACING.sm },
  reportTipText: { fontSize: FONTS.size.sm, flex: 1, lineHeight: 18 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },
});
