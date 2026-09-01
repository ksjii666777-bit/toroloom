/**
 * ============================================================================
 * Toroloom — Drawing Templates Component
 * ============================================================================
 *
 * UI for selecting and applying pre-built drawing templates:
 *   - Support/Resistance
 *   - Fibonacci Retracement
 *   - Trend Channel
 *   - Pivot Points
 *   - VWAP Bands
 *   - Gap Levels
 *   - Custom user templates
 *
 * ============================================================================
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { useDrawingTemplatesStore, type DrawingTemplate } from '../../store/drawingTemplatesStore';
import type { DrawingAnnotation } from './DrawingTools';

// ── Types ──────────────────────────────────────────────────────────────────

interface DrawingTemplatesProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Close the modal */
  onClose: () => void;
  /** Current spot price for template calculations */
  spotPrice: number;
  /** Callback when a template is applied */
  onApplyTemplate: (drawings: DrawingAnnotation[]) => void;
  /** Current drawings (for saving as template) */
  currentDrawings?: DrawingAnnotation[];
}

// ── Template Card ──────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onPress,
  onDelete,
  colors,
  styles,
}: {
  template: DrawingTemplate;
  onPress: () => void;
  onDelete?: () => void;
  colors: any;
  styles: any;
}) {
  const isPreset = template.category === 'preset';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.templateCard,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
        },
        { opacity: pressed ? 0.7 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.templateHeader}>
        <View style={[styles.templateIcon, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.templateIconText, { color: colors.primary }]}>
            {template.icon}
          </Text>
        </View>
        <View style={styles.templateInfo}>
          <Text style={[styles.templateName, { color: colors.text }]} numberOfLines={1}>
            {template.name}
          </Text>
          <Text style={[styles.templateDesc, { color: colors.textMuted }]} numberOfLines={2}>
            {template.description}
          </Text>
        </View>
        {isPreset && (
          <View style={[styles.presetBadge, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.presetBadgeText, { color: colors.primary }]}>Built-in</Text>
          </View>
        )}
      </View>

      <View style={styles.templateFooter}>
        <Text style={[styles.templateDrawings, { color: colors.textMuted }]}>
          {template.drawings.length} drawing{template.drawings.length !== 1 ? 's' : ''}
        </Text>
        {!isPreset && onDelete && (
          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}
            onPress={(e) => {
              e.stopPropagation?.();
              onDelete();
            }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.marketDown} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function DrawingTemplates({
  visible,
  onClose,
  spotPrice,
  onApplyTemplate,
  currentDrawings = [],
}: DrawingTemplatesProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    applyTemplate,
    saveAsTemplate,
    deleteTemplate,
    getTemplatesByCategory,
  } = useDrawingTemplatesStore();

  const [activeTab, setActiveTab] = useState<'preset' | 'custom'>('preset');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  const presetTemplates = useMemo(() => getTemplatesByCategory('preset'), [getTemplatesByCategory]);
  const customTemplates = useMemo(() => getTemplatesByCategory('custom'), [getTemplatesByCategory]);

  const handleApplyTemplate = useCallback((templateId: string) => {
    const drawings = applyTemplate(templateId, spotPrice);
    if (drawings.length > 0) {
      onApplyTemplate(drawings);
      onClose();
    }
  }, [applyTemplate, spotPrice, onApplyTemplate, onClose]);

  const handleSaveAsTemplate = useCallback(() => {
    if (!templateName.trim()) {
      Alert.alert('Error', 'Please enter a template name');
      return;
    }

    if (currentDrawings.length === 0) {
      Alert.alert('Error', 'No drawings to save. Draw some lines first!');
      return;
    }

    saveAsTemplate(templateName.trim(), templateDescription.trim(), currentDrawings);
    setShowSaveModal(false);
    setTemplateName('');
    setTemplateDescription('');
    Alert.alert('Saved!', `Template "${templateName}" created successfully`);
  }, [templateName, templateDescription, currentDrawings, saveAsTemplate]);

  const handleDeleteTemplate = useCallback((templateId: string, name: string) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTemplate(templateId),
        },
      ],
    );
  }, [deleteTemplate]);

  const displayedTemplates = activeTab === 'preset' ? presetTemplates : customTemplates;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
        <View style={[styles.container, { backgroundColor: colors.bgSecondary }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('charts.templates') || 'Drawing Templates'}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Tab Selector */}
          <View style={[styles.tabBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Pressable
              style={[styles.tab, activeTab === 'preset' && styles.tabActive]}
              onPress={() => setActiveTab('preset')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'preset' ? colors.primary : colors.textMuted }]}>
                Built-in ({presetTemplates.length})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'custom' && styles.tabActive]}
              onPress={() => setActiveTab('custom')}
            >
              <Text style={[styles.tabText, { color: activeTab === 'custom' ? colors.primary : colors.textMuted }]}>
                My Templates ({customTemplates.length})
              </Text>
            </Pressable>
          </View>

          {/* Templates List */}
          <ScrollView
            style={styles.templateList}
            contentContainerStyle={styles.templateListContent}
            showsVerticalScrollIndicator={false}
          >
            {displayedTemplates.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="folder-open-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {activeTab === 'preset' ? 'No Built-in Templates' : 'No Custom Templates'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  {activeTab === 'preset'
                    ? 'Templates will appear here'
                    : 'Save your current drawings as a template'}
                </Text>
              </View>
            ) : (
              displayedTemplates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onPress={() => handleApplyTemplate(template.id)}
                  onDelete={
                    template.category === 'custom'
                      ? () => handleDeleteTemplate(template.id, template.name)
                      : undefined
                  }
                  colors={colors}
                  styles={styles}
                />
              ))
            )}
          </ScrollView>

          {/* Save Current Drawings Button */}
          {currentDrawings.length > 0 && (
            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowSaveModal(true)}
            >
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={[styles.saveBtnText, { color: '#fff' }]}>
                Save Current ({currentDrawings.length} drawings)
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Save Template Modal */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
          <View style={[styles.saveModal, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <Text style={[styles.saveModalTitle, { color: colors.text }]}>
              Save as Template
            </Text>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.bgCard, borderColor: colors.border }]}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="e.g., My Support Levels"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Description (optional)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.bgCard, borderColor: colors.border }]}
              value={templateDescription}
              onChangeText={setTemplateDescription}
              placeholder="e.g., Key support levels for RELIANCE"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.saveModalActions}>
              <Pressable
                style={[styles.saveModalBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                onPress={() => {
                  setShowSaveModal(false);
                  setTemplateName('');
                  setTemplateDescription('');
                }}
              >
                <Text style={[styles.saveModalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveModalBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveAsTemplate}
              >
                <Text style={[styles.saveModalBtnText, { color: '#fff' }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    container: {
      borderTopLeftRadius: BORDER_RADIUS.xxl,
      borderTopRightRadius: BORDER_RADIUS.xxl,
      maxHeight: '80%',
      paddingBottom: 40,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: SPACING.xl,
      paddingBottom: SPACING.md,
    },
    title: {
      ...FONTS.bold,
      fontSize: FONTS.size.xl,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bgCard,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabBar: {
      flexDirection: 'row',
      marginHorizontal: SPACING.xl,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: 3,
      marginBottom: SPACING.md,
    },
    tab: {
      flex: 1,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: colors.primary + '20',
    },
    tabText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
    },
    templateList: {
      flex: 1,
    },
    templateListContent: {
      paddingHorizontal: SPACING.xl,
      gap: SPACING.sm,
    },
    templateCard: {
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: SPACING.lg,
    },
    templateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    templateIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    templateIconText: {
      fontSize: 20,
      fontWeight: '700',
    },
    templateInfo: {
      flex: 1,
    },
    templateName: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
    },
    templateDesc: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      marginTop: 2,
    },
    presetBadge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
      borderRadius: BORDER_RADIUS.sm,
    },
    presetBadgeText: {
      ...FONTS.medium,
      fontSize: 10,
    },
    templateFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: SPACING.sm,
    },
    templateDrawings: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
      gap: SPACING.sm,
    },
    emptyTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.lg,
    },
    emptySubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      textAlign: 'center',
      maxWidth: 250,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.xl,
      marginTop: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.full,
    },
    saveBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
    },
    // Save Modal
    saveModal: {
      margin: SPACING.xl,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.xl,
    },
    saveModalTitle: {
      ...FONTS.bold,
      fontSize: FONTS.size.lg,
      marginBottom: SPACING.xl,
    },
    inputLabel: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
      marginBottom: SPACING.sm,
    },
    input: {
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.lg,
      ...FONTS.regular,
      fontSize: FONTS.size.md,
    },
    saveModalActions: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    saveModalBtn: {
      flex: 1,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
    },
    saveModalBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
    },
  });
