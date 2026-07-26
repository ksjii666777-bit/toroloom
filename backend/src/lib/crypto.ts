/**
 * ============================================================================
 * Toroloom — AES-256-GCM Encryption Utility
 * ============================================================================
 *
 * Enterprise-grade encryption for sensitive data at rest.
 * Uses AES-256-GCM (authenticated encryption) with random IV per operation.
 *
 * Usage:
 *   import { encrypt, decrypt } from '../lib/crypto';
 *   const ciphertext = encrypt('my-sensitive-data');
 *   const plaintext = decrypt(ciphertext);
 *
 * ============================================================================
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;       // 128-bit IV
const TAG_LENGTH = 16;      // 128-bit auth tag
const KEY_ENV = 'SNAPTRADE_ENCRYPTION_KEY';

/**
 * Derive a 256-bit key from a passphrase using scrypt.
 * The SNAPTRADE_ENCRYPTION_KEY env var is REQUIRED in production.
 * Falls back to a warning + dev-only key for local development.
 */
function getEncryptionKey(): Buffer {
  const passphrase = process.env[KEY_ENV];
  if (!passphrase) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[crypto] FATAL: ' + KEY_ENV + ' is not set.\n' +
        '  Generate a 256-bit key with: openssl rand -hex 32\n' +
        '  Set it in Railway Dashboard → Variables → ' + KEY_ENV,
      );
    }
    console.warn(
      '[crypto] WARNING: ' + KEY_ENV + ' not set. Using DEVELOPMENT key.\n' +
      '           Generate a key with: openssl rand -hex 32\n' +
      '           Set it in Railway Dashboard → Variables → ' + KEY_ENV,
    );
    // Dev-only fallback: NOT for production use
    // (Rebrand via scripts/rebrand.mjs)
    const devKey = 'toroloom-dev-only-key-do-not-use-in-production';
    return crypto.scryptSync(devKey, 'toroloom-salt', 32);
  }
  return crypto.scryptSync(passphrase, 'toroloom-salt', 32);
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * Output format (hex-encoded):
 *   iv:authTag:ciphertext
 *
 * @param plaintext - The string to encrypt
 * @returns Hex-encoded ciphertext with IV and auth tag
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Encode as: iv:tag:ciphertext (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a ciphertext string that was encrypted with encrypt().
 *
 * @param encrypted - Hex-encoded ciphertext in format iv:authTag:ciphertext
 * @returns The original plaintext string
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export function decrypt(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format. Expected iv:authTag:ciphertext');
  }

  const [ivHex, tagHex, dataHex] = parts;
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex'),
  );

  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
