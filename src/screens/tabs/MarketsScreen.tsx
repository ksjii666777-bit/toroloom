import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Dimensions, RefreshControl, Animated, Keyboard, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useMarketStore } from '../../store/marketStore';
import { SPACING, FONTS, BORDER_RADIUS, SCREEN } from '../../constants/theme';
import StockItem from '../../components/StockItem';
import MarketCard from '../../components/MarketCard';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { useStaggeredAnimation } from '../../hooks/useStaggeredAnimation';
import { SkeletonBlock, SkeletonCard } from '../../components/ui/SkeletonLoader';

const { width } = Dimensions.get('window');
const SECTORS = ['All', 'Technology', 'Finance', 'Energy', 'Consumer', 'Automobile', 'Telecom'];

const SUGGESTED_SEARCHES = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'SBIN', 'ICICIBANK', 'BAJFINANCE', 'TATAMOTORS'];

const HEATMAP_HOT_THRESHOLD = 1.5;

export default function MarketsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { stocks, indices, searchQuery, searchResults, setSearchQuery } = useMarketStore();
  const [selectedSector, setSelectedSector] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const filteredStocks = searchQuery
    ? searchResults
    : selectedSector === 'All'
    ? stocks
    : stocks.filter(s => s.sector === selectedSector);

  // ── Sector performance for heatmap ──
  const sectorPerformance = useMemo(() => {
    const map = new Map<string, { totalChange: number; count: number }>();
    stocks.forEach(s => {
      const d = map.get(s.sector) || { totalChange: 0, count: 0 };
      d.totalChange += s.changePercent;
      d.count += 1;
      map.set(s.sector, d);
    });
    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      avgChange: data.totalChange / data.count,
      count: data.count,
    }));
  }, [stocks]);

  const { getAnimatedStyle: getStockStyle } = useStaggeredAnimation(filteredStocks.length, {
    initialDelay: 150,
    staggerDelay: 50,
    duration: 350,
  });

  // Advanced search overlay animation
  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
    Animated.spring(searchAnim, {
      toValue: 1,
      useNativeDriver: false,
      speed: 14,
      bounciness: 4,
    }).start();
    Animated.timing(overlayAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [searchAnim, overlayAnim]);

  const handleSearchBlur = useCallback(() => {
    if (!searchQuery) {
      setIsSearchFocused(false);
      Animated.spring(searchAnim, {
        toValue: 0,
        useNativeDriver: false,
        speed: 14,
        bounciness: 4,
      }).start();
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [searchAnim, overlayAnim, searchQuery]);

  const searchBorderColor = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  // Overlay opacity for backdrop blur effect
  const overlayOpacity = overlayAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handleSuggestionTap = useCallback((symbol: string) => {
    setSearchQuery(symbol);
    Keyboard.dismiss();
  }, [setSearchQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, [setSearchQuery]);

  // Sector chip entrance stagger
  const { getAnimatedStyle: getSectorStyle } = useStaggeredAnimation(SECTORS.length, {
    initialDelay: 100,
    staggerDelay: 30,
    duration: 300,
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <SkeletonBlock width="30%" height={28} />
            <View style={{ height: 4 }} />
            <SkeletonBlock width="50%" height={14} />
          </View>
          <View style={{ paddingHorizontal: SPACING.xl }}>
            <SkeletonBlock width="100%" height={48} borderRadius={8} />
            <View style={{ height: SPACING.lg }} />
            <SkeletonBlock width="100%" height={100} borderRadius={12} />
            <View style={{ height: SPACING.lg }} />
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} hasAvatar hasAction />)}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title}>Markets</Text>
            <AnimatedPressable
              onPress={() => navigation.navigate('StockScreener')}
              haptic="light"
              scaleTo={0.95}
            >
              <View style={[styles.screenerBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                <Ionicons name="funnel" size={16} color={colors.primary} />
                <Text style={[styles.screenerBtnText, { color: colors.primary }]}>Screener</Text>
              </View>
            </AnimatedPressable>
          </View>
          <Text style={styles.subtitle}>Real-time stock market data</Text>
        </View>

        {/* Search Bar — elevated when focused */}
        <Animated.View style={[
          styles.searchContainer,
          { borderColor: searchBorderColor },
          isSearchFocused && styles.searchContainerFocused,
        ]}>
          <Ionicons name="search" size={20} color={searchQuery ? colors.primary : colors.textMuted} style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search stocks by name or symbol..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          />
          {searchQuery ? (
            <AnimatedPressable onPress={handleClearSearch} haptic="light" scaleTo={0.9}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </AnimatedPressable>
          ) : null}
        </Animated.View>

        {/* Search Suggestion Dashboard — slides down when search is focused */}
        {isSearchFocused && !searchQuery && (
          <Animated.View style={[styles.suggestionDashboard, { opacity: overlayAnim }]}>
            <Text style={styles.suggestionTitle}>Popular Stocks</Text>
            <View style={styles.suggestionChips}>
              {SUGGESTED_SEARCHES.map(symbol => (
                <AnimatedPressable
                  key={symbol}
                  onPress={() => handleSuggestionTap(symbol)}
                  haptic="selection"
                  scaleTo={0.95}
                  highlight
                  highlightColor={colors.primary}
                  borderRadius={BORDER_RADIUS.full}
                >
                  <View style={styles.suggestionChip}>
                    <Text style={styles.suggestionChipText}>{symbol}</Text>
                  </View>
                </AnimatedPressable>
              ))}
            </View>
            <View style={styles.suggestionDivider} />
          </Animated.View>
        )}

        {/* Market Indices */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.indicesScroll}>
          {indices.map((index) => (
            <MarketCard key={index.id} index={index} />
          ))}
        </ScrollView>

        {/* Gainers / Losers — mini section */}
        {!searchQuery && (
          <View style={styles.perfSection}>
            <View style={styles.perfRow}>
              {/* Top Gainers */}
              <View style={[styles.perfColumn, { borderColor: colors.border }]}>
                <View style={styles.perfHeader}>
                  <Ionicons name="arrow-up-circle" size={14} color="#00C853" />
                  <Text style={[styles.perfLabel, { color: colors.textMuted }]}>Top Gainers</Text>
                </View>
                {[...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3).map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.perfItem, { borderColor: colors.divider }]}
                    onPress={() => navigation.navigate('StockDetail', { stockId: s.id, symbol: s.symbol })}
                  >
                    <Text style={[styles.perfItemSymbol, { color: colors.text }]}>{s.symbol}</Text>
                    <View style={[styles.perfItemBadge, { backgroundColor: '#00C85320' }]}>
                      <Ionicons name="caret-up" size={10} color="#00C853" />
                      <Text style={[styles.perfItemChange, { color: '#00C853' }]}>{s.changePercent.toFixed(2)}%</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Top Losers */}
              <View style={[styles.perfColumn, { borderColor: colors.border }]}>
                <View style={styles.perfHeader}>
                  <Ionicons name="arrow-down-circle" size={14} color="#FF1744" />
                  <Text style={[styles.perfLabel, { color: colors.textMuted }]}>Top Losers</Text>
                </View>
                {[...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3).map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.perfItem, { borderColor: colors.divider }]}
                    onPress={() => navigation.navigate('StockDetail', { stockId: s.id, symbol: s.symbol })}
                  >
                    <Text style={[styles.perfItemSymbol, { color: colors.text }]}>{s.symbol}</Text>
                    <View style={[styles.perfItemBadge, { backgroundColor: '#FF174420' }]}>
                      <Ionicons name="caret-down" size={10} color="#FF1744" />
                      <Text style={[styles.perfItemChange, { color: '#FF1744' }]}>{s.changePercent.toFixed(2)}%</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Sector Heatmap */}
        {!searchQuery && (
          <View style={styles.heatmapSection}>
            <View style={styles.heatmapHeader}>
              <Text style={[styles.heatmapTitle, { color: colors.text }]}>Sector Performance</Text>
            </View>
            <View style={styles.heatmapGrid}>
              {sectorPerformance.map(sector => {
                const isPositive = sector.avgChange >= 0;
                const intensity = Math.min(Math.abs(sector.avgChange) / 3, 1);
                const bgColor = isPositive
                  ? `rgba(0, 200, 83, ${0.1 + intensity * 0.35})`
                  : `rgba(255, 23, 68, ${0.1 + intensity * 0.35})`;
                const borderColor = isPositive
                  ? `rgba(0, 200, 83, ${0.3 + intensity * 0.5})`
                  : `rgba(255, 23, 68, ${0.3 + intensity * 0.5})`;
                const isHot = Math.abs(sector.avgChange) >= HEATMAP_HOT_THRESHOLD;

                return (
                  <TouchableOpacity
                    key={sector.name}
                    style={[styles.heatmapCard, { backgroundColor: bgColor, borderColor }]}
                    onPress={() => setSelectedSector(sector.name)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.heatmapSectorName, { color: isPositive ? '#00C853' : '#FF1744' }]}>
                      {sector.name}
                    </Text>
                    <Text style={[styles.heatmapChange, { color: colors.text }]}>
                      {isPositive ? '+' : ''}{sector.avgChange.toFixed(2)}%
                    </Text>
                    <View style={styles.heatmapMeta}>
                      <Text style={[styles.heatmapCount, { color: colors.textMuted }]}>{sector.count} stocks</Text>
                      {isHot && (
                        <View style={[styles.heatmapHotBadge, {
                          backgroundColor: isPositive ? '#00C85320' : '#FF174420',
                        }]}>
                          <Ionicons name="flame" size={10} color={isPositive ? '#00C853' : '#FF1744'} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Sector Filter */}
        {(isSearchFocused && searchQuery ? false : !isSearchFocused) && !searchQuery && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.sectorScroll}
            contentContainerStyle={styles.sectorContent}
          >
            {SECTORS.map((sector, i) => (
              <Animated.View key={sector} style={getSectorStyle(i)}>
                <AnimatedPressable
                  onPress={() => setSelectedSector(sector)}
                  haptic="selection"
                  scaleTo={0.95}
                  highlight
                  highlightColor={colors.primary}
                  borderRadius={BORDER_RADIUS.full}
                >
                  <View style={[styles.sectorChip, selectedSector === sector && styles.sectorChipActive]}>
                    <Text style={[styles.sectorText, selectedSector === sector && styles.sectorTextActive]}>
                      {sector}
                    </Text>
                  </View>
                </AnimatedPressable>
              </Animated.View>
            ))}
          </ScrollView>
        )}

        {/* Stock List */}
        <View style={styles.stockList}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              {searchQuery ? `Results (${filteredStocks.length})` : `${selectedSector} Stocks`}
            </Text>
            <Text style={styles.listCount}>{filteredStocks.length} stocks</Text>
          </View>
          {filteredStocks.map((stock, i) => (
            <Animated.View key={stock.id} style={getStockStyle(i)}>
              <StockItem
                stock={stock}
                onPress={(s) => navigation.navigate('StockDetail', { stockId: s.id, symbol: s.symbol })}
                showActions
                isInWatchlist={false}
              />
            </Animated.View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Backdrop overlay when search is focused */}
      {isSearchFocused && searchQuery.length === 0 && (
        <Animated.View
          style={[styles.backdropOverlay, { opacity: overlayAnim }]}
          pointerEvents={isSearchFocused ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setIsSearchFocused(false);
              Animated.timing(overlayAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }).start();
            }}
          />
        </Animated.View>
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
    paddingBottom: 20,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
    letterSpacing: 0.3,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    color: colors.textSecondary,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    marginHorizontal: SPACING.xl,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: SPACING.lg,
    zIndex: 10,
  },
  searchContainerFocused: {
    backgroundColor: colors.bgCard,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: FONTS.size.md,
    paddingVertical: SPACING.md,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  // ── Search Suggestion Dashboard ──
  suggestionDashboard: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 20,
  },
  suggestionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  suggestionChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
    letterSpacing: 0.3,
  },
  suggestionDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  // ── Backdrop Overlay ──
  backdropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bgOverlay,
    zIndex: 5,
  },
  indicesScroll: {
    marginBottom: SPACING.lg,
    paddingLeft: SPACING.xl,
  },
  sectorScroll: {
    marginBottom: SPACING.lg,
  },
  sectorContent: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  sectorChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectorChipActive: {
    backgroundColor: colors.primary + '30',
    borderColor: colors.primary,
  },
  sectorText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  sectorTextActive: {
    color: colors.primary,
  },
  stockList: {
    paddingHorizontal: SPACING.xl,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  listTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  listCount: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  screenerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  screenerBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },

  // ── Gainers / Losers ──
  perfSection: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  perfRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  perfColumn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  perfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: SPACING.sm,
  },
  perfLabel: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: FONTS.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  perfItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  perfItemSymbol: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: FONTS.size.sm,
  },
  perfItemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  perfItemChange: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: FONTS.size.xs,
  },

  // ── Sector Heatmap ──
  heatmapSection: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  heatmapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  heatmapTitle: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: FONTS.size.lg,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  heatmapCard: {
    width: (width - SPACING.xl * 2 - SPACING.sm * 2) / 3,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  heatmapSectorName: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: FONTS.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  heatmapChange: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: FONTS.size.md,
    marginTop: 4,
  },
  heatmapMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  heatmapCount: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: FONTS.size.xs,
  },
  heatmapHotBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
