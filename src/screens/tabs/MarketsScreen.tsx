import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Dimensions, RefreshControl, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useMarketStore } from '../../store/marketStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import StockItem from '../../components/StockItem';
import MarketCard from '../../components/MarketCard';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { useStaggeredAnimation } from '../../hooks/useStaggeredAnimation';
import { SkeletonBlock, SkeletonCard } from '../../components/ui/SkeletonLoader';

const { width } = Dimensions.get('window');
const SECTORS = ['All', 'Technology', 'Finance', 'Energy', 'Consumer', 'Automobile', 'Telecom'];

export default function MarketsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { stocks, indices, searchQuery, searchResults, setSearchQuery } = useMarketStore();
  const [selectedSector, setSelectedSector] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const searchAnim = useRef(new Animated.Value(0)).current;

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

  const { getAnimatedStyle: getStockStyle } = useStaggeredAnimation(filteredStocks.length, {
    initialDelay: 150,
    staggerDelay: 50,
    duration: 350,
  });

  // Animate search bar on focus
  const handleSearchFocus = () => {
    Animated.spring(searchAnim, {
      toValue: 1,
      useNativeDriver: false,
      speed: 14,
      bounciness: 4,
    }).start();
  };

  const handleSearchBlur = () => {
    if (!searchQuery) {
      Animated.spring(searchAnim, {
        toValue: 0,
        useNativeDriver: false,
        speed: 14,
        bounciness: 4,
      }).start();
    }
  };

  const searchBorderColor = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
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
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Markets</Text>
          <Text style={styles.subtitle}>Real-time stock market data</Text>
        </View>

        {/* Search Bar */}
        <Animated.View style={[styles.searchContainer, { borderColor: searchBorderColor }]}>
          <Ionicons name="search" size={20} color={searchQuery ? colors.primary : colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stocks by name or symbol..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          />
          {searchQuery ? (
            <AnimatedPressable onPress={() => setSearchQuery('')} haptic="light" scaleTo={0.9}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </AnimatedPressable>
          ) : null}
        </Animated.View>

        {/* Market Indices */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.indicesScroll}>
          {indices.map((index) => (
            <MarketCard key={index.id} index={index} />
          ))}
        </ScrollView>

        {/* Sector Filter */}
        {!searchQuery && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.sectorScroll}
            contentContainerStyle={styles.sectorContent}
          >
            {SECTORS.map((sector) => (
              <AnimatedPressable
                key={sector}
                onPress={() => setSelectedSector(sector)}
                haptic="selection"
                scaleTo={0.95}
              >
                <View style={[styles.sectorChip, selectedSector === sector && styles.sectorChipActive]}>
                  <Text style={[styles.sectorText, selectedSector === sector && styles.sectorTextActive]}>
                    {sector}
                  </Text>
                </View>
              </AnimatedPressable>
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
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACING.lg,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: FONTS.size.md,
    paddingVertical: SPACING.md,
    fontFamily: 'System',
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
});
