/**
 * ============================================================================
 * Toroloom — Webhook Management Screen
 * ============================================================================
 *
 * Configure webhook endpoints for real-time event notifications.
 *
 * Features:
 *   - Summary stats (total webhooks, active, deliveries, success rate)
 *   - Webhook cards with name, URL, events, status, delivery stats
 *   - Create webhook form (name, URL, secret, description, event picker)
 *   - Event selector by category (trading/portfolio/market/system/AI)
 *   - Test ping with response feedback
 *   - Toggle active/inactive
 *   - Delete webhook with confirmation
 *   - Delivery log history per webhook (expandable)
 *
 * Navigation: More → Webhooks
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Switch, Dimensions, Alert, Platform,
} from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { WebhookConfig, WebhookEvent, WebhookDeliveryLog, WebhookEventMeta } from '../../types';
import { WEBHOOK_EVENTS } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ═════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═════════════════════════════════════════════════════════════════════════

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400000).toISOString();
}

const MOCK_WEBHOOKS: WebhookConfig[] = [
  {
    id: 'wh_1',
    name: 'Trading Signals Bot',
    url: 'https://hooks.example.com/toroloom/trades',
    secret: 'whsec_8a3F...x7K2',
    events: ['trade:executed', 'order:placed', 'order:filled'],
    isActive: true,
    createdAt: daysAgo(60),
    lastTriggeredAt: daysAgo(0.1),
    deliveryCount: 1248,
    successCount: 1235,
    description: 'Sends trade notifications to our Discord monitoring bot',
  },
  {
    id: 'wh_2',
    name: 'Portfolio Tracker',
    url: 'https://api.mysite.com/toroloom/portfolio',
    secret: 'whsec_2b9D...mR5p',
    events: ['portfolio:change', 'portfolio:threshold', 'watchlist:change'],
    isActive: true,
    createdAt: daysAgo(45),
    lastTriggeredAt: daysAgo(2),
    deliveryCount: 567,
    successCount: 560,
    description: 'Syncs portfolio changes to external tracking dashboard',
  },
  {
    id: 'wh_3',
    name: 'Market Alerts',
    url: 'https://hooks.slack.com/services/T00/B00/xxxxx',
    secret: 'whsec_7c1E...qW8z',
    events: ['market:open', 'market:close', 'price:alert_triggered'],
    isActive: false,
    createdAt: daysAgo(90),
    lastTriggeredAt: daysAgo(30),
    deliveryCount: 312,
    successCount: 298,
    description: 'Slack notifications for market events',
  },
  {
    id: 'wh_4',
    name: 'AI Insights Webhook',
    url: 'https://hooks.example.com/ai-insights',
    secret: 'whsec_4d5F...vG9y',
    events: ['ai:insight_ready', 'sentiment:shift'],
    isActive: true,
    createdAt: daysAgo(15),
    lastTriggeredAt: daysAgo(0.5),
    deliveryCount: 89,
    successCount: 88,
    description: 'Receives AI-generated trading insights',
  },
];

const MOCK_DELIVERY_LOGS: Record<string, WebhookDeliveryLog[]> = {
  wh_1: [
    { id: 'log_1', webhookId: 'wh_1', event: 'trade:executed', statusCode: 200, success: true, duration: 234, responseBody: '{"ok":true}', errorMessage: null, timestamp: daysAgo(0.1) },
    { id: 'log_2', webhookId: 'wh_1', event: 'order:filled', statusCode: 200, success: true, duration: 187, responseBody: '{"ok":true}', errorMessage: null, timestamp: daysAgo(0.5) },
    { id: 'log_3', webhookId: 'wh_1', event: 'trade:executed', statusCode: 502, success: false, duration: 5032, responseBody: '<html>502 Bad Gateway</html>', errorMessage: 'Upstream server timeout', timestamp: daysAgo(1) },
    { id: 'log_4', webhookId: 'wh_1', event: 'order:placed', statusCode: 200, success: true, duration: 156, responseBody: '{"ok":true}', errorMessage: null, timestamp: daysAgo(2) },
    { id: 'log_5', webhookId: 'wh_1', event: 'trade:executed', statusCode: 200, success: true, duration: 198, responseBody: '{"ok":true}', errorMessage: null, timestamp: daysAgo(3) },
  ],
};

// Helper
function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function maskSecret(secret: string): string {
  if (secret.length <= 12) return secret;
  return `${secret.slice(0, 7)}...${secret.slice(-4)}`;
}

// ═════════════════════════════════════════════════════════════════════════
// EVENT CATEGORY CHIP
// ═════════════════════════════════════════════════════════════════════════

const EVENT_CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'trading', label: 'Trading', icon: 'swap-horizontal' },
  { key: 'portfolio', label: 'Portfolio', icon: 'pie-chart' },
  { key: 'market', label: 'Market', icon: 'trending-up' },
  { key: 'ai', label: 'AI', icon: 'bulb' },
  { key: 'system', label: 'System', icon: 'settings' },
];

function EventCategoryChip({ label, icon, active, onPress, color }: {
  label: string; icon: string; active: boolean; onPress: () => void; color: string;
}) {
  return (
    <Pressable onPress={onPress} style={[catChipStyles.chip, {
      backgroundColor: active ? color + '20' : 'rgba(255,255,255,0.04)',
      borderColor: active ? color + '40' : 'rgba(255,255,255,0.1)',
    }]}>
      <Ionicons name={icon as any} size={13} color={active ? color : 'rgba(255,255,255,0.5)'} />
      <Text style={[catChipStyles.text, { color: active ? color : 'rgba(255,255,255,0.5)' }]}>{label}</Text>
    </Pressable>
  );
}

const catChipStyles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1, marginRight: SPACING.sm },
  text: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
});

// ═════════════════════════════════════════════════════════════════════════
// STAT CARD
// ═════════════════════════════════════════════════════════════════════════

function StatCard({ icon, value, label, color }: {
  icon: string; value: string; label: string; color: string;
}) {
  return (
    <View style={[statStyles.card, { borderColor: color + '30' }]}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, borderWidth: 1, alignItems: 'center', gap: 2 },
  value: { ...FONTS.bold, fontSize: FONTS.size.lg, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  label: { ...FONTS.regular, fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
});

// ═════════════════════════════════════════════════════════════════════════
// WEBHOOK CARD
// ═════════════════════════════════════════════════════════════════════════

function WebhookCard({
  wh, logs, onToggle, onDelete, onTestPing, expanded, onToggleExpand, colors,
}: {
  wh: WebhookConfig;
  logs: WebhookDeliveryLog[];
  onToggle: (wh: WebhookConfig) => void;
  onDelete: (wh: WebhookConfig) => void;
  onTestPing: (wh: WebhookConfig) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  colors: any;
}) {
  const successRate = wh.deliveryCount > 0 ? Math.round((wh.successCount / wh.deliveryCount) * 100) : 0;
  const isUp = wh.isActive;

  return (
    <Animated.View layout={LinearTransition} style={[cardStyles.card, {
      backgroundColor: isUp ? colors.bgCard : 'rgba(255,255,255,0.03)',
      borderColor: isUp ? colors.border : 'rgba(255,255,255,0.06)',
      opacity: isUp ? 1 : 0.6,
    }]}>
      {/* Header */}
      <View style={cardStyles.header}>
        <View style={cardStyles.statusDot}>
          <View style={[cardStyles.statusInner, { backgroundColor: isUp ? '#00C853' : '#FF5252' }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cardStyles.name, { color: colors.text }]}>{wh.name}</Text>
          <Text style={[cardStyles.url, { color: colors.textMuted }]} numberOfLines={1}>{wh.url}</Text>
        </View>        <Pressable onPress={() => onToggle(wh)}>
              <Ionicons name={isUp ? 'toggle' : 'toggle-outline'} size={28} color={isUp ? '#00C853' : colors.textMuted} />
            </Pressable>
      </View>

      {/* Events */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cardStyles.eventsScroll}>
        {wh.events.map(ev => {
          const meta = WEBHOOK_EVENTS[ev];
          return (
            <View key={ev} style={[cardStyles.eventBadge, { backgroundColor: meta.color + '20' }]}>
              <Text style={[cardStyles.eventBadgeText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Secret */}
      <View style={cardStyles.secretRow}>
        <Ionicons name="key" size={11} color={colors.textMuted} />
        <Text style={[cardStyles.secretText, { color: colors.textMuted }]}>{maskSecret(wh.secret)}</Text>
      </View>

      {/* Stats row */}
      <View style={cardStyles.statsRow}>
        <View style={cardStyles.statItem}>
          <Text style={[cardStyles.statValue, { color: colors.text }]}>{wh.deliveryCount}</Text>
          <Text style={[cardStyles.statLabel, { color: colors.textMuted }]}>Deliveries</Text>
        </View>
        <View style={cardStyles.statItem}>
          <Text style={[cardStyles.statValue, { color: isUp ? '#00C853' : colors.textMuted }]}>{successRate}%</Text>
          <Text style={[cardStyles.statLabel, { color: colors.textMuted }]}>Success</Text>
        </View>
        <View style={cardStyles.statItem}>
          <Text style={[cardStyles.statValue, { color: colors.text }]}>{formatRelativeTime(wh.lastTriggeredAt)}</Text>
          <Text style={[cardStyles.statLabel, { color: colors.textMuted }]}>Last Ping</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={cardStyles.actionsRow}>
        <Pressable onPress={() => onTestPing(wh)} style={[cardStyles.actionBtn, { borderColor: colors.primary + '30' }]}>
          <Ionicons name="flash" size={14} color={colors.primary} />
          <Text style={[cardStyles.actionBtnText, { color: colors.primary }]}>Test Ping</Text>
        </Pressable>
        <Pressable onPress={onToggleExpand} style={[cardStyles.actionBtn, { borderColor: colors.border }]}>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
          <Text style={[cardStyles.actionBtnText, { color: colors.textMuted }]}>Logs</Text>
        </Pressable>
        <Pressable onPress={() => onDelete(wh)} style={[cardStyles.actionBtn, { borderColor: '#FF525230' }]}>
          <Ionicons name="trash-outline" size={14} color="#FF5252" />
          <Text style={[cardStyles.actionBtnText, { color: '#FF5252' }]}>Delete</Text>
        </Pressable>
      </View>

      {/* Expanded: Delivery Logs */}
      {expanded && (
        <View style={[cardStyles.logsSection, { backgroundColor: colors.bgInput, borderColor: colors.divider }]}>
          <Text style={[cardStyles.logsTitle, { color: colors.text }]}>Recent Deliveries</Text>
          {logs.length === 0 ? (
            <Text style={[cardStyles.noLogs, { color: colors.textMuted }]}>No delivery logs yet</Text>
          ) : (
            logs.map(log => {
              const meta = WEBHOOK_EVENTS[log.event];
              return (
                <View key={log.id} style={[cardStyles.logRow, { borderBottomColor: colors.divider }]}>
                  <View style={[cardStyles.logStatus, {
                    backgroundColor: log.success ? '#00C85320' : '#FF525220',
                  }]}>
                    <Ionicons name={log.success ? 'checkmark' : 'close'} size={10} color={log.success ? '#00C853' : '#FF5252'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[cardStyles.logEvent, { color: colors.text }]}>{meta?.label ?? log.event}</Text>
                      <Text style={[cardStyles.logCode, {
                        color: log.statusCode >= 200 && log.statusCode < 300 ? '#00C853' : '#FF5252',
                      }]}>HTTP {log.statusCode}</Text>
                    </View>
                    <Text style={[cardStyles.logMeta, { color: colors.textMuted }]}>
                      {log.duration}ms · {formatRelativeTime(log.timestamp)}
                    </Text>
                    {!log.success && log.errorMessage && (
                      <Text style={cardStyles.logError}>{log.errorMessage}</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </Animated.View>
  );
}

const cardStyles = StyleSheet.create({
  card: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.sm, gap: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  statusInner: { width: 8, height: 8, borderRadius: 4 },
  name: { ...FONTS.bold, fontSize: FONTS.size.md },
  url: { ...FONTS.mono, fontSize: FONTS.size.xs, marginTop: 1, maxWidth: SCREEN_WIDTH - 140 },
  eventsScroll: { marginTop: 0 },
  eventBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, marginRight: 4 },
  eventBadgeText: { ...FONTS.medium, fontSize: 9, fontWeight: '600' },
  secretRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secretText: { ...FONTS.mono, fontSize: 9, letterSpacing: 0.3 },
  statsRow: { flexDirection: 'row', gap: SPACING.md, paddingVertical: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.06)' },
  statItem: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: { ...FONTS.semiBold, fontSize: FONTS.size.xs, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  statLabel: { ...FONTS.regular, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  actionsRow: { flexDirection: 'row', gap: SPACING.sm },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
  actionBtnText: { ...FONTS.medium, fontSize: FONTS.size.xs },
  logsSection: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, gap: SPACING.sm },
  logsTitle: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  noLogs: { ...FONTS.regular, fontSize: FONTS.size.xs, fontStyle: 'italic' },
  logRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start', paddingVertical: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  logStatus: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  logEvent: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  logCode: { ...FONTS.mono, fontSize: 8, fontWeight: '700' },
  logMeta: { ...FONTS.regular, fontSize: 8, marginTop: 1 },
  logError: { ...FONTS.regular, fontSize: 8, color: '#FF5252', marginTop: 1 },
});

// ═════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════

export default function WebhookManagementScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(MOCK_WEBHOOKS);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedWhId, setExpandedWhId] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([]);
  const [eventCategoryFilter, setEventCategoryFilter] = useState<string>('trading');

  // ── Derived ──
  const stats = useMemo(() => {
    const active = webhooks.filter(w => w.isActive);
    const totalDeliveries = webhooks.reduce((s, w) => s + w.deliveryCount, 0);
    const totalSuccess = webhooks.reduce((s, w) => s + w.successCount, 0);
    const successRate = totalDeliveries > 0 ? Math.round((totalSuccess / totalDeliveries) * 100) : 0;
    return { total: webhooks.length, active: active.length, totalDeliveries, successRate };
  }, [webhooks]);

  const filteredEvents = useMemo(() => {
    return (Object.values(WEBHOOK_EVENTS) as WebhookEventMeta[]).filter(e => e.category === eventCategoryFilter);
  }, [eventCategoryFilter]);

  // ── Handlers ──
  const toggleWebhook = useCallback((wh: WebhookConfig) => {
    setWebhooks(prev => prev.map(w => w.id === wh.id ? { ...w, isActive: !w.isActive } : w));
  }, []);

  const deleteWebhook = useCallback((wh: WebhookConfig) => {
    Alert.alert(
      'Delete Webhook',
      `Permanently delete "${wh.name}"?\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          setWebhooks(prev => prev.filter(w => w.id !== wh.id));
          if (expandedWhId === wh.id) setExpandedWhId(null);
        }},
      ],
    );
  }, [expandedWhId]);

  const testPing = useCallback((wh: WebhookConfig) => {
    Alert.alert('🔍 Test Ping', `Sending test event to:\n${wh.url}\n\nStatus: 200 OK\nDuration: 187ms`, [{ text: 'OK' }]);
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedWhId(prev => prev === id ? null : id);
  }, []);

  const toggleCreateEvent = useCallback((ev: WebhookEvent) => {
    setSelectedEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  }, []);

  const handleCreate = useCallback(() => {
    if (!newName.trim()) { Alert.alert('Name Required', 'Please enter a webhook name.'); return; }
    if (!newUrl.trim()) { Alert.alert('URL Required', 'Please enter a target URL.'); return; }
    if (selectedEvents.length === 0) { Alert.alert('Events Required', 'Please select at least one event.'); return; }

    const generatedSecret = newSecret.trim() || `whsec_${Math.random().toString(36).slice(2, 10)}...${Math.random().toString(36).slice(-4)}`;
    const newWebhook: WebhookConfig = {
      id: `wh_${Date.now()}`,
      name: newName.trim(),
      url: newUrl.trim(),
      secret: maskSecret(generatedSecret),
      events: selectedEvents,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastTriggeredAt: null,
      deliveryCount: 0,
      successCount: 0,
      description: newDesc.trim(),
    };

    setWebhooks(prev => [newWebhook, ...prev]);
    setShowCreateForm(false);
    setNewName(''); setNewUrl(''); setNewSecret(''); setNewDesc('');
    setSelectedEvents([]);
    Alert.alert('✅ Created', `Webhook "${newName}" created successfully.`);
  }, [newName, newUrl, newSecret, newDesc, selectedEvents]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Webhooks</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Real-time event notifications</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard icon="link" value={stats.total.toString()} label="Total" color="#3B82F6" />
          <StatCard icon="checkmark-circle" value={stats.active.toString()} label="Active" color="#00C853" />
          <StatCard icon="pulse" value={stats.totalDeliveries.toString()} label="Delivered" color="#8B5CF6" />
          <StatCard icon="trending-up" value={`${stats.successRate}%`} label="Success" color="#00E676" />
        </View>

        {/* Create Button */}
        {!showCreateForm ? (
          <AnimatedPressable onPress={() => setShowCreateForm(true)} haptic="medium" scaleTo={0.97}>
            <View style={[styles.createBtn, { borderColor: colors.primary + '40' }]}>
              <Ionicons name="add-circle" size={20} color={colors.primary} />
              <Text style={[styles.createBtnText, { color: colors.primary }]}>Add Webhook</Text>
            </View>
          </AnimatedPressable>
        ) : (
          <Animated.View entering={FadeInDown} style={[styles.createForm, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.formHeader}>
              <Text style={[styles.formTitle, { color: colors.text }]}>New Webhook</Text>
              <Pressable onPress={() => setShowCreateForm(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={[styles.formLabel, { color: colors.textMuted }]}>Name</Text>
            <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.bgInput, borderColor: colors.border }]}
              placeholder="My Webhook" placeholderTextColor={colors.textMuted} value={newName} onChangeText={setNewName} autoFocus />

            <Text style={[styles.formLabel, { color: colors.textMuted, marginTop: SPACING.sm }]}>Target URL</Text>
            <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.bgInput, borderColor: colors.border }]}
              placeholder="https://hooks.example.com/..." placeholderTextColor={colors.textMuted} value={newUrl} onChangeText={setNewUrl} autoCapitalize="none" autoCorrect={false} />

            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.formLabel, { color: colors.textMuted, marginTop: SPACING.sm }]}>Secret (optional)</Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.bgInput, borderColor: colors.border }]}
                  placeholder="whsec_..." placeholderTextColor={colors.textMuted} value={newSecret} onChangeText={setNewSecret} autoCapitalize="none" />
              </View>
            </View>

            <Text style={[styles.formLabel, { color: colors.textMuted, marginTop: SPACING.sm }]}>Description</Text>
            <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.bgInput, borderColor: colors.border }]}
              placeholder="Optional description" placeholderTextColor={colors.textMuted} value={newDesc} onChangeText={setNewDesc} />

            {/* Event selector */}
            <Text style={[styles.formLabel, { color: colors.textMuted, marginTop: SPACING.sm }]}>
              Events ({selectedEvents.length} selected)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {EVENT_CATEGORIES.map(cat => (
                <EventCategoryChip key={cat.key} label={cat.label} icon={cat.icon} active={eventCategoryFilter === cat.key} onPress={() => setEventCategoryFilter(cat.key)} color={colors.primary} />
              ))}
            </ScrollView>
            <View style={styles.eventsGrid}>
              {filteredEvents.map(meta => {
                const isSelected = selectedEvents.includes(meta.event);
                return (
                  <Pressable key={meta.event} onPress={() => toggleCreateEvent(meta.event)}
                    style={[styles.eventOption, {
                      backgroundColor: isSelected ? meta.color + '20' : 'rgba(255,255,255,0.04)',
                      borderColor: isSelected ? meta.color + '40' : 'rgba(255,255,255,0.1)',
                    }]}>
                    <Ionicons name={meta.icon as any} size={14} color={isSelected ? meta.color : colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.eventOptionLabel, { color: isSelected ? meta.color : colors.text }]}>{meta.label}</Text>
                      <Text style={[styles.eventOptionDesc, { color: colors.textMuted }]}>{meta.description}</Text>
                    </View>
                    <Ionicons name={isSelected ? 'checkmark-circle' : 'add-circle-outline'} size={18} color={isSelected ? meta.color : colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>

            <AnimatedPressable onPress={handleCreate} haptic="medium" scaleTo={0.97}>
              <View style={[styles.submitBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="link" size={18} color="#FFF" />
                <Text style={styles.submitBtnText}>Create Webhook</Text>
              </View>
            </AnimatedPressable>
          </Animated.View>
        )}

        {/* Webhook List */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
          Configured Webhooks
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          {webhooks.filter(w => w.isActive).length} active · {webhooks.length} total
        </Text>

        {webhooks.map(wh => (
          <WebhookCard
            key={wh.id}
            wh={wh}
            logs={MOCK_DELIVERY_LOGS[wh.id] || []}
            onToggle={toggleWebhook}
            onDelete={deleteWebhook}
            onTestPing={testPing}
            expanded={expandedWhId === wh.id}
            onToggleExpand={() => toggleExpand(wh.id)}
            colors={colors}
          />
        ))}

        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>About Webhooks</Text>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              Webhooks send HTTP POST requests to your URL when specific events occur in your account.
              Your server can then react in real-time — sync portfolio, execute trades, or send notifications.
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: SPACING.xl, paddingTop: 60, borderBottomLeftRadius: BORDER_RADIUS.xl, borderBottomRightRadius: BORDER_RADIUS.xl },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backBtn: { padding: 4 },
  title: { ...FONTS.bold, fontSize: FONTS.size.title, color: '#FFFFFF' },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4 },

  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },

  // Create button
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1.5, borderStyle: 'dashed', marginBottom: SPACING.md },
  createBtnText: { ...FONTS.semiBold, fontSize: FONTS.size.md },

  // Create form
  createForm: { padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.md, gap: SPACING.sm },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  formTitle: { ...FONTS.bold, fontSize: FONTS.size.lg },
  formLabel: { ...FONTS.medium, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { ...FONTS.medium, fontSize: FONTS.size.sm, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginTop: 4 },
  catScroll: { marginTop: 6 },
  eventsGrid: { gap: SPACING.xs, marginTop: 4 },
  eventOption: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
  eventOptionLabel: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  eventOptionDesc: { ...FONTS.regular, fontSize: 8, marginTop: 1 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.md, marginTop: SPACING.sm },
  submitBtnText: { ...FONTS.bold, fontSize: FONTS.size.sm, color: '#FFFFFF' },

  // Sections
  sectionTitle: { ...FONTS.bold, fontSize: FONTS.size.md },
  sectionSubtitle: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2, marginBottom: SPACING.md },

  // Info
  infoCard: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, borderWidth: 1, marginTop: SPACING.md, marginBottom: SPACING.lg },
  infoTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: 4 },
  infoText: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 18 },
});
