/**
 * ============================================================================
 * Toroloom — Algo Trading & Backtesting Screen
 * ============================================================================
 *
 * Full-screen strategy backtester. Users can:
 *   - Select from 6 preset strategy templates
 *   - Write custom entry/exit formulas (powered by the formula engine)
 *   - Set stop loss, take profit, trailing stop parameters
 *   - Choose position sizing method
 *   - Run backtest against up to 2 years of mock data
 *   - View detailed results: trade log, equity curve, performance metrics
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { FONTS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import { useNavigation } from '@react-navigation/native';
import { validateFormula } from '../../utils/indicatorFormulaEngine';
import {
  runAlgoBacktest,
  generateMockHistory,
  type AlgoStrategy,
  type AlgoTrade,
  type AlgoBacktestResult,
} from '../../services/algoBacktestEngine';
import {
  useAlgoStrategyStore,
  STRATEGY_TEMPLATES,
} from '../../store/algoStrategyStore';
import Svg, { Path, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

// ============================================================================
// Mock stock symbols
// ============================================================================

const STOCK_SYMBOLS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK',
  'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK',
  'BAJFINANCE', 'LT', 'WIPRO', 'AXISBANK', 'TITAN',
];

// ============================================================================
// Mini Equity Curve Chart
// ============================================================================

function MiniEquityCurve({
  equityCurve,
  height = 120,
  color = '#45B7D1',
}: {
  equityCurve: { date: string; equity: number; drawdown: number }[];
  height?: number;
  color?: string;
}) {
  if (equityCurve.length < 2) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'System', fontSize: 12, color: '#888' }}>Not enough data</Text>
      </View>
    );
  }

  const width = Dimensions.get('window').width - 64;
  const padding = { top: 16, bottom: 24, left: 8, right: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = equityCurve.map(p => p.equity);
  const mn = Math.min(...values, 0);
  const mx = Math.max(...values, 1);
  const range = (mx - mn) || 1;

  const getX = (i: number) => padding.left + (i / (values.length - 1)) * chartW;
  const getY = (v: number) => padding.top + ((mx - v) / range) * chartH;
  const zeroY = getY(0);

  let path = `M ${getX(0)} ${getY(values[0])}`;
  for (let i = 1; i < values.length; i++) {
    path += ` L ${getX(i)} ${getY(values[i])}`;
  }
  const areaPath = `${path} L ${getX(values.length - 1)} ${zeroY} L ${getX(0)} ${zeroY} Z`;
  const isPositive = values[values.length - 1] >= 0;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </LinearGradient>
      </Defs>
      {mn < 0 && mx > 0 && (
        <Line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY}
          stroke="#888" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.3} />
      )}
      <Path d={areaPath} fill="url(#eqGrad)" />
      <Path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Circle cx={getX(0)} cy={getY(values[0])} r={2.5} fill="#888" />
      <Circle cx={getX(values.length - 1)} cy={getY(values[values.length - 1])} r={3}
        fill={isPositive ? '#4CAF50' : '#FF5252'} />
      <SvgText x={width / 2} y={height - 2}
        fill="#888" fontSize={8} fontFamily="System" textAnchor="middle">
        {equityCurve.length} bars · {values.length} data points
      </SvgText>
    </Svg>
  );
}

// ============================================================================
// Metric Card
// ============================================================================

function MetricCard({
  label, value, color, icon,
}: {
  label: string; value: string; color?: string; icon?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[metricStyles.card, { backgroundColor: colors.bgInput }]}>
      {icon && <Text style={metricStyles.icon}>{icon}</Text>}
      <Text style={[metricStyles.value, { color: color || colors.text }]}>{value}</Text>
      <Text style={[metricStyles.label, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const metricStyles = StyleSheet.create({
  card: { padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, alignItems: 'center', gap: 2, minWidth: '30%', flex: 1 },
  icon: { fontSize: 16 },
  value: { fontSize: FONTS.size.md, fontWeight: '700', fontFamily: 'monospace' },
  label: { fontFamily: 'System', fontSize: 9, fontWeight: '500', textTransform: 'uppercase' },
});

// ============================================================================
// Trade Row
// ============================================================================

function TradeRow({ trade, colors }: { trade: AlgoTrade; colors: any }) {
  const isWin = (trade.netPnl ?? 0) > 0;
  return (
    <View style={[tradeStyles.row, { borderBottomColor: colors.borderLight }]}>
      <View style={tradeStyles.left}>
        <View style={[tradeStyles.dirBadge, {
          backgroundColor: trade.direction === 'long' ? '#4CAF5030' : '#FF525230',
        }]}>
          <Text style={[tradeStyles.dirText, {
            color: trade.direction === 'long' ? '#4CAF50' : '#FF5252',
            fontSize: 9,
          }]}>
            {trade.direction === 'long' ? 'L' : 'S'}
          </Text>
        </View>
        <View style={tradeStyles.info}>
          <Text style={[tradeStyles.date, { color: colors.text }]}>
            {trade.entryDate} → {trade.exitDate || 'Open'}
          </Text>
          <Text style={[tradeStyles.reason, { color: colors.textMuted }]}>
            {trade.exitReason || 'Open'} · {trade.holdingPeriod ?? '-'} bars
          </Text>
        </View>
      </View>
      <View style={tradeStyles.right}>
        <Text style={[tradeStyles.pnl, { color: isWin ? '#4CAF50' : '#FF5252' }]}>
          {isWin ? '+' : ''}{formatCurrency(trade.netPnl ?? 0, true)}
        </Text>
        <Text style={[tradeStyles.ret, { color: isWin ? '#4CAF50' : '#FF5252' }]}>
          {(trade.returnPercent ?? 0) > 0 ? '+' : ''}{(trade.returnPercent ?? 0).toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}

const tradeStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dirBadge: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  dirText: { fontFamily: 'System', fontWeight: '700' },
  info: { gap: 1 },
  date: { fontFamily: 'System', fontSize: FONTS.size.xs, fontWeight: '600' },
  reason: { fontFamily: 'System', fontSize: 9, fontWeight: '400' },
  right: { alignItems: 'flex-end' },
  pnl: { fontFamily: 'monospace', fontSize: FONTS.size.sm, fontWeight: '700' },
  ret: { fontFamily: 'System', fontSize: 9, fontWeight: '600' },
});

// ============================================================================
// Main Screen
// ============================================================================

export default function AlgoTradingScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();

  const saveStrategy = useAlgoStrategyStore((s) => s.saveStrategy);
  const savedStrategies = useAlgoStrategyStore((s) => s.strategies);

  // ── Strategy State ──
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const [strategyName, setStrategyName] = useState('');
  const [entryFormula, setEntryFormula] = useState('');
  const [exitFormula, setExitFormula] = useState('');
  const [stopLoss, setStopLoss] = useState('5');
  const [takeProfit, setTakeProfit] = useState('10');
  const [trailingStop, setTrailingStop] = useState(false);
  const [trailingActivation, setTrailingActivation] = useState('5');
  const [trailingDistance, setTrailingDistance] = useState('2');
  const [sizingMethod, setSizingMethod] = useState<'fixed_qty' | 'percent_risk' | 'fixed_capital'>('fixed_qty');
  const [sizingValue, setSizingValue] = useState('10');
  const [allowShort, setAllowShort] = useState(false);

  // ── Backtest State ──
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [result, setResult] = useState<AlgoBacktestResult | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);

  // Validation
  const entryValid = useMemo(() => {
    if (!entryFormula.trim()) return { valid: false };
    return validateFormula(entryFormula.trim());
  }, [entryFormula]);

  const exitValid = useMemo(() => {
    if (!exitFormula.trim()) return { valid: false };
    return validateFormula(exitFormula.trim());
  }, [exitFormula]);

  // Run backtest
  const handleRunBacktest = useCallback(async () => {
    if (!entryFormula.trim() || !exitFormula.trim()) {
      Alert.alert('Missing Formulas', 'Please enter both entry and exit conditions.');
      return;
    }
    if (!entryValid.valid) {
      Alert.alert('Invalid Entry Formula', entryValid.error);
      return;
    }
    if (!exitValid.valid) {
      Alert.alert('Invalid Exit Formula', exitValid.error);
      return;
    }

    setBacktestRunning(true);
    setResult(null);

    // Allow React state to flush before synchronous backtest runs
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      const basePrice = selectedSymbol === 'RELIANCE' ? 2500
        : selectedSymbol === 'TCS' ? 3800
        : selectedSymbol === 'HDFCBANK' ? 1600
        : selectedSymbol === 'INFY' ? 1400
        : selectedSymbol === 'ICICIBANK' ? 1050
        : selectedSymbol === 'HINDUNILVR' ? 2500
        : selectedSymbol === 'ITC' ? 400
        : selectedSymbol === 'SBIN' ? 600
        : 1000;

      const mockData = generateMockHistory(basePrice, 365);

      const strategy: AlgoStrategy = {
        name: strategyName.trim() || 'My Strategy',
        entryFormula: entryFormula.trim(),
        exitFormula: exitFormula.trim(),
        stopLossPercent: parseFloat(stopLoss) || undefined,
        takeProfitPercent: parseFloat(takeProfit) || undefined,
        trailingStop,
        trailingActivation: trailingStop ? parseFloat(trailingActivation) : undefined,
        trailingDistance: trailingStop ? parseFloat(trailingDistance) : undefined,
        sizingMethod,
        sizingValue: parseFloat(sizingValue) || 10,
        allowShort,
        maxPositions: 1,
        commission: 0.001,
        slippage: 0.001,
      };

      const backtestResult = runAlgoBacktest(strategy, mockData);

      // Save strategy with result summary
      const id = saveStrategy({
        name: strategyName.trim() || 'My Strategy',
        symbol: selectedSymbol,
        entryFormula: entryFormula.trim(),
        exitFormula: exitFormula.trim(),
        stopLossPercent: parseFloat(stopLoss) || undefined,
        takeProfitPercent: parseFloat(takeProfit) || undefined,
        trailingStop,
        trailingActivation: trailingStop ? parseFloat(trailingActivation) : undefined,
        trailingDistance: trailingStop ? parseFloat(trailingDistance) : undefined,
        sizingMethod,
        sizingValue: parseFloat(sizingValue) || 10,
        allowShort,
        maxPositions: 1,
        commission: 0.001,
        slippage: 0.001,
      });

      // Update with backtest summary
      useAlgoStrategyStore.getState().recordBacktest(id, {
        totalTrades: backtestResult.metrics.totalTrades,
        winRate: backtestResult.metrics.winRate,
        totalNetPnl: backtestResult.metrics.totalNetPnl,
        sharpeRatio: backtestResult.metrics.sharpeRatio,
        maxDrawdownPercent: backtestResult.metrics.maxDrawdownPercent,
      });

      setResult(backtestResult);
      setResultId(id);
    } catch (err: any) {
      Alert.alert('Backtest Error', err.message || 'An error occurred during backtesting.');
    } finally {
      setBacktestRunning(false);
    }
  }, [entryFormula, exitFormula, strategyName, selectedSymbol, stopLoss, takeProfit,
      trailingStop, trailingActivation, trailingDistance, sizingMethod, sizingValue,
      allowShort, entryValid, exitValid, saveStrategy]);

  // Import template
  const handleImportTemplate = useCallback((template: typeof STRATEGY_TEMPLATES[0]) => {
    setStrategyName(template.name);
    setEntryFormula(template.entryFormula);
    setExitFormula(template.exitFormula);
    setShowTemplates(false);
  }, []);

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[screenStyles.header, { borderBottomColor: colors.border, backgroundColor: colors.bgSecondary }]}>
        <Pressable onPress={() => navigation.goBack()} style={screenStyles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={screenStyles.headerInfo}>
          <Text style={[screenStyles.headerTitle, { color: colors.text }]}>Algo Trading</Text>
          <Text style={[screenStyles.headerSubtitle, { color: colors.textMuted }]}>
            Strategy Backtesting Engine
          </Text>
        </View>
      </View>

      <ScrollView
        style={screenStyles.scroll}
        contentContainerStyle={screenStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Strategy Templates ── */}
        <Pressable
          style={[screenStyles.templateToggle, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
          onPress={() => setShowTemplates(!showTemplates)}
        >
          <Ionicons name="bookmarks-outline" size={18} color={colors.primary} />
          <Text style={[screenStyles.templateToggleText, { color: colors.primary }]}>
            {showTemplates ? 'Hide Templates' : 'Choose a Strategy Template'}
          </Text>
          <Ionicons name={showTemplates ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
        </Pressable>

        {showTemplates && (
          <View style={[screenStyles.templateGrid, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {STRATEGY_TEMPLATES.map((template) => (
              <Pressable
                key={template.name}
                style={[screenStyles.templateItem, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                onPress={() => handleImportTemplate(template)}
              >
                <Text style={[screenStyles.templateName, { color: colors.text }]}>{template.name}</Text>
                <Text style={[screenStyles.templateDesc, { color: colors.textMuted }]} numberOfLines={2}>
                  {template.description}
                </Text>
                <Text style={[screenStyles.templateFormula, { color: colors.primary }]} numberOfLines={1}>
                  {template.entryFormula}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Strategy Definition ── */}
        <View style={[screenStyles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[screenStyles.sectionTitle, { color: colors.text }]}>1. Strategy</Text>

          <Text style={[screenStyles.fieldLabel, { color: colors.textSecondary }]}>Name</Text>
          <TextInput
            style={[screenStyles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
            value={strategyName}
            onChangeText={setStrategyName}
            placeholder="My SMA Crossover Strategy"
            placeholderTextColor="#666"
          />

          <Text style={[screenStyles.fieldLabel, { color: colors.textSecondary }]}>Symbol</Text>
          <Pressable
            style={[screenStyles.symbolPicker, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
            onPress={() => setShowSymbolPicker(!showSymbolPicker)}
          >
            <Text style={[screenStyles.symbolPickerText, { color: colors.text }]}>{selectedSymbol}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
          {showSymbolPicker && (
            <View style={[screenStyles.symbolGrid, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {STOCK_SYMBOLS.map((sym) => (
                <Pressable
                  key={sym}
                  style={[screenStyles.symbolItem, {
                    backgroundColor: sym === selectedSymbol ? colors.primary + '20' : colors.bgInput,
                    borderColor: sym === selectedSymbol ? colors.primary : colors.border,
                  }]}
                  onPress={() => { setSelectedSymbol(sym); setShowSymbolPicker(false); }}
                >
                  <Text style={[screenStyles.symbolItemText, {
                    color: sym === selectedSymbol ? colors.primary : colors.text,
                    fontWeight: sym === selectedSymbol ? '700' : '500',
                  }]}>{sym}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={[screenStyles.fieldLabel, { color: colors.textSecondary }]}>
            Entry Condition <Text style={{ color: colors.textMuted, fontSize: 10 }}>(formula returns {'>'}0.5)</Text>
          </Text>
          <TextInput
            style={[screenStyles.formulaInput, {
              backgroundColor: colors.bgInput,
              borderColor: entryValid.valid ? colors.border : '#FF6B6B',
              color: colors.text,
            }]}
            value={entryFormula}
            onChangeText={setEntryFormula}
            placeholder="e.g. CROSSOVER(SMA(close, 20), SMA(close, 50))"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[screenStyles.validationText, { color: entryValid.valid ? '#4ECDC4' : '#FF6B6B' }]}>
            {entryFormula.trim() ? (entryValid.valid ? '✓' : '✗') : ''}
          </Text>

          <Text style={[screenStyles.fieldLabel, { color: colors.textSecondary }]}>
            Exit Condition <Text style={{ color: colors.textMuted, fontSize: 10 }}>(formula returns {'>'}0.5)</Text>
          </Text>
          <TextInput
            style={[screenStyles.formulaInput, {
              backgroundColor: colors.bgInput,
              borderColor: exitValid.valid ? colors.border : '#FF6B6B',
              color: colors.text,
            }]}
            value={exitFormula}
            onChangeText={setExitFormula}
            placeholder="e.g. CROSSUNDER(SMA(close, 20), SMA(close, 50))"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[screenStyles.validationText, { color: exitValid.valid ? '#4ECDC4' : '#FF6B6B' }]}>
            {exitFormula.trim() ? (exitValid.valid ? '✓' : '✗') : ''}
          </Text>
        </View>

        {/* ── Risk Parameters ── */}
        <View style={[screenStyles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[screenStyles.sectionTitle, { color: colors.text }]}>2. Risk Parameters</Text>

          <View style={screenStyles.paramRow}>
            <View style={screenStyles.paramField}>
              <Text style={[screenStyles.paramLabel, { color: colors.textSecondary }]}>Stop Loss %</Text>
              <TextInput
                style={[screenStyles.paramInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                value={stopLoss}
                onChangeText={setStopLoss}
                keyboardType="decimal-pad"
                placeholder="5"
                placeholderTextColor="#555"
              />
            </View>
            <View style={screenStyles.paramField}>
              <Text style={[screenStyles.paramLabel, { color: colors.textSecondary }]}>Take Profit %</Text>
              <TextInput
                style={[screenStyles.paramInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                value={takeProfit}
                onChangeText={setTakeProfit}
                keyboardType="decimal-pad"
                placeholder="10"
                placeholderTextColor="#555"
              />
            </View>
          </View>

          {/* Trailing Stop toggle */}
          <Pressable
            style={[screenStyles.toggleRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
            onPress={() => setTrailingStop(!trailingStop)}
          >
            <Ionicons
              name={trailingStop ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={trailingStop ? colors.primary : colors.textMuted}
            />
            <Text style={[screenStyles.toggleLabel, { color: colors.text }]}>Enable Trailing Stop Loss</Text>
          </Pressable>

          {trailingStop && (
            <View style={screenStyles.paramRow}>
              <View style={screenStyles.paramField}>
                <Text style={[screenStyles.paramLabel, { color: colors.textSecondary }]}>Activate After %</Text>
                <TextInput
                  style={[screenStyles.paramInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                  value={trailingActivation}
                  onChangeText={setTrailingActivation}
                  keyboardType="decimal-pad"
                  placeholder="5"
                  placeholderTextColor="#555"
                />
              </View>
              <View style={screenStyles.paramField}>
                <Text style={[screenStyles.paramLabel, { color: colors.textSecondary }]}>Trail Distance %</Text>
                <TextInput
                  style={[screenStyles.paramInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                  value={trailingDistance}
                  onChangeText={setTrailingDistance}
                  keyboardType="decimal-pad"
                  placeholder="2"
                  placeholderTextColor="#555"
                />
              </View>
            </View>
          )}

          <Text style={[screenStyles.fieldLabel, { color: colors.textSecondary, marginTop: SPACING.sm }]}>
            Position Sizing
          </Text>
          <View style={screenStyles.sizingRow}>
            {(['fixed_qty', 'percent_risk', 'fixed_capital'] as const).map((method) => (
              <Pressable
                key={method}
                style={[screenStyles.sizingOption, {
                  borderColor: sizingMethod === method ? colors.primary : colors.border,
                  backgroundColor: sizingMethod === method ? colors.primary + '15' : colors.bgInput,
                }]}
                onPress={() => setSizingMethod(method)}
              >
                <Text style={[screenStyles.sizingOptionText, {
                  color: sizingMethod === method ? colors.primary : colors.textMuted,
                  fontWeight: sizingMethod === method ? '700' : '500',
                }]}>
                  {method === 'fixed_qty' ? 'Qty' : method === 'percent_risk' ? '% Risk' : 'Capital'}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[screenStyles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
            value={sizingValue}
            onChangeText={setSizingValue}
            keyboardType="decimal-pad"
            placeholder={sizingMethod === 'fixed_qty' ? '10 shares' : sizingMethod === 'percent_risk' ? '2%' : '₹10000'}
            placeholderTextColor="#555"
          />

          {/* Allow Short */}
          <Pressable
            style={[screenStyles.toggleRow, { backgroundColor: colors.bgInput, borderColor: colors.border, marginTop: SPACING.sm }]}
            onPress={() => setAllowShort(!allowShort)}
          >
            <Ionicons
              name={allowShort ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={allowShort ? colors.primary : colors.textMuted}
            />
            <Text style={[screenStyles.toggleLabel, { color: colors.text }]}>Allow Short Positions</Text>
          </Pressable>
        </View>

        {/* ── Run Backtest ── */}
        <Pressable
          style={[screenStyles.runBtn, {
            backgroundColor: colors.primary,
            opacity: (entryValid.valid && exitValid.valid && !backtestRunning) ? 1 : 0.5,
          }]}
          onPress={handleRunBacktest}
          disabled={!entryValid.valid || !exitValid.valid || backtestRunning}
        >
          {backtestRunning ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="play-circle" size={22} color="#fff" />
          )}
          <Text style={screenStyles.runBtnText}>
            {backtestRunning ? 'Running Backtest...' : 'Run Backtest'}
          </Text>
        </Pressable>

        {/* ── Results ── */}
        {result && (
          <View style={[screenStyles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[screenStyles.sectionTitle, { color: colors.text }]}>
              📊 Backtest Results — {strategyName || 'My Strategy'}
            </Text>
            <Text style={[screenStyles.sectionSubtitle, { color: colors.textMuted }]}>
              {result.trades.length} trades · 1 year mock data · {selectedSymbol}
            </Text>

            {/* Errors */}
            {result.errors && result.errors.length > 0 && (
              <View style={[screenStyles.errorBox, { backgroundColor: '#FF525215', borderColor: '#FF525240' }]}>
                <Text style={[screenStyles.errorText, { color: '#FF5252' }]}>
                  {result.errors.slice(0, 3).join('\n')}
                </Text>
              </View>
            )}

            {/* Summary metrics */}
            <View style={screenStyles.metricsRow}>
              <MetricCard label="Net P&L" value={formatCurrency(result.metrics.totalNetPnl, true)}
                color={result.metrics.totalNetPnl >= 0 ? '#4CAF50' : '#FF5252'} icon="💰" />
              <MetricCard label="Win Rate" value={`${result.metrics.winRate.toFixed(0)}%`}
                color={result.metrics.winRate >= 50 ? '#4CAF50' : '#FF5252'} icon="🎯" />
              <MetricCard label="Trades" value={`${result.metrics.totalTrades}`}
                icon="📊" />
            </View>

            <View style={screenStyles.metricsRow}>
              <MetricCard label="Sharpe" value={result.metrics.sharpeRatio.toFixed(2)}
                color={result.metrics.sharpeRatio >= 1 ? '#4CAF50' : '#FFC107'} icon="📈" />
              <MetricCard label="Profit Factor" value={result.metrics.profitFactor === Infinity ? '∞' : result.metrics.profitFactor.toFixed(2)}
                color={result.metrics.profitFactor >= 1.5 ? '#4CAF50' : '#FFC107'} icon="⚡" />
              <MetricCard label="Avg Trade" value={formatCurrency(result.metrics.avgReturnPerTrade, true)}
                color={result.metrics.avgReturnPerTrade >= 0 ? '#4CAF50' : '#FF5252'} icon="📌" />
            </View>

            <View style={screenStyles.metricsRow}>
              <MetricCard label="Avg Win" value={formatCurrency(result.metrics.avgWin, true)} icon="✅" color="#4CAF50" />
              <MetricCard label="Avg Loss" value={formatCurrency(result.metrics.avgLoss, true)} icon="❌" color="#FF5252" />
              <MetricCard label="Avg Hold" value={`${result.metrics.avgHoldingPeriod.toFixed(0)}d`} icon="⏱" />
            </View>

            <View style={screenStyles.metricsRow}>
              <MetricCard label="Sortino" value={result.metrics.sortinoRatio.toFixed(2)} icon="📉" />
              <MetricCard label="Consec Wins" value={`${result.metrics.maxConsecutiveWins}`} icon="🔥" color="#4CAF50" />
              <MetricCard label="Consec Losses" value={`${result.metrics.maxConsecutiveLosses}`} icon="💧" color="#FF5252" />
            </View>

            {/* Equity Curve */}
            <Text style={[screenStyles.subSectionTitle, { color: colors.text }]}>Equity Curve</Text>
            <MiniEquityCurve equityCurve={result.equityCurve}
              color={result.metrics.totalNetPnl >= 0 ? '#4CAF50' : '#FF5252'} />

            {/* Trade Log */}
            <Text style={[screenStyles.subSectionTitle, { color: colors.text }]}>
              Trade Log ({result.trades.length} trades)
            </Text>
            {result.trades.length === 0 ? (
              <Text style={[screenStyles.emptyText, { color: colors.textMuted }]}>
                No trades generated. Try adjusting your entry/exit conditions.
              </Text>
            ) : (
              <View style={screenStyles.tradeList}>
                {result.trades.map((trade, i) => (
                  <TradeRow key={trade.id} trade={trade} colors={colors} />
                ))}
              </View>
            )}

            {/* Commission info */}
            <Text style={[screenStyles.footerInfo, { color: colors.textMuted }]}>
              Commission: 0.1% · Slippage: 0.1% · Total fees: {formatCurrency(result.metrics.totalCommission, true)}
            </Text>
          </View>
        )}

        {/* ── Saved Strategies Count ── */}
        {savedStrategies.length > 0 && !result && (
          <View style={[screenStyles.savedInfo, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="archive-outline" size={18} color={colors.primary} />
            <Text style={[screenStyles.savedInfoText, { color: colors.textMuted }]}>
              {savedStrategies.length} saved {savedStrategies.length === 1 ? 'strategy' : 'strategies'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const screenStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: SPACING.xs, marginRight: SPACING.sm },
  headerInfo: { flex: 1 },
  headerTitle: { fontFamily: 'System', fontSize: FONTS.size.lg, fontWeight: '700' },
  headerSubtitle: { fontFamily: 'System', fontSize: FONTS.size.xs, fontWeight: '500', marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.md, paddingBottom: 40 },

  // Templates
  templateToggle: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.sm,
  },
  templateToggleText: { fontFamily: 'System', fontSize: FONTS.size.sm, fontWeight: '600', flex: 1 },
  templateGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs,
    padding: SPACING.sm, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, marginBottom: SPACING.sm,
  },
  templateItem: {
    width: '48%', padding: SPACING.sm, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, gap: 4,
  },
  templateName: { fontFamily: 'System', fontSize: FONTS.size.xs, fontWeight: '700' },
  templateDesc: { fontFamily: 'System', fontSize: 9, fontWeight: '400', lineHeight: 13 },
  templateFormula: { fontFamily: 'monospace', fontSize: 8, fontWeight: '500' },

  // Sections
  section: {
    borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  sectionTitle: { fontFamily: 'System', fontSize: FONTS.size.md, fontWeight: '700', marginBottom: 4 },
  sectionSubtitle: { fontFamily: 'System', fontSize: FONTS.size.xs, fontWeight: '400', marginBottom: SPACING.sm },
  subSectionTitle: { fontFamily: 'System', fontSize: FONTS.size.sm, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.sm },

  // Fields
  fieldLabel: { fontFamily: 'System', fontSize: FONTS.size.xs, fontWeight: '600', marginTop: SPACING.sm, marginBottom: 4 },
  input: { fontFamily: 'System', fontSize: FONTS.size.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, padding: SPACING.sm + 2 },
  formulaInput: { fontFamily: 'monospace', fontSize: FONTS.size.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, padding: SPACING.sm + 2, minHeight: 44 },
  validationText: { fontFamily: 'System', fontSize: FONTS.size.xs, fontWeight: '600', marginTop: 2, marginBottom: SPACING.xs },

  // Symbol picker
  symbolPicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.sm + 2, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
  },
  symbolPickerText: { fontFamily: 'System', fontSize: FONTS.size.md, fontWeight: '700' },
  symbolGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4,
    padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginTop: 4,
  },
  symbolItem: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
  symbolItemText: { fontFamily: 'System', fontSize: FONTS.size.xs },

  // Risk params
  paramRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  paramField: { flex: 1 },
  paramLabel: { fontFamily: 'System', fontSize: FONTS.size.xs, fontWeight: '600', marginBottom: 4 },
  paramInput: { fontFamily: 'System', fontSize: FONTS.size.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, padding: SPACING.sm + 2 },

  // Toggle row
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.sm + 2, borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, marginTop: SPACING.sm,
  },
  toggleLabel: { fontFamily: 'System', fontSize: FONTS.size.sm, fontWeight: '600' },

  // Sizing
  sizingRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.sm },
  sizingOption: { flex: 1, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, alignItems: 'center' },
  sizingOptionText: { fontFamily: 'System', fontSize: FONTS.size.xs },

  // Run button
  runBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.md,
  },
  runBtnText: { fontFamily: 'System', fontSize: FONTS.size.md, fontWeight: '700', color: '#fff' },

  // Results
  metricsRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  errorBox: { padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginBottom: SPACING.sm },
  errorText: { fontFamily: 'monospace', fontSize: 10, lineHeight: 15 },
  tradeList: { maxHeight: 300, overflow: 'hidden' },
  emptyText: { fontFamily: 'System', fontSize: FONTS.size.xs, textAlign: 'center', padding: SPACING.md },
  footerInfo: { fontFamily: 'System', fontSize: 9, textAlign: 'center', marginTop: SPACING.sm },

  // Saved info
  savedInfo: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
  },
  savedInfoText: { fontFamily: 'System', fontSize: FONTS.size.xs, fontWeight: '500' },
});
