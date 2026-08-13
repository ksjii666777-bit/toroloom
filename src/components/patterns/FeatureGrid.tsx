// src/components/patterns/FeatureGrid.tsx
import React, { useMemo } from 'react';
import { View, Pressable, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants/theme';

export type FeatureItem = {
  key: string;
  label: string;          // MUST be a full, human label — never truncated by hand
  icon: React.ReactNode;
  onPress: () => void;
  badge?: string | number;
  tone?: 'neutral' | 'accent' | 'positive' | 'negative' | 'warning';
  disabled?: boolean;
  /** forwarded to the tile's Pressable — needed for E2E testIDs */
  testID?: string;
};

export type FeatureGridProps = {
  items: FeatureItem[];
  columns?: 2 | 3 | 4;
};

export function FeatureGrid({ items, columns }: FeatureGridProps) {
  const { width, fontScale } = useWindowDimensions();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Responsive: never force 5 columns on a 360dp phone.
  const cols = useMemo(() => {
    if (columns) return columns;
    if (fontScale > 1.15) return 3;      // large font → fewer columns
    if (width >= 600) return 4;          // tablet / unfolded
    return 3;                            // all phones (360 / 390 / 412)
  }, [columns, width, fontScale]);

  const gap = SPACING.md;

  // Resolve tone → background once (theme colors are stable per render).
  const tones = useMemo(() => toneBg(colors), [colors]);

  return (
    <View style={[styles.grid, { gap }]}>
      {items.map(item => (
        <Tile key={item.key} item={item} cols={cols} styles={styles} tones={tones} />
      ))}
    </View>
  );
}

type TileProps = {
  item: FeatureItem;
  cols: number;
  styles: any;
  tones: Record<NonNullable<FeatureItem['tone']>, string>;
};

function Tile({ item, cols, styles, tones }: TileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ disabled: !!item.disabled }}
      onPress={item.onPress}
      disabled={item.disabled}
      testID={item.testID}
      android_ripple={{ color: 'rgba(255,255,255,0.06)', borderless: false }}
      style={({ pressed }) => [
        styles.tile,
        { flexBasis: `${100 / cols}%`, maxWidth: `${100 / cols}%` },
        pressed && { opacity: 0.7 },
        item.disabled && { opacity: 0.4 },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: tones[item.tone ?? 'neutral'] }]}>
        {item.icon}
        {item.badge != null ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        ) : null}
      </View>

      {/* THE FIX: 2 lines max, ellipsis at the END only, fixed label height
          so every row aligns even when one label wraps to two lines. */}
      <Text
        numberOfLines={2}
        ellipsizeMode="tail"
        style={styles.label}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

const toneBg = (colors: any): Record<NonNullable<FeatureItem['tone']>, string> => ({
  neutral:  colors.surfaceElevated,
  accent:   colors.primaryDim,
  positive: colors.successDim,
  negative: colors.dangerDim,
  warning:  colors.warningDim,
});

const createStyles = (colors: any) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    tile: {
      alignItems: 'center',
      // subtract the gap so 3 tiles + 2 gaps fit exactly
      paddingHorizontal: SPACING.xs,
      minHeight: 96,
    },
    iconBox: {
      width: 52, height: 52, borderRadius: BORDER_RADIUS.lg,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.borderSubtle,
    },
    label: {
      marginTop: SPACING.sm,
      textAlign: 'center',
      height: 36,           // exactly 2 lines @ 18 lineHeight → rows stay aligned
      includeFontPadding: false,  // keep the 2-line box exact on Android
      ...FONTS.caption,
      color: colors.textSecondary,
    },
    badge: {
      position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18,
      paddingHorizontal: 5, borderRadius: 9, backgroundColor: colors.danger,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: colors.bg,
    },
    badgeText: {
      ...FONTS.micro,
      color: '#FFFFFF',
    },
  });
