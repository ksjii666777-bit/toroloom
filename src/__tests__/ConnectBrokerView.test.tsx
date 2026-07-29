/**
 * ============================================================================
 * Toroloom — ConnectBrokerView Tests
 * ============================================================================
 *
 * Covers:
 *   - Loading state (initial session check)
 *   - Disconnected state (broker grid, status pills, info card, section title)
 *   - Connected state (connected banner, Test API button, Disconnect)
 *   - Broker card rendering (Angel One, Zerodha, Groww with features)
 *   - Edge cases (no existing session, error during check)
 *   - Back button
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from './testUtils';

// ==================== Mocks ====================

const mockGoBack = vi.fn();

// Hoisted SnapTrade API mocks so per-test overrides work
const mockSnapTradeStatus = vi.hoisted(() => vi.fn(() => Promise.resolve({ connected: false })));
const mockBrokerApiGetHoldings = vi.hoisted(() => vi.fn(() => Promise.resolve({ success: true, data: {} })));

// Mock API services used by the component (snapTradeApi, brokerProxyApi)
vi.mock('../services/api', () => ({
  snapTradeApi: {
    status: mockSnapTradeStatus,
    register: vi.fn(() => Promise.resolve({ success: true })),
    getConnectLink: vi.fn(() => Promise.resolve({ oauthUrl: '' })),
    handleCallback: vi.fn(() => Promise.resolve({ success: true, connection: {} })),
    disconnect: vi.fn(() => Promise.resolve()),
  },
  brokerProxyApi: {
    getHoldings: mockBrokerApiGetHoldings,
  },
}));

// Mock SecureSessionSync — renders a simple View
vi.mock('../components/gateway/SecureSessionSync', () => ({
  default: 'SecureSessionSync',
}));

vi.mock('../components/ui/AnimatedPressable', () => ({
  default: 'AnimatedPressable',
}));

// Mock useT to return English text for brokerConnect keys for brokerConnect keys so existing test assertions work
const brokerConnectTranslations: Record<string, string> = {
  'brokerConnect.title': 'Connect Broker',
  'brokerConnect.subtitle': '1-tap OAuth — powered by SnapTrade',
  'brokerConnect.oAuth': 'O AUTH 2.0',
  'brokerConnect.brokers': '20+ BROKERS',
  'brokerConnect.secure': 'SECURE',
  'brokerConnect.connected': 'Connected',
  'brokerConnect.secureSessionActive': 'Secure Session Active',
  'brokerConnect.testApi': 'Test API',
  'brokerConnect.disconnect': 'Disconnect',
  'brokerConnect.chooseBroker': 'Choose Your Broker',
  'brokerConnect.switchBroker': 'Switch to a different broker below',
  'brokerConnect.selectBroker': 'Select a broker — no API keys needed',
  'brokerConnect.sessionActive': 'Session Active',
  'brokerConnect.oauthConnect': 'OAuth Connect',
  'brokerConnect.tapToConnect': 'Tap to Connect',
  'brokerConnect.snapTradeOauthTitle': 'SnapTrade OAuth Gateway',
  'brokerConnect.snapTradeDesc': 'Connect your Zerodha, Angel One, Dhan, Upstox, Groww, or Interactive Brokers account with 1-tap OAuth. Your credentials are never shared with us.',
  'brokerConnect.checkingStatus': 'Checking connection status...',
};
vi.mock('../hooks/useT', () => ({
  useT: () => ({
    t: (key: string) => brokerConnectTranslations[key] || key,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }),
}));

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

import ConnectBrokerView from '../screens/broker/ConnectBrokerView';

function renderView() {
  return render(<ConnectBrokerView navigation={{ goBack: mockGoBack }} />);
}

/** Flush pending promises so async effects resolve */
async function flushPromises() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no existing session
  mockSnapTradeStatus.mockResolvedValue({ connected: false });
  mockBrokerApiGetHoldings.mockResolvedValue({ success: true, data: {} });
});

// ==================== Tests ====================

describe('ConnectBrokerView — Loading State', () => {
  it('shows loading indicator while checking existing sessions', async () => {
    mockSnapTradeStatus.mockImplementation(() => new Promise(() => {}));

    const { getByText } = renderView();
    expect(getByText('Checking connection status...')).toBeDefined();
  });

  it('shows ActivityIndicator while loading', () => {
    mockSnapTradeStatus.mockImplementation(() => new Promise(() => {}));

    const { toJSON } = renderView();
    expect(toJSON()).toBeTruthy();
  });
});

describe('ConnectBrokerView — Disconnected State', () => {
  beforeEach(() => {
    mockSnapTradeStatus.mockResolvedValue({ connected: false });
  });

  it('renders the screen title', async () => {
    const { getByText } = renderView();
    await flushPromises();
    expect(getByText('Connect Broker')).toBeDefined();
  });

  it('renders the subtitle', async () => {
    const { getByText } = renderView();
    await flushPromises();
    expect(getByText('1-tap OAuth — powered by SnapTrade')).toBeDefined();
  });

  it('renders section title', async () => {
    const { getByText } = renderView();
    await flushPromises();
    expect(getByText('Choose Your Broker')).toBeDefined();
  });

  it('renders section subtitle about no API keys needed', async () => {
    const { getByText } = renderView();
    await flushPromises();
    expect(getByText('Select a broker — no API keys needed')).toBeDefined();
  });

  it('renders all three broker cards (Angel One, Zerodha, Groww)', async () => {
    const { getByText } = renderView();
    await flushPromises();
    expect(getByText('Angel One')).toBeDefined();
    expect(getByText('Zerodha')).toBeDefined();
    expect(getByText('Groww')).toBeDefined();
  });

  it('renders broker taglines', async () => {
    const { getByText } = renderView();
    await flushPromises();
    expect(getByText("India's largest retail broking house")).toBeDefined();
    expect(getByText("India's biggest stock broker")).toBeDefined();
    expect(getByText('Simple, modern investing platform')).toBeDefined();
  });

  it('renders broker features on each card', async () => {
    const { getByText } = renderView();
    await flushPromises();
    expect(getByText('SmartAPI')).toBeDefined();
    expect(getByText('Free Equity Delivery')).toBeDefined();
    expect(getByText('Kite Connect API')).toBeDefined();
    expect(getByText('₹0 Brokerage')).toBeDefined();
    expect(getByText('Trade API')).toBeDefined();
    expect(getByText('Zero Commission')).toBeDefined();
  });

  it('renders status pills (OAuth, Brokers, Secure)', async () => {
    const { getByText } = renderView();
    await flushPromises();
    expect(getByText('O AUTH 2.0')).toBeDefined();
    expect(getByText('20+ BROKERS')).toBeDefined();
    expect(getByText('SECURE')).toBeDefined();
  });

  it('renders the info card about SnapTrade Gateway', async () => {
    const { getByText } = renderView();
    await flushPromises();
    expect(getByText('SnapTrade OAuth Gateway')).toBeDefined();
  });

  it('renders Tap to Connect text when disconnected', async () => {
    const { getByText, queryByText } = renderView();
    await flushPromises();
    // Tap to Connect appears in the connect badge of each broker card
    expect(getByText('Tap to Connect')).toBeDefined();
    expect(queryByText('Connected')).toBeNull();
  });

  it('does NOT render connected banner when disconnected', async () => {
    const { queryByText } = renderView();
    await flushPromises();
    // "Connected" appears in the glass card banner — not present when disconnected
    // Note: "Connected" also appears on Zerodha's broker card as "Connect via OAuth"
    // but the connected banner text specifically is different
    expect(queryByText('Connected')).toBeNull();
  });
});

describe('ConnectBrokerView — Connected State', () => {
  it('renders connected banner when snapTradeApi returns connected', async () => {
    mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'zerodha', brokerName: 'Zerodha' });

    const { getByText } = renderView();
    await flushPromises();
    expect(getByText('Connected')).toBeDefined();
  });

  it('shows broker name in connected banner', async () => {
    mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'zerodha', brokerName: 'Zerodha' });

    const { getByText } = renderView();
    await flushPromises();
    expect(getByText(/Zerodha/)).toBeDefined();
  });

  it('renders Test API button when connected', async () => {
    mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'angel', brokerName: 'Angel One' });

    const { getByText } = renderView();
    await flushPromises();
    expect(getByText('Test API')).toBeDefined();
  });

  it('renders Disconnect button when connected', async () => {
    mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'angel', brokerName: 'Angel One' });

    const { getByText } = renderView();
    await flushPromises();
    expect(getByText('Disconnect')).toBeDefined();
  });

  it('shows "Session Active" on connected broker card', async () => {
    mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'zerodha', brokerName: 'Zerodha' });

    const { getByText } = renderView();
    await flushPromises();
    expect(getByText('Session Active')).toBeDefined();
  });

  it('shows section subtitle asking to switch broker when connected', async () => {
    mockSnapTradeStatus.mockResolvedValue({ connected: true, brokerSlug: 'zerodha', brokerName: 'Zerodha' });

    const { getByText } = renderView();
    await flushPromises();
    expect(getByText('Switch to a different broker below')).toBeDefined();
  });
});

describe('ConnectBrokerView — Edge Cases', () => {
  it('renders without crashing when snapTradeApi.status rejects', async () => {
    mockSnapTradeStatus.mockRejectedValue(new Error('API error'));

    const { toJSON } = renderView();
    await flushPromises();
    expect(toJSON()).toBeTruthy();
  });

  it('renders without crashing when no sessions found', async () => {
    const { toJSON } = renderView();
    await flushPromises();
    expect(toJSON()).toBeTruthy();
  });

  it('renders the info card description', async () => {
    const { getByText } = renderView();
    await flushPromises();
    expect(getByText(/Connect your Zerodha, Angel One/)).toBeDefined();
  });
});
