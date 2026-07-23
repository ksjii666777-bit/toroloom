/**
 * ============================================================================
 * Toroloom — IPO Dashboard Screen Tests
 * ============================================================================
 *
 * Tests the IPO Dashboard: header, tabs, IPO cards with GMP/subscription,
 * application cards with allotment details, UPI apply modal, filters,
 * bookmarks, and empty states.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';
import IPODashboardScreen from '../screens/ipos/IPODashboardScreen';
import { useIPOStore } from '../store/ipoStore';
import { Alert } from 'react-native';

// Override setup.ts icon mocks so icon names render as text children.
vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  const IconComponent = function(props: any) {
    return React.createElement('Text', null, props.name);
  };
  return {
    Ionicons: IconComponent,
    MaterialIcons: IconComponent,
    MaterialCommunityIcons: IconComponent,
  };
});

// Mock AnimatedPressable as a plain host element so buttons are pressable
vi.mock('../components/ui/AnimatedPressable', () => ({
  default: 'TouchableOpacity',
}));

// Mock theme context
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0B0F19',
      bgSecondary: '#0E121D',
      bgCard: '#111827',
      bgCardLight: '#1A2235',
      bgInput: '#0F131E',
      border: '#1F2937',
      primary: '#3B82F6',
      primaryLight: '#60A5FA',
      text: '#FFFFFF',
      textSecondary: '#9CA3AF',
      textMuted: '#6B7280',
      marketUp: '#10B981',
      marketDown: '#EF4444',
      warning: '#F59E0B',
      accent: '#10B981',
      danger: '#EF4444',
      divider: '#1E293B',
      bgOverlay: 'rgba(7, 10, 17, 0.85)',
      white: '#FFFFFF',
    },
    isDark: true,
  }),
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockOpenIPO = {
  id: 'ipo_1', companyName: 'LG Electronics India', logo: 'LG',
  sector: 'Consumer Electronics',
  openDate: '2026-07-15T00:00:00.000Z', closeDate: '2026-07-19T00:00:00.000Z',
  listingDate: '2026-07-24T00:00:00.000Z',
  priceBand: { min: 450, max: 475 }, lotSize: 30, minInvestment: 14250,
  issueSize: 15000, freshIssue: 8000, offerForSale: 7000, totalShares: 32000000,
  totalBids: 2450000, totalBidAmount: 115000,
  subscriptionStatus: 'open' as const,
  subscriptionQIB: 4.5, subscriptionHNI: 8.2, subscriptionRetail: 3.1,
  subscriptionTotal: 5.8,
  gmp: 85, gmpPercent: 18.5,
  expectedListingPrice: 552, expectedListingGain: 17.9,
  leadManagers: ['Kotak'], registrar: 'Link Intime',
  rating: 4, revenue: 89500, netProfit: 10500, peRatio: 35.2, roe: 18.5,
  about: 'LG Electronics India...',
  strengths: ['Market leader'], risks: ['Competition'],
  applications: 1850000, sharesApplied: 96000000,
  allotmentDate: '2026-07-22T00:00:00.000Z',
  isBookmarked: true,
};

const mockUpcomingIPO = {
  ...mockOpenIPO,
  id: 'ipo_2', companyName: 'OYO Rooms', logo: 'OY',
  sector: 'Hospitality', openDate: '2026-07-25T00:00:00.000Z',
  closeDate: '2026-07-29T00:00:00.000Z', listingDate: '2026-08-05T00:00:00.000Z',
  priceBand: { min: 270, max: 290 }, lotSize: 50, minInvestment: 14500,
  subscriptionStatus: 'upcoming' as const,
  gmp: 0, gmpPercent: 0,
  subscriptionTotal: 0, subscriptionQIB: 0, subscriptionHNI: 0, subscriptionRetail: 0,
  isBookmarked: false,
};

const mockListedIPO = {
  ...mockOpenIPO,
  id: 'ipo_3', companyName: 'Zomato', logo: 'ZO',
  sector: 'Food Tech',
  subscriptionStatus: 'listed' as const,
  gmp: 0, gmpPercent: 0,
  isBookmarked: false,
};

const mockApplicationPending = {
  id: 'app_1', ipoId: 'ipo_1', companyName: 'LG Electronics India',
  logo: 'LG', sector: 'Consumer Electronics',
  bidLots: 2, bidQuantity: 60, bidPrice: 475, totalAmount: 28500,
  upiId: 'user@hdfc', status: 'submitted' as const,
  appliedAt: '2026-07-16T10:30:00.000Z',
};

const mockApplicationAllotted = {
  id: 'app_2', ipoId: 'ipo_3', companyName: 'Zomato',
  logo: 'ZO', sector: 'Food Tech',
  bidLots: 3, bidQuantity: 150, bidPrice: 450, totalAmount: 67500,
  upiId: 'user@okhdfc', status: 'allotted' as const,
  sharesAllotted: 150, listingPrice: 520, listingGain: 15.6,
  appliedAt: '2026-07-10T09:00:00.000Z',
};

const mockApplicationNotAllotted = {
  id: 'app_3', ipoId: 'ipo_2', companyName: 'OYO Rooms',
  logo: 'OY', sector: 'Hospitality',
  bidLots: 1, bidQuantity: 50, bidPrice: 290, totalAmount: 14500,
  upiId: 'user@paytm', status: 'not_allotted' as const,
  appliedAt: '2026-07-20T14:00:00.000Z',
};

const mockIPOs = [mockOpenIPO, mockUpcomingIPO, mockListedIPO];
const mockApplications = [mockApplicationPending, mockApplicationAllotted, mockApplicationNotAllotted];

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  useIPOStore.setState({
    ipos: mockIPOs,
    applications: mockApplications,
    isLoading: false,
    selectedIPO: null,
  });
});

function renderScreen() {
  return render(
    <IPODashboardScreen
      navigation={{ navigate: mockNavigate, goBack: mockGoBack } as any}
    />
  );
}

function renderAndSwitchToMyApps() {
  const result = renderScreen();
  act(() => { fireEvent.press(result.getByText(/My Apps \(3\)/)); });
  return result;
}

// =============================================================================
// Header & Tabs
// =============================================================================

describe('IPODashboardScreen — Header & Tabs', () => {
  it('renders the header title', () => {
    const { getByText } = renderScreen();
    expect(getByText('IPO Dashboard')).toBeDefined();
  });

  it('renders the subtitle with counts', () => {
    const { getByText } = renderScreen();
    expect(getByText(/1 open/)).toBeDefined();
    expect(getByText(/1 upcoming/)).toBeDefined();
    expect(getByText(/1 listed/)).toBeDefined();
  });

  it('renders the back button', () => {
    const { getByText } = renderScreen();
    // Ionicons icon name renders as text via our mock
    expect(getByText('arrow-back')).toBeDefined();
  });

  it('navigates back when back button is pressed', () => {
    const { getByText } = renderScreen();
    act(() => {
      fireEvent.press(getByText('arrow-back'));
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders both tab buttons', () => {
    const { getByText } = renderScreen();
    expect(getByText('Active IPOs')).toBeDefined();
    expect(getByText(/My Apps/)).toBeDefined();
  });

  it('shows application count in My Apps tab', () => {
    const { getByText } = renderScreen();
    expect(getByText(/My Apps \(3\)/)).toBeDefined();
  });

  it('switches to My Apps tab when pressed', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText(/My Apps/)); });
    expect(getByText(/Total/)).toBeDefined();
  });
});

// =============================================================================
// Active IPOs Tab — Filters
// =============================================================================

describe('IPODashboardScreen — Active IPOs Filters', () => {
  it('renders all 5 filter chips', () => {
    const { getByText } = renderScreen();
    expect(getByText('All')).toBeDefined();
    expect(getByText('Open')).toBeDefined();
    expect(getByText('Upcoming')).toBeDefined();
    expect(getByText('Closed')).toBeDefined();
    expect(getByText('Listed')).toBeDefined();
  });

  it('shows IPO count for active filter', () => {
    const { getByText } = renderScreen();
    // Default filter is 'Open' — only mockOpenIPO matches
    expect(getByText(/1 IPO/)).toBeDefined();
  });

  it('filters IPOs when a different filter is selected', () => {
    const { getByText } = renderScreen();
    // Switch to 'Upcoming' filter
    act(() => { fireEvent.press(getByText('Upcoming')); });
    expect(getByText(/1 IPO/)).toBeDefined();
    expect(getByText('OYO Rooms')).toBeDefined();
  });

  it('shows all IPOs when All filter is selected', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('All')); });
    expect(getByText(/3 IPOs/)).toBeDefined();
  });
});

// =============================================================================
// Active IPOs Tab — IPO Card
// =============================================================================

describe('IPODashboardScreen — IPO Card', () => {
  it('renders company name and sector', () => {
    const { getByText } = renderScreen();
    expect(getByText('LG Electronics India')).toBeDefined();
    expect(getByText('Consumer Electronics')).toBeDefined();
  });

  it('renders price band', () => {
    const { getByText } = renderScreen();
    expect(getByText(/₹450/)).toBeDefined();
    expect(getByText(/₹475/)).toBeDefined();
  });

  it('renders lot size', () => {
    const { getByText } = renderScreen();
    expect(getByText('30 shares')).toBeDefined();
  });

  it('renders min investment', () => {
    const { getByText } = renderScreen();
    expect(getByText('₹14,250')).toBeDefined();
  });

  it('renders GMP with positive value', () => {
    const { getByText } = renderScreen();
    expect(getByText(/₹85/)).toBeDefined();
    expect(getByText(/18\.5%/)).toBeDefined();
  });

  it('renders expected listing price', () => {
    const { getByText } = renderScreen();
    expect(getByText(/₹552/)).toBeDefined();
    expect(getByText(/17\.9%/)).toBeDefined();
  });

  it('renders subscription details', () => {
    const { getByText } = renderScreen();
    expect(getByText(/5\.8x/)).toBeDefined();
    expect(getByText(/QIB: 4\.5x/)).toBeDefined();
    expect(getByText(/HNI: 8\.2x/)).toBeDefined();
    expect(getByText(/Ret: 3\.1x/)).toBeDefined();
  });

  it('renders Open and Listing dates', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Open:/)).toBeDefined();
    expect(getByText(/Listing:/)).toBeDefined();
  });

  it('renders status badge for open IPO', () => {
    const { getByText } = renderScreen();
    expect(getByText('Open Now')).toBeDefined();
  });

  it('renders Apply via UPI button for open IPOs', () => {
    const { getByText } = renderScreen();
    expect(getByText('Apply via UPI')).toBeDefined();
  });

  it('shows bookmarked icon for bookmarked IPOs', () => {
    const { getByText } = renderScreen();
    // mockOpenIPO has isBookmarked: true — icon name renders as 'bookmark' via mock
    expect(getByText('bookmark')).toBeDefined();
  });

  it('navigates to IPO detail on card press', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('LG Electronics India')); });
    expect(mockNavigate).toHaveBeenCalledWith('IPODetail', { ipoId: 'ipo_1' });
  });
});

// =============================================================================
// Active IPOs Tab — Bookmarks
// =============================================================================

describe('IPODashboardScreen — Bookmark Toggle', () => {
  it('toggles bookmark when bookmark icon is pressed', () => {
    const { getByText } = renderScreen();
    // Verify IPO starts bookmarked
    expect(useIPOStore.getState().ipos.find(i => i.id === 'ipo_1')?.isBookmarked).toBe(true);

    act(() => { fireEvent.press(getByText('bookmark')); });

    // Verify bookmark was toggled in store state
    expect(useIPOStore.getState().ipos.find(i => i.id === 'ipo_1')?.isBookmarked).toBe(false);
  });

  it('shows bookmark-outline for non-bookmarked IPOs', () => {
    // Switch to Upcoming filter to see OYO (not bookmarked)
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Upcoming')); });
    expect(getByText('bookmark-outline')).toBeDefined();
  });
});

// =============================================================================
// Active IPOs Tab — Empty State
// =============================================================================

describe('IPODashboardScreen — Empty IPO State', () => {
  beforeEach(() => {
    useIPOStore.setState({ ipos: [] });
  });

  it('shows empty state when no IPOs match', () => {
    const { getByText } = renderScreen();
    expect(getByText('No IPOs found')).toBeDefined();
    expect(getByText('Check back later for new IPOs')).toBeDefined();
  });
});

// =============================================================================
// My Apps Tab — Stats & Filters
// =============================================================================

describe('IPODashboardScreen — My Apps Tab', () => {
  it('shows stat chips for application counts', () => {
    const { getByText } = renderAndSwitchToMyApps();
    expect(getByText('Total')).toBeDefined();
    expect(getByText('Submitted')).toBeDefined();
    expect(getByText('Allotted')).toBeDefined();
    expect(getByText('Not Allotted')).toBeDefined();
    expect(getByText('Invested')).toBeDefined();
  });

  it('shows total application count in stats', () => {
    const { getByText } = renderAndSwitchToMyApps();
    // Total should be 3
    expect(getByText('3')).toBeDefined();
  });

  it('shows profit stat when profit exists', () => {
    const { getByText } = renderAndSwitchToMyApps();
    expect(getByText('Profit')).toBeDefined();
  });

  it('shows app filter chips for filtering applications', () => {
    const { getByText } = renderAndSwitchToMyApps();
    expect(getByText('All')).toBeDefined();
    expect(getByText('Active')).toBeDefined();
  });
});

// =============================================================================
// My Apps Tab — Application Card
// =============================================================================

describe('IPODashboardScreen — Application Card', () => {
  it('renders company info for each application', () => {
    const { getByText } = renderAndSwitchToMyApps();
    expect(getByText('LG Electronics India')).toBeDefined();
    expect(getByText('Zomato')).toBeDefined();
    expect(getByText('OYO Rooms')).toBeDefined();
  });

  it('renders bid details (lots, shares, price, amount)', () => {
    const { getByText } = renderAndSwitchToMyApps();
    expect(getByText('2')).toBeDefined(); // lots
    expect(getByText('60')).toBeDefined(); // shares
    expect(getByText('₹475')).toBeDefined(); // price
    expect(getByText(/₹28\.5K/)).toBeDefined(); // amount (compact)
  });

  it('renders UPI ID for each application', () => {
    const { getByText } = renderAndSwitchToMyApps();
    expect(getByText(/UPI: user@hdfc/)).toBeDefined();
    expect(getByText(/UPI: user@okhdfc/)).toBeDefined();
  });

  it('renders application date', () => {
    const { getByText } = renderAndSwitchToMyApps();
    expect(getByText(/Applied:/)).toBeDefined();
  });

  it('renders status badges for different statuses', () => {
    const { getByText } = renderAndSwitchToMyApps();
    expect(getByText('Submitted')).toBeDefined();
    expect(getByText('Not Allotted')).toBeDefined();
  });

  it('shows allotment details for allotted applications', () => {
    const { getByText } = renderAndSwitchToMyApps();
    expect(getByText('150 shares')).toBeDefined(); // allotted shares
    expect(getByText('₹520')).toBeDefined(); // listing price
    expect(getByText(/%/)).toBeDefined(); // gain percentage
  });
});

// =============================================================================
// My Apps Tab — Empty State
// =============================================================================

describe('IPODashboardScreen — Empty Applications State', () => {
  beforeEach(() => {
    useIPOStore.setState({ applications: [] });
  });

  it('shows empty state when no applications exist', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText(/My Apps/)); });
    expect(getByText('No Applications')).toBeDefined();
    expect(getByText('Apply to an open IPO to see it here')).toBeDefined();
  });
});

// =============================================================================
// My Apps Tab — Application Filters
// =============================================================================

describe('IPODashboardScreen — Application Filters', () => {
  it('filters by Allotted status', () => {
    const { getByText } = renderAndSwitchToMyApps();
    act(() => { fireEvent.press(getByText('✅')); });
    expect(getByText('Zomato')).toBeDefined();
  });

  it('filters by Not Allotted status', () => {
    const { getByText } = renderAndSwitchToMyApps();
    act(() => { fireEvent.press(getByText('❌')); });
    expect(getByText('OYO Rooms')).toBeDefined();
  });
});

// =============================================================================
// UPI Apply Modal
// =============================================================================

describe('IPODashboardScreen — UPI Apply Modal', () => {
  beforeEach(() => {
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('opens apply modal when Apply via UPI is pressed', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Apply via UPI')); });
    expect(getByText('Apply via UPI')).toBeDefined();
    expect(getByText('Cut-off')).toBeDefined();
    expect(getByText('Higher')).toBeDefined();
  });

  it('shows company info in the modal', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Apply via UPI')); });
    expect(getByText('LG Electronics India')).toBeDefined();
    expect(getByText(/₹450 – ₹475/)).toBeDefined();
  });

  it('shows lot options in the modal', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Apply via UPI')); });
    // Lot options: 1, 2, 3, 5, 10, 20, 50
    expect(getByText('1')).toBeDefined();
    expect(getByText('2')).toBeDefined();
    expect(getByText('3')).toBeDefined();
    expect(getByText('5')).toBeDefined();
    expect(getByText('10')).toBeDefined();
    expect(getByText('20')).toBeDefined();
    expect(getByText('50')).toBeDefined();
  });

  it('shows UPI ID input field', () => {
    const { getByText, getByPlaceholderText } = renderScreen();
    act(() => { fireEvent.press(getByText('Apply via UPI')); });
    expect(getByPlaceholderText('e.g., name@hdfc')).toBeDefined();
  });

  it('shows summary with lot, shares, price, and total', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Apply via UPI')); });
    expect(getByText('Number of Lots')).toBeDefined();
    expect(getByText('Bid Price (₹)')).toBeDefined();
    expect(getByText('UPI ID')).toBeDefined();
  });

  it('shows the apply button with total amount', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Apply via UPI')); });
    // Default: 1 lot × 30 shares × ₹450 = ₹13,500
    expect(getByText(/Apply for/)).toBeDefined();
    expect(getByText(/₹13\.5K/)).toBeDefined();
  });

  it('shows info text about UPI amount blocking', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Apply via UPI')); });
    expect(getByText(/Amount will be blocked/)).toBeDefined();
  });

  it('shows validation error for empty UPI ID', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Apply via UPI')); });
    act(() => { fireEvent.press(getByText(/Apply for/)); });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Invalid UPI ID',
      expect.stringContaining('valid UPI ID'),
    );
  });

  it('accepts valid UPI input and submits application', () => {
    const applySpy = vi.spyOn(useIPOStore.getState(), 'applyForIPO');
    const { getByText, getByPlaceholderText } = renderScreen();

    act(() => { fireEvent.press(getByText('Apply via UPI')); });

    // Enter UPI ID
    const upiInput = getByPlaceholderText('e.g., name@hdfc');
    act(() => { fireEvent.changeText(upiInput, 'user@hdfc'); });

    // Submit
    act(() => { fireEvent.press(getByText(/Apply for/)); });

    expect(applySpy).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Application Submitted ✅',
      expect.stringContaining('LG Electronics India'),
    );
  });

  it('closes modal when close button is pressed', () => {
    const { getByText, queryByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Apply via UPI')); });

    // Close modal (close icon name renders as text)
    act(() => { fireEvent.press(getByText('close')); });

    // Modal elements should be gone
    expect(queryByText('Cut-off')).toBeNull();
  });

  it('selects a different lot count', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Apply via UPI')); });

    // Select 10 lots (unique — won't match subscription rates like 5.8x)
    act(() => { fireEvent.press(getByText('10')); });

    // For 10 lots: 10 × 30 × 450 = 135,000 → ₹1.4L (Lakh format, since >= 100000)
    expect(getByText(/Apply for/)).toBeDefined();
    expect(getByText(/₹1\.4L/)).toBeDefined();
  });

  it('switches between Cut-off and Higher price', () => {
    const { getByText } = renderScreen();
    act(() => { fireEvent.press(getByText('Apply via UPI')); });

    // Select Higher price (max)
    act(() => { fireEvent.press(getByText('Higher')); });

    // For 1 lot × 30 × 475 = 14,250
    expect(getByText(/₹14\.3K/)).toBeDefined();
  });
});
