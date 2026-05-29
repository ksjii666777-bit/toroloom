import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { useFundStore } from '../../store/fundStore';
import { COLORS, SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';

const { width } = Dimensions.get('window');

const WITHDRAW_PRESETS = [5000, 10000, 25000, 50000];

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  isPrimary: boolean;
}

const LINKED_BANKS: BankAccount[] = [
  { id: '1', bankName: 'HDFC Bank', accountNumber: 'XXXX1234', ifsc: 'HDFC0001234', isPrimary: true },
  { id: '2', bankName: 'ICICI Bank', accountNumber: 'XXXX5678', ifsc: 'ICIC0005678', isPrimary: false },
];

export default function WithdrawScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, updateBalance } = useAuthStore();
  const { addTransaction } = useFundStore();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedBank, setSelectedBank] = useState(LINKED_BANKS[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [txId, setTxId] = useState('');

  const currentBalance = user?.balance || 0;
  const displayAmount = selectedAmount !== null
    ? selectedAmount
    : (customAmount ? parseInt(customAmount.replace(/,/g, '')) || 0 : 0);
  const remaining = currentBalance - displayAmount;

  const handlePresetPress = useCallback((amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  }, []);

  const handleCustomAmountChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setCustomAmount(cleaned);
    if (cleaned) setSelectedAmount(null);
  }, []);

  const handleMaxPress = useCallback(() => {
    setSelectedAmount(currentBalance);
    setCustomAmount('');
  }, [currentBalance]);

  const handleWithdraw = useCallback(() => {
    if (displayAmount < 500) {
      Alert.alert('Minimum Amount', 'Minimum withdrawal amount is ₹500');
      return;
    }
    if (displayAmount > currentBalance) {
      Alert.alert('Insufficient Balance', 'You cannot withdraw more than your available balance.');
      return;
    }

    Alert.alert(
      'Confirm Withdrawal',
      `Are you sure you want to withdraw ${formatCurrency(displayAmount)} to ${LINKED_BANKS.find(b => b.id === selectedBank)?.bankName} ${LINKED_BANKS.find(b => b.id === selectedBank)?.accountNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: () => {
            setIsLoading(true);
            const transactionId = 'WDR' + Date.now().toString(36).toUpperCase();
            setTxId(transactionId);
            setTimeout(() => {
              setIsLoading(false);
              updateBalance(-displayAmount);
              addTransaction({
                type: 'withdraw',
                amount: displayAmount,
                method: LINKED_BANKS.find(b => b.id === selectedBank)?.bankName || 'Bank',
                account: LINKED_BANKS.find(b => b.id === selectedBank)?.accountNumber,
                status: 'completed',
                transactionId,
              });
              setIsSuccess(true);
            }, 1500);
          },
        },
      ]
    );
  }, [displayAmount, currentBalance, selectedBank, updateBalance, addTransaction]);

  const handleDone = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleViewHistory = useCallback(() => {
    navigation.navigate('TransactionHistory');
  }, [navigation]);

  if (isSuccess) {
    return (
      <View style={[styles.container, styles.successContainer]}>
        <View style={styles.successContent}>
          <View style={styles.successIconWrap}>
            <LinearGradient colors={GRADIENTS.danger} style={styles.successIconBg}>
              <Ionicons name="checkmark-circle" size={48} color={COLORS.white} />
            </LinearGradient>
          </View>
          <Text style={styles.successTitle}>Withdrawal Initiated!</Text>
          <Text style={styles.successAmount}>{formatCurrency(displayAmount)}</Text>
          <Text style={styles.successDesc}>
            will be credited to your bank account within 1-2 business days.
          </Text>
          <View style={styles.successDetails}>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Transaction ID</Text>
              <Text style={styles.successValue}>{txId}</Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Bank Account</Text>
              <Text style={styles.successValue}>
                {LINKED_BANKS.find(b => b.id === selectedBank)?.bankName}{' '}
                {LINKED_BANKS.find(b => b.id === selectedBank)?.accountNumber}
              </Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>New Balance</Text>
              <Text style={[styles.successValue, { color: colors.text }]}>
                {formatCurrency(currentBalance - displayAmount)}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.doneBtnGradient}>
              <Text style={styles.doneBtnText}>Done</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.viewHistoryBtn} onPress={handleViewHistory}>
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={styles.viewHistoryText}>View Transaction History</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Withdraw Funds</Text>
        <TouchableOpacity onPress={() => navigation.navigate('TransactionHistory')}>
          <Ionicons name="time-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Balance Card */}
        <LinearGradient colors={GRADIENTS.danger} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>{formatCurrency(currentBalance)}</Text>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceSubLabel}>Withdrawable Amount</Text>
              <Text style={styles.balanceSubValue}>{formatCurrency(currentBalance)}</Text>
            </View>
            <Ionicons name="cash" size={32} color="rgba(255,255,255,0.3)" />
          </View>
        </LinearGradient>

        {/* Withdrawal Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Withdrawal Amount</Text>
          <View style={styles.presetsRow}>
            {WITHDRAW_PRESETS.map(amount => (
              <TouchableOpacity
                key={amount}
                style={[
                  styles.presetBtn,
                  selectedAmount === amount && styles.presetBtnActive,
                ]}
                onPress={() => handlePresetPress(amount)}
              >
                <Text style={[
                  styles.presetText,
                  selectedAmount === amount && styles.presetTextActive,
                ]}>
                  {formatCurrency(amount, true)}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.presetBtn, selectedAmount === currentBalance && styles.presetBtnActive]}
              onPress={handleMaxPress}
            >
              <Text style={[
                styles.presetText,
                selectedAmount === currentBalance && styles.presetTextActive,
              ]}>
                MAX
              </Text>
            </TouchableOpacity>
          </View>

          {/* Custom Amount */}
          <View style={styles.customInputWrap}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.customInput}
              placeholder="Enter withdrawal amount"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={customAmount}
              onChangeText={handleCustomAmountChange}
            />
            {customAmount.length > 0 && (
              <TouchableOpacity onPress={() => { setCustomAmount(''); setSelectedAmount(null); }}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {displayAmount > 0 && (
            <View style={styles.breakdownCard}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Current Balance</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(currentBalance)}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Withdrawal Amount</Text>
                <Text style={[styles.breakdownValue, { color: COLORS.danger }]}>
                  - {formatCurrency(displayAmount)}
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Remaining Balance</Text>
                <Text style={[
                  styles.breakdownValue,
                  { color: remaining >= 0 ? COLORS.success : COLORS.danger },
                ]}>
                  {remaining >= 0 ? formatCurrency(remaining) : 'Insufficient'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Linked Bank Accounts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transfer To</Text>
            <TouchableOpacity>
              <Text style={styles.addBankText}>+ Add Bank</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.banksWrap}>
            {LINKED_BANKS.map(bank => (
              <TouchableOpacity
                key={bank.id}
                style={[
                  styles.bankItem,
                  selectedBank === bank.id && styles.bankItemActive,
                ]}
                onPress={() => setSelectedBank(bank.id)}
              >
                <View style={[
                  styles.bankIcon,
                  { backgroundColor: selectedBank === bank.id ? colors.primary + '20' : colors.bgInput },
                ]}>
                  <Ionicons
                    name="business"
                    size={20}
                    color={selectedBank === bank.id ? colors.primary : colors.textMuted}
                  />
                </View>
                <View style={styles.bankInfo}>
                  <View style={styles.bankNameRow}>
                    <Text style={[
                      styles.bankName,
                      selectedBank === bank.id && { color: colors.text },
                    ]}>
                      {bank.bankName}
                    </Text>
                    {bank.isPrimary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.bankAccount}>{bank.accountNumber}</Text>
                  <Text style={styles.bankIfsc}>IFSC: {bank.ifsc}</Text>
                </View>
                <View style={[
                  styles.radio,
                  selectedBank === bank.id && styles.radioActive,
                ]}>
                  {selectedBank === bank.id && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color={colors.warning} />
          <Text style={styles.infoText}>
            Withdrawals are processed within 1-2 business days. A nominal fee of ₹9 + GST applies on withdrawals above ₹50,000.
          </Text>
        </View>

        {/* Withdraw Button */}
        <TouchableOpacity
          style={[styles.withdrawBtn, (displayAmount < 500 || displayAmount > currentBalance) ? styles.withdrawBtnDisabled : null]}
          onPress={handleWithdraw}
          disabled={displayAmount < 500 || displayAmount > currentBalance || isLoading}
        >
          <LinearGradient
            colors={
              displayAmount >= 500 && displayAmount <= currentBalance
                ? GRADIENTS.danger
                : ['#666', '#555']
            }
            style={styles.withdrawBtnGradient}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <>
                <Ionicons name="arrow-up-circle" size={22} color={COLORS.white} />
                <Text style={styles.withdrawBtnText}>
                  Withdraw {displayAmount >= 500 ? formatCurrency(displayAmount) : '₹500+'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    backgroundColor: colors.bg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xl,
    color: colors.text,
  },

  // Success
  successContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  successContent: {
    alignItems: 'center',
    width: '100%',
  },
  successIconWrap: {
    marginBottom: SPACING.xl,
  },
  successIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.text,
    marginBottom: SPACING.sm,
  },
  successAmount: {
    ...FONTS.bold,
    fontSize: FONTS.size.display,
    color: COLORS.danger,
    marginBottom: SPACING.md,
  },
  successDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xxl,
  },
  successDetails: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xxl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  successLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  successValue: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  successDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: SPACING.xs,
  },
  doneBtn: {
    width: '100%',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  doneBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: SPACING.sm,
  },
  doneBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: COLORS.white,
  },

  // Balance Card
  balanceCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
  balanceLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  balanceValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxxl,
    color: COLORS.white,
    marginTop: 4,
  },
  balanceDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: SPACING.md,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceSubLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.6)',
  },
  balanceSubValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: COLORS.white,
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: SPACING.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  addBankText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },

  // Amount Presets
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  presetBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetBtnActive: {
    backgroundColor: colors.danger + '20',
    borderColor: COLORS.danger,
  },
  presetText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  presetTextActive: {
    color: COLORS.danger,
  },

  // Custom Amount
  customInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACING.md,
  },
  currencySymbol: {
    ...FONTS.medium,
    fontSize: FONTS.size.xl,
    color: colors.textSecondary,
    marginRight: SPACING.sm,
  },
  customInput: {
    flex: 1,
    paddingVertical: SPACING.lg,
    fontSize: FONTS.size.xl,
    color: colors.text,
    fontFamily: 'System',
  },

  // Breakdown
  breakdownCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  breakdownLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  breakdownValue: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: SPACING.sm,
  },

  // Banks
  banksWrap: {
    gap: SPACING.sm,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bankItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.bgSecondary,
  },
  bankIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  bankNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bankName: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
  },
  primaryBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  primaryBadgeText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.primary,
  },
  bankAccount: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  bankIfsc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },

  // Info
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  // Withdraw Button
  withdrawBtn: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  withdrawBtnDisabled: {
    opacity: 0.6,
  },
  withdrawBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: SPACING.sm,
  },
  withdrawBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: COLORS.white,
  },
  viewHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  viewHistoryText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
});
