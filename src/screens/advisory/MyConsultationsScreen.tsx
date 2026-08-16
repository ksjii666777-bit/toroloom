import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useAdvisoryStore } from '../../store/advisoryStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import AppScreen from '../../components/ui/AppScreen';
import type { Consultation, RootStackParamList } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const STATUS_COLORS: Record<string, string> = {
  pending: '#FFC107',
  confirmed: '#00C853',
  completed: '#6C63FF',
  cancelled: '#FF1744',
  refunded: '#FF9800',
};

const formatSlot = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export default function MyConsultationsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'MyConsultations'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { myConsultations, isLoading, loadMyConsultations } = useAdvisoryStore();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    loadMyConsultations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upcoming = useMemo(
    () => myConsultations.filter(c => c.status === 'pending' || c.status === 'confirmed'),
    [myConsultations],
  );
  const past = useMemo(
    () => myConsultations.filter(c => c.status === 'completed' || c.status === 'cancelled' || c.status === 'refunded'),
    [myConsultations],
  );

  const data = tab === 'upcoming' ? upcoming : past;

  const renderRow = ({ item, index }: { item: Consultation; index: number }) => {
    const statusColor = STATUS_COLORS[item.status] || colors.textMuted;
    return (
      <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
        <AnimatedPressable
          onPress={() => navigation.navigate('ConsultationDetail', { consultationId: item.id })}
          haptic="light"
          scaleTo={0.98}
        >
          <Card style={styles.consultCard}>
            <View style={styles.rowTop}>
              {item.advisorPhotoUrl ? (
                <Image source={{ uri: item.advisorPhotoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{item.advisorName[0]}</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{item.advisorName}</Text>
                <Text style={styles.type}>{item.advisorType === 'RIA' ? t('advisory.ria') : t('advisory.ra')}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{t(`advisory.status.${item.status}`)}</Text>
              </View>
            </View>
            <View style={styles.rowBottom}>
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <Text style={styles.time}>{formatSlot(item.startTime)}</Text>
              <View style={styles.feePill}>
                <Text style={styles.feeText}>₹{item.amount}</Text>
              </View>
            </View>
          </Card>
        </AnimatedPressable>
      </Animated.View>
    );
  };

  return (
    <AppScreen scroll={false} padded={false}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9} accessibilityLabel="Go back">
          <View style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </View>
        </AnimatedPressable>
        <Text style={styles.title}>{t('advisory.myConsultations')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrap}>
        {(['upcoming', 'past'] as const).map(key => {
          const isActive = tab === key;
          return (
            <Pressable
              key={key}
              testID={`consult-tab-${key}`}
              onPress={() => setTab(key)}
              style={[styles.tab, { backgroundColor: isActive ? colors.primary : colors.bgCard, borderColor: isActive ? colors.primary : colors.border }]}
            >
              <Text style={[styles.tabText, { color: isActive ? colors.white : colors.textSecondary }]}>
                {key === 'upcoming' ? t('advisory.upcoming') : t('advisory.past')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={data}
        keyExtractor={item => item.id}
        renderItem={renderRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={loadMyConsultations}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.bgCard }]}>
              <Ionicons name={tab === 'upcoming' ? 'calendar-outline' : 'time-outline'} size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>
              {tab === 'upcoming' ? t('advisory.noUpcoming') : t('advisory.noPast')}
            </Text>
            <Text style={styles.emptyHint}>{t('advisory.noConsultHint')}</Text>
            <AnimatedPressable onPress={() => navigation.navigate('AdvisorList')} haptic="medium" scaleTo={0.95} style={styles.browseBtn}>
              <Ionicons name="search" size={16} color={colors.white} />
              <Text style={styles.browseBtnText}>{t('advisory.browseAdvisors')}</Text>
            </AnimatedPressable>
          </View>
        }
      />
    </AppScreen>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xl,
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
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  tabsWrap: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  tabText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
    gap: SPACING.md,
  },
  consultCard: {
    borderRadius: BORDER_RADIUS.lg,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  avatarFallback: {
    backgroundColor: GRADIENTS.primary[0] + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.primary,
  },
  info: {
    flex: 1,
  },
  name: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  type: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  time: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    flex: 1,
  },
  feePill: {
    backgroundColor: colors.bgInput,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  feeText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: colors.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.huge,
    gap: SPACING.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  emptyHint: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.md,
  },
  browseBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.white,
  },
});
