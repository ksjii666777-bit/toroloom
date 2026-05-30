import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, RefreshControl, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useWatchlistStore } from '../../store/watchlistStore';
import { useMarketStore } from '../../store/marketStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { Stock } from '../../types';
import StockItem from '../../components/StockItem';
import Button from '../../components/ui/Button';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { useStaggeredAnimation } from '../../hooks/useStaggeredAnimation';
import { SkeletonBlock, PortfolioSkeleton, SkeletonCard } from '../../components/ui/SkeletonLoader';

export default function WatchlistScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { watchlists, createWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlistStore();
  const { stocks } = useMarketStore();
  const [activeWatchlist, setActiveWatchlist] = useState(watchlists[0]?.id);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const currentWatchlist = watchlists.find(w => w.id === activeWatchlist);
  const watchlistStocks = currentWatchlist?.stocks || [];

  const isStockInWatchlist = (stockId: string) => {
    return watchlistStocks.some(s => s.id === stockId);
  };

  const availableStocks = stocks.filter(s => !isStockInWatchlist(s.id));

  const { getAnimatedStyle: getWatchlistStyle } = useStaggeredAnimation(watchlistStocks.length, {
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
          <Text style={styles.title}>Watchlist</Text>
          <Text style={styles.subtitle}>Monitor your favorite stocks</Text>
        </View>

        {/* Watchlist Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
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
        {currentWatchlist && (
          <View style={styles.content}>
            {watchlistStocks.length > 0 ? (
              watchlistStocks.map((stock, i) => (
                <Animated.View key={stock.id} style={getWatchlistStyle(i)}>
                  <StockItem
                    stock={stock}
                    onPress={(s) => navigation.navigate('StockDetail', { stockId: s.id, symbol: s.symbol })}
                    showActions
                    isInWatchlist
                    onWatchlistToggle={(s) => removeFromWatchlist(currentWatchlist.id, s.id, s.symbol)}
                  />
                </Animated.View>
              ))
            ) : (
              <Animated.View style={styles.emptyState}>
                <LinearGradient colors={GRADIENTS.card} style={styles.emptyCard}>
                  <Ionicons name="heart-outline" size={64} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>Empty Watchlist</Text>
                  <Text style={styles.emptySubtitle}>Add stocks from the Markets tab to track them here</Text>
                </LinearGradient>
              </Animated.View>
            )}

            {/* Suggested Stocks */}
            {availableStocks.length > 0 && (
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
  tabsScroll: {
    paddingLeft: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  tab: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: SPACING.sm,
  },
  tabText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  addTab: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  createContainer: {
    marginHorizontal: SPACING.xl,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  createInput: {
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    color: colors.text,
    fontSize: FONTS.size.md,
    fontFamily: 'System',
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  content: {
    paddingHorizontal: SPACING.xl,
  },
  emptyState: {
    marginVertical: SPACING.xxxl,
  },
  emptyCard: {
    alignItems: 'center',
    padding: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    marginTop: SPACING.lg,
  },
  emptySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  suggestedHeader: {
    marginTop: SPACING.xxl,
    marginBottom: SPACING.md,
  },
  suggestedTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  suggestedSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  suggestedItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
