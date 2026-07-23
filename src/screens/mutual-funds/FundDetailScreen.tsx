/**
 * ============================================================================
 * Toroloom — Fund Detail Screen
 * ============================================================================
 *
 * Detailed view of a single mutual fund showing:
 *   1. Fund header (name, category, risk badge, rating, AUM)
 *   2. NAV display with day change + mini sparkline
 *   3. Return comparison bars (1Y/3Y/5Y)
 *   4. NAV history chart (mock 6-month data)
 *   5. Key stats grid (min investment, expense ratio, fund manager, etc.)
 *   6. Sector allocation breakdown (horizontal bar chart)
 *   7. Invest / Start SIP action buttons
 *
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient as SvgGradientDef, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { useMutualFundStore } from '../../store/mutualFundStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { formatCurrency } from '../../utils/formatters';
import type { MutualFund } from '../../types';

const { width } = Dimensions.get('window');

// ─── Mock NAV History Generator ──────────────────────────────────────────

function generateNAVHistory(baseNav: number): Array<{ date: string; nav: number }> {
  const points: Array<{ date: string; nav: number }> = [];
  let nav = baseNav * 0.92;
  const days = 180;

  for (let i = days; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (Math.random() - 0.47) * baseNav * 0.02;
    nav += change;
    // Trend toward actual NAV
    const progress = 1 - (i / days);
    nav = nav * 0.92 + (baseNav * (0.85 + progress * 0.15)) * 0.08;

    points.push({
      date: date.toISOString(),
      nav: Math.round(nav * 100) / 100,
    });
  }

  return points;
}

// ─── Sector Allocation Data (mock) ──────────────────────────────────────

function getSectorAllocation(category: string): Array<{ sector: string; percent: number }> {
  const allocations: Record<string, Array<{ sector: string; percent: number }>> = {
    'Flexi Cap': [
      { sector: 'Financial Services', percent: 28 },
      { sector: 'Technology', percent: 18 },
      { sector: 'Consumer Goods', percent: 15 },
      { sector: 'Automobile', percent: 10 },
      { sector: 'Healthcare', percent: 8 },
      { sector: 'Energy', percent: 7 },
      { sector: 'Others', percent: 14 },
    ],
    'Large Cap': [
      { sector: 'Financial Services', percent: 32 },
      { sector: 'Technology', percent: 20 },
      { sector: 'Energy', percent: 12 },
      { sector: 'Consumer Goods', percent: 11 },
      { sector: 'Automobile', percent: 8 },
      { sector: 'Healthcare', percent: 6 },
      { sector: 'Others', percent: 11 },
    ],
    'Mid Cap': [
      { sector: 'Technology', percent: 22 },
      { sector: 'Financial Services', percent: 20 },
      { sector: 'Consumer Goods', percent: 14 },
      { sector: 'Healthcare', percent: 12 },
      { sector: 'Automobile', percent: 10 },
      { sector: 'Energy', percent: 8 },
      { sector: 'Others', percent: 14 },
    ],
    'Small Cap': [
      { sector: 'Technology', percent: 25 },
      { sector: 'Financial Services', percent: 18 },
      { sector: 'Healthcare', percent: 15 },
      { sector: 'Consumer Goods', percent: 12 },
      { sector: 'Automobile', percent: 10 },
      { sector: 'Energy', percent: 6 },
      { sector: 'Others', percent: 14 },
    ],
  };

  return allocations[category] || allocations['Flexi Cap'];
}

// ─── Sparkline Mini Chart ────────────────────────────────────────────────

function NAVSparkline({ data, width: sparkW = 120, height: sparkH = 40 }: {
  data: Array<{ nav: number }>;
  width?: number;
  height?: number;
}) {
  const id = useMemo(() => `navspark_${Math.random().toString(36).slice(2)}`, []);
  if (data.length < 2) return null;

  const values = data.map(d => d.nav);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = (max - min) || 1;
  const pad = 2;
  const cw = sparkW - pad * 2;
  const ch = sparkH - pad * 2;

  const points = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * cw,
    y: pad + ch - ((v - min) / range) * ch,
  }));

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    path += ` C ${prev.x + (curr.x - prev.x) * 0.4} ${prev.y}, ${prev.x + (curr.x - prev.x) * 0.6} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const last = points[points.length - 1];
  const first = points[0];
  const fillPath = `${path} L ${last.x} ${pad + ch} L ${first.x} ${pad + ch} Z`;
  const isUp = values[values.length - 1] >= values[0];
  const color = isUp ? '#00E676' : '#FF5252';

  return (
    <Svg width={sparkW} height={sparkH}>
      <Defs>
        <SvgGradientDef id={`grad_${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </SvgGradientDef>
      </Defs>
      <Path d={fillPath} fill={`url(#grad_${id})`} />
      <Path d={path} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Circle cx={last.x} cy={last.y} r={2.5} fill={color} />
    </Svg>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────

export default function FundDetailScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { fundId } = route.params || {};

  const { funds, startSIP, investInFund } = useMutualFundStore();

  const fund = useMemo<MutualFund | null>(() => {
    return funds.find(f => f.id === fundId) || null;
  }, [funds, fundId]);

  const navHistory = useMemo(() => fund ? generateNAVHistory(fund.nav) : [], [fund?.nav]);
  const sectorAllocation = useMemo(() => fund ? getSectorAllocation(fund.category) : [], [fund?.category]);
  const [chartTimeframe, setChartTimeframe] = useState('6M');

  // Filter NAV data by timeframe
  const filteredNav = useMemo(() => {
    if (chartTimeframe === 'All') return navHistory;
    const daysMap: Record<string, number> = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
    const days = daysMap[chartTimeframe] || 180;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return navHistory.filter(d => new Date(d.date) >= cutoff);
  }, [navHistory, chartTimeframe]);

  if (!fund) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="sad-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyText, { marginTop: SPACING.md }]}>Fund not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: SPACING.md }}>
          <Text style={[styles.emptyText, { color: colors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPositive = fund.dayChange >= 0;
  const returns = [
    { label: '1Y', value: fund.oneYearReturn, color: fund.oneYearReturn >= 0 ? '#00E676' : '#FF5252' },
    { label: '3Y', value: fund.threeYearReturn, color: fund.threeYearReturn >= 0 ? '#00E676' : '#FF5252' },
    { label: '5Y', value: fund.fiveYearReturn, color: fund.fiveYearReturn >= 0 ? '#00E676' : '#FF5252' },
  ];
  const maxReturn = Math.max(...returns.map(r => Math.abs(r.value)), 1);

  const riskColor = fund.riskLevel === 'low' ? '#00E676' : fund.riskLevel === 'moderate' ? '#FFC107' : '#FF5252';

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </AnimatedPressable>
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {fund.name}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Fund Overview Card ── */}
        <LinearGradient
          colors={GRADIENTS.card}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.overviewCard, { borderColor: colors.border }]}
        >
          <View style={styles.overviewTop}>
            <View style={styles.overviewMeta}>
              <Badge label={fund.category} variant="primary" size="small" />
              <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
              <Text style={[styles.riskText, { color: riskColor }]}>
                {fund.riskLevel.charAt(0).toUpperCase() + fund.riskLevel.slice(1)} Risk
              </Text>
            </View>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingStars}>{'★'.repeat(fund.rating)}</Text>
              <Text style={[styles.ratingEmpty, { color: colors.textMuted }]}>{'★'.repeat(5 - fund.rating)}</Text>
            </View>
          </View>

          {/* NAV Display */}
          <View style={styles.navSection}>
            <View>
              <Text style={[styles.navLabel, { color: colors.textSecondary }]}>NAV</Text>
              <Text style={[styles.navValue, { color: colors.text }]}>
                ₹{fund.nav.toFixed(2)}
              </Text>
              <View style={styles.navChange}>
                <Ionicons
                  name={isPositive ? 'caret-up' : 'caret-down'}
                  size={14}
                  color={isPositive ? '#00E676' : '#FF5252'}
                />
                <Text style={[styles.navChangeText, { color: isPositive ? '#00E676' : '#FF5252' }]}>
                  {fund.dayChange.toFixed(2)} ({fund.dayChangePercent.toFixed(2)}%)
                </Text>
              </View>
            </View>
            <NAVSparkline data={filteredNav} />
          </View>

          {/* AUM & Min Investment */}
          <View style={styles.overviewStats}>
            <View style={styles.overviewStat}>
              <Text style={[styles.overviewStatLabel, { color: colors.textMuted }]}>AUM</Text>
              <Text style={[styles.overviewStatValue, { color: colors.text }]}>{fund.fundSize}</Text>
            </View>
            <View style={[styles.overviewStatDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.overviewStat}>
              <Text style={[styles.overviewStatLabel, { color: colors.textMuted }]}>Min Investment</Text>
              <Text style={[styles.overviewStatValue, { color: colors.text }]}>
                {formatCurrency(fund.minInvestment)}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Return Comparison Bars ── */}
        <Card title="Returns" style={styles.card}>
          {returns.map((r, i) => {
            const pct = Math.abs(r.value) / maxReturn;
            return (
              <Animated.View
                key={r.label}
                entering={FadeInDown.delay(i * 80).springify()}
                style={styles.returnRow}
              >
                <Text style={[styles.returnLabel, { color: colors.textMuted }]}>{r.label}</Text>
                <View style={[styles.returnTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.returnFill,
                      {
                        width: `${pct * 100}%`,
                        backgroundColor: r.color,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.returnValue, { color: r.color }]}>
                  {r.value >= 0 ? '+' : ''}{r.value.toFixed(1)}%
                </Text>
              </Animated.View>
            );
          })}
        </Card>

        {/* ── NAV Chart ── */}
        <Card title="NAV History" style={styles.card}>
          <View style={styles.timeframeRow}>
            {['1M', '3M', '6M', '1Y', 'All'].map(tf => (
              <TouchableOpacity
                key={tf}
                style={[
                  styles.timeframeBtn,
                  { backgroundColor: chartTimeframe === tf ? colors.primary + '20' : colors.bgInput },
                ]}
                onPress={() => setChartTimeframe(tf)}
              >
                <Text style={[styles.timeframeText, {
                  color: chartTimeframe === tf ? colors.primary : colors.textMuted,
                }]}>{tf}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {filteredNav.length > 1 && (
            <NAVSparkline data={filteredNav} width={width - SPACING.xl * 2 - SPACING.xxl * 2} height={60} />
          )}
        </Card>

        {/* ── Sector Allocation ── */}
        <Card title="Sector Allocation" style={styles.card}>
          {sectorAllocation.map((item, i) => (
            <Animated.View
              key={item.sector}
              entering={FadeInDown.delay(i * 50).springify()}
              style={styles.sectorRow}
            >
              <Text style={[styles.sectorLabel, { color: colors.text }]}>{item.sector}</Text>
              <View style={[styles.sectorTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.sectorFill,
                    {
                      width: `${item.percent}%`,
                      backgroundColor: ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1'][i % 7],
                    },
                  ]}
                />
              </View>
              <Text style={[styles.sectorPercent, { color: colors.textMuted }]}>{item.percent}%</Text>
            </Animated.View>
          ))}
        </Card>

        {/* ── Key Stats ── */}
        <Card title="Fund Details" style={styles.card}>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Expense Ratio</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{(Math.random() * 1.5 + 0.5).toFixed(2)}%</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Fund Manager</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>Mr. Sharma</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Launch Date</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {new Date(Date.now() - Math.random() * 10 * 365 * 86400000).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Exit Load</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>1% (within 3M)</Text>
            </View>
          </View>
        </Card>

        {/* ── Action Buttons ── */}
        <View style={styles.actionsRow}>
          <AnimatedPressable
            onPress={() => {
              Alert.alert('Invest', `Invest in ${fund.name}?`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: `Invest ₹${fund.minInvestment}`,
                  onPress: () => {
                    investInFund(fund.id, fund.minInvestment);
                    Alert.alert('Success', `Invested ₹${fund.minInvestment} in ${fund.name}`);
                  },
                },
              ]);
            }}
            haptic="light"
            scaleTo={0.97}
            style={{ flex: 1 }}
          >
            <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
              <Ionicons name="wallet-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Invest Now</Text>
            </LinearGradient>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => {
              Alert.alert('Start SIP', `Start SIP in ${fund.name}? Minimum ₹${fund.minInvestment}`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Start ₹5,000/mo',
                  onPress: () => {
                    startSIP(fund.id, 5000, 'monthly');
                    Alert.alert('SIP Started', `Monthly SIP of ₹5,000 started in ${fund.name}`);
                  },
                },
                {
                  text: 'Start ₹10,000/mo',
                  onPress: () => {
                    startSIP(fund.id, 10000, 'monthly');
                    Alert.alert('SIP Started', `Monthly SIP of ₹10,000 started in ${fund.name}`);
                  },
                },
              ]);
            }}
            haptic="medium"
            scaleTo={0.97}
            style={{ flex: 1 }}
          >
            <View style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.primary }]}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Start SIP</Text>
            </View>
          </AnimatedPressable>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  header: {
    paddingTop: 60,
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
  },
  emptyText: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
  },

  // Overview
  overviewCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  overviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  riskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  riskText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    textTransform: 'capitalize',
  },
  ratingRow: {
    flexDirection: 'row',
  },
  ratingStars: {
    fontSize: 14,
    color: '#FFC107',
  },
  ratingEmpty: {
    fontSize: 14,
  },

  // NAV
  navSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  navLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  navValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxxl,
    marginTop: 2,
  },
  navChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  navChangeText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },

  // Overview Stats
  overviewStats: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  overviewStat: {
    flex: 1,
    alignItems: 'center',
  },
  overviewStatDivider: {
    width: 1,
    height: 30,
    alignSelf: 'center',
  },
  overviewStatLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  overviewStatValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    marginTop: 2,
  },

  // Card
  card: {
    marginBottom: SPACING.lg,
  },

  // Returns
  returnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  returnLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    width: 28,
  },
  returnTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  returnFill: {
    height: '100%',
    borderRadius: 6,
  },
  returnValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    width: 72,
    textAlign: 'right',
    fontFamily: 'monospace',
  },

  // NAV Chart
  timeframeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  timeframeBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
  },
  timeframeText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },

  // Sector Allocation
  sectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectorLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    width: 110,
  },
  sectorTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sectorFill: {
    height: '100%',
    borderRadius: 4,
  },
  sectorPercent: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    width: 36,
    textAlign: 'right',
  },

  // Fund Details
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statBox: {
    width: (width - SPACING.xl * 2 - SPACING.xxl * 2 - SPACING.sm) / 2,
    gap: 2,
  },
  statLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  statValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  actionBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },
});
