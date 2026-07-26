import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Alert, Platform,
  KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../hooks/useT';
import { useTheme } from '../../context/ThemeContext';
import { useUserCourseStore } from '../../store/userCourseStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { UserGeneratedCourse, CourseDraftLesson, QuizQuestion } from '../../types';

const COURSE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const COURSE_CATEGORIES = [
  'Finance', 'Investing', 'Technical', 'Fundamentals', 'Derivatives',
  'Psychology', 'Trading', 'Options', 'Personal Finance', 'Economics',
] as const;
const THUMBNAIL_OPTIONS = ['📚', '📊', '📈', '💰', '🎯', '🧠', '🏦', '📐', '🚀', '📋'];

export default function CreateCourseScreen({ route, navigation }: any) {
  const { courseId } = route.params || {};
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    myCourses, editingCourse, saveCourse, setEditingCourse,
    addLesson, removeLesson, updateLesson,
    addQuizToLesson, removeQuizFromLesson,
    addQuestionToQuiz, updateQuizQuestion, removeQuestionFromQuiz,
    submitForReview,
  } = useUserCourseStore();

  const course = useMemo(
    () => editingCourse?.id === courseId ? editingCourse : myCourses.find(c => c.id === courseId),
    [editingCourse, myCourses, courseId]
  );

  const [title, setTitle] = useState(course?.title || '');
  const [description, setDescription] = useState(course?.description || '');
  const [selectedLevel, setSelectedLevel] = useState<'beginner' | 'intermediate' | 'advanced'>(
    course?.level || 'beginner'
  );
  const [selectedCategory, setSelectedCategory] = useState(course?.category || 'Finance');
  const [selectedThumbnail, setSelectedThumbnail] = useState(course?.thumbnail || '📚');
  const [tagsText, setTagsText] = useState((course?.tags || []).join(', '));
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // Auto-save helper
  const doSave = useCallback(() => {
    if (!course) return;
    const tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);
    const durationTotal = (course.lessons || []).reduce((sum, l) => {
      const mins = parseInt(l.duration) || 0;
      return sum + mins;
    }, 0);
    saveCourse({
      ...course,
      title,
      description,
      level: selectedLevel,
      category: selectedCategory,
      thumbnail: selectedThumbnail,
      tags,
      duration: durationTotal > 0 ? `${durationTotal} min` : '0 min',
    });
  }, [course, title, description, selectedLevel, selectedCategory, selectedThumbnail, tagsText, saveCourse]);

  // Save on leave
  React.useEffect(() => {
    return () => {
      if (course) doSave();
    };
  }, []);

  if (!course) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>{t('education.courseNotFound')}</Text>
      </View>
    );
  }

  const lessons = course.lessons || [];

  const handleAddLesson = () => {
    addLesson(course.id);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  };

  const handlePublish = () => {
    doSave();
    if (!title.trim()) {
      Alert.alert(t('education.missingTitle'), t('education.missingTitleMsg'));
      return;
    }
    if (lessons.length === 0) {
      Alert.alert(t('education.noLessons'), t('education.noLessonsMsg'));
      return;
    }
    // Check that all lessons have titles
    const emptyLessons = lessons.filter(l => !l.title.trim());
    if (emptyLessons.length > 0) {
      Alert.alert(t('education.incompleteLessons'),
        t('education.incompleteLessonsMsg', { count: emptyLessons.length }));
      return;
    }

    Alert.alert(
      t('education.submitForReviewTitle'),
      t('education.submitForReviewMsg'),
      [
        { text: t('app.cancel'), style: 'cancel' },
        {
          text: t('education.submit'),
          onPress: () => {
            submitForReview(course.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const toggleExpandLesson = (lessonId: string) => {
    setExpandedLessonId(prev => prev === lessonId ? null : lessonId);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <AnimatedPressable onPress={() => { doSave(); navigation.goBack(); }} haptic="light" scaleTo={0.92}>
              <Ionicons name="close" size={24} color={colors.text} />
            </AnimatedPressable>
            <Text style={styles.headerTitle}>
              {title.trim() || t('education.createCourseTitle')}
            </Text>
            <AnimatedPressable onPress={handlePublish} haptic="medium" scaleTo={0.92}>
              <View style={styles.publishBtn}>
                <Text style={styles.publishBtnText}>{t('education.submit')}</Text>
              </View>
            </AnimatedPressable>
          </View>
          <Text style={styles.headerSubtitle}>
            {course.publishStatus === 'published' ? t('education.published') :
             course.submittedForReview ? t('education.underReview') : t('education.draft')}
          </Text>
        </View>

        {/* ── Basic Info ── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('education.basicInfo')}</Text>

          <Text style={styles.inputLabel}>{t('education.courseTitle')}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('education.courseTitlePlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <Text style={styles.inputLabel}>{t('education.description')}</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder={t('education.descriptionPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={500}
          />

          {/* Thumbnail Picker */}
          <Text style={styles.inputLabel}>{t('education.iconThumbnail')}</Text>
          <View style={styles.thumbnailRow}>
            {THUMBNAIL_OPTIONS.map(emoji => (
              <AnimatedPressable
                key={emoji}
                onPress={() => setSelectedThumbnail(emoji)}
                haptic="selection"
                scaleTo={0.88}
              >
                <View style={[
                  styles.thumbnailOption,
                  selectedThumbnail === emoji && {
                    backgroundColor: colors.primary + '30',
                    borderColor: colors.primary,
                  },
                ]}>
                  <Text style={styles.thumbnailEmoji}>{emoji}</Text>
                </View>
              </AnimatedPressable>
            ))}
          </View>
        </Animated.View>

        {/* ── Level & Category ── */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('education.levelCategory')}</Text>

          <Text style={styles.inputLabel}>{t('education.difficulty')}</Text>
          <View style={styles.chipRow}>
            {COURSE_LEVELS.map(level => (
              <AnimatedPressable
                key={level}
                onPress={() => setSelectedLevel(level)}
                haptic="selection"
                scaleTo={0.94}
              >
                <View style={[
                  styles.levelChip,
                  selectedLevel === level && {
                    backgroundColor: colors.primary + '30',
                    borderColor: colors.primary,
                  },
                ]}>
                  <Text style={[
                    styles.levelChipText,
                    selectedLevel === level && { color: colors.primary },
                  ]}>
                    {t('education.' + level)}
                  </Text>
                </View>
              </AnimatedPressable>
            ))}
          </View>

          <Text style={styles.inputLabel}>{t('education.category')}</Text>
          <View style={styles.chipRow}>
            {COURSE_CATEGORIES.map(cat => (
              <AnimatedPressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                haptic="selection"
                scaleTo={0.94}
              >
                <View style={[
                  styles.categoryChip,
                  selectedCategory === cat && {
                    backgroundColor: colors.primary + '30',
                    borderColor: colors.primary,
                  },
                ]}>
                  <Text style={[
                    styles.categoryChipText,
                    selectedCategory === cat && { color: colors.primary },
                  ]}>
                    {cat}
                  </Text>
                </View>
              </AnimatedPressable>
            ))}
          </View>

          <Text style={styles.inputLabel}>{t('education.tagsCommaSeparated')}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('education.tagsPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={tagsText}
            onChangeText={setTagsText}
          />
        </Animated.View>

        {/* ── Lessons ── */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('education.lessonsLabel')} ({lessons.length})</Text>
            <AnimatedPressable onPress={handleAddLesson} haptic="light" scaleTo={0.92}>
              <View style={styles.addLessonBtn}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addLessonBtnText}>{t('education.addLesson')}</Text>
              </View>
            </AnimatedPressable>
          </View>

          {lessons.length === 0 ? (
            <View style={styles.emptyLessons}>
              <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyLessonsText}>{t('education.noLessonsYet')}</Text>
            </View>
          ) : (
            lessons.map((lesson, idx) => (
              <Animated.View
                key={lesson.id}
                entering={FadeInDown.delay(idx * 30).springify()}
                layout={LinearTransition.springify()}
              >
                <LessonEditor
                  lesson={lesson}
                  index={idx}
                  courseId={course.id}
                  isExpanded={expandedLessonId === lesson.id}
                  onToggleExpand={() => toggleExpandLesson(lesson.id)}
                  onUpdate={(updates) => updateLesson(course.id, lesson.id, updates)}
                  onRemove={() => {
                    Alert.alert(t('education.removeLesson'), t('education.removeLessonConfirm', { title: lesson.title || t('education.untitledLesson') }), [
                      { text: t('app.cancel'), style: 'cancel' },
                      { text: t('app.delete'), style: 'destructive', onPress: () => removeLesson(course.id, lesson.id) },
                    ]);
                  }}
                  onAddQuiz={() => addQuizToLesson(course.id, lesson.id)}
                  onRemoveQuiz={() => removeQuizFromLesson(course.id, lesson.id)}
                  onAddQuestion={() => addQuestionToQuiz(course.id, lesson.id)}
                  onUpdateQuestion={(qId, updates) => updateQuizQuestion(course.id, lesson.id, qId, updates)}
                  onRemoveQuestion={(qId) => removeQuestionFromQuiz(course.id, lesson.id, qId)}
                  colors={colors}
                  styles={styles}
                />
              </Animated.View>
            ))
          )}
        </Animated.View>

        {/* ── Actions ── */}
        <View style={styles.section}>
          <AnimatedPressable onPress={doSave} haptic="medium" scaleTo={0.97}>
            <View style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>{t('education.saveDraft')}</Text>
            </View>
          </AnimatedPressable>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Lesson Editor Component ───────────────────────────────────

function LessonEditor({
  lesson, index, courseId, isExpanded,
  onToggleExpand, onUpdate, onRemove,
  onAddQuiz, onRemoveQuiz,
  onAddQuestion, onUpdateQuestion, onRemoveQuestion,
  colors, styles,
}: {
  lesson: CourseDraftLesson;
  index: number;
  courseId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<CourseDraftLesson>) => void;
  onRemove: () => void;
  onAddQuiz: () => void;
  onRemoveQuiz: () => void;
  onAddQuestion: () => void;
  onUpdateQuestion: (qId: string, updates: Partial<QuizQuestion>) => void;
  onRemoveQuestion: (qId: string) => void;
  colors: any;
  styles: any;
}) {
  const { t } = useT();
  const hasQuiz = !!lesson.quiz;

  return (
    <View style={styles.lessonCard}>
      {/* Lesson Header (always visible) */}
      <AnimatedPressable onPress={onToggleExpand} haptic="selection" scaleTo={0.98}>
        <View style={styles.lessonHeader}>
          <View style={styles.lessonNumber}>
            <Text style={styles.lessonNumberText}>{index + 1}</Text>
          </View>
          <View style={styles.lessonHeaderInfo}>
            <Text style={styles.lessonTitle} numberOfLines={1}>
              {lesson.title || t('education.untitledLesson')}
            </Text>
            <View style={styles.lessonMeta}>
              <Text style={styles.lessonMetaText}>{lesson.duration}</Text>
              {hasQuiz && (
                <View style={styles.quizBadgeSmall}>
                  <Ionicons name="help-circle" size={10} color="#FFC107" />
                  <Text style={styles.quizBadgeSmallText}>{t('education.quiz')}</Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </View>
      </AnimatedPressable>

      {/* Expanded editor */}
      {isExpanded && (
        <Animated.View entering={FadeInDown.springify()} style={styles.lessonEditor}>
          <Text style={styles.inputLabel}>{t('education.lessonTitle')}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('education.lessonTitlePlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={lesson.title}
            onChangeText={(val) => onUpdate({ title: val })}
          />

          <Text style={styles.inputLabel}>{t('education.duration')}</Text>
          <View style={styles.durationRow}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder={t('education.durationPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={lesson.duration.replace(' min', '')}
              onChangeText={(val) => onUpdate({ duration: val ? `${val} min` : '0 min' })}
              keyboardType="number-pad"
            />
            <Text style={styles.durationSuffix}>{t('education.minAbbr')}</Text>
          </View>

          <Text style={styles.inputLabel}>{t('education.content')}</Text>
          <TextInput
            style={[styles.textInput, styles.contentArea]}
            placeholder={t('education.contentPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={lesson.content}
            onChangeText={(val) => onUpdate({ content: val })}
            multiline
            numberOfLines={6}
          />

          <Text style={styles.inputLabel}>{t('education.videoUrl')}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('education.videoUrlPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={lesson.videoUrl || ''}
            onChangeText={(val) => onUpdate({ videoUrl: val })}
            autoCapitalize="none"
          />

          {/* Quiz Section */}
          <View style={styles.quizSection}>
            {hasQuiz ? (
              <QuizEditor
                quiz={lesson.quiz!}
                onAddQuestion={onAddQuestion}
                onUpdateQuestion={onUpdateQuestion}
                onRemoveQuestion={onRemoveQuestion}
                onRemoveQuiz={onRemoveQuiz}
                colors={colors}
                styles={styles}
              />
            ) : (
              <AnimatedPressable onPress={onAddQuiz} haptic="light" scaleTo={0.94}>
                <View style={styles.addQuizBtn}>
                  <Ionicons name="help-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.addQuizBtnText}>{t('education.addQuiz')}</Text>
                </View>
              </AnimatedPressable>
            )}
          </View>

          {/* Remove Lesson */}
          <AnimatedPressable onPress={onRemove} haptic="warning" scaleTo={0.94}>
            <View style={styles.removeLessonBtn}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.removeLessonText}>{t('education.removeLesson')}</Text>
            </View>
          </AnimatedPressable>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Quiz Editor Component ─────────────────────────────────────

function QuizEditor({
  quiz, onAddQuestion, onUpdateQuestion, onRemoveQuestion, onRemoveQuiz,
  colors, styles,
}: {
  quiz: NonNullable<CourseDraftLesson['quiz']>;
  onAddQuestion: () => void;
  onUpdateQuestion: (qId: string, updates: Partial<QuizQuestion>) => void;
  onRemoveQuestion: (qId: string) => void;
  onRemoveQuiz: () => void;
  colors: any;
  styles: any;
}) {
  const { t } = useT();
  return (
    <View style={styles.quizEditor}>
      <View style={styles.quizHeader}>
        <View style={styles.quizHeaderLeft}>
          <Ionicons name="help-circle" size={18} color="#FFC107" />
          <Text style={styles.quizTitle}>{quiz.title}</Text>
          <Text style={styles.quizCount}>({t('education.questions', { count: quiz.questions.length })})</Text>
        </View>
        <AnimatedPressable onPress={onRemoveQuiz} haptic="warning" scaleTo={0.88}>
          <Ionicons name="close-circle" size={20} color={colors.danger} />
        </AnimatedPressable>
      </View>

      {quiz.questions.map((q, qIdx) => (
        <View key={q.id} style={styles.questionCard}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionLabel}>{t('education.questionLabel', { num: qIdx + 1 })}</Text>
            <AnimatedPressable onPress={() => onRemoveQuestion(q.id)} haptic="light" scaleTo={0.88}>
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
            </AnimatedPressable>
          </View>

          <TextInput
            style={styles.textInput}
            placeholder={t('education.questionPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={q.question}
            onChangeText={(val) => onUpdateQuestion(q.id, { question: val })}
          />

          {/* Options */}
          {q.options.map((opt, optIdx) => (
            <View key={optIdx} style={styles.optionRow}>
              <AnimatedPressable
                onPress={() => onUpdateQuestion(q.id, { correctAnswer: optIdx })}
                haptic="selection"
                scaleTo={0.92}
              >
                <View style={[
                  styles.optionRadio,
                  q.correctAnswer === optIdx && styles.optionRadioSelected,
                ]}>
                  {q.correctAnswer === optIdx && (
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  )}
                </View>
              </AnimatedPressable>
              <TextInput
                style={[styles.textInput, styles.optionInput]}
                placeholder={t('education.optionPlaceholder', { num: optIdx + 1 })}
                placeholderTextColor={colors.textMuted}
                value={opt}
                onChangeText={(val) => {
                  const newOptions = [...q.options];
                  newOptions[optIdx] = val;
                  onUpdateQuestion(q.id, { options: newOptions });
                }}
              />
            </View>
          ))}

          <Text style={[styles.inputLabel, { marginTop: SPACING.sm }]}>{t('education.explanation')}</Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('education.explanationPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={q.explanation}
            onChangeText={(val) => onUpdateQuestion(q.id, { explanation: val })}
          />
        </View>
      ))}

      <AnimatedPressable onPress={onAddQuestion} haptic="light" scaleTo={0.94}>
        <View style={styles.addQuestionBtn}>
          <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.addQuestionBtnText}>{t('education.addQuestion')}</Text>
        </View>
      </AnimatedPressable>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  header: {
    paddingTop: 60,
    marginBottom: SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  headerTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
    flex: 1,
  },
  headerSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginTop: 4,
    marginLeft: 40,
  },
  publishBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  publishBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: '#fff',
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  inputLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: SPACING.md,
  },
  textInput: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    fontSize: FONTS.size.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: Platform.OS === 'ios' ? 'System' : undefined,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  contentArea: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  thumbnailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  thumbnailOption: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  thumbnailEmoji: {
    fontSize: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  levelChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  categoryChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  addLessonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  addLessonBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: '#fff',
  },
  emptyLessons: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: SPACING.md,
  },
  emptyLessonsText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  lessonCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  lessonNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lessonNumberText: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  lessonHeaderInfo: {
    flex: 1,
  },
  lessonTitle: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 2,
  },
  lessonMetaText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  quizBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  quizBadgeSmallText: {
    ...FONTS.regular,
    fontSize: 10,
    color: '#FFC107',
  },
  lessonEditor: {
    padding: SPACING.md,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  durationSuffix: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  quizSection: {
    marginTop: SPACING.md,
  },
  addQuizBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    borderStyle: 'dashed',
  },
  addQuizBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  removeLessonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.danger + '30',
  },
  removeLessonText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.danger,
  },
  quizEditor: {
    backgroundColor: colors.bgCardLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  quizHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quizTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  quizCount: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  questionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  questionLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  optionRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRadioSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionInput: {
    flex: 1,
  },
  addQuestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    borderStyle: 'dashed',
  },
  addQuestionBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  actionBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },
});
