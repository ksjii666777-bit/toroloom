import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useAIStore } from '../../store/aiStore';
import { COLORS, SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { formatCurrency } from '../../utils/formatters';

export default function AIInsightsScreen({ _navigation }: any) {
  const { insights } = useAIStore();

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'bullish': return COLORS.marketUp;
      case 'bearish': return COLORS.marketDown;
      default: return COLORS.warning;
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
          <Text style={styles.title}>AI Insights</Text>
          <Text style={styles.subtitle}>Powered by advanced market analysis</Text>
        </View>

        {/* Market Overview */}
        <Card gradient={GRADIENTS.primary} style={styles.overviewCard}>
          <View style={styles.overviewRow}>
            <Ionicons name="bulb" size={28} color={COLORS.white} />
            <View style={styles.overviewText}>
              <Text style={styles.overviewTitle}>AI Market Overview</Text>
              <Text style={styles.overviewSub}>
                {insights.filter(i => i.type === 'bullish').length} bullish · {insights.filter(i => i.type === 'bearish').length} bearish · {insights.filter(i => i.type === 'neutral').length} neutral
              </Text>
            </View>
          </View>
          <Text style={styles.overviewNote}>
            Our AI analyzes technical indicators, fundamental data, and market sentiment to generate insights.
            Always do your own research before trading.
          </Text>
        </Card>

        {/* Insights List */}
        <Text style={styles.sectionTitle}>Stock Analysis</Text>
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
              <Badge label={`${insight.confidence}% Confidence`} variant={insight.confidence > 75 ? 'success' : 'warning'} />
              <Text style={styles.insightTime}>{new Date(insight.timestamp).toLocaleDateString()}</Text>
            </View>

            {insight.targets.length > 0 && (
              <View style={styles.targetsRow}>
                {insight.targets.map((t, i) => (
                  <View key={`insight_${i}`} style={styles.targetItem}>
                    <Text style={styles.targetLabel}>Target {i + 1}</Text>
                    <Text style={styles.targetValue}>{formatCurrency(t.target)}</Text>
                    <View style={styles.targetBar}>
                      <View style={[styles.targetFill, { width: `${t.probability}%` }]} />
                    </View>
                    <Text style={styles.targetProb}>{t.probability}% probability</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  header: {
    paddingTop: 60,
    marginBottom: SPACING.xl,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: COLORS.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: COLORS.textSecondary,
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
    color: COLORS.white,
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
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  insightCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.text,
  },
  insightName: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: COLORS.textMuted,
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
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  insightAnalysis: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: COLORS.textSecondary,
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
    color: COLORS.textMuted,
  },
  targetsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  targetItem: {
    flex: 1,
    backgroundColor: COLORS.bgInput,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  targetLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: COLORS.textMuted,
  },
  targetValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: COLORS.text,
    marginTop: 2,
  },
  targetBar: {
    width: '100%',
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 1.5,
    marginTop: SPACING.xs,
    overflow: 'hidden',
  },
  targetFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 1.5,
  },
  targetProb: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
