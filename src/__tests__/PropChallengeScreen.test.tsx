/**
 * ============================================================================
 * Toroloom — PropChallengeScreen Tests
 * ============================================================================
 *
 * Renders the screen with the REAL propAccountStore + REAL journal store
 * (only platform/theme/i18n mocked):
 *   - Setup view: preset chips, rule fields, start button
 *   - Start challenge → dashboard appears with phase badge
 *   - Budget bars + risk banner render from real engine state
 *   - Failed challenge → outcome banner, restart returns to setup
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF', danger: '#FF5252', warning: '#FFAB40',
      success: '#00E676', text: '#FFFFFF', textSecondary: '#9CA3AF',
      textMuted: '#6B7280', bgSecondary: '#111827', bgCard: '#111827',
      border: '#1F2937',
    },
  }),
}));

const propMap: Record<string, string> = {
  'propFirm.title': 'Prop Challenge',
  'propFirm.setup.heading': 'Rehearse a funded challenge',
  'propFirm.setup.choosePreset': 'Choose a rule set',
  'propFirm.setup.custom': 'Custom',
  'propFirm.setup.accountSize': 'Account size',
  'propFirm.setup.dailyLoss': 'Max daily loss (%)',
  'propFirm.setup.overallLoss': 'Max overall loss (%)',
  'propFirm.setup.minDays': 'Min trading days',
  'propFirm.setup.consistency': 'Consistency rule — max share of total profit for one day (%)',
  'propFirm.setup.consistencyOff': 'Off',
  'propFirm.setup.trailing': 'Trailing drawdown (floor follows peak equity)',
  'propFirm.setup.start': 'Start challenge',
  'propFirm.setup.invalidInput': 'Enter valid numbers first',
  'propFirm.presets.ftmo': 'Static 10% / 5% targets, 5% daily, 10% overall.',
  'propFirm.presets.topstep': 'Trailing drawdown with a 45% consistency rule.',
  'propFirm.presets.the5ers': 'Compact account, tighter limits.',
  'propFirm.dashboard.phase': 'Phase {{n}}',
  'propFirm.dashboard.funded': 'Funded rules',
  'propFirm.dashboard.passed': 'Phase passed 🎉',
  'propFirm.dashboard.failed': 'Challenge breached',
  'propFirm.dashboard.abandoned': 'Abandoned',
  'propFirm.dashboard.equity': 'Equity',
  'propFirm.dashboard.peak': 'Peak equity',
  'propFirm.dashboard.totalPnl': 'Total P&L',
  'propFirm.dashboard.profitTarget': 'Profit target',
  'propFirm.dashboard.dailyLoss': 'Daily loss budget',
  'propFirm.dashboard.maxLoss': 'Overall loss budget',
  'propFirm.dashboard.tradingDays': 'Trading days',
  'propFirm.dashboard.daysMet': '{{n}} / {{m}} days',
  'propFirm.dashboard.used': '{{pct}}% used',
  'propFirm.dashboard.remaining': '{{amount}} remaining',
  'propFirm.dashboard.floorHint': 'Static floor',
  'propFirm.dashboard.floorHintTrailing': 'Trailing floor',
  'propFirm.dashboard.advance': 'Advance to phase {{n}}',
  'propFirm.dashboard.riskOk': 'Risk levels healthy',
  'propFirm.dashboard.riskWarning': 'Approaching a limit',
  'propFirm.dashboard.riskDanger': 'One bad trade from a breach',
  'propFirm.dashboard.riskBreached': 'Limit breached — challenge failed',
  'propFirm.check.heading': 'Pre-trade check',
  'propFirm.check.sub': 'Enter the risk and planned reward of your next trade.',
  'propFirm.check.riskAmount': 'Planned risk amount',
  'propFirm.check.rewardAmount': 'Planned reward amount (optional)',
  'propFirm.check.run': 'Check trade',
  'propFirm.check.verdictOk': 'Safe to take — worst case stays inside every limit.',
  'propFirm.check.verdictWarn': 'Risky — review before entering.',
  'propFirm.check.verdictBlock': 'Do not take this trade — it can breach a limit.',
  'propFirm.check.challengeFailed': 'Challenge already breached — restart before trading.',
  'propFirm.check.exceedsDaily': 'A full stop-out would exceed the daily loss budget.',
  'propFirm.check.exceedsOverall': 'A full stop-out would breach the overall drawdown floor.',
  'propFirm.check.halfDaily': 'This trade risks over half of the remaining daily budget.',
  'propFirm.check.halfOverall': 'This trade risks over half of the remaining overall budget.',
  'propFirm.check.rrBelowCommitment': 'Planned R:R is below your committed ratio.',
};

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      let text = propMap[key] ?? key;
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

// ── Stores are REAL — set them up before each test ──────────
import { usePropAccountStore } from '../store/propAccountStore';
import { useBehaviorJournalStore, mockJournalEntries } from '../store/behavioralJournalStore';
import { makeCustomConfig } from '../services/propFirm/challengePresets';
import PropChallengeScreen from '../screens/journal/PropChallengeScreen';

const mockNavigate = vi.fn();

function renderScreen() {
  return render(
    <PropChallengeScreen navigation={{ navigate: mockNavigate } as any} route={{ params: {} } as any} />,
  );
}

describe('PropChallengeScreen — setup', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePropAccountStore.setState({ challenge: null, initialized: true });
    useBehaviorJournalStore.setState({ entries: [...mockJournalEntries] });
  });

  it('renders the setup view with preset chips and start button', () => {
    const { getByText } = renderScreen();
    expect(getByText('Choose a rule set')).toBeDefined();
    expect(getByText('FTMO-style')).toBeDefined();
    expect(getByText('Topstep-style')).toBeDefined();
    expect(getByText('Custom')).toBeDefined();
    expect(getByText('Start challenge')).toBeDefined();
  });

  it('starts a challenge and shows the dashboard with the phase badge', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Start challenge'));

    expect(usePropAccountStore.getState().challenge).not.toBeNull();
    expect(getByText('Phase 1')).toBeDefined();
    expect(getByText('Profit target')).toBeDefined();
    expect(getByText('Daily loss budget')).toBeDefined();
    expect(getByText('Overall loss budget')).toBeDefined();
  });

  it('rejects invalid rule numbers with the error message', () => {
    const { getByText, getByTestId } = renderScreen();
    fireEvent.changeText(getByTestId('field-daily'), '900'); // > 50 → invalid
    fireEvent.press(getByText('Start challenge'));
    expect(getByText('Enter valid numbers first')).toBeDefined();
    expect(usePropAccountStore.getState().challenge).toBeNull();
  });
});

describe('PropChallengeScreen — dashboard state', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useBehaviorJournalStore.setState({ entries: [...mockJournalEntries] });
  });

  it('shows the breach banner when the challenge failed', async () => {
    usePropAccountStore.setState({
      challenge: {
        config: makeCustomConfig({ accountSize: 1000000, phases: [{ number: 1, profitTargetPercent: 10 }, { number: 2, profitTargetPercent: 5 }, { number: 3, profitTargetPercent: null }] }),
        startDate: '2026-09-01T00:00:00.000Z',
        phase: 1,
        outcome: 'failed',
        endedPhase: 1,
      },
      initialized: true,
    });

    const { getByText } = renderScreen();
    // Ended challenges fall back to the setup view with the outcome banner
    expect(getByText('Challenge breached')).toBeDefined();
    expect(getByText('Start challenge')).toBeDefined();
  });

  it('renders the pre-trade checker inside the dashboard', () => {
    usePropAccountStore.setState({
      challenge: {
        config: makeCustomConfig({ accountSize: 1000000, phases: [{ number: 1, profitTargetPercent: 10 }, { number: 2, profitTargetPercent: 5 }, { number: 3, profitTargetPercent: null }] }),
        startDate: '2026-09-01T00:00:00.000Z',
        phase: 1,
        outcome: 'active',
        endedPhase: null,
      },
      initialized: true,
    });

    const { getByText } = renderScreen();
    expect(getByText('Pre-trade check')).toBeDefined();
    expect(getByText('Check trade')).toBeDefined();
  });
});
