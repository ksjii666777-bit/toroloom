/**
 * ============================================================================
 * Toroloom — Cognitive Alerts Card
 * ============================================================================
 *
 * Standalone card component that displays behavioral trading alerts:
 *   - Over-trading warning
 *   - Brokerage leakage alert
 *   - Concentration risk alert
 *   - Behavioral critique
 *   - "No alerts" all-clear message
 *
 * Extracted from PeriodReportScreen for cleaner separation of concerns.
 *
 * Props:
 *   cognitiveSummary  — AICognitiveSummary | null (null = loading state)
 *
 * ============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import Card from './ui/Card';
import type { AICognitiveSummary } from '../types';

// ──── Props ─────────────────────────────────────────────────────────────────

interface CognitiveAlertsCardProps {
  cognitiveSummary: AICognitiveSummary | null;
}

// ──── Component ─────────────────────────────────────────────────────────────

export default function CognitiveAlertsCard({ cognitiveSummary }: CognitiveAlertsCardProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  // ── Loading state ──────────────────────────────────────────
  if (!cognitiveSummary) {
    return (
      <Card title={t('periodReport.behavioralInsights')} style={styles.card}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            {t('periodReport.loading')}
          </Text>
        </View>
      </Card>
    );
  }

  // ── Alert flags ────────────────────────────────────────────
  const hasOverTrading = cognitiveSummary.overTradingAlert?.flag;
  const hasBrokerageLeakage = cognitiveSummary.brokerageLeakageAlert?.flag;
  const hasConcentrationRisk = cognitiveSummary.concentrationRiskAlert?.flag;
  const hasAnyAlert = hasOverTrading || hasBrokerageLeakage || hasConcentrationRisk;
  const hasCritique = !!cognitiveSummary.behavioralCritique;

  return (
    <Card title={t('periodReport.behavioralInsights')} style={styles.card}>
      {/* Over-trading alert */}
      {hasOverTrading && (
        <View style={[styles.alertRow, { backgroundColor: colors.danger + '12', borderColor: colors.danger + '25' }]}>
          <Ionicons name="warning" size={18} color={colors.danger} />
          <View style={{ flex: 1, marginLeft: SPACING.sm }}>
            <Text style={[styles.alertTitle, { color: colors.danger }]}>
              {t('periodReport.overTradingAlert')}
            </Text>
            <Text style={styles.alertDesc}>
              {t('periodReport.overTradingDesc')}
            </Text>
          </View>
        </View>
      )}

      {/* Brokerage leakage */}
      {hasBrokerageLeakage && (
        <View style={[styles.alertRow, { backgroundColor: colors.warning + '12', borderColor: colors.warning + '25', marginTop: SPACING.sm }]}>
          <Ionicons name="cash-outline" size={18} color={colors.warning} />
          <View style={{ flex: 1, marginLeft: SPACING.sm }}>
            <Text style={[styles.alertTitle, { color: colors.warning }]}>
              {t('periodReport.brokerageLeakage')}
            </Text>
            <Text style={styles.alertDesc}>
              {t('periodReport.brokerageLeakageDesc')}
            </Text>
          </View>
        </View>
      )}

      {/* Concentration risk */}
      {hasConcentrationRisk && (
        <View style={[styles.alertRow, { backgroundColor: colors.warning + '12', borderColor: colors.warning + '25', marginTop: SPACING.sm }]}>
          <Ionicons name="pie-chart" size={18} color={colors.warning} />
          <View style={{ flex: 1, marginLeft: SPACING.sm }}>
            <Text style={[styles.alertTitle, { color: colors.warning }]}>
              {t('periodReport.concentrationRisk')}
            </Text>
            <Text style={styles.alertDesc}>
              {t('periodReport.concentrationRiskDesc')}
            </Text>
          </View>
        </View>
      )}

      {/* Behavioral critique */}
      {hasCritique && (
        <View style={[styles.critiqueBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '20', marginTop: SPACING.sm }]}>
          <Ionicons name="bulb" size={16} color={colors.primary} />
          <Text style={[styles.critiqueText, { color: colors.textSecondary, marginLeft: SPACING.sm }]}>
            {cognitiveSummary.behavioralCritique}
          </Text>
        </View>
      )}

      {/* No alerts — all-clear */}
      {!hasAnyAlert && (
        <View style={styles.noAlertRow}>
          <Ionicons name="shield-checkmark" size={20} color={colors.marketUp} />
          <Text style={[styles.noAlertText, { color: colors.marketUp }]}>
            {t('periodReport.noAlerts')}
          </Text>
        </View>
      )}
    </Card>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  card: {
    marginBottom: SPACING.md,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  alertTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  alertDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  critiqueBox: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  critiqueText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    lineHeight: 16,
    flex: 1,
  },
  noAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  noAlertText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
  },
  loadingText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
});
