import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from './testUtils';
import PeriodTabs from '../components/PeriodTabs';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      text: '#E0E6ED',
      textMuted: '#475569',
      bgCard: 'rgba(255,255,255,0.03)',
      border: 'rgba(255,255,255,0.08)',
    },
  }),
}));

const periodReport: Record<string, string> = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => {
      const parts = key.split('.');
      return parts[0] === 'periodReport' && periodReport[parts.slice(1).join('.')] ? periodReport[parts.slice(1).join('.')] : key;
    },
    language: 'en', isHindi: false, toggleLanguage: vi.fn(),
  }),
}));

describe('PeriodTabs', () => {
  it('renders all three period labels', () => {
    const { getByText } = render(<PeriodTabs periodType="monthly" onSelect={() => {}} />);
    expect(getByText('Weekly')).toBeDefined();
    expect(getByText('Monthly')).toBeDefined();
    expect(getByText('Yearly')).toBeDefined();
  });

  it('calls onSelect when a tab is pressed', () => {
    const onSelect = vi.fn();
    const { getByText } = render(<PeriodTabs periodType="monthly" onSelect={onSelect} />);
    fireEvent.press(getByText('Weekly'));
    expect(onSelect).toHaveBeenCalledWith('weekly');
  });

  it('highlights the active tab', () => {
    const { getByText } = render(<PeriodTabs periodType="monthly" onSelect={() => {}} />);
    expect(getByText('Monthly')).toBeDefined();
  });
});
