/**
 * ============================================================================
 * Toroloom — Bank Account Linking Screen
 * ============================================================================
 *
 * Three-step flow:
 *   1. Enter IFSC code → verify bank & branch
 *   2. Enter account number + holder name → validate
 *   3. Set account type, primary/secondary → link & save
 *
 * Also supports managing existing linked banks (set primary, remove).
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useKycStore, LinkedBankStoreAccount } from '../../store/kycStore';
import type { IFSCVerificationResult, AccountVerificationResult } from '../../types';

// IFSC regex: 4 letters + 0 + 6 alphanumeric
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
// Account number: 9-18 digits
const ACCOUNT_REGEX = /^\d{9,18}$/;

type FlowStep = 'ifsc' | 'account' | 'verify' | 'linked' | 'manage';

export default function BankLinkingScreen({ navigation, route }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const {
    linkedBanks, addLinkedBank, removeLinkedBank, setPrimaryBank,
    markStepCompleted,
  } = useKycStore();

  const [flowStep, setFlowStep] = useState<FlowStep>('ifsc');
  const [ifscCode, setIfscCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountType, setAccountType] = useState<'savings' | 'current' | 'salary' | 'other'>('savings');
  const [isPrimary, setIsPrimary] = useState(linkedBanks.length === 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ifscResult, setIfscResult] = useState<IFSCVerificationResult | null>(null);
  const [accountResult, setAccountResult] = useState<AccountVerificationResult | null>(null);
  const [linkedAccount, setLinkedAccount] = useState<LinkedBankStoreAccount | null>(null);

  const normalizedIFSC = ifscCode.trim().toUpperCase();
  const isIFSCFormatValid = IFSC_REGEX.test(normalizedIFSC);
  const isAccountFormatValid = ACCOUNT_REGEX.test(accountNumber.replace(/\s/g, ''));
  const isNameValid = accountHolderName.trim().length >= 3;

  // ── IFSC Lookup ─────────────────────────────────────────────────
  const handleVerifyIFSC = useCallback(async () => {
    if (!isIFSCFormatValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid IFSC', 'IFSC must be 11 characters (e.g., HDFC0001234)');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call — matches backend verifyIFSC
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 300));

      const mockIFSCDB: Record<string, Omit<IFSCVerificationResult, 'ifsc' | 'isValid'>> = {
        'HDFC0001234': { bankName: 'HDFC Bank', branch: 'Andheri West', address: 'Gokul Arcade, S.V. Road, Andheri West', city: 'Mumbai', state: 'Maharashtra', contact: '1800-202-6161', micrCode: 'HDFCXXXXX' },
        'ICIC0005678': { bankName: 'ICICI Bank', branch: 'Koramangala', address: 'Plot 14, 80 Feet Road, Koramangala', city: 'Bangalore', state: 'Karnataka', contact: '1800-108-8888', micrCode: 'ICICXXXXX' },
        'SBIN0001234': { bankName: 'State Bank of India', branch: 'Connaught Place', address: '11, Sansad Marg, Connaught Place', city: 'New Delhi', state: 'Delhi', contact: '1800-1234-5678', micrCode: 'SBINXXXXX' },
        'AXIS0009012': { bankName: 'AXIS Bank', branch: 'Bandra Kurla Complex', address: 'Axis House, C-1, Bandra Kurla Complex', city: 'Mumbai', state: 'Maharashtra', contact: '1800-233-5577', micrCode: 'AXISXXXXX' },
        'YESB0003456': { bankName: 'Yes Bank', branch: 'MG Road', address: '48, MG Road, Ashok Nagar', city: 'Bangalore', state: 'Karnataka', contact: '1800-120-3500', micrCode: 'YESBXXXXX' },
      };

      const match = mockIFSCDB[normalizedIFSC];
      if (!match) {
        setError('IFSC code not found. Please check and try again.');
        setIfscResult(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      const result: IFSCVerificationResult = {
        ifsc: normalizedIFSC,
        ...match,
        isValid: true,
      };

      setIfscResult(result);
      setFlowStep('account');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError(err?.message || 'IFSC verification failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [normalizedIFSC, isIFSCFormatValid]);

  // ── Account Verification ────────────────────────────────────────
  const handleVerifyAccount = useCallback(async () => {
    if (!isAccountFormatValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Account', 'Account number must be 9-18 digits.');
      return;
    }
    if (!isNameValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Name', 'Please enter the account holder name (min 3 characters).');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call — matches backend verifyBankAccount
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

      const cleanedAccount = accountNumber.replace(/\s/g, '');
      const validNames = ['RAHUL SHARMA', 'PRIYA PATEL', 'VIKRAM REDDY', 'ARUN KUMAR',
        'DEEPIKA VERMA', 'NEHA SINGH', 'SAMEER SHINDE', 'KAJAL AGARWAL'];
      const normalizedName = accountHolderName.trim().toUpperCase();
      const nameMatches = validNames.some(n => normalizedName.includes(n) || n.includes(normalizedName));

      if (nameMatches) {
        const result: AccountVerificationResult = {
          accountNumber: cleanedAccount,
          ifsc: normalizedIFSC,
          accountHolderName: normalizedName,
          isValid: true,
          bankName: ifscResult?.bankName || '',
          message: 'Account holder name verified successfully.',
          nameMatchScore: 95,
        };
        setAccountResult(result);
        setFlowStep('verify');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError('Account holder name does not match bank records. Please verify and try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      setError(err?.message || 'Account verification failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [accountNumber, accountHolderName, normalizedIFSC, ifscResult, isAccountFormatValid, isNameValid]);

  // ── Link Account ────────────────────────────────────────────────
  const handleLinkAccount = useCallback(async () => {
    if (!accountResult || !ifscResult) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);

    try {
      const maskedAccount = 'XXXX' + accountResult.accountNumber.slice(-4);
      const newAccount: LinkedBankStoreAccount = {
        id: `bank_${Date.now()}`,
        bankName: ifscResult.bankName,
        accountNumber: maskedAccount,
        ifsc: ifscResult.ifsc,
        accountHolderName: accountResult.accountHolderName,
        accountType,
        isPrimary: isPrimary || linkedBanks.length === 0,
        linkedAt: new Date().toISOString(),
        verified: true,
      };

      await addLinkedBank(newAccount);
      setLinkedAccount(newAccount);
      setFlowStep('linked');
      markStepCompleted('bank');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError(err?.message || 'Failed to link bank account');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [accountResult, ifscResult, accountType, isPrimary, linkedBanks.length, addLinkedBank, markStepCompleted]);

  // ── Manage Banks ────────────────────────────────────────────────
  const handleRemoveBank = useCallback((accountId: string) => {
    Alert.alert(
      'Remove Bank Account',
      'Are you sure you want to remove this bank account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeLinkedBank(accountId);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ],
    );
  }, [removeLinkedBank]);

  const handleSetPrimary = useCallback((accountId: string) => {
    setPrimaryBank(accountId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [setPrimaryBank]);

  const handleContinue = useCallback(() => {
    if (route.params?.onVerified) {
      route.params.onVerified();
    }
    navigation.goBack();
  }, [navigation, route.params]);

  // ── Account Type Picker ─────────────────────────────────────────
  const ACCOUNT_TYPES: { key: typeof accountType; label: string; icon: string }[] = [
    { key: 'savings', label: 'Savings', icon: 'wallet-outline' },
    { key: 'current', label: 'Current', icon: 'business-outline' },
    { key: 'salary', label: 'Salary', icon: 'cash-outline' },
    { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
  ];

  const renderIFSCStep = () => (
    <>
      {/* Info */}
      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Enter your bank's IFSC code to fetch bank and branch details.
            IFSC is an 11-character code found on your cheque book or passbook.
          </Text>
        </View>
        <View style={styles.formatRow}>
          <Text style={styles.formatLabel}>Format:</Text>
          <Text style={styles.formatExample}>HDFC0001234</Text>
        </View>
      </Card>

      {/* IFSC Input */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Enter IFSC Code</Text>
        <View style={[styles.inputContainer, { borderColor: error ? colors.danger : colors.border }]}>
          <Ionicons name="business" size={20} color={colors.primary} />
          <TextInput
            style={styles.input}
            value={ifscCode}
            onChangeText={(t) => { setIfscCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11)); setError(null); }}
            placeholder="HDFC0001234"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            maxLength={11}
            autoCorrect={false}
            editable={!isLoading}
          />
          {ifscCode.length > 0 && (
            <View style={[styles.inputStatus, {
              backgroundColor: isIFSCFormatValid ? colors.primary + '20' : colors.danger + '20',
            }]}>
              <Ionicons
                name={isIFSCFormatValid ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={isIFSCFormatValid ? colors.primary : colors.danger}
              />
            </View>
          )}
        </View>
        <Text style={styles.inputHint}>
          {ifscCode.length === 0
            ? 'Enter your 11-character IFSC code'
            : isIFSCFormatValid ? '✓ Valid IFSC format' : 'Invalid IFSC format'}
        </Text>
      </View>

      {/* Verify Button */}
      <AnimatedPressable
        onPress={handleVerifyIFSC}
        disabled={!isIFSCFormatValid || isLoading}
        haptic="medium"
        scaleTo={0.97}
        style={{ opacity: isIFSCFormatValid && !isLoading ? 1 : 0.5 }}
      >
        <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
          <Ionicons name="search" size={20} color={colors.white} />
          <Text style={styles.actionBtnText}>{isLoading ? 'Verifying...' : 'Verify IFSC'}</Text>
        </LinearGradient>
      </AnimatedPressable>
    </>
  );

  const renderAccountStep = () => (
    <>
      {/* Bank Info */}
      {ifscResult && (
        <Card style={styles.bankInfoCard}>
          <View style={styles.bankInfoHeader}>
            <View style={[styles.bankInfoIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="business" size={24} color={colors.primary} />
            </View>
            <View style={styles.bankInfoText}>
              <Text style={styles.bankInfoName}>{ifscResult.bankName}</Text>
              <Text style={styles.bankInfoBranch}>{ifscResult.branch}</Text>
              <Text style={styles.bankInfoIfsc}>IFSC: {ifscResult.ifsc}</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Account Number */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Account Number</Text>
        <View style={[styles.inputContainer, { borderColor: colors.border }]}>
          <Ionicons name="card-outline" size={20} color={colors.primary} />
          <TextInput
            style={styles.input}
            value={accountNumber}
            onChangeText={(t) => { setAccountNumber(t.replace(/\D/g, '').slice(0, 18)); setError(null); }}
            placeholder="Enter account number"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={18}
            editable={!isLoading}
          />
        </View>
      </View>

      {/* Account Holder Name */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Account Holder Name</Text>
        <View style={[styles.inputContainer, { borderColor: colors.border }]}>
          <Ionicons name="person-outline" size={20} color={colors.primary} />
          <TextInput
            style={styles.input}
            value={accountHolderName}
            onChangeText={(t) => { setAccountHolderName(t); setError(null); }}
            placeholder="As per bank records"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>
      </View>

      {/* Verify Button */}
      <AnimatedPressable
        onPress={handleVerifyAccount}
        disabled={!isAccountFormatValid || !isNameValid || isLoading}
        haptic="medium"
        scaleTo={0.97}
        style={{ opacity: isAccountFormatValid && isNameValid && !isLoading ? 1 : 0.5, marginTop: SPACING.md }}
      >
        <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
          <Ionicons name="shield-checkmark" size={20} color={colors.white} />
          <Text style={styles.actionBtnText}>{isLoading ? 'Verifying...' : 'Verify Account'}</Text>
        </LinearGradient>
      </AnimatedPressable>
    </>
  );

  const renderVerifyStep = () => (
    <>
      {/* Verified Details */}
      {accountResult && ifscResult && (
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={[styles.resultIcon, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={32} color={colors.success} />
            </View>
            <View style={styles.resultInfo}>
              <Text style={styles.resultTitle}>Account Verified ✓</Text>
              <Text style={styles.resultSubtitle}>Account holder name matches bank records</Text>
            </View>
          </View>

          <View style={styles.resultDivider} />

          <View style={styles.resultDetails}>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Bank</Text>
              <Text style={styles.resultValue}>{ifscResult.bankName}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Branch</Text>
              <Text style={styles.resultValue}>{ifscResult.branch}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Account Number</Text>
              <Text style={styles.resultValue}>XXXX{accountResult.accountNumber.slice(-4)}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Account Holder</Text>
              <Text style={styles.resultValue}>{accountResult.accountHolderName}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>IFSC</Text>
              <Text style={styles.resultValue}>{ifscResult.ifsc}</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Account Type */}
      <Text style={[styles.inputLabel, { marginTop: SPACING.lg, marginBottom: SPACING.sm }]}>Account Type</Text>
      <View style={styles.accountTypeGrid}>
        {ACCOUNT_TYPES.map((type) => (
          <TouchableOpacity
            key={type.key}
            style={[
              styles.accountTypeBtn,
              accountType === type.key && styles.accountTypeBtnActive,
              { borderColor: accountType === type.key ? colors.primary : colors.border },
            ]}
            onPress={() => setAccountType(type.key)}
          >
            <Ionicons
              name={type.icon as keyof typeof Ionicons.glyphMap}
              size={20}
              color={accountType === type.key ? colors.primary : colors.textMuted}
            />
            <Text style={[
              styles.accountTypeLabel,
              accountType === type.key && { color: colors.primary },
            ]}>{type.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Primary Toggle */}
      <TouchableOpacity
        style={styles.primaryRow}
        onPress={() => setIsPrimary(!isPrimary)}
      >
        <View style={[styles.checkbox, isPrimary && styles.checkboxActive]}>
          {isPrimary && <Ionicons name="star" size={14} color={colors.white} />}
        </View>
        <View style={styles.primaryInfo}>
          <Text style={styles.primaryLabel}>Set as Primary Account</Text>
          <Text style={styles.primarySub}>Withdrawals and settlements will use this account</Text>
        </View>
      </TouchableOpacity>

      {/* Link Button */}
      <AnimatedPressable
        onPress={handleLinkAccount}
        disabled={isLoading}
        haptic="medium"
        scaleTo={0.97}
        style={{ marginTop: SPACING.lg }}
      >
        <LinearGradient colors={GRADIENTS.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
          <Ionicons name="link" size={20} color={colors.white} />
          <Text style={styles.actionBtnText}>{isLoading ? 'Linking...' : 'Link Bank Account'}</Text>
        </LinearGradient>
      </AnimatedPressable>
    </>
  );

  const renderLinkedStep = () => (
    <>
      {linkedAccount && (
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <View style={[styles.resultIcon, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            </View>
            <Text style={styles.resultTitle}>Account Linked ✓</Text>
            <Text style={styles.resultSubtitle}>
              Your {linkedAccount.bankName} account has been linked successfully
            </Text>
          </View>

          <View style={styles.resultDivider} />

          <View style={styles.resultDetails}>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Bank</Text>
              <Text style={styles.resultValue}>{linkedAccount.bankName}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Account</Text>
              <Text style={styles.resultValue}>{linkedAccount.accountNumber}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Type</Text>
              <View style={[styles.accountTypeBadge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.accountTypeBadgeText, { color: colors.primary }]}>
                  {linkedAccount.accountType.charAt(0).toUpperCase() + linkedAccount.accountType.slice(1)}
                </Text>
              </View>
            </View>
            {linkedAccount.isPrimary && (
              <View style={styles.primaryBadge}>
                <Ionicons name="star" size={14} color="#FFC107" />
                <Text style={styles.primaryBadgeText}>Primary Account</Text>
              </View>
            )}
          </View>

          <AnimatedPressable
            onPress={handleContinue}
            haptic="medium"
            scaleTo={0.97}
            style={{ marginTop: SPACING.xl }}
          >
            <LinearGradient colors={GRADIENTS.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.continueBtn}>
              <Text style={styles.continueBtnText}>Done</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.white} />
            </LinearGradient>
          </AnimatedPressable>

          {/* Manage Banks Link */}
          <TouchableOpacity
            style={styles.manageLink}
            onPress={() => setFlowStep('manage')}
          >
            <Text style={styles.manageLinkText}>Manage Linked Banks</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </Card>
      )}
    </>
  );

  const renderManageStep = () => (
    <>
      <Card title={`Linked Banks (${linkedBanks.length})`} style={{ marginBottom: SPACING.lg }}>
        {linkedBanks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No bank accounts linked yet</Text>
          </View>
        ) : (
          linkedBanks.map((bank, i) => (
            <View key={bank.id}>
              <View style={styles.manageBankRow}>
                <View style={[styles.manageBankIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="business" size={20} color={colors.primary} />
                </View>
                <View style={styles.manageBankInfo}>
                  <View style={styles.manageBankNameRow}>
                    <Text style={styles.manageBankName}>{bank.bankName}</Text>
                    {bank.isPrimary && <Badge label="Primary" variant="primary" size="small" />}
                  </View>
                  <Text style={styles.manageBankAccount}>{bank.accountNumber}</Text>
                  <Text style={styles.manageBankIfsc}>IFSC: {bank.ifsc} · {bank.accountType.charAt(0).toUpperCase() + bank.accountType.slice(1)}</Text>
                </View>
              </View>
              <View style={styles.manageBankActions}>
                {!bank.isPrimary && (
                  <TouchableOpacity
                    style={styles.manageActionBtn}
                    onPress={() => handleSetPrimary(bank.id)}
                  >
                    <Ionicons name="star-outline" size={16} color={colors.primary} />
                    <Text style={styles.manageActionText}>Set Primary</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.manageActionBtn, styles.manageActionDanger]}
                  onPress={() => handleRemoveBank(bank.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={[styles.manageActionText, { color: colors.danger }]}>Remove</Text>
                </TouchableOpacity>
              </View>
              {i < linkedBanks.length - 1 && <View style={styles.divider} />}
            </View>
          ))
        )}
      </Card>

      <AnimatedPressable
        onPress={() => {
          setFlowStep('ifsc');
          setIfscCode('');
          setAccountNumber('');
          setAccountHolderName('');
          setIfscResult(null);
          setAccountResult(null);
          setError(null);
        }}
        haptic="medium"
        scaleTo={0.97}
      >
        <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionBtn}>
          <Ionicons name="add-circle" size={20} color={colors.white} />
          <Text style={styles.actionBtnText}>Link Another Account</Text>
        </LinearGradient>
      </AnimatedPressable>

      <TouchableOpacity style={styles.doneBtn} onPress={handleContinue}>
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} testID="back-button">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>
              {flowStep === 'manage' ? 'Manage Banks' : 'Link Bank Account'}
            </Text>
            {flowStep !== 'manage' && (
              <Text style={styles.stepText}>
                {flowStep === 'ifsc' ? 'Step 1 of 3 — IFSC' :
                 flowStep === 'account' ? 'Step 2 of 3 — Account Details' :
                 flowStep === 'verify' ? 'Step 3 of 3 — Confirm' : 'Complete'}
              </Text>
            )}
          </View>
          {linkedBanks.length > 0 && flowStep !== 'manage' && (
            <TouchableOpacity onPress={() => setFlowStep('manage')} style={styles.manageBtn} testID="manage-banks-btn">
              <Ionicons name="settings-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Progress Bar */}
        {flowStep !== 'manage' && flowStep !== 'linked' && (
          <View style={styles.progressBar}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <View style={[styles.progressLine, (flowStep === 'account' || flowStep === 'verify') && styles.progressLineActive]} />
            <View style={[styles.progressDot, (flowStep === 'account' || flowStep === 'verify') && styles.progressDotActive]} />
            <View style={[styles.progressLine, flowStep === 'verify' && styles.progressLineActive]} />
            <View style={[styles.progressDot, flowStep === 'verify' && styles.progressDotActive]} />
          </View>
        )}

        {flowStep === 'ifsc' && renderIFSCStep()}
        {flowStep === 'account' && renderAccountStep()}
        {flowStep === 'verify' && renderVerifyStep()}
        {flowStep === 'linked' && renderLinkedStep()}
        {flowStep === 'manage' && renderManageStep()}

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 20 },

    // Header
    header: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      paddingTop: 60, marginBottom: SPACING.lg,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard,
      justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    },
    headerInfo: { flex: 1 },
    title: { ...FONTS.bold, fontSize: FONTS.size.title, color: colors.text },
    stepText: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },
    manageBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '15',
      justifyContent: 'center', alignItems: 'center',
    },

    // Progress
    progressBar: {
      flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xl,
      paddingHorizontal: SPACING.md,
    },
    progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border },
    progressDotActive: { backgroundColor: colors.primary },
    progressLine: { flex: 1, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
    progressLineActive: { backgroundColor: colors.primary },

    // Info
    infoCard: { marginBottom: SPACING.xl },
    infoRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' },
    infoText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, flex: 1, lineHeight: 20 },
    formatRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md, alignItems: 'center' },
    formatLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.textMuted },
    formatExample: {
      ...FONTS.bold, fontSize: FONTS.size.sm, color: colors.primary,
      fontFamily: 'monospace', letterSpacing: 2,
    },

    // Input
    inputSection: { marginBottom: SPACING.lg },
    inputLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text, marginBottom: SPACING.sm },
    inputContainer: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      backgroundColor: colors.bgInput, borderRadius: BORDER_RADIUS.md,
      borderWidth: 1.5, paddingHorizontal: SPACING.md, height: 56,
    },
    input: {
      flex: 1, ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.text,
      fontFamily: 'monospace', letterSpacing: 2, paddingVertical: 0,
    },
    inputStatus: {
      width: 36, height: 36, borderRadius: 10,
      justifyContent: 'center', alignItems: 'center',
    },
    inputHint: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: SPACING.xs },

    // Buttons
    actionBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    },
    actionBtnText: { ...FONTS.bold, fontSize: FONTS.size.lg, color: colors.white },

    // Bank Info Card
    bankInfoCard: { marginBottom: SPACING.xl },
    bankInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    bankInfoIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    bankInfoText: { flex: 1 },
    bankInfoName: { ...FONTS.semiBold, fontSize: FONTS.size.md, color: colors.text },
    bankInfoBranch: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary },
    bankInfoIfsc: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 2 },

    // Result
    resultCard: { marginTop: SPACING.md },
    resultHeader: { alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
    resultIcon: { width: 72, height: 72, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    resultInfo: { flex: 1 },
    resultTitle: { ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.text, textAlign: 'center' },
    resultSubtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, textAlign: 'center', marginTop: 2 },
    resultDivider: { height: 1, backgroundColor: colors.divider, marginVertical: SPACING.lg },
    resultDetails: { gap: SPACING.md },
    resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    resultLabel: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted },
    resultValue: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },
    primaryBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, justifyContent: 'center', marginTop: SPACING.sm },
    primaryBadgeText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: '#FFC107' },

    // Account Type
    accountTypeGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    accountTypeBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderWidth: 1.5, borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2,
      backgroundColor: colors.bgInput,
    },
    accountTypeBtnActive: { backgroundColor: colors.primary + '10', borderColor: colors.primary },
    accountTypeLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.textMuted },
    accountTypeBadge: {
      paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.sm,
    },
    accountTypeBadgeText: { ...FONTS.bold, fontSize: FONTS.size.xs },

    // Primary Toggle
    primaryRow: {
      flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start',
      marginBottom: SPACING.md,
    },
    checkbox: {
      width: 24, height: 24, borderRadius: 6, borderWidth: 2,
      borderColor: colors.border, justifyContent: 'center', alignItems: 'center',
      marginTop: 2,
    },
    checkboxActive: { backgroundColor: '#FFC107', borderColor: '#FFC107' },
    primaryInfo: { flex: 1 },
    primaryLabel: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.text },
    primarySub: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 1 },

    // Continue
    continueBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md,
    },
    continueBtnText: { ...FONTS.bold, fontSize: FONTS.size.md, color: colors.white },

    // Manage Link
    manageLink: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SPACING.sm, marginTop: SPACING.lg,
    },
    manageLinkText: { ...FONTS.medium, fontSize: FONTS.size.sm, color: colors.primary },

    // Manage Banks
    manageBankRow: { flexDirection: 'row', gap: SPACING.md, paddingVertical: SPACING.md },
    manageBankIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    manageBankInfo: { flex: 1 },
    manageBankNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    manageBankName: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: colors.text },
    manageBankAccount: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, marginTop: 2 },
    manageBankIfsc: { ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textMuted, marginTop: 1 },
    manageBankActions: {
      flexDirection: 'row', gap: SPACING.md, paddingLeft: 44 + SPACING.md,
      paddingBottom: SPACING.sm,
    },
    manageActionBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingVertical: 4, paddingHorizontal: SPACING.sm,
    },
    manageActionDanger: {},
    manageActionText: { ...FONTS.medium, fontSize: FONTS.size.xs, color: colors.primary },
    divider: { height: 1, backgroundColor: colors.divider },
    emptyState: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
    emptyText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textMuted },

    // Done
    doneBtn: { alignItems: 'center', paddingVertical: SPACING.xl },
    doneBtnText: { ...FONTS.medium, fontSize: FONTS.size.md, color: colors.primary },

    // Error
    errorContainer: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: colors.danger + '15', borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md, marginTop: SPACING.lg,
    },
    errorText: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.danger, flex: 1 },
  });
