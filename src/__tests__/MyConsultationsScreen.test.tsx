/**
 * ============================================================================
 * Toroloom — MyConsultationsScreen Unit Tests
 * ============================================================================
 *
 * Covers:
 *   - Renders the title and the Upcoming tab with confirmed consultations
 *   - Switching to the Past tab shows completed/cancelled consultations
 *   - Tapping a consultation navigates to ConsultationDetail
 *   - Empty state with a "Browse Advisors" CTA
 *
 * The advisory API is mocked to reject, so the store falls back to
 * mockConsultations (confirmed → upcoming; completed → past).
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
    t: (key: string) => {
      const map: Record<string, string> = {
        'advisory.myConsultations': 'My Consultations',
        'advisory.upcoming': 'Upcoming',
        'advisory.past': 'Past',
        'advisory.ria': 'Registered Investment Advisor',
        'advisory.ra': 'Research Analyst',
        'advisory.status.pending': 'Pending Payment',
        'advisory.status.confirmed': 'Confirmed',
        'advisory.status.completed': 'Completed',
        'advisory.status.cancelled': 'Cancelled',
        'advisory.status.refunded': 'Refunded',
        'advisory.noUpcoming': 'No upcoming consultations',
        'advisory.noPast': 'No past consultations',
        'advisory.noConsultHint': 'Book a session with a SEBI-registered advisor to get expert guidance.',
        'advisory.browseAdvisors': 'Browse Advisors',
      };
      return map[key] ?? key;
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

import MyConsultationsScreen from '../screens/advisory/MyConsultationsScreen';
import { useAdvisoryStore } from '../store/advisoryStore';

const mockNavigate = vi.fn();
const mockNavigation = { navigate: mockNavigate };
const mockRoute = { params: {} };

function resetStore() {
  useAdvisoryStore.setState(useAdvisoryStore.getInitialState());
}

async function flushPromises() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe('MyConsultationsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('renders the title and upcoming consultations with status', async () => {
    const { getByText } = render(
      <MyConsultationsScreen navigation={mockNavigation as any} route={mockRoute as any} />,
    );
    await flushPromises();

    expect(getByText('My Consultations')).toBeTruthy();
    expect(getByText('Upcoming')).toBeTruthy();
    expect(getByText('Past')).toBeTruthy();

    // consult_1 is confirmed → upcoming tab
    expect(getByText('Dr. Rajesh Khanna')).toBeTruthy();
    expect(getByText('Confirmed')).toBeTruthy();
    expect(getByText('1500')).toBeTruthy();
  });

  it('switches to the past tab and shows completed consultations', async () => {
    const { getByTestId, getByText, queryByText } = render(
      <MyConsultationsScreen navigation={mockNavigation as any} route={mockRoute as any} />,
    );
    await flushPromises();

    fireEvent.press(getByTestId('consult-tab-past'));
    await flushPromises();

    // consult_2 + consult_3 are completed → past tab
    expect(getByText('Priya Sharma')).toBeTruthy();
    expect(getByText('Amit Verma')).toBeTruthy();
    expect(getByText('Completed')).toBeTruthy();
    // Upcoming item hidden
    expect(queryByText('Dr. Rajesh Khanna')).toBeNull();
  });

  it('navigates to the consultation detail on card press', async () => {
    const { getByText } = render(
      <MyConsultationsScreen navigation={mockNavigation as any} route={mockRoute as any} />,
    );
    await flushPromises();

    fireEvent.press(getByText('Dr. Rajesh Khanna'));
    expect(mockNavigate).toHaveBeenCalledWith('ConsultationDetail', { consultationId: 'consult_1' });
  });

  it('shows the empty state with a Browse Advisors CTA', async () => {
    const { advisoryApi } = await import('../services/api/advisory');
    vi.mocked(advisoryApi.myConsultations).mockResolvedValue({ consultations: [] });

    const { getByText } = render(
      <MyConsultationsScreen navigation={mockNavigation as any} route={mockRoute as any} />,
    );
    await flushPromises();

    expect(getByText('No upcoming consultations')).toBeTruthy();

    fireEvent.press(getByText('Browse Advisors'));
    expect(mockNavigate).toHaveBeenCalledWith('AdvisorList');
  });
});
