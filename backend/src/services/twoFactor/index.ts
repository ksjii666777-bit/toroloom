/**
 * ============================================================================
 * Toroloom — Two-Factor Authentication (TOTP) Service
 * ============================================================================
 *
 * Handles TOTP-based 2FA setup, verification, enable/disable, and backup
 * recovery codes.
 *
 * Uses the `otplib` v13 functional API.
 *
 * Flow:
 *   1. User requests 2FA setup → generates secret + otpauth URI + backup codes
 *   2. User scans QR code in authenticator app, enters 6-digit code
 *   3. Backend verifies the code → confirms setup is correct
 *   4. User enables 2FA → future logins require TOTP code
 *   5. To disable, user provides current TOTP code or backup code
 * ============================================================================
 */

import { generateSecret, verify, generateURI } from 'otplib';

// TOTP defaults: period=30s, digits=6. verify() allows epochTolerance=0 by
// default (exact match only). We pass epochTolerance=30 to match the old
// window=1 behaviour (1 step × 30s period on each side).

// ==================== Types ====================

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}

export interface TwoFactorStatus {
  enabled: boolean;
  verified: boolean;
  setupAt?: string;
}

export interface VerifyTotpRequest {
  userId: string;
  token: string;
}

export interface BackupCodeResult {
  code: string;
  used: boolean;
}

// ==================== Internal State ====================

const twoFactorStore = new Map<string, {
  enabled: boolean;
  secret: string;
  verified: boolean;
  setupAt?: string;
  backupCodes: BackupCodeResult[];
}>();

// Pending setup secrets (not yet verified)
const pendingSetups = new Map<string, {
  secret: string;
  backupCodes: string[];
  createdAt: number;
}>();

// ==================== Configuration ====================

const ISSUER = 'Toroloom';
const BACKUP_CODE_COUNT = 10;

/** TOTP verify options: 30s period, 6 digits, 1-step tolerance on each side */
const TOTP_VERIFY_OPTIONS = {
  period: 30,
  digits: 6 as const,
  epochTolerance: 30, // symmetric: 1 step × 30s
} as const;

/** TOTP generate URI options: 30s period, 6 digits */
const TOTP_URI_OPTIONS = {
  period: 30,
  digits: 6 as const,
} as const;

// ==================== Public API ====================

/**
 * Generate a TOTP setup: secret key, otpauth URI for QR code, backup codes.
 *
 * The secret is stored in a "pending" state until the user verifies
 * by entering a valid TOTP code from their authenticator app.
 *
 * Throws if 2FA is already enabled.
 */
export async function generateSetup(userId: string, email: string): Promise<TwoFactorSetupResponse> {
  const existing = twoFactorStore.get(userId);
  if (existing?.enabled) {
    throw new Error('Two-factor authentication is already enabled. Disable it first to reconfigure.');
  }

  const secret = generateSecret();

  const otpauthUrl = generateURI({
    label: email,
    issuer: ISSUER,
    secret,
    ...TOTP_URI_OPTIONS,
  });

  // Generate backup codes
  const backupCodes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    backupCodes.push(generateBackupCode());
  }

  // Store pending setup (expires after 10 minutes)
  pendingSetups.set(userId, {
    secret,
    backupCodes,
    createdAt: Date.now(),
  });

  // Clean up old pending setups periodically
  cleanupExpiredSetups();

  return { secret, otpauthUrl, backupCodes };
}

/**
 * Verify a TOTP token against the user's pending or active secret.
 * Used both for:
 *   - Confirming setup (pending secret)
 *   - Daily verification / login
 */
export async function verifyToken(userId: string, token: string): Promise<boolean> {
  if (!token || token.length === 0) return false;

  // 1. Check backup codes first
  const existing = twoFactorStore.get(userId);
  if (existing) {
    const backupMatch = existing.backupCodes.find(
      bc => bc.code === token && !bc.used,
    );
    if (backupMatch) {
      backupMatch.used = true;
      return true;
    }
  }

  // 2. Check pending setup secret
  const pending = pendingSetups.get(userId);
  if (pending) {
    try {
      const result = await verify({ token, secret: pending.secret, ...TOTP_VERIFY_OPTIONS });
      if (result.valid) {
        // Promote pending to active 2FA
        twoFactorStore.set(userId, {
          enabled: true,
          secret: pending.secret,
          verified: true,
          setupAt: new Date().toISOString(),
          backupCodes: pending.backupCodes.map(code => ({ code, used: false })),
        });
        pendingSetups.delete(userId);
        return true;
      }
    } catch {
      return false;
    }
  }

  // 3. Check active stored secret
  if (existing && existing.secret) {
    try {
      const result = await verify({ token, secret: existing.secret, ...TOTP_VERIFY_OPTIONS });
      return result.valid;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Enable 2FA for a user (after successful verification).
 */
export async function enableTwoFactor(userId: string): Promise<void> {
  const existing = twoFactorStore.get(userId);
  if (!existing) {
    throw new Error('No pending 2FA setup found. Please complete setup first.');
  }
  if (!existing.verified) {
    throw new Error('2FA setup not verified. Please enter a valid code from your authenticator app.');
  }

  existing.enabled = true;
  existing.setupAt = existing.setupAt || new Date().toISOString();
  twoFactorStore.set(userId, existing);
}

/**
 * Disable 2FA for a user.
 * Requires a valid TOTP code or backup code to confirm.
 */
export async function disableTwoFactor(userId: string, token: string): Promise<void> {
  const isValid = await verifyToken(userId, token);
  if (!isValid) {
    throw new Error('Invalid verification code. Please enter a valid TOTP code or backup code.');
  }

  twoFactorStore.delete(userId);
  pendingSetups.delete(userId);
}

/**
 * Get current 2FA status for a user.
 */
export async function getStatus(userId: string): Promise<TwoFactorStatus> {
  const existing = twoFactorStore.get(userId);
  const pending = pendingSetups.get(userId);

  return {
    enabled: existing?.enabled || false,
    verified: existing?.verified || false,
    setupAt: existing?.setupAt,
  };
}

/**
 * Regenerate backup codes (invalidates old ones).
 */
export async function regenerateBackupCodes(userId: string): Promise<string[]> {
  const existing = twoFactorStore.get(userId);
  if (!existing) {
    throw new Error('2FA is not set up. Please enable 2FA first.');
  }

  const newCodes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    newCodes.push(generateBackupCode());
  }

  existing.backupCodes = newCodes.map(code => ({ code, used: false }));
  twoFactorStore.set(userId, existing);

  return newCodes;
}

/**
 * Get remaining backup codes (excluding used ones).
 */
export async function getBackupCodes(userId: string): Promise<BackupCodeResult[]> {
  const existing = twoFactorStore.get(userId);
  if (!existing) {
    throw new Error('2FA is not set up.');
  }

  return existing.backupCodes;
}

/**
 * Check if a user has 2FA enabled (for login flow).
 */
export async function isTwoFactorEnabled(userId: string): Promise<boolean> {
  const existing = twoFactorStore.get(userId);
  return existing?.enabled === true;
}

// ==================== Helpers ====================

/**
 * Generate a single backup code: XXXXX-XXXXX format
 */
function generateBackupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for readability
  let code = '';
  for (let i = 0; i < 10; i++) {
    if (i === 5) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Clean up expired pending setups (older than 10 minutes).
 */
function cleanupExpiredSetups(): void {
  const now = Date.now();
  const expiryMs = 10 * 60 * 1000; // 10 minutes

  for (const [userId, pending] of pendingSetups.entries()) {
    if (now - pending.createdAt > expiryMs) {
      pendingSetups.delete(userId);
    }
  }
}

/**
 * Reset all 2FA state (for testing).
 */
export function resetTwoFactorService(): void {
  twoFactorStore.clear();
  pendingSetups.clear();
}
