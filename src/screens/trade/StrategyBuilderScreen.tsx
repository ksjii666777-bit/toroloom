/**
 * ============================================================================
 * Toroloom — F&O Strategy Builder Screen
 * ============================================================================
 *
 * Build and analyze multi-leg F&O strategies with:
 *   - Pre-built strategy templates (Iron Condor, Straddle, Spreads, etc.)
 *   - Manual leg builder (CE/PE/Future, buy/sell, strike, premium)
 *   - Interactive P&L chart visualization
 *   - Max profit, max loss, breakeven analysis
 *
 * ============================================================================
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useFnoStore } from '../../store/fnoStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { StrategyLeg } from '../../types';
import { fnoApi, PrebuiltStrategy } from '../../services/api/fno';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 200;
const CHART_WIDTH = SCREEN_WIDTH - SPACING.xl * 4;



const STRATEGY_TYPE_COLORS: Record<string, string> = {
  CE: '#00C853',
  PE: '#FF5252',
  FUTURE: '#3B82F6',
};

export default function StrategyBuilderScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    strategyLegs,
    strategyResult,
    selectedStrategyName,
    strategyLoading,
    spotPrices,
    addStrategyLeg,
    removeStrategyLeg,
    updateStrategyLeg,
    clearStrategyLegs,
    setSelectedStrategyName,
    analyzeStrategy,
    fetchSpotPrices,
    selectedSymbol,
  } = useFnoStore();

  const [prebuiltStrategies, setPrebuiltStrategies] = useState<PrebuiltStrategy[]>([]);
  const [selectedPrebuilt, setSelectedPrebuilt] = useState<PrebuiltStrategy | null>(null);
  const [showPrebuilt, setShowPrebuilt] = useState(true);
  const [spotPrice, setSpotPrice] = useState(23456.80);
  const [, setEditingLegId] = useState<string | null>(null);

  useEffect(() => {
    fetchSpotPrices();
    loadPrebuiltStrategies();
  }, []);

  useEffect(() => {
    if (spotPrices[selectedSymbol]) {
      setSpotPrice(spotPrices[selectedSymbol]);
    }
  }, [spotPrices, selectedSymbol]);

  const loadPrebuiltStrategies = async () => {
    try {
      const strategies = await fnoApi.getPrebuiltStrategies();
      setPrebuiltStrategies(strategies);
    } catch {
      // Use mock fallback
      setPrebuiltStrategies([
        { id: 'long_call', name: 'Long Call', description: 'Buy a call option. Limited risk, unlimited profit.', riskCategory: 'moderate', isBullish: true, isBearish: false, isNeutral: false, legs: [{ type: 'CE', action: 'buy', count: 1 }] },
        { id: 'long_put', name: 'Long Put', description: 'Buy a put option. Limited risk, unlimited profit potential.', riskCategory: 'moderate', isBullish: false, isBearish: true, isNeutral: false, legs: [{ type: 'PE', action: 'buy', count: 1 }] },
        { id: 'bull_call_spread', name: 'Bull Call Spread', description: 'Buy ATM call + Sell OTM call. Defined risk/reward.', riskCategory: 'low', isBullish: true, isBearish: false, isNeutral: false, legs: [{ type: 'CE', action: 'buy', count: 1 }, { type: 'CE', action: 'sell', count: 1 }] },
        { id: 'long_straddle', name: 'Long Straddle', description: 'Buy ATM call + Buy ATM put. Profits from big moves.', riskCategory: 'moderate', isBullish: false, isBearish: false, isNeutral: true, legs: [{ type: 'CE', action: 'buy', count: 1 }, { type: 'PE', action: 'buy', count: 1 }] },
        { id: 'iron_condor', name: 'Iron Condor', description: 'Range-bound strategy with defined risk. 4 legs.', riskCategory: 'low', isBullish: false, isBearish: false, isNeutral: true, legs: [{ type: 'PE', action: 'sell', count: 1 }, { type: 'PE', action: 'buy', count: 1 }, { type: 'CE', action: 'sell', count: 1 }, { type: 'CE', action: 'buy', count: 1 }] },
      ]);
    }
  };

  const handleSelectPrebuilt = useCallback((strategy: PrebuiltStrategy) => {
    setSelectedPrebuilt(strategy);
    setSelectedStrategyName(strategy.name);
    setShowPrebuilt(false);
    clearStrategyLegs();

    // Auto-populate legs based on strategy template
    const atmStrike = Math.round(spotPrice / 50) * 50;
    const spreadWidth = 100;

    strategy.legs.forEach((leg, i) => {
      const legStrike = leg.type === 'CE'
        ? atmStrike + (leg.action === 'sell' ? spreadWidth : 0)
        : atmStrike - (leg.action === 'sell' ? spreadWidth : 0);
      const basePremium = spotPrice * 0.015; // ~1.5% of spot
      const premiumAdjustment = leg.action === 'sell' ? basePremium * 0.6 : basePremium;
      const premium = leg.type === 'CE'
        ? premiumAdjustment + (legStrike - atmStrike > 0 ? 0 : Math.abs(legStrike - atmStrike) * 0.3)
        : premiumAdjustment - (legStrike - atmStrike > 0 ? Math.abs(legStrike - atmStrike) * 0.3 : 0);

      const newLeg: StrategyLeg = {
        id: `leg_${Date.now()}_${i}`,
        action: leg.action as 'buy' | 'sell',
        type: leg.type as 'CE' | 'PE' | 'FUTURE',
        strike: legStrike,
        expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: leg.count || 1,
        premium: Math.max(0.5, Math.round(premium * 100) / 100),
        lotSize: 50,
      };
      addStrategyLeg(newLeg);
    });

    // Auto-analyze after setting up legs
    setTimeout(() => analyzeStrategy(spotPrice), 300);
  }, [spotPrice, selectedStrategyName, clearStrategyLegs, addStrategyLeg, analyzeStrategy]);

  const handleAddCustomLeg = useCallback(() => {
    const newLeg: StrategyLeg = {
      id: `leg_${Date.now()}`,
      action: 'buy',
      type: 'CE',
      strike: Math.round(spotPrice / 50) * 50,
      expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      quantity: 1,
      premium: Math.round(spotPrice * 0.015 * 100) / 100,
      lotSize: 50,
    };
    addStrategyLeg(newLeg);
    setEditingLegId(newLeg.id);
  }, [spotPrice, addStrategyLeg]);

  const handleAnalyze = useCallback(() => {
    analyzeStrategy(spotPrice);
    setSelectedPrebuilt(null);
  }, [analyzeStrategy, spotPrice]);

  const renderPnLChart = () => {
    if (!strategyResult || !strategyResult.pnlChart) return null;
    const pnlChart = strategyResult.pnlChart as unknown as { underlyingPrice: number; pnl: number; legPnls?: number[] }[];

    if (pnlChart.length === 0) return null;

    const pnls = pnlChart.map(p => p.pnl);
    const maxPnl = Math.max(...pnls, 1);
    const minPnl = Math.min(...pnls, -1);
    const range = maxPnl - minPnl || 1;
    const zeroY = (maxPnl / range) * CHART_HEIGHT;

    return (
      <View style={[styles.chartContainer, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>P&L Diagram</Text>

        {/* Chart */}
        <View style={[styles.chart, { height: CHART_HEIGHT }]}>
          {/* Zero line */}
          <View style={[styles.zeroLine, { top: zeroY, backgroundColor: colors.textMuted + '40' }]} />

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(f => {
            const y = (f * (maxPnl - minPnl) + minPnl) === 0 ? 0 : (maxPnl - f * range) / range * CHART_HEIGHT;
            return (
              <View key={f} style={[styles.gridLine, { top: y, backgroundColor: colors.divider }]} />
            );
          })}

          {/* P&L Line */}
          {(() => {
            return (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                {/* Points */}
                {pnlChart.filter((_, idx) => idx % 5 === 0).map((p, idx) => {
                  const chartIdx = idx * 5;
                  const x = (chartIdx / (pnlChart.length - 1)) * CHART_WIDTH;
                  const y = ((maxPnl - p.pnl) / range) * CHART_HEIGHT;
                  return (
                    <View
                      key={idx}
                      style={[styles.chartPoint, {
                        left: x - 3,
                        top: y - 3,
                        backgroundColor: p.pnl >= 0 ? colors.marketUp : colors.marketDown,
                      }]}
                    />
                  );
                })}
              </View>
            );
          })()}

          {/* Labels */}
          <View style={[styles.chartYAxis, { left: 0 }]}>
            <Text style={[styles.chartAxisLabel, { color: colors.textMuted }]}>
              {formatCurrency(maxPnl, true)}
            </Text>
            <Text style={[styles.chartAxisLabel, { color: colors.textMuted, top: '50%' }]}>
              0
            </Text>
            <Text style={[styles.chartAxisLabel, { color: colors.textMuted, top: '90%' }]}>
              {formatCurrency(minPnl, true)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderStrategyResult = () => {
    if (!strategyResult) return null;

  
    const riskLabel = strategyResult.maxLoss < 0
      ? Math.abs(strategyResult.maxLossPercent).toFixed(1)
      : 'Limited';

    return (
      <Card title="Strategy Analysis" style={styles.resultCard}>
        {/* Max Profit / Loss */}
        <View style={styles.resultRow}>
          <View style={[styles.resultBadge, { backgroundColor: '#00C85320', flex: 1 }]}>
            <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Max Profit</Text>
            <Text style={[styles.resultValue, { color: colors.marketUp }]}>
              +{formatCurrency(strategyResult.maxProfit, true)}
            </Text>
            <Text style={[styles.resultPercent, { color: colors.marketUp }]}>
              +{strategyResult.maxProfitPercent.toFixed(1)}%
            </Text>
          </View>
          <View style={[styles.resultBadge, { backgroundColor: '#FF174420', flex: 1 }]}>
            <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Max Loss</Text>
            <Text style={[styles.resultValue, { color: colors.marketDown }]}>
              {formatCurrency(strategyResult.maxLoss, true)}
            </Text>
            <Text style={[styles.resultPercent, { color: colors.marketDown }]}>
              {strategyResult.maxLossPercent.toFixed(1)}%
            </Text>
          </View>
        </View>

        {/* Breakeven */}
        {strategyResult.breakevenPoints.length > 0 && (
          <View style={styles.breakevenSection}>
            <Text style={[styles.breakevenLabel, { color: colors.textMuted }]}>
              Breakeven{strategyResult.breakevenPoints.length > 1 ? ' Points' : ''}
            </Text>
            <View style={styles.breakevenRow}>
              {strategyResult.breakevenPoints.map((bp, i) => (
                <View key={i} style={[styles.breakevenChip, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
                  <Text style={[styles.breakevenValue, { color: colors.primary }]}>
                    {formatCurrency(bp, true)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bias */}
        <View style={styles.biasSection}>
          <Text style={[styles.biasLabel, { color: colors.textMuted }]}>Market Outlook</Text>
          <View style={styles.biasRow}>
            <Badge
              label={strategyResult.isBullish ? 'Bullish 📈' : strategyResult.isBearish ? 'Bearish 📉' : 'Neutral ↔️'}
              variant={strategyResult.isBullish ? 'success' : strategyResult.isBearish ? 'danger' : 'info'}
            />
            <Badge
              label={`Risk: ${riskLabel}%`}
              variant={Math.abs(strategyResult.maxLossPercent) > 20 ? 'danger' : 'warning'}
            />
          </View>
        </View>

        {/* P&L Chart */}
        {renderPnLChart()}
      </Card>
    );
  };

  const renderLegEditor = (leg: StrategyLeg) => {
  
    return (
      <View key={leg.id} style={[styles.legCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {/* Leg Header */}
        <View style={styles.legHeader}>
          <View style={[styles.legTypeBadge, {
            backgroundColor: (STRATEGY_TYPE_COLORS[leg.type] || '#888') + '20',
          }]}>
            <Text style={[styles.legTypeText, { color: STRATEGY_TYPE_COLORS[leg.type] || '#888' }]}>
              {leg.action === 'buy' ? '▲' : '▼'} {leg.type}
            </Text>
          </View>
          <Text style={[styles.legAction, { color: leg.action === 'buy' ? colors.marketUp : colors.marketDown }]}>
            {leg.action.toUpperCase()}
          </Text>
          <View style={{ flex: 1 }} />
          {strategyLegs.length > 1 && (
            <TouchableOpacity onPress={() => removeStrategyLeg(leg.id)}>
              <Ionicons name="close-circle" size={20} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>

        {/* Leg Details */}
        <View style={styles.legDetails}>
          <View style={styles.legField}>
            <Text style={[styles.legFieldLabel, { color: colors.textMuted }]}>Strike</Text>
            <TextInput
              style={[styles.legFieldInput, { color: colors.text, borderColor: colors.border }]}
              value={String(leg.strike)}
              onChangeText={(v) => updateStrategyLeg(leg.id, { strike: parseFloat(v) || 0 })}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.legField}>
            <Text style={[styles.legFieldLabel, { color: colors.textMuted }]}>Premium</Text>
            <TextInput
              style={[styles.legFieldInput, { color: colors.text, borderColor: colors.border }]}
              value={String(leg.premium)}
              onChangeText={(v) => updateStrategyLeg(leg.id, { premium: parseFloat(v) || 0 })}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.legField}>
            <Text style={[styles.legFieldLabel, { color: colors.textMuted }]}>Lots</Text>
            <TextInput
              style={[styles.legFieldInput, { color: colors.text, borderColor: colors.border }]}
              value={String(leg.quantity)}
              onChangeText={(v) => updateStrategyLeg(leg.id, { quantity: parseInt(v) || 1 })}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Quick action toggle */}
        <TouchableOpacity
          style={[styles.legActionToggle, {
            backgroundColor: leg.action === 'buy' ? '#00C85320' : '#FF174420',
          }]}
          onPress={() => updateStrategyLeg(leg.id, { action: leg.action === 'buy' ? 'sell' : 'buy' })}
        >
          <Text style={[styles.legActionToggleText, {
            color: leg.action === 'buy' ? colors.marketUp : colors.marketDown,
          }]}>
            Tap to {leg.action === 'buy' ? 'SELL' : 'BUY'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Strategy Builder</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {selectedStrategyName}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.switchViewBtn, { borderColor: colors.primary + '40' }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="options" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Spot Price */}
        <View style={[styles.spotPriceBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.spotPriceLabel, { color: colors.textMuted }]}>Underlying Price</Text>
          <TextInput
            style={[styles.spotPriceInput, { color: colors.text }]}
            value={String(Math.round(spotPrice))}
            onChangeText={(v) => setSpotPrice(parseFloat(v) || 0)}
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={[styles.analyzeBtn, { backgroundColor: colors.primary }]}
            onPress={handleAnalyze}
            disabled={strategyLegs.length === 0 || strategyLoading}
          >
            <Ionicons name="flash" size={16} color={colors.white} />
            <Text style={[styles.analyzeBtnText, { color: colors.white }]}>
              {strategyLoading ? '...' : 'Analyze'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pre-built Strategy Templates */}
        {showPrebuilt && prebuiltStrategies.length > 0 && (
          <View style={styles.prebuiltSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Strategy Templates</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.prebuiltScroll}>
              {prebuiltStrategies.map(s => {
                const isSelected = selectedPrebuilt?.id === s.id;
                const riskColor = s.riskCategory === 'low' ? '#00C853'
                  : s.riskCategory === 'moderate' ? '#FFC107' : '#FF5252';
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.prebuiltCard,
                      {
                        backgroundColor: colors.bgCard,
                        borderColor: isSelected ? riskColor : colors.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => handleSelectPrebuilt(s)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.prebuiltHeader, { borderBottomColor: colors.divider }]}>
                      <Text style={[styles.prebuiltName, { color: colors.text }]}>{s.name}</Text>
                      <View style={[styles.prebuiltRiskBadge, { backgroundColor: (riskColor + '30') }]}>
                        <Text style={[styles.prebuiltRiskText, { color: riskColor }]}>
                          {s.riskCategory}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.prebuiltDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                      {s.description}
                    </Text>
                    <View style={styles.prebuiltMeta}>
                      <Text style={[styles.prebuiltLegs, { color: colors.textMuted }]}>
                        {s.legs.length} leg{s.legs.length > 1 ? 's' : ''}
                      </Text>
                      {s.isBullish && <Text style={[styles.prebuiltBias, { color: colors.marketUp }]}>📈</Text>}
                      {s.isBearish && <Text style={[styles.prebuiltBias, { color: colors.marketDown }]}>📉</Text>}
                      {s.isNeutral && <Text style={[styles.prebuiltBias, { color: colors.warning }]}>↔️</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Toggle prebuilt view */}
        <TouchableOpacity
          style={[styles.togglePrebuilt, { borderColor: colors.border }]}
          onPress={() => setShowPrebuilt(!showPrebuilt)}
        >
          <Ionicons
            name={showPrebuilt ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
          <Text style={[styles.togglePrebuiltText, { color: colors.textMuted }]}>
            {showPrebuilt ? 'Hide Templates' : 'Show Strategy Templates'}
          </Text>
        </TouchableOpacity>

        {/* Strategy Legs */}
        {strategyLegs.length > 0 && (
          <View style={styles.legsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Strategy Legs ({strategyLegs.length})
            </Text>
            {strategyLegs.map(renderLegEditor)}
          </View>
        )}

        {/* Add Leg Button */}
        <AnimatedPressable onPress={handleAddCustomLeg} haptic="light" scaleTo={0.97}>
          <View style={[styles.addLegBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}>
            <Ionicons name="add-circle" size={20} color={colors.primary} />
            <Text style={[styles.addLegBtnText, { color: colors.primary }]}>Add Leg</Text>
          </View>
        </AnimatedPressable>

        {/* Clear All */}
        {strategyLegs.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearStrategyLegs}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={[styles.clearBtnText, { color: colors.danger }]}>Clear All</Text>
          </TouchableOpacity>
        )}

        {/* Strategy Result */}
        {strategyResult && renderStrategyResult()}

        {/* Strategy Info */}
        {!strategyResult && strategyLegs.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="shuffle-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Strategy Defined</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Choose a pre-built template above or add legs manually to build your strategy
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

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
    paddingBottom: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    marginTop: 1,
  },
  switchViewBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 20,
  },
  // Spot Price Bar
  spotPriceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  spotPriceLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  spotPriceInput: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.xl,
    minWidth: 100,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    marginLeft: 'auto',
  },
  analyzeBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
  },
  // Pre-built Templates
  prebuiltSection: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    marginBottom: SPACING.md,
  },
  prebuiltScroll: {
    gap: SPACING.md,
  },
  prebuiltCard: {
    width: 220,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  prebuiltHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    marginBottom: SPACING.sm,
  },
  prebuiltName: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
  },
  prebuiltRiskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  prebuiltRiskText: {
    ...FONTS.semiBold,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  prebuiltDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    lineHeight: 16,
    marginBottom: SPACING.sm,
  },
  prebuiltMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prebuiltLegs: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  prebuiltBias: {
    fontSize: 16,
  },
  togglePrebuilt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
  },
  togglePrebuiltText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
  },
  // Legs
  legsSection: {
    marginBottom: SPACING.lg,
  },
  legCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  legHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  legTypeBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  legTypeText: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
    fontFamily: 'monospace',
  },
  legAction: {
    ...FONTS.bold,
    fontSize: FONTS.size.sm,
  },
  legDetails: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  legField: {
    flex: 1,
  },
  legFieldLabel: {
    ...FONTS.regular,
    fontSize: 9,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  legFieldInput: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  legActionToggle: {
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
  },
  legActionToggleText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xs,
  },
  // Add Leg
  addLegBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginBottom: SPACING.md,
  },
  addLegBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
  },
  clearBtnText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
  // Results
  resultCard: {
    marginBottom: SPACING.lg,
  },
  resultRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  resultBadge: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  resultLabel: {
    ...FONTS.regular,
    fontSize: 9,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  resultValue: {
    ...FONTS.extraBold,
    fontSize: FONTS.size.lg,
  },
  resultPercent: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.xs,
    marginTop: 2,
  },
  // Breakeven
  breakevenSection: {
    marginBottom: SPACING.lg,
  },
  breakevenLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  breakevenRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  breakevenChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  breakevenValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    fontFamily: 'monospace',
  },
  // Bias
  biasSection: {
    marginBottom: SPACING.lg,
  },
  biasLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  biasRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  // Chart
  chartContainer: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  chartTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    marginBottom: SPACING.md,
  },
  chart: {
    position: 'relative',
    overflow: 'hidden',
  },
  zeroLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    zIndex: 5,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    zIndex: 1,
  },
  chartPoint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    zIndex: 10,
  },
  chartYAxis: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  chartAxisLabel: {
    ...FONTS.regular,
    fontSize: 8,
    fontFamily: 'monospace',
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.md,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
  },
  emptySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
});
