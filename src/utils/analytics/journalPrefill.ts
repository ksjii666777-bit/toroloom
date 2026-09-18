/**
 * ============================================================================
 * Toroloom — Journal Entry Prefill
 * ============================================================================
 *
 * When the trader starts typing a symbol in the journal entry modal, the
 * form pre-fills from the LAST closed trade on that symbol — first from
 * previous journal entries (they carry the richest data), then from the
 * broker trade history.
 *
 * Pure functions only — the modal decides WHEN to apply a prefill; this
 * module decides WHAT the prefill looks like and never clobbers fields the
 * user has already touched.
 * ============================================================================
 */

import type { JournalEntry, Trade } from '../../types';

/** What a journal-entry modal prefill looks like (all strings, form-ready) */
export interface PrefillData {
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  plannedStop: string;
  plannedTarget: string;
}

/** Where the prefill came from — shown as a hint in the modal */
export type PrefillSource = 'journal' | 'trades';

/**
 * Build a prefill from the most recent journal entry for the symbol.
 * Returns null when none exists. Entry price is NOT prefilled: the user
 * is logging a NEW trade, and last time's entry is this time's bait.
 */
export function buildPrefillFromJournal(entries: JournalEntry[], rawSymbol: string): PrefillData | null {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) return null;

  const matches = entries.filter(e => e.symbol.toUpperCase() === symbol);
  if (matches.length === 0) return null;

  // Entries are stored newest-first, but don't assume — sort by date desc
  const last = [...matches].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )[0];

  return {
    symbol,
    direction: last.direction,
    entryPrice: '', // new trade, new entry price
    exitPrice: '',
    quantity: String(last.quantity),
    plannedStop: last.plannedStop != null ? String(last.plannedStop) : '',
    plannedTarget: last.plannedTarget != null ? String(last.plannedTarget) : '',
  };
}

/**
 * Build a prefill from broker trade history for the symbol.
 * Matches the last SELL trade (closed position) against its preceding BUY,
 * so quantities and direction reflect the actual round trip. Returns null
 * when no completed round trip exists.
 */
export function buildPrefillFromTrades(trades: Trade[], rawSymbol: string): PrefillData | null {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) return null;

  const symbolTrades = trades
    .filter(tr => tr.symbol.toUpperCase() === symbol)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const lastSell = symbolTrades.find(tr => tr.type === 'sell');
  if (!lastSell) return null;

  // The buy that opened this position: most recent buy BEFORE the sell
  const sellTime = new Date(lastSell.timestamp).getTime();
  const openingBuy = symbolTrades.find(
    tr => tr.type === 'buy' && new Date(tr.timestamp).getTime() < sellTime,
  );
  if (!openingBuy) return null;

  return {
    symbol,
    direction: 'long', // spot round trip: buy → sell
    entryPrice: String(openingBuy.price),
    exitPrice: String(lastSell.price),
    quantity: String(lastSell.quantity),
    plannedStop: '',
    plannedTarget: '',
  };
}

/**
 * Resolve the best prefill for a symbol: journal history first (has planned
 * stop/target), broker round trip as fallback. Returns null when neither
 * source has anything — and the source so the UI can explain itself.
 */
export function resolvePrefill(
  entries: JournalEntry[],
  trades: Trade[],
  rawSymbol: string,
): { data: PrefillData; source: PrefillSource } | null {
  const fromJournal = buildPrefillFromJournal(entries, rawSymbol);
  if (fromJournal) return { data: fromJournal, source: 'journal' };

  const fromTrades = buildPrefillFromTrades(trades, rawSymbol);
  if (fromTrades) return { data: fromTrades, source: 'trades' };

  return null;
}

/**
 * Merge a resolved prefill into current form state — never overwriting a
 * field the user has already filled (only truly-empty fields take values).
 * Returns the fields that were actually set (used for the source hint).
 */
export function mergePrefill(
  current: Record<string, string>,
  prefill: PrefillData,
): { next: Record<string, string>; applied: string[] } {
  const next = { ...current };
  const applied: string[] = [];

  for (const [field, value] of Object.entries(prefill)) {
    if (value === '' || value == null) continue;
    if (current[field] != null && current[field].trim() !== '') continue;
    next[field] = value;
    applied.push(field);
  }

  return { next, applied };
}

/**
 * Resolve the prefill for the user's MOST RECENT closed trade across both
 * sources — journal entries and broker trade history — regardless of symbol.
 * Used for one-tap flows (e.g. the streak-rebuild banner) where the intent
 * is "journal my next trade like my last one", not "journal this symbol".
 *
 * Journal entries carry the richest data (planned stop/target), so a journal
 * entry wins whenever its date is at least as recent as the last broker
 * round trip. The symbol is ALWAYS prefilled here (unlike per-symbol
 * prefill, where it comes from what the user typed).
 *
 * Returns null when neither source has anything to prefill from.
 */
export function buildPrefillForSymbol(
  entries: JournalEntry[],
  trades: Trade[],
): { data: PrefillData; source: PrefillSource } | null {
  // Most recent journal entry (any symbol)
  const lastEntry = [...entries]
    .filter(e => isFinite(new Date(e.date).getTime()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  // Most recent broker round trip (any symbol): last sell + its opening buy
  const lastSell = [...trades]
    .filter(tr => tr.type === 'sell' && isFinite(new Date(tr.timestamp).getTime()))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  const fromTrades = lastSell
    ? buildPrefillFromTrades(trades, lastSell.symbol)
    : null;

  if (lastEntry && (!fromTrades || new Date(lastEntry.date).getTime() >= new Date(lastSell!.timestamp).getTime())) {
    const data = buildPrefillFromJournal(entries, lastEntry.symbol);
    if (data) return { data, source: 'journal' };
  }

  if (fromTrades) return { data: fromTrades, source: 'trades' };

  // Degenerate: an entry exists but produced no prefill (shouldn't happen —
  // buildPrefillFromJournal fills symbol/quantity even from sparse entries).
  return null;
}
