// ============================================================================
// Toroloom — Pattern Settings Modal
// Lets users adjust confidence threshold, toggle individual pattern types,
// and set lookback period for chart pattern detection.
// ============================================================================

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import {
  usePatternSettingsStore,
  ALL_PATTERNS,
  LOOKBACK_OPTIONS,
  type LookbackValue,
} from '../../store/patternSettingsStore';
import type { PatternType } from '../chart/patternDetection';

// ── Pattern metadata ──

interface PatternMeta {
  type: PatternType;
  label: string;
  icon: string;
  category: 'Reversal' | 'Continuation' | 'Triangle';
}

const PATTERN_METAS: PatternMeta[] = [
  { type: 'head_and_shoulders', label: 'Head & Shoulders', icon: '🔻', category: 'Reversal' },
  { type: 'inverse_head_and_shoulders', label: 'Inverse H&S', icon: '🟢', category: 'Reversal' },
  { type: 'double_top', label: 'Double Top', icon: '⛰️', category: 'Reversal' },
  { type: 'double_bottom', label: 'Double Bottom', icon: '⛰️', category: 'Reversal' },
  { type: 'bull_flag', label: 'Bull Flag', icon: '🚩', category: 'Continuation' },
  { type: 'bear_flag', label: 'Bear Flag', icon: '🚩', category: 'Continuation' },
  { type: 'ascending_triangle', label: 'Ascending Triangle', icon: '▲', category: 'Triangle' },
  { type: 'descending_triangle', label: 'Descending Triangle', icon: '▼', category: 'Triangle' },
  { type: 'symmetrical_triangle', label: 'Symmetrical Triangle', icon: '🔺', category: 'Triangle' },
];

const CATEGORIES = ['Reversal', 'Continuation', 'Triangle'] as const;

// ── Custom Slider ──

interface CustomSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  suffix?: string;
  onValueChange: (val: number) => void;
  colors: any;
}

function CustomSlider({ value, min, max, step = 1, label, suffix = '%', onValueChange, colors }: CustomSliderProps) {
  const trackRef = useRef<View>(null);
  const trackWidth = useRef(0);

  const clampedStep = Math.max(1, step);
  const ratio = (value - min) / (max - min);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateValue(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        updateValue(evt.nativeEvent.locationX);
      },
    }),
  ).current;

  const updateValue = (locationX: number) => {
    if (trackWidth.current <= 0) return;
    const rawRatio = Math.max(0, Math.min(1, locationX / trackWidth.current));
    const rawValue = min + rawRatio * (max - min);
    const stepped = Math.round(rawValue / clampedStep) * clampedStep;
    onValueChange(Math.max(min, Math.min(max, stepped)));
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.labelRow}>
        <Text style={[sliderStyles.label, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[sliderStyles.value, { color: colors.text }]}>
          {value}{suffix}
        </Text>
      </View>
      <View
        ref={trackRef}
        style={[sliderStyles.track, { backgroundColor: colors.bgInput }]}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            sliderStyles.fill,
            {
              width: `${ratio * 100}%` as any,
              backgroundColor: colors.primary,
            },
          ]}
        />
        <View
          style={[
            sliderStyles.thumb,
            {
              left: `${ratio * 100}%` as any,
              backgroundColor: colors.primary,
              borderColor: colors.bg,
            },
          ]}
        />
      </View>
      <View style={sliderStyles.marks}>
        <Text style={[sliderStyles.mark, { color: colors.textMuted }]}>{min}{suffix}</Text>
        <Text style={[sliderStyles.mark, { color: colors.textMuted }]}>
          {Math.round((max - min) / 2 + min)}{suffix}
        </Text>
        <Text style={[sliderStyles.mark, { color: colors.textMuted }]}>{max}{suffix}</Text>
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: { marginBottom: SPACING.lg },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  label: { ...FONTS.medium, fontSize: FONTS.size.sm },
  value: { ...FONTS.semiBold, fontSize: FONTS.size.lg },
  track: { height: 32, borderRadius: BORDER_RADIUS.full, position: 'relative', justifyContent: 'center', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: BORDER_RADIUS.full, position: 'absolute', left: 0, top: 0 },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    position: 'absolute',
    top: 4,
    marginLeft: -12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  marks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  mark: { ...FONTS.regular, fontSize: FONTS.size.xs },
});

// ── Main Modal ──

interface PatternSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PatternSettingsModal({ visible, onClose }: PatternSettingsModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const {
    minConfidence,
    enabledPatterns,
    lookback,
    setMinConfidence,
    togglePattern,
    enableAllPatterns,
    disableAllPatterns,
    setLookback,
    resetDefaults,
  } = usePatternSettingsStore();

  const [localMinConf, setLocalMinConf] = useState(minConfidence);
  const [localEnabled, setLocalEnabled] = useState<PatternType[]>(enabledPatterns as PatternType[]);
  const [localLookback, setLocalLookback] = useState<LookbackValue>(lookback);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local state when modal opens
  React.useEffect(() => {
    if (visible) {
      setLocalMinConf(minConfidence);
      setLocalEnabled(enabledPatterns);
      setLocalLookback(lookback);
      setHasChanges(false);
    }
  }, [visible, minConfidence, enabledPatterns, lookback]);

  const handleApply = useCallback(() => {
    setMinConfidence(localMinConf);
    setLookback(localLookback);
    // Sync enabled patterns
    const currentEnabled = usePatternSettingsStore.getState().enabledPatterns;
    const toDisable = currentEnabled.filter(p => !localEnabled.includes(p));
    const toEnable = localEnabled.filter(p => !currentEnabled.includes(p));
    for (const p of toDisable) togglePattern(p);
    for (const p of toEnable) togglePattern(p);
    setHasChanges(false);
    onClose();
  }, [localMinConf, localEnabled, localLookback, setMinConfidence, setLookback, togglePattern, onClose]);

  const handleReset = useCallback(() => {
    resetDefaults();
    setLocalMinConf(50);
    setLocalEnabled(ALL_PATTERNS.map(p => p));
    setLocalLookback(0);
    setHasChanges(true);
  }, [resetDefaults]);

  const handleToggleLocal = (pattern: PatternType) => {
    setLocalEnabled(prev =>
      prev.includes(pattern) ? prev.filter(p => p !== pattern) : [...prev, pattern],
    );
    if (!hasChanges) setHasChanges(true);
  };

  const handleSliderChange = useCallback((val: number) => {
    setLocalMinConf(val);
    if (!hasChanges) setHasChanges(true);
  }, [hasChanges]);

  const handleLookbackChange = useCallback((val: LookbackValue) => {
    setLocalLookback(val);
    if (!hasChanges) setHasChanges(true);
  }, [hasChanges]);

  // Count patterns that would pass the filter
  const enabledCount = localEnabled.length;
  const allCount = ALL_PATTERNS.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.bgCard }]}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Text style={[styles.title, { color: colors.text }]}>Pattern Settings</Text>
            <Pressable onPress={handleReset} style={styles.resetBtn} hitSlop={8}>
              <Ionicons name="refresh" size={20} color={colors.primary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* ── Min Confidence Slider ── */}
            <CustomSlider
              value={localMinConf}
              min={0}
              max={100}
              step={5}
              label="Min Confidence"
              suffix="%"
              onValueChange={handleSliderChange}
              colors={colors}
            />

            {/* ── Lookback Period ── */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Lookback Period</Text>
              <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
                Number of candles to analyze
              </Text>
              <View style={styles.chipRow}>
                {LOOKBACK_OPTIONS.map(opt => {
                  const active = localLookback === opt;
                  const label = opt === 0 ? 'All Data' : `${opt}`;
                  return (
                    <Pressable
                      key={opt}
                      style={[
                        styles.chip,
                        { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '15' : colors.bg },
                      ]}
                      onPress={() => handleLookbackChange(opt)}
                    >
                      <Text style={[styles.chipText, { color: active ? colors.primary : colors.textSecondary }]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ── Pattern Toggles ── */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Pattern Types</Text>
                <View style={styles.sectionActions}>
                  <Pressable onPress={() => { setLocalEnabled(ALL_PATTERNS.map(p => p)); if (!hasChanges) setHasChanges(true); }}>
                    <Text style={[styles.actionLink, { color: colors.primary }]}>All</Text>
                  </Pressable>
                  <Text style={{ color: colors.textMuted }}> · </Text>
                  <Pressable onPress={() => { setLocalEnabled([]); if (!hasChanges) setHasChanges(true); }}>
                    <Text style={[styles.actionLink, { color: colors.primary }]}>None</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
                {enabledCount}/{allCount} enabled
              </Text>

              {CATEGORIES.map(category => {
                const metas = PATTERN_METAS.filter(m => m.category === category);
                return (
                  <View key={category} style={styles.categoryGroup}>
                    <Text style={[styles.categoryLabel, { color: colors.textSecondary }]}>{category}</Text>
                    {metas.map(meta => {
                      const active = localEnabled.includes(meta.type);
                      return (
                        <Pressable
                          key={meta.type}
                          style={[styles.toggleRow, { backgroundColor: active ? colors.primary + '08' : 'transparent' }]}
                          onPress={() => handleToggleLocal(meta.type)}
                        >
                          <Text style={styles.toggleIcon}>{meta.icon}</Text>
                          <Text style={[styles.toggleLabel, { color: colors.text }]}>{meta.label}</Text>
                          <View style={[styles.toggleSwitch, { backgroundColor: active ? colors.primary : colors.border }]}>
                            <View style={[styles.toggleKnob, { transform: [{ translateX: active ? 14 : 0 }], backgroundColor: colors.bg }]} />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </View>

            {/* Preview summary */}
            <View style={[styles.previewBox, { backgroundColor: colors.bg }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.previewText, { color: colors.textSecondary }]}>
                {localMinConf > 0
                  ? `Only patterns with ≥${localMinConf}% confidence will appear. `
                  : 'All confidence levels shown. '}
                {localEnabled.length < allCount
                  ? `${allCount - localEnabled.length} pattern type(s) disabled.`
                  : 'All pattern types enabled.'}
              </Text>
            </View>
          </ScrollView>

          {/* ── Apply Button ── */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.applyBtn, { opacity: hasChanges ? 1 : 0.5, backgroundColor: colors.primary }]}
              onPress={handleApply}
              disabled={!hasChanges}
            >
              <Text style={styles.applyBtnText}>Apply Settings</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ──

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '85%',
      paddingTop: SPACING.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
    },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    resetBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      ...FONTS.extraBold,
      fontSize: FONTS.size.xl,
    },
    scrollContent: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.lg,
    },
    section: {
      marginBottom: SPACING.lg,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionLink: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
    },
    sectionTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
    },
    sectionSub: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      marginTop: 2,
      marginBottom: SPACING.sm,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    chip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
    },
    chipText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
    },
    categoryGroup: {
      marginBottom: SPACING.md,
    },
    categoryLabel: {
      ...FONTS.bold,
      fontSize: FONTS.size.xs,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: SPACING.xs,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: 2,
    },
    toggleIcon: {
      fontSize: 16,
      marginRight: SPACING.sm,
    },
    toggleLabel: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      flex: 1,
    },
    toggleSwitch: {
      width: 36,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    toggleKnob: {
      width: 18,
      height: 18,
      borderRadius: 9,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    previewBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: SPACING.lg,
    },
    previewText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      flex: 1,
      lineHeight: 18,
    },
    footer: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.xl,
      paddingTop: SPACING.sm,
    },
    applyBtn: {
      height: 48,
      borderRadius: BORDER_RADIUS.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    applyBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      color: '#FFFFFF',
    },
  });
