/**
 * ============================================================================
 * Toroloom — Sector Metrics Card
 * ============================================================================
 *
 * Standalone card that displays per-sector trade metrics (win/loss, avg P&L,
 * profit factor) with expandable trade details including buy vs sell prices.
 *
 * Props:
 *   sectorMetrics        — SectorMetrics[] from computeSectorMetrics()
 *   holdingsBuyPriceMap  — Map<symbol, buyPrice> for buy/sell comparison
 *
 * ============================================================================
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { getSectorColor } from '../utils/periodReportPDF';
import Card from './ui/Card';
import type { SectorMetrics } from '../utils/analytics/periodAnalytics';

// ──── Props ─────────────────────────────────────────────────────────────────

interface SectorMetricsCardProps {
  sectorMetrics: SectorMetrics[];
  holdingsBuyPriceMap: Map<string, number>;
}

// ──── Component ─────────────────────────────────────────────────────────────

export default function SectorMetricsCard({ sectorMetrics, holdingsBuyPriceMap }: SectorMetricsCardProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());

  const toggleMetrics = useCallback((sector: string) => {
    setExpandedMetrics(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  }, []);

  if (sectorMetrics.length === 0) return null;

  return (
    <Card title={t('periodReport.sectorMetrics')}>
      {sectorMetrics.map((sm, i) => {
        const sectorColor = getSectorColor(sm.sector);
        const pFactorColor = sm.profitFactor >= 2 ? colors.marketUp :
          sm.profitFactor >= 1 ? colors.warning : colors.marketDown;
        const isExpanded = expandedMetrics.has(sm.sector);

        return (
          <View key={sm.sector}>
            {/* ── Touchable sector header row ──────── */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => toggleMetrics(sm.sector)}
              style={styles.sectorMetricRow}
            >
              {/* Sector name + color dot */}
              <View style={styles.sectorMetricNameArea}>
                <View style={[styles.sectorMetricDot, { backgroundColor: sectorColor }]} />
                <Text style={styles.sectorMetricName}>{sm.sector}</Text>
                <Text style={styles.sectorMetricCount}>
                  {sm.totalTrades} {t('periodReport.tradesCount', { count: sm.totalTrades }).split(' ')[1]}
                </Text>
              </View>

              {/* W/L badge */}
              <View style={styles.sectorMetricWl}>
                <Text style={[styles.sectorMetricWinText, { color: colors.marketUp }]}>{sm.totalWins}{t('periodReport.sectorWins')[0]}</Text>
                <Text style={[styles.sectorMetricSlash, { color: colors.textMuted }]}>/</Text>
                <Text style={[styles.sectorMetricLossText, { color: colors.marketDown }]}>{sm.totalLosses}{t('periodReport.sectorLosses')[0]}</Text>
              </View>

              {/* Avg Win */}
              <View style={styles.sectorMetricAmt}>
                <Text style={[styles.sectorMetricAmtValue, { color: colors.marketUp }]}>
                  {formatCurrency(sm.avgWin, true)}
                </Text>
                <Text style={styles.sectorMetricAmtLabel}>{t('periodReport.sectorAvgWin')}</Text>
              </View>

              {/* Avg Loss */}
              <View style={styles.sectorMetricAmt}>
                <Text style={[styles.sectorMetricAmtValue, { color: colors.marketDown }]}>
                  {formatCurrency(sm.avgLoss, true)}
                </Text>
                <Text style={styles.sectorMetricAmtLabel}>{t('periodReport.sectorAvgLoss')}</Text>
              </View>

              {/* Profit Factor + chevron */}
              <View style={styles.sectorMetricPf}>
                <Text style={[styles.sectorMetricPfValue, { color: pFactorColor }]}>
                  {sm.profitFactor >= 99 ? '∞' : sm.profitFactor.toFixed(1)}
                </Text>
                <View style={styles.sectorMetricPfBottom}>
                  <Text style={styles.sectorMetricPfLabel}>{t('periodReport.sectorProfitFactor')}</Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color={colors.textMuted}
                    style={{ marginLeft: 4 }}
                  />
                </View>
              </View>
            </TouchableOpacity>

            {/* ── Expanded trade details ────────────── */}
            {isExpanded && (
              <View style={styles.sectorMetricExpanded}>
                {sm.trades.map((trade, ti) => {
                  const isWin = trade.total > 0;
                  const tradeDate = new Date(trade.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                  const buyPrice = holdingsBuyPriceMap.get(trade.symbol);
                  return (
                    <View key={trade.id || `${sm.sector}-${ti}`}>
                      <View style={styles.sectorMetricDetailRow}>
                        <View style={styles.sectorMetricDetailLeft}>
                          <View style={[styles.sectorMetricDetailDot, { backgroundColor: isWin ? colors.marketUp : colors.marketDown }]} />
                          <Text style={styles.sectorMetricDetailSymbol}>{trade.symbol}</Text>
                          <Text style={styles.sectorMetricDetailDate}>{tradeDate}</Text>
                          <Text style={styles.sectorMetricDetailQty}>{trade.quantity} × ₹{trade.price}</Text>
                        </View>
                        <Text style={[styles.sectorMetricDetailPnl, { color: isWin ? colors.marketUp : colors.marketDown }]}>
                          {isWin ? '+' : ''}{formatCurrency(trade.total, true)}
                        </Text>
                      </View>
                      {/* Buy vs Sell comparison */}
                      <View style={styles.sectorMetricDetailBvSRow}>
                        <Text style={styles.sectorMetricDetailBvSLabel}>B: </Text>
                        <Text style={styles.sectorMetricDetailBvSValue}>
                          {buyPrice
                            ? `₹${new Intl.NumberFormat('en-IN').format(buyPrice)}`
                            : '—'}
                        </Text>
                        <Ionicons name="arrow-forward" size={10} color={colors.textMuted} style={{ marginHorizontal: 4 }} />
                        <Text style={styles.sectorMetricDetailBvSLabel}>S: </Text>
                        <Text style={styles.sectorMetricDetailBvSValue}>
                          ₹{new Intl.NumberFormat('en-IN').format(trade.price)}
                        </Text>
                        <View style={{ flex: 1 }} />
                        <Text style={[styles.sectorMetricDetailBvSDiff, { color: isWin ? colors.marketUp : colors.marketDown }]}>
                          {isWin ? '+' : ''}{formatPercent(buyPrice ? (trade.price / buyPrice * 100 - 100) : 0)}
                        </Text>
                      </View>
                      {ti < sm.trades.length - 1 && <View style={styles.sectorMetricDetailDivider} />}
                    </View>
                  );
                })}
              </View>
            )}

            {i < sectorMetrics.length - 1 && !isExpanded && <View style={styles.sectorMetricDivider} />}
          </View>
        );
      })}
    </Card>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  sectorMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  sectorMetricNameArea: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 110,
    gap: 4,
  },
  sectorMetricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectorMetricName: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: colors.text,
    flexShrink: 1,
  },
  sectorMetricCount: {
    ...FONTS.regular,
    fontSize: 8,
    color: colors.textMuted,
    marginLeft: 2,
  },
  sectorMetricWl: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 36,
    justifyContent: 'center',
  },
  sectorMetricWinText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xs,
  },
  sectorMetricSlash: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginHorizontal: 1,
  },
  sectorMetricLossText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xs,
  },
  sectorMetricAmt: {
    alignItems: 'flex-end',
    width: 60,
  },
  sectorMetricAmtValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xs,
  },
  sectorMetricAmtLabel: {
    ...FONTS.regular,
    fontSize: 7,
    color: colors.textMuted,
    marginTop: 1,
  },
  sectorMetricPf: {
    alignItems: 'flex-end',
    width: 48,
  },
  sectorMetricPfValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
  },
  sectorMetricPfBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  sectorMetricPfLabel: {
    ...FONTS.regular,
    fontSize: 7,
    color: colors.textMuted,
  },
  sectorMetricExpanded: {
    paddingLeft: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  sectorMetricDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: SPACING.xs,
  },
  sectorMetricDetailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  sectorMetricDetailDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  sectorMetricDetailSymbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: colors.text,
  },
  sectorMetricDetailDate: {
    ...FONTS.regular,
    fontSize: 8,
    color: colors.textMuted,
  },
  sectorMetricDetailQty: {
    ...FONTS.regular,
    fontSize: 8,
    color: colors.textMuted,
  },
  sectorMetricDetailPnl: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  sectorMetricDetailBvSRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACING.md + 6,
    paddingRight: SPACING.xs,
    paddingBottom: 2,
    marginTop: -1,
  },
  sectorMetricDetailBvSLabel: {
    ...FONTS.regular,
    fontSize: 7,
    color: colors.textMuted,
  },
  sectorMetricDetailBvSValue: {
    ...FONTS.semiBold,
    fontSize: 8,
    color: colors.textSecondary,
  },
  sectorMetricDetailBvSDiff: {
    ...FONTS.semiBold,
    fontSize: 8,
  },
  sectorMetricDetailDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 2,
  },
  sectorMetricDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
});
