/**
 * ============================================================================
 * Toroloom — SnapTrade Order Screen
 * ============================================================================
 *
 * US stock order placement via SnapTrade:
 *   - Buy/Sell toggle
 *   - Order types: Market, Limit, Stop Limit, Stop Loss
 *   - Quantity input with quick presets
 *   - Time in force: Day / GTC
 *   - Order cost summary
 *   - Confirmation step before placing
 *   - Biometric trade confirmation support
 *
 * Navigation: SnapTradeConnect/Portfolio → SnapTradeOrder
 * ============================================================================
 */

import React, { useState, useCallback, _useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, Dimensions, Platform, Keyboard,
} from 'react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { snapTradeApi, api } from '../../services/api';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { useT } from '../../hooks/useT';
import { useBiometricStore } from '../../store/biometricStore';
import { biometricAuth } from '../../services/biometricService';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

const { _width } = Dimensions.get('window');

type TradeAction = 'BUY' | 'SELL';
type OrderType = 'Market' | 'Limit' | 'StopLimit' | 'StopLoss';
type TimeInForce = 'Day' | 'Gtc';

const ORDER_TYPES: OrderType[] = ['Market', 'Limit', 'StopLoss', 'StopLimit'];
const QUICK_QTYS = [1, 10, 50, 100, 500];

// ──── Main Screen ─────────────────────────────────────────────
export default function SnapTradeOrderScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();

  // Route params — pre-fill from stock detail/portfolio tap
  const prefillSymbol = route.params?.symbol as string | undefined;
  const _prefillName = route.params?.name as string | undefined;
  const prefillPrice = route.params?.price as number | undefined;

  const [action, setAction] = useState<TradeAction>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('Market');
  const [timeInForce, setTimeInForce] = useState<TimeInForce>('Day');
  const [symbol, setSymbol] = useState(prefillSymbol || '');
  const [quantityStr, setQuantityStr] = useState('');
  const [limitPriceStr, setLimitPriceStr] = useState(prefillPrice ? String(prefillPrice) : '');
  const [stopPriceStr, setStopPriceStr] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [orderResult, setOrderResult] = useState<{ orderId: string; status: string } | null>(null);

  const qty = parseInt(quantityStr) || 0;
  const limitPrice = parseFloat(limitPriceStr) || 0;
  const stopPrice = parseFloat(stopPriceStr) || 0;
  const displayPrice = orderType === 'Market' ? (prefillPrice || 0) : limitPrice;
  const estimatedTotal = displayPrice * qty;

  const canPlaceOrder = symbol.trim().length > 0 && qty > 0
    && (orderType === 'Market' || limitPrice > 0)
    && (orderType !== 'StopLoss' && orderType !== 'StopLimit' || stopPrice > 0)
    && !isPlacing;

  // ── Pre-validate order with backend risk engine ────────────
  const preValidateOrder = useCallback(async (): Promise<string | null> => {
    try {
      const result = await api.post<{ allowed: boolean; message?: string }>(
        '/orders/validate',
        {
          actionType: action === 'BUY' ? 'BUY' : 'SELL',
          symbol: symbol.toUpperCase().trim(),
          quantity: qty,
          price: displayPrice,
        },
      );
      if (result && !result.allowed) {
        return result.message || t('trading.riskEngineBlocked');
      }
      return null; // All good
    } catch {
      // Backend unavailable — skip pre-validation (non-critical)
      return null;
    }
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, symbol, qty, displayPrice]);

  // ── Place Order (biometric check → risk validation → submit) ────
  const placeOrder = useCallback(async () => {
    if (!canPlaceOrder) return;
    setIsPlacing(true);

    try {
      // 1. Biometric confirmation check
      const { enabled: bioEnabled, requireForTrades } = useBiometricStore.getState();
      if (bioEnabled && requireForTrades) {
        const bioLabel = await biometricAuth.getBiometricLabel();
        const bioMessage = t('trading.bioConfirm', {
          action: action === 'BUY' ? t('trading.buy') : t('trading.sell'),
          label: bioLabel,
        });
        const result = await biometricAuth.authenticate(bioMessage, true);

        if (!result.success) {
          setIsPlacing(false);
          if (result.error !== 'Authentication cancelled') {
            Alert.alert(t('trading.orderCancelled'), result.error || t('trading.biometricFailed'));
          }
          return;
        }
      }

      // 2. Pre-validate with backend risk engine
      const validationError = await preValidateOrder();
      if (validationError) {
        setIsPlacing(false);
        Alert.alert(t('trading.orderBlocked'), validationError);
        return;
      }

      // 3. Place the order via SnapTrade
      const orderResult = await snapTradeApi.placeOrder({
        symbol: symbol.toUpperCase().trim(),
        action,
        orderType,
        quantity: qty,
        ...(limitPrice > 0 && orderType !== 'Market' && { price: limitPrice }),
        ...(stopPrice > 0 && { stopPrice }),
        timeInForce,
      });

      setOrderResult({ orderId: orderResult.orderId, status: orderResult.status });
      setShowConfirmation(true);
    } catch (err: any) {
      Alert.alert(
        t('trading.orderFailed'),
        err?.message || t('trading.orderFailedMsg'),
      );
    } finally {
      setIsPlacing(false);
    }
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPlaceOrder, symbol, action, orderType, qty, limitPrice, stopPrice, timeInForce, preValidateOrder, displayPrice]);

  // ── Reset ──────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setQuantityStr('');
    setLimitPriceStr('');
    setStopPriceStr('');
    setShowConfirmation(false);
    setOrderResult(null);
  }, []);

  // Action colors
  const actionColor = action === 'BUY' ? '#00E676' : '#FF5252';
  const gradientColors = action === 'BUY' ? GRADIENTS.primary : GRADIENTS.secondary;

  // ── Confirmation View ──
  if (showConfirmation && orderResult) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.confirmContainer, { paddingTop: 60 + insets.top }]}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.confirmContent}>
            <LinearGradient
              colors={GRADIENTS.success}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.confirmCircle}
            >
              <Ionicons name="checkmark" size={40} color="#fff" />
            </LinearGradient>
            <Text style={[styles.confirmTitle, { color: colors.text }]}>{t('trading.orderPlacedTitle')}</Text>
            <Text style={[styles.confirmOrderId, { color: colors.textMuted }]}>
              {t('trading.orderIdPrefix')}{orderResult.orderId.substring(0, 12)}...
            </Text>
            <Text style={[styles.confirmStatus, { color: '#00E676' }]}>
              {t('trading.statusPrefix')}{orderResult.status}
            </Text>

            <View style={[styles.confirmDetails, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>{t('trading.symbol')}</Text>
                <Text style={[styles.confirmValue, { color: colors.text }]}>{symbol.toUpperCase()}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>{t('trading.action')}</Text>
                <Text style={[styles.confirmValue, { color: actionColor }]}>{action}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>{t('trading.type')}</Text>
                <Text style={[styles.confirmValue, { color: colors.text }]}>{orderType}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>{t('trading.quantityLabel')}</Text>
                <Text style={[styles.confirmValue, { color: colors.text }]}>{qty}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>{t('trading.price')}</Text>
                <Text style={[styles.confirmValue, { color: colors.text }]}>
                  ${displayPrice.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.confirmActions}>
              <AnimatedPressable
                onPress={() => { resetForm(); navigation.goBack(); }}
                haptic="medium"
                scaleTo={0.95}
                style={[styles.confirmDoneBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.confirmDoneText}>{t('app.done')}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => { resetForm(); }}
                haptic="light"
                scaleTo={0.95}
                style={[styles.confirmAnotherBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.confirmAnotherText, { color: colors.primary }]}>
                  {t('trading.placeAnother')}
                </Text>
              </AnimatedPressable>
            </View>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <Pressable onPress={Keyboard.dismiss} style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: 60 + insets.top }]}
      >
        <View style={styles.headerRow}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.93}>
            <Ionicons name="close" size={24} color="#fff" />
          </AnimatedPressable>
          <Text style={styles.headerTitle}>{t('trading.usStockOrder')}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Buy/Sell Toggle */}
        <View style={styles.toggleContainer}>
          <Pressable
            style={[styles.toggleBtn, action === 'BUY' && { backgroundColor: 'rgba(0,230,118,0.25)' }]}
            onPress={() => setAction('BUY')}
          >
            <Ionicons name="arrow-down" size={16} color={action === 'BUY' ? '#00E676' : 'rgba(255,255,255,0.5)'} />
            <Text style={[styles.toggleText, action === 'BUY' && { color: '#fff', fontWeight: '700' }]}>{t('trading.buy')}</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, action === 'SELL' && { backgroundColor: 'rgba(255,82,82,0.25)' }]}
            onPress={() => setAction('SELL')}
          >
            <Ionicons name="arrow-up" size={16} color={action === 'SELL' ? '#FF5252' : 'rgba(255,255,255,0.5)'} />
            <Text style={[styles.toggleText, action === 'SELL' && { color: '#fff', fontWeight: '700' }]}>{t('trading.sell')}</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Symbol Input */}
        <Animated.View entering={FadeInUp.duration(300)} style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('trading.symbol')}</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <TextInput
              style={[styles.symbolInput, { color: colors.text }]}
              placeholder={t('trading.symbolPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={symbol}
              onChangeText={setSymbol}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
            />
            {symbol.length > 0 && (
              <Pressable onPress={() => setSymbol('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Order Type */}
        <Animated.View entering={FadeInUp.duration(350)} style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('trading.orderTypeLabel')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
            {ORDER_TYPES.map(ot => (
              <Pressable
                key={ot}
                style={[styles.chip, {
                  backgroundColor: orderType === ot ? colors.primary + '20' : colors.bgInput,
                  borderColor: orderType === ot ? colors.primary + '40' : colors.border,
                }]}
                onPress={() => setOrderType(ot)}
              >
                <Text style={[styles.chipText, { color: orderType === ot ? colors.primary : colors.textMuted }]}>
                  {ot === 'StopLoss' ? t('trading.stopLossLabel') : ot === 'StopLimit' ? t('trading.stopLimit') : ot === 'Market' ? t('trading.market') : t('trading.limit')}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Limit Price (for non-Market orders) */}
        {orderType !== 'Market' && (
          <Animated.View entering={FadeInUp.duration(400)} style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('trading.limitPrice')}</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <Text style={[styles.inputPrefix, { color: colors.textMuted }]}>$</Text>
              <TextInput
                style={[styles.priceInput, { color: colors.text }]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                value={limitPriceStr}
                onChangeText={setLimitPriceStr}
                keyboardType="decimal-pad"
              />
            </View>
          </Animated.View>
        )}

        {/* Stop Price (for Stop Loss / Stop Limit) */}
        {(orderType === 'StopLoss' || orderType === 'StopLimit') && (
          <Animated.View entering={FadeInUp.duration(450)} style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('trading.stopPrice')}</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <Text style={[styles.inputPrefix, { color: colors.textMuted }]}>$</Text>
              <TextInput
                style={[styles.priceInput, { color: colors.text }]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                value={stopPriceStr}
                onChangeText={setStopPriceStr}
                keyboardType="decimal-pad"
              />
            </View>
          </Animated.View>
        )}

        {/* Quantity */}
        <Animated.View entering={FadeInUp.duration(500)} style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('trading.quantityLabel')}</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <TextInput
              style={[styles.priceInput, { color: colors.text }]}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              value={quantityStr}
              onChangeText={setQuantityStr}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.quickQtyRow}>
            {QUICK_QTYS.map(q => (
              <Pressable
                key={q}
                style={[styles.quickQtyBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                onPress={() => setQuantityStr(String(q))}
              >
                <Text style={[styles.quickQtyText, { color: colors.textMuted }]}>{q}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.quickQtyBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
              onPress={() => setQuantityStr('Max')}
            >
              <Text style={[styles.quickQtyText, { color: colors.textMuted }]}>{t('trading.max')}</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Time in Force */}
        <Animated.View entering={FadeInUp.duration(550)} style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('trading.timeInForce')}</Text>
          <View style={styles.tifRow}>
            {(['Day', 'Gtc'] as TimeInForce[]).map(tif => (
              <Pressable
                key={tif}
                style={[styles.tifBtn, {
                  backgroundColor: timeInForce === tif ? colors.primary + '20' : colors.bgInput,
                  borderColor: timeInForce === tif ? colors.primary + '40' : colors.border,
                }]}
                onPress={() => setTimeInForce(tif)}
              >
                <Text style={[styles.tifText, {
                  color: timeInForce === tif ? colors.primary : colors.textMuted,
                }]}>{tif}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.tifHint, { color: colors.textMuted }]}>
            {timeInForce === 'Day' ? t('trading.dayHint') : t('trading.gtcHint')}
          </Text>
        </Animated.View>

        {/* Order Summary */}
        {symbol.trim() && qty > 0 && (
          <Animated.View entering={FadeInUp.duration(600)} style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>{t('trading.orderSummary')}</Text>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{t('trading.symbol')}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{symbol.toUpperCase()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{t('trading.action')}</Text>
              <Text style={[styles.summaryValue, { color: actionColor }]}>{action}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{t('trading.type')}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{orderType}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{t('trading.quantityLabel')}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{qty} {t('trading.sharesSuffix')}</Text>
            </View>
            {displayPrice > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                  {orderType === 'Market' ? t('trading.estPrice') : t('trading.price')}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>${displayPrice.toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted, ...FONTS.bold }]}>{t('trading.estimatedTotal')}</Text>
              <Text style={[styles.summaryValue, { color: colors.text, ...FONTS.bold }]}>
                ${estimatedTotal.toFixed(2)}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Place Order Button */}
        <Animated.View entering={FadeInUp.duration(700)}>
          <AnimatedPressable
            onPress={placeOrder}
            disabled={!canPlaceOrder}
            haptic="medium"
            scaleTo={0.97}
          >
            <LinearGradient
              colors={action === 'BUY' ? GRADIENTS.primary : GRADIENTS.secondary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.placeOrderBtn, !canPlaceOrder && { opacity: 0.5 }]}
            >
              {isPlacing ? (
                <Text style={styles.placeOrderText}>{t('trading.placingOrder')}</Text>
              ) : (
                <Text style={styles.placeOrderText}>
                  {action === 'BUY' ? t('trading.buy') : t('trading.sell')} {symbol.toUpperCase() || t('trading.symbol')}
                </Text>
              )}
            </LinearGradient>
          </AnimatedPressable>
        </Animated.View>

        {/* Info Note */}
        <View style={[styles.infoNote, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={14} color={colors.primary} />
          <Text style={[styles.infoNoteText, { color: colors.textMuted }]}>
            {t('trading.usOrderInfo')}
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { ...FONTS.bold, fontSize: FONTS.size.xl, color: '#fff' },

  // Buy/Sell Toggle
  toggleContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  toggleText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: 'rgba(255,255,255,0.5)',
  },

  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
  },

  // Fields
  fieldGroup: { marginBottom: SPACING.lg },
  fieldLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, marginBottom: SPACING.sm },

  // Inputs
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  inputPrefix: { ...FONTS.semiBold, fontSize: FONTS.size.lg },
  symbolInput: { flex: 1, ...FONTS.bold, fontSize: FONTS.size.xl, padding: 0, textTransform: 'uppercase' },
  priceInput: { flex: 1, ...FONTS.bold, fontSize: FONTS.size.xl, padding: 0 },

  // Chips
  chip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  chipText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

  // Quick Quantity
  quickQtyRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    flexWrap: 'wrap',
  },
  quickQtyBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  quickQtyText: { ...FONTS.medium, fontSize: FONTS.size.sm },

  // TIF
  tifRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  tifBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  tifText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  tifHint: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: SPACING.xs },

  // Summary
  summaryCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  summaryTitle: { ...FONTS.bold, fontSize: FONTS.size.md, marginBottom: SPACING.md },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  summaryLabel: { ...FONTS.regular, fontSize: FONTS.size.sm },
  summaryValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: SPACING.sm,
  },

  // Place Order
  placeOrderBtn: {
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  placeOrderText: { ...FONTS.bold, fontSize: FONTS.size.lg, color: '#fff' },

  // Info
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  infoNoteText: { ...FONTS.regular, fontSize: FONTS.size.xs, flex: 1, lineHeight: 16 },

  // ── Confirmation ──
  confirmContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  confirmContent: { alignItems: 'center' },
  confirmCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  confirmTitle: { ...FONTS.bold, fontSize: FONTS.size.xxl, marginBottom: 4 },
  confirmOrderId: { ...FONTS.regular, fontSize: FONTS.size.sm, marginBottom: 4 },
  confirmStatus: { ...FONTS.semiBold, fontSize: FONTS.size.md, marginBottom: SPACING.xl },
  confirmDetails: {
    width: '100%',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  confirmLabel: { ...FONTS.regular, fontSize: FONTS.size.sm },
  confirmValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  confirmActions: { width: '100%', gap: SPACING.md },
  confirmDoneBtn: {
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  confirmDoneText: { ...FONTS.bold, fontSize: FONTS.size.md, color: '#fff' },
  confirmAnotherBtn: {
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  confirmAnotherText: { ...FONTS.semiBold, fontSize: FONTS.size.md },
});
