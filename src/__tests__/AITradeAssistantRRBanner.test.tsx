/**
 * ============================================================================
 * Toroloom — AI Trade Assistant R:R Commitment Banner Tests
 * ============================================================================
 *
 * Verifies the R:R commitment banner on the AI Trade Assistant screen:
 *   - Shows "Your R:R Commitment: 1:3" with a Change link when a ratio
 *     was committed at broker connect
 *   - Shows the set-now prompt when no ratio is committed
 *   - The Min risk/reward row reflects the committed ratio (overrides the
 *     risk-profile default)
 *   - The Change / Set now link navigates to the broker connect screen
 *
 * Only stores + navigation are mocked; the screen renders for real.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

// ── Store mocks (per-test overridable) ─────────────────────────────────────
const marketState = {
  stocks: [{
    id: 'reliance', symbol: 'RELIANCE', name: 'Reliance Industries',
    sector: 'Energy', price: 2500, pe: 24.5, dividend: 0.4,
    low52: 2100, high52: 2900, isPositive: true,
  }],
};

vi.mock('../store/marketStore', () => ({
  useMarketStore: vi.fn(() => marketState),
}));

vi.mock('../store/portfolioStore', () => ({
  usePortfolioStore: vi.fn(() => ({ holdings: [] })),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({ user: { balance: 500000 } })),
}));

// The real tradingPrefsStore — its state is reset per test via setState
import { useTradingPrefsStore } from '../store/tradingPrefsStore';

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'ai.tradeAssistant': 'AI Trade Assistant',
        'ai.tradeAssistantSub': 'Plan your trades',
        'ai.stock': 'Stock',
        'ai.tradeParams': 'Trade Parameters',
        'ai.buy': 'BUY',
        'ai.sell': 'SELL',
        'ai.quantity': 'Quantity',
        'ai.entryPrice': 'Entry Price',
        'ai.positionCost': 'Position Cost',
        'ai.riskProfile': 'Risk Profile',
        'ai.conservative': 'Conservative',
        'ai.moderate': 'Moderate',
        'ai.aggressive': 'Aggressive',
        'ai.maxRiskPerTrade': 'Max risk per trade',
        'ai.pctOfPortfolio': '{{pct}}% of portfolio',
        'ai.maxPositionSize': 'Max position size',
        'ai.minRiskReward': 'Min risk/reward',
        'ai.maxPositions': 'Max positions',
        'ai.analyzeTrade': 'Analyze Trade',
        'ai.rrCommitmentTitle': 'Your R:R Commitment',
        'ai.rrCommitmentUsed': 'Targets & stops are planned around this ratio',
        'ai.rrCommitmentSetTitle': 'No R:R commitment yet',
        'ai.rrCommitmentNone': 'Profile default is being used — commit to a ratio for disciplined planning',
        'ai.rrCommitmentChange': 'Change',
        'ai.rrCommitmentSet': 'Set now',
      };
      let text = map[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
      }
      return text;
    },
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6', text: '#FFFFFF', textSecondary: '#9CA3AF', textMuted: '#6B7280',
      bgCard: '#111827', bg: '#0B0F19', bgInput: '#0F131E', border: '#1F2937',
      divider: '#1E293B', marketUp: '#00E676', marketDown: '#FF5252', warning: '#FFAB40',
      danger: '#FF5252',
    },
  }),
}));

import { render, fireEvent } from './testUtils';
import AITradeAssistantScreen from '../screens/ai/AITradeAssistantScreen';

// Screen props satisfy NativeStackScreenProps (route is required)
const screenProps = {
  navigation: { navigate: mockNavigate, goBack: vi.fn() },
  route: { params: {} },
} as any;

// ──── Tests ────────────────────────────────────────────────────────────────

describe('AITradeAssistantScreen — R:R commitment banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTradingPrefsStore.setState({ rewardRiskRatio: null, initialized: true });
  });

  it('shows the committed ratio and a Change link when one is set', () => {
    useTradingPrefsStore.setState({ rewardRiskRatio: 3 });

    const { getByText, getByTestId } = render(
      <AITradeAssistantScreen {...screenProps} />,
    );

    expect(getByTestId('rr-commit-banner')).toBeDefined();
    expect(getByText('Your R:R Commitment: 1:3')).toBeDefined();
    expect(getByText('Targets & stops are planned around this ratio')).toBeDefined();
    expect(getByText('Change')).toBeDefined();
  });

  it('shows 1:2 in the banner when that ratio is committed', () => {
    useTradingPrefsStore.setState({ rewardRiskRatio: 2 });

    const { getByText, getByTestId } = render(
      <AITradeAssistantScreen {...screenProps} />,
    );

    expect(getByTestId('rr-commit-banner')).toBeDefined();
    expect(getByText('Your R:R Commitment: 1:2')).toBeDefined();
    expect(getByText('Targets & stops are planned around this ratio')).toBeDefined();
    expect(getByText('Change')).toBeDefined();
  });

  it('shows the set-now prompt when no ratio is committed', () => {
    const { getByText, getByTestId } = render(
      <AITradeAssistantScreen {...screenProps} />,
    );

    expect(getByTestId('rr-commit-banner')).toBeDefined();
    expect(getByText('No R:R commitment yet')).toBeDefined();
    expect(getByText('Profile default is being used — commit to a ratio for disciplined planning')).toBeDefined();
    expect(getByText('Set now')).toBeDefined();
  });

  it('the committed ratio overrides the risk-profile default in Min risk/reward', () => {
    useTradingPrefsStore.setState({ rewardRiskRatio: 5 });

    const { getAllByText } = render(
      <AITradeAssistantScreen {...screenProps} />,
    );

    // Moderate profile default is 2:1 — the 1:5 commitment must win
    expect(getAllByText('5:1').length).toBeGreaterThanOrEqual(1);
  });

  it('uses the profile default ratio when nothing is committed', () => {
    const { getAllByText } = render(
      <AITradeAssistantScreen {...screenProps} />,
    );

    // Moderate profile default = 2:1
    expect(getAllByText('2:1').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates to BrokerConnect when the Change link is pressed', () => {
    useTradingPrefsStore.setState({ rewardRiskRatio: 3 });

    const { getByTestId } = render(
      <AITradeAssistantScreen {...screenProps} />,
    );

    act(() => {
      fireEvent.press(getByTestId('rr-commit-link'));
    });

    expect(mockNavigate).toHaveBeenCalledWith('BrokerConnect');
  });

  it('navigates to BrokerConnect when the Set now link is pressed', () => {
    const { getByTestId } = render(
      <AITradeAssistantScreen {...screenProps} />,
    );

    act(() => {
      fireEvent.press(getByTestId('rr-commit-link'));
    });

    expect(mockNavigate).toHaveBeenCalledWith('BrokerConnect');
  });
});
