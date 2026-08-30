/**
 * ============================================================================
 * Toroloom — SEBI Compliance Banner Component
 * ============================================================================
 *
 * Displays mandatory SEBI risk disclosures and regulatory warnings.
 * Used on trading-related screens (StockDetail, PlaceOrder, Portfolio, etc.)
 *
 * SEBI Mandated Disclosures:
 *   1. "Investments in securities market are subject to market risks"
 *   2. "Read all related documents carefully before investing"
 *   3. Registration status with SEBI
 *   4. Broker registration details
 *
 * Reference: SEBI (Investment Advisers) Regulations, 2013
 *            SEBI (Research Analysts) Regulations, 2014
 * ============================================================================
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

interface SEBIComplianceBannerProps {
  /** Variant determines the severity and content of the disclosure */
  variant?: 'trading' | 'advisory' | 'full' | 'compact';
  /** Show dismiss button (user can collapse, but not permanently hide) */
  dismissible?: boolean;
  /** Custom disclaimer text override */
  customDisclaimer?: string;
}

/**
 * Main trading risk disclosure — SEBI mandatory.
 * "Investments in securities market are subject to market risks.
 *  Read all related documents carefully before investing."
 */
export function TradingRiskDisclosure({ style }: { style?: any }) {
  const { colors } = useTheme();
  const { t } = useT();

  return (
    <View style={[styles.disclosureRow, style]}>
      <Ionicons name="warning" size={14} color="#F59E0B" />
      <Text style={[styles.disclosureText, { color: colors.textMuted }]}>
        {t('compliance.tradingRiskDisclosure')}
      </Text>
    </View>
  );
}

/**
 * Advisory disclaimer — shown on advisor profiles and consultation screens.
 */
export function AdvisoryDisclaimer({ style }: { style?: any }) {
  const { colors } = useTheme();
  const { t } = useT();

  return (
    <View style={[styles.advisoryContainer, style]}>
      <Ionicons name="information-circle" size={14} color={colors.primary} />
      <Text style={[styles.advisoryText, { color: colors.textSecondary }]}>
        {t('compliance.advisoryDisclaimer')}
      </Text>
    </View>
  );
}

/**
 * Full SEBI compliance banner — detailed disclosure for trading screens.
 * Includes risk warning, document reference, and broker info.
 */
export default function SEBIComplianceBanner({
  variant = 'trading',
  dismissible = true,
  customDisclaimer,
}: SEBIComplianceBannerProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  if (isDismissed) return null;

  // Compact variant — single line risk disclosure
  if (variant === 'compact') {
    return (
      <TradingRiskDisclosure
        style={[styles.compactBanner, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      />
    );
  }

  // Advisory variant
  if (variant === 'advisory') {
    return (
      <AdvisoryDisclaimer
        style={[styles.advisoryBanner, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      />
    );
  }

  // Full banner — collapsible with detailed disclosures
  return (
    <View style={[styles.banner, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {/* Header — always visible */}
      <Pressable onPress={handleToggle} style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.warningIcon, { backgroundColor: '#F59E0B20' }]}>
            <Ionicons name="shield-checkmark" size={16} color="#F59E0B" />
          </View>
          <Text style={[styles.headerText, { color: colors.text }]}>
            {t('compliance.sebiDisclosure')}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {dismissible && (
            <Pressable onPress={handleDismiss} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          )}
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </View>
      </Pressable>

      {/* Collapsible content */}
      {isExpanded && (
        <View style={styles.content}>
          {/* Primary risk disclosure */}
          <View style={[styles.disclosureCard, { backgroundColor: '#F59E0B10', borderColor: '#F59E0B30' }]}>
            <Ionicons name="warning" size={14} color="#F59E0B" />
            <Text style={[styles.disclosureCardText, { color: colors.text }]}>
              {t('compliance.riskWarning')}
            </Text>
          </View>

          {/* Market risk details */}
          <View style={styles.detailSection}>
            <Text style={[styles.detailTitle, { color: colors.text }]}>
              {t('compliance.marketRisksTitle')}
            </Text>
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {t('compliance.marketRisksDescription')}
            </Text>
          </View>

          {/* Document reference */}
          <View style={[styles.documentRef, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Ionicons name="document-text" size={14} color={colors.primary} />
            <Text style={[styles.documentRefText, { color: colors.textSecondary }]}>
              {t('compliance.readDocuments')}
            </Text>
          </View>

          {/* Broker info */}
          <View style={[styles.brokerInfo, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Ionicons name="business" size={14} color={colors.textMuted} />
            <Text style={[styles.brokerInfoText, { color: colors.textSecondary }]}>
              {t('compliance.brokerInfo')}
            </Text>
          </View>

          {/* SEBI registration */}
          <View style={styles.registrationRow}>
            <Ionicons name="checkmark-circle" size={12} color="#10B981" />
            <Text style={[styles.registrationText, { color: colors.textMuted }]}>
              {t('compliance.sebiRegistration')}
            </Text>
          </View>

          {/* Custom disclaimer if provided */}
          {customDisclaimer && (
            <View style={[styles.customDisclaimer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <Text style={[styles.customDisclaimerText, { color: colors.textSecondary }]}>
                {customDisclaimer}
              </Text>
            </View>
          )}

          {/* SCORES link */}
          <View style={styles.scoresRow}>
            <Ionicons name="help-circle" size={12} color={colors.textMuted} />
            <Text style={[styles.scoresText, { color: colors.textMuted }]}>
              {t('compliance.scoresInfo')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ──── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Compact Banner ──
  compactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },

  // ── Advisory Banner ──
  advisoryBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },

  // ── Main Banner ──
  banner: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  warningIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    flex: 1,
  },

  // ── Content ──
  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },

  // ── Disclosure Card ──
  disclosureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  disclosureCardText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    lineHeight: 18,
    flex: 1,
  },

  // ── Detail Section ──
  detailSection: {
    gap: 4,
  },
  detailTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  detailText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    lineHeight: 18,
  },

  // ── Document Reference ──
  documentRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  documentRefText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    flex: 1,
  },

  // ── Broker Info ──
  brokerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  brokerInfoText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    flex: 1,
  },

  // ── Registration Row ──
  registrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  registrationText: {
    ...FONTS.regular,
    fontSize: 10,
  },

  // ── SCORES Row ──
  scoresRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  scoresText: {
    ...FONTS.regular,
    fontSize: 10,
  },

  // ── Custom Disclaimer ──
  customDisclaimer: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
  },
  customDisclaimerText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    lineHeight: 18,
  },

  // ── Disclosure Row (for TradingRiskDisclosure) ──
  disclosureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  disclosureText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    lineHeight: 16,
    flex: 1,
  },

  // ── Advisory ──
  advisoryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  advisoryText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    lineHeight: 16,
    flex: 1,
  },
});
