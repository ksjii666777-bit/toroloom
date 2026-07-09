import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { IndicatorType } from '../TechnicalIndicators';
import type { ChartType } from '../CandlestickChart';

interface ChartControlsProps {
  showMA: boolean;
  activeIndicators: IndicatorType[];
  enableDrawing: boolean;
  showPatterns: boolean;
  chartType: ChartType;
  isFullscreen: boolean;
  onToggleMA: () => void;
  onToggleIndicator: (type: IndicatorType) => void;
  onToggleDrawing: () => void;
  onTogglePatterns: () => void;
  onChangeChartType: () => void;
  onToggleFullscreen: () => void;
}

const chartTypeEmojis: Record<ChartType, string> = {
  candlestick: '📊',
  line: '📈',
  area: '📉',
  heikin_ashi: '🕯️',
};

export default function ChartControls({
  showMA,
  activeIndicators,
  enableDrawing,
  showPatterns,
  chartType,
  isFullscreen,
  onToggleMA,
  onToggleIndicator,
  onToggleDrawing,
  onTogglePatterns,
  onChangeChartType,
  onToggleFullscreen,
}: ChartControlsProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const controls: { label: string; active: boolean; onPress: () => void }[] = [
    { label: 'MA', active: showMA, onPress: onToggleMA },
    { label: 'RSI', active: activeIndicators.includes('rsi'), onPress: () => onToggleIndicator('rsi') },
    { label: 'MACD', active: activeIndicators.includes('macd'), onPress: () => onToggleIndicator('macd') },
    { label: 'BB', active: activeIndicators.includes('bollinger'), onPress: () => onToggleIndicator('bollinger') },
    { label: '✏️', active: enableDrawing, onPress: onToggleDrawing },
    { label: '🔍', active: showPatterns, onPress: onTogglePatterns },
    { label: chartTypeEmojis[chartType], active: false, onPress: onChangeChartType },
    { label: isFullscreen ? '⛶' : '⛶', active: isFullscreen, onPress: onToggleFullscreen },
  ];

  return (
    <View style={styles.container}>
      {controls.map((c, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.btn, c.active && styles.btnActive]}
          onPress={c.onPress}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnText, c.active && styles.btnTextActive]}>
            {c.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    btn: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgCard,
    },
    btnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '15',
    },
    btnText: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
      color: colors.textSecondary,
    },
    btnTextActive: {
      color: colors.primary,
    },
  });
