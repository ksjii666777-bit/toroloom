/**
 * ============================================================================
 * Toroloom — Crypto Trading Screen
 * ============================================================================
 *
 * A unified crypto trading hub:
 *   - Market overview (top coins with live prices)
 *   - Portfolio holdings from connected broker (SnapTrade)
 *   - Buy/Sell order modal for any coin
 *   - Search coins
 *   - Recent orders history
 *
 * Navigation: More → Crypto Trading → CryptoDetail
 * ============================================================================
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Platform, ActivityIndicator, Alert,
  Modal, Animated as RNAnimated, RefreshControl,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
const BORDER_RADIUS_SM = 4;
import { globalMarketsApi } from '../../services/api/globalMarkets';
import { snapTradeApi, api } from '../../services/api';

import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { CryptoAssetData } from '../../services/api/globalMarkets';


const COIN_ICON_SIZE = 40;

// ── Memoized Set for O(1) crypto symbol lookups ──
const CRYPTO_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'LINK', 'AVAX', 'MATIC'];
const CRYPTO_SYMBOLS_SET = new Set(CRYPTO_SYMBOLS);

// ─── Types ─────────────────────────────────────────────────────────────

interface CryptoHolding {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  avgCost: number;
  pnl: number;
  pnlPercent: number;
}

interface CryptoOrder {
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

const CRYPTO_COLORS: Record<string, string> = {
  bitcoin: '#F7931A',
  ethereum: '#627EEA',
  tether: '#26A17B',
  'binance-coin': '#F0B90B',
  solana: '#9945FF',
  xrp: '#23292F',
  cardano: '#0033AD',
  polkadot: '#E6007A',
  dogecoin: '#C2A633',
  avalanche: '#E84142',
  chainlink: '#375BD2',
  polygon: '#8247E5',
  litecoin: '#345D9D',
  uniswap: '#FF007A',
  stellar: '#14B4E5',
};

function getCryptoColor(symbol: string): string {
  return CRYPTO_COLORS[symbol.toLowerCase()] || '#6C63FF';
}

function formatPrice(price: number): string {
  if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

function formatLargeNumber(num: number): string {
  if (!num) return '0';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toFixed(2);
}

// ═════════════════════════════════════════════════════════════════════════
// COIN CARD
// ═════════════════════════════════════════════════════════════════════════

function CoinCard({
  coin,
  index,
  onPress,
  onTrade,
}: {
  coin: CryptoAssetData;
  index: number;
  onPress: (coin: CryptoAssetData) => void;
  onTrade: (coin: CryptoAssetData, action: TradeAction) => void;
}) {
  const { colors } = useTheme();
  const isPositive = coin.changePercent >= 0;

  return (
    <Animated.View entering={FadeInUp.duration(300).delay(index * 60)}>
      <Pressable
        onPress={() => onPress(coin)}
        style={[styles.coinCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      >
        {/* Icon */}
        <View style={[styles.coinIcon, { backgroundColor: (coin.color || getCryptoColor(coin.symbol)) + '20' }]}>
          <Text style={[styles.coinIconText, { color: coin.color || getCryptoColor(coin.symbol) }]}>
            {coin.name.charAt(0)}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.coinInfo}>
          <Text style={[styles.coinName, { color: colors.text }]}>{coin.name}</Text>
          <Text style={[styles.coinSymbol, { color: colors.textMuted }]}>{coin.symbol.toUpperCase()}</Text>
        </View>

        {/* Price */}
        <View style={styles.coinPriceContainer}>
          <Text style={[styles.coinPrice, { color: colors.text }]}>${formatPrice(coin.price)}</Text>
          <View style={[styles.coinChangeBadge, { backgroundColor: (isPositive ? '#00E676' : '#FF5252') + '20' }]}>
            <Ionicons
              name={isPositive ? 'caret-up' : 'caret-down'}
              size={10}
              color={isPositive ? '#00E676' : '#FF5252'}
            />
            <Text style={[styles.coinChangeText, { color: isPositive ? '#00E676' : '#FF5252' }]}>
              {isPositive ? '+' : ''}{coin.changePercent.toFixed(2)}%
            </Text>
          </View>
        </View>

        {/* Trade Buttons */}
        <View style={styles.coinActions}>
          <Pressable
            onPress={() => onTrade(coin, 'BUY')}
            style={[styles.coinActionBtn, { backgroundColor: '#00E676' + '20' }]}
          >
            <Text style={[styles.coinActionText, { color: '#00E676' }]}>Buy</Text>
          </Pressable>
          <Pressable
            onPress={() => onTrade(coin, 'SELL')}
            style={[styles.coinActionBtn, { backgroundColor: '#FF5252' + '20' }]}
          >
            <Text style={[styles.coinActionText, { color: '#FF5252' }]}>Sell</Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// HOLDING ROW
// ═════════════════════════════════════════════════════════════════════════

function HoldingRow({ holding, colors }: { holding: CryptoHolding; colors: any }) {
  const isUp = holding.pnl >= 0;
  return (
    <View style={[styles.holdingRow, { borderBottomColor: colors.divider }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.holdingSymbol, { color: colors.text }]}>{holding.symbol}</Text>
        <Text style={[styles.holdingName, { color: colors.textMuted }]} numberOfLines={1}>{holding.name}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.holdingQty, { color: colors.text }]}>{holding.quantity.toFixed(4)}</Text>
        <Text style={[styles.holdingValue, { color: colors.textMuted }]}>${(holding.quantity * holding.price).toFixed(2)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', minWidth: 70 }}>
        <Text style={[styles.holdingPnl, { color: isUp ? '#00E676' : '#FF5252' }]}>
          {isUp ? '+' : ''}${Math.abs(holding.pnl).toFixed(2)}
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

function OrderRow({ order, colors }: { order: CryptoOrder; colors: any }) {
  const isBuy = order.action === 'BUY';
  const statusColors: Record<string, string> = {
    filled: '#00E676',
    confirmed: '#00E676',
    pending: '#FFC107',
    submitted: '#FFC107',
    rejected: '#FF5252',
    cancelled: '#FF5252',
    canceled: '#FF5252',
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
          {order.quantity} @ ${order.price.toFixed(2)}
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
  visible,
  onClose,
  coin,
  action,
}: {
  visible: boolean;
  onClose: () => void;
  coin: CryptoAssetData | null;
  action: TradeAction;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new RNAnimated.Value(0)).current;

  const [orderType, setOrderType] = useState<OrderType>('Market');
  const [quantityStr, setQuantityStr] = useState('');
  const [limitPriceStr, setLimitPriceStr] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);

  const qty = parseFloat(quantityStr) || 0;
  const limitPrice = parseFloat(limitPriceStr) || 0;
  const displayPrice = orderType === 'Market' ? (coin?.price || 0) : limitPrice;
  const estimatedTotal = displayPrice * qty;
  const actionColor = action === 'BUY' ? '#00E676' : '#FF5252';
  const gradientColors = action === 'BUY' ? GRADIENTS.primary : GRADIENTS.secondary;

  const canPlace = qty > 0 && (orderType === 'Market' || limitPrice > 0);

  useEffect(() => {
    if (visible) {
      RNAnimated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 9,
      }).start();
      // Reset form
      setOrderType('Market');
      setQuantityStr('');
      setLimitPriceStr('');
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, coin, slideAnim]);

  const placeOrder = useCallback(async () => {
    if (!coin || !canPlace) return;
    setIsPlacing(true);
    try {
      const result = await snapTradeApi.placeOrder({
        symbol: coin.symbol.toUpperCase(),
        action,
        orderType,
        quantity: qty,
        ...(limitPrice > 0 && orderType !== 'Market' && { price: limitPrice }),
        timeInForce: 'Day',
      });
      Alert.alert(
        action === 'BUY' ? 'Buy Order Placed' : 'Sell Order Placed',
        `Order ID: ${result.orderId.substring(0, 12)}...\nStatus: ${result.status}`,
        [{ text: 'OK', onPress: onClose }],
      );
    } catch (err: any) {
      Alert.alert('Order Failed', err?.message || 'Failed to place order');
    } finally {
      setIsPlacing(false);
    }
  }, [coin, action, orderType, qty, limitPrice, canPlace, onClose]);

  const overlayOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <RNAnimated.View style={[styles.modalBg, { opacity: overlayOpacity }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </RNAnimated.View>
        <RNAnimated.View
          style={[
            styles.modalContent,
            { paddingBottom: insets.bottom + 20, transform: [{ translateY }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
              <View style={[styles.modalCoinIcon, { backgroundColor: (coin?.color || '#6C63FF') + '20' }]}>
                <Text style={[styles.modalCoinIconText, { color: coin?.color || '#6C63FF' }]}>
                  {coin?.name?.charAt(0) || '?'}
                </Text>
              </View>
              <View>
                <Text style={[styles.modalCoinName, { color: colors.text }]}>{coin?.name || ''}</Text>
                <Text style={[styles.modalCoinSymbol, { color: colors.textMuted }]}>
                  {coin?.symbol?.toUpperCase() || ''} · ${formatPrice(coin?.price || 0)}
                </Text>
              </View>
            </View>
            <View style={[styles.modalActionBadge, { backgroundColor: actionColor + '20' }]}>
              <Text style={[styles.modalActionText, { color: actionColor }]}>{action}</Text>
            </View>
          </View>

          {/* Order Type */}
          <View style={styles.modalField}>
            <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>Order Type</Text>
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
                    {ot === 'StopLoss' ? 'Stop Loss' : ot}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Quantity */}
          <View style={styles.modalField}>
            <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>Quantity</Text>
            <View style={[styles.modalInput, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <TextInput
                style={[styles.modalInputField, { color: colors.text }]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                value={quantityStr}
                onChangeText={setQuantityStr}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.modalInputSuffix, { color: colors.textMuted }]}>
                {coin?.symbol?.toUpperCase() || ''}
              </Text>
            </View>
            {/* Quick qty suggestions */}
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs }}>
              {[0.001, 0.01, 0.1, 1].map(q => (
                <Pressable
                  key={q}
                  style={[styles.qtyChip, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                  onPress={() => setQuantityStr(String(q))}
                >
                  <Text style={[styles.qtyChipText, { color: colors.textMuted }]}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Limit Price */}
          {orderType !== 'Market' && (
            <View style={styles.modalField}>
              <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>
                {orderType === 'StopLoss' ? 'Stop Price' : 'Limit Price'}
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
                <Text style={[styles.modalSummaryLabel, { color: colors.textMuted }]}>Estimated Total</Text>
                <Text style={[styles.modalSummaryValue, { color: colors.text }]}>
                  ${estimatedTotal.toFixed(2)}
                </Text>
              </View>
              <View style={styles.modalSummaryRow}>
                <Text style={[styles.modalSummaryLabel, { color: colors.textMuted }]}>Price per {coin?.symbol?.toUpperCase()}</Text>
                <Text style={[styles.modalSummaryValue, { color: colors.text }]}>
                  ${displayPrice.toFixed(2)}
                </Text>
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
                  {action} {coin?.symbol?.toUpperCase() || ''}
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

export default function CryptoTradingScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [coins, setCoins] = useState<CryptoAssetData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'market' | 'portfolio' | 'orders'>('market');

  // Holdings & Orders
  const [holdings, setHoldings] = useState<CryptoHolding[]>([]);
  const [orders, setOrders] = useState<CryptoOrder[]>([]);
  const [isBrokerConnected, setIsBrokerConnected] = useState(false);

  // Trade Modal
  const [tradeModalVisible, setTradeModalVisible] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<CryptoAssetData | null>(null);
  const [tradeAction, setTradeAction] = useState<TradeAction>('BUY');

  // Fetch data
  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      // Fetch crypto market data
      const marketData = await globalMarketsApi.getCrypto();
      setCoins(marketData || []);

      // Check broker status
      try {
        const status = await snapTradeApi.status();
        setIsBrokerConnected(status.connected);

        if (status.connected) {
          // Fetch holdings
          const holdingsResult = await snapTradeApi.getHoldings();
          if (holdingsResult?.data) {
            // Filter crypto-like holdings
            const cryptoHoldings = holdingsResult.data
              .filter(h => CRYPTO_SYMBOLS_SET.has(h.symbol))
              .map(h => ({
                symbol: h.symbol,
                name: h.name || h.symbol,
                quantity: h.quantity,
                price: h.price,
                avgCost: h.avgCost,
                pnl: h.pnl,
                pnlPercent: h.pnlPercent,
              }));
            setHoldings(cryptoHoldings);
          }

          // Fetch orders via the existing orders endpoint
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
            // Orders endpoint may fail — show empty state
          }
        }
      } catch {
        // Broker not connected — show market data only
      }
    } catch {
      // Use cached/mock data
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

  // Filter coins by search
  const filteredCoins = useMemo(() => {
    if (!searchQuery.trim()) return coins;
    const q = searchQuery.toLowerCase();
    return coins.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q),
    );
  }, [coins, searchQuery]);

  // Open trade modal
  const openTrade = useCallback((coin: CryptoAssetData, action: TradeAction) => {
    setSelectedCoin(coin);
    setTradeAction(action);
    setTradeModalVisible(true);
  }, []);

  // Navigate to detail
  const goToDetail = useCallback((coin: CryptoAssetData) => {
    navigation.navigate('CryptoDetail', {
      coinId: coin.id,
      coinSymbol: coin.symbol,
      coinName: coin.name,
    });
  }, [navigation]);

  // ── TABS ──────────────────────────────────────────────────────
  const tabs: { key: typeof selectedTab; label: string; icon: string }[] = [
    { key: 'market', label: 'Market', icon: 'trending-up' },
    { key: 'portfolio', label: 'Portfolio', icon: 'wallet' },
    { key: 'orders', label: 'Orders', icon: 'receipt' },
  ];

  // ── Render ────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <LinearGradient
        colors={['#1a1a2e', colors.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: 50 + insets.top }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Crypto Trading</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {coins.length} coins · {isBrokerConnected ? 'Broker Connected' : 'View Only'}
            </Text>
          </View>
          {!isBrokerConnected && (
            <Pressable
              onPress={() => navigation.navigate('BrokerConnect')}
              style={[styles.connectBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}
            >
              <Ionicons name="link" size={16} color={colors.primary} />
              <Text style={[styles.connectText, { color: colors.primary }]}>Connect</Text>
            </Pressable>
          )}
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search crypto..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
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
                <Ionicons
                  name={tab.icon as any}
                  size={16}
                  color={isActive ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.tabText, { color: isActive ? colors.primary : colors.textMuted }]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading crypto markets...</Text>
          </View>
        ) : (
          <>
            {/* ── MARKET TAB ── */}
            {selectedTab === 'market' && (
              <>
                {/* Stats Banner */}
                <View style={[styles.statsBanner, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>Market Cap</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      ${formatLargeNumber(coins.reduce((s, c) => s + (c.marketCap ? parseFloat(c.marketCap.replace(/[^0-9.]/g, '')) * (c.marketCap.includes('T') ? 1e12 : c.marketCap.includes('B') ? 1e9 : 1e6) : 0), 0))}
                    </Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>24h Volume</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      ${formatLargeNumber(coins.reduce((s, c) => s + (c.volume24h ? parseFloat(c.volume24h.replace(/[^0-9.]/g, '')) * (c.volume24h.includes('T') ? 1e12 : c.volume24h.includes('B') ? 1e9 : 1e6) : 0), 0))}
                    </Text>
                  </View>
                </View>

                {/* Coin List */}
                {filteredCoins.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <Ionicons name="search" size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>No coins found</Text>
                  </View>
                ) : (
                  <View style={{ gap: SPACING.sm }}>
                    {filteredCoins.map((coin, i) => (
                      <CoinCard
                        key={coin.id}
                        coin={coin}
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
                    <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: SPACING.md }]}>
                      Connect your broker to see crypto holdings
                    </Text>
                    <Pressable
                      onPress={() => navigation.navigate('BrokerConnect')}
                      style={[styles.connectNowBtn, { backgroundColor: colors.primary }]}
                    >
                      <Text style={styles.connectNowText}>Connect Broker</Text>
                    </Pressable>
                  </View>
                ) : holdings.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <Ionicons name="leaf-outline" size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: SPACING.md }]}>
                      No crypto holdings found
                    </Text>
                    <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                      Buy crypto to see your portfolio here
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.portfolioTitle, { color: colors.text }]}>Crypto Holdings</Text>
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
                      Connect broker to view orders
                    </Text>
                  </View>
                ) : orders.length === 0 ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.textMuted, marginTop: SPACING.md }]}>
                      No orders yet
                    </Text>
                    <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                      Your crypto orders will appear here
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.portfolioTitle, { color: colors.text }]}>Recent Orders</Text>
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
                Cryptocurrency trading is highly volatile. Prices can move rapidly. 
                {isBrokerConnected ? ' Orders are placed through your connected broker via SnapTrade.' : ' Connect a broker to start trading.'}
              </Text>
            </View>

            <View style={{ height: 80 }} />
          </>
        )}
      </ScrollView>

      {/* Trade Modal */}
      <TradeModal
        visible={tradeModalVisible}
        onClose={() => setTradeModalVisible(false)}
        coin={selectedCoin}
        action={tradeAction}
      />
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  backBtn: { padding: 4 },
  title: { ...FONTS.bold, fontSize: FONTS.size.title },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2 },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  connectText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.sm : SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  searchInput: { flex: 1, ...FONTS.regular, fontSize: FONTS.size.sm, padding: 0 },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // Content
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },

  // Stats Banner
  statsBanner: {
    flexDirection: 'row',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  statValue: { ...FONTS.bold, fontSize: FONTS.size.sm, marginTop: 2 },
  statDivider: { width: 1, height: '100%', marginHorizontal: SPACING.md },

  // Coin Card
  coinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
  },
  coinIcon: {
    width: COIN_ICON_SIZE,
    height: COIN_ICON_SIZE,
    borderRadius: COIN_ICON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinIconText: { ...FONTS.bold, fontSize: 16 },
  coinInfo: { flex: 1 },
  coinName: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  coinSymbol: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  coinPriceContainer: { alignItems: 'flex-end', marginRight: SPACING.sm },
  coinPrice: { ...FONTS.bold, fontSize: FONTS.size.sm, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  coinChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginTop: 2,
  },
  coinChangeText: { ...FONTS.semiBold, fontSize: 9 },
  coinActions: { flexDirection: 'column', gap: 4 },
  coinActionBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,            borderRadius: BORDER_RADIUS_SM,
    alignItems: 'center',
    minWidth: 40,
  },
  coinActionText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // Portfolio
  portfolioCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  portfolioTitle: { ...FONTS.bold, fontSize: FONTS.size.md, marginBottom: SPACING.md },
  holdingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
  },
  holdingSymbol: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  holdingName: { ...FONTS.regular, fontSize: FONTS.size.xs },
  holdingQty: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: FONTS.size.sm, fontWeight: '600' },
  holdingValue: { ...FONTS.regular, fontSize: FONTS.size.xs },
  holdingPnl: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: FONTS.size.sm, fontWeight: '700' },
  holdingPnlPct: { ...FONTS.regular, fontSize: FONTS.size.xs },

  // Orders
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
  },
  orderActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
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
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.lg,
  },
  connectNowText: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: '#fff' },

  // Loading
  loadingText: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: SPACING.md },

  // Info
  infoCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  infoText: { ...FONTS.regular, fontSize: FONTS.size.xs, flex: 1, lineHeight: 16 },

  // ── Trade Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  modalContent: {
    backgroundColor: '#161922',
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    paddingTop: SPACING.md,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  modalCoinIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCoinIconText: { ...FONTS.bold, fontSize: 18 },
  modalCoinName: { ...FONTS.bold, fontSize: FONTS.size.md },
  modalCoinSymbol: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  modalActionBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  modalActionText: { ...FONTS.bold, fontSize: FONTS.size.sm, letterSpacing: 0.5 },

  // Modal Fields
  modalField: { marginTop: SPACING.lg },
  modalFieldLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, marginBottom: SPACING.sm },
  modalInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  modalInputField: { flex: 1, ...FONTS.bold, fontSize: FONTS.size.xl, padding: 0 },
  modalInputPrefix: { ...FONTS.semiBold, fontSize: FONTS.size.xl, marginRight: 4 },
  modalInputSuffix: { ...FONTS.medium, fontSize: FONTS.size.sm },
  qtyChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  qtyChipText: { ...FONTS.medium, fontSize: FONTS.size.xs },
  modalChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  modalChipText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

  // Modal Summary
  modalSummary: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSummaryLabel: { ...FONTS.regular, fontSize: FONTS.size.sm },
  modalSummaryValue: { ...FONTS.bold, fontSize: FONTS.size.sm },

  // Modal Action
  modalActionBtn: {
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  modalActionBtnText: { ...FONTS.bold, fontSize: FONTS.size.lg, color: '#fff' },
});
