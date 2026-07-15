/**
 * Toroloom — IPO Calendar Screen
 * Shows all IPOs in a timeline/calendar view with upcoming, open, closed, and listed sections.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useIPOStore } from '../../store/ipoStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import type { IPOItem } from '../../types';

const { width } = Dimensions.get('window');

type CalendarTab = 'timeline' | 'stats';

const seasonData = [
  { month: 'May 2026', count: 18, totalRaised: '₹42,500 Cr' },
  { month: 'Jun 2026', count: 12, totalRaised: '₹28,000 Cr' },
  { month: 'Jul 2026', count: 8, totalRaised: '₹15,300 Cr' },
];

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function IPOCalendarScreen({ navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { ipos } = useIPOStore();
  const [activeTab, setActiveTab] = useState<CalendarTab>('timeline');

  // Group IPOs by status
  const grouped = useMemo(() => {
    const groups: Record<string, IPOItem[]> = {
      open: [],
      listing_today: [],
      upcoming: [],
      closed: [],
      listed: [],
    };
    for (const ipo of ipos) {
      if (groups[ipo.subscriptionStatus]) {
        groups[ipo.subscriptionStatus].push(ipo);
      } else {
        groups.listed.push(ipo);
      }
    }
    // Sort within each group
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => new Date(a.openDate).getTime() - new Date(b.openDate).getTime());
    }
    return groups;
  }, [ipos]);

  const stats = useMemo(() => {
    const currentMonth = ipos.filter(i => {
      const d = new Date(i.openDate);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return {
      totalIpos: ipos.length,
      thisMonth: currentMonth.length,
      totalRaised: ipos.reduce((s, i) => s + i.issueSize, 0),
      avgGmp: ipos.filter(i => i.gmp > 0).reduce((s, i) => s + i.gmpPercent, 0) / Math.max(ipos.filter(i => i.gmp > 0).length, 1),
      avgSub: ipos.reduce((s, i) => s + i.subscriptionTotal, 0) / Math.max(ipos.length, 1),
    };
  }, [ipos]);

  const timelineSections: { key: string; label: string; icon: string; color: string; bgColor: string }[] = [
    { key: 'listing_today', label: 'Listing Today', icon: 'rocket', color: '#8B5CF6', bgColor: '#8B5CF615' },
    { key: 'open', label: 'Open Now', icon: 'pricetag', color: '#00E676', bgColor: '#00E67615' },
    { key: 'upcoming', label: 'Upcoming', icon: 'calendar', color: '#3B82F6', bgColor: '#3B82F615' },
    { key: 'closed', label: 'Closed', icon: 'lock-closed', color: '#FFAB40', bgColor: '#FFAB4015' },
    { key: 'listed', label: 'Listed', icon: 'checkmark-circle', color: '#64748B', bgColor: '#64748B15' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => nav.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>IPO Calendar</Text>
        <TouchableOpacity
          style={[styles.dashBtn, { backgroundColor: colors.primary + '20' }]}
          onPress={() => nav.navigate('IPODashboard' as never)}
        >
          <Ionicons name="grid-outline" size={16} color={colors.primary} />
          <Text style={[styles.dashBtnText, { color: colors.primary }]}>Dashboard</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Toggle */}
      <View style={[styles.tabRow, { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'timeline' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('timeline')}
        >
          <Ionicons name="calendar" size={14} color={activeTab === 'timeline' ? '#FFF' : colors.textMuted} />
          <Text style={[styles.tabText, { color: activeTab === 'timeline' ? '#FFF' : colors.textMuted }]}>Timeline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'stats' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('stats')}
        >
          <Ionicons name="analytics" size={14} color={activeTab === 'stats' ? '#FFF' : colors.textMuted} />
          <Text style={[styles.tabText, { color: activeTab === 'stats' ? '#FFF' : colors.textMuted }]}>Market Stats</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {activeTab === 'timeline' ? (
          /* ══ TIMELINE VIEW ══ */
          <>
            {/* Quick overview bar */}
            <View style={[styles.overviewBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.overviewItem}>
                <Text style={[styles.overviewValue, { color: colors.primary }]}>{ipos.length}</Text>
                <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Total IPOs</Text>
              </View>
              <View style={[styles.overviewDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.overviewItem}>
                <Text style={[styles.overviewValue, { color: '#00E676' }]}>
                  {grouped.open.length + grouped.listing_today.length}
                </Text>
                <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Active</Text>
              </View>
              <View style={[styles.overviewDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.overviewItem}>
                <Text style={[styles.overviewValue, { color: '#3B82F6' }]}>{grouped.upcoming.length}</Text>
                <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Upcoming</Text>
              </View>
              <View style={[styles.overviewDivider, { backgroundColor: colors.divider }]} />
              <View style={styles.overviewItem}>
                <Text style={[styles.overviewValue, { color: colors.text }]}>{grouped.listed.length}</Text>
                <Text style={[styles.overviewLabel, { color: colors.textMuted }]}>Listed</Text>
              </View>
            </View>

            {/* Timeline sections */}
            {timelineSections.map(section => {
              const items = grouped[section.key];
              if (!items || items.length === 0) return null;

              return (
                <View key={section.key} style={styles.timelineSection}>
                  {/* Section Header */}
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: section.bgColor }]}>
                      <Ionicons name={section.icon as any} size={16} color={section.color} />
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.label}</Text>
                    <View style={[styles.sectionCount, { backgroundColor: section.bgColor }]}>
                      <Text style={[styles.sectionCountText, { color: section.color }]}>{items.length}</Text>
                    </View>
                  </View>

                  {/* Timeline items */}
                  <View style={styles.timelineList}>
                    {items.map((ipo, idx) => {
                      const daysLeft = ipo.subscriptionStatus === 'upcoming'
                        ? daysUntil(ipo.openDate)
                        : ipo.subscriptionStatus === 'open'
                          ? daysUntil(ipo.closeDate)
                          : 0;
                      const isLast = idx === items.length - 1;

                      return (
                        <TouchableOpacity
                          key={ipo.id}
                          style={[styles.timelineItem, { borderLeftColor: section.color }]}
                          onPress={() => nav.navigate('IPODashboard' as never)}
                          activeOpacity={0.7}
                        >
                          {/* Timeline dot */}
                          <View style={[styles.timelineDot, { backgroundColor: section.color }]} />

                          {/* Date badge */}
                          <View style={[styles.dateBadge, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                            <Text style={[styles.dateDay, { color: colors.text }]}>
                              {new Date(ipo.openDate).getDate()}
                            </Text>
                            <Text style={[styles.dateMonth, { color: colors.textMuted }]}>
                              {new Date(ipo.openDate).toLocaleDateString('en-IN', { month: 'short' })}
                            </Text>
                          </View>

                          {/* Content */}
                          <View style={[styles.timelineContent, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                            <View style={styles.timelineTop}>
                              <View style={[styles.timelineLogo, { backgroundColor: section.bgColor }]}>
                                <Text style={[styles.timelineLogoText, { color: section.color }]}>{ipo.logo}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.timelineName, { color: colors.text }]} numberOfLines={1}>{ipo.companyName}</Text>
                                <Text style={[styles.timelineSector, { color: colors.textMuted }]}>{ipo.sector}</Text>
                              </View>
                            </View>

                            <View style={styles.timelineInfo}>
                              <View style={styles.timelineInfoRow}>
                                <Text style={[styles.timelineInfoLabel, { color: colors.textMuted }]}>Band</Text>
                                <Text style={[styles.timelineInfoValue, { color: colors.text }]}>
                                  ₹{ipo.priceBand.min}–{ipo.priceBand.max}
                                </Text>
                              </View>
                              {ipo.gmp > 0 && (
                                <View style={styles.timelineInfoRow}>
                                  <Text style={[styles.timelineInfoLabel, { color: colors.textMuted }]}>GMP</Text>
                                  <Text style={[styles.timelineInfoValue, { color: '#00E676' }]}>
                                    +₹{ipo.gmp} ({ipo.gmpPercent.toFixed(1)}%)
                                  </Text>
                                </View>
                              )}
                              <View style={styles.timelineInfoRow}>
                                <Text style={[styles.timelineInfoLabel, { color: colors.textMuted }]}>Issue</Text>
                                <Text style={[styles.timelineInfoValue, { color: colors.text }]}>
                                  ₹{ipo.issueSize.toLocaleString('en-IN')} Cr
                                </Text>
                              </View>
                            </View>

                            {/* Days countdown */}
                            {daysLeft > 0 && (
                              <View style={[styles.countdownBadge, { backgroundColor: section.bgColor }]}>
                                <Ionicons name="time-outline" size={11} color={section.color} />
                                <Text style={[styles.countdownText, { color: section.color }]}>
                                  {ipo.subscriptionStatus === 'open'
                                    ? `${daysLeft}d left`
                                    : `Opens in ${daysLeft}d`}
                                </Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Monthly overview */}
            <View style={[styles.seasonCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.seasonTitle, { color: colors.text }]}>Monthly IPO Activity</Text>
              {seasonData.map((m, i) => (
                <View key={m.month} style={[styles.seasonRow, i < seasonData.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                  <Text style={[styles.seasonMonth, { color: colors.text }]}>{m.month}</Text>
                  <View style={styles.seasonBar}>
                    <View style={[styles.seasonBarFill, {
                      width: `${(m.count / seasonData[0].count) * 100}%`,
                      backgroundColor: colors.primary,
                    }]} />
                  </View>
                  <Text style={[styles.seasonCount, { color: colors.text }]}>{m.count}</Text>
                  <Text style={[styles.seasonRaised, { color: colors.textMuted }]}>{m.totalRaised}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          /* ══ MARKET STATS VIEW ══ */
          <>
            {/* Key stats grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="rocket" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalIpos}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total IPOs</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: '#00E67620' }]}>
                  <Ionicons name="calendar" size={20} color="#00E676" />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.thisMonth}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>This Month</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: '#FFC10720' }]}>
                  <Ionicons name="cash" size={20} color="#FFC107" />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  ₹{(stats.totalRaised / 1000).toFixed(1)}K Cr
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Raised</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={[styles.statIcon, { backgroundColor: '#00E67620' }]}>
                  <Ionicons name="trending-up" size={20} color="#00E676" />
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {stats.avgGmp.toFixed(1)}%
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Avg GMP</Text>
              </View>
            </View>

            {/* Performance by status */}
            {['open', 'upcoming', 'listed'].map(status => {
              const items = grouped[status];
              if (!items || items.length === 0) return null;
              const avgSub = items.reduce((s, i) => s + i.subscriptionTotal, 0) / items.length;
              const avgGmp = items.filter(i => i.gmp > 0).reduce((s, i) => s + i.gmpPercent, 0) / Math.max(items.filter(i => i.gmp > 0).length, 1);

              return (
                <View key={status} style={[styles.statusCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.statusHeader}>
                    <StatusDot status={status} />
                    <Text style={[styles.statusTitle, { color: colors.text }]}>
                      {status === 'open' ? 'Open IPOs' : status === 'upcoming' ? 'Upcoming IPOs' : 'Listed IPOs'}
                    </Text>
                    <Text style={[styles.statusCount, { color: colors.textMuted }]}>{items.length}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <View style={styles.statusStat}>
                      <Text style={[styles.statusStatValue, { color: colors.text }]}>{avgSub.toFixed(1)}x</Text>
                      <Text style={[styles.statusStatLabel, { color: colors.textMuted }]}>Avg Sub</Text>
                    </View>
                    <View style={[styles.statusDivider, { backgroundColor: colors.divider }]} />
                    <View style={styles.statusStat}>
                      <Text style={[styles.statusStatValue, { color: '#00E676' }]}>
                        {avgGmp > 0 ? `+${avgGmp.toFixed(1)}%` : '—'}
                      </Text>
                      <Text style={[styles.statusStatLabel, { color: colors.textMuted }]}>Avg GMP</Text>
                    </View>
                    <View style={[styles.statusDivider, { backgroundColor: colors.divider }]} />
                    <View style={styles.statusStat}>
                      <Text style={[styles.statusStatValue, { color: colors.text }]}>
                        ₹{(items.reduce((s, i) => s + i.issueSize, 0) / items.length / 1000).toFixed(1)}K Cr
                      </Text>
                      <Text style={[styles.statusStatLabel, { color: colors.textMuted }]}>Avg Size</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Monthly seasonality chart */}
            <View style={[styles.seasonCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.seasonTitle, { color: colors.text }]}>Raised by Month</Text>
              {seasonData.map((m, i) => (
                <View key={m.month} style={[styles.seasonRow, i < seasonData.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                  <Text style={[styles.seasonMonth, { color: colors.text }]}>{m.month}</Text>
                  <View style={styles.seasonBar}>
                    <LinearGradient
                      colors={[colors.primary, colors.accent]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.seasonFillGradient, {
                        width: `${(m.count / seasonData[0].count) * 100}%`,
                      }]}
                    />
                  </View>
                  <Text style={[styles.seasonCount, { color: colors.text }]}>{m.count}</Text>
                  <Text style={[styles.seasonRaised, { color: colors.textMuted }]}>{m.totalRaised}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    open: '#00E676',
    upcoming: '#3B82F6',
    closed: '#FFAB40',
    listed: '#64748B',
    listing_today: '#8B5CF6',
  };
  return <View style={[styles.statusDot, { backgroundColor: colorMap[status] || '#64748B' }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  headerTitle: {
    fontSize: FONTS.size.xl,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  dashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  dashBtnText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  scrollContent: { padding: SPACING.lg, gap: 16 },

  // Overview bar
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

  // Timeline
  timelineSection: { marginBottom: SPACING.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sectionIcon: {
    width: 32,
    height: 32,
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
  timelineList: {
    paddingLeft: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 2,
    paddingLeft: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
    position: 'relative',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    left: -6,
    top: 16,
    zIndex: 1,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dateBadge: {
    width: 48,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    marginTop: 6,
  },
  dateDay: {
    fontSize: FONTS.size.lg,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
  },
  dateMonth: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },
  timelineContent: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  timelineTop: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  timelineLogo: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLogoText: { fontSize: 12, fontWeight: '800' },
  timelineName: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  timelineSector: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    marginTop: 1,
  },
  timelineInfo: { gap: 3 },
  timelineInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineInfoLabel: { fontSize: 10, fontWeight: '500' },
  timelineInfoValue: { fontSize: 10, fontWeight: '700' },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  countdownText: { fontSize: 9, fontWeight: '700' },

  // Seasonality
  seasonCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  seasonTitle: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
    marginBottom: SPACING.md,
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  seasonMonth: {
    width: 80,
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },
  seasonBar: {
    flex: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  seasonBarFill: {
    height: '100%',
    borderRadius: 10,
  },
  seasonFillGradient: {
    height: '100%',
    borderRadius: 10,
  },
  seasonCount: {
    width: 30,
    textAlign: 'right',
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
  },
  seasonRaised: {
    width: 80,
    textAlign: 'right',
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statCard: {
    width: (width - 40 - 12) / 2,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONTS.size.xl,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
  },
  statLabel: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
  },

  // Status cards
  statusCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusTitle: {
    flex: 1,
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  statusCount: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusStat: { flex: 1, alignItems: 'center' },
  statusStatValue: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
  },
  statusStatLabel: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    marginTop: 2,
  },
  statusDivider: { width: 1, height: 28 },
});
