/**
 * ============================================================================
 * Toroloom — KYC API Client
 * ============================================================================
 *
 * Frontend API calls for PAN verification, Aadhaar eKYC, DigiLocker.
 * All calls go through the standard api client with auth token.
 * ============================================================================
 */

import { api } from './client';
import type {
  PanVerificationResult,
  AadhaarOtpResponse,
  AadhaarVerifyResponse,
  DigiLockerAuthUrl,
  DigiLockerFetchResponse,
  IFSCVerificationResult,
  AccountVerificationResult,
  LinkedBankAccount,
  KycState,
} from '../../types';

export const kycApi = {
  /** Verify PAN number (10-character alphanumeric) */
  verifyPan: (panNumber: string) =>
    api.post<PanVerificationResult>('/kyc/pan/verify', { panNumber }),

  /** Send OTP to Aadhaar-linked mobile (requires explicit consent) */
  sendAadhaarOtp: (aadhaarNumber: string, consent: boolean = true) =>
    api.post<AadhaarOtpResponse>('/kyc/aadhaar/otp', { aadhaarNumber, consent }),

  /** Verify Aadhaar OTP to complete eKYC */
  verifyAadhaarOtp: (referenceId: string, otp: string) =>
    api.post<AadhaarVerifyResponse>('/kyc/aadhaar/verify', { referenceId, otp }),

  /** Get DigiLocker OAuth authorization URL (open in WebView) */
  getDigiLockerAuth: () =>
    api.post<DigiLockerAuthUrl>('/kyc/digilocker/auth'),

  /** Fetch documents from DigiLocker after OAuth consent */
  fetchDigiLockerDocuments: (referenceId: string) =>
    api.post<DigiLockerFetchResponse>('/kyc/digilocker/fetch', { referenceId }),

  /** Get current user's KYC status */
  getStatus: () =>
    api.get<KycState | null>('/kyc/status'),

  /** Complete KYC after all verification steps pass */
  completeKyc: () =>
    api.post<{ success: boolean; state: KycState }>('/kyc/complete'),

  /** Reset KYC (allows re-verification) */
  resetKyc: () =>
    api.post<{ success: boolean; message: string }>('/kyc/reset'),

  // ═══ Bank Linking ═══════════════════════════════════════════════

  /** Verify IFSC code and return bank/branch details */
  verifyIFSC: (ifsc: string) =>
    api.post<IFSCVerificationResult>('/kyc/bank/verify-ifsc', { ifsc }),

  /** Verify bank account holder name (Penny Drop style) */
  verifyBankAccount: (ifsc: string, accountNumber: string, accountHolderName: string) =>
    api.post<AccountVerificationResult>('/kyc/bank/verify-account', { ifsc, accountNumber, accountHolderName }),

  /** Link a verified bank account to the user's profile */
  linkBankAccount: (details: {
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountHolderName: string;
    accountType: 'savings' | 'current' | 'salary' | 'other';
    isPrimary: boolean;
  }) =>
    api.post<LinkedBankAccount>('/kyc/bank/link', details),

  /** Get all linked bank accounts */
  getLinkedBanks: () =>
    api.get<LinkedBankAccount[]>('/kyc/bank/linked'),

  /** Remove a linked bank account */
  removeLinkedBank: (accountId: string) =>
    api.post<{ success: boolean; message: string }>('/kyc/bank/remove', { accountId }),

  /** Set a linked bank account as the primary account */
  setPrimaryBank: (accountId: string) =>
    api.post<LinkedBankAccount>('/kyc/bank/set-primary', { accountId }),
};
