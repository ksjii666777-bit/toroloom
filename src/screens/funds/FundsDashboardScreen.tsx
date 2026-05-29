import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { useFundStore, FundTransaction } from '../../store/fundStore';
import { COLORS, SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency, formatTimestamp } from '../../utils/formatters';

const { width } = Dimensions.get('window');

const quickActions = [
  { icon: 'add-circle', label: 'Add Funds', gradient: GRADIENTS.success, screen: 'AddFunds' },
  { icon: 'arrow-up-circle', label: 'Withdraw', gradient: GRADIENTS.danger, screen: 'Withdraw' },
  { icon: 'swap-horizontal', label: 'Transfer', gradient: GRADIENTS.primary, screen: 'Transfer' },
  { icon: 'qr-code', label: 'UPI', gradient: GRADIENTS.accent, screen: 'UPI' },
] as const;

export default function FundsDashboardScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { transactions } = useFundStore();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const balance = user?.balance || 2500000;

  const stats = useMemo(() => {
    let totalAdd = 0;
    let totalWithdraw = 0;
    for (const tx of transactions) {
      if (tx.type === 'add') totalAdd += tx.amount;
      else totalWithdraw += tx.amount;
    }
    return { totalAdd, totalWithdraw, net: totalAdd - totalWithdraw, count: transactions.length };
  }, [transactions]);

  const monthlyActivity = useMemo(() => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let monthAdd = 0;
    let monthWithdraw = 0;
    for (const tx of transactions) {
      const txDate = new Date(tx.timestamp);
      if (txDate >= firstOfMonth) {
        if (tx.type === 'add') monthAdd += tx.amount;
        else monthWithdraw += tx.amount;
      }
    }
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      label: months[now.getMonth()],
      add: monthAdd,
      withdraw: monthWithdraw,
    };
  }, [transactions]);

  const recentTx = useMemo(() => transactions.slice(0, 5), [transactions]);

  const handleQuickAction = (screen: string) => {
    navigation.navigate(screen);
  };

  const formatLargeCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val.toFixed(0)}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Funds Dashboard</Text>
        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => navigation.navigate('TransactionHistory')}
        >
          <Ionicons name="time-outline" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Balance Card */}
        <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>{formatLargeCurrency(balance)}</Text>
          <View style={styles.balanceSubRow}>
            <Ionicons name="wallet-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.balanceSub}>{formatCurrency(balance)}</Text>
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          {quickActions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.quickAction}
              onPress={() => handleQuickAction(action.screen)}
            >
              <LinearGradient colors={action.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.qaIcon}>
                <Ionicons name={action.icon as any} size={22} color={COLORS.white} />
              </LinearGradient>
              <Text style={styles.qaLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderColor: colors.border }]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.success + '20' }]}>
              <Ionicons name="add-circle" size={20} color={COLORS.success} />
            </View>
            <Text style={styles.statValue}>{formatLargeCurrency(stats.totalAdd)}</Text>
            <Text style={styles.statLabel}>Total Added</Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.border }]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.danger + '20' }]}>
              <Ionicons name="arrow-up-circle" size={20} color={COLORS.danger} />
            </View>
            <Text style={styles.statValue}>{formatLargeCurrency(stats.totalWithdraw)}</Text>
            <Text style={styles.statLabel}>Withdrawn</Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.border }]}>
            <View style={[styles.statIconWrap, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="trending-up" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.statValue, { color: stats.net >= 0 ? COLORS.success : COLORS.danger }]}>
              {stats.net >= 0 ? '+' : ''}{formatLargeCurrency(Math.abs(stats.net))}
            </Text>
            <Text style={styles.statLabel}>Net Addition</Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.border }]}>
            <View style={[styles.statIconWrap, { backgroundColor: COLORS.warning + '20' }]}>
              <Ionicons name="swap-horizontal" size={20} color={COLORS.warning} />
            </View>
            <Text style={styles.statValue}>{stats.count}</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
        </View>

        {/* Monthly Activity */}
        <View style={[styles.sectionCard, { borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>This Month</Text>
            <Text style={styles.sectionSubtitle}>{monthlyActivity.label} 2025</Text>
          </View>
          <View style={styles.monthlyBars}>
            <View style={styles.monthlyBarItem}>
              <View style={styles.monthlyBarLabel}>
                <Ionicons name="add-circle" size={14} color={COLORS.success} />
                <Text style={styles.monthlyBarLabelText}>Added</Text>
              </View>
              <View style={styles.monthlyBarTrack}>
                <View style={[styles.monthlyBarFill, {
                  width: `${Math.min((monthlyActivity.add / Math.max(monthlyActivity.add + monthlyActivity.withdraw, 1)) * 100, 100)}%`,
                  backgroundColor: COLORS.success,
                }]} />
              </View>
              <Text style={[styles.monthlyBarValue, { color: COLORS.success }]}>
                {formatCurrency(monthlyActivity.add, true)}
              </Text>
            </View>
            <View style={styles.monthlyBarItem}>
              <View style={styles.monthlyBarLabel}>
                <Ionicons name="arrow-up-circle" size={14} color={COLORS.danger} />
                <Text style={styles.monthlyBarLabelText}>Withdrawn</Text>
              </View>
              <View style={styles.monthlyBarTrack}>
                <View style={[styles.monthlyBarFill, {
                  width: `${Math.min((monthlyActivity.withdraw / Math.max(monthlyActivity.add + monthlyActivity.withdraw, 1)) * 100, 100)}%`,
                  backgroundColor: COLORS.danger,
                }]} />
              </View>
              <Text style={[styles.monthlyBarValue, { color: COLORS.danger }]}>
                {formatCurrency(monthlyActivity.withdraw, true)}
              </Text>
            </View>
          </View>
          {(monthlyActivity.add > 0 || monthlyActivity.withdraw > 0) && (
            <View style={styles.monthlyNet}>
              <Text style={styles.monthlyNetLabel}>Net this month</Text>
              <Text style={[styles.monthlyNetValue, {
                color: (monthlyActivity.add - monthlyActivity.withdraw) >= 0 ? COLORS.success : COLORS.danger,
              }]}>
                {monthlyActivity.add - monthlyActivity.withdraw >= 0 ? '+' : ''}
                {formatCurrency(monthlyActivity.add - monthlyActivity.withdraw, true)}
              </Text>
            </View>
          )}
        </View>

        {/* Recent Transactions */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TransactionHistory')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentTx.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('AddFunds')}
              >
                <Text style={styles.emptyBtnText}>Add Funds</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.txList}>
              {recentTx.map((tx: FundTransaction) => (
                <TouchableOpacity
                  key={tx.id}
                  style={[styles.txItem, { borderColor: colors.border }]}
                  onPress={() => navigation.navigate('TransactionHistory')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.txIcon, {
                    backgroundColor: tx.type === 'add' ? '#00C85320' : '#FF174420',
                  }]}>
                    <Ionicons
                      name={tx.type === 'add' ? 'add-circle' : 'arrow-up-circle'}
                      size={20}
                      color={tx.type === 'add' ? COLORS.success : COLORS.danger}
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txType}>
                      {tx.type === 'add' ? 'Funds Added' : 'Funds Withdrawn'}
                    </Text>
                    <Text style={styles.txMeta}>
                      {tx.method} • {formatTimestamp(tx.timestamp)}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, {
                    color: tx.type === 'add' ? COLORS.success : COLORS.danger,
                  }]}>
                    {tx.type === 'add' ? '+' : '-'}{formatCurrency(tx.amount, true)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Summary Footer Card */}
        <View style={[styles.footerCard, { borderColor: colors.border }]}>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Total Deposits</Text>
            <Text style={[styles.footerValue, { color: COLORS.success }]}>
              {formatCurrency(stats.totalAdd, true)}
            </Text>
          </View>
          <View style={[styles.footerDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Total Withdrawals</Text>
            <Text style={[styles.footerValue, { color: COLORS.danger }]}>
              {formatCurrency(stats.totalWithdraw, true)}
            </Text>
          </View>
          <View style={[styles.footerDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Current Balance</Text>
            <Text style={[styles.footerValue, { color: colors.primary }]}>
              {formatCurrency(balance, true)}
            </Text>
          </View>
        </View>

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
  historyBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Balance Card
  balanceCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  balanceLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  balanceValue: {
    ...FONTS.black,
    fontSize: FONTS.size.hero,
    color: COLORS.white,
    marginTop: SPACING.xs,
  },
  balanceSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  balanceSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.6)',
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  quickAction: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  qaIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qaLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.text,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  statCard: {
    width: (width - 40 - SPACING.sm) / 2,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  statValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  statLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },

  // Monthly Activity
  sectionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  sectionSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  monthlyBars: {
    gap: SPACING.md,
  },
  monthlyBarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  monthlyBarLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 80,
  },
  monthlyBarLabelText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
  },
  monthlyBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.bgInput,
    borderRadius: 4,
    overflow: 'hidden',
  },
  monthlyBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  monthlyBarValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    width: 56,
    textAlign: 'right',
  },
  monthlyNet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  monthlyNetLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  monthlyNetValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },

  // Section
  sectionWrap: {
    marginBottom: SPACING.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  seeAllText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },

  // Transaction List
  txList: {
    gap: SPACING.sm,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    gap: SPACING.md,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txType: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  txMeta: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  txAmount: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: SPACING.md,
  },
  emptyText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  emptyBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: COLORS.white,
  },

  // Footer Summary
  footerCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  footerLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  footerValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  footerDivider: {
    height: 1,
    marginVertical: SPACING.xs,
  },
});
