import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useVoiceStore, VOICE_MESSAGES } from '../../store/voiceStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import Card from '../../components/ui/Card';

Dimensions.get('window');

const RATE_PRESETS = [
  { label: 'Slow', value: 0.6, icon: 'timer-outline' },
  { label: 'Normal', value: 0.85, icon: 'checkmark-circle' },
  { label: 'Fast', value: 1.2, icon: 'rocket-outline' },
];

const PITCH_PRESETS = [
  { label: 'Low', value: 0.7, icon: 'arrow-down-circle' },
  { label: 'Normal', value: 1.0, icon: 'checkmark-circle' },
  { label: 'High', value: 1.5, icon: 'arrow-up-circle' },
];

const TEST_MESSAGES = [
  { label: 'Stop-Loss Alert', message: VOICE_MESSAGES.stopLossBreached },
  { label: 'Profit Target', message: VOICE_MESSAGES.profitTargetHit },
  { label: 'Lockdown Lifted', message: VOICE_MESSAGES.lockdownLifted },
  { label: 'Daily Loss Warning', message: VOICE_MESSAGES.dailyLossWarning },
  { label: 'Market Volatility', message: VOICE_MESSAGES.marketVolatility },
];

export default function VoiceSettingsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const {
    enabled, rate, pitch, toggleVoice, setRate, setPitch,
  } = useVoiceStore();
  const speak = useVoiceStore(s => s.speak);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Voice Settings</Text>
            <Text style={styles.subtitle}>AI Companion voice preferences</Text>
          </View>
        </View>

        {/* Voice Toggle */}
        <Card title="Voice Announcements" subtitle="Enable or disable AI voice alerts">
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons
                name={enabled ? 'volume-high' : 'volume-mute'}
                size={24}
                color={enabled ? colors.primary : colors.textMuted}
              />
              <View>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>
                  {enabled ? 'Voice is ON' : 'Voice is OFF'}
                </Text>
                <Text style={[styles.toggleDesc, { color: colors.textMuted }]}>
                  {enabled
                    ? 'The AI Companion will announce alerts and events'
                    : 'All voice announcements are muted'}
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
        <Card title="Speech Rate" subtitle="How fast the AI speaks" style={{ marginTop: SPACING.md }}>
          <View style={styles.presetsRow}>
            {RATE_PRESETS.map(p => (
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
        <Card title="Voice Pitch" subtitle="High or low voice tone" style={{ marginTop: SPACING.md }}>
          <View style={styles.presetsRow}>
            {PITCH_PRESETS.map(p => (
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
        <Card title="Test Voice" subtitle="Tap to hear a message" style={{ marginTop: SPACING.md }}>
          <View style={styles.testGrid}>
            {TEST_MESSAGES.map(test => (
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
        <Card title="Voice Events" subtitle="Events that trigger voice announcements" style={{ marginTop: SPACING.md }}>
          {Object.entries(VOICE_MESSAGES).map(([key, msg], i, arr) => (
            <View key={key}>
              <View style={styles.eventRow}>
                <View style={styles.eventInfo}>
                  <Text style={[styles.eventName, { color: colors.text }]}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </Text>
                  <Text style={[styles.eventCategory, { color: colors.textMuted }]} numberOfLines={1}>
                    {msg.category} · {msg.priority} priority
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
