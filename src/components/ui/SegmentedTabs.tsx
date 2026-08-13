/**
 * ============================================================================
 * Toroloom — SegmentedTabs
 * ============================================================================
 *
 * Generic segmented control used for screen-level tab switching
 * (e.g. Behavioural Journal: Dashboard / Entries / Reports).
 * Active segment = primary fill; inactive = muted on surface.
 * Zero extra margins — the parent owns vertical spacing, so there is never
 * an unwanted gap between the control and the content below it.
 *
 * Usage:
 *   <SegmentedTabs
 *     tabs={[{ key: 'Dashboard', label: t('journal.tabDashboard') }, ...]}
 *     active={activeTab}
 *     onChange={setActiveTab}
 *   />
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

export type SegmentedTabItem<T extends string> = {
  key: T;
  label: string;
};

type SegmentedTabsProps<T extends string> = {
  tabs: SegmentedTabItem<T>[];
  active: T;
  onChange: (key: T) => void;
};

export function SegmentedTabs<T extends string>({ tabs, active, onChange }: SegmentedTabsProps<T>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      {tabs.map(tab => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.segment,
              isActive && { backgroundColor: colors.primary },
              pressed && !isActive && styles.segmentPressed,
            ]}
          >
            <Text style={[styles.label, isActive ? styles.labelActive : { color: colors.textSecondary }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      gap: SPACING.xs,
      padding: 4,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
    },
    segment: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
      minHeight: 40,
    },
    segmentPressed: {
      opacity: 0.7,
    },
    label: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
    },
    labelActive: {
      color: colors.white,
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
    },
  });
