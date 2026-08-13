import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useGamificationStore } from '../../store/gamificationStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatDate } from '../../utils/formatters';
import { Badge } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import AppScreen from '../../components/ui/AppScreen';


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
  { icon: '🎯', key: 'reward1', xp: 200 },
  { icon: '📚', key: 'reward2', xp: 150 },
  { icon: '💎', key: 'reward3', xp: 300 },
  { icon: '⭐', key: 'reward4', xp: 250 },
];

export default function AchievementsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Achievements'>) {
  const { colors } = useTheme();
  const { t } = useT();
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
          <AppScreen scroll={false} padded={false}
      header={
  <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.title}>{t('achievements.title')}</Text>
            <Text style={styles.subtitle}>{t('achievements.subtitle', { unlocked: unlockedBadges.length, total: badges.length })}</Text>
          </View>
        </View>
      }
      >
  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Level Card */}
          <LinearGradient colors={levelGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.levelCard}>
            <View style={styles.levelTopRow}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelNumber}>{userLevel.level}</Text>
              </View>
              <View style={styles.levelInfo}>
                <Text style={styles.levelTitle}>{userLevel.title}</Text>
                <Text style={styles.levelXp}>{t('achievements.totalXp', { xp: userLevel.totalXp.toLocaleString() })}</Text>
              </View>
            </View>

            {/* XP Progress */}
            <View style={styles.xpSection}>
              <View style={styles.xpRow}>
                <Text style={styles.xpLabel}>{t('achievements.levelLabel', { current: userLevel.level, next: userLevel.level + 1 })}</Text>
                <Text style={styles.xpValue}>{t('achievements.xpProgress', { current: userLevel.xp.toLocaleString(), next: userLevel.xpToNext.toLocaleString() })}</Text>
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
              <Text style={styles.statLabel}>{t('achievements.statTotalBadges')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.marketUp }]}>{unlockedBadges.length}</Text>
              <Text style={styles.statLabel}>{t('achievements.statUnlocked')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.textMuted }]}>{lockedBadges.length}</Text>
              <Text style={styles.statLabel}>{t('achievements.statLocked')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.accent }]}>{Math.round((unlockedBadges.length / badges.length) * 100)}%</Text>
              <Text style={styles.statLabel}>{t('achievements.statCompletion')}</Text>
            </View>
          </View>

          {/* Tab Toggle */}
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tabBtn, showTab === 'all' && styles.tabBtnActive]}
              onPress={() => setShowTab('all')}
            >
              <Text style={[styles.tabText, showTab === 'all' && styles.tabTextActive]}>{t('achievements.tabAllBadges')}</Text>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, showTab === 'unlocked' && styles.tabBtnActive]}
              onPress={() => setShowTab('unlocked')}
            >
              <Text style={[styles.tabText, showTab === 'unlocked' && styles.tabTextActive]}>
                {t('achievements.tabUnlocked', { count: unlockedBadges.length })}
              </Text>
            </Pressable>
          </View>

          {/* Badges Grid */}
          <View style={styles.badgesGrid}>
            {displayBadges.map(badge => (
              <Pressable
                key={badge.id}
                style={[styles.badgeCard, !badge.unlocked && styles.badgeCardLocked]}
                onPress={() => setSelectedBadge(badge)}
              
              >
                <View style={[styles.badgeIconWrap, !badge.unlocked && styles.badgeIconLocked]}>
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  {!badge.unlocked && (
                    <View style={styles.lockOverlay}>
                      <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
                    </View>
                  )}
                </View>
                <Text style={[styles.badgeName, !badge.unlocked && styles.badgeNameLocked]}>{badge.name}</Text>
                {badge.unlocked && badge.unlockedAt && (
                  <Text style={styles.badgeDate}>{formatDate(badge.unlockedAt, 'dd MMM')}</Text>
                )}
              </Pressable>
            ))}
          </View>

          {/* Next Rewards Preview */}
          <Text style={styles.sectionTitle}>{t('achievements.upcomingChallenges')}</Text>
          <View style={styles.rewardsRow}>
            {nextRewards.map((reward) => (
              <View key={reward.key} style={styles.rewardCard}>
                <Text style={styles.rewardIcon}>{reward.icon}</Text>
                <Text style={styles.rewardLabel}>{t('achievements.' + reward.key)}</Text>
                <Text style={styles.rewardXp}>{t('achievements.rewardXp', { xp: reward.xp })}</Text>
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
          <Pressable style={styles.modalOverlay}  onPress={() => setSelectedBadge(null)}>
            <Pressable style={styles.modalContent}  onPress={() => {}}>
              {selectedBadge && (
                <>
                  <View style={[styles.modalIconWrap, !selectedBadge.unlocked && styles.modalIconLocked]}>
                    <Text style={styles.modalIcon}>{selectedBadge.icon}</Text>
                    {!selectedBadge.unlocked && (
                      <View style={styles.modalLockOverlay}>
                        <Ionicons name="lock-closed" size={20} color={colors.textMuted} />
                      </View>
                    )}
                  </View>

                  <Text style={styles.modalName}>{selectedBadge.name}</Text>
                  <Text style={styles.modalDesc}>{selectedBadge.description}</Text>

                  <View style={styles.modalDivider} />

                  <View style={styles.modalRow}>
                    <Text style={styles.modalRowLabel}>{t('achievements.modalRequirement')}</Text>
                    <Text style={styles.modalRowValue}>{selectedBadge.requirement}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalRowLabel}>{t('achievements.modalStatus')}</Text>
                    <Text style={[styles.modalRowValue, {
                      color: selectedBadge.unlocked ? colors.marketUp : colors.textMuted,
                    }]}>
                      {selectedBadge.unlocked ? t('achievements.unlocked') : t('achievements.locked')}
                    </Text>
                  </View>
                  {selectedBadge.unlocked && selectedBadge.unlockedAt && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalRowLabel}>{t('achievements.modalDateEarned')}</Text>
                      <Text style={styles.modalRowValue}>
                        {formatDate(selectedBadge.unlockedAt, 'dd MMM yyyy')}
                      </Text>
                    </View>
                  )}

                  <Pressable
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedBadge(null)}
                  >
                    <Text style={styles.modalCloseText}>{t('achievements.gotIt')}</Text>
                  </Pressable>
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </AppScreen>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
    color: '#FFFFFF',
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: '#FFFFFF',
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
    color: '#FFFFFF',
  },
  xpBarBg: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
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
    color: '#FFFFFF',
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
    backgroundColor: colors.bgOverlay,
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
    color: '#FFFFFF',
  },
});
