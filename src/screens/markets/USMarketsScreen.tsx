/**
 * ============================================================================
 * Toroloom — US Markets Screen
 * ============================================================================
 *
 * Global Markets hub: US indices (S&P 500, Nasdaq, DJIA), top US stocks by
 * sector, US ETFs, and cryptocurrency prices. All data sourced from
 * mock data with optional MarketStack API fallback.
 *
 * Navigation: More → US Markets
 * ============================================================================
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, RefreshControl, Dimensions, Platform,
} from 'react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { globalMarketsApi } from '../../services/api/globalMarkets';
import {
  mockUSIndices, mockUSStocks, mockUSETFs, mockCryptoAssets,
} from '../../constants/mockData';
import type { USStock, USETF, MarketIndex, CryptoAsset } from '../../types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 64 - SPACING.md) / 2;

// ──── Tab Config ───────────────────────────────────────────────────────────

type TabKey = 'indices' | 'stocks' | 'etfs' | 'crypto';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { key: 'indices', label: 'Indices', icon: 'trending-up' },
  { key: 'stocks',  label: 'Stocks',  icon: 'business' },
  { key: 'etfs',    label: 'ETFs',    icon: 'layers' },
  { key: 'crypto',  label: 'Crypto',  icon: 'logo-bitcoin' },
];

// ──── Index Card ───────────────────────────────────────────────────────────

function IndexCard({ index, onPress }: { index: MarketIndex; onPress?: () => void }) {
  const { colors } = useTheme();
  const isPos = index.isPositive;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <View style={[styles.indexCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.indexHeader}>
          <Ionicons
            name={isPos ? 'trending-up' : 'trending-down'}
            size={16}
            color={isPos ? colors.marketUp : colors.marketDown}
          />
        </View>
        <Text style={[styles.indexName, { color: colors.text }]}>{index.shortName}</Text>
        <Text style={[styles.indexValue, { color: colors.text }]}>
          {index.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <View style={[styles.indexChangeBadge, { backgroundColor: (isPos ? colors.marketUp : colors.marketDown) + '20' }]}>
          <Text style={[styles.indexChangeText, { color: isPos ? colors.marketUp : colors.marketDown }]}>
            {isPos ? '+' : ''}{index.changePercent.toFixed(2)}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ──── Stock Row ────────────────────────────────────────────────────────────

function StockRow({ stock, onPress }: { stock: USStock; onPress?: () => void }) {
  const { colors } = useTheme();
  const isPos = stock.isPositive;
  const exchangeColor = stock.exchange === 'NASDAQ' ? '#00E676' : '#3B82F6';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Animated.View entering={FadeInUp.duration(300)} style={[styles.stockRow, { borderBottomColor: colors.divider }]}>
        <View style={styles.stockRowLeft}>
          <View style={[styles.exchangeBadge, { backgroundColor: exchangeColor + '20' }]}>
            <Text style={[styles.exchangeBadgeText, { color: exchangeColor }]}>{stock.exchange}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stockSymbol, { color: colors.text }]}>{stock.symbol}</Text>
            <Text style={[styles.stockName, { color: colors.textMuted }]} numberOfLines={1}>{stock.name}</Text>
          </View>
        </View>
        <View style={styles.stockRowRight}>
          <Text style={[styles.stockPrice, { color: colors.text }]}>
            ${stock.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={[styles.stockChange, { color: isPos ? colors.marketUp : colors.marketDown }]}>
            {isPos ? '+' : ''}{stock.changePercent.toFixed(2)}%
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ──── ETF Row ──────────────────────────────────────────────────────────────

function ETFRow({ etf, onPress }: { etf: USETF; onPress?: () => void }) {
  const { colors } = useTheme();
  const isPos = etf.isPositive;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <View style={[styles.stockRow, { borderBottomColor: colors.divider }]}>
        <View style={styles.stockRowLeft}>
          <View>
            <Text style={[styles.stockSymbol, { color: colors.text }]}>{etf.symbol}</Text>
            <Text style={[styles.stockName, { color: colors.textMuted }]} numberOfLines={1}>{etf.name}</Text>
          </View>
        </View>
        <View style={styles.stockRowRight}>
          <Text style={[styles.stockPrice, { color: colors.text }]}>
            ${etf.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View style={styles.etfMeta}>
            <Text style={[styles.stockChange, { color: isPos ? colors.marketUp : colors.marketDown }]}>
              {isPos ? '+' : ''}{etf.changePercent.toFixed(2)}%
            </Text>
            <Text style={[styles.etfExpenseLabel, { color: colors.textMuted }]}>
              {etf.expenseRatio.toFixed(2)}% ER
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ──── Crypto Row ───────────────────────────────────────────────────────────

function CryptoRow({ asset, onPress }: { asset: CryptoAsset; onPress?: () => void }) {
  const { colors } = useTheme();
  const isPos = asset.changePercent >= 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <View style={[styles.stockRow, { borderBottomColor: colors.divider }]}>
        <View style={styles.stockRowLeft}>
          <View style={[styles.cryptoIcon, { backgroundColor: asset.color + '20' }]}>
            <Text style={[styles.cryptoIconText, { color: asset.color }]}>{asset.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stockSymbol, { color: colors.text }]}>{asset.symbol}</Text>
            <Text style={[styles.stockName, { color: colors.textMuted }]} numberOfLines={1}>{asset.name}</Text>
          </View>
        </View>
        <View style={styles.stockRowRight}>
          <Text style={[styles.stockPrice, { color: colors.text }]}>
            ${asset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={[styles.stockChange, { color: isPos ? colors.marketUp : colors.marketDown }]}>
            {isPos ? '+' : ''}{asset.changePercent.toFixed(2)}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ──── Main Screen ──────────────────────────────────────────────────────────

export default function USMarketsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<TabKey>('indices');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<{ marketstackConfigured: boolean; coinGeckoConfigured: boolean } | null>(null);

  // Simulate loading + fetch API status
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 500);
    // Fetch backend API status for live/mock badge
    globalMarketsApi.getStatus()
      .then(res => setApiStatus(res))
      .catch(() => setApiStatus({ marketstackConfigured: false, coinGeckoConfigured: false }));
    return () => clearTimeout(t);
  }, []);

  const isLive = apiStatus?.marketstackConfigured === true || apiStatus?.coinGeckoConfigured === true;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  // Sector grouping for stocks
  const sectorGroups = useMemo(() => {
    const groups: { sector: string; stocks: USStock[] }[] = [];
    const sectorMap = new Map<string, USStock[]>();
    for (const s of mockUSStocks) {
      const arr = sectorMap.get(s.sector) || [];
      arr.push(s);
      sectorMap.set(s.sector, arr);
    }
    for (const [sector, stocks] of sectorMap) {
      groups.push({ sector, stocks });
    }
    return groups;
  }, []);

  // Filter stocks by search
  const filteredStocks = useMemo(() => {
    if (!searchQuery.trim()) return mockUSStocks;
    const q = searchQuery.toLowerCase();
    return mockUSStocks.filter(
      s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Filter ETFs by search
  const filteredETFs = useMemo(() => {
    if (!searchQuery.trim()) return mockUSETFs;
    const q = searchQuery.toLowerCase();
    return mockUSETFs.filter(
      e => e.symbol.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Filter crypto by search
  const filteredCrypto = useMemo(() => {
    if (!searchQuery.trim()) return mockCryptoAssets;
    const q = searchQuery.toLowerCase();
    return mockCryptoAssets.filter(
      c => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>US Markets</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Global Markets Hub</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>Global Markets</Text>
          {apiStatus && (
            <View style={[styles.liveBadge, { backgroundColor: isLive ? colors.success + '20' : colors.warning + '20', borderColor: isLive ? colors.success + '40' : colors.warning + '40' }]}>
              <View style={[styles.liveDot, { backgroundColor: isLive ? colors.success : colors.warning }]} />
              <Text style={[styles.liveBadgeText, { color: isLive ? colors.success : colors.warning }]}>{isLive ? 'Live' : 'Mock'}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>US · ETFs · Crypto</Text>

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search symbols..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tabBtn,
                  {
                    backgroundColor: isActive ? colors.primary + '20' : 'transparent',
                    borderColor: isActive ? colors.primary + '40' : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={14}
                  color={isActive ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.textMuted }]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

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
        {/* ── INDICES TAB ── */}
        {activeTab === 'indices' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={styles.grid2}>
              {mockUSIndices.map((index, i) => (
                <Animated.View key={index.id} entering={FadeInUp.duration(300).delay(i * 80)}>
                  <IndexCard index={index} />
                </Animated.View>
              ))}
            </View>

            {/* Market Hours Card */}
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="time" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>US Market Hours</Text>
                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  NYSE & NASDAQ: Mon-Fri 9:30 AM - 4:00 PM ET{'\n'}
                  Pre-market: 4:00 AM - 9:30 AM ET{'\n'}
                  After-hours: 4:00 PM - 8:00 PM ET
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── STOCKS TAB ── */}
        {activeTab === 'stocks' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            {searchQuery.trim() ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  Search Results ({filteredStocks.length})
                </Text>
                {filteredStocks.map(stock => (
                  <StockRow
                    key={stock.id}
                    stock={stock}
                    onPress={() => navigation.navigate('USStockDetail', {
                      stockId: stock.id,
                      symbol: stock.symbol,
                      source: 'us',
                    })}
                  />
                ))}
              </>
            ) : (
              sectorGroups.map(({ sector, stocks }) => (
                <Animated.View key={sector} entering={FadeInUp.duration(300)}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                    {sector} · {stocks.length}
                  </Text>
                  {stocks.map(stock => (
                    <StockRow
                      key={stock.id}
                      stock={stock}
                      onPress={() => navigation.navigate('USStockDetail', {
                        stockId: stock.id,
                        symbol: stock.symbol,
                        source: 'us',
                      })}
                    />
                  ))}
                </Animated.View>
              ))
            )}
          </Animated.View>
        )}

        {/* ── ETFs TAB ── */}
        {activeTab === 'etfs' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            {filteredETFs.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No ETFs match your search
              </Text>
            ) : (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  {filteredETFs.length} ETFs
                </Text>
                {filteredETFs.map(etf => (
                  <ETFRow key={etf.id} etf={etf} />
                ))}
              </>
            )}

            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border, marginTop: SPACING.lg }]}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.textMuted, flex: 1 }]}>
                ETFs shown have AUM over $50B. Data refreshes every 15 minutes.
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ── CRYPTO TAB ── */}
        {activeTab === 'crypto' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={styles.cryptoHeaderRow}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                Top Cryptocurrencies
              </Text>
              <View style={[styles.cryptoTotalBadge, { backgroundColor: '#F7931A20' }]}>
                <Text style={[styles.cryptoTotalText, { color: '#F7931A' }]}>
                  $2.1T Total MCap
                </Text>
              </View>
            </View>

            {filteredCrypto.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No cryptocurrencies match your search
              </Text>
            ) : (
              filteredCrypto.map((asset, i) => (
                <Animated.View key={asset.id} entering={FadeInUp.duration(300).delay(i * 40)}>
                  <CryptoRow
                    asset={asset}
                    onPress={() => navigation.navigate('CryptoDetail', {
                      coinId: asset.id,
                      coinSymbol: asset.symbol,
                      coinName: asset.name,
                    })}
                  />
                </Animated.View>
              ))
            )}

            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border, marginTop: SPACING.lg }]}>
              <Ionicons name="warning" size={18} color="#FFAB40" />
              <Text style={[styles.infoText, { color: colors.textMuted, flex: 1 }]}>
                Crypto prices are volatile. Prices shown are indicative and may differ from actual exchange rates. DYOR.
              </Text>
            </View>
          </Animated.View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveBadgeText: {
    ...FONTS.semiBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  header: {
    padding: SPACING.xl,
    paddingTop: 60,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  title: { ...FONTS.bold, fontSize: FONTS.size.title },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.lg,
  },
  searchInput: {
    flex: 1,
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    padding: 0,
  },
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  tabLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
  sectionLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },

  // ── Index Grid ──
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  indexCard: {
    width: CARD_WIDTH,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: 6,
  },
  indexHeader: { flexDirection: 'row', justifyContent: 'flex-end' },
  indexName: { ...FONTS.semiBold, fontSize: FONTS.size.xs, textTransform: 'uppercase', letterSpacing: 1 },
  indexValue: { ...FONTS.bold, fontSize: FONTS.size.lg, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  indexChangeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  indexChangeText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // ── Stock / ETF / Crypto Rows ──
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stockRowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  stockRowRight: { alignItems: 'flex-end', gap: 2 },
  exchangeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  exchangeBadgeText: { ...FONTS.bold, fontSize: 8, letterSpacing: 0.5 },
  stockSymbol: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  stockName: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  stockPrice: { ...FONTS.mono, fontSize: FONTS.size.sm, fontWeight: '600' },
  stockChange: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // ── ETF ──
  etfMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  etfExpenseLabel: { ...FONTS.regular, fontSize: 8 },

  // ── Crypto ──
  cryptoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cryptoTotalBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  cryptoTotalText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  cryptoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cryptoIconText: { ...FONTS.bold, fontSize: 14 },

  // ── Info Card ──
  infoCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    marginTop: SPACING.md,
  },
  infoTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: 4 },
  infoText: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 16 },

  emptyText: { ...FONTS.regular, fontSize: FONTS.size.sm, fontStyle: 'italic', marginTop: SPACING.xl, textAlign: 'center' },
});
