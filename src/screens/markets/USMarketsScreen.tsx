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

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  TextInput, Dimensions, Platform,
} from 'react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useNavigation } from '@react-navigation/native';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { globalMarketsApi, type GlobalStockData, type USStockData, type GlobalIndexData, type CryptoAssetData } from '../../services/api/globalMarkets';
import { forexApi } from '../../services/api/forex';
import { getAllMarketStatuses, getMarketStatus, formatTimeUntilOpen, getMarketLocalClock, type MarketStatus } from '../../utils/marketStatus';
import { getHolidayCalendar, type HolidayCalendar } from '../../services/marketHolidayService';
import AppScreen from '../../components/ui/AppScreen';
import TrendSparkline from '../../components/ui/TrendSparkline';
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

function buildCryptoList(apiData: CryptoAssetData[], mockFallback: CryptoAsset[]): CryptoAsset[] {
  if (!apiData || apiData.length === 0) return mockFallback;
  return apiData.map(api => ({
    id: api.id,
    symbol: api.symbol,
    name: api.name,
    price: api.price,
    change: api.change,
    changePercent: api.changePercent,
    marketCap: api.marketCap,
    volume24h: api.volume24h,
    icon: api.icon,
    color: api.color,
  }));
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

// ──── Country Picker Config ───────────────────────────────────────────────
// Each country maps to: its index names (matching mock/Backend display names),
// its country string on InternationalStock, its currency-pair prefix, market
// hours info-card and flag.

interface CountryConfig {
  key: string;
  flag: string;
  /** Match names against MarketIndex.name (e.g. 'Nikkei 225 (Japan)') */
  indexNames: string[];
  /** Match against InternationalStock.country */
  stockCountry: string;
  /** IndexCard highlight names shown at top of the country view */
  heroIndices: string[];
  /** Currency pairs shown (prefix match against pair code) */
  currencyPairPrefixes: string[];
  /** i18n keys for the market-hours card */
  hoursTitleKey: string;
  hoursDescKey: string;
}

const COUNTRIES: CountryConfig[] = [
  {
    key: 'india', flag: '🇮🇳',
    indexNames: ['BSE Sensex (India)', 'Nifty 50 (India)'],
    stockCountry: 'India',
    heroIndices: ['SENSEX', 'NIFTY'],
    currencyPairPrefixes: ['USD/INR', 'EUR/INR', 'GBP/INR', 'JPY/INR'],
    hoursTitleKey: 'usMarkets.hoursIndiaTitle',
    hoursDescKey: 'usMarkets.hoursIndiaDesc',
  },
  {
    key: 'us', flag: '🇺🇸',
    indexNames: ['S&P 500', 'NASDAQ Composite', 'Dow Jones Industrial Avg.'],
    stockCountry: 'United States',
    heroIndices: ['S&P', 'NASDAQ', 'DOW'],
    currencyPairPrefixes: ['USD/INR', 'EUR/USD', 'USD/JPY'],
    hoursTitleKey: 'usMarkets.usMarketHours',
    hoursDescKey: 'usMarkets.usMarketHoursDesc',
  },
  {
    key: 'uk', flag: '🇬🇧',
    indexNames: ['FTSE 100 (UK)'],
    stockCountry: 'UK',
    heroIndices: ['FTSE'],
    currencyPairPrefixes: ['GBP/INR', 'GBP/USD'],
    hoursTitleKey: 'usMarkets.hoursUKTitle',
    hoursDescKey: 'usMarkets.hoursUKDesc',
  },
  {
    key: 'japan', flag: '🇯🇵',
    indexNames: ['Nikkei 225 (Japan)'],
    stockCountry: 'Japan',
    heroIndices: ['NIKKEI'],
    currencyPairPrefixes: ['USD/JPY', 'JPY/INR'],
    hoursTitleKey: 'usMarkets.hoursJapanTitle',
    hoursDescKey: 'usMarkets.hoursJapanDesc',
  },
  {
    key: 'germany', flag: '🇩🇪',
    indexNames: ['DAX 40 (Germany)'],
    stockCountry: 'Germany',
    heroIndices: ['DAX'],
    currencyPairPrefixes: ['EUR/INR', 'EUR/USD'],
    hoursTitleKey: 'usMarkets.hoursGermanyTitle',
    hoursDescKey: 'usMarkets.hoursGermanyDesc',
  },
  {
    key: 'china', flag: '🇨🇳',
    indexNames: ['Shanghai Composite (China)', 'Shenzhen Component (China)'],
    stockCountry: 'China',
    heroIndices: ['SHCOMP', 'SZCOMP'],
    currencyPairPrefixes: ['CNY/INR'],
    hoursTitleKey: 'usMarkets.hoursChinaTitle',
    hoursDescKey: 'usMarkets.hoursChinaDesc',
  },
  {
    key: 'singapore', flag: '🇸🇬',
    indexNames: ['Straits Times (Singapore)'],
    stockCountry: 'Singapore',
    heroIndices: ['STI'],
    currencyPairPrefixes: ['SGD/INR'],
    hoursTitleKey: 'usMarkets.hoursSingaporeTitle',
    hoursDescKey: 'usMarkets.hoursSingaporeDesc',
  },
  {
    key: 'australia', flag: '🇦🇺',
    indexNames: ['ASX 200 (Australia)'],
    stockCountry: 'Australia',
    heroIndices: ['ASX 200'],
    currencyPairPrefixes: [],
    hoursTitleKey: 'usMarkets.hoursAustraliaTitle',
    hoursDescKey: 'usMarkets.hoursAustraliaDesc',
  },
  {
    key: 'hongkong', flag: '🇭🇰',
    indexNames: ['Hang Seng (Hong Kong)'],
    stockCountry: 'Hong Kong',
    heroIndices: ['HSI'],
    currencyPairPrefixes: ['HKD/INR'],
    hoursTitleKey: 'usMarkets.hoursHongKongTitle',
    hoursDescKey: 'usMarkets.hoursHongKongDesc',
  },
  {
    key: 'switzerland', flag: '🇨🇭',
    indexNames: ['SMI (Switzerland)'],
    stockCountry: 'Switzerland',
    heroIndices: ['SMI'],
    currencyPairPrefixes: [],
    hoursTitleKey: 'usMarkets.hoursSwitzerlandTitle',
    hoursDescKey: 'usMarkets.hoursSwitzerlandDesc',
  },
  {
    key: 'southkorea', flag: '🇰🇷',
    indexNames: ['KOSPI (South Korea)'],
    stockCountry: 'South Korea',
    heroIndices: ['KOSPI'],
    currencyPairPrefixes: [],
    hoursTitleKey: 'usMarkets.hoursSouthKoreaTitle',
    hoursDescKey: 'usMarkets.hoursSouthKoreaDesc',
  },
];

// ──── Index Card ───────────────────────────────────────────────────────────

function IndexCard({ index, sparkline, onPress }: { index: MarketIndex; sparkline?: number[]; onPress?: () => void }) {
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
        <View style={styles.indexSparklineRow}>
          {sparkline && sparkline.length >= 2 && (
            <TrendSparkline data={sparkline} width={92} height={22} testID="index-sparkline" />
          )}
          <View style={[styles.indexChangeBadge, { backgroundColor: (isPos ? colors.marketUp : colors.marketDown) + '20' }]}>
            <Text style={[styles.indexChangeText, { color: isPos ? colors.marketUp : colors.marketDown }]}>
              {isPos ? '+' : ''}{index.changePercent.toFixed(2)}%
            </Text>
          </View>
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

// ──── Country-view sparkline data ──────────────────────────────────────
// Backend keys index history by its own symbols; frontend indices carry only
// display names. Backend and frontend share identical display names, so map
// each backend symbol to its display name once.
const BACKEND_SYMBOL_TO_NAME: Record<string, string> = {
  SPX: 'S&P 500',
  IXIC: 'NASDAQ Composite',
  DJI: 'Dow Jones Industrial Avg.',
  CAC: 'CAC 40 (France)',
  FTSE: 'FTSE 100 (UK)',
  DAX: 'DAX 40 (Germany)',
  IBEX: 'IBEX 35 (Spain)',
  N225: 'Nikkei 225 (Japan)',
  HSX: 'Hang Seng (Hong Kong)',
  HSI: 'Hang Seng (Hong Kong)',
  KOSPI: 'KOSPI (South Korea)',
  TWII: 'Taiex (Taiwan)',
  SHCOMP: 'Shanghai Composite (China)',
  SENSEX: 'BSE Sensex (India)',
  NIFTY: 'Nifty 50 (India)',
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
  const [, setStocksLoading] = useState(false);
  const [stocksLive, setStocksLive] = useState(false);

  // Live indices from backend
  const [liveIndices, setLiveIndices] = useState<MarketIndex[]>([]);
  const [indicesLive, setIndicesLive] = useState(false);

  // Live crypto from backend
  const [cryptoAssets, setCryptoAssets] = useState<CryptoAsset[]>(mockCryptoAssets);
  const [, setCryptoLive] = useState(false);

  // Last updated timestamp
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Country picker (Global tab): null = default Europe/Asia grouping
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const countryPairs = useMemo(() => forexApi.getFallbackPairs(), []);

  // Live market open/closed status per country (ticks every 30s)
  // + holiday calendar fetched once from the backend
  const [holidayCalendars, setHolidayCalendars] = useState<HolidayCalendar>({});
  const [marketStatuses, setMarketStatuses] = useState(() => getAllMarketStatuses());
  useEffect(() => {
    let active = true;
    getHolidayCalendar().then((calendar) => {
      if (!active) return;
      setHolidayCalendars(calendar);
      setMarketStatuses(getAllMarketStatuses(new Date(), calendar as any));
    });
    const id = setInterval(() => {
      setMarketStatuses(getAllMarketStatuses(new Date(), holidayCalendarsRef.current));
    }, 30_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);
  // Latest calendars without re-triggering the interval effect
  const holidayCalendarsRef = useRef(holidayCalendars);
  useEffect(() => {
    holidayCalendarsRef.current = holidayCalendars;
  }, [holidayCalendars]);

  // World-clock strip: recomputes on every status tick (30s) because
  // marketStatuses gets a fresh object each tick.
  const worldClocks = useMemo(
    () =>
      COUNTRIES.map((c) => {
        const clock = getMarketLocalClock(c.key as any);
        const status: MarketStatus | undefined =
          marketStatuses[c.key as keyof typeof marketStatuses];
        return {
          key: c.key,
          flag: c.flag,
          time: clock.time,
          isOpen: status?.isOpen ?? false,
          minutesToOpen: status?.minutesToOpen ?? null,
        };
      }),
    [marketStatuses],
  );

  // Status for the currently selected country view (holiday-aware)
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

  // ── Fetch crypto from backend ────────────────────────────────
  const fetchCrypto = useCallback(async () => {
    const apiCrypto = await globalMarketsApi.getCrypto().catch(() => null as CryptoAssetData[] | null);
    if (apiCrypto && apiCrypto.length > 0) {
      setCryptoAssets(buildCryptoList(apiCrypto, mockCryptoAssets));
      setCryptoLive(true);
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
        if (res.coinGeckoConfigured) {
          fetchCrypto();
        }
      })
      .catch(() => setApiStatus({ marketstackConfigured: false, coinGeckoConfigured: false }));
    return () => clearTimeout(timer);
  }, [fetchAllStocks, fetchAllIndices, fetchCrypto]);

  const isLive = apiStatus?.marketstackConfigured === true || apiStatus?.coinGeckoConfigured === true;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      fetchAllStocks(),
      fetchAllIndices(),
      fetchCrypto(),
    ]).finally(() => setRefreshing(false));
  }, [fetchAllStocks, fetchAllIndices, fetchCrypto]);

  // Region-grouped stocks: US, European, Asian
  const regionStockData = useMemo(() => ({
    us: { label: t('usMarkets.usStocksSection'), stocks: usStocks as (USStock | InternationalStock)[] },
    europe: { label: t('usMarkets.euStocksSection'), stocks: euStocks as (USStock | InternationalStock)[] },
    asia: { label: t('usMarkets.asiaStocksSection'), stocks: asiaStocks as (USStock | InternationalStock)[] },
  }), [usStocks, euStocks, asiaStocks, t]);

  // ── Country-view derived data (Global tab) ─────────────────────────
  const allIndices = useMemo(
    () => (indicesLive ? liveIndices : [...mockUSIndices, ...mockGlobalIndices]),
    [indicesLive, liveIndices],
  );

  // ── 30-day index history for sparklines ────────────────────────────
  // Best-effort: history is an enhancement, never a blocker — on failure we
  // simply render cards without sparklines.
  const [indexHistory, setIndexHistory] = useState<Record<string, { timestamp: number; price: number }[]>>({});
  useEffect(() => {
    let cancelled = false;
    globalMarketsApi
      .getIndexHistory([])
      .then((res) => {
        if (!cancelled && res.success && res.data) setIndexHistory(res.data);
        else if (!cancelled) setIndexHistory({});
      })
      .catch(() => {
        if (!cancelled) setIndexHistory({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // name → 30-day price series (backend keys history by backend index symbol,
  // but backend and frontend share identical index display names)
  const historyByName = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(indexHistory).map(([symbol, series]) => {
          const meta = BACKEND_SYMBOL_TO_NAME[symbol];
          return [meta ?? symbol, series.map((p) => p.price)];
        }),
      ) as Record<string, number[]>,
    [indexHistory],
  );
  const selectedCountryConfig = useMemo(
    () => COUNTRIES.find((c) => c.key === selectedCountry) ?? null,
    [selectedCountry],
  );
  const countryView = useMemo(() => {
    if (!selectedCountryConfig) return null;
    const indices = allIndices.filter((i) =>
      selectedCountryConfig.indexNames.some((n) => i.name === n || i.name.startsWith(n)),
    );
    const stocks = [
      ...usStocks.filter((s) => 'country' in s && (s as InternationalStock).country === selectedCountryConfig.stockCountry),
      ...euStocks.filter((s) => s.country === selectedCountryConfig.stockCountry),
      ...asiaStocks.filter((s) => s.country === selectedCountryConfig.stockCountry),
    ];
    const pairs = countryPairs.filter((p) =>
      selectedCountryConfig.currencyPairPrefixes.includes(p.pair),
    );
    return { indices, stocks, pairs };
  }, [selectedCountryConfig, allIndices, usStocks, euStocks, asiaStocks, countryPairs]);

  // Status for the currently selected country view (holiday-aware).
  // Reads marketStatuses (the 30s tick) only to trigger recompute — accessed
  // via a ref-style dependency so lint stays clean.
  const statusTick = marketStatuses;
  const selectedCountryStatus: MarketStatus | undefined = useMemo(() => {
    void statusTick;
    if (!selectedCountryConfig) return undefined;
    const cal = holidayCalendars[selectedCountryConfig.key] as Map<string, string> | undefined;
    return getMarketStatus(selectedCountryConfig.key as any, new Date(), cal);
  }, [selectedCountryConfig, holidayCalendars, statusTick]);

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
    if (!searchQuery.trim()) return cryptoAssets;
    const q = searchQuery.toLowerCase();
    return cryptoAssets.filter(
      c => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [searchQuery, cryptoAssets]);

  if (isLoading) {
    return (
      <AppScreen scroll={false} padded={false} header={
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('usMarkets.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('usMarkets.loadingSubtitle')}</Text>
        </View>
      }>
        <View />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      padded={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentStyle={styles.scrollContent}
      header={
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
            {/* World clock strip — local time + next-open countdown per market */}
            <View style={styles.worldClockStrip}>
              {worldClocks.map((w) => (
                <View
                  key={w.key}
                  style={[styles.worldClockCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                  accessibilityLabel={`${w.key} local time ${w.time}, ${w.isOpen ? t('usMarkets.marketOpen') : t('usMarkets.marketClosed')}`}
                  testID={`world-clock-${w.key}`}
                >
                  <View style={styles.worldClockTopRow}>
                    <Text style={styles.worldClockFlag}>{w.flag}</Text>
                    <Text style={[styles.worldClockTime, { color: w.isOpen ? colors.marketUp : colors.text }]}>
                      {w.time}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.worldClockSub,
                      { color: w.isOpen ? colors.marketUp : colors.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {w.isOpen
                      ? t('usMarkets.marketOpen')
                      : (() => {
                          const until = formatTimeUntilOpen(w.minutesToOpen);
                          return until !== ''
                            ? t('usMarkets.opensIn', { time: until })
                            : t('usMarkets.marketClosed');
                        })()}
                  </Text>
                </View>
              ))}
            </View>

            {/* Country picker chips */}
            <View style={styles.countryChipRow}>
              {COUNTRIES.map((c) => {
                const isActive = selectedCountry === c.key;
                const status: MarketStatus | undefined = marketStatuses[c.key as keyof typeof marketStatuses];
                const isOpen = status?.isOpen ?? false;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setSelectedCountry(isActive ? null : c.key)}
                    style={[
                      styles.countryChip,
                      {
                        backgroundColor: isActive ? colors.primary + '20' : colors.bgCard,
                        borderColor: isActive ? colors.primary + '40' : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.key} market view, ${isOpen ? t('usMarkets.marketOpen') : t('usMarkets.marketClosed')}`}
                    testID={`country-chip-${c.key}`}
                  >
                    <View
                      style={[
                        styles.chipStatusDot,
                        { backgroundColor: isOpen ? colors.marketUp : colors.textMuted },
                      ]}
                    />
                    <Text style={styles.countryChipFlag}>{c.flag}</Text>
                    <Text
                      style={[styles.countryChipLabel, { color: isActive ? colors.primary : colors.textSecondary }]}
                    >
                      {t(`usMarkets.country_${c.key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Country view: one country's full market picture ── */}
            {selectedCountryConfig && countryView ? (
              <>
                {/* Live open/closed/holiday status header */}
                {(() => {
                  const status = selectedCountryStatus;
                  if (!status) return null;
                  const isHoliday = status.phase === 'holiday';
                  const isOpen = status.isOpen;
                  const statusColor = isHoliday
                    ? colors.warning
                    : isOpen
                      ? colors.marketUp
                      : colors.textMuted;
                  const statusLabel = isHoliday
                    ? t('usMarkets.marketHoliday')
                    : status.phase === 'pre'
                      ? t('usMarkets.marketPreOpen')
                      : isOpen
                        ? t('usMarkets.marketOpen')
                        : t('usMarkets.marketClosed');
                  const untilOpen = formatTimeUntilOpen(status.minutesToOpen);
                  // Primary index trend beside the badge (first listed index)
                  const primaryIndex = countryView.indices[0];
                  const primarySparkline = primaryIndex ? historyByName[primaryIndex.name] : undefined;
                  return (
                    <View style={styles.statusHeader}>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: statusColor + '20', borderColor: statusColor + '40' },
                        ]}
                      >
                        <View style={[styles.statusBadgeDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                      </View>
                      {primarySparkline && primarySparkline.length >= 2 && (
                        <TrendSparkline data={primarySparkline} width={56} height={18} testID="header-sparkline" />
                      )}
                      {isHoliday && status.holidayName ? (
                        <Text style={[styles.statusUntilText, { color: colors.textMuted }]} numberOfLines={1}>
                          {status.holidayName}
                        </Text>
                      ) : (
                        !isOpen && untilOpen !== '' && (
                          <Text style={[styles.statusUntilText, { color: colors.textMuted }]}>
                            {t('usMarkets.opensIn', { time: untilOpen })}
                          </Text>
                        )
                      )}
                    </View>
                  );
                })()}

                {countryView.indices.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                      {t('usMarkets.countryIndices')}
                    </Text>
                    <View style={styles.grid2}>
                      {countryView.indices.map((index, i) => (
                        <Animated.View key={index.id} entering={FadeInUp.duration(300).delay(i * 60)}>
                          <IndexCard index={index} sparkline={historyByName[index.name]} />
                        </Animated.View>
                      ))}
                    </View>
                  </>
                )}

                {countryView.stocks.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                      {t('usMarkets.countryStocks')}
                    </Text>
                    {countryView.stocks.map((stock) => (
                      <StockRow
                        key={stock.id}
                        stock={stock}
                        onPress={() =>
                          navigation.navigate('GlobalStockDetail', {
                            stockId: stock.id,
                            symbol: stock.symbol,
                            region: (stock as InternationalStock).region,
                          })
                        }
                      />
                    ))}
                  </>
                )}

                {countryView.pairs.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                      {t('usMarkets.countryCurrency')}
                    </Text>
                    <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                      {countryView.pairs.map((p, idx) => (
                        <View
                          key={p.id}
                          style={[
                            styles.currencyRow,
                            idx < countryView.pairs.length - 1 && { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
                          ]}
                        >
                          <Text style={[styles.currencyPair, { color: colors.text }]}>{p.pair}</Text>
                          <View style={styles.currencyRateWrap}>
                            <Text style={[styles.currencyRate, { color: colors.text }]}>{p.rate.toFixed(2)}</Text>
                            <Text
                              style={[
                                styles.currencyChange,
                                { color: p.change >= 0 ? colors.marketUp : colors.marketDown },
                              ]}
                            >
                              {p.change >= 0 ? '+' : ''}{p.changePercent.toFixed(2)}%
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {countryView.indices.length === 0 && countryView.stocks.length === 0 && countryView.pairs.length === 0 && (
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    {t('usMarkets.countryNoData')}
                  </Text>
                )}

                {/* Market Hours Card */}
                <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <Ionicons name="time" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoTitle, { color: colors.text }]}>{t(selectedCountryConfig.hoursTitleKey)}</Text>
                    <Text style={[styles.infoText, { color: colors.textMuted }]}>
                      {t(selectedCountryConfig.hoursDescKey)}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
            {/* Default view: Europe + Asia-Pacific grouping */}
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
              </>
            )}
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
    </AppScreen>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
    // AppScreen already pads for the status-bar/safe-area inset
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
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
  indexSparklineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
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

  // ── Country picker ──
  worldClockStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  worldClockCard: {
    minWidth: 96,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 2,
  },
  worldClockTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  worldClockFlag: { fontSize: 14 },
  worldClockTime: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  worldClockSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  countryChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  countryChipFlag: { fontSize: 14 },
  countryChipLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  currencyPair: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  currencyRateWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  currencyRate: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  currencyChange: { ...FONTS.regular, fontSize: FONTS.size.xs },
  chipStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  statusBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusUntilText: { ...FONTS.regular, fontSize: FONTS.size.xs },

  emptyText: { ...FONTS.regular, fontSize: FONTS.size.sm, fontStyle: 'italic', marginTop: SPACING.xl, textAlign: 'center' },
  seeMoreText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
});
