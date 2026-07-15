/**
 * ============================================================================
 * Toroloom — Bond Dashboard Screen
 * ============================================================================
 *
 * Displays a comprehensive bond dashboard with:
 *   - Tab navigation: Government, Corporate, Tax-Free
 *   - Bond rows with coupon, yield, rating, maturity
 *   - Expanded detail on tap
 *   - Category/sector filters
 *   - Search by name/issuer
 *   - Summary metrics (avg yield, total count, etc.)
 *
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { mockBonds } from '../../constants/mockData';
import type { Bond } from '../../types';

const { width } = Dimensions.get('window');

// ─── Tab config ──────────────────────────────────────────────
type TabKey = 'govt' | 'corporate' | 'taxfree' | 'summary';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { key: 'govt',     label: 'Govt',     icon: 'shield-checkmark' },
  { key: 'corporate',label: 'Corporate', icon: 'business' },
  { key: 'taxfree',  label: 'Tax-Free',  icon: 'leaf' },
  { key: 'summary',  label: 'Summary',   icon: 'stats-chart' },
];

// ─── Rating colors ──────────────────────────────────────────
const RATING_COLORS: Record<string, string> = {
  AAA: '#00E676',
  AA:  '#3B82F6',
  A:   '#FFC107',
  BBB: '#FF9800',
  BB:  '#FF6B6B',
  B:   '#FF1744',
};

// ─── Yield curve labels ─────────────────────────────────────
function yearsToBucket(y: number): string {
  if (y < 1) return '<1Y';
  if (y < 3) return '1-3Y';
  if (y < 5) return '3-5Y';
  if (y < 10) return '5-10Y';
  return '10Y+';
}

// ══════════════════════════════════════════════════════════════
// BOND ROW
// ══════════════════════════════════════════════════════════════

function BondRow({
  bond,
  isExpanded,
  onPress,
}: {
  bond: Bond;
  isExpanded: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const fmtPct = (v: number) => `${v.toFixed(2)}%`;
  const fmtCr = (v: number) => `₹${(v / 1000).toFixed(0)}K Cr`;
  const maturityDate = new Date(bond.maturityDate).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const yieldUp = bond.yieldChangeBps > 0;
  const ratingColor = RATING_COLORS[bond.rating] || colors.textMuted;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Animated.View entering={FadeInUp.duration(300)} style={[styles.bondRow, { borderBottomColor: colors.divider }]}>
        {/* Header */}
        <View style={styles.bondRowHeader}>
          <View style={styles.bondRowLeft}>
            <Text style={[styles.bondName, { color: colors.text }]}>{bond.name}</Text>
            <Text style={[styles.bondIssuer, { color: colors.textMuted }]} numberOfLines={1}>{bond.issuer}</Text>
          </View>
          <View style={[styles.ratingBadge, { backgroundColor: ratingColor + '20' }]}>
            <Text style={[styles.ratingText, { color: ratingColor }]}>{bond.rating}</Text>
          </View>
        </View>

        {/* Metrics row */}
        <View style={styles.bondMetrics}>
          <View style={styles.bondMetric}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Coupon</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>{fmtPct(bond.couponRate)}</Text>
          </View>
          <View style={styles.bondMetric}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>YTM</Text>
            <Text style={[styles.metricValue, { color: yieldUp ? '#FF5252' : '#00E676' }]}>
              {fmtPct(bond.yieldToMaturity)}
            </Text>
          </View>
          <View style={styles.bondMetric}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Maturity</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>{bond.yearsToMaturity.toFixed(1)}y</Text>
          </View>
          <View style={styles.bondMetric}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Price</Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              ₹{bond.currentPrice.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Yield change indicator */}
        <View style={styles.yieldChangeRow}>
          <Ionicons
            name={yieldUp ? 'arrow-up' : 'arrow-down'}
            size={12}
            color={yieldUp ? '#FF5252' : '#00E676'}
          />
          <Text style={[styles.yieldChangeText, { color: yieldUp ? '#FF5252' : '#00E676' }]}>
            Yield {yieldUp ? '+' : ''}{bond.yieldChangeBps} bps today
          </Text>
          {!bond.isTaxable && (
            <View style={[styles.taxFreeBadge, { backgroundColor: '#00E67620' }]}>
              <Text style={[styles.taxFreeText, { color: '#00E676' }]}>Tax-Free</Text>
            </View>
          )}
        </View>

        {/* Expanded detail */}
        {isExpanded && (
          <Animated.View entering={FadeInDown.duration(200)} style={[styles.expandedContent, { backgroundColor: colors.bgInput }]}>
            <Text style={[styles.expandedDesc, { color: colors.textSecondary }]}>{bond.description}</Text>
            <View style={styles.expandedGrid}>
              <View style={styles.expandedItem}>
                <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>Face Value</Text>
                <Text style={[styles.expandedValue, { color: colors.text }]}>₹{bond.faceValue}</Text>
              </View>
              <View style={styles.expandedItem}>
                <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>Issue Size</Text>
                <Text style={[styles.expandedValue, { color: colors.text }]}>{fmtCr(bond.issueSize)}</Text>
              </View>
              <View style={styles.expandedItem}>
                <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>Maturity</Text>
                <Text style={[styles.expandedValue, { color: colors.text }]}>{maturityDate}</Text>
              </View>
              <View style={styles.expandedItem}>
                <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>Listed</Text>
                <Text style={[styles.expandedValue, { color: bond.isListed ? '#00E676' : colors.textMuted }]}>
                  {bond.isListed ? 'Yes' : 'No'}
                </Text>
              </View>
              {bond.sector && (
                <View style={styles.expandedItem}>
                  <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>Sector</Text>
                  <Text style={[styles.expandedValue, { color: colors.text }]}>{bond.sector}</Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════

export default function BondDashboardScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('govt');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Filter bonds by tab
  const filteredBonds = useMemo(() => {
    let bonds = [...mockBonds];

    // Tab filter
    if (activeTab === 'govt') {
      bonds = bonds.filter(b => b.category === 'government' || b.category === 'state');
    } else if (activeTab === 'corporate') {
      bonds = bonds.filter(b => b.category === 'corporate' && b.isTaxable);
    } else if (activeTab === 'taxfree') {
      bonds = bonds.filter(b => b.category === 'corporate' && !b.isTaxable);
    }

    // Category filter (within corporate)
    if (filterCategory && activeTab === 'corporate') {
      bonds = bonds.filter(b => b.sector === filterCategory);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      bonds = bonds.filter(
        b => b.name.toLowerCase().includes(q) || b.issuer.toLowerCase().includes(q) || b.rating.toLowerCase().includes(q),
      );
    }

    return bonds;
  }, [activeTab, filterCategory, searchQuery]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const govtBonds = mockBonds.filter(b => b.category === 'government' || b.category === 'state');
    const corpTaxable = mockBonds.filter(b => b.category === 'corporate' && b.isTaxable);
    const taxFree = mockBonds.filter(b => b.category === 'corporate' && !b.isTaxable);

    const avgYTM = (bonds: Bond[]) =>
      bonds.length > 0 ? bonds.reduce((s, b) => s + b.yieldToMaturity, 0) / bonds.length : 0;

    const avgCoupon = (bonds: Bond[]) =>
      bonds.length > 0 ? bonds.reduce((s, b) => s + b.couponRate, 0) / bonds.length : 0;

    return {
      govt: { count: govtBonds.length, avgYTM: avgYTM(govtBonds), avgCoupon: avgCoupon(govtBonds) },
      corp: { count: corpTaxable.length, avgYTM: avgYTM(corpTaxable), avgCoupon: avgCoupon(corpTaxable) },
      taxfree: { count: taxFree.length, avgYTM: avgYTM(taxFree), avgCoupon: avgCoupon(taxFree) },
      all: mockBonds.length,
    };
  }, []);

  // Yield curve data
  const yieldCurve = useMemo(() => {
    const buckets: Record<string, { yield: number; count: number }> = {};
    for (const b of mockBonds) {
      const key = yearsToBucket(b.yearsToMaturity);
      if (!buckets[key]) buckets[key] = { yield: 0, count: 0 };
      buckets[key].yield += b.yieldToMaturity;
      buckets[key].count += 1;
    }
    const labels = ['<1Y', '1-3Y', '3-5Y', '5-10Y', '10Y+'];
    return labels.map(l => ({
      label: l,
      avgYield: buckets[l] ? Math.round((buckets[l].yield / buckets[l].count) * 100) / 100 : 0,
      count: buckets[l]?.count || 0,
    }));
  }, []);

  // Corporate sector categories
  const corpSectors = useMemo(() => {
    const sectors = new Set(mockBonds.filter(b => b.category === 'corporate' && b.sector).map(b => b.sector!));
    return ['All', ...Array.from(sectors)];
  }, []);

  const handleBondPress = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const fmtPct = (v: number) => `${v.toFixed(2)}%`;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerTitles}>
            <Text style={[styles.title, { color: colors.text }]}>Bond Dashboard</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Fixed Income Marketplace</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => { setActiveTab(tab.key); setExpandedId(null); setFilterCategory(null); setSearchQuery(''); }}
                style={[
                  styles.tabBtn,
                  { backgroundColor: isActive ? colors.primary + '20' : 'transparent', borderColor: isActive ? colors.primary + '40' : 'transparent' },
                ]}
              >
                <Ionicons name={tab.icon as any} size={14} color={isActive ? colors.primary : colors.textMuted} />
                <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.textMuted }]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search (hidden on summary tab) */}
        {activeTab !== 'summary' && (
          <View style={[styles.searchBar, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={`Search ${activeTab === 'govt' ? 'government bonds' : activeTab === 'taxfree' ? 'tax-free bonds' : 'corporate bonds'}...`}
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

        {/* Sector filter (corporate tab) */}
        {activeTab === 'corporate' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {corpSectors.map(s => {
              const isActive = filterCategory === s || (s === 'All' && !filterCategory);
              return (
                <Pressable
                  key={s}
                  onPress={() => setFilterCategory(s === 'All' ? null : s)}
                  style={[styles.filterChip, { backgroundColor: isActive ? colors.primary + '20' : colors.bgInput, borderColor: isActive ? colors.primary + '40' : colors.border }]}
                >
                  <Text style={[styles.filterChipText, { color: isActive ? colors.primary : colors.textMuted }]}>{s}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── BOND LIST TABS ── */}
        {(activeTab === 'govt' || activeTab === 'corporate' || activeTab === 'taxfree') && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={styles.resultCountRow}>
              <Text style={[styles.resultCount, { color: colors.textMuted }]}>
                {filteredBonds.length} bond{filteredBonds.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {filteredBonds.length > 0 ? (
              filteredBonds.map(bond => (
                <BondRow
                  key={bond.id}
                  bond={bond}
                  isExpanded={expandedId === bond.id}
                  onPress={() => handleBondPress(bond.id)}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>No bonds found</Text>
                <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>Try adjusting your search or filters</Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── SUMMARY TAB ── */}
        {activeTab === 'summary' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            {/* Overview Cards */}
            <View style={styles.summaryGrid}>
              {[
                { label: 'Total Bonds', value: summaryStats.all.toString(), icon: '📊', color: '#6C63FF' },
                { label: 'Avg Govt YTM', value: fmtPct(summaryStats.govt.avgYTM), icon: '🏛️', color: '#3B82F6' },
                { label: 'Avg Corp YTM', value: fmtPct(summaryStats.corp.avgYTM), icon: '🏢', color: '#00E676' },
                { label: 'Avg Tax-Free', value: fmtPct(summaryStats.taxfree.avgYTM), icon: '🌿', color: '#FFC107' },
              ].map((stat, i) => (
                <Animated.View key={stat.label} entering={FadeInUp.duration(300).delay(i * 60)} style={[styles.summaryCard, { borderColor: stat.color + '30' }]}>
                  <Text style={styles.summaryIcon}>{stat.icon}</Text>
                  <Text style={[styles.summaryValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{stat.label}</Text>
                </Animated.View>
              ))}
            </View>

            {/* Yield Curve */}
            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Yield Curve</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Average YTM by maturity bucket</Text>
              <View style={styles.yieldCurveContent}>
                {yieldCurve.map((pt, i) => {
                  const maxYield = Math.max(...yieldCurve.map(p => p.avgYield), 1);
                  const barHeight = (pt.avgYield / maxYield) * 120;
                  return (
                    <View key={pt.label} style={styles.curveBarCol}>
                      <Text style={[styles.curveYield, { color: colors.text }]}>{pt.avgYield.toFixed(1)}%</Text>
                      <View style={[styles.curveBar, { height: barHeight, backgroundColor: colors.primary }]} />
                      <Text style={[styles.curveLabel, { color: colors.textMuted }]}>{pt.label}</Text>
                      <Text style={[styles.curveCount, { color: colors.textMuted }]}>({pt.count})</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Category Breakdown */}
            <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Category Breakdown</Text>
              {[
                { label: 'Government Bonds', icon: '🏛️', count: summaryStats.govt.count, avgCoupon: summaryStats.govt.avgCoupon, color: '#3B82F6' },
                { label: 'State Bonds (SDLs)', icon: '🏙️', count: 2, avgCoupon: 7.32, color: '#6C63FF' },
                { label: 'Corporate Bonds', icon: '🏢', count: summaryStats.corp.count, avgCoupon: summaryStats.corp.avgCoupon, color: '#00E676' },
                { label: 'Tax-Free Bonds', icon: '🌿', count: summaryStats.taxfree.count, avgCoupon: summaryStats.taxfree.avgCoupon, color: '#FFC107' },
              ].map((cat, i) => (
                <View key={cat.label} style={[styles.catRow, i < 3 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <View style={styles.catInfo}>
                    <Text style={[styles.catLabel, { color: colors.text }]}>{cat.label}</Text>
                    <Text style={[styles.catCount, { color: colors.textMuted }]}>{cat.count} bonds</Text>
                  </View>
                  <Text style={[styles.catYield, { color: cat.color }]}>{fmtPct(cat.avgCoupon)}</Text>
                </View>
              ))}
            </View>

            {/* Market Info */}
            <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>About Bond Markets</Text>
                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  Indian bond market size is ~₹200 lakh crore. G-Secs form 60% of the market. 
                  Corporate bonds offer higher yields than G-Secs with additional credit risk. 
                  Tax-free bonds provide coupon income exempt from income tax, making them attractive for high-tax-bracket investors.
                </Text>
              </View>
            </View>
          </Animated.View>
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
  header: {
    padding: SPACING.xl,
    paddingTop: 60,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  headerTitles: { flex: 1 },
  title: { ...FONTS.bold, fontSize: FONTS.size.title },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4 },
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
  tabLabel: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  searchInput: {
    flex: 1,
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    padding: 0,
  },
  filterScroll: {
    marginTop: SPACING.md,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  filterChipText: { ...FONTS.medium, fontSize: FONTS.size.xs },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
  resultCountRow: { marginBottom: SPACING.sm },
  resultCount: { ...FONTS.regular, fontSize: FONTS.size.xs, fontStyle: 'italic' },

  // ── Bond Row ──
  bondRow: {
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bondRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bondRowLeft: { flex: 1, marginRight: SPACING.sm },
  bondName: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  bondIssuer: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2 },
  ratingBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  ratingText: { ...FONTS.bold, fontSize: 11, letterSpacing: 0.5 },
  bondMetrics: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.sm,
  },
  bondMetric: { alignItems: 'center', flex: 1 },
  metricLabel: { ...FONTS.regular, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginTop: 2 },
  yieldChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.sm,
  },
  yieldChangeText: { ...FONTS.regular, fontSize: FONTS.size.xs },
  taxFreeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.xs,
    marginLeft: SPACING.sm,
  },
  taxFreeText: { ...FONTS.bold, fontSize: 8, letterSpacing: 0.3 },

  // ── Expanded Detail ──
  expandedContent: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  expandedDesc: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 16 },
  expandedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  expandedItem: { width: '45%' },
  expandedLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  expandedValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginTop: 2 },

  // ── Empty State ──
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.sm },
  emptyTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  emptyDesc: { ...FONTS.regular, fontSize: FONTS.size.xs },

  // ── Summary ──
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  summaryCard: {
    width: (width - 48 - SPACING.sm) / 2,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  summaryIcon: { fontSize: 24 },
  summaryValue: { ...FONTS.bold, fontSize: FONTS.size.lg },
  summaryLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, textAlign: 'center' },

  // ── Section Card ──
  sectionCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  sectionTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  sectionSubtitle: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2 },

  // ── Yield Curve ──
  yieldCurveContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginTop: SPACING.lg,
    height: 160,
  },
  curveBarCol: { alignItems: 'center', gap: 4, flex: 1 },
  curveYield: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  curveBar: { width: 32, borderRadius: 4, minHeight: 4 },
  curveLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  curveCount: { ...FONTS.regular, fontSize: 9 },

  // ── Category Breakdown ──
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  catIcon: { fontSize: 20 },
  catInfo: { flex: 1 },
  catLabel: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  catCount: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  catYield: { ...FONTS.bold, fontSize: FONTS.size.md },

  // ── Info Card ──
  infoCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  infoTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: 4 },
  infoText: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 16 },
});
