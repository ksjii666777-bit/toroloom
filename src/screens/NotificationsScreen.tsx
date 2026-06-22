import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '../store/notificationStore';
import { useTheme } from '../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import { formatRelativeTime } from '../utils/formatters';
import Card from '../components/ui/Card';

const NOTIFICATION_ICONS: Record<string, { icon: string; color: string }> = {
  price_alert: { icon: 'trending-up', color: '#FFC107' },
  trade: { icon: 'swap-horizontal', color: '#00C853' },
  educational: { icon: 'school', color: '#6C63FF' },
  news: { icon: 'newspaper', color: '#00D2FF' },
  system: { icon: 'settings', color: '#6E6E9A' },
};

const TYPE_LABELS: Record<string, string> = {
  price_alert: 'Price Alert',
  trade: 'Trade',
  educational: 'Learning',
  news: 'News',
  system: 'System',
};

export default function NotificationsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const {
    notifications,
    preferences,
    priceAlertRules,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    updatePreference,
    removePriceAlertRule,
  } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<'all' | 'alerts' | 'trades' | 'learning'>('all');

  const unreadCountLocal = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case 'alerts': return notifications.filter(n => n.type === 'price_alert');
      case 'trades': return notifications.filter(n => n.type === 'trade');
      case 'learning': return notifications.filter(n => n.type === 'educational');
      default: return notifications;
    }
  }, [notifications, activeTab]);

  const sections = useMemo(() => {
    const grouped: Record<string, typeof notifications> = {};
    const today = new Date().toDateString();

    filteredNotifications.forEach(n => {
      const notifDate = new Date(n.timestamp).toDateString();
      const key = notifDate === today
        ? 'Today'
        : new Date(n.timestamp).toLocaleDateString('en-IN', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          });
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(n);
    });

    return Object.entries(grouped).map(([title, data]) => ({ title, data }));
  }, [filteredNotifications]);

  const tabs = [
    { key: 'all', label: 'All', icon: 'notifications' },
    { key: 'alerts', label: 'Alerts', icon: 'trending-up' },
    { key: 'trades', label: 'Trades', icon: 'swap-horizontal' },
    { key: 'learning', label: 'Learning', icon: 'school' },
  ] as const;

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to remove all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearAll },
      ],
    );
  };

  const renderNotificationItem = (notification: any) => {
    const meta = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.system;

    return (
      <TouchableOpacity
        key={notification.id}
        style={[styles.notifItem, !notification.read && styles.notifUnread]}
        onPress={() => {
          if (!notification.read) markAsRead(notification.id);
          const screen =
            notification.type === 'price_alert'
              ? 'StockDetail'
              : notification.type === 'trade'
              ? 'Portfolio'
              : notification.type === 'educational'
              ? 'Learn'
              : 'Home';
          navigation.navigate(screen, notification.data || {});
        }}
        onLongPress={() => {
          Alert.alert('Notification', 'Remove this notification?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => removeNotification(notification.id) },
          ]);
        }}
      >
        <View style={[styles.notifIcon, { backgroundColor: meta.color + '20' }]}>
          <Ionicons name={meta.icon as any} size={20} color={meta.color} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={styles.notifTitle} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={styles.notifTime}>
              {formatRelativeTime(notification.timestamp)}
            </Text>
          </View>
          <Text style={styles.notifMessage} numberOfLines={2}>
            {notification.message}
          </Text>
          <View style={styles.notifFooter}>
            <View style={[styles.typeBadge, { backgroundColor: meta.color + '20' }]}>
              <Text style={[styles.typeLabel, { color: meta.color }]}>
                {TYPE_LABELS[notification.type] || notification.type}
              </Text>
            </View>
            {!notification.read && <View style={styles.unreadDot} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.bg,
        },
        header: {
          paddingTop: 60,
          paddingHorizontal: SPACING.xl,
          paddingBottom: SPACING.lg,
        },
        headerTop: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: SPACING.lg,
        },
        backBtn: {
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: colors.bgCard,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerTitle: {
          ...FONTS.bold,
          fontSize: FONTS.size.xxl,
          color: colors.text,
          flex: 1,
        },
        headerSubtitle: {
          ...FONTS.regular,
          fontSize: FONTS.size.sm,
          color: colors.textSecondary,
          marginTop: 2,
        },
        headerActions: {
          flexDirection: 'row',
          gap: SPACING.sm,
        },
        headerActionBtn: {
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: colors.bgCard,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabsScroll: {
          marginHorizontal: -SPACING.xl,
          paddingHorizontal: SPACING.xl,
        },
        tab: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: SPACING.lg,
          paddingVertical: SPACING.sm,
          borderRadius: BORDER_RADIUS.full,
          backgroundColor: colors.bgCard,
          marginRight: SPACING.sm,
        },
        tabActive: {
          backgroundColor: colors.primary + '20',
        },
        tabLabel: {
          ...FONTS.medium,
          fontSize: FONTS.size.sm,
          color: colors.textMuted,
        },
        tabLabelActive: {
          color: colors.primary,
        },
        content: {
          padding: SPACING.xl,
        },
        section: {
          marginBottom: SPACING.xxl,
        },
        sectionTitle: {
          ...FONTS.semiBold,
          fontSize: FONTS.size.sm,
          color: colors.textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: SPACING.md,
        },
        notifItem: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          padding: SPACING.md,
          marginBottom: SPACING.xs,
          borderRadius: BORDER_RADIUS.lg,
          backgroundColor: colors.bgCard,
        },
        notifUnread: {
          backgroundColor: colors.bgCardLight,
          borderLeftWidth: 3,
          borderLeftColor: colors.primary,
        },
        notifIcon: {
          width: 40,
          height: 40,
          borderRadius: 12,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: SPACING.md,
        },
        notifContent: {
          flex: 1,
        },
        notifHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        },
        notifTitle: {
          ...FONTS.semiBold,
          fontSize: FONTS.size.md,
          color: colors.text,
          flex: 1,
          marginRight: SPACING.sm,
        },
        notifTime: {
          ...FONTS.regular,
          fontSize: FONTS.size.xs,
          color: colors.textMuted,
        },
        notifMessage: {
          ...FONTS.regular,
          fontSize: FONTS.size.sm,
          color: colors.textSecondary,
          lineHeight: 18,
          marginBottom: SPACING.sm,
        },
        notifFooter: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.sm,
        },
        typeBadge: {
          paddingHorizontal: SPACING.sm,
          paddingVertical: 2,
          borderRadius: BORDER_RADIUS.full,
        },
        typeLabel: {
          ...FONTS.medium,
          fontSize: FONTS.size.xs,
        },
        unreadDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.primary,
        },
        alertRuleCard: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: SPACING.md,
          borderRadius: BORDER_RADIUS.lg,
          backgroundColor: colors.bgCard,
          marginBottom: SPACING.sm,
        },
        alertRuleInfo: {
          flex: 1,
        },
        alertRuleSymbol: {
          ...FONTS.semiBold,
          fontSize: FONTS.size.md,
          color: colors.text,
        },
        alertRuleTarget: {
          ...FONTS.regular,
          fontSize: FONTS.size.sm,
          color: colors.textSecondary,
          marginTop: 2,
        },
        alertRuleRemove: {
          padding: SPACING.xs,
        },
        prefItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: SPACING.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
        },
        prefIcon: {
          width: 36,
          height: 36,
          borderRadius: 10,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: SPACING.md,
        },
        prefInfo: {
          flex: 1,
        },
        prefLabel: {
          ...FONTS.medium,
          fontSize: FONTS.size.md,
          color: colors.text,
        },
        prefDesc: {
          ...FONTS.regular,
          fontSize: FONTS.size.xs,
          color: colors.textMuted,
          marginTop: 1,
        },
        emptyState: {
          alignItems: 'center',
          paddingVertical: 60,
        },
        emptyTitle: {
          ...FONTS.bold,
          fontSize: FONTS.size.xl,
          color: colors.text,
          marginTop: SPACING.lg,
        },
        emptyDesc: {
          ...FONTS.regular,
          fontSize: FONTS.size.md,
          color: colors.textSecondary,
          textAlign: 'center',
          marginTop: SPACING.sm,
          paddingHorizontal: SPACING.xxl,
        },
      }),
    [colors],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={[colors.bg, colors.bgSecondary]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {unreadCountLocal > 0
                ? `${unreadCountLocal} unread notification${unreadCountLocal > 1 ? 's' : ''}`
                : 'All caught up! ✅'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {unreadCountLocal > 0 && (
              <TouchableOpacity onPress={markAllAsRead} style={styles.headerActionBtn}>
                <Ionicons name="checkmark-done" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
            {notifications.length > 0 && (
              <TouchableOpacity onPress={handleClearAll} style={styles.headerActionBtn}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tab Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={activeTab === tab.key ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Price Alert Rules */}
        {activeTab === 'all' && priceAlertRules.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Price Alerts</Text>
            {priceAlertRules.filter(r => !r.triggered).map(rule => (
              <View key={rule.id} style={styles.alertRuleCard}>
                <View style={styles.alertRuleInfo}>
                  <Text style={styles.alertRuleSymbol}>{rule.symbol}</Text>
                  <Text style={styles.alertRuleTarget}>
                    {rule.direction === 'above' ? '⬆ Above' : '⬇ Below'} ₹{rule.targetPrice.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => removePriceAlertRule(rule.id)}
                  style={styles.alertRuleRemove}
                >
                  <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Notification Preferences (inline settings) */}
        {activeTab === 'all' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Preferences</Text>
            <Card>
              {([
                { key: 'priceAlerts' as const, label: 'Price Alerts', icon: 'trending-up', color: '#FFC107', desc: 'Stock price movements & targets' },
                { key: 'tradeConfirmations' as const, label: 'Trade Confirmations', icon: 'swap-horizontal', color: '#00C853', desc: 'Buy/sell order updates' },
                { key: 'educationalReminders' as const, label: 'Learning Reminders', icon: 'school', color: '#6C63FF', desc: 'Course & quiz notifications' },
                { key: 'systemUpdates' as const, label: 'System Updates', icon: 'settings', color: '#6E6E9A', desc: 'KYC, account & app updates' },
              ] as const).map(item => (
                <View key={item.key} style={styles.prefItem}>
                  <View style={[styles.prefIcon, { backgroundColor: item.color + '20' }]}>
                    <Ionicons name={item.icon as any} size={18} color={item.color} />
                  </View>
                  <View style={styles.prefInfo}>
                    <Text style={styles.prefLabel}>{item.label}</Text>
                    <Text style={styles.prefDesc}>{item.desc}</Text>
                  </View>
                  <Switch
                    value={preferences[item.key]}
                    onValueChange={val => updatePreference(item.key, val)}
                    trackColor={{ false: colors.bgInput, true: colors.primary + '60' }}
                    thumbColor={preferences[item.key] ? colors.primary : colors.textMuted}
                  />
                </View>
              ))}

              {/* Price Alert Threshold */}
              <View style={styles.prefItem}>
                <View style={[styles.prefIcon, { backgroundColor: '#FFC10720' }]}>
                  <Ionicons name="speedometer" size={18} color="#FFC107" />
                </View>
                <View style={styles.prefInfo}>
                  <Text style={styles.prefLabel}>Alert Threshold</Text>
                  <Text style={styles.prefDesc}>{preferences.priceAlertThreshold}% price change</Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Notification List */}
        {sections.length > 0 ? (
          sections.map(section => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.data.map(renderNotificationItem)}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyDesc}>
              {activeTab === 'all'
                ? "You're all caught up! Notifications will appear here."
                : `No ${activeTab} notifications yet.`}
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
