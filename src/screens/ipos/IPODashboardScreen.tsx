// ============================================================================
// Toroloom — IPO Dashboard Screen
// Active IPOs · Apply via UPI · Allotment Status · My Applications
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants/theme';
import { useIPOStore } from '../../store/ipoStore';
import type { IPOItem, IPOApplication } from '../../types';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

// ──── Constants ────────────────────────────────────────────────────────────

type DashboardTab = 'active' | 'myapps';

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

const APPLICATION_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  pending: { label: 'Pending', color: '#FFAB40', bgColor: '#FFAB4020', icon: 'time-outline' },
  submitted: { label: 'Submitted', color: '#3B82F6', bgColor: '#3B82F620', icon: 'send-outline' },
  pending_allotment: { label: 'Awaiting Allotment', color: '#8B5CF6', bgColor: '#8B5CF620', icon: 'hourglass-outline' },
  allotted: { label: 'Allotted ✅', color: '#00E676', bgColor: '#00E67620', icon: 'checkmark-circle' },
  not_allotted: { label: 'Not Allotted', color: '#FF5252', bgColor: '#FF525220', icon: 'close-circle' },
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
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, fontWeight: '700' },
});

// ──── App Status Badge ─────────────────────────────────────────────────────

function AppStatusBadge({ status }: { status: string }) {
  const config = APPLICATION_STATUS_CONFIG[status] || APPLICATION_STATUS_CONFIG.pending;
  return (
    <View style={[appBadgeStyles.badge, { backgroundColor: config.bgColor, borderColor: config.color + '30' }]}>
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text style={[appBadgeStyles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const appBadgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  label: { fontSize: 10, fontWeight: '700' },
});

// ──── IPO Card ─────────────────────────────────────────────────────────────

function IPOCard({
  ipo, onPress, onApply, onBookmark, colors,
}: {
  ipo: IPOItem; onPress: () => void; onApply?: () => void;
  onBookmark: () => void; colors: any;
}) {
  const isHighSubscription = ipo.subscriptionTotal > 5;
  const gmpPositive = ipo.gmp > 0;
  const canApply = ipo.subscriptionStatus === 'open' || ipo.subscriptionStatus === 'listing_today';

  return (
    <AnimatedPressable onPress={onPress} haptic="light" scaleTo={0.98}>
      <View style={[cardStyles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {/* Top Row */}
        <View style={cardStyles.topRow}>
          <View style={[cardStyles.logo, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
            <Text style={[cardStyles.logoText, { color: colors.primary }]}>{ipo.logo}</Text>
          </View>
          <View style={cardStyles.companyInfo}>
            <Text style={[cardStyles.companyName, { color: colors.text }]} numberOfLines={1}>
              {ipo.companyName}
            </Text>
            <Text style={[cardStyles.sector, { color: colors.textMuted }]}>{ipo.sector}</Text>
          </View>
          <View style={cardStyles.topActions}>
            <StatusBadge status={ipo.subscriptionStatus} />
            <TouchableOpacity onPress={onBookmark} hitSlop={8}>
              <Ionicons
                name={ipo.isBookmarked ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={ipo.isBookmarked ? colors.warning : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Price & GMP Row */}
        <View style={cardStyles.priceRow}>
          <View style={cardStyles.priceItem}>
            <Text style={[cardStyles.priceLabel, { color: colors.textMuted }]}>Price Band</Text>
            <Text style={[cardStyles.priceValue, { color: colors.text }]}>
              ₹{ipo.priceBand.min} – ₹{ipo.priceBand.max}
            </Text>
          </View>
          <View style={cardStyles.priceItem}>
            <Text style={[cardStyles.priceLabel, { color: colors.textMuted }]}>Lot</Text>
            <Text style={[cardStyles.priceValue, { color: colors.text }]}>{ipo.lotSize} shares</Text>
          </View>
          <View style={cardStyles.priceItem}>
            <Text style={[cardStyles.priceLabel, { color: colors.textMuted }]}>Min Invest</Text>
            <Text style={[cardStyles.priceValue, { color: colors.text }]}>
              ₹{ipo.minInvestment.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* GMP */}
        <View style={[cardStyles.gmpRow, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
          <View style={cardStyles.gmpLeft}>
            <Text style={[cardStyles.gmpLabel, { color: colors.textMuted }]}>GMP</Text>
            <Text style={[cardStyles.gmpValue, { color: gmpPositive ? colors.marketUp : colors.marketDown }]}>
              {gmpPositive ? '+' : ''}₹{ipo.gmp} ({gmpPositive ? '+' : ''}{ipo.gmpPercent.toFixed(1)}%)
            </Text>
          </View>
          <View style={cardStyles.gmpRight}>
            <Text style={[cardStyles.gmpLabel, { color: colors.textMuted }]}>Expected Listing</Text>
            <Text style={[cardStyles.gmpValue, { color: colors.text }]}>
              ₹{ipo.expectedListingPrice} ({(ipo.expectedListingGain >= 0 ? '+' : '')}{ipo.expectedListingGain.toFixed(1)}%)
            </Text>
          </View>
        </View>

        {/* Subscription Bar */}
        {ipo.subscriptionTotal > 0 && (
          <View style={cardStyles.subRow}>
            <View style={cardStyles.subLabelRow}>
              <Text style={[cardStyles.subLabel, { color: colors.textMuted }]}>
                Subscription: {ipo.subscriptionTotal.toFixed(1)}x
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={[cardStyles.subLabel, { color: colors.textMuted, fontSize: 9 }]}>
                  QIB: {ipo.subscriptionQIB.toFixed(1)}x
                </Text>
                <Text style={[cardStyles.subLabel, { color: colors.textMuted, fontSize: 9 }]}>
                  HNI: {ipo.subscriptionHNI.toFixed(1)}x
                </Text>
                <Text style={[cardStyles.subLabel, { color: colors.textMuted, fontSize: 9 }]}>
                  Ret: {ipo.subscriptionRetail.toFixed(1)}x
                </Text>
              </View>
            </View>
            <View style={[cardStyles.subBar, { backgroundColor: colors.bgInput }]}>
              <View style={[cardStyles.subFill, {
                width: `${Math.min(ipo.subscriptionTotal * 8, 100)}%`,
                backgroundColor: isHighSubscription ? colors.marketUp : colors.warning,
              }]} />
            </View>
          </View>
        )}

        {/* Dates + Apply Button */}
        <View style={cardStyles.footerRow}>
          <View style={cardStyles.datesCol}>
            <View style={cardStyles.dateItem}>
              <Ionicons name="calendar-outline" size={10} color={colors.textMuted} />
              <Text style={[cardStyles.dateText, { color: colors.textMuted }]}>
                Open: {formatDate(ipo.openDate)}
              </Text>
            </View>
            <View style={cardStyles.dateItem}>
              <Ionicons name="flag-outline" size={10} color={colors.textMuted} />
              <Text style={[cardStyles.dateText, { color: colors.textMuted }]}>
                Listing: {formatDate(ipo.listingDate)}
              </Text>
            </View>
          </View>
          {canApply && onApply && (
            <TouchableOpacity
              style={cardStyles.applyBtn}
              onPress={onApply}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#00E676', '#00C853']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={cardStyles.applyGradient}
              >
                <Ionicons name="phone-portrait-outline" size={14} color="#0A0D14" />
                <Text style={cardStyles.applyText}>Apply via UPI</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
    marginBottom: SPACING.md,
  },
  topRow: { flexDirection: 'row', marginBottom: SPACING.md },
  logo: {
    width: 44, height: 44, borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  logoText: { fontSize: 16, fontWeight: '800' },
  companyInfo: { flex: 1, justifyContent: 'center' },
  companyName: { fontSize: 15, fontWeight: '700' },
  sector: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  topActions: { alignItems: 'flex-end', gap: 6 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  priceItem: { alignItems: 'center', flex: 1 },
  priceLabel: { fontSize: 10, fontWeight: '500', marginBottom: 3 },
  priceValue: { fontSize: 13, fontWeight: '700' },
  gmpRow: {
    flexDirection: 'row', borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  gmpLeft: { flex: 1 },
  gmpRight: { flex: 1, alignItems: 'flex-end' },
  gmpLabel: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
  gmpValue: { fontSize: 13, fontWeight: '700' },
  subRow: { marginBottom: SPACING.sm },
  subLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  subLabel: { fontSize: 10, fontWeight: '600' },
  subBar: { height: 5, borderRadius: 3, overflow: 'hidden' },
  subFill: { height: '100%', borderRadius: 3 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  datesCol: { gap: 3 },
  dateItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 10, fontWeight: '500' },
  applyBtn: { borderRadius: BORDER_RADIUS.md, overflow: 'hidden' },
  applyGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  applyText: { fontSize: 12, fontWeight: '700', color: '#0A0D14' },
});

// ──── Application Card ─────────────────────────────────────────────────────

function ApplicationCard({ app, colors }: {
  app: IPOApplication; colors: any;
}) {
  const config = APPLICATION_STATUS_CONFIG[app.status] || APPLICATION_STATUS_CONFIG.pending;
  const isPositive = app.status === 'allotted' && (app.listingGain || 0) >= 0;

  return (
    <View style={[appCardStyles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {/* Header */}
      <View style={appCardStyles.header}>
        <View style={[appCardStyles.logo, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
          <Text style={[appCardStyles.logoText, { color: colors.primary }]}>{app.logo}</Text>
        </View>
        <View style={appCardStyles.info}>
          <Text style={[appCardStyles.companyName, { color: colors.text }]}>{app.companyName}</Text>
          <Text style={[appCardStyles.sector, { color: colors.textMuted }]}>{app.sector}</Text>
        </View>
        <AppStatusBadge status={app.status} />
      </View>

      {/* Details */}
      <View style={[appCardStyles.details, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
        <View style={appCardStyles.detailItem}>
          <Text style={[appCardStyles.detailLabel, { color: colors.textMuted }]}>Lots</Text>
          <Text style={[appCardStyles.detailValue, { color: colors.text }]}>{app.bidLots}</Text>
        </View>
        <View style={[appCardStyles.detailDivider, { backgroundColor: colors.divider }]} />
        <View style={appCardStyles.detailItem}>
          <Text style={[appCardStyles.detailLabel, { color: colors.textMuted }]}>Shares</Text>
          <Text style={[appCardStyles.detailValue, { color: colors.text }]}>{app.bidQuantity}</Text>
        </View>
        <View style={[appCardStyles.detailDivider, { backgroundColor: colors.divider }]} />
        <View style={appCardStyles.detailItem}>
          <Text style={[appCardStyles.detailLabel, { color: colors.textMuted }]}>Price</Text>
          <Text style={[appCardStyles.detailValue, { color: colors.text }]}>₹{app.bidPrice}</Text>
        </View>
        <View style={[appCardStyles.detailDivider, { backgroundColor: colors.divider }]} />
        <View style={appCardStyles.detailItem}>
          <Text style={[appCardStyles.detailLabel, { color: colors.textMuted }]}>Amount</Text>
          <Text style={[appCardStyles.detailValue, { color: colors.text }]}>
            {formatCompact(app.totalAmount)}
          </Text>
        </View>
      </View>

      {/* Allotment Details */}
      {app.status === 'allotted' && app.sharesAllotted && (
        <View style={[appCardStyles.allotmentRow, { backgroundColor: '#00E67610', borderColor: '#00E67620' }]}>
          <View style={appCardStyles.allotItem}>
            <Text style={[appCardStyles.allotLabel, { color: colors.textMuted }]}>Allotted</Text>
            <Text style={[appCardStyles.allotValue, { color: colors.marketUp }]}>
              {app.sharesAllotted} shares
            </Text>
          </View>
          <View style={[appCardStyles.detailDivider, { backgroundColor: '#00E67620' }]} />
          <View style={appCardStyles.allotItem}>
            <Text style={[appCardStyles.allotLabel, { color: colors.textMuted }]}>Listing Price</Text>
            <Text style={[appCardStyles.allotValue, { color: colors.text }]}>
              ₹{app.listingPrice || '—'}
            </Text>
          </View>
          <View style={[appCardStyles.detailDivider, { backgroundColor: '#00E67620' }]} />
          <View style={appCardStyles.allotItem}>
            <Text style={[appCardStyles.allotLabel, { color: colors.textMuted }]}>Gain</Text>
            <Text style={[appCardStyles.allotValue, { color: isPositive ? colors.marketUp : colors.marketDown }]}>
              {app.listingGain ? `${app.listingGain >= 0 ? '+' : ''}${app.listingGain.toFixed(1)}%` : '—'}
            </Text>
          </View>
        </View>
      )}

      {/* UPI & Date */}
      <View style={appCardStyles.footer}>
        <Text style={[appCardStyles.footerText, { color: colors.textMuted }]}>
          UPI: {app.upiId}
        </Text>
        <Text style={[appCardStyles.footerText, { color: colors.textMuted }]}>
          Applied: {formatDate(app.appliedAt)}
        </Text>
      </View>
    </View>
  );
}

const appCardStyles = StyleSheet.create({
  card: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
    marginBottom: SPACING.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  logo: {
    width: 40, height: 40, borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  logoText: { fontSize: 14, fontWeight: '800' },
  info: { flex: 1 },
  companyName: { fontSize: 14, fontWeight: '700' },
  sector: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  details: {
    flexDirection: 'row', borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  detailItem: { flex: 1, alignItems: 'center' },
  detailLabel: { fontSize: 9, fontWeight: '500', marginBottom: 2 },
  detailValue: { fontSize: 12, fontWeight: '700' },
  detailDivider: { width: 1, marginVertical: 4 },
  allotmentRow: {
    flexDirection: 'row', borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  allotItem: { flex: 1, alignItems: 'center' },
  allotLabel: { fontSize: 9, fontWeight: '500', marginBottom: 2 },
  allotValue: { fontSize: 12, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 9, fontWeight: '500' },
});

// ──── UPI Apply Modal ──────────────────────────────────────────────────────

function UPIApplyModal({
  ipo, visible, onClose, colors,
}: {
  ipo: IPOItem | null; visible: boolean; onClose: () => void; colors: any;
}) {
  const applyForIPO = useIPOStore((s) => s.applyForIPO);
  const [bidLots, setBidLots] = useState(1);
  const [bidPrice, setBidPrice] = useState(0);
  const [upiId, setUpiId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (ipo && visible) {
      setBidLots(1);
      setBidPrice(ipo.priceBand.min);
      setUpiId('');
    }
  }, [ipo, visible]);

  if (!ipo) return null;

  const lotSize = ipo.lotSize;
  const bidQuantity = bidLots * lotSize;
  const totalAmount = bidQuantity * bidPrice;

  const handleSubmit = () => {
    if (!upiId.trim() || !upiId.includes('@')) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g., name@bank)');
      return;
    }
    if (bidLots < 1 || bidLots > 100) {
      Alert.alert('Invalid Lots', 'Minimum 1 lot, maximum 100 lots');
      return;
    }

    setSubmitting(true);
    try {
      applyForIPO(ipo, bidLots, bidPrice, upiId.trim());
      Alert.alert(
        'Application Submitted ✅',
        `${ipo.companyName}\n${bidLots} lot(s) • ${bidQuantity} shares\n₹${totalAmount.toLocaleString('en-IN')}\nUPI: ${upiId.trim()}`,
      );
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate lot options
  const lotOptions = [1, 2, 3, 5, 10, 20, 50];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[modalStyles.overlay]}>
        <View style={[modalStyles.container, { backgroundColor: colors.bgSecondary }]}>
          {/* Header */}
          <View style={modalStyles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[modalStyles.title, { color: colors.text }]}>Apply via UPI</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={modalStyles.content}>
            {/* Company Info */}
            <View style={[modalStyles.companyInfo, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={[modalStyles.logo, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                <Text style={[modalStyles.logoText, { color: colors.primary }]}>{ipo.logo}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[modalStyles.companyName, { color: colors.text }]}>{ipo.companyName}</Text>
                <Text style={[modalStyles.companyMeta, { color: colors.textMuted }]}>
                  ₹{ipo.priceBand.min} – ₹{ipo.priceBand.max} · Lot: {ipo.lotSize} shares
                </Text>
              </View>
            </View>

            {/* Bid Lots */}
            <Text style={[modalStyles.label, { color: colors.textSecondary }]}>Number of Lots</Text>
            <View style={modalStyles.lotsRow}>
              {lotOptions.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    modalStyles.lotBtn,
                    {
                      backgroundColor: bidLots === opt ? colors.primary : colors.bgCard,
                      borderColor: bidLots === opt ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setBidLots(opt)}
                >
                  <Text style={[modalStyles.lotText, {
                    color: bidLots === opt ? '#FFFFFF' : colors.text,
                    fontWeight: bidLots === opt ? '700' : '500',
                  }]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Lots */}
            <View style={[modalStyles.customRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <Text style={[modalStyles.customLabel, { color: colors.textMuted }]}>Custom</Text>
              <TextInput
                style={[modalStyles.customInput, { color: colors.text }]}
                value={bidLots.toString()}
                onChangeText={(t) => {
                  const n = parseInt(t) || 1;
                  setBidLots(Math.max(1, Math.min(100, n)));
                }}
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[modalStyles.customSuffix, { color: colors.textMuted }]}>lots</Text>
            </View>

            {/* Bid Price */}
            <Text style={[modalStyles.label, { color: colors.textSecondary }]}>
              Bid Price (₹)
            </Text>
            <View style={modalStyles.priceRow}>
              <TouchableOpacity
                style={[modalStyles.priceBtn, {
                  backgroundColor: bidPrice === ipo.priceBand.min ? colors.primary : colors.bgCard,
                  borderColor: bidPrice === ipo.priceBand.min ? colors.primary : colors.border,
                }]}
                onPress={() => setBidPrice(ipo.priceBand.min)}
              >
                <Text style={[modalStyles.priceText, {
                  color: bidPrice === ipo.priceBand.min ? '#FFFFFF' : colors.text,
                  fontWeight: bidPrice === ipo.priceBand.min ? '700' : '500',
                }]}>
                  Cut-off
                </Text>
                <Text style={[modalStyles.priceSub, {
                  color: bidPrice === ipo.priceBand.min ? 'rgba(255,255,255,0.7)' : colors.textMuted,
                }]}>
                  ₹{ipo.priceBand.min}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.priceBtn, {
                  backgroundColor: bidPrice === ipo.priceBand.max ? colors.primary : colors.bgCard,
                  borderColor: bidPrice === ipo.priceBand.max ? colors.primary : colors.border,
                }]}
                onPress={() => setBidPrice(ipo.priceBand.max)}
              >
                <Text style={[modalStyles.priceText, {
                  color: bidPrice === ipo.priceBand.max ? '#FFFFFF' : colors.text,
                  fontWeight: bidPrice === ipo.priceBand.max ? '700' : '500',
                }]}>
                  Higher
                </Text>
                <Text style={[modalStyles.priceSub, {
                  color: bidPrice === ipo.priceBand.max ? 'rgba(255,255,255,0.7)' : colors.textMuted,
                }]}>
                  ₹{ipo.priceBand.max}
                </Text>
              </TouchableOpacity>
            </View>

            {/* UPI ID */}
            <Text style={[modalStyles.label, { color: colors.textSecondary }]}>UPI ID</Text>
            <View style={[modalStyles.upiRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
              <TextInput
                style={[modalStyles.upiInput, { color: colors.text }]}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="e.g., name@hdfc"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Summary */}
            <View style={[modalStyles.summary, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={modalStyles.summaryRow}>
                <Text style={[modalStyles.summaryLabel, { color: colors.textMuted }]}>Lots</Text>
                <Text style={[modalStyles.summaryValue, { color: colors.text }]}>{bidLots}</Text>
              </View>
              <View style={[modalStyles.summaryDivider, { backgroundColor: colors.divider }]} />
              <View style={modalStyles.summaryRow}>
                <Text style={[modalStyles.summaryLabel, { color: colors.textMuted }]}>Shares</Text>
                <Text style={[modalStyles.summaryValue, { color: colors.text }]}>
                  {bidQuantity.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={[modalStyles.summaryDivider, { backgroundColor: colors.divider }]} />
              <View style={modalStyles.summaryRow}>
                <Text style={[modalStyles.summaryLabel, { color: colors.textMuted }]}>Price per Share</Text>
                <Text style={[modalStyles.summaryValue, { color: colors.text }]}>₹{bidPrice}</Text>
              </View>
              <View style={[modalStyles.summaryDivider, { backgroundColor: colors.divider }]} />
              <View style={modalStyles.summaryRow}>
                <Text style={[modalStyles.summaryLabel, { color: colors.textMuted }]}>Total Amount</Text>
                <Text style={[modalStyles.summaryValue, { color: colors.primary, fontSize: 16 }]}>
                  {formatCompact(totalAmount)}
                </Text>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={modalStyles.submitBtn}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#00E676', '#00C853']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={modalStyles.submitGradient}
              >
                <Ionicons name="checkmark-circle" size={20} color="#0A0D14" />
                <Text style={modalStyles.submitText}>
                  {submitting ? 'Submitting...' : `Apply for ${formatCompact(totalAmount)}`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Info */}
            <View style={[modalStyles.infoBox, { backgroundColor: '#3B82F610', borderColor: '#3B82F630' }]}>
              <Ionicons name="information-circle" size={14} color={colors.primary} />
              <Text style={[modalStyles.infoText, { color: colors.textMuted }]}>
                Amount will be blocked in your UPI account. It will be debited only upon allotment.
              </Text>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '90%',
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: SPACING.md,
  },
  logo: {
    width: 48, height: 48, borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
  },
  logoText: { fontSize: 18, fontWeight: '800' },
  companyName: { ...FONTS.semiBold, fontSize: FONTS.size.md },
  companyMeta: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  label: {
    ...FONTS.medium, fontSize: FONTS.size.sm,
  },
  lotsRow: {
    flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap',
  },
  lotBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    minWidth: 48,
    alignItems: 'center',
  },
  lotText: { fontSize: 14 },
  customRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    paddingHorizontal: SPACING.md, paddingVertical: 4,
  },
  customLabel: { fontSize: 12, fontWeight: '500', marginRight: SPACING.sm },
  customInput: {
    flex: 1, fontSize: 16, fontWeight: '700',
    paddingVertical: SPACING.sm,
  },
  customSuffix: { fontSize: 12, fontWeight: '500', marginLeft: 4 },
  priceRow: {
    flexDirection: 'row', gap: SPACING.md,
  },
  priceBtn: {
    flex: 1, alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
  },
  priceText: { fontSize: 14 },
  priceSub: { fontSize: 11, marginTop: 2 },
  upiRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    paddingHorizontal: SPACING.md, gap: SPACING.sm,
  },
  upiInput: {
    flex: 1, fontSize: 16, fontWeight: '600',
    paddingVertical: SPACING.md,
  },
  summary: {
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    padding: SPACING.lg,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: { fontSize: 13, fontWeight: '500' },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  summaryDivider: { height: 1, marginVertical: 4 },
  submitBtn: {
    borderRadius: BORDER_RADIUS.lg, overflow: 'hidden',
  },
  submitGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: SPACING.lg,
  },
  submitText: {
    fontSize: 16, fontWeight: '700', color: '#0A0D14',
  },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
  },
  infoText: {
    flex: 1, fontSize: 11, fontWeight: '500', lineHeight: 16,
  },
});

// ──── Main Screen ──────────────────────────────────────────────────────────

export default function IPODashboardScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { ipos, applications, toggleBookmark } = useIPOStore();
  const getApplicationStats = useIPOStore((s) => s.getApplicationStats);

  const [activeTab, setActiveTab] = useState<DashboardTab>('active');
  const [activeFilter, setActiveFilter] = useState<IPOFilter>('open');
  const [applyModalIPO, setApplyModalIPO] = useState<IPOItem | null>(null);

  const stats = useMemo(() => getApplicationStats(), [applications, getApplicationStats]);

  // Filtered IPOs
  const filteredIPOs = useMemo(() => {
    if (activeFilter === 'all') return ipos;
    return ipos.filter((i) => i.subscriptionStatus === activeFilter);
  }, [ipos, activeFilter]);

  // Filter applications by type
  const [appFilter, setAppFilter] = useState<'all' | 'submitted' | 'allotted' | 'not_allotted'>('all');
  const filteredApps = useMemo(() => {
    if (appFilter === 'all') return applications;
    return applications.filter((a) => a.status === appFilter);
  }, [applications, appFilter]);

  const counts = useMemo(() => ({
    open: ipos.filter((i) => i.subscriptionStatus === 'open').length,
    upcoming: ipos.filter((i) => i.subscriptionStatus === 'upcoming').length,
    listed: ipos.filter((i) => i.subscriptionStatus === 'listed').length,
  }), [ipos]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>IPO Dashboard</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {counts.open > 0
                ? `${counts.open} open · ${counts.upcoming} upcoming · ${counts.listed} listed`
                : `${applications.length} applications tracked`}
            </Text>
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
            <Ionicons
              name="rocket"
              size={14}
              color={activeTab === 'active' ? '#FFFFFF' : colors.textMuted}
            />
            <Text style={[styles.tabText, { color: activeTab === 'active' ? '#FFFFFF' : colors.textMuted }]}>
              Active IPOs
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'myapps' && { backgroundColor: colors.primary }]}
            onPress={() => setActiveTab('myapps')}
          >
            <Ionicons
              name="document-text"
              size={14}
              color={activeTab === 'myapps' ? '#FFFFFF' : colors.textMuted}
            />
            <Text style={[styles.tabText, { color: activeTab === 'myapps' ? '#FFFFFF' : colors.textMuted }]}>
              My Apps ({applications.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
                <Ionicons
                  name={f.icon as any}
                  size={13}
                  color={activeFilter === f.key ? '#FFFFFF' : colors.textSecondary}
                />
                <Text style={[styles.filterText, {
                  color: activeFilter === f.key ? '#FFFFFF' : colors.textSecondary,
                }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* IPO List */}
          {filteredIPOs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="rocket-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>No IPOs found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Check back later for new IPOs
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            >
              <Text style={[styles.countText, { color: colors.textMuted }]}>
                Showing {filteredIPOs.length} IPO{filteredIPOs.length !== 1 ? 's' : ''}
              </Text>
              {filteredIPOs.map((ipo) => (
                <IPOCard
                  key={ipo.id}
                  ipo={ipo}
                  colors={colors}
                  onPress={() => navigation.navigate('IPODetail', { ipoId: ipo.id })}
                  onApply={
                    ipo.subscriptionStatus === 'open' || ipo.subscriptionStatus === 'listing_today'
                      ? () => setApplyModalIPO(ipo)
                      : undefined
                  }
                  onBookmark={() => toggleBookmark(ipo.id)}
                />
              ))}
              <View style={{ height: 100 }} />
            </ScrollView>
          )}
        </>
      ) : (
        <>
          {/* Application Stats */}
          {applications.length > 0 && (
            <View style={[styles.statsRow, { paddingHorizontal: SPACING.xl }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
                <View style={[styles.statChip, { backgroundColor: '#3B82F620', borderColor: '#3B82F640' }]}>
                  <Text style={[styles.statChipValue, { color: '#3B82F6' }]}>{stats.total}</Text>
                  <Text style={[styles.statChipLabel, { color: colors.textMuted }]}>Total</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: '#3B82F620', borderColor: '#3B82F640' }]}>
                  <Text style={[styles.statChipValue, { color: '#3B82F6' }]}>{stats.submitted}</Text>
                  <Text style={[styles.statChipLabel, { color: colors.textMuted }]}>Submitted</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: '#00E67620', borderColor: '#00E67640' }]}>
                  <Text style={[styles.statChipValue, { color: '#00E676' }]}>{stats.allotted}</Text>
                  <Text style={[styles.statChipLabel, { color: colors.textMuted }]}>Allotted</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: '#FF525220', borderColor: '#FF525240' }]}>
                  <Text style={[styles.statChipValue, { color: '#FF5252' }]}>{stats.notAllotted}</Text>
                  <Text style={[styles.statChipLabel, { color: colors.textMuted }]}>Not Allotted</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: '#FFAB4020', borderColor: '#FFAB4040' }]}>
                  <Text style={[styles.statChipValue, { color: '#FFAB40' }]}>
                    {formatCompact(stats.totalInvestment)}
                  </Text>
                  <Text style={[styles.statChipLabel, { color: colors.textMuted }]}>Invested</Text>
                </View>
                {stats.profitFromAllotted > 0 && (
                  <View style={[styles.statChip, { backgroundColor: '#00E67620', borderColor: '#00E67640' }]}>
                    <Text style={[styles.statChipValue, { color: '#00E676' }]}>
                      +{formatCompact(stats.profitFromAllotted)}
                    </Text>
                    <Text style={[styles.statChipLabel, { color: colors.textMuted }]}>Profit</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {/* Application Filter */}
          {applications.length > 1 && (
            <View style={styles.appFilterRow}>
              {(['all', 'submitted', 'allotted', 'not_allotted'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.appFilterChip, {
                    backgroundColor: appFilter === f ? colors.primary : colors.bgCardLight,
                    borderColor: appFilter === f ? colors.primary : colors.border,
                  }]}
                  onPress={() => setAppFilter(f)}
                >
                  <Text style={[styles.appFilterText, {
                    color: appFilter === f ? '#FFFFFF' : colors.textMuted,
                  }]}>
                    {f === 'all' ? 'All' : f === 'submitted' ? 'Active' : f === 'allotted' ? '✅' : '❌'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Applications List */}
          {filteredApps.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>No Applications</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Apply to an open IPO to see it here
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            >
              <Text style={[styles.countText, { color: colors.textMuted }]}>
                {filteredApps.length} application{filteredApps.length !== 1 ? 's' : ''}
              </Text>
              {filteredApps.map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  colors={colors}
                />
              ))}
              <View style={{ height: 100 }} />
            </ScrollView>
          )}
        </>
      )}

      {/* UPI Apply Modal */}
      <UPIApplyModal
        ipo={applyModalIPO}
        visible={!!applyModalIPO}
        onClose={() => setApplyModalIPO(null)}
        colors={colors}
      />
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.sm },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: SPACING.md,
  },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  backBtn: {
    width: 40, height: 40, borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, marginTop: 4,
  },
  tabRow: {
    flexDirection: 'row', borderRadius: BORDER_RADIUS.md,
    padding: 4, marginBottom: SPACING.sm,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.sm,
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  filterRow: {
    paddingHorizontal: SPACING.xl, gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  filterText: { fontSize: 12, fontWeight: '600' },
  listContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  countText: { fontSize: 11, fontWeight: '500', marginBottom: SPACING.md },
  emptyState: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 13, fontWeight: '400', textAlign: 'center', paddingHorizontal: 40 },
  // My Apps styles
  statsRow: { marginBottom: SPACING.md },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  statChipValue: { fontSize: 12, fontWeight: '700' },
  statChipLabel: { fontSize: 10, fontWeight: '500' },
  appFilterRow: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
  },
  appFilterChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  appFilterText: { fontSize: 11, fontWeight: '600' },
});
