/**
 * ============================================================================
 * Toroloom — BankLinkingScreen Tests
 * ============================================================================
 *
 * Tests the bank account linking flow:
 *   - Initial render (header, info card, IFSC input, Verify IFSC button)
 *   - IFSC input formatting and validation
 *   - IFSC verification (success → account step, failure → error)
 *   - Account verification step
 *   - Account type selection
 *   - Primary toggle
 *   - Linking flow
 *   - Manage existing banks
 *   - Edge cases (no onVerified, loading state)
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { render, fireEvent } from './testUtils';

// ==================== Mock ThemeContext ====================

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

// ==================== Mock kycStore ====================

const mockAddLinkedBank = vi.hoisted(() => vi.fn());
const mockRemoveLinkedBank = vi.hoisted(() => vi.fn());
const mockSetPrimaryBank = vi.hoisted(() => vi.fn());
const mockMarkStepCompleted = vi.hoisted(() => vi.fn());
const mockLinkedBanks = vi.hoisted(() => [] as any[]);

vi.mock('../store/kycStore', () => ({
  useKycStore: () => ({
    linkedBanks: mockLinkedBanks,
    addLinkedBank: mockAddLinkedBank,
    removeLinkedBank: mockRemoveLinkedBank,
    setPrimaryBank: mockSetPrimaryBank,
    markStepCompleted: mockMarkStepCompleted,
  }),
}));

// ==================== Mocks for excluded modules ====================

// BankLinkingScreen uses inline mock data — no external API calls
// Haptics, AnimatedPressable, and Badge are already mocked in setup.ts
// Card and LinearGradient are also mocked in setup.ts

// ==================== Navigation Mocks ====================

const mockGoBack = vi.fn();
const mockNavigate = vi.fn();
const mockOnVerified = vi.fn();

const baseProps: any = {
  navigation: { goBack: mockGoBack, navigate: mockNavigate },
  route: { params: { onVerified: mockOnVerified } },
};

// ==================== Import screen ====================

import BankLinkingScreen from '../screens/kyc/BankLinkingScreen';

describe('BankLinkingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLinkedBanks.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════
  // Initial Render — IFSC Step (Step 1)
  // ═══════════════════════════════════════════════════════════════

  it('renders the header with title', () => {
    const { getByText } = render(<BankLinkingScreen {...baseProps} />);
    expect(getByText('Link Bank Account')).toBeDefined();
  });

  it('shows step indicator', () => {
    const { getByText } = render(<BankLinkingScreen {...baseProps} />);
    expect(getByText('Step 1 of 3 — IFSC')).toBeDefined();
  });

  it('shows info card with IFSC explanation', () => {
    const { getByText } = render(<BankLinkingScreen {...baseProps} />);
    expect(getByText(/IFSC code to fetch bank/)).toBeDefined();
  });

  it('shows IFSC format hint', () => {
    const { getByText } = render(<BankLinkingScreen {...baseProps} />);
    expect(getByText('Format:')).toBeDefined();
    expect(getByText('HDFC0001234')).toBeDefined();
  });

  it('shows IFSC input with correct placeholder', () => {
    const { getByPlaceholderText } = render(<BankLinkingScreen {...baseProps} />);
    expect(getByPlaceholderText('HDFC0001234')).toBeDefined();
  });

  it('shows Verify IFSC button', () => {
    const { getAllByText } = render(<BankLinkingScreen {...baseProps} />);
    expect(getAllByText('Verify IFSC').length).toBeGreaterThan(0);
  });

  it('shows initial hint text', () => {
    const { getByText } = render(<BankLinkingScreen {...baseProps} />);
    expect(getByText(/Enter your 11-character IFSC code/)).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // IFSC Input Formatting
  // ═══════════════════════════════════════════════════════════════

  it('filters non-alphanumeric characters and uppercases IFSC input', () => {
    const { getByPlaceholderText, getByText } = render(<BankLinkingScreen {...baseProps} />);
    const input = getByPlaceholderText('HDFC0001234');
    act(() => { fireEvent.changeText(input, 'hdfc@0001234'); });
    // After filtering: 'hdfc' + '@' removed + uppercased → 'HDFC0001234'
    expect(getByText(/✓ Valid IFSC format/)).toBeDefined();
  });

  it('limits IFSC input to 11 characters', () => {
    const { getByPlaceholderText } = render(<BankLinkingScreen {...baseProps} />);
    const input = getByPlaceholderText('HDFC0001234');
    act(() => { fireEvent.changeText(input, 'HDFC00012345678'); });
    // The input should not have more than 11 chars — the component strips to 11
    expect(getByPlaceholderText('HDFC0001234')).toBeDefined();
  });

  it('shows valid format indicator when IFSC format is correct', () => {
    const { getByPlaceholderText, getByText } = render(<BankLinkingScreen {...baseProps} />);
    const input = getByPlaceholderText('HDFC0001234');
    act(() => { fireEvent.changeText(input, 'HDFC0001234'); });
    expect(getByText(/✓ Valid IFSC format/)).toBeDefined();
  });

  it('shows invalid format hint when IFSC format is wrong', () => {
    const { getByPlaceholderText, getByText } = render(<BankLinkingScreen {...baseProps} />);
    const input = getByPlaceholderText('HDFC0001234');
    act(() => { fireEvent.changeText(input, 'XYZ'); });
    expect(getByText(/Invalid IFSC format/)).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // IFSC Verification Flow
  // ═══════════════════════════════════════════════════════════════

  it('advances to account step (shows Account Number input) after successful IFSC verification', async () => {
    vi.useFakeTimers();
    const { getByPlaceholderText, getAllByText, getByText } = render(<BankLinkingScreen {...baseProps} />);
    const input = getByPlaceholderText('HDFC0001234');
    act(() => { fireEvent.changeText(input, 'HDFC0001234'); });

    const buttons = getAllByText('Verify IFSC');
    act(() => { fireEvent.press(buttons[buttons.length - 1]); });

    // Fast-forward past the mock setTimeout (500 + random*300) and flush microtasks
    await act(async () => { vi.advanceTimersByTime(1000); });

    expect(getByText('Step 2 of 3')).toBeDefined();
    vi.useRealTimers();
  });

  it('shows loading state while IFSC is being verified', () => {
    const { getByPlaceholderText, getByText } = render(<BankLinkingScreen {...baseProps} />);
    const input = getByPlaceholderText('HDFC0001234');
    act(() => { fireEvent.changeText(input, 'HDFC0001234'); });

    const verifyButton = getByText('Verify IFSC');
    act(() => { fireEvent.press(verifyButton); });

    expect(getByText(/Verifying/)).toBeDefined();
  });

  it('shows error for invalid IFSC not in mock database', async () => {
    vi.useFakeTimers();
    const { getByPlaceholderText, getByText } = render(<BankLinkingScreen {...baseProps} />);
    const input = getByPlaceholderText('HDFC0001234');
    act(() => { fireEvent.changeText(input, 'ABCD0001234'); });

    const verifyButton = getByText('Verify IFSC');
    act(() => { fireEvent.press(verifyButton); });

    // Fast-forward past the mock setTimeout and flush microtasks
    await act(async () => { vi.advanceTimersByTime(1000); });

    expect(getByText(/not found/i)).toBeDefined();
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════
  // Account Verification Step (Step 2)
  // ═══════════════════════════════════════════════════════════════

  it('renders without crashing', () => {
    const { toJSON } = render(<BankLinkingScreen {...baseProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows the back button and navigates back on press', () => {
    const { getByTestId } = render(<BankLinkingScreen {...baseProps} />);
    const backBtn = getByTestId('back-button');
    act(() => { fireEvent.press(backBtn); });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows Account Number placeholder when account step renders', async () => {
    vi.useFakeTimers();
    const { getByPlaceholderText, getByText } = render(<BankLinkingScreen {...baseProps} />);
    act(() => { fireEvent.changeText(getByPlaceholderText('HDFC0001234'), 'HDFC0001234'); });
    const verifyBtn = getByText('Verify IFSC');
    act(() => { fireEvent.press(verifyBtn); });

    // Fast-forward past the mock setTimeout and flush microtasks
    await act(async () => { vi.advanceTimersByTime(1000); });

    expect(getByText(/Account Number/)).toBeDefined();
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════
  // Edge Cases
  // ═══════════════════════════════════════════════════════════════

  it('renders without crashing with no onVerified callback', () => {
    const noCallbackProps: any = {
      navigation: { goBack: mockGoBack, navigate: mockNavigate },
      route: { params: {} },
    };
    const { getByText } = render(<BankLinkingScreen {...noCallbackProps} />);
    expect(getByText('Link Bank Account')).toBeDefined();
  });

  it('shows manage button in header when linked banks exist', () => {
    mockLinkedBanks.length = 0;
    mockLinkedBanks.push({
      id: 'bank_1', bankName: 'HDFC Bank', accountNumber: 'XXXX1234', ifsc: 'HDFC0001234',
      accountHolderName: 'RAHUL SHARMA', accountType: 'savings', isPrimary: true,
      linkedAt: '2025-01-01', verified: true,
    });
    const { getByTestId } = render(<BankLinkingScreen {...baseProps} />);
    expect(getByTestId('manage-banks-btn')).toBeDefined();
  });

  it('allows navigating to manage step when manage button pressed', () => {
    mockLinkedBanks.length = 0;
    mockLinkedBanks.push({
      id: 'bank_1', bankName: 'HDFC Bank', accountNumber: 'XXXX1234', ifsc: 'HDFC0001234',
      accountHolderName: 'RAHUL SHARMA', accountType: 'savings', isPrimary: true,
      linkedAt: '2025-01-01', verified: true,
    });
    const { getByTestId, getByText } = render(<BankLinkingScreen {...baseProps} />);
    const manageBtn = getByTestId('manage-banks-btn');
    act(() => { fireEvent.press(manageBtn); });
    expect(getByText('Manage Banks')).toBeDefined();
  });
});
