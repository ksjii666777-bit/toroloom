/**
 * ============================================================================
 * Toroloom — Firebase Analytics Service Unit Tests
 * ============================================================================
 *
 * Tests the analytics service wrapper:
 *   - logEvent with various event types
 *   - logScreenView
 *   - setUserProperty
 *   - setUserId
 *   - reset analytics
 *   - Graceful fallback when Firebase is unavailable
 *   - No-op when Firebase throws
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach} from 'vitest';


// ==================== Mocks ====================

const mockLogEvent = vi.fn().mockResolvedValue(undefined);
const mockSetUserProperty = vi.fn().mockResolvedValue(undefined);
const mockSetUserId = vi.fn().mockResolvedValue(undefined);
const mockResetAnalyticsData = vi.fn().mockResolvedValue(undefined);

// We must mock the entire module before importing analytics
// The analytics module does a dynamic import of @react-native-firebase/analytics
// inside getAnalytics(). We mock that module here.
//
// The service uses the modular Firebase v22+ API:
//   const mod = await import('@react-native-firebase/analytics');
//   const instance = mod.getAnalytics();           // -> instance object
//   mod.logEvent(instance, 'name', params);         // -> standalone function
//   mod.setUserProperty(instance, 'key', 'val');
//   ...
vi.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: () => ({ _mockAnalytics: true }),
  logEvent: mockLogEvent,
  setUserProperty: mockSetUserProperty,
  setUserId: mockSetUserId,
  resetAnalyticsData: mockResetAnalyticsData,
}));

// ==================== Imports ====================

import { analytics } from '../services/analytics';

// ==================== Tests ====================

describe('Analytics Service — logEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs a login event with method parameter', async () => {
    await analytics.logEvent('login', { method: 'email' });

    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
      'login',
      { method: 'email' },
    );
  });

  it('logs a signup event with google method', async () => {
    await analytics.logEvent('signup', { method: 'google' });

    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
      'signup',
      { method: 'google' },
    );
  });

  it('logs a stock_view event with symbol and name', async () => {
    await analytics.logEvent('stock_view', { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy' });

    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
      'stock_view',
      { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy' },
    );
  });

  it('logs an order_placed event with all fields', async () => {
    await analytics.logEvent('order_placed', {
      symbol: 'TCS',
      type: 'buy',
      quantity: 10,
      value: 38900,
    });

    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
      'order_placed',
      { symbol: 'TCS', type: 'buy', quantity: 10, value: 38900 },
    );
  });

  it('logs an error_occurred event', async () => {
    await analytics.logEvent('error_occurred', {
      code: 'NETWORK_ERROR',
      message: 'Connection timeout',
      screen: 'PortfolioScreen',
    });

    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
      'error_occurred',
      { code: 'NETWORK_ERROR', message: 'Connection timeout', screen: 'PortfolioScreen' },
    );
  });

  it('does not crash when Firebase throws', async () => {
    mockLogEvent.mockRejectedValueOnce(new Error('Firebase not initialized'));

    // Should not throw — the analytics service catches errors internally
    await expect(
      analytics.logEvent('login', { method: 'email' }),
    ).resolves.toBeUndefined();
  });

  it('handles empty params object gracefully', async () => {
    await analytics.logEvent('logout', {});

    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
      'logout',
      {},
    );
  });
});

describe('Analytics Service — logScreenView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs a screen view with both name and class', async () => {
    await analytics.logScreenView('Home', 'HomeScreen');

    // The service uses logEvent internally for screen views
    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
      'screen_view',
      { screen_name: 'Home', screen_class: 'HomeScreen' },
    );
  });

  it('uses screenName as screenClass when not provided', async () => {
    await analytics.logScreenView('Portfolio');

    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
      'screen_view',
      { screen_name: 'Portfolio', screen_class: 'Portfolio' },
    );
  });

  it('does not crash when Firebase throws during screen view', async () => {
    mockLogEvent.mockRejectedValueOnce(new Error('Firebase error'));

    await expect(
      analytics.logScreenView('TestScreen'),
    ).resolves.toBeUndefined();
  });
});

describe('Analytics Service — setUserProperty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets a user property with string value', async () => {
    await analytics.setUserProperty('kyc_status', 'verified');

    expect(mockSetUserProperty).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
      'kyc_status',
      'verified',
    );
  });

  it('sets a user property with null value (clears property)', async () => {
    await analytics.setUserProperty('kyc_status', null);

    expect(mockSetUserProperty).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
      'kyc_status',
      null,
    );
  });

  it('sets a user property for plan tier', async () => {
    await analytics.setUserProperty('plan_tier', 'premium');

    expect(mockSetUserProperty).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
      'plan_tier',
      'premium',
    );
  });

  it('does not crash when Firebase throws', async () => {
    mockSetUserProperty.mockRejectedValueOnce(new Error('Firebase unavailable'));

    await expect(
      analytics.setUserProperty('test', 'value'),
    ).resolves.toBeUndefined();
  });
});

describe('Analytics Service — setUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets the user ID for analytics', async () => {
    await analytics.setUserId('user_abc123');

    expect(mockSetUserId).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
      'user_abc123',
    );
  });

  it('clears the user ID when passed null (logout)', async () => {
    await analytics.setUserId(null);

    expect(mockSetUserId).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
      null,
    );
  });

  it('does not crash when Firebase throws', async () => {
    mockSetUserId.mockRejectedValueOnce(new Error('Not available'));

    await expect(
      analytics.setUserId('user_test'),
    ).resolves.toBeUndefined();
  });
});

describe('Analytics Service — reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets all analytics data', async () => {
    await analytics.reset();

    expect(mockResetAnalyticsData).toHaveBeenCalledWith(
      expect.objectContaining({ _mockAnalytics: true }),
    );
  });

  it('does not crash when Firebase throws', async () => {
    mockResetAnalyticsData.mockRejectedValueOnce(new Error('Reset failed'));

    await expect(analytics.reset()).resolves.toBeUndefined();
  });
});
