/**
 * Interactive mini pie chart for onboarding.
 * Users tap sectors to explore portfolio allocation.
 */
import React, { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { BounceIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../../hooks/useT';
import * as Haptics from 'expo-haptics';
import { MOCK_SECTORS } from '../mockData';

interface MiniPieChartProps {
  onInteract: () => void;
  onDemoComplete?: () => void;
}

export function MiniPieChart({ onInteract, onDemoComplete }: MiniPieChartProps) {
  const { t } = useT();
  const [selectedSector, setSelectedSector] = useState<number | null>(null);
  const [exploredSectors, setExploredSectors] = useState<Set<number>>(new Set());
  const total = MOCK_SECTORS.reduce((sum, s) => sum + s.value, 0);
  const demoCompletedRef = useRef(false);

  // Build segments using simple stacked bar (simulating pie segments)
  let currentAngle = 0;
  const segments = MOCK_SECTORS.map((sector) => {
    const angle = (sector.value / total) * 360;
    const seg = { ...sector, startAngle: currentAngle, endAngle: currentAngle + angle };
    currentAngle += angle;
    return seg;
  });

  const handleSectorTap = (index: number) => {
    onInteract();
    const next = new Set(exploredSectors).add(index);
    setExploredSectors(next);
    if (next.size >= MOCK_SECTORS.length && !demoCompletedRef.current) {
      demoCompletedRef.current = true;
      setTimeout(() => onDemoComplete?.(), 300);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSector(selectedSector === index ? null : index);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('onboarding.portfolioAllocation')}</Text>
      <View style={styles.row}>
        <View style={styles.bar}>
          {segments.map((seg, i) => {
            const isSelected = selectedSector === i;
            const widthPct = (seg.value / total) * 100;
            return (
              <Pressable
                key={seg.name}
                onPress={() => handleSectorTap(i)}
                style={[
                  styles.segment,
                  {
                    backgroundColor: seg.color,
                    width: `${widthPct}%`,
                    opacity: selectedSector === null || isSelected ? 1 : 0.4,
                    transform: isSelected ? [{ scaleY: 1.15 }] : [],
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {MOCK_SECTORS.map((sector, i) => {
          const isSelected = selectedSector === i;
          return (
            <Pressable
              key={sector.name}
              style={[styles.legendItem, isSelected && styles.legendItemActive]}
              onPress={() => handleSectorTap(i)}
            >
              <View style={[styles.legendDot, { backgroundColor: sector.color }]} />
              <Text style={[styles.legendLabel, isSelected && styles.legendLabelActive]}>
                {sector.name}
              </Text>
              <Text style={[styles.legendValue, isSelected && styles.legendValueActive]}>
                {sector.value}%
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Selected sector detail */}
      {selectedSector !== null && (
        <Animated.View entering={BounceIn.duration(300)} style={styles.detail}>
          <Ionicons name={MOCK_SECTORS[selectedSector].icon as keyof typeof Ionicons.glyphMap} size={18} color={MOCK_SECTORS[selectedSector].color} />
          <Text style={styles.detailText}>
            {MOCK_SECTORS[selectedSector].name}: ₹{(Math.random() * 5 + 1).toFixed(1)}L invested
          </Text>
        </Animated.View>
      )}

      {selectedSector === null && (
        <Text style={styles.hint}>👆 Tap a sector to explore</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  title: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter-SemiBold', marginBottom: 8, textAlign: 'center' },
  row: { alignItems: 'center' },
  bar: { flexDirection: 'row', height: 32, borderRadius: 16, overflow: 'hidden', width: '100%', backgroundColor: 'rgba(0,0,0,0.2)' },
  segment: { height: '100%', borderRadius: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  legendItemActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  legendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  legendLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'Inter-Medium' },
  legendLabelActive: { color: '#FFFFFF' },
  legendValue: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginLeft: 2 },
  legendValueActive: { color: '#FFFFFF' },
  detail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 6 },
  detailText: { color: '#FFFFFF', fontSize: 12, fontFamily: 'Inter-Medium' },
  hint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 8 },
});
