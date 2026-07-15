import React, { useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useReferralStore } from '../../store/referralStore';
import { useAuthStore } from '../../store/authStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { shareNative, shareWhatsApp, shareTelegram } from '../../utils/share';
import type { ReferralReward } from '../../types';

const { width } = Dimensions.get('window');
const REWARD_DISPLAY_COUNT = 20;

// ─── Constants ────────────────────────────────────────────────
const REFERRAL_BENEFITS = [
  { icon: '💰', title: '₹100 per Referral', desc: 'Earn ₹100 for every friend who signs up and completes KYC' },
  { icon: '🚀', title: 'Pro Trial for 7 Days', desc: 'Your friend gets a 7-day free trial of Toroloom Pro' },
  { icon: '📈', title: 'No Cap on Earnings', desc: 'Refer unlimited friends — earn unlimited rewards' },
  { icon: '✅', title: 'Instant Crediting', desc: 'Rewards are credited within 48 hours of friend\'s signup' },
];

// ─── Status colours ───────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  credited: '#00C853',
  pending: '#FFC107',
  expired: '#FF1744',
};

// ─── Component ────────────────────────────────────────────────
export default function ReferralScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();
  const { referralStats, isLoading, loadReferralStats } = useReferralStore();

  useEffect(() => {
    loadReferralStats();
  }, [loadReferralStats]);

  // ── Copy Referral Code ────────────────────────────────────────
  const handleCopyCode = useCallback(async () => {
    if (!referralStats?.code) return;
    try {
      await Clipboard.setStringAsync(referralStats.code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Copied!', `Referral code "${referralStats.code}" copied to clipboard.`);
    } catch {
      // Fallback
    }
  }, [referralStats]);

  // ── Native Share ──────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    const stats = referralStats;
    if (!stats) return;
    try {
      await shareNative({
        title: 'Join me on Toroloom!',
        message: `Hey! I'm using Toroloom — the ultimate trading & investing app. Use my referral code "${stats.code}" when you sign up and we both get ₹100! 🚀`,
        url: stats.shareLink,
        authorName: user?.name || 'Toroloom User',
      });
    } catch {
      // fallback
    }
  }, [referralStats, user]);

  // ── Share via WhatsApp ────────────────────────────────────────
  const handleWhatsApp = useCallback(async () => {
    const stats = referralStats;
    if (!stats) return;
    const sent = await shareWhatsApp({
      message: `Hey! Join me on Toroloom — the ultimate investing app! 🚀\n\nUse my code "${stats.code}" and we both get ₹100 free!\n\nDownload now:`,
      url: stats.shareLink,
      authorName: user?.name,
    });
    if (!sent) {
      Alert.alert('WhatsApp Not Found', 'Please install WhatsApp to share via WhatsApp.');
    }
  }, [referralStats, user]);

  // ── Share via Telegram ────────────────────────────────────────
  const handleTelegram = useCallback(async () => {
    const stats = referralStats;
    if (!stats) return;
    const sent = await shareTelegram({
      message: `Hey! Join me on Toroloom — the ultimate investing app! 🚀\n\nUse my code "${stats.code}" and we both get ₹100 free!`,
      url: stats.shareLink,
      authorName: user?.name,
    });
    if (!sent) {
      Alert.alert('Telegram Not Found', 'Please install Telegram to share via Telegram.');
    }
  }, [referralStats, user]);

  // ── Invite friend by phone number (mock) ──────────────────────
  const handleInviteByPhone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Invite via Phone Number',
      'Enter your friend\'s phone number and we\'ll send them an invite link via SMS.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Invite', onPress: () => {
          Alert.alert('Invite Sent!', 'Your friend will receive an SMS with your referral link shortly.');
        }},
      ]
    );
  }, []);

  // ── Stats cards ───────────────────────────────────────────────
  const statsCards = useMemo(() => {
    if (!referralStats) return [];
    return [
      { label: 'Total Referrals', value: referralStats.totalReferrals.toString(), icon: 'people', color: '#6C63FF' },
      { label: 'Active', value: referralStats.activeReferrals.toString(), icon: 'checkmark-circle', color: '#00C853' },
      { label: 'Total Earned', value: `₹${referralStats.totalEarned}`, icon: 'wallet', color: '#FFC107' },
      { label: 'Pending', value: `₹${referralStats.pendingRewards}`, icon: 'time', color: '#FF9800' },
    ];
  }, [referralStats]);

  // ── Reward item component ─────────────────────────────────────
  const RewardRow = useCallback(({ reward, index }: { reward: ReferralReward; index: number }) => {
    const statusColor = STATUS_COLORS[reward.status] || colors.textMuted;
    const statusLabel = reward.status === 'credited' ? 'Credited' : reward.status === 'pending' ? 'Pending' : 'Expired';

    return (
      <Animated.View
        key={reward.id}
        entering={FadeInDown.delay(200 + index * 50).springify()}
        style={styles.rewardRow}
      >
        <View style={[styles.rewardAvatar, { backgroundColor: '#6C63FF20' }]}>
          <Text style={styles.rewardAvatarText}>
            {reward.referredUserName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.rewardInfo}>
          <Text style={styles.rewardName}>{reward.referredUserName}</Text>
          <Text style={styles.rewardDate}>
            Joined {new Date(reward.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        <View style={styles.rewardRight}>
          <Text style={[styles.rewardAmount, { color: statusColor }]}>
            +₹{reward.reward}
          </Text>
          <View style={[styles.rewardStatusBadge, { backgroundColor: statusColor + '20' }]}>
            <View style={[styles.rewardStatusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.rewardStatusLabel, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
      </Animated.View>
    );
  }, [colors, styles]);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ───────────────────────────────────────── */}
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
            <View style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </View>
          </AnimatedPressable>
          <Text style={styles.title}>Refer & Earn</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* ── Hero Banner ──────────────────────────────────── */}
        <Animated.View entering={FadeInUp.springify()}>
          <LinearGradient
            colors={['#6C63FF', '#3F3D99']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBanner}
          >
            <Text style={styles.heroEmoji}>🎉</Text>
            <Text style={styles.heroTitle}>Refer a Friend, Earn ₹100</Text>
            <Text style={styles.heroSubtitle}>
              Share your unique referral code with friends. When they sign up and complete KYC, you both get ₹100!
            </Text>

            {/* ── Referral Code Display ─────────────────────── */}
            <View style={styles.codeContainer}>
              <View style={styles.codeRow}>
                <View style={styles.codeBg}>
                  <Text style={styles.codeText}>
                    {referralStats?.code || '------'}
                  </Text>
                </View>
                <AnimatedPressable onPress={handleCopyCode} haptic="medium" scaleTo={0.92}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.copyBtn}
                  >
                    <Ionicons name="copy-outline" size={20} color="#fff" />
                    <Text style={styles.copyBtnText}>Copy</Text>
                  </LinearGradient>
                </AnimatedPressable>
              </View>
            </View>

            {/* ── Share Actions Grid ─────────────────────────── */}
            <View style={styles.shareGrid}>
              {[
                { icon: 'share-outline', label: 'Share', onPress: handleShare, color: '#fff' },
                { icon: 'logo-whatsapp', label: 'WhatsApp', onPress: handleWhatsApp, color: '#25D366' },
                { icon: 'paper-plane', label: 'Telegram', onPress: handleTelegram, color: '#0088CC' },
                { icon: 'call-outline', label: 'SMS', onPress: handleInviteByPhone, color: '#00D2FF' },
              ].map((action, i) => (
                <AnimatedPressable
                  key={i}
                  onPress={action.onPress}
                  haptic="light"
                  scaleTo={0.9}
                  style={styles.shareAction}
                >
                  <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={26} color={action.color} />
                  <Text style={styles.shareActionLabel}>{action.label}</Text>
                </AnimatedPressable>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Stats Cards Grid ─────────────────────────────── */}
        <View style={styles.statsGrid}>
          {statsCards.map((stat, i) => (
            <Animated.View
              key={stat.label}
              entering={FadeInDown.delay(150 + i * 80).springify()}
              style={[styles.statCard, { borderColor: stat.color + '30' }]}
            >
              <View style={[styles.statIcon, { backgroundColor: stat.color + '15' }]}>
                <Ionicons name={stat.icon as keyof typeof Ionicons.glyphMap} size={20} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Animated.View>
          ))}
        </View>

        {/* ── How It Works ─────────────────────────────────── */}
        <Card title="How It Works" subtitle="Earn rewards in 3 simple steps" style={styles.sectionCard}>
          <View style={styles.benefitsList}>
            {REFERRAL_BENEFITS.map((benefit, i) => (
              <View key={i} style={styles.benefitRow}>
                <View style={styles.benefitIconBg}>
                  <Text style={styles.benefitIcon}>{benefit.icon}</Text>
                </View>
                <View style={styles.benefitInfo}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDesc}>{benefit.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* ── Rewards History ──────────────────────────────── */}
        <Card
          title="Rewards History"
          subtitle={referralStats?.rewards.length ? `${referralStats.rewards.length} referral(s)` : 'No referrals yet'}
          style={styles.sectionCard}
        >
          {referralStats && referralStats.rewards.length > 0 ? (
            <View style={styles.rewardsList}>
              {referralStats.rewards
                .slice(0, REWARD_DISPLAY_COUNT)
                .map((reward, i) => (
                  <RewardRow key={reward.id} reward={reward} index={i} />
                ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Referrals Yet</Text>
              <Text style={styles.emptyDesc}>
                Share your referral code with friends and start earning rewards!
              </Text>
            </View>
          )}
        </Card>

        {/* ── Terms Note ───────────────────────────────────── */}
        <Text style={styles.termsNote}>
          * Rewards are credited within 48 hours after your friend completes KYC and places their first trade.
          Referral program is subject to change. T&C apply.
        </Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Sticky Bottom CTA ──────────────────────────────── */}
      <LinearGradient
        colors={['rgba(11,15,25,0)', 'rgba(11,15,25,1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.bottomCta}
      >
        <AnimatedPressable onPress={handleShare} haptic="medium" scaleTo={0.97}>
          <LinearGradient
            colors={GRADIENTS.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.shareBtn}
          >
            <Ionicons name="share-social" size={20} color="#fff" />
            <Text style={styles.shareBtnText}>Invite Friends & Earn ₹100 Each</Text>
          </LinearGradient>
        </AnimatedPressable>
      </LinearGradient>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 120,
    paddingHorizontal: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    marginBottom: SPACING.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
    textAlign: 'center',
  },

  // ── Hero Banner ───────────────────────────────────────────────
  heroBanner: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    paddingTop: SPACING.xxl,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  heroEmoji: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  heroTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: '#fff',
    textAlign: 'center',
  },
  heroSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 20,
  },

  // ── Referral Code Display ─────────────────────────────────────
  codeContainer: {
    marginTop: SPACING.xl,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  codeBg: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  codeText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: '#fff',
    letterSpacing: 4,
    fontFamily: 'monospace',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  copyBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: '#fff',
  },

  // ── Share Actions Grid ────────────────────────────────────────
  shareGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  shareAction: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  shareActionLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.8)',
  },

  // ── Stats Grid ────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    width: (width - SPACING.xl * 2 - SPACING.sm) / 2,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
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

  // ── How It Works / Benefits ───────────────────────────────────
  sectionCard: {
    marginBottom: SPACING.md,
  },
  benefitsList: {
    gap: SPACING.md,
    paddingTop: SPACING.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  benefitIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitIcon: {
    fontSize: 20,
  },
  benefitInfo: {
    flex: 1,
  },
  benefitTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  benefitDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },

  // ── Rewards List ──────────────────────────────────────────────
  rewardsList: {
    gap: 0,
    paddingTop: SPACING.md,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rewardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardAvatarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: '#6C63FF',
  },
  rewardInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  rewardName: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  rewardDate: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  rewardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rewardAmount: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  rewardStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  rewardStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  rewardStatusLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },

  // ── Empty State ───────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  emptyDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: SPACING.xl,
  },

  // ── Terms Note ────────────────────────────────────────────────
  termsNote: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: SPACING.lg,
    lineHeight: 16,
    paddingHorizontal: SPACING.md,
  },

  // ── Bottom CTA ────────────────────────────────────────────────
  bottomCta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: 40,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
  },
  shareBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },
});
