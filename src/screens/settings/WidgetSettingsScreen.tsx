/**
 * ============================================================================
 * Toroloom — Widget Settings Screen
 * ============================================================================
 *
 * Allows users to configure their home screen widget appearance:
 *   - Toggle P&L visibility
 *   - Dark/Light theme
 *   - Default widget size
 *   - Highlighted metric
 *   - Hidden symbols (privacy)
 *   - Preview of how the widget will look
 *
 * Navigation: More → Widget Settings
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  Platform, Alert, Pressable,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useMarketStore } from '../../store/marketStore';
import { widgetService, WidgetPreferences, WidgetPortfolioSnapshot } from '../../services/widgetService';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';

import Svg, { Rect, Text as SvgText, Circle, Line, G, Defs, LinearGradient, Stop } from 'react-native-svg';

// ──── Widget Preview Component ─────────────────────────────────────────────

function WidgetPreview({
  size,
  snapshot,
  prefs,
  colors,
}: {
  size: 'small' | 'medium' | 'large';
  snapshot: WidgetPortfolioSnapshot | null;
  prefs: WidgetPreferences;
  colors: any;
}) {
  const isDark = prefs.theme === 'dark';
  const textColor = isDark ? '#FFFFFF' : '#0D1117';
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  const dims = size === 'small' ? { w: 160, h: 160 } : size === 'medium' ? { w: 340, h: 160 } : { w: 340, h: 340 };
  const isPositive = (snapshot?.pnl ?? 0) >= 0;
  const pnlColor = isPositive ? '#00E676' : '#FF5252';

  return (
    <View style={[widgetPreviewStyles.container, { borderColor: colors.border }]}>
      <Svg width={dims.w} height={dims.h}>
        <Defs>
          <LinearGradient id="widgetBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={isDark ? '#1a1f2e' : '#f0f2f5'} stopOpacity="1" />
            <Stop offset="1" stopColor={isDark ? '#0d1117' : '#e8eaed'} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Background */}
        <Rect x="0" y="0" width={dims.w} height={dims.h} rx={16} fill="url(#widgetBg)" stroke={borderColor} strokeWidth={1} />

        {/* Market status indicator */}
        <Circle cx={dims.w - 14} cy={14} r={4} fill={snapshot?.marketStatus === 'open' ? '#00E676' : '#FF5252'} />
        <SvgText x={dims.w - 8} y={18} fill={mutedColor} fontSize={8} textAnchor="start">●</SvgText>

        {/* Portfolio Value */}
        <SvgText x={14} y={30} fill={mutedColor} fontSize={10} fontWeight="500">
          Portfolio Value
        </SvgText>
        <SvgText x={14} y={52} fill={textColor} fontSize={22} fontWeight="800">
          {snapshot ? widgetService.formatForWidget(snapshot.currentValue) : '₹---'}
        </SvgText>

        {/* P&L Row */}
        {prefs.showPnL && (
          <G>
            <Circle cx={14} cy={68} r={5} fill={pnlColor} opacity={0.15} />
            <SvgText x={14} y={72} fill={pnlColor} fontSize={12} textAnchor="middle">▲</SvgText>
            <SvgText x={26} y={72} fill={pnlColor} fontSize={13} fontWeight="700">
              {snapshot ? widgetService.formatForWidget(snapshot.pnl) : '₹---'}
            </SvgText>
            <SvgText x={dims.w - 14} y={72} fill={pnlColor} fontSize={12} fontWeight="600" textAnchor="end">
              {snapshot ? widgetService.formatPnLPercent(snapshot.pnlPercent) : '---%'}
            </SvgText>
          </G>
        )}

        {/* Top Holdings (medium / large only) */}
        {(size === 'medium' || size === 'large') && snapshot?.topHoldings && (
          <>
            <SvgText x={14} y={size === 'large' ? 98 : 88} fill={mutedColor} fontSize={9} fontWeight="500">
              Top Holdings
            </SvgText>
            {snapshot.topHoldings.slice(0, size === 'large' ? 5 : 2).map((h, i) => {
              const yPos = size === 'large' ? 112 + i * 28 : 104 + i * 24;
              const hPnlColor = h.pnl >= 0 ? '#00E676' : '#FF5252';
              return (
                <G key={h.symbol}>
                  <Rect x={14} y={yPos - 8} width={dims.w - 28} height={size === 'large' ? 24 : 20} rx={4} fill={cardBg} />
                  <SvgText x={20} y={yPos + 4} fill={textColor} fontSize={size === 'large' ? 11 : 10} fontWeight="600">
                    {h.symbol}
                  </SvgText>
                  <SvgText x={dims.w - 80} y={yPos + 4} fill={mutedColor} fontSize={9} textAnchor="end">
                    {widgetService.formatForWidget(h.currentValue)}
                  </SvgText>
                  <SvgText x={dims.w - 18} y={yPos + 4} fill={hPnlColor} fontSize={9} fontWeight="600" textAnchor="end">
                    {h.pnl >= 0 ? '+' : ''}{h.pnlPercent.toFixed(1)}%
                  </SvgText>
                </G>
              );
            })}
            {size === 'large' && snapshot.totalHoldingCount > 5 && (
              <SvgText x={dims.w - 18} y={112 + 5 * 28 - 4} fill={mutedColor} fontSize={9} textAnchor="end">
                +{snapshot.totalHoldingCount - 5} more
              </SvgText>
            )}
          </>
        )}

        {/* App name */}
        <SvgText x={14} y={dims.h - 10} fill={mutedColor} fontSize={8} fontWeight="600">
          Toroloom
        </SvgText>
      </Svg>
    </View>
  );
}

const widgetPreviewStyles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'center',
    marginVertical: SPACING.md,
  },
});

// ──── Main Screen ──────────────────────────────────────────────────────────

export default function WidgetSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { holdings } = usePortfolioStore();
  const { stocks } = useMarketStore();

  const [prefs, setPrefs] = useState<WidgetPreferences>({
    showPnL: true,
    theme: 'dark',
    defaultSize: 'medium',
    highlightedMetric: 'totalValue',
    hiddenSymbols: [],
    widgetEnabled: true,
  });
  const [snapshot, setSnapshot] = useState<WidgetPortfolioSnapshot | null>(null);
  const [selectedSize, setSelectedSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showHiddenPicker, setShowHiddenPicker] = useState(false);

  // Load snapshot and preferences on mount
  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([
        widgetService.getSnapshot(),
        widgetService.getPreferences(),
      ]);
      if (s) setSnapshot(s);
      setPrefs(p);
      setSelectedSize(p.defaultSize);
    })();
  }, []);

  // Update preference and refresh snapshot
  const updatePref = useCallback(async (partial: Partial<WidgetPreferences>) => {
    const newPrefs = { ...prefs, ...partial };
    setPrefs(newPrefs);
    await widgetService.savePreferences(partial);

    // Refresh snapshot display
    const s = await widgetService.getSnapshot();
    if (s) setSnapshot(s);
  }, [prefs]);

  const toggleHiddenSymbol = useCallback(async (symbol: string) => {
    const current = prefs.hiddenSymbols;
    const updated = current.includes(symbol)
      ? current.filter(s => s !== symbol)
      : [...current, symbol];
    await updatePref({ hiddenSymbols: updated });
  }, [prefs, updatePref]);

  // All unique symbols from holdings + watchlist
  const allSymbols = useMemo(() => {
    const holdingSymbols = holdings.map(h => h.symbol);
    const stockSymbols = stocks.map(s => s.symbol);
    return [...new Set([...holdingSymbols, ...stockSymbols])].slice(0, 30);
  }, [holdings, stocks]);

  // ── Add widget guide ──
  const showAddWidgetGuide = useCallback(() => {
    Alert.alert(
      '📱 Add Widget to Home Screen',
      Platform.select({
        ios:
          '1. Press and hold on your home screen\n' +
          '2. Tap the "+" button in the top-left\n' +
          '3. Search for "Toroloom"\n' +
          '4. Choose your preferred size\n' +
          '5. Tap "Add Widget"',
        android:
          '1. Press and hold on your home screen\n' +
          '2. Select "Widgets" from the menu\n' +
          '3. Scroll to find "Toroloom"\n' +
          '4. Press and drag the widget to your home screen',
        default: 'Widget setup instructions are platform-specific.',
      }),
      [{ text: 'Got it!' }],
    );
  }, []);

  const sizeOptions: { key: 'small' | 'medium' | 'large'; label: string; desc: string }[] = [
    { key: 'small', label: 'Small', desc: 'Value only' },
    { key: 'medium', label: 'Medium', desc: 'Value + top 2 holdings' },
    { key: 'large', label: 'Large', desc: 'Value + top 5 holdings' },
  ];

  const metricOptions: { key: WidgetPreferences['highlightedMetric']; label: string; icon: string }[] = [
    { key: 'totalValue', label: 'Total Value', icon: 'wallet' },
    { key: 'pnl', label: 'P&L Amount', icon: 'trending-up' },
    { key: 'pnlPercent', label: 'P&L %', icon: 'percent' },
    { key: 'topHolding', label: 'Top Holding', icon: 'star' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Widget Settings</Text>
          <Text style={styles.headerSubtitle}>Customize your home screen widget</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Widget Preview ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <WidgetPreview
            size={selectedSize}
            snapshot={snapshot}
            prefs={prefs}
            colors={colors}
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {selectedSize === 'small' ? 'Shows portfolio value only' :
             selectedSize === 'medium' ? 'Shows value + top 2 holdings' :
             'Shows value + top 5 holdings'}
          </Text>
        </View>

        {/* ── Size Selector ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Widget Size</Text>
          <View style={styles.sizeRow}>
            {sizeOptions.map(opt => {
              const isActive = selectedSize === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => { setSelectedSize(opt.key); updatePref({ defaultSize: opt.key }); }}
                  style={[
                    styles.sizeOption,
                    {
                      borderColor: isActive ? colors.primary : colors.border,
                      backgroundColor: isActive ? colors.primary + '12' : 'transparent',
                    },
                  ]}
                >
                  <Ionicons
                    name={opt.key === 'small' ? 'apps' : 'grid'}
                    size={20}
                    color={isActive ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.sizeLabel, { color: isActive ? colors.primary : colors.text }]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.sizeDesc, { color: isActive ? colors.primary + 'AA' : colors.textMuted }]}>
                    {opt.desc}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Display Options ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Display Options</Text>

          {/* Show P&L */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIconBlock, { backgroundColor: '#00E67620' }]}>
                <Ionicons name="trending-up" size={18} color="#00E676" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Show Profit & Loss</Text>
                <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                  Display P&L amount and percentage on the widget
                </Text>
              </View>
            </View>
            <Switch
              value={prefs.showPnL}
              onValueChange={(v) => updatePref({ showPnL: v })}
              trackColor={{ false: colors.bgInput, true: colors.primary + '60' }}
              thumbColor={prefs.showPnL ? colors.primary : colors.textMuted}
            />
          </View>

          {/* Theme */}
          <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.divider }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIconBlock, { backgroundColor: '#8B5CF620' }]}>
                <Ionicons name={prefs.theme === 'dark' ? 'moon' : 'sunny'} size={18} color="#8B5CF6" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Widget Theme</Text>
                <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                  {prefs.theme === 'dark' ? 'Dark theme (matches app)' : 'Light theme'}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => updatePref({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })}>
              <View style={[
                styles.themeThumb,
                { left: prefs.theme === 'dark' ? 2 : undefined, right: prefs.theme === 'light' ? 2 : undefined },
              ]} />
              <Text style={styles.themeLabel}>
                {prefs.theme === 'dark' ? '🌙' : '☀️'}
              </Text>
            </Pressable>
          </View>

          {/* Highlighted Metric */}
          <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.divider }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIconBlock, { backgroundColor: '#3B82F620' }]}>
                <Ionicons name="analytics" size={18} color="#3B82F6" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Highlighted Metric</Text>
                <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                  Which metric appears most prominently
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.metricRow}>
            {metricOptions.map(opt => {
              const isActive = prefs.highlightedMetric === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => updatePref({ highlightedMetric: opt.key })}
                  style={[
                    styles.metricOption,
                    {
                      borderColor: isActive ? colors.primary : colors.border,
                      backgroundColor: isActive ? colors.primary + '15' : colors.bgCardLight,
                    },
                  ]}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={16}
                    color={isActive ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.metricLabel, { color: isActive ? colors.primary : colors.textSecondary }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Privacy — Hidden Symbols ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Privacy</Text>
            <Pressable onPress={() => setShowHiddenPicker(!showHiddenPicker)}>
              <Text style={[styles.editButton, { color: colors.primary }]}>
                {showHiddenPicker ? 'Done' : 'Edit'}
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.settingDesc, { color: colors.textMuted, marginBottom: SPACING.md }]}>
            Hide specific holdings from the widget for privacy
          </Text>

          {prefs.hiddenSymbols.length > 0 ? (
            <View style={styles.hiddenChips}>
              {prefs.hiddenSymbols.map(sym => (
                <View key={sym} style={[styles.hiddenChip, { backgroundColor: colors.marketDown + '20', borderColor: colors.marketDown + '40' }]}>
                  <Ionicons name="eye-off" size={12} color={colors.marketDown} />
                  <Text style={[styles.hiddenChipText, { color: colors.marketDown }]}>{sym}</Text>
                  <Pressable onPress={() => toggleHiddenSymbol(sym)}>
                    <Ionicons name="close-circle" size={14} color={colors.marketDown} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No symbols hidden. All holdings are visible on the widget.
            </Text>
          )}

          {/* Symbol Picker */}
          {showHiddenPicker && (
            <Animated.View entering={FadeInUp.duration(300)} style={[styles.symbolPicker, { borderTopColor: colors.divider }]}>
              <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>
                Tap to hide a symbol:
              </Text>
              <View style={styles.symbolGrid}>
                {allSymbols.map(sym => {
                  const isHidden = prefs.hiddenSymbols.includes(sym);
                  return (
                    <Pressable
                      key={sym}
                      style={[
                        styles.symbolChip,
                        {
                          borderColor: isHidden ? colors.marketDown + '40' : colors.border,
                          backgroundColor: isHidden ? colors.marketDown + '10' : colors.bgCardLight,
                        },
                      ]}
                      onPress={() => toggleHiddenSymbol(sym)}
                    >
                      <Ionicons
                        name={isHidden ? 'eye-off' : 'eye'}
                        size={12}
                        color={isHidden ? colors.marketDown : colors.textSecondary}
                      />
                      <Text style={[styles.symbolChipText, {
                        color: isHidden ? colors.marketDown : colors.text,
                        textDecorationLine: isHidden ? 'line-through' : 'none',
                      }]}>
                        {sym}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          )}
        </View>

        {/* ── Add Widget Guide ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Add to Home Screen</Text>
          </View>

          <Text style={[styles.settingDesc, { color: colors.textMuted, marginBottom: SPACING.lg }]}>
            Follow these steps to add the Toroloom widget to your device's home screen:
          </Text>

          {Platform.select({
            ios: (
              <View style={styles.stepsList}>
                {[
                  { icon: 'hand-left', text: 'Press and hold on an empty area of your home screen' },
                  { icon: 'add-circle', text: 'Tap the "+" button in the top-left corner' },
                  { icon: 'search', text: 'Search for "Toroloom" in the widget gallery' },
                  { icon: 'options', text: 'Choose Small, Medium, or Large size' },
                  { icon: 'checkmark-circle', text: 'Tap "Add Widget" and then "Done"' },
                ].map((step, i) => (
                  <View key={`wgt_${i}`} style={styles.stepRow}>
                    <View style={[styles.stepNumber, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.stepNumberText, { color: colors.primary }]}>{i + 1}</Text>
                    </View>
                    <Ionicons name={step.icon as any} size={16} color={colors.primary} style={{ marginRight: SPACING.sm }} />
                    <Text style={[styles.stepText, { color: colors.textSecondary }]}>{step.text}</Text>
                  </View>
                ))}
              </View>
            ),
            android: (
              <View style={styles.stepsList}>
                {[
                  { icon: 'hand-left', text: 'Press and hold on an empty area of your home screen' },
                  { icon: 'apps', text: 'Select "Widgets" from the menu that appears' },
                  { icon: 'search', text: 'Scroll or search for "Toroloom"' },
                  { icon: 'add-circle', text: 'Press and drag the widget to your desired location' },
                ].map((step, i) => (
                  <View key={`wgt_${i}`} style={styles.stepRow}>
                    <View style={[styles.stepNumber, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.stepNumberText, { color: colors.primary }]}>{i + 1}</Text>
                    </View>
                    <Ionicons name={step.icon as any} size={16} color={colors.primary} style={{ marginRight: SPACING.sm }} />
                    <Text style={[styles.stepText, { color: colors.textSecondary }]}>{step.text}</Text>
                  </View>
                ))}
              </View>
            ),
            default: (
              <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                Widgets are available on iOS and Android devices.
              </Text>
            ),
          })}

          <Pressable
            style={({pressed}) => [[styles.addWidgetBtn, { backgroundColor: colors.primary }], {opacity: pressed ? 0.7 : 1}]}
            onPress={showAddWidgetGuide}
          >
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.addWidgetBtnText}>Show Instructions</Text>
          </Pressable>
        </View>

        {/* ── Info Card ── */}
        <View style={[styles.infoCard, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={18} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            Widget data updates automatically when your portfolio changes.
            {'\n'}The widget refreshes every ~15 minutes in the background.
            {'\n'}Open the app to force an immediate update.
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    backgroundColor: colors.bg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.text,
  },
  headerSubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
  },
  section: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  hint: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  // ── Size Selector ──
  sizeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  sizeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 4,
  },
  sizeLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
  },
  sizeDesc: {
    ...FONTS.regular,
    fontSize: 9,
  },
  // ── Settings Row ──
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
    marginRight: SPACING.md,
  },
  settingIconBlock: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  settingDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginTop: 1,
    lineHeight: 16,
  },
  // ── Theme Toggle ──
  themeToggle: {
    width: 52,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
    alignItems: 'center',
  },
  themeThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  themeLabel: {
    fontSize: 12,
  },
  // ── Metric Selector ──
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metricOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  metricLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  // ── Hidden Symbols ──
  hiddenChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  hiddenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  hiddenChipText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
  },
  emptyText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    fontStyle: 'italic',
  },
  // ── Symbol Picker ──
  symbolPicker: {
    borderTopWidth: 1,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
  },
  pickerLabel: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    marginBottom: SPACING.sm,
  },
  symbolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  symbolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  symbolChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  // ── Steps ──
  stepsList: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  stepNumberText: {
    ...FONTS.bold,
    fontSize: 12,
  },
  stepText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    flex: 1,
  },
  addWidgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  addWidgetBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#FFF',
  },
  editButton: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  // ── Info Card ──
  infoCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  infoText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    flex: 1,
    lineHeight: 16,
  },
});
