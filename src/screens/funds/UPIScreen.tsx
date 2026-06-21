import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Dimensions, Alert, ActivityIndicator, Share, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { useFundStore } from '../../store/fundStore';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { COLORS, SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency} from '../../utils/formatters';

const { width } = Dimensions.get('window');

const UPI_PRESETS = [500, 1000, 2000, 5000];

interface UPILinkedAccount {
  upiId: string;
  bankName: string;
  accountNumber: string;
  isPrimary: boolean;
}

const LINKED_UPI_ACCOUNTS: UPILinkedAccount[] = [
  { upiId: 'rahul@hdfc', bankName: 'HDFC Bank', accountNumber: 'XXXX1234', isPrimary: true },
  { upiId: 'rahul.sharma@paytm', bankName: 'Paytm Payments Bank', accountNumber: 'XXXX5678', isPrimary: false },
  { upiId: 'rahul@icici', bankName: 'ICICI Bank', accountNumber: 'XXXX9012', isPrimary: false },
];

const RECENT_UPI_CONTACTS = [
  { name: 'Priya Patel', upiId: 'priya@paytm', avatar: 'P' },
  { name: 'Amit Singh', upiId: 'amit@hdfc', avatar: 'A' },
  { name: 'Neha Gupta', upiId: 'neha@icici', avatar: 'N' },
];

export default function UPIScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, updateBalance } = useAuthStore();
  const { addTransaction } = useFundStore();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedUPI, setSelectedUPI] = useState(LINKED_UPI_ACCOUNTS[0].upiId);
  const [payeeUPI, setPayeeUPI] = useState('');
  const [activeContact, setActiveContact] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [showManageUPI, setShowManageUPI] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [txId, setTxId] = useState('');
  const [showAddUPI, setShowAddUPI] = useState(false);
  const [newUPIId, setNewUPIId] = useState('');
  const [upiAccounts, setUpiAccounts] = useState(LINKED_UPI_ACCOUNTS);

  const displayAmount = selectedAmount !== null
    ? selectedAmount
    : (customAmount ? parseInt(customAmount.replace(/,/g, '')) || 0 : 0);

  const currentBalance = user?.balance || 2500000;

  const selectedUPIData = upiAccounts.find(a => a.upiId === selectedUPI);

  const handlePresetPress = useCallback((amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  }, []);

  const handleCustomAmountChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setCustomAmount(cleaned);
    if (cleaned) setSelectedAmount(null);
  }, []);

  const handleContactSelect = useCallback((contact: typeof RECENT_UPI_CONTACTS[0]) => {
    setPayeeUPI(contact.upiId);
    setActiveContact(contact.upiId);
  }, []);

  const handlePay = useCallback(() => {
    if (!payeeUPI || !payeeUPI.includes('@')) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g., name@bank).');
      return;
    }
    if (displayAmount < 1) {
      Alert.alert('Enter Amount', 'Please enter an amount to pay.');
      return;
    }
    if (displayAmount > 100000) {
      Alert.alert('Limit Exceeded', 'Maximum UPI transaction limit is ₹1,00,000 per transaction.');
      return;
    }
    if (displayAmount > currentBalance) {
      Alert.alert('Insufficient Balance', 'You do not have enough balance for this payment.');
      return;
    }

    const contactName = RECENT_UPI_CONTACTS.find(c => c.upiId === payeeUPI)?.name || payeeUPI;

    Alert.alert(
      'Confirm Payment',
      `Pay ${formatCurrency(displayAmount)} to ${contactName} (${payeeUPI})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay ₹' + displayAmount.toLocaleString('en-IN'),
          style: 'default',
          onPress: () => {
            setIsProcessing(true);
            const transactionId = 'UPI' + Date.now().toString(36).toUpperCase();
            setTxId(transactionId);
            setTimeout(() => {
              setIsProcessing(false);
              updateBalance(-displayAmount);
              addTransaction({
                type: 'withdraw',
                amount: displayAmount,
                method: `UPI (${selectedUPI})`,
                account: payeeUPI,
                status: 'completed',
                transactionId,
              });
              setIsSuccess(true);
            }, 2000);
          },
        },
      ]
    );
  }, [payeeUPI, displayAmount, currentBalance, selectedUPI, updateBalance, addTransaction]);

  const handleDone = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleCopyUPI = useCallback((upiId: string) => {
    Share.share({ message: `My UPI ID: ${upiId}` });
  }, []);

  const handleAddUPI = useCallback(() => {
    if (!newUPIId.includes('@')) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g., name@bank).');
      return;
    }
    const newAccount: UPILinkedAccount = {
      upiId: newUPIId,
      bankName: 'Other Bank',
      accountNumber: 'XXXX0000',
      isPrimary: false,
    };
    setUpiAccounts(prev => [...prev, newAccount]);
    setNewUPIId('');
    setShowAddUPI(false);
    Alert.alert('UPI ID Added', `${newUPIId} has been linked successfully.`);
  }, [newUPIId]);

  if (isSuccess) {
    return (
      <View style={[styles.container, styles.successContainer]}>
        <View style={styles.successContent}>
          <View style={styles.successIconWrap}>
            <LinearGradient colors={GRADIENTS.accent} style={styles.successIconBg}>
              <Ionicons name="checkmark-circle" size={48} color={COLORS.white} />
            </LinearGradient>
          </View>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successAmount}>{formatCurrency(displayAmount)}</Text>
          <Text style={styles.successDesc}>
            paid to {RECENT_UPI_CONTACTS.find(c => c.upiId === payeeUPI)?.name || payeeUPI}
          </Text>
          <View style={styles.successDetails}>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Transaction ID</Text>
              <Text style={styles.successValue}>{txId}</Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>From</Text>
              <Text style={styles.successValue}>{selectedUPI}</Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>To</Text>
              <Text style={styles.successValue}>{payeeUPI}</Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Remaining Balance</Text>
              <Text style={styles.successValue}>{formatCurrency(currentBalance - displayAmount)}</Text>
            </View>
          </View>
          {__DEV__ && (
            <TouchableOpacity
              style={styles.viewHistoryBtn}
              onPress={() => navigation.navigate('TransactionHistory')}
            >
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.viewHistoryText}>View Transaction History</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
            <LinearGradient colors={GRADIENTS.accent} style={styles.doneBtnGradient}>
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
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.bgCard }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>UPI Payment</Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.bgCard }]}
          onPress={() => setShowManageUPI(!showManageUPI)}
          testID="manage-upi-toggle"
        >
          <Ionicons name="qr-code-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* UPI ID Selector */}
        <LinearGradient colors={GRADIENTS.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.upiCard}>
          <View style={styles.upiHeaderRow}>
            <View style={styles.upiInfo}>
              <Text style={styles.upiLabel}>Paying from</Text>
              <View style={styles.upiSelector}>
                <Text style={styles.upiIdText}>{selectedUPI}</Text>
                <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.7)" />
              </View>
              {selectedUPIData && (
                <Text style={styles.upiBankText}>
                  {selectedUPIData.bankName} • {selectedUPIData.accountNumber}
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.upiQRBtn} onPress={() => Alert.alert('Scan QR', 'Camera opens to scan UPI QR code')}>
              <Ionicons name="scan-outline" size={28} color={COLORS.white} />
              <Text style={styles.upiQRText}>Scan</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Manage UPI IDs Dropdown */}
        {showManageUPI && (
          <View style={[styles.upiManageWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Linked UPI IDs</Text>
            {upiAccounts.map(acc => (
              <TouchableOpacity
                key={acc.upiId}
                style={[styles.upiAccountItem, { borderBottomColor: colors.divider }]}
                onPress={() => { setSelectedUPI(acc.upiId); setShowManageUPI(false); }}
              >
                <View style={[styles.upiAccountRadio, selectedUPI === acc.upiId && { borderColor: colors.primary }]}>
                  {selectedUPI === acc.upiId && (
                    <View style={[styles.upiAccountRadioInner, { backgroundColor: colors.primary }]} />
                  )}
                </View>
                <View style={styles.upiAccountInfo}>
                  <View style={styles.upiAccountNameRow}>
                    <Text style={[styles.upiAccountId, { color: colors.text }]}>{acc.upiId}</Text>
                    {acc.isPrimary && (
                      <View style={[styles.primaryBadge, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.primaryBadgeText, { color: colors.primary }]}>Primary</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.upiAccountDetail, { color: colors.textMuted }]}>
                    {acc.bankName} • {acc.accountNumber}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleCopyUPI(acc.upiId)}>
                  <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            {showAddUPI ? (
              <View style={[styles.addUPIForm, { borderTopColor: colors.divider }]}>
                <TextInput
                  style={[styles.addUPIInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
                  placeholder="Enter UPI ID (e.g., name@bank)"
                  placeholderTextColor={colors.textMuted}
                  value={newUPIId}
                  onChangeText={setNewUPIId}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.addUPIActions}>
                  <TouchableOpacity
                    style={[styles.addUPICancel, { borderColor: colors.border }]}
                    onPress={() => { setShowAddUPI(false); setNewUPIId(''); }}
                  >
                    <Text style={[styles.addUPICancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addUPIConfirm, { backgroundColor: colors.primary }]}
                    onPress={handleAddUPI}
                  >
                    <Text style={styles.addUPIConfirmText}>Link UPI ID</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addUPIBtn, { borderTopColor: colors.divider }]}
                onPress={() => setShowAddUPI(true)}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.addUPIBtnText, { color: colors.primary }]}>Link New UPI ID</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Pay To */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Pay To</Text>
          <View style={[styles.payeeInputWrap, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <Ionicons name="person-outline" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.payeeInput, { color: colors.text }]}
              placeholder="Enter UPI ID (e.g., name@bank)"
              placeholderTextColor={colors.textMuted}
              value={payeeUPI}
              onChangeText={text => { setPayeeUPI(text); setActiveContact(null); }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            {payeeUPI.length > 0 && (
              <TouchableOpacity onPress={() => { setPayeeUPI(''); setActiveContact(null); }}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Recent Contacts */}
        {payeeUPI.length === 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Contacts</Text>
            <View style={styles.contactsRow}>
              {RECENT_UPI_CONTACTS.map(contact => (
                <TouchableOpacity
                  key={contact.upiId}
                  style={styles.contactItem}
                  onPress={() => handleContactSelect(contact)}
                >
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.contactAvatar}
                  >
                    <Text style={styles.contactAvatarText}>{contact.avatar}</Text>
                  </LinearGradient>
                  <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>{contact.name}</Text>
                  <Text style={[styles.contactUPI, { color: colors.textMuted }]} numberOfLines={1}>{contact.upiId}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Payee Info Card */}
        {activeContact && payeeUPI === activeContact && (
          <View style={[styles.payeeCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <View>
              <Text style={[styles.payeeCardName, { color: colors.text }]}>
                {RECENT_UPI_CONTACTS.find(c => c.upiId === activeContact)?.name}
              </Text>
              <Text style={[styles.payeeCardUPI, { color: colors.textMuted }]}>{activeContact}</Text>
            </View>
          </View>
        )}

        {/* Amount */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Amount</Text>
          <View style={styles.presetsRow}>
            {UPI_PRESETS.map(amount => (
              <AnimatedPressable
                key={amount}
                haptic="light"
                scaleTo={0.95}
                onPress={() => handlePresetPress(amount)}
              >
                <View style={[styles.presetBtn, { backgroundColor: colors.bgCard, borderColor: colors.border },
                  selectedAmount === amount && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                ]}>
                  <Text style={[styles.presetText, { color: colors.textSecondary },
                    selectedAmount === amount && { color: colors.primary },
                  ]}>
                    {formatCurrency(amount, true)}
                  </Text>
                </View>
              </AnimatedPressable>
            ))}
          </View>

          <View style={[styles.customInputWrap, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>₹</Text>
            <TextInput
              style={[styles.customInput, { color: colors.text }]}
              placeholder="Enter amount"
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
            <View style={[styles.totalRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>You will pay</Text>
              <Text style={[styles.totalValue, { color: colors.primary }]}>{formatCurrency(displayAmount)}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={[styles.infoBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={18} color={colors.warning} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            UPI payments are processed instantly. No additional charges apply. Max ₹1,00,000 per transaction.
          </Text>
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={[styles.payBtn, (displayAmount < 1 || !payeeUPI) && styles.payBtnDisabled]}
          onPress={handlePay}
          disabled={displayAmount < 1 || !payeeUPI || isProcessing}
        >
          <LinearGradient
            colors={displayAmount >= 1 && payeeUPI ? GRADIENTS.accent : ['#666', '#555']}
            style={styles.payBtnGradient}
          >
            {isProcessing ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={22} color={COLORS.white} />
                <Text style={styles.payBtnText}>
                  {!payeeUPI ? 'Enter UPI ID' : displayAmount < 1 ? 'Enter Amount' : `Pay ${formatCurrency(displayAmount)}`}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xl,
  },

  // UPI Card
  upiCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  upiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  upiInfo: {
    flex: 1,
  },
  upiLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  upiSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  upiIdText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: COLORS.white,
  },
  upiBankText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  upiQRBtn: {
    alignItems: 'center',
    gap: 4,
    paddingLeft: SPACING.lg,
  },
  upiQRText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: COLORS.white,
  },

  // Manage UPI
  upiManageWrap: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  upiAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.md,
  },
  upiAccountRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiAccountRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  upiAccountInfo: {
    flex: 1,
  },
  upiAccountNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  upiAccountId: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
  },
  primaryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  primaryBadgeText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  upiAccountDetail: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 2,
  },
  addUPIForm: {
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    gap: SPACING.md,
  },
  addUPIInput: {
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    fontSize: FONTS.size.md,
  },
  addUPIActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  addUPICancel: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  addUPICancelText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  addUPIConfirm: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  addUPIConfirmText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: COLORS.white,
  },
  addUPIBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
  },
  addUPIBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },

  // Payee
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    marginBottom: SPACING.md,
  },
  payeeInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  payeeInput: {
    flex: 1,
    paddingVertical: SPACING.lg,
    fontSize: FONTS.size.md,
  },

  // Contacts
  contactsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  contactItem: {
    alignItems: 'center',
    width: (width - 40 - 32) / 3,
    gap: 4,
  },
  contactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactAvatarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: COLORS.white,
  },
  contactName: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    marginTop: 4,
    textAlign: 'center',
  },
  contactUPI: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    textAlign: 'center',
  },

  // Payee Card
  payeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  payeeCardName: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
  },
  payeeCardUPI: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 2,
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
    borderWidth: 1,
  },
  presetText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },

  // Custom Amount
  customInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  currencySymbol: {
    ...FONTS.medium,
    fontSize: FONTS.size.xl,
    marginRight: SPACING.sm,
  },
  customInput: {
    flex: 1,
    paddingVertical: SPACING.lg,
    fontSize: FONTS.size.xl,
    fontFamily: 'System',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  totalLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
  totalValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },

  // Info
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
  },
  infoText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    flex: 1,
    lineHeight: 18,
  },

  // Pay Button
  payBtn: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
  payBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: SPACING.sm,
  },
  payBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
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
  viewHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  viewHistoryText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
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
});
