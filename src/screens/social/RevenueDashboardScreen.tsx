import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Alert, Platform,
  KeyboardAvoidingView, Modal,
} from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRevenueStore } from '../../store/revenueStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { RevenueTransaction, PayoutRequest, RevenueSource } from '../../types';

/** Format currency in INR */
const formatINR = (val: number) =>
  '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** Format relative time */
function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** Format date */  
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RevenueDashboardScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { dashboard, requestPayout, refresh } = useRevenueStore();
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'payouts'>('overview');

  const barMax = useMemo(() => {
    if (dashboard.monthlyHistory.length === 0) return 1;
    return Math.max(...dashboard.monthlyHistory.map(m => m.total), 1);
  }, [dashboard.monthlyHistory]);

  const sourceEntries = useMemo(() =>
    Object.entries(dashboard.breakdownBySource) as [RevenueSource, typeof dashboard.breakdownBySource[RevenueSource]][],
    [dashboard.breakdownBySource]
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Revenue Dashboard</Text>
          <Text style={styles.subtitle}>Track your creator earnings</Text>
        </View>

        {/* ── Earnings Summary Cards ── */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: '#6C63FF' }]}>
            <Text style={styles.summaryLabel}>Net Earnings</Text>
            <Text style={[styles.summaryValue, { color: '#6C63FF' }]}>{formatINR(dashboard.netEarnings)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#00C853' }]}>
            <Text style={styles.summaryLabel}>Paid Out</Text>
            <Text style={[styles.summaryValue, { color: '#00C853' }]}>{formatINR(dashboard.totalPaidOut)}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: '#FFC107' }]}>
            <Text style={styles.summaryLabel}>Pending Balance</Text>
            <Text style={[styles.summaryValue, { color: '#FFC107' }]}>{formatINR(dashboard.pendingBalance)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#FF6B6B' }]}>
            <Text style={styles.summaryLabel}>Total Fees</Text>
            <Text style={[styles.summaryValue, { color: '#FF6B6B' }]}>{formatINR(dashboard.totalFees)}</Text>
          </View>
        </View>

        {/* Payout CTA */}
        {dashboard.pendingBalance >= 100 && (
          <AnimatedPressable
            onPress={() => setShowPayoutModal(true)}
            haptic="medium"
            scaleTo={0.97}
          >
            <View style={styles.payoutCta}>
              <Ionicons name="wallet-outline" size={22} color="#fff" />
              <View>
                <Text style={styles.payoutCtaTitle}>
                  Withdraw {formatINR(dashboard.pendingBalance)}
                </Text>
                <Text style={styles.payoutCtaSub}>Available for payout (min ₹100)</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </View>
          </AnimatedPressable>
        )}

        {/* Tab Bar */}
        <View style={styles.tabRow}>
          {(['overview', 'transactions', 'payouts'] as const).map(tab => (
            <AnimatedPressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              haptic="selection"
              scaleTo={0.94}
            >
              <View style={[
                styles.tabChip,
                activeTab === tab && { backgroundColor: colors.primary + '25', borderColor: colors.primary },
              ]}>
                <Text style={[
                  styles.tabChipText,
                  activeTab === tab && { color: colors.primary },
                ]}>
                  {tab === 'overview' ? 'Overview' : tab === 'transactions' ? 'Transactions' : 'Payout History'}
                </Text>
              </View>
            </AnimatedPressable>
          ))}
        </View>

        {/* ── Tab Content ── */}
        {activeTab === 'overview' && (
          <>
            {/* Breakdown by Source */}
            <Animated.View entering={FadeInDown.springify()} style={styles.section}>
              <Text style={styles.sectionTitle}>Earnings by Source</Text>
              <View style={styles.sourceGrid}>
                {sourceEntries.map(([source, data]) => {
                  const percent = dashboard.netEarnings > 0
                    ? Math.round((data.amount / dashboard.netEarnings) * 100)
                    : 0;
                  return (
                    <View key={source} style={styles.sourceCard}>
                      <View style={[styles.sourceIcon, { backgroundColor: data.color + '20' }]}>
                        <Ionicons name={data.icon as any} size={20} color={data.color} />
                      </View>
                      <Text style={styles.sourceLabel}>{data.label}</Text>
                      <Text style={styles.sourceAmount}>{formatINR(data.amount)}</Text>
                      <View style={styles.sourceBarBg}>
                        <View style={[styles.sourceBarFill, { width: `${percent}%`, backgroundColor: data.color }]} />
                      </View>
                      <Text style={styles.sourcePercent}>{percent}%</Text>
                      <Text style={styles.sourceCount}>{data.count} transactions</Text>
                    </View>
                  );
                })}
              </View>
            </Animated.View>

            {/* Monthly Chart */}
            {dashboard.monthlyHistory.length > 0 && (
              <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.section}>
                <Text style={styles.sectionTitle}>Monthly Earnings</Text>
                <View style={styles.chartContainer}>
                  <View style={styles.chartBars}>
                    {dashboard.monthlyHistory.slice(0, 6).map((month, idx) => {
                      const height = Math.max((month.total / barMax) * 140, 8);
                      return (
                        <View key={idx} style={styles.chartCol}>
                          <Text style={styles.chartValue}>{formatINR(month.total)}</Text>
                          <View style={[styles.chartBar, { height, backgroundColor: colors.primary }]} />
                          <Text style={styles.chartLabel}>{month.month.split(' ')[0]}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </Animated.View>
            )}
          </>
        )}

        {activeTab === 'transactions' && (
          <Animated.View entering={FadeInDown.springify()}>
            {dashboard.recentTransactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No transactions yet</Text>
              </View>
            ) : (
              dashboard.recentTransactions.map((txn, idx) => (
                <Animated.View
                  key={txn.id}
                  entering={FadeInDown.delay(idx * 30).springify()}
                  layout={LinearTransition.springify()}
                >
                  <TransactionRow txn={txn} colors={colors} styles={styles} />
                </Animated.View>
              ))
            )}
          </Animated.View>
        )}

        {activeTab === 'payouts' && (
          <Animated.View entering={FadeInDown.springify()}>
            {dashboard.payoutHistory.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cash-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No payouts yet</Text>
              </View>
            ) : (
              dashboard.payoutHistory.map((payout, idx) => (
                <Animated.View
                  key={payout.id}
                  entering={FadeInDown.delay(idx * 30).springify()}
                  layout={LinearTransition.springify()}
                >
                  <PayoutRow payout={payout} colors={colors} styles={styles} />
                </Animated.View>
              ))
            )}
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Payout Modal */}
      <PayoutModal
        visible={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        maxAmount={dashboard.pendingBalance}
        onRequestPayout={requestPayout}
        colors={colors}
        styles={styles}
      />
    </View>
  );
}

// ─── Transaction Row Component ────────────────────────────────────────────

const SOURCE_ICONS: Record<RevenueSource, string> = {
  courses: 'school',
  referrals: 'gift',
  tips: 'heart',
  subscriptions: 'diamond',
  commissions: 'cash',
};

function TransactionRow({ txn, colors, styles }: { txn: RevenueTransaction; colors: any; styles: any }) {
  return (
    <View style={[styles.txnCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.txnLeft}>
        <View style={[styles.txnIcon, { backgroundColor: txn.source === 'courses' ? '#6C63FF20' : txn.source === 'referrals' ? '#00C85320' : txn.source === 'tips' ? '#FF6B6B20' : txn.source === 'subscriptions' ? '#3B82F620' : '#FFC10720' }]}>
          <Ionicons name={SOURCE_ICONS[txn.source] as any} size={18} color={
            txn.source === 'courses' ? '#6C63FF' : txn.source === 'referrals' ? '#00C853' : txn.source === 'tips' ? '#FF6B6B' : txn.source === 'subscriptions' ? '#3B82F6' : '#FFC107'
          } />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.txnDesc} numberOfLines={1}>{txn.description}</Text>
          <Text style={styles.txnTime}>{formatRelativeTime(txn.createdAt)}</Text>
        </View>
      </View>
      <View style={styles.txnRight}>
        <Text style={styles.txnAmount}>+{formatINR(txn.netAmount)}</Text>
        {txn.paidOut && <Text style={styles.paidOutBadge}>Paid</Text>}
      </View>
    </View>
  );
}

// ─── Payout Row Component ─────────────────────────────────────────────────

function PayoutRow({ payout, colors, styles }: { payout: PayoutRequest; colors: any; styles: any }) {
  const statusColor = payout.status === 'completed' ? '#00C853' : 
    payout.status === 'processing' ? '#FFC107' :
    payout.status === 'failed' ? '#FF5252' : '#6C63FF';

  return (
    <View style={[styles.txnCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.txnLeft}>
        <View style={[styles.txnIcon, { backgroundColor: statusColor + '20' }]}>
          <Ionicons name="cash-outline" size={18} color={statusColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.txnDesc}>{payout.method} → {payout.destination}</Text>
          <Text style={styles.txnTime}>{formatDate(payout.requestedAt)}</Text>
        </View>
      </View>
      <View style={styles.txnRight}>
        <Text style={[styles.txnAmount, { color: statusColor }]}>-{formatINR(payout.amount)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Payout Modal ─────────────────────────────────────────────────────────

function PayoutModal({
  visible, onClose, maxAmount, onRequestPayout, colors, styles,
}: {
  visible: boolean;
  onClose: () => void;
  maxAmount: number;
  onRequestPayout: (amount: number, method: string, destination: string) => Promise<boolean>;
  colors: any;
  styles: any;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  const [upiId, setUpiId] = useState('rahul@upi');
  const [isProcessing, setIsProcessing] = useState(false);

  const numericAmount = parseInt(amount) || 0;
  const isValid = numericAmount >= 100 && numericAmount <= maxAmount;

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsProcessing(true);
    const dest = method === 'upi' ? upiId : 'HDFC ****1234';
    await onRequestPayout(numericAmount, method === 'upi' ? 'UPI' : 'Bank Transfer', dest);
    setIsProcessing(false);
    onClose();
    Alert.alert('Payout Requested', `₹${numericAmount.toLocaleString('en-IN')} will be transferred to your ${method === 'upi' ? 'UPI' : 'bank account'} within 24-48 hours.`);
  };

  const quickAmounts = [500, 1000, 2000, 5000];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalContent, { backgroundColor: colors.bgSecondary }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Payout</Text>
            <AnimatedPressable onPress={onClose} haptic="light" scaleTo={0.88}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </AnimatedPressable>
          </View>

          <Text style={styles.inputLabel}>Amount (₹)</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="Enter amount"
            placeholderTextColor={colors.textMuted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
          />
          <Text style={styles.maxHint}>
            Available: {formatINR(maxAmount)} · Min: ₹100
          </Text>

          {/* Quick Amounts */}
          <View style={styles.quickAmountRow}>
            {quickAmounts.map(qa => (
              <AnimatedPressable
                key={qa}
                onPress={() => setAmount(String(qa))}
                haptic="selection"
                scaleTo={0.92}
              >
                <View style={[styles.quickAmountChip, numericAmount === qa && { backgroundColor: colors.primary + '25', borderColor: colors.primary }]}>
                  <Text style={[styles.quickAmountText, numericAmount === qa && { color: colors.primary }]}>
                    {formatINR(qa)}
                  </Text>
                </View>
              </AnimatedPressable>
            ))}
          </View>

          {/* Method */}
          <Text style={[styles.inputLabel, { marginTop: SPACING.md }]}>Method</Text>
          <View style={styles.methodRow}>
            <AnimatedPressable onPress={() => setMethod('upi')} haptic="selection" scaleTo={0.94}>
              <View style={[styles.methodCard, method === 'upi' && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                <Ionicons name="phone-portrait" size={20} color={method === 'upi' ? colors.primary : colors.textMuted} />
                <Text style={[styles.methodText, method === 'upi' && { color: colors.primary }]}>UPI</Text>
              </View>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => setMethod('bank')} haptic="selection" scaleTo={0.94}>
              <View style={[styles.methodCard, method === 'bank' && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                <Ionicons name="business" size={20} color={method === 'bank' ? colors.primary : colors.textMuted} />
                <Text style={[styles.methodText, method === 'bank' && { color: colors.primary }]}>Bank</Text>
              </View>
            </AnimatedPressable>
          </View>

          {method === 'upi' && (
            <>
              <Text style={styles.inputLabel}>UPI ID</Text>
              <TextInput
                style={styles.amountInput}
                value={upiId}
                onChangeText={setUpiId}
                autoCapitalize="none"
              />
            </>
          )}

          {/* Submit */}
          <AnimatedPressable
            onPress={handleSubmit}
            haptic="medium"
            scaleTo={0.97}
            disabled={!isValid || isProcessing}
          >
            <View style={[styles.submitBtn, !isValid && { opacity: 0.5 }, isProcessing && { opacity: 0.7 }]}>
              <Ionicons name={isProcessing ? 'hourglass' : 'send'} size={18} color="#fff" />
              <Text style={styles.submitBtnText}>
                {isProcessing ? 'Processing...' : `Request ${formatINR(numericAmount)}`}
              </Text>
            </View>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    paddingTop: 60,
    marginBottom: SPACING.lg,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
  },
  summaryLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  summaryValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    marginTop: 4,
  },
  payoutCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: colors.primary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  payoutCtaTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
    flex: 1,
  },
  payoutCtaSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tabChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  sourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  sourceCard: {
    width: '48%',
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sourceLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  sourceAmount: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  sourceBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: colors.bgCardLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  sourceBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  sourcePercent: {
    ...FONTS.medium,
    fontSize: 10,
    color: colors.textSecondary,
  },
  sourceCount: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
  },
  chartContainer: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 180,
  },
  chartCol: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  chartValue: {
    ...FONTS.medium,
    fontSize: 9,
    color: colors.textMuted,
  },
  chartBar: {
    width: 24,
    borderRadius: 4,
  },
  chartLabel: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 4,
  },
  txnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  txnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txnDesc: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  txnTime: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  txnRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txnAmount: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
    color: colors.marketUp,
  },
  paidOutBadge: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    ...FONTS.medium,
    fontSize: 9,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.md,
  },
  emptyText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  inputLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  amountInput: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    fontSize: FONTS.size.lg,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  maxHint: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 4,
  },
  quickAmountRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  quickAmountChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickAmountText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  methodRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  methodCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: colors.primary,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xl,
  },
  submitBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },
});
