/**
 * ============================================================================
 * Toroloom — API Key Management Routes
 * ============================================================================
 *
 * These endpoints allow authenticated users to manage their own API keys.
 * All routes require JWT authentication (authMiddleware).
 *
 * Routes:
 *   GET    /api/user/api-keys        — List user's API keys (no hashes)
 *   POST   /api/user/api-keys        — Create a new API key
 *   PUT    /api/user/api-keys/:id    — Update key (name, scopes, expiry)
 *   DELETE /api/user/api-keys/:id    — Revoke/delete an API key
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  generateApiKey,
  listUserApiKeys,
  revokeApiKey,
  deleteApiKey,
} from '../services/apiKeyService';

const router = Router();

// All routes require JWT auth
router.use(authMiddleware);

// ──── GET /api/user/api-keys ────────────────────────────────────────────────
// List all API keys for the authenticated user.
// Note: keyHash is NEVER exposed — only keyPrefix for masking.
router.get('/', async (req: Request, res: Response) => {
  try {
    const keys = await listUserApiKeys(req.user!.userId);

    // Strip sensitive data before sending to client
    const safeKeys = keys.map(k => ({
      id: k.id,
      name: k.name,
      maskedKey: `${k.keyPrefix}...${k.id.slice(-4)}`,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
      isActive: k.isActive,
      lastUsedAt: k.lastUsedAt,
      scopes: k.scopes,
      ipRestrict: k.ipRestrict,
    }));

    res.json({ keys: safeKeys });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to list API keys' });
  }
});

// ──── POST /api/user/api-keys ───────────────────────────────────────────────
// Create a new API key. Returns the full key ONCE — store it client-side.
// Body: { name: string, scopes: string[], expiresInDays?: number, ipRestrict?: string }
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, scopes, expiresInDays, ipRestrict } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Key name is required' });
      return;
    }

    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      res.status(400).json({ error: 'At least one scope is required' });
      return;
    }

    // Validate scopes against known values
    const validScopes = [
      'portfolio:read', 'portfolio:write',
      'market:read',
      'watchlist:read', 'watchlist:write',
      'trades:read', 'trades:write',
      'orders:read', 'orders:write',
      'account:read',
      'ai:read',
      'notifications:read',
    ];

    const invalidScopes = scopes.filter((s: string) => !validScopes.includes(s));
    if (invalidScopes.length > 0) {
      res.status(400).json({
        error: `Invalid scopes: ${invalidScopes.join(', ')}`,
        validScopes,
      });
      return;
    }

    const expiresAt = expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;

    const { key, data } = await generateApiKey(
      req.user!.userId,
      name,
      scopes,
      expiresAt,
      ipRestrict || null,
    );

    res.status(201).json({
      id: data.id,
      name: data.name,
      key, // Full key — shown ONLY on creation
      maskedKey: `${data.keyPrefix}...${data.id.slice(-4)}`,
      scopes: data.scopes,
      expiresAt: data.expiresAt,
      ipRestrict: data.ipRestrict,
      createdAt: data.createdAt,
      message: 'Copy this key now. You will not be able to see it again!',
    });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to create API key' });
  }
});  // ──── PUT /api/user/api-keys/:id ────────────────────────────────────────────
// Update an API key's active status (revoke/reactivate).
// Body: { isActive?: boolean, name?: string, scopes?: string[] }
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body;
    const keyId = req.params.id as string;

    // Deactivation = revoke
    if (isActive === false) {
      const success = await revokeApiKey(keyId, req.user!.userId);
      if (!success) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }
      res.json({ id: keyId, isActive: false, message: 'API key revoked' });
      return;
    }

    // For now, name/scopes updates require full retrieval
    // which the persistence layer supports via overwrite
    res.status(200).json({ id: keyId, message: 'No changes applied' });
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to update API key' });
  }
});

// ──── DELETE /api/user/api-keys/:id ─────────────────────────────────────────
// Permanently delete an API key.
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const keyId = req.params.id as string;
    const success = await deleteApiKey(keyId, req.user!.userId);
    if (!success) {
      res.status(404).json({ error: 'API key not found' });
      return;
    }
    res.status(204).send();
  } catch (error: unknown) {
    res.status(500).json({ error: (error as Error).message || 'Failed to delete API key' });
  }
});

export default router;
