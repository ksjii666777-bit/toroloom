/**
 * ============================================================================
 * Toroloom — KYC Service Tests
 * ============================================================================
 *
 * Tests the backend KYC verification service:
 *   - PAN format validation & normalization
 *   - PAN verification (valid, invalid, not found)
 *   - Aadhaar OTP send & verify
 *   - DigiLocker auth URL & document fetch
 *   - KYC completion & reset
 *   - Service state cleanup
 *
 * Framework: vitest
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isValidPanFormat,
  normalizePan,
  verifyPan,
  sendAadhaarOtp,
  verifyAadhaarOtp,
  getDigiLockerAuthUrl,
  fetchDigiLockerDocuments,
  getKycState,
  completeKyc,
  resetKyc,
  resetKycService,
} from '../services/kyc';

// ==================== Helpers ====================



// ==================== Reset Between Tests ====================

beforeEach(() => {
  resetKycService();
});

// ═══════════════════════════════════════════════════════════════════════════
// PAN Format Validation & Normalization
// ═══════════════════════════════════════════════════════════════════════════

describe('isValidPanFormat', () => {
  it('returns true for a valid PAN: BBBBB1234C', () => {
    expect(isValidPanFormat('BBBBB1234C')).toBe(true);
  });

  it('returns true for valid PAN with lowercase letters', () => {
    expect(isValidPanFormat('bbbbb1234c')).toBe(true);
  });

  it('returns true for valid PAN: PPPPP1234C', () => {
    expect(isValidPanFormat('PPPPP1234C')).toBe(true);
  });

  it('returns false for PAN with fewer than 10 chars', () => {
    expect(isValidPanFormat('ABCDE1234')).toBe(false);
  });

  it('returns false for PAN with more than 10 chars', () => {
    expect(isValidPanFormat('ABCDE1234FZ')).toBe(false);
  });

  it('returns false for PAN with invalid 4th character', () => {
    // 4th char must be A,B,C,E,F,G,H,L,J,P,T — D and Z are invalid
    expect(isValidPanFormat('ABCDE1234F')).toBe(false); // D is not valid for 4th pos
    expect(isValidPanFormat('ABZDE1234F')).toBe(false); // D is not valid for 4th pos
  });

  it('returns false for PAN with special characters', () => {
    expect(isValidPanFormat('ABC@E1234F')).toBe(false);
  });

  it('returns false for PAN with spaces', () => {
    expect(isValidPanFormat('ABCDE 1234F')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidPanFormat('')).toBe(false);
  });

  it('returns false when first 3 chars are numeric', () => {
    expect(isValidPanFormat('123DE1234F')).toBe(false);
  });

  it('returns false when last char is numeric', () => {
    expect(isValidPanFormat('ABCDE12345')).toBe(false);
  });

  it('handles leading/trailing whitespace (expects false since normalize is separate)', () => {
    // isValidPanFormat does NOT trim, only tests the regex
    expect(isValidPanFormat(' BBBBB1234C')).toBe(false);
  });
});

describe('normalizePan', () => {
  it('converts to uppercase', () => {
    expect(normalizePan('bbbbb1234c')).toBe('BBBBB1234C');
  });

  it('trims whitespace', () => {
    expect(normalizePan('  BBBBB1234C  ')).toBe('BBBBB1234C');
  });

  it('removes hyphens', () => {
    expect(normalizePan('BBBBB-1234-C')).toBe('BBBBB1234C');
  });

  it('removes spaces within the PAN', () => {
    expect(normalizePan('BBB BB 1234 C')).toBe('BBBBB1234C');
  });

  it('handles already normalized PAN', () => {
    expect(normalizePan('BBBBB1234C')).toBe('BBBBB1234C');
  });

  it('handles empty string', () => {
    expect(normalizePan('')).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PAN Verification
// ═══════════════════════════════════════════════════════════════════════════

describe('verifyPan', () => {
  it('verifies a valid known PAN', async () => {
    const result = await verifyPan({ panNumber: 'XYZAB9012H', userId: 'test-user-1' });

    expect(result.isVerified).toBe(true);
    expect(result.status).toBe('VALID');
    expect(result.panNumber).toBe('XYZAB9012H');
    expect(result.fullName).toBe('VIKRAM REDDY');
    expect(result.nameOnPan).toBe('VIKRAM REDDY');
    expect(result.category).toBe('Individual');
    expect(result.lastUpdated).toBeDefined();
  });

  it('verifies another valid known PAN', async () => {
    const result = await verifyPan({ panNumber: 'DEFGH7890J', userId: 'test-user-2' });

    expect(result.isVerified).toBe(true);
    expect(result.status).toBe('VALID');
    expect(result.fullName).toBe('ARUN KUMAR');
  });

  it('returns INVALID for malformed PAN', async () => {
    const result = await verifyPan({ panNumber: 'INVALID', userId: 'test-user-3' });

    expect(result.isVerified).toBe(false);
    expect(result.status).toBe('INVALID');
    expect(result.fullName).toBe('');
  });

  it('returns NOT_FOUND for valid format PAN not in database', async () => {
    const result = await verifyPan({ panNumber: 'PAAAP9999P', userId: 'test-user-4' });

    expect(result.isVerified).toBe(false);
    expect(result.status).toBe('NOT_FOUND');
    expect(result.fullName).toBe('');
  });

  it('normalizes PAN before verification', async () => {
    const result = await verifyPan({ panNumber: '  xyzab9012h  ', userId: 'test-user-5' });

    expect(result.isVerified).toBe(true);
    expect(result.panNumber).toBe('XYZAB9012H');
  });

  it('saves PAN to KYC state when userId is provided', async () => {
    await verifyPan({ panNumber: 'XYZAB9012H', userId: 'state-test-user' });

    const state = await getKycState('state-test-user');
    expect(state).not.toBeNull();
    expect(state!.panVerified).toBe(true);
    expect(state!.panNumber).toBe('XYZAB9012H');
    expect(state!.panName).toBe('VIKRAM REDDY');
    expect(state!.panVerifiedAt).toBeDefined();
    expect(state!.overallKycStatus).toBe('pending');
  });

  it('does not save PAN to KYC state when verification fails', async () => {
    await verifyPan({ panNumber: 'ZZZZZ9999Z', userId: 'no-save-user' });

    const state = await getKycState('no-save-user');
    expect(state).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Aadhaar OTP
// ═══════════════════════════════════════════════════════════════════════════

describe('sendAadhaarOtp', () => {
  it('sends OTP for valid Aadhaar number with consent', async () => {
    const result = await sendAadhaarOtp({ aadhaarNumber: '234567891011', consent: true });

    expect(result.referenceId).toBeDefined();
    expect(result.referenceId).toContain('AADHAAR_OTP_');
    expect(result.message).toContain('OTP sent');
    expect(result.expiresAt).toBeDefined();
  });

  it('throws error for invalid Aadhaar number format', async () => {
    await expect(
      sendAadhaarOtp({ aadhaarNumber: '123456789012', consent: true })
    ).rejects.toThrow('Invalid Aadhaar number format');
  });

  it('throws error for short Aadhaar number', async () => {
    await expect(
      sendAadhaarOtp({ aadhaarNumber: '2345678901', consent: true })
    ).rejects.toThrow('Invalid Aadhaar number format');
  });

  it('throws error when consent is false', async () => {
    await expect(
      sendAadhaarOtp({ aadhaarNumber: '234567891011', consent: false })
    ).rejects.toThrow('User consent is required');
  });

  it('accepts Aadhaar number with spaces', async () => {
    const result = await sendAadhaarOtp({
      aadhaarNumber: '2345 6789 1011',
      consent: true,
    });

    expect(result.referenceId).toBeDefined();
  });

  it('generates unique reference IDs for sequential calls', async () => {
    const r1 = await sendAadhaarOtp({ aadhaarNumber: '345678901212', consent: true });
    const r2 = await sendAadhaarOtp({ aadhaarNumber: '456789012323', consent: true });

    expect(r1.referenceId).not.toBe(r2.referenceId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Aadhaar OTP Verification
// ═══════════════════════════════════════════════════════════════════════════

describe('verifyAadhaarOtp', () => {
  it('verifies OTP successfully with correct OTP (123456)', async () => {
    const otpResponse = await sendAadhaarOtp({
      aadhaarNumber: '234567891011',
      consent: true,
    });

    const result = await verifyAadhaarOtp(
      { referenceId: otpResponse.referenceId, otp: '123456' },
      'test-user-kyc',
    );

    expect(result.isVerified).toBe(true);
    expect(result.lastFourDigits).toBe('3456');
    expect(result.yearOfBirth).toBeDefined();
    expect(result.gender).toBeDefined();
    expect(result.state).toBeDefined();
    expect(result.message).toContain('verified successfully');
  });

  it('rejects wrong OTP', async () => {
    const otpResponse = await sendAadhaarOtp({
      aadhaarNumber: '345678901212',
      consent: true,
    });

    const result = await verifyAadhaarOtp(
      { referenceId: otpResponse.referenceId, otp: '000000' },
    );

    expect(result.isVerified).toBe(false);
    expect(result.lastFourDigits).toBe('');
    expect(result.message).toContain('Invalid OTP');
  });

  it('rejects expired/invalid reference ID', async () => {
    const result = await verifyAadhaarOtp(
      { referenceId: 'AADHAAR_OTP_9999999999_999', otp: '123456' },
    );

    expect(result.isVerified).toBe(false);
    expect(result.message).toContain('Invalid or expired reference ID');
  });

  it('saves verified Aadhaar to KYC state when userId is provided', async () => {
    const otpResponse = await sendAadhaarOtp({
      aadhaarNumber: '456789012323',
      consent: true,
    });

    await verifyAadhaarOtp(
      { referenceId: otpResponse.referenceId, otp: '123456' },
      'aadhaar-state-user',
    );

    const state = await getKycState('aadhaar-state-user');
    expect(state).not.toBeNull();
    expect(state!.aadhaarVerified).toBe(true);
    expect(state!.aadhaarLastFour).toBe('3456');
    expect(state!.aadhaarVerifiedAt).toBeDefined();
  });

  it('consumes the OTP after successful verification (cannot reuse)', async () => {
    const otpResponse = await sendAadhaarOtp({
      aadhaarNumber: '567890123434',
      consent: true,
    });

    // First use — should succeed
    const result1 = await verifyAadhaarOtp(
      { referenceId: otpResponse.referenceId, otp: '123456' },
    );
    expect(result1.isVerified).toBe(true);

    // Second use — should fail (OTP consumed)
    const result2 = await verifyAadhaarOtp(
      { referenceId: otpResponse.referenceId, otp: '123456' },
    );
    expect(result2.isVerified).toBe(false);
    expect(result2.message).toContain('Invalid or expired reference ID');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DigiLocker
// ═══════════════════════════════════════════════════════════════════════════

describe('getDigiLockerAuthUrl', () => {
  it('returns an auth URL with reference ID', async () => {
    const result = await getDigiLockerAuthUrl('test-user-digi');

    expect(result.authUrl).toBeDefined();
    expect(result.authUrl).toContain('digilocker.gov.in');
    expect(result.authUrl).toContain('state=' + result.referenceId);
    expect(result.referenceId).toContain('DL_');
  });

  it('generates unique reference IDs for sequential calls', async () => {
    const r1 = await getDigiLockerAuthUrl('user-1');
    const r2 = await getDigiLockerAuthUrl('user-2');

    expect(r1.referenceId).not.toBe(r2.referenceId);
  });
});

describe('fetchDigiLockerDocuments', () => {
  it('returns verified documents for a valid reference ID', async () => {
    const auth = await getDigiLockerAuthUrl('doc-user');
    const result = await fetchDigiLockerDocuments(auth.referenceId, 'doc-user');

    expect(result.isVerified).toBe(true);
    expect(result.referenceId).toBe(auth.referenceId);
    expect(result.documents).toHaveLength(3);
    expect(result.message).toContain('Documents fetched');
  });

  it('returns Aadhaar, PAN, and Voter ID documents', async () => {
    const auth = await getDigiLockerAuthUrl('doc-types');
    const result = await fetchDigiLockerDocuments(auth.referenceId, 'doc-types');

    expect(result.documents[0].name).toBe('Aadhaar Card');
    expect(result.documents[1].name).toBe('PAN Card');
    expect(result.documents[2].name).toBe('Voter ID');

    expect(result.documents[0].issuerName).toBe('Unique Identification Authority of India');
    expect(result.documents[1].issuerName).toBe('Income Tax Department');
  });

  it('each document has all required fields', async () => {
    const auth = await getDigiLockerAuthUrl('doc-fields');
    const result = await fetchDigiLockerDocuments(auth.referenceId, 'doc-fields');

    for (const doc of result.documents) {
      expect(doc.id).toBeDefined();
      expect(doc.name).toBeDefined();
      expect(doc.issuerId).toBeDefined();
      expect(doc.issuerName).toBeDefined();
      expect(doc.documentType).toBeDefined();
      expect(doc.issuedAt).toBeDefined();
      expect(doc.uri).toBeDefined();
    }
  });

  it('saves DigiLocker status to KYC state', async () => {
    const auth = await getDigiLockerAuthUrl('dl-state-user');
    await fetchDigiLockerDocuments(auth.referenceId, 'dl-state-user');

    const state = await getKycState('dl-state-user');
    expect(state).not.toBeNull();
    expect(state!.digiLockerLinked).toBe(true);
    expect(state!.digiLockerDocuments).toHaveLength(3);
    expect(state!.digiLockerVerifiedAt).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// KYC Completion & Reset
// ═══════════════════════════════════════════════════════════════════════════

describe('completeKyc', () => {
  it('completes KYC when PAN and Aadhaar are verified', async () => {
    // Set up: verify PAN
    await verifyPan({ panNumber: 'XYZAB9012H', userId: 'complete-user' });
    // Set up: verify Aadhaar
    const otp = await sendAadhaarOtp({ aadhaarNumber: '234567891011', consent: true });
    await verifyAadhaarOtp({ referenceId: otp.referenceId, otp: '123456' }, 'complete-user');

    const state = await completeKyc('complete-user');

    expect(state.overallKycStatus).toBe('verified');
    expect(state.completedAt).toBeDefined();
    expect(state.panVerified).toBe(true);
    expect(state.aadhaarVerified).toBe(true);
  });

  it('throws error when PAN is not verified', async () => {
    await expect(completeKyc('no-pan-user')).rejects.toThrow(
      'PAN verification is required'
    );
  });

  it('throws error when Aadhaar is not verified', async () => {
    await verifyPan({ panNumber: 'XYZAB9012H', userId: 'no-aadhaar-user' });

    await expect(completeKyc('no-aadhaar-user')).rejects.toThrow(
      'Aadhaar verification is required'
    );
  });

  it('throws error when no KYC state exists', async () => {
    await expect(completeKyc('nonexistent-user')).rejects.toThrow(
      'PAN verification is required'
    );
  });
});

describe('resetKyc', () => {
  it('clears KYC state for a user', async () => {
    // Set up some KYC state
    await verifyPan({ panNumber: 'XYZAB9012H', userId: 'reset-user' });
    let state = await getKycState('reset-user');
    expect(state).not.toBeNull();

    await resetKyc('reset-user');
    state = await getKycState('reset-user');
    expect(state).toBeNull();
  });

  it('does not affect other users KYC state', async () => {
    await verifyPan({ panNumber: 'XYZAB9012H', userId: 'user-a' });
    await verifyPan({ panNumber: 'DEFGH7890J', userId: 'user-b' });

    await resetKyc('user-a');

    const stateA = await getKycState('user-a');
    const stateB = await getKycState('user-b');

    expect(stateA).toBeNull();
    expect(stateB).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Service Reset
// ═══════════════════════════════════════════════════════════════════════════

describe('resetKycService', () => {
  it('clears all in-memory state', async () => {
    // Set up some data
    await verifyPan({ panNumber: 'XYZAB9012H', userId: 'reset-svc-user' });
    let state = await getKycState('reset-svc-user');
    expect(state).not.toBeNull();

    resetKycService();

    // After reset, the state should be gone
    state = await getKycState('reset-svc-user');
    expect(state).toBeNull();
  });

  it('allows starting fresh after reset', async () => {
    await verifyPan({ panNumber: 'XYZAB9012H', userId: 'fresh-user' });
    resetKycService();

    // Start fresh — should work fine
    const result = await verifyPan({ panNumber: 'GHIJK9012M', userId: 'fresh-user' });
    expect(result.isVerified).toBe(true);
    expect(result.status).toBe('VALID');
  });
});
