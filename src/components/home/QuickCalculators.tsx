/**
 * Horizontal list of financial calculators.
 * Extracted from HomeScreen.tsx for better modularity.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';

interface CalculatorItem {
  icon: string;
  label: string;
  desc: string;
  color: string;
  screen: string;
}

interface QuickCalculatorsProps {
  calculators: CalculatorItem[];
  navigation: NativeStackNavigationProp<RootStackParamList> | any;
  colors: any;
}

export function QuickCalculators({ calculators, navigation, colors }: QuickCalculatorsProps) {
  return (
    <View style={styles.container}>
      {calculators.map((calc) => (
        <TouchableOpacity
          key={calc.screen}
          style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => (navigation.navigate as (screenName: string) => void)(calc.screen)}
          activeOpacity={0.7}
        >
          <View style={[styles.icon, { backgroundColor: `${calc.color}20` }]}>
            <Ionicons name={calc.icon as keyof typeof Ionicons.glyphMap} size={24} color={calc.color} />
          </View>
          <Text style={[styles.label, { color: colors.text }]}>{calc.label}</Text>
          <Text style={[styles.desc, { color: colors.textMuted }]} numberOfLines={1}>{calc.desc}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: SPACING.md },
  card: { flex: 1, alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, gap: 6 },
  icon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  label: { ...FONTS.semiBold, fontSize: FONTS.size.xs, textAlign: 'center' },
  desc: { ...FONTS.regular, fontSize: 10, textAlign: 'center' },
});
