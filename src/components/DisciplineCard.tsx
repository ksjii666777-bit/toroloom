/**
 * ============================================================================
 * Toroloom — R:R Discipline Card (Period Report)
 * ============================================================================
 *
 * Weekly/monthly report section that flags journaled trades whose realized
 * risk-reward fell below the user's COMMITTED ratio (set at broker connect).
 *
 * States:
 *   - No committed ratio      → prompt to commit (links the concept)
 *   - No measurable trades    → explain that journal entries need a planned stop
 *   - All clean               → green all-clear with avg realized R:R
 *   - Breaches found          → red flag list, worst first, with ₹ lost
 *
 * ============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import Card from './ui/Card';
import type { DisciplineSummary } from '../utils/analytics/disciplineAnalytics';

// ──── Props ─────────────────────────────────────────────────────────────────

interface DisciplineCardProps {
  summary: DisciplineSummary;
  committedRatio: number | null;
}

// ──── Component ─────────────────────────────────────────────────────────────

export default function DisciplineCard({ summary, committedRatio }: DisciplineCardProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  // ── No commitment yet ──────────────────────────────────────
  if (committedRatio == null) {
    return (
      <Card title={t('periodReport.disciplineTitle')} style={styles.card}>
        <View style={styles.promptRow}>
          <Ionicons name="flag" size={18} color={colors.textMuted} />
          <Text style={[styles.promptText, { color: colors.textMuted }]}>
            {t('periodReport.disciplineNoCommitment')}
          </Text>
        </View>
      </Card>
    );
  }

  // ── No measurable trades (no planned stops recorded) ───────
  if (summary.measured === 0) {
    return (
      <Card title={t('periodReport.disciplineTitle')} style={styles.card}>
        <View style={styles.promptRow}>
          <Ionicons name="journal" size={18} color={colors.textMuted} />
          <Text style={[styles.promptText, { color: colors.textMuted }]}>
            {t('periodReport.disciplineNoData')}
          </Text>
        </View>
      </Card>
    );
  }

  const allClean = summary.breaches === 0;

  return (
    <Card
      title={t('periodReport.disciplineTitle')}
      subtitle={t('periodReport.disciplineCommitment', { ratio: committedRatio })}
      style={styles.card}
    >
      {/* ── Summary stats row ── */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>{summary.measured}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('periodReport.disciplineMeasured')}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: allClean ? colors.marketUp : colors.danger }]}>
            {summary.breaches}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('periodReport.disciplineBreaches')}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            1:{summary.avgRealizedRR.toFixed(1)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('periodReport.disciplineAvgRR')}
          </Text>
        </View>
      </View>

      {/* ── All clear ── */}
      {allClean && (
        <View style={[styles.alertRow, { backgroundColor: colors.marketUp + '12', borderColor: colors.marketUp + '25' }]}>
          <Ionicons name="shield-checkmark" size={18} color={colors.marketUp} />
          <Text style={[styles.alertText, { color: colors.marketUp }]}>
            {t('periodReport.disciplineAllClean')}
          </Text>
        </View>
      )}

      {/* ── Breach list (worst first) ── */}
      {!allClean && (
        <>
          <View style={[styles.alertRow, { backgroundColor: colors.danger + '12', borderColor: colors.danger + '25' }]}>
            <Ionicons name="warning" size={18} color={colors.danger} />
            <View style={{ flex: 1, marginLeft: SPACING.sm }}>
              <Text style={[styles.alertTitle, { color: colors.danger }]}>
                {t('periodReport.disciplineBreachAlert', { count: summary.breaches })}
              </Text>
              {summary.lossFromBreaches < 0 && (
                <Text style={styles.alertDesc}>
                  {t('periodReport.disciplineLossNote', {
                    loss: Math.abs(summary.lossFromBreaches).toLocaleString('en-IN'),
                  })}
                </Text>
              )}
            </View>
          </View>

          {summary.flagged.map(trade => (
            <View
              key={trade.entryId}
              testID={`discipline-flag-${trade.entryId}`}
              style={[styles.flagRow, { borderBottomColor: colors.divider }]}
            >
              <Text style={[styles.flagSymbol, { color: colors.text }]}>{trade.symbol}</Text>
              <Text style={[styles.flagDetail, { color: colors.textMuted }]}>
                {t('periodReport.disciplineFlagDetail', {
                  realized: trade.realizedRR.toFixed(2),
                  committed: trade.committedRatio,
                })}
              </Text>
              <Text
                style={[
                  styles.flagPnl,
                  { color: trade.pnl < 0 ? colors.marketDown : colors.marketUp },
                ]}
              >
                {trade.pnl >= 0 ? '+' : '−'}₹{Math.abs(trade.pnl).toLocaleString('en-IN')}
              </Text>
            </View>
          ))}

          <Text style={[styles.footnote, { color: colors.textMuted }]}>
            {t('periodReport.disciplineFootnote')}
          </Text>
        </>
      )}
    </Card>
  );
}

// ──── Styles ────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  card: { marginBottom: SPACING.lg },
  promptRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm },
  promptText: { ...FONTS.regular, fontSize: FONTS.size.sm, flex: 1, marginLeft: SPACING.sm },
  statsRow: { flexDirection: 'row', marginBottom: SPACING.md },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...FONTS.bold, fontSize: FONTS.size.lg },
  statLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2 },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  alertTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  alertDesc: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textSecondary, marginTop: 2 },
  alertText: { ...FONTS.semiBold, fontSize: FONTS.size.sm, flex: 1, marginLeft: SPACING.sm },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flagSymbol: { ...FONTS.semiBold, fontSize: FONTS.size.sm, width: 90 },
  flagDetail: { ...FONTS.regular, fontSize: FONTS.size.xs, flex: 1 },
  flagPnl: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  footnote: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: SPACING.sm, fontStyle: 'italic' },
});
