import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useMarketStore } from '../../store/marketStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { SkeletonBlock, SkeletonCard } from '../../components/ui/SkeletonLoader';
import { marketApi } from '../../services/api/market';
import { mockFundamentals } from '../../constants/mockData';
import type { CompanyFundamentals, FinancialQuarter } from '../../types';

const { width } = Dimensions.get('window');

// ──── Helpers ────────────────────────────────────────────────
const formatLarge = (val: number) => {
  if (val >= 100000) return `\u20B9${(val / 100000).toFixed(1)}L Cr`;
  if (val >= 1000) return `\u20B9${val.toFixed(0)} Cr`;
  return `\u20B9${val.toFixed(2)} Cr`;
};

const formatRatio = (val: number, decimals = 2) => val.toFixed(decimals);

const formatPercent = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;

// ──── Metric Row ─────────────────────────────────────────────
function MetricRow({
  label, value, unit, goodUp, sectorAvg,
}: {
  label: string; value: number; unit?: string; goodUp?: boolean; sectorAvg?: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const formatted = unit === '%' ? formatPercent(value)
    : unit === 'x' ? `${formatRatio(value)}x`
    : unit === 'days' ? `${Math.round(value)}d`
    : formatRatio(value);

  const vsSector = sectorAvg !== undefined ? value - sectorAvg : null;
  const isGood = vsSector !== null && goodUp !== undefined
    ? (goodUp ? vsSector >= 0 : vsSector <= 0)
    : null;

  return (
    <View style={styles.metricRow}>
      <View style={styles.metricLeft}>
        <Text style={styles.metricLabel}>{label}</Text>
        {sectorAvg !== undefined && (
          <Text style={styles.metricSector}>Sector: {unit === '%' ? formatPercent(sectorAvg) : formatRatio(sectorAvg)}</Text>
        )}
      </View>
      <View style={styles.metricRight}>
        <Text style={[styles.metricValue, {
          color: isGood === true ? colors.marketUp : isGood === false ? colors.marketDown : colors.text,
        }]}>
          {formatted}
        </Text>
        {vsSector !== null && (
          <View style={[styles.vsBadge, {
            backgroundColor: isGood ? `${colors.marketUp}20` : `${colors.marketDown}20`,
          }]}>
            <Ionicons
              name={isGood ? 'arrow-up' : 'arrow-down'}
              size={10}
              color={isGood ? colors.marketUp : colors.marketDown}
            />
            <Text style={[styles.vsText, {
              color: isGood ? colors.marketUp : colors.marketDown,
            }]}>
              {Math.abs(vsSector).toFixed(1)}{unit === '%' ? '%' : 'x'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ──── Section Card ───────────────────────────────────────────
function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon as any} size={18} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <View style={styles.sectionDivider} />
      {children}
    </View>
  );
}

// ──── Quarterly Bar Chart ────────────────────────────────────
function QuarterlyChart({ quarters, label }: { quarters: FinancialQuarter[]; label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const maxVal = Math.max(...quarters.map(q => q.revenue));

  return (
    <View style={styles.chartContainer}>
      <Text style={[styles.chartLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.barsRow}>
        {quarters.map((q) => {
          const barHeight = (q.revenue / maxVal) * 100;
          return (
            <View key={q.quarter} style={styles.barCol}>
              <Text style={[styles.barValue, { color: colors.textMuted }]}>
                {q.revenue >= 100000 ? `${(q.revenue / 100000).toFixed(1)}L` : `${(q.revenue / 1000).toFixed(0)}K`}
              </Text>
              <View style={[styles.barTrack, { backgroundColor: `${colors.primary}20` }]}>
                <View style={[styles.barFill, {
                  height: `${barHeight}%`,
                  backgroundColor: colors.primary,
                }]} />
              </View>
              <Text style={[styles.barLabel, { color: colors.textMuted }]}>{q.quarter}</Text>
              <Text style={[styles.barSub, { color: q.margin > 0 ? colors.marketUp : colors.marketDown }]}>
                {q.margin.toFixed(1)}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ──── Donut Chart (Shareholding) ────────────────────────────
function ShareholdingChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.shareholdingRow}>
      {data.map((item) => (
        <View key={item.label} style={styles.shareholdingItem}>
          <View style={[styles.shareholdingDot, { backgroundColor: item.color }]} />
          <Text style={[styles.shareholdingLabel, { color: colors.textSecondary }]}>{item.label}</Text>
          <Text style={[styles.shareholdingValue, { color: colors.text }]}>{item.value.toFixed(1)}%</Text>
          <View style={[styles.shareholdingBar, { backgroundColor: `${item.color}20` }]}>
            <View style={[styles.shareholdingFill, { width: `${item.value}%`, backgroundColor: item.color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ──── Main Screen ────────────────────────────────────────────
export default function CompanyFundamentalsScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { symbol, stockId } = route.params || {};
  const { stocks } = useMarketStore();
  const stock = stocks.find(s => s.id === stockId || s.symbol === symbol);

  const [fundamentals, setFundamentals] = useState<CompanyFundamentals | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllQuarters, setShowAllQuarters] = useState(false);

  const fetchFundamentals = useCallback(async () => {
    if (!symbol) {
      setIsLoading(false);
      setError('No symbol provided');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try API first
      const data = await marketApi.getFundamentals(symbol);
      setFundamentals(data);
    } catch {
      // Fallback to mock data
      const mockData = mockFundamentals[symbol];
      if (mockData) {
        setFundamentals(mockData);
      } else {
        setError(`Fundamentals data not available for ${symbol}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchFundamentals();
  }, [fetchFundamentals]);

  // ── Loading State ──
  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: 60 }]}>
        <View style={{ paddingHorizontal: SPACING.xl }}>
          <SkeletonBlock width="40%" height={28} />
          <View style={{ height: 8 }} />
          <SkeletonBlock width="60%" height={14} />
          <View style={{ height: SPACING.lg }} />
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={{ marginTop: SPACING.md }}>
              <SkeletonCard hasAvatar={false} hasAction={false} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ── Error / Empty State ──
  if (!fundamentals || error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Ionicons name="analytics-outline" size={64} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {error || `Fundamentals data not available for ${symbol}`}
        </Text>
        <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md }}>
          <AnimatedPressable onPress={fetchFundamentals} haptic="medium" scaleTo={0.95}>
            <View style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
              <Ionicons name="refresh" size={18} color={colors.white} />
              <Text style={styles.retryBtnText}>Retry</Text>
            </View>
          </AnimatedPressable>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.95}>
            <View style={[styles.backBtnOutlined, { borderColor: colors.border }]}>
              <Text style={[styles.backBtnOutlinedText, { color: colors.text }]}>Go Back</Text>
            </View>
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  const quarters = fundamentals.quarterlyResults;
  const visibleQuarters = showAllQuarters ? quarters : quarters.slice(0, 2);
  const shareholdingData = [
    { label: 'Promoters', value: fundamentals.promotersHolding, color: '#6C63FF' },
    { label: 'FII', value: fundamentals.fiiHolding, color: '#00D2FF' },
    { label: 'MF', value: fundamentals.mutualFundHolding, color: '#00E676' },
    { label: 'Public', value: fundamentals.publicHolding, color: '#FFC107' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.92}>
            <View style={[styles.backIcon, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </View>
          </AnimatedPressable>
          <View style={styles.headerInfo}>
            <Text style={styles.headerSymbol}>{fundamentals.symbol}</Text>
            <Text style={styles.headerName}>{fundamentals.name}</Text>
            <View style={[styles.sectorBadge, { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}30` }]}>
              <Text style={[styles.sectorText, { color: colors.primary }]}>{fundamentals.industry}</Text>
            </View>
          </View>
          {stock && (
            <View style={styles.headerPrice}>
              <Text style={[styles.headerPriceVal, { color: colors.text }]}>
                {formatCurrency(stock.price, true)}
              </Text>
              <Text style={[styles.headerPriceChange, {
                color: stock.change >= 0 ? colors.marketUp : colors.marketDown,
              }]}>
                {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Section 1: Valuation Ratios */}
        <SectionCard title="Valuation Ratios" icon="pricetags-outline">
          <MetricRow label="P/E Ratio" value={fundamentals.peRatio} unit="x" goodUp={false} sectorAvg={fundamentals.sectorAvgPe} />
          <MetricRow label="P/B Ratio" value={fundamentals.pbRatio} unit="x" goodUp={false} sectorAvg={fundamentals.sectorAvgPb} />
          <MetricRow label="P/S Ratio" value={fundamentals.psRatio} unit="x" goodUp={false} />
          <MetricRow label="EV/EBITDA" value={fundamentals.evEbitda} unit="x" goodUp={false} />
        </SectionCard>

        {/* Section 2: Profitability Ratios */}
        <SectionCard title="Profitability Ratios" icon="trending-up-outline">
          <MetricRow label="ROE" value={fundamentals.roe} unit="%" goodUp sectorAvg={undefined} />
          <MetricRow label="ROA" value={fundamentals.roa} unit="%" goodUp />
          <MetricRow label="ROCE" value={fundamentals.roce} unit="%" goodUp sectorAvg={fundamentals.sectorAvgRoce} />
          <MetricRow label="Operating Margin" value={fundamentals.operatingMargin} unit="%" goodUp />
          <MetricRow label="Net Margin" value={fundamentals.netMargin} unit="%" goodUp />
        </SectionCard>

        {/* Section 3: Efficiency & Liquidity */}
        <SectionCard title="Efficiency & Liquidity" icon="fitness-outline">
          <MetricRow label="Asset Turnover" value={fundamentals.assetTurnover} unit="x" goodUp />
          <MetricRow label="Debt-to-Equity" value={fundamentals.debtToEquity} unit="x" goodUp={false} sectorAvg={fundamentals.sectorAvgDebtEquity} />
          <MetricRow label="Current Ratio" value={fundamentals.currentRatio} unit="x" goodUp />
          <MetricRow label="Quick Ratio" value={fundamentals.quickRatio} unit="x" goodUp />
          <MetricRow label="Interest Coverage" value={fundamentals.interestCoverage} unit="x" goodUp />
          <MetricRow label="Inventory Turnover" value={fundamentals.inventoryTurnover} unit="x" goodUp />
        </SectionCard>

        {/* Section 4: Growth */}
        <SectionCard title="Growth Metrics (YoY)" icon="rocket-outline">
          <MetricRow label="Revenue Growth" value={fundamentals.revenueGrowth} unit="%" goodUp />
          <MetricRow label="Profit Growth" value={fundamentals.profitGrowth} unit="%" goodUp />
          <MetricRow label="EPS Growth" value={fundamentals.epsGrowth} unit="%" goodUp />
        </SectionCard>

        {/* Section 5: Cash Flow & Dividend */}
        <SectionCard title="Cash Flow & Dividend" icon="cash-outline">
          <MetricRow label="Operating Cash Flow" value={fundamentals.operatingCashFlow} />
          <MetricRow label="Free Cash Flow" value={fundamentals.freeCashFlow} />
          <MetricRow label="Dividend Yield" value={fundamentals.dividendYield} unit="%" goodUp />
          <MetricRow label="Payout Ratio" value={fundamentals.dividendPayout} unit="%" goodUp={false} />
        </SectionCard>

        {/* Section 6: Shareholding Pattern */}
        <SectionCard title="Shareholding Pattern" icon="people-outline">
          <ShareholdingChart data={shareholdingData} />
        </SectionCard>

        {/* Section 7: Quarterly Results */}
        <SectionCard title="Quarterly Results" icon="calendar-outline">
          <QuarterlyChart quarters={visibleQuarters} label="Revenue (Cr)" />
          {quarters.length > 2 && (
            <AnimatedPressable onPress={() => setShowAllQuarters(!showAllQuarters)} haptic="light" scaleTo={0.97}>
              <View style={[styles.showMoreBtn, { borderColor: colors.border }]}>
                <Text style={[styles.showMoreText, { color: colors.primary }]}>
                  {showAllQuarters ? 'Show Less' : `Show All (${quarters.length} quarters)`}
                </Text>
                <Ionicons name={showAllQuarters ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
              </View>
            </AnimatedPressable>
          )}

          {/* Quarterly Data Table */}
          <View style={styles.quarterTable}>
            <View style={[styles.quarterTableHeader, { backgroundColor: `${colors.primary}10` }]}>
              <Text style={[styles.quarterTableCell, styles.quarterTableHeaderText, { color: colors.textSecondary }]}>Quarter</Text>
              <Text style={[styles.quarterTableCell, styles.quarterTableHeaderText, { color: colors.textSecondary }]}>Revenue</Text>
              <Text style={[styles.quarterTableCell, styles.quarterTableHeaderText, { color: colors.textSecondary }]}>Profit</Text>
              <Text style={[styles.quarterTableCell, styles.quarterTableHeaderText, { color: colors.textSecondary }]}>EPS</Text>
              <Text style={[styles.quarterTableCell, styles.quarterTableHeaderText, { color: colors.textSecondary }]}>Margin</Text>
            </View>
            {(showAllQuarters ? quarters : quarters.slice(0, 4)).map((q, i) => (
              <View key={q.quarter} style={[styles.quarterTableRow, i % 2 === 0 && { backgroundColor: `${colors.bgInput}` }]}>
                <Text style={[styles.quarterTableCell, { color: colors.text }]}>{q.quarter}</Text>
                <Text style={[styles.quarterTableCell, { color: colors.textSecondary }]}>
                  {q.revenue >= 100000 ? `${(q.revenue / 100000).toFixed(1)}L Cr` : `${(q.revenue / 1000).toFixed(0)}K Cr`}
                </Text>
                <Text style={[styles.quarterTableCell, { color: q.netProfit >= 0 ? colors.marketUp : colors.marketDown }]}>
                  {q.netProfit >= 100000 ? `${(q.netProfit / 100000).toFixed(1)}L Cr` : `${(q.netProfit / 1000).toFixed(0)}K Cr`}
                </Text>
                <Text style={[styles.quarterTableCell, { color: colors.text }]}>{q.eps.toFixed(1)}</Text>
                <Text style={[styles.quarterTableCell, { color: q.margin >= 0 ? colors.marketUp : colors.marketDown }]}>
                  {q.margin.toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        </SectionCard>

        {/* Section 8: Annual Results */}
        <SectionCard title="Annual Results (Last 3 Years)" icon="bar-chart-outline">
          <QuarterlyChart quarters={fundamentals.annualResults} label="Annual Revenue (Cr)" />
          <View style={styles.quarterTable}>
            <View style={[styles.quarterTableHeader, { backgroundColor: `${colors.primary}10` }]}>
              <Text style={[styles.quarterTableCell, styles.quarterTableHeaderText, { color: colors.textSecondary }]}>Year</Text>
              <Text style={[styles.quarterTableCell, styles.quarterTableHeaderText, { color: colors.textSecondary }]}>Revenue</Text>
              <Text style={[styles.quarterTableCell, styles.quarterTableHeaderText, { color: colors.textSecondary }]}>Profit</Text>
              <Text style={[styles.quarterTableCell, styles.quarterTableHeaderText, { color: colors.textSecondary }]}>EPS</Text>
              <Text style={[styles.quarterTableCell, styles.quarterTableHeaderText, { color: colors.textSecondary }]}>Margin</Text>
            </View>
            {fundamentals.annualResults.map((q, i) => (
              <View key={q.quarter} style={[styles.quarterTableRow, i % 2 === 0 && { backgroundColor: `${colors.bgInput}` }]}>
                <Text style={[styles.quarterTableCell, { color: colors.text }]}>{q.quarter}</Text>
                <Text style={[styles.quarterTableCell, { color: colors.textSecondary }]}>
                  {q.revenue >= 100000 ? `${(q.revenue / 100000).toFixed(1)}L Cr` : `${(q.revenue / 1000).toFixed(0)}K Cr`}
                </Text>
                <Text style={[styles.quarterTableCell, { color: q.netProfit >= 0 ? colors.marketUp : colors.marketDown }]}>
                  {q.netProfit >= 100000 ? `${(q.netProfit / 100000).toFixed(1)}L Cr` : `${(q.netProfit / 1000).toFixed(0)}K Cr`}
                </Text>
                <Text style={[styles.quarterTableCell, { color: colors.text }]}>{q.eps.toFixed(1)}</Text>
                <Text style={[styles.quarterTableCell, { color: q.margin >= 0 ? colors.marketUp : colors.marketDown }]}>
                  {q.margin.toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        </SectionCard>

        {/* Section 9: About the Company */}
        <SectionCard title="About the Company" icon="information-circle-outline">
          <Text style={[styles.aboutText, { color: colors.textSecondary }]}>{fundamentals.about}</Text>
          <View style={{ height: SPACING.md }} />
          <Text style={[styles.strengthTitle, { color: colors.marketUp }]}>Strengths</Text>
          {fundamentals.strengths.map((s, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bullet, { color: colors.marketUp }]}>+</Text>
              <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{s}</Text>
            </View>
          ))}
          <View style={{ height: SPACING.md }} />
          <Text style={[styles.strengthTitle, { color: colors.marketDown }]}>Risks</Text>
          {fundamentals.risks.map((r, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bullet, { color: colors.marketDown }]}>-</Text>
              <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{r}</Text>
            </View>
          ))}
        </SectionCard>

        {/* Section 10: Peer Comparison Overview */}
        <SectionCard title="Peer Comparison" icon="git-compare-outline">
          <View style={styles.peerComparison}>
            <View style={styles.peerRow}>
              <Text style={[styles.peerLabel, { color: colors.textSecondary }]}>Metric</Text>
              <Text style={[styles.peerVal, { color: colors.primary }]}>This Stock</Text>
              <Text style={[styles.peerVal, { color: colors.textMuted }]}>Sector Avg</Text>
            </View>
            <View style={styles.peerRow}>
              <Text style={[styles.peerLabel, { color: colors.textSecondary }]}>P/E</Text>
              <Text style={[styles.peerVal, {
                color: fundamentals.peRatio <= fundamentals.sectorAvgPe ? colors.marketUp : colors.marketDown,
              }]}>{fundamentals.peRatio.toFixed(1)}x</Text>
              <Text style={[styles.peerVal, { color: colors.textMuted }]}>{fundamentals.sectorAvgPe.toFixed(1)}x</Text>
            </View>
            <View style={styles.peerRow}>
              <Text style={[styles.peerLabel, { color: colors.textSecondary }]}>P/B</Text>
              <Text style={[styles.peerVal, {
                color: fundamentals.pbRatio <= fundamentals.sectorAvgPb ? colors.marketUp : colors.marketDown,
              }]}>{fundamentals.pbRatio.toFixed(1)}x</Text>
              <Text style={[styles.peerVal, { color: colors.textMuted }]}>{fundamentals.sectorAvgPb.toFixed(1)}x</Text>
            </View>
            {fundamentals.sectorAvgRoce > 0 && (
              <View style={styles.peerRow}>
                <Text style={[styles.peerLabel, { color: colors.textSecondary }]}>ROCE</Text>
                <Text style={[styles.peerVal, {
                  color: fundamentals.roce >= fundamentals.sectorAvgRoce ? colors.marketUp : colors.marketDown,
                }]}>{fundamentals.roce.toFixed(1)}%</Text>
                <Text style={[styles.peerVal, { color: colors.textMuted }]}>{fundamentals.sectorAvgRoce.toFixed(1)}%</Text>
              </View>
            )}
            <View style={styles.peerRow}>
              <Text style={[styles.peerLabel, { color: colors.textSecondary }]}>D/E</Text>
              <Text style={[styles.peerVal, {
                color: fundamentals.debtToEquity <= fundamentals.sectorAvgDebtEquity ? colors.marketUp : colors.marketDown,
              }]}>{fundamentals.debtToEquity.toFixed(2)}x</Text>
              <Text style={[styles.peerVal, { color: colors.textMuted }]}>{fundamentals.sectorAvgDebtEquity.toFixed(2)}x</Text>
            </View>
          </View>
        </SectionCard>

        {/* Bottom padding */}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ──── Styles ─────────────────────────────────────────────────
const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.lg,
    padding: SPACING.xxl,
  },
  emptyText: {
    ...FONTS.regular,
    fontSize: FONTS.size.md,
    textAlign: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  backBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.white,
  },
  backBtnOutlined: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  backBtnOutlinedText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  retryBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.white,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  backIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerInfo: {
    flex: 1,
  },
  headerSymbol: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  headerName: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectorBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.xs,
    borderWidth: 1,
  },
  sectorText: {
    ...FONTS.medium,
    fontSize: 10,
  },
  headerPrice: {
    alignItems: 'flex-end',
  },
  headerPriceVal: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  headerPriceChange: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    marginTop: 2,
  },
  sectionCard: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: SPACING.md,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  metricLeft: {
    flex: 1,
  },
  metricLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  metricSector: {
    ...FONTS.regular,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  metricRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  metricValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  vsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.full,
  },
  vsText: {
    ...FONTS.medium,
    fontSize: 9,
  },
  chartContainer: {
    marginVertical: SPACING.sm,
  },
  chartLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    marginBottom: SPACING.sm,
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 140,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barValue: {
    ...FONTS.medium,
    fontSize: 9,
    marginBottom: 4,
  },
  barTrack: {
    width: 36,
    height: 80,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
    position: 'absolute',
    bottom: 0,
  },
  barLabel: {
    ...FONTS.medium,
    fontSize: 9,
    marginTop: 4,
  },
  barSub: {
    ...FONTS.semiBold,
    fontSize: 9,
    marginTop: 1,
  },
  shareholdingRow: {
    gap: SPACING.sm,
  },
  shareholdingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  shareholdingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  shareholdingLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    width: 72,
  },
  shareholdingValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    width: 48,
    textAlign: 'right',
  },
  shareholdingBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  shareholdingFill: {
    height: '100%',
    borderRadius: 3,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  showMoreText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  quarterTable: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  quarterTableHeader: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  quarterTableHeaderText: {
    ...FONTS.bold,
    fontSize: 10,
  },
  quarterTableRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  quarterTableCell: {
    flex: 1,
    fontSize: 10,
    ...FONTS.medium,
    textAlign: 'center',
  },
  aboutText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
  },
  strengthTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  bullet: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    width: 16,
    textAlign: 'center',
  },
  bulletText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    flex: 1,
    lineHeight: 18,
  },
  peerComparison: {
    gap: 0,
  },
  peerRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.divider,
  },
  peerLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    flex: 1,
  },
  peerVal: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    width: 80,
    textAlign: 'right',
  },
});
