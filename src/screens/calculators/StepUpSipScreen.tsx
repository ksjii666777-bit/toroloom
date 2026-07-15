import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useMutualFundStore } from '../../store/mutualFundStore';
import { FONTS, SPACING, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency } from '../../utils/formatters';
import type { StepUpConfig } from '../../types';
import { LinearGradient } from 'expo-linear-gradient';

type StepUpFrequency = StepUpConfig['frequency'];

const frequencyOptions: { label: string; value: StepUpFrequency }[] = [
  { label: 'Yearly', value: 'yearly' },
  { label: 'Half-Yearly', value: 'half_yearly' },
];

const percentPresets = [5, 10, 15, 20, 25];

export default function StepUpSipScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { sipPlans, enableStepUp, modifyStepUp, disableStepUp } = useMutualFundStore();

  const [selectedSip, setSelectedSip] = useState<string | null>(null);
  const [percent, setPercent] = useState('10');
  const [frequency, setFrequency] = useState<StepUpFrequency>('yearly');
  const [showModal, setShowModal] = useState(false);

  const activeSips = sipPlans.filter(s => s.nextDate !== 'PAUSED');

  const handleEnable = () => {
    if (!selectedSip) return;
    const pct = parseFloat(percent);
    if (isNaN(pct) || pct < 1 || pct > 50) {
      Alert.alert('Invalid Percent', 'Step-up percentage must be between 1% and 50%.');
      return;
    }
    enableStepUp(selectedSip, pct, frequency);
    Alert.alert('Step-Up Enabled', `SIP will increase by ${pct}% ${frequency === 'yearly' ? 'every year' : 'every 6 months'}.`);
    setShowModal(false);
    setSelectedSip(null);
  };

  const handleDisable = (sipId: string) => {
    Alert.alert(
      'Disable Step-Up?',
      'The SIP will continue without auto-increase. Your current amount stays the same.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disable', style: 'destructive', onPress: () => disableStepUp(sipId) },
      ]
    );
  };

  const computeProjection = (config: StepUpConfig | undefined): { year: number; amount: number }[] | null => {
    if (!config?.enabled) return null;
    const data: { year: number; amount: number }[] = [];
    let amt = config.baseAmount;
    const stepsPerYear = config.frequency === 'yearly' ? 1 : 2;
    for (let y = 0; y <= 10; y++) {
      data.push({ year: y, amount: Math.round(amt) });
      for (let s = 0; s < stepsPerYear; s++) {
        amt = amt * (1 + config.percent / 100);
      }
    }
    return data;
  };

  const getStepUpSummary = (config: StepUpConfig): string => {
    const freqLabel = config.frequency === 'yearly' ? 'year' : '6 months';
    const nextDate = new Date(config.nextStepDate).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    return `${config.percent}% every ${freqLabel} · Next increase: ${nextDate}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.bgSecondary, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.bgCard }]}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="trending-up" size={20} color={colors.accent} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Step-Up SIP</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Info Banner */}
      <View style={[styles.infoBanner, { backgroundColor: colors.accent + '12', borderColor: colors.accent + '30' }]}>
        <Ionicons name="information-circle" size={18} color={colors.accent} />
        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
          Step-Up SIP auto-increases your investment amount periodically (e.g. 10% every year). This accelerates wealth creation by investing more as your income grows.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeSips.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active SIPs</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Start a SIP first from the Mutual Funds section, then come back to set up auto-increase.
            </Text>
          </View>
        ) : (
          <>
            {/* Projection Example */}
            {activeSips.map(sip => {
              const projection = computeProjection(sip.stepUp);
              const maxProjection = projection ? Math.max(...projection.map(d => d.amount)) : 0;

              return (
                <TouchableOpacity
                  key={sip.id}
                  style={[styles.sipCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                  onPress={() => {
                    setSelectedSip(sip.id);
                    if (sip.stepUp?.enabled) {
                      setPercent(sip.stepUp.percent.toString());
                      setFrequency(sip.stepUp.frequency);
                    } else {
                      setPercent('10');
                      setFrequency('yearly');
                    }
                    setShowModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  {/* Card Header */}
                  <View style={styles.sipHeader}>
                    <View style={[styles.sipIcon, { backgroundColor: colors.accent + '20' }]}>
                      <Ionicons name="trending-up" size={20} color={colors.accent} />
                    </View>
                    <View style={styles.sipInfo}>
                      <Text style={[styles.sipFundName, { color: colors.text }]} numberOfLines={1}>{sip.fundName}</Text>
                      <Text style={[styles.sipAmount, { color: colors.textSecondary }]}>
                        {formatCurrency(sip.amount)}/{sip.frequency}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </View>

                  {/* Step-Up Status */}
                  {sip.stepUp?.enabled ? (
                    <View style={[styles.stepUpActive, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }]}>
                      <View style={styles.stepUpActiveHeader}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                        <Text style={[styles.stepUpActiveLabel, { color: colors.accent }]}>Step-Up Active</Text>
                      </View>
                      <Text style={[styles.stepUpActiveDetail, { color: colors.textSecondary }]}>
                        {getStepUpSummary(sip.stepUp)}
                      </Text>
                      {sip.stepUp.projectedAmount && (
                        <Text style={[styles.stepUpProjection, { color: colors.text }]}>
                          After 10 years: <Text style={{ color: colors.accent, fontFamily: FONTS.bold.fontFamily, fontWeight: FONTS.bold.fontWeight }}>
                            {formatCurrency(sip.stepUp.projectedAmount)}</Text>/month
                        </Text>
                      )}
                      {/* Mini Projection Chart */}
                      {projection && maxProjection > 0 && (
                        <View style={styles.miniChart}>
                          {projection.filter((_, i) => i % 2 === 0 || i === projection.length - 1).map((d) => (
                            <View key={d.year} style={styles.miniBarGroup}>
                              <View
                                style={[styles.miniBar, {
                                  height: Math.max((d.amount / maxProjection) * 40, 3),
                                  backgroundColor: d.year === 0 ? colors.textMuted : colors.accent,
                                  opacity: d.year === 0 ? 0.5 : 0.7 + (d.year / projection.length) * 0.3,
                                }]}
                              />
                            </View>
                          ))}
                        </View>
                      )}
                      <TouchableOpacity
                        style={[styles.disableBtn, { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' }]}
                        onPress={() => handleDisable(sip.id)}
                      >
                        <Text style={[styles.disableBtnText, { color: colors.danger }]}>Disable Step-Up</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={[styles.stepUpInactive, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                      <Ionicons name="add-circle-outline" size={24} color={colors.textMuted} />
                      <Text style={[styles.stepUpInactiveText, { color: colors.textMuted }]}>
                        Tap to set up auto-increase
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Education Card */}
        <View style={[styles.educationCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.eduTitle, { color: colors.text }]}>Why Step-Up SIP?</Text>
          <View style={styles.eduRow}>
            <Ionicons name="rocket-outline" size={16} color={colors.accent} />
            <Text style={[styles.eduText, { color: colors.textSecondary }]}>
              A 10% yearly step-up on a ₹10,000 monthly SIP can grow your investment to ₹3.2 Cr in 20 years vs ₹1.2 Cr without step-up.
            </Text>
          </View>
          <View style={styles.eduRow}>
            <Ionicons name="wallet-outline" size={16} color={colors.accent} />
            <Text style={[styles.eduText, { color: colors.textSecondary }]}>
              Step-up aligns your SIP with income growth — invest more as your salary increases, without feeling the pinch.
            </Text>
          </View>
          <View style={styles.eduRow}>
            <Ionicons name="flash-outline" size={16} color={colors.accent} />
            <Text style={[styles.eduText, { color: colors.textSecondary }]}>
              Start small, increase gradually. Even 5% yearly step-up makes a significant difference over 15-20 year horizons.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Step-Up Configuration Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.bgSecondary }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {sipPlans.find(s => s.id === selectedSip)?.stepUp?.enabled ? 'Modify Step-Up' : 'Enable Step-Up'}
              </Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setSelectedSip(null); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedSip && (
              <>
                {/* SIP Info */}
                <View style={[styles.modalSipInfo, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <Text style={[styles.modalSipName, { color: colors.text }]}>
                    {sipPlans.find(s => s.id === selectedSip)?.fundName}
                  </Text>
                  <Text style={[styles.modalSipDetail, { color: colors.textSecondary }]}>
                    Current: {formatCurrency(sipPlans.find(s => s.id === selectedSip)?.amount || 0)}/month
                  </Text>
                </View>

                {/* Step-Up Percent */}
                <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Increase by (%)</Text>
                <View style={styles.percentInputRow}>
                  <Ionicons name="pricetag" size={20} color={colors.textMuted} />
                  <TextInput
                    style={[styles.percentInput, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]}
                    value={percent}
                    onChangeText={setPercent}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 10"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.presetRow}>
                  {percentPresets.map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.presetChip, {
                        backgroundColor: percent === String(p) ? colors.accent + '20' : colors.bgCard,
                        borderColor: percent === String(p) ? colors.accent : colors.border,
                      }]}
                      onPress={() => setPercent(String(p))}
                    >
                      <Text style={[styles.presetChipText, {
                        color: percent === String(p) ? colors.accent : colors.textMuted,
                      }]}>
                        {p}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Frequency */}
                <Text style={[styles.modalLabel, { color: colors.textSecondary, marginTop: SPACING.lg }]}>Frequency</Text>
                <View style={styles.frequencyRow}>
                  {frequencyOptions.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.freqBtn, {
                        backgroundColor: frequency === opt.value ? colors.accent + '20' : colors.bgCard,
                        borderColor: frequency === opt.value ? colors.accent : colors.border,
                      }]}
                      onPress={() => setFrequency(opt.value)}
                    >
                      <Text style={[styles.freqBtnText, {
                        color: frequency === opt.value ? colors.accent : colors.textMuted,
                      }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Projection Preview */}
                {(() => {
                  const pct = parseFloat(percent) || 10;
                  const base = sipPlans.find(s => s.id === selectedSip)?.amount || 10000;
                  const stepsPerYear = frequency === 'yearly' ? 1 : 2;
                  let projected = base;
                  for (let i = 0; i < 10 * stepsPerYear; i++) {
                    projected = projected * (1 + pct / 100);
                  }
                  return (
                    <View style={[styles.projectionPreview, { backgroundColor: colors.accent + '10', borderColor: colors.accent + '25' }]}>
                      <View style={styles.projectionRow}>
                        <Text style={[styles.projectionLabel, { color: colors.textMuted }]}>Now</Text>
                        <Text style={[styles.projectionValue, { color: colors.text }]}>{formatCurrency(base)}</Text>
                      </View>
                      <View style={[styles.projectionArrow, { borderBottomColor: colors.accent + '40' }]} />
                      <View style={styles.projectionRow}>
                        <Text style={[styles.projectionLabel, { color: colors.textMuted }]}>After 10 yrs</Text>
                        <Text style={[styles.projectionValue, { color: colors.accent, fontFamily: FONTS.bold.fontFamily, fontWeight: FONTS.bold.fontWeight }]}>
                          {formatCurrency(Math.round(projected))}
                        </Text>
                      </View>
                    </View>
                  );
                })()}

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    onPress={() => { setShowModal(false); setSelectedSip(null); }}
                  >
                    <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={handleEnable}
                  >
                    <LinearGradient
                      colors={GRADIENTS.primary}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.confirmBtnGradient}
                    >
                      <Text style={styles.confirmBtnText}>
                        {sipPlans.find(s => s.id === selectedSip)?.stepUp?.enabled ? 'Update' : 'Enable Step-Up'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: FONTS.size.xl,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    margin: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONTS.size.lg,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  emptySubtitle: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.regular.fontFamily,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    lineHeight: 20,
  },
  // SIP Card
  sipCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  sipIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sipInfo: {
    flex: 1,
  },
  sipFundName: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  sipAmount: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.regular.fontFamily,
    marginTop: 2,
  },
  // Step-Up Active
  stepUpActive: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  stepUpActiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  stepUpActiveLabel: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  stepUpActiveDetail: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    lineHeight: 18,
  },
  stepUpProjection: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
    marginTop: 8,
  },
  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 44,
    gap: 2,
    marginTop: SPACING.sm,
    paddingVertical: 4,
  },
  miniBarGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 44,
  },
  miniBar: {
    width: '70%',
    borderRadius: 2,
  },
  disableBtn: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  disableBtnText: {
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },
  // Step-Up Inactive
  stepUpInactive: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  stepUpInactiveText: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },
  // Education
  educationCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: 12,
  },
  eduTitle: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
    marginBottom: 4,
  },
  eduRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  eduText: {
    flex: 1,
    fontSize: FONTS.size.xs,
    fontFamily: FONTS.regular.fontFamily,
    lineHeight: 18,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  modalTitle: {
    fontSize: FONTS.size.xl,
    fontFamily: FONTS.bold.fontFamily,
    fontWeight: FONTS.bold.fontWeight,
  },
  modalSipInfo: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  modalSipName: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  modalSipDetail: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.regular.fontFamily,
    marginTop: 4,
  },
  modalLabel: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
    marginBottom: SPACING.sm,
  },
  percentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  percentInput: {
    flex: 1,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    fontSize: FONTS.size.lg,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  freqBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  freqBtnText: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.medium.fontFamily,
    fontWeight: FONTS.medium.fontWeight,
  },
  projectionPreview: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  projectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  projectionLabel: {
    fontSize: FONTS.size.sm,
    fontFamily: FONTS.regular.fontFamily,
  },
  projectionValue: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  projectionArrow: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
  },
  confirmBtn: {
    flex: 2,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  confirmBtnGradient: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: FONTS.size.md,
    fontFamily: FONTS.semiBold.fontFamily,
    fontWeight: FONTS.semiBold.fontWeight,
    color: '#FFFFFF',
  },
});
