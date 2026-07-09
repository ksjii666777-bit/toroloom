/**
 * ============================================================================
 * Toroloom — Social Trading Screen
 * ============================================================================
 *
 * Three-tab interface:
 *   1. Leaderboard — Top traders ranked by P&L, win rate, followers, returns
 *   2. Copy Trading — Active copy relations + copied trades
 *   3. Search — Find traders by name/strategy/stocks
 *
 * Each trader card has Follow and Copy buttons with inline confirmation.
 * ============================================================================
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Dimensions, Alert, RefreshControl, Modal, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradientDef, Stop } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { useSocialStore } from '../../store/socialStore';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import type { LeaderboardSort, LeaderboardPeriod, TraderProfile, LeaderboardEntry } from '../../types';

const { width } = Dimensions.get('window');

// ─── Sort/Period Options ────────────────────────────────────────────────────

const SORT_OPTIONS: { key: LeaderboardSort; label: string; icon: string }[] = [
  { key: 'pnl', label: 'P&L', icon: 'cash' },
  { key: 'returns', label: 'Returns', icon: 'trending-up' },
  { key: 'winRate', label: 'Win Rate', icon: 'checkmark-circle' },
  { key: 'followers', label: 'Followers', icon: 'people' },
  { key: 'trades', label: 'Trades', icon: 'swap-horizontal' },
];

const PERIOD_OPTIONS: { key: LeaderboardPeriod; label: string }[] = [
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: 'All' },
];

// ─── Deterministic Sparkline Data ──────────────────────────────────────────

function generateSparklineData(traderId: string): number[] {
  // Deterministic pseudo-random data based on trader ID — same trader always has the same sparkline
  let hash = 0;
  for (let i = 0; i < traderId.length; i++) {
    hash = ((hash << 5) - hash) + traderId.charCodeAt(i);
    hash |= 0;
  }
  const data: number[] = [];
  for (let i = 0; i < 10; i++) {
    const val = ((Math.abs(hash) * 9301 + 49297 * (i + 1)) % 233280) / 233280;
    data.push(val * 2000 - 1000);
  }
  return data;
}

// ─── Sparkline Mini Chart ───────────────────────────────────────────────────

let sparklineIdCounter = 0;

const Sparkline = React.memo(function Sparkline({ data, width = 48, height = 24, positive }: { data: number[]; width?: number; height?: number; positive: boolean }) {
  const id = useMemo(() => `spark_${++sparklineIdCounter}`, []);
  const gradId = `sparkGrad_${id}`;

  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = (max - min) || 1;
  const padding = 2;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * chartW;
    const y = padding + chartH - ((v - min) / range) * chartH;
    return { x, y };
  });

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cp1x = prev.x + (curr.x - prev.x) * 0.4;
    const cp2x = prev.x + (curr.x - prev.x) * 0.6;
    path += ` C ${cp1x} ${prev.y}, ${cp2x} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const color = positive ? '#00E676' : '#FF5252';

  // Generate fill path
  const last = points[points.length - 1];
  const first = points[0];
  const fillPath = `${path} L ${last.x} ${padding + chartH} L ${first.x} ${padding + chartH} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradientDef id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </SvgGradientDef>
      </Defs>
      <Path d={fillPath} fill={`url(#${gradId})`} />
      <Path d={path} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Circle cx={last.x} cy={last.y} r={2.5} fill={color} />
    </Svg>
  );
});

// ─── Podium ─────────────────────────────────────────────────────────────────

const PODIUM_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const PODIUM_ICONS = ['trophy', 'medal', 'medal-outline'];

function LeaderboardPodium({ topThree, onPress }: { topThree: LeaderboardEntry[]; onPress: (id: string) => void }) {
  const { colors } = useTheme();

  if (topThree.length < 3) return null;

  // Reorder: 2nd, 1st, 3rd (silver, gold, bronze layout)
  const ordered = [topThree[1], topThree[0], topThree[2]];

  return (
    <View style={podiumStyles.wrapper}>
      <View style={podiumStyles.container}>
        {ordered.map((trader, idx) => {
          const isFirst = idx === 1;
          const actualRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
          const color = PODIUM_COLORS[actualRank - 1];
          const icon = PODIUM_ICONS[actualRank - 1];

          return (
            <TouchableOpacity
              key={trader.id}
              style={[podiumStyles.podiumItem, isFirst && podiumStyles.podiumCenter]}
              onPress={() => onPress(trader.id)}
              activeOpacity={0.7}
            >
              {/* Crown/Trophy icon */}
              <Ionicons name={icon as any} size={isFirst ? 24 : 18} color={color} />

              {/* Avatar */}
              <View style={[
                podiumStyles.avatar,
                isFirst && podiumStyles.avatarFirst,
                { borderColor: color },
              ]}>
                <Text style={[podiumStyles.avatarText, isFirst && podiumStyles.avatarTextFirst]}>
                  {trader.name[0]}
                </Text>
              </View>

              {/* Name */}
              <Text style={[podiumStyles.name, isFirst && podiumStyles.nameFirst]} numberOfLines={1}>
                {trader.name.split(' ')[0]}
              </Text>

              {/* Stats */}
              <Text style={[podiumStyles.pnl, { color: trader.totalPnl >= 0 ? '#00E676' : '#FF5252' }]}>
                +{trader.totalPnlPercent.toFixed(1)}%
              </Text>
              <Text style={podiumStyles.followers}>
                {(trader.followers / 1000).toFixed(1)}K followers
              </Text>

              {/* Rank badge */}
              <View style={[podiumStyles.rankBadge, { backgroundColor: color }]}>
                <Text style={podiumStyles.rankText}>#{actualRank}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const podiumStyles = StyleSheet.create({
  wrapper: { marginBottom: SPACING.lg },
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
  },
  podiumItem: {
    alignItems: 'center',
    gap: 4,
    width: (width - SPACING.xl * 2 - SPACING.sm * 2) / 3,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  podiumCenter: {
    paddingVertical: SPACING.lg,
    marginBottom: 0,
    transform: [{ scale: 1.05 }],
    borderColor: 'rgba(255,215,0,0.3)',
    backgroundColor: 'rgba(255,215,0,0.05)',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 14, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  avatarFirst: {
    width: 52, height: 52, borderRadius: 16, borderWidth: 2.5,
  },
  avatarText: { ...FONTS.bold, fontSize: FONTS.size.xl, color: '#E0E6ED' },
  avatarTextFirst: { fontSize: FONTS.size.xxl },
  name: { ...FONTS.semiBold, fontSize: FONTS.size.xs, color: '#E0E6ED', textAlign: 'center' },
  nameFirst: { fontSize: FONTS.size.sm },
  pnl: { ...FONTS.bold, fontSize: FONTS.size.sm },
  followers: { ...FONTS.regular, fontSize: 9, color: '#64748B' },
  rankBadge: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  rankText: { ...FONTS.bold, fontSize: 9, color: '#000' },
});

// ─── Copy Allocation Modal ──────────────────────────────────────────────────

function CopyAllocationModal({
  visible, onClose, trader, onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  trader: TraderProfile | null;
  onConfirm: (allocationPercent: number, investmentAmount: number) => void;
}) {
  const { colors } = useTheme();
  const [allocation, setAllocation] = useState(50);
  const [investment, setInvestment] = useState('250000');

  // Reset when trader changes
  useEffect(() => {
    if (trader) {
      setAllocation(50);
      setInvestment('250000');
    }
  }, [trader?.id]);

  if (!trader) return null;

  const investAmount = parseInt(investment, 10) || 0;
  const copyAmount = Math.round(investAmount * (allocation / 100));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={allocStyles.overlay}>
        <View style={[allocStyles.sheet, { backgroundColor: colors.bgSecondary }]}>
          {/* Handle */}
          <View style={allocStyles.handle}>
            <View style={[allocStyles.handleBar, { backgroundColor: colors.textMuted }]} />
          </View>

          {/* Header */}
          <View style={allocStyles.header}>
            <View style={[allocStyles.avatarSmall, { backgroundColor: colors.primary + '30' }]}>
              <Text style={[allocStyles.avatarSmallText, { color: colors.primary }]}>{trader.name[0]}</Text>
            </View>
            <View style={allocStyles.headerInfo}>
              <Text style={[allocStyles.headerTitle, { color: colors.text }]}>Copy {trader.name}</Text>
              <Text style={[allocStyles.headerSub, { color: colors.textSecondary }]}>
                {trader.strategy.replace(/_/g, ' · ')} · {trader.winRate.toFixed(0)}% win rate
              </Text>
            </View>
          </View>

          {/* Allocation Slider */}
          <View style={allocStyles.section}>
            <View style={allocStyles.sectionHeader}>
              <Text style={[allocStyles.sectionLabel, { color: colors.text }]}>Allocation</Text>
              <Text style={[allocStyles.sectionValue, { color: colors.primary }]}>{allocation}%</Text>
            </View>
            <View style={allocStyles.sliderRow}>
              {[10, 25, 50, 75, 100].map(pct => (
                <TouchableOpacity
                  key={pct}
                  style={[
                    allocStyles.sliderStep,
                    allocation === pct && [allocStyles.sliderStepActive, { borderColor: colors.primary, backgroundColor: colors.primary + '20' }],
                  ]}
                  onPress={() => setAllocation(pct)}
                >
                  <Text style={[
                    allocStyles.sliderStepText,
                    { color: allocation === pct ? colors.primary : colors.textMuted },
                  ]}>{pct}%</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Visual slider bar */}
            <View style={[allocStyles.sliderTrack, { backgroundColor: colors.bgInput }]}>
              <View style={[allocStyles.sliderFill, {
                width: `${allocation}%` as any,
                backgroundColor: colors.primary,
              }]} />
              <View style={[allocStyles.sliderThumb, { left: `${allocation}%` as any, backgroundColor: colors.primary }]} />
            </View>
            <View style={allocStyles.sliderLabels}>
              <Text style={[allocStyles.sliderLabel, { color: colors.textMuted }]}>Min: 10%</Text>
              <Text style={[allocStyles.sliderLabel, { color: colors.textMuted }]}>Max: 100%</Text>
            </View>
          </View>

          {/* Investment Amount */}
          <View style={allocStyles.section}>
            <View style={allocStyles.sectionHeader}>
              <Text style={[allocStyles.sectionLabel, { color: colors.text }]}>Investment Amount</Text>
            </View>
            <View style={[allocStyles.inputRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <Text style={[allocStyles.inputPrefix, { color: colors.textMuted }]}>₹</Text>
              <TextInput
                style={[allocStyles.input, { color: colors.text }]}
                value={investment}
                onChangeText={setInvestment}
                keyboardType="number-pad"
                placeholder="Enter amount"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {/* Summary */}
          <View style={[allocStyles.summary, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={allocStyles.summaryRow}>
              <Text style={[allocStyles.summaryLabel, { color: colors.textSecondary }]}>Copy amount</Text>
              <Text style={[allocStyles.summaryValue, { color: colors.text }]}>₹{copyAmount.toLocaleString()}</Text>
            </View>
            <View style={allocStyles.summaryRow}>
              <Text style={[allocStyles.summaryLabel, { color: colors.textSecondary }]}>Max per trade</Text>
              <Text style={[allocStyles.summaryValue, { color: colors.text }]}>₹{Math.round(copyAmount * 0.25).toLocaleString()}</Text>
            </View>
            <View style={allocStyles.summaryRow}>
              <Text style={[allocStyles.summaryLabel, { color: colors.textSecondary }]}>Est. monthly cost</Text>
              <Text style={[allocStyles.summaryValue, { color: colors.warning }]}>₹{Math.round(copyAmount * 0.003).toLocaleString()}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={allocStyles.actions}>
            <TouchableOpacity style={[allocStyles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={[allocStyles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[allocStyles.confirmBtn, { backgroundColor: colors.primary }]}
              onPress={() => onConfirm(allocation, investAmount)}
            >
              <Ionicons name="copy-outline" size={18} color={colors.white} />
              <Text style={[allocStyles.confirmText, { color: colors.white }]}>Start Copying</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const allocStyles = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  handle: { alignItems: 'center', paddingVertical: SPACING.md },
  handleBar: { width: 40, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.xxl },
  avatarSmall: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarSmallText: { ...FONTS.bold, fontSize: FONTS.size.xl },
  headerInfo: { flex: 1 },
  headerTitle: { ...FONTS.bold, fontSize: FONTS.size.xl },
  headerSub: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 2 },
  section: { marginBottom: SPACING.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionLabel: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  sectionValue: { ...FONTS.bold, fontSize: FONTS.size.lg },
  sliderRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  sliderStep: {
    flex: 1, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  sliderStepActive: {},
  sliderStepText: { ...FONTS.medium, fontSize: FONTS.size.sm },
  sliderTrack: {
    height: 6, borderRadius: 3, position: 'relative',
    marginBottom: SPACING.sm, overflow: 'visible',
  },
  sliderFill: { height: '100%', borderRadius: 3, position: 'absolute', left: 0, top: 0 },
  sliderThumb: {
    width: 20, height: 20, borderRadius: 10, position: 'absolute',
    top: -7, marginLeft: -10,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }, android: { elevation: 4 } }),
  },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { ...FONTS.regular, fontSize: FONTS.size.xs },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  inputPrefix: { ...FONTS.bold, fontSize: FONTS.size.xl, marginRight: SPACING.sm },
  input: { flex: 1, ...FONTS.medium, fontSize: FONTS.size.xl },
  summary: {
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    padding: SPACING.lg, marginBottom: SPACING.xl, gap: SPACING.md,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { ...FONTS.regular, fontSize: FONTS.size.sm },
  summaryValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  actions: { flexDirection: 'row', gap: SPACING.md },
  cancelBtn: {
    flex: 1, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center', borderWidth: 1,
  },
  cancelText: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  confirmBtn: {
    flex: 2, flexDirection: 'row', paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
  },
  confirmText: { ...FONTS.semiBold, fontSize: FONTS.size.md },
});

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function SocialTradingScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    leaderboard, leaderboardSort, leaderboardPeriod,
    followedTraderIds, followingTraders, copyRelations, copiedTrades,
    fetchLeaderboard, setLeaderboardSort, setLeaderboardPeriod,
    followTrader, unfollowTrader, startCopyTrading, stopCopyTrading, toggleCopyPause,
    searchTraders, clearSearch,
    searchQuery, searchResults,
    isFollowing,
  } = useSocialStore();

  const { isFeatureAvailable } = useSubscriptionStore();
  const hasSocialAccess = isFeatureAvailable('social_trading');

  const [activeTab, setActiveTab] = useState<'leaderboard' | 'following' | 'copy' | 'search'>('leaderboard');
  const [refreshing, setRefreshing] = useState(false);
  const [allocModalVisible, setAllocModalVisible] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState<TraderProfile | null>(null);

  // Load leaderboard on mount
  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  }, [fetchLeaderboard]);

  // ── Follow Handler ──────────────────────────────────────────────────
  const handleFollow = useCallback(async (traderId: string) => {
    if (isFollowing(traderId)) {
      await unfollowTrader(traderId);
    } else {
      await followTrader(traderId);
    }
  }, [isFollowing, followTrader, unfollowTrader]);

  // ── Copy Trading Start ──────────────────────────────────────────────
  const handleStartCopy = useCallback((trader: TraderProfile) => {
    if (!hasSocialAccess) {
      Alert.alert('Premium Feature', 'Social & Copy Trading requires an Elite subscription. Upgrade to follow and copy top traders.');
      return;
    }
    setSelectedTrader(trader);
    setAllocModalVisible(true);
  }, [hasSocialAccess]);

  const handleCopyConfirm = useCallback((allocationPercent: number, investmentAmount: number) => {
    if (selectedTrader) {
      startCopyTrading(selectedTrader.id, allocationPercent, investmentAmount);
    }
    setAllocModalVisible(false);
    setSelectedTrader(null);
  }, [selectedTrader, startCopyTrading]);

  // ── Trader Card ────────────────────────────────────────────────────
  const renderTraderCard = useCallback((trader: TraderProfile, rank?: number, rankChange?: 'up' | 'down' | 'same', _rankChangeNum?: number) => {
    const isFollowed = followedTraderIds.includes(trader.id);
    const isCopyingTrader = copyRelations.some(r => r.traderId === trader.id);

    return (
      <TouchableOpacity
        key={trader.id}
        style={styles.traderCard}
        onPress={() => navigation.navigate('TraderProfile', { traderId: trader.id })}
        activeOpacity={0.7}
      >
        <View style={styles.traderCardTop}>
          {/* Rank */}
          {rank !== undefined && (
            <View style={[styles.rankBadge, rank <= 3 && styles.rankBadgeTop]}>
              <Text style={[styles.rankText, rank <= 3 && styles.rankTextTop]}>#{rank}</Text>
              {rankChange && rankChange !== 'same' && (
                <Ionicons
                  name={rankChange === 'up' ? 'arrow-up' : 'arrow-down'}
                  size={10}
                  color={rankChange === 'up' ? '#00E676' : '#FF5252'}
                  style={{ marginLeft: 1 }}
                />
              )}
            </View>
          )}

          {/* Avatar */}
          <View style={[styles.traderAvatar, { backgroundColor: colors.primary + '30' }]}>
            <Text style={styles.avatarText}>{trader.name[0]}</Text>
          </View>

          {/* Info */}
          <View style={styles.traderInfo}>
            <View style={styles.traderNameRow}>
              <Text style={styles.cardName}>{trader.name}</Text>
              {trader.verified && <Ionicons name="checkmark-circle" size={14} color="#00E676" />}
              {isCopyingTrader && <Badge label="Copy" variant="primary" size="medium" />}
            </View>
            <Text style={styles.cardStrategy}>{trader.strategy.replace(/_/g, ' · ')}</Text>
            <View style={styles.cardStats}>
              <Text style={styles.cardStat}>
                <Text style={{ color: trader.totalPnl >= 0 ? colors.marketUp : colors.marketDown }}>
                  ₹{(trader.totalPnl / 100000).toFixed(1)}L
                </Text>
                {' · '}{trader.winRate.toFixed(0)}% WR
              </Text>
            </View>
          </View>

          {/* Follow/Followed indicator */}
          <TouchableOpacity
            style={[styles.followBtn, isFollowed && styles.followBtnActive]}
            onPress={() => handleFollow(trader.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isFollowed ? 'people' : 'person-add-outline'}
              size={16}
              color={isFollowed ? colors.white : colors.primary}
            />
          </TouchableOpacity>
        </View>          {/* Sparkline */}
          <View style={styles.cardSparklineRow}>
            <Sparkline
              data={generateSparklineData(trader.id)}
              width={48}
              height={24}
              positive={trader.totalPnl >= 0}
            />
          </View>

          {/* Stats Row */}
        <View style={styles.cardStatsRow}>
          <View style={styles.cardStatItem}>
            <Text style={[styles.cardStatValue, { color: trader.totalPnl >= 0 ? colors.marketUp : colors.marketDown }]}>
              +{trader.totalPnlPercent.toFixed(1)}%
            </Text>
            <Text style={styles.cardStatLabel}>Returns</Text>
          </View>
          <View style={styles.cardStatItem}>
            <Text style={[styles.cardStatValue, { color: colors.primary }]}>{trader.winRate.toFixed(0)}%</Text>
            <Text style={styles.cardStatLabel}>Win Rate</Text>
          </View>
          <View style={styles.cardStatItem}>
            <Text style={[styles.cardStatValue, { color: colors.text }]}>{(trader.followers / 1000).toFixed(1)}K</Text>
            <Text style={styles.cardStatLabel}>Followers</Text>
          </View>
          <View style={styles.cardStatItem}>
            <Text style={[styles.cardStatValue, { color: colors.marketUp }]}>+{trader.monthlyReturn.toFixed(1)}%</Text>
            <Text style={styles.cardStatLabel}>Monthly</Text>
          </View>
        </View>

        {/* Copy Button */}
        <AnimatedPressable
          onPress={() => handleStartCopy(trader)}
          haptic="light"
          scaleTo={0.97}
          style={{ marginTop: SPACING.md }}
        >            <LinearGradient
              colors={trader.riskScore === 'low' ? GRADIENTS.accent : GRADIENTS.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardCopyBtn}
            >
              <Ionicons name="copy-outline" size={16} color={colors.white} />
              <Text style={styles.cardCopyBtnText}>
                {isCopyingTrader ? 'Already Copying' : `Copy ${trader.name}`}
              </Text>
            </LinearGradient>
        </AnimatedPressable>
      </TouchableOpacity>
    );
  }, [colors, styles, handleFollow, handleStartCopy, followedTraderIds, copyRelations]);

  // ── Copy Trade Card ────────────────────────────────────────────────
  const renderCopyTrade = useCallback((relation: typeof copyRelations[0]) => {
    const relTrades = copiedTrades.filter(t => t.traderId === relation.traderId);
    return (
      <Card key={relation.traderId} style={styles.copyRelationCard}>
        <View style={styles.copyRelationHeader}>
          <View style={styles.copyTraderRow}>
            <View style={[styles.crAvatar, { backgroundColor: colors.primary + '30' }]}>
              <Text style={styles.crAvatarText}>{relation.traderName[0]}</Text>
            </View>
            <View style={styles.crInfo}>
              <Text style={styles.crName}>{relation.traderName}</Text>
              <Text style={styles.crAlloc}>{relation.allocationPercent}% allocation · ₹{(relation.investmentAmount / 100000).toFixed(1)}L</Text>
            </View>
          </View>
          <View style={styles.crRight}>
            <Text style={[styles.crPnl, { color: relation.totalPnl >= 0 ? colors.marketUp : colors.marketDown }]}>
              {relation.totalPnl >= 0 ? '+' : ''}₹{relation.totalPnl.toLocaleString()}
            </Text>
            <Text style={styles.crActive}>{relation.activeTrades} active</Text>
          </View>
        </View>

        {/* Copied Trades */}
        {relTrades.length > 0 && (
          <View style={styles.copiedTradesList}>
            {relTrades.map(trade => (
              <View key={trade.id} style={styles.copiedTradeRow}>
                <View style={styles.copiedTradeLeft}>
                  <Text style={styles.copiedTradeSymbol}>{trade.symbol}</Text>
                  <View style={[
                    styles.copiedTradeType,
                    { backgroundColor: trade.action === 'buy' ? '#00E67620' : '#FF525220' },
                  ]}>
                    <Text style={[
                      styles.copiedTradeTypeText,
                      { color: trade.action === 'buy' ? '#00E676' : '#FF5252' },
                    ]}>
                      {trade.action.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.copiedTradeQty}>{trade.quantity} qty</Text>
                </View>
                <Text style={[styles.copiedTradePnl, {
                  color: trade.pnl && trade.pnl >= 0 ? colors.marketUp : colors.marketDown,
                }]}>
                  {trade.pnl && trade.pnl >= 0 ? '+' : ''}₹{Math.abs(trade.pnl || 0).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.crActions}>
          <AnimatedPressable
            onPress={() => toggleCopyPause(relation.traderId)}
            haptic="light"
            scaleTo={0.97}
          >
            <View style={[styles.crActionBtn, { borderColor: colors.border }]}>
              <Ionicons
                name={relation.isPaused ? 'play' : 'pause'}
                size={16}
                color={relation.isPaused ? colors.marketUp : colors.textMuted}
              />
              <Text style={[styles.crActionText, { color: relation.isPaused ? colors.marketUp : colors.textMuted }]}>
                {relation.isPaused ? 'Resume' : 'Pause'}
              </Text>
            </View>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => {
              Alert.alert('Stop Copy Trading', `Stop copying ${relation.traderName}? Open positions will be closed.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Stop', style: 'destructive', onPress: () => stopCopyTrading(relation.traderId) },
              ]);
            }}
            haptic="warning"
            scaleTo={0.97}
          >
            <View style={[styles.crActionBtn, { borderColor: colors.danger + '40' }]}>
              <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
              <Text style={[styles.crActionText, { color: colors.danger }]}>Stop</Text>
            </View>
          </AnimatedPressable>
        </View>
      </Card>
    );
  }, [colors, styles, copiedTrades, toggleCopyPause, stopCopyTrading]);

  // ── Premium Gate ───────────────────────────────────────────────────
  if (!hasSocialAccess) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Social Trading</Text>
        </View>
        <View style={styles.premiumGate}>
          <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.premiumIconContainer}>
            <Ionicons name="people" size={48} color={colors.white} />
          </LinearGradient>
          <Text style={styles.premiumTitle}>Social & Copy Trading</Text>
          <Text style={styles.premiumDesc}>
            Follow and copy India's top traders automatically. Requires Elite subscription.
          </Text>
          <AnimatedPressable
            onPress={() => navigation.navigate('Subscription')}
            haptic="medium"
            scaleTo={0.97}
          >
            <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.upgradeBtn}>
              <Ionicons name="diamond" size={20} color={colors.white} />
              <Text style={styles.upgradeBtnText}>Upgrade to Elite</Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Social Trading</Text>
          <View style={{ width: 40 }} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'leaderboard' as const, label: 'Leaderboard', icon: 'trophy' },
          { key: 'following' as const, label: 'Following', icon: 'people', badge: followingTraders.length },
          { key: 'copy' as const, label: 'Copy Trading', icon: 'copy', badge: copyRelations.length },
          { key: 'search' as const, label: 'Search', icon: 'search' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <View style={styles.tabRow}>
              <Ionicons
                name={tab.icon as keyof typeof Ionicons.glyphMap}
                size={16}
                color={activeTab === tab.key ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {tab.badge !== undefined && tab.badge > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{tab.badge}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'leaderboard' ? (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Podium — top 3 */}
          <LeaderboardPodium topThree={leaderboard.slice(0, 3)} onPress={(id) => navigation.navigate('TraderProfile', { traderId: id })} />

          {/* Sort & Period */}
          <View style={styles.filterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll}>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.sortChip, leaderboardSort === opt.key && styles.sortChipActive]}
                  onPress={() => setLeaderboardSort(opt.key)}
                >
                  <Ionicons
                    name={opt.icon as keyof typeof Ionicons.glyphMap}
                    size={14}
                    color={leaderboardSort === opt.key ? colors.white : colors.textMuted}
                  />
                  <Text style={[styles.sortChipText, leaderboardSort === opt.key && styles.sortChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.periodBar}>
            {PERIOD_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.periodChip, leaderboardPeriod === opt.key && styles.periodChipActive]}
                onPress={() => setLeaderboardPeriod(opt.key)}
              >
                <Text style={[styles.periodText, leaderboardPeriod === opt.key && styles.periodTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Trader Cards with Rank Changes */}
          {leaderboard.map((trader) => renderTraderCard(trader, trader.rank, trader.change, trader.rankChange))}

          <View style={{ height: 60 }} />
        </ScrollView>
      ) : activeTab === 'following' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {followingTraders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Followed Traders</Text>
              <Text style={styles.emptyDesc}>
                Browse the leaderboard and follow traders to see their updates here.
              </Text>
            </View>
          ) : (
            <>
              {/* Following Summary */}
              <Card style={styles.copySummary}>
                <View style={styles.copySummaryRow}>
                  <View style={styles.copySummaryItem}>
                    <Text style={styles.copySummaryValue}>{followingTraders.length}</Text>
                    <Text style={styles.copySummaryLabel}>Following</Text>
                  </View>
                  <View style={styles.copySummaryItem}>
                    <Text style={styles.copySummaryValue}>
                      {followingTraders.reduce((s, t) => s + t.totalTrades, 0)}
                    </Text>
                    <Text style={styles.copySummaryLabel}>Total Trades</Text>
                  </View>
                  <View style={styles.copySummaryItem}>
                    <Text style={[styles.copySummaryValue, {
                      color: followingTraders.reduce((s, t) => s + t.totalPnl, 0) >= 0 ? colors.marketUp : colors.marketDown,
                    }]}>
                      +{(((followingTraders.reduce((s, t) => s + t.totalPnl, 0)) / followingTraders.reduce((s, t) => s + 1, 0)) / 100000).toFixed(1)}%
                    </Text>
                    <Text style={styles.copySummaryLabel}>Avg Return</Text>
                  </View>
                  <View style={styles.copySummaryItem}>
                    <Text style={styles.copySummaryValue}>
                      {(followingTraders.reduce((s, t) => s + t.followers, 0) / 1000).toFixed(0)}K
                    </Text>
                    <Text style={styles.copySummaryLabel}>Combined Reach</Text>
                  </View>
                </View>
              </Card>

              {followingTraders.map(trader => (
                <View key={trader.id} style={styles.followingCard}>
                  <TouchableOpacity
                    style={styles.traderCardTop}
                    onPress={() => navigation.navigate('TraderProfile', { traderId: trader.id })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.traderAvatar, { backgroundColor: colors.primary + '30' }]}>
                      <Text style={styles.avatarText}>{trader.name[0]}</Text>
                    </View>
                    <View style={styles.traderInfo}>
                      <View style={styles.traderNameRow}>
                        <Text style={styles.cardName}>{trader.name}</Text>
                        {trader.verified && <Ionicons name="checkmark-circle" size={14} color="#00E676" />}
                      </View>
                      <Text style={styles.cardStrategy}>{trader.strategy.replace(/_/g, ' · ')}</Text>
                      <View style={styles.cardStats}>
                        <Text style={styles.cardStat}>
                          <Text style={{ color: trader.totalPnl >= 0 ? colors.marketUp : colors.marketDown }}>
                            ₹{(trader.totalPnl / 100000).toFixed(1)}L
                          </Text>
                          {' · '}{trader.winRate.toFixed(0)}% WR
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.followBtn, { backgroundColor: colors.danger + '20' }]}
                      onPress={() => unfollowTrader(trader.id)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="person-remove-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                  {/* Mini stats */}
                  <View style={styles.cardStatsRow}>
                    <View style={styles.cardStatItem}>
                      <Text style={[styles.cardStatValue, { color: trader.totalPnl >= 0 ? colors.marketUp : colors.marketDown }]}>
                        +{trader.totalPnlPercent.toFixed(1)}%
                      </Text>
                      <Text style={styles.cardStatLabel}>Returns</Text>
                    </View>
                    <View style={styles.cardStatItem}>
                      <Text style={[styles.cardStatValue, { color: colors.primary }]}>{trader.winRate.toFixed(0)}%</Text>
                      <Text style={styles.cardStatLabel}>Win Rate</Text>
                    </View>
                    <View style={styles.cardStatItem}>
                      <Text style={[styles.cardStatValue, { color: colors.text }]}>{(trader.followers / 1000).toFixed(1)}K</Text>
                      <Text style={styles.cardStatLabel}>Followers</Text>
                    </View>
                    <View style={styles.cardStatItem}>
                      <Text style={[styles.cardStatValue, { color: colors.marketUp }]}>+{trader.monthlyReturn.toFixed(1)}%</Text>
                      <Text style={styles.cardStatLabel}>Monthly</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      ) : activeTab === 'copy' ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Copy Relations */}
          {copyRelations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="copy-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Copy Trading Yet</Text>
              <Text style={styles.emptyDesc}>
                Browse the leaderboard and start copying top traders automatically.
              </Text>
            </View>
          ) : (
            <>
              {/* Summary Card */}
              <Card style={styles.copySummary}>
                <View style={styles.copySummaryRow}>
                  <View style={styles.copySummaryItem}>
                    <Text style={styles.copySummaryValue}>{copyRelations.length}</Text>
                    <Text style={styles.copySummaryLabel}>Active Copy</Text>
                  </View>
                  <View style={styles.copySummaryItem}>
                    <Text style={styles.copySummaryValue}>
                      {copyRelations.reduce((s, r) => s + r.activeTrades, 0)}
                    </Text>
                    <Text style={styles.copySummaryLabel}>Open Trades</Text>
                  </View>
                  <View style={styles.copySummaryItem}>
                    <Text style={[styles.copySummaryValue, {
                      color: copyRelations.reduce((s, r) => s + r.totalPnl, 0) >= 0 ? colors.marketUp : colors.marketDown,
                    }]}>
                      ₹{(copyRelations.reduce((s, r) => s + r.totalPnl, 0) / 1000).toFixed(1)}K
                    </Text>
                    <Text style={styles.copySummaryLabel}>Total P&L</Text>
                  </View>
                  <View style={styles.copySummaryItem}>
                    <Text style={styles.copySummaryValue}>
                      ₹{(copyRelations.reduce((s, r) => s + r.investmentAmount, 0) / 100000).toFixed(1)}L
                    </Text>
                    <Text style={styles.copySummaryLabel}>Invested</Text>
                  </View>
                </View>
              </Card>

              {copyRelations.map(renderCopyTrade)}
            </>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>
      ) : (
        // ── Search Tab ──────────────────────────────────────────────
        <View style={styles.content}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search traders by name, strategy, stock..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={searchTraders}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {searchResults.length === 0 && searchQuery.length > 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Traders Found</Text>
                <Text style={styles.emptyDesc}>Try a different name or strategy.</Text>
              </View>
            ) : searchResults.length > 0 ? (
              searchResults.map(trader => renderTraderCard(trader))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="telescope-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>Discover Top Traders</Text>
                <Text style={styles.emptyDesc}>
                  Search for traders by name, trading strategy, or stocks they trade.
                </Text>
              </View>
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { flex: 1, paddingHorizontal: SPACING.xl },

    // ── Header ──
    header: {
      paddingTop: 60, paddingHorizontal: SPACING.xl, flexDirection: 'row',
      alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    title: { ...FONTS.bold, fontSize: FONTS.size.title, color: colors.text },

    // ── Premium Gate ──
    premiumGate: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xxxl, gap: SPACING.lg },
    premiumIconContainer: { width: 96, height: 96, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
    premiumTitle: { ...FONTS.bold, fontSize: FONTS.size.xxl, color: colors.text, textAlign: 'center' },
    premiumDesc: { ...FONTS.regular, fontSize: FONTS.size.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    upgradeBtn: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    },
    upgradeBtnText: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.white },

    // ── Tabs ──
    tabBar: {
      flexDirection: 'row', marginHorizontal: SPACING.xl, marginBottom: SPACING.lg,
      backgroundColor: colors.bgInput, borderRadius: BORDER_RADIUS.md, padding: 4,
    },
    tab: { flex: 1, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.sm, alignItems: 'center' },
    tabActive: { backgroundColor: colors.bgCard },
    tabRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tabText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.textMuted },
    tabTextActive: { color: colors.primary },
    tabBadge: {
      minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary,
      justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
    },
    tabBadgeText: { ...FONTS.bold, fontSize: 10, color: colors.white },

    // ── Filter Bar ──
    filterBar: { marginBottom: SPACING.md },
    sortScroll: { flexDirection: 'row' },
    sortChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, backgroundColor: colors.bgCard,
      borderWidth: 1, borderColor: colors.border, marginRight: SPACING.sm,
    },
    sortChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    sortChipText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.textMuted },
    sortChipTextActive: { color: colors.white },

    periodBar: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
    periodChip: {
      paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    },
    periodChipActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
    periodText: { ...FONTS.medium, fontSize: FONTS.size.xs, color: colors.textMuted },
    periodTextActive: { color: colors.primary },

    // ── Trader Card ──
    traderCard: {
      backgroundColor: colors.bgCard, borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1, borderColor: colors.border, padding: SPACING.lg, marginBottom: SPACING.md,
    },
    traderCardTop: { flexDirection: 'row', alignItems: 'center' },
    rankBadge: {
      width: 32, height: 32, borderRadius: 10, backgroundColor: colors.bgInput,
      justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm,
    },
    rankBadgeTop: { backgroundColor: '#FFAB4020' },
    rankText: { ...FONTS.bold, fontSize: FONTS.size.sm, color: colors.textMuted },
    rankTextTop: { color: '#FFAB40' },
    traderAvatar: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    avatarText: { ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.primary },
    traderInfo: { flex: 1, marginLeft: SPACING.md },
    traderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cardName: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.text },
    cardStrategy: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textSecondary, marginTop: 1, textTransform: 'capitalize' },
    cardStats: { marginTop: 2 },
    cardStat: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted },
    followBtn: {
      width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + '20',
      justifyContent: 'center', alignItems: 'center', marginLeft: SPACING.sm,
    },
    followBtnActive: { backgroundColor: colors.primary },

    cardStatsRow: {
      flexDirection: 'row', marginTop: SPACING.md, paddingTop: SPACING.md,
      borderTopWidth: 1, borderTopColor: colors.divider,
    },
    cardStatItem: { flex: 1, alignItems: 'center' },
    cardStatValue: { ...FONTS.bold, fontSize: FONTS.size.md },
    cardStatLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },
    cardCopyBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
    },
    cardCopyBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.white },

    // ── Sparkline Row ──
    cardSparklineRow: { alignItems: 'flex-start', marginTop: SPACING.sm, paddingLeft: 32 + SPACING.sm },

    // ── Following Tab ──
    followingCard: {
      backgroundColor: colors.bgCard, borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1, borderColor: colors.border, padding: SPACING.lg, marginBottom: SPACING.md,
    },

    // ── Trader Detail ──
    traderDetail: { paddingTop: SPACING.md, gap: SPACING.lg },
    traderDetailHeader: { flexDirection: 'row', justifyContent: 'flex-end' },
    detailBack: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center' },
    traderBanner: { borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl },
    traderBannerRow: { flexDirection: 'row', gap: SPACING.lg },
    traderAvatarLarge: {
      width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center', alignItems: 'center',
    },
    traderAvatarText: { ...FONTS.bold, fontSize: FONTS.size.xxxl, color: colors.white },
    traderBannerInfo: { flex: 1 },
    traderName: { ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.white },
    traderBio: { ...FONTS.regular, fontSize: FONTS.size.xs, color: 'rgba(255,255,255,0.7)', marginTop: 4, lineHeight: 16 },
    traderTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.md },
    traderExp: { ...FONTS.regular, fontSize: FONTS.size.xs, color: 'rgba(255,255,255,0.6)', alignSelf: 'center' },

    // ── Stats Grid ──
    statsGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm,
    },
    statBox: {
      width: (width - SPACING.xl * 2 - SPACING.sm) / 3,
      backgroundColor: colors.bgCard, borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    statValue: { ...FONTS.bold, fontSize: FONTS.size.md },
    statLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },

    // ── Top Stocks ──
    topStocksSection: {},
    sectionTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text, marginBottom: SPACING.sm },
    topStocksRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
    stockChip: {
      paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    },
    stockChipText: { ...FONTS.medium, fontSize: FONTS.size.xs, color: colors.primary },

    // ── Trader Actions ──
    traderActions: { flexDirection: 'row', gap: SPACING.md },
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
      borderWidth: 1, borderColor: colors.primary,
    },
    actionBtnActive: { backgroundColor: colors.primary },
    actionBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.primary },
    actionBtnTextActive: { color: colors.white },
    copyBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
    },
    copyBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.white },

    // ── Risk Badge ──
    riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, alignSelf: 'center' },
    riskBadgeText: { ...FONTS.medium, fontSize: 10 },

    // ── Copy Trading Tab ──
    copySummary: { marginBottom: SPACING.md },
    copySummaryRow: { flexDirection: 'row' },
    copySummaryItem: { flex: 1, alignItems: 'center' },
    copySummaryValue: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.text },
    copySummaryLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },
    copyRelationCard: { marginBottom: SPACING.md },
    copyRelationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    copyTraderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
    crAvatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    crAvatarText: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.primary },
    crInfo: { flex: 1 },
    crName: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.text },
    crAlloc: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textSecondary, marginTop: 1 },
    crRight: { alignItems: 'flex-end' },
    crPnl: { ...FONTS.bold, fontSize: FONTS.size.md },
    crActive: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 1 },
    copiedTradesList: { marginTop: SPACING.md, gap: SPACING.sm },
    copiedTradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
    copiedTradeLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    copiedTradeSymbol: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },
    copiedTradeType: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    copiedTradeTypeText: { ...FONTS.bold, fontSize: 10 },
    copiedTradeQty: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted },
    copiedTradePnl: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
    crActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: colors.divider },
    crActionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    },
    crActionText: { ...FONTS.medium, fontSize: FONTS.size.sm },

    // ── Search ──
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.bgInput, borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
      borderWidth: 1, borderColor: colors.border, marginBottom: SPACING.lg,
    },
    searchInput: {
      flex: 1, ...FONTS.regular, fontSize: FONTS.size.md, color: colors.text,
      paddingVertical: 0,
    },

    // ── Empty State ──
    emptyState: { alignItems: 'center', paddingVertical: SPACING.huge, gap: SPACING.md },
    emptyTitle: { ...FONTS.semiBold, fontSize: FONTS.size.lg, color: colors.text },
    emptyDesc: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: SPACING.xl },
  });
