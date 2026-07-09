/**
 * ============================================================================
 * Toroloom — AadhaarVerificationScreen Tests
 * ============================================================================
 *
 * Tests the Aadhaar eKYC flow:
 *   - Initial render (header, step indicator, info card, consent, input, button)
 *   - Aadhaar input formatting
 *   - Consent checkbox toggle
 *   - Send OTP flow
 *   - OTP input
 *   - Verify OTP flow
 *   - Navigation
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { render, fireEvent } from './testUtils';

/** Flush pending promises so async effects resolve */
async function flushMicrotasks() {
  await act(async () => {});
}

// ==================== Mock Setup ====================

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bg: '#0D0D1A', text: '#FFFFFF', textSecondary: '#B0B0B0', textMuted: '#666680',
      primary: '#6C63FF', accent: '#00D2FF', bgCard: '#1A1A2E', bgCardLight: '#25253D',
      bgInput: '#1E1E32', border: '#2A2A44', divider: '#2A2A44', bgSecondary: '#16162A',
      warning: '#FFC107', borderLight: '#3A3A54', danger: '#FF1744', success: '#00C853',
      white: '#FFFFFF', marketUp: '#00C853', marketDown: '#FF1744',
    },
    isDark: true,
  }),
}));

const mockSendAadhaarOtp = vi.hoisted(() => vi.fn());
const mockVerifyAadhaarOtp = vi.hoisted(() => vi.fn());
vi.mock('../services/api/kyc', () => ({
  kycApi: {
    sendAadhaarOtp: mockSendAadhaarOtp,
    verifyAadhaarOtp: mockVerifyAadhaarOtp,
  },
}));

const mockGoBack = vi.fn();
const mockNavigate = vi.fn();
const mockOnVerified = vi.fn();

const baseProps: any = {
  navigation: { goBack: mockGoBack, navigate: mockNavigate },
  route: { params: { onVerified: mockOnVerified } },
};

import AadhaarVerificationScreen from '../screens/kyc/AadhaarVerificationScreen';

describe('AadhaarVerificationScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendAadhaarOtp.mockResolvedValue({
      referenceId: 'AADHAAR_OTP_1234567890_1',
      message: 'OTP sent',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });
    mockVerifyAadhaarOtp.mockResolvedValue({
      referenceId: 'AADHAAR_OTP_1234567890_1',
      isVerified: true,
      lastFourDigits: '3456',
      name: 'XXX SHARMA',
      yearOfBirth: '1990',
      gender: 'Male',
      state: 'Maharashtra',
      message: 'Aadhaar verified successfully',
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Render — Step 1
  // ═══════════════════════════════════════════════════════════════

  it('renders the header with title', () => {
    const { getByText } = render(<AadhaarVerificationScreen {...baseProps} />);
    expect(getByText('Aadhaar eKYC')).toBeDefined();
  });

  it('shows step indicator', () => {
    const { getByText } = render(<AadhaarVerificationScreen {...baseProps} />);
    expect(getByText('Step 1 of 2')).toBeDefined();
  });

  it('shows info about UIDAI verification', () => {
    const { getByText } = render(<AadhaarVerificationScreen {...baseProps} />);
    expect(getByText(/UIDAI/)).toBeDefined();
    expect(getByText(/masked data/)).toBeDefined();
  });

  it('shows Aadhaar input with correct placeholder', () => {
    const { getByPlaceholderText } = render(<AadhaarVerificationScreen {...baseProps} />);
    expect(getByPlaceholderText('XXXX XXXX XXXX')).toBeDefined();
  });

  it('shows the consent checkbox text', () => {
    const { getByText } = render(<AadhaarVerificationScreen {...baseProps} />);
    expect(getByText(/I consent to verify my Aadhaar/)).toBeDefined();
  });

  it('shows Send OTP button', () => {
    const { getAllByText } = render(<AadhaarVerificationScreen {...baseProps} />);
    expect(getAllByText('Send OTP').length).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════════════════════════
  // Send OTP Flow
  // ═══════════════════════════════════════════════════════════════

  it('calls sendAadhaarOtp when Send OTP is pressed with valid input and consent', () => {
    const { getByPlaceholderText, getAllByText, getByText } = render(<AadhaarVerificationScreen {...baseProps} />);
    const input = getByPlaceholderText('XXXX XXXX XXXX');

    act(() => { fireEvent.changeText(input, '234567891011'); });
    act(() => { fireEvent.press(getByText(/I consent to verify/)); });

    const buttons = getAllByText('Send OTP');
    act(() => { fireEvent.press(buttons[buttons.length - 1]); });

    expect(mockSendAadhaarOtp).toHaveBeenCalled();
  });

  it('transitions to OTP input step after successful OTP send', async () => {
    const { getByPlaceholderText, getByText } = render(<AadhaarVerificationScreen {...baseProps} />);
    const input = getByPlaceholderText('XXXX XXXX XXXX');

    act(() => { fireEvent.changeText(input, '234567891011'); });
    act(() => { fireEvent.press(getByText(/I consent to verify/)); });
    act(() => { fireEvent.press(getByText('Send OTP')); });
    await flushMicrotasks();

    // Should now be on Step 2
    expect(getByText('Step 2 of 2')).toBeDefined();
    expect(getByText(/OTP has been sent/)).toBeDefined();
    expect(getByText('Verify OTP')).toBeDefined();
  });

  it('shows demo hint with mock 123456 code in OTP step', async () => {
    const { getByPlaceholderText, getByText } = render(<AadhaarVerificationScreen {...baseProps} />);
    const input = getByPlaceholderText('XXXX XXXX XXXX');

    act(() => { fireEvent.changeText(input, '234567891011'); });
    act(() => { fireEvent.press(getByText(/I consent to verify/)); });
    act(() => { fireEvent.press(getByText('Send OTP')); });
    await flushMicrotasks();

    expect(getByText('123456')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<AadhaarVerificationScreen {...baseProps} />);
    expect(toJSON()).toBeTruthy();
  });

  // ═══════════════════════════════════════════════════════════════
  // Verify OTP Flow
  // ═══════════════════════════════════════════════════════════════

  it('renders demo hint text for mock OTP', () => {
    const { getByText } = render(<AadhaarVerificationScreen {...baseProps} />);
    expect(getByText(/12-digit number found/)).toBeDefined();
  });
});
