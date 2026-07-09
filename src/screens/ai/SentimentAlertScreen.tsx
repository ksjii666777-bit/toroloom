/**
 * ============================================================================
 * Toroloom — Sentiment Alert Screen
 * ============================================================================
 *
 * Manages sentiment shift alert rules and displays trigger history:
 *   - Active rules list with toggle/delete
 *   - Add new rule modal (pick stock, set sensitivity, direction)
 *   - Trigger history log with read/unread status
 *   - Empty states for no rules / no history
 * ============================================================================
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Modal, Dimensions, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONTS, GRADIENTS } from '../../constants/theme';
import { mockSentimentData } from '../../constants/mockData';
import {
  getMockAlertRules,
  getMockAlertTriggers,
  getSensitivityLabel,
  getSensitivityThreshold,
  createDefaultRule,
  evaluateRule,
  generateAlertMessage,
} from '../../services/ai/sentimentAlertService';
import { useNotificationStore } from '../../store/notificationStore';
import type { SentimentAlertRule, SentimentAlertTrigger, SentimentAlertSensitivity, SentimentAlertDirection } from '../../types';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Sensitivity Config ────────────────────────────────────

const SENSITIVITY_OPTIONS: { key: SentimentAlertSensitivity; label: string; desc: string; icon: string; color: string }[] = [
  { key: 'low', label: 'Low', desc: '25+ point shift', icon: 'shield-checkmark', color: '#10B981' },
  { key: 'medium', label: 'Medium', desc: '15+ point shift', icon: 'speedometer', color: '#F59E0B' },
  { key: 'high', label: 'High', desc: '10+ point shift', icon: 'refresh', color: '#EF4444' },
];

const DIRECTION_OPTIONS: { key: SentimentAlertDirection; label: string; icon: string }[] = [
  { key: 'both', label: 'Both', icon: 'swap-vertical' },
  { key: 'improving', label: 'Improving', icon: 'trending-up' },
  { key: 'deteriorating', label: 'Deteriorating', icon: 'trending-down' },
];

// ─── Helpers ───────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getDirectionColor(direction: string): string {
  return direction === 'improving' ? '#10B981' : '#EF4444';
}

function getDirectionIcon(direction: string): string {
  return direction === 'improving' ? 'trending-up' : 'trending-down';
}

// ─── Rule Card ─────────────────────────────────────────────

function RuleCard({
  rule,
  onToggle,
  onDelete,
  onPress,
}: {
  rule: SentimentAlertRule;
  onToggle: () => void;
  onDelete: () => void;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const sensOpt = SENSITIVITY_OPTIONS.find(s => s.key === rule.sensitivity)!;
  const dirOpt = DIRECTION_OPTIONS.find(d => d.key === rule.direction)!;

  return (
    <TouchableOpacity
      style={[ruleCardStyles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={ruleCardStyles.topRow}>
        <View style={{ flex: 1 }}>
          <View style={ruleCardStyles.symbolRow}>
            <Text style={[ruleCardStyles.symbol, { color: colors.text }]}>{rule.symbol}</Text>
            <Text style={[ruleCardStyles.sector, { color: colors.textMuted }]}>{rule.sector}</Text>
          </View>
          <Text style={[ruleCardStyles.stockName, { color: colors.textSecondary }]} numberOfLines={1}>{rule.stockName}</Text>
        </View>
        <Switch
          value={rule.enabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.bgInput, true: sensOpt.color + '60' }}
          thumbColor={rule.enabled ? sensOpt.color : colors.textMuted}
        />
      </View>

      <View style={ruleCardStyles.badgesRow}>
        <View style={[ruleCardStyles.badge, { backgroundColor: sensOpt.color + '15', borderColor: sensOpt.color + '30' }]}>
          <Ionicons name={sensOpt.icon as any} size={12} color={sensOpt.color} />
          <Text style={[ruleCardStyles.badgeText, { color: sensOpt.color }]}>{sensOpt.label}</Text>
        </View>
        <View style={[ruleCardStyles.badge, { backgroundColor: getDirectionColor(rule.direction === 'both' ? 'improving' : rule.direction) + '15', borderColor: getDirectionColor(rule.direction === 'both' ? 'improving' : rule.direction) + '30' }]}>
          <Ionicons name={dirOpt.icon as any} size={12} color={getDirectionColor(rule.direction === 'both' ? 'improving' : rule.direction)} />
          <Text style={[ruleCardStyles.badgeText, { color: getDirectionColor(rule.direction === 'both' ? 'improving' : rule.direction) }]}>{dirOpt.label}</Text>
        </View>
        {rule.triggered && (
          <View style={[ruleCardStyles.badge, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B30' }]}>
            <Ionicons name="checkmark-circle" size={12} color="#F59E0B" />
            <Text style={[ruleCardStyles.badgeText, { color: '#F59E0B' }]}>Triggered</Text>
          </View>
        )}
      </View>

      <View style={ruleCardStyles.bottomRow}>
        <Text style={[ruleCardStyles.thresholdLabel, { color: colors.textMuted }]}>
          Threshold: {getSensitivityThreshold(rule.sensitivity)}pt {rule.direction === 'both' ? 'shift' : rule.direction}
        </Text>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={16} color={colors.danger || '#EF4444'} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const ruleCardStyles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  sector: {
    fontSize: 11,
    fontWeight: '500',
  },
  stockName: {
    fontSize: 12,
    fontWeight: '500',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thresholdLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});

// ─── Trigger History Item ──────────────────────────────────

function TriggerItem({ trigger }: { trigger: SentimentAlertTrigger }) {
  const { colors } = useTheme();
  const dirColor = getDirectionColor(trigger.direction);

  return (
    <View style={[triggerStyles.item, {
      backgroundColor: trigger.read ? colors.bgCard : colors.bgCardLight,
      borderColor: colors.border,
      borderLeftColor: trigger.read ? colors.border : dirColor,
    }]}>
      <View style={triggerStyles.topRow}>
        <View style={[triggerStyles.dirIcon, { backgroundColor: dirColor + '15' }]}>
          <Ionicons name={getDirectionIcon(trigger.direction) as any} size={16} color={dirColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={triggerStyles.symbolRow}>
            <Text style={[triggerStyles.symbol, { color: colors.text }]}>{trigger.symbol}</Text>
            {!trigger.read && <View style={triggerStyles.unreadDot} />}
          </View>
          <Text style={[triggerStyles.message, { color: colors.textSecondary }]}>{trigger.message}</Text>
        </View>
      </View>
      <View style={triggerStyles.bottomRow}>
        <Text style={[triggerStyles.time, { color: colors.textMuted }]}>
          {formatRelativeTime(trigger.timestamp)}
        </Text>
        <View style={[triggerStyles.magnitudeBadge, { backgroundColor: dirColor + '15' }]}>
          <Text style={[triggerStyles.magnitudeText, { color: dirColor }]}>
            {trigger.direction === 'improving' ? '+' : ''}{Math.round(trigger.magnitude)}pts
          </Text>
        </View>
      </View>
    </View>
  );
}

const triggerStyles = StyleSheet.create({
  item: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  dirIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  symbol: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  message: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontSize: 11,
    fontWeight: '500',
  },
  magnitudeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  magnitudeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

// ─── Add Rule Modal ────────────────────────────────────────

function AddRuleModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (rule: SentimentAlertRule) => void;
}) {
  const { colors } = useTheme();
  const [selectedSymbol, setSelectedSymbol] = useState<string>('RELIANCE');
  const [sensitivity, setSensitivity] = useState<SentimentAlertSensitivity>('medium');
  const [direction, setDirection] = useState<SentimentAlertDirection>('both');

  const availableStocks = useMemo(() =>
    mockSentimentData.map(s => ({ symbol: s.symbol, name: s.name, sector: s.sector })),
    [],
  );

  const handleAdd = useCallback(() => {
    const stock = availableStocks.find(s => s.symbol === selectedSymbol);
    if (!stock) return;
    const rule = createDefaultRule(stock.symbol, stock.name, stock.sector);
    rule.sensitivity = sensitivity;
    rule.direction = direction;
    onAdd(rule);
    onClose();
  }, [selectedSymbol, sensitivity, direction, availableStocks, onAdd, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.content, { backgroundColor: colors.bgSecondary }]}>
          <View style={modalStyles.header}>
            <Text style={[modalStyles.title, { color: colors.text }]}>New Sentiment Alert</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Stock Picker */}
            <Text style={[modalStyles.sectionLabel, { color: colors.textSecondary }]}>Stock</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modalStyles.stockPicker}>
              {availableStocks.map(s => {
                const isActive = s.symbol === selectedSymbol;
                return (
                  <TouchableOpacity
                    key={s.symbol}
                    onPress={() => setSelectedSymbol(s.symbol)}
                    style={[modalStyles.stockChip, {
                      backgroundColor: isActive ? colors.primary : colors.bgCardLight,
                      borderColor: isActive ? colors.primary : colors.border,
                    }]}
                  >
                    <Text style={[modalStyles.stockChipText, { color: isActive ? '#FFF' : colors.textSecondary }]}>
                      {s.symbol}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sensitivity */}
            <Text style={[modalStyles.sectionLabel, { color: colors.textSecondary, marginTop: SPACING.lg }]}>
              Sensitivity
            </Text>
            <Text style={[modalStyles.sectionDesc, { color: colors.textMuted }]}>
              {getSensitivityLabel(sensitivity)}
            </Text>
            <View style={modalStyles.optionsRow}>
              {SENSITIVITY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setSensitivity(opt.key)}
                  style={[modalStyles.optionCard, {
                    backgroundColor: sensitivity === opt.key ? opt.color + '20' : colors.bgCard,
                    borderColor: sensitivity === opt.key ? opt.color : colors.border,
                  }]}
                >
                  <Ionicons name={opt.icon as any} size={20} color={sensitivity === opt.key ? opt.color : colors.textMuted} />
                  <Text style={[modalStyles.optionLabel, { color: sensitivity === opt.key ? opt.color : colors.text }]}>{opt.label}</Text>
                  <Text style={[modalStyles.optionDesc, { color: sensitivity === opt.key ? opt.color + 'CC' : colors.textMuted }]}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Direction */}
            <Text style={[modalStyles.sectionLabel, { color: colors.textSecondary, marginTop: SPACING.lg }]}>
              Alert Direction
            </Text>
            <View style={modalStyles.optionsRow}>
              {DIRECTION_OPTIONS.map(opt => {
                const isActive = direction === opt.key;
                const activeColor = opt.key === 'improving' ? '#10B981' : opt.key === 'deteriorating' ? '#EF4444' : '#3B82F6';
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setDirection(opt.key)}
                    style={[modalStyles.optionCard, {
                      backgroundColor: isActive ? activeColor + '20' : colors.bgCard,
                      borderColor: isActive ? activeColor : colors.border,
                    }]}
                  >
                    <Ionicons name={opt.icon as any} size={20} color={isActive ? activeColor : colors.textMuted} />
                    <Text style={[modalStyles.optionLabel, { color: isActive ? activeColor : colors.text }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Add Button */}
            <AnimatedPressable onPress={handleAdd} scaleTo={0.97} style={modalStyles.addBtn}>
              <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={modalStyles.addGradient}>
                <Ionicons name="add-circle" size={20} color="#FFF" />
                <Text style={modalStyles.addText}>Add Alert Rule</Text>
              </LinearGradient>
            </AnimatedPressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionDesc: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },
  stockPicker: {
    marginBottom: SPACING.sm,
  },
  stockChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginRight: 8,
  },
  stockChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  optionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: 4,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 10,
    fontWeight: '500',
  },
  addBtn: {
    marginTop: SPACING.xl,
  },
  addGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  addText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});

// ─── Main Screen ───────────────────────────────────────────

export default function SentimentAlertScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [rules, setRules] = useState<SentimentAlertRule[]>(getMockAlertRules);
  const [triggers, setTriggers] = useState<SentimentAlertTrigger[]>(getMockAlertTriggers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'history'>('rules');

  const unreadTriggerCount = useMemo(() => triggers.filter(t => !t.read).length, [triggers]);

  // ── Push mock triggers as real notifications on mount ──────
  // The store's addNotification() already calls sendLocalNotification internally,
  // so we don't need to call sendSentimentAlert separately.
  useEffect(() => {
    const notifStore = useNotificationStore.getState();
    getMockAlertTriggers().forEach(trigger => {
      if (!trigger.read) {
        notifStore.addNotification({
          id: trigger.id,
          type: 'sentiment_alert',
          title: `${trigger.symbol} Sentiment ${trigger.direction === 'improving' ? '↑' : '↓'}`,
          message: trigger.message,
          read: false,
          timestamp: trigger.timestamp,
          data: { symbol: trigger.symbol, ruleId: trigger.ruleId, magnitude: trigger.magnitude },
        });
      }
    });
  }, []);

  const handleToggleRule = useCallback((ruleId: string) => {
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, enabled: !r.enabled, triggered: false } : r,
    ));
  }, []);

  const handleDeleteRule = useCallback((ruleId: string) => {
    Alert.alert('Remove Rule', 'Are you sure you want to remove this sentiment alert rule?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        setRules(prev => prev.filter(r => r.id !== ruleId));
      }},
    ]);
  }, []);

  const handleAddRule = useCallback((rule: SentimentAlertRule) => {
    setRules(prev => [rule, ...prev]);

    // Evaluate the new rule against sentiment data and push notification if it triggers
    // The store's addNotification() already calls sendLocalNotification internally.
    const sentiment = mockSentimentData.find(s => s.symbol === rule.symbol);
    if (sentiment && sentiment.history.length >= 2) {
      const result = evaluateRule(rule, sentiment.history);
      if (result) {
        const triggerMsg = generateAlertMessage(rule, result);
        const title = `${rule.symbol} Sentiment ${result.direction === 'improving' ? '↑' : '↓'}`;

        // Add to notification store — fires push notification + appears in NotificationsScreen
        useNotificationStore.getState().addNotification({
          id: `sat_${Date.now()}`,
          type: 'sentiment_alert',
          title,
          message: triggerMsg,
          read: false,
          timestamp: new Date().toISOString(),
          data: { symbol: rule.symbol, ruleId: rule.id, magnitude: result.magnitude },
        });

        // Mark rule as triggered
        setRules(prev => prev.map(r =>
          r.id === rule.id ? { ...r, triggered: true, lastTriggeredAt: new Date().toISOString() } : r,
        ));

        // Add to local trigger history
        setTriggers(prev => [{
          id: `sat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ruleId: rule.id,
          symbol: rule.symbol,
          stockName: rule.stockName,
          magnitude: Math.round(result.magnitude * 10) / 10,
          direction: result.direction,
          score: result.score,
          previousScore: result.previousScore,
          message: triggerMsg,
          timestamp: new Date().toISOString(),
          read: false,
        }, ...prev]);
      }
    }
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setTriggers(prev => prev.map(t => ({ ...t, read: true })));
  }, []);

  const markTriggerRead = useCallback((triggerId: string) => {
    setTriggers(prev => prev.map(t =>
      t.id === triggerId ? { ...t, read: true } : t,
    ));
  }, []);

  const activeRules = useMemo(() => rules.filter(r => r.enabled), [rules]);
  const inactiveRules = useMemo(() => rules.filter(r => !r.enabled), [rules]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Sentiment Alerts</Text>
            <Text style={styles.headerSubtitle}>
              {rules.length} rule{rules.length !== 1 ? 's' : ''} · {unreadTriggerCount > 0 ? `${unreadTriggerCount} new alert${unreadTriggerCount > 1 ? 's' : ''}` : 'No new alerts'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addBtn}>
            <Ionicons name="add" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'rules' && styles.tabActive]}
            onPress={() => setActiveTab('rules')}
          >
            <Ionicons name="notifications" size={16} color={activeTab === 'rules' ? colors.primary : colors.textMuted} />
            <Text style={[styles.tabLabel, activeTab === 'rules' && styles.tabLabelActive]}>Rules</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Ionicons name="time" size={16} color={activeTab === 'history' ? colors.primary : colors.textMuted} />
            <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}>History</Text>
            {unreadTriggerCount > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{unreadTriggerCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'rules' ? (
          <>
            {/* Active Rules */}
            <Text style={styles.sectionTitle}>Active Rules ({activeRules.length})</Text>
            {activeRules.length > 0 ? (
              activeRules.map(rule => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onToggle={() => handleToggleRule(rule.id)}
                  onDelete={() => handleDeleteRule(rule.id)}
                  onPress={() => markTriggerRead(rule.id)}
                />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Active Rules</Text>
                <Text style={styles.emptyDesc}>Tap + to add a sentiment alert rule for your stocks</Text>
              </View>
            )}

            {/* Inactive Rules */}
            {inactiveRules.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>Inactive ({inactiveRules.length})</Text>
                {inactiveRules.map(rule => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onToggle={() => handleToggleRule(rule.id)}
                    onDelete={() => handleDeleteRule(rule.id)}
                    onPress={() => {}}
                  />
                ))}
              </>
            )}
          </>
        ) : (
          <>
            {/* History Header */}
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>
                Trigger History ({triggers.length})
              </Text>
              {unreadTriggerCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllRead}>
                  <Text style={[styles.markAllRead, { color: colors.primary }]}>Mark all read</Text>
                </TouchableOpacity>
              )}
            </View>

            {triggers.length > 0 ? (
              triggers.map(trigger => (
                <TouchableOpacity key={trigger.id} onPress={() => markTriggerRead(trigger.id)} activeOpacity={0.9}>
                  <TriggerItem trigger={trigger} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="pulse-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Triggers Yet</Text>
                <Text style={styles.emptyDesc}>Sentiment alerts will appear here when they fire</Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Rule Modal */}
      <AddRuleModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddRule}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 12, fontWeight: '500', color: colors.textMuted, marginTop: 1 },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center' },

  // Tabs
  tabsRow: { flexDirection: 'row', gap: SPACING.sm },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, backgroundColor: colors.bgCard,
  },
  tabActive: { backgroundColor: colors.primary + '20' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabLabelActive: { color: colors.primary },
  badgeCount: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeCountText: { fontSize: 10, fontWeight: '800', color: '#FFF' },

  // Content
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: SPACING.md },

  // History Header
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  markAllRead: { fontSize: 12, fontWeight: '700' },

  // Empty
  emptyCard: { alignItems: 'center', paddingVertical: 60, gap: SPACING.md },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyDesc: { fontSize: 13, fontWeight: '500', color: colors.textMuted, textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 },
});
