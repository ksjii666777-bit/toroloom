import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useAdvisoryStore } from '../../store/advisoryStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import AppScreen from '../../components/ui/AppScreen';
import { SkeletonBlock } from '../../components/ui/SkeletonLoader';
import { triggerHaptic, ImpactFeedbackStyle } from '../../utils/haptics';
import type { AdvisorSlot, RootStackParamList } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const formatSlotTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export default function AdvisorDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'AdvisorDetail'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { advisorId } = route.params;
  const { selectedAdvisor, reviews, loadAdvisor, loadReviews, bookConsultation } = useAdvisoryStore();
  const [selectedSlot, setSelectedSlot] = useState<AdvisorSlot | null>(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    loadAdvisor(advisorId);
    loadReviews(advisorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advisorId]);

  const advisor = selectedAdvisor?.id === advisorId ? selectedAdvisor : null;
  const initials = (advisor?.name || 'A').split(' ').map(p => p[0]).slice(0, 2).join('');

  const handleBook = async () => {
    if (!advisor || !selectedSlot) return;
    setBooking(true);
    triggerHaptic(ImpactFeedbackStyle.Medium);
    const ok = await bookConsultation(advisor.id, selectedSlot.id);
    setBooking(false);
    if (ok) {
      Alert.alert(
        t('advisory.bookSuccessTitle'),
        t('advisory.bookSuccessMsg', { name: advisor.name }),
        [{ text: t('app.ok'), onPress: () => navigation.navigate('MyConsultations') }],
      );
      setSelectedSlot(null);
    } else {
      Alert.alert(t('advisory.bookFailTitle'), t('advisory.bookFailMsg'));
    }
  };

  return (
    <AppScreen scroll={false} padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9} accessibilityLabel="Go back">
            <View style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </View>
          </AnimatedPressable>
          <Text style={styles.title} numberOfLines={1}>{t('advisory.advisorProfile')}</Text>
          <View style={{ width: 44 }} />
        </View>

        {!advisor ? (
          <View style={styles.skeletonWrap}>
            <SkeletonBlock width="100%" height={140} borderRadius={BORDER_RADIUS.xl} />
            <SkeletonBlock width="70%" height={18} />
            <SkeletonBlock width="90%" height={60} />
            <SkeletonBlock width="100%" height={120} borderRadius={BORDER_RADIUS.lg} />
          </View>
        ) : (
          <>
            {/* Profile hero */}
            <Animated.View entering={FadeInDown.springify()}>
              <LinearGradient
                colors={GRADIENTS.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                {advisor.photoUrl ? (
                  <Image source={{ uri: advisor.photoUrl }} style={styles.heroAvatar} />
                ) : (
                  <View style={[styles.heroAvatar, styles.heroAvatarFallback]}>
                    <Text style={styles.heroAvatarText}>{initials}</Text>
                  </View>
                )}
                <Text style={styles.heroName}>{advisor.name}</Text>
                {advisor.firmName ? <Text style={styles.heroFirm}>{advisor.firmName}</Text> : null}

                {/* SEBI badge */}
                <View style={styles.sebiBadge}>
                  <Ionicons name="shield-checkmark" size={14} color="#00E676" />
                  <Text style={styles.sebiBadgeText}>
                    {advisor.type === 'RIA' ? t('advisory.sebiRia') : t('advisory.sebiRa')} · {advisor.sebiRegNo}
                  </Text>
                </View>

                <View style={styles.heroStats}>
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>⭐ {advisor.rating.toFixed(1)}</Text>
                    <Text style={styles.heroStatLabel}>{t('advisory.rating')}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>{advisor.reviewCount}</Text>
                    <Text style={styles.heroStatLabel}>{t('advisory.reviews')}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatValue}>{advisor.experienceYears}{t('advisory.yrs')}</Text>
                    <Text style={styles.heroStatLabel}>{t('advisory.experience')}</Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Bio */}
            <Card title={t('advisory.about')} style={styles.section}>
              <Text style={styles.bioText}>{advisor.bio}</Text>
              <View style={styles.specialtiesWrap}>
                {advisor.specialties.map(s => (
                  <View key={s} style={[styles.specialtyChip, { backgroundColor: '#6C63FF15' }]}>
                    <Text style={styles.specialtyText}>{s}</Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* Risk disclaimer */}
            <Text style={styles.disclaimer}>{t('advisory.disclaimer')}</Text>

            {/* Slot picker */}
            <Card title={t('advisory.bookSession')} subtitle={t('advisory.fee', { fee: advisor.consultationFee })} style={styles.section}>
              {advisor.availableSlots.length === 0 ? (
                <Text style={styles.noSlots}>{t('advisory.noSlots')}</Text>
              ) : (
                <View style={styles.slotsWrap}>
                  {advisor.availableSlots.map(slot => {
                    const isSelected = selectedSlot?.id === slot.id;
                    return (
                      <Pressable
                        key={slot.id}
                        testID={`slot-${slot.id}`}
                        onPress={() => {
                          triggerHaptic(ImpactFeedbackStyle.Light);
                          setSelectedSlot(isSelected ? null : slot);
                        }}
                        style={[
                          styles.slotChip,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.bgInput,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Ionicons name="calendar-outline" size={14} color={isSelected ? colors.white : colors.textMuted} />
                        <Text style={[styles.slotText, { color: isSelected ? colors.white : colors.text }]}>
                          {formatSlotTime(slot.startTime)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {selectedSlot && (
                <Animated.View entering={FadeInDown.springify()} style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{t('advisory.fee')}</Text>
                    <Text style={styles.summaryValue}>₹{advisor.consultationFee}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{t('advisory.sessionTime')}</Text>
                    <Text style={styles.summaryValue}>{formatSlotTime(selectedSlot.startTime)}</Text>
                  </View>
                  <AnimatedPressable onPress={handleBook} haptic="medium" scaleTo={0.97} disabled={booking}>
                    <LinearGradient colors={GRADIENTS.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bookBtn}>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.bookBtnText}>
                        {booking ? t('advisory.booking') : advisor.consultationFee > 0 ? `Pay ₹${advisor.consultationFee} & Book` : t('advisory.confirmBook')}
                      </Text>
                    </LinearGradient>
                  </AnimatedPressable>
                  <Text style={styles.paymentNote}>💳 Payment via Razorpay — UPI, Cards, Netbanking accepted</Text>
                </Animated.View>
              )}
            </Card>

            {/* Reviews */}
            <Card title={t('advisory.reviews')} subtitle={t('advisory.reviewsCount', { count: reviews.length })} style={styles.section}>
              {reviews.length === 0 ? (
                <Text style={styles.noReviews}>{t('advisory.noReviews')}</Text>
              ) : (
                reviews.slice(0, 5).map((review, i) => (
                  <View key={review.id} style={[styles.reviewRow, i < Math.min(reviews.length, 5) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarText}>{review.userName[0]?.toUpperCase() || 'U'}</Text>
                      </View>
                      <View style={styles.reviewInfo}>
                        <Text style={styles.reviewName}>{review.userName}</Text>
                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <Ionicons key={n} name={n <= review.rating ? 'star' : 'star-outline'} size={12} color="#FFC107" />
                          ))}
                        </View>
                      </View>
                      <Text style={styles.reviewDate}>
                        {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  </View>
                ))
              )}
              <AnimatedPressable
                onPress={() => navigation.navigate('ReviewForm', { advisorId: advisor.id })}
                haptic="light"
                scaleTo={0.97}
                style={styles.reviewBtn}
              >
                <Ionicons name="star-outline" size={16} color={colors.primary} />
                <Text style={styles.reviewBtnText}>{t('advisory.writeReview')}</Text>
              </AnimatedPressable>
            </Card>

            <View style={{ height: 60 }} />
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
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
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  hero: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  heroAvatar: {
    width: 84,
    height: 84,
    borderRadius: 24,
    marginBottom: SPACING.md,
  },
  heroAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: '#fff',
  },
  heroName: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: '#fff',
  },
  heroFirm: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  sebiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.md,
  },
  sebiBadgeText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: '#fff',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    width: '100%',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },
  heroStatLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  section: {
    marginBottom: SPACING.md,
  },
  bioText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingTop: SPACING.md,
  },
  specialtiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
  },
  specialtyChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  specialtyText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: '#6C63FF',
  },
  disclaimer: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  slotsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  slotText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  noSlots: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    paddingTop: SPACING.md,
  },
  summaryBox: {
    marginTop: SPACING.lg,
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  summaryValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  bookBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },
  paymentNote: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
  noReviews: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    paddingVertical: SPACING.md,
  },
  reviewRow: {
    paddingVertical: SPACING.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#6C63FF20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: '#6C63FF',
  },
  reviewInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  reviewName: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  reviewDate: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  reviewComment: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: SPACING.sm,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: SPACING.md,
  },
  reviewBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  skeletonWrap: {
    gap: SPACING.md,
  },
});
