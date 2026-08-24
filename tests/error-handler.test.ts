import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express, { Application, Request, Response } from 'express';
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../src/common/errors/app-error';
import { errorHandlerMiddleware } from '../src/common/middleware/error.middleware';
import { requestIdMiddleware } from '../src/common/middleware/request-id.middleware';

describe('Common Foundation — Error Handling & Middleware (Phase 5)', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);

    // Test routes throwing various errors
    app.get('/test-not-found', () => {
      throw new NotFoundError('Destination not found', 'DESTINATION_NOT_FOUND');
    });

    app.get('/test-validation-error', () => {
      throw new ValidationError('Invalid input data', [
        'email must be a valid email',
        'rating must be between 1.0 and 5.0',
      ]);
    });

    app.get('/test-unauthorized', () => {
      throw new UnauthorizedError('Token is expired or invalid');
    });

    app.get('/test-forbidden', () => {
      throw new ForbiddenError('You do not have permission to delete this review');
    });

    app.get('/test-conflict', () => {
      throw new ConflictError('Destination with this slug already exists');
    });

    app.get('/test-bad-request', () => {
      throw new BadRequestError('Invalid query filters provided');
    });

    app.get('/test-jwt-expired', () => {
      const err = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      throw err;
    });

    app.get('/test-unexpected', () => {
      throw new Error('Database connection timed out');
    });

    app.post('/test-echo', (req: Request, res: Response) => {
      res.json({ success: true, body: req.body });
    });

    app.use(errorHandlerMiddleware);
  });

  it('should format NotFoundError with custom errorCode correctly', async () => {
    const response = await request(app).get('/test-not-found');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Destination not found',
      errorCode: 'DESTINATION_NOT_FOUND',
    });
  });

  it('should format ValidationError with details array', async () => {
    const response = await request(app).get('/test-validation-error');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: 'Invalid input data',
      errorCode: 'VALIDATION_ERROR',
      details: [
        'email must be a valid email',
        'rating must be between 1.0 and 5.0',
      ],
    });
  });

  it('should format UnauthorizedError correctly', async () => {
    const response = await request(app).get('/test-unauthorized');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: 'Token is expired or invalid',
      errorCode: 'UNAUTHORIZED',
    });
  });

  it('should format ForbiddenError correctly', async () => {
    const response = await request(app).get('/test-forbidden');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: 'You do not have permission to delete this review',
      errorCode: 'FORBIDDEN',
    });
  });

  it('should format ConflictError correctly', async () => {
    const response = await request(app).get('/test-conflict');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message: 'Destination with this slug already exists',
      errorCode: 'CONFLICT',
    });
  });

  it('should format BadRequestError correctly', async () => {
    const response = await request(app).get('/test-bad-request');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: 'Invalid query filters provided',
      errorCode: 'BAD_REQUEST',
    });
  });

  it('should format TokenExpiredError correctly', async () => {
    const response = await request(app).get('/test-jwt-expired');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: 'Authentication token has expired',
      errorCode: 'UNAUTHORIZED',
    });
  });

  it('should handle unhandled/unexpected exceptions with 500 status', async () => {
    const response = await request(app).get('/test-unexpected');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.errorCode).toBe('INTERNAL_SERVER_ERROR');
    expect(response.body).toHaveProperty('message');
  });

  it('should propagate X-Request-ID correlation header across requests and errors', async () => {
    const customRequestId = 'test-trace-correlation-id-999';
    const response = await request(app)
      .get('/test-not-found')
      .set('x-request-id', customRequestId);

    expect(response.headers['x-request-id']).toBe(customRequestId);
  });
});
