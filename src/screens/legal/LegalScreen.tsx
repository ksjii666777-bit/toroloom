/**
 * ============================================================================
 * Toroloom — Legal & Disclosures Screen
 * ============================================================================
 *
 * Renders the in-app Privacy Policy, Terms of Service and SEBI disclaimer.
 * One screen, three sections — selected via route param (default: picker).
 * All copy lives in i18n (`legal.*`, en + hi). Sections are template text:
 * have a lawyer review before public launch.
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

type LegalSection = NonNullable<RootStackParamList['Legal']>['section'];

const SECTION_DEFS: Array<{
  id: Exclude<LegalSection, undefined>;
  titleKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'terms', titleKey: 'navToc', icon: 'document-text-outline' },
  { id: 'privacy', titleKey: 'navPrivacy', icon: 'shield-checkmark-outline' },
  { id: 'sebi', titleKey: 'navSebi', icon: 'ribbon-outline' },
];

/** Section bodies: ordered [headingKey, bodyKey] pairs from i18n. */
const SECTION_BODY: Record<Exclude<LegalSection, undefined>, Array<[string, string]>> = {
  terms: [
    ['tocAccept', 'tocAcceptBody'],
    ['tocEligibility', 'tocEligibilityBody'],
    ['tocAccount', 'tocAccountBody'],
    ['tocTradingRisk', 'tocTradingRiskBody'],
    ['tocFees', 'tocFeesBody'],
    ['tocConduct', 'tocConductBody'],
    ['tocTermination', 'tocTerminationBody'],
    ['tocLiability', 'tocLiabilityBody'],
    ['tocChanges', 'tocChangesBody'],
  ],
  privacy: [
    ['ppCollect', 'ppCollectBody'],
    ['ppUse', 'ppUseBody'],
    ['ppShare', 'ppShareBody'],
    ['ppStorage', 'ppStorageBody'],
    ['ppRights', 'ppRightsBody'],
  ],
  sebi: [
    ['sebiNotAdvice', 'sebiNotAdviceBody'],
    ['sebiMarketRisk', 'sebiMarketRiskBody'],
    ['sebiBrokerage', 'sebiBrokerageBody'],
    ['sebiGrievance', 'sebiGrievanceBody'],
  ],
};

function LegalScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'Legal'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const section = route.params?.section;

  const renderPicker = () => (
    <View style={styles.pickerWrap}>
      {SECTION_DEFS.map((def) => (
        <Pressable
          key={def.id}
          style={({ pressed }) => [styles.pickCard, pressed && { opacity: 0.7 }]}
          onPress={() => navigation.setParams({ section: def.id })}
          accessibilityRole="button"
          accessibilityLabel={t(`legal.${def.titleKey}`)}
        >
          <View style={styles.pickIconWrap}>
            <Ionicons name={def.icon} size={22} color={colors.primary} />
          </View>
          <View style={styles.pickTextWrap}>
            <Text style={styles.pickTitle}>{t(`legal.${def.titleKey}`)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );

  const renderSection = (id: Exclude<LegalSection, undefined>) => {
    const titleKey = SECTION_DEFS.find((d) => d.id === id)?.titleKey ?? 'navToc';
    return (
      <>
        <Text style={styles.sectionTitle}>{t(`legal.${titleKey}`)}</Text>
        <Text style={styles.updated}>{t('legal.updated')}</Text>
        {SECTION_BODY[id].map(([hKey, bKey]) => (
          <View key={hKey} style={styles.sectionBlock}>
            <Text style={styles.blockHeading}>{t(`legal.${hKey}`)}</Text>
            <Text style={styles.blockBody}>{t(`legal.${bKey}`)}</Text>
          </View>
        ))}
        <View style={styles.contactCard}>
          <Text style={styles.contactIntro}>{t('legal.contactIntro')}</Text>
          <Text style={styles.contactEmail}>{t('legal.contactEmail')}</Text>
        </View>
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
            <Text style={styles.title}>{section ? t(`legal.${SECTION_DEFS.find((d) => d.id === section)?.titleKey ?? 'title'}`) : t('legal.title')}</Text>
            <Text style={styles.subtitle}>{t('legal.subtitle')}</Text>
          </View>
        </View>

        {section ? (
          renderSection(section)
        ) : (
          <>
            <Text style={styles.updated}>{t('legal.updated')}</Text>
            {renderPicker()}
          </>
        )}

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
      marginBottom: SPACING.lg,
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
    updated: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginBottom: SPACING.md,
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
    contactCard: {
      marginTop: SPACING.xl,
      backgroundColor: colors.bgCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
    },
    contactIntro: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
    },
    contactEmail: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.primary,
      marginTop: 4,
    },
  });

export default LegalScreen;
