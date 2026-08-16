import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import { mockEconomicEvents } from '../constants/mockData';

// ── Local theme mock ────────────────────────────────────────
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

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Navigation mock — the screen calls useNavigation() for the back button.
// mockNavigate must be hoisted because vi.mock factories are hoisted above
// const declarations.
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: vi.fn() }),
}));

// Override setup.ts Ionicons mock so icon names render as text children.
vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  const IconComponent = function(props: any) {
    return React.createElement('Text', null, props.name || '');
  };
  return {
    Ionicons: IconComponent,
    AntDesign: IconComponent,
    MaterialIcons: IconComponent,
    MaterialCommunityIcons: IconComponent,
    Feather: IconComponent,
    FontAwesome: IconComponent,
    FontAwesome5: IconComponent,
  };
});

// i18n mock — provide the keys used by the screen
vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'economicCalendar.title': 'Economic Calendar',
        'economicCalendar.totalEvents': 'Total Events',
        'economicCalendar.upcoming': 'Upcoming',
        'economicCalendar.released': 'Released',
        'economicCalendar.highImportance': 'High',
        'economicCalendar.mediumImportance': 'Medium',
        'economicCalendar.lowImportance': 'Low',
        'economicCalendar.allImportance': 'All',
        'economicCalendar.allCategories': 'All Categories',
        'economicCalendar.clearFilters': 'Clear Filters',
        'economicCalendar.filters': 'Filters',
        'economicCalendar.next7Days': 'Next 7 Days',
        'economicCalendar.next30Days': 'Next 30 Days',
        'economicCalendar.later': 'Later',
        'economicCalendar.pastEvents': 'Recent Releases',
        'economicCalendar.noEvents': 'No Events',
        'economicCalendar.noEventsDesc': 'Upcoming economic events will appear here',
        'economicCalendar.loading': 'Loading events…',
        'economicCalendar.today': 'Today',
        'economicCalendar.tomorrow': 'Tomorrow',
        'economicCalendar.forecast': 'Forecast',
        'economicCalendar.previous': 'Previous',
        'economicCalendar.actual': 'Actual',
        'economicCalendar.impact': 'Impact',
        'economicCalendar.affectedAssets': 'Affected Assets',
        'economicCalendar.countdown': 'in {count}d',
        'economicCalendar.releasedLabel': 'Released',
        'economicCalendar.disclaimer': 'Disclaimer',
        'economicCalendar.catCentralBank': 'Central Bank',
        'economicCalendar.catGdp': 'GDP & Growth',
        'economicCalendar.catInflation': 'Inflation',
        'economicCalendar.catEmployment': 'Employment',
        'economicCalendar.catTrade': 'Trade',
        'economicCalendar.catFiscal': 'Fiscal & Budget',
        'economicCalendar.catIndustry': 'Industry & PMI',
        'economicCalendar.catConsumer': 'Consumer',
        'economicCalendar.catHousing': 'Housing',
        'economicCalendar.catOther': 'Other',
        'economicCalendar.impactPositive': 'Positive',
        'economicCalendar.impactNegative': 'Negative',
        'economicCalendar.impactNeutral': 'Neutral',
      };
      return map[key] || key;
    },
  }),
}));

import EconomicCalendarScreen from '../screens/news/EconomicCalendarScreen';
import { useEconomicCalendarStore } from '../store/economicCalendarStore';

const mockNavigation = { navigate: mockNavigate };

/** Reset the shared store so tests don't leak filter state into each other. */
function resetStore() {
  useEconomicCalendarStore.setState(useEconomicCalendarStore.getInitialState());
}

/** Flush pending promises so async effects (like fetchEvents) resolve */
async function flushPromises() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe('EconomicCalendarScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('renders the header title and overview stats after loading', async () => {
    const { getByText } = render(<EconomicCalendarScreen navigation={mockNavigation as any} route={{} as any} />);
    await flushPromises();

    expect(getByText('Economic Calendar')).toBeTruthy();
    expect(getByText('Total Events')).toBeTruthy();
    expect(getByText('Upcoming')).toBeTruthy();
    expect(getByText('Released')).toBeTruthy();
  });

  it('renders events from the store fallback data', async () => {
    const { getByText } = render(<EconomicCalendarScreen navigation={mockNavigation as any} route={{} as any} />);
    await flushPromises();

    // Fallback data contains the RBI + Fed events
    const rbi = mockEconomicEvents.find(e => e.title.includes('RBI'));
    expect(getByText(rbi!.title)).toBeTruthy();
  });

  it('filters events by importance when a chip is pressed', async () => {
    const { getByTestId, queryByText } = render(<EconomicCalendarScreen navigation={mockNavigation as any} route={{} as any} />);
    await flushPromises();

    // Tap the "High" importance filter chip
    fireEvent.press(getByTestId('imp-filter-high'));
    await flushPromises();

    // Low-importance events (e.g. steel production) should disappear
    const steel = mockEconomicEvents.find(e => e.title.includes('Steel'));
    expect(queryByText(steel!.title)).toBeNull();

    // High-importance events remain
    const rbi = mockEconomicEvents.find(e => e.title.includes('RBI'));
    expect(queryByText(rbi!.title)).toBeTruthy();
  });

  it('clears filters and restores the full list', async () => {
    const { getByTestId, getByText } = render(<EconomicCalendarScreen navigation={mockNavigation as any} route={{} as any} />);
    await flushPromises();

    fireEvent.press(getByTestId('imp-filter-high'));
    await flushPromises();

    // The clear button appears in the header once a filter is active
    fireEvent.press(getByTestId('econ-clear-filters'));
    await flushPromises();

    const steel = mockEconomicEvents.find(e => e.title.includes('Steel'));
    expect(getByText(steel!.title)).toBeTruthy();
  });

  it('opens the event detail modal on card press', async () => {
    const { getByTestId, getByText } = render(<EconomicCalendarScreen navigation={mockNavigation as any} route={{} as any} />);
    await flushPromises();

    const rbi = mockEconomicEvents.find(e => e.title.includes('RBI'));
    fireEvent.press(getByTestId(`event-card-${rbi!.id}`));
    await flushPromises();

    // Modal shows Forecast / Previous labels
    expect(getByText('Forecast')).toBeTruthy();
    expect(getByText('Previous')).toBeTruthy();
  });
});
