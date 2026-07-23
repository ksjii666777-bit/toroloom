/**
 * Toroloom — Sector Allocation Widget
 * Shows sector-wise portfolio allocation with a mini donut chart.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path, Text as SvgText, Circle as SvgCircle } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { usePortfolioAnalyticsStore } from '../../store/portfolioAnalyticsStore';
import { formatCurrency } from '../../utils/formatters';
import { FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { WidgetSize } from '../../types/widgets';

const SECTOR_COLORS = [
  '#3B82F6', '#8B5CF6', '#00E676', '#FFC107', '#FF5252',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#A855F7',
];

interface SectorAllocationWidgetProps {
  size: WidgetSize;
}

export default function SectorAllocationWidget({ size }: SectorAllocationWidgetProps) {
  const { colors } = useTheme();
  const { sectorAllocation } = usePortfolioAnalyticsStore(s => s.getAnalytics());

  const donutSize = size === 'small' ? 100 : size === 'medium' ? 120 : 160;
  const cx = donutSize / 2;
  const cy = donutSize / 2;
  const outerR = donutSize * 0.38;
  const innerR = outerR * 0.55;

  const paths = useMemo(() => {
    if (sectorAllocation.length === 0) return [];
    const total = sectorAllocation.reduce((s, d) => s + d.percent, 0) || 100;
    let startAngle = -Math.PI / 2;
    return sectorAllocation.map((d) => {
      const pct = d.percent / total;
      const angle = pct * Math.PI * 2;
      const endAngle = startAngle + angle;
      const x1 = cx + outerR * Math.cos(startAngle);
      const y1 = cy + outerR * Math.sin(startAngle);
      const x2 = cx + outerR * Math.cos(endAngle);
      const y2 = cy + outerR * Math.sin(endAngle);
      const ix1 = cx + innerR * Math.cos(startAngle);
      const iy1 = cy + innerR * Math.sin(startAngle);
      const ix2 = cx + innerR * Math.cos(endAngle);
      const iy2 = cy + innerR * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      const path = [
        `M ${x1} ${y1}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${ix2} ${iy2}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
        'Z',
      ].join(' ');
      startAngle = endAngle;
      return path;
    });
  }, [sectorAllocation, cx, cy, outerR, innerR]);

  if (sectorAllocation.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No sector data</Text>
      </View>
    );
  }

  const displayCount = size === 'large' ? sectorAllocation.length : size === 'medium' ? 5 : 3;

  return (
    <View style={styles.container}>
      <View style={[styles.chartSection, size === 'small' ? styles.chartSectionSmall : null]}>
        {/* Donut */}
        <Svg width={donutSize} height={donutSize}>
          {paths.map((path, i) => (
            <Path key={i} d={path} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} opacity={0.85} />
          ))}
          <SvgCircle cx={cx} cy={cy} r={innerR} fill={colors.bgCard} />
          <SvgText
            x={cx} y={cy - 4}
            fill={colors.text}
            fontSize={size === 'small' ? 14 : 18}
            fontWeight="700"
            textAnchor="middle"
          >
            {sectorAllocation.length}
          </SvgText>
          <SvgText
            x={cx} y={cy + 12}
            fill={colors.textMuted}
            fontSize={size === 'small' ? 8 : 10}
            fontWeight="500"
            textAnchor="middle"
          >
            Sectors
          </SvgText>
        </Svg>

        {/* Legend */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={[styles.legendScroll, size === 'small' ? styles.legendScrollSmall : null]}
          contentContainerStyle={{ paddingBottom: 2 }}
        >
          {sectorAllocation.slice(0, displayCount).map((d, i) => (
            <View key={d.sector} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }]} />
              <View style={styles.legendTextCol}>
                <Text style={[styles.legendSector, { color: colors.text }]} numberOfLines={1}>{d.sector}</Text>
                <Text style={[styles.legendPercent, { color: colors.textMuted }]}>{d.percent.toFixed(1)}%</Text>
              </View>
            </View>
          ))}
          {sectorAllocation.length > displayCount && (
            <Text style={[styles.legendMore, { color: colors.textMuted }]}>+{sectorAllocation.length - displayCount} more</Text>
          )}
        </ScrollView>
      </View>

      {size === 'large' && (
        <View style={[styles.detailRow, { borderTopColor: colors.divider }]}>
          <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Total invested across</Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            {sectorAllocation.length} sectors
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
  emptyText: { fontFamily: 'System', fontSize: 13, fontWeight: '500' },
  chartSection: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chartSectionSmall: { flexDirection: 'column', alignItems: 'center', gap: 8 },
  legendScroll: { flex: 1, maxHeight: 120 },
  legendScrollSmall: { maxHeight: 80 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTextCol: { flex: 1 },
  legendSector: { fontFamily: 'System', fontSize: 11, fontWeight: '600' },
  legendPercent: { fontFamily: 'System', fontSize: 9, fontWeight: '500' },
  legendMore: { fontFamily: 'System', fontSize: 9, fontWeight: '500', marginTop: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, marginTop: 4 },
  detailLabel: { fontFamily: 'System', fontSize: 10, fontWeight: '500' },
  detailValue: { fontFamily: 'System', fontSize: 12, fontWeight: '700' },
});
