/**
 * Market breadth indicators — advancing, declining, unchanged stocks ratio.
 * Extracted from HomeScreen.tsx for better modularity.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

interface MarketBreadthProps {
  advancing: number;
  declining: number;
  unchanged: number;
  colors: any;
}

export function MarketBreadth({ advancing, declining, unchanged, colors }: MarketBreadthProps) {
  const { t } = useT();

  return (
    <View style={styles.row}>
      <View style={[styles.card, { borderColor: colors.border }]}>
        <Ionicons name="arrow-up-circle" size={18} color="#00C853" />
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('market.adv')}</Text>
        <Text style={[styles.value, { color: '#00C853' }]}>{advancing}</Text>
      </View>
      <View style={[styles.card, { borderColor: colors.border }]}>
        <Ionicons name="remove-circle" size={18} color={colors.textMuted} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('market.flat')}</Text>
        <Text style={[styles.value, { color: colors.textMuted }]}>{unchanged}</Text>
      </View>
      <View style={[styles.card, { borderColor: colors.border }]}>
        <Ionicons name="arrow-down-circle" size={18} color="#FF1744" />
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('market.dec')}</Text>
        <Text style={[styles.value, { color: '#FF1744' }]}>{declining}</Text>
      </View>
      <View style={[styles.card, { borderColor: colors.border }]}>
        <Ionicons name="stats-chart" size={18} color={advancing > declining ? '#00C853' : '#FF1744'} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('market.ratio')}</Text>
        <Text style={[styles.value, { color: advancing > declining ? '#00C853' : '#FF1744' }]}>
          {declining > 0 ? (advancing / declining).toFixed(1) : '∞'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md, gap: 4, borderWidth: 1, borderRadius: BORDER_RADIUS.md },
  label: { ...FONTS.regular, fontSize: FONTS.size.xs },
  value: { ...FONTS.bold, fontSize: FONTS.size.lg },
});
