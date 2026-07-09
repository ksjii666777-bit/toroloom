import { api } from './client';
import type {
  User,
  TwoFactorSetupData,
  TwoFactorStatus,
  BackupCodesResponse,
} from '../../types';

export interface AuthResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }, { skipAuth: true }),

  signup: (name: string, email: string, phone: string, password: string) =>
    api.post<AuthResponse>('/auth/signup', { name, email, phone, password }, { skipAuth: true }),

  getProfile: () => api.get<User>('/auth/profile'),

  updateProfile: (data: { name?: string; phone?: string }) =>
    api.put<User>('/auth/profile', data),

  /** Record a referral source for the currently authenticated user */
  recordReferral: (source: string) =>
    api.post<{ success: boolean; message: string }>('/auth/referral', { source }),

  // ═══ 2FA / TOTP ═══════════════════════════════════════════════

  /** Generate TOTP setup — secret, otpauth URI, backup codes */
  generate2FASetup: () =>
    api.post<TwoFactorSetupData>('/auth/2fa/setup'),

  /** Verify TOTP token during setup & auto-enable 2FA */
  verify2FAToken: (token: string) =>
    api.post<{ verified: boolean; enabled: boolean; message: string }>('/auth/2fa/verify', { token }),

  /** Enable 2FA (after verification) */
  enable2FA: () =>
    api.post<{ success: boolean; message: string }>('/auth/2fa/enable'),

  /** Disable 2FA (requires current TOTP code or backup code) */
  disable2FA: (token: string) =>
    api.post<{ success: boolean; message: string }>('/auth/2fa/disable', { token }),

  /** Get 2FA status */
  get2FAStatus: () =>
    api.get<TwoFactorStatus>('/auth/2fa/status'),

  /** Regenerate backup codes (invalidates old ones) */
  regenerateBackupCodes: () =>
    api.post<{ codes: string[]; message: string }>('/auth/2fa/backup-codes'),

  /** Get remaining backup codes */
  getBackupCodes: () =>
    api.get<BackupCodesResponse>('/auth/2fa/backup-codes'),
};
