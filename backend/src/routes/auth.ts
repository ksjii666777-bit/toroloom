import { Router, Request, Response } from 'express';
import { generateToken, authMiddleware } from '../middleware/auth';
import { mockUser } from '../data/mockData';

const router = Router();

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  // Simulate auth — in production, validate against DB
  // role can be 'admin' for dev/testing — only works in mock mode
  const effectiveRole = (role === 'admin' ? 'admin' : 'user') as 'user' | 'admin';
  const token = generateToken({ userId: mockUser.id, email, role: effectiveRole });
  res.json({
    token,
    user: { ...mockUser, role: effectiveRole },
  });
});

// POST /api/auth/signup
router.post('/signup', (req: Request, res: Response) => {
  const { name, email, phone } = req.body;

  if (!name || !email || !phone) {
    res.status(400).json({ error: 'Name, email, and phone are required' });
    return;
  }

  const token = generateToken({ userId: `user_${Date.now()}`, email });
  res.json({
    token,
    user: { ...mockUser, id: `user_${Date.now()}`, name, email, phone },
  });
});

// GET /api/auth/profile
router.get('/profile', authMiddleware, (req: Request, res: Response) => {
  res.json({ ...mockUser, email: req.user!.email });
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, (req: Request, res: Response) => {
  const { name, phone } = req.body;
  res.json({
    ...mockUser,
    email: req.user!.email,
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
  });
});

// POST /api/auth/referral
router.post('/referral', authMiddleware, (req: Request, res: Response) => {
  const { source } = req.body;

  if (!source || typeof source !== 'string') {
    res.status(400).json({ error: 'Referral source is required' });
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

export default router;
