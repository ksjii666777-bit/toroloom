/**
 * ============================================================================
 * Toroloom — Security Audit Log Screen
 * ============================================================================
 *
 * Displays login history, active sessions, and provides remote logout
 * functionality for account security management.
 *
 * Features:
 *   - Summary stats (total logins, failed attempts, active devices, last login)
 *   - Login history timeline (device, IP, location, timestamp, success/fail)
 *   - Active sessions management (current device badge, other device details)
 *   - Remote logout with confirmation alerts
 *   - Filter by success/failure
 *   - Time-relative labels (Today, Yesterday, This Week, Earlier)
 *
 * Navigation: More → Security → Audit Log
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Dimensions, Alert, Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import type { LoginEvent, ActiveSession } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ═════════════════════════════════════════════════════════════════════════
// MOCK DATA
// ═════════════════════════════════════════════════════════════════════════

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString();
}

const MOCK_LOGIN_HISTORY: LoginEvent[] = [
  {
    id: 'login_1',
    timestamp: hoursAgo(0.5),
    deviceName: 'iPhone 15 Pro',
    deviceOs: 'iOS 18.2',
    browser: 'Toroloom iOS App',
    ipAddress: '203.123.45.67',
    location: 'Mumbai, MH, India',
    success: true,
    authMethod: 'biometric',
  },
  {
    id: 'login_2',
    timestamp: hoursAgo(4),
    deviceName: 'iPhone 15 Pro',
    deviceOs: 'iOS 18.2',
    browser: 'Toroloom iOS App',
    ipAddress: '203.123.45.67',
    location: 'Mumbai, MH, India',
    success: true,
    authMethod: 'email',
  },
  {
    id: 'login_3',
    timestamp: hoursAgo(8),
    deviceName: 'Windows PC',
    deviceOs: 'Windows 11',
    browser: 'Chrome 120.0',
    ipAddress: '103.45.78.90',
    location: 'Delhi, DL, India',
    success: true,
    authMethod: '2fa',
  },
  {
    id: 'login_4',
    timestamp: hoursAgo(28),
    deviceName: 'Samsung Galaxy S25',
    deviceOs: 'Android 15',
    browser: 'Toroloom Android App',
    ipAddress: '182.56.34.12',
    location: 'Bangalore, KA, India',
    success: false,
    failureReason: 'Incorrect password',
    authMethod: 'email',
  },
  {
    id: 'login_5',
    timestamp: hoursAgo(32),
    deviceName: 'iPhone 15 Pro',
    deviceOs: 'iOS 18.2',
    browser: 'Toroloom iOS App',
    ipAddress: '203.123.45.67',
    location: 'Mumbai, MH, India',
    success: true,
    authMethod: 'biometric',
  },
  {
    id: 'login_6',
    timestamp: hoursAgo(48),
    deviceName: 'MacBook Pro',
    deviceOs: 'macOS 14.2',
    browser: 'Safari 17.2',
    ipAddress: '203.123.45.67',
    location: 'Mumbai, MH, India',
    success: true,
    authMethod: 'email',
  },
  {
    id: 'login_7',
    timestamp: hoursAgo(72),
    deviceName: 'Unknown Device',
    deviceOs: 'Unknown',
    browser: 'Firefox 121.0',
    ipAddress: '45.67.89.123',
    location: 'Singapore',
    success: false,
    failureReason: '2FA code expired',
    authMethod: '2fa',
  },
  {
    id: 'login_8',
    timestamp: hoursAgo(96),
    deviceName: 'iPhone 15 Pro',
    deviceOs: 'iOS 18.1',
    browser: 'Toroloom iOS App',
    ipAddress: '203.123.45.67',
    location: 'Mumbai, MH, India',
    success: true,
    authMethod: 'biometric',
  },
  {
    id: 'login_9',
    timestamp: hoursAgo(120),
    deviceName: 'iPad Air',
    deviceOs: 'iPadOS 17.2',
    browser: 'Toroloom iOS App',
    ipAddress: '203.123.45.67',
    location: 'Mumbai, MH, India',
    success: true,
    authMethod: 'biometric',
  },
  {
    id: 'login_10',
    timestamp: hoursAgo(168),
    deviceName: 'Samsung Galaxy S25',
    deviceOs: 'Android 15',
    browser: 'Chrome 120.0',
    ipAddress: '182.56.34.12',
    location: 'Bangalore, KA, India',
    success: true,
    authMethod: 'email',
  },
  {
    id: 'login_11',
    timestamp: hoursAgo(216),
    deviceName: 'Unknown Device',
    deviceOs: 'Unknown',
    browser: 'Unknown Browser',
    ipAddress: '78.90.12.34',
    location: 'Dubai, UAE',
    success: false,
    failureReason: 'Invalid credentials',
    authMethod: 'email',
  },
];

const MOCK_ACTIVE_SESSIONS: ActiveSession[] = [
  {
    id: 'session_current',
    deviceName: 'iPhone 15 Pro',
    deviceOs: 'iOS 18.2',
    browser: 'Toroloom iOS App',
    ipAddress: '203.123.45.67',
    location: 'Mumbai, MH, India',
    createdAt: hoursAgo(720),
    lastActiveAt: hoursAgo(0.1),
    isCurrentDevice: true,
  },
  {
    id: 'session_pc',
    deviceName: 'Windows PC',
    deviceOs: 'Windows 11',
    browser: 'Chrome 120.0',
    ipAddress: '103.45.78.90',
    location: 'Delhi, DL, India',
    createdAt: hoursAgo(168),
    lastActiveAt: hoursAgo(8),
    isCurrentDevice: false,
  },
  {
    id: 'session_tab',
    deviceName: 'iPad Air',
    deviceOs: 'iPadOS 17.2',
    browser: 'Toroloom iOS App',
    ipAddress: '203.123.45.67',
    location: 'Mumbai, MH, India',
    createdAt: hoursAgo(336),
    lastActiveAt: hoursAgo(48),
    isCurrentDevice: false,
  },
  {
    id: 'session_android',
    deviceName: 'Samsung Galaxy S25',
    deviceOs: 'Android 15',
    browser: 'Toroloom Android App',
    ipAddress: '182.56.34.12',
    location: 'Bangalore, KA, India',
    createdAt: hoursAgo(240),
    lastActiveAt: hoursAgo(72),
    isCurrentDevice: false,
  },
];

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return `Today at ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  if (isYesterday) return `Yesterday at ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ` at ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

function getAuthMethodIcon(method: LoginEvent['authMethod']): string {
  switch (method) {
    case 'biometric': return 'finger-print';
    case 'email': return 'mail';
    case 'google': return 'logo-google';
    case 'apple': return 'logo-apple';
    case '2fa': return 'shield-checkmark';
  }
}

function getDeviceIcon(device: string): string {
  const d = device.toLowerCase();
  if (d.includes('iphone') || d.includes('ipad')) return 'phone-portrait';
  if (d.includes('samsung') || d.includes('android') || d.includes('pixel')) return 'phone-landscape';
  if (d.includes('macbook') || d.includes('mac')) return 'laptop';
  if (d.includes('windows') || d.includes('pc')) return 'desktop';
  return 'globe';
}

// ═════════════════════════════════════════════════════════════════════════
// STAT CARD
// ═════════════════════════════════════════════════════════════════════════

function StatCard({ icon, label, value, color, isLast }: {
  icon: string;
  label: string;
  value: string;
  color: string;
  isLast?: boolean;
}) {
  return (
    <View style={[
      statCardStyles.card,
      { borderColor: color + '30' },
      !isLast && statCardStyles.cardMargin,
    ]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[statCardStyles.value, { color }]}>{value}</Text>
      <Text style={statCardStyles.label}>{label}</Text>
    </View>
  );
}

const statCardStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  cardMargin: { marginRight: SPACING.sm },
  value: { ...FONTS.bold, fontSize: FONTS.size.lg, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  label: { ...FONTS.regular, fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },
});

// ═════════════════════════════════════════════════════════════════════════
// LOGIN EVENT ROW
// ═════════════════════════════════════════════════════════════════════════

function LoginEventRow({ event, colors }: { event: LoginEvent; colors: any }) {
  const isSuccess = event.success;
  const iconName = getAuthMethodIcon(event.authMethod);

  return (
    <View style={[loginStyles.row, { borderBottomColor: colors.divider }]}>
      {/* Status indicator */}
      <View style={[
        loginStyles.statusIndicator,
        { backgroundColor: isSuccess ? '#00C85320' : '#FF525220' },
      ]}>
        <View style={[
          loginStyles.statusDot,
          { backgroundColor: isSuccess ? '#00C853' : '#FF5252' },
        ]} />
      </View>

      {/* Details */}
      <View style={loginStyles.details}>
        <View style={loginStyles.topRow}>
          <Ionicons name={iconName as any} size={13} color={isSuccess ? colors.primary : colors.danger} />
          <Text style={[loginStyles.authMethod, { color: colors.text }]}>
            {event.authMethod === '2fa' ? '2FA' : event.authMethod.charAt(0).toUpperCase() + event.authMethod.slice(1)}
          </Text>
          <Text style={[loginStyles.time, { color: colors.textMuted }]}>
            {formatRelativeTime(event.timestamp)}
          </Text>
          {!isSuccess && (
            <View style={[loginStyles.failBadge, { backgroundColor: '#FF525220' }]}>
              <Text style={loginStyles.failBadgeText}>Failed</Text>
            </View>
          )}
        </View>

        <View style={loginStyles.deviceRow}>
          <Ionicons name={getDeviceIcon(event.deviceName) as any} size={11} color={colors.textMuted} />
          <Text style={[loginStyles.deviceText, { color: colors.textSecondary }]} numberOfLines={1}>
            {event.deviceName} · {event.deviceOs}
          </Text>
        </View>

        <View style={loginStyles.locationRow}>
          <Text style={[loginStyles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
            {event.location} · {event.ipAddress}
          </Text>
        </View>

        {!isSuccess && event.failureReason && (
          <View style={loginStyles.reasonRow}>
            <Ionicons name="alert-circle" size={11} color="#FF5252" />
            <Text style={loginStyles.reasonText}>{event.failureReason}</Text>
          </View>
        )}
      </View>

      {/* Timestamp full */}
      <Text style={[loginStyles.fullDate, { color: colors.textMuted }]}>
        {formatDate(event.timestamp)}
      </Text>
    </View>
  );
}

const loginStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  statusIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  details: { flex: 1, gap: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  authMethod: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  time: { ...FONTS.regular, fontSize: 9, fontStyle: 'italic' },
  failBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: BORDER_RADIUS.full },
  failBadgeText: { ...FONTS.medium, fontSize: 8, color: '#FF5252', fontWeight: '700' },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deviceText: { ...FONTS.regular, fontSize: FONTS.size.xs, flex: 1 },
  locationRow: {},
  locationText: { ...FONTS.regular, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  reasonText: { ...FONTS.regular, fontSize: 9, color: '#FF5252', flex: 1 },
  fullDate: { ...FONTS.regular, fontSize: 8, width: 80, textAlign: 'right', opacity: 0.5 },
});

// ═════════════════════════════════════════════════════════════════════════
// SESSION CARD
// ═════════════════════════════════════════════════════════════════════════

function SessionCard({
  session,
  onLogout,
  colors,
}: {
  session: ActiveSession;
  onLogout: (session: ActiveSession) => void;
  colors: any;
}) {
  const isCurrent = session.isCurrentDevice;
  const iconName = getDeviceIcon(session.deviceName);

  return (
    <View style={[
      sessionStyles.card,
      {
        backgroundColor: isCurrent ? colors.primary + '10' : colors.bgCard,
        borderColor: isCurrent ? colors.primary + '30' : colors.border,
      },
    ]}>
      <View style={sessionStyles.headerRow}>
        <View style={[sessionStyles.iconBox, {
          backgroundColor: isCurrent ? colors.primary + '20' : 'rgba(255,255,255,0.05)',
        }]}>
          <Ionicons name={iconName as any} size={22} color={isCurrent ? colors.primary : colors.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={sessionStyles.nameRow}>
            <Text style={[sessionStyles.deviceName, { color: colors.text }]}>{session.deviceName}</Text>
            {isCurrent && (
              <View style={[sessionStyles.currentBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[sessionStyles.currentBadgeText, { color: colors.primary }]}>Current</Text>
              </View>
            )}
          </View>
          <Text style={[sessionStyles.deviceOs, { color: colors.textMuted }]}>
            {session.deviceOs} · {session.browser}
          </Text>
        </View>
      </View>

      <View style={sessionStyles.detailRow}>
        <View style={sessionStyles.detailItem}>
          <Ionicons name="location" size={11} color={colors.textMuted} />
          <Text style={[sessionStyles.detailText, { color: colors.textSecondary }]}>{session.location}</Text>
        </View>
        <View style={sessionStyles.detailItem}>
          <Ionicons name="globe" size={11} color={colors.textMuted} />
          <Text style={[sessionStyles.detailText, { color: colors.textSecondary }]}>{session.ipAddress}</Text>
        </View>
      </View>

      <View style={sessionStyles.timeRow}>
        <View style={sessionStyles.detailItem}>
          <Ionicons name="time" size={11} color={colors.textMuted} />
          <Text style={[sessionStyles.detailText, { color: colors.textMuted }]}>
            Created {formatRelativeTime(session.createdAt)} ago
          </Text>
        </View>
        <View style={sessionStyles.detailItem}>
          <Ionicons name="flash" size={11} color={colors.textMuted} />
          <Text style={[sessionStyles.detailText, { color: colors.textMuted }]}>
            Active {formatRelativeTime(session.lastActiveAt)} ago
          </Text>
        </View>
      </View>

      {!isCurrent && (
        <Pressable
          onPress={() => onLogout(session)}
          style={({ pressed }) => [
            sessionStyles.logoutBtn,
            { borderColor: '#FF525240', opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="log-out-outline" size={14} color="#FF5252" />
          <Text style={sessionStyles.logoutBtnText}>Log Out This Device</Text>
        </Pressable>
      )}
    </View>
  );
}

const sessionStyles = StyleSheet.create({
  card: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  headerRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  deviceName: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  deviceOs: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 1 },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  currentBadgeText: { ...FONTS.extraBold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.3 },
  detailRow: { flexDirection: 'row', gap: SPACING.lg },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { ...FONTS.regular, fontSize: FONTS.size.xs, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  timeRow: { flexDirection: 'row', gap: SPACING.lg },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.xs,
  },
  logoutBtnText: { ...FONTS.medium, fontSize: FONTS.size.xs, color: '#FF5252', fontWeight: '600' },
});

// ═════════════════════════════════════════════════════════════════════════
// FILTER CHIPS
// ═════════════════════════════════════════════════════════════════════════

function FilterChip({ label, active, onPress, color }: {
  label: string;
  active: boolean;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        chipStyles.chip,
        {
          backgroundColor: active ? color + '20' : 'rgba(255,255,255,0.05)',
          borderColor: active ? color + '40' : 'rgba(255,255,255,0.1)',
        },
      ]}
    >
      <Text style={[chipStyles.text, { color: active ? color : 'rgba(255,255,255,0.6)' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  text: { ...FONTS.medium, fontSize: FONTS.size.xs, fontWeight: '600' },
});

// ═════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════

export default function SecurityAuditLogScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [activeFilter, setActiveFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [showAllHistory, setShowAllHistory] = useState(false);

  // ── Derived data ──
  const stats = useMemo(() => {
    const total = MOCK_LOGIN_HISTORY.length;
    const failed = MOCK_LOGIN_HISTORY.filter(e => !e.success).length;
    const successful = total - failed;
    return { total, successful, failed, activeSessions: MOCK_ACTIVE_SESSIONS.length, lastLogin: MOCK_LOGIN_HISTORY[0]?.timestamp ?? '' };
  }, []);

  const filteredHistory = useMemo(() => {
    if (activeFilter === 'all') return MOCK_LOGIN_HISTORY;
    return MOCK_LOGIN_HISTORY.filter(e => activeFilter === 'success' ? e.success : !e.success);
  }, [activeFilter]);

  const displayedHistory = showAllHistory ? filteredHistory : filteredHistory.slice(0, 5);

  // ── Handlers ──
  const handleRemoteLogout = useCallback((session: ActiveSession) => {
    Alert.alert(
      'Log Out Device',
      `This will log out "${session.deviceName}" (${session.location}).\n\nThey will need to sign in again to access your account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            Alert.alert('✅ Done', `"${session.deviceName}" has been logged out successfully.`);
          },
        },
      ],
    );
  }, []);

  const handleLogoutAll = useCallback(() => {
    const otherSessions = MOCK_ACTIVE_SESSIONS.filter(s => !s.isCurrentDevice);
    Alert.alert(
      'Log Out All Other Devices',
      `This will log out ${otherSessions.length} other device${otherSessions.length !== 1 ? 's' : ''}.\n\nYou will only remain signed in on this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out All',
          style: 'destructive',
          onPress: () => {
            Alert.alert('✅ Done', 'All other devices have been logged out successfully.');
          },
        },
      ],
    );
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgSecondary }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Audit Log</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Login history & active sessions
            </Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ── Summary Stats ── */}
        <View style={styles.statsRow}>
          <StatCard icon="log-in" label="Total Logins" value={stats.total.toString()} color="#3B82F6" />
          <StatCard icon="checkmark-circle" label="Successful" value={stats.successful.toString()} color="#00C853" />
          <StatCard icon="alert-circle" label="Failed" value={stats.failed.toString()} color="#FF5252" />
        </View>
        <View style={styles.statsRow}>
          <StatCard icon="phone-portrait" label="Active Devices" value={stats.activeSessions.toString()} color="#8B5CF6" isLast />
          <View style={[statCardStyles.card, { borderColor: '#FFC10730', marginLeft: SPACING.sm, flex: 1 }]}>
            <Ionicons name="time" size={20} color="#FFC107" />
            <Text style={[statCardStyles.value, { color: '#FFC107', fontSize: FONTS.size.sm }]}>
              {formatRelativeTime(stats.lastLogin)}
            </Text>
            <Text style={statCardStyles.label}>Last Login</Text>
          </View>
        </View>

        {/* ── Active Sessions ── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Active Sessions
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
          Devices currently signed in to your account
        </Text>

        {MOCK_ACTIVE_SESSIONS.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            onLogout={handleRemoteLogout}
            colors={colors}
          />
        ))}

        {/* Logout All Button */}
        {MOCK_ACTIVE_SESSIONS.filter(s => !s.isCurrentDevice).length > 0 && (
          <AnimatedPressable
            onPress={handleLogoutAll}
            haptic="warning"
            scaleTo={0.97}
          >
            <View style={[styles.logoutAllBtn, { borderColor: '#FF525240' }]}>
              <Ionicons name="log-out-outline" size={18} color="#FF5252" />
              <Text style={styles.logoutAllBtnText}>
                Log Out {MOCK_ACTIVE_SESSIONS.filter(s => !s.isCurrentDevice).length} Other Device{MOCK_ACTIVE_SESSIONS.filter(s => !s.isCurrentDevice).length !== 1 ? 's' : ''}
              </Text>
            </View>
          </AnimatedPressable>
        )}

        {/* ── Login History ── */}
        <View style={styles.sectionRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Login History
            </Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
              Recent login attempts on your account
            </Text>
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <FilterChip label="All" active={activeFilter === 'all'} onPress={() => setActiveFilter('all')} color={colors.primary} />
          <FilterChip label="Successful" active={activeFilter === 'success'} onPress={() => setActiveFilter('success')} color="#00C853" />
          <FilterChip label="Failed" active={activeFilter === 'failed'} onPress={() => setActiveFilter('failed')} color="#FF5252" />
        </ScrollView>

        {/* Login event list */}
        <View style={[styles.historyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {displayedHistory.length > 0 ? (
            displayedHistory.map((event, i) => (
              <Animated.View key={event.id} entering={FadeInDown.delay(i * 40).springify()}>
                <LoginEventRow event={event} colors={colors} />
              </Animated.View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No {activeFilter === 'success' ? 'failed' : 'successful'} logins found
              </Text>
            </View>
          )}

          {/* Show more / less */}
          {filteredHistory.length > 5 && (
            <Pressable
              onPress={() => setShowAllHistory(prev => !prev)}
              style={[styles.showMoreBtn, { borderTopColor: colors.divider }]}
            >
              <Text style={[styles.showMoreText, { color: colors.primary }]}>
                {showAllHistory ? 'Show Less' : `Show All (${filteredHistory.length})`}
              </Text>
              <Ionicons
                name={showAllHistory ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.primary}
              />
            </Pressable>
          )}
        </View>

        {/* ── Info Card ── */}
        <View style={[styles.infoCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Stay Secure</Text>
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              Regularly review your active sessions and log out devices you don't recognize.
              If you see suspicious activity, change your password immediately and enable 2FA.
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
  header: {
    padding: SPACING.xl,
    paddingTop: 60,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backBtn: { padding: 4 },
  title: { ...FONTS.bold, fontSize: FONTS.size.title, color: '#FFFFFF' },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, marginTop: 4 },

  scrollContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },

  // Sections
  sectionTitle: { ...FONTS.bold, fontSize: FONTS.size.md, marginTop: 0 },
  sectionSubtitle: { ...FONTS.regular, fontSize: FONTS.size.xs, marginBottom: SPACING.md, marginTop: 2 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Filter
  filterScroll: { marginBottom: SPACING.md },

  // History
  historyCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.sm,
  },
  emptyText: { ...FONTS.regular, fontSize: FONTS.size.sm },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  showMoreText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },

  // Logout All
  logoutAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  logoutAllBtnText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: '#FF5252', fontWeight: '600' },

  // Info
  infoCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  infoTitle: { ...FONTS.semiBold, fontSize: FONTS.size.sm, marginBottom: 4 },
  infoText: { ...FONTS.regular, fontSize: FONTS.size.xs, lineHeight: 18 },
});
