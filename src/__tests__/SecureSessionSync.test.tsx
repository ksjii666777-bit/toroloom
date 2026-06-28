/**
 * ============================================================================
 * Toroloom — Secure Session Sync Unit Tests
 * ============================================================================
 *
 * Tests component rendering with react-test-renderer (via testUtils).
 *
 * Run: npx vitest run --reporter=verbose src/__tests__/SecureSessionSync.test.tsx
 * ============================================================================
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from './testUtils';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('react-native-webview', () => ({
  WebView: (props: any) => {
    return React.createElement(
      'View',
      null,
      props.renderLoading ? props.renderLoading() : null,
    );
  },
}));

vi.mock('../../services/gateway/brokerLoginConfig', () => ({
  getBrokerDashboardPatterns: vi.fn().mockReturnValue(['dashboard', 'portfolio']),
  getBrokerTokenParams: vi.fn().mockReturnValue(['access_token=', 'enctoken=']),
  getBrokerMfaPatterns: vi.fn().mockReturnValue(['otp', 'mfa', 'totp']),
  getBrokerExtractionStrategy: vi.fn().mockReturnValue('cookie_session'),
}));

vi.mock('../../utils/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import SecureSessionSync from '../components/gateway/SecureSessionSync';

describe('SecureSessionSync', () => {
  const defaultProps = {
    sourceUrl: 'https://kite.zerodha.com/login',
    brokerType: 'zerodha',
    onSessionCaptured: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { toJSON } = render(<SecureSessionSync {...defaultProps} />);
      expect(toJSON()).not.toBeNull();
    });

    it('should show loading indicator text', () => {
      const { getByText } = render(<SecureSessionSync {...defaultProps} />);
      expect(getByText('Establishing secure session...')).toBeTruthy();
    });

    it('should show broker type in loading hint', () => {
      const { getByText } = render(<SecureSessionSync {...defaultProps} />);
      expect(getByText(/zerodha/)).toBeTruthy();
    });

    it('should show extraction strategy in loading hint', () => {
      const { getByText } = render(<SecureSessionSync {...defaultProps} />);
      // The hint contains brokerType + extraction label
      expect(getByText(/zerodha/)).toBeTruthy();
      expect(getByText(/extraction/)).toBeTruthy();
    });
  });

  describe('Props', () => {
    it('should accept custom onAuthDetection callback', () => {
      const { toJSON } = render(<SecureSessionSync {...defaultProps} onAuthDetection={vi.fn()} />);
      expect(toJSON()).not.toBeNull();
    });

    it('should accept custom user agent', () => {
      const { toJSON } = render(<SecureSessionSync {...defaultProps} customUserAgent="Custom Agent" />);
      expect(toJSON()).not.toBeNull();
    });

    it('should accept onClose callback', () => {
      const { toJSON } = render(<SecureSessionSync {...defaultProps} onClose={vi.fn()} />);
      expect(toJSON()).not.toBeNull();
    });

    it('should accept loginConfigOverride', () => {
      const { toJSON } = render(<SecureSessionSync {...defaultProps} loginConfigOverride={{ extractionStrategy: 'token_param' }} />);
      expect(toJSON()).not.toBeNull();
    });
  });
});
