import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useAdvisoryStore } from '../../store/advisoryStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import AppScreen from '../../components/ui/AppScreen';
import { SkeletonBlock } from '../../components/ui/SkeletonLoader';
import type { Consultation, RootStackParamList } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const STATUS_COLORS: Record<string, string> = {
  pending: '#FFC107',
  confirmed: '#00C853',
  completed: '#6C63FF',
  cancelled: '#FF1744',
  refunded: '#FF9800',
};

const formatFull = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
    '\n' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export default function ConsultationDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'ConsultationDetail'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { consultationId } = route.params;
  const { myConsultations, loadMyConsultations, cancelConsultation, completeConsultation } = useAdvisoryStore();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadMyConsultations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const consultation: Consultation | undefined = myConsultations.find(c => c.id === consultationId);
  const statusColor = consultation ? (STATUS_COLORS[consultation.status] || colors.textMuted) : colors.textMuted;

  const handleCancel = () => {
    if (!consultation) return;
    Alert.alert(
      t('advisory.cancelTitle'),
      t('advisory.cancelConfirmMsg'),
      [
        { text: t('app.cancel'), style: 'cancel' as const },
        {
          text: t('advisory.cancelBtn'),
          style: 'destructive' as const,
          onPress: async () => {
            setBusy(true);
            const ok = await cancelConsultation(consultation.id);
            setBusy(false);
            if (ok) Alert.alert(t('advisory.cancelledTitle'), t('advisory.cancelledMsg'));
          },
        },
      ],
    );
  };

  const handleComplete = async () => {
    if (!consultation) return;
    setBusy(true);
    const ok = await completeConsultation(consultation.id);
    setBusy(false);
    if (ok) Alert.alert(t('advisory.completedTitle'), t('advisory.completedMsg'));
  };

  if (!consultation) {
    return (
      <AppScreen scroll={false} padded={false}>
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9} accessibilityLabel="Go back">
            <View style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </View>
          </AnimatedPressable>
          <Text style={styles.title}>{t('advisory.consultationDetail')}</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.skeletonWrap}>
          <SkeletonBlock width="100%" height={160} borderRadius={BORDER_RADIUS.xl} />
          <SkeletonBlock width="100%" height={120} borderRadius={BORDER_RADIUS.lg} />
        </View>
      </AppScreen>
    );
  }

  const isActive = consultation.status === 'pending' || consultation.status === 'confirmed';

  return (
    <AppScreen scroll={false} padded={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9} accessibilityLabel="Go back">
            <View style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </View>
          </AnimatedPressable>
          <Text style={styles.title}>{t('advisory.consultationDetail')}</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Advisor card */}
        <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroRow}>
            {consultation.advisorPhotoUrl ? (
              <Image source={{ uri: consultation.advisorPhotoUrl }} style={styles.heroAvatar} />
            ) : (
              <View style={[styles.heroAvatar, styles.heroAvatarFallback]}>
                <Text style={styles.heroAvatarText}>{consultation.advisorName[0]}</Text>
              </View>
            )}
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{consultation.advisorName}</Text>
              <Text style={styles.heroType}>
                {consultation.advisorType === 'RIA' ? t('advisory.ria') : t('advisory.ra')}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '25' }]}>
              <Text style={[styles.statusText, { color: '#fff' }]}>{t(`advisory.status.${consultation.status}`)}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Booking summary */}
        <Card title={t('advisory.bookingSummary')} style={styles.section}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('advisory.dateTime')}</Text>
            <Text style={styles.summaryValue}>{formatFull(consultation.startTime)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('advisory.duration')}</Text>
            <Text style={styles.summaryValue}>{t('advisory.durationValue')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('advisory.fee')}</Text>
            <Text style={styles.summaryValue}>₹{consultation.amount}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('advisory.bookingId')}</Text>
            <Text style={styles.summaryValueMono}>{consultation.id}</Text>
          </View>
        </Card>

        {isActive && (
          <Card title={t('advisory.actions')} style={styles.section}>
            {consultation.status === 'confirmed' && (
              <AnimatedPressable onPress={handleComplete} haptic="medium" scaleTo={0.97} disabled={busy}>
                <LinearGradient colors={GRADIENTS.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
                  <Ionicons name="checkmark-done" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>{t('advisory.markComplete')}</Text>
                </LinearGradient>
              </AnimatedPressable>
            )}
            {(consultation.status === 'pending' || consultation.status === 'confirmed') && (
              <AnimatedPressable onPress={handleCancel} haptic="medium" scaleTo={0.97} disabled={busy}>
                <View style={[styles.actionBtn, styles.cancelBtn]}>
                  <Ionicons name="close-circle" size={18} color={colors.danger} />
                  <Text style={[styles.actionBtnText, { color: colors.danger }]}>{t('advisory.cancelBtn')}</Text>
                </View>
              </AnimatedPressable>
            )}
          </Card>
        )}

        {consultation.status === 'completed' && (
          <AnimatedPressable
            onPress={() => navigation.navigate('ReviewForm', { advisorId: consultation.advisorId, consultationId: consultation.id })}
            haptic="medium"
            scaleTo={0.97}
            style={styles.section}
          >
            <LinearGradient colors={['#FFC107', '#FF9800']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
              <Ionicons name="star" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>{t('advisory.leaveReview')}</Text>
            </LinearGradient>
          </AnimatedPressable>
        )}

        <Text style={styles.disclaimer}>{t('advisory.disclaimer')}</Text>
        <View style={{ height: 40 }} />
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
    marginBottom: SPACING.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  heroAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: '#fff',
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: '#fff',
  },
  heroType: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  section: {
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.lg,
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
    textAlign: 'right',
    flexShrink: 1,
  },
  summaryValueMono: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    textAlign: 'right',
    fontFamily: 'monospace',
    flexShrink: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: SPACING.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.md,
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.danger,
    marginBottom: 0,
  },
  actionBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },
  disclaimer: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    lineHeight: 16,
    textAlign: 'center',
  },
  skeletonWrap: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
});
