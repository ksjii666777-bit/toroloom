import React from 'react';
import { View, Text, StyleSheet, Pressable, } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency, hexToRgba } from '../../utils/formatters';

interface BottomActionBarProps {
  displayPrice: number;
  onBuy: () => void;
  onSell: () => void;
  isUSStock?: boolean;
}

export default function BottomActionBar({ displayPrice, onBuy, onSell, isUSStock = false }: BottomActionBarProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  const formattedPrice = isUSStock
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(displayPrice)
    : formatCurrency(displayPrice);

  return (
    <LinearGradient colors={[hexToRgba(colors.bg, 0), colors.bg]} style={styles.container}>
      <View style={styles.row}>
        <View style={styles.priceInfo}>
          <Text style={styles.ltpLabel}>{t('components.stockAnalysis.ltp')}</Text>
          <Text style={styles.ltpValue}>{formattedPrice}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            style={[styles.tradeBtn, styles.sellBtn, { backgroundColor: colors.bgCard, borderColor: colors.marketDown }]}
            onPress={onSell}
            testID="stock-sell-btn"
          >
            <Text style={[styles.tradeBtnText, { color: colors.white }]}>{t('components.stockAnalysis.sell')}</Text>
          </Pressable>
          <Pressable
            style={[styles.tradeBtn, { padding: 0, overflow: 'hidden' }]}
            onPress={onBuy}
            testID="stock-buy-btn"
          >
            <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buyGrad}>
              <Text style={[styles.tradeBtnText, { color: colors.white }]}>{t('components.stockAnalysis.buy')}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingTop: SPACING.lg,
      paddingBottom: 40,
      paddingHorizontal: SPACING.xl,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    priceInfo: {
      alignItems: 'center',
    },
    ltpLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
    },
    ltpValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.xl,
      color: colors.text,
    },
    actions: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    tradeBtn: {
      paddingHorizontal: SPACING.xxl,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.full,
    },
    sellBtn: {
      borderWidth: 1,
    },
    buyGrad: {
      paddingHorizontal: SPACING.xxl,
      paddingVertical: SPACING.md,
    },
    tradeBtnText: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
    },
  });
