/**
 * Toroloom — Strategy Performance Screen
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS } from '../../constants/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import AppScreen from '../../components/ui/AppScreen';


export default function StrategyPerformanceScreen({ navigation: _navigation  }: NativeStackScreenProps<RootStackParamList, 'StrategyPerformance'>) {
  const { colors } = useTheme();
  const { t } = useT();

  return (
          <AppScreen scroll={false} padded={false}
      header={
  <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
          <Text style={[styles.title, { color: colors.text }]}>{t('strategyPerformance.title')}</Text>
        </View>
      }
      >
  <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('strategyPerformance.noData')}</Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
              {t('strategyPerformance.noDataDesc')}
            </Text>
          </View>
        </ScrollView>
      </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { padding: SPACING.xl, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '800' },
  content: { padding: SPACING.xl },
  emptyState: { alignItems: 'center', paddingVertical: 80, gap: SPACING.md },
  emptyTitle: { fontSize: FONTS.size.lg, fontWeight: '700' },
  emptyDesc: { fontSize: FONTS.size.sm, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
});
