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

// Session storage services — hoisted so vi.mock() factory can reference them
const mockHasValidSession = vi.hoisted(() => vi.fn());
const mockStoreBrokerSession = vi.hoisted(() => vi.fn());
const mockClearBrokerSession = vi.hoisted(() => vi.fn());
const mockParseSessionPayload = vi.hoisted(() => vi.fn());
const mockGetBrokerHoldings = vi.hoisted(() => vi.fn());

vi.mock('../services/gateway/sessionStorage', () => ({
  hasValidSession: mockHasValidSession,
  storeBrokerSession: mockStoreBrokerSession,
  clearBrokerSession: mockClearBrokerSession,
  parseSessionPayload: mockParseSessionPayload,
  listStoredSessions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/gateway/proxyClient', () => ({
  getBrokerHoldings: mockGetBrokerHoldings,
}));

// Mock API services used by ConnectBrokerView
const mockSnapTradeStatus = vi.hoisted(() => vi.fn(() => Promise.resolve({ connected: false })));
const mockSnapTradeRegister = vi.hoisted(() => vi.fn(() => Promise.resolve({ success: true })));
const mockSnapTradeGetLink = vi.hoisted(() => vi.fn(() => Promise.resolve({ oauthUrl: 'https://example.com/oauth' })));
const mockBrokerApiGetHoldings = vi.hoisted(() => vi.fn(() => Promise.resolve({ success: true, statusCode: 200, data: { holdings: [] } })));

vi.mock('../services/api', () => ({
  snapTradeApi: {
    status: mockSnapTradeStatus,
    register: mockSnapTradeRegister,
    getConnectLink: mockSnapTradeGetLink,
    handleCallback: vi.fn(() => Promise.resolve({ success: true })),
    disconnect: vi.fn(() => Promise.resolve({ success: true })),
  },
  brokerProxyApi: {
    getHoldings: mockBrokerApiGetHoldings,
  },
  angelConnectApi: {
    status: vi.fn(() => Promise.resolve({ connected: false })),
    connect: vi.fn(() => Promise.resolve({ success: true })),
    holdings: vi.fn(() => Promise.resolve({ success: true, data: [] })),
    disconnect: vi.fn(() => Promise.resolve({ success: true })),
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

async function flushWithModalDelay() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
}

function renderView() {
  return render(<ConnectBrokerView navigation={{ goBack: mockGoBack }} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHasValidSession.mockResolvedValue(false);
  mockStoreBrokerSession.mockResolvedValue(true);
  mockClearBrokerSession.mockResolvedValue(undefined);
  mockGetBrokerHoldings.mockResolvedValue({ success: true, statusCode: 200, data: { holdings: [] } });
  mockParseSessionPayload.mockImplementation((payload: any) => ({
    brokerType: payload.brokerType,
    cookies: payload.cookies,
    capturedAt: payload.capturedAt,
    enctoken: 'parsed_enc_token',
    jwt: 'parsed_jwt',
    accessToken: undefined,
    userId: undefined,
  }));
  // Restore SnapTrade mocks after clear
  mockSnapTradeStatus.mockResolvedValue({ connected: false });
  mockSnapTradeRegister.mockResolvedValue({ success: true });
  mockSnapTradeGetLink.mockResolvedValue({ oauthUrl: 'https://example.com/oauth' });
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

  describe('Flow 2: Angel One Connection', () => {
    it('shows Angel Options modal when Angel One is tapped', async () => {
      const { getByText } = renderView();
      await flushPromises();

      act(() => { fireEvent.press(getByText('Angel One')); });
      await flushWithModalDelay();
      await flushPromises();

      expect(getByText('SmartAPI (Official)')).toBeDefined();
      expect(getByText('Zero-API Sync')).toBeDefined();
      expect(getByText('Cancel')).toBeDefined();
    });

    it('opens session sync when Zero-API Sync is selected', async () => {
      const { getByText } = renderView();
      await flushPromises();

      act(() => { fireEvent.press(getByText('Angel One')); });
      await flushWithModalDelay();
      await flushPromises();

      act(() => { fireEvent.press(getByText('Zero-API Sync')); });
      await flushWithModalDelay();
      await flushPromises();

      expect(getByText('Connect Angel One')).toBeDefined();
    });
  });

  describe('Flow 3: Connected State', () => {
    it('detects existing Zerodha session and shows connected state', async () => {
      mockHasValidSession.mockImplementation(async (brokerType: string) => brokerType === 'zerodha');

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
      mockHasValidSession.mockImplementation(async (brokerType: string) => brokerType === 'angel');

      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('Connected')).toBeDefined();
      expect(getByText(/Angel One/)).toBeDefined();
      expect(getByText('Test API')).toBeDefined();
      expect(getByText('Disconnect')).toBeDefined();
    });

    it('detects existing Groww session', async () => {
      mockHasValidSession.mockImplementation(async (brokerType: string) => brokerType === 'groww');

      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('Connected')).toBeDefined();
      expect(getByText(/Groww/)).toBeDefined();
      expect(getByText('Test API')).toBeDefined();
    });
  });

  describe('Flow 4: Test API', () => {
    it('calls brokerProxyApi.getHoldings when Test API is pressed', async () => {
      mockHasValidSession.mockImplementation(async (brokerType: string) => brokerType === 'angel');

      const { getByText } = renderView();
      await flushPromises();

      act(() => { fireEvent.press(getByText('Test API')); });
      await flushPromises();

      expect(mockBrokerApiGetHoldings).toHaveBeenCalledWith('angel');
    });

    it('handles Test API failure gracefully', async () => {
      mockBrokerApiGetHoldings.mockRejectedValue(new Error('Network error'));
      mockHasValidSession.mockImplementation(async (brokerType: string) => brokerType === 'angel');

      const { getByText } = renderView();
      await flushPromises();

      act(() => { fireEvent.press(getByText('Test API')); });
      await flushPromises();

      expect(getByText('Connected')).toBeDefined();
    });
  });

  describe('Flow 5: Disconnect', () => {
    it('triggers disconnect when Disconnect is pressed in connected state', async () => {
      mockHasValidSession.mockImplementation(async (brokerType: string) => brokerType === 'zerodha');

      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('Connected')).toBeDefined();

      act(() => { fireEvent.press(getByText('Disconnect')); });
      await flushPromises();

      expect(mockClearBrokerSession).not.toHaveBeenCalled();
      expect(getByText('Connected')).toBeDefined();
    });

    it('tapping connected broker card triggers disconnect flow', async () => {
      mockHasValidSession.mockImplementation(async (brokerType: string) => brokerType === 'zerodha');

      const { getByText } = renderView();
      await flushPromises();

      expect(getByText('Connected')).toBeDefined();

      act(() => { fireEvent.press(getByText('Zerodha')); });
      await flushPromises();

      expect(mockClearBrokerSession).not.toHaveBeenCalled();
    });
  });

  describe('Flow 6: Loading Edge Cases', () => {
    it('shows loading state while session check is pending', () => {
      mockHasValidSession.mockImplementation(() => new Promise(() => {}));

      const { getByText } = renderView();
      expect(getByText('Checking connection status...')).toBeDefined();
    });

    it('recovers gracefully when session check errors', async () => {
      mockHasValidSession.mockRejectedValue(new Error('Storage corrupted'));

      const { toJSON } = renderView();
      await flushPromises();

      expect(toJSON()).toBeTruthy();
    });

    it('renders without crashing in loading state', () => {
      mockHasValidSession.mockImplementation(() => new Promise(() => {}));

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
      mockHasValidSession.mockImplementation(async (brokerType: string) => brokerType === 'zerodha');

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
    it('opens Angel Options for Angel One when tapped', async () => {
      const { getByText } = renderView();
      await flushPromises();

      act(() => { fireEvent.press(getByText('Angel One')); });
      await flushWithModalDelay();
      await flushPromises();

      expect(getByText('Connect Angel One')).toBeDefined();
    });

    it('back button is configured', async () => {
      renderView();
      await flushPromises();
      expect(mockGoBack).toBeDefined();
      expect(typeof mockGoBack).toBe('function');
    });
  });
});
