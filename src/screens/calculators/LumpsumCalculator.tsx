import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';

const CHART_HEIGHT = 160;

export default function LumpsumCalculator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [investment, setInvestment] = useState('500000');
  const [expectedReturn, setExpectedReturn] = useState('12');
  const [tenureYears, setTenureYears] = useState('5');

  const principal = parseFloat(investment) || 0;
  const rate = parseFloat(expectedReturn) || 0;
  const years = parseFloat(tenureYears) || 0;

  const { maturityAmount, estimatedReturns } = useMemo(() => {
    if (principal <= 0 || rate <= 0 || years <= 0) {
      return { maturityAmount: 0, estimatedReturns: 0 };
    }
    const factor = Math.pow(1 + rate / 100, years);
    const maturity = principal * factor;
    return {
      maturityAmount: Math.round(maturity * 100) / 100,
      estimatedReturns: Math.round((maturity - principal) * 100) / 100,
    };
  }, [principal, rate, years]);

  // Year-by-year projection
  const yearlyData = useMemo(() => {
    const data: { year: number; value: number; returns: number }[] = [];
    if (principal <= 0 || rate <= 0 || years <= 0) return data;
    for (let y = 1; y <= years; y++) {
      const factor = Math.pow(1 + rate / 100, y);
      const value = Math.round(principal * factor);
      data.push({ year: y, value, returns: value - principal });
    }
    return data;
  }, [principal, rate, years]);

  const maxValue = yearlyData.length > 0 ? Math.max(...yearlyData.map(d => d.value)) : 1;

  const handleClear = () => {
    setInvestment('');
    setExpectedReturn('');
    setTenureYears('');
  };

  const inputStyle = (fieldValue: string) => ({
    backgroundColor: colors.bgInput,
    color: colors.text,
    borderColor: fieldValue ? colors.primary : colors.border,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="briefcase" size={20} color={colors.accent} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Lumpsum Calculator</Text>
        </View>
        <TouchableOpacity onPress={handleClear} style={[styles.clearBtn, { backgroundColor: colors.bgCard }]}>
          <Ionicons name="refresh" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Result Card */}
        <View style={[styles.resultCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Text style={[styles.maturityLabel, { color: colors.textMuted }]}>Maturity Amount</Text>
          <Text style={[styles.maturityAmount, { color: colors.text }]}>{formatCurrency(maturityAmount)}</Text>

          <View style={[styles.resultRow, { borderTopColor: colors.divider }]}>
            <View style={styles.resultItem}>
              <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Principal</Text>
              <Text style={[styles.resultValue, { color: colors.text }]}>{formatCurrency(principal)}</Text>
            </View>
            <View style={[styles.resultDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.resultItem}>
              <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Est. Returns</Text>
              <Text style={[styles.resultValue, { color: colors.accent }]}>{formatCurrency(estimatedReturns)}</Text>
            </View>
          </View>
        </View>

        {/* Growth Chart */}
        {yearlyData.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Yearly Growth</Text>
            <View style={styles.chartContainer}>
              <View style={styles.chartBars}>
                {yearlyData.map((d) => {
                  const height = (d.value / maxValue) * CHART_HEIGHT;
                  const principalRatio = principal / maxValue;
                  const principalH = principalRatio * CHART_HEIGHT;
                  return (
                    <View key={d.year} style={styles.barGroup}>
                      <View
                        style={[
                          styles.barPrincipal,
                          { height: Math.max(principalH, 2), backgroundColor: colors.textMuted, opacity: 0.3 },
                        ]}
                      />
                      <View
                        style={[
                          styles.bar,
                          { height: Math.max(height, 2), backgroundColor: colors.primary, opacity: 0.8 },
                        ]}
                      />
                      <Text style={[styles.barLabel, { color: colors.textMuted }]}>{d.year}Y</Text>
                    </View>
                  );
                })}
              </View>
              <View style={[styles.legendRow, { borderTopColor: colors.divider }]}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primary, opacity: 0.8 }]} />
                  <Text style={[styles.legendText, { color: colors.textMuted }]}>Portfolio Value</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.textMuted, opacity: 0.3 }]} />
                  <Text style={[styles.legendText, { color: colors.textMuted }]}>Principal</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Inputs */}
        <View style={[styles.formCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Investment Details</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Lumpsum Amount (₹)</Text>
            <TextInput
              style={[styles.input, inputStyle(investment)]}
              value={investment}
              onChangeText={setInvestment}
              keyboardType="numeric"
              placeholder="e.g. 500000"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.presetRow}>
              {[100000, 500000, 1000000, 5000000].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[styles.presetChip, { backgroundColor: colors.bgCard, borderColor: investment === String(amt) ? colors.primary : colors.border }]}
                  onPress={() => setInvestment(String(amt))}
                >
                  <Text style={[styles.presetChipText, { color: investment === String(amt) ? colors.primary : colors.textMuted }]}>
                    {amt >= 10000000 ? `₹${amt/10000000}Cr` : amt >= 100000 ? `₹${amt/100000}L` : `₹${amt/1000}K`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Expected Return (% p.a.)</Text>
            <TextInput
              style={[styles.input, inputStyle(expectedReturn)]}
              value={expectedReturn}
              onChangeText={setExpectedReturn}
              keyboardType="decimal-pad"
              placeholder="e.g. 12"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.presetRow}>
              {[8, 10, 12, 15].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.presetChip, { backgroundColor: colors.bgCard, borderColor: expectedReturn === String(r) ? colors.primary : colors.border }]}
                  onPress={() => setExpectedReturn(String(r))}
                >
                  <Text style={[styles.presetChipText, { color: expectedReturn === String(r) ? colors.primary : colors.textMuted }]}>{r}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Investment Period (Years)</Text>
            <TextInput
              style={[styles.input, inputStyle(tenureYears)]}
              value={tenureYears}
              onChangeText={setTenureYears}
              keyboardType="numeric"
              placeholder="e.g. 5"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.presetRow}>
              {[1, 3, 5, 10].map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.presetChip, { backgroundColor: colors.bgCard, borderColor: tenureYears === String(y) ? colors.primary : colors.border }]}
                  onPress={() => setTenureYears(String(y))}
                >
                  <Text style={[styles.presetChipText, { color: tenureYears === String(y) ? colors.primary : colors.textMuted }]}>{y}Y</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Summary */}
        {maturityAmount > 0 && (
          <View style={[styles.summaryCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Summary</Text>
            <View style={styles.summaryRow}>
              <Ionicons name="analytics-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                A one-time investment of{' '}
                <Text style={{ color: colors.text, fontFamily: FONTS.semiBold.fontFamily }}>{formatCurrency(principal)}</Text> growing at{' '}
                <Text style={{ color: colors.text, fontFamily: FONTS.semiBold.fontFamily }}>{rate}%</Text> p.a. for{' '}
                <Text style={{ color: colors.text, fontFamily: FONTS.semiBold.fontFamily }}>{years} year{years !== 1 ? 's' : ''}</Text>{' '}
                would be worth <Text style={{ color: colors.accent, fontFamily: FONTS.semiBold.fontFamily }}>{formatCurrency(maturityAmount)}</Text>.
              </Text>
            </View>
            <View style={[styles.summaryRatio, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.ratioLabel, { color: colors.textMuted }]}>Wealth Growth Factor</Text>
              <Text style={[styles.ratioValue, { color: colors.accent }]}>
                {principal > 0 ? `${(maturityAmount / principal).toFixed(2)}x` : '—'}
              </Text>
            </View>
          </View>
        )}

        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            Returns shown are estimated based on the expected rate of return. Actual returns may vary based on market conditions.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, borderRadius: BORDER_RADIUS.full, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: FONTS.size.xl, fontFamily: FONTS.semiBold.fontFamily, fontWeight: FONTS.semiBold.fontWeight },
  clearBtn: { width: 40, height: 40, borderRadius: BORDER_RADIUS.full, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.lg, gap: 16 },
  resultCard: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.xl, alignItems: 'center' },
  maturityLabel: { fontSize: FONTS.size.sm, fontFamily: FONTS.regular.fontFamily, marginBottom: 4 },
  maturityAmount: { fontSize: FONTS.size.hero, fontFamily: FONTS.bold.fontFamily, fontWeight: FONTS.bold.fontWeight, letterSpacing: -0.5, marginBottom: SPACING.lg },
  resultRow: { flexDirection: 'row', width: '100%', borderTopWidth: 1, paddingTop: SPACING.md },
  resultItem: { flex: 1, alignItems: 'center' },
  resultLabel: { fontSize: FONTS.size.xs, fontFamily: FONTS.regular.fontFamily, marginBottom: 4 },
  resultValue: { fontSize: FONTS.size.lg, fontFamily: FONTS.semiBold.fontFamily, fontWeight: FONTS.semiBold.fontWeight },
  resultDivider: { width: 1, marginVertical: 4 },
  sectionTitle: { fontSize: FONTS.size.md, fontFamily: FONTS.semiBold.fontFamily, fontWeight: FONTS.semiBold.fontWeight, marginBottom: SPACING.md },
  chartCard: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg },
  chartContainer: { marginTop: 4 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 3 },
  barGroup: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: CHART_HEIGHT },
  bar: { width: '70%', borderTopLeftRadius: 3, borderTopRightRadius: 3, position: 'absolute', bottom: 18 },
  barPrincipal: { width: '70%', borderTopLeftRadius: 3, borderTopRightRadius: 3, position: 'absolute', bottom: 18 },
  barLabel: { fontSize: FONTS.size.xs, fontFamily: FONTS.regular.fontFamily, position: 'absolute', bottom: 0 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingTop: SPACING.sm, marginTop: SPACING.sm, borderTopWidth: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: FONTS.size.xs, fontFamily: FONTS.regular.fontFamily },
  formCard: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg },
  fieldGroup: { marginBottom: SPACING.md },
  fieldLabel: { fontSize: FONTS.size.sm, fontFamily: FONTS.medium.fontFamily, fontWeight: FONTS.medium.fontWeight, marginBottom: 8 },
  input: { height: 48, borderRadius: BORDER_RADIUS.md, borderWidth: 1, paddingHorizontal: SPACING.md, fontSize: FONTS.size.lg, fontFamily: FONTS.medium.fontFamily, fontWeight: FONTS.medium.fontWeight },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  presetChipText: { fontSize: FONTS.size.xs, fontFamily: FONTS.medium.fontFamily, fontWeight: FONTS.medium.fontWeight },
  summaryCard: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg },
  summaryRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  summaryText: { flex: 1, fontSize: FONTS.size.sm, fontFamily: FONTS.regular.fontFamily, lineHeight: 20 },
  summaryRatio: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, marginTop: SPACING.md },
  ratioLabel: { fontSize: FONTS.size.sm, fontFamily: FONTS.regular.fontFamily },
  ratioValue: { fontSize: FONTS.size.lg, fontFamily: FONTS.bold.fontFamily, fontWeight: FONTS.bold.fontWeight },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.md, borderRadius: BORDER_RADIUS.sm, borderWidth: 1 },
  infoText: { flex: 1, fontSize: FONTS.size.xs, fontFamily: FONTS.regular.fontFamily, lineHeight: 18 },
});
