/**
 * ============================================================================
 * Toroloom — Tenant Configuration Screen
 * ============================================================================
 *
 * Platform admin screen for configuring multi-tenant settings:
 *   1. Tenant Identity (id, name, domain, primaryColor)
 *   2. Feature Paywall Overrides (which features are free vs paid)
 *   3. Plan Pricing Overrides (custom monthly/yearly pricing per plan)
 *   4. Razorpay Keys (per-tenant payment routing)
 *
 * Changes are persisted via the subscription store's configureTenant() action
 * and immediately reflected in SubscriptionScreen and the feature matrix.
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useSubscriptionStore, SUBSCRIPTION_PLANS } from '../../store/subscriptionStore';
import {
  DEFAULT_FEATURE_MATRIX,
  SubscriptionFeature,
  SubscriptionTier,
  TenantConfig,
  PaywallOverride,
} from '../../types';
import { SPACING, FONTS, BORDER_RADIUS} from '../../constants/theme';
import Card from '../../components/ui/Card';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import AppScreen from '../../components/ui/AppScreen';


const TIERS: SubscriptionTier[] = ['free', 'pro', 'elite'];

export default function TenantConfigScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'TenantConfig'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Load existing tenant config (reactive subscription) ──
  const configureTenant = useSubscriptionStore(s => s.configureTenant);
  const existingConfig = useSubscriptionStore(s => s.tenantConfig);

  // ── Form state ───────────────────────────────────────────
  const [id, setId] = useState(existingConfig?.id ?? '');
  const [name, setName] = useState(existingConfig?.name ?? '');
  const [domain, setDomain] = useState(existingConfig?.domain ?? '');
  const [primaryColor, setPrimaryColor] = useState(existingConfig?.primaryColor ?? '');

  // Feature overrides — start with existing or empty
  const [featureOverrides, setFeatureOverrides] = useState<Record<string, string>>(() => {
    const overrides: Record<string, string> = {};
    if (existingConfig?.featureOverrides) {
      for (const [feature, tier] of Object.entries(existingConfig.featureOverrides)) {
        if (tier) overrides[feature] = tier;
      }
    }
    return overrides;
  });

  // Pricing overrides per plan
  const [pricingOverrides, setPricingOverrides] = useState<Record<string, { monthly: string; yearly: string }>>(() => {
    const pricing: Record<string, { monthly: string; yearly: string }> = {};
    const existingPricing = existingConfig?.razorpay?.pricing;
    if (existingPricing) {
      for (const [planId, prices] of Object.entries(existingPricing)) {
        if (prices) {
          pricing[planId] = {
            monthly: String(prices.monthly),
            yearly: String(prices.yearly),
          };
        }
      }
    }
    return pricing;
  });

  // Razorpay keys
  const [razorpayKeyId, setRazorpayKeyId] = useState(existingConfig?.razorpay?.keyId ?? '');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState(existingConfig?.razorpay?.keySecret ?? '');

  // ── Build and save ───────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!id.trim()) {
      Alert.alert(t('tenantConfig.validationError'), t('tenantConfig.idRequired'));
      return;
    }
    if (!name.trim()) {
      Alert.alert(t('tenantConfig.validationError'), t('tenantConfig.nameRequired'));
      return;
    }
    if (!domain.trim()) {
      Alert.alert(t('tenantConfig.validationError'), t('tenantConfig.domainRequired'));
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Build the pricing override object (only include plans with at least one value set)
    const pricing: Record<string, { monthly: number; yearly: number }> = {};
    for (const [planId, vals] of Object.entries(pricingOverrides)) {
      const monthly = parseInt(vals.monthly, 10);
      const yearly = parseInt(vals.yearly, 10);
      if (!isNaN(monthly) || !isNaN(yearly)) {
        pricing[planId] = {
          monthly: isNaN(monthly) ? 0 : monthly,
          yearly: isNaN(yearly) ? 0 : yearly,
        };
      }
    }

    // Build the feature overrides (only include non-default overrides)
    const builtOverrides: PaywallOverride = {};
    const allFeatures = Object.keys(DEFAULT_FEATURE_MATRIX) as SubscriptionFeature[];
    for (const feature of allFeatures) {
      const override = featureOverrides[feature];
      const defaultValue = DEFAULT_FEATURE_MATRIX[feature].minTier;
      if (override && override !== 'default' && override !== defaultValue) {
        builtOverrides[feature] = override as SubscriptionTier;
      }
    }

    const config: TenantConfig = {
      id: id.trim(),
      name: name.trim(),
      domain: domain.trim(),
      primaryColor: primaryColor.trim() || undefined,
      featureOverrides: Object.keys(builtOverrides).length > 0 ? builtOverrides : undefined,
      razorpay: razorpayKeyId.trim()
        ? {
            keyId: razorpayKeyId.trim(),
            keySecret: razorpayKeySecret.trim(),
            pricing: Object.keys(pricing).length > 0 ? pricing : undefined,
          }
        : undefined,
    };

    await configureTenant(config);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(t('app.saved'), `${t('tenantConfig.savedSuccess')} "${config.name}".`, [
      { text: t('app.ok'), onPress: () => navigation.goBack() },
    ]);
  }, [id, name, domain, primaryColor, featureOverrides, pricingOverrides, razorpayKeyId, razorpayKeySecret, configureTenant, navigation, t]);

  // ── Reset form to defaults ───────────────────────────────
  const handleReset = useCallback(() => {
    Alert.alert(
      t('tenantConfig.resetTitle'),
      t('tenantConfig.resetDesc'),
      [
        { text: t('app.cancel'), style: 'cancel' },
        {
          text: t('tenantConfig.reset'),
          style: 'destructive',
          onPress: async () => {
            setId('');
            setName('');
            setDomain('');
            setPrimaryColor('');
            setFeatureOverrides({});
            setPricingOverrides({});
            setRazorpayKeyId('');
            setRazorpayKeySecret('');
            await configureTenant({
              id: 'default',
              name: 'Toroloom',
              domain: 'toroloom.app',
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(t('tenantConfig.resetComplete'), t('tenantConfig.resetCompleteDesc'));
          },
        },
      ]
    );
  }, [configureTenant, t]);

  // ── Render ───────────────────────────────────────────────
  return (
          <AppScreen scroll={false} padded={false}
      >
  {/* Header */}
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
            <View style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </View>
          </AnimatedPressable>
          <Text style={styles.title}>{t('tenantConfig.title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Tenant Identity ──────────────────────────────── */}
          <Card title={t('tenantConfig.tenantIdentity')} style={styles.sectionCard}>
            <Text style={styles.fieldLabel}>{t('tenantConfig.tenantId')}</Text>
            <TextInput
              style={styles.input}
              value={id}
              onChangeText={setId}
              placeholder={t('tenantConfig.tenantIdPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              {...({ id: 'tenant-id', name: 'tenantId' } as { id: string; name: string })}
            />

            <Text style={styles.fieldLabel}>{t('tenantConfig.tenantName')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('tenantConfig.tenantNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              {...({ id: 'tenant-name', name: 'tenantName' } as { id: string; name: string })}
            />

            <Text style={styles.fieldLabel}>{t('tenantConfig.domain')}</Text>
            <TextInput
              style={styles.input}
              value={domain}
              onChangeText={setDomain}
              placeholder={t('tenantConfig.domainPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              {...({ id: 'tenant-domain', name: 'domain' } as { id: string; name: string })}
            />

            <Text style={styles.fieldLabel}>{t('tenantConfig.primaryColor')}</Text>
            <TextInput
              style={styles.input}
              value={primaryColor}
              onChangeText={setPrimaryColor}
              placeholder={t('tenantConfig.primaryColorPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              {...({ id: 'tenant-primary-color', name: 'primaryColor' } as { id: string; name: string })}
            />
          </Card>

          {/* ── Feature Overrides ────────────────────────────── */}
          <Card title={t('tenantConfig.featureOverrides')} style={styles.sectionCard}>
            <Text style={styles.helpText}>
              {t('tenantConfig.featureOverridesDesc')}
            </Text>
            <View style={styles.overrideList}>
              {(Object.keys(DEFAULT_FEATURE_MATRIX) as SubscriptionFeature[]).map((feature) => {
                const meta = DEFAULT_FEATURE_MATRIX[feature];
                const currentOverride = featureOverrides[feature];
                return (
                  <View key={feature} style={styles.overrideRow}>
                    <View style={styles.overrideInfo}>
                      <Text style={styles.overrideLabel}>{meta.label}</Text>
                      <Text style={styles.overrideDefault}>
                        {t('tenantConfig.default')}: <Text style={{ color: colors.primary }}>{meta.minTier}</Text>
                        {currentOverride && currentOverride !== 'default' && (
                          <Text style={{ color: colors.marketUp }}>
                            {' → '}{currentOverride}
                          </Text>
                        )}
                      </Text>
                    </View>
                    <View style={styles.overrideControls}>
                      {(['default', ...TIERS] as const).map((tier) => {
                        const isActive =
                          tier === 'default'
                            ? !currentOverride || currentOverride === 'default'
                            : currentOverride === tier;
                        return (
                          <AnimatedPressable
                            key={tier}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setFeatureOverrides((prev) => {
                                if (tier === 'default') {
                                  const next = { ...prev };
                                  delete next[feature];
                                  return next;
                                }
                                return { ...prev, [feature]: tier };
                              });
                            }}
                            haptic="none"
                            scaleTo={0.95}
                          >
                            <View
                              style={[
                                styles.tierChip,
                                isActive && styles.tierChipActive,
                                tier === 'free' && isActive && { backgroundColor: colors.marketUp + '30', borderColor: colors.marketUp },
                                tier === 'pro' && isActive && { backgroundColor: colors.primary + '30', borderColor: colors.primary },
                                tier === 'elite' && isActive && { backgroundColor: colors.warning + '30', borderColor: colors.warning },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.tierChipText,
                                  isActive && styles.tierChipTextActive,
                                ]}
                              >
                                {tier === 'default' ? '—' : tier.charAt(0).toUpperCase() + tier.slice(1)}
                              </Text>
                            </View>
                          </AnimatedPressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* ── Plan Pricing Overrides ───────────────────────── */}
          <Card title={t('tenantConfig.planPricingOverrides')} style={styles.sectionCard}>
            <Text style={styles.helpText}>
              {t('tenantConfig.planPricingOverridesDesc')}
            </Text>
            {SUBSCRIPTION_PLANS.filter((p) => p.tier !== 'free').map((plan) => {
              const values = pricingOverrides[plan.id] ?? { monthly: '', yearly: '' };
              return (
                <View key={plan.id} style={styles.pricingSection}>
                  <View style={styles.pricingHeader}>
                    <Ionicons name={plan.icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.primary} />
                    <Text style={styles.pricingPlanName}>{plan.name}</Text>
                  </View>
                  <View style={styles.pricingRow}>
                    <View style={styles.pricingField}>
                      <Text style={styles.pricingLabel}>{t('tenantConfig.monthly')}</Text>
                      <TextInput
                        style={styles.pricingInput}
                        value={values.monthly}
                        onChangeText={(v) =>
                          setPricingOverrides((prev) => ({
                            ...prev,
                            [plan.id]: { ...prev[plan.id], monthly: v },
                          }))
                        }
                        placeholder={String(plan.price)}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        {...({ id: `pricing-${plan.id}-monthly`, name: `${plan.id}_monthly` } as { id: string; name: string })}
                      />
                    </View>
                    <View style={styles.pricingField}>
                      <Text style={styles.pricingLabel}>{t('tenantConfig.yearly')}</Text>
                      <TextInput
                        style={styles.pricingInput}
                        value={values.yearly}
                        onChangeText={(v) =>
                          setPricingOverrides((prev) => ({
                            ...prev,
                            [plan.id]: { ...prev[plan.id], yearly: v },
                          }))
                        }
                        placeholder={String(plan.priceYearly)}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        {...({ id: `pricing-${plan.id}-yearly`, name: `${plan.id}_yearly` } as { id: string; name: string })}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>

          {/* ── Razorpay Keys ────────────────────────────────── */}
          <Card title={t('tenantConfig.razorpayConfig')} style={styles.sectionCard}>
            <Text style={styles.helpText}>
              {t('tenantConfig.razorpayConfigDesc')}
            </Text>

            <Text style={styles.fieldLabel}>{t('tenantConfig.keyId')}</Text>
            <TextInput
              style={styles.input}
              value={razorpayKeyId}
              onChangeText={setRazorpayKeyId}
              placeholder={t('tenantConfig.keyIdPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              {...({ id: 'tenant-razorpay-key-id', name: 'razorpayKeyId' } as { id: string; name: string })}
            />

            <Text style={styles.fieldLabel}>{t('tenantConfig.keySecret')}</Text>
            <TextInput
              style={styles.input}
              value={razorpayKeySecret}
              onChangeText={setRazorpayKeySecret}
              placeholder={t('tenantConfig.keySecretPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              {...({ id: 'tenant-razorpay-key-secret', name: 'razorpayKeySecret' } as { id: string; name: string })}
            />
          </Card>

          {/* ── Actions ──────────────────────────────────────── */}
          <View style={styles.actions}>
            <AnimatedPressable onPress={handleSave} haptic="medium" scaleTo={0.97}>
              <View style={styles.saveBtn}>
                <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                <Text style={styles.saveBtnText}>{t('tenantConfig.saveBtn')}</Text>
              </View>
            </AnimatedPressable>

            {existingConfig && existingConfig.id !== 'default' && (
              <AnimatedPressable onPress={handleReset} haptic="warning" scaleTo={0.97}>
                <View style={styles.resetBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  <Text style={styles.resetBtnText}>{t('tenantConfig.resetToDefault')}</Text>
                </View>
              </AnimatedPressable>
            )}
          </View>

          {/* ── Preview: Current Config Summary ──────────────── */}
          {existingConfig && existingConfig.id !== 'default' && (
            <Card title={t('tenantConfig.activeConfig')} style={styles.sectionCard}>
              <Text style={styles.configLine}>
                <Text style={styles.configLabel}>{t('tenantConfig.id')}: </Text>
                {existingConfig.id}
              </Text>
              <Text style={styles.configLine}>
                <Text style={styles.configLabel}>{t('tenantConfig.name')}: </Text>
                {existingConfig.name}
              </Text>
              <Text style={styles.configLine}>
                <Text style={styles.configLabel}>{t('tenantConfig.domain')}: </Text>
                {existingConfig.domain}
              </Text>
              {existingConfig.primaryColor && (
                <View style={styles.configRow}>
                  <Text style={styles.configLabel}>{t('tenantConfig.primaryColor')}: </Text>
                  <View
                    style={[styles.colorSwatch, { backgroundColor: existingConfig.primaryColor }]}
                  />
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {' '}{existingConfig.primaryColor}
                  </Text>
                </View>
              )}
              {existingConfig.featureOverrides && (
                <Text style={styles.configLine}>
                  <Text style={styles.configLabel}>{t('tenantConfig.featureOverrides')}: </Text>
                  {Object.keys(existingConfig.featureOverrides).length} feature(s)
                </Text>
              )}
              {existingConfig.razorpay?.keyId && (
                <Text style={styles.configLine}>
                  <Text style={styles.configLabel}>{t('tenantConfig.razorpay')}: </Text>
                  Configured ({existingConfig.razorpay.keyId.slice(0, 12)}...)
                </Text>
              )}
              {existingConfig.razorpay?.pricing && (
                <Text style={styles.configLine}>
                  <Text style={styles.configLabel}>{t('tenantConfig.pricingOverrides')}: </Text>
                  {Object.keys(existingConfig.razorpay.pricing).length} plan(s)
                </Text>
              )}
            </Card>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </AppScreen>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: {
    // AppScreen already pads for the status-bar/safe-area inset
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: SPACING.xl,
  },
  sectionCard: {
    marginBottom: SPACING.lg,
  },
  helpText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: SPACING.lg,
  },
  fieldLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  // ── Feature Overrides ──
  overrideList: {
    gap: 2,
  },
  overrideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  overrideInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  overrideLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  overrideDefault: {
    ...FONTS.regular,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  overrideControls: {
    flexDirection: 'row',
    gap: 4,
  },
  tierChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgInput,
  },
  tierChipActive: {
    backgroundColor: colors.primary + '30',
    borderColor: colors.primary,
  },
  tierChipText: {
    ...FONTS.medium,
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  tierChipTextActive: {
    color: colors.primary,
  },
  // ── Pricing Overrides ──
  pricingSection: {
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  pricingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  pricingPlanName: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  pricingRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  pricingField: {
    flex: 1,
  },
  pricingLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginBottom: 4,
  },
  pricingInput: {
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    ...FONTS.mono,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  // ── Actions ──
  actions: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: colors.primary,
  },
  saveBtnText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.white,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.danger + '30',
    backgroundColor: colors.danger + '10',
  },
  resetBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.danger,
  },
  // ── Active Config Preview ──
  configLine: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  configLabel: {
    ...FONTS.medium,
    color: colors.textMuted,
  },
  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
