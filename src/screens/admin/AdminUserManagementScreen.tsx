/**
 * ============================================================================
 * Toroloom — Admin User Management Screen
 * ============================================================================
 *
 * Admin tool for managing platform users:
 *   1. Search by name/email/phone
 *   2. Filter by plan (all/free/pro/elite) and status (all/active/suspended/inactive)
 *   3. Each user shows: name, email, plan, status, KYC, trade count, P&L
 *   4. Tap user to expand: show full details + suspend/activate action
 *   5. Pull-to-refresh with skeleton loading
 * ============================================================================
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useAdminStore, AdminUser } from '../../store/adminStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Badge from '../../components/ui/Badge';
import { SkeletonBlock } from '../../components/ui/SkeletonLoader';

type PlanFilter = 'all' | 'free' | 'pro' | 'elite';
type StatusFilter = 'all' | 'active' | 'suspended' | 'inactive';

// ─── User Card ──────────────────────────────────────────────────────────────

function UserCard({
  user,
  index,
  onToggleStatus,
  isExpanded,
  onExpand,
}: {
  user: AdminUser;
  index: number;
  onToggleStatus: (user: AdminUser) => void;
  isExpanded: boolean;
  onExpand: () => void;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(index * 40, withSpring(1, { stiffness: 100, damping: 14 }));
  }, [index, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const planColor =
    user.plan === 'elite' ? '#FFC107' :
    user.plan === 'pro' ? '#3B82F6' :
    '#94A3B8';

  const statusColor =
    user.status === 'active' ? colors.marketUp :
    user.status === 'suspended' ? colors.danger :
    colors.textMuted;

  const kycColor =
    user.kycStatus === 'verified' ? colors.marketUp :
    user.kycStatus === 'pending' ? colors.warning :
    colors.textMuted;

  const pnlColor = user.totalPnl >= 0 ? colors.marketUp : colors.danger;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).springify()}
      style={animatedStyle}
    >
      <AnimatedPressable onPress={onExpand} haptic="light" scaleTo={0.98}>
        <View style={[styles.userCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {/* Main row */}
          <View style={styles.userRow}>
            {/* Avatar */}
            <View style={[styles.userAvatar, { backgroundColor: user.plan === 'elite' ? '#FFC10730' : user.plan === 'pro' ? '#3B82F630' : colors.bgCardLight }]}>
              <Text style={[styles.avatarText, { color: planColor }]}>
                {user.name.charAt(0)}
              </Text>
            </View>

            {/* Info */}
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                  {user.name}
                </Text>
                <Badge label={user.plan.toUpperCase()} variant={user.plan === 'elite' ? 'warning' : user.plan === 'pro' ? 'primary' : 'neutral'} size="small" />
              </View>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                {user.email}
              </Text>
              <View style={styles.userMetaRow}>
                <View style={styles.metaItem}>
                  <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>{user.status}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="shield-checkmark" size={11} color={kycColor} />
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>{user.kycStatus}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="swap-horizontal" size={11} color={colors.textMuted} />
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>{user.totalTrades} trades</Text>
                </View>
              </View>
            </View>

            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </View>

          {/* Expanded details */}
          {isExpanded && (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.expandedSection, { borderTopColor: colors.divider }]}>
              <View style={styles.expandedGrid}>
                <View style={styles.expandedItem}>
                  <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>Phone</Text>
                  <Text style={[styles.expandedValue, { color: colors.text }]}>{user.phone}</Text>
                </View>
                <View style={styles.expandedItem}>
                  <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>Joined</Text>
                  <Text style={[styles.expandedValue, { color: colors.text }]}>{user.joinedAt}</Text>
                </View>
                <View style={styles.expandedItem}>
                  <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>Last Active</Text>
                  <Text style={[styles.expandedValue, { color: colors.text }]}>{user.lastActive}</Text>
                </View>
                <View style={styles.expandedItem}>
                  <Text style={[styles.expandedLabel, { color: colors.textMuted }]}>Total P&L</Text>
                  <Text style={[styles.expandedValue, { color: pnlColor }]}>
                    {user.totalPnl >= 0 ? '+' : ''}₹{Math.abs(user.totalPnl).toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Action button */}
              <AnimatedPressable
                onPress={() => onToggleStatus(user)}
                haptic="medium"
                scaleTo={0.97}
              >
                <View style={[
                  styles.actionBtn,
                  {
                    backgroundColor: user.status === 'suspended' ? colors.marketUp + '15' : colors.danger + '15',
                    borderColor: user.status === 'suspended' ? colors.marketUp + '30' : colors.danger + '30',
                  },
                ]}>
                  <Ionicons
                    name={user.status === 'suspended' ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={user.status === 'suspended' ? colors.marketUp : colors.danger}
                  />
                  <Text style={[
                    styles.actionBtnText,
                    { color: user.status === 'suspended' ? colors.marketUp : colors.danger },
                  ]}>
                    {user.status === 'suspended' ? 'Activate User' : 'Suspend User'}
                  </Text>
                </View>
              </AnimatedPressable>
            </Animated.View>
          )}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminUserManagementScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { users, toggleUserStatus, refresh, isLoading } = useAdminStore();

  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    let result = users;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.phone.includes(q),
      );
    }

    // Plan filter
    if (planFilter !== 'all') {
      result = result.filter((u) => u.plan === planFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((u) => u.status === statusFilter);
    }

    return result;
  }, [users, search, planFilter, statusFilter]);

  const handleToggleStatus = useCallback(
    (user: AdminUser) => {
      const action = user.status === 'suspended' ? 'activate' : 'suspend';
      Alert.alert(
        `${action === 'suspend' ? 'Suspend' : 'Activate'} User`,
        `Are you sure you want to ${action} ${user.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: action === 'suspend' ? 'Suspend' : 'Activate',
            style: action === 'suspend' ? 'destructive' : 'default',
            onPress: () => {
              toggleUserStatus(user.id);
              Haptics.notificationAsync(
                action === 'suspend'
                  ? Haptics.NotificationFeedbackType.Warning
                  : Haptics.NotificationFeedbackType.Success,
              );
            },
          },
        ],
      );
    },
    [toggleUserStatus],
  );

  const FILTER_PLANS: { key: PlanFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'free', label: 'Free' },
    { key: 'pro', label: 'Pro' },
    { key: 'elite', label: 'Elite' },
  ];

  const FILTER_STATUSES: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'suspended', label: 'Suspended' },
    { key: 'inactive', label: 'Inactive' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
          <View style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </View>
        </AnimatedPressable>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>User Management</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, email, or phone..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <AnimatedPressable onPress={() => setSearch('')} haptic="light" scaleTo={0.9}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </AnimatedPressable>
          )}
        </View>
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <View style={styles.filterGroup}>
          {FILTER_PLANS.map((f) => (
            <AnimatedPressable
              key={f.key}
              onPress={() => setPlanFilter(f.key)}
              haptic="light"
              scaleTo={0.95}
            >
              <View
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: planFilter === f.key ? colors.primary + '20' : colors.bgCard,
                    borderColor: planFilter === f.key ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: planFilter === f.key ? colors.primary : colors.textMuted },
                  ]}
                >
                  {f.label}
                </Text>
              </View>
            </AnimatedPressable>
          ))}
        </View>
        <View style={[styles.filterDivider, { backgroundColor: colors.divider }]} />
        <View style={styles.filterGroup}>
          {FILTER_STATUSES.map((f) => (
            <AnimatedPressable
              key={f.key}
              onPress={() => setStatusFilter(f.key)}
              haptic="light"
              scaleTo={0.95}
            >
              <View
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: statusFilter === f.key ? colors.primary + '20' : colors.bgCard,
                    borderColor: statusFilter === f.key ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: statusFilter === f.key ? colors.primary : colors.textMuted },
                  ]}
                >
                  {f.label}
                </Text>
              </View>
            </AnimatedPressable>
          ))}
        </View>
      </ScrollView>

      {/* User List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading && filteredUsers.length === 0 ? (
          <View style={{ padding: SPACING.xl, gap: SPACING.md }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonBlock key={i} width="100%" height={80} borderRadius={12} />
            ))}
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="people-outline" size={40} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No users found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Try adjusting your search or filters
            </Text>
          </View>
        ) : (
          <View style={{ gap: SPACING.sm }}>
            {filteredUsers.map((user, i) => (
              <UserCard
                key={user.id}
                user={user}
                index={i}
                onToggleStatus={handleToggleStatus}
                isExpanded={expandedId === user.id}
                onExpand={() => setExpandedId(expandedId === user.id ? null : user.id)}
              />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
  },
  headerSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 2,
  },
  // ── Search ──
  searchContainer: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    height: '100%',
  },
  // ── Filters ──
  filterRow: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  filterGroup: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  filterDivider: {
    width: 1,
    height: 24,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  filterChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  // ── List ──
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  // ── User Card ──
  userCard: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  userInfo: { flex: 1 },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  userName: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    flexShrink: 1,
  },
  userEmail: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 1,
  },
  userMetaRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statusIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  metaText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  // ── Expanded ──
  expandedSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  expandedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  expandedItem: {
    width: '47%',
  },
  expandedLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  expandedValue: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    marginTop: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  actionBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  // ── Empty ──
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: SPACING.md,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
  },
  emptySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    textAlign: 'center',
  },
});
