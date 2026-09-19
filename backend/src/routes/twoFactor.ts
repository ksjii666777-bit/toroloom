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
 *   POST   /api/auth/2fa/login            — Complete login when 2FA is enabled
 *                                           (email + password + code → full token)
 *
 * Auth: Required (authMiddleware) except /login — that one re-authenticates
 * with credentials to avoid handing a token to an unauthenticated caller.
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, generateToken } from '../middleware/auth';
import { authenticateUser, toPublicUser } from '../data/userStore';
import { sanitizeInput, InputValidationError } from '../middleware/inputSanitizer';
import {
  generateSetup,
  verifyToken,
  enableTwoFactor,
  disableTwoFactor,
  getStatus,
  regenerateBackupCodes,
  getBackupCodes,
  isTwoFactorEnabled,
} from '../services/twoFactor';



const router = Router();

/**
 * POST /api/auth/2fa/login
 *
 * Second leg of the login flow when 2FA is enabled. The first leg
 * (POST /api/auth/login) returns 202 { twoFactorRequired: true } WITHOUT a
 * token; this endpoint issues the full token only after BOTH the password
 * AND a valid TOTP/backup code verify.
 *
 * Body: { email, password, token }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { token } = req.body as { email?: string; password?: string; token?: string };
    let { email, password } = req.body as { email?: string; password?: string };

    try {
      email = sanitizeInput(String(email ?? ''), 'email');
      password = sanitizeInput(String(password ?? ''), 'password');
    } catch (err) {
      if (err instanceof InputValidationError) {
        res.status(400).json({ error: err.message, code: err.code });
        return;
      }
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    if (!token || !/^\d{6,8}$/.test(String(token))) {
      res.status(400).json({ error: 'A valid authentication code is required.' });
      return;
    }

    // Re-authenticate credentials — never trust an unauthenticated caller.
    const user = authenticateUser(email, password);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (!(await isTwoFactorEnabled(user.id))) {
      // 2FA not enabled — normal login path should have been used.
      res.status(400).json({ error: 'Two-factor authentication is not enabled for this account.' });
      return;
    }

    // Attempt-limiter: 5 failed codes per user per 10 minutes (in-memory).
    const key = user.id;
    const now = Date.now();
    const attempts = twoFactorLoginAttempts.get(key) ?? { count: 0, resetAt: now + 10 * 60 * 1000 };
    if (now > attempts.resetAt) {
      attempts.count = 0;
      attempts.resetAt = now + 10 * 60 * 1000;
    }
    if (attempts.count >= 5) {
      res.status(429).json({ error: 'Too many failed attempts. Try again in a few minutes.' });
      return;
    }

    const isValid = await verifyToken(user.id, String(token));
    if (!isValid) {
      attempts.count += 1;
      twoFactorLoginAttempts.set(key, attempts);
      res.status(401).json({ error: 'Invalid code. Please try again.' });
      return;
    }
    twoFactorLoginAttempts.delete(key);

    const tokenIssued = generateToken({ userId: user.id, email: user.email, role: user.role });
    res.json({
      token: tokenIssued,
      user: toPublicUser(user),
    });
  } catch (_err: unknown) {
    res.status(500).json({ error: 'Two-factor login failed' });
  }
});

/** In-memory attempt tracker for the 2FA login leg. */
const twoFactorLoginAttempts = new Map<string, { count: number; resetAt: number }>();

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
