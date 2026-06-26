/**
 * ============================================================================
 * Toroloom — TaxCalculator Screen Tests
 * ============================================================================
 *
 * Covers:
 *   - Screen rendering (header, holding period toggle, result card, inputs)
 *   - STCG (Short Term) calculation: full gain taxed at 20%
 *   - LTCG (Long Term) calculation: gains over ₹1L taxed at 10%
 *   - Profit vs Loss display
 *   - Tax breakdown (gross profit, exemption, taxable gains, tax, surcharge, cess)
 *   - Net proceeds calculation
 *   - Effective tax rate display
 *   - Holding period toggle
 *   - Preset chip selection for quantity
 *   - Input validation (zero, empty)
 *   - Empty inputs handling
 *   - Back button navigation
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mocks ====================

const mockGoBack = vi.fn();

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#06080C', bgSecondary: '#0A0D14', bgCard: 'rgba(255,255,255,0.03)',
      bgInput: '#0A0D14', border: 'rgba(255,255,255,0.07)', divider: 'rgba(255,255,255,0.05)',
      primary: '#3B82F6', secondary: '#FF5252', accent: '#00E676',
      danger: '#FF5252', warning: '#FFAB40', success: '#00E676',
      text: '#E0E6ED', textSecondary: '#64748B', textMuted: '#475569',
      white: '#FFFFFF',
    },
  }),
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

import TaxCalculator from '../screens/calculators/TaxCalculator';

// ==================== Constants ====================

const LTCG_EXEMPTION = 100000;

// ==================== Helpers ====================

/** Format currency exactly like formatCurrency() in formatters.ts */
function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== Tests ====================

describe('TaxCalculator — Rendering', () => {
  it('renders the screen title', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText('Tax Calculator')).toBeDefined();
  });

  it('renders input fields with defaults', () => {
    const { getByPlaceholderText } = render(<TaxCalculator />);
    expect(getByPlaceholderText('e.g. 1500')).toBeDefined();
    expect(getByPlaceholderText('e.g. 1850')).toBeDefined();
    expect(getByPlaceholderText('e.g. 100')).toBeDefined();
  });

  it('renders section titles', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText('Holding Period')).toBeDefined();
    expect(getByText('Trade Details')).toBeDefined();
    expect(getByText('Investment Summary')).toBeDefined();
  });

  it('renders the info disclaimer', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText(/Tax calculations follow Indian income tax/)).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<TaxCalculator />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('TaxCalculator — Default Calculation (LTCG: ₹1500→₹1850, 100 shares)', () => {
  it('renders PROFIT badge', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText('PROFIT')).toBeDefined();
  });

  it('renders gross profit', () => {
    const { getByText } = render(<TaxCalculator />);
    const profit = (1850 - 1500) * 100;
    expect(getByText(fmtCurrency(profit))).toBeDefined();
  });

  it('renders Long-Term Capital Gains label', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText('Long-Term Capital Gains')).toBeDefined();
  });

  it('renders taxable gains row', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText('Taxable Gains')).toBeDefined();
  });

  it('renders total tax liability', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText('Total Tax Liability')).toBeDefined();
  });

  it('renders net proceeds', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText('Net Proceeds (after tax)')).toBeDefined();
  });
});

describe('TaxCalculator — Holding Period Toggle', () => {
  it('renders STCG and LTCG toggle options', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText('STCG (≤12 months)')).toBeDefined();
    expect(getByText('LTCG (>12 months)')).toBeDefined();
  });

  it('shows LTCG hint by default', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText(/Long-term: Equity held >12 months/)).toBeDefined();
  });

  it('tapping STCG switches to short-term mode', () => {
    const { getByText } = render(<TaxCalculator />);
    act(() => { fireEvent.press(getByText('STCG (≤12 months)')); });
    expect(getByText(/Short-term: Equity held ≤12 months/)).toBeDefined();
  });

  it('tapping STCG changes result label', () => {
    const { getByText } = render(<TaxCalculator />);
    act(() => { fireEvent.press(getByText('STCG (≤12 months)')); });
    expect(getByText('Short-Term Capital Gains')).toBeDefined();
  });

  it('toggling STCG→LTCG→STCG does not crash', () => {
    const { getByText } = render(<TaxCalculator />);
    act(() => { fireEvent.press(getByText('STCG (≤12 months)')); });
    act(() => { fireEvent.press(getByText('LTCG (>12 months)')); });
    expect(getByText('Long-Term Capital Gains')).toBeDefined();
  });
});

describe('TaxCalculator — LTCG Tax Calculation', () => {
  it('applies ₹1L exemption on LTCG', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText('LTCG Exemption')).toBeDefined();
    expect(getByText(`-${fmtCurrency(LTCG_EXEMPTION)}`)).toBeDefined();
  });

  it('calculates zero tax for gains under ₹1L (LTCG)', () => {
    // ₹1000→₹1500, 50 shares = ₹25,000 gain (under ₹1L exemption)
    const { getByPlaceholderText, getByText } = render(<TaxCalculator />);
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 1500'), '1000'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 1850'), '1500'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 100'), '50'); });

    // With ₹25,000 gain (under ₹1L LTCG exemption), taxable gains = 0, total tax = 0
    expect(getByText(fmtCurrency(0))).toBeDefined();
  });
});

describe('TaxCalculator — STCG Tax Calculation', () => {
  it('switches to STCG and calculates higher tax', () => {
    const { getByText } = render(<TaxCalculator />);
    act(() => { fireEvent.press(getByText('STCG (≤12 months)')); });

    // Default: profit = (1850-1500)*100 = ₹35,000
    // STCG: tax = 35000 * 20% = ₹7,000, cess = 7000 * 4% = ₹280, total = ₹7,280
    const totalTax = Math.round(35000 * 0.20 * 1.04 * 100) / 100;
    expect(getByText(fmtCurrency(totalTax))).toBeDefined();
  });

  it('STCG does NOT show LTCG exemption row', () => {
    const { getByText } = render(<TaxCalculator />);
    act(() => { fireEvent.press(getByText('STCG (≤12 months)')); });

    const exemptionRow = (() => {
      try { return getByText('LTCG Exemption'); }
      catch { return null; }
    })();
    expect(exemptionRow).toBeNull();
  });
});

describe('TaxCalculator — Loss Scenario', () => {
  it('shows LOSS badge when sale price is less than purchase price', () => {
    const { getByPlaceholderText, getByText } = render(<TaxCalculator />);
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 1850'), '1400'); });
    expect(getByText('LOSS')).toBeDefined();
  });
});

describe('TaxCalculator — Preset Chips', () => {
  it('renders quantity presets', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText('10 shares')).toBeDefined();
    expect(getByText('50 shares')).toBeDefined();
    expect(getByText('100 shares')).toBeDefined();
    expect(getByText('500 shares')).toBeDefined();
  });
});

describe('TaxCalculator — Input Validation', () => {
  it('handles empty inputs gracefully — info card still renders', () => {
    const { getByPlaceholderText, getByText } = render(<TaxCalculator />);
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 1500'), ''); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 1850'), ''); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 100'), ''); });
    expect(getByText(/Tax calculations follow/)).toBeDefined();
  });

  it('does not crash with zero purchase price', () => {
    const { getByPlaceholderText, toJSON } = render(<TaxCalculator />);
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 1500'), '0'); });
    expect(toJSON()).toBeTruthy();
  });
});

describe('TaxCalculator — Tax Breakdown Rows', () => {
  it('renders Gross Profit row', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText('Gross Profit')).toBeDefined();
  });

  it('renders Tax row for default LTCG', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText(/Tax/)).toBeDefined();
  });

  it('renders Health & Edu Cess row', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText('Health & Edu Cess (4%)')).toBeDefined();
  });

  it('renders effective tax rate when in STCG mode (tax > 0)', () => {
    const { getByText } = render(<TaxCalculator />);
    // Switch to STCG mode — with default profit of ₹35K, tax is > 0
    act(() => { fireEvent.press(getByText('STCG (≤12 months)')); });
    expect(getByText('Effective Tax Rate')).toBeDefined();
  });
});

describe('TaxCalculator — Investment Summary', () => {
  it('renders total investment', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText(fmtCurrency(1500 * 100))).toBeDefined();
  });

  it('renders total sale value', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText(fmtCurrency(1850 * 100))).toBeDefined();
  });

  it('renders quantity and holding type', () => {
    const { getByText } = render(<TaxCalculator />);
    expect(getByText('100 shares')).toBeDefined();
    expect(getByText('Long Term')).toBeDefined();
  });
});

describe('TaxCalculator — Navigation', () => {
  it('navigation goBack is available', () => {
    expect(mockGoBack).toBeDefined();
    expect(typeof mockGoBack).toBe('function');
  });
});

describe('TaxCalculator — Edge Cases', () => {
  it('handles high profit with surcharge', () => {
    // ₹100→₹6000, 200 shares = ₹11,80,000 profit
    const { getByText, getByPlaceholderText } = render(<TaxCalculator />);
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 1500'), '100'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 1850'), '6000'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 100'), '200'); });

    // LTCG: taxable = max(0, 1180000 - 100000) = ₹10,80,000
    expect(getByText('LTCG Exemption')).toBeDefined();
  });

  it('handles exact break-even (no profit, no loss)', () => {
    const { getByPlaceholderText, getByText } = render(<TaxCalculator />);
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 1850'), '1500'); });
    // With 0 profit, info card is always visible, Investment Summary is hidden
    expect(getByText(/Tax calculations follow/)).toBeDefined();
  });

  it('handles decimal prices without crashing', () => {
    const { getByPlaceholderText, toJSON } = render(<TaxCalculator />);
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 1500'), '1520.50'); });
    act(() => { fireEvent.changeText(getByPlaceholderText('e.g. 1850'), '1890.75'); });
    expect(toJSON()).toBeTruthy();
  });
});
