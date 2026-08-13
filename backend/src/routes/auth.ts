import { Router, Request, Response } from 'express';
import { generateToken, authMiddleware } from '../middleware/auth';
import { inputSanitizer, InputValidationError, sanitizeInput } from '../middleware/inputSanitizer';
import {
  authenticateUser,
  registerUser,
  findUserByEmail,
  toPublicUser,
  DEMO_EMAIL,
  DEMO_PASSWORD,
} from '../data/userStore';

const router = Router();

// Apply input sanitizer to all auth routes
router.use(inputSanitizer);

// ──── Input Validation Helpers ────────────────────────────────────────────

/**
 * Validate email format — strict but not ReDoS-vulnerable.
 * Max 254 chars per RFC 5321.
 */
function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;
  // Simple but safe check: must have exactly one @, no spaces, valid domain
  const atIndex = email.indexOf('@');
  if (atIndex < 1 || atIndex !== email.lastIndexOf('@')) return false;
  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (localPart.length < 1 || localPart.length > 64) return false;
  if (domain.length < 3 || !domain.includes('.')) return false;
  return true;
}

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  let { email, password } = req.body;
  const { role } = req.body;

  // --- Check required fields first ---
  if (!email && !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }
  if (!password) {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  try {
    email = sanitizeInput(String(email), 'email');
    password = sanitizeInput(String(password), 'password');
  } catch (err) {
    if (err instanceof InputValidationError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  // Validate email format
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  // Authenticate against the user store (scrypt password hash).
  // role can be 'admin' for dev/testing — only works in mock mode and ONLY
  // when the credentials themselves are valid.
  const user = authenticateUser(email, password);
  if (!user) {
    // Don't reveal whether the email or the password was wrong.
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const effectiveRole = (role === 'admin' ? 'admin' : user.role) as 'user' | 'admin';
  const token = generateToken({ userId: user.id, email: user.email, role: effectiveRole });
  res.json({
    token,
    user: { ...toPublicUser(user), role: effectiveRole },
  });
});

// POST /api/auth/signup
router.post('/signup', (req: Request, res: Response) => {
  let { name, email, phone, password } = req.body;

  if (!name || !email || !phone || !password) {
    res.status(400).json({ error: 'Name, email, phone, and password are required' });
    return;
  }

  try {
    name = sanitizeInput(String(name), 'name');
    email = sanitizeInput(String(email), 'email');
    phone = sanitizeInput(String(phone), 'phone');
    password = sanitizeInput(String(password), 'password');
  } catch (err) {
    if (err instanceof InputValidationError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  // Validate email format
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  // Validate phone format (basic: digits only, 10-15 chars)
  const cleanPhone = phone.replace(/[\s\-()]/g, '');
  if (!/^\+?\d{7,15}$/.test(cleanPhone)) {
    res.status(400).json({ error: 'Invalid phone number format' });
    return;
  }

  // Validate password strength (minimum 8 chars)
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  // Register the user in the in-memory store (password hashed with scrypt).
  let user;
  try {
    user = registerUser({ name, email, phone, password });
  } catch (err) {
    if (err instanceof Error && err.message === 'EMAIL_ALREADY_REGISTERED') {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create account' });
    return;
  }

  const token = generateToken({ userId: user.id, email: user.email });
  res.json({
    token,
    user: toPublicUser(user),
  });
});

// GET /api/auth/profile
router.get('/profile', authMiddleware, (req: Request, res: Response) => {
  const user = req.user ? findUserByEmail(req.user.email) : undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(toPublicUser(user));
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, (req: Request, res: Response) => {
  let { name, phone } = req.body;

  try {
    if (name) name = sanitizeInput(String(name), 'name');
    if (phone) phone = sanitizeInput(String(phone), 'phone');
  } catch (err) {
    if (err instanceof InputValidationError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const user = req.user ? findUserByEmail(req.user.email) : undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(
    toPublicUser({
      ...user,
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
    }),
  );
});

// POST /api/auth/referral
router.post('/referral', authMiddleware, (req: Request, res: Response) => {
  let { source } = req.body;

  if (!source || typeof source !== 'string') {
    res.status(400).json({ error: 'Referral source is required' });
    return;
  }

  try {
    source = sanitizeInput(String(source), 'source');
  } catch (err) {
    if (err instanceof InputValidationError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  // In production, store the referral in the user's profile / referrals table.
  // For now, acknowledge and log it.
  console.log(`[Referral] User ${req.user!.userId} recorded referral from: ${source}`);

  res.json({
    success: true,
    message: `Referral source '${source}' recorded for your account. Thanks!`,
  });
});

// GET /api/auth/demo — returns the documented demo credentials (mock mode only).
// Helps testers log in after a backend restart.
router.get('/demo', (_req: Request, res: Response) => {
  res.json({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    note: 'Mock-mode demo account. In production, demo credentials are not exposed.',
  });
});

export default router;
