/**
 * ============================================================================
 * Toroloom — Batch Stock Analysis Screen
 * ============================================================================
 *
 * AI-powered batch analysis of multiple stocks:
 *   1. Enter stock symbols (comma-separated) or select from popular/watchlist
 *   2. Batch analyze all with sequential API calls + progress tracking
 *   3. View results in a grid/sortable list with bullish/bearish/neutral signals
 *   4. Sort by confidence, filter by signal type
 *   5. Tap individual result to see full analysis
 *
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { aiApi } from '../../services/api/ai';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';
import type { AIInsight } from '../../types';

const { width } = Dimensions.get('window');
const GRID_GAP = SPACING.sm;
const CARD_WIDTH = (width - SPACING.xl * 2 - GRID_GAP) / 2;

// ──── Popular stock suggestions ──────────────────────────────────────────

const POPULAR_STOCKS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
  'SBIN', 'BHARTIARTL', 'ITC', 'WIPRO', 'BAJFINANCE',
  'HINDUNILVR', 'TATAMOTORS', 'MARUTI', 'AXISBANK', 'LT',
];

// ──── Main Screen ────────────────────────────────────────────────────────

export default function BatchAnalysisScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [symbolInput, setSymbolInput] = useState('');
  const [results, setResults] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [sortBy, setSortBy] = useState<'confidence' | 'symbol'>('confidence');
  const [filterType, setFilterType] = useState<'all' | 'bullish' | 'bearish' | 'neutral'>('all');
  const [error, setError] = useState<string | null>(null);

  // ── Parse symbols from input ───────────────────────────────────────

  const parsedSymbols = useMemo(() => {
    return symbolInput
      .split(/[,;\n\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0);
  }, [symbolInput]);

  // ── Sorted & filtered results ─────────────────────────────────────

  const displayResults = useMemo(() => {
    let filtered = [...results];

    if (filterType !== 'all') {
      filtered = filtered.filter(r => r.type === filterType);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'confidence') {
        return b.confidence - a.confidence;
      }
      return a.symbol.localeCompare(b.symbol);
    });

    return filtered;
  }, [results, filterType, sortBy]);

  // ── Analysis counts ────────────────────────────────────────────────

  const analysisCounts = useMemo(() => {
    const bullish = results.filter(r => r.type === 'bullish').length;
    const bearish = results.filter(r => r.type === 'bearish').length;
    const neutral = results.filter(r => r.type === 'neutral').length;
    return { bullish, bearish, neutral, total: results.length };
  }, [results]);

  // ── Run batch analysis ────────────────────────────────────────────

  const handleAnalyze = useCallback(async () => {
    const symbols = parsedSymbols.length > 0 ? parsedSymbols : POPULAR_STOCKS.slice(0, 3);
    if (symbols.length === 0) return;

    setLoading(true);
    setProgress({ current: 0, total: symbols.length });
    setResults([]);
    setError(null);

    const newResults: AIInsight[] = [];
    let hasError = false;

    for (let i = 0; i < symbols.length; i++) {
      setProgress({ current: i + 1, total: symbols.length });
      try {
        const insight = await aiApi.analyze(symbols[i]);
        newResults.push(insight);
      } catch {
        hasError = true;
      }
    }

    setResults(newResults);
    setLoading(false);

    if (hasError && newResults.length === 0) {
      setError('Could not analyze any symbols. Please try again.');
    }
  }, [parsedSymbols]);

  // ── Add symbol to input ────────────────────────────────────────────

  const addSymbol = useCallback((symbol: string) => {
    const current = symbolInput.trim();
    if (current) {
      setSymbolInput(current + ', ' + symbol);
    } else {
      setSymbolInput(symbol);
    }
  }, [symbolInput]);

  // ── Signal color helper ────────────────────────────────────────────

  const signalColor = (type: string) => {
    switch (type) {
      case 'bullish': return '#10B981';
      case 'bearish': return '#EF4444';
      default: return '#F59E0B';
    }
  };

  const signalIcon = (type: string) => {
    switch (type) {
      case 'bullish': return 'trending-up';
      case 'bearish': return 'trending-down';
      default: return 'remove';
    }
  };

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </AnimatedPressable>
            <View style={{ flex: 1, marginLeft: SPACING.md }}>
              <Text style={[styles.title, { color: colors.text }]}>Batch Analysis</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                AI analysis for multiple stocks at once
              </Text>
            </View>
          </View>
        </View>

        {/* ── Input Section ── */}
        <Card title="Enter Stock Symbols" style={styles.inputCard}>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
            value={symbolInput}
            onChangeText={setSymbolInput}
            placeholder="e.g. RELIANCE, TCS, HDFCBANK, INFY"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={2}
            autoCapitalize="characters"
          />
          {parsedSymbols.length > 0 && (
            <View style={styles.chipRow}>
              {parsedSymbols.map(s => (
                <View key={s} style={[styles.chip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
                  <Text style={[styles.chipText, { color: colors.primary }]}>{s}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Popular Stocks */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Quick add:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.popularRow}>
              {POPULAR_STOCKS.slice(0, 8).map(s => (
                <Pressable
                  key={s}
                  onPress={() => addSymbol(s)}
                  style={[styles.popularChip, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                >
                  <Text style={[styles.popularChipText, { color: colors.text }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Analyze Button */}
          <AnimatedPressable
            onPress={handleAnalyze}
            disabled={loading}
            haptic="medium"
            scaleTo={0.97}
            style={[styles.analyzeBtn, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="flash" size={18} color="#fff" />
            )}
            <Text style={styles.analyzeBtnText}>
              {loading
                ? `Analyzing ${progress.current}/${progress.total}...`
                : `Analyze ${parsedSymbols.length > 0 ? parsedSymbols.length : '3 Popular'} Stocks`}
            </Text>
          </AnimatedPressable>
        </Card>

        {/* ── Progress Bar ── */}
        {loading && progress.total > 0 && (
          <View style={[styles.progressCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                Analyzing {progress.current}/{progress.total}
              </Text>
              <Text style={[styles.progressPct, { color: colors.primary }]}>
                {Math.round((progress.current / progress.total) * 100)}%
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(progress.current / progress.total) * 100}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* ── Error ── */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: colors.danger + '10', borderColor: colors.danger + '25' }]}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          </View>
        )}

        {/* ── Results ── */}
        {results.length > 0 && (
          <>
            {/* Summary */}
            <View style={[styles.summaryRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: '#10B981' }]}>{analysisCounts.bullish}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Bullish</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: '#EF4444' }]}>{analysisCounts.bearish}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Bearish</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: '#F59E0B' }]}>{analysisCounts.neutral}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Neutral</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryCount, { color: colors.text }]}>{analysisCounts.total}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total</Text>
              </View>
            </View>

            {/* Filters & Sort */}
            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                {(['all', 'bullish', 'bearish', 'neutral'] as const).map(f => (
                  <Pressable
                    key={f}
                    onPress={() => setFilterType(f)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: filterType === f ? colors.primary + '20' : colors.bgInput,
                        borderColor: filterType === f ? colors.primary + '40' : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.filterChipText, { color: filterType === f ? colors.primary : colors.textMuted }]}>
                      {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable
                onPress={() => setSortBy(sortBy === 'confidence' ? 'symbol' : 'confidence')}
                style={[styles.sortBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
              >
                <Ionicons name="funnel" size={14} color={colors.textMuted} />
                <Text style={[styles.sortBtnText, { color: colors.textMuted }]}>
                  {sortBy === 'confidence' ? 'Confidence' : 'Symbol'}
                </Text>
              </Pressable>
            </View>

            {/* Results Grid */}
            <View style={styles.grid}>
              {displayResults.map((insight, index) => {
                const color = signalColor(insight.type);
                return (
                  <Animated.View
                    key={insight.id}
                    entering={FadeInDown.delay(index * 80).springify()}
                    style={[styles.resultCard, { backgroundColor: colors.bgCard, borderColor: colors.border, borderLeftColor: color, borderLeftWidth: 3 }]}
                  >
                    {/* Header */}
                    <View style={styles.resultHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultSymbol, { color: colors.text }]}>{insight.symbol}</Text>
                        <Text style={[styles.resultName, { color: colors.textMuted }]} numberOfLines={1}>
                          {insight.name}
                        </Text>
                      </View>
                      <View style={[styles.signalBadge, { backgroundColor: color + '18' }]}>
                        <Ionicons name={signalIcon(insight.type) as any} size={12} color={color} />
                        <Text style={[styles.signalText, { color }]}>
                          {insight.type === 'bullish' ? 'Bull' : insight.type === 'bearish' ? 'Bear' : 'Neut'}
                        </Text>
                      </View>
                    </View>

                    {/* Confidence */}
                    <View style={styles.confidenceRow}>
                      <View style={[styles.confidenceBar, { backgroundColor: colors.border }]}>
                        <View style={[styles.confidenceFill, { width: `${insight.confidence}%`, backgroundColor: color }]} />
                      </View>
                      <Text style={[styles.confidenceValue, { color }]}>{insight.confidence}%</Text>
                    </View>

                    {/* Summary */}
                    <Text style={[styles.resultSummary, { color: colors.textSecondary }]} numberOfLines={2}>
                      {insight.summary}
                    </Text>

                    {/* Targets */}
                    {insight.targets.length > 0 && (
                      <View style={styles.targetRow}>
                        {insight.targets.slice(0, 2).map((t, i) => (
                          <View key={i} style={[styles.targetItem, { backgroundColor: colors.bgInput }]}>
                            <Text style={[styles.targetLabel, { color: colors.textMuted }]}>
                              T{i + 1}
                            </Text>
                            <Text style={[styles.targetValue, { color: colors.text }]}>
                              ₹{t.target.toLocaleString()}
                            </Text>
                            <View style={[styles.targetBar, { backgroundColor: colors.border }]}>
                              <View
                                style={[
                                  styles.targetFill,
                                  { width: `${t.probability}%`, backgroundColor: color },
                                ]}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </Animated.View>
                );
              })}
            </View>

            {displayResults.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="search" size={36} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No {filterType !== 'all' ? filterType : ''} results found
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ──── Styles ──────────────────────────────────────────────────────────────

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
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: 2,
  },

  // Input
  inputCard: {
    marginBottom: SPACING.lg,
  },
  textInput: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    fontSize: FONTS.size.md,
    fontFamily: FONTS.medium.fontFamily,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.semiBold.fontFamily,
  },
  sectionLabel: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  popularRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  popularChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  popularChipText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.medium.fontFamily,
  },

  // Analyze Button
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.lg,
  },
  analyzeBtnText: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    color: '#FFFFFF',
  },

  // Progress
  progressCard: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  progressLabel: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
  },
  progressPct: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.semiBold.fontFamily,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Error
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.regular.fontFamily,
    flex: 1,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryCount: {
    fontSize: FONTS.size.xxl,
    fontFamily: FONTS.bold.fontFamily,
  },
  summaryLabel: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterScroll: {
    flex: 1,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  filterChipText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.semiBold.fontFamily,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  sortBtnText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.medium.fontFamily,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },

  // Result Card
  resultCard: {
    width: CARD_WIDTH,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
    marginBottom: GRID_GAP,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  resultSymbol: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.bold.fontFamily,
  },
  resultName: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    marginTop: 1,
  },
  signalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  signalText: {
    fontSize: 9,
    fontFamily: FONTS.semiBold.fontFamily,
    letterSpacing: 0.3,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceValue: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.bold.fontFamily,
    width: 32,
    textAlign: 'right',
  },
  resultSummary: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    lineHeight: 15,
  },
  targetRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  targetItem: {
    flex: 1,
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    gap: 1,
  },
  targetLabel: {
    fontSize: 8,
    fontFamily: FONTS.regular.fontFamily,
  },
  targetValue: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.semiBold.fontFamily,
  },
  targetBar: {
    width: '100%',
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  targetFill: {
    height: '100%',
    borderRadius: 1,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
    width: '100%',
  },
  emptyText: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.regular.fontFamily,
  },
});
