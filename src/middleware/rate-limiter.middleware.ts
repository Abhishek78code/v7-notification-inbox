import { Request, Response, NextFunction } from 'express';
import { TooManyRequestsError } from '../utils/errors';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * In-Memory Sliding-Window Rate Limiter Middleware
 * Protects endpoints from abuse based on client IP or x-user-id.
 */
export function createRateLimiter(windowMs: number = 60 * 1000, maxRequests: number = 100) {
  const store = new Map<string, RateLimitRecord>();

  // Cleanup expired entries periodically to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = (req.headers['x-user-id'] as string) || req.ip || 'unknown';
    const now = Date.now();

    const record = store.get(identifier);

    if (!record || now > record.resetTime) {
      store.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
      });
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      next();
      return;
    }

    if (record.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      throw new TooManyRequestsError(
        `Too many requests. Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`
      );
    }

    record.count += 1;
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - record.count);
    next();
  };
}
