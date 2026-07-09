/**
 * ============================================================================
 * Toroloom — KYC Verification Service (Setu/Pine Labs Integration)
 * ============================================================================
 *
 * Handles PAN verification, Aadhaar eKYC (OTP-based), and DigiLocker document
 * fetch via the Setu (Pine Labs) KYC Stack API.
 *
 * Architecture:
 *   All calls to Setu APIs are mocked for development. In production, replace
 *   the mock implementations with actual Setu REST API calls using the
 *   SETU_CLIENT_ID and SETU_CLIENT_SECRET env vars.
 *
 * Setu API Docs: https://docs.setu.co/kyc-stack
 *   - PAN Pro:   POST /v1/pan/verify
 *   - Aadhaar:   POST /v1/aadhaar/otp  + POST /v1/aadhaar/verify
 *   - DigiLocker: POST /v1/digilocker/auth + GET /v1/digilocker/documents
 *
 * ============================================================================
 */

import type { StorageEngine } from '../storage/types';

// ==================== Types ====================

export interface PanVerifyRequest {
  panNumber: string;
  userId?: string;
}

export interface PanVerifyResponse {
  panNumber: string;
  fullName: string;
  isVerified: boolean;
  nameMatch?: boolean;
  nameOnPan?: string;
  category?: string;
  status: 'VALID' | 'INVALID' | 'NOT_FOUND';
  lastUpdated?: string;
}

export interface AadhaarOtpRequest {
  aadhaarNumber: string;
  consent: true; // User must explicitly consent
}

export interface AadhaarOtpResponse {
  referenceId: string;
  message: string;
  expiresAt: string;
}

export interface AadhaarVerifyRequest {
  referenceId: string;
  otp: string;
}

export interface AadhaarVerifyResponse {
  referenceId: string;
  isVerified: boolean;
  lastFourDigits: string;
  name?: string;
  yearOfBirth?: string;
  gender?: string;
  state?: string;
  message: string;
}

export interface DigiLockerAuthResponse {
  authUrl: string;
  referenceId: string;
}

export interface DigiLockerFetchResponse {
  referenceId: string;
  isVerified: boolean;
  documents: DigiLockerDocument[];
  message: string;
}

export interface DigiLockerDocument {
  id: string;
  name: string;
  issuerId: string;
  issuerName: string;
  documentType: string;
  issuedAt: string;
  uri: string;
}

// ==================== Bank Account Types ====================

export interface IFSCVerificationResult {
  ifsc: string;
  bankName: string;
  branch: string;
  address: string;
  city: string;
  state: string;
  contact: string;
  isValid: boolean;
  micrCode?: string;
}

export interface AccountVerificationResult {
  accountNumber: string;
  ifsc: string;
  accountHolderName: string;
  isValid: boolean;
  bankName: string;
  message: string;
  nameMatchScore?: number;
}

export interface LinkedBankAccountData {
  id: string;
  bankName: string;
  accountNumber: string; // Masked: XXXX1234
  ifsc: string;
  accountHolderName: string;
  accountType: 'savings' | 'current' | 'salary' | 'other';
  isPrimary: boolean;
  linkedAt: string;
  verified: boolean;
}

export interface KycStateData {
  userId: string;
  panVerified: boolean;
  panNumber?: string;
  panName?: string;
  panVerifiedAt?: string;
  aadhaarVerified: boolean;
  aadhaarLastFour?: string;
  aadhaarVerifiedAt?: string;
  digiLockerLinked: boolean;
  digiLockerVerifiedAt?: string;
  digiLockerDocuments?: DigiLockerDocument[];
  linkedBanks?: LinkedBankAccountData[];
  overallKycStatus: 'pending' | 'verified' | 'rejected';
  completedAt?: string;
  updatedAt: string;
}

// ==================== PAN Format Validation ====================

/**
 * Validates Indian PAN card format: ABCDE1234F
 * Rules:
 *   - First 3 chars: alphabetic (AAA-ZZZ)
 *   - 4th char: P (Individual), C (Company), H (HUF), etc.
 *   - 5th char: alphabetic (surname initial)
 *   - Next 4 chars: numeric (0001-9999)
 *   - Last char: alphabetic (checksum)
 */
const PAN_REGEX = /^[A-Z]{3}[ABCEFGHLJPT][A-Z]\d{4}[A-Z]$/;

export function isValidPanFormat(pan: string): boolean {
  return PAN_REGEX.test(pan.toUpperCase());
}

/**
 * Normalize PAN: trim, uppercase, remove spaces/hyphens
 */
export function normalizePan(pan: string): string {
  return pan.trim().toUpperCase().replace(/[\s-]/g, '');
}

// ==================== Internal State ====================

let storage: StorageEngine | null = null;
let kycStateStore = new Map<string, KycStateData>();

// Mock Setu API responses
const MOCK_AADHAAR_OTPS = new Map<string, string>(); // referenceId → OTP
let aadhaarCounter = 0;
let digiLockerCounter = 0;

const MOCK_PAN_DATABASE: Record<string, { name: string; category: string }> = {
  'ABCDE1234F': { name: 'RAHUL SHARMA', category: 'Individual' },
  'PQRST5678G': { name: 'PRIYA PATEL', category: 'Individual' },
  'XYZAB9012H': { name: 'VIKRAM REDDY', category: 'Individual' },
  'TUVWX3456I': { name: 'NEHA SINGH', category: 'Individual' },
  'DEFGH7890J': { name: 'ARUN KUMAR', category: 'Individual' },
  'MNOPS1234K': { name: 'DEEPIKA VERMA', category: 'Individual' },
  'KLMBT5678L': { name: 'KAJAL AGARWAL', category: 'Individual' },
  'GHIJK9012M': { name: 'SAMEER SHINDE', category: 'Individual' },
};

// ==================== IFSC / Bank Account ====================

/**
 * IFSC Regex: 4 letters + 0 + 6 alphanumeric chars
 * e.g., HDFC0001234, ICIC0005678, SBIN0001234
 */
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const MOCK_IFSC_DATABASE: Record<string, IFSCResult> = {
  'HDFC0001234': { bank: 'HDFC Bank', branch: 'Andheri West', address: 'Gokul Arcade, S.V. Road, Andheri West', city: 'Mumbai', state: 'Maharashtra', contact: '1800-202-6161' },
  'ICIC0005678': { bank: 'ICICI Bank', branch: 'Koramangala', address: 'Plot 14, 80 Feet Road, Koramangala', city: 'Bangalore', state: 'Karnataka', contact: '1800-108-8888' },
  'SBIN0001234': { bank: 'State Bank of India', branch: 'Connaught Place', address: '11, Sansad Marg, Connaught Place', city: 'New Delhi', state: 'Delhi', contact: '1800-1234-5678' },
  'AXIS0009012': { bank: 'AXIS Bank', branch: 'Bandra Kurla Complex', address: 'Axis House, C-1, Bandra Kurla Complex', city: 'Mumbai', state: 'Maharashtra', contact: '1800-233-5577' },
  'YESB0003456': { bank: 'Yes Bank', branch: 'MG Road', address: '48, MG Road, Ashok Nagar', city: 'Bangalore', state: 'Karnataka', contact: '1800-120-3500' },
};

interface IFSCResult {
  bank: string;
  branch: string;
  address: string;
  city: string;
  state: string;
  contact: string;
}

let bankAccountCounter = 0;

// ==================== Public API ====================

export async function configureKycPersistence(s: StorageEngine): Promise<void> {
  storage = s;
}

/**
 * Verify a PAN number via Setu PAN Pro API (mocked).
 *
 * In production:
 *   POST https://api.setu.co/v1/pan/verify
 *   Headers: { 'x-client-id': SETU_CLIENT_ID, 'x-client-secret': SETU_CLIENT_SECRET }
 *   Body: { pan: normalizedPan, consent: "Y", reason: "KYC verification" }
 *
 * Returns: { name, pan, category, status, lastUpdated }
 */
export async function verifyPan(request: PanVerifyRequest): Promise<PanVerifyResponse> {
  const normalizedPan = normalizePan(request.panNumber);

  // 1) Format validation
  if (!isValidPanFormat(normalizedPan)) {
    return {
      panNumber: normalizedPan,
      fullName: '',
      isVerified: false,
      status: 'INVALID',
    };
  }

  // 2) Simulate Setu API latency
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

  // 3) Look up in mock database (in production: call Setu API)
  const match = MOCK_PAN_DATABASE[normalizedPan];

  if (!match) {
    return {
      panNumber: normalizedPan,
      fullName: '',
      isVerified: false,
      status: 'NOT_FOUND',
    };
  }

  const response: PanVerifyResponse = {
    panNumber: normalizedPan,
    fullName: match.name,
    isVerified: true,
    nameOnPan: match.name,
    category: match.category,
    status: 'VALID',
    lastUpdated: new Date().toISOString(),
  };

  // 4) Save to KYC state
  if (request.userId) {
    const state = kycStateStore.get(request.userId) || createDefaultKycState(request.userId);
    state.panVerified = true;
    state.panNumber = normalizedPan;
    state.panName = match.name;
    state.panVerifiedAt = new Date().toISOString();
    state.updatedAt = new Date().toISOString();
    kycStateStore.set(request.userId, state);
  }

  return response;
}

/**
 * Initiate Aadhaar eKYC — sends OTP to Aadhaar-linked mobile.
 *
 * In production (Setu):
 *   POST https://api.setu.co/v1/aadhaar/otp
 *   Body: { aadhaarNumber, consent: true }
 *   Response: { referenceId }
 */
export async function sendAadhaarOtp(request: AadhaarOtpRequest): Promise<AadhaarOtpResponse> {
  // Validate Aadhaar format (12 digits, no leading 0 or 1)
  const cleaned = request.aadhaarNumber.replace(/\s/g, '');
  if (!/^[2-9]\d{11}$/.test(cleaned)) {
    throw new Error('Invalid Aadhaar number format. Must be 12 digits.');
  }

  if (!request.consent) {
    throw new Error('User consent is required for Aadhaar verification.');
  }

  // Simulate Setu API call
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 300));

  aadhaarCounter++;
  const referenceId = `AADHAAR_OTP_${Date.now()}_${aadhaarCounter}`;

  // Store the OTP as "123456" for mock (in production, Setu sends real OTP)
  MOCK_AADHAAR_OTPS.set(referenceId, '123456');

  return {
    referenceId,
    message: 'OTP sent to mobile number registered with Aadhaar',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min expiry
  };
}

/**
 * Verify Aadhaar OTP — completes eKYC and returns masked Aadhaar data.
 *
 * In production (Setu):
 *   POST https://api.setu.co/v1/aadhaar/verify
 *   Body: { referenceId, otp }
 *   Response: { name, lastFourDigits, yearOfBirth, gender, state, ... }
 */
export async function verifyAadhaarOtp(
  request: AadhaarVerifyRequest,
  userId?: string,
): Promise<AadhaarVerifyResponse> {
  const storedOtp = MOCK_AADHAAR_OTPS.get(request.referenceId);

  if (!storedOtp) {
    return {
      referenceId: request.referenceId,
      isVerified: false,
      lastFourDigits: '',
      message: 'Invalid or expired reference ID. Please request OTP again.',
    };
  }

  // Simulate verification delay
  await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 200));

  if (request.otp !== storedOtp) {
    return {
      referenceId: request.referenceId,
      isVerified: false,
      lastFourDigits: '',
      message: 'Invalid OTP. Please try again.',
    };
  }

  // OTP verified — cleanup
  MOCK_AADHAAR_OTPS.delete(request.referenceId);

  // Mock masked Aadhaar data
  const mockYear = ['1990', '1992', '1995', '1988', '1998', '2000'];
  const mockGenders = ['Male', 'Female'];
  const mockStates = ['Maharashtra', 'Karnataka', 'Delhi', 'Tamil Nadu', 'Uttar Pradesh', 'Gujarat'];

  const response: AadhaarVerifyResponse = {
    referenceId: request.referenceId,
    isVerified: true,
    lastFourDigits: '3456',
    name: 'XXX SHARMA', // Masked name as per Aadhaar regulations
    yearOfBirth: mockYear[Math.floor(Math.random() * mockYear.length)],
    gender: mockGenders[Math.floor(Math.random() * mockGenders.length)],
    state: mockStates[Math.floor(Math.random() * mockStates.length)],
    message: 'Aadhaar verified successfully',
  };

  // Save to KYC state
  if (userId) {
    const state = kycStateStore.get(userId) || createDefaultKycState(userId);
    state.aadhaarVerified = true;
    state.aadhaarLastFour = '3456';
    state.aadhaarVerifiedAt = new Date().toISOString();
    state.updatedAt = new Date().toISOString();
    kycStateStore.set(userId, state);
  }

  return response;
}

/**
 * Get DigiLocker OAuth authorization URL.
 *
 * In production (Setu):
 *   POST https://api.setu.co/v1/digilocker/auth
 *   Body: { redirectUrl: "https://toroloom.app/digilocker/callback" }
 *   Response: { authUrl, referenceId }
 */
export async function getDigiLockerAuthUrl(userId: string): Promise<DigiLockerAuthResponse> {
  await new Promise(resolve => setTimeout(resolve, 300));

  digiLockerCounter++;
  const referenceId = `DL_${Date.now()}_${digiLockerCounter}`;

  // Mock DigiLocker consent URL (in production: Setu-generated URL)
  const authUrl = `https://digilocker.gov.in/authorize?client_id=toroloom&redirect_uri=toroloom://digilocker/callback&state=${referenceId}`;

  return { authUrl, referenceId };
}

/**
 * Fetch DigiLocker documents after user consent.
 *
 * In production (Setu):
 *   GET https://api.setu.co/v1/digilocker/documents?referenceId=...
 *   Headers: { 'x-client-id': ..., 'x-client-secret': ... }
 *   Response: { documents: [{ id, name, issuerId, issuerName, ... }] }
 */
export async function fetchDigiLockerDocuments(
  referenceId: string,
  userId: string,
): Promise<DigiLockerFetchResponse> {
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));

  const mockDocuments: DigiLockerDocument[] = [
    {
      id: 'dl_doc_1',
      name: 'Aadhaar Card',
      issuerId: 'uidai',
      issuerName: 'Unique Identification Authority of India',
      documentType: 'identity',
      issuedAt: new Date(Date.now() - 365 * 86400000 * 3).toISOString(),
      uri: 'digilocker://uidai/aadhaar/xxxx1234',
    },
    {
      id: 'dl_doc_2',
      name: 'PAN Card',
      issuerId: 'incometax',
      issuerName: 'Income Tax Department',
      documentType: 'identity',
      issuedAt: new Date(Date.now() - 365 * 86400000 * 2).toISOString(),
      uri: 'digilocker://incometax/pan/xxxxx1234f',
    },
    {
      id: 'dl_doc_3',
      name: 'Voter ID',
      issuerId: 'eci',
      issuerName: 'Election Commission of India',
      documentType: 'address',
      issuedAt: new Date(Date.now() - 365 * 86400000).toISOString(),
      uri: 'digilocker://eci/voterid/xxxx5678',
    },
  ];

  const response: DigiLockerFetchResponse = {
    referenceId,
    isVerified: true,
    documents: mockDocuments,
    message: 'Documents fetched successfully from DigiLocker',
  };

  // Save to KYC state
  const state = kycStateStore.get(userId) || createDefaultKycState(userId);
  state.digiLockerLinked = true;
  state.digiLockerDocuments = mockDocuments;
  state.digiLockerVerifiedAt = new Date().toISOString();
  state.updatedAt = new Date().toISOString();
  kycStateStore.set(userId, state);

  return response;
}

// ==================== IFSC / Bank Account API ====================

/**
 * Validate IFSC code format.
 */
export function isValidIFSCFormat(ifsc: string): boolean {
  return IFSC_REGEX.test(ifsc.toUpperCase());
}

/**
 * Normalize IFSC: trim, uppercase.
 */
export function normalizeIFSC(ifsc: string): string {
  return ifsc.trim().toUpperCase();
}

/**
 * Verify IFSC code and return bank/branch details.
 */
export async function verifyIFSC(ifsc: string): Promise<IFSCVerificationResult> {
  const normalizedIFSC = normalizeIFSC(ifsc);

  if (!isValidIFSCFormat(normalizedIFSC)) {
    return {
      ifsc: normalizedIFSC,
      bankName: '',
      branch: '',
      address: '',
      city: '',
      state: '',
      contact: '',
      isValid: false,
    };
  }

  await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 200));

  const match = MOCK_IFSC_DATABASE[normalizedIFSC];

  if (!match) {
    return {
      ifsc: normalizedIFSC,
      bankName: '',
      branch: '',
      address: '',
      city: '',
      state: '',
      contact: '',
      isValid: false,
    };
  }

  return {
    ifsc: normalizedIFSC,
    bankName: match.bank,
    branch: match.branch,
    address: match.address,
    city: match.city,
    state: match.state,
    contact: match.contact,
    micrCode: `${normalizedIFSC.slice(0, 4)}XXXXX`,
    isValid: true,
  };
}

/**
 * Verify bank account holder name (mock — in production calls bank verification API).
 * Accepts mock names: RAHUL SHARMA, PRIYA PATEL, VIKRAM REDDY, ARUN KUMAR
 */
export async function verifyBankAccount(
  ifsc: string,
  accountNumber: string,
  accountHolderName: string,
): Promise<AccountVerificationResult> {
  const normalizedIFSC = normalizeIFSC(ifsc);
  const normalizedName = accountHolderName.trim().toUpperCase();

  // Validate IFSC
  const ifscResult = await verifyIFSC(normalizedIFSC);
  if (!ifscResult.isValid) {
    return {
      accountNumber,
      ifsc: normalizedIFSC,
      accountHolderName: '',
      isValid: false,
      bankName: '',
      message: 'Invalid IFSC code.',
    };
  }

  // Validate account number (9-18 digits)
  const cleanedAccount = accountNumber.replace(/\D/g, '');
  if (cleanedAccount.length < 9 || cleanedAccount.length > 18) {
    return {
      accountNumber,
      ifsc: normalizedIFSC,
      accountHolderName: '',
      isValid: false,
      bankName: ifscResult.bankName,
      message: 'Account number must be 9-18 digits.',
    };
  }

  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

  // Mock name validation — known names match
  const validNames = ['RAHUL SHARMA', 'PRIYA PATEL', 'VIKRAM REDDY', 'ARUN KUMAR', 'DEEPIKA VERMA', 'NEHA SINGH', 'SAMEER SHINDE', 'KAJAL AGARWAL'];
  const nameMatches = validNames.some(n => normalizedName.includes(n) || n.includes(normalizedName));

  if (nameMatches) {
    return {
      accountNumber: cleanedAccount,
      ifsc: normalizedIFSC,
      accountHolderName: normalizedName,
      isValid: true,
      bankName: ifscResult.bankName,
      message: 'Account holder name verified successfully.',
      nameMatchScore: 95,
    };
  }

  return {
    accountNumber: cleanedAccount,
    ifsc: normalizedIFSC,
    accountHolderName: normalizedName,
    isValid: false,
    bankName: ifscResult.bankName,
    message: 'Account holder name does not match bank records.',
  };
}

/**
 * Link a bank account to the user's KYC profile.
 */
export async function linkBankAccount(
  userId: string,
  details: {
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountHolderName: string;
    accountType: 'savings' | 'current' | 'salary' | 'other';
    isPrimary: boolean;
  },
): Promise<LinkedBankAccountData> {
  bankAccountCounter++;
  const maskedAccount = 'XXXX' + details.accountNumber.slice(-4);

  const newAccount: LinkedBankAccountData = {
    id: `bank_${Date.now()}_${bankAccountCounter}`,
    bankName: details.bankName,
    accountNumber: maskedAccount,
    ifsc: details.ifsc,
    accountHolderName: details.accountHolderName,
    accountType: details.accountType,
    linkedAt: new Date().toISOString(),
    verified: true,
    isPrimary: details.isPrimary,
  };

  const state = kycStateStore.get(userId) || createDefaultKycState(userId);

  // If setting as primary, un-primary all others
  if (newAccount.isPrimary && state.linkedBanks) {
    state.linkedBanks = state.linkedBanks.map(b => ({ ...b, isPrimary: false }));
  }

  state.linkedBanks = [...(state.linkedBanks || []), newAccount];
  state.updatedAt = new Date().toISOString();
  kycStateStore.set(userId, state);

  return newAccount;
}

/**
 * Get all linked bank accounts for a user.
 */
export async function getLinkedBanks(userId: string): Promise<LinkedBankAccountData[]> {
  const state = kycStateStore.get(userId);
  return state?.linkedBanks || [];
}

/**
 * Remove a linked bank account by ID.
 */
export async function removeLinkedBank(userId: string, accountId: string): Promise<void> {
  const state = kycStateStore.get(userId);
  if (!state || !state.linkedBanks) return;

  state.linkedBanks = state.linkedBanks.filter(b => b.id !== accountId);
  state.updatedAt = new Date().toISOString();
  kycStateStore.set(userId, state);
}

/**
 * Set a linked bank account as primary. Other accounts become non-primary.
 */
export async function setPrimaryBank(userId: string, accountId: string): Promise<LinkedBankAccountData | null> {
  const state = kycStateStore.get(userId);
  if (!state || !state.linkedBanks) return null;

  let updatedAccount: LinkedBankAccountData | null = null;
  state.linkedBanks = state.linkedBanks.map(b => {
    if (b.id === accountId) {
      updatedAccount = { ...b, isPrimary: true };
      return updatedAccount;
    }
    return { ...b, isPrimary: false };
  });
  state.updatedAt = new Date().toISOString();
  kycStateStore.set(userId, state);

  return updatedAccount;
}

/**
 * Get current user's KYC state
 */
export async function getKycState(userId: string): Promise<KycStateData | null> {
  return kycStateStore.get(userId) || null;
}

/**
 * Verify overall KYC after all steps are done
 */
export async function completeKyc(userId: string): Promise<KycStateData> {
  const state = kycStateStore.get(userId) || createDefaultKycState(userId);

  if (!state.panVerified) {
    throw new Error('PAN verification is required before completing KYC.');
  }
  if (!state.aadhaarVerified) {
    throw new Error('Aadhaar verification is required before completing KYC.');
  }

  state.overallKycStatus = 'verified';
  state.completedAt = new Date().toISOString();
  state.updatedAt = new Date().toISOString();
  kycStateStore.set(userId, state);

  return state;
}

/**
 * Reset KYC state for a user (for testing / retry)
 */
export async function resetKyc(userId: string): Promise<void> {
  kycStateStore.delete(userId);
}

// ==================== Helpers ====================

function createDefaultKycState(userId: string): KycStateData {
  return {
    userId,
    panVerified: false,
    aadhaarVerified: false,
    digiLockerLinked: false,
    linkedBanks: [],
    overallKycStatus: 'pending',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Reset all KYC service state (for testing)
 */
export function resetKycService(): void {
  storage = null;
  kycStateStore.clear();
  MOCK_AADHAAR_OTPS.clear();
  aadhaarCounter = 0;
  digiLockerCounter = 0;
  bankAccountCounter = 0;
}
