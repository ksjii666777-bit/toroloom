import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
  Modal, TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useMutualFundStore } from '../../store/mutualFundStore';
import { MutualFund, SIPPlan } from '../../types';
import { SPACING, FONTS, BORDER_RADIUS, GRADIENTS } from '../../constants/theme';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

Dimensions.get('window');

const _riskColors: Record<string, string> = {
  low: '#00C853',
  moderate: '#FFC107',
  high: '#FF1744',
};

const frequencyOptions: { label: string; value: SIPPlan['frequency'] }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
];

export default function MutualFundsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { funds, sipPlans, fetchFunds, fetchSIPs, investInFund, startSIP, modifySIP, pauseSIP, resumeSIP, deleteSIP } = useMutualFundStore();
  const [activeTab, setActiveTab] = useState<'funds' | 'sips'>('funds');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [investModal, setInvestModal] = useState<{ fund: MutualFund; type: 'lumpsum' | 'sip' } | null>(null);
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<SIPPlan['frequency']>('monthly');
  const [editSIP, setEditSIP] = useState<{ sip: SIPPlan } | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editFrequency, setEditFrequency] = useState<SIPPlan['frequency']>('monthly');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchFunds();
    fetchSIPs();
  }, []);

  const categories = [...new Set(funds.map(f => f.category))];
  const filteredFunds = selectedCategory
    ? funds.filter(f => f.category === selectedCategory)
    : funds;

  const totalSipValue = sipPlans.reduce((sum, s) => sum + s.currentValue, 0);
  const totalSipInvested = sipPlans.reduce((sum, s) => sum + s.totalInvested, 0);

  const handleInvest = () => {
    if (!investModal || !amount) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < investModal.fund.minInvestment) {
      Alert.alert('Invalid Amount', `Minimum investment is ${formatCurrency(investModal.fund.minInvestment)}`);
      return;
    }
    if (investModal.type === 'lumpsum') {
      investInFund(investModal.fund.id, amt);
      Alert.alert('Success', `Invested ${formatCurrency(amt)} in ${investModal.fund.name}`);
    } else {
      startSIP(investModal.fund.id, amt, frequency);
      Alert.alert('SIP Started', `SIP of ${formatCurrency(amt)}/${frequency} started in ${investModal.fund.name}`);
    }
    setInvestModal(null);
    setAmount('');
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Mutual Funds</Text>
        </View>

        {/* Tab Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeTab === 'funds' && styles.toggleBtnActive]}
            onPress={() => setActiveTab('funds')}
          >
            <Ionicons name="pie-chart" size={16} color={activeTab === 'funds' ? colors.white : colors.textMuted} />
            <Text style={[styles.toggleText, activeTab === 'funds' && styles.toggleTextActive]}>
              Funds ({funds.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeTab === 'sips' && styles.toggleBtnActive]}
            onPress={() => setActiveTab('sips')}
          >
            <Ionicons name="calendar" size={16} color={activeTab === 'sips' ? colors.white : colors.textMuted} />
            <Text style={[styles.toggleText, activeTab === 'sips' && styles.toggleTextActive]}>
              My SIPs ({sipPlans.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'funds' ? (
          <>
            {/* Categories Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
              <TouchableOpacity
                style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>All</Text>
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                >
                  <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Fund List */}
            <View style={styles.fundsList}>
              {filteredFunds.map(fund => (
                <TouchableOpacity key={fund.id} style={styles.fundCard}>
                  <LinearGradient
                    colors={GRADIENTS.card}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.fundGradient}
                  >
                    <View style={styles.fundHeader}>
                      <View style={styles.fundInfo}>
                        <Text style={styles.fundName} numberOfLines={2}>{fund.name}</Text>
                        <View style={styles.fundMeta}>
                          <Badge label={fund.category} variant="primary" />
                          <Badge
                            label={fund.riskLevel}
                            variant={fund.riskLevel === 'low' ? 'success' : fund.riskLevel === 'moderate' ? 'warning' : 'danger'}
                          />
                        </View>
                      </View>
                      <View style={styles.fundRating}>
                        <Text style={styles.fundRatingText}>{'★'.repeat(fund.rating)}</Text>
                      </View>
                    </View>

                    <View style={styles.fundNav}>
                      <View>
                        <Text style={styles.navLabel}>NAV</Text>
                        <Text style={styles.navValue}>{formatCurrency(fund.nav)}</Text>
                      </View>
                      <View style={styles.navChange}>
                        <Ionicons
                          name={fund.dayChange >= 0 ? 'caret-up' : 'caret-down'}
                          size={14}
                          color={fund.dayChange >= 0 ? '#00C853' : '#FF1744'}
                        />
                        <Text style={[styles.navChangeText, { color: fund.dayChange >= 0 ? '#00C853' : '#FF1744' }]}>
                          {formatPercent(fund.dayChangePercent)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.returnsRow}>
                      <View style={styles.returnItem}>
                        <Text style={styles.returnLabel}>1Y</Text>
                        <Text style={[styles.returnValue, { color: fund.oneYearReturn >= 0 ? '#00C853' : '#FF1744' }]}>
                          +{fund.oneYearReturn}%
                        </Text>
                      </View>
                      <View style={styles.returnItem}>
                        <Text style={styles.returnLabel}>3Y</Text>
                        <Text style={[styles.returnValue, { color: fund.threeYearReturn >= 0 ? '#00C853' : '#FF1744' }]}>
                          +{fund.threeYearReturn}%
                        </Text>
                      </View>
                      <View style={styles.returnItem}>
                        <Text style={styles.returnLabel}>5Y</Text>
                        <Text style={[styles.returnValue, { color: fund.fiveYearReturn >= 0 ? '#00C853' : '#FF1744' }]}>
                          +{fund.fiveYearReturn}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.fundActions}>
                      <TouchableOpacity
                        style={[styles.fundActionBtn, { backgroundColor: colors.primary }]}
                        onPress={() => setInvestModal({ fund, type: 'lumpsum' })}
                      >
                        <Text style={styles.fundActionText}>Invest</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.fundActionBtn, styles.fundActionOutline]}
                        onPress={() => setInvestModal({ fund, type: 'sip' })}
                      >
                        <Text style={[styles.fundActionText, { color: colors.primary }]}>Start SIP</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.fundFooter}>
                      <Text style={styles.fundFooterText}>Min: {formatCurrency(fund.minInvestment)}</Text>
                      <Text style={styles.fundFooterText}>AUM: {fund.fundSize}</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            {/* SIP Overview */}
            {sipPlans.length > 0 && (
              <Card style={styles.sipOverview}>
                <View style={styles.sipOverviewRow}>
                  <View style={styles.sipOverviewItem}>
                    <Text style={styles.sipOverviewLabel}>Total Invested</Text>
                    <Text style={styles.sipOverviewValue}>{formatCurrency(totalSipInvested, true)}</Text>
                  </View>
                  <View style={styles.sipOverviewDivider} />
                  <View style={styles.sipOverviewItem}>
                    <Text style={styles.sipOverviewLabel}>Current Value</Text>
                    <Text style={[styles.sipOverviewValue, { color: '#00C853' }]}>
                      {formatCurrency(totalSipValue, true)}
                    </Text>
                  </View>
                  <View style={styles.sipOverviewDivider} />
                  <View style={styles.sipOverviewItem}>
                    <Text style={styles.sipOverviewLabel}>Returns</Text>
                    <Text style={[styles.sipOverviewValue, { color: '#00C853' }]}>
                      +{formatCurrency(totalSipValue - totalSipInvested, true)}
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {/* SIP Plans */}
            {sipPlans.length > 0 ? (
              sipPlans.map(sip => (
                <Card key={sip.id} style={{ marginBottom: SPACING.md }}>
                  <View style={styles.sipCard}>
                    <View style={styles.sipHeader}>
                      <View style={[styles.sipIcon, { backgroundColor: '#6C63FF20' }]}>
                        <Ionicons name="calendar" size={20} color="#6C63FF" />
                      </View>
                      <View style={styles.sipInfo}>
                        <Text style={styles.sipFundName}>{sip.fundName}</Text>
                        <Text style={styles.sipFrequency}>
                          {formatCurrency(sip.amount)}/{sip.frequency} · Next: {sip.nextDate}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.sipStats}>
                      <View style={styles.sipStat}>
                        <Text style={styles.sipStatLabel}>Invested</Text>
                        <Text style={styles.sipStatValue}>{formatCurrency(sip.totalInvested, true)}</Text>
                      </View>
                      <View style={styles.sipStat}>
                        <Text style={styles.sipStatLabel}>Current</Text>
                        <Text style={[styles.sipStatValue, { color: '#00C853' }]}>
                          {formatCurrency(sip.currentValue, true)}
                        </Text>
                      </View>
                      <View style={styles.sipStat}>
                        <Text style={styles.sipStatLabel}>Returns</Text>
                        <Text style={[styles.sipStatValue, { color: '#00C853' }]}>
                          +{formatCurrency(sip.returns, true)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.sipActions}>
                      <TouchableOpacity
                        style={styles.sipActionBtn}
                        onPress={() => {
                          setEditSIP({ sip });
                          setEditAmount(sip.amount.toString());
                          setEditFrequency(sip.frequency);
                        }}
                      >
                        <Text style={styles.sipActionText}>Edit SIP</Text>
                      </TouchableOpacity>
                      {sip.nextDate === 'PAUSED' ? (
                        <TouchableOpacity
                          style={[styles.sipActionBtn, { backgroundColor: colors.accent + '20', borderColor: colors.accent + '40' }]}
                          onPress={() => resumeSIP(sip.id)}
                        >
                          <Text style={[styles.sipActionText, { color: colors.accent }]}>Resume</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.sipActionBtn, styles.sipActionDanger]}
                          onPress={() => pauseSIP(sip.id)}
                        >
                          <Text style={[styles.sipActionText, { color: colors.danger }]}>Pause</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.sipActionBtn, { backgroundColor: '#FF174410', borderColor: '#FF174420', flex: 0.5 }]}
                        onPress={() => setConfirmDelete(sip.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <Card>
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>No Active SIPs</Text>
                  <Text style={styles.emptySubtitle}>Start a SIP to invest regularly and build wealth over time</Text>
                </View>
              </Card>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Invest / SIP Modal */}
      <Modal visible={!!investModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {investModal?.type === 'lumpsum' ? 'Invest' : 'Start SIP'}
              </Text>
              <TouchableOpacity onPress={() => { setInvestModal(null); setAmount(''); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {investModal && (
              <>
                <View style={styles.modalFundInfo}>
                  <Text style={styles.modalFundName}>{investModal.fund.name}</Text>
                  <Text style={styles.modalFundMeta}>{investModal.fund.category} · NAV: {formatCurrency(investModal.fund.nav)}</Text>
                </View>

                <Text style={styles.modalLabel}>
                  Amount (Min: {formatCurrency(investModal.fund.minInvestment)})
                </Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.currencySign}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {/* Quick amount buttons */}
                <View style={styles.quickAmounts}>
                  {[5000, 10000, 25000, 50000].map(amt => (
                    <TouchableOpacity
                      key={amt}
                      style={[styles.quickAmountBtn, parseFloat(amount) === amt && styles.quickAmountActive]}
                      onPress={() => setAmount(amt.toString())}
                    >
                      <Text style={[styles.quickAmountText, parseFloat(amount) === amt && styles.quickAmountTextActive]}>
                        {formatCurrency(amt, true)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {investModal.type === 'sip' && (
                  <>
                    <Text style={styles.modalLabel}>Frequency</Text>
                    <View style={styles.frequencyRow}>
                      {frequencyOptions.map(opt => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.freqBtn, frequency === opt.value && styles.freqBtnActive]}
                          onPress={() => setFrequency(opt.value)}
                        >
                          <Text style={[styles.freqText, frequency === opt.value && styles.freqTextActive]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={[styles.investBtn, (!amount || parseFloat(amount) < investModal.fund.minInvestment) && styles.investBtnDisabled]}
                  onPress={handleInvest}
                >
                  <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.investBtnGradient}>
                    <Text style={styles.investBtnText}>
                      {investModal.type === 'lumpsum' ? `Invest ${amount ? formatCurrency(parseFloat(amount), true) : ''}` : `Start SIP of ${amount ? formatCurrency(parseFloat(amount), true) : ''}`}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit SIP Modal */}
      <Modal visible={!!editSIP} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit SIP</Text>
              <TouchableOpacity onPress={() => { setEditSIP(null); setEditAmount(''); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {editSIP && (
              <>
                <View style={styles.modalFundInfo}>
                  <Text style={styles.modalFundName}>{editSIP.sip.fundName}</Text>
                  <Text style={styles.modalFundMeta}>Current: {formatCurrency(editSIP.sip.amount)}/{editSIP.sip.frequency}</Text>
                </View>

                <Text style={styles.modalLabel}>New Amount (₹)</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.currencySign}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={editAmount}
                    onChangeText={setEditAmount}
                    keyboardType="numeric"
                    placeholder="Enter amount"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.quickAmounts}>
                  {[5000, 10000, 25000, 50000].map(amt => (
                    <TouchableOpacity
                      key={amt}
                      style={[styles.quickAmountBtn, parseFloat(editAmount) === amt && styles.quickAmountActive]}
                      onPress={() => setEditAmount(amt.toString())}
                    >
                      <Text style={[styles.quickAmountText, parseFloat(editAmount) === amt && styles.quickAmountTextActive]}>
                        {formatCurrency(amt, true)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.modalLabel}>Frequency</Text>
                <View style={styles.frequencyRow}>
                  {frequencyOptions.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.freqBtn, editFrequency === opt.value && styles.freqBtnActive]}
                      onPress={() => setEditFrequency(opt.value)}
                    >
                      <Text style={[styles.freqText, editFrequency === opt.value && styles.freqTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.investBtn, (!editAmount || parseFloat(editAmount) < 500) && styles.investBtnDisabled]}
                  onPress={() => {
                    const amt = parseFloat(editAmount);
                    if (isNaN(amt) || amt < 500) {
                      Alert.alert('Invalid Amount', 'Minimum SIP amount is ₹500');
                      return;
                    }
                    modifySIP(editSIP.sip.id, { amount: amt, frequency: editFrequency });
                    Alert.alert('SIP Updated', `SIP updated to ${formatCurrency(amt)}/${editFrequency}`);
                    setEditSIP(null);
                    setEditAmount('');
                  }}
                >
                  <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.investBtnGradient}>
                    <Text style={styles.investBtnText}>Update SIP</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={!!confirmDelete} transparent animationType="fade">
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={[styles.modalContent, { borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, width: '85%', maxWidth: 340 }]}>
            <View style={{ alignItems: 'center', marginBottom: SPACING.lg }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF174420', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md }}>
                <Ionicons name="warning" size={28} color={colors.danger} />
              </View>
              <Text style={[styles.modalTitle, { textAlign: 'center' }]}>Delete SIP?</Text>
              <Text style={[styles.modalFundMeta, { textAlign: 'center', marginTop: SPACING.sm }]}>
                This will cancel your SIP. Existing investments will remain.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: SPACING.md }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border }}
                onPress={() => setConfirmDelete(null)}
              >
                <Text style={[styles.fundActionText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', backgroundColor: colors.danger }}
                onPress={() => {
                  if (confirmDelete) deleteSIP(confirmDelete);
                  setConfirmDelete(null);
                }}
              >
                <Text style={styles.fundActionText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  categoriesScroll: {
    marginBottom: SPACING.lg,
  },
  categoryChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: SPACING.sm,
  },
  categoryChipActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  categoryText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  categoryTextActive: {
    color: colors.primary,
  },
  fundsList: {
    gap: SPACING.md,
  },
  fundCard: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fundGradient: {
    padding: SPACING.lg,
  },
  fundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fundInfo: {
    flex: 1,
  },
  fundName: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  fundMeta: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  fundRating: {
    marginLeft: SPACING.sm,
  },
  fundRatingText: {
    fontSize: 14,
    color: '#FFC107',
  },
  fundNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  navLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  navValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
    marginTop: 2,
  },
  navChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navChangeText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  returnsRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  returnItem: {
    alignItems: 'center',
  },
  returnLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  returnValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    marginTop: 2,
  },
  fundActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  fundActionBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  fundActionOutline: {
    backgroundColor: colors.transparent,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  fundActionText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.white,
  },
  fundFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  fundFooterText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  sipOverview: {
    marginBottom: SPACING.lg,
  },
  sipOverviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sipOverviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  sipOverviewDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.divider,
  },
  sipOverviewLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  sipOverviewValue: {
    ...FONTS.bold,
    fontSize: FONTS.size.md,
    color: colors.text,
    marginTop: 4,
  },
  sipCard: {
    gap: SPACING.md,
  },
  sipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  sipFrequency: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sipStats: {
    flexDirection: 'row',
    backgroundColor: colors.bgCardLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  sipStat: {
    flex: 1,
    alignItems: 'center',
  },
  sipStatLabel: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  sipStatValue: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.text,
    marginTop: 4,
  },
  sipActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  sipActionBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  sipActionDanger: {
    backgroundColor: '#FF174410',
    borderColor: '#FF174430',
  },
  sipActionText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.lg,
    color: colors.text,
  },
  emptySubtitle: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bgSecondary,
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
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
  },
  modalFundInfo: {
    backgroundColor: colors.bgCardLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  modalFundName: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  modalFundMeta: {
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
    marginTop: 4,
  },
  modalLabel: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textSecondary,
    marginBottom: SPACING.sm,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  currencySign: {
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.textMuted,
    marginRight: SPACING.sm,
  },
  amountInput: {
    flex: 1,
    ...FONTS.bold,
    fontSize: FONTS.size.xxl,
    color: colors.text,
    paddingVertical: SPACING.lg,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  quickAmountBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickAmountActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  quickAmountText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
    color: colors.textMuted,
  },
  quickAmountTextActive: {
    color: colors.primary,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  freqBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  freqBtnActive: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
  },
  freqText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
  },
  freqTextActive: {
    color: colors.primary,
  },
  investBtn: {
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  investBtnDisabled: {
    opacity: 0.5,
  },
  investBtnGradient: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  investBtnText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: colors.white,
  },
});
