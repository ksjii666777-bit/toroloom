/**
 * ============================================================================
 * Toroloom — Admin Coupon Management Screen
 * ============================================================================
 *
 * Full CRUD screen for coupon codes. Requires admin auth.
 *
 * Features:
 *   - List all coupons with edit/delete actions
 *   - Create new coupon (type: percentage / fixed / free_trial)
 *   - Edit existing coupon (partial update)
 *   - Delete coupon with confirmation
 *   - Seed default coupons (dev)
 *   - Pull-to-refresh with loading / empty states
 * ============================================================================
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { couponApi, AdminUsageResponse } from '../../services/api/coupons';
import type { CouponCode } from '../../types';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// ─── Type Helpers ─────────────────────────────────────────────

type CouponType = 'percentage' | 'fixed' | 'free_trial';

const COUPON_TYPES: { value: CouponType; label: string; icon: string; color: string }[] = [
  { value: 'percentage', label: 'Percentage', icon: 'percent', color: '#3B82F6' },
  { value: 'fixed', label: 'Fixed ₹', icon: 'pricetag', color: '#10B981' },
  { value: 'free_trial', label: 'Free Trial', icon: 'timer', color: '#FF9800' },
];

interface CouponFormData {
  code: string;
  type: CouponType;
  value: string;
  trialDays: string;
  minPlanTier: string;
  maxUses: string;
  expiresAt: string;
  description: string;
  isActive: boolean;
}

const EMPTY_FORM: CouponFormData = {
  code: '',
  type: 'percentage',
  value: '',
  trialDays: '',
  minPlanTier: '',
  maxUses: '',
  expiresAt: '',
  description: '',
  isActive: true,
};

// ─── Coupon List Item ─────────────────────────────────────────

function getTypeColor(type: CouponType): string {
  switch (type) {
    case 'percentage': return '#3B82F6';
    case 'fixed': return '#10B981';
    case 'free_trial': return '#FF9800';
  }
}

function getTypeIcon(type: CouponType): string {
  switch (type) {
    case 'percentage': return 'percent';
    case 'fixed': return 'pricetag';
    case 'free_trial': return 'timer';
  }
}

function formatDiscountText(coupon: CouponCode): string {
  switch (coupon.type) {
    case 'percentage': return `${coupon.value}% OFF`;
    case 'fixed': return `₹${coupon.value.toLocaleString('en-IN')} OFF`;
    case 'free_trial': return `${coupon.trialDays || 7}d FREE`;
  }
}

function getRemainingDays(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

// ─── Animated Coupon List Item ────────────────────────────────

function CouponListItem({
  coupon,
  index,
  onEdit,
  onDelete,
}: {
  coupon: CouponCode;
  index: number;
  onEdit: (c: CouponCode) => void;
  onDelete: (c: CouponCode) => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createListItemStyles(colors), [colors]);
  const scaleAnim = useSharedValue(0);
  const typeColor = getTypeColor(coupon.type);
  const daysLeft = getRemainingDays(coupon.expiresAt);
  const isExpired = daysLeft !== null && daysLeft <= 0;
  const usagePercent = (coupon.maxUses || 0) > 0 ? ((coupon.currentUses || 0) / (coupon.maxUses || 1)) * 100 : 0;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  useEffect(() => {
    scaleAnim.value = withDelay(index * 60, withSpring(1, { stiffness: 120, damping: 14 }));
  }, [index, scaleAnim]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify()}
      style={[s.itemCard, { backgroundColor: colors.bgCard, borderColor: isExpired ? colors.danger + '30' : colors.border }, animatedStyle]}
    >
      <View style={s.itemRow}>
        {/* Icon */}
        <View style={[s.itemIcon, { backgroundColor: (coupon.isActive ? typeColor : colors.textMuted) + '20' }]}>
          <Ionicons name={getTypeIcon(coupon.type) as any} size={20} color={coupon.isActive ? typeColor : colors.textMuted} />
        </View>

        {/* Info */}
        <View style={s.itemInfo}>
          <View style={s.itemCodeRow}>
            <Text style={[s.itemCode, { color: coupon.isActive ? colors.text : colors.textMuted }]}>
              {coupon.code}
            </Text>
            {!coupon.isActive && (
              <View style={[s.itemBadge, { backgroundColor: colors.danger + '20' }]}>
                <Text style={[s.itemBadgeText, { color: colors.danger }]}>DISABLED</Text>
              </View>
            )}
            {isExpired && (
              <View style={[s.itemBadge, { backgroundColor: colors.danger + '20' }]}>
                <Text style={[s.itemBadgeText, { color: colors.danger }]}>EXPIRED</Text>
              </View>
            )}
          </View>

          <Text style={[s.itemDiscount, { color: coupon.isActive ? typeColor : colors.textMuted }]}>
            {formatDiscountText(coupon)}
          </Text>

          <Text style={[s.itemDesc, { color: colors.textSecondary }]} numberOfLines={1}>
            {coupon.description}
          </Text>

          {/* Meta row */}
          <View style={s.itemMetaRow}>
            <View style={s.metaChip}>
              <Ionicons name="flash-outline" size={11} color={colors.textMuted} />
              <Text style={s.metaChipText}>
                {coupon.currentUses || 0}/{coupon.maxUses || '∞'}
              </Text>
            </View>
            {daysLeft !== null && (
              <View style={s.metaChip}>
                <Ionicons name="calendar-outline" size={11} color={isExpired ? colors.danger : colors.textMuted} />
                <Text style={[s.metaChipText, isExpired && { color: colors.danger }]}>
                  {isExpired ? 'Expired' : `${daysLeft}d`}
                </Text>
              </View>
            )}
            {coupon.minPlanTier && (
              <View style={s.metaChip}>
                <Ionicons name="layers-outline" size={11} color={colors.textMuted} />
                <Text style={s.metaChipText}>{coupon.minPlanTier.toUpperCase()}+</Text>
              </View>
            )}
          </View>

          {/* Usage bar */}
          {(coupon.maxUses || 0) > 0 && (
            <View style={[s.usageBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  s.usageFill,
                  {
                    width: `${Math.min(100, usagePercent)}%`,
                    backgroundColor: usagePercent > 80 ? colors.danger : typeColor,
                  },
                ]}
              />
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={s.itemActions}>
          <AnimatedPressable onPress={() => onEdit(coupon)} haptic="light" scaleTo={0.9}>
            <View style={[s.actionBtn, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </View>
          </AnimatedPressable>
          <AnimatedPressable onPress={() => onDelete(coupon)} haptic="warning" scaleTo={0.9}>
            <View style={[s.actionBtn, { backgroundColor: colors.danger + '15' }]}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </View>
          </AnimatedPressable>
        </View>
      </View>
    </Animated.View>
  );
}

const createListItemStyles = (colors: any) =>
  StyleSheet.create({
    itemCard: {
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.md,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
    },
    itemIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemInfo: {
      flex: 1,
    },
    itemCodeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: 2,
    },
    itemCode: {
      ...FONTS.mono,
      fontSize: FONTS.size.md,
      fontWeight: '700',
      letterSpacing: 1.5,
    },
    itemBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.xs,
    },
    itemBadgeText: {
      ...FONTS.bold,
      fontSize: 8,
      letterSpacing: 0.5,
    },
    itemDiscount: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      marginBottom: 2,
    },
    itemDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      lineHeight: 14,
      marginBottom: SPACING.sm,
    },
    itemMetaRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    metaChipText: {
      ...FONTS.regular,
      fontSize: 10,
      color: colors.textMuted,
    },
    usageBar: {
      height: 3,
      borderRadius: 1.5,
      overflow: 'hidden',
    },
    usageFill: {
      height: '100%',
      borderRadius: 1.5,
    },
    itemActions: {
      gap: SPACING.sm,
    },
    actionBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

// ─── Coupon Form Modal ────────────────────────────────────────

function CouponFormModal({
  visible,
  initialData,
  onSave,
  onClose,
}: {
  visible: boolean;
  initialData: CouponCode | null;
  onSave: (data: CouponFormData) => Promise<void>;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createFormStyles(colors), [colors]);
  const isEditing = !!initialData;
  const [form, setForm] = useState<CouponFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CouponFormData, string>>>({});

  useEffect(() => {
    if (initialData) {
      setForm({
        code: initialData.code,
        type: initialData.type,
        value: String(initialData.value),
        trialDays: initialData.trialDays ? String(initialData.trialDays) : '',
        minPlanTier: initialData.minPlanTier || '',
        maxUses: String(initialData.maxUses || 0),
        expiresAt: initialData.expiresAt ? initialData.expiresAt.split('T')[0] : '',
        description: initialData.description,
        isActive: initialData.isActive,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [initialData, visible]);

  const set = useCallback((field: keyof CouponFormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }, []);

  const validate = useCallback((): boolean => {
    const errs: Partial<Record<keyof CouponFormData, string>> = {};
    if (!isEditing && !form.code.trim()) errs.code = 'Code is required';
    if (!form.description.trim()) errs.description = 'Description is required';
    if (form.type !== 'free_trial') {
      const v = parseFloat(form.value);
      if (isNaN(v) || v <= 0) errs.value = 'Enter a valid discount value';
    }
    if (form.type === 'free_trial') {
      const d = parseInt(form.trialDays);
      if (isNaN(d) || d <= 0) errs.trialDays = 'Enter valid trial days';
    }
    const m = parseInt(form.maxUses);
    if (isNaN(m) || m < 0) errs.maxUses = 'Enter valid max uses';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, isEditing]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(form);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [form, validate, onSave, onClose]);

  const renderField = (
    label: string,
    field: keyof CouponFormData,
    opts: {
      placeholder?: string;
      keyboardType?: 'default' | 'numeric';
      multiline?: boolean;
      readOnly?: boolean;
    } = {},
  ) => (
    <View style={s.fieldGroup}>
      <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[
          s.fieldInput,
          { backgroundColor: colors.bgInput, color: colors.text, borderColor: errors[field] ? colors.danger : colors.border },
          opts.multiline && { height: 72, textAlignVertical: 'top', paddingTop: SPACING.md },
          opts.readOnly && { opacity: 0.6 },
        ]}
        value={String(form[field] ?? '')}
        onChangeText={v => set(field, v)}
        placeholder={opts.placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={opts.keyboardType || 'default'}
        multiline={opts.multiline}
        editable={!opts.readOnly}
        autoCapitalize={field === 'code' ? 'characters' : 'none'}
      />
      {errors[field] && (
        <Text style={[s.fieldError, { color: colors.danger }]}>{errors[field]}</Text>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="pageSheet">
      <View style={[s.modalOverlay, { backgroundColor: colors.bgOverlay }]}>
        <View style={[s.modalContent, { backgroundColor: colors.bgSecondary }]}>
          {/* Modal Header */}
          <View style={s.modalHeader}>
            <View>
              <Text style={[s.modalTitle, { color: colors.text }]}>
                {isEditing ? 'Edit Coupon' : 'Create Coupon'}
              </Text>
              <Text style={[s.modalSubtitle, { color: colors.textMuted }]}>
                {isEditing ? `Editing ${initialData?.code}` : 'Add a new promo code'}
              </Text>
            </View>
            <AnimatedPressable onPress={onClose} haptic="light" scaleTo={0.9}>
              <View style={[s.closeBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Ionicons name="close" size={22} color={colors.text} />
              </View>
            </AnimatedPressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.modalScroll}>
            {/* Type Selector */}
            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Coupon Type</Text>
            <View style={s.typeRow}>
              {COUPON_TYPES.map(t => (
                <AnimatedPressable
                  key={t.value}
                  onPress={() => {
                    set('type', t.value);
                    if (t.value === 'free_trial') set('value', '0');
                  }}
                  haptic="light"
                  scaleTo={0.95}
                  style={{ flex: 1 }}
                >
                  <View
                    style={[
                      s.typeBtn,
                      {
                        backgroundColor: form.type === t.value ? t.color + '20' : colors.bgCard,
                        borderColor: form.type === t.value ? t.color : colors.border,
                      },
                    ]}
                  >
                    <Ionicons name={t.icon as any} size={20} color={form.type === t.value ? t.color : colors.textMuted} />
                    <Text
                      style={[
                        s.typeBtnLabel,
                        { color: form.type === t.value ? t.color : colors.textMuted },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </View>
                </AnimatedPressable>
              ))}
            </View>

            {renderField('Coupon Code', 'code', {
              placeholder: 'e.g. SUMMER50',
              readOnly: isEditing,
            })}

            {form.type !== 'free_trial' && renderField('Discount Value', 'value', {
              placeholder: form.type === 'percentage' ? 'e.g. 20 (for 20% off)' : 'e.g. 100 (for ₹100 off)',
              keyboardType: 'numeric',
            })}

            {form.type === 'free_trial' && renderField('Trial Days', 'trialDays', {
              placeholder: 'e.g. 7',
              keyboardType: 'numeric',
            })}

            {renderField('Description', 'description', {
              placeholder: 'e.g. 20% off all Pro plans',
              multiline: true,
            })}

            {/* Optional fields */}
            <Text style={[s.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.md }]}>
              Optional Settings
            </Text>

            <View style={s.optRow}>
              <View style={{ flex: 1 }}>
                {renderField('Min Plan Tier', 'minPlanTier', { placeholder: 'free / pro / elite' })}
              </View>
              <View style={{ width: SPACING.md }} />
              <View style={{ flex: 1 }}>
                {renderField('Max Uses', 'maxUses', { placeholder: 'e.g. 1000', keyboardType: 'numeric' })}
              </View>
            </View>

            {renderField('Expiry Date', 'expiresAt', {
              placeholder: 'YYYY-MM-DD (leave empty = no expiry)',
            })}

            {/* Active toggle */}
            <View style={s.toggleRow}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Active</Text>
              <AnimatedPressable
                onPress={() => set('isActive', !form.isActive)}
                haptic="light"
                scaleTo={0.95}
              >
                <View
                  style={[
                    s.toggleTrack,
                    { backgroundColor: form.isActive ? colors.primary + '30' : colors.border },
                  ]}
                >
                  <View
                    style={[
                      s.toggleThumb,
                      {
                        backgroundColor: form.isActive ? colors.primary : colors.textMuted,
                        alignSelf: form.isActive ? 'flex-end' : 'flex-start',
                      },
                    ]}
                  />
                </View>
              </AnimatedPressable>
            </View>

            {/* Action buttons */}
            <View style={s.modalActions}>
              <AnimatedPressable onPress={onClose} haptic="light" scaleTo={0.97} style={{ flex: 1 }}>
                <View style={[s.cancelBtn, { borderColor: colors.border }]}>
                  <Text style={[s.cancelBtnText, { color: colors.text }]}>Cancel</Text>
                </View>
              </AnimatedPressable>
              <AnimatedPressable onPress={handleSave} haptic="medium" scaleTo={0.97} style={{ flex: 1 }} disabled={saving}>
                <LinearGradient colors={['#3B82F6', '#1D4ED8'] as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.saveBtn}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.saveBtnText}>{isEditing ? 'Update Coupon' : 'Create Coupon'}</Text>
                  )}
                </LinearGradient>
              </AnimatedPressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createFormStyles = (colors: any) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalContent: {
      borderTopLeftRadius: BORDER_RADIUS.xxl,
      borderTopRightRadius: BORDER_RADIUS.xxl,
      maxHeight: '92%',
      paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: SPACING.xl,
      paddingBottom: SPACING.md,
    },
    modalTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.xl,
    },
    modalSubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      marginTop: 2,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
    },
    modalScroll: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.xxl,
    },
    fieldGroup: {
      marginBottom: SPACING.md,
    },
    fieldLabel: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      marginBottom: SPACING.sm,
    },
    fieldInput: {
      ...FONTS.regular,
      fontSize: FONTS.size.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      minHeight: 44,
    },
    fieldError: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      marginTop: 4,
    },
    typeRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    typeBtn: {
      alignItems: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
    },
    typeBtnLabel: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
    },
    optRow: {
      flexDirection: 'row',
    },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.xl,
    },
    toggleTrack: {
      width: 48,
      height: 28,
      borderRadius: 14,
      padding: 3,
      justifyContent: 'center',
    },
    toggleThumb: {
      width: 22,
      height: 22,
      borderRadius: 11,
    },
    modalActions: {
      flexDirection: 'row',
      gap: SPACING.md,
      marginTop: SPACING.md,
    },
    cancelBtn: {
      paddingVertical: SPACING.lg,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      alignItems: 'center',
    },
    cancelBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
    },
    saveBtn: {
      paddingVertical: SPACING.lg,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
    },
    saveBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: '#fff',
    },
  });

// ═══════════════════════════════════════════════════════════════
//  BAR CHART COMPONENT
// ═══════════════════════════════════════════════════════════════

function UsageBarChart({
  data,
  color,
  maxValue,
  height = 100,
  barWidth = 24,
  label,
  formatLabel,
}: {
  data: { label: string; value: number }[];
  color: string;
  maxValue?: number;
  height?: number;
  barWidth?: number;
  label?: string;
  formatLabel?: (value: number) => string;
}) {
  const { colors } = useTheme();
  const max = maxValue ?? Math.max(...data.map(d => d.value), 1);

  return (
    <View style={{ marginHorizontal: SPACING.xl, marginBottom: SPACING.lg }}>
      {label && (
        <Text style={{ ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.md }}>
          {label}
        </Text>
      )}
      <View style={{ backgroundColor: colors.bgCard, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: colors.border, padding: SPACING.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height }}>
          {data.map((item, i) => {
            const barH = Math.max(4, (item.value / max) * (height - 20));
            return (
              <Animated.View
                key={item.label}
                entering={FadeInDown.delay(i * 60).springify()}
                style={{ flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}
              >
                {/* Value label */}
                <Text style={{ ...FONTS.medium, fontSize: 9, color: colors.text, marginBottom: 4 }}>
                  {formatLabel ? formatLabel(item.value) : item.value}
                </Text>
                {/* Bar */}
                <View
                  style={{
                    width: '100%',
                    maxWidth: barWidth,
                    height: barH,
                    borderRadius: 4,
                    backgroundColor: color,
                    opacity: 0.8 + (item.value / max) * 0.2,
                    minWidth: 8,
                  }}
                />
                {/* X-axis label */}
                <Text
                  style={{
                    ...FONTS.regular,
                    fontSize: 8,
                    color: colors.textMuted,
                    marginTop: 6,
                    textAlign: 'center',
                    transform: [{ rotate: '-45deg' }],
                    width: 40,
                  }}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── CSV Export Helpers ──────────────────────────────────────────

/** Escape CSV field (wrap in quotes if contains comma, quote, or newline) */
function csvField(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV row from values */
function csvRow(...vals: (string | number)[]): string {
  return vals.map(v => csvField(v)).join(',') + '\n';
}

/** Generate a unique filename with timestamp */
function generateCsvFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  const time = Date.now().toString(36).slice(-6).toUpperCase();
  return `CouponUsage_${date}_${time}.csv`;
}

/** Build CSV string from usage analytics data */
function buildCouponUsageCSV(data: AdminUsageResponse): string {
  const { summary, usages } = data;
  let csv = '';

  // ── Header ──
  csv += 'Toroloom Coupon Usage Report\n';
  csv += `Generated,${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n`;

  // ── Summary Section ──
  csv += '=== SUMMARY ===\n';
  csv += csvRow('Metric', 'Value');
  csv += csvRow('Total Uses', summary.totalUsages);
  csv += csvRow('Total Discount Given', summary.totalDiscountAmount);
  csv += csvRow('Total Original Price', summary.totalOriginalPrice);
  csv += csvRow('Unique Users', summary.uniqueUsers);
  csv += csvRow('Unique Coupons Used', summary.uniqueCoupons);
  csv += '\n';

  // ── Per-Coupon Breakdown ──
  csv += '=== PER-COUPON BREAKDOWN ===\n';
  csv += csvRow('Code', 'Uses', 'Unique Users', 'Total Discount');
  for (const [code, b] of Object.entries(summary.couponBreakdown)) {
    csv += csvRow(code, b.count, b.uniqueUsers, b.totalDiscount);
  }
  csv += '\n';

  // ── Usage History ──
  csv += '=== USAGE HISTORY ===\n';
  csv += csvRow('ID', 'Code', 'User ID', 'Plan ID', 'Discount Amount', 'Original Price', 'Used At');
  for (const usage of usages) {
    const date = new Date(usage.usedAt).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    csv += csvRow(usage.id, usage.code, usage.userId, usage.planId, usage.discountAmount, usage.originalPrice, date);
  }

  return csv;
}

/** Export coupon usage data as CSV and share via OS share sheet */
async function exportCouponUsageCSV(data: AdminUsageResponse): Promise<{ success: boolean; error?: string }> {
  try {
    const csv = buildCouponUsageCSV(data);
    const filename = generateCsvFilename();
    const filePath = `${cacheDirectory ?? '.'}/${filename}`;

    await writeAsStringAsync(filePath, csv, { encoding: EncodingType.UTF8 });

    if (!(await Sharing.isAvailableAsync())) {
      return { success: false, error: 'Sharing is not available on this device' };
    }

    await Sharing.shareAsync(filePath, { mimeType: 'text/csv' });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error exporting CSV';
    return { success: false, error: msg };
  }
}

// ═══════════════════════════════════════════════════════════════
//  USAGE ANALYTICS TAB
// ═══════════════════════════════════════════════════════════════

function UsageAnalyticsTab({
  loading,
  data,
  colors,
  styles: s,
}: {
  loading: boolean;
  data: AdminUsageResponse | null;
  colors: any;
  styles: any;
}) {
  if (loading) {
    return (
      <View style={{ paddingVertical: 80, alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[s.loadingText, { color: colors.textMuted, marginTop: 12 }]}>Loading usage data...</Text>
      </View>
    );
  }

  if (!data || data.usages.length === 0) {
    return (
      <View style={[s.emptyContainer, { paddingTop: 60 }]}>
        <View style={[s.emptyIconWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="analytics-outline" size={36} color={colors.textMuted} />
        </View>
        <Text style={[s.emptyTitle, { color: colors.text }]}>No Usage Data</Text>
        <Text style={[s.emptySubtitle, { color: colors.textMuted }]}>
          Coupons haven't been used by any users yet.
        </Text>
      </View>
    );
  }

  const { summary, usages } = data;
  const breakdownEntries = Object.entries(summary.couponBreakdown).sort(
    ([, a], [, b]) => b.count - a.count,
  );

  return (
    <>
      {/* Summary Cards */}
      <Text style={[s.listTitle, { color: colors.text }]}>Overview</Text>
      <View style={s.statsRow}>
        <View style={[s.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[s.statIcon, { backgroundColor: colors.marketUp + '20' }]}>
            <Ionicons name="flash" size={18} color={colors.marketUp} />
          </View>
          <Text style={[s.statValue, { color: colors.text }]}>{summary.totalUsages}</Text>
          <Text style={[s.statLabel, { color: colors.textMuted }]}>Total Uses</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[s.statIcon, { backgroundColor: colors.warning + '20' }]}>
            <Ionicons name="people" size={18} color={colors.warning} />
          </View>
          <Text style={[s.statValue, { color: colors.text }]}>{summary.uniqueUsers}</Text>
          <Text style={[s.statLabel, { color: colors.textMuted }]}>Users</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[s.statIcon, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="pricetag" size={18} color={colors.primary} />
          </View>
          <Text style={[s.statValue, { color: colors.text }]}>{summary.uniqueCoupons}</Text>
          <Text style={[s.statLabel, { color: colors.textMuted }]}>Coupons</Text>
        </View>
      </View>

      {/* Export Button */}
      <View style={{ marginHorizontal: SPACING.xl, marginBottom: SPACING.lg }}>
        <AnimatedPressable
          onPress={async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const result = await exportCouponUsageCSV(data);
            if (!result.success && result.error) {
              Alert.alert('Export Failed', result.error);
            }
          }}
          haptic="medium"
          scaleTo={0.96}
        >
          <LinearGradient colors={['#8B5CF6', '#6C63FF'] as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: SPACING.sm,
            paddingVertical: SPACING.lg,
            borderRadius: BORDER_RADIUS.md,
          }}>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={{ ...FONTS.semiBold, fontSize: FONTS.size.md, color: '#fff' }}>Export CSV</Text>
          </LinearGradient>
        </AnimatedPressable>
      </View>

      {/* Total Discount Card */}
      <View style={[s.totalDiscountCard, { backgroundColor: colors.marketUp + '10', borderColor: colors.marketUp + '30' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="trending-down" size={20} color={colors.marketUp} />
          <Text style={{ ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.textSecondary }}>Total Discount Given</Text>
        </View>
        <Text style={{ ...FONTS.bold, fontSize: FONTS.size.xxl, color: colors.marketUp, marginTop: 4 }}>
          ₹{summary.totalDiscountAmount.toLocaleString('en-IN')}
        </Text>
        <Text style={{ ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 }}>
          Across {summary.totalUsages} uses · Avg ₹{(summary.totalDiscountAmount / summary.totalUsages || 0).toFixed(0)} per use
        </Text>
      </View>

      {/* ─── Usage Over Time Chart ─── */}
      {(() => {
        // Group usages by month (last 6 months)
        const now = new Date();
        const monthLabels: string[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthLabels.push(d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }));
        }
        const monthlyCounts: Record<string, number> = {};
        monthLabels.forEach(m => { monthlyCounts[m] = 0; });
        for (const usage of usages) {
          const d = new Date(usage.usedAt);
          const key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
          if (monthlyCounts[key] !== undefined) monthlyCounts[key]++;
        }
        const monthlyData = monthLabels.map(label => ({ label, value: monthlyCounts[label] || 0 }));
        return (
          <UsageBarChart
            data={monthlyData}
            color={colors.primary}
            label="Uses Over Time (Monthly)"
            formatLabel={(v) => `${v}`}
          />
        );
      })()}

      {/* ─── Per-Coupon Usage Chart ─── */}
      {(() => {
        const breakdownData = Object.entries(summary.couponBreakdown)
          .map(([code, b]) => ({ label: code, value: b.count }))
          .sort((a, b) => b.value - a.value);
        const maxCount = breakdownData.length > 0 ? breakdownData[0].value : 1;
        return (
          <View style={{ marginHorizontal: SPACING.xl, marginBottom: SPACING.lg }}>
            <Text style={{ ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.md }}>
              Per-Coupon Usage
            </Text>
            <View style={{ backgroundColor: colors.bgCard, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: colors.border, padding: SPACING.md }}>
              {breakdownData.map((item, i) => {
                const barW = Math.max(4, (item.value / maxCount) * 100);
                return (
                  <Animated.View
                    key={item.label}
                    entering={FadeInDown.delay(i * 40).springify()}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}
                  >
                    <Text style={{ ...FONTS.mono, fontSize: 10, fontWeight: '700', width: 60, color: colors.text, letterSpacing: 1 }}>
                      {item.label}
                    </Text>
                    <View style={{ flex: 1, height: 20, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}>
                      <Animated.View
                        entering={FadeInDown.delay(i * 50).springify()}
                        style={{
                          width: `${barW}%`,
                          height: '100%',
                          borderRadius: 4,
                          backgroundColor: '#8B5CF6',
                          opacity: 0.7 + (item.value / maxCount) * 0.3,
                        }}
                      />
                    </View>
                    <Text style={{ ...FONTS.medium, fontSize: 10, color: colors.text, width: 30, textAlign: 'right' }}>
                      {item.value}
                    </Text>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        );
      })()}

      {/* Per-Coupon Breakdown */}
      <Text style={[s.listTitle, { color: colors.text, marginTop: 8 }]}>Per-Coupon Details</Text>
      {breakdownEntries.map(([code, breakdown], i) => (
        <Animated.View
          key={code}
          entering={FadeInDown.delay(i * 50).springify()}
          style={[s.itemCard as any, { backgroundColor: colors.bgCard, borderColor: colors.border, padding: 12 }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[s.itemIcon as any, { backgroundColor: '#8B5CF6' + '20' }]}>
              <Ionicons name="pricetag" size={18} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...FONTS.mono, fontSize: FONTS.size.md, fontWeight: '700', letterSpacing: 1.5, color: colors.text }}>
                {code}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <Text style={{ ...FONTS.regular, fontSize: 10, color: colors.textMuted }}>
                  {breakdown.count} uses
                </Text>
                <Text style={{ ...FONTS.regular, fontSize: 10, color: colors.textMuted }}>
                  {breakdown.uniqueUsers} users
                </Text>
                <Text style={{ ...FONTS.regular, fontSize: 10, color: colors.marketUp }}>
                  ₹{breakdown.totalDiscount.toLocaleString('en-IN')} off
                </Text>
              </View>
              {/* Mini bar */}
              <View style={[s.usageBar as any, { backgroundColor: colors.border, marginTop: 6 }]}>
                <View
                  style={{
                    height: '100%',
                    borderRadius: 1.5,
                    width: `${Math.min(100, (breakdown.count / usages.length) * 100)}%`,
                    backgroundColor: '#8B5CF6',
                  }}
                />
              </View>
            </View>
          </View>
        </Animated.View>
      ))}

      {/* Recent Usage List */}
      <Text style={[s.listTitle, { color: colors.text, marginTop: 12 }]}>Recent Usage</Text>
      {usages.slice(0, 50).map((usage, i) => (
        <Animated.View
          key={usage.id}
          entering={FadeInDown.delay(i * 30).springify()}
          style={{
            marginHorizontal: SPACING.xl,
            marginBottom: 6,
            borderRadius: BORDER_RADIUS.sm,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 10,
            backgroundColor: colors.bgCard,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ ...FONTS.mono, fontSize: FONTS.size.sm, fontWeight: '700', color: colors.text }}>
                  {usage.code}
                </Text>
                <Text style={{ ...FONTS.regular, fontSize: 10, color: colors.textMuted }}>
                  @ {usage.planId}
                </Text>
              </View>
              <Text style={{ ...FONTS.regular, fontSize: 9, color: colors.textMuted, marginTop: 2 }}>
                User: {usage.userId.slice(0, 16)}… · {new Date(usage.usedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            <Text style={{ ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.marketUp }}>
              -₹{usage.discountAmount.toLocaleString('en-IN')}
            </Text>
          </View>
        </Animated.View>
      ))}

      {usages.length > 50 && (
        <Text style={{ textAlign: 'center', ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 8 }}>
          Showing 50 of {usages.length} usages
        </Text>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════════════

export default function AdminCouponManagementScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isAdmin = useAuthStore(s => s.isAdmin);

  // ─── Admin guard ───────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!isAdmin) {
        Alert.alert(
          'Access Denied',
          'Only administrators can access the Coupon Manager.',
          [{ text: 'Go Back', onPress: () => navigation.goBack() }],
        );
      }
    }, [isAdmin, navigation]),
  );

  const [coupons, setCoupons] = useState<CouponCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [activeTab, setActiveTab] = useState<'coupons' | 'usage'>('coupons');

  // Usage analytics state
  const [usageData, setUsageData] = useState<AdminUsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Modal state
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponCode | null>(null);

  // ─── Load Coupons ──────────────────────────────────────────

  const loadCoupons = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const result = await couponApi.getCoupons();
      setCoupons(result.coupons || []);
    } catch {
      // Silently fail — list stays empty
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  // ─── Handlers ──────────────────────────────────────────────

  const handleCreate = useCallback(() => {
    setEditingCoupon(null);
    setFormModalVisible(true);
  }, []);

  const handleEdit = useCallback((coupon: CouponCode) => {
    setEditingCoupon(coupon);
    setFormModalVisible(true);
  }, []);

  const handleDelete = useCallback((coupon: CouponCode) => {
    Alert.alert(
      'Delete Coupon',
      `Are you sure you want to delete "${coupon.code}"?\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await couponApi.deleteCoupon(coupon.code);
            if (ok) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setCoupons(prev => prev.filter(c => c.code !== coupon.code));
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete coupon.');
            }
          },
        },
      ],
    );
  }, []);

  const handleSave = useCallback(
    async (formData: CouponFormData) => {
      const payload: any = {
        code: formData.code.trim(),
        type: formData.type,
        description: formData.description.trim(),
        maxUses: parseInt(formData.maxUses) || 0,
        minPlanTier: formData.minPlanTier.trim().toLowerCase() || undefined,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
        isActive: formData.isActive,
      };

      if (formData.type === 'free_trial') {
        payload.value = 0;
        payload.trialDays = parseInt(formData.trialDays) || 7;
      } else {
        payload.value = parseFloat(formData.value) || 0;
      }

      let ok: boolean;
      if (editingCoupon) {
        // Editing: use PUT
        ok = await couponApi.updateCoupon(formData.code, payload);
      } else {
        // Creating: use POST
        ok = await couponApi.createCoupon(payload);
      }

      if (ok) {
        await loadCoupons();
      } else {
        throw new Error('Save failed');
      }
    },
    [editingCoupon, loadCoupons],
  );

  const handleSeed = useCallback(() => {
    Alert.alert(
      'Seed Default Coupons',
      'This will add the 4 default coupons (SAVE20, ELITE100, TRYPRO, WELCOME10) if they do not already exist.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed',
          onPress: async () => {
            setSeeding(true);
            const count = await couponApi.seedCoupons();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await loadCoupons();
            setSeeding(false);
          },
        },
      ],
    );
  }, [loadCoupons]);

  const handleCloseModal = useCallback(() => {
    setFormModalVisible(false);
    setEditingCoupon(null);
  }, []);

  // ─── Load Usage Data ──────────────────────────────────────

  const loadUsageData = useCallback(async () => {
    setUsageLoading(true);
    try {
      const data = await couponApi.getAllUsageHistory();
      setUsageData(data);
    } catch {
      setUsageData(null);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'usage') {
      loadUsageData();
    }
  }, [activeTab, loadUsageData]);

  // ─── Stats ─────────────────────────────────────────────────

  const totalActive = coupons.filter(c => c.isActive && (!c.expiresAt || new Date(c.expiresAt) > new Date())).length;
  const totalExpired = coupons.filter(c => c.expiresAt && new Date(c.expiresAt) <= new Date()).length;
  const totalDisabled = coupons.filter(c => !c.isActive).length;

  // ─── Render ─────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
          <View style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </View>
        </AnimatedPressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Coupon Manager</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Admin • {activeTab === 'coupons' ? `${coupons.length} coupons` : `${usageData?.summary.totalUsages || 0} uses`}</Text>
        </View>
        {activeTab === 'coupons' && (
          <AnimatedPressable onPress={handleCreate} haptic="medium" scaleTo={0.92}>
            <LinearGradient colors={['#3B82F6', '#1D4ED8'] as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addBtn}>
              <Ionicons name="add" size={22} color="#fff" />
            </LinearGradient>
          </AnimatedPressable>
        )}
      </View>

      {/* Tab Toggle */}
      <View style={[styles.toggleRow, { backgroundColor: colors.bgInput }]}>
        <AnimatedPressable
          onPress={() => setActiveTab('coupons')}
          haptic="light"
          scaleTo={0.97}
          style={{ flex: 1 }}
        >
          <View style={[styles.toggleBtn, activeTab === 'coupons' && { backgroundColor: colors.primary }]}>
            <Ionicons name="pricetag" size={16} color={activeTab === 'coupons' ? '#fff' : colors.textMuted} />
            <Text style={[styles.toggleText, { color: activeTab === 'coupons' ? '#fff' : colors.textMuted }]}>Coupons</Text>
          </View>
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => setActiveTab('usage')}
          haptic="light"
          scaleTo={0.97}
          style={{ flex: 1 }}
        >
          <View style={[styles.toggleBtn, activeTab === 'usage' && { backgroundColor: colors.primary }]}>
            <Ionicons name="analytics" size={16} color={activeTab === 'usage' ? '#fff' : colors.textMuted} />
            <Text style={[styles.toggleText, { color: activeTab === 'usage' ? '#fff' : colors.textMuted }]}>Usage</Text>
          </View>
        </AnimatedPressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={activeTab === 'coupons' ? refreshing : usageLoading}
            onRefresh={activeTab === 'coupons' ? () => loadCoupons(true) : loadUsageData}
            tintColor={colors.primary}
          />
        }
      >
        {activeTab === 'coupons' ? (
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading coupons...</Text>
            </View>
          ) : (
            <>
              {/* Stats Cards */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={[styles.statIcon, { backgroundColor: colors.marketUp + '20' }]}>
                    <Ionicons name="pricetag" size={18} color={colors.marketUp} />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{totalActive}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Active</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={[styles.statIcon, { backgroundColor: colors.warning + '20' }]}>
                    <Ionicons name="ban" size={18} color={colors.warning} />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{totalDisabled}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Disabled</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={[styles.statIcon, { backgroundColor: colors.danger + '20' }]}>
                    <Ionicons name="calendar" size={18} color={colors.danger} />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{totalExpired}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Expired</Text>
                </View>
              </View>

              {/* Seed Button */}
              <AnimatedPressable onPress={handleSeed} haptic="light" scaleTo={0.97} disabled={seeding}>
                <View style={[styles.seedBtn, { borderColor: colors.border }]}>
                  <Ionicons name="refresh" size={16} color={colors.primary} />
                  <Text style={[styles.seedBtnText, { color: colors.primary }]}>
                    {seeding ? 'Seeding...' : 'Seed Default Coupons'}
                  </Text>
                </View>
              </AnimatedPressable>

              {/* Coupon List */}
              {coupons.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={[styles.emptyIconWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Ionicons name="pricetag-outline" size={36} color={colors.textMuted} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Coupons Yet</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                    Tap the + button to create your first promo code.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.listTitle, { color: colors.text }]}>
                    All Coupons ({coupons.length})
                  </Text>
                  {coupons.map((coupon, i) => (
                    <CouponListItem
                      key={coupon.code}
                      coupon={coupon}
                      index={i}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </>
              )}
            </>
          )
        ) : (
          /* ═══ Usage Analytics Tab ═══ */
          <UsageAnalyticsTab loading={usageLoading} data={usageData} colors={colors} styles={styles} />
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Coupon Form Modal */}
      <CouponFormModal
        visible={formModalVisible}
        initialData={editingCoupon}
        onSave={handleSave}
        onClose={handleCloseModal}
      />
    </View>
  );
}

// ─── Main Screen Styles ───────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      paddingTop: 60,
      paddingHorizontal: SPACING.xl,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
    },
    title: {
      ...FONTS.bold,
      fontSize: FONTS.size.title,
    },
    subtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      marginTop: 1,
    },
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      paddingBottom: SPACING.xl,
    },
    // ─── Tab Toggle ────────────────────────────────────────────
    toggleRow: {
      flexDirection: 'row',
      marginHorizontal: SPACING.xl,
      borderRadius: BORDER_RADIUS.md,
      padding: 4,
      marginBottom: SPACING.lg,
    },
    toggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.sm,
    },
    toggleText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
    },
    // ─── Total Discount Card ───────────────────────────────────
    totalDiscountCard: {
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
      padding: SPACING.xl,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 120,
    },
    loadingText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      marginTop: SPACING.md,
    },
    // ─── Stats ──────────────────────────────────────────────
    statsRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: SPACING.lg,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
    },
    statIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    statValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.xxl,
    },
    statLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      marginTop: 2,
    },
    // ─── Seed Button ────────────────────────────────────────
    seedBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderStyle: 'dashed',
    },
    seedBtnText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
    },
    // ─── List ───────────────────────────────────────────────
    listTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.md,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    // ─── Empty ──────────────────────────────────────────────
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: SPACING.xl,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      marginBottom: SPACING.lg,
    },
    emptyTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.lg,
      marginBottom: SPACING.sm,
    },
    emptySubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
