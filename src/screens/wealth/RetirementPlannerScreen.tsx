/**
 * ============================================================================
 * Toroloom — Retirement Planner Screen
 * ============================================================================
 *
 * Comprehensive retirement planning with:
 *   - Age-based inputs (current age, retirement age, life expectancy)
 *   - Current savings and monthly contribution
 *   - Expected returns and inflation rate
 *   - Projected corpus at retirement
 *   - Monthly retirement income estimate
 *   - Gap analysis
 *   - Yearly growth chart
 *   - Actionable recommendations
 *
 * Navigation: Wealth Dashboard → Retirement Planner
 * ============================================================================
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,    Platform,
  } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { useWealthStore } from '../../store/wealthStore';
import _AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';



const _formatINR = (n: number) =>
  '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const formatCompactINR = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (n / 1e7).toFixed(2) + 'Cr';
  if (abs >= 1e5) return '₹' + (n / 1e5).toFixed(2) + 'L';
  if (abs >= 1e3) return '₹' + (n / 1e3).toFixed(1) + 'K';
  return '₹' + n.toFixed(0);
};

const CHART_HEIGHT = 160;

export default function RetirementPlannerScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'RetirementPlanner'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { retirementPlan, updateRetirementPlan, getRetirementProjection } = useWealthStore();

  const [currentAge, setCurrentAge] = useState(String(retirementPlan.currentAge));
  const [retirementAge, setRetirementAge] = useState(String(retirementPlan.retirementAge));
  const [lifeExpectancy, setLifeExpectancy] = useState(String(retirementPlan.lifeExpectancy));
  const [currentSavings, setCurrentSavings] = useState(String(retirementPlan.currentRetirementSavings));
  const [monthlyContribution, setMonthlyContribution] = useState(String(retirementPlan.monthlyContribution));
  const [expectedReturn, setExpectedReturn] = useState(String(retirementPlan.expectedReturn));
  const [inflationRate, setInflationRate] = useState(String(retirementPlan.inflationRate));
  const [expectedExpense, setExpectedExpense] = useState(String(retirementPlan.expectedMonthlyExpense));
  const [otherIncome, setOtherIncome] = useState(String(retirementPlan.otherIncome));

  const projection = useMemo(() => {
    // Update store with current inputs
    updateRetirementPlan({
      currentAge: parseInt(currentAge) || 30,
      retirementAge: parseInt(retirementAge) || 60,
      lifeExpectancy: parseInt(lifeExpectancy) || 85,
      currentRetirementSavings: parseFloat(currentSavings) || 0,
      monthlyContribution: parseFloat(monthlyContribution) || 0,
      expectedReturn: parseFloat(expectedReturn) || 12,
      inflationRate: parseFloat(inflationRate) || 6,
      expectedMonthlyExpense: parseFloat(expectedExpense) || 50000,
      otherIncome: parseFloat(otherIncome) || 0,
    });
    return getRetirementProjection();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAge, retirementAge, lifeExpectancy, currentSavings, monthlyContribution,
      expectedReturn, inflationRate, expectedExpense, otherIncome]);

  const isOnTrack = projection.gap <= 0;
  const maxChartValue = projection.yearlyData.length > 0
    ? Math.max(...projection.yearlyData.map(d => d.corpus))
    : 1;

  const inputStyle = (val: string) => ({
    backgroundColor: colors.bgInput,
    color: colors.text,
    borderColor: val ? colors.primary : colors.border,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <LinearGradient
        colors={['#1a2332', colors.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: 50 + insets.top }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{t('retirement.title')}</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t('retirement.subtitle')}
        </Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Projection Summary ── */}
        <Animated.View entering={FadeInUp.duration(400)}>
          <LinearGradient
            colors={isOnTrack ? GRADIENTS.success : ['#1a2332', '#0a1628']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <Text style={styles.summaryLabel}>{t('retirement.projectedCorpus')}</Text>
            <Text style={styles.summaryValue}>{formatCompactINR(projection.corpusAtRetirement)}</Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons name="cash" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.summaryItemLabel}>{t('retirement.monthlyIncome')}</Text>
                <Text style={styles.summaryItemValue}>{formatCompactINR(projection.monthlyRetirementIncome)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="calendar" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.summaryItemLabel}>{t('retirement.yearsToGo')}</Text>
                <Text style={styles.summaryItemValue}>{t('retirement.years', { count: projection.yearsToRetirement })}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="pulse" size={14} color={isOnTrack ? '#00E676' : '#FF5252'} />
                <Text style={styles.summaryItemLabel}>{t('retirement.status')}</Text>
                <Text style={[styles.summaryItemValue, { color: isOnTrack ? '#00E676' : '#FF5252' }]}>
                  {isOnTrack ? t('retirement.onTrack') : t('retirement.gap')}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Gap Alert ── */}
        {!isOnTrack && (
          <Animated.View entering={FadeInUp.duration(450)} style={[styles.gapCard, { backgroundColor: '#FF525210', borderColor: '#FF525230' }]}>
            <Ionicons name="warning" size={20} color="#FF5252" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.gapTitle, { color: '#FF5252' }]}>{t('retirement.gapDetected')}</Text>
              <Text style={[styles.gapText, { color: colors.textMuted }]}>
                {t('retirement.gapText', { shortfall: formatCompactINR(projection.gap), required: formatCompactINR(projection.requiredMonthlySIP) })}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ── Yearly Growth Chart ── */}
        {projection.yearlyData.length > 0 && (
          <Animated.View entering={FadeInUp.duration(500)} style={[styles.chartCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('retirement.corpusGrowth')}</Text>
            <View style={styles.chartContainer}>
              <View style={styles.chartBars}>
                {projection.yearlyData.map((d, i) => {
                  if (i % Math.max(1, Math.floor(projection.yearlyData.length / 10)) !== 0 &&
                      i !== projection.yearlyData.length - 1) return null;
                  const height = (d.corpus / maxChartValue) * CHART_HEIGHT;
                  return (
                    <View key={d.age} style={styles.chartBarGroup}>
                      <View style={[styles.chartBar, { height: Math.max(height, 4), backgroundColor: colors.primary }]} />
                      <Text style={[styles.chartBarLabel, { color: colors.textMuted }]}>{d.age}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={[styles.chartLegend, { borderTopColor: colors.divider }]}>
                <View style={styles.chartLegendItem}>
                  <View style={[styles.chartLegendDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.chartLegendText, { color: colors.textMuted }]}>{t('retirement.corpus')}</Text>
                </View>
                <Text style={[styles.chartNote, { color: colors.textMuted }]}>{t('retirement.ageNote')}</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Input Form ── */}
        <Animated.View entering={FadeInUp.duration(550)} style={[styles.formCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('retirement.yourDetails')}</Text>

          {/* Age & Life Expectancy */}
          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('retirement.currentAge')}</Text>
              <View style={[styles.inputRow, inputStyle(currentAge), { width: '100%' }]}>
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  value={currentAge}
                  onChangeText={setCurrentAge}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('retirement.retireAt')}</Text>
              <View style={[styles.inputRow, inputStyle(retirementAge), { width: '100%' }]}>
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  value={retirementAge}
                  onChangeText={setRetirementAge}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('retirement.lifeExpectancy')}</Text>
              <View style={[styles.inputRow, inputStyle(lifeExpectancy), { width: '100%' }]}>
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  value={lifeExpectancy}
                  onChangeText={setLifeExpectancy}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Current Savings */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.md }]}>{t('retirement.currentSavings')}</Text>
          <View style={[styles.inputRow, inputStyle(currentSavings)]}>
            <Text style={[styles.inputPrefix, { color: colors.textMuted }]}>₹</Text>
            <TextInput
              style={[styles.inputField, { color: colors.text }]}
              value={currentSavings}
              onChangeText={setCurrentSavings}
              keyboardType="numeric"
            />
          </View>

          {/* Monthly Contribution */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.md }]}>{t('retirement.monthlyContribution')}</Text>
          <View style={[styles.inputRow, inputStyle(monthlyContribution)]}>
            <Text style={[styles.inputPrefix, { color: colors.textMuted }]}>₹</Text>
            <TextInput
              style={[styles.inputField, { color: colors.text }]}
              value={monthlyContribution}
              onChangeText={setMonthlyContribution}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.suggestionRow}>
            {[5000, 10000, 25000, 50000].map(amt => (
              <Pressable
                key={amt}
                style={[styles.suggestionChip, { backgroundColor: colors.bgInput, borderColor: monthlyContribution === String(amt) ? colors.primary : colors.border }]}
                onPress={() => setMonthlyContribution(String(amt))}
              >
                <Text style={[styles.suggestionText, { color: monthlyContribution === String(amt) ? colors.primary : colors.textMuted }]}>{formatCompactINR(amt)}</Text>
              </Pressable>
            ))}
          </View>

          {/* Expected Return & Inflation */}
          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.md }]}>{t('retirement.expectedReturn')}</Text>
              <View style={[styles.inputRow, inputStyle(expectedReturn), { width: '100%' }]}>
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  value={expectedReturn}
                  onChangeText={setExpectedReturn}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>%</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.md }]}>{t('retirement.inflation')}</Text>
              <View style={[styles.inputRow, inputStyle(inflationRate), { width: '100%' }]}>
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  value={inflationRate}
                  onChangeText={setInflationRate}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>%</Text>
              </View>
            </View>
          </View>

          {/* Expected Monthly Expense */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.md }]}>{t('retirement.expectedExpense')}</Text>
          <View style={[styles.inputRow, inputStyle(expectedExpense)]}>
            <Text style={[styles.inputPrefix, { color: colors.textMuted }]}>₹</Text>
            <TextInput
              style={[styles.inputField, { color: colors.text }]}
              value={expectedExpense}
              onChangeText={setExpectedExpense}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.suggestionRow}>
            {[25000, 50000, 100000, 200000].map(amt => (
              <Pressable
                key={amt}
                style={[styles.suggestionChip, { backgroundColor: colors.bgInput, borderColor: expectedExpense === String(amt) ? colors.primary : colors.border }]}
                onPress={() => setExpectedExpense(String(amt))}
              >
                <Text style={[styles.suggestionText, { color: expectedExpense === String(amt) ? colors.primary : colors.textMuted }]}>{formatCompactINR(amt)}</Text>
              </Pressable>
            ))}
          </View>

          {/* Other Income */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.md }]}>{t('retirement.otherIncome')}</Text>
          <View style={[styles.inputRow, inputStyle(otherIncome)]}>
            <Text style={[styles.inputPrefix, { color: colors.textMuted }]}>₹</Text>
            <TextInput
              style={[styles.inputField, { color: colors.text }]}
              value={otherIncome}
              onChangeText={setOtherIncome}
              keyboardType="numeric"
            />
          </View>
        </Animated.View>

        {/* ── Summary ── */}
        <Animated.View entering={FadeInUp.duration(600)} style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('retirement.summary')}</Text>
          <View style={styles.summaryDetailRow}>
            <Text style={[styles.summaryDetailLabel, { color: colors.textMuted }]}>{t('retirement.corpusAtRetirement')}</Text>
            <Text style={[styles.summaryDetailValue, { color: colors.text }]}>{formatCompactINR(projection.corpusAtRetirement)}</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.summaryDetailRow}>
            <Text style={[styles.summaryDetailLabel, { color: colors.textMuted }]}>{t('retirement.monthlyIncomeAdjusted')}</Text>
            <Text style={[styles.summaryDetailValue, { color: colors.text }]}>{formatCompactINR(projection.monthlyRetirementIncome)}</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.summaryDetailRow}>
            <Text style={[styles.summaryDetailLabel, { color: colors.textMuted }]}>{t('retirement.monthlyExpensesAdjusted')}</Text>
            <Text style={[styles.summaryDetailValue, { color: colors.text }]}>
              {formatCompactINR(parseFloat(expectedExpense) * Math.pow(1 + parseFloat(inflationRate) / 100, parseInt(retirementAge) - parseInt(currentAge)) || 0)}
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.summaryDetailRow}>
            <Text style={[styles.summaryDetailLabel, { color: colors.textMuted }]}>{t('retirement.monthlyGap')}</Text>
            <Text style={[styles.summaryDetailValue, { color: projection.gap > 0 ? '#FF5252' : '#00E676' }]}>
              {projection.gap > 0 ? `-${formatCompactINR(projection.gap)}` : t('retirement.noGap')}
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.summaryDetailRow}>
            <Text style={[styles.summaryDetailLabel, { color: colors.textMuted }]}>{t('retirement.requiredSip')}</Text>
            <Text style={[styles.summaryDetailValue, { color: '#FFC107' }]}>{formatCompactINR(projection.requiredMonthlySIP)}</Text>
          </View>
        </Animated.View>

        {/* ── Tips ── */}
        <Animated.View entering={FadeInUp.duration(650)} style={[styles.tipsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('retirement.tips')}</Text>
          <View style={styles.tipRow}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              {t('retirement.tip1')}
            </Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              {t('retirement.tip2')}
            </Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              {t('retirement.tip3')}
            </Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>
              {t('retirement.tip4')}
            </Text>
          </View>
        </Animated.View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backBtn: { padding: 4 },
  title: { ...FONTS.bold, fontSize: FONTS.size.title, color: '#fff' },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4, color: 'rgba(255,255,255,0.6)' },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },

  // Summary Card (gradient)
  summaryCard: {
    padding: SPACING.xl, borderRadius: BORDER_RADIUS.xl, overflow: 'hidden', marginBottom: SPACING.md,
  },
  summaryLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: 'rgba(255,255,255,0.7)' },
  summaryValue: { ...FONTS.bold, fontSize: 32, color: '#fff', marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  summaryRow: {
    flexDirection: 'row', marginTop: SPACING.lg, paddingTop: SPACING.lg,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', alignItems: 'center',
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryItemLabel: { ...FONTS.regular, fontSize: 9, color: 'rgba(255,255,255,0.6)' },
  summaryItemValue: { ...FONTS.bold, fontSize: FONTS.size.sm, color: '#fff' },
  summaryDivider: { width: 1, height: 25, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Gap Card
  gapCard: {
    flexDirection: 'row', gap: SPACING.md, padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.md, alignItems: 'flex-start',
  },
  gapTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  gapText: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2, lineHeight: 16 },

  // Chart
  chartCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.md,
  },
  chartContainer: { marginTop: SPACING.sm },
  chartBars: {
    flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 2,
  },
  chartBarGroup: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: CHART_HEIGHT },
  chartBar: {
    width: '70%', borderTopLeftRadius: 3, borderTopRightRadius: 3,
    position: 'absolute', bottom: 18,
  },
  chartBarLabel: { ...FONTS.regular, fontSize: 9, position: 'absolute', bottom: 0 },
  chartLegend: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: SPACING.sm, marginTop: SPACING.sm, borderTopWidth: 1,
  },
  chartLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chartLegendDot: { width: 8, height: 8, borderRadius: 4 },
  chartLegendText: { ...FONTS.regular, fontSize: FONTS.size.xs },
  chartNote: { ...FONTS.regular, fontSize: FONTS.size.xs },

  // Form
  formCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.md,
  },
  sectionTitle: { ...FONTS.bold, fontSize: FONTS.size.md, marginBottom: SPACING.md },
  formRow: { flexDirection: 'row', gap: SPACING.sm },
  fieldLabel: { ...FONTS.medium, fontSize: FONTS.size.xs, marginBottom: SPACING.xs },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, height: 44,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
  },
  inputPrefix: { ...FONTS.semiBold, fontSize: FONTS.size.md, marginRight: 4 },
  inputSuffix: { ...FONTS.regular, fontSize: FONTS.size.sm, marginLeft: 4 },
  inputField: { flex: 1, ...FONTS.bold, fontSize: FONTS.size.md, padding: 0 },

  // Suggestions
  suggestionRow: {
    flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs, flexWrap: 'wrap',
  },
  suggestionChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1, marginTop: 2,
  },
  suggestionText: { ...FONTS.medium, fontSize: FONTS.size.xs },

  // Summary Details
  summaryDetailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  summaryDetailLabel: { ...FONTS.regular, fontSize: FONTS.size.sm },
  summaryDetailValue: { ...FONTS.bold, fontSize: FONTS.size.sm, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Tips
  tipsCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.lg,
  },
  tipRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  tipBullet: { ...FONTS.bold, fontSize: FONTS.size.sm, color: '#6C63FF' },
  tipText: { ...FONTS.regular, fontSize: FONTS.size.sm, flex: 1, lineHeight: 18 },
});
