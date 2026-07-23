/**
 * ============================================================================
 * Toroloom — Custom Indicator Editor Screen
 * ============================================================================
 *
 * A code-editor-style screen where users write and test custom indicator
 * formulas. Supports syntax highlighting, formula validation, live preview,
 * and save/delete of custom indicators.
 * ============================================================================
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { FONTS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { validateFormula, evaluateFormula } from '../../utils/indicatorFormulaEngine';
import {
  useCustomIndicatorStore,
  PRESET_INDICATORS,
  type CustomIndicator,
} from '../../store/customIndicatorStore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { formatCurrency } from '../../utils/formatters';
import Svg, { Path as SvgPath } from 'react-native-svg';

// ============================================================================
// Mock data for preview
// ============================================================================

function generateMockData(count: number): { close: number; high: number; low: number; open: number; volume: number }[] {
  const data: { close: number; high: number; low: number; open: number; volume: number }[] = [];
  let price = 2500;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 30;
    const newPrice = Math.max(price + change, 100);
    const high = Math.max(price, newPrice) + Math.random() * 10;
    const low = Math.min(price, newPrice) - Math.random() * 10;
    data.push({
      open: price,
      close: newPrice,
      high,
      low: Math.max(low, 50),
      volume: Math.floor(Math.random() * 1000000 + 100000),
    });
    price = newPrice;
  }
  return data;
}

const mockData = generateMockData(200);
const mockCloses = mockData.map(d => d.close);

// ============================================================================
// Color Picker
// ============================================================================

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
  '#E74C3C', '#3498DB', '#2ECC71', '#F39C12',
  '#9B59B6', '#1ABC9C', '#E67E22', '#34495E',
];

function ColorPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (color: string) => void;
}) {
  return (
    <View style={colorStyles.container}>
      {COLORS.map((color) => (
        <Pressable
          key={color}
          style={[
            colorStyles.swatch,
            { backgroundColor: color },
            selected === color && colorStyles.selected,
          ]}
          onPress={() => onSelect(color)}
        />
      ))}
    </View>
  );
}

const colorStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selected: {
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});

// ============================================================================
// Mini Preview Chart
// ============================================================================

function MiniPreview({
  values,
  color,
  height = 60,
}: {
  values: (number | null)[];
  color: string;
  height?: number;
}) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length < 2) {
    return (
      <View style={previewStyles.empty}>
        <Text style={previewStyles.emptyText}>—</Text>
      </View>
    );
  }

  const width = Dimensions.get('window').width - 80;
  const padding = 8;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;
  const mn = Math.min(...valid);
  const mx = Math.max(...valid);
  const range = mx - mn || 1;

  const getX = (i: number) => padding + (i / (values.length - 1)) * chartW;
  const getY = (v: number) => padding + chartH - ((v - mn) / range) * chartH;

  let path = '';
  for (let i = 0; i < values.length; i++) {
    if (values[i] === null) continue;
    const x = getX(i);
    const y = getY(values[i]!);
    path += path ? ` L ${x} ${y}` : `M ${x} ${y}`;
  }

  if (!path) {
    return (
      <View style={previewStyles.empty}>
        <Text style={previewStyles.emptyText}>Not enough data</Text>
      </View>
    );
  }

  return (
    <Svg width={width} height={height}>
      <SvgPath d={path} stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

const previewStyles = StyleSheet.create({
  empty: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'System',
    fontSize: FONTS.size.sm,
    color: '#888',
  },
});

// ============================================================================
// Token Highlighting — colored formula tokens
// ============================================================================

const FUNCTIONS = ['SMA', 'EMA', 'RSI', 'MACD', 'MACD_SIGNAL', 'MACD_HIST',
  'BB_UPPER', 'BB_MIDDLE', 'BB_LOWER', 'CROSSOVER', 'CROSSUNDER',
  'HIGHEST', 'LOWEST', 'STDEV', 'VWAP'];
const FIELDS = ['close', 'open', 'high', 'low', 'volume'];
const OPERATORS = ['>', '<', '>=', '<=', '==', '!=', '+', '-', '*', '/', '?', ':'];

function highlightToken(word: string): { text: string; color: string } {
  const upper = word.toUpperCase();
  if (FUNCTIONS.includes(upper)) return { text: word, color: '#45B7D1' }; // Blue
  if (FIELDS.includes(word)) return { text: word, color: '#82E0AA' }; // Green
  if (OPERATORS.includes(word)) return { text: word, color: '#FF6B6B' }; // Red
  if (!isNaN(Number(word))) return { text: word, color: '#F7DC6F' }; // Yellow
  return { text: word, color: '#FFFFFF' };
}

function tokenizeHighlight(formula: string): { text: string; color: string }[] {
  const tokens: { text: string; color: string }[] = [];
  let current = '';
  let inWord = false;

  for (let i = 0; i < formula.length; i++) {
    const ch = formula[i];
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(highlightToken(current));
        current = '';
      }
      tokens.push({ text: ch, color: '#888' });
      inWord = false;
      continue;
    }
    if ('(),'.includes(ch) || OPERATORS.includes(ch)) {
      if (current) {
        tokens.push(highlightToken(current));
        current = '';
      }
      tokens.push({ text: ch, color: '#DDA0DD' });
      inWord = false;
      continue;
    }
    current += ch;
    inWord = true;
  }
  if (current) {
    tokens.push(highlightToken(current));
  }
  return tokens;
}

// ============================================================================
// Formula Builder — quick-add buttons
// ============================================================================

interface FormulaBuilderProps {
  onInsert: (text: string) => void;
  colors: any;
}

function FormulaBuilder({ onInsert, colors }: FormulaBuilderProps) {
  const buttons = [
    { label: 'close', insert: 'close' },
    { label: 'SMA()', insert: 'SMA(close, 14)' },
    { label: 'EMA()', insert: 'EMA(close, 14)' },
    { label: 'RSI()', insert: 'RSI(close, 14)' },
    { label: 'MACD', insert: 'MACD(close)' },
    { label: 'BB Upper', insert: 'BB_UPPER(close, 20, 2)' },
    { label: '× SMA', insert: ' close * ' },
    { label: '+ SMA', insert: ' + SMA(close, ' },
    { label: '/', insert: ' / ' },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={builderStyles.scroll}>
      {buttons.map((btn) => (
        <Pressable
          key={btn.label}
          style={[builderStyles.chip, {
            backgroundColor: colors.bgInput,
            borderColor: colors.border,
          }]}
          onPress={() => onInsert(btn.insert)}
        >
          <Text style={[builderStyles.chipText, { color: colors.primary }]}>
            {btn.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const builderStyles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    marginBottom: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.xs,
  },
  chipText: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '600',
  },
});

// ============================================================================
// Main Screen
// ============================================================================

export default function CustomIndicatorEditorScreen() {
  const { colors } = useTheme();
  const t = useT();
  const navigation = useNavigation();
  const route = useRoute<any>();

  const existingIndicator = route.params?.indicator as CustomIndicator | undefined;
  const editMode = !!existingIndicator;

  const addIndicator = useCustomIndicatorStore((s) => s.addIndicator);
  const updateIndicator = useCustomIndicatorStore((s) => s.updateIndicator);
  const deleteIndicator = useCustomIndicatorStore((s) => s.deleteIndicator);

  const [formula, setFormula] = useState(existingIndicator?.formula || '');
  const [label, setLabel] = useState(existingIndicator?.label || '');
  const [color, setColor] = useState(existingIndicator?.color || '#45B7D1');
  const [panel, setPanel] = useState<'overlay' | 'separate'>(
    existingIndicator?.panel || 'overlay',
  );
  const [showPresets, setShowPresets] = useState(false);

  // Validation
  const validation = useMemo(() => {
    if (!formula.trim()) return { valid: false, error: 'Enter a formula' };
    return validateFormula(formula.trim());
  }, [formula]);

  // Preview evaluation
  const previewValues = useMemo(() => {
    if (!validation.valid || !formula.trim()) return [];    try {
        const result = evaluateFormula(formula.trim(), mockData as any);
        return result.values;
      } catch {
        return [];
      }
  }, [formula, validation.valid]);

  // Insert text at cursor position
  const insertText = useCallback((text: string) => {
    setFormula((prev) => prev + text);
  }, []);

  // Save
  const handleSave = useCallback(() => {
    if (!validation.valid) {
      Alert.alert('Invalid Formula', validation.error || 'Please fix the formula syntax.');
      return;
    }
    if (!label.trim()) {
      Alert.alert('Missing Label', 'Please enter a name for this indicator.');
      return;
    }

    if (editMode && existingIndicator) {
      updateIndicator(existingIndicator.id, {
        label: label.trim(),
        formula: formula.trim(),
        color,
        panel,
      });
      navigation.goBack();
    } else {
      const id = addIndicator(label.trim(), formula.trim(), color, panel);
      if (id) {
        navigation.goBack();
      } else {
        Alert.alert('Error', 'Failed to save indicator. Check the formula syntax.');
      }
    }
  }, [validation, label, formula, color, panel, editMode, existingIndicator, addIndicator, updateIndicator, navigation]);

  // Delete
  const handleDelete = useCallback(() => {
    if (!existingIndicator) return;
    Alert.alert(
      'Delete Indicator',
      `Delete "${existingIndicator.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteIndicator(existingIndicator.id);
            navigation.goBack();
          },
        },
      ],
    );
  }, [existingIndicator, deleteIndicator, navigation]);

  // Import preset
  const handleImportPreset = useCallback((preset: typeof PRESET_INDICATORS[0]) => {
    setFormula(preset.formula);
    setLabel(preset.label);
    setColor(preset.color);
    setShowPresets(false);
  }, []);

  const highlightedTokens = useMemo(() => tokenizeHighlight(formula), [formula]);

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[screenStyles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={screenStyles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[screenStyles.headerTitle, { color: colors.text }]}>
          {editMode ? 'Edit Indicator' : 'Custom Indicator'}
        </Text>
        <Pressable onPress={() => setShowPresets(!showPresets)} style={screenStyles.presetsBtn}>
          <Ionicons name="bookmark-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={screenStyles.scroll}
        contentContainerStyle={screenStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Presets panel */}
        {showPresets && (
          <View style={[screenStyles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[screenStyles.sectionTitle, { color: colors.text }]}>Preset Formulas</Text>
            <Text style={[screenStyles.sectionDesc, { color: colors.textMuted }]}>
              Choose a built-in formula to get started
            </Text>
            <View style={presetStyles.grid}>
              {PRESET_INDICATORS.map((preset) => (
                <Pressable
                  key={preset.label}
                  style={[presetStyles.card, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                  onPress={() => handleImportPreset(preset)}
                >
                  <View style={[presetStyles.dot, { backgroundColor: preset.color }]} />
                  <Text style={[presetStyles.label, { color: colors.text }]}>{preset.label}</Text>
                  <Text style={[presetStyles.formula, { color: colors.textMuted }]} numberOfLines={2}>
                    {preset.formula}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Formula input */}
        <View style={[screenStyles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[screenStyles.sectionTitle, { color: colors.text }]}>Formula</Text>
          <Text style={[screenStyles.sectionDesc, { color: colors.textMuted }]}>
            Write your indicator formula using close, open, high, low, volume and built-in functions
          </Text>

          {/* Formula builder quick-insert chips */}
          <FormulaBuilder onInsert={insertText} colors={colors} />

          {/* Code editor */}
          <View style={[editorStyles.editor, {
            backgroundColor: colors.bgInput,
            borderColor: validation.valid ? colors.border : '#FF6B6B',
          }]}>
            {/* Syntax highlighted overlay */}
            <View style={editorStyles.highlightLayer} pointerEvents="none">
              <Text style={editorStyles.highlightText}>
                {highlightedTokens.map((token, i) => (
                  <Text key={i} style={{ color: token.color }}>{token.text}</Text>
                ))}
              </Text>
            </View>
            {/* Actual input (transparent text) */}
            <TextInput
              style={[editorStyles.input, { color: 'transparent' }]}
              value={formula}
              onChangeText={setFormula}
              placeholder="e.g. SMA(close, 14)"
              placeholderTextColor="#666"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
            />
          </View>

          {/* Validation feedback */}
          <Text style={[editorStyles.validationText, {
            color: validation.valid ? '#4ECDC4' : '#FF6B6B',
          }]}>
            {validation.valid ? '✓ Valid syntax' : `✗ ${validation.error}`}
          </Text>

          {/* Label */}
          <Text style={[screenStyles.fieldLabel, { color: colors.textSecondary }]}>Indicator Name</Text>
          <TextInput
            style={[editorStyles.labelInput, {
              backgroundColor: colors.bgInput,
              borderColor: colors.border,
              color: colors.text,
            }]}
            value={label}
            onChangeText={setLabel}
            placeholder="My Indicator"
            placeholderTextColor="#666"
          />
        </View>

        {/* Panel type */}
        <View style={[screenStyles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[screenStyles.sectionTitle, { color: colors.text }]}>Display</Text>
          <View style={panelStyles.row}>
            <Pressable
              style={[panelStyles.option, {
                borderColor: panel === 'overlay' ? colors.primary : colors.border,
                backgroundColor: panel === 'overlay' ? colors.primary + '15' : colors.bgInput,
              }]}
              onPress={() => setPanel('overlay')}
            >
              <Ionicons name="layers-outline" size={20}
                color={panel === 'overlay' ? colors.primary : colors.textMuted} />
              <Text style={[panelStyles.optionText, {
                color: panel === 'overlay' ? colors.primary : colors.textMuted,
              }]}>Overlay</Text>
              <Text style={[panelStyles.optionDesc, { color: colors.textSecondary }]}>
                On main chart
              </Text>
            </Pressable>
            <Pressable
              style={[panelStyles.option, {
                borderColor: panel === 'separate' ? colors.primary : colors.border,
                backgroundColor: panel === 'separate' ? colors.primary + '15' : colors.bgInput,
              }]}
              onPress={() => setPanel('separate')}
            >
              <Ionicons name="grid-outline" size={20}
                color={panel === 'separate' ? colors.primary : colors.textMuted} />
              <Text style={[panelStyles.optionText, {
                color: panel === 'separate' ? colors.primary : colors.textMuted,
              }]}>Separate</Text>
              <Text style={[panelStyles.optionDesc, { color: colors.textSecondary }]}>
                Below chart
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Color picker */}
        <View style={[screenStyles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[screenStyles.sectionTitle, { color: colors.text }]}>Line Color</Text>
          <ColorPicker selected={color} onSelect={setColor} />
        </View>

        {/* Preview */}
        {validation.valid && previewValues.length > 0 && (
          <View style={[screenStyles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[screenStyles.sectionTitle, { color: colors.text }]}>Preview</Text>
            <MiniPreview values={previewValues} color={color} />
            {/* Last few values */}
            <View style={valueRowStyles.row}>
              {previewValues.filter((v): v is number => v !== null).slice(-3).map((v, i) => (
                <Text key={i} style={[valueRowStyles.val, { color: colors.text }]}>
                  {formatCurrency(v, true)}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Action buttons */}
        <View style={screenStyles.actions}>
          {/* Save button */}
          <Pressable
            style={[
              screenStyles.saveBtn,
              { backgroundColor: colors.primary, opacity: validation.valid ? 1 : 0.5 },
            ]}
            onPress={handleSave}
            disabled={!validation.valid}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={screenStyles.saveBtnText}>
              {editMode ? 'Update Indicator' : 'Save Indicator'}
            </Text>
          </Pressable>

          {/* Delete button (edit mode only) */}
          {editMode && (
            <Pressable
              style={[screenStyles.deleteBtn, { borderColor: '#FF6B6B' }]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
              <Text style={[screenStyles.deleteBtnText, { color: '#FF6B6B' }]}>Delete</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'System',
    fontSize: FONTS.size.lg,
    fontWeight: '700',
  },
  presetsBtn: {
    padding: SPACING.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  section: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontFamily: 'System',
    fontSize: FONTS.size.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDesc: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '400',
    marginBottom: SPACING.sm,
    lineHeight: 16,
  },
  fieldLabel: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '600',
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  actions: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  saveBtnText: {
    fontFamily: 'System',
    fontSize: FONTS.size.md,
    fontWeight: '700',
    color: '#fff',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontFamily: 'System',
    fontSize: FONTS.size.sm,
    fontWeight: '600',
  },
});

const editorStyles = StyleSheet.create({
  editor: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    minHeight: 100,
    overflow: 'hidden',
  },
  highlightLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACING.sm + 2,
  },
  highlightText: {
    fontFamily: 'monospace',
    fontSize: FONTS.size.sm,
    lineHeight: 20,
  },
  input: {
    fontFamily: 'monospace',
    fontSize: FONTS.size.sm,
    lineHeight: 20,
    minHeight: 100,
    padding: SPACING.sm + 2,
    textAlignVertical: 'top',
  },
  validationText: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  labelInput: {
    fontFamily: 'System',
    fontSize: FONTS.size.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm + 2,
    marginTop: 4,
  },
});

const panelStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  option: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  optionText: {
    fontFamily: 'System',
    fontSize: FONTS.size.sm,
    fontWeight: '700',
  },
  optionDesc: {
    fontFamily: 'System',
    fontSize: FONTS.size.xs,
  },
});

const presetStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  card: {
    width: '48%',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontFamily: 'System',
    fontSize: FONTS.size.sm,
    fontWeight: '700',
  },
  formula: {
    fontFamily: 'monospace',
    fontSize: FONTS.size.xs,
  },
});

const valueRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  val: {
    fontFamily: 'System',
    fontSize: FONTS.size.sm,
    fontWeight: '700',
  },
});
