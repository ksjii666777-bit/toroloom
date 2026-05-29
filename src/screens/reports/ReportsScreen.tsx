import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useAuthStore } from '../../store/authStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS, COLORS } from '../../constants/theme';
import { formatCurrency, formatPercent, formatDate, formatNumber } from '../../utils/formatters';
import Card from '../../components/ui/Card';

const { width } = Dimensions.get('window');

type ReportTab = 'summary' | 'holdings' | 'performance';

const reportCards = [
  {
    id: 'pnl',
    icon: 'trending-up',
    label: 'P&L Statement',
    desc: 'Realized & unrealized gains',
    gradient: GRADIENTS.primary,
  },
  {
    id: 'holdings',
    icon: 'pie-chart',
    label: 'Holdings Report',
    desc: 'Sector-wise allocation',
    gradient: GRADIENTS.accent,
  },
  {
    id: 'tax',
    icon: 'document-text',
    label: 'Tax Summary',
    desc: 'Capital gains for ITR',
    gradient: GRADIENTS.warning,
  },
  {
    id: 'dividend',
    icon: 'cash',
    label: 'Dividend Report',
    desc: 'Dividend income & history',
    gradient: GRADIENTS.success,
  },
  {
    id: 'trades',
    icon: 'repeat',
    label: 'Trade Summary',
    desc: 'Trade frequency & volume',
    gradient: GRADIENTS.secondary,
  },
  {
    id: 'sip',
    icon: 'calendar',
    label: 'SIP Performance',
    desc: 'SIP investment tracker',
    gradient: GRADIENTS.purple,
  },
];

export default function ReportsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { holdings, trades } = usePortfolioStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');

  // Portfolio stats
  const totalInvested = holdings.reduce((s, h) => s + h.totalInvested, 0) || 623500;
  const currentValue = holdings.reduce((s, h) => s + h.currentValue, 0) || 673739;
  const totalPnl = currentValue - totalInvested;
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const winningHoldings = holdings.filter(h => h.pnl > 0).length;
  const totalBuyVolume = trades.filter(t => t.type === 'buy').reduce((s, t) => s + t.total, 0);
  const totalSellVolume = trades.filter(t => t.type === 'sell').reduce((s, t) => s + t.total, 0);

  // Sector allocation from holdings
  const sectorAllocation = useMemo(() => {
    const sectors: { [key: string]: { value: number; count: number } } = {};
    holdings.forEach(h => {
      const sector = h.name.includes('Bank') || h.name.includes('Finance') ? 'Finance'
        : h.name.includes('Tech') || h.name.includes('Consultancy') || h.name.includes('Infosys') || h.name.includes('Wipro') ? 'Technology'
        : h.name.includes('Energy') || h.name.includes('Reliance') ? 'Energy'
        : 'Others';
      if (!sectors[sector]) sectors[sector] = { value: 0, count: 0 };
      sectors[sector].value += h.currentValue;
      sectors[sector].count += 1;
    });
    return Object.entries(sectors).sort(([, a], [, b]) => b.value - a.value);
  }, [holdings]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Reports</Text>
          <Text style={styles.subtitle}>Portfolio performance overview</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Summary Card */}
        <LinearGradient colors={GRADIENTS.midnight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryGreeting}>Portfolio Summary</Text>
            <Text style={styles.summaryDate}>As of {formatDate(new Date().toISOString(), 'dd MMM yyyy')}</Text>
          </View>

          <View style={styles.portfolioValueRow}>
            <Text style={styles.portfolioLabel}>Total Portfolio Value</Text>
            <Text style={styles.portfolioValue}>{formatCurrency(currentValue)}</Text>
          </View>

          <View style={styles.pnlRow}>
            <View style={[styles.pnlBadge, { backgroundColor: totalPnl >= 0 ? '#00C85320' : '#FF174420' }]}>
              <Ionicons name={totalPnl >= 0 ? 'caret-up' : 'caret-down'} size={20} color={totalPnl >= 0 ? colors.marketUp : colors.marketDown} />
              <Text style={[styles.pnlText, { color: totalPnl >= 0 ? colors.marketUp : colors.marketDown }]}>
                {formatPercent(totalPnlPercent)}
              </Text>
            </View>
            <Text style={[styles.pnlValue, { color: totalPnl >= 0 ? colors.marketUp : colors.marketDown }]}>
              {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl, true)}
            </Text>
          </View>

          {/* Mini Stats Grid */}
          <View style={styles.miniStatsGrid}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{formatCurrency(totalInvested, true)}</Text>
              <Text style={styles.miniStatLabel}>Invested</Text>
            </View>
            <View style={styles.miniStatDivider} />
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{winningHoldings}/{holdings.length}</Text>
              <Text style={styles.miniStatLabel}>Winning</Text>
            </View>
            <View style={styles.miniStatDivider} />
            <View style={styles.miniStat}>
              <Text style={styles.miniStatValue}>{trades.length}</Text>
              <Text style={styles.miniStatLabel}>Trades</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Tab Switcher */}
        <View style={styles.tabRow}>
          {(['summary', 'holdings', 'performance'] as ReportTab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'summary' && (
          <>
            {/* Report Cards Grid */}
            <Text style={styles.sectionTitle}>Available Reports</Text>
            <View style={styles.reportGrid}>
              {reportCards.map(report => (
                <TouchableOpacity key={report.id} style={styles.reportCard} onPress={() => {
                  // Navigate or show report detail
                }}>
                  <LinearGradient colors={report.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reportIcon}>
                    <Ionicons name={report.icon as any} size={24} color={COLORS.white} />
                  </LinearGradient>
                  <Text style={styles.reportLabel}>{report.label}</Text>
                  <Text style={styles.reportDesc}>{report.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Recent Activity */}
            <Card title="Recent Activity" subtitle="Last 5 trades">
              {trades.slice(0, 5).map(trade => (
                <View key={trade.id} style={styles.activityItem}>
                  <View style={[styles.activityType, {
                    backgroundColor: trade.type === 'buy' ? '#00C85320' : '#FF174420',
                  }]}>
                    <Ionicons
                      name={trade.type === 'buy' ? 'arrow-down' : 'arrow-up'}
                      size={14}
                      color={trade.type === 'buy' ? colors.marketUp : colors.marketDown}
                    />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activitySymbol}>{trade.symbol}</Text>
                    <Text style={styles.activityQty}>{trade.quantity} shares</Text>
                  </View>
                  <View style={styles.activityRight}>
                    <Text style={styles.activityPrice}>{formatCurrency(trade.price)}</Text>
                    <Text style={styles.activityDate}>{formatDate(trade.timestamp, 'dd MMM')}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}

        {activeTab === 'holdings' && (
          <>
            {/* Sector Allocation */}
            <Text style={styles.sectionTitle}>Sector Allocation</Text>
            <View style={styles.chartCard}>
              <View style={styles.chartBarContainer}>
                {sectorAllocation.map(([sector, data]) => {
                  const pct = currentValue > 0 ? (data.value / currentValue) * 100 : 0;
                  return (
                    <View key={sector} style={styles.chartRow}>
                      <View style={styles.chartLabelRow}>
                        <View style={[styles.chartDot, {
                          backgroundColor: sector === 'Finance' ? colors.finance
                            : sector === 'Technology' ? colors.tech
                            : sector === 'Energy' ? colors.energy
                            : colors.primary,
                        }]} />
                        <Text style={styles.chartSectorName}>{sector}</Text>
                        <Text style={styles.chartSectorCount}>({data.count})</Text>
                      </View>
                      <View style={styles.chartBarBg}>
                        <View style={[styles.chartBarFill, {
                          width: `${pct}%`,
                          backgroundColor: sector === 'Finance' ? colors.finance
                            : sector === 'Technology' ? colors.tech
                            : sector === 'Energy' ? colors.energy
                            : colors.primary,
                        }]} />
                      </View>
                      <Text style={styles.chartPercent}>{pct.toFixed(1)}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Holdings Breakdown */}
            <Text style={styles.sectionTitle}>Holdings Breakdown</Text>
            {holdings.length > 0 ? (
              holdings.map(h => (
                <TouchableOpacity
                  key={h.id}
                  style={styles.holdingItem}
                  onPress={() => navigation.navigate('StockDetail', { stockId: h.stockId, symbol: h.symbol })}
                >
                  <View style={styles.holdingTop}>
                    <Text style={styles.holdingSymbol}>{h.symbol}</Text>
                    <Text style={[styles.holdingPnl, { color: h.pnl >= 0 ? colors.marketUp : colors.marketDown }]}>
                      {h.pnl >= 0 ? '+' : ''}{formatPercent(h.pnlPercent)}
                    </Text>
                  </View>
                  <View style={styles.holdingBottom}>
                    <Text style={styles.holdingDetail}>{h.quantity} shares @ avg {formatCurrency(h.buyPrice)}</Text>
                    <Text style={styles.holdingDetail}>Value: {formatCurrency(h.currentValue, true)}</Text>
                  </View>
                  <View style={styles.holdingProgressBg}>
                    <View style={[styles.holdingProgressFill, {
                      width: `${Math.min(Math.abs(h.pnlPercent), 100)}%`,
                      backgroundColor: h.pnl >= 0 ? colors.marketUp : colors.marketDown,
                    }]} />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Card>
                <View style={styles.emptyState}>
                  <Ionicons name="briefcase-outline" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>No Holdings</Text>
                  <Text style={styles.emptySubtitle}>Your holdings report will appear here</Text>
                </View>
              </Card>
            )}
          </>
        )}

        {activeTab === 'performance' && (
          <>
            {/* Key Metrics */}
            <Text style={styles.sectionTitle}>Key Metrics</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Ionicons name="cash-outline" size={24} color={colors.marketUp} />
                <Text style={styles.metricValue}>{formatCurrency(totalPnl)}</Text>
                <Text style={styles.metricLabel}>Total P&L</Text>
              </View>
              <View style={styles.metricCard}>
                <Ionicons name="trending-up-outline" size={24} color={colors.primary} />
                <Text style={styles.metricValue}>{formatPercent(totalPnlPercent)}</Text>
                <Text style={styles.metricLabel}>Total Return</Text>
              </View>
              <View style={styles.metricCard}>
                <Ionicons name="swap-horizontal-outline" size={24} color={colors.accent} />
                <Text style={styles.metricValue}>{formatCurrency(totalBuyVolume, true)}</Text>
                <Text style={styles.metricLabel}>Buy Volume</Text>
              </View>
              <View style={styles.metricCard}>
                <Ionicons name="swap-vertical-outline" size={24} color={colors.warning} />
                <Text style={styles.metricValue}>{formatCurrency(totalSellVolume, true)}</Text>
                <Text style={styles.metricLabel}>Sell Volume</Text>
              </View>
            </View>

            {/* Investment vs Current Value Comparison */}
            <Card title="Investment Overview">
              <View style={styles.comparisonRow}>
                <View style={styles.comparisonItem}>
                  <Text style={styles.comparisonLabel}>Total Invested</Text>
                  <Text style={styles.comparisonValue}>{formatCurrency(totalInvested)}</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={colors.textMuted} />
                <View style={styles.comparisonItem}>
                  <Text style={styles.comparisonLabel}>Current Value</Text>
                  <Text style={styles.comparisonValue}>{formatCurrency(currentValue)}</Text>
                </View>
              </View>
              <View style={styles.comparisonProgress}>
                <View style={styles.comparisonProgressBg}>
                  <View style={[styles.comparisonProgressFill, { width: '100%' }]} />
                </View>
                <Text style={styles.comparisonProgressLabel}>
                  {formatPercent(totalPnlPercent)} return
                </Text>
              </View>
            </Card>

            {/* Performance Stats */}
            <Card title="Performance Stats">
              <View style={styles.perfRow}>
                <Text style={styles.perfLabel}>Total Holdings</Text>
                <Text style={styles.perfValue}>{holdings.length}</Text>
              </View>
              <View style={styles.perfDivider} />
              <View style={styles.perfRow}>
                <Text style={styles.perfLabel}>Winning Holdings</Text>
                <Text style={[styles.perfValue, { color: colors.marketUp }]}>{winningHoldings}</Text>
              </View>
              <View style={styles.perfDivider} />
              <View style={styles.perfRow}>
                <Text style={styles.perfLabel}>Losing Holdings</Text>
                <Text style={[styles.perfValue, { color: colors.marketDown }]}>{holdings.length - winningHoldings}</Text>
              </View>
              <View style={styles.perfDivider} />
              <View style={styles.perfRow}>
                <Text style={styles.perfLabel}>Win Rate</Text>
                <Text style={styles.perfValue}>
                  {holdings.length > 0 ? ((winningHoldings / holdings.length) * 100).toFixed(0) : 0}%
                </Text>
              </View>
              <View style={styles.perfDivider} />
              <View style={styles.perfRow}>
                <Text style={styles.perfLabel}>Total Trades</Text>
                <Text style={styles.perfValue}>{trades.length}</Text>
              </View>
              <View style={styles.perfDivider} />
              <View style={styles.perfRow}>
                <Text style={styles.perfLabel}>Avg Trade Value</Text>
                <Text style={styles.perfValue}>
                  {trades.length > 0 ? formatCurrency(
                    trades.reduce((s, t) => s + t.total, 0) / trades.length, true
                  ) : formatCurrency(0)}
                </Text>
              </View>
            </Card>
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  summaryCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACING.lg,
  },
  summaryTop: {
    marginBottom: SPACING.lg,
  },
  summaryGreeting: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  summaryDate: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  portfolioValueRow: {
    marginBottom: SPACING.md,
  },
  portfolioLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  portfolioValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.hero,
    color: colors.text,
    marginTop: 4,
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  pnlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  pnlText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  pnlValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
  },
  miniStatsGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
  },
  miniStatValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  miniStatLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  miniStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
    alignSelf: 'center',
  },
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
    color: colors.white,
  },
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  reportCard: {
    width: (width - SPACING.xl * 2 - SPACING.md) / 2,
    backgroundColor: colors.bgCard,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  reportLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  reportDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  activityType: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activitySymbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  activityQty: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityPrice: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  activityDate: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  chartCard: {
    backgroundColor: colors.bgCard,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACING.xxl,
  },
  chartBarContainer: {
    gap: SPACING.md,
  },
  chartRow: {
    gap: 6,
  },
  chartLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chartSectorName: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  chartSectorCount: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  chartBarBg: {
    height: 8,
    backgroundColor: colors.bgInput,
    borderRadius: 4,
    overflow: 'hidden',
  },
  chartBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  chartPercent: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  holdingItem: {
    backgroundColor: colors.bgCard,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  holdingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  holdingSymbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  holdingPnl: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  holdingBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  holdingDetail: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  holdingProgressBg: {
    height: 4,
    backgroundColor: colors.bgInput,
    borderRadius: 2,
    overflow: 'hidden',
  },
  holdingProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  metricCard: {
    width: (width - SPACING.xl * 2 - SPACING.md) / 2,
    backgroundColor: colors.bgCard,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: SPACING.sm,
  },
  metricValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  metricLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  comparisonItem: {
    alignItems: 'center',
  },
  comparisonLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  comparisonValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
    marginTop: 4,
  },
  comparisonProgress: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  comparisonProgressBg: {
    height: 8,
    backgroundColor: colors.bgInput,
    borderRadius: 4,
    overflow: 'hidden',
  },
  comparisonProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  comparisonProgressLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    textAlign: 'right',
  },
  perfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  perfLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  perfValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  perfDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
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
