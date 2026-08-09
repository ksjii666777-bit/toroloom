/**
 * ============================================================================
 * Toroloom — orderExit Helper Tests
 * ============================================================================
 *
 * Verifies the shared STOP / TARGET chip wiring used by StockDetailScreen,
 * PortfolioScreen holdings rows, and the dashboard HoldingsWidget:
 *   1. Pre-selects the instrument in the Ticker Provider (NSE, name, price).
 *   2. Navigates to PlaceOrder with tradeType 'sell' + the right prefill
 *      (SL → prefillTrigger, LIMIT → prefillLimit).
 *   3. No-ops when price is not positive or the instrument is missing.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelectSymbol } = vi.hoisted(() => ({
  mockSelectSymbol: vi.fn(),
}));

vi.mock('../services/tickerProvider', () => ({
  tickerProvider: {
    selectSymbol: (...args: unknown[]) => mockSelectSymbol(...args),
  },
}));

import { openExitOrder } from '../utils/orderExit';

const mockNavigate = vi.fn();

const instrument = {
  symbol: 'RELIANCE',
  exchange: 'NSE',
  name: 'Reliance Industries Ltd.',
  price: 2650,
  stockId: 'RELIANCE',
};

describe('openExitOrder', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockSelectSymbol.mockClear();
  });

  it('pre-selects the instrument in the ticker provider', () => {
    openExitOrder({ navigate: mockNavigate }, instrument, 'SL', 2517.5);

    expect(mockSelectSymbol).toHaveBeenCalledWith({
      symbol: 'RELIANCE',
      exchange: 'NSE',
      name: 'Reliance Industries Ltd.',
      price: 2650,
    });
  });

  it('navigates to PlaceOrder with SL prefill for a stop exit', () => {
    openExitOrder({ navigate: mockNavigate }, instrument, 'SL', 2517.5);

    expect(mockNavigate).toHaveBeenCalledWith('PlaceOrder', {
      stockId: 'RELIANCE',
      symbol: 'RELIANCE',
      tradeType: 'sell',
      prefillOrderType: 'SL',
      prefillTrigger: '2517.5',
    });
  });

  it('navigates to PlaceOrder with LIMIT prefill for a target exit', () => {
    openExitOrder({ navigate: mockNavigate }, instrument, 'LIMIT', 2915);

    expect(mockNavigate).toHaveBeenCalledWith('PlaceOrder', {
      stockId: 'RELIANCE',
      symbol: 'RELIANCE',
      tradeType: 'sell',
      prefillOrderType: 'LIMIT',
      prefillLimit: '2915',
    });
  });

  it('navigates to SnapTradeOrder with numeric prefillStop when the route is set', () => {
    openExitOrder({ navigate: mockNavigate }, instrument, 'SL', 2517.5, { route: 'SnapTradeOrder' });

    // SnapTradeOrderScreen reads these params as numbers (route.params?.prefillStop as number).
    expect(mockNavigate).toHaveBeenCalledWith('SnapTradeOrder', {
      symbol: 'RELIANCE',
      name: 'Reliance Industries Ltd.',
      price: 2650,
      prefillStop: 2517.5,
    });
  });

  it('navigates to SnapTradeOrder with numeric prefillLimit for a target exit', () => {
    openExitOrder({ navigate: mockNavigate }, instrument, 'LIMIT', 2915, { route: 'SnapTradeOrder' });

    expect(mockNavigate).toHaveBeenCalledWith('SnapTradeOrder', {
      symbol: 'RELIANCE',
      name: 'Reliance Industries Ltd.',
      price: 2650,
      prefillLimit: 2915,
    });
  });

  it('pre-selects the provider before the SnapTradeOrder navigation too', () => {
    openExitOrder({ navigate: mockNavigate }, instrument, 'LIMIT', 2915, { route: 'SnapTradeOrder' });

    expect(mockSelectSymbol).toHaveBeenCalledWith({
      symbol: 'RELIANCE',
      exchange: 'NSE',
      name: 'Reliance Industries Ltd.',
      price: 2650,
    });
  });

  it('does nothing when the price is not positive', () => {
    openExitOrder({ navigate: mockNavigate }, instrument, 'SL', 0);
    openExitOrder({ navigate: mockNavigate }, instrument, 'LIMIT', -5);

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSelectSymbol).not.toHaveBeenCalled();
  });

  it('does nothing when the instrument is missing', () => {
    openExitOrder({ navigate: mockNavigate }, null as any, 'SL', 100);

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSelectSymbol).not.toHaveBeenCalled();
  });
});
