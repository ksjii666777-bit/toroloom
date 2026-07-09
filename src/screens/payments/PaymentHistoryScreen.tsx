/**
 * ============================================================================
 * Toroloom — Subscription Payment History Screen
 * ============================================================================
 *
 * Shows all subscription payments with receipts, invoice IDs, status badges,
 * coupon discounts, and payment method details.
 *
 * Navigated to from SubscriptionScreen → "Payment History" card.
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Share, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useSubscriptionStore, SUBSCRIPTION_PLANS } from '../../store/subscriptionStore';
import type { SubscriptionPayment } from '../../types';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

// ─── Mock Payment History (fallback if store is empty) ───────────────────────

function generateMockPayments(): SubscriptionPayment[] {
  const now = Date.now();
  return [
    {
      id: 'pay_001', planId: 'plan_elite', planName: 'Elite', tier: 'elite',
      amount: 999, currency: 'INR', status: 'completed', method: 'razorpay',
      billingPeriod: 'monthly', timestamp: new Date(now - 30 * 86400000).toISOString(),
      transactionId: 'TXNELITE001', invoiceId: 'INV-2026-001',
    },
    {
      id: 'pay_002', planId: 'plan_pro', planName: 'Pro', tier: 'pro',
      amount: 399, currency: 'INR', status: 'completed', method: 'razorpay',
      billingPeriod: 'monthly', timestamp: new Date(now - 60 * 86400000).toISOString(),
      transactionId: 'TXNPRO001', invoiceId: 'INV-2026-002',
    },
    {
      id: 'pay_003', planId: 'plan_elite', planName: 'Elite', tier: 'elite',
      amount: 9999, currency: 'INR', status: 'completed', method: 'razorpay',
      billingPeriod: 'yearly', timestamp: new Date(now - 90 * 86400000).toISOString(),
      transactionId: 'TXNELITE002', invoiceId: 'INV-2026-003',
      discountApplied: 1000, couponCode: 'SAVE20',
    },
    {
      id: 'pay_004', planId: 'plan_pro', planName: 'Pro', tier: 'pro',
      amount: 399, currency: 'INR', status: 'pending', method: 'upi_autopay',
      billingPeriod: 'monthly', timestamp: new Date(now - 5 * 86400000).toISOString(),
      transactionId: 'TXNAUTOPAY001',
    },
    {
      id: 'pay_005', planId: 'plan_elite', planName: 'Elite', tier: 'elite',
      amount: 999, currency: 'INR', status: 'failed', method: 'razorpay',
      billingPeriod: 'monthly', timestamp: new Date(now - 2 * 86400000).toISOString(),
      transactionId: 'TXNELITEFAILED001',
    },
  ];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const METHOD_ICONS: Record<string, string> = {
  razorpay: 'card-outline',
  upi_autopay: 'qr-code-outline',
  coupon: 'pricetag-outline',
};

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: string }> = {
  completed: { color: '#00E676', bgColor: '#00E67620', icon: 'checkmark-circle' },
  pending: { color: '#FFAB40', bgColor: '#FFAB4020', icon: 'time-outline' },
  failed: { color: '#FF5252', bgColor: '#FF525220', icon: 'close-circle' },
  refunded: { color: '#6C63FF', bgColor: '#6C63FF20', icon: 'arrow-undo-circle' },
};

function formatTransactionDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

// ─── PaymentRow Component ────────────────────────────────────────────────────

function PaymentRow({ payment, colors, styles: s }: { payment: SubscriptionPayment; colors: any; styles: any }) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
  const { date, time } = formatTransactionDate(payment.timestamp);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Toroloom Payment Receipt\n\nPlan: ${payment.planName}\nAmount: ₹${payment.amount.toLocaleString('en-IN')}\nStatus: ${payment.status}\nDate: ${date}\nTransaction ID: ${payment.transactionId}\nInvoice: ${payment.invoiceId || 'N/A'}`,
        title: `Payment Receipt — ${payment.planName}`,
      });
    } catch { /* ignore */ }
  }, [payment, date]);

  const plan = SUBSCRIPTION_PLANS.find(p => p.id === payment.planId);
  const planGradient = plan?.gradient || GRADIENTS.primary;

  return (
    <TouchableOpacity
      style={[s.paymentItem, expanded && s.paymentItemExpanded]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      {/* Main Row */}
      <View style={s.paymentRow}>
        <LinearGradient colors={planGradient as [string, string]} style={s.paymentIcon}>
          <Ionicons
            name={payment.tier === 'elite' ? 'diamond' : payment.tier === 'pro' ? 'flash' : 'rocket-outline'}
            size={18}
            color="#fff"
          />
        </LinearGradient>

        <View style={s.paymentInfo}>
          <Text style={s.paymentPlanName}>{payment.planName}</Text>
          <Text style={s.paymentPlanType}>{payment.billingPeriod === 'monthly' ? 'Monthly' : 'Yearly'} · via {payment.method === 'razorpay' ? 'Razorpay' : payment.method === 'upi_autopay' ? 'UPI AutoPay' : 'Coupon'}</Text>
        </View>

        <View style={s.paymentRight}>
          <Text style={[s.paymentAmount, { color: payment.status === 'completed' ? colors.text : statusCfg.color }]}>
            ₹{payment.amount.toLocaleString('en-IN')}
          </Text>
          <View style={[s.paymentStatusBadge, { backgroundColor: statusCfg.bgColor }]}>
            <Ionicons name={statusCfg.icon as keyof typeof Ionicons.glyphMap} size={10} color={statusCfg.color} />
            <Text style={[s.paymentStatusText, { color: statusCfg.color }]}>
              {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
            </Text>
          </View>
        </View>

        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </View>

      {/* Expanded Details */}
      {expanded && (
        <View style={s.paymentDetails}>
          <View style={s.detailDivider} />

          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Date</Text>
            <Text style={s.detailValue}>{date} at {time}</Text>
          </View>

          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Transaction ID</Text>
            <Text style={[s.detailValue, { fontFamily: 'monospace' }]}>{payment.transactionId}</Text>
          </View>

          {payment.invoiceId && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Invoice</Text>
              <Text style={s.detailValue}>{payment.invoiceId}</Text>
            </View>
          )}

          {payment.couponCode && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Coupon</Text>
              <View style={s.detailCouponBadge}>
                <Ionicons name="pricetag" size={10} color={colors.marketUp} />
                <Text style={[s.detailValue, { color: colors.marketUp }]}>{payment.couponCode}</Text>
              </View>
            </View>
          )}

          {payment.discountApplied && payment.discountApplied > 0 && (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Discount</Text>
              <Text style={[s.detailValue, { color: colors.marketUp }]}>
                -₹{payment.discountApplied.toLocaleString('en-IN')}
              </Text>
            </View>
          )}

          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Amount Charged</Text>
            <Text style={[s.detailValue, { ...FONTS.semiBold, fontSize: FONTS.size.md }]}>
              ₹{(payment.amount - (payment.discountApplied || 0)).toLocaleString('en-IN')}
            </Text>
          </View>

          {/* Actions */}
          <View style={s.detailActions}>
            {payment.status === 'completed' && (
              <AnimatedPressable onPress={handleShare} haptic="light" scaleTo={0.95}>
                <View style={s.detailActionBtn}>
                  <Ionicons name="share-outline" size={14} color={colors.primary} />
                  <Text style={s.detailActionText}>Share Receipt</Text>
                </View>
              </AnimatedPressable>
            )}

            {payment.status === 'failed' && (
              <AnimatedPressable onPress={() => Alert.alert('Retry Payment', 'Payment retry will be initiated.')} haptic="light" scaleTo={0.95}>
                <View style={[s.detailActionBtn, { borderColor: colors.danger + '30' }]}>
                  <Ionicons name="refresh" size={14} color={colors.danger} />
                  <Text style={[s.detailActionText, { color: colors.danger }]}>Retry Payment</Text>
                </View>
              </AnimatedPressable>
            )}

            {payment.invoiceId && (
              <AnimatedPressable onPress={() => Alert.alert('Download Invoice', `Invoice ${payment.invoiceId} will be downloaded.`)} haptic="light" scaleTo={0.95}>
                <View style={s.detailActionBtn}>
                  <Ionicons name="download-outline" size={14} color={colors.primary} />
                  <Text style={s.detailActionText}>Download Invoice</Text>
                </View>
              </AnimatedPressable>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function PaymentHistoryScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { paymentHistory, subscription } = useSubscriptionStore();

  // Use store history if available, otherwise use mock data
  const payments = useMemo(() => {
    const storePayments = subscription.payments || [];
    const mockPayments = generateMockPayments();

    // Merge — store payments take precedence, fill with mock
    if (storePayments.length > 0) return storePayments;
    return mockPayments;
  }, [subscription.payments]);

  // Stats
  const stats = useMemo(() => {
    let totalSpent = 0;
    let totalDiscounts = 0;
    let completed = 0;
    let pending = 0;
    let failed = 0;
    for (const p of payments) {
      totalSpent += p.amount;
      totalDiscounts += p.discountApplied || 0;
      if (p.status === 'completed') completed++;
      else if (p.status === 'pending') pending++;
      else if (p.status === 'failed') failed++;
    }
    return { totalSpent, totalDiscounts, completed, pending, failed, count: payments.length };
  }, [payments]);

  // Active filter
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');

  const filteredPayments = useMemo(() => {
    if (filter === 'all') return payments;
    return payments.filter(p => p.status === filter);
  }, [payments, filter]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
          <View style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </View>
        </AnimatedPressable>
        <Text style={styles.title}>Payment History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Summary Card */}
        <LinearGradient colors={GRADIENTS.midnight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryTopLabel}>Total Spent</Text>
            <Text style={styles.summaryTopValue}>
              ₹{stats.totalSpent.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.summaryBottom}>
            <View style={styles.summaryStat}>
              <Ionicons name="checkmark-circle" size={14} color="#00E676" />
              <Text style={[styles.summaryStatValue, { color: '#00E676' }]}>{stats.completed}</Text>
              <Text style={styles.summaryStatLabel}>Paid</Text>
            </View>
            <View style={styles.summaryStat}>
              <Ionicons name="time-outline" size={14} color="#FFAB40" />
              <Text style={[styles.summaryStatValue, { color: '#FFAB40' }]}>{stats.pending}</Text>
              <Text style={styles.summaryStatLabel}>Pending</Text>
            </View>
            <View style={styles.summaryStat}>
              <Ionicons name="close-circle" size={14} color="#FF5252" />
              <Text style={[styles.summaryStatValue, { color: '#FF5252' }]}>{stats.failed}</Text>
              <Text style={styles.summaryStatLabel}>Failed</Text>
            </View>
            {stats.totalDiscounts > 0 && (
              <View style={styles.summaryStat}>
                <Ionicons name="pricetag" size={14} color="#00E676" />
                <Text style={[styles.summaryStatValue, { color: '#00E676' }]}>₹{stats.totalDiscounts.toLocaleString('en-IN')}</Text>
                <Text style={styles.summaryStatLabel}>Saved</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {(['all', 'completed', 'pending', 'failed'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterTab, filter === tab && styles.filterTabActive]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
                {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment List */}
        {filteredPayments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Payments Found</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all' ? 'Your subscription payments will appear here' : `No ${filter} payments yet`}
            </Text>
          </View>
        ) : (
          <View style={styles.paymentList}>
            {filteredPayments.map(payment => (
              <PaymentRow key={payment.id} payment={payment} colors={colors} styles={styles} />
            ))}
          </View>
        )}

        {/* Info Footer */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Secure Payments</Text>
              <Text style={styles.infoText}>
                All transactions are processed securely through Razorpay. Your payment details are encrypted and never stored on our servers.
              </Text>
            </View>
          </View>
        </Card>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },

  // ── Summary ──
  summaryCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTop: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  summaryTopLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryTopValue: {
    ...FONTS.black,
    fontSize: FONTS.size.hero,
    color: colors.text,
  },
  summaryBottom: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStat: {
    alignItems: 'center',
    gap: 4,
  },
  summaryStatValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  summaryStatLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },

  // ── Filter ──
  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  filterTab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  filterTabTextActive: {
    color: colors.white,
  },

  // ── Payment List ──
  paymentList: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  paymentItem: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentItemExpanded: {
    borderColor: colors.primary,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentPlanName: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  paymentPlanType: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  paymentRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  paymentAmount: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  paymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  paymentStatusText: {
    ...FONTS.medium,
    fontSize: 9,
  },

  // ── Payment Details ──
  paymentDetails: {
    marginTop: SPACING.md,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  detailValue: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.text,
    textAlign: 'right',
    maxWidth: '55%',
  },
  detailCouponBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.marketUp + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  detailActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    flexWrap: 'wrap',
  },
  detailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    backgroundColor: colors.primary + '10',
  },
  detailActionText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.primary,
  },

  // ── Empty State ──
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.md,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  emptySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // ── Info Card ──
  infoCard: {
    marginBottom: SPACING.lg,
  },
  infoRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
    marginBottom: 4,
  },
  infoText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    lineHeight: 16,
  },
});
