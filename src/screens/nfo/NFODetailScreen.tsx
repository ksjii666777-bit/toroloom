// ============================================================================
// Toroloom — NFO (New Fund Offer) Detail Screen
// Scheme Overview · Objective · Strategy · Allocation · Timeline · Invest
// ============================================================================

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../../constants/theme';
import { timeAgo } from '../../utils/formatters';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import type { NFOItem } from '../../types';
import { useNFOStore } from '../../store/nfoStore';
import InvestNfoModal from '../../components/nfo/InvestNfoModal';

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

// ──── Status & Risk Config ─────────────────────────────────────────────────

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

// ──── Sub-Components ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bgColor, borderColor: config.color + '40' }]}>
      <View style={[styles.statusDot, { backgroundColor: config.color }]} />
      <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function RiskBadge({ level }: { level: string }) {
  const config = RISK_CONFIG[level] || RISK_CONFIG.moderate;
  return (
    <View style={[styles.riskBadge, { backgroundColor: config.color + '20', borderColor: config.color + '40' }]}>
      <View style={[styles.riskDot, { backgroundColor: config.color }]} />
      <Text style={[styles.riskLabel, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function StatCard({ label, value, icon, color }: {
  label: string; value: string; icon?: string; color?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {icon && <Ionicons name={icon as any} size={14} color={color || colors.primary} style={{ marginBottom: 4 }} />}
      <Text style={[styles.statValue, { color: color || colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, icon, color }: { title: string; icon?: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      {icon && <Ionicons name={icon as any} size={16} color={color || colors.primary} />}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

function BulletList({ items, color }: { items: string[]; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={[styles.bullet, { backgroundColor: color }]} />
          <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function AllocationSegment({ allocation }: { allocation: { label: string; percent: number; color: string }[] }) {
  const { colors } = useTheme();
  return (
    <View>
      {/* Visual bar */}
      <View style={[styles.allocBar, { backgroundColor: colors.bgInput }]}>
        {allocation.map((item, i) => (
          <View key={i} style={[styles.allocSegment, { flex: item.percent, backgroundColor: item.color }]} />
        ))}
      </View>
      {/* Legend */}
      <View style={styles.allocLegend}>
        {allocation.map((item, i) => (
          <View key={i} style={styles.allocLegendItem}>
            <View style={[styles.allocDot, { backgroundColor: item.color }]} />
            <Text style={[styles.allocLabel, { color: colors.textMuted }]}>{item.label}</Text>
            <Text style={[styles.allocPercent, { color: colors.text }]}>{item.percent}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TimelineItem({ label, date, isActive, isLast, color }: {
  label: string; date: string; isActive?: boolean; isLast?: boolean; color: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLine}>
        <View style={[styles.timelineDot, { backgroundColor: isActive ? color : colors.textMuted }]} />
        {!isLast && <View style={[styles.timelineConnector, { backgroundColor: colors.border }]} />}
      </View>
      <View style={[styles.timelineContent, {
        backgroundColor: isActive ? color + '10' : 'transparent',
        borderColor: isActive ? color + '30' : 'transparent',
        borderWidth: isActive ? 1 : 0,
        borderRadius: BORDER_RADIUS.sm,
        padding: isActive ? SPACING.sm : 0,
      }]}>
        <Text style={[styles.timelineLabel, { color: colors.text, fontWeight: isActive ? '700' : '500' }]}>{label}</Text>
        <Text style={[styles.timelineDate, { color: isActive ? color : colors.textMuted }]}>{formatDate(date)}</Text>
      </View>
    </View>
  );
}

function SectorChip({ label, color }: { label: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectorChip, { backgroundColor: color + '15', borderColor: color + '30' }]}>
      <Text style={[styles.sectorChipText, { color: color || colors.text }]}>{label}</Text>
    </View>
  );
}

// ──── Performance Projection Card ──────────────────────────────────────────

function PerformanceProjection({ nfo }: { nfo: NFOItem }) {
  const { colors } = useTheme();

  const projections = useMemo(() => {
    // Base projections: conservative (8%), moderate (12%), aggressive (16%)
    return [
      { label: 'Conservative', return: 8, color: '#3B82F6', finalValue: Math.round(100000 * Math.pow(1.08, 3) / 1000) * 1000 },
      { label: 'Moderate', return: 12, color: '#00E676', finalValue: Math.round(100000 * Math.pow(1.12, 3) / 1000) * 1000 },
      { label: 'Aggressive', return: 16, color: '#8B5CF6', finalValue: Math.round(100000 * Math.pow(1.16, 3) / 1000) * 1000 },
    ];
  }, []);

  const maxValue = projections[projections.length - 1].finalValue;

  return (
    <View style={[styles.projectionCard, { backgroundColor: colors.bgCard }]}>
      <Text style={[styles.projectionTitle, { color: colors.textMuted }]}>Projected Value of ₹1L after 3 Years</Text>
      {projections.map((p, i) => (
        <View key={i} style={styles.projectionRow}>
          <View style={[styles.projectionLabelRow]}>
            <Text style={[styles.projectionLabel, { color: p.color }]}>{p.label}</Text>
            <Text style={[styles.projectionReturn, { color: p.color }]}>{p.return}% p.a.</Text>
          </View>
          <View style={styles.projectionBarRow}>
            <View style={[styles.projectionBar, { backgroundColor: colors.bgInput }]}>
              <View style={[styles.projectionFill, {
                width: `${(p.finalValue / maxValue) * 100}%`,
                backgroundColor: p.color,
              }]} />
            </View>
            <Text style={[styles.projectionValue, { color: colors.text }]}>
              ₹{(p.finalValue / 100000).toFixed(1)}L
            </Text>
          </View>
        </View>
      ))}
      <View style={[styles.projectionNote, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
        <Ionicons name="information-circle" size={12} color={colors.primary} />
        <Text style={[styles.projectionNoteText, { color: colors.textMuted }]}>
          Past performance and projections are not indicative of future returns. Actual returns may vary.
        </Text>
      </View>
    </View>
  );
}

// ──── Main Screen ──────────────────────────────────────────────────────────

export default function NFODetailScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { nfoId } = route.params || {};
  const [showInvest, setShowInvest] = useState(false);
  const [screenLoadedAt] = useState<Date>(new Date());

  useAutoRefresh(); // keeps "Updated X ago" text fresh

  const nfos = useNFOStore((s) => s.nfos);
  const nfo = useMemo(() => nfos.find((n: NFOItem) => n.id === nfoId) ?? null, [nfos, nfoId]);

  const canInvest = nfo && nfo.subscriptionStatus === 'open';
  const collectedPercent = nfo ? Math.min((nfo.collectedAmount / nfo.targetSize) * 100, 100) : 0;

  // Risk color based on level
  const riskColor = nfo ? (RISK_CONFIG[nfo.riskLevel]?.color || '#3B82F6') : '#3B82F6';

  if (!nfo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
        <Text style={[styles.notFoundText, { color: colors.textMuted }]}>NFO not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.notFoundLink, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ── Hero Header ── */}
        <LinearGradient
          colors={[nfo.subscriptionStatus === 'open' ? '#3B82F620' : '#64748B30', colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 12 }]}
        >
          {/* Back button */}
          <View style={styles.heroTop}>
            <TouchableOpacity
              style={[styles.heroBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              <StatusBadge status={nfo.subscriptionStatus} />
              <RiskBadge level={nfo.riskLevel} />
            </View>
          </View>

          {/* Scheme Info */}
          <View style={styles.heroInfo}>
            <View style={[styles.heroLogo, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Text style={[styles.heroLogoText, { color: colors.primary }]}>{nfo.logo}</Text>
            </View>
            <View style={styles.heroDetails}>
              <Text style={[styles.heroName, { color: colors.text }]}>{nfo.schemeName}</Text>
              <Text style={[styles.heroAmc, { color: colors.textMuted }]}>{nfo.amcName}</Text>
              <View style={styles.heroMetaRow}>
                <Text style={[styles.heroMeta, { color: colors.textSecondary }]}>{nfo.category}</Text>
                <View style={[styles.heroMetaDot, { backgroundColor: colors.textMuted }]} />
                <Text style={[styles.heroMeta, { color: colors.textSecondary }]}>{nfo.subCategory}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          <StatCard label="Min Invest" value={formatCompact(nfo.minInvestment)} icon="wallet" />
          <StatCard label="Expense" value={`${nfo.expenseRatio}%`} icon="pricetag" />
          <StatCard label="Target" value={formatCr(nfo.targetSize)} icon="flag" />
        </View>

        {/* ── Investment Objective ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Investment Objective" icon="bulb" color="#FFC107" />
          <Text style={[styles.objectiveText, { color: colors.textSecondary }]}>{nfo.objective}</Text>
        </View>

        {/* ── Investment Strategy ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Investment Strategy" icon="git-branch" color="#8B5CF6" />
          <Text style={[styles.strategyText, { color: colors.textSecondary }]}>{nfo.strategy}</Text>
        </View>

        {/* ── Asset Allocation ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Asset Allocation" icon="pie-chart" />
          <AllocationSegment allocation={nfo.assetAllocation} />
        </View>

        {/* ── Performance Projections ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Performance Projections" icon="trending-up" color="#00E676" />
          <PerformanceProjection nfo={nfo} />
        </View>

        {/* ── Key Details ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Key Details" icon="information-circle" />
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Fund Manager</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{nfo.fundManagers.join(', ')}</Text>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Benchmark</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{nfo.benchmark}</Text>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Entry Load</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{nfo.entryLoad}%</Text>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Exit Load</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{nfo.exitLoad}</Text>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Min Investment</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{formatCompact(nfo.minInvestment)}</Text>
            </View>
          </View>
        </View>

        {/* ── AMC Info ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="AMC Details" icon="business" />
          <View style={styles.amcGrid}>
            <View style={styles.amcItem}>
              <Text style={[styles.amcLabel, { color: colors.textMuted }]}>Rating</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map(s => (
                  <Ionicons key={s} name={s <= nfo.amcRating ? 'star' : 'star-outline'} size={14} color={s <= nfo.amcRating ? '#FFC107' : colors.textMuted} />
                ))}
              </View>
            </View>
            <View style={styles.amcItem}>
              <Text style={[styles.amcLabel, { color: colors.textMuted }]}>AUM</Text>
              <Text style={[styles.amcValue, { color: colors.text }]}>{nfo.amcAum}</Text>
            </View>
            <View style={styles.amcItem}>
              <Text style={[styles.amcLabel, { color: colors.textMuted }]}>Funds</Text>
              <Text style={[styles.amcValue, { color: colors.text }]}>{nfo.amcFundsCount} schemes</Text>
            </View>
          </View>
        </View>

        {/* ── Collection Progress ── */}
        {nfo.collectedAmount > 0 && (
          <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <SectionHeader title="Collection Progress" icon="pulse" color="#00E676" />
            <View style={styles.collectionHeader}>
              <Text style={[styles.collectionAmount, { color: '#00E676' }]}>{formatCr(nfo.collectedAmount)}</Text>
              <Text style={[styles.collectionTarget, { color: colors.textMuted }]}>
                of {formatCr(nfo.targetSize)} ({collectedPercent.toFixed(0)}%)
              </Text>
            </View>
            <View style={[styles.collectionBar, { backgroundColor: colors.bgInput }]}>
              <LinearGradient
                colors={['#00E676', '#00C853']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.collectionFill, { width: `${collectedPercent}%` }]}
              />
            </View>
            <View style={styles.collectionMeta}>
              <Text style={[styles.collectionMetaText, { color: colors.textMuted }]}>
                {(nfo.totalInvestors / 1000).toFixed(1)}K investors · {nfo.applications.toLocaleString('en-IN')} applications
              </Text>
              <View style={styles.collectionUpdatedRow}>
                <Ionicons name="refresh" size={10} color={colors.textMuted} />
                <Text style={[styles.collectionUpdated, { color: colors.textMuted }]}>
                  Updated {timeAgo(screenLoadedAt)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Key Dates Timeline ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Key Dates" icon="calendar" />
          <View style={styles.timeline}>
            <TimelineItem
              label="Open Date"
              date={nfo.openDate}
              isActive={nfo.subscriptionStatus === 'open' || nfo.subscriptionStatus === 'closed'}
              color="#3B82F6"
            />
            <TimelineItem
              label="Close Date"
              date={nfo.closeDate}
              isActive={nfo.subscriptionStatus === 'closed' || nfo.subscriptionStatus === 'matured'}
              color="#00E676"
            />
            <TimelineItem
              label="Allotment"
              date={nfo.maturityDate}
              isActive={nfo.subscriptionStatus === 'matured'}
              color="#8B5CF6"
            />
            <TimelineItem
              label="Maturity / Listing"
              date={nfo.maturityDate}
              isActive={nfo.subscriptionStatus === 'matured'}
              isLast
              color="#FFC107"
            />
          </View>
        </View>

        {/* ── Top Sectors ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Top Sectors" icon="layers" color="#8B5CF6" />
          <View style={styles.sectorRow}>
            {nfo.topSectors.map((s, i) => (
              <SectorChip key={i} label={s} color={[colors.primary, '#00E676', '#8B5CF6', '#FF9800', '#FF5252'][i % 5]} />
            ))}
          </View>
        </View>

        {/* ── About ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="About the Scheme" icon="information-circle" />
          <Text style={[styles.aboutText, { color: colors.textSecondary }]}>{nfo.about}</Text>
        </View>

        {/* ── Strengths ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Strengths" icon="shield-checkmark" color="#00E676" />
          <BulletList items={nfo.strengths} color="#00E676" />
        </View>

        {/* ── Risks ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Risks" icon="warning" color="#FF5252" />
          <BulletList items={nfo.risks} color="#FF5252" />
        </View>

      </ScrollView>

      {/* ── Bottom Action Bar ── */}
      <View style={[styles.bottomBar, { backgroundColor: colors.bgSecondary, borderTopColor: colors.border }]}>
        <View style={styles.bottomLeft}>
          <Text style={[styles.bottomTarget, { color: colors.textMuted }]}>Target: {formatCr(nfo.targetSize)}</Text>
          {nfo.collectedAmount > 0 && (
            <Text style={[styles.bottomCollected, { color: '#00E676' }]}>
              Collected: {collectedPercent.toFixed(0)}%
            </Text>
          )}
        </View>
        {canInvest ? (
          <TouchableOpacity
            style={styles.bottomInvestBtn}
            onPress={() => setShowInvest(true)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#3B82F6', '#1D4ED8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bottomInvestGradient}
            >
              <Ionicons name="wallet-outline" size={16} color="#FFFFFF" />
              <Text style={styles.bottomInvestText}>Invest Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : nfo.subscriptionStatus === 'upcoming' ? (
          <View style={[styles.bottomStatus, { backgroundColor: '#3B82F620' }]}>
            <Ionicons name="time-outline" size={16} color="#3B82F6" />
            <Text style={[styles.bottomStatusText, { color: '#3B82F6' }]}>Upcoming</Text>
          </View>
        ) : (
          <View style={[styles.bottomStatus, { backgroundColor: '#64748B20' }]}>
            <Ionicons name="lock-closed" size={16} color="#64748B" />
            <Text style={[styles.bottomStatusText, { color: '#64748B' }]}>Closed</Text>
          </View>
        )}
      </View>

      {/* Invest Modal */}
      <InvestNfoModal
        nfo={showInvest ? nfo : null}
        visible={showInvest}
        onClose={() => setShowInvest(false)}
      />
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Hero
  hero: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxl },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl },
  heroBtn: { width: 40, height: 40, borderRadius: BORDER_RADIUS.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  heroInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  heroLogo: { width: 56, height: 56, borderRadius: BORDER_RADIUS.lg, justifyContent: 'center', alignItems: 'center' },
  heroLogoText: { fontSize: 22, fontWeight: '800' },
  heroDetails: { flex: 1, gap: 4 },
  heroName: { fontSize: 20, fontWeight: '800' },
  heroAmc: { fontSize: 12, fontWeight: '500' },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  heroMeta: { fontSize: 11, fontWeight: '500' },
  heroMetaDot: { width: 3, height: 3, borderRadius: 1.5 },

  // Status badge
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: '700' },

  // Risk badge
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  riskDot: { width: 5, height: 5, borderRadius: 2.5 },
  riskLabel: { fontSize: 10, fontWeight: '600' },

  // Stats
  statsRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg, marginTop: -SPACING.lg },
  statCard: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  statLabel: { fontSize: 9, fontWeight: '500', textAlign: 'center' },

  // Sections
  section: { marginHorizontal: SPACING.xl, marginBottom: SPACING.md, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  sectionTitle: { fontSize: 15, fontWeight: '700' },

  // Objective / Strategy
  objectiveText: { fontSize: 12, fontWeight: '400', lineHeight: 20 },
  strategyText: { fontSize: 12, fontWeight: '400', lineHeight: 20 },

  // Asset Allocation
  allocBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: SPACING.md },
  allocSegment: { height: '100%' },
  allocLegend: { gap: 6 },
  allocLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  allocDot: { width: 8, height: 8, borderRadius: 4 },
  allocLabel: { flex: 1, fontSize: 12, fontWeight: '500' },
  allocPercent: { fontSize: 12, fontWeight: '600' },

  // Performance Projection
  projectionCard: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md },
  projectionTitle: { fontSize: 11, fontWeight: '600', marginBottom: SPACING.md, textAlign: 'center' },
  projectionRow: { marginBottom: SPACING.md },
  projectionLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  projectionLabel: { fontSize: 11, fontWeight: '600' },
  projectionReturn: { fontSize: 11, fontWeight: '700' },
  projectionBarRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  projectionBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  projectionFill: { height: '100%', borderRadius: 3 },
  projectionValue: { fontSize: 12, fontWeight: '700', minWidth: 50, textAlign: 'right' },
  projectionNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: SPACING.sm, borderRadius: BORDER_RADIUS.sm, borderWidth: 1, marginTop: SPACING.sm },
  projectionNoteText: { flex: 1, fontSize: 10, fontWeight: '500', lineHeight: 14 },

  // Key Details
  detailGrid: { gap: SPACING.sm },
  detailItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.xs },
  detailLabel: { fontSize: 11, fontWeight: '500' },
  detailValue: { fontSize: 12, fontWeight: '600', textAlign: 'right', maxWidth: '60%' },
  detailDivider: { height: 1 },

  // AMC
  amcGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  amcItem: { alignItems: 'center', flex: 1 },
  amcLabel: { fontSize: 10, fontWeight: '500', marginBottom: 4 },
  amcValue: { fontSize: 12, fontWeight: '700' },
  stars: { flexDirection: 'row', gap: 2 },

  // Collection Progress
  collectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: SPACING.md },
  collectionAmount: { fontSize: 28, fontWeight: '800' },
  collectionTarget: { fontSize: 12, fontWeight: '500' },
  collectionBar: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: SPACING.sm },
  collectionFill: { height: '100%', borderRadius: 4 },
  collectionMeta: { alignItems: 'center' },
  collectionMetaText: { fontSize: 10, fontWeight: '500' },
  collectionUpdatedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  collectionUpdated: { fontSize: 9, fontWeight: '400' },

  // Timeline
  timeline: { paddingLeft: 4 },
  timelineItem: { flexDirection: 'row', marginBottom: SPACING.sm, minHeight: 48 },
  timelineLine: { alignItems: 'center', width: 20, marginRight: SPACING.md },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineConnector: { width: 2, flex: 1, marginTop: 2 },
  timelineContent: { flex: 1, justifyContent: 'center' },
  timelineLabel: { fontSize: 13 },
  timelineDate: { fontSize: 11, marginTop: 1 },

  // Sectors
  sectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  sectorChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  sectorChipText: { fontSize: 11, fontWeight: '600' },

  // About
  aboutText: { fontSize: 12, fontWeight: '400', lineHeight: 20 },

  // Bullet List
  bulletList: { gap: SPACING.sm },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  bulletText: { flex: 1, fontSize: 12, fontWeight: '400', lineHeight: 18 },

  // Bottom Bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderTopWidth: 1, paddingBottom: 40,
  },
  bottomLeft: { flexDirection: 'column', gap: 2 },
  bottomTarget: { fontSize: 11, fontWeight: '500' },
  bottomCollected: { fontSize: 13, fontWeight: '800' },
  bottomInvestBtn: { borderRadius: BORDER_RADIUS.md, overflow: 'hidden' },
  bottomInvestGradient: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md },
  bottomInvestText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  bottomStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md },
  bottomStatusText: { fontSize: 13, fontWeight: '600' },

  // Not found
  notFoundText: { fontSize: 16, fontWeight: '600', marginTop: SPACING.md },
  notFoundLink: { fontSize: 14, fontWeight: '600', marginTop: SPACING.sm },
});
