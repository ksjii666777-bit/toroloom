import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Alert, RefreshControl } from 'react-native';
import Animated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { triggerHaptic, ImpactFeedbackStyle } from '../../utils/haptics';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { useGamificationStore } from '../../store/gamificationStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { useStaggeredAnimation } from '../../hooks/useStaggeredAnimation';
import { SkeletonBlock} from '../../components/ui/SkeletonLoader';

const { width } = Dimensions.get('window');
const BADGE_DISPLAY_COUNT = 8;

const menuItems = [
  { section: 'Investments', items: [
    { icon: 'wallet', label: 'Fund Dashboard', color: '#00C853', screen: 'FundsDashboard' },
    { icon: 'pie-chart', label: 'Mutual Funds', color: '#6C63FF', screen: 'MutualFunds' },
    { icon: 'calendar', label: 'My SIPs', color: '#00D2FF', screen: 'SIPs' },
    { icon: 'options', label: 'F&O Trading', color: '#FF6B00', screen: 'FnOOptionsChain' },
    { icon: 'shuffle', label: 'Op. Strategies', color: '#8B5CF6', screen: 'StrategyBuilder' },
    { icon: 'document-text', label: 'Trade History', color: '#FFC107', screen: 'TradeHistory' },
    { icon: 'clipboard', label: 'Open Orders', color: '#FF9800', screen: 'OpenOrders' },
    { icon: 'analytics', label: 'Reports', color: '#FF6B6B', screen: 'Reports' },
  ]},
  { section: 'Learn & Grow', items: [
    { icon: 'school', label: 'Courses', color: '#00C853', screen: 'Learn' },
    { icon: 'chatbubbles', label: 'Community', color: '#6C63FF', screen: 'Community' },
    { icon: 'chatbox-ellipses', label: 'Messages', color: '#10B981', screen: 'ChatList' },
    { icon: 'bulb', label: 'AI Insights', color: '#FFC107', screen: 'AIInsights' },
    { icon: 'chatbubble-ellipses', label: 'AI Assistant', color: '#3B82F6', screen: 'AIChat' },
    { icon: 'newspaper', label: 'Market News', color: '#00D2FF', screen: 'NewsFeed' },
    { icon: 'rocket', label: 'IPO Calendar', color: '#FF6B6B', screen: 'IPOCalendar' },
    { icon: 'calendar', label: 'Economic Calendar', color: '#00D2FF', screen: 'EconomicCalendar' },
    { icon: 'book', label: 'Financial Glossary', color: '#06B6D4', screen: 'Glossary' },
    { icon: 'journal', label: 'Trading Journal', color: '#8B5CF6', screen: 'BehavioralJournal' },
    { icon: 'trophy', label: 'Achievements', color: '#FF6B6B', screen: 'Achievements' },
  ]},
  { section: 'Account', items: [
    { icon: 'person', label: 'Profile & KYC', color: '#00D2FF', screen: 'Profile' },
    { icon: 'diamond', label: 'Go Premium', color: '#10B981', screen: 'Subscription' },
    { icon: 'receipt', label: 'Payment History', color: '#6C63FF', screen: 'PaymentHistory' },
    { icon: 'notifications', label: 'Notifications', color: '#FF6B6B', screen: 'Notifications' },
    { icon: 'notifications', label: 'Portfolio Alerts', color: '#FFC107', screen: 'PortfolioAlerts' },
    { icon: 'settings', label: 'Risk Settings', color: '#6E6E9A', screen: 'Settings' },
    { icon: 'link', label: 'Connect Broker', color: '#FF6B00', screen: 'BrokerConnect' },
    { icon: 'paper-plane', label: 'Telegram Alerts', color: '#0088CC', screen: 'TelegramConnect' },
    { icon: 'compass', label: 'Replay Tour', color: '#8B5CF6', screen: '__onboarding' },
    { icon: 'volume-high', label: 'Voice Settings', color: '#00D2FF', screen: 'VoiceSettings' },
    { icon: 'shield-checkmark', label: 'Security', color: '#FF6B6B', screen: 'SecuritySettings' },
    { icon: 'help-circle', label: 'Help & Support', color: '#00C853', screen: 'Help' },
    { icon: 'settings', label: 'Tenant Config', color: '#8B5CF6', screen: 'TenantConfig' },
  ]},
];

const quickActions = [
  { icon: 'add-circle', label: 'Add Funds', gradient: GRADIENTS.success },
  { icon: 'arrow-up-circle', label: 'Withdraw', gradient: GRADIENTS.danger },
  { icon: 'swap-horizontal', label: 'Transfer', gradient: GRADIENTS.primary },
  { icon: 'qr-code', label: 'UPI', gradient: GRADIENTS.accent },
];

export default function MoreScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, logout } = useAuthStore();
  const { userLevel, badges } = useGamificationStore();
  const resetOnboarding = useOnboardingStore(s => s.resetOnboarding);
  const unlockedCount = badges.filter(b => b.unlocked).length;
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const { animatedStyles: qaStyles } = useStaggeredAnimation(quickActions.length, {
    initialDelay: 100,
    staggerDelay: 80,
    duration: 400,
  });

  const { animatedStyles: menuSectionStyles } = useStaggeredAnimation(menuItems.length, {
    initialDelay: 150,
    staggerDelay: 120,
    duration: 450,
  });

  const { animatedStyles: badgeStyles } = useStaggeredAnimation(BADGE_DISPLAY_COUNT, {
    initialDelay: 200,
    staggerDelay: 40,
    duration: 300,
  });

  const handleQuickAction = (label: string) => {
    switch (label) {
      case 'Add Funds':
        navigation.navigate('AddFunds');
        break;
      case 'Withdraw':
        navigation.navigate('Withdraw');
        break;
      case 'Transfer':
        navigation.navigate('Transfer');
        break;        case 'UPI':
          navigation.navigate('UPI');
          break;
        default:
          Alert.alert(
            label,
            `${label} feature is coming soon. We'll notify you when it's ready!`,
            [{ text: 'OK' }]
          );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <SkeletonBlock width="30%" height={28} />
          </View>
          <View style={{ paddingHorizontal: SPACING.xl }}>
            <SkeletonBlock width="100%" height={100} borderRadius={BORDER_RADIUS.xl} />
            <View style={{ height: SPACING.lg }} />
            <SkeletonBlock width="100%" height={56} borderRadius={BORDER_RADIUS.md} />
            <View style={{ height: SPACING.xl }} />
            {[1, 2, 3].map(i => (
              <View key={i}>
                <SkeletonBlock width="25%" height={12} />
                <View style={{ height: SPACING.md }} />
                <View style={{ flexDirection: 'row', gap: SPACING.md }}>
                  {[1, 2, 3, 4].map(j => (
                    <View key={j} style={{ alignItems: 'center', gap: 4 }}>
                      <SkeletonBlock width={48} height={48} borderRadius={14} />
                      <SkeletonBlock width={40} height={10} />
                    </View>
                  ))}
                </View>
                <View style={{ height: SPACING.xl }} />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>More</Text>
        </View>

        {/* Profile Card */}
        {/* Glassmorphic Profile Card */}
        <AnimatedPressable onPress={() => navigation.navigate('Profile')} haptic="medium" scaleTo={0.97}>
          <View style={styles.glassProfileCard}>
            <View style={styles.glassBg} />
            <View style={styles.profileRow}>
              <View style={styles.profileAvatar}>
                <Text style={styles.avatarText}>{user?.name?.[0] || 'R'}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.name || 'Rahul Sharma'}</Text>
                <Text style={styles.profileEmail}>{user?.email || 'rahul@email.com'}</Text>
                <View style={styles.profileBadges}>
                  <Badge label={`Level ${userLevel.level}`} variant="primary" />
                  <View style={styles.kycVerifiedBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#00D2FF" />
                    <Text style={styles.kycVerifiedText}>KYC Verified</Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
            </View>
          </View>
        </AnimatedPressable>

        {/* Quick Actions — Glass Pillars */}
        <View style={styles.quickActionsRow}>
          {quickActions.map((action, i) => (
            <Animated.View key={i} style={qaStyles[i]}>
              <AnimatedPressable onPress={() => handleQuickAction(action.label)} haptic="light" scaleTo={0.92}>
                <View style={styles.qaCard}>
                  <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={20} color={action.gradient[0]} />
                  <Text style={styles.qaLabel}>{action.label}</Text>
                </View>
              </AnimatedPressable>
            </Animated.View>
          ))}
        </View>

        {/* Balance Card */}
        <Card style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceValue}>₹{((user?.balance || 2500000) / 100000).toFixed(1)}L</Text>
            </View>
            <View style={styles.balanceActions}>
              <AnimatedPressable onPress={() => navigation.navigate('AddFunds')} haptic="light" scaleTo={0.95}>
                <View style={styles.balanceBtn}>
                  <Text style={styles.balanceBtnText}>Add</Text>
                </View>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => navigation.navigate('Withdraw')} haptic="light" scaleTo={0.95}>
                <View style={[styles.balanceBtn, styles.balanceBtnOutline]}>
                  <Text style={styles.balanceBtnOutlineText}>Withdraw</Text>
                </View>
              </AnimatedPressable>
            </View>
          </View>
        </Card>

        {/* Menu Sections */}
        {menuItems.map((section, idx) => (
          <Animated.View key={idx} style={[styles.menuCardSection, menuSectionStyles[idx]]}>
            <View style={styles.menuCard}>
              <Text style={styles.menuSectionTitle}>{section.section}</Text>
              <View style={styles.menuGrid}>
                {section.items.map((item, i) => (
                  <AnimatedPressable
                    key={i}
                    onPress={() => {
                      if (item.screen === '__onboarding') {
                        Alert.alert(
                          'Replay Tour',
                          'This will restart the onboarding walkthrough. You can skip through it anytime.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Start Tour',
                              onPress: () => {
                                triggerHaptic(ImpactFeedbackStyle.Medium);
                                resetOnboarding();
                              },
                            },
                          ]
                        );
                      } else {
                        navigation.navigate(item.screen);
                      }
                    }}
                    haptic="selection"
                    scaleTo={0.93}
                  >
                    <View style={styles.menuItem}>
                      <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                        <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={item.color} />
                      </View>
                      <Text style={styles.menuLabel}>{item.label}</Text>
                    </View>
                  </AnimatedPressable>
                ))}
              </View>
            </View>
          </Animated.View>
        ))}

        {/* Achievements Preview */}
        <AnimatedPressable onPress={() => navigation.navigate('Achievements')} haptic="light" scaleTo={0.98}>
          <Card title="Achievements" subtitle={`${unlockedCount}/${badges.length} unlocked`}>
            <View style={styles.badgesGrid}>
              {badges.slice(0, BADGE_DISPLAY_COUNT).map((badge, i) => (
                <Animated.View key={badge.id} style={badgeStyles[i]}>

                  <View style={[styles.badgeItem, !badge.unlocked && styles.badgeLocked]}>
                    <Text style={styles.badgeIcon}>{badge.icon}</Text>
                    {!badge.unlocked && (
                      <View style={styles.lockOverlay}>
                        <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                      </View>
                    )}
                  </View>
                </Animated.View>
              ))}
            </View>
          </Card>
        </AnimatedPressable>

        {/* Logout */}
        <AnimatedPressable onPress={logout} haptic="warning" scaleTo={0.97}>
          <View style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.logoutText}>Log Out</Text>
          </View>
        </AnimatedPressable>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: SPACING.xl,
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
  glassProfileCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
    overflow: 'hidden',
  },
  glassBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: BORDER_RADIUS.xl,
  },
  kycVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,210,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.25)',
  },
  kycVerifiedText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: '#00D2FF',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.white,
  },
  profileInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  profileName: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.white,
  },
  profileEmail: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  profileBadges: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  qaCard: {
    width: 72,
    height: 72,
    backgroundColor: '#161922',
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  qaLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.text,
    textAlign: 'center',
  },
  balanceCard: {
    marginBottom: SPACING.xxl,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  balanceValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.text,
    marginTop: 4,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  balanceBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  balanceBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.white,
  },
  balanceBtnOutline: {
    backgroundColor: colors.transparent,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  balanceBtnOutlineText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  menuCardSection: {
    marginBottom: SPACING.lg,
  },
  menuCard: {
    backgroundColor: '#0D0F14',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  menuSectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  menuItem: {
    width: (width - 64 - 48) / 4,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.text,
    textAlign: 'center',
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
  },
  badgeItem: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCardLight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeIcon: {
    fontSize: 20,
  },
  badgeLocked: {
    opacity: 0.4,
  },
  lockOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.bgCard,
    borderRadius: 6,
    padding: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  logoutText: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.danger,
  },
});
