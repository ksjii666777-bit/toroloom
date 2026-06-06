import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter.
 * Max requests per window can be overridden via RATE_LIMIT_MAX env var
 * (useful for load testing — set to a high value like 100000).
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

/**
 * Auth-specific rate limiter (stricter).
 * Max attempts can be overridden via AUTH_RATE_LIMIT_MAX env var.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});
