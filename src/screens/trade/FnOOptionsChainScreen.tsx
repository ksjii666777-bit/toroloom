/**
 * ============================================================================
 * Toroloom — F&O Options Chain Screen
 * ============================================================================
 *
 * Interactive options chain viewer with:
 *   - Expiry selector (weekly / monthly)
 *   - Strike-wise CE/PE chain with Greeks, OI, Volume
 *   - Futures contracts view
 *   - Open positions view
 *   - Quick order placement from chain
 *
 * ============================================================================
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useFnoStore, ChainSide } from '../../store/fnoStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency, formatCompactNumber } from '../../utils/formatters';
import { SkeletonBlock } from '../../components/ui/SkeletonLoader';
import type { FutureContract, FnOPosition, OptionChainRow } from '../../types';

const _width = Dimensions.get('window');

const POPULAR_SYMBOLS = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'HDFCBANK', 'INFY', 'TCS', 'SBIN', 'TATAMOTORS'];

export default function FnOOptionsChainScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    selectedSymbol,
    selectedExpiry,
    expiries,
    optionChain,
    futures,
    positions,
    view,
    chainSide,
    chainLoading,
    futuresLoading,
    positionsLoading,
    spotPrices,
    setSelectedSymbol,
    setSelectedExpiry,
    setView,
    setChainSide,
    fetchExpiries,
    fetchOptionChain,
    fetchFutures,
    fetchPositions,
    fetchSpotPrices,
    openOrderModal,
    closeOrderModal,
    selectedContract,
    orderType,
    orderQuantity,
    showOrderModal,
    setOrderQuantity,
    placeOrder,
  } = useFnoStore();

  const [refreshing, setRefreshing] = useState(false);
  const [, setShowSymbolPicker] = useState(false);
  const [, setShowExpiryPicker] = useState(false);
  const [showGreeks, setShowGreeks] = useState(false);
  const [highlightATM] = useState(true);

  useEffect(() => {
    fetchExpiries(selectedSymbol);
    fetchSpotPrices();
    fetchPositions();
  }, [fetchExpiries, fetchPositions, fetchSpotPrices, selectedSymbol]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchExpiries(selectedSymbol),
      fetchOptionChain(selectedSymbol, selectedExpiry?.date),
      fetchFutures(selectedSymbol),
      fetchPositions(),
    ]);
    setRefreshing(false);
  }, [selectedSymbol, selectedExpiry, fetchExpiries, fetchFutures, fetchOptionChain, fetchPositions]);

  const handleSymbolChange = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    setShowSymbolPicker(false);
  }, [setSelectedSymbol]);

  const handleExpiryChange = useCallback((expiry: typeof expiries[0]) => {
    setSelectedExpiry(expiry);
    setShowExpiryPicker(false);
  }, [setSelectedExpiry]);

  const spotPrice = (optionChain?.spotPrice || spotPrices[selectedSymbol] || 0);

  const isPositive = optionChain ? optionChain.pcr < 1 : true;

  // === Render Option Chain ===
  const renderOptionChain = () => {
    if (chainLoading) {
      return (
        <View style={styles.loadingContainer}>
          {[1, 2, 3, 4, 5].map(i => (
            <SkeletonBlock key={i} width="100%" height={44} borderRadius={8} style={{ marginBottom: 6 }} />
          ))}
        </View>
      );
    }

    if (!optionChain || optionChain.rows.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="options-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Data</Text>
          <Text style={styles.emptySubtitle}>Select a symbol and expiry to view the option chain</Text>
        </View>
      );
    }

    const rows = chainSide === 'PE'
      ? optionChain.rows
      : chainSide === 'CE'
        ? optionChain.rows
        : optionChain.rows;

    return (
      <>
        {/* Chain Header */}
        <View style={styles.chainHeader}>
          <View style={styles.chainHeaderCe}>
            {chainSide !== 'PE' && (
              <Text style={[styles.chainHeaderText, { color: colors.marketUp }]}>
                CALLS (CE)
              </Text>
            )}
          </View>
          <View style={styles.chainHeaderStrike}>
            <Text style={[styles.chainHeaderStrikeText, { color: colors.text }]}>Strike</Text>
          </View>
          <View style={styles.chainHeaderPe}>
            {chainSide !== 'CE' && (
              <Text style={[styles.chainHeaderText, { color: colors.marketDown }]}>
                PUTS (PE)
              </Text>
            )}
          </View>
        </View>

        {/* Chain Rows */}
        {rows.map((row: OptionChainRow) => {
          const isATM = Math.abs(row.strike - spotPrice) / spotPrice < 0.01;
          const isHighlighted = highlightATM && isATM;

          return (
            <Pressable
              key={row.strike}
              style={({pressed}) => [[
                styles.chainRow,
                isHighlighted && {
                  backgroundColor: colors.primary + '10',
                  borderColor: colors.primary + '30',
                  borderWidth: 1,
                },
              ], {opacity: pressed ? 0.7 : 1}]}
            >
              {/* CE Side */}
              {chainSide !== 'PE' && row.ce && (
                <Pressable
                  style={styles.contractCell}
                  onPress={() => openOrderModal(row.ce!, 'buy')}
                >
                  {showGreeks ? (
                    <View style={styles.greeksRow}>
                      <Text style={[styles.greekText, { color: colors.textSecondary }]}>
                        δ{row.ce.delta.toFixed(2)} γ{row.ce.gamma.toFixed(4)}
                      </Text>
                      <Text style={[styles.greekText, { color: colors.textMuted }]}>
                        θ{row.ce.theta.toFixed(2)} IV{row.ce.iv.toFixed(0)}%
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={[
                        styles.contractLtp,
                        { color: row.ce.change >= 0 ? colors.marketUp : colors.marketDown },
                      ]}>
                        {formatCurrency(row.ce.ltp, true)}
                      </Text>
                      <View style={styles.contractMeta}>
                        <Text style={[styles.oiText, { color: colors.textMuted }]}>
                          OI {formatCompactNumber(row.ce.openInterest)}
                        </Text>
                        <Text style={[styles.volumeText, { color: colors.textMuted }]}>
                          Vol {formatCompactNumber(row.ce.volume)}
                        </Text>
                      </View>
                    </>
                  )}
                </Pressable>
              )}

              {/* Strike */}
              <View style={styles.strikeCell}>
                <Text style={[
                  styles.strikeText,
                  { color: isATM ? colors.primary : colors.text },
                  isATM && styles.atmText,
                ]}>
                  {row.strike}
                </Text>
                {isATM && (
                  <View style={[styles.atmBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.atmBadgeText, { color: colors.primary }]}>ATM</Text>
                  </View>
                )}
              </View>

              {/* PE Side */}
              {chainSide !== 'CE' && row.pe && (
                <Pressable
                  style={styles.contractCell}
                  onPress={() => openOrderModal(row.pe!, 'buy')}
                >
                  {showGreeks ? (
                    <View style={styles.greeksRow}>
                      <Text style={[styles.greekText, { color: colors.textSecondary }]}>
                        δ{row.pe.delta.toFixed(2)} γ{row.pe.gamma.toFixed(4)}
                      </Text>
                      <Text style={[styles.greekText, { color: colors.textMuted }]}>
                        θ{row.pe.theta.toFixed(2)} IV{row.pe.iv.toFixed(0)}%
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={[
                        styles.contractLtp,
                        { color: row.pe.change >= 0 ? colors.marketUp : colors.marketDown },
                      ]}>
                        {formatCurrency(row.pe.ltp, true)}
                      </Text>
                      <View style={styles.contractMeta}>
                        <Text style={[styles.oiText, { color: colors.textMuted }]}>
                          OI {formatCompactNumber(row.pe.openInterest)}
                        </Text>
                        <Text style={[styles.volumeText, { color: colors.textMuted }]}>
                          Vol {formatCompactNumber(row.pe.volume)}
                        </Text>
                      </View>
                    </>
                  )}
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </>
    );
  };

  // === Render Futures ===
  const renderFutures = () => {
    if (futuresLoading) {
      return (
        <View style={styles.loadingContainer}>
          {[1, 2, 3].map(i => (
            <SkeletonBlock key={i} width="100%" height={64} borderRadius={8} style={{ marginBottom: 8 }} />
          ))}
        </View>
      );
    }

    if (futures.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="trending-up-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Futures Contracts</Text>
          <Text style={styles.emptySubtitle}>Select a symbol to view futures data</Text>
        </View>
      );
    }

    return (
      <>
        <View style={styles.futuresHeader}>
          <Text style={[styles.futuresHeaderText, { color: colors.textMuted }]}>Contract</Text>
          <Text style={[styles.futuresHeaderText, { color: colors.textMuted }]}>LTP</Text>
          <Text style={[styles.futuresHeaderText, { color: colors.textMuted }]}>OI</Text>
          <Text style={[styles.futuresHeaderText, { color: colors.textMuted }]}>Basis</Text>
        </View>
        {futures.map((f: FutureContract) => {
          const days = Math.ceil((new Date(f.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return (
            <Pressable
              key={f.symbol}
              style={({pressed}) => [[styles.futuresCard, { borderColor: colors.border }], {opacity: pressed ? 0.7 : 1}]}
              onPress={() => {
                Alert.alert(
                  'Trade Futures',
                  `${f.symbol}\nLTP: ₹${f.price.toFixed(2)} | Lot: ${f.lotSize}\nExpiry: ${new Date(f.expiryDate).toLocaleDateString('en-IN')} (${days}d)`,
                );
              }}
            >
              <View style={styles.futuresLeft}>
                <Text style={[styles.futuresSymbol, { color: colors.text }]}>
                  {selectedSymbol}
                </Text>
                <Text style={[styles.futuresExpiry, { color: colors.textMuted }]}>
                  {new Date(f.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {' · Lot '}{f.lotSize}
                </Text>
              </View>
              <View style={styles.futuresPrice}>
                <Text style={[styles.futuresLtp, { color: colors.text }]}>
                  {formatCurrency(f.price, true)}
                </Text>
                <Text style={[styles.futuresChange, {
                  color: f.changePercent >= 0 ? colors.marketUp : colors.marketDown,
                }]}>
                  {f.changePercent >= 0 ? '+' : ''}{f.changePercent.toFixed(2)}%
                </Text>
              </View>
              <View style={styles.futuresOi}>
                <Text style={[styles.futuresOiValue, { color: colors.text }]}>
                  {formatCompactNumber(f.openInterest)}
                </Text>
                <Text style={[styles.futuresOiLabel, { color: colors.textMuted }]}>OI</Text>
              </View>
              <View style={styles.futuresBasis}>
                <Text style={[styles.futuresBasisValue, {
                  color: f.basis >= 0 ? colors.marketUp : colors.marketDown,
                }]}>
                  {f.basis >= 0 ? '+' : ''}{formatCurrency(f.basis, true)}
                </Text>
                <Text style={[styles.futuresBasisPct, { color: colors.textMuted }]}>
                  {f.basisPercent.toFixed(2)}%
                </Text>
              </View>
            </Pressable>
          );
        })}
      </>
    );
  };

  // === Render Positions ===
  const renderPositions = () => {
    if (positionsLoading) {
      return (
        <View style={styles.loadingContainer}>
          {[1, 2, 3].map(i => (
            <SkeletonBlock key={i} width="100%" height={80} borderRadius={8} style={{ marginBottom: 8 }} />
          ))}
        </View>
      );
    }

    if (positions.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No F&O Positions</Text>
          <Text style={styles.emptySubtitle}>Your open futures and options positions will appear here</Text>
        </View>
      );
    }

    return (
      <>
        {positions.map((pos: FnOPosition) => {
          const isLong = pos.action === 'buy';
          const isPositive = pos.pnl >= 0;
          const isFuture = pos.type === 'FUTURE';

          return (
            <Pressable
              key={pos.id}
              style={({pressed}) => [[styles.positionCard, { borderColor: colors.border }], {opacity: pressed ? 0.7 : 1}]}
              onPress={() => navigation.navigate('StrategyBuilder', {
                symbol: pos.symbol,
                type: pos.type,
                strike: pos.strike,
              })}
            >
              <View style={styles.positionHeader}>
                <View style={styles.positionLeft}>
                  <View style={[styles.positionTypeBadge, {
                    backgroundColor: isLong ? '#00C85320' : '#FF174420',
                  }]}>
                    <Ionicons
                      name={isLong ? 'arrow-up' : 'arrow-down'}
                      size={12}
                      color={isLong ? colors.marketUp : colors.marketDown}
                    />
                    <Text style={[styles.positionTypeText, {
                      color: isLong ? colors.marketUp : colors.marketDown,
                    }]}>
                      {isLong ? 'LONG' : 'SHORT'}
                    </Text>
                  </View>
                  <Text style={[styles.positionSymbol, { color: colors.text }]}>
                    {pos.symbol}
                    {pos.strike && ` ${pos.strike}`}
                    {!isFuture && (
                      <Text style={{ fontWeight: '400', fontSize: 12 }}>
                        {' '}{pos.type}
                      </Text>
                    )}
                  </Text>
                </View>
                <View style={[styles.pnlBadge, {
                  backgroundColor: isPositive ? '#00C85320' : '#FF174420',
                }]}>
                  <Text style={[styles.pnlText, {
                    color: isPositive ? colors.marketUp : colors.marketDown,
                  }]}>
                    {isPositive ? '+' : ''}{formatCurrency(pos.pnl, true)}
                  </Text>
                </View>
              </View>

              <View style={styles.positionDetails}>
                <View style={styles.positionDetail}>
                  <Text style={[styles.positionLabel, { color: colors.textMuted }]}>Qty</Text>
                  <Text style={[styles.positionValue, { color: colors.text }]}>
                    {pos.quantity} lot{pos.quantity > 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.positionDetail}>
                  <Text style={[styles.positionLabel, { color: colors.textMuted }]}>Entry</Text>
                  <Text style={[styles.positionValue, { color: colors.text }]}>
                    {formatCurrency(pos.entryPrice, true)}
                  </Text>
                </View>
                <View style={styles.positionDetail}>
                  <Text style={[styles.positionLabel, { color: colors.textMuted }]}>LTP</Text>
                  <Text style={[styles.positionValue, { color: colors.text }]}>
                    {formatCurrency(pos.currentPrice, true)}
                  </Text>
                </View>
                <View style={styles.positionDetail}>
                  <Text style={[styles.positionLabel, { color: colors.textMuted }]}>P&L%</Text>
                  <Text style={[styles.positionValue, {
                    color: isPositive ? colors.marketUp : colors.marketDown,
                  }]}>
                    {isPositive ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </>
    );
  };

  // === Order Modal ===
  const renderOrderModal = () => {
    if (!showOrderModal || !selectedContract) return null;
    const lotSize = selectedSymbol === 'BANKNIFTY' ? 25 : selectedSymbol === 'NIFTY' ? 50 : 1000;
    const totalPremium = selectedContract.ltp * orderQuantity * lotSize;

    return (
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.bgSecondary }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Place Order</Text>
            <Pressable onPress={closeOrderModal}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Contract Info */}
          <View style={[styles.modalContractInfo, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={[styles.modalTypeBadge, {
              backgroundColor: selectedContract.type === 'CE' ? '#00C85320' : '#FF174420',
            }]}>
              <Text style={[styles.modalTypeText, {
                color: selectedContract.type === 'CE' ? colors.marketUp : colors.marketDown,
              }]}>
                {selectedContract.type}
              </Text>
            </View>
            <View style={styles.modalContractDetails}>
              <Text style={[styles.modalContractSymbol, { color: colors.text }]}>
                {selectedSymbol} {selectedContract.strike}
              </Text>
              <Text style={[styles.modalContractMeta, { color: colors.textMuted }]}>
                LTP: {formatCurrency(selectedContract.ltp, true)}
                {' · '}Lot: {lotSize}
                {' · '}IV: {selectedContract.iv.toFixed(1)}%
              </Text>
            </View>
          </View>

          {/* Greeks Preview */}
          <View style={styles.greeksPreview}>
            <View style={styles.greekItem}>
              <Text style={[styles.greekLabel, { color: colors.textMuted }]}>Delta</Text>
              <Text style={[styles.greekValue, { color: colors.text }]}>{selectedContract.delta.toFixed(2)}</Text>
            </View>
            <View style={styles.greekItem}>
              <Text style={[styles.greekLabel, { color: colors.textMuted }]}>Gamma</Text>
              <Text style={[styles.greekValue, { color: colors.text }]}>{selectedContract.gamma.toFixed(4)}</Text>
            </View>
            <View style={styles.greekItem}>
              <Text style={[styles.greekLabel, { color: colors.textMuted }]}>Theta</Text>
              <Text style={[styles.greekValue, { color: colors.marketDown }]}>{selectedContract.theta.toFixed(2)}</Text>
            </View>
            <View style={styles.greekItem}>
              <Text style={[styles.greekLabel, { color: colors.textMuted }]}>Vega</Text>
              <Text style={[styles.greekValue, { color: colors.text }]}>{selectedContract.vega.toFixed(2)}</Text>
            </View>
          </View>

          {/* Quantity Selector */}
          <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Lots</Text>
          <View style={styles.qtySelector}>
            <Pressable
              style={[styles.qtyBtn, { borderColor: colors.border }]}
              onPress={() => setOrderQuantity(orderQuantity - 1)}
            >
              <Ionicons name="remove" size={20} color={colors.text} />
            </Pressable>
            <TextInput
              style={[styles.qtyInput, { color: colors.text, borderColor: colors.border }]}
              value={String(orderQuantity)}
              onChangeText={(v) => setOrderQuantity(parseInt(v) || 1)}
              keyboardType="number-pad"
              textAlign="center"
            />
            <Pressable
              style={[styles.qtyBtn, { borderColor: colors.border }]}
              onPress={() => setOrderQuantity(orderQuantity + 1)}
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Total Premium */}
          <View style={[styles.totalRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View>
              <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total Premium</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>{formatCurrency(totalPremium, true)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Per Unit</Text>
              <Text style={[styles.totalValue, { color: colors.textSecondary }]}>{formatCurrency(selectedContract.ltp, true)}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalActionBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={closeOrderModal}
            >
              <Text style={[styles.modalActionText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalActionBtn, {
                backgroundColor: orderType === 'buy' ? colors.marketUp : colors.marketDown,
              }]}
              onPress={() => {
                placeOrder();
                Alert.alert(
                  'Order Placed ✅',
                  `${orderType === 'buy' ? 'Bought' : 'Sold'} ${orderQuantity} lot(s) ${selectedSymbol} ${selectedContract.strike} ${selectedContract.type} @ ${formatCurrency(selectedContract.ltp, true)}`,
                );
                closeOrderModal();
              }}
            >
              <Ionicons
                name={orderType === 'buy' ? 'arrow-down' : 'arrow-up'}
                size={18}
                color={colors.white}
              />
              <Text style={[styles.modalActionText, { color: colors.white }]}>
                {orderType === 'buy' ? 'Buy' : 'Sell'} {orderQuantity} Lot{orderQuantity > 1 ? 's' : ''}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>F&O Trading</Text>
        <Pressable onPress={() => navigation.navigate('StrategyBuilder')} style={styles.strategyBtn}>
          <Ionicons name="git-branch" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {/* Symbol Selector */}
      <View style={styles.symbolRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.symbolContent}>
          {POPULAR_SYMBOLS.map(symbol => (
            <Pressable
              key={symbol}
              style={[
                styles.symbolChip,
                selectedSymbol === symbol && styles.symbolChipActive,
              ]}
              onPress={() => handleSymbolChange(symbol)}
            >
              <Text style={[
                styles.symbolChipText,
                { color: selectedSymbol === symbol ? colors.primary : colors.textSecondary },
                selectedSymbol === symbol && { fontWeight: '700' },
              ]}>
                {symbol}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Spot Price Banner */}
      {spotPrice > 0 && (
        <View style={[styles.spotBanner, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.spotLabel, { color: colors.textMuted }]}>{selectedSymbol} Spot</Text>
          <Text style={[styles.spotPriceText, { color: colors.text }]}>
            {formatCurrency(spotPrice, true)}
          </Text>
          {optionChain && (
            <>
              <View style={styles.spotDivider} />
              <View style={styles.spotStats}>
                <View style={styles.spotStat}>
                  <Text style={[styles.spotStatLabel, { color: colors.textMuted }]}>PCR</Text>
                  <Text style={[styles.spotStatValue, { color: isPositive ? colors.marketUp : colors.marketDown }]}>
                    {optionChain.pcr.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.spotStat}>
                  <Text style={[styles.spotStatLabel, { color: colors.textMuted }]}>Max Pain</Text>
                  <Text style={[styles.spotStatValue, { color: colors.text }]}>
                    {formatCurrency(optionChain.maxPain, true)}
                  </Text>
                </View>
                <View style={styles.spotStat}>
                  <Text style={[styles.spotStatLabel, { color: colors.textMuted }]}>CE OI</Text>
                  <Text style={[styles.spotStatValue, { color: colors.marketUp }]}>
                    {formatCompactNumber(optionChain.totalCEOi)}
                  </Text>
                </View>
                <View style={styles.spotStat}>
                  <Text style={[styles.spotStatLabel, { color: colors.textMuted }]}>PE OI</Text>
                  <Text style={[styles.spotStatValue, { color: colors.marketDown }]}>
                    {formatCompactNumber(optionChain.totalPEOi)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      {/* View Tabs */}
      <View style={[styles.viewTabs, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {([
          { key: 'option-chain', label: 'Option Chain', icon: 'options' },
          { key: 'futures', label: 'Futures', icon: 'trending-up' },
          { key: 'positions', label: 'Positions', icon: 'briefcase' },
        ] as const).map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.viewTab, view === tab.key && styles.viewTabActive]}
            onPress={() => setView(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={14}
              color={view === tab.key ? colors.primary : colors.textMuted}
            />
            <Text style={[
              styles.viewTabText,
              { color: view === tab.key ? colors.primary : colors.textMuted },
            ]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Main Content */}
      {view !== 'positions' && (
        <View style={styles.controlsRow}>
          {/* Expiry Selector */}
          {view === 'option-chain' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.expiryScroll}
              contentContainerStyle={styles.expiryContent}
            >
              {expiries.map(exp => {
                const isSelected = selectedExpiry?.date === exp.date;
                return (
                  <Pressable
                    key={exp.id}
                    style={[styles.expiryChip, isSelected && styles.expiryChipActive]}
                    onPress={() => handleExpiryChange(exp)}
                  >
                    <Text style={[
                      styles.expiryDate,
                      { color: isSelected ? colors.primary : colors.textSecondary },
                    ]}>
                      {new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                    <Text style={[styles.expiryDays, {
                      color: isSelected ? colors.primary + '80' : colors.textMuted,
                    }]}>
                      {exp.daysToExpiry}d
                      {exp.isMonthly ? ' (M)' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Side Filter & Greeks Toggle */}
          {view === 'option-chain' && (
            <View style={styles.chainOptions}>
              <View style={styles.sideTabs}>
                {(['both', 'CE', 'PE'] as ChainSide[]).map(side => (
                  <Pressable
                    key={side}
                    style={[styles.sideTab, chainSide === side && styles.sideTabActive]}
                    onPress={() => setChainSide(side)}
                  >
                    <Text style={[
                      styles.sideTabText,
                      { color: chainSide === side ? colors.primary : colors.textMuted },
                    ]}>
                      {side === 'both' ? 'All' : side}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={[styles.greeksToggle, showGreeks && { backgroundColor: colors.primary + '20' }]}
                onPress={() => setShowGreeks(!showGreeks)}
              >
                <Ionicons
                  name="calculator"
                  size={16}
                  color={showGreeks ? colors.primary : colors.textMuted}
                />
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Content Area */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.bgSecondary}
          />
        }
      >
        {view === 'option-chain' && renderOptionChain()}
        {view === 'futures' && renderFutures()}
        {view === 'positions' && renderPositions()}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Order Modal */}
      {renderOrderModal()}
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
    paddingBottom: SPACING.md,
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
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
    flex: 1,
  },
  strategyBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  // Symbol Selector
  symbolRow: {
    marginBottom: SPACING.md,
  },
  symbolContent: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  symbolChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  symbolChipActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  symbolChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  // Spot Price Banner
  spotBanner: {
    marginHorizontal: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  spotLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginRight: SPACING.sm,
  },
  spotPriceText: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.xl,
    color: colors.text,
  },
  spotDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.divider,
    marginHorizontal: SPACING.md,
  },
  spotStats: {
    flexDirection: 'row',
    gap: SPACING.lg,
    flex: 1,
  },
  spotStat: {
    alignItems: 'center',
  },
  spotStatLabel: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  spotStatValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
    marginTop: 2,
  },
  // View Tabs
  viewTabs: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: 3,
    marginBottom: SPACING.md,
  },
  viewTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  viewTabActive: {
    backgroundColor: colors.primary + '20',
  },
  viewTabText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  // Controls
  controlsRow: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  expiryScroll: {
    marginBottom: 0,
  },
  expiryContent: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  expiryChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  expiryChipActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  expiryDate: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  expiryDays: {
    ...FONTS.regular,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  chainOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
  },
  sideTabs: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.sm,
    padding: 2,
  },
  sideTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  sideTabActive: {
    backgroundColor: colors.primary + '20',
  },
  sideTabText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  greeksToggle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Option Chain
  chainHeader: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  chainHeaderCe: {
    flex: 1.5,
    alignItems: 'center',
  },
  chainHeaderPe: {
    flex: 1.5,
    alignItems: 'center',
  },
  chainHeaderStrike: {
    width: 60,
    alignItems: 'center',
  },
  chainHeaderText: {
    ...FONTS.semiBold,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chainHeaderStrikeText: {
    ...FONTS.bold,
    fontSize: 10,
  },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.sm,
    marginHorizontal: SPACING.xl,
    marginBottom: 2,
    borderColor: 'transparent',
  },
  contractCell: {
    flex: 1.5,
    alignItems: 'center',
    paddingVertical: 4,
  },
  contractLtp: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  contractMeta: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 1,
  },
  oiText: {
    ...FONTS.regular,
    fontSize: 8,
  },
  volumeText: {
    ...FONTS.regular,
    fontSize: 8,
  },
  greeksRow: {
    alignItems: 'center',
  },
  greekText: {
    ...FONTS.regular,
    fontSize: 7,
    fontFamily: 'monospace',
  },
  strikeCell: {
    width: 60,
    alignItems: 'center',
    paddingVertical: 4,
  },
  strikeText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  atmText: {
    ...FONTS.bold,
  },
  atmBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  atmBadgeText: {
    ...FONTS.bold,
    fontSize: 8,
  },
  // Futures
  futuresHeader: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  futuresHeaderText: {
    ...FONTS.semiBold,
    fontSize: 10,
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'center',
  },
  futuresCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    backgroundColor: colors.bgCard,
  },
  futuresLeft: {
    flex: 1,
  },
  futuresSymbol: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
  },
  futuresExpiry: {
    ...FONTS.regular,
    fontSize: 10,
    marginTop: 2,
  },
  futuresPrice: {
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  futuresLtp: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  futuresChange: {
    ...FONTS.medium,
    fontSize: 10,
    marginTop: 1,
  },
  futuresOi: {
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  futuresOiValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  futuresOiLabel: {
    ...FONTS.regular,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  futuresBasis: {
    alignItems: 'center',
  },
  futuresBasisValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  futuresBasisPct: {
    ...FONTS.regular,
    fontSize: 9,
    marginTop: 1,
  },
  // Positions
  positionCard: {
    marginHorizontal: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    backgroundColor: colors.bgCard,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  positionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  positionTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  positionTypeText: {
    ...FONTS.semiBold,
    fontSize: 10,
  },
  positionSymbol: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  pnlBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  pnlText: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
  },
  positionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  positionDetail: {
    alignItems: 'center',
  },
  positionLabel: {
    ...FONTS.regular,
    fontSize: 9,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  positionValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    padding: SPACING.xl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.sm,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  emptySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  // Order Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  modalContent: {
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
  },
  modalContractInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  modalTypeBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  modalTypeText: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  modalContractDetails: {
    flex: 1,
  },
  modalContractSymbol: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  modalContractMeta: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginTop: 2,
  },
  greeksPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  greekItem: {
    alignItems: 'center',
  },
  greekLabel: {
    ...FONTS.regular,
    fontSize: 9,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  greekValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    fontFamily: 'monospace',
  },
  modalLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  qtySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  qtyBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyInput: {
    width: 100,
    height: 56,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    fontSize: FONTS.size.xxxl,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'System',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  totalLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  totalValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  modalActionText: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
});
