/**
 * ============================================================================
 * Toroloom — Currency Markets Screen
 * ============================================================================
 *
 * Forex dashboard showing major currency pairs against INR with:
 *   - Live rates, daily change, day high/low
 *   - 52-week range indicators
 *   - RBI reference rates section
 *   - Mini sparkline charts using react-native-svg
 *   - Market analysis
 *
 * Navigation: More → Currency Markets
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Platform, Dimensions,
} from 'react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import Svg, { Polyline } from 'react-native-svg';
import type { CurrencyPair } from '../../types';

const { width } = Dimensions.get('window');

// ══════════════════════════════════════════════════════════════
// INLINE MOCK DATA
// ══════════════════════════════════════════════════════════════

const CURRENCY_PAIRS: CurrencyPair[] = [
  { id: 'usdinr',   pair: 'USD/INR', baseCurrency: 'USD', quoteCurrency: 'INR', name: 'US Dollar / Indian Rupee', rate: 83.45, change: -0.12, changePercent: -0.14, dayHigh: 83.62, dayLow: 83.38, week52High: 84.15, week52Low: 82.75, isRbiReference: true, region: 'major', icon: '💵', color: '#3B82F6', trend: 'RBI intervention keeps USD/INR range-bound. FII inflows supporting rupee.', volatility: 4.2 },
  { id: 'eurinr',   pair: 'EUR/INR', baseCurrency: 'EUR', quoteCurrency: 'INR', name: 'Euro / Indian Rupee', rate: 90.78, change: 0.35, changePercent: 0.39, dayHigh: 90.92, dayLow: 90.45, week52High: 92.50, week52Low: 88.20, isRbiReference: true, region: 'major', icon: '💶', color: '#0052CC', trend: 'EUR strengthening on ECB hawkish stance.', volatility: 5.8 },
  { id: 'gbpinr',   pair: 'GBP/INR', baseCurrency: 'GBP', quoteCurrency: 'INR', name: 'British Pound / Indian Rupee', rate: 106.20, change: 0.65, changePercent: 0.62, dayHigh: 106.45, dayLow: 105.55, week52High: 108.80, week52Low: 103.40, isRbiReference: true, region: 'major', icon: '💷', color: '#FF5252', trend: 'Pound supported by UK services PMI.', volatility: 6.5 },
  { id: 'jpyinr',   pair: 'JPY/INR', baseCurrency: 'JPY', quoteCurrency: 'INR', name: 'Japanese Yen / Indian Rupee', rate: 0.54, change: -0.002, changePercent: -0.37, dayHigh: 0.545, dayLow: 0.538, week52High: 0.58, week52Low: 0.51, isRbiReference: false, region: 'major', icon: '💴', color: '#FFC107', trend: 'Yen under pressure from BoJ ultra-loose policy.', volatility: 8.2 },
  { id: 'sgdinr',   pair: 'SGD/INR', baseCurrency: 'SGD', quoteCurrency: 'INR', name: 'Singapore Dollar / Indian Rupee', rate: 61.80, change: 0.15, changePercent: 0.24, dayHigh: 61.95, dayLow: 61.62, week52High: 63.20, week52Low: 60.10, isRbiReference: false, region: 'asian', icon: '🇸🇬', color: '#00E676', trend: 'SGD stable on MAS policy.', volatility: 3.5 },
  { id: 'cnyinr',   pair: 'CNY/INR', baseCurrency: 'CNY', quoteCurrency: 'INR', name: 'Chinese Yuan / Indian Rupee', rate: 11.52, change: -0.04, changePercent: -0.35, dayHigh: 11.58, dayLow: 11.48, week52High: 12.10, week52Low: 11.30, isRbiReference: false, region: 'asian', icon: '🇨🇳', color: '#FF6B6B', trend: 'Yuan weakness on China economic slowdown.', volatility: 6.1 },
  { id: 'hkdInr',   pair: 'HKD/INR', baseCurrency: 'HKD', quoteCurrency: 'INR', name: 'Hong Kong Dollar / Indian Rupee', rate: 10.68, change: -0.02, changePercent: -0.19, dayHigh: 10.72, dayLow: 10.65, week52High: 11.00, week52Low: 10.40, isRbiReference: false, region: 'asian', icon: '🇭🇰', color: '#8B5CF6', trend: 'HKD pegged to USD, mirroring USD/INR.', volatility: 2.8 },
  { id: 'thbinr',   pair: 'THB/INR', baseCurrency: 'THB', quoteCurrency: 'INR', name: 'Thai Baht / Indian Rupee', rate: 2.28, change: 0.01, changePercent: 0.44, dayHigh: 2.30, dayLow: 2.27, week52High: 2.45, week52Low: 2.20, isRbiReference: false, region: 'asian', icon: '🇹🇭', color: '#06B6D4', trend: 'Baht supported by tourism recovery.', volatility: 4.5 },
  { id: 'eurusd',   pair: 'EUR/USD', baseCurrency: 'EUR', quoteCurrency: 'USD', name: 'Euro / US Dollar', rate: 1.0875, change: 0.0045, changePercent: 0.42, dayHigh: 1.0890, dayLow: 1.0830, week52High: 1.1200, week52Low: 1.0600, isRbiReference: false, region: 'other', icon: '💶', color: '#0052CC', trend: 'EUR/USD testing resistance.', volatility: 7.5 },
  { id: 'gbpusd',   pair: 'GBP/USD', baseCurrency: 'GBP', quoteCurrency: 'USD', name: 'British Pound / US Dollar', rate: 1.2730, change: 0.0080, changePercent: 0.63, dayHigh: 1.2750, dayLow: 1.2650, week52High: 1.3200, week52Low: 1.2400, isRbiReference: false, region: 'other', icon: '💷', color: '#FF5252', trend: 'Cable rallying on hawkish BoE.', volatility: 8.8 },
  { id: 'usdjpy',   pair: 'USD/JPY', baseCurrency: 'USD', quoteCurrency: 'JPY', name: 'US Dollar / Japanese Yen', rate: 154.80, change: 0.50, changePercent: 0.32, dayHigh: 155.20, dayLow: 154.30, week52High: 162.00, week52Low: 140.00, isRbiReference: false, region: 'other', icon: '💴', color: '#FFC107', trend: 'USD/JPY elevated on rate differential.', volatility: 10.2 },
];

// ══════════════════════════════════════════════════════════════
// HELPER: generate mock rate history
// ══════════════════════════════════════════════════════════════

function generateRateHistory(baseRate: number): number[] {
  const days = 30;
  const history: number[] = [];
  let rate = baseRate * 0.98;
  for (let i = 0; i < days; i++) {
    const change = (Math.random() - 0.48) * rate * 0.006;
    rate = Math.max(rate * 0.97, Math.min(rate * 1.03, rate + change));
    history.push(Math.round(rate * 10000) / 10000);
  }
  return history;
}

// ══════════════════════════════════════════════════════════════
// MINI SPARKLINE (react-native-svg)
// ══════════════════════════════════════════════════════════════

function MiniSparkline({ data, width: w, height: h }: { data: number[]; width: number; height: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = isUp ? '#00E676' : '#FF5252';

  const points = data.map((v, i) =>
    `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * (h - 4) - 2).toFixed(1)}`
  ).join(' ');

  return (
    <Svg width={w} height={h}>
      <Polyline points={points} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ══════════════════════════════════════════════════════════════
// CURRENCY CARD
// ══════════════════════════════════════════════════════════════

function CurrencyCard({ currency, isExpanded, onPress, colors }: {
  currency: CurrencyPair;
  isExpanded: boolean;
  onPress: () => void;
  colors: any;
}) {
  const isUp = currency.change >= 0;
  const chartData = useMemo(() => generateRateHistory(currency.rate), [currency.rate]);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <View style={[styles.currencyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {/* Header */}
        <View style={styles.currencyHeader}>
          <View style={styles.currencyLeft}>
            <View style={[styles.currencyIconBg, { backgroundColor: currency.color + '20' }]}>
              <Text style={styles.currencyIcon}>{currency.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.currencyPair, { color: colors.text }]}>{currency.pair}</Text>
              <Text style={[styles.currencyName, { color: colors.textMuted }]} numberOfLines={1}>{currency.name}</Text>
            </View>
          </View>
          <View style={styles.currencyRight}>
            <Text style={[styles.currencyRate, { color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
              {currency.rate.toFixed(currency.rate < 1 ? 4 : 2)}
            </Text>
            <View style={[styles.changeBadge, { backgroundColor: isUp ? '#00E67620' : '#FF525220' }]}>
              <Ionicons name={isUp ? 'caret-up' : 'caret-down'} size={12} color={isUp ? '#00E676' : '#FF5252'} />
              <Text style={[styles.changeText, { color: isUp ? '#00E676' : '#FF5252' }]}>
                {(isUp ? '+' : '') + currency.changePercent.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Chart + Day Range */}
        <View style={styles.chartRow}>
          <MiniSparkline data={chartData} width={120} height={32} />
          <View style={styles.dayRangeCol}>
            <View style={styles.dayRangeRow}>
              <Text style={[styles.rangeLabel, { color: colors.textMuted }]}>H:</Text>
              <Text style={[styles.rangeValue, { color: colors.text }]}>{currency.dayHigh.toFixed(2)}</Text>
            </View>
            <View style={styles.dayRangeRow}>
              <Text style={[styles.rangeLabel, { color: colors.textMuted }]}>L:</Text>
              <Text style={[styles.rangeValue, { color: colors.text }]}>{currency.dayLow.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* 52W Range */}
        <View style={styles.weekRangeContainer}>
          <Text style={[styles.weekRangeLabel, { color: colors.textMuted }]}>52W Range</Text>
          <View style={styles.weekRangeBar}>
            <View style={[styles.weekRangeFill, {
              width: `${Math.min(100, Math.max(0, ((currency.rate - currency.week52Low) / (currency.week52High - currency.week52Low)) * 100))}%`,
              backgroundColor: isUp ? '#00E676' : '#FF5252',
            }]} />
          </View>
          <View style={styles.weekRangeLabels}>
            <Text style={[styles.weekRangeText, { color: colors.textMuted }]}>{currency.week52Low.toFixed(2)}</Text>
            <Text style={[styles.weekRangeText, { color: colors.textMuted }]}>{currency.week52High.toFixed(2)}</Text>
          </View>
        </View>

        {/* RBI badge */}
        {currency.isRbiReference && (
          <View style={[styles.rbiBadge, { backgroundColor: '#3B82F615' }]}>
            <Ionicons name="shield-checkmark" size={12} color="#3B82F6" />
            <Text style={[styles.rbiText, { color: '#3B82F6' }]}>RBI Reference Rate</Text>
          </View>
        )}

        {/* Expanded */}
        {isExpanded && (
          <View style={[styles.expandedContent, { backgroundColor: colors.bgInput }]}>
            <View style={styles.expandedGrid}>
              {[
                { label: 'Open', value: (currency.rate - currency.change).toFixed(currency.rate < 1 ? 4 : 2) },
                { label: 'Change', value: `${isUp ? '+' : ''}${currency.change.toFixed(4)}`, color: isUp ? '#00E676' : '#FF5252' },
                { label: '52W High', value: currency.week52High.toFixed(2) },
                { label: '52W Low', value: currency.week52Low.toFixed(2) },
                { label: 'Volatility', value: `${(currency.volatility ?? 0).toFixed(1)}%` },
                { label: 'Region', value: currency.region.charAt(0).toUpperCase() + currency.region.slice(1) },
              ].map((item, i) => (
                <View key={i} style={styles.expandedItem}>
                  <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>{item.label}</Text>
                  <Text style={[styles.expandedValue, { color: (item as any).color || colors.text }]}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={[styles.expandedTrend, { color: colors.textSecondary }]}>{currency.trend}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════

type TabKey = 'inr' | 'crosses' | 'summary';

export default function CurrencyMarketsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('inr');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);

  const filteredPairs = useMemo(() => {
    let pairs = [...CURRENCY_PAIRS];
    if (activeTab === 'inr') pairs = pairs.filter(p => p.quoteCurrency === 'INR');
    else if (activeTab === 'crosses') pairs = pairs.filter(p => p.quoteCurrency !== 'INR');
    if (regionFilter) pairs = pairs.filter(p => p.region === regionFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      pairs = pairs.filter(p => p.pair.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    }
    return pairs;
  }, [activeTab, regionFilter, searchQuery]);

  const summaryStats = useMemo(() => {
    const inrPairs = CURRENCY_PAIRS.filter(p => p.quoteCurrency === 'INR');
    const avgChg = inrPairs.reduce((s, p) => s + p.changePercent, 0) / inrPairs.length;
    const avgVol = inrPairs.reduce((s, p) => s + (p.volatility ?? 0), 0) / inrPairs.length;
    return {
      total: CURRENCY_PAIRS.length,
      inr: inrPairs.length,
      rbiRef: CURRENCY_PAIRS.filter(p => p.isRbiReference).length,
      avgInrChange: avgChg,
      avgInrVol: avgVol,
    };
  }, []);

  const handlePress = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Currency Markets</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Forex Rates & Analysis</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {[
            { key: 'inr' as TabKey, label: 'INR Pairs', icon: 'cash' },
            { key: 'crosses' as TabKey, label: 'Crosses', icon: 'swap-horizontal' },
            { key: 'summary' as TabKey, label: 'Summary', icon: 'stats-chart' },
          ].map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => { setActiveTab(tab.key); setExpandedId(null); setRegionFilter(null); setSearchQuery(''); }}
                style={[styles.tabBtn, { backgroundColor: isActive ? colors.primary + '20' : 'transparent', borderColor: isActive ? colors.primary + '40' : 'transparent' }]}
              >
                <Ionicons name={tab.icon as any} size={14} color={isActive ? colors.primary : colors.textMuted} />
                <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.textMuted }]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search */}
        {activeTab !== 'summary' && (
          <View style={[styles.searchBar, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search pairs..."
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
        )}

        {/* Region filter */}
        {activeTab !== 'summary' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {[
              { key: null as string | null, label: 'All' },
              { key: 'major', label: 'Major' },
              { key: 'asian', label: 'Asian' },
              { key: 'other', label: 'Other' },
            ].map(f => {
              const isActive = regionFilter === f.key;
              return (
                <Pressable
                  key={f.label}
                  onPress={() => setRegionFilter(f.key)}
                  style={[styles.filterChip, { backgroundColor: isActive ? colors.primary + '20' : colors.bgInput, borderColor: isActive ? colors.primary + '40' : colors.border }]}
                >
                  <Text style={[styles.filterChipText, { color: isActive ? colors.primary : colors.textMuted }]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Pairs Tabs ── */}
        {(activeTab === 'inr' || activeTab === 'crosses') && (
          <View>
            <Text style={[styles.resultCount, { color: colors.textMuted }]}>
              {filteredPairs.length} pair{filteredPairs.length !== 1 ? 's' : ''}
            </Text>
            {filteredPairs.length > 0 ? (
              filteredPairs.map(pair => (
                <CurrencyCard key={pair.id} currency={pair} isExpanded={expandedId === pair.id} onPress={() => handlePress(pair.id)} colors={colors} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>No pairs found</Text>
                <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>Try adjusting search</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Summary ── */}
        {activeTab === 'summary' && (
          <View>
            <View style={styles.summaryGrid}>
              {[
                { label: 'Total Pairs', value: summaryStats.total.toString(), icon: '🔄', color: '#6C63FF' },
                { label: 'INR Pairs', value: summaryStats.inr.toString(), icon: '🇮🇳', color: '#3B82F6' },
                { label: 'Avg INR Chg', value: `${(summaryStats.avgInrChange >= 0 ? '+' : '') + summaryStats.avgInrChange.toFixed(2)}%`, icon: '📈', color: summaryStats.avgInrChange >= 0 ? '#00E676' : '#FF5252' },
                { label: 'Avg Volatility', value: `${summaryStats.avgInrVol.toFixed(1)}%`, icon: '🌊', color: '#FFC107' },
              ].map((stat, i) => (
                <View key={stat.label} style={[styles.summaryCard, { borderColor: stat.color + '30' }]}>
                  <Text style={styles.summaryIcon}>{stat.icon}</Text>
                  <Text style={[styles.summaryValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* INR Overview */}
            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>INR Pairs Overview</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Currency pairs vs Indian Rupee</Text>
              {CURRENCY_PAIRS.filter(p => p.quoteCurrency === 'INR').map((pair, i) => {
                const isUp = pair.changePercent >= 0;
                return (
                  <View key={pair.id} style={[styles.inrRow, i < 3 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                    <View style={styles.inrRowLeft}>
                      <Text style={{ fontSize: 20 }}>{pair.icon}</Text>
                      <View>
                        <Text style={[styles.inrPairText, { color: colors.text }]}>{pair.pair}</Text>
                        <Text style={[styles.inrRateText, { color: colors.textMuted }]}>{pair.rate.toFixed(2)}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={[styles.inrChange, { color: isUp ? '#00E676' : '#FF5252' }]}>
                        {isUp ? '+' : ''}{pair.changePercent.toFixed(2)}%
                      </Text>
                      <Text style={[styles.inrVol, { color: colors.textMuted }]}>Vol: {(pair.volatility ?? 0).toFixed(1)}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Info */}
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>Indian Forex Market</Text>
                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  RBI publishes reference rates for USD, EUR, GBP, JPY daily at 12:00 PM IST. Market hours: 9:00 AM - 5:00 PM IST. Key factors: FII flows, crude oil, RBI policy. India holds ~$650B forex reserves.
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl, paddingTop: 60, borderBottomLeftRadius: BORDER_RADIUS.xl, borderBottomRightRadius: BORDER_RADIUS.xl },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  title: { ...FONTS.bold, fontSize: FONTS.size.title },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4 },
  tabRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  tabLabel: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginTop: SPACING.md },
  searchInput: { flex: 1, ...FONTS.medium, fontSize: FONTS.size.sm, padding: 0 },
  filterScroll: { marginTop: SPACING.md },
  filterChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: BORDER_RADIUS.full, borderWidth: 1, marginRight: SPACING.sm },
  filterChipText: { ...FONTS.medium, fontSize: FONTS.size.xs },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
  resultCount: { ...FONTS.regular, fontSize: FONTS.size.xs, fontStyle: 'italic', marginBottom: SPACING.sm },

  // Currency Card
  currencyCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.sm },
  currencyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  currencyLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  currencyIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  currencyIcon: { fontSize: 18 },
  currencyPair: { ...FONTS.bold, fontSize: FONTS.size.md },
  currencyName: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  currencyRight: { alignItems: 'flex-end', gap: 4 },
  currencyRate: { ...FONTS.bold, fontSize: FONTS.size.lg },
  changeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  changeText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // Chart
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  dayRangeCol: { gap: 4 },
  dayRangeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  rangeLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  rangeValue: { ...FONTS.mono, fontSize: FONTS.size.xs, fontWeight: '600' },

  // 52W Range
  weekRangeContainer: { marginTop: SPACING.md, gap: 4 },
  weekRangeLabel: { ...FONTS.regular, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  weekRangeBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  weekRangeFill: { height: '100%', borderRadius: 3 },
  weekRangeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  weekRangeText: { ...FONTS.regular, fontSize: 8 },

  // RBI
  rbiBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, marginTop: SPACING.sm },
  rbiText: { ...FONTS.semiBold, fontSize: 9, letterSpacing: 0.3 },

  // Expanded
  expandedContent: { marginTop: SPACING.md, padding: SPACING.md, borderRadius: BORDER_RADIUS.md },
  expandedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  expandedItem: { width: '45%' },
  expandedLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  expandedValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  expandedTrend: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 16, marginTop: SPACING.md },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.sm },
  emptyTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  emptyDesc: { ...FONTS.regular, fontSize: FONTS.size.xs },

  // Summary
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  summaryCard: { width: (width - 48 - SPACING.sm) / 2, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, borderWidth: 1, alignItems: 'center', gap: 4 },
  summaryIcon: { fontSize: 24 },
  summaryValue: { ...FONTS.bold, fontSize: FONTS.size.lg },
  summaryLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, textAlign: 'center' },
  sectionCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
  sectionTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  sectionSubtitle: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2 },
  inrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md },
  inrRowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  inrPairText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  inrRateText: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  inrChange: { ...FONTS.bold, fontSize: FONTS.size.sm },
  inrVol: { ...FONTS.regular, fontSize: FONTS.size.xs },
  infoCard: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.lg },
  infoTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: 4 },
  infoText: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 16 },
});
