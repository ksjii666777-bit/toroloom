import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from './testUtils';
import EmptyReportState from '../components/EmptyReportState';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { textSecondary: '#64748B', textMuted: '#475569' },
  }),
}));

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'periodReport.emptyTitle': 'No trades yet',
        'periodReport.emptySubtitle': 'Start trading to see your performance report.',
      };
      return map[key] || key;
    },
    language: 'en', isHindi: false, toggleLanguage: vi.fn(),
  }),
}));

describe('EmptyReportState', () => {
  it('renders empty title', () => {
    const { getByText } = render(<EmptyReportState />);
    expect(getByText('No trades yet')).toBeDefined();
  });

  it('renders empty subtitle', () => {
    const { getByText } = render(<EmptyReportState />);
    expect(getByText('Start trading to see your performance report.')).toBeDefined();
  });
});
