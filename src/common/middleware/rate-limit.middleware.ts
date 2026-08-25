import { rateLimit, RateLimitRequestHandler } from 'express-rate-limit';
import { config } from '../../config/config';

/**
 * Standard Global API Rate Limiter
 * Applied across general endpoints
 */
export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    errorCode: 'TOO_MANY_REQUESTS',
  },
});

/**
 * Public Authentication Rate Limiter (Brute-force protection)
 * Applied to public auth endpoints (/v1/auth/*)
 */
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.app.isTest ? 1000 : 15, // Max 15 attempts in production, generous in test
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
    errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Dedicated Admin Authentication Rate Limiter (High-risk Brute-force protection)
 * Applied specifically to Admin Auth endpoints (/admin/auth/login, /admin/auth/refresh)
 */
export const adminAuthLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.app.isTest ? 1000 : 5, // Strict: 5 attempts per 15 minutes in production
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many administrator authentication attempts from this IP, please try again after 15 minutes.',
    errorCode: 'ADMIN_AUTH_RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Expensive / AI Computation Rate Limiter
 * Applied to Smart Itinerary Generator (/v1/itineraries/generate) and Recommendation Engine (/v1/recommendations)
 */
export const expensiveAiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: config.app.isTest ? 1000 : 20, // Max 20 requests per minute in production
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Resource-intensive computation limit reached. Please wait a moment before generating more itineraries or recommendations.',
    errorCode: 'COMPUTE_RATE_LIMIT_EXCEEDED',
  },
});
