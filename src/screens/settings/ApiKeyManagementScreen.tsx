/**
 * ============================================================================
 * Toroloom — API Key Management Screen
 * ============================================================================
 *
 * Manage personal API access tokens with granular scope permissions
 * and configurable expiry dates.
 *
 * Features:
 *   - Summary header (total keys, active, unused, scopes)
 *   - Existing key list with masked keys, scopes badges, expiry indicators
 *   - Create new key flow (name, scope selection, expiry picker)
 *   - Full key reveal on creation with copy-friendly display
 *   - Revoke confirmation with Alert
 *   - Last used timestamp for each key
 *   - Info section about API usage & security
 *
 * Navigation: More → API Keys
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Dimensions, Alert, Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { ApiKey, ApiKeyScope, ApiKeyScopeMeta } from '../../types';
import { API_KEY_SCOPES } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ═════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═════════════════════════════════════════════════════════════════════════

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400000).toISOString();
}

const MOCK_API_KEYS: ApiKey[] = [
  {
    id: 'key_1',
    name: 'Trading Bot',
    maskedKey: 'tol_8a3F...x7K2',
    createdAt: daysAgo(45),
    expiresAt: daysAgo(-320),
    isActive: true,
    lastUsedAt: daysAgo(0.5),
    scopes: ['portfolio:read', 'market:read', 'trades:read'],
    ipRestrict: '203.123.45.*',
  },
  {
    id: 'key_2',
    name: 'Portfolio Sync',
    maskedKey: 'tol_2b9D...mR5p',
    createdAt: daysAgo(120),
    expiresAt: daysAgo(-245),
    isActive: true,
    lastUsedAt: daysAgo(2),
    scopes: ['portfolio:read', 'portfolio:write', 'watchlist:read', 'account:read'],
  },
  {
    id: 'key_3',
    name: 'Old Analytics Script',
    maskedKey: 'tol_7c1E...qW8z',
    createdAt: daysAgo(365),
    expiresAt: null,
    isActive: false,
    lastUsedAt: daysAgo(200),
    scopes: ['market:read', 'ai:read'],
  },
  {
    id: 'key_4',
    name: 'Auto Trader v2',
    maskedKey: 'tol_4d5F...vG9y',
    createdAt: daysAgo(10),
    expiresAt: daysAgo(-355),
    isActive: true,
    lastUsedAt: daysAgo(1),
    scopes: ['trades:read', 'trades:write', 'orders:read', 'orders:write', 'market:read'],
    ipRestrict: '103.45.78.*',
  },
];

const EXPIRY_OPTIONS = [
  { labelKey: 'apiKeyManagement.expiry30', value: 30 },
  { labelKey: 'apiKeyManagement.expiry90', value: 90 },
  { labelKey: 'apiKeyManagement.expiry1y', value: 365 },
  { labelKey: 'apiKeyManagement.expiryNever', value: -1 },
] as const;

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function generateMockKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = 'tol_';
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function maskKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

// ═════════════════════════════════════════════════════════════════════════
// SCOPE CHIP
// ═════════════════════════════════════════════════════════════════════════

function ScopeChip({ scope, onToggle, selected, colors }: {
  scope: ApiKeyScopeMeta;
  onToggle?: () => void;
  selected?: boolean;
  colors: any;
}) {
  const isSelected = selected ?? true;

  return (
    <Pressable
      onPress={onToggle}
      disabled={!onToggle}
      style={[
        scopeChipStyles.chip,
        {
          backgroundColor: isSelected ? scope.color + '20' : 'rgba(255,255,255,0.04)',
          borderColor: isSelected ? scope.color + '40' : 'rgba(255,255,255,0.1)',
          opacity: onToggle ? 1 : 0.8,
        },
      ]}
    >
      <Ionicons name={scope.icon as any} size={13} color={isSelected ? scope.color : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[scopeChipStyles.label, { color: isSelected ? scope.color : colors.textMuted }]}>
          {scope.label}
        </Text>
        <Text style={[scopeChipStyles.desc, { color: isSelected ? scope.color + 'CC' : colors.textMuted + '99' }]} numberOfLines={1}>
          {scope.description}
        </Text>
      </View>
      {onToggle && (
        <Ionicons
          name={isSelected ? 'checkmark-circle' : 'add-circle-outline'}
          size={18}
          color={isSelected ? scope.color : colors.textMuted}
        />
      )}
    </Pressable>
  );
}

const scopeChipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  label: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  desc: { ...FONTS.regular, fontSize: 8, marginTop: 1 },
});

// ═════════════════════════════════════════════════════════════════════════
// API KEY CARD
// ═════════════════════════════════════════════════════════════════════════

function ApiKeyCard({
  apiKey,
  onRevoke,
  onToggleActive,
  colors,
}: {
  apiKey: ApiKey;
  onRevoke: (key: ApiKey) => void;
  onToggleActive: (key: ApiKey) => void;
  colors: any;
}) {
  const { t } = useT();
  const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
  const expiryLabel = apiKey.expiresAt
    ? (isExpired ? t('apiKeyManagement.expiredLabel', { time: formatRelativeTime(apiKey.expiresAt) }) : t('apiKeyManagement.expiresLabel', { date: formatDate(apiKey.expiresAt) }))
    : t('apiKeyManagement.noExpiry');

  return (
    <View style={[
      keyCardStyles.card,
      {
        backgroundColor: apiKey.isActive ? colors.bgCard : 'rgba(255,255,255,0.03)',
        borderColor: apiKey.isActive ? colors.border : 'rgba(255,255,255,0.06)',
        opacity: apiKey.isActive ? 1 : 0.6,
      },
    ]}>
      {/* Header */}
      <View style={keyCardStyles.header}>
        <View style={keyCardStyles.nameRow}>
          <View style={[keyCardStyles.iconBox, {
            backgroundColor: apiKey.isActive ? colors.primary + '20' : 'rgba(255,255,255,0.05)',
          }]}>
            <Ionicons name="key" size={18} color={apiKey.isActive ? colors.primary : colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={keyCardStyles.nameLine}>
              <Text style={[keyCardStyles.keyName, { color: colors.text }]}>{apiKey.name}</Text>
              {isExpired && (
                <View style={[keyCardStyles.expiredBadge, { backgroundColor: '#FF525220' }]}>
                  <Text style={keyCardStyles.expiredBadgeText}>{t('apiKeyManagement.expired')}</Text>
                </View>
              )}
              {!apiKey.isActive && !isExpired && (
                <View style={[keyCardStyles.revokedBadge, { backgroundColor: '#FFAB4020' }]}>
                  <Text style={keyCardStyles.revokedBadgeText}>{t('apiKeyManagement.revoked')}</Text>
                </View>
              )}
            </View>
            <Text style={[keyCardStyles.maskedKey, { color: colors.textMuted }]}>
              {apiKey.maskedKey}
            </Text>
          </View>
        </View>
        {apiKey.isActive && (
          <Pressable onPress={() => onToggleActive(apiKey)}>
            <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
          </Pressable>
        )}
      </View>

      {/* Scopes */}
      <View style={keyCardStyles.scopesRow}>
        {apiKey.scopes.map(scope => {
          const meta = API_KEY_SCOPES[scope];
          return (
            <View key={scope} style={[keyCardStyles.scopeBadge, { backgroundColor: meta.color + '20' }]}>
              <Text style={[keyCardStyles.scopeBadgeText, { color: meta.color }]}>
                {meta.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Metadata */}
      <View style={keyCardStyles.metaRow}>
        <View style={keyCardStyles.metaItem}>
          <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
          <Text style={[keyCardStyles.metaText, { color: isExpired ? colors.danger : colors.textMuted }]}>
            {expiryLabel}
          </Text>
        </View>
        <View style={keyCardStyles.metaItem}>
          <Ionicons name="time-outline" size={11} color={colors.textMuted} />
          <Text style={[keyCardStyles.metaText, { color: colors.textMuted }]}>
            {t('apiKeyManagement.lastUsed', { time: formatRelativeTime(apiKey.lastUsedAt) })}
          </Text>
        </View>
      </View>

      {apiKey.ipRestrict && (
        <View style={[keyCardStyles.restrictBadge, { backgroundColor: '#3B82F615' }]}>
          <Ionicons name="shield-outline" size={11} color="#3B82F6" />
          <Text style={keyCardStyles.restrictText}>{t('apiKeyManagement.ipRestricted', { ip: apiKey.ipRestrict })}</Text>
        </View>
      )}

      {/* Revoke button */}
      <Pressable
        onPress={() => onRevoke(apiKey)}
        style={({ pressed }) => [keyCardStyles.revokeBtn, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name="trash-outline" size={14} color={colors.danger} />
        <Text style={keyCardStyles.revokeBtnText}>{apiKey.isActive ? t('apiKeyManagement.revoke') : t('apiKeyManagement.delete')}</Text>
      </Pressable>
    </View>
  );
}

const keyCardStyles = StyleSheet.create({
  card: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  keyName: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  maskedKey: { ...FONTS.mono, fontSize: FONTS.size.xs, marginTop: 2 },
  expiredBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  expiredBadgeText: { ...FONTS.extraBold, fontSize: 8, color: '#FF5252', textTransform: 'uppercase', letterSpacing: 0.3 },
  revokedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  revokedBadgeText: { ...FONTS.extraBold, fontSize: 8, color: '#FFAB40', textTransform: 'uppercase', letterSpacing: 0.3 },
  scopesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  scopeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full },
  scopeBadgeText: { ...FONTS.medium, fontSize: 9, fontWeight: '600' },
  metaRow: { gap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...FONTS.regular, fontSize: FONTS.size.xs },
  restrictBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full },
  restrictText: { ...FONTS.mono, fontSize: 9, color: '#3B82F6' },
  revokeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: '#FF525230', marginTop: SPACING.xs },
  revokeBtnText: { ...FONTS.medium, fontSize: FONTS.size.xs, color: '#FF5252' },
});

// ═════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════

export default function ApiKeyManagementScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const [keys, setKeys] = useState<ApiKey[]>(MOCK_API_KEYS);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>(['portfolio:read', 'market:read']);
  const [selectedExpiry, setSelectedExpiry] = useState<number>(90);    const [createdKey, setCreatedKey] = useState<string | null>(null);

  // ── Derived data ──
  const stats = useMemo(() => {
    const active = keys.filter(k => k.isActive);
    const inactive = keys.filter(k => !k.isActive);
    const unused = keys.filter(k => k.isActive && k.lastUsedAt && (Date.now() - new Date(k.lastUsedAt).getTime()) > 90 * 86400000);
    const allScopes = new Set(keys.flatMap(k => k.scopes));
    return {
      total: keys.length,
      active: active.length,
      inactive: inactive.length,
      unused: unused.length,
      usedScopes: allScopes.size,
    };
  }, [keys]);

  // ── Handlers ──
  const handleRevoke = useCallback((key: ApiKey) => {
    const labelKey = key.isActive ? 'apiKeyManagement.revoke' : 'apiKeyManagement.delete';
    const label = t(labelKey);
    const action = label.toLowerCase();
    Alert.alert(
      `${label} ${t('apiKeyManagement.title')}`,
      t('apiKeyManagement.revokeConfirmMsg', { action, name: key.name, maskedKey: key.maskedKey }),
      [
        { text: t('app.cancel'), style: 'cancel' },
        {
          text: label,
          style: 'destructive',
          onPress: () => {
            setKeys(prev => prev.map(k => k.id === key.id ? { ...k, isActive: false } : k));
            Alert.alert(t('apiKeyManagement.doneLabel'), t('apiKeyManagement.doneMsg', { name: key.name, action }));
          },
        },
      ],
    );
  }, [t]);

  const handleToggleActive = useCallback((key: ApiKey) => {
    Alert.alert(
      t('apiKeyManagement.revokeTitle'),
      t('apiKeyManagement.revokeMsg', { name: key.name }),
      [
        { text: t('app.cancel'), style: 'cancel' },
        {
          text: t('apiKeyManagement.revoke'), style: 'destructive',
          onPress: () => {
            setKeys(prev => prev.map(k => k.id === key.id ? { ...k, isActive: false } : k));
          },
        },
      ],
    );
  }, [t]);

  const toggleScope = useCallback((scope: ApiKeyScope) => {
    setSelectedScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope],
    );
  }, []);

  const handleCreateKey = useCallback(() => {
    if (!newKeyName.trim()) {
      Alert.alert(t('apiKeyManagement.nameRequiredTitle'), t('apiKeyManagement.nameRequiredMsg'));
      return;
    }
    if (selectedScopes.length === 0) {
      Alert.alert(t('apiKeyManagement.scopesRequiredTitle'), t('apiKeyManagement.scopesRequiredMsg'));
      return;
    }

    const fullKey = generateMockKey();
    const newKey: ApiKey = {
      id: `key_${Date.now()}`,
      name: newKeyName.trim(),
      maskedKey: maskKey(fullKey),
      fullKey,
      createdAt: new Date().toISOString(),
      expiresAt: selectedExpiry === -1 ? null : daysAgo(-selectedExpiry),
      isActive: true,
      lastUsedAt: null,
      scopes: selectedScopes,
    };

    setKeys(prev => [newKey, ...prev]);
    setCreatedKey(fullKey);
    setShowCreateForm(false);
    setNewKeyName('');
    setSelectedScopes(['portfolio:read', 'market:read']);
    setSelectedExpiry(90);
  }, [newKeyName, selectedScopes, selectedExpiry, t]);

  const dismissCreatedKey = useCallback(() => {
    setCreatedKey(null);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>{t('apiKeyManagement.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('apiKeyManagement.subtitle')}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Created Key Reveal ── */}
        {createdKey && (
          <Animated.View entering={FadeInDown} exiting={FadeOutUp} style={[styles.keyReveal, { borderColor: colors.primary + '40' }]}>
            <View style={styles.keyRevealHeader}>
              <Ionicons name="key" size={20} color={colors.primary} />
              <Text style={[styles.keyRevealTitle, { color: colors.text }]}>{t('apiKeyManagement.keyCreated')}</Text>
              <Pressable onPress={dismissCreatedKey}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.keyRevealDesc, { color: colors.textSecondary }]}>
              {t('apiKeyManagement.keyCreatedDesc')}
            </Text>
            <View style={[styles.keyDisplay, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <Text style={[styles.keyDisplayText, { color: colors.text }]} selectable>
                {createdKey}
              </Text>
            </View>
            <Text style={[styles.keyRevealNote, { color: colors.textMuted }]}>
              {t('apiKeyManagement.keyCreatedNote')}
            </Text>
          </Animated.View>
        )}

        {/* ── Summary Stats ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: '#3B82F630' }]}>
            <Ionicons name="key" size={18} color="#3B82F6" />
            <Text style={[styles.statValue, { color: '#3B82F6' }]}>{stats.total}</Text>
            <Text style={styles.statLabel}>{t('apiKeyManagement.statTotal')}</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#00C85330' }]}>
            <Ionicons name="checkmark-circle" size={18} color="#00C853" />
            <Text style={[styles.statValue, { color: '#00C853' }]}>{stats.active}</Text>
            <Text style={styles.statLabel}>{t('apiKeyManagement.statActive')}</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#FFAB4030' }]}>
            <Ionicons name="moon" size={18} color="#FFAB40" />
            <Text style={[styles.statValue, { color: '#FFAB40' }]}>{stats.unused}</Text>
            <Text style={styles.statLabel}>{t('apiKeyManagement.statUnused')}</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#8B5CF630' }]}>
            <Ionicons name="layers" size={18} color="#8B5CF6" />
            <Text style={[styles.statValue, { color: '#8B5CF6' }]}>{stats.usedScopes}</Text>
            <Text style={styles.statLabel}>{t('apiKeyManagement.statScopes')}</Text>
          </View>
        </View>

        {/* ── Create New Key ── */}
        {!showCreateForm ? (
          <AnimatedPressable onPress={() => setShowCreateForm(true)} haptic="medium" scaleTo={0.97}>
            <View style={[styles.createBtn, { borderColor: colors.primary + '40' }]}>
              <Ionicons name="add-circle" size={20} color={colors.primary} />
              <Text style={[styles.createBtnText, { color: colors.primary }]}>{t('apiKeyManagement.createNewKey')}</Text>
            </View>
          </AnimatedPressable>
        ) : (
          <Animated.View entering={FadeInDown} layout={LinearTransition} style={[styles.createForm, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {/* Form Header */}
            <View style={styles.formHeader}>
              <Text style={[styles.formTitle, { color: colors.text }]}>{t('apiKeyManagement.newKeyTitle')}</Text>
              <Pressable onPress={() => setShowCreateForm(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Name */}
            <Text style={[styles.formLabel, { color: colors.textMuted }]}>{t('apiKeyManagement.keyName')}</Text>
            <TextInput
              style={[styles.textInput, { color: colors.text, backgroundColor: colors.bgInput, borderColor: colors.border }]}
              placeholder={t('apiKeyManagement.keyNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={newKeyName}
              onChangeText={setNewKeyName}
              autoFocus
            />

            {/* Scopes */}
            <Text style={[styles.formLabel, { color: colors.textMuted, marginTop: SPACING.md }]}>
              {t('apiKeyManagement.permissions', { count: selectedScopes.length })}
            </Text>
            <View style={styles.scopesGrid}>
              {(Object.values(API_KEY_SCOPES) as ApiKeyScopeMeta[]).map(meta => (
                <ScopeChip
                  key={meta.scope}
                  scope={meta}
                  selected={selectedScopes.includes(meta.scope)}
                  onToggle={() => toggleScope(meta.scope)}
                  colors={colors}
                />
              ))}
            </View>

            {/* Expiry */}
            <Text style={[styles.formLabel, { color: colors.textMuted, marginTop: SPACING.md }]}>{t('apiKeyManagement.expiry')}</Text>
            <View style={styles.expiryRow}>
              {EXPIRY_OPTIONS.map(opt => {
                const isActive = selectedExpiry === opt.value;
                return (
                  <Pressable
                    key={opt.labelKey}
                    onPress={() => setSelectedExpiry(opt.value)}
                    style={[
                      styles.expiryChip,
                      {
                        backgroundColor: isActive ? colors.primary + '20' : 'rgba(255,255,255,0.05)',
                        borderColor: isActive ? colors.primary + '40' : 'rgba(255,255,255,0.1)',
                      },
                    ]}
                  >
                    <Text style={[styles.expiryChipText, { color: isActive ? colors.primary : colors.textMuted }]}>
                      {t(opt.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Create Button */}
            <AnimatedPressable onPress={handleCreateKey} haptic="medium" scaleTo={0.97}>
              <View style={[styles.submitBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="key" size={18} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>{t('apiKeyManagement.generateKey')}</Text>
              </View>
            </AnimatedPressable>
          </Animated.View>
        )}

        {/* ── Existing Keys ── */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
          {t('apiKeyManagement.yourApiKeys')}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          {t('apiKeyManagement.activeCount', { active: keys.filter(k => k.isActive).length, revoked: keys.filter(k => !k.isActive).length })}
        </Text>

        {keys.map((key) => (
          <ApiKeyCard
            key={key.id}
            apiKey={key}
            onRevoke={handleRevoke}
            onToggleActive={handleToggleActive}
            colors={colors}
          />
        ))}

        {/* ── Info Card ── */}
        <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>{t('apiKeyManagement.aboutTitle')}</Text>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              {t('apiKeyManagement.aboutDesc')}
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: SPACING.xl,
    paddingTop: 60,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backBtn: { padding: 4 },
  title: { ...FONTS.bold, fontSize: FONTS.size.title, color: '#FFFFFF' },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4 },

  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },

  // Key Reveal
  keyReveal: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(59,130,246,0.08)',
    gap: SPACING.sm,
  },
  keyRevealHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  keyRevealTitle: { ...FONTS.bold, fontSize: FONTS.size.md, flex: 1 },
  keyRevealDesc: { ...FONTS.regular, fontSize: FONTS.size.xs },
  keyDisplay: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  keyDisplayText: {
    ...FONTS.mono,
    fontSize: FONTS.size.xs,
    lineHeight: 20,
    letterSpacing: 0.5,
  },
  keyRevealNote: { ...FONTS.regular, fontSize: 9, fontStyle: 'italic', textAlign: 'center' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { ...FONTS.bold, fontSize: FONTS.size.lg, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  statLabel: { ...FONTS.regular, fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Create Button
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginBottom: SPACING.md,
  },
  createBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.md },

  // Create Form
  createForm: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  formTitle: { ...FONTS.bold, fontSize: FONTS.size.lg },
  formLabel: { ...FONTS.medium, fontSize: FONTS.size.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: 4,
  },
  scopesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: 4,
  },
  expiryRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: 4 },
  expiryChip: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  expiryChipText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  submitBtnText: { ...FONTS.bold, fontSize: FONTS.size.sm, color: '#FFFFFF' },

  // Section
  sectionTitle: { ...FONTS.bold, fontSize: FONTS.size.md },
  sectionSubtitle: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2, marginBottom: SPACING.md },

  // Info
  infoCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  infoTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: 4 },
  infoText: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 18 },
});
