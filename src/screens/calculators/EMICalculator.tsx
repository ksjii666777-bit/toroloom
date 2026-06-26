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

const PIE_SIZE = 100;

export default function EMICalculator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [loanAmount, setLoanAmount] = useState('5000000');
  const [interestRate, setInterestRate] = useState('9');
  const [tenureMonths, setTenureMonths] = useState('60');

  const principal = parseFloat(loanAmount) || 0;
  const rate = parseFloat(interestRate) || 0;
  const months = parseInt(tenureMonths) || 0;

  // EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)
  const { emi, totalPayment, totalInterest } = useMemo(() => {
    if (principal <= 0 || rate <= 0 || months <= 0) {
      return { emi: 0, totalPayment: 0, totalInterest: 0 };
    }
    const monthlyRate = rate / 12 / 100;
    const factor = Math.pow(1 + monthlyRate, months);
    const emiVal = principal * monthlyRate * factor / (factor - 1);
    const total = emiVal * months;
    return {
      emi: Math.round(emiVal * 100) / 100,
      totalPayment: Math.round(total * 100) / 100,
      totalInterest: Math.round((total - principal) * 100) / 100,
    };
  }, [principal, rate, months]);

  // Yearly amortization schedule
  const yearlySchedule = useMemo(() => {
    const schedule: { year: number; principalPaid: number; interestPaid: number; remaining: number }[] = [];
    if (principal <= 0 || rate <= 0 || months <= 0) return schedule;

    let balance = principal;
    const monthlyRate = rate / 12 / 100;
    const factor = Math.pow(1 + monthlyRate, months);
    const monthlyEmi = principal * monthlyRate * factor / (factor - 1);

    for (let y = 1; y <= Math.ceil(months / 12); y++) {
      let yearlyPrincipal = 0;
      let yearlyInterest = 0;
      const periods = Math.min(12, months - (y - 1) * 12);
      for (let m = 0; m < periods; m++) {
        const interest = balance * monthlyRate;
        const principalPortion = monthlyEmi - interest;
        yearlyPrincipal += principalPortion;
        yearlyInterest += interest;
        balance -= principalPortion;
      }
      schedule.push({
        year: y,
        principalPaid: Math.round(yearlyPrincipal),
        interestPaid: Math.round(yearlyInterest),
        remaining: Math.max(0, Math.round(balance)),
      });
    }
    return schedule;
  }, [principal, rate, months]);

  const principalRatio = principal > 0 ? principal / (principal + totalInterest) : 0.5;
  const interestRatio = totalInterest > 0 ? totalInterest / (principal + totalInterest) : 0.5;

  const handleClear = () => {
    setLoanAmount('');
    setInterestRate('');
    setTenureMonths('');
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
          <Ionicons name="trending-up" size={20} color={colors.warning} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>EMI Calculator</Text>
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
        {/* EMI Result */}
        <View style={[styles.resultCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Monthly EMI</Text>
          <Text style={[styles.emiAmount, { color: colors.text }]}>{formatCurrency(emi)}</Text>

          <View style={[styles.resultRow, { borderTopColor: colors.divider }]}>
            <View style={styles.resultItem}>
              <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Principal</Text>
              <Text style={[styles.resultValue, { color: colors.text }]}>{formatCurrency(principal)}</Text>
            </View>
            <View style={[styles.resultDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.resultItem}>
              <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Interest Payable</Text>
              <Text style={[styles.resultValue, { color: colors.danger }]}>{formatCurrency(totalInterest)}</Text>
            </View>
            <View style={[styles.resultDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.resultItem}>
              <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Total Payment</Text>
              <Text style={[styles.resultValue, { color: colors.text }]}>{formatCurrency(totalPayment)}</Text>
            </View>
          </View>
        </View>

        {/* Breakdown Visual */}
        {totalPayment > 0 && (
          <View style={[styles.pieCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Breakdown</Text>
            <View style={styles.pieContainer}>
              {/* Principal vs Interest bar representation */}
              <View style={styles.breakdownVisual}>
                <View style={[styles.breakdownCircle, { borderColor: colors.border }]}>
                  <Text style={[styles.breakdownEmi, { color: colors.text }]}>{formatCurrency(emi)}</Text>
                  <Text style={[styles.breakdownLabel, { color: colors.textMuted }]}>per month</Text>
                </View>
                <View style={styles.breakdownBars}>
                  <View style={styles.breakdownBarRow}>
                    <View style={[styles.breakdownBarBg, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                      <View style={[styles.breakdownBarFill, { width: `${principalRatio * 100}%`, backgroundColor: colors.accent }]} />
                    </View>
                    <Text style={[styles.breakdownBarLabel, { color: colors.textMuted, fontSize: 10 }]}>
                      {Math.round(principalRatio * 100)}%
                    </Text>
                  </View>
                  <View style={styles.breakdownBarRow}>
                    <View style={[styles.breakdownBarBg, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                      <View style={[styles.breakdownBarFill, { width: `${interestRatio * 100}%`, backgroundColor: colors.danger }]} />
                    </View>
                    <Text style={[styles.breakdownBarLabel, { color: colors.textMuted, fontSize: 10 }]}>
                      {Math.round(interestRatio * 100)}%
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.pieLegend}>
                <View style={styles.pieLegendItem}>
                  <View style={[styles.pieDot, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.pieLegendText, { color: colors.textSecondary }]}>Principal</Text>
                  <Text style={[styles.pieLegendValue, { color: colors.text }]}>{formatCurrency(principal)}</Text>
                </View>
                <View style={styles.pieLegendItem}>
                  <View style={[styles.pieDot, { backgroundColor: colors.danger }]} />
                  <Text style={[styles.pieLegendText, { color: colors.textSecondary }]}>Interest</Text>
                  <Text style={[styles.pieLegendValue, { color: colors.text }]}>{formatCurrency(totalInterest)}</Text>
                </View>
              </View>
            </View>
            <View style={[styles.tenureInfo, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.tenureText, { color: colors.textMuted }]}>
                {months} months ({Math.floor(months / 12)} year{Math.floor(months / 12) !== 1 ? 's' : ''} {months % 12 > 0 ? `${months % 12} mo` : ''})
              </Text>
            </View>
          </View>
        )}

        {/* Inputs */}
        <View style={[styles.formCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Loan Details</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Loan Amount (₹)</Text>
            <TextInput
              style={[styles.input, inputStyle(loanAmount)]}
              value={loanAmount}
              onChangeText={setLoanAmount}
              keyboardType="numeric"
              placeholder="e.g. 5000000"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.presetRow}>
              {[1000000, 3000000, 5000000, 10000000].map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[styles.presetChip, { backgroundColor: colors.bgCard, borderColor: loanAmount === String(amt) ? colors.primary : colors.border }]}
                  onPress={() => setLoanAmount(String(amt))}
                >
                  <Text style={[styles.presetChipText, { color: loanAmount === String(amt) ? colors.primary : colors.textMuted }]}>
                    {amt >= 10000000 ? `₹${amt/10000000}Cr` : `₹${amt/100000}L`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Interest Rate (% p.a.)</Text>
            <TextInput
              style={[styles.input, inputStyle(interestRate)]}
              value={interestRate}
              onChangeText={setInterestRate}
              keyboardType="decimal-pad"
              placeholder="e.g. 9"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.presetRow}>
              {[7, 8.5, 9, 10.5].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.presetChip, { backgroundColor: colors.bgCard, borderColor: interestRate === String(r) ? colors.primary : colors.border }]}
                  onPress={() => setInterestRate(String(r))}
                >
                  <Text style={[styles.presetChipText, { color: interestRate === String(r) ? colors.primary : colors.textMuted }]}>{r}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Loan Tenure (Months)</Text>
            <TextInput
              style={[styles.input, inputStyle(tenureMonths)]}
              value={tenureMonths}
              onChangeText={setTenureMonths}
              keyboardType="numeric"
              placeholder="e.g. 60"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.presetRow}>
              {[12, 24, 60, 120].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.presetChip, { backgroundColor: colors.bgCard, borderColor: tenureMonths === String(m) ? colors.primary : colors.border }]}
                  onPress={() => setTenureMonths(String(m))}
                >
                  <Text style={[styles.presetChipText, { color: tenureMonths === String(m) ? colors.primary : colors.textMuted }]}>
                    {m >= 12 ? `${m / 12}Y` : `${m}M`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Amortization Schedule */}
        {yearlySchedule.length > 0 && (
          <View style={[styles.scheduleCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Yearly Amortization</Text>
            {yearlySchedule.map((row) => {
              const totalYearly = row.principalPaid + row.interestPaid;
              const principalPct = totalYearly > 0 ? (row.principalPaid / totalYearly) * 100 : 0;
              return (
                <View key={row.year} style={[styles.scheduleRow, { borderBottomColor: row.year === yearlySchedule.length ? 'transparent' : colors.divider }]}>
                  <View style={styles.scheduleYearCol}>
                    <Text style={[styles.scheduleYear, { color: colors.text }]}>Year {row.year}</Text>
                    <Text style={[styles.scheduleBalance, { color: colors.textMuted }]}>
                      Bal: {formatCurrency(row.remaining)}
                    </Text>
                  </View>
                  <View style={styles.scheduleAmountCol}>
                    <View style={[styles.scheduleBar, { backgroundColor: colors.bgCard }]}>
                      <View style={[styles.scheduleBarFill, { width: `${principalPct}%`, backgroundColor: colors.accent, opacity: 0.8 }]} />
                      <View style={[styles.scheduleBarInterest, { width: `${100 - principalPct}%`, backgroundColor: colors.danger, opacity: 0.6 }]} />
                    </View>
                    <View style={styles.scheduleValues}>
                      <Text style={[styles.schedulePrincipalText, { color: colors.accent }]}>P: {formatCurrency(row.principalPaid)}</Text>
                      <Text style={[styles.scheduleInterestText, { color: colors.danger }]}>I: {formatCurrency(row.interestPaid)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.warning} style={{ marginRight: 8 }} />
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            EMI calculations are indicative. Actual EMI may vary based on lender's terms, processing fees, and applicable interest rate changes.
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
  resultLabel: { fontSize: FONTS.size.sm, fontFamily: FONTS.regular.fontFamily, marginBottom: 4 },
  emiAmount: { fontSize: FONTS.size.hero, fontFamily: FONTS.bold.fontFamily, fontWeight: FONTS.bold.fontWeight, letterSpacing: -0.5, marginBottom: SPACING.lg },
  resultRow: { flexDirection: 'row', width: '100%', borderTopWidth: 1, paddingTop: SPACING.md },
  resultItem: { flex: 1, alignItems: 'center' },
  resultValue: { fontSize: FONTS.size.sm, fontFamily: FONTS.semiBold.fontFamily, fontWeight: FONTS.semiBold.fontWeight },
  resultDivider: { width: 1, marginVertical: 4 },
  sectionTitle: { fontSize: FONTS.size.md, fontFamily: FONTS.semiBold.fontFamily, fontWeight: FONTS.semiBold.fontWeight, marginBottom: SPACING.md },
  // Breakdown
  pieCard: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg },
  pieContainer: { gap: SPACING.lg },
  breakdownVisual: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  breakdownCircle: {
    width: PIE_SIZE,
    height: PIE_SIZE,
    borderRadius: PIE_SIZE / 2,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownEmi: { fontSize: FONTS.size.md, fontFamily: FONTS.bold.fontFamily, fontWeight: FONTS.bold.fontWeight },
  breakdownLabel: { fontSize: FONTS.size.xs, fontFamily: FONTS.regular.fontFamily, marginTop: 2 },
  breakdownBars: { flex: 1, gap: 8 },
  breakdownBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownBarBg: { flex: 1, height: 12, borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  breakdownBarFill: { height: '100%', borderRadius: 6 },
  breakdownBarLabel: { width: 30, textAlign: 'right', fontFamily: FONTS.medium.fontFamily, fontWeight: FONTS.medium.fontWeight },
  pieLegend: { flex: 1, marginLeft: SPACING.lg, gap: 12 },
  pieLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pieDot: { width: 10, height: 10, borderRadius: 5 },
  pieLegendText: { flex: 1, fontSize: FONTS.size.sm, fontFamily: FONTS.regular.fontFamily },
  pieLegendValue: { fontSize: FONTS.size.sm, fontFamily: FONTS.semiBold.fontFamily, fontWeight: FONTS.semiBold.fontWeight },
  tenureInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.md, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, marginTop: SPACING.md },
  tenureText: { fontSize: FONTS.size.sm, fontFamily: FONTS.regular.fontFamily },
  // Form
  formCard: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg },
  fieldGroup: { marginBottom: SPACING.md },
  fieldLabel: { fontSize: FONTS.size.sm, fontFamily: FONTS.medium.fontFamily, fontWeight: FONTS.medium.fontWeight, marginBottom: 8 },
  input: { height: 48, borderRadius: BORDER_RADIUS.md, borderWidth: 1, paddingHorizontal: SPACING.md, fontSize: FONTS.size.lg, fontFamily: FONTS.medium.fontFamily, fontWeight: FONTS.medium.fontWeight },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  presetChipText: { fontSize: FONTS.size.xs, fontFamily: FONTS.medium.fontFamily, fontWeight: FONTS.medium.fontWeight },
  // Schedule
  scheduleCard: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg },
  scheduleRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1 },
  scheduleYearCol: { width: 80 },
  scheduleYear: { fontSize: FONTS.size.sm, fontFamily: FONTS.semiBold.fontFamily, fontWeight: FONTS.semiBold.fontWeight },
  scheduleBalance: { fontSize: FONTS.size.xs, fontFamily: FONTS.regular.fontFamily, marginTop: 2 },
  scheduleAmountCol: { flex: 1 },
  scheduleBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  scheduleBarFill: { height: '100%' },
  scheduleBarInterest: { height: '100%' },
  scheduleValues: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  schedulePrincipalText: { fontSize: FONTS.size.xs, fontFamily: FONTS.regular.fontFamily },
  scheduleInterestText: { fontSize: FONTS.size.xs, fontFamily: FONTS.regular.fontFamily },
  // Info
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.md, borderRadius: BORDER_RADIUS.sm, borderWidth: 1 },
  infoText: { flex: 1, fontSize: FONTS.size.xs, fontFamily: FONTS.regular.fontFamily, lineHeight: 18 },
});
