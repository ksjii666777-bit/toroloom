/**
 * ============================================================================
 * Toroloom — Global Pricing Screen
 * ============================================================================
 *
 * One product, three fair local price points:
 *   🇮🇳 India  — INR, Razorpay/UPI checkout (live today)
 *   🇺🇸 US     — USD, Stripe checkout (waitlist)
 *   🇪🇺 Europe — EUR, Stripe checkout (waitlist)
 *
 * Region auto-detects from the device timezone; the user can override with
 * the region chips (persisted via geoPricingStore). Feature lists come from
 * the single source of truth (SUBSCRIPTION_PLANS) so this page can never
 * drift from what the paywall actually enforces.
 * ============================================================================
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SUBSCRIPTION_PLANS } from '../../store/subscriptionStore';
import { useGeoPricingStore } from '../../store/geoPricingStore';
import {
  REGION_META,
  effectiveRegion,
  getPrice,
  formatRegionalPrice,
  yearlySavingsPct,
  type PricingRegion,
  type BillingPeriod,
} from '../../services/pricing/geoPricing';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { AppHeader } from '../../components/ui/AppHeader';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { navigateFromRef } from '../../navigation/navigationRef';
import { paymentsApi } from '../../services/api/payments';
import { log } from '../../utils/logger';

const REGION_ORDER: PricingRegion[] = ['in', 'us', 'eu'];

/** Waitlist mailto — pre-filled subject keeps triage trivial. */
const WAITLIST_MAILTO =
  'mailto:support@toroloom.com?subject=' +
  encodeURIComponent('International pricing waitlist') +
  '&body=' +
  encodeURIComponent('Please notify me when international (Stripe) checkout is live.');

export default function GlobalPricingScreen() {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const regionOverride = useGeoPricingStore(s => s.regionOverride);
  const detectedRegion = useGeoPricingStore(s => s.detectedRegion);
  const initialize = useGeoPricingStore(s => s.initialize);
  const setRegionOverride = useGeoPricingStore(s => s.setRegionOverride);

  const [billing, setBilling] = useState<BillingPeriod>('monthly');

  useEffect(() => {
    initialize();
  }, [initialize]);

  const region = effectiveRegion(regionOverride, detectedRegion);
  const isAuto = regionOverride === null;

  /**
   * US/EU CTA: live Stripe Checkout. Opens the hosted payment page in the
   * system browser; the subscription is provisioned by the backend webhook
   * and refreshed via the `toroloom://subscription/success` deep link.
   * Falls back to the waitlist flow when the session can't be created
   * (old backend build, offline) so the CTA is never dead.
   */
  const handleCheckout = useCallback(async (planId: string) => {
    // The Stripe CTA only renders for us/eu regions — India uses handleUpgrade.
    if (region === 'in') return;
    try {
      const { url } = await paymentsApi.createStripeCheckoutSession(planId, billing, region);
      if (!url) throw new Error('No checkout URL');
      await Linking.openURL(url);
      return;
    } catch (err) {
      log.warn('[GlobalPricing] Stripe checkout unavailable, falling back to waitlist', err);
    }
    Alert.alert(t('globalPricing.checkoutFailedTitle'), t('globalPricing.checkoutFailedBody'));
    Linking.openURL(WAITLIST_MAILTO).catch(() => {
      // Mail client unavailable — the Alert above already set expectations
    });
  }, [t, billing, region]);

  const handleUpgrade = useCallback(() => {
    // India checkout lives in the existing Razorpay subscription flow
    navigateFromRef('Subscription');
  }, []);

  const maxSavePct = useMemo(
    () => Math.max(...SUBSCRIPTION_PLANS.map(p => yearlySavingsPct(p.id, region))),
    [region],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader
        title={t('globalPricing.title')}
        subtitle={t('globalPricing.subtitle')}
      />

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + SPACING.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Region chips ── */}
        <Text style={styles.sectionTitle}>{t('globalPricing.chooseRegion')}</Text>
        <View style={styles.chipRow}>
          {REGION_ORDER.map(r => {
            const meta = REGION_META[r];
            const active = r === region;
            return (
              <AnimatedPressable
                key={r}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setRegionOverride(r)}
                accessibilityLabel={t('globalPricing.a11yRegionChip', { region: t(`globalPricing.${meta.nameKey}`) })}
              >
                <Text style={styles.chipFlag}>{meta.flag}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(`globalPricing.${meta.nameKey}`)}
                </Text>
                {active && isAuto && (
                  <Text style={styles.chipAuto}>{t('globalPricing.autoDetected')}</Text>
                )}
              </AnimatedPressable>
            );
          })}
        </View>

        {/* ── Billing toggle ── */}
        <View style={styles.toggleRow}
          accessibilityLabel={t('globalPricing.a11yBillingToggle')}>
          {(['monthly', 'yearly'] as BillingPeriod[]).map(b => {
            const active = billing === b;
            return (
              <AnimatedPressable
                key={b}
                style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                onPress={() => setBilling(b)}
                accessibilityLabel={b === 'monthly'
                  ? t('globalPricing.billingMonthly')
                  : t('globalPricing.billingYearly')}
              >
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                  {b === 'monthly'
                    ? t('globalPricing.billingMonthly')
                    : t('globalPricing.billingYearly')}
                </Text>
                {b === 'yearly' && maxSavePct > 0 && (
                  <View style={styles.savePill}>
                    <Text style={styles.savePillText}>
                      {t('globalPricing.savePct', { pct: maxSavePct })}
                    </Text>
                  </View>
                )}
              </AnimatedPressable>
            );
          })}
        </View>

        {/* ── Tier cards ── */}
        {SUBSCRIPTION_PLANS.map(plan => {
          const amount = getPrice(plan.id, region, billing);
          const priceLabel = formatRegionalPrice(amount, region);
          const periodLabel = billing === 'yearly'
            ? t('globalPricing.perYear')
            : t('globalPricing.perMonth');
          const badgeText = plan.tier === 'pro'
            ? t('globalPricing.badgePopular')
            : plan.tier === 'elite'
              ? t('globalPricing.badgeBestValue')
              : null;
          const isIndia = region === 'in';
          const isFree = plan.tier === 'free';

          return (
            <View
              key={plan.id}
              style={[styles.card, plan.tier === 'elite' && styles.cardElite]}
              accessibilityLabel={t('globalPricing.a11yPlanCard', {
                plan: plan.name, price: priceLabel,
                period: billing === 'yearly'
                  ? t('globalPricing.billingYearly').toLowerCase()
                  : t('globalPricing.billingMonthly').toLowerCase(),
              })}
            >
              {badgeText && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badgeText}</Text>
                </View>
              )}
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{priceLabel}</Text>
                {!isFree && <Text style={styles.per}>{periodLabel}</Text>}
              </View>
              {billing === 'yearly' && !isFree && (
                <Text style={styles.billedYearly}>
                  {t('globalPricing.billedYearly', { price: priceLabel })}
                </Text>
              )}

              {plan.features.slice(0, 5).map(f => (
                <View key={f} style={styles.featureRow}>
                  <Text style={styles.featureBullet}>✓</Text>
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}

              {!isFree && (
                isIndia ? (
                  <AnimatedPressable
                    style={styles.cta}
                    onPress={handleUpgrade}
                    accessibilityLabel={t('globalPricing.ctaUpgradeIn')}
                  >
                    <Text style={styles.ctaText}>{t('globalPricing.ctaUpgradeIn')}</Text>
                  </AnimatedPressable>
                ) : (
                  <AnimatedPressable
                    style={styles.ctaGhost}
                    onPress={() => handleCheckout(plan.id)}
                    accessibilityLabel={t('globalPricing.ctaCheckout')}
                  >
                    <Text style={styles.ctaGhostText}>{t('globalPricing.ctaCheckout')}</Text>
                  </AnimatedPressable>
                )
              )}
              {isFree && (
                <View style={[styles.cta, styles.ctaDisabled]} accessibilityElementsHidden>
                  <Text style={styles.ctaText}>{t('globalPricing.ctaCurrentPlan')}</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* ── Footnotes ── */}
        <Text style={styles.footnote}>
          {region === 'in'
            ? t('globalPricing.regionNoteIn')
            : t('globalPricing.regionNoteGlobal', { currency: REGION_META[region].currency })}
        </Text>
        <Text style={styles.footnote}>{t('globalPricing.fxNote')}</Text>
        {region !== 'in' && (
          <Text style={styles.footnoteMuted}>{t('globalPricing.waitlistNote')}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    container: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },

    sectionTitle: { ...FONTS.bold, fontSize: 13, color: colors.textSecondary, marginBottom: SPACING.sm },
    chipRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.pill, borderWidth: 1,
      borderColor: colors.border, backgroundColor: colors.surface,
    },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
    chipFlag: { fontSize: 14 },
    chipText: { ...FONTS.semiBold, fontSize: 13, color: colors.text },
    chipTextActive: { color: colors.primary },
    chipAuto: { ...FONTS.regular, fontSize: 10, color: colors.textMuted },

    toggleRow: {
      flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg,
      backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.pill, padding: 4,
    },
    toggleBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.pill,
    },
    toggleBtnActive: { backgroundColor: colors.primary },
    toggleText: { ...FONTS.semiBold, fontSize: 13, color: colors.textSecondary },
    toggleTextActive: { color: '#FFFFFF' },
    savePill: {
      backgroundColor: '#10B981', borderRadius: BORDER_RADIUS.pill,
      paddingHorizontal: 6, paddingVertical: 1,
    },
    savePillText: { ...FONTS.bold, fontSize: 9, color: '#FFFFFF' },

    card: {
      backgroundColor: colors.surface, borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1,
      borderColor: colors.border,
    },
    cardElite: { borderColor: '#10B981' },
    badge: {
      alignSelf: 'flex-start', backgroundColor: colors.primary + '20',
      borderRadius: BORDER_RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2,
      marginBottom: SPACING.sm,
    },
    badgeText: { ...FONTS.bold, fontSize: 9, color: colors.primary },
    planName: { ...FONTS.bold, fontSize: 17, color: colors.text, marginBottom: 4 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 2 },
    price: { ...FONTS.bold, fontSize: 28, color: colors.text },
    per: { ...FONTS.regular, fontSize: 13, color: colors.textMuted },
    billedYearly: { ...FONTS.regular, fontSize: 11, color: colors.textMuted, marginBottom: SPACING.xs },

    featureRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
    featureBullet: { color: '#10B981', fontSize: 13, fontWeight: '700' },
    featureText: { ...FONTS.regular, flex: 1, fontSize: 13, color: colors.textSecondary },

    cta: {
      marginTop: SPACING.md, backgroundColor: colors.primary,
      borderRadius: BORDER_RADIUS.md, paddingVertical: 12, alignItems: 'center',
    },
    ctaDisabled: { backgroundColor: colors.border },
    ctaText: { ...FONTS.bold, fontSize: 13, color: '#FFFFFF' },
    ctaGhost: {
      marginTop: SPACING.md, borderRadius: BORDER_RADIUS.md, paddingVertical: 12,
      alignItems: 'center', borderWidth: 1.5, borderColor: colors.primary,
    },
    ctaGhostText: { ...FONTS.bold, fontSize: 13, color: colors.primary },

    footnote: { ...FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: SPACING.sm },
    footnoteMuted: { ...FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: SPACING.xs, marginBottom: SPACING.md, fontStyle: 'italic' },
  });
