/**
 * Toroloom — Economic Calendar Screen
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS } from '../../constants/theme';

export default function EconomicCalendarScreen({ _navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t('economicCalendar.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('economicCalendar.noEvents')}</Text>
          <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
            {t('economicCalendar.noEventsDesc')}
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
  emptyDesc: { fontSize: FONTS.size.sm, textAlign: 'center', maxWidth: 280 },
});
