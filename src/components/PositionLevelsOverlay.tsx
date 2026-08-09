/**
 * ============================================================================
 * Toroloom — PositionLevelsOverlay
 * ============================================================================
 *
 * The hybrid-data "price lines" layer for the TradingView chart (Path A).
 *
 * Because the embedded TradingView widget cannot draw programmatic price
 * lines (cross-origin iframe), this overlay renders the same information as a
 * translucent strip pinned to the bottom of the chart:
 *
 *   • LIVE POSITION tag      — an open SnapTrade position exists (qty, P&L)
 *   • AVG BUY chip           — average buy price from the SnapTrade position
 *   • STOP / TARGET chips    — suggested exits derived from Iron Lock / risk
 *                              limits (tap to pre-fill the order form)
 *   • IRON LOCK chip         — lockdown is active on the backend
 *   • View-only strip        — broker not connected (read-only market view)
 *
 * Data comes from GET /api/snaptrade/ticker/:symbol (backend, auth-gated).
 * No broker credential ever reaches the chart or this component.
 * ============================================================================
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useT } from '../hooks/useT';
import { SPACING, FONTS, BORDER_RADIUS } from '../constants/theme';
import { snapTradeApi } from '../services/api';
import { useTicker } from '../services/tickerProvider';

// ──── Types ────────────────────────────────────────────────────────────────

export interface TickerLevelsData {
  success: boolean;
  connected: boolean;
  symbol: string;
  position: {
    symbol: string;
    quantity: number;
    avgCost: number;
    price: number;
    pnl: number;
    pnlPercent: number;
  } | null;
  levels: {
    dailyLossLimit: number;
    dailyLossPercentLimit: number;
    maxPositionSizePercent: number;
  } | null;
  ironLockActive: boolean;
  lockdownStatus: string;
}

interface PositionLevelsOverlayProps {
  /**
   * Symbol (e.g. AAPL or RELIANCE). Optional — when omitted, the overlay
   * follows the Ticker Provider's ACTIVE symbol (`useTicker`), so the tag
   * stays in sync with whichever instrument the user selected elsewhere
   * (watchlist, stock detail, order panel). Refetches when it changes.
   */
  symbol?: string;
  /**
   * Direct position data (e.g. from the Indian portfolio store). When
   * provided, the overlay renders this position WITHOUT calling the SnapTrade
   * backend — used by flows that don't go through SnapTrade (PlaceOrder).
   */
  position?: {
    symbol: string;
    quantity: number;
    avgCost: number;
    price: number;
    pnl: number;
    pnlPercent: number;
  } | null;
  /** Display currency for prices. Defaults to USD (SnapTrade flow). */
  currency?: 'USD' | 'INR';
  /**
   * Render in normal document flow (inside a card / holdings row) instead of
   * absolutely positioned over a chart. Used by the Indian portfolio rows.
   */
  inline?: boolean;
  /** Pre-fill the order form's stop-loss field with this price. */
  onApplyStop?: (price: number) => void;
  /** Pre-fill the order form's limit/target field with this price. */
  onApplyTarget?: (price: number) => void;
}

const DEFAULT_RISK_STOP_PCT = 5; // suggested per-position stop when no rule
const MAX_STOP_PCT = 20;
const RISK_REWARD = 2; // target = stop% × 2

function fmtPrice(n: number, currency: 'USD' | 'INR'): string {
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const prefix = currency === 'INR' ? '₹' : '$';
  return `${prefix}${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Round to 2 decimal places so suggested exits pre-fill cleanly (no float noise). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ──── Component ────────────────────────────────────────────────────────────

export default function PositionLevelsOverlay({
  symbol,
  position: directPosition,
  currency = 'USD',
  inline = false,
  onApplyStop,
  onApplyTarget,
}: PositionLevelsOverlayProps) {
  const { colors } = useTheme();
  const { t } = useT();
  // Provider-driven: when no explicit symbol is given, follow the Ticker
  // Provider's active instrument so the tag tracks the user's selection
  // across screens (watchlist → detail → order panel).
  const providerTicker = useTicker();
  const effectiveSymbol = symbol || providerTicker?.symbol || '';

  const [levels, setLevels] = useState<TickerLevelsData | null>(null);
  const [loading, setLoading] = useState(false);
  const symbolRef = useRef(effectiveSymbol);
  symbolRef.current = effectiveSymbol;

  // Direct-position mode (Indian PlaceOrder flow): the caller supplies the
  // holding data, so we never hit the SnapTrade backend.
  const hasDirectPosition = directPosition !== undefined;

  useEffect(() => {
    // Caller-supplied position — nothing to fetch.
    if (hasDirectPosition) return;

    const sym = (effectiveSymbol || '').trim().toUpperCase();
    if (!sym) {
      setLevels(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const data = await snapTradeApi.getTickerLevels(sym);
        // Guard against a stale response (symbol changed while fetching).
        if (!cancelled && symbolRef.current.trim().toUpperCase() === sym) {
          setLevels(data);
        }
      } catch {
        if (!cancelled) setLevels(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveSymbol, hasDirectPosition]);

  const position = hasDirectPosition
    ? directPosition
    : levels?.position ?? null;

  // No instrument selected (no symbol prop and the provider is empty) —
  // nothing to tag, so render nothing rather than claim "no position".
  if (!effectiveSymbol) return null;

  // Suggested exits — from Iron Lock / risk limits (or sane defaults).
  const stopPct = Math.min(
    levels?.levels?.dailyLossPercentLimit || DEFAULT_RISK_STOP_PCT,
    MAX_STOP_PCT,
  );
  const suggestedStop = position?.avgCost
    ? round2(position.avgCost * (1 - stopPct / 100))
    : null;
  const suggestedTarget = position?.avgCost
    ? round2(position.avgCost * (1 + (stopPct * RISK_REWARD) / 100))
    : null;

  // ── View-only (broker disconnected) ──
  // Direct-position mode is always connected (the caller has the data).
  if (!hasDirectPosition && levels && !levels.connected) {
    return (
      <View style={[styles.strip, { backgroundColor: 'rgba(10,14,22,0.72)' }]}>
        <View style={[styles.dot, { backgroundColor: '#64748B' }]} />
        <Text style={[styles.stripText, { color: colors.textMuted }]}>
          {t('trading.positionViewOnly')}
        </Text>
      </View>
    );
  }

  // ── No position / still loading ──
  if (!position) {
    if (loading) return null;
    return (
      <View style={[styles.strip, { backgroundColor: 'rgba(10,14,22,0.72)' }]}>
        <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
        <Text style={[styles.stripText, { color: colors.textMuted }]}>
          {t('trading.positionNoPosition')}
        </Text>
      </View>
    );
  }

  const isUp = position.pnlPercent >= 0;

  return (
    <View
      style={inline ? styles.containerInline : styles.container}
      pointerEvents={inline ? 'auto' : 'box-none'}
    >
      {/* Live Position tag */}
      <View style={[styles.liveTag, { backgroundColor: '#00E676' }]}>
        <View style={styles.liveDot} />
        <Text style={styles.liveTagText}>{t('trading.positionLive')}</Text>
        <Text style={styles.liveTagQty}>{position.quantity}</Text>
      </View>

      {/* Iron Lock active (SnapTrade flow only — no lock in direct mode) */}
      {!hasDirectPosition && levels?.ironLockActive && (
        <View style={[styles.lockTag, { backgroundColor: '#FF5252' }]}>
          <Text style={styles.lockTagText}>{t('trading.positionIronLock')}</Text>
        </View>
      )}

      {/* Price-level chips */}
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, { borderColor: '#3B82F6' }]}
          onPress={() => onApplyStop?.(suggestedStop ?? 0)}
        >
          <Text style={[styles.chipLabel, { color: '#60A5FA' }]}>{t('trading.positionStop')}</Text>
          <Text style={[styles.chipPrice, { color: '#fff' }]}>
            {suggestedStop ? fmtPrice(suggestedStop, currency) : '—'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.chip, { borderColor: '#22C55E' }]}
          onPress={() => onApplyTarget?.(suggestedTarget ?? 0)}
        >
          <Text style={[styles.chipLabel, { color: '#4ADE80' }]}>{t('trading.positionTarget')}</Text>
          <Text style={[styles.chipPrice, { color: '#fff' }]}>
            {suggestedTarget ? fmtPrice(suggestedTarget, currency) : '—'}
          </Text>
        </Pressable>

        <View style={[styles.chip, { borderColor: colors.borderLight }]}>
          <Text style={[styles.chipLabel, { color: '#94A3B8' }]}>{t('trading.positionAvgBuy')}</Text>
          <Text style={[styles.chipPrice, { color: '#fff' }]}>{fmtPrice(position.avgCost, currency)}</Text>
        </View>

        <View
          style={[
            styles.chip,
            { borderColor: isUp ? '#22C55E' : '#FF5252' },
          ]}
        >
          <Text style={[styles.chipLabel, { color: isUp ? '#4ADE80' : '#FF8A80' }]}>
            {isUp ? '+' : ''}{position.pnlPercent.toFixed(2)}%
          </Text>
          <Text style={[styles.chipPrice, { color: '#fff' }]}>
            {isUp ? '+' : ''}{fmtPrice(position.pnl, currency)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ──── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  // Static-flow variant for embedding inside cards / holdings rows.
  // Same column layout as the chart overlay, but in normal document flow.
  containerInline: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  stripText: { ...FONTS.medium, fontSize: FONTS.size.xs },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#fff',
  },
  liveTagText: {
    ...FONTS.extraBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: '#052e16',
  },
  liveTagQty: {
    ...FONTS.bold,
    fontSize: 9,
    color: '#052e16',
  },
  lockTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  lockTagText: {
    ...FONTS.extraBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: '#fff',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    backgroundColor: 'rgba(10,14,22,0.78)',
  },
  chipLabel: { ...FONTS.bold, fontSize: 8, letterSpacing: 0.4 },
  chipPrice: { ...FONTS.mono, fontSize: 10, fontWeight: '700' },
});
