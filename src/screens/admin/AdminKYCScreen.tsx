/**
 * ============================================================================
 * Toroloom — Admin KYC Queue Screen
 * ============================================================================
 *
 * Admin tool for reviewing KYC verification requests:
 *   1. List all users with pending KYC status
 *   2. Approve / Reject KYC with confirmation
 *   3. Search by name/email
 *   4. Pull-to-refresh
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useAdminStore, AdminUser } from '../../store/adminStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Badge from '../../components/ui/Badge';
import { SkeletonBlock } from '../../components/ui/SkeletonLoader';

function KYCUserCard({
  user,
  index,
  onApprove,
  onReject,
}: {
  user: AdminUser;
  index: number;
  onApprove: (u: AdminUser) => void;
  onReject: (u: AdminUser) => void;
}) {
  const { colors } = useTheme();
  const kycColor =
    user.kycStatus === 'verified' ? colors.marketUp :
    user.kycStatus === 'pending' ? colors.warning :
    colors.textMuted;

  const planColor =
    user.plan === 'elite' ? '#FFC107' :
    user.plan === 'pro' ? '#3B82F6' :
    '#94A3B8';

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <View style={[styles.userCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.userRow}>
          {/* Avatar */}
          <View style={[styles.userAvatar, { backgroundColor: planColor + '20' }]}>
            <Text style={[styles.avatarText, { color: planColor }]}>{user.name.charAt(0)}</Text>
          </View>

          {/* Info */}
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>{user.name}</Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="shield-checkmark" size={11} color={kycColor} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {user.kycStatus === 'pending' ? 'Pending Documents' : user.kycStatus}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="calendar" size={11} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>Joined {user.joinedAt}</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionCol}>
            <AnimatedPressable onPress={() => onApprove(user)} haptic="medium" scaleTo={0.9}>
              <View style={[styles.actionBtn, { backgroundColor: colors.marketUp + '20' }]}>
                <Ionicons name="checkmark" size={18} color={colors.marketUp} />
              </View>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => onReject(user)} haptic="warning" scaleTo={0.9}>
              <View style={[styles.actionBtn, { backgroundColor: colors.danger + '20' }]}>
                <Ionicons name="close" size={18} color={colors.danger} />
              </View>
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export default function AdminKYCScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { users, refresh, isLoading } = useAdminStore();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [kycUsers, setKycUsers] = useState(users);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setKycUsers(useAdminStore.getState().users);
    setRefreshing(false);
  }, [refresh]);

  const pendingUsers = useMemo(() => {
    let result = kycUsers.filter((u) => u.kycStatus === 'pending');
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }
    return result;
  }, [kycUsers, search]);

  const handleApprove = useCallback((user: AdminUser) => {
    Alert.alert('Approve KYC', `Mark ${user.name}'s KYC as verified?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: () => {
          setKycUsers((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, kycStatus: 'verified' as const } : u))
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }, []);

  const handleReject = useCallback((user: AdminUser) => {
    Alert.alert('Reject KYC', `Reject ${user.name}'s KYC verification?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => {
          setKycUsers((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, kycStatus: 'none' as const } : u))
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  }, []);

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>KYC Queue</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {pendingUsers.length} pending verification{pendingUsers.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or email..."
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

      {/* List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {isLoading && pendingUsers.length === 0 ? (
          <View style={{ padding: SPACING.xl, gap: SPACING.md }}>
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} width="100%" height={80} borderRadius={12} />
            ))}
          </View>
        ) : pendingUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="shield-checkmark" size={40} color={colors.marketUp} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>All Clear!</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              No pending KYC verifications
            </Text>
          </View>
        ) : (
          <View style={{ gap: SPACING.sm }}>
            {pendingUsers.map((user, i) => (
              <KYCUserCard
                key={user.id}
                user={user}
                index={i}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
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
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
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
  userName: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
  },
  userEmail: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  actionCol: {
    gap: SPACING.sm,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
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
