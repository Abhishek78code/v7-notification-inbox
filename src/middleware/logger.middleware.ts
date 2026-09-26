import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Structured HTTP Request Logger Middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info(`HTTP ${method} ${originalUrl} [${res.statusCode}] - ${durationMs}ms`, {
      method,
      url: originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: req.userId || (req.headers['x-user-id'] as string) || 'anonymous',
    });
  });

  next();
}
