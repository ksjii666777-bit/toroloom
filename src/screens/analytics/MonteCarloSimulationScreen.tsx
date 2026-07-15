import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Path, Line, Text as SvgText, G } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { runMonteCarloSimulation, formatRupees } from '../../services/monteCarloSimulation';
import type { MonteCarloParams, MonteCarloResult, MonteCarloYearResult } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - SPACING.xl * 2 - SPACING.xl * 2;
const CHART_HEIGHT = 220;
const CHART_PADDING = { top: 20, bottom: 30, left: 60, right: 20 };

// ─── Default params ───────────────────────────────────────────
const DEFAULT_PARAMS: MonteCarloParams = {
  initialInvestment: 500000,
  monthlyContribution: 10000,
  annualReturn: 0.12,
  annualVolatility: 0.18,
  years: 10,
  simulations: 10000,
};

// ─── Input field config ───────────────────────────────────────
interface InputField {
  key: keyof MonteCarloParams;
  label: string;
  icon: string;
  suffix: string;
  placeholder: string;
  info: string;
}

const INPUT_FIELDS: InputField[] = [
  { key: 'initialInvestment', label: 'Initial Investment', icon: 'wallet', suffix: '₹', placeholder: 'e.g. 500000', info: 'Your current portfolio value' },
  { key: 'monthlyContribution', label: 'Monthly SIP', icon: 'trending-up', suffix: '₹', placeholder: 'e.g. 10000', info: 'Amount you add each month' },
  { key: 'annualReturn', label: 'Expected Return', icon: 'trending-up', suffix: '%', placeholder: 'e.g. 12', info: 'Expected annual return (Nifty ~12-14%)' },
  { key: 'annualVolatility', label: 'Volatility', icon: 'pulse', suffix: '%', placeholder: 'e.g. 18', info: 'Expected annual volatility (Nifty ~15-20%)' },
  { key: 'years', label: 'Time Horizon', icon: 'calendar', suffix: 'yr', placeholder: 'e.g. 10', info: 'Investment horizon in years' },
];

// ─── Color palette for percentile bands ───────────────────────
const BAND_COLORS = [
  { upper: '#6C63FF40', lower: '#6C63FF15', line: '#6C63FF' },   // 75th-25th
  { upper: '#3B82F630', lower: '#3B82F610', line: '#3B82F6' },   // 95th-5th
];

// ─── Percentile line configs ──────────────────────────────────
const PERCENTILE_CONFIGS = [
  { p: 50, color: '#6C63FF', width: 2.5, dash: '' as const },
  { p: 25, color: '#6C63FF80', width: 1.5, dash: '4,3' as const },
  { p: 75, color: '#6C63FF80', width: 1.5, dash: '4,3' as const },
  { p: 5, color: '#3B82F660', width: 1, dash: '2,4' as const },
  { p: 95, color: '#3B82F660', width: 1, dash: '2,4' as const },
];

// ================================================================
// COMPONENT
// ================================================================

export default function MonteCarloSimulationScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Input state ────────────────────────────────────────────
  const [params, setParams] = useState<MonteCarloParams>({ ...DEFAULT_PARAMS });
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [hasRun, setHasRun] = useState(false);

  // ── Input change handler ───────────────────────────────────
  const handleParamChange = useCallback((key: keyof MonteCarloParams, raw: string) => {
    const parsed = parseFloat(raw.replace(/,/g, ''));
    if (isNaN(parsed)) return;

    setParams(prev => {
      if (key === 'annualReturn' || key === 'annualVolatility') {
        return { ...prev, [key]: parsed / 100 };
      }
      return { ...prev, [key]: Math.round(parsed) };
    });
  }, []);

  // ── Run simulation ─────────────────────────────────────────
  const handleRun = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRunning(true);

    // Simulate computation delay so UI shows loading state
    setTimeout(() => {
      const simResult = runMonteCarloSimulation(params);
      setResult(simResult);
      setHasRun(true);
      setIsRunning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 300);
  }, [params]);

  // ── Quick presets ──────────────────────────────────────────
  const applyPreset = useCallback((preset: Partial<MonteCarloParams>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setParams(prev => ({ ...prev, ...preset }));
    setResult(null);
    setHasRun(false);
  }, []);

  // ── Display helpers ────────────────────────────────────────
  const formatPercent = (v: number) => `${(v * 100).toFixed(1)}%`;
  const formatCurrency = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Header ───────────────────────────────────────── */}
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9}>
            <View style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </View>
          </AnimatedPressable>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Monte Carlo</Text>
            <Text style={styles.subtitle}>10,000 portfolio risk scenarios</Text>
          </View>
        </View>

        {/* ── Info Banner ──────────────────────────────────── */}
        <Animated.View entering={FadeInUp.springify()}>
          <LinearGradient
            colors={['rgba(108,99,255,0.15)', 'rgba(59,130,246,0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.infoBanner}
          >
            <Ionicons name="information-circle" size={18} color="#6C63FF" />
            <Text style={styles.infoText}>
              Simulates {params.simulations.toLocaleString()} possible futures for your portfolio using Geometric Brownian Motion. Results show percentile ranges.
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* ── Input Section ────────────────────────────────── */}
        <Card title="Portfolio Parameters" style={styles.sectionCard}>
          <View style={styles.inputFields}>
            {INPUT_FIELDS.map((field, i) => {
              const displayValue = (() => {
                const val = params[field.key];
                if (typeof val === 'number') {
                  if (field.key === 'annualReturn' || field.key === 'annualVolatility') {
                    return (val * 100).toString();
                  }
                  return val.toLocaleString('en-IN');
                }
                return '';
              })();

              return (
                <Animated.View
                  key={field.key}
                  entering={FadeInDown.delay(100 + i * 60).springify()}
                  style={styles.inputRow}
                >
                  <View style={styles.inputLabelRow}>
                    <Ionicons
                      name={field.icon as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.inputLabel}>{field.label}</Text>
                    <View style={styles.inputInfoTooltip}>
                      <Text style={styles.inputInfoIcon}>?</Text>
                    </View>
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputSuffix}>{field.suffix}</Text>
                    <TextInput
                      style={styles.input}
                      value={displayValue}
                      onChangeText={(t) => handleParamChange(field.key, t)}
                      keyboardType="numeric"
                      placeholderTextColor={colors.textMuted}
                      placeholder={field.placeholder}
                    />
                    <Text style={styles.inputUnit}>{field.key === 'years' ? 'years' : ''}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>

          {/* ── Quick Presets ──────────────────────────────── */}
          <View style={styles.presetsRow}>
            <Text style={styles.presetsLabel}>Quick Presets:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
              {[
                { label: 'Conservative', icon: '🛡️', params: { annualReturn: 0.10, annualVolatility: 0.12 } as Partial<MonteCarloParams> },
                { label: 'Moderate', icon: '📊', params: { annualReturn: 0.12, annualVolatility: 0.18 } as Partial<MonteCarloParams> },
                { label: 'Aggressive', icon: '🚀', params: { annualReturn: 0.16, annualVolatility: 0.25 } as Partial<MonteCarloParams> },
                { label: 'SIP Only', icon: '💪', params: { initialInvestment: 0, monthlyContribution: 25000 } as Partial<MonteCarloParams> },
              ].map((preset, i) => (
                <AnimatedPressable
                  key={i}
                  onPress={() => applyPreset(preset.params)}
                  haptic="light"
                  scaleTo={0.95}
                  style={styles.presetChip}
                >
                  <Text style={styles.presetIcon}>{preset.icon}</Text>
                  <Text style={styles.presetLabel}>{preset.label}</Text>
                </AnimatedPressable>
              ))}
            </ScrollView>
          </View>
        </Card>

        {/* ── Run Button ───────────────────────────────────── */}
        <AnimatedPressable
          onPress={handleRun}
          haptic="medium"
          scaleTo={0.97}
          disabled={isRunning}
        >
          <LinearGradient
            colors={GRADIENTS.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.runBtn}
          >
            {isRunning ? (
              <>
                <Text style={styles.runBtnIcon}>⚡</Text>
                <Text style={styles.runBtnText}>Running {params.simulations.toLocaleString()} Simulations...</Text>
              </>
            ) : (
              <>
                <Ionicons name="flash" size={22} color="#fff" />
                <Text style={styles.runBtnText}>
                  {hasRun ? 'Re-run Simulation' : 'Run Simulation'}
                </Text>
              </>
            )}
          </LinearGradient>
        </AnimatedPressable>

        {/* ── Results ──────────────────────────────────────── */}
        {result && (
          <Animated.View entering={FadeInUp.delay(100).springify()}>
            {/* ── Key Metrics Grid ──────────────────────────── */}
            <View style={styles.metricsGrid}>
              {[
                { label: 'Median Value', value: formatRupees(result.medianEndValue), icon: '📈', color: '#6C63FF' },
                { label: 'Best Case (95th)', value: formatRupees(result.bestCaseValue), icon: '🚀', color: '#00C853' },
                { label: 'Worst Case (5th)', value: formatRupees(result.worstCaseValue), icon: '📉', color: '#FF1744' },
                { label: 'Profit Probability', value: `${result.probabilityOfProfit}%`, icon: '🎯', color: '#FFC107' },
              ].map((metric, i) => (
                <Animated.View
                  key={metric.label}
                  entering={FadeInDown.delay(200 + i * 80).springify()}
                  style={[styles.metricCard, { borderColor: metric.color + '30' }]}
                >
                  <Text style={styles.metricIcon}>{metric.icon}</Text>
                  <Text style={[styles.metricValue, { color: metric.color }]}>{metric.value}</Text>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                </Animated.View>
              ))}
            </View>

            {/* ── Investment Summary ─────────────────────────── */}
            <Card title="Investment Summary" style={styles.sectionCard}>
              {(() => {
                const totalContributed = result.params.initialInvestment + result.params.monthlyContribution * result.params.years * 12;
                const medianReturn = result.medianEndValue - totalContributed;
                const medianReturnPct = (medianReturn / totalContributed) * 100;
                return (
                  <View style={styles.summaryContent}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total Invested</Text>
                      <Text style={styles.summaryValue}>{formatCurrency(totalContributed)}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Median Final Value</Text>
                      <Text style={styles.summaryValue}>{formatRupees(result.medianEndValue)}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Median Return</Text>
                      <Text style={[styles.summaryValue, { color: medianReturn >= 0 ? '#00C853' : '#FF1744' }]}>
                        {formatCurrency(medianReturn)} ({medianReturnPct.toFixed(1)}%)
                      </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Range (5th–95th)</Text>
                      <Text style={styles.summaryValue}>
                        {formatRupees(result.worstCaseValue)} – {formatRupees(result.bestCaseValue)}
                      </Text>
                    </View>
                  </View>
                );
              })()}
            </Card>

            {/* ── Percentile Fan Chart (SVG) ─────────────────── */}
            <Card title="Portfolio Growth Projection" subtitle="Percentile ranges over time" style={styles.sectionCard}>
              <View style={styles.chartContainer}>
                {result.yearResults.length > 0 && (
                  <MonteCarloChart
                    yearResults={result.yearResults}
                    allPaths={result.allPaths}
                    width={CHART_WIDTH}
                    height={CHART_HEIGHT}
                  />
                )}
              </View>

              {/* Chart Legend */}
              <View style={styles.chartLegend}>
                <View style={styles.legendRow}>
                  <View style={[styles.legendLine, { backgroundColor: '#6C63FF', width: 20, height: 2.5 }]} />
                  <Text style={styles.legendText}>Median (50th)</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendLine, { backgroundColor: '#6C63FF80', borderStyle: 'dashed', height: 1.5 }]} />
                  <Text style={styles.legendText}>25th–75th Percentile</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendLine, { backgroundColor: '#3B82F660', borderStyle: 'dashed', height: 1 }]} />
                  <Text style={styles.legendText}>5th–95th Percentile</Text>
                </View>
              </View>
            </Card>

            {/* ── Distribution Summary ───────────────────────── */}
            <Card title="Distribution Analysis" style={styles.sectionCard}>
              {(() => {
                const sorted = result.finalValues;
                const median = result.medianEndValue;
                const totalInvested = params.initialInvestment + params.monthlyContribution * params.years * 12;

                // Count how many are above certain thresholds
                const doubleCount = sorted.filter(v => v >= totalInvested * 2).length;
                const tripleCount = sorted.filter(v => v >= totalInvested * 3).length;
                const loseMoneyCount = sorted.filter(v => v < totalInvested).length;
                const total = sorted.length;

                return (
                  <View style={styles.distContent}>
                    <View style={styles.distRow}>
                      <View style={styles.distItem}>
                        <Text style={styles.distValue}>{result.probabilityOfProfit}%</Text>
                        <Text style={styles.distLabel}>Probability of Profit</Text>
                      </View>
                      <View style={styles.distItem}>
                        <Text style={[styles.distValue, { color: '#FF1744' }]}>
                          {((loseMoneyCount / total) * 100).toFixed(0)}%
                        </Text>
                        <Text style={styles.distLabel}>Chance of Loss</Text>
                      </View>
                    </View>
                    <View style={styles.distRow}>
                      <View style={styles.distItem}>
                        <Text style={[styles.distValue, { color: '#00C853' }]}>
                          {((doubleCount / total) * 100).toFixed(0)}%
                        </Text>
                        <Text style={styles.distLabel}>Chance to 2x Investment</Text>
                      </View>
                      <View style={styles.distItem}>
                        <Text style={[styles.distValue, { color: '#6C63FF' }]}>
                          {((tripleCount / total) * 100).toFixed(0)}%
                        </Text>
                        <Text style={styles.distLabel}>Chance to 3x Investment</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </Card>

            {/* ── Interpretations ──────────────────────────── */}
            <Card title="What This Means" style={styles.sectionCard}>
              <View style={styles.interpretContent}>
                <View style={styles.interpretRow}>
                  <Text style={styles.interpretIcon}>📊</Text>
                  <Text style={styles.interpretText}>
                    The median (50th percentile) outcome is <Text style={styles.interpretBold}>{formatRupees(result.medianEndValue)}</Text> — half of all scenarios end above this, half below.
                  </Text>
                </View>
                <View style={styles.interpretDivider} />
                <View style={styles.interpretRow}>
                  <Text style={styles.interpretIcon}>🟢</Text>
                  <Text style={styles.interpretText}>
                    In <Text style={styles.interpretBold}>{result.probabilityOfProfit}%</Text> of scenarios, your portfolio ends with positive returns.
                  </Text>
                </View>
                <View style={styles.interpretDivider} />
                <View style={styles.interpretRow}>
                  <Text style={styles.interpretIcon}>⚠️</Text>
                  <Text style={styles.interpretText}>
                    The 5th percentile outcome ({formatRupees(result.worstCaseValue)}) represents a worst-case scenario that only occurs 5% of the time.
                  </Text>
                </View>
              </View>
            </Card>

            {/* ── Parameters Used ─────────────────────────── */}
            <Card title="Parameters Used" style={styles.sectionCard}>
              <View style={styles.paramsContent}>
                <View style={styles.paramRow}>
                  <Text style={styles.paramLabel}>Initial Investment</Text>
                  <Text style={styles.paramValue}>{formatCurrency(result.params.initialInvestment)}</Text>
                </View>
                <View style={styles.paramRow}>
                  <Text style={styles.paramLabel}>Monthly SIP</Text>
                  <Text style={styles.paramValue}>{formatCurrency(result.params.monthlyContribution)}</Text>
                </View>
                <View style={styles.paramRow}>
                  <Text style={styles.paramLabel}>Expected Return</Text>
                  <Text style={styles.paramValue}>{formatPercent(result.params.annualReturn)}</Text>
                </View>
                <View style={styles.paramRow}>
                  <Text style={styles.paramLabel}>Volatility</Text>
                  <Text style={styles.paramValue}>{formatPercent(result.params.annualVolatility)}</Text>
                </View>
                <View style={styles.paramRow}>
                  <Text style={styles.paramLabel}>Time Horizon</Text>
                  <Text style={styles.paramValue}>{result.params.years} years</Text>
                </View>
                <View style={styles.paramRow}>
                  <Text style={styles.paramLabel}>Simulations</Text>
                  <Text style={styles.paramValue}>{result.params.simulations.toLocaleString()}</Text>
                </View>
              </View>
            </Card>
          </Animated.View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
// SVG PERCENTILE FAN CHART
// ══════════════════════════════════════════════════════════════

function MonteCarloChart({
  yearResults,
  allPaths,
  width,
  height,
}: {
  yearResults: MonteCarloYearResult[];
  allPaths: number[][];
  width: number;
  height: number;
}) {
  const { top, bottom, left, right } = CHART_PADDING;
  const chartW = width - left - right;
  const chartH = height - top - bottom;

  // Find global min/max across all data
  const allValues = yearResults.flatMap(yr =>
    yr.percentiles.map(p => p.value),
  );
  const allPathValues = allPaths.flat();
  const dataMin = Math.min(...allValues, ...allPathValues) * 0.9;
  const dataMax = Math.max(...allValues, ...allPathValues) * 1.1;
  const range = dataMax - dataMin || 1;

  const xScale = (yr: number) => left + (yr / yearResults.length) * chartW;
  const yScale = (v: number) => top + chartH - ((v - dataMin) / range) * chartH;

  // Build percentile lines
  const percentileToPoints = (p: number) =>
    yearResults.map(yr => {
      const pObj = yr.percentiles.find(pp => pp.percentile === p);
      return { x: xScale(yr.year), y: yScale(pObj?.value ?? 0) };
    });

  // build SVG path d from points
  const pointsToPath = (pts: { x: number; y: number }[]) =>
    pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');

  // Shade regions between percentile bands
  const bandPaths = [
    {
      upper: percentileToPoints(75),
      lower: [...percentileToPoints(25)].reverse(),
      color: '#6C63FF20',
    },
    {
      upper: percentileToPoints(95),
      lower: [...percentileToPoints(5)].reverse(),
      color: '#3B82F610',
    },
  ];

  // Y-axis labels
  const yLabelsCount = 5;
  const yLabels = Array.from({ length: yLabelsCount }, (_, i) => {
    const val = dataMin + (range * i) / (yLabelsCount - 1);
    return { value: val, y: top + chartH - (chartH * i) / (yLabelsCount - 1) };
  });

  // X-axis labels
  const xLabelEvery = Math.max(1, Math.floor(yearResults.length / 6));
  const xLabels = yearResults
    .filter((_, i) => i % xLabelEvery === 0)
    .map(yr => ({ year: yr.year, x: xScale(yr.year) }));

  return (
    <Svg width={width} height={height}>
      {/* Grid lines */}
      {yLabels.map((label, i) => (
        <G key={`grid-${i}`}>
          <Line
            x1={left}
            y1={label.y}
            x2={left + chartW}
            y2={label.y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        </G>
      ))}

      {/* Shaded percentile bands */}
      {bandPaths.map((band, i) => (
        <Path
          key={`band-${i}`}
          d={pointsToPath([...band.upper, ...band.lower])}
          fill={band.color}
        />
      ))}

      {/* Individual simulation paths (thin, low opacity) */}
      {allPaths.slice(0, 50).map((path, i) => {
        const pts = path.map((v, mi) => ({
          x: xScale(mi / 12),
          y: yScale(v),
        }));
        return (
          <Path
            key={`path-${i}`}
            d={pointsToPath(pts)}
            stroke="rgba(108,99,255,0.08)"
            strokeWidth={0.5}
            fill="none"
          />
        );
      })}

      {/* Percentile lines */}
      {PERCENTILE_CONFIGS.map(cfg => {
        const pts = percentileToPoints(cfg.p);
        return (
          <Path
            key={`pline-${cfg.p}`}
            d={pointsToPath(pts)}
            stroke={cfg.color}
            strokeWidth={cfg.width}
            fill="none"
            strokeDasharray={cfg.dash || undefined}
          />
        );
      })}

      {/* Y-axis labels */}
      {yLabels.map((label, i) => (
        <SvgText
          key={`yl-${i}`}
          x={left - 8}
          y={label.y + 4}
          fill="rgba(255,255,255,0.4)"
          fontSize={10}
          textAnchor="end"
          fontFamily="System"
        >
          {formatYLabel(label.value)}
        </SvgText>
      ))}

      {/* X-axis labels */}
      {xLabels.map((label, i) => (
        <SvgText
          key={`xl-${i}`}
          x={label.x}
          y={height - 6}
          fill="rgba(255,255,255,0.4)"
          fontSize={10}
          textAnchor="middle"
          fontFamily="System"
        >
          Yr {label.year}
        </SvgText>
      ))}

      {/* Y-axis title */}
      <SvgText
        x={12}
        y={top + chartH / 2}
        fill="rgba(255,255,255,0.3)"
        fontSize={9}
        textAnchor="middle"
        rotation={-90}
        originX={12}
        originY={top + chartH / 2}
        fontFamily="System"
      >
        Portfolio Value
      </SvgText>
    </Svg>
  );
}

function formatYLabel(value: number): string {
  if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toFixed(0);
}

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 100,
    paddingHorizontal: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // ── Info Banner ──────────────────────────────────────────────
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(108,99,255,0.2)',
  },
  infoText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },

  // ── Section Card ─────────────────────────────────────────────
  sectionCard: {
    marginBottom: SPACING.md,
  },

  // ── Input Fields ─────────────────────────────────────────────
  inputFields: {
    gap: SPACING.md,
    paddingTop: SPACING.md,
  },
  inputRow: {
    gap: SPACING.xs,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inputLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
    flex: 1,
  },
  inputInfoTooltip: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.textMuted + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputInfoIcon: {
    ...FONTS.bold,
    fontSize: 10,
    color: colors.textMuted,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  inputSuffix: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.text,
    height: '100%',
  },
  inputUnit: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginLeft: SPACING.xs,
  },

  // ── Presets ──────────────────────────────────────────────────
  presetsRow: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  presetsLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginBottom: SPACING.sm,
  },
  presetsScroll: {
    marginHorizontal: -SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: SPACING.sm,
  },
  presetIcon: {
    fontSize: 14,
  },
  presetLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.text,
  },

  // ── Run Button ───────────────────────────────────────────────
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.lg,
  },
  runBtnIcon: {
    fontSize: 18,
  },
  runBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: '#fff',
  },

  // ── Metrics Grid ─────────────────────────────────────────────
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  metricCard: {
    width: (SCREEN_WIDTH - SPACING.xl * 2 - SPACING.sm) / 2,
    backgroundColor: colors.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  metricIcon: {
    fontSize: 24,
  },
  metricValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  metricLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // ── Investment Summary ───────────────────────────────────────
  summaryContent: {
    gap: 0,
    paddingTop: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  summaryLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },

  // ── Chart ────────────────────────────────────────────────────
  chartContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginTop: SPACING.md,
    flexWrap: 'wrap',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLine: {
    borderRadius: 1,
  },
  legendText: {
    ...FONTS.regular,
    fontSize: 10,
    color: colors.textMuted,
  },

  // ── Distribution ─────────────────────────────────────────────
  distContent: {
    gap: SPACING.md,
    paddingTop: SPACING.md,
  },
  distRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  distItem: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  distValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  distLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // ── Interpretation ──────────────────────────────────────────
  interpretContent: {
    gap: 0,
    paddingTop: SPACING.md,
  },
  interpretRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  interpretIcon: {
    fontSize: 18,
    marginTop: 2,
  },
  interpretText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  interpretBold: {
    ...FONTS.semiBold,
    color: colors.text,
  },
  interpretDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },

  // ── Parameters ──────────────────────────────────────────────
  paramsContent: {
    gap: 0,
    paddingTop: SPACING.md,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  paramLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
  },
  paramValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
});
