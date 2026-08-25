import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/config';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error';
import { AuthUserPayload } from '../types';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError('Authentication token is required', 'TOKEN_MISSING');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError(
      'Malformed authorization header, Bearer scheme required',
      'TOKEN_MALFORMED',
    );
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new UnauthorizedError('Malformed authorization header, token missing', 'TOKEN_MALFORMED');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as AuthUserPayload;
    if (
      !decoded.userId ||
      !decoded.role ||
      (decoded as unknown as Record<string, unknown>).type === 'google_registration'
    ) {
      throw new UnauthorizedError('Invalid access token signature or payload', 'INVALID_TOKEN');
    }
    req.user = decoded;
    next();
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired, please refresh', 'TOKEN_EXPIRED');
    }
    throw new UnauthorizedError('Invalid access token signature or payload', 'INVALID_TOKEN');
  }
};

export const optionalAuthenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as AuthUserPayload;
    req.user = decoded;
  } catch {
    // Gracefully ignore token errors for optional auth
  }

  next();
};

export const authorize = (...allowedRoles: ('USER' | 'ADMIN')[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('User authentication required', 'UNAUTHORIZED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        'You do not have permission to perform this action',
        'FORBIDDEN_RESOURCE',
      );
    }

    next();
  };
};

/**
 * Middleware ensuring the authenticated user has the ADMIN role.
 * Throws 403 Forbidden with ADMIN_ACCESS_REQUIRED if the user is not an admin.
 */
export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw new UnauthorizedError('User authentication required', 'UNAUTHORIZED');
  }

  if (req.user.role !== 'ADMIN') {
    throw new ForbiddenError('Admin access required', 'ADMIN_ACCESS_REQUIRED');
  }

  next();
};

/**
 * Combined authentication and admin role enforcement middleware for Admin routes.
 */
export const authenticateAdmin = [authenticate, requireAdmin];
