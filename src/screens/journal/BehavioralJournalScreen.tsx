import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Dimensions, Alert, Platform, KeyboardAvoidingView, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useBehaviorJournalStore, MISTAKE_LABELS, ALL_EMOTIONS } from '../../store/behavioralJournalStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { EmotionalState, TradingMistake, JournalEntry } from '../../types';

const { width } = Dimensions.get('window');
const EMOTION_COLORS: Record<EmotionalState, string> = {
  calm: '#10B981',
  anxious: '#F59E0B',
  excited: '#3B82F6',
  fearful: '#8B5CF6',
  frustrated: '#EF4444',
  overconfident: '#F97316',
  neutral: '#6B7280',
};
const WARNING_COLOR = '#F59E0B';
const EMOTION_ICONS: Record<EmotionalState, string> = {
  calm: 'happy-outline',
  anxious: 'warning-outline',
  excited: 'flash-outline',
  fearful: 'sad-outline',
  frustrated: 'thunderstorm-outline',
  overconfident: 'rocket-outline',
  neutral: 'remove-outline',
};

type Tab = 'dashboard' | 'entries' | 'reports';

function EmojiBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const barWidth = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={jbStyles.emojiBarRow}>
      <Text style={jbStyles.emojiBarLabel}>{label}</Text>
      <View style={jbStyles.emojiBarTrack}>
        <View style={[jbStyles.emojiBarFill, { width: `${barWidth}%`, backgroundColor: color }]} />
      </View>
      <Text style={jbStyles.emojiBarValue}>{value}</Text>
    </View>
  );
}

function MistakeBar({ count, max, label, color }: { count: number; max: number; label: string; color: string }) {
  const barWidth = max > 0 ? (count / max) * 100 : 0;
  return (
    <View style={jbStyles.mistakeRow}>
      <Text style={jbStyles.mistakeLabel} numberOfLines={1}>{label}</Text>
      <View style={jbStyles.mistakeTrack}>
        <View style={[jbStyles.mistakeFill, { width: `${barWidth}%`, backgroundColor: color }]} />
      </View>
      <Text style={jbStyles.mistakeValue}>{count}</Text>
    </View>
  );
}

function MetricCard({
  label, value, subtitle, color, icon, trend,
}: {
  label: string; value: string; subtitle?: string; color: string; icon: string; trend?: 'up' | 'down' | 'neutral';
}) {
  const { colors } = useTheme();
  return (
    <View style={[jbStyles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={[jbStyles.metricIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[jbStyles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[jbStyles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      {subtitle && (
        <Text style={[jbStyles.metricSub, { color: trend === 'up' ? EMOTION_COLORS.calm : trend === 'down' ? EMOTION_COLORS.frustrated : colors.textMuted }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

function JournalEntryCard({
  entry, onPress, colors,
}: {
  entry: JournalEntry; onPress: () => void; colors: any;
}) {
  const isWin = entry.pnl > 0;
  return (
    <AnimatedPressable onPress={onPress} scaleTo={0.97}>
      <View style={[jbStyles.entryCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderLeftColor: isWin ? EMOTION_COLORS.calm : EMOTION_COLORS.frustrated, borderLeftWidth: 3 }]}>
        <View style={jbStyles.entryHeader}>
          <View style={jbStyles.entrySymbolRow}>
            <Text style={[jbStyles.entrySymbol, { color: colors.text }]}>{entry.symbol}</Text>
            <Text style={[jbStyles.entryDir, { color: colors.textSecondary }]}>{entry.direction === 'long' ? '▲' : '▼'}</Text>
            <View style={[jbStyles.entryEmotionBadge, { backgroundColor: EMOTION_COLORS[entry.emotionalState] + '20' }]}>
              <Ionicons name={EMOTION_ICONS[entry.emotionalState] as any} size={12} color={EMOTION_COLORS[entry.emotionalState]} />
              <Text style={[jbStyles.entryEmotionText, { color: EMOTION_COLORS[entry.emotionalState] }]}>
                {entry.emotionalState}
              </Text>
            </View>
          </View>
          <Text style={[jbStyles.entryPnl, { color: isWin ? EMOTION_COLORS.calm : EMOTION_COLORS.frustrated }]}>
            {isWin ? '+' : ''}{entry.pnlPercent.toFixed(2)}%
          </Text>
        </View>
        <Text style={[jbStyles.entryMeta, { color: colors.textMuted }]}>
          {entry.setupType} · {entry.holdingPeriod} · ₹{entry.entryPrice}→₹{entry.exitPrice}
        </Text>
        {entry.notes.length > 0 && (
          <Text style={[jbStyles.entryNotes, { color: colors.textSecondary }]} numberOfLines={2}>
            {entry.notes}
          </Text>
        )}
        {entry.mistakes.length > 0 && (
          <View style={jbStyles.entryMistakes}>
            {entry.mistakes.slice(0, 3).map(m => (
              <View key={m} style={[jbStyles.mistakeTag, { backgroundColor: EMOTION_COLORS.frustrated + '15' }]}>
                <Text style={[jbStyles.mistakeTagText, { color: EMOTION_COLORS.frustrated }]}>{MISTAKE_LABELS[m]}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

function WeeklyReportCard({
  report, colors,
}: {
  report: any; colors: any;
}) {
  return (
    <View style={[jbStyles.reportCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={jbStyles.reportHeader}>
        <Text style={[jbStyles.reportTitle, { color: colors.text }]}>
          Week of {new Date(report.weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </Text>
        <Text style={[jbStyles.reportSubtitle, { color: colors.textMuted }]}>
          {report.metrics.totalTrades} trades
        </Text>
      </View>

      <View style={jbStyles.reportMetrics}>
        <View style={jbStyles.reportMetric}>
          <Text style={[jbStyles.reportMetricValue, { color: report.metrics.winRate > 50 ? EMOTION_COLORS.calm : EMOTION_COLORS.frustrated }]}>
            {report.metrics.winRate.toFixed(0)}%
          </Text>
          <Text style={[jbStyles.reportMetricLabel, { color: colors.textMuted }]}>Win Rate</Text>
        </View>
        <View style={jbStyles.reportMetric}>
          <Text style={[jbStyles.reportMetricValue, { color: colors.text }]}>
            {report.metrics.profitFactor === Infinity ? '∞' : report.metrics.profitFactor.toFixed(1)}
          </Text>
          <Text style={[jbStyles.reportMetricLabel, { color: colors.textMuted }]}>Profit Factor</Text>
        </View>
        <View style={jbStyles.reportMetric}>
          <Text style={[jbStyles.reportMetricValue, { color: report.metrics.planComplianceRate > 70 ? EMOTION_COLORS.calm : WARNING_COLOR }]}>
            {report.metrics.planComplianceRate.toFixed(0)}%
          </Text>
          <Text style={[jbStyles.reportMetricLabel, { color: colors.textMuted }]}>Plan</Text>
        </View>
      </View>

      <View style={jbStyles.reportInsight}>
        <Text style={[jbStyles.reportInsightIcon]}>💡</Text>
        <Text style={[jbStyles.reportInsightText, { color: colors.textSecondary }]}>{report.improvementTip}</Text>
      </View>

      <View style={jbStyles.reportFooter}>
        <View style={jbStyles.reportFootItem}>
          <Text style={[jbStyles.reportFootLabel, { color: colors.textMuted }]}>Top Mistake</Text>
          <Text style={[jbStyles.reportFootValue, { color: colors.text }]}>{report.topMistake}</Text>
        </View>
        <View style={jbStyles.reportFootItem}>
          <Text style={[jbStyles.reportFootLabel, { color: colors.textMuted }]}>Dominant Emotion</Text>
          <View style={jbStyles.reportFootEmotion}>
            <View style={[jbStyles.reportFootDot, { backgroundColor: (EMOTION_COLORS[report.dominantEmotion as EmotionalState] || EMOTION_COLORS.neutral) }]} />
            <Text style={[jbStyles.reportFootValue, { color: colors.text }]}>{report.dominantEmotion}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function BehavioralJournalScreen() {
  const { colors } = useTheme();
  const {
    entries, allMetrics, reports, addEntry, deleteEntry,
    showEntryModal, setShowEntryModal, editingEntry, setEditingEntry,
    getFilteredEntries,
  } = useBehaviorJournalStore();

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [period, setPeriod] = useState<'all' | 'week' | 'month'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New entry form state
  const [formSymbol, setFormSymbol] = useState('');
  const [formDirection, setFormDirection] = useState<'long' | 'short'>('long');
  const [formEntryPrice, setFormEntryPrice] = useState('');
  const [formExitPrice, setFormExitPrice] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formEmotion, setFormEmotion] = useState<EmotionalState>('calm');
  const [formMistakes, setFormMistakes] = useState<TradingMistake[]>([]);
  const [formCompliance, setFormCompliance] = useState('100');
  const [formNotes, setFormNotes] = useState('');
  const [formSetup, setFormSetup] = useState('');
  const [formExitReason, setFormExitReason] = useState('target');

  const filteredEntries = useMemo(() => getFilteredEntries(period), [period, entries, getFilteredEntries]);

  const topMistakes = useMemo(() => {
    return Object.entries(allMetrics.mistakeFrequency)
      .map(([key, count]) => ({ key: key as TradingMistake, count, label: MISTAKE_LABELS[key as TradingMistake] }))
      .filter(m => m.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [allMetrics.mistakeFrequency]);
  const maxMistakeCount = topMistakes.length > 0 ? topMistakes[0].count : 1;

  const topEmotions = useMemo(() => {
    return Object.entries(allMetrics.emotionalBreakdown)
      .map(([key, count]) => ({ key: key as EmotionalState, count, label: key }))
      .filter(m => m.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [allMetrics.emotionalBreakdown]);
  const maxEmotionCount = topEmotions.length > 0 ? topEmotions[0].count : 1;

  const handleAddEntry = useCallback(() => {
    const ep = parseFloat(formEntryPrice);
    const ex = parseFloat(formExitPrice);
    const qty = parseInt(formQuantity, 10);
    const comp = parseInt(formCompliance, 10);
    if (!formSymbol || isNaN(ep) || isNaN(ex) || isNaN(qty)) {
      Alert.alert('Missing Fields', 'Please fill in symbol, prices, and quantity.');
      return;
    }
    const pnl = formDirection === 'long' ? (ex - ep) * qty : (ep - ex) * qty;
    const pnlPercent = ((ex - ep) / ep) * 100;

    addEntry({
      date: new Date().toISOString(),
      symbol: formSymbol.toUpperCase(),
      direction: formDirection,
      entryPrice: ep,
      exitPrice: ex,
      quantity: qty,
      pnl,
      pnlPercent,
      holdingPeriod: '1d',
      emotionalState: formEmotion,
      mistakes: formMistakes,
      planCompliance: Math.min(100, Math.max(0, comp)),
      notes: formNotes || '',
      setupType: formSetup || 'manual',
      exitReason: formExitReason,
      tags: [formSymbol.toUpperCase()],
    });

    // Reset form
    setFormSymbol('');
    setFormEntryPrice('');
    setFormExitPrice('');
    setFormQuantity('');
    setFormEmotion('calm');
    setFormMistakes([]);
    setFormCompliance('100');
    setFormNotes('');
    setFormSetup('');
    setFormExitReason('target');
    setShowAddModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [formSymbol, formDirection, formEntryPrice, formExitPrice, formQuantity, formEmotion, formMistakes, formCompliance, formNotes, formSetup, formExitReason, addEntry]);

  const toggleMistake = (m: TradingMistake) => {
    setFormMistakes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const renderDashboard = () => (
    <View>
      {/* Overview Metrics */}
      <Text style={[jbStyles.sectionTitle, { color: colors.text }]}>Performance Overview</Text>
      <View style={jbStyles.metricsGrid}>
        <MetricCard
          label="Win Rate"
          value={`${allMetrics.winRate.toFixed(0)}%`}
          subtitle={`${allMetrics.winningTrades}W / ${allMetrics.losingTrades}L`}
          color={allMetrics.winRate > 50 ? EMOTION_COLORS.calm : EMOTION_COLORS.frustrated}
          icon="trophy"
          trend={allMetrics.winRate > 50 ? 'up' : 'down'}
        />
        <MetricCard
          label="Profit Factor"
          value={allMetrics.profitFactor === Infinity ? '∞' : allMetrics.profitFactor.toFixed(2)}
          subtitle={allMetrics.profitFactor > 1.5 ? 'Healthy' : 'Needs Work'}
          color={allMetrics.profitFactor > 1.5 ? EMOTION_COLORS.calm : WARNING_COLOR}
          icon="trending-up"
          trend={allMetrics.profitFactor > 1.5 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="Plan Compliance"
          value={`${allMetrics.planComplianceRate.toFixed(0)}%`}
          subtitle={allMetrics.planComplianceRate > 70 ? 'Good' : 'Needs Focus'}
          color={allMetrics.planComplianceRate > 70 ? EMOTION_COLORS.calm : WARNING_COLOR}
          icon="checkmark-circle"
          trend={allMetrics.planComplianceRate > 70 ? 'up' : 'down'}
        />
        <MetricCard
          label="Avg Win / Loss"
          value={`₹${allMetrics.avgWin.toFixed(0)} / ₹${allMetrics.avgLoss.toFixed(0)}`}
          subtitle={`Total: ₹${allMetrics.totalTrades > 0 ? entries.reduce((s, e) => s + e.pnl, 0).toFixed(0) : '0'}`}
          color={allMetrics.avgWin > allMetrics.avgLoss ? EMOTION_COLORS.calm : EMOTION_COLORS.frustrated}
          icon="calculator"
          trend="neutral"
        />
      </View>

      {/* Consecutive Streaks */}
      <View style={[jbStyles.streakRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={jbStyles.streakItem}>
          <Ionicons name="flame" size={20} color={EMOTION_COLORS.calm} />
          <Text style={[jbStyles.streakValue, { color: EMOTION_COLORS.calm }]}>{allMetrics.maxConsecutiveWins}</Text>
          <Text style={[jbStyles.streakLabel, { color: colors.textMuted }]}>Max Win Streak</Text>
        </View>
        <View style={[jbStyles.streakDivider, { backgroundColor: colors.divider }]} />
        <View style={jbStyles.streakItem}>
          <Ionicons name="snow" size={20} color={EMOTION_COLORS.frustrated} />
          <Text style={[jbStyles.streakValue, { color: EMOTION_COLORS.frustrated }]}>{allMetrics.maxConsecutiveLosses}</Text>
          <Text style={[jbStyles.streakLabel, { color: colors.textMuted }]}>Max Loss Streak</Text>
        </View>
        <View style={[jbStyles.streakDivider, { backgroundColor: colors.divider }]} />
        <View style={jbStyles.streakItem}>
          <Ionicons name="arrow-down-circle" size={20} color={WARNING_COLOR} />
          <Text style={[jbStyles.streakValue, { color: WARNING_COLOR }]}>₹{allMetrics.maxDrawdown.toFixed(0)}</Text>
          <Text style={[jbStyles.streakLabel, { color: colors.textMuted }]}>Max Drawdown</Text>
        </View>
      </View>

      {/* Emotional Breakdown */}
      <Text style={[jbStyles.sectionTitle, { color: colors.text }]}>Emotional State Breakdown</Text>
      <View style={[jbStyles.chartCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {topEmotions.map(em => (
          <EmojiBar
            key={em.key}
            label={em.label}
            value={em.count}
            max={maxEmotionCount}
            color={EMOTION_COLORS[em.key]}
          />
        ))}
        {topEmotions.length === 0 && (
          <Text style={[jbStyles.emptyText, { color: colors.textMuted }]}>No entries to analyze yet.</Text>
        )}
      </View>

      {/* Mistake Frequency */}
      <Text style={[jbStyles.sectionTitle, { color: colors.text }]}>Most Common Mistakes</Text>
      <View style={[jbStyles.chartCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {topMistakes.map((m, i) => {
          const mistakeColors = ['#EF4444', '#F59E0B', '#F97316', '#8B5CF6', '#3B82F6', '#10B981'];
          return (
            <MistakeBar
              key={m.key}
              label={m.label}
              count={m.count}
              max={maxMistakeCount}
              color={mistakeColors[i % mistakeColors.length]}
            />
          );
        })}
        {topMistakes.length === 0 && (
          <Text style={[jbStyles.emptyText, { color: colors.textMuted }]}>No mistakes recorded. Great discipline!</Text>
        )}
      </View>

      {/* Improvement Tip */}
      {reports.length > 0 && reports[0].improvementTip && (
        <View style={[jbStyles.tipCard, { backgroundColor: EMOTION_COLORS.calm + '10', borderColor: EMOTION_COLORS.calm + '30' }]}>
          <Ionicons name="bulb" size={24} color={EMOTION_COLORS.calm} />
          <View style={jbStyles.tipContent}>
            <Text style={[jbStyles.tipTitle, { color: EMOTION_COLORS.calm }]}>Improvement Tip</Text>
            <Text style={[jbStyles.tipText, { color: colors.textSecondary }]}>{reports[0].improvementTip}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderEntries = () => (
    <View>
      {/* Period Filter */}
      <View style={jbStyles.periodRow}>
        {(['all', 'week', 'month'] as const).map(p => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            style={[
              jbStyles.periodBtn,
              { backgroundColor: colors.bgCard, borderColor: colors.border },
              period === p && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            <Text style={[
              jbStyles.periodBtnText,
              { color: colors.textSecondary },
              period === p && { color: colors.white },
            ]}>
              {p === 'all' ? 'All Time' : p === 'week' ? 'This Week' : 'This Month'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Entries */}
      {filteredEntries.map(entry => (
        <JournalEntryCard
          key={entry.id}
          entry={entry}
          colors={colors}
          onPress={() => {
            Alert.alert(
              `Delete Entry?`,
              `Delete ${entry.symbol} trade (${entry.direction}, ₹${entry.pnl.toFixed(0)})? This cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(entry.id) },
              ]
            );
          }}
        />
      ))}
      {filteredEntries.length === 0 && (
        <View style={jbStyles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
          <Text style={[jbStyles.emptyTitle, { color: colors.textMuted }]}>No entries for this period</Text>
          <Text style={[jbStyles.emptySubtitle, { color: colors.textMuted }]}>Start journaling your trades to track your behavioral patterns.</Text>
        </View>
      )}
    </View>
  );

  const renderReports = () => (
    <View>
      {reports.map(report => (
        <WeeklyReportCard key={report.weekStart} report={report} colors={colors} />
      ))}
      {reports.length === 0 && (
        <View style={jbStyles.emptyState}>
          <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
          <Text style={[jbStyles.emptyTitle, { color: colors.textMuted }]}>No reports yet</Text>
          <Text style={[jbStyles.emptySubtitle, { color: colors.textMuted }]}>Add journal entries to generate weekly reports.</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[jbStyles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={jbStyles.header}>
        <Text style={[jbStyles.headerTitle, { color: colors.text }]}>Behavioural Journal</Text>
        <Text style={[jbStyles.headerSubtitle, { color: colors.textSecondary }]}>Track your trading psychology</Text>
      </View>

      {/* Tab Bar */}
      <View style={[jbStyles.tabBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {(['dashboard', 'entries', 'reports'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              jbStyles.tabBtn,
              activeTab === tab && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
            ]}
          >
            <Ionicons
              name={tab === 'dashboard' ? 'grid' : tab === 'entries' ? 'list' : 'analytics'}
              size={16}
              color={activeTab === tab ? colors.primary : colors.textMuted}
            />
            <Text style={[
              jbStyles.tabText,
              { color: activeTab === tab ? colors.primary : colors.textMuted },
            ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={jbStyles.scrollContent}
      >
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'entries' && renderEntries()}
        {activeTab === 'reports' && renderReports()}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB — Add Entry */}
      <AnimatedPressable
        onPress={() => setShowAddModal(true)}
        scaleTo={0.92}
        style={jbStyles.fab}
      >
        <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={jbStyles.fabGradient}>
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </AnimatedPressable>

      {/* Add Entry Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={jbStyles.modalOverlay}
        >
          <View style={[jbStyles.modalContent, { backgroundColor: colors.bgSecondary }]}>
            <View style={jbStyles.modalHeader}>
              <Text style={[jbStyles.modalTitle, { color: colors.text }]}>New Journal Entry</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={jbStyles.modalBody}>
              {/* Symbol & Direction */}
              <View style={jbStyles.formRow}>
                <View style={jbStyles.formFieldHalf}>
                  <Text style={[jbStyles.formLabel, { color: colors.textSecondary }]}>Symbol</Text>
                  <TextInput
                    style={[jbStyles.formInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
                    value={formSymbol}
                    onChangeText={setFormSymbol}
                    placeholder="e.g. RELIANCE"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={jbStyles.formFieldHalf}>
                  <Text style={[jbStyles.formLabel, { color: colors.textSecondary }]}>Direction</Text>
                  <View style={jbStyles.directionRow}>
                    <TouchableOpacity
                      onPress={() => setFormDirection('long')}
                      style={[jbStyles.dirBtn, { borderColor: colors.border }, formDirection === 'long' && { backgroundColor: EMOTION_COLORS.calm + '20', borderColor: EMOTION_COLORS.calm }]}
                    >
                      <Text style={[jbStyles.dirBtnText, { color: formDirection === 'long' ? EMOTION_COLORS.calm : colors.textMuted }]}>▲ Long</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setFormDirection('short')}
                      style={[jbStyles.dirBtn, { borderColor: colors.border }, formDirection === 'short' && { backgroundColor: EMOTION_COLORS.frustrated + '20', borderColor: EMOTION_COLORS.frustrated }]}
                    >
                      <Text style={[jbStyles.dirBtnText, { color: formDirection === 'short' ? EMOTION_COLORS.frustrated : colors.textMuted }]}>▼ Short</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Prices & Quantity */}
              <View style={jbStyles.formRow}>
                <View style={jbStyles.formFieldThird}>
                  <Text style={[jbStyles.formLabel, { color: colors.textSecondary }]}>Entry Price</Text>
                  <TextInput
                    style={[jbStyles.formInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
                    value={formEntryPrice}
                    onChangeText={setFormEntryPrice}
                    placeholder="2840"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={jbStyles.formFieldThird}>
                  <Text style={[jbStyles.formLabel, { color: colors.textSecondary }]}>Exit Price</Text>
                  <TextInput
                    style={[jbStyles.formInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
                    value={formExitPrice}
                    onChangeText={setFormExitPrice}
                    placeholder="2890"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={jbStyles.formFieldThird}>
                  <Text style={[jbStyles.formLabel, { color: colors.textSecondary }]}>Qty</Text>
                  <TextInput
                    style={[jbStyles.formInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
                    value={formQuantity}
                    onChangeText={setFormQuantity}
                    placeholder="50"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              {/* Emotional State */}
              <Text style={[jbStyles.formLabel, { color: colors.textSecondary }]}>How did you feel?</Text>
              <View style={jbStyles.emotionGrid}>
                {ALL_EMOTIONS.map(em => (
                  <TouchableOpacity
                    key={em}
                    onPress={() => setFormEmotion(em)}
                    style={[
                      jbStyles.emotionChip,
                      { borderColor: colors.border },
                      formEmotion === em && { backgroundColor: EMOTION_COLORS[em] + '20', borderColor: EMOTION_COLORS[em] },
                    ]}
                  >
                    <Ionicons name={EMOTION_ICONS[em] as any} size={18} color={formEmotion === em ? EMOTION_COLORS[em] : colors.textMuted} />
                    <Text style={[jbStyles.emotionChipText, { color: formEmotion === em ? EMOTION_COLORS[em] : colors.textMuted }]}>{em}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Mistakes */}
              <Text style={[jbStyles.formLabel, { color: colors.textSecondary }]}>Mistakes made (tap to toggle)</Text>
              <View style={jbStyles.mistakeGrid}>
                {(Object.entries(MISTAKE_LABELS) as [TradingMistake, string][]).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => toggleMistake(key)}
                    style={[
                      jbStyles.mistakeChip,
                      { borderColor: colors.border },
                      formMistakes.includes(key) && { backgroundColor: EMOTION_COLORS.frustrated + '20', borderColor: EMOTION_COLORS.frustrated },
                    ]}
                  >
                    <Text style={[jbStyles.mistakeChipText, { color: formMistakes.includes(key) ? EMOTION_COLORS.frustrated : colors.textMuted }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Plan Compliance */}
              <Text style={[jbStyles.formLabel, { color: colors.textSecondary }]}>Plan Compliance: {formCompliance}%</Text>
              <View style={jbStyles.complianceRow}>
                {[0, 25, 50, 75, 100].map(v => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setFormCompliance(v.toString())}
                    style={[
                      jbStyles.complianceBtn,
                      { borderColor: colors.border },
                      parseInt(formCompliance) === v && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                  >
                    <Text style={[jbStyles.complianceBtnText, { color: parseInt(formCompliance) === v ? colors.white : colors.textMuted }]}>{v}%</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Setup & Exit */}
              <View style={jbStyles.formRow}>
                <View style={jbStyles.formFieldHalf}>
                  <Text style={[jbStyles.formLabel, { color: colors.textSecondary }]}>Setup Type</Text>
                  <TextInput
                    style={[jbStyles.formInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
                    value={formSetup}
                    onChangeText={setFormSetup}
                    placeholder="breakout, pullback, trend_follow..."
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={jbStyles.formFieldHalf}>
                  <Text style={[jbStyles.formLabel, { color: colors.textSecondary }]}>Exit Reason</Text>
                  <TextInput
                    style={[jbStyles.formInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
                    value={formExitReason}
                    onChangeText={setFormExitReason}
                    placeholder="target, stop_loss, manual"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Notes */}
              <Text style={[jbStyles.formLabel, { color: colors.textSecondary }]}>Notes</Text>
              <TextInput
                style={[jbStyles.formInput, jbStyles.formNotesInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="What did you learn from this trade?"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Submit */}
              <AnimatedPressable onPress={handleAddEntry} scaleTo={0.97} style={jbStyles.submitBtn}>
                <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={jbStyles.submitGradient}>
                  <Ionicons name="save" size={20} color="#fff" />
                  <Text style={jbStyles.submitText}>Save Entry</Text>
                </LinearGradient>
              </AnimatedPressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const jbStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg },
  headerTitle: { ...FONTS.bold, fontSize: FONTS.size.title },
  headerSubtitle: { ...FONTS.regular, fontSize: FONTS.size.md, marginTop: 4 },

  // Tab Bar
  tabBar: {
    flexDirection: 'row', marginHorizontal: SPACING.xl, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, padding: 4, marginBottom: SPACING.lg,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, borderColor: 'transparent',
  },
  tabText: { ...FONTS.medium, fontSize: FONTS.size.sm },

  // Scroll
  scrollContent: { paddingHorizontal: SPACING.xl },

  // Sections
  sectionTitle: { ...FONTS.semiBold, fontSize: FONTS.size.lg, marginBottom: SPACING.md, marginTop: SPACING.lg },

  // Metrics Grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  metricCard: {
    width: (width - SPACING.xl * 2 - SPACING.sm) / 2,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
  },
  metricIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  metricValue: { ...FONTS.bold, fontSize: FONTS.size.xl, marginBottom: 2 },
  metricLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  metricSub: { ...FONTS.medium, fontSize: FONTS.size.xs, marginTop: 4 },

  // Streaks
  streakRow: {
    flexDirection: 'row', borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
    marginTop: SPACING.lg, paddingVertical: SPACING.md,
  },
  streakItem: { flex: 1, alignItems: 'center', gap: 4 },
  streakValue: { ...FONTS.bold, fontSize: FONTS.size.xxl },
  streakLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  streakDivider: { width: 1, height: 40, alignSelf: 'center' },

  // Chart Card
  chartCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.sm,
  },

  // Emoji Bar
  emojiBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  emojiBarLabel: { width: 80, ...FONTS.regular, fontSize: FONTS.size.sm, textTransform: 'capitalize' },
  emojiBarTrack: {
    flex: 1, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: SPACING.sm, overflow: 'hidden',
  },
  emojiBarFill: { height: '100%', borderRadius: 9 },
  emojiBarValue: { width: 24, textAlign: 'right', ...FONTS.medium, fontSize: FONTS.size.sm },

  // Mistake Bar
  mistakeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs },
  mistakeLabel: { width: 110, ...FONTS.regular, fontSize: FONTS.size.xs },
  mistakeTrack: { flex: 1, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: SPACING.sm, overflow: 'hidden' },
  mistakeFill: { height: '100%', borderRadius: 7 },
  mistakeValue: { width: 20, textAlign: 'right', ...FONTS.medium, fontSize: FONTS.size.xs },

  // Tip Card
  tipCard: {
    flexDirection: 'row', padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginTop: SPACING.lg, gap: SPACING.md,
  },
  tipContent: { flex: 1 },
  tipTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md, marginBottom: 4 },
  tipText: { ...FONTS.regular, fontSize: FONTS.size.sm, lineHeight: 18 },

  // Period Row
  periodRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  periodBtn: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  periodBtnText: { ...FONTS.medium, fontSize: FONTS.size.sm },

  // Entry Card
  entryCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entrySymbolRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  entrySymbol: { ...FONTS.bold, fontSize: FONTS.size.lg },
  entryDir: { ...FONTS.medium, fontSize: FONTS.size.sm },
  entryEmotionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full,
  },
  entryEmotionText: { ...FONTS.medium, fontSize: FONTS.size.xs, textTransform: 'capitalize' },
  entryPnl: { ...FONTS.bold, fontSize: FONTS.size.lg },
  entryMeta: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 4 },
  entryNotes: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: SPACING.sm, lineHeight: 18 },
  entryMistakes: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  mistakeTag: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  mistakeTagText: { ...FONTS.medium, fontSize: FONTS.size.xs },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: SPACING.huge },
  emptyTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md, marginTop: SPACING.md },
  emptySubtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, textAlign: 'center', marginTop: SPACING.xs, paddingHorizontal: SPACING.xxxl },

  // Report Card
  reportCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  reportTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  reportSubtitle: { ...FONTS.regular, fontSize: FONTS.size.sm },
  reportMetrics: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  reportMetric: { flex: 1, alignItems: 'center' },
  reportMetricValue: { ...FONTS.bold, fontSize: FONTS.size.xl },
  reportMetricLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2 },
  reportInsight: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md, padding: SPACING.sm, borderRadius: BORDER_RADIUS.sm, backgroundColor: 'rgba(255,255,255,0.03)' },
  reportInsightIcon: { fontSize: 16 },
  reportInsightText: { flex: 1, ...FONTS.regular, fontSize: FONTS.size.sm, lineHeight: 18 },
  reportFooter: { flexDirection: 'row', gap: SPACING.lg },
  reportFootItem: { flex: 1 },
  reportFootLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, marginBottom: 2 },
  reportFootValue: { ...FONTS.medium, fontSize: FONTS.size.sm },
  reportFootEmotion: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  reportFootDot: { width: 8, height: 8, borderRadius: 4 },

  // FAB
  fab: { position: 'absolute', bottom: 24, right: SPACING.xl },
  fabGradient: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { maxHeight: '85%', borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.xl, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  modalTitle: { ...FONTS.bold, fontSize: FONTS.size.xl },
  modalBody: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },

  // Form
  formRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  formFieldHalf: { flex: 1 },
  formFieldThird: { flex: 1 },
  formLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, marginBottom: SPACING.sm },
  formInput: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, ...FONTS.regular, fontSize: FONTS.size.md },
  formNotesInput: { minHeight: 80 },
  directionRow: { flexDirection: 'row', gap: SPACING.sm },
  dirBtn: { flex: 1, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, alignItems: 'center' },
  dirBtnText: { ...FONTS.medium, fontSize: FONTS.size.sm },

  // Emotion Grid
  emotionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  emotionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  emotionChipText: { ...FONTS.medium, fontSize: FONTS.size.xs, textTransform: 'capitalize' },

  // Mistake Grid
  mistakeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  mistakeChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  mistakeChipText: { ...FONTS.medium, fontSize: FONTS.size.xs },

  // Compliance
  complianceRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  complianceBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  complianceBtnText: { ...FONTS.medium, fontSize: FONTS.size.sm },

  // Submit
  submitBtn: { marginTop: SPACING.lg, marginBottom: SPACING.xxxl },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md },
  submitText: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: '#fff' },

  // Misc
  emptyText: { ...FONTS.regular, fontSize: FONTS.size.sm, textAlign: 'center', paddingVertical: SPACING.lg },
});
