import React, { useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { usePollStore } from '../../store/pollStore';
import { POLL_CATEGORIES } from '../../types';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { Poll, PollCategory } from '../../types';

/** Format a relative time string */
function formatRelativeTime(t: any, dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('polls.justNow');
  if (mins < 60) return t('polls.minsAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('polls.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t('polls.daysAgo', { count: days });
  return t('polls.monthsAgo', { count: Math.floor(days / 30) });
}

/** Time remaining until expiry */
function timeRemaining(t: any, expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return t('polls.ended');
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return t('polls.minsLeft', { count: Math.floor(diff / 60000) });
  if (hours < 24) return t('polls.hoursLeft', { count: hours });
  return t('polls.daysLeft', { count: Math.floor(hours / 24) });
}

export default function PollsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    polls, activeCategory, activeStatus,
    setActiveCategory, setActiveStatus,
    voteOnPoll, toggleLikePoll, closePoll, deletePoll,
    loadFromCache, getFilteredPolls,
  } = usePollStore();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filteredPolls = useMemo(() => getFilteredPolls(), [polls, activeCategory, activeStatus, getFilteredPolls]);

  const stats = useMemo(() => ({
    total: polls.length,
    active: polls.filter(p => p.status === 'active').length,
    closed: polls.filter(p => p.status === 'closed').length,
    myVotes: polls.filter(p => p.userVote).length,
  }), [polls]);

  // Reload from cache on focus
  useFocusEffect(
    useCallback(() => {
      loadFromCache();
    }, [loadFromCache])
  );

  const handleVote = useCallback((poll: Poll, optionId: string) => {
    if (poll.status === 'closed') return;
    if (poll.userVote) {
      Alert.alert(t('polls.alreadyVoted'), t('polls.alreadyVotedMsg'));
      return;
    }
    voteOnPoll(poll.id, optionId);
  }, [voteOnPoll]);

  const handleLike = useCallback((pollId: string) => {
    toggleLikePoll(pollId);
  }, [toggleLikePoll]);

  const handleMoreOptions = useCallback((poll: Poll) => {
    const isCreator = poll.creatorId === 'user_1';
    const options: { label: string; onPress: () => void; destructive?: boolean }[] = [];

    if (isCreator && poll.status === 'active') {
      options.push({
        label: t('polls.closePoll'),
        onPress: () => {
          Alert.alert(
            t('polls.closePoll'),
            t('polls.closePollMsg'),
            [
              { text: t('polls.cancel'), style: 'cancel' },
              { text: t('polls.close'), onPress: () => closePoll(poll.id) },
            ]
          );
        },
      });
    }
    if (isCreator) {
      options.push({
        label: t('polls.deletePoll'),
        destructive: true,
        onPress: () => {
          Alert.alert(
            t('polls.deletePoll'),
            t('polls.deletePollMsg'),
            [
              { text: t('polls.cancel'), style: 'cancel' },
              { text: t('polls.delete'), style: 'destructive', onPress: () => deletePoll(poll.id) },
            ]
          );
        },
      });
    }
    if (options.length === 0) {
      Alert.alert(t('polls.noActions'), t('polls.noActionsMsg'));
      return;
    }

    Alert.alert(t('polls.pollOptions'), undefined, options.map(o => ({
      text: o.label,
      onPress: o.onPress,
      style: o.destructive ? 'destructive' as const : 'default' as const,
    })));
  }, [closePoll, deletePoll]);

  const ALL_CATEGORIES: { key: PollCategory | 'all'; label: string; icon: string; color: string }[] = [
    { key: 'all', label: 'All', icon: 'apps', color: colors.primary },
    ...Object.values(POLL_CATEGORIES).map(meta => ({
      key: meta.category,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
    })),
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('polls.title')}</Text>
          <Text style={styles.subtitle}>{t('polls.subtitle')}</Text>
        </View>

        {/* Stats Bar */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: colors.primary }]}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>{t('polls.total')}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#00C853' }]}>
            <Text style={[styles.statValue, { color: '#00C853' }]}>{stats.active}</Text>
            <Text style={styles.statLabel}>{t('polls.active')}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: colors.textMuted }]}>
            <Text style={[styles.statValue, { color: colors.textMuted }]}>{stats.closed}</Text>
            <Text style={styles.statLabel}>Closed</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#8B5CF6' }]}>
            <Text style={[styles.statValue, { color: '#8B5CF6' }]}>{stats.myVotes}</Text>
            <Text style={styles.statLabel}>{t('polls.myVotes')}</Text>
          </View>
        </View>

        {/* Create Poll Button */}
        <AnimatedPressable
          onPress={() => navigation.navigate('CreatePoll')}
          haptic="medium"
          scaleTo={0.97}
        >
          <View style={styles.createBtn}>
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={styles.createBtnText}>{t('polls.createPoll')}</Text>
          </View>
        </AnimatedPressable>

        {/* Status Filter */}
        <View style={styles.filterRow}>
          {(['all', 'active', 'closed'] as const).map(status => {
            const isActive = activeStatus === status;
            const count = status === 'all'
              ? polls.length
              : polls.filter(p => p.status === status).length;
            return (
              <AnimatedPressable
                key={status}
                onPress={() => setActiveStatus(status)}
                haptic="selection"
                scaleTo={0.94}
              >
                <View style={[
                  styles.filterChip,
                  isActive && { backgroundColor: colors.primary + '25', borderColor: colors.primary },
                ]}>
                  <Text style={[
                    styles.filterChipText,
                    isActive && { color: colors.primary },
                  ]}>
                    {status === 'all' ? t('polls.filterAll') : status === 'active' ? t('polls.active') : t('polls.closed')}
                  </Text>
                  <View style={[styles.filterCount, isActive && { backgroundColor: colors.primary }]}>
                    <Text style={styles.filterCountText}>{count}</Text>
                  </View>
                </View>
              </AnimatedPressable>
            );
          })}
        </View>

        {/* Category Filter Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {ALL_CATEGORIES.map(cat => {
            const isActive = (cat.key === 'all' && !activeCategory) || cat.key === activeCategory;
            return (
              <AnimatedPressable
                key={cat.key}
                onPress={() => setActiveCategory(cat.key === 'all' ? null : cat.key)}
                haptic="selection"
                scaleTo={0.94}
              >
                <View style={[
                  styles.categoryChip,
                  isActive && { backgroundColor: cat.color + '20', borderColor: cat.color },
                ]}>
                  <Ionicons name={cat.icon as any} size={14} color={isActive ? cat.color : colors.textMuted} />
                  <Text style={[
                    styles.categoryChipText,
                    isActive && { color: cat.color },
                  ]}>{cat.label}</Text>
                </View>
              </AnimatedPressable>
            );
          })}
        </ScrollView>

        {/* Poll Cards */}
        {filteredPolls.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>{t('polls.noPollsTitle')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('polls.noPollsSubtitle')}
            </Text>
          </View>
        ) : (
          filteredPolls.map((poll, idx) => (
            <Animated.View
              key={poll.id}
              entering={FadeInDown.delay(idx * 50).springify()}
              layout={Layout.springify()}
            >
              <PollCard
                poll={poll}
                onVote={handleVote}
                onLike={handleLike}
                onMore={handleMoreOptions}
                colors={colors}
                styles={styles}
              />
            </Animated.View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Poll Card Component ──────────────────────────────────────────────────

function PollCard({
  poll, onVote, onLike, onMore, colors, styles,
}: {
  poll: Poll;
  onVote: (poll: Poll, optionId: string) => void;
  onLike: (pollId: string) => void;
  onMore: (poll: Poll) => void;
  colors: any;
  styles: any;
}) {
  const { t } = useT();
  const isActive = poll.status === 'active';
  const hasVoted = !!poll.userVote;
  const catMeta = POLL_CATEGORIES[poll.category];
  const remaining = timeRemaining(t, poll.expiresAt);

  return (
    <View style={[
      styles.pollCard,
      !isActive && { opacity: 0.85 },
    ]}>
      {/* Header: Category badge + Creator info */}
      <View style={styles.pollHeader}>
        <View style={styles.pollHeaderLeft}>
          <View style={[styles.categoryBadge, { backgroundColor: catMeta.color + '20' }]}>
            <Ionicons name={catMeta.icon as any} size={14} color={catMeta.color} />
            <Text style={[styles.categoryText, { color: catMeta.color }]}>{catMeta.label}</Text>
          </View>
          <Text style={styles.creatorText}>{poll.creatorName}</Text>
        </View>
        <View style={styles.pollHeaderRight}>
          {isActive ? (
            <View style={[styles.timeBadge, { backgroundColor: '#00C85320' }]}>
              <View style={styles.activeDot} />
              <Text style={styles.timeText}>{remaining}</Text>
            </View>
          ) : (
            <View style={[styles.timeBadge, { backgroundColor: colors.textMuted + '15' }]}>
              <Ionicons name="lock-closed" size={10} color={colors.textMuted} />
              <Text style={[styles.timeText, { color: colors.textMuted }]}>{t('polls.closedStatus')}</Text>
            </View>
          )}
          <AnimatedPressable onPress={() => onMore(poll)} haptic="light" scaleTo={0.88}>
            <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
          </AnimatedPressable>
        </View>
      </View>

      {/* Question */}
      <Text style={styles.pollQuestion}>{poll.question}</Text>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {poll.options.map(option => {
          const percent = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
          const isSelected = poll.userVote === option.id;

          // Bar color based on selection and status
          const _barColor = isSelected ? catMeta.color : colors.bgCardLight;

          return (
            <AnimatedPressable
              key={option.id}
              onPress={() => onVote(poll, option.id)}
              haptic="selection"
              scaleTo={0.97}
              disabled={!isActive || hasVoted}
            >
              <View style={[
                styles.optionRow,
                isSelected && { borderColor: catMeta.color, borderWidth: 1.5 },
                !isActive && { borderColor: colors.divider },
              ]}>
                {/* Percentage bar background */}
                {(hasVoted || !isActive) && (
                  <View
                    style={[
                      styles.optionBar,
                      {
                        width: `${Math.max(percent, 4)}%`,
                        backgroundColor: isSelected ? catMeta.color + '25' : colors.bgCardLight,
                      },
                    ]}
                  />
                )}

                <View style={styles.optionContent}>
                  <View style={styles.optionLeft}>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={catMeta.color} />
                    )}
                    {!isSelected && !hasVoted && isActive && (
                      <View style={[styles.radioOuter, { borderColor: colors.textMuted }]} />
                    )}
                    <Text style={[
                      styles.optionText,
                      isSelected && { color: catMeta.color, fontFamily: 'System', fontWeight: '600' },
                    ]}>
                      {option.text}
                    </Text>
                  </View>
                  {(hasVoted || !isActive) && (
                    <View style={styles.optionRight}>
                      <Text style={[
                        styles.optionPercent,
                        isSelected && { color: catMeta.color },
                      ]}>
                        {percent}%
                      </Text>
                      <Text style={styles.optionVotes}>
                        {option.votes}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </AnimatedPressable>
          );
        })}
      </View>

      {/* Footer: Total votes + Like */}
      <View style={styles.pollFooter}>
        <Text style={styles.footerText}>
          {poll.totalVotes} {poll.totalVotes !== 1 ? t('polls.votes') : t('polls.vote')}
          {!isActive && ` · ${t('polls.finalResults')}`}
        </Text>

        <View style={styles.footerActions}>
          <AnimatedPressable
            onPress={() => onLike(poll.id)}
            haptic="light"
            scaleTo={0.88}
          >
            <View style={[styles.likeBtn, poll.likedByUser && { backgroundColor: '#FF6B6B15' }]}>
              <Ionicons
                name={poll.likedByUser ? 'heart' : 'heart-outline'}
                size={16}
                color={poll.likedByUser ? '#FF6B6B' : colors.textMuted}
              />
              <Text style={[styles.likeCount, poll.likedByUser && { color: '#FF6B6B' }]}>
                {poll.likes}
              </Text>
            </View>
          </AnimatedPressable>

          <Text style={styles.footerTime}>{formatRelativeTime(t, poll.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}

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
    marginBottom: SPACING.lg,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderLeftWidth: 3,
  },
  statValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.text,
  },
  statLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: colors.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  createBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  filterCount: {
    backgroundColor: colors.bgCardLight,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: {
    ...FONTS.bold,
    fontSize: 10,
    color: colors.text,
  },
  categoryScroll: {
    marginBottom: SPACING.lg,
    marginHorizontal: -SPACING.xl,
  },
  categoryScrollContent: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
    flexDirection: 'row',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.md,
  },
  emptyTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.textMuted,
  },
  emptySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  pollCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  pollHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryText: {
    ...FONTS.medium,
    fontSize: 10,
  },
  creatorText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  pollHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00C853',
  },
  timeText: {
    ...FONTS.medium,
    fontSize: 10,
    color: '#00C853',
  },
  pollQuestion: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
    marginBottom: SPACING.md,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  optionRow: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  optionBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: BORDER_RADIUS.md,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  optionText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.text,
    flex: 1,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  optionPercent: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    minWidth: 36,
    textAlign: 'right',
  },
  optionVotes: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    minWidth: 28,
    textAlign: 'right',
  },
  pollFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  footerText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCardLight,
  },
  likeCount: {
    ...FONTS.medium,
    fontSize: 11,
    color: colors.textMuted,
  },
  footerTime: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
});
