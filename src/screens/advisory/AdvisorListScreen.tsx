import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  FlatList,
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
import { SkeletonBlock } from '../../components/ui/SkeletonLoader';
import type { Advisor, RootStackParamList } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type FilterChip = { key: string; labelKey: string };

const FILTER_CHIPS: FilterChip[] = [
  { key: 'all', labelKey: 'advisory.all' },
  { key: 'RIA', labelKey: 'advisory.ria' },
  { key: 'RA', labelKey: 'advisory.ra' },
  { key: 'high', labelKey: 'advisory.topRated' },
];

export default function AdvisorListScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'AdvisorList'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { advisors, isLoading, loadAdvisors } = useAdvisoryStore();
  const [query, setQuery] = useState('');
  const [activeChip, setActiveChip] = useState('all');

  useEffect(() => {
    loadAdvisors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (text: string) => {
    setQuery(text);
    const filters: any = {};
    if (activeChip === 'RIA') filters.type = 'RIA';
    else if (activeChip === 'RA') filters.type = 'RA';
    else if (activeChip === 'high') filters.minRating = 4.5;
    if (text.trim()) filters.q = text.trim();
    loadAdvisors(filters);
  };

  const handleChip = (key: string) => {
    setActiveChip(key);
    const filters: any = {};
    if (key === 'RIA') filters.type = 'RIA';
    else if (key === 'RA') filters.type = 'RA';
    else if (key === 'high') filters.minRating = 4.5;
    if (query.trim()) filters.q = query.trim();
    loadAdvisors(filters);
  };

  const renderCard = ({ item, index }: { item: Advisor; index: number }) => {
    const initials = item.name.split(' ').map(p => p[0]).slice(0, 2).join('');
    return (
      <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
        <AnimatedPressable
          onPress={() => navigation.navigate('AdvisorDetail', { advisorId: item.id })}
          haptic="light"
          scaleTo={0.98}
        >
          <Card style={styles.advisorCard}>
            <View style={styles.cardRow}>
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <View style={[styles.typeBadge, { backgroundColor: item.type === 'RIA' ? '#6C63FF20' : '#00D2FF20' }]}>
                    <Text style={[styles.typeBadgeText, { color: item.type === 'RIA' ? '#6C63FF' : '#00D2FF' }]}>
                      {item.type === 'RIA' ? t('advisory.riaShort') : t('advisory.raShort')}
                    </Text>
                  </View>
                </View>
                {item.firmName ? (
                  <Text style={styles.firm} numberOfLines={1}>{item.firmName}</Text>
                ) : null}
                <View style={styles.metaRow}>
                  <Ionicons name="star" size={13} color="#FFC107" />
                  <Text style={styles.rating}>{item.rating.toFixed(1)}</Text>
                  <Text style={styles.metaDivider}>·</Text>
                  <Text style={styles.meta}>{t('advisory.reviewsCount', { count: item.reviewCount })}</Text>
                  <Text style={styles.metaDivider}>·</Text>
                  <Text style={styles.meta}>{item.experienceYears} {t('advisory.years')}</Text>
                </View>
                <View style={styles.specialtiesRow}>
                  {item.specialties.slice(0, 2).map(s => (
                    <View key={s} style={styles.specialtyChip}>
                      <Text style={styles.specialtyText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.feeCol}>
                <Text style={styles.fee}>₹{item.consultationFee}</Text>
                <Text style={styles.feeLabel}>{t('advisory.perSession')}</Text>
                <View style={[styles.bookBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.bookBtnText}>{t('advisory.book')}</Text>
                </View>
              </View>
            </View>
          </Card>
        </AnimatedPressable>
      </Animated.View>
    );
  };

  return (
    <AppScreen scroll={false} padded={false}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9} accessibilityLabel="Go back">
          <View style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </View>
        </AnimatedPressable>
        <Text style={styles.title}>{t('advisory.title')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          testID="advisory-search"
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('advisory.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={handleSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => handleSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} style={styles.chipsScroll}>
        {FILTER_CHIPS.map(chip => {
          const isActive = activeChip === chip.key;
          return (
            <Pressable
              key={chip.key}
              testID={`chip-${chip.key}`}
              onPress={() => handleChip(chip.key)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isActive ? colors.primary : colors.bgCard,
                  borderColor: isActive ? colors.primary : colors.border,
                },
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
            >
              <Text style={[styles.chipText, { color: isActive ? colors.white : colors.textSecondary }]}>
                {t(chip.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* SEBI compliance note */}
      <View style={[styles.complianceNote, { backgroundColor: '#00D2FF10', borderColor: '#00D2FF30' }]}>
        <Ionicons name="shield-checkmark" size={14} color="#00D2FF" />
        <Text style={styles.complianceText}>{t('advisory.complianceNote')}</Text>
      </View>

      {isLoading && advisors.length === 0 ? (
        <View style={styles.skeletonWrap}>
          {[1, 2, 3].map(i => (
            <View key={i} style={styles.skeletonCard}>
              <SkeletonBlock width={64} height={64} borderRadius={16} />
              <View style={{ flex: 1, gap: 8 }}>
                <SkeletonBlock width="60%" height={16} />
                <SkeletonBlock width="40%" height={12} />
                <SkeletonBlock width="80%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={advisors}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.bgCard }]}>
                <Ionicons name="search" size={32} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>{t('advisory.noAdvisors')}</Text>
              <Text style={styles.emptyHint}>{t('advisory.noAdvisorsHint')}</Text>
            </View>
          }
        />
      )}
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
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    paddingVertical: 0,
  },
  chipsScroll: {
    marginBottom: SPACING.md,
    marginHorizontal: -SPACING.xl,
  },
  chipsRow: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  chipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  complianceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.xl,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  complianceText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
    gap: SPACING.md,
  },
  advisorCard: {
    borderRadius: BORDER_RADIUS.lg,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
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
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  name: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
    flexShrink: 1,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  typeBadgeText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  firm: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  rating: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: colors.text,
  },
  meta: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  metaDivider: {
    color: colors.textMuted,
    fontSize: FONTS.size.xs,
  },
  specialtiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  specialtyChip: {
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  specialtyText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
  },
  feeCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  fee: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  feeLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  bookBtn: {
    marginTop: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  bookBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    color: colors.white,
  },
  skeletonWrap: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  skeletonCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
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
});
