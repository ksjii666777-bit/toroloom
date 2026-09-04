/**
 * ============================================================================
 * Toroloom — Zod Request Validation Middleware
 * ============================================================================
 *
 * Reusable middleware that validates req.body against a Zod schema.
 * Returns 400 with structured error details on validation failure.
 *
 * Usage:
 *   import { validate } from '../middleware/validate';
 *   import { createOrderSchema } from '../schemas/payments';
 *
 *   router.post('/create-order', validate(createOrderSchema), handler);
 *
 * ============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Express middleware factory that validates req.body, req.query, or req.params
 * against a Zod schema.
 *
 * On success: replaces the source object with the parsed/transformed value
 *   and calls next().
 * On failure: returns 400 with { error, details } where `error` includes
 *   the first failing field name so callers can surface it directly.
 *
 * @param schema  - Zod schema to validate against
 * @param source  - Where to read the input from (default: 'body')
 */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const input = (req as unknown as Record<string, unknown>)[source] ?? {};
      const parsed = schema.parse(input);
      (req as unknown as Record<string, unknown>)[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        }));

        // Include first failing field in the top-level `error` string so
        // error messages stay useful even when callers log just `error`.
        const first = details[0];
        const fieldLabel = first?.field ? first.field : '';
        const errorMessage = first
          ? `Validation failed: ${fieldLabel} ${first.message}`.trim()
          : 'Validation failed';

        res.status(400).json({
          error: errorMessage,
          details,
        });
        return;
      }

      // Non-Zod error — pass to Express error handler
      next(err);
    }
  };
}
