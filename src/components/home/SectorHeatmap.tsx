/**
 * Sector performance heatmap — shows sector-wise average change.
 * Extracted from HomeScreen.tsx for better modularity.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

interface SectorData {
  sector: string;
  avgChange: number;
  count: number;
}

interface SectorHeatmapProps {
  sectors: SectorData[];
  colors: any;
}

export function SectorHeatmap({ sectors, colors }: SectorHeatmapProps) {
  const { t } = useT();

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {sectors.slice(0, 6).map((sector, i) => {
        const intensity = Math.min(Math.abs(sector.avgChange) / 5, 1);
        const isGreen = sector.avgChange >= 0;
        return (
          <View key={sector.sector} style={[styles.item, i < 3 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
            <View style={styles.left}>
              <Text style={[styles.sector, { color: colors.text }]}>{sector.sector}</Text>
              <Text style={[styles.count, { color: colors.textMuted }]}>{t('market.stocks', { count: sector.count })}</Text>
            </View>
            <View style={[styles.bar, {
              backgroundColor: isGreen
                ? `rgba(0, 230, 118, ${Math.max(0.1, intensity)})`
                : `rgba(255, 82, 82, ${Math.max(0.1, intensity)})`,
              width: `${Math.max(Math.abs(sector.avgChange) * 8, 8)}%`,
            }]}>
              <Text style={[styles.value, { color: isGreen ? '#00E676' : '#FF5252' }]}>
                {isGreen ? '+' : ''}{sector.avgChange.toFixed(1)}%
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  left: { flex: 1 },
  sector: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  count: { ...FONTS.regular, fontSize: FONTS.size.xs },
  bar: { borderRadius: BORDER_RADIUS.xs, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  value: { ...FONTS.bold, fontSize: FONTS.size.xs },
});
