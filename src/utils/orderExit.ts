/**
 * ============================================================================
 * Toroloom — Exit Order Helper
 * ============================================================================
 *
 * Shared wiring for the PositionLevelsOverlay STOP / TARGET chips across every
 * trade surface (StockDetailScreen, PortfolioScreen holdings rows, the
 * dashboard HoldingsWidget, and USStockDetailScreen's chart overlay).
 *
 * A single helper keeps the hybrid flow consistent:
 *   1. Pre-select the instrument in the Ticker Provider (symbol + exchange +
 *      name + price) so the order panel stays in sync with whatever the user
 *      tapped.
 *   2. Navigate to the exit order pre-filled with the risk-derived price:
 *        - Default route 'PlaceOrder' (Indian flow): tradeType 'sell' with
 *          STOP → `prefillTrigger` / TARGET → `prefillLimit` (avg × (1 − 5%)
 *          and avg × (1 + 10%) respectively).
 *        - Route 'SnapTradeOrder' (US flow): prefillStop / prefillLimit as
 *          raw numbers, matching the order panel's `as number` params.
 * ============================================================================
 */

import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../types';
import { tickerProvider } from '../services/tickerProvider';

export interface ExitInstrument {
  symbol: string;
  exchange: string;
  name: string;
  price: number;
  stockId: string;
}

export type ExitOrderKind = 'SL' | 'LIMIT';

/**
 * The navigation surface the exit helper needs — narrowed to `navigate` only,
 * typed against the root stack so route names + params are compile-checked.
 */
export type ExitOrderNavigation = Pick<NavigationProp<RootStackParamList>, 'navigate'>;

/** Destination screen for the exit order. */
export type ExitOrderRoute = 'PlaceOrder' | 'SnapTradeOrder';

export interface OpenExitOrderOptions {
  /**
   * Destination screen. Defaults to 'PlaceOrder' (Indian broker flow). Pass
   * 'SnapTradeOrder' for the US flow — the SnapTrade order panel derives the
   * order type from whichever prefill param is present and reads
   * `prefillStop` / `prefillLimit` as raw numbers.
   */
  route?: ExitOrderRoute;
}

/**
 * Open the exit flow for a holding with the given stop/target price.
 * `exitPrice` is the risk-derived level (avg × (1 − 5%) for STOP,
 * avg × (1 + 10%) for TARGET) — distinct from `instrument.price`, the
 * current market price used for the provider pre-select. No-ops when
 * `exitPrice` is not positive (e.g. no position to derive a level from).
 */
export function openExitOrder(
  navigation: ExitOrderNavigation,
  instrument: ExitInstrument,
  kind: ExitOrderKind,
  exitPrice: number,
  options?: OpenExitOrderOptions,
): void {
  if (!instrument || exitPrice <= 0) return;

  // Keep the hybrid flow consistent: pre-select this instrument so the order
  // panel (and any open chart) stays in sync with the tapped symbol.
  tickerProvider.selectSymbol({
    symbol: instrument.symbol,
    exchange: instrument.exchange,
    name: instrument.name,
    price: instrument.price,
  });

  if (options?.route === 'SnapTradeOrder') {
    // US flow — SnapTrade order panel (prefillStop/prefillLimit as numbers).
    navigation.navigate('SnapTradeOrder', {
      symbol: instrument.symbol,
      name: instrument.name,
      price: instrument.price,
      ...(kind === 'SL'
        ? { prefillStop: exitPrice }
        : { prefillLimit: exitPrice }),
    });
    return;
  }

  // Indian flow — PlaceOrder exit with tradeType 'sell' + order-type prefill.
  navigation.navigate('PlaceOrder', {
    stockId: instrument.stockId,
    symbol: instrument.symbol,
    tradeType: 'sell',
    prefillOrderType: kind,
    ...(kind === 'SL'
      ? { prefillTrigger: String(exitPrice) }
      : { prefillLimit: String(exitPrice) }),
  });
}
