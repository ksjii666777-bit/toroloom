/**
 * ============================================================================
 * Toroloom — US Stocks Trading Screen
 * ============================================================================
 *
 * A unified US stocks trading hub:
 *   - Market overview (top US stocks with live prices, sectors)
 *   - Portfolio holdings from connected broker (SnapTrade)
 *   - Buy/Sell order modal for any stock
 *   - Search US stocks by symbol/name
 *   - Recent orders history
 *
 * Navigation: More → US Stocks Trading → StockDetail/SnapTradeOrder
 * ============================================================================
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  Platform, ActivityIndicator, Alert,
  Modal, Animated as RNAnimated,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { globalMarketsApi } from '../../services/api/globalMarkets';
import { snapTradeApi, api } from '../../services/api';
import { tickerProvider } from '../../services/tickerProvider';
import { newIdempotencyKey } from '../../utils/idempotency';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import AppScreen from '../../components/ui/AppScreen';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';


// ─── Types ─────────────────────────────────────────────────────────────

interface USStockDisplay {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
  marketCap: string;
  volume: string;
  pe: number;
  dividend: number;
  exchange: string;
}

interface StockHolding {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  avgCost: number;
  pnl: number;
  pnlPercent: number;
}

interface StockOrder {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  status: string;
  createdAt: string;
}

type TradeAction = 'BUY' | 'SELL';
type OrderType = 'Market' | 'Limit' | 'StopLoss';

// ─── Sector Colors ───────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  Technology: '#3B82F6',
  'Semiconductors': '#8B5CF6',
  'Finance': '#10B981',
  'Healthcare': '#06B6D4',
  'Consumer': '#F59E0B',
  'Energy': '#EF4444',
  'Automotive': '#FF6B00',
  'Entertainment': '#EC4899',
  'Industrials': '#6366F1',
  'Mining': '#A855F7',
  'Telecom': '#14B8A6',
};

function getSectorColor(sector: string): string {
  return SECTOR_COLORS[sector] || '#6C63FF';
}

const SECTOR_ICONS: Record<string, string> = {
  Technology: 'desktop',
  Semiconductors: 'hardware-chip-outline',
  Finance: 'wallet',
  Healthcare: 'medical',
  Consumer: 'cart',
  Energy: 'flame',
  Automotive: 'car',
  Entertainment: 'film',
  Industrials: 'build',
};

function getSectorIcon(sector: string): string {
  return SECTOR_ICONS[sector] || 'business';
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function _formatCompactUSD(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return formatUSD(n);
}

// ═════════════════════════════════════════════════════════════════════════
// STOCK CARD
// ═════════════════════════════════════════════════════════════════════════

function StockCard({
  stock,
  index,
  onPress,
  onTrade,
}: {
  stock: USStockDisplay;
  index: number;
  onPress: (stock: USStockDisplay) => void;
  onTrade: (stock: USStockDisplay, action: TradeAction) => void;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const sectorColor = getSectorColor(stock.sector);
  const sectorIcon = getSectorIcon(stock.sector);

  return (
    <Animated.View entering={FadeInUp.duration(300).delay(index * 50)}>
      <Pressable
        onPress={() => onPress(stock)}
        style={[styles.stockCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      >
        {/* Sector Icon */}
        <View style={[styles.stockIcon, { backgroundColor: sectorColor + '20' }]}>
          <Ionicons name={sectorIcon as any} size={18} color={sectorColor} />
        </View>

        {/* Info */}
        <View style={styles.stockInfo}>
          <Text style={[styles.stockSymbol, { color: colors.text }]}>{stock.symbol}</Text>
          <Text style={[styles.stockName, { color: colors.textMuted }]} numberOfLines={1}>{stock.name}</Text>
          <View style={[styles.sectorBadge, { backgroundColor: sectorColor + '15' }]}>
            <Text style={[styles.sectorText, { color: sectorColor }]}>{stock.sector}</Text>
          </View>
        </View>

        {/* Price */}
        <View style={styles.stockPriceContainer}>
          <Text style={[styles.stockPrice, { color: colors.text }]}>
            {stock.price >= 1 ? formatUSD(stock.price) : '$' + stock.price.toFixed(4)}
          </Text>
          <View style={[styles.stockChangeBadge, { backgroundColor: (stock.isPositive ? '#00E676' : '#FF5252') + '20' }]}>
            <Ionicons
              name={stock.isPositive ? 'caret-up' : 'caret-down'}
              size={10}
              color={stock.isPositive ? '#00E676' : '#FF5252'}
            />
            <Text style={[styles.stockChangeText, { color: stock.isPositive ? '#00E676' : '#FF5252' }]}>
              {stock.isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
            </Text>
          </View>
        </View>

        {/* Trade Buttons */}
        <View style={styles.stockActions}>
          <Pressable
            onPress={() => onTrade(stock, 'BUY')}
            style={[styles.stockActionBtn, { backgroundColor: '#00E67620' }]}
          >
            <Text style={[styles.stockActionText, { color: '#00E676' }]}>{t('trading.buy')}</Text>
          </Pressable>
          <Pressable
            onPress={() => onTrade(stock, 'SELL')}
            style={[styles.stockActionBtn, { backgroundColor: '#FF525220' }]}
          >
            <Text style={[styles.stockActionText, { color: '#FF5252' }]}>{t('trading.sell')}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// HOLDING ROW
// ═════════════════════════════════════════════════════════════════════════

function HoldingRow({ holding, colors }: { holding: StockHolding; colors: any }) {
  const { t } = useT();
  const isUp = holding.pnl >= 0;
  return (
    <View style={[styles.holdingRow, { borderBottomColor: colors.divider }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.holdingSymbol, { color: colors.text }]}>{holding.symbol}</Text>
        <Text style={[styles.holdingName, { color: colors.textMuted }]} numberOfLines={1}>{holding.name}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.holdingQty, { color: colors.text }]}>{t('app.shares', { count: holding.quantity })}</Text>
        <Text style={[styles.holdingValue, { color: colors.textMuted }]}>{formatUSD(holding.quantity * holding.price)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', minWidth: 80 }}>
        <Text style={[styles.holdingPnl, { color: isUp ? '#00E676' : '#FF5252' }]}>
          {isUp ? '+' : ''}{formatUSD(holding.pnl)}
        </Text>
        <Text style={[styles.holdingPnlPct, { color: isUp ? '#00E676' : '#FF5252' }]}>
          {isUp ? '+' : ''}{holding.pnlPercent.toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// ORDER ROW
// ═════════════════════════════════════════════════════════════════════════

function OrderRow({ order, colors }: { order: StockOrder; colors: any }) {
  const isBuy = order.action === 'BUY';
  const statusColors: Record<string, string> = {
    filled: '#00E676', confirmed: '#00E676',
    pending: '#FFC107', submitted: '#FFC107',
    rejected: '#FF5252', cancelled: '#FF5252', canceled: '#FF5252',
  };
  const statusColor = statusColors[order.status?.toLowerCase()] || colors.textMuted;

  return (
    <View style={[styles.orderRow, { borderBottomColor: colors.divider }]}>
      <View style={[styles.orderActionBadge, { backgroundColor: (isBuy ? '#00E676' : '#FF5252') + '20' }]}>
        <Ionicons name={isBuy ? 'arrow-down' : 'arrow-up'} size={12} color={isBuy ? '#00E676' : '#FF5252'} />
        <Text style={[styles.orderActionText, { color: isBuy ? '#00E676' : '#FF5252' }]}>{order.action}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.orderSymbol, { color: colors.text }]}>{order.symbol}</Text>
        <Text style={[styles.orderQty, { color: colors.textMuted }]}>
          {order.quantity} @ {formatUSD(order.price)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.orderStatus, { color: statusColor }]}>{order.status}</Text>
        <Text style={[styles.orderDate, { color: colors.textMuted }]}>
          {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}
        </Text>
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// TRADE MODAL
// ═════════════════════════════════════════════════════════════════════════

function TradeModal({
  visible, onClose, stock, action,
}: {
  visible: boolean;
  onClose: () => void;
  stock: USStockDisplay | null;
  action: TradeAction;
}) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new RNAnimated.Value(0)).current;

  const [orderType, setOrderType] = useState<OrderType>('Market');
  const [quantityStr, setQuantityStr] = useState('');
  const [limitPriceStr, setLimitPriceStr] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);

  const qty = parseInt(quantityStr) || 0;
  const limitPrice = parseFloat(limitPriceStr) || 0;
  const displayPrice = orderType === 'Market' ? (stock?.price || 0) : limitPrice;
  const estimatedTotal = displayPrice * qty;
  const actionColor = action === 'BUY' ? '#00E676' : '#FF5252';
  const gradientColors = action === 'BUY' ? GRADIENTS.primary : GRADIENTS.secondary;

  const canPlace = qty > 0 && (orderType === 'Market' || limitPrice > 0);

  useEffect(() => {
    if (visible) {
      RNAnimated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 9 }).start();
      setOrderType('Market');
      setQuantityStr('');
      setLimitPriceStr('');
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, stock, slideAnim]);

  const placeOrder = useCallback(async () => {
    if (!stock || !canPlace) return;
    setIsPlacing(true);
    try {
      const result = await snapTradeApi.placeOrder({
        symbol: stock.symbol.toUpperCase(),
        action,
        orderType,
        quantity: qty,
        ...(limitPrice > 0 && orderType !== 'Market' && { price: limitPrice }),
        ...(orderType === 'Market' && displayPrice > 0 && { estimatedPrice: displayPrice }),
        timeInForce: 'Day',
        idempotencyKey: newIdempotencyKey(),
      });
      if (!result.success) {
        Alert.alert(t('trading.orderBlocked'), result.message || t('trading.usOrderFailedMsg'), [
          { text: t('app.ok'), onPress: onClose },
        ]);
        return;
      }
      Alert.alert(
        t('trading.usOrderPlaced', { action: action === 'BUY' ? t('trading.buy') : t('trading.sell') }),
        `${t('trading.orderIdPrefix')}${result.orderId ? result.orderId.substring(0, 12) : '—'}...\n${t('trading.statusPrefix')}${result.status}`,
        [{ text: t('app.ok'), onPress: onClose }],
      );
    } catch (err: any) {
      Alert.alert(t('trading.usOrderFailed'), err?.message || t('trading.usOrderFailedMsg'));
    } finally {
      setIsPlacing(false);
    }
  }, [stock, action, orderType, qty, limitPrice, displayPrice, canPlace, onClose, t]);

  const overlayOpacity = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] });
  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  const QUICK_QTYS = [1, 10, 50, 100];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <RNAnimated.View style={[styles.modalBg, { opacity: overlayOpacity }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </RNAnimated.View>
        <RNAnimated.View style={[styles.modalContent, { paddingBottom: insets.bottom + 20, transform: [{ translateY }] }]}>
          {/* Handle */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <View style={[styles.modalStockIcon, { backgroundColor: (stock ? getSectorColor(stock.sector) : '#6C63FF') + '20' }]}>
                <Ionicons name={stock ? getSectorIcon(stock.sector) as any : 'business'} size={20} color={stock ? getSectorColor(stock.sector) : '#6C63FF'} />
              </View>
              <View>
                {stock?.symbol && (
                  <Text style={[styles.modalStockName, { color: colors.text }]}>{stock.symbol}</Text>
                )}
                <Text style={[styles.modalStockMeta, { color: colors.textMuted }]}>
                  {stock?.name && `${stock.name} · `}{formatUSD(stock?.price || 0)}
                </Text>
              </View>
            </View>
            <View style={[styles.modalActionBadge, { backgroundColor: actionColor + '20' }]}>
              <Text style={[styles.modalActionText, { color: actionColor }]}>{action}</Text>
            </View>
          </View>

          {/* Order Type */}
          <View style={styles.modalField}>
            <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>{t('trading.orderTypeLabel')}</Text>
            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              {(['Market', 'Limit', 'StopLoss'] as OrderType[]).map(ot => (
                <Pressable
                  key={ot}
                  style={[styles.modalChip, {
                    backgroundColor: orderType === ot ? actionColor + '20' : colors.bgInput,
                    borderColor: orderType === ot ? actionColor + '40' : colors.border,
                  }]}
                  onPress={() => setOrderType(ot)}
                >
                  <Text style={[styles.modalChipText, { color: orderType === ot ? actionColor : colors.textMuted }]}>
                    {ot === 'StopLoss' ? t('trading.stopLossLabel') : ot}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Quantity */}
          <View style={styles.modalField}>
            <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>{t('trading.qtyShares')}</Text>
            <View style={[styles.modalInput, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <TextInput
                style={[styles.modalInputField, { color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={quantityStr}
                onChangeText={setQuantityStr}
                keyboardType="number-pad"
              />
            </View>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs }}>
              {QUICK_QTYS.map(q => (
                <Pressable
                  key={q}
                  style={[styles.qtyChip, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                  onPress={() => setQuantityStr(String(q))}
                >
                  <Text style={[styles.qtyChipText, { color: colors.textMuted }]}>{q}</Text>
                </Pressable>
              ))}
              <Pressable
                style={[styles.qtyChip, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                onPress={() => setQuantityStr('Max')}
              >
                <Text style={[styles.qtyChipText, { color: colors.textMuted }]}>{t('trading.max')}</Text>
              </Pressable>
            </View>
          </View>

          {/* Limit Price */}
          {orderType !== 'Market' && (
            <View style={styles.modalField}>
              <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>
                {orderType === 'StopLoss' ? t('trading.stopPrice') : t('trading.usLimitPrice')}
              </Text>
              <View style={[styles.modalInput, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
                <Text style={[styles.modalInputPrefix, { color: colors.textMuted }]}>$</Text>
                <TextInput
                  style={[styles.modalInputField, { color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  value={limitPriceStr}
                  onChangeText={setLimitPriceStr}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          )}

          {/* Summary */}
          {qty > 0 && (
            <View style={[styles.modalSummary, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.modalSummaryRow}>
                <Text style={[styles.modalSummaryLabel, { color: colors.textMuted }]}>{t('trading.estimatedTotal')}</Text>
                <Text style={[styles.modalSummaryValue, { color: colors.text }]}>{formatUSD(estimatedTotal)}</Text>
              </View>
              <View style={styles.modalSummaryRow}>
                <Text style={[styles.modalSummaryLabel, { color: colors.textMuted }]}>{t('trading.pricePerShare')}</Text>
                <Text style={[styles.modalSummaryValue, { color: colors.text }]}>{formatUSD(displayPrice)}</Text>
              </View>
              <View style={styles.modalSummaryRow}>
                <Text style={[styles.modalSummaryLabel, { color: colors.textMuted }]}>{t('trading.quantityLabel')}</Text>
                <Text style={[styles.modalSummaryValue, { color: colors.text }]}>{t('app.shares', { count: qty })}</Text>
              </View>
            </View>
          )}

          {/* Action Button */}
          <AnimatedPressable
            onPress={placeOrder}
            disabled={!canPlace || isPlacing}
            haptic="medium"
            scaleTo={0.97}
            style={{ width: '100%' }}
          >
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.modalActionBtn, (!canPlace || isPlacing) && { opacity: 0.5 }]}
            >
              {isPlacing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalActionBtnText}>
                  {action}{stock?.symbol && ` ${stock.symbol}`}
                </Text>
              )}
            </LinearGradient>
          </AnimatedPressable>
        </RNAnimated.View>
      </View>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════

export default function USStocksTradingScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'USStocksTrading'>) {
  const { colors } = useTheme();
  const { t } = useT();

  const [stocks, setStocks] = useState<USStockDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'market' | 'portfolio' | 'orders'>('market');

  // Holdings & Orders
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [orders, setOrders] = useState<StockOrder[]>([]);
  const [isBrokerConnected, setIsBrokerConnected] = useState(false);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [totalPnl, setTotalPnl] = useState(0);
  const [accountBalance, setAccountBalance] = useState(0);

  // Trade Modal
  const [tradeModalVisible, setTradeModalVisible] = useState(false);
  const [selectedStock, setSelectedStock] = useState<USStockDisplay | null>(null);
  const [tradeAction, setTradeAction] = useState<TradeAction>('BUY');

  // Fetch data
  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      // Fetch US stock market data
      const marketData = await globalMarketsApi.getStocks();
      setStocks((marketData || []).map(s => ({
        ...s,
        isPositive: s.changePercent >= 0,
      })));

      // Check broker status
      try {
        const status = await snapTradeApi.status();
        setIsBrokerConnected(status.connected);

        if (status.connected) {
          const [hldResult, accResult] = await Promise.all([
            snapTradeApi.getHoldings().catch(() => ({ data: [], count: 0 })),
            snapTradeApi.getAccounts().catch(() => ({ data: [], count: 0 })),
          ]);

          // Holdings
          const holdingData = hldResult.data || [];
          setHoldings(holdingData.map(h => ({
            symbol: h.symbol,
            name: h.name || h.symbol,
            quantity: h.quantity,
            price: h.price,
            avgCost: h.avgCost,
            pnl: h.pnl,
            pnlPercent: h.pnlPercent,
          })));

          const totalVal = holdingData.reduce((s, h) => s + h.price * h.quantity, 0);
          const totalP = holdingData.reduce((s, h) => s + h.pnl, 0);
          setTotalPortfolioValue(totalVal);
          setTotalPnl(totalP);

          const acctTotal = (accResult.data || []).reduce((s: number, a: any) => s + (a.balance || 0), 0);
          setAccountBalance(acctTotal);

          // Fetch orders
          try {
            const ordersResult: any = await api.get('/snaptrade/orders');
            if (ordersResult?.data) {
              setOrders(ordersResult.data.map((o: any) => ({
                id: o.id,
                symbol: o.symbol,
                action: o.action || o.side,
                quantity: o.quantity || o.filledQuantity || 0,
                price: o.price || 0,
                status: o.status,
                createdAt: o.createdAt,
              })));
            }
          } catch {
            // Orders not available
          }
        }
      } catch {
        // Broker not connected
      }
    } catch {
      // Market data unavailable
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData(false);
  }, [fetchData]);

  // Filter stocks by search
  const filteredStocks = useMemo(() => {
    if (!searchQuery.trim()) return stocks;
    const q = searchQuery.toLowerCase();
    return stocks.filter(s =>
      s.symbol.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.sector.toLowerCase().includes(q),
    );
  }, [stocks, searchQuery]);

  // Hybrid Ticker Provider — pre-select the instrument so the SnapTrade
  // order panel opens pre-filled with the same symbol, chart and execution
  // price whether the user taps BUY/SELL or opens the stock detail.
  const preselectStock = useCallback((stock: USStockDisplay) => {
    tickerProvider.selectSymbol({
      symbol: stock.symbol,
      exchange: stock.exchange,
      name: stock.name,
      price: stock.price,
    });
  }, []);

  // Open trade modal
  const openTrade = useCallback((stock: USStockDisplay, action: TradeAction) => {
    preselectStock(stock);
    setSelectedStock(stock);
    setTradeAction(action);
    setTradeModalVisible(true);
  }, [preselectStock]);

  // Navigate to detail
  const goToDetail = useCallback((stock: USStockDisplay) => {
    preselectStock(stock);
    navigation.navigate('USStockDetail', {
      symbol: stock.symbol,
      name: stock.name,
      price: stock.price,
    });
  }, [navigation, preselectStock]);

  // Tabs
  const tabs: { key: typeof selectedTab; label: string; icon: string }[] = [
    { key: 'market', label: t('trading.market'), icon: 'trending-up' },
    { key: 'portfolio', label: t('trading.portfolio'), icon: 'wallet' },
    { key: 'orders', label: t('trading.ordersTab'), icon: 'receipt' },
  ];

  return (
    <AppScreen
      padded={false}
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      contentStyle={styles.scrollContent}
      header={
        <LinearGradient
          colors={['#1a2332', colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>{t('trading.usStocks')}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {t('app.stocks', { count: stocks.length })} · {isBrokerConnected ? t('usMarkets.brokerConnected') : t('usMarkets.viewOnly')}
              </Text>
            </View>
            {!isBrokerConnected && (
              <Pressable
                onPress={() => navigation.navigate('BrokerConnect')}
                style={[styles.connectBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}
              >
                <Ionicons name="link" size={16} color={colors.primary} />
                <Text style={[styles.connectBtnText, { color: colors.primary }]}>{t('trading.connect')}</Text>
              </Pressable>
            )}
          </View>

          {/* Search */}
          <View style={[styles.searchBar, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t('usMarkets.searchStocksBy')}
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            {tabs.map(tab => {
              const isActive = selectedTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setSelectedTab(tab.key)}
                  style={[styles.tabBtn, isActive && { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}
                >
                  <Ionicons name={tab.icon as any} size={16} color={isActive ? colors.primary : colors.textMuted} />
                  <Text style={[styles.tabText, { color: isActive ? colors.primary : colors.textMuted }]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </LinearGradient>
      }
    >
        {isLoading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('trading.loadingMarkets')}</Text>
          </View>
        ) : (
          <>
            {/* ── MARKET TAB ── */}
            {selectedTab === 'market' && (
              <>
                {/* Stats Banner */}
                <View style={[styles.statsBanner, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('trading.availableStocks')}</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{stocks.length}</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('trading.sectors')}</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {new Set(stocks.map(s => s.sector)).size}
                    </Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('trading.exchanges')}</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {new Set(stocks.map(s => s.exchange)).size}
                    </Text>
                  </View>
                </View>

                {/* Stock List */}
                {filteredStocks.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <Ionicons name="search" size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('trading.noStocksFound')}</Text>
                  </View>
                ) : (
                  <View style={{ gap: SPACING.sm }}>
                    {/* Perf summary */}
                    <View style={[styles.perfRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                      <Ionicons name="pulse" size={16} color={colors.primary} />
                      <Text style={[styles.perfText, { color: colors.textMuted }]}>
                        {filteredStocks.filter(s => s.isPositive).length}/{filteredStocks.length} {t('usMarkets.stocksUp')} · 
                        {t('trading.marketDataVia')}
                      </Text>
                    </View>
                    {filteredStocks.map((stock, i) => (
                      <StockCard
                        key={stock.symbol}
                        stock={stock}
                        index={i}
                        onPress={goToDetail}
                        onTrade={openTrade}
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            {/* ── PORTFOLIO TAB ── */}
            {selectedTab === 'portfolio' && (
              <View style={[styles.portfolioCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                {!isBrokerConnected ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <Ionicons name="briefcase-outline" size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: SPACING.md }]}>
                      {t('trading.connectBrokerToSee')}
                    </Text>
                    <Pressable
                      onPress={() => navigation.navigate('BrokerConnect')}
                      style={[styles.connectNowBtn, { backgroundColor: colors.primary }]}
                    >
                      <Text style={styles.connectNowText}>{t('trading.connectBroker')}</Text>
                    </Pressable>
                  </View>
                ) : holdings.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <Ionicons name="file-tray-outline" size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: SPACING.md }]}>
                      {t('trading.noHoldingsFound')}
                    </Text>
                    <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                      {t('trading.startTradingPortfolio')}
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Portfolio Summary */}
                    <View style={[styles.portfolioSummary, { borderBottomColor: colors.divider }]}>
                      <Text style={[styles.portfolioSummaryLabel, { color: colors.textMuted }]}>{t('trading.portfolioValue')}</Text>
                      <Text style={[styles.portfolioSummaryValue, { color: colors.text }]}>
                        {formatUSD(totalPortfolioValue)}
                      </Text>
                      <View style={[styles.portfolioPnl, { backgroundColor: totalPnl >= 0 ? '#00E67620' : '#FF525220' }]}>
                        <Ionicons name={totalPnl >= 0 ? 'caret-up' : 'caret-down'} size={14} color={totalPnl >= 0 ? '#00E676' : '#FF5252'} />
                        <Text style={[styles.portfolioPnlText, { color: totalPnl >= 0 ? '#00E676' : '#FF5252' }]}>
                          {totalPnl >= 0 ? '+' : ''}{formatUSD(totalPnl)}
                        </Text>
                      </View>
                      {accountBalance > 0 && (
                        <Text style={[styles.portfolioMeta, { color: colors.textMuted }]}>
                          {t('trading.buyingPower', { amount: formatUSD(accountBalance) })}
                        </Text>
                      )}
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.md }]}>
                      {t('trading.holdingsWithCount', { count: holdings.length })}
                    </Text>
                    {holdings.map((h, i) => (
                      <HoldingRow key={h.symbol + i} holding={h} colors={colors} />
                    ))}
                  </>
                )}
              </View>
            )}

            {/* ── ORDERS TAB ── */}
            {selectedTab === 'orders' && (
              <View style={[styles.portfolioCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                {!isBrokerConnected ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: SPACING.md }]}>
                      {t('trading.connectBrokerOrders')}
                    </Text>
                  </View>
                ) : orders.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: SPACING.md }]}>{t('trading.noOrdersYet')}</Text>
                    <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                      {t('trading.ordersWillAppear')}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('trading.recentOrders')}</Text>
                    {orders.map((o, i) => (
                      <OrderRow key={o.id || i} order={o} colors={colors} />
                    ))}
                  </>
                )}
              </View>
            )}

            {/* Info Note */}
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.textMuted }]}>
                {t('trading.infoNoteUS', {
                  brokerNote: isBrokerConnected ? t('trading.brokerNoteConnected') : t('trading.brokerNoteDisconnected'),
                })}
              </Text>
            </View>

            <View style={{ height: 80 }} />
          </>
        )}
      {/* Trade Modal */}
      <TradeModal
        visible={tradeModalVisible}
        onClose={() => setTradeModalVisible(false)}
        stock={selectedStock}
        action={tradeAction}
      />
    </AppScreen>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // Header
  header: {
    // AppScreen already pads for the status-bar/safe-area inset
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backBtn: { padding: 4 },
  title: { ...FONTS.bold, fontSize: FONTS.size.title },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2 },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  connectBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.sm : SPACING.xs,
    borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginTop: SPACING.md,
  },
  searchInput: { flex: 1, ...FONTS.regular, fontSize: FONTS.size.sm, padding: 0 },

  // Tabs
  tabRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: 'transparent',
  },
  tabText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // Content
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },

  // Stats Banner
  statsBanner: {
    flexDirection: 'row', padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  statValue: { ...FONTS.bold, fontSize: FONTS.size.sm, marginTop: 2 },
  statDivider: { width: 1, height: '100%', marginHorizontal: SPACING.md },

  // Performance Row
  perfRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.sm,
  },
  perfText: { ...FONTS.regular, fontSize: FONTS.size.xs, flex: 1 },

  // Stock Card
  stockCard: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg, borderWidth: 1, gap: SPACING.md,
  },
  stockIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  stockInfo: { flex: 1 },
  stockSymbol: { ...FONTS.bold, fontSize: FONTS.size.sm },
  stockName: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  sectorBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: BORDER_RADIUS.full, marginTop: 2,
  },
  sectorText: { ...FONTS.medium, fontSize: 8 },
  stockPriceContainer: { alignItems: 'flex-end', marginRight: SPACING.sm },
  stockPrice: { ...FONTS.bold, fontSize: FONTS.size.sm, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  stockChangeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full, marginTop: 2,
  },
  stockChangeText: { ...FONTS.semiBold, fontSize: 9 },
  stockActions: { flexDirection: 'column', gap: 4 },
  stockActionBtn: {
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
    borderRadius: 4, alignItems: 'center', minWidth: 40,
  },
  stockActionText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // Portfolio
  portfolioCard: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.md,
  },
  portfolioSummary: {
    paddingBottom: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  portfolioSummaryLabel: { ...FONTS.regular, fontSize: FONTS.size.sm },
  portfolioSummaryValue: {
    ...FONTS.bold, fontSize: 28, marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  portfolioPnl: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full, marginTop: SPACING.sm,
  },
  portfolioPnlText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  portfolioMeta: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: SPACING.sm },
  sectionTitle: { ...FONTS.bold, fontSize: FONTS.size.md, marginBottom: SPACING.md },

  holdingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: SPACING.sm,
  },
  holdingSymbol: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  holdingName: { ...FONTS.regular, fontSize: FONTS.size.xs },
  holdingQty: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: FONTS.size.sm, fontWeight: '600' },
  holdingValue: { ...FONTS.regular, fontSize: FONTS.size.xs },
  holdingPnl: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: FONTS.size.sm, fontWeight: '700' },
  holdingPnlPct: { ...FONTS.regular, fontSize: FONTS.size.xs },

  // Orders
  orderRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, gap: SPACING.sm,
  },
  orderActionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full,
  },
  orderActionText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  orderSymbol: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  orderQty: { ...FONTS.regular, fontSize: FONTS.size.xs },
  orderStatus: { ...FONTS.semiBold, fontSize: FONTS.size.xs, textTransform: 'capitalize' },
  orderDate: { ...FONTS.regular, fontSize: 9 },

  // Empty State
  emptyText: { ...FONTS.regular, fontSize: FONTS.size.sm, textAlign: 'center' },
  emptySubtext: { ...FONTS.regular, fontSize: FONTS.size.xs, textAlign: 'center', marginTop: 4 },
  connectNowBtn: {
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md, marginTop: SPACING.lg,
  },
  connectNowText: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: '#fff' },

  // Loading
  loadingText: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: SPACING.md },

  // Info
  infoCard: {
    flexDirection: 'row', gap: SPACING.md, padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.lg,
  },
  infoText: { ...FONTS.regular, fontSize: FONTS.size.xs, flex: 1, lineHeight: 16 },

  // ── Trade Modal ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },
  modalContent: {
    backgroundColor: '#161922',
    borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, paddingTop: SPACING.md, maxHeight: '85%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: SPACING.md, borderBottomWidth: 1,
  },
  modalStockIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  modalStockName: { ...FONTS.bold, fontSize: FONTS.size.md },
  modalStockMeta: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  modalActionBadge: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  modalActionText: { ...FONTS.bold, fontSize: FONTS.size.sm, letterSpacing: 0.5 },

  modalField: { marginTop: SPACING.lg },
  modalFieldLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, marginBottom: SPACING.sm },
  modalInput: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
  },
  modalInputField: { flex: 1, ...FONTS.bold, fontSize: FONTS.size.xl, padding: 0 },
  modalInputPrefix: { ...FONTS.semiBold, fontSize: FONTS.size.xl, marginRight: 4 },
  qtyChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  qtyChipText: { ...FONTS.medium, fontSize: FONTS.size.xs },
  modalChip: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  modalChipText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

  modalSummary: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, marginTop: SPACING.lg, gap: SPACING.sm,
  },
  modalSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalSummaryLabel: { ...FONTS.regular, fontSize: FONTS.size.sm },
  modalSummaryValue: { ...FONTS.bold, fontSize: FONTS.size.sm },

  modalActionBtn: {
    paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md,
    alignItems: 'center', marginTop: SPACING.lg,
  },
  modalActionBtnText: { ...FONTS.bold, fontSize: FONTS.size.lg, color: '#fff' },
});
