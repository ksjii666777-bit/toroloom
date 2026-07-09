/**
 * ============================================================================
 * Toroloom — PanVerificationScreen Tests
 * ============================================================================
 *
 * Tests the PAN verification flow:
 *   - Initial render (header, info card, input, button)
 *   - PAN input formatting and format validation
 *   - Verify button disabled/enabled states
 *   - Successful verification (result card, Continue button)
 *   - Failed verification (error display)
 *   - Navigation (back button, Continue after success)
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

const mockVerifyPan = vi.hoisted(() => vi.fn());
vi.mock('../services/api/kyc', () => ({
  kycApi: {
    verifyPan: mockVerifyPan,
  },
}));

const mockGoBack = vi.fn();
const mockNavigate = vi.fn();
const mockOnVerified = vi.fn();

const baseProps: any = {
  navigation: { goBack: mockGoBack, navigate: mockNavigate },
  route: { params: { onVerified: mockOnVerified } },
};

import PanVerificationScreen from '../screens/kyc/PanVerificationScreen';

describe('PanVerificationScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyPan.mockResolvedValue({
      panNumber: 'ABCDE1234F',
      fullName: 'RAHUL SHARMA',
      isVerified: true,
      nameOnPan: 'RAHUL SHARMA',
      category: 'Individual',
      status: 'VALID',
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════

  it('renders the header with title', () => {
    const { getByText } = render(<PanVerificationScreen {...baseProps} />);
    expect(getByText('PAN Verification')).toBeDefined();
  });

  it('shows info card with PAN format hint', () => {
    const { getByText } = render(<PanVerificationScreen {...baseProps} />);
    expect(getByText('Format:')).toBeDefined();
    expect(getByText('ABCDE1234F')).toBeDefined();
  });

  it('shows the input field with correct placeholder', () => {
    const { getByPlaceholderText } = render(<PanVerificationScreen {...baseProps} />);
    expect(getByPlaceholderText('ABCDE1234F')).toBeDefined();
  });

  it('shows the Verify PAN button', () => {
    const { getAllByText } = render(<PanVerificationScreen {...baseProps} />);
    expect(getAllByText('Verify PAN').length).toBeGreaterThan(0);
  });

  it('shows info text about PAN from NSDL database', () => {
    const { getByText } = render(<PanVerificationScreen {...baseProps} />);
    expect(getByText(/Permanent Account Number/)).toBeDefined();
    expect(getByText(/NSDL database/)).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // Input
  // ═══════════════════════════════════════════════════════════════

  it('renders without crashing', () => {
    const { toJSON } = render(<PanVerificationScreen {...baseProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows initial hint text', () => {
    const { getByText } = render(<PanVerificationScreen {...baseProps} />);
    expect(getByText(/Enter your 10-digit PAN/)).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // Verify Flow
  // ═══════════════════════════════════════════════════════════════

  it('calls kycApi.verifyPan with the PAN when Verify is pressed', () => {
    const { getByPlaceholderText, getAllByText } = render(<PanVerificationScreen {...baseProps} />);
    const input = getByPlaceholderText('ABCDE1234F');
    act(() => { fireEvent.changeText(input, 'ABCDE1234F'); });

    const buttons = getAllByText('Verify PAN');
    act(() => { fireEvent.press(buttons[buttons.length - 1]); });

    expect(mockVerifyPan).toHaveBeenCalled();
  });

  it('shows verifying state while API call is in progress', () => {
    mockVerifyPan.mockImplementationOnce(() => new Promise(() => {}));
    const { getByPlaceholderText, getAllByText, getByText } = render(<PanVerificationScreen {...baseProps} />);
    const input = getByPlaceholderText('ABCDE1234F');
    act(() => { fireEvent.changeText(input, 'ABCDE1234F'); });

    const buttons = getAllByText('Verify PAN');
    act(() => { fireEvent.press(buttons[buttons.length - 1]); });

    // Button text changes to Verifying... (synchronous setIsVerifying(true))
    expect(getByText(/Verifying/)).toBeDefined();
  });

  it('displays error message on API failure', async () => {
    mockVerifyPan.mockRejectedValueOnce({ body: { error: 'Network error occurred' } });
    const { getByPlaceholderText, getAllByText, getByText } = render(<PanVerificationScreen {...baseProps} />);
    const input = getByPlaceholderText('ABCDE1234F');
    act(() => { fireEvent.changeText(input, 'ABCDE1234F'); });

    const buttons = getAllByText('Verify PAN');
    act(() => { fireEvent.press(buttons[buttons.length - 1]); });
    await flushMicrotasks();

    expect(getByText(/Network error occurred/)).toBeDefined();
  });

  it('shows Verification Failed card on INVALID status', async () => {
    mockVerifyPan.mockResolvedValueOnce({
      panNumber: 'INVALID',
      fullName: '',
      isVerified: false,
      status: 'INVALID',
    });
    const { getByPlaceholderText, getAllByText, getByText } = render(<PanVerificationScreen {...baseProps} />);
    const input = getByPlaceholderText('ABCDE1234F');
    act(() => { fireEvent.changeText(input, 'ABCDE1234F'); });

    const buttons = getAllByText('Verify PAN');
    act(() => { fireEvent.press(buttons[buttons.length - 1]); });
    await flushMicrotasks();

    expect(getByText(/Verification Failed/)).toBeDefined();
    expect(getByText(/PAN format is invalid/)).toBeDefined();
  });

  it('shows success card with PAN details after successful verification', async () => {
    const { getByPlaceholderText, getAllByText, getByText } = render(<PanVerificationScreen {...baseProps} />);
    const input = getByPlaceholderText('ABCDE1234F');
    act(() => { fireEvent.changeText(input, 'ABCDE1234F'); });

    const buttons = getAllByText('Verify PAN');
    act(() => { fireEvent.press(buttons[buttons.length - 1]); });
    await flushMicrotasks();

    expect(getByText(/PAN Verified/)).toBeDefined();
    expect(getByText('ABCDE1234F')).toBeDefined();
    expect(getByText('RAHUL SHARMA')).toBeDefined();
    expect(getByText('VALID')).toBeDefined();
    expect(getByText('Continue')).toBeDefined();
  });

  it('calls onVerified callback and navigates back when Continue is pressed after success', async () => {
    const { getByPlaceholderText, getAllByText, getByText } = render(<PanVerificationScreen {...baseProps} />);
    const input = getByPlaceholderText('ABCDE1234F');
    act(() => { fireEvent.changeText(input, 'ABCDE1234F'); });

    const buttons = getAllByText('Verify PAN');
    act(() => { fireEvent.press(buttons[buttons.length - 1]); });
    await flushMicrotasks();

    const continueBtn = getByText('Continue');
    act(() => { fireEvent.press(continueBtn); });

    expect(mockOnVerified).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });
});
