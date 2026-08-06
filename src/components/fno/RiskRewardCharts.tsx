/**
 * ============================================================================
 * Toroloom — Risk / Reward Visualization
 * ============================================================================
 *
 * Visual risk metrics derived from the backtest equity curve:
 *   - R:R Ratio (avgWin / avgLoss) — prominent card with color coding
 *   - Consecutive wins / losses streak indicators
 *   - Drawdown episodes breakdown (count, avg depth, longest duration)
 *   - Win/Loss distribution bar (proportional view)
 *
 * Usage:
 *   import RiskRewardCharts from '../../components/fno/RiskRewardCharts';
 *   <RiskRewardCharts metrics={backtestResult.metrics} />
 *
 * ============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useT } from '../../hooks/useT';

import type { BacktestMetrics } from '../../services/backtestEngine';

// ──── Props ────────────────────────────────────────────────────────────────

interface RiskRewardChartsProps {
  metrics: BacktestMetrics;
}

// ──── Helpers ──────────────────────────────────────────────────────────────

function getRRColor(rr: number): string {
  if (rr >= 3) return '#00C853';
  if (rr >= 2) return '#4CAF50';
  if (rr >= 1.5) return '#FFC107';
  if (rr >= 1) return '#FF9800';
  if (rr > 0) return '#FF5252';
  return '#6E6E9A';
}

function getRRRating(rr: number): { labelKey: string; emoji: string } {
  if (rr >= 3) return { labelKey: 'fno.riskReward.ratingExcellent', emoji: '🏆' };
  if (rr >= 2) return { labelKey: 'fno.riskReward.ratingGreat', emoji: '💪' };
  if (rr >= 1.5) return { labelKey: 'fno.riskReward.ratingGood', emoji: '👍' };
  if (rr >= 1) return { labelKey: 'fno.riskReward.ratingFair', emoji: '👌' };
  if (rr > 0) return { labelKey: 'fno.riskReward.ratingPoor', emoji: '⚠️' };
  return { labelKey: 'fno.riskReward.ratingNa', emoji: '—' };
}

/** Mini drawdown timeline bar — shows depth and duration of each DD episode */
function DrawdownBar({ metrics }: { metrics: BacktestMetrics }) {
  const { colors } = useTheme();
  const { t } = useT();
  const depthPct = Math.min(100, metrics.maxDrawdownPercent * 2); // Scale for visibility

  return (
    <View style={ddStyles.container}>
      <View style={ddStyles.headerRow}>
        <Text style={[ddStyles.title, { color: colors.text }]}>{t('fno.riskReward.drawdownAnalysis')}</Text>
      </View>

      {/* Max DD bar */}
      <View style={ddStyles.metricRow}>
        <Text style={[ddStyles.label, { color: colors.textMuted }]}>{t('fno.riskReward.maxDepth')}</Text>
        <View style={ddStyles.barTrack}>
          <View style={[ddStyles.barFill, { width: `${depthPct}%`, backgroundColor: metrics.maxDrawdownPercent < 15 ? '#00C853' : metrics.maxDrawdownPercent < 25 ? '#FFC107' : '#FF1744' }]} />
        </View>
        <Text style={[ddStyles.value, { color: colors.text }]}>{metrics.maxDrawdownPercent.toFixed(1)}%</Text>
      </View>

      {/* Episodes */}
      <View style={ddStyles.statsRow}>
        <View style={ddStyles.statItem}>
          <Text style={[ddStyles.statValue, { color: colors.text }]}>{metrics.drawdownEpisodes}</Text>
          <Text style={[ddStyles.statLabel, { color: colors.textMuted }]}>{t('fno.riskReward.episodes')}</Text>
        </View>
        <View style={ddStyles.statItem}>
          <Text style={[ddStyles.statValue, { color: colors.text }]}>{metrics.avgDrawdownDepth.toFixed(1)}%</Text>
          <Text style={[ddStyles.statLabel, { color: colors.textMuted }]}>{t('fno.riskReward.avgDepth')}</Text>
        </View>
        <View style={ddStyles.statItem}>
          <Text style={[ddStyles.statValue, { color: colors.text }]}>{metrics.maxDrawdownDuration}</Text>
          <Text style={[ddStyles.statLabel, { color: colors.textMuted }]}>{t('fno.riskReward.longestDays')}</Text>
        </View>
      </View>
    </View>
  );
}

const ddStyles = StyleSheet.create({
  container: { gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...FONTS.bold, fontSize: FONTS.size.sm },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { ...FONTS.regular, fontSize: 9, width: 56, textTransform: 'uppercase' },
  barTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  value: { ...FONTS.semiBold, fontSize: 10, fontFamily: 'monospace', width: 48, textAlign: 'right' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...FONTS.extraBold, fontSize: FONTS.size.md, fontFamily: 'monospace' },
  statLabel: { ...FONTS.regular, fontSize: 8, textTransform: 'uppercase' },
});

/** Win/Loss distribution bar */
function WinLossBar({ win, loss, total }: { win: number; loss: number; total: number }) {
  const { colors } = useTheme();
  const { t } = useT();
  const winPct = total > 0 ? (win / total) * 100 : 0;
  const lossPct = total > 0 ? (loss / total) * 100 : 0;

  return (
    <View style={wlStyles.container}>
      <Text style={[wlStyles.title, { color: colors.text }]}>{t('fno.riskReward.winLossDistribution')}</Text>
      <View style={wlStyles.barContainer}>
        <View style={[wlStyles.barSegment, { flex: winPct, backgroundColor: '#00C853', opacity: 0.8 }]} />
        <View style={[wlStyles.barSegment, { flex: Math.max(1, lossPct), backgroundColor: '#FF1744', opacity: 0.6 }]} />
      </View>
      <View style={wlStyles.labelsRow}>
        <View style={wlStyles.labelItem}>
          <View style={[wlStyles.dot, { backgroundColor: '#00C853' }]} />
          <Text style={[wlStyles.labelText, { color: colors.textMuted }]}>
            {t('fno.riskReward.winPct', { pct: winPct.toFixed(0), count: win })}
          </Text>
        </View>
        <View style={wlStyles.labelItem}>
          <View style={[wlStyles.dot, { backgroundColor: '#FF1744' }]} />
          <Text style={[wlStyles.labelText, { color: colors.textMuted }]}>
            {t('fno.riskReward.lossPct', { pct: lossPct.toFixed(0), count: loss })}
          </Text>
        </View>
      </View>
    </View>
  );
}

const wlStyles = StyleSheet.create({
  container: { gap: 6 },
  title: { ...FONTS.bold, fontSize: FONTS.size.sm },
  barContainer: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  barSegment: { minWidth: 4 },
  labelsRow: { flexDirection: 'row', gap: 16 },
  labelItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  labelText: { ...FONTS.regular, fontSize: 9 },
});

/** R:R Ratio big card */
function RRRatioCard({ rr }: { rr: number }) {
  const { colors } = useTheme();
  const { t } = useT();
  const color = getRRColor(rr);
  const rating = getRRRating(rr);
  const displayValue = rr === Infinity ? '∞' : rr.toFixed(2);

  return (
    <View style={[rrStyles.card, { borderColor: color + '30', backgroundColor: color + '08' }]}>
      <View style={rrStyles.iconRow}>
        <Text style={rrStyles.icon}>⚖️</Text>
        <Text style={[rrStyles.ratingBadge, { color }]}>{rating.emoji} {t(rating.labelKey)}</Text>
      </View>
      <Text style={[rrStyles.value, { color }]}>{displayValue}</Text>
      <Text style={[rrStyles.label, { color: colors.textMuted }]}>{t('fno.riskReward.rrRatio')}</Text>
      <View style={rrStyles.subRow}>
        <Text style={[rrStyles.subText, { color: colors.textMuted }]}>{t('fno.riskReward.winLoss')}</Text>
      </View>
    </View>
  );
}

const rrStyles = StyleSheet.create({
  card: { padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, gap: 4, alignItems: 'center' },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: 20 },
  ratingBadge: { ...FONTS.bold, fontSize: 10 },
  value: { ...FONTS.extraBold, fontSize: FONTS.size.xxxl, fontFamily: 'monospace' },
  label: { ...FONTS.regular, fontSize: 8, textTransform: 'uppercase' },
  subRow: { flexDirection: 'row', gap: 4 },
  subText: { ...FONTS.regular, fontSize: 8 },
});

/** Consecutive streaks display */
function ConsecutiveStreaks({ wins, losses }: { wins: number; losses: number }) {
  const { colors } = useTheme();
  const { t } = useT();

  return (
    <View style={csStyles.container}>
      <Text style={[csStyles.title, { color: colors.text }]}>{t('fno.riskReward.consecutiveStreaks')}</Text>
      <View style={csStyles.row}>
        <View style={[csStyles.streakCard, { backgroundColor: '#00C85310', borderColor: '#00C85330' }]}>
          <Text style={csStyles.streakIcon}>🔥</Text>
          <Text style={[csStyles.streakValue, { color: '#00C853' }]}>{wins}</Text>
          <Text style={[csStyles.streakLabel, { color: colors.textMuted }]}>{t('fno.riskReward.maxWinStreak')}</Text>
        </View>
        <View style={[csStyles.streakCard, { backgroundColor: '#FF174410', borderColor: '#FF174430' }]}>
          <Text style={csStyles.streakIcon}>💧</Text>
          <Text style={[csStyles.streakValue, { color: '#FF1744' }]}>{losses}</Text>
          <Text style={[csStyles.streakLabel, { color: colors.textMuted }]}>{t('fno.riskReward.maxLossStreak')}</Text>
        </View>
      </View>
    </View>
  );
}

const csStyles = StyleSheet.create({
  container: { gap: 6 },
  title: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  row: { flexDirection: 'row', gap: 8 },
  streakCard: { flex: 1, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, alignItems: 'center', gap: 2 },
  streakIcon: { fontSize: 18 },
  streakValue: { ...FONTS.extraBold, fontSize: FONTS.size.xl, fontFamily: 'monospace' },
  streakLabel: { ...FONTS.regular, fontSize: 8, textTransform: 'uppercase', textAlign: 'center' },
});

// ──── Main Component ───────────────────────────────────────────────────────

export default function RiskRewardCharts({ metrics }: RiskRewardChartsProps) {
  const { colors } = useTheme();
  const { t } = useT();

  return (
    <View style={[mainStyles.container, { borderTopColor: colors.divider }]}>
      {/* Section header */}
      <View style={mainStyles.headerRow}>
        <Text style={mainStyles.headerIcon}>📊</Text>
        <Text style={[mainStyles.headerTitle, { color: colors.text }]}>{t('fno.riskReward.profile')}</Text>
      </View>

      {/* R:R Ratio Card + Consecutive Streaks */}
      <View style={mainStyles.topRow}>
        <View style={mainStyles.rrContainer}>
          <RRRatioCard rr={metrics.rewardRiskRatio} />
        </View>
        <View style={mainStyles.streakContainer}>
          <ConsecutiveStreaks wins={metrics.maxConsecutiveWins} losses={metrics.maxConsecutiveLosses} />
        </View>
      </View>

      {/* Drawdown Analysis */}
      <DrawdownBar metrics={metrics} />

      {/* Win/Loss Distribution */}
      <WinLossBar
        win={metrics.winningPeriods}
        loss={metrics.losingPeriods}
        total={metrics.totalPeriods}
      />
    </View>
  );
}

const mainStyles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    gap: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIcon: {
    fontSize: 16,
  },
  headerTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  topRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  rrContainer: {
    width: 130,
  },
  streakContainer: {
    flex: 1,
    justifyContent: 'center',
  },
});
