/**
 * ============================================================================
 * Toroloom — AI Settings Screen
 * ============================================================================
 *
 * Allows users to view active AI provider, configure model preferences,
 * and test the AI connection. Provider selection is admin-set via env vars,
 * but users can see which provider is active and its status.
 *
 * ============================================================================
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { aiApi, type AIProviderInfo, type AIStatusResponse } from '../../services/api/ai';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';

// ──── Provider Meta ─────────────────────────────────────────────────────

const PROVIDER_META: Record<string, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
  docsUrl: string;
}> = {
  openrouter: {
    icon: 'git-network',
    color: '#FF6B6B',
    description: 'Unified API — Gemini, GPT, Claude & more',
    docsUrl: 'https://openrouter.ai/keys',
  },
  google: {
    icon: 'logo-google',
    color: '#4285F4',
    description: 'Google Gemini models (free tier available)',
    docsUrl: 'https://aistudio.google.com',
  },
  choreo: {
    icon: 'cloud',
    color: '#8B5CF6',
    description: 'Anthropic Claude via Choreo API Gateway',
    docsUrl: 'https://console.choreo.dev',
  },
};

// ──── Component ─────────────────────────────────────────────────────────

export default function AISettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [status, setStatus] = useState<AIStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiApi.getStatus();
      setStatus(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load AI provider status');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const result = await aiApi.analyze('RELIANCE') as any;
      Alert.alert(
        '✅ AI Connection Works!',
        `Provider: ${(result as any)._provider || status?.activeProvider || 'Unknown'}\n\n` +
        `Type: ${result.type.toUpperCase()}\n` +
        `Confidence: ${result.confidence}%\n` +
        `Summary: ${result.summary}`,
      );
    } catch (err: any) {
      Alert.alert(
        '❌ Connection Test Failed',
        err.message || 'Could not reach the AI provider. Check your API key configuration.',
      );
    } finally {
      setTesting(false);
    }
  };

  // ──── Loading State ────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Loading AI provider status...
        </Text>
      </View>
    );
  }

  const configuredCount = status?.availableProviders.filter(p => p.configured).length || 0;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={[styles.headerIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="bulb" size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>AI Settings</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {status?.configured
                  ? `Connected via ${status.activeProvider}`
                  : 'No AI provider configured'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={loadStatus} style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="refresh" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Error banner */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' }]}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            <TouchableOpacity onPress={loadStatus}>
              <Text style={[styles.retryLink, { color: colors.primary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: status?.configured ? '#00E676' : colors.danger + '20', borderColor: status?.configured ? '#00E67640' : colors.danger + '30' }]}>
          <View style={[styles.summaryIcon, { backgroundColor: status?.configured ? '#00E67620' : colors.danger + '20' }]}>
            <Ionicons
              name={status?.configured ? 'checkmark-circle' : 'close-circle'}
              size={32}
              color={status?.configured ? '#00E676' : colors.danger}
            />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>
              {status?.configured ? 'AI Provider Active' : 'No AI Provider Configured'}
            </Text>
            <Text style={[styles.summaryDesc, { color: colors.textSecondary }]}>
              {status?.configured
                ? `${configuredCount} provider(s) configured · Active: ${status.activeProvider}`
                : 'Add an API key in the backend env vars to enable AI features'}
            </Text>
          </View>
        </View>

        {/* Provider Cards */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Available Providers</Text>

        {status?.availableProviders.map((provider) => {
          const meta = PROVIDER_META[provider.id] || {
            icon: 'cloud' as keyof typeof Ionicons.glyphMap,
            color: colors.textMuted,
            description: 'AI provider',
            docsUrl: '',
          };

          return (
            <View
              key={provider.id}
              style={[
                styles.providerCard,
                { backgroundColor: colors.bgCard, borderColor: provider.active ? meta.color + '50' : colors.border },
                provider.active && { borderWidth: 1.5 },
              ]}
            >
              {/* Provider Header */}
              <View style={styles.providerHeader}>
                <View style={[styles.providerIcon, { backgroundColor: meta.color + '20' }]}>
                  <Ionicons name={meta.icon} size={22} color={meta.color} />
                </View>
                <View style={styles.providerInfo}>
                  <View style={styles.providerNameRow}>
                    <Text style={[styles.providerName, { color: colors.text }]}>{provider.name}</Text>
                    {provider.active && (
                      <View style={[styles.activeBadge, { backgroundColor: '#00E67620' }]}>
                        <Text style={styles.activeBadgeText}>Active</Text>
                      </View>
                    )}
                    <View style={[styles.statusDot, {
                      backgroundColor: provider.configured ? '#00E676' : colors.textMuted,
                    }]} />
                  </View>
                  <Text style={[styles.providerDesc, { color: colors.textSecondary }]}>
                    {meta.description}
                  </Text>
                </View>
              </View>

              {/* Provider Details */}
              <View style={[styles.providerDetails, { borderTopColor: colors.divider }]}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Status</Text>
                  <View style={styles.detailValue}>
                    <View style={[styles.statusDotSm, {
                      backgroundColor: provider.configured ? '#00E676' : colors.textMuted,
                    }]} />
                    <Text style={[styles.detailText, {
                      color: provider.configured ? '#00E676' : colors.textMuted,
                    }]}>
                      {provider.configured ? 'Configured' : 'Not configured'}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Model</Text>
                  <Text style={[styles.detailText, { color: colors.text }]} numberOfLines={1}>
                    {provider.model || 'Default'}
                  </Text>
                </View>
                {provider.endpoint && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Endpoint</Text>
                    <Text style={[styles.detailText, { color: colors.text, fontSize: FONTS.size.xs }]} numberOfLines={2}>
                      {provider.endpoint}
                    </Text>
                  </View>
                )}
              </View>

              {/* Setup Link */}
              {!provider.configured && meta.docsUrl && (
                <AnimatedPressable
                  onPress={() => Linking.openURL(meta.docsUrl)}
                  scaleTo={0.97}
                  style={[styles.setupBtn, { borderColor: meta.color + '30' }]}
                >
                  <Ionicons name="key" size={16} color={meta.color} />
                  <Text style={[styles.setupBtnText, { color: meta.color }]}>
                    Get API Key
                  </Text>
                  <Ionicons name="open-outline" size={14} color={meta.color} />
                </AnimatedPressable>
              )}
            </View>
          );
        })}

        {/* Test Connection */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
          Test Connection
        </Text>
        <Card
          title="Test AI Provider"
          subtitle="Verify your AI provider is working correctly"
          style={{ marginBottom: SPACING.md }}
        >
          <AnimatedPressable
            onPress={handleTestConnection}
            disabled={testing || !status?.configured}
            scaleTo={0.96}
            style={[
              styles.testBtn,
              { backgroundColor: colors.primary, opacity: testing || !status?.configured ? 0.5 : 1 },
            ]}
          >
            {testing ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="flash" size={20} color={colors.white} />
            )}
            <Text style={styles.testBtnText}>
              {testing ? 'Testing...' : 'Test AI Connection'}
            </Text>
          </AnimatedPressable>
          {!status?.configured && (
            <Text style={[styles.testHint, { color: colors.textMuted }]}>
              Configure an AI provider first by setting API keys in the backend environment variables.
            </Text>
          )}
        </Card>

        {/* Info Card */}
        <Card title="About AI Providers" subtitle="How AI insights are generated">
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Toroloom supports multiple AI providers. The active provider is determined by the backend
            configuration. AI insights are generated using a sophisticated multi-factor model that
            analyzes technical indicators, fundamental data, and market sentiment.
          </Text>
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={16} color="#00E676" />
              <Text style={[styles.infoItemText, { color: colors.textSecondary }]}>
                All insights are cached for fast retrieval
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={16} color="#00E676" />
              <Text style={[styles.infoItemText, { color: colors.textSecondary }]}>
                Provider switching requires backend env var change
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={16} color="#00E676" />
              <Text style={[styles.infoItemText, { color: colors.textSecondary }]}>
                AI features require a Pro subscription
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 2,
  },
  loadingText: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },

  // ── Error Banner ──
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  errorText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    flex: 1,
  },
  retryLink: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },

  // ── Summary Card ──
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  summaryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
  },
  summaryDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 4,
    lineHeight: 18,
  },

  // ── Section Title ──
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },

  // ── Provider Card ──
  providerCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerInfo: {
    flex: 1,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  providerName: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
  },
  activeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  activeBadgeText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: '#00E676',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  providerDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 2,
  },

  // ── Provider Details ──
  providerDetails: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    gap: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
  detailValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    maxWidth: 200,
  },
  statusDotSm: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // ── Setup Button ──
  setupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  setupBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },

  // ── Test Button ──
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  testBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.white,
  },
  testHint: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: 16,
  },

  // ── Info ──
  infoText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
  },
  infoList: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  infoItemText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    flex: 1,
  },
});
