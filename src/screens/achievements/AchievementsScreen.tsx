import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useGamificationStore } from '../../store/gamificationStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS, COLORS } from '../../constants/theme';
import { formatDate } from '../../utils/formatters';
import { Badge } from '../../types';

const { width } = Dimensions.get('window');

const titleColors: { [key: string]: [string, string] } = {
  'New Investor': ['#6E6E9A', '#9A9AB0'],
  'Curious Learner': ['#6C63FF', '#4834D4'],
  'Smart Saver': ['#00C853', '#009624'],
  'Active Investor': ['#00D2FF', '#3A7BD5'],
  'Trading Pro': ['#FFC107', '#FF8F00'],
  'Seasoned Trader': ['#FF6B6B', '#D50000'],
  'Market Expert': ['#9C27B0', '#6A1B9A'],
  'Trading Master': ['#FF5722', '#BF360C'],
  'Investor Guru': ['#FFD700', '#FFA000'],
  'Market Legend': ['#FF1744', '#D50000'],
};

const nextRewards = [
  { icon: '🎯', label: 'Place 10 trades', xp: 200 },
  { icon: '📚', label: 'Complete 10 lessons', xp: 150 },
  { icon: '💎', label: 'Hold through a dip', xp: 300 },
  { icon: '⭐', label: 'Get 100 likes', xp: 250 },
];

export default function AchievementsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { userLevel, badges } = useGamificationStore();
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [showTab, setShowTab] = useState<'all' | 'unlocked'>('all');

  const unlockedBadges = badges.filter(b => b.unlocked);
  const lockedBadges = badges.filter(b => !b.unlocked);
  const displayBadges = showTab === 'unlocked' ? unlockedBadges : badges;
  const xpProgress = (userLevel.xp / userLevel.xpToNext) * 100;

  const levelGradient = titleColors[userLevel.title] || GRADIENTS.primary;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Achievements</Text>
          <Text style={styles.subtitle}>{unlockedBadges.length} of {badges.length} badges unlocked</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Level Card */}
        <LinearGradient colors={levelGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.levelCard}>
          <View style={styles.levelTopRow}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelNumber}>{userLevel.level}</Text>
            </View>
            <View style={styles.levelInfo}>
              <Text style={styles.levelTitle}>{userLevel.title}</Text>
              <Text style={styles.levelXp}>{userLevel.totalXp.toLocaleString()} Total XP</Text>
            </View>
          </View>

          {/* XP Progress */}
          <View style={styles.xpSection}>
            <View style={styles.xpRow}>
              <Text style={styles.xpLabel}>Level {userLevel.level} → {userLevel.level + 1}</Text>
              <Text style={styles.xpValue}>{userLevel.xp.toLocaleString()} / {userLevel.xpToNext.toLocaleString()} XP</Text>
            </View>
            <View style={styles.xpBarBg}>
              <View style={[styles.xpBarFill, { width: `${xpProgress}%` }]} />
            </View>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{badges.length}</Text>
            <Text style={styles.statLabel}>Total Badges</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.marketUp }]}>{unlockedBadges.length}</Text>
            <Text style={styles.statLabel}>Unlocked</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.textMuted }]}>{lockedBadges.length}</Text>
            <Text style={styles.statLabel}>Locked</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{Math.round((unlockedBadges.length / badges.length) * 100)}%</Text>
            <Text style={styles.statLabel}>Completion</Text>
          </View>
        </View>

        {/* Tab Toggle */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, showTab === 'all' && styles.tabBtnActive]}
            onPress={() => setShowTab('all')}
          >
            <Text style={[styles.tabText, showTab === 'all' && styles.tabTextActive]}>All Badges</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, showTab === 'unlocked' && styles.tabBtnActive]}
            onPress={() => setShowTab('unlocked')}
          >
            <Text style={[styles.tabText, showTab === 'unlocked' && styles.tabTextActive]}>
              Unlocked ({unlockedBadges.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Badges Grid */}
        <View style={styles.badgesGrid}>
          {displayBadges.map(badge => (
            <TouchableOpacity
              key={badge.id}
              style={[styles.badgeCard, !badge.unlocked && styles.badgeCardLocked]}
              onPress={() => setSelectedBadge(badge)}
              activeOpacity={0.7}
            >
              <View style={[styles.badgeIconWrap, !badge.unlocked && styles.badgeIconLocked]}>
                <Text style={styles.badgeIcon}>{badge.icon}</Text>
                {!badge.unlocked && (
                  <View style={styles.lockOverlay}>
                    <Ionicons name="lock-closed" size={14} color={COLORS.textMuted} />
                  </View>
                )}
              </View>
              <Text style={[styles.badgeName, !badge.unlocked && styles.badgeNameLocked]}>{badge.name}</Text>
              {badge.unlocked && badge.unlockedAt && (
                <Text style={styles.badgeDate}>{formatDate(badge.unlockedAt, 'dd MMM')}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Next Rewards Preview */}
        <Text style={styles.sectionTitle}>Upcoming Challenges</Text>
        <View style={styles.rewardsRow}>
          {nextRewards.map((reward, i) => (
            <View key={i} style={styles.rewardCard}>
              <Text style={styles.rewardIcon}>{reward.icon}</Text>
              <Text style={styles.rewardLabel}>{reward.label}</Text>
              <Text style={styles.rewardXp}>+{reward.xp} XP</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Badge Detail Modal */}
      <Modal
        visible={selectedBadge !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBadge(null)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedBadge(null)}>
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={() => {}}>
            {selectedBadge && (
              <>
                <View style={[styles.modalIconWrap, !selectedBadge.unlocked && styles.modalIconLocked]}>
                  <Text style={styles.modalIcon}>{selectedBadge.icon}</Text>
                  {!selectedBadge.unlocked && (
                    <View style={styles.modalLockOverlay}>
                      <Ionicons name="lock-closed" size={20} color={COLORS.textMuted} />
                    </View>
                  )}
                </View>

                <Text style={styles.modalName}>{selectedBadge.name}</Text>
                <Text style={styles.modalDesc}>{selectedBadge.description}</Text>

                <View style={styles.modalDivider} />

                <View style={styles.modalRow}>
                  <Text style={styles.modalRowLabel}>Requirement</Text>
                  <Text style={styles.modalRowValue}>{selectedBadge.requirement}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalRowLabel}>Status</Text>
                  <Text style={[styles.modalRowValue, {
                    color: selectedBadge.unlocked ? colors.marketUp : colors.textMuted,
                  }]}>
                    {selectedBadge.unlocked ? 'Unlocked' : 'Locked'}
                  </Text>
                </View>
                {selectedBadge.unlocked && selectedBadge.unlockedAt && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalRowLabel}>Date Earned</Text>
                    <Text style={styles.modalRowValue}>
                      {formatDate(selectedBadge.unlockedAt, 'dd MMM yyyy')}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedBadge(null)}
                >
                  <Text style={styles.modalCloseText}>Got it!</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  levelCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.lg,
  },
  levelTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  levelBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelNumber: {
    ...FONTS.black,
    fontSize: FONTS.size.hero,
    color: COLORS.white,
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: COLORS.white,
  },
  levelXp: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  xpSection: {
    gap: SPACING.sm,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  xpValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: COLORS.white,
  },
  xpBarBg: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
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
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.divider,
    alignSelf: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: COLORS.white,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  badgeCard: {
    width: (width - SPACING.xl * 2 - SPACING.md * 2) / 3,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 6,
  },
  badgeCardLocked: {
    opacity: 0.55,
  },
  badgeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.bgCardLight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  badgeIconLocked: {
    backgroundColor: colors.bgInput,
  },
  badgeIcon: {
    fontSize: 24,
  },
  lockOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeName: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.text,
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: colors.textMuted,
  },
  badgeDate: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
  },
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  rewardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  rewardCard: {
    width: (width - SPACING.xl * 2 - SPACING.md) / 2,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 6,
  },
  rewardIcon: {
    fontSize: 28,
  },
  rewardLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.text,
    textAlign: 'center',
  },
  rewardXp: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.bgOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xxl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.bgCardLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    position: 'relative',
  },
  modalIconLocked: {
    backgroundColor: colors.bgInput,
  },
  modalIcon: {
    fontSize: 36,
  },
  modalLockOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalName: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
    marginBottom: SPACING.sm,
  },
  modalDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  modalDivider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.divider,
    marginBottom: SPACING.lg,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 4,
  },
  modalRowLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  modalRowValue: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
    flex: 1,
    textAlign: 'right',
  },
  modalCloseBtn: {
    marginTop: SPACING.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  modalCloseText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: COLORS.white,
  },
});
