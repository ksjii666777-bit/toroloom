/**
 * ============================================================================
 * Toroloom — Period-by-Period Breakdown Card
 * ============================================================================
 *
 * Standalone card that shows a visual P&L breakdown across weekly, monthly,
 * or yearly periods with proportional bar charts and W/L badges.
 *
 * Props:
 *   periods  — PeriodSummary[] from groupTradesByPeriod()
 *
 * States:
 *   - Has periods → visual breakdown with bars, P&L, and W/L counters
 *   - >12 periods → "+X more periods" overflow indicator
 *   - Empty       → renders nothing (parent controls visibility)
 *
 * ============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';
import Card from './ui/Card';
import type { PeriodSummary } from '../utils/analytics/periodAnalytics';

// ──── Props ─────────────────────────────────────────────────────────────────

interface PeriodBreakdownCardProps {
  periods: PeriodSummary[];
}

// ──── Component ─────────────────────────────────────────────────────────────

export default function PeriodBreakdownCard({ periods }: PeriodBreakdownCardProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  if (periods.length === 0) return null;

  const maxPnl = Math.max(...periods.map(x => Math.abs(x.pnl)), 1);

  return (
    <Animated.View entering={FadeInUp.duration(400).delay(150)}>
      <Card title={t('periodReport.periodDetails')}>
        {periods.slice(0, 12).map((p, i) => {
          const barWidth = Math.min(Math.abs(p.pnl) / maxPnl * 100, 100);
          const isProfit = p.pnl >= 0;

          return (
            <View key={`${p.label}`}>
              <View style={styles.periodRow}>
                {/* Period label + trade count */}
                <View style={styles.periodLeft}>
                  <Text style={styles.periodLabel}>{p.label}</Text>
                  {p.trades > 0 && (
                    <Text style={styles.periodTrades}>
                      {t('periodReport.tradesCount', { count: p.trades }).toLowerCase()}
                    </Text>
                  )}
                </View>

                {/* Visual bar */}
                <View style={styles.periodBarArea}>
                  <View style={styles.periodBarBg}>
                    <View
                      style={[
                        styles.periodBarFill,
                        {
                          width: `${barWidth}%`,
                          backgroundColor: isProfit ? colors.marketUp : colors.marketDown,
                          alignSelf: isProfit ? 'flex-start' : 'flex-end' as const,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* P&L value + W/L badge */}
                <View style={styles.periodRight}>
                  <Text
                    style={[
                      styles.periodPnl,
                      { color: isProfit ? colors.marketUp : colors.marketDown },
                    ]}
                  >
                    {isProfit ? '+' : ''}{formatCurrency(p.pnl, true)}
                  </Text>
                  {p.winners > 0 && p.losers > 0 && (
                    <Text style={styles.periodWl}>
                      {p.winners}W/{p.losers}L
                    </Text>
                  )}
                </View>
              </View>

              {i < Math.min(periods.length, 12) - 1 && <View style={styles.periodDivider} />}
            </View>
          );
        })}

        {periods.length > 12 && (
          <Text style={styles.moreText}>+{periods.length - 12} more periods</Text>
        )}
      </Card>
    </Animated.View>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  periodLeft: {
    width: 72,
  },
  periodLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  periodTrades: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  periodBarArea: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
  },
  periodBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  periodBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  periodRight: {
    width: 80,
    alignItems: 'flex-end',
  },
  periodPnl: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  periodWl: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  periodDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  moreText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
