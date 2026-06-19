import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, RefreshControl,
  Animated, TouchableOpacity, Modal, Dimensions, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useMarketStore } from '../../store/marketStore';
import { useNotificationStore } from '../../store/notificationStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import { Stock } from '../../types';
import StockItem from '../../components/StockItem';
import Button from '../../components/ui/Button';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { useStaggeredAnimation } from '../../hooks/useStaggeredAnimation';
import { SkeletonBlock, PortfolioSkeleton, SkeletonCard } from '../../components/ui/SkeletonLoader';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';

const { width } = Dimensions.get('window');

const ALL_WATCHLIST_ID = '__all__';

type SortField = 'name' | 'price' | 'changePercent' | 'sector' | 'volume';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: { field: SortField; label: string; icon: string }[] = [
  { field: 'name', label: 'Name', icon: 'text-outline' },
  { field: 'price', label: 'Price', icon: 'cash-outline' },
  { field: 'changePercent', label: 'Change %', icon: 'trending-up-outline' },
  { field: 'sector', label: 'Sector', icon: 'business-outline' },
  { field: 'volume', label: 'Volume', icon: 'bar-chart-outline' },
];

function parseVolume(volStr: string): number {
  const num = parseFloat(volStr.replace(/[MKB,\s]/g, ''));
  if (volStr.includes('M')) return num * 1000000;
  if (volStr.includes('K')) return num * 1000;
  return num;
}

function getMarketCapCategory(marketCap: string): string {
  const numStr = marketCap.replace(/[₹,\s]/g, '');
  const match = numStr.match(/^([\d.]+)\s*(Cr|Lakh|Thousand)/i);
  if (!match) return 'Other';
  const num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const normalized = unit === 'cr' ? num : unit === 'lakh' ? num / 100 : num / 100000;
  if (normalized >= 500000) return 'Large Cap';
  if (normalized >= 100000) return 'Mid Cap';
  return 'Small Cap';
}

const MARKET_CAP_CHIPS = ['Large Cap', 'Mid Cap', 'Small Cap'] as const;
const SECTOR_ICONS: Record<string, string> = {
  Technology: 'code-slash',
  Finance: 'wallet',
  Energy: 'flame',
  Consumer: 'cart',
  Telecom: 'radio',
  Automobile: 'car',
};

export default function WatchlistScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { watchlists, createWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlistStore();
  const { stocks } = useMarketStore();
  const { priceAlertRules, addPriceAlertRule } = useNotificationStore();
  const [activeWatchlist, setActiveWatchlist] = useState<string>(
    watchlists.length > 1 ? ALL_WATCHLIST_ID : (watchlists[0]?.id || ALL_WATCHLIST_ID)
  );
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Combined View ─────────────────────────────────────────
  const isAllView = activeWatchlist === ALL_WATCHLIST_ID;

  // All unique stocks across all watchlists, with their source watchlist names
  const combinedStocks = useMemo(() => {
    const map = new Map<string, { stock: Stock; sources: { id: string; name: string }[] }>();
    for (const wl of watchlists) {
      for (const stock of wl.stocks) {
        const existing = map.get(stock.id);
        if (existing) {
          existing.sources.push({ id: wl.id, name: wl.name });
        } else {
          map.set(stock.id, { stock, sources: [{ id: wl.id, name: wl.name }] });
        }
      }
    }
    return Array.from(map.values());
  }, [watchlists]);

  // Filter state
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const [activeMarketCap, setActiveMarketCap] = useState<string | null>(null);
  const [activeTopMovers, setActiveTopMovers] = useState(false);

  // Gainers/Losers quick toggle
  const [performanceView, setPerformanceView] = useState<'all' | 'gainers' | 'losers'>('all');

  // Sort state
  const [sortBy, setSortBy] = useState<SortField>('changePercent');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Alert modal state
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertStock, setAlertStock] = useState<Stock | null>(null);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertDirection, setAlertDirection] = useState<'above' | 'below'>('above');

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const currentWatchlist = isAllView ? null : watchlists.find(w => w.id === activeWatchlist);
  const watchlistStocks = isAllView
    ? combinedStocks.map(entry => entry.stock)
    : currentWatchlist?.stocks || [];

  // ── Performance counts ────────────────────────────────────
  const gainersCount = useMemo(
    () => watchlistStocks.filter(s => s.changePercent > 0).length,
    [watchlistStocks]
  );
  const losersCount = useMemo(
    () => watchlistStocks.filter(s => s.changePercent < 0).length,
    [watchlistStocks]
  );

  // ── Filter helpers ─────────────────────────────────────────
  const uniqueSectors = useMemo(() => {
    const sectors = new Set<string>();
    watchlistStocks.forEach(s => sectors.add(s.sector));
    return Array.from(sectors).sort();
  }, [watchlistStocks]);

  // ── Smart Sorting ──────────────────────────────────────────
  const sortedStocks = useMemo(() => {
    // First apply filters, then sort
    let filtered = [...watchlistStocks];
    if (activeSector) {
      filtered = filtered.filter(s => s.sector === activeSector);
    }
    if (activeMarketCap) {
      filtered = filtered.filter(s => getMarketCapCategory(s.marketCap) === activeMarketCap);
    }
    // Top Movers: only stocks with extreme change (>5% or <-5%)
    if (activeTopMovers) {
      filtered = filtered.filter(s => Math.abs(s.changePercent) > 5);
    }
    // Gainers/Losers override: filter to only positive or negative change
    if (performanceView === 'gainers') {
      filtered = filtered.filter(s => s.changePercent > 0);
    } else if (performanceView === 'losers') {
      filtered = filtered.filter(s => s.changePercent < 0);
    }
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          cmp = a.price - b.price;
          break;
        case 'changePercent':
          cmp = a.changePercent - b.changePercent;
          break;
        case 'sector':
          cmp = a.sector.localeCompare(b.sector);
          break;
        case 'volume':
          cmp = parseVolume(a.volume) - parseVolume(b.volume);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return filtered;
  }, [watchlistStocks, sortBy, sortDir, activeSector, activeMarketCap, activeTopMovers, performanceView]);

  const setPerformance = useCallback((view: 'all' | 'gainers' | 'losers') => {
    impactAsync(ImpactFeedbackStyle.Light).catch(() => {});
    if (view === performanceView) {
      // Tapping the same button resets to 'all'
      setPerformanceView('all');
    } else {
      setPerformanceView(view);
      // Also set sort to changePercent desc for a useful default ordering
      setSortBy('changePercent');
      setSortDir('desc');
    }
  }, [performanceView]);

  const hasActiveFilters = activeSector !== null || activeMarketCap !== null || activeTopMovers;

  const clearFilters = useCallback(() => {
    setActiveSector(null);
    setActiveMarketCap(null);
    setActiveTopMovers(false);
  }, []);

  // ── Price Alert helpers ────────────────────────────────────
  const activeAlertSymbols = useMemo(() => {
    const set = new Set<string>();
    priceAlertRules
      .filter(r => !r.triggered)
      .forEach(r => set.add(r.symbol));
    return set;
  }, [priceAlertRules]);

  const getStockAlert = useCallback((symbol: string) => {
    return priceAlertRules.filter(r => r.symbol === symbol && !r.triggered);
  }, [priceAlertRules]);

  const handleSetAlert = useCallback(() => {
    if (!alertStock || !alertPrice.trim()) return;
    const price = parseFloat(alertPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid target price.');
      return;
    }
    addPriceAlertRule(alertStock.symbol, alertStock.name, price, alertDirection);
    setAlertModalVisible(false);
    setAlertPrice('');
    setAlertStock(null);
    Alert.alert(
      'Price Alert Set',
      `${alertStock.symbol} ${alertDirection === 'above' ? '↑' : '↓'} ₹${price.toFixed(2)}\nYou'll be notified when the price moves ${alertDirection} this target.`,
    );
  }, [alertStock, alertPrice, alertDirection, addPriceAlertRule]);

  const openAlertModal = useCallback((stock: Stock) => {
    setAlertStock(stock);
    setAlertPrice(stock.price.toFixed(2));
    setAlertDirection('above');
    setAlertModalVisible(true);
  }, []);

  const isStockInWatchlist = (stockId: string) => {
    if (isAllView) {
      return watchlists.some(w => w.stocks.some(s => s.id === stockId));
    }
    return watchlistStocks.some(s => s.id === stockId);
  };

  const availableStocks = stocks.filter(s => !isStockInWatchlist(s.id));

  const { getAnimatedStyle: getWatchlistStyle } = useStaggeredAnimation(sortedStocks.length, {
    initialDelay: 150,
    staggerDelay: 70,
    duration: 400,
  });

  const { getAnimatedStyle: getSuggestedStyle } = useStaggeredAnimation(Math.min(availableStocks.length, 5), {
    initialDelay: 300,
    staggerDelay: 60,
    duration: 350,
  });

  const handleCreate = () => {
    if (newName.trim()) {
      createWatchlist(newName.trim());
      setNewName('');
      setShowCreate(false);
    }
  };

  const toggleSortDir = () => setSortDir(d => d === 'asc' ? 'desc' : 'asc');

  // ── Alert Modal ────────────────────────────────────────────
  const renderAlertModal = () => (
    <Modal
      visible={alertModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setAlertModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.bgSecondary }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Set Price Alert — {alertStock?.symbol}
            </Text>
            <TouchableOpacity onPress={() => setAlertModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {alertStock && (
            <View style={[styles.alertInfoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.alertInfoLabel, { color: colors.textMuted }]}>Current Price</Text>
              <Text style={[styles.alertInfoValue, { color: colors.text }]}>{formatCurrency(alertStock.price)}</Text>
              <View style={[styles.alertChangeBadge, { backgroundColor: alertStock.isPositive ? '#00C85315' : '#FF174415' }]}>
                <Ionicons name={alertStock.isPositive ? 'caret-up' : 'caret-down'} size={14} color={alertStock.isPositive ? '#00C853' : '#FF1744'} />
                <Text style={[styles.alertChangeText, { color: alertStock.isPositive ? '#00C853' : '#FF1744' }]}>
                  {Math.abs(alertStock.changePercent).toFixed(2)}%
                </Text>
              </View>
            </View>
          )}

          {/* Direction Selector */}
          <Text style={[styles.alertSectionLabel, { color: colors.textSecondary }]}>Alert when price goes</Text>
          <View style={styles.alertDirectionRow}>
            <TouchableOpacity
              onPress={() => setAlertDirection('above')}
              style={[
                styles.alertDirBtn,
                { borderColor: colors.border },
                alertDirection === 'above' && { backgroundColor: '#00C85320', borderColor: '#00C853' },
              ]}
            >
              <Ionicons name="arrow-up" size={20} color={alertDirection === 'above' ? '#00C853' : colors.textMuted} />
              <Text style={[styles.alertDirText, { color: alertDirection === 'above' ? '#00C853' : colors.textMuted }]}>Above</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAlertDirection('below')}
              style={[
                styles.alertDirBtn,
                { borderColor: colors.border },
                alertDirection === 'below' && { backgroundColor: '#FF174420', borderColor: '#FF1744' },
              ]}
            >
              <Ionicons name="arrow-down" size={20} color={alertDirection === 'below' ? '#FF1744' : colors.textMuted} />
              <Text style={[styles.alertDirText, { color: alertDirection === 'below' ? '#FF1744' : colors.textMuted }]}>Below</Text>
            </TouchableOpacity>
          </View>

          {/* Price Input */}
          <Text style={[styles.alertSectionLabel, { color: colors.textSecondary }]}>Target Price (₹)</Text>
          <TextInput
            style={[styles.alertPriceInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
            value={alertPrice}
            onChangeText={setAlertPrice}
            keyboardType="decimal-pad"
            placeholder="Enter target price"
            placeholderTextColor={colors.textMuted}
          />

          {/* Quick preset buttons */}
          {alertStock && (
            <View style={styles.alertPresetsRow}>
              {[0.95, 0.98, 1.0, 1.02, 1.05].map(mult => {
                const preset = (alertStock.price * mult).toFixed(0);
                const label = mult < 1 ? `${Math.round((1 - mult) * 100)}% below` : mult > 1 ? `${Math.round((mult - 1) * 100)}% above` : 'Current';
                return (
                  <TouchableOpacity
                    key={String(mult)}
                    onPress={() => setAlertPrice(preset)}
                    style={[styles.alertPreset, { borderColor: colors.border, backgroundColor: colors.bgCard }]}
                  >
                    <Text style={[styles.alertPresetLabel, { color: colors.textSecondary }]}>{label}</Text>
                    <Text style={[styles.alertPresetValue, { color: colors.text }]}>₹{parseInt(preset).toLocaleString()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Confirm Button */}
          <AnimatedPressable onPress={handleSetAlert} scaleTo={0.97} style={styles.alertConfirmBtn}>
            <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.alertConfirmGradient}>
              <Ionicons name="notifications" size={20} color="#fff" />
              <Text style={styles.alertConfirmText}>Set Alert{alertDirection === 'above' ? ' ↑' : ' ↓'}</Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );

  // ── Sort Menu ──────────────────────────────────────────────
  const renderSortMenu = () => (
    <Modal
      visible={showSortMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setShowSortMenu(false)}
    >
      <TouchableOpacity
        style={styles.sortOverlay}
        activeOpacity={1}
        onPress={() => setShowSortMenu(false)}
      >
        <View style={[styles.sortMenu, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sortMenuTitle, { color: colors.text }]}>Sort By</Text>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.field}
              style={[
                styles.sortOption,
                sortBy === opt.field && { backgroundColor: colors.primary + '20' },
              ]}
              onPress={() => {
                if (sortBy === opt.field) {
                  toggleSortDir();
                } else {
                  setSortBy(opt.field);
                  setSortDir('desc');
                }
                setShowSortMenu(false);
              }}
            >
              <Ionicons
                name={opt.icon as any}
                size={18}
                color={sortBy === opt.field ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.sortOptionText, { color: sortBy === opt.field ? colors.primary : colors.text }]}>
                {opt.label}
              </Text>
              {sortBy === opt.field && (
                <Ionicons
                  name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'}
                  size={16}
                  color={colors.primary}
                  style={styles.sortDirIcon}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ── Main Render ────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <SkeletonBlock width="40%" height={28} />
            <View style={{ height: 4 }} />
            <SkeletonBlock width="50%" height={14} />
          </View>
          <View style={{ paddingHorizontal: SPACING.xl }}>
            <SkeletonBlock width="100%" height={36} borderRadius={18} />
            <View style={{ height: SPACING.lg }} />
            <PortfolioSkeleton />
            {[1, 2, 3].map(i => <SkeletonCard key={i} hasAvatar hasAction />)}
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
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Watchlist</Text>
              <Text style={styles.subtitle}>Monitor your favorite stocks</Text>
            </View>
            {/* Performance buttons + Sort Button */}
            <View style={styles.headerActions}>
              {/* Gainers quick toggle */}
              <TouchableOpacity
                onPress={() => setPerformance('gainers')}
                style={[
                  styles.perfBtn,
                  { backgroundColor: colors.bgCard, borderColor: colors.border },
                  performanceView === 'gainers' && { backgroundColor: '#00C85320', borderColor: '#00C853' },
                ]}
              >
                <Ionicons name="arrow-up" size={12} color={performanceView === 'gainers' ? '#00C853' : colors.textMuted} />
                <Text
                  style={[
                    styles.perfBtnCount,
                    { color: performanceView === 'gainers' ? '#00C853' : colors.textMuted },
                  ]}
                >
                  {gainersCount}
                </Text>
              </TouchableOpacity>
              {/* Losers quick toggle */}
              <TouchableOpacity
                onPress={() => setPerformance('losers')}
                style={[
                  styles.perfBtn,
                  { backgroundColor: colors.bgCard, borderColor: colors.border },
                  performanceView === 'losers' && { backgroundColor: '#FF174420', borderColor: '#FF1744' },
                ]}
              >
                <Ionicons name="arrow-down" size={12} color={performanceView === 'losers' ? '#FF1744' : colors.textMuted} />
                <Text
                  style={[
                    styles.perfBtnCount,
                    { color: performanceView === 'losers' ? '#FF1744' : colors.textMuted },
                  ]}
                >
                  {losersCount}
                </Text>
              </TouchableOpacity>
              {/* Sort Menu Button */}
              <AnimatedPressable onPress={() => setShowSortMenu(true)} haptic="light" scaleTo={0.92}>
                <View style={[styles.sortBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <Ionicons name="funnel" size={18} color={colors.primary} />
                </View>
              </AnimatedPressable>
            </View>
          </View>
        </View>

        {/* Active Sort Indicator */}
        <View style={[styles.sortIndicator, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="funnel" size={14} color={colors.textMuted} />
          <Text style={[styles.sortIndicatorText, { color: colors.textSecondary }]}>
            Sorted by: {SORT_OPTIONS.find(o => o.field === sortBy)?.label} ({sortDir === 'asc' ? 'Asc' : 'Desc'})
          </Text>
          <TouchableOpacity onPress={toggleSortDir} style={styles.sortDirToggle}>
            <Ionicons name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'} size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Filter Chips Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterChipsScroll}
          contentContainerStyle={styles.filterChipsContent}
        >
          {/* Sector chips */}
          {uniqueSectors.map(sector => {
            const isActive = activeSector === sector;
            return (
              <TouchableOpacity
                key={`sector-${sector}`}
                onPress={() => setActiveSector(isActive ? null : sector)}
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.bgCard, borderColor: colors.border },
                  isActive && { backgroundColor: colors.primary + '25', borderColor: colors.primary },
                ]}
              >
                <Ionicons
                  name={(SECTOR_ICONS[sector] || 'business') as any}
                  size={13}
                  color={isActive ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.filterChipText, { color: isActive ? colors.primary : colors.textSecondary }]}>
                  {sector}
                </Text>
              </TouchableOpacity>
            );
          })}
          {/* Market Cap chips */}
          {MARKET_CAP_CHIPS.map(cap => {
            const isActive = activeMarketCap === cap;
            return (
              <TouchableOpacity
                key={`mcap-${cap}`}
                onPress={() => setActiveMarketCap(isActive ? null : cap)}
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.bgCard, borderColor: colors.border },
                  isActive && { backgroundColor: colors.secondary + '25', borderColor: colors.secondary },
                ]}
              >
                <Ionicons
                  name="stats-chart"
                  size={13}
                  color={isActive ? colors.secondary : colors.textMuted}
                />
                <Text style={[styles.filterChipText, { color: isActive ? colors.accent : colors.textSecondary }]}>
                  {cap}
                </Text>
              </TouchableOpacity>
            );
          })}
          {/* Top Movers chip */}
          <TouchableOpacity
            onPress={() => setActiveTopMovers(!activeTopMovers)}
            style={[
              styles.filterChip,
              { backgroundColor: colors.bgCard, borderColor: colors.border },
              activeTopMovers && { backgroundColor: '#FF6D0025', borderColor: '#FF6D00' },
            ]}
          >
            <Ionicons
              name="flash"
              size={13}
              color={activeTopMovers ? '#FF6D00' : colors.textMuted}
            />
            <Text style={[styles.filterChipText, { color: activeTopMovers ? '#FF6D00' : colors.textSecondary }]}>
              Top Movers
            </Text>
          </TouchableOpacity>

          {/* Clear filters */}
          {hasActiveFilters && (
            <TouchableOpacity
              onPress={clearFilters}
              style={[styles.filterChip, styles.filterChipClear, { borderColor: colors.border }]}
            >
              <Ionicons name="close-circle" size={13} color={colors.textMuted} />
              <Text style={[styles.filterChipText, { color: colors.textMuted }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Watchlist Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          {/* Combined "All" tab */}
          {watchlists.length > 1 && (
            <AnimatedPressable
              key={ALL_WATCHLIST_ID}
              onPress={() => setActiveWatchlist(ALL_WATCHLIST_ID)}
              haptic="selection"
              scaleTo={0.95}
              highlight
              highlightColor={colors.primary}
              borderRadius={BORDER_RADIUS.full}
            >
              <Animated.View
                style={[
                  styles.tab,
                  styles.allTab,
                  { backgroundColor: colors.bgCard, borderColor: colors.border },
                  isAllView && {
                    backgroundColor: colors.secondary + '30',
                    borderColor: colors.secondary,
                  },
                ]}
              >
                <Ionicons
                  name="layers"
                  size={16}
                  color={isAllView ? colors.secondary : colors.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.tabText,
                    isAllView && { color: colors.secondary },
                  ]}
                >
                  All ({combinedStocks.length})
                </Text>
              </Animated.View>
            </AnimatedPressable>
          )}
          {watchlists.map(w => (
            <AnimatedPressable
              key={w.id}
              onPress={() => setActiveWatchlist(w.id)}
              haptic="selection"
              scaleTo={0.95}
              highlight
              highlightColor={colors.primary}
              borderRadius={BORDER_RADIUS.full}
            >
              <Animated.View
                style={[
                  styles.tab,
                  { backgroundColor: colors.bgCard, borderColor: colors.border },
                  activeWatchlist === w.id && {
                    backgroundColor: colors.primary + '30',
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text style={[styles.tabText, activeWatchlist === w.id && styles.tabTextActive]}>
                  {w.name} ({w.stocks.length})
                </Text>
              </Animated.View>
            </AnimatedPressable>
          ))}
          <AnimatedPressable onPress={() => setShowCreate(true)} haptic="light" scaleTo={0.9}>
            <View style={styles.addTab}>
              <Ionicons name="add" size={20} color={colors.primary} />
            </View>
          </AnimatedPressable>
        </ScrollView>

        {/* Create Watchlist */}
        {showCreate && (
          <Animated.View style={styles.createContainer}>
            <TextInput
              style={styles.createInput}
              placeholder="Watchlist name..."
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.createActions}>
              <Button
                title="Cancel"
                variant="ghost"
                size="small"
                onPress={() => { setShowCreate(false); setNewName(''); }}
              />
              <Button title="Create" size="small" onPress={handleCreate} />
            </View>
          </Animated.View>
        )}

        {/* Watchlist Content */}
        {(currentWatchlist || isAllView) && (
          <View style={styles.content}>
            {sortedStocks.length > 0 ? (
              sortedStocks.map((stock, i) => {
                const stockAlerts = getStockAlert(stock.symbol);
                // Find which watchlists this stock belongs to
                const stockSources = isAllView
                  ? combinedStocks.find(e => e.stock.id === stock.id)?.sources || []
                  : [];
                return (
                  <Animated.View key={stock.id} style={getWatchlistStyle(i)}>
                    <StockItem
                      stock={stock}
                      onPress={(s) => navigation.navigate('StockDetail', { stockId: s.id, symbol: s.symbol })}
                      onLongPress={(s) => openAlertModal(s)}
                      showActions
                      isInWatchlist
                      onWatchlistToggle={(s) => {
                        if (isAllView && stockSources.length > 1) {
                          // Show a picker when removing from combined view
                          Alert.alert(
                            'Remove from Watchlist',
                            `Remove ${stock.symbol} from which watchlist?`,
                            [
                              ...stockSources.map(src => ({
                                text: src.name,
                                onPress: () => removeFromWatchlist(src.id, s.id, s.symbol),
                              })),
                              { text: 'Cancel', style: 'cancel' },
                            ]
                          );
                        } else if (isAllView && stockSources.length === 1) {
                          removeFromWatchlist(stockSources[0].id, s.id, s.symbol);
                        } else if (currentWatchlist) {
                          removeFromWatchlist(currentWatchlist.id, s.id, s.symbol);
                        }
                      }}
                    />
                    {/* Stock action row: watchlist badges + alert bell */}
                    <View style={[styles.stockActions, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
                      <View style={styles.stockActionLeft}>
                        {/* Watchlist source badges (combined view) */}
                        {isAllView && stockSources.length > 0 && (
                          <View style={styles.wlBadgesRow}>
                            {stockSources.map(src => (
                              <TouchableOpacity
                                key={src.id}
                                onPress={() => setActiveWatchlist(src.id)}
                                style={[styles.wlBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
                              >
                                <Ionicons name="folder" size={10} color={colors.primary} />
                                <Text style={[styles.wlBadgeText, { color: colors.primary }]}>{src.name}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                        {/* Alert indicator */}
                        {stockAlerts.length > 0 ? (
                          <View style={[styles.alertIndicator, { backgroundColor: '#FFC10720', borderColor: '#FFC107', marginTop: isAllView && stockSources.length > 0 ? 4 : 0 }]}>
                            <Ionicons name="notifications" size={14} color="#FFC107" />
                            <Text style={[styles.alertIndicatorText, { color: '#FFC107' }]}>
                              {stockAlerts.length} alert{stockAlerts.length > 1 ? 's' : ''}
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.noAlertText, { marginTop: isAllView && stockSources.length > 0 ? 4 : 0 }]}>
                            No alerts set
                          </Text>
                        )}
                      </View>
                      <View style={styles.stockActionRight}>
                        <TouchableOpacity
                          onPress={() => openAlertModal(stock)}
                          style={[styles.stockActionBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
                        >
                          <Ionicons name="notifications-outline" size={16} color={colors.primary} />
                          <Text style={[styles.stockActionBtnText, { color: colors.primary }]}>Alert</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Animated.View>
                );
              })
            ) : (
              <Animated.View style={styles.emptyState}>
                <LinearGradient colors={GRADIENTS.card} style={styles.emptyCard}>
                  <Ionicons name={isAllView ? 'layers-outline' : 'heart-outline'} size={64} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>
                    {isAllView ? 'No Stocks Yet' : 'Empty Watchlist'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {isAllView
                      ? 'Add stocks to any watchlist to see them here'
                      : 'Add stocks from the Markets tab to track them here'}
                  </Text>
                </LinearGradient>
              </Animated.View>
            )}

            {/* Suggested Stocks */}
            {availableStocks.length > 0 && currentWatchlist && (
              <>
                <View style={styles.suggestedHeader}>
                  <Text style={styles.suggestedTitle}>Suggested Stocks</Text>
                  <Text style={styles.suggestedSub}>Tap + to add to watchlist</Text>
                </View>
                {availableStocks.slice(0, 5).map((stock, i) => (
                  <Animated.View key={stock.id} style={getSuggestedStyle(i)}>
                    <View style={styles.suggestedItem}>
                      <View style={{ flex: 1 }}>
                        <StockItem
                          stock={stock}
                          onPress={(s) => navigation.navigate('StockDetail', { stockId: s.id, symbol: s.symbol })}
                        />
                      </View>
                      <AnimatedPressable
                        onPress={() => addToWatchlist(currentWatchlist.id, stock)}
                        haptic="light"
                        scaleTo={0.9}
                      >
                        <Ionicons name="add-circle" size={28} color={colors.primary} />
                      </AnimatedPressable>
                    </View>
                  </Animated.View>
                ))}
              </>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sort Menu Modal */}
      {renderSortMenu()}

      {/* Price Alert Modal */}
      {renderAlertModal()}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: 20 },
  header: { paddingTop: 60, paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...FONTS.bold, fontSize: FONTS.size.title, color: colors.text },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.md, color: colors.textSecondary, marginTop: 4 },

  // Performance quick-toggle buttons
  perfBtn: {
    flexDirection: 'row',
    height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 8, gap: 3,
    borderWidth: 1,
  },
  perfBtnCount: { ...FONTS.semiBold, fontSize: 11 },

  // Sort
  sortBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  sortIndicator: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  sortIndicatorText: { flex: 1, ...FONTS.regular, fontSize: FONTS.size.xs, marginLeft: SPACING.sm },
  sortDirToggle: { padding: 4 },

  // Sort Menu
  sortOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  sortMenu: { width: width * 0.75, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg },
  sortMenuTitle: { ...FONTS.bold, fontSize: FONTS.size.lg, marginBottom: SPACING.lg },
  sortOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.md, borderRadius: BORDER_RADIUS.sm, marginBottom: 4 },
  sortOptionText: { ...FONTS.medium, fontSize: FONTS.size.md, marginLeft: SPACING.md, flex: 1 },
  sortDirIcon: { marginLeft: 'auto' },

  // Filter Chips
  filterChipsScroll: { marginBottom: SPACING.sm },
  filterChipsContent: { paddingHorizontal: SPACING.xl, gap: SPACING.sm, alignItems: 'center' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  filterChipClear: { opacity: 0.8 },
  filterChipText: { ...FONTS.medium, fontSize: FONTS.size.xs },

  // Tabs
  tabsScroll: { paddingLeft: SPACING.xl, marginBottom: SPACING.lg },
  tab: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1, marginRight: SPACING.sm },
  allTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md },
  tabText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  addTab: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' },

  // Create
  createContainer: { marginHorizontal: SPACING.xl, backgroundColor: colors.bgCard, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.lg, borderWidth: 1, borderColor: colors.primary },
  createInput: { backgroundColor: colors.bgInput, borderRadius: BORDER_RADIUS.sm, padding: SPACING.md, color: colors.text, fontSize: FONTS.size.md, fontFamily: 'System', },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.md },
  content: { paddingHorizontal: SPACING.xl },

  // Watchlist Source Badges (combined view)
  wlBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  wlBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  wlBadgeText: { ...FONTS.medium, fontSize: 10 },

  // Stock Actions Row
  stockActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, marginTop: -SPACING.sm, marginBottom: SPACING.sm, marginHorizontal: 2 },
  stockActionLeft: { flex: 1 },
  stockActionRight: { flexDirection: 'row', gap: SPACING.sm },
  alertIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full, borderWidth: 1, alignSelf: 'flex-start' },
  alertIndicatorText: { ...FONTS.medium, fontSize: FONTS.size.xs },
  noAlertText: { ...FONTS.regular, fontSize: FONTS.size.xs },
  stockActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  stockActionBtnText: { ...FONTS.medium, fontSize: FONTS.size.xs },

  // Empty
  emptyState: { marginVertical: SPACING.xxxl },
  emptyCard: { alignItems: 'center', padding: SPACING.xxxl, borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { ...FONTS.semiBold, fontSize: FONTS.size.lg, color: colors.text, marginTop: SPACING.lg },
  emptySubtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted, textAlign: 'center', marginTop: SPACING.sm },

  // Suggested
  suggestedHeader: { marginTop: SPACING.xxl, marginBottom: SPACING.md },
  suggestedTitle: { ...FONTS.semiBold, fontSize: FONTS.size.lg, color: colors.text },
  suggestedSub: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted, marginTop: 2 },
  suggestedItem: { flexDirection: 'row', alignItems: 'center' },

  // Alert Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, padding: SPACING.xl, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { ...FONTS.bold, fontSize: FONTS.size.xl },

  alertInfoCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.lg },
  alertInfoLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  alertInfoValue: { ...FONTS.bold, fontSize: FONTS.size.xl },
  alertChangeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  alertChangeText: { ...FONTS.medium, fontSize: FONTS.size.sm },

  alertSectionLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, marginBottom: SPACING.sm },
  alertDirectionRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  alertDirBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
  alertDirText: { ...FONTS.semiBold, fontSize: FONTS.size.md },

  alertPriceInput: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, ...FONTS.bold, fontSize: FONTS.size.xxl, textAlign: 'center', marginBottom: SPACING.lg },

  alertPresetsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  alertPreset: { flex: 1, alignItems: 'center', paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.sm, borderWidth: 1 },
  alertPresetLabel: { ...FONTS.regular, fontSize: 9 },
  alertPresetValue: { ...FONTS.bold, fontSize: FONTS.size.xs, marginTop: 2 },

  alertConfirmBtn: { marginTop: SPACING.sm },
  alertConfirmGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md },
  alertConfirmText: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: '#fff' },
});
