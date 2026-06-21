import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useNotificationStore, isInQuietHours, PortfolioAlertKind } from '../../store/notificationStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { SPACING, FONTS, BORDER_RADIUS} from '../../constants/theme';
import { formatCurrency} from '../../utils/formatters';
import { sendPortfolioAlert } from '../../services/notificationService';

Dimensions.get('window');

const ALERT_KINDS: {
  kind: PortfolioAlertKind;
  icon: string;
  color: string;
  label: string;
  desc: string;
  unit: string;
  defaultThreshold: number;
  direction: 'above' | 'below';
  step: number;
  min: number;
  max: number;
}[] = [
  {
    kind: 'portfolio_pnl_pct',
    icon: 'trending-down',
    color: '#FF1744',
    label: 'Portfolio P&L %',
    desc: 'Alert when portfolio return drops below a % threshold',
    unit: '%',
    defaultThreshold: -5,
    direction: 'below',
    step: 1,
    min: -20,
    max: 0,
  },
  {
    kind: 'portfolio_pnl_abs',
    icon: 'cash-outline',
    color: '#FF6B6B',
    label: 'Portfolio Loss (₹)',
    desc: 'Alert when portfolio loss exceeds a rupee amount',
    unit: '₹',
    defaultThreshold: 10000,
    direction: 'below',
    step: 5000,
    min: 1000,
    max: 100000,
  },
  {
    kind: 'holding_day_gain_pct',
    icon: 'flash',
    color: '#FFC107',
    label: 'Holding Day Gain',
    desc: 'Alert when any holding moves more than X% in a day',
    unit: '%',
    defaultThreshold: 10,
    direction: 'above',
    step: 1,
    min: 2,
    max: 50,
  },
  {
    kind: 'holding_pnl_pct',
    icon: 'trending-up',
    color: '#00C853',
    label: 'Holding P&L %',
    desc: 'Alert when a holding gains or loses more than X% total',
    unit: '%',
    defaultThreshold: 20,
    direction: 'above',
    step: 5,
    min: 5,
    max: 100,
  },
  {
    kind: 'portfolio_peak_drawdown',
    icon: 'arrow-down-circle',
    color: '#9C27B0',
    label: 'Portfolio Drawdown',
    desc: 'Alert when portfolio drops X% from its peak',
    unit: '%',
    defaultThreshold: 3,
    direction: 'below',
    step: 1,
    min: 1,
    max: 20,
  },
  {
    kind: 'consecutive_loss_days',
    icon: 'calendar',
    color: '#00D2FF',
    label: 'Consecutive Loss Days',
    desc: 'Alert after X consecutive days of negative P&L',
    unit: 'days',
    defaultThreshold: 3,
    direction: 'below',
    step: 1,
    min: 2,
    max: 10,
  },
];

const HOLDING_KINDS: PortfolioAlertKind[] = ['holding_day_gain_pct', 'holding_pnl_pct'];

export default function PortfolioAlertsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    portfolioAlertRules,
    addPortfolioAlertRule,
    removePortfolioAlertRule,
    updatePortfolioAlertRule,
    alertTriggerHistory,
    clearAlertTriggerHistory,
    quickAddDayGainThreshold,
    quickAddPnLThreshold,
    setQuickAddThreshold,
    preferences,
  } = useNotificationStore();
  const { holdings } = usePortfolioStore();

  const [stockPickerVisible, setStockPickerVisible] = useState(false);
  const [pendingKind, setPendingKind] = useState<PortfolioAlertKind | null>(null);
  const [stockPickerForRule, setStockPickerForRule] = useState<string | null>(null);
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const handleToggleRule = useCallback((ruleId: string, enabled: boolean) => {
    updatePortfolioAlertRule(ruleId, { enabled });
  }, [updatePortfolioAlertRule]);

  const openStockPicker = useCallback((kind: PortfolioAlertKind, existingRuleId?: string) => {
    // Pre-populate selected stocks when editing an existing rule
    if (existingRuleId) {
      const rule = portfolioAlertRules.find(r => r.id === existingRuleId);
      setSelectedStockIds(rule?.stockIds || []);
      setStockPickerForRule(existingRuleId);
    } else {
      setSelectedStockIds([]);
      setPendingKind(kind);
    }
    setSearchQuery('');
    setStockPickerVisible(true);
  }, [portfolioAlertRules]);

  const toggleStockSelection = useCallback((stockId: string) => {
    setSelectedStockIds(prev =>
      prev.includes(stockId)
        ? prev.filter(id => id !== stockId)
        : [...prev, stockId]
    );
  }, []);

  const handleConfirmStocks = useCallback(() => {
    if (selectedStockIds.length === 0) {
      Alert.alert('No Holdings Selected', 'Please select at least one holding.');
      return;
    }

    setStockPickerVisible(false);

    // Get selected holding info
    const selectedHoldings = holdings.filter(h => selectedStockIds.includes(h.stockId));
    const symbols = selectedHoldings.map(h => h.symbol);
    const labelSuffix = symbols.length <= 2
      ? symbols.join(', ')
      : `${symbols[0]}, ${symbols[1]} +${symbols.length - 2} more`;

    if (stockPickerForRule) {
      // Update stocks for an existing rule
      const rule = portfolioAlertRules.find(r => r.id === stockPickerForRule);
      if (rule) {
        updatePortfolioAlertRule(stockPickerForRule, {
          stockIds: selectedStockIds,
          symbols,
          label: `${rule.kind === 'holding_pnl_pct' ? 'P&L' : 'Day Gain'} — ${labelSuffix}`,
        });
      }
      setStockPickerForRule(null);
      return;
    }

    // Creating a new rule
    const kind = pendingKind;
    if (!kind) return;
    setPendingKind(null);

    const config = ALERT_KINDS.find(c => c.kind === kind);
    if (!config) return;

    addPortfolioAlertRule({
      kind,
      label: `${config.label} — ${labelSuffix}`,
      threshold: config.defaultThreshold,
      direction: config.direction,
      enabled: true,
      badge: true,
      stockIds: selectedStockIds,
      symbols,
    });

    Alert.alert(
      'Alert Added',
      `${labelSuffix} ${config.label} alert created with ${config.defaultThreshold}${config.unit} threshold.`,
    );
  }, [selectedStockIds, holdings, stockPickerForRule, pendingKind, portfolioAlertRules, addPortfolioAlertRule, updatePortfolioAlertRule]);

  /** For non-holding alerts (portfolio-level), add directly without stock picker */
  const handleAddRule = useCallback((kind: PortfolioAlertKind) => {
    const config = ALERT_KINDS.find(c => c.kind === kind);
    if (!config) return;

    // Holding-specific alerts need a stock picker first
    if (HOLDING_KINDS.includes(kind)) {
      openStockPicker(kind);
      return;
    }

    // Check if this kind already exists
    const existing = portfolioAlertRules.find(r => r.kind === kind);
    if (existing) {
      // Toggle it on instead of adding duplicate
      handleToggleRule(existing.id, true);
      return;
    }

    addPortfolioAlertRule({
      kind,
      label: config.label,
      threshold: config.defaultThreshold,
      direction: config.direction,
      enabled: true,
      badge: true,
    });

    Alert.alert('Alert Added', `${config.label} alert has been created with default threshold of ${config.defaultThreshold}${config.unit}.`);
  }, [addPortfolioAlertRule, portfolioAlertRules, handleToggleRule, openStockPicker]);

  const handleTestAlert = useCallback((rule: typeof portfolioAlertRules[0]) => {
    const config = ALERT_KINDS.find(c => c.kind === rule.kind);
    if (!config) return;

    const testValue = rule.kind === 'portfolio_pnl_pct' ? rule.threshold - 1
      : rule.kind === 'portfolio_pnl_abs' ? rule.threshold + 1000
      : rule.kind === 'consecutive_loss_days' ? rule.threshold
      : rule.threshold + 2;

    const testTitle = `🧪 Test: ${rule.label}`;
    const testMessage = `This is a test alert for ${rule.label}. Threshold: ${rule.threshold}${config.unit}. Test value: ${testValue}. If you see this, notifications are working!`;

    sendPortfolioAlert(testTitle, testMessage, { kind: rule.kind, value: testValue, threshold: rule.threshold, test: true });

    const store = useNotificationStore.getState();
    store.addNotification({
      id: `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'portfolio_alert',
      title: testTitle,
      message: testMessage,
      read: false,
      timestamp: new Date().toISOString(),
      data: { kind: rule.kind, value: testValue, threshold: rule.threshold, test: true },
    });

    // Record in trigger history
    useNotificationStore.setState(state => ({
      portfolioAlertBadgeCount: state.portfolioAlertBadgeCount + 1,
      alertTriggerHistory: [{
        ruleId: rule.id,
        ruleLabel: rule.label,
        kind: rule.kind,
        value: testValue,
        threshold: rule.threshold,
        timestamp: new Date().toISOString(),
        summary: `🧪 Test trigger for ${rule.label}`,
      }, ...state.alertTriggerHistory],
      portfolioAlertRules: state.portfolioAlertRules.map(r =>
        r.id === rule.id ? { ...r, triggered: true } : r
      ),
    }));

    Alert.alert('🧪 Test Alert Fired', `A test notification has been sent for "${rule.label}". Check your notifications and trigger history below. Toggle the rule off/on to re-arm it.`);
  }, []);

  const handleRemoveRule = useCallback((ruleId: string, label: string) => {
    Alert.alert(
      'Remove Alert',
      `Remove the "${label}" alert rule?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removePortfolioAlertRule(ruleId) },
      ],
    );
  }, [removePortfolioAlertRule]);

  const handleAdjustThreshold = useCallback((ruleId: string, delta: number, kind: PortfolioAlertKind) => {
    const rule = portfolioAlertRules.find(r => r.id === ruleId);
    const config = ALERT_KINDS.find(c => c.kind === kind);
    if (!rule || !config) return;

    const current = rule.threshold;
    const newVal = Math.max(config.min, Math.min(config.max, current + delta));
    updatePortfolioAlertRule(ruleId, { threshold: newVal });
  }, [portfolioAlertRules, updatePortfolioAlertRule]);

  const renderAlertCard = (rule: typeof portfolioAlertRules[0]) => {
    const config = ALERT_KINDS.find(c => c.kind === rule.kind);
    if (!config) return null;
    const isHoldingKind = HOLDING_KINDS.includes(rule.kind);
    const holdingInfos = isHoldingKind && rule.symbols?.length
      ? holdings.filter(h => rule.symbols!.includes(h.symbol))
      : [];

    return (
      <View key={rule.id} style={[styles.alertCard, !rule.enabled && styles.alertCardDisabled]}>
        <View style={styles.alertHeader}>
          <View style={[styles.alertIcon, { backgroundColor: config.color + '20' }]}>
            <Ionicons name={config.icon as any} size={22} color={config.color} />
          </View>
          <View style={styles.alertInfo}>
            <Text style={styles.alertLabel}>
              {isHoldingKind && rule.symbols?.length ? `${rule.symbols[0]}${rule.symbols.length > 1 ? ` +${rule.symbols.length - 1}` : ''} ${config.label}` : config.label}
            </Text>
            <Text style={styles.alertDesc}>
              {isHoldingKind && rule.symbols?.length
                ? `${rule.symbols.length} holding${rule.symbols.length > 1 ? 's' : ''} watched · ${config.desc}`
                : config.desc}
            </Text>
          </View>
          <Switch
            value={rule.enabled}
            onValueChange={val => handleToggleRule(rule.id, val)}
            trackColor={{ false: colors.bgInput, true: config.color + '60' }}
            thumbColor={rule.enabled ? config.color : colors.textMuted}
            ios_backgroundColor={colors.bgInput}
          />
        </View>

        {rule.enabled && (
          <>
            <View style={styles.alertDivider} />
            <View style={styles.alertBody}>
              {/* Stock info & change button for holding-specific alerts */}
              {isHoldingKind && (
                <TouchableOpacity
                  style={styles.stockSelector}
                  onPress={() => openStockPicker(rule.kind, rule.id)}
                >
                  <View style={styles.stockBadgeRow}>
                    {rule.symbols?.length ? (
                      rule.symbols.length <= 3
                        ? rule.symbols.map(sym => {
                            const hi = holdings.find(h => h.symbol === sym);
                            return (
                              <View key={sym} style={[styles.stockBadge, { backgroundColor: config.color + '20' }]}>
                                <Text style={[styles.stockBadgeText, { color: config.color }]}>{sym}</Text>
                              </View>
                            );
                          })
                        : (
                          <>
                            {rule.symbols.slice(0, 2).map(sym => (
                              <View key={sym} style={[styles.stockBadge, { backgroundColor: config.color + '20' }]}>
                                <Text style={[styles.stockBadgeText, { color: config.color }]}>{sym}</Text>
                              </View>
                            ))}
                            <View style={[styles.stockBadge, { backgroundColor: colors.bgInput }]}>
                              <Text style={[styles.stockBadgeText, { color: colors.textMuted }]}>+{rule.symbols.length - 2}</Text>
                            </View>
                          </>
                        )
                    ) : (
                      <Text style={styles.selectStockPrompt}>Tap to select holdings…</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}

              <View style={styles.thresholdRow}>
                <Text style={styles.thresholdLabel}>Threshold</Text>
                <View style={styles.thresholdControls}>
                  <TouchableOpacity
                    style={styles.thresholdBtn}
                    onPress={() => handleAdjustThreshold(rule.id, -config.step, rule.kind)}
                  >
                    <Ionicons name="remove" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <View style={styles.thresholdValueWrap}>
                    <Text style={[styles.thresholdValue, { color: config.color }]}>
                      {config.kind === 'portfolio_pnl_abs'
                        ? formatCurrency(rule.threshold, true)
                        : `${rule.threshold}${config.unit}`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.thresholdBtn}
                    onPress={() => handleAdjustThreshold(rule.id, config.step, rule.kind)}
                  >
                    <Ionicons name="add" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.badgeBtn}
                onPress={() => updatePortfolioAlertRule(rule.id, { badge: !rule.badge })}
              >
                <Ionicons
                  name={rule.badge ? 'shield-checkmark' : 'shield-outline'}
                  size={14}
                  color={rule.badge ? '#6C63FF' : colors.textMuted}
                />
                <Text style={[styles.badgeText, { color: rule.badge ? '#6C63FF' : colors.textMuted }]}>
                  Badge
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.testBtn}
                onPress={() => handleTestAlert(rule)}
              >
                <Ionicons name="flask-outline" size={14} color={colors.primary} />
                <Text style={styles.testText}>Test Alert</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => handleRemoveRule(rule.id, config.label)}
              >
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  // Separate enabled and disabled rules
  const enabledRules = portfolioAlertRules.filter(r => r.enabled);
  const disabledRules = portfolioAlertRules.filter(r => !r.enabled);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={[colors.bgSecondary, colors.bg]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>Portfolio Alerts</Text>
            <Text style={styles.subtitle}>Real-time P&L and holding movement alerts</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Active Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Active Alerts ({enabledRules.length})
          </Text>
          {enabledRules.length > 0 ? (
            enabledRules.map(renderAlertCard)
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Active Alerts</Text>
              <Text style={styles.emptyDesc}>Toggle on alerts below to get notified</Text>
            </View>
          )}
        </View>

        {/* Add Alert Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Alert Rules</Text>
          <View style={styles.addGrid}>
            {ALERT_KINDS.map((config) => {
              const exists = portfolioAlertRules.some(r => r.kind === config.kind && r.enabled);
              return (
                <TouchableOpacity
                  key={config.kind}
                  style={[styles.addCard, exists && styles.addCardDisabled]}
                  onPress={() => handleAddRule(config.kind)}
                  disabled={exists}
                  activeOpacity={exists ? 1 : 0.7}
                >
                  <View style={[styles.addCardIcon, { backgroundColor: config.color + '20' }]}>
                    <Ionicons name={config.icon as any} size={24} color={exists ? colors.textMuted : config.color} />
                  </View>
                  <Text style={[styles.addCardLabel, exists && { color: colors.textMuted }]}>
                    {config.label}
                  </Text>
                  <Text style={styles.addCardDesc}>{config.desc}</Text>
                  {exists && (
                    <View style={styles.addedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.marketUp} />
                      <Text style={styles.addedBadgeText}>Active</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Disabled Alerts */}
        {disabledRules.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Paused Alerts ({disabledRules.length})</Text>
            {disabledRules.map(renderAlertCard)}
          </View>
        )}

        {/* ── Alert Trigger History ────────────────────── */}
        {alertTriggerHistory.length > 0 && (
          <View style={styles.section}>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>
                Trigger History ({alertTriggerHistory.length})
              </Text>
              <TouchableOpacity onPress={clearAlertTriggerHistory} style={styles.historyClearBtn}>
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text style={styles.historyClearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            {alertTriggerHistory.slice(0, 50).map((entry, i) => {
              const config = ALERT_KINDS.find(c => c.kind === entry.kind);
              const entryColor = config?.color || colors.primary;
              return (
                <View key={`${entry.ruleId}_${i}`} style={styles.historyCard}>
                  <View style={styles.historyLeft}>
                    <View style={[styles.historyDot, { backgroundColor: entryColor }]} />
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyRuleLabel} numberOfLines={1}>{entry.ruleLabel}</Text>
                      <Text style={styles.historySummary} numberOfLines={1}>{entry.summary}</Text>
                    </View>
                  </View>
                  <View style={styles.historyRight}>
                    <Text style={styles.historyTime}>
                      {new Date(entry.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </Text>
                    <Text style={[styles.historyValue, {
                      color: entry.value >= 0 ? colors.marketUp : colors.marketDown,
                    }]}>
                      {entry.kind === 'portfolio_pnl_abs'
                        ? `${entry.value < 0 ? '-' : ''}₹${Math.abs(entry.value).toLocaleString('en-IN')}`
                        : entry.kind === 'consecutive_loss_days'
                          ? `${entry.value}d`
                          : `${entry.value >= 0 ? '+' : ''}${entry.value.toFixed(1)}%`
                      }
                    </Text>
                  </View>
                </View>
              );
            })}
            {alertTriggerHistory.length > 50 && (
              <Text style={styles.historyMoreText}>+{alertTriggerHistory.length - 50} more</Text>
            )}
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color="#6C63FF" />
            <Text style={styles.infoText}>
              Portfolio alerts are evaluated in real-time using WebSocket price data. Alerts trigger once per rule — toggle the rule off/on to re-arm it.
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Ionicons name="notifications" size={20} color="#FFC107" />
            <Text style={styles.infoText}>
              Make sure "Price Alerts" are enabled in Notification Preferences for these to fire.
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Ionicons name="refresh" size={20} color="#00D2FF" />
            <Text style={styles.infoText}>
              Rules automatically re-arm at the start of each trading day.
            </Text>
          </View>
        </View>

        {/* ── Quiet Hours ──────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          <TouchableOpacity
            style={styles.quietHoursCard}
            onPress={() => navigation.navigate('NotificationPreferences')}
            activeOpacity={0.7}
          >
            <View style={[styles.quietHoursIcon, {
              backgroundColor: isInQuietHours(preferences)
                ? '#6C63FF20'
                : colors.bgInput,
            }]}>
              <Ionicons
                name={isInQuietHours(preferences) ? 'moon' : 'sunny-outline'}
                size={22}
                color={isInQuietHours(preferences) ? '#6C63FF' : colors.textMuted}
              />
            </View>
            <View style={styles.quietHoursInfo}>
              <Text style={styles.quietHoursLabel}>
                {isInQuietHours(preferences)
                  ? '🔇 Quiet hours active'
                  : '🔊 Quiet hours off'}
              </Text>
              <Text style={styles.quietHoursDesc}>
                {preferences.quietHoursStart && preferences.quietHoursEnd
                  ? `Silent from ${preferences.quietHoursStart} to ${preferences.quietHoursEnd} — push notifications are suppressed during this window`
                  : 'Push notifications fire immediately. Set quiet hours in Notification Preferences.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Quick-Add Defaults ──────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick-Add Defaults (long-press)</Text>
          <View style={styles.quickAddCard}>
            <View style={styles.quickAddRow}>
              <View style={styles.quickAddInfo}>
                <Text style={styles.quickAddLabel}>Day Gain Threshold</Text>
                <Text style={styles.quickAddDesc}>Default % for long-press day gain alert</Text>
              </View>
              <View style={styles.quickAddControls}>
                <TouchableOpacity
                  style={styles.quickAddBtn}
                  onPress={() => {
                    const next = Math.max(2, quickAddDayGainThreshold - 1);
                    setQuickAddThreshold('day_gain', next);
                  }}
                >
                  <Ionicons name="remove" size={16} color={colors.primary} />
                </TouchableOpacity>
                <View style={styles.quickAddValueWrap}>
                  <Text style={[styles.quickAddValue, { color: '#FFC107' }]}>{quickAddDayGainThreshold}%</Text>
                </View>
                <TouchableOpacity
                  style={styles.quickAddBtn}
                  onPress={() => {
                    const next = Math.min(50, quickAddDayGainThreshold + 1);
                    setQuickAddThreshold('day_gain', next);
                  }}
                >
                  <Ionicons name="add" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.quickAddDivider} />
            <View style={styles.quickAddRow}>
              <View style={styles.quickAddInfo}>
                <Text style={styles.quickAddLabel}>P&L Threshold</Text>
                <Text style={styles.quickAddDesc}>Default % for long-press P&L alert</Text>
              </View>
              <View style={styles.quickAddControls}>
                <TouchableOpacity
                  style={styles.quickAddBtn}
                  onPress={() => {
                    const next = Math.max(5, quickAddPnLThreshold - 5);
                    setQuickAddThreshold('pnl', next);
                  }}
                >
                  <Ionicons name="remove" size={16} color={colors.primary} />
                </TouchableOpacity>
                <View style={styles.quickAddValueWrap}>
                  <Text style={[styles.quickAddValue, { color: '#00C853' }]}>{quickAddPnLThreshold}%</Text>
                </View>
                <TouchableOpacity
                  style={styles.quickAddBtn}
                  onPress={() => {
                    const next = Math.min(100, quickAddPnLThreshold + 5);
                    setQuickAddThreshold('pnl', next);
                  }}
                >
                  <Ionicons name="add" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Stock Picker Modal (Multi-Select) ───────────────── */}
      <Modal
        visible={stockPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStockPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgCard }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Holdings</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedStockIds.length} of {holdings.length} selected
                </Text>
              </View>
              <View style={styles.modalHeaderActions}>
                <TouchableOpacity
                  style={styles.modalActionBtn}
                  onPress={() => {
                    // Select all selectable (non-already-alerted) holdings
                    const activeKind = pendingKind
                      || (stockPickerForRule
                        ? portfolioAlertRules.find(r => r.id === stockPickerForRule)?.kind
                        : null);
                    const alertedIds = new Set<string>();
                    if (activeKind) {
                      portfolioAlertRules
                        .filter(r => r.id !== stockPickerForRule && r.kind === activeKind && r.enabled && r.stockIds?.length)
                        .forEach(r => r.stockIds!.forEach(sid => alertedIds.add(sid)));
                    }
                    setSelectedStockIds(
                      holdings
                        .filter(h => !alertedIds.has(h.stockId))
                        .map(h => h.stockId)
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkbox-outline" size={16} color={colors.primary} />
                  <Text style={styles.modalActionText}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalActionBtn}
                  onPress={() => setSelectedStockIds([])}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove-circle-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.modalActionText, { color: colors.textMuted }]}>None</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStockPickerVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by symbol or name…"
                placeholderTextColor={colors.textMuted + '60'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {(() => {
                // Filter holdings by search query
                const query = searchQuery.trim().toLowerCase();
                const filteredHoldings = query
                  ? holdings.filter(h =>
                      h.symbol.toLowerCase().includes(query) ||
                      h.name.toLowerCase().includes(query)
                    )
                  : holdings;

                if (filteredHoldings.length === 0) {
                  return (
                    <View style={styles.modalEmpty}>
                      <Ionicons
                        name={query ? 'search-outline' : 'briefcase-outline'}
                        size={32}
                        color={colors.textMuted}
                      />
                      <Text style={styles.modalEmptyText}>
                        {query ? `No holdings matching "${searchQuery}"` : 'No holdings yet'}
                      </Text>
                    </View>
                  );
                }

                // Compute which stockIds already have active alerts of the current kind
                // Compute which stockIds already have active alerts of the current kind
                const activeKind = pendingKind
                  || (stockPickerForRule
                    ? portfolioAlertRules.find(r => r.id === stockPickerForRule)?.kind
                    : null);
                const alertedStockIds = new Set<string>();
                if (activeKind) {
                  portfolioAlertRules
                    .filter(r =>
                      r.id !== stockPickerForRule
                      && r.kind === activeKind
                      && r.enabled
                      && r.stockIds?.length
                    )
                    .forEach(r => r.stockIds!.forEach(sid => alertedStockIds.add(sid)));
                }

                return filteredHoldings.map(h => {
                  const isSelected = selectedStockIds.includes(h.stockId);
                  const isAlreadyAlerted = alertedStockIds.has(h.stockId);
                  const canSelect = !isAlreadyAlerted;

                  return (
                    <TouchableOpacity
                      key={h.id}
                      style={[
                        styles.modalItem,
                        isSelected && { backgroundColor: colors.primary + '15' },
                        isAlreadyAlerted && styles.modalItemDimmed,
                      ]}
                      onPress={() => {
                        if (canSelect) toggleStockSelection(h.stockId);
                      }}
                      activeOpacity={canSelect ? 0.7 : 1}
                    >
                      {/* Checkbox Circle */}
                      <View
                        style={[
                          styles.checkbox,
                          isAlreadyAlerted && styles.checkboxDisabled,
                          {
                            borderColor: isSelected
                              ? colors.primary
                              : isAlreadyAlerted
                                ? colors.textMuted + '40'
                                : colors.border,
                            backgroundColor: isSelected
                              ? colors.primary
                              : isAlreadyAlerted
                                ? colors.textMuted + '15'
                                : 'transparent',
                          },
                        ]}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        )}
                        {isAlreadyAlerted && !isSelected && (
                          <Ionicons name="notifications-off" size={12} color={colors.textMuted + '60'} />
                        )}
                      </View>

                      <View style={styles.modalItemInfo}>
                        <View style={styles.modalItemSymbolRow}>
                          <Text style={[
                            styles.modalItemSymbol,
                            isAlreadyAlerted && { color: colors.textMuted },
                          ]}>
                            {h.symbol}
                          </Text>
                          {isAlreadyAlerted && (
                            <View style={styles.alreadyAlertedBadge}>
                              <Text style={styles.alreadyAlertedText}>Alert active</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.modalItemName} numberOfLines={1}>
                          {h.name}
                        </Text>
                      </View>
                      <View style={styles.modalItemDetails}>
                        <Text style={styles.modalItemQty}>{h.quantity} shares</Text>
                        <Text
                          style={[
                            styles.modalItemPnl,
                            { color: h.pnl >= 0 ? colors.marketUp : colors.marketDown },
                          ]}
                        >
                          {h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl, true)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>

            {/* Confirm Button */}
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { opacity: selectedStockIds.length === 0 ? 0.5 : 1 },
              ]}
              onPress={handleConfirmStocks}
              disabled={selectedStockIds.length === 0}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.confirmBtnText}>
                {stockPickerForRule ? 'Update Holdings' : `Create Alert${selectedStockIds.length > 0 ? ` (${selectedStockIds.length})` : ''}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.lg,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.bgCard,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerInfo: {
      flex: 1,
    },
    title: {
      ...FONTS.bold,
      fontSize: FONTS.size.title,
      color: colors.text,
    },
    subtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    scrollContent: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: 20,
    },
    section: {
      marginBottom: SPACING.xxl,
    },
    sectionTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: SPACING.md,
    },
    alertCard: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    alertCardDisabled: {
      opacity: 0.6,
    },
    alertHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    alertIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    alertInfo: {
      flex: 1,
      marginRight: SPACING.md,
    },
    alertLabel: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    alertDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
    alertDivider: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: SPACING.md,
    },
    alertBody: {
      marginBottom: SPACING.sm,
    },
    thresholdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    thresholdLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textSecondary,
    },
    thresholdControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    thresholdBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    thresholdValueWrap: {
      backgroundColor: colors.bgInput,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 70,
      alignItems: 'center',
    },
    thresholdValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: SPACING.md,
      marginTop: SPACING.xs,
    },
    testBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.primary + '10',
    },
    testText: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
      color: colors.primary,
    },
    removeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
    },
    removeText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.danger,
    },
    badgeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.bgInput,
      marginRight: 'auto',
    },
    badgeText: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
    },
    emptyCard: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.xxl,
      alignItems: 'center',
      gap: SPACING.md,
    },
    emptyTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    emptyDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
      textAlign: 'center',
    },
    addGrid: {
      gap: SPACING.md,
    },
    addCard: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
    },
    addCardDisabled: {
      opacity: 0.5,
    },
    addCardIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    addCardLabel: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
      position: 'absolute',
      left: 72,
      top: SPACING.lg,
    },
    addCardDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      position: 'absolute',
      left: 72,
      top: SPACING.lg + SPACING.xl + 4,
      right: SPACING.lg,
    },
    addedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      position: 'absolute',
      top: SPACING.lg,
      right: SPACING.lg,
      backgroundColor: '#00C85315',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: BORDER_RADIUS.full,
    },
    addedBadgeText: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
      color: colors.marketUp,
    },
    /* ── Stock Picker Modal ───────────────────────────────── */
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalContent: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: SPACING.lg,
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.xxl + 20,
      maxHeight: '70%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    modalHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modalActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.bgInput,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalActionText: {
      ...FONTS.semiBold,
      fontSize: 11,
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    modalTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      color: colors.text,
    },
    modalSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
    /* ── Search Bar ───────────────────────────────────── */
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgInput,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.md,
      height: 42,
    },
    searchIcon: {
      marginRight: SPACING.sm,
    },
    searchInput: {
      flex: 1,
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.text,
      height: 42,
      paddingVertical: 0,
    },
    searchClearBtn: {
      padding: 4,
      marginLeft: SPACING.xs,
    },
    modalList: {
      maxHeight: 400,
    },
    modalEmpty: {
      alignItems: 'center',
      paddingVertical: SPACING.xxl,
      gap: SPACING.md,
    },
    modalEmptyText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    checkboxDisabled: {
      borderStyle: 'dashed',
    },
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.primary,
      paddingVertical: SPACING.md + 2,
      borderRadius: BORDER_RADIUS.lg,
      marginTop: SPACING.lg,
    },
    confirmBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: '#fff',
    },
    modalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    modalItemDimmed: {
      opacity: 0.55,
    },
    modalItemSymbolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    alreadyAlertedBadge: {
      backgroundColor: colors.textMuted + '20',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.full,
    },
    alreadyAlertedText: {
      ...FONTS.medium,
      fontSize: 9,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    modalItemInfo: {
      flex: 1,
    },
    modalItemSymbol: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    modalItemName: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
    modalItemDetails: {
      alignItems: 'flex-end',
      marginRight: SPACING.md,
    },
    modalItemQty: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textSecondary,
    },
    modalItemPnl: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      marginTop: 2,
    },
    /* ── Stock Selector (inside alert card) ────────────────── */
    stockBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      flexWrap: 'wrap',
      gap: 6,
    },
    stockSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgInput,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stockBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BORDER_RADIUS.full,
      marginRight: SPACING.sm,
    },
    stockBadgeText: {
      ...FONTS.bold,
      fontSize: FONTS.size.xs,
    },
    stockNameText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textSecondary,
      flex: 1,
    },
    selectStockPrompt: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      fontStyle: 'italic',
      flex: 1,
    },
    /* ── Trigger History ──────────────────────────────── */
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    historyClearBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.danger + '15',
    },
    historyClearText: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
      color: colors.danger,
    },
    historyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      marginBottom: SPACING.sm + 2,
    },
    historyLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: SPACING.md,
    },
    historyDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: SPACING.sm,
    },
    historyInfo: {
      flex: 1,
    },
    historyRuleLabel: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.text,
    },
    historySummary: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 1,
    },
    historyRight: {
      alignItems: 'flex-end',
    },
    historyTime: {
      ...FONTS.regular,
      fontSize: 10,
      color: colors.textMuted,
    },
    historyValue: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      marginTop: 1,
    },
    historyMoreText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
    /* ── Quick-Add Defaults ──────────────────────── */
    quickAddCard: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
    },
    quickAddRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.sm,
    },
    quickAddInfo: {
      flex: 1,
      marginRight: SPACING.md,
    },
    quickAddLabel: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.text,
    },
    quickAddDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
    quickAddControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    quickAddBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    quickAddValueWrap: {
      backgroundColor: colors.bgInput,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 56,
      alignItems: 'center',
    },
    quickAddValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
    },
    quickAddDivider: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: 2,
    },
    /* ── Quiet Hours ──────────────────────────────── */
  quietHoursCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quietHoursIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  quietHoursInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  quietHoursLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  quietHoursDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  infoCard: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    infoText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 18,
    },
    infoDivider: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: 2,
    },
  });
