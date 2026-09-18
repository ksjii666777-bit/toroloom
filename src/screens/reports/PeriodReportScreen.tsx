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
  StyleSheet,
  Alert,
  Text,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { usePortfolioStore } from '../../store/portfolioStore';
import { usePortfolioAnalyticsStore } from '../../store/portfolioAnalyticsStore';
import { useBehaviorJournalStore } from '../../store/behavioralJournalStore';
import { useTradingPrefsStore } from '../../store/tradingPrefsStore';
import { SPACING } from '../../constants/theme';

import { buildPeriodReportHTML } from '../../utils/periodReportPDF';
import { computeSectorMetrics, groupTradesByPeriod, groupLosersBySector } from '../../utils/analytics/periodAnalytics';
import type { PeriodType } from '../../utils/analytics/periodAnalytics';
import { computeDisciplineSummary } from '../../utils/analytics/disciplineAnalytics';
import CognitiveAlertsCard from '../../components/CognitiveAlertsCard';
import DisciplineCard from '../../components/DisciplineCard';
import PeriodBreakdownCard from '../../components/PeriodBreakdownCard';
import LossBreakdownCard from '../../components/LossBreakdownCard';
import BestWorstTradeCard from '../../components/BestWorstTradeCard';
import DetailedMetricsCard from '../../components/DetailedMetricsCard';
import PortfolioSnapshotCard from '../../components/PortfolioSnapshotCard';
import PnLBreakdownCard from '../../components/PnLBreakdownCard';
import TaxSummaryCard from '../../components/TaxSummaryCard';
import SectorMetricsCard from '../../components/SectorMetricsCard';
import ReportHeader from '../../components/ReportHeader';
import AppScreen from '../../components/ui/AppScreen';
import PeriodTabs from '../../components/PeriodTabs';
import EmptyReportState from '../../components/EmptyReportState';
import { computeCognitiveSummary } from '../../services/gateway/cognitiveAnalytics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';


// ──── Main Screen ───────────────────────────────────────────────────────────

export default function PeriodReportScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'PeriodReport'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { holdings, trades } = usePortfolioStore();
  const journalEntries = useBehaviorJournalStore(s => s.entries);
  const committedRR = useTradingPrefsStore(s => s.rewardRiskRatio);
  const analytics = usePortfolioAnalyticsStore(s => s.getAnalytics());
  const m = analytics.metrics;
  const cg = analytics.capitalGains;  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [refreshing, setRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pinnedReportWeekStart, setPinnedReportWeekStart] = useState<Date | null>(null);
  const [periodLabel, setPeriodLabel] = useState<string>('');
  

  // When a notification digest taps through, pin the report to that exact
  // weekly window (a 7-day window ending at the digest timestamp). The user
  // can still switch tabs normally after that.
  useEffect(() => {
    const startISO = route.params?.startDate;
    if (startISO) {
      const pinned = new Date(startISO);
      if (Number.isFinite(pinned.getTime())) {
        setPeriodType('weekly');
        setPinnedReportWeekStart(pinned);
      }
    }
  }, [route.params?.startDate]);

  // ── The weekly window the report is currently scoped to ──
  // Either the pinned digest week (from a notification tap) or the current
  // calendar week so the discipline card and period breakdown agree.
  const reportWeekStart = useMemo(() => {
    if (pinnedReportWeekStart) return pinnedReportWeekStart;
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // Monday=0 .. Sunday=6, regardless of locale
    const monday = new Date(now);
    monday.setDate(now.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [pinnedReportWeekStart]);

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
  const sectorMetrics = useMemo(() => computeSectorMetrics(trades), [trades]);  // ── R:R discipline vs the user's committed ratio ───────
  // Scope discipline to the same weekly window the report is showing —
  // either the pinned digest week or the current calendar week.
  const disciplineSummary = useMemo(
    () => {
      const weekStart = reportWeekStart.getTime();
      const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
      const weekEntries = journalEntries.filter((e) => {
        const ts = new Date(e.date).getTime();
        return Number.isFinite(ts) && ts >= weekStart && ts < weekEnd;
      });
      return computeDisciplineSummary(weekEntries, committedRR);
    },
    [journalEntries, committedRR, reportWeekStart],
  );  // ── Refresh ──────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // ── Period label (honours the pinned digest week when present) ──
  useEffect(() => {
    setPeriodLabel(
      periodType === 'weekly' ? t('periodReport.weekly') :
      periodType === 'monthly' ? t('periodReport.monthly') :
      t('periodReport.yearly'),
    );
  }, [periodType, t]);
  useEffect(() => {
    if (periodType === 'weekly' && pinnedReportWeekStart) {
      const start = pinnedReportWeekStart.toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
      const end = new Date(pinnedReportWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
        .toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
      setPeriodLabel(`${start} – ${end}`);
    }
  }, [periodType, pinnedReportWeekStart]);  // ── Export PDF ────────────────────────────────────────────────
  const exportToPDF = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const lbl = periodLabel || t('periodReport.weekly');

      const html = buildPeriodReportHTML(
        m, cg, sectorLosers, sectorMetrics, periods, cognitiveSummary, lbl, holdings,
        { discipline: disciplineSummary, committedRatio: committedRR },
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
    }    }, [m, cg, sectorLosers, sectorMetrics, periods, cognitiveSummary, holdings, periodLabel, isExporting, disciplineSummary, committedRR, t]);

  // ── Subscribe to live updates ────────────────────────────────
  const subscribe = usePortfolioAnalyticsStore(s => s.subscribeToLiveUpdates);
  const unsubscribe = usePortfolioAnalyticsStore(s => s.unsubscribeFromLiveUpdates);
  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);

  // ── Render ───────────────────────────────────────────────────
  return (
    <AppScreen
      padded={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentStyle={styles.scrollContent}
      header={
        <ReportHeader
          navigation={navigation}
          hasAnalytics={!!analytics}
          isExporting={isExporting}
          onExport={exportToPDF}
        />
      }
    >
        {/* ── Period Type Tabs ─────────────────────────────── */}
        {periodType === 'weekly' && pinnedReportWeekStart && (
          <Animated.View entering={FadeInUp.duration(300)}>
            <Text style={styles.pinnedWeekLabel}>
              {t('periodReport.pinnedWeek', {
                start: pinnedReportWeekStart.toLocaleDateString('en-IN', {
                  year: 'numeric', month: 'short', day: 'numeric',
                }),
                end: new Date(pinnedReportWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
                  .toLocaleDateString('en-IN', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  }),
              })}
            </Text>
          </Animated.View>
        )}
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

        {/* ── R:R Discipline — trades below committed ratio ── */}
        <Animated.View entering={FadeInUp.duration(400).delay(325)} testID="discipline-card-container">
          <DisciplineCard summary={disciplineSummary} committedRatio={committedRR} />
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

    </AppScreen>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (_colors: any) => StyleSheet.create({
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },

  pinnedWeekLabel: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: 8,
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});

