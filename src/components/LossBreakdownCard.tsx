/**
 * ============================================================================
 * Toroloom — Loss Breakdown Card (Sector-Grouped)
 * ============================================================================
 *
 * Standalone card that displays losing positions grouped by sector.
 * States:
 *   - Has losers → expandable sector rows with stock details
 *   - No losers, but has holdings → "No losing positions" message
 *   - No data at all → renders nothing (parent controls visibility)
 *
 * Props:
 *   sectorLosers   — SectorLossGroup[] from groupLosersBySector()
 *   holdingsCount  — total number of holdings (for "no losers" detection)
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
import type { SectorLossGroup } from '../utils/analytics/periodAnalytics';

// ──── Props ─────────────────────────────────────────────────────────────────

interface LossBreakdownCardProps {
  sectorLosers: SectorLossGroup[];
  holdingsCount: number;
}

// ──── Component ─────────────────────────────────────────────────────────────

export default function LossBreakdownCard({ sectorLosers, holdingsCount }: LossBreakdownCardProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());

  const toggleSector = useCallback((sector: string) => {
    setExpandedSectors(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  }, []);

  // ── No losing positions ─────────────────────────────────
  if (sectorLosers.length === 0 && holdingsCount > 0) {
    return (
      <Card title={t('periodReport.lossBySector')}>
        <View style={styles.noLossRow}>
          <Ionicons name="happy-outline" size={24} color={colors.marketUp} />
          <Text style={[styles.noLossText, { color: colors.textMuted }]}>
            {t('periodReport.noLosers')}
          </Text>
        </View>
      </Card>
    );
  }

  // ── No data — render nothing ────────────────────────────
  if (sectorLosers.length === 0) return null;

  // ── Has losing sectors — render full breakdown ──────────
  return (
    <Card title={t('periodReport.lossBySector')}>
      <View style={styles.sectorLossSummary}>
        <Text style={styles.sectorLossSummaryText}>
          {t('periodReport.sectorsWithLoss', { count: sectorLosers.length })}
        </Text>
      </View>

      {sectorLosers.map((group, gi) => {
        const maxSectorLoss = Math.abs(sectorLosers[0].totalLossPercent) || 1;
        const sectorBarWidth = Math.min(Math.abs(group.totalLossPercent) / maxSectorLoss * 100, 100);
        const isExpanded = expandedSectors.has(group.sector);
        const sectorColor = getSectorColor(group.sector);

        return (
          <View key={group.sector}>
            {/* Sector header row (always visible) */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => toggleSector(group.sector)}
              style={styles.sectorHeaderRow}
            >
              <View style={styles.sectorHeaderLeft}>
                <View style={[styles.sectorDot, { backgroundColor: sectorColor }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.sectorNameRow}>
                    <Text style={styles.sectorName}>{group.sector}</Text>
                    <View style={[styles.sectorCountBadge, { backgroundColor: sectorColor + '20' }]}>
                      <Text style={[styles.sectorCountText, { color: sectorColor }]}>
                        {group.stocks.length}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.sectorTotalLoss, { color: colors.marketDown }]}>
                    {formatCurrency(group.totalLoss, true)}
                  </Text>
                </View>
              </View>
              <View style={styles.sectorHeaderRight}>
                <Text style={[styles.sectorTotalPct, { color: colors.marketDown }]}>
                  {formatPercent(group.totalLossPercent)}
                </Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textMuted}
                />
              </View>
            </TouchableOpacity>

            {/* Sector visual bar */}
            <View style={styles.sectorBarBg}>
              <View
                style={[
                  styles.sectorBarFill,
                  {
                    width: `${sectorBarWidth}%`,
                    backgroundColor: sectorColor,
                  },
                ]}
              />
            </View>

            {/* Expanded stock rows */}
            {isExpanded && (
              <View style={styles.sectorExpanded}>
                {group.stocks.map((h, si) => {
                  const maxStockLoss = Math.abs(group.stocks[0].pnlPercent) || 1;
                  const stockBarWidth = Math.min(Math.abs(h.pnlPercent) / maxStockLoss * 100, 100);
                  return (
                    <View key={h.id}>
                      <View style={styles.sectorStockRow}>
                        <View style={styles.lossLeft}>
                          <View style={[styles.stockIconSm, { backgroundColor: sectorColor + '18' }]}>
                            <Text style={[styles.stockIconSmText, { color: sectorColor }]}>
                              {h.symbol[0]}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.stockNameRow}>
                              <Text style={styles.lossSymbol}>{h.symbol}</Text>
                              <Text style={styles.lossName} numberOfLines={1}>{h.name}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.lossRight}>
                          <Text style={[styles.lossPnl, { color: colors.marketDown }]}>
                            {formatCurrency(h.pnl, true)}
                          </Text>
                          <Text style={[styles.lossPnlPercent, { color: colors.marketDown }]}>
                            {formatPercent(h.pnlPercent)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.stockBarBg}>
                        <View
                          style={[
                            styles.stockBarFill,
                            {
                              width: `${stockBarWidth}%`,
                              backgroundColor: colors.marketDown,
                            },
                          ]}
                        />
                      </View>
                      {si < group.stocks.length - 1 && <View style={styles.stockDivider} />}
                    </View>
                  );
                })}
              </View>
            )}

            {gi < sectorLosers.length - 1 && <View style={styles.sectorDivider} />}
          </View>
        );
      })}
    </Card>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  sectorLossSummary: {
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sectorLossSummaryText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  sectorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm + 2,
  },
  sectorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  sectorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectorName: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  sectorCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.full,
  },
  sectorCountText: {
    ...FONTS.bold,
    fontSize: 10,
  },
  sectorTotalLoss: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginTop: 1,
  },
  sectorHeaderRight: {
    alignItems: 'flex-end',
    marginLeft: SPACING.md,
  },
  sectorTotalPct: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  sectorBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  sectorBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  sectorExpanded: {
    paddingLeft: SPACING.lg + 4,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  sectorStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm - 2,
  },
  stockIconSm: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockIconSmText: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
  },
  stockNameRow: {
    flexDirection: 'column',
    gap: 0,
  },
  lossLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  lossSymbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  lossName: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  lossRight: {
    alignItems: 'flex-end',
  },
  lossPnl: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  lossPnlPercent: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginTop: 1,
  },
  stockBarBg: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    marginBottom: 0,
  },
  stockBarFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  stockDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginTop: 2,
    marginBottom: 2,
  },
  sectorDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginTop: 2,
    marginBottom: 2,
  },
  noLossRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
  },
  noLossText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
});
