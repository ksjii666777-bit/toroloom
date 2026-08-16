/**
 * ============================================================================
 * Toroloom — AdvisorListScreen Unit Tests
 * ============================================================================
 *
 * Covers:
 *   - Renders title, search, compliance note, and advisor cards
 *   - Search filter narrows the list (client-side mock fallback)
 *   - Type chips (RA) filter the list
 *   - Tapping an advisor navigates to AdvisorDetail
 *   - Empty state when no advisors match
 *
 * The advisory API is mocked to reject, so the store falls back to the mock
 * dataset — same pattern as economicCalendarStore tests.
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ── Functional FlatList mock (setup.ts's dummy FlatList never calls renderItem) ──
vi.mock('react-native', async () => {
  const mod = await import('./react-native.mock');
  const React = require('react');

  function MockFlatList(props: any) {
    const { data, renderItem, ListEmptyComponent, keyExtractor, ...rest } = props;
    const children: any[] = [];
    if (data && Array.isArray(data) && data.length > 0) {
      data.forEach((item: any, index: number) => {
        const el = renderItem({ item, index });
        if (el) children.push(React.createElement('View', { key: keyExtractor?.(item) ?? index }, el));
      });
    } else if (ListEmptyComponent) {
      children.push(React.createElement('View', { key: 'empty' },
        typeof ListEmptyComponent === 'function' ? React.createElement(ListEmptyComponent) : ListEmptyComponent,
      ));
    }
    return React.createElement('View', rest, ...children);
  }

  return { ...mod, FlatList: MockFlatList };
});

// ── Theme mock ──────────────────────────────────────────────────────────
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: true,
    mode: 'dark',
    colors: {
      bg: '#0B0F19', text: '#FFFFFF', textSecondary: '#9CA3AF', textMuted: '#6B7280',
      primary: '#3B82F6', accent: '#10B981', marketUp: '#10B981',
      bgCard: '#111827', bgCardLight: '#1A2235', bgInput: '#0F131E',
      border: '#1F2937', divider: '#1E293B', bgSecondary: '#0E121D',
      warning: '#F59E0B', danger: '#EF4444', white: '#FFFFFF',
      borderLight: '#374151',
    },
    gradients: {},
    shadows: {},
    toggleTheme: vi.fn(),
  }),
}));

// ── i18n mock — advisory namespace keys used by the screen ──────────────
vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const map: Record<string, string> = {
        'advisory.title': 'Advisors',
        'advisory.searchPlaceholder': 'Search advisors, firms, specialties…',
        'advisory.all': 'All',
        'advisory.ria': 'Registered Investment Advisor',
        'advisory.ra': 'Research Analyst',
        'advisory.riaShort': 'RIA',
        'advisory.raShort': 'RA',
        'advisory.topRated': 'Top Rated',
        'advisory.complianceNote': 'All advisors are SEBI-registered. Investments are subject to market risks.',
        'advisory.reviewsCount': '{{count}} reviews',
        'advisory.years': 'yrs exp.',
        'advisory.book': 'Book',
        'advisory.perSession': '/ session',
        'advisory.noAdvisors': 'No advisors found',
        'advisory.noAdvisorsHint': 'Try adjusting your search or filters.',
      };
      let str = map[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        }
      }
      return str;
    },
  }),
}));

// ── Advisory API mock — reject by default so the store uses mock fallback ──
vi.mock('../services/api/advisory', () => ({
  advisoryApi: {
    listAdvisors: vi.fn().mockRejectedValue(new Error('offline')),
    getAdvisor: vi.fn().mockRejectedValue(new Error('offline')),
    getReviews: vi.fn().mockRejectedValue(new Error('offline')),
    getSlots: vi.fn().mockRejectedValue(new Error('offline')),
    submitReview: vi.fn().mockRejectedValue(new Error('offline')),
    bookConsultation: vi.fn().mockRejectedValue(new Error('offline')),
    myConsultations: vi.fn().mockRejectedValue(new Error('offline')),
    getConsultation: vi.fn().mockRejectedValue(new Error('offline')),
    confirmConsultation: vi.fn().mockRejectedValue(new Error('offline')),
    cancelConsultation: vi.fn().mockRejectedValue(new Error('offline')),
    completeConsultation: vi.fn().mockRejectedValue(new Error('offline')),
    listAllAdvisors: vi.fn().mockRejectedValue(new Error('offline')),
    setAdvisorStatus: vi.fn().mockRejectedValue(new Error('offline')),
    upsertAdvisor: vi.fn().mockRejectedValue(new Error('offline')),
  },
}));

import AdvisorListScreen from '../screens/advisory/AdvisorListScreen';
import { useAdvisoryStore } from '../store/advisoryStore';

const mockNavigate = vi.fn();
const mockNavigation = { navigate: mockNavigate };

function resetStore() {
  useAdvisoryStore.setState(useAdvisoryStore.getInitialState());
}

async function flushPromises() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe('AdvisorListScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('renders the title, search, compliance note and advisor cards', async () => {
    const { getByText, getByTestId, queryByText } = render(
      <AdvisorListScreen navigation={mockNavigation as any} route={{} as any} />,
    );
    await flushPromises();

    expect(getByText('Advisors')).toBeTruthy();
    expect(getByTestId('advisory-search')).toBeTruthy();
    expect(getByText(/SEBI-registered/)).toBeTruthy();

    // Approved mock advisors render (5 approved, 1 pending hidden)
    expect(getByText('Dr. Rajesh Khanna')).toBeTruthy();
    expect(getByText('Priya Sharma')).toBeTruthy();
    expect(getByText('Amit Verma')).toBeTruthy();
    // Pending advisor never appears in the public list
    expect(queryByText('Kavita Nair')).toBeNull();
  });

  it('filters the list by search query', async () => {
    const { getByTestId, getByText, queryByText } = render(
      <AdvisorListScreen navigation={mockNavigation as any} route={{} as any} />,
    );
    await flushPromises();

    fireEvent.changeText(getByTestId('advisory-search'), 'khanna');
    await flushPromises();

    expect(getByText('Dr. Rajesh Khanna')).toBeTruthy();
    expect(queryByText('Priya Sharma')).toBeNull();
    expect(queryByText('Amit Verma')).toBeNull();
  });

  it('filters by the RA type chip', async () => {
    const { getByTestId, getByText, queryByText } = render(
      <AdvisorListScreen navigation={mockNavigation as any} route={{} as any} />,
    );
    await flushPromises();

    fireEvent.press(getByTestId('chip-RA'));
    await flushPromises();

    expect(getByText('Amit Verma')).toBeTruthy();
    expect(getByText('Suresh Iyer')).toBeTruthy();
    expect(queryByText('Dr. Rajesh Khanna')).toBeNull();

    // Reset to All restores the full list
    fireEvent.press(getByTestId('chip-all'));
    await flushPromises();
    expect(getByText('Dr. Rajesh Khanna')).toBeTruthy();
  });

  it('navigates to AdvisorDetail when an advisor card is pressed', async () => {
    const { getByText } = render(
      <AdvisorListScreen navigation={mockNavigation as any} route={{} as any} />,
    );
    await flushPromises();

    fireEvent.press(getByText('Dr. Rajesh Khanna'));
    expect(mockNavigate).toHaveBeenCalledWith('AdvisorDetail', { advisorId: 'advisor_1' });
  });

  it('shows the empty state when no advisors match', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.listAdvisors).mockResolvedValue({ advisors: [], total: 0, page: 1, totalPages: 0 });

    const { getByText } = render(
      <AdvisorListScreen navigation={mockNavigation as any} route={{} as any} />,
    );
    await flushPromises();

    expect(getByText('No advisors found')).toBeTruthy();
    expect(getByText('Try adjusting your search or filters.')).toBeTruthy();
  });
});
