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
  TextInput, RefreshControl, Dimensions, Platform, ActivityIndicator,
} from 'react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useNavigation } from '@react-navigation/native';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { globalMarketsApi, type GlobalStockData, type USStockData, type GlobalIndexData } from '../../services/api/globalMarkets';
import {
  mockUSIndices, mockGlobalIndices, mockUSStocks, mockEuropeanStocks, mockAsianStocks, mockUSETFs, mockCryptoAssets,
} from '../../constants/mockData';
import type { USStock, InternationalStock, USETF, MarketIndex, CryptoAsset } from '../../types';

// ──── Helper: merge API GlobalStockData into InternationalStock mock ───
function mergeApiToIntl(apiStock: GlobalStockData, mockFallback: InternationalStock): InternationalStock {
  return {
    ...mockFallback,
    price: apiStock.price,
    change: apiStock.change,
    changePercent: apiStock.changePercent,
    isPositive: apiStock.isPositive,
    volume: apiStock.volume,
    high52: apiStock.high52 ?? mockFallback.high52,
    low52: apiStock.low52 ?? mockFallback.low52,
  };
}

// ──── Helper: merge API USStockData into USStock mock ────────────────
function mergeApiToUsStock(apiStock: USStockData, mockFallback: USStock): USStock {
  return {
    ...mockFallback,
    price: apiStock.price,
    change: apiStock.change,
    changePercent: apiStock.changePercent,
    isPositive: apiStock.isPositive,
    volume: apiStock.volume,
    high52: apiStock.high52 ?? mockFallback.high52,
    low52: apiStock.low52 ?? mockFallback.low52,
  };
}

function buildUsStockList(apiData: USStockData[], mockData: USStock[]): USStock[] {
  if (!apiData || apiData.length === 0) return mockData;
  const mockMap = new Map(mockData.map(s => [s.symbol, s]));
  return apiData.map(api => {
    const mock = mockMap.get(api.symbol);
    if (mock) return mergeApiToUsStock(api, mock);
    return {
      id: api.symbol,
      symbol: api.symbol,
      name: api.name,
      sector: api.sector,
      price: api.price,
      change: api.change,
      changePercent: api.changePercent,
      isPositive: api.isPositive,
      marketCap: api.marketCap,
      volume: api.volume,
      high52: api.high52 ?? Math.round(api.price * 1.2),
      low52: api.low52 ?? Math.round(api.price * 0.8),
      pe: api.pe,
      pb: 0,
      dividend: api.dividend,
      exchange: api.exchange as 'NASDAQ' | 'NYSE' | 'NYSE Arca',
    };
  });
}

// ──── Helper: merge API GlobalIndexData into MarketIndex mock ────────
function mergeApiToIndex(apiItem: GlobalIndexData, mockFallback: MarketIndex): MarketIndex {
  return {
    ...mockFallback,
    currentValue: apiItem.price,
    change: apiItem.change,
    changePercent: apiItem.changePercent,
    isPositive: apiItem.change >= 0,
    region: apiItem.region as 'us' | 'europe' | 'asia',
  };
}

function buildIndexList(apiData: GlobalIndexData[], mockData: MarketIndex[]): MarketIndex[] {
  if (!apiData || apiData.length === 0) return mockData;
  // Match by name — both mock and API share the same display name
  const mockMap = new Map(mockData.map(s => [s.name, s]));
  return apiData.map(api => {
    const mock = mockMap.get(api.name);
    if (mock) return mergeApiToIndex(api, mock);
    return {
      id: api.symbol,
      name: api.name,
      shortName: api.symbol,
      currentValue: api.price,
      change: api.change,
      changePercent: api.changePercent,
      isPositive: api.change >= 0,
      icon: 'trending-up',
      region: api.region as 'us' | 'europe' | 'asia',
    };
  });
}

function buildIntlStockList(apiData: GlobalStockData[], mockData: InternationalStock[]): InternationalStock[] {
  if (!apiData || apiData.length === 0) return mockData;
  const mockMap = new Map(mockData.map(s => [s.symbol, s]));
  return apiData.map(api => {
    const mock = mockMap.get(api.symbol);
    if (mock) return mergeApiToIntl(api, mock);
    // API returned a stock not in mock — build from scratch with defaults
    return {
      id: api.symbol,
      symbol: api.symbol,
      name: api.name,
      sector: api.sector,
      price: api.price,
      change: api.change,
      changePercent: api.changePercent,
      isPositive: api.isPositive,
      marketCap: api.marketCap,
      volume: api.volume,
      high52: api.high52 ?? Math.round(api.price * 1.2),
      low52: api.low52 ?? Math.round(api.price * 0.8),
      pe: api.pe,
      pb: 0,
      dividend: api.dividend,
      exchange: api.exchange,
      region: api.region as 'europe' | 'asia',
      currency: api.currency as any,
      country: api.country,
    };
  });
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 64 - SPACING.md) / 2;

// ──── Tab Config ───────────────────────────────────────────────────────────

type TabKey = 'indices' | 'global' | 'stocks' | 'etfs' | 'crypto';

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

// Currency prefix map for international stocks
const CURRENCY_PREFIX: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', CHF: 'CHF ', JPY: '¥', HKD: 'HK$',
  CNY: '¥', AUD: 'A$', KRW: '₩', SGD: 'S$', TWD: 'NT$', THB: '฿', INR: '₹',
};

function getCurrencyPrefix(stock: USStock | InternationalStock): string {
  if ('currency' in stock) return CURRENCY_PREFIX[(stock as InternationalStock).currency] || '$';
  return '$';
}

function StockRow({ stock, onPress }: { stock: USStock | InternationalStock; onPress?: () => void }) {
  const { colors } = useTheme();
  const isPos = stock.isPositive;
  const exchangeColor = stock.exchange === 'NASDAQ' ? '#00E676' :
    stock.exchange === 'NYSE' ? '#3B82F6' :
    stock.exchange === 'LSE' ? '#00A86B' :
    stock.exchange === 'Xetra' ? '#0052CC' :
    stock.exchange === 'TSE' ? '#E6007A' :
    stock.exchange === 'HKEX' ? '#FF5252' :
    stock.exchange === 'NSE' ? '#FF9933' :
    stock.exchange === 'ASX' ? '#FF6B35' : '#8B5CF6';
  const prefix = getCurrencyPrefix(stock);

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
            {prefix}{stock.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
  const { t } = useT();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<TabKey>('indices');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<{ marketstackConfigured: boolean; coinGeckoConfigured: boolean } | null>(null);

  // Live stocks from backend
  const [usStocks, setUsStocks] = useState<USStock[]>(mockUSStocks);
  const [euStocks, setEuStocks] = useState<InternationalStock[]>(mockEuropeanStocks);
  const [asiaStocks, setAsiaStocks] = useState<InternationalStock[]>(mockAsianStocks);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stocksLive, setStocksLive] = useState(false);

  // Live indices from backend
  const [liveIndices, setLiveIndices] = useState<MarketIndex[]>([]);
  const [indicesLive, setIndicesLive] = useState(false);

  // Last updated timestamp
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Tab config (useT required — defined inside component for t() access)
  const TABS = useMemo(() => [
    { key: 'indices' as TabKey, label: t('usMarkets.usIndices'), icon: 'trending-up' },
    { key: 'global' as TabKey,  label: t('usMarkets.global'),     icon: 'globe' },
    { key: 'stocks' as TabKey,  label: t('usMarkets.stocks'),    icon: 'business' },
    { key: 'etfs' as TabKey,    label: t('usMarkets.etfs'),      icon: 'layers' },
    { key: 'crypto' as TabKey,  label: t('usMarkets.crypto'),    icon: 'logo-bitcoin' },
  ], [t]);

  // ── Fetch all stocks from backend ────────────────────────────────
  const fetchAllStocks = useCallback(async () => {
    setStocksLoading(true);
    const [us, eu, asia] = await Promise.all([
      globalMarketsApi.getStocks().catch(() => null as USStockData[] | null),
      globalMarketsApi.getEuropeanStocks().catch(() => null as GlobalStockData[] | null),
      globalMarketsApi.getAsianStocks().catch(() => null as GlobalStockData[] | null),
    ]);
    let anySucceeded = false;
    if (us) { setUsStocks(buildUsStockList(us, mockUSStocks)); anySucceeded = true; }
    if (eu) { setEuStocks(buildIntlStockList(eu, mockEuropeanStocks)); anySucceeded = true; }
    if (asia) { setAsiaStocks(buildIntlStockList(asia, mockAsianStocks)); anySucceeded = true; }
    if (anySucceeded) { setStocksLive(true); setLastUpdated(new Date()); }
    setStocksLoading(false);
  }, []);

  // ── Fetch global indices from backend ────────────────────────────
  const fetchAllIndices = useCallback(async () => {
    const apiIndices = await globalMarketsApi.getIndices().catch(() => null as GlobalIndexData[] | null);
    if (apiIndices && apiIndices.length > 0) {
      const allMock = [...mockUSIndices, ...mockGlobalIndices];
      setLiveIndices(buildIndexList(apiIndices, allMock));
      setIndicesLive(true);
      setLastUpdated(new Date());
    }
  }, []);

  // Initial load + fetch API status
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    // Fetch backend API status for live/mock badge
    globalMarketsApi.getStatus()
      .then(res => {
        setApiStatus(res);
        if (res.marketstackConfigured) {
          fetchAllStocks();
          fetchAllIndices();
        }
      })
      .catch(() => setApiStatus({ marketstackConfigured: false, coinGeckoConfigured: false }));
    return () => clearTimeout(timer);
  }, [fetchAllStocks, fetchAllIndices]);

  const isLive = apiStatus?.marketstackConfigured === true || apiStatus?.coinGeckoConfigured === true;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      fetchAllStocks(),
      fetchAllIndices(),
    ]).finally(() => setRefreshing(false));
  }, [fetchAllStocks, fetchAllIndices]);

  // Region-grouped stocks: US, European, Asian
  const regionStockData = useMemo(() => ({
    us: { label: t('usMarkets.usStocksSection'), stocks: usStocks as (USStock | InternationalStock)[] },
    europe: { label: t('usMarkets.euStocksSection'), stocks: euStocks as (USStock | InternationalStock)[] },
    asia: { label: t('usMarkets.asiaStocksSection'), stocks: asiaStocks as (USStock | InternationalStock)[] },
  }), [usStocks, euStocks, asiaStocks, t]);

  // Filter stocks by search across all regions
  const filteredStocks = useMemo(() => {
    const all = [...usStocks, ...euStocks, ...asiaStocks];
    if (!searchQuery.trim()) return all;
    const q = searchQuery.toLowerCase();
    return all.filter(
      (s: any) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );
  }, [searchQuery, usStocks, euStocks, asiaStocks]);

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
          <Text style={[styles.title, { color: colors.text }]}>{t('usMarkets.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('usMarkets.loadingSubtitle')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.text }]}>{t('usMarkets.title')}</Text>
          {apiStatus && (
            <View style={[styles.liveBadge, { backgroundColor: isLive ? colors.success + '20' : colors.warning + '20', borderColor: isLive ? colors.success + '40' : colors.warning + '40' }]}>
              <View style={[styles.liveDot, { backgroundColor: isLive ? colors.success : colors.warning }]} />
              <Text style={[styles.liveBadgeText, { color: isLive ? colors.success : colors.warning }]}>{isLive ? t('usMarkets.live') : t('usMarkets.mock')}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('usMarkets.regions')}</Text>

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('usMarkets.searchPlaceholder')}
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
        {/* ── US INDICES TAB ── */}
        {activeTab === 'indices' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={styles.grid2}>
              {(indicesLive ? liveIndices.filter(i => i.region === 'us') : mockUSIndices).map((index, i) => (
                <Animated.View key={index.id} entering={FadeInUp.duration(300).delay(i * 80)}>
                  <IndexCard index={index} />
                </Animated.View>
              ))}
            </View>

            {/* Market Hours Card */}
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="time" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>{t('usMarkets.usMarketHours')}</Text>
                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  {t('usMarkets.usMarketHoursDesc')}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── GLOBAL INDICES TAB ── */}
        {activeTab === 'global' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            {/* Europe Section */}
            <Text style={[styles.regionHeader, { color: colors.text }]}>
              <Ionicons name="location" size={14} color={colors.primary} />{' '}{t('usMarkets.europe')}
            </Text>
            <View style={styles.grid2}>
              {(indicesLive ? liveIndices.filter(i => i.region === 'europe') : mockGlobalIndices.filter(i => i.region === 'europe')).map((index, i) => (
                <Animated.View key={index.id} entering={FadeInUp.duration(300).delay(i * 60)}>
                  <IndexCard index={index} />
                </Animated.View>
              ))}
            </View>

            {/* Europe Market Hours */}
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="time" size={18} color="#0052CC" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>{t('usMarkets.euMarketHours')}</Text>
                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  {t('usMarkets.euMarketHoursDesc')}
                </Text>
              </View>
            </View>

            {/* Asia-Pacific Section */}
            <Text style={[styles.regionHeader, { color: colors.text, marginTop: SPACING.lg }]}>
              <Ionicons name="location" size={14} color="#FFC107" />{' '}{t('usMarkets.asiaPacific')}
            </Text>
            <View style={styles.grid2}>
              {(indicesLive ? liveIndices.filter(i => i.region === 'asia') : mockGlobalIndices.filter(i => i.region === 'asia')).map((index, i) => (
                <Animated.View key={index.id} entering={FadeInUp.duration(300).delay(i * 60)}>
                  <IndexCard index={index} />
                </Animated.View>
              ))}
            </View>

            {/* Asia Market Hours */}
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="time" size={18} color="#FFC107" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>{t('usMarkets.asiaMarketHours')}</Text>
                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  {t('usMarkets.asiaMarketHoursDesc')}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── STOCKS TAB ── */}
        {activeTab === 'stocks' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            {/* Live badge row */}
            {stocksLive && !searchQuery.trim() && (
              <View style={[styles.stocksLiveRow, { borderBottomColor: colors.divider }]}>
                <View style={[styles.stocksLiveBadge, { backgroundColor: colors.success + '20', borderColor: colors.success + '40' }]}>
                  <View style={[styles.stocksLiveDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.stocksLiveText, { color: colors.success }]}>{t('usMarkets.live')}</Text>
                </View>
              </View>
            )}
            {searchQuery.trim() ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  {t('usMarkets.searchResults')} ({filteredStocks.length})
                </Text>
                {filteredStocks.map((stock: any) => (
                  <StockRow
                    key={stock.id}
                    stock={stock}
                    onPress={() => {
                      const isUS = usStocks.find(s => s.id === stock.id);
                      if (isUS) {
                        navigation.navigate('USStockDetail', {
                          stockId: stock.id,
                          symbol: stock.symbol,
                          source: 'us',
                        });
                      } else {
                        navigation.navigate('GlobalStockDetail', {
                          stockId: stock.id,
                          symbol: stock.symbol,
                          region: (stock as InternationalStock).region,
                        });
                      }
                    }}
                  />
                ))}
              </>
            ) : (
              Object.entries(regionStockData).map(([regionKey, { label, stocks }]) => (
                <Animated.View key={regionKey} entering={FadeInUp.duration(300)}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                    {label} · {stocks.length}
                  </Text>
                  {stocks.slice(0, 8).map(stock => {
                    const intlStock = stock as InternationalStock;
                    const isIntl = 'region' in stock;
                    return (
                      <StockRow
                        key={stock.id}
                        stock={stock}
                        onPress={() => {
                          if (isIntl) {
                            navigation.navigate('GlobalStockDetail', {
                              stockId: stock.id,
                              symbol: stock.symbol,
                              region: intlStock.region,
                            });
                          } else {
                            navigation.navigate('USStockDetail', {
                              stockId: stock.id,
                              symbol: stock.symbol,
                              source: 'us',
                            });
                          }
                        }}
                      />
                    );
                  })}
                  {stocks.length > 8 && (
                    <Text style={[styles.seeMoreText, { color: colors.primary }]}>+ {stocks.length - 8} {t('usMarkets.more')}</Text>
                  )}
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
                {t('usMarkets.noEtfsMatch')}
              </Text>
            ) : (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  {filteredETFs.length} {t('usMarkets.etfs')}
                </Text>
                {filteredETFs.map(etf => (
                  <ETFRow key={etf.id} etf={etf} />
                ))}
              </>
            )}

            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border, marginTop: SPACING.lg }]}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.textMuted, flex: 1 }]}>
                {t('usMarkets.etfInfoText')}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* ── CRYPTO TAB ── */}
        {activeTab === 'crypto' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={styles.cryptoHeaderRow}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                {t('usMarkets.topCrypto')}
              </Text>
              <View style={[styles.cryptoTotalBadge, { backgroundColor: '#F7931A20' }]}>
                <Text style={[styles.cryptoTotalText, { color: '#F7931A' }]}>
                  {t('usMarkets.totalMcap')}
                </Text>
              </View>
            </View>

            {filteredCrypto.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('usMarkets.noCryptoMatch')}
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
                {t('usMarkets.cryptoWarning')}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Footer — Last Updated */}
        {lastUpdated && (
          <View style={styles.footer}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              {t('usMarkets.lastUpdated')} {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </Text>
          </View>
        )}
        <View style={{ height: 20 }} />
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
  regionHeader: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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

  // ── Stocks Live Badge ──
  stocksLiveRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: SPACING.xs,
  },
  stocksLiveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  stocksLiveDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  stocksLiveText: {
    ...FONTS.semiBold, fontSize: 9,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // ── Footer ──
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: SPACING.lg,
  },
  footerText: { ...FONTS.regular, fontSize: FONTS.size.xs },

  emptyText: { ...FONTS.regular, fontSize: FONTS.size.sm, fontStyle: 'italic', marginTop: SPACING.xl, textAlign: 'center' },
  seeMoreText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
});
