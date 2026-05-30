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
      danger: '#FF1744',
    },
  }),
}));

const mockNavigate = vi.fn();
const mockUpdatePreference = vi.fn();

vi.mock('../store/notificationStore', () => ({
  useNotificationStore: () => ({
    preferences: {
      priceAlerts: true,
      tradeConfirmations: true,
      educationalReminders: false,
      systemUpdates: false,
      soundEnabled: true,
      vibrationEnabled: false,
      priceAlertThreshold: 2.0,
      quietHoursStart: null,
      quietHoursEnd: null,
    },
    updatePreference: mockUpdatePreference,
    resetPreferences: vi.fn(),
  }),
}));

import NotificationPreferencesScreen from '../screens/settings/NotificationPreferencesScreen';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotificationPreferencesScreen', () => {
  it('renders the screen title', () => {
    const { getByText } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Notification Preferences')).toBeDefined();
  });

  it('renders Notification Types section', () => {
    const { getByText } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Notification Types')).toBeDefined();
  });

  it('renders Alert Behavior section', () => {
    const { getByText } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Alert Behavior')).toBeDefined();
  });

  it('renders Price Alerts preference', () => {
    const { getByText } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Price Alerts')).toBeDefined();
  });

  it('renders Trade Confirmations preference', () => {
    const { getByText } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Trade Confirmations')).toBeDefined();
  });

  it('renders Learning Reminders preference', () => {
    const { getByText } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Learning Reminders')).toBeDefined();
  });

  it('renders System Updates preference', () => {
    const { getByText } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('System Updates')).toBeDefined();
  });

  it('renders Sound preference', () => {
    const { getByText } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Sound')).toBeDefined();
  });

  it('renders Vibration preference', () => {
    const { getByText } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Vibration')).toBeDefined();
  });

  it('renders Price Alert Threshold section', () => {
    const { getByText } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Price Alert Threshold')).toBeDefined();
  });

  it('renders Quiet Hours section', () => {
    const { getByText } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Quiet Hours')).toBeDefined();
  });

  it('renders Email Notifications section', () => {
    const { getByText } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Email Notifications')).toBeDefined();
  });

  it('renders Reset to Defaults button', () => {
    const { getByText } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(getByText('Reset to Defaults')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<NotificationPreferencesScreen navigation={{ navigate: mockNavigate } as any} />);
    expect(toJSON()).toBeTruthy();
  });
});
