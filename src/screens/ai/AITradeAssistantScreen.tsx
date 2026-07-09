/**
 * ============================================================================
 * Toroloom — AI Trade Assistant Screen
 * ============================================================================
 *
 * Interactive tool that helps traders make informed decisions:
 *   1. Stock search & selection
 *   2. Risk profile setup (Conservative / Moderate / Aggressive)
 *   3. Position sizing calculator
 *   4. Risk assessment with factor breakdown
 *   5. Stop-loss & target suggestions
 *   6. Portfolio impact analysis
 *
 * All computations happen client-side via the tradeAssistant engine.
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Dimensions, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useMarketStore } from '../../store/marketStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { useAuthStore } from '../../store/authStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import {
  suggestPositionSize, assessTradeRisk, suggestTradePlan,
  analyzePortfolioImpact, RISK_PROFILES,
} from '../../services/ai/tradeAssistant';
import type { RiskTolerance, RiskLevel } from '../../services/ai/tradeAssistant';

const { width } = Dimensions.get('window');

// ─── Risk Level Colors ─────────────────────────────────────────────────────

const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#00E676',
  moderate: '#FFAB40',
  high: '#FF5252',
  extreme: '#D50000',
};

const RISK_BG: Record<RiskLevel, string> = {
  low: '#00E67620',
  moderate: '#FFAB4020',
  high: '#FF525220',
  extreme: '#D5000020',
};

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function AITradeAssistantScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { stocks } = useMarketStore();
  const { holdings } = usePortfolioStore();
  const { user } = useAuthStore();

  const availableBalance = user?.balance ?? 2500000;
  const totalPortfolioValue = holdings.reduce((s, h) => s + h.currentValue, 0) + availableBalance;

  // ── State ──
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('100');
  const [entryPrice, setEntryPrice] = useState('');
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>('moderate');
  const [showResults, setShowResults] = useState(false);

  const selectedStock = useMemo(() =>
    stocks.find(s => s.symbol === selectedSymbol) || stocks[0],
    [stocks, selectedSymbol],
  );

  const qtyNum = parseInt(quantity) || 0;
  const priceNum = parseFloat(entryPrice) || selectedStock?.price || 0;
  const positionCost = qtyNum * priceNum;

  // ── Compute Results ──
  const sizingResult = useMemo(() => {
    if (!showResults || qtyNum <= 0) return null;
    return suggestPositionSize({
      stockPrice: priceNum,
      availableBalance,
      totalPortfolioValue,
      riskTolerance,
      openPositionsCount: holdings.length,
    });
  }, [showResults, qtyNum, priceNum, availableBalance, totalPortfolioValue, riskTolerance, holdings.length]);

  const riskResult = useMemo(() => {
    if (!showResults || !selectedStock || qtyNum <= 0) return null;
    return assessTradeRisk({
      stock: selectedStock,
      tradeType,
      quantity: qtyNum,
      price: priceNum,
      holdings,
      availableBalance,
      riskTolerance,
    });
  }, [showResults, selectedStock, tradeType, qtyNum, priceNum, holdings, availableBalance, riskTolerance]);

  const tradePlan = useMemo(() => {
    if (!showResults || !selectedStock || qtyNum <= 0) return null;
    return suggestTradePlan({
      stock: selectedStock,
      tradeType,
      entryPrice: priceNum,
      riskTolerance,
    });
  }, [showResults, selectedStock, tradeType, priceNum, riskTolerance]);

  const impactResult = useMemo(() => {
    if (!showResults || !selectedStock || qtyNum <= 0) return null;
    return analyzePortfolioImpact({
      stockSymbol: selectedStock.symbol,
      stockSector: selectedStock.sector,
      tradeType,
      quantity: qtyNum,
      price: priceNum,
      holdings,
      availableBalance,
    });
  }, [showResults, selectedStock, tradeType, qtyNum, priceNum, holdings, availableBalance]);

  // ── Quick Stock Selectors ──
  const quickStocks = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'SBIN', 'TATAMOTORS'];

  // ── Use Suggested Qty ──
  const handleUseSuggested = useCallback((qty: number) => {
    setQuantity(String(qty));
  }, []);

  const profile = RISK_PROFILES[riskTolerance];

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Trade Assistant</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.headerSub}>Intelligent position sizing & risk analysis</Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ─── Stock Selector ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Stock</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: SPACING.sm }}>
            {quickStocks.map(sym => (
              <TouchableOpacity key={sym}
                style={[styles.stockChip, selectedSymbol === sym && styles.stockChipActive]}
                onPress={() => { setSelectedSymbol(sym); setShowResults(false); }}>
                <Text style={[styles.stockChipText, selectedSymbol === sym && styles.stockChipTextActive]}>
                  {sym}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {selectedStock && (
            <View style={[styles.stockInfo, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <View>
                <Text style={styles.stockName}>{selectedStock.name}</Text>
                <Text style={styles.stockMeta}>{selectedStock.sector} · P/E {selectedStock.pe.toFixed(1)} · 52W: ₹{selectedStock.low52}–₹{selectedStock.high52}</Text>
              </View>
              <Text style={[styles.stockPrice, {
                color: selectedStock.isPositive ? colors.marketUp : colors.marketDown,
              }]}>₹{selectedStock.price.toLocaleString()}</Text>
            </View>
          )}
        </View>

        {/* ─── Trade Parameters ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Trade Parameters</Text>

          {/* Buy/Sell Toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleBtn, tradeType === 'buy' && styles.toggleBuy]}
              onPress={() => setTradeType('buy')}>
              <Ionicons name="arrow-down" size={14} color={tradeType === 'buy' ? '#fff' : colors.marketUp} />
              <Text style={[styles.toggleText, tradeType === 'buy' && styles.toggleTextActive]}>Buy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, tradeType === 'sell' && styles.toggleSell]}
              onPress={() => setTradeType('sell')}>
              <Ionicons name="arrow-up" size={14} color={tradeType === 'sell' ? '#fff' : colors.marketDown} />
              <Text style={[styles.toggleText, tradeType === 'sell' && styles.toggleTextActive]}>Sell</Text>
            </TouchableOpacity>
          </View>

          {/* Quantity */}
          <View style={styles.inputGrid}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Quantity</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                value={quantity} onChangeText={v => { setQuantity(v); setShowResults(false); }}
                keyboardType="numeric" placeholder="100" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Entry Price (₹)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                value={entryPrice} onChangeText={v => { setEntryPrice(v); setShowResults(false); }}
                keyboardType="decimal-pad" placeholder={String(selectedStock?.price || '')}
                placeholderTextColor={colors.textMuted} />
            </View>
          </View>

          <View style={styles.costPreview}>
            <Text style={styles.costLabel}>Position Cost</Text>
            <Text style={styles.costValue}>{formatCurrency(positionCost)}</Text>
          </View>
        </View>

        {/* ─── Risk Profile ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Risk Profile</Text>
          <View style={styles.profileRow}>
            {(['conservative', 'moderate', 'aggressive'] as RiskTolerance[]).map(r => (
              <TouchableOpacity key={r}
                style={[styles.profileBtn, riskTolerance === r && styles.profileBtnActive]}
                onPress={() => setRiskTolerance(r)}>
                <Text style={[styles.profileLabel, riskTolerance === r && styles.profileLabelActive]}>
                  {r === 'conservative' ? '🛡️ Conservative' : r === 'moderate' ? '⚖️ Moderate' : '🚀 Aggressive'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.profileDetails, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Max risk per trade</Text>
              <Text style={styles.profileDetailValue}>{profile.maxRiskPerTradePct}% of portfolio</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Max position size</Text>
              <Text style={styles.profileDetailValue}>{profile.maxPositionSizePct}%</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Min risk/reward</Text>
              <Text style={styles.profileDetailValue}>{profile.minRewardRiskRatio}:1</Text>
            </View>
            <View style={styles.profileDetailRow}>
              <Text style={styles.profileDetailLabel}>Max positions</Text>
              <Text style={styles.profileDetailValue}>{profile.maxOpenPositions}</Text>
            </View>
          </View>
        </View>

        {/* ─── Analyze Button ─── */}
        <AnimatedPressable onPress={() => setShowResults(true)} haptic="medium" scaleTo={0.97}
          style={{ marginBottom: SPACING.xl }}>
          <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.analyzeBtn}>
            <Ionicons name="analytics" size={20} color="#fff" />
            <Text style={styles.analyzeBtnText}>Analyze Trade</Text>
          </LinearGradient>
        </AnimatedPressable>

        {/* ─── Results ─── */}
        {showResults && (
          <>
            {/* Risk Assessment */}
            {riskResult && (
              <View style={[styles.resultCard, { borderLeftColor: RISK_COLORS[riskResult.riskLevel], borderLeftWidth: 4 }]}>
                <View style={styles.resultHeader}>
                  <Ionicons name="shield-checkmark" size={20} color={RISK_COLORS[riskResult.riskLevel]} />
                  <Text style={styles.resultTitle}>Risk Assessment</Text>
                  <View style={[styles.riskBadge, { backgroundColor: RISK_BG[riskResult.riskLevel] }]}>
                    <Text style={[styles.riskBadgeText, { color: RISK_COLORS[riskResult.riskLevel] }]}>
                      {riskResult.riskScore}/100 · {riskResult.riskLevel.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.resultSummary}>{riskResult.summary}</Text>

                {/* Risk Factors */}
                {riskResult.factors.map((f, i) => (
                  <View key={i} style={[styles.factorRow, { borderBottomColor: colors.divider }]}>
                    <View style={styles.factorLeft}>
                      <Ionicons name={
                        f.impact === 'positive' ? 'checkmark-circle' :
                        f.impact === 'negative' ? 'alert-circle' : 'remove-circle'
                      } size={14} color={
                        f.impact === 'positive' ? colors.marketUp :
                        f.impact === 'negative' ? colors.marketDown : colors.textMuted
                      } />
                      <Text style={styles.factorName}>{f.name}</Text>
                    </View>
                    <View style={styles.factorScoreBar}>
                      <View style={[styles.factorScoreFill, {
                        width: `${Math.min(100, f.score)}%`,
                        backgroundColor: f.score <= 25 ? colors.marketUp :
                          f.score <= 50 ? '#FFAB40' :
                          f.score <= 75 ? colors.marketDown : '#D50000',
                      }]} />
                    </View>
                  </View>
                ))}

                {riskResult.suggestions.length > 0 && (
                  <View style={styles.suggestionsBox}>
                    {riskResult.suggestions.map((s, i) => (
                      <Text key={i} style={styles.suggestionText}>💡 {s}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Position Sizing */}
            {sizingResult && (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Ionicons name="calculator" size={20} color={colors.primary} />
                  <Text style={styles.resultTitle}>Position Sizing</Text>
                </View>

                <View style={styles.sizingGrid}>
                  <View style={[styles.sizingBox, { backgroundColor: colors.bgInput }]}>
                    <Text style={styles.sizingValue}>{sizingResult.suggestedQuantity}</Text>
                    <Text style={styles.sizingLabel}>Suggested Qty</Text>
                  </View>
                  <View style={[styles.sizingBox, { backgroundColor: colors.bgInput }]}>
                    <Text style={styles.sizingValue}>{formatCurrency(sizingResult.totalCost)}</Text>
                    <Text style={styles.sizingLabel}>Total Cost</Text>
                  </View>
                  <View style={[styles.sizingBox, { backgroundColor: colors.bgInput }]}>
                    <Text style={[styles.sizingValue, { color: sizingResult.withinRiskLimits ? colors.marketUp : colors.marketDown }]}>
                      {sizingResult.portfolioUsagePct.toFixed(1)}%
                    </Text>
                    <Text style={styles.sizingLabel}>Portfolio %</Text>
                  </View>
                  <View style={[styles.sizingBox, { backgroundColor: colors.bgInput }]}>
                    <Text style={[styles.sizingValue, { color: colors.warning }]}>
                      {formatCurrency(sizingResult.riskAmount)}
                    </Text>
                    <Text style={styles.sizingLabel}>At Risk</Text>
                  </View>
                </View>

                {/* Alternatives */}
                {sizingResult.alternatives.length > 0 && (
                  <View style={styles.alternativesRow}>
                    {sizingResult.alternatives.map((alt, i) => (
                      <TouchableOpacity key={i}
                        style={[styles.altChip, alt.label === 'Recommended' && styles.altChipActive,
                          { borderColor: colors.border }]}
                        onPress={() => handleUseSuggested(alt.quantity)}>
                        <Text style={[styles.altLabel, alt.label === 'Recommended' && styles.altLabelActive]}>
                          {alt.label}
                        </Text>
                        <Text style={[styles.altQty, alt.label === 'Recommended' && styles.altQtyActive]}>
                          {alt.quantity} shares
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {sizingResult.warnings.length > 0 && (
                  <View style={styles.warningsBox}>
                    {sizingResult.warnings.map((w, i) => (
                      <Text key={i} style={styles.warningText}>⚠️ {w}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Stop-Loss & Targets */}
            {tradePlan && (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Ionicons name="flag" size={20} color={colors.primary} />
                  <Text style={styles.resultTitle}>Trade Plan</Text>
                  <View style={[styles.rrBadge, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.rrBadgeText, { color: colors.primary }]}>
                      R:R {tradePlan.riskRewardScore / 10}:1
                    </Text>
                  </View>
                </View>

                {/* Stop-loss */}
                <View style={[styles.planSection, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
                  <View style={styles.planSectionHeader}>
                    <Ionicons name="shield" size={16} color={colors.marketDown} />
                    <Text style={styles.planSectionTitle}>Recommended Stop-Loss</Text>
                  </View>
                  <View style={styles.planValues}>
                    <View style={styles.planValue}>
                      <Text style={[styles.planValueNum, { color: colors.marketDown }]}>
                        {formatCurrency(tradePlan.stopLoss.stopLossPrice)}
                      </Text>
                      <Text style={styles.planValueLabel}>Price</Text>
                    </View>
                    <View style={styles.planValue}>
                      <Text style={[styles.planValueNum, { color: colors.marketDown }]}>
                        {tradePlan.stopLoss.stopLossPercent.toFixed(1)}%
                      </Text>
                      <Text style={styles.planValueLabel}>Below Entry</Text>
                    </View>
                    <View style={styles.planValue}>
                      <Text style={[styles.planValueNum, { color: colors.warning }]}>
                        {formatCurrency(tradePlan.stopLoss.riskAmount * qtyNum)}
                      </Text>
                      <Text style={styles.planValueLabel}>₹ at Risk</Text>
                    </View>
                  </View>
                  <Text style={styles.planRationale}>{tradePlan.stopLoss.rationale}</Text>
                </View>

                {/* Targets */}
                {tradePlan.targets.map((t, i) => (
                  <View key={i} style={[styles.planSection, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
                    <View style={styles.planSectionHeader}>
                      <Ionicons name="flag" size={16} color={colors.marketUp} />
                      <Text style={styles.planSectionTitle}>Target {i + 1} ({t.type})</Text>
                      <View style={[styles.probBadge, { backgroundColor: colors.marketUp + '20' }]}>
                        <Text style={[styles.probBadgeText, { color: colors.marketUp }]}>{t.probability}</Text>
                      </View>
                    </View>
                    <View style={styles.planValues}>
                      <View style={styles.planValue}>
                        <Text style={[styles.planValueNum, { color: colors.marketUp }]}>
                          {formatCurrency(t.targetPrice)}
                        </Text>
                        <Text style={styles.planValueLabel}>Target Price</Text>
                      </View>
                      <View style={styles.planValue}>
                        <Text style={[styles.planValueNum, { color: colors.marketUp }]}>
                          +{t.returnPercent.toFixed(1)}%
                        </Text>
                        <Text style={styles.planValueLabel}>Return</Text>
                      </View>
                      <View style={styles.planValue}>
                        <Text style={[styles.planValueNum, { color: colors.primary }]}>
                          {t.riskRewardRatio.toFixed(1)}:1
                        </Text>
                        <Text style={styles.planValueLabel}>R:R Ratio</Text>
                      </View>
                    </View>
                  </View>
                ))}

                <Text style={styles.recommendation}>📌 {tradePlan.recommendation}</Text>
              </View>
            )}

            {/* Portfolio Impact */}
            {impactResult && (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Ionicons name="pie-chart" size={20} color={colors.primary} />
                  <Text style={styles.resultTitle}>Portfolio Impact</Text>
                  <View style={[styles.divScoreBadge, {
                    backgroundColor: impactResult.diversificationScore >= 60 ? colors.marketUp + '20' :
                      impactResult.diversificationScore >= 40 ? '#FFAB4020' : colors.marketDown + '20',
                  }]}>
                    <Text style={[styles.divScoreText, {
                      color: impactResult.diversificationScore >= 60 ? colors.marketUp :
                        impactResult.diversificationScore >= 40 ? '#FFAB40' : colors.marketDown,
                    }]}>Score: {impactResult.diversificationScore}</Text>
                  </View>
                </View>

                <View style={styles.impactGrid}>
                  <View style={[styles.impactBox, { backgroundColor: colors.bgInput }]}>
                    <Text style={styles.impactLabel}>Position Weight</Text>
                    <Text style={[styles.impactValue, { color: impactResult.positionWeight > 20 ? colors.warning : colors.text }]}>
                      {impactResult.positionWeight.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={[styles.impactBox, { backgroundColor: colors.bgInput }]}>
                    <Text style={styles.impactLabel}>New Balance</Text>
                    <Text style={[styles.impactValue, {
                      color: impactResult.newBalance >= 0 ? colors.text : colors.marketDown,
                    }]}>{formatCurrency(impactResult.newBalance)}</Text>
                  </View>
                  <View style={[styles.impactBox, { backgroundColor: colors.bgInput }]}>
                    <Text style={styles.impactLabel}>Portfolio Value</Text>
                    <Text style={styles.impactValue}>{formatCurrency(impactResult.newPortfolioValue)}</Text>
                  </View>
                  <View style={[styles.impactBox, { backgroundColor: colors.bgInput }]}>
                    <Text style={styles.impactLabel}>Sectors</Text>
                    <Text style={styles.impactValue}>{impactResult.sectorExposure.length}</Text>
                  </View>
                </View>

                {/* Sector exposure bars */}
                {impactResult.sectorExposure.slice(0, 5).map(s => (
                  <View key={s.sector} style={styles.sectorRow}>
                    <Text style={styles.sectorName}>{s.sector}</Text>
                    <View style={[styles.sectorBar, { backgroundColor: colors.bgCard }]}>
                      <View style={[styles.sectorFill, {
                        width: `${Math.min(100, s.percent)}%`,
                        backgroundColor: s.percent > 35 ? colors.marketDown : colors.primary,
                      }]} />
                    </View>
                    <Text style={[styles.sectorPct, { color: s.percent > 35 ? colors.marketDown : colors.textMuted }]}>
                      {s.percent.toFixed(1)}%
                    </Text>
                  </View>
                ))}

                {impactResult.warnings.length > 0 && (
                  <View style={styles.warningsBox}>
                    {impactResult.warnings.map((w, i) => (
                      <Text key={i} style={styles.warningText}>⚠️ {w}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Place Order CTA */}
            <AnimatedPressable
              onPress={() => {
                Alert.alert(
                  'Place Order',
                  `Navigate to order placement for ${selectedSymbol}?\n${qtyNum} shares @ ${formatCurrency(priceNum)}`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Go to Order',
                      onPress: () => navigation.navigate('PlaceOrder', {
                        stockId: selectedStock?.id,
                        symbol: selectedSymbol,
                        tradeType,
                      }),
                    },
                  ],
                );
              }}
              haptic="medium"
              scaleTo={0.97}
              style={{ marginBottom: SPACING.xxxl }}
            >
              <LinearGradient
                colors={tradeType === 'buy' ? GRADIENTS.primary : GRADIENTS.secondary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.orderCta}
              >
                <Ionicons name="cart" size={20} color="#fff" />
                <Text style={styles.orderCtaText}>
                  Place {tradeType === 'buy' ? 'Buy' : 'Sell'} Order · {qtyNum} shares @ {formatCurrency(priceNum)}
                </Text>
              </LinearGradient>
            </AnimatedPressable>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg },

  // ── Header ──
  header: {
    paddingTop: 56, paddingHorizontal: SPACING.xl, paddingBottom: SPACING.lg,
    borderBottomLeftRadius: BORDER_RADIUS.xl, borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...FONTS.bold, fontSize: FONTS.size.lg, color: '#fff' },
  headerSub: { ...FONTS.regular, fontSize: FONTS.size.sm, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },

  // ── Sections ──
  section: { marginBottom: SPACING.xl },
  sectionLabel: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.md },

  // ── Stock Selector ──
  stockChip: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  stockChipActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  stockChipText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.textSecondary },
  stockChipTextActive: { color: colors.primary },
  stockInfo: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginTop: SPACING.md,
  },
  stockName: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text, flex: 1 },
  stockMeta: { ...FONTS.regular, fontSize: 10, color: colors.textMuted, marginTop: 2 },
  stockPrice: { ...FONTS.bold, fontSize: FONTS.size.lg },

  // ── Trade Params ──
  toggleRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  toggleBuy: { backgroundColor: '#00C85320', borderColor: colors.marketUp },
  toggleSell: { backgroundColor: '#FF174420', borderColor: colors.marketDown },
  toggleText: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  inputGrid: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  inputGroup: { flex: 1 },
  inputLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginBottom: 6 },
  input: {
    height: 48, borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    paddingHorizontal: SPACING.md, ...FONTS.medium, fontSize: FONTS.size.lg,
  },
  costPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  costLabel: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted },
  costValue: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.text },

  // ── Risk Profile ──
  profileRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  profileBtn: {
    flex: 1, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md,
    alignItems: 'center', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  profileBtnActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  profileLabel: { ...FONTS.medium, fontSize: 10, color: colors.textSecondary },
  profileLabelActive: { color: colors.primary },
  profileDetails: {
    borderRadius: BORDER_RADIUS.md, borderWidth: 1, padding: SPACING.md, gap: SPACING.sm,
  },
  profileDetailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  profileDetailLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted },
  profileDetailValue: { ...FONTS.semiBold, fontSize: FONTS.size.xs, color: colors.text },

  // ── Analyze Button ──
  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
  },
  analyzeBtnText: { ...FONTS.bold, fontSize: FONTS.size.lg, color: '#fff' },

  // ── Result Cards ──
  resultCard: {
    backgroundColor: colors.bgCard, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: colors.border,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  resultTitle: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.text, flex: 1 },
  resultSummary: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: SPACING.md },

  // ── Risk Badge ──
  riskBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  riskBadgeText: { ...FONTS.bold, fontSize: 9, letterSpacing: 0.5 },

  // ── Risk Factors ──
  factorRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  factorLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  factorName: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.text, flex: 1 },
  factorScoreBar: {
    width: 60, height: 6, borderRadius: 3, backgroundColor: colors.bgInput, overflow: 'hidden',
  },
  factorScoreFill: { height: '100%', borderRadius: 3 },

  // ── Suggestions ──
  suggestionsBox: { marginTop: SPACING.sm, gap: 4 },
  suggestionText: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textSecondary, lineHeight: 16 },

  // ── Sizing Grid ──
  sizingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  sizingBox: {
    width: (width - SPACING.xl * 2 - SPACING.lg * 2 - SPACING.sm) / 2,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center',
  },
  sizingValue: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.text },
  sizingLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },

  // ── Alternatives ──
  alternativesRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  altChip: {
    flex: 1, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md,
    alignItems: 'center', borderWidth: 1,
  },
  altChipActive: { backgroundColor: colors.primary + '15', borderColor: colors.primary },
  altLabel: { ...FONTS.medium, fontSize: 9, color: colors.textMuted, marginBottom: 2 },
  altLabelActive: { color: colors.primary },
  altQty: { ...FONTS.bold, fontSize: FONTS.size.sm, color: colors.text },
  altQtyActive: { color: colors.primary },

  // ── Warnings ──
  warningsBox: { gap: 4 },
  warningText: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.warning, lineHeight: 16 },

  // ── Trade Plan ──
  rrBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  rrBadgeText: { ...FONTS.bold, fontSize: 9 },
  planSection: {
    borderRadius: BORDER_RADIUS.md, borderWidth: 1, padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  planSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  planSectionTitle: { ...FONTS.semiBold, fontSize: FONTS.size.xs, color: colors.text, flex: 1 },
  probBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  probBadgeText: { ...FONTS.bold, fontSize: 9 },
  planValues: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm },
  planValue: { flex: 1, alignItems: 'center' },
  planValueNum: { ...FONTS.bold, fontSize: FONTS.size.md },
  planValueLabel: { ...FONTS.regular, fontSize: 9, color: colors.textMuted, marginTop: 2 },
  planRationale: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textSecondary, fontStyle: 'italic' },
  recommendation: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, lineHeight: 20, paddingTop: SPACING.sm },

  // ── Portfolio Impact ──
  divScoreBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  divScoreText: { ...FONTS.bold, fontSize: 9 },
  impactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  impactBox: {
    width: (width - SPACING.xl * 2 - SPACING.lg * 2 - SPACING.sm) / 2,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md, alignItems: 'center',
  },
  impactLabel: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted },
  impactValue: { ...FONTS.bold, fontSize: FONTS.size.md, color: colors.text, marginTop: 2 },
  sectorRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 6 },
  sectorName: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.text, width: 80 },
  sectorBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  sectorFill: { height: '100%', borderRadius: 3 },
  sectorPct: { ...FONTS.semiBold, fontSize: FONTS.size.xs, width: 45, textAlign: 'right' },

  // ── Order CTA ──
  orderCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
  },
  orderCtaText: { ...FONTS.bold, fontSize: FONTS.size.md, color: '#fff' },
});
