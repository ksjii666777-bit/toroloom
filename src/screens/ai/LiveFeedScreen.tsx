/**
 * ============================================================================
 * Toroloom — Live Feed Screen
 * ============================================================================
 *
 * Full-page view of all sentiment live feed events with:
 *   - Source filter chips (All, News, Social, Analyst, AI)
 *   - Direction filter (All, Improving, Deteriorating)
 *   - Search bar (filters by symbol, stock name, or message text)
 *   - Real-time auto-updating events
 *   - Pull-to-refresh
 *   - Event count + source distribution summary
 * ============================================================================
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TextInput, Dimensions, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerHaptic, ImpactFeedbackStyle } from '../../utils/haptics';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS} from '../../constants/theme';
import Svg, { Line, Rect, G, Text as SvgText } from 'react-native-svg';
import {
  generateInitialFeedEvents,
  generateRandomFeedEvent,
  formatFeedTimestamp,
  getSourceLabel,
} from '../../services/ai/sentimentLiveFeed';
import { shareNative, showShareSheet } from '../../utils/share';
import type { ShareContent } from '../../utils/share';
import type { LiveFeedEvent } from '../../services/ai/sentimentLiveFeed';
import AnimatedScaleButton from '../../components/AnimatedScaleButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SourceFilter = 'all' | LiveFeedEvent['source'];
type DirectionFilter = 'all' | 'improving' | 'deteriorating';

const SOURCE_FILTERS: { key: SourceFilter; label: string; icon: string; color: string }[] = [
  { key: 'all', label: 'All', icon: 'pulse', color: '#8B5CF6' },
  { key: 'news', label: 'News', icon: 'newspaper', color: '#3B82F6' },
  { key: 'social', label: 'Social', icon: 'chatbubbles', color: '#10B981' },
  { key: 'analyst', label: 'Analyst', icon: 'analytics', color: '#F59E0B' },
  { key: 'ai', label: 'AI', icon: 'bulb', color: '#EF4444' },
];

const DIRECTION_FILTERS: { key: DirectionFilter; label: string; icon: string; color: string }[] = [
  { key: 'all', label: 'All', icon: 'swap-vertical', color: '#8B5CF6' },
  { key: 'improving', label: 'Up', icon: 'trending-up', color: '#10B981' },
  { key: 'deteriorating', label: 'Down', icon: 'trending-down', color: '#EF4444' },
];

// ─── Sentiment Frequency Chart ───────────────────────────────

type Timeframe = 'all' | '5m' | '15m' | '1h';

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '5m', label: '5m' },
  { key: '15m', label: '15m' },
  { key: '1h', label: '1h' },
];

const TIMEFRAME_MS: Record<Exclude<Timeframe, 'all'>, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
};

const CHART_HEIGHT = 130;
const NUM_BUCKETS = 10;

function SentimentFrequencyChart({ events }: { events: LiveFeedEvent[] }) {
  const { colors } = useTheme();
  const [timeframe, setTimeframe] = useState<Timeframe>('all');

  const width = SCREEN_WIDTH - SPACING.xl * 2;
  const height = CHART_HEIGHT;
  const pad = { top: 16, right: 6, bottom: 18, left: 26 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const buckets = useMemo(() => {
    if (events.length === 0) return [];

    // Filter events by selected timeframe
    let filtered = events;
    if (timeframe !== 'all') {
      const sorted = [...events].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      const newest = new Date(sorted[sorted.length - 1].timestamp).getTime();
      const cutoff = newest - TIMEFRAME_MS[timeframe];
      filtered = events.filter(e => new Date(e.timestamp).getTime() >= cutoff);
    }

    if (filtered.length === 0) return [];

    const sorted = [...filtered].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const oldest = new Date(sorted[0].timestamp).getTime();
    const newest = new Date(sorted[sorted.length - 1].timestamp).getTime();
    const range = Math.max(newest - oldest, 1000);
    const bucketMs = range / NUM_BUCKETS;

    const b: { improving: number; deteriorating: number; time: number }[] = [];
    for (let i = 0; i < NUM_BUCKETS; i++) {
      b.push({ improving: 0, deteriorating: 0, time: oldest + bucketMs * i });
    }
    for (const event of sorted) {
      const t = new Date(event.timestamp).getTime();
      const idx = Math.min(NUM_BUCKETS - 1, Math.floor((t - oldest) / bucketMs));
      b[idx][event.direction === 'improving' ? 'improving' : 'deteriorating']++;
    }
    return b;
  }, [events, timeframe]);

  const filteredEventCount = useMemo(() => {
    if (events.length === 0) return 0;
    if (timeframe === 'all') return events.length;
    const sorted = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const newest = new Date(sorted[sorted.length - 1].timestamp).getTime();
    const cutoff = newest - TIMEFRAME_MS[timeframe];
    return events.filter(e => new Date(e.timestamp).getTime() >= cutoff).length;
  }, [events, timeframe]);

  const maxCount = useMemo(() => {
    if (buckets.length === 0) return 1;
    return Math.max(1, ...buckets.map(b => b.improving + b.deteriorating));
  }, [buckets]);

  const yLabels = useMemo(() => {
    const labels = [0];
    if (maxCount > 1) labels.push(Math.round(maxCount / 2));
    labels.push(maxCount);
    return labels;
  }, [maxCount]);

  // ── Derived geometry (hooks stay above, early return after) ──
  if (events.length === 0 || buckets.length === 0) return null;

  const barGap = chartW / NUM_BUCKETS;
  const barWidth = Math.max(4, barGap - 3);
  const bottomY = pad.top + chartH;

  const xLabelIndices = [0, Math.floor(NUM_BUCKETS / 3), Math.floor(2 * NUM_BUCKETS / 3), NUM_BUCKETS - 1]
    .filter(i => i < buckets.length)
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <View style={[chartStyles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {/* Header row */}
      <View style={chartStyles.headerRow}>
        <View style={chartStyles.headerLeft}>
          <Ionicons name="pulse" size={14} color={colors.textMuted} />
          <Text style={[chartStyles.title, { color: colors.textSecondary }]}>Frequency</Text>
        </View>
        <View style={[chartStyles.peakBadge, { backgroundColor: '#8B5CF615' }]}>
          <Text style={[chartStyles.peakText, { color: '#8B5CF6' }]}>Peak {maxCount}/bucket</Text>
        </View>
        {filteredEventCount > 0 && (
          <View style={chartStyles.eventCountBadge}>
            <Text style={[chartStyles.eventCountText, { color: colors.textMuted }]}>
              {filteredEventCount}
            </Text>
          </View>
        )}
        <View style={chartStyles.timeframeRow}>
          {TIMEFRAMES.map(tf => {
            const isActive = timeframe === tf.key;
            return (
              <AnimatedScaleButton
                key={tf.key}
                style={[
                  chartStyles.timeframeBtn,
                  {
                    backgroundColor: isActive ? '#8B5CF6' : 'transparent',
                    borderColor: isActive ? '#8B5CF6' : colors.border,
                  },
                ]}
                onPress={() => {
                  triggerHaptic();
                  setTimeframe(tf.key);
                }}
              >
                <Text style={[chartStyles.timeframeBtnText, { color: isActive ? '#FFFFFF' : colors.textMuted }]}>
                  {tf.label}
                </Text>
              </AnimatedScaleButton>
            );
          })}
        </View>
        <View style={chartStyles.legendRow}>
          <View style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: '#10B981', opacity: 0.7 }} />
          <Text style={[chartStyles.legendLabel, { color: colors.textMuted }]}>Up</Text>
          <View style={{ width: 8 }} />
          <View style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: '#EF4444', opacity: 0.7 }} />
          <Text style={[chartStyles.legendLabel, { color: colors.textMuted }]}>Dn</Text>
        </View>
      </View>

      {/* SVG Chart */}
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {yLabels.map((c, i) => {
          const y = pad.top + chartH * (1 - c / maxCount);
          return (
            <Line
              key={`g${i}`} x1={pad.left} y1={y} x2={width - pad.right} y2={y}
              stroke={colors.borderLight} strokeWidth={0.5} strokeDasharray="3,3"
            />
          );
        })}

        {/* Y-axis labels */}
        {yLabels.map((c, i) => {
          const y = pad.top + chartH * (1 - c / maxCount);
          return (
            <SvgText
              key={`yl${i}`} x={pad.left - 5} y={y + 3}
              fill={colors.textMuted} fontSize={9} fontFamily="System" textAnchor="end"
            >
              {c}
            </SvgText>
          );
        })}

        {/* Stacked bars */}
        {buckets.map((bucket, i) => {
          const x = pad.left + i * barGap;
          const deterioratingH = (bucket.deteriorating / maxCount) * chartH;
          const improvingH = (bucket.improving / maxCount) * chartH;
          const deterioratingY = bottomY - deterioratingH;
          const improvingY = deterioratingY - improvingH;

          return (
            <G key={`bar-${i}`}>
              {bucket.deteriorating > 0 && (
                <Rect
                  x={x} y={deterioratingY}
                  width={barWidth} height={deterioratingH}
                  fill="#EF4444" rx={1} opacity={0.7}
                />
              )}
              {bucket.improving > 0 && (
                <Rect
                  x={x} y={improvingY}
                  width={barWidth} height={improvingH}
                  fill="#10B981" rx={1} opacity={0.7}
                />
              )}
            </G>
          );
        })}

        {/* X-axis labels */}
        {xLabelIndices.map(i => {
          const d = new Date(buckets[i].time);
          const label = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          return (
            <SvgText
              key={`xl${i}`}
              x={pad.left + i * barGap + barWidth / 2}
              y={height - 3}
              fill={colors.textMuted} fontSize={8} fontFamily="System" textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  peakBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  peakText: {
    fontSize: 9,
    fontWeight: '700',
  },
  eventCountBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#8B5CF615',
    marginLeft: 'auto',
  },
  eventCountText: {
    fontSize: 9,
    fontWeight: '600',
  },
  timeframeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  timeframeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  timeframeBtnText: {
    fontSize: 9,
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  legendLabel: {
    fontSize: 8,
    fontWeight: '500',
    marginLeft: 3,
  },
});

// ─── Event Card ────────────────────────────────────────────

function EventCard({ event }: { event: LiveFeedEvent }) {
  const { colors } = useTheme();
  const [shared, setShared] = useState(false);
  const sharedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirColor = event.direction === 'improving' ? '#10B981' : '#EF4444';
  const srcFilter = SOURCE_FILTERS.find(f => f.key === event.source)!;

  const shareContent = useMemo<ShareContent>(() => {
    const directionLabel = event.direction === 'improving' ? '↑' : '↓';
    const shareMsg = `${event.symbol} ${directionLabel} ${event.direction === 'improving' ? '+' : ''}${event.magnitude}pts
${event.message}
Score: ${event.score > 0 ? '+' : ''}${event.score} · ${getSourceLabel(event.source)}

Shared via Toroloom`;
    return { message: shareMsg, title: `Sentiment Alert: ${event.symbol}` };
  }, [event]);

  const handleShare = useCallback(async () => {
    triggerHaptic();
    const ok = await shareNative(shareContent);
    if (ok) {
      setShared(true);
      if (sharedTimerRef.current) clearTimeout(sharedTimerRef.current);
      sharedTimerRef.current = setTimeout(() => setShared(false), 1500);
    }
  }, [shareContent]);

  const handleShareLongPress = useCallback(() => {
    triggerHaptic(ImpactFeedbackStyle.Medium);
    showShareSheet(shareContent);
  }, [shareContent]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (sharedTimerRef.current) clearTimeout(sharedTimerRef.current);
    };
  }, []);

  return (
    <View style={[eventStyles.card, {
      backgroundColor: colors.bgCard,
      borderColor: colors.border,
      borderLeftColor: dirColor,
    }]}>
      <View style={eventStyles.topRow}>
        <View style={[eventStyles.dirIcon, { backgroundColor: dirColor + '15' }]}>
          <Ionicons
            name={event.direction === 'improving' ? 'trending-up' : 'trending-down'}
            size={16}
            color={dirColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={eventStyles.symbolRow}>
            <Text style={[eventStyles.symbol, { color: colors.text }]}>{event.symbol}</Text>
            <Text style={[eventStyles.magnitude, { color: dirColor }]}>
              {event.direction === 'improving' ? '+' : ''}{event.magnitude}pts
            </Text>
            <Text style={[eventStyles.timestamp, { color: colors.textMuted }]}>
              {formatFeedTimestamp(event.timestamp)}
            </Text>
          </View>
          <Text style={[eventStyles.message, { color: colors.textSecondary }]} numberOfLines={2}>
            {event.message}
          </Text>
        </View>
      </View>

      <View style={eventStyles.bottomRow}>
        <View style={[eventStyles.sourceBadge, { backgroundColor: srcFilter.color + '18' }]}>
          <Ionicons name={srcFilter.icon as any} size={11} color={srcFilter.color} />
          <Text style={[eventStyles.sourceText, { color: srcFilter.color }]}>
            {getSourceLabel(event.source)}
          </Text>
        </View>
        <View style={[eventStyles.scoreChip, { backgroundColor: dirColor + '12' }]}>
          <Text style={[eventStyles.scoreText, { color: dirColor }]}>
            Score: {event.score > 0 ? '+' : ''}{event.score}
          </Text>
        </View>          <AnimatedScaleButton onPress={handleShare} onLongPress={handleShareLongPress} style={eventStyles.shareBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            {shared ? (
              <Ionicons name="checkmark" size={16} color="#10B981" />
            ) : (
              <Ionicons name="share-outline" size={14} color={colors.textMuted} />
            )}
          </AnimatedScaleButton>
      </View>
    </View>
  );
}

const eventStyles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  dirIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  symbol: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  magnitude: {
    fontSize: 12,
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 'auto',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    marginTop: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.md,
    flexWrap: 'wrap',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scoreChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  scoreText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sector: {
    fontSize: 10,
    fontWeight: '500',
  },
  shareBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ─── Main Screen ───────────────────────────────────────────

export default function LiveFeedScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Events State ────────────────────────────────────────
  const [events, setEvents] = useState<LiveFeedEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const counterRef = useRef(0);

  // ── Filters & Search ─────────────────────────────────────
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  // ── Initialize + Real-time updates ──────────────────────
  useEffect(() => {
    setEvents(generateInitialFeedEvents(20));
    counterRef.current = 20;

    const interval = setInterval(() => {
      counterRef.current += 1;
      const newEvent = generateRandomFeedEvent(counterRef.current);
      setEvents(prev => [newEvent, ...prev].slice(0, 100));
    }, 3000 + Math.floor(Math.random() * 3000));

    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    triggerHaptic();
    setRefreshing(true);
    counterRef.current += 10;
    const fresh: LiveFeedEvent[] = [];
    for (let i = 0; i < 5; i++) {
      fresh.push(generateRandomFeedEvent(counterRef.current + i));
    }
    setEvents(prev => [...fresh, ...prev].slice(0, 100));
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // ── Filtered Events ─────────────────────────────────────
  const filteredEvents = useMemo(() => {
    let result = events;

    if (sourceFilter !== 'all') {
      result = result.filter(e => e.source === sourceFilter);
    }
    if (directionFilter !== 'all') {
      result = result.filter(e => e.direction === directionFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.symbol.toLowerCase().includes(q) ||
        e.stockName.toLowerCase().includes(q) ||
        e.message.toLowerCase().includes(q),
      );
    }

    return result;
  }, [events, sourceFilter, directionFilter, searchQuery]);

  // ── Source distribution ─────────────────────────────────
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = { news: 0, social: 0, analyst: 0, ai: 0 };
    filteredEvents.forEach(e => { counts[e.source]++; });
    return counts;
  }, [filteredEvents]);

  const totalCount = filteredEvents.length;
  const improvingCount = filteredEvents.filter(e => e.direction === 'improving').length;
  const deterioratingCount = totalCount - improvingCount;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => { triggerHaptic(); navigation.goBack(); }} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Live Sentiment Feed</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {totalCount} events · {improvingCount} ↑ {deterioratingCount} ↓
            </Text>
          </View>
        </View>

        {/* Sentiment Frequency Chart */}
        <SentimentFrequencyChart events={events} />

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by symbol, name, or message..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable testID="search-clear-btn" onPress={() => { triggerHaptic(); setSearchQuery(''); searchInputRef.current?.blur(); }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Source Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow}>
          {SOURCE_FILTERS.map(f => {
            const isActive = sourceFilter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.filterChip, {
                  backgroundColor: isActive ? f.color + '20' : colors.bgCard,
                  borderColor: isActive ? f.color : colors.border,
                }]}
                onPress={() => {
                  triggerHaptic();
                  setSourceFilter(f.key);
                }}
              >
                <Ionicons name={f.icon as any} size={14} color={isActive ? f.color : colors.textMuted} />
                <Text style={[styles.filterChipText, { color: isActive ? f.color : colors.textSecondary }]}>
                  {f.label}
                </Text>
                {isActive && sourceCounts[f.key] !== undefined && (
                  <View style={[styles.filterCount, { backgroundColor: f.color + '30' }]}>
                    <Text style={[styles.filterCountText, { color: f.color }]}>
                      {f.key === 'all' ? totalCount : sourceCounts[f.key]}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Direction Filter Row */}
        <View style={styles.dirFilterRow}>
          {DIRECTION_FILTERS.map(f => {
            const isActive = directionFilter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.dirChip, {
                  backgroundColor: isActive ? f.color + '20' : colors.bgCard,
                  borderColor: isActive ? f.color : colors.border,
                }]}
                onPress={() => {
                  triggerHaptic();
                  setDirectionFilter(f.key);
                }}
              >
                <Ionicons name={f.icon as any} size={13} color={isActive ? f.color : colors.textMuted} />
                <Text style={[styles.dirChipText, { color: isActive ? f.color : colors.textSecondary }]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Event List */}
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
        {filteredEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pulse-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Events</Text>
            <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
              {searchQuery ? 'Try a different search term' : 'No events match the selected filters'}
            </Text>
          </View>
        ) : (
          filteredEvents.map(event => (
            <EventCard key={event.id} event={event} />
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSubtitle: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  // Search
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    marginBottom: SPACING.md,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '500', marginLeft: SPACING.sm, paddingVertical: 2 },

  // Filters
  filtersRow: { marginBottom: SPACING.sm },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  filterCount: {
    minWidth: 18, height: 18, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  filterCountText: { fontSize: 9, fontWeight: '800' },

  // Direction filters
  dirFilterRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  dirChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
  },
  dirChipText: { fontSize: 12, fontWeight: '600' },

  // Content
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 80, gap: SPACING.md },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyDesc: { fontSize: 13, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 },
});
