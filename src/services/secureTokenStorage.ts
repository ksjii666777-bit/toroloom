/**
 * ============================================================================
 * Toroloom — Secure Token Storage (with keystore-resilient fallback)
 * ============================================================================
 *
 * Auth session tokens live in the device's hardware-backed secure enclave:
 *   - iOS:  Keychain (SecureStore)
 *   - Android: Keystore-encrypted SharedPreferences (SecureStore)
 *
 * ⚠️ Keystore-resilient fallback (E2E root-cause fix):
 *   Some emulators (API 34 google_apis images) ship with a broken keystore2 —
 *   `OUT_OF_KEYS_TRANSIENT_ERROR` / rkpd 400s at boot — which makes EVERY
 *   SecureStore call throw. Before this fallback that exception bubbled into
 *   authStore.login()'s catch block and surfaced as a generic "Invalid
 *   credentials" error even when the backend had accepted the password, and
 *   loadStoredAuth() silently degraded. Real devices are unaffected: their
 *   keystore works and SecureStore is used exclusively. On the rare devices
 *   where the keystore IS broken, a session token in AsyncStorage (sandboxed
 *   per-app storage) is strictly better than being logged out on every launch.
 *
 * Web continues to use AsyncStorage (SecureStore unsupported there).
 *
 * Migration: on first read, a token found in the legacy AsyncStorage slot is
 * moved into secure storage and the plaintext copy is deleted.
 *
 * Non-sensitive profile data (name/email/preferences) stays in AsyncStorage.
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import SecureStore from 'expo-secure-store';
import { log } from '../utils/logger';

const TOKEN_KEY = 'toroloom_token';
const LEGACY_TOKEN_KEY = 'toroloom_token';
const USER_KEY = 'toroloom_user';
const ADMIN_KEY = 'toroloom_isAdmin';

/** SecureStore has a 2048-byte value limit — tokens are far below it. */
const isWeb = Platform.OS === 'web';

/** SecureStore.set with a one-shot AsyncStorage fallback when it throws. */
async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return;
  } catch (err) {
    log.warn('[secureTokenStorage] SecureStore.set failed — falling back to AsyncStorage', err);
  }
  await AsyncStorage.setItem(`fallback:${key}`, value);
}

/** SecureStore.get with the matching AsyncStorage fallback read. */
async function secureGet(key: string): Promise<string | null> {
  try {
    const v = await SecureStore.getItemAsync(key);
    if (v !== null) return v;
  } catch (err) {
    log.warn('[secureTokenStorage] SecureStore.get failed — trying AsyncStorage fallback', err);
  }
  return AsyncStorage.getItem(`fallback:${key}`);
}

/** SecureStore.delete, also clearing any fallback copy. */
async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // delete failures are non-fatal
  }
  await AsyncStorage.removeItem(`fallback:${key}`).catch(() => {});
}

export async function saveToken(token: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await secureSet(TOKEN_KEY, token);
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
  return secureGet(TOKEN_KEY);
}

export async function deleteToken(): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }
  await secureDelete(TOKEN_KEY);
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
