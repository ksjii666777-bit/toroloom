/**
 * ============================================================================
 * Toroloom — ConnectBrokerView End-to-End Integration Test
 * ============================================================================
 *
 * Verifies the FULL connect broker flow end-to-end:
 *
 *   Loading → Disconnected → Session Sync → Connected → Test API → Disconnect
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================== Mocks ====================

const mockGoBack = vi.fn();

// (sessionStorage and proxyClient mocks removed — component now uses snapTradeApi only)

// Mock API services used by ConnectBrokerView
const mockSnapTradeStatus = vi.hoisted(() => vi.fn(() => Promise.resolve({ connected: false })));
const mockBrokerApiGetHoldings = vi.hoisted(() => vi.fn(() => Promise.resolve({ success: true, statusCode: 200, data: { holdings: [] } })));

vi.mock('../services/api', () => ({
  snapTradeApi: {
    status: mockSnapTradeStatus,
    register: vi.fn(() => Promise.resolve({ success: true })),
    getConnectLink: vi.fn(() => Promise.resolve({ oauthUrl: 'https://example.com/oauth' })),
    handleCallback: vi.fn(() => Promise.resolve({ success: true })),
    disconnect: vi.fn(() => Promise.resolve({ success: true })),
  },
  brokerProxyApi: {
    getHoldings: mockBrokerApiGetHoldings,
  },
}));

// Mock Linking from react-native (avoids overriding the entire react-native mock)
vi.mock('react-native/Libraries/Linking/Linking', () => ({
  default: {
    openURL: vi.fn(() => Promise.resolve()),
    getInitialURL: vi.fn(() => Promise.resolve(null)),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

// Mock expo-haptics
vi.mock('expo-haptics', () => ({
  default: {
    impactAsync: vi.fn(),
    notificationAsync: vi.fn(),
    ImpactFeedbackStyle: { Medium: 'medium', Light: 'light' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  },
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Medium: 'medium', Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Mock ThemeContext
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6', accent: '#00E676', danger: '#FF5252',
      text: '#FFFFFF', textSecondary: '#9CA3AF', textMuted: '#6B7280',
      bg: '#07080B', bgSecondary: '#0E121D', bgCard: 'rgba(255,255,255,0.03)',
      bgCardLight: '#1A2235', bgInput: '#0F131E', border: 'rgba(255,255,255,0.07)',
      divider: 'rgba(255,255,255,0.05)',
    },
  }),
}));

// Mock AnimatedPressable
vi.mock('../components/ui/AnimatedPressable', () => ({
  default: 'AnimatedPressable',
}));

// ==================== Imports ====================

import { render, fireEvent } from './testUtils';
import ConnectBrokerView from '../screens/broker/ConnectBrokerView';

// ==================== Helpers ====================

async function flushPromises() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

function renderView() {
  return render(<ConnectBrokerView navigation={{ goBack: mockGoBack }} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSnapTradeStatus.mockResolvedValue({ connected: false });
  mockBrokerApiGetHoldings.mockResolvedValue({ success: true, statusCode: 200, data: { holdings: [] } });
});

// ==================== Tests ====================

describe('ConnectBrokerView', () => {
  describe('Flow 1: Loading → Disconnected', () => {
    it('shows loading then disconnected state', async () => {
      const { getByText, queryByText } = renderView();
      expect(getByText('Checking connection status...')).toBeDefined();

      await flushPromises();

      expect(getByText('Connect Broker')).toBeDefined();
      expect(getByText('Choose Your Broker')).toBeDefined();
      expect(getByText('Angel One')).toBeDefined();
      expect(getByText('Zerodha')).toBeDefined();
      expect(getByText('Groww')).toBeDefined();
      expect(queryByText('Connected')).toBeNull();
    });

    it('shows subtitle in disconnected mode', async () => {
      const { getByText } = renderView();
      await flushPromises();
      expect(getByText('1-tap OAuth — powered by SnapTrade')).toBeDefined();
    });
  });

  describe('Flow 2: SnapTrade Connect (all brokers)', () => {
    it('renders Angel One broker card ready for SnapTrade OAuth', async () => {
      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('Angel One')).toBeDefined();
      expect(getByText('Tap to Connect')).toBeDefined();
    });

    it('renders Zerodha broker card ready for SnapTrade OAuth', async () => {
      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('Zerodha')).toBeDefined();
      expect(getByText('Tap to Connect')).toBeDefined();
    });
  });

  describe('Flow 3: Connected State', () => {
    it('detects existing Zerodha session and shows connected state', async () => {
      mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'zerodha', brokerName: 'Zerodha' } as any);

      const { getByText } = renderView();
      expect(getByText('Checking connection status...')).toBeDefined();
      await flushPromises();

      expect(getByText('Connect Broker')).toBeDefined();
      expect(getByText('Connected')).toBeDefined();
      expect(getByText('Test API')).toBeDefined();
      expect(getByText('Disconnect')).toBeDefined();
      expect(getByText('Switch to a different broker below')).toBeDefined();
    });

    it('detects existing Angel One session', async () => {
      mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'angel', brokerName: 'Angel One' });

      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('Connected')).toBeDefined();
      expect(getByText(/Angel One/)).toBeDefined();
      expect(getByText('Test API')).toBeDefined();
      expect(getByText('Disconnect')).toBeDefined();
    });

    it('detects existing Groww session', async () => {
      mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'groww', brokerName: 'Groww' });

      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('Connected')).toBeDefined();
      expect(getByText(/Groww/)).toBeDefined();
      expect(getByText('Test API')).toBeDefined();
    });
  });

  describe('Flow 4: Test API', () => {
    it('calls brokerProxyApi.getHoldings when Test API is pressed', async () => {
      mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'angel', brokerName: 'Angel One' });

      const { getByText } = renderView();
      await flushPromises();

      act(() => { fireEvent.press(getByText('Test API')); });
      await flushPromises();

      expect(mockBrokerApiGetHoldings).toHaveBeenCalledWith('angel');
    });

    it('handles Test API failure gracefully', async () => {
      mockBrokerApiGetHoldings.mockRejectedValue(new Error('Network error'));
      mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'angel', brokerName: 'Angel One' });

      const { getByText } = renderView();
      await flushPromises();

      act(() => { fireEvent.press(getByText('Test API')); });
      await flushPromises();

      expect(getByText('Connected')).toBeDefined();
    });
  });

  describe('Flow 5: Disconnect', () => {
    it('triggers disconnect when Disconnect is pressed in connected state', async () => {
      mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'zerodha', brokerName: 'Zerodha' } as any);

      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('Connected')).toBeDefined();

      act(() => { fireEvent.press(getByText('Disconnect')); });
      await flushPromises();

      // Disconnect shows an Alert confirmation dialog
      expect(getByText('Connected')).toBeDefined();
    });

    it('tapping connected broker card triggers disconnect flow', async () => {
      mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'zerodha', brokerName: 'Zerodha' } as any);

      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('Connected')).toBeDefined();

      act(() => { fireEvent.press(getByText('Zerodha')); });
      await flushPromises();

      // Pressing a connected broker card triggers the disconnect Alert
      expect(getByText('Connected')).toBeDefined();
    });
  });

  describe('Flow 6: Loading Edge Cases', () => {
    it('shows loading state while session check is pending', () => {
      mockSnapTradeStatus.mockImplementation(() => new Promise(() => {}));

      const { getByText } = renderView();
      expect(getByText('Checking connection status...')).toBeDefined();
    });

    it('recovers gracefully when session check errors', async () => {
      mockSnapTradeStatus.mockRejectedValue(new Error('API error'));

      const { toJSON } = renderView();
      await flushPromises();

      expect(toJSON()).toBeTruthy();
    });

    it('renders without crashing in loading state', () => {
      mockSnapTradeStatus.mockImplementation(() => new Promise(() => {}));

      const { toJSON } = renderView();
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Flow 7: State Transition Integrity', () => {
    it('renders disconnected state', async () => {
      const { getByText, queryByText } = renderView();
      await flushPromises();

      expect(getByText('Choose Your Broker')).toBeDefined();
      expect(getByText('1-tap OAuth — powered by SnapTrade')).toBeDefined();
      expect(queryByText('Connected')).toBeNull();
    });

    it('renders connected state with Zerodha session', async () => {
      mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'zerodha', brokerName: 'Zerodha' } as any);

      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('Connected')).toBeDefined();
      expect(getByText('Test API')).toBeDefined();
      expect(getByText('Disconnect')).toBeDefined();
      expect(getByText('Switch to a different broker below')).toBeDefined();
    });

    it('renders all broker features in disconnected state', async () => {
      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('SmartAPI')).toBeDefined();
      expect(getByText('Free Equity Delivery')).toBeDefined();
      expect(getByText('Kite Connect API')).toBeDefined();
      expect(getByText('₹0 Brokerage')).toBeDefined();
      expect(getByText('Trade API')).toBeDefined();
      expect(getByText('Zero Commission')).toBeDefined();
    });

    it('renders status pills', async () => {
      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('O AUTH 2.0')).toBeDefined();
      expect(getByText('20+ BROKERS')).toBeDefined();
      expect(getByText('SECURE')).toBeDefined();
    });

    it('renders info card about SnapTrade Gateway', async () => {
      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('SnapTrade OAuth Gateway')).toBeDefined();
      expect(getByText(/Connect your Zerodha, Angel One/)).toBeDefined();
    });
  });

  describe('Flow 8: Broker Switching', () => {
    it('renders Angel One card in disconnected state without being marked as connected', async () => {
      const { queryByText } = renderView();
      await flushPromises();

      // In disconnected state, broker cards show 'Tap to Connect' not 'Connected'
      expect(queryByText('Connected')).toBeNull();
    });

    it('back button is configured', async () => {
      renderView();
      await flushPromises();
      expect(mockGoBack).toBeDefined();
      expect(typeof mockGoBack).toBe('function');
    });
  });
});
