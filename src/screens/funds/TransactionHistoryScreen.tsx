import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useFundStore, FundTransaction } from '../../store/fundStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency, formatTimestamp } from '../../utils/formatters';

Dimensions.get('window');

type TxFilter = 'all' | 'add' | 'withdraw';

export default function TransactionHistoryScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { transactions } = useFundStore();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [filter, setFilter] = useState<TxFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter(tx => tx.type === filter);
  }, [transactions, filter]);

  // Group by date label
  const grouped = useMemo(() => {
    const groups: { label: string; txs: FundTransaction[] }[] = [];
    const map = new Map<string, FundTransaction[]>();
    for (const tx of filtered) {
      const key = tx.dateLabel;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    for (const [label, txs] of map) {
      groups.push({ label, txs });
    }
    return groups;
  }, [filtered]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const summary = useMemo(() => {
    let totalAdd = 0;
    let totalWithdraw = 0;
    for (const tx of transactions) {
      if (tx.type === 'add') totalAdd += tx.amount;
      else totalWithdraw += tx.amount;
    }
    return { totalAdd, totalWithdraw, net: totalAdd - totalWithdraw };
  }, [transactions]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('funds.txHistoryTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Summary Card */}
        <LinearGradient colors={GRADIENTS.midnight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('funds.txTotalAdded')}</Text>
              <Text style={[styles.summaryValue, { color: colors.marketUp }]}>
                {formatCurrency(summary.totalAdd, true)}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t('funds.txTotalWithdrawn')}</Text>
              <Text style={[styles.summaryValue, { color: colors.marketDown }]}>
                {formatCurrency(summary.totalWithdraw, true)}
              </Text>
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryNetRow}>
            <Text style={styles.summaryLabel}>{t('funds.txNetAddition')}</Text>
            <Text style={[styles.summaryNetValue, {
              color: summary.net >= 0 ? colors.marketUp : colors.marketDown,
            }]}>
              {summary.net >= 0 ? '+' : ''}{formatCurrency(summary.net, true)}
            </Text>
          </View>
        </LinearGradient>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="swap-horizontal" size={16} color={colors.textMuted} />
            <Text style={styles.statValue}>{transactions.length}</Text>
            <Text style={styles.statLabel}>{t('funds.txTransactions')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="add-circle" size={16} color={colors.marketUp} />
            <Text style={[styles.statValue, { color: colors.marketUp }]}>
              {transactions.filter(t => t.type === 'add').length}
            </Text>
            <Text style={styles.statLabel}>{t('funds.txAdds')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="arrow-up-circle" size={16} color={colors.marketDown} />
            <Text style={[styles.statValue, { color: colors.marketDown }]}>
              {transactions.filter(t => t.type === 'withdraw').length}
            </Text>
            <Text style={styles.statLabel}>{t('funds.txWithdrawals')}</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabRow}>
          {(['all', 'add', 'withdraw'] as TxFilter[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, filter === tab && styles.tabActive]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[styles.tabText, filter === tab && styles.tabTextActive]}>
                {tab === 'all' ? t('funds.txAll') : tab === 'add' ? t('funds.txAddFunds') : t('funds.txWithdrawals')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transaction Groups */}
        {grouped.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('funds.txEmptyTitle')}</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all'
                ? t('funds.txEmptyAll')
                : t('funds.txEmptyFilter', { filter })}
            </Text>
          </View>
        ) : (
          grouped.map(group => (
            <View key={group.label} style={styles.groupWrap}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              <View style={styles.txList}>
                {group.txs.map(tx => {
                  const isExpanded = expandedId === tx.id;
                  return (
                    <TouchableOpacity
                      key={tx.id}
                      style={[styles.txItem, isExpanded && styles.txItemExpanded]}
                      onPress={() => toggleExpand(tx.id)}
                      activeOpacity={0.7}
                    >
                      {/* Main Row */}
                      <View style={styles.txRow}>
                        <View style={[styles.txIconWrap, {
                          backgroundColor: tx.type === 'add' ? '#00C85320' : '#FF174420',
                        }]}>
                          <Ionicons
                            name={tx.type === 'add' ? 'add-circle' : 'arrow-up-circle'}
                            size={22}
                            color={tx.type === 'add' ? colors.marketUp : colors.marketDown}
                          />
                        </View>
                        <View style={styles.txInfo}>
                          <Text style={styles.txTypeLabel}>
                            {tx.type === 'add' ? t('funds.txFundsAdded') : t('funds.txFundsWithdrawn')}
                          </Text>
                          <Text style={styles.txMethod}>
                            {tx.type === 'add' ? t('funds.txVia', { method: tx.method }) : t('funds.txTo', { method: tx.method })}
                          </Text>
                        </View>
                        <View style={styles.txRight}>
                          <Text style={[styles.txAmount, {
                            color: tx.type === 'add' ? colors.marketUp : colors.marketDown,
                          }]}>
                            {tx.type === 'add' ? '+' : '-'}{formatCurrency(tx.amount, true)}
                          </Text>
                          <View style={styles.txStatusRow}>
                            <Text style={styles.txTime}>{formatTimestamp(tx.timestamp)}</Text>
                            <View style={[styles.statusDot, {
                              backgroundColor: tx.status === 'completed' ? colors.marketUp
                                : tx.status === 'pending' ? colors.warning
                                : colors.marketDown,
                            }]} />
                            <Text style={styles.txStatus}>{tx.status}</Text>
                          </View>
                        </View>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={colors.textMuted}
                          style={styles.chevron}
                        />
                      </View>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <View style={styles.detailSection}>
                          <View style={styles.detailDivider} />
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>{t('funds.txTransactionId')}</Text>
                            <Text style={styles.detailValue}>{tx.transactionId}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>{t('funds.txAmount')}</Text>
                            <Text style={styles.detailValue}>{formatCurrency(tx.amount)}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>{t('funds.txMethod')}</Text>
                            <Text style={styles.detailValue}>{tx.method}</Text>
                          </View>
                          {tx.account && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>{t('funds.txAccount')}</Text>
                              <Text style={styles.detailValue}>{tx.account}</Text>
                            </View>
                          )}
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>{t('funds.txStatus')}</Text>
                            <Text style={[styles.detailValue, {
                              color: tx.status === 'completed' ? colors.marketUp
                                : tx.status === 'pending' ? colors.warning
                                : colors.marketDown,
                            }]}>
                              {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                            </Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>{t('funds.txDateTime')}</Text>
                            <Text style={styles.detailValue}>
                              {new Date(tx.timestamp).toLocaleString('en-IN')}
                            </Text>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}

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

  // Summary Card
  summaryCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: SPACING.md,
  },
  summaryNetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryNetValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  statLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.divider,
    alignSelf: 'center',
  },

  // Filter Tabs
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
    color: '#FFFFFF',
  },

  // Groups
  groupWrap: {
    marginBottom: SPACING.lg,
  },
  groupLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  txList: {
    gap: SPACING.sm,
  },
  txItem: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  txItemExpanded: {
    borderColor: colors.primary,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txTypeLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  txMethod: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  txStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  txTime: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  txStatus: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  chevron: {
    marginLeft: 4,
  },

  // Detail Section
  detailSection: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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

  // Empty State
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
});
