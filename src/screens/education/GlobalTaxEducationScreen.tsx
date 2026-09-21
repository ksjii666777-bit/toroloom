/**
 * ============================================================================
 * Toroloom — Global Tax & Charges Education Screen
 * ============================================================================
 *
 * Education module for Indian residents investing in global stocks:
 *   LRS remittance scheme → TCS (20% above ₹7L, refundable) → capital gains
 *   (STCG slab / LTCG 12.5%) → dividend withholding (W-8BEN, 25% treaty) →
 *   broker & forex charges → Schedule FA mandatory reporting.
 *
 * Same picker + section pattern as LegalScreen. All copy in i18n
 * (`taxEducation.*`, en + hi). Educational content only — clearly labelled
 * as not tax advice. Rates current as of September 2026.
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS } from '../../constants/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import AppScreen from '../../components/ui/AppScreen';
import TaxRRDisciplineCard from '../../components/tax/TaxRRDisciplineCard';

type TaxSection = NonNullable<RootStackParamList['GlobalTaxEducation']>['section'];

const SECTION_DEFS: Array<{
  id: Exclude<TaxSection, undefined>;
  titleKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'lrs', titleKey: 'navLrs', icon: 'globe-outline' },
  { id: 'tcs', titleKey: 'navTcs', icon: 'cash-outline' },
  { id: 'gains', titleKey: 'navGains', icon: 'trending-up-outline' },
  { id: 'dividend', titleKey: 'navDividend', icon: 'gift-outline' },
  { id: 'charges', titleKey: 'navCharges', icon: 'card-outline' },
  { id: 'fa', titleKey: 'navFa', icon: 'document-attach-outline' },
];

/** Section bodies: ordered [headingKey, bodyKey] pairs from i18n. */
const SECTION_BODY: Record<Exclude<TaxSection, undefined>, Array<[string, string]>> = {
  lrs: [
    ['lrsWhat', 'lrsWhatBody'],
    ['lrsLimit', 'lrsLimitBody'],
    ['lrsPurpose', 'lrsPurposeBody'],
    ['lrsCaution', 'lrsCautionBody'],
  ],
  tcs: [
    ['tcsWhat', 'tcsWhatBody'],
    ['tcsThreshold', 'tcsThresholdBody'],
    ['tcsCredit', 'tcsCreditBody'],
    ['tcsPlan', 'tcsPlanBody'],
  ],
  gains: [
    ['cgHolding', 'cgHoldingBody'],
    ['cgStcg', 'cgStcgBody'],
    ['cgLtcg', 'cgLtcgBody'],
    ['cgItr', 'cgItrBody'],
  ],
  dividend: [
    ['divWht', 'divWhtBody'],
    ['divIndia', 'divWhtIndiaBody'],
    ['divW8ben', 'divW8benBody'],
  ],
  charges: [
    ['chBroker', 'chBrokerBody'],
    ['chFx', 'chFxBody'],
    ['chGst', 'chGstBody'],
    ['chHidden', 'chHiddenBody'],
  ],
  fa: [
    ['faWhat', 'faWhatBody'],
    ['faWhen', 'faWhenBody'],
    ['faPenalty', 'faPenaltyBody'],
  ],
};

function GlobalTaxEducationScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'GlobalTaxEducation'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const section = route.params?.section;

  const openCommitFlow = () => navigation.navigate('BrokerConnect');
  const openJournal = () => navigation.navigate('BehavioralJournal');

  const renderPicker = () => (
    <View style={styles.pickerWrap}>
      {SECTION_DEFS.map((def) => (
        <Pressable
          key={def.id}
          style={({ pressed }) => [styles.pickCard, pressed && { opacity: 0.7 }]}
          onPress={() => navigation.setParams({ section: def.id })}
          accessibilityRole="button"
          accessibilityLabel={t(`taxEducation.${def.titleKey}`)}
        >
          <View style={styles.pickIconWrap}>
            <Ionicons name={def.icon} size={22} color={colors.primary} />
          </View>
          <View style={styles.pickTextWrap}>
            <Text style={styles.pickTitle}>{t(`taxEducation.${def.titleKey}`)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );

  const renderSection = (id: Exclude<TaxSection, undefined>) => {
    const titleKey = SECTION_DEFS.find((d) => d.id === id)?.titleKey ?? 'navLrs';
    return (
      <>
        <Text style={styles.sectionTitle}>{t(`taxEducation.${titleKey}`)}</Text>
        <Text style={styles.updated}>{t('taxEducation.updated')}</Text>
        {SECTION_BODY[id].map(([hKey, bKey]) => (
          <View key={hKey} style={styles.sectionBlock}>
            <Text style={styles.blockHeading}>{t(`taxEducation.${hKey}`)}</Text>
            <Text style={styles.blockBody}>{t(`taxEducation.${bKey}`)}</Text>
          </View>
        ))}
        <Pressable
          style={styles.backToPicker}
          onPress={() => navigation.setParams({ section: undefined })}
          accessibilityRole="button"
          accessibilityLabel={t('taxEducation.title')}
        >
          <Ionicons name="arrow-back" size={16} color={colors.primary} />
          <Text style={styles.backToPickerText}>{t('taxEducation.title')}</Text>
        </Pressable>
      </>
    );
  };

  return (
    <AppScreen scroll={false} padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() =>
              section ? navigation.setParams({ section: undefined }) : navigation.goBack()
            }
            style={styles.backBtn}
            accessibilityLabel={t('app.goBack')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.title}>{section ? t(`taxEducation.${SECTION_DEFS.find((d) => d.id === section)?.titleKey ?? 'title'}`) : t('taxEducation.title')}</Text>
            <Text style={styles.subtitle}>{t('taxEducation.subtitle')}</Text>
          </View>
        </View>

        {/* Disclaimer — always visible */}
        <View style={styles.disclaimerCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <Text style={styles.disclaimerText}>{t('taxEducation.disclaimer')}</Text>
        </View>

        {/* R:R discipline × post-tax impact — your real numbers */}
        <TaxRRDisciplineCard
          showCard={!section}
          onPressCommit={openCommitFlow}
          onPressJournal={openJournal}
        />

        {section ? (
          renderSection(section)
        ) : (
          renderPicker()
        )}

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>{t('taxEducation.notAdvice')}</Text>
          <Text style={styles.contactBody}>{t('taxEducation.notAdviceBody')}</Text>
          <Text style={styles.contactIntro}>{t('taxEducation.contactIntro')}</Text>
          <Text style={styles.contactEmail}>{t('taxEducation.contactEmail')}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </AppScreen>
  );
}

const createStyles = (colors: {
  bg: string;
  text: string;
  textMuted: string;
  primary: string;
  bgCard: string;
  border: string;
}) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      flexGrow: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.sm,
    },
    headerContent: { flex: 1 },
    title: {
      ...FONTS.bold,
      fontSize: FONTS.size.xl,
      color: colors.text,
    },
    subtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
      marginTop: 2,
    },
    disclaimerCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: colors.bgCard,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.sm,
      marginBottom: SPACING.md,
    },
    disclaimerText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      lineHeight: 18,
      color: colors.textMuted,
      flex: 1,
    },
    pickerWrap: { gap: SPACING.sm },
    pickCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      gap: SPACING.sm,
    },
    pickIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
    },
    pickTextWrap: { flex: 1 },
    pickTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    sectionTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      color: colors.text,
      marginBottom: 4,
    },
    updated: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginBottom: SPACING.md,
    },
    sectionBlock: { marginTop: SPACING.md },
    blockHeading: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.primary,
      marginBottom: 4,
    },
    blockBody: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      lineHeight: 22,
      color: colors.text,
    },
    backToPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: SPACING.xl,
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    backToPickerText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.primary,
    },
    contactCard: {
      marginTop: SPACING.xl,
      backgroundColor: colors.bgCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
    },
    contactTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: colors.text,
      marginBottom: 4,
    },
    contactBody: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      lineHeight: 20,
      color: colors.textMuted,
    },
    contactIntro: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
      marginTop: SPACING.sm,
    },
    contactEmail: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.primary,
      marginTop: 4,
    },
  });

export default GlobalTaxEducationScreen;
