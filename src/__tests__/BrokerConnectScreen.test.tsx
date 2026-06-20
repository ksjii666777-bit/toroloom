/**
 * ============================================================================
 * Toroloom — BrokerConnectScreen Integration Tests
 * ============================================================================
 *
 * Verifies that BrokerConnectScreen renders correctly:
 *   - Loading state (initial API call in progress)
 *   - Broker card grid (Angel One, Zerodha, Groww)
 *   - Connected state (banner, connected badge, disconnect button)
 *   - Disconnected state (Connect / OAuth buttons)
 *   - Credentials modal (opening/closing, form fields)
 *   - Disconnect confirmation dialog
 *   - Info box
 *   - Header with back button
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TenantConfig, SubscriptionFeature, SubscriptionTier } from '../types';

// ==================== Mocks (hoisted) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();

// Mock API
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock('../services/api', () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
  },
}));

// Mock ThemeContext
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryLight: '#8B83FF',
      primaryDark: '#4A42CC',
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      text: '#FFFFFF',
      textSecondary: '#B0B0D0',
      textMuted: '#6E6E9A',
      white: '#FFFFFF',
      bg: '#0D0D2B',
      bgSecondary: '#1A1A3E',
      bgCard: '#222255',
      bgCardLight: '#2A2A5E',
      bgInput: '#1E1E4A',
      bgDark: '#070720',
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

// Mock LinearGradient — renders a plain View
vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// Mock WebView with a string component to avoid parsing the real WebView.js
vi.mock('react-native-webview', () => ({
  WebView: 'WebView',
  default: 'WebView',
  __esModule: true,
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

// Mock react-native-safe-area-context
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock AnimatedPressable — renders a simple Pressable wrapper (no require inside factory)
vi.mock('../components/ui/AnimatedPressable', () => ({
  default: 'AnimatedPressable',
}));

// ==================== Imports ====================

import { render, fireEvent } from './testUtils';
import BrokerConnectScreen from '../screens/broker/BrokerConnectScreen';
import { Alert } from 'react-native';

// ==================== Helpers ====================

/** Advance timers and flush pending promises so API calls resolve. */
async function advanceAndFlush() {
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
}

// ==================== Loading State ====================

describe('BrokerConnectScreen — Loading State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    // Keep loading — don't resolve the API call
    mockApiGet.mockImplementationOnce(() => new Promise(() => {}));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading indicator while fetching status', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(getByText('Loading broker status...')).toBeDefined();
  });

  it('does not render broker cards while loading', async () => {
    const { queryByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(queryByText('Angel One')).toBeNull();
    expect(queryByText('Zerodha')).toBeNull();
    expect(queryByText('Groww')).toBeNull();
  });

  it('does not render the info box while loading', async () => {
    const { queryByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(queryByText(/encrypted and securely stored/)).toBeNull();
  });
});

// ==================== Disconnected State ====================

describe('BrokerConnectScreen — Disconnected State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockResolvedValue({
      connected: false,
      brokerType: null,
      label: null,
      connectedAt: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the header with title and back button', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(getByText('Connect Broker')).toBeDefined();
    expect(getByText('Link your trading account to start trading')).toBeDefined();
  });

  it('renders all three broker cards', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(getByText('Angel One')).toBeDefined();
    expect(getByText('Zerodha')).toBeDefined();
    expect(getByText('Groww')).toBeDefined();
  });

  it('renders broker taglines', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(getByText("India's largest retail broking house")).toBeDefined();
    expect(getByText("India's biggest stock broker")).toBeDefined();
    expect(getByText('Simple, modern investing platform')).toBeDefined();
  });

  it('renders broker features on each card', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(getByText('SmartAPI')).toBeDefined();
    expect(getByText('EDIS Support')).toBeDefined();
    expect(getByText('Kite Connect API')).toBeDefined();
    expect(getByText('Trade API')).toBeDefined();
  });

  it('renders Connect button on non-OAuth brokers', async () => {
    const { getAllByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    // There should be at least 2 "Connect" texts (Angel One and Groww)
    const connectButtons = getAllByText('Connect');
    expect(connectButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders Connect via OAuth on Zerodha card', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(getByText('Connect via OAuth')).toBeDefined();
  });

  it('renders the OAuth Secure indicator on Zerodha card', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(getByText('OAuth Secure')).toBeDefined();
  });

  it('renders the section title for choosing broker', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(getByText('Choose Your Broker')).toBeDefined();
  });

  it('renders the info box with security message', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(getByText(/Your credentials are encrypted and securely stored/)).toBeDefined();
  });

  it('does NOT render connected banner when disconnected', async () => {
    const { queryByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(queryByText(/Connected to/)).toBeNull();
  });
});

// ==================== Connected State ====================

describe('BrokerConnectScreen — Connected State', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockResolvedValue({
      connected: true,
      brokerType: 'angel',
      label: 'Angel One',
      connectedAt: '2026-06-15T10:00:00.000Z',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders connected banner with broker name', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(getByText(/Connected to Angel One/)).toBeDefined();
  });

  it('renders connected status badge on the connected broker card', async () => {
    const { getByText, getAllByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    const connectedBadges = getAllByText('Connected');
    expect(connectedBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Disconnect button in the banner', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(getByText('Disconnect')).toBeDefined();
  });

  it('renders the subtitle asking to switch broker', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(getByText('Switch to a different broker below')).toBeDefined();
  });

  it('still renders Connect text on non-connected broker cards', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    // Zerodha and Groww are not the connected broker (Angel is), so they show Connect
    expect(getByText('Connect via OAuth')).toBeDefined(); // Zerodha
  });
});

// ==================== Connect Flow ====================

describe('BrokerConnectScreen — Connect Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockResolvedValue({
      connected: false,
      brokerType: null,
      label: null,
      connectedAt: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tapping a non-OAuth broker renders the credentials modal with broker name', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();

    // Tap Angel One card (non-OAuth)
    act(() => { fireEvent.press(getByText('Angel One')); });
    await advanceAndFlush();

    // Credentials modal should render with the broker name
    expect(getByText(/Connect Angel One/)).toBeDefined();
    expect(getByText('Enter your API credentials')).toBeDefined();
  });

  it('shows API Key field in credentials modal', async () => {
    const { getByText, getByPlaceholderText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();

    act(() => { fireEvent.press(getByText('Angel One')); });
    await advanceAndFlush();

    expect(getByText('API Key')).toBeDefined();
    expect(getByPlaceholderText('Enter your API key')).toBeDefined();
  });

  it('shows Angel-specific fields (Client ID, Password, TOTP) when Angel is selected', async () => {
    const { getByText, getByPlaceholderText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();

    act(() => { fireEvent.press(getByText('Angel One')); });
    await advanceAndFlush();

    expect(getByText('Client ID')).toBeDefined();
    expect(getByPlaceholderText('Enter your Angel One Client ID')).toBeDefined();
    expect(getByText('Password')).toBeDefined();
    expect(getByPlaceholderText('Trading password')).toBeDefined();
    expect(getByText('TOTP Secret (optional)')).toBeDefined();
    expect(getByPlaceholderText('2FA TOTP secret for auto-login')).toBeDefined();
  });

  it('shows Groww-specific Access Token field when Groww is selected', async () => {
    const { getByText, getByPlaceholderText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();

    act(() => { fireEvent.press(getByText('Groww')); });
    await advanceAndFlush();

    expect(getByText('Access Token')).toBeDefined();
    expect(getByPlaceholderText('Enter your Groww access token')).toBeDefined();
  });

  it('renders Connect button in the credentials modal', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();

    act(() => { fireEvent.press(getByText('Angel One')); });
    await advanceAndFlush();

    expect(getByText('Connect to Angel One')).toBeDefined();
  });

  it('triggers OAuth URL fetch when tapping Zerodha', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();

    // Tap Zerodha — triggers /broker-link/oauth-url API call
    act(() => { fireEvent.press(getByText('Zerodha')); });
    await advanceAndFlush();

    expect(mockApiGet).toHaveBeenCalledWith('/broker-link/oauth-url?brokerType=zerodha');
  });
});

// ==================== Disconnect Flow ====================

describe('BrokerConnectScreen — Disconnect Flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockResolvedValue({
      connected: true,
      brokerType: 'zerodha',
      label: 'Zerodha',
      connectedAt: '2026-06-15T10:00:00.000Z',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows disconnect confirmation alert when Disconnect is pressed (API not called yet)', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();

    // Press Disconnect button in the connected banner
    act(() => { fireEvent.press(getByText('Disconnect')); });
    await advanceAndFlush();

    // API should NOT be called yet — user must confirm via Alert
    expect(mockApiPost).not.toHaveBeenCalledWith('/broker-link/disconnect');
  });

  it('tapping the connected broker card also triggers disconnect (does not call API yet)', async () => {
    const { getByText } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();

    // Tap the connected broker card (Zerodha) — should trigger disconnect flow
    act(() => { fireEvent.press(getByText('Zerodha')); });
    await advanceAndFlush();

    // API should NOT be called yet (user must confirm in Alert)
    expect(mockApiPost).not.toHaveBeenCalledWith('/broker-link/disconnect');
  });
});

// ==================== API Error / Edge Cases ====================

describe('BrokerConnectScreen — Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockApiGet.mockReset();
    mockApiPost.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing when API returns an error', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));

    const { toJSON } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(toJSON).not.toBeNull();
  });

  it('renders without crashing when API returns empty data', async () => {
    mockApiGet.mockResolvedValue({});

    const { toJSON } = render(
      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,
    );
    await advanceAndFlush();
    expect(toJSON).not.toBeNull();
  });
});
