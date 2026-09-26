import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../utils/errors';

// Extend Express Request interface to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Authentication Middleware (Simplified for Assessment)
 * Reads the `x-user-id` header and attaches it to the request object.
 * Rejects requests with missing or empty `x-user-id` header with 401 Unauthorized.
 */
export function authenticateUser(req: Request, res: Response, next: NextFunction): void {
  const headerValue = req.headers['x-user-id'];

  if (!headerValue || typeof headerValue !== 'string' || headerValue.trim().length === 0) {
    throw new UnauthorizedError("Missing or invalid 'x-user-id' header. Authentication required.");
  }

  req.userId = headerValue.trim();
  next();
}
