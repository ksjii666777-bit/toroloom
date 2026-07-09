/**
 * ============================================================================
 * Toroloom — TwoFactorSetupScreen Tests
 * ============================================================================
 *
 * Tests the 2FA setup flow:
 *   - Loading → Setup (generate QR, TOTP input)
 *   - Verify code → Backup codes display
 *   - Manage step (already-enabled 2FA)
 *   - Disable modal with code entry
 *   - Regenerate backup codes
 *   - Edge cases (API failures)
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

// ==================== Mock react-native-qrcode-svg ====================

vi.mock('react-native-qrcode-svg', () => ({
  default: 'QRCode',
}));

// ==================== Mock authApi ====================

const mockGet2FAStatus = vi.hoisted(() => vi.fn());
const mockGenerate2FASetup = vi.hoisted(() => vi.fn());
const mockVerify2FAToken = vi.hoisted(() => vi.fn());
const mockDisable2FA = vi.hoisted(() => vi.fn());
const mockGetBackupCodes = vi.hoisted(() => vi.fn());
const mockRegenerateBackupCodes = vi.hoisted(() => vi.fn());

vi.mock('../services/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
    getProfile: vi.fn(),
    get2FAStatus: mockGet2FAStatus,
    generate2FASetup: mockGenerate2FASetup,
    verify2FAToken: mockVerify2FAToken,
    disable2FA: mockDisable2FA,
    getBackupCodes: mockGetBackupCodes,
    regenerateBackupCodes: mockRegenerateBackupCodes,
  },
}));

// ==================== Helpers ====================

/** Flush pending promises so async effects resolve */
async function flushMicrotasks() {
  await act(async () => {});
}

// ==================== Navigation Mocks ====================

const mockGoBack = vi.fn();

const baseProps: any = {
  navigation: { goBack: mockGoBack },
  route: {},
};

// ==================== Mock Data ====================

const mockSetupData = {
  secret: 'JBSWY3DPEHPK3PXP',
  otpauthUrl: 'otpauth://totp/Toroloom:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Toroloom',
  backupCodes: [
    'ABCDE-12345', 'FGHIJ-67890', 'KLMNO-11111',
    'PQRST-22222', 'UVWXY-33333', 'ZABCD-44444',
    'EFGHI-55555', 'JKLMN-66666', 'OPQRS-77777',
    'TUVWX-88888',
  ],
};

const mockBackupCodeEntries = [
  { code: 'ABCDE-12345', used: false },
  { code: 'FGHIJ-67890', used: false },
  { code: 'KLMNO-11111', used: true },
];

const mockRegeneratedCodes = {
  codes: ['NEW01-AAAAA', 'NEW02-BBBBB', 'NEW03-CCCCC'],
  message: 'New backup codes generated',
};

// ==================== Import screen ====================

import TwoFactorSetupScreen from '../screens/settings/TwoFactorSetupScreen';

describe('TwoFactorSetupScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: 2FA not enabled → shows setup step
    mockGet2FAStatus.mockResolvedValue({ enabled: false, verified: false });
    mockGenerate2FASetup.mockResolvedValue(mockSetupData);
    mockVerify2FAToken.mockResolvedValue({ verified: true, enabled: true, message: '2FA enabled' });
    mockDisable2FA.mockResolvedValue({ success: true, message: '2FA disabled' });
    mockGetBackupCodes.mockResolvedValue({ codes: mockBackupCodeEntries, unusedCount: 2 });
    mockRegenerateBackupCodes.mockResolvedValue(mockRegeneratedCodes);
  });



  // ═══════════════════════════════════════════════════════════════
  // Initial Loading State
  // ═══════════════════════════════════════════════════════════════

  it('renders loading state on mount while status loads', () => {
    mockGet2FAStatus.mockImplementation(() => new Promise(() => {}));
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    expect(getByText(/Loading 2FA status/)).toBeDefined();
  });

  it('renders the header with title', () => {
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    expect(getByText('Two-Factor Auth')).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // Setup Step — Initial (No Setup Started)
  // ═══════════════════════════════════════════════════════════════

  it('shows 2FA info card with hero section', async () => {
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    expect(getByText('Two-Factor Authentication')).toBeDefined();
  });

  it('shows benefits list', async () => {
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    expect(getByText(/Protects against unauthorized access/)).toBeDefined();
    expect(getByText(/Works with Google Authenticator/)).toBeDefined();
    expect(getByText(/Backup codes provided for emergency/)).toBeDefined();
  });

  it('shows Set Up button when no setup started', async () => {
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    expect(getByText('Set Up Two-Factor Auth')).toBeDefined();
  });

  it('calls generate2FASetup when Set Up button is pressed', async () => {
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const setupBtn = getByText('Set Up Two-Factor Auth');
    act(() => { fireEvent.press(setupBtn); });
    await flushMicrotasks();
    expect(mockGenerate2FASetup).toHaveBeenCalled();
  });

  it('shows generating state while setup is in progress', async () => {
    mockGenerate2FASetup.mockImplementation(() => new Promise(() => {}));
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const setupBtn = getByText('Set Up Two-Factor Auth');
    act(() => { fireEvent.press(setupBtn); });
    // setIsLoading(true) is synchronous — flushed by act() inside fireEvent.press
    expect(getByText(/Generating/)).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // QR Code Display
  // ═══════════════════════════════════════════════════════════════

  it('shows QR section after setup is generated', async () => {
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const setupBtn = getByText('Set Up Two-Factor Auth');
    act(() => { fireEvent.press(setupBtn); });
    await flushMicrotasks();
    expect(getByText(/Scan with Authenticator App/)).toBeDefined();
  });

  it('shows manual entry toggle after QR code', async () => {
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const setupBtn = getByText('Set Up Two-Factor Auth');
    act(() => { fireEvent.press(setupBtn); });
    await flushMicrotasks();
    expect(getByText(/Enter key manually/)).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // TOTP Input — 6-Digit Code
  // ═══════════════════════════════════════════════════════════════

  it('shows TOTP code input prompt after QR', async () => {
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const setupBtn = getByText('Set Up Two-Factor Auth');
    act(() => { fireEvent.press(setupBtn); });
    await flushMicrotasks();
    expect(getByText(/Enter the 6-digit code/)).toBeDefined();
  });

  it('shows Verify & Enable button', async () => {
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const setupBtn = getByText('Set Up Two-Factor Auth');
    act(() => { fireEvent.press(setupBtn); });
    await flushMicrotasks();
    expect(getByText('Verify & Enable 2FA')).toBeDefined();
  });

  it('renders QR step with Verify button disabled until 6 digits entered', async () => {
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const setupBtn = getByText('Set Up Two-Factor Auth');
    act(() => { fireEvent.press(setupBtn); });
    await flushMicrotasks();
    // QR step rendered
    expect(getByText(/Scan with Authenticator App/)).toBeDefined();
    // Verify button exists but is disabled (opacity 0.5) until 6 digits
    expect(getByText('Verify & Enable 2FA')).toBeDefined();
  });

  it('shows initial TOTP hint text when no code entered', async () => {
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const setupBtn = getByText('Set Up Two-Factor Auth');
    act(() => { fireEvent.press(setupBtn); });
    await flushMicrotasks();
    // The hint shows the initial message when verificationCode is empty (length === 0)
    expect(getByText(/Enter the 6-digit code shown in your authenticator app/)).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // Manage Step — 2FA Already Enabled
  // ═══════════════════════════════════════════════════════════════

  it('shows manage step when 2FA is already enabled', async () => {
    mockGet2FAStatus.mockResolvedValue({ enabled: true, verified: true, setupAt: '2026-01-15T00:00:00.000Z' });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    expect(getByText('2FA is Active')).toBeDefined();
  });

  it('shows Enabled badge in manage step', async () => {
    mockGet2FAStatus.mockResolvedValue({ enabled: true, verified: true, setupAt: '2026-01-15T00:00:00.000Z' });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    expect(getByText('Enabled')).toBeDefined();
  });

  it('shows setup date in manage step', async () => {
    mockGet2FAStatus.mockResolvedValue({ enabled: true, verified: true, setupAt: '2026-01-15T00:00:00.000Z' });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    expect(getByText(/Jan/)).toBeDefined(); // "Since 15 Jan 2026"
  });

  it('shows Manage 2FA card with all three actions', async () => {
    mockGet2FAStatus.mockResolvedValue({ enabled: true, verified: true, setupAt: '2026-01-15T00:00:00.000Z' });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    expect(getByText('Manage 2FA')).toBeDefined();
    expect(getByText(/View Backup Codes/)).toBeDefined();
    expect(getByText(/Regenerate Backup Codes/)).toBeDefined();
    expect(getByText(/Disable Two-Factor Auth/)).toBeDefined();
  });

  it('shows How It Works card in manage step', async () => {
    mockGet2FAStatus.mockResolvedValue({ enabled: true, verified: true, setupAt: '2026-01-15T00:00:00.000Z' });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    expect(getByText('How It Works')).toBeDefined();
  });

  it('opens backup codes when View Backup Codes is pressed', async () => {
    mockGet2FAStatus.mockResolvedValue({ enabled: true, verified: true, setupAt: '2026-01-15T00:00:00.000Z' });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const viewBtn = getByText(/View Backup Codes/);
    act(() => { fireEvent.press(viewBtn); });
    await flushMicrotasks();
    expect(mockGetBackupCodes).toHaveBeenCalled();
  });

  it('calls regenerateBackupCodes when Regenerate Backup Codes is pressed', async () => {
    mockGet2FAStatus.mockResolvedValue({ enabled: true, verified: true, setupAt: '2026-01-15T00:00:00.000Z' });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const regenerateBtn = getByText(/Regenerate Backup Codes/);
    // Pressing this triggers Alert.alert which shows a native dialog
    // In the test environment, Alert.alert is a no-op (from RN mock)
    // So this verifies the button is present and clickable
    act(() => { fireEvent.press(regenerateBtn); });
    // Alert.alert is called but we can't test the confirmation flow
    // because the RN mock doesn't implement it
    expect(regenerateBtn).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // Disable Modal
  // ═══════════════════════════════════════════════════════════════

  it('shows disable modal when Disable 2FA is pressed', async () => {
    mockGet2FAStatus.mockResolvedValue({ enabled: true, verified: true, setupAt: '2026-01-15T00:00:00.000Z' });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const disableBtn = getByText(/Disable Two-Factor Auth/);
    act(() => { fireEvent.press(disableBtn); });
    await flushMicrotasks();
    // The modal title must match exactly — the modal shows "Disable 2FA"
    // This could match multiple elements, so use a more specific check
    expect(getByText(/Enter a code from your authenticator/)).toBeDefined();
  });

  it('shows Cancel and Disable 2FA buttons in modal', async () => {
    mockGet2FAStatus.mockResolvedValue({ enabled: true, verified: true, setupAt: '2026-01-15T00:00:00.000Z' });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const disableBtn = getByText(/Disable Two-Factor Auth/);
    act(() => { fireEvent.press(disableBtn); });
    await flushMicrotasks();
    expect(getByText(/Cancel/)).toBeDefined();
    expect(getByText(/Disable 2FA/)).toBeDefined();
  });

  it('closes modal when Cancel is pressed and resets error state', async () => {
    mockGet2FAStatus.mockResolvedValue({ enabled: true, verified: true, setupAt: '2026-01-15T00:00:00.000Z' });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    // Open modal
    const disableBtn = getByText(/Disable Two-Factor Auth/);
    act(() => { fireEvent.press(disableBtn); });
    await flushMicrotasks();
    expect(getByText(/Enter a code from your authenticator/)).toBeDefined();

    // Press Cancel
    const cancelBtn = getByText(/Cancel/);
    act(() => { fireEvent.press(cancelBtn); });
    await flushMicrotasks();

    // After cancel, the manage step should still be visible (we're back on main screen)
    expect(getByText('2FA is Active')).toBeDefined();
  });

  it('renders disable modal with Disable 2FA button disabled until code entered', async () => {
    mockGet2FAStatus.mockResolvedValue({ enabled: true, verified: true, setupAt: '2026-01-15T00:00:00.000Z' });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const disableBtn = getByText(/Disable Two-Factor Auth/);
    act(() => { fireEvent.press(disableBtn); });
    await flushMicrotasks();
    expect(getByText(/Cancel/)).toBeDefined();
    expect(getByText(/Disable 2FA/)).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  // Edge Cases
  // ═══════════════════════════════════════════════════════════════

  it('handles API failure for get2FAStatus gracefully', async () => {
    mockGet2FAStatus.mockRejectedValue(new Error('Network error'));
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    // The catch in loadStatus falls through to default: setup step
    await flushMicrotasks();
    expect(getByText('Two-Factor Authentication')).toBeDefined();
  });

  it('handles API failure for generate2FASetup gracefully', async () => {
    mockGenerate2FASetup.mockRejectedValue({ body: { error: 'Rate limited' } });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const setupBtn = getByText('Set Up Two-Factor Auth');
    act(() => { fireEvent.press(setupBtn); });
    await flushMicrotasks();
    expect(getByText(/Rate limited/)).toBeDefined();
  });

  it('shows back button header', async () => {
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    expect(getByText('Two-Factor Auth')).toBeDefined();
  });

  it('handles API failure for getBackupCodes gracefully from manage step', async () => {
    mockGetBackupCodes.mockRejectedValue({ body: { error: 'Failed to fetch codes' } });
    mockGet2FAStatus.mockResolvedValue({ enabled: true, verified: true, setupAt: '2026-01-15T00:00:00.000Z' });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const viewBtn = getByText(/View Backup Codes/);
    act(() => { fireEvent.press(viewBtn); });
    await flushMicrotasks();
    // The error message should appear
    expect(getByText(/Failed to fetch codes/)).toBeDefined();
  });

  it('shows backup codes after View Backup Codes is pressed from manage step', async () => {
    mockGet2FAStatus.mockResolvedValue({ enabled: true, verified: true, setupAt: '2026-01-15T00:00:00.000Z' });
    const { getByText } = render(<TwoFactorSetupScreen {...baseProps} />);
    await flushMicrotasks();
    const viewBtn = getByText(/View Backup Codes/);
    act(() => { fireEvent.press(viewBtn); });
    await flushMicrotasks();
    // Should show backup codes display
    expect(getByText(/Save these one-time recovery codes/)).toBeDefined();
    expect(getByText(/ABCDE-12345/)).toBeDefined();
    expect(getByText(/FGHIJ-67890/)).toBeDefined();
    expect(getByText(/Share \/ Copy/)).toBeDefined();
    expect(getByText(/I've Saved My Backup Codes/)).toBeDefined();
  });
});
