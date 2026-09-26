import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Centralized Error Handling Middleware
 * Ensures every error returns a clean, predictable JSON payload.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn(`Handled application error: ${err.message}`, {
      path: req.originalUrl,
      method: req.method,
      statusCode: err.statusCode,
      details: err.details,
    });

    res.status(err.statusCode).json({
      success: false,
      error: err.constructor.name.replace('Error', ''),
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Unhandled / unexpected internal errors
  logger.error(`Unhandled internal server error: ${err.message}`, {
    path: req.originalUrl,
    method: req.method,
    stack: err.stack,
  });

  res.status(500).json({
    success: false,
    error: 'InternalServerError',
    message: 'An unexpected internal error occurred',
  });
}
