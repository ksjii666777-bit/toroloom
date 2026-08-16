/**
 * Toroloom — Economic Calendar Screen
 *
 * Shows upcoming & released economic events (RBI, inflation, GDP, PMI, etc.)
 * with importance / category filters, grouped into timeline sections.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useT } from '../../hooks/useT';
import { useTheme } from '../../context/ThemeContext';
import { useEconomicCalendarStore } from '../../store/economicCalendarStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { EconomicEvent, RootStackParamList } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AppScreen from '../../components/ui/AppScreen';

// ─── Category metadata ───────────────────────────────────────────────────

interface CategoryMeta {
  labelKey: string;
  icon: string;
  color: string;
}

const CATEGORY_META: Record<EconomicEvent['category'], CategoryMeta> = {
  central_bank: { labelKey: 'economicCalendar.catCentralBank', icon: 'business', color: '#8B5CF6' },
  gdp: { labelKey: 'economicCalendar.catGdp', icon: 'stats-chart', color: '#3B82F6' },
  inflation: { labelKey: 'economicCalendar.catInflation', icon: 'trending-up', color: '#EF4444' },
  employment: { labelKey: 'economicCalendar.catEmployment', icon: 'briefcase', color: '#00E676' },
  trade: { labelKey: 'economicCalendar.catTrade', icon: 'globe', color: '#06B6D4' },
  fiscal: { labelKey: 'economicCalendar.catFiscal', icon: 'business-outline', color: '#F59E0B' },
  industry: { labelKey: 'economicCalendar.catIndustry', icon: 'construct', color: '#F97316' },
  consumer: { labelKey: 'economicCalendar.catConsumer', icon: 'cart', color: '#EC4899' },
  housing: { labelKey: 'economicCalendar.catHousing', icon: 'home', color: '#14B8A6' },
  other: { labelKey: 'economicCalendar.catOther', icon: 'ellipsis-horizontal', color: '#64748B' },
};

const IMPORTANCE_META = {
  high: { color: '#EF4444', bg: '#EF444415' },
  medium: { color: '#F59E0B', bg: '#F59E0B15' },
  low: { color: '#64748B', bg: '#64748B15' },
} as const;

function daysFromToday(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function formatEventDate(dateStr: string, t: (k: string, o?: any) => string): string {
  const days = daysFromToday(dateStr);
  if (days === 0) return t('economicCalendar.today');
  if (days === 1) return t('economicCalendar.tomorrow');
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Screen ──────────────────────────────────────────────────────────────

export default function EconomicCalendarScreen({ navigation: _navigation }: NativeStackScreenProps<RootStackParamList, 'EconomicCalendar'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const {
    events,
    summary,
    isLoading,
    dataSource,
    importanceFilter,
    categoryFilter,
    fetchEvents,
    setImportanceFilter,
    setCategoryFilter,
    clearFilters,
  } = useEconomicCalendarStore();

  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (importanceFilter !== 'all' && e.importance !== importanceFilter) return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      return true;
    });
  }, [events, importanceFilter, categoryFilter]);

  // Group filtered events into timeline sections
  const sections = useMemo(() => {
    const next7 = filtered.filter(e => !e.isCompleted && daysFromToday(e.date) >= 0 && daysFromToday(e.date) <= 7);
    const next30 = filtered.filter(e => !e.isCompleted && daysFromToday(e.date) > 7 && daysFromToday(e.date) <= 30);
    const later = filtered.filter(e => !e.isCompleted && daysFromToday(e.date) > 30);
    const past = filtered.filter(e => e.isCompleted || daysFromToday(e.date) < 0);

    const sortByDate = (arr: EconomicEvent[]) =>
      [...arr].sort((a, b) => a.date.localeCompare(b.date));

    return [
      { key: 'next7', label: t('economicCalendar.next7Days'), icon: 'flash' as const, events: sortByDate(next7) },
      { key: 'next30', label: t('economicCalendar.next30Days'), icon: 'calendar' as const, events: sortByDate(next30) },
      { key: 'later', label: t('economicCalendar.later'), icon: 'time' as const, events: sortByDate(later) },
      { key: 'past', label: t('economicCalendar.pastEvents'), icon: 'checkmark-done' as const, events: sortByDate(past).reverse() },
    ];
  }, [filtered, t]);

  const activeCategoryCount = categoryFilter ? 1 : 0;
  const hasFilters = importanceFilter !== 'all' || categoryFilter !== null;

  return (
    <AppScreen scroll={false} padded={false}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('economicCalendar.title')}</Text>
          {dataSource && (
            <View style={[styles.sourceBadge, { backgroundColor: dataSource === 'fmp' ? '#00E67615' : colors.bgCard, borderColor: dataSource === 'fmp' ? '#00E67640' : colors.border }]}>
              <View style={[styles.sourceDot, { backgroundColor: dataSource === 'fmp' ? '#00E676' : colors.textMuted }]} />
              <Text style={[styles.sourceText, { color: dataSource === 'fmp' ? '#00E676' : colors.textMuted }]}>
                {dataSource === 'fmp' ? t('economicCalendar.live') : t('economicCalendar.offlineData')}
              </Text>
            </View>
          )}
        </View>
        {hasFilters ? (
          <TouchableOpacity testID="econ-clear-filters" onPress={clearFilters} style={[styles.clearBtn, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="close" size={14} color={colors.primary} />
            <Text style={[styles.clearBtnText, { color: colors.primary }]}>{t('economicCalendar.clearFilters')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Overview stats bar */}
      <View style={[styles.overviewBar, { backgroundColor: colors.bgCard, borderColor: colors.border, marginHorizontal: SPACING.lg, marginTop: SPACING.md }]}>
        <View style={styles.overviewItem}>
          <Text style={[styles.overviewValue, { color: colors.primary }]}>{summary?.total ?? events.length}</Text>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>{t('economicCalendar.totalEvents')}</Text>
        </View>
        <View style={[styles.overviewDivider, { backgroundColor: colors.divider }]} />
        <View style={styles.overviewItem}>
          <Text style={[styles.overviewValue, { color: '#00E676' }]}>{summary?.upcoming ?? events.filter(e => !e.isCompleted).length}</Text>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>{t('economicCalendar.upcoming')}</Text>
        </View>
        <View style={[styles.overviewDivider, { backgroundColor: colors.divider }]} />
        <View style={styles.overviewItem}>
          <Text style={[styles.overviewValue, { color: '#EF4444' }]}>{summary?.byImportance?.high ?? events.filter(e => e.importance === 'high').length}</Text>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>{t('economicCalendar.highImportance')}</Text>
        </View>
        <View style={[styles.overviewDivider, { backgroundColor: colors.divider }]} />
        <View style={styles.overviewItem}>
          <Text style={[styles.overviewValue, { color: colors.text }]}>{summary?.released ?? events.filter(e => e.isCompleted).length}</Text>
          <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>{t('economicCalendar.released')}</Text>
        </View>
      </View>

      {/* Importance filter chips */}
      <View style={[styles.chipRow, { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md }]}>
        {(['all', 'high', 'medium', 'low'] as const).map(level => {
          const active = importanceFilter === level;
          const color = level === 'all' ? colors.primary : IMPORTANCE_META[level].color;
          return (
            <TouchableOpacity
              key={level}
              testID={`imp-filter-${level}`}
              style={[styles.chip, {
                backgroundColor: active ? color + '20' : colors.bgCard,
                borderColor: active ? color : colors.border,
              }]}
              onPress={() => setImportanceFilter(level)}
            >
              {level !== 'all' && <View style={[styles.chipDot, { backgroundColor: color }]} />}
              <Text style={[styles.chipText, { color: active ? color : colors.textMuted }]}>
                {t(`economicCalendar.${level === 'all' ? 'allImportance' : level + 'Importance'}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={[styles.catRow, { paddingHorizontal: SPACING.lg }]}
      >
        <TouchableOpacity
          style={[styles.catChip, {
            backgroundColor: categoryFilter === null ? colors.primary : colors.bgCard,
            borderColor: categoryFilter === null ? colors.primary : colors.border,
          }]}
          onPress={() => setCategoryFilter(null)}
        >
          <Ionicons name="apps" size={13} color={categoryFilter === null ? '#FFF' : colors.textMuted} />
          <Text style={[styles.catChipText, { color: categoryFilter === null ? '#FFF' : colors.textMuted }]}>
            {t('economicCalendar.allCategories')}
          </Text>
        </TouchableOpacity>
        {(Object.keys(CATEGORY_META) as EconomicEvent['category'][]).map(cat => {
          const meta = CATEGORY_META[cat];
          const active = categoryFilter === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, {
                backgroundColor: active ? meta.color + '20' : colors.bgCard,
                borderColor: active ? meta.color : colors.border,
              }]}
              onPress={() => setCategoryFilter(active ? null : cat)}
            >
              <Ionicons name={meta.icon as any} size={13} color={active ? meta.color : colors.textMuted} />
              <Text style={[styles.catChipText, { color: active ? meta.color : colors.textMuted }]}>
                {t(meta.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Body */}
      {isLoading && events.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('economicCalendar.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconRing, { borderColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('economicCalendar.noEvents')}</Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                {t('economicCalendar.noEventsDesc')}
              </Text>
              {hasFilters && (
                <TouchableOpacity
                  style={[styles.browseBtn, { backgroundColor: colors.primary }]}
                  onPress={clearFilters}
                >
                  <Ionicons name="close" size={16} color="#FFF" />
                  <Text style={styles.browseBtnText}>{t('economicCalendar.clearFilters')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {/* Section count */}
              <Text style={[styles.resultCount, { color: colors.textMuted }]}>
                {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
                {activeCategoryCount > 0 ? ` · ${t('economicCalendar.filters')}` : ''}
              </Text>

              {/* Timeline sections */}
              {sections.map(section => {
                if (section.events.length === 0) return null;
                return (
                  <View key={section.key} style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name={section.icon} size={14} color={colors.primary} />
                      </View>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.label}</Text>
                      <View style={[styles.sectionCount, { backgroundColor: colors.primary + '15' }]}>
                        <Text style={[styles.sectionCountText, { color: colors.primary }]}>{section.events.length}</Text>
                      </View>
                    </View>

                    {section.events.map(event => (
                      <EventCard
                        key={event.id}
                        event={event}
                        t={t}
                        colors={colors}
                        onPress={() => setSelectedEvent(event)}
                      />
                    ))}
                  </View>
                );
              })}

              <Text style={[styles.disclaimer, { color: colors.textMuted }]}>{t('economicCalendar.disclaimer')}</Text>
            </>
          )}
        </ScrollView>
      )}

      {/* Event detail modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          t={t}
          colors={colors}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </AppScreen>
  );
}

// ─── Event Card ──────────────────────────────────────────────────────────

function EventCard({
  event,
  t,
  colors,
  onPress,
}: {
  event: EconomicEvent;
  t: (k: string, o?: any) => string;
  colors: any;
  onPress: () => void;
}) {
  const meta = CATEGORY_META[event.category] || CATEGORY_META.other;
  const imp = IMPORTANCE_META[event.importance] || IMPORTANCE_META.low;
  const days = daysFromToday(event.date);
  const isUpcoming = !event.isCompleted && days >= 0;

  return (
    <TouchableOpacity
      testID={`event-card-${event.id}`}
      style={[styles.eventCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left accent + date */}
      <View style={[styles.eventDateCol, { borderLeftColor: imp.color }]}>
        <View style={[styles.eventDateBadge, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Text style={[styles.eventDateText, { color: colors.text }]}>{formatEventDate(event.date, t)}</Text>
          <Text style={[styles.eventTimeText, { color: colors.textMuted }]}>
            {event.time} {event.timezone}
          </Text>
        </View>
        {isUpcoming && days <= 7 && (
          <View style={[styles.countdownBadge, { backgroundColor: imp.bg }]}>
            <Ionicons name="time-outline" size={10} color={imp.color} />
            <Text style={[styles.countdownText, { color: imp.color }]}>{t('economicCalendar.countdown', { count: days })}</Text>
          </View>
        )}
        {event.isCompleted && (
          <View style={[styles.releasedBadge, { backgroundColor: '#00E67615' }]}>
            <Ionicons name="checkmark" size={10} color="#00E676" />
            <Text style={[styles.releasedText, { color: '#00E676' }]}>{t('economicCalendar.releasedLabel')}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.eventContent}>
        <View style={styles.eventTopRow}>
          <View style={[styles.catIcon, { backgroundColor: meta.color + '20' }]}>
            <Ionicons name={meta.icon as any} size={14} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={2}>{event.title}</Text>
            <Text style={[styles.eventMeta, { color: colors.textMuted }]}>
              {event.country} · {t(meta.labelKey)}
            </Text>
          </View>
          <View style={[styles.impBadge, { backgroundColor: imp.bg }]}>
            <View style={[styles.impDot, { backgroundColor: imp.color }]} />
          </View>
        </View>

        {/* Values row */}
        <View style={[styles.valuesRow, { borderTopColor: colors.divider }]}>
          {event.actual !== undefined ? (
            <View style={styles.valueItem}>
              <Text style={[styles.valueLabel, { color: colors.textMuted }]}>{t('economicCalendar.actual')}</Text>
              <Text style={[styles.valueText, { color: '#00E676' }]}>{event.actual}</Text>
            </View>
          ) : (
            <View style={styles.valueItem}>
              <Text style={[styles.valueLabel, { color: colors.textMuted }]}>{t('economicCalendar.forecast')}</Text>
              <Text style={[styles.valueText, { color: colors.primary }]}>{event.forecast || '—'}</Text>
            </View>
          )}
          <View style={[styles.valueDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.valueItem}>
            <Text style={[styles.valueLabel, { color: colors.textMuted }]}>{t('economicCalendar.previous')}</Text>
            <Text style={[styles.valueText, { color: colors.text }]}>{event.previous || '—'}</Text>
          </View>
          <View style={[styles.valueDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.valueItem}>
            <Text style={[styles.valueLabel, { color: colors.textMuted }]}>{t('economicCalendar.impact')}</Text>
            <Text style={[styles.valueText, { color: imp.color }]}>
              {event.actual !== undefined
                ? event.impact === 'positive' ? '+' : event.impact === 'negative' ? '−' : '='
                : '—'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Event Detail Modal ──────────────────────────────────────────────────

function EventDetailModal({
  event,
  t,
  colors,
  onClose,
}: {
  event: EconomicEvent;
  t: (k: string, o?: any) => string;
  colors: any;
  onClose: () => void;
}) {
  const meta = CATEGORY_META[event.category] || CATEGORY_META.other;
  const imp = IMPORTANCE_META[event.importance] || IMPORTANCE_META.low;

  return (
    <View style={styles.modalOverlay}>
      <TouchableOpacity style={styles.modalBackdrop} onPress={onClose} activeOpacity={1} />
      <View style={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.modalHeader}>
          <View style={[styles.catIcon, { backgroundColor: meta.color + '20' }]}>
            <Ionicons name={meta.icon as any} size={18} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalCat, { color: meta.color }]}>{t(meta.labelKey)}</Text>
            <Text style={[styles.modalImportance, { color: imp.color }]}>
              {t(`economicCalendar.${event.importance}Importance`)} · {event.country}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: colors.bgSecondary }]}>
            <Ionicons name="close" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.modalTitle, { color: colors.text }]}>{event.title}</Text>
        <Text style={[styles.modalDate, { color: colors.textMuted }]}>
          {formatEventDate(event.date, t)} · {event.time} {event.timezone} · {event.source}
        </Text>

        <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>{event.description}</Text>

        {/* Values */}
        <View style={[styles.modalValues, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <View style={styles.modalValueItem}>
            <Text style={[styles.modalValueLabel, { color: colors.textMuted }]}>{t('economicCalendar.previous')}</Text>
            <Text style={[styles.modalValueText, { color: colors.text }]}>{event.previous || '—'}</Text>
          </View>
          <View style={[styles.modalValueDivider, { backgroundColor: colors.divider }]} />
          <View style={styles.modalValueItem}>
            <Text style={[styles.modalValueLabel, { color: colors.textMuted }]}>{t('economicCalendar.forecast')}</Text>
            <Text style={[styles.modalValueText, { color: colors.primary }]}>{event.forecast || '—'}</Text>
          </View>
          {event.actual !== undefined && (
            <>
              <View style={[styles.modalValueDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.modalValueItem}>
                <Text style={[styles.modalValueLabel, { color: colors.textMuted }]}>{t('economicCalendar.actual')}</Text>
                <Text style={[styles.modalValueText, { color: '#00E676' }]}>{event.actual}</Text>
              </View>
            </>
          )}
        </View>

        {/* Affected assets */}
        {event.affectedAssets.length > 0 && (
          <View style={styles.modalAssets}>
            <Text style={[styles.modalAssetsLabel, { color: colors.textMuted }]}>{t('economicCalendar.affectedAssets')}</Text>
            <View style={styles.modalAssetsRow}>
              {event.affectedAssets.map(asset => (
                <View key={asset} style={[styles.assetChip, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                  <Text style={[styles.assetChipText, { color: colors.text }]}>{asset}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {event.notes && (
          <View style={[styles.modalNotes, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
            <Ionicons name="information-circle" size={14} color={colors.primary} />
            <Text style={[styles.modalNotesText, { color: colors.textSecondary }]}>{event.notes}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.modalDoneBtn, { backgroundColor: colors.primary }]} onPress={onClose}>
          <Text style={styles.modalDoneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontSize: FONTS.size.xl,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  sourceDot: { width: 5, height: 5, borderRadius: 2.5 },
  sourceText: {
    fontSize: 9,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  clearBtnText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },

  // Overview
  overviewBar: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewValue: {
    fontSize: FONTS.size.xl,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
  },
  overviewLabel: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    marginTop: 2,
  },
  overviewDivider: { width: 1, height: 32, marginHorizontal: 4 },

  // Chips
  chipRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  catRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  catChipText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },

  // Body
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
    paddingBottom: 80,
  },
  loadingText: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.regular.fontFamily,
  },
  scrollContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  resultCount: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },

  // Sections
  section: { gap: SPACING.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
    flex: 1,
  },
  sectionCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  sectionCountText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },

  // Event card
  eventCard: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  eventDateCol: {
    width: 86,
    borderLeftWidth: 3,
    padding: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  eventDateBadge: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    width: '100%',
  },
  eventDateText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
    textAlign: 'center',
  },
  eventTimeText: {
    fontSize: 9,
    fontFamily: FONTS.regular.fontFamily,
    marginTop: 1,
    textAlign: 'center',
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  countdownText: { fontSize: 9, fontWeight: '700' },
  releasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  releasedText: { fontSize: 9, fontWeight: '700' },

  eventContent: {
    flex: 1,
    padding: SPACING.md,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  catIcon: {
    width: 30,
    height: 30,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventTitle: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
    lineHeight: 17,
  },
  eventMeta: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    marginTop: 2,
  },
  impBadge: {
    width: 22,
    height: 22,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  impDot: { width: 8, height: 8, borderRadius: 4 },

  valuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  valueItem: { flex: 1, alignItems: 'center' },
  valueLabel: {
    fontSize: 9,
    fontFamily: FONTS.regular.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueText: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
    marginTop: 2,
  },
  valueDivider: { width: 1, height: 24 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.md,
  },
  emptyIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: FONTS.size.xl,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
  },
  emptyDesc: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.regular.fontFamily,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.xl,
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  browseBtnText: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
    color: '#FFF',
  },

  disclaimer: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: SPACING.md,
  },

  // Modal
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalCard: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl + 24,
    gap: SPACING.md,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  modalCat: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalImportance: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    marginTop: 1,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: FONTS.size.xl,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
    lineHeight: 24,
  },
  modalDate: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
  },
  modalDesc: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.regular.fontFamily,
    lineHeight: 20,
  },
  modalValues: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
  },
  modalValueItem: { flex: 1, alignItems: 'center' },
  modalValueLabel: {
    fontSize: 9,
    fontFamily: FONTS.regular.fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalValueText: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
    marginTop: 3,
  },
  modalValueDivider: { width: 1, height: 28 },
  modalAssets: { gap: SPACING.sm },
  modalAssetsLabel: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },
  modalAssetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  assetChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  assetChipText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },
  modalNotes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  modalNotesText: {
    flex: 1,
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    lineHeight: 16,
  },
  modalDoneBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.sm,
  },
  modalDoneText: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
    color: '#FFF',
  },
});
