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
import { useT } from '../../hooks/useT';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import AppScreen from '../../components/ui/AppScreen';

// Indian tax regime constants (FY 2025-26)
const STCG_TAX_RATE = 0.20; // 20% for STCG on equities (if STT paid)
const LTCG_TAX_RATE = 0.10; // 10% for LTCG over ₹1L on equities
const LTCG_EXEMPTION = 100000; // ₹1L exemption on LTCG
const SURCHARGE_RATE = 0.10; // 10% surcharge on tax > ₹50L (simplified)
const CESS_RATE = 0.04; // 4% health & education cess

type HoldingPeriod = 'stcg' | 'ltcg';

export default function TaxCalculator() {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [purchasePrice, setPurchasePrice] = useState('1500');
  const [salePrice, setSalePrice] = useState('1850');
  const [quantity, setQuantity] = useState('100');
  const [holdingPeriod, setHoldingPeriod] = useState<HoldingPeriod>('ltcg');

  const buyPrice = parseFloat(purchasePrice) || 0;
  const sellPrice = parseFloat(salePrice) || 0;
  const qty = parseInt(quantity) || 0;
  const isSTCG = holdingPeriod === 'stcg';

  const { totalInvestment, totalSaleValue, grossProfit, taxableGains, taxAmount, surchargeAmount, cessAmount, totalTaxLiability, effectiveTaxRate, isProfit } = useMemo(() => {
    const invested = buyPrice * qty;
    const saleVal = sellPrice * qty;
    const profit = saleVal - invested;
    const isProfitable = profit > 0;

    let taxable = 0;
    let tax = 0;
    let surcharge = 0;

    if (isProfitable) {
      if (isSTCG) {
        // STCG: Full short-term gain taxed at 20%
        taxable = profit;
        tax = taxable * STCG_TAX_RATE;
      } else {
        // LTCG: Gains over ₹1L taxed at 10%
        taxable = Math.max(0, profit - LTCG_EXEMPTION);
        tax = taxable * LTCG_TAX_RATE;
      }

      // Surcharge (simplified: 10% if tax > ₹50L)
      surcharge = tax > 500000 ? tax * SURCHARGE_RATE : 0;
    }

    const cess = (tax + surcharge) * CESS_RATE;
    const totalTax = tax + surcharge + cess;
    const effRate = taxable > 0 ? (totalTax / taxable) * 100 : 0;

    return {
      totalInvestment: invested,
      totalSaleValue: saleVal,
      grossProfit: profit,
      taxableGains: Math.round(taxable * 100) / 100,
      taxAmount: Math.round(tax * 100) / 100,
      surchargeAmount: Math.round(surcharge * 100) / 100,
      cessAmount: Math.round(cess * 100) / 100,
      totalTaxLiability: Math.round(totalTax * 100) / 100,
      effectiveTaxRate: Math.round(effRate * 100) / 100,
      isProfit: isProfitable,
    };
  }, [buyPrice, sellPrice, qty, isSTCG]);

  const handleClear = () => {
    setPurchasePrice('');
    setSalePrice('');
    setQuantity('');
  };

  const inputStyle = (fieldValue: string) => ({
    backgroundColor: colors.bgInput,
    color: colors.text,
    borderColor: fieldValue ? colors.primary : colors.border,
  });

  return (
          <AppScreen scroll={false} padded={false}
      >
  {/* Header */}
        <View style={[styles.header, {backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Ionicons name="receipt" size={20} color={colors.secondary} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('calculators.tax')}</Text>
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
          {/* Holding Period Toggle */}
          <View style={[styles.toggleCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('calculators.holdingPeriod')}</Text>
            <View style={[styles.toggleRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.toggleOption, isSTCG && { backgroundColor: colors.danger }]}
                onPress={() => setHoldingPeriod('stcg')}
              >
                <Text style={[styles.toggleText, { color: isSTCG ? colors.white : colors.textMuted }]}>
                  {t('calculators.stcg')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleOption, !isSTCG && { backgroundColor: colors.primary }]}
                onPress={() => setHoldingPeriod('ltcg')}
              >
                <Text style={[styles.toggleText, { color: !isSTCG ? colors.white : colors.textMuted }]}>
                  {t('calculators.ltcg')}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.hintText, { color: colors.textMuted }]}>
              {isSTCG
                ? t('calculators.stcgDesc')
                : t('calculators.ltcgDesc')}
            </Text>
          </View>

          {/* Result Card */}
          <View style={[styles.resultCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <View style={styles.resultHeader}>
              <Text style={[styles.resultLabel, { color: colors.textMuted }]}>
                {isSTCG ? t('calculators.shortTermGains') : t('calculators.longTermGains')}
              </Text>
              <View style={[styles.profitBadge, { backgroundColor: isProfit ? colors.accent + '20' : colors.danger + '20' }]}>
                <Text style={[styles.profitBadgeText, { color: isProfit ? colors.accent : colors.danger }]}>
                  {isProfit ? t('calculators.profit') : t('calculators.loss')}
                </Text>
              </View>
            </View>
            <Text style={[styles.gainAmount, { color: isProfit ? colors.accent : colors.danger }]}>
              {isProfit ? '' : '-'}{formatCurrency(Math.abs(grossProfit))}
            </Text>

            <View style={[styles.resultDivider, { backgroundColor: colors.divider }]} />

            {/* Tax Breakdown */}
            <View style={styles.taxBreakdown}>
              <View style={styles.taxRow}>
                <Text style={[styles.taxLabel, { color: colors.textMuted }]}>{t('calculators.grossProfit')}</Text>
                <Text style={[styles.taxValue, { color: colors.text }]}>{formatCurrency(grossProfit)}</Text>
              </View>
              {!isSTCG && (
                <View style={styles.taxRow}>
                  <Text style={[styles.taxLabel, { color: colors.textMuted }]}>{t('calculators.ltcgExemption')}</Text>
                  <Text style={[styles.taxValue, { color: colors.text }]}>-{formatCurrency(LTCG_EXEMPTION)}</Text>
                </View>
              )}
              <View style={styles.taxRow}>
                <Text style={[styles.taxLabel, { color: colors.textMuted }]}>{t('calculators.taxableGains')}</Text>
                <Text style={[styles.taxValue, { color: colors.text }]}>{formatCurrency(taxableGains)}</Text>
              </View>
              <View style={[styles.taxDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.taxRow}>
                <Text style={[styles.taxLabel, { color: colors.textMuted }]}>{t('calculators.taxAmount', { rate: isSTCG ? '20' : '10' })}</Text>
                <Text style={[styles.taxValue, { color: colors.danger }]}>{formatCurrency(taxAmount)}</Text>
              </View>
              {surchargeAmount > 0 && (
                <View style={styles.taxRow}>
                  <Text style={[styles.taxLabel, { color: colors.textMuted }]}>{t('calculators.surcharge')}</Text>
                  <Text style={[styles.taxValue, { color: colors.danger }]}>{formatCurrency(surchargeAmount)}</Text>
                </View>
              )}
              <View style={styles.taxRow}>
                <Text style={[styles.taxLabel, { color: colors.textMuted }]}>{t('calculators.cess')}</Text>
                <Text style={[styles.taxValue, { color: colors.danger }]}>{formatCurrency(cessAmount)}</Text>
              </View>
              <View style={[styles.taxDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.taxRow}>
                <Text style={[styles.taxLabelBold, { color: colors.text }]}>{t('calculators.totalTaxLiability')}</Text>
                <Text style={[styles.taxValueBold, { color: colors.danger }]}>{formatCurrency(totalTaxLiability)}</Text>
              </View>
            </View>

            {isProfit && totalTaxLiability > 0 && (
              <View style={[styles.effectiveRate, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.effectiveLabel, { color: colors.textMuted }]}>{t('calculators.effectiveTaxRate')}</Text>
                <Text style={[styles.effectiveValue, { color: colors.text }]}>{effectiveTaxRate}%</Text>
              </View>
            )}

            {/* Net Proceeds */}
            <View style={[styles.proceedsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="cash-outline" size={18} color={colors.primary} />
              <View style={styles.proceedsContent}>
                <Text style={[styles.proceedsLabel, { color: colors.textMuted }]}>{t('calculators.netProceeds')}</Text>
                <Text style={[styles.proceedsValue, { color: colors.text }]}>
                  {formatCurrency(grossProfit - totalTaxLiability)}
                </Text>
              </View>
            </View>
          </View>

          {/* Inputs */}
          <View style={[styles.formCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('calculators.tradeDetails')}</Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('calculators.purchasePrice')}</Text>
              <TextInput
                style={[styles.input, inputStyle(purchasePrice)]}
                value={purchasePrice}
                onChangeText={setPurchasePrice}
                keyboardType="decimal-pad"
                placeholder="e.g. 1500"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('calculators.salePrice')}</Text>
              <TextInput
                style={[styles.input, inputStyle(salePrice)]}
                value={salePrice}
                onChangeText={setSalePrice}
                keyboardType="decimal-pad"
                placeholder="e.g. 1850"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('calculators.quantity')}</Text>
              <TextInput
                style={[styles.input, inputStyle(quantity)]}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="e.g. 100"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.presetRow}>
                {[10, 50, 100, 500].map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={[styles.presetChip, { backgroundColor: colors.bgCard, borderColor: quantity === String(q) ? colors.primary : colors.border }]}
                    onPress={() => setQuantity(String(q))}
                  >
                    <Text style={[styles.presetChipText, { color: quantity === String(q) ? colors.primary : colors.textMuted }]}>{t('app.shares', { count: q })}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Summary */}
          {grossProfit !== 0 && (
            <View style={[styles.summaryCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('calculators.investmentSummary')}</Text>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>{t('calculators.totalInvestment')}</Text>
                  <Text style={[styles.summaryItemValue, { color: colors.text }]}>{formatCurrency(totalInvestment)}</Text>
                </View>
                <View style={[styles.summaryItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>{t('calculators.totalSaleValue')}</Text>
                  <Text style={[styles.summaryItemValue, { color: colors.text }]}>{formatCurrency(totalSaleValue)}</Text>
                </View>
              </View>
              <View style={[styles.summaryRow]}>
                <View style={[styles.summaryItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>{t('calculators.quantityLabel')}</Text>
                  <Text style={[styles.summaryItemValue, { color: colors.text }]}>{t('app.shares', { count: qty })}</Text>
                </View>
                <View style={[styles.summaryItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <Text style={[styles.summaryItemLabel, { color: colors.textMuted }]}>{t('calculators.holding')}</Text>
                  <Text style={[styles.summaryItemValue, { color: isSTCG ? colors.danger : colors.accent }]}>
                    {isSTCG ? t('calculators.shortTerm') : t('calculators.longTerm')}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.secondary} style={{ marginRight: 8 }} />
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              {t('calculators.taxInfo')}
            </Text>
          </View>
        </ScrollView>
      </AppScreen>
  );
}

const styles = StyleSheet.create({
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
  fieldLabel: { fontSize: FONTS.size.sm, fontFamily: FONTS.medium.fontFamily, fontWeight: FONTS.medium.fontWeight, marginBottom: 8 },
  // Toggle
  toggleCard: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg },
  toggleRow: { flexDirection: 'row', borderRadius: BORDER_RADIUS.md, borderWidth: 1, overflow: 'hidden' },
  toggleOption: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: BORDER_RADIUS.sm },
  toggleText: { fontSize: FONTS.size.sm, fontFamily: FONTS.semiBold.fontFamily, fontWeight: FONTS.semiBold.fontWeight },
  hintText: { fontSize: FONTS.size.xs, fontFamily: FONTS.regular.fontFamily, marginTop: 8, lineHeight: 16 },
  // Result
  resultCard: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.xl },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 4 },
  resultLabel: { fontSize: FONTS.size.sm, fontFamily: FONTS.regular.fontFamily },
  profitBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: BORDER_RADIUS.full },
  profitBadgeText: { fontSize: FONTS.size.xs, fontFamily: FONTS.bold.fontFamily, fontWeight: FONTS.bold.fontWeight },
  gainAmount: { fontSize: FONTS.size.hero, fontFamily: FONTS.bold.fontFamily, fontWeight: FONTS.bold.fontWeight, letterSpacing: -0.5, marginBottom: SPACING.md },
  resultDivider: { height: 1, width: '100%', marginBottom: SPACING.md },
  taxBreakdown: { width: '100%', gap: 8 },
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taxLabel: { fontSize: FONTS.size.sm, fontFamily: FONTS.regular.fontFamily },
  taxValue: { fontSize: FONTS.size.sm, fontFamily: FONTS.semiBold.fontFamily, fontWeight: FONTS.semiBold.fontWeight },
  taxLabelBold: { fontSize: FONTS.size.sm, fontFamily: FONTS.semiBold.fontFamily, fontWeight: FONTS.semiBold.fontWeight },
  taxValueBold: { fontSize: FONTS.size.md, fontFamily: FONTS.bold.fontFamily, fontWeight: FONTS.bold.fontWeight },
  taxDivider: { height: 1, marginVertical: 2 },
  effectiveRate: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, marginTop: SPACING.md, width: '100%' },
  effectiveLabel: { fontSize: FONTS.size.sm, fontFamily: FONTS.regular.fontFamily },
  effectiveValue: { fontSize: FONTS.size.md, fontFamily: FONTS.bold.fontFamily, fontWeight: FONTS.bold.fontWeight },
  proceedsCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: SPACING.md, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, marginTop: SPACING.md, width: '100%' },
  proceedsContent: { flex: 1 },
  proceedsLabel: { fontSize: FONTS.size.xs, fontFamily: FONTS.regular.fontFamily },
  proceedsValue: { fontSize: FONTS.size.md, fontFamily: FONTS.semiBold.fontFamily, fontWeight: FONTS.semiBold.fontWeight, marginTop: 2 },
  // Form
  formCard: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg },
  fieldGroup: { marginBottom: SPACING.md },
  input: { height: 48, borderRadius: BORDER_RADIUS.md, borderWidth: 1, paddingHorizontal: SPACING.md, fontSize: FONTS.size.lg, fontFamily: FONTS.medium.fontFamily, fontWeight: FONTS.medium.fontWeight },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  presetChipText: { fontSize: FONTS.size.xs, fontFamily: FONTS.medium.fontFamily, fontWeight: FONTS.medium.fontWeight },
  sectionTitle: { fontSize: FONTS.size.md, fontFamily: FONTS.semiBold.fontFamily, fontWeight: FONTS.semiBold.fontWeight, marginBottom: SPACING.md },
  // Summary
  summaryCard: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  summaryItem: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.sm, borderWidth: 1 },
  summaryItemLabel: { fontSize: FONTS.size.xs, fontFamily: FONTS.regular.fontFamily, marginBottom: 4 },
  summaryItemValue: { fontSize: FONTS.size.md, fontFamily: FONTS.semiBold.fontFamily, fontWeight: FONTS.semiBold.fontWeight },
  // Info
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', padding: SPACING.md, borderRadius: BORDER_RADIUS.sm, borderWidth: 1 },
  infoText: { flex: 1, fontSize: FONTS.size.xs, fontFamily: FONTS.regular.fontFamily, lineHeight: 18 },
});
