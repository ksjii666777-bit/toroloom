import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Dimensions, Alert, ActivityIndicator, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { useFundStore } from '../../store/fundStore';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { COLORS, SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';

const { width } = Dimensions.get('window');

const TRANSFER_PRESETS = [1000, 5000, 10000, 25000];

type TransferTab = 'internal' | 'external';

interface InternalAccount {
  id: string;
  label: string;
  type: string;
  balance: number;
}

const INTERNAL_ACCOUNTS: InternalAccount[] = [
  { id: 'trading', label: 'Trading Account', type: 'Trading', balance: 2500000 },
  { id: 'demats', label: 'Demat Account', type: 'Demat', balance: 0 },
];

const LINKED_BANKS = [
  { id: 'b1', bankName: 'HDFC Bank', accountNumber: 'XXXX1234', ifsc: 'HDFC0001234', isPrimary: true },
  { id: 'b2', bankName: 'ICICI Bank', accountNumber: 'XXXX5678', ifsc: 'ICIC0005678', isPrimary: false },
];

export default function TransferScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, updateBalance } = useAuthStore();
  const { addTransaction } = useFundStore();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<TransferTab>('internal');
  const [fromAccount, setFromAccount] = useState('trading');
  const [toAccount, setToAccount] = useState('demats');
  const [selectedBank, setSelectedBank] = useState(LINKED_BANKS[0].id);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [txId, setTxId] = useState('');

  const fromData = INTERNAL_ACCOUNTS.find(a => a.id === fromAccount);
  const toData = INTERNAL_ACCOUNTS.find(a => a.id === toAccount);
  const currentBalance = activeTab === 'internal'
    ? (fromData?.balance || 0)
    : (user?.balance || 0);

  const displayAmount = selectedAmount !== null
    ? selectedAmount
    : (customAmount ? parseInt(customAmount.replace(/,/g, '')) || 0 : 0);

  const handlePresetPress = useCallback((amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  }, []);

  const handleCustomAmountChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setCustomAmount(cleaned);
    if (cleaned) setSelectedAmount(null);
  }, []);

  const handleTransfer = useCallback(() => {
    if (displayAmount < 100) {
      Alert.alert('Minimum Amount', 'Minimum transfer amount is ₹100');
      return;
    }
    if (displayAmount > currentBalance) {
      Alert.alert('Insufficient Balance', 'You do not have enough balance for this transfer.');
      return;
    }

    if (activeTab === 'internal' && fromAccount === toAccount) {
      Alert.alert('Same Account', 'Source and destination accounts must be different.');
      return;
    }

    const destination = activeTab === 'internal'
      ? toData?.label || 'Demat Account'
      : LINKED_BANKS.find(b => b.id === selectedBank)?.bankName || 'Bank Account';

    Alert.alert(
      'Confirm Transfer',
      `Transfer ${formatCurrency(displayAmount)} from ${fromData?.label || 'Trading Account'} to ${destination}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: () => {
            setIsLoading(true);
            const transactionId = 'TRF' + Date.now().toString(36).toUpperCase();
            setTxId(transactionId);
            setTimeout(() => {
              setIsLoading(false);
              updateBalance(-displayAmount);
              addTransaction({
                type: 'withdraw',
                amount: displayAmount,
                method: activeTab === 'internal' ? 'Internal Transfer' : (LINKED_BANKS.find(b => b.id === selectedBank)?.bankName || 'Bank'),
                account: activeTab === 'external' ? LINKED_BANKS.find(b => b.id === selectedBank)?.accountNumber : undefined,
                status: 'completed',
                transactionId,
              });
              setIsSuccess(true);
            }, 1500);
          },
        },
      ]
    );
  }, [displayAmount, currentBalance, activeTab, fromAccount, toAccount, fromData, toData, selectedBank, updateBalance, addTransaction]);

  const handleDone = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (isSuccess) {
    return (
      <View style={[styles.container, styles.successContainer]}>
        <View style={styles.successContent}>
          <View style={styles.successIconWrap}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.successIconBg}>
              <Ionicons name="checkmark-circle" size={48} color={COLORS.white} />
            </LinearGradient>
          </View>
          <Text style={styles.successTitle}>Transfer Initiated!</Text>
          <Text style={styles.successAmount}>{formatCurrency(displayAmount)}</Text>
          <Text style={styles.successDesc}>
            has been transferred from {fromData?.label || 'Trading Account'} to{' '}
            {activeTab === 'internal'
              ? toData?.label || 'Demat Account'
              : LINKED_BANKS.find(b => b.id === selectedBank)?.bankName || 'Bank Account'}
            .
          </Text>
          <View style={styles.successDetails}>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Transaction ID</Text>
              <Text style={styles.successValue}>{txId}</Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>From</Text>
              <Text style={styles.successValue}>{fromData?.label || 'Trading Account'}</Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>To</Text>
              <Text style={styles.successValue}>
                {activeTab === 'internal'
                  ? toData?.label || 'Demat Account'
                  : LINKED_BANKS.find(b => b.id === selectedBank)?.bankName || 'Bank'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.doneBtnGradient}>
              <Text style={styles.doneBtnText}>Done</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transfer</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Tab Selector */}
        <View style={styles.tabRow}>
          {([
            { key: 'internal', label: 'To Self Account' },
            { key: 'external', label: 'To Bank Account' },
          ] as { key: TransferTab; label: string }[]).map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Balance Card */}
        <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>
            {activeTab === 'internal' ? `${fromData?.label || 'Account'} Balance` : 'Available Balance'}
          </Text>
          <Text style={styles.balanceValue}>{formatCurrency(currentBalance)}</Text>
          {activeTab === 'internal' && (
            <>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceRow}>
                <View>
                  <Text style={styles.balanceSubLabel}>{toData?.label || 'Destination'}</Text>
                  <Text style={styles.balanceSubValue}>Receiving Account</Text>
                </View>
                <Ionicons name="swap-horizontal" size={28} color="rgba(255,255,255,0.3)" />
              </View>
            </>
          )}
        </LinearGradient>

        {/* Account Selection (Internal) */}
        {activeTab === 'internal' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>From</Text>
            <View style={styles.accountsWrap}>
              {INTERNAL_ACCOUNTS.map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={[styles.accountItem, fromAccount === acc.id && styles.accountItemActive]}
                  onPress={() => setFromAccount(acc.id)}
                >
                  <View style={[styles.accountIcon, {
                    backgroundColor: fromAccount === acc.id ? colors.primary + '20' : colors.bgInput,
                  }]}>
                    <Ionicons
                      name={acc.id === 'trading' ? 'trending-up' : 'shield-checkmark'}
                      size={20}
                      color={fromAccount === acc.id ? colors.primary : colors.textMuted}
                    />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={[styles.accountLabel, fromAccount === acc.id && { color: colors.text }]}>
                      {acc.label}
                    </Text>
                    <Text style={styles.accountBalance}>{formatCurrency(acc.balance)}</Text>
                  </View>
                  <View style={[styles.radio, fromAccount === acc.id && styles.radioActive]}>
                    {fromAccount === acc.id && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>To</Text>
            <View style={styles.accountsWrap}>
              {INTERNAL_ACCOUNTS.filter(a => a.id !== fromAccount).map(acc => (
                <TouchableOpacity
                  key={acc.id}
                  style={[styles.accountItem, toAccount === acc.id && styles.accountItemActive]}
                  onPress={() => setToAccount(acc.id)}
                >
                  <View style={[styles.accountIcon, {
                    backgroundColor: toAccount === acc.id ? colors.primary + '20' : colors.bgInput,
                  }]}>
                    <Ionicons
                      name={acc.id === 'trading' ? 'trending-up' : 'shield-checkmark'}
                      size={20}
                      color={toAccount === acc.id ? colors.primary : colors.textMuted}
                    />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={[styles.accountLabel, toAccount === acc.id && { color: colors.text }]}>
                      {acc.label}
                    </Text>
                    <Text style={styles.accountBalance}>{formatCurrency(acc.balance)}</Text>
                  </View>
                  <View style={[styles.radio, toAccount === acc.id && styles.radioActive]}>
                    {toAccount === acc.id && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Bank Selection (External) */}
        {activeTab === 'external' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Transfer To</Text>
              <TouchableOpacity>
                <Text style={styles.addBankText}>+ Add Bank</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.accountsWrap}>
              {LINKED_BANKS.map(bank => (
                <TouchableOpacity
                  key={bank.id}
                  style={[styles.accountItem, selectedBank === bank.id && styles.accountItemActive]}
                  onPress={() => setSelectedBank(bank.id)}
                >
                  <View style={[styles.accountIcon, {
                    backgroundColor: selectedBank === bank.id ? colors.primary + '20' : colors.bgInput,
                  }]}>
                    <Ionicons name="business" size={20} color={selectedBank === bank.id ? colors.primary : colors.textMuted} />
                  </View>
                  <View style={styles.accountInfo}>
                    <View style={styles.bankNameRow}>
                      <Text style={[styles.accountLabel, selectedBank === bank.id && { color: colors.text }]}>
                        {bank.bankName}
                      </Text>
                      {bank.isPrimary && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>Primary</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.accountBalance}>{bank.accountNumber}</Text>
                  </View>
                  <View style={[styles.radio, selectedBank === bank.id && styles.radioActive]}>
                    {selectedBank === bank.id && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transfer Amount</Text>
          <View style={styles.presetsRow}>
            {TRANSFER_PRESETS.map(amount => (
              <AnimatedPressable
                key={amount}
                haptic="light"
                scaleTo={0.95}
                onPress={() => handlePresetPress(amount)}
              >
                <View style={[styles.presetBtn, selectedAmount === amount && styles.presetBtnActive]}>
                  <Text style={[styles.presetText, selectedAmount === amount && styles.presetTextActive]}>
                    {formatCurrency(amount, true)}
                  </Text>
                </View>
              </AnimatedPressable>
            ))}
          </View>

          <View style={styles.customInputWrap}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.customInput}
              placeholder="Enter transfer amount"
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
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>You will transfer</Text>
              <Text style={styles.totalValue}>{formatCurrency(displayAmount)}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color={colors.warning} />
          <Text style={styles.infoText}>
            {activeTab === 'internal'
              ? 'Internal transfers between your accounts are instant and free.'
              : 'Bank transfers are processed within 1-2 business days. Free for all transactions.'}
          </Text>
        </View>

        {/* Transfer Button */}
        <TouchableOpacity
          style={[styles.transferBtn, displayAmount < 100 && styles.transferBtnDisabled]}
          onPress={handleTransfer}
          disabled={displayAmount < 100 || isLoading}
        >
          <LinearGradient
            colors={displayAmount >= 100 ? GRADIENTS.primary : ['#666', '#555']}
            style={styles.transferBtnGradient}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <>
                <Ionicons name="swap-horizontal" size={22} color={COLORS.white} />
                <Text style={styles.transferBtnText}>
                  Transfer {displayAmount >= 100 ? formatCurrency(displayAmount) : '₹100+'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
    </TouchableWithoutFeedback>
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

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: COLORS.white,
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
    color: colors.primary,
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
    marginBottom: SPACING.md,
  },
  addBankText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },

  // Account Selection
  accountsWrap: {
    gap: SPACING.sm,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.bgSecondary,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  accountLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
  },
  accountBalance: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  bankNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
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

  // Presets
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
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  presetText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  presetTextActive: {
    color: colors.primary,
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
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  totalValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.primary,
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

  // Transfer Button
  transferBtn: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  transferBtnDisabled: {
    opacity: 0.6,
  },
  transferBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: SPACING.sm,
  },
  transferBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: COLORS.white,
  },
});
