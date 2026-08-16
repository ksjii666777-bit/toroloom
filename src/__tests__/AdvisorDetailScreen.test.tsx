/**
 * ============================================================================
 * Toroloom — AdvisorDetailScreen Unit Tests
 * ============================================================================
 *
 * Covers:
 *   - Renders the profile hero, SEBI badge, stats and bio
 *   - Slot picker — selecting a slot reveals the fee summary
 *   - Booking flow — success shows the confirmation Alert and navigates;
 *     failure shows the failure Alert
 *   - Reviews render and the "Write a Review" button navigates
 *
 * The advisory API is mocked: reads reject (store falls back to mock data);
 * bookConsultation is overridden per-test to control the outcome.
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { Alert } from 'react-native';

// ── Functional FlatList mock — kept for consistency even though the detail
//    screen renders reviews directly (no FlatList) ─────────────────────────
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
        'app.ok': 'OK',
        'advisory.advisorProfile': 'Advisor Profile',
        'advisory.sebiRia': 'SEBI RIA Reg.',
        'advisory.sebiRa': 'SEBI RA Reg.',
        'advisory.rating': 'Rating',
        'advisory.reviews': 'Reviews',
        'advisory.experience': 'Experience',
        'advisory.yrs': 'yrs',
        'advisory.about': 'About',
        'advisory.disclaimer': 'Investments are subject to market risks.',
        'advisory.bookSession': 'Book a Session',
        'advisory.fee': 'Fee: ₹{{fee}}',
        'advisory.noSlots': 'No upcoming slots available right now.',
        'advisory.booking': 'Booking…',
        'advisory.confirmBook': 'Confirm & Book',
        'advisory.paymentNote': 'Payment is collected securely via Razorpay.',
        'advisory.bookSuccessTitle': 'Booking Confirmed 🎉',
        'advisory.bookSuccessMsg': 'Your consultation with {{name}} has been booked.',
        'advisory.bookFailTitle': 'Booking Failed',
        'advisory.bookFailMsg': 'We could not book this slot. Please try another time slot.',
        'advisory.reviewsCount': '{{count}} reviews',
        'advisory.noReviews': 'No reviews yet — be the first!',
        'advisory.writeReview': 'Write a Review',
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

// ── Advisory API mock — reads reject (mock fallback), writes overridden per test ──
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

import AdvisorDetailScreen from '../screens/advisory/AdvisorDetailScreen';
import { useAdvisoryStore } from '../store/advisoryStore';
import { advisoryApi } from '../services/api/advisory';

const mockNavigate = vi.fn();
const mockNavigation = { navigate: mockNavigate };
const mockRoute = { params: { advisorId: 'advisor_1' } };

// advisor_1 mock slots: advisor_1_slot_1_10_0 etc.
const FIRST_SLOT_ID = 'advisor_1_slot_1_10_0';

function resetStore() {
  useAdvisoryStore.setState(useAdvisoryStore.getInitialState());
}

async function flushPromises() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

function renderScreen() {
  return render(<AdvisorDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />);
}

describe('AdvisorDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    resetStore();
    // clearAllMocks keeps implementations — reset the booking mock to its
    // default rejection so success/failure tests don't leak into each other.
    vi.mocked(advisoryApi.bookConsultation).mockRejectedValue(new Error('offline'));
  });

  it('renders the profile hero with SEBI badge and stats', async () => {
    const { getByText } = renderScreen();
    await flushPromises();

    expect(getByText('Advisor Profile')).toBeTruthy();
    expect(getByText('Dr. Rajesh Khanna')).toBeTruthy();
    // SEBI badge: type + reg no
    expect(getByText(/SEBI RIA Reg\./)).toBeTruthy();
    expect(getByText(/INA000001234/)).toBeTruthy();
    // Hero stats
    expect(getByText(/4\.8/)).toBeTruthy();
    expect(getByText('127')).toBeTruthy();
    expect(getByText('15yrs')).toBeTruthy();
    // Bio + sections
    expect(getByText('About')).toBeTruthy();
    expect(getByText('Book a Session')).toBeTruthy();
    expect(getByText(/market risks/)).toBeTruthy();
  });

  it('selecting a slot reveals the fee summary and Confirm & Book', async () => {
    const { getByTestId, getByText, queryByText } = renderScreen();
    await flushPromises();

    expect(queryByText('Confirm & Book')).toBeNull();

    fireEvent.press(getByTestId(`slot-${FIRST_SLOT_ID}`));

    expect(getByText('Confirm & Book')).toBeTruthy();
    expect(getByText('Fee: ₹1500')).toBeTruthy();
  });

  it('books successfully and shows the confirmation alert', async () => {
    vi.mocked(advisoryApi.bookConsultation).mockResolvedValue({
      consultation: { id: 'consult_x', status: 'pending' } as any,
    });
    const alertSpy = vi.spyOn(Alert, 'alert');

    const { getByTestId, getByText } = renderScreen();
    await flushPromises();

    fireEvent.press(getByTestId(`slot-${FIRST_SLOT_ID}`));
    fireEvent.press(getByText('Confirm & Book'));
    await flushPromises();

    expect(advisoryApi.bookConsultation).toHaveBeenCalledWith('advisor_1', FIRST_SLOT_ID);
    expect(alertSpy).toHaveBeenCalledWith(
      'Booking Confirmed 🎉',
      expect.stringContaining('Dr. Rajesh Khanna'),
      expect.any(Array),
    );
  });

  it('shows the failure alert when booking fails', async () => {
    const alertSpy = vi.spyOn(Alert, 'alert');

    const { getByTestId, getByText } = renderScreen();
    await flushPromises();

    fireEvent.press(getByTestId(`slot-${FIRST_SLOT_ID}`));
    fireEvent.press(getByText('Confirm & Book'));
    await flushPromises();

    expect(alertSpy).toHaveBeenCalledWith('Booking Failed', 'We could not book this slot. Please try another time slot.');
  });

  it('renders reviews from the fallback data', async () => {
    const { getByText } = renderScreen();
    await flushPromises();

    // advisor_1 has two mock reviews
    expect(getByText('Rohit Mehta')).toBeTruthy();
    expect(getByText('Sneha Reddy')).toBeTruthy();
  });

  it('navigates to the review form', async () => {
    const { getByText } = renderScreen();
    await flushPromises();

    fireEvent.press(getByText('Write a Review'));
    expect(mockNavigate).toHaveBeenCalledWith('ReviewForm', { advisorId: 'advisor_1' });
  });
});
