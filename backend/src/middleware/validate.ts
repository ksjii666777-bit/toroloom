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
 * Express middleware factory that validates req.body against a Zod schema.
 *
 * On success: calls next() — req.body is now the parsed/transformed value.
 * On failure: returns 400 with { error, details }.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        }));

        res.status(400).json({
          error: 'Validation failed',
          details,
        });
        return;
      }

      // Non-Zod error — pass to Express error handler
      next(err);
    }
  };
}
