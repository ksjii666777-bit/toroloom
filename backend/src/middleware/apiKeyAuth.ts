/**
 * ============================================================================
 * Toroloom — API Key Authentication Middleware
 * ============================================================================
 *
 * Validates `X-API-Key` header against stored SHA-256 hashes.
 * For public API v1 routes — allows third-party apps to access
 * user data without JWT tokens.
 *
 * Usage:
 *   import { apiKeyAuth, requireApiScopes } from '../middleware/apiKeyAuth';
 *
 *   router.use(apiKeyAuth);
 *   router.get('/holdings', requireApiScopes(['portfolio:read']), handler);
 *
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { validateApiKey } from '../services/apiKeyService';

// Extend Express Request to include API key info
declare global {
  namespace Express {
    interface Request {
      apiKeyInfo?: {
        userId: string;
        keyId: string;
        scopes: string[];
      };
    }
  }
}

/**
 * Middleware that authenticates via X-API-Key header.
 * On success, sets req.apiKeyInfo with userId, keyId, and scopes.
 * On failure, returns 401 with error message.
 */
export async function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    // If they sent a Bearer token, let JWT auth handle it instead
    if (req.headers.authorization?.startsWith('Bearer ')) {
      next();
      return;
    }
    res.status(401).json({
      error: 'Missing API key',
      docs: 'Pass your API key via the X-API-Key header. Get one at /api/user/api-keys',
    });
    return;
  }

  const result = await validateApiKey(apiKey);

  if (!result.valid) {
    res.status(401).json({ error: result.error });
    return;
  }

  req.apiKeyInfo = {
    userId: result.userId!,
    keyId: result.keyId!,
    scopes: result.scopes,
  };

  // Also set req.user for compatibility with existing route handlers
  req.user = { userId: result.userId!, email: '', role: 'user' };

  next();
}

/**
 * Middleware factory that checks if the authenticated API key
 * has the required scopes. Must be used AFTER apiKeyAuth.
 *
 * @param requiredScopes - Array of scope strings required for this endpoint
 */
export function requireApiScopes(requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // If authenticated via JWT (not API key), skip scope check
    if (!req.apiKeyInfo) {
      next();
      return;
    }

    const hasAllScopes = requiredScopes.every(scope =>
      req.apiKeyInfo!.scopes.includes(scope),
    );

    if (!hasAllScopes) {
      res.status(403).json({
        error: 'Insufficient API key permissions',
        required: requiredScopes,
        granted: req.apiKeyInfo.scopes,
      });
      return;
    }

    next();
  };
}
