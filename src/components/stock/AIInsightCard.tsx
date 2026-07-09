import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';

export interface AIInsightTarget {
  probability: number;
  target: number;
}

export interface AIInsightData {
  type: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
  analysis: string;
  targets: AIInsightTarget[];
}

interface AIInsightCardProps {
  insight: AIInsightData;
  onViewFullAnalysis?: () => void;
}

export default function AIInsightCard({ insight, onViewFullAnalysis }: AIInsightCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const sentimentColor = insight.type === 'bullish' ? '#00C853'
    : insight.type === 'bearish' ? '#FF1744' : '#FFC107';
  const sentimentBg = insight.type === 'bullish' ? '#00C85320'
    : insight.type === 'bearish' ? '#FF174420' : '#FFC10720';
  const sentimentIcon = insight.type === 'bullish' ? 'trending-up'
    : insight.type === 'bearish' ? 'trending-down' : 'remove';
  const sentimentLabel = insight.type === 'bullish' ? 'Bullish'
    : insight.type === 'bearish' ? 'Bearish' : 'Neutral';

  return (
    <View style={[styles.card, { borderLeftColor: sentimentColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrap, { backgroundColor: sentimentBg }]}>
            <Ionicons name="bulb" size={18} color={sentimentColor} />
          </View>
          <View>
            <Text style={styles.title}>AI Analysis</Text>
            <Text style={styles.subtitle}>Powered by Deep Learning</Text>
          </View>
        </View>
        <View style={[styles.sentimentBadge, { backgroundColor: sentimentBg }]}>
          <Ionicons name={sentimentIcon} size={14} color={sentimentColor} />
          <Text style={[styles.sentimentText, { color: sentimentColor }]}>{sentimentLabel}</Text>
        </View>
      </View>

      {/* Confidence bar */}
      <View style={styles.confidenceRow}>
        <View style={styles.confidenceLabelRow}>
          <Text style={styles.confidenceLabel}>Confidence</Text>
          <Text style={[styles.confidenceValue, { color: sentimentColor }]}>{insight.confidence}%</Text>
        </View>
        <View style={[styles.confidenceBar, { backgroundColor: colors.bgInput }]}>
          <View style={[styles.confidenceFill, {
            width: `${insight.confidence}%`,
            backgroundColor: sentimentColor,
          }]} />
        </View>
      </View>

      {/* Summary */}
      <Text style={styles.summary}>{insight.summary}</Text>
      <Text style={styles.analysis} numberOfLines={3}>
        {insight.analysis}
      </Text>

      {/* Target Levels */}
      {insight.targets.length > 0 && (
        <View style={styles.targetsSection}>
          <Text style={styles.targetsLabel}>Target Levels</Text>
          <View style={styles.targetsRow}>
            {insight.targets.map((t, i) => (
              <View key={i} style={[styles.targetItem, { backgroundColor: colors.bgCardLight }]}>
                <Text style={styles.targetProb}>{t.probability}%</Text>
                <Text style={styles.targetValue}>{formatCurrency(t.target)}</Text>
                <View style={[styles.probBar, { backgroundColor: colors.bgInput }]}>
                  <View style={[styles.probFill, {
                    width: `${t.probability}%`,
                    backgroundColor: sentimentColor,
                    opacity: 0.6 + (i / insight.targets.length) * 0.4,
                  }]} />
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* CTA */}
      {onViewFullAnalysis && (
        <TouchableOpacity style={[styles.cta, { borderColor: colors.border }]} onPress={onViewFullAnalysis}>
          <Text style={[styles.ctaText, { color: colors.primary }]}>View Full Analysis</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      padding: SPACING.xl,
      borderRadius: BORDER_RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      marginBottom: SPACING.lg,
      backgroundColor: colors.bgCard,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
      color: colors.text,
    },
    subtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textSecondary,
      marginTop: 1,
    },
    sentimentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
    },
    sentimentText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.xs,
    },
    confidenceRow: {
      marginBottom: SPACING.md,
    },
    confidenceLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    confidenceLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    confidenceValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.sm,
    },
    confidenceBar: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
    },
    confidenceFill: {
      height: '100%',
      borderRadius: 3,
    },
    summary: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    analysis: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: SPACING.md,
    },
    targetsSection: {
      marginBottom: SPACING.md,
    },
    targetsLabel: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginBottom: SPACING.sm,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    targetsRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    targetItem: {
      flex: 1,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      alignItems: 'center',
    },
    targetProb: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      marginBottom: 2,
    },
    targetValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.sm,
      color: colors.text,
      marginBottom: 6,
    },
    probBar: {
      width: '100%',
      height: 3,
      borderRadius: 2,
      overflow: 'hidden',
    },
    probFill: {
      height: '100%',
      borderRadius: 2,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
    },
    ctaText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
    },
  });
