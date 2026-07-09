// ============================================================================
// Toroloom — Economic Calendar Screen
// Displays economic events, central bank decisions, GDP data, inflation
// reports, and other macroeconomic indicators in a timeline view.
// ============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../../constants/theme';
import { mockEconomicEvents } from '../../constants/mockData';
import type { EconomicEvent } from '../../types';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

// ─── Helpers ──────────────────────────────────────────────
const CATEGORY_CONFIG: Record<string, { label: string; icon: string }> = {
  central_bank: { label: 'Central Bank', icon: 'business' },
  gdp: { label: 'GDP', icon: 'trending-up' },
  inflation: { label: 'Inflation', icon: 'pricetag' },
  employment: { label: 'Employment', icon: 'people' },
  trade: { label: 'Trade', icon: 'swap-horizontal' },
  fiscal: { label: 'Fiscal', icon: 'calculator' },
  industry: { label: 'Industry', icon: 'build' },
  consumer: { label: 'Consumer', icon: 'cart' },
  housing: { label: 'Housing', icon: 'home' },
  other: { label: 'Other', icon: 'ellipsis-horizontal' },
};

const IMPORTANCE_CONFIG: Record<string, { color: string; bar: number }> = {
  high: { color: '#FF5252', bar: 3 },
  medium: { color: '#FFAB40', bar: 2 },
  low: { color: '#64748B', bar: 1 },
};

type EconFilter = 'all' | 'high' | 'upcoming';

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Importance Bars ─────────────────────────────────────
function ImportanceBar({ level }: { level: 'high' | 'medium' | 'low' }) {
  const config = IMPORTANCE_CONFIG[level];
  const bars = [1, 2, 3];
  return (
    <View style={impStyles.barRow}>
      {bars.map((_, i) => (
        <View key={i} style={[
          impStyles.bar,
          { backgroundColor: i < config.bar ? config.color : '#333' },
        ]} />
      ))}
    </View>
  );
}

const impStyles = StyleSheet.create({
  barRow: { flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  bar: { width: 4, height: 10, borderRadius: 2 },
});

// ─── Event Card ──────────────────────────────────────────
function EventCard({ event, onPress, colors }: {
  event: EconomicEvent; onPress: () => void; colors: any;
}) {
  const catConfig = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other;
  const impConfig = IMPORTANCE_CONFIG[event.importance];
  const hasActual = event.isCompleted && event.actual;
  const isPositive = event.impact === 'positive';
  const isNegative = event.impact === 'negative';

  return (
    <AnimatedPressable onPress={onPress} haptic="light" scaleTo={0.98}>
      <View style={[eventStyles.card, {
        backgroundColor: colors.bgCard,
        borderColor: colors.border,
        borderLeftColor: impConfig.color,
        borderLeftWidth: 3,
      }]}>
        {/* Top Row */}
        <View style={eventStyles.topRow}>
          <View style={eventStyles.catIcon}>
            <Ionicons name={catConfig.icon as any} size={14} color={impConfig.color} />
          </View>
          <Text style={[eventStyles.catLabel, { color: colors.textMuted }]}>{catConfig.label}</Text>
          <ImportanceBar level={event.importance} />
          <View style={{ flex: 1 }} />
          {event.isCompleted ? (
            <View style={[eventStyles.statusBadge, { backgroundColor: colors.bgCardLight }]}>
              <Text style={[eventStyles.statusText, { color: colors.textMuted }]}>Completed</Text>
            </View>
          ) : (
            <View style={[eventStyles.statusBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[eventStyles.statusText, { color: colors.primary }]}>Upcoming</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={[eventStyles.title, { color: colors.text }]} numberOfLines={2}>{event.title}</Text>
        <Text style={[eventStyles.country, { color: colors.textSecondary }]}>
          {event.country} · {event.time} {event.timezone}
        </Text>

        {/* Data Row */}
        <View style={[eventStyles.dataRow, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
          <View style={eventStyles.dataItem}>
            <Text style={[eventStyles.dataLabel, { color: colors.textMuted }]}>Previous</Text>
            <Text style={[eventStyles.dataValue, { color: colors.text }]}>{event.previous}</Text>
          </View>
          {!event.isCompleted && (
            <View style={eventStyles.dataItem}>
              <Text style={[eventStyles.dataLabel, { color: colors.textMuted }]}>Forecast</Text>
              <Text style={[eventStyles.dataValue, { color: colors.warning }]}>{event.forecast}</Text>
            </View>
          )}
          {hasActual && (
            <View style={eventStyles.dataItem}>
              <Text style={[eventStyles.dataLabel, { color: colors.textMuted }]}>Actual</Text>
              <Text style={[eventStyles.dataValue, {
                color: isPositive ? colors.marketUp : isNegative ? colors.marketDown : colors.text,
              }]}>{event.actual}</Text>
            </View>
          )}
          <View style={eventStyles.dataItem}>
            <View style={[eventStyles.impactBadge, {
              backgroundColor: isPositive ? colors.marketUp + '20' : isNegative ? colors.marketDown + '20' : colors.bgInput,
            }]}>
              <Ionicons
                name={isPositive ? 'trending-up' : isNegative ? 'trending-down' : 'remove'}
                size={10}
                color={isPositive ? colors.marketUp : isNegative ? colors.marketDown : colors.textMuted}
              />
              <Text style={[eventStyles.impactText, {
                color: isPositive ? colors.marketUp : isNegative ? colors.marketDown : colors.textMuted,
                fontSize: 9,
              }]}>
                {hasActual ? event.impact : 'Pending'}
              </Text>
            </View>
          </View>
        </View>

        {/* Affected Assets */}
        {event.affectedAssets.length > 0 && (
          <View style={eventStyles.assetsRow}>
            {event.affectedAssets.map((asset, i) => (
              <View key={i} style={[eventStyles.assetChip, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
                <Text style={[eventStyles.assetText, { color: colors.textSecondary }]}>{asset}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

const eventStyles = StyleSheet.create({
  card: {
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
    marginBottom: SPACING.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  catIcon: { width: 24, height: 24, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  catLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  statusText: { fontSize: 9, fontWeight: '700' },
  title: { fontSize: 15, fontWeight: '700', lineHeight: 20, marginBottom: 4 },
  country: { fontSize: 11, fontWeight: '500', marginBottom: SPACING.sm },
  dataRow: {
    flexDirection: 'row', borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  dataItem: { flex: 1, alignItems: 'center' },
  dataLabel: { fontSize: 9, fontWeight: '500', marginBottom: 2, textTransform: 'uppercase' },
  dataValue: { fontSize: 14, fontWeight: '700' },
  impactBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  impactText: { fontWeight: '600' },
  assetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  assetChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BORDER_RADIUS.sm, borderWidth: 1 },
  assetText: { fontSize: 10, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});

// ─── Event Detail ────────────────────────────────────────
function EventDetailModal({ event, visible, onClose, colors }: {
  event: EconomicEvent | null; visible: boolean; onClose: () => void; colors: any;
}) {
  if (!event || !visible) return null;
  const catConfig = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.other;
  const impConfig = IMPORTANCE_CONFIG[event.importance];
  const isPositive = event.impact === 'positive';
  const isNegative = event.impact === 'negative';

  return (
    <View style={[modalStyles.overlay, { backgroundColor: colors.bgOverlay }]}>
      <View style={[modalStyles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {/* Header */}
        <View style={modalStyles.header}>
          <Text style={[modalStyles.title, { color: colors.text }]}>{event.title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Meta */}
          <View style={modalStyles.metaRow}>
            <View style={[modalStyles.metaChip, { backgroundColor: impConfig.color + '20' }]}>
              <Text style={[modalStyles.metaText, { color: impConfig.color }]}>
                {event.importance.toUpperCase()}
              </Text>
            </View>
            <View style={[modalStyles.metaChip, { backgroundColor: colors.bgCardLight }]}>
              <Ionicons name={catConfig.icon as any} size={12} color={colors.textSecondary} />
              <Text style={[modalStyles.metaText, { color: colors.textSecondary }]}>{catConfig.label}</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={[modalStyles.desc, { color: colors.textSecondary }]}>{event.description}</Text>

          {/* Country & Time */}
          <View style={[modalStyles.infoRow, { borderBottomColor: colors.divider }]}>
            <Text style={[modalStyles.infoLabel, { color: colors.textMuted }]}>Country</Text>
            <Text style={[modalStyles.infoValue, { color: colors.text }]}>{event.country}</Text>
          </View>
          <View style={[modalStyles.infoRow, { borderBottomColor: colors.divider }]}>
            <Text style={[modalStyles.infoLabel, { color: colors.textMuted }]}>Date & Time</Text>
            <Text style={[modalStyles.infoValue, { color: colors.text }]}>
              {formatDate(event.date)} · {event.time} {event.timezone}
            </Text>
          </View>
          <View style={[modalStyles.infoRow, { borderBottomColor: colors.divider }]}>
            <Text style={[modalStyles.infoLabel, { color: colors.textMuted }]}>Previous</Text>
            <Text style={[modalStyles.infoValue, { color: colors.text }]}>{event.previous}</Text>
          </View>
          <View style={[modalStyles.infoRow, { borderBottomColor: colors.divider }]}>
            <Text style={[modalStyles.infoLabel, { color: colors.textMuted }]}>Forecast</Text>
            <Text style={[modalStyles.infoValue, { color: colors.warning }]}>{event.forecast}</Text>
          </View>
          {event.actual && (
            <View style={[modalStyles.infoRow, { borderBottomColor: colors.divider }]}>
              <Text style={[modalStyles.infoLabel, { color: colors.textMuted }]}>Actual</Text>
              <Text style={[modalStyles.infoValue, {
                color: isPositive ? colors.marketUp : isNegative ? colors.marketDown : colors.text,
              }]}>{event.actual}</Text>
            </View>
          )}

          {/* Affected Assets */}
          <Text style={[modalStyles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
            Affected Assets
          </Text>
          <View style={modalStyles.assetsGrid}>
            {event.affectedAssets.map((asset, i) => (
              <View key={i} style={[modalStyles.assetChip, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
                <Text style={[modalStyles.assetText, { color: colors.text }]}>{asset}</Text>
              </View>
            ))}
          </View>

          {/* Source */}
          <Text style={[modalStyles.source, { color: colors.textMuted }]}>Source: {event.source}</Text>
          {event.notes && (
            <View style={[modalStyles.notesBox, { backgroundColor: colors.bgCardLight, borderLeftColor: colors.primary }]}>
              <Text style={[modalStyles.notesText, { color: colors.textSecondary }]}>{event.notes}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 100 },
  container: {
    maxHeight: '85%', borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl,
    borderWidth: 1, borderBottomWidth: 0, padding: SPACING.xl,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  title: { fontSize: 18, fontWeight: '700', flex: 1, marginRight: SPACING.md },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  metaText: { fontSize: 10, fontWeight: '700' },
  desc: { fontSize: 13, lineHeight: 20, marginBottom: SPACING.lg },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, fontWeight: '500' },
  infoValue: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: SPACING.sm },
  assetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.lg },
  assetChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.sm, borderWidth: 1 },
  assetText: { fontSize: 11, fontWeight: '600' },
  source: { fontSize: 11, fontWeight: '500', marginBottom: SPACING.md },
  notesBox: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderLeftWidth: 3, marginBottom: SPACING.lg },
  notesText: { fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
});

// ─── Main Screen ──────────────────────────────────────────
export default function EconomicCalendarScreen({ _navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<EconFilter>('all');
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Group events by date
  const groupedEvents = useMemo(() => {
    let events = [...mockEconomicEvents];
    if (activeFilter === 'high') events = events.filter(e => e.importance === 'high');
    if (activeFilter === 'upcoming') events = events.filter(e => !e.isCompleted);

    const groups: { date: string; events: EconomicEvent[] }[] = [];
    events.forEach(e => {
      const existing = groups.find(g => g.date === e.date);
      if (existing) existing.events.push(e);
      else groups.push({ date: e.date, events: [e] });
    });

    // Sort by date
    groups.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return groups;
  }, [activeFilter]);

  const openDetail = useCallback((event: EconomicEvent) => {
    setSelectedEvent(event);
    setShowDetail(true);
  }, []);

  const upcomingCount = mockEconomicEvents.filter(e => !e.isCompleted).length;
  const highCount = mockEconomicEvents.filter(e => e.importance === 'high').length;

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[screenStyles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[screenStyles.title, { color: colors.text }]}>Economic Calendar</Text>
        <Text style={[screenStyles.subtitle, { color: colors.textMuted }]}>
          {upcomingCount} upcoming events · {highCount} high impact
        </Text>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={screenStyles.filterRow}>
          <TouchableOpacity activeOpacity={0.7}
            style={[screenStyles.filterChip, {
              backgroundColor: activeFilter === 'all' ? colors.primary : colors.bgCardLight,
              borderColor: activeFilter === 'all' ? colors.primary : colors.border,
            }]}
            onPress={() => setActiveFilter('all')}>
            <Text style={[screenStyles.filterText, { color: activeFilter === 'all' ? '#FFFFFF' : colors.textSecondary }]}>
              All Events
            </Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}
            style={[screenStyles.filterChip, {
              backgroundColor: activeFilter === 'high' ? '#FF5252' : colors.bgCardLight,
              borderColor: activeFilter === 'high' ? '#FF5252' : colors.border,
            }]}
            onPress={() => setActiveFilter('high')}>
            <Ionicons name="alert-circle" size={14} color={activeFilter === 'high' ? '#FFFFFF' : '#FF5252'} />
            <Text style={[screenStyles.filterText, { color: activeFilter === 'high' ? '#FFFFFF' : '#FF5252' }]}>
              High Impact
            </Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}
            style={[screenStyles.filterChip, {
              backgroundColor: activeFilter === 'upcoming' ? colors.primary : colors.bgCardLight,
              borderColor: activeFilter === 'upcoming' ? colors.primary : colors.border,
            }]}
            onPress={() => setActiveFilter('upcoming')}>
            <Ionicons name="calendar" size={14} color={activeFilter === 'upcoming' ? '#FFFFFF' : colors.textSecondary} />
            <Text style={[screenStyles.filterText, { color: activeFilter === 'upcoming' ? '#FFFFFF' : colors.textSecondary }]}>
              Upcoming
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Event List */}
      {groupedEvents.length === 0 ? (
        <View style={screenStyles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
          <Text style={[screenStyles.emptyText, { color: colors.textMuted }]}>No events found</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={screenStyles.listContent}>
          {groupedEvents.map(group => (
            <View key={group.date}>
              {/* Date Header */}
              <View style={screenStyles.dateHeader}>
                <View style={[screenStyles.dateDot, { backgroundColor: colors.primary }]} />
                <Text style={[screenStyles.dateLabel, { color: colors.text }]}>
                  {formatDate(group.date)}
                </Text>
                <View style={[screenStyles.dateLine, { backgroundColor: colors.divider }]} />
              </View>

              {/* Events */}
              {group.events.map(event => (
                <EventCard key={event.id} event={event} colors={colors}
                  onPress={() => openDetail(event)} />
              ))}
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Detail Sheet */}
      {showDetail && selectedEvent && (
        <EventDetailModal event={selectedEvent} visible={showDetail}
          onClose={() => setShowDetail(false)} colors={colors} />
      )}
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
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BORDER_RADIUS.full, borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.md, marginTop: SPACING.sm },
  dateDot: { width: 10, height: 10, borderRadius: 5 },
  dateLabel: { fontSize: 14, fontWeight: '800' },
  dateLine: { flex: 1, height: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  emptyText: { fontSize: 16, fontWeight: '600' },
});
