/**
 * ============================================================================
 * Toroloom — Journal Entry Modal
 * ============================================================================
 *
 * The "add entry" form behind the journal FAB (showEntryModal in
 * useBehaviorJournalStore). Records the closed trade AND — the point of this
 * component — the PLANNED stop-loss and target the trader committed to
 * BEFORE entering. Those two numbers are what make realized R:R measurable
 * in the weekly discipline report (disciplineAnalytics).
 *
 * Live preview while typing:
 *   risk/share = |entry − plannedStop|   reward/share = |target − entry|
 *   planned R:R = reward / risk, colour-coded against the user's committed
 *   ratio from tradingPrefsStore (green when the plan honours it).
 *
 * Exit reason is inferred on save: exit ≈ stop → 'stop_loss',
 * exit ≈ target → 'target', otherwise 'manual'.
 * ============================================================================
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../hooks/useT';
import { useBehaviorJournalStore, ALL_EMOTIONS, ALL_MISTAKES, MISTAKE_LABELS } from '../../store/behavioralJournalStore';
import { useTradingPrefsStore } from '../../store/tradingPrefsStore';
import { usePortfolioStore } from '../../store/portfolioStore';
import { SPACING, FONTS, BORDER_RADIUS } from '../../constants/theme';
import { resolvePrefill, mergePrefill, buildPrefillForSymbol } from '../../utils/analytics/journalPrefill';
import type { PrefillSource } from '../../utils/analytics/journalPrefill';
import type { EmotionalState, TradingMistake } from '../../types';

const CLOSE_THRESHOLD = 0.005; // 0.5% — exit "at" stop/target detection

export default function JournalEntryModal() {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = createStyles(colors);

  const show = useBehaviorJournalStore(s => s.showEntryModal);
  const addEntry = useBehaviorJournalStore(s => s.addEntry);
  const setShowEntryModal = useBehaviorJournalStore(s => s.setShowEntryModal);
  const pendingOneTapPrefill = useBehaviorJournalStore(s => s.pendingOneTapPrefill);
  const consumeOneTapPrefill = useBehaviorJournalStore(s => s.consumeOneTapPrefill);
  const committedRatio = useTradingPrefsStore(s => s.rewardRiskRatio);
  const journalEntries = useBehaviorJournalStore(s => s.entries);
  const { trades } = usePortfolioStore();

  // ── Form state ─────────────────────────────────────────────
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [plannedStop, setPlannedStop] = useState('');
  const [plannedTarget, setPlannedTarget] = useState('');
  const [emotionalState, setEmotionalState] = useState<EmotionalState>('neutral');
  const [mistakes, setMistakes] = useState<TradingMistake[]>([]);
  const [notes, setNotes] = useState('');
  const [attemptedSave, setAttemptedSave] = useState(false);

  // ── Prefill from the symbol's last closed trade ────────────
  // Fires when the user commits a new symbol (blur/submit), one-shot per
  // open per symbol, and never clobbers fields they've already filled.
  const lastPrefilledSymbol = useRef<string>('');
  const setField = (field: string, value: string) => {
    if (field === 'symbol') setSymbol(value);
    else if (field === 'direction') setDirection(value as 'long' | 'short');
    else if (field === 'entryPrice') setEntryPrice(value);
    else if (field === 'exitPrice') setExitPrice(value);
    else if (field === 'quantity') setQuantity(value);
    else if (field === 'plannedStop') setPlannedStop(value);
    else if (field === 'plannedTarget') setPlannedTarget(value);
  };

  const applyPrefillFor = useCallback((rawSymbol: string) => {
    const symbol = rawSymbol.trim().toUpperCase();
    if (!symbol || symbol === lastPrefilledSymbol.current) return;

    const resolved = resolvePrefill(journalEntries, trades, symbol);
    if (!resolved) return;

    const { data, source } = resolved;
    const current = {
      symbol, direction, entryPrice, exitPrice,
      quantity, plannedStop, plannedTarget,
    };
    const { next, applied } = mergePrefill(current, data);
    if (applied.length === 0) return;

    lastPrefilledSymbol.current = symbol;
    for (const field of applied) {
      setField(field, next[field]);
    }
    setPrefillSource(source);
  }, [journalEntries, trades, direction, entryPrice, exitPrice, quantity, plannedStop, plannedTarget]);

  const [prefillSource, setPrefillSource] = useState<PrefillSource | null>(null);

  // Open/close lifecycle. On close: reset the per-open prefill bookkeeping.
  // On open: consume any one-tap prefill intent (pendingOneTapPrefill, set
  // by the streak-rebuild banner) by auto-prefilling from the user's MOST
  // RECENT closed trade across both sources — journal entries and broker
  // history — regardless of symbol. The intent is cleared right after, so a
  // plain manual open right after is untouched.
  useEffect(() => {
    if (show && pendingOneTapPrefill) {
      const resolved = buildPrefillForSymbol(journalEntries, trades);
      if (resolved) {
        const { data, source } = resolved;
        const current = {
          symbol, direction, entryPrice, exitPrice,
          quantity, plannedStop, plannedTarget,
        };
        const { next, applied } = mergePrefill(current, data);
        if (applied.length > 0) {
          // Mark this symbol as prefilled so the manual-typing path
          // (below) doesn't fight the one-tap application this open.
          lastPrefilledSymbol.current = data.symbol;
          for (const field of applied) {
            setField(field, next[field]);
          }
          setPrefillSource(source);
        }
      }
      consumeOneTapPrefill();
    } else if (!show) {
      lastPrefilledSymbol.current = '';
      setPrefillSource(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, pendingOneTapPrefill]);

  // Manual typing path: when the user commits a symbol (blur/submit) and no
  // prefill has been applied yet this open, prefill from that symbol's own
  // history. A one-tap intent prefill (above) suppresses this for the same
  // open, so the two paths never fight.
  useEffect(() => {
    if (!show || !symbol.trim()) return;
    if (lastPrefilledSymbol.current !== '') return;
    applyPrefillFor(symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const reset = useCallback(() => {
    setSymbol('');
    setDirection('long');
    setEntryPrice('');
    setExitPrice('');
    setQuantity('');
    setPlannedStop('');
    setPlannedTarget('');
    setEmotionalState('neutral');
    setMistakes([]);
    setNotes('');
    setAttemptedSave(false);
  }, []);

  const close = useCallback(() => {
    setShowEntryModal(false);
    reset();
  }, [setShowEntryModal, reset]);

  // ── Parsed numbers ─────────────────────────────────────────
  const entryNum = parseFloat(entryPrice);
  const exitNum = parseFloat(exitPrice);
  const qtyNum = parseInt(quantity, 10);
  const stopNum = plannedStop.trim() === '' ? null : parseFloat(plannedStop);
  const targetNum = plannedTarget.trim() === '' ? null : parseFloat(plannedTarget);

  // ── Validation ─────────────────────────────────────────────
  const errors = {
    symbol: symbol.trim() === '',
    entry: !(entryNum > 0),
    exit: !(exitNum > 0),
    qty: !(qtyNum > 0),
  };
  const hasErrors = errors.symbol || errors.entry || errors.exit || errors.qty;

  // ── P&L math ───────────────────────────────────────────────
  const pnl = useMemo(() => {
    if (!entryNum || !exitNum || !qtyNum) return 0;
    const perUnit = direction === 'long' ? exitNum - entryNum : entryNum - exitNum;
    return perUnit * qtyNum;
  }, [entryNum, exitNum, qtyNum, direction]);

  // ── Planned R:R preview (the discipline feature) ───────────
  const preview = useMemo(() => {
    if (!entryNum || !qtyNum) return null;
    if (stopNum == null || !isFinite(stopNum)) return null;

    const riskPerUnit = Math.abs(entryNum - stopNum);
    if (riskPerUnit <= 0) return null;

    const riskAmount = riskPerUnit * qtyNum;

    if (targetNum == null || !isFinite(targetNum)) {
      // Stop only: still recordable, no planned reward
      return { riskPerUnit, riskAmount, rewardPerUnit: null, plannedRR: null };
    }

    const rewardPerUnit = Math.abs(targetNum - entryNum);
    return { riskPerUnit, riskAmount, rewardPerUnit, plannedRR: rewardPerUnit / riskPerUnit };
  }, [entryNum, stopNum, targetNum, qtyNum]);

  const meetsCommitment =
    preview?.plannedRR != null &&
    committedRatio != null &&
    preview.plannedRR >= committedRatio - 0.05;

  // ── Save ───────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    setAttemptedSave(true);
    if (hasErrors) return;

    addEntry({
      date: new Date().toISOString(),
      symbol: symbol.trim().toUpperCase(),
      direction,
      entryPrice: entryNum,
      exitPrice: exitNum,
      quantity: qtyNum,
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: Math.round((pnl / (entryNum * qtyNum)) * 10000) / 100,
      holdingPeriod: '0h',
      emotionalState,
      mistakes,
      planCompliance: mistakes.length === 0 ? 100 : Math.max(20, 100 - mistakes.length * 20),
      notes,
      setupType: 'manual',
      exitReason: ((): string => {
        if (!entryNum || !exitNum) return 'manual';
        if (stopNum != null && Math.abs(exitNum - stopNum) / entryNum <= CLOSE_THRESHOLD) return 'stop_loss';
        if (targetNum != null && Math.abs(exitNum - targetNum) / entryNum <= CLOSE_THRESHOLD) return 'target';
        return 'manual';
      })(),
      tags: [symbol.trim().toUpperCase()],
      ...(stopNum != null && isFinite(stopNum) ? { plannedStop: stopNum } : {}),
      ...(targetNum != null && isFinite(targetNum) ? { plannedTarget: targetNum } : {}),
    });
    close();
  }, [addEntry, close, direction, emotionalState, entryNum, exitNum, hasErrors, mistakes, notes, pnl, qtyNum, stopNum, symbol, targetNum]);

  if (!show) return null;

  const toggleMistake = (m: TradingMistake) => {
    setMistakes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  return (
    <View style={styles.overlay} testID="journal-entry-modal">
      <View style={[styles.sheet, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('journal.entryTitle')}</Text>
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="close">
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* ── Symbol + direction ── */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('journal.entrySymbol')}</Text>
          <TextInput
            testID="journal-symbol-input"
            style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }, errors.symbol && attemptedSave && styles.inputError]}
            value={symbol}
            onChangeText={setSymbol}
            onBlur={() => applyPrefillFor(symbol)}
            onSubmitEditing={() => applyPrefillFor(symbol)}
            placeholder="RELIANCE"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />
          {prefillSource && (
            <View style={styles.prefillHint} testID="journal-prefill-hint">
              <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
              <Text style={[styles.prefillHintText, { color: colors.textMuted }]}>
                {prefillSource === 'journal'
                  ? t('journal.prefillFromJournal', { symbol })
                  : t('journal.prefillFromTrades', { symbol })}
              </Text>
            </View>
 )}
          {errors.symbol && attemptedSave && (
            <Text style={[styles.errorText, { color: colors.danger }]}>{t('journal.errSymbol')}</Text>
          )}

          <View style={styles.toggleRow}>
            {(['long', 'short'] as const).map(d => (
              <Pressable
                key={d}
                testID={`journal-direction-${d}`}
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: direction === d
                      ? (d === 'long' ? colors.successDim : colors.dangerDim)
                      : 'transparent',
                    borderColor: direction === d ? (d === 'long' ? colors.success : colors.danger) : colors.border,
                  },
                ]}
                onPress={() => setDirection(d)}
              >
                <Ionicons
                  name={d === 'long' ? 'arrow-up' : 'arrow-down'}
                  size={14}
                  color={d === 'long' ? colors.success : colors.danger}
                />
                <Text style={[styles.toggleText, { color: d === 'long' ? colors.success : colors.danger }]}>
                  {d === 'long' ? t('journal.entryLong') : t('journal.entryShort')}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ── Prices ── */}
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('journal.entryPriceLabel')}</Text>
              <TextInput
                testID="journal-entry-input"
                style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }, errors.entry && attemptedSave && styles.inputError]}
                value={entryPrice}
                onChangeText={setEntryPrice}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.col}>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('journal.exitPriceLabel')}</Text>
              <TextInput
                testID="journal-exit-input"
                style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }, errors.exit && attemptedSave && styles.inputError]}
                value={exitPrice}
                onChangeText={setExitPrice}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <Text style={[styles.label, { color: colors.textMuted }]}>{t('journal.quantityLabel')}</Text>
          <TextInput
            testID="journal-qty-input"
            style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }, errors.qty && attemptedSave && styles.inputError]}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />

          {/* ── THE DISCIPLINE INPUTS ── */}
          <View style={[styles.planSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.planHeader}>
              <Ionicons name="shield-outline" size={15} color={colors.primary} />
              <Text style={[styles.planHeaderText, { color: colors.text }]}>{t('journal.planBeforeTrade')}</Text>
            </View>
            <Text style={[styles.planHint, { color: colors.textMuted }]}>{t('journal.planHint')}</Text>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={[styles.label, { color: colors.textMuted }]}>{t('journal.plannedStopLabel')}</Text>
                <TextInput
                  testID="journal-stop-input"
                  style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                  value={plannedStop}
                  onChangeText={setPlannedStop}
                  keyboardType="decimal-pad"
                  placeholder={direction === 'long' ? 'below entry' : 'above entry'}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.col}>
                <Text style={[styles.label, { color: colors.textMuted }]}>{t('journal.plannedTargetLabel')}</Text>
                <TextInput
                  testID="journal-target-input"
                  style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
                  value={plannedTarget}
                  onChangeText={setPlannedTarget}
                  keyboardType="decimal-pad"
                  placeholder={direction === 'long' ? 'above entry' : 'below entry'}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* ── Live planned-R:R preview ── */}
            {preview && (
              <View
                testID="journal-rr-preview"
                style={[styles.rrPreview, {
                  backgroundColor: meetsCommitment ? colors.successDim : colors.warningDim,
                }]}
              >
                <Ionicons
                  name={meetsCommitment ? 'shield-checkmark' : 'warning'}
                  size={16}
                  color={meetsCommitment ? colors.success : colors.warning}
                />
                <View style={styles.rrPreviewTextWrap}>
                  <Text style={[styles.rrPreviewMain, { color: colors.text }]}>
                    {`${t('journal.plannedRisk')}: ₹${(preview.riskPerUnit * qtyNum).toLocaleString('en-IN')}${
                      preview.rewardPerUnit != null
                        ? `  ·  ${t('journal.plannedReward')}: ₹${(preview.rewardPerUnit * qtyNum).toLocaleString('en-IN')}`
                        : ''
                    }`}
                  </Text>
                  {preview.plannedRR != null && (
                    <Text style={[styles.rrPreviewSub, { color: meetsCommitment ? colors.success : colors.warning }]}>
                      {t('journal.plannedRR')} 1:{preview.plannedRR.toFixed(2)}
                      {committedRatio != null && (
                        meetsCommitment
                          ? ` · ${t('journal.rrMeetsCommitment', { ratio: committedRatio })}`
                          : ` · ${t('journal.rrBelowCommitment', { ratio: committedRatio })}`
                      )}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* ── Psychology ── */}
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('journal.emotionLabel')}</Text>
          <View style={styles.chipWrap}>
            {ALL_EMOTIONS.map(em => (
              <Pressable
                key={em}
                testID={`journal-emotion-${em}`}
                style={[
                  styles.chip,
                  {
                    backgroundColor: emotionalState === em ? colors.primaryDim : 'transparent',
                    borderColor: emotionalState === em ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setEmotionalState(em)}
              >
                <Text style={[styles.chipText, { color: emotionalState === em ? colors.primary : colors.textSecondary }]}>
                  {em.charAt(0).toUpperCase() + em.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textMuted }]}>{t('journal.mistakesLabel')}</Text>
          <View style={styles.chipWrap}>
            {ALL_MISTAKES.map(m => (
              <Pressable
                key={m}
                testID={`journal-mistake-${m}`}
                style={[
                  styles.chip,
                  {
                    backgroundColor: mistakes.includes(m) ? colors.dangerDim : 'transparent',
                    borderColor: mistakes.includes(m) ? colors.danger : colors.border,
                  },
                ]}
                onPress={() => toggleMistake(m)}
              >
                <Text style={[styles.chipText, { color: mistakes.includes(m) ? colors.danger : colors.textSecondary }]}>
                  {MISTAKE_LABELS[m]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textMuted }]}>{t('journal.notesLabel')}</Text>
          <TextInput
            testID="journal-notes-input"
            style={[styles.input, styles.notesInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.text }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder={t('journal.notesPlaceholder')}
            placeholderTextColor={colors.textMuted}
          />

          {/* ── P&L preview ── */}
          {entryNum > 0 && exitNum > 0 && qtyNum > 0 && (
            <Text style={[styles.pnlPreview, { color: pnl >= 0 ? colors.success : colors.danger }]}>
              {t('journal.pnlPreview')}: {pnl >= 0 ? '+' : '−'}₹{Math.abs(Math.round(pnl)).toLocaleString('en-IN')}
            </Text>
          )}
        </ScrollView>

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <Pressable testID="journal-cancel" style={[styles.actionBtn, styles.cancelBtn, { borderColor: colors.border }]} onPress={close}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>{t('journal.cancel')}</Text>
          </Pressable>
          <Pressable testID="journal-save" style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
            <Text style={styles.saveText}>{t('journal.saveEntry')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ──── Styles ────────────────────────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: { ...FONTS.bold, fontSize: FONTS.size.lg },
  label: { ...FONTS.semiBold, fontSize: FONTS.size.xs, marginBottom: 6, marginTop: SPACING.sm },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    ...FONTS.regular,
    fontSize: FONTS.size.sm,
  },
  inputError: { borderColor: colors.danger },
  errorText: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 4 },
  toggleRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  toggleText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  row: { flexDirection: 'row', gap: SPACING.sm },
  col: { flex: 1 },
  planSection: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  prefillHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  prefillHintText: { ...FONTS.regular, fontSize: FONTS.size.xs, fontStyle: 'italic' },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  planHeaderText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  planHint: { ...FONTS.regular, fontSize: FONTS.size.xs, marginTop: 2, marginBottom: SPACING.sm },
  rrPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  rrPreviewTextWrap: { flex: 1 },
  rrPreviewMain: { ...FONTS.semiBold, fontSize: FONTS.size.xs },
  rrPreviewSub: { ...FONTS.semiBold, fontSize: FONTS.size.xs, marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs + 2 },
  chip: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  chipText: { ...FONTS.regular, fontSize: FONTS.size.xs },
  notesInput: { minHeight: 70, textAlignVertical: 'top', paddingTop: SPACING.sm },
  pnlPreview: { ...FONTS.bold, fontSize: FONTS.size.sm, marginTop: SPACING.md, textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  cancelBtn: { borderWidth: 1, backgroundColor: 'transparent' },
  cancelText: { ...FONTS.semiBold, fontSize: FONTS.size.sm },
  saveText: { ...FONTS.semiBold, fontSize: FONTS.size.sm, color: '#FFFFFF' },
});
