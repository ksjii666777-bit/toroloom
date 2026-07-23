// ============================================================================
// Toroloom — NFO (New Fund Offer) Dashboard Screen
// Active NFOs · Apply via UPI · My Investments · Scheme Details
// ============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../../constants/theme';
import { timeAgo } from '../../utils/formatters';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import type { NFOItem, NFOApplication } from '../../types';
import { useNFOStore } from '../../store/nfoStore';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import InvestNfoModal from '../../components/nfo/InvestNfoModal';

// ──── Constants ────────────────────────────────────────────────────────────

type DashboardTab = 'active' | 'myapps';

type NFOFilter = 'all' | 'open' | 'upcoming' | 'closed';

const FILTERS: { key: NFOFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'open', label: 'Open', icon: 'pricetag' },
  { key: 'upcoming', label: 'Upcoming', icon: 'calendar' },
  { key: 'closed', label: 'Closed', icon: 'lock-closed' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Open Now', color: '#00E676', bgColor: '#00E67620' },
  upcoming: { label: 'Upcoming', color: '#3B82F6', bgColor: '#3B82F620' },
  closed: { label: 'Closed', color: '#FFAB40', bgColor: '#FFAB4020' },
  matured: { label: 'Matured', color: '#64748B', bgColor: '#64748B20' },
};

const RISK_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low Risk', color: '#00E676' },
  moderate: { label: 'Moderate', color: '#3B82F6' },
  moderately_high: { label: 'Mod. High', color: '#FF9800' },
  high: { label: 'High Risk', color: '#FF5252' },
};

const APP_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  submitted: { label: 'Submitted', color: '#3B82F6', bgColor: '#3B82F620', icon: 'send-outline' },
  allotted: { label: 'Allotted ✅', color: '#00E676', bgColor: '#00E67620', icon: 'checkmark-circle' },
  in_progress: { label: 'In Progress', color: '#FFAB40', bgColor: '#FFAB4020', icon: 'hourglass-outline' },
  matured: { label: 'Matured', color: '#64748B', bgColor: '#64748B20', icon: 'flag-outline' },
};

// ──── Helpers ──────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCompact(num: number): string {
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num.toLocaleString('en-IN')}`;
}

function formatCr(num: number): string {
  return `₹${num.toLocaleString('en-IN')} Cr`;
}

// ──── Status Badge ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  return (
    <View style={[badgeStyles.badge, { backgroundColor: config.bgColor }]}>
      <View style={[badgeStyles.dot, { backgroundColor: config.color }]} />
      <Text style={[badgeStyles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, fontWeight: '700' },
});

// ──── Risk Badge ───────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const config = RISK_CONFIG[level] || RISK_CONFIG.moderate;
  return (
    <View style={[riskStyles.badge, { backgroundColor: config.color + '20', borderColor: config.color + '40' }]}>
      <View style={[riskStyles.dot, { backgroundColor: config.color }]} />
      <Text style={[riskStyles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const riskStyles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  label: { fontSize: 10, fontWeight: '600' },
});

// ──── App Status Badge ─────────────────────────────────────────────────────

function AppStatusBadge({ status }: { status: string }) {
  const config = APP_STATUS_CONFIG[status] || APP_STATUS_CONFIG.submitted;
  return (
    <View style={[appBadgeStyles.badge, { backgroundColor: config.bgColor, borderColor: config.color + '30' }]}>
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text style={[appBadgeStyles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const appBadgeStyles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  label: { fontSize: 10, fontWeight: '700' },
});

// ──── Allocation Bar ───────────────────────────────────────────────────────

function AllocationBar({ allocation }: { allocation: { label: string; percent: number; color: string }[] }) {
  return (
    <View style={allocStyles.row}>
      {allocation.map((item, i) => (
        <View key={i} style={[allocStyles.segment, { flex: item.percent, backgroundColor: item.color }]} />
      ))}
    </View>
  );
}

const allocStyles = StyleSheet.create({
  row: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  segment: { height: '100%' },
});

// ──── NFO Card ─────────────────────────────────────────────────────────────

function NFOCard({
  nfo, onPress, onInvest, colors,
}: {
  nfo: NFOItem; onPress: () => void; onInvest?: () => void; colors: any;
}) {
  const canInvest = nfo.subscriptionStatus === 'open';
  const collectedPercent = Math.min((nfo.collectedAmount / nfo.targetSize) * 100, 100);

  return (
    <AnimatedPressable onPress={onPress} haptic="light" scaleTo={0.98}>
      <View style={[cardStyles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {/* Top Row */}
        <View style={cardStyles.topRow}>
          <View style={[cardStyles.logo, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
            <Text style={[cardStyles.logoText, { color: colors.primary }]}>{nfo.logo}</Text>
          </View>
          <View style={cardStyles.companyInfo}>
            <Text style={[cardStyles.companyName, { color: colors.text }]} numberOfLines={1}>
              {nfo.schemeName}
            </Text>
            <Text style={[cardStyles.sector, { color: colors.textMuted }]}>{nfo.amcName} · {nfo.category}</Text>
          </View>
          <View style={cardStyles.topActions}>
            <StatusBadge status={nfo.subscriptionStatus} />
          </View>
        </View>

        {/* Category badge + Risk */}
        <View style={cardStyles.categoryRow}>
          <View style={[cardStyles.subCatBadge, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
            <Text style={[cardStyles.subCatText, { color: colors.textSecondary }]}>{nfo.subCategory}</Text>
          </View>
          <RiskBadge level={nfo.riskLevel} />
        </View>

        {/* Fund Manager */}
        <View style={cardStyles.managerRow}>
          <Ionicons name="person-outline" size={12} color={colors.textMuted} />
          <Text style={[cardStyles.managerText, { color: colors.textMuted }]}>
            Fund Manager: {nfo.fundManagers.join(', ')}
          </Text>
        </View>

        {/* Investment Grid */}
        <View style={[cardStyles.gridRow, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
          <View style={cardStyles.gridItem}>
            <Text style={[cardStyles.gridLabel, { color: colors.textMuted }]}>Min Invest</Text>
            <Text style={[cardStyles.gridValue, { color: colors.text }]}>{formatCompact(nfo.minInvestment)}</Text>
          </View>
          <View style={[cardStyles.gridDivider, { backgroundColor: colors.divider }]} />
          <View style={cardStyles.gridItem}>
            <Text style={[cardStyles.gridLabel, { color: colors.textMuted }]}>Expense</Text>
            <Text style={[cardStyles.gridValue, { color: colors.text }]}>{nfo.expenseRatio}%</Text>
          </View>
          <View style={[cardStyles.gridDivider, { backgroundColor: colors.divider }]} />
          <View style={cardStyles.gridItem}>
            <Text style={[cardStyles.gridLabel, { color: colors.textMuted }]}>Target</Text>
            <Text style={[cardStyles.gridValue, { color: colors.text }]}>{formatCr(nfo.targetSize)}</Text>
          </View>
        </View>

        {/* Allocation Bar + Collection progress */}
        <AllocationBar allocation={nfo.assetAllocation} />
        <View style={cardStyles.collectionRow}>
          <View style={{ flex: 1 }}>
            <View style={cardStyles.colLabelRow}>
              <Text style={[cardStyles.colLabel, { color: colors.textMuted }]}>
                Collected: {formatCr(nfo.collectedAmount)} of {formatCr(nfo.targetSize)} ({collectedPercent.toFixed(0)}%)
              </Text>
            </View>
            <View style={[cardStyles.colBar, { backgroundColor: colors.bgInput }]}>
              <LinearGradient
                colors={['#00E676', '#00C853']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[cardStyles.colFill, { width: `${collectedPercent}%` }]}
              />
            </View>
          </View>
          <Text style={[cardStyles.investorCount, { color: colors.textMuted }]}>
            {(nfo.totalInvestors / 1000).toFixed(1)}K investors
          </Text>
        </View>

        {/* Dates + Invest Button */}
        <View style={cardStyles.footerRow}>
          <View style={cardStyles.datesCol}>
            <View style={cardStyles.dateItem}>
              <Ionicons name="calendar-outline" size={10} color={colors.textMuted} />
              <Text style={[cardStyles.dateText, { color: colors.textMuted }]}>
                Open: {formatDate(nfo.openDate)}
              </Text>
            </View>
            <View style={cardStyles.dateItem}>
              <Ionicons name="flag-outline" size={10} color={colors.textMuted} />
              <Text style={[cardStyles.dateText, { color: colors.textMuted }]}>
                Close: {formatDate(nfo.closeDate)}
              </Text>
            </View>
          </View>
          {canInvest && onInvest && (
            <TouchableOpacity
              style={cardStyles.investBtn}
              onPress={onInvest}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={cardStyles.investGradient}
              >
                <Ionicons name="wallet-outline" size={14} color="#FFFFFF" />
                <Text style={cardStyles.investText}>Invest Now</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const cardStyles = StyleSheet.create({
  card: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
  topRow: { flexDirection: 'row', marginBottom: SPACING.sm },
  logo: { width: 44, height: 44, borderRadius: BORDER_RADIUS.md, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  logoText: { fontSize: 16, fontWeight: '800' },
  companyInfo: { flex: 1, justifyContent: 'center' },
  companyName: { fontSize: 14, fontWeight: '700' },
  sector: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  topActions: { alignItems: 'flex-end', gap: 6 },
  categoryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm, alignItems: 'center' },
  subCatBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  subCatText: { fontSize: 9, fontWeight: '600' },
  managerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.md },
  managerText: { fontSize: 10, fontWeight: '500' },
  gridRow: { flexDirection: 'row', borderRadius: BORDER_RADIUS.sm, borderWidth: 1, padding: SPACING.md, marginBottom: SPACING.md },
  gridItem: { flex: 1, alignItems: 'center' },
  gridLabel: { fontSize: 9, fontWeight: '500', marginBottom: 3 },
  gridValue: { fontSize: 12, fontWeight: '700' },
  gridDivider: { width: 1, marginVertical: 4 },
  collectionRow: { marginBottom: SPACING.md },
  colLabelRow: { marginBottom: 4 },
  colLabel: { fontSize: 10, fontWeight: '600' },
  colBar: { height: 5, borderRadius: 3, overflow: 'hidden' },
  colFill: { height: '100%', borderRadius: 3 },
  investorCount: { fontSize: 9, fontWeight: '500', marginTop: 3, textAlign: 'right' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  datesCol: { gap: 3 },
  dateItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 10, fontWeight: '500' },
  investBtn: { borderRadius: BORDER_RADIUS.md, overflow: 'hidden' },
  investGradient: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  investText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
});

// ──── Application Card ─────────────────────────────────────────────────────

function ApplicationCard({ app, colors }: { app: NFOApplication; colors: any }) {
  const config = APP_STATUS_CONFIG[app.status] || APP_STATUS_CONFIG.submitted;
  const isPositive = app.returnPercent ? app.returnPercent >= 0 : false;

  return (
    <View style={[appCardStyles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {/* Header */}
      <View style={appCardStyles.header}>
        <View style={[appCardStyles.logo, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
          <Text style={[appCardStyles.logoText, { color: colors.primary }]}>{app.logo}</Text>
        </View>
        <View style={appCardStyles.info}>
          <Text style={[appCardStyles.schemeName, { color: colors.text }]}>{app.schemeName}</Text>
          <Text style={[appCardStyles.amcName, { color: colors.textMuted }]}>{app.amcName} · {app.category}</Text>
        </View>
        <AppStatusBadge status={app.status} />
      </View>

      {/* Details */}
      <View style={[appCardStyles.details, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
        <View style={appCardStyles.detailItem}>
          <Text style={[appCardStyles.detailLabel, { color: colors.textMuted }]}>Invested</Text>
          <Text style={[appCardStyles.detailValue, { color: colors.text }]}>{formatCompact(app.amount)}</Text>
        </View>
        <View style={[appCardStyles.detailDivider, { backgroundColor: colors.divider }]} />
        <View style={appCardStyles.detailItem}>
          <Text style={[appCardStyles.detailLabel, { color: colors.textMuted }]}>NAV</Text>
          <Text style={[appCardStyles.detailValue, { color: colors.text }]}>₹{app.currentNav.toFixed(2)}</Text>
        </View>
        <View style={[appCardStyles.detailDivider, { backgroundColor: colors.divider }]} />
        <View style={appCardStyles.detailItem}>
          <Text style={[appCardStyles.detailLabel, { color: colors.textMuted }]}>Current</Text>
          <Text style={[appCardStyles.detailValue, { color: colors.text }]}>{formatCompact(app.currentValue)}</Text>
        </View>
      </View>

      {/* Return */}
      {app.returnPercent !== undefined && (
        <View style={[appCardStyles.returnRow, {
          backgroundColor: isPositive ? '#00E67610' : '#FF525210',
          borderColor: isPositive ? '#00E67620' : '#FF525220',
        }]}>
          <Ionicons name={isPositive ? 'trending-up' : 'trending-down'} size={14} color={isPositive ? colors.marketUp : colors.marketDown} />
          <Text style={[appCardStyles.returnValue, { color: isPositive ? colors.marketUp : colors.marketDown }]}>
            {isPositive ? '+' : ''}{app.returnPercent.toFixed(1)}% · {formatCompact(app.currentValue - app.amount)} return
          </Text>
        </View>
      )}

      {/* Applied date */}
      <View style={appCardStyles.footer}>
        <Text style={[appCardStyles.footerText, { color: colors.textMuted }]}>
          Applied: {formatDate(app.appliedAt)}
        </Text>
        {app.allotmentDate && (
          <Text style={[appCardStyles.footerText, { color: colors.textMuted }]}>
            Allotted: {formatDate(app.allotmentDate)}
          </Text>
        )}
      </View>
    </View>
  );
}

const appCardStyles = StyleSheet.create({
  card: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  logo: { width: 40, height: 40, borderRadius: BORDER_RADIUS.sm, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  logoText: { fontSize: 14, fontWeight: '800' },
  info: { flex: 1 },
  schemeName: { fontSize: 13, fontWeight: '700' },
  amcName: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  details: { flexDirection: 'row', borderRadius: BORDER_RADIUS.sm, borderWidth: 1, padding: SPACING.md, marginBottom: SPACING.sm },
  detailItem: { flex: 1, alignItems: 'center' },
  detailLabel: { fontSize: 9, fontWeight: '500', marginBottom: 2 },
  detailValue: { fontSize: 12, fontWeight: '700' },
  detailDivider: { width: 1, marginVertical: 4 },
  returnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: SPACING.md, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, marginBottom: SPACING.sm },
  returnValue: { fontSize: 11, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 9, fontWeight: '500' },
});

// ──── Main Screen ──────────────────────────────────────────────────────────

export default function NFODashboardScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<DashboardTab>('active');
  const [activeFilter, setActiveFilter] = useState<NFOFilter>('open');
  const [investModalNFO, setInvestModalNFO] = useState<NFOItem | null>(null);
  const [lastInvestedNFO, setLastInvestedNFO] = useState<string | null>(null);

  const nfos = useNFOStore((s) => s.nfos);
  const applications = useNFOStore((s) => s.applications);
  const fetchNFOs = useNFOStore((s) => s.fetchNFOs);

  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  useAutoRefresh(); // keeps "Updated X ago" text fresh

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const start = Date.now();
    await fetchNFOs();
    // Ensure minimum 500ms spinner duration for smooth UX
    const elapsed = Date.now() - start;
    if (elapsed < 500) {
      await new Promise((r) => setTimeout(r, 500 - elapsed));
    }
    setRefreshing(false);
    setLastRefreshedAt(new Date());
  }, [fetchNFOs]);

  // Filtered NFOs
  const filteredNFOs = useMemo(() => {
    if (activeFilter === 'all') return nfos;
    return nfos.filter((n) => n.subscriptionStatus === activeFilter);
  }, [nfos, activeFilter]);

  // Filter applications
  const [appFilter, setAppFilter] = useState<'all' | 'submitted' | 'allotted' | 'matured'>('all');
  const filteredApps = useMemo(() => {
    if (appFilter === 'all') return applications;
    return applications.filter((a) => a.status === appFilter);
  }, [applications, appFilter]);

  // Counts for stats
  const counts = useMemo(() => ({
    open: nfos.filter((n) => n.subscriptionStatus === 'open').length,
    upcoming: nfos.filter((n) => n.subscriptionStatus === 'upcoming').length,
    closed: nfos.filter((n) => n.subscriptionStatus === 'closed').length,
  }), [nfos]);

  // Application stats
  const appStats = useMemo(() => ({
    total: applications.length,
    submitted: applications.filter((a) => a.status === 'submitted').length,
    allotted: applications.filter((a) => a.status === 'allotted').length,
    totalInvestment: applications.reduce((s, a) => s + a.amount, 0),
    totalCurrent: applications.reduce((s, a) => s + a.currentValue, 0),
    totalReturn: applications.reduce((s, a) => s + (a.currentValue - a.amount), 0),
  }), [applications]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>NFO Dashboard</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {counts.open > 0
                ? `${counts.open} open · ${counts.upcoming} upcoming · ${counts.closed} closed`
                : `${appStats.total} investments tracked`}
            </Text>
            <View style={styles.refreshRow}>
              <Ionicons name="refresh" size={10} color={colors.textMuted} />
              <Text style={[styles.refreshText, { color: colors.textMuted }]}>
                Updated {timeAgo(lastRefreshedAt)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Tab Toggle */}
        <View style={[styles.tabRow, { backgroundColor: colors.bgInput }]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'active' && { backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('active')}
          >
            <Ionicons name="leaf" size={14} color={activeTab === 'active' ? '#FFFFFF' : colors.textMuted} />
            <Text style={[styles.tabText, { color: activeTab === 'active' ? '#FFFFFF' : colors.textMuted }]}>
              Active NFOs
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'myapps' && { backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('myapps')}
          >
            <Ionicons name="wallet" size={14} color={activeTab === 'myapps' ? '#FFFFFF' : colors.textMuted} />
            <Text style={[styles.tabText, { color: activeTab === 'myapps' ? '#FFFFFF' : colors.textMuted }]}>
              My Investments ({appStats.total})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Investment Success Banner */}
      {lastInvestedNFO && (
        <View style={[styles.successBanner, { backgroundColor: '#00E67615', borderColor: '#00E67630' }]}>
          <Ionicons name="checkmark-circle" size={16} color="#00E676" />
          <Text style={styles.successText}>
            Invested in {lastInvestedNFO} ✅
          </Text>
        </View>
      )}

      {activeTab === 'active' ? (
        <>
          {/* Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, {
                  backgroundColor: activeFilter === f.key ? colors.primary : colors.bgCardLight,
                  borderColor: activeFilter === f.key ? colors.primary : colors.border,
                }]}
                onPress={() => setActiveFilter(f.key)}
              >
                <Ionicons name={f.icon as any} size={13} color={activeFilter === f.key ? '#FFFFFF' : colors.textSecondary} />
                <Text style={[styles.filterText, { color: activeFilter === f.key ? '#FFFFFF' : colors.textSecondary }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* NFO List */}
          {filteredNFOs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>No NFOs found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Check back later for new fund offers
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                  progressBackgroundColor={colors.bgSecondary}
                />
              }
            >
              <Text style={[styles.countText, { color: colors.textMuted }]}>
                Showing {filteredNFOs.length} NFO{filteredNFOs.length !== 1 ? 's' : ''}
              </Text>
              {filteredNFOs.map((nfo) => (
                <NFOCard
                  key={nfo.id}
                  nfo={nfo}
                  colors={colors}
                  onPress={() => navigation.navigate('NFODetail', { nfoId: nfo.id })}
                  onInvest={nfo.subscriptionStatus === 'open' ? () => setInvestModalNFO(nfo) : undefined}
                />
              ))}
              <View style={{ height: 100 }} />
            </ScrollView>
          )}
        </>
      ) : (
        <>
          {/* Investment Stats */}
          {appStats.total > 0 && (
            <View style={[styles.statsRow, { paddingHorizontal: SPACING.xl }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
                <View style={[styles.statChip, { backgroundColor: '#3B82F620', borderColor: '#3B82F640' }]}>
                  <Text style={[styles.statChipValue, { color: '#3B82F6' }]}>{appStats.total}</Text>
                  <Text style={[styles.statChipLabel, { color: colors.textMuted }]}>Total</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: '#3B82F620', borderColor: '#3B82F640' }]}>
                  <Text style={[styles.statChipValue, { color: '#3B82F6' }]}>{appStats.submitted}</Text>
                  <Text style={[styles.statChipLabel, { color: colors.textMuted }]}>Active</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: '#00E67620', borderColor: '#00E67640' }]}>
                  <Text style={[styles.statChipValue, { color: '#00E676' }]}>{appStats.allotted}</Text>
                  <Text style={[styles.statChipLabel, { color: colors.textMuted }]}>Allotted</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: '#FFAB4020', borderColor: '#FFAB4040' }]}>
                  <Text style={[styles.statChipValue, { color: '#FFAB40' }]}>{formatCompact(appStats.totalInvestment)}</Text>
                  <Text style={[styles.statChipLabel, { color: colors.textMuted }]}>Invested</Text>
                </View>
                {appStats.totalReturn > 0 && (
                  <View style={[styles.statChip, { backgroundColor: '#00E67620', borderColor: '#00E67640' }]}>
                    <Text style={[styles.statChipValue, { color: '#00E676' }]}>
                      +{formatCompact(appStats.totalReturn)}
                    </Text>
                    <Text style={[styles.statChipLabel, { color: colors.textMuted }]}>Returns</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {/* Application Filter */}
          {appStats.total > 1 && (
            <View style={styles.appFilterRow}>
              {(['all', 'submitted', 'allotted', 'matured'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.appFilterChip, {
                    backgroundColor: appFilter === f ? colors.primary : colors.bgCardLight,
                    borderColor: appFilter === f ? colors.primary : colors.border,
                  }]}
                  onPress={() => setAppFilter(f)}
                >
                  <Text style={[styles.appFilterText, { color: appFilter === f ? '#FFFFFF' : colors.textMuted }]}>
                    {f === 'all' ? 'All' : f === 'submitted' ? 'Active' : f === 'allotted' ? '✅' : '📈'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Applications List */}
          {filteredApps.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>No Investments</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Invest in an open NFO to see it here
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                  progressBackgroundColor={colors.bgSecondary}
                />
              }
            >
              <Text style={[styles.countText, { color: colors.textMuted }]}>
                {filteredApps.length} investment{filteredApps.length !== 1 ? 's' : ''}
              </Text>
              {filteredApps.map((app) => (
                <ApplicationCard key={app.id} app={app} colors={colors} />
              ))}
              <View style={{ height: 100 }} />
            </ScrollView>
          )}
        </>
      )}

      {/* Invest Modal */}
      <InvestNfoModal
        nfo={investModalNFO}
        visible={!!investModalNFO}
        onClose={() => setInvestModalNFO(null)}
        onSuccess={() => {
          // ── Auto-switch to My Investments tab to show live stat updates ──
          setActiveTab('myapps');
          setAppFilter('all');
          if (investModalNFO) {
            setLastInvestedNFO(investModalNFO.schemeName);
            // Clear the success indicator after 3s
            setTimeout(() => setLastInvestedNFO(null), 3000);
          }
        }}
      />
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.sm },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  backBtn: { width: 40, height: 40, borderRadius: BORDER_RADIUS.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginTop: 4 },
  tabRow: { flexDirection: 'row', borderRadius: BORDER_RADIUS.md, padding: 4, marginBottom: SPACING.sm },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.sm },
  tabText: { fontSize: 13, fontWeight: '600' },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  refreshText: { fontSize: 10, fontWeight: '500' },
  filterRow: { paddingHorizontal: SPACING.xl, gap: SPACING.sm, paddingBottom: SPACING.md },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  filterText: { fontSize: 12, fontWeight: '600' },
  listContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  countText: { fontSize: 11, fontWeight: '500', marginBottom: SPACING.md },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 13, fontWeight: '400', textAlign: 'center', paddingHorizontal: 40 },
  // My Apps styles
  statsRow: { marginBottom: SPACING.md },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  statChipValue: { fontSize: 12, fontWeight: '700' },
  statChipLabel: { fontSize: 10, fontWeight: '500' },
  appFilterRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.md },
  appFilterChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  appFilterText: { fontSize: 11, fontWeight: '600' },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginBottom: SPACING.sm,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
  },
  successText: { fontSize: 13, fontWeight: '600', color: '#00E676', flex: 1 },
});
