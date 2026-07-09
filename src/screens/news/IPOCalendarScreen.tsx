// ============================================================================
// Toroloom — IPO Calendar Screen
// Shows upcoming, open, and recently listed IPOs with subscription data, GMP,
// price bands, and detailed information for each issue.
// ============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../../constants/theme';
import { mockIPOs } from '../../constants/mockData';
import type { IPOItem } from '../../types';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

type IPOFilter = 'all' | 'open' | 'upcoming' | 'closed' | 'listed';

const FILTERS: { key: IPOFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'open', label: 'Open', icon: 'pricetag' },
  { key: 'upcoming', label: 'Upcoming', icon: 'calendar' },
  { key: 'closed', label: 'Closed', icon: 'lock-closed' },
  { key: 'listed', label: 'Listed', icon: 'checkmark-circle' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Open Now', color: '#00E676', bgColor: '#00E67620' },
  upcoming: { label: 'Upcoming', color: '#3B82F6', bgColor: '#3B82F620' },
  closed: { label: 'Closed', color: '#FFAB40', bgColor: '#FFAB4020' },
  listing_today: { label: 'Listing Today', color: '#8B5CF6', bgColor: '#8B5CF620' },
  listed: { label: 'Listed', color: '#64748B', bgColor: '#64748B20' },
};

// ─── Helper: Format number in Cr/L ────────────────────────
function formatCr(cr: number): string {
  if (cr >= 100000) return `${(cr / 100000).toFixed(1)}L Cr`;
  if (cr >= 1000) return `${(cr / 1000).toFixed(1)}K Cr`;
  return `${cr.toFixed(0)} Cr`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Status Badge ─────────────────────────────────────────
function IPOStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  return (
    <View style={[statusBadgeStyles.badge, { backgroundColor: config.bgColor }]}>
      <View style={[statusBadgeStyles.dot, { backgroundColor: config.color }]} />
      <Text style={[statusBadgeStyles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const statusBadgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, fontWeight: '700' },
});

// ─── IPO Card ─────────────────────────────────────────────
function IPOCard({ ipo, onPress, onBookmark, colors }: {
  ipo: IPOItem; onPress: () => void; onBookmark: () => void; colors: any;
}) {
  const isHighSubscription = ipo.subscriptionTotal > 5;
  const gmpPositive = ipo.gmp > 0;

  return (
    <AnimatedPressable onPress={onPress} haptic="light" scaleTo={0.98}>
      <View style={[ipoCardStyles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {/* Top Row */}
        <View style={ipoCardStyles.topRow}>
          <View style={[ipoCardStyles.logo, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[ipoCardStyles.logoText, { color: colors.primary }]}>{ipo.logo}</Text>
          </View>
          <View style={ipoCardStyles.companyInfo}>
            <Text style={[ipoCardStyles.companyName, { color: colors.text }]} numberOfLines={1}>{ipo.companyName}</Text>
            <Text style={[ipoCardStyles.sector, { color: colors.textMuted }]}>{ipo.sector}</Text>
          </View>
          <View style={ipoCardStyles.topActions}>
            <IPOStatusBadge status={ipo.subscriptionStatus} />
            <TouchableOpacity onPress={onBookmark} hitSlop={8}>
              <Ionicons
                name={ipo.isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={ipo.isBookmarked ? colors.warning : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Price & GMP Row */}
        <View style={ipoCardStyles.priceRow}>
          <View style={ipoCardStyles.priceItem}>
            <Text style={[ipoCardStyles.priceLabel, { color: colors.textMuted }]}>Price Band</Text>
            <Text style={[ipoCardStyles.priceValue, { color: colors.text }]}>
              ₹{ipo.priceBand.min} – ₹{ipo.priceBand.max}
            </Text>
          </View>
          <View style={ipoCardStyles.priceItem}>
            <Text style={[ipoCardStyles.priceLabel, { color: colors.textMuted }]}>Lot Size</Text>
            <Text style={[ipoCardStyles.priceValue, { color: colors.text }]}>{ipo.lotSize} shares</Text>
          </View>
          <View style={ipoCardStyles.priceItem}>
            <Text style={[ipoCardStyles.priceLabel, { color: colors.textMuted }]}>Min Invest</Text>
            <Text style={[ipoCardStyles.priceValue, { color: colors.text }]}>
              ₹{formatCr(ipo.minInvestment / 10000000)}
            </Text>
          </View>
        </View>

        {/* GMP */}
        <View style={[ipoCardStyles.gmpRow, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
          <View style={ipoCardStyles.gmpLeft}>
            <Text style={[ipoCardStyles.gmpLabel, { color: colors.textMuted }]}>GMP (Grey Market)</Text>
            <Text style={[ipoCardStyles.gmpValue, { color: gmpPositive ? colors.marketUp : colors.marketDown }]}>
              {gmpPositive ? '+' : ''}₹{ipo.gmp} ({gmpPositive ? '+' : ''}{ipo.gmpPercent.toFixed(1)}%)
            </Text>
          </View>
          <View style={ipoCardStyles.gmpRight}>
            <Text style={[ipoCardStyles.gmpLabel, { color: colors.textMuted }]}>Expected Listing</Text>
            <Text style={[ipoCardStyles.gmpValue, { color: colors.text }]}>
              ₹{ipo.expectedListingPrice} ({gmpPositive ? '+' : ''}{ipo.expectedListingGain.toFixed(1)}%)
            </Text>
          </View>
        </View>

        {/* Subscription Bar */}
        {ipo.subscriptionTotal > 0 && (
          <View style={ipoCardStyles.subRow}>
            <Text style={[ipoCardStyles.subLabel, { color: colors.textMuted }]}>
              Subscription: {ipo.subscriptionTotal.toFixed(1)}x
            </Text>
            <View style={[ipoCardStyles.subBar, { backgroundColor: colors.bgInput }]}>
              <View style={[ipoCardStyles.subFill, {
                width: `${Math.min(ipo.subscriptionTotal * 8, 100)}%`,
                backgroundColor: isHighSubscription ? colors.marketUp : colors.warning,
              }]} />
            </View>
          </View>
        )}

        {/* Key Dates */}
        <View style={ipoCardStyles.datesRow}>
          <View style={ipoCardStyles.dateItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={[ipoCardStyles.dateLabel, { color: colors.textMuted }]}>Open: {formatDate(ipo.openDate)}</Text>
          </View>
          <View style={ipoCardStyles.dateItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={[ipoCardStyles.dateLabel, { color: colors.textMuted }]}>Close: {formatDate(ipo.closeDate)}</Text>
          </View>
        </View>
        <View style={ipoCardStyles.dateItem}>
          <Ionicons name="flag-outline" size={12} color={colors.textMuted} />
          <Text style={[ipoCardStyles.dateLabel, { color: colors.textMuted }]}>
            Listing: {formatDate(ipo.listingDate)}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const ipoCardStyles = StyleSheet.create({
  card: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
    marginBottom: SPACING.md,
  },
  topRow: { flexDirection: 'row', marginBottom: SPACING.md },
  logo: {
    width: 48, height: 48, borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  logoText: { fontSize: 18, fontWeight: '800' },
  companyInfo: { flex: 1, justifyContent: 'center' },
  companyName: { fontSize: 16, fontWeight: '700' },
  sector: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  topActions: { alignItems: 'flex-end', gap: 6 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  priceItem: { alignItems: 'center', flex: 1 },
  priceLabel: { fontSize: 10, fontWeight: '500', marginBottom: 4 },
  priceValue: { fontSize: 13, fontWeight: '700' },
  gmpRow: {
    flexDirection: 'row', borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  gmpLeft: { flex: 1 },
  gmpRight: { flex: 1, alignItems: 'flex-end' },
  gmpLabel: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
  gmpValue: { fontSize: 14, fontWeight: '700' },
  subRow: { marginBottom: SPACING.sm },
  subLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  subBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  subFill: { height: '100%', borderRadius: 3 },
  datesRow: { marginBottom: 4 },
  dateItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  dateLabel: { fontSize: 11, fontWeight: '500' },
});

// ─── IPO Detail Modal ─────────────────────────────────────
function IPODetailModal({ ipo, visible, onClose, onBookmark, colors }: {
  ipo: IPOItem | null; visible: boolean; onClose: () => void; onBookmark: () => void; colors: any;
}) {
  const insets = useSafeAreaInsets();
  if (!ipo) return null;

  const handleShare = async () => {
    try {
      await Share.share({
        title: `${ipo.companyName} IPO`,
        message: `${ipo.companyName} IPO is ${ipo.subscriptionStatus}!\nPrice: ₹${ipo.priceBand.min}-₹${ipo.priceBand.max}\nLot: ${ipo.lotSize} shares\nGMP: ₹${ipo.gmp}\n\nvia Toroloom`,
      });      } catch {
        // Share cancelled or failed silently
      }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[detailStyles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <LinearGradient colors={['rgba(59,130,246,0.08)', 'transparent']}
          style={[detailStyles.header, { paddingTop: insets.top + 12 }]}>
          <View style={detailStyles.headerRow}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={detailStyles.headerActions}>
              <TouchableOpacity onPress={onBookmark}>
                <Ionicons name={ipo.isBookmarked ? 'bookmark' : 'bookmark-outline'} size={22}
                  color={ipo.isBookmarked ? colors.warning : colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare}>
                <Ionicons name="share-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={detailStyles.content}>
          {/* Company Header */}
          <View style={detailStyles.companyHeader}>
            <View style={[detailStyles.companyLogo, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[detailStyles.companyLogoText, { color: colors.primary }]}>{ipo.logo}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[detailStyles.companyName, { color: colors.text }]}>{ipo.companyName}</Text>
              <Text style={[detailStyles.sector, { color: colors.textSecondary }]}>{ipo.sector}</Text>
            </View>
            <IPOStatusBadge status={ipo.subscriptionStatus} />
          </View>

          {/* Rating */}
          <View style={detailStyles.ratingRow}>
            {[1,2,3,4,5].map(i => (
              <Ionicons key={i} name={i <= ipo.rating ? 'star' : 'star-outline'} size={16}
                color={i <= ipo.rating ? '#FFAB40' : colors.textMuted} />
            ))}
            <Text style={[detailStyles.ratingText, { color: colors.textMuted }]}>
              {ipo.rating}/5
            </Text>
          </View>

          {/* Key Stats Grid */}
          <View style={[detailStyles.statsGrid, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
            {[
              { label: 'Issue Size', value: `₹${formatCr(ipo.issueSize)}` },
              { label: 'Fresh Issue', value: `₹${formatCr(ipo.freshIssue)}` },
              { label: 'OFS', value: `₹${formatCr(ipo.offerForSale)}` },
              { label: 'Lot Size', value: `${ipo.lotSize} shares` },
              { label: 'Min Invest', value: `₹${ipo.minInvestment.toLocaleString('en-IN')}` },
              { label: 'P/E Ratio', value: ipo.peRatio > 0 ? ipo.peRatio.toFixed(1) : 'N/A' },
              { label: 'Revenue', value: `₹${formatCr(ipo.revenue)}` },
              { label: 'Net Profit', value: `₹${formatCr(ipo.netProfit)}` },
              { label: 'ROE', value: `${ipo.roe.toFixed(1)}%` },
            ].map((stat, i) => (
              <View key={i} style={detailStyles.statItem}>
                <Text style={[detailStyles.statLabel, { color: colors.textMuted }]}>{stat.label}</Text>
                <Text style={[detailStyles.statValue, { color: colors.text }]}>{stat.value}</Text>
              </View>
            ))}
          </View>

          {/* Price Band */}
          <View style={[detailStyles.priceSection, { borderColor: colors.border }]}>
            <Text style={[detailStyles.sectionTitle, { color: colors.text }]}>Price Details</Text>
            <View style={detailStyles.priceRow}>
              <View style={detailStyles.priceBox}>
                <Text style={[detailStyles.priceLabel, { color: colors.textMuted }]}>Price Band</Text>
                <Text style={[detailStyles.priceValue, { color: colors.text }]}>
                  ₹{ipo.priceBand.min} - ₹{ipo.priceBand.max}
                </Text>
              </View>
              <View style={detailStyles.priceBox}>
                <Text style={[detailStyles.priceLabel, { color: colors.textMuted }]}>GMP</Text>
                <Text style={[detailStyles.priceValue, { color: ipo.gmp > 0 ? colors.marketUp : colors.marketDown }]}>
                  ₹{ipo.gmp} ({ipo.gmpPercent.toFixed(1)}%)
                </Text>
              </View>
              <View style={detailStyles.priceBox}>
                <Text style={[detailStyles.priceLabel, { color: colors.textMuted }]}>Expected Listing</Text>
                <Text style={[detailStyles.priceValue, { color: colors.text }]}>₹{ipo.expectedListingPrice}</Text>
              </View>
            </View>
          </View>

          {/* Subscription Data */}
          {ipo.subscriptionTotal > 0 && (
            <View style={detailStyles.subSection}>
              <Text style={[detailStyles.sectionTitle, { color: colors.text }]}>Subscription</Text>
              {[
                { label: 'QIB (Institutions)', value: `${ipo.subscriptionQIB.toFixed(1)}x`, color: ipo.subscriptionQIB > 3 ? colors.marketUp : colors.warning },
                { label: 'HNI (Rich Individuals)', value: `${ipo.subscriptionHNI.toFixed(1)}x`, color: ipo.subscriptionHNI > 5 ? colors.marketUp : colors.warning },
                { label: 'Retail', value: `${ipo.subscriptionRetail.toFixed(1)}x`, color: ipo.subscriptionRetail > 2 ? colors.marketUp : colors.warning },
                { label: 'Total', value: `${ipo.subscriptionTotal.toFixed(1)}x`, color: ipo.subscriptionTotal > 5 ? colors.marketUp : colors.warning },
              ].map((s, i) => (
                <View key={i} style={[detailStyles.subRow, { borderBottomColor: colors.divider }]}>
                  <Text style={[detailStyles.subLabel, { color: colors.textSecondary }]}>{s.label}</Text>
                  <View style={detailStyles.subBarRight}>
                    <View style={[detailStyles.subBarBg, { backgroundColor: colors.bgInput }]}>
                      <View style={[detailStyles.subBarFill, {
                        width: `${Math.min(parseFloat(s.value) * 6, 100)}%`,
                        backgroundColor: s.color,
                      }]} />
                    </View>
                    <Text style={[detailStyles.subValue, { color: s.color }]}>{s.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Key Dates */}
          <View style={detailStyles.datesSection}>
            <Text style={[detailStyles.sectionTitle, { color: colors.text }]}>Key Dates</Text>
            {[
              { label: 'Open Date', value: formatDate(ipo.openDate) },
              { label: 'Close Date', value: formatDate(ipo.closeDate) },
              { label: 'Allotment Date', value: ipo.allotmentDate ? formatDate(ipo.allotmentDate) : 'TBD' },
              { label: 'Listing Date', value: formatDate(ipo.listingDate) },
            ].map((d, i) => (
              <View key={i} style={[detailStyles.dateRow, { borderBottomColor: colors.divider }]}>
                <Text style={[detailStyles.dateRowLabel, { color: colors.textSecondary }]}>{d.label}</Text>
                <Text style={[detailStyles.dateRowValue, { color: colors.text }]}>{d.value}</Text>
              </View>
            ))}
          </View>

          {/* About */}
          <Text style={[detailStyles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>About</Text>
          <Text style={[detailStyles.aboutText, { color: colors.textSecondary }]}>{ipo.about}</Text>

          {/* Strengths */}
          <Text style={[detailStyles.subSectionTitle, { color: colors.marketUp, marginTop: SPACING.lg }]}>✓ Strengths</Text>
          {ipo.strengths.map((s, i) => (
            <Text key={i} style={[detailStyles.bulletText, { color: colors.textSecondary }]}>  • {s}</Text>
          ))}

          {/* Risks */}
          <Text style={[detailStyles.subSectionTitle, { color: colors.marketDown, marginTop: SPACING.md }]}>⚠ Risks</Text>
          {ipo.risks.map((r, i) => (
            <Text key={i} style={[detailStyles.bulletText, { color: colors.textSecondary }]}>  • {r}</Text>
          ))}

          {/* Lead Managers */}
          <View style={[detailStyles.footerSection, { borderTopColor: colors.divider }]}>
            <Text style={[detailStyles.footerLabel, { color: colors.textMuted }]}>Lead Managers</Text>
            <Text style={[detailStyles.footerValue, { color: colors.text }]}>{ipo.leadManagers.join(', ')}</Text>
            <Text style={[detailStyles.footerLabel, { color: colors.textMuted, marginTop: SPACING.sm }]}>Registrar</Text>
            <Text style={[detailStyles.footerValue, { color: colors.text }]}>{ipo.registrar}</Text>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions: { flexDirection: 'row', gap: SPACING.lg },
  content: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.huge },
  companyHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  companyLogo: { width: 56, height: 56, borderRadius: BORDER_RADIUS.lg, justifyContent: 'center', alignItems: 'center' },
  companyLogoText: { fontSize: 22, fontWeight: '800' },
  companyName: { fontSize: 22, fontWeight: '800' },
  sector: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: SPACING.lg },
  ratingText: { fontSize: 12, fontWeight: '600', marginLeft: 6 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, padding: SPACING.md, marginBottom: SPACING.lg,
  },
  statItem: { width: '33%', padding: SPACING.sm, alignItems: 'center' },
  statLabel: { fontSize: 9, fontWeight: '500', marginBottom: 2, textTransform: 'uppercase' },
  statValue: { fontSize: 13, fontWeight: '700' },
  priceSection: { borderTopWidth: 1, paddingVertical: SPACING.lg, marginBottom: SPACING.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: SPACING.md },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceBox: { alignItems: 'center', flex: 1 },
  priceLabel: { fontSize: 10, fontWeight: '500', marginBottom: 4 },
  priceValue: { fontSize: 15, fontWeight: '700' },
  subSection: { marginBottom: SPACING.lg },
  subRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.sm, borderBottomWidth: 1,
  },
  subLabel: { fontSize: 13, fontWeight: '500', width: 140 },
  subBarRight: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  subBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  subBarFill: { height: '100%', borderRadius: 3 },
  subValue: { fontSize: 13, fontWeight: '700', width: 50, textAlign: 'right' },
  datesSection: { marginBottom: SPACING.lg },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1 },
  dateRowLabel: { fontSize: 13, fontWeight: '500' },
  dateRowValue: { fontSize: 13, fontWeight: '600' },
  aboutText: { fontSize: 14, lineHeight: 22, fontWeight: '400' },
  subSectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: SPACING.sm },
  bulletText: { fontSize: 13, lineHeight: 20, marginBottom: 2 },
  footerSection: { borderTopWidth: 1, paddingTop: SPACING.lg, marginTop: SPACING.lg },
  footerLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  footerValue: { fontSize: 13, fontWeight: '500' },
});

// ─── Main Screen ──────────────────────────────────────────
export default function IPOCalendarScreen({ _navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<IPOFilter>('all');
  const [ipos, setIpos] = useState<IPOItem[]>(mockIPOs);
  const [selectedIPO, setSelectedIPO] = useState<IPOItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const filteredIPOs = useMemo(() => {
    if (activeFilter === 'all') return ipos;
    return ipos.filter(i => i.subscriptionStatus === activeFilter);
  }, [ipos, activeFilter]);

  const toggleBookmark = useCallback((ipoId: string) => {
    setIpos(prev => prev.map(i => i.id === ipoId ? { ...i, isBookmarked: !i.isBookmarked } : i));
  }, []);

  const openDetail = useCallback((ipo: IPOItem) => {
    setSelectedIPO(ipo);
    setModalVisible(true);
  }, []);

  const counts = useMemo(() => ({
    all: ipos.length,
    open: ipos.filter(i => i.subscriptionStatus === 'open').length,
    upcoming: ipos.filter(i => i.subscriptionStatus === 'upcoming').length,
    closed: ipos.filter(i => i.subscriptionStatus === 'closed').length,
    listed: ipos.filter(i => i.subscriptionStatus === 'listed').length,
  }), [ipos]);

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[screenStyles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[screenStyles.title, { color: colors.text }]}>IPO Calendar</Text>
        <Text style={[screenStyles.subtitle, { color: colors.textMuted }]}>
          {counts.open > 0 ? `${counts.open} open · ` : ''}
          {counts.upcoming} upcoming · {counts.listed} listed
        </Text>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={screenStyles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f.key} activeOpacity={0.7}
              style={[screenStyles.filterChip, {
                backgroundColor: activeFilter === f.key ? colors.primary : colors.bgCardLight,
                borderColor: activeFilter === f.key ? colors.primary : colors.border,
              }]}
              onPress={() => setActiveFilter(f.key)}>
              <Ionicons name={f.icon as any} size={14}
                color={activeFilter === f.key ? '#FFFFFF' : colors.textSecondary} />
              <Text style={[screenStyles.filterText, {
                color: activeFilter === f.key ? '#FFFFFF' : colors.textSecondary,
              }]}>{f.label}</Text>
              <View style={[screenStyles.filterCount, {
                backgroundColor: activeFilter === f.key ? 'rgba(255,255,255,0.2)' : colors.bgCard,
              }]}>
                <Text style={[screenStyles.filterCountText, {
                  color: activeFilter === f.key ? '#FFFFFF' : colors.textMuted,
                }]}>{counts[f.key]}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* IPO List */}
      {filteredIPOs.length === 0 ? (
        <View style={screenStyles.emptyState}>
          <Ionicons name="rocket-outline" size={48} color={colors.textMuted} />
          <Text style={[screenStyles.emptyText, { color: colors.textMuted }]}>No IPOs found</Text>
          <Text style={[screenStyles.emptySubtext, { color: colors.textMuted }]}>
            {activeFilter !== 'all' ? 'No IPOs in this category' : 'Check back later for new IPOs'}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={screenStyles.listContent}>
          {/* IPO Count */}
          <Text style={[screenStyles.countText, { color: colors.textMuted }]}>
            Showing {filteredIPOs.length} IPO{filteredIPOs.length !== 1 ? 's' : ''}
          </Text>

          {filteredIPOs.map(ipo => (
            <IPOCard key={ipo.id} ipo={ipo} colors={colors}
              onPress={() => openDetail(ipo)}
              onBookmark={() => toggleBookmark(ipo.id)} />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Detail Modal */}
      <IPODetailModal ipo={selectedIPO} visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onBookmark={() => selectedIPO && toggleBookmark(selectedIPO.id)}
        colors={colors} />
    </View>
  );
}

const screenStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.sm },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2, marginBottom: SPACING.md },
  filterRow: { gap: 8, paddingBottom: SPACING.md },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: '600' },
  filterCount: {
    paddingHorizontal: 6, borderRadius: BORDER_RADIUS.full,
    minWidth: 20, alignItems: 'center',
  },
  filterCountText: { fontSize: 11, fontWeight: '700' },
  listContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  countText: { fontSize: 12, fontWeight: '500', marginBottom: SPACING.md },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySubtext: { fontSize: 13, fontWeight: '400', textAlign: 'center', paddingHorizontal: 40 },
});
