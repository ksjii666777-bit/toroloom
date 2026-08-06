import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import Badge from '../ui/Badge';

export interface SectorContextData {
  sectorName: string;
  avgChange: number;
  stockCount: number;
  bestStockSymbol: string;
  worstStockSymbol: string;
  rank: number;
  totalSectors: number;
  bestSectorName: string;
  bestSectorChange: number;
  worstSectorName: string;
  worstSectorChange: number;
}

interface SectorContextProps {
  data: SectorContextData;
}

export default function SectorContext({ data }: SectorContextProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  const isGreen = data.avgChange >= 0;
  const intensity = Math.min(Math.abs(data.avgChange) / 5, 1);

  return (
    <View style={{ marginBottom: SPACING.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md }}>
        <Text style={styles.sectionTitle} testID="stock-sector-context">{t('components.stockAnalysis.sectorContext')}</Text>
        <Badge
          label={`#${data.rank} of ${data.totalSectors}`}
          variant={data.rank <= 3 ? 'success' : data.rank >= data.totalSectors - 2 ? 'danger' : 'info'}
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="business" size={18} color={isGreen ? colors.marketUp : colors.marketDown} />
            <Text style={[styles.sectorName, { color: colors.text }]}>{t('components.stockAnalysis.sectorSuffix', { name: data.sectorName })}</Text>
          </View>
          <View style={[styles.changeBadge, {
            backgroundColor: isGreen
              ? `rgba(0, 230, 118, ${Math.max(0.1, intensity)})`
              : `rgba(255, 82, 82, ${Math.max(0.1, intensity)})`,
          }]}>
            <Ionicons name={isGreen ? 'trending-up' : 'trending-down'} size={14} color={isGreen ? colors.marketUp : colors.marketDown} />
            <Text style={[styles.changeText, { color: isGreen ? colors.marketUp : colors.marketDown }]}>
              {isGreen ? '+' : ''}{data.avgChange.toFixed(2)}%
            </Text>
          </View>
        </View>

        {/* Performance bar */}
        <View style={[styles.barBg, { backgroundColor: colors.bgInput }]}>
          <View style={[styles.barFill, {
            width: `${Math.min(Math.abs(data.avgChange) * 15, 100)}%`,
            backgroundColor: isGreen ? colors.marketUp : colors.marketDown,
          }]} />
        </View>

        {/* Stats row */}
        <View style={[styles.statsRow, { borderTopColor: colors.divider }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{data.stockCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('components.stockAnalysis.stocks')}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.marketUp }]}>{data.bestStockSymbol}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('components.stockAnalysis.best')}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.marketDown }]}>{data.worstStockSymbol}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('components.stockAnalysis.worst')}</Text>
          </View>
        </View>

        {/* Sector ranking */}
        <View style={[styles.rankRow, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
          <Ionicons name="podium" size={14} color={colors.textMuted} />
          <Text style={[styles.rankText, { color: colors.textMuted }]}>
            {t('components.stockAnalysis.rankText', { name: data.sectorName, rank: data.rank, total: data.totalSectors })}
            {t('components.stockAnalysis.rankRange', { best: data.bestSectorChange.toFixed(1), worst: data.worstSectorChange.toFixed(1) })}
          </Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    sectionTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      color: colors.text,
    },
    card: {
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: SPACING.md,
      gap: 3,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectorName: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
    },
    changeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderRadius: BORDER_RADIUS.full,
    },
    changeText: {
      ...FONTS.bold,
      fontSize: FONTS.size.sm,
    },
    barBg: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: SPACING.md,
    },
    barFill: {
      height: '100%',
      borderRadius: 3,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.sm,
    },
    statLabel: {
      ...FONTS.regular,
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 2,
    },
    divider: {
      width: 1,
      height: 24,
    },
    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1,
      marginTop: SPACING.sm,
    },
    rankText: {
      ...FONTS.regular,
      fontSize: 10,
      color: colors.textMuted,
      flex: 1,
      lineHeight: 16,
    },
  });
