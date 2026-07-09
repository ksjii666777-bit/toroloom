/**
 * ============================================================================
 * Toroloom — Sentiment Analysis Screen
 * ============================================================================
 *
 * AI-powered news + social media sentiment analysis for watchlist stocks:
 *   - Stock selector (from watchlist + market stocks)
 *   - Current sentiment gauge with score, label, and change
 *   - Source breakdown bars (news, social, analyst, AI)
 *   - Sentiment score chart over time (30 days)
 *   - Recent news articles sorted by sentiment
 *   - Top keywords trending
 *   - Mention volume tracker
 *   - Market overview summary
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants/theme';
import { mockSentimentData, mockStocks } from '../../constants/mockData';

import {
  classifySentiment,
  generateSentimentOverview,
  computeSentimentStability,
  detectSentimentShift,
} from '../../services/ai/sentimentAnalyzer';
import type { StockSentiment } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Helpers ────────────────────────────────────────────────

function getSentimentColors(label: string) {
  switch (label) {
    case 'bullish': return { color: '#10B981', bg: '#10B98115', icon: 'trending-up' as const };
    case 'bearish': return { color: '#EF4444', bg: '#EF444415', icon: 'trending-down' as const };
    default: return { color: '#F59E0B', bg: '#F59E0B15', icon: 'remove' as const };
  }
}

function formatCompactNumber(num: number): string {
  if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(0);
}

// ─── Sentiment Gauge ────────────────────────────────────────

function SentimentGauge({ score, label }: { score: number; label: string }) {
  const { colors } = useTheme();
  const sc = getSentimentColors(label);
  const absScore = Math.abs(score);

  return (
    <View style={gaugeStyles.container}>
      {/* Score circle */}
      <View style={[gaugeStyles.scoreCircle, { borderColor: sc.color + '40' }]}>
        <View style={[gaugeStyles.scoreInner, { backgroundColor: sc.bg }]}>
          <Text style={[gaugeStyles.scoreValue, { color: sc.color }]}>
            {score > 0 ? '+' : ''}{score}
          </Text>
          <Text style={[gaugeStyles.scoreLabel, { color: sc.color }]}>
            {label.charAt(0).toUpperCase() + label.slice(1)}
          </Text>
        </View>
      </View>

      {/* Score bar */}
      <View style={gaugeStyles.barContainer}>
        <View style={[gaugeStyles.barBg, { backgroundColor: colors.bgInput }]}>
          {/* Negative range */}
          <View style={[gaugeStyles.barSegment, gaugeStyles.barNegative, { borderRightColor: colors.divider }]} />
          {/* Center marker */}
          <View style={[gaugeStyles.centerMarker, { backgroundColor: colors.textMuted }]} />
          {/* Positive fill */}
          {score > 0 && (
            <View style={[gaugeStyles.barFill, {
              width: `${absScore}%`,
              backgroundColor: sc.color,
              left: '50%',
            }]} />
          )}
          {score < 0 && (
            <View style={[gaugeStyles.barFill, {
              width: `${absScore}%`,
              backgroundColor: sc.color,
              right: '50%',
            }]} />
          )}
        </View>
        <View style={gaugeStyles.barLabels}>
          <Text style={[gaugeStyles.barLabel, { color: colors.marketDown }]}>Bearish</Text>
          <Text style={[gaugeStyles.barLabelCenter, { color: colors.textMuted }]}>0</Text>
          <Text style={[gaugeStyles.barLabel, { color: colors.marketUp }]}>Bullish</Text>
        </View>
      </View>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  scoreInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  barContainer: {
    width: '100%',
    paddingHorizontal: SPACING.xl,
  },
  barBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    position: 'relative',
  },
  barSegment: {
    flex: 1,
  },
  barNegative: {
    borderRightWidth: 1,
  },
  centerMarker: {
    position: 'absolute',
    width: 2,
    height: '100%',
    left: '50%',
    marginLeft: -1,
  },
  barFill: {
    position: 'absolute',
    height: '100%',
    borderRadius: 4,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  barLabelCenter: {
    fontSize: 10,
    fontWeight: '600',
  },
});

// ─── Source Breakdown Bar ──────────────────────────────────

function SourceBar({ label, score, color }: { label: string; score: number; color: string }) {
  const { colors } = useTheme();
  const absScore = Math.abs(score);

  return (
    <View style={sourceBarStyles.row}>
      <Text style={[sourceBarStyles.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={[sourceBarStyles.barBg, { backgroundColor: colors.bgInput }]}>
        <View style={[sourceBarStyles.fill, {
          width: `${absScore}%`,
          backgroundColor: color,
          opacity: 0.7,
        }]} />
      </View>
      <Text style={[sourceBarStyles.score, { color: score >= 0 ? colors.marketUp : colors.marketDown }]}>
        {score > 0 ? '+' : ''}{score}
      </Text>
    </View>
  );
}

const sourceBarStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    width: 65,
  },
  barBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  score: {
    fontSize: 11,
    fontWeight: '700',
    width: 35,
    textAlign: 'right',
  },
});

// ─── Mini Sentiment Chart ──────────────────────────────────

function SentimentMiniChart({
  history,
  label,
}: {
  history: { date: string; overallScore: number }[];
  label: string;
}) {
  const { colors } = useTheme();
  const sc = getSentimentColors(label);

  if (history.length < 2) return null;

  const scores = history.map(h => h.overallScore);
  const min = Math.min(...scores, -5);
  const max = Math.max(...scores, 5);
  const range = max - min || 1;
  const chartWidth = SCREEN_WIDTH - 96;
  const barWidth = Math.max(2, chartWidth / history.length - 1);

  return (
    <View style={chartStyles.container}>
      {/* Zero line */}
      <View style={[chartStyles.zeroLine, { backgroundColor: colors.divider, borderColor: colors.divider }]} />

      {/* Bars */}
      <View style={chartStyles.barsRow}>
        {history.map((point, i) => {
          const height = Math.max(2, ((point.overallScore - min) / range) * 100);
          const isPositive = point.overallScore >= 0;
          return (
            <View key={i} style={[chartStyles.barWrap, { width: barWidth }]}>
              <View style={[chartStyles.bar, {
                height: `${height}%`,
                backgroundColor: isPositive ? sc.color : sc.color,
                opacity: isPositive ? 0.7 + (point.overallScore / max) * 0.3 : 0.4 + Math.abs(point.overallScore) / Math.abs(min) * 0.3,
                width: barWidth,
                borderRadius: 1,
              }]} />
            </View>
          );
        })}
      </View>

      {/* Labels */}
      <View style={chartStyles.labelsRow}>
        <Text style={[chartStyles.labelText, { color: colors.textMuted }]}>30d ago</Text>
        <Text style={[chartStyles.labelText, { color: colors.textMuted }]}>Today</Text>
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    height: 120,
    marginBottom: SPACING.sm,
    paddingTop: 8,
  },
  zeroLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 68,
    height: 1,
    borderTopWidth: 1,
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  barWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {},
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  labelText: {
    fontSize: 9,
    fontWeight: '500',
  },
});

// ─── Sentiment Article Card ────────────────────────────────

function ArticleCard({ article }: { article: { title: string; summary: string; source: string; sentiment: string; score: number; publishedAt: string } }) {
  const { colors } = useTheme();
  const sc = getSentimentColors(article.sentiment);

  function formatRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <View style={[articleStyles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={articleStyles.topRow}>
        <View style={[articleStyles.sentimentIndicator, { backgroundColor: sc.bg }]}>
          <Ionicons name={sc.icon} size={12} color={sc.color} />
          <Text style={[articleStyles.sentimentText, { color: sc.color }]}>
            {article.score > 0 ? '+' : ''}{article.score}
          </Text>
        </View>
        <Text style={[articleStyles.source, { color: colors.textMuted }]}>{article.source}</Text>
        <Text style={[articleStyles.time, { color: colors.textMuted }]}>· {formatRelativeTime(article.publishedAt)}</Text>
      </View>
      <Text style={[articleStyles.title, { color: colors.text }]} numberOfLines={2}>{article.title}</Text>
      <Text style={[articleStyles.summary, { color: colors.textSecondary }]} numberOfLines={2}>{article.summary}</Text>
    </View>
  );
}

const articleStyles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sentimentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  sentimentText: {
    fontSize: 10,
    fontWeight: '700',
  },
  source: {
    fontSize: 10,
    fontWeight: '500',
  },
  time: {
    fontSize: 10,
    fontWeight: '500',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    marginBottom: 4,
  },
  summary: {
    fontSize: 12,
    lineHeight: 16,
  },
});

// ─── Main Screen ────────────────────────────────────────────

export default function SentimentAnalysisScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeFilter, setActiveFilter] = useState<'all' | 'bullish' | 'bearish' | 'neutral'>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('RELIANCE');

  const sentimentData = useMemo(() => mockSentimentData, []);

  // Get all available stocks for the picker (stocks that have sentiment data)
  const stockSymbols = useMemo(() =>
    sentimentData.map(s => ({ symbol: s.symbol, name: s.name })),
    [sentimentData],
  );

  const selectedSentiment = sentimentData.find(s => s.symbol === selectedSymbol);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return sentimentData;
    return sentimentData.filter(s => s.label === activeFilter);
  }, [sentimentData, activeFilter]);

  const overviewText = useMemo(() =>
    generateSentimentOverview(filtered.map(s => ({ symbol: s.symbol, score: s.currentScore, label: s.label }))),
    [filtered],
  );

  if (!selectedSentiment) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No sentiment data available</Text>
      </View>
    );
  }

  const sc = getSentimentColors(selectedSentiment.label);
  const stability = computeSentimentStability(selectedSentiment.history);
  const shift = detectSentimentShift(selectedSentiment.history);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('SentimentAlert')} style={[styles.backBtn, { marginLeft: SPACING.sm }]}>
            <Ionicons name="notifications" size={20} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Sentiment Analysis</Text>
            <Text style={styles.headerSubtitle}>News + social media sentiment</Text>
          </View>
        </View>

        {/* Stock Picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
          {stockSymbols.map(c => {
            const isActive = c.symbol === selectedSymbol;
            return (
              <TouchableOpacity
                key={c.symbol}
                onPress={() => setSelectedSymbol(c.symbol)}
                activeOpacity={0.7}
                style={[styles.pickerChip, {
                  backgroundColor: isActive ? colors.primary : colors.bgCardLight,
                  borderColor: isActive ? colors.primary : colors.border,
                }]}
              >
                <Text style={[styles.pickerChipText, { color: isActive ? '#FFFFFF' : colors.textSecondary }]}>
                  {c.symbol}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Sentiment Hero */}
        <LinearGradient
          colors={[sc.color + '15', colors.bgCard]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { borderColor: sc.color + '25' }]}
        >
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroCompany}>{selectedSentiment.name}</Text>
              <Text style={styles.heroSector}>{selectedSentiment.sector}</Text>
            </View>
            <View style={styles.scoreChangeRow}>
              <Ionicons name={selectedSentiment.scoreChange >= 0 ? 'arrow-up' : 'arrow-down'} size={14} color={selectedSentiment.scoreChange >= 0 ? colors.marketUp : colors.marketDown} />
              <Text style={[styles.scoreChange, { color: selectedSentiment.scoreChange >= 0 ? colors.marketUp : colors.marketDown }]}>
                {selectedSentiment.scoreChange >= 0 ? '+' : ''}{selectedSentiment.scoreChange.toFixed(1)}
              </Text>
            </View>
          </View>

          {/* Gauge */}
          <SentimentGauge score={selectedSentiment.currentScore} label={selectedSentiment.label} />

          {/* Source Breakdown */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Source Breakdown</Text>
          <View style={[styles.sourceCard, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
            <SourceBar label="News" score={selectedSentiment.sourceBreakdown.newsScore} color="#3B82F6" />
            <SourceBar label="Social" score={selectedSentiment.sourceBreakdown.socialScore} color="#8B5CF6" />
            <SourceBar label="Analyst" score={selectedSentiment.sourceBreakdown.analystScore} color="#10B981" />
            <SourceBar label="AI" score={selectedSentiment.sourceBreakdown.aiScore} color="#F59E0B" />
          </View>

          {/* Confidence bar */}
          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>Confidence</Text>
            <View style={[styles.confidenceBar, { backgroundColor: colors.bgInput }]}>
              <View style={[styles.confidenceFill, { width: `${selectedSentiment.confidence}%`, backgroundColor: sc.color }]} />
            </View>
            <Text style={[styles.confidenceValue, { color: sc.color }]}>{selectedSentiment.confidence}%</Text>
          </View>
        </LinearGradient>

        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={styles.metricLabel}>Mentions Today</Text>
            <Text style={styles.metricValue}>{formatCompactNumber(selectedSentiment.mentionVolume)}</Text>
            <View style={styles.metricChangeRow}>
              <Ionicons name={selectedSentiment.mentionChange >= 0 ? 'arrow-up' : 'arrow-down'} size={10} color={selectedSentiment.mentionChange >= 0 ? colors.marketUp : colors.marketDown} />
              <Text style={[styles.metricChange, { color: selectedSentiment.mentionChange >= 0 ? colors.marketUp : colors.marketDown }]}>
                {selectedSentiment.mentionChange >= 0 ? '+' : ''}{selectedSentiment.mentionChange.toFixed(1)}%
              </Text>
            </View>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={styles.metricLabel}>Stability</Text>
            <Text style={[styles.metricValue, { color: stability.volatility === 'high' ? colors.marketDown : stability.volatility === 'low' ? colors.marketUp : colors.warning }]}>
              {stability.stabilityScore}%
            </Text>
            <Text style={[styles.metricSub, { color: colors.textMuted }]}>{stability.volatility} volatility</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={styles.metricLabel}>Keywords</Text>
            <View style={styles.keywordRow}>
              {selectedSentiment.topKeywords.slice(0, 3).map((kw, i) => (
                <View key={i} style={[styles.keywordChip, { backgroundColor: sc.color + '15' }]}>
                  <Text style={[styles.keywordText, { color: sc.color }]}>{kw}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Sentiment Chart */}
        <View style={[styles.sectionCard, { borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="pulse" size={16} color={colors.primary} />
              </View>
              <Text style={styles.sectionCardTitle}>30-Day Trend</Text>
            </View>
            {shift.hasShifted && (
              <View style={[styles.shiftBadge, { backgroundColor: shift.direction === 'improving' ? colors.marketUp + '20' : colors.marketDown + '20' }]}>
                <Text style={[styles.shiftText, { color: shift.direction === 'improving' ? colors.marketUp : colors.marketDown }]}>
                  {shift.direction === 'improving' ? '↑' : '↓'} {Math.round(shift.magnitude)}pts
                </Text>
              </View>
            )}
          </View>
          <SentimentMiniChart history={selectedSentiment.history} label={selectedSentiment.label} />
          {shift.alert && (
            <View style={[styles.shiftAlert, { backgroundColor: colors.bgCardLight, borderLeftColor: sc.color }]}>
              <Text style={[styles.shiftAlertText, { color: colors.textSecondary }]}>{shift.alert}</Text>
            </View>
          )}
        </View>

        {/* Market Overview */}
        <View style={[styles.overviewCard, { borderColor: colors.border }]}>
          <View style={styles.overviewHeader}>
            <Ionicons name="globe" size={16} color={colors.primary} />
            <Text style={styles.overviewTitle}>Market Sentiment Overview</Text>
          </View>
          <Text style={[styles.overviewText, { color: colors.textSecondary }]}>{overviewText}</Text>

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {(['all', 'bullish', 'bearish', 'neutral'] as const).map(f => {
              const fColors = getSentimentColors(f === 'all' ? 'neutral' : f);
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => setActiveFilter(f)}
                  activeOpacity={0.7}
                  style={[styles.filterChip, {
                    backgroundColor: activeFilter === f ? fColors.color + '20' : colors.bgCardLight,
                    borderColor: activeFilter === f ? fColors.color : colors.border,
                  }]}
                >
                  <Text style={[styles.filterChipText, {
                    color: activeFilter === f ? fColors.color : colors.textSecondary,
                    fontWeight: activeFilter === f ? '700' : '500',
                  }]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)} ({filtered.length})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Stock Sentiment List */}
        {filtered.map(stock => {
          const s = getSentimentColors(stock.label);
          const stockInfo = mockStocks.find(s => s.id === stock.symbol);
          return (
            <TouchableOpacity
              key={stock.symbol}
              style={[styles.stockRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => setSelectedSymbol(stock.symbol)}
              activeOpacity={0.7}
            >
              <View style={[styles.stockSentimentDot, { backgroundColor: s.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.stockSymbol, { color: colors.text }]}>{stock.symbol}</Text>
                <Text style={[styles.stockName, { color: colors.textMuted }]} numberOfLines={1}>{stock.name}</Text>
              </View>
              <View style={styles.stockScoreRow}>
                <Text style={[styles.stockScore, { color: s.color }]}>
                  {stock.currentScore > 0 ? '+' : ''}{stock.currentScore}
                </Text>
                <View style={[styles.stockBar, { backgroundColor: colors.bgInput }]}>
                  <View style={[styles.stockBarFill, {
                    width: `${Math.abs(stock.currentScore)}%`,
                    backgroundColor: s.color,
                  }]} />
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          );
        })}

        {/* Recent News */}
        <Text style={[styles.sectionTitle, { marginTop: SPACING.lg }]}>Recent News</Text>
        {selectedSentiment.recentArticles.map(article => (
          <ArticleCard key={article.id} article={article} />
        ))}

        {/* Top Keywords */}
        <View style={[styles.sectionCard, { borderColor: colors.border }]}>
          <Text style={styles.sectionCardTitle}>Trending Keywords</Text>
          <View style={styles.keywordsGrid}>
            {selectedSentiment.topKeywords.map((kw, i) => (
              <View key={i} style={[styles.keywordChip, { backgroundColor: sc.color + '10', borderColor: sc.color + '25' }]}>
                <Text style={[styles.keywordText, { color: sc.color }]}>#{kw}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerContent: { justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  emptyText: { fontSize: 16, fontWeight: '600' },

  // Header
  header: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.text },
  headerSubtitle: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 1 },
  pickerRow: { gap: 8, paddingBottom: SPACING.sm },
  pickerChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  pickerChipText: { fontSize: 13, fontWeight: '700' },

  // Scroll
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.huge },

  // Hero
  heroCard: { borderRadius: BORDER_RADIUS.xl, borderWidth: 1, padding: SPACING.xl, marginBottom: SPACING.lg, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  heroCompany: { ...FONTS.extraBold, fontSize: FONTS.size.lg, color: colors.text, marginBottom: 2 },
  heroSector: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textSecondary },
  scoreChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, backgroundColor: colors.bgCardLight },
  scoreChange: { fontSize: 12, fontWeight: '700' },
  sectionLabel: { ...FONTS.medium, fontSize: FONTS.size.xs, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },

  // Source Card
  sourceCard: { borderRadius: BORDER_RADIUS.md, borderWidth: 1, padding: SPACING.md, marginBottom: SPACING.md },

  // Confidence
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  confidenceLabel: { ...FONTS.medium, fontSize: FONTS.size.xs, color: colors.textMuted, width: 70 },
  confidenceBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  confidenceFill: { height: '100%', borderRadius: 3 },
  confidenceValue: { ...FONTS.bold, fontSize: FONTS.size.xs, width: 35, textAlign: 'right' },

  // Metrics Row
  metricsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  metricCard: { flex: 1, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.md, alignItems: 'center' },
  metricLabel: { ...FONTS.medium, fontSize: FONTS.size.xs, color: colors.textMuted, marginBottom: 4 },
  metricValue: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.text },
  metricChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  metricChange: { fontSize: 10, fontWeight: '700' },
  metricSub: { fontSize: 9, fontWeight: '500', marginTop: 2 },

  // Keywords
  keywordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 4 },
  keywordChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  keywordText: { fontSize: 10, fontWeight: '600' },
  keywordsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },

  // Section Card
  sectionCard: { borderRadius: BORDER_RADIUS.xl, borderWidth: 1, padding: SPACING.xl, marginBottom: SPACING.lg, backgroundColor: colors.bgCard },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sectionCardTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },
  sectionTitle: { ...FONTS.bold, fontSize: FONTS.size.md, color: colors.text, marginBottom: SPACING.md },

  // Shift
  shiftBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: BORDER_RADIUS.full },
  shiftText: { fontSize: 11, fontWeight: '700' },
  shiftAlert: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderLeftWidth: 3, marginTop: SPACING.sm },
  shiftAlertText: { fontSize: 12, lineHeight: 17, fontWeight: '500' },

  // Overview
  overviewCard: { borderRadius: BORDER_RADIUS.xl, borderWidth: 1, padding: SPACING.xl, marginBottom: SPACING.lg, backgroundColor: colors.bgCard },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  overviewTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },
  overviewText: { ...FONTS.regular, fontSize: FONTS.size.sm, lineHeight: 18, marginBottom: SPACING.md },
  filterRow: { gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  filterChipText: { fontSize: 12 },

  // Stock List
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.lg, marginBottom: SPACING.sm },
  stockSentimentDot: { width: 8, height: 8, borderRadius: 4 },
  stockSymbol: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  stockName: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  stockScoreRow: { alignItems: 'flex-end', gap: 3 },
  stockScore: { ...FONTS.bold, fontSize: FONTS.size.sm },
  stockBar: { width: 60, height: 4, borderRadius: 2, overflow: 'hidden' },
  stockBarFill: { height: '100%', borderRadius: 2 },
});
