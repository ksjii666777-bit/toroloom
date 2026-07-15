/**
 * Toroloom — Strategy Performance Screen
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

export default function StrategyPerformanceScreen({ navigation }: any) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <Text style={[styles.title, { color: colors.text }]}>Strategy Performance</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Data Yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            Strategy performance metrics will appear here after backtesting
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '800' },
  content: { padding: SPACING.xl },
  emptyState: { alignItems: 'center', paddingVertical: 80, gap: SPACING.md },
  emptyTitle: { fontSize: FONTS.size.lg, fontWeight: '700' },
  emptyDesc: { fontSize: FONTS.size.sm, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
});
