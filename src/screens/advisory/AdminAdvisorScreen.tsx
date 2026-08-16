import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useAdvisoryStore } from '../../store/advisoryStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import AppScreen from '../../components/ui/AppScreen';
import type { Advisor, RootStackParamList } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const STATUS_COLORS: Record<string, string> = {
  pending: '#FFC107',
  approved: '#00C853',
  rejected: '#FF1744',
  suspended: '#FF9800',
};

const STATUS_ORDER: Record<string, number> = { pending: 0, approved: 1, suspended: 2, rejected: 3 };

export default function AdminAdvisorScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'AdminAdvisor'>) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { allAdvisors, loadAllAdvisors, setAdvisorStatus } = useAdvisoryStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'RIA' as 'RIA' | 'RA',
    sebiRegNo: '',
    firmName: '',
    consultationFee: '',
    bio: '',
  });

  useEffect(() => {
    loadAllAdvisors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(
    () => [...allAdvisors].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)),
    [allAdvisors],
  );

  const handleStatus = (advisor: Advisor, status: string) => {
    Alert.alert(
      t('advisory.adminConfirmTitle'),
      t('advisory.adminConfirmMsg', { name: advisor.name, status: t(`advisory.status.${status}`) }),
      [
        { text: t('app.cancel'), style: 'cancel' as const },
        { text: t('advisory.confirm'), onPress: () => setAdvisorStatus(advisor.id, status) },
      ],
    );
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.sebiRegNo.trim()) {
      Alert.alert(t('advisory.adminFormError'));
      return;
    }
    setShowForm(false);
    setForm({ name: '', type: 'RIA', sebiRegNo: '', firmName: '', consultationFee: '', bio: '' });
    Alert.alert(t('advisory.adminAddedTitle'), t('advisory.adminAddedMsg'));
  };

  const renderRow = ({ item, index }: { item: Advisor; index: number }) => {
    const statusColor = STATUS_COLORS[item.status] || colors.textMuted;
    return (
      <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
        <Card style={styles.advisorCard}>
          <View style={styles.cardTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name[0]?.toUpperCase() || 'A'}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.sub}>{item.type} · {item.sebiRegNo}</Text>
              {item.firmName ? <Text style={styles.sub} numberOfLines={1}>{item.firmName}</Text> : null}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{t(`advisory.status.${item.status}`)}</Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            {item.status !== 'approved' && (
              <Pressable
                onPress={() => handleStatus(item, 'approved')}
                style={[styles.actionBtn, { backgroundColor: '#00C85318', borderColor: '#00C853' }]}
              >
                <Ionicons name="checkmark" size={14} color="#00C853" />
                <Text style={[styles.actionText, { color: '#00C853' }]}>{t('advisory.approve')}</Text>
              </Pressable>
            )}
            {item.status !== 'rejected' && (
              <Pressable
                onPress={() => handleStatus(item, 'rejected')}
                style={[styles.actionBtn, { backgroundColor: '#FF174418', borderColor: '#FF1744' }]}
              >
                <Ionicons name="close" size={14} color="#FF1744" />
                <Text style={[styles.actionText, { color: '#FF1744' }]}>{t('advisory.reject')}</Text>
              </Pressable>
            )}
            {item.status !== 'suspended' && (
              <Pressable
                onPress={() => handleStatus(item, 'suspended')}
                style={[styles.actionBtn, { backgroundColor: '#FF980018', borderColor: '#FF9800' }]}
              >
                <Ionicons name="pause" size={14} color="#FF9800" />
                <Text style={[styles.actionText, { color: '#FF9800' }]}>{t('advisory.suspend')}</Text>
              </Pressable>
            )}
          </View>
        </Card>
      </Animated.View>
    );
  };

  return (
    <AppScreen scroll={false} padded={false}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} haptic="light" scaleTo={0.9} accessibilityLabel="Go back">
          <View style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </View>
        </AnimatedPressable>
        <Text style={styles.title}>{t('advisory.adminTitle')}</Text>
        <AnimatedPressable onPress={() => setShowForm(v => !v)} haptic="light" scaleTo={0.9}>
          <View style={styles.addBtn}>
            <Ionicons name={showForm ? 'close' : 'add'} size={22} color={colors.white} />
          </View>
        </AnimatedPressable>
      </View>

      {showForm && (
        <View style={styles.formWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>{t('advisory.adminAddAdvisor')}</Text>
              <TextInput
                testID="admin-advisor-name"
                style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                placeholder={t('advisory.adminName')}
                placeholderTextColor={colors.textMuted}
                value={form.name}
                onChangeText={name => setForm(f => ({ ...f, name }))}
              />
              <TextInput
                testID="admin-advisor-sebi"
                style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                placeholder={t('advisory.adminSebi')}
                placeholderTextColor={colors.textMuted}
                value={form.sebiRegNo}
                onChangeText={sebiRegNo => setForm(f => ({ ...f, sebiRegNo }))}
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                placeholder={t('advisory.adminFirm')}
                placeholderTextColor={colors.textMuted}
                value={form.firmName}
                onChangeText={firmName => setForm(f => ({ ...f, firmName }))}
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                placeholder={t('advisory.adminFee')}
                placeholderTextColor={colors.textMuted}
                value={form.consultationFee}
                keyboardType="number-pad"
                onChangeText={consultationFee => setForm(f => ({ ...f, consultationFee }))}
              />
              <View style={styles.typeRow}>
                {(['RIA', 'RA'] as const).map(type => {
                  const isActive = form.type === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setForm(f => ({ ...f, type }))}
                      style={[styles.typeChip, { backgroundColor: isActive ? colors.primary : colors.bgCard, borderColor: isActive ? colors.primary : colors.border }]}
                    >
                      <Text style={[styles.typeChipText, { color: isActive ? colors.white : colors.textSecondary }]}>{type}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <AnimatedPressable onPress={handleAdd} haptic="medium" scaleTo={0.97} style={[styles.submitBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="add-circle" size={18} color={colors.white} />
                <Text style={styles.submitBtnText}>{t('advisory.adminAddSubmit')}</Text>
              </AnimatedPressable>
            </View>
          </ScrollView>
        </View>
      )}

      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={renderRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={false}
        onRefresh={loadAllAdvisors}
        ListHeaderComponent={
          <View style={styles.complianceNote}>
            <Ionicons name="shield-checkmark" size={14} color="#00D2FF" />
            <Text style={styles.complianceText}>{t('advisory.adminComplianceNote')}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t('advisory.noAdvisors')}</Text>
          </View>
        }
      />
    </AppScreen>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...FONTS.bold,
    fontSize: FONTS.size.xl,
    color: colors.text,
    textAlign: 'center',
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formWrap: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.lg,
    width: 320,
    gap: SPACING.sm,
  },
  formTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
    marginBottom: SPACING.xs,
  },
  input: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
  typeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  typeChipText: {
    ...FONTS.medium,
    fontSize: FONTS.size.sm,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  submitBtnText: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.sm,
    color: colors.white,
  },
  complianceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#00D2FF10',
    borderColor: '#00D2FF30',
    borderWidth: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  complianceText: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  listContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 40,
    gap: SPACING.md,
  },
  advisorCard: {
    borderRadius: BORDER_RADIUS.lg,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#6C63FF20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...FONTS.bold,
    fontSize: FONTS.size.lg,
    color: '#6C63FF',
  },
  info: {
    flex: 1,
  },
  name: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.text,
  },
  sub: {
    ...FONTS.regular,
    fontSize: FONTS.size.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  actionText: {
    ...FONTS.medium,
    fontSize: FONTS.size.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.huge,
  },
  emptyTitle: {
    ...FONTS.semiBold,
    fontSize: FONTS.size.md,
    color: colors.textMuted,
  },
});
