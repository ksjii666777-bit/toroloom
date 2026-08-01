import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useVoiceStore, VOICE_MESSAGES } from '../../store/voiceStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';

Dimensions.get('window');

const getRatePresets = (t: any) => [
  { label: t('voiceSettings.slow'), value: 0.6, icon: 'timer-outline' },
  { label: t('voiceSettings.normal'), value: 0.85, icon: 'checkmark-circle' },
  { label: t('voiceSettings.fast'), value: 1.2, icon: 'rocket-outline' },
];

const getPitchPresets = (t: any) => [
  { label: t('voiceSettings.low'), value: 0.7, icon: 'arrow-down-circle' },
  { label: t('voiceSettings.normal'), value: 1.0, icon: 'checkmark-circle' },
  { label: t('voiceSettings.high'), value: 1.5, icon: 'arrow-up-circle' },
];

const getTestMessages = (t: any) => [
  { label: t('voiceSettings.testStopLoss'), message: VOICE_MESSAGES.stopLossBreached },
  { label: t('voiceSettings.testProfitTarget'), message: VOICE_MESSAGES.profitTargetHit },
  { label: t('voiceSettings.testLockdown'), message: VOICE_MESSAGES.lockdownLifted },
  { label: t('voiceSettings.testDailyLoss'), message: VOICE_MESSAGES.dailyLossWarning },
  { label: t('voiceSettings.testVolatility'), message: VOICE_MESSAGES.marketVolatility },
];

export default function VoiceSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);
  const {
    enabled, rate, pitch, toggleVoice, setRate, setPitch,
  } = useVoiceStore();
  const speak = useVoiceStore(s => s.speak);
  const ratePresets = getRatePresets(t);
  const pitchPresets = getPitchPresets(t);
  const testMessages = getTestMessages(t);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>{t('voiceSettings.title')}</Text>
            <Text style={styles.subtitle}>{t('voiceSettings.subtitle')}</Text>
          </View>
        </View>

        {/* Voice Toggle */}
        <Card title={t('voiceSettings.announcementsTitle')} subtitle={t('voiceSettings.announcementsDesc')}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons
                name={enabled ? 'volume-high' : 'volume-mute'}
                size={24}
                color={enabled ? colors.primary : colors.textMuted}
              />
              <View>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>
                  {enabled ? t('voiceSettings.voiceOn') : t('voiceSettings.voiceOff')}
                </Text>
                <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>
                  {enabled
                    ? t('voiceSettings.voiceOnDesc')
                    : t('voiceSettings.voiceOffDesc')}
                </Text>
              </View>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggleVoice}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={enabled ? colors.primary : colors.textMuted}
            />
          </View>
        </Card>

        {/* Speech Rate */}
        <Card title={t('voiceSettings.speechRate')} subtitle={t('voiceSettings.speechRateDesc')} style={{ marginTop: SPACING.md }}>
          <View style={styles.presetsRow}>
            {ratePresets.map(p => (
              <TouchableOpacity
                key={p.value}
                onPress={() => setRate(p.value)}
                style={[
                  styles.presetBtn,
                  { borderColor: colors.border },
                  Math.abs(rate - p.value) < 0.01 && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                ]}
              >
                <Ionicons
                  name={p.icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={Math.abs(rate - p.value) < 0.01 ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.presetLabel, { color: Math.abs(rate - p.value) < 0.01 ? colors.primary : colors.textMuted }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.valueBadge}>
            <Text style={[styles.valueText, { color: colors.text }]}>{rate.toFixed(2)}x</Text>
          </View>
        </Card>

        {/* Pitch */}
        <Card title={t('voiceSettings.voicePitch')} subtitle={t('voiceSettings.voicePitchDesc')} style={{ marginTop: SPACING.md }}>
          <View style={styles.presetsRow}>
            {pitchPresets.map(p => (
              <TouchableOpacity
                key={p.value}
                onPress={() => setPitch(p.value)}
                style={[
                  styles.presetBtn,
                  { borderColor: colors.border },
                  Math.abs(pitch - p.value) < 0.01 && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                ]}
              >
                <Ionicons
                  name={p.icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={Math.abs(pitch - p.value) < 0.01 ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.presetLabel, { color: Math.abs(pitch - p.value) < 0.01 ? colors.primary : colors.textMuted }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.valueBadge}>
            <Text style={[styles.valueText, { color: colors.text }]}>{pitch.toFixed(2)}x</Text>
          </View>
        </Card>

        {/* Test Voice */}
        <Card title={t('voiceSettings.testVoice')} subtitle={t('voiceSettings.testVoiceDesc2')} style={{ marginTop: SPACING.md }}>
          <View style={styles.testGrid}>
            {testMessages.map(test => (
              <AnimatedPressable
                key={test.label}
                onPress={() => speak(test.message)}
                scaleTo={0.95}
                style={[styles.testBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
              >
                <Ionicons
                  name="play-circle"
                  size={20}
                  color={test.message.category === 'alert' ? '#FF3366' :
                    test.message.category === 'celebration' ? '#FFD700' :
                    test.message.category === 'warning' ? '#F59E0B' : colors.primary}
                />
                <Text style={[styles.testLabel, { color: colors.text }]}>{test.label}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </Card>

        {/* Voice Events List */}
        <Card title={t('voiceSettings.voiceEvents')} subtitle={t('voiceSettings.voiceEventsDesc')} style={{ marginTop: SPACING.md }}>
          {Object.entries(VOICE_MESSAGES).map(([key, msg], i, arr) => (
            <View key={key}>
              <View style={styles.eventRow}>
                <View style={styles.eventInfo}>
                  <Text style={[styles.eventName, { color: colors.text }]}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </Text>
                  <Text style={[styles.eventCategory, { color: colors.textMuted }]} numberOfLines={1}>
                    {msg.category} · {t('voiceSettings.prioritySuffix', { value: msg.priority })}
                  </Text>
                </View>
                <View style={[styles.priorityBadge, {
                  backgroundColor: msg.priority === 'high' ? '#FF336615' :
                    msg.priority === 'normal' ? '#F59E0B15' : '#6B728015',
                }]}>
                  <Text style={[styles.priorityText, {
                    color: msg.priority === 'high' ? '#FF3366' :
                      msg.priority === 'normal' ? '#F59E0B' : '#6B7280',
                  }]}>
                    {msg.priority}
                  </Text>
                </View>
              </View>
              {i < arr.length - 1 && <View style={[styles.eventDivider, { backgroundColor: colors.divider }]} />}
            </View>
          ))}
        </Card>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, marginBottom: SPACING.xl, gap: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bgCard, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  title: { ...FONTS.bold, fontSize: FONTS.size.title, color: colors.text },
  subtitle: { ...FONTS.regular, fontSize: FONTS.size.sm, color: colors.textSecondary, marginTop: 2 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  toggleLabel: { ...FONTS.medium, fontSize: FONTS.size.md },
  toggleDesc: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2 },

  presetsRow: { flexDirection: 'row', gap: SPACING.sm },
  presetBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.md, borderWidth: 1 },
  presetLabel: { ...FONTS.medium, fontSize: FONTS.size.sm },

  valueBadge: { alignItems: 'center', marginTop: SPACING.md },
  valueText: { ...FONTS.bold, fontSize: FONTS.size.xxl, fontVariant: ['tabular-nums'] },

  testGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  testBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1 },
  testLabel: { ...FONTS.medium, fontSize: FONTS.size.xs },

  eventRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.md },
  eventInfo: { flex: 1 },
  eventName: { ...FONTS.medium, fontSize: FONTS.size.sm, textTransform: 'capitalize' },
  eventCategory: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2 },
  eventDivider: { height: 1 },
  priorityBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  priorityText: { ...FONTS.medium, fontSize: FONTS.size.xs, textTransform: 'uppercase' },
});
