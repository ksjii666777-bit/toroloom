/**
 * ============================================================================
 * Toroloom — GDPR Compliance Screen
 * ============================================================================
 *
 * Implements GDPR Articles 15-20 (Right to Access, Rectification, Erasure,
 * Data Portability). Provides data export and account deletion functionality.
 *
 * Features:
 *   - Export all user data (JSON format)
 *   - Check what data would be retained after deletion
 *   - Delete account with explicit confirmation
 *   - View data retention policies
 *
 * Reference: GDPR Articles 15, 17, 20
 * ============================================================================
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useAuthStore } from '../../store/authStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AppScreen from '../../components/ui/AppScreen';
import Card from '../../components/ui/Card';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { api } from '../../services/api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'GDPR'>;

export default function GDPRScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { t } = useT();
  const { user } = useAuthStore();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [retentionInfo, setRetentionInfo] = useState<{
    hasRetainedData: boolean;
    retainedCategories: string[];
    estimatedRetainedRecords: number;
  } | null>(null);

  // ── Data Export ──────────────────────────────────────────────────────
  const handleExportData = useCallback(async () => {
    setIsExporting(true);
    try {
      const response: any = await api.post('/gdpr/export', { format: 'json' });
      if (response.data.success) {
        // Create and download the JSON file
        const dataStr = JSON.stringify(response.data.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `toroloom_data_export_${user?.id || 'user'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Alert.alert(
          t('gdpr.exportComplete'),
          t('gdpr.exportSuccessMessage'),
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(
        t('gdpr.exportFailed'),
        t('gdpr.exportFailedMessage'),
        [{ text: 'OK' }]
      );
    } finally {
      setIsExporting(false);
    }
  }, [user, t]);

  // ── Check Retention ──────────────────────────────────────────────────
  const handleCheckRetention = useCallback(async () => {
    try {
      const response: any = await api.post('/gdpr/check-retention');
      if (response.data.success) {
        setRetentionInfo(response.data);
      }
    } catch (error) {
      console.error('Check retention error:', error);
    }
  }, []);

  // ── Account Deletion ─────────────────────────────────────────────────
  const handleDeleteAccount = useCallback(async () => {
    if (deleteEmail.toLowerCase() !== user?.email?.toLowerCase()) {
      Alert.alert(
        t('gdpr.emailMismatch'),
        t('gdpr.emailMismatchMessage'),
        [{ text: 'OK' }]
      );
      return;
    }

    setIsDeleting(true);
    try {
      const response: any = await api.post('/gdpr/delete', {
        confirmEmail: deleteEmail,
        confirmDeletion: true,
        reason: 'User requested account deletion',
      });

      if (response.data.success) {
        Alert.alert(
          t('gdpr.accountDeleted'),
          t('gdpr.accountDeletedMessage'),
          [{ text: 'OK' }]
        );
        // TODO: Logout user and navigate to login screen
      }
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert(
        t('gdpr.deletionFailed'),
        t('gdpr.deletionFailedMessage'),
        [{ text: 'OK' }]
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteEmail('');
    }
  }, [deleteEmail, user, t]);

  return (
    <AppScreen scroll={true} padded={true}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
        <Text style={styles.title}>{t('gdpr.title')}</Text>
        <Text style={styles.subtitle}>{t('gdpr.subtitle')}</Text>
        </View>
      </View>

      {/* Data Export Section */}
      <Card title={t('gdpr.dataExport')} style={styles.section}>
        <Text style={styles.sectionDescription}>
          {t('gdpr.exportDescription')}
        </Text>

        <AnimatedPressable
          onPress={handleExportData}
          haptic="medium"
          scaleTo={0.98}
          disabled={isExporting}
        >
          <View style={[styles.actionBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
            <Ionicons name="download" size={20} color={colors.primary} />            <Text style={[styles.actionBtnText, { color: colors.primary }]}>
              {isExporting ? t('gdpr.exporting') : t('gdpr.exportMyData')}
            </Text>
          </View>
        </AnimatedPressable>

        <Text style={styles.infoText}>
          {t('gdpr.exportInfo')}
        </Text>
      </Card>

      {/* Data Retention Section */}
      <Card title={t('gdpr.dataRetention')} style={styles.section}>
        <Text style={styles.sectionDescription}>
          {t('gdpr.retentionDescription')}
        </Text>

        <AnimatedPressable
          onPress={handleCheckRetention}
          haptic="light"
          scaleTo={0.98}
        >
          <View style={[styles.actionBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Ionicons name="information-circle" size={20} color={colors.textSecondary} />
            <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>
              {t('gdpr.checkRetentionPolicy')}
            </Text>
          </View>
        </AnimatedPressable>

        {retentionInfo && (
          <View style={[styles.retentionInfo, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.retentionTitle, { color: colors.text }]}>{t('gdpr.retainedData')}</Text>
            {retentionInfo.retainedCategories.map((category, index) => (
              <View key={index} style={styles.retentionItem}>
                <Ionicons name="checkmark-circle" size={14} color={colors.warning} />
                <Text style={[styles.retentionText, { color: colors.textSecondary }]}>{category}</Text>
              </View>
            ))}
            <Text style={[styles.retentionNote, { color: colors.textMuted }]}>
              {t('gdpr.retainedRecords', { count: retentionInfo.estimatedRetainedRecords })}
            </Text>
          </View>
        )}
      </Card>

      {/* Account Deletion Section */}
      <Card title={t('gdpr.accountDeletion')} style={styles.section}>
        <View style={[styles.warningBox, { backgroundColor: '#FF174420', borderColor: '#FF174440' }]}>
          <Ionicons name="warning" size={20} color="#FF1744" />
          <Text style={[styles.warningText, { color: '#FF1744' }]}>
            {t('gdpr.deletionWarning')}
          </Text>
        </View>

        <Text style={styles.sectionDescription}>
          {t('gdpr.deletionDescription')}
        </Text>

        {!showDeleteConfirm ? (
          <AnimatedPressable
            onPress={() => setShowDeleteConfirm(true)}
            haptic="medium"
            scaleTo={0.98}
          >
            <View style={[styles.actionBtn, { backgroundColor: '#FF174420', borderColor: '#FF174440' }]}>
              <Ionicons name="trash" size={20} color="#FF1744" />
              <Text style={[styles.actionBtnText, { color: '#FF1744' }]}>
                {t('gdpr.deleteMyAccount')}
              </Text>
            </View>
          </AnimatedPressable>
        ) : (
          <View style={[styles.deleteConfirm, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.deleteConfirmTitle, { color: colors.text }]}>
              {t('gdpr.confirmDeletion')}
            </Text>
            <Text style={[styles.deleteConfirmText, { color: colors.textSecondary }]}>
              {t('gdpr.confirmDeletionText')}
            </Text>

            <TextInput
              style={[styles.emailInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
              placeholder={t('gdpr.emailPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={deleteEmail}
              onChangeText={setDeleteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setDeleteEmail('');
                }}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>{t('gdpr.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: '#FF1744' }]}
                onPress={handleDeleteAccount}
                disabled={isDeleting || deleteEmail.length === 0}
              >
                <Text style={styles.deleteBtnText}>
                  {isDeleting ? t('gdpr.deleting') : t('gdpr.confirmDeletionBtn')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Card>

      {/* Legal Information */}
      <Card title={t('gdpr.yourRights')} style={styles.section}>
        <View style={styles.rightsList}>
          <View style={styles.rightItem}>
            <Ionicons name="document-text" size={16} color={colors.primary} />
            <Text style={[styles.rightText, { color: colors.textSecondary }]}>
              {t('gdpr.rightToAccess')}
            </Text>
          </View>
          <View style={styles.rightItem}>
            <Ionicons name="create" size={16} color={colors.primary} />
            <Text style={[styles.rightText, { color: colors.textSecondary }]}>
              {t('gdpr.rightToRectification')}
            </Text>
          </View>
          <View style={styles.rightItem}>
            <Ionicons name="trash" size={16} color={colors.primary} />
            <Text style={[styles.rightText, { color: colors.textSecondary }]}>
              {t('gdpr.rightToErasure')}
            </Text>
          </View>
          <View style={styles.rightItem}>
            <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
            <Text style={[styles.rightText, { color: colors.textSecondary }]}>
              {t('gdpr.rightToPortability')}
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ height: 40 }} />
    </AppScreen>
  );
}

// ──── Styles ──────────────────────────────────────────────────────────────

const createStyles = (colors: any) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.xl,
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.bgCard,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    headerContent: {
      flex: 1,
    },
    title: {
      ...FONTS.bold,
      fontSize: FONTS.size.xxl,
      color: colors.text,
    },
    subtitle: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    section: {
      marginBottom: SPACING.lg,
    },
    sectionDescription: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: SPACING.md,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      marginBottom: SPACING.md,
    },
    actionBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
    },
    infoText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      color: colors.textMuted,
      lineHeight: 16,
    },
    retentionInfo: {
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1,
      marginTop: SPACING.sm,
    },
    retentionTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      marginBottom: SPACING.sm,
    },
    retentionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    retentionText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      flex: 1,
    },
    retentionNote: {
      ...FONTS.regular,
      fontSize: 10,
      marginTop: SPACING.sm,
    },
    warningBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1,
      marginBottom: SPACING.md,
    },
    warningText: {
      ...FONTS.medium,
      fontSize: FONTS.size.xs,
      flex: 1,
      lineHeight: 18,
    },
    deleteConfirm: {
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
    },
    deleteConfirmTitle: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.md,
      marginBottom: SPACING.sm,
    },
    deleteConfirmText: {
      ...FONTS.regular,
      fontSize: FONTS.size.sm,
      marginBottom: SPACING.md,
    },
    emailInput: {
      ...FONTS.regular,
      fontSize: FONTS.size.md,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1,
      marginBottom: SPACING.md,
    },
    deleteActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    cancelBtn: {
      flex: 1,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1,
      alignItems: 'center',
    },
    cancelBtnText: {
      ...FONTS.medium,
      fontSize: FONTS.size.sm,
    },
    deleteBtn: {
      flex: 1,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.sm,
      alignItems: 'center',
    },
    deleteBtnText: {
      ...FONTS.semiBold,
      fontSize: FONTS.size.sm,
      color: '#FFFFFF',
    },
    rightsList: {
      gap: SPACING.sm,
    },
    rightItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    rightText: {
      ...FONTS.regular,
      fontSize: FONTS.size.xs,
      flex: 1,
    },
  });
