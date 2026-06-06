import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { usePortfolioStore } from '../../store/portfolioStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency, formatTimeAgo } from '../../utils/formatters';
import Button from '../../components/ui/Button';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { OpenOrder } from '../../types';

const { width } = Dimensions.get('window');

const STATUS_COLORS: Record<string, string> = {
  open: '#FFC107',
  pending: '#6C63FF',
  partially_filled: '#00D2FF',
  trigger_pending: '#FF6B6B',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  pending: 'Pending',
  partially_filled: 'Partial Fill',
  trigger_pending: 'Trigger Pending',
};

export default function OpenOrdersScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { openOrders, ordersLoading, fetchOpenOrders, modifyOrder, cancelOrder } = usePortfolioStore();
  const [selectedOrder, setSelectedOrder] = useState<OpenOrder | null>(null);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [modifyPrice, setModifyPrice] = useState('');
  const [modifyQty, setModifyQty] = useState('');
  const [modifyOrderType, setModifyOrderType] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchOpenOrders();
  }, [fetchOpenOrders]);

  // Filter by status
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return openOrders;
    return openOrders.filter(o => o.status === statusFilter);
  }, [openOrders, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: openOrders.length };
    openOrders.forEach(o => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return counts;
  }, [openOrders]);

  const handleCancelOrder = useCallback((order: OpenOrder) => {
    Alert.alert(
      'Cancel Order',
      `Are you sure you want to cancel the ${order.transactionType} order for ${order.quantity} ${order.symbol} at ₹${order.price}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            const success = await cancelOrder(order.id);
            setIsProcessing(false);
            if (success) {
              Alert.alert('Cancelled', `Order for ${order.symbol} has been cancelled.`);
            }
          },
        },
      ]
    );
  }, [cancelOrder]);

  const handleModifyOpen = useCallback((order: OpenOrder) => {
    setSelectedOrder(order);
    setModifyPrice(String(order.price));
    setModifyQty(String(order.quantity));
    setModifyOrderType(order.orderType);
    setShowModifyModal(true);
  }, []);

  const handleModifySubmit = useCallback(async () => {
    if (!selectedOrder) return;
    const newPrice = parseFloat(modifyPrice);
    const newQty = parseInt(modifyQty, 10);
    if (isNaN(newPrice) || newPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }
    if (isNaN(newQty) || newQty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
      return;
    }

    setIsProcessing(true);
    const success = await modifyOrder(selectedOrder.id, {
      price: newPrice,
      quantity: newQty,
      orderType: modifyOrderType || selectedOrder.orderType,
    });
    setIsProcessing(false);

    if (success) {
      Alert.alert('Modified', `Order for ${selectedOrder.symbol} has been updated.`);
      setShowModifyModal(false);
      setSelectedOrder(null);
    }
  }, [selectedOrder, modifyPrice, modifyQty, modifyOrderType, modifyOrder]);

  const handleViewStock = useCallback((symbol: string) => {
    navigation.navigate('StockDetail', { symbol });
  }, [navigation]);

  const totalBuyValue = openOrders
    .filter(o => o.transactionType === 'BUY')
    .reduce((s, o) => s + o.price * (o.quantity - o.filledQuantity), 0);
  const totalSellValue = openOrders
    .filter(o => o.transactionType === 'SELL')
    .reduce((s, o) => s + o.price * (o.quantity - o.filledQuantity), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Open Orders</Text>
          <Text style={styles.subtitle}>{openOrders.length} active orders</Text>
        </View>
        <TouchableOpacity onPress={fetchOpenOrders} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statCard}>
          <Text style={styles.statCardLabel}>Buy Orders</Text>
          <Text style={styles.statCardValue}>{formatCurrency(totalBuyValue, true)}</Text>
          <Text style={styles.statCardSub}>{openOrders.filter(o => o.transactionType === 'BUY').length} orders</Text>
        </LinearGradient>
        <LinearGradient colors={GRADIENTS.secondary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statCard}>
          <Text style={styles.statCardLabel}>Sell Orders</Text>
          <Text style={styles.statCardValue}>{formatCurrency(totalSellValue, true)}</Text>
          <Text style={styles.statCardSub}>{openOrders.filter(o => o.transactionType === 'SELL').length} orders</Text>
        </LinearGradient>
      </View>

      {/* Status Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {['all', 'open', 'pending', 'partially_filled', 'trigger_pending'].map(status => (
          <TouchableOpacity
            key={status}
            style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
            onPress={() => setStatusFilter(status)}
          >
            <View style={[styles.filterDot, {
              backgroundColor: status === 'all' ? colors.primary : (STATUS_COLORS[status] || colors.textMuted),
              opacity: statusFilter === status ? 1 : 0.5,
            }]} />
            <Text style={[styles.filterText, statusFilter === status && styles.filterTextActive]}>
              {status === 'all' ? 'All' : STATUS_LABELS[status] || status}
            </Text>
            {statusCounts[status] > 0 && (
              <View style={[styles.filterCount, {
                backgroundColor: statusFilter === status ? colors.primary + '30' : colors.bgCardLight,
              }]}>
                <Text style={[styles.filterCountText, {
                  color: statusFilter === status ? colors.primary : colors.textMuted,
                }]}>{statusCounts[status]}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Open Orders List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={ordersLoading}
            onRefresh={fetchOpenOrders}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.bgSecondary}
          />
        }
      >
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order, idx) => (
            <AnimatedPressable
              key={order.id}
              onPress={() => handleViewStock(order.symbol)}
              scaleTo={0.98}
            >
              <View style={styles.orderCard}>
                {/* Order Header */}
                <View style={styles.orderHeader}>
                  <View style={styles.orderSymbolRow}>
                    <Text style={styles.orderSymbol}>{order.symbol}</Text>
                    <View style={[styles.orderTypeBadge, {
                      backgroundColor: order.transactionType === 'BUY' ? '#00C85320' : '#FF174420',
                    }]}>
                      <Ionicons
                        name={order.transactionType === 'BUY' ? 'arrow-down' : 'arrow-up'}
                        size={12}
                        color={order.transactionType === 'BUY' ? '#00C853' : '#FF1744'}
                      />
                      <Text style={[styles.orderTypeText, {
                        color: order.transactionType === 'BUY' ? '#00C853' : '#FF1744',
                      }]}>
                        {order.transactionType}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, {
                    backgroundColor: (STATUS_COLORS[order.status] || colors.textMuted) + '20',
                  }]}>
                    <Text style={[styles.statusText, {
                      color: STATUS_COLORS[order.status] || colors.textMuted,
                    }]}>
                      {STATUS_LABELS[order.status] || order.status}
                    </Text>
                  </View>
                </View>

                {/* Order Details */}
                <View style={styles.orderDetails}>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Qty</Text>
                    <Text style={styles.detailValue}>
                      {order.filledQuantity > 0
                        ? `${order.filledQuantity}/${order.quantity}`
                        : String(order.quantity)}
                    </Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>
                      {order.orderType === 'MARKET' ? 'Market' : 'Limit'} Price
                    </Text>
                    <Text style={styles.detailValue}>₹{order.price.toFixed(2)}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text style={styles.detailValue}>{order.orderType} · {order.productType}</Text>
                  </View>
                  <View style={styles.detailCol}>
                    <Text style={styles.detailLabel}>Value</Text>
                    <Text style={styles.detailValue}>
                      {formatCurrency(order.price * (order.quantity - order.filledQuantity))}
                    </Text>
                  </View>
                </View>

                {/* Trigger Price (if SL order) */}
                {order.triggerPrice && (
                  <View style={styles.triggerRow}>
                    <Ionicons name="flag-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.triggerText}>
                      Trigger: ₹{order.triggerPrice.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Progress Bar for partially filled */}
                {order.filledQuantity > 0 && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBg}>
                      <View style={[styles.progressFill, {
                        width: `${(order.filledQuantity / order.quantity) * 100}%`,
                        backgroundColor: STATUS_COLORS[order.status] || colors.primary,
                      }]} />
                    </View>
                    <Text style={styles.progressText}>
                      {Math.round((order.filledQuantity / order.quantity) * 100)}% filled
                    </Text>
                  </View>
                )}

                {/* Order Footer */}
                <View style={styles.orderFooter}>
                  <Text style={styles.timestamp}>{formatTimeAgo(order.timestamp)}</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.modifyBtn]}
                      onPress={() => handleModifyOpen(order)}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.primary} />
                      <Text style={styles.modifyBtnText}>Modify</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.cancelBtn]}
                      onPress={() => handleCancelOrder(order)}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </AnimatedPressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Open Orders</Text>
            <Text style={styles.emptySubtitle}>
              Place a limit order to see it here, or pull down to refresh
            </Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modify Order Modal */}
      {showModifyModal && selectedOrder && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modify Order</Text>
              <TouchableOpacity onPress={() => { setShowModifyModal(false); setSelectedOrder(null); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalStockInfo}>
              <View style={[styles.modalTypeBadge, {
                backgroundColor: selectedOrder.transactionType === 'BUY' ? '#00C85320' : '#FF174420',
              }]}>
                <Ionicons
                  name={selectedOrder.transactionType === 'BUY' ? 'arrow-down' : 'arrow-up'}
                  size={16}
                  color={selectedOrder.transactionType === 'BUY' ? '#00C853' : '#FF1744'}
                />
                <Text style={[styles.modalTypeText, {
                  color: selectedOrder.transactionType === 'BUY' ? '#00C853' : '#FF1744',
                }]}>
                  {selectedOrder.transactionType}
                </Text>
              </View>
              <Text style={styles.modalStockSymbol}>{selectedOrder.symbol}</Text>
              <Text style={styles.modalStockExchange}>{selectedOrder.exchange} · {selectedOrder.productType}</Text>
            </View>

            {/* Price Input */}
            <Text style={styles.modalLabel}>Price (₹)</Text>
            <TextInput
              style={styles.modalInput}
              value={modifyPrice}
              onChangeText={setModifyPrice}
              keyboardType="decimal-pad"
              placeholder="Enter new price"
              placeholderTextColor={colors.textMuted}
            />

            {/* Quantity Input */}
            <Text style={styles.modalLabel}>Quantity</Text>
            <TextInput
              style={styles.modalInput}
              value={modifyQty}
              onChangeText={setModifyQty}
              keyboardType="number-pad"
              placeholder="Enter new quantity"
              placeholderTextColor={colors.textMuted}
            />

            {/* Order Type Selector */}
            <Text style={styles.modalLabel}>Order Type</Text>
            <View style={styles.modalChipRow}>
              {['LIMIT', 'MARKET', 'SL', 'SL-M'].map(ot => (
                <TouchableOpacity
                  key={ot}
                  style={[styles.modalChip, modifyOrderType === ot && styles.modalChipActive]}
                  onPress={() => setModifyOrderType(ot)}
                >
                  <Text style={[styles.modalChipText, modifyOrderType === ot && styles.modalChipTextActive]}>
                    {ot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => { setShowModifyModal(false); setSelectedOrder(null); }}
                variant="secondary"
                size="medium"
                style={{ flex: 1 }}
              />
              <Button
                title={isProcessing ? 'Updating...' : 'Update Order'}
                onPress={handleModifySubmit}
                variant="primary"
                size="medium"
                disabled={isProcessing}
                loading={isProcessing}
                style={{ flex: 1 }}
              />
            </View>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  statCardLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  statCardValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.white,
    marginTop: 4,
  },
  statCardSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  filterRow: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  filterText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.text,
  },
  filterCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  filterCountText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  orderSymbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  orderSymbol: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  orderTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  orderTypeText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  orderDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  detailCol: {
    flex: 1,
    minWidth: 70,
  },
  detailLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.sm,
  },
  triggerText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  progressBg: {
    flex: 1,
    height: 4,
    backgroundColor: colors.bgInput,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    minWidth: 60,
    textAlign: 'right',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  timestamp: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  modifyBtn: {
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '10',
  },
  modifyBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.primary,
  },
  cancelBtn: {
    borderColor: colors.danger + '40',
    backgroundColor: colors.danger + '10',
  },
  cancelBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.danger,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: SPACING.sm,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },

  // ── Modify Modal ──
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  modalTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
  },
  modalStockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
    padding: SPACING.md,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
  },
  modalTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  modalTypeText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  modalStockSymbol: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    flex: 1,
  },
  modalStockExchange: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  modalLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
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
  modalChipRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  modalChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalChipActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  modalChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  modalChipTextActive: {
    color: colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
});
