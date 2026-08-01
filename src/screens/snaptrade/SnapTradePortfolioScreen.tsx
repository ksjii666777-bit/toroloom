/**
 * ============================================================================
 * Toroloom — SnapTrade Portfolio Screen
 * ============================================================================
 *
 * Displays US stock holdings and positions from a SnapTrade-connected brokerage:
 *   - Account overview (balance, buying power, connected broker)
 *   - Holdings list with P&L, quantity, avg cost
 *   - Open positions with entry/current price
 *   - Pull-to-refresh to sync from broker
 *   - Tap a holding to navigate to order screen
 *
 * Navigation: SnapTradeConnect → SnapTradePortfolio
 * ============================================================================
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { snapTradeApi } from '../../services/api';
import type { SnapTradeHolding, SnapTradePosition, SnapTradeStatus } from '../../services/api/snaptrade';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import Animated, { FadeInUp } from 'react-native-reanimated';
import AnimatedPressable from '../../components/ui/AnimatedPressable';


// ──── Format helpers ──────────────────────────────────────────
const formatUSD = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const formatCompactUSD = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
};

// ──── Main Screen ─────────────────────────────────────────────
export default function SnapTradePortfolioScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<SnapTradeStatus | null>(null);
  const [holdings, setHoldings] = useState<SnapTradeHolding[]>([]);
  const [positions, setPositions] = useState<SnapTradePosition[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalPnl, setTotalPnl] = useState(0);
  const [accountBalance, setAccountBalance] = useState(0);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; balance: number; type: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch all data ─────────────────────────────────────────
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [status, hld, pos, acc] = await Promise.all([
        snapTradeApi.status(),
        snapTradeApi.getHoldings().catch(() => ({ success: false, data: [], count: 0 })),
        snapTradeApi.getPositions().catch(() => ({ success: false, data: [], count: 0 })),
        snapTradeApi.getAccounts().catch(() => ({ success: false, data: [], count: 0 })),
      ]);

      setConnectionStatus(status);
      const holdingsData = hld.data || [];
      const positionsData = pos.data || [];
      const accountsData = acc.data || [];

      setHoldings(holdingsData);
      setPositions(positionsData);
      setAccounts(accountsData);

      // Calculate totals
      const hTotal = holdingsData.reduce((s, h) => s + h.price * h.quantity, 0);
      const hPnl = holdingsData.reduce((s, h) => s + h.pnl, 0);
      setTotalValue(hTotal);
      setTotalPnl(hPnl);

      const acctTotal = accountsData.reduce((s, a) => s + (a.balance || 0), 0);
      setAccountBalance(acctTotal);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch portfolio data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => fetchData(true), [fetchData]);

  // ── Summary stats ──────────────────────────────────────────
  const stats = useMemo(() => ({
    totalSecurities: holdings.length,
    totalPositions: positions.length,
    totalAccounts: accounts.length,
    pnlPercent: totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0,
  }), [holdings, positions, accounts, totalValue, totalPnl]);

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.statusText, { color: colors.textMuted, marginTop: SPACING.md }]}>
          Syncing portfolio...
        </Text>
      </View>
    );
  }

  // ── Not connected ──────────────────────────────────────────
  if (!connectionStatus?.connected) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { backgroundColor: colors.bgSecondary, paddingTop: 60 + insets.top }]}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.93}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </AnimatedPressable>
          <View style={{ marginLeft: SPACING.md }}>
            <Text style={[styles.title, { color: colors.text }]}>US Portfolio</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="briefcase-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Broker Connected</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            Connect a US brokerage via SnapTrade to view your portfolio.
          </Text>
          <AnimatedPressable
            onPress={() => navigation.navigate('SnapTradeConnect')}
            haptic="medium"
            scaleTo={0.95}
            style={[styles.connectBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.connectBtnText}>Connect Broker</Text>
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary, paddingTop: 60 + insets.top }]}>
        <View style={styles.headerRow}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.93}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </AnimatedPressable>
          <Text style={[styles.title, { color: colors.text, flex: 1, marginLeft: SPACING.md }]}>US Portfolio</Text>
          <AnimatedPressable onPress={() => navigation.navigate('SnapTradeOrder')} haptic="medium" scaleTo={0.93}>
            <View style={[styles.headerAction, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
            </View>
          </AnimatedPressable>
        </View>
        {connectionStatus && (
          <View style={styles.brokerRow}>
            <View style={[styles.brokerDot, { backgroundColor: '#00E676' }]} />
            <Text style={[styles.brokerLabel, { color: colors.textMuted }]}>
              {connectionStatus.brokerName || 'Connected'} · {connectionStatus.accountName || 'US Brokerage'}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.bgSecondary}
          />
        }
      >
        {/* ── Portfolio Summary Card ── */}
        <LinearGradient
          colors={['#3B82F6', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryCard}
        >
          <Text style={styles.summaryLabel}>Total Portfolio Value</Text>
          <Text style={styles.summaryValue}>
            {totalValue > 0 ? formatUSD(totalValue) : accountBalance > 0 ? formatUSD(accountBalance) : '—'}
          </Text>
          <View style={styles.summaryRow}>
            <View style={[styles.pnlBadge, { backgroundColor: totalPnl >= 0 ? 'rgba(0,230,118,0.2)' : 'rgba(255,82,82,0.2)' }]}>
              <Ionicons
                name={totalPnl >= 0 ? 'caret-up' : 'caret-down'}
                size={14}
                color={totalPnl >= 0 ? '#00E676' : '#FF5252'}
              />
              <Text style={[styles.pnlText, { color: totalPnl >= 0 ? '#00E676' : '#FF5252' }]}>
                {totalPnl >= 0 ? '+' : ''}{formatUSD(totalPnl)}
              </Text>
            </View>
            <Text style={styles.summaryMeta}>
              {stats.pnlPercent >= 0 ? '+' : ''}{stats.pnlPercent.toFixed(2)}% total return
            </Text>
          </View>

          {/* Mini Stats */}
          <View style={styles.summaryGrid}>
            <View style={styles.summaryGridItem}>
              <Text style={styles.summaryGridValue}>{stats.totalSecurities}</Text>
              <Text style={styles.summaryGridLabel}>Holdings</Text>
            </View>
            <View style={styles.summaryGridDivider} />
            <View style={styles.summaryGridItem}>
              <Text style={styles.summaryGridValue}>{stats.totalAccounts}</Text>
              <Text style={styles.summaryGridLabel}>Accounts</Text>
            </View>
            <View style={styles.summaryGridDivider} />
            <View style={styles.summaryGridItem}>
              <Text style={styles.summaryGridValue}>
                {accountBalance > 0 ? formatCompactUSD(accountBalance) : '—'}
              </Text>
              <Text style={styles.summaryGridLabel}>Buying Power</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Error ── */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' }]}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        {/* ── Empty State ── */}
        {holdings.length === 0 && positions.length === 0 && !error && (
          <Animated.View entering={FadeInUp.duration(400)} style={styles.emptySection}>
            <View style={[styles.emptyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="file-tray-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyCardTitle, { color: colors.text }]}>No Holdings Yet</Text>
              <Text style={[styles.emptyCardDesc, { color: colors.textMuted }]}>
                Your connected brokerage account doesn't have any positions yet. 
                Place your first US stock trade to get started.
              </Text>
              <AnimatedPressable
                onPress={() => navigation.navigate('SnapTradeOrder')}
                haptic="medium"
                scaleTo={0.95}
                style={[styles.startTradeBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="swap-horizontal" size={16} color="#fff" />
                <Text style={styles.startTradeBtnText}>Start Trading</Text>
              </AnimatedPressable>
            </View>
          </Animated.View>
        )}

        {/* ── Holdings List ── */}
        {holdings.length > 0 && (
          <View style={{ marginTop: SPACING.lg }}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>
              Holdings ({holdings.length})
            </Text>
            {holdings.map((h, i) => {
              const pnlPositive = h.pnl >= 0;
              return (
                <AnimatedPressable
                  key={h.symbol}
                  onPress={() => navigation.navigate('SnapTradeOrder', {
                    symbol: h.symbol,
                    name: h.name,
                    price: h.price,
                  })}
                  haptic="light"
                  scaleTo={0.98}
                >
                  <Animated.View
                    entering={FadeInUp.duration(300).delay(i * 50)}
                    style={[styles.holdingCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                  >
                    <View style={styles.holdingRow}>
                      <View style={styles.holdingLeft}>
                        <Text style={[styles.holdingSymbol, { color: colors.text }]}>{h.symbol}</Text>
                        <Text style={[styles.holdingName, { color: colors.textMuted }]} numberOfLines={1}>{h.name}</Text>
                      </View>
                      <View style={styles.holdingRight}>
                        <Text style={[styles.holdingQty, { color: colors.text }]}>
                          {h.quantity} shares
                        </Text>
                        <Text style={[styles.holdingPrice, { color: colors.text }]}>
                          {formatUSD(h.price)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.holdingFooter}>
                      <Text style={[styles.holdingAvgCost, { color: colors.textMuted }]}>
                        Avg: {formatUSD(h.avgCost)}
                      </Text>
                      <Text style={[styles.holdingValue, { color: colors.text }]}>
                        {formatUSD(h.price * h.quantity)}
                      </Text>
                      <View style={[styles.holdingPnlBadge, {
                        backgroundColor: pnlPositive ? '#00E67620' : '#FF525220',
                      }]}>
                        <Ionicons
                          name={pnlPositive ? 'caret-up' : 'caret-down'}
                          size={10}
                          color={pnlPositive ? '#00E676' : '#FF5252'}
                        />
                        <Text style={[styles.holdingPnlText, {
                          color: pnlPositive ? '#00E676' : '#FF5252',
                        }]}>
                          {pnlPositive ? '+' : ''}{formatUSD(h.pnl)}
                        </Text>
                      </View>
                    </View>
                  </Animated.View>
                </AnimatedPressable>
              );
            })}
          </View>
        )}

        {/* ── Positions List ── */}
        {positions.length > 0 && (
          <View style={{ marginTop: SPACING.lg }}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>
              Open Positions ({positions.length})
            </Text>
            {positions.map((p, i) => {
              const pnlPositive = p.pnl >= 0;
              return (
                <Animated.View
                  key={p.symbol}
                  entering={FadeInUp.duration(300).delay(i * 50)}
                  style={[styles.positionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                >
                  <View style={styles.holdingRow}>
                    <View style={styles.holdingLeft}>
                      <Text style={[styles.holdingSymbol, { color: colors.text }]}>{p.symbol}</Text>
                      <Text style={[styles.holdingName, { color: colors.textMuted }]} numberOfLines={1}>{p.name}</Text>
                    </View>
                    <View style={styles.holdingRight}>
                      <Text style={[styles.holdingQty, { color: colors.text }]}>
                        {p.quantity} shares
                      </Text>
                      <View style={[styles.holdingPnlBadge, {
                        backgroundColor: pnlPositive ? '#00E67620' : '#FF525220',
                      }]}>
                        <Ionicons
                          name={pnlPositive ? 'caret-up' : 'caret-down'}
                          size={10}
                          color={pnlPositive ? '#00E676' : '#FF5252'}
                        />
                        <Text style={[styles.holdingPnlText, {
                          color: pnlPositive ? '#00E676' : '#FF5252',
                        }]}>
                          {pnlPositive ? '+' : ''}{formatUSD(p.pnl)} ({pnlPositive ? '+' : ''}{p.pnlPercent.toFixed(2)}%)
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.positionMeta}>
                    <Text style={[styles.positionMetaText, { color: colors.textMuted }]}>
                      Entry: {formatUSD(p.avgCost)} · Current: {formatUSD(p.price)}
                    </Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}

        {/* ── Accounts ── */}
        {accounts.length > 0 && (
          <View style={{ marginTop: SPACING.lg }}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>
              Accounts ({accounts.length})
            </Text>
            {accounts.map((a, i) => (
              <Animated.View
                key={a.id}
                entering={FadeInUp.duration(300).delay(i * 50)}
                style={[styles.accountCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              >
                <View style={styles.accountRow}>
                  <View style={[styles.accountIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="business" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.accountName, { color: colors.text }]}>{a.name}</Text>
                    <Text style={[styles.accountType, { color: colors.textMuted }]}>{a.type || 'Brokerage'}</Text>
                  </View>
                  <Text style={[styles.accountBalance, { color: colors.text }]}>
                    {formatUSD(a.balance || 0)}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        {/* ── Sync Note ── */}
        <View style={[styles.syncNote, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="sync" size={14} color={colors.textMuted} />
          <Text style={[styles.syncNoteText, { color: colors.textMuted }]}>
            Data synced from your connected brokerage. Pull down to refresh.
          </Text>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAction: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { ...FONTS.bold, fontSize: FONTS.size.title },
  statusText: { ...FONTS.regular, fontSize: FONTS.size.md },
  brokerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  brokerDot: { width: 6, height: 6, borderRadius: 3 },
  brokerLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyTitle: { ...FONTS.bold, fontSize: FONTS.size.lg, marginTop: SPACING.md },
  emptyDesc: { ...FONTS.regular, fontSize: FONTS.size.sm, textAlign: 'center', lineHeight: 18 },
  connectBtn: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.md,
  },
  connectBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: '#fff' },

  // Summary Card
  summaryCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  summaryLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: 'rgba(255,255,255,0.7)' },
  summaryValue: { ...FONTS.bold, fontSize: 32, color: '#fff', marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  pnlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  pnlText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  summaryMeta: { ...FONTS.regular, fontSize: FONTS.size.xs, color: 'rgba(255,255,255,0.6)' },
  summaryGrid: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  summaryGridItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryGridValue: { ...FONTS.bold, fontSize: FONTS.size.lg, color: '#fff' },
  summaryGridLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  summaryGridDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // Error
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.lg,
  },
  errorText: { ...FONTS.regular, fontSize: FONTS.size.sm, flex: 1 },

  // Empty section
  emptySection: { marginTop: SPACING.xl },
  emptyCard: {
    padding: SPACING.xxl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyCardTitle: { ...FONTS.bold, fontSize: FONTS.size.lg },
  emptyCardDesc: { ...FONTS.regular, fontSize: FONTS.size.sm, textAlign: 'center', lineHeight: 18 },
  startTradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.md,
  },
  startTradeBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: '#fff' },

  // Section
  sectionLabel: { ...FONTS.bold, fontSize: FONTS.size.md, marginBottom: SPACING.md },

  // Holding Card
  holdingCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  holdingLeft: { flex: 1, marginRight: SPACING.md },
  holdingSymbol: { ...FONTS.bold, fontSize: FONTS.size.md },
  holdingName: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2 },
  holdingRight: { alignItems: 'flex-end', gap: 4 },
  holdingQty: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  holdingPrice: { ...FONTS.mono, fontSize: FONTS.size.sm },
  holdingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  holdingAvgCost: { ...FONTS.regular, fontSize: FONTS.size.xs },
  holdingValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  holdingPnlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  holdingPnlText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // Position Card
  positionCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  positionMeta: { marginTop: SPACING.sm },
  positionMetaText: { ...FONTS.regular, fontSize: FONTS.size.xs },

  // Account Card
  accountCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountName: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  accountType: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  accountBalance: { ...FONTS.bold, fontSize: FONTS.size.md },

  // Sync Note
  syncNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.xl,
  },
  syncNoteText: { ...FONTS.regular, fontSize: FONTS.size.xs, flex: 1 },
});
