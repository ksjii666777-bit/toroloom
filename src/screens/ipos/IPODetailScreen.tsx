// ============================================================================
// Toroloom — IPO Detail Screen
// Company Overview · Financials · Subscription · GMP · Timeline · Apply
// ============================================================================

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants/theme';
import { useIPOStore } from '../../store/ipoStore';
import type { IPOItem } from '../../types';

// ──── Helpers ──────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysBetween(from: string, to?: string): number {
  const d1 = new Date(from).getTime();
  const d2 = to ? new Date(to).getTime() : Date.now();
  return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
}

// ──── Status Badge ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Open Now', color: '#00E676', bgColor: '#00E67620' },
  upcoming: { label: 'Upcoming', color: '#3B82F6', bgColor: '#3B82F620' },
  closed: { label: 'Closed', color: '#FFAB40', bgColor: '#FFAB4020' },
  listing_today: { label: 'Listing Today', color: '#8B5CF6', bgColor: '#8B5CF620' },
  listed: { label: 'Listed', color: '#64748B', bgColor: '#64748B20' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bgColor, borderColor: config.color + '40' }]}>
      <View style={[styles.statusDot, { backgroundColor: config.color }]} />
      <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

// ──── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: {
  label: string; value: string; color?: string; icon?: string;
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

// ──── Section Header ────────────────────────────────────────────────────────

function SectionHeader({ title, icon, color }: { title: string; icon?: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      {icon && <Ionicons name={icon as any} size={16} color={color || colors.primary} />}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

// ──── Subscription Bar ──────────────────────────────────────────────────────

function SubscriptionBar({ label, value, maxValue, color }: {
  label: string; value: number; maxValue: number; color: string;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <View style={styles.subBarRow}>
      <View style={styles.subBarLabel}>
        <Text style={styles.subBarText}>{label}</Text>
        <Text style={[styles.subBarValue, { color }]}>{value.toFixed(1)}x</Text>
      </View>
      <View style={[styles.subBarTrack, { backgroundColor: color + '20' }]}>
        <View style={[styles.subBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ──── Financial Metric ──────────────────────────────────────────────────────

function FinMetric({ label, value, positive, negative }: {
  label: string; value: string; positive?: boolean; negative?: boolean;
}) {
  const { colors } = useTheme();
  const valColor = positive ? '#00E676' : negative ? '#FF5252' : colors.text;
  return (
    <View style={styles.finMetric}>
      <Text style={[styles.finLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.finValue, { color: valColor }]}>{value}</Text>
    </View>
  );
}

// ──── Timeline Item ─────────────────────────────────────────────────────────

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
      <View style={[styles.timelineContent, { backgroundColor: isActive ? color + '10' : 'transparent', borderColor: isActive ? color + '30' : 'transparent', borderWidth: isActive ? 1 : 0, borderRadius: BORDER_RADIUS.sm, padding: isActive ? SPACING.sm : 0 }]}>
        <Text style={[styles.timelineLabel, { color: colors.text, fontWeight: isActive ? '700' : '500' }]}>{label}</Text>
        <Text style={[styles.timelineDate, { color: isActive ? color : colors.textMuted }]}>{formatDate(date)}</Text>
      </View>
    </View>
  );
}

// ──── Bullet List ───────────────────────────────────────────────────────────

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

// ──── Main Screen ──────────────────────────────────────────────────────────

export default function IPODetailScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { ipoId } = route.params || {};
  const { ipos, toggleBookmark, applyForIPO } = useIPOStore();
  const [showApply, setShowApply] = useState(false);
  const [bidLots, setBidLots] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const ipo = useMemo(() => ipos.find((i: IPOItem) => i.id === ipoId), [ipos, ipoId]);
  const canApply = ipo && (ipo.subscriptionStatus === 'open' || ipo.subscriptionStatus === 'listing_today');
  const gmpPositive = ipo ? ipo.gmp > 0 : false;
  const isProfitable = ipo ? ipo.netProfit > 0 : false;

  // Generate mock GMP trend (last 7 days) — deterministic based on ipo.gmp
  const { gmpTrend, maxGmp } = useMemo(() => {
    if (!ipo) return { gmpTrend: [] as { day: string; value: number }[], maxGmp: 1 };
    const days = 7;
    const base = ipo.gmp * 0.7;
    const trend = Array.from({ length: days }, (_, i) => {
      // Deterministic jitter using sin of gmp value
      const jitter = Math.sin(ipo.gmp * (i + 1) * 1.5) * ipo.gmp * 0.08;
      return {
        day: `D${i + 1}`,
        value: base + (ipo.gmp - base) * ((i + 1) / days) + jitter,
      };
    });
    return { gmpTrend: trend, maxGmp: Math.max(...trend.map(g => g.value), 1) };
  }, [ipo]);

  if (!ipo) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
        <Text style={[styles.notFoundText, { color: colors.textMuted }]}>IPO not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.notFoundLink, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleApply = () => {
    if (!ipo) return;
    if (bidLots < 1) {
      Alert.alert('Invalid Lots', 'Minimum 1 lot required');
      return;
    }
    setSubmitting(true);
    try {
      applyForIPO(ipo, bidLots, ipo.priceBand.min, 'rahul@upi');
      Alert.alert(
        'Application Submitted ✅',
        `${ipo.companyName}\n${bidLots} lot(s) • ${bidLots * ipo.lotSize} shares\n₹${(bidLots * ipo.lotSize * ipo.priceBand.min).toLocaleString('en-IN')}`,
      );
      setShowApply(false);
    } catch {
      Alert.alert('Error', 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ── Hero Header ── */}
        <LinearGradient
          colors={[ipo.subscriptionStatus === 'listed' ? '#64748B30' : '#3B82F620', colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 12 }]}
        >
          {/* Back + Bookmark */}
          <View style={styles.heroTop}>
            <TouchableOpacity
              style={[styles.heroBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => toggleBookmark(ipo.id)}
            >
              <Ionicons
                name={ipo.isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={ipo.isBookmarked ? colors.warning : colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Company Info */}
          <View style={styles.heroInfo}>
            <View style={[styles.heroLogo, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Text style={[styles.heroLogoText, { color: colors.primary }]}>{ipo.logo}</Text>
            </View>
            <View style={styles.heroDetails}>
              <Text style={[styles.heroName, { color: colors.text }]}>{ipo.companyName}</Text>
              <Text style={[styles.heroSector, { color: colors.textMuted }]}>{ipo.sector}</Text>
              <StatusBadge status={ipo.subscriptionStatus} />
            </View>
          </View>
        </LinearGradient>

        {/* ── Price & Stats Row ── */}
        <View style={styles.statsRow}>
          <StatCard label="Price Band" value={`₹${ipo.priceBand.min} – ₹${ipo.priceBand.max}`} icon="pricetag" />
          <StatCard label="Lot Size" value={`${ipo.lotSize} shares`} icon="cube" />
          <StatCard label="Min Invest" value={`₹${ipo.minInvestment.toLocaleString('en-IN')}`} icon="wallet" />
        </View>

        {/* ── Issue Details ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Issue Details" icon="stats-chart" />
          <View style={styles.issueGrid}>
            <View style={styles.issueItem}>
              <Text style={[styles.issueLabel, { color: colors.textMuted }]}>Issue Size</Text>
              <Text style={[styles.issueValue, { color: colors.text }]}>₹{ipo.issueSize.toLocaleString('en-IN')} Cr</Text>
            </View>
            <View style={styles.issueItem}>
              <Text style={[styles.issueLabel, { color: colors.textMuted }]}>Fresh Issue</Text>
              <Text style={[styles.issueValue, { color: colors.text }]}>₹{ipo.freshIssue.toLocaleString('en-IN')} Cr</Text>
            </View>
            <View style={styles.issueItem}>
              <Text style={[styles.issueLabel, { color: colors.textMuted }]}>OFS</Text>
              <Text style={[styles.issueValue, { color: colors.text }]}>₹{ipo.offerForSale.toLocaleString('en-IN')} Cr</Text>
            </View>
            <View style={styles.issueItem}>
              <Text style={[styles.issueLabel, { color: colors.textMuted }]}>Total Shares</Text>
              <Text style={[styles.issueValue, { color: colors.text }]}>{(ipo.totalShares / 10000000).toFixed(2)} Cr</Text>
            </View>
          </View>
        </View>

        {/* ── Subscription Breakdown ── */}
        {ipo.subscriptionTotal > 0 && (
          <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <SectionHeader title="Subscription" icon="trending-up" color="#00E676" />
            <Text style={[styles.subTotalText, { color: '#00E676' }]}>
              Overall: {ipo.subscriptionTotal.toFixed(2)}x
            </Text>
            <View style={styles.subBars}>
              <SubscriptionBar label="QIB" value={ipo.subscriptionQIB} maxValue={ipo.subscriptionTotal} color="#3B82F6" />
              <SubscriptionBar label="HNI" value={ipo.subscriptionHNI} maxValue={ipo.subscriptionTotal} color="#8B5CF6" />
              <SubscriptionBar label="Retail" value={ipo.subscriptionRetail} maxValue={ipo.subscriptionTotal} color="#00E676" />
            </View>
            <View style={[styles.subMeta, { borderTopColor: colors.border }]}>
              <Text style={[styles.subMetaText, { color: colors.textMuted }]}>
                {ipo.applications.toLocaleString('en-IN')} applications · {(ipo.sharesApplied / 10000000).toFixed(2)} Cr shares applied
              </Text>
            </View>
          </View>
        )}

        {/* ── GMP & Expected Listing ── */}
        {ipo.gmp > 0 && (
          <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <SectionHeader title="Grey Market Premium (GMP)" icon="pulse" color="#FFC107" />
            <View style={styles.gmpHeader}>
              <View>
                <Text style={[styles.gmpValue, { color: gmpPositive ? '#00E676' : '#FF5252' }]}>
                  {gmpPositive ? '+' : ''}₹{ipo.gmp}
                </Text>
                <Text style={[styles.gmpPct, { color: gmpPositive ? '#00E676' : '#FF5252' }]}>
                  {gmpPositive ? '+' : ''}{ipo.gmpPercent.toFixed(1)}%
                </Text>
              </View>
              <View style={styles.gmpListing}>
                <Text style={[styles.gmpListingLabel, { color: colors.textMuted }]}>Expected Listing</Text>
                <Text style={[styles.gmpListingValue, { color: colors.text }]}>₹{ipo.expectedListingPrice}</Text>
                <Text style={[styles.gmpListingGain, { color: ipo.expectedListingGain >= 0 ? '#00E676' : '#FF5252' }]}>
                  {ipo.expectedListingGain >= 0 ? '+' : ''}{ipo.expectedListingGain.toFixed(1)}%
                </Text>
              </View>
            </View>

            {/* GMP Trend Mini Chart */}
            <View style={styles.gmpChart}>
              <View style={styles.gmpChartBars}>
                {gmpTrend.map((g, i) => (
                  <View key={i} style={styles.gmpBarCol}>
                    <View
                      style={[
                        styles.gmpBar,
                        {
                          height: Math.max(4, Math.round((g.value / maxGmp) * 56)),
                          backgroundColor: g.value >= gmpTrend[Math.max(0, i - 1)]?.value ? '#00E676' : '#FF5252',
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.gmpChartLabels}>
                {gmpTrend.map((g, i) => (
                  <Text key={i} style={[styles.gmpChartLabel, { color: colors.textMuted }]}>{g.day}</Text>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── Financials ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Financials" icon="analytics" />
          <View style={styles.finGrid}>
            <FinMetric label="Revenue (Cr)" value={`₹${ipo.revenue.toLocaleString('en-IN')}`} positive={ipo.revenue > 0} />
            <FinMetric label="Net Profit (Cr)" value={`₹${Math.abs(ipo.netProfit).toLocaleString('en-IN')}`} positive={isProfitable} negative={!isProfitable} />
            <FinMetric label="P/E Ratio" value={ipo.peRatio > 0 ? ipo.peRatio.toFixed(1) : 'N/A'} />
            <FinMetric label="ROE" value={`${ipo.roe.toFixed(1)}%`} positive={ipo.roe > 10} negative={ipo.roe < 0} />
          </View>
        </View>

        {/* ── Key Dates Timeline ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Key Dates" icon="calendar" />
          <View style={styles.timeline}>
            <TimelineItem
              label="Open Date"
              date={ipo.openDate}
              isActive={ipo.subscriptionStatus === 'open' || ipo.subscriptionStatus === 'closed' || ipo.subscriptionStatus === 'listing_today' || ipo.subscriptionStatus === 'listed'}
              color="#3B82F6"
            />
            <TimelineItem
              label="Close Date"
              date={ipo.closeDate}
              isActive={ipo.subscriptionStatus === 'closed' || ipo.subscriptionStatus === 'listing_today' || ipo.subscriptionStatus === 'listed'}
              color="#00E676"
            />
            <TimelineItem
              label="Allotment"
              date={ipo.allotmentDate || 'TBD'}
              isActive={ipo.subscriptionStatus === 'listed'}
              color="#8B5CF6"
            />
            <TimelineItem
              label="Listing Date"
              date={ipo.listingDate}
              isActive={ipo.subscriptionStatus === 'listing_today' || ipo.subscriptionStatus === 'listed'}
              isLast
              color="#FFC107"
            />
          </View>
        </View>

        {/* ── About ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="About" icon="information-circle" />
          <Text style={[styles.aboutText, { color: colors.textSecondary }]}>{ipo.about}</Text>
        </View>

        {/* ── Strengths ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Strengths" icon="shield-checkmark" color="#00E676" />
          <BulletList items={ipo.strengths} color="#00E676" />
        </View>

        {/* ── Risks ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Risks" icon="warning" color="#FF5252" />
          <BulletList items={ipo.risks} color="#FF5252" />
        </View>

        {/* ── Lead Managers & Registrar ── */}
        <View style={[styles.section, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <SectionHeader title="Lead Managers & Registrar" icon="people" />
          <View style={styles.managerList}>
            {ipo.leadManagers.map((m, i) => (
              <View key={i} style={[styles.managerChip, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
                <Ionicons name="business" size={12} color={colors.primary} />
                <Text style={[styles.managerName, { color: colors.text }]}>{m}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.registrarRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.registrarLabel, { color: colors.textMuted }]}>Registrar</Text>
            <Text style={[styles.registrarValue, { color: colors.text }]}>{ipo.registrar}</Text>
          </View>
          <View style={styles.ratingRow}>
            <Text style={[styles.ratingLabel, { color: colors.textMuted }]}>Rating</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map(s => (
                <Ionicons
                  key={s}
                  name={s <= ipo.rating ? 'star' : 'star-outline'}
                  size={14}
                  color={s <= ipo.rating ? '#FFC107' : colors.textMuted}
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ── */}
      <View style={[styles.bottomBar, { backgroundColor: colors.bgSecondary, borderTopColor: colors.border }]}>
        <View style={styles.bottomLeft}>
          <Text style={[styles.bottomGMP, { color: gmpPositive ? '#00E676' : colors.textMuted }]}>
            GMP: {gmpPositive ? '+' : ''}₹{ipo.gmp}
          </Text>
          <Text style={[styles.bottomGMPPct, { color: gmpPositive ? '#00E676' : colors.textMuted }]}>
            ({gmpPositive ? '+' : ''}{ipo.gmpPercent.toFixed(1)}%)
          </Text>
        </View>
        {canApply ? (
          <TouchableOpacity
            style={styles.bottomApplyBtn}
            onPress={() => setShowApply(true)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#00E676', '#00C853']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bottomApplyGradient}
            >
              <Ionicons name="phone-portrait-outline" size={16} color="#0A0D14" />
              <Text style={styles.bottomApplyText}>Apply via UPI</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : ipo.subscriptionStatus === 'upcoming' ? (
          <View style={[styles.bottomStatus, { backgroundColor: '#3B82F620' }]}>
            <Ionicons name="time-outline" size={16} color="#3B82F6" />
            <Text style={[styles.bottomStatusText, { color: '#3B82F6' }]}>
              Opens in {daysBetween(new Date().toISOString().split('T')[0], ipo.openDate)}d
            </Text>
          </View>
        ) : (
          <View style={[styles.bottomStatus, { backgroundColor: '#64748B20' }]}>
            <Ionicons name="lock-closed" size={16} color="#64748B" />
            <Text style={[styles.bottomStatusText, { color: '#64748B' }]}>Closed</Text>
          </View>
        )}
      </View>

      {/* ── Apply Modal (compact inline) ── */}
      {showApply && (
        <View style={styles.applyOverlay}>
          <View style={[styles.applySheet, { backgroundColor: colors.bgSecondary }]}>
            <View style={styles.applyHeader}>
              <Text style={[styles.applyTitle, { color: colors.text }]}>Apply for IPO</Text>
              <TouchableOpacity onPress={() => setShowApply(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.applyCompanyName, { color: colors.textSecondary }]}>{ipo.companyName}</Text>
            <Text style={[styles.applyRange, { color: colors.textMuted }]}>
              ₹{ipo.priceBand.min} – ₹{ipo.priceBand.max} · Lot: {ipo.lotSize} shares
            </Text>

            {/* Lot Selector */}
            <Text style={[styles.applyLabel, { color: colors.textSecondary }]}>Number of Lots</Text>
            <View style={styles.applyLotsRow}>
              {[1, 2, 3, 5, 10].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[styles.applyLotBtn, {
                    backgroundColor: bidLots === n ? colors.primary : colors.bgCard,
                    borderColor: bidLots === n ? colors.primary : colors.border,
                  }]}
                  onPress={() => setBidLots(n)}
                >
                  <Text style={[styles.applyLotText, { color: bidLots === n ? '#FFF' : colors.text }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Summary */}
            <View style={[styles.applySummary, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.applySummaryRow}>
                <Text style={[styles.applySummaryLabel, { color: colors.textMuted }]}>Shares</Text>
                <Text style={[styles.applySummaryValue, { color: colors.text }]}>
                  {(bidLots * ipo.lotSize).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={[styles.applySummaryDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.applySummaryRow}>
                <Text style={[styles.applySummaryLabel, { color: colors.textMuted }]}>Amount</Text>
                <Text style={[styles.applySummaryValue, { color: colors.primary, fontSize: 18 }]}>
                  ₹{(bidLots * ipo.lotSize * ipo.priceBand.min).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.applySubmitBtn}
              onPress={handleApply}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#00E676', '#00C853']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.applySubmitGradient}
              >
                <Ionicons name="checkmark-circle" size={20} color="#0A0D14" />
                <Text style={styles.applySubmitText}>
                  {submitting ? 'Submitting...' : 'Confirm Application'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Hero
  hero: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxl },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xl },
  heroBtn: { width: 40, height: 40, borderRadius: BORDER_RADIUS.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  heroInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  heroLogo: { width: 56, height: 56, borderRadius: BORDER_RADIUS.lg, justifyContent: 'center', alignItems: 'center' },
  heroLogoText: { fontSize: 22, fontWeight: '800' },
  heroDetails: { flex: 1, gap: 4 },
  heroName: { fontSize: 22, fontWeight: '800' },
  heroSector: { fontSize: 12, fontWeight: '500' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, borderWidth: 1, alignSelf: 'flex-start' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: '700' },

  // Stats Row
  statsRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg, marginTop: -SPACING.lg },
  statCard: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  statLabel: { fontSize: 9, fontWeight: '500', textAlign: 'center' },

  // Section
  section: { marginHorizontal: SPACING.xl, marginBottom: SPACING.md, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  sectionTitle: { fontSize: 15, fontWeight: '700' },

  // Issue Grid
  issueGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  issueItem: { width: '50%', marginBottom: SPACING.md },
  issueLabel: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
  issueValue: { fontSize: 14, fontWeight: '700' },

  // Subscription
  subTotalText: { fontSize: 24, fontWeight: '800', marginBottom: SPACING.md },
  subBars: { gap: SPACING.sm },
  subBarRow: { marginBottom: SPACING.xs },
  subBarLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  subBarText: { fontSize: 12, fontWeight: '600' },
  subBarValue: { fontSize: 12, fontWeight: '700' },
  subBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  subBarFill: { height: '100%', borderRadius: 3 },
  subMeta: { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1 },
  subMetaText: { fontSize: 10, fontWeight: '500', textAlign: 'center' },

  // GMP
  gmpHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.lg },
  gmpValue: { fontSize: 32, fontWeight: '800' },
  gmpPct: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  gmpListing: { alignItems: 'flex-end' },
  gmpListingLabel: { fontSize: 10, fontWeight: '500' },
  gmpListingValue: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  gmpListingGain: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  gmpChart: { marginTop: SPACING.sm },
  gmpChartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 4 },
  gmpBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  gmpBar: { width: '100%', borderRadius: 2, minHeight: 4 },
  gmpChartLabels: { flexDirection: 'row', marginTop: 4 },
  gmpChartLabel: { flex: 1, textAlign: 'center', fontSize: 8, fontWeight: '500' },

  // Financials
  finGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  finMetric: { width: '50%', marginBottom: SPACING.md },
  finLabel: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
  finValue: { fontSize: 16, fontWeight: '700' },

  // Timeline
  timeline: { paddingLeft: 4 },
  timelineItem: { flexDirection: 'row', marginBottom: SPACING.sm, minHeight: 48 },
  timelineLine: { alignItems: 'center', width: 20, marginRight: SPACING.md },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineConnector: { width: 2, flex: 1, marginTop: 2 },
  timelineContent: { flex: 1, justifyContent: 'center' },
  timelineLabel: { fontSize: 13 },
  timelineDate: { fontSize: 11, marginTop: 1 },

  // About
  aboutText: { fontSize: 12, fontWeight: '400', lineHeight: 20 },

  // Bullet List
  bulletList: { gap: SPACING.sm },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  bulletText: { flex: 1, fontSize: 12, fontWeight: '400', lineHeight: 18 },

  // Managers
  managerList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  managerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  managerName: { fontSize: 11, fontWeight: '500' },
  registrarRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: SPACING.md, borderTopWidth: 1, marginBottom: SPACING.sm },
  registrarLabel: { fontSize: 11, fontWeight: '500' },
  registrarValue: { fontSize: 12, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ratingLabel: { fontSize: 11, fontWeight: '500' },
  stars: { flexDirection: 'row', gap: 2 },

  // Bottom Bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderTopWidth: 1, paddingBottom: 40 },
  bottomLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  bottomGMP: { fontSize: 16, fontWeight: '800' },
  bottomGMPPct: { fontSize: 12, fontWeight: '600' },
  bottomApplyBtn: { borderRadius: BORDER_RADIUS.md, overflow: 'hidden' },
  bottomApplyGradient: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md },
  bottomApplyText: { fontSize: 13, fontWeight: '700', color: '#0A0D14' },
  bottomStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md },
  bottomStatusText: { fontSize: 13, fontWeight: '600' },

  // Apply Modal
  applyOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  applySheet: { borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, padding: SPACING.xl, paddingBottom: 60 },
  applyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  applyTitle: { fontSize: 20, fontWeight: '800' },
  applyCompanyName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  applyRange: { fontSize: 11, fontWeight: '500', marginBottom: SPACING.lg },
  applyLabel: { fontSize: 13, fontWeight: '600', marginBottom: SPACING.sm },
  applyLotsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  applyLotBtn: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
  applyLotText: { fontSize: 15, fontWeight: '700' },
  applySummary: { borderRadius: BORDER_RADIUS.md, borderWidth: 1, padding: SPACING.lg, marginBottom: SPACING.lg },
  applySummaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  applySummaryLabel: { fontSize: 13, fontWeight: '500' },
  applySummaryValue: { fontSize: 15, fontWeight: '700' },
  applySummaryDivider: { height: 1, marginVertical: 4 },
  applySubmitBtn: { borderRadius: BORDER_RADIUS.lg, overflow: 'hidden' },
  applySubmitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg },
  applySubmitText: { fontSize: 16, fontWeight: '700', color: '#0A0D14' },

  // Not found
  notFoundText: { fontSize: 16, fontWeight: '600', marginTop: SPACING.md },
  notFoundLink: { fontSize: 14, fontWeight: '600', marginTop: SPACING.sm },
});
