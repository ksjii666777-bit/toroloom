/**
 * ============================================================================
 * Toroloom — useNotificationSetup Hook Tests
 * ============================================================================
 *
 * Tests the notification setup hook: that it registers for push notifications
 * on mount, sets up foreground/response listeners, cleans up on unmount, and
 * maps notification screens correctly via the onNavigate callback.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TestRenderer from 'react-test-renderer';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();

// Use vi.hoisted so these are available inside vi.mock factories (which are hoisted above all code)
const {
  mockAddNotificationReceivedListener,
  mockAddNotificationResponseReceivedListener,
  mockRegisterForPush,
  mockSetupResponseListener,
} = vi.hoisted(() => ({
  mockAddNotificationReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  mockAddNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  mockRegisterForPush: vi.fn(() => Promise.resolve('mock-push-token')),
  mockSetupResponseListener: vi.fn((_onNavigate: any) => ({ remove: vi.fn() })),
}));

// Mock react-navigation/native for useNavigation
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  NavigationContainer: ({ children }: any) => children,
}));

// Override expo-notifications mock to capture listeners (manual mock — no importActual)
vi.mock('expo-notifications', () => ({
  default: {
    addNotificationReceivedListener: mockAddNotificationReceivedListener,
    addNotificationResponseReceivedListener: mockAddNotificationResponseReceivedListener,
    setNotificationHandler: vi.fn(),
    getPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
    requestPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
    setNotificationChannelAsync: vi.fn(() => Promise.resolve()),
    getExpoPushTokenAsync: vi.fn(() => Promise.resolve({ data: 'mock-token' })),
    scheduleNotificationAsync: vi.fn(() => Promise.resolve('id')),
    cancelScheduledNotificationAsync: vi.fn(),
    cancelAllScheduledNotificationsAsync: vi.fn(),
  },
  AndroidImportance: { HIGH: 'high', DEFAULT: 'default' },
  setNotificationHandler: vi.fn(),
  addNotificationReceivedListener: mockAddNotificationReceivedListener,
  addNotificationResponseReceivedListener: mockAddNotificationResponseReceivedListener,
  getPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: vi.fn(() => Promise.resolve({ data: 'mock-token' })),
  scheduleNotificationAsync: vi.fn(() => Promise.resolve('id')),
}));

// Mock the notifications API so registerPushToken and getBadgeCount don't error
vi.mock('../services/api/notifications', () => ({
  notificationApi: {
    registerPushToken: vi.fn(() => Promise.resolve({ success: true })),
    getBadgeCount: vi.fn(() => Promise.resolve({ badgeCount: 0 })),
  },
}));

// Override notificationService mock — use mock implementations for the functions
// the hook calls so we can verify they're invoked correctly.
vi.mock('../services/notificationService', () => ({
  registerForPushNotifications: mockRegisterForPush,
  setupNotificationResponseListener: mockSetupResponseListener,
  registerPortfolioAlertBackgroundTask: vi.fn(),
  evaluatePortfolioAlertsInBackground: vi.fn(),
  updateAppIconBadge: vi.fn(() => Promise.resolve()),
  setupChannels: vi.fn(),
  sendLocalNotification: vi.fn(),
  cancelNotification: vi.fn(),
  cancelAllNotifications: vi.fn(),
  sendPriceAlert: vi.fn(),
  sendTradeConfirmation: vi.fn(),
  sendEducationalReminder: vi.fn(),
  getScreenForType: vi.fn((_type: string) => 'Home'),
}));

// ==================== Imports ====================

import { useNotificationSetup } from '../hooks/useNotificationSetup';
import { notificationApi } from '../services/api/notifications';
import * as notificationService from '../services/notificationService';

// ==================== Test Component ====================

function TestComponent() {
  useNotificationSetup();
  return null;
}

// ==================== Tests ====================

describe('useNotificationSetup — Mount Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('registers for push notifications on mount', () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    expect(mockRegisterForPush).toHaveBeenCalled();
  });

  it('sets up a foreground notification listener on mount', () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    expect(mockAddNotificationReceivedListener).toHaveBeenCalled();
    const handler = (mockAddNotificationReceivedListener.mock.calls as any)[0][0];
    expect(typeof handler).toBe('function');
  });

  it('sets up a notification response listener on mount', () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    expect(mockSetupResponseListener).toHaveBeenCalled();
  });

  it('passes onNavigate callback to setupNotificationResponseListener', () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    const passedCallback = (mockSetupResponseListener.mock.calls as any)[0][0];
    expect(typeof passedCallback).toBe('function');
  });

  it('calls remove on both listeners during cleanup', () => {
    const removeReceived = vi.fn();
    const removeResponse = vi.fn();
    // The hook uses addNotificationReceivedListener directly
    mockAddNotificationReceivedListener.mockReturnValueOnce({ remove: removeReceived });
    // The hook uses setupNotificationResponseListener (which is mocked via mockSetupResponseListener)
    mockSetupResponseListener.mockReturnValueOnce({ remove: removeResponse });

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<TestComponent />);
    });

    act(() => {
      renderer!.unmount();
    });

    expect(removeReceived).toHaveBeenCalled();
    expect(removeResponse).toHaveBeenCalled();
  });

  it('calls syncBadgeCountFromBackend on mount (via getBadgeCount API)', () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    // syncBadgeCountFromBackend internally calls notificationApi.getBadgeCount()
    expect(notificationApi.getBadgeCount).toHaveBeenCalled();
  });

  it('calls updateAppIconBadge when syncBadgeCountFromBackend returns a non-zero badge count', async () => {
    // Override getBadgeCount to return a non-zero count
    vi.mocked(notificationApi.getBadgeCount).mockResolvedValueOnce({ badgeCount: 5 });

    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    // Flush pending microtasks so the async syncBadgeCountFromBackend completes
    await act(async () => {});

    expect(notificationService.updateAppIconBadge).toHaveBeenCalledWith(5);
  });
});

describe('useNotificationSetup — onNavigate Screen Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('navigates to StockDetail with stockId and symbol for StockDetail screen', () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    // Get the registered onNavigate callback
    const onNavigate = (mockSetupResponseListener.mock.calls as any)[0][0];

    act(() => {
      onNavigate('StockDetail', { symbol: 'RELIANCE' });
    });

    expect(mockNavigate).toHaveBeenCalledWith('StockDetail', {
      stockId: 'RELIANCE',
      symbol: 'RELIANCE',
    });
  });

  it('navigates to MainTabs/Portfolio for Portfolio screen', () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    const onNavigate = (mockSetupResponseListener.mock.calls as any)[0][0];

    act(() => {
      onNavigate('Portfolio');
    });

    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', { screen: 'Portfolio' });
  });

  it('navigates to Learn for Learn screen', () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    const onNavigate = (mockSetupResponseListener.mock.calls as any)[0][0];

    act(() => {
      onNavigate('Learn');
    });

    expect(mockNavigate).toHaveBeenCalledWith('Learn');
  });

  it('navigates to More for Profile screen', () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    const onNavigate = (mockSetupResponseListener.mock.calls as any)[0][0];

    act(() => {
      onNavigate('Profile');
    });

    expect(mockNavigate).toHaveBeenCalledWith('More');
  });

  it('navigates to Notifications for Notifications screen', () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    const onNavigate = (mockSetupResponseListener.mock.calls as any)[0][0];

    act(() => {
      onNavigate('Notifications');
    });

    expect(mockNavigate).toHaveBeenCalledWith('Notifications');
  });

  it('falls back to MainTabs/Home for unknown screen', () => {
    act(() => {
      TestRenderer.create(<TestComponent />);
    });

    const onNavigate = (mockSetupResponseListener.mock.calls as any)[0][0];

    act(() => {
      onNavigate('UnknownScreen');
    });

    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', { screen: 'Home' });
  });
});
