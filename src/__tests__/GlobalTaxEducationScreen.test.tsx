/**
 * ============================================================================
 * Toroloom — GlobalTaxEducationScreen Tests
 * ============================================================================
 *
 * Verifies the global tax & charges education screen renders:
 *   - the six-section picker when no route param is given
 *   - LRS, TCS, capital gains, dividend, charges and Schedule FA sections
 *     (headings + bodies) when navigated with a section param
 *   - the back button returns to the picker before leaving the screen
 *
 * i18n, theme and navigation are mocked; the screen component is real.
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', bgCard: '#1A1A2E', border: '#2A2A44',
    },
  }),
}));

const mockSetParams = vi.fn();
const mockGoBack = vi.fn();

vi.mock('../../src/hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => {
      // Flat key → string lookup mirroring the real en bundle for taxEducation.* keys.
      const strings: Record<string, string> = {
        'taxEducation.title': 'Global Investing — Taxes & Charges',
        'taxEducation.subtitle': 'What it really costs to own US & global stocks from India',
        'taxEducation.updated': 'Rates as of September 2026 — verify with a CA before filing',
        'taxEducation.disclaimer': 'This is educational information, not tax advice.',
        'taxEducation.navLrs': 'LRS — Sending Money Abroad',
        'taxEducation.navTcs': 'TCS — The 20% That Comes Back',
        'taxEducation.navGains': 'Capital Gains Tax',
        'taxEducation.navDividend': 'Dividend Tax',
        'taxEducation.navCharges': 'Broker & Forex Charges',
        'taxEducation.navFa': 'Schedule FA — Mandatory Reporting',
        'taxEducation.lrsWhat': 'What is LRS?',
        'taxEducation.lrsWhatBody': 'The RBI window for sending money abroad.',
        'taxEducation.tcsWhat': 'What is TCS here?',
        'taxEducation.tcsWhatBody': 'Tax your bank collects before remitting above the threshold.',
        'taxEducation.cgHolding': 'Holding period decides the rate',
        'taxEducation.cgHoldingBody': '24 months or less is short-term for foreign shares.',
        'taxEducation.divWht': 'US withholding tax',
        'taxEducation.divWhtBody': 'The US withholds tax on dividends; 25% with a W-8BEN.',
        'taxEducation.chBroker': 'Brokerage & platform fees',
        'taxEducation.chBrokerBody': 'Flat per-order or percentage fees, compare on order size.',
        'taxEducation.faWhat': 'What is Schedule FA?',
        'taxEducation.faWhatBody': 'The ITR section where residents disclose foreign assets.',
        'taxEducation.notAdvice': 'Not investment or tax advice',
        'taxEducation.notAdviceBody': 'Toroloom does not execute trades or provide tax advice.',
        'taxEducation.contactIntro': 'Found an error? Write to us:',
        'taxEducation.contactEmail': 'support@toroloom.com',
        'app.goBack': 'Go back',
      };
      return strings[key] ?? key;
    },
  }),
}));

import GlobalTaxEducationScreen from '../screens/education/GlobalTaxEducationScreen';

const mkNav = () => ({ navigate: vi.fn(), goBack: mockGoBack, setParams: mockSetParams });

const renderScreen = (params?: { section?: string }) =>
  render(
    <GlobalTaxEducationScreen
      navigation={mkNav() as never}
      route={{ params } as never}
    />
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GlobalTaxEducationScreen — tax & charges education', () => {
  it('renders the six-section picker by default', () => {
    const utils = renderScreen();

    expect(utils.getByText('LRS — Sending Money Abroad')).toBeTruthy();
    expect(utils.getByText('TCS — The 20% That Comes Back')).toBeTruthy();
    expect(utils.getByText('Capital Gains Tax')).toBeTruthy();
    expect(utils.getByText('Dividend Tax')).toBeTruthy();
    expect(utils.getByText('Broker & Forex Charges')).toBeTruthy();
    expect(utils.getByText('Schedule FA — Mandatory Reporting')).toBeTruthy();
  });

  it('always shows the not-tax-advice disclaimer and contact footer', () => {
    const utils = renderScreen();

    expect(utils.getByText('This is educational information, not tax advice.')).toBeTruthy();
    expect(utils.getByText('Not investment or tax advice')).toBeTruthy();
    expect(utils.getByText('support@toroloom.com')).toBeTruthy();
  });

  it('renders the LRS section with heading and body', () => {
    const utils = renderScreen({ section: 'lrs' });

    expect(utils.getByText('What is LRS?')).toBeTruthy();
    expect(utils.getByText('The RBI window for sending money abroad.')).toBeTruthy();
  });

  it('renders the TCS, gains, dividend, charges and FA sections', () => {
    let utils = renderScreen({ section: 'tcs' });
    expect(utils.getByText('Tax your bank collects before remitting above the threshold.')).toBeTruthy();

    utils = renderScreen({ section: 'gains' });
    expect(utils.getByText('24 months or less is short-term for foreign shares.')).toBeTruthy();

    utils = renderScreen({ section: 'dividend' });
    expect(utils.getByText('The US withholds tax on dividends; 25% with a W-8BEN.')).toBeTruthy();

    utils = renderScreen({ section: 'charges' });
    expect(utils.getByText('Flat per-order or percentage fees, compare on order size.')).toBeTruthy();

    utils = renderScreen({ section: 'fa' });
    expect(utils.getByText('The ITR section where residents disclose foreign assets.')).toBeTruthy();
  });

  it('back button returns to the picker (setParams) before leaving the screen', () => {
    const utils = renderScreen({ section: 'lrs' });

    const backBtn = utils.root.find(
      (inst) => inst.props?.accessibilityLabel === 'Go back'
    );
    fireEvent.press(backBtn);

    expect(mockSetParams).toHaveBeenCalledWith({ section: undefined });
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
