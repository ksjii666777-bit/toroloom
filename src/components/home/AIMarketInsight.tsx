/**
 * AI market insight card — shows top AI insight with confidence.
 * Extracted from HomeScreen.tsx for better modularity.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import Card from '../ui/Card';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';

interface Insight {
  symbol: string;
  type: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  summary: string;
}

interface AIMarketInsightProps {
  insight: Insight;
  navigation: NativeStackNavigationProp<RootStackParamList> | any;
  colors: any;
}

export function AIMarketInsight({ insight, navigation, colors }: AIMarketInsightProps) {
  const { t } = useT();

  return (
    <Card animated animationDelay={500}>
      <View style={styles.header}>
        <View style={styles.left}>
          <View style={[styles.badge, { backgroundColor: colors.primaryLight + '20' }]}>
            <Ionicons name="bulb" size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('home.aiMarketInsight')}</Text>
            <Text style={[styles.symbol, { color: colors.text }]}>{insight.symbol}</Text>
          </View>
        </View>
        <View style={[styles.confidenceChip, {
          backgroundColor: insight.type === 'bullish' ? '#00C85320' : insight.type === 'bearish' ? '#FF174420' : colors.bgCardLight,
        }]}>
          <Ionicons
            name={insight.type === 'bullish' ? 'trending-up' : insight.type === 'bearish' ? 'trending-down' : 'remove'}
            size={14}
            color={insight.type === 'bullish' ? '#00C853' : insight.type === 'bearish' ? '#FF1744' : colors.textMuted}
          />
          <Text style={[styles.confidence, {
            color: insight.type === 'bullish' ? '#00C853' : insight.type === 'bearish' ? '#FF1744' : colors.textMuted,
          }]}>{insight.confidence}%</Text>
        </View>
      </View>
      <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={2}>
        {insight.summary}
      </Text>
      <TouchableOpacity onPress={() => navigation.navigate('AIInsights')} style={styles.cta}>
        <Text style={[styles.ctaText, { color: colors.primary }]}>{t('home.viewFullAnalysis')}</Text>
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  left: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  badge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  label: { ...FONTS.regular, fontSize: FONTS.size.xs },
  symbol: { ...FONTS.bold, fontSize: FONTS.size.md },
  confidenceChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  confidence: { ...FONTS.bold, fontSize: FONTS.size.xs },
  summary: { ...FONTS.regular, fontSize: FONTS.size.sm, marginBottom: SPACING.md },
  cta: { alignSelf: 'flex-start' },
  ctaText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
});
