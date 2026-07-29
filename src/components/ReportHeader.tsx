/**
 * ============================================================================
 * Toroloom — Report Header
 * ============================================================================
 *
 * Gradient header bar for the Period Report screen.
 * Shows back button, title/subtitle, LIVE badge (when analytics loaded),
 * and an export-to-PDF button.
 *
 * Props:
 *   navigation    — React Navigation object (for goBack)
 *   hasAnalytics  — Whether to show the LIVE badge
 *   isExporting   — Whether PDF export is in progress
 *   onExport      — Callback for export button press
 *
 * ============================================================================
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../constants/theme';

// ──── Props ─────────────────────────────────────────────────────────────────

interface ReportHeaderProps {
  navigation: any;
  hasAnalytics: boolean;
  isExporting: boolean;
  onExport: () => void;
}

// ──── Component ─────────────────────────────────────────────────────────────

export default function ReportHeader({ navigation, hasAnalytics, isExporting, onExport }: ReportHeaderProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  return (
    <LinearGradient
      colors={GRADIENTS.midnight}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.headerTitle}>{t('periodReport.title')}</Text>
          <Text style={styles.headerSub}>{t('periodReport.subtitle')}</Text>
        </View>
        {hasAnalytics && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={onExport}
          disabled={isExporting}
          style={[styles.exportBtn, isExporting && styles.exportBtnDisabled]}
          activeOpacity={0.7}
          testID="export-pdf-btn"
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="document-outline" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

// ──── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  header: {
    paddingTop: 56,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    ...FONTS.bold, fontSize: FONTS.size.xl, color: colors.text,
  },
  headerSub: {
    ...FONTS.regular, fontSize: FONTS.size.xs, color: colors.textSecondary, marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#00C85320',
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#00C853',
  },
  liveBadgeText: {
    fontSize: 9, fontWeight: '700', color: '#00C853', letterSpacing: 0.5,
  },
  exportBtn: {
    width: 36, height: 36, borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#6C63FF',
    justifyContent: 'center', alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  exportBtnDisabled: {
    opacity: 0.6,
  },
});
