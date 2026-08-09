import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useAIStore } from '../../store/aiStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { formatCurrency } from '../../utils/formatters';
import { useT } from '../../hooks/useT';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';


export default function AIInsightsScreen({ navigation: _navigation  }: NativeStackScreenProps<RootStackParamList, 'AIInsights'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useT();
  const { insights, isLoading, fetchInsights } = useAIStore();

  // Fetch insights on mount if store uses mock data
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'bullish': return colors.marketUp;
      case 'bearish': return colors.marketDown;
      default: return colors.warning;
    }
  };

  const getTypeEmoji = (type: string) => {
    switch (type) {
      case 'bullish': return '🟢';
      case 'bearish': return '🔴';
      default: return '🟡';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('ai.title')}</Text>
          <Text style={styles.subtitle}>{t('ai.insightsSubtitle')}</Text>
        </View>

        {/* Market Overview */}
        <Card gradient={GRADIENTS.primary} style={styles.overviewCard}>
          <View style={styles.overviewRow}>
            <Ionicons name="bulb" size={28} color="#FFFFFF" />
            <View style={styles.overviewText}>
              <Text style={styles.overviewTitle}>{t('ai.marketOverview')}</Text>
              <Text style={styles.overviewSub}>
                {insights.filter(i => i.type === 'bullish').length} {t('ai.bullish').toLowerCase()} · {insights.filter(i => i.type === 'bearish').length} {t('ai.bearish').toLowerCase()} · {insights.filter(i => i.type === 'neutral').length} {t('ai.neutral').toLowerCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.overviewNote}>{t('ai.insightDisclaimer')}</Text>
        </Card>

        {/* Insights List */}
        <Text style={styles.sectionTitle}>{t('ai.stockAnalysis')}</Text>

        {/* ── Loading State ── */}
        {isLoading && insights.length === 0 && (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.stateText, { color: colors.textMuted }]}>{t('ai.generating')}</Text>
          </View>
        )}

        {/* ── Empty State ── */}
        {!isLoading && insights.length === 0 && (
          <View style={styles.stateContainer}>
            <Ionicons name="bulb-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.stateTitle, { color: colors.text }]}>{t('ai.noInsights')}</Text>
            <Text style={[styles.stateText, { color: colors.textMuted }]}>{t('ai.pullToRefresh')}</Text>
          </View>
        )}

        {/* ── Data ── */}
        {insights.map(insight => (
          <Pressable key={insight.id} style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <View>
                <Text style={styles.insightSymbol}>{insight.symbol}</Text>
                <Text style={styles.insightName}>{insight.name}</Text>
              </View>
              <View style={[styles.signelBadge, { backgroundColor: getTypeColor(insight.type) + '20' }]}>
                <Text style={styles.signelEmoji}>{getTypeEmoji(insight.type)}</Text>
                <Text style={[styles.signelText, { color: getTypeColor(insight.type) }]}>
                  {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
                </Text>
              </View>
            </View>

            <Text style={styles.insightSummary}>{insight.summary}</Text>
            <Text style={styles.insightAnalysis} numberOfLines={3}>{insight.analysis}</Text>

            <View style={styles.confidenceRow}>
              <Badge label={t('ai.confidence', { value: insight.confidence })} variant={insight.confidence > 75 ? 'success' : 'warning'} />
              <Text style={styles.insightTime}>{new Date(insight.timestamp).toLocaleDateString()}</Text>
            </View>

            {insight.targets.length > 0 && (
              <View style={styles.targetsRow}>
                {insight.targets.map((target, i) => (
                  <View key={`insight_${i}`} style={styles.targetItem}>
                    <Text style={styles.targetLabel}>{t('ai.target', { num: i + 1 })}</Text>
                    <Text style={styles.targetValue}>{formatCurrency(target.target)}</Text>
                    <View style={styles.targetBar}>
                      <View style={[styles.targetFill, { width: `${target.probability}%` }]} />
                    </View>
                    <Text style={styles.targetProb}>{t('ai.probability', { value: target.probability })}</Text>
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContent: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.xl,
    },
    header: {
      paddingTop: 60,
      marginBottom: SPACING.xl,
    },
    title: {
      ...FONTS.bold,
      fontSize: FONTS.size.title,
      color: colors.text,
    },
    subtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.md,
      color: colors.textSecondary,
      marginTop: 4,
    },
    overviewCard: {
      marginBottom: SPACING.xl,
    },
    overviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    overviewText: {
      flex: 1,
    },
    overviewTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.lg,
      color: '#FFFFFF',
    },
    overviewSub: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: 'rgba(255,255,255,0.7)',
      marginTop: 2,
    },
    overviewNote: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: 'rgba(255,255,255,0.6)',
      lineHeight: 16,
    },
    sectionTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.lg,
      color: colors.text,
      marginBottom: SPACING.md,
    },
    insightCard: {
      backgroundColor: colors.bgCard,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    insightHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: SPACING.md,
    },
    insightSymbol: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      color: colors.text,
    },
    insightName: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textMuted,
    },
    signelBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
      gap: 4,
    },
    signelEmoji: {
      fontSize: 14,
    },
    signelText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
    },
    insightSummary: {
      ...FONTS.medium,
      fontSize: FONTS.size.md,
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    insightAnalysis: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: SPACING.md,
    },
    confidenceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    insightTime: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    targetsRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    targetItem: {
      flex: 1,
      backgroundColor: colors.bgInput,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      alignItems: 'center',
    },
    targetLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    targetValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      color: colors.text,
      marginTop: 2,
    },
    targetBar: {
      width: '100%',
      height: 3,
      backgroundColor: colors.border,
      borderRadius: 1.5,
      marginTop: SPACING.xs,
      overflow: 'hidden',
    },
    targetFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 1.5,
    },
    targetProb: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginTop: 2,
    },

    // States
    stateContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.huge,
      gap: SPACING.md,
    },
    stateTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.lg,
      marginTop: SPACING.sm,
    },
    stateText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      textAlign: 'center',
      paddingHorizontal: SPACING.xxxl,
      lineHeight: 20,
    },
  });
