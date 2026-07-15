import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Alert, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { usePollStore } from '../../store/pollStore';
import { POLL_CATEGORIES } from '../../types';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { PollCategory, PollDuration } from '../../types';

const DURATION_OPTIONS: { value: PollDuration; label: string; desc: string }[] = [
  { value: 24,  label: '1 Day',   desc: 'Quick poll' },
  { value: 48,  label: '2 Days',  desc: 'Short discussion' },
  { value: 72,  label: '3 Days',  desc: 'Standard' },
  { value: 168, label: '7 Days',  desc: 'Extended' },
];

const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;

export default function CreatePollScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { createPoll } = usePollStore();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [selectedCategory, setSelectedCategory] = useState<PollCategory>('general');
  const [selectedDuration, setSelectedDuration] = useState<PollDuration>(72);
  const [tagsText, setTagsText] = useState('');

  const canSubmit = question.trim().length > 0
    && options.filter(o => o.trim()).length >= MIN_OPTIONS
    && options.every(o => o.trim().length > 0);

  const handleAddOption = useCallback(() => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions(prev => [...prev, '']);
  }, [options.length]);

  const handleRemoveOption = useCallback((idx: number) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions(prev => prev.filter((_, i) => i !== idx));
  }, [options.length]);

  const handleOptionChange = useCallback((idx: number, value: string) => {
    setOptions(prev => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      Alert.alert('Incomplete', 'Please fill in the question and all options.');
      return;
    }

    const tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);

    await createPoll(
      question.trim(),
      options.filter(o => o.trim()),
      selectedCategory,
      selectedDuration,
      tags,
    );

    Alert.alert('Poll Created!', 'Your poll is now live for the community to vote.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }, [canSubmit, question, options, tagsText, selectedCategory, selectedDuration, createPoll, navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.92}>
              <Ionicons name="close" size={24} color={colors.text} />
            </AnimatedPressable>
            <Text style={styles.headerTitle}>Create Poll</Text>
            <AnimatedPressable onPress={handleSubmit} haptic="medium" scaleTo={0.92}>
              <View style={[styles.publishBtn, !canSubmit && { opacity: 0.5 }]}>
                <Text style={styles.publishBtnText}>Publish</Text>
              </View>
            </AnimatedPressable>
          </View>
        </View>

        {/* ── Question ── */}
        <Animated.View entering={FadeInDown.springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Question</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ask the community something..."
            placeholderTextColor={colors.textMuted}
            value={question}
            onChangeText={setQuestion}
            maxLength={200}
            multiline
          />
          <Text style={styles.charCount}>{question.length}/200</Text>
        </Animated.View>

        {/* ── Options ── */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Options ({options.length}/{MAX_OPTIONS})</Text>
            {options.length < MAX_OPTIONS && (
              <AnimatedPressable onPress={handleAddOption} haptic="light" scaleTo={0.92}>
                <View style={styles.addOptionBtn}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={styles.addOptionBtnText}>Add</Text>
                </View>
              </AnimatedPressable>
            )}
          </View>

          {options.map((option, idx) => (
            <Animated.View
              key={`opt_${idx}`}
              entering={FadeInDown.delay(idx * 30).springify()}
              layout={LinearTransition.springify()}
            >
              <View style={styles.optionRow}>
                <View style={[styles.optionNumber, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.optionNumberText, { color: colors.primary }]}>{idx + 1}</Text>
                </View>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder={`Option ${idx + 1}`}
                  placeholderTextColor={colors.textMuted}
                  value={option}
                  onChangeText={(val) => handleOptionChange(idx, val)}
                  maxLength={100}
                />
                {options.length > MIN_OPTIONS && (
                  <AnimatedPressable onPress={() => handleRemoveOption(idx)} haptic="warning" scaleTo={0.88}>
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                  </AnimatedPressable>
                )}
              </View>
            </Animated.View>
          ))}
        </Animated.View>

        {/* ── Category ── */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.chipRow}>
            {Object.values(POLL_CATEGORIES).map(meta => {
              const isActive = selectedCategory === meta.category;
              return (
                <AnimatedPressable
                  key={meta.category}
                  onPress={() => setSelectedCategory(meta.category)}
                  haptic="selection"
                  scaleTo={0.94}
                >
                  <View style={[
                    styles.categoryChip,
                    isActive && { backgroundColor: meta.color + '25', borderColor: meta.color },
                  ]}>
                    <Ionicons name={meta.icon as any} size={16} color={isActive ? meta.color : colors.textMuted} />
                    <Text style={[
                      styles.categoryChipText,
                      isActive && { color: meta.color },
                    ]}>{meta.label}</Text>
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Duration ── */}
        <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Duration</Text>
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map(opt => {
              const isActive = selectedDuration === opt.value;
              return (
                <AnimatedPressable
                  key={opt.value}
                  onPress={() => setSelectedDuration(opt.value)}
                  haptic="selection"
                  scaleTo={0.94}
                >
                  <View style={[
                    styles.durationCard,
                    isActive && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                  ]}>
                    <Text style={[
                      styles.durationValue,
                      isActive && { color: colors.primary },
                    ]}>
                      {opt.label.split(' ')[0]}
                    </Text>
                    <Text style={[
                      styles.durationUnit,
                      isActive && { color: colors.primary + 'CC' },
                    ]}>
                      {opt.label.split(' ')[1]}
                    </Text>
                    <Text style={[
                      styles.durationDesc,
                      isActive && { color: colors.primary + '99' },
                    ]}>
                      {opt.desc}
                    </Text>
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Tags ── */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Tags (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., nifty, outlook, strategy"
            placeholderTextColor={colors.textMuted}
            value={tagsText}
            onChangeText={setTagsText}
          />
          <Text style={styles.charCount}>Comma separated keywords for discoverability</Text>
        </Animated.View>

        {/* ── Preview ── */}
        <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <View style={[styles.previewCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.previewQuestion, { color: colors.text }]}>
              {question.trim() || 'Your poll question will appear here'}
            </Text>
            <View style={styles.previewOptions}>
              {options.filter(o => o.trim()).map((opt, i) => (
                <View key={i} style={[styles.previewOption, { borderColor: colors.divider }]}>
                  <Text style={[styles.previewOptionText, { color: colors.textSecondary }]}>
                    {opt}
                  </Text>
                </View>
              ))}
            </View>
            <View style={[styles.previewFooter, { borderTopColor: colors.divider }]}>
              <Text style={[styles.previewMeta, { color: colors.textMuted }]}>
                {POLL_CATEGORIES[selectedCategory].label} · {DURATION_OPTIONS.find(d => d.value === selectedDuration)?.label}
              </Text>
              <Text style={[styles.previewVotes, { color: colors.textMuted }]}>0 votes</Text>
            </View>
          </View>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
    textAlignVertical: 'top',
  },
  charCount: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  optionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionNumberText: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    borderStyle: 'dashed',
  },
  addOptionBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  durationRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  durationCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  durationUnit: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  durationDesc: {
    ...FONTS.regular,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },
  previewCard: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  previewQuestion: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  previewOptions: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  previewOption: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  previewOptionText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
  previewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  previewMeta: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  previewVotes: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
});
