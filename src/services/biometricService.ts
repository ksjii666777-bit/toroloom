/**
 * ============================================================================
 * Toroloom — Biometric Authentication Service
 * ============================================================================
 *
 * Wraps expo-local-authentication to provide a clean API for:
 *   - Checking hardware availability (hasHardware)
 *   - Checking if the user has enrolled biometrics (isEnrolled)
 *   - Supported authentication types (face, fingerprint, iris)
 *   - Authenticating with biometric + device passcode fallback
 *
 * Usage:
 *   import { biometricAuth } from '../services/biometricService';
 *
 *   const available = await biometricAuth.isAvailable();
 *   if (available) {
 *     const result = await biometricAuth.authenticate('Unlock Toroloom');
 *     if (result.success) { // proceed with action
 *   }
 *   }
 *
 * ============================================================================
 */

import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'unknown';

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  biometricType?: BiometricType;
}

/**
 * Biometric authentication service.
 * All methods gracefully degrade — returns false/null on error instead of throwing.
 */
export const biometricAuth = {
  /**
   * Check if biometric authentication is available on this device.
   * Returns true only if the device has biometric hardware AND the user
   * has enrolled at least one biometric (fingerprint / Face ID).
   */
  isAvailable: async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return false;

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return isEnrolled;
    } catch {
      return false;
    }
  },

  /**
   * Get the supported biometric types on this device.
   */
  getBiometricType: async (): Promise<BiometricType> => {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'fingerprint';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'facial';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'iris';
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  },

  /**
   * Prompt the user for biometric authentication.
   *
   * @param reason — The message shown in the system biometric prompt (e.g. "Log in to Toroloom")
   * @param fallbackToPasscode — If true, shows "Enter Passcode" fallback button
   * @returns BiometricAuthResult with success status and optional error message
   */
  authenticate: async (
    reason: string = 'Authenticate to continue',
    fallbackToPasscode: boolean = true,
  ): Promise<BiometricAuthResult> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: fallbackToPasscode ? 'Enter Passcode' : undefined,
        disableDeviceFallback: !fallbackToPasscode,
        // On iOS, require biometric confirmation (Face ID must explicitly authenticate)
        requireConfirmation: true,
      });

      if (result.success) {
        return { success: true };
      }

      // Map error codes to user-friendly messages
      let error: string;
      switch (result.error) {
        case 'user_cancel':
          error = 'Authentication cancelled';
          break;
        case 'not_enrolled':
          error = 'No biometrics enrolled on this device';
          break;
        case 'not_available':
          error = 'Biometric authentication not available';
          break;
        case 'lockout':
          error = 'Too many attempts. Try again later.';
          break;
        case 'passcode_not_set':
          error = 'Device passcode is not set';
          break;
        default:
          error = result.error || 'Authentication failed';
      }

      return { success: false, error };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'An unexpected error occurred',
      };
    }
  },

  /**
   * Get a human-readable label for the device's biometric type.
   * e.g., "Face ID" on iOS, "Fingerprint" on Android.
   */
  getBiometricLabel: async (): Promise<string> => {
    const type = await biometricAuth.getBiometricType();
    switch (type) {
      case 'facial':
        // Platform-specific naming
        // On iOS this is "Face ID", on Android it varies
        return 'Face ID';
      case 'fingerprint':
        return 'Fingerprint';
      case 'iris':
        return 'Iris';
      default:
        return 'Biometric';
    }
  },

  /**
   * Get the icon name (Ionicons) for the device's biometric type.
   */
  getBiometricIcon: async (): Promise<string> => {
    const type = await biometricAuth.getBiometricType();
    switch (type) {
      case 'facial':
        return 'scan';
      case 'fingerprint':
        return 'finger-print';
      case 'iris':
        return 'eye';
      default:
        return 'lock-closed';
    }
  },
};
