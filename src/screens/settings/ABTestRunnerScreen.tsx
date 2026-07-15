import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TextInput, Modal, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useABTestStore } from '../../store/abTestStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { ABExperiment, ABTestStatus } from '../../types';

export default function ABTestRunnerScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    experiments, selectedExperimentId, selectExperiment,
    startExperiment, pauseExperiment, resumeExperiment,
    completeExperiment, archiveExperiment, deleteExperiment,
    simulateMetrics, getMetricSnapshot,
  } = useABTestStore();

  const [activeFilter, setActiveFilter] = useState<ABTestStatus | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);

  const filteredExperiments = useMemo(() => {
    if (activeFilter === 'all') return experiments;
    return experiments.filter(e => e.status === activeFilter);
  }, [experiments, activeFilter]);

  const stats = useMemo(() => ({
    total: experiments.length,
    running: experiments.filter(e => e.status === 'running').length,
    completed: experiments.filter(e => e.status === 'completed').length,
    draft: experiments.filter(e => e.status === 'draft').length,
  }), [experiments]);

  const selectedExp = useMemo(
    () => experiments.find(e => e.id === selectedExperimentId) || null,
    [experiments, selectedExperimentId],
  );

  const handleExperimentAction = useCallback((exp: ABExperiment, action: string) => {
    switch (action) {
      case 'start':
        startExperiment(exp.id);
        Alert.alert('Experiment Started', `${exp.name} is now live.`);
        break;
      case 'pause':
        pauseExperiment(exp.id);
        break;
      case 'resume':
        resumeExperiment(exp.id);
        break;
      case 'complete':
        completeExperiment(exp.id);
        break;
      case 'simulate':
        simulateMetrics(exp.id);
        break;
      case 'archive':
        archiveExperiment(exp.id);
        break;
      case 'delete':
        Alert.alert('Delete Experiment', `Delete "${exp.name}"? This cannot be undone.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => {
            deleteExperiment(exp.id);
            if (selectedExperimentId === exp.id) selectExperiment(null);
          }},
        ]);
        break;
    }
  }, [startExperiment, pauseExperiment, resumeExperiment, completeExperiment, simulateMetrics, deleteExperiment, selectedExperimentId, selectExperiment]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>A/B Test Runner</Text>
          <Text style={styles.subtitle}>Run experiments without app update</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: colors.primary }]}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#00C853' }]}>
            <Text style={[styles.statValue, { color: '#00C853' }]}>{stats.running}</Text>
            <Text style={styles.statLabel}>Running</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#6C63FF' }]}>
            <Text style={[styles.statValue, { color: '#6C63FF' }]}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#FFC107' }]}>
            <Text style={[styles.statValue, { color: '#FFC107' }]}>{stats.draft}</Text>
            <Text style={styles.statLabel}>Drafts</Text>
          </View>
        </View>

        {/* Create Button */}
        <AnimatedPressable onPress={() => setShowCreate(true)} haptic="medium" scaleTo={0.97}>
          <View style={styles.createBtn}>
            <Ionicons name="flask" size={20} color="#fff" />
            <Text style={styles.createBtnText}>New Experiment</Text>
          </View>
        </AnimatedPressable>

        {/* Filter */}
        <View style={styles.filterRow}>
          {(['all', 'running', 'draft', 'completed', 'paused'] as const).map(status => {
            const isActive = activeFilter === status;
            return (
              <AnimatedPressable
                key={status}
                onPress={() => setActiveFilter(status)}
                haptic="selection"
                scaleTo={0.94}
              >
                <View style={[styles.filterChip, isActive && { backgroundColor: colors.primary + '25', borderColor: colors.primary }]}>
                  <Text style={[styles.filterChipText, isActive && { color: colors.primary }]}>
                    {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </View>
              </AnimatedPressable>
            );
          })}
        </View>

        {/* Experiment Cards */}
        {filteredExperiments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="flask-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No experiments</Text>
            <Text style={styles.emptySubtitle}>Create your first A/B test to get started.</Text>
          </View>
        ) : (
          filteredExperiments.map((exp, idx) => (
            <Animated.View
              key={exp.id}
              entering={FadeInDown.delay(idx * 50).springify()}
              layout={LinearTransition.springify()}
            >
              <ExperimentCard
                exp={exp}
                isSelected={selectedExperimentId === exp.id}
                onSelect={() => selectExperiment(selectedExperimentId === exp.id ? null : exp.id)}
                onAction={handleExperimentAction}
                getSnapshot={getMetricSnapshot}
                colors={colors}
                styles={styles}
              />
            </Animated.View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create Modal */}
      <CreateExperimentModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        colors={colors}
        styles={styles}
      />
    </View>
  );
}

// ─── Experiment Card Component ───────────────────────────────────────────

function ExperimentCard({
  exp, isSelected, onSelect, onAction, getSnapshot, colors, styles,
}: {
  exp: ABExperiment;
  isSelected: boolean;
  onSelect: () => void;
  onAction: (exp: ABExperiment, action: string) => void;
  getSnapshot: (id: string) => any;
  colors: any;
  styles: any;
}) {
  const statusColor = exp.status === 'running' ? '#00C853' :
    exp.status === 'completed' ? '#6C63FF' :
    exp.status === 'paused' ? '#FFC107' :
    exp.status === 'draft' ? colors.textMuted : '#8B5CF6';

  const snapshot = useMemo(() => getSnapshot(exp.id), [exp.id, getSnapshot]);

  const availableActions = useMemo(() => {
    const acts: { key: string; icon: string; label: string; color: string }[] = [];
    if (exp.status === 'draft') {
      acts.push({ key: 'start', icon: 'play', label: 'Start', color: '#00C853' });
      acts.push({ key: 'delete', icon: 'trash', label: 'Delete', color: '#FF5252' });
    } else if (exp.status === 'running') {
      acts.push({ key: 'pause', icon: 'pause', label: 'Pause', color: '#FFC107' });
      acts.push({ key: 'simulate', icon: 'pulse', label: 'Simulate', color: colors.primary });
      acts.push({ key: 'complete', icon: 'checkmark', label: 'Complete', color: '#6C63FF' });
    } else if (exp.status === 'paused') {
      acts.push({ key: 'resume', icon: 'play', label: 'Resume', color: '#00C853' });
      acts.push({ key: 'simulate', icon: 'pulse', label: 'Simulate', color: colors.primary });
      acts.push({ key: 'complete', icon: 'checkmark', label: 'Complete', color: '#6C63FF' });
    } else if (exp.status === 'completed') {
      acts.push({ key: 'archive', icon: 'archive', label: 'Archive', color: colors.textMuted });
    }
    return acts;
  }, [exp.status, colors]);

  return (
    <View style={[styles.expCard, { borderLeftColor: statusColor, borderLeftWidth: 3 }]}>
      {/* Header */}
      <AnimatedPressable onPress={onSelect} haptic="selection" scaleTo={0.99}>
        <View style={styles.expHeader}>
          <View style={styles.expHeaderLeft}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.expName}>{exp.name}</Text>
          </View>
          <Ionicons name={isSelected ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        </View>
      </AnimatedPressable>

      {/* Meta */}
      <View style={styles.expMetaRow}>
        <Text style={styles.expMeta}>Feature: {exp.featureKey}</Text>
        <Text style={styles.expMeta}>{exp.variants.length} variants</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}
          </Text>
        </View>
      </View>

      {/* Variant Bars */}
      {exp.status !== 'draft' && (
        <View style={styles.variantBarContainer}>
          {exp.variants.map(v => {
            const maxUsers = Math.max(...exp.variants.map(vv => vv.assignedUsers), 1);
            const width = (v.assignedUsers / maxUsers) * 100;
            return (
              <View key={v.id} style={styles.variantBarRow}>
                <Text style={styles.variantBarLabel}>{v.name}</Text>
                <View style={styles.variantBarBg}>
                  <View style={[styles.variantBarFill, { width: `${width}%`, backgroundColor: v.color }]} />
                </View>
                <Text style={styles.variantBarValue}>{v.assignedUsers}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Expanded Details */}
      {isSelected && (
        <Animated.View entering={FadeInDown.springify()}>
          {/* Description */}
          <Text style={styles.expDescription}>{exp.description}</Text>

          {/* Metric Snapshot */}
          {exp.status !== 'draft' && (
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{snapshot.totalExposed}</Text>
                <Text style={styles.metricLabel}>Users</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{snapshot.overallConversionRate}%</Text>
                <Text style={styles.metricLabel}>Conversion</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={[styles.metricValue, { color: snapshot.liftOverControl > 0 ? '#00C853' : '#FF5252' }]}>
                  {snapshot.liftOverControl > 0 ? '+' : ''}{snapshot.liftOverControl}%
                </Text>
                <Text style={styles.metricLabel}>Lift</Text>
              </View>
            </View>
          )}

          {/* Variant Details Table */}
          {exp.variants.length > 0 && (
            <View style={styles.variantTable}>
              {exp.variants.map((v, i) => (
                <View key={v.id} style={[styles.variantRow, i < exp.variants.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                  <View style={styles.variantRowLeft}>
                    <View style={[styles.variantColorDot, { backgroundColor: v.color }]} />
                    <View>
                      <Text style={styles.variantRowName}>{v.name}</Text>
                      <Text style={styles.variantRowDesc}>{v.description}</Text>
                    </View>
                  </View>
                  <View style={styles.variantRowRight}>
                    <View style={styles.variantStat}>
                      <Text style={styles.variantStatValue}>{v.assignedUsers}</Text>
                      <Text style={styles.variantStatLabel}>Users</Text>
                    </View>
                    <View style={styles.variantStat}>
                      <Text style={styles.variantStatValue}>{v.conversionRate}%</Text>
                      <Text style={styles.variantStatLabel}>Conv.</Text>
                    </View>
                    {!v.isControl && (
                      <View style={[styles.confidenceBadge, { backgroundColor: v.confidence >= 80 ? '#00C85320' : v.confidence >= 50 ? '#FFC10720' : colors.bgCardLight }]}>
                        <Text style={[styles.confidenceText, { color: v.confidence >= 80 ? '#00C853' : v.confidence >= 50 ? '#FFC107' : colors.textMuted }]}>
                          {v.confidence}%
                        </Text>
                      </View>
                    )}
                    {v.isControl && <Text style={styles.controlLabel}>Control</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Winner Badge */}
          {exp.hasWinner && exp.winnerVariantId && (
            <View style={styles.winnerBanner}>
              <Ionicons name="trophy" size={16} color="#FFC107" />
              <Text style={styles.winnerText}>
                Winner: {exp.variants.find(v => v.id === exp.winnerVariantId)?.name || 'Unknown'}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {availableActions.map(action => (
              <AnimatedPressable
                key={action.key}
                onPress={() => onAction(exp, action.key)}
                haptic="light"
                scaleTo={0.92}
              >
                <View style={[styles.actionBtn, { backgroundColor: action.color + '20' }]}>
                  <Ionicons name={action.icon as any} size={14} color={action.color} />
                  <Text style={[styles.actionBtnText, { color: action.color }]}>{action.label}</Text>
                </View>
              </AnimatedPressable>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Create Experiment Modal ──────────────────────────────────────────────

function CreateExperimentModal({
  visible, onClose, colors, styles,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  styles: any;
}) {
  const { createExperiment } = useABTestStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [featureKey, setFeatureKey] = useState('');
  const [tagsText, setTagsText] = useState('');
  // Default 2 variants: control + variant
  const [variantNames, setVariantNames] = useState<string[]>(['Control', 'Variant A']);
  const [variantDescs, setVariantDescs] = useState<string[]>(['Current behavior', 'New behavior']);
  const [variantColors, setVariantColors] = useState<string[]>(['#6C63FF', '#00C853']);

  const canSubmit = name.trim().length > 0 && featureKey.trim().length > 0 && variantNames.every(n => n.trim().length > 0);

  const handleCreate = () => {
    if (!canSubmit) {
      Alert.alert('Incomplete', 'Please fill in the experiment name, feature key, and all variant names.');
      return;
    }

    const tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);
    const trafficPercent = Math.floor(100 / variantNames.length);

    createExperiment(
      name.trim(),
      description.trim(),
      featureKey.trim(),
      tags,
      variantNames.map((vn, i) => ({
        name: vn.trim(),
        description: variantDescs[i]?.trim() || '',
        trafficPercent: i < variantNames.length - 1 ? trafficPercent : 100 - trafficPercent * (variantNames.length - 1),
        color: variantColors[i] || '#6C63FF',
        isControl: i === 0,
      })),
    );

    onClose();
    // Reset form
    setName('');
    setDescription('');
    setFeatureKey('');
    setTagsText('');
    setVariantNames(['Control', 'Variant A']);
    setVariantDescs(['Current behavior', 'New behavior']);
    setVariantColors(['#6C63FF', '#00C853']);
  };

  const addVariant = () => {
    if (variantNames.length >= 5) {
      Alert.alert('Max Variants', 'Maximum 5 variants per experiment.');
      return;
    }
    setVariantNames(prev => [...prev, `Variant ${String.fromCharCode(65 + prev.length - 1)}`]);
    setVariantDescs(prev => [...prev, '']);
    setVariantColors(prev => [...prev, ['#3B82F6', '#FF9800', '#FF6B6B', '#8B5CF6'][prev.length - 1] || '#6C63FF']);
  };

  const removeVariant = (idx: number) => {
    if (variantNames.length <= 2) return;
    setVariantNames(prev => prev.filter((_, i) => i !== idx));
    setVariantDescs(prev => prev.filter((_, i) => i !== idx));
    setVariantColors(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalContent, { backgroundColor: colors.bgSecondary }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Experiment</Text>
            <AnimatedPressable onPress={onClose} haptic="light" scaleTo={0.88}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </AnimatedPressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
            <Text style={styles.inputLabel}>Experiment Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Home Screen Layout Test"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="What are you testing?"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.inputLabel}>Feature Key</Text>
            <TextInput
              style={[styles.textInput, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}
              placeholder="e.g., home_layout"
              placeholderTextColor={colors.textMuted}
              value={featureKey}
              onChangeText={setFeatureKey}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Tags (comma separated)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., ui, conversion"
              placeholderTextColor={colors.textMuted}
              value={tagsText}
              onChangeText={setTagsText}
            />

            {/* Variants */}
            <View style={styles.variantSectionHeader}>
              <Text style={styles.inputLabel}>Variants ({variantNames.length})</Text>
              {variantNames.length < 5 && (
                <AnimatedPressable onPress={addVariant} haptic="light" scaleTo={0.92}>
                  <View style={styles.addVariantBtn}>
                    <Ionicons name="add" size={14} color={colors.primary} />
                    <Text style={styles.addVariantBtnText}>Add</Text>
                  </View>
                </AnimatedPressable>
              )}
            </View>

            {variantNames.map((vn, idx) => (
              <View key={idx} style={styles.variantFormRow}>
                <View style={styles.variantFormHeader}>
                  <View style={[styles.variantColorDot, { backgroundColor: variantColors[idx] || '#6C63FF' }]} />
                  <Text style={styles.variantFormLabel}>Variant {idx + 1}</Text>
                  {idx > 0 && (
                    <AnimatedPressable onPress={() => removeVariant(idx)} haptic="warning" scaleTo={0.88}>
                      <Ionicons name="close-circle" size={18} color={colors.danger} />
                    </AnimatedPressable>
                  )}
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="Variant name"
                  placeholderTextColor={colors.textMuted}
                  value={vn}
                  onChangeText={(val) => setVariantNames(prev => prev.map((n, i) => i === idx ? val : n))}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Description"
                  placeholderTextColor={colors.textMuted}
                  value={variantDescs[idx] || ''}
                  onChangeText={(val) => setVariantDescs(prev => prev.map((d, i) => i === idx ? val : d))}
                />
              </View>
            ))}
          </ScrollView>

          <AnimatedPressable onPress={handleCreate} haptic="medium" scaleTo={0.97} disabled={!canSubmit}>
            <View style={[styles.submitBtn, !canSubmit && { opacity: 0.5 }]}>
              <Ionicons name="flask" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Create Experiment</Text>
            </View>
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 20 },
  header: { paddingTop: 60, marginBottom: SPACING.lg },
  title: { ...FONTS.bold, fontSize: FONTS.size.title, color: colors.text },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center', borderLeftWidth: 3 },
  statValue: { ...FONTS.bold, fontSize: FONTS.size.xxl, color: colors.text },
  statLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: colors.primary, borderRadius: BORDER_RADIUS.md, paddingVertical: SPACING.lg, marginBottom: SPACING.lg },
  createBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: '#fff' },
  filterRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  filterChipText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: SPACING.md },
  emptyTitle: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.textMuted },
  emptySubtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted, textAlign: 'center' },
  expCard: { backgroundColor: colors.bgCard, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  expHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  expName: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.text, flex: 1 },
  expMetaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  expMeta: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  statusText: { ...FONTS.medium, fontSize: 9 },
  variantBarContainer: { gap: 4, marginTop: SPACING.sm, paddingVertical: SPACING.sm },
  variantBarRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  variantBarLabel: { ...FONTS.regular, fontSize: 10, color: colors.textMuted, width: 80 },
  variantBarBg: { flex: 1, height: 8, backgroundColor: colors.bgCardLight, borderRadius: 4, overflow: 'hidden' },
  variantBarFill: { height: '100%', borderRadius: 4 },
  variantBarValue: { ...FONTS.medium, fontSize: 10, color: colors.textMuted, width: 36, textAlign: 'right' },
  expDescription: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, marginTop: SPACING.sm, lineHeight: 18 },
  metricsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  metricCard: { flex: 1, alignItems: 'center', backgroundColor: colors.bgCardLight, padding: SPACING.sm, borderRadius: BORDER_RADIUS.sm },
  metricValue: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.text },
  metricLabel: { ...FONTS.regular, fontSize: 9, color: colors.textMuted, marginTop: 2 },
  variantTable: { marginTop: SPACING.md, borderRadius: BORDER_RADIUS.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.divider },
  variantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.sm },
  variantRowLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  variantColorDot: { width: 10, height: 10, borderRadius: 5 },
  variantRowName: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text },
  variantRowDesc: { ...FONTS.regular, fontSize: 9, color: colors.textMuted, marginTop: 1 },
  variantRowRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  variantStat: { alignItems: 'center' },
  variantStatValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },
  variantStatLabel: { ...FONTS.regular, fontSize: 8, color: colors.textMuted },
  confidenceBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  confidenceText: { ...FONTS.bold, fontSize: 9 },
  controlLabel: { ...FONTS.regular, fontSize: 9, color: colors.textMuted, fontStyle: 'italic' },
  winnerBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md, padding: SPACING.sm, backgroundColor: '#FFC10715', borderRadius: BORDER_RADIUS.sm },
  winnerText: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: '#FFC107' },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full },
  actionBtnText: { ...FONTS.medium, fontSize: FONTS.size.sm },
  // Modal styles
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, padding: SPACING.xl, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.text },
  inputLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.textSecondary, marginBottom: 6, marginTop: SPACING.md },
  textInput: { backgroundColor: colors.bgCard, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? SPACING.md : SPACING.sm, fontSize: FONTS.size.md, color: colors.text, borderWidth: 1, borderColor: colors.border },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  variantSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addVariantBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: colors.primary + '40', borderStyle: 'dashed' },
  addVariantBtnText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.primary },
  variantFormRow: { marginBottom: SPACING.md, padding: SPACING.sm, backgroundColor: colors.bgCard, borderRadius: BORDER_RADIUS.sm },
  variantFormHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  variantFormLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text, flex: 1 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: colors.primary, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md, marginTop: SPACING.xl },
  submitBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: '#fff' },
});
