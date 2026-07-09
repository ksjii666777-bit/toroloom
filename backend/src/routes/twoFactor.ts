/**
 * ============================================================================
 * Toroloom — Two-Factor Authentication (TOTP) Routes
 * ============================================================================
 *
 * Endpoints for TOTP-based 2FA setup, verification, and management.
 *
 * Endpoints:
 *   POST   /api/auth/2fa/setup            — Generate TOTP secret + URI + backup codes
 *   POST   /api/auth/2fa/verify           — Verify TOTP token (setup confirmation)
 *   POST   /api/auth/2fa/enable           — Enable 2FA (after successful verify)
 *   POST   /api/auth/2fa/disable          — Disable 2FA (requires current code)
 *   GET    /api/auth/2fa/status           — Get current 2FA status
 *   POST   /api/auth/2fa/backup-codes     — Regenerate backup codes
 *   GET    /api/auth/2fa/backup-codes     — Get remaining backup codes
 *
 * Auth: Required (authMiddleware except for login-verify)
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  generateSetup,
  verifyToken,
  enableTwoFactor,
  disableTwoFactor,
  getStatus,
  regenerateBackupCodes,
  getBackupCodes,
} from '../services/twoFactor';

const router = Router();

/**
 * POST /api/auth/2fa/setup
 *
 * Generate TOTP secret, otpauth URI (for QR code), and backup codes.
 * Secret is stored in pending state until verified.
 */
router.post('/setup', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await generateSetup(req.user!.userId, req.user!.email);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate 2FA setup' });
  }
});

/**
 * POST /api/auth/2fa/verify
 *
 * Verify a TOTP token during setup. If valid, the pending secret is
 * promoted to active and 2FA is enabled.
 *
 * Body: { token: string }
 */
router.post('/verify', authMiddleware, async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token || !/^\d{6}$/.test(token)) {
    res.status(400).json({ error: 'A 6-digit verification code is required.' });
    return;
  }

  try {
    const isValid = await verifyToken(req.user!.userId, token);

    if (!isValid) {
      res.status(400).json({
        verified: false,
        error: 'Invalid code. Please check your authenticator app and try again.',
      });
      return;
    }

    // verifyToken already promotes pending→active and sets enabled:true
    res.json({ verified: true, enabled: true, message: 'Two-factor authentication has been enabled successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Verification failed' });
  }
});

/**
 * POST /api/auth/2fa/enable
 *
 * Enable 2FA after successful setup verification.
 */
router.post('/enable', authMiddleware, async (req: Request, res: Response) => {
  try {
    await enableTwoFactor(req.user!.userId);
    res.json({ success: true, message: 'Two-factor authentication enabled.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to enable 2FA' });
  }
});

/**
 * POST /api/auth/2fa/disable
 *
 * Disable 2FA. Requires current TOTP code or backup code for verification.
 *
 * Body: { token: string }
 */
router.post('/disable', authMiddleware, async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    res.status(400).json({ error: 'Verification code is required to disable 2FA.' });
    return;
  }

  try {
    await disableTwoFactor(req.user!.userId, token);
    res.json({ success: true, message: 'Two-factor authentication has been disabled.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to disable 2FA' });
  }
});

/**
 * GET /api/auth/2fa/status
 *
 * Returns whether 2FA is enabled and its setup status.
 */
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const status = await getStatus(req.user!.userId);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get 2FA status' });
  }
});

/**
 * POST /api/auth/2fa/backup-codes
 *
 * Regenerate backup codes (invalidates all previous codes).
 */
router.post('/backup-codes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const codes = await regenerateBackupCodes(req.user!.userId);
    res.json({ codes, message: 'Backup codes regenerated successfully. Save these in a secure place.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to regenerate backup codes' });
  }
});

/**
 * GET /api/auth/2fa/backup-codes
 *
 * Get remaining backup codes (shows only unused codes).
 */
router.get('/backup-codes', authMiddleware, async (req: Request, res: Response) => {
  try {
    const codes = await getBackupCodes(req.user!.userId);
    res.json({ codes, unusedCount: codes.filter(c => !c.used).length });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to fetch backup codes' });
  }
});

export default router;
