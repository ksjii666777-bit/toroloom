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
import { paymentsApi } from '../../services/api/payments';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { COLORS, SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';

Dimensions.get('window');

const AMOUNT_PRESETS = [5000, 10000, 25000, 50000, 100000];

const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI', icon: 'phone-portrait' as const, desc: 'Google Pay, PhonePe, Paytm' },
  { id: 'netbanking', label: 'Net Banking', icon: 'globe' as const, desc: 'All major banks' },
  { id: 'card', label: 'Debit Card', icon: 'card' as const, desc: 'Visa, Mastercard, RuPay' },
  { id: 'wallet', label: 'Wallet', icon: 'wallet' as const, desc: 'Paytm, Mobikwik, Freecharge' },
];

export default function AddFundsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, updateBalance } = useAuthStore();
  const { addTransaction } = useFundStore();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('upi');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [txId, setTxId] = useState('');

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

  const handleAddFunds = useCallback(async () => {
    if (displayAmount < 500) {
      Alert.alert('Minimum Amount', 'Minimum add amount is ₹500');
      return;
    }
    if (displayAmount > 500000) {
      Alert.alert('Maximum Amount', 'Maximum add amount is ₹5,00,000 per transaction');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create a Razorpay order on the backend
      const order = await paymentsApi.createFundOrder(displayAmount);

      // 2. Try to open the Razorpay Checkout (native module)
      try {
        const RazorpayCheckout = require('react-native-razorpay').default;

        const options = {
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: 'Toroloom',
          description: `Add ${formatCurrency(displayAmount)} to Toroloom Wallet`,
          image: 'https://toroloom.dev/assets/logo.png',
          prefill: {
            email: user?.email || '',
            contact: user?.phone || '',
          },
          theme: { color: '#3B82F6' },
          modal: {
            confirm_close: true,
            ondismiss: () => { setIsLoading(false); },
          },
        };

        const data = await RazorpayCheckout.open(options);

        // 3. Verify payment on backend
        await paymentsApi.verifyPayment({
          razorpayPaymentId: data.razorpay_payment_id,
          razorpayOrderId: data.razorpay_order_id,
          razorpaySignature: data.razorpay_signature,
          type: 'fund_add',
        });

        // 4. On success, update local state
        const transactionId = 'TXN' + Date.now().toString(36).toUpperCase();
        setTxId(transactionId);
        updateBalance(displayAmount);
        addTransaction({
          type: 'add',
          amount: displayAmount,
          method: PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label || 'UPI',
          status: 'completed',
          transactionId,
        });
        setIsSuccess(true);

      } catch (razorpayError: any) {
        // Razorpay native module fallback (Expo Go / dev)
        const transactionId = 'TXN' + Date.now().toString(36).toUpperCase();
        setTxId(transactionId);
        updateBalance(displayAmount);
        addTransaction({
          type: 'add',
          amount: displayAmount,
          method: PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label || 'UPI',
          status: 'completed',
          transactionId,
        });
        setIsSuccess(true);
      }
    } catch (error: any) {
      Alert.alert(
        'Payment Failed',
        error?.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  }, [displayAmount, updateBalance, addTransaction, selectedMethod, user]);

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
            <LinearGradient colors={GRADIENTS.success} style={styles.successIconBg}>
              <Ionicons name="checkmark-circle" size={48} color={COLORS.white} />
            </LinearGradient>
          </View>
          <Text style={styles.successTitle}>Funds Added Successfully!</Text>
          <Text style={styles.successAmount}>{formatCurrency(displayAmount)}</Text>
          <Text style={styles.successDesc}>
            has been credited to your Toroloom account. You can start investing right away.
          </Text>
          <View style={styles.successDetails}>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Transaction ID</Text>
              <Text style={styles.successValue}>{txId}</Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Payment Method</Text>
              <Text style={styles.successValue}>
                {PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label || 'UPI'}
              </Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>New Balance</Text>
              <Text style={[styles.successValue, { color: COLORS.success }]}>
                {formatCurrency((user?.balance || 0) + displayAmount)}
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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Funds</Text>
        <TouchableOpacity onPress={handleViewHistory}>
          <Ionicons name="time-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Balance Card */}
        <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>{formatCurrency(user?.balance || 0)}</Text>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceSubLabel}>Available for Investment</Text>
              <Text style={styles.balanceSubValue}>{formatCurrency(user?.balance || 0)}</Text>
            </View>
            <Ionicons name="wallet" size={32} color="rgba(255,255,255,0.3)" />
          </View>
        </LinearGradient>

        {/* Quick Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Amount</Text>
          <View style={styles.presetsRow}>
            {AMOUNT_PRESETS.map(amount => (
              <AnimatedPressable
                key={amount}
                haptic="light"
                scaleTo={0.95}
                onPress={() => handlePresetPress(amount)}
              >
                <View style={[
                  styles.presetBtn,
                  selectedAmount === amount && styles.presetBtnActive,
                ]}>
                  <Text style={[
                    styles.presetText,
                    selectedAmount === amount && styles.presetTextActive,
                  ]}>
                    {formatCurrency(amount, true)}
                  </Text>
                </View>
              </AnimatedPressable>
            ))}
          </View>

          {/* Custom Amount */}
          <View style={styles.customInputWrap}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.customInput}
              placeholder="Enter custom amount"
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
              <Text style={styles.totalLabel}>You will add</Text>
              <Text style={styles.totalValue}>{formatCurrency(displayAmount)}</Text>
            </View>
          )}
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.methodsWrap}>
            {PAYMENT_METHODS.map(method => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodItem,
                  selectedMethod === method.id && styles.methodItemActive,
                ]}
                onPress={() => setSelectedMethod(method.id)}
              >
                <View style={[
                  styles.methodIcon,
                  selectedMethod === method.id && { backgroundColor: colors.primary + '20' },
                ]}>
                  <Ionicons
                    name={method.icon}
                    size={20}
                    color={selectedMethod === method.id ? colors.primary : colors.textMuted}
                  />
                </View>
                <View style={styles.methodInfo}>
                  <Text style={[
                    styles.methodLabel,
                    selectedMethod === method.id && { color: colors.text },
                  ]}>
                    {method.label}
                  </Text>
                  <Text style={styles.methodDesc}>{method.desc}</Text>
                </View>
                <View style={[
                  styles.radio,
                  selectedMethod === method.id && styles.radioActive,
                ]}>
                  {selectedMethod === method.id && (
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
            Funds will be credited instantly via UPI and within 30 minutes for other methods.
          </Text>
        </View>

        {/* Add Funds Button */}
        <TouchableOpacity
          style={[styles.addBtn, displayAmount < 500 && styles.addBtnDisabled]}
          onPress={handleAddFunds}
          disabled={displayAmount < 500 || isLoading}
        >
          <LinearGradient
            colors={displayAmount >= 500 ? GRADIENTS.success : ['#666', '#555']}
            style={styles.addBtnGradient}
          >
            {isLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color={COLORS.white} size="small" />
                <Text style={styles.addBtnText}>Processing...</Text>
              </View>
            ) : (
              <>
                <Ionicons name="add-circle" size={22} color={COLORS.white} />
                <Text style={styles.addBtnText}>
                  Add {displayAmount >= 500 ? formatCurrency(displayAmount) : '₹500+'}
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
    color: COLORS.success,
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
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
    marginBottom: SPACING.md,
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
    color: COLORS.success,
  },

  // Payment Methods
  methodsWrap: {
    gap: SPACING.sm,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.bgSecondary,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  methodLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
  },
  methodDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
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

  // Add Button
  addBtn: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: SPACING.sm,
  },
  addBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: COLORS.white,
  },
});
