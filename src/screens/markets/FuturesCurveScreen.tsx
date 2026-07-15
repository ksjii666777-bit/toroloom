/**
 * ============================================================================
 * Toroloom — Futures Curve Screen
 * ============================================================================
 *
 * Visualizes the futures price curve across expiry months for major F&O
 * underlyings. Shows contango/backwardation status, basis analysis,
 * open interest distribution, and a detailed data table.
 *
 * Features:
 *   - Symbol selector (NIFTY, BANKNIFTY, FINNIFTY)
 *   - SVG line chart with price curve across expiries
 *   - Contango / Backwardation indicator with color coding
 *   - Spot price reference line
 *   - Data table showing each expiry contract
 *   - Key metrics summary
 *   - Curve slope analysis
 *
 * Navigation: More → Futures Curve
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Dimensions, Platform,
} from 'react-native';
import Svg, {
  Path, Line, Circle, Text as SvgText, Defs,
  LinearGradient, Stop, G, Rect,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { FuturesCurveData, FuturesCurvePoint } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ═════════════════════════════════════════════════════════════════════════
// MOCK FUTURES CURVE DATA
// ═════════════════════════════════════════════════════════════════════════

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const MOCK_SPOT_PRICES: Record<string, number> = {
  NIFTY: 23456.80,
  BANKNIFTY: 49234.10,
  FINNIFTY: 21234.50,
  MIDCPNIFTY: 15678.90,
  SENSEX: 77123.45,
};

function generateFuturesPoints(
  _symbol: string,
  spotPrice: number,
  nearBasis: number,
  monthlySlope: number,
  isContango: boolean,
): FuturesCurvePoint[] {
  const sign = isContango ? 1 : -1;
  const months = 4;
  const points: FuturesCurvePoint[] = [];

  interface ExpiryInfo {
    days: number;
    label: string;
  }

  // NSE F&O expiries are weekly on Thursdays
  const now = new Date();
  const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu
  const daysToNextThursday = currentDay <= 4 ? 4 - currentDay : 4 + 7 - currentDay;

  const expiries: ExpiryInfo[] = [
    { days: daysToNextThursday, label: 'Weekly' },
    { days: 30, label: 'Monthly' },
    { days: 60, label: '2-Month' },
    { days: 90, label: '3-Month' },
    { days: 120, label: '4-Month' },
    { days: 180, label: 'Far Month' },
  ];

  for (let i = 0; i < months; i++) {
    const expiry = expiries[i];
    const days = expiry.days;
    const basis = nearBasis + sign * monthlySlope * i;
    const price = spotPrice + basis;
    const randomOI = Math.floor(spotPrice * (50 + Math.random() * 100)) * (months - i);
    const oiChange = Math.floor((Math.random() - 0.4) * randomOI * 0.15);
    const volume = Math.floor(spotPrice * (100 + Math.random() * 200));

    points.push({
      expiryLabel: expiry.label,
      expiryDate: daysFromNow(days),
      daysToExpiry: days,
      price: Math.round(price * 100) / 100,
      basis: Math.round(basis * 100) / 100,
      basisPercent: Math.round((basis / spotPrice) * 10000) / 100,
      openInterest: randomOI,
      oiChange,
      volume,
    });
  }

  return points;
}

const FUTURES_CURVE_DATA: Record<string, FuturesCurveData> = {
  NIFTY: {
    symbol: 'NIFTY',
    spotPrice: MOCK_SPOT_PRICES.NIFTY,
    points: generateFuturesPoints('NIFTY', MOCK_SPOT_PRICES.NIFTY, 35, 15, true),
    isContango: true,
    slope: 15,
    totalOpenInterest: 0,
    maxOiExpiry: '',
  },
  BANKNIFTY: {
    symbol: 'BANKNIFTY',
    spotPrice: MOCK_SPOT_PRICES.BANKNIFTY,
    points: generateFuturesPoints('BANKNIFTY', MOCK_SPOT_PRICES.BANKNIFTY, 90, 40, true),
    isContango: true,
    slope: 40,
    totalOpenInterest: 0,
    maxOiExpiry: '',
  },
  FINNIFTY: {
    symbol: 'FINNIFTY',
    spotPrice: MOCK_SPOT_PRICES.FINNIFTY,
    points: generateFuturesPoints('FINNIFTY', MOCK_SPOT_PRICES.FINNIFTY, -20, 10, false),
    isContango: false,
    slope: -10,
    totalOpenInterest: 0,
    maxOiExpiry: '',
  },
  MIDCPNIFTY: {
    symbol: 'MIDCPNIFTY',
    spotPrice: MOCK_SPOT_PRICES.MIDCPNIFTY,
    points: generateFuturesPoints('MIDCPNIFTY', MOCK_SPOT_PRICES.MIDCPNIFTY, -8, 5, false),
    isContango: false,
    slope: -5,
    totalOpenInterest: 0,
    maxOiExpiry: '',
  },
};

// Compute derived stats
Object.values(FUTURES_CURVE_DATA).forEach((data) => {
  data.totalOpenInterest = data.points.reduce((s, p) => s + p.openInterest, 0);
  const maxOi = data.points.reduce((max, p) => (p.openInterest > (max?.openInterest ?? 0) ? p : max), data.points[0]);
  data.maxOiExpiry = maxOi?.expiryLabel ?? '';
});

const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'] as const;
type SymbolKey = (typeof SYMBOLS)[number];

// ═════════════════════════════════════════════════════════════════════════
// SVG FUTURES CURVE CHART
// ═════════════════════════════════════════════════════════════════════════

const CHART_PADDING = { top: 36, right: 20, bottom: 44, left: 60 };
const CHART_HEIGHT = 240;

function FuturesCurveChart({
  data,
  colors,
}: {
  data: FuturesCurveData;
  colors: any;
}) {
  const chartW = SCREEN_WIDTH - SPACING.xl * 2 - 2;
  const chartH = CHART_HEIGHT;
  const plotW = chartW - CHART_PADDING.left - CHART_PADDING.right;
  const plotH = chartH - CHART_PADDING.top - CHART_PADDING.bottom;

  const { points, spotPrice, isContango } = data;

  // Compute chart bounds
  const allPrices = [spotPrice, ...points.map(p => p.price)];
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice || 1;
  const pad = priceRange * 0.12;
  const chartMin = minPrice - pad;
  const chartMax = maxPrice + pad;
  const chartRange = chartMax - chartMin;

  const getX = (i: number) => CHART_PADDING.left + (i / (points.length - 1 || 1)) * plotW;
  const getY = (v: number) => CHART_PADDING.top + ((chartMax - v) / chartRange) * plotH;

  // Spot price Y position
  const spotY = getY(spotPrice);

  // Build curve path
  const curvePath = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.price).toFixed(1)}`
  ).join(' ');

  // Area fill path
  const areaBottomY = CHART_PADDING.top + plotH;
  const areaPath = `${curvePath} L ${getX(points.length - 1).toFixed(1)} ${areaBottomY.toFixed(1)} L ${getX(0).toFixed(1)} ${areaBottomY.toFixed(1)} Z`;

  // Y-axis labels
  const yLabels = Array.from({ length: 5 }, (_, i) =>
    chartMax - (chartRange * i) / 4,
  );

  // Grid lines
  const yGridLines = yLabels.map(v => getY(v));

  // X-axis labels
  const xLabels = points.map((p, i) => ({
    label: p.expiryLabel,
    x: getX(i),
  }));

  const curveColor = isContango ? '#00C853' : '#FF5252';
  const gradId = `curveGrad_${data.symbol}`;

  return (
    <View>
      <Svg width={chartW} height={chartH}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={curveColor} stopOpacity={0.2} />
            <Stop offset="100%" stopColor={curveColor} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {/* Background grid lines */}
        {yGridLines.map((y, i) => (
          <Line
            key={`grid-${i}`}
            x1={CHART_PADDING.left}
            y1={y}
            x2={chartW - CHART_PADDING.right}
            y2={y}
            stroke={colors.borderLight}
            strokeWidth={0.5}
            strokeDasharray="4,4"
            opacity={0.3}
          />
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill={`url(#${gradId})`} />

        {/* Spot price reference line (dashed) */}
        <Line
          x1={CHART_PADDING.left}
          y1={spotY}
          x2={chartW - CHART_PADDING.right}
          y2={spotY}
          stroke={colors.warning}
          strokeWidth={1}
          strokeDasharray="6,4"
          opacity={0.7}
        />

        {/* Spot label */}
        <Rect
          x={CHART_PADDING.left - 2}
          y={spotY - 10}
          width={52}
          height={20}
          rx={4}
          fill={colors.bgCard}
          opacity={0.9}
        />
        <SvgText
          x={CHART_PADDING.left + 24}
          y={spotY + 4}
          fill={colors.warning}
          fontSize={10}
          fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}
          fontWeight="700"
          textAnchor="middle"
        >
          Spot
        </SvgText>

        {/* Futures curve line */}
        <Path
          d={curvePath}
          stroke={curveColor}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Curve data points */}
        {points.map((p, i) => (
          <G key={`pt-${i}`}>
            <Circle
              cx={getX(i)}
              cy={getY(p.price)}
              r={4}
              fill={colors.bg}
              stroke={curveColor}
              strokeWidth={2}
            />
            <Circle
              cx={getX(i)}
              cy={getY(p.price)}
              r={2}
              fill={curveColor}
            />
          </G>
        ))}

        {/* Spot price dot */}
        <Circle
          cx={CHART_PADDING.left}
          cy={spotY}
          r={5}
          fill={colors.warning}
          stroke={colors.bg}
          strokeWidth={2}
        />

        {/* Y-axis labels */}
        {yLabels.map((v, i) => (
          <SvgText
            key={`y-${i}`}
            x={CHART_PADDING.left - 6}
            y={yGridLines[i] + 3}
            fill={colors.textMuted}
            fontSize={9}
            fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}
            textAnchor="end"
            opacity={0.7}
          >
            {v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {xLabels.map(({ label, x }) => (
          <SvgText
            key={`x-${label}`}
            x={x}
            y={chartH - 6}
            fill={colors.textMuted}
            fontSize={9}
            fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}
            textAnchor="middle"
            opacity={0.7}
          >
            {label}
          </SvgText>
        ))}

        {/* Contango/Backwardation label */}
        <SvgText
          x={chartW - CHART_PADDING.right}
          y={CHART_PADDING.top - 6}
          fill={curveColor}
          fontSize={10}
          fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}
          textAnchor="end"
          fontWeight="700"
        >
          {isContango ? '▲ CONTANGO' : '▼ BACKWARDATION'}
        </SvgText>
      </Svg>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// CURVE STAT CARD
// ═════════════════════════════════════════════════════════════════════════

function StatCard({ icon, label, value, color }: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[statStyles.card, { borderColor: color + '30' }]}>
      <Text style={statStyles.icon}>{icon}</Text>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    width: (SCREEN_WIDTH - 48 - SPACING.sm) / 3,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  icon: { fontSize: 20 },
  value: { ...FONTS.bold, fontSize: FONTS.size.sm, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  label: { ...FONTS.regular, fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },
});

// ═════════════════════════════════════════════════════════════════════════
// BASIS BAR
// ═════════════════════════════════════════════════════════════════════════

function BasisBar({ basisPercent, isContango }: { basisPercent: number; isContango: boolean }) {
  const absPct = Math.min(Math.abs(basisPercent), 0.5);
  const fillPct = (absPct / 0.5) * 100;
  const isPositive = isContango;

  return (
    <View style={basisStyles.container}>
      <View style={[basisStyles.barBg, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
        <View
          style={[
            basisStyles.fill,
            {
              width: `${fillPct}%`,
              backgroundColor: isPositive ? '#00C853' : '#FF5252',
              alignSelf: isPositive ? 'flex-start' : 'flex-end',
            },
          ]}
        />
      </View>
      <Text style={[basisStyles.label, { color: isPositive ? '#00C853' : '#FF5252' }]}>
        {isPositive ? '+' : ''}{basisPercent.toFixed(2)}%
      </Text>
    </View>
  );
}

const basisStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  barBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  label: { ...FONTS.mono, fontSize: 10, fontWeight: '700', width: 52, textAlign: 'right' },
});

// ═════════════════════════════════════════════════════════════════════════
// FUTURES CURVE TABLE ROW
// ═════════════════════════════════════════════════════════════════════════

function CurveTableRow({
  point,
  isFirst,
  isLast,
  isContango,
  colors,
}: {
  point: FuturesCurvePoint;
  isFirst: boolean;
  isLast: boolean;
  isContango: boolean;
  colors: any;
}) {
  const isUp = point.basis >= 0;

  return (
    <View style={[
      tableStyles.row,
      isFirst && tableStyles.rowFirst,
      isLast && tableStyles.rowLast,
      { borderBottomColor: colors.divider },
    ]}>
      {/* Expiry */}
      <View style={tableStyles.cell}>
        <Text style={[tableStyles.expiryLabel, { color: colors.text }]}>{point.expiryLabel}</Text>
        <Text style={[tableStyles.expiryDate, { color: colors.textMuted }]}>
          T+{point.daysToExpiry}d
        </Text>
      </View>

      {/* Price */}
      <View style={tableStyles.cell}>
        <Text style={[tableStyles.priceText, { color: colors.text }]}>
          {point.price.toFixed(2)}
        </Text>
      </View>

      {/* Basis */}
      <View style={tableStyles.cell}>
        <View style={tableStyles.basisRow}>
          <Ionicons
            name={isUp ? 'caret-up' : 'caret-down'}
            size={10}
            color={isUp ? '#00C853' : '#FF5252'}
          />
          <Text style={[tableStyles.basisText, { color: isUp ? '#00C853' : '#FF5252' }]}>
            {point.basis >= 0 ? '+' : ''}{point.basis.toFixed(1)}
          </Text>
        </View>
        <BasisBar basisPercent={point.basisPercent} isContango={isContango} />
      </View>

      {/* Open Interest */}
      <View style={tableStyles.cell}>
        <Text style={[tableStyles.oiText, { color: colors.text }]}>
          {(point.openInterest / 100000).toFixed(1)}L
        </Text>
        <Text style={[tableStyles.oiChangeText, {
          color: point.oiChange >= 0 ? '#00C853' : '#FF5252',
        }]}>
          {point.oiChange >= 0 ? '+' : ''}{(point.oiChange / 100000).toFixed(1)}L
        </Text>
      </View>
    </View>
  );
}

const tableStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  rowFirst: { borderTopLeftRadius: BORDER_RADIUS.md, borderTopRightRadius: BORDER_RADIUS.md },
  rowLast: { borderBottomLeftRadius: BORDER_RADIUS.md, borderBottomRightRadius: BORDER_RADIUS.md, borderBottomWidth: 0 },
  cell: { flex: 1, alignItems: 'flex-start', gap: 2 },
  expiryLabel: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  expiryDate: { ...FONTS.regular, fontSize: 8 },
  priceText: { ...FONTS.bold, fontSize: FONTS.size.sm, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  basisRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  basisText: { ...FONTS.mono, fontSize: 10, fontWeight: '700' },
  oiText: { ...FONTS.mono, fontSize: FONTS.size.xs, fontWeight: '600' },
  oiChangeText: { ...FONTS.mono, fontSize: 9, fontWeight: '600' },
});

// ═════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════

export default function FuturesCurveScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolKey>('NIFTY');

  const data = useMemo(() => FUTURES_CURVE_DATA[selectedSymbol]!, [selectedSymbol]);

  const isContango = data.isContango;
  const curveColor = isContango ? '#00C853' : '#FF5252';
  const curveLabel = isContango ? 'Contango' : 'Backwardation';
  const curveEmoji = isContango ? '📈' : '📉';

  const handleSymbolChange = useCallback((sym: SymbolKey) => {
    setSelectedSymbol(sym);
  }, []);

  const nearContract = data.points[0];
  const farContract = data.points[data.points.length - 1];
  const totalBasisChange = farContract ? farContract.price - nearContract.price : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Futures Curve</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Price curve across expiry months
            </Text>
          </View>
        </View>

        {/* Symbol Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.symbolScroll}>
          {SYMBOLS.map((sym) => {
            const isActive = selectedSymbol === sym;
            return (
              <Pressable
                key={sym}
                onPress={() => handleSymbolChange(sym)}
                style={[
                  styles.symbolChip,
                  {
                    backgroundColor: isActive ? colors.primary + '20' : colors.bgInput,
                    borderColor: isActive ? colors.primary + '40' : colors.border,
                  },
                ]}
              >
                <Text style={[
                  styles.symbolChipText,
                  { color: isActive ? colors.primary : colors.textMuted },
                ]}>
                  {sym}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Curve Status Banner ── */}
        <View style={[styles.statusBanner, { backgroundColor: curveColor + '12', borderColor: curveColor + '30' }]}>
          <Text style={styles.statusEmoji}>{curveEmoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: curveColor }]}>
              {curveLabel}
            </Text>
            <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
              {isContango
                ? 'Futures prices are higher than spot price — upward sloping curve. Market expects higher prices in future.'
                : 'Futures prices are lower than spot price — downward sloping curve. Market expects lower prices in future.'}
            </Text>
          </View>
        </View>

        {/* ── Key Metrics ── */}
        <View style={styles.statsRow}>
          <StatCard
            icon={curveEmoji}
            label="Curve Type"
            value={curveLabel}
            color={curveColor}
          />
          <StatCard
            icon="🎯"
            label="Spot Price"
            value={`₹${(data.spotPrice / 1000).toFixed(1)}K`}
            color="#FFC107"
          />
          <StatCard
            icon="📊"
            label="Near-Month"
            value={`₹${(nearContract.price / 1000).toFixed(1)}K`}
            color="#3B82F6"
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard
            icon="📏"
            label="Curve Slope"
            value={`${isContango ? '+' : ''}${data.slope}/mth`}
            color={curveColor}
          />
          <StatCard
            icon="📈"
            label="Total OI"
            value={`${(data.totalOpenInterest / 10000000).toFixed(1)}Cr`}
            color="#8B5CF6"
          />
          <StatCard
            icon="🔷"
            label="Max OI Expiry"
            value={data.maxOiExpiry}
            color="#00E676"
          />
        </View>

        {/* ── SVG Chart ── */}
        <View style={[styles.chartCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>
              {selectedSymbol} Futures Curve
            </Text>
            <View style={[styles.curveBadge, { backgroundColor: curveColor + '20' }]}>
              <Text style={[styles.curveBadgeText, { color: curveColor }]}>
                {isContango ? '▲' : '▼'} {Math.abs(data.slope)} pts/mth
              </Text>
            </View>
          </View>
          <FuturesCurveChart data={data} colors={colors} />
        </View>

        {/* ── Data Table ── */}
        <View style={[styles.tableCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.tableTitle, { color: colors.text }]}>
            Contract-wise Details
          </Text>

          {/* Column headers */}
          <View style={[styles.tableHeader, { borderBottomColor: colors.divider, backgroundColor: colors.bgInput }]}>
            <Text style={[styles.headerCell, { color: colors.textMuted }]}>Expiry</Text>
            <Text style={[styles.headerCell, { color: colors.textMuted }]}>Price</Text>
            <Text style={[styles.headerCell, { color: colors.textMuted }]}>Basis</Text>
            <Text style={[styles.headerCell, { color: colors.textMuted }]}>OI</Text>
          </View>

          {data.points.map((point, i) => (
            <CurveTableRow
              key={point.expiryLabel}
              point={point}
              isFirst={i === 0}
              isLast={i === data.points.length - 1}
              isContango={isContango}
              colors={colors}
            />
          ))}
        </View>

        {/* ── Analysis Section ── */}
        <View style={[styles.analysisCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.analysisTitle, { color: colors.text }]}>
            📋 Curve Analysis
          </Text>

          <View style={[styles.insightRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.insightDot}>
              <View style={[styles.insightDotInner, { backgroundColor: curveColor }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.insightLabel, { color: colors.text }]}>Curve Shape</Text>
              <Text style={[styles.insightValue, { color: colors.textSecondary }]}>
                {isContango
                  ? `Upward sloping — ${selectedSymbol} futures trade at a premium to spot across all expiries.`
                  : `Downward sloping — ${selectedSymbol} futures trade at a discount to spot.`}
              </Text>
            </View>
          </View>

          <View style={[styles.insightRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.insightDot}>
              <View style={[styles.insightDotInner, { backgroundColor: '#3B82F6' }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.insightLabel, { color: colors.text }]}>Basis Analysis</Text>
              <Text style={[styles.insightValue, { color: colors.textSecondary }]}>
                Near-month basis: {nearContract.basis >= 0 ? '+' : ''}{nearContract.basis.toFixed(1)} pts ({(nearContract.basisPercent >= 0 ? '+' : '') + nearContract.basisPercent.toFixed(2)}%).
                {isContango
                  ? ' Positive basis indicates cost of carry (interest + storage).'
                  : ' Negative basis suggests near-term supply concerns.'}
              </Text>
            </View>
          </View>

          <View style={[styles.insightRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.insightDot}>
              <View style={[styles.insightDotInner, { backgroundColor: '#8B5CF6' }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.insightLabel, { color: colors.text }]}>Open Interest</Text>
              <Text style={[styles.insightValue, { color: colors.textSecondary }]}>
                Total OI: {(data.totalOpenInterest / 10000000).toFixed(1)} Cr shares. Max OI in {data.maxOiExpiry} contract.
                {isContango
                  ? ' Higher OI in far-month suggests rollover activity.'
                  : ' Higher OI in near-month suggests active trading.'}
              </Text>
            </View>
          </View>

          <View style={styles.insightRow}>
            <View style={styles.insightDot}>
              <View style={[styles.insightDotInner, { backgroundColor: '#FFC107' }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.insightLabel, { color: colors.text }]}>Slope</Text>
              <Text style={[styles.insightValue, { color: colors.textSecondary }]}>
                Curve slope: {isContango ? '+' : ''}{data.slope} pts per month.
                Total basis change from near to far month: {totalBasisChange >= 0 ? '+' : ''}{totalBasisChange.toFixed(1)} pts.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Info Note ── */}
        <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>What is the Futures Curve?</Text>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              The futures curve plots futures contract prices against their expiry dates.{'\n\n'}
              <Text style={{ fontWeight: '700' }}>Contango</Text>: Upward slope — futures cost more than spot (normal market).{'\n'}
              <Text style={{ fontWeight: '700' }}>Backwardation</Text>: Downward slope — futures cost less than spot (rare, often signals stress).{'\n\n'}
              Curve steepness reflects cost of carry, market sentiment, and supply/demand expectations.
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    padding: SPACING.xl,
    paddingTop: 60,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backBtn: { padding: 4 },
  title: { ...FONTS.bold, fontSize: FONTS.size.title },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4 },
  symbolScroll: { marginTop: SPACING.md },
  symbolChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  symbolChipText: { ...FONTS.bold, fontSize: FONTS.size.sm, letterSpacing: 0.5 },

  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },

  // Status Banner
  statusBanner: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  statusEmoji: { fontSize: 28 },
  statusTitle: { ...FONTS.bold, fontSize: FONTS.size.lg },
  statusDesc: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 16, marginTop: 4 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  // Chart Card
  chartCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  chartTitle: { ...FONTS.bold, fontSize: FONTS.size.sm },
  curveBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  curveBadgeText: { ...FONTS.extraBold, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Table Card
  tableCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  tableTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  headerCell: {
    flex: 1,
    ...FONTS.medium,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Analysis
  analysisCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.md,
    padding: SPACING.lg,
  },
  analysisTitle: { ...FONTS.bold, fontSize: FONTS.size.md, marginBottom: SPACING.md },
  insightRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  insightDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  insightDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  insightLabel: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  insightValue: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 15, marginTop: 2 },

  // Info
  infoCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  infoTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: 4 },
  infoText: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 18 },
});
