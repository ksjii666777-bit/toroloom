import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { getPatternDescription, type DetectedPattern } from '../chart/patternDetection';

interface PatternSummaryProps {
  patterns: DetectedPattern[];
}

export default function PatternSummary({ patterns }: PatternSummaryProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  if (patterns.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Detected Patterns</Text>
      {patterns.map((p, i) => {
        const pColor = p.direction === 'bullish' ? colors.marketUp
          : p.direction === 'bearish' ? colors.marketDown : colors.warning;
        const directionEmoji = p.direction === 'bullish' ? '📈'
          : p.direction === 'bearish' ? '📉' : '➡️';
        const desc = getPatternDescription(p.type);

        return (
          <View key={i} style={[styles.patternItem, { borderColor: colors.divider }]}>
            <View style={[styles.dot, { backgroundColor: pColor }]} />
            <View style={{ flex: 1 }}>
              <View style={styles.patternHeader}>
                <Text style={[styles.patternName, { color: colors.text }]}>{p.label}</Text>
                <Text style={{ color: pColor }}>{directionEmoji}</Text>
                <View style={[styles.confBadge, { backgroundColor: pColor + '20' }]}>
                  <Text style={[styles.confText, { color: pColor }]}>{p.confidence}%</Text>
                </View>
              </View>
              <Text style={[styles.desc, { color: colors.textMuted }]}>{desc}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      borderRadius: BORDER_RADIUS.xl,
      borderWidth: 1,
      padding: SPACING.xl,
      marginTop: SPACING.md,
      marginBottom: SPACING.lg,
    },
    title: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
      marginBottom: SPACING.md,
    },
    patternItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: 1,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 6,
    },
    patternHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    patternName: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
    },
    confBadge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 1,
      borderRadius: BORDER_RADIUS.full,
    },
    confText: {
      ...FONTS.bold,
      fontSize: 10,
    },
    desc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      marginTop: 2,
      lineHeight: 16,
    },
  });
