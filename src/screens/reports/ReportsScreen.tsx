import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Share,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { usePortfolioStore } from '../../store/portfolioStore';
import { usePortfolioAnalyticsStore } from '../../store/portfolioAnalyticsStore';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency, formatPercent} from '../../utils/formatters';
import Card from '../../components/ui/Card';

import PnLChart from '../../components/PnLChart';
import { exportPDF, exportCSV } from '../../services/reportExport';


const { width } = Dimensions.get('window');

type ReportTab = 'pnl' | 'performance' | 'tax' | 'holdings' | 'history';

export default function ReportsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { holdings, trades } = usePortfolioStore();
  const { getAnalytics } = usePortfolioAnalyticsStore();
  const { user } = useAuthStore();
  const {
    portfolioAlertRules,
    addPortfolioAlertRule,
    quickAddDayGainThreshold,
    quickAddPnLThreshold,
  } = useNotificationStore();
  const [activeTab, setActiveTab] = useState<ReportTab>('pnl');
  const [chartTimeframe, setChartTimeframe] = useState('All');
  const [_showAllMetrics, _setShowAllMetrics] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [histPeriod, setHistPeriod] = useState('6M');

  const analytics = useMemo(() => getAnalytics(), [getAnalytics, trades, holdings]);
  const m = analytics.metrics;
  const cg = analytics.capitalGains;
  const isLive = usePortfolioAnalyticsStore(s => s.isLive);
  const lastUpdated = usePortfolioAnalyticsStore(s => s.lastUpdated);
  const pnlHistoryStream = usePortfolioAnalyticsStore(s => s.pnlHistoryStream);

  // ── Subscribe to live P&L updates on mount ────────────────
  const subscribe = usePortfolioAnalyticsStore(s => s.subscribeToLiveUpdates);
  const unsubscribe = usePortfolioAnalyticsStore(s => s.unsubscribeFromLiveUpdates);
  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);

  // ── Helper to format value with color ─────────────────────────
  const _coloredValue = (val: number, suffix = '', isPercent = false) => {
    const color = val >= 0 ? colors.marketUp : colors.marketDown;
    const formatted = isPercent ? formatPercent(val) : formatCurrency(val, true);
    return <Text style={[styles.highlightValue, { color }]}>{formatted}{suffix}</Text>;
  };

  // ── Helper row ────────────────────────────────────────────────
  const MetricRow = ({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) => (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricVal, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );

  // ── Long-press holding → create alert ──────────────────
  const handleHoldingLongPress = useCallback((h: typeof holdings[0]) => {
    const hasDayAlert = portfolioAlertRules.some(
      r => r.kind === 'holding_day_gain_pct' && r.enabled && r.stockIds?.includes(h.stockId)
    );
    const hasPnLAlert = portfolioAlertRules.some(
      r => r.kind === 'holding_pnl_pct' && r.enabled && r.stockIds?.includes(h.stockId)
    );

    Alert.alert(
      `Add Alert for ${h.symbol}`,
      `Current: ${h.pnlPercent >= 0 ? '+' : ''}${h.pnlPercent.toFixed(1)}% P&L · ${h.dayChangePercent >= 0 ? '+' : ''}${h.dayChangePercent.toFixed(1)}% today`,
      [
        hasDayAlert
          ? { text: `✓ Day Gain Alert Active (${h.symbol})`, style: 'cancel' as const }
          : {
              text: `Add Day Gain Alert (≥${quickAddDayGainThreshold}%)`,
              onPress: () => {
                addPortfolioAlertRule({
                  kind: 'holding_day_gain_pct',
                  label: `Day Gain — ${h.symbol}`,
                  threshold: quickAddDayGainThreshold,
                  direction: 'above',
                  enabled: true,
                  badge: true,
                  stockIds: [h.stockId],
                  symbols: [h.symbol],
                });
                Alert.alert('Alert Added', `Day gain alert created for ${h.symbol}.`);
              },
            },
        hasPnLAlert
          ? { text: `✓ P&L Alert Active (${h.symbol})`, style: 'cancel' as const }
          : {
              text: `Add P&L Alert (≥${quickAddPnLThreshold}%)`,
              onPress: () => {
                addPortfolioAlertRule({
                  kind: 'holding_pnl_pct',
                  label: `P&L — ${h.symbol}`,
                  threshold: quickAddPnLThreshold,
                  direction: 'above',
                  enabled: true,
                  badge: true,
                  stockIds: [h.stockId],
                  symbols: [h.symbol],
                });
                Alert.alert('Alert Added', `P&L alert created for ${h.symbol}.`);
              },
            },
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  }, [portfolioAlertRules, addPortfolioAlertRule, quickAddDayGainThreshold, quickAddPnLThreshold]);

  // ── Share analytics (text) ────────────────────────────────────
  const handleShare = async () => {
    try {
      await Share.share({
        message: `📊 Toroloom Portfolio Report\n\n` +
          `Total Value: ${formatCurrency(holdings.reduce((s, h) => s + h.currentValue, 0), true)}\n` +
          `Total Return: ${formatPercent(m.totalReturnPercent)}\n` +
          `P&L: ${formatCurrency(m.totalReturn, true)}\n` +
          `Win Rate: ${m.winRate.toFixed(1)}%\n` +
          `Sharpe Ratio: ${m.sharpeRatio}\n` +
          `Max Drawdown: ${formatPercent(m.maxDrawdownPercent)}\n` +
          `Est. Tax Liability: ${formatCurrency(cg.totalEstimatedTax, true)}\n\n` +
          `Download Toroloom for AI-powered trading!`,
      });
    } catch {}
  };

  // ── Export PDF / CSV ──────────────────────────────────────────
  const handleExport = useCallback(async (format: 'pdf' | 'csv') => {
    setExporting(true);
    setShowExportModal(false);

    try {
      const userName = user?.name || 'Investor';
      const result = format === 'pdf'
        ? await exportPDF(analytics, holdings, trades, userName)
        : await exportCSV(analytics, holdings, trades);

      if (result.success) {
        Alert.alert(
          'Report Exported',
          `Your portfolio report has been exported as ${format.toUpperCase()} and saved.`,
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert(
          'Export Failed',
          result.error || 'Could not export the report. Please try again.',
          [{ text: 'OK' }],
        );
      }
    } catch (_err) {
      Alert.alert('Export Error', 'An unexpected error occurred during export.');
    } finally {
      setExporting(false);
    }
  }, [analytics, holdings, trades, user?.name]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Analytics</Text>
            {isLive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            )}
          </View>
          <Text style={styles.subtitle}>
            {isLive && lastUpdated
              ? `Updated ${new Date(lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Advanced portfolio intelligence'
            }
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowExportModal(true)} style={styles.exportBtn}>
            {exporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="download-outline" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <Ionicons name="share-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Tools: Contract Note Parser ─────────────────────── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('ContractNoteParser')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(0,242,254,0.06)',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: 'rgba(0,242,254,0.12)',
          }}
        >
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: 'rgba(0,242,254,0.1)',
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Ionicons name="document-attach" size={22} color="#00F2FE" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{
              ...FONTS.semiBold, fontSize: FONTS.size.md, color: '#FFFFFF',
            }}>
              Contract Note Parser
            </Text>
            <Text style={{
              ...FONTS.regular, fontSize: FONTS.size.xs,
              color: 'rgba(255,255,255,0.5)', marginTop: 2,
            }}>
              Upload broker PDFs to extract trades
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>

        {/* ── Portfolio Snapshot ─────────────────────────────── */}
        <LinearGradient colors={GRADIENTS.midnight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.snapshotCard}>
          <View style={styles.snapshotTop}>
            <View>
              <Text style={styles.snapshotLabel}>Portfolio Value</Text>
              <Text style={styles.snapshotValue}>
                {formatCurrency(holdings.reduce((s, h) => s + h.currentValue, 0))}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.snapshotLabel}>Total Return</Text>
              <View style={styles.snapshotReturnRow}>
                <Text style={[styles.snapshotReturn, { color: m.totalReturn >= 0 ? colors.marketUp : colors.marketDown }]}>
                  {formatPercent(m.totalReturnPercent)}
                </Text>
                <View style={[styles.snapshotBadge, {
                  backgroundColor: m.totalReturn >= 0 ? '#00C85320' : '#FF174420',
                }]}>
                  <Ionicons name={m.totalReturn >= 0 ? 'caret-up' : 'caret-down'} size={14}
                    color={m.totalReturn >= 0 ? colors.marketUp : colors.marketDown} />
                  <Text style={[styles.snapshotBadgeText, {
                    color: m.totalReturn >= 0 ? colors.marketUp : colors.marketDown,
                  }]}>
                    {formatCurrency(m.totalReturn, true)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.snapshotGrid}>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotItemValue}>{m.winRate.toFixed(0)}%</Text>
              <Text style={styles.snapshotItemLabel}>Win Rate</Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotItemValue}>{m.sharpeRatio.toFixed(1)}</Text>
              <Text style={styles.snapshotItemLabel}>Sharpe</Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotItemValue}>{formatPercent(m.maxDrawdownPercent)}</Text>
              <Text style={styles.snapshotItemLabel}>Max DD</Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotItemValue}>{holdings.length}</Text>
              <Text style={styles.snapshotItemLabel}>Holdings</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Tab Switcher ───────────────────────────────────── */}
        <View style={styles.tabRow}>
          {([
            { key: 'pnl', label: 'P&L', icon: 'trending-up' },
            { key: 'performance', label: 'Performance', icon: 'stats-chart' },
            { key: 'tax', label: 'Tax', icon: 'document-text' },
            { key: 'holdings', label: 'Holdings', icon: 'pie-chart' },
            { key: 'history', label: 'History', icon: 'time-outline' },
          ] as const).map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={activeTab === tab.key ? colors.white : colors.textMuted}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════════════════════════════════════════════════
           TAB 1: P&L
           ══════════════════════════════════════════════════════ */}
        {activeTab === 'pnl' && (
          <>
            {/* P&L Chart */}
            <Text style={styles.sectionTitle}>P&L Over Time</Text>
            <PnLChart
              data={analytics.pnlHistory}
              timeframe={chartTimeframe}
              onTimeframeChange={setChartTimeframe}
              autoRefresh={isLive}
              streamData={pnlHistoryStream}
            />

            {/* P&L Summary Cards */}
            <View style={styles.pnlSummaryRow}>
              <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pnlSummaryCard}>
                <Text style={styles.pnlSummaryLabel}>Realized P&L</Text>
                <Text style={[styles.pnlSummaryValue, { color: m.realizedPnl >= 0 ? '#00C853' : '#FF1744' }]}>
                  {m.realizedPnl >= 0 ? '+' : ''}{formatCurrency(m.realizedPnl, true)}
                </Text>
                <Text style={styles.pnlSummarySub}>From closed positions</Text>
              </LinearGradient>
              <LinearGradient colors={GRADIENTS.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pnlSummaryCard}>
                <Text style={styles.pnlSummaryLabel}>Unrealized P&L</Text>
                <Text style={[styles.pnlSummaryValue, { color: m.unrealizedPnl >= 0 ? '#00C853' : '#FF1744' }]}>
                  {m.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(m.unrealizedPnl, true)}
                </Text>
                <Text style={styles.pnlSummarySub}>From open positions</Text>
              </LinearGradient>
            </View>

            {/* Day P&L */}
            <Card title="Today's Performance">
              <View style={styles.dayPnlRow}>
                <View style={styles.dayPnlItem}>
                  <Ionicons name="sunny-outline" size={20} color={colors.warning} />
                  <View style={{ marginLeft: SPACING.md }}>
                    <Text style={styles.dayPnlLabel}>Day Change</Text>
                    <Text style={[styles.dayPnlValue, { color: m.dayChange >= 0 ? colors.marketUp : colors.marketDown }]}>
                      {m.dayChange >= 0 ? '+' : ''}{formatCurrency(m.dayChange, true)}
                    </Text>
                  </View>
                </View>
                <View style={styles.dayPnlItem}>
                  <Ionicons name="trending-up-outline" size={20} color={colors.primary} />
                  <View style={{ marginLeft: SPACING.md }}>
                    <Text style={styles.dayPnlLabel}>Day Return</Text>
                    <Text style={[styles.dayPnlValue, { color: m.dayChangePercent >= 0 ? colors.marketUp : colors.marketDown }]}>
                      {formatPercent(m.dayChangePercent)}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>

            {/* Monthly Returns */}
            {analytics.monthlyReturns.length > 0 && (
              <Card title="Monthly Returns">
                {analytics.monthlyReturns.slice(-6).map((mr, i) => (
                  <View key={i}>
                    <View style={styles.monthlyRow}>
                      <Text style={styles.monthlyLabel}>
                        {new Date(mr.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </Text>
                      <View style={[styles.monthlyBar, {
                        backgroundColor: mr.returnPercent >= 0 ? '#00C85320' : '#FF174420',
                      }]}>
                        <View style={[styles.monthlyBarFill, {
                          width: `${Math.min(Math.abs(mr.returnPercent) * 3, 100)}%`,
                          backgroundColor: mr.returnPercent >= 0 ? colors.marketUp : colors.marketDown,
                        }]} />
                      </View>
                      <Text style={[styles.monthlyValue, {
                        color: mr.returnPercent >= 0 ? colors.marketUp : colors.marketDown,
                      }]}>
                        {formatPercent(mr.returnPercent)}
                      </Text>
                    </View>
                    {i < Math.min(analytics.monthlyReturns.length, 6) - 1 && <View style={styles.monthlyDivider} />}
                  </View>
                ))}
              </Card>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════
           TAB 2: Performance
           ══════════════════════════════════════════════════════ */}
        {activeTab === 'performance' && (
          <>
            {/* Key Risk/Return Metrics */}
            <Text style={styles.sectionTitle}>Risk & Return</Text>
            <View style={styles.perfGrid}>
              {[
                { icon: 'cash', label: 'Total Return', value: formatCurrency(m.totalReturn, true), color: m.totalReturn >= 0 ? colors.marketUp : colors.marketDown, bg: GRADIENTS.primary },
                { icon: 'analytics', label: 'Return %', value: formatPercent(m.totalReturnPercent), color: m.totalReturnPercent >= 0 ? colors.marketUp : colors.marketDown, bg: GRADIENTS.accent },
                { icon: 'trophy', label: 'Sharpe Ratio', value: m.sharpeRatio.toFixed(2), color: m.sharpeRatio >= 1 ? colors.marketUp : m.sharpeRatio >= 0 ? colors.warning : colors.marketDown, bg: GRADIENTS.gold },
                { icon: 'trending-down', label: 'Max Drawdown', value: formatPercent(m.maxDrawdownPercent), color: colors.danger, bg: GRADIENTS.danger },
                { icon: 'flag', label: 'Profit Factor', value: m.profitFactor.toFixed(2), color: m.profitFactor >= 2 ? colors.marketUp : m.profitFactor >= 1 ? colors.warning : colors.marketDown, bg: GRADIENTS.success },
                { icon: 'calendar', label: 'Avg Holding', value: `${m.avgHoldingDays}d`, color: colors.text, bg: GRADIENTS.purple },
              ].map((item, i) => (
                <LinearGradient key={i} colors={item.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.perfCard}>
                  <Ionicons name={item.icon as any} size={22} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.perfCardLabel}>{item.label}</Text>
                  <Text style={[styles.perfCardValue, { color: item.color }]}>{item.value}</Text>
                </LinearGradient>
              ))}
            </View>

            {/* Trade Statistics */}
            <Card title="Trade Statistics">
              <View style={styles.tradeStatRow}>
                <View style={styles.tradeStatItem}>
                  <Text style={styles.tradeStatNum}>{m.totalTrades}</Text>
                  <Text style={styles.tradeStatLabel}>Total</Text>
                </View>
                <View style={styles.tradeStatDivider} />
                <View style={styles.tradeStatItem}>
                  <Text style={[styles.tradeStatNum, { color: colors.marketUp }]}>{m.winningTrades}</Text>
                  <Text style={styles.tradeStatLabel}>Wins</Text>
                </View>
                <View style={styles.tradeStatDivider} />
                <View style={styles.tradeStatItem}>
                  <Text style={[styles.tradeStatNum, { color: colors.marketDown }]}>{m.losingTrades}</Text>
                  <Text style={styles.tradeStatLabel}>Losses</Text>
                </View>
                <View style={styles.tradeStatDivider} />
                <View style={styles.tradeStatItem}>
                  <Text style={styles.tradeStatNum}>{m.winRate.toFixed(0)}%</Text>
                  <Text style={styles.tradeStatLabel}>Win Rate</Text>
                </View>
              </View>
            </Card>

            {/* Detailed Metrics */}
            <Card title="Detailed Metrics">
              <MetricRow label="Average Win" value={formatCurrency(m.avgWin, true)} valueColor={colors.marketUp} />
              <View style={styles.metricDivider} />
              <MetricRow label="Average Loss" value={formatCurrency(m.avgLoss, true)} valueColor={colors.marketDown} />
              <View style={styles.metricDivider} />
              <MetricRow label="Profit Factor" value={m.profitFactor.toFixed(2)}
                valueColor={m.profitFactor >= 2 ? colors.marketUp : m.profitFactor >= 1 ? colors.warning : colors.marketDown} />
              <View style={styles.metricDivider} />
              <MetricRow label="Best Trade" value={formatCurrency(m.bestTrade, true)} valueColor={colors.marketUp} />
              <View style={styles.metricDivider} />
              <MetricRow label="Worst Trade" value={formatCurrency(m.worstTrade, true)} valueColor={colors.marketDown} />
              <View style={styles.metricDivider} />
              <MetricRow label="Max Consecutive Wins" value={String(m.consecutiveWins)} valueColor={colors.marketUp} />
              <View style={styles.metricDivider} />
              <MetricRow label="Max Consecutive Losses" value={String(m.consecutiveLosses)} valueColor={colors.marketDown} />
              <View style={styles.metricDivider} />
              <MetricRow label="Avg Holding Period" value={`${m.avgHoldingDays} days`} />
              <View style={styles.metricDivider} />
              <MetricRow label="Realized P&L" value={formatCurrency(m.realizedPnl, true)}
                valueColor={m.realizedPnl >= 0 ? colors.marketUp : colors.marketDown} />
              <View style={styles.metricDivider} />
              <MetricRow label="Unrealized P&L" value={formatCurrency(m.unrealizedPnl, true)}
                valueColor={m.unrealizedPnl >= 0 ? colors.marketUp : colors.marketDown} />
            </Card>

            {/* Investment Overview Progress */}
            <Card title="Investment Overview">
              {(() => {
                const invested = holdings.reduce((s, h) => s + h.totalInvested, 0) || 623500;
                const current = holdings.reduce((s, h) => s + h.currentValue, 0) || 673739;
                const progress = invested > 0 ? Math.min(current / invested * 100, 200) : 100;
                return (
                  <>
                    <View style={styles.investOverviewRow}>
                      <View style={styles.investOverviewItem}>
                        <Text style={styles.investOverviewLabel}>Invested</Text>
                        <Text style={styles.investOverviewValue}>{formatCurrency(invested, true)}</Text>
                      </View>
                      <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
                      <View style={styles.investOverviewItem}>
                        <Text style={styles.investOverviewLabel}>Current</Text>
                        <Text style={styles.investOverviewValue}>{formatCurrency(current, true)}</Text>
                      </View>
                    </View>
                    <View style={styles.investBarBg}>
                      <View style={[styles.investBarFill, {
                        width: `${progress}%`,
                        backgroundColor: m.totalReturn >= 0 ? colors.marketUp : colors.marketDown,
                      }]} />
                    </View>
                    <Text style={styles.investBarLabel}>
                      {formatPercent(m.totalReturnPercent)} return · {formatCurrency(m.totalReturn, true)} total
                    </Text>
                  </>
                );
              })()}
            </Card>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
           TAB 3: Tax Reports
           ══════════════════════════════════════════════════════ */}
        {activeTab === 'tax' && (
          <>
            {/* Tax Summary */}
            <Text style={styles.sectionTitle}>Capital Gains Tax Summary</Text>
            <LinearGradient colors={GRADIENTS.midnight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.taxSummaryCard}>
              <View style={styles.taxIconRow}>
                <View style={styles.taxIconCircle}>
                  <Ionicons name="document-text" size={28} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.taxSummaryTitle}>FY 2025-26 Estimated</Text>
                  <Text style={styles.taxSummarySub}>Based on trade history & holding periods</Text>
                </View>
              </View>

              <View style={styles.taxAmountRow}>
                <Text style={styles.taxAmountLabel}>Estimated Tax Liability</Text>
                <Text style={[styles.taxAmountValue, { color: cg.totalEstimatedTax > 0 ? colors.warning : colors.marketUp }]}>
                  {formatCurrency(cg.totalEstimatedTax, true)}
                </Text>
              </View>
            </LinearGradient>

            {/* STCG vs LTCG Breakdown */}
            <View style={styles.taxCardsRow}>
              <View style={styles.taxCard}>
                <View style={[styles.taxCardIcon, { backgroundColor: '#FFC10720' }]}>
                  <Ionicons name="time-outline" size={22} color={colors.warning} />
                </View>
                <Text style={styles.taxCardTitle}>Short-Term</Text>
                <Text style={[styles.taxCardAmount, { color: cg.shortTerm.gains >= 0 ? colors.marketUp : colors.marketDown }]}>
                  {cg.shortTerm.gains >= 0 ? '+' : ''}{formatCurrency(cg.shortTerm.gains, true)}
                </Text>
                <Text style={styles.taxCardDetail}>{cg.shortTerm.count} trades · {cg.shortTerm.taxRate}% tax</Text>
                <View style={styles.taxCardLine} />
                <View style={styles.taxCardRow}>
                  <Text style={styles.taxCardLabel}>Est. Tax</Text>
                  <Text style={[styles.taxCardValue, { color: colors.warning }]}>
                    {formatCurrency(cg.shortTerm.estimatedTax, true)}
                  </Text>
                </View>
              </View>
              <View style={styles.taxCard}>
                <View style={[styles.taxCardIcon, { backgroundColor: '#00C85320' }]}>
                  <Ionicons name="infinite-outline" size={22} color={colors.marketUp} />
                </View>
                <Text style={styles.taxCardTitle}>Long-Term</Text>
                <Text style={[styles.taxCardAmount, { color: cg.longTerm.gains >= 0 ? colors.marketUp : colors.marketDown }]}>
                  {cg.longTerm.gains >= 0 ? '+' : ''}{formatCurrency(cg.longTerm.gains, true)}
                </Text>
                <Text style={styles.taxCardDetail}>{cg.longTerm.count} trades · {cg.longTerm.taxRate}% tax</Text>
                <View style={styles.taxCardLine} />
                <View style={styles.taxCardRow}>
                  <Text style={styles.taxCardLabel}>Exempt (₹1L)</Text>
                  <Text style={styles.taxCardValue}>{formatCurrency(cg.longTerm.exemptLimit, true)}</Text>
                </View>
                <View style={styles.taxCardRow}>
                  <Text style={styles.taxCardLabel}>Taxable</Text>
                  <Text style={[styles.taxCardValue, { color: cg.longTerm.taxableGains > 0 ? colors.warning : colors.marketUp }]}>
                    {formatCurrency(cg.longTerm.taxableGains, true)}
                  </Text>
                </View>
                <View style={styles.taxCardRow}>
                  <Text style={styles.taxCardLabel}>Est. Tax</Text>
                  <Text style={[styles.taxCardValue, { color: colors.warning }]}>
                    {formatCurrency(cg.longTerm.estimatedTax, true)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Tax Rules Info */}
            <Card title="Tax Rules (India FY 2025-26)">
              <View style={styles.taxInfoRow}>
                <Ionicons name="information-circle" size={18} color={colors.primary} />
                <Text style={styles.taxInfoText}>
                  STCG on equity: 15% if held ≤12 months
                </Text>
              </View>
              <View style={styles.taxInfoDivider} />
              <View style={styles.taxInfoRow}>
                <Ionicons name="information-circle" size={18} color={colors.marketUp} />
                <Text style={styles.taxInfoText}>
                  LTCG on equity: 10% above ₹1L if held &gt;12 months
                </Text>
              </View>
              <View style={styles.taxInfoDivider} />
              <View style={styles.taxInfoRow}>
                <Ionicons name="information-circle" size={18} color={colors.warning} />
                <Text style={styles.taxInfoText}>
                  STT paid: {formatCurrency(cg.sttPaid, true)} · Brokerage: {formatCurrency(cg.totalBrokerage, true)}
                </Text>
              </View>
            </Card>

            {/* Tax Saving Tip */}
            <Card title="Tax Saving Tips">
              <View style={styles.taxTipRow}>
                <View style={styles.taxTipIcon}>
                  <Ionicons name="bulb" size={20} color={colors.warning} />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.taxTipTitle}>Tax Harvesting</Text>
                  <Text style={styles.taxTipDesc}>
                    If your LTCG is close to ₹1L, consider selling and repurchasing to reset your cost basis without paying any tax.
                  </Text>
                </View>
              </View>
              <View style={styles.taxTipDivider} />
              <View style={styles.taxTipRow}>
                <View style={styles.taxTipIcon}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.marketUp} />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={styles.taxTipTitle}>Section 80C — ELSS</Text>
                  <Text style={styles.taxTipDesc}>
                    Invest up to ₹1.5L in ELSS mutual funds for tax deduction under Section 80C. 3-year lock-in period applies.
                  </Text>
                </View>
              </View>
            </Card>
          </>
        )}

        {/* ══════════════════════════════════════════════════════
           TAB 4: Holdings / Sector
           ══════════════════════════════════════════════════════ */}
        {activeTab === 'holdings' && (
          <>
            {/* Sector Allocation */}
            <Text style={styles.sectionTitle}>Sector Allocation</Text>
            <View style={styles.sectorCard}>
              {analytics.sectorAllocation.map((sector, i) => (
                <View key={sector.sector}>
                  <View style={styles.sectorRow}>
                    <View style={styles.sectorLeft}>
                      <View style={[styles.sectorDot, {
                        backgroundColor: sector.sector === 'Finance' ? colors.finance
                          : sector.sector === 'Technology' ? colors.tech
                          : sector.sector === 'Energy' ? colors.energy
                          : sector.sector === 'Consumer' ? colors.consumer
                          : sector.sector === 'Automobile' ? colors.industrial
                          : colors.primary,
                      }]} />
                      <Text style={styles.sectorName}>{sector.sector}</Text>
                      <Text style={styles.sectorCount}>({sector.count})</Text>
                    </View>
                    <Text style={styles.sectorPercent}>{sector.percent.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.sectorBarBg}>
                    <View style={[styles.sectorBarFill, {
                      width: `${sector.percent}%`,
                      backgroundColor: sector.sector === 'Finance' ? colors.finance
                        : sector.sector === 'Technology' ? colors.tech
                        : sector.sector === 'Energy' ? colors.energy
                        : sector.sector === 'Consumer' ? colors.consumer
                        : sector.sector === 'Automobile' ? colors.industrial
                        : colors.primary,
                    }]} />
                  </View>
                  <Text style={styles.sectorValue}>{formatCurrency(sector.value, true)}</Text>
                  {i < analytics.sectorAllocation.length - 1 && <View style={styles.sectorDivider} />}
                </View>
              ))}
            </View>

            {/* Holdings List */}
            <Text style={styles.sectionTitle}>Holdings</Text>
            {holdings.length > 0 ? (
              holdings.map(h => (
                <TouchableOpacity
                  key={h.id}
                  style={styles.holdingItem}
                  onPress={() => navigation.navigate('StockDetail', { stockId: h.stockId, symbol: h.symbol })}
                  onLongPress={() => handleHoldingLongPress(h)}
                  delayLongPress={500}
                >
                  <View style={styles.holdingTop}>
                    <View style={styles.holdingSymbolRow}>
                      <View style={[styles.holdingIcon, { backgroundColor: h.pnl >= 0 ? '#00C85320' : '#FF174420' }]}>
                        <Text style={[styles.holdingIconText, { color: h.pnl >= 0 ? colors.marketUp : colors.marketDown }]}>
                          {h.symbol[0]}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.holdingSymbol}>{h.symbol}</Text>
                        <Text style={styles.holdingName} numberOfLines={1}>{h.name}</Text>
                      </View>
                    </View>
                    <Text style={[styles.holdingPnl, { color: h.pnl >= 0 ? colors.marketUp : colors.marketDown }]}>
                      {h.pnl >= 0 ? '+' : ''}{formatPercent(h.pnlPercent)}
                    </Text>
                  </View>
                  <View style={styles.holdingDetails}>
                    <Text style={styles.holdingDetail}>{h.quantity} shares @ {formatCurrency(h.buyPrice)}</Text>
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
                  <Text style={styles.emptySubtitle}>Start investing to see your holdings here</Text>
                </View>
              </Card>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════
           TAB 5: Historical P&L
           ══════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <>
            {/* History Chart — longer timeframes */}
            <Text style={styles.sectionTitle}>Historical P&L</Text>
            <PnLChart
              data={analytics.pnlHistory}
              timeframe={histPeriod}
              onTimeframeChange={setHistPeriod}
              height={220}
              autoRefresh={false}
            />

            {/* Side-by-Side Period Comparison */}
            {analytics.pnlHistory.length >= 4 && (() => {
              const hist = analytics.pnlHistory;
              const mid = Math.floor(hist.length / 2);
              const currentPeriod = hist.slice(mid);
              const previousPeriod = hist.slice(0, mid + 1);

              const cpStart = currentPeriod[0].cumulativePnl;
              const cpEnd = currentPeriod[currentPeriod.length - 1].cumulativePnl;
              const ppStart = previousPeriod[0].cumulativePnl;
              const ppEnd = previousPeriod[previousPeriod.length - 1].cumulativePnl;

              const cpReturn = cpEnd - cpStart;
              const ppReturn = ppEnd - ppStart;

              // Volatility (std dev of daily returns)
              const calcVol = (points: typeof hist) => {
                const returns: number[] = [];
                for (let i = 1; i < points.length; i++) {
                  const prev = totalInvested + points[i - 1].cumulativePnl;
                  const curr = totalInvested + points[i].cumulativePnl;
                  if (prev > 0) returns.push((curr - prev) / prev);
                }
                const avg = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
                const variance = returns.reduce((s, r) => s + (r - avg) ** 2, 0) / (returns.length || 1);
                return Math.sqrt(variance) * Math.sqrt(252); // annualized
              };
              const cpVol = calcVol(currentPeriod) * 100;
              const ppVol = calcVol(previousPeriod) * 100;

              // Win days
              const calcWinDays = (points: typeof hist) => {
                let wins = 0;
                for (let i = 1; i < points.length; i++) {
                  if (points[i].cumulativePnl > points[i - 1].cumulativePnl) wins++;
                }
                return { wins, total: points.length - 1 };
              };
              const cpWin = calcWinDays(currentPeriod);
              const ppWin = calcWinDays(previousPeriod);
              const totalInvested = holdings.reduce((s, h) => s + h.totalInvested, 0) || 623500;

              return (
                <>
                  <Text style={styles.sectionTitle}>Period Comparison</Text>
                  <View style={styles.histCardsRow}>
                    {/* Current Period */}
                    <LinearGradient colors={GRADIENTS.midnight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.histPeriodCard}>
                      <Text style={styles.histPeriodLabel}>Current Period</Text>
                      <Text style={styles.histPeriodDate}>
                        {new Date(currentPeriod[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {new Date(currentPeriod[currentPeriod.length - 1].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                      <View style={styles.histPeriodDivider} />
                      <View style={styles.histMetricRow}>
                        <Ionicons name={cpReturn >= 0 ? 'trending-up' : 'trending-down'} size={16} color={cpReturn >= 0 ? colors.marketUp : colors.marketDown} />
                        <Text style={[styles.histMetricValue, { color: cpReturn >= 0 ? colors.marketUp : colors.marketDown }]}>
                          {cpReturn >= 0 ? '+' : ''}{formatCurrency(cpReturn, true)}
                        </Text>
                        <Text style={styles.histMetricLabel}>Return</Text>
                      </View>
                      <View style={styles.histMetricRow}>
                        <Ionicons name="pulse" size={16} color={colors.warning} />
                        <Text style={[styles.histMetricValue, { color: colors.warning }]}>{cpVol.toFixed(1)}%</Text>
                        <Text style={styles.histMetricLabel}>Volatility</Text>
                      </View>
                      <View style={styles.histMetricRow}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.marketUp} />
                        <Text style={[styles.histMetricValue, { color: colors.marketUp }]}>{cpWin.wins}/{cpWin.total}</Text>
                        <Text style={styles.histMetricLabel}>Win Days</Text>
                      </View>
                    </LinearGradient>

                    {/* Previous Period */}
                    <LinearGradient colors={GRADIENTS.midnight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.histPeriodCard}>
                      <Text style={styles.histPeriodLabel}>Previous Period</Text>
                      <Text style={styles.histPeriodDate}>
                        {new Date(previousPeriod[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {new Date(previousPeriod[previousPeriod.length - 1].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                      <View style={styles.histPeriodDivider} />
                      <View style={styles.histMetricRow}>
                        <Ionicons name={ppReturn >= 0 ? 'trending-up' : 'trending-down'} size={16} color={ppReturn >= 0 ? colors.marketUp : colors.marketDown} />
                        <Text style={[styles.histMetricValue, { color: ppReturn >= 0 ? colors.marketUp : colors.marketDown }]}>
                          {ppReturn >= 0 ? '+' : ''}{formatCurrency(ppReturn, true)}
                        </Text>
                        <Text style={styles.histMetricLabel}>Return</Text>
                      </View>
                      <View style={styles.histMetricRow}>
                        <Ionicons name="pulse" size={16} color={colors.warning} />
                        <Text style={[styles.histMetricValue, { color: colors.warning }]}>{ppVol.toFixed(1)}%</Text>
                        <Text style={styles.histMetricLabel}>Volatility</Text>
                      </View>
                      <View style={styles.histMetricRow}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.marketUp} />
                        <Text style={[styles.histMetricValue, { color: colors.marketUp }]}>{ppWin.wins}/{ppWin.total}</Text>
                        <Text style={styles.histMetricLabel}>Win Days</Text>
                      </View>
                    </LinearGradient>
                  </View>

                  {/* Comparison Delta Bar */}
                  <View style={styles.histDeltaRow}>
                    <View style={styles.histDeltaItem}>
                      <Text style={styles.histDeltaLabel}>Return Change</Text>
                      <Text style={[styles.histDeltaValue, { color: cpReturn >= ppReturn ? colors.marketUp : colors.marketDown }]}>
                        {cpReturn >= ppReturn ? '+' : ''}{formatCurrency(cpReturn - ppReturn, true)}
                      </Text>
                    </View>
                    <View style={styles.histDeltaDivider} />
                    <View style={styles.histDeltaItem}>
                      <Text style={styles.histDeltaLabel}>Volatility Change</Text>
                      <Text style={[styles.histDeltaValue, { color: cpVol <= ppVol ? colors.marketUp : colors.marketDown }]}>
                        {cpVol >= ppVol ? '+' : ''}{(cpVol - ppVol).toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.histDeltaDivider} />
                    <View style={styles.histDeltaItem}>
                      <Text style={styles.histDeltaLabel}>Win Rate Change</Text>
                      <Text style={[styles.histDeltaValue, { color: (cpWin.wins / cpWin.total) >= (ppWin.wins / ppWin.total) ? colors.marketUp : colors.marketDown }]}>
                        {((cpWin.wins / cpWin.total) - (ppWin.wins / ppWin.total) >= 0 ? '+' : '')}{(((cpWin.wins / cpWin.total) - (ppWin.wins / ppWin.total)) * 100).toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </>
              );
            })()}

            {/* Yearly Returns Breakdown */}
            {analytics.monthlyReturns.length > 0 && (() => {
              // Group monthly returns by year
              const byYear = new Map<string, { months: number; return: number; returnPercent: number; contributions: number; startValue: number }>();
              for (const mr of analytics.monthlyReturns) {
                const year = mr.month.slice(0, 4);
                if (!byYear.has(year)) byYear.set(year, { months: 0, return: 0, returnPercent: 0, contributions: 0, startValue: 0 });
                const entry = byYear.get(year)!;
                entry.months++;
                entry.return += mr.return;
                entry.contributions += mr.contributions;
                if (entry.startValue === 0) entry.startValue = mr.startValue;
              }

              // Compute annual return percent
              for (const [, entry] of byYear) {
                entry.returnPercent = entry.startValue > 0
                  ? (entry.return / entry.startValue) * 100
                  : 0;
              }

              const years = Array.from(byYear.entries()).sort(([a], [b]) => b.localeCompare(a));

              return (
                <>
                  <Text style={styles.sectionTitle}>Yearly Returns</Text>
                  <View style={styles.yearlyCard}>
                    {years.map(([year, data], i) => {
                      const isPos = data.return >= 0;
                      return (
                        <View key={year}>
                          <View style={styles.yearlyRow}>
                            <View style={styles.yearLeft}>
                              <View style={[styles.yearDot, { backgroundColor: isPos ? colors.marketUp : colors.marketDown }]} />
                              <Text style={styles.yearLabel}>{year}</Text>
                              <View style={[styles.yearBadge, { backgroundColor: isPos ? '#00C85320' : '#FF174420' }]}>
                                <Ionicons name={isPos ? 'caret-up' : 'caret-down'} size={12} color={isPos ? colors.marketUp : colors.marketDown} />
                                <Text style={[styles.yearBadgeText, { color: isPos ? colors.marketUp : colors.marketDown }]}>
                                  {data.returnPercent.toFixed(1)}%
                                </Text>
                              </View>
                            </View>
                            <View style={styles.yearRight}>
                              <Text style={[styles.yearReturn, { color: isPos ? colors.marketUp : colors.marketDown }]}>
                                {isPos ? '+' : ''}{formatCurrency(data.return, true)}
                              </Text>
                              <Text style={styles.yearMonths}>{data.months} months</Text>
                            </View>
                          </View>
                          {/* Yearly performance bar */}
                          <View style={styles.yearBarBg}>
                            <View style={[styles.yearBarFill, {
                              width: `${Math.min(Math.abs(data.returnPercent), 50)}%`,
                              backgroundColor: isPos ? colors.marketUp : colors.marketDown,
                              alignSelf: isPos ? 'flex-start' : 'flex-end',
                            }]} />
                          </View>
                          {i < years.length - 1 && <View style={styles.yearlyDivider} />}
                        </View>
                      );
                    })}
                  </View>
                </>
              );
            })()}

            {/* Summary Stats */}
            {analytics.pnlHistory.length >= 4 && (() => {
              const hist = analytics.pnlHistory;
              const first = hist[0].cumulativePnl;
              const last = hist[hist.length - 1].cumulativePnl;
              const totalReturnOverPeriod = last - first;
              const peak = Math.max(...hist.map(p => p.cumulativePnl));
              const trough = Math.min(...hist.map(p => p.cumulativePnl));
              const range = peak - trough;
              const positiveDays = hist.filter((p, i) => i > 0 && p.cumulativePnl > hist[i - 1].cumulativePnl).length;
              const totalDays = hist.length - 1;
              const winRatePct = totalDays > 0 ? (positiveDays / totalDays * 100).toFixed(0) : '0';

              return (
                <Card title="Full Period Summary">
                  <View style={styles.histSummaryGrid}>
                    <View style={styles.histSummaryItem}>
                      <Ionicons name="cash-outline" size={20} color={totalReturnOverPeriod >= 0 ? colors.marketUp : colors.marketDown} style={{ marginBottom: 4 }} />
                      <Text style={[styles.histSummaryValue, { color: totalReturnOverPeriod >= 0 ? colors.marketUp : colors.marketDown }]}>
                        {totalReturnOverPeriod >= 0 ? '+' : ''}{formatCurrency(totalReturnOverPeriod, true)}
                      </Text>
                      <Text style={styles.histSummaryLabel}>Total P&L</Text>
                    </View>
                    <View style={styles.histSummaryItem}>
                      <Ionicons name="arrow-up-circle" size={20} color={colors.marketUp} style={{ marginBottom: 4 }} />
                      <Text style={[styles.histSummaryValue, { color: colors.marketUp }]}>{formatCurrency(peak, true)}</Text>
                      <Text style={styles.histSummaryLabel}>Peak</Text>
                    </View>
                    <View style={styles.histSummaryItem}>
                      <Ionicons name="arrow-down-circle" size={20} color={colors.marketDown} style={{ marginBottom: 4 }} />
                      <Text style={[styles.histSummaryValue, { color: colors.marketDown }]}>{formatCurrency(trough, true)}</Text>
                      <Text style={styles.histSummaryLabel}>Trough</Text>
                    </View>
                    <View style={styles.histSummaryItem}>
                      <Ionicons name="resize" size={20} color={colors.warning} style={{ marginBottom: 4 }} />
                      <Text style={[styles.histSummaryValue, { color: colors.warning }]}>{formatCurrency(range, true)}</Text>
                      <Text style={styles.histSummaryLabel}>Range</Text>
                    </View>
                    <View style={styles.histSummaryItem}>
                      <Ionicons name="checkmark-done" size={20} color={colors.marketUp} style={{ marginBottom: 4 }} />
                      <Text style={[styles.histSummaryValue, { color: colors.marketUp }]}>{positiveDays}/{totalDays}</Text>
                      <Text style={styles.histSummaryLabel}>Positive Days</Text>
                    </View>
                    <View style={styles.histSummaryItem}>
                      <Ionicons name="analytics" size={20} color={colors.primary} style={{ marginBottom: 4 }} />
                      <Text style={[styles.histSummaryValue, { color: colors.primary }]}>{winRatePct}%</Text>
                      <Text style={styles.histSummaryLabel}>Day Win Rate</Text>
                    </View>
                  </View>
                </Card>
              );
            })()}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Export Format Modal ─────────────────────────────── */}
      <Modal visible={showExportModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowExportModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Export Report</Text>
            <Text style={styles.modalSubtitle}>Choose a format to download your portfolio report</Text>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => handleExport('pdf')}
              disabled={exporting}
            >
              <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.exportOptionIcon}>
                <Ionicons name="document-text" size={22} color={colors.white} />
              </LinearGradient>
              <View style={styles.exportOptionText}>
                <Text style={styles.exportOptionLabel}>PDF Report</Text>
                <Text style={styles.exportOptionDesc}>Styled report with tables &amp; charts — perfect for printing or sharing</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => handleExport('csv')}
              disabled={exporting}
            >
              <LinearGradient colors={GRADIENTS.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.exportOptionIcon}>
                <Ionicons name="grid" size={22} color={colors.white} />
              </LinearGradient>
              <View style={styles.exportOptionText}>
                <Text style={styles.exportOptionLabel}>CSV (Spreadsheet)</Text>
                <Text style={styles.exportOptionDesc}>Raw data for Excel, Google Sheets, or other analysis tools</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportCancel}
              onPress={() => setShowExportModal(false)}
            >
              <Text style={styles.exportCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  headerContent: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  title: { ...FONTS.bold, fontSize: FONTS.size.title, color: colors.text },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, marginTop: 2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#00C85320',
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#00C853',
  },
  liveBadgeText: {
    fontSize: 9, fontWeight: '700', color: '#00C853',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  shareBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  exportBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Snapshot ──
  snapshotCard: {
    padding: SPACING.xl, borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1, borderColor: colors.border, marginBottom: SPACING.lg,
  },
  snapshotTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.lg },
  snapshotLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textSecondary },
  snapshotValue: { ...FONTS.bold, fontSize: FONTS.size.xxl, color: colors.text, marginTop: 4 },
  snapshotReturnRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 4 },
  snapshotReturn: { ...FONTS.extraBold, fontSize: FONTS.size.lg },
  snapshotBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  snapshotBadgeText: { ...FONTS.medium, fontSize: FONTS.size.xs },
  snapshotGrid: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
  },
  snapshotItem: { flex: 1, alignItems: 'center' },
  snapshotItemValue: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.text },
  snapshotItemLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textSecondary, marginTop: 2 },
  snapshotDivider: { width: 1, height: 30, backgroundColor: colors.border, alignSelf: 'center' },

  // ── Tabs ──
  tabRow: {
    flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...FONTS.medium, fontSize: FONTS.size.xs, color: colors.textMuted },
  tabTextActive: { color: colors.white },

  // ── Section Title ──
  sectionTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.text, marginBottom: SPACING.md },

  // ── P&L Tab ──
  pnlSummaryRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg, marginBottom: SPACING.lg },
  pnlSummaryCard: {
    flex: 1, padding: SPACING.lg, borderRadius: BORDER_RADIUS.md,
  },
  pnlSummaryLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: 'rgba(255,255,255,0.7)' },
  pnlSummaryValue: { ...FONTS.bold, fontSize: FONTS.size.xl, marginTop: 4 },
  pnlSummarySub: { ...FONTS.regular, fontSize: FONTS.size.xs, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  dayPnlRow: { flexDirection: 'row', gap: SPACING.xl },
  dayPnlItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dayPnlLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted },
  dayPnlValue: { ...FONTS.semiBold, fontSize: FONTS.size.md, marginTop: 2 },
  monthlyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  monthlyLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text, width: 60 },
  monthlyBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  monthlyBarFill: { height: '100%', borderRadius: 4 },
  monthlyValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm, width: 70, textAlign: 'right' },
  monthlyDivider: { height: 1, backgroundColor: colors.divider },

  // ── Performance Tab ──
  perfGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
  perfCard: {
    width: (width - SPACING.xl * 2 - SPACING.md) / 2,
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, gap: SPACING.xs,
  },
  perfCardLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: 'rgba(255,255,255,0.7)' },
  perfCardValue: { ...FONTS.bold, fontSize: FONTS.size.lg },
  tradeStatRow: { flexDirection: 'row' },
  tradeStatItem: { flex: 1, alignItems: 'center' },
  tradeStatNum: { ...FONTS.black, fontSize: FONTS.size.xxl, color: colors.text },
  tradeStatLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },
  tradeStatDivider: { width: 1, height: 40, backgroundColor: colors.divider, alignSelf: 'center' },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  metricLabel: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary },
  metricVal: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },
  metricDivider: { height: 1, backgroundColor: colors.divider },
  highlightValue: { ...FONTS.bold, fontSize: FONTS.size.lg },
  investOverviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  investOverviewItem: { alignItems: 'center' },
  investOverviewLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted },
  investOverviewValue: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.text, marginTop: 2 },
  investBarBg: { height: 10, backgroundColor: colors.bgInput, borderRadius: 5, overflow: 'hidden' },
  investBarFill: { height: '100%', borderRadius: 5 },
  investBarLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, textAlign: 'right', marginTop: 4 },

  // ── Tax Tab ──
  taxSummaryCard: { padding: SPACING.xl, borderRadius: BORDER_RADIUS.xl, marginBottom: SPACING.lg },
  taxIconRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  taxIconCircle: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  taxSummaryTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.text },
  taxSummarySub: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },
  taxAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taxAmountLabel: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary },
  taxAmountValue: { ...FONTS.extraBold, fontSize: FONTS.size.xxl },
  taxCardsRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  taxCard: { flex: 1, backgroundColor: colors.bgCard, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: colors.border },
  taxCardIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  taxCardTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },
  taxCardAmount: { ...FONTS.bold, fontSize: FONTS.size.lg, marginTop: 2 },
  taxCardDetail: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },
  taxCardLine: { height: 1, backgroundColor: colors.divider, marginVertical: SPACING.sm },
  taxCardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  taxCardLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted },
  taxCardValue: { ...FONTS.medium, fontSize: FONTS.size.xs, color: colors.text },
  taxInfoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  taxInfoText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, flex: 1 },
  taxInfoDivider: { height: 1, backgroundColor: colors.divider },
  taxTipRow: { flexDirection: 'row', paddingVertical: SPACING.md },
  taxTipIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  taxTipTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },
  taxTipDesc: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  taxTipDivider: { height: 1, backgroundColor: colors.divider },

  // ── Holdings Tab ──
  sectorCard: { backgroundColor: colors.bgCard, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: colors.border, marginBottom: SPACING.lg },
  sectorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectorDot: { width: 10, height: 10, borderRadius: 5 },
  sectorName: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text },
  sectorCount: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted },
  sectorPercent: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },
  sectorBarBg: { height: 8, backgroundColor: colors.bgInput, borderRadius: 4, overflow: 'hidden' },
  sectorBarFill: { height: '100%', borderRadius: 4 },
  sectorValue: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, textAlign: 'right', marginTop: 2 },
  sectorDivider: { height: 1, backgroundColor: colors.divider, marginVertical: SPACING.md },
  holdingItem: { backgroundColor: colors.bgCard, padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: colors.border },
  holdingTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  holdingSymbolRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  holdingIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  holdingIconText: { ...FONTS.bold, fontSize: FONTS.size.md },
  holdingSymbol: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.text },
  holdingName: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, maxWidth: width * 0.35 },
  holdingPnl: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  holdingDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  holdingDetail: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted },
  holdingProgressBg: { height: 4, backgroundColor: colors.bgInput, borderRadius: 2, overflow: 'hidden' },
  holdingProgressFill: { height: '100%', borderRadius: 2 },

  // ── History Tab ──
  histPeriodCard: {
    flex: 1, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  histPeriodLabel: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },
  histPeriodDate: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },
  histPeriodDivider: { height: 1, backgroundColor: colors.divider, marginVertical: SPACING.sm },
  histMetricRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 3 },
  histMetricValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  histMetricLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted },
  histCardsRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  histDeltaRow: {
    flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: colors.border, marginBottom: SPACING.lg,
  },
  histDeltaItem: { flex: 1, alignItems: 'center' },
  histDeltaLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginBottom: 2 },
  histDeltaValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  histDeltaDivider: { width: 1, height: 30, backgroundColor: colors.divider, alignSelf: 'center' },
  yearlyCard: { backgroundColor: colors.bgCard, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: colors.border, marginBottom: SPACING.lg },
  yearlyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  yearLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  yearDot: { width: 8, height: 8, borderRadius: 4 },
  yearLabel: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.text },
  yearBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  yearBadgeText: { ...FONTS.medium, fontSize: FONTS.size.xs },
  yearRight: { alignItems: 'flex-end' },
  yearReturn: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  yearMonths: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 1 },
  yearBarBg: { height: 6, backgroundColor: colors.bgInput, borderRadius: 3, overflow: 'hidden', marginTop: SPACING.sm },
  yearBarFill: { height: '100%', borderRadius: 3 },
  yearlyDivider: { height: 1, backgroundColor: colors.divider, marginVertical: SPACING.md },
  histSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  histSummaryItem: { width: (width - SPACING.xl * 2 - SPACING.xl * 2 - SPACING.md) / 2, alignItems: 'center', paddingVertical: SPACING.sm },
  histSummaryValue: { ...FONTS.bold, fontSize: FONTS.size.md },
  histSummaryLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },

  // ── Empty State ──
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  emptyTitle: { ...FONTS.semiBold, fontSize: FONTS.size.lg, color: colors.text },
  emptySubtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted, textAlign: 'center' },

  // ── Export Modal ──
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.bgCard, borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    paddingBottom: SPACING.xxxl + SPACING.lg,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.textMuted + '40',
    alignSelf: 'center', marginBottom: SPACING.lg,
  },
  modalTitle: { ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.text, marginBottom: 4 },
  modalSubtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted, marginBottom: SPACING.xl },
  exportOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.lg, paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.sm,
    backgroundColor: colors.bgSecondary,
  },
  exportOptionIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  exportOptionText: { flex: 1, marginLeft: SPACING.md, marginRight: SPACING.sm },
  exportOptionLabel: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.text },
  exportOptionDesc: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },
  exportCancel: {
    alignItems: 'center', paddingVertical: SPACING.lg, marginTop: SPACING.sm,
  },
  exportCancelText: { ...FONTS.medium, fontSize: FONTS.size.md, color: colors.textMuted },
});
