// ============================================================================
// Toroloom — Reusable NFO Invest Modal
// Extracted from NFODashboardScreen and NFODetailScreen to avoid duplication
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS } from '../../constants/theme';
import type { NFOItem } from '../../types';
import { useNFOStore } from '../../store/nfoStore';

// ──── Helpers ──────────────────────────────────────────────────────────────

function formatCompact(num: number): string {
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num.toLocaleString('en-IN')}`;
}

// ──── Props ────────────────────────────────────────────────────────────────

export interface InvestNfoModalProps {
  /** The NFO item to invest in (null hides the modal) */
  nfo: NFOItem | null;
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Optional callback when investment is successfully submitted */
  onSuccess?: () => void;
}

// ──── Component ────────────────────────────────────────────────────────────

export default function InvestNfoModal({
  nfo, visible, onClose, onSuccess,
}: InvestNfoModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const applyForNFO = useNFOStore((s) => s.applyForNFO);

  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (nfo && visible) setAmount('');
  }, [nfo, visible]);

  if (!nfo) return null;

  const investAmount = parseInt(amount) || 0;
  const isValid = investAmount >= nfo.minInvestment && (nfo.maxInvestment === 0 || investAmount <= nfo.maxInvestment);

  const handleSubmit = () => {
    if (!isValid) {
      if (investAmount < nfo.minInvestment) {
        Alert.alert('Minimum Investment', `Minimum investment is ${formatCompact(nfo.minInvestment)}`);
      } else if (nfo.maxInvestment > 0 && investAmount > nfo.maxInvestment) {
        Alert.alert('Maximum Investment', `Maximum investment is ${formatCompact(nfo.maxInvestment)}`);
      }
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      applyForNFO(nfo, investAmount);
      Alert.alert(
        'Application Submitted ✅',
        `${nfo.schemeName}\nInvestment: ${formatCompact(investAmount)}\nAMC: ${nfo.amcName}`,
      );
      onSuccess?.();
      onClose();
    }, 1000);
  };

  // Quick amount suggestions
  const quickAmounts = [
    nfo.minInvestment,
    nfo.minInvestment * 2,
    nfo.minInvestment * 5,
    nfo.minInvestment * 10,
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.bgSecondary, paddingBottom: insets.bottom + 20 }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Invest in NFO</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* Scheme Info */}
            <View style={[styles.schemeInfo, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={[styles.logo, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                <Text style={[styles.logoText, { color: colors.primary }]}>{nfo.logo}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.schemeName, { color: colors.text }]}>{nfo.schemeName}</Text>
                <Text style={[styles.schemeMeta, { color: colors.textMuted }]}>
                  {nfo.amcName} · Min: {formatCompact(nfo.minInvestment)}
                </Text>
              </View>
            </View>

            {/* Quick Amount Buttons */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Quick Select</Text>
            <View style={styles.quickRow}>
              {quickAmounts.map((amt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.quickBtn, {
                    backgroundColor: investAmount === amt ? colors.primary : colors.bgCard,
                    borderColor: investAmount === amt ? colors.primary : colors.border,
                  }]}
                  onPress={() => setAmount(String(amt))}
                >
                  <Text style={[styles.quickText, {
                    color: investAmount === amt ? '#FFFFFF' : colors.text,
                    fontWeight: investAmount === amt ? '700' : '500',
                  }]}>
                    {formatCompact(amt)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Amount */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Custom Amount</Text>
            <View style={[styles.amountRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
              <Text style={[styles.currencyPrefix, { color: colors.textMuted }]}>₹</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.text }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder={String(nfo.minInvestment)}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Range hint */}
            <View style={[styles.rangeHint, { backgroundColor: colors.bgCardLight, borderColor: colors.border }]}>
              <Ionicons name="information-circle" size={12} color={colors.primary} />
              <Text style={[styles.rangeText, { color: colors.textMuted }]}>
                Min: {formatCompact(nfo.minInvestment)}{nfo.maxInvestment > 0 ? ` · Max: ${formatCompact(nfo.maxInvestment)}` : ''}
              </Text>
            </View>

            {/* Allocation Preview */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Asset Allocation</Text>
            <View style={styles.allocationList}>
              {nfo.assetAllocation.map((item, i) => (
                <View key={i} style={styles.allocationItem}>
                  <View style={[styles.allocDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.allocLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.allocPercent, { color: colors.textMuted }]}>{item.percent}%</Text>
                </View>
              ))}
            </View>

            {/* Fund Manager Info */}
            <View style={[styles.fmBox, { backgroundColor: '#3B82F610', borderColor: '#3B82F630' }]}>
              <Ionicons name="person-circle" size={16} color={colors.primary} />
              <Text style={[styles.fmText, { color: colors.textMuted }]}>
                Fund Manager: {nfo.fundManagers.join(', ')}
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={submitting || !isValid}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isValid ? ['#3B82F6', '#1D4ED8'] : ['#64748B', '#475569']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.submitText}>
                  {submitting
                    ? 'Processing...'
                    : isValid
                      ? `Invest ${formatCompact(investAmount)}`
                      : `Min: ${formatCompact(nfo.minInvestment)}`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Info */}
            <View style={[styles.infoBox, { backgroundColor: '#3B82F610', borderColor: '#3B82F630' }]}>
              <Ionicons name="information-circle" size={14} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.textMuted }]}>
                Your investment will be allocated at the NFO price of ₹10/unit. Actual NAV will be declared after the NFO closes.
              </Text>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  container: { maxHeight: '90%', borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.xl, paddingBottom: SPACING.md,
    borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl,
  },
  title: { fontSize: 18, fontWeight: '800' },
  content: { paddingHorizontal: SPACING.xl, gap: SPACING.lg },
  schemeInfo: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, borderWidth: 1, gap: SPACING.md,
  },
  logo: { width: 48, height: 48, borderRadius: BORDER_RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 18, fontWeight: '800' },
  schemeName: { fontSize: 14, fontWeight: '700' },
  schemeMeta: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600' },
  quickRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  quickBtn: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    minWidth: 70, alignItems: 'center',
  },
  quickText: { fontSize: 13 },
  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BORDER_RADIUS.md, borderWidth: 1,
    paddingHorizontal: SPACING.md,
  },
  currencyPrefix: { fontSize: 18, fontWeight: '700', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 20, fontWeight: '700', paddingVertical: SPACING.md },
  rangeHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: SPACING.sm, borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
  },
  rangeText: { fontSize: 11, fontWeight: '500' },
  allocationList: { gap: 6 },
  allocationItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  allocDot: { width: 8, height: 8, borderRadius: 4 },
  allocLabel: { flex: 1, fontSize: 12, fontWeight: '500' },
  allocPercent: { fontSize: 12, fontWeight: '600' },
  fmBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
  },
  fmText: { flex: 1, fontSize: 11, fontWeight: '500' },
  submitBtn: { borderRadius: BORDER_RADIUS.lg, overflow: 'hidden' },
  submitGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: SPACING.lg,
  },
  submitText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 11, fontWeight: '500', lineHeight: 16 },
});
