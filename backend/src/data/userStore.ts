/**
 * ============================================================================
 * Toroloom — In-Memory User Store (Mock Mode)
 * ============================================================================
 *
 * Mock-mode credential storage so login actually validates passwords instead
 * of accepting any email/password combination.
 *
 * Design notes:
 *   - Uses Node's built-in crypto.scryptSync for password hashing (no new
 *     dependency, no plaintext passwords in memory/logs).
 *   - Storage is in-memory only and resets on restart — this matches the
 *     existing mock-mode contract (health endpoint reports
 *     `storageBackend: "memory"`). Production should validate against a real
 *     DB with bcrypt/argon2 (see auth.ts comments).
 *   - Seeded with the demo user (mockUser) so existing app flows keep working
 *     with the documented demo credentials.
 * ============================================================================
 */

import crypto from 'crypto';
import { mockUser } from './mockData';

// ──── Types ────────────────────────────────────────────────────────────────

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** scrypt hash, format: <saltHex>:<hashHex> */
  passwordHash: string;
  role: 'user' | 'admin';
  kycStatus: string;
  balance: number;
  createdAt: string;
  panNumber?: string;
  avatar?: string;
}

// ──── Public demo credentials (documented for testing) ────────────────────

/** Credentials that always work against the seeded demo account. */
export const DEMO_EMAIL = 'rahul.sharma@email.com';
export const DEMO_PASSWORD = 'Demo@12345';

// ──── Password hashing (scrypt, per-user salt) ────────────────────────────

const SCRYPT_KEYLEN = 64;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  // Timing-safe comparison
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

// ──── Store ────────────────────────────────────────────────────────────────

const users = new Map<string, StoredUser>();

/** Seed the demo user so existing flows work after a restart. */
function seedDemoUser(): void {
  const demoUser: StoredUser = {
    id: mockUser.id,
    name: mockUser.name,
    email: DEMO_EMAIL,
    phone: mockUser.phone,
    passwordHash: hashPassword(DEMO_PASSWORD),
    role: 'user',
    kycStatus: mockUser.kycStatus,
    balance: mockUser.balance,
    createdAt: mockUser.createdAt,
    panNumber: mockUser.panNumber,
  };
  users.set(DEMO_EMAIL.toLowerCase(), demoUser);
}

seedDemoUser();

// ──── Public API ───────────────────────────────────────────────────────────

/**
 * Find a stored user by email (case-insensitive).
 * Returns undefined if the email is not registered.
 */
export function findUserByEmail(email: string): StoredUser | undefined {
  return users.get(email.trim().toLowerCase());
}

/**
 * Register a new user. Throws if the email is already taken.
 * Passwords are hashed with scrypt before storage.
 */
export function registerUser(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): StoredUser {
  const emailKey = input.email.trim().toLowerCase();
  if (users.has(emailKey)) {
    throw new Error('EMAIL_ALREADY_REGISTERED');
  }

  const user: StoredUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: input.name,
    email: input.email.trim(),
    phone: input.phone,
    passwordHash: hashPassword(input.password),
    role: 'user',
    kycStatus: 'pending',
    balance: mockUser.balance,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  users.set(emailKey, user);
  return user;
}

/**
 * Validate credentials against the store.
 * Returns the user on success, or null on wrong email/password.
 */
export function authenticateUser(
  email: string,
  password: string,
): StoredUser | null {
  const user = findUserByEmail(email);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}

/**
 * Strip sensitive fields (passwordHash) before returning to the client.
 */
export function toPublicUser(user: StoredUser) {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

/** Number of registered users (including the seeded demo account). */
export function userCount(): number {
  return users.size;
}
