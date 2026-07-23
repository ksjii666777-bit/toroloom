/**
 * ============================================================================
 * Toroloom — Razorpay Webhook Health & Resilience Screen
 * ============================================================================
 *
 * Monitors Razorpay webhook events with:
 *   - Health stat cards (total, processed, failed, success rate)
 *   - Failure analysis dashboard
 *   - Recent webhook event log with status indicators
 *   - Failed events list with retry capability
 *   - Real-time refresh
 *
 * API Endpoints:
 *   GET  /api/webhooks/razorpay/health
 *   GET  /api/webhooks/razorpay/events
 *   GET  /api/webhooks/razorpay/recent-failures
 *   POST /api/webhooks/razorpay/retry/:eventId
 * ============================================================================
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { api } from '../../services/api';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { SkeletonBlock } from '../../components/ui/SkeletonLoader';

// ─── Types ──────────────────────────────────────────────────────────────

interface WebhookHealthResponse {
  available: boolean;
  total: number;
  received: number;
  processed: number;
  failed: number;
  duplicates: number;
  invalidSignatures: number;
  successRate: number;
  lastReceived: string | null;
  lastFailed: string | null;
  eventsByType: Record<string, number>;
  logSize: number;
  maxLogSize: number;
}

interface WebhookLogEntry {
  id: string;
  event: string;
  eventId: string;
  userId?: string;
  planId?: string;
  status: 'received' | 'processed' | 'failed' | 'duplicate' | 'invalid_signature';
  error?: string;
  durationMs: number;
  timestamp: string;
}

interface WebhookEventsResponse {
  events: WebhookLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

interface WebhookFailuresResponse {
  failures: WebhookLogEntry[];
  total: number;
}

// ─── Status Config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  processed: { label: 'Processed', icon: 'checkmark-circle', color: '#00C853' },
  received: { label: 'Received', icon: 'time', color: '#FFC107' },
  failed: { label: 'Failed', icon: 'close-circle', color: '#FF5252' },
  duplicate: { label: 'Duplicate', icon: 'copy', color: '#9E9E9E' },
  invalid_signature: { label: 'Invalid Sig', icon: 'shield-outline', color: '#FF6B6B' },
};

const EVENT_DISPLAY_NAMES: Record<string, string> = {
  'payment.captured': 'Payment Captured',
  'order.paid': 'Order Paid',
  'subscription.charged': 'Subscription Charged',
  'subscription.activated': 'Subscription Activated',
  'subscription.cancelled': 'Subscription Cancelled',
  'payment.failed': 'Payment Failed',
  'mandate.authorized': 'Mandate Authorized',
  'mandate.revoked': 'Mandate Revoked',
};

function getEventDisplay(event: string): string {
  return EVENT_DISPLAY_NAMES[event] || event;
}

function getEventIcon(event: string): string {
  if (event.includes('payment.captured') || event.includes('order.paid')) return 'card';
  if (event.includes('payment.failed')) return 'close-circle';
  if (event.includes('subscription')) return 'refresh';
  if (event.includes('mandate')) return 'link';
  return 'pulse';
}

function getEventColor(event: string): string {
  if (event.includes('payment.captured') || event.includes('order.paid')) return '#00C853';
  if (event.includes('payment.failed')) return '#FF5252';
  if (event.includes('subscription.charged') || event.includes('subscription.activated')) return '#3B82F6';
  if (event.includes('subscription.cancelled') || event.includes('mandate.revoked')) return '#FF6B6B';
  if (event.includes('mandate.authorized')) return '#8B5CF6';
  return '#9E9E9E';
}

// ─── Formatters ─────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function formatId(id: string): string {
  if (id.length <= 24) return id;
  return `${id.slice(0, 12)}...${id.slice(-8)}`;
}

// ═══════════════════════════════════════════════════════════════════════
//  WEBHOOK HEALTH SCREEN
// ═══════════════════════════════════════════════════════════════════════

export default function RazorpayWebhookHealthScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState<WebhookHealthResponse | null>(null);
  const [events, setEvents] = useState<WebhookLogEntry[]>([]);
  const [failures, setFailures] = useState<WebhookLogEntry[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, eventsRes, failuresRes] = await Promise.all([
        api.get('/api/webhooks/razorpay/health'),
        api.get('/api/webhooks/razorpay/events?limit=30'),
        api.get('/api/webhooks/razorpay/recent-failures'),
      ]);

      setHealth(healthRes as unknown as WebhookHealthResponse);
      setEvents((eventsRes as unknown as WebhookEventsResponse).events || []);
      setFailures((failuresRes as unknown as WebhookFailuresResponse).failures || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load webhook data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleRetry = useCallback(async (entry: WebhookLogEntry) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Retry Webhook Event',
      `Re-process "${getEventDisplay(entry.event)}" (${formatId(entry.id)})?\n\nThis will queue the event for re-processing. A fresh Razorpay webhook call may be needed to complete the action.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retry',
          style: 'destructive',
          onPress: async () => {
            setRetrying(entry.id);
            try {
              const res: any = await api.post(`/api/webhooks/razorpay/retry/${entry.id}`, {});
              if (res.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Retry Scheduled', res.message || 'Event queued for re-processing.');
                fetchData();
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert('Retry Failed', res.error || 'Unknown error');
              }
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Retry Failed', err?.message || 'Network error');
            } finally {
              setRetrying(null);
            }
          },
        },
      ],
    );
  }, [fetchData]);

  // ── Loading State ─────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: 60, paddingHorizontal: SPACING.xl }]}>
        <SkeletonBlock width="60%" height={28} />
        <View style={{ height: SPACING.xl }} />
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={{ flex: 1 }}>
              <SkeletonBlock width="100%" height={80} borderRadius={BORDER_RADIUS.md} />
            </View>
          ))}
        </View>
        <View style={{ height: SPACING.xl }} />
        <SkeletonBlock width="40%" height={14} />
        <View style={{ height: SPACING.md }} />
        {[1, 2, 3].map(i => (
          <View key={`skel_${i}`} style={{ marginBottom: SPACING.sm }}>
            <SkeletonBlock width="100%" height={56} borderRadius={BORDER_RADIUS.md} />
          </View>
        ))}
      </View>
    );
  }

  // ── Error State ───────────────────────────────────────────────────

  if (error && !health) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center', padding: SPACING.xl }]}>
        <View style={[s.emptyIconWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.danger} />
        </View>
        <Text style={[s.emptyTitle, { color: colors.text, marginTop: SPACING.lg }]}>Webhook Monitor Unavailable</Text>
        <Text style={[s.emptySubtitle, { color: colors.textMuted, textAlign: 'center', marginTop: SPACING.sm }]}>
          {error}
        </Text>
        <AnimatedPressable onPress={onRefresh} haptic="medium" scaleTo={0.96} style={{ marginTop: SPACING.xl }}>
          <LinearGradient colors={['#3B82F6', '#1D4ED8'] as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.full }}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={{ ...FONTS.semiBold, fontSize: FONTS.size.md, color: '#fff' }}>Retry</Text>
          </LinearGradient>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
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
        {/* Header */}
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
            <View style={[s.headerIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="pulse" size={24} color={colors.primary} />
            </View>
            <View>
              <Text style={[s.title, { color: colors.text }]}>Webhook Health</Text>
              <Text style={[s.subtitle, { color: colors.textMuted }]}>Razorpay Event Monitor</Text>
            </View>
          </View>
          {health && (
            <View style={[s.liveBadge, { backgroundColor: health.successRate >= 90 ? colors.marketUp + '20' : colors.warning + '20' }]}>
              <View style={[s.liveDot, { backgroundColor: health.successRate >= 90 ? colors.marketUp : colors.warning }]} />
              <Text style={[s.liveBadgeText, { color: health.successRate >= 90 ? colors.marketUp : colors.warning }]}>
                Live
              </Text>
            </View>
          )}
        </View>

        {/* ── Health Stat Cards ───────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(100).springify()}>
          <View style={s.statsRow}>
            <View style={[s.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={[s.statIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="pulse" size={18} color={colors.primary} />
              </View>
              <Text style={[s.statValue, { color: colors.text }]}>{health?.total || 0}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Total</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={[s.statIcon, { backgroundColor: colors.marketUp + '20' }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.marketUp} />
              </View>
              <Text style={[s.statValue, { color: colors.text }]}>{health?.processed || 0}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Processed</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={[s.statIcon, { backgroundColor: colors.danger + '20' }]}>
                <Ionicons name="close-circle" size={18} color={colors.danger} />
              </View>
              <Text style={[s.statValue, { color: colors.text }]}>{health?.failed || 0}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Failed</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={[s.statIcon, { backgroundColor: (health?.successRate ?? 100) >= 90 ? colors.marketUp + '20' : colors.warning + '20' }]}>
                <Ionicons name="analytics" size={18} color={(health?.successRate ?? 100) >= 90 ? colors.marketUp : colors.warning} />
              </View>
              <Text style={[s.statValue, { color: colors.text }]}>{health?.successRate ?? 100}%</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Rate</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Secondary Stat Row ─────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(200).springify()}>
          <View style={[s.secondaryStats, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={s.secondaryStat}>
              <Text style={[s.secondaryStatValue, { color: colors.warning }]}>{health?.duplicates || 0}</Text>
              <Text style={[s.secondaryStatLabel, { color: colors.textMuted }]}>Duplicates</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.secondaryStat}>
              <Text style={[s.secondaryStatValue, { color: colors.danger }]}>{health?.invalidSignatures || 0}</Text>
              <Text style={[s.secondaryStatLabel, { color: colors.textMuted }]}>Invalid Sig</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.secondaryStat}>
              <Text style={[s.secondaryStatValue, { color: colors.text }]}>{health?.logSize || 0}</Text>
              <Text style={[s.secondaryStatLabel, { color: colors.textMuted }]}>Log Size</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.secondaryStat}>
              <Text style={[s.secondaryStatValue, { color: colors.textMuted }]}>/{health?.maxLogSize || 1000}</Text>
              <Text style={[s.secondaryStatLabel, { color: colors.textMuted }]}>Max Log</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Last Activity ──────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(250).springify()}>
          <View style={[s.activityRow, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted }}>Last Received</Text>
              <Text style={{ ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text, marginTop: 2 }}>
                {health?.lastReceived ? formatTimestamp(health.lastReceived) : 'N/A'}
              </Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={{ ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted }}>Last Failed</Text>
              <Text style={{ ...FONTS.medium, fontSize: FONTS.size.sm, color: health?.lastFailed ? colors.danger : colors.text, marginTop: 2 }}>
                {health?.lastFailed ? formatTimestamp(health.lastFailed) : 'None'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Events by Type ─────────────────────────────────────── */}
        {health && Object.keys(health.eventsByType).length > 0 && (
          <Animated.View entering={FadeInUp.delay(300).springify()}>
            <View style={{ marginHorizontal: SPACING.xl, marginBottom: SPACING.lg }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>Events by Type</Text>
              <View style={{ backgroundColor: colors.bgCard, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: colors.border, padding: SPACING.md }}>
                {Object.entries(health.eventsByType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([event, count], i) => {
                    const maxCount = Math.max(...Object.values(health.eventsByType));
                    const barWidth = (count / maxCount) * 100;
                    return (
                      <Animated.View
                        key={event}
                        entering={FadeInDown.delay(i * 30).springify()}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}
                      >
                        <Ionicons name={getEventIcon(event) as any} size={14} color={getEventColor(event)} />
                        <Text style={{ ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.text, flex: 1 }} numberOfLines={1}>
                          {getEventDisplay(event)}
                        </Text>
                        <View style={{ width: 60, height: 14, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ width: `${barWidth}%`, height: '100%', backgroundColor: getEventColor(event), borderRadius: 3, opacity: 0.7 }} />
                        </View>
                        <Text style={{ ...FONTS.bold, fontSize: FONTS.size.xs, color: colors.text, width: 30, textAlign: 'right' }}>{count}</Text>
                      </Animated.View>
                    );
                  })}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Failure Analysis ───────────────────────────────────── */}
        {failures.length > 0 && (
          <Animated.View entering={FadeInUp.delay(350).springify()}>
            <View style={{ marginHorizontal: SPACING.xl, marginBottom: SPACING.lg }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>
                Failure Analysis
                <Text style={{ ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted }}> ({failures.length})</Text>
              </Text>
              {failures.slice(0, 10).map((entry, i) => (
                <Animated.View
                  key={entry.id}
                  entering={FadeInDown.delay(i * 40).springify()}
                  style={[s.eventCard, { backgroundColor: colors.bgCard, borderColor: colors.danger + '30' }]}
                >
                  <View style={s.eventRow}>
                    <View style={[s.eventStatusDot, { backgroundColor: STATUS_CONFIG[entry.status]?.color || colors.textMuted }]} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ ...FONTS.mono, fontSize: FONTS.size.xs, fontWeight: '700', color: colors.text }}>
                          {formatId(entry.id)}
                        </Text>
                        <Text style={{ ...FONTS.regular, fontSize: 9, color: colors.textMuted }}>
                          {formatTimestamp(entry.timestamp)}
                        </Text>
                      </View>
                      <Text style={{ ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textSecondary, marginTop: 2 }}>
                        {getEventDisplay(entry.event)}
                      </Text>
                      {entry.error && (
                        <Text style={{ ...FONTS.regular, fontSize: 9, color: colors.danger, marginTop: 2 }} numberOfLines={2}>
                          {entry.error}
                        </Text>
                      )}
                    </View>
                    <AnimatedPressable
                      onPress={() => handleRetry(entry)}
                      haptic="medium"
                      scaleTo={0.9}
                      disabled={retrying === entry.id}
                    >
                      <View style={[s.retryBtn, { backgroundColor: colors.primary + '15' }]}>
                        {retrying === entry.id ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Ionicons name="refresh" size={16} color={colors.primary} />
                        )}
                      </View>
                    </AnimatedPressable>
                  </View>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Recent Events Log ──────────────────────────────────── */}
        <Text style={[s.sectionTitle, { color: colors.text, marginHorizontal: SPACING.xl }]}>
          Recent Events
          <Text style={{ ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted }}> ({events.length})</Text>
        </Text>
        {events.length === 0 ? (
          <View style={[s.emptyContainer, { paddingVertical: 40 }]}>
            <View style={[s.emptyIconWrap, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Ionicons name="pulse-outline" size={36} color={colors.textMuted} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.text, marginTop: SPACING.md }]}>No Events Yet</Text>
            <Text style={[s.emptySubtitle, { color: colors.textMuted }]}>
              Webhook events will appear here as they arrive.
            </Text>
          </View>
        ) : (
          events.map((entry, i) => {
            const cfg = STATUS_CONFIG[entry.status] || { label: entry.status, icon: 'ellipse', color: colors.textMuted };
            return (
              <Animated.View
                key={entry.id}
                entering={FadeInDown.delay(i * 30).springify()}
                style={[s.eventCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              >
                <View style={s.eventRow}>
                  {/* Status indicator */}
                  <View style={[s.eventIcon, { backgroundColor: cfg.color + '20' }]}>
                    <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                  </View>

                  {/* Event info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ ...FONTS.semiBold, fontSize: FONTS.size.xs, color: colors.text }}>
                        {getEventDisplay(entry.event)}
                      </Text>
                      <View style={[s.eventStatusBadge, { backgroundColor: cfg.color + '20' }]}>
                        <Text style={{ ...FONTS.bold, fontSize: 8, color: cfg.color, letterSpacing: 0.5 }}>
                          {cfg.label.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 3, flexWrap: 'wrap' }}>
                      <Text style={{ ...FONTS.mono, fontSize: 9, color: colors.textMuted }}>
                        {formatId(entry.eventId || entry.id)}
                      </Text>
                      <Text style={{ ...FONTS.regular, fontSize: 9, color: colors.textMuted }}>
                        {formatDuration(entry.durationMs)}
                      </Text>
                      <Text style={{ ...FONTS.regular, fontSize: 9, color: colors.textMuted }}>
                        {formatTimestamp(entry.timestamp)}
                      </Text>
                    </View>

                    {entry.error && (
                      <Text style={{ ...FONTS.regular, fontSize: 9, color: colors.danger, marginTop: 3 }} numberOfLines={2}>
                        {entry.error}
                      </Text>
                    )}

                    {(entry.userId || entry.planId) && (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 3 }}>
                        {entry.userId && (
                          <Text style={{ ...FONTS.regular, fontSize: 8, color: colors.textMuted }}>
                            User: {formatId(entry.userId)}
                          </Text>
                        )}
                        {entry.planId && (
                          <Text style={{ ...FONTS.regular, fontSize: 8, color: colors.textMuted }}>
                            Plan: {entry.planId}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Retry button for failed events */}
                  {(entry.status === 'failed' || entry.status === 'invalid_signature') && (
                    <AnimatedPressable
                      onPress={() => handleRetry(entry)}
                      haptic="medium"
                      scaleTo={0.9}
                      disabled={retrying === entry.id}
                    >
                      <View style={[s.retryBtn, { backgroundColor: colors.danger + '15' }]}>
                        {retrying === entry.id ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <Ionicons name="refresh" size={16} color={colors.danger} />
                        )}
                      </View>
                    </AnimatedPressable>
                  )}
                </View>
              </Animated.View>
            );
          })
        )}

        {/* Log capacity info */}
        <View style={{ marginHorizontal: SPACING.xl, marginVertical: SPACING.lg, alignItems: 'center' }}>
          <Text style={{ ...FONTS.regular, fontSize: 9, color: colors.textMuted }}>
            In-memory log · Max {health?.maxLogSize || 1000} events · Oldest events are trimmed
          </Text>
          <Text style={{ ...FONTS.regular, fontSize: 9, color: colors.textMuted, marginTop: 2 }}>
            Full history available in Razorpay Dashboard
          </Text>
        </View>

        {/* Bottom spacer */}
        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContent: {
      paddingBottom: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 60,
      marginBottom: SPACING.lg,
      paddingHorizontal: SPACING.xl,
    },
    headerIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      ...FONTS.bold,
      fontSize: FONTS.size.title,
    },
    subtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      marginTop: 2,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    liveBadgeText: {
      ...FONTS.bold,
      fontSize: FONTS.size.xs,
    },
    statsRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.md,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
    },
    statIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    statValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.xl,
    },
    statLabel: {
      ...FONTS.regular,
      fontSize: 9,
      marginTop: 2,
    },
    secondaryStats: {
      flexDirection: 'row',
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      paddingVertical: SPACING.md,
    },
    secondaryStat: {
      flex: 1,
      alignItems: 'center',
    },
    secondaryStatValue: {
      ...FONTS.bold,
      fontSize: FONTS.size.md,
    },
    secondaryStatLabel: {
      ...FONTS.regular,
      fontSize: 9,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 30,
      alignSelf: 'center',
    },
    activityRow: {
      flexDirection: 'row',
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: SPACING.md,
    },
    sectionTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: SPACING.md,
    },
    eventCard: {
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      padding: SPACING.md,
    },
    eventRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
    },
    eventIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    eventStatusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 4,
    },
    eventStatusBadge: {
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.xs,
    },
    retryBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyIconWrap: {
      width: 80,
      height: 80,
      borderRadius: 20,
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.lg,
    },
    emptySubtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      marginTop: 4,
      maxWidth: 240,
    },
  });
