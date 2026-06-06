import * as Sentry from '@sentry/node';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Capture unhandled errors with Sentry (redundant if the Sentry middleware
  // already caught it, but ensures capture if the error handler is used directly).
  Sentry.captureException(err);

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(env.isDev ? { detail: err.message } : {}),
  });
}
