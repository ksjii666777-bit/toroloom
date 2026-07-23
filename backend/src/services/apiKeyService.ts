/**
 * ============================================================================
 * Toroloom — API Key Management Service
 * ============================================================================
 *
 * Handles generation, hashing, validation, and CRUD for third-party API keys.
 * Keys are generated with a `tol_` prefix and 40 random alphanumeric chars.
 * Only the SHA-256 hash is stored — plaintext is shown once on creation.
 *
 * Usage:
 *   import { configureApiKeyPersistence, generateApiKey, validateApiKey, ... }
 *     from '../services/apiKeyService';
 *
 *   configureApiKeyPersistence(storage);
 *   const { key, data } = await generateApiKey('user_123', 'My Bot', ['market:read']);
 *   const userId = await validateApiKey('tol_abc123...');
 *
 * ============================================================================
 */

import crypto from 'crypto';
import type { StorageEngine, ApiKeyStorageData } from './storage/types';

let storage: StorageEngine | null = null;

// ──── Configuration ─────────────────────────────────────────────────────────

const KEY_PREFIX = 'tol_';
const KEY_LENGTH = 40; // random chars after prefix
const KEY_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// ──── Persistence Wiring ────────────────────────────────────────────────────

/**
 * Configure the API key service with a StorageEngine.
 * Call this during server startup AFTER storage is initialized.
 */
export function configureApiKeyPersistence(s: StorageEngine): void {
  storage = s;
}

// ──── Key Generation ────────────────────────────────────────────────────────

function generateSecureKey(): string {
  let key = KEY_PREFIX;
  const bytes = crypto.randomBytes(KEY_LENGTH);
  for (let i = 0; i < KEY_LENGTH; i++) {
    key += KEY_CHARS[bytes[i] % KEY_CHARS.length];
  }
  return key;
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export interface GeneratedKey {
  /** The full plaintext key. Show this to the user once, then discard. */
  key: string;
  /** The storage record (keyHash stored, not the plaintext key). */
  data: ApiKeyStorageData;
}

/**
 * Generate a new API key for a user.
 * Returns the full key (shown once) and the storage record.
 */
export async function generateApiKey(
  userId: string,
  name: string,
  scopes: string[],
  expiresAt: string | null = null,
  ipRestrict: string | null = null,
): Promise<GeneratedKey> {
  const fullKey = generateSecureKey();
  const keyHash = hashKey(fullKey);
  const now = new Date().toISOString();

  const keyData: ApiKeyStorageData = {
    id: `apik_${crypto.randomUUID().slice(0, 18)}`,
    userId,
    name: name.trim(),
    keyPrefix: fullKey.slice(0, 8),
    keyHash,
    scopes,
    expiresAt,
    isActive: true,
    lastUsedAt: null,
    ipRestrict,
    createdAt: now,
    updatedAt: now,
  };

  if (storage) {
    await storage.saveApiKey(keyData);
  }

  return { key: fullKey, data: keyData };
}

// ──── Key Validation ────────────────────────────────────────────────────────

export interface ApiKeyValidationResult {
  valid: boolean;
  userId: string | null;
  keyId: string | null;
  scopes: string[];
  error?: string;
}

/**
 * Validate an API key.
 * Checks: existence (by hash), active status, expiry, and returns the user + scopes.
 */
export async function validateApiKey(fullKey: string): Promise<ApiKeyValidationResult> {
  if (!storage) {
    return { valid: false, userId: null, keyId: null, scopes: [], error: 'Storage not initialized' };
  }

  const keyHash = hashKey(fullKey);
  const keyData = await storage.loadApiKeyByHash(keyHash);

  if (!keyData) {
    return { valid: false, userId: null, keyId: null, scopes: [], error: 'Invalid API key' };
  }

  if (!keyData.isActive) {
    return { valid: false, userId: null, keyId: null, scopes: [], error: 'API key has been revoked' };
  }

  if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
    return { valid: false, userId: null, keyId: null, scopes: [], error: 'API key has expired' };
  }

  // Touch lastUsedAt (fire-and-forget)
  storage.touchApiKey(keyData.id).catch(() => {});

  return {
    valid: true,
    userId: keyData.userId,
    keyId: keyData.id,
    scopes: keyData.scopes,
  };
}

// ──── CRUD Operations ───────────────────────────────────────────────────────

/**
 * List all API keys for a user (key hashes are NOT exposed — only prefixes).
 */
export async function listUserApiKeys(userId: string): Promise<ApiKeyStorageData[]> {
  if (!storage) return [];
  return storage.loadUserApiKeys(userId);
}

/**
 * Revoke (deactivate) an API key by ID.
 */
export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
  if (!storage) return false;
  const key = await storage.loadApiKey(keyId);
  if (!key || key.userId !== userId) return false;
  key.isActive = false;
  key.updatedAt = new Date().toISOString();
  await storage.saveApiKey(key);
  return true;
}

/**
 * Delete an API key by ID (permanent).
 */
export async function deleteApiKey(keyId: string, userId: string): Promise<boolean> {
  if (!storage) return false;
  const key = await storage.loadApiKey(keyId);
  if (!key || key.userId !== userId) return false;
  await storage.deleteApiKey(keyId);
  return true;
}

/**
 * Check if a API key's scopes include all the required scopes.
 */
export function hasRequiredScopes(keyScopes: string[], requiredScopes: string[]): boolean {
  return requiredScopes.every(s => keyScopes.includes(s));
}

/**
 * Mask a key for display: show first 8 chars, then "...XXXX".
 */
export function maskApiKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}
