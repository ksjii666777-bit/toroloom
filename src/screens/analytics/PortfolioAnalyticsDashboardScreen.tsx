// ============================================================================
// Toroloom — Portfolio Analytics Dashboard
// Widget-based layout · Risk Metrics · Sector Allocation · Rolling Returns
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants/theme';
import { usePortfolioAnalyticsStore } from '../../store/portfolioAnalyticsStore';
import { useWidgetStore } from '../../store/widgetStore';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import PnLChart from '../../components/PnLChart';
import { WidgetGrid } from '../../components/widgets';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ──── Main Screen ──────────────────────────────────────────────────────────

export default function PortfolioAnalyticsDashboardScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const analytics = usePortfolioAnalyticsStore(s => s.getAnalytics());
  const { metrics, pnlHistory } = analytics;
  const [chartTimeframe, setChartTimeframe] = useState('1Y');

  // Hydrate widget layout from AsyncStorage on mount
  useEffect(() => {
    useWidgetStore.getState().hydrate();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <LinearGradient
        colors={['#3B82F620', colors.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: SPACING.md }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Portfolio Analytics</Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>
              Customize with draggable widgets
            </Text>
          </View>
          {/* Gallery button */}
          <TouchableOpacity
            style={[styles.galleryBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}
            onPress={() => navigation.navigate('WidgetGallery')}
          >
            <Ionicons name="apps" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Performance Summary ── */}
        <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.summaryHeader}>
            <Ionicons name="trophy" size={16} color="#FFC107" />
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Performance Summary</Text>
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Return</Text>
              <Text style={[styles.summaryValue, { color: metrics.totalReturn >= 0 ? '#00E676' : '#FF5252' }]}>
                {formatCurrency(metrics.totalReturn, true)}
              </Text>
              <Text style={[styles.summaryPct, { color: metrics.totalReturnPercent >= 0 ? '#00E676' : '#FF5252' }]}>
                {formatPercent(metrics.totalReturnPercent)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Realized P&L</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {formatCurrency(metrics.realizedPnl, true)}
              </Text>
              <Text style={[styles.summaryPct, { color: colors.textMuted }]}>Realized</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Unrealized</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {formatCurrency(metrics.unrealizedPnl, true)}
              </Text>
              <Text style={[styles.summaryPct, { color: colors.textMuted }]}>Unrealized</Text>
            </View>
          </View>
        </View>

        {/* ── P&L Chart ── */}
        <View style={styles.chartWrapper}>
          <PnLChart
            data={pnlHistory}
            height={180}
            width={SCREEN_WIDTH - SPACING.xl * 2}
            timeframe={chartTimeframe}
            onTimeframeChange={setChartTimeframe}
          />
        </View>

        {/* ── Widgets Section ── */}
        <View style={styles.sectionHeader}>
          <Ionicons name="grid" size={16} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Dashboard Widgets</Text>
          <TouchableOpacity
            style={[styles.sectionAction, { backgroundColor: colors.primary + '15' }]}
            onPress={() => navigation.navigate('WidgetGallery')}
          >
            <Ionicons name="add" size={14} color={colors.primary} />
            <Text style={[styles.sectionActionText, { color: colors.primary }]}>Manage</Text>
          </TouchableOpacity>
        </View>

        <WidgetGrid onAddWidget={() => navigation.navigate('WidgetGallery')} />

        {/* ── Capital Gains Summary ── */}
        <View style={[styles.chartCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.extraHeader}>
            <Ionicons name="receipt" size={16} color={colors.primary} />
            <Text style={[styles.extraTitle, { color: colors.text }]}>Capital Gains & Tax</Text>
          </View>
          <View style={styles.cgGrid}>
            <View style={styles.cgItem}>
              <Text style={[styles.cgLabel, { color: colors.textMuted }]}>STCG</Text>
              <Text style={[styles.cgValue, { color: analytics.capitalGains.shortTerm.gains >= 0 ? '#00E676' : '#FF5252' }]}>
                {formatCurrency(analytics.capitalGains.shortTerm.gains)}
              </Text>
              <Text style={[styles.cgTax, { color: colors.textMuted }]}>
                Tax: {formatCurrency(analytics.capitalGains.shortTerm.estimatedTax)}
              </Text>
            </View>
            <View style={[styles.cgDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.cgItem}>
              <Text style={[styles.cgLabel, { color: colors.textMuted }]}>LTCG</Text>
              <Text style={[styles.cgValue, { color: analytics.capitalGains.longTerm.gains >= 0 ? '#00E676' : '#FF5252' }]}>
                {formatCurrency(analytics.capitalGains.longTerm.gains)}
              </Text>
              <Text style={[styles.cgTax, { color: colors.textMuted }]}>
                Tax: {formatCurrency(analytics.capitalGains.longTerm.estimatedTax)}
              </Text>
            </View>
            <View style={[styles.cgDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.cgItem}>
              <Text style={[styles.cgLabel, { color: colors.textMuted }]}>Total Tax</Text>
              <Text style={[styles.cgValue, { color: '#FF5252' }]}>
                {formatCurrency(analytics.capitalGains.totalEstimatedTax)}
              </Text>
              <Text style={[styles.cgTax, { color: colors.textMuted }]}>
                STT: {formatCurrency(analytics.capitalGains.sttPaid)}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const CARD_PADDING = SPACING.lg;

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Header
  header: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: BORDER_RADIUS.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  galleryBtn: { width: 40, height: 40, borderRadius: BORDER_RADIUS.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginLeft: SPACING.sm },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 12, fontWeight: '500', marginTop: 2, color: colors.textMuted },

  // Summary Card
  summaryCard: { marginHorizontal: SPACING.xl, marginBottom: SPACING.md, padding: CARD_PADDING, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  summaryTitle: { fontSize: 15, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  summaryPct: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 4 },

  // Chart
  chartWrapper: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },

  // Widgets Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  sectionTitle: { ...FONTS.bold, fontSize: FONTS.size.md, flex: 1 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs + 2, borderRadius: BORDER_RADIUS.full },
  sectionActionText: { ...FONTS.semiBold, fontSize: FONTS.size.xs },

  // Capital Gains
  chartCard: { marginHorizontal: SPACING.xl, marginBottom: SPACING.md, padding: CARD_PADDING, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
  extraHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  extraTitle: { fontSize: 15, fontWeight: '700' },
  cgGrid: { flexDirection: 'row' },
  cgItem: { flex: 1, alignItems: 'center' },
  cgLabel: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
  cgValue: { fontSize: 14, fontWeight: '700' },
  cgTax: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  cgDivider: { width: 1, marginVertical: 4 },
});
