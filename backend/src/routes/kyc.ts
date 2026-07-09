/**
 * ============================================================================
 * Toroloom — KYC Verification Routes
 * ============================================================================
 *
 * Endpoints for PAN verification, Aadhaar eKYC (OTP flow), DigiLocker
 * document fetch, and overall KYC status management.
 *
 * Endpoints:
 *   POST   /api/kyc/pan/verify           — Verify PAN number
 *   POST   /api/kyc/aadhaar/otp           — Send Aadhaar OTP
 *   POST   /api/kyc/aadhaar/verify        — Verify Aadhaar OTP
 *   POST   /api/kyc/digilocker/auth       — Get DigiLocker auth URL
 *   POST   /api/kyc/digilocker/fetch      — Fetch DigiLocker documents
 *   GET    /api/kyc/status                — Get current KYC state
 *   POST   /api/kyc/complete              — Complete KYC (all steps done)
 *   POST   /api/kyc/reset                 — Reset KYC (admin/retry)
 *
 * Auth: Required (authMiddleware)
 * Rate limit: writeLimiter (50 req/min)
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import {
  verifyPan,
  sendAadhaarOtp,
  verifyAadhaarOtp,
  getDigiLockerAuthUrl,
  fetchDigiLockerDocuments,
  getKycState,
  completeKyc,
  resetKyc,
  isValidPanFormat,
  normalizePan,
  verifyIFSC,
  verifyBankAccount,
  linkBankAccount,
  getLinkedBanks,
  removeLinkedBank,
  setPrimaryBank,
  isValidIFSCFormat,
  normalizeIFSC,
} from '../services/kyc';

const router = Router();

/**
 * POST /api/kyc/pan/verify
 * Body: { panNumber: string }
 *
 * Returns PAN verification result with name match check.
 */
router.post('/pan/verify', async (req: Request, res: Response) => {
  const { panNumber } = req.body;

  if (!panNumber) {
    res.status(400).json({ error: 'PAN number is required' });
    return;
  }

  const normalizedPan = normalizePan(panNumber);

  if (!isValidPanFormat(normalizedPan)) {
    res.status(400).json({
      error: 'Invalid PAN format. PAN must be a 10-character alphanumeric code (e.g., ABCDE1234F)',
      panNumber: normalizedPan,
      isVerified: false,
      status: 'INVALID',
    });
    return;
  }

  try {
    const result = await verifyPan({ panNumber: normalizedPan, userId: req.user!.userId });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'PAN verification failed' });
  }
});

/**
 * POST /api/kyc/aadhaar/otp
 * Body: { aadhaarNumber: string, consent: boolean }
 *
 * Sends OTP to Aadhaar-linked mobile number.
 * Requires explicit user consent.
 */
router.post('/aadhaar/otp', async (req: Request, res: Response) => {
  const { aadhaarNumber, consent } = req.body;

  if (!aadhaarNumber) {
    res.status(400).json({ error: 'Aadhaar number is required' });
    return;
  }

  if (!consent) {
    res.status(400).json({
      error: 'User consent is required for Aadhaar verification. Please provide consent: true.',
    });
    return;
  }

  try {
    const result = await sendAadhaarOtp({ aadhaarNumber, consent });
    // Mask Aadhaar number in response
    const masked = aadhaarNumber.replace(/.(?=.{4})/g, 'X');
    res.json({ ...result, maskedAadhaar: masked });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to send Aadhaar OTP' });
  }
});

/**
 * POST /api/kyc/aadhaar/verify
 * Body: { referenceId: string, otp: string }
 *
 * Verifies the OTP and returns masked Aadhaar data.
 */
router.post('/aadhaar/verify', async (req: Request, res: Response) => {
  const { referenceId, otp } = req.body;

  if (!referenceId || !otp) {
    res.status(400).json({ error: 'referenceId and otp are required' });
    return;
  }

  if (!/^\d{6}$/.test(otp)) {
    res.status(400).json({ error: 'OTP must be a 6-digit number' });
    return;
  }

  try {
    const result = await verifyAadhaarOtp({ referenceId, otp }, req.user!.userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Aadhaar verification failed' });
  }
});

/**
 * POST /api/kyc/digilocker/auth
 *
 * Returns DigiLocker OAuth authorization URL.
 * Frontend opens this URL in a WebView for user consent.
 */
router.post('/digilocker/auth', async (req: Request, res: Response) => {
  try {
    const result = await getDigiLockerAuthUrl(req.user!.userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get DigiLocker auth URL' });
  }
});

/**
 * POST /api/kyc/digilocker/fetch
 * Body: { referenceId: string }
 *
 * Fetches documents from DigiLocker after user consent.
 */
router.post('/digilocker/fetch', async (req: Request, res: Response) => {
  const { referenceId } = req.body;

  if (!referenceId) {
    res.status(400).json({ error: 'referenceId is required' });
    return;
  }

  try {
    const result = await fetchDigiLockerDocuments(referenceId, req.user!.userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch DigiLocker documents' });
  }
});

/**
 * GET /api/kyc/status
 *
 * Returns the current user's KYC state.
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const state = await getKycState(req.user!.userId);
    res.json(state || { userId: req.user!.userId, overallKycStatus: 'pending', steps: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get KYC status' });
  }
});

/**
 * POST /api/kyc/complete
 *
 * Marks KYC as complete after all verification steps pass.
 */
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const state = await completeKyc(req.user!.userId);
    res.json({ success: true, state });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/kyc/reset
 *
 * Resets KYC for the current user (allows re-verification).
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    await resetKyc(req.user!.userId);
    res.json({ success: true, message: 'KYC has been reset. You can re-verify now.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reset KYC' });
  }
});

/**
 * POST /api/kyc/bank/verify-ifsc
 * Body: { ifsc: string }
 *
 * Verify IFSC code and return bank/branch details.
 */
router.post('/bank/verify-ifsc', async (req: Request, res: Response) => {
  const { ifsc } = req.body;

  if (!ifsc) {
    res.status(400).json({ error: 'IFSC code is required' });
    return;
  }

  const normalizedIFSC = normalizeIFSC(ifsc);
  if (!isValidIFSCFormat(normalizedIFSC)) {
    res.status(400).json({
      error: 'Invalid IFSC format. IFSC must be 11 characters (e.g., HDFC0001234)',
      ifsc: normalizedIFSC,
      isValid: false,
    });
    return;
  }

  try {
    const result = await verifyIFSC(normalizedIFSC);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'IFSC verification failed' });
  }
});

/**
 * POST /api/kyc/bank/verify-account
 * Body: { ifsc: string, accountNumber: string, accountHolderName: string }
 *
 * Verify bank account holder name (mock Penny Drop API).
 */
router.post('/bank/verify-account', async (req: Request, res: Response) => {
  const { ifsc, accountNumber, accountHolderName } = req.body;

  if (!ifsc || !accountNumber || !accountHolderName) {
    res.status(400).json({ error: 'ifsc, accountNumber, and accountHolderName are required' });
    return;
  }

  try {
    const result = await verifyBankAccount(ifsc, accountNumber, accountHolderName);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Account verification failed' });
  }
});

/**
 * POST /api/kyc/bank/link
 * Body: { bankName, accountNumber, ifsc, accountHolderName, accountType, isPrimary }
 *
 * Link a verified bank account to the user's profile.
 */
router.post('/bank/link', async (req: Request, res: Response) => {
  const { bankName, accountNumber, ifsc, accountHolderName, accountType, isPrimary } = req.body;

  if (!bankName || !accountNumber || !ifsc || !accountHolderName) {
    res.status(400).json({ error: 'bankName, accountNumber, ifsc, and accountHolderName are required' });
    return;
  }

  try {
    const result = await linkBankAccount(req.user!.userId, {
      bankName,
      accountNumber,
      ifsc,
      accountHolderName,
      accountType: accountType || 'savings',
      isPrimary: isPrimary === true,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to link bank account' });
  }
});

/**
 * GET /api/kyc/bank/linked
 *
 * Get all linked bank accounts for the current user.
 */
router.get('/bank/linked', async (req: Request, res: Response) => {
  try {
    const banks = await getLinkedBanks(req.user!.userId);
    res.json(banks);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch linked banks' });
  }
});

/**
 * POST /api/kyc/bank/remove
 * Body: { accountId: string }
 *
 * Remove a linked bank account.
 */
router.post('/bank/remove', async (req: Request, res: Response) => {
  const { accountId } = req.body;

  if (!accountId) {
    res.status(400).json({ error: 'accountId is required' });
    return;
  }

  try {
    await removeLinkedBank(req.user!.userId, accountId);
    res.json({ success: true, message: 'Bank account removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to remove bank account' });
  }
});

/**
 * POST /api/kyc/bank/set-primary
 * Body: { accountId: string }
 *
 * Set a linked bank account as the primary account.
 */
router.post('/bank/set-primary', async (req: Request, res: Response) => {
  const { accountId } = req.body;

  if (!accountId) {
    res.status(400).json({ error: 'accountId is required' });
    return;
  }

  try {
    const result = await setPrimaryBank(req.user!.userId, accountId);
    if (!result) {
      res.status(404).json({ error: 'Bank account not found' });
      return;
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to set primary bank' });
  }
});

export default router;
