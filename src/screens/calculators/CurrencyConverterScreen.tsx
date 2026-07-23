/**
 * ============================================================================
 * Toroloom — Currency Converter Screen
 * ============================================================================
 *
 * Standalone screen for currency conversion, accessible from the More menu.
 * Reuses the converter logic from CurrencyConverterModal but as a full-screen
 * view with its own header, live rates badge, and scrollable layout.
 *
 * Navigation: More → Currency Converter
 * ============================================================================
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Platform, Dimensions,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import {
  CURRENCIES,
  getCurrency,
  formatCurrencyAmount,
  type RecentConversion,
} from '../../utils/currencyConverter';
import { useLiveConversion } from '../../hooks/useLiveConversion';

const { width } = Dimensions.get('window');

export default function CurrencyConverterScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // ── State ─────────────────────────────────────────────────────────────────
  const [fromCode, setFromCode] = useState('USD');
  const [toCode, setToCode] = useState('INR');
  const [amountStr, setAmountStr] = useState('1');
  const [recentConversions, setRecentConversions] = useState<RecentConversion[]>([]);

  // ── Live forex rates ──────────────────────────────────────────────────────
  const {
    getLiveCurrencyRate, convertWithLive, getLiveCurrency,
    isLive, isLoading: ratesLoading, lastUpdated, refresh,
  } = useLiveConversion();

  const amount = parseFloat(amountStr) || 0;
  const result = convertWithLive(amount, fromCode, toCode);
  const rate = convertWithLive(1, fromCode, toCode);
  const inverseRate = convertWithLive(1, toCode, fromCode);
  const fromCurrency = getLiveCurrency(fromCode);
  const toCurrency = getLiveCurrency(toCode);

  const handleSwap = useCallback(() => {
    setFromCode(toCode);
    setToCode(fromCode);
  }, [fromCode, toCode]);

  const handleConvert = useCallback(() => {
    if (amount <= 0) return;
    const conversion: RecentConversion = {
      from: fromCode,
      to: toCode,
      amount,
      result,
      rate,
      timestamp: Date.now(),
    };
    setRecentConversions(prev => [conversion, ...prev.filter(c => c.timestamp !== conversion.timestamp)].slice(0, 5));
  }, [amount, fromCode, toCode, result, rate]);

  const selectableCurrencies = useMemo(() =>
    fromCode === 'INR'
      ? CURRENCIES.filter(c => c.code !== 'INR')
      : CURRENCIES,
    [fromCode],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, {
        paddingTop: insets.top + 12,
        backgroundColor: colors.bgSecondary,
        borderBottomColor: colors.border,
      }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Currency Converter</Text>
              {/* Live / Mock badge */}
              <View style={[styles.liveBadge, {
                backgroundColor: isLive ? '#00E67620' : '#FF525220',
                borderColor: isLive ? '#00E67640' : '#FF525240',
              }]}>
                <View style={[styles.liveDot, {
                  backgroundColor: isLive ? '#00E676' : '#FF5252',
                }]} />
                <Text style={[styles.liveBadgeText, {
                  color: isLive ? '#00E676' : '#FF5252',
                }]}>
                  {ratesLoading ? 'Loading…' : isLive ? 'Live' : 'Mock'}
                </Text>
              </View>
            </View>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Real-time cross rates</Text>
            {lastUpdated && (
              <Text style={[styles.updatedText, { color: colors.textMuted }]}>
                Updated {new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(lastUpdated)}
              </Text>
            )}
          </View>
          {/* Refresh button */}
          <Pressable onPress={refresh} style={[styles.refreshBtn, { backgroundColor: colors.bgCard }]}>
            <Ionicons name="refresh" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Amount Input */}
        <View style={[styles.convAmountRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <Text style={[styles.convAmountSymbol, { color: fromCurrency.color }]}>{fromCurrency.symbol}</Text>
          <TextInput
            style={[styles.convAmountInput, { color: colors.text }]}
            value={amountStr}
            onChangeText={setAmountStr}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.textMuted}
            selectTextOnFocus
          />
          <Text style={[styles.convAmountCode, { color: colors.textMuted }]}>{fromCode}</Text>
        </View>

        {/* From Currency Picker */}
        <Text style={[styles.convPickerLabel, { color: colors.textMuted }]}>From</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.convPickerScroll}>
          {CURRENCIES.map(cur => {
            const selected = fromCode === cur.code;
            return (
              <Pressable
                key={cur.code}
                onPress={() => { setFromCode(cur.code); }}
                style={[
                  styles.convChip,
                  {
                    backgroundColor: selected ? cur.color + '25' : colors.bgInput,
                    borderColor: selected ? cur.color + '50' : colors.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 16 }}>{cur.icon}</Text>
                <Text style={[
                  styles.convChipText,
                  { color: selected ? cur.color : colors.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
                ]}>
                  {cur.code}
                </Text>
                {selected && (
                  <View style={[styles.convSelectedDot, { backgroundColor: cur.color }]} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Swap + Rate Display */}
        <View style={styles.convRateRow}>
          <View style={[styles.convRateBox, { backgroundColor: colors.bgInput }]}>
            <Text style={[styles.convRateLabel, { color: colors.textMuted }]}>1 {fromCode} =</Text>
            <Text style={[styles.convRateValue, { color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
              {rate.toFixed(6)} {toCode}
            </Text>
          </View>
          <Pressable onPress={handleSwap} style={[styles.convSwapBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
            <Ionicons name="swap-vertical" size={22} color={colors.primary} />
          </Pressable>
        </View>

        {/* To Currency Picker */}
        <Text style={[styles.convPickerLabel, { color: colors.textMuted }]}>To</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.convPickerScroll}>
          {selectableCurrencies.map(cur => {
            const selected = toCode === cur.code;
            return (
              <Pressable
                key={cur.code}
                onPress={() => { setToCode(cur.code); }}
                style={[
                  styles.convChip,
                  {
                    backgroundColor: selected ? cur.color + '25' : colors.bgInput,
                    borderColor: selected ? cur.color + '50' : colors.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 16 }}>{cur.icon}</Text>
                <Text style={[
                  styles.convChipText,
                  { color: selected ? cur.color : colors.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
                ]}>
                  {cur.code}
                </Text>
                {selected && (
                  <View style={[styles.convSelectedDot, { backgroundColor: cur.color }]} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Result Display */}
        <View style={[styles.convResultCard, { backgroundColor: toCurrency.color + '12', borderColor: toCurrency.color + '30' }]}>
          <View style={styles.convResultHeader}>
            <Text style={{ fontSize: 28 }}>{toCurrency.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.convResultLabel, { color: colors.textMuted }]}>Converted Amount</Text>
              <Text style={[styles.convResultValue, { color: toCurrency.color }]}>
                {toCurrency.symbol}{result.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </Text>
            </View>
            <Text style={[styles.convResultCode, { color: toCurrency.color }]}>{toCode}</Text>
          </View>
          <View style={[styles.convResultDivider, { backgroundColor: toCurrency.color + '20' }]} />
          <View style={styles.convResultFooter}>
            <Text style={[styles.convResultMeta, { color: colors.textMuted }]}>
              1 {toCode} = {inverseRate.toFixed(6)} {fromCode}
            </Text>
            <Text style={[styles.convResultMeta, { color: colors.textMuted }]}>
              Via {getCurrency('INR').symbol}1 = {fromCurrency.symbol}{convertWithLive(1, 'INR', fromCode).toFixed(4)}
            </Text>
          </View>
        </View>

        {/* Convert Button */}
        <Pressable
          onPress={handleConvert}
          disabled={amount <= 0}
          style={[styles.convConvertBtn, { backgroundColor: amount <= 0 ? colors.textMuted + '60' : colors.primary, opacity: amount <= 0 ? 0.5 : 1 }]}
        >
          <Ionicons name="bookmark" size={16} color="#fff" />
          <Text style={styles.convConvertText}>Save Conversion</Text>
        </Pressable>

        {/* Recent Conversions */}
        {recentConversions.length > 0 && (
          <View style={styles.convRecentSection}>
            <Text style={[styles.convRecentTitle, { color: colors.text }]}>Recent</Text>
            {recentConversions.map((conv, i) => {
              const fC = getCurrency(conv.from);
              const tC = getCurrency(conv.to);
              return (
                <Pressable
                  key={conv.timestamp}
                  onPress={() => {
                    setFromCode(conv.from);
                    setToCode(conv.to);
                    setAmountStr(conv.amount.toString());
                  }}
                  style={[styles.convRecentRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                >
                  <View style={styles.convRecentLeft}>
                    <Text style={{ fontSize: 14 }}>{fC.icon}</Text>
                    <Text style={[styles.convRecentPair, { color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                      {conv.from} → {conv.to}
                    </Text>
                  </View>
                  <View style={styles.convRecentRight}>
                    <Text style={[styles.convRecentAmount, { color: colors.text }]}>
                      {formatCurrencyAmount(conv.amount, conv.from)}
                    </Text>
                    <Text style={[styles.convRecentResult, { color: tC.color, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                      {formatCurrencyAmount(conv.result, conv.to)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Favourite Pairs Quick Reference */}
        <Animated.View entering={FadeInUp.duration(400).delay(300)}>
          <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="information-circle" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>Quick Reference</Text>
              <Text style={[styles.infoText, { color: colors.textMuted }]}>
                Major INR rates: USD₹{getLiveCurrencyRate('USD').toFixed(2)} · EUR₹{getLiveCurrencyRate('EUR').toFixed(2)} · GBP₹{getLiveCurrencyRate('GBP').toFixed(2)} · JPY₹{getLiveCurrencyRate('JPY').toFixed(4)} · SGD₹{getLiveCurrencyRate('SGD').toFixed(2)}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {[
                  { from: 'USD', to: 'INR' },
                  { from: 'EUR', to: 'INR' },
                  { from: 'GBP', to: 'INR' },
                  { from: 'JPY', to: 'INR' },
                  { from: 'SGD', to: 'INR' },
                  { from: 'EUR', to: 'USD' },
                  { from: 'GBP', to: 'USD' },
                ].map(pair => (
                  <Pressable
                    key={`${pair.from}-${pair.to}`}
                    onPress={() => {
                      setFromCode(pair.from);
                      setToCode(pair.to);
                    }}
                    style={[styles.favChip, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                  >
                    <Text style={[styles.favChipText, { color: colors.textMuted }]}>
                      {pair.from}/{pair.to}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xl,
  },
  headerSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginTop: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveBadgeText: {
    ...FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  updatedText: {
    ...FONTS.regular,
    fontSize: 9,
    marginTop: 1,
  },
  scrollContent: {
    padding: SPACING.xl,
  },
  // Amount
  convAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: Platform.OS === 'ios' ? SPACING.lg : SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  convAmountSymbol: { ...FONTS.bold, fontSize: 24, marginRight: SPACING.sm },
  convAmountInput: { flex: 1, ...FONTS.bold, fontSize: 28, padding: 0 },
  convAmountCode: { ...FONTS.medium, fontSize: FONTS.size.sm, marginLeft: SPACING.sm },
  // Picker
  convPickerLabel: { ...FONTS.medium, fontSize: FONTS.size.xs, marginBottom: SPACING.xs },
  convPickerScroll: { marginBottom: SPACING.md },
  convChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  convChipText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  convSelectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  // Rate + Swap
  convRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  convRateBox: {
    flex: 1,
    flexDirection: 'column',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: 2,
  },
  convRateLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  convRateValue: { ...FONTS.bold, fontSize: FONTS.size.md },
  convSwapBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  // Result
  convResultCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  convResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  convResultLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  convResultValue: { ...FONTS.bold, fontSize: 26, marginTop: 2 },
  convResultCode: { ...FONTS.bold, fontSize: FONTS.size.lg },
  convResultDivider: { height: 1, marginVertical: SPACING.md },
  convResultFooter: { gap: 4 },
  convResultMeta: { ...FONTS.regular, fontSize: FONTS.size.xs, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  // Save Button
  convConvertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  convConvertText: { color: '#fff', ...FONTS.semiBold, fontSize: FONTS.size.sm },
  // Recent
  convRecentSection: { gap: SPACING.sm },
  convRecentTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  convRecentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  convRecentLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  convRecentPair: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  convRecentRight: { alignItems: 'flex-end', gap: 2 },
  convRecentAmount: { ...FONTS.regular, fontSize: FONTS.size.sm },
  convRecentResult: { ...FONTS.bold, fontSize: FONTS.size.sm },
  // Info
  infoCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  infoTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: 4 },
  infoText: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 16 },
  // Favourite chips
  favChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  favChipText: {
    ...FONTS.medium,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
