import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useAdvisoryStore } from '../../store/advisoryStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import AppScreen from '../../components/ui/AppScreen';
import { triggerHaptic, ImpactFeedbackStyle } from '../../utils/haptics';
import type { RootStackParamList } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export default function ReviewFormScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'ReviewForm'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { advisorId } = route.params;
  const { selectedAdvisor, loadAdvisor, submitReview, error, clearError } = useAdvisoryStore();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAdvisor(advisorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advisorId]);

  useEffect(() => {
    if (error) {
      Alert.alert(t('advisory.reviewFailTitle'), error);
      clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const advisor = selectedAdvisor?.id === advisorId ? selectedAdvisor : null;

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert(t('advisory.ratingRequired'));
      return;
    }
    if (!comment.trim()) {
      Alert.alert(t('advisory.commentRequired'));
      return;
    }
    setSubmitting(true);
    triggerHaptic(ImpactFeedbackStyle.Medium);
    const ok = await submitReview(advisorId, rating, comment.trim());
    setSubmitting(false);
    if (ok) {
      Alert.alert(t('advisory.reviewSuccessTitle'), t('advisory.reviewSuccessMsg'), [
        { text: t('app.ok'), onPress: () => navigation.goBack() },
      ]);
    }
  };

  return (
    <AppScreen scroll={false} padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9} accessibilityLabel="Go back">
            <View style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </View>
          </AnimatedPressable>
          <Text style={styles.title}>{t('advisory.writeReview')}</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.body}>
          <Card style={styles.card}>
            <Text style={styles.advisorName} numberOfLines={1}>{advisor?.name || t('advisory.advisorProfile')}</Text>
            <Text style={styles.subtitle}>{t('advisory.ratingPrompt')}</Text>

            {/* Star rating */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <AnimatedPressable
                  key={n}
                  onPress={() => {
                    triggerHaptic(ImpactFeedbackStyle.Light);
                    setRating(n);
                  }}
                  haptic="light"
                  scaleTo={0.85}
                >
                  <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={40} color={n <= rating ? '#FFC107' : colors.textMuted} />
                </AnimatedPressable>
              ))}
            </View>

            {rating > 0 && (
              <Text style={styles.ratingLabel}>
                {rating === 5 ? t('advisory.rating5') : rating === 4 ? t('advisory.rating4') : rating === 3 ? t('advisory.rating3') : rating === 2 ? t('advisory.rating2') : t('advisory.rating1')}
              </Text>
            )}

            {/* Comment */}
            <TextInput
              testID="review-comment"
              style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
              placeholder={t('advisory.commentPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={5}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{comment.length}/500</Text>
          </Card>

          <AnimatedPressable onPress={handleSubmit} haptic="medium" scaleTo={0.97} disabled={submitting} testID="review-submit">
            <LinearGradient colors={['#FFC107', '#FF9800']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitBtn}>
              <Ionicons name="paper-plane" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>
                {submitting ? t('advisory.submitting') : t('advisory.submitReview')}
              </Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
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
  body: {
    paddingHorizontal: SPACING.xl,
  },
  card: {
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  advisorName: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  ratingLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: '#FFC107',
    marginTop: SPACING.sm,
  },
  input: {
    width: '100%',
    minHeight: 120,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
  },
  charCount: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
  },
  submitBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },
});
