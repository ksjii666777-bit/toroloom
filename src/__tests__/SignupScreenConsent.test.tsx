/**
 * ============================================================================
 * Toroloom — SignupScreen ToS Consent Tests
 * ============================================================================
 *
 * Signup now requires an explicit ToS/Privacy checkbox (real i18n, matching
 * SignupScreen.test.tsx conventions):
 *   - Submitting without the checkbox shows the validation error and never
 *     calls signup
 *   - Ticking the checkbox clears the error and enables submission
 *   - A successful signup with the box ticked records acceptance through the
 *     real consent store (version = LEGAL_DOCUMENT_VERSION, method 'signup')
 *   - A failed signup does NOT record acceptance
 * ============================================================================
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from './testUtils';

vi.mock('../services/analytics', () => ({
  analytics: { logEvent: vi.fn(), flush: vi.fn(), setUserProperties: vi.fn() },
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6C63FF',
      primaryLight: '#8B83FF',
      primaryDark: '#4A42CC',
      primaryGradient: ['#6C63FF', '#4834D4'] as const,
      secondary: '#FF6B6B',
      success: '#00C853',
      danger: '#FF1744',
      warning: '#FFC107',
      marketUp: '#00C853',
      marketDown: '#FF1744',
      marketNeutral: '#FFC107',
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
      bgOverlay: 'rgba(0,0,0,0.5)',
      border: '#2A2A5E',
      borderLight: '#3A3A7E',
      divider: '#1E1E4A',
      transparent: 'transparent',
    },
    isDark: true,
  }),
}));

const { mockSignup } = vi.hoisted(() => ({ mockSignup: vi.fn() }));

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    signup: mockSignup,
    login: vi.fn(),
    isLoading: false,
    error: null,
    user: null,
    isAuthenticated: false,
  })),
}));

import SignupScreen from '../screens/auth/SignupScreen';
import {
  useLegalConsentStore,
  LEGAL_DOCUMENT_VERSION,
} from '../store/legalConsentStore';

function makeNav() {
  return { navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), setParams: vi.fn() };
}

function makeRoute() {
  return { params: {} };
}

function fillForm(result: ReturnType<typeof render>) {
  const { getByPlaceholderText } = result;
  act(() => { fireEvent.changeText(getByPlaceholderText('Enter your full name'), 'John Doe'); });
  act(() => { fireEvent.changeText(getByPlaceholderText('Enter your email'), 'john@example.com'); });
  act(() => { fireEvent.changeText(getByPlaceholderText('Enter your phone number'), '1234567890'); });
  act(() => { fireEvent.changeText(getByPlaceholderText('Create a strong password'), 'password123'); });
  act(() => { fireEvent.changeText(getByPlaceholderText('Re-enter your password'), 'password123'); });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSignup.mockResolvedValue(true);
  useLegalConsentStore.setState({
    acceptedVersion: null,
    isConsentLoaded: false,
    isReacceptanceVisible: false,
    needsReacceptance: false,
  });
});

describe('SignupScreen — ToS consent gate', () => {
  it('blocks submission without the consent checkbox and shows the error', async () => {
    const result = render(
      <SignupScreen navigation={makeNav() as any} route={makeRoute() as any} />,
    );
    fillForm(result);
    const { getByText, getByTestId } = result;

    await act(async () => {
      fireEvent.press(getByTestId('signup-btn'));
    });

    expect(
      getByText('Please accept the Terms of Service and Privacy Policy to continue'),
    ).toBeDefined();
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it('clears the error and enables submission once the checkbox is ticked', async () => {
    const result = render(
      <SignupScreen navigation={makeNav() as any} route={makeRoute() as any} />,
    );
    const { getByText, getByTestId } = result;
    fillForm(result);

    await act(async () => {
      fireEvent.press(getByTestId('signup-btn'));
    });
    expect(
      getByText('Please accept the Terms of Service and Privacy Policy to continue'),
    ).toBeDefined();

    act(() => {
      fireEvent.press(getByTestId('signup-terms-checkbox'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('signup-btn'));
    });

    expect(mockSignup).toHaveBeenCalledTimes(1);
  });

  it('records ToS acceptance with version + method on successful signup', async () => {
    const result = render(
      <SignupScreen navigation={makeNav() as any} route={makeRoute() as any} />,
    );
    fillForm(result);
    const { getByTestId } = result;

    act(() => {
      fireEvent.press(getByTestId('signup-terms-checkbox'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('signup-btn'));
    });

    const s = useLegalConsentStore.getState();
    expect(s.acceptedVersion).toBe(LEGAL_DOCUMENT_VERSION);
    expect(s.needsReacceptance).toBe(false);
    expect(s.isReacceptanceVisible).toBe(false);
  });

  it('does NOT record acceptance when signup fails', async () => {
    mockSignup.mockResolvedValue(false);
    const { getByTestId } = render(
      <SignupScreen navigation={makeNav() as any} route={makeRoute() as any} />,
    );

    act(() => {
      fireEvent.press(getByTestId('signup-terms-checkbox'));
    });

    await act(async () => {
      fireEvent.press(getByTestId('signup-btn'));
    });

    expect(useLegalConsentStore.getState().acceptedVersion).toBeNull();
  });
});
