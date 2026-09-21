/**
 * Toroloom — Prop-Firm Challenge Screen
 *
 * Rehearse an FTMO-style funded challenge on top of the behavioural journal:
 *   - Setup: pick a preset (FTMO / Topstep / The5ers / custom) and tweak rules
 *   - Dashboard: profit-target progress, daily-loss budget, overall drawdown
 *     (static or trailing), trading-day count, consistency rule
 *   - Pre-trade checker: simulate a planned trade's stop-out against the
 *     remaining budgets BEFORE the position is opened
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { AppHeader } from '../../components/ui/AppHeader';
import AppScreen from '../../components/ui/AppScreen';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import type { JournalEntry } from '../../types';
import {
  CHALLENGE_PRESETS, makeCustomConfig, formatChallengeMoney,
} from '../../services/propFirm/challengePresets';
import type { ChallengeConfig, PropProvider } from '../../services/propFirm/challengePresets';
import {
  computeChallengeState, checkPlannedTrade,
} from '../../services/propFirm/drawdownEngine';
import type { RiskVerdict, PreTradeVerdict, PlannedTradeCheck } from '../../services/propFirm/drawdownEngine';
import { usePropAccountStore } from '../../store/propAccountStore';
import { useBehaviorJournalStore } from '../../store/behavioralJournalStore';
import { useTradingPrefsStore } from '../../store/tradingPrefsStore';

type Props = NativeStackScreenProps<RootStackParamList, 'PropChallenge'>;

const PRESET_ORDER: PropProvider[] = ['ftmo', 'topstep', 'the5ers', 'custom'];

const VERDICT_KEYS: Record<RiskVerdict, string> = {
  ok: 'propFirm.dashboard.riskOk',
  warning: 'propFirm.dashboard.riskWarning',
  danger: 'propFirm.dashboard.riskDanger',
  breached: 'propFirm.dashboard.riskBreached',
};

const CHECK_VERDICT_KEYS: Record<PreTradeVerdict, string> = {
  ok: 'propFirm.check.verdictOk',
  warn: 'propFirm.check.verdictWarn',
  block: 'propFirm.check.verdictBlock',
};

export default function PropChallengeScreen(_props: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const challenge = usePropAccountStore(s => s.challenge);
  const loadAccount = usePropAccountStore(s => s.loadAccount);
  const startChallenge = usePropAccountStore(s => s.startChallenge);
  const advancePhase = usePropAccountStore(s => s.advancePhase);
  const abandonChallenge = usePropAccountStore(s => s.abandonChallenge);
  const clearAccount = usePropAccountStore(s => s.clearAccount);

  const entries = useBehaviorJournalStore(s => s.entries);
  const committedRR = useTradingPrefsStore(s => s.rewardRiskRatio);

  useEffect(() => { loadAccount(); }, [loadAccount]);

  // ── Setup state ─────────────────────────────────────────────
  const [provider, setProvider] = useState<PropProvider>('ftmo');
  const [draft, setDraft] = useState<ChallengeConfig>(() => makeCustomConfig({ provider: 'ftmo', accountSize: 100000, currency: 'USD', phases: [{ number: 1, profitTargetPercent: 10 }, { number: 2, profitTargetPercent: 5 }, { number: 3, profitTargetPercent: null }], minTradingDays: 4, consistencyRulePercent: null, trailingDrawdown: false }));
  const [sizeText, setSizeText] = useState('100000');
  const [dailyText, setDailyText] = useState('5');
  const [overallText, setOverallText] = useState('10');
  const [daysText, setDaysText] = useState('4');
  const [consistencyText, setConsistencyText] = useState('');
  const [setupError, setSetupError] = useState(false);

  const pickPreset = useCallback((p: PropProvider) => {
    setProvider(p);
    setSetupError(false);
    if (p === 'custom') {
      const cfg = makeCustomConfig();
      setDraft(cfg);
      setSizeText(String(cfg.accountSize));
      setDailyText(String(cfg.maxDailyLossPercent));
      setOverallText(String(cfg.maxOverallLossPercent));
      setDaysText(String(cfg.minTradingDays));
      setConsistencyText('');
      return;
    }
    const preset = CHALLENGE_PRESETS.find(x => x.id === p);
    if (preset) {
      const cfg: ChallengeConfig = { ...preset.configs[0], phases: preset.configs[0].phases.map(ph => ({ ...ph })) };
      setDraft(cfg);
      setSizeText(String(cfg.accountSize));
      setDailyText(String(cfg.maxDailyLossPercent));
      setOverallText(String(cfg.maxOverallLossPercent));
      setDaysText(String(cfg.minTradingDays));
      setConsistencyText(cfg.consistencyRulePercent != null ? String(cfg.consistencyRulePercent) : '');
    }
  }, []);

  const applyDraft = () => {
    const size = Number(sizeText);
    const daily = Number(dailyText);
    const overall = Number(overallText);
    const days = Number(daysText);
    const consistency = consistencyText.trim() === '' ? null : Number(consistencyText);
    const valid = size > 0 && daily > 0 && daily <= 50 && overall > 0 && overall <= 90
      && days >= 0 && Number.isFinite(days)
      && (consistency == null || (consistency > 0 && consistency <= 100));
    if (!valid) { setSetupError(true); return; }
    setSetupError(false);
    startChallenge({
      ...draft,
      accountSize: size,
      maxDailyLossPercent: daily,
      maxOverallLossPercent: overall,
      minTradingDays: Math.floor(days),
      consistencyRulePercent: consistency,
    });
  };

  // ── Dashboard state ─────────────────────────────────────────
  const [riskText, setRiskText] = useState('');
  const [rewardText, setRewardText] = useState('');
  const [checkResult, setCheckResult] = useState<PlannedTradeCheck | null>(null);

  const state = useMemo(() => {
    if (!challenge || challenge.outcome !== 'active') return null;
    return computeChallengeState(entries as JournalEntry[], challenge.config, {
      startDate: challenge.startDate,
      phase: challenge.phase,
      todayKey: new Date().toISOString().slice(0, 10),
    });
  }, [challenge, entries]);

  const runCheck = () => {
    if (!state) return;
    const risk = Number(riskText);
    const reward = rewardText.trim() === '' ? null : Number(rewardText);
    if (!Number.isFinite(risk)) { setCheckResult(null); return; }
    setCheckResult(checkPlannedTrade(state, challenge!.config, risk, reward != null && Number.isFinite(reward) ? reward : null, committedRR));
  };

  const fmt = useCallback((amount: number) => formatChallengeMoney(amount, challenge?.config.currency ?? 'INR'), [challenge]);

  // ── Render helpers ──────────────────────────────────────────
  const verdictColor = (v: RiskVerdict) => (
    v === 'breached' ? colors.danger : v === 'danger' ? '#F97316' : v === 'warning' ? colors.warning : colors.success
  );

  const BudgetBar = ({ label, used, verdict, remaining }: { label: string; used: number; verdict: RiskVerdict; remaining: number }) => (
    <View style={styles.budgetBlock} testID={`budget-${label}`}>
      <View style={styles.budgetRow}>
        <Text style={[styles.budgetLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.budgetPct, { color: verdictColor(verdict) }]}>
          {t('propFirm.dashboard.used', { pct: Math.round(Math.min(1, used) * 100) })}
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.barFill, { width: `${Math.min(100, Math.max(2, used * 100))}%`, backgroundColor: verdictColor(verdict) }]} />
      </View>
      <Text style={[styles.budgetRemain, { color: colors.textSecondary }]}>
        {t('propFirm.dashboard.remaining', { amount: fmt(remaining) })}
      </Text>
    </View>
  );

  // ── Outcome ended → show summary + restart ──────────────────
  const ended = challenge && challenge.outcome !== 'active';
  const showSetup = !challenge || ended;

  return (
    <AppScreen scroll>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title={t('propFirm.title')}
          subtitle={showSetup ? t('propFirm.setup.heading') : undefined}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + SPACING.lg }]} showsVerticalScrollIndicator={false}>
        {showSetup && (
          <View style={styles.setupBlock}>
            {ended && challenge && (
              <View style={[styles.outcomeBanner, { backgroundColor: challenge.outcome === 'passed' ? colors.success : colors.danger }]}>
                <Ionicons name={challenge.outcome === 'passed' ? 'trophy' : 'warning'} size={18} color="#fff" accessibilityElementsHidden />
                <Text style={styles.outcomeText}>
                  {challenge.outcome === 'passed' ? t('propFirm.dashboard.passed') : challenge.outcome === 'failed' ? t('propFirm.dashboard.failed') : t('propFirm.dashboard.abandoned')}
                </Text>
                <Pressable onPress={clearAccount} hitSlop={8} accessibilityLabel={t('propFirm.dashboard.newChallenge')} accessibilityRole="button">
                  <Ionicons name="close" size={18} color="#fff" />
                </Pressable>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('propFirm.setup.choosePreset')}</Text>
            <View style={styles.presetRow}>
              {PRESET_ORDER.map(p => {
                const preset = CHALLENGE_PRESETS.find(x => x.id === p);
                const label = p === 'custom' ? t('propFirm.setup.custom') : preset?.label ?? p;
                const active = provider === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => pickPreset(p)}
                    style={[styles.presetChip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : 'transparent' }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={{ color: active ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {provider !== 'custom' && (
              <Text style={[styles.presetDesc, { color: colors.textSecondary }]}>
                {t(`propFirm.presets.${provider}` as const)}
              </Text>
            )}

            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('propFirm.setup.accountSize')}</Text>
            <View style={styles.fieldsRow}>
              <Field label={t('propFirm.setup.accountSize')} value={sizeText} onChangeText={setSizeText} colors={colors} />
              <Field label={t('propFirm.setup.dailyLoss')} value={dailyText} onChangeText={setDailyText} colors={colors} numeric testID="field-daily" />
              <Field label={t('propFirm.setup.overallLoss')} value={overallText} onChangeText={setOverallText} colors={colors} numeric />
            </View>
            <View style={styles.fieldsRow}>
              <Field label={t('propFirm.setup.minDays')} value={daysText} onChangeText={setDaysText} colors={colors} numeric />
              <Field label={t('propFirm.setup.consistency')} value={consistencyText} onChangeText={setConsistencyText} colors={colors} numeric placeholder={t('propFirm.setup.consistencyOff')} />
            </View>

            <View style={styles.switchRow}>
              <Text style={{ color: colors.text, flex: 1 }}>{t('propFirm.setup.trailing')}</Text>
              <Switch
                value={draft.trailingDrawdown}
                onValueChange={v => setDraft(d => ({ ...d, trailingDrawdown: v }))}
                trackColor={{ true: colors.primary, false: colors.border }}
                accessibilityLabel={t('propFirm.setup.trailing')}
              />
            </View>

            {setupError && (
              <Text style={{ color: colors.danger, marginBottom: SPACING.sm }}>{t('propFirm.setup.invalidInput')}</Text>
            )}

            <Pressable
              onPress={applyDraft}
              style={[styles.startBtn, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel={t('propFirm.setup.start')}
            >
              <Text style={styles.startText}>{t('propFirm.setup.start')}</Text>
            </Pressable>
          </View>
        )}

        {!showSetup && challenge && state && (
          <View>
            {/* Header row */}
            <View style={styles.dashHeader}>
              <View style={[styles.phaseBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.phaseText}>
                  {challenge.phase >= challenge.config.phases.length && challenge.config.phases[challenge.config.phases.length - 1].profitTargetPercent == null
                    ? t('propFirm.dashboard.funded')
                    : t('propFirm.dashboard.phase', { n: challenge.phase })}
                </Text>
              </View>
              <Pressable
                onPress={abandonChallenge}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('propFirm.dashboard.abandoned')}
              >
                <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Risk banner */}
            <View style={[styles.riskBanner, { backgroundColor: verdictColor(state.overallRisk) }]}>
              <Text style={styles.riskBannerText}>{t(VERDICT_KEYS[state.overallRisk])}</Text>
            </View>

            {/* Profit target */}
            <View style={[styles.card, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <View style={styles.budgetRow}>
                <Text style={[styles.budgetLabel, { color: colors.textSecondary }]}>{t('propFirm.dashboard.profitTarget')}</Text>
                <Text style={[styles.budgetPct, { color: colors.success }]}>
                  {t('propFirm.dashboard.used', { pct: Math.round(Math.min(1, state.profitProgress) * 100) })}
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.barFill, { width: `${Math.min(100, Math.max(state.profitProgress > 0 ? 2 : 0, state.profitProgress * 100))}%`, backgroundColor: colors.success }]} />
              </View>
              <Text style={[styles.budgetRemain, { color: colors.textSecondary }]}>
                {fmt(state.phaseTargetAmount)} · {t('propFirm.dashboard.totalPnl')}: {fmt(state.totalPnl)}
              </Text>
            </View>

            {/* Budgets */}
            <View style={[styles.card, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <BudgetBar label={t('propFirm.dashboard.dailyLoss')} used={state.dailyLossUsedFraction} verdict={state.dailyVerdict} remaining={state.dailyLossRemaining} />
              <BudgetBar
                label={t('propFirm.dashboard.maxLoss')}
                used={state.overallLossUsedFraction}
                verdict={state.overallVerdict}
                remaining={state.overallLossRemaining}
              />
              <View style={styles.statRow}>
                <Stat label={t('propFirm.dashboard.equity')} value={fmt(state.equity)} colors={colors} />
                <Stat label={t('propFirm.dashboard.peak')} value={fmt(state.peakEquity)} colors={colors} />
                <Stat
                  label={challenge.config.trailingDrawdown ? t('propFirm.dashboard.floorHintTrailing') : t('propFirm.dashboard.floorHint')}
                  value={fmt(state.drawdownFloor)}
                  colors={colors}
                />
                <Stat label={t('propFirm.dashboard.tradingDays')} value={t('propFirm.dashboard.daysMet', { n: state.tradingDays, m: challenge.config.minTradingDays })} colors={colors} />
              </View>
              {state.consistencyViolation && (
                <Text style={{ color: '#F97316', marginTop: SPACING.xs, fontSize: 12 }}>
                  {t('propFirm.dashboard.consistencyBad', { pct: Math.round((state.largestDayProfitShare ?? 0) * 100) })}
                </Text>
              )}
            </View>

            {/* Phase pass */}
            {state.phaseStatus === 'passed' && (
              <Pressable
                onPress={advancePhase}
                style={[styles.startBtn, { backgroundColor: colors.success }]}
                accessibilityRole="button"
              >
                <Text style={styles.startText}>
                  {t('propFirm.dashboard.advance', { n: Math.min(challenge.phase + 1, challenge.config.phases.length) })}
                </Text>
              </Pressable>
            )}

            {/* Pre-trade checker */}
            <View style={[styles.card, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('propFirm.check.heading')}</Text>
              <Text style={[styles.presetDesc, { color: colors.textSecondary }]}>{t('propFirm.check.sub')}</Text>
              <View style={styles.fieldsRow}>
                <Field label={t('propFirm.check.riskAmount')} value={riskText} onChangeText={setRiskText} colors={colors} numeric />
                <Field label={t('propFirm.check.rewardAmount')} value={rewardText} onChangeText={setRewardText} colors={colors} numeric />
              </View>
              <Pressable
                onPress={runCheck}
                style={[styles.checkBtn, { borderColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel={t('propFirm.check.run')}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('propFirm.check.run')}</Text>
              </Pressable>

              {checkResult && (
                <View style={[styles.checkResult, { borderLeftColor: checkResult.verdict === 'ok' ? colors.success : checkResult.verdict === 'warn' ? colors.warning : colors.danger }]}>
                  <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 4 }}>
                    {t(CHECK_VERDICT_KEYS[checkResult.verdict])}
                  </Text>
                  {checkResult.reasons.map(r => (
                    <Text key={r} style={{ color: colors.textSecondary, fontSize: 12 }}>• {t(r as never)}</Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

// ── Local primitives ────────────────────────────────────────────────────────

function Field({ label, value, onChangeText, colors, numeric, placeholder, testID }: {
  label: string; value: string; onChangeText: (v: string) => void; colors: { text: string; textSecondary: string; border: string; bgSecondary: string };
  numeric?: boolean; placeholder?: string; testID?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? 'numeric' : 'default'}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={[styles.fieldInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bgSecondary }]}
        accessibilityLabel={label}
        testID={testID}
      />
    </View>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: { textSecondary: string; text: string } }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: SPACING.md, gap: SPACING.md },
  setupBlock: { gap: SPACING.sm },
  sectionTitle: { ...FONTS.bold, fontSize: 15 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  presetChip: { paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: BORDER_RADIUS.pill, borderWidth: 1.5 },
  presetDesc: { fontSize: 12, marginTop: SPACING.xs },
  fieldsRow: { flexDirection: 'row', gap: SPACING.sm },
  field: { flex: 1, minWidth: 90 },
  fieldLabel: { fontSize: 11, marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 8, fontSize: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs },
  startBtn: { borderRadius: BORDER_RADIUS.md, paddingVertical: 12, alignItems: 'center', marginTop: SPACING.sm },
  startText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  outcomeBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm },
  outcomeText: { color: '#fff', fontWeight: '700', flex: 1 },
  dashHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  phaseBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.pill },
  phaseText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  riskBanner: { borderRadius: BORDER_RADIUS.md, padding: SPACING.sm },
  riskBannerText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
  card: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.md, gap: SPACING.xs },
  budgetBlock: { marginBottom: SPACING.xs },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  budgetLabel: { fontSize: 12, fontWeight: '600' },
  budgetPct: { fontSize: 12, fontWeight: '700' },
  barTrack: { height: 8, borderRadius: BORDER_RADIUS.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: BORDER_RADIUS.pill },
  budgetRemain: { fontSize: 11, marginTop: 4 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs },
  stat: { minWidth: '45%', flex: 1 },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 13, fontWeight: '700' },
  checkBtn: { borderWidth: 1.5, borderRadius: BORDER_RADIUS.md, paddingVertical: 10, alignItems: 'center', marginTop: SPACING.xs },
  checkResult: { borderLeftWidth: 3, paddingLeft: SPACING.sm, marginTop: SPACING.xs, gap: 2 },
});
