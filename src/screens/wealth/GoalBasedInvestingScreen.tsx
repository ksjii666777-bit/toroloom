/**
 * ============================================================================
 * Toroloom — Goal Based Investing Screen
 * ============================================================================
 *
 * Create and track financial goals with SIP calculator integration.
 * Features:
 *   - Goal creation form with category selection
 *   - Progress tracking with visual bar
 *   - SIP required calculator
 *   - Contribution tracking
 *   - Goal detail view
 *
 * Navigation: Wealth Dashboard → GoalCreate / GoalDetail
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,    Platform, Alert,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { useWealthStore, type GoalCategory } from '../../store/wealthStore';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import AppScreen from '../../components/ui/AppScreen';


// ─── Category Data ─────────────────────────────────────────────────────

interface CategoryInfo {
  key: GoalCategory;
  labelKey: string;
  icon: string;
  color: string;
  suggestions: { label: string; amount: number }[];
}

const CATEGORIES: CategoryInfo[] = [
  { key: 'emergency', labelKey: 'wealth.catEmergency', icon: '🛡️', color: '#00C853', suggestions: [{ label: '3 Months', amount: 150000 }, { label: '6 Months', amount: 300000 }, { label: '12 Months', amount: 600000 }] },
  { key: 'retirement', labelKey: 'wealth.catRetirement', icon: '🏖️', color: '#6C63FF', suggestions: [{ label: '₹1 Cr', amount: 10000000 }, { label: '₹3 Cr', amount: 30000000 }, { label: '₹5 Cr', amount: 50000000 }] },
  { key: 'education', labelKey: 'wealth.catEducation', icon: '🎓', color: '#3B82F6', suggestions: [{ label: '₹10L', amount: 1000000 }, { label: '₹25L', amount: 2500000 }, { label: '₹50L', amount: 5000000 }] },
  { key: 'house', labelKey: 'wealth.catHouse', icon: '🏠', color: '#F59E0B', suggestions: [{ label: '₹20L Down', amount: 2000000 }, { label: '₹50L Down', amount: 5000000 }, { label: '₹1Cr Down', amount: 10000000 }] },
  { key: 'travel', labelKey: 'wealth.catTravel', icon: '✈️', color: '#06B6D4', suggestions: [{ label: '₹2L Trip', amount: 200000 }, { label: '₹5L Trip', amount: 500000 }, { label: '₹10L Trip', amount: 1000000 }] },
  { key: 'wedding', labelKey: 'wealth.catWedding', icon: '💒', color: '#EC4899', suggestions: [{ label: '₹10L', amount: 1000000 }, { label: '₹25L', amount: 2500000 }, { label: '₹50L', amount: 5000000 }] },
  { key: 'vehicle', labelKey: 'wealth.catVehicle', icon: '🚗', color: '#FF6B00', suggestions: [{ label: '₹5L Car', amount: 500000 }, { label: '₹10L Car', amount: 1000000 }, { label: '₹20L Car', amount: 2000000 }] },
  { key: 'custom', labelKey: 'wealth.catCustom', icon: '🎯', color: '#8B5CF6', suggestions: [{ label: '₹1L', amount: 100000 }, { label: '₹5L', amount: 500000 }, { label: '₹10L', amount: 1000000 }] },
];

const formatINR = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const formatCompactINR = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (n / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return '₹' + (n / 1e5).toFixed(2) + 'L';
  if (abs >= 1e3) return '₹' + (n / 1e3).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
};

// ═════════════════════════════════════════════════════════════════════════
// GOAL CREATE SCREEN
// ═════════════════════════════════════════════════════════════════════════

export function GoalCreateScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const addGoal = useWealthStore(s => s.addGoal);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<GoalCategory>('custom');
  const [targetAmount, setTargetAmount] = useState('500000');
  const [monthlyContribution, _setMonthlyContribution] = useState('10000');
  const [targetYears, setTargetYears] = useState('5');
  const [expectedReturn, setExpectedReturn] = useState('12');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');

  const catInfo = CATEGORIES.find(c => c.key === category) || CATEGORIES[7];
  const targetAmt = parseFloat(targetAmount) || 0;
  const monthly = parseFloat(monthlyContribution) || 0;
  const years = parseFloat(targetYears) || 0;
  const ret = parseFloat(expectedReturn) || 0;

  const estimatedSIP = useMemo(() => {
    if (targetAmt <= 0 || ret <= 0 || years <= 0) return 0;
    const months = years * 12;
    const monthlyRate = ret / 12 / 100;
    if (monthlyRate === 0) return targetAmt / months;
    const factor = Math.pow(1 + monthlyRate, months);
    return Math.ceil(targetAmt * monthlyRate / ((factor - 1) * (1 + monthlyRate)));
  }, [targetAmt, ret, years]);

  const handleCreate = useCallback(() => {
    if (!name.trim()) {
      Alert.alert(t('wealth.goalNameRequired'), t('wealth.goalNameRequiredMsg'));
      return;
    }
    if (targetAmt <= 0) {
      Alert.alert(t('wealth.invalidAmount'), t('wealth.invalidAmountMsg'));
      return;
    }
    if (years <= 0) {
      Alert.alert(t('wealth.invalidTimeframe'), t('wealth.invalidTimeframeMsg'));
      return;
    }

    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() + years);

    addGoal({
      name: name.trim(),
      category,
      icon: catInfo.icon,
      color: catInfo.color,
      targetAmount: targetAmt,
      currentAmount: 0,
      monthlyContribution: monthly,
      targetDate: targetDate.toISOString(),
      expectedReturn: ret,
      priority,
      notes,
    });

    Alert.alert(t('wealth.goalCreated'), t('wealth.goalCreatedMsg', { name }), [
      { text: t('app.ok'), onPress: () => navigation.goBack() },
    ]);
  }, [name, category, targetAmt, monthly, years, ret, priority, notes, catInfo, addGoal, navigation, t]);

  const inputStyle = (val: string) => ({
    backgroundColor: colors.bgInput,
    color: colors.text,
    borderColor: val ? colors.primary : colors.border,
  });

  return (
          <AppScreen scroll={false} padded={false}
      header={
  <View style={[styles.header, {backgroundColor: colors.bgSecondary }]}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('wealth.createGoal')}</Text>
          </View>
        </View>
      }
      >
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Goal Name */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('wealth.goalName')}</Text>
          <TextInput
            style={[styles.input, inputStyle(name)]}
            value={name}
            onChangeText={setName}
            placeholder={t('wealth.goalNamePlaceholder')}
            placeholderTextColor={colors.textMuted}
          />

          {/* Category */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.lg }]}>{t('wealth.category')}</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(cat => {
              const isActive = category === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => setCategory(cat.key)}
                  style={[styles.categoryChip, {
                    backgroundColor: isActive ? cat.color + '20' : colors.bgInput,
                    borderColor: isActive ? cat.color + '40' : colors.border,
                  }]}
                >
                  <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
                  <Text style={[styles.categoryLabel, { color: isActive ? cat.color : colors.textMuted }]}>{t(cat.labelKey)}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Target Amount */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.lg }]}>{t('wealth.targetAmount')}</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.bgInput, borderColor: targetAmount ? colors.primary : colors.border }]}>
            <Text style={[styles.inputPrefix, { color: colors.textMuted }]}>₹</Text>
            <TextInput
              style={[styles.inputFlex, { color: colors.text }]}
              value={targetAmount}
              onChangeText={setTargetAmount}
              keyboardType="numeric"
              placeholder="500000"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          {targetAmt > 0 && (
            <Text style={[styles.fieldHint, { color: colors.textMuted }]}>{formatINR(targetAmt)}</Text>
          )}
          <View style={styles.suggestionRow}>
            {catInfo.suggestions.map(s => (
              <Pressable
                key={s.label}
                style={[styles.suggestionChip, { backgroundColor: colors.bgInput, borderColor: targetAmount === String(s.amount) ? colors.primary : colors.border }]}
                onPress={() => setTargetAmount(String(s.amount))}
              >
                <Text style={[styles.suggestionText, { color: targetAmount === String(s.amount) ? colors.primary : colors.textMuted }]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Timeframe */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.lg }]}>{t('wealth.targetTimeframe')}</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.bgInput, borderColor: targetYears ? colors.primary : colors.border, width: 120 }]}>
            <TextInput
              style={[styles.inputFlex, { color: colors.text }]}
              value={targetYears}
              onChangeText={setTargetYears}
              keyboardType="numeric"
            />
            <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>{t('wealth.yrsSuffix')}</Text>
          </View>
          <View style={styles.suggestionRow}>
            {[1, 3, 5, 10, 15, 20].map(y => (
              <Pressable
                key={y}
                style={[styles.suggestionChip, { backgroundColor: colors.bgInput, borderColor: targetYears === String(y) ? colors.primary : colors.border }]}
                onPress={() => setTargetYears(String(y))}
              >
                <Text style={[styles.suggestionText, { color: targetYears === String(y) ? colors.primary : colors.textMuted }]}>{y}Y</Text>
              </Pressable>
            ))}
          </View>

          {/* Expected Return */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.lg }]}>{t('wealth.expectedReturn')}</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.bgInput, borderColor: expectedReturn ? colors.primary : colors.border, width: 100 }]}>
            <TextInput
              style={[styles.inputFlex, { color: colors.text }]}
              value={expectedReturn}
              onChangeText={setExpectedReturn}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>%</Text>
          </View>
          <View style={styles.suggestionRow}>
            {[8, 10, 12, 15].map(r => (
              <Pressable
                key={r}
                style={[styles.suggestionChip, { backgroundColor: colors.bgInput, borderColor: expectedReturn === String(r) ? colors.primary : colors.border }]}
                onPress={() => setExpectedReturn(String(r))}
              >
                <Text style={[styles.suggestionText, { color: expectedReturn === String(r) ? colors.primary : colors.textMuted }]}>{r}%</Text>
              </Pressable>
            ))}
          </View>

          {/* Priority */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.lg }]}>{t('wealth.priority')}</Text>
          <View style={styles.priorityRow}>
            {(['low', 'medium', 'high'] as const).map(p => (
              <Pressable
                key={p}
                onPress={() => setPriority(p)}
                style={[styles.priorityBtn, {
                  backgroundColor: priority === p ? (p === 'high' ? '#FF525220' : p === 'medium' ? '#FFC10720' : '#00C85320') : colors.bgInput,
                  borderColor: priority === p ? (p === 'high' ? '#FF525240' : p === 'medium' ? '#FFC10740' : '#00C85340') : colors.border,
                }]}
              >
                <Text style={[styles.priorityText, { color: priority === p ? (p === 'high' ? '#FF5252' : p === 'medium' ? '#FFC107' : '#00C853') : colors.textMuted }]}>
                  {p === 'low' ? t('wealth.priorityLow') : p === 'medium' ? t('wealth.priorityMedium') : t('wealth.priorityHigh')}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* SIP Estimate Card */}
          {targetAmt > 0 && years > 0 && ret > 0 && (
            <Animated.View entering={FadeInUp.duration(400)} style={[styles.sipEstimateCard, { backgroundColor: colors.bgCard, borderColor: colors.primary + '30' }]}>
              <Text style={[styles.sipEstimateTitle, { color: colors.text }]}>{t('wealth.monthlySipNeeded')}</Text>
              <Text style={[styles.sipEstimateAmount, { color: colors.primary }]}>
                {formatCompactINR(estimatedSIP)}
              </Text>
              <Text style={[styles.sipEstimateNote, { color: colors.textMuted }]}>
                {t('wealth.sipEstimateNote', {
                  amount: formatCompactINR(estimatedSIP),
                  return: ret,
                  years,
                  target: formatCompactINR(targetAmt),
                })}
              </Text>
            </Animated.View>
          )}

          {/* Notes */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.lg }]}>{t('wealth.notesOptional')}</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('wealth.goalNotesPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
          />

          {/* Create Button */}
          <AnimatedPressable onPress={handleCreate} haptic="medium" scaleTo={0.97} style={{ marginTop: SPACING.xl }}>
            <View style={[styles.createBtn, { backgroundColor: colors.primary }]}>
              <Ionicons name="flag" size={20} color="#fff" />
              <Text style={styles.createBtnText}>{t('wealth.createGoal')}</Text>
            </View>
          </AnimatedPressable>

          <View style={{ height: 60 }} />
        </ScrollView>
      </AppScreen>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// GOAL DETAIL SCREEN
// ═════════════════════════════════════════════════════════════════════════

export function GoalDetailScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const { goalId } = route.params || {};
  const { goals, deleteGoal, contributeToGoal, getGoalProgress } = useWealthStore();
  const goal = goals.find(g => g.id === goalId);

  const [addAmount, setAddAmount] = useState('');

  if (!goal) {
    return (
            <AppScreen scroll={false} padded={false}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
  <Ionicons name="sad-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: SPACING.md }]}>{t('wealth.goalNotFound')}</Text>
        </View>
      </AppScreen>
    );
  }

  const progress = getGoalProgress(goal);
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const sipRequired = useWealthStore.getState().getGoalSIPRequired(goal);
  const targetDate = new Date(goal.targetDate);
  const monthsLeft = Math.max(0, (targetDate.getFullYear() - new Date().getFullYear()) * 12 +
    (targetDate.getMonth() - new Date().getMonth()));

  const _inputStyle = { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border };

  return (
          <AppScreen scroll={false} padded={false}
      header={
  <View style={[styles.header, {backgroundColor: colors.bgSecondary }]}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('wealth.goalDetails')}</Text>
            <Pressable
              onPress={() => {
                Alert.alert(t('wealth.deleteGoal'), t('wealth.deleteGoalMsg', { name: goal.name }), [
                  { text: t('app.cancel'), style: 'cancel' },
                  { text: t('app.delete'), style: 'destructive', onPress: () => { deleteGoal(goal.id); navigation.goBack(); } },
                ]);
              }}
            >
              <Ionicons name="trash-outline" size={22} color="#FF5252" />
            </Pressable>
          </View>
        </View>
      }
      >
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Hero */}
          <View style={[styles.heroCard, { backgroundColor: goal.color + '15', borderColor: goal.color + '30' }]}>
            <Text style={{ fontSize: 48 }}>{goal.icon}</Text>
            <Text style={[styles.heroTitle, { color: colors.text }]}>{goal.name}</Text>
            <Text style={[styles.heroCategory, { color: goal.color }]}>
              {t(CATEGORIES.find(c => c.key === goal.category)?.labelKey || 'wealth.catCustom')}
            </Text>

            <View style={styles.heroProgressContainer}>
              <Text style={[styles.heroProgressText, { color: colors.text }]}>{t('wealth.percentComplete', { progress: progress.toFixed(1) })}</Text>
              <View style={[styles.progressBarBg, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, progress)}%`, backgroundColor: goal.color }]} />
              </View>
            </View>
          </View>

          {/* Amounts */}
          <View style={[styles.amountsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.amountsRow}>
              <View style={styles.amountsItem}>
                <Text style={[styles.amountsLabel, { color: colors.textMuted }]}>{t('wealth.targetLabel')}</Text>
                <Text style={[styles.amountsValue, { color: colors.text }]}>{formatCompactINR(goal.targetAmount)}</Text>
              </View>
              <View style={[styles.amountsDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.amountsItem}>
                <Text style={[styles.amountsLabel, { color: colors.textMuted }]}>{t('wealth.saved')}</Text>
                <Text style={[styles.amountsValue, { color: goal.color }]}>{formatCompactINR(goal.currentAmount)}</Text>
              </View>
              <View style={[styles.amountsDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.amountsItem}>
                <Text style={[styles.amountsLabel, { color: colors.textMuted }]}>{t('wealth.remaining')}</Text>
                <Text style={[styles.amountsValue, { color: '#FFC107' }]}>{formatCompactINR(remaining)}</Text>
              </View>
            </View>
          </View>

          {/* Stats */}
          <View style={[styles.statsGrid, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="calendar" size={16} color={colors.textMuted} />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('wealth.targetDate')}</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {targetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="time" size={16} color={colors.textMuted} />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('wealth.timeLeft')}</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{t('wealth.monthsLeft', { count: monthsLeft })}</Text>
              </View>
            </View>
            <View style={[styles.statsDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="trending-up" size={16} color={colors.textMuted} />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('wealth.monthlySip')}</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{formatCompactINR(goal.monthlyContribution)}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="pulse" size={16} color={colors.textMuted} />
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('wealth.requiredSip')}</Text>
                <Text style={[styles.statValue, { color: '#FFC107' }]}>{formatCompactINR(sipRequired)}</Text>
              </View>
            </View>
          </View>

          {/* Quick Contribute */}
          <View style={[styles.contributeCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.contributeTitle, { color: colors.text }]}>{t('wealth.quickContribute')}</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <Text style={[styles.inputPrefix, { color: colors.textMuted }]}>₹</Text>
              <TextInput
                style={[styles.inputFlex, { color: colors.text }]}
                value={addAmount}
                onChangeText={setAddAmount}
                keyboardType="numeric"
                placeholder={t('wealth.enterAmount')}
                placeholderTextColor={colors.textMuted}
              />
              <Pressable
                onPress={() => {
                  const amt = parseFloat(addAmount);
                  if (amt > 0) { contributeToGoal(goal.id, amt); setAddAmount(''); Alert.alert(t('wealth.addedTitle'), t('wealth.addedMsg', { amount: amt.toLocaleString('en-IN'), name: goal.name })); }
                  else Alert.alert(t('wealth.invalidAmount'), t('wealth.invalidAmountMsg2'));
                }}
                style={[styles.contributeBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.contributeBtnText}>{t('wealth.add')}</Text>
              </Pressable>
            </View>
            <View style={styles.quickAmtRow}>
              {[5000, 10000, 25000, 50000].map(amt => (
                <Pressable
                  key={amt}
                  style={[styles.quickAmtChip, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                  onPress={() => setAddAmount(String(amt))}
                >
                  <Text style={[styles.quickAmtText, { color: colors.textMuted }]}>{formatCompactINR(amt)}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Notes */}
          {goal.notes ? (
            <View style={[styles.notesCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.notesLabel, { color: colors.textMuted }]}>{t('wealth.notes')}</Text>
              <Text style={[styles.notesText, { color: colors.text }]}>{goal.notes}</Text>
            </View>
          ) : null}

          {/* Priority Badge */}
          <View style={[styles.priorityCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.priorityCardLabel, { color: colors.textMuted }]}>{t('wealth.priorityLabel')}</Text>
            <View style={[styles.priorityBadge, {
              backgroundColor: goal.priority === 'high' ? '#FF525220' : goal.priority === 'medium' ? '#FFC10720' : '#00C85320',
            }]}>
              <Text style={[styles.priorityBadgeText, {
                color: goal.priority === 'high' ? '#FF5252' : goal.priority === 'medium' ? '#FFC107' : '#00C853',
              }]}>
                {goal.priority === 'low' ? t('wealth.priorityLow') : goal.priority === 'medium' ? t('wealth.priorityMedium') : t('wealth.priorityHigh')}
              </Text>
            </View>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </AppScreen>
  );
}


// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerTitle: { ...FONTS.bold, fontSize: FONTS.size.xl, flex: 1, marginLeft: SPACING.md },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },

  // Form
  fieldLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, marginBottom: SPACING.sm },
  input: {
    height: 48, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    paddingHorizontal: SPACING.md, fontSize: FONTS.size.md,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, height: 48,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
  },
  inputPrefix: { ...FONTS.semiBold, fontSize: FONTS.size.lg, marginRight: 4 },
  inputSuffix: { ...FONTS.regular, fontSize: FONTS.size.sm, marginLeft: 4 },
  inputFlex: { flex: 1, ...FONTS.bold, fontSize: FONTS.size.lg, padding: 0 },
  fieldHint: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2, textAlign: 'right' },

  // Category Grid
  categoryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm,
  },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  categoryLabel: { ...FONTS.medium, fontSize: FONTS.size.xs },

  // Suggestions
  suggestionRow: {
    flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs, flexWrap: 'wrap',
  },
  suggestionChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  suggestionText: { ...FONTS.medium, fontSize: FONTS.size.xs },

  // Priority
  priorityRow: { flexDirection: 'row', gap: SPACING.sm },
  priorityBtn: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
  },
  priorityText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

  // SIP Estimate
  sipEstimateCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginTop: SPACING.lg, alignItems: 'center',
  },
  sipEstimateTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: SPACING.xs },
  sipEstimateAmount: { ...FONTS.bold, fontSize: FONTS.size.hero, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  sipEstimateNote: { ...FONTS.regular, fontSize: FONTS.size.xs, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 16 },

  // TextArea
  textArea: {
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    fontSize: FONTS.size.sm, minHeight: 80, textAlignVertical: 'top',
  },

  // Create Button
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  createBtnText: { ...FONTS.bold, fontSize: FONTS.size.md, color: '#fff' },

  // ── Goal Detail ──
  heroCard: {
    padding: SPACING.xl, borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1, alignItems: 'center', marginBottom: SPACING.md,
  },
  heroTitle: { ...FONTS.bold, fontSize: FONTS.size.xl, marginTop: SPACING.md },
  heroCategory: { ...FONTS.medium, fontSize: FONTS.size.sm, marginTop: 2 },
  heroProgressContainer: { width: '100%', marginTop: SPACING.lg },
  heroProgressText: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: SPACING.sm },
  progressBarBg: { height: 10, borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 5 },

  // Amounts
  amountsCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.md,
  },
  amountsRow: { flexDirection: 'row', alignItems: 'center' },
  amountsItem: { flex: 1, alignItems: 'center' },
  amountsLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  amountsValue: { ...FONTS.bold, fontSize: FONTS.size.lg, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  amountsDivider: { width: 1, height: 30 },

  // Stats
  statsGrid: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.md,
  },
  statsRow: { flexDirection: 'row' },
  statItem: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: SPACING.sm },
  statLabel: { ...FONTS.regular, fontSize: 9 },
  statValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  statsDivider: { height: 1, marginVertical: SPACING.sm },

  // Contribute
  contributeCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.md,
  },
  contributeTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: SPACING.md },
  contributeBtn: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  contributeBtnText: { ...FONTS.bold, fontSize: FONTS.size.sm, color: '#fff' },
  quickAmtRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  quickAmtChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  quickAmtText: { ...FONTS.medium, fontSize: FONTS.size.xs },

  // Notes
  notesCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.md,
  },
  notesLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  notesText: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: SPACING.xs, lineHeight: 18 },

  // Priority Card
  priorityCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.md,
  },
  priorityCardLabel: { ...FONTS.regular, fontSize: FONTS.size.sm },
  priorityBadge: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  priorityBadgeText: { ...FONTS.bold, fontSize: FONTS.size.xs },

  // Empty
  emptyText: { ...FONTS.regular, fontSize: FONTS.size.sm, textAlign: 'center' },
});
