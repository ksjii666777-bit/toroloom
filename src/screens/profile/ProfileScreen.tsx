import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useAuthStore, useKycStore } from '../../store';
import { useGamificationStore } from '../../store/gamificationStore';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency, formatDate } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
Dimensions.get('window');

const kycSteps = [
  { key: 'pan', label: 'PAN Verification', icon: 'card-outline', done: false },
  { key: 'aadhaar', label: 'Aadhaar Verification', icon: 'finger-print-outline', done: false },
  { key: 'digilocker', label: 'DigiLocker', icon: 'cloud-done-outline', done: false },
  { key: 'bank', label: 'Bank Linking', icon: 'business-outline', done: false },
  { key: 'complete', label: 'Complete KYC', icon: 'shield-checkmark-outline', done: false },
];

// Step screen mapping
const KYC_SCREENS: Record<string, string> = {
  pan: 'PanVerification',
  aadhaar: 'AadhaarVerification',
  digilocker: 'DigiLocker',
};

export default function ProfileScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, logout } = useAuthStore();
  const { userLevel } = useGamificationStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'kyc'>('profile');

  // ─── Persisted KYC Store ────────────────────────────────────────────
  const {
    completedSteps, initialized: kycInitialized,
    loadKycState, markStepCompleted,
  } = useKycStore();

  // Hydrate KYC state from AsyncStorage on mount
  useEffect(() => {
    if (!kycInitialized) {
      loadKycState();
    }
  }, [kycInitialized, loadKycState]);

  // Compute display state from store
  const kycStepsDisplay = useMemo(() =>
    kycSteps.map(step => ({
      ...step,
      done: completedSteps[step.key as keyof typeof completedSteps] || false,
    })),
  [completedSteps]);

  // Count completed steps from store
  const completedStepsCount = Object.values(completedSteps).filter(Boolean).length;

  // Navigation handler for each KYC step
  const handleKycStepPress = useCallback((stepKey: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (stepKey === 'complete') {
      const haptic = completedStepsCount >= 4
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning;
      Haptics.notificationAsync(haptic);
      return;
    }

    if (stepKey === 'bank') {
      navigation.navigate('BankLinking', {
        onVerified: () => {
          markStepCompleted('bank');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      });
      return;
    }

    const screen = KYC_SCREENS[stepKey];
    if (screen) {
      navigation.navigate(screen, {
        onVerified: () => {
          // Persist to AsyncStorage via store
          markStepCompleted(stepKey as 'pan' | 'aadhaar' | 'digilocker' | 'bank');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      });
    }
  }, [navigation, completedStepsCount, markStepCompleted]);


  const accountDetails = [
    { label: 'Account Type', value: 'Individual (Non-DP)' },
    { label: 'Trading Account', value: 'TOR12345678' },
    { label: 'DP ID', value: 'IN300123 | CDSL' },
    { label: 'Broker', value: 'Toroloom Securities' },
    { label: 'Account Opened', value: user?.createdAt ? formatDate(user.createdAt) : '15 Jan 2024' },
    { label: 'PAN', value: user?.panNumber || 'ABCDE1234F' },
    { label: 'Email', value: user?.email || 'user@email.com' },
    { label: 'Phone', value: user?.phone || '+91 98765 43210' },
  ];

  const bankDetails = [
    { bank: 'HDFC Bank', account: '****1234', ifsc: 'HDFC0001234', type: 'Savings', primary: true },
    { bank: 'ICICI Bank', account: '****5678', ifsc: 'ICIC0005678', type: 'Savings', primary: false },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Profile & KYC</Text>
        </View>

        {/* Profile Banner */}
        <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
          <View style={styles.bannerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.[0] || 'R'}</Text>
            </View>
            <View style={styles.bannerInfo}>
              <Text style={styles.bannerName}>{user?.name || 'Rahul Sharma'}</Text>
              <Text style={styles.bannerLevel}>{userLevel.title} · Level {userLevel.level}</Text>
              <View style={styles.bannerBadges}>
                <Badge label={`PAN: ${user?.panNumber || 'ABCDE1234F'}`} variant="primary" size="medium" />
                {user?.kycStatus === 'verified' && <Badge label="KYC ✓" variant="success" size="medium" />}
              </View>
            </View>
          </View>
          <View style={styles.bannerStats}>
            <View style={styles.bannerStat}>
              <Text style={styles.bannerStatValue}>{formatCurrency(user?.balance || 2500000, true)}</Text>
              <Text style={styles.bannerStatLabel}>Available Balance</Text>
            </View>
            <View style={styles.bannerStatDivider} />
            <View style={styles.bannerStat}>
              <Text style={styles.bannerStatValue}>{userLevel.totalXp.toLocaleString()} XP</Text>
              <Text style={styles.bannerStatLabel}>Lifetime XP</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.quickActionsGrid}>
          {[
            { icon: 'add-circle', label: 'Add Funds', color: '#00C853', gradient: GRADIENTS.success },
            { icon: 'arrow-up-circle', label: 'Withdraw', color: '#FF1744', gradient: GRADIENTS.danger },
            { icon: 'swap-horizontal', label: 'Transfer', color: '#6C63FF', gradient: GRADIENTS.primary },
            { icon: 'qr-code', label: 'UPI Settings', color: '#00D2FF', gradient: GRADIENTS.accent },
          ].map((action, idx) => (
            <TouchableOpacity key={idx} style={styles.quickAction}>
              <LinearGradient colors={action.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.qaIcon}>
                <Ionicons name={action.icon as keyof typeof Ionicons.glyphMap} size={24} color={colors.white} />
              </LinearGradient>
              <Text style={styles.qaLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeTab === 'profile' && styles.toggleBtnActive]}
            onPress={() => setActiveTab('profile')}
          >
            <Ionicons name="person-outline" size={16} color={activeTab === 'profile' ? colors.white : colors.textMuted} />
            <Text style={[styles.toggleText, activeTab === 'profile' && styles.toggleTextActive]}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeTab === 'kyc' && styles.toggleBtnActive]}
            onPress={() => setActiveTab('kyc')}
          >
            <Ionicons name="shield-checkmark-outline" size={16} color={activeTab === 'kyc' ? colors.white : colors.textMuted} />
            <Text style={[styles.toggleText, activeTab === 'kyc' && styles.toggleTextActive]}>KYC & Banks</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'profile' ? (
          <>
            {/* Account Details */}
            <Card title="Account Details" subtitle="Your trading account information">
              <View style={styles.detailsList}>
                {accountDetails.map((item, _i) => (
                  <View key={item.label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{item.label}</Text>
                    <Text style={styles.detailValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </Card>

            {/* Personal Info */}
            <Card title="Personal Information" style={{ marginTop: SPACING.md }}>
              <TouchableOpacity style={styles.menuRow}>
                <View style={[styles.menuIconBox, { backgroundColor: '#6C63FF20' }]}>
                  <Ionicons name="person" size={18} color="#6C63FF" />
                </View>
                <View style={styles.menuRowInfo}>
                  <Text style={styles.menuRowLabel}>Edit Profile</Text>
                  <Text style={styles.menuRowSub}>Name, email, phone</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuRow}>
                <View style={[styles.menuIconBox, { backgroundColor: '#00D2FF20' }]}>
                  <Ionicons name="lock-closed" size={18} color="#00D2FF" />
                </View>
                <View style={styles.menuRowInfo}>
                  <Text style={styles.menuRowLabel}>Change Password</Text>
                  <Text style={styles.menuRowSub}>Update your login password</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('NotificationPreferences')}>
                <View style={[styles.menuIconBox, { backgroundColor: '#FFC10720' }]}>
                  <Ionicons name="notifications" size={18} color="#FFC107" />
                </View>
                <View style={styles.menuRowInfo}>
                  <Text style={styles.menuRowLabel}>Notification Preferences</Text>
                  <Text style={styles.menuRowSub}>Manage alerts and updates</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </Card>
          </>
        ) : (
          <>
            {/* KYC Status */}
            <Card title="KYC Status" subtitle="Complete your verification" style={{ marginBottom: SPACING.md }}>
              <View style={styles.kycHeader}>
                <View style={[styles.kycStatusBadge, {
                  backgroundColor: completedStepsCount >= 4 ? '#00C85320' : colors.bgInput,
                }]}>
                  <Ionicons
                    name={completedStepsCount >= 4 ? 'checkmark-circle' : 'time-outline'}
                    size={20}
                    color={completedStepsCount >= 4 ? '#00C853' : colors.textMuted}
                  />
                  <Text style={[styles.kycStatusText, {
                    color: completedStepsCount >= 4 ? '#00C853' : colors.textMuted,
                  }]}>
                    {completedStepsCount >= 4 ? 'KYC Verified' : `${completedStepsCount}/4 Steps Complete`}
                  </Text>
                </View>
              </View>
              {/* Progress Bar */}
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(completedStepsCount / 4) * 100}%` }]} />
              </View>
              <View style={styles.kycSteps}>
                {kycStepsDisplay.map((step) => (
                  <TouchableOpacity
                    key={step.key}
                    style={styles.kycStepRow}
                    onPress={() => handleKycStepPress(step.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.kycStepIcon,
                      step.done ? { backgroundColor: '#00C85320' }
                        : step.key === 'complete' && completedStepsCount >= 4
                          ? { backgroundColor: colors.primary + '20' }
                          : { backgroundColor: colors.bgInput },
                    ]}>
                      <Ionicons
                        name={step.done ? 'checkmark-circle'
                          : (step.key === 'complete' && completedStepsCount >= 4)
                            ? 'checkmark-circle'
                            : step.icon as keyof typeof Ionicons.glyphMap}
                        size={20}
                        color={step.done ? '#00C853'
                          : (step.key === 'complete' && completedStepsCount >= 4)
                            ? colors.primary
                            : colors.textMuted}
                      />
                    </View>
                    <Text style={[
                      styles.kycStepLabel,
                      (step.done || (step.key === 'complete' && completedStepsCount >= 4))
                        ? { color: colors.text }
                        : {},
                    ]}>
                      {step.label}
                    </Text>
                    {step.done && (
                      <Ionicons name="checkmark" size={16} color={colors.success} />
                    )}
                    {!step.done && step.key !== 'complete' && (
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              {/* Helper text */}
              {completedStepsCount < 4 && (
                <Text style={styles.kycHelperText}>
                  Tap on a step to start verification. Complete all 4 steps to finish KYC.
                </Text>
              )}
            </Card>

            {/* Linked Bank Accounts */}
            <Card title="Linked Bank Accounts" subtitle={`${bankDetails.length} account(s) linked`}>
              {bankDetails.map((bank, i) => (
                <View key={i}>
                  <View style={styles.bankCard}>
                    <View style={styles.bankRow}>
                      <View style={[styles.bankIcon, { backgroundColor: '#6C63FF20' }]}>
                        <Ionicons name="business" size={20} color="#6C63FF" />
                      </View>
                      <View style={styles.bankInfo}>
                        <View style={styles.bankNameRow}>
                          <Text style={styles.bankName}>{bank.bank}</Text>
                          {bank.primary && <Badge label="Primary" variant="primary" />}
                        </View>
                        <Text style={styles.bankAccount}>{bank.account} · {bank.type}</Text>
                        <Text style={styles.bankIfsc}>IFSC: {bank.ifsc}</Text>
                      </View>
                    </View>
                  </View>
                  {i < bankDetails.length - 1 && <View style={styles.menuDivider} />}
                </View>
              ))}
              <TouchableOpacity
                style={styles.addBankBtn}
                onPress={() => navigation.navigate('BankLinking', {
                  onVerified: () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  },
                })}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.addBankText}>Add Bank Account</Text>
              </TouchableOpacity>
            </Card>
          </>
        )}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

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
  banner: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxxl,
    color: colors.white,
  },
  bannerInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  bannerName: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.white,
  },
  bannerLevel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  bannerBadges: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  bannerStats: {
    flexDirection: 'row',
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  bannerStat: {
    flex: 1,
    alignItems: 'center',
  },
  bannerStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  bannerStatValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.white,
  },
  bannerStatLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  quickAction: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  qaIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qaLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.text,
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
  detailsList: {
    gap: 0,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  detailLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    flex: 1,
  },
  detailValue: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
    textAlign: 'right',
    flex: 1.5,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuRowInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  menuRowLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.text,
  },
  menuRowSub: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  kycHeader: {
    marginBottom: SPACING.lg,
  },
  kycStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  kycStatusText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: '#00C853',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgInput,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.success,
  },
  kycSteps: {
    gap: 0,
  },
  kycStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    position: 'relative',
  },
  kycStepIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kycStepLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    flex: 1,
  },
  kycHelperText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  kycStepLine: {
    position: 'absolute',
    left: 17,
    top: 44,
    width: 2,
    height: 20,
    backgroundColor: colors.divider,
  },
  bankCard: {
    paddingVertical: SPACING.md,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  bankNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bankName: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  bankAccount: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bankIfsc: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  addBankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    marginTop: SPACING.md,
  },
  addBankText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  logoutText: {
    ...FONTS.medium,
    fontSize: FONTS.size.md,
    color: colors.danger,
  },
});
