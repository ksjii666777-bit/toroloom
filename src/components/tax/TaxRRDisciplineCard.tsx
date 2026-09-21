/**
 * ============================================================================
 * Toroloom — Tax R:R Discipline Card
 * ============================================================================
 *
 * Shown inside the tax-education module: compares "actual you" (journaled
 * trades) with "disciplined you" (same trades held to the committed R:R) and
 * expresses the difference POST-TAX via computeTaxDisciplineImpact.
 *
 * States:
 *   - hidden entirely when the tax module hasn't opted in (showCard=false)
 *   - "commit your R:R" prompt when no commitment exists
 *   - measured-trades comparison with post-tax gap when data exists
 *
 * The card only reads stores — mutations happen elsewhere. The tax rate is
 * the module's education-grade default (12.5% LTCG), not per-user config.
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { useTradingPrefsStore } from '../../store/tradingPrefsStore';
import { useBehaviorJournalStore } from '../../store/behavioralJournalStore';
import { computeTaxDisciplineImpact } from '../../utils/analytics/taxDisciplineImpact';
import type { TaxMode } from '../../store/tradingPrefsStore';
import { SLAB_RATE_OPTIONS, LTCG_RATE } from '../../store/tradingPrefsStore';

/** Slab-rate picker labels (keys into i18n) for SLAB_RATE_OPTIONS */
const SLAB_LABEL_KEYS: Record<number, string> = {
  0.05: 'taxEducation.rrSlab5',
  0.2: 'taxEducation.rrSlab20',
  0.3: 'taxEducation.rrSlab30',
};

export interface TaxRRDisciplineCardProps {
  /** Master switch — the tax screen renders it above the section picker */
  showCard?: boolean;
  /** Navigates to BrokerConnect (R:R commit lives in the connect flow) */
  onPressCommit?: () => void;
  /** Navigates to the behavioural journal (entry modal lives there) */
  onPressJournal?: () => void;
}

function TaxRRDisciplineCard({
  showCard = true,
  onPressCommit,
  onPressJournal,
}: TaxRRDisciplineCardProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const committedRatio = useTradingPrefsStore((s) => s.rewardRiskRatio);
  const taxMode = useTradingPrefsStore((s) => s.taxMode);
  const slabRate = useTradingPrefsStore((s) => s.slabRate);
  const setTaxMode = useTradingPrefsStore((s) => s.setTaxMode);
  const setSlabRate = useTradingPrefsStore((s) => s.setSlabRate);
  const entries = useBehaviorJournalStore((s) => s.entries);

  const taxRate = useTradingPrefsStore((s) => s.resolvedTaxRate());

  const impact = useMemo(
    () => computeTaxDisciplineImpact(entries, committedRatio, taxRate),
    [entries, committedRatio, taxRate],
  );

  // Side-by-side education comparison: the same trades under BOTH models
  const impactLtcg = useMemo(
    () => computeTaxDisciplineImpact(entries, committedRatio, LTCG_RATE),
    [entries, committedRatio],
  );
  const impactSlab = useMemo(
    () => computeTaxDisciplineImpact(entries, committedRatio, slabRate),
    [entries, committedRatio, slabRate],
  );

  if (!showCard) return null;

  // ── No commitment yet → prompt to commit ────────────────────────────
  if (!committedRatio) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Ionicons name="git-compare-outline" size={18} color={colors.primary} />
          <Text style={styles.title}>{t('taxEducation.rrCardTitle')}</Text>
        </View>
        <Text style={styles.bodyText}>{t('taxEducation.rrCardSubtitle')}</Text>
        <Pressable
          style={styles.cta}
          onPress={onPressCommit}
          accessibilityRole="button"
          accessibilityLabel={t('taxEducation.rrCtaCommit')}
        >
          <Text style={styles.ctaText}>{t('taxEducation.rrCtaCommit')}</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>
    );
  }

  // ── Committed but nothing measurable → prompt to journal ────────────
  if (!impact) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Ionicons name="git-compare-outline" size={18} color={colors.primary} />
          <Text style={styles.title}>{t('taxEducation.rrCardTitle')}</Text>
          <View style={styles.ratioPill}>
            <Text style={styles.ratioPillText}>
              {t('taxEducation.rrCommitted')} 1:{committedRatio}
            </Text>
          </View>
        </View>
        <Text style={styles.bodyText}>{t('taxEducation.rrCardSubtitle')}</Text>
        <Pressable
          style={styles.cta}
          onPress={onPressJournal}
          accessibilityRole="button"
          accessibilityLabel={t('taxEducation.rrCtaJournal')}
        >
          <Text style={styles.ctaText}>{t('taxEducation.rrCtaJournal')}</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>
    );
  }

  const gapIsPositive = impact.postTaxGap > 0.5; // ₹0.50 — ignore float noise
  const gapIsZero = !gapIsPositive && Math.abs(impact.postTaxGap) <= 0.5;

  // ── Measured comparison ─────────────────────────────────────────────
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="git-compare-outline" size={18} color={colors.primary} />
        <Text style={styles.title}>{t('taxEducation.rrCardTitle')}</Text>
        <View style={styles.ratioPill}>
          <Text style={styles.ratioPillText}>
            {t('taxEducation.rrCommitted')} 1:{committedRatio}
          </Text>
        </View>
      </View>

      <Text style={styles.measuredLine}>
        {t('taxEducation.rrCardMeasured', { measured: impact.measured })}
      </Text>

      {/* Comparison rows */}
      <View style={styles.compareWrap}>
        <View style={styles.compareRow}>
          <Text style={styles.compareLabel}>{t('taxEducation.rrActual')}</Text>
          <Text style={styles.compareValue}>
            {t('taxEducation.rrPostTax')} ₹{impact.postTaxActual.toFixed(0)}
          </Text>
        </View>
        <View style={[styles.compareRow, styles.compareRowAlt]}>
          <Text style={styles.compareLabel}>{t('taxEducation.rrDisciplined')}</Text>
          <Text style={[styles.compareValue, styles.disciplinedValue]}>
            {t('taxEducation.rrPostTax')} ₹{impact.postTaxDisciplined.toFixed(0)}
          </Text>
        </View>
      </View>

      {/* Breach detail */}
      {(impact.breaches > 0 || impact.undisciplinedLosses > 0) && (
        <Text style={styles.breachLine}>
          {t('taxEducation.rrBreachLine', {
            breaches: impact.breaches,
            undisciplinedLosses: impact.undisciplinedLosses,
            loss: impact.lossFromUndisciplinedLosses.toFixed(0),
          })}
        </Text>
      )}

      {/* Verdict */}
      {gapIsZero ? (
        <Text style={[styles.gapLine, styles.cleanLine]}>
          {t('taxEducation.rrCleanLine')}
        </Text>
      ) : (
        <Text style={[styles.gapLine, gapIsPositive ? styles.gapBad : styles.gapGood]}>
          {t('taxEducation.rrGapLine', { gap: Math.abs(impact.postTaxGap).toFixed(0) })}
        </Text>
      )}

      {/* Both models side by side — instant slab vs LTCG comparison */}
      {impactLtcg && impactSlab && (
        <View style={styles.modelCompareWrap}>
          <Text style={styles.taxPickerLabel}>{t('taxEducation.rrCompareHeading')}</Text>
          <View style={styles.modelCompareRow}>
            <View style={styles.modelCompareCell}>
              <Text style={styles.modelCompareLabel}>
                {t('taxEducation.rrCompareLtcgGap')}
              </Text>
              <Text
                style={[
                  styles.modelCompareValue,
                  impactLtcg.postTaxGap > 0.5 ? styles.gapBad : styles.gapGood,
                ]}
              >
                ₹{Math.abs(impactLtcg.postTaxGap).toFixed(0)}
              </Text>
            </View>
            <View style={styles.modelCompareDivider} />
            <View style={styles.modelCompareCell}>
              <Text style={styles.modelCompareLabel}>
                {t('taxEducation.rrCompareSlabGap', { slabPct: Math.round(slabRate * 100) })}
              </Text>
              <Text
                style={[
                  styles.modelCompareValue,
                  impactSlab.postTaxGap > 0.5 ? styles.gapBad : styles.gapGood,
                ]}
              >
                ₹{Math.abs(impactSlab.postTaxGap).toFixed(0)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Tax-model picker — switches the card between LTCG and slab maths */}
      <View style={styles.taxPickerWrap}>
        <Text style={styles.taxPickerLabel}>{t('taxEducation.rrTaxSettings')}</Text>
        <View style={styles.taxPickerRow}>
          <Pressable
            style={[styles.taxChip, taxMode === 'ltcg' && styles.taxChipActive]}
            onPress={() => setTaxMode('ltcg' as TaxMode)}
            accessibilityRole="button"
            accessibilityLabel={t('taxEducation.rrTaxLtcg')}
          >
            <Text
              style={[styles.taxChipText, taxMode === 'ltcg' && styles.taxChipTextActive]}
            >
              {t('taxEducation.rrTaxLtcg')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.taxChip, taxMode === 'slab' && styles.taxChipActive]}
            onPress={() => setTaxMode('slab' as TaxMode)}
            accessibilityRole="button"
            accessibilityLabel={t('taxEducation.rrTaxSlab')}
          >
            <Text
              style={[styles.taxChipText, taxMode === 'slab' && styles.taxChipTextActive]}
            >
              {t('taxEducation.rrTaxSlab')}
            </Text>
          </Pressable>
        </View>
        {taxMode === 'slab' && (
          <View style={styles.slabRow}>
            <Text style={styles.taxPickerLabel}>{t('taxEducation.rrSlabLabel')}</Text>
            <View style={styles.slabChips}>
              {SLAB_RATE_OPTIONS.map((r) => (
                <Pressable
                  key={r}
                  style={[styles.slabChip, slabRate === r && styles.slabChipActive]}
                  onPress={() => setSlabRate(r)}
                  accessibilityRole="button"
                  accessibilityLabel={t(SLAB_LABEL_KEYS[r] ?? 'taxEducation.rrSlab30')}
                >
                  <Text
                    style={[styles.slabChipText, slabRate === r && styles.slabChipTextActive]}
                  >
                    {t(SLAB_LABEL_KEYS[r] ?? 'taxEducation.rrSlab30')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>

      <Pressable
        style={styles.cta}
        onPress={onPressJournal}
        accessibilityRole="button"
        accessibilityLabel={t('taxEducation.rrCtaJournal')}
      >
        <Text style={styles.ctaText}>{t('taxEducation.rrCtaJournal')}</Text>
        <Ionicons name="arrow-forward" size={14} color={colors.primary} />
      </Pressable>

      <Text style={styles.modelDisclaimer}>{t('taxEducation.rrDisclaimer')}</Text>
    </View>
  );
}

const createStyles = (colors: {
  bg: string;
  text: string;
  textMuted: string;
  primary: string;
  bgCard: string;
  border: string;
  success: string;
  danger: string;
}) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    title: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
      flex: 1,
    },
    ratioPill: {
      backgroundColor: colors.primary + '20',
      borderRadius: BORDER_RADIUS.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    ratioPillText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.xs,
      color: colors.primary,
    },
    bodyText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      lineHeight: 20,
      color: colors.textMuted,
      marginBottom: SPACING.sm,
    },
    measuredLine: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginBottom: SPACING.sm,
    },
    compareWrap: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: SPACING.sm,
    },
    compareRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 8,
    },
    compareRowAlt: {
      backgroundColor: colors.bg,
    },
    compareLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
    },
    compareValue: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.text,
    },
    disciplinedValue: {
      color: colors.success,
    },
    breachLine: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      lineHeight: 16,
      color: colors.textMuted,
      marginBottom: 6,
    },
    gapLine: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      marginBottom: SPACING.sm,
    },
    gapBad: { color: colors.danger },
    gapGood: { color: colors.success },
    cleanLine: { color: colors.success },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 6,
      marginBottom: 6,
    },
    ctaText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.primary,
    },
    modelDisclaimer: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      lineHeight: 15,
      color: colors.textMuted,
    },
    modelCompareWrap: {
      marginTop: 4,
      marginBottom: SPACING.sm,
      gap: 4,
    },
    modelCompareRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    modelCompareCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 6,
      gap: 2,
    },
    modelCompareDivider: {
      width: 1,
      backgroundColor: colors.border,
    },
    modelCompareLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      textAlign: 'center',
    },
    modelCompareValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
    },
    taxPickerWrap: {
      marginTop: 4,
      marginBottom: SPACING.sm,
      gap: 6,
    },
    taxPickerLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    taxPickerRow: {
      flexDirection: 'row',
      gap: 8,
    },
    taxChip: {
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    taxChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '18',
    },
    taxChipText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    taxChipTextActive: {
      color: colors.primary,
    },
    slabRow: {
      marginTop: 2,
      gap: 6,
    },
    slabChips: {
      flexDirection: 'row',
      gap: 8,
    },
    slabChip: {
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 5,
    },
    slabChipActive: {
      borderColor: colors.success,
      backgroundColor: colors.success + '18',
    },
    slabChipText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    slabChipTextActive: {
      color: colors.success,
    },
  });

export default TaxRRDisciplineCard;
