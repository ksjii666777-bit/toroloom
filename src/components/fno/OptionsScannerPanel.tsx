/**
 * ============================================================================
 * Toroloom — Options Scanner Panel
 * ============================================================================
 *
 * Displays real-time market condition analysis and strategy suggestions
 * based on the live option chain data (PCR, Max Pain, IV, OI).
 *
 * Usage:
 *   import OptionsScannerPanel from '../../components/fno/OptionsScannerPanel';
 *   <OptionsScannerPanel chain={optionChain} symbol={selectedSymbol}
 *     onApplyStrategy={(strategyId) => navigation.navigate('StrategyBuilder', { strategyId })} />
 *
 * ============================================================================
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import Svg, { Rect, Line, Circle, Text as SvgText } from 'react-native-svg';
import { scanMarket, type ScannerResult, type StrategySuggestion} from '../../services/optionsScanner';
import type { OptionChain } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_W = SCREEN_WIDTH - SPACING.xl * 2 - SPACING.md * 2;

// ──── Props ────────────────────────────────────────────────────────────────

interface OptionsScannerPanelProps {
  optionChain: OptionChain | null;
  symbol: string;
  loading?: boolean;
  onApplyStrategy?: (strategyId: string, strategyName: string) => void;
  onNavigateToBuilder?: () => void;
}

// ──── Sub-Components ───────────────────────────────────────────────────────

/** A single signal stat card */
function SignalCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <View style={[signalStyles.card, { borderColor: color + '30' }]}>
      <Text style={signalStyles.icon}>{icon}</Text>
      <Text style={[signalStyles.value, { color }]}>{value}</Text>
      <Text style={[signalStyles.label, { color: color + 'AA' }]}>{label}</Text>
    </View>
  );
}

const signalStyles = StyleSheet.create({
  card: {
    width: (SCREEN_WIDTH - SPACING.xl * 2 - 12) / 3,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  icon: { fontSize: 16 },
  value: { ...FONTS.extraBold, fontSize: FONTS.size.md, fontFamily: 'monospace' },
  label: { ...FONTS.regular, fontSize: 8, textTransform: 'uppercase', textAlign: 'center' },
});

/** Visual gauge for IV level */
function IVGauge({ iv, ivState }: { iv: number; ivState: string }) {
  const colors = { low: '#3B82F6', moderate: '#FFC107', high: '#FF5252' };
  const gaugeColor = colors[ivState as keyof typeof colors] || '#888';
  const pct = Math.min(100, (iv / 35) * 100);

  return (
    <View style={gaugeStyles.container}>
      <View style={gaugeStyles.labelRow}>
        <Text style={gaugeStyles.label}>IV</Text>
        <Text style={[gaugeStyles.value, { color: gaugeColor }]}>{iv.toFixed(1)}%</Text>
      </View>
      <View style={gaugeStyles.track}>
        <View style={[gaugeStyles.fill, { width: `${pct}%`, backgroundColor: gaugeColor }]} />
      </View>
      <Text style={gaugeStyles.stateText}>
        {ivState === 'high' ? '🔥 Elevated' : ivState === 'low' ? '❄️ Low' : '📊 Normal'}
      </Text>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  container: { gap: 4, flex: 1 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...FONTS.regular, fontSize: 9, textTransform: 'uppercase' },
  value: { ...FONTS.extraBold, fontSize: FONTS.size.sm, fontFamily: 'monospace' },
  track: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  stateText: { ...FONTS.semiBold, fontSize: 9 },
});

/** A suggestion card */
function SuggestionCard({
  suggestion,
  colors,
  onApply,
}: {
  suggestion: StrategySuggestion;
  colors: any;
  onApply: (id: string, name: string) => void;
}) {
  const dirColor = suggestion.direction === 'bullish' ? '#00C853'
    : suggestion.direction === 'bearish' ? '#FF1744' : '#FFC107';
  const riskColor = suggestion.riskCategory === 'low' ? '#00C853'
    : suggestion.riskCategory === 'moderate' ? '#FFC107' : '#FF5252';

  return (
    <View style={[sugStyles.card, { backgroundColor: colors.bgCard, borderColor: dirColor + '30' }]}>
      {/* Top row: name + confidence */}
      <View style={sugStyles.topRow}>
        <View style={[sugStyles.dirBadge, { backgroundColor: dirColor + '20' }]}>
          <Text style={[sugStyles.dirText, { color: dirColor }]}>
            {suggestion.direction === 'bullish' ? '📈' : suggestion.direction === 'bearish' ? '📉' : '↔️'} {suggestion.direction.toUpperCase()}
          </Text>
        </View>
        <View style={[sugStyles.confPill, { backgroundColor: suggestion.confidence >= 80 ? '#00C85320' : suggestion.confidence >= 60 ? '#FFC10720' : '#FF174420' }]}>
          <Text style={[sugStyles.confText, { color: suggestion.confidence >= 80 ? '#00C853' : suggestion.confidence >= 60 ? '#FFC107' : '#FF1744' }]}>
            {suggestion.confidence}%
          </Text>
        </View>
      </View>

      <Text style={[sugStyles.name, { color: colors.text }]}>{suggestion.strategyName}</Text>
      <Text style={[sugStyles.rationale, { color: colors.textSecondary }]} numberOfLines={2}>
        {suggestion.rationale}
      </Text>

      {/* Tags + Apply */}
      <View style={sugStyles.bottomRow}>
        <View style={[sugStyles.riskBadge, { backgroundColor: riskColor + '20' }]}>
          <Text style={[sugStyles.riskText, { color: riskColor }]}>{suggestion.riskCategory}</Text>
        </View>          <Pressable
          style={({pressed}) => [[sugStyles.applyBtn, { backgroundColor: dirColor }], {opacity: pressed ? 0.8 : 1}]}
          onPress={() => onApply(suggestion.strategyId, suggestion.strategyName)}
        >
          <Ionicons name="flash" size={14} color={colors.white} />
          <Text style={[sugStyles.applyText, { color: colors.white }]}>Apply</Text>
        </Pressable>
      </View>
    </View>
  );
}

const sugStyles = StyleSheet.create({
  card: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dirBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  dirText: {
    ...FONTS.semiBold,
    fontSize: 9,
  },
  confPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  confText: {
    ...FONTS.extraBold,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  name: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  rationale: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    lineHeight: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  riskText: {
    ...FONTS.semiBold,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  applyText: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.xs,
  },
});

/** OI Profile mini-chart — shows where OI is concentrated across strikes */
function OIProfileChart({ chain, colors, spotPrice, supportLevel, resistanceLevel }: { chain: OptionChain; colors: any; spotPrice: number; supportLevel: number; resistanceLevel: number }) {
  if (!chain.rows || chain.rows.length < 3) return null;

  // Sample every Nth row to keep chart readable
  const step = Math.max(1, Math.floor(chain.rows.length / 20));
  const sampled = chain.rows.filter((_, i) => i % step === 0 || i === chain.rows.length - 1);

  const maxOi = Math.max(
    ...sampled.map(r => Math.max(r.ce?.openInterest || 0, r.pe?.openInterest || 0)),
    1,
  );
  const chartH = 80;
  const chartW = CHART_W;
  const barW = Math.max(4, (chartW - 8) / sampled.length - 1);
  const midY = chartH - 8;

  return (
    <View style={oiStyles.container}>
      <Text style={oiStyles.title}>OI Concentration</Text>
      <Svg width={chartW} height={chartH}>
        {sampled.map((row, i) => {
          const x = 4 + i * (barW + 1);
          const ceOi = (row.ce?.openInterest || 0) / maxOi * (chartH - 16);
          const peOi = (row.pe?.openInterest || 0) / maxOi * (chartH - 16);

          return (
            <React.Fragment key={row.strike}>
              {/* PE OI (downward from middle, red) */}
              {peOi > 0 && (
                <Rect
                  x={x} y={midY} width={barW} height={Math.max(1, peOi)}
                  fill="#FF5252" opacity={0.5} rx={1}
                />
              )}
              {/* CE OI (upward from middle, green) */}
              {ceOi > 0 && (
                <Rect
                  x={x} y={midY - ceOi} width={barW} height={Math.max(1, ceOi)}
                  fill="#00C853" opacity={0.5} rx={1}
                />
              )}
              {/* Strike label (every few) */}
              {i % 3 === 0 && (
                <SvgText
                  x={x + barW / 2} y={chartH - 2}
                  fill={colors.textMuted} fontSize={6} textAnchor="middle"
                >
                  {row.strike}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
        {/* Spot price line */}
        {spotPrice > 0 && (
          <Line
            x1={0} y1={midY} x2={chartW} y2={midY}
            stroke={colors.textMuted} strokeWidth={0.5} strokeDasharray="3,2" opacity={0.3}
          />
        )}
      </Svg>
      <View style={oiStyles.legend}>
        <View style={oiStyles.legendItem}>
          <View style={[oiStyles.legendDot, { backgroundColor: '#00C853' }]} />
          <Text style={[oiStyles.legendText, { color: colors.textMuted }]}>CE OI</Text>
        </View>
        <View style={oiStyles.legendItem}>
          <View style={[oiStyles.legendDot, { backgroundColor: '#FF5252' }]} />
          <Text style={[oiStyles.legendText, { color: colors.textMuted }]}>PE OI</Text>
        </View>
        <Text style={[oiStyles.legendText, { color: colors.textMuted }]}>
          Support: {supportLevel > 0 ? formatCurrency(supportLevel, true) : '—'} · Resistance: {resistanceLevel > 0 ? formatCurrency(resistanceLevel, true) : '—'}
        </Text>
      </View>
    </View>
  );
}

const oiStyles = StyleSheet.create({
  container: { marginTop: SPACING.sm, gap: 4 },
  title: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { ...FONTS.regular, fontSize: 8 },
});

// ──── Main Component ───────────────────────────────────────────────────────

export default function OptionsScannerPanel({
  optionChain,
  symbol,
  loading = false,
  onApplyStrategy,
  onNavigateToBuilder,
}: OptionsScannerPanelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const result = useMemo<ScannerResult | null>(() => {
    if (!optionChain || !optionChain.rows || optionChain.rows.length < 5) return null;
    return scanMarket(optionChain, symbol);
  }, [optionChain, symbol]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Analyzing market conditions...</Text>
      </View>
    );
  }

  if (!optionChain) {
    return (
      <View style={styles.centered}>
        <Ionicons name="options-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Data</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Select a symbol and expiry to view the options scanner
        </Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.centered}>
        <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Insufficient Data</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Need at least 5 strike rows to analyze market conditions
        </Text>
      </View>
    );
  }

  const { marketCondition: mc, suggestions } = result;
  const biasColor = mc.bias === 'bullish' ? '#00C853'
    : mc.bias === 'bearish' ? '#FF1744' : '#FFC107';

  return (
    <View style={styles.container}>
      {/* ── Bias Banner ── */}
      <View style={[styles.biasBanner, { backgroundColor: biasColor + '12', borderColor: biasColor + '30' }]}>
        <View style={[styles.biasGlow, { backgroundColor: biasColor }]} />
        <View style={styles.biasContent}>
          <Text style={[styles.biasLabel, { color: biasColor }]}>
            {mc.bias === 'bullish' ? '📈 BULLISH' : mc.bias === 'bearish' ? '📉 BEARISH' : '↔️ NEUTRAL'}
          </Text>
          <Text style={[styles.biasSignals, { color: colors.textSecondary }]}>
            {mc.bullishSignals}/{mc.totalSignals} bullish signals · {mc.bearishSignals}/{mc.totalSignals} bearish signals
          </Text>
          <Text style={[styles.summaryLine, { color: colors.text }]} numberOfLines={1}>
            {result.summaryLine}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Signal Cards ── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Market Signals</Text>
        <View style={styles.signalRow}>
          <SignalCard label="Put-Call Ratio" value={mc.pcr.toFixed(2)} color={mc.pcr >= 1.2 ? '#FF1744' : mc.pcr <= 0.7 ? '#00C853' : '#FFC107'} icon="📊" />
          <SignalCard label="Max Pain" value={formatCurrency(mc.maxPain, true)} color={mc.maxPainDistancePercent > 0.5 ? '#3B82F6' : '#FFC107'} icon="🎯" />
          <SignalCard label="Bias Signals" value={`${mc.bullishSignals}-${mc.bearishSignals}`} color={biasColor} icon="⚡" />
        </View>

        {/* IV Gauge */}
        <View style={[styles.ivCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <IVGauge iv={mc.avgAtmIv} ivState={mc.ivState} />
        </View>

        {/* ── OI Profile ── */}
        {optionChain && (
          <OIProfileChart chain={optionChain} colors={colors} spotPrice={mc.spotPrice} supportLevel={mc.supportLevel} resistanceLevel={mc.resistanceLevel} />
        )}

        {/* ── Support / Resistance ── */}
        <View style={styles.srRow}>
          <View style={[styles.srCard, { backgroundColor: '#00C85310', borderColor: '#00C85330' }]}>
            <Text style={styles.srIcon}>🛡️</Text>
            <Text style={[styles.srLabel, { color: '#00C853' }]}>Support</Text>
            <Text style={[styles.srValue, { color: colors.text }]}>
              {mc.supportLevel > 0 ? formatCurrency(mc.supportLevel, true) : '—'}
            </Text>
          </View>
          <View style={[styles.srCard, { backgroundColor: '#FF174410', borderColor: '#FF174430' }]}>
            <Text style={styles.srIcon}>🔴</Text>
            <Text style={[styles.srLabel, { color: '#FF1744' }]}>Resistance</Text>
            <Text style={[styles.srValue, { color: colors.text }]}>
              {mc.resistanceLevel > 0 ? formatCurrency(mc.resistanceLevel, true) : '—'}
            </Text>
          </View>
          <View style={[styles.srCard, { backgroundColor: '#3B82F610', borderColor: '#3B82F630' }]}>
            <Text style={styles.srIcon}>📌</Text>
            <Text style={[styles.srLabel, { color: '#3B82F6' }]}>Spot</Text>
            <Text style={[styles.srValue, { color: colors.text }]}>
              {formatCurrency(mc.spotPrice, true)}
            </Text>
          </View>
        </View>

        {/* ── Strategy Suggestions ── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Recommended Strategies ({suggestions.length})
        </Text>
        {suggestions.length === 0 ? (
          <View style={styles.centered}>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              No strategies match current market conditions
            </Text>
          </View>
        ) : (
          suggestions.map((suggestion, i) => (
            <SuggestionCard
              key={`${suggestion.strategyId}_${i}`}
              suggestion={suggestion}
              colors={colors}
              onApply={(id, name) => {
                if (onApplyStrategy) {
                  onApplyStrategy(id, name);
                } else if (onNavigateToBuilder) {
                  onNavigateToBuilder();
                }
              }}
            />
          ))
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const createStyles = (_colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: SPACING.sm,
  },
  loadingText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    marginTop: SPACING.sm,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
  },
  emptySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  // Bias banner
  biasBanner: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  biasGlow: {
    width: 4,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderBottomLeftRadius: BORDER_RADIUS.lg,
  },
  biasContent: {
    flex: 1,
    padding: SPACING.md,
    gap: 4,
  },
  biasLabel: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.lg,
  },
  biasSignals: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  summaryLine: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    fontFamily: 'monospace',
  },
  // Section
  sectionTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  // Signals
  signalRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  // IV Card
  ivCard: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  // S/R
  srRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  srCard: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  srIcon: { fontSize: 16 },
  srLabel: { ...FONTS.semiBold, fontSize: 8, textTransform: 'uppercase' },
  srValue: { ...FONTS.extraBold, fontSize: FONTS.size.sm, fontFamily: 'monospace' },
});
