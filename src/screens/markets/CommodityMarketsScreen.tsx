/**
 * ============================================================================
 * Toroloom — Commodity Markets Screen
 * ============================================================================
 *
 * Commodity markets dashboard with live WebSocket price streaming:
 *   - Precious metals (Gold, Silver, Platinum, Palladium)
 *   - Energy (Crude Oil, Natural Gas, Gasoline)
 *   - Base metals (Copper, Aluminum, Zinc)
 *   - Agricultural (Corn, Wheat, Soybeans)
 *
 * Features:
 *   - Real-time prices via WebSocket (mock or live backend)
 *   - Daily change, day high/low
 *   - 52-week range indicators
 *   - MCX India futures prices
 *   - Mini sparkline charts using react-native-svg
 *   - Market analysis and trends
 *
 * Navigation: More → Investments → Commodities
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import Svg, { Polyline } from 'react-native-svg';
import type { CommodityAsset } from '../../types';
import { useCommodityPrices } from '../../hooks/useCommodityPrices';

const { width } = Dimensions.get('window');

// ══════════════════════════════════════════════════════════════
// STATIC COMMODITY BASE DATA (id, name, metadata)
// Live prices from WebSocket overlay the price/change/changePercent
// ══════════════════════════════════════════════════════════════

const COMMODITY_BASE: Array<Omit<CommodityAsset, 'price' | 'change' | 'changePercent'> & { defaultPrice: number; defaultChange: number; defaultChangePercent: number }> = [
  // ── Precious Metals ──
  { id: 'gold', name: 'Gold', symbol: 'XAUUSD', category: 'metals', dayHigh: 2342.80, dayLow: 2318.50, week52High: 2450.00, week52Low: 1980.00, unit: 'oz', inrPrice: 73210, icon: '🥇', color: '#FFC107', trend: 'Gold supported by geopolitical tensions and central bank buying. Fed rate cut expectations boosting appeal.', volatility: 12.5, stat: 'Central banks bought 1,037T in Q1 2026', defaultPrice: 2335.40, defaultChange: 18.20, defaultChangePercent: 0.79 },
  { id: 'silver', name: 'Silver', symbol: 'XAGUSD', category: 'metals', dayHigh: 29.68, dayLow: 28.95, week52High: 32.50, week52Low: 22.10, unit: 'oz', inrPrice: 923, icon: '🥈', color: '#9E9E9E', trend: 'Silver benefiting from both industrial demand (solar) and monetary demand.', volatility: 18.5, stat: 'Industrial demand up 8% YoY', defaultPrice: 29.45, defaultChange: 0.52, defaultChangePercent: 1.80 },
  { id: 'platinum', name: 'Platinum', symbol: 'XPTUSD', category: 'metals', dayHigh: 992.00, dayLow: 982.00, week52High: 1120.00, week52Low: 880.00, unit: 'oz', inrPrice: 30880, icon: '💎', color: '#00BCD4', trend: 'Platinum supply deficit narrowing. Auto catalyst demand steady.', volatility: 15.2, stat: 'Supply deficit of 340K oz projected', defaultPrice: 985.00, defaultChange: -4.50, defaultChangePercent: -0.45 },
  { id: 'palladium', name: 'Palladium', symbol: 'XPDUSD', category: 'metals', dayHigh: 972.00, dayLow: 956.00, week52High: 1150.00, week52Low: 850.00, unit: 'oz', inrPrice: 30250, icon: '🔘', color: '#6C63FF', trend: 'Palladium recovering from EV transition fears. ICE vehicle demand resilient.', volatility: 22.3, stat: 'Auto sector consumes 80% of supply', defaultPrice: 965.00, defaultChange: 8.50, defaultChangePercent: 0.89 },

  // ── Energy ──
  { id: 'crude', name: 'Crude Oil (WTI)', symbol: 'CL', category: 'energy', dayHigh: 80.10, dayLow: 78.20, week52High: 95.00, week52Low: 68.00, unit: 'barrel', inrPrice: 6560, icon: '🛢️', color: '#FF5252', trend: 'OPEC+ supply increase concerns outweighing summer demand optimism.', volatility: 28.5, stat: 'OPEC+ quota: 40.5M bpd', defaultPrice: 78.50, defaultChange: -1.20, defaultChangePercent: -1.51 },
  { id: 'naturalgas', name: 'Natural Gas', symbol: 'NG', category: 'energy', dayHigh: 2.92, dayLow: 2.76, week52High: 3.60, week52Low: 1.80, unit: 'MMBtu', inrPrice: 238, icon: '🔥', color: '#FF9800', trend: 'Gas prices rising on LNG export demand and summer cooling needs.', volatility: 35.8, stat: 'LNG exports up 12% YoY', defaultPrice: 2.85, defaultChange: 0.08, defaultChangePercent: 2.89 },
  { id: 'gasoline', name: 'Gasoline (RBOB)', symbol: 'XB', category: 'energy', dayHigh: 2.50, dayLow: 2.42, week52High: 3.10, week52Low: 2.10, unit: 'gallon', inrPrice: 205, icon: '⛽', color: '#FF6B00', trend: 'Summer driving season demand offset by increased refinery output.', volatility: 32.1, stat: 'US gasoline demand: 9.2M bpd', defaultPrice: 2.45, defaultChange: -0.04, defaultChangePercent: -1.61 },

  // ── Base Metals ──
  { id: 'copper', name: 'Copper', symbol: 'HG', category: 'metals', dayHigh: 4.56, dayLow: 4.45, week52High: 5.20, week52Low: 3.65, unit: 'lb', inrPrice: 378, icon: '🪙', color: '#FF6B35', trend: 'Copper benefiting from electrification demand and supply constraints.', volatility: 20.4, stat: 'Global demand growth: 3.5% CAGR', defaultPrice: 4.52, defaultChange: 0.06, defaultChangePercent: 1.35 },
  { id: 'aluminum', name: 'Aluminum', symbol: 'ALI', category: 'metals', dayHigh: 2580.00, dayLow: 2540.00, week52High: 2850.00, week52Low: 2200.00, unit: 'tonne', inrPrice: 80220, icon: '🪶', color: '#00E5FF', trend: 'Aluminum supported by green energy transition and Chinese production caps.', volatility: 16.7, stat: 'China output capped at 45M tonnes', defaultPrice: 2560.00, defaultChange: 18.00, defaultChangePercent: 0.71 },
  { id: 'zinc', name: 'Zinc', symbol: 'ZNC', category: 'metals', dayHigh: 2880.00, dayLow: 2840.00, week52High: 3200.00, week52Low: 2400.00, unit: 'tonne', inrPrice: 89320, icon: '⚡', color: '#8BC34A', trend: 'Zinc supply tightness from mine closures. Galvanizing demand steady.', volatility: 19.3, stat: 'Global refined output: 13.8M tonnes', defaultPrice: 2850.00, defaultChange: -22.00, defaultChangePercent: -0.77 },

  // ── Agriculture ──
  { id: 'corn', name: 'Corn', symbol: 'ZC', category: 'agriculture', dayHigh: 448.00, dayLow: 439.50, week52High: 520.00, week52Low: 400.00, unit: 'bushel', icon: '🌽', color: '#FFC107', trend: 'Corn supported by strong ethanol demand and export sales.', volatility: 25.6, stat: 'US corn stocks: 1.8B bushels', defaultPrice: 445.00, defaultChange: 5.50, defaultChangePercent: 1.25 },
  { id: 'wheat', name: 'Wheat', symbol: 'ZW', category: 'agriculture', dayHigh: 595.00, dayLow: 582.00, week52High: 720.00, week52Low: 530.00, unit: 'bushel', icon: '🌾', color: '#FFA726', trend: 'Wheat under pressure from ample global supply and Black Sea exports.', volatility: 30.2, stat: 'Global wheat stocks: 260M tonnes', defaultPrice: 585.00, defaultChange: -8.00, defaultChangePercent: -1.35 },
  { id: 'soybeans', name: 'Soybeans', symbol: 'ZS', category: 'agriculture', dayHigh: 1192.00, dayLow: 1172.00, week52High: 1350.00, week52Low: 1050.00, unit: 'bushel', icon: '🫘', color: '#8BC34A', trend: 'Soybeans supported by strong crush margins and biodiesel demand.', volatility: 22.8, stat: 'Brazil soy production: 155M tonnes', defaultPrice: 1185.00, defaultChange: 12.50, defaultChangePercent: 1.07 },
];

// ══════════════════════════════════════════════════════════════
// HELPER: generate mock rate history (for sparkline)
// ══════════════════════════════════════════════════════════════

function generatePriceHistory(basePrice: number): number[] {
  const days = 30;
  const history: number[] = [];
  let price = basePrice * 0.96;
  for (let i = 0; i < days; i++) {
    const change = (Math.random() - 0.48) * price * 0.012;
    price = Math.max(price * 0.94, Math.min(price * 1.06, price + change));
    history.push(Math.round(price * 100) / 100);
  }
  return history;
}

// ══════════════════════════════════════════════════════════════
// MINI SPARKLINE
// ══════════════════════════════════════════════════════════════

function MiniSparkline({ data, w, h }: { data: number[]; w: number; h: number }) {
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
// CONNECTION / SOURCE BADGE
// ══════════════════════════════════════════════════════════════

function SourceBadge({ source, isDetecting, connected }: {
  source: 'mock' | 'real_backend' | 'offline';
  isDetecting: boolean;
  connected: boolean;
}) {
  // Initial detection phase
  if (isDetecting) {
    return (
      <View style={[styles.connBadge, { backgroundColor: '#FFC10720', borderColor: '#FFC10740' }]}>
        <View style={[styles.connDot, { backgroundColor: '#FFC107' }]} />
        <Text style={[styles.connText, { color: '#FFC107' }]}>Scanning…</Text>
      </View>
    );
  }

  // Real backend — show Live/Offline based on WS connection state
  if (source === 'real_backend') {
    return (
      <View style={[styles.connBadge, {
        backgroundColor: connected ? '#00E67620' : '#FF525220',
        borderColor: connected ? '#00E67640' : '#FF525240',
      }]}>
        <View style={[styles.connDot, {
          backgroundColor: connected ? '#00E676' : '#FF5252',
        }]} />
        <Text style={[styles.connText, {
          color: connected ? '#00E676' : '#FF5252',
        }]}>
          {connected ? 'Live' : 'Offline'}
        </Text>
      </View>
    );
  }

  // Mock mode — backend not detected, using simulated prices
  if (source === 'mock') {
    return (
      <View style={[styles.connBadge, { backgroundColor: '#6C63FF20', borderColor: '#6C63FF40' }]}>
        <View style={[styles.connDot, { backgroundColor: '#6C63FF' }]} />
        <Text style={[styles.connText, { color: '#6C63FF' }]}>Mock</Text>
      </View>
    );
  }

  // Offline / unknown fallback
  return (
    <View style={[styles.connBadge, { backgroundColor: '#FF525220', borderColor: '#FF525240' }]}>
      <View style={[styles.connDot, { backgroundColor: '#FF5252' }]} />
      <Text style={[styles.connText, { color: '#FF5252' }]}>Offline</Text>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// COMMODITY CARD
// ══════════════════════════════════════════════════════════════

function CommodityCard({ item, isExpanded, onPress, colors }: {
  item: CommodityAsset; isExpanded: boolean; onPress: () => void; colors: any;
}) {
  const isUp = item.change >= 0;
  const chartData = useMemo(() => generatePriceHistory(item.price), [item.price]);

  const priceDisplay = item.price < 10 ? item.price.toFixed(2)
    : item.price < 100 ? item.price.toFixed(2)
    : item.price < 1000 ? item.price.toFixed(2)
    : item.price.toFixed(1);

  const changeDisplay = item.change < 0.1 && item.change > -0.1
    ? item.change.toFixed(4)
    : item.price < 10 ? item.change.toFixed(3)
    : item.change.toFixed(2);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, borderLeftColor: item.color, borderLeftWidth: 3 }]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <View style={[styles.cardIconBg, { backgroundColor: item.color + '20' }]}>
              <Text style={{ fontSize: 20 }}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardSymbol, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.cardName, { color: colors.textMuted }]}>
                {item.symbol} · {item.unit}
              </Text>
            </View>
          </View>
          <View style={styles.cardRight}>
            <Text style={[styles.cardPrice, { color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
              ${priceDisplay}
            </Text>
            <View style={[styles.changeBadge, { backgroundColor: isUp ? '#00E67620' : '#FF525220' }]}>
              <Ionicons name={isUp ? 'caret-up' : 'caret-down'} size={12} color={isUp ? '#00E676' : '#FF5252'} />
              <Text style={[styles.changeText, { color: isUp ? '#00E676' : '#FF5252' }]}>
                {isUp ? '+' : ''}{changeDisplay}
              </Text>
            </View>
          </View>
        </View>

        {/* Category badge */}
        <View style={styles.categoryRow}>
          <View style={[styles.categoryBadge, { backgroundColor: item.category === 'metals' ? '#FFC10720' : item.category === 'energy' ? '#FF525220' : '#8BC34A20' }]}>
            <Text style={[styles.categoryText, { color: item.category === 'metals' ? '#FFC107' : item.category === 'energy' ? '#FF5252' : '#8BC34A' }]}>
              {item.category === 'metals' ? 'Precious/Base Metal' : item.category === 'energy' ? 'Energy' : 'Agriculture'}
            </Text>
          </View>
          {item.inrPrice && (
            <Text style={[styles.inrPrice, { color: colors.textMuted }]}>MCX: ₹{item.inrPrice.toLocaleString('en-IN')}</Text>
          )}
        </View>

        {/* Chart + Day Range */}
        <View style={styles.chartRow}>
          <MiniSparkline data={chartData} w={120} h={32} />
          <View style={styles.rangeCol}>
            <View style={styles.rangeRow}>
              <Text style={[styles.rangeLabel, { color: colors.textMuted }]}>H:</Text>
              <Text style={[styles.rangeValue, { color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                {item.dayHigh.toFixed(item.price < 10 ? 2 : 1)}
              </Text>
            </View>
            <View style={styles.rangeRow}>
              <Text style={[styles.rangeLabel, { color: colors.textMuted }]}>L:</Text>
              <Text style={[styles.rangeValue, { color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                {item.dayLow.toFixed(item.price < 10 ? 2 : 1)}
              </Text>
            </View>
          </View>
        </View>

        {/* 52W Range */}
        <View style={styles.weekRangeContainer}>
          <Text style={[styles.weekRangeLabel, { color: colors.textMuted }]}>52W Range</Text>
          <View style={styles.weekRangeBar}>
            <View style={[styles.weekRangeFill, {
              width: `${Math.min(100, Math.max(0, ((item.price - item.week52Low) / (item.week52High - item.week52Low)) * 100))}%`,
              backgroundColor: isUp ? '#00E676' : '#FF5252',
            }]} />
          </View>
          <View style={styles.weekRangeLabels}>
            <Text style={[styles.weekRangeText, { color: colors.textMuted }]}>${item.week52Low.toFixed(1)}</Text>
            <Text style={[styles.weekRangeText, { color: colors.textMuted }]}>${item.week52High.toFixed(1)}</Text>
          </View>
        </View>

        {/* Expanded */}
        {isExpanded && (
          <View style={[styles.expandedContent, { backgroundColor: colors.bgInput }]}>
            <View style={styles.expandedGrid}>
              {[
                { label: 'Change %', value: `${isUp ? '+' : ''}${item.changePercent.toFixed(2)}%`, color: isUp ? '#00E676' : '#FF5252' },
                { label: 'Volatility', value: `${item.volatility?.toFixed(1) || 'N/A'}%` },
                { label: 'Day Range', value: `$${item.dayLow.toFixed(1)} - $${item.dayHigh.toFixed(1)}` },
                { label: 'MCX India', value: item.inrPrice ? `₹${item.inrPrice.toLocaleString('en-IN')}` : 'N/A' },
              ].map((i, idx) => (
                <View key={idx} style={styles.expandedItem}>
                  <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>{i.label}</Text>
                  <Text style={[styles.expandedValue, { color: (i as any).color || colors.text }]}>{i.value}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.expandedTrend, { color: colors.textSecondary }]}>{item.trend}</Text>
            {item.stat && (
              <View style={[styles.statBadge, { backgroundColor: item.color + '12' }]}>
                <Ionicons name="stats-chart" size={12} color={item.color} />
                <Text style={[styles.statText, { color: item.color }]}>{item.stat}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ══════════════════════════════════════════════════════════════
// HELPER: merge live WebSocket prices into base commodity data
// ══════════════════════════════════════════════════════════════

function mergeLivePrices(
  base: typeof COMMODITY_BASE,
  livePrices: Record<string, { price: number; change: number; changePercent: number }>,
): CommodityAsset[] {
  return base.map((item): CommodityAsset => {
    const live = livePrices[item.symbol];
    if (live) {
      return {
        ...item,
        price: live.price,
        change: live.change,
        changePercent: live.changePercent,
        // Update dayHigh/dayLow if live price exceeded them
        dayHigh: Math.max(item.dayHigh, live.price),
        dayLow: Math.min(item.dayLow, live.price),
      };
    }
    // Fall back to defaults when no live data yet
    return {
      ...item,
      price: item.defaultPrice,
      change: item.defaultChange,
      changePercent: item.defaultChangePercent,
    };
  });
}

// ══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════

type TabKey = 'all' | 'metals' | 'energy' | 'agriculture' | 'summary';

export default function CommodityMarketsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Live WebSocket prices (auto-detects backend) ────────────
  const { prices: livePrices, connected, source: wsSource, isDetecting } = useCommodityPrices();

  // Merge live prices into base commodity data
  const COMMODITIES = useMemo(
    () => mergeLivePrices(COMMODITY_BASE, livePrices),
    [livePrices],
  );

  const filteredItems = useMemo(() => {
    let items = [...COMMODITIES];
    if (activeTab !== 'all' && activeTab !== 'summary') {
      items = items.filter(c => c.category === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
      );
    }
    return items;
  }, [activeTab, searchQuery, COMMODITIES]);

  const summaryStats = useMemo(() => {
    const metals = COMMODITIES.filter(c => c.category === 'metals');
    const energy = COMMODITIES.filter(c => c.category === 'energy');
    const agriculture = COMMODITIES.filter(c => c.category === 'agriculture');
    const metalsChg = metals.reduce((s, c) => s + c.changePercent, 0) / metals.length;
    const energyChg = energy.reduce((s, c) => s + c.changePercent, 0) / energy.length;
    const agriChg = agriculture.reduce((s, c) => s + c.changePercent, 0) / agriculture.length;
    return {
      total: COMMODITIES.length,
      metalsCount: metals.length,
      energyCount: energy.length,
      agriCount: agriculture.length,
      metalsAvgChg: metalsChg,
      energyAvgChg: energyChg,
      agriAvgChg: agriChg,
      gainers: COMMODITIES.filter(c => c.changePercent >= 0).length,
      losers: COMMODITIES.filter(c => c.changePercent < 0).length,
    };
  }, [COMMODITIES]);

  const handlePress = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Commodities</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Global Markets Dashboard</Text>
          </View>
          {/* Live connection / data source indicator */}
          <SourceBadge source={wsSource} isDetecting={isDetecting} connected={connected} />
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {[
            { key: 'all' as TabKey, label: 'All', icon: 'apps' },
            { key: 'metals' as TabKey, label: 'Metals', icon: 'diamond' },
            { key: 'energy' as TabKey, label: 'Energy', icon: 'flame' },
            { key: 'agriculture' as TabKey, label: 'Agri', icon: 'leaf' },
            { key: 'summary' as TabKey, label: 'Summary', icon: 'stats-chart' },
          ].map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => { setActiveTab(tab.key); setExpandedId(null); setSearchQuery(''); }}
                style={[styles.tabBtn, { backgroundColor: isActive ? colors.primary + '20' : 'transparent', borderColor: isActive ? colors.primary + '40' : 'transparent' }]}
              >
                <Ionicons name={tab.icon as any} size={13} color={isActive ? colors.primary : colors.textMuted} />
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
              placeholder="Search commodities..."
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
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── List View ── */}
        {(activeTab !== 'summary') && (
          <View>
            <Text style={[styles.resultCount, { color: colors.textMuted }]}>
              {filteredItems.length} commodity{filteredItems.length !== 1 ? 'ies' : ''}
            </Text>
            {filteredItems.length > 0 ? (
              filteredItems.map((item, i) => (
                <CommodityCard key={item.id} item={item} isExpanded={expandedId === item.id} onPress={() => handlePress(item.id)} colors={colors} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>No commodities found</Text>
                <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>Try adjusting search</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Summary ── */}
        {activeTab === 'summary' && (
          <View>
            {/* Overview Cards */}
            <View style={styles.summaryGrid}>
              {[
                { label: 'Total', value: summaryStats.total.toString(), icon: '📊', color: '#6C63FF' },
                { label: 'Gainers', value: summaryStats.gainers.toString(), icon: '📈', color: '#00E676' },
                { label: 'Losers', value: summaryStats.losers.toString(), icon: '📉', color: '#FF5252' },
                { label: 'Metals', value: summaryStats.metalsCount.toString(), icon: '💎', color: '#FFC107' },
              ].map((stat) => (
                <View key={stat.label} style={[styles.summaryCard, { borderColor: stat.color + '30' }]}>
                  <Text style={{ fontSize: 20 }}>{stat.icon}</Text>
                  <Text style={[styles.summaryValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Category Performance */}
            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Category Performance</Text>
              {[
                { label: '💎 Precious Metals', value: summaryStats.metalsAvgChg, icon: '💎' },
                { label: '🛢️ Energy', value: summaryStats.energyAvgChg, icon: '🛢️' },
                { label: '🌾 Agriculture', value: summaryStats.agriAvgChg, icon: '🌾' },
              ].map((cat) => (
                <React.Fragment key={cat.label}>
                  <View style={styles.catRow}>
                    <Text style={[styles.catLabel, { color: colors.text }]}>{cat.label}</Text>
                    <Text style={[styles.catValue, { color: cat.value >= 0 ? '#00E676' : '#FF5252' }]}>
                      {(cat.value >= 0 ? '+' : '') + cat.value.toFixed(2)}%
                    </Text>
                  </View>
                  <View style={[styles.catBar, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                    <View style={[styles.catBarFill, {
                      width: `${Math.min(Math.abs(cat.value) * 5, 100)}%`,
                      backgroundColor: cat.value >= 0 ? '#00E676' : '#FF5252',
                      alignSelf: cat.value >= 0 ? 'flex-start' : 'flex-end',
                    }]} />
                  </View>
                </React.Fragment>
              ))}
            </View>

            {/* All Commodities List in Summary */}
            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>All Commodities</Text>
              {COMMODITIES.map((c, i) => {
                const isUp = c.changePercent >= 0;
                return (
                  <View key={c.id} style={[styles.commodityRow, i < COMMODITIES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                    <View style={styles.commodityRowLeft}>
                      <Text style={{ fontSize: 18 }}>{c.icon}</Text>
                      <View>
                        <Text style={[styles.commodityRowName, { color: colors.text }]}>{c.name}</Text>
                        <Text style={[styles.commodityRowSymbol, { color: colors.textMuted }]}>{c.symbol}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Text style={[styles.commodityRowPrice, { color: colors.text }]}>${c.price.toFixed(c.price < 10 ? 2 : 1)}</Text>
                      <View style={[styles.miniChange, { backgroundColor: isUp ? '#00E67620' : '#FF525220' }]}>
                        <Ionicons name={isUp ? 'caret-up' : 'caret-down'} size={10} color={isUp ? '#00E676' : '#FF5252'} />
                        <Text style={[styles.miniChangeText, { color: isUp ? '#00E676' : '#FF5252' }]}>
                          {isUp ? '+' : ''}{c.changePercent.toFixed(2)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Info */}
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>Commodity Trading in India</Text>
                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  Commodities are traded on MCX (Multi Commodity Exchange) and NCDEX. Key contracts: Gold (1kg), Silver (30kg), Crude Oil (100 barrels). Trading hours: 9:00 AM - 11:30 PM. International prices are in USD; MCX prices are in INR. STT on commodity futures: 0.01%.
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
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 4, marginTop: SPACING.md, flexWrap: 'wrap' },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs + 2, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  tabLabel: { ...FONTS.semiBold, fontSize: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginTop: SPACING.md },
  searchInput: { flex: 1, ...FONTS.medium, fontSize: FONTS.size.sm, padding: 0 },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
  resultCount: { ...FONTS.regular, fontSize: FONTS.size.xs, fontStyle: 'italic', marginBottom: SPACING.sm },

  // Connection badge
  connBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  connDot: { width: 6, height: 6, borderRadius: 3 },
  connText: { ...FONTS.semiBold, fontSize: 9, letterSpacing: 0.3 },

  // Card
  card: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  cardIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardSymbol: { ...FONTS.bold, fontSize: FONTS.size.md },
  cardName: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardPrice: { ...FONTS.bold, fontSize: FONTS.size.lg },
  changeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  changeText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  categoryBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  categoryText: { ...FONTS.medium, fontSize: 9, letterSpacing: 0.3 },
  inrPrice: { ...FONTS.regular, fontSize: 9 },

  // Chart
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  rangeCol: { gap: 4 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  rangeLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  rangeValue: { ...FONTS.mono, fontSize: FONTS.size.xs },

  // 52W
  weekRangeContainer: { marginTop: SPACING.md, gap: 4 },
  weekRangeLabel: { ...FONTS.regular, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  weekRangeBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  weekRangeFill: { height: '100%', borderRadius: 3 },
  weekRangeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  weekRangeText: { ...FONTS.regular, fontSize: 8 },

  // Expanded
  expandedContent: { marginTop: SPACING.md, padding: SPACING.md, borderRadius: BORDER_RADIUS.md },
  expandedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  expandedItem: { width: '45%' },
  expandedLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  expandedValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  expandedTrend: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 16, marginTop: SPACING.md },
  statBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, marginTop: SPACING.sm },
  statText: { ...FONTS.medium, fontSize: 9, letterSpacing: 0.2 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.sm },
  emptyTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  emptyDesc: { ...FONTS.regular, fontSize: FONTS.size.xs },

  // Summary
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  summaryCard: {
    width: (width - 48 - SPACING.sm) / 2,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryValue: { ...FONTS.bold, fontSize: FONTS.size.lg },
  summaryLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, textAlign: 'center' },
  sectionCard: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
  sectionTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md },
  catLabel: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  catValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  catBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4, marginBottom: SPACING.sm },
  catBarFill: { height: '100%', borderRadius: 3 },
  commodityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md },
  commodityRowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  commodityRowName: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  commodityRowSymbol: { ...FONTS.regular, fontSize: FONTS.size.xs },
  commodityRowPrice: { ...FONTS.bold, fontSize: FONTS.size.md },
  miniChange: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: BORDER_RADIUS.full },
  miniChangeText: { ...FONTS.medium, fontSize: 9 },
  infoCard: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.lg },
  infoTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: 4 },
  infoText: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 16 },
});
