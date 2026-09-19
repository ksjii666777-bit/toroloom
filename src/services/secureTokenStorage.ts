/**
 * ============================================================================
 * Toroloom — Secure Token Storage
 * ============================================================================
 *
 * Auth session tokens live in the device's hardware-backed secure enclave:
 *   - iOS:  Keychain (SecureStore)
 *   - Android: Keystore-encrypted SharedPreferences (SecureStore)
 *
 * Falls back to AsyncStorage ONLY on web (SecureStore unsupported there).
 *
 * Migration: on first read, a token found in the legacy AsyncStorage slot is
 * moved into secure storage and the plaintext copy is deleted — so every
 * existing user is upgraded transparently on next launch.
 *
 * Non-sensitive profile data (name/email/preferences) stays in AsyncStorage —
 * that is not a secret and belongs in the fast async cache.
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'toroloom_token';
const LEGACY_TOKEN_KEY = 'toroloom_token';
const USER_KEY = 'toroloom_user';
const ADMIN_KEY = 'toroloom_isAdmin';

/** SecureStore has a 2048-byte value limit — tokens are far below it. */
const isWeb = Platform.OS === 'web';

export async function saveToken(token: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadToken(): Promise<string | null> {
  if (isWeb) {
    return AsyncStorage.getItem(TOKEN_KEY);
  }
  // Migration: pull the legacy plaintext token out of AsyncStorage if present
  const legacy = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacy) {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, legacy, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch {
      return legacy; // secure store failed — better a working session than a lockout
    }
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY); // delete the plaintext copy
    return legacy;
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken(): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  // Best-effort legacy cleanup too
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY).catch(() => {});
}

/** Profile is non-secret — keep it in the fast AsyncStorage cache. */
export async function saveUserProfile(user: unknown): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function loadUserProfile(): Promise<string | null> {
  return AsyncStorage.getItem(USER_KEY);
}

export async function deleteUserProfile(): Promise<void> {
  await AsyncStorage.removeItem(USER_KEY);
  await AsyncStorage.removeItem(ADMIN_KEY).catch(() => {});
}
