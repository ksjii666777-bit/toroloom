/**
 * Toroloom — Risk Metrics Widget
 * Displays key portfolio risk metrics: Sharpe, Sortino, Max Drawdown, Win Rate.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { usePortfolioAnalyticsStore } from '../../store/portfolioAnalyticsStore';
import { formatPercent } from '../../utils/formatters';

import type { WidgetSize } from '../../types/widgets';

interface RiskMetricsWidgetProps {
  size: WidgetSize;
}

function getRiskColor(value: number, thresholds: { good: number; ok: number }): string {
  if (value >= thresholds.good) return '#00E676';
  if (value >= thresholds.ok) return '#FFC107';
  return '#FF5252';
}

function MetricPill({ label, value, color, barValue }: { label: string; value: string; color: string; barValue?: number }) {
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <View style={[pillStyles.container, { backgroundColor: colors.bgInput }]}>
      <Text style={pillStyles.label}>{t(label)}</Text>
      <Text style={[pillStyles.value, { color }]}>{value}</Text>
      {barValue !== undefined && (
        <View style={[pillStyles.bar, { backgroundColor: colors.border }]}>
          <View style={[pillStyles.barFill, { width: `${Math.min(barValue, 100)}%`, backgroundColor: color }]} />
        </View>
      )}
    </View>
  );
}

const pillStyles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: 8,
    gap: 2,
    flex: 1,
  },
  label: { fontFamily: 'System', fontSize: 9, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  value: { fontFamily: 'System', fontSize: 14, fontWeight: '800' },
  bar: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  barFill: { height: '100%', borderRadius: 2 },
});

export default function RiskMetricsWidget({ size }: RiskMetricsWidgetProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const { metrics, pnlHistory } = usePortfolioAnalyticsStore(s => s.getAnalytics());

  // Compute Sortino
  const sortinoRatio = useMemo(() => {
    if (pnlHistory.length < 5) return 0;
    const totalInvested = 623500;
    const dailyReturns: number[] = [];
    for (let i = 1; i < pnlHistory.length; i++) {
      const prevVal = totalInvested + pnlHistory[i - 1].cumulativePnl;
      const currVal = totalInvested + pnlHistory[i].cumulativePnl;
      if (prevVal > 0) dailyReturns.push((currVal - prevVal) / prevVal);
    }
    const avgReturn = dailyReturns.length > 0
      ? dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length
      : 0;
    const downsideDev = Math.sqrt(
      dailyReturns.reduce((s, r) => s + (r < 0 ? r * r : 0), 0) / dailyReturns.length
    );
    const annualizedReturn = avgReturn * 252;
    const annualizedDownside = downsideDev * Math.sqrt(252);
    return annualizedDownside > 0 ? (annualizedReturn - 0.065) / annualizedDownside : 0;
  }, [pnlHistory]);

  const sharpeColor = getRiskColor(metrics.sharpeRatio, { good: 1.5, ok: 0.8 });
  const sortinoColor = getRiskColor(sortinoRatio, { good: 1.8, ok: 1.0 });
  const drawdownColor = getRiskColor(metrics.maxDrawdownPercent, { good: 10, ok: 20 });
  const winRateColor = getRiskColor(metrics.winRate, { good: 60, ok: 45 });

  if (size === 'small') {
    return (
      <View style={styles.container}>
        <View style={styles.compactRow}>
          <View style={styles.compactItem}>
            <Text style={[styles.compactLabel, { color: colors.textMuted }]}>{t('components.widgets.pnlSharpe')}</Text>
            <Text style={[styles.compactValue, { color: sharpeColor }]}>
              {metrics.sharpeRatio > 0 ? metrics.sharpeRatio.toFixed(2) : t('app.na')}
            </Text>
          </View>
          <View style={styles.compactItem}>
            <Text style={[styles.compactLabel, { color: colors.textMuted }]}>{t('components.widgets.pnlWinRate')}</Text>
            <Text style={[styles.compactValue, { color: winRateColor }]}>
              {formatPercent(metrics.winRate)}
            </Text>
          </View>
          <View style={styles.compactItem}>
            <Text style={[styles.compactLabel, { color: colors.textMuted }]}>{t('components.widgets.pnlDrawdown')}</Text>
            <Text style={[styles.compactValue, { color: drawdownColor }]}>
              {formatPercent(metrics.maxDrawdownPercent)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.grid2}>
        <MetricPill label="components.widgets.sharpeRatio" value={metrics.sharpeRatio > 0 ? metrics.sharpeRatio.toFixed(2) : t('app.na')} color={sharpeColor} barValue={metrics.sharpeRatio > 0 ? Math.min((metrics.sharpeRatio / 3) * 100, 100) : 0} />
        <MetricPill label="components.widgets.sortinoRatio" value={sortinoRatio > 0 ? sortinoRatio.toFixed(2) : t('app.na')} color={sortinoColor} barValue={sortinoRatio > 0 ? Math.min((sortinoRatio / 3) * 100, 100) : 0} />
      </View>
      <View style={styles.grid2}>
        <MetricPill label="components.widgets.winRate" value={formatPercent(metrics.winRate)} color={winRateColor} barValue={metrics.winRate} />
        <MetricPill label="components.widgets.maxDrawdown" value={formatPercent(metrics.maxDrawdownPercent)} color={drawdownColor} barValue={Math.min((metrics.maxDrawdownPercent / 40) * 100, 100)} />
      </View>
      {size === 'large' && (
        <View style={styles.grid2}>
          <MetricPill label="components.widgets.profitFactor" value={metrics.profitFactor > 0 ? metrics.profitFactor.toFixed(2) : t('app.na')} color={getRiskColor(metrics.profitFactor, { good: 2.0, ok: 1.2 })} barValue={metrics.profitFactor > 0 ? Math.min((metrics.profitFactor / 4) * 100, 100) : 0} />
          <MetricPill label={'components.widgets.avgHolding'} value={`${metrics.avgHoldingDays}d`} color="#3B82F6" barValue={Math.min((metrics.avgHoldingDays / 90) * 100, 100)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  grid2: { flexDirection: 'row', gap: 6 },
  compactRow: { flexDirection: 'row', justifyContent: 'space-between' },
  compactItem: { alignItems: 'center', gap: 2 },
  compactLabel: { fontFamily: 'System', fontSize: 9, fontWeight: '500' },
  compactValue: { fontFamily: 'System', fontSize: 14, fontWeight: '800' },
});
