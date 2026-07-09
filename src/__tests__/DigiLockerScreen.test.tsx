/**
 * ============================================================================
 * Toroloom — DigiLockerScreen Tests
 * ============================================================================
 *
 * Tests the DigiLocker verification flow:
 *   - Initial render (header, hero section, document types, benefits, button)
 *   - Connect flow (loading state, API call)
 *   - Document fetch and display
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

// We'll override Alert.alert in the document-fetch test to simulate
// the user tapping "Authorize" in the OAuth consent dialog.
import { Alert } from 'react-native';

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

const mockGetDigiLockerAuth = vi.hoisted(() => vi.fn());
const mockFetchDigiLockerDocuments = vi.hoisted(() => vi.fn());
vi.mock('../services/api/kyc', () => ({
  kycApi: {
    getDigiLockerAuth: mockGetDigiLockerAuth,
    fetchDigiLockerDocuments: mockFetchDigiLockerDocuments,
  },
}));

const mockGoBack = vi.fn();
const mockNavigate = vi.fn();
const mockOnVerified = vi.fn();

const baseProps: any = {
  navigation: { goBack: mockGoBack, navigate: mockNavigate },
  route: { params: { onVerified: mockOnVerified } },
};

import DigiLockerScreen from '../screens/kyc/DigiLockerScreen';

describe('DigiLockerScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDigiLockerAuth.mockResolvedValue({
      authUrl: 'https://digilocker.gov.in/authorize?client_id=toroloom&state=DL_test_1',
      referenceId: 'DL_test_1',
    });
    mockFetchDigiLockerDocuments.mockResolvedValue({
      referenceId: 'DL_test_1',
      isVerified: true,
      documents: [
        { id: 'dl_doc_1', name: 'Aadhaar Card', issuerId: 'uidai', issuerName: 'Unique Identification Authority of India', documentType: 'identity', issuedAt: '2023-01-01T00:00:00.000Z', uri: 'digilocker://uidai/aadhaar/xxxx1234' },
        { id: 'dl_doc_2', name: 'PAN Card', issuerId: 'incometax', issuerName: 'Income Tax Department', documentType: 'identity', issuedAt: '2024-01-01T00:00:00.000Z', uri: 'digilocker://incometax/pan/xxxxx1234f' },
        { id: 'dl_doc_3', name: 'Voter ID', issuerId: 'eci', issuerName: 'Election Commission of India', documentType: 'address', issuedAt: '2025-01-01T00:00:00.000Z', uri: 'digilocker://eci/voterid/xxxx5678' },
      ],
      message: 'Documents fetched successfully from DigiLocker',
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Initial Render
  // ═══════════════════════════════════════════════════════════════

  it('renders the header with title', () => {
    const { getByText } = render(<DigiLockerScreen {...baseProps} />);
    expect(getByText('DigiLocker')).toBeDefined();
  });

  it('shows hero section with title and description', () => {
    const { getByText } = render(<DigiLockerScreen {...baseProps} />);
    expect(getByText('Verify via DigiLocker')).toBeDefined();
    expect(getByText(/Fetch your verified government/)).toBeDefined();
  });

  it('shows document type badges', () => {
    const { getByText } = render(<DigiLockerScreen {...baseProps} />);
    expect(getByText('Aadhaar Card')).toBeDefined();
    expect(getByText('PAN Card')).toBeDefined();
    expect(getByText('Voter ID')).toBeDefined();
  });

  it('shows benefit list', () => {
    const { getByText } = render(<DigiLockerScreen {...baseProps} />);
    expect(getByText('Benefits')).toBeDefined();
    expect(getByText('Instant document verification')).toBeDefined();
    expect(getByText('No manual upload required')).toBeDefined();
    expect(getByText('Government-certified documents')).toBeDefined();
    expect(getByText('One-time consent — auto-renewable')).toBeDefined();
  });

  it('shows Connect DigiLocker button', () => {
    const { getByText } = render(<DigiLockerScreen {...baseProps} />);
    expect(getByText('Connect DigiLocker')).toBeDefined();
  });

  it('renders all 6 document type options', () => {
    const { getByText } = render(<DigiLockerScreen {...baseProps} />);
    expect(getByText('Aadhaar Card')).toBeDefined();
    expect(getByText('PAN Card')).toBeDefined();
    expect(getByText('Voter ID')).toBeDefined();
    expect(getByText('Driving License')).toBeDefined();
    expect(getByText('Passport')).toBeDefined();
    expect(getByText('Income Documents')).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // Connect Flow
  // ═══════════════════════════════════════════════════════════════

  it('calls getDigiLockerAuth when Connect is pressed', () => {
    const { getByText } = render(<DigiLockerScreen {...baseProps} />);
    act(() => { fireEvent.press(getByText('Connect DigiLocker')); });
    expect(mockGetDigiLockerAuth).toHaveBeenCalled();
  });

  it('shows connecting state while connecting', () => {
    mockGetDigiLockerAuth.mockImplementationOnce(() => new Promise(() => {}));
    const { getByText } = render(<DigiLockerScreen {...baseProps} />);
    act(() => { fireEvent.press(getByText('Connect DigiLocker')); });
    expect(getByText(/Connecting/)).toBeDefined();
  });

  it('shows error message on API failure', async () => {
    mockGetDigiLockerAuth.mockRejectedValueOnce({ body: { error: 'Failed to connect' } });
    const { getByText } = render(<DigiLockerScreen {...baseProps} />);
    act(() => { fireEvent.press(getByText('Connect DigiLocker')); });
    await flushMicrotasks();
    expect(getByText(/Failed to connect/)).toBeDefined();
  });

  // Helper to simulate tapping "Authorize" in the DigiLocker OAuth consent dialog
  async function withAuthorizeAlert(testFn: () => Promise<void>): Promise<void> {
    const originalAlert = Alert.alert;
    try {
      Alert.alert = ((_title: string, _msg: string, buttons?: any[]) => {
        const authBtn = buttons?.find((b: any) => b.text === 'Authorize');
        if (authBtn?.onPress) authBtn.onPress();
      }) as any;
      await testFn();
    } finally {
      Alert.alert = originalAlert;
    }
  }

  it('fetches and displays documents after OAuth authorize', async () => {
    await withAuthorizeAlert(async () => {
      const { getByText } = render(<DigiLockerScreen {...baseProps} />);
      act(() => { fireEvent.press(getByText('Connect DigiLocker')); });
      await flushMicrotasks();

      expect(mockFetchDigiLockerDocuments).toHaveBeenCalled();
      expect(getByText(/3 Documents Fetched/)).toBeDefined();
      expect(getByText('Aadhaar Card')).toBeDefined();
      expect(getByText('PAN Card')).toBeDefined();
      expect(getByText('Voter ID')).toBeDefined();
      expect(getByText(/Complete Verification/)).toBeDefined();
    });
  });

  it('shows document issuer names after fetch', async () => {
    await withAuthorizeAlert(async () => {
      const { getByText } = render(<DigiLockerScreen {...baseProps} />);
      act(() => { fireEvent.press(getByText('Connect DigiLocker')); });
      await flushMicrotasks();

      expect(getByText(/Unique Identification Authority of India/)).toBeDefined();
      expect(getByText(/Income Tax Department/)).toBeDefined();
      expect(getByText(/Election Commission of India/)).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Edge Cases
  // ═══════════════════════════════════════════════════════════════

  it('renders without crashing with no onVerified callback', () => {
    const noCallbackProps: any = {
      navigation: { goBack: mockGoBack, navigate: mockNavigate },
      route: { params: {} },
    };
    const { getByText } = render(<DigiLockerScreen {...noCallbackProps} />);
    expect(getByText('DigiLocker')).toBeDefined();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<DigiLockerScreen {...baseProps} />);
    expect(toJSON()).toBeTruthy();
  });
});
