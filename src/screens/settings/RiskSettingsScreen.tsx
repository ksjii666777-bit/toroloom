import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
  Switch, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import {
  useRiskStore, selectIsLockdownActive, selectCanTrade,
  selectExitOnlyMode, selectDailyPnL, selectDailyLossPercent,
} from '../../store/riskStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency} from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

Dimensions.get('window');

export default function RiskSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const store = useRiskStore();
  const [activeTab, setActiveTab] = useState<'limits' | 'status'>('limits');

  const {
    lockdown, today, limits, settingsFrozen, portfolioValueAtOpen,
    syncFromBackend, checkActionAllowed, updateLimits, resetDaily,
  } = store;

  const isLockdown = selectIsLockdownActive(store);
  const _canTrade = selectCanTrade(store);
  const _exitOnly = selectExitOnlyMode(store);
  const dailyPnL = selectDailyPnL(store);
  const dailyLossPct = selectDailyLossPercent(store);

  useEffect(() => {
    syncFromBackend();
  }, [syncFromBackend]);

  const formatTimeRemaining = () => {
    if (!lockdown.liftsAt) return t('app.na');
    const lifts = new Date(lockdown.liftsAt).getTime();
    const now = Date.now();
    const diff = lifts - now;
    if (diff <= 0) return t('riskSettings.liftingSoon');
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  };

  const toggleLimit = async (key: keyof typeof limits, current: boolean) => {
    const result = await updateLimits({ [key]: !current } as Partial<import('../../store/riskStore').RiskLimits>);
    if (!result.success) {
      Alert.alert(t('riskSettings.settingsFrozenTitle'), result.message);
    }
  };

  const adjustLimit = async (key: keyof typeof limits, delta: number) => {
    const current = limits[key] as number;
    const newVal = Math.max(0, current + delta);
    const result = await updateLimits({ [key]: newVal } as Partial<import('../../store/riskStore').RiskLimits>);
    if (!result.success) {
      Alert.alert(t('riskSettings.settingsFrozenTitle'), result.message);
    }
  };

  const riskLimitsConfig: {
    key: keyof typeof limits;
    label: string;
    description: string;
    type: 'number' | 'boolean';
    icon: string;
    color: string;
    unit?: string;
    step?: number;
    min?: number;
  }[] = [
    {
      key: 'dailyLossLimit',
      label: 'Daily Loss Limit',
      description: 'Maximum rupee loss allowed per day',
      type: 'number',
      icon: 'cash-outline',
      color: '#FF1744',
      unit: '₹',
      step: 5000,
      min: 0,
    },
    {
      key: 'dailyLossPercentLimit',
      label: 'Daily Loss % Limit',
      description: 'Maximum portfolio loss percentage per day',
      type: 'number',
      icon: 'trending-down',
      color: '#FF6B6B',
      unit: '%',
      step: 1,
      min: 0,
    },
    {
      key: 'maxPositionSizePercent',
      label: 'Max Position Size',
      description: 'Maximum % of portfolio in a single position',
      type: 'number',
      icon: 'pie-chart-outline',
      color: '#6C63FF',
      unit: '%',
      step: 5,
      min: 1,
    },
    {
      key: 'maxLeverage',
      label: 'Max Leverage',
      description: 'Maximum leverage allowed for intraday',
      type: 'number',
      icon: 'rocket-outline',
      color: '#00D2FF',
      unit: 'x',
      step: 1,
      min: 1,
    },
    {
      key: 'allowIntraday',
      label: 'Intraday Trading',
      description: 'Allow intraday (MIS) orders',
      type: 'boolean',
      icon: 'flash-outline',
      color: '#FFC107',
    },
    {
      key: 'allowFNO',
      label: 'F&O Trading',
      description: 'Allow Futures & Options trading',
      type: 'boolean',
      icon: 'options-outline',
      color: '#9C27B0',
    },
  ];

  const tradeChecks = [
    { action: 'BUY' as const, label: 'Buy Stocks', icon: 'cart-outline' },
    { action: 'SELL' as const, label: 'Sell Stocks', icon: 'arrow-down-outline' },
    { action: 'SQUARE_OFF' as const, label: 'Square Off', icon: 'close-circle-outline' },
    { action: 'MODIFY' as const, label: 'Modify Orders', icon: 'create-outline' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>{t('riskSettings.title')}</Text>
            <Text style={styles.subtitle}>{t('riskSettings.subtitle')}</Text>
          </View>
        </View>

        {/* Lockdown Banner */}
        {isLockdown && (
          <LinearGradient colors={GRADIENTS.danger} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.lockdownBanner}>
            <View style={styles.lockdownRow}>
              <Ionicons name="shield-checkmark" size={28} color={colors.white} />
              <View style={styles.lockdownInfo}>
                <Text style={styles.lockdownTitle}>{t('riskSettings.bodyguardActive')}</Text>
                <Text style={styles.lockdownDesc}>
                  {lockdown.status === 'cooldown' ? t('riskSettings.cooldownPeriod') : t('riskSettings.exitOnlyMode')} — {t('riskSettings.squareOffOnly')}
                </Text>
              </View>
            </View>
            <View style={styles.lockdownDetails}>
              <View style={styles.lockdownDetail}>
                <Text style={styles.lockdownDetailLabel}>{t('riskSettings.lockdownLiftsIn')}</Text>
                <Text style={styles.lockdownDetailValue}>{formatTimeRemaining()}</Text>
              </View>
              <View style={styles.lockdownDetailDivider} />
              <View style={styles.lockdownDetail}>
                <Text style={styles.lockdownDetailLabel}>{t('riskSettings.triggerLoss')}</Text>
                <Text style={styles.lockdownDetailValue}>
                  {lockdown.triggerLoss ? formatCurrency(lockdown.triggerLoss) : '—'}
                </Text>
              </View>
              <View style={styles.lockdownDetailDivider} />
              <View style={styles.lockdownDetail}>
                <Text style={styles.lockdownDetailLabel}>{t('riskSettings.breached')}</Text>
                <Text style={styles.lockdownDetailValue}>
                  {lockdown.breachedLimit === 'daily_loss' ? t('riskSettings.rupeeLimit') : t('riskSettings.percentLimit')}
                </Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Tab Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeTab === 'limits' && styles.toggleBtnActive]}
            onPress={() => setActiveTab('limits')}
          >
            <Ionicons name="options-outline" size={16} color={activeTab === 'limits' ? colors.white : colors.textMuted} />
            <Text style={[styles.toggleText, activeTab === 'limits' && styles.toggleTextActive]}>{t('riskSettings.limits')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeTab === 'status' && styles.toggleBtnActive]}
            onPress={() => setActiveTab('status')}
          >
            <Ionicons name="shield-checkmark-outline" size={16} color={activeTab === 'status' ? colors.white : colors.textMuted} />
            <Text style={[styles.toggleText, activeTab === 'status' && styles.toggleTextActive]}>{t('riskSettings.status')}</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'limits' ? (
          <>
            {/* Settings Frozen Notice */}
            {settingsFrozen && (
              <View style={styles.frozenBanner}>
                <Ionicons name="lock-closed" size={18} color="#FFC107" />
                <Text style={styles.frozenText}>{t('riskSettings.settingsFrozenDesc')}</Text>
              </View>
            )}

            {/* Risk Limits */}
            <Card title={t('riskSettings.riskLimits')} subtitle={t('riskSettings.riskLimitsSubtitle')}>
              <View style={styles.limitsList}>
                {riskLimitsConfig.map((item, i) => (
                  <View key={item.key}>
                    <View style={styles.limitRow}>
                      <View style={[styles.limitIcon, { backgroundColor: item.color + '20' }]}>
                        <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={20} color={item.color} />
                      </View>
                      <View style={styles.limitInfo}>
                        <Text style={styles.limitLabel}>{t('riskSettings.' + item.key)}</Text>
                        <Text style={styles.limitDesc}>{t('riskSettings.' + item.key + 'Desc')}</Text>
                      </View>
                      {item.type === 'number' ? (
                        <View style={styles.limitControls}>
                          <TouchableOpacity
                            style={[styles.limitBtn, settingsFrozen && styles.limitBtnDisabled]}
                            onPress={() => adjustLimit(item.key, -(item.step || 1))}
                            disabled={settingsFrozen}
                          >
                            <Ionicons name="remove" size={16} color={settingsFrozen ? colors.textMuted : colors.primary} />
                          </TouchableOpacity>
                          <Text style={styles.limitValue}>
                            {item.unit}{limits[item.key] as number}
                          </Text>
                          <TouchableOpacity
                            style={[styles.limitBtn, settingsFrozen && styles.limitBtnDisabled]}
                            onPress={() => adjustLimit(item.key, item.step || 1)}
                            disabled={settingsFrozen}
                          >
                            <Ionicons name="add" size={16} color={settingsFrozen ? colors.textMuted : colors.primary} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Switch
                          value={limits[item.key] as boolean}
                          onValueChange={(val) => toggleLimit(item.key, val)}
                          disabled={settingsFrozen}
                          trackColor={{ false: colors.border, true: colors.primary + '60' }}
                          thumbColor={limits[item.key] as boolean ? colors.primary : colors.textMuted}
                        />
                      )}
                    </View>
                    {i < riskLimitsConfig.length - 1 && <View style={styles.limitDivider} />}
                  </View>
                ))}
              </View>
            </Card>

            {/* Action Check */}
            <Card title={t('riskSettings.tradeActionCheck')} subtitle={t('riskSettings.tradeActionCheckSub')} style={{ marginTop: SPACING.md }}>
              <View style={styles.checksList}>
                {tradeChecks.map(check => {
                  const result = checkActionAllowed(check.action);
                  return (
                    <View key={check.action} style={styles.checkRow}>
                      <View style={styles.checkLeft}>
                        <Ionicons name={check.icon as keyof typeof Ionicons.glyphMap} size={18} color={result.allowed ? '#00C853' : '#FF1744'} />
                        <Text style={styles.checkLabel}>{t('riskSettings.' + check.action.toLowerCase())}</Text>
                      </View>
                      <View style={[styles.checkBadge, { backgroundColor: result.allowed ? '#00C85320' : '#FF174420' }]}>
                        <Ionicons
                          name={result.allowed ? 'checkmark-circle' : 'close-circle'}
                          size={14}
                          color={result.allowed ? '#00C853' : '#FF1744'}
                        />
                        <Text style={[styles.checkText, { color: result.allowed ? '#00C853' : '#FF1744' }]}>
                          {result.allowed ? t('riskSettings.allowed') : t('riskSettings.blocked')}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          </>
        ) : (
          <>
            {/* Daily MTM Status */}
            <Card title={t('riskSettings.dailyPnLStatus')} subtitle={t('riskSettings.dailyPnLSub')}>
              <View style={styles.mtmHeader}>
                <View style={styles.mtmMain}>
                  <Text style={styles.mtmLabel}>{t('riskSettings.realizedPnL')}</Text>
                  <Text style={[styles.mtmValue, { color: today.realizedPnL >= 0 ? '#00C853' : '#FF1744' }]}>
                    {today.realizedPnL >= 0 ? '+' : ''}{formatCurrency(today.realizedPnL)}
                  </Text>
                </View>
                <View style={styles.mtmDivider} />
                <View style={styles.mtmMain}>
                  <Text style={styles.mtmLabel}>{t('riskSettings.unrealizedPnL')}</Text>
                  <Text style={[styles.mtmValue, { color: today.unrealizedPnL >= 0 ? '#00C853' : '#FF1744' }]}>
                    {today.unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(today.unrealizedPnL)}
                  </Text>
                </View>
              </View>

              <View style={styles.mtmStats}>
                <View style={styles.mtmStat}>
                  <Text style={styles.mtmStatLabel}>{t('riskSettings.totalPnL')}</Text>
                  <Text style={[styles.mtmStatValue, { color: dailyPnL >= 0 ? '#00C853' : '#FF1744' }]}>
                    {dailyPnL >= 0 ? '+' : ''}{formatCurrency(dailyPnL, true)}
                  </Text>
                </View>
                <View style={styles.mtmStat}>
                  <Text style={styles.mtmStatLabel}>{t('riskSettings.lossPercent')}</Text>
                  <Text style={[styles.mtmStatValue, { color: dailyPnL >= 0 ? colors.text : '#FF1744' }]}>
                    {(dailyLossPct).toFixed(2)}%
                  </Text>
                </View>
                <View style={styles.mtmStat}>
                  <Text style={styles.mtmStatLabel}>{t('riskSettings.trades')}</Text>
                  <Text style={styles.mtmStatValue}>{today.tradeCount}</Text>
                </View>
                <View style={styles.mtmStat}>
                  <Text style={styles.mtmStatLabel}>{t('riskSettings.charges')}</Text>
                  <Text style={styles.mtmStatValue}>{formatCurrency(today.totalCharges, true)}</Text>
                </View>
              </View>

              {/* Progress toward limits */}
              <View style={styles.limitProgressSection}>
                <Text style={styles.limitProgressTitle}>{t('riskSettings.lossLimitProgress')}</Text>
                <View style={styles.limitProgress}>
                  <View style={styles.limitProgressInfo}>
                    <Text style={styles.limitProgressLabel}>
                      ₹ Limit: {formatCurrency(Math.abs(today.realizedPnL), true)} / {formatCurrency(limits.dailyLossLimit, true)}
                    </Text>
                    <Text style={styles.limitProgressPct}>
                      {limits.dailyLossLimit > 0 ? Math.round((Math.abs(today.realizedPnL) / limits.dailyLossLimit) * 100) : 0}%
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[styles.progressBarFill, {
                        width: `${limits.dailyLossLimit > 0 ? Math.min(100, (Math.abs(today.realizedPnL) / limits.dailyLossLimit) * 100) : 0}%`,
                        backgroundColor: (Math.abs(today.realizedPnL) / limits.dailyLossLimit) > 0.8 ? '#FF1744' : '#00C853',
                      }]}
                    />
                  </View>
                </View>
                <View style={[styles.limitProgress, { marginTop: SPACING.sm }]}>
                  <View style={styles.limitProgressInfo}>
                    <Text style={styles.limitProgressLabel}>
                      % Limit: {dailyLossPct.toFixed(1)}% / {limits.dailyLossPercentLimit}%
                    </Text>
                    <Text style={styles.limitProgressPct}>
                      {limits.dailyLossPercentLimit > 0 ? Math.round((dailyLossPct / limits.dailyLossPercentLimit) * 100) : 0}%
                    </Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[styles.progressBarFill, {
                        width: `${limits.dailyLossPercentLimit > 0 ? Math.min(100, (dailyLossPct / limits.dailyLossPercentLimit) * 100) : 0}%`,
                        backgroundColor: (dailyLossPct / limits.dailyLossPercentLimit) > 0.8 ? '#FF1744' : '#00C853',
                      }]}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.portfolioValueInfo}>
                <Text style={styles.portfolioValueLabel}>{t('riskSettings.portfolioValueAtOpen')}</Text>
                <Text style={styles.portfolioValueAmount}>{formatCurrency(portfolioValueAtOpen, true)}</Text>
              </View>
            </Card>

            {/* Lockdown History */}
            <Card title={t('riskSettings.lockdownStatus')} style={{ marginTop: SPACING.md }}>
              <View style={styles.lockdownInfoRow}>
                <Text style={styles.lockdownInfoLabel}>{t('riskSettings.status')}</Text>
                <Badge
                  label={lockdown.status === 'none' ? t('riskSettings.normal') : lockdown.status === 'active' ? t('riskSettings.active') : t('riskSettings.cooldown')}
                  variant={lockdown.status === 'none' ? 'success' : 'danger'}
                />
              </View>
              {lockdown.triggeredAt && (
                <View style={styles.lockdownInfoRow}>
                  <Text style={styles.lockdownInfoLabel}>{t('riskSettings.triggeredAt')}</Text>
                  <Text style={styles.lockdownInfoValue}>
                    {new Date(lockdown.triggeredAt).toLocaleString()}
                  </Text>
                </View>
              )}
              {lockdown.liftsAt && (
                <View style={styles.lockdownInfoRow}>
                  <Text style={styles.lockdownInfoLabel}>{t('riskSettings.liftsAt')}</Text>
                  <Text style={styles.lockdownInfoValue}>
                    {new Date(lockdown.liftsAt).toLocaleString()}
                  </Text>
                </View>
              )}
              <View style={styles.lockdownInfoRow}>
                <Text style={styles.lockdownInfoLabel}>{t('riskSettings.settingsFrozen')}</Text>
                <Badge label={settingsFrozen ? t('app.yes') : t('app.no')} variant={settingsFrozen ? 'danger' : 'success'} />
              </View>
            </Card>

            {/* Reset Daily */}
            <Button
              title={t('riskSettings.resetDailyPnL')}
              onPress={() => resetDaily()}
              variant="outline"
              style={{ marginTop: SPACING.lg }}
            />
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.title,
    color: colors.text,
  },
  subtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  lockdownBanner: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  lockdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  lockdownInfo: {
    flex: 1,
  },
  lockdownTitle: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: colors.white,
  },
  lockdownDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  lockdownDetails: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  lockdownDetail: {
    flex: 1,
    alignItems: 'center',
  },
  lockdownDetailDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  lockdownDetailLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  lockdownDetailValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.white,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.white,
  },
  frozenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: '#FFC10715',
    borderWidth: 1,
    borderColor: '#FFC10730',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  frozenText: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: '#FFC107',
    flex: 1,
  },
  limitsList: {
    gap: 0,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  limitIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  limitInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  limitLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  limitDesc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  limitControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  limitBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  limitBtnDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.bgCardLight,
  },
  limitValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
    minWidth: 40,
    textAlign: 'center',
  },
  limitDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  checksList: {
    gap: 0,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  checkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  checkLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  checkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  checkText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  mtmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mtmMain: {
    flex: 1,
    alignItems: 'center',
  },
  mtmDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.divider,
    marginHorizontal: SPACING.lg,
  },
  mtmLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  mtmValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    marginTop: 4,
  },
  mtmStats: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    backgroundColor: colors.bgCardLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  mtmStat: {
    flex: 1,
    alignItems: 'center',
  },
  mtmStatLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  mtmStatValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
    marginTop: 4,
  },
  limitProgressSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  limitProgressTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
    marginBottom: SPACING.md,
  },
  limitProgress: {
    marginBottom: SPACING.sm,
  },
  limitProgressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  limitProgressLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  limitProgressPct: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.text,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.bgCardLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  portfolioValueInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  portfolioValueLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  portfolioValueAmount: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  lockdownInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  lockdownInfoLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  lockdownInfoValue: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
});
