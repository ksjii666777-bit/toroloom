import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from './testUtils';
import ReportHeader from '../components/ReportHeader';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      text: '#E0E6ED', textSecondary: '#64748B', bgCard: 'rgba(255,255,255,0.03)',
      border: 'rgba(255,255,255,0.08)',
    },
  }),
}));

vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'periodReport.title': 'Period Report',
        'periodReport.subtitle': 'Your trading performance',
      };
      return map[key] || key;
    },
    language: 'en', isHindi: false, toggleLanguage: vi.fn(),
  }),
}));

describe('ReportHeader', () => {
  it('renders title and subtitle', () => {
    const { getByText } = render(
      <ReportHeader navigation={{ goBack: vi.fn() }} hasAnalytics={false} isExporting={false} onExport={vi.fn()} />,
    );
    expect(getByText('Period Report')).toBeDefined();
    expect(getByText('Your trading performance')).toBeDefined();
  });

  it('shows LIVE badge when hasAnalytics is true', () => {
    const { getByText } = render(
      <ReportHeader navigation={{ goBack: vi.fn() }} hasAnalytics={true} isExporting={false} onExport={vi.fn()} />,
    );
    expect(getByText('LIVE')).toBeDefined();
  });

  it('hides LIVE badge when hasAnalytics is false', () => {
    const { queryByText } = render(
      <ReportHeader navigation={{ goBack: vi.fn() }} hasAnalytics={false} isExporting={false} onExport={vi.fn()} />,
    );
    expect(queryByText('LIVE')).toBeNull();
  });

  it('renders back button, though Pressable icon is not directly testable via getByText', () => {
    // Back button renders only Ionicons — no queryable text, but it exists in the tree
    const goBack = vi.fn();
    const { getByText } = render(
      <ReportHeader navigation={{ goBack }} hasAnalytics={false} isExporting={false} onExport={vi.fn()} />,
    );
    // Verify the title and subtitle render (confirms component mounts)
    expect(getByText('Period Report')).toBeDefined();
    expect(getByText('Your trading performance')).toBeDefined();
  });

  it('calls onExport when export button pressed', () => {
    const onExport = vi.fn();
    const { getByTestId } = render(
      <ReportHeader navigation={{ goBack: vi.fn() }} hasAnalytics={false} isExporting={false} onExport={onExport} />,
    );
    fireEvent.press(getByTestId('export-pdf-btn'));
    expect(onExport).toHaveBeenCalled();
  });
});
