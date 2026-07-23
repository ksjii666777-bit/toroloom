/**
 * ============================================================================
 * Smart Price Alerts Screen — Multi-Condition Price Alert Management
 * ============================================================================
 *
 * Features:
 *   - Alert list with status indicators (enabled/disabled, triggered)
 *   - Creation wizard: name, symbol, conditions (AND/OR), cooldown
 *   - Condition builder: price, volume, RSI, MA crossover, candle patterns, etc.
 *   - Preset templates for quick setup
 *   - Alert trigger history log
 *   - Empty states and animations
 * ============================================================================
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Modal,
  Dimensions,
  Alert,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useSmartAlertStore, SMART_ALERT_TEMPLATES, SmartAlertTemplate } from '../../store/smartAlertStore';
import {
  SmartAlert,
  SmartAlertCondition,
  SmartAlertConditionKind,
  ConditionLogic,
  CANDLE_PATTERNS,
  evaluateSmartAlert,
  generateMockHistory,
  summarizeEvalResult,
} from '../../services/smartAlertEngine';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { useT } from '../../hooks/useT';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// Condition kind metadata
// ============================================================================

interface ConditionKindInfo {
  kind: SmartAlertConditionKind;
  label: string;
  icon: string;
  color: string;
  category: 'price' | 'volume' | 'indicator' | 'pattern' | 'trend';
  defaultParams: SmartAlertCondition['params'];
}



const CONDITION_CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'price', label: 'Price', icon: '💰' },
  { key: 'volume', label: 'Volume', icon: '📊' },
  { key: 'indicator', label: 'Indicators', icon: '📈' },
  { key: 'pattern', label: 'Patterns', icon: '🕯️' },
  { key: 'trend', label: 'Trend', icon: '📉' },
];

// ============================================================================
// Component
// ============================================================================

export default function SmartPriceAlertsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const CONDITION_KINDS = useMemo<ConditionKindInfo[]>(() => [
    { kind: 'price_cross_above', label: t('smartAlerts.priceAbove'), icon: '↑', color: '#00C853', category: 'price', defaultParams: { threshold: 2000 } },
    { kind: 'price_cross_below', label: t('smartAlerts.priceBelow'), icon: '↓', color: '#FF1744', category: 'price', defaultParams: { threshold: 2000 } },
    { kind: 'price_change_pct', label: t('smartAlerts.priceChangePct'), icon: '↕', color: '#FF9100', category: 'price', defaultParams: { threshold: 2 } },
    { kind: 'gap_up', label: t('smartAlerts.gapUp'), icon: '⬆', color: '#00E676', category: 'price', defaultParams: { threshold: 1 } },
    { kind: 'gap_down', label: t('smartAlerts.gapDown'), icon: '⬇', color: '#FF5252', category: 'price', defaultParams: { threshold: 1 } },
    { kind: 'volume_spike', label: t('smartAlerts.volumeSpike'), icon: '📊', color: '#7C4DFF', category: 'volume', defaultParams: { multiplier: 2 } },
    { kind: 'volume_drop', label: t('smartAlerts.volumeDrop'), icon: '📉', color: '#FF6F00', category: 'volume', defaultParams: { multiplier: 0.5 } },
    { kind: 'rsi_oversold', label: t('smartAlerts.rsiOversold'), icon: '🟢', color: '#00C853', category: 'indicator', defaultParams: { threshold: 30 } },
    { kind: 'rsi_overbought', label: t('smartAlerts.rsiOverbought'), icon: '🔴', color: '#FF1744', category: 'indicator', defaultParams: { threshold: 70 } },
    { kind: 'rsi_cross_above', label: t('smartAlerts.rsiCrossAbove'), icon: '📈', color: '#00E5FF', category: 'indicator', defaultParams: { threshold: 50 } },
    { kind: 'rsi_cross_below', label: t('smartAlerts.rsiCrossBelow'), icon: '📉', color: '#FF9100', category: 'indicator', defaultParams: { threshold: 50 } },
    { kind: 'ma_crossover', label: t('smartAlerts.maCrossover'), icon: '🥇', color: '#00C853', category: 'indicator', defaultParams: { fastPeriod: 10, slowPeriod: 30 } },
    { kind: 'ma_crossunder', label: t('smartAlerts.maCrossunder'), icon: '💀', color: '#FF1744', category: 'indicator', defaultParams: { fastPeriod: 10, slowPeriod: 30 } },
    { kind: 'candle_pattern', label: t('smartAlerts.candlePattern'), icon: '🕯️', color: '#FF4081', category: 'pattern', defaultParams: { pattern: 'doji' } },
    { kind: 'consecutive_gain', label: t('smartAlerts.consecGains'), icon: '🟢', color: '#00C853', category: 'trend', defaultParams: { threshold: 3 } },
    { kind: 'consecutive_loss', label: t('smartAlerts.consecLosses'), icon: '🔴', color: '#FF1744', category: 'trend', defaultParams: { threshold: 3 } },
    { kind: 'breakout_high', label: t('smartAlerts.breakoutHigh'), icon: '🚀', color: '#00C853', category: 'price', defaultParams: { period: 20 } },
    { kind: 'breakout_low', label: t('smartAlerts.breakoutLow'), icon: '💥', color: '#FF1744', category: 'price', defaultParams: { period: 20 } },
  ], [t]);

  // ── Helper: format condition as short chip text ──────────────────────
  const formatConditionShort = useCallback((condition: SmartAlertCondition, info?: ConditionKindInfo): string => {
    const { kind, params } = condition;
    switch (kind) {
      case 'price_cross_above': return `> \u20B9${params.threshold || 0}`;
      case 'price_cross_below': return `< \u20B9${params.threshold || 0}`;
      case 'price_change_pct': return `\u2265 ${params.threshold || 2}%`;
      case 'volume_spike': return `> ${params.multiplier || 2}x ${t('smartAlerts.fmtAvg')}`;
      case 'volume_drop': return `< ${params.multiplier || 0.5}x ${t('smartAlerts.fmtAvg')}`;
      case 'rsi_oversold': return `< ${params.threshold || 30}`;
      case 'rsi_overbought': return `> ${params.threshold || 70}`;
      case 'rsi_cross_above': return `> ${params.threshold || 50}`;
      case 'rsi_cross_below': return `< ${params.threshold || 50}`;
      case 'ma_crossover': return `MA${params.fastPeriod || 10} > MA${params.slowPeriod || 30}`;
      case 'ma_crossunder': return `MA${params.fastPeriod || 10} < MA${params.slowPeriod || 30}`;
      case 'candle_pattern': {
        const pattern = CANDLE_PATTERNS.find(p => p.name === params.pattern);
        return pattern?.label || params.pattern || 'doji';
      }
      case 'consecutive_gain': return `${params.threshold || 3}+ ${t('smartAlerts.fmtDays')}`;
      case 'consecutive_loss': return `${params.threshold || 3}+ ${t('smartAlerts.fmtDays')}`;
      case 'breakout_high': return `${params.period || 20}-${t('smartAlerts.fmtBarHigh')}`;
      case 'breakout_low': return `${params.period || 20}-${t('smartAlerts.fmtBarLow')}`;
      case 'gap_up': return `\u2265 ${params.threshold || 1}%`;
      case 'gap_down': return `\u2265 ${params.threshold || 1}%`;
      default: return kind;
    }
  }, [t]);

  // ── Helper: describe condition for picker ────────────────────────────
  const describeConditionParams = useCallback((info: ConditionKindInfo): string => {
    switch (info.kind) {
      case 'price_cross_above': return t('smartAlerts.descPriceAbove');
      case 'price_cross_below': return t('smartAlerts.descPriceBelow');
      case 'price_change_pct': return t('smartAlerts.descPriceChangePct');
      case 'volume_spike': return t('smartAlerts.descVolumeSpike');
      case 'volume_drop': return t('smartAlerts.descVolumeDrop');
      case 'rsi_oversold': return t('smartAlerts.descRsiOversold');
      case 'rsi_overbought': return t('smartAlerts.descRsiOverbought');
      case 'rsi_cross_above': return t('smartAlerts.descRsiCrossAbove');
      case 'rsi_cross_below': return t('smartAlerts.descRsiCrossBelow');
      case 'ma_crossover': return t('smartAlerts.descMaCrossover');
      case 'ma_crossunder': return t('smartAlerts.descMaCrossunder');
      case 'candle_pattern': return t('smartAlerts.descCandlePattern');
      case 'consecutive_gain': return t('smartAlerts.descConsecutiveGain');
      case 'consecutive_loss': return t('smartAlerts.descConsecutiveLoss');
      case 'breakout_high': return t('smartAlerts.descBreakoutHigh');
      case 'breakout_low': return t('smartAlerts.descBreakoutLow');
      case 'gap_up': return t('smartAlerts.descGapUp');
      case 'gap_down': return t('smartAlerts.descGapDown');
      default: return '';
    }
  }, [t]);

  const { alerts, triggerHistory, alertBadgeCount, addAlert, updateAlert, removeAlert, toggleAlert, clearHistory, clearBadge } = useSmartAlertStore();

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSymbol, setFormSymbol] = useState('');
  const [formStockName, setFormStockName] = useState('');
  const [formLogic, setFormLogic] = useState<ConditionLogic>('AND');
  const [formCooldown, setFormCooldown] = useState(30);
  const [formConditions, setFormConditions] = useState<SmartAlertCondition[]>([]);
  const [formBadge, setFormBadge] = useState(true);
  const [formNotifType, setFormNotifType] = useState<'local' | 'push'>('local');
  const [selectedCategory, setSelectedCategory] = useState<string>('price');

  // Edit existing alert
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);

  // Validation
  const [formError, setFormError] = useState('');

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Separate enabled/disabled alerts
  const enabledAlerts = useMemo(() => alerts.filter(a => a.enabled), [alerts]);
  const disabledAlerts = useMemo(() => alerts.filter(a => !a.enabled), [alerts]);

  const getConditionKindInfo = useCallback((kind: SmartAlertConditionKind): ConditionKindInfo | undefined => {
    return CONDITION_KINDS.find(c => c.kind === kind);
  }, []);

  // ── Open creation wizard ──────────────────────────────────────────────

  const openCreateAlert = useCallback((template?: SmartAlertTemplate) => {
    setEditingAlertId(null);
    if (template) {
      setFormName(template.name);
      setFormSymbol(template.symbol);
      setFormStockName(template.stockName);
      setFormLogic(template.logic);
      setFormCooldown(template.cooldownMinutes);
      setFormConditions(template.conditions.map(c => ({ ...c, id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}` })));
      setFormBadge(true);
      setFormNotifType('local');
    } else {
      setFormName('');
      setFormSymbol('RELIANCE');
      setFormStockName('Reliance Industries');
      setFormLogic('AND');
      setFormCooldown(30);
      setFormConditions([]);
      setFormBadge(true);
      setFormNotifType('local');
    }
    setFormError('');
    setShowCreateModal(true);
  }, []);

  const openEditAlert = useCallback((alert: SmartAlert) => {
    setEditingAlertId(alert.id);
    setFormName(alert.name);
    setFormSymbol(alert.symbol);
    setFormStockName(alert.stockName);
    setFormLogic(alert.logic);
    setFormCooldown(alert.cooldownMinutes);
    setFormConditions(alert.conditions.map(c => ({ ...c })));
    setFormBadge(alert.badge);
    setFormNotifType(alert.notificationType);
    setFormError('');
    setShowCreateModal(true);
  }, []);

  // ── Add/Edit condition ────────────────────────────────────────────────

  const openAddCondition = useCallback((kind: SmartAlertConditionKind) => {
    const info = CONDITION_KINDS.find(c => c.kind === kind);
    if (!info) return;

    setShowConditionModal(false);

    const newCondition: SmartAlertCondition = {
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind,
      params: { ...info.defaultParams },
    };
    setFormConditions(prev => [...prev, newCondition]);
  }, []);

  const updateConditionParam = useCallback((index: number, key: string, value: number | string) => {
    setFormConditions(prev =>
      prev.map((c, i) =>
        i === index ? { ...c, params: { ...c.params, [key]: value } } : c
      )
    );
  }, []);

  const updateConditionKind = useCallback((index: number, kind: SmartAlertConditionKind) => {
    const info = CONDITION_KINDS.find(c => c.kind === kind);
    if (!info) return;
    setFormConditions(prev =>
      prev.map((c, i) =>
        i === index ? { ...c, kind, params: { ...info.defaultParams } } : c
      )
    );
  }, []);

  const removeCondition = useCallback((index: number) => {
    setFormConditions(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (!formName.trim()) { setFormError(t('smartAlerts.errorNameRequired')); return; }
    if (!formSymbol.trim()) { setFormError(t('smartAlerts.errorSymbolRequired')); return; }
    if (formConditions.length === 0) { setFormError(t('smartAlerts.errorConditionsRequired')); return; }
    if (!formStockName.trim()) setFormStockName(formSymbol.toUpperCase());

    setFormError('');

    if (editingAlertId) {
      updateAlert(editingAlertId, {
        name: formName.trim(),
        symbol: formSymbol.toUpperCase(),
        stockName: formStockName.trim() || formSymbol.toUpperCase(),
        conditions: formConditions,
        logic: formLogic,
        cooldownMinutes: formCooldown,
        badge: formBadge,
        notificationType: formNotifType,
      });
    } else {
      addAlert({
        name: formName.trim(),
        symbol: formSymbol.toUpperCase(),
        stockName: formStockName.trim() || formSymbol.toUpperCase(),
        conditions: formConditions,
        logic: formLogic,
        cooldownMinutes: formCooldown,
        enabled: true,
        badge: formBadge,
        notificationType: formNotifType,
      });
    }

    setShowCreateModal(false);
    setEditingAlertId(null);
  }, [formName, formSymbol, formStockName, formConditions, formLogic, formCooldown, formBadge, formNotifType, editingAlertId, addAlert, updateAlert, t]);

  // ── Delete with confirmation ──────────────────────────────────────────

  const handleDelete = useCallback((alert: SmartAlert) => {
    Alert.alert(
      t('smartAlerts.deleteTitle'),
      t('smartAlerts.deleteConfirm', { name: alert.name, symbol: alert.symbol }),
      [
        { text: t('app.cancel'), style: 'cancel' },
        { text: t('app.delete'), style: 'destructive', onPress: () => removeAlert(alert.id) },
      ],
    );
  }, [removeAlert, t]);

  // ── Bind badge to tab bar ────────────────────────────────────────────

  useEffect(() => {
    if (alertBadgeCount > 0) {
      // Visually clear badge when screen is opened
      const timer = setTimeout(() => clearBadge(), 2000);
      return () => clearTimeout(timer);
    }
  }, [alertBadgeCount, clearBadge]);

  // ── Render alert card ─────────────────────────────────────────────────

  const renderAlertCard = useCallback((alert: SmartAlert) => {
    const conditionInfos = alert.conditions.map(c => getConditionKindInfo(c.kind));
    const isTriggered = alert.triggered;

    return (
      <Pressable
        key={alert.id}
        style={({ pressed }) => [
          styles.alertCard,
          !alert.enabled && styles.alertCardDisabled,
          pressed && { opacity: 0.85 },
        ]}
        onLongPress={() => handleDelete(alert)}
        onPress={() => openEditAlert(alert)}
      >
        <View style={styles.alertCardHeader}>
          <View style={styles.alertTitleRow}>
            <View style={[styles.statusDot, { backgroundColor: alert.enabled ? (isTriggered ? colors.marketDown : colors.marketUp) : colors.textMuted }]} />
            <Text style={styles.alertName} numberOfLines={1}>{alert.name}</Text>
          </View>
          <Switch
            value={alert.enabled}
            onValueChange={() => toggleAlert(alert.id)}
            trackColor={{ false: colors.border, true: colors.primary + '60' }}
            thumbColor={alert.enabled ? colors.primary : colors.textMuted}
          />
        </View>

        <View style={styles.alertSymbolRow}>
          <Text style={styles.alertSymbol}>{alert.symbol}</Text>
          <View style={styles.logicBadge}>
            <Text style={styles.logicBadgeText}>{alert.logic}</Text>
          </View>
          <Text style={styles.conditionCount}>
            {t('smartAlerts.condition', { count: alert.conditions.length })}
          </Text>
          <Text style={styles.cooldownText}>
            {alert.cooldownMinutes < 60 ? t('smartAlerts.cooldownMinShort', { count: alert.cooldownMinutes }) : t('smartAlerts.cooldownHourShort', { count: Math.round(alert.cooldownMinutes / 60) })}
          </Text>
        </View>

        {/* Condition chips */}
        <View style={styles.conditionChips}>
          {alert.conditions.map((c, i) => {
            const info = conditionInfos[i];
            return (
              <View key={c.id} style={[styles.chip, { backgroundColor: (info?.color || colors.primary) + '20' }]}>
                <Text style={[styles.chipIcon]}>{info?.icon || '?'}</Text>
                <Text style={[styles.chipText, { color: info?.color || colors.primary }]}>
                  {formatConditionShort(c, info)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Triggered state */}
        {isTriggered && alert.lastTriggeredAt && (
          <View style={styles.triggeredRow}>
            <Ionicons name="checkmark-circle" size={14} color={colors.marketDown} />
            <Text style={styles.triggeredText}>
              {t('smartAlerts.triggered', { time: formatTimeAgo(alert.lastTriggeredAt, t) })}
            </Text>
          </View>
        )}
      </Pressable>
    );
  }, [colors, getConditionKindInfo, toggleAlert, openEditAlert, handleDelete, formatConditionShort]);

  // ── Render condition item in form ─────────────────────────────────────

  const renderFormCondition = useCallback((condition: SmartAlertCondition, index: number) => {
    const info = getConditionKindInfo(condition.kind);
    if (!info) return null;

    return (
      <View key={condition.id} style={styles.formConditionCard}>
        <View style={styles.formConditionHeader}>
          <View style={[styles.formConditionIcon, { backgroundColor: (info.color || colors.primary) + '20' }]}>
            <Text style={{ fontSize: 16 }}>{info.icon}</Text>
          </View>
          <View style={styles.formConditionInfo}>
            <Text style={styles.formConditionLabel}>{info.label}</Text>
            <Text style={styles.formConditionDetail}>{formatConditionShort(condition, info)}</Text>
          </View>
          <View style={styles.formConditionActions}>
            <Pressable onPress={() => removeCondition(index)} style={styles.formConditionBtn}>
              <Ionicons name="close-circle" size={20} color={colors.danger} />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }, [colors, getConditionKindInfo, removeCondition, formatConditionShort]);

  // ── Test alert ───────────────────────────────────────────────────────

  const handleTestAlert = useCallback((alert: SmartAlert) => {
    const mockData = generateMockHistory(60, 1500, 0.025);
    const result = evaluateSmartAlert(alert, mockData);
    const summary = summarizeEvalResult(result);
    const status = result.passed ? t('smartAlerts.testWouldFire') : t('smartAlerts.testNoTrigger');
    Alert.alert(
      t('smartAlerts.testTitle', { name: alert.name }),
      `${t('smartAlerts.symbol')}: ${alert.symbol}\n${t('smartAlerts.conditionLogic')}: ${alert.logic}\n\n${status}\n\n${summary}`,
      [{ text: t('app.ok') }],
    );
  }, [t]);

  // ── UI ─────────────────────────────────────────────────────────────────

  if (showHistoryModal) {
    return (
      <Modal visible={showHistoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingTop: insets.top + SPACING.md }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowHistoryModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
              <Text style={styles.modalTitle}>{t('smartAlerts.alertHistory')}</Text>
              <Pressable onPress={clearHistory}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>

            <FlatList
              data={triggerHistory}
              keyExtractor={(item, i) => `${item.alertId}_${i}`}
              contentContainerStyle={styles.historyList}
              renderItem={({ item }) => (
                <View style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyName} numberOfLines={1}>{item.alertName}</Text>
                    <Text style={styles.historySymbol}>{item.symbol}</Text>
                  </View>
                  <Text style={styles.historyPrice}>₹{item.price.toFixed(2)}</Text>
                  <Text style={styles.historySummary}>{item.summary}</Text>
                  <Text style={styles.historyTime}>{formatTimeAgo(item.timestamp, t)}</Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="time-outline" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>{t('smartAlerts.noHistory')}</Text>
                  <Text style={styles.emptySub}>{t('smartAlerts.noHistorySub')}</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient colors={[colors.bgSecondary, colors.bg]} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{t('smartAlerts.title')}</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setShowTemplatesModal(true)} style={styles.headerBtn}>
              <Ionicons name="copy-outline" size={22} color={colors.primary} />
            </Pressable>
            <Pressable onPress={() => setShowHistoryModal(true)} style={styles.headerBtn}>
              <View style={styles.historyBtnWrap}>
                <Ionicons name="time-outline" size={22} color={colors.primary} />
                {triggerHistory.length > 0 && (
                  <View style={styles.historyBadge}>
                    <Text style={styles.historyBadgeText}>{Math.min(triggerHistory.length, 9)}</Text>
                  </View>
                )}
              </View>
            </Pressable>
            <Pressable onPress={() => openCreateAlert()} style={styles.addBtn}>
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
        <Text style={styles.headerSub}>
          {t('smartAlerts.activeAlerts', { count: enabledAlerts.length })} · {t('smartAlerts.pausedAlerts', { count: disabledAlerts.length })}{alertBadgeCount > 0 && ` · ${t('smartAlerts.newTriggers', { count: alertBadgeCount })}`}
        </Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Active Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('smartAlerts.sectionActive')}</Text>
          {enabledAlerts.length > 0 ? (
            enabledAlerts.map(renderAlertCard)
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyCardTitle}>{t('smartAlerts.noAlerts')}</Text>
              <Text style={styles.emptyCardSub}>{t('smartAlerts.noAlertsSub')}</Text>
            </View>
          )}
        </View>

        {/* Paused Alerts */}
        {disabledAlerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('smartAlerts.sectionPaused', { count: disabledAlerts.length })}</Text>
            {disabledAlerts.map(renderAlertCard)}
          </View>
        )}

        {/* Quick-Add Condition Kinds */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('smartAlerts.quickCreate')}</Text>
          <Text style={styles.sectionSub}>{t('smartAlerts.quickCreateSub')}</Text>

          <View style={styles.quickAddGrid}>
            {CONDITION_KINDS.map((info) => {
              const exists = formConditions.some(c => c.kind === info.kind);
              return (
                <Pressable
                  key={info.kind}
                  style={({ pressed }) => [
                    styles.quickAddCard,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => {
                    // Create an alert with just this condition
                    const cond: SmartAlertCondition = {
                      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                      kind: info.kind,
                      params: { ...info.defaultParams },
                    };
                    addAlert({
                      name: `${info.label} — ${info.defaultParams.threshold || info.defaultParams.multiplier || info.defaultParams.period || ''}`,
                      symbol: 'RELIANCE',
                      stockName: 'Reliance Industries',
                      conditions: [cond],
                      logic: 'AND',
                      cooldownMinutes: 30,
                      enabled: true,
                      badge: true,
                      notificationType: 'local',
                    });
                  }}
                >
                  <View style={[styles.quickAddIcon, { backgroundColor: (info.color || colors.primary) + '20' }]}>
                    <Text style={{ fontSize: 18 }}>{info.icon}</Text>
                  </View>
                  <Text style={styles.quickAddLabel} numberOfLines={2}>{info.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color="#6C63FF" />
            <Text style={styles.infoText}>
              {t('smartAlerts.infoText')}
            </Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Ionicons name="flask-outline" size={20} color="#FFC107" />
            <Text style={styles.infoText}>
              {t('smartAlerts.infoLongPress')}
            </Text>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Create/Edit Modal ─────────────────────────────────────── */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingTop: insets.top + SPACING.md }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
              <Text style={styles.modalTitle}>{editingAlertId ? t('smartAlerts.editAlert') : t('smartAlerts.newAlert')}</Text>
              <Pressable onPress={handleSave}>
                <Text style={styles.saveBtn}>{t('smartAlerts.save')}</Text>
              </Pressable>
            </View>

            {formError ? (
              <View style={styles.errorBar}>
                <Ionicons name="alert-circle" size={16} color="#FF1744" />
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
              {/* Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('smartAlerts.alertName')}</Text>
                <TextInput
                  style={[styles.formInput, { color: colors.text, borderColor: colors.border }]}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder={t('smartAlerts.alertNamePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              {/* Symbol & Stock Name */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('smartAlerts.symbol')}</Text>
                  <TextInput
                    style={[styles.formInput, { color: colors.text, borderColor: colors.border }]}
                    value={formSymbol}
                    onChangeText={setFormSymbol}
                    placeholder="RELIANCE"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 2, marginLeft: SPACING.sm }]}>
                  <Text style={styles.formLabel}>{t('smartAlerts.stockName')}</Text>
                  <TextInput
                    style={[styles.formInput, { color: colors.text, borderColor: colors.border }]}
                    value={formStockName}
                    onChangeText={setFormStockName}
                    placeholder="Reliance Industries"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Logic & Cooldown */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('smartAlerts.conditionLogic')}</Text>
                  <View style={styles.logicToggle}>
                    <Pressable
                      style={[styles.logicBtn, formLogic === 'AND' && styles.logicBtnActive]}
                      onPress={() => setFormLogic('AND')}
                    >
                      <Text style={[styles.logicBtnText, formLogic === 'AND' && styles.logicBtnTextActive]}>AND</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.logicBtn, formLogic === 'OR' && styles.logicBtnActive]}
                      onPress={() => setFormLogic('OR')}
                    >
                      <Text style={[styles.logicBtnText, formLogic === 'OR' && styles.logicBtnTextActive]}>OR</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: SPACING.sm }]}>
                  <Text style={styles.formLabel}>{t('smartAlerts.cooldownMin')}</Text>
                  <View style={styles.cooldownRow}>
                    <Pressable
                      onPress={() => setFormCooldown(p => Math.max(5, p - 5))}
                      style={styles.cooldownBtn}
                    >
                      <Ionicons name="remove" size={16} color={colors.primary} />
                    </Pressable>
                    <Text style={styles.cooldownValue}>{formCooldown}</Text>
                    <Pressable
                      onPress={() => setFormCooldown(p => Math.min(1440, p + 5))}
                      style={styles.cooldownBtn}
                    >
                      <Ionicons name="add" size={16} color={colors.primary} />
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Badge toggle */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <View style={styles.switchRow}>
                    <Text style={styles.formLabel}>{t('smartAlerts.badgeCount')}</Text>
                    <Switch
                      value={formBadge}
                      onValueChange={setFormBadge}
                      trackColor={{ false: colors.border, true: colors.primary + '60' }}
                      thumbColor={formBadge ? colors.primary : colors.textMuted}
                    />
                  </View>
                </View>
              </View>

              {/* ── Conditions Section ───────────────────────── */}
              <View style={styles.formGroup}>
                <View style={styles.conditionsHeader}>
                  <Text style={styles.formLabel}>{t('smartAlerts.conditions', { count: formConditions.length })}</Text>
                  <Pressable onPress={() => setShowConditionModal(true)} style={styles.addConditionBtn}>
                    <Ionicons name="add-circle" size={20} color={colors.primary} />
                    <Text style={styles.addConditionText}>{t('smartAlerts.addCondition')}</Text>
                  </Pressable>
                </View>

                {formConditions.length === 0 ? (
                  <View style={styles.noConditions}>
                    <Text style={styles.noConditionsText}>
                      {t('smartAlerts.noConditions')}
                    </Text>
                  </View>
                ) : (
                  formConditions.map((c, i) => renderFormCondition(c, i))
                )}
              </View>

              {/* Test button */}
              <Pressable
                style={styles.testBtn}
                onPress={() => {
                  if (formConditions.length === 0) return;
                  const mockAlert: SmartAlert = {
                    id: 'test',
                    name: formName || 'Test',
                    symbol: formSymbol || 'RELIANCE',
                    stockName: formStockName || 'Reliance',
                    conditions: formConditions,
                    logic: formLogic,
                    cooldownMinutes: formCooldown,
                    enabled: true,
                    triggered: false,
                    lastTriggeredAt: null,
                    createdAt: new Date().toISOString(),
                    notificationType: 'local',
                    badge: true,
                  };
                  handleTestAlert(mockAlert);
                }}
              >
                <Ionicons name="flask-outline" size={18} color={colors.primary} />
                <Text style={styles.testBtnText}>{t('smartAlerts.testAlert')}</Text>
              </Pressable>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Condition Picker Modal ─────────────────────────────── */}
      <Modal visible={showConditionModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingTop: insets.top + SPACING.md }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowConditionModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
              <Text style={styles.modalTitle}>{t('smartAlerts.addConditionTitle')}</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Category tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryTabs}>
              {CONDITION_CATEGORIES.map(cat => (
                <Pressable
                  key={cat.key}
                  style={[styles.categoryTab, selectedCategory === cat.key && styles.categoryTabActive]}
                  onPress={() => setSelectedCategory(cat.key)}
                >
                  <Text style={[styles.categoryTabText, selectedCategory === cat.key && styles.categoryTabTextActive]}>
                    {cat.icon} {t(`smartAlerts.cat${cat.key}`)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView contentContainerStyle={styles.conditionPickerList}>
              {CONDITION_KINDS
                .filter(c => c.category === selectedCategory)
                .map(info => {
                  const alreadyAdded = formConditions.some(c => c.kind === info.kind);
                  return (
                    <Pressable
                      key={info.kind}
                      style={({ pressed }) => [
                        styles.conditionPickerItem,
                        pressed && { opacity: 0.7 },
                        alreadyAdded && styles.conditionPickerItemAdded,
                      ]}
                      onPress={() => openAddCondition(info.kind)}
                    >
                      <View style={[styles.conditionPickerIcon, { backgroundColor: (info.color || colors.primary) + '20' }]}>
                        <Text style={{ fontSize: 22 }}>{info.icon}</Text>
                      </View>
                      <View style={styles.conditionPickerInfo}>
                        <Text style={styles.conditionPickerLabel}>{info.label}</Text>
                        <Text style={styles.conditionPickerDesc}>
                          {describeConditionParams(info)}
                        </Text>
                      </View>
                      {alreadyAdded && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.marketUp} />
                      )}
                    </Pressable>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Templates Modal ────────────────────────────────────── */}
      <Modal visible={showTemplatesModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingTop: insets.top + SPACING.md }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowTemplatesModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
              <Text style={styles.modalTitle}>{t('smartAlerts.alertTemplates')}</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.templateList}>
              {SMART_ALERT_TEMPLATES.map((template, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.templateCard,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => {
                    setShowTemplatesModal(false);
                    openCreateAlert(template);
                  }}
                >
                  <View style={styles.templateIconWrap}>
                    <Text style={{ fontSize: 28 }}>{template.icon}</Text>
                  </View>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateSymbol}>{template.symbol}</Text>
                    <Text style={styles.templateDesc} numberOfLines={2}>{template.description}</Text>
                    <View style={styles.templateMeta}>
                      <Text style={styles.templateMetaText}>
                        {t('smartAlerts.condition', { count: template.conditions.length })} · {template.logic}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="add-circle" size={24} color={colors.primary} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeAgo(isoString: string, t: (key: string, params?: any) => string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('smartAlerts.justNow');
  if (diffMin < 60) return t('smartAlerts.minAgo', { count: diffMin });
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return t('smartAlerts.hourAgo', { count: diffHrs });
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return t('smartAlerts.dayAgo', { count: diffDays });
  return new Date(isoString).toLocaleDateString();
}

// ============================================================================
// Styles
// ============================================================================

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.xl,
      color: colors.text,
    },
    headerSub: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 4,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bgInput,
      justifyContent: 'center',
      alignItems: 'center',
    },
    historyBtnWrap: {
      position: 'relative',
    },
    historyBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: '#FF3B30',
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 3,
    },
    historyBadgeText: {
      color: '#fff',
      fontSize: 9,
      fontWeight: '700',
    },
    addBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      padding: SPACING.md,
    },
    section: {
      marginBottom: SPACING.lg,
    },
    sectionTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    sectionSub: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginBottom: SPACING.sm,
    },

    // Alert Card
    alertCard: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
    },
    alertCardDisabled: {
      opacity: 0.6,
    },
    alertCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    alertTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: SPACING.sm,
    },
    alertName: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
      flex: 1,
    },
    alertSymbolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.xs,
      gap: 8,
    },
    alertSymbol: {
      ...FONTS.mono,
      fontSize: FONTS.size.xs,
      color: colors.primary,
      fontWeight: '700',
    },
    logicBadge: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    logicBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary,
    },
    conditionCount: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    cooldownText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    conditionChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: SPACING.sm,
      gap: 6,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    chipIcon: {
      fontSize: 12,
    },
    chipText: {
      fontSize: 11,
      fontWeight: '600',
    },
    triggeredRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.sm,
      gap: 4,
    },
    triggeredText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },

    // Empty State
    emptyCard: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.xl,
      alignItems: 'center',
    },
    emptyCardTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
      marginTop: SPACING.sm,
    },
    emptyCardSub: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
    },

    // Quick-Add Grid
    quickAddGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    quickAddCard: {
      width: (SCREEN_WIDTH - SPACING.md * 2 - 8) / 3 - 4,
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.sm,
      alignItems: 'center',
      marginBottom: 0,
    },
    quickAddIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    quickAddLabel: {
      ...FONTS.regular,
      fontSize: 10,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 14,
    },

    // Info
    infoCard: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    infoDivider: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: SPACING.sm,
    },
    infoText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      flex: 1,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.bg,
      borderTopLeftRadius: BORDER_RADIUS.xl,
      borderTopRightRadius: BORDER_RADIUS.xl,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      color: colors.text,
    },
    saveBtn: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.primary,
    },

    // Form
    formContent: {
      padding: SPACING.lg,
    },
    formGroup: {
      marginBottom: SPACING.md,
    },
    formLabel: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.text,
      marginBottom: 6,
    },
    formInput: {
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      ...FONTS.regular,
      fontSize: FONTS.size.md,
    },
    formRow: {
      flexDirection: 'row',
    },
    errorBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      backgroundColor: '#FF174410',
    },
    errorText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: '#FF1744',
      flex: 1,
    },
    logicToggle: {
      flexDirection: 'row',
      borderRadius: BORDER_RADIUS.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    logicBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      backgroundColor: colors.bgInput,
    },
    logicBtnActive: {
      backgroundColor: colors.primary,
    },
    logicBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.primary,
    },
    logicBtnTextActive: {
      color: '#fff',
    },
    cooldownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cooldownBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bgInput,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cooldownValue: {
      ...FONTS.mono,
      fontSize: FONTS.size.lg,
      fontWeight: '700',
      color: colors.text,
      minWidth: 40,
      textAlign: 'center',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    // Conditions in form
    conditionsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    addConditionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    addConditionText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.primary,
    },
    noConditions: {
      padding: SPACING.md,
      backgroundColor: colors.bgInput,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    noConditionsText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      textAlign: 'center',
    },
    formConditionCard: {
      backgroundColor: colors.bgInput,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.sm,
      marginBottom: 6,
    },
    formConditionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    formConditionIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.sm,
    },
    formConditionInfo: {
      flex: 1,
    },
    formConditionLabel: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.text,
    },
    formConditionDetail: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    formConditionActions: {
      flexDirection: 'row',
      gap: 4,
    },
    formConditionBtn: {
      padding: 4,
    },

    // Test button
    testBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.primary,
      marginTop: SPACING.md,
    },
    testBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.primary,
    },

    // Condition Picker
    categoryTabs: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      maxHeight: 50,
    },
    categoryTab: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.bgInput,
      marginRight: 8,
    },
    categoryTabActive: {
      backgroundColor: colors.primary,
    },
    categoryTabText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.text,
    },
    categoryTabTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    conditionPickerList: {
      padding: SPACING.lg,
    },
    conditionPickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    conditionPickerItemAdded: {
      borderColor: colors.marketUp,
      borderStyle: 'dashed',
    },
    conditionPickerIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    conditionPickerInfo: {
      flex: 1,
    },
    conditionPickerLabel: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    conditionPickerDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 2,
    },

    // Templates
    templateList: {
      padding: SPACING.lg,
    },
    templateCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    templateIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.bgInput,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    templateInfo: {
      flex: 1,
      marginRight: SPACING.sm,
    },
    templateName: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    templateSymbol: {
      ...FONTS.mono,
      fontSize: FONTS.size.xs,
      color: colors.primary,
      fontWeight: '600',
    },
    templateDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
    templateMeta: {
      flexDirection: 'row',
      marginTop: 4,
    },
    templateMetaText: {
      ...FONTS.regular,
      fontSize: 10,
      color: colors.textMuted,
    },

    // History Modal
    historyList: {
      padding: SPACING.lg,
    },
    historyCard: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      marginBottom: 8,
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    historyName: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.text,
      flex: 1,
    },
    historySymbol: {
      ...FONTS.mono,
      fontSize: FONTS.size.xs,
      color: colors.primary,
      fontWeight: '600',
    },
    historyPrice: {
      ...FONTS.mono,
      fontSize: FONTS.size.lg,
      fontWeight: '700',
      color: colors.text,
      marginTop: 4,
    },
    historySummary: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 4,
    },
    historyTime: {
      ...FONTS.regular,
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 4,
    },

    // Empty state
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
      marginTop: SPACING.md,
    },
    emptySub: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
    },
  });
}
