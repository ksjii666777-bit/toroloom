/**
 * ============================================================================
 * Toroloom — Stock Screener Screen
 * ============================================================================
 *
 * Advanced multi-filter stock screener:
 *   - Price range slider
 *   - P/E ratio range
 *   - Market cap category (Large/Mid/Small)
 *   - Dividend yield minimum
 *   - Sector selector
 *   - Day change range
 *   - Real-time result count
 *   - Clear all filters
 * ============================================================================
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  Modal,
  Share,
} from 'react-native';
import Animated from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoSharing from 'expo-sharing';
import { writeAsStringAsync, cacheDirectory, EncodingType } from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useMarketStore, getMarketCapCategory, parseMarketCap, type ScreenerFilters } from '../../store/marketStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import StockItem from '../../components/StockItem';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { useStaggeredAnimation } from '../../hooks/useStaggeredAnimation';

const { width } = Dimensions.get('window');


const SECTORS = ['All', 'Technology', 'Finance', 'Energy', 'Consumer', 'Automobile', 'Telecom'];
const MARKET_CAP_OPTIONS = [
  { value: 'all' as const, label: 'All', icon: 'globe' as const },
  { value: 'large' as const, label: 'Large Cap', icon: 'business' as const },
  { value: 'mid' as const, label: 'Mid Cap', icon: 'trending-up' as const },
  { value: 'small' as const, label: 'Small Cap', icon: 'rocket' as const },
];

const PRESET_PRICES = [
  { label: 'Under ₹100', min: 0, max: 100 },
  { label: '₹100–₹500', min: 100, max: 500 },
  { label: '₹500–₹2,000', min: 500, max: 2000 },
  { label: '₹2,000+', min: 2000, max: 100000 },
];

const PRESET_PE = [
  { label: 'Under 15', min: 0, max: 15 },
  { label: '15–30', min: 15, max: 30 },
  { label: '30–50', min: 30, max: 50 },
  { label: '50+', min: 50, max: 1000 },
];

const PRESET_CHANGE = [
  { label: 'Gainers', min: 0, max: 100 },
  { label: 'Losers', min: -100, max: 0 },
  { label: 'Movers >2%', min: -100, max: -2 },
  { label: 'Movers >2%', min: 2, max: 100 },
];

const SORT_OPTIONS = [
  { key: 'symbol', label: 'Symbol', icon: 'text' as const },
  { key: 'price', label: 'Price', icon: 'cash' as const },
  { key: 'changePercent', label: 'Change%', icon: 'trending-up' as const },
  { key: 'pe', label: 'P/E', icon: 'calculator' as const },
  { key: 'dividend', label: 'Dividend', icon: 'gift' as const },
  { key: 'marketCap', label: 'Mkt Cap', icon: 'business' as const },
];

interface FilterSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  color?: string;
}

function FilterSection({ title, icon, children, color }: FilterSectionProps) {
  const { colors } = useTheme();
  return (
    <View style={[sFilterSection.container, { borderColor: colors.border }]}>
      <View style={sFilterSection.header}>
        <Ionicons name={icon as any} size={18} color={color || colors.primary} />
        <Text style={[sFilterSection.title, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const sFilterSection = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  title: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
  },
});

interface RangeInputProps {
  label: string;
  minValue: string;
  maxValue: string;
  onMinChange: (val: string) => void;
  onMaxChange: (val: string) => void;
  placeholder?: string;
}

function RangeInput({ label, minValue, maxValue, onMinChange, onMaxChange, placeholder = '0' }: RangeInputProps) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={[sRange.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={sRange.row}>
        <View style={[sRange.inputWrap, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <TextInput
            style={[sRange.input, { color: colors.text }]}
            value={minValue}
            onChangeText={onMinChange}
            keyboardType="numeric"
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <Text style={[sRange.separator, { color: colors.textMuted }]}>to</Text>
        <View style={[sRange.inputWrap, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <TextInput
            style={[sRange.input, { color: colors.text }]}
            value={maxValue}
            onChangeText={onMaxChange}
            keyboardType="numeric"
            placeholder="100000"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>
    </View>
  );
}

const sRange = StyleSheet.create({
  label: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  inputWrap: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
  },
  input: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    paddingVertical: SPACING.sm,
    fontFamily: 'System',
  },
  separator: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
});

interface ChipRowProps {
  options: { label: string; value: string; icon?: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

function ChipRow({ options, selectedValue, onSelect }: ChipRowProps) {
  const { colors } = useTheme();
  return (
    <View style={sChip.row}>
      {options.map(opt => {
        const isActive = selectedValue === opt.value;
        return (
          <AnimatedPressable
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            haptic="selection"
            scaleTo={0.95}
          >
            <View style={[
              sChip.chip,
              { backgroundColor: colors.bgCard, borderColor: colors.border },
              isActive && { backgroundColor: colors.primary + '25', borderColor: colors.primary },
            ]}>
              {opt.icon && (
                <Ionicons
                  name={opt.icon as any}
                  size={14}
                  color={isActive ? colors.primary : colors.textMuted}
                />
              )}
              <Text style={[
                sChip.label,
                { color: colors.textSecondary },
                isActive && { color: colors.primary },
              ]}>
                {opt.label}
              </Text>
            </View>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const sChip = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  label: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
});

interface PresetChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function PresetChip({ label, isActive, onPress }: PresetChipProps) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable onPress={onPress} haptic="light" scaleTo={0.95}>
      <View style={[
        sPreset.chip,
        { backgroundColor: colors.bgCard, borderColor: colors.border },
        isActive && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
      ]}>
        <Text style={[
          sPreset.label,
          { color: colors.textSecondary },
          isActive && { color: colors.primary },
        ]}>
          {label}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const sModal = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  title: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: FONTS.size.lg,
  },
  subtitle: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: FONTS.size.sm,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  inputWrap: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  input: {
    fontFamily: 'System',
    fontWeight: '500',
    fontSize: FONTS.size.md,
    paddingVertical: SPACING.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: FONTS.size.sm,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
  },
  saveText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: FONTS.size.sm,
    color: '#FFFFFF',
  },
});

const sExport = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
  },
  sheet: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151',
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: FONTS.size.xl,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: FONTS.size.xs,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: SPACING.xxl,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
    opacity: 1,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: FONTS.size.sm,
  },
  optionDesc: {
    fontFamily: 'System',
    fontWeight: '400',
    fontSize: FONTS.size.xs,
    marginTop: 2,
  },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  cancelText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: FONTS.size.sm,
  },
});

const sPreset = StyleSheet.create({
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  label: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
});

const STORAGE_KEY_SAVED_FILTERS = 'toroloom_saved_filters';

interface SavedFilterPreset {
  id: string;
  name: string;
  filters: ScreenerFilters;
  createdAt: number;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export default function StockScreenerScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    stocks,
    screenerFilters,
    screenerResults,
    isScreenerVisible,
    setScreenerFilters,
    applyScreener,
    resetScreenerFilters,
  } = useMarketStore();

  const [priceMinStr, setPriceMinStr] = useState(String(screenerFilters.priceMin || ''));
  const [priceMaxStr, setPriceMaxStr] = useState(String(screenerFilters.priceMax === 100000 ? '' : screenerFilters.priceMax || ''));
  const [peMinStr, setPeMinStr] = useState(String(screenerFilters.peMin || ''));
  const [peMaxStr, setPeMaxStr] = useState(String(screenerFilters.peMax === 1000 ? '' : screenerFilters.peMax || ''));
  const [dividendStr, setDividendStr] = useState(String(screenerFilters.dividendMin || ''));
  const [dayChangeMinStr, setDayChangeMinStr] = useState(String(screenerFilters.dayChangeMin === -100 ? '' : screenerFilters.dayChangeMin || ''));
  const [dayChangeMaxStr, setDayChangeMaxStr] = useState(String(screenerFilters.dayChangeMax === 100 ? '' : screenerFilters.dayChangeMax || ''));

  // Active preset tracking
  const [activePricePreset, setActivePricePreset] = useState<number | null>(null);
  const [activePePreset, setActivePePreset] = useState<number | null>(null);

  // ── Sort state ──
  const [sortBy, setSortBy] = useState<string>('symbol');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Export state ──
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [isExporting, setIsExporting] = useState<'csv' | 'text' | null>(null);

  // ── Saved Filters state ──
  const [savedPresets, setSavedPresets] = useState<SavedFilterPreset[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [showSavedSection, setShowSavedSection] = useState(false);

  // Load saved presets on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_SAVED_FILTERS);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setSavedPresets(parsed);
          }
        }
      } catch {
        // Storage failure — silently continue
      }
    })();
  }, []);

  // Persist saved presets whenever they change
  const persistPresets = useCallback(async (presets: SavedFilterPreset[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_SAVED_FILTERS, JSON.stringify(presets));
    } catch {
      // Storage write failure — silently continue
    }
  }, []);

  // Build a ScreenerFilters object from current inputs
  const getCurrentFilterValues = useCallback((): ScreenerFilters => ({
    priceMin: parseFloat(priceMinStr) || 0,
    priceMax: parseFloat(priceMaxStr) || 100000,
    peMin: parseFloat(peMinStr) || 0,
    peMax: parseFloat(peMaxStr) || 1000,
    marketCapCategory: screenerFilters.marketCapCategory,
    dividendMin: parseFloat(dividendStr) || 0,
    sector: screenerFilters.sector,
    dayChangeMin: parseFloat(dayChangeMinStr) || -100,
    dayChangeMax: parseFloat(dayChangeMaxStr) || 100,
  }), [priceMinStr, priceMaxStr, peMinStr, peMaxStr, dividendStr, dayChangeMinStr, dayChangeMaxStr, screenerFilters.sector, screenerFilters.marketCapCategory]);

  const openSaveModal = useCallback(() => {
    setPresetNameInput('');
    setShowSaveModal(true);
  }, []);

  const handleSavePreset = useCallback(() => {
    const name = presetNameInput.trim();
    if (!name) return;
    const newPreset: SavedFilterPreset = {
      id: generateId(),
      name,
      filters: getCurrentFilterValues(),
      createdAt: Date.now(),
    };
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    persistPresets(updated);
    setShowSaveModal(false);
    setPresetNameInput('');
    setShowSavedSection(true);
  }, [presetNameInput, savedPresets, getCurrentFilterValues, persistPresets]);

  const handleDeletePreset = useCallback(async (id: string) => {
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    persistPresets(updated);
  }, [savedPresets, persistPresets]);

  const handleApplyPreset = useCallback((preset: SavedFilterPreset) => {
    const f = preset.filters;
    setPriceMinStr(String(f.priceMin || ''));
    setPriceMaxStr(f.priceMax >= 100000 ? '' : String(f.priceMax || ''));
    setPeMinStr(String(f.peMin || ''));
    setPeMaxStr(f.peMax >= 1000 ? '' : String(f.peMax || ''));
    setDividendStr(String(f.dividendMin || ''));
    setDayChangeMinStr(f.dayChangeMin <= -100 ? '' : String(f.dayChangeMin || ''));
    setDayChangeMaxStr(f.dayChangeMax >= 100 ? '' : String(f.dayChangeMax || ''));
    setActivePricePreset(null);
    setActivePePreset(null);
    setScreenerFilters({
      sector: f.sector,
      marketCapCategory: f.marketCapCategory,
      priceMin: f.priceMin,
      priceMax: f.priceMax,
      peMin: f.peMin,
      peMax: f.peMax,
      dividendMin: f.dividendMin,
      dayChangeMin: f.dayChangeMin,
      dayChangeMax: f.dayChangeMax,
    });
  }, [setScreenerFilters]);

  const confirmDeletePreset = useCallback((preset: SavedFilterPreset) => {
    Alert.alert(
      'Delete Preset',
      `Remove "${preset.name}" from saved filters?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeletePreset(preset.id) },
      ]
    );
  }, [handleDeletePreset]);

  // Sorted results for display
  const sortedResults = useMemo(() => {
    const results = screenerResults.length > 0 ? [...screenerResults] : [];
    results.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'price': cmp = a.price - b.price; break;
        case 'changePercent': cmp = a.changePercent - b.changePercent; break;
        case 'pe': cmp = a.pe - b.pe; break;
        case 'dividend': cmp = a.dividend - b.dividend; break;
        case 'marketCap': cmp = parseMarketCap(a.marketCap) - parseMarketCap(b.marketCap); break;
        case 'symbol':
        default: cmp = a.symbol.localeCompare(b.symbol); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return results;
  }, [screenerResults, sortBy, sortDir]);

  const handleSort = useCallback((key: string) => {
    setSortBy(prev => {
      if (prev === key) {
        setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('desc');
      return key;
    });
  }, []);

  // Compute filtered results live as filters change
  const liveResults = useMemo(() => {
    const priceMin = parseFloat(priceMinStr) || 0;
    const priceMax = parseFloat(priceMaxStr) || 100000;
    const peMin = parseFloat(peMinStr) || 0;
    const peMax = parseFloat(peMaxStr) || 1000;
    const divMin = parseFloat(dividendStr) || 0;
    const dMin = parseFloat(dayChangeMinStr) || -100;
    const dMax = parseFloat(dayChangeMaxStr) || 100;

    return stocks.filter(s => {
      if (s.price < priceMin || s.price > priceMax) return false;
      if (s.pe < peMin || s.pe > peMax) return false;
      if (s.dividend < divMin) return false;
      if (s.changePercent < dMin || s.changePercent > dMax) return false;
      if (screenerFilters.sector !== 'All' && s.sector !== screenerFilters.sector) return false;
      if (screenerFilters.marketCapCategory !== 'all') {
        const cat = getMarketCapCategory(s.marketCap);
        if (cat !== screenerFilters.marketCapCategory) return false;
      }
      return true;
    });
  }, [stocks, priceMinStr, priceMaxStr, peMinStr, peMaxStr, dividendStr, dayChangeMinStr, dayChangeMaxStr, screenerFilters.sector, screenerFilters.marketCapCategory]);

  const { animatedStyles: resultStyles } = useStaggeredAnimation(screenerResults.length, {
    initialDelay: 100,
    staggerDelay: 50,
    duration: 350,
  });

  const handlePricePreset = useCallback((index: number, preset: typeof PRESET_PRICES[0]) => {
    setActivePricePreset(index);
    setPriceMinStr(String(preset.min));
    setPriceMaxStr(preset.max >= 100000 ? '' : String(preset.max));
  }, []);

  const handlePePreset = useCallback((index: number, preset: typeof PRESET_PE[0]) => {
    setActivePePreset(index);
    setPeMinStr(String(preset.min));
    setPeMaxStr(preset.max >= 1000 ? '' : String(preset.max));
  }, []);

  const handleApplyFilters = useCallback(() => {
    setScreenerFilters({
      priceMin: parseFloat(priceMinStr) || 0,
      priceMax: parseFloat(priceMaxStr) || 100000,
      peMin: parseFloat(peMinStr) || 0,
      peMax: parseFloat(peMaxStr) || 1000,
      dividendMin: parseFloat(dividendStr) || 0,
      dayChangeMin: parseFloat(dayChangeMinStr) || -100,
      dayChangeMax: parseFloat(dayChangeMaxStr) || 100,
    });
    applyScreener();
    Keyboard.dismiss();
  }, [priceMinStr, priceMaxStr, peMinStr, peMaxStr, dividendStr, dayChangeMinStr, dayChangeMaxStr, setScreenerFilters, applyScreener]);

  const handleClearAll = useCallback(() => {
    setPriceMinStr('');
    setPriceMaxStr('');
    setPeMinStr('');
    setPeMaxStr('');
    setDividendStr('');
    setDayChangeMinStr('');
    setDayChangeMaxStr('');
    setActivePricePreset(null);
    setActivePePreset(null);
    resetScreenerFilters();
  }, [resetScreenerFilters]);

  // ── Export helpers ──

  /** Build a CSV string from sorted results */
  const buildCSVString = useCallback((): string => {
    const header = 'Symbol,Name,Price,Change %,P/E,Dividend %,Market Cap,Sector\n';
    const rows = sortedResults.map(s => {
      const change = `${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%`;
      return `${s.symbol},"${s.name}",${s.price},${change},${s.pe},${s.dividend},"${s.marketCap}",${s.sector}`;
    }).join('\n');
    return header + rows;
  }, [sortedResults]);

  /** Build a formatted text summary from sorted results */
  const buildTextSummary = useCallback((): string => {
    const count = sortedResults.length;
    const header = `📊 Toroloom Stock Screener Results\n${count} stock${count !== 1 ? 's' : ''} found\n\n`;
    const separator = '─'.repeat(60) + '\n';
    const cols = 'Symbol       Price    Change%   P/E      Div%     Sector\n';
    const rows = sortedResults.map(s => {
      const changeStr = `${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%`;
      return `${s.symbol.padEnd(12)}₹${s.price.toFixed(2).padStart(7)} ${changeStr.padStart(7)}  ${s.pe.toFixed(1).padStart(5)}  ${s.dividend.toFixed(2).padStart(5)}  ${s.sector}`;
    }).join('\n');
    return header + separator + cols + separator + rows + '\n' + separator;
  }, [sortedResults]);

  const handleExportCSV = useCallback(async () => {
    setIsExporting('csv');
    try {
      const csv = buildCSVString();
      const filename = `Toroloom_Screener_${Date.now()}.csv`;
      const filePath = `${cacheDirectory ?? '.'}/${filename}`;
      await writeAsStringAsync(filePath, csv, { encoding: EncodingType.UTF8 });
      if (await ExpoSharing.isAvailableAsync()) {
        await ExpoSharing.shareAsync(filePath, { mimeType: 'text/csv' });
      } else {
        Alert.alert('Sharing Unavailable', 'CSV sharing is not available on this device.');
      }
    } catch (err: unknown) {
      Alert.alert('Export Failed', err instanceof Error ? err.message : 'Could not export CSV');
    } finally {
      setIsExporting(null);
      setShowExportSheet(false);
    }
  }, [buildCSVString]);

  const handleExportText = useCallback(async () => {
    setIsExporting('text');
    try {
      const text = buildTextSummary();
      await Share.share({ message: text, title: 'Stock Screener Results' });
    } catch {
      // User cancelled or it failed — silently handle
    } finally {
      setIsExporting(null);
      setShowExportSheet(false);
    }
  }, [buildTextSummary]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (parseFloat(priceMinStr) > 0 || parseFloat(priceMaxStr) > 0 && parseFloat(priceMaxStr) < 100000) count++;
    if (parseFloat(peMinStr) > 0 || parseFloat(peMaxStr) > 0 && parseFloat(peMaxStr) < 1000) count++;
    if (parseFloat(dividendStr) > 0) count++;
    if (screenerFilters.sector !== 'All') count++;
    if (screenerFilters.marketCapCategory !== 'all') count++;
    if (parseFloat(dayChangeMinStr) > -100 || parseFloat(dayChangeMaxStr) < 100) count++;
    return count;
  }, [priceMinStr, priceMaxStr, peMinStr, peMaxStr, dividendStr, screenerFilters.sector, screenerFilters.marketCapCategory, dayChangeMinStr, dayChangeMaxStr]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Stock Screener</Text>
          <Text style={styles.subtitle}>Filter stocks by multiple criteria</Text>
        </View>
        {activeFilterCount > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Filter Sections ── */}
        <View style={styles.filtersCard}>

          {/* Price Range */}
          <FilterSection title="Price Range" icon="cash-outline" color={colors.marketUp}>
            <RangeInput
              label="Min – Max Price (₹)"
              minValue={priceMinStr}
              maxValue={priceMaxStr}
              onMinChange={setPriceMinStr}
              onMaxChange={setPriceMaxStr}
              placeholder="0"
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm }}>
              {PRESET_PRICES.map((preset, i) => (
                <PresetChip
                  key={i}
                  label={preset.label}
                  isActive={activePricePreset === i}
                  onPress={() => handlePricePreset(i, preset)}
                />
              ))}
            </View>
          </FilterSection>

          {/* P/E Ratio */}
          <FilterSection title="P/E Ratio" icon="calculator-outline" color={colors.primary}>
            <RangeInput
              label="Min – Max P/E"
              minValue={peMinStr}
              maxValue={peMaxStr}
              onMinChange={setPeMinStr}
              onMaxChange={setPeMaxStr}
              placeholder="0"
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm }}>
              {PRESET_PE.map((preset, i) => (
                <PresetChip
                  key={i}
                  label={preset.label}
                  isActive={activePePreset === i}
                  onPress={() => handlePePreset(i, preset)}
                />
              ))}
            </View>
          </FilterSection>

          {/* Day Change */}
          <FilterSection title="Day Change %" icon="trending-up-outline" color={colors.warning}>
            <RangeInput
              label="Min – Max Change %"
              minValue={dayChangeMinStr}
              maxValue={dayChangeMaxStr}
              onMinChange={setDayChangeMinStr}
              onMaxChange={setDayChangeMaxStr}
              placeholder="-100"
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm }}>
              {PRESET_CHANGE.map((preset, i) => (
                <PresetChip
                  key={i}
                  label={preset.label}
                  isActive={dayChangeMinStr === String(preset.min) && dayChangeMaxStr === String(preset.max)}
                  onPress={() => {
                    setDayChangeMinStr(String(preset.min));
                    setDayChangeMaxStr(String(preset.max));
                  }}
                />
              ))}
            </View>
          </FilterSection>

          {/* Dividend Yield */}
          <FilterSection title="Dividend Yield" icon="gift-outline" color={colors.accent}>
            <RangeInput
              label="Minimum Dividend %"
              minValue={dividendStr}
              maxValue={dividendStr}
              onMinChange={setDividendStr}
              onMaxChange={setDividendStr}
              placeholder="0"
            />
          </FilterSection>

          {/* Sector */}
          <FilterSection title="Sector" icon="grid-outline" color="#8B5CF6">
            <ChipRow
              options={SECTORS.map(s => ({ label: s, value: s }))}
              selectedValue={screenerFilters.sector}
              onSelect={(val) => setScreenerFilters({ sector: val })}
            />
          </FilterSection>

          {/* Market Cap Category */}
          <FilterSection title="Market Cap" icon="business-outline" color="#06B6D4">
            <ChipRow
              options={MARKET_CAP_OPTIONS.map(o => ({ label: o.label, value: o.value, icon: o.icon }))}
              selectedValue={screenerFilters.marketCapCategory}
              onSelect={(val) => setScreenerFilters({ marketCapCategory: val as any })}
            />
          </FilterSection>
        </View>

        {/* ── Live Preview Count ── */}
        <View style={styles.previewBar}>
          <Text style={styles.previewText}>
            {liveResults.length} stock{liveResults.length !== 1 ? 's' : ''} match current filters
          </Text>
          <Text style={styles.previewHint}>
            {activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active` : 'No filters applied'}
          </Text>
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.clearAllBtn, { borderColor: colors.border }]} onPress={handleClearAll}>
            <Ionicons name="refresh" size={18} color={colors.textSecondary} />
            <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.saveBtn, { borderColor: colors.border }]} onPress={openSaveModal}>
            <Ionicons name="bookmark-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.applyBtn]} onPress={handleApplyFilters}>
            <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.applyGradient}>
              <Ionicons name="search" size={18} color="#FFF" />
              <Text style={styles.applyText}>Show Results ({liveResults.length})</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Saved Presets Section ── */}
        {savedPresets.length > 0 && (
          <View style={[styles.filtersCard, { marginBottom: SPACING.lg }]}>
            <TouchableOpacity
              style={styles.savedSectionHeader}
              onPress={() => setShowSavedSection(!showSavedSection)}
            >
              <View style={styles.savedSectionHeaderLeft}>
                <Ionicons name="bookmarks" size={16} color={colors.primary} />
                <Text style={[styles.savedSectionTitle, { color: colors.text }]}>
                  Saved Filters
                </Text>
                <View style={[styles.savedCountBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.savedCountText, { color: colors.primary }]}>{savedPresets.length}</Text>
                </View>
              </View>
              <Ionicons
                name={showSavedSection ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            {showSavedSection && (
              <View style={{ marginTop: SPACING.md }}>
                {savedPresets.map(preset => (
                  <View
                    key={preset.id}
                    style={[styles.savedPresetRow, { borderColor: colors.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.savedPresetName, { color: colors.text }]}>{preset.name}</Text>
                      <Text style={[styles.savedPresetMeta, { color: colors.textMuted }]}>
                        {new Date(preset.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.savedPresetAction, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}
                      onPress={() => handleApplyPreset(preset)}
                    >
                      <Ionicons name="cloud-download-outline" size={14} color={colors.primary} />
                      <Text style={[styles.savedPresetActionText, { color: colors.primary }]}>Load</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.savedPresetDeleteBtn, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' }]}
                      onPress={() => confirmDeletePreset(preset)}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Sort Options ── */}
        {screenerResults.length > 0 && (
          <View style={styles.sortSection}>
            <View style={styles.sortHeader}>
              <Ionicons name="swap-vertical" size={14} color={colors.textMuted} />
              <Text style={[styles.sortLabel, { color: colors.textMuted }]}>Sort by</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll}>
              {SORT_OPTIONS.map(opt => {
                const isActive = sortBy === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.sortChip,
                      { backgroundColor: colors.bgCard, borderColor: colors.border },
                      isActive && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                    ]}
                    onPress={() => handleSort(opt.key)}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={12}
                      color={isActive ? colors.primary : colors.textMuted}
                    />
                    <Text style={[
                      styles.sortChipText,
                      { color: colors.textSecondary },
                      isActive && { color: colors.primary },
                    ]}>
                      {opt.label}
                    </Text>
                    {isActive && (
                      <Ionicons
                        name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'}
                        size={12}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Results ── */}
        {sortedResults.length > 0 && (
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>
                Results ({screenerResults.length})
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <TouchableOpacity
                  style={[styles.exportBtn, { borderColor: colors.border }]}
                  onPress={() => setShowExportSheet(true)}
                >
                  <Ionicons name="share-outline" size={15} color={colors.primary} />
                  <Text style={[styles.exportBtnText, { color: colors.primary }]}>Export</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleSort(sortBy)}>
                  <Text style={[styles.resultsSub, { color: colors.primary }]}>
                    {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)} {sortDir === 'asc' ? '↑' : '↓'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {sortedResults.map((stock, i) => (
              <Animated.View key={stock.id} style={resultStyles[i]}>
                <StockItem
                  stock={stock}
                  onPress={(s) => navigation.navigate('StockDetail', { stockId: s.id, symbol: s.symbol })}
                />
              </Animated.View>
            ))}
          </View>
        )}

        {screenerResults.length === 0 && !isScreenerVisible && activeFilterCount > 0 && (
          <View style={styles.noResults}>
            <Ionicons name="search-outline" size={48} color={colors.textMuted} />
            <Text style={styles.noResultsTitle}>No stocks match</Text>
            <Text style={styles.noResultsSub}>Try adjusting your filter criteria</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Save Modal ── */}
      <Modal
        visible={showSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowSaveModal(false)}>
          <View style={[sModal.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[sModal.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={sModal.header}>
                  <Ionicons name="bookmark" size={22} color={colors.primary} />
                  <Text style={[sModal.title, { color: colors.text }]}>Save Filters</Text>
                </View>
                <Text style={[sModal.subtitle, { color: colors.textSecondary }]}>
                  Save your current filter criteria as a preset
                </Text>
                <View style={[sModal.inputWrap, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
                  <TextInput
                    style={[sModal.input, { color: colors.text }]}
                    value={presetNameInput}
                    onChangeText={setPresetNameInput}
                    placeholder="e.g. High Dividend Stocks"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                    maxLength={50}
                  />
                </View>
                <View style={sModal.actionRow}>
                  <TouchableOpacity
                    style={[sModal.cancelBtn, { borderColor: colors.border, backgroundColor: colors.bg, flex: 1 }]}
                    onPress={() => setShowSaveModal(false)}
                  >
                    <Text style={[sModal.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      sModal.saveBtn,
                      { backgroundColor: colors.primary, opacity: presetNameInput.trim() ? 1 : 0.5 },
                      { flex: 1 },
                    ]}
                    onPress={handleSavePreset}
                    disabled={!presetNameInput.trim()}
                  >
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                    <Text style={sModal.saveText}>Save Preset</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Export Action Sheet ── */}
      <Modal
        visible={showExportSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportSheet(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowExportSheet(false)}>
          <View style={[sExport.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[sExport.sheet, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                {/* Handle bar */}
                <View style={sExport.handleBar} />

                <Text style={[sExport.title, { color: colors.text }]}>Export Results</Text>
                <Text style={[sExport.subtitle, { color: colors.textSecondary }]}>
                  {sortedResults.length} stock{sortedResults.length !== 1 ? 's' : ''} · {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)} {sortDir === 'asc' ? '↑' : '↓'}
                </Text>

                <TouchableOpacity
                  style={[sExport.option, { borderColor: colors.border }]}
                  onPress={handleExportCSV}
                  disabled={isExporting !== null}
                >
                  <View style={[sExport.optionIconWrap, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[sExport.optionTitle, { color: colors.text }]}>Export as CSV</Text>
                    <Text style={[sExport.optionDesc, { color: colors.textMuted }]}>Download a .csv file with all stock data</Text>
                  </View>
          {isExporting === 'csv' ? (
            <Animated.Text style={{ color: colors.primary, fontSize: 12 }}>Exporting…</Animated.Text>
          ) : (
            <Ionicons name="download-outline" size={20} color={colors.textMuted} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[sExport.option, { borderColor: colors.border }]}
          onPress={handleExportText}
          disabled={isExporting !== null}
        >
          <View style={[sExport.optionIconWrap, { backgroundColor: colors.accent + '15' }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[sExport.optionTitle, { color: colors.text }]}>Share as Text</Text>
            <Text style={[sExport.optionDesc, { color: colors.textMuted }]}>Send formatted results via messaging apps</Text>
          </View>
          {isExporting === 'text' ? (
            <Animated.Text style={{ color: colors.accent, fontSize: 12 }}>Sharing…</Animated.Text>
          ) : (
            <Ionicons name="share-social-outline" size={20} color={colors.textMuted} />
          )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[sExport.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => { if (!isExporting) setShowExportSheet(false); }}
                >
                  <Text style={[sExport.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
    </TouchableWithoutFeedback>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },

  // ── Filter Card ──
  filtersCard: {
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACING.lg,
  },

  // ── Preview Bar ──
  previewBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  previewHint: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },

  // ── Action Buttons ──
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  actionBtn: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
  },
  actionBtnText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  applyBtn: {
    flex: 2,
  },
  applyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
  },
  applyText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: '#FFFFFF',
  },

  // ── Results ──
  resultsSection: {
    marginBottom: SPACING.xl,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  resultsTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  resultsSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },

  // ── Export Button ──
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
  },
  exportBtnText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: FONTS.size.xs,
  },

  // ── Sort Options ──
  sortSection: {
    marginBottom: SPACING.lg,
  },
  sortHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  sortLabel: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: FONTS.size.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sortScroll: {
    marginHorizontal: -SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  sortChipText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: FONTS.size.xs,
  },

  // ── Saved Presets ──
  savedSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savedSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  savedSectionTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
  },
  savedCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  savedCountText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xs,
  },
  savedPresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  savedPresetName: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  savedPresetMeta: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginTop: 2,
  },
  savedPresetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  savedPresetActionText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  savedPresetDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── No Results ──
  noResults: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl * 2,
    gap: SPACING.sm,
  },
  noResultsTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.textSecondary,
  },
  noResultsSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
});
