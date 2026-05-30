import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useMarketStore } from '../../store/marketStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useAuthStore } from '../../store/authStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency, hexToRgba } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { useStaggeredAnimation } from '../../hooks/useStaggeredAnimation';

const { width } = Dimensions.get('window');

type TradeType = 'buy' | 'sell';
type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
type ProductType = 'CNC' | 'MIS' | 'NRML';

const ORDER_TYPES: OrderType[] = ['MARKET', 'LIMIT', 'SL', 'SL-M'];
const PRODUCT_TYPES: ProductType[] = ['CNC', 'MIS', 'NRML'];
const QUICK_QTYS = [10, 50, 100, 'Max'] as const;

const ORDER_TYPE_DESCRIPTIONS: Record<OrderType, string> = {
  MARKET: 'Buy/Sell at current market price',
  LIMIT: 'Execute only at your specified price or better',
  SL: 'Convert to market order when trigger price is hit',
  'SL-M': 'Market order that activates at trigger price',
};

const PRODUCT_DESCRIPTIONS: Record<ProductType, string> = {
  CNC: 'Delivery — settle with actual shares',
  MIS: 'Intraday — square off by EOD',
  NRML: 'Normal — for futures & options',
};

export default function PlaceOrderScreen({ route, navigation }: any) {
  const { stockId, symbol: paramSymbol, tradeType: initialTradeType = 'buy' } = route.params ?? {};
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { stocks } = useMarketStore();
  const { buyStock, sellStock, holdings } = usePortfolioStore();
  const { user } = useAuthStore();

  const stock = stocks.find(s => s.id === stockId || s.symbol === paramSymbol) || stocks[0];

  const [tradeType, setTradeType] = useState<TradeType>(initialTradeType);
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [productType, setProductType] = useState<ProductType>('CNC');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState(stock ? String(Math.round(stock.price)) : '');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showOrderTypes, setShowOrderTypes] = useState(false);
  const [showProductTypes, setShowProductTypes] = useState(false);

  // Existing holding for sell mode
  const existingHolding = useMemo(() =>
    holdings.find(h => h.stockId === stock.id),
    [holdings, stock.id]
  );
  const ownedQuantity = existingHolding?.quantity ?? 0;

  // Available balance (buying power)
  const availableBalance = user?.balance ?? 2500000;

  // Computed values
  const displayPrice = orderType === 'MARKET'
    ? stock.price
    : (parseFloat(limitPrice) || stock.price);
  const qtyNum = parseInt(quantity) || 0;
  const estimatedTotal = displayPrice * qtyNum;
  const charges = estimatedTotal * 0.001; // ~0.1% brokerage + taxes
  const grandTotal = estimatedTotal + charges;
  const isBalanceSufficient = grandTotal <= availableBalance;
  const canPlaceOrder = qtyNum > 0 && (
    tradeType === 'sell' ? qtyNum <= ownedQuantity : isBalanceSufficient
  ) && !isProcessing;

  // Quick-select preset quantities
  const handleQuickQty = useCallback((qty: number | 'Max') => {
    if (qty === 'Max') {
      if (tradeType === 'sell') {
        setQuantity(String(ownedQuantity));
      } else {
        const maxByBalance = Math.floor(availableBalance / displayPrice);
        setQuantity(String(Math.max(1, maxByBalance)));
      }
    } else {
      setQuantity(String(qty));
    }
  }, [tradeType, ownedQuantity, availableBalance, displayPrice]);

  // Increment/decrement quantity
  const adjustQty = useCallback((delta: number) => {
    setQuantity(prev => {
      const next = parseInt(prev || '0') + delta;
      if (next < 0) return '0';
      if (tradeType === 'sell' && next > ownedQuantity) return String(ownedQuantity);
      return String(next);
    });
  }, [tradeType, ownedQuantity]);

  // Place order handler
  const handlePlaceOrder = useCallback(async () => {
    if (!canPlaceOrder) return;
    setIsProcessing(true);

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (tradeType === 'buy') {
        await buyStock(stock, qtyNum, displayPrice);
      } else {
        if (!existingHolding) return;
        await sellStock(existingHolding.id, qtyNum, displayPrice);
      }

      setIsProcessing(false);
      setShowConfirmation(true);
    } catch (err) {
      setIsProcessing(false);
      Alert.alert('Order Failed', 'There was an error placing your order. Please try again.');
    }
  }, [canPlaceOrder, tradeType, stock, qtyNum, displayPrice, existingHolding, buyStock, sellStock]);

  const handleConfirmationClose = useCallback(() => {
    setShowConfirmation(false);
    navigation.goBack();
  }, [navigation]);

  // Reset quantity when toggling buy/sell
  useEffect(() => {
    setQuantity('');
  }, [tradeType]);

  // Staggered animation for order detail cards
  const { getAnimatedStyle: getDetailStyle } = useStaggeredAnimation(1, {
    initialDelay: 100,
    staggerDelay: 60,
    duration: 350,
  });

  if (!stock) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
        <Text style={[styles.stockSymbol, { marginTop: SPACING.md, color: colors.textMuted }]}>
          Stock not found
        </Text>
        <AnimatedPressable onPress={() => navigation.goBack()}>
          <View style={{ marginTop: SPACING.xl, paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, backgroundColor: colors.primary, borderRadius: BORDER_RADIUS.full }}>
            <Text style={{ color: colors.white, ...FONTS.medium, fontSize: FONTS.size.md }}>Go Back</Text>
          </View>
        </AnimatedPressable>
      </View>
    );
  }

  const orderCostSummary = (
    <>
      {/* Estimated Total */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Estimated Total</Text>
        <Text style={styles.summaryValue}>{formatCurrency(estimatedTotal)}</Text>
      </View>

      {/* Estimated Charges */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Est. Charges (brokerage + taxes)</Text>
        <Text style={styles.summaryValueMuted}>{formatCurrency(charges)}</Text>
      </View>

      {/* Divider */}
      <View style={styles.summaryDivider} />

      {/* Grand Total */}
      <View style={styles.summaryRow}>
        <Text style={styles.grandTotalLabel}>Grand Total</Text>
        <Text style={styles.grandTotalValue}>{formatCurrency(grandTotal)}</Text>
      </View>

      {/* Balance indicator */}
      {tradeType === 'buy' && (
        <View style={[styles.balanceIndicator, {
          backgroundColor: isBalanceSufficient ? '#00C85320' : '#FF174420',
        }]}>
          <Ionicons
            name={isBalanceSufficient ? 'checkmark-circle' : 'warning'}
            size={16}
            color={isBalanceSufficient ? colors.marketUp : colors.marketDown}
          />
          <Text style={[styles.balanceIndicatorText, {
            color: isBalanceSufficient ? colors.marketUp : colors.marketDown,
          }]}>
            {isBalanceSufficient
              ? `Available: ${formatCurrency(availableBalance)}`
              : `Insufficient balance — need ${formatCurrency(grandTotal - availableBalance)} more`
            }
          </Text>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={tradeType === 'buy' ? GRADIENTS.primary : GRADIENTS.secondary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} testID="backBtn">
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} testID="headerTitle">
            {tradeType === 'buy' ? 'Buy' : 'Sell'} Securities
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Stock info */}
        <View style={styles.stockInfoRow}>
          <View style={styles.stockInfoLeft}>
            <Text style={styles.stockSymbol}>{stock.symbol}</Text>
            <Text style={styles.stockName}>{stock.name}</Text>
          </View>
          <View style={styles.stockPriceCol}>
            <Text style={styles.stockPrice}>{formatCurrency(stock.price)}</Text>
            <View style={[styles.changeBadge, {
              backgroundColor: stock.isPositive ? '#00C85330' : '#FF174430',
            }]}>
              <Ionicons
                name={stock.isPositive ? 'caret-up' : 'caret-down'}
                size={12}
                color={stock.isPositive ? colors.marketUp : colors.marketDown}
              />
              <Text style={[styles.changeText, {
                color: stock.isPositive ? colors.marketUp : colors.marketDown,
              }]}>
                {stock.isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Buy/Sell Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            testID="buyToggle"
            style={[styles.toggleBtn, tradeType === 'buy' && styles.toggleBuyActive]}
            onPress={() => setTradeType('buy')}
          >
            <Ionicons
              name="arrow-down"
              size={16}
              color={tradeType === 'buy' ? colors.white : colors.marketUp}
            />
            <Text style={[styles.toggleText, tradeType === 'buy' && styles.toggleTextActive]}>
              Buy
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="sellToggle"
            style={[styles.toggleBtn, tradeType === 'sell' && styles.toggleSellActive]}
            onPress={() => setTradeType('sell')}
          >
            <Ionicons
              name="arrow-up"
              size={16}
              color={tradeType === 'sell' ? colors.white : colors.marketDown}
            />
            <Text style={[styles.toggleText, tradeType === 'sell' && styles.toggleTextActive]}>
              Sell
            </Text>
          </TouchableOpacity>
        </View>

        {/* Order Type Selector */}
        <View style={{ marginBottom: SPACING.lg }}>
          <Text style={styles.sectionLabel}>Order Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: SPACING.sm }}
          >
            {ORDER_TYPES.map(ot => (
              <TouchableOpacity
                key={ot}
                testID={`orderType_${ot}`}
                style={[styles.chip, orderType === ot && styles.chipActive]}
                onPress={() => setOrderType(ot)}
              >
                <Text style={[styles.chipText, orderType === ot && styles.chipTextActive]}>
                  {ot}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.chipDescription}>{ORDER_TYPE_DESCRIPTIONS[orderType]}</Text>
        </View>

        {/* Product Type Selector */}
        <View style={{ marginBottom: SPACING.lg }}>
          <Text style={styles.sectionLabel}>Product Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: SPACING.sm }}
          >
            {PRODUCT_TYPES.map(pt => (
              <TouchableOpacity
                key={pt}
                testID={`productType_${pt}`}
                style={[styles.chip, productType === pt && styles.chipActive]}
                onPress={() => setProductType(pt)}
              >
                <Text style={[styles.chipText, productType === pt && styles.chipTextActive]}>
                  {pt}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.chipDescription}>{PRODUCT_DESCRIPTIONS[productType]}</Text>
        </View>

        {/* Quantity Input */}
        <View style={styles.inputSection}>
          <Text style={styles.sectionLabel}>
            Quantity
            {tradeType === 'sell' && ownedQuantity > 0 && (
              <Text style={{ color: colors.textMuted, fontWeight: '400' }}>
                {' '}(Owned: {ownedQuantity})
              </Text>
            )}
          </Text>

          <View style={styles.qtyInputRow}>
            <TouchableOpacity
              style={styles.qtyAdjustBtn}
              onPress={() => adjustQty(-10)}
            >
              <Ionicons name="remove" size={20} color={colors.text} />
            </TouchableOpacity>
            <TextInput
              style={styles.qtyInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              style={styles.qtyAdjustBtn}
              onPress={() => adjustQty(10)}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Quick quantity presets */}
          <View style={styles.quickQtyRow}>
            {QUICK_QTYS.map(qty => {
              const isActive = qty === 'Max'
                ? (tradeType === 'sell' ? qtyNum === ownedQuantity : parseInt(quantity) === Math.floor(availableBalance / displayPrice))
                : parseInt(quantity) === (qty as number);
              return (
              <TouchableOpacity
                key={String(qty)}
                testID={`quickQty_${qty}`}
                style={[styles.quickQtyBtn, isActive && styles.quickQtyBtnActive]}
                onPress={() => handleQuickQty(qty)}
              >
                  <Text style={[styles.quickQtyText, isActive && styles.quickQtyTextActive]}>
                    {qty === 'Max' ? 'Max' : qty}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Price Input (for Limit / SL / SL-M) */}
        {(orderType === 'LIMIT' || orderType === 'SL' || orderType === 'SL-M') && (
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Limit Price (₹)</Text>
            <TextInput
              style={styles.priceInput}
              value={limitPrice}
              onChangeText={setLimitPrice}
              keyboardType="decimal-pad"
              placeholder={String(stock.price)}
              placeholderTextColor={colors.textMuted}
            />
          </View>
        )}

        {/* Trigger Price (for SL / SL-M) */}
        {(orderType === 'SL' || orderType === 'SL-M') && (
          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Trigger Price (₹)</Text>
            <TextInput
              style={styles.priceInput}
              value={triggerPrice}
              onChangeText={setTriggerPrice}
              keyboardType="decimal-pad"
              placeholder="Enter trigger price"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        )}

        {/* Order Summary Card */}
        {qtyNum > 0 && (
          <Animated.View style={[getDetailStyle(0), styles.summaryCard]}>
            <Text style={styles.summaryCardTitle}>Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Order Type</Text>
              <Text style={styles.summaryValue}>
                {orderType === 'MARKET' ? 'Market' : orderType}
                {' · '}{productType}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Quantity</Text>
              <Text style={styles.summaryValue}>{qtyNum} shares</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Price per share</Text>
              <Text style={styles.summaryValue}>{formatCurrency(displayPrice)}</Text>
            </View>
            {orderCostSummary}
          </Animated.View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <LinearGradient
        colors={[hexToRgba(colors.bg, 0), colors.bg]}
        style={styles.bottomBar}
      >
        <View style={styles.bottomRow}>
          <View style={styles.bottomLeft}>
            <Text style={styles.bottomLabel}>
              {qtyNum > 0 ? 'Total' : 'Available Balance'}
            </Text>
            <Text style={styles.bottomAmount}>
              {qtyNum > 0 ? formatCurrency(grandTotal) : formatCurrency(availableBalance)}
            </Text>
          </View>
          <Button
            title={isProcessing
              ? 'Processing...'
              : `${tradeType === 'buy' ? 'Buy' : 'Sell'} ${qtyNum > 0 ? qtyNum : ''} ${stock.symbol}`
            }
            onPress={handlePlaceOrder}
            variant={tradeType === 'buy' ? 'primary' : 'danger'}
            size="large"              disabled={!canPlaceOrder}
            loading={isProcessing}
            testID="placeOrderBtn"
            style={{ minWidth: width * 0.45, borderRadius: BORDER_RADIUS.full }}
          />
        </View>
      </LinearGradient>

      {/* Order Confirmation Modal */}
      {showConfirmation && (
        <View style={styles.modalOverlay} testID="confirmationModal">
          <Animated.View style={styles.confirmationModal}>
            <View style={styles.confirmIconContainer}>
              <LinearGradient
                colors={tradeType === 'buy' ? GRADIENTS.success : GRADIENTS.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.confirmIcon}
              >
                <Ionicons name="checkmark" size={36} color={colors.white} />
              </LinearGradient>
            </View>

            <Text style={styles.confirmTitle}>
              Order Placed Successfully!
            </Text>
            <Text style={styles.confirmSubtitle}>
              {tradeType === 'buy' ? 'Bought' : 'Sold'} {qtyNum} shares of {stock.symbol}
            </Text>

            <View style={styles.confirmDetails}>
              <View style={styles.confirmDetailRow}>
                <Text style={styles.confirmDetailLabel}>Order Type</Text>
                <Text style={styles.confirmDetailValue}>
                  {orderType === 'MARKET' ? 'Market' : orderType} · {productType}
                </Text>
              </View>
              <View style={styles.confirmDetailRow}>
                <Text style={styles.confirmDetailLabel}>Price</Text>
                <Text style={styles.confirmDetailValue}>{formatCurrency(displayPrice)}</Text>
              </View>
              <View style={styles.confirmDetailRow}>
                <Text style={styles.confirmDetailLabel}>Total</Text>
                <Text style={styles.confirmDetailValue}>{formatCurrency(grandTotal)}</Text>
              </View>
              <View style={styles.confirmDetailRow}>
                <Text style={styles.confirmDetailLabel}>Time</Text>
                <Text style={styles.confirmDetailValue}>
                  {new Date().toLocaleTimeString('en-IN')}
                </Text>
              </View>
            </View>

            <Button
              title="Done"
              onPress={handleConfirmationClose}
              variant={tradeType === 'buy' ? 'success' : 'primary'}
              size="large"
              testID="doneBtn"
              style={{ width: '100%', marginTop: SPACING.xl }}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingBottom: 20,
  },

  // ── Header ──
  header: {
    paddingTop: 56,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.white,
  },
  stockInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockInfoLeft: {
    flex: 1,
  },
  stockSymbol: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.xxl,
    color: colors.white,
  },
  stockName: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  stockPriceCol: {
    alignItems: 'flex-end',
  },
  stockPrice: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.xl,
    color: colors.white,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginTop: 4,
  },
  changeText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },

  // ── Buy/Sell Toggle ──
  toggleContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
    marginTop: -8,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  toggleBuyActive: {
    backgroundColor: '#00C85320',
    borderColor: colors.marketUp,
  },
  toggleSellActive: {
    backgroundColor: '#FF174420',
    borderColor: colors.marketDown,
  },
  toggleText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.white,
  },

  // ── Chips / Selectors ──
  sectionLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  chipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.primary,
  },
  chipDescription: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: SPACING.xs,
  },

  // ── Quantity Input ──
  inputSection: {
    marginBottom: SPACING.lg,
  },
  qtyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  qtyAdjustBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  qtyInput: {
    width: 120,
    height: 60,
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    color: colors.text,
    fontSize: FONTS.size.xxxl,
    fontWeight: '700',
    fontFamily: 'System',
  },
  quickQtyRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    justifyContent: 'center',
  },
  quickQtyBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 56,
    alignItems: 'center',
  },
  quickQtyBtnActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  quickQtyText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  quickQtyTextActive: {
    color: colors.primary,
  },

  // ── Price Input ──
  priceInput: {
    height: 52,
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: SPACING.lg,
    color: colors.text,
    fontSize: FONTS.size.xl,
    fontWeight: '600',
    fontFamily: 'System',
  },

  // ── Order Summary ──
  summaryCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACING.lg,
  },
  summaryCardTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  summaryValue: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  summaryValueMuted: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: SPACING.sm,
  },
  grandTotalLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  grandTotalValue: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  balanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
  },
  balanceIndicatorText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },

  // ── Bottom Bar ──
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: SPACING.xl,
    paddingBottom: 40,
    paddingHorizontal: SPACING.xl,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  bottomLeft: {
    flex: 1,
  },
  bottomLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  bottomAmount: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.xl,
    color: colors.text,
    marginTop: 2,
  },

  // ── Confirmation Modal ──
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  confirmationModal: {
    backgroundColor: colors.bgSecondary,
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xxl,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  confirmIconContainer: {
    marginBottom: SPACING.lg,
  },
  confirmIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
    textAlign: 'center',
  },
  confirmSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  confirmDetails: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  confirmDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmDetailLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  confirmDetailValue: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
});
