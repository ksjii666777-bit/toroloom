/**
 * ============================================================================
 * Toroloom — Period Report Screen (Weekly / Monthly)
 * ============================================================================
 *
 * Dedicated report screen that brings together:
 *   1. Period selector (Weekly / Monthly / Yearly)
 *   2. P&L summary (realized + unrealized, best/worst trade)
 *   3. Tax breakdown (STCG @15%, LTCG @10% over ₹1L)
 *   4. Behavioral alerts (over-trading, brokerage leakage, concentration)
 *   5. Period-by-period P&L breakdown with visual bars
 *   6. Loss breakdown by stock
 *   7. Period comparison (current vs previous)
 *
 * Data sources:
 *   - usePortfolioAnalyticsStore → metrics, capital gains, monthly returns
 *   - usePortfolioStore → holdings, trades
 *   - computeCognitiveSummary → behavioral alerts (over-trading etc.)
 *
 * ============================================================================
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { usePortfolioStore } from '../../store/portfolioStore';
import { usePortfolioAnalyticsStore } from '../../store/portfolioAnalyticsStore';
import { SPACING } from '../../constants/theme';

import { buildPeriodReportHTML } from '../../utils/periodReportPDF';
import { computeSectorMetrics, groupTradesByPeriod, groupLosersBySector } from '../../utils/analytics/periodAnalytics';
import type { PeriodType } from '../../utils/analytics/periodAnalytics';
import CognitiveAlertsCard from '../../components/CognitiveAlertsCard';
import PeriodBreakdownCard from '../../components/PeriodBreakdownCard';
import LossBreakdownCard from '../../components/LossBreakdownCard';
import BestWorstTradeCard from '../../components/BestWorstTradeCard';
import DetailedMetricsCard from '../../components/DetailedMetricsCard';
import PortfolioSnapshotCard from '../../components/PortfolioSnapshotCard';
import PnLBreakdownCard from '../../components/PnLBreakdownCard';
import TaxSummaryCard from '../../components/TaxSummaryCard';
import SectorMetricsCard from '../../components/SectorMetricsCard';
import ReportHeader from '../../components/ReportHeader';
import PeriodTabs from '../../components/PeriodTabs';
import EmptyReportState from '../../components/EmptyReportState';
import { computeCognitiveSummary } from '../../services/gateway/cognitiveAnalytics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';


// ──── Main Screen ───────────────────────────────────────────────────────────

export default function PeriodReportScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'PeriodReport'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { holdings, trades } = usePortfolioStore();
  const analytics = usePortfolioAnalyticsStore(s => s.getAnalytics());
  const m = analytics.metrics;
  const cg = analytics.capitalGains;

  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [refreshing, setRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ── Compute period summaries ─────────────────────────────────
  const periods = useMemo(
    () => groupTradesByPeriod(trades, holdings, periodType),
    [trades, holdings, periodType],
  );

  // ── Cognitive analytics for behavioral alerts ────────────────
  const cognitiveSummary = useMemo(() => {
    if (trades.length === 0 && holdings.length === 0) return null;
    // Convert trades to ParsedTrade format needed by cognitiveAnalytics
    const parsedTrades = trades
      .filter(t => t.type === 'sell')
      .map(t => ({
        execution_timestamp: t.timestamp,
        asset_symbol: t.symbol,
        transaction_type: 'SELL' as const,
        filled_quantity: t.quantity,
        execution_price: t.price,
        regulatory_fees: Math.abs(t.total) * 0.001, // ~0.1% STT estimate
      }));
    return computeCognitiveSummary(parsedTrades, holdings);
  }, [trades, holdings]);

  // ── Sector-grouped losers ───────────────────────────────
  const sectorLosers = useMemo(() => groupLosersBySector(holdings), [holdings]);

  // ── Holdings buy price lookup ──────────────────────────
  const holdingsBuyPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of holdings) {
      if (!map.has(h.symbol)) map.set(h.symbol, h.buyPrice);
    }
    return map;
  }, [holdings]);

  // ── Sector-wise trade metrics ──────────────────────────
  const sectorMetrics = useMemo(() => computeSectorMetrics(trades), [trades]);
  // ── Refresh ──────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // ── Export PDF ────────────────────────────────────────────────
  const exportToPDF = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const periodLabel = periodType === 'weekly' ? t('periodReport.weekly') :
        periodType === 'monthly' ? t('periodReport.monthly') :
        t('periodReport.yearly');

      const html = buildPeriodReportHTML(
        m, cg, sectorLosers, sectorMetrics, periods, cognitiveSummary, periodLabel, holdings,
      );

      const { uri } = await Print.printToFileAsync({ html, width: 595.28 });

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        Alert.alert(t('periodReport.pdfSharingUnavailable'));
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: t('periodReport.exportPdf'),
      });
    } catch (err) {
      console.error('[PeriodReport] PDF export failed:', err);
      Alert.alert(t('periodReport.pdfFailed'));
    } finally {
      setIsExporting(false);
    }
  }, [m, cg, sectorLosers, sectorMetrics, periods, cognitiveSummary, holdings, periodType, isExporting, t]);

  // ── Subscribe to live updates ────────────────────────────────
  const subscribe = usePortfolioAnalyticsStore(s => s.subscribeToLiveUpdates);
  const unsubscribe = usePortfolioAnalyticsStore(s => s.unsubscribeFromLiveUpdates);
  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);

  // ── Render ───────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <ReportHeader
        navigation={navigation}
        hasAnalytics={!!analytics}
        isExporting={isExporting}
        onExport={exportToPDF}
      />

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
        {/* ── Period Type Tabs ─────────────────────────────── */}
        <PeriodTabs periodType={periodType} onSelect={setPeriodType} />

        {/* ── Portfolio Snapshot ───────────────────────────── */}
        <PortfolioSnapshotCard metrics={m} />

        {/* ── P&L Breakdown Cards ─────────────────────────── */}
        <PnLBreakdownCard realizedPnl={m.realizedPnl} unrealizedPnl={m.unrealizedPnl} />

        {/* ── Period-by-Period Breakdown ──────────────────── */}
        <PeriodBreakdownCard periods={periods} />

        {/* ── Best / Worst Trade ──────────────────────────── */}
        <BestWorstTradeCard bestTrade={m.bestTrade} worstTrade={m.worstTrade} />

        {/* ── Tax Summary ─────────────────────────────────── */}
        <TaxSummaryCard cg={cg} />

        {/* ── Behavioral / Overtrading Alerts ─────────────── */}
        <Animated.View entering={FadeInUp.duration(400).delay(300)} testID="cognitive-alerts-container">
          <CognitiveAlertsCard cognitiveSummary={cognitiveSummary} />
        </Animated.View>

        {/* ── Loss Breakdown — Sector Grouped ────────────── */}
        {(sectorLosers.length > 0 || holdings.length > 0) && (
          <Animated.View entering={FadeInUp.duration(400).delay(350)} testID="loss-breakdown-container">
            <LossBreakdownCard sectorLosers={sectorLosers} holdingsCount={holdings.length} />
          </Animated.View>
        )}

        {/* ── Detailed Metrics ────────────────────────────── */}
        <DetailedMetricsCard
          avgWin={m.avgWin}
          avgLoss={m.avgLoss}
          profitFactor={m.profitFactor}
          avgHoldingDays={m.avgHoldingDays}
        />

        {/* ── Sector-wise Trade Metrics (expandable) ──────── */}
        {sectorMetrics.length > 0 && (
          <Animated.View entering={FadeInUp.duration(400).delay(450)} testID="sector-metrics-container">
            <SectorMetricsCard sectorMetrics={sectorMetrics} holdingsBuyPriceMap={holdingsBuyPriceMap} />
          </Animated.View>
        )}

        {/* ── Empty state ──────────────────────────────────── */}
        {trades.length === 0 && holdings.length === 0 && (
          <Animated.View entering={FadeInUp.duration(400)}>
            <EmptyReportState />
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },


});
