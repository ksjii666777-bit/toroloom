import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from './testUtils';

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', marketUp: '#00C853', bgCard: '#1A1A2E',
      bgCardLight: '#25253D', bgInput: '#1E1E32', border: '#2A2A44', divider: '#2A2A44',
      bgSecondary: '#16162A', warning: '#FFC107', borderLight: '#3A3A54',
      danger: '#FF1744', white: '#FFFFFF',
    },
  }),
}));

const mockNavigate = vi.fn();

const defaultNotifications = [
  { id: 'n1', title: 'Trade Executed', message: 'Your buy order for RELIANCE has been executed at ₹2,500', type: 'trade' as const, read: false, timestamp: new Date(Date.now() - 1800000).toISOString() },
  { id: 'n2', title: 'Price Alert', message: 'TCS has crossed ₹4,000 mark', type: 'price_alert' as const, read: false, timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: 'n3', title: 'Funds Added', message: '₹10,000 has been credited to your account', type: 'system' as const, read: true, timestamp: new Date(Date.now() - 86400000).toISOString() },
  { id: 'n4', title: 'Dividend Received', message: 'You have received a dividend of ₹500', type: 'news' as const, read: true, timestamp: new Date(Date.now() - 172800000).toISOString() },
];

let mockStoreState: any = {};

vi.mock('../store/notificationStore', () => ({
  useNotificationStore: () => mockStoreState,
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user1', username: 'TraderJoe' },
  }),
}));

import NotificationsScreen from '../screens/NotificationsScreen';

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState = {
    notifications: defaultNotifications,
    preferences: { priceAlerts: true, tradeConfirmations: true, educationalReminders: false, systemUpdates: true, priceAlertThreshold: 3 },
    priceAlertRules: [],
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    removeNotification: vi.fn(),
    clearAll: vi.fn(),
    updatePreference: vi.fn(),
    addPriceAlertRule: vi.fn(),
    removePriceAlertRule: vi.fn(),
  };
});

describe('NotificationsScreen', () => {
  it('renders the screen title', () => {
    const { getByText } = render(<NotificationsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Notifications')).toBeDefined();
  });

  it('renders notification titles', () => {
    const { getByText } = render(<NotificationsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Trade Executed')).toBeDefined();
    expect(getByText('Price Alert')).toBeDefined();
  });

  it('renders notification messages', () => {
    const { getByText } = render(<NotificationsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Your buy order for RELIANCE has been executed at ₹2,500')).toBeDefined();
  });

  it('renders empty state when no notifications', () => {
    mockStoreState.notifications = [];
    const { getByText } = render(<NotificationsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText("You're all caught up! Notifications will appear here.")).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<NotificationsScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(toJSON()).toBeTruthy();
  });
});
